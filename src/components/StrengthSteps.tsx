import type { Session } from "../lib/plan";

function sizeOf(e: NonNullable<Session["strength"]>["exercises"][number]): string {
  const side = e.perSide ? " par côté" : "";
  return e.seconds !== undefined ? `${e.sets} × ${e.seconds} s${side}` : `${e.sets} × ${e.reps}${side}`;
}

/** Exercices d'une séance de renforcement ou de mobilité, avec séries et conseil de placement. */
export default function StrengthSteps({ session, collapsed = false }: { session: Session; collapsed?: boolean }) {
  const w = session.strength;
  if (!w) return null;
  const light = w.format === "mobilite";
  const list = (
    <div className="wo" role="list" aria-label={`Exercices de la séance ${session.title}`}>
      <section className="wo__block wo__block--strides" role="listitem">
        <h4 className="wo__head">
          <span>{light ? "Mobilité" : "Circuit"}</span>
          <span className="wo__repeat">{w.minutes} min environ</span>
        </h4>
        <ol className="wo__list">
          {w.exercises.map((e, i) => (
            <li key={e.name} className="wo-step wo-step--stride">
              <span className="wo-step__n" aria-hidden="true">{i + 1}</span>
              <span className="wo-step__body">
                <span className="wo-step__what">
                  <strong>{sizeOf(e)}</strong> {e.name}
                </span>
                <span className="wo-step__effort">{e.tip}</span>
              </span>
              <span className="wo-step__kind">{light ? "Détente" : "Force"}</span>
            </li>
          ))}
        </ol>
        <p className="wo__note">
          {light ? "Prends ton temps, respire calmement, sans douleur." : `${w.restSeconds} s de repos entre deux séries. Qualité du geste avant le nombre de répétitions : arrête-toi si la technique se dégrade.`}
        </p>
      </section>
    </div>
  );
  if (!collapsed) return list;
  return (
    <details className="wo-toggle">
      <summary>Voir les exercices</summary>
      {list}
    </details>
  );
}
