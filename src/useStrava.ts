import { useCallback, useEffect, useRef, useState } from "react";
import type { Plan } from "./lib/plan";
import type { Activity } from "./lib/activities";
import { EMPTY_STRAVA, authorizeUrl, isConnected, mergeStrava, parseCallback, syncAfter, type StravaState } from "./lib/strava";
import { StravaError, exchangeCode, fetchRuns, type FetchLike } from "./lib/stravaClient";
import { useStoredState } from "./storage";

export type StravaStatus =
  | { kind: "idle" }
  | { kind: "syncing" }
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

const randomNonce = () => crypto.getRandomValues(new Uint32Array(4)).join("-");

/**
 * Connexion à Strava et synchronisation des courses, sans serveur.
 * Garmin Connect envoie les sorties vers Strava ; Foulée les y lit à l'ouverture et à la demande.
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
      if (merged.added + merged.matched > 0) {
        setActivities(merged.state.activities);
        setDone(merged.state.done);
      }
      setState((prev) => ({ ...prev, tokens, lastSync: Date.now(), seen: merged.seen }));
      setStatus({
        kind: "ok",
        text:
          merged.added === 0
            ? "Tout est à jour."
            : merged.added === 1
              ? "1 nouvelle course importée."
              : `${merged.added} nouvelles courses importées.`,
      });
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
      void sync();
    }
    const onVisible = () => {
      const last = latest.current.state.lastSync;
      if (document.visibilityState === "visible" && (last === null || Date.now() - last > AUTO_SYNC_MIN_AGE_MS)) void sync();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [plan, confirmed, state.tokens, sync]);

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
    forgetHistory: () => setState((prev) => ({ ...prev, seen: [], lastSync: null })),
    reset: () => {
      setState(EMPTY_STRAVA);
      setStatus({ kind: "idle" });
    },
  };
}
