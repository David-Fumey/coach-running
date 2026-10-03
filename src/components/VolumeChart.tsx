import type { Phase, Week } from "../lib/plan";

interface Props {
  weeks: Week[];
  currentIndex: number;
  doneIds: Record<string, boolean>;
}

const PHASE_CLASS: Record<Phase, string> = {
  base: "bar--base",
  construction: "bar--construction",
  specifique: "bar--specifique",
  affutage: "bar--affutage",
  course: "bar--course",
};

/** Profil des kilomètres par semaine : la forme du plan en un coup d'œil. */
export default function VolumeChart({ weeks, currentIndex, doneIds }: Props) {
  const max = Math.max(1, ...weeks.map((w) => w.totalKm));
  const H = 40;
  const gap = 0.35;
  const barW = 100 / weeks.length;

  return (
    <figure className="volume">
      <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" role="img" aria-label="Kilomètres prévus par semaine">
        {weeks.map((w, i) => {
          const h = Math.max(1.5, (w.totalKm / max) * (H - 2));
          const allDone = w.sessions.length > 0 && w.sessions.every((s) => doneIds[s.id]);
          const cls = [
            "bar",
            PHASE_CLASS[w.phase],
            i === currentIndex ? "bar--now" : "",
            allDone ? "bar--done" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <rect key={w.index} className={cls} x={i * barW + gap / 2} y={H - h} width={Math.max(0.4, barW - gap)} height={h} rx={0.4}>
              <title>{`Semaine ${w.index + 1} : ${w.totalKm} km`}</title>
            </rect>
          );
        })}
      </svg>
      <figcaption>
        <span>Kilomètres par semaine</span>
        <span className="volume__peak">Maximum : {max} km</span>
      </figcaption>
    </figure>
  );
}
