// Moteur de génération de plan d'entraînement. Aucune dépendance : pur TypeScript.

import { longWorkout, qualityWorkout, tempoWorkout } from "./workouts.ts";

export type RaceKey = "5k" | "10k" | "semi" | "marathon";
export type Level = "debutant" | "intermediaire" | "avance";
export type LongDay = "sam" | "dim";
export type Phase = "base" | "construction" | "specifique" | "affutage" | "course";
export type SessionType =
  | "easy"
  | "quality"
  | "tempo"
  | "long"
  | "recovery"
  | "shakeout"
  | "race";

export interface PlanInput {
  race: RaceKey;
  /** Date de la course, format AAAA-MM-JJ */
  raceDate: string;
  level: Level;
  daysPerWeek: 3 | 4 | 5 | 6;
  /** Kilomètres courus actuellement par semaine (0 ou vide = on estime) */
  currentWeeklyKm: number;
  longDay: LongDay;
  /** Date du jour AAAA-MM-JJ (injectable pour les tests) */
  today: string;
}

/** Intensité d'un effort structuré ; les allures correspondantes viennent de paces.ts. */
export type Intensity = "facile" | "soutenu" | "5k" | "10k" | "seuil" | "semi" | "marathon" | "course" | "coursePlus";

/** Un effort : une distance ou une durée, à une intensité (en côte si `hill`). */
export interface Seg {
  meters?: number;
  seconds?: number;
  intensity: Intensity;
  hill?: boolean;
}

export interface Rest {
  seconds: number;
  /** Marche plutôt que trot */
  walk?: boolean;
}

/** `times` répétitions de l'effort, chacune suivie de la récupération (sauf la toute dernière de la séance). */
export interface WorkSet {
  times: number;
  work: Seg;
  rest?: Rest;
}

/** Déroulé d'une séance structurée, source de l'affichage pas à pas. */
export interface Workout {
  format: string;
  warmKm: number;
  coolKm: number;
  sets: WorkSet[];
  note?: string;
}

export interface Session {
  id: string;
  date: string;
  type: SessionType;
  km: number;
  title: string;
  details: string;
  /** Absent des plans créés avant le catalogue de séances */
  workout?: Workout;
}

export interface Week {
  index: number;
  startDate: string;
  phase: Phase;
  isRecovery: boolean;
  focus: string;
  totalKm: number;
  sessions: Session[];
  /** Semaine de pause créée par un décalage du programme */
  paused?: boolean;
}

export interface Plan {
  input: PlanInput;
  weeks: Week[];
  warnings: string[];
  createdAt: string;
}

export const RACES: Record<RaceKey, { label: string; km: number; minWeeks: number }> = {
  "5k": { label: "5 km", km: 5, minWeeks: 4 },
  "10k": { label: "10 km", km: 10, minWeeks: 6 },
  semi: { label: "Semi-marathon", km: 21.1, minWeeks: 8 },
  marathon: { label: "Marathon", km: 42.195, minWeeks: 12 },
};

export const LEVELS: Record<Level, string> = {
  debutant: "Débutant",
  intermediaire: "Intermédiaire",
  avance: "Avancé",
};

const PEAK_KM: Record<RaceKey, Record<Level, number>> = {
  "5k": { debutant: 25, intermediaire: 35, avance: 50 },
  "10k": { debutant: 30, intermediaire: 45, avance: 60 },
  semi: { debutant: 35, intermediaire: 50, avance: 70 },
  marathon: { debutant: 45, intermediaire: 65, avance: 90 },
};

const LONG_SHARE: Record<RaceKey, number> = { "5k": 0.28, "10k": 0.32, semi: 0.38, marathon: 0.45 };
const LONG_CAP: Record<RaceKey, number> = { "5k": 14, "10k": 18, semi: 24, marathon: 32 };
/** Semaines d'affûtage, semaine de course comprise */
const TAPER_WEEKS: Record<RaceKey, number> = { "5k": 1, "10k": 1, semi: 2, marathon: 3 };
/** Part du volume maximal pour les semaines d'affûtage qui précèdent la semaine de course */
const TAPER_FACTORS: Record<RaceKey, number[]> = {
  "5k": [],
  "10k": [],
  semi: [0.7],
  marathon: [0.75, 0.55],
};

const DAY_NAMES = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];
export const dayName = (i: number) => DAY_NAMES[i];

// ---------- Dates (UTC pour éviter les soucis d'heure d'été) ----------

export function parseISO(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
export function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}
export function addDays(s: string, n: number): string {
  const d = parseISO(s);
  d.setUTCDate(d.getUTCDate() + n);
  return toISO(d);
}
export function diffDays(a: string, b: string): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86400000);
}
/** 0 = lundi ... 6 = dimanche */
export function weekdayIndex(s: string): number {
  return (parseISO(s).getUTCDay() + 6) % 7;
}
export function mondayOf(s: string): string {
  return addDays(s, -weekdayIndex(s));
}

// ---------- Utilitaires ----------

const round05 = (x: number) => Math.round(x * 2) / 2;
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

function sessionDays(daysPerWeek: number, longDay: LongDay): number[] {
  const base: Record<number, number[]> = {
    3: [1, 3, 6],
    4: [1, 3, 5, 6],
    5: [0, 1, 3, 5, 6],
    6: [0, 1, 2, 3, 5, 6],
  };
  const days = base[daysPerWeek];
  return longDay === "sam" ? days.map((d) => (d >= 5 ? d - 1 : d)) : days;
}

function slotTypes(daysPerWeek: number, level: Level): SessionType[] {
  const second: SessionType = level === "debutant" ? "easy" : "tempo";
  switch (daysPerWeek) {
    case 3:
      return ["quality", "easy", "long"];
    case 4:
      return ["quality", "easy", "easy", "long"];
    case 5:
      return ["easy", "quality", second, "easy", "long"];
    default:
      return ["easy", "quality", "easy", second, "recovery", "long"];
  }
}

// ---------- Contenu des séances ----------
// Les séances de qualité et de tempo viennent du catalogue (workouts.ts).

function easySession(withStrides: boolean): { title: string; details: string } {
  return {
    title: "Footing",
    details:
      "Allure facile, tu dois pouvoir parler sans te hacher (effort 3-4/10)." +
      (withStrides ? " Termine par 4 lignes droites de 100 m progressives, marche entre chaque." : ""),
  };
}

function raceDetails(race: RaceKey): string {
  switch (race) {
    case "5k":
      return "Échauffement 10-15 min avant le départ. Pars à l'allure visée, pas plus vite, et accélère sur le dernier kilomètre s'il te reste du jus.";
    case "10k":
      return "Échauffement 10 min avant le départ. Reste patient sur le premier tiers, tiens ton allure au milieu, et donne tout sur les 2 derniers kilomètres.";
    case "semi":
      return "Pars 5 à 10 s/km plus lentement que ton allure cible sur les 3 premiers km. Bois à chaque ravitaillement, et garde de l'énergie pour les 5 derniers km.";
    default:
      return "Prends les 5 premiers km avec retenue. Bois et mange à chaque ravitaillement (un gel toutes les 40 min environ). La course commence vraiment après le 30e km.";
  }
}

const FOCUS: Record<Phase, string> = {
  base: "Construire l'endurance et habituer le corps à courir régulièrement.",
  construction: "Monter le volume et introduire des séances plus intenses.",
  specifique: "Travailler à l'allure de la course et allonger les sorties longues.",
  affutage: "Réduire le volume pour arriver frais, en gardant un peu d'intensité.",
  course: "Dernière ligne droite : rester frais, bien dormir, bien manger.",
};

// ---------- Génération ----------

export function generatePlan(input: PlanInput): Plan {
  const { race, level, daysPerWeek, longDay, today } = input;
  const info = RACES[race];
  const warnings: string[] = [];

  if (diffDays(today, input.raceDate) < 0) {
    throw new Error("La date de la course est déjà passée.");
  }

  // Début du plan : lundi de cette semaine, ou lundi suivant si on est en fin de semaine.
  const thisMonday = mondayOf(today);
  const nextMonday = addDays(thisMonday, 7);
  let start = thisMonday;
  if (weekdayIndex(today) >= 3 && diffDays(nextMonday, input.raceDate) >= 0) start = nextMonday;

  const raceWeek = Math.floor(diffDays(start, input.raceDate) / 7);
  const totalWeeks = raceWeek + 1;

  if (totalWeeks < info.minWeeks) {
    warnings.push(
      `Il reste ${totalWeeks} semaine${totalWeeks > 1 ? "s" : ""} avant la course. Pour un ${info.label.toLowerCase()}, ${info.minWeeks} semaines minimum sont recommandées. Le plan est condensé : écoute bien ton corps.`
    );
  }

  const peak = PEAK_KM[race][level];
  const estimate = Math.round(peak * 0.45);
  const rawStart = input.currentWeeklyKm > 0 ? input.currentWeeklyKm : estimate;
  const startKm = clamp(rawStart, 8, peak * 0.9);
  if (input.currentWeeklyKm > peak) {
    warnings.push(
      `Tu cours déjà plus que le volume maximal prévu pour ce niveau (${peak} km/sem.). Le plan reste autour de ce volume : passe au niveau supérieur si tu veux plus de charge.`
    );
  }

  const taperTotal = Math.min(TAPER_WEEKS[race], totalWeeks);
  const trainingWeeks = totalWeeks - taperTotal;
  if (trainingWeeks > 1) {
    const growth = Math.pow(peak / startKm, 1 / (trainingWeeks - 1)) - 1;
    if (growth > 0.12) {
      warnings.push(
        "La montée en charge est rapide (plus de 12 % par semaine en moyenne). Allonge le délai ou choisis une distance plus courte si tu ressens des douleurs."
      );
    }
  }

  const days = sessionDays(daysPerWeek, longDay);
  const slots = slotTypes(daysPerWeek, level);
  const raceDow = weekdayIndex(input.raceDate);
  const weeks: Week[] = [];
  /** Rang des séances de qualité déjà créées, par phase, et des tempos : ils font tourner les formats. */
  const qualityRank = new Map<Phase, number>();
  const longRank = new Map<Phase, number>();
  let tempoRank = 0;

  for (let w = 0; w < totalWeeks; w++) {
    const weekStart = addDays(start, w * 7);
    const isRaceWeek = w === raceWeek;
    const taperIdx = w - trainingWeeks; // >= 0 si la semaine est dans l'affûtage
    const inTaper = taperIdx >= 0 && !isRaceWeek;

    let phase: Phase;
    let volume: number;
    let isRecovery = false;

    if (isRaceWeek) {
      phase = "course";
      volume = 0;
    } else if (inTaper) {
      phase = "affutage";
      const factors = TAPER_FACTORS[race];
      const f = factors[factors.length - (taperTotal - 1 - taperIdx)] ?? 0.7;
      volume = peak * f;
    } else {
      const ratio = trainingWeeks > 1 ? w / (trainingWeeks - 1) : 1;
      volume = startKm + (peak - startKm) * ratio;
      const progress = w / Math.max(1, trainingWeeks);
      phase = progress < 0.35 ? "base" : progress < 0.75 ? "construction" : "specifique";
      isRecovery = (w + 1) % 4 === 0 && w < trainingWeeks - 1;
      if (isRecovery) volume *= 0.8;
    }

    const sessions: Session[] = [];

    if (isRaceWeek) {
      const shake = race === "marathon" || race === "semi" ? 5 : 4;
      if (raceDow - 3 >= 0) {
        sessions.push({
          id: `s-${addDays(weekStart, raceDow - 3)}`,
          date: addDays(weekStart, raceDow - 3),
          type: "shakeout",
          km: shake,
          title: "Footing d'affûtage",
          details: "Footing léger avec 4 lignes droites de 100 m pour garder les jambes vives. Rien de plus.",
        });
      }
      if (raceDow - 1 >= 0) {
        sessions.push({
          id: `s-${addDays(weekStart, raceDow - 1)}`,
          date: addDays(weekStart, raceDow - 1),
          type: "shakeout",
          km: 3,
          title: "Footing de veille",
          details: "20 min très faciles, 3 lignes droites courtes. Prépare ton équipement et mange un repas riche en glucides le soir.",
        });
      }
      sessions.push({
        id: `s-${input.raceDate}`,
        date: input.raceDate,
        type: "race",
        km: info.km,
        title: `Course : ${info.label}`,
        details: raceDetails(race),
      });
    } else {
      const longKm = clamp(Math.min(volume * LONG_SHARE[race], LONG_CAP[race]), 3, volume * 0.5);
      const qualityKm = Math.max(4, volume * (daysPerWeek >= 4 ? 0.2 : 0.25));
      const tempoKm = Math.max(4, volume * 0.15);
      const recKm = Math.max(3, volume * 0.08);

      const fixed = slots.reduce((acc, t) => {
        if (t === "long") return acc + longKm;
        if (t === "quality") return acc + qualityKm;
        if (t === "tempo") return acc + tempoKm;
        if (t === "recovery") return acc + recKm;
        return acc;
      }, 0);
      const easyCount = slots.filter((t) => t === "easy").length;
      const easyKm = Math.max(3, (volume - fixed) / Math.max(1, easyCount));

      let firstEasy = true;
      const phaseRank = qualityRank.get(phase) ?? 0;
      slots.forEach((type, i) => {
        const date = addDays(weekStart, days[i]);
        let km: number;
        let content: { title: string; details: string; workout?: Workout };
        switch (type) {
          case "long":
            km = longKm;
            content = longWorkout(race, phase, round05(km), isRecovery, longRank.get(phase) ?? 0);
            break;
          case "quality":
            km = qualityKm;
            content = qualityWorkout(race, phase, round05(km), phaseRank);
            break;
          case "tempo":
            km = tempoKm;
            content = tempoWorkout(round05(km), tempoRank);
            tempoRank++;
            break;
          case "recovery":
            km = recKm;
            content = {
              title: "Footing de récupération",
              details: "Très lent (effort 2-3/10). Cette séance sert à digérer la charge, pas à progresser.",
            };
            break;
          default:
            km = easyKm;
            content = easySession(firstEasy && level !== "debutant" && phase !== "base");
            firstEasy = false;
        }
        sessions.push({ id: `s-${date}`, date, type, km: round05(km), ...content });
      });
    }

    if (!isRaceWeek && !isRecovery) longRank.set(phase, (longRank.get(phase) ?? 0) + 1);
    if (slots.includes("quality") && !isRaceWeek) qualityRank.set(phase, (qualityRank.get(phase) ?? 0) + 1);

    // Les séances déjà passées (début de plan en cours de semaine) sont ignorées.
    const kept = sessions.filter((s) => diffDays(today, s.date) >= 0).sort((a, b) => a.date.localeCompare(b.date));

    weeks.push({
      index: w,
      startDate: weekStart,
      phase,
      isRecovery,
      focus: isRecovery ? "Semaine allégée pour assimiler les efforts des semaines précédentes." : FOCUS[phase],
      totalKm: round05(kept.reduce((acc, s) => acc + s.km, 0)),
      sessions: kept,
    });
  }

  return { input, weeks, warnings, createdAt: today };
}
