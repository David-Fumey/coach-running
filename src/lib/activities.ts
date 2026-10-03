// Activités enregistrées et statistiques. TypeScript pur, comme le moteur de plan.

import { addDays, diffDays, type Plan } from "./plan.ts";

export interface Activity {
  id: string;
  /** AAAA-MM-JJ */
  date: string;
  km: number;
  minutes: number;
  /** Séance du plan réalisée, s'il y en a une */
  sessionId?: string;
  /** Ressenti de 1 (très dur) à 5 (excellent) */
  feeling?: 1 | 2 | 3 | 4 | 5;
  note?: string;
}

export const FEELINGS: Record<number, string> = {
  1: "Très dur",
  2: "Dur",
  3: "Correct",
  4: "Bien",
  5: "Excellent",
};

export const paceOf = (a: Pick<Activity, "km" | "minutes">) => a.minutes / a.km;

export interface WeekTotal {
  index: number;
  startDate: string;
  plannedKm: number;
  actualKm: number;
}

/** Kilomètres prévus et courus pour chaque semaine du plan (toutes les activités, liées au plan ou non). */
export function weeklyTotals(plan: Plan, activities: Activity[]): WeekTotal[] {
  return plan.weeks.map((w) => {
    const end = addDays(w.startDate, 6);
    const actualKm = activities
      .filter((a) => a.date >= w.startDate && a.date <= end)
      .reduce((acc, a) => acc + a.km, 0);
    return { index: w.index, startDate: w.startDate, plannedKm: w.totalKm, actualKm };
  });
}

export interface Summary {
  count: number;
  km: number;
  minutes: number;
  /** min/km moyen, null sans activité */
  avgPace: number | null;
  longestKm: number;
  /** Part des séances échues (avant aujourd'hui) qui ont été faites, null si aucune n'est échue */
  adherence: number | null;
}

export function summarize(plan: Plan, activities: Activity[], done: Record<string, boolean>, today: string): Summary {
  const km = activities.reduce((acc, a) => acc + a.km, 0);
  const minutes = activities.reduce((acc, a) => acc + a.minutes, 0);
  const due = plan.weeks.flatMap((w) => w.sessions).filter((s) => diffDays(s.date, today) > 0);
  return {
    count: activities.length,
    km,
    minutes,
    avgPace: km > 0 ? minutes / km : null,
    longestKm: activities.reduce((m, a) => Math.max(m, a.km), 0),
    adherence: due.length > 0 ? due.filter((s) => done[s.id]).length / due.length : null,
  };
}

/** Plus récentes d'abord. */
export const byDateDesc = (a: Activity, b: Activity) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id);

/** « 1:05:30 », « 42:10 » ou « 45 » (minutes) → minutes décimales, null si invalide. */
export function parseMinutes(raw: string): number | null {
  const parts = raw.trim().replace(",", ".").split(":");
  if (parts.length > 3 || parts.some((p) => p === "" || !/^\d+(\.\d+)?$/.test(p))) return null;
  const n = parts.map(Number);
  if (n.length === 1) return n[0];
  if (n.length === 2) return n[0] + n[1] / 60;
  return n[0] * 60 + n[1] + n[2] / 60;
}

export interface Tracked {
  activities: Activity[];
  done: Record<string, boolean>;
}

/** Une séance liée est faite ; elle ne l'est plus quand plus aucune activité n'y est liée. */
function releaseSession(state: Tracked, sessionId: string | undefined): Tracked {
  if (!sessionId || state.activities.some((a) => a.sessionId === sessionId)) return state;
  const done = { ...state.done };
  delete done[sessionId];
  return { activities: state.activities, done };
}

export function addActivity(state: Tracked, activity: Activity): Tracked {
  return {
    activities: [...state.activities, activity],
    done: activity.sessionId ? { ...state.done, [activity.sessionId]: true } : state.done,
  };
}

export function removeActivity(state: Tracked, id: string): Tracked {
  const removed = state.activities.find((a) => a.id === id);
  if (!removed) return state;
  return releaseSession({ activities: state.activities.filter((a) => a.id !== id), done: state.done }, removed.sessionId);
}

/** Remplace l'activité de même id ; gère le changement de séance liée. */
export function updateActivity(state: Tracked, next: Activity): Tracked {
  const prev = state.activities.find((a) => a.id === next.id);
  if (!prev) return state;
  const replaced: Tracked = {
    activities: state.activities.map((a) => (a.id === next.id ? next : a)),
    done: next.sessionId ? { ...state.done, [next.sessionId]: true } : state.done,
  };
  return prev.sessionId !== next.sessionId ? releaseSession(replaced, prev.sessionId) : replaced;
}
