// Séances de renforcement et de mobilité placées les jours sans course. TypeScript pur.
//
// Elles ne comptent pas dans les kilomètres : elles sont rangées à part dans `Week.extras`, avec la durée plutôt
// que la distance. Placement : un jour de repos, jamais la veille d'une séance dure (qualité, tempo, test, sortie
// longue, course), pour arriver les jambes fraîches à la séance suivante.

import { addDays, weekdayIndex, type Exercise, type Level, type Phase, type Session, type SessionType, type StrengthWorkout } from "./plan.ts";

export type Routine = "jambes" | "gainage" | "mobilite";

interface Def {
  name: string;
  tip: string;
  /** « reps » : répétitions ; « tenue » : secondes à tenir */
  kind: "reps" | "tenue";
  base: number;
  perSide?: boolean;
}

const DEFS: Record<string, Def> = {
  squat: { name: "Squats", tip: "Dos droit, genoux dans l'axe des pieds, descends comme pour t'asseoir.", kind: "reps", base: 12 },
  fentes: { name: "Fentes alternées", tip: "Grand pas, genou avant au-dessus de la cheville, buste droit.", kind: "reps", base: 10, perSide: true },
  pont: { name: "Pont fessier", tip: "Pousse sur les talons, serre les fessiers en haut, bassin aligné.", kind: "reps", base: 12 },
  marche: { name: "Montées sur marche", tip: "Pose tout le pied sur la marche, monte sans élan, descends lentement.", kind: "reps", base: 10, perSide: true },
  mollets: { name: "Montées sur pointes", tip: "Monte haut sur les orteils, redescends en 3 secondes.", kind: "reps", base: 15 },
  planche: { name: "Planche sur les avant-bras", tip: "Corps aligné de la tête aux talons, ventre rentré, ne cambre pas.", kind: "tenue", base: 30 },
  laterale: { name: "Planche latérale", tip: "Bassin haut, épaule au-dessus du coude, corps en ligne.", kind: "tenue", base: 20, perSide: true },
  deadbug: { name: "Dead-bug", tip: "Dos plaqué au sol, bras et jambe opposés qui s'étendent lentement.", kind: "reps", base: 8, perSide: true },
  birddog: { name: "Quadrupédie bras-jambe", tip: "À quatre pattes, étends bras et jambe opposés sans bouger le bassin.", kind: "reps", base: 8, perSide: true },
  pont1: { name: "Pont fessier sur une jambe", tip: "Bassin à l'horizontale, ne le laisse pas tomber d'un côté.", kind: "reps", base: 8, perSide: true },
  psoas: { name: "Fente basse, étirement de la hanche", tip: "Genou arrière au sol, bassin vers l'avant, respire calmement.", kind: "tenue", base: 30, perSide: true },
  ischios: { name: "Étirement des ischio-jambiers", tip: "Jambe tendue, buste long, sans forcer ni rebondir.", kind: "tenue", base: 30, perSide: true },
  chevilles: { name: "Cercles de cheville", tip: "Grands cercles lents, dans les deux sens.", kind: "reps", base: 10, perSide: true },
  chatvache: { name: "Dos rond, dos creux", tip: "À quatre pattes, enchaîne lentement en suivant ta respiration.", kind: "reps", base: 10 },
  rotation: { name: "Rotation du buste", tip: "À quatre pattes, une main derrière la tête, ouvre le coude vers le plafond.", kind: "reps", base: 8, perSide: true },
  enfant: { name: "Position de l'enfant", tip: "Fesses sur les talons, bras allongés devant toi, relâche tout.", kind: "tenue", base: 30 },
};

const ROUTINES: Record<Routine, { title: string; keys: string[]; focus: string }> = {
  jambes: { title: "Renforcement : jambes et fessiers", keys: ["squat", "fentes", "pont", "marche", "mollets"], focus: "Des jambes solides absorbent mieux les impacts de la course." },
  gainage: { title: "Renforcement : gainage et stabilité", keys: ["planche", "laterale", "deadbug", "birddog", "pont1"], focus: "Un tronc stable garde ta foulée régulière quand la fatigue arrive." },
  mobilite: { title: "Mobilité et détente", keys: ["psoas", "ischios", "chevilles", "chatvache", "rotation", "enfant"], focus: "Sans effort : on assouplit, on relâche, on récupère." },
};

const PHASE_SETS: Partial<Record<Phase, number>> = { base: 2, construction: 3, specifique: 2 };
const LEVEL_SETS: Record<Level, number> = { debutant: -1, intermediaire: 0, avance: 1 };
const LEVEL_SCALE: Record<Level, number> = { debutant: 0.8, intermediaire: 1, avance: 1.25 };
const REST_SECONDS = 30;
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const round5 = (x: number) => Math.round(x / 5) * 5;

/** Contenu d'une séance. `cycle` : nombre de fois que ce programme a déjà été fait, il l'allonge un peu. */
export function strengthWorkout(routine: Routine, phase: Phase, level: Level, cycle: number): StrengthWorkout {
  const def = ROUTINES[routine];
  const light = routine === "mobilite";
  const sets = light ? 1 : clamp((PHASE_SETS[phase] ?? 2) + LEVEL_SETS[level], 2, 4);
  const bump = light ? 0 : Math.min(cycle, 3);
  const exercises: Exercise[] = def.keys.map((k) => {
    const d = DEFS[k];
    const scaled = light ? d.base : d.kind === "tenue" ? round5(d.base * LEVEL_SCALE[level]) + 5 * bump : Math.round(d.base * LEVEL_SCALE[level]) + (d.perSide ? bump : 2 * bump);
    return { name: d.name, tip: d.tip, sets: light && d.kind === "reps" ? 1 : sets, ...(d.kind === "reps" ? { reps: scaled } : { seconds: scaled }), ...(d.perSide ? { perSide: true } : {}) };
  });
  const rest = light ? 10 : REST_SECONDS;
  const seconds = exercises.reduce((acc, e) => {
    const work = (e.seconds ?? (e.reps ?? 0) * 3) * (e.perSide ? 2 : 1);
    return acc + e.sets * (work + rest);
  }, 0);
  return { format: routine === "mobilite" ? "mobilite" : "renforcement", routine, minutes: Math.max(10, round5(seconds / 60)), restSeconds: rest, exercises };
}

export function strengthTitle(routine: Routine): string {
  return ROUTINES[routine].title;
}

export function strengthFocus(routine: Routine): string {
  return ROUTINES[routine].focus;
}

const HARD: SessionType[] = ["long", "quality", "tempo", "test", "race"];

export interface WeekInfo {
  weekStart: string;
  phase: Phase;
  isRecovery: boolean;
  isRaceWeek: boolean;
  level: Level;
  /** Séances de course de la semaine (toutes, même celles déjà passées) */
  runs: { date: string; type: SessionType }[];
}

/** Jours de la semaine sans course où l'on peut renforcer sans gêner la séance du lendemain, du meilleur au moins bon. */
export function strengthDays(info: WeekInfo): string[] {
  const byDate = new Map(info.runs.map((r) => [r.date, r.type]));
  const out: { date: string; penalty: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(info.weekStart, i);
    if (byDate.has(date)) continue;
    const next = byDate.get(addDays(info.weekStart, i + 1));
    const prev = byDate.get(addDays(info.weekStart, i - 1));
    if (next && HARD.includes(next)) continue;
    // Légère préférence : pas juste après la sortie longue ; plutôt à distance de la course.
    out.push({ date, penalty: (prev === "long" ? 2 : 0) + (next ? 0 : 1) });
  }
  return out.sort((a, b) => a.penalty - b.penalty || a.date.localeCompare(b.date)).map((d) => d.date);
}

/** Nombre de séances de renforcement souhaitées dans la semaine. */
export function strengthCount(info: WeekInfo): number {
  if (info.isRaceWeek) return 0;
  if (info.phase === "affutage" || info.isRecovery) return 1; // mobilité seulement
  if (info.phase === "specifique") return 1;
  return info.level === "debutant" ? 1 : info.runs.length <= 4 ? 2 : 1;
}

export interface WeekExtras {
  sessions: Session[];
  /** Rang à passer à la semaine suivante */
  nextRank: number;
}

/**
 * Séances de renforcement ou de mobilité de la semaine. `rank` : nombre de séances de renforcement déjà placées, il
 * alterne jambes et gainage et allonge les programmes qui reviennent.
 */
export function weekExtras(info: WeekInfo, rank: number): WeekExtras {
  const days = strengthDays(info);
  const wanted = strengthCount(info);
  const picked: string[] = [];
  for (const d of days) {
    if (picked.length >= wanted) break;
    // Deux séances de renforcement ne se suivent pas.
    if (picked.some((p) => Math.abs(weekdayIndex(p) - weekdayIndex(d)) < 2)) continue;
    picked.push(d);
  }
  picked.sort();
  const light = info.isRecovery || info.phase === "affutage";
  const sessions: Session[] = picked.map((date, i) => {
    const routine: Routine = light ? "mobilite" : (rank + i) % 2 === 0 ? "jambes" : "gainage";
    const strength = strengthWorkout(routine, info.phase, info.level, Math.floor((rank + i) / 2));
    return {
      id: `r-${date}`,
      date,
      type: "strength",
      km: 0,
      title: strengthTitle(routine),
      details: `${strengthFocus(routine)} Environ ${strength.minutes} min, sans matériel. Fais-la un jour sans course, ni la veille d'une séance dure.`,
      strength,
    };
  });
  return { sessions, nextRank: light ? rank : rank + picked.length };
}
