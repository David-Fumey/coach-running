import { useEffect, useState } from "react";
import { paceOf, type Activity } from "../lib/activities";
import { fmtKm, fmtPace } from "../lib/format";
import { stravaNumericId } from "../lib/strava";

interface Props {
  activity: Activity;
  /** Lit le détail sur Strava ; retourne un message d'erreur ou null */
  onLoad: (id: string) => Promise<string | null>;
  connected: boolean;
}

/** Durée précise : « 1:05:30 » ou « 42:10 ». */
function fmtClock(seconds: number) {
  const t = Math.round(seconds);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${m}:${p(s)}`;
}

export default function ActivityDetail({ activity: a, onLoad, connected }: Props) {
  const imported = stravaNumericId(a) !== null;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Détail pas encore lu : on le demande une fois, à l'ouverture.
  useEffect(() => {
    if (!imported || !connected || a.detail !== undefined) return;
    let alive = true;
    setLoading(true);
    setError("");
    onLoad(a.id).then((msg) => {
      if (!alive) return;
      setLoading(false);
      if (msg) setError(msg);
    });
    return () => {
      alive = false;
    };
    // Une seule lecture par ouverture.
  }, [a.id]);

  const d = a.detail;
  const stats: [string, string][] = [
    ["Distance", `${fmtKm(a.km)} km`],
    ["Temps en mouvement", fmtClock(a.minutes * 60)],
    ...(d?.elapsedMinutes !== undefined && d.elapsedMinutes > a.minutes + 0.2 ? ([["Temps total", fmtClock(d.elapsedMinutes * 60)]] as [string, string][]) : []),
    ["Allure moyenne", `${fmtPace(paceOf(a))} /km`],
    ...(a.avgHr ? ([["FC moyenne", `${a.avgHr} bpm`]] as [string, string][]) : []),
    ...(a.maxHr ? ([["FC maximale", `${a.maxHr} bpm`]] as [string, string][]) : []),
    ...(a.elevation !== undefined ? ([["Dénivelé positif", `${a.elevation} m`]] as [string, string][]) : []),
    ...(d?.cadence ? ([["Cadence", `${d.cadence} pas/min`]] as [string, string][]) : []),
    ...(d?.calories ? ([["Calories", `${d.calories} kcal`]] as [string, string][]) : []),
    ...(typeof a.temp === "number" ? ([["Température", `${Math.round(a.temp)} °C`]] as [string, string][]) : []),
    ...(a.efforts && a.efforts["5k"] ? ([["Meilleur 5 km", fmtClock(a.efforts["5k"] * 60)]] as [string, string][]) : []),
    ...(a.efforts && a.efforts["10k"] ? ([["Meilleur 10 km", fmtClock(a.efforts["10k"] * 60)]] as [string, string][]) : []),
  ];

  const splits = d?.splits ?? [];
  const paces = splits.map((s) => s.seconds / 60 / s.km);
  const fastest = Math.min(...paces);
  const slowest = Math.max(...paces);
  const spread = slowest - fastest;

  return (
    <div className="ad">
      <dl className="ad__stats">
        {stats.map(([label, value]) => (
          <div key={label} className="ad__stat">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      {splits.length > 0 && (
        <>
          <h3 className="ad__title">Temps par kilomètre</h3>
          <ol className="ad__splits">
            {splits.map((s, i) => {
              const p = paces[i];
              // Plus c'est rapide, plus la barre est longue (de 40 à 100 % de la largeur).
              const width = spread < 0.05 ? 100 : 40 + (60 * (slowest - p)) / spread;
              return (
                <li key={i} className={`ad__split${p === fastest && splits.length > 1 ? " ad__split--best" : ""}`}>
                  <span className="ad__km">{s.km < 0.95 ? `${fmtKm(Math.round(s.km * 100) / 100)} km` : i + 1}</span>
                  <span className="ad__bar" aria-hidden="true">
                    <span style={{ width: `${width}%` }} />
                  </span>
                  <span className="ad__pace">{fmtPace(p)}</span>
                  <span className="ad__hr">{s.hr ? `${s.hr} bpm` : ""}</span>
                  <span className="ad__elev">{s.elev !== undefined ? `${s.elev > 0 ? "+" : ""}${s.elev} m` : ""}</span>
                </li>
              );
            })}
          </ol>
        </>
      )}

      {loading && <p className="hint" role="status">Lecture du détail sur Strava…</p>}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!loading && !error && imported && d !== undefined && splits.length === 0 && <p className="hint">Strava n'a pas relevé de temps par kilomètre pour cette sortie.</p>}
      {!imported && <p className="hint">Sortie saisie à la main : seul le résumé est disponible. Les sorties importées de Strava ont un détail kilomètre par kilomètre.</p>}
      {imported && !connected && d === undefined && <p className="hint">Connecte Strava (page Profil) pour lire le détail de cette sortie.</p>}
      {d?.device && <p className="hint">Enregistrée avec : {d.device}</p>}
    </div>
  );
}
