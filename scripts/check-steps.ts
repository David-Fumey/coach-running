import { generatePlan, type Plan, type PlanInput, type Session } from "../src/lib/plan.ts";
import { paceModel, zoneRange } from "../src/lib/paces.ts";
import { repsFor, stepSize, workoutBlocks } from "../src/lib/steps.ts";

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (!ok) {
    failures++;
    console.log("ECHEC", name, detail ?? "");
  } else console.log("ok   ", name);
}

const base: PlanInput = { race: "semi", raceDate: "2027-02-14", level: "intermediaire", daysPerWeek: 5, currentWeeklyKm: 25, longDay: "dim", today: "2026-10-05" };
const model = paceModel([], "2026-10-05", 6.2)!;
const sessionsOf = (plan: Plan) => plan.weeks.flatMap((w) => w.sessions.map((s) => ({ s, w })));

// ---------- Cohérence avec le texte du plan, pour chaque course ----------
for (const race of ["5k", "10k", "semi", "marathon"] as const) {
  const raceDate = race === "marathon" ? "2027-04-04" : "2027-02-14";
  const plan = generatePlan({ ...base, race, raceDate });
  let mismatch: unknown = null;
  let withoutStruct = 0;
  for (const { s, w } of sessionsOf(plan)) {
    if (s.type !== "quality") continue;
    const blocks = workoutBlocks(plan, s, model);
    const main = blocks?.find((b) => b.id === "main");
    const m = /(\d+) ×/.exec(s.details);
    if (!blocks || !main) {
      withoutStruct++;
      continue;
    }
    // Les répétitions du déroulé sont celles du texte (sauf blocs d'allure de course, sans « N × »)
    if (m && Number(m[1]) !== main.repeat) mismatch = { details: s.details, repeat: main.repeat };
    if (m && repsFor(race, w.phase, s.km) !== Number(m[1])) mismatch = { details: s.details, reps: repsFor(race, w.phase, s.km) };
  }
  check(`${race} : répétitions du déroulé = texte du plan`, mismatch === null, mismatch);
  check(`${race} : chaque séance de qualité a un déroulé`, withoutStruct === 0);
}

// ---------- Fartlek ----------
const plan = generatePlan(base);
const fartlek = sessionsOf(plan).find(({ s, w }) => s.type === "quality" && w.phase === "base")!.s;
const fb = workoutBlocks(plan, fartlek, model)!;
check("fartlek : échauffement, séance, retour au calme", fb.map((b) => b.id).join() === "warmup,main,cooldown", fb.map((b) => b.id));
check("fartlek : 2 km d'échauffement et 1 km de retour au calme", fb[0].steps[0].distanceM === 2000 && fb[2].steps[0].distanceM === 1000);
check("fartlek : 1 min soutenue puis 1 min 30 de trot", fb[1].steps[0].seconds === 60 && fb[1].steps[1].seconds === 90 && stepSize(fb[1].steps[1]) === "1 min 30", fb[1].steps);
check("fartlek : allure cible au niveau 10 km", fb[1].steps[0].pace?.slow === zoneRange(model.vdot, "10k").slow);
check("échauffement : plafond d'allure facile", fb[0].steps[0].paceMode === "plafond" && fb[0].steps[0].pace?.fast === zoneRange(model.vdot, "facile").fast);

// ---------- Sans modèle d'allures ----------
const bare = workoutBlocks(plan, fartlek, null)!;
check("sans modèle : pas d'allure, mais le ressenti reste", bare.every((b) => b.steps.every((s) => s.pace === undefined)) && bare[1].steps[0].effort !== undefined);

// ---------- Fractionné, tempo, blocs, sortie longue ----------
const find = (p: Plan, pred: (s: Session, w: Plan["weeks"][number]) => boolean) => sessionsOf(p).find(({ s, w }) => pred(s, w))!.s;
const interval = find(plan, (s, w) => s.type === "quality" && w.phase === "construction");
const ib = workoutBlocks(plan, interval, model)!;
check("fractionné : 1 km à allure 10 km, effort 8/10", ib[1].steps[0].distanceM === 1000 && ib[1].steps[0].pace !== undefined && ib[1].steps[0].effort === "effort 8/10", ib[1].steps[0]);
const tempo = find(plan, (s) => s.type === "tempo");
const tb = workoutBlocks(plan, tempo, model)!;
check("tempo : un seul bloc seuil entre échauffement et retour au calme", tb.length === 3 && tb[1].repeat === 1 && tb[1].steps.length === 1 && (tb[1].steps[0].distanceM ?? 0) >= 2000, tb[1]);
const blocks = find(plan, (s, w) => s.type === "quality" && w.phase === "specifique");
const bb = workoutBlocks(plan, blocks, model)!;
check("blocs d'allure semi : au moins un bloc de 2 km", (bb[1].steps[0].distanceM ?? 0) >= 2000 && bb[1].steps[0].label === "Allure semi-marathon", bb[1].steps);
const longRace = find(plan, (s, w) => s.type === "long" && w.phase === "specifique" && !w.isRecovery && s.km >= 14);
const lb = workoutBlocks(plan, longRace, model)!;
const finish = Math.round(longRace.km * 0.3);
check("sortie longue spécifique : facile puis derniers km à allure semi", lb[0].steps.length === 2 && lb[0].steps[1].distanceM === finish * 1000 && lb[0].steps[0].distanceM! + lb[0].steps[1].distanceM! === Math.round(longRace.km * 1000), lb[0].steps);

// ---------- Séances simples ----------
const longBase = find(plan, (s, w) => s.type === "long" && w.phase === "base");
const lsb = workoutBlocks(plan, longBase, model)!;
check("sortie longue simple : un bloc, une étape facile sur toute la distance", lsb.length === 1 && lsb[0].steps.length === 1 && lsb[0].steps[0].distanceM === Math.round(longBase.km * 1000) && lsb[0].steps[0].pace !== undefined, lsb);
const race = find(plan, (s) => s.type === "race");
const rb = workoutBlocks(plan, race, model)!;
check("course : un bloc, la distance entière", rb.length === 1 && rb[0].steps[0].distanceM === Math.round(race.km * 1000), rb);
const stridesRun = sessionsOf(plan).find(({ s }) => s.type === "easy" && /lignes droites/.test(s.details))?.s;
const sb = stridesRun ? workoutBlocks(plan, stridesRun, model) : null;
check("footing avec lignes droites : footing puis 4 lignes droites de 100 m", sb !== null && sb[1].repeat === 4 && sb[1].steps[0].distanceM === 100, sb);
const plainEasy = find(plan, (s) => s.type === "easy" && !/lignes droites/.test(s.details));
const eb = workoutBlocks(plan, plainEasy, model)!;
check("footing simple : un bloc, allure facile", eb.length === 1 && eb[0].steps[0].label === "Allure facile" && eb[0].steps[0].pace?.slow === zoneRange(model.vdot, "facile").slow, eb);
check("toutes les séances du plan ont un déroulé", sessionsOf(plan).every(({ s }) => workoutBlocks(plan, s, model) !== null));
check("séance hors plan : null", workoutBlocks(plan, { ...race, id: "inconnue" }, model) === null);

// ---------- Tailles ----------
check("tailles lisibles", stepSize({ kind: "work", label: "", distanceM: 400 }) === "400 m" && stepSize({ kind: "easy", label: "", distanceM: 2000 }) === "2 km" && stepSize({ kind: "rest", label: "", seconds: 120 }) === "2 min" && stepSize({ kind: "rest", label: "", seconds: 75 }) === "1 min 15");

console.log(failures === 0 ? "\nTout est bon." : `\n${failures} échec(s).`);
process.exit(failures === 0 ? 0 : 1);
