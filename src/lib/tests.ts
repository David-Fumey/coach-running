// Séance de contrôle : un 5 km chronométré, ou 30 minutes à fond, qui recale les allures cibles. TypeScript pur.
//
// Le plan place un test au début de la phase de construction et au début de la phase spécifique. Le temps sur les
// 5 km (relevé par Strava dans la sortie, ou saisi à la main) donne le niveau du coureur, plus précis que la moyenne
// de ses sorties : il sert alors de référence aux allures, après la saisie manuelle de l'allure moyenne.

import { addDays, diffDays, type Plan, type Session } from "./plan.ts";
import type { Activity } from "./activities.ts";
import { parseGoalTime } from "./goal.ts";

export interface TestResult {
  id: string;
  /** AAAA-MM-JJ du test */
  date: string;
  /** Durée du test, en minutes : le temps sur 5 km, ou 30 pour le test de 30 minutes */
  minutes: number;
  /** Distance parcourue (test de 30 minutes) ; absente pour le 5 km */
  km?: number;
  /** Séance de test du plan, s'il y en a une */
  sessionId?: string;
}

export const TEST_KM = 5;
/** Durée du test « 30 minutes à fond » */
export const TEST30_MINUTES = 30;
/** Distance plausible sur 30 minutes : de 3:00 à 12:00 par km */
export const TEST30_BOUNDS = { min: 2.5, max: 10 };

/** Distance de la performance : 5 km, ou ce qui a été couru en 30 minutes. */
export const testKm = (t: Pick<TestResult, "km">) => t.km ?? TEST_KM;
export type TestKind = "5k" | "30min";
/** Un test plus ancien que cela passe après les sorties récentes pour fixer les allures. */
export const TEST_FRESH_DAYS = 84;
/** Une séance de test non renseignée n'est plus proposée au bout de ce délai. */
export const TEST_PROMPT_DAYS = 21;
/** Allures plausibles : de 3:00 à 12:00 par km, comme ailleurs dans l'application. */
export const TEST_BOUNDS = { min: 15, max: 60 };

export const isValidTestMinutes = (m: unknown): m is number => typeof m === "number" && Number.isFinite(m) && m >= TEST_BOUNDS.min && m <= TEST_BOUNDS.max;

export const isValidTestKm = (km: unknown): km is number => typeof km === "number" && Number.isFinite(km) && km >= TEST30_BOUNDS.min && km <= TEST30_BOUNDS.max;

export function validTest(t: unknown): t is TestResult {
  if (typeof t !== "object" || t === null) return false;
  const { id, date, minutes, km, sessionId } = t as Record<string, unknown>;
  if (typeof id !== "string" || id === "" || typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  if (sessionId !== undefined && typeof sessionId !== "string") return false;
  // 30 minutes à fond : durée de 30 minutes et distance plausible ; sinon un temps sur 5 km.
  return km === undefined ? isValidTestMinutes(minutes) : minutes === TEST30_MINUTES && isValidTestKm(km);
}

/** « 6,8 » ou « 6.8 km » → 6,8 ; null si ce n'est pas une distance plausible sur 30 minutes. */
export function parseTestDistance(raw: string): number | null {
  const m = /^(\d{1,2}(?:[.,]\d{1,3})?)\s*(?:km)?$/i.exec(raw.trim());
  if (!m) return null;
  const km = Number(m[1].replace(",", "."));
  return isValidTestKm(km) ? km : null;
}

/** « 24:30 » → 24,5 minutes ; null si ce n'est pas un temps plausible sur 5 km. */
export function parseTestTime(raw: string): number | null {
  const m = parseGoalTime(raw, "5k");
  return m !== null && isValidTestMinutes(m) ? m : null;
}

/** Le test le plus récent. */
export function latestTest(tests: TestResult[]): TestResult | null {
  return tests.reduce<TestResult | null>((best, t) => (best === null || t.date > best.date || (t.date === best.date && t.id > best.id) ? t : best), null);
}

/** Ajoute un résultat ; un second résultat pour la même séance remplace le premier. */
export function withTest(tests: TestResult[], t: TestResult): TestResult[] {
  return [...tests.filter((x) => x.id !== t.id && (t.sessionId === undefined || x.sessionId !== t.sessionId)), t];
}

/** Nature du test d'une séance du plan. */
export const testKindOf = (s: Session): TestKind => (s.workout?.format === "test-30" ? "30min" : "5k");

export interface PendingTest {
  session: Session;
  kind: TestKind;
  /** Sortie liée à la séance, si elle est enregistrée */
  activity?: Activity;
  /** Meilleur 5 km relevé par Strava dans cette sortie, en minutes */
  stravaMinutes?: number;
}

/** Séance de test récente (aujourd'hui ou avant) dont le temps n'est pas encore renseigné. */
export function pendingTest(plan: Plan, activities: Activity[], tests: TestResult[], today: string): PendingTest | null {
  const sessions = plan.weeks.flatMap((w) => w.sessions).filter((s) => s.type === "test" && s.date <= today && diffDays(s.date, today) <= TEST_PROMPT_DAYS);
  const open = sessions.filter((s) => !tests.some((t) => t.sessionId === s.id)).sort((a, b) => b.date.localeCompare(a.date));
  const session = open[0];
  if (!session) return null;
  const activity = activities.find((a) => a.sessionId === session.id) ?? activities.find((a) => a.date === session.date);
  const kind = testKindOf(session);
  const strava = kind === "5k" ? activity?.efforts?.["5k"] : undefined;
  return { session, kind, activity, ...(strava !== undefined && isValidTestMinutes(strava) ? { stravaMinutes: strava } : {}) };
}

/** Prochaine séance de test du plan (à partir d'aujourd'hui), ou null. */
export function nextTestSession(plan: Plan, today: string): Session | null {
  const list = plan.weeks.flatMap((w) => w.sessions).filter((s) => s.type === "test" && s.date >= today);
  return list.sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
}

/** Date limite jusqu'à laquelle un test fait foi avant d'être dépassé par les sorties récentes. */
export const freshUntil = (t: TestResult) => addDays(t.date, TEST_FRESH_DAYS);
