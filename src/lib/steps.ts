// Déroulé d'une séance pas à pas : échauffement, répétitions, retour au calme, avec l'allure de chaque portion.
// TypeScript pur. Le déroulé se déduit du type de séance, de la phase de sa semaine et de ses kilomètres (les mêmes
// règles que le texte écrit par `plan.ts`), donc il vaut aussi pour les plans déjà enregistrés.

import type { Plan, RaceKey, Session, Week } from "./plan.ts";
import { targetsFor, zoneRange, type PaceModel, type PaceRange } from "./paces.ts";

export type StepKind = "easy" | "work" | "rest" | "stride";
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

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const fmtKmLabel = (x: number) => (Number.isInteger(x) ? `${x}` : x.toFixed(1).replace(".", ","));

/** Nombre de répétitions du fartlek, du fractionné : doit rester identique à `qualitySession` de plan.ts. */
export function repsFor(race: RaceKey, phase: Week["phase"], km: number): number {
  const work = Math.max(1, km - 3);
  if (phase === "base") return clamp(Math.round(work / 0.6), 4, 10);
  const len = repLengthKm(race);
  return clamp(Math.round(work / len), 3, 12);
}

export function repLengthKm(race: RaceKey): number {
  return { "5k": 0.4, "10k": 1, semi: 1, marathon: 1.6 }[race];
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
  const jog = (seconds: number): WorkoutStep => ({
    kind: "rest",
    label: "Trot facile",
    seconds,
    pace: model ? zoneRange(model.vdot, "recuperation") : undefined,
    paceMode: "plafond",
  });
  const warm = (): WorkoutBlock => ({ id: "warmup", title: "Échauffement", tone: "warmup", repeat: 1, steps: [easy("Footing facile", 2000)] });
  const cool = (): WorkoutBlock => ({ id: "cooldown", title: "Retour au calme", tone: "cooldown", repeat: 1, steps: [easy("Footing facile", 1000)] });
  const work = (label: string, extra: Partial<WorkoutStep>, pace?: PaceRange): WorkoutStep => ({ kind: "work", label, pace, paceMode: "fourchette", ...extra });

  switch (session.type) {
    case "quality": {
      const reps = repsFor(race, phase, session.km);
      const total = Math.max(1, session.km - 3);
      if (phase === "base") {
        const pace = model ? zoneRange(model.vdot, "10k") : undefined;
        return [
          warm(),
          {
            id: "main",
            title: "Séance",
            tone: "main",
            repeat: reps,
            steps: [work("Effort soutenu", { seconds: 60, effort: "effort 7/10, sans chronomètre" }, pace), jog(90)],
          },
          cool(),
        ];
      }
      if (phase === "specifique" && (race === "semi" || race === "marathon")) {
        const block = Math.max(2, Math.round(total));
        const t = targets?.targets[0];
        const label = `Allure ${RACE_LABEL[race]}`;
        const steps: WorkoutStep[] =
          block >= 6
            ? [work(label, { distanceM: Math.ceil(block / 2) * 1000 }, t), jog(120), work(label, { distanceM: Math.floor(block / 2) * 1000 }, t)]
            : [work(label, { distanceM: block * 1000 }, t)];
        return [warm(), { id: "main", title: "Séance", tone: "main", repeat: 1, steps, note: block >= 6 ? "Tu peux aussi enchaîner les deux blocs d'un seul tenant." : undefined }, cool()];
      }
      const len = repLengthKm(race);
      const t = targets?.targets[0];
      const label = phase === "specifique" ? "Allure de course ou plus vite" : "Allure 10 km";
      return [
        warm(),
        {
          id: "main",
          title: "Séance",
          tone: "main",
          repeat: reps,
          steps: [work(label, { distanceM: Math.round(len * 1000), effort: phase === "specifique" ? undefined : "effort 8/10" }, t), jog(len < 1 ? 75 : 120)],
        },
        cool(),
      ];
    }
    case "tempo": {
      const km = Math.max(2, Math.round(session.km - 3));
      return [
        warm(),
        {
          id: "main",
          title: "Séance",
          tone: "main",
          repeat: 1,
          steps: [work("Allure seuil", { distanceM: km * 1000, effort: "effort 7/10, quelques mots seulement" }, targets?.targets[0])],
        },
        cool(),
      ];
    }
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
