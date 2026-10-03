// Temps objectif de course : saisie, allure requise, comparaison avec le niveau actuel. TypeScript pur.
// Le niveau (VDOT) et les durées de course suivent les équations de Daniels et Gilbert.

import type { RaceKey } from "./plan.ts";

export interface Goal {
  race: RaceKey;
  /** Temps visé, en minutes décimales */
  minutes: number;
}

/** Distances exactes des courses, en km. */
export const RACE_KM: Record<RaceKey, number> = { "5k": 5, "10k": 10, semi: 21.0975, marathon: 42.195 };

/** Allure de course nécessaire, en min/km. */
export const goalPace = (g: Goal) => g.minutes / RACE_KM[g.race];

/** Allures plausibles d'un coureur, en min/km (les mêmes bornes que pour la saisie de l'allure moyenne). */
const MIN_PACE = 3;
const MAX_PACE = 12;

/** Un objectif plausible : allure entre 3:00 et 12:00 par km. */
export function validGoal(g: unknown): g is Goal {
  if (typeof g !== "object" || g === null) return false;
  const { race, minutes } = g as { race?: unknown; minutes?: unknown };
  if (typeof race !== "string" || !(race in RACE_KM) || typeof minutes !== "number" || !Number.isFinite(minutes)) return false;
  const pace = minutes / RACE_KM[race as RaceKey];
  return pace >= MIN_PACE && pace <= MAX_PACE;
}

/**
 * « 24:30 » → 24 min 30 s ; « 1:45:30 » → 1 h 45 min 30 s.
 * Pour le semi et le marathon, « 1:45 » veut dire 1 h 45 (un semi en 1 min 45 n'existe pas).
 * Retourne null si la saisie n'est pas un temps.
 */
export function parseGoalTime(raw: string, race: RaceKey): number | null {
  const parts = raw.trim().replace(/\s+/g, "").split(":");
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d{1,2}$/.test(p))) return null;
  const n = parts.map(Number);
  if (n.slice(1).some((x) => x > 59)) return null;
  if (n.length === 3) return n[0] * 60 + n[1] + n[2] / 60;
  return race === "semi" || race === "marathon" ? n[0] * 60 + n[1] : n[0] + n[1] / 60;
}

// ---------- Niveau et prédiction ----------

const vo2 = (v: number) => -4.6 + 0.182258 * v + 0.000104 * v * v;

/** Part de la capacité aérobie tenable pendant `t` minutes. */
const sustainedFraction = (t: number) => 0.8 + 0.1894393 * Math.exp(-0.012778 * t) + 0.2989558 * Math.exp(-0.1932605 * t);

/** Niveau (VDOT) que démontre un temps sur une distance. */
export function vdotFromRace(km: number, minutes: number): number {
  return vo2((km * 1000) / minutes) / sustainedFraction(minutes);
}

/** Temps de course (minutes) qu'un niveau permet de tenir sur une distance. Recherche par dichotomie. */
export function predictMinutes(vdot: number, km: number): number {
  let lo = km * 2; // 2 min/km : impossible
  let hi = km * 20; // 20 min/km : toujours tenable
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    // Plus on met de temps, plus le niveau démontré baisse : on cherche l'égalité.
    if (vdotFromRace(km, mid) > vdot) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export type Ambition = "prudent" | "realiste" | "ambitieux" | "tres-ambitieux";

export interface Assessment {
  /** Temps que le niveau actuel permet d'estimer sur la distance, en minutes */
  predicted: number;
  /** Écart de l'objectif avec cette estimation : négatif = plus rapide que l'estimation */
  gap: number;
  ambition: Ambition;
}

/** Compare l'objectif au niveau actuel. Seuils : plus de 8 % plus rapide = ambitieux, plus de 15 % = très ambitieux. */
export function assessGoal(goal: Goal, currentVdot: number): Assessment {
  const predicted = predictMinutes(currentVdot, RACE_KM[goal.race]);
  const gap = (goal.minutes - predicted) / predicted;
  const ambition: Ambition = gap < -0.15 ? "tres-ambitieux" : gap < -0.08 ? "ambitieux" : gap <= 0.03 ? "realiste" : "prudent";
  return { predicted, gap, ambition };
}
