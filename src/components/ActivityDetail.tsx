import { useEffect, useState } from "react";
import { paceOf, type Activity, type Series, type Zones } from "../lib/activities";
import { fmtKm, fmtPace } from "../lib/format";
import { needsDetail, stravaNumericId } from "../lib/strava";
import RouteMap from "./RouteMap";

interface Props {
  activity: Activity;
  /** Lit le détail sur Strava ; retourne un message d'erreur ou null */
  onLoad: (id: string) => Promise<string | null>;
  connected: boolean;
  /** Le droit de lire les zones a été accordé */
  zonesGranted: boolean;
}

/** Un chiffre après la virgule, à la française. */
const fmtDec = (x: number) => (Math.round(x * 10) / 10).toLocaleString("fr-FR");

const WORKOUT_TYPES = { race: "Compétition", long: "Sortie longue", workout: "Séance" } as const;

/** Part du temps passé dans chaque zone, avec les bornes de la zone. */
function ZoneBars({ z }: { z: Zones }) {
  const total = z.buckets.reduce((a, b) => a + b.seconds, 0) || 1;
  const unit = z.type === "heartrate" ? "bpm" : "W";
  return (
    <div className="ad__zones">
      <h3 className="ad__title">{z.type === "heartrate" ? "Zones de fréquence cardiaque" : "Zones de puissance"}</h3>
      <ol className="ad__zonelist">
        {z.buckets.map((b, i) => (
          <li key={i} className={`ad__zone ad__zone--${Math.min(i + 1, 5)}`}>
            <span className="ad__zname">Z{i + 1}</span>
            <span className="ad__zrange">{b.max < 0 ? `≥ ${b.min}` : `${b.min}–${b.max}`} {unit}</span>
            <span className="ad__bar" aria-hidden="true">
              <span style={{ width: `${(b.seconds / total) * 100}%` }} />
            </span>
            <span className="ad__ztime">
              {fmtClock(b.seconds)} · {Math.round((b.seconds / total) * 100)} %
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
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

const W = 320;
const H = 150;
const M = { l: 44, r: 10, t: 8, b: 22 };

/** Pas « rond » pour environ \`count\` graduations. */
function niceStep(span: number, count: number, steps: number[]) {
  const raw = span / count;
  return steps.find((s) => s >= raw) ?? steps[steps.length - 1];
}

const PACE_STEPS = [5, 10, 15, 20, 30, 60, 120];
const HR_STEPS = [2, 5, 10, 20, 25, 50];
const CADENCE_STEPS = [2, 5, 10, 20];
const WATT_STEPS = [10, 20, 50, 100];
const TEMP_STEPS = [1, 2, 5, 10];
const GRADE_STEPS = [1, 2, 5, 10];
const TIME_STEPS = [60, 120, 300, 600, 900, 1800, 3600];

interface CurveProps {
  s: Series;
  values: number[];
  title: string;
  /** Texte d'une valeur (axe et survol) */
  fmt: (v: number) => string;
  steps: number[];
  /** Les petites valeurs (allures) sont en haut */
  fast?: boolean;
  /** Valeurs négatives possibles (pente) : 0 est alors une vraie valeur */
  signed?: boolean;
  alt?: number[];
  hover: number | null;
  setHover: (i: number | null) => void;
}

/** Courbe d'une série : axes gradués, curseur au survol ou au toucher. Les 0 (valeur inconnue) coupent la ligne. */
function Curve({ s, values, title, fmt, steps, fast, signed, alt, hover, setHover }: CurveProps) {
  const ok = (v: number) => signed || v > 0;
  const known = values.filter(ok).sort((x, y) => x - y);
  if (known.length < 2) return null;
  // On ignore les 5 % de valeurs extrêmes pour que l'échelle reste lisible.
  const p5 = known[Math.floor(known.length * 0.05)];
  const p95 = known[Math.ceil(known.length * 0.95) - 1];
  const step = niceStep(Math.max(p95 - p5, 1), 4, steps);
  const lo = Math.floor(p5 / step) * step;
  const hi = Math.max(Math.ceil(p95 / step) * step, lo + step);
  const total = s.t[s.t.length - 1] || 1;
  const pw = W - M.l - M.r;
  const ph = H - M.t - M.b;
  const x = (t: number) => M.l + (t / total) * pw;
  const y = (v: number) => {
    const r = Math.min(1, Math.max(0, (v - lo) / (hi - lo)));
    return M.t + (fast ? r : 1 - r) * ph;
  };
  const yTicks: number[] = [];
  for (let v = lo; v <= hi + 1e-9; v += step) yTicks.push(v);
  const tStep = niceStep(total, 5, TIME_STEPS);
  const xTicks: number[] = [];
  for (let t = 0; t <= total; t += tStep) xTicks.push(t);

  // Lissage léger (moyenne de trois points voisins connus) : le bruit du GPS rend l'allure en dents de scie.
  const smooth = values.map((v, i) => {
    if (!ok(v)) return 0;
    const near = [values[i - 1], v, values[i + 1]].filter((q) => q !== undefined && ok(q));
    return near.reduce((acc, q) => acc + q, 0) / near.length;
  });
  let d = "";
  let pen = false;
  smooth.forEach((v, i) => {
    if (!signed && v <= 0) {
      pen = false;
      return;
    }
    d += `${pen ? "L" : "M"}${x(s.t[i]).toFixed(1)} ${y(v).toFixed(1)}`;
    pen = true;
  });
  let area = "";
  if (alt && alt.length === s.t.length) {
    const mn = Math.min(...alt);
    const mx = Math.max(...alt);
    if (mx - mn >= 3) {
      const pts = alt.map((v, i) => `${x(s.t[i]).toFixed(1)} ${(M.t + ph - ((v - mn) / (mx - mn)) * ph * 0.4).toFixed(1)}`);
      area = `M${x(s.t[0]).toFixed(1)} ${M.t + ph} L${pts.join(" L")} L${x(total)} ${M.t + ph} Z`;
    }
  }

  function move(e: React.PointerEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    const t = ((px - M.l) / pw) * total;
    if (t < 0 || t > total) return setHover(null);
    let best = 0;
    s.t.forEach((v, i) => {
      if (Math.abs(v - t) < Math.abs(s.t[best] - t)) best = i;
    });
    setHover(best);
  }

  const hv = hover !== null && hover < values.length ? values[hover] : 0;
  return (
    <figure className="ad__chart">
      <figcaption>
        {title}
        <span className="ad__read">{hover !== null ? `${fmtClock(s.t[hover])} · ${ok(hv) ? fmt(hv) : "—"}` : "Survole ou touche la courbe"}</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title} au fil de la sortie`} onPointerMove={move} onPointerDown={move} onPointerLeave={() => setHover(null)}>
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} className="ad__grid" />
            <text x={M.l - 5} y={y(v) + 3} textAnchor="end" className="ad__tick">
              {fmt(v)}
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={M.t} y2={M.t + ph} className="ad__grid ad__grid--v" />
            <text x={x(t)} y={H - 6} textAnchor="middle" className="ad__tick">
              {t === 0 ? "0" : `${Math.round(t / 60)} min`}
            </text>
          </g>
        ))}
        {area && <path d={area} className="ad__alt" />}
        <path d={d} className="ad__line" fill="none" />
        {hover !== null && (
          <g>
            <line x1={x(s.t[hover])} x2={x(s.t[hover])} y1={M.t} y2={M.t + ph} className="ad__cursor" />
            {ok(hv) && <circle cx={x(s.t[hover])} cy={y(hv)} r="3.5" className="ad__dot" />}
          </g>
        )}
      </svg>
    </figure>
  );
}

export default function ActivityDetail({ activity: a, onLoad, connected, zonesGranted }: Props) {
  const imported = stravaNumericId(a) !== null;
  /** Indice du point survolé, commun aux deux graphiques */
  const [hover, setHover] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Détail pas encore lu : on le demande une fois, à l'ouverture.
  useEffect(() => {
    if (!imported || !connected || !needsDetail(a, zonesGranted)) return;
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
    ...(d?.maxSpeedKmh ? ([["Vitesse moyenne / max", `${fmtDec(a.km / (a.minutes / 60))} / ${fmtDec(d.maxSpeedKmh)} km/h`]] as [string, string][]) : []),
    ...(d?.elevHigh !== undefined && d.elevLow !== undefined ? ([["Altitude basse / haute", `${d.elevLow} / ${d.elevHigh} m`]] as [string, string][]) : []),
    ...(d?.watts?.avg ? ([["Puissance moyenne", `${d.watts.avg} W`]] as [string, string][]) : []),
    ...(d?.watts?.weighted ? ([["Puissance pondérée", `${d.watts.weighted} W`]] as [string, string][]) : []),
    ...(d?.watts?.max ? ([["Puissance maximale", `${d.watts.max} W`]] as [string, string][]) : []),
    ...(d?.series?.stopped ? ([["Temps à l'arrêt", fmtClock(d.series.stopped)]] as [string, string][]) : []),
    ...(d?.gear ? ([["Chaussures", d.gear.name]] as [string, string][]) : []),
    ...(a.efforts && a.efforts["5k"] ? ([["Meilleur 5 km", fmtClock(a.efforts["5k"] * 60)]] as [string, string][]) : []),
    ...(a.efforts && a.efforts["10k"] ? ([["Meilleur 10 km", fmtClock(a.efforts["10k"] * 60)]] as [string, string][]) : []),
  ];

  const series = d?.series;
  const splits = d?.splits ?? [];
  const paces = splits.map((s) => s.seconds / 60 / s.km);
  const fastest = Math.min(...paces);
  const slowest = Math.max(...paces);
  const spread = slowest - fastest;

  const route = series?.route ?? d?.route;

  return (
    <div className="ad">
      {(d?.workoutType || d?.description) && (
        <div className="ad__about">
          {d.workoutType && <span className={`ad__badge ad__badge--${d.workoutType}`}>{WORKOUT_TYPES[d.workoutType]}</span>}
          {d.description && <p className="ad__desc">{d.description}</p>}
        </div>
      )}
      <dl className="ad__stats">
        {stats.map(([label, value]) => (
          <div key={label} className="ad__stat">
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      {series && series.t.length > 1 && (
        <>
          {series.pace && <Curve s={series} values={series.pace} fast steps={PACE_STEPS} fmt={(v) => fmtPace(v / 60)} title="Allure (min/km)" alt={series.alt} hover={hover} setHover={setHover} />}
          {series.hr && <Curve s={series} values={series.hr} steps={HR_STEPS} fmt={(v) => `${Math.round(v)}`} title="Fréquence cardiaque (bpm)" hover={hover} setHover={setHover} />}
          {series.cadence && <Curve s={series} values={series.cadence} steps={CADENCE_STEPS} fmt={(v) => `${Math.round(v)}`} title="Cadence (pas/min)" hover={hover} setHover={setHover} />}
          {series.watts && <Curve s={series} values={series.watts} steps={WATT_STEPS} fmt={(v) => `${Math.round(v)} W`} title="Puissance (W)" hover={hover} setHover={setHover} />}
          {series.temp && <Curve s={series} values={series.temp} signed steps={TEMP_STEPS} fmt={(v) => `${Math.round(v)} °C`} title="Température (°C)" hover={hover} setHover={setHover} />}
          {series.grade && <Curve s={series} values={series.grade} signed steps={GRADE_STEPS} fmt={(v) => `${v > 0 ? "+" : ""}${Math.round(v * 10) / 10} %`} title="Pente (%)" hover={hover} setHover={setHover} />}
        </>
      )}

      {route && route.length >= 2 && (
        <figure className="ad__chart ad__map">
          <figcaption>
            Tracé
            <span className="ad__read">{series?.route && hover !== null ? fmtClock(series.t[hover]) : "Départ en vert, arrivée en rouge"}</span>
          </figcaption>
          <RouteMap points={route} mark={series?.route && hover !== null ? series.route[hover] : null} label="Tracé de la sortie" />
        </figure>
      )}

      {d?.zones && d.zones.map((z) => <ZoneBars key={z.type} z={z} />)}

      {d?.segments && d.segments.length > 0 && (
        <div className="ad__segments">
          <h3 className="ad__title">Segments Strava</h3>
          <ul className="ad__seglist">
            {d.segments.map((g, i) => (
              <li key={i}>
                <span className="ad__segname">{g.name}</span>
                <span className="ad__segmeta">
                  {g.meters >= 1000 ? `${fmtKm(Math.round(g.meters / 10) / 100)} km` : `${g.meters} m`} · {fmtClock(g.seconds)}
                  {g.prRank ? <span className={`ad__pr ad__pr--${g.prRank}`}>{g.prRank === 1 ? "Record perso" : `${g.prRank}e meilleur temps`}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

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
