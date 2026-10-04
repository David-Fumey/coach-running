// Déroulé d'une séance pas à pas : échauffement, répétitions, retour au calme, avec l'allure de chaque portion.
// TypeScript pur. Le déroulé se déduit du type de séance, de la phase de sa semaine et de ses kilomètres (les mêmes
// règles que le texte écrit par `plan.ts`), donc il vaut aussi pour les plans déjà enregistrés.

import type { Intensity, Plan, RaceKey, Seg, Session, Workout } from "./plan.ts";
import { intensityTarget, targetsFor, zoneRange, type PaceModel, type PaceRange } from "./paces.ts";
import { legacyQualityWorkout, legacyTempoWorkout } from "./workouts.ts";

export type StepKind = "easy" | "work" | "rest" | "stride" | "walk";
export type BlockTone = "warmup" | "main" | "cooldown" | "strides";

export interface WorkoutStep {
  kind: StepKind;
  /** « Footing facile », « Effort soutenu », « Trot facile »… */
  label: string;
  distanceM?: number;
  seconds?: number;
  /** Allure visée ; absente tant que le niveau n'est pas connu (ou pour une marche) */
  pace?: PaceRange;
  /** « fourchette » : entre deux allures ; « plafond » : pas plus vite que `pace.fast` */
  paceMode?: "fourchette" | "plafond";
  /** Repère au ressenti, affiché sous l'allure ou à sa place */
  effort?: string;
}

export interface WorkoutBlock {
  id: string;
  title: string;
  tone: BlockTone;
  /** Nombre de passages dans les étapes du bloc (1 = une seule fois) */
  repeat: number;
  steps: WorkoutStep[];
  note?: string;
}

const RACE_LABEL: Record<RaceKey, string> = { "5k": "5 km", "10k": "10 km", semi: "semi-marathon", marathon: "marathon" };

const fmtKmLabel = (x: number) => (Number.isInteger(x) ? `${x}` : x.toFixed(1).replace(".", ","));

const INTENSITY_LABEL: Record<Intensity, string> = {
  facile: "Allure facile",
  soutenu: "Effort soutenu",
  "5k": "Allure 5 km",
  "10k": "Allure 10 km",
  seuil: "Allure seuil",
  semi: "Allure semi-marathon",
  marathon: "Allure marathon",
  course: "Allure de course",
  coursePlus: "Allure de course ou plus vite",
  test: "Test 5 km chronométré",
};

const INTENSITY_EFFORT: Partial<Record<Intensity, string>> = {
  facile: "effort 3-4/10",
  soutenu: "effort 7/10, sans chronomètre",
  "5k": "effort 9/10",
  "10k": "effort 8/10",
  seuil: "effort 7/10, quelques mots seulement",
  test: "à fond mais régulier, effort 9/10",
};

/** Déroulé enregistré avec la séance, ou celui qu'avaient les séances de qualité et de tempo avant le catalogue. */
function workoutOf(plan: Plan, session: Session, phase: string): Workout | null {
  if (session.workout) return session.workout;
  if (session.type === "long") return null; // ancienne sortie longue : traitée plus bas
  if (session.type === "quality") return legacyQualityWorkout(plan.input.race, phase as Parameters<typeof legacyQualityWorkout>[1], session.km);
  if (session.type === "tempo") return legacyTempoWorkout(session.km);
  return null;
}

/**
 * Déroulé d'une séance (même d'un seul bloc), ou null si elle n'appartient pas au plan.
 * Sans modèle d'allures, les étapes n'ont pas d'allure : le ressenti reste affiché.
 */
export function workoutBlocks(plan: Plan, session: Session, model: PaceModel | null): WorkoutBlock[] | null {
  const week = plan.weeks.find((w) => w.sessions.some((s) => s.id === session.id));
  if (!week) return null;
  const race = plan.input.race;
  const phase = week.phase;
  const targets = model ? targetsFor(model, plan, session) : null;

  const easyRange = model ? zoneRange(model.vdot, "facile") : undefined;
  const easy = (label: string, distanceM: number): WorkoutStep => ({
    kind: "easy",
    label,
    distanceM,
    pace: easyRange,
    paceMode: "plafond",
    effort: "allure conversationnelle",
  });
  const work = (label: string, extra: Partial<WorkoutStep>, pace?: PaceRange): WorkoutStep => ({ kind: "work", label, pace, paceMode: "fourchette", ...extra });

  const structured = workoutOf(plan, session, phase);
  if (structured) {
    const label = (i: Intensity) => (i === "course" ? `Allure ${RACE_LABEL[race]}` : i === "coursePlus" ? `Allure ${RACE_LABEL[race]} ou plus vite` : INTENSITY_LABEL[i]);
    const walkStep = (seg: Seg): WorkoutStep => ({ kind: "walk", label: "Marche rapide", seconds: seg.seconds, effort: "marche active, bras actifs" });
    const runWalk = structured.format === "course-marche" || structured.format === "fartlek-marche";
    const workStep = (seg: Seg): WorkoutStep => {
      const size: Partial<WorkoutStep> = seg.meters !== undefined ? { distanceM: seg.meters } : { seconds: seg.seconds };
      if (seg.walk) return walkStep(seg);
      if (seg.hill) return { kind: "work", label: "Montée en côte", ...size, paceMode: "fourchette", effort: "effort 8/10, pente de 4 à 6 %" };
      const pace = model ? intensityTarget(model, plan, session, seg.intensity) ?? undefined : undefined;
      const effort = INTENSITY_EFFORT[seg.intensity];
      return {
        kind: seg.intensity === "facile" ? "easy" : "work",
        label: runWalk && seg.intensity === "facile" ? "Course facile" : label(seg.intensity),
        ...size,
        pace,
        paceMode: "fourchette",
        ...(effort ? { effort } : {}),
      };
    };
    const restStep = (rest: { seconds: number; walk?: boolean }, afterHill: boolean): WorkoutStep =>
      rest.walk
        ? { kind: "rest", label: "Marche de récupération", seconds: rest.seconds }
        : { kind: "rest", label: afterHill ? "Descente en trot facile" : "Trot facile", seconds: rest.seconds, pace: model ? zoneRange(model.vdot, "recuperation") : undefined, paceMode: "plafond" };

    const sets = structured.sets;
    const steps: WorkoutStep[] = [];
    const uniform = sets.length === 1 && sets[0].times > 1;
    for (const [si, set] of sets.entries()) {
      for (let t = 0; t < (uniform ? 1 : set.times); t++) {
        steps.push(workStep(set.work));
        const last = si === sets.length - 1 && t === set.times - 1;
        if (set.rest && (uniform || !last)) steps.push(restStep(set.rest, !!set.work.hill));
      }
    }
    const blocks: WorkoutBlock[] = [];
    if (structured.warm) blocks.push({ id: "warmup", title: "Échauffement", tone: "warmup", repeat: 1, steps: [workStep(structured.warm)] });
    else if (structured.warmKm > 0) blocks.push({ id: "warmup", title: "Échauffement", tone: "warmup", repeat: 1, steps: [easy("Footing facile", structured.warmKm * 1000)] });
    blocks.push({ id: "main", title: session.type === "long" ? "Sortie longue" : structured.format === "course-marche" ? "Course/marche" : "Séance", tone: "main", repeat: uniform ? sets[0].times : 1, steps, ...(structured.note ? { note: structured.note } : {}) });
    if (structured.cool) blocks.push({ id: "cooldown", title: "Retour au calme", tone: "cooldown", repeat: 1, steps: [workStep(structured.cool)] });
    else if (structured.coolKm > 0) blocks.push({ id: "cooldown", title: "Retour au calme", tone: "cooldown", repeat: 1, steps: [easy("Footing facile", structured.coolKm * 1000)] });
    return blocks;
  }

  switch (session.type) {
    case "long": {
      if (week.isRecovery || phase !== "specifique" || !(race === "semi" || race === "marathon") || session.km < 14) {
        return [
          {
            id: "main",
            title: "Sortie longue",
            tone: "main",
            repeat: 1,
            steps: [{ kind: "easy", label: "Allure facile et régulière", distanceM: Math.round(session.km * 1000), pace: targets?.targets[0], paceMode: "fourchette", effort: "effort 3-4/10" }],
          },
        ];
      }
      const finish = Math.round(session.km * 0.3);
      const finishPace = targets?.targets[1];
      return [
        {
          id: "main",
          title: "Sortie longue",
          tone: "main",
          repeat: 1,
          steps: [
            { kind: "easy", label: "Allure facile", distanceM: Math.round((session.km - finish) * 1000), pace: targets?.targets[0], paceMode: "fourchette", effort: "effort 3-4/10" },
            work(`Allure ${RACE_LABEL[race]}`, { distanceM: finish * 1000 }, finishPace),
          ],
        },
      ];
    }
    case "easy":
    case "recovery":
    case "shakeout": {
      const gentle = session.type !== "easy";
      const blocks: WorkoutBlock[] = [
        {
          id: "main",
          title: session.type === "recovery" ? "Récupération" : "Footing",
          tone: "main",
          repeat: 1,
          steps: [
            {
              kind: "easy",
              label: gentle ? "Allure très facile" : "Allure facile",
              distanceM: Math.round(session.km * 1000),
              pace: targets?.targets[0],
              paceMode: "fourchette",
              effort: gentle ? "effort 2-3/10" : "effort 3-4/10",
            },
          ],
        },
      ];
      const m = /(\d+) lignes droites/.exec(session.details);
      if (m) {
        blocks.push({
          id: "strides",
          title: "Lignes droites",
          tone: "strides",
          repeat: Number(m[1]),
          steps: [
            { kind: "stride", label: "Ligne droite progressive", distanceM: 100, effort: "accélère petit à petit, sans sprinter" },
            { kind: "rest", label: "Marche pour récupérer" },
          ],
        });
      }
      return blocks;
    }
    case "race":
      return [
        {
          id: "main",
          title: "Course",
          tone: "main",
          repeat: 1,
          steps: [work("Jour de course", { distanceM: Math.round(session.km * 1000), effort: targets ? undefined : "pars avec retenue, à ton rythme" }, targets?.targets[0])],
        },
      ];
    default:
      return null;
  }
}

/** Texte court d'une étape : « 400 m », « 1 min 30 », « 2 km ». */
export function stepSize(step: WorkoutStep): string {
  if (step.distanceM !== undefined) return step.distanceM >= 1000 ? `${fmtKmLabel(step.distanceM / 1000)} km` : `${step.distanceM} m`;
  if (step.seconds !== undefined) {
    const m = Math.floor(step.seconds / 60);
    const s = step.seconds % 60;
    return m === 0 ? `${s} s` : s === 0 ? `${m} min` : `${m} min ${String(s).padStart(2, "0")}`;
  }
  return "";
}
