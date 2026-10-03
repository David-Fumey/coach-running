import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { niceTicks, type Bucket, type Grain } from "../lib/progress";
import { fmtDate, fmtKm, fmtPace } from "../lib/format";

// Graphiques en SVG tracé à la taille réelle du conteneur : les textes gardent leur taille quel que soit l'écran.

const H = 210;
const ML = 40;
const MR = 8;
const MT = 14;
const MB = 28;
const MIN_LABEL_SPACE = 46;

/** Largeur du conteneur, suivie quand la fenêtre change. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(320);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth || 320);
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width) || 320));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

// ---------- Libellés ----------

/** Étiquette courte sous l'axe. */
export function tickLabel(b: Bucket, grain: Grain, index: number): string {
  if (grain === "annee") return b.start.slice(0, 4);
  if (grain === "semaine") return fmtDate(b.start, { day: "numeric", month: "short" });
  const month = fmtDate(b.start, { month: "short" });
  return index === 0 || b.start.slice(5, 7) === "01" ? `${month} ${b.start.slice(2, 4)}` : month;
}

/** Libellé complet d'une période. */
export function periodLabel(b: Bucket, grain: Grain): string {
  if (grain === "annee") return b.start.slice(0, 4);
  if (grain === "mois") return fmtDate(b.start, { month: "long", year: "numeric" });
  return `Semaine du ${fmtDate(b.start, { day: "numeric", month: "short" })} au ${fmtDate(b.end, { day: "numeric", month: "short", year: "numeric" })}`;
}

const round1 = (x: number) => Math.round(x * 10) / 10;
const sorties = (n: number) => (n === 0 ? "aucune sortie" : n === 1 ? "1 sortie" : `${n} sorties`);
const describe = (b: Bucket, grain: Grain) => `${periodLabel(b, grain)} : ${fmtKm(round1(b.km))} km, ${sorties(b.count)}`;

/** Une étiquette sur `every`, en partant de la dernière période pour qu'elle reste toujours lisible. */
const labelEvery = (slot: number) => Math.max(1, Math.ceil(MIN_LABEL_SPACE / slot));

// ---------- Éléments communs ----------

interface ChartProps {
  buckets: Bucket[];
  grain: Grain;
  selected: number;
  onSelect: (index: number) => void;
}

/** Zone cliquable et accessible au clavier pour une période. */
function Slot({ x, width, label, pressed, onSelect }: { x: number; width: number; label: string; pressed: boolean; onSelect: () => void }) {
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect();
    }
  };
  return (
    <g className="chart__slot" role="button" tabIndex={0} aria-pressed={pressed} aria-label={label} onClick={onSelect} onKeyDown={onKey}>
      <rect className="slot" x={x} y={MT - 4} width={width} height={H - MT - MB + 8} rx={6} />
    </g>
  );
}

function XAxis({ buckets, grain, slot, width }: { buckets: Bucket[]; grain: Grain; slot: number; width: number }) {
  const every = labelEvery(slot);
  return (
    <g className="axis axis--x" aria-hidden="true">
      <line className="axis__base" x1={ML} x2={width - MR} y1={H - MB} y2={H - MB} />
      {buckets.map((b, i) =>
        (buckets.length - 1 - i) % every === 0 ? (
          <text key={b.start} x={ML + slot * (i + 0.5)} y={H - MB + 17} textAnchor="middle" className={b.current ? "axis__now" : undefined}>
            {tickLabel(b, grain, i)}
          </text>
        ) : null
      )}
    </g>
  );
}

/** Colonne aux coins supérieurs arrondis. */
function barPath(x: number, top: number, w: number, bottom: number): string {
  const h = Math.max(0, bottom - top);
  const r = Math.min(5, w / 2, h);
  return `M${x} ${bottom}V${top + r}Q${x} ${top} ${x + r} ${top}H${x + w - r}Q${x + w} ${top} ${x + w} ${top + r}V${bottom}Z`;
}

// ---------- Distance ----------

export function VolumeChart({ buckets, grain, selected, onSelect }: ChartProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const pw = Math.max(60, width - ML - MR);
  const ph = H - MT - MB;
  const max = Math.max(1, ...buckets.map((b) => Math.max(b.km, b.plannedKm ?? 0)));
  const { ticks, top } = niceTicks(max);
  const slot = pw / buckets.length;
  const bw = Math.min(20, Math.max(3, slot * 0.56));
  const y = (km: number) => MT + ph - (km / top) * ph;

  // La période en cours est incomplète : elle ne compte pas dans la moyenne (sauf si elle est la seule).
  const complete = buckets.filter((b) => !b.future && !b.current);
  const past = complete.length > 0 ? complete : buckets.filter((b) => !b.future);
  const avg = past.length > 0 ? past.reduce((s, b) => s + b.km, 0) / past.length : 0;

  return (
    <div ref={ref} className="chart">
      <svg width={width} height={H} role="group" aria-label="Kilomètres par période">
        <defs>
          <linearGradient id="g-vol" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: "var(--done)", stopOpacity: 1 }} />
            <stop offset="1" style={{ stopColor: "var(--done)", stopOpacity: 0.45 }} />
          </linearGradient>
          <linearGradient id="g-now" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: "var(--accent)", stopOpacity: 1 }} />
            <stop offset="1" style={{ stopColor: "var(--accent)", stopOpacity: 0.5 }} />
          </linearGradient>
        </defs>

        <g className="axis axis--y" aria-hidden="true">
          {ticks.map((t) => (
            <g key={t}>
              <line className="grid" x1={ML} x2={width - MR} y1={y(t)} y2={y(t)} />
              <text x={ML - 8} y={y(t) + 4} textAnchor="end">
                {fmtKm(t)}
              </text>
            </g>
          ))}
        </g>

        <g key={`${grain}-${buckets[0]?.start}-${buckets.length}`} className="bars">
          {buckets.map((b, i) => {
            const x = ML + slot * i + (slot - bw) / 2;
            return (
              <g key={b.start} className={i === selected ? "bar-group bar-group--sel" : "bar-group"}>
                {i === selected && <rect className="slot-sel" x={ML + slot * i} y={MT - 4} width={slot} height={ph + 8} rx={6} />}
                {b.plannedKm !== null && b.plannedKm > 0 && <path className="bar-plan" d={barPath(x, y(b.plannedKm), bw, y(0))} />}
                {b.km > 0 && <path className={b.current ? "bar-actual bar-actual--now" : "bar-actual"} d={barPath(x, y(b.km), bw, y(0))} style={{ animationDelay: `${Math.min(i, 30) * 12}ms` }} />}
              </g>
            );
          })}
        </g>

        {avg > 0 && (
          <g aria-hidden="true">
            <line className="avg" x1={ML} x2={width - MR} y1={y(avg)} y2={y(avg)} />
          </g>
        )}

        <XAxis buckets={buckets} grain={grain} slot={slot} width={width} />

        {buckets.map((b, i) => (
          <Slot key={b.start} x={ML + slot * i} width={slot} label={describe(b, grain)} pressed={i === selected} onSelect={() => onSelect(i)} />
        ))}
      </svg>
      <p className="legend">
        <span className="legend__item">
          <i className="legend__swatch legend__swatch--actual" /> Couru
        </span>
        {buckets.some((b) => b.plannedKm !== null) && (
          <span className="legend__item">
            <i className="legend__swatch legend__swatch--plan" /> Prévu
          </span>
        )}
        {avg > 0 && (
          <span className="legend__item">
            <i className="legend__swatch legend__swatch--avg" /> Moyenne {fmtKm(round1(avg))} km
          </span>
        )}
      </p>
    </div>
  );
}

// ---------- Allure ----------

export function PaceChart({ buckets, grain, selected, onSelect }: ChartProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const pw = Math.max(60, width - ML - MR);
  const ph = H - MT - MB;
  const slot = pw / buckets.length;
  const paces = buckets.map((b) => b.pace);
  const known = paces.filter((p): p is number => p !== null);

  if (known.length < 2) {
    return (
      <div ref={ref} className="chart">
        <p className="hint">Il faut des sorties sur au moins deux périodes pour tracer une courbe d'allure.</p>
      </div>
    );
  }

  const lo = Math.min(...known);
  const hi = Math.max(...known);
  const span = hi - lo;
  const step = span <= 1.2 ? 0.25 : span <= 3 ? 0.5 : 1;
  const yMin = Math.floor(lo / step) * step;
  const yMax = Math.max(Math.ceil(hi / step) * step, yMin + step);
  const ticks: number[] = [];
  for (let v = yMin; v <= yMax + 1e-9; v += step) ticks.push(v);
  // Plus rapide (allure basse) en haut.
  const y = (p: number) => MT + ((p - yMin) / (yMax - yMin)) * ph;
  const x = (i: number) => ML + slot * (i + 0.5);

  // Segments continus : une période sans sortie interrompt la courbe.
  const segments: number[][] = [];
  paces.forEach((p, i) => {
    if (p === null) return;
    const last = segments[segments.length - 1];
    if (last && last[last.length - 1] === i - 1) last.push(i);
    else segments.push([i]);
  });
  const curve = (idx: number[]) =>
    idx
      .map((i, k) => {
        if (k === 0) return `M${x(i).toFixed(1)} ${y(paces[i]!).toFixed(1)}`;
        const p = idx[k - 1];
        const mx = (x(p) + x(i)) / 2;
        return `C${mx.toFixed(1)} ${y(paces[p]!).toFixed(1)} ${mx.toFixed(1)} ${y(paces[i]!).toFixed(1)} ${x(i).toFixed(1)} ${y(paces[i]!).toFixed(1)}`;
      })
      .join("");
  const area = (idx: number[]) => `${curve(idx)}L${x(idx[idx.length - 1]).toFixed(1)} ${H - MB}L${x(idx[0]).toFixed(1)} ${H - MB}Z`;
  const sel = paces[selected];

  return (
    <div ref={ref} className="chart">
      <svg width={width} height={H} role="group" aria-label="Allure moyenne par période">
        <defs>
          <linearGradient id="g-pace" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: "var(--p-construction)", stopOpacity: 0.28 }} />
            <stop offset="1" style={{ stopColor: "var(--p-construction)", stopOpacity: 0 }} />
          </linearGradient>
        </defs>

        <g className="axis axis--y" aria-hidden="true">
          {ticks.map((t) => (
            <g key={t}>
              <line className="grid" x1={ML} x2={width - MR} y1={y(t)} y2={y(t)} />
              <text x={ML - 8} y={y(t) + 4} textAnchor="end">
                {fmtPace(t)}
              </text>
            </g>
          ))}
        </g>

        {sel !== null && sel !== undefined && <line className="guide" x1={x(selected)} x2={x(selected)} y1={MT - 4} y2={H - MB} />}

        <g key={`${grain}-${buckets[0]?.start}-${buckets.length}`} className="pace">
          {segments.filter((s) => s.length > 1).map((s) => (
            <path key={`a${s[0]}`} className="pace-area" d={area(s)} />
          ))}
          {segments.filter((s) => s.length > 1).map((s) => (
            <path key={`l${s[0]}`} className="pace-line" d={curve(s)} />
          ))}
          {buckets.map((b, i) =>
            b.pace === null ? null : <circle key={b.start} className={i === selected ? "pace-dot pace-dot--sel" : "pace-dot"} cx={x(i)} cy={y(b.pace)} r={i === selected ? 5.5 : 3.5} />
          )}
        </g>

        <XAxis buckets={buckets} grain={grain} slot={slot} width={width} />

        {buckets.map((b, i) => (
          <Slot
            key={b.start}
            x={ML + slot * i}
            width={slot}
            label={b.pace === null ? `${periodLabel(b, grain)} : aucune sortie` : `${periodLabel(b, grain)} : ${fmtPace(b.pace)} par km`}
            pressed={i === selected}
            onSelect={() => onSelect(i)}
          />
        ))}
      </svg>
      <p className="legend">
        <span className="legend__item">Plus haut = plus rapide</span>
        <span className="legend__item">Meilleure : {fmtPace(lo)} /km</span>
      </p>
    </div>
  );
}
