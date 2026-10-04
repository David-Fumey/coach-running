import { useState } from "react";
import { diffDays } from "../lib/plan";
import type { HistoryPoint } from "../lib/records";
import { fmtClock, fmtDate, fmtKm, fmtPace } from "../lib/format";

const W = 320;
const H = 150;
const PAD = { l: 44, r: 12, t: 12, b: 24 };

const day = (iso: string) => fmtDate(iso, { day: "numeric", month: "short", year: "numeric" });

/**
 * Évolution des temps sur une distance : un point par sortie (plein quand elle bat le record), une courbe en escalier
 * pour le record. Plus un temps est haut sur le graphique, plus il est rapide.
 */
export default function RecordChart({ points, label, km }: { points: HistoryPoint[]; label: string; km: number }) {
  const [sel, setSel] = useState<number>(() => points.length - 1);
  if (points.length < 2) return null;

  const t0 = points[0].date;
  const span = Math.max(1, diffDays(t0, points[points.length - 1].date));
  const min = Math.min(...points.map((p) => p.minutes));
  const max = Math.max(...points.map((p) => p.minutes));
  const pad = Math.max((max - min) * 0.12, 0.05);
  const lo = min - pad;
  const hi = max + pad;
  const x = (date: string) => PAD.l + (diffDays(t0, date) / span) * (W - PAD.l - PAD.r);
  const y = (m: number) => PAD.t + ((m - lo) / (hi - lo)) * (H - PAD.t - PAD.b);

  // Escalier du record : horizontal jusqu'à la date du record suivant, puis marche vers le haut.
  const records = points.filter((p) => p.record);
  let d = `M ${x(records[0].date)} ${y(records[0].minutes)}`;
  for (let i = 1; i < records.length; i++) d += ` H ${x(records[i].date)} V ${y(records[i].minutes)}`;
  d += ` H ${x(points[points.length - 1].date)}`;

  const ticks = [min, (min + max) / 2, max];
  const p = points[sel] ?? points[points.length - 1];

  return (
    <figure className="rchart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Évolution des temps sur ${label}, de ${fmtClock(max)} à ${fmtClock(min)}`}>
        {ticks.map((t) => (
          <g key={t} className="rchart__grid">
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} />
            <text x={PAD.l - 6} y={y(t) + 3} textAnchor="end">
              {fmtClock(t)}
            </text>
          </g>
        ))}
        <text className="rchart__x" x={PAD.l} y={H - 6} textAnchor="start">
          {fmtDate(points[0].date, { month: "short", year: "numeric" })}
        </text>
        <text className="rchart__x" x={W - PAD.r} y={H - 6} textAnchor="end">
          {fmtDate(points[points.length - 1].date, { month: "short", year: "numeric" })}
        </text>
        <path className="rchart__line" d={d} />
        {points.map((pt, i) => (
          <g key={pt.activityId} className={`rchart__pt${pt.record ? " rchart__pt--record" : ""}${i === sel ? " rchart__pt--sel" : ""}`}>
            <circle cx={x(pt.date)} cy={y(pt.minutes)} r={pt.record ? 4 : 3} />
            <circle className="rchart__hit" cx={x(pt.date)} cy={y(pt.minutes)} r={11} tabIndex={0} role="button"
              aria-label={`${day(pt.date)} : ${fmtClock(pt.minutes)}${pt.record ? ", record" : ""}`}
              onClick={() => setSel(i)} onFocus={() => setSel(i)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSel(i); } }} />
          </g>
        ))}
      </svg>
      <figcaption className="rchart__caption" aria-live="polite">
        <strong>{fmtClock(p.minutes)}</strong> · {day(p.date)} · {fmtPace(p.minutes / km)} /km
        {p.record ? " · record battu" : ""}
        {!p.exact && p.km !== km ? ` · ramené depuis ${fmtKm(Math.round(p.km * 10) / 10)} km` : ""}
      </figcaption>
    </figure>
  );
}
