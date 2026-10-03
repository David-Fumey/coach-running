import { useState } from "react";
import type { StravaApi } from "../useStrava";

/** Date et heure de la dernière synchro, lisibles. */
export function fmtSync(ms: number | null) {
  if (ms === null) return "jamais";
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(ms));
}

/** Connexion à Strava : les sorties de la montre Garmin y arrivent, Foulée les lit de là. */
export default function StravaCard({ strava }: { strava: StravaApi }) {
  const { state, status, connected } = strava;
  const [clientId, setClientId] = useState(state.clientId);
  const [secret, setSecret] = useState(state.clientSecret);
  const [error, setError] = useState("");
  const busy = status.kind === "syncing";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d+$/.test(clientId.trim())) return setError("L'identifiant client est un nombre (visible sur strava.com/settings/api).");
    if (secret.trim().length < 10) return setError("Colle le code secret client de ton application Strava.");
    setError("");
    strava.connect(clientId, secret);
  }

  return (
    <section className="card strava" aria-labelledby="strava-title">
      <h2 id="strava-title" className="card__title">
        Strava et montre Garmin
      </h2>

      {connected ? (
        <>
          <p className="strava__state">
            <span className="strava__dot" aria-hidden="true" /> Connecté à Strava
          </p>
          <p className="hint">
            Dernière synchronisation : {fmtSync(state.lastSync)}. Tes courses sont importées à l'ouverture de l'appli, puis chaque fois que tu y reviens après un quart d'heure.
          </p>
          <div className="actions">
            <button type="button" className="btn btn--primary" disabled={busy} onClick={strava.sync}>
              {busy ? "Synchronisation…" : "Synchroniser maintenant"}
            </button>
          </div>
          <button type="button" className="link" disabled={busy} onClick={strava.syncAll}>
            Importer tout l'historique de mon compte Strava
          </button>
          <button
            type="button"
            className="link link--danger"
            onClick={() => window.confirm("Se déconnecter de Strava ? Les activités déjà importées restent dans Foulée.") && strava.disconnect()}
          >
            Se déconnecter de Strava
          </button>
        </>
      ) : (
        <form className="strava__form" onSubmit={submit} noValidate>
          <p className="hint">
            Ta montre Garmin envoie tes sorties vers Garmin Connect, qui peut les transmettre à Strava. Foulée lit ensuite tes courses sur Strava, sans passer par un serveur.
          </p>
          <ol className="steps">
            <li>
              Dans Garmin Connect : Paramètres, Applications connectées, puis Strava.
            </li>
            <li>
              Sur <strong>strava.com/settings/api</strong>, crée une application et indique <strong>{window.location.hostname}</strong> comme « domaine de rappel d'autorisation ».
            </li>
            <li>Colle ci-dessous l'identifiant et le code secret client de cette application.</li>
          </ol>
          <div className="field">
            <label htmlFor="strava-id">Identifiant client</label>
            <input id="strava-id" type="text" inputMode="numeric" autoComplete="off" value={clientId} onChange={(e) => setClientId(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="strava-secret">Code secret client</label>
            <input id="strava-secret" type="password" autoComplete="off" value={secret} onChange={(e) => setSecret(e.target.value)} />
          </div>
          <p className="hint">Ils restent sur cet appareil et ne sont jamais inclus dans la sauvegarde.</p>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="actions">
            <button type="submit" className="btn btn--primary">
              Se connecter à Strava
            </button>
          </div>
        </form>
      )}

      {status.kind === "syncing" && status.text && (
        <p className="hint" role="status">
          {status.text}
        </p>
      )}
      {status.kind === "ok" && (
        <p className="notice" role="status">
          {status.text}
        </p>
      )}
      {status.kind === "error" && (
        <p className="error" role="alert">
          {status.text}
        </p>
      )}
    </section>
  );
}
