// Besoins nutritionnels selon la charge d'entraînement. TypeScript pur, comme le moteur de plan.
// Ce sont des estimations de repères sportifs, pas un avis médical.

import { addDays, diffDays, type Plan, type RaceKey, type Session } from "./plan.ts";
import type { Activity } from "./activities.ts";

export type Sex = "f" | "m";
export type Goal = "maintenir" | "perdre" | "prendre";

export interface Profile {
  /** Prénom ou pseudo, facultatif */
  name?: string;
  sex: Sex;
  age: number;
  weightKg: number;
  heightCm: number;
  goal: Goal;
}

export const GOALS: Record<Goal, string> = {
  maintenir: "Maintenir mon poids",
  perdre: "Perdre un peu de poids",
  prendre: "Prendre un peu de poids",
};

/** Type de journée du point de vue de la charge. */
export type DayKind = "repos" | "facile" | "intense" | "long" | "course";

export const DAY_KIND_LABEL: Record<DayKind, string> = {
  repos: "Repos",
  facile: "Footing facile",
  intense: "Séance intense",
  long: "Sortie longue",
  course: "Jour de course",
};

export interface Food {
  id: string;
  date: string;
  label: string;
  kcal: number;
  carbs?: number;
  protein?: number;
  fat?: number;
}

export interface Macros {
  kcal: number;
  carbs: number;
  protein: number;
  fat: number;
}

export interface DayTarget extends Macros {
  date: string;
  kind: DayKind;
  /** Veille de course : charge en glucides */
  eve: boolean;
  /** Distance prise en compte (prévue, ou réellement courue) */
  km: number;
  session?: Session;
  /** Dépense estimée de la course elle-même */
  runKcal: number;
  tips: string[];
  /** Pendant l'effort, seulement pour les sorties assez longues */
  during?: { minutes: number; carbsPerHour: string; waterMlPerHour: string };
}

// ---------- Énergie ----------

/** Métabolisme de base, équation de Mifflin-St Jeor. */
export function bmr(p: Profile): number {
  return 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === "m" ? 5 : -161);
}

/** Facteur pour la vie quotidienne hors entraînement (travail, déplacements), course exclue. */
const DAILY_LIFE_FACTOR = 1.3;
/** Coût de la course à pied : environ 1 kcal par kg et par km. */
export const RUN_KCAL_PER_KG_KM = 1;
const GOAL_ADJUST: Record<Goal, number> = { maintenir: 0, perdre: -0.1, prendre: 0.1 };

const CARBS_G_PER_KG: Record<DayKind, number> = { repos: 4, facile: 5, intense: 6, long: 7, course: 7 };
const PROTEIN_G_PER_KG = 1.6;
const FAT_MIN_G_PER_KG = 0.8;

/** Charge en glucides de la veille d'une course. */
function eveCarbs(race: RaceKey): number {
  return race === "marathon" ? 10 : race === "semi" ? 9 : 8;
}

export function kindOf(type: Session["type"] | undefined, km: number): DayKind {
  switch (type) {
    case "race":
      return "course";
    case "long":
      return "long";
    case "quality":
    case "tempo":
      return "intense";
    case undefined:
      return km > 0 ? "facile" : "repos";
    default:
      return "facile";
  }
}

export interface DayContext {
  session?: Session;
  km: number;
  kind: DayKind;
  /** Veille de course */
  eve: boolean;
}

/**
 * Nature d'une journée d'entraînement (indépendante du profil).
 * - Jour passé : distance réellement courue ; sans activité, la séance cochée compte pour sa distance prévue.
 * - Aujourd'hui et plus tard : distance prévue au plan, ou distance réelle si déjà courue.
 */
export function dayContext(plan: Plan, activities: Activity[], done: Record<string, boolean>, date: string, today: string): DayContext {
  const sessions = plan.weeks.flatMap((w) => w.sessions);
  const session = sessions.find((s) => s.date === date);
  const ran = activities.filter((a) => a.date === date).reduce((acc, a) => acc + a.km, 0);
  const planned = session && (diffDays(today, date) >= 0 || done[session.id]) ? session.km : 0;
  const km = ran > 0 ? ran : planned;
  // Séance du plan non faite dans le passé : journée de repos.
  const kind = kindOf(ran > 0 || planned > 0 ? session?.type : undefined, km);
  const eve = sessions.find((s) => s.date === addDays(date, 1))?.type === "race";
  return { session, km, kind, eve };
}

/** Objectifs nutritionnels d'une journée (voir `dayContext` pour la distance retenue). */
export function dayTarget(
  plan: Plan,
  profile: Profile,
  activities: Activity[],
  done: Record<string, boolean>,
  date: string,
  today: string,
  paceMinPerKm = 6
): DayTarget {
  const { session, km, kind, eve } = dayContext(plan, activities, done, date, today);

  const w = profile.weightKg;
  const runKcal = km * w * RUN_KCAL_PER_KG_KM;
  const energy = (bmr(profile) * DAILY_LIFE_FACTOR + runKcal) * (1 + adjustment(profile.goal, kind, eve));

  const carbsPerKg = eve ? eveCarbs(plan.input.race) : CARBS_G_PER_KG[kind];
  const carbs = carbsPerKg * w;
  const protein = PROTEIN_G_PER_KG * w;
  // Les lipides complètent l'énergie, sans descendre sous le minimum ; l'énergie totale en découle.
  const fat = Math.max(FAT_MIN_G_PER_KG * w, (energy - 4 * carbs - 4 * protein) / 9);
  const kcal = 4 * carbs + 4 * protein + 9 * fat;

  return {
    date,
    kind,
    eve,
    km,
    session,
    runKcal: Math.round(runKcal),
    kcal: Math.round(kcal),
    carbs: Math.round(carbs),
    protein: Math.round(protein),
    fat: Math.round(fat),
    tips: tipsFor(kind, eve, plan.input.race),
    during: duringAdvice(km, paceMinPerKm),
  };
}

/** On ne réduit l'apport que les jours calmes ; jamais avant ni pendant les grosses charges. */
function adjustment(goal: Goal, kind: DayKind, eve: boolean): number {
  if (goal === "perdre" && (eve || (kind !== "repos" && kind !== "facile"))) return 0;
  return GOAL_ADJUST[goal];
}

export function duringAdvice(km: number, paceMinPerKm: number): DayTarget["during"] {
  const minutes = Math.round(km * paceMinPerKm);
  if (minutes < 75) return undefined;
  return {
    minutes,
    carbsPerHour: minutes > 150 ? "60 à 90 g" : "30 à 60 g",
    waterMlPerHour: "400 à 800 ml",
  };
}

function tipsFor(kind: DayKind, eve: boolean, race: RaceKey): string[] {
  if (eve) {
    return [
      `Charge en glucides : pâtes, riz, pain, pommes de terre, compotes. Vise ${eveCarbs(race)} g par kg de poids.`,
      "Limite les fibres, les aliments gras et l'alcool ce soir-là.",
      "Bois régulièrement dans la journée, sans te forcer à l'excès.",
    ];
  }
  switch (kind) {
    case "course":
      return [
        "Petit-déjeuner riche en glucides 2 à 3 h avant le départ, que tu connais déjà.",
        "Ne teste rien de nouveau le jour J.",
        "Après l'arrivée : glucides et protéines dans l'heure, et bois.",
      ];
    case "long":
      return [
        "Repas riche en glucides 2 à 3 h avant, et un petit encas léger si tu pars plus tôt.",
        "Teste pendant la sortie ce que tu comptes utiliser le jour de la course.",
        "Après : glucides et 20 à 30 g de protéines dans l'heure qui suit.",
      ];
    case "intense":
      return [
        "Mange des glucides avant la séance (repas 2 à 3 h avant ou encas 1 h avant).",
        "Après : un repas avec glucides et protéines pour récupérer.",
      ];
    case "facile":
      return ["Une collation légère avant suffit. Garde des protéines à chaque repas."];
    default:
      return [
        "Jour de repos : l'assiette reste complète, les muscles se réparent maintenant.",
        "Protéines à chaque repas, légumes, et assez de glucides pour recharger les réserves.",
      ];
  }
}

// ---------- Journal ----------

export function totalsOf(foods: Food[]): Macros {
  return foods.reduce(
    (acc, f) => ({
      kcal: acc.kcal + f.kcal,
      carbs: acc.carbs + (f.carbs ?? 0),
      protein: acc.protein + (f.protein ?? 0),
      fat: acc.fat + (f.fat ?? 0),
    }),
    { kcal: 0, carbs: 0, protein: 0, fat: 0 }
  );
}

/** Aliments déjà saisis, du plus récent au plus ancien, sans doublon de libellé. */
export function recentFoods(foods: Food[], limit = 8): Food[] {
  const seen = new Set<string>();
  const out: Food[] = [];
  for (const f of [...foods].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))) {
    const key = f.label.trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
    if (out.length >= limit) break;
  }
  return out;
}

/** Retourne un message d'erreur, ou null si le profil est cohérent. */
export function validateProfile(p: Profile): string | null {
  if (!Number.isFinite(p.age) || p.age < 16 || p.age > 90) return "L'âge doit être compris entre 16 et 90 ans.";
  if (!Number.isFinite(p.weightKg) || p.weightKg < 35 || p.weightKg > 200) return "Le poids doit être compris entre 35 et 200 kg.";
  if (!Number.isFinite(p.heightCm) || p.heightCm < 130 || p.heightCm > 230) return "La taille doit être comprise entre 130 et 230 cm.";
  return null;
}
