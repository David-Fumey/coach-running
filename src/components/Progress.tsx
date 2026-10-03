import type { Plan } from "../lib/plan";
import { paceOf, summarize, weeklyTotals, type Activity } from "../lib/activities";
import { fmtDate, fmtDuration, fmtKm, fmtPace } from "../lib/format";
import { todayISO } from "../storage";
import { currentWeekIndex } from "./PlanView";

interface Props {
  plan: Plan;
  done: Record<string, boolean>;
  activities: Activity[];
}

/** Onglet « Progrès » : chiffres clés et graphiques d'évolution. */
export default function Progress({ plan, done, activities }: Props) {
  const today = todayISO();
  const sum = summarize(plan, activities, done, today);
  const totals = weeklyTotals(plan, activities);
  const current = currentWeekIndex(plan, today);
  const planned = plan.weeks.flatMap((w) => w.sessions).reduce((acc, s) => acc + s.km, 0);
  const pct = planned > 0 ? Math.min(100, Math.round((sum.km / planned) * 100)) : 0;

  if (activities.length === 0) {
    return (
      <p className="hint empty">
        Tes graphiques apparaîtront ici dès ta première activité enregistrée : kilomètres par semaine, évolution de l'allure et régularité.
      </p>
    );
  }

  return (
    <div className="progress-tab">
      <dl className="stats">
        <div className="stat">
          <dt>Distance</dt>
          <dd>
            {fmtKm(Math.round(sum.km * 10) / 10)} <small>km</small>
          </dd>
        </div>
        <div className="stat">
          <dt>Temps</dt>
          <dd>{fmtDuration(sum.minutes)}</dd>
        </div>
        <div className="stat">
          <dt>Allure moy.</dt>
          <dd>
            {sum.avgPace ? fmtPace(sum.avgPace) : "–"} <small>/km</small>
          </dd>
        </div>
        <div className="stat">
          <dt>Plus longue</dt>
          <dd>
            {fmtKm(sum.longestKm)} <small>km</small>
          </dd>
        </div>
        <div className="stat">
          <dt>Régularité</dt>
          <dd>{sum.adherence === null ? "–" : `${Math.round(sum.adherence * 100)} %`}</dd>
        </div>
        <div className="stat">
          <dt>Du plan</dt>
          <dd>{pct} %</dd>
        </div>
      </dl>

      <WeeklyChart totals={totals} current={current} />
      <PaceChart activities={activities} />
    </div>
  );
}

function WeeklyChart({ totals, current }: { totals: ReturnType<typeof weeklyTotals>; current: number }) {
  const max = Math.max(1, ...totals.map((t) => Math.max(t.plannedKm, t.actualKm)));
  const H = 40;
  const barW = 100 / totals.length;
  const gap = 0.35;
  const y = (km: number) => H - Math.max(0, (km / max) * (H - 2));

  return (
    <figure className="volume">
      <figcaption className="chart__title">Kilomètres par semaine</figcaption>
      <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" role="img" aria-label="Kilomètres courus et prévus par semaine">
        {totals.map((t, i) => {
          const x = i * barW + gap / 2;
          const w = Math.max(0.4, barW - gap);
          return (
            <g key={t.index}>
              <rect className="bar-plan" x={x} y={y(t.plannedKm)} width={w} height={H - y(t.plannedKm)} rx={0.4} />
              {t.actualKm > 0 && (
                <rect className={`bar-actual${i === current ? " bar--now" : ""}`} x={x} y={y(t.actualKm)} width={w} height={H - y(t.actualKm)} rx={0.4} />
              )}
              <title>{`Semaine ${t.index + 1} : ${fmtKm(Math.round(t.actualKm * 10) / 10)} km courus sur ${fmtKm(t.plannedKm)} prévus`}</title>
            </g>
          );
        })}
      </svg>
      <p className="legend">
        <span className="legend__swatch legend__swatch--actual" /> Couru
        <span className="legend__swatch legend__swatch--plan" /> Prévu
      </p>
    </figure>
  );
}

function PaceChart({ activities }: { activities: Activity[] }) {
  const pts = [...activities].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  if (pts.length < 2) {
    return (
      <figure className="volume">
        <figcaption className="chart__title">Évolution de l'allure</figcaption>
        <p className="hint">Il faut au moins deux activités pour tracer une courbe.</p>
      </figure>
    );
  }

  const paces = pts.map(paceOf);
  const lo = Math.min(...paces);
  const hi = Math.max(...paces);
  const span = Math.max(0.25, hi - lo);
  const W = 300;
  const H = 110;
  const pad = 10;
  const x = (i: number) => pad + (i / (pts.length - 1)) * (W - 2 * pad);
  // Plus rapide (allure basse) en haut du graphique.
  const y = (p: number) => pad + ((p - lo) / span) * (H - 2 * pad);
  const line = pts.map((_, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(paces[i]).toFixed(1)}`).join(" ");

  return (
    <figure className="volume">
      <figcaption className="chart__title">Évolution de l'allure</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Allure moyenne de chaque activité, de la plus ancienne à la plus récente">
        <path className="pace-line" d={line} />
        {pts.map((a, i) => (
          <circle key={a.id} className="pace-dot" cx={x(i)} cy={y(paces[i])} r={3.5}>
            <title>{`${fmtDate(a.date, { day: "numeric", month: "short" })} : ${fmtPace(paces[i])} /km sur ${fmtKm(a.km)} km`}</title>
          </circle>
        ))}
      </svg>
      <p className="legend">
        <span>Plus haut = plus rapide</span>
        <span>Meilleure : {fmtPace(lo)} /km</span>
        <span>Plus lente : {fmtPace(hi)} /km</span>
      </p>
    </figure>
  );
}
