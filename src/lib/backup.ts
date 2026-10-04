// Sauvegarde locale : toutes les données de l'application dans un fichier JSON.
// TypeScript pur : la lecture d'un fichier ne fait jamais confiance à son contenu.

import type { Plan } from "./plan.ts";
import type { Activity } from "./activities.ts";
import { isValidPace } from "./paces.ts";
import { validGoal, type Goal } from "./goal.ts";
import { CONDITIONS, validAmount, validateWeighing, type Water, type Weighing } from "./hydration.ts";
import { validTest, type TestResult } from "./tests.ts";
import { GOALS, validateProfile, type Food, type Profile } from "./nutrition.ts";

export interface Snapshot {
  plan: Plan | null;
  done: Record<string, boolean>;
  activities: Activity[];
  confirmed: boolean;
  profile: Profile | null;
  foods: Food[];
  /** Allure moyenne d'entraînement saisie à la main (min/km) ; null = calculée sur les sorties */
  paceRef: number | null;
  /** Temps objectif de course (une seule course à la fois) */
  goal: Goal | null;
  /** Boissons enregistrées dans le suivi d'hydratation */
  water: Water[];
  /** Pesées avant / après une sortie, pour étalonner la transpiration */
  sweat: Weighing[];
  /** Tests de 5 km chronométrés, qui recalent les allures cibles */
  tests: TestResult[];
}

export const EMPTY_SNAPSHOT: Snapshot = { plan: null, done: {}, activities: [], confirmed: false, profile: null, foods: [], paceRef: null, goal: null, water: [], sweat: [], tests: [] };

/** Identifiant interne, resté « foulee » (ancien nom de l'application) pour que les anciennes sauvegardes restent lisibles. */
const APP = "foulee";
const VERSION = 1;

export function makeBackup(data: Snapshot, now: Date): string {
  return JSON.stringify({ app: APP, version: VERSION, exportedAt: now.toISOString(), data }, null, 2);
}

export function backupFileName(today: string): string {
  return `runner-${today}.json`;
}

export type ParseResult = { ok: true; data: Snapshot } | { ok: false; error: string };

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const isDate = (x: unknown): x is string => typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x);
const isOptNum = (x: unknown) => x === undefined || (isNum(x) && x >= 0);

function validPlan(p: unknown): p is Plan {
  if (!isObj(p) || !isObj(p.input) || !Array.isArray(p.weeks) || p.weeks.length === 0 || !Array.isArray(p.warnings)) return false;
  if (typeof p.input.race !== "string" || !isDate(p.input.raceDate) || !isNum(p.input.daysPerWeek)) return false;
  return p.weeks.every(
    (w) =>
      isObj(w) &&
      isDate(w.startDate) &&
      isNum(w.totalKm) &&
      typeof w.phase === "string" &&
      Array.isArray(w.sessions) &&
      w.sessions.every((s) => isObj(s) && typeof s.id === "string" && isDate(s.date) && isNum(s.km) && typeof s.title === "string") &&
      (w.extras === undefined || (Array.isArray(w.extras) && w.extras.every((s) => isObj(s) && typeof s.id === "string" && isDate(s.date) && typeof s.title === "string")))
  );
}

const EFFORT_KEYS = ["5k", "10k", "semi", "marathon"];

function validEfforts(e: unknown): boolean {
  return isObj(e) && Object.entries(e).every(([k, v]) => EFFORT_KEYS.includes(k) && isNum(v) && v > 0);
}

function validActivity(a: unknown): a is Activity {
  return (
    isObj(a) &&
    typeof a.id === "string" &&
    isDate(a.date) &&
    isNum(a.km) && a.km > 0 &&
    isNum(a.minutes) && a.minutes > 0 &&
    (a.sessionId === undefined || typeof a.sessionId === "string") &&
    (a.feeling === undefined || (isNum(a.feeling) && a.feeling >= 1 && a.feeling <= 5)) &&
    (a.note === undefined || typeof a.note === "string") &&
    (a.source === undefined || typeof a.source === "string") &&
    (a.externalId === undefined || typeof a.externalId === "string") &&
    isOptNum(a.avgHr) && isOptNum(a.maxHr) && isOptNum(a.elevation) &&
    (a.efforts === undefined || validEfforts(a.efforts)) &&
    (a.temp === undefined || a.temp === null || (isNum(a.temp) && a.temp >= -60 && a.temp <= 60))
  );
}

function validFood(f: unknown): f is Food {
  return (
    isObj(f) &&
    typeof f.id === "string" &&
    isDate(f.date) &&
    typeof f.label === "string" &&
    isNum(f.kcal) && f.kcal >= 0 &&
    isOptNum(f.carbs) && isOptNum(f.protein) && isOptNum(f.fat)
  );
}

function validWater(w: unknown): w is Water {
  return isObj(w) && typeof w.id === "string" && isDate(w.date) && validAmount(w.ml);
}

function validWeighing(w: unknown): w is Weighing {
  if (!isObj(w) || typeof w.id !== "string" || !isDate(w.date) || typeof w.conditions !== "string" || !(w.conditions in CONDITIONS)) return false;
  return [w.km, w.minutes, w.before, w.after, w.drankMl].every(isNum) && validateWeighing(w as unknown as Weighing) === null;
}

function validProfile(p: unknown): p is Profile {
  return (
    isObj(p) &&
    (p.sex === "m" || p.sex === "f") &&
    typeof p.goal === "string" && p.goal in GOALS &&
    (p.name === undefined || typeof p.name === "string") &&
    isNum(p.age) && isNum(p.weightKg) && isNum(p.heightCm) &&
    validateProfile(p as unknown as Profile) === null
  );
}

/** Lit un fichier de sauvegarde. Les clés absentes prennent leur valeur par défaut ; tout le reste doit être valide. */
export function parseBackup(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "Ce fichier n'est pas un fichier JSON valide." };
  }
  if (!isObj(raw) || raw.app !== APP || !isObj(raw.data)) return { ok: false, error: "Ce fichier ne vient pas de Runner." };
  if (!isNum(raw.version) || raw.version > VERSION) return { ok: false, error: "Ce fichier vient d'une version plus récente de Runner." };

  const d = raw.data;
  const plan = d.plan ?? null;
  const done = d.done ?? {};
  const activities = d.activities ?? [];
  const foods = d.foods ?? [];
  const profile = d.profile ?? null;
  const confirmed = d.confirmed ?? false;
  const paceRef = d.paceRef ?? null;
  const goal = d.goal ?? null;
  const water = d.water ?? [];
  const sweat = d.sweat ?? [];
  const tests = d.tests ?? [];

  if (plan !== null && !validPlan(plan)) return { ok: false, error: "Le plan contenu dans le fichier est invalide." };
  if (!isObj(done) || !Object.values(done).every((v) => v === true)) return { ok: false, error: "Les séances validées du fichier sont invalides." };
  if (!Array.isArray(activities) || !activities.every(validActivity)) return { ok: false, error: "Les activités du fichier sont invalides." };
  if (!Array.isArray(foods) || !foods.every(validFood)) return { ok: false, error: "Le journal alimentaire du fichier est invalide." };
  if (profile !== null && !validProfile(profile)) return { ok: false, error: "Le profil contenu dans le fichier est invalide." };
  if (typeof confirmed !== "boolean") return { ok: false, error: "Le fichier est invalide." };
  if (paceRef !== null && !isValidPace(paceRef)) return { ok: false, error: "L'allure moyenne du fichier est invalide." };
  if (!Array.isArray(water) || !water.every(validWater)) return { ok: false, error: "Le suivi d'hydratation du fichier est invalide." };
  if (!Array.isArray(sweat) || !sweat.every(validWeighing)) return { ok: false, error: "Les pesées du fichier sont invalides." };
  if (!Array.isArray(tests) || !tests.every(validTest)) return { ok: false, error: "Les tests de 5 km du fichier sont invalides." };
  if (goal !== null && !validGoal(goal)) return { ok: false, error: "Le temps objectif du fichier est invalide." };

  return {
    ok: true,
    data: {
      plan: plan as Plan | null,
      done: done as Record<string, boolean>,
      activities: activities as Activity[],
      foods: foods as Food[],
      profile: profile as Profile | null,
      paceRef: paceRef as number | null,
      goal: goal as Goal | null,
      water: water as Water[],
      sweat: sweat as Weighing[],
      tests: tests as TestResult[],
      confirmed: plan === null ? false : confirmed,
    },
  };
}
