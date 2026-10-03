// Records personnels calculés à partir des activités enregistrées. TypeScript pur.
//
// Une activité n'a ni tours ni temps intermédiaires. Sans autre donnée, un record de distance vient donc
// d'une sortie dont la distance est proche de la distance visée (ni plus courte de 2 %, ni plus longue
// de 6 %) ; son temps est ramené à la distance exacte. Les meilleurs efforts mesurés par Strava au sein
// d'une sortie plus longue (`Activity.efforts`) s'y ajoutent quand ils ont été importés.

import { addDays, diffDays } from "./plan.ts";
import { startOf } from "./progress.ts";
import type { Activity, EffortKey } from "./activities.ts";

export type TargetId = EffortKey;

export const TARGETS: { id: TargetId; label: string; km: number }[] = [
  { id: "5k", label: "5 km", km: 5 },
  { id: "10k", label: "10 km", km: 10 },
  { id: "semi", label: "Semi-marathon", km: 21.0975 },
  { id: "marathon", label: "Marathon", km: 42.195 },
];

/** Une sortie compte pour une distance si elle est comprise entre ces proportions de la distance visée. */
export const MIN_RATIO = 0.98;
export const MAX_RATIO = 1.06;
/** En dessous de cet écart, le temps n'est pas considéré comme « ramené ». */
const EXACT_TOLERANCE = 0.01;
/** Distance minimale pour la meilleure allure : en dessous, c'est un sprint, pas un record d'endurance. */
export const MIN_PACE_KM = 5;

export interface Attempt {
  activityId: string;
  date: string;
  /** Temps sur la distance visée, en minutes */
  minutes: number;
  /** Distance réellement courue */
  km: number;
  /** Faux si le temps a été ramené à la distance visée (sortie un peu plus longue ou plus courte) */
  exact: boolean;
  /** Vrai si c'est un meilleur effort mesuré au sein de la sortie (km est alors la longueur de la sortie) */
  fromEffort?: boolean;
}

export interface DistanceRecord {
  id: TargetId;
  label: string;
  km: number;
  /** Nombre de sorties comptant pour cette distance (efforts mesurés compris) */
  attempts: number;
  best: Attempt | null;
  /** Meilleur temps obtenu avant le record, null si c'est la première fois */
  previous: number | null;
}

export function attemptsFor(activities: Activity[], km: number): Attempt[] {
  return activities
    .filter((a) => a.km >= km * MIN_RATIO && a.km <= km * MAX_RATIO && a.minutes > 0)
    .map((a) => ({
      activityId: a.id,
      date: a.date,
      minutes: (a.minutes / a.km) * km,
      km: a.km,
      exact: Math.abs(a.km - km) <= km * EXACT_TOLERANCE,
    }));
}

/** Meilleur temps ; à égalité, la plus ancienne. */
function fastest(list: Attempt[]): Attempt | null {
  let best: Attempt | null = null;
  for (const a of list) {
    if (best === null || a.minutes < best.minutes - 1e-9 || (Math.abs(a.minutes - best.minutes) <= 1e-9 && a.date < best.date)) best = a;
  }
  return best;
}

/**
 * Résultats comptant pour une distance : la sortie entière si elle est proche de cette distance, et/ou le meilleur
 * effort mesuré dans la sortie. Une même sortie ne compte qu'une fois, avec son meilleur temps.
 */
export function attemptsOf(activities: Activity[], target: { id: TargetId; km: number }): Attempt[] {
  const whole = new Map(attemptsFor(activities, target.km).map((a) => [a.activityId, a]));
  for (const a of activities) {
    const minutes = a.efforts?.[target.id];
    if (minutes === undefined || !(minutes > 0)) continue;
    const have = whole.get(a.id);
    if (!have || minutes < have.minutes) whole.set(a.id, { activityId: a.id, date: a.date, minutes, km: a.km, exact: true, fromEffort: true });
  }
  return [...whole.values()];
}

export function distanceRecords(activities: Activity[]): DistanceRecord[] {
  return TARGETS.map((t) => {
    const list = attemptsOf(activities, t);
    const best = fastest(list);
    const before = best ? fastest(list.filter((a) => a.date < best.date)) : null;
    return { id: t.id, label: t.label, km: t.km, attempts: list.length, best, previous: before ? before.minutes : null };
  });
}

// ---------- Autres records ----------

export type HighlightId = "longest" | "duration" | "pace" | "elevation" | "week" | "month" | "streak";

export interface Highlight {
  id: HighlightId;
  label: string;
  /** km, minutes, min/km, mètres ou nombre de semaines selon `unit` */
  value: number;
  unit: "km" | "min" | "min/km" | "m" | "semaines";
  /** Jour du record, ou premier jour de la période */
  date: string;
  /** Dernier jour d'une période ou d'une série */
  endDate?: string;
}

function maxBy(list: Activity[], key: (a: Activity) => number): Activity | null {
  let best: Activity | null = null;
  for (const a of list) if (best === null || key(a) > key(best) || (key(a) === key(best) && a.date < best.date)) best = a;
  return best;
}

/** Période (semaine ou mois) où le total de kilomètres est le plus grand. */
function busiest(activities: Activity[], grain: "semaine" | "mois"): { start: string; km: number } | null {
  const totals = new Map<string, number>();
  for (const a of activities) {
    const k = startOf(a.date, grain);
    totals.set(k, (totals.get(k) ?? 0) + a.km);
  }
  let best: { start: string; km: number } | null = null;
  for (const [start, km] of totals) if (best === null || km > best.km + 1e-9 || (Math.abs(km - best.km) <= 1e-9 && start < best.start)) best = { start, km };
  return best;
}

/** Plus longue suite de semaines consécutives avec au moins une sortie. */
export function longestStreak(activities: Activity[]): { weeks: number; start: string; end: string } | null {
  const weeks = [...new Set(activities.map((a) => startOf(a.date, "semaine")))].sort();
  if (weeks.length === 0) return null;
  let best = { weeks: 1, start: weeks[0], end: weeks[0] };
  let run = { weeks: 1, start: weeks[0], end: weeks[0] };
  for (let i = 1; i < weeks.length; i++) {
    if (weeks[i] === addDays(weeks[i - 1], 7)) run = { weeks: run.weeks + 1, start: run.start, end: weeks[i] };
    else run = { weeks: 1, start: weeks[i], end: weeks[i] };
    if (run.weeks > best.weeks) best = run;
  }
  return { weeks: best.weeks, start: best.start, end: addDays(best.end, 6) };
}

/** Série de semaines en cours : celle qui se termine cette semaine ou la précédente (on a encore le temps de courir). */
export function currentStreak(activities: Activity[], today: string): number {
  const weeks = new Set(activities.map((a) => startOf(a.date, "semaine")));
  let cursor = startOf(today, "semaine");
  if (!weeks.has(cursor)) cursor = addDays(cursor, -7);
  let n = 0;
  while (weeks.has(cursor)) {
    n++;
    cursor = addDays(cursor, -7);
  }
  return n;
}

export function highlights(activities: Activity[]): Highlight[] {
  const out: Highlight[] = [];
  const longest = maxBy(activities, (a) => a.km);
  if (longest) out.push({ id: "longest", label: "Sortie la plus longue", value: longest.km, unit: "km", date: longest.date });

  const duration = maxBy(activities, (a) => a.minutes);
  if (duration) out.push({ id: "duration", label: "Sortie la plus longue en durée", value: duration.minutes, unit: "min", date: duration.date });

  const fast = activities.filter((a) => a.km >= MIN_PACE_KM && a.minutes > 0);
  const pace = maxBy(fast, (a) => -(a.minutes / a.km));
  if (pace) out.push({ id: "pace", label: `Meilleure allure (sortie de ${MIN_PACE_KM} km ou plus)`, value: pace.minutes / pace.km, unit: "min/km", date: pace.date });

  const climb = maxBy(activities.filter((a) => a.elevation !== undefined), (a) => a.elevation!);
  if (climb && climb.elevation! > 0) out.push({ id: "elevation", label: "Plus gros dénivelé sur une sortie", value: climb.elevation!, unit: "m", date: climb.date });

  const week = busiest(activities, "semaine");
  if (week) out.push({ id: "week", label: "Semaine la plus chargée", value: week.km, unit: "km", date: week.start, endDate: addDays(week.start, 6) });

  const month = busiest(activities, "mois");
  if (month) {
    const next = new Date(`${month.start}T00:00:00Z`);
    next.setUTCMonth(next.getUTCMonth() + 1);
    out.push({ id: "month", label: "Mois le plus chargé", value: month.km, unit: "km", date: month.start, endDate: addDays(next.toISOString().slice(0, 10), -1) });
  }

  const streak = longestStreak(activities);
  if (streak && streak.weeks >= 2) out.push({ id: "streak", label: "Plus longue série de semaines avec sortie", value: streak.weeks, unit: "semaines", date: streak.start, endDate: streak.end });
  return out;
}

/** Un record est « récent » s'il date de moins de `days` jours. */
export function isRecent(date: string, today: string, days = 14): boolean {
  const d = diffDays(date, today);
  return d >= 0 && d <= days;
}
