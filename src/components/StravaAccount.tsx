import { useEffect, useRef, useState } from "react";
import { fmtKm } from "../lib/format";
import { SHOE_WEAR_KM, lacksScopes, type RunTotals } from "../lib/strava";
import type { StravaApi } from "../useStrava";
import RouteMap from "./RouteMap";

const REFRESH_AFTER_MS = 24 * 3600 * 1000;

function hours(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h} h ${String(m).padStart(2, "0")}` : `${m} min`;
}

function Totals({ title, t }: { title: string; t?: RunTotals }) {
  if (!t) return null;
  return (
    <div className="saccount__total">
      <dt>{title}</dt>
      <dd className="saccount__km">{fmtKm(t.km)} km</dd>
      <dd className="saccount__sub-stat">
        {t.count} sortie{t.count > 1 ? "s" : ""} · {hours(t.seconds)} · {t.elevation} m D+
      </dd>
    </div>
  );
}

/** Données du compte Strava : totaux de course, chaussures, itinéraires, clubs. Lues à la demande, une fois par jour au plus à l'ouverture. */
export default function StravaAccount({ strava }: { strava: StravaApi }) {
  const { state } = strava;
  const account = state.account;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const asked = useRef(false);

  async function load() {
    setBusy(true);
    setError("");
    const msg = await strava.loadAccount();
    setBusy(false);
    if (msg) setError(msg);
  }

  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    if (!account || Date.now() - account.loadedAt > REFRESH_AFTER_MS) void load();
  }, []);

  const missing = lacksScopes(state);

  return (
    <div className="saccount">
      <h3 className="saccount__title">Mon compte Strava</h3>

      {missing && (
        <div className="notice">
          <p>
            Cette connexion ne donne pas accès à tout : zones de fréquence cardiaque, chaussures et itinéraires demandent des droits en plus. Reconnecte-toi pour les accorder (ça ne refait pas l'import).
          </p>
          <div className="actions">
            <button type="button" className="btn" onClick={strava.reconnect}>
              Accorder les droits manquants
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {busy && !account && <p className="hint">Lecture du compte Strava…</p>}

      {account && (
        <>
          {account.totals && (
            <>
              <h4 className="saccount__sub">Totaux de course</h4>
              <dl className="saccount__totals">
                <Totals title="4 dernières semaines" t={account.totals.recent} />
                <Totals title="Cette année" t={account.totals.year} />
                <Totals title="Depuis toujours" t={account.totals.all} />
              </dl>
            </>
          )}

          {account.shoes && account.shoes.length > 0 && (
            <>
              <h4 className="saccount__sub">Chaussures</h4>
              <ul className="saccount__list">
                {account.shoes.map((g) => (
                  <li key={g.id}>
                    <span className="saccount__name">{g.name}</span>
                    <span className="ad__bar" aria-hidden="true">
                      <span className={g.km >= SHOE_WEAR_KM ? "saccount__worn" : ""} style={{ width: `${Math.min(100, (g.km / SHOE_WEAR_KM) * 100)}%` }} />
                    </span>
                    <span className="saccount__meta">
                      {g.km} km{g.km >= SHOE_WEAR_KM ? " · à remplacer bientôt" : ""}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="hint">Repère courant : une paire s'use entre 600 et 800 km. C'est un ordre de grandeur, pas une règle : le poids, la foulée et le terrain comptent.</p>
            </>
          )}

          {account.routes && account.routes.length > 0 && (
            <>
              <h4 className="saccount__sub">Itinéraires de course</h4>
              <ul className="saccount__routes">
                {account.routes.map((r) => (
                  <li key={r.id}>
                    {r.route && <RouteMap points={r.route} ends={false} label={`Tracé de ${r.name}`} height={110} />}
                    <span className="saccount__name">{r.name}</span>
                    <span className="saccount__meta">
                      {fmtKm(r.km)} km{r.elevation !== undefined ? ` · ${r.elevation} m D+` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {account.clubs && account.clubs.length > 0 && (
            <>
              <h4 className="saccount__sub">Clubs</h4>
              <ul className="saccount__list saccount__list--plain">
                {account.clubs.map((c) => (
                  <li key={c.id}>
                    <span className="saccount__name">{c.name}</span>
                    <span className="saccount__meta">{[c.city, c.members ? `${c.members} membres` : ""].filter(Boolean).join(" · ")}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className="actions">
            <button type="button" className="btn" disabled={busy} onClick={() => void load()}>
              {busy ? "Lecture…" : "Actualiser le compte"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
