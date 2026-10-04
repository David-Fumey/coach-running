import { useState } from "react";
import type { Plan } from "../lib/plan";
import { diffDays } from "../lib/plan";
import { summarize, type Activity } from "../lib/activities";
import {
  WINDOW_SIZE,
  bucketsOf,
  clampStart,
  defaultSelection,
  defaultStart,
  extrasOf,
  inScope,
  planRange,
  startOf,
  type Grain,
  type Scope,
} from "../lib/progress";
import { fmtDate, fmtDuration, fmtKm, fmtPace } from "../lib/format";
import { todayISO } from "../storage";
import Records from "./Records";
import { TrendChart, VolumeChart, periodLabel, type TrendMetric, type VolumeMetric } from "./charts";

interface Props {
  plan: Plan;
  done: Record<string, boolean>;
  activities: Activity[];
}

const SCOPES: { id: Scope; label: string }[] = [
  { id: "programme", label: "Programme actuel" },
  { id: "total", label: "Total" },
];

const GRAINS: { id: Grain; label: string }[] = [
  { id: "jour", label: "Jours" },
  { id: "semaine", label: "Semaines" },
  { id: "mois", label: "Mois" },
  { id: "annee", label: "Années" },
];

const round1 = (x: number) => Math.round(x * 10) / 10;

/** Onglet « Progrès » : chiffres clés et graphiques, sur le programme en cours ou sur tout l'historique. */
export default function Progress({ plan, done, activities }: Props) {
  const today = todayISO();
  const [scope, setScope] = useState<Scope>("programme");
  const [grain, setGrain] = useState<Grain>("semaine");
  /** Début de la fenêtre choisi avec les flèches ; null = fenêtre par défaut */
  const [startPick, setStartPick] = useState<number | null>(null);
  const [selPick, setSelPick] = useState<number | null>(null);
  const [volumeMetric, setVolumeMetric] = useState<VolumeMetric>("km");
  const [trendMetric, setTrendMetric] = useState<TrendMetric>("pace");

  if (activities.length === 0) {
    return (
      <p className="hint empty">
        Tes graphiques apparaîtront ici dès ta première activité enregistrée : kilomètres par période, évolution de l'allure et régularité.
      </p>
    );
  }

  const scoped = inScope(plan, activities, scope);
  const sum = summarize(plan, scoped, done, today);
  const extras = extrasOf(scoped);
  // Une mesure sans donnée disparaît : on revient alors à la mesure de base.
  const vMetric: VolumeMetric = extras.elevation !== null ? volumeMetric : "km";
  const tMetric: TrendMetric = extras.hr !== null ? trendMetric : "pace";
  const all = bucketsOf(plan, activities, scope, grain, today);
  const size = Math.min(WINDOW_SIZE[grain], all.length);
  const start = clampStart(all.length, size, startPick ?? defaultStart(all, size, scope));
  const view = all.slice(start, start + size);
  const selected = Math.min(selPick ?? defaultSelection(view), view.length - 1);
  const picked = view[selected];

  const planned = plan.weeks.flatMap((w) => w.sessions).reduce((acc, s) => acc + s.km, 0);
  const pct = planned > 0 ? Math.min(100, Math.round((sum.km / planned) * 100)) : 0;
  const { from, to } = planRange(plan);
  const firstDate = scoped.reduce((m, a) => (a.date < m ? a.date : m), today);
  const weeksCovered = Math.max(1, Math.ceil((diffDays(startOf(firstDate, "semaine"), today) + 1) / 7));

  function pickScope(s: Scope) {
    setScope(s);
    setStartPick(null);
    setSelPick(null);
  }
  function pickGrain(g: Grain) {
    setGrain(g);
    setStartPick(null);
    setSelPick(null);
  }
  function move(direction: -1 | 1) {
    setStartPick(clampStart(all.length, size, start + direction * Math.max(1, Math.floor(size / 2))));
    setSelPick(null);
  }

  const range =
    view.length > 0
      ? `${fmtDate(view[0].start, { day: "numeric", month: "short", year: grain === "jour" || grain === "semaine" ? undefined : "numeric" })} – ${fmtDate(view[view.length - 1].end, { day: "numeric", month: "short", year: "numeric" })}`
      : "";

  return (
    <div className="progress-tab">
      <section className="card filters" aria-label="Filtres">
        <div className="segmented" role="group" aria-label="Période analysée">
          {SCOPES.map((s) => (
            <button key={s.id} type="button" aria-pressed={scope === s.id} onClick={() => pickScope(s.id)}>
              {s.label}
            </button>
          ))}
        </div>
        <p className="hint filters__note">
          {scope === "programme"
            ? `Du ${fmtDate(from, { day: "numeric", month: "short", year: "numeric" })} au ${fmtDate(to, { day: "numeric", month: "short", year: "numeric" })}, jour de la course.`
            : "Toutes les activités enregistrées, avant et pendant le programme."}
        </p>
      </section>

      <dl className="stats">
        <Stat label="Distance" value={fmtKm(round1(sum.km))} unit="km" />
        <Stat label="Temps" value={sum.count === 0 ? "–" : fmtDuration(sum.minutes)} />
        {scope === "total" && <Stat label="Sorties" value={String(sum.count)} />}
        <Stat label="Allure moy." value={sum.avgPace ? fmtPace(sum.avgPace) : "–"} unit="/km" />
        <Stat label="Plus longue" value={sum.count === 0 ? "–" : fmtKm(sum.longestKm)} unit="km" />
        {scope === "programme" ? (
          <>
            <Stat label="Régularité" value={sum.adherence === null ? "–" : `${Math.round(sum.adherence * 100)} %`} />
            <Stat label="Du plan" value={`${pct} %`} />
          </>
        ) : (
          <Stat label="Par semaine" value={fmtKm(round1(sum.km / weeksCovered))} unit="km" />
        )}
        {extras.elevation !== null && <Stat label="Dénivelé" value={Math.round(extras.elevation).toLocaleString("fr-FR")} unit="m" />}
        {extras.hr !== null && <Stat label="FC moy." value={String(Math.round(extras.hr))} unit="bpm" />}
      </dl>

      <Records
        activities={scoped}
        today={today}
        scopeLabel={scope === "programme" ? "Sur les activités du programme actuel." : "Sur toutes les activités enregistrées."}
      />

      {view.length === 0 ? (
        <p className="hint empty">Aucune activité à afficher.</p>
      ) : (
        <>
          <section className="card chart-card" aria-labelledby="chart-volume">
            <div className="card__head">
              <h2 id="chart-volume" className="card__title">
                {vMetric === "km" ? "Distance" : "Dénivelé"}
              </h2>
              <div className="pager">
                <button type="button" className="pager__btn" aria-label="Périodes précédentes" disabled={start <= 0} onClick={() => move(-1)}>
                  ‹
                </button>
                <button type="button" className="pager__btn" aria-label="Périodes suivantes" disabled={start + size >= all.length} onClick={() => move(1)}>
                  ›
                </button>
              </div>
            </div>
            {extras.elevation !== null && (
              <div className="segmented" role="group" aria-label="Mesure">
                <button type="button" aria-pressed={vMetric === "km"} onClick={() => setVolumeMetric("km")}>
                  Distance
                </button>
                <button type="button" aria-pressed={vMetric === "elevation"} onClick={() => setVolumeMetric("elevation")}>
                  Dénivelé
                </button>
              </div>
            )}
            <div className="segmented segmented--3" role="group" aria-label="Regroupement">
              {GRAINS.map((g) => (
                <button key={g.id} type="button" aria-pressed={grain === g.id} onClick={() => pickGrain(g.id)}>
                  {g.label}
                </button>
              ))}
            </div>
            <p className="chart-card__range">{range}</p>

            <VolumeChart buckets={view} grain={grain} selected={selected} onSelect={setSelPick} metric={vMetric} />

            <div className="readout" role="status" aria-live="polite">
              <p className="readout__title">
                {periodLabel(picked, grain)}
                {picked.current && <span className="tag">En cours</span>}
                {picked.future && <span className="tag tag--muted">À venir</span>}
              </p>
              <dl className="readout__grid">
                <div>
                  <dt>Couru</dt>
                  <dd>{picked.future ? "–" : `${fmtKm(round1(picked.km))} km`}</dd>
                </div>
                {picked.plannedKm !== null && (
                  <div>
                    <dt>Prévu</dt>
                    <dd>
                      {fmtKm(round1(picked.plannedKm))} km
                      {!picked.future && picked.plannedKm > 0 && <small> ({Math.round((picked.km / picked.plannedKm) * 100)} %)</small>}
                    </dd>
                  </div>
                )}
                <div>
                  <dt>Sorties</dt>
                  <dd>{picked.future ? "–" : picked.count}</dd>
                </div>
                <div>
                  <dt>Temps</dt>
                  <dd>{picked.count === 0 ? "–" : fmtDuration(picked.minutes)}</dd>
                </div>
                <div>
                  <dt>Allure</dt>
                  <dd>{picked.pace === null ? "–" : `${fmtPace(picked.pace)} /km`}</dd>
                </div>
                {picked.elevation !== null && (
                  <div>
                    <dt>Dénivelé</dt>
                    <dd>{picked.elevation} m</dd>
                  </div>
                )}
                {picked.hr !== null && (
                  <div>
                    <dt>FC moy.</dt>
                    <dd>{Math.round(picked.hr)} bpm</dd>
                  </div>
                )}
              </dl>
            </div>
          </section>

          <section className="card chart-card" aria-labelledby="chart-pace">
            <h2 id="chart-pace" className="card__title">
              {tMetric === "pace" ? "Allure moyenne" : "Fréquence cardiaque"}
            </h2>
            {extras.hr !== null && (
              <div className="segmented" role="group" aria-label="Mesure">
                <button type="button" aria-pressed={tMetric === "pace"} onClick={() => setTrendMetric("pace")}>
                  Allure
                </button>
                <button type="button" aria-pressed={tMetric === "hr"} onClick={() => setTrendMetric("hr")}>
                  Fréquence cardiaque
                </button>
              </div>
            )}
            <TrendChart buckets={view} grain={grain} selected={selected} onSelect={setSelPick} metric={tMetric} />
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="stat">
      <dt>{label}</dt>
      <dd>
        {value}
        {unit && value !== "–" && (
          <>
            {" "}
            <small>{unit}</small>
          </>
        )}
      </dd>
    </div>
  );
}
