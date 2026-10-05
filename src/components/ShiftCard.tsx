import { useState } from "react";
import { RACES, type Plan } from "../lib/plan";
import { MAX_SHIFT_WEEKS, shiftPlan } from "../lib/shift";
import { fmtDate } from "../lib/format";
import { todayISO } from "../storage";

interface Props {
  plan: Plan;
  done: Record<string, boolean>;
  /** Le dernier décalage peut être annulé */
  canUndo: boolean;
  onShift: (weeks: number) => void;
  onUndo: () => void;
}

const s = (n: number) => (n > 1 ? "s" : "");

/** Carte repliable « Décaler le programme » : une pause de N semaines, puis le plan reprend jusqu'à la course. */
export default function ShiftCard({ plan, done, canUndo, onShift, onUndo }: Props) {
  const today = todayISO();
  const [weeks, setWeeks] = useState(1);
  const [open, setOpen] = useState(false);

  const preview = shiftPlan(plan, weeks, done, today);
  // Semaines d'entraînement avant le décalage : de la première semaine qui a encore des séances à reporter jusqu'à la course.
  const first = plan.weeks.findIndex((w) => w.sessions.some((x) => x.date >= today && !done[x.id]));
  const before = first < 0 ? 0 : plan.weeks.length - first;
  const minWeeks = RACES[plan.input.race].minWeeks;

  return (
    <details className="card shift-card" open={open} onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary>
        <h2 className="card__title">Décaler le programme</h2>
        <span className="shift-card__preview">Pluie, courbatures, imprévu : fais une pause et reprends ensuite</span>
      </summary>

      <div className="shift-card__body">
        <p className="hint">
          {plan.source
            ? `Les séances pas encore faites sont remplacées par une pause, puis reprennent telles qu'elles sont dans ton plan ${plan.source}. La date de la course ne bouge pas : autant de semaines d'entraînement sont retirées, juste avant l'affûtage.`
            : "Les séances pas encore faites sont remplacées par une pause. La date de la course ne bouge pas : le programme reprend ensuite et se recalcule jusqu'au jour J, avec une préparation raccourcie d'autant."}
        </p>

        <div className="portions" role="group" aria-label="Durée de la pause">
          <button type="button" className="portions__btn" aria-label="Une semaine de moins" disabled={weeks <= 1} onClick={() => setWeeks((w) => w - 1)}>
            −
          </button>
          <span className="portions__value" aria-live="polite">
            {weeks} semaine{s(weeks)} de pause
          </span>
          <button type="button" className="portions__btn" aria-label="Une semaine de plus" disabled={weeks >= MAX_SHIFT_WEEKS} onClick={() => setWeeks((w) => w + 1)}>
            +
          </button>
        </div>

        {preview.ok ? (
          <>
            <ul className="shift-card__facts">
              <li>
                Reprise le <strong>{fmtDate(preview.resumeDate, { weekday: "long", day: "numeric", month: "long" })}</strong>.
              </li>
              <li>
                Semaines d'entraînement avant la course : <strong>{before}</strong> → <strong>{preview.weeksLeft}</strong>.
              </li>
              {!plan.source && preview.weeksLeft < minWeeks && (
                <li className="shift-card__warn">
                  Il restera {preview.weeksLeft} semaine{s(preview.weeksLeft)} pour un {RACES[plan.input.race].label.toLowerCase()} ({minWeeks} sont recommandées) : le plan sera condensé.
                </li>
              )}
            </ul>
            <div className="actions">
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => {
                  if (window.confirm(`Décaler le programme de ${weeks} semaine${s(weeks)} ? ${plan.source ? "Les séances à venir sont décalées et des semaines d'entraînement retirées avant l'affûtage." : "Les séances à venir seront remplacées et le plan recalculé jusqu'à la course."}`)) {
                    onShift(weeks);
                    setOpen(false);
                  }
                }}
              >
                Décaler de {weeks} semaine{s(weeks)}
              </button>
            </div>
          </>
        ) : (
          <p className="error" role="alert">
            {preview.error}
          </p>
        )}

        {canUndo && (
          <button type="button" className="link" onClick={() => window.confirm("Annuler le dernier décalage et retrouver le programme d'avant ?") && onUndo()}>
            Annuler le dernier décalage
          </button>
        )}
      </div>
    </details>
  );
}
