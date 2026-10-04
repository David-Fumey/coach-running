// Progrès : regroupement des activités par jour, semaine, mois ou année. TypeScript pur, sans mise en forme
// (les libellés dépendent de la langue et restent dans l'interface).

import { addDays, parseISO, toISO, weekdayIndex, type Plan } from "./plan.ts";
import type { Activity } from "./activities.ts";

/** « Programme » : les activités de la période du plan en cours. « Total » : tout ce qui est enregistré. */
export type Scope = "programme" | "total";
export type Grain = "jour" | "semaine" | "mois" | "annee";

/** Nombre de périodes affichées d'un coup ; le reste s'atteint avec les flèches. */
export const WINDOW_SIZE: Record<Grain, number> = { jour: 30, semaine: 24, mois: 12, annee: 8 };

export interface Bucket {
  /** Premier jour de la période (le jour même, le lundi, le 1er du mois ou le 1er janvier) */
  start: string;
  /** Dernier jour de la période */
  end: string;
  km: number;
  minutes: number;
  count: number;
  /** min/km moyen de la période, null sans course */
  pace: number | null;
  /** Dénivelé positif cumulé en mètres, null si aucune sortie de la période n'a de dénivelé enregistré */
  elevation: number | null;
  /** Fréquence cardiaque moyenne (pondérée par la durée des sorties qui en ont une), null sans donnée */
  hr: number | null;
  /** Kilomètres prévus au plan sur la période (portée « programme » seulement) */
  plannedKm: number | null;
  /** La période commence après aujourd'hui */
  future: boolean;
  /** Aujourd'hui est dans la période */
  current: boolean;
}

interface Acc {
  km: number;
  minutes: number;
  count: number;
  planned: number;
  elevation: number;
  hasElevation: boolean;
  hrWeighted: number;
  hrMinutes: number;
}

const newAcc = (): Acc => ({ km: 0, minutes: 0, count: 0, planned: 0, elevation: 0, hasElevation: false, hrWeighted: 0, hrMinutes: 0 });

export function startOf(date: string, grain: Grain): string {
  if (grain === "jour") return date;
  if (grain === "semaine") return addDays(date, -weekdayIndex(date));
  return grain === "mois" ? `${date.slice(0, 7)}-01` : `${date.slice(0, 4)}-01-01`;
}

/** Début de la période suivante. */
export function nextStart(start: string, grain: Grain): string {
  if (grain === "jour") return addDays(start, 1);
  if (grain === "semaine") return addDays(start, 7);
  const d = parseISO(start);
  if (grain === "mois") d.setUTCMonth(d.getUTCMonth() + 1);
  else d.setUTCFullYear(d.getUTCFullYear() + 1);
  return toISO(d);
}

/** Période du plan : de son premier jour à la date de la course. */
export function planRange(plan: Plan): { from: string; to: string } {
  return { from: plan.weeks[0].startDate, to: plan.input.raceDate };
}

export function inScope(plan: Plan, activities: Activity[], scope: Scope): Activity[] {
  if (scope === "total") return activities;
  const { from, to } = planRange(plan);
  return activities.filter((a) => a.date >= from && a.date <= to);
}

/**
 * Toutes les périodes de la portée, sans trou (une période sans course vaut zéro), de la plus ancienne à la plus récente.
 * - Programme : du début du plan à la course.
 * - Total : de la première activité à aujourd'hui ; vide s'il n'y a aucune activité.
 */
export function bucketsOf(plan: Plan, activities: Activity[], scope: Scope, grain: Grain, today: string): Bucket[] {
  const scoped = inScope(plan, activities, scope);
  let first: string;
  let last: string;
  if (scope === "programme") {
    const r = planRange(plan);
    first = r.from;
    last = r.to;
  } else {
    if (scoped.length === 0) return [];
    first = scoped.reduce((m, a) => (a.date < m ? a.date : m), scoped[0].date);
    last = scoped.reduce((m, a) => (a.date > m ? a.date : m), today);
  }

  const acc = new Map<string, Acc>();
  const slot = (date: string) => {
    const key = startOf(date, grain);
    let s = acc.get(key);
    if (!s) acc.set(key, (s = newAcc()));
    return s;
  };
  for (const a of scoped) {
    const s = slot(a.date);
    s.km += a.km;
    s.minutes += a.minutes;
    s.count++;
    if (a.elevation !== undefined) {
      s.elevation += a.elevation;
      s.hasElevation = true;
    }
    if (a.avgHr !== undefined) {
      s.hrWeighted += a.avgHr * a.minutes;
      s.hrMinutes += a.minutes;
    }
  }
  if (scope === "programme") {
    for (const w of plan.weeks) for (const x of w.sessions) slot(x.date).planned += x.km;
  }

  const out: Bucket[] = [];
  const stop = startOf(last, grain);
  for (let start = startOf(first, grain); start <= stop; start = nextStart(start, grain)) {
    const s = acc.get(start) ?? newAcc();
    const next = nextStart(start, grain);
    out.push({
      start,
      end: addDays(next, -1),
      km: s.km,
      minutes: s.minutes,
      count: s.count,
      pace: s.km > 0 ? s.minutes / s.km : null,
      elevation: s.hasElevation ? s.elevation : null,
      hr: s.hrMinutes > 0 ? s.hrWeighted / s.hrMinutes : null,
      plannedKm: scope === "programme" ? s.planned : null,
      future: start > today,
      current: start <= today && today < next,
    });
  }
  return out;
}

export interface Extras {
  /** Dénivelé positif cumulé en mètres, null si aucune activité n'en a */
  elevation: number | null;
  /** Fréquence cardiaque moyenne pondérée par la durée, null sans donnée */
  hr: number | null;
}

/** Dénivelé et fréquence cardiaque d'un ensemble d'activités (celles sans donnée sont laissées de côté). */
export function extrasOf(activities: Activity[]): Extras {
  let elevation: number | null = null;
  let weighted = 0;
  let minutes = 0;
  for (const a of activities) {
    if (a.elevation !== undefined) elevation = (elevation ?? 0) + a.elevation;
    if (a.avgHr !== undefined) {
      weighted += a.avgHr * a.minutes;
      minutes += a.minutes;
    }
  }
  return { elevation, hr: minutes > 0 ? weighted / minutes : null };
}

/** Garde la fenêtre de `size` périodes dans les limites. */
export function clampStart(count: number, size: number, start: number): number {
  return Math.max(0, Math.min(start, count - size));
}

/** Fenêtre de départ : la plus récente, ou autour d'aujourd'hui pour le programme. */
export function defaultStart(buckets: Bucket[], size: number, scope: Scope): number {
  if (scope === "total") return clampStart(buckets.length, size, buckets.length - size);
  const now = buckets.findIndex((b) => b.current);
  if (now >= 0) return clampStart(buckets.length, size, now - Math.floor(size / 2));
  // Le plan n'a pas commencé : début ; le plan est terminé : fin.
  return buckets.length > 0 && buckets[0].future ? 0 : clampStart(buckets.length, size, buckets.length - size);
}

/** Index de la période à sélectionner au départ dans la fenêtre : la période en cours, sinon la dernière avec des sorties. */
export function defaultSelection(window: Bucket[]): number {
  const now = window.findIndex((b) => b.current);
  if (now >= 0) return now;
  for (let i = window.length - 1; i >= 0; i--) if (window[i].count > 0) return i;
  return Math.max(0, window.length - 1);
}

/** Graduations « rondes » de 0 jusqu'au premier multiple du pas au-dessus du maximum. */
export function niceTicks(max: number, target = 4): { ticks: number[]; top: number } {
  const raw = Math.max(max, 1) / target;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? 10 * pow);
  const top = Math.ceil(Math.max(max, 1) / step) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 1000; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return { ticks, top };
}
