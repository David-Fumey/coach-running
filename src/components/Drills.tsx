import { useState } from "react";
import DrillCard from "./DrillCard";
import { GUIDE, doseLabel, drillsOf, stretchRoutine, warmupRoutine, type DrillKind } from "../lib/drills";

/** Onglet « Exercices » : échauffement avant la séance, étirements après. Chaque exercice est une carte dépliable. */
export default function Drills() {
  const [kind, setKind] = useState<DrillKind>("echauffement");
  /** Échauffement : séance rapide ou non. Étirements : version complète ou courte. */
  const [more, setMore] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const guide = GUIDE[kind];
  const warm = kind === "echauffement";
  const routine = warm ? warmupRoutine(more) : stretchRoutine(more);

  function pick(next: DrillKind) {
    setKind(next);
    setMore(false);
    setOpen(null);
  }

  /** Ouvre la fiche d'un exercice de la routine et l'amène à l'écran. */
  function jump(id: string) {
    setOpen(id);
    window.setTimeout(() => document.getElementById(`drill-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  return (
    <div className="drills">
      <div className="segmented" role="group" aria-label="Moment des exercices">
        <button type="button" aria-pressed={warm} onClick={() => pick("echauffement")}>
          Échauffement
        </button>
        <button type="button" aria-pressed={!warm} onClick={() => pick("etirement")}>
          Étirements
        </button>
      </div>

      <section className={`card drills__intro drills__intro--${kind}`} aria-labelledby="drills-intro">
        <p className="eyebrow">{guide.title}</p>
        <h2 id="drills-intro" className="card__title">
          {warm ? "Réveille ton corps avant de courir" : "Récupère en douceur après la séance"}
        </h2>
        <p>{guide.lead}</p>
        <ul className="tips">
          {guide.rules.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </section>

      <section className="card drills__routine" aria-labelledby="drills-routine">
        <div className="card__head">
          <h2 id="drills-routine" className="card__title">
            Routine conseillée
          </h2>
          <span className="pill">{routine.minutes} min environ</span>
        </div>
        <div className="chips" role="group" aria-label="Type de routine">
          <button type="button" className="chip-btn" aria-pressed={!more} onClick={() => setMore(false)}>
            {warm ? "Footing ou sortie longue" : "Version courte"}
          </button>
          <button type="button" className="chip-btn" aria-pressed={more} onClick={() => setMore(true)}>
            {warm ? "Séance rapide" : "Version complète"}
          </button>
        </div>
        <p className="hint">
          {warm
            ? more
              ? "Pour le fractionné, le tempo, un test ou une course : on ajoute les gammes et les lignes droites progressives."
              : "Pour un footing facile ou une sortie longue : mobilité douce, sans les gammes."
            : more
              ? "Après une séance dure ou une sortie longue : tous les groupes musculaires."
              : "Après un footing facile : les grands groupes musculaires suffisent."}
        </p>
        <ol className="drills__order">
          {routine.drills.map((d) => (
            <li key={d.id}>
              <button type="button" className="drills__jump" onClick={() => jump(d.id)}>
                {d.name}
              </button>
              <span className="drills__dose">{doseLabel(d)}</span>
            </li>
          ))}
        </ol>
      </section>

      <h2 className="topics__title">Tous les exercices</h2>
      <div className="topic-list">
        {drillsOf(kind).map((d) => (
          <DrillCard key={d.id} drill={d} open={open === d.id} onToggle={(o) => setOpen(o ? d.id : open === d.id ? null : open)} />
        ))}
      </div>
    </div>
  );
}
