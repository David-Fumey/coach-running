// Catalogue des séances structurées (qualité et tempo) : fartlek, côtes, pyramides, fractionné, blocs d'allure de
// course, intervalles au seuil, sortie progressive. TypeScript pur.
//
// Chaque générateur renvoie le titre, le texte du plan et le déroulé sous forme de données (`Workout`), dont se sert
// ensuite l'affichage pas à pas. Le format change d'une séance à l'autre (rotation) et s'allonge d'un cycle à l'autre
// (progression) ; le nombre de répétitions suit les kilomètres de la séance, donc le volume de la semaine.

import type { Phase, Plan, RaceKey, Rest, Seg, Session, Workout, WorkSet } from "./plan.ts";

export interface Built {
  title: string;
  details: string;
  workout: Workout;
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const km1 = (x: number) => (Number.isInteger(x) ? `${x}` : x.toFixed(1).replace(".", ","));

/** 400 → « 400 m », 1600 → « 1,6 km ». */
export function fmtMeters(m: number): string {
  return m >= 1000 ? `${km1(m / 1000)} km` : `${m} m`;
}

/** 45 → « 45 s », 90 → « 1 min 30 », 120 → « 2 min ». */
export function fmtSeconds(s: number): string {
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r === 0 ? `${m} min` : `${m} min ${String(r).padStart(2, "0")}`;
}

const RACE_NAME: Record<RaceKey, string> = { "5k": "5 km", "10k": "10 km", semi: "semi-marathon", marathon: "marathon" };
const WARM = "2 km d'échauffement facile, puis ";
const COOL = ", et 1 km de retour au calme.";

const jog = (seconds: number): Rest => ({ seconds });
const uniform = (times: number, work: Seg, rest: Rest): WorkSet[] => [{ times, work, rest }];

/** Récupération entre deux efforts de la longueur donnée (m) : plus l'effort est long, plus elle l'est. */
const restForMeters = (m: number): number => (m <= 300 ? 60 : m <= 600 ? 90 : m <= 1200 ? 120 : 150);

// ---------- Séances de qualité ----------

const PYRAMIDS: number[][] = [
  [200, 400, 600, 800, 600, 400, 200],
  [400, 800, 1200, 800, 400],
  [200, 400, 600, 800, 1000, 800, 600, 400, 200],
];

/** Longueurs des répétitions de construction, d'un cycle à l'autre (cycle = tour complet de la rotation). */
const INTERVAL_LENGTHS: Record<RaceKey, number[]> = {
  "5k": [400, 600, 800, 1000],
  "10k": [800, 1000, 1200, 1600],
  semi: [1000, 1200, 1600, 2000],
  marathon: [1000, 1200, 1600, 2000],
};

const RACE_REP_LENGTHS: Record<"5k" | "10k", number[]> = { "5k": [600, 800, 1000], "10k": [1000, 1600, 2000] };

function fartlek(km: number): Built {
  const work = Math.max(1, km - 3);
  const reps = clamp(Math.round(work / 0.6), 4, 10);
  return {
    title: "Fartlek",
    details: `${WARM}${reps} × (1 min soutenue / 1 min 30 de trot facile)${COOL} Effort 7/10 sur les phases rapides, sans chronomètre.`,
    workout: { format: "fartlek", warmKm: 2, coolKm: 1, sets: uniform(reps, { seconds: 60, intensity: "soutenu" }, jog(90)) },
  };
}

function fartlekPyramid(km: number): Built {
  const work = Math.max(1, km - 3);
  const rounds = clamp(Math.round(work / 2.2), 1, 2);
  const mins = [1, 2, 3, 2, 1];
  const rests = [60, 90, 120, 90, 120];
  const sets: WorkSet[] = [];
  for (let r = 0; r < rounds; r++) {
    mins.forEach((m, i) => sets.push({ times: 1, work: { seconds: m * 60, intensity: "soutenu" }, ...(r === rounds - 1 && i === mins.length - 1 ? {} : { rest: jog(rests[i]) }) }));
  }
  return {
    title: "Fartlek en pyramide",
    details: `${WARM}${rounds === 2 ? "2 pyramides de " : "une pyramide : "}1 – 2 – 3 – 2 – 1 min soutenues, récupération en trottant (1 à 2 min) entre chaque effort${COOL} Effort 7/10, sans chronomètre.`,
    workout: { format: "fartlek-pyramide", warmKm: 2, coolKm: 1, sets },
  };
}

function hills(km: number, cycle: number, long: boolean): Built {
  const work = Math.max(1, km - 3);
  const secs = long ? 60 + 15 * Math.min(cycle, 2) : 30 + 10 * Math.min(cycle, 2);
  const reps = long ? clamp(Math.round(work / 0.45), 4, 8) : clamp(Math.round(work / 0.3), 5, 10);
  return {
    title: "Côtes",
    details: `${WARM}${reps} × ${fmtSeconds(secs)} en côte (pente de 4 à 6 %, effort 8/10), redescente en trottant${COOL}`,
    workout: { format: "cotes", warmKm: 2, coolKm: 1, sets: uniform(reps, { seconds: secs, intensity: "soutenu", hill: true }, jog(Math.round(secs * (long ? 1.5 : 2)))) },
  };
}

function intervals(race: RaceKey, km: number, cycle: number): Built {
  const work = Math.max(1, km - 3);
  const lens = INTERVAL_LENGTHS[race];
  const len = lens[Math.min(cycle, lens.length - 1)];
  const reps = clamp(Math.round(work / (len / 1000)), len >= 1600 ? 2 : 3, 12);
  const intensity = race === "5k" ? "5k" : "10k";
  const where = race === "5k" ? "à allure 5 km (effort 9/10)" : "à allure 10 km (effort 8/10)";
  const rest = restForMeters(len);
  return {
    title: "Fractionné",
    details: `${WARM}${reps} × ${fmtMeters(len)} ${where}, récupération en trottinant ${fmtSeconds(rest)} entre les répétitions${COOL}`,
    workout: { format: "fractionne", warmKm: 2, coolKm: 1, sets: uniform(reps, { meters: len, intensity }, jog(rest)) },
  };
}

function pyramid(race: RaceKey, km: number): Built {
  const work = Math.max(1, km - 3);
  const fits = PYRAMIDS.filter((p) => p.reduce((s, m) => s + m, 0) / 1000 <= work + 0.4);
  const shape = fits.length > 0 ? fits[fits.length - 1] : PYRAMIDS[0];
  const intensity = race === "5k" || race === "10k" ? "5k" : "10k";
  const sets: WorkSet[] = shape.map((m, i) => ({ times: 1, work: { meters: m, intensity }, ...(i === shape.length - 1 ? {} : { rest: jog(restForMeters(m)) }) }));
  const where = intensity === "5k" ? "à allure 5 km (effort 9/10)" : "à allure 10 km (effort 8/10)";
  return {
    title: "Pyramide",
    details: `${WARM}pyramide ${shape.join(" – ")} m ${where}, récupération en trottinant (1 à 2 min) entre les efforts${COOL}`,
    workout: { format: "pyramide", warmKm: 2, coolKm: 1, sets },
  };
}

function raceBlocks(race: "semi" | "marathon", km: number): Built {
  const work = Math.max(1, km - 3);
  const block = Math.max(2, Math.round(work));
  const name = RACE_NAME[race];
  const seg = (m: number): Seg => ({ meters: m * 1000, intensity: "course" });
  const sets: WorkSet[] =
    block >= 6
      ? [{ times: 1, work: seg(Math.ceil(block / 2)), rest: jog(120) }, { times: 1, work: seg(Math.floor(block / 2)) }]
      : [{ times: 1, work: seg(block) }];
  return {
    title: `Blocs allure ${name}`,
    details: `${WARM}${block} km à allure ${name} en 1 ou 2 blocs, récupération 2 min de trot entre les blocs${COOL}`,
    workout: { format: "blocs-course", warmKm: 2, coolKm: 1, sets, ...(block >= 6 ? { note: "Tu peux aussi enchaîner les deux blocs d'un seul tenant." } : {}) },
  };
}

function raceIntervals(race: "semi" | "marathon", km: number, cycle: number): Built {
  const work = Math.max(1, km - 3);
  const len = [2, 2.5, 3][Math.min(cycle, 2)];
  const reps = clamp(Math.round(work / len), 2, 6);
  const name = RACE_NAME[race];
  return {
    title: `Intervalles allure ${name}`,
    details: `${WARM}${reps} × ${km1(len)} km à allure ${name}, récupération 2 min de trot entre les répétitions${COOL}`,
    workout: { format: "intervalles-course", warmKm: 2, coolKm: 1, sets: uniform(reps, { meters: len * 1000, intensity: "course" }, jog(120)) },
  };
}

function racePaceReps(race: "5k" | "10k", km: number, cycle: number): Built {
  const work = Math.max(1, km - 3);
  const lens = RACE_REP_LENGTHS[race];
  const len = lens[Math.min(cycle, lens.length - 1)];
  const reps = clamp(Math.round(work / (len / 1000)), len >= 1600 ? 2 : 3, 12);
  const rest = len >= 1600 ? 150 : 90;
  return {
    title: "Fractionné",
    details: `${WARM}${reps} × ${fmtMeters(len)} à allure de course ou un peu plus vite, récupération en trottinant ${fmtSeconds(rest)} entre les répétitions${COOL}`,
    workout: { format: "fractionne-course", warmKm: 2, coolKm: 1, sets: uniform(reps, { meters: len, intensity: "coursePlus" }, jog(rest)) },
  };
}

function sharpIntervals(km: number): Built {
  const work = Math.max(1, km - 3);
  const reps = clamp(Math.round(work / 0.4), 6, 14);
  return {
    title: "Fractionné vif",
    details: `${WARM}${reps} × 400 m à allure 5 km (effort 9/10), récupération en trottinant 1 min 15 entre les répétitions${COOL} Garde de la vitesse sans chercher l'épuisement.`,
    workout: { format: "fractionne-vif", warmKm: 2, coolKm: 1, sets: uniform(reps, { meters: 400, intensity: "5k" }, jog(75)) },
  };
}

function progressive(race: "semi" | "marathon", km: number): Built {
  const total = Math.max(5, Math.round(km));
  const hard = Math.max(1, Math.round(total * 0.2));
  const mid = Math.max(1, Math.round(total * 0.3));
  const easy = total - mid - hard;
  const name = RACE_NAME[race];
  return {
    title: "Sortie progressive",
    details: `${easy} km à allure facile, puis ${mid} km à allure ${name}, et ${hard} km au seuil (effort 7/10) pour finir. Accélère petit à petit, sans à-coup.`,
    workout: {
      format: "progressive",
      warmKm: 0,
      coolKm: 0,
      sets: [
        { times: 1, work: { meters: easy * 1000, intensity: "facile" } },
        { times: 1, work: { meters: mid * 1000, intensity: "course" } },
        { times: 1, work: { meters: hard * 1000, intensity: "seuil" } },
      ],
    },
  };
}

function taperReps(race: RaceKey, km: number): Built {
  const work = Math.max(1, km - 3);
  const len = { "5k": 400, "10k": 600, semi: 800, marathon: 1000 }[race];
  const reps = clamp(Math.round(work / (len / 1000)), 3, 8);
  return {
    title: "Rappel d'allure",
    details: `${WARM}${reps} × ${fmtMeters(len)} à allure de course, récupération en trottinant 1 min 30 entre les répétitions${COOL} Les jambes doivent rester fraîches : arrête-toi dès que c'est facile.`,
    workout: { format: "rappel-allure", warmKm: 2, coolKm: 1, sets: uniform(reps, { meters: len, intensity: "course" }, jog(90)) },
  };
}

/**
 * Séance de qualité. `n` : rang de cette séance parmi celles de la phase (0 pour la première), qui fait tourner les
 * formats puis allonge les répétitions au tour suivant.
 */
export function qualityWorkout(race: RaceKey, phase: Phase, km: number, n: number): Built {
  if (phase === "base") {
    const cycle = Math.floor(n / 3);
    switch (n % 3) {
      case 0:
        return fartlek(km);
      case 1:
        return hills(km, cycle, false);
      default:
        return fartlekPyramid(km);
    }
  }
  if (phase === "specifique") {
    if (race === "semi" || race === "marathon") {
      const cycle = Math.floor(n / 3);
      switch (n % 3) {
        case 0:
          return raceBlocks(race, km);
        case 1:
          return raceIntervals(race, km, cycle);
        default:
          return progressive(race, km);
      }
    }
    const cycle = Math.floor(n / 2);
    return n % 2 === 0 ? racePaceReps(race, km, cycle) : sharpIntervals(km);
  }
  if (phase === "construction") {
    const cycle = Math.floor(n / 3);
    switch (n % 3) {
      case 0:
        return intervals(race, km, cycle);
      case 1:
        return pyramid(race, km);
      default:
        return hills(km, cycle, true);
    }
  }
  return taperReps(race, km);
}

// ---------- Tempo ----------

function continuousTempo(km: number): Built {
  const work = Math.max(2, Math.round(km - 3));
  return {
    title: "Tempo",
    details: `2 km d'échauffement facile, ${work} km à allure seuil (effort 7/10, tu ne peux dire que quelques mots), 1 km de retour au calme.`,
    workout: { format: "tempo", warmKm: 2, coolKm: 1, sets: [{ times: 1, work: { meters: work * 1000, intensity: "seuil" } }] },
  };
}

function cruiseIntervals(km: number, cycle: number): Built {
  const work = Math.max(2, Math.round(km - 3));
  const block = Math.min([1, 1.5, 2, 3][Math.min(cycle, 3)], Math.max(1, Math.floor(work) / 2));
  const reps = clamp(Math.round(work / block), 2, 6);
  const rest = block <= 1.5 ? 90 : 120;
  return {
    title: "Intervalles au seuil",
    details: `2 km d'échauffement facile, ${reps} × ${km1(block)} km à allure seuil (effort 7/10), récupération en trottinant ${fmtSeconds(rest)} entre les répétitions, 1 km de retour au calme.`,
    workout: { format: "seuil-intervalles", warmKm: 2, coolKm: 1, sets: uniform(reps, { meters: block * 1000, intensity: "seuil" }, jog(rest)) },
  };
}

/** Séance du créneau « tempo » : un bloc continu, puis des intervalles au seuil, en alternance. */
export function tempoWorkout(km: number, n: number): Built {
  return n % 2 === 0 ? continuousTempo(km) : cruiseIntervals(km, Math.floor(n / 2));
}

// ---------- Plans enregistrés avant le catalogue ----------

/** Déroulé d'une séance de qualité écrite avant le catalogue (même contenu qu'à l'époque). */
export function legacyQualityWorkout(race: RaceKey, phase: Phase, km: number): Workout {
  if (phase === "base") return fartlek(km).workout;
  if (phase === "specifique" && (race === "semi" || race === "marathon")) return raceBlocks(race, km).workout;
  const work = Math.max(1, km - 3);
  const len = { "5k": 0.4, "10k": 1, semi: 1, marathon: 1.6 }[race];
  const reps = clamp(Math.round(work / len), 3, 12);
  const rest = len < 1 ? 75 : 120;
  const intensity = phase === "specifique" ? "coursePlus" : "10k";
  return { format: "fractionne", warmKm: 2, coolKm: 1, sets: uniform(reps, { meters: Math.round(len * 1000), intensity }, jog(rest)) };
}

/** Déroulé d'un tempo écrit avant le catalogue. */
export function legacyTempoWorkout(km: number): Workout {
  return continuousTempo(km).workout;
}

// ---------- Mise à jour d'un plan enregistré ----------

const upgradable = (s: Session, done: Record<string, boolean>, today: string) =>
  (s.type === "quality" || s.type === "tempo") && !s.workout && s.date >= today && !done[s.id];

/** Nombre de séances à venir (qualité, tempo) qui n'ont pas encore le déroulé du catalogue. */
export function upgradableCount(plan: Plan, done: Record<string, boolean>, today: string): number {
  return plan.weeks.reduce((n, w) => n + w.sessions.filter((s) => upgradable(s, done, today)).length, 0);
}

/**
 * Remplace les séances de qualité et de tempo à venir par celles du catalogue, avec les mêmes dates et les mêmes
 * kilomètres. Les séances déjà faites ou passées, et toutes les autres, ne bougent pas. Le rang de rotation se compte
 * sur tout le plan (phase par phase), comme à la création.
 */
export function upgradePlan(plan: Plan, done: Record<string, boolean>, today: string): Plan {
  const rank = new Map<Phase, number>();
  let tempoRank = 0;
  const weeks = plan.weeks.map((w) => {
    const phaseRank = rank.get(w.phase) ?? 0;
    if (w.sessions.some((s) => s.type === "quality")) rank.set(w.phase, phaseRank + 1);
    return {
      ...w,
      sessions: w.sessions.map((s) => {
        let built: Built | null = null;
        if (s.type === "quality") built = upgradable(s, done, today) ? qualityWorkout(plan.input.race, w.phase, s.km, phaseRank) : null;
        else if (s.type === "tempo") {
          built = upgradable(s, done, today) ? tempoWorkout(s.km, tempoRank) : null;
          tempoRank++;
        }
        return built ? { ...s, title: built.title, details: built.details, workout: built.workout } : s;
      }),
    };
  });
  return { ...plan, weeks };
}
