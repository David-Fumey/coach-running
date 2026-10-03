// Import des courses Strava (Garmin Connect se synchronise vers Strava). TypeScript pur : aucun appel réseau ici,
// voir `stravaClient.ts` pour le réseau. La réponse de Strava n'est jamais crue sur parole.

import { addDays, type Plan } from "./plan.ts";
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
}

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
}

export const STRAVA_SOURCE = "strava";
const RUN_TYPES = new Set(["Run", "TrailRun", "VirtualRun"]);
/** Tolérance pour reconnaître une activité saisie à la main : même jour, distance à 10 % près. */
const SAME_RUN_TOLERANCE = 0.1;
/** Au premier import, on remonte un mois avant le début du plan. */
const FIRST_SYNC_LOOKBACK_DAYS = 30;
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

  const candidates = runs
    .map(toActivity)
    .filter((a): a is Activity => a !== null)
    // La plus longue d'abord : elle prend la séance du jour, les footings supplémentaires restent libres.
    .sort((a, b) => a.date.localeCompare(b.date) || b.km - a.km);

  for (const a of candidates) {
    const ext = a.externalId!;
    if (seenSet.has(ext) || current.activities.some((x) => x.externalId === ext)) {
      seenSet.add(ext);
      continue;
    }
    seenSet.add(ext);

    const twin = current.activities.find((x) => !x.externalId && x.date === a.date && Math.abs(x.km - a.km) <= a.km * SAME_RUN_TOLERANCE);
    if (twin) {
      current = { ...current, activities: current.activities.map((x) => (x === twin ? { ...x, source: STRAVA_SOURCE, externalId: ext } : x)) };
      matched++;
      continue;
    }

    const session = sessions.find((s) => s.date === a.date && !current.done[s.id] && !current.activities.some((x) => x.sessionId === s.id));
    current = addActivity(current, session ? { ...a, sessionId: session.id } : a);
    added++;
  }

  return { state: current, seen: [...seenSet], added, matched };
}

/** Début de la fenêtre à demander à Strava, en secondes Unix. */
export function syncAfter(plan: Plan, lastSync: number | null): number {
  if (lastSync !== null) return Math.floor(lastSync / 1000) - RESYNC_OVERLAP_DAYS * 86400;
  return Math.floor(Date.parse(`${addDays(plan.weeks[0].startDate, -FIRST_SYNC_LOOKBACK_DAYS)}T00:00:00Z`) / 1000);
}
