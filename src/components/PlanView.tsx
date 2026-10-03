import { RACES, LEVELS, addDays, diffDays, parseISO, type Phase, type Plan, type Session, type Week } from "../lib/plan";
import { todayISO } from "../storage";
import VolumeChart from "./VolumeChart";

interface Props {
  plan: Plan;
  done: Record<string, boolean>;
  onToggle: (id: string) => void;
  onEdit: () => void;
}

const PHASE_LABEL: Record<Phase, string> = {
  base: "Base",
  construction: "Construction",
  specifique: "Spécifique",
  affutage: "Affûtage",
  course: "Semaine de course",
};

const fmtKm = (x: number) => (Number.isInteger(x) ? `${x}` : x.toFixed(1).replace(".", ","));

function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("fr-FR", { ...opts, timeZone: "UTC" }).format(parseISO(iso));
}

export default function PlanView({ plan, done, onToggle, onEdit }: Props) {
  const today = todayISO();
  const { input, weeks } = plan;
  const race = RACES[input.race];

  const currentIndex = (() => {
    const i = weeks.findIndex((w) => diffDays(w.startDate, today) >= 0 && diffDays(w.startDate, today) <= 6);
    if (i >= 0) return i;
    return diffDays(weeks[0].startDate, today) < 0 ? 0 : weeks.length - 1;
  })();

  const allSessions = weeks.flatMap((w) => w.sessions);
  const plannedKm = allSessions.reduce((acc, s) => acc + s.km, 0);
  const doneKm = allSessions.filter((s) => done[s.id]).reduce((acc, s) => acc + s.km, 0);
  const doneCount = allSessions.filter((s) => done[s.id]).length;
  const daysLeft = diffDays(today, input.raceDate);
  const pct = plannedKm > 0 ? Math.round((doneKm / plannedKm) * 100) : 0;

  return (
    <div className="plan">
      <header className="hero">
        <div>
          <p className="hero__label">Objectif</p>
          <h1 className="hero__race">{race.label}</h1>
          <p className="hero__date">
            {fmtDate(input.raceDate, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
          <p className="hero__meta">
            {LEVELS[input.level]}, {input.daysPerWeek} séances par semaine
          </p>
        </div>
        <div className="hero__count" aria-label={daysLeft > 0 ? `${daysLeft} jours avant la course` : "Jour de course"}>
          <span className="hero__days">{daysLeft > 0 ? daysLeft : 0}</span>
          <span className="hero__unit">{daysLeft > 1 ? "jours" : "jour"}</span>
        </div>
      </header>

      {plan.warnings.length > 0 && (
        <ul className="warnings">
          {plan.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}

      <section className="progress" aria-label="Progression">
        <div className="progress__bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
          <span style={{ width: `${pct}%` }} />
        </div>
        <p>
          <strong>{fmtKm(Math.round(doneKm * 10) / 10)} km</strong> courus sur {fmtKm(Math.round(plannedKm))} km prévus.{" "}
          {doneCount} séance{doneCount > 1 ? "s" : ""} sur {allSessions.length}.
        </p>
      </section>

      <VolumeChart weeks={weeks} currentIndex={currentIndex} doneIds={done} />

      <section className="weeks">
        {weeks.map((w) => (
          <WeekCard key={w.index} week={w} isCurrent={w.index === currentIndex} done={done} onToggle={onToggle} today={today} />
        ))}
      </section>

      <footer className="plan__footer">
        <button type="button" className="btn" onClick={() => (window.confirm("Modifier l'objectif ? Les séances déjà validées seront effacées si tu recrées le plan.") ? onEdit() : undefined)}>
          Modifier l'objectif
        </button>
        <p className="hint">Tes données restent sur cet appareil, rien n'est envoyé en ligne.</p>
      </footer>
    </div>
  );
}

interface WeekProps {
  week: Week;
  isCurrent: boolean;
  done: Record<string, boolean>;
  onToggle: (id: string) => void;
  today: string;
}

function WeekCard({ week, isCurrent, done, onToggle, today }: WeekProps) {
  const doneCount = week.sessions.filter((s) => done[s.id]).length;
  const end = addDays(week.startDate, 6);
  const range = `${fmtDate(week.startDate, { day: "numeric", month: "short" })} au ${fmtDate(end, { day: "numeric", month: "short" })}`;

  return (
    <details className={`week week--${week.phase}${isCurrent ? " week--current" : ""}`} open={isCurrent}>
      <summary>
        <span className="week__title">Semaine {week.index + 1}</span>
        <span className="week__range">{range}</span>
        <span className="week__phase">{week.isRecovery ? "Récupération" : PHASE_LABEL[week.phase]}</span>
        <span className="week__km">{fmtKm(week.totalKm)} km</span>
        <span className="week__done">
          {doneCount}/{week.sessions.length}
        </span>
      </summary>
      <p className="week__focus">{week.focus}</p>
      <ul className="sessions">
        {week.sessions.map((s) => (
          <SessionRow key={s.id} session={s} isDone={!!done[s.id]} isToday={s.date === today} onToggle={onToggle} />
        ))}
      </ul>
    </details>
  );
}

function SessionRow({ session: s, isDone, isToday, onToggle }: { session: Session; isDone: boolean; isToday: boolean; onToggle: (id: string) => void }) {
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
        {isDone ? "✓" : ""}
      </button>
      <div className="session__main">
        <div className="session__head">
          <span className="session__date">{day}</span>
          <span className="session__title">{s.title}</span>
          <span className="session__km">{fmtKm(s.km)} km</span>
        </div>
        <p className="session__details">{s.details}</p>
      </div>
    </li>
  );
}
