import Figure from "./Figure";
import { POSES } from "../lib/poses";
import { ZONE_LABEL, doseLabel, type Drill } from "../lib/drills";

interface Props {
  drill: Drill;
  /** Avec `onToggle`, la carte est pilotée de l'extérieur ; sans, elle s'ouvre et se ferme seule */
  open?: boolean;
  onToggle?: (open: boolean) => void;
  /** Rang de l'exercice dans une routine, affiché devant son nom */
  rank?: number;
}

/** Fiche d'un exercice, dépliable : figures, ce qu'il travaille, comment le faire, conseils, erreur fréquente. */
export default function DrillCard({ drill: d, open, onToggle, rank }: Props) {
  return (
    <details
      id={onToggle ? `drill-${d.id}` : undefined}
      className={`topic topic--zone-${d.zone}`}
      open={onToggle ? open : undefined}
      onToggle={onToggle ? (e) => onToggle((e.currentTarget as HTMLDetailsElement).open) : undefined}
    >
      <summary>
        <span className="topic__label">
          {rank !== undefined ? `${rank}. ` : ""}
          {d.name}
        </span>
        <span className="topic__goal">
          {doseLabel(d)} · {ZONE_LABEL[d.zone]}
          {d.fast ? " · séances rapides" : ""}
        </span>
      </summary>
      <div className="topic__body">
        <div className={`drills__frames${(POSES[d.id] ?? []).length === 1 ? " drills__frames--one" : ""}`}>
          {(POSES[d.id] ?? []).map((f) => (
            <figure key={f.label} className="drills__frame">
              <Figure pose={f.pose} />
              <figcaption>{f.label}</figcaption>
            </figure>
          ))}
        </div>
        <p>
          <strong>Travaille :</strong> {d.target}.
        </p>
        <h3 className="topic__sub">Comment faire</h3>
        <ol className="drills__steps">
          {d.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        <h3 className="topic__sub">Conseils</h3>
        <ul className="tips">
          {d.tips.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <div className="topic__watch">
          <h3 className="topic__sub">Erreur fréquente</h3>
          <p>{d.avoid}</p>
        </div>
      </div>
    </details>
  );
}
