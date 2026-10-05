// Appels réseau vers Strava. Le CORS de Strava est ouvert : tout se fait depuis le navigateur, sans serveur.
// `fetch` est injectable pour pouvoir tester sans réseau.

import {
  hasScope,
  parseAthlete,
  parseBestEfforts,
  parseClubs,
  parseRoutes,
  parseRunDetail,
  parseSeries,
  parseStats,
  parseTemp,
  parseZones,
  tokensExpired,
  type StravaAccount,
  type StravaRun,
  type StravaState,
  type StravaTokens,
} from "./strava.ts";
import type { Efforts, RunDetail, Series, Zones } from "./activities.ts";

export type FetchLike = (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

export type StravaErrorKind = "reseau" | "autorisation" | "quota" | "reponse";

export class StravaError extends Error {
  kind: StravaErrorKind;
  /** Code HTTP, quand l'erreur vient d'une réponse de Strava */
  status?: number;
  constructor(kind: StravaErrorKind, message: string, status?: number) {
    super(message);
    this.kind = kind;
    this.status = status;
  }
}

const TOKEN_URL = "https://www.strava.com/oauth/token";
const ACTIVITIES_URL = "https://www.strava.com/api/v3/athlete/activities";
const PER_PAGE = 100;
/** Garde-fou : 3 000 activités au maximum par synchronisation. */
const MAX_PAGES = 30;

async function call(fetchFn: FetchLike, url: string, init?: Parameters<FetchLike>[1]) {
  let res;
  try {
    res = await fetchFn(url, init);
  } catch {
    throw new StravaError("reseau", "Strava est injoignable. Vérifie ta connexion et réessaie.");
  }
  if (res.status === 429) throw new StravaError("quota", "Trop de requêtes vers Strava pour l'instant. Réessaie dans un quart d'heure.");
  if (res.status === 401 || res.status === 403) {
    throw new StravaError("autorisation", "Strava a refusé l'accès. Vérifie ton identifiant et ton secret, ou reconnecte-toi.");
  }
  if (!res.ok) throw new StravaError("reponse", `Strava a répondu une erreur (${res.status}).`, res.status);
  try {
    return await res.json();
  } catch {
    throw new StravaError("reponse", "La réponse de Strava est illisible.");
  }
}

function readTokens(raw: unknown): StravaTokens {
  const r = raw as Record<string, unknown> | null;
  if (!r || typeof r.access_token !== "string" || typeof r.refresh_token !== "string" || typeof r.expires_at !== "number") {
    throw new StravaError("reponse", "La réponse de Strava est incomplète.");
  }
  return { accessToken: r.access_token, refreshToken: r.refresh_token, expiresAt: r.expires_at };
}

const form = (fields: Record<string, string>) => ({
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams(fields).toString(),
});

/** Échange le code reçu au retour de Strava contre des jetons. */
export async function exchangeCode(cfg: Pick<StravaState, "clientId" | "clientSecret">, code: string, fetchFn: FetchLike): Promise<StravaTokens> {
  const body = await call(fetchFn, TOKEN_URL, form({ client_id: cfg.clientId, client_secret: cfg.clientSecret, code, grant_type: "authorization_code" }));
  return readTokens(body);
}

/** Renouvelle le jeton d'accès (valable 6 h). Strava peut aussi renouveler le jeton de rafraîchissement. */
export async function refreshTokens(cfg: Pick<StravaState, "clientId" | "clientSecret">, tokens: StravaTokens, fetchFn: FetchLike): Promise<StravaTokens> {
  const body = await call(
    fetchFn,
    TOKEN_URL,
    form({ client_id: cfg.clientId, client_secret: cfg.clientSecret, grant_type: "refresh_token", refresh_token: tokens.refreshToken })
  );
  return readTokens(body);
}

/** Toutes les activités postérieures à `afterSec`, page par page. */
export async function listActivities(accessToken: string, afterSec: number, fetchFn: FetchLike): Promise<StravaRun[]> {
  const out: StravaRun[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const body = await call(fetchFn, `${ACTIVITIES_URL}?after=${afterSec}&per_page=${PER_PAGE}&page=${page}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!Array.isArray(body)) throw new StravaError("reponse", "La liste d'activités de Strava est illisible.");
    out.push(...(body as StravaRun[]));
    if (body.length < PER_PAGE) break;
  }
  return out;
}

/** Renouvelle le jeton si besoin, puis récupère les activités. Retourne aussi les jetons à enregistrer. */
export async function fetchRuns(
  cfg: Pick<StravaState, "clientId" | "clientSecret">,
  tokens: StravaTokens,
  afterSec: number,
  nowSec: number,
  fetchFn: FetchLike
): Promise<{ tokens: StravaTokens; runs: StravaRun[] }> {
  const fresh = tokensExpired(tokens, nowSec) ? await refreshTokens(cfg, tokens, fetchFn) : tokens;
  return { tokens: fresh, runs: await listActivities(fresh.accessToken, afterSec, fetchFn) };
}

const ACTIVITY_URL = "https://www.strava.com/api/v3/activities";

export interface EffortsResult {
  /** Efforts lus, par identifiant Strava (objet vide si l'activité n'en a aucun ou n'existe plus) */
  efforts: Map<number, Efforts>;
  /** Température moyenne par identifiant Strava (null = pas de capteur ou activité introuvable) */
  temps: Map<number, number | null>;
  /** Temps par kilomètre, cadence, calories par identifiant Strava */
  details: Map<number, RunDetail>;
  /** Raison de l'arrêt avant la fin (quota, réseau, accès refusé), sinon null */
  stopped: StravaError | null;
}

/**
 * Lit le détail des activités indiquées, une par une, pour en tirer les meilleurs efforts.
 * S'arrête proprement au premier quota atteint ou à la première coupure : ce qui est déjà lu reste acquis.
 * Une activité introuvable (supprimée sur Strava) est marquée « sans effort » pour ne pas être redemandée.
 */
export async function fetchEfforts(
  accessToken: string,
  ids: number[],
  fetchFn: FetchLike,
  onProgress?: (done: number, total: number) => void
): Promise<EffortsResult> {
  const efforts = new Map<number, Efforts>();
  const temps = new Map<number, number | null>();
  const details = new Map<number, RunDetail>();
  for (const id of ids) {
    try {
      const body = await call(fetchFn, `${ACTIVITY_URL}/${id}?include_all_efforts=false`, { headers: { Authorization: `Bearer ${accessToken}` } });
      efforts.set(id, parseBestEfforts(body));
      temps.set(id, parseTemp(body));
      const detail = parseRunDetail(body);
      if (detail) details.set(id, detail);
    } catch (e) {
      if (e instanceof StravaError && e.kind === "reponse") {
        // 404 : activité supprimée, on n'y reviendra pas. Autre erreur : on réessaiera à la prochaine synchro.
        if (e.status === 404) {
          efforts.set(id, {});
          temps.set(id, null);
          details.set(id, { splits: [] });
        }
        continue;
      }
      return { efforts, temps, details, stopped: e instanceof StravaError ? e : new StravaError("reseau", "Strava est injoignable. Vérifie ta connexion et réessaie.") };
    }
    onProgress?.(efforts.size, ids.length);
  }
  return { efforts, temps, details, stopped: null };
}

export interface SeriesResult {
  series: Series | null;
  stopped: StravaError | null;
}

/**
 * Lit les courbes (temps, FC, vitesse, altitude) d'une activité : une requête. Activité introuvable ou sans flux
 * (404) : courbes vides, pour ne pas la redemander. Autre erreur : rien n'est marqué, on réessaiera.
 */
export async function fetchSeries(accessToken: string, id: number, fetchFn: FetchLike): Promise<SeriesResult> {
  try {
    const body = await call(fetchFn, `${ACTIVITY_URL}/${id}/streams?keys=time,heartrate,velocity_smooth,altitude,latlng,cadence,watts,temp,grade_smooth,moving&key_by_type=true`, { headers: { Authorization: `Bearer ${accessToken}` } });
    return { series: parseSeries(body) ?? { t: [] }, stopped: null };
  } catch (e) {
    if (e instanceof StravaError && e.kind === "reponse") return { series: e.status === 404 ? { t: [] } : null, stopped: e.status === 404 ? null : e };
    return { series: null, stopped: e instanceof StravaError ? e : new StravaError("reseau", "Strava est injoignable. Vérifie ta connexion et réessaie.") };
  }
}

export interface ZonesResult {
  /** Zones lues ; tableau vide : Strava n'en fournit pas pour cette sortie ; null : rien de marqué, on réessaiera */
  zones: Zones[] | null;
  stopped: StravaError | null;
}

/**
 * Lit les zones de fréquence cardiaque et de puissance d'une activité. Strava les réserve à ses abonnés (402) : on
 * marque alors « aucune zone » pour ne pas redemander. Un accès refusé (droit non accordé) ne marque rien.
 */
export async function fetchZones(accessToken: string, id: number, fetchFn: FetchLike): Promise<ZonesResult> {
  try {
    const body = await call(fetchFn, `${ACTIVITY_URL}/${id}/zones`, { headers: { Authorization: `Bearer ${accessToken}` } });
    return { zones: parseZones(body) ?? [], stopped: null };
  } catch (e) {
    if (e instanceof StravaError && e.kind === "reponse") return { zones: e.status === 402 || e.status === 404 ? [] : null, stopped: e.status === 402 || e.status === 404 ? null : e };
    return { zones: null, stopped: e instanceof StravaError ? e : new StravaError("reseau", "Strava est injoignable. Vérifie ta connexion et réessaie.") };
  }
}

const API = "https://www.strava.com/api/v3";

/** Lecture facultative : un droit non accordé, un abonnement manquant ou une réponse illisible donnent null. Quota et réseau remontent. */
async function optional(fetchFn: FetchLike, url: string, accessToken: string): Promise<unknown | null> {
  try {
    return await call(fetchFn, url, { headers: { Authorization: `Bearer ${accessToken}` } });
  } catch (e) {
    if (e instanceof StravaError && (e.kind === "autorisation" || e.kind === "reponse")) return null;
    throw e;
  }
}

/**
 * Lit le compte : identifiant et chaussures (GET /athlete), totaux de course, clubs, itinéraires. Chaque rubrique
 * dépend d'un droit : celles qui ne sont pas accordées manquent simplement du résultat.
 */
export async function fetchAccount(state: Pick<StravaState, "scopes">, accessToken: string, nowMs: number, fetchFn: FetchLike): Promise<StravaAccount> {

  const athlete = parseAthlete(await optional(fetchFn, `${API}/athlete`, accessToken));
  if (!athlete) throw new StravaError("autorisation", "Strava n'a pas donné l'accès au compte. Reconnecte-toi en acceptant les droits demandés.");
  const out: StravaAccount = { loadedAt: nowMs, athleteId: athlete.id };
  if (hasScope(state, "profile:read_all")) out.shoes = athlete.shoes;
  const totals = parseStats(await optional(fetchFn, `${API}/athletes/${athlete.id}/stats`, accessToken));
  if (totals && Object.keys(totals).length > 0) out.totals = totals;
  const clubs = parseClubs(await optional(fetchFn, `${API}/athlete/clubs`, accessToken));
  if (clubs) out.clubs = clubs;
  if (hasScope(state, "read_all")) {
    const routes = parseRoutes(await optional(fetchFn, `${API}/athletes/${athlete.id}/routes?per_page=50`, accessToken));
    if (routes) out.routes = routes;
  }
  return out;
}
