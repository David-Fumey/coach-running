import { isDeepStrictEqual } from "node:util";
import { addDays, generatePlan, type Level, type Plan, type PlanInput, type RaceKey } from "../src/lib/plan.ts";
import { strengthCount, strengthDays, strengthWorkout, weekExtras } from "../src/lib/strength.ts";
import { restDay } from "../src/lib/rest.ts";
import { shiftPlan } from "../src/lib/shift.ts";
import { upgradableCount, upgradePlan } from "../src/lib/workouts.ts";
import { EMPTY_SNAPSHOT, makeBackup, parseBackup } from "../src/lib/backup.ts";

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (!ok) {
    failures++;
    console.log("ECHEC", name, detail ?? "");
  } else console.log("ok   ", name);
}

const input = (extra: Partial<PlanInput> = {}): PlanInput => ({
  race: "semi", raceDate: "2027-02-14", level: "intermediaire", daysPerWeek: 4, currentWeeklyKm: 25, longDay: "dim", today: "2026-10-05", ...extra,
});
const HARD = ["long", "quality", "tempo", "test", "race"];
const extrasOf = (p: Plan) => p.weeks.flatMap((w) => (w.extras ?? []).map((s) => ({ s, w })));
const runsOn = (p: Plan, date: string) => p.weeks.flatMap((w) => w.sessions).find((s) => s.date === date);

// ---------- Placement ----------
let bad: unknown = null;
const combos: PlanInput[] = [];
for (const race of ["5k", "10k", "semi", "marathon"] as RaceKey[])
  for (const level of ["debutant", "intermediaire", "avance"] as Level[])
    for (const daysPerWeek of [3, 4, 5, 6] as const)
      for (const longDay of ["sam", "dim"] as const) combos.push(input({ race, level, daysPerWeek, longDay, raceDate: race === "marathon" ? "2027-04-04" : "2027-02-14" }));
let total = 0;
for (const c of combos) {
  const p = generatePlan(c);
  for (const { s, w } of extrasOf(p)) {
    total++;
    if (runsOn(p, s.date)) bad = { jourDeCourse: s.date, c };
    const next = runsOn(p, addDays(s.date, 1));
    if (next && HARD.includes(next.type)) bad = { veilleDeSeanceDure: s.date, next: next.type, c };
    if (s.km !== 0 || s.type !== "strength" || !s.strength || s.id !== `r-${s.date}`) bad = { forme: s };
    if (s.strength!.minutes < 10 || s.strength!.minutes > 45) bad = { duree: s.strength!.minutes, c };
    if (w.phase === "course") bad = { semaineDeCourse: s.date };
    if (s.date < p.input.today) bad = { passe: s.date };
  }
  for (const w of p.weeks) {
    if (new Set((w.extras ?? []).map((s) => s.id)).size !== (w.extras ?? []).length) bad = { doublons: w.index };
    const days = (w.extras ?? []).map((s) => s.date).sort();
    if (days.some((d, i) => i > 0 && addDays(days[i - 1], 1) === d)) bad = { consecutifs: days };
  }
}
check(`${combos.length} plans (courses, niveaux, fréquences, jour de la sortie longue) : renforcement jamais un jour de course ni la veille d'une séance dure`, bad === null && total > 500, { bad, total });

const semi = generatePlan(input());
const cnt = (phase: string, rec = false) => semi.weeks.filter((w) => w.phase === phase && w.isRecovery === rec && w.index > 0).map((w) => (w.extras ?? []).length);
check("base et construction (4 jours, intermédiaire) : 2 séances par semaine", cnt("base").every((n) => n === 2) && cnt("construction").every((n) => n === 2), [cnt("base"), cnt("construction")]);
check("phase spécifique : 1 séance par semaine", cnt("specifique").every((n) => n === 1));
check("semaines de récupération et affûtage : une mobilité", semi.weeks.filter((w) => w.isRecovery || w.phase === "affutage").every((w) => (w.extras ?? []).length === 1 && w.extras![0].strength!.format === "mobilite"));
check("semaine de course : aucun renforcement", (semi.weeks[semi.weeks.length - 1].extras ?? []).length === 0);
check("débutant : une séance de renforcement par semaine en base", generatePlan(input({ level: "debutant" })).weeks.filter((w) => w.phase === "base" && !w.isRecovery && w.index > 0).every((w) => (w.extras ?? []).length === 1));
check("jambes et gainage alternent", (() => {
  const routines = extrasOf(semi).filter(({ s }) => s.strength!.format === "renforcement").map(({ s }) => s.strength!.routine);
  return routines.every((r, i) => i === 0 || r !== routines[i - 1]) && routines.includes("jambes") && routines.includes("gainage");
})());
check("la mobilité ne casse pas l'alternance", (() => {
  const routines = extrasOf(semi).filter(({ s }) => s.strength!.format === "renforcement").map(({ s }) => s.strength!.routine);
  return routines[0] === "jambes";
})());

// ---------- Contenu ----------
const legs = strengthWorkout("jambes", "base", "intermediaire", 0);
const legsLater = strengthWorkout("jambes", "construction", "intermediaire", 3);
check("jambes : 5 exercices, 2 séries en base", legs.exercises.length === 5 && legs.exercises.every((e) => e.sets === 2) && legs.exercises.every((e) => (e.reps ?? e.seconds ?? 0) > 0), legs);
check("construction : 3 séries, plus de répétitions et de tenue", legsLater.exercises.every((e) => e.sets === 3) && legsLater.exercises[0].reps! > legs.exercises[0].reps! && legsLater.minutes > legs.minutes);
const core = strengthWorkout("gainage", "base", "intermediaire", 0);
check("gainage : planche chronométrée, exercices par côté signalés", core.exercises[0].seconds === 30 && core.exercises.some((e) => e.perSide === true && e.name.includes("latérale")));
const mobil = strengthWorkout("mobilite", "base", "avance", 5);
check("mobilité : une série, courte, sans surcharge", mobil.exercises.every((e) => e.sets === 1) && mobil.minutes <= 15 && mobil.format === "mobilite");
check("niveau : un avancé fait plus qu'un débutant", strengthWorkout("jambes", "construction", "avance", 0).exercises[0].reps! > strengthWorkout("jambes", "construction", "debutant", 0).exercises[0].reps! && strengthWorkout("jambes", "construction", "avance", 0).exercises[0].sets > strengthWorkout("jambes", "construction", "debutant", 0).exercises[0].sets);
check("progression plafonnée", strengthWorkout("jambes", "base", "intermediaire", 99).exercises[0].reps === strengthWorkout("jambes", "base", "intermediaire", 3).exercises[0].reps);
check("chaque exercice a un conseil", [legs, core, mobil].every((w) => w.exercises.every((e) => e.tip.length > 10 && e.name.length > 3)));

// ---------- Fonctions de placement ----------
const info = { weekStart: "2026-10-05", phase: "construction" as const, isRecovery: false, isRaceWeek: false, level: "intermediaire" as Level };
const week4 = [
  { date: "2026-10-06", type: "quality" as const },
  { date: "2026-10-08", type: "easy" as const },
  { date: "2026-10-10", type: "easy" as const },
  { date: "2026-10-11", type: "long" as const },
];
const free = strengthDays({ ...info, runs: week4 });
check("jours possibles : ni course, ni veille de séance dure (le lundi précède la qualité)", !free.includes("2026-10-05") && !free.includes("2026-10-06") && free.includes("2026-10-07") && free.includes("2026-10-09"), free);
check("nombre de séances selon la semaine", strengthCount({ ...info, runs: week4 }) === 2 && strengthCount({ ...info, runs: week4, isRaceWeek: true }) === 0 && strengthCount({ ...info, runs: week4, phase: "specifique" }) === 1 && strengthCount({ ...info, runs: week4, level: "debutant" }) === 1);
const none = weekExtras({ ...info, runs: [0, 1, 2, 3, 4, 5, 6].map((i) => ({ date: addDays("2026-10-05", i), type: "easy" as const })) }, 0);
check("aucun jour de repos : aucun renforcement", none.sessions.length === 0 && none.nextRank === 0);

// ---------- Jour de repos ----------
const restDays = semi.weeks.flatMap((w) => Array.from({ length: 7 }, (_, i) => addDays(w.startDate, i))).filter((d) => restDay(semi, d) !== null);
check("jours de repos : ni course ni renforcement", restDays.length > 20 && restDays.every((d) => !runsOn(semi, d) && !extrasOf(semi).some(({ s }) => s.date === d)));
const afterLong = semi.weeks.flatMap((w) => w.sessions).filter((s) => s.type === "long").map((s) => restDay(semi, addDays(s.date, 1))).find((r) => r !== null);
check("lendemain de sortie longue : conseil adapté", afterLong !== undefined && afterLong!.tips.some((t) => t.includes("sortie longue")), afterLong);
const beforeQuality = restDays.map((d) => restDay(semi, d)!).find((r) => r.tomorrow?.type === "quality");
check("veille d'une séance dure : conseil de fraîcheur", beforeQuality !== undefined && beforeQuality.tips.some((t) => t.includes("fraîcheur")));
check("tout jour de repos : conseil général et prudence", restDays.every((d) => { const r = restDay(semi, d)!; return r.tips.length >= 2 && r.tips[0].includes("repos") && r.tips[r.tips.length - 1].includes("médecin"); }));
check("hors du plan : pas de carte", restDay(semi, "2026-01-01") === null && restDay(semi, "2027-03-01") === null);
const shifted = shiftPlan(semi, 2, {}, "2026-10-12");
check("semaine de pause : pas de carte repos", shifted.ok && restDay(shifted.plan, "2026-10-13") === null);

// ---------- Report du programme ----------
check("report : renforcement présent après la reprise, aucun pendant la pause", shifted.ok && shifted.plan.weeks.filter((w) => w.paused).every((w) => (w.extras ?? []).length === 0) && shifted.plan.weeks.filter((w) => !w.paused && w.index > 3).every((w) => w.phase === "course" || (w.extras ?? []).length > 0));

// ---------- Anciens plans ----------
const old: Plan = JSON.parse(JSON.stringify(semi));
for (const w of old.weeks) delete w.extras;
check("ancien plan sans renforcement : rien d'indéfini", extrasOf(old).length === 0);
check("la mise à jour ajoute le renforcement à venir", upgradableCount(old, {}, "2026-10-05") > upgradableCount(semi, {}, "2026-10-05") && extrasOf(upgradePlan(old, {}, "2026-10-05")).length === extrasOf(semi).length);
check("mise à jour d'un ancien plan = plan neuf", isDeepStrictEqual(upgradePlan(old, {}, "2026-10-05"), semi));
check("mise à jour : plus rien à changer ensuite", upgradableCount(upgradePlan(old, {}, "2026-10-05"), {}, "2026-10-05") === 0 && upgradableCount(semi, {}, "2026-10-05") === 0);
const later = upgradePlan(old, {}, "2026-12-01");
check("mise à jour tardive : aucun renforcement dans le passé", extrasOf(later).every(({ s }) => s.date >= "2026-12-01") && extrasOf(later).length > 0);
const partial = generatePlan(input({ today: "2026-10-08" }));
check("plan créé en cours de semaine : pas de renforcement dans le passé", extrasOf(partial).every(({ s }) => s.date >= "2026-10-08"));
check("même entrée, même plan, et plan sérialisable", isDeepStrictEqual(generatePlan(input()), semi) && isDeepStrictEqual(JSON.parse(JSON.stringify(semi)), semi));

// ---------- Sauvegarde ----------
const text = makeBackup({ ...EMPTY_SNAPSHOT, plan: semi, confirmed: true }, new Date("2026-10-05T10:00:00Z"));
const back = parseBackup(text);
check("sauvegarde : le renforcement fait l'aller-retour", back.ok && isDeepStrictEqual(back.data.plan, semi));
const broken = JSON.parse(text);
broken.data.plan.weeks[1].extras = [{ id: 3 }];
check("sauvegarde : renforcement invalide refusé", !parseBackup(JSON.stringify(broken)).ok);
const legacy = JSON.parse(text);
for (const w of legacy.data.plan.weeks) delete w.extras;
check("sauvegarde ancienne (sans renforcement) : acceptée", parseBackup(JSON.stringify(legacy)).ok);

console.log(failures === 0 ? "\nTout est bon." : `\n${failures} échec(s).`);
process.exit(failures === 0 ? 0 : 1);
