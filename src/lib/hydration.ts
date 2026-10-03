// Hydratation : suivi des boissons, besoin du jour, estimation de l'eau perdue par la transpiration. TypeScript pur.
// Ce sont des estimations de repères sportifs (ACSM, EFSA), pas un avis médical.

import { RUN_KCAL_PER_KG_KM, type Profile } from "./nutrition.ts";
import type { Activity } from "./activities.ts";
import { diffDays } from "./plan.ts";

export interface Water {
  id: string;
  /** AAAA-MM-JJ */
  date: string;
  /** Volume bu, en millilitres */
  ml: number;
}

/** Contenants usuels, en ml. */
export const QUICK_AMOUNTS: { ml: number; label: string }[] = [
  { ml: 150, label: "Tasse" },
  { ml: 250, label: "Verre" },
  { ml: 330, label: "Canette" },
  { ml: 500, label: "Petite bouteille" },
  { ml: 750, label: "Gourde" },
];

export const MIN_ENTRY_ML = 10;
export const MAX_ENTRY_ML = 3000;

// ---------- Besoin de base ----------

/** Boissons au quotidien, par kg de poids (les repas apportent le reste de l'eau : repère EFSA, environ 80 % en boissons). */
export const BASE_ML_PER_KG = 30;
/** Sans profil : repère moyen d'un adulte. */
export const DEFAULT_BASE_ML = 1800;
/** Poids supposé quand il est inconnu, pour estimer la transpiration. */
export const DEFAULT_WEIGHT_KG = 70;

const round50 = (x: number) => Math.round(x / 50) * 50;
const round10 = (x: number) => Math.round(x / 10) * 10;

export function baseMl(profile: Profile | null): number {
  return profile ? Math.min(3500, Math.max(1500, round50(BASE_ML_PER_KG * profile.weightKg))) : DEFAULT_BASE_ML;
}

// ---------- Transpiration ----------

export type Conditions = "fraiche" | "temperee" | "chaude";

export const CONDITIONS: Record<Conditions, { label: string; factor: number }> = {
  fraiche: { label: "Frais (moins de 12 °C)", factor: 0.75 },
  temperee: { label: "Tempéré (12 à 22 °C)", factor: 1 },
  chaude: { label: "Chaud (plus de 22 °C)", factor: 1.35 },
};

/**
 * Eau évacuée par la sueur pour 1 kcal dépensée, en ml.
 * Environ 75 % de l'énergie dépensée devient de la chaleur ; 1 ml de sueur évaporée en emporte 0,58 kcal ;
 * on retient 85 % d'efficacité d'évaporation en conditions tempérées : 0,75 / 0,58 × 0,85 ≈ 1,1 ml par kcal.
 */
export const SWEAT_ML_PER_KCAL = 1.1;
/** Incertitude de l'estimation : la transpiration varie beaucoup d'une personne à l'autre. */
export const SWEAT_UNCERTAINTY = 0.25;

export interface SweatEstimate {
  /** Estimation centrale, en ml */
  ml: number;
  low: number;
  high: number;
  /** Part du poids du corps perdue, en % (au-delà de 2 %, la performance baisse) */
  percentOfBody: number;
}

/** Estimation du modèle seul, sans arrondi ni ajustement personnel. */
function rawSweat(km: number, weightKg: number, conditions: Conditions): number {
  return km * weightKg * RUN_KCAL_PER_KG_KM * SWEAT_ML_PER_KCAL * CONDITIONS[conditions].factor;
}

/** Classe de conditions d'après une température en °C ; null si la température est inconnue. */
export function conditionsFromTemp(temp: number | null | undefined): Conditions | null {
  if (typeof temp !== "number" || !Number.isFinite(temp)) return null;
  return temp < 12 ? "fraiche" : temp <= 22 ? "temperee" : "chaude";
}

/** Eau perdue par la sueur pendant une course de `km` kilomètres. `factor` : ajustement personnel issu des pesées. */
export function sweatLoss(km: number, weightKg: number, conditions: Conditions = "temperee", factor = 1): SweatEstimate {
  const center = rawSweat(km, weightKg, conditions) * factor;
  return {
    ml: round10(center),
    low: round10(center * (1 - SWEAT_UNCERTAINTY)),
    high: round10(center * (1 + SWEAT_UNCERTAINTY)),
    percentOfBody: Math.round((center / (weightKg * 1000)) * 1000) / 10,
  };
}

/** À boire dans les heures qui suivent : 120 à 150 % de ce qui a été perdu. */
export function replaceRange(lossMl: number): { low: number; high: number } {
  return { low: round50(lossMl * 1.2), high: round50(lossMl * 1.5) };
}

/** Volume à boire pendant l'effort selon sa durée : 400 à 800 ml par heure au-delà d'une heure, rien de systématique avant. */
export function duringRange(minutes: number): { low: number; high: number } | null {
  if (minutes < 60) return null;
  return { low: round50((minutes / 60) * 400), high: round50((minutes / 60) * 800) };
}

// ---------- Besoin du jour et suivi ----------

export interface HydrationTarget {
  base: number;
  /** Eau perdue par la séance du jour (prévue ou courue), à compenser */
  training: number;
  total: number;
}

export function hydrationTarget(profile: Profile | null, trainingKm: number, factor = 1): HydrationTarget {
  const training = trainingKm > 0 ? sweatLoss(trainingKm, profile?.weightKg ?? DEFAULT_WEIGHT_KG, "temperee", factor).ml : 0;
  return hydrationTargetFromLoss(profile, training);
}

/** Objectif quand la perte du jour est déjà connue (par exemple avec la température relevée par la montre). */
export function hydrationTargetFromLoss(profile: Profile | null, trainingMl: number): HydrationTarget {
  const base = baseMl(profile);
  return { base, training: trainingMl, total: round50(base + trainingMl) };
}

export function totalMl(entries: Water[], date: string): number {
  return entries.filter((e) => e.date === date).reduce((s, e) => s + e.ml, 0);
}

export type Progress = "debut" | "en-route" | "presque" | "atteint" | "large";

/** Où en est la journée : 0-25 %, 25-60 %, 60-100 %, 100-150 %, au-delà. */
export function progressOf(drunk: number, target: number): Progress {
  const r = target > 0 ? drunk / target : 0;
  return r < 0.25 ? "debut" : r < 0.6 ? "en-route" : r < 1 ? "presque" : r <= 1.5 ? "atteint" : "large";
}

/** Dernière sortie enregistrée, au plus tard aujourd'hui. */
export function lastActivity(activities: Activity[], today: string): Activity | null {
  let best: Activity | null = null;
  for (const a of activities) {
    if (a.date > today) continue;
    if (best === null || a.date > best.date || (a.date === best.date && a.id > best.id)) best = a;
  }
  return best;
}

/** Entrée valide pour l'ajout ou l'import. */
export function validAmount(ml: unknown): ml is number {
  return typeof ml === "number" && Number.isFinite(ml) && ml >= MIN_ENTRY_ML && ml <= MAX_ENTRY_ML;
}

// ---------- Pesées avant / après : étalonner sa propre transpiration ----------

export interface Weighing {
  id: string;
  /** Jour de la sortie */
  date: string;
  km: number;
  minutes: number;
  /** Poids avant et après la sortie, en kg */
  before: number;
  after: number;
  /** Ce qui a été bu pendant la sortie, en ml */
  drankMl: number;
  /** Conditions retenues pour la sortie (température de la montre ou choix manuel) */
  conditions: Conditions;
}

/** En dessous, l'écart de poids se perd dans l'erreur de la balance. */
export const MIN_WEIGHING_MINUTES = 20;
const MAX_RATE_ML_PER_HOUR = 3500;
const MIN_LOSS_ML = 100;

/** Eau perdue, mesurée : la masse perdue plus ce qui a été bu. (Un peu de la perte vient de la respiration.) */
export const measuredLossMl = (w: Pick<Weighing, "before" | "after" | "drankMl">) => Math.round((w.before - w.after) * 1000 + w.drankMl);

/** Taux de transpiration mesuré, en ml par heure. */
export const sweatRate = (w: Pick<Weighing, "before" | "after" | "drankMl" | "minutes">) => measuredLossMl(w) / (w.minutes / 60);

/** Rapport entre la perte mesurée et celle que le modèle prédisait pour les mêmes conditions. */
export function weighingRatio(w: Omit<Weighing, "id" | "date">): number {
  return measuredLossMl(w) / rawSweat(w.km, w.before, w.conditions);
}

/** Retourne un message d'erreur, ou null si la pesée est exploitable. */
export function validateWeighing(w: Omit<Weighing, "id" | "date">): string | null {
  const ok = (x: number, lo: number, hi: number) => Number.isFinite(x) && x >= lo && x <= hi;
  if (!ok(w.before, 30, 200) || !ok(w.after, 30, 200)) return "Indique des poids entre 30 et 200 kg (par exemple 68,4).";
  if (!ok(w.drankMl, 0, 5000)) return "Ce que tu as bu pendant la sortie doit être entre 0 et 5 000 ml.";
  if (!ok(w.km, 0.5, 250) || !(w.conditions in CONDITIONS)) return "La sortie n'est pas valide.";
  if (!ok(w.minutes, MIN_WEIGHING_MINUTES, 24 * 60)) return `Une sortie de moins de ${MIN_WEIGHING_MINUTES} minutes ne permet pas une mesure fiable : la balance n'est pas assez précise.`;
  if (w.before - w.after > 6) return "Plus de 6 kg d'écart : vérifie les deux pesées.";
  if (measuredLossMl(w) < MIN_LOSS_ML) return "Perte trop faible pour être mesurée. Vérifie les pesées et le volume bu (tu as peut-être beaucoup bu ou mal lu la balance).";
  if (sweatRate(w) > MAX_RATE_ML_PER_HOUR) return "Cette perte par heure n'est pas plausible : vérifie les pesées et le volume bu.";
  return null;
}

export interface Calibration {
  /** Multiplicateur à appliquer au modèle (1 = aucun ajustement) */
  factor: number;
  count: number;
  /** Confiance accordée à la mesure, de 0 à 1 : une seule pesée ne suffit pas à corriger tout l'écart */
  trust: number;
  /** Taux de transpiration moyen mesuré, en ml par heure */
  ratePerHour: number;
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * Ajustement personnel tiré des pesées : médiane des rapports mesure / modèle, bornée entre 0,5 et 2,
 * et appliquée progressivement (un tiers avec une pesée, deux tiers avec deux, en entier à partir de trois).
 */
export function calibration(weighings: Weighing[]): Calibration | null {
  const good = weighings.filter((w) => validateWeighing(w) === null);
  if (good.length === 0) return null;
  const ratio = Math.min(2, Math.max(0.5, median(good.map(weighingRatio))));
  const trust = Math.min(1, good.length / 3);
  return {
    factor: Math.round((1 + (ratio - 1) * trust) * 1000) / 1000,
    count: good.length,
    trust,
    ratePerHour: Math.round(good.reduce((s, w) => s + sweatRate(w), 0) / good.length / 10) * 10,
  };
}

// ---------- Rappel après une sortie ----------

/** En dessous de cette perte estimée, un rappel n'a pas d'intérêt. */
export const MIN_REMINDER_ML = 300;
/** Un rappel ne concerne que les sorties d'aujourd'hui et d'hier. */
export const REMINDER_DAYS = 1;

export interface PostRun {
  activity: Activity;
  loss: SweatEstimate;
  conditions: Conditions;
  /** Température relevée par la montre si c'est elle qui a fixé les conditions */
  fromTemp: number | null;
  /** Ce qu'il faut boire dans les 2 à 4 heures suivantes */
  back: { low: number; high: number };
}

/**
 * La sortie la plus récente pour laquelle afficher l'eau perdue estimée, ou null.
 * Écartées : les sorties de plus d'un jour, déjà fermées par l'utilisateur, déjà pesées (la mesure suffit), ou trop courtes.
 * Les conditions viennent de la température de la montre quand on l'a, sinon elles sont supposées tempérées.
 */
export function postRunLoss(
  activities: Activity[],
  weighings: Pick<Weighing, "date" | "km">[],
  dismissed: string[],
  today: string,
  weightKg: number,
  factor = 1
): PostRun | null {
  const recent = activities
    .filter((a) => {
      const age = diffDays(a.date, today);
      return age >= 0 && age <= REMINDER_DAYS && !dismissed.includes(a.id) && !weighings.some((w) => w.date === a.date && Math.abs(w.km - a.km) < 0.05);
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  for (const activity of recent) {
    const fromTemp = conditionsFromTemp(activity.temp);
    const conditions = fromTemp ?? "temperee";
    const loss = sweatLoss(activity.km, weightKg, conditions, factor);
    if (loss.ml < MIN_REMINDER_ML) continue;
    return { activity, loss, conditions, fromTemp: fromTemp ? (activity.temp as number) : null, back: replaceRange(loss.ml) };
  }
  return null;
}
