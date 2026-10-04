import { isDeepStrictEqual } from "node:util";
import { addDays as addDaysISO, generatePlan, type Plan, type PlanInput, type Session, type Week } from "../src/lib/plan.ts";
import { paceModel, targetsFor } from "../src/lib/paces.ts";
import { workoutBlocks } from "../src/lib/steps.ts";
import { FORMAT_STRESS, VERY_HARD_STRESS, fmtMeters, fmtSeconds, formatStress, legacyQualityWorkout, loadCap, longWorkout, qualityWorkout, tempoWorkout, upgradePlan, upgradableCount, weekLoad } from "../src/lib/workouts.ts";

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (!ok) {
    failures++;
    console.log("ECHEC", name, detail ?? "");
  } else console.log("ok   ", name);
}

const model = paceModel([], "2026-10-05", 6.2)!;
const input = (race: PlanInput["race"], raceDate: string, extra: Partial<PlanInput> = {}): PlanInput => ({
  race, raceDate, level: "intermediaire", daysPerWeek: 5, currentWeeklyKm: 25, longDay: "dim", today: "2026-10-05", ...extra,
});
const all = (p: Plan) => p.weeks.flatMap((w) => w.sessions.map((s) => ({ s, w })));
const quality = (p: Plan) => all(p).filter(({ s }) => s.type === "quality");
const formats = (list: { s: Session }[]) => list.map(({ s }) => s.workout!.format);

const marathon = generatePlan(input("marathon", "2027-04-04"));
const semi = generatePlan(input("semi", "2027-02-14"));
const tenK = generatePlan(input("10k", "2027-02-14"));

// ---------- Rotation ----------
const phaseFormats = (p: Plan, phase: Week["phase"]) => formats(quality(p).filter(({ w }) => w.phase === phase));
check("base : fartlek, côtes, fartlek en pyramide, puis recommence", phaseFormats(marathon, "base").slice(0, 4).join() === "fartlek,cotes,fartlek-pyramide,fartlek", phaseFormats(marathon, "base"));
check("construction : fractionné, pyramide, côtes", phaseFormats(marathon, "construction").slice(0, 3).join() === "fractionne,pyramide,cotes", phaseFormats(marathon, "construction"));
check("spécifique semi/marathon : blocs, intervalles, progressive", phaseFormats(marathon, "specifique").slice(0, 3).join() === "blocs-course,intervalles-course,progressive", phaseFormats(marathon, "specifique"));
check("spécifique 5 km/10 km : allure de course, puis fractionné vif", phaseFormats(tenK, "specifique").slice(0, 2).join() === "fractionne-course,fractionne-vif", phaseFormats(tenK, "specifique"));
check("affûtage : rappel d'allure", phaseFormats(marathon, "affutage").every((f) => f === "rappel-allure") && phaseFormats(marathon, "affutage").length > 0);
const variety = new Set(quality(marathon).map(({ s }) => s.title));
check("au moins 6 séances de qualité différentes sur un marathon", variety.size >= 6, [...variety]);

// ---------- Progression ----------
const lengths = (p: Plan, fmt: string) => quality(p).filter(({ s }) => s.workout!.format === fmt).map(({ s }) => s.workout!.sets[0].work.meters!);
const inter = lengths(semi, "fractionne");
check("fractionné de construction : les répétitions ne raccourcissent jamais", inter.every((m, i) => i === 0 || m >= inter[i - 1]) && inter.length >= 1, inter);
const hillSecs = quality(marathon).filter(({ s }) => s.workout!.format === "cotes").map(({ s }) => s.workout!.sets[0].work.seconds!);
check("côtes : les montées durent plus longtemps au fil du plan", hillSecs.length >= 2 && Math.max(...hillSecs) > Math.min(...hillSecs), hillSecs);
const tempos = all(marathon).filter(({ s }) => s.type === "tempo");
check("tempo : bloc continu puis intervalles au seuil, en alternance", tempos[0].s.workout!.format === "tempo" && tempos[1].s.workout!.format === "seuil-intervalles" && tempos[2].s.workout!.format === "tempo", tempos.map(({ s }) => s.workout!.format));
const cruise = tempos.filter(({ s }) => s.workout!.format === "seuil-intervalles").map(({ s }) => s.workout!.sets[0].work.meters!);
check("intervalles au seuil : les blocs s'allongent au fil du plan", Math.max(...cruise.slice(-3)) > cruise[0], cruise);

// ---------- Cohérence texte, données, déroulé ----------
let problem: unknown = null;
for (const race of ["5k", "10k", "semi", "marathon"] as const) {
  for (const level of ["debutant", "intermediaire", "avance"] as const) {
    for (const days of [3, 4, 5, 6] as const) {
      const p = generatePlan(input(race, race === "marathon" ? "2027-04-04" : "2027-02-14", { level, daysPerWeek: days }));
      for (const { s } of all(p).filter(({ s }) => s.type === "quality" || s.type === "tempo")) {
        const w = s.workout;
        if (!w) {
          problem = { sansDeroule: s.title };
          continue;
        }
        const reps = w.sets.length === 1 ? w.sets[0].times : 1;
        const m = /(\d+) ×/.exec(s.details);
        if (m && Number(m[1]) !== reps) problem = { title: s.title, details: s.details, reps };
        if (w.sets.some((x) => x.times < 1 || (x.work.meters === undefined && x.work.seconds === undefined))) problem = { title: s.title, sets: w.sets };
        if (w.sets.some((x) => x.times > 14)) problem = { trop: s.title, sets: w.sets };
        const blocks = workoutBlocks(p, s, model);
        const main = blocks?.find((b) => b.id === "main");
        if (!main || main.steps.length === 0) problem = { sansEtapes: s.title };
        else if (main.repeat === 1 && main.steps[main.steps.length - 1].kind === "rest") problem = { finSurRecup: s.title };
        // L'effort demandé ne dépasse pas la séance (échauffement et retour au calme exclus, marge pour les arrondis)
        const meters = w.sets.reduce((a, x) => a + x.times * (x.work.meters ?? 0), 0);
        if (w.warmKm > 0 && meters / 1000 > Math.max(s.km - 3, 2) + 1.5) problem = { demesure: s.title, km: s.km, meters };
      }
    }
  }
}
check("toutes distances, niveaux et fréquences : texte, données et déroulé cohérents", problem === null, problem);

// ---------- Détails des formats ----------
const pyr = qualityWorkout("10k", "construction", 11, 1);
const pm = pyr.workout.sets.map((x) => x.work.meters!);
check("pyramide : symétrique, sans récupération après le dernier effort", pm.join() === [...pm].reverse().join() && pyr.workout.sets[pm.length - 1].rest === undefined && pyr.workout.sets[0].rest !== undefined, pm);
check("pyramide : texte de la forme", pyr.details.includes(pm.join(" – ")), pyr.details);
check("pyramide : plus grande quand la séance est plus longue", qualityWorkout("10k", "construction", 14, 1).workout.sets.length >= pyr.workout.sets.length);
const hill = qualityWorkout("10k", "base", 8, 1);
check("côtes : montées en côte avec descente en trot", hill.workout.sets[0].work.hill === true && hill.workout.sets[0].rest!.seconds >= hill.workout.sets[0].work.seconds! * 1.5 && hill.title === "Côtes", hill);
const prog = qualityWorkout("marathon", "specifique", 14, 2);
const progKm = prog.workout.sets.reduce((a, x) => a + x.work.meters!, 0);
check("sortie progressive : facile, allure de course, seuil ; toute la distance, sans échauffement", prog.workout.sets.map((x) => x.work.intensity).join() === "facile,course,seuil" && progKm === 14000 && prog.workout.warmKm === 0, prog);
check("fartlek en pyramide : 1-2-3-2-1 min", qualityWorkout("10k", "base", 7, 2).workout.sets.slice(0, 5).map((x) => x.work.seconds! / 60).join() === "1,2,3,2,1");
const cr = tempoWorkout(10, 1);
check("intervalles au seuil : plusieurs blocs, trot entre eux", cr.workout.sets[0].times >= 2 && cr.workout.sets[0].rest!.seconds >= 90 && cr.details.includes("×"), cr);
check("rappel d'allure à l'affûtage : court", qualityWorkout("semi", "affutage", 8, 0).workout.sets[0].times <= 8);

// ---------- Plans sans le catalogue (anciens plans enregistrés) ----------
const old: Plan = JSON.parse(JSON.stringify(semi));
for (const { s } of all(old)) if (s.type !== "test") delete s.workout;
const oldQuality = all(old).find(({ s, w }) => s.type === "quality" && w.phase === "base")!;
const ob = workoutBlocks(old, oldQuality.s, model)!;
check("ancien plan : le fartlek garde son déroulé", ob.length === 3 && ob[1].steps[0].seconds === 60 && ob[1].repeat >= 4, ob[1]);
check("ancien plan : toutes les séances ont toujours un déroulé", all(old).every(({ s }) => workoutBlocks(old, s, model) !== null));
const legacy = legacyQualityWorkout("semi", "construction", 9);
check("ancien fractionné : répétitions de 1 km à allure 10 km", legacy.sets[0].work.meters === 1000 && legacy.sets[0].work.intensity === "10k");

// ---------- Sorties longues ----------
const longs = (p: Plan) => all(p).filter(({ s }) => s.type === "long");
const longFormats = (p: Plan, phase: Week["phase"]) => longs(p).filter(({ w }) => w.phase === phase && !w.isRecovery).map(({ s }) => s.workout!.format);
check("sorties longues : jamais sans déroulé", longs(marathon).every(({ s }) => s.workout !== undefined && s.workout.warmKm === 0 && s.workout.coolKm === 0));
check("sorties longues : la distance du déroulé = celle de la séance", [marathon, semi, tenK].every((p) => longs(p).every(({ s }) => s.workout!.sets.reduce((a, x) => a + x.times * (x.work.meters ?? 0), 0) === Math.round(s.km * 1000))), longs(marathon).map(({ s }) => [s.km, s.workout!.format]));
check("sorties longues : semaines de récupération et d'affûtage toujours faciles", longs(marathon).filter(({ w }) => w.isRecovery || w.phase === "affutage").every(({ s }) => s.workout!.format === "longue-facile"));
const allLongFormats = new Set(longs(marathon).map(({ s }) => s.workout!.format));
check("marathon sur 5 jours : au moins 4 formats de sortie longue différents", allLongFormats.size >= 4, [...allLongFormats]);
const marathon4 = generatePlan(input("marathon", "2027-04-04", { daysPerWeek: 4 }));
check("marathon sur 4 jours (une seule séance de travail) : tous les formats de sortie longue reviennent", new Set(longs(marathon4).map(({ s }) => s.workout!.format)).size >= 5, [...new Set(longs(marathon4).map(({ s }) => s.workout!.format))]);
check("spécifique marathon : fin à allure de course, puis alternance", longFormats(marathon, "specifique").slice(0, 2).join() === "longue-fin-course,longue-alternance", longFormats(marathon, "specifique"));
check("construction : le facile domine, avec de la variété", longFormats(marathon, "construction").filter((f) => f === "longue-facile").length >= 2 && new Set(longFormats(marathon, "construction")).size >= 3, longFormats(marathon, "construction"));
const lf = longWorkout("marathon", "specifique", 20, false, 0);
check("fin à allure de course : 30 % des km à allure marathon", lf.workout.sets.length === 2 && lf.workout.sets[1].work.meters === 6000 && lf.workout.sets[1].work.intensity === "course", lf.workout.sets);
const la = longWorkout("semi", "specifique", 18, false, 1);
check("alternance : commence facile, alterne allure de course et facile, finit facile", la.workout.sets[0].work.intensity === "facile" && la.workout.sets.slice(1).some((x) => x.work.intensity === "course") && la.workout.sets[la.workout.sets.length - 1].work.intensity === "facile" && la.title === "Sortie longue en alternance", la.workout.sets);
const lt = longWorkout("semi", "construction", 18, false, 5);
check("blocs au seuil : 3 × 2 km au seuil, 1 km facile entre eux", lt.workout.format === "longue-seuil" && lt.workout.sets.filter((x) => x.work.intensity === "seuil").length === 3 && lt.workout.sets.filter((x) => x.work.intensity === "facile" && x.work.meters === 1000).length >= 2, lt.workout.sets);
check("sortie longue courte : pas d'alternance ni de seuil", longWorkout("5k", "construction", 8, false, 3).workout.format === "longue-facile" && longWorkout("5k", "construction", 8, false, 5).workout.format === "longue-progressive");
check("sortie longue : récupération = facile quel que soit le rang", [0, 1, 2, 3, 4, 5, 6].every((n) => longWorkout("semi", "construction", 16, true, n).workout.format === "longue-facile"));

// ---------- Niveaux ----------
const beginner = generatePlan(input("10k", "2027-02-14", { level: "debutant", daysPerWeek: 4, currentWeeklyKm: 0 }));
const walkSessions = all(beginner).filter(({ s }) => s.workout?.format === "course-marche");
check("débutant qui court peu : les footings et la sortie longue des premières semaines sont en course/marche", walkSessions.length >= 12 && walkSessions.every(({ w }) => w.index < 8), walkSessions.length);
const walkWeeksSet = new Set(walkSessions.map(({ w }) => w.index));
check("course/marche : après quelques semaines, le footing se court d'un seul tenant", all(beginner).filter(({ s, w }) => s.type === "easy" && w.index >= Math.max(...walkWeeksSet) + 1).every(({ s }) => s.workout === undefined));
const runSecs = [...walkWeeksSet].sort((a, b) => a - b).map((i) => Math.max(...walkSessions.filter(({ w }) => w.index === i).map(({ s }) => s.workout!.sets[0].work.seconds!)));
check("course/marche : le temps de course s'allonge d'une semaine à l'autre", runSecs.every((x, i) => i === 0 || x >= runSecs[i - 1]) && runSecs[runSecs.length - 1] >= 8 * runSecs[0] / 2, runSecs);
const rw = walkSessions[0].s.workout!;
check("course/marche : 5 min de marche avant et après, marche entre les courses", rw.warm?.walk === true && rw.cool?.walk === true && rw.warm?.seconds === 300 && rw.sets[0].rest?.walk === true, rw);
check("course/marche : la durée de la séance reste raisonnable (20 à 85 min)", walkSessions.every(({ s }) => { const w = s.workout!; const t = 600 + w.sets[0].times * (w.sets[0].work.seconds! + w.sets[0].rest!.seconds); return t >= 20 * 60 - 200 && t <= 85 * 60; }));
const veteran = generatePlan(input("10k", "2027-02-14", { level: "debutant", daysPerWeek: 4, currentWeeklyKm: 20 }));
check("débutant qui court déjà 20 km par semaine : pas de course/marche", all(veteran).every(({ s }) => s.workout?.format !== "course-marche" && s.workout?.format !== "fartlek-marche"));
check("intermédiaire sans km saisis : pas de course/marche", all(generatePlan(input("10k", "2027-02-14", { currentWeeklyKm: 0 }))).every(({ s }) => s.workout?.format !== "course-marche"));
check("fartlek des débutants : récupérations en marchant", beginner.weeks[0].sessions.some((s) => s.workout?.format === "fartlek-marche" && s.workout.sets[1].rest?.walk === true));
const walkBlocks = workoutBlocks(beginner, walkSessions[0].s, model)!;
check("course/marche : déroulé Échauffement, Séance, Retour au calme avec marche", walkBlocks.map((b) => b.id).join() === "warmup,main,cooldown" && walkBlocks[0].steps[0].kind === "walk" && walkBlocks[1].steps[0].label === "Course facile" && walkBlocks[1].steps[1].label === "Marche de récupération", walkBlocks.map((b) => b.steps[0]));
check("course/marche : pas de comparaison d'allure (marche comprise)", targetsFor(model, beginner, walkSessions[0].s)!.comparable === false);
check("débutant : jamais d'alternance ni de blocs au seuil en sortie longue", longs(generatePlan(input("marathon", "2027-04-04", { level: "debutant", currentWeeklyKm: 25 }))).every(({ s }) => s.workout!.format !== "longue-seuil" && s.workout!.format !== "longue-alternance"));
const hardQ = (level: "debutant" | "intermediaire" | "avance") => quality(generatePlan(input("10k", "2027-02-14", { level, currentWeeklyKm: 25 }))).filter(({ s }) => s.workout!.format === "fractionne").map(({ s }) => s.workout!.sets[0].work.meters!);
const dq = hardQ("debutant"), iq = hardQ("intermediaire"), aq = hardQ("avance");
check("avancé : répétitions plus longues qu'un intermédiaire, qu'un débutant", Math.max(...aq) > Math.max(...iq) && Math.max(...iq) >= Math.max(...dq) && aq[0] > iq[0], { dq, iq, aq });
const adv4 = generatePlan(input("10k", "2027-02-14", { level: "avance", daysPerWeek: 4, currentWeeklyKm: 30 }));
const mid4 = generatePlan(input("10k", "2027-02-14", { level: "intermediaire", daysPerWeek: 4, currentWeeklyKm: 30 }));
const hardPerWeek = (p: Plan) => p.weeks.filter((w) => w.phase !== "course").map((w) => w.sessions.filter((s) => s.type === "quality" || s.type === "tempo" || s.type === "test").length);
check("avancé sur 4 jours : deux séances de travail par semaine, un intermédiaire une seule", hardPerWeek(adv4).slice(0, -1).every((n) => n === 2) && hardPerWeek(mid4).every((n) => n <= 1), [hardPerWeek(adv4), hardPerWeek(mid4)]);
check("avancé sur 4 jours : aucune séance plus longue que la sortie longue", adv4.weeks.every((w) => w.sessions.every((s) => s.type === "long" || w.sessions.find((x) => x.type === "long") === undefined || s.km <= w.sessions.find((x) => x.type === "long")!.km + 0.5)));
const walkPlanOld: Plan = JSON.parse(JSON.stringify(beginner));
for (const { s } of all(walkPlanOld)) if (s.type !== "test") delete s.workout;
check("ancien plan de débutant : la mise à jour donne le plan neuf", isDeepStrictEqual(upgradePlan(walkPlanOld, {}, "2026-10-05"), beginner));
check("ancien plan de débutant : les footings de course/marche sont à mettre à jour", upgradableCount(walkPlanOld, {}, "2026-10-05") > upgradableCount(beginner, {}, "2026-10-05") && upgradableCount(beginner, {}, "2026-10-05") === 0);

// ---------- Deuxième séance de qualité des avancés ----------
const second = (p: Plan) =>
  p.weeks
    .filter((w) => w.phase !== "course")
    .map((w) => ({ w, s: w.sessions.filter((x) => x.type === "tempo" || (x.type === "quality" && x.date > w.sessions.find((y) => y.type === "quality" || y.type === "test")!.date)) }))
    .filter(({ s }) => s.length > 0);
for (const days of [4, 5, 6] as const) {
  const adv = generatePlan(input("10k", "2027-02-14", { level: "avance", daysPerWeek: days, currentWeeklyKm: 40 }));
  const slots = second(adv).filter(({ w }) => !w.isRecovery).map(({ s }) => s[0].type);
  const odd = slots.filter((_, i) => i % 2 === 1);
  // Une séance de qualité prend la place du tempo une semaine sur deux, sauf quand elle ferait deux séances très dures.
  check(`avancé sur ${days} jours : le deuxième créneau alterne tempo et séance de qualité`, slots.length >= 10 && slots.every((t, i) => i % 2 === 1 || t === "tempo") && odd.filter((t) => t === "quality").length >= Math.ceil(odd.length / 2), slots);
  const clash = adv.weeks.filter((w) => w.sessions.filter((x) => x.type === "quality").length === 2 && w.sessions.filter((x) => x.type === "quality")[0].workout!.format === w.sessions.filter((x) => x.type === "quality")[1].workout!.format);
  check(`avancé sur ${days} jours : les deux séances de qualité d'une semaine sont de formats différents`, clash.length === 0, clash.map((w) => w.index));
  check(`avancé sur ${days} jours : pas de deuxième séance de qualité en semaine de récupération`, adv.weeks.filter((w) => w.isRecovery).every((w) => w.sessions.filter((x) => x.type === "quality").length <= 1));
  check(`avancé sur ${days} jours : chaque séance de qualité a son déroulé et ses allures`, adv.weeks.flatMap((w) => w.sessions).filter((x) => x.type === "quality" || x.type === "tempo").every((x) => workoutBlocks(adv, x, model) !== null && x.workout !== undefined));
}
const mid5 = generatePlan(input("10k", "2027-02-14", { level: "intermediaire", daysPerWeek: 5, currentWeeklyKm: 40 }));
check("intermédiaire : le deuxième créneau reste un tempo", mid5.weeks.flatMap((w) => w.sessions).filter((x) => x.type === "quality").length === mid5.weeks.filter((w) => w.sessions.some((x) => x.type === "quality")).length && second(mid5).every(({ s }) => s[0].type === "tempo"));
const adv5 = generatePlan(input("10k", "2027-02-14", { level: "avance", daysPerWeek: 5, currentWeeklyKm: 40 }));
const oldAdv: Plan = JSON.parse(JSON.stringify(adv5));
for (const { s, w } of all(oldAdv)) {
  if (s.type === "test") continue;
  delete s.workout;
  const firstQ = w.sessions.find((x) => x.type === "quality" || x.type === "test");
  if (s.type === "quality" && s !== firstQ) Object.assign(s, { type: "tempo", title: "Tempo", details: "ancien" });
}
check("ancien plan d'avancé (tempo seulement) : la mise à jour crée les deuxièmes séances de qualité", isDeepStrictEqual(upgradePlan(oldAdv, {}, "2026-10-05"), adv5));
check("ancien plan d'avancé : la mise à jour est comptée, puis plus rien", upgradableCount(oldAdv, {}, "2026-10-05") > 0 && upgradableCount(upgradePlan(oldAdv, {}, "2026-10-05"), {}, "2026-10-05") === 0);

// ---------- Charge de la semaine ----------
let loadProblem: unknown = null;
let stableProblem: unknown = null;
let loadWeeks = 0;
for (const race of ["5k", "10k", "semi", "marathon"] as const) {
  for (const level of ["debutant", "intermediaire", "avance"] as const) {
    for (const days of [3, 4, 5, 6] as const) {
      for (const longDay of ["sam", "dim"] as const) {
        const p = generatePlan(input(race, race === "marathon" ? "2027-04-04" : "2027-02-14", { level, daysPerWeek: days, longDay, currentWeeklyKm: level === "debutant" ? 12 : 35 }));
        for (const w of p.weeks) {
          const hard = w.sessions.filter((s) => s.type === "quality" || s.type === "tempo" || s.type === "test");
          const veryHard = hard.filter((s) => formatStress(s.workout?.format) >= VERY_HARD_STRESS);
          if (veryHard.length > 1) loadProblem = { deuxTresDures: veryHard.map((s) => s.title), race, level, days, week: w.index };
          const long = w.sessions.find((s) => s.type === "long");
          const total = [...hard, ...(long ? [long] : [])].reduce((a, s) => a + formatStress(s.workout?.format), 0);
          loadWeeks++;
          if (long && total > loadCap(level, w.isRecovery) && long.workout?.format !== "longue-facile") loadProblem = { plafond: total, cap: loadCap(level, w.isRecovery), long: long.workout?.format, race, level, days, week: w.index };
        }
        if (days === 5 && longDay === "dim" && upgradableCount(p, {}, "2026-10-05") !== 0) stableProblem = { race, level, count: upgradableCount(p, {}, "2026-10-05") };
      }
    }
  }
}
check(`${loadWeeks} semaines de plans : jamais deux séances très dures, plafond de charge respecté (sinon sortie longue facile)`, loadProblem === null && loadWeeks > 2000, loadProblem);
check("un plan neuf n'a rien à mettre à jour (le plafond s'applique de la même façon à la création et à la mise à jour)", stableProblem === null, stableProblem);
check("barème : chaque format du catalogue a un poids", (() => {
  const known = new Set(Object.keys(FORMAT_STRESS));
  const used = new Set<string>();
  for (const race of ["5k", "10k", "semi", "marathon"] as const) for (const level of ["debutant", "intermediaire", "avance"] as const) for (const { s } of all(generatePlan(input(race, race === "marathon" ? "2027-04-04" : "2027-02-14", { level, daysPerWeek: 5, currentWeeklyKm: level === "debutant" ? 0 : 35 })))) if (s.workout) used.add(s.workout.format);
  return [...used].every((f) => known.has(f));
})(), "formats sans poids");
check("plafonds par niveau", loadCap("debutant", false) < loadCap("intermediaire", false) && loadCap("intermediaire", false) < loadCap("avance", false) && loadCap("avance", true) < loadCap("intermediaire", false));
const heavyWeek = generatePlan(input("10k", "2027-02-14", { level: "avance", daysPerWeek: 5, currentWeeklyKm: 40 }));
const load = heavyWeek.weeks.map((w) => weekLoad(w, "avance"));
check("charge de la semaine : étiquette et chiffres pour chaque semaine de travail", load.filter((l) => l !== null).length >= 15 && load.every((l) => l === null || (l.stress <= l.cap + 0.01 && ["légère", "modérée", "soutenue"].includes(l.label))), load);
check("les semaines de récupération ont une charge plus légère que la moyenne des autres", (() => {
  const rec = heavyWeek.weeks.filter((w) => w.isRecovery).map((w) => weekLoad(w, "avance")!.stress);
  const norm = heavyWeek.weeks.filter((w) => !w.isRecovery && w.phase !== "course" && w.phase !== "affutage").map((w) => weekLoad(w, "avance")!.stress);
  return rec.length > 0 && Math.max(...rec) <= Math.max(...norm) && rec.reduce((a, b) => a + b, 0) / rec.length < norm.reduce((a, b) => a + b, 0) / norm.length;
})());
check("charge inconnue sans déroulé détaillé (ancien plan), ou en pause", weekLoad({ sessions: [{ ...heavyWeek.weeks[0].sessions[0], workout: undefined }], isRecovery: false }, "avance") === null && weekLoad({ sessions: heavyWeek.weeks[0].sessions, isRecovery: false, paused: true }, "avance") === null);
// Un plan enregistré avant le plafond : la mise à jour corrige ce qui dépasse, jamais le passé ni le fait.
const heavy: Plan = JSON.parse(JSON.stringify(generatePlan(input("10k", "2027-02-14", { level: "intermediaire", daysPerWeek: 5, currentWeeklyKm: 40 }))));
const hw = heavy.weeks.find((w) => w.phase === "construction" && !w.isRecovery && w.sessions.some((s) => s.type === "quality" && s.workout?.format === "fractionne") && w.sessions.some((s) => s.type === "tempo"))!;
const hl = hw.sessions.find((s) => s.type === "long")!;
Object.assign(hl, { title: "Sortie longue avec blocs au seuil", workout: longWorkout("10k", "construction", hl.km, false, 5, "intermediaire").workout });
hl.workout = { ...hl.workout!, format: "longue-seuil" };
const fixed = upgradePlan(heavy, {}, "2026-10-05");
const fixedLong = fixed.weeks[hw.index].sessions.find((s) => s.type === "long")!;
check("sortie longue trop lourde dans un plan enregistré : redevient facile", fixedLong.workout!.format === "longue-facile" && fixedLong.title === "Sortie longue" && fixedLong.km === hl.km);
check("sortie longue trop lourde déjà faite : intacte", upgradePlan(heavy, { [hl.id]: true }, "2026-10-05").weeks[hw.index].sessions.find((s) => s.type === "long")!.workout!.format === "longue-seuil");
check("sortie longue trop lourde passée : intacte", upgradePlan(heavy, {}, hl.date > "2026-10-06" ? addDaysISO(hl.date, 1) : "2099-01-01").weeks[hw.index].sessions.find((s) => s.type === "long")!.workout!.format === "longue-seuil");
const two: Plan = JSON.parse(JSON.stringify(generatePlan(input("10k", "2027-02-14", { level: "avance", daysPerWeek: 5, currentWeeklyKm: 40 }))));
const tw = two.weeks.find((w) => w.phase === "construction" && !w.isRecovery && w.sessions.some((s) => s.type === "quality" && s.workout?.format === "fractionne") && w.sessions.some((s) => s.type === "tempo"))!;
const tt = tw.sessions.find((s) => s.type === "tempo")!;
const pyr = qualityWorkout("10k", "construction", tt.km, 1, "avance");
Object.assign(tt, { type: "quality", title: pyr.title, details: pyr.details, workout: pyr.workout });
const mended = upgradePlan(two, {}, "2026-10-05");
check("deux séances très dures dans un plan enregistré : la seconde redevient un tempo", mended.weeks[tw.index].sessions.filter((s) => s.type === "quality").length === 1 && mended.weeks[tw.index].sessions.some((s) => s.type === "tempo") && upgradableCount(mended, {}, "2026-10-05") === 0);

// ---------- Mise à jour d'un plan enregistré ----------
const oldMarathon: Plan = JSON.parse(JSON.stringify(marathon));
for (const { s } of all(oldMarathon)) if (s.type !== "test") delete s.workout;
const oldCount = all(oldMarathon).filter(({ s }) => s.type === "quality" || s.type === "tempo" || s.type === "long").length;
check("ancien plan : séances de qualité, de tempo et sorties longues sont à mettre à jour", upgradableCount(oldMarathon, {}, "2026-10-05") === oldCount && oldCount > 10);
check("plan à jour : rien à mettre à jour", upgradableCount(marathon, {}, "2026-10-05") === 0);
check("mise à jour d'un ancien plan = plan neuf", isDeepStrictEqual(upgradePlan(oldMarathon, {}, "2026-10-05"), marathon));
const firstQ = all(oldMarathon).find(({ s }) => s.type === "quality")!.s;
const partial = upgradePlan(oldMarathon, { [firstQ.id]: true }, "2026-10-05");
const same = all(partial).find(({ s }) => s.id === firstQ.id)!.s;
check("séance déjà faite : intacte", same.workout === undefined && same.title === firstQ.title && same.details === firstQ.details);
const later = upgradePlan(oldMarathon, {}, "2026-12-01");
check("séances passées : intactes", all(later).filter(({ s }) => s.date < "2026-12-01").every(({ s }) => s.workout === undefined) && all(later).some(({ s }) => s.date >= "2026-12-01" && s.workout !== undefined));
check("mise à jour : dates, kilomètres et identifiants inchangés", isDeepStrictEqual(all(upgradePlan(oldMarathon, {}, "2026-10-05")).map(({ s }) => [s.id, s.date, s.km, s.type]), all(oldMarathon).map(({ s }) => [s.id, s.date, s.km, s.type])));

// ---------- Plan stable et sérialisable ----------
check("le plan survit à JSON (aucune valeur indéfinie)", isDeepStrictEqual(JSON.parse(JSON.stringify(marathon)), marathon));
check("même entrée, même plan", isDeepStrictEqual(generatePlan(input("marathon", "2027-04-04")), marathon));

// ---------- Formats de texte ----------
check("durées et distances lisibles", fmtSeconds(45) === "45 s" && fmtSeconds(90) === "1 min 30" && fmtSeconds(120) === "2 min" && fmtMeters(1600) === "1,6 km" && fmtMeters(400) === "400 m");

console.log(failures === 0 ? "\nTout est bon." : `\n${failures} échec(s).`);
process.exit(failures === 0 ? 0 : 1);
