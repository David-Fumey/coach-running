// Activités enregistrées et statistiques. TypeScript pur, comme le moteur de plan.

import { addDays, diffDays, type Plan } from "./plan.ts";

/** Distances dont on garde le meilleur effort au sein d'une sortie. */
export type EffortKey = "5k" | "10k" | "semi" | "marathon";
/** Meilleur temps (en minutes) sur chaque distance, à l'intérieur de la sortie. Objet vide : détail lu, aucun effort. */
export type Efforts = Partial<Record<EffortKey, number>>;

/** Un kilomètre de la sortie (le dernier peut être partiel). */
export interface Split {
  /** Distance du tronçon, en km */
  km: number;
  /** Temps en mouvement, en secondes */
  seconds: number;
  /** Fréquence cardiaque moyenne du tronçon */
  hr?: number;
  /** Dénivelé du tronçon en mètres (négatif en descente) */
  elev?: number;
}

/** Détail d'une sortie importée, lu une fois dans l'activité Strava. `splits` vide : détail lu, rien de plus. */
export interface RunDetail {
  splits: Split[];
  calories?: number;
  /** Cadence moyenne, en pas par minute */
  cadence?: number;
  /** Durée totale arrêts compris, en minutes */
  elapsedMinutes?: number;
  /** Montre ou appareil d'enregistrement */
  device?: string;
  /** Courbes dans le temps (lues à part ; absentes tant qu'elles n'ont pas été lues) */
  series?: Series;
}

/**
 * Courbes d'une sortie, ramenées à une centaine de points. Les tableaux ont tous la longueur de `t`.
 * 0 = valeur inconnue (arrêt, pas de capteur). `t` vide : courbes lues, aucune disponible.
 */
export interface Series {
  /** Secondes depuis le départ */
  t: number[];
  /** Fréquence cardiaque, bpm */
  hr?: number[];
  /** Allure, secondes par km */
  pace?: number[];
  /** Altitude, mètres */
  alt?: number[];
}

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
  /** Origine d'une activité importée ('strava') ; absent pour une saisie à la main */
  source?: string;
  /** Identifiant dans le service d'origine, pour ne jamais importer deux fois la même sortie */
  externalId?: string;
  /** Fréquence cardiaque moyenne et maximale, en battements par minute (importées) */
  avgHr?: number;
  maxHr?: number;
  /** Dénivelé positif en mètres (importé) */
  elevation?: number;
  /** Meilleurs efforts de la sortie (importés ; absent tant que le détail n'a pas été lu) */
  efforts?: Efforts;
  /** Température moyenne relevée par la montre, en °C (importée) ; null = détail lu, pas de capteur ; absent = pas encore lu */
  temp?: number | null;
  /** Temps par kilomètre, cadence, calories… (importés ; absent tant que le détail n'a pas été lu) */
  detail?: RunDetail;
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

/** Les activités d'un mois civil, du plus récent au plus ancien. */
export interface MonthGroup {
  /** « AAAA-MM » */
  month: string;
  activities: Activity[];
  km: number;
  minutes: number;
}

/** Regroupe les activités par mois (le plus récent d'abord) ; chaque mois garde l'ordre du plus récent au plus ancien. */
export function groupByMonth(activities: Activity[]): MonthGroup[] {
  const groups = new Map<string, MonthGroup>();
  for (const a of [...activities].sort(byDateDesc)) {
    const month = a.date.slice(0, 7);
    const g = groups.get(month) ?? { month, activities: [], km: 0, minutes: 0 };
    g.activities.push(a);
    g.km += a.km;
    g.minutes += a.minutes;
    groups.set(month, g);
  }
  return [...groups.values()].map((g) => ({ ...g, km: Math.round(g.km * 100) / 100, minutes: Math.round(g.minutes * 100) / 100 }));
}

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
