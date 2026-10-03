import { LEVELS, RACES, diffDays, type PlanInput } from "../lib/plan";
import { fmtDate } from "../lib/format";
import { todayISO } from "../storage";

/** En-tête commun : objectif, date de la course et compte à rebours. */
export default function PlanHero({ input }: { input: PlanInput }) {
  const race = RACES[input.race];
  const daysLeft = Math.max(0, diffDays(todayISO(), input.raceDate));

  return (
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
        <span className="hero__days">{daysLeft}</span>
        <span className="hero__unit">{daysLeft > 1 ? "jours" : "jour"}</span>
      </div>
    </header>
  );
}
