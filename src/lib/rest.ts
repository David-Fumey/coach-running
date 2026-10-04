// Conseils d'un jour de repos, selon la séance de la veille et celle du lendemain. TypeScript pur.

import { addDays, diffDays, type Plan, type Session } from "./plan.ts";

export interface RestDay {
  yesterday: Session | null;
  tomorrow: Session | null;
  tips: string[];
}

/** Séance de course d'un jour, ou null. */
const runOn = (plan: Plan, date: string): Session | null => plan.weeks.flatMap((w) => w.sessions).find((s) => s.date === date) ?? null;

/**
 * Le jour est un jour de repos du plan : ni course, ni renforcement, pendant la préparation (pas en semaine de pause).
 * Renvoie alors des conseils courts, adaptés à la veille et au lendemain ; sinon null.
 */
export function restDay(plan: Plan, date: string): RestDay | null {
  const week = plan.weeks.find((w) => date >= w.startDate && date <= addDays(w.startDate, 6));
  if (!week || week.paused) return null;
  if (diffDays(date, plan.input.raceDate) < 0) return null;
  if (runOn(plan, date) || (week.extras ?? []).some((s) => s.date === date)) return null;

  const yesterday = runOn(plan, addDays(date, -1));
  const tomorrow = runOn(plan, addDays(date, 1));
  const tips: string[] = ["Un jour de repos fait partie de l'entraînement : c'est pendant ce temps que le corps s'adapte et progresse."];

  if (yesterday?.type === "long") tips.push("Tu viens de faire ta sortie longue : bois bien, mange des glucides et des protéines, et marche un peu pour détendre les jambes.");
  else if (yesterday && ["quality", "tempo", "test"].includes(yesterday.type)) tips.push("Hier était une séance dure : des courbatures légères sont normales pendant 24 à 48 h. Quelques minutes de mobilité aident.");
  else if (yesterday?.type === "race") tips.push("Bravo pour ta course ! Marche, hydrate-toi, mange à ta faim et ne reprends que quand les jambes sont revenues.");

  if (tomorrow?.type === "long") tips.push("Demain, sortie longue : mange un peu plus de glucides ce soir et couche-toi tôt.");
  else if (tomorrow && ["quality", "tempo", "test"].includes(tomorrow.type)) tips.push("Demain, une séance qui demande de la fraîcheur : dors bien et évite de rester debout toute la journée.");
  else if (tomorrow?.type === "race") tips.push("Demain, c'est la course : prépare ton équipement, dîne riche en glucides et couche-toi tôt.");

  tips.push("Si une douleur reste localisée ou revient d'une séance à l'autre, demande l'avis d'un médecin ou d'un kiné plutôt que de courir dessus.");
  return { yesterday, tomorrow, tips };
}
