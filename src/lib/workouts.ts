// Catalogue des séances structurées (qualité et tempo) : fartlek, côtes, pyramides, fractionné, blocs d'allure de
// course, intervalles au seuil, sortie progressive. TypeScript pur.
//
// Chaque générateur renvoie le titre, le texte du plan et le déroulé sous forme de données (`Workout`), dont se sert
// ensuite l'affichage pas à pas. Le format change d'une séance à l'autre (rotation) et s'allonge d'un cycle à l'autre
// (progression) ; le nombre de répétitions suit les kilomètres de la séance, donc le volume de la semaine.

import type { Intensity, Level, Phase, Plan, PlanInput, RaceKey, Rest, Seg, Session, Workout, WorkSet } from "./plan.ts";

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

/**
 * Niveau du coureur : un avancé démarre un cran plus loin dans la progression des répétitions, un débutant
 * s'arrête au deuxième cran.
 */
export function levelCycle(level: Level, cycle: number): number {
  return level === "avance" ? cycle + 1 : level === "debutant" ? Math.min(cycle, 1) : cycle;
}

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
export function qualityWorkout(race: RaceKey, phase: Phase, km: number, n: number, level: Level = "intermediaire"): Built {
  const lv = (cycle: number) => levelCycle(level, cycle);
  if (phase === "base") {
    const cycle = lv(Math.floor(n / 3));
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
      const cycle = lv(Math.floor(n / 3));
      switch (n % 3) {
        case 0:
          return raceBlocks(race, km);
        case 1:
          return raceIntervals(race, km, cycle);
        default:
          return progressive(race, km);
      }
    }
    const cycle = lv(Math.floor(n / 2));
    return n % 2 === 0 ? racePaceReps(race, km, cycle) : sharpIntervals(km);
  }
  if (phase === "construction") {
    const cycle = lv(Math.floor(n / 3));
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
export function tempoWorkout(km: number, n: number, level: Level = "intermediaire"): Built {
  return n % 2 === 0 ? continuousTempo(km) : cruiseIntervals(km, levelCycle(level, Math.floor(n / 2)));
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

// ---------- Séance de contrôle ----------

/** Distance totale de la séance de test : 2 km d'échauffement, 5 km chronométrés, 1 km de retour au calme. */
export const TEST_SESSION_KM = 8;

export function testWorkout(): Built {
  return {
    title: "Test 5 km chronométré",
    details: `${WARM}5 km chronométrés : pars à l'allure que tu penses tenir jusqu'au bout, reste régulier et accélère sur le dernier kilomètre s'il te reste du jus${COOL} Note ton temps sur les 5 km : il recale tes allures cibles. Évite une grosse séance la veille.`,
    workout: { format: "test-5k", warmKm: 2, coolKm: 1, sets: [{ times: 1, work: { meters: 5000, intensity: "test" } }] },
  };
}

// ---------- Mise à jour d'un plan enregistré ----------

const upgradable = (s: Session, done: Record<string, boolean>, today: string, walking = false) =>
  (s.type === "quality" || s.type === "tempo" || s.type === "long" || (walking && (s.type === "easy" || s.type === "recovery"))) &&
  !s.workout &&
  s.date >= today &&
  !done[s.id];

/** Semaines d'entraînement du plan (hors affûtage et course) : elles fixent la durée du course/marche. */
const trainingWeeksOf = (plan: Plan) => plan.weeks.filter((w) => w.phase !== "affutage" && w.phase !== "course").length;

/** Nombre de séances à venir qu'une mise à jour changerait (catalogue, course/marche, séances de test). */
export function upgradableCount(plan: Plan, done: Record<string, boolean>, today: string): number {
  const next = upgradePlan(plan, done, today);
  let n = 0;
  next.weeks.forEach((w, i) =>
    w.sessions.forEach((s, j) => {
      if (s !== plan.weeks[i].sessions[j]) n++;
    })
  );
  return n;
}

/**
 * Remplace les séances à venir par celles du catalogue, avec les mêmes dates et les mêmes kilomètres. Les séances
 * déjà faites ou passées ne bougent pas. Le rang de rotation se compte sur tout le plan (phase par phase), comme à la
 * création. Les phases de construction et spécifique qui n'ont pas de test en reçoivent un, à la place d'une séance de
 * qualité : le kilométrage de cette semaine-là change un peu.
 */
export function upgradePlan(plan: Plan, done: Record<string, boolean>, today: string): Plan {
  const rank = new Map<Phase, number>();
  const longRank = new Map<Phase, number>();
  let tempoRank = 0;
  const level = plan.input.level;
  const runWalk = needsRunWalk(plan.input);
  const trainingWeeks = trainingWeeksOf(plan);
  const walkWeeks = runWalkWeeks(trainingWeeks);
  const testsEnabled = trainingWeeks >= 8;
  const tested = new Set<Phase>(plan.weeks.filter((w) => w.sessions.some((s) => s.type === "test")).map((w) => w.phase));
  const weeks = plan.weeks.map((w) => {
    const walking = runWalk && w.index < walkWeeks;
    const stage = runWalkStage(w.index, walkWeeks);
    const testTarget =
      testsEnabled && (w.phase === "construction" || w.phase === "specifique") && !tested.has(w.phase) && !w.isRecovery && !walking
        ? w.sessions.find((s) => s.type === "quality" && s.date >= today && !done[s.id])
        : undefined;
    if (testTarget) tested.add(w.phase);
    const phaseRank = rank.get(w.phase) ?? 0;
    if (w.sessions.some((s) => s.type === "quality") && !testTarget) rank.set(w.phase, phaseRank + 1);
    const longN = longRank.get(w.phase) ?? 0;
    if (!w.isRecovery && w.sessions.some((s) => s.type === "long")) longRank.set(w.phase, longN + 1);
    const sessions = w.sessions.map((s) => {
      if (s === testTarget) {
        const t = testWorkout();
        return { ...s, type: "test" as const, km: TEST_SESSION_KM, title: t.title, details: t.details, workout: t.workout };
      }
      let built: Built | null = null;
      if (!upgradable(s, done, today, walking)) {
        if (s.type === "tempo") tempoRank++;
      } else if (s.type === "quality") built = walking ? fartlekWalk(s.km) : qualityWorkout(plan.input.race, w.phase, s.km, phaseRank, level);
      else if (s.type === "long") built = walking ? runWalkWorkout(s.km, stage + 1, true) : longWorkout(plan.input.race, w.phase, s.km, w.isRecovery, longN, level);
      else if (s.type === "tempo") {
        built = tempoWorkout(s.km, tempoRank, level);
        tempoRank++;
      } else built = runWalkWorkout(s.km, stage, false);
      return built ? { ...s, title: built.title, details: built.details, workout: built.workout } : s;
    });
    return testTarget ? { ...w, sessions, totalKm: r05(sessions.reduce((acc, x) => acc + x.km, 0)) } : { ...w, sessions };
  });
  return { ...plan, weeks };
}

// ---------- Sorties longues ----------

const r05 = (x: number) => Math.round(x * 2) / 2;
const km = (x: number) => km1(x);
const EASY_NOTE = "Emporte de l'eau, et un gel ou des fruits secs si tu dépasses 1 h 15.";
const facile = (kmCount: number): WorkSet => ({ times: 1, work: { meters: Math.round(kmCount * 1000), intensity: "facile" } });
const effortSet = (kmCount: number, intensity: Intensity): WorkSet => ({ times: 1, work: { meters: Math.round(kmCount * 1000), intensity } });

function longPlain(kmTotal: number): Built {
  return {
    title: "Sortie longue",
    details: "Allure facile et régulière (effort 3-4/10). Le but est de tenir la durée, pas d'aller vite. Bois régulièrement si la sortie dépasse 1 h.",
    workout: { format: "longue-facile", warmKm: 0, coolKm: 0, sets: [facile(kmTotal)] },
  };
}

function longRaceFinish(race: "semi" | "marathon", kmTotal: number): Built {
  const finish = Math.round(kmTotal * 0.3);
  return {
    title: "Sortie longue",
    details: `Allure facile (effort 3-4/10), puis les ${finish} derniers km à allure ${RACE_NAME[race]}. ${EASY_NOTE}`,
    workout: { format: "longue-fin-course", warmKm: 0, coolKm: 0, sets: [facile(kmTotal - finish), effortSet(finish, "course")] },
  };
}

function longProgressive(race: RaceKey, phase: Phase, kmTotal: number): Built {
  const hard = Math.max(1, r05(kmTotal * 0.25));
  const intensity: Intensity = phase === "specifique" && (race === "semi" || race === "marathon") ? "course" : "marathon";
  const label = intensity === "course" ? `allure ${RACE_NAME[race]}` : "allure marathon";
  return {
    title: "Sortie longue progressive",
    details: `${km(kmTotal - hard)} km à allure facile (effort 3-4/10), puis ${km(hard)} km en accélérant doucement jusqu'à ${label}. ${EASY_NOTE}`,
    workout: { format: "longue-progressive", warmKm: 0, coolKm: 0, sets: [facile(kmTotal - hard), effortSet(hard, intensity)] },
  };
}

function longAlternating(race: RaceKey, phase: Phase, kmTotal: number): Built {
  const specific = phase === "specifique" && (race === "semi" || race === "marathon");
  const block = specific ? 2 : 1;
  const intensity: Intensity = specific ? "course" : "marathon";
  const start = r05(kmTotal * 0.3);
  const count = Math.floor((kmTotal - start) / (2 * block));
  if (count < 2) return longProgressive(race, phase, kmTotal);
  const sets: WorkSet[] = [facile(start)];
  for (let i = 0; i < count; i++) sets.push(effortSet(block, intensity), facile(block));
  const left = r05(kmTotal - start - 2 * block * count);
  if (left > 0) sets.push(facile(left));
  const label = specific ? `allure ${RACE_NAME[race]}` : "allure marathon";
  return {
    title: "Sortie longue en alternance",
    details: `${km(start)} km à allure facile (effort 3-4/10), puis ${count} × (${km(block)} km à ${label} / ${km(block)} km facile)${left > 0 ? `, et ${km(left)} km ${left > 1 ? "faciles" : "facile"} pour finir` : ""}. ${EASY_NOTE}`,
    workout: { format: "longue-alternance", warmKm: 0, coolKm: 0, sets },
  };
}

function longThreshold(race: RaceKey, phase: Phase, kmTotal: number): Built {
  const start = r05(kmTotal * 0.3);
  let reps = kmTotal >= 18 ? 3 : 2;
  while (reps > 1 && start + reps * 2 + (reps - 1) > kmTotal - 1) reps--;
  if (reps < 2) return longProgressive(race, phase, kmTotal);
  const sets: WorkSet[] = [facile(start)];
  for (let i = 0; i < reps; i++) {
    sets.push(effortSet(2, "seuil"));
    if (i < reps - 1) sets.push(facile(1));
  }
  const left = r05(kmTotal - start - 2 * reps - (reps - 1));
  if (left > 0) sets.push(facile(left));
  return {
    title: "Sortie longue avec blocs au seuil",
    details: `${km(start)} km à allure facile (effort 3-4/10), puis ${reps} × 2 km au seuil (effort 7/10), 1 km facile entre les blocs${left > 0 ? `, et ${km(left)} km ${left > 1 ? "faciles" : "facile"} pour finir` : ""}. ${EASY_NOTE}`,
    workout: { format: "longue-seuil", warmKm: 0, coolKm: 0, sets },
  };
}

/**
 * Sortie longue. `n` : rang parmi les sorties longues de la phase (hors semaines de récupération, toujours faciles).
 * Le facile domine ; progressive, alternance et blocs au seuil reviennent de temps en temps quand la distance le permet.
 */
export function longWorkout(race: RaceKey, phase: Phase, kmTotal: number, recovery: boolean, n: number, level: Level = "intermediaire"): Built {
  if (recovery || phase === "affutage" || phase === "course") return longPlain(kmTotal);
  if (phase === "base") return n % 3 === 2 && kmTotal >= 8 ? longProgressive(race, phase, kmTotal) : longPlain(kmTotal);
  if (phase === "construction") {
    switch (n % 6) {
      case 1:
        return kmTotal >= 8 ? longProgressive(race, phase, kmTotal) : longPlain(kmTotal);
      case 3:
        return kmTotal >= 12 && level !== "debutant" ? longAlternating(race, phase, kmTotal) : longPlain(kmTotal);
      case 5:
        return kmTotal >= 12 && level !== "debutant" ? longThreshold(race, phase, kmTotal) : longProgressive(race, phase, kmTotal);
      default:
        return longPlain(kmTotal);
    }
  }
  if (race === "semi" || race === "marathon") {
    if (kmTotal >= 14) return n % 2 === 0 || level === "debutant" ? longRaceFinish(race, kmTotal) : longAlternating(race, phase, kmTotal);
    return n % 2 === 1 ? longProgressive(race, phase, kmTotal) : longPlain(kmTotal);
  }
  return n % 2 === 1 && kmTotal >= 8 ? longProgressive(race, phase, kmTotal) : longPlain(kmTotal);
}

// ---------- Course/marche pour les débutants ----------

/** Course et marche en secondes, de plus en plus de course d'un palier à l'autre. */
export const RUN_WALK_STAGES: [number, number][] = [
  [60, 90],
  [90, 90],
  [120, 90],
  [180, 90],
  [300, 90],
  [480, 60],
  [600, 60],
];

/** Un débutant qui court peu (10 km par semaine ou moins, ou rien de saisi) commence par alterner course et marche. */
export function needsRunWalk(input: Pick<PlanInput, "level" | "currentWeeklyKm">): boolean {
  return input.level === "debutant" && input.currentWeeklyKm <= 10;
}

/** Nombre de semaines de course/marche : 40 % de la préparation, entre 3 et 8 semaines. */
export function runWalkWeeks(trainingWeeks: number): number {
  return clamp(Math.round(trainingWeeks * 0.4), 3, 8);
}

/** Palier de la semaine `week` : on parcourt tous les paliers sur la durée du course/marche. */
export function runWalkStage(week: number, walkWeeks: number): number {
  return clamp(Math.floor((week * RUN_WALK_STAGES.length) / walkWeeks), 0, RUN_WALK_STAGES.length - 1);
}

const WALK_BREAK: Seg = { seconds: 300, intensity: "facile", walk: true };

/** Séance de course/marche au palier donné ; la durée suit les kilomètres de la séance (environ 8 min par km). */
export function runWalkWorkout(kmTotal: number, stage: number, long: boolean): Built {
  const [run, walk] = RUN_WALK_STAGES[clamp(stage, 0, RUN_WALK_STAGES.length - 1)];
  const minutes = clamp(Math.round(kmTotal * 8), 20, 80);
  const reps = clamp(Math.floor(((minutes - 10) * 60) / (run + walk)), 3, 24);
  return {
    title: long ? "Sortie longue course/marche" : "Course/marche",
    details: `5 min de marche rapide, puis ${reps} × (${fmtSeconds(run)} de course facile / ${fmtSeconds(walk)} de marche), et 5 min de marche pour finir. Cours assez doucement pour pouvoir parler : si tu es essoufflé, ralentis ou marche un peu plus.`,
    workout: { format: "course-marche", warmKm: 0, coolKm: 0, warm: WALK_BREAK, cool: WALK_BREAK, sets: uniform(reps, { seconds: run, intensity: "facile" }, { seconds: walk, walk: true }) },
  };
}

/** Fartlek des premières semaines d'un débutant : récupérations en marchant. */
export function fartlekWalk(kmTotal: number): Built {
  const reps = clamp(Math.round(Math.max(1, kmTotal - 3) / 0.6), 4, 6);
  return {
    title: "Fartlek en douceur",
    details: `5 min de marche rapide, puis 5 min de course facile, puis ${reps} × (1 min un peu plus vite / 1 min 30 de marche), et 5 min de marche pour finir. Effort 7/10 sur les phases rapides, sans chronomètre.`,
    workout: { format: "fartlek-marche", warmKm: 0, coolKm: 0, warm: WALK_BREAK, cool: WALK_BREAK, sets: [{ times: 1, work: { seconds: 300, intensity: "facile" } }, { times: reps, work: { seconds: 60, intensity: "soutenu" }, rest: { seconds: 90, walk: true } }] },
  };
}
