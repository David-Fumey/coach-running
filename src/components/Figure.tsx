import { VIEW, layout, type Pose } from "../lib/figures";

/** Bonhomme en traits dessiné d'après une posture. Décoratif : la légende est donnée par le parent. */
export default function Figure({ pose }: { pose: Pose }) {
  const l = layout(pose);
  return (
    <svg className="fig" viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} aria-hidden="true" focusable="false">
      <line className="fig__floor" x1="6" x2={VIEW.w - 6} y1={l.floor} y2={l.floor} />
      {l.wallX !== undefined && <line className="fig__wall" x1={l.wallX} x2={l.wallX} y1="8" y2={l.floor} />}
      {l.box && <rect className="fig__box" x={l.box.x} y={l.box.y} width={l.box.w} height={l.box.h} rx="2" />}
      {l.segs.map((s, i) => (
        <line key={i} className={`fig__seg fig__seg--${s.kind}`} x1={s.a.x} y1={s.a.y} x2={s.b.x} y2={s.b.y} />
      ))}
      <circle className="fig__head" cx={l.head.x} cy={l.head.y} r={l.head.r} />
    </svg>
  );
}
