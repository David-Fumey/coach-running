// Décalage du programme : une pause de quelques semaines, puis le plan est recalculé jusqu'à la course. TypeScript pur.
//
// La date de la course ne bouge pas. Décaler de N semaines revient donc à perdre N semaines de préparation : à partir
// de la semaine concernée, les séances restantes sont remplacées par une pause, puis le plan est régénéré sur les
// semaines qui restent jusqu'à la course (condensé, avec les mêmes phases, la même charge maximale et le même affûtage).
// Le passé (séances faites ou manquées) n'est jamais touché.

import { addDays, diffDays, generatePlan, type Plan, type Session, type Week } from "./plan.ts";
import type { Activity } from "./activities.ts";

export const MAX_SHIFT_WEEKS = 8;
/** Préfixe des remarques ajoutées par un décalage (conservées d'un décalage à l'autre). */
const SHIFT_NOTE = "Programme décalé";

export type ShiftResult =
  | { ok: true; plan: Plan; resumeDate: string; weeksLeft: number; pausedWeeks: number }
  | { ok: false; error: string };

const sum = (sessions: Session[]) => Math.round(sessions.reduce((a, s) => a + s.km, 0) * 2) / 2;
/** Garde seulement le renforcement déjà passé d'une semaine remplacée par une pause. */
function withExtras(w: Week, today: string): Week {
  const { extras, ...rest } = w;
  const past = (extras ?? []).filter((s) => s.date < today);
  return past.length > 0 ? { ...rest, extras: past } : rest;
}

const plannedKm = (w: Week) => w.sessions.reduce((a, s) => a + s.km, 0);

/** Part de la charge à laquelle on reprend : plus la pause est longue, plus on reprend doucement. */
export function resumeFactor(weeks: number): number {
  return Math.max(0.7, 1 - 0.1 * (weeks - 1));
}

/**
 * Décale de `weeks` semaines tout ce qui n'est pas encore fait.
 * - Les séances passées, et les séances déjà validées même à venir, restent en place.
 * - Les autres séances, à partir d'aujourd'hui, laissent place à `weeks` semaines de pause.
 * - Le plan est ensuite régénéré du lundi de reprise à la date de la course, en reprenant à la charge de la dernière
 *   semaine, réduite après une longue pause.
 */
export function shiftPlan(plan: Plan, weeks: number, done: Record<string, boolean>, today: string): ShiftResult {
  if (!Number.isInteger(weeks) || weeks < 1 || weeks > MAX_SHIFT_WEEKS) {
    return { ok: false, error: `Choisis un décalage de 1 à ${MAX_SHIFT_WEEKS} semaines.` };
  }
  if (diffDays(today, plan.input.raceDate) < 0) return { ok: false, error: "La course est déjà passée." };
  // Le décalage régénère les séances : il écraserait celles du plan d'origine.
  if (plan.source) return { ok: false, error: `Ce plan vient de ${plan.source} : décale-le là-bas, puis reprends-le ici.` };

  // Première semaine qui contient encore quelque chose à reporter.
  const k = plan.weeks.findIndex((w) => w.sessions.some((s) => s.date >= today && !done[s.id]));
  if (k < 0) return { ok: false, error: "Il n'y a plus de séance à décaler." };
  const first = plan.weeks[k];

  const resumeDate = addDays(first.startDate, 7 * weeks);
  if (diffDays(resumeDate, plan.input.raceDate) < 0) {
    return { ok: false, error: `Un décalage de ${weeks} semaine${weeks > 1 ? "s" : ""} ferait reprendre après la date de la course. Choisis un décalage plus court.` };
  }

  // Charge de reprise : la dernière semaine complète, ou à défaut la semaine prévue.
  const reference = k > 0 ? Math.max(plannedKm(plan.weeks[k - 1]), plannedKm(first)) : plannedKm(first) || plan.input.currentWeeklyKm;
  const resumeKm = Math.round(reference * resumeFactor(weeks) * 2) / 2;

  const regenerated = generatePlan({ ...plan.input, currentWeeklyKm: resumeKm, today: resumeDate });
  const untilResume = (j: number): Week =>
    j === 0
      ? withExtras({ ...first, sessions: first.sessions.filter((s) => s.date < today), isRecovery: false }, today)
      : { index: 0, startDate: addDays(first.startDate, 7 * j), phase: first.phase, isRecovery: false, focus: "", totalKm: 0, sessions: [] };

  const paused: Week[] = Array.from({ length: weeks }, (_, j) => {
    const w = untilResume(j);
    return {
      ...w,
      paused: true,
      focus: `Pause : le programme reprend le lundi ${resumeDate.slice(8, 10)}/${resumeDate.slice(5, 7)}.`,
      totalKm: sum(w.sessions),
    };
  });

  const merged: Week[] = [...plan.weeks.slice(0, k).map((w) => ({ ...w })), ...paused, ...regenerated.weeks.map((w) => ({ ...w }))].map((w, i) => ({
    ...w,
    index: i,
  }));

  // Une séance validée à l'avance dans une semaine remplacée ne doit pas disparaître : on la remet à sa date.
  for (const old of plan.weeks.slice(k)) {
    for (const s of old.sessions) {
      if (s.date < today || !done[s.id]) continue;
      const target = merged.find((w) => s.date >= w.startDate && s.date <= addDays(w.startDate, 6));
      if (!target) continue;
      target.sessions = [...target.sessions.filter((x) => x.id !== s.id), s].sort((a, b) => a.date.localeCompare(b.date));
      target.totalKm = sum(target.sessions);
    }
  }

  const notes = plan.warnings.filter((w) => w.startsWith(SHIFT_NOTE));
  const note = `${SHIFT_NOTE} de ${weeks} semaine${weeks > 1 ? "s" : ""} le ${today.slice(8, 10)}/${today.slice(5, 7)} : la date de la course ne change pas, la préparation est donc raccourcie d'autant.`;

  return {
    ok: true,
    plan: { ...plan, weeks: merged, warnings: [...notes, note, ...regenerated.warnings] },
    resumeDate,
    weeksLeft: regenerated.weeks.length,
    pausedWeeks: weeks,
  };
}

/**
 * Le dernier décalage peut être annulé tant que rien de ce qu'il a changé n'est utilisé : une séance validée ou
 * une activité liée doit désigner une séance identique dans l'ancien plan et dans le nouveau (les identifiants sont
 * des dates : une même date peut porter une autre séance après le décalage).
 */
export function canUndoShift(previous: Plan | null, current: Plan, done: Record<string, boolean>, activities: Activity[]): boolean {
  if (!previous) return false;
  const byId = (p: Plan) => new Map(p.weeks.flatMap((w) => w.sessions).map((s) => [s.id, JSON.stringify(s)]));
  const before = byId(previous);
  const after = byId(current);
  const used = [...Object.keys(done), ...activities.map((a) => a.sessionId).filter((id): id is string => !!id)];
  return used.every((id) => before.get(id) !== undefined && before.get(id) === after.get(id));
}

/** Séances de course manquées d'affilée avant aujourd'hui, et durée de pause qu'on peut proposer. */
export interface MissedStreak {
  count: number;
  /** Date de la plus ancienne et de la plus récente séance manquée de la série */
  firstDate: string;
  lastDate: string;
  suggestedWeeks: number;
}

/** Nombre de séances manquées de suite à partir duquel on propose un décalage. */
export const MISSED_THRESHOLD = 3;

/**
 * Série de séances manquées en remontant depuis la plus récente séance passée : ni validée, ni liée à une activité.
 * La série s'arrête à la première séance faite, et à une semaine de pause (un décalage déjà fait la referme).
 * Retourne null sous le seuil, ou si le décalage n'est pas possible (course passée, plus rien à reporter, reprise trop tard).
 */
export function missedStreak(plan: Plan, done: Record<string, boolean>, activities: Activity[], today: string): MissedStreak | null {
  const linked = new Set(activities.map((a) => a.sessionId).filter((id): id is string => !!id));
  const missed: string[] = [];
  outer: for (let i = plan.weeks.length - 1; i >= 0; i--) {
    const w = plan.weeks[i];
    if (w.startDate > today) continue;
    if (w.paused) break;
    for (const s of [...w.sessions].reverse()) {
      if (s.date >= today || s.type === "race") continue;
      if (done[s.id] || linked.has(s.id)) break outer;
      missed.push(s.date);
    }
  }
  if (missed.length < MISSED_THRESHOLD) return null;
  const firstDate = missed[missed.length - 1];
  const suggestedWeeks = Math.min(3, Math.max(1, Math.ceil(diffDays(firstDate, today) / 7)));
  for (let w = suggestedWeeks; w >= 1; w--) {
    if (shiftPlan(plan, w, done, today).ok) return { count: missed.length, firstDate, lastDate: missed[0], suggestedWeeks: w };
  }
  return null;
}
