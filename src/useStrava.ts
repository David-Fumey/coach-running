import { useCallback, useEffect, useRef, useState } from "react";
import type { Plan } from "./lib/plan";
import type { Activity } from "./lib/activities";
import {
  EFFORT_CANDIDATES_PER_DISTANCE,
  EMPTY_STRAVA,
  STRAVA_SCHEMA,
  applyDetails,
  authorizeUrl,
  detailTargets,
  isConnected,
  mergeStrava,
  parseCallback,
  stravaNumericId,
  syncAfter,
  tokensExpired,
  type StravaState,
} from "./lib/strava";
import { StravaError, exchangeCode, fetchEfforts, fetchRuns, fetchSeries, refreshTokens, type FetchLike } from "./lib/stravaClient";
import { useStoredState } from "./storage";

export type StravaStatus =
  | { kind: "idle" }
  | { kind: "syncing"; text?: string }
  | { kind: "ok"; text: string }
  | { kind: "error"; text: string };

export interface StravaApi {
  state: StravaState;
  status: StravaStatus;
  connected: boolean;
  /** Enregistre l'identifiant et le secret, puis part sur la page d'autorisation de Strava */
  connect: (clientId: string, clientSecret: string) => void;
  /** Oublie la connexion, l'identifiant et le secret (les activités déjà importées restent) */
  disconnect: () => void;
  sync: () => void;
  /** Relit tout l'historique du compte Strava (les courses déjà connues sont ignorées) */
  syncAll: () => void;
  /** Lit le détail d'une sortie importée (temps par km, cadence, calories). Retourne un message d'erreur, ou null si tout va bien. */
  loadDetail: (activityId: string) => Promise<string | null>;
  /** À appeler quand les activités sont remplacées (nouveau plan, import) : tout redevient importable */
  forgetHistory: () => void;
  /** Efface tout, y compris l'historique d'import */
  reset: () => void;
}

interface Args {
  plan: Plan | null;
  confirmed: boolean;
  activities: Activity[];
  done: Record<string, boolean>;
  setActivities: (a: Activity[]) => void;
  setDone: (d: Record<string, boolean>) => void;
  /** Appelé au retour de Strava, pour rouvrir la page où se trouve la connexion */
  onReturn: () => void;
}

const NONCE_KEY = "foulee.strava.nonce";
const AUTO_SYNC_MIN_AGE_MS = 15 * 60 * 1000;
// Le navigateur d'aujourd'hui : fetch renvoie déjà ce que FetchLike attend.
const browserFetch: FetchLike = (url, init) => fetch(url, init);

/** Redirection vers Strava : même page qu'actuellement, sans paramètre. */
const redirectUri = () => window.location.origin + window.location.pathname;

function syncMessage(added: number, enriched: number): string {
  const parts: string[] = [];
  if (added > 0) parts.push(added === 1 ? "1 nouvelle course importée" : `${added} nouvelles courses importées`);
  if (enriched > 0) parts.push(enriched === 1 ? "1 course complétée (fréquence cardiaque, dénivelé)" : `${enriched} courses complétées (fréquence cardiaque, dénivelé)`);
  return parts.length === 0 ? "Tout est à jour." : `${parts.join(", ")}.`;
}

const randomNonce = () => crypto.getRandomValues(new Uint32Array(4)).join("-");

/**
 * Connexion à Strava et synchronisation des courses, sans serveur.
 * Garmin Connect envoie les sorties vers Strava ; Runner les y lit à l'ouverture et à la demande.
 */
export function useStrava({ plan, confirmed, activities, done, setActivities, setDone, onReturn }: Args): StravaApi {
  const [state, setState] = useStoredState<StravaState>("foulee.strava.v1", EMPTY_STRAVA);
  const [status, setStatus] = useState<StravaStatus>({ kind: "idle" });

  // Dernières valeurs, pour qu'une synchro lancée avant une modification ne l'écrase pas à son retour.
  const latest = useRef({ state, plan, activities, done });
  latest.current = { state, plan, activities, done };
  const syncing = useRef(false);
  const autoSynced = useRef(false);

  const sync = useCallback(async (full = false) => {
    const { state: s, plan: p } = latest.current;
    if (syncing.current || !s.tokens) return;
    if (!p) return setStatus({ kind: "ok", text: "Connecté. Les courses seront importées dès que ton plan sera prêt." });
    syncing.current = true;
    setStatus({ kind: "syncing" });
    try {
      const { tokens, runs } = await fetchRuns(s, s.tokens, full ? 0 : syncAfter(s.lastSync), Math.floor(Date.now() / 1000), browserFetch);
      const cur = latest.current;
      const merged = mergeStrava(cur.plan ?? p, { activities: cur.activities, done: cur.done }, cur.state.seen, runs);
      if (merged.added + merged.matched + merged.enriched > 0) {
        setActivities(merged.state.activities);
        setDone(merged.state.done);
      }
      // Une lecture complète a couvert tout l'historique : les détails (cœur, dénivelé) sont à jour.
      const complete = full || s.lastSync === null;
      setState((prev) => ({ ...prev, tokens, lastSync: Date.now(), seen: merged.seen, ...(complete ? { schema: STRAVA_SCHEMA } : {}) }));
      // Détails des sorties (température, meilleurs efforts) : quelques requêtes par synchronisation.
      let effortNote = "";
      const todo = detailTargets(merged.state.activities);
      if (todo.length > 0) {
        setStatus({ kind: "syncing", text: `Détails des sorties : 0/${todo.length}…` });
        const res = await fetchEfforts(
          tokens.accessToken,
          todo.map((a) => stravaNumericId(a)!),
          browserFetch,
          (n, total) => setStatus({ kind: "syncing", text: `Détails des sorties : ${n}/${total}…` })
        );
        let activitiesNow = merged.state.activities;
        if (res.efforts.size > 0) {
          const efforts = new Map([...res.efforts].map(([id, e]) => [`strava:${id}`, e]));
          const temps = new Map([...res.temps].map(([id, t]) => [`strava:${id}`, t]));
          // Le rendu de la fusion peut ne pas avoir eu lieu : on ne part des activités courantes que si elles la contiennent.
          const live = latest.current.activities;
          const base = merged.state.activities.every((a) => live.some((x) => x.id === a.id)) ? live : merged.state.activities;
          const details = new Map([...res.details].map(([id, d]) => [`strava:${id}`, d]));
          activitiesNow = applyDetails(base, { efforts, temps, details });
          setActivities(activitiesNow);
        }
        const remaining = detailTargets(activitiesNow, EFFORT_CANDIDATES_PER_DISTANCE, Infinity).length;
        const analysed = res.efforts.size;
        const parts: string[] = [];
        if (analysed > 0) parts.push(analysed === 1 ? "1 sortie analysée (température, meilleurs efforts)" : `${analysed} sorties analysées (température, meilleurs efforts)`);
        if (res.stopped?.kind === "quota") parts.push("quota Strava atteint, la suite sera lue à la prochaine synchro");
        else if (res.stopped) parts.push(res.stopped.message);
        else if (remaining > 0) parts.push(`${remaining} à analyser : relance la synchro`);
        effortNote = parts.length > 0 ? ` ${parts.join(" ; ")}.` : "";
      }
      setStatus({ kind: "ok", text: syncMessage(merged.added, merged.enriched) + effortNote });
    } catch (e) {
      setStatus({ kind: "error", text: e instanceof StravaError ? e.message : "La synchronisation avec Strava a échoué." });
    } finally {
      syncing.current = false;
    }
  }, [setActivities, setDone, setState]);

  // Retour de Strava après l'autorisation : on échange le code, puis on synchronise.
  useEffect(() => {
    const nonce = sessionStorage.getItem(NONCE_KEY);
    const result = parseCallback(window.location.search, nonce);
    if (result.kind === "none") return;
    // Tout de suite : le code ne sert qu'une fois (et l'effet peut s'exécuter deux fois en développement).
    sessionStorage.removeItem(NONCE_KEY);
    window.history.replaceState(null, "", redirectUri());
    autoSynced.current = true;
    onReturn();
    if (result.kind === "error") return setStatus({ kind: "error", text: result.message });
    setStatus({ kind: "syncing" });
    exchangeCode(latest.current.state, result.code, browserFetch)
      .then((tokens) => {
        latest.current = { ...latest.current, state: { ...latest.current.state, tokens } };
        setState((prev) => ({ ...prev, tokens }));
        return sync();
      })
      .catch((e) => setStatus({ kind: "error", text: e instanceof StravaError ? e.message : "La connexion à Strava a échoué." }));
    // Une seule fois, au chargement.
  }, []);

  // Synchronisation à l'ouverture, puis au retour sur l'appli si la dernière date de plus d'un quart d'heure.
  useEffect(() => {
    if (!plan || !confirmed || !isConnected(state)) return;
    if (!autoSynced.current) {
      autoSynced.current = true;
      // Après une mise à jour de l'appli qui lit plus de données, on relit tout l'historique une fois.
      void sync((state.schema ?? 0) < STRAVA_SCHEMA);
    }
    const onVisible = () => {
      const last = latest.current.state.lastSync;
      if (document.visibilityState === "visible" && (last === null || Date.now() - last > AUTO_SYNC_MIN_AGE_MS)) void sync();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [plan, confirmed, state.tokens, sync]);

  /** Lecture à la demande du détail d'une sortie (une requête), quand la synchro ne l'a pas encore lu. */
  async function loadDetail(activityId: string): Promise<string | null> {
    const { state: s, activities: list } = latest.current;
    const act = list.find((a) => a.id === activityId);
    const id = act ? stravaNumericId(act) : null;
    if (!act || id === null) return "Cette sortie ne vient pas de Strava.";
    if (!s.tokens) return "Connecte Strava (page Profil) pour lire le détail de cette sortie.";
    try {
      let tokens = s.tokens;
      if (tokensExpired(tokens, Math.floor(Date.now() / 1000))) {
        tokens = await refreshTokens(s, tokens, browserFetch);
        setState((prev) => ({ ...prev, tokens }));
      }
      let next = latest.current.activities;
      // Détail (kilomètres, cadence, calories) : une requête, seulement s'il n'a pas encore été lu.
      if (act.detail === undefined) {
        const res = await fetchEfforts(tokens.accessToken, [id], browserFetch);
        if (res.stopped) return res.stopped.message;
        if (res.details.size === 0) return "Strava n'a pas pu fournir le détail de cette sortie. Réessaie plus tard.";
        next = applyDetails(next, {
          efforts: new Map([...res.efforts].map(([n, e]) => [`strava:${n}`, e])),
          temps: new Map([...res.temps].map(([n, t]) => [`strava:${n}`, t])),
          details: new Map([...res.details].map(([n, d]) => [`strava:${n}`, d])),
        });
        setActivities(next);
      }
      // Courbes (FC, allure, altitude) : une seconde requête, une seule fois par sortie.
      if (act.detail?.series === undefined) {
        const res = await fetchSeries(tokens.accessToken, id, browserFetch);
        if (res.series) {
          const series = res.series;
          setActivities(next.map((x) => (x.id === activityId && x.detail && x.detail.series === undefined ? { ...x, detail: { ...x.detail, series } } : x)));
        } else if (res.stopped) return res.stopped.message;
      }
      return null;
    } catch (e) {
      return e instanceof StravaError ? e.message : "La lecture du détail a échoué.";
    }
  }

  function connect(clientId: string, clientSecret: string) {
    const id = clientId.trim();
    const secret = clientSecret.trim();
    setState((prev) => ({ ...prev, clientId: id, clientSecret: secret }));
    const nonce = randomNonce();
    sessionStorage.setItem(NONCE_KEY, nonce);
    // Le stockage local s'écrit après le rendu : on l'écrit à la main avant de quitter la page.
    try {
      localStorage.setItem("foulee.strava.v1", JSON.stringify({ ...latest.current.state, clientId: id, clientSecret: secret }));
    } catch {
      /* sans stockage, la connexion échouera au retour : le message d'erreur l'expliquera */
    }
    window.location.assign(authorizeUrl(id, redirectUri(), nonce));
  }

  return {
    state,
    status,
    connected: isConnected(state),
    connect,
    disconnect: () => {
      setState((prev) => ({ ...EMPTY_STRAVA, seen: prev.seen }));
      setStatus({ kind: "idle" });
    },
    sync: () => void sync(),
    syncAll: () => void sync(true),
    loadDetail,
    forgetHistory: () => setState((prev) => ({ ...prev, seen: [], lastSync: null })),
    reset: () => {
      setState(EMPTY_STRAVA);
      setStatus({ kind: "idle" });
    },
  };
}
