import { addDays, diffDays, type Plan, type Session } from "../lib/plan";
import { summarize, type Activity } from "../lib/activities";
import { fmtDate, fmtDuration, fmtKm } from "../lib/format";
import { todayISO } from "../storage";
import PlanHero from "./PlanHero";
import { CheckIcon, ChevronIcon, Ring } from "./icons";
import { currentWeekIndex } from "./PlanView";
import { PaceLine } from "./PaceCard";
import type { PaceModel } from "../lib/paces";

interface Props {
  plan: Plan;
  done: Record<string, boolean>;
  activities: Activity[];
  onLog: (sessionId?: string) => void;
  onOpenProgram: () => void;
  onOpenProgress: () => void;
  paces: PaceModel | null;
}

const TYPE_LABEL: Record<Session["type"], string> = {
  easy: "Footing",
  quality: "Qualité",
  tempo: "Tempo",
  long: "Sortie longue",
  recovery: "Récupération",
  shakeout: "Veille de course",
  race: "Course",
};

const DAY_LETTERS = ["L", "M", "M", "J", "V", "S", "D"];

/** Accueil du hub : la prochaine séance, la semaine en cours et quelques chiffres. */
export default function Home({ plan, done, activities, onLog, onOpenProgram, onOpenProgress, paces }: Props) {
  const today = todayISO();
  const week = plan.weeks[currentWeekIndex(plan, today)];
  const allSessions = plan.weeks.flatMap((w) => w.sessions);
  const upcoming = allSessions.filter((s) => !done[s.id] && diffDays(today, s.date) >= 0).slice(0, 3);
  const next = upcoming[0];
  const sum = summarize(plan, activities, done, today);
  const weekDone = week.sessions.filter((s) => done[s.id]).length;
  const doneCount = allSessions.filter((s) => done[s.id]).length;
  const pct = allSessions.length > 0 ? Math.round((doneCount / allSessions.length) * 100) : 0;

  return (
    <div className="home">
      <PlanHero input={plan.input} goal={paces?.goal ?? null} />

      <section className={`card next${next ? ` next--${next.type}` : ""}`} aria-labelledby="next-title">
        <p className="eyebrow">
          <span id="next-title">Prochaine séance</span>
        </p>
        {next ? (
          <>
            <div className="next__top">
              <div>
                <p className="next__when">
                  {next.date === today ? "Aujourd'hui" : fmtDate(next.date, { weekday: "long", day: "numeric", month: "long" })}
                </p>
                <h2 className="next__what">{next.title}</h2>
                {TYPE_LABEL[next.type] !== next.title && <span className="tag">{TYPE_LABEL[next.type]}</span>}
              </div>
              <p className="next__km">
                {fmtKm(next.km)}
                <small>km</small>
              </p>
            </div>
            <p className="session__details">{next.details}</p>
            <PaceLine plan={plan} model={paces} session={next} />
            <div className="actions">
              <button type="button" className="btn btn--primary" onClick={() => onLog(next.id)}>
                Enregistrer cette séance
              </button>
            </div>
          </>
        ) : (
          <p className="hint">Toutes les séances du plan sont faites. Bravo !</p>
        )}
      </section>

      <section className="card" aria-labelledby="week-title">
        <div className="card__head">
          <h2 id="week-title" className="card__title">
            Cette semaine
          </h2>
          <span className="pill">
            Semaine {week.index + 1}/{plan.weeks.length}
          </span>
        </div>
        <ol className="weekdots" aria-label="Séances de la semaine">
          {DAY_LETTERS.map((letter, i) => {
            const date = addDays(week.startDate, i);
            const s = week.sessions.find((x) => x.date === date);
            const state = !s ? "off" : done[s.id] ? "done" : date === today ? "today" : diffDays(today, date) < 0 ? "missed" : "todo";
            return (
              <li key={date} className={`weekdot weekdot--${state}${date === today ? " weekdot--now" : ""}`}>
                <span className="weekdot__mark" aria-hidden="true">
                  {state === "done" ? <CheckIcon /> : s ? fmtKm(s.km) : ""}
                </span>
                <span className="weekdot__letter">{letter}</span>
                <span className="sr-only">
                  {fmtDate(date, { weekday: "long" })} :{" "}
                  {s ? `${s.title} ${fmtKm(s.km)} km${done[s.id] ? ", faite" : ""}` : "repos"}
                </span>
              </li>
            );
          })}
        </ol>
        <p className="hint">
          {week.paused ? week.focus : `${weekDone}/${week.sessions.length} séances faites · ${fmtKm(week.totalKm)} km prévus`}
        </p>
        {upcoming.length > 1 && (
          <ul className="mini">
            {upcoming.slice(1).map((s) => (
              <li key={s.id}>
                <span className="mini__date">{fmtDate(s.date, { weekday: "short", day: "numeric", month: "short" })}</span>
                <span>{s.title}</span>
                <span className="mini__km">{fmtKm(s.km)} km</span>
              </li>
            ))}
          </ul>
        )}
        <button type="button" className="link link--arrow" onClick={onOpenProgram}>
          Voir tout le programme <ChevronIcon />
        </button>
      </section>

      <section className="card" aria-labelledby="stats-title">
        <h2 id="stats-title" className="card__title">
          Depuis le début
        </h2>
        <div className="since">
          <Ring value={doneCount} goal={allSessions.length} label={`${pct} %`} sub="du plan" size={104} />
          <dl className="stats stats--stack">
            <div className="stat">
              <dt>Distance</dt>
              <dd>
                {fmtKm(Math.round(sum.km * 10) / 10)} <small>km</small>
              </dd>
            </div>
            <div className="stat">
              <dt>Activités</dt>
              <dd>{sum.count}</dd>
            </div>
            <div className="stat">
              <dt>Temps</dt>
              <dd>{fmtDuration(sum.minutes)}</dd>
            </div>
          </dl>
        </div>
        <button type="button" className="link link--arrow" onClick={onOpenProgress}>
          Voir mes progrès <ChevronIcon />
        </button>
      </section>
    </div>
  );
}
