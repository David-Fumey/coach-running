// Hydratation : suivi des boissons, besoin du jour, estimation de l'eau perdue par la transpiration. TypeScript pur.
// Ce sont des estimations de repères sportifs (ACSM, EFSA), pas un avis médical.

import { RUN_KCAL_PER_KG_KM, type Profile } from "./nutrition.ts";
import type { Activity } from "./activities.ts";

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

/** Eau perdue par la sueur pendant une course de `km` kilomètres. */
export function sweatLoss(km: number, weightKg: number, conditions: Conditions = "temperee"): SweatEstimate {
  const kcal = km * weightKg * RUN_KCAL_PER_KG_KM;
  const center = kcal * SWEAT_ML_PER_KCAL * CONDITIONS[conditions].factor;
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

export function hydrationTarget(profile: Profile | null, trainingKm: number): HydrationTarget {
  const base = baseMl(profile);
  const training = trainingKm > 0 ? sweatLoss(trainingKm, profile?.weightKg ?? DEFAULT_WEIGHT_KG).ml : 0;
  return { base, training, total: round50(base + training) };
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
