// Allures cibles par type de séance, déduites de la moyenne des sorties déjà enregistrées. TypeScript pur.
//
// Méthode : l'allure moyenne d'entraînement (kilomètres et temps cumulés des sorties récentes) correspond, pour un
// coureur qui mêle surtout du facile et un peu d'intensité, à environ 70 % de sa capacité aérobie maximale. On en
// remonte à un « niveau » (VDOT de Daniels), puis on redescend vers chaque type d'effort avec ses propres pourcentages.
// Ce sont des repères à ajuster à l'effort ressenti, pas des prescriptions : un coureur qui ne fait que du facile verra
// ses allures sous-estimées, un autre qui court toujours vite les verra surestimées.

import type { Intensity, Plan, RaceKey, Session, Workout } from "./plan.ts";
import { TEST_FRESH_DAYS, TEST_KM, type TestResult } from "./tests.ts";
import { diffDays } from "./plan.ts";
import type { Activity } from "./activities.ts";
import { RACE_KM, goalPace, vdotFromRace, type Goal } from "./goal.ts";

/** Sorties plus courtes que cela : exclues de la moyenne (échauffements, marche, sorties de test). */
export const MIN_RUN_KM = 3;
/** Fenêtre des sorties récentes, en jours. */
export const RECENT_DAYS = 56;
/** Nombre minimal de sorties pour estimer un niveau. */
export const MIN_RUNS = 4;
/** À défaut de sorties récentes en nombre suffisant, on prend les plus récentes dans la limite de ce nombre. */
export const FALLBACK_RUNS = 12;
/** Fraction de la capacité aérobie que représente une allure moyenne d'entraînement. */
export const AVERAGE_FRACTION = 0.7;
/** Une sortie est écartée si son allure s'éloigne trop de la médiane (marche, erreur d'enregistrement). */
const OUTLIER_SLOW = 1.4;
const OUTLIER_FAST = 0.7;
/** Allures plausibles d'un coureur, en min/km. */
export const PACE_BOUNDS = { min: 3, max: 12 };
const VDOT_BOUNDS = { min: 25, max: 85 };
/** Marge avant de dire qu'une sortie est hors de la cible, en secondes par km. */
const GRACE_SECONDS = 3;

// ---------- Niveau ----------

/** Consommation d'oxygène (ml/kg/min) à la vitesse v (m/min), équation de Daniels et Gilbert. */
const vo2 = (v: number) => -4.6 + 0.182258 * v + 0.000104 * v * v;

/** Vitesse (m/min) pour une consommation d'oxygène donnée. */
function velocityAt(vo2Target: number): number {
  const a = 0.000104;
  const b = 0.182258;
  return (-b + Math.sqrt(b * b + 4 * a * (4.6 + vo2Target))) / (2 * a);
}

/** Niveau (VDOT) d'un coureur dont l'allure moyenne d'entraînement est `pace` (min/km). */
export function vdotFromAveragePace(pace: number): number {
  const vdot = vo2(1000 / pace) / AVERAGE_FRACTION;
  return Math.min(VDOT_BOUNDS.max, Math.max(VDOT_BOUNDS.min, vdot));
}

/** Allure (min/km) tenue à `fraction` de la capacité aérobie. */
export function paceAt(vdot: number, fraction: number): number {
  return 1000 / velocityAt(vdot * fraction);
}

// ---------- Zones ----------

export type ZoneId = "recuperation" | "facile" | "marathon" | "semi" | "seuil" | "10k" | "5k";

/** Pourcentages de la capacité aérobie, du plus lent au plus rapide. */
export const ZONES: Record<ZoneId, { label: string; slow: number; fast: number }> = {
  recuperation: { label: "Très facile", slow: 0.56, fast: 0.62 },
  facile: { label: "Facile", slow: 0.62, fast: 0.7 },
  marathon: { label: "Allure marathon", slow: 0.79, fast: 0.83 },
  semi: { label: "Allure semi-marathon", slow: 0.86, fast: 0.89 },
  seuil: { label: "Allure seuil", slow: 0.86, fast: 0.9 },
  "10k": { label: "Allure 10 km", slow: 0.92, fast: 0.95 },
  "5k": { label: "Allure 5 km", slow: 0.95, fast: 0.98 },
};

/** Ordre d'affichage, du plus lent au plus rapide. */
export const ZONE_ORDER: ZoneId[] = ["recuperation", "facile", "marathon", "semi", "seuil", "10k", "5k"];

export interface PaceRange {
  /** Allure la plus lente de la fourchette, en min/km */
  slow: number;
  /** Allure la plus rapide de la fourchette, en min/km */
  fast: number;
}

export function zoneRange(vdot: number, zone: ZoneId, fasterBy = 0): PaceRange {
  const z = ZONES[zone];
  return { slow: paceAt(vdot, z.slow), fast: paceAt(vdot, Math.min(1, z.fast + fasterBy)) };
}

const RACE_ZONE: Record<RaceKey, ZoneId> = { "5k": "5k", "10k": "10k", semi: "semi", marathon: "marathon" };

// ---------- Référence : la moyenne des sorties ----------

/** « objectif » : ni sorties ni saisie, le niveau vient du temps objectif de course. */
export type ReferenceSource = "manuelle" | "test" | "recentes" | "dernieres" | "objectif";

export interface Reference {
  /** Allure moyenne d'entraînement, en min/km */
  pace: number;
  source: ReferenceSource;
  /** Sorties retenues (0 si saisie à la main) */
  runs: number;
  km: number;
  /** Test de 5 km qui sert de référence (source « test ») */
  test?: TestResult;
}

export interface PaceModel {
  reference: Reference;
  vdot: number;
  /** Temps objectif de la course du plan, s'il y en a un */
  goal: Goal | null;
}

const paceOfRun = (a: Activity) => a.minutes / a.km;

function median(sorted: number[]): number {
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
}

function averageOf(runs: Activity[]): { pace: number; km: number } {
  const km = runs.reduce((s, a) => s + a.km, 0);
  const minutes = runs.reduce((s, a) => s + a.minutes, 0);
  return { pace: minutes / km, km };
}

/**
 * Allure moyenne d'entraînement tirée des sorties enregistrées, ou null s'il y en a trop peu.
 * - Sorties d'au moins 3 km, hors valeurs aberrantes (par rapport à la médiane).
 * - Les 8 dernières semaines si elles comptent assez de sorties, sinon les plus récentes dans la limite de 12.
 * - Moyenne pondérée par la distance : kilomètres cumulés / temps cumulé.
 */
export function referenceFromActivities(activities: Activity[], today: string): Reference | null {
  const runs = activities.filter((a) => a.km >= MIN_RUN_KM && a.minutes > 0 && a.date <= today);
  if (runs.length < MIN_RUNS) return null;
  const paces = runs.map(paceOfRun).sort((a, b) => a - b);
  const mid = median(paces);
  const sane = runs.filter((a) => paceOfRun(a) <= mid * OUTLIER_SLOW && paceOfRun(a) >= mid * OUTLIER_FAST);
  const byDateDesc = [...sane].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

  const recent = byDateDesc.filter((a) => diffDays(a.date, today) <= RECENT_DAYS);
  let chosen: Activity[];
  let source: ReferenceSource;
  if (recent.length >= MIN_RUNS) {
    chosen = recent;
    source = "recentes";
  } else if (byDateDesc.length >= MIN_RUNS) {
    chosen = byDateDesc.slice(0, FALLBACK_RUNS);
    source = "dernieres";
  } else {
    return null;
  }
  const { pace, km } = averageOf(chosen);
  if (pace < PACE_BOUNDS.min || pace > PACE_BOUNDS.max) return null;
  return { pace, source, runs: chosen.length, km };
}

export const isValidPace = (p: unknown): p is number => typeof p === "number" && Number.isFinite(p) && p >= PACE_BOUNDS.min && p <= PACE_BOUNDS.max;

const clampVdot = (v: number) => Math.min(VDOT_BOUNDS.max, Math.max(VDOT_BOUNDS.min, v));

/**
 * Modèle d'allures : la saisie manuelle s'il y en a une, sinon la moyenne des sorties.
 * Sans l'un ni l'autre, le temps objectif de course sert de base ; sans rien, null.
 */
export function paceModel(activities: Activity[], today: string, manual: number | null, goal: Goal | null = null, test: TestResult | null = null): PaceModel | null {
  const fromTest = (t: TestResult): PaceModel => {
    const vdot = clampVdot(vdotFromRace(TEST_KM, t.minutes));
    return { reference: { pace: paceAt(vdot, AVERAGE_FRACTION), source: "test", runs: 1, km: TEST_KM, test: t }, vdot, goal };
  };
  const fresh = test !== null && diffDays(test.date, today) <= TEST_FRESH_DAYS;
  if (isValidPace(manual)) return { reference: { pace: manual, source: "manuelle", runs: 0, km: 0 }, vdot: vdotFromAveragePace(manual), goal };
  if (test && fresh) return fromTest(test);
  const reference = referenceFromActivities(activities, today);
  if (reference) return { reference, vdot: vdotFromAveragePace(reference.pace), goal };
  if (test) return fromTest(test);
  if (!goal) return null;
  const vdot = clampVdot(vdotFromRace(RACE_KM[goal.race], goal.minutes));
  return { reference: { pace: paceAt(vdot, AVERAGE_FRACTION), source: "objectif", runs: 0, km: 0 }, vdot, goal };
}

// ---------- Cibles par séance ----------

export interface PaceTarget extends PaceRange {
  label: string;
}

export interface SessionTargets {
  targets: PaceTarget[];
  /** Vrai si l'allure moyenne de la sortie entière peut être comparée à la cible (pas de fractionné ni de bloc rapide) */
  comparable: boolean;
}

/** Marge autour de l'allure objectif : 1 % de part et d'autre. */
const GOAL_MARGIN = 0.01;

interface Context {
  week: Plan["weeks"][number];
  race: RaceKey;
  raceZone: ZoneId;
  g: Goal | null;
  target: (label: string, zone: ZoneId, fasterBy?: number, level?: number) => PaceTarget;
  goalTarget: (label: string, fasterBy?: number) => PaceTarget;
  weekVdot: number;
}

function contextOf(model: PaceModel, plan: Plan, session: Session, goal: Goal | null): Context | null {
  const week = plan.weeks.find((w) => w.sessions.some((s) => s.id === session.id));
  if (!week) return null;
  const race = plan.input.race;
  const raceZone = RACE_ZONE[race];
  const v = model.vdot;
  const g = goal && goal.race === race ? goal : null;
  // Niveau demandé par l'objectif, et niveau d'entraînement de la semaine entre l'actuel et celui-là.
  const goalVdot = g ? clampVdot(vdotFromRace(RACE_KM[race], g.minutes)) : null;
  const buildWeeks = plan.weeks.filter((w) => w.phase !== "affutage" && w.phase !== "course").length;
  const progress = Math.min(1, week.index / Math.max(1, buildWeeks - 1));
  const weekVdot = goalVdot === null ? v : Math.max(v, v + (goalVdot - v) * progress);
  const target = (label: string, zone: ZoneId, fasterBy = 0, level = v): PaceTarget => ({ label, ...zoneRange(level, zone, fasterBy) });
  /** Allure de l'objectif ; `fasterBy` : part de l'allure en plus vite (0,02 = 2 %). */
  const goalTarget = (label: string, fasterBy = 0): PaceTarget => {
    const p = goalPace(g!);
    return { label, slow: p * (1 + GOAL_MARGIN), fast: p * (1 - GOAL_MARGIN - fasterBy) };
  };
  return { week, race, raceZone, g, target, goalTarget, weekVdot };
}

/** Allure cible d'une intensité de séance structurée (le travail monte vers l'objectif au fil de la construction). */
export function intensityTarget(model: PaceModel, plan: Plan, session: Session, intensity: Intensity, goal: Goal | null = model.goal): PaceTarget | null {
  const c = contextOf(model, plan, session, goal);
  if (!c) return null;
  const v = model.vdot;
  switch (intensity) {
    case "facile":
      return c.target("Allure facile", "facile");
    case "soutenu":
      return c.target("Effort soutenu", "10k");
    case "5k":
      return c.target("Allure 5 km", "5k", 0, c.weekVdot);
    case "10k":
      return c.target("Allure 10 km", "10k", 0, c.weekVdot);
    case "seuil":
      return c.target("Allure seuil", "seuil", 0, c.weekVdot);
    case "semi":
      return c.target(ZONES.semi.label, "semi", 0, v);
    case "marathon":
      return c.target(ZONES.marathon.label, "marathon", 0, v);
    case "course":
      return c.g ? c.goalTarget("Allure objectif") : c.target(ZONES[c.raceZone].label, c.raceZone);
    case "test":
      return null;
    case "coursePlus":
      return c.g ? c.goalTarget("Allure objectif ou un peu plus vite", 0.02) : c.target("Allure de course ou un peu plus vite", c.raceZone, 0.02);
  }
}

/** Intensités chronométrées d'un déroulé, dans l'ordre : ni le facile, ni l'effort au ressenti, ni les côtes. */
export function timedIntensities(w: Workout): Intensity[] {
  const out: Intensity[] = [];
  for (const set of w.sets) {
    const { intensity, hill } = set.work;
    if (hill || intensity === "facile" || intensity === "soutenu" || intensity === "test" || out.includes(intensity)) continue;
    out.push(intensity);
  }
  return out;
}

/**
 * Cibles d'une séance du plan, ou null quand l'effort ressenti suffit (fartlek, course sans objectif).
 * Avec un temps objectif pour cette course :
 * - les allures de course (blocs spécifiques, derniers km des sorties longues, jour J) sont celles de l'objectif ;
 * - les allures de travail (seuil, allure 10 km de la phase de construction) montent du niveau actuel vers le niveau
 *   que demande l'objectif, linéairement jusqu'à la fin de la phase de construction, sans jamais passer sous le niveau actuel ;
 * - le facile, la récupération et le facile des sorties longues restent calés sur le niveau actuel.
 */
export function targetsFor(model: PaceModel, plan: Plan, session: Session, goal: Goal | null = model.goal): SessionTargets | null {
  const c = contextOf(model, plan, session, goal);
  if (!c) return null;
  const { week, race, raceZone, g, target, goalTarget, weekVdot } = c;

  // Séance de qualité du catalogue : les allures viennent de son déroulé (rien si tout se fait au ressenti).
  if (session.type === "quality" && session.workout) {
    const list = timedIntensities(session.workout)
      .map((i) => intensityTarget(model, plan, session, i, goal))
      .filter((t): t is PaceTarget => t !== null);
    return list.length > 0 ? { targets: list, comparable: false } : null;
  }

  // Course/marche : l'allure moyenne de la sortie est bien plus lente que le facile, donc pas de comparaison.
  if (session.workout?.format === "course-marche") return { targets: [target("Allure facile", "facile")], comparable: false };

  // Sortie longue du catalogue : facile seule (comparable), ou facile puis les allures de son déroulé.
  if (session.type === "long" && session.workout) {
    const easy = target("Allure facile", "facile");
    const rest = timedIntensities(session.workout)
      .map((i) => intensityTarget(model, plan, session, i, goal))
      .filter((t): t is PaceTarget => t !== null);
    return rest.length > 0 ? { targets: [easy, ...rest], comparable: false } : { targets: [easy], comparable: true };
  }

  switch (session.type) {
    case "easy":
      return { targets: [target("Allure facile", "facile")], comparable: true };
    case "recovery":
    case "shakeout":
      return { targets: [target("Très facile", "recuperation")], comparable: true };
    case "tempo":
      return { targets: [target("Allure seuil", "seuil", 0, weekVdot)], comparable: false };
    case "long": {
      const easy = target("Allure facile", "facile");
      if (!week.isRecovery && week.phase === "specifique" && (race === "semi" || race === "marathon") && session.km >= 14) {
        const finish = g ? goalTarget("Derniers km : allure objectif") : target(`Derniers km : ${ZONES[raceZone].label.toLowerCase()}`, raceZone);
        return { targets: [easy, finish], comparable: false };
      }
      return { targets: [easy], comparable: true };
    }
    case "quality": {
      if (week.phase === "base") return null; // fartlek au ressenti, sans chronomètre
      if (week.phase === "specifique" && (race === "semi" || race === "marathon")) {
        return { targets: [g ? goalTarget("Allure objectif") : target(ZONES[raceZone].label, raceZone)], comparable: false };
      }
      if (week.phase === "specifique") {
        return { targets: [g ? goalTarget("Allure objectif ou un peu plus vite", 0.02) : target("Allure de course ou un peu plus vite", raceZone, 0.02)], comparable: false };
      }
      return { targets: [target("Allure 10 km", "10k", 0, weekVdot)], comparable: false };
    }
    case "race":
      return g ? { targets: [goalTarget("Allure objectif")], comparable: false } : null;
    default:
      return null;
  }
}

export type Verdict = "dans" | "rapide" | "lent";

/** Position de l'allure d'une sortie par rapport à la fourchette. `seconds` : écart avec le bord le plus proche, en s/km. */
export function comparePace(pace: number, range: PaceRange): { verdict: Verdict; seconds: number } {
  const slowSec = range.slow * 60 + GRACE_SECONDS;
  const fastSec = range.fast * 60 - GRACE_SECONDS;
  const sec = pace * 60;
  if (sec > slowSec) return { verdict: "lent", seconds: Math.round(sec - range.slow * 60) };
  if (sec < fastSec) return { verdict: "rapide", seconds: Math.round(range.fast * 60 - sec) };
  return { verdict: "dans", seconds: 0 };
}
