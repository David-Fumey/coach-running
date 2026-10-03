// Appels réseau vers Strava. Le CORS de Strava est ouvert : tout se fait depuis le navigateur, sans serveur.
// `fetch` est injectable pour pouvoir tester sans réseau.

import { tokensExpired, type StravaRun, type StravaState, type StravaTokens } from "./strava.ts";

export type FetchLike = (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

export type StravaErrorKind = "reseau" | "autorisation" | "quota" | "reponse";

export class StravaError extends Error {
  kind: StravaErrorKind;
  constructor(kind: StravaErrorKind, message: string) {
    super(message);
    this.kind = kind;
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
  if (!res.ok) throw new StravaError("reponse", `Strava a répondu une erreur (${res.status}).`);
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
