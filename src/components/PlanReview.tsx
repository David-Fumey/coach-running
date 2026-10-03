import type { Phase, Plan } from "../lib/plan";
import { PHASE_LABEL, fmtKm } from "../lib/format";
import PlanHero from "./PlanHero";
import VolumeChart from "./VolumeChart";

interface Props {
  plan: Plan;
  onConfirm: () => void;
  onEdit: () => void;
}

const PHASES: Phase[] = ["base", "construction", "specifique", "affutage", "course"];

/** Écran de relecture : on voit le plan en gros avant de le valider et d'entrer dans l'application. */
export default function PlanReview({ plan, onConfirm, onEdit }: Props) {
  const { weeks } = plan;
  const sessions = weeks.flatMap((w) => w.sessions);
  const totalKm = sessions.reduce((acc, s) => acc + s.km, 0);
  const peak = Math.max(...weeks.map((w) => w.totalKm));

  return (
    <div className="review">
      <p className="hero__label">Ton plan est prêt</p>
      <PlanHero input={plan.input} />

      {plan.warnings.length > 0 && (
        <ul className="warnings">
          {plan.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}

      <dl className="stats">
        <div className="stat">
          <dt>Durée</dt>
          <dd>
            {weeks.length} <small>semaines</small>
          </dd>
        </div>
        <div className="stat">
          <dt>Séances</dt>
          <dd>{sessions.length}</dd>
        </div>
        <div className="stat">
          <dt>Total prévu</dt>
          <dd>
            {fmtKm(Math.round(totalKm))} <small>km</small>
          </dd>
        </div>
        <div className="stat">
          <dt>Semaine max.</dt>
          <dd>
            {fmtKm(peak)} <small>km</small>
          </dd>
        </div>
      </dl>

      <VolumeChart weeks={weeks} currentIndex={0} doneIds={{}} />

      <ul className="phases">
        {PHASES.filter((p) => weeks.some((w) => w.phase === p)).map((p) => {
          const n = weeks.filter((w) => w.phase === p).length;
          return (
            <li key={p} className={`phases__item phases__item--${p}`}>
              <strong>{PHASE_LABEL[p]}</strong> · {n} semaine{n > 1 ? "s" : ""}
            </li>
          );
        })}
      </ul>

      <div className="actions">
        <button type="button" className="btn btn--primary" onClick={onConfirm}>
          Valider mon plan
        </button>
        <button type="button" className="btn" onClick={onEdit}>
          Modifier mes réponses
        </button>
      </div>
      <p className="hint">Une fois validé, tu retrouves tout dans ton tableau de bord : programme, activités et progrès.</p>
    </div>
  );
}
