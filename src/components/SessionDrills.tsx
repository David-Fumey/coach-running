import { routinesFor, type Routine } from "../lib/drills";
import DrillCard from "./DrillCard";

interface Props {
  /** Type de la séance (`Session["type"]`) */
  type: string;
  onOpenDrills: () => void;
}

/** Échauffement avant et étirements après, adaptés au type de la séance, repliés sous la séance de l'accueil. Chaque exercice se déplie pour montrer en quoi il consiste. */
export default function SessionDrills({ type, onOpenDrills }: Props) {
  const r = routinesFor(type);
  return (
    <details className="wo-toggle">
      <summary>Échauffement et étirements conseillés</summary>
      <div className="sdrills">
        <Part title="Avant" routine={r.warmup} />
        <Part title="Après" routine={r.stretch} />
        <button type="button" className="link" onClick={onOpenDrills}>
          Voir toutes les fiches
        </button>
      </div>
    </details>
  );
}

function Part({ title, routine }: { title: string; routine: Routine }) {
  return (
    <section className="sdrills__part">
      <h3 className="sdrills__title">
        {title} <span className="pill">{routine.minutes} min environ</span>
      </h3>
      <div className="topic-list">
        {routine.drills.map((d, i) => (
          <DrillCard key={d.id} drill={d} rank={i + 1} />
        ))}
      </div>
    </section>
  );
}
