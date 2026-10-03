// Import des courses Strava (Garmin Connect se synchronise vers Strava). TypeScript pur : aucun appel réseau ici,
// voir `stravaClient.ts` pour le réseau. La réponse de Strava n'est jamais crue sur parole.

import { type Plan } from "./plan.ts";
import { addActivity, type Activity, type Tracked } from "./activities.ts";

export interface StravaTokens {
  accessToken: string;
  refreshToken: string;
  /** Expiration du jeton d'accès, en secondes Unix */
  expiresAt: number;
}

/** Réglages et état de la connexion. Reste sur l'appareil, et n'est jamais mis dans la sauvegarde JSON. */
export interface StravaState {
  clientId: string;
  clientSecret: string;
  tokens: StravaTokens | null;
  /** Dernière synchronisation réussie, en millisecondes Unix */
  lastSync: number | null;
  /** Courses déjà importées (même supprimées ensuite) : elles ne reviennent pas à la synchro suivante */
  seen: string[];
  /** Version des données lues. En dessous de `STRAVA_SCHEMA`, la prochaine synchro relit tout l'historique. */
  schema?: number;
}

/** 2 : fréquence cardiaque et dénivelé. */
export const STRAVA_SCHEMA = 2;

export const EMPTY_STRAVA: StravaState = { clientId: "", clientSecret: "", tokens: null, lastSync: null, seen: [] };

/** Champs de l'API Strava (`GET /athlete/activities`) dont on se sert. */
export interface StravaRun {
  id: number;
  name?: string;
  sport_type?: string;
  type?: string;
  /** mètres */
  distance: number;
  /** secondes, arrêts exclus */
  moving_time: number;
  /** Heure locale de départ, suffixée « Z » à tort par Strava */
  start_date_local: string;
  /** battements par minute, si la montre en a enregistré */
  average_heartrate?: number;
  max_heartrate?: number;
  /** mètres de dénivelé positif */
  total_elevation_gain?: number;
}

export const STRAVA_SOURCE = "strava";
const RUN_TYPES = new Set(["Run", "TrailRun", "VirtualRun"]);
/** Tolérance pour reconnaître une activité saisie à la main : même jour, distance à 10 % près. */
const SAME_RUN_TOLERANCE = 0.1;
/** Pour les suivantes, on recouvre la période déjà vue (les doublons sont écartés). */
const RESYNC_OVERLAP_DAYS = 7;

export const stravaId = (id: number) => `strava:${id}`;

export function isConnected(s: StravaState): boolean {
  return s.tokens !== null;
}

// ---------- Connexion (OAuth) ----------

export function authorizeUrl(clientId: string, redirectUri: string, state: string): string {
  const q = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    approval_prompt: "auto",
    scope: "read,activity:read",
    state,
  });
  return `https://www.strava.com/oauth/authorize?${q}`;
}

export type CallbackResult =
  | { kind: "none" }
  | { kind: "code"; code: string }
  | { kind: "error"; message: string };

/** Lit le retour de Strava dans l'URL. Sans `state` attendu identique, le retour est refusé (anti-CSRF). */
export function parseCallback(search: string, expectedState: string | null): CallbackResult {
  const q = new URLSearchParams(search);
  const code = q.get("code");
  const error = q.get("error");
  if (!code && !error) return { kind: "none" };
  if (!expectedState || q.get("state") !== expectedState) return { kind: "error", message: "Retour de Strava inattendu : recommence la connexion." };
  if (error) return { kind: "error", message: "Strava a refusé la connexion (autorisation non accordée)." };
  if (!q.get("scope")?.split(",").includes("activity:read")) {
    return { kind: "error", message: "Coche « Voir les données de tes activités » lors de l'autorisation, sinon Foulée ne peut pas lire tes courses." };
  }
  return { kind: "code", code: code! };
}

export const tokensExpired = (t: StravaTokens, nowSec: number) => t.expiresAt - 60 <= nowSec;

// ---------- Conversion et fusion ----------

export function isRun(r: StravaRun): boolean {
  return RUN_TYPES.has(r.sport_type ?? r.type ?? "");
}

const round2 = (x: number) => Math.round(x * 100) / 100;

/** Fréquence cardiaque plausible (30 à 250), sinon on ignore la valeur. */
const heartRate = (x: unknown) => (typeof x === "number" && Number.isFinite(x) && x >= 30 && x <= 250 ? Math.round(x) : undefined);
const elevationOf = (x: unknown) => (typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= 20000 ? Math.round(x) : undefined);

type Details = Pick<Activity, "avgHr" | "maxHr" | "elevation">;

function detailsOf(r: StravaRun): Details {
  const out: Details = {};
  const avg = heartRate(r.average_heartrate);
  const max = heartRate(r.max_heartrate);
  const up = elevationOf(r.total_elevation_gain);
  if (avg !== undefined) out.avgHr = avg;
  if (max !== undefined) out.maxHr = max;
  if (up !== undefined) out.elevation = up;
  return out;
}

function pickDetails(a: Activity): Details {
  const out: Details = {};
  if (a.avgHr !== undefined) out.avgHr = a.avgHr;
  if (a.maxHr !== undefined) out.maxHr = a.maxHr;
  if (a.elevation !== undefined) out.elevation = a.elevation;
  return out;
}

/** Complète une activité avec les détails qui lui manquent, sans jamais écraser une valeur existante. */
function withDetails(a: Activity, d: Details): Activity {
  const missing = (Object.keys(d) as (keyof Details)[]).filter((k) => a[k] === undefined);
  return missing.length === 0 ? a : { ...a, ...Object.fromEntries(missing.map((k) => [k, d[k]])) };
}

/** Course Strava → activité Foulée, ou null si ce n'est pas une course exploitable. */
export function toActivity(r: StravaRun): Activity | null {
  if (!r || !Number.isFinite(r.id) || !isRun(r)) return null;
  if (!Number.isFinite(r.distance) || r.distance <= 0 || !Number.isFinite(r.moving_time) || r.moving_time <= 0) return null;
  if (typeof r.start_date_local !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(r.start_date_local)) return null;
  const km = round2(r.distance / 1000);
  const minutes = round2(r.moving_time / 60);
  if (km <= 0 || minutes <= 0) return null;
  const name = typeof r.name === "string" ? r.name.trim() : "";
  return {
    id: `strava-${r.id}`,
    date: r.start_date_local.slice(0, 10),
    km,
    minutes,
    source: STRAVA_SOURCE,
    externalId: stravaId(r.id),
    ...detailsOf(r),
    ...(name ? { note: name } : {}),
  };
}

export interface MergeResult {
  state: Tracked;
  seen: string[];
  /** Nouvelles activités créées */
  added: number;
  /** Activités saisies à la main reconnues comme la même course (rien n'est dupliqué) */
  matched: number;
  /** Activités déjà connues qui ont reçu la fréquence cardiaque ou le dénivelé qui leur manquait */
  enriched: number;
}

/**
 * Ajoute les courses pas encore connues. Ne supprime ni ne modifie jamais ce que l'utilisateur a saisi.
 * - Une course déjà importée (ou importée puis supprimée) est ignorée.
 * - Une activité manuelle du même jour et de distance voisine est reconnue plutôt que dupliquée.
 * - Une nouvelle course est rattachée à la séance prévue le même jour, si elle n'est pas déjà faite.
 */
export function mergeStrava(plan: Plan, state: Tracked, seen: string[], runs: StravaRun[]): MergeResult {
  const sessions = plan.weeks.flatMap((w) => w.sessions);
  const seenSet = new Set(seen);
  let current = state;
  let added = 0;
  let matched = 0;
  let enriched = 0;

  const candidates = runs
    .map(toActivity)
    .filter((a): a is Activity => a !== null)
    // La plus longue d'abord : elle prend la séance du jour, les footings supplémentaires restent libres.
    .sort((a, b) => a.date.localeCompare(b.date) || b.km - a.km);

  for (const a of candidates) {
    const ext = a.externalId!;
    const details = pickDetails(a);
    const known = current.activities.find((x) => x.externalId === ext);
    if (known || seenSet.has(ext)) {
      seenSet.add(ext);
      const filled = known ? withDetails(known, details) : known;
      if (known && filled !== known) {
        current = { ...current, activities: current.activities.map((x) => (x === known ? filled! : x)) };
        enriched++;
      }
      continue;
    }
    seenSet.add(ext);

    const twin = current.activities.find((x) => !x.externalId && x.date === a.date && Math.abs(x.km - a.km) <= a.km * SAME_RUN_TOLERANCE);
    if (twin) {
      current = { ...current, activities: current.activities.map((x) => (x === twin ? withDetails({ ...x, source: STRAVA_SOURCE, externalId: ext }, details) : x)) };
      matched++;
      continue;
    }

    const session = sessions.find((s) => s.date === a.date && !current.done[s.id] && !current.activities.some((x) => x.sessionId === s.id));
    current = addActivity(current, session ? { ...a, sessionId: session.id } : a);
    added++;
  }

  return { state: current, seen: [...seenSet], added, matched, enriched };
}

/**
 * Début de la fenêtre à demander à Strava, en secondes Unix.
 * Première synchro (ou historique complet demandé) : 0, donc toutes les courses du compte.
 */
export function syncAfter(lastSync: number | null): number {
  return lastSync === null ? 0 : Math.floor(lastSync / 1000) - RESYNC_OVERLAP_DAYS * 86400;
}
