import { isDeepStrictEqual } from "node:util";
import { generatePlan, type Plan, type PlanInput } from "../src/lib/plan.ts";
import type { Activity } from "../src/lib/activities.ts";
import { paceModel, zoneRange } from "../src/lib/paces.ts";
import { vdotFromRace } from "../src/lib/goal.ts";
import { workoutBlocks } from "../src/lib/steps.ts";
import { TEST_SESSION_KM, upgradableCount, upgradePlan } from "../src/lib/workouts.ts";
import { kindOf } from "../src/lib/nutrition.ts";
import {
  TEST_FRESH_DAYS, TEST_PROMPT_DAYS, isValidTestMinutes, latestTest, nextTestSession, parseTestTime, pendingTest, validTest, withTest, type TestResult,
} from "../src/lib/tests.ts";
import { makeBackup, parseBackup, EMPTY_SNAPSHOT } from "../src/lib/backup.ts";

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (!ok) {
    failures++;
    console.log("ECHEC", name, detail ?? "");
  } else console.log("ok   ", name);
}
const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) < eps;

const input = (extra: Partial<PlanInput> = {}): PlanInput => ({
  race: "semi", raceDate: "2027-02-14", level: "intermediaire", daysPerWeek: 4, currentWeeklyKm: 25, longDay: "dim", today: "2026-10-05", ...extra,
});
const all = (p: Plan) => p.weeks.flatMap((w) => w.sessions.map((s) => ({ s, w })));
const tests = (p: Plan) => all(p).filter(({ s }) => s.type === "test");

// ---------- Placement dans le plan ----------
const semi = generatePlan(input());
const t = tests(semi);
check("deux tests : début de la construction et début de la phase spécifique", t.length === 2 && t[0].w.phase === "construction" && t[1].w.phase === "specifique", t.map(({ w }) => w.phase));
check("un test n'est jamais placé en semaine de récupération", t.every(({ w }) => !w.isRecovery));
check("le test est la première semaine éligible de sa phase", t.every(({ w }) => semi.weeks.filter((x) => x.phase === w.phase && !x.isRecovery)[0].index === w.index));
check("test : 8 km, échauffement 2 km, 5 km chronométrés, retour au calme 1 km", t.every(({ s }) => s.km === TEST_SESSION_KM && s.title === "Test 5 km chronométré" && s.workout!.warmKm === 2 && s.workout!.coolKm === 1 && s.workout!.sets[0].work.meters === 5000 && s.workout!.sets[0].work.intensity === "test"), t[0]?.s);
check("le test prend la place de la séance de qualité de la semaine", t.every(({ s, w }) => !w.sessions.some((x) => x.type === "quality") && w.sessions.filter((x) => x.type === "test").length === 1 && s.date > w.startDate));
check("le total de la semaine inclut le test", t.every(({ w }) => Math.abs(w.totalKm - w.sessions.reduce((a, x) => a + x.km, 0)) <= 0.25));
check("pas de test dans une préparation de moins de 8 semaines", tests(generatePlan(input({ raceDate: "2026-11-22" }))).length === 0);
const beginner = generatePlan(input({ level: "debutant", currentWeeklyKm: 0, race: "10k" }));
check("débutant en course/marche : pas de test pendant les semaines de course/marche", tests(beginner).every(({ s }) => s.workout!.format === "test-5k") && tests(beginner).every(({ w }) => w.index >= 3) && tests(beginner).length >= 1, tests(beginner).map(({ w }) => w.index));
check("la rotation des séances de qualité ne perd pas de format à cause du test", (() => {
  const formats = all(semi).filter(({ s, w }) => s.type === "quality" && w.phase === "construction").map(({ s }) => s.workout!.format);
  return formats[0] === "fractionne" && formats[1] === "pyramide";
})());
check("déroulé du test : échauffement, 5 km sans allure imposée, retour au calme", (() => {
  const model = paceModel([], "2026-10-05", 6.2)!;
  const b = workoutBlocks(semi, t[0].s, model)!;
  return b.map((x) => x.id).join() === "warmup,main,cooldown" && b[1].steps[0].distanceM === 5000 && b[1].steps[0].pace === undefined && b[1].steps[0].label === "Test 5 km chronométré";
})());
check("journée de test : traitée comme une journée intense", kindOf("test", 8) === "intense");
check("même entrée, même plan", isDeepStrictEqual(generatePlan(input()), semi));

// ---------- Mise à jour d'un ancien plan ----------
const old: Plan = JSON.parse(JSON.stringify(semi));
for (const { s } of all(old)) {
  if (s.type === "test") Object.assign(s, { type: "quality", title: "Fartlek", details: "ancien", km: 6 });
  delete s.workout;
}
const upgraded = upgradePlan(old, {}, "2026-10-05");
check("ancien plan sans test : la mise à jour place les tests aux mêmes semaines", isDeepStrictEqual(upgraded, semi));
check("ancien plan : la mise à jour est comptée", upgradableCount(old, {}, "2026-10-05") > 0 && upgradableCount(semi, {}, "2026-10-05") === 0);
check("deuxième mise à jour : rien à changer", upgradableCount(upgraded, {}, "2026-10-05") === 0);
const firstQ = old.weeks.find((w) => w.phase === "construction" && !w.isRecovery)!.sessions.find((s) => s.type === "quality")!;
const doneFirst = upgradePlan(old, { [firstQ.id]: true }, "2026-10-05");
check("séance de qualité déjà faite : le test passe à la semaine suivante", tests(doneFirst).filter(({ w }) => w.phase === "construction").length === 1 && tests(doneFirst).find(({ w }) => w.phase === "construction")!.s.id !== firstQ.id);

// ---------- Saisie du temps ----------
check("temps valides", parseTestTime("24:30") === 24.5 && parseTestTime("19:05") !== null && parseTestTime("1:00:00") === 60);
check("temps invalides", parseTestTime("") === null && parseTestTime("abc") === null && parseTestTime("9:00") === null && parseTestTime("1:30:00") === null && parseTestTime("24:75") === null);
check("bornes plausibles (3:00 à 12:00 par km)", isValidTestMinutes(15) && isValidTestMinutes(60) && !isValidTestMinutes(14.9) && !isValidTestMinutes(60.1) && !isValidTestMinutes(NaN));
check("résultat de test valide", validTest({ id: "a", date: "2026-10-05", minutes: 25 }) && !validTest({ id: "", date: "2026-10-05", minutes: 25 }) && !validTest({ id: "a", date: "5 oct", minutes: 25 }) && !validTest({ id: "a", date: "2026-10-05", minutes: 5 }) && !validTest(null));
const r1: TestResult = { id: "a", date: "2026-10-05", minutes: 25, sessionId: "s1" };
const r2: TestResult = { id: "b", date: "2026-12-01", minutes: 24 };
check("dernier test : le plus récent", latestTest([r1, r2])!.id === "b" && latestTest([]) === null);
check("un second résultat pour la même séance remplace le premier", withTest([r1], { id: "c", date: "2026-10-06", minutes: 24.8, sessionId: "s1" }).length === 1 && withTest([r1], r2).length === 2);

// ---------- Résultat attendu après la séance ----------
const testSession = t[0].s;
const day = (n: number) => new Date(Date.parse(testSession.date) + n * 86400000).toISOString().slice(0, 10);
const run = (sessionId: string | undefined, efforts?: Activity["efforts"]): Activity => ({ id: "a1", date: testSession.date, km: 8, minutes: 55, ...(sessionId ? { sessionId } : {}), ...(efforts ? { efforts } : {}) });
check("avant la séance : rien à saisir", pendingTest(semi, [], [], day(-1)) === null);
check("le jour du test : résultat à saisir", pendingTest(semi, [], [], testSession.date)?.session.id === testSession.id);
check("Strava propose le meilleur 5 km de la sortie liée", pendingTest(semi, [run(testSession.id, { "5k": 24.17 })], [], day(1))?.stravaMinutes === 24.17);
check("sans détail Strava : pas de proposition, mais la sortie est reconnue", (() => { const p = pendingTest(semi, [run(testSession.id)], [], day(1)); return p !== null && p.stravaMinutes === undefined && p.activity !== undefined; })());
check("sortie du même jour reconnue même sans lien avec la séance", pendingTest(semi, [run(undefined, { "5k": 25 })], [], day(1))?.stravaMinutes === 25);
check("une fois le temps enregistré : plus d'invitation", pendingTest(semi, [], [{ id: "x", date: testSession.date, minutes: 25, sessionId: testSession.id }], day(1)) === null);
check(`l'invitation s'éteint au bout de ${TEST_PROMPT_DAYS} jours`, pendingTest(semi, [], [], day(TEST_PROMPT_DAYS)) !== null && pendingTest(semi, [], [], day(TEST_PROMPT_DAYS + 1)) === null);
check("prochain test", nextTestSession(semi, "2026-10-05")!.id === t[0].s.id && nextTestSession(semi, "2099-01-01") === null);

// ---------- Effet sur les allures ----------
const today = "2026-12-01";
const steady: Activity[] = [3, 6, 9, 12, 15].map((d, i) => ({ id: `r${i}`, date: new Date(Date.UTC(2026, 11, 1 - d)).toISOString().slice(0, 10), km: 6, minutes: 42 })); // 7:00/km
const fresh: TestResult = { id: "t", date: "2026-11-25", minutes: 24.5 };
const withTestModel = paceModel(steady, today, null, null, fresh)!;
const noTestModel = paceModel(steady, today, null, null)!;
check("test récent : source « test », niveau du temps sur 5 km", withTestModel.reference.source === "test" && near(withTestModel.vdot, vdotFromRace(5, 24.5)) && withTestModel.reference.test?.id === "t", withTestModel.reference);
check("test récent : allures plus rapides que la moyenne de sorties à 7:00", zoneRange(withTestModel.vdot, "facile").fast < zoneRange(noTestModel.vdot, "facile").fast);
check("sans test : comme avant", noTestModel.reference.source === "recentes");
check("allure saisie à la main : prioritaire sur le test", paceModel(steady, today, 6.0, null, fresh)!.reference.source === "manuelle");
const stale: TestResult = { id: "s", date: "2026-08-01", minutes: 24.5 };
check(`test de plus de ${TEST_FRESH_DAYS} jours : les sorties récentes passent devant`, paceModel(steady, today, null, null, stale)!.reference.source === "recentes");
check("test ancien sans sorties : il sert quand même", paceModel([], today, null, null, stale)!.reference.source === "test");
check("test avant tout objectif", paceModel([], today, null, { race: "semi", minutes: 100 }, fresh)!.reference.source === "test");
check("test futur ignoré par l'âge mais valide", paceModel(steady, today, null, null, { id: "f", date: "2026-12-05", minutes: 24.5 })!.reference.source === "test");
check("test très lent : niveau borné, pas d'erreur", paceModel([], today, null, null, { id: "l", date: today, minutes: 60 })!.vdot >= 25);

// ---------- Sauvegarde ----------
const snap = { ...EMPTY_SNAPSHOT, plan: semi, confirmed: true, tests: [fresh] };
const text = makeBackup(snap, new Date("2026-12-01T10:00:00Z"));
const back = parseBackup(text);
check("sauvegarde : le test fait l'aller-retour", back.ok && isDeepStrictEqual(back.data.tests, [fresh]));
const bad = JSON.parse(text);
bad.data.tests = [{ id: "x", date: "2026-12-01", minutes: 3 }];
check("sauvegarde : test invalide refusé", !parseBackup(JSON.stringify(bad)).ok);
const noTests = JSON.parse(text);
delete noTests.data.tests;
check("sauvegarde ancienne (sans tests) : liste vide", (() => { const r = parseBackup(JSON.stringify(noTests)); return r.ok && r.data.tests.length === 0; })());

console.log(failures === 0 ? "\nTout est bon." : `\n${failures} échec(s).`);
process.exit(failures === 0 ? 0 : 1);
