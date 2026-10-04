import type { Plan, Session } from "../lib/plan";
import type { PaceModel } from "../lib/paces";
import { stepSize, workoutBlocks, type WorkoutStep } from "../lib/steps";
import { fmtTargetPace } from "../lib/format";

const KIND_LABEL: Record<WorkoutStep["kind"], string> = { easy: "Courir", work: "Courir", stride: "Courir", rest: "Récup.", walk: "Marcher" };

function paceText(step: WorkoutStep): string | null {
  if (!step.pace) return null;
  return step.paceMode === "plafond" ? `Pas plus vite que ${fmtTargetPace(step.pace.fast)} /km` : `${fmtTargetPace(step.pace.fast)}–${fmtTargetPace(step.pace.slow)} /km`;
}

/** Déroulé pas à pas d'une séance structurée, avec l'allure de chaque portion. Rien pour un footing simple. */
export default function WorkoutSteps({ plan, model, session, collapsed = false }: { plan: Plan; model: PaceModel | null; session: Session; collapsed?: boolean }) {
  const blocks = workoutBlocks(plan, session, model);
  if (!blocks) return null;
  let n = 0;
  const list = (
    <div className="wo" role="list" aria-label={`Déroulé de la séance ${session.title}`}>
      {blocks.map((b) => (
        <section key={b.id} className={`wo__block wo__block--${b.tone}`} role="listitem">
          <h4 className="wo__head">
            <span>{b.title}</span>
            {b.repeat > 1 && <span className="wo__repeat">{b.repeat} répétitions</span>}
          </h4>
          <ol className="wo__list">
            {b.steps.map((s) => {
              const pace = paceText(s);
              n++;
              return (
                <li key={`${b.id}-${s.label}-${s.distanceM ?? s.seconds ?? 0}-${n}`} className={`wo-step wo-step--${s.kind}`}>
                  <span className="wo-step__n" aria-hidden="true">{n}</span>
                  <span className="wo-step__body">
                    <span className="wo-step__what">
                      <strong>{stepSize(s)}</strong> {s.label}
                    </span>
                    {pace && <span className="wo-step__pace">{pace}</span>}
                    {s.effort && <span className="wo-step__effort">{s.effort}</span>}
                  </span>
                  <span className="wo-step__kind">{KIND_LABEL[s.kind]}</span>
                </li>
              );
            })}
          </ol>
          {b.note && <p className="wo__note">{b.note}</p>}
        </section>
      ))}
    </div>
  );
  if (!collapsed) return list;
  return (
    <details className="wo-toggle">
      <summary>Voir le déroulé pas à pas</summary>
      {list}
    </details>
  );
}
