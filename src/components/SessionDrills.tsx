import { doseLabel, routinesFor, type Routine } from "../lib/drills";

interface Props {
  /** Type de la séance (`Session["type"]`) */
  type: string;
  onOpenDrills: () => void;
}

/** Échauffement avant et étirements après, adaptés au type de la séance, repliés sous la séance de l'accueil. */
export default function SessionDrills({ type, onOpenDrills }: Props) {
  const r = routinesFor(type);
  return (
    <details className="wo-toggle">
      <summary>Échauffement et étirements conseillés</summary>
      <div className="sdrills">
        <Part title="Avant" routine={r.warmup} />
        <Part title="Après" routine={r.stretch} />
        <button type="button" className="link" onClick={onOpenDrills}>
          Voir les fiches détaillées
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
      <ol className="drills__order">
        {routine.drills.map((d) => (
          <li key={d.id}>
            <span>{d.name}</span>
            <span className="drills__dose">{doseLabel(d)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
