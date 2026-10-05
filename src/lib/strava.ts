// Import des courses Strava (Garmin Connect se synchronise vers Strava). TypeScript pur : aucun appel réseau ici,
// voir `stravaClient.ts` pour le réseau. La réponse de Strava n'est jamais crue sur parole.

import { type Plan } from "./plan.ts";
import { DETAIL_VERSION, addActivity, type Activity, type Efforts, type EffortKey, type RunDetail, type Series, type SegmentEffort, type Split, type Tracked, type Zones } from "./activities.ts";

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
  /** Droits accordés par l'utilisateur à la connexion ; absent : connexion d'avant, lecture des activités seulement */
  scopes?: string[];
  /** Données du compte (totaux, matériel, itinéraires, clubs), lues à la demande */
  account?: StravaAccount;
}

/** 2 : fréquence cardiaque et dénivelé. */
export const STRAVA_SCHEMA = 2;

/** Droits demandés : activités, matériel et zones (profile:read_all), itinéraires (read_all). */
export const STRAVA_SCOPE = "read,activity:read,profile:read_all,read_all";

/** Droits supposés pour une connexion faite avant l'ajout des autres. */
export const BASE_SCOPES = ["read", "activity:read"];

export const grantedScopes = (s: Pick<StravaState, "scopes">) => s.scopes ?? BASE_SCOPES;
export const hasScope = (s: Pick<StravaState, "scopes">, scope: string) => grantedScopes(s).includes(scope);
/** Vrai si la connexion n'a pas tous les droits demandés aujourd'hui (il faut se reconnecter pour les accorder). */
export const lacksScopes = (s: StravaState) => isConnected(s) && STRAVA_SCOPE.split(",").some((x) => !hasScope(s, x));

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
    scope: STRAVA_SCOPE,
    state,
  });
  return `https://www.strava.com/oauth/authorize?${q}`;
}

export type CallbackResult =
  | { kind: "none" }
  | { kind: "code"; code: string; scopes: string[] }
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
    return { kind: "error", message: "Coche « Voir les données de tes activités » lors de l'autorisation, sinon Runner ne peut pas lire tes courses." };
  }
  return { kind: "code", code: code!, scopes: q.get("scope")!.split(",") };
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

/** Course Strava → activité Runner, ou null si ce n'est pas une course exploitable. */
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

// ---------- Meilleurs efforts ----------

/** Distances suivies, en mètres. */
const EFFORT_METERS: Record<EffortKey, number> = { "5k": 5000, "10k": 10000, semi: 21097.5, marathon: 42195 };
/** Un effort compte pour une distance s'il en est à 1 % près (les noms varient, la distance non). */
const EFFORT_TOLERANCE = 0.01;
/** Pour chaque distance, on interroge les sorties les plus rapides en allure moyenne. */
export const EFFORT_CANDIDATES_PER_DISTANCE = 6;
/** Nombre maximal de détails lus par synchronisation (les quotas de Strava sont de 100 requêtes par 15 minutes). */
export const EFFORT_BATCH = 25;

/** Lit `best_efforts` dans le détail d'une activité Strava. Objet vide si rien d'exploitable. */
export function parseBestEfforts(raw: unknown): Efforts {
  const out: Efforts = {};
  const list = (raw as { best_efforts?: unknown } | null)?.best_efforts;
  if (!Array.isArray(list)) return out;
  for (const e of list as { distance?: unknown; elapsed_time?: unknown }[]) {
    if (!e || typeof e.distance !== "number" || typeof e.elapsed_time !== "number" || e.elapsed_time <= 0) continue;
    for (const key of Object.keys(EFFORT_METERS) as EffortKey[]) {
      if (Math.abs(e.distance - EFFORT_METERS[key]) <= EFFORT_METERS[key] * EFFORT_TOLERANCE) {
        const minutes = round2(e.elapsed_time / 60);
        if (out[key] === undefined || minutes < out[key]!) out[key] = minutes;
      }
    }
  }
  return out;
}

/** Identifiant Strava d'une activité importée, ou null. */
export function stravaNumericId(a: Activity): number | null {
  const m = /^strava:(\d+)$/.exec(a.externalId ?? "");
  return m ? Number(m[1]) : null;
}

/**
 * Activités dont il faut lire le détail pour connaître leurs meilleurs efforts.
 * Un meilleur 5 km peut se cacher dans n'importe quelle sortie d'au moins 5 km, mais il y a peu de chances qu'il se
 * trouve dans une sortie lente : pour chaque distance on retient les plus rapides en allure moyenne (parmi toutes
 * celles qui sont assez longues, détail déjà lu ou non), puis on ne garde que celles dont le détail manque encore.
 */
export function effortCandidates(
  activities: Activity[],
  perDistance = EFFORT_CANDIDATES_PER_DISTANCE,
  max = EFFORT_BATCH
): Activity[] {
  const chosen = new Map<string, Activity>();
  for (const key of Object.keys(EFFORT_METERS) as EffortKey[]) {
    const km = EFFORT_METERS[key] / 1000;
    activities
      .filter((a) => stravaNumericId(a) !== null && a.km >= km && a.minutes > 0)
      .sort((a, b) => a.minutes / a.km - b.minutes / b.km || a.date.localeCompare(b.date))
      .slice(0, perDistance)
      .filter((a) => a.efforts === undefined)
      .forEach((a) => chosen.set(a.id, a));
  }
  return [...chosen.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, max);
}

/** Température moyenne (°C) du détail d'une activité Strava ; null si la montre n'en a pas relevé. */
export function parseTemp(raw: unknown): number | null {
  const t = (raw as { average_temp?: unknown } | null)?.average_temp;
  return typeof t === "number" && Number.isFinite(t) && t >= -60 && t <= 60 ? t : null;
}

const inRange = (x: unknown, lo: number, hi: number): x is number => typeof x === "number" && Number.isFinite(x) && x >= lo && x <= hi;

/**
 * Détail d'une activité Strava : temps par kilomètre, cadence, calories, durée totale, appareil.
 * Toujours un objet pour une réponse lisible (même sans kilomètres, par exemple sur tapis) : l'activité est alors
 * marquée « lue » et n'est plus redemandée. null seulement si la réponse n'est pas un objet.
 */
export function parseRunDetail(raw: unknown): RunDetail | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const splits: Split[] = [];
  if (Array.isArray(r.splits_metric)) {
    for (const s of r.splits_metric as Record<string, unknown>[]) {
      if (!s || !inRange(s.distance, 50, 2000) || !inRange(s.moving_time, 1, 6 * 3600)) continue;
      const split: Split = { km: round2(s.distance / 1000), seconds: Math.round(s.moving_time) };
      const hr = heartRate(s.average_heartrate);
      if (hr !== undefined) split.hr = hr;
      if (inRange(s.elevation_difference, -500, 500)) split.elev = Math.round(s.elevation_difference);
      splits.push(split);
    }
  }
  const out: RunDetail = { splits, ver: DETAIL_VERSION };
  // Strava donne la cadence d'un seul pied : le nombre de pas par minute est le double.
  if (inRange(r.average_cadence, 30, 125)) out.cadence = Math.round(r.average_cadence * 2);
  if (inRange(r.calories, 1, 20000)) out.calories = Math.round(r.calories);
  if (inRange(r.elapsed_time, 1, 48 * 3600)) out.elapsedMinutes = round2(r.elapsed_time / 60);
  if (typeof r.device_name === "string" && r.device_name.trim() !== "") out.device = r.device_name.trim().slice(0, 60);
  if (inRange(r.max_speed, 0.5, 12)) out.maxSpeedKmh = Math.round(r.max_speed * 36) / 10;
  if (inRange(r.elev_high, -500, 9000)) out.elevHigh = Math.round(r.elev_high);
  if (inRange(r.elev_low, -500, 9000)) out.elevLow = Math.round(r.elev_low);
  // Sans capteur de puissance, Strava estime les watts : on ne garde que les mesures.
  if (r.device_watts === true) {
    const watts: NonNullable<RunDetail["watts"]> = {};
    if (inRange(r.average_watts, 1, 2500)) watts.avg = Math.round(r.average_watts);
    if (inRange(r.max_watts, 1, 5000)) watts.max = Math.round(r.max_watts);
    if (inRange(r.weighted_average_watts, 1, 2500)) watts.weighted = Math.round(r.weighted_average_watts);
    if (Object.keys(watts).length > 0) out.watts = watts;
  }
  if (typeof r.description === "string" && r.description.trim() !== "") out.description = r.description.trim().slice(0, 500);
  const type = r.workout_type === 1 ? "race" : r.workout_type === 2 ? "long" : r.workout_type === 3 ? "workout" : undefined;
  if (type) out.workoutType = type;
  const gear = r.gear as { id?: unknown; name?: unknown } | null | undefined;
  if (gear && typeof gear.id === "string" && typeof gear.name === "string" && gear.name.trim() !== "") out.gear = { id: gear.id, name: gear.name.trim().slice(0, 80) };
  const start = latLng(r.start_latlng);
  const end = latLng(r.end_latlng);
  if (start) out.start = start;
  if (end) out.end = end;
  const map = r.map as { polyline?: unknown; summary_polyline?: unknown } | null | undefined;
  const encoded = typeof map?.polyline === "string" && map.polyline ? map.polyline : typeof map?.summary_polyline === "string" ? map.summary_polyline : "";
  const route = encoded ? simplify(decodePolyline(encoded), ROUTE_POINTS) : [];
  if (route.length >= 2) out.route = route;
  const segments = parseSegments(r.segment_efforts);
  if (segments.length > 0) out.segments = segments;
  return out;
}

/** Nombre de points gardés pour un tracé. */
export const ROUTE_POINTS = 60;

/** [latitude, longitude] valide, arrondi à 5 décimales (environ un mètre), sinon null. */
function latLng(x: unknown): [number, number] | null {
  if (!Array.isArray(x) || x.length < 2) return null;
  const [lat, lng] = x as unknown[];
  if (!inRange(lat, -90, 90) || !inRange(lng, -180, 180)) return null;
  return [Math.round(lat * 1e5) / 1e5, Math.round(lng * 1e5) / 1e5];
}

/** Décode un tracé encodé au format « polyline » de Google, que Strava utilise. */
export function decodePolyline(encoded: string): [number, number][] {
  const out: [number, number][] = [];
  let i = 0;
  let lat = 0;
  let lng = 0;
  const next = (): number | null => {
    let result = 0;
    let shift = 0;
    let b: number;
    do {
      if (i >= encoded.length) return null;
      b = encoded.charCodeAt(i++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20 && shift < 35);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (i < encoded.length) {
    const dLat = next();
    const dLng = next();
    if (dLat === null || dLng === null) break;
    lat += dLat;
    lng += dLng;
    const p = latLng([lat / 1e5, lng / 1e5]);
    if (p) out.push(p);
  }
  return out;
}

/** Garde n points régulièrement répartis, premier et dernier compris. */
export function simplify<T>(points: T[], n: number): T[] {
  if (points.length <= n) return points;
  return Array.from({ length: n }, (_, k) => points[Math.round((k * (points.length - 1)) / (n - 1))]);
}

/** Segments Strava parcourus (30 au plus). */
function parseSegments(raw: unknown): SegmentEffort[] {
  if (!Array.isArray(raw)) return [];
  const out: SegmentEffort[] = [];
  for (const e of raw as Record<string, unknown>[]) {
    if (!e || typeof e.name !== "string" || !e.name.trim()) continue;
    const seconds = inRange(e.moving_time, 1, 6 * 3600) ? e.moving_time : e.elapsed_time;
    const meters = (e.segment as { distance?: unknown } | undefined)?.distance ?? e.distance;
    if (!inRange(seconds, 1, 6 * 3600) || !inRange(meters, 1, 100000)) continue;
    const seg: SegmentEffort = { name: e.name.trim().slice(0, 80), meters: Math.round(meters), seconds: Math.round(seconds) };
    if (inRange(e.pr_rank, 1, 3)) seg.prRank = e.pr_rank;
    const hr = heartRate(e.average_heartrate);
    if (hr !== undefined) seg.hr = hr;
    out.push(seg);
    if (out.length >= 30) break;
  }
  return out;
}

/**
 * Zones de fréquence cardiaque et de puissance (GET /activities/{id}/zones). Tableau vide si Strava n'en fournit
 * pas (abonnement requis) ; null si la réponse n'est pas une liste.
 */
export function parseZones(raw: unknown): Zones[] | null {
  if (!Array.isArray(raw)) return null;
  const out: Zones[] = [];
  for (const z of raw as Record<string, unknown>[]) {
    if (!z || (z.type !== "heartrate" && z.type !== "power") || !Array.isArray(z.distribution_buckets)) continue;
    const buckets = (z.distribution_buckets as Record<string, unknown>[])
      .filter((b) => b && inRange(b.min, 0, 10000) && typeof b.max === "number" && Number.isFinite(b.max) && inRange(b.time, 0, 48 * 3600))
      .map((b) => ({ min: Math.round(b.min as number), max: Math.round(b.max as number), seconds: Math.round(b.time as number) }));
    if (buckets.length >= 2 && buckets.some((b) => b.seconds > 0) && !out.some((x) => x.type === z.type)) out.push({ type: z.type, buckets });
  }
  return out;
}

/** Nombre de points gardés par courbe. */
export const SERIES_POINTS = 100;

const numbers = (x: unknown): number[] | null => {
  const data = (x as { data?: unknown } | null)?.data;
  return Array.isArray(data) && data.every((v) => typeof v === "number" && Number.isFinite(v)) ? (data as number[]) : null;
};

/**
 * Courbes (flux Strava lus avec `key_by_type`) ramenées à SERIES_POINTS points, chaque point étant la moyenne de son
 * tronçon de temps. Allure en secondes par km (0 sous 0,5 m/s : arrêt). Objet à `t` vide si rien d'exploitable ;
 * null si la réponse n'est pas un objet.
 */
export function parseSeries(raw: unknown): Series | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const time = numbers(r.time);
  if (!time || time.length < 2) return { t: [], ver: DETAIL_VERSION };
  const n = time.length;
  const hr = numbers(r.heartrate);
  const vel = numbers(r.velocity_smooth);
  const alt = numbers(r.altitude);
  const cad = numbers(r.cadence);
  const pow = numbers(r.watts);
  const tmp = numbers(r.temp);
  const grd = numbers(r.grade_smooth);
  const latlng = (r.latlng as { data?: unknown } | null)?.data;
  const hasRoute = Array.isArray(latlng) && latlng.length === n;
  const buckets = Math.min(SERIES_POINTS, n);
  const out: Series = { t: [] };
  const hrOut: number[] = [];
  const paceOut: number[] = [];
  const altOut: number[] = [];
  const cadOut: number[] = [];
  const powOut: number[] = [];
  const tmpOut: number[] = [];
  const grdOut: number[] = [];
  const routeOut: [number, number][] = [];
  for (let b = 0; b < buckets; b++) {
    const from = Math.floor((b * n) / buckets);
    const to = Math.max(from + 1, Math.floor(((b + 1) * n) / buckets));
    const avg = (list: number[] | null, ok: (v: number) => boolean) => {
      if (!list || list.length !== n) return 0;
      const vals = list.slice(from, to).filter(ok);
      return vals.length === 0 ? 0 : vals.reduce((a, v) => a + v, 0) / vals.length;
    };
    out.t.push(Math.round(time[to - 1]));
    hrOut.push(Math.round(avg(hr, (v) => v >= 30 && v <= 250)));
    const v = avg(vel, (x) => x > 0.5);
    paceOut.push(v > 0 ? Math.round(1000 / v) : 0);
    altOut.push(Math.round(avg(alt, () => true)));
    // Cadence d'un seul pied dans Strava : on double, comme pour la moyenne.
    cadOut.push(Math.round(avg(cad, (x) => x > 0) * 2));
    powOut.push(Math.round(avg(pow, (x) => x > 0)));
    tmpOut.push(Math.round(avg(tmp, (x) => x > -60 && x < 60)));
    grdOut.push(Math.round(avg(grd, (x) => x >= -60 && x <= 60) * 10) / 10);
    if (hasRoute) {
      const p = latLng((latlng as unknown[])[to - 1]);
      if (p) routeOut.push(p);
    }
  }
  if (hrOut.some((v) => v > 0)) out.hr = hrOut;
  if (paceOut.some((v) => v > 0)) out.pace = paceOut;
  if (alt && alt.length === n) out.alt = altOut;
  if (cadOut.some((v) => v > 0)) out.cadence = cadOut;
  if (powOut.some((v) => v > 0)) out.watts = powOut;
  if (tmpOut.some((v) => v !== 0)) out.temp = tmpOut;
  if (grd && grd.length === n) out.grade = grdOut;
  if (routeOut.length === buckets) out.route = routeOut;
  const moving = (r.moving as { data?: unknown } | null)?.data;
  if (Array.isArray(moving) && moving.length === n) {
    let stopped = 0;
    for (let i = 1; i < n; i++) if (moving[i] === false) stopped += Math.max(0, time[i] - time[i - 1]);
    out.stopped = Math.round(stopped);
  }
  out.ver = DETAIL_VERSION;
  return out;
}

/** Nombre de sorties récentes dont on lit le détail pour en connaître la température. */
export const RECENT_TEMP_COUNT = 8;

/**
 * Activités dont il faut lire le détail : les plus récentes dont la température est inconnue (elle ne figure que dans
 * le détail), puis celles qui peuvent cacher un meilleur effort. Le total est plafonné pour ménager les quotas.
 */
export function detailTargets(activities: Activity[], perDistance = EFFORT_CANDIDATES_PER_DISTANCE, max = EFFORT_BATCH): Activity[] {
  const recent = activities
    .filter((a) => stravaNumericId(a) !== null)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
    .slice(0, RECENT_TEMP_COUNT)
    .filter((a) => a.temp === undefined);
  const out = new Map<string, Activity>();
  for (const a of recent) out.set(a.id, a);
  for (const a of effortCandidates(activities, perDistance, Infinity)) out.set(a.id, a);
  return [...out.values()].slice(0, max);
}

export interface DetailsRead {
  efforts: Map<string, Efforts>;
  temps: Map<string, number | null>;
  /** Temps par kilomètre, cadence, calories (absent : non lus) */
  details?: Map<string, RunDetail>;
}

/** Enregistre ce que le détail a appris (efforts, température) sans jamais écraser une valeur déjà connue. */
export function applyDetails(activities: Activity[], read: DetailsRead): Activity[] {
  return activities.map((a) => {
    if (!a.externalId) return a;
    const efforts = a.efforts === undefined ? read.efforts.get(a.externalId) : undefined;
    const temp = a.temp === undefined && read.temps.has(a.externalId) ? read.temps.get(a.externalId) : undefined;
    const detail = a.detail === undefined ? read.details?.get(a.externalId) : undefined;
    if (efforts === undefined && temp === undefined && detail === undefined) return a;
    return { ...a, ...(efforts !== undefined ? { efforts } : {}), ...(temp !== undefined ? { temp } : {}), ...(detail !== undefined ? { detail } : {}) };
  });
}

/** Enregistre les efforts lus (par identifiant externe) sans toucher au reste des activités. */
export function applyEfforts(activities: Activity[], byExternalId: Map<string, Efforts>): Activity[] {
  return activities.map((a) => (a.externalId && byExternalId.has(a.externalId) && a.efforts === undefined ? { ...a, efforts: byExternalId.get(a.externalId)! } : a));
}

/**
 * Début de la fenêtre à demander à Strava, en secondes Unix.
 * Première synchro (ou historique complet demandé) : 0, donc toutes les courses du compte.
 */
export function syncAfter(lastSync: number | null): number {
  return lastSync === null ? 0 : Math.floor(lastSync / 1000) - RESYNC_OVERLAP_DAYS * 86400;
}

// ---------- Compte Strava (totaux, matériel, itinéraires, clubs) ----------

export interface RunTotals {
  count: number;
  km: number;
  seconds: number;
  /** Dénivelé positif, en mètres */
  elevation: number;
}

export interface StravaShoe {
  id: string;
  name: string;
  /** Kilométrage cumulé sur Strava */
  km: number;
}

export interface StravaClub {
  id: number;
  name: string;
  members?: number;
  city?: string;
}

export interface StravaRoute {
  id: number;
  name: string;
  km: number;
  elevation?: number;
  route?: [number, number][];
}

/** Ce que le compte a fourni à la dernière lecture. Une rubrique absente : non accordée ou indisponible. */
export interface StravaAccount {
  /** millisecondes Unix */
  loadedAt: number;
  athleteId: number;
  totals?: { recent?: RunTotals; year?: RunTotals; all?: RunTotals };
  shoes?: StravaShoe[];
  clubs?: StravaClub[];
  routes?: StravaRoute[];
}

/** Kilométrage au-delà duquel une paire de chaussures est à surveiller (repère courant : 600 à 800 km). */
export const SHOE_WEAR_KM = 700;

function totalsOf(x: unknown): RunTotals | undefined {
  const t = x as Record<string, unknown> | null;
  if (!t || !inRange(t.count, 0, 1e6) || !inRange(t.distance, 0, 1e9)) return undefined;
  return {
    count: Math.round(t.count),
    km: Math.round(t.distance / 100) / 10,
    seconds: inRange(t.moving_time, 0, 1e9) ? Math.round(t.moving_time) : 0,
    elevation: inRange(t.elevation_gain, 0, 1e8) ? Math.round(t.elevation_gain) : 0,
  };
}

/** Totaux de course (GET /athletes/{id}/stats) : 4 dernières semaines, année en cours, depuis toujours. */
export function parseStats(raw: unknown): NonNullable<StravaAccount["totals"]> | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const out: NonNullable<StravaAccount["totals"]> = {};
  const recent = totalsOf(r.recent_run_totals);
  const year = totalsOf(r.ytd_run_totals);
  const all = totalsOf(r.all_run_totals);
  if (recent) out.recent = recent;
  if (year) out.year = year;
  if (all) out.all = all;
  return out;
}

/** Identifiant et chaussures du profil (GET /athlete) : seuls ces deux éléments sont gardés. */
export function parseAthlete(raw: unknown): { id: number; shoes: StravaShoe[] } | null {
  const r = raw as { id?: unknown; shoes?: unknown } | null;
  if (!r || typeof r.id !== "number" || !Number.isFinite(r.id)) return null;
  const shoes: StravaShoe[] = [];
  if (Array.isArray(r.shoes)) {
    for (const g of r.shoes as Record<string, unknown>[]) {
      if (!g || typeof g.id !== "string" || typeof g.name !== "string" || !g.name.trim() || !inRange(g.distance, 0, 1e8)) continue;
      shoes.push({ id: g.id, name: g.name.trim().slice(0, 80), km: Math.round(g.distance / 1000) });
    }
  }
  return { id: r.id, shoes };
}

export function parseClubs(raw: unknown): StravaClub[] | null {
  if (!Array.isArray(raw)) return null;
  const out: StravaClub[] = [];
  for (const c of raw as Record<string, unknown>[]) {
    if (!c || typeof c.id !== "number" || typeof c.name !== "string" || !c.name.trim()) continue;
    const club: StravaClub = { id: c.id, name: c.name.trim().slice(0, 80) };
    if (inRange(c.member_count, 0, 1e8)) club.members = c.member_count;
    if (typeof c.city === "string" && c.city.trim()) club.city = c.city.trim().slice(0, 60);
    out.push(club);
  }
  return out;
}

/** Itinéraires de course (type 2) enregistrés sur Strava, 20 au plus. */
export function parseRoutes(raw: unknown): StravaRoute[] | null {
  if (!Array.isArray(raw)) return null;
  const out: StravaRoute[] = [];
  for (const x of raw as Record<string, unknown>[]) {
    if (!x || typeof x.id !== "number" || typeof x.name !== "string" || x.type !== 2 || !inRange(x.distance, 100, 1e6)) continue;
    const route: StravaRoute = { id: x.id, name: x.name.trim().slice(0, 80) || "Itinéraire", km: Math.round(x.distance / 100) / 10 };
    if (inRange(x.elevation_gain, 0, 1e5)) route.elevation = Math.round(x.elevation_gain);
    const enc = (x.map as { summary_polyline?: unknown } | undefined)?.summary_polyline;
    const pts = typeof enc === "string" ? simplify(decodePolyline(enc), ROUTE_POINTS) : [];
    if (pts.length >= 2) route.route = pts;
    out.push(route);
    if (out.length >= 20) break;
  }
  return out;
}

/** Vrai si le détail d'une sortie importée est à lire (ou à relire, après une mise à jour du format). */
export function needsDetail(a: Activity, withZones: boolean): boolean {
  const d = a.detail;
  return !d || (d.ver ?? 1) < DETAIL_VERSION || !d.series || (d.series.ver ?? 1) < DETAIL_VERSION || (withZones && d.zones === undefined);
}
