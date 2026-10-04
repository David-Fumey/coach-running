import { isDeepStrictEqual } from "node:util";
import { generatePlan, type Plan, type PlanInput, type Session, type Week } from "../src/lib/plan.ts";
import { paceModel, targetsFor } from "../src/lib/paces.ts";
import { workoutBlocks } from "../src/lib/steps.ts";
import { fmtMeters, fmtSeconds, legacyQualityWorkout, longWorkout, qualityWorkout, tempoWorkout, upgradePlan, upgradableCount } from "../src/lib/workouts.ts";

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
check("marathon : au moins 5 formats de sortie longue différents", allLongFormats.size >= 5, [...allLongFormats]);
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
