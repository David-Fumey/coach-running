import type { ReactNode } from "react";
import { addDays, diffDays, type Plan, type Session, type Week } from "../lib/plan";
import { PHASE_LABEL, fmtDate, fmtKm } from "../lib/format";
import { todayISO } from "../storage";
import VolumeChart from "./VolumeChart";
import { CheckIcon } from "./icons";
import PaceCard, { PaceLine } from "./PaceCard";
import GoalCard from "./GoalCard";
import WorkoutSteps from "./WorkoutSteps";
import StrengthSteps from "./StrengthSteps";
import { upgradableCount } from "../lib/workouts";
import ShiftCard from "./ShiftCard";
import type { Goal } from "../lib/goal";
import type { PaceModel } from "../lib/paces";

interface Props {
  plan: Plan;
  done: Record<string, boolean>;
  onToggle: (id: string) => void;
  onEdit: () => void;
  paces: PaceModel | null;
  /** Allure moyenne saisie à la main, null si elle est calculée */
  paceRef: number | null;
  onChangePaceRef: (pace: number | null) => void;
  /** Temps objectif de la course du plan */
  goal: Goal | null;
  onChangeGoal: (goal: Goal | null) => void;
  canUndoShift: boolean;
  onShift: (weeks: number) => void;
  onUndoShift: () => void;
  /** Passe les séances de qualité et de tempo à venir au catalogue de séances */
  onUpgrade: () => void;
  /** Test de 5 km : temps à saisir, dernier résultat, prochain test */
  testCard?: ReactNode;
}

/** Index de la semaine en cours (ou la plus proche si le plan n'a pas commencé ou est terminé). */
export function currentWeekIndex(plan: Plan, today: string) {
  const { weeks } = plan;
  const i = weeks.findIndex((w) => diffDays(w.startDate, today) >= 0 && diffDays(w.startDate, today) <= 6);
  if (i >= 0) return i;
  return diffDays(weeks[0].startDate, today) < 0 ? 0 : weeks.length - 1;
}

/** Onglet « Programme » : le plan complet, semaine par semaine. */
export default function PlanView({ plan, done, onToggle, onEdit, paces, paceRef, onChangePaceRef, goal, onChangeGoal, canUndoShift, onShift, onUndoShift, onUpgrade, testCard }: Props) {
  const today = todayISO();
  const upgradable = upgradableCount(plan, done, today);
  const currentIndex = currentWeekIndex(plan, today);

  return (
    <div className="plan">
      {plan.warnings.length > 0 && (
        <ul className="warnings">
          {plan.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}

      {upgradable > 0 && (
        <section className="card upgrade-card" aria-labelledby="upgrade-title">
          <h2 id="upgrade-title" className="card__title">Nouvelles séances disponibles</h2>
          <p className="hint">
            {upgradable === 1 ? "1 séance à venir peut" : `${upgradable} séances à venir peuvent`} passer au nouveau catalogue : côtes, pyramides, intervalles au seuil, sorties longues variées, tests de 5 km et renforcement les jours sans course, avec l'allure de chaque portion. Les dates et les séances déjà faites ne changent pas ; les kilomètres non plus, sauf la semaine d'un test.
          </p>
          <div className="actions">
            <button type="button" className="btn btn--primary" onClick={onUpgrade}>
              Mettre à jour mes séances à venir
            </button>
          </div>
        </section>
      )}

      <VolumeChart weeks={plan.weeks} currentIndex={currentIndex} doneIds={done} />

      <GoalCard key={goal ? goal.minutes : "aucun"} race={plan.input.race} goal={goal} model={paces} onChange={onChangeGoal} />

      {testCard}

      <PaceCard model={paces} manual={paceRef} onChangeManual={onChangePaceRef} />

      <ShiftCard plan={plan} done={done} canUndo={canUndoShift} onShift={onShift} onUndo={onUndoShift} />

      <section className="weeks">
        {plan.weeks.map((w) => (
          <WeekCard key={w.index} plan={plan} paces={paces} week={w} isCurrent={w.index === currentIndex} done={done} onToggle={onToggle} today={today} />
        ))}
      </section>

      <footer className="plan__footer">
        <button type="button" className="btn" onClick={() => (window.confirm("Modifier l'objectif ? Les séances déjà validées et les activités enregistrées seront effacées si tu recrées le plan.") ? onEdit() : undefined)}>
          Modifier l'objectif
        </button>
        <p className="hint">Tes données restent sur cet appareil, rien n'est envoyé en ligne.</p>
      </footer>
    </div>
  );
}

interface WeekProps {
  plan: Plan;
  paces: PaceModel | null;
  week: Week;
  isCurrent: boolean;
  done: Record<string, boolean>;
  onToggle: (id: string) => void;
  today: string;
}

function WeekCard({ plan, paces, week, isCurrent, done, onToggle, today }: WeekProps) {
  // Courses, renforcement et mobilité, dans l'ordre des jours.
  const entries = [...week.sessions, ...(week.extras ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  const doneCount = entries.filter((s) => done[s.id]).length;
  const end = addDays(week.startDate, 6);
  const range = `${fmtDate(week.startDate, { day: "numeric", month: "short" })} au ${fmtDate(end, { day: "numeric", month: "short" })}`;

  return (
    <details className={`week week--${week.phase}${isCurrent ? " week--current" : ""}${week.paused ? " week--paused" : ""}`} open={isCurrent}>
      <summary>
        <span className="week__title">Semaine {week.index + 1}</span>
        <span className="week__range">{range}</span>
        <span className="week__phase">{week.paused ? "Pause" : week.isRecovery ? "Récupération" : PHASE_LABEL[week.phase]}</span>
        <span className="week__km">{fmtKm(week.totalKm)} km</span>
        <span className="week__done">
          {entries.length === 0 ? "–" : `${doneCount}/${entries.length}`}
        </span>
      </summary>
      <p className="week__focus">{week.focus}</p>
      <ul className="sessions">
        {entries.map((s) => (
          <SessionRow
            key={s.id}
            session={s}
            isDone={!!done[s.id]}
            isToday={s.date === today}
            onToggle={onToggle}
            pace={
              s.type === "strength" ? (
                <StrengthSteps session={s} collapsed />
              ) : (
                <>
                  <PaceLine plan={plan} model={paces} session={s} />
                  <WorkoutSteps plan={plan} model={paces} session={s} collapsed />
                </>
              )
            }
          />
        ))}
      </ul>
    </details>
  );
}

export function SessionRow({ session: s, isDone, isToday, onToggle, pace }: { session: Session; isDone: boolean; isToday: boolean; onToggle: (id: string) => void; pace?: ReactNode }) {
  const day = fmtDate(s.date, { weekday: "short", day: "numeric", month: "short" });
  return (
    <li className={`session session--${s.type}${isDone ? " is-done" : ""}${isToday ? " is-today" : ""}`}>
      <button
        type="button"
        className="check"
        aria-pressed={isDone}
        aria-label={`${isDone ? "Annuler" : "Valider"} la séance ${s.title} du ${day}`}
        onClick={() => onToggle(s.id)}
      >
        {isDone ? <CheckIcon /> : null}
      </button>
      <div className="session__main">
        <div className="session__head">
          <span className="session__date">{day}</span>
          <span className="session__title">{s.title}</span>
          <span className="session__km">{s.type === "strength" ? `${s.strength?.minutes ?? 0} min` : `${fmtKm(s.km)} km`}</span>
        </div>
        <p className="session__details">{s.details}</p>
        {pace}
      </div>
    </li>
  );
}
