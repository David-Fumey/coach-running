interface Props {
  /** Tracé : [latitude, longitude] */
  points: [number, number][];
  /** Position à marquer (curseur des courbes) */
  mark?: [number, number] | null;
  /** Départ et arrivée en pastilles */
  ends?: boolean;
  label: string;
  /** Hauteur du dessin pour une largeur de 320 */
  height?: number;
}

const W = 320;
const PAD = 14;

/**
 * Tracé d'une sortie ou d'un itinéraire, dessiné sans fond de carte : aucune requête vers un service tiers, et le
 * tracé reste visible hors ligne. Nord en haut ; la longitude est resserrée selon la latitude.
 */
export default function RouteMap({ points, mark, ends = true, label, height = 200 }: Props) {
  if (points.length < 2) return null;
  const lats = points.map((p) => p[0]);
  const lngs = points.map((p) => p[1]);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const k = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const spanX = Math.max((maxLng - minLng) * k, 1e-5);
  const spanY = Math.max(maxLat - minLat, 1e-5);
  const scale = Math.min((W - 2 * PAD) / spanX, (height - 2 * PAD) / spanY);
  const offX = (W - spanX * scale) / 2;
  const offY = (height - spanY * scale) / 2;
  const at = (p: [number, number]) => ({ x: offX + (p[1] - minLng) * k * scale, y: offY + (maxLat - p[0]) * scale });
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${at(p).x.toFixed(1)} ${at(p).y.toFixed(1)}`).join("");
  const start = at(points[0]);
  const end = at(points[points.length - 1]);
  const m = mark ? at(mark) : null;
  return (
    <svg className="route" viewBox={`0 0 ${W} ${height}`} role="img" aria-label={label}>
      <path d={d} className="route__line" fill="none" />
      {ends && (
        <>
          <circle cx={start.x} cy={start.y} r="5" className="route__start" />
          <circle cx={end.x} cy={end.y} r="5" className="route__end" />
        </>
      )}
      {m && <circle cx={m.x} cy={m.y} r="5" className="route__mark" />}
    </svg>
  );
}
