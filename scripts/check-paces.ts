import { generatePlan, type Session } from "../src/lib/plan.ts";
import type { Activity } from "../src/lib/activities.ts";
import { RACE_KM, goalPace, predictMinutes, vdotFromRace } from "../src/lib/goal.ts";
import {
  FALLBACK_RUNS, MIN_RUNS, ZONES, ZONE_ORDER, comparePace, paceAt, paceModel, referenceFromActivities, targetsFor, vdotFromAveragePace, zoneRange,
} from "../src/lib/paces.ts";

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (!ok) {
    failures++;
    console.log("ECHEC", name, detail ?? "");
  } else console.log("ok   ", name);
}
const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;
const sec = (min: number) => min * 60;

const today = "2026-10-20";
let n = 0;
const run = (daysAgo: number, km: number, minutes: number): Activity => {
  const d = new Date(Date.UTC(2026, 9, 20 - daysAgo));
  return { id: `r${n++}`, date: d.toISOString().slice(0, 10), km, minutes };
};

// ---------- Référence ----------
const steady = [3, 6, 9, 12, 15].map((d) => run(d, 6, 36));
const ref = referenceFromActivities(steady, today)!;
check("moyenne de 5 sorties à 6:00", near(ref.pace, 6) && ref.source === "recentes" && ref.runs === 5 && near(ref.km, 30), ref);

const weighted = referenceFromActivities([run(2, 5, 25), run(4, 10, 65), run(6, 5, 30), run(8, 5, 30)], today)!;
check("moyenne pondérée par la distance (temps cumulé / km cumulés)", near(weighted.pace, 150 / 25), weighted);

check("trop peu de sorties : pas de référence", referenceFromActivities(steady.slice(0, MIN_RUNS - 1), today) === null && referenceFromActivities([], today) === null);
check("sorties de moins de 3 km ignorées", referenceFromActivities([run(1, 2.5, 14), run(2, 2, 12), ...steady.slice(0, 3)], today) === null);
const withWalk = referenceFromActivities([...steady.slice(0, 4), run(5, 6, 57)], today)!; // 9:30/km : marche
check("valeur aberrante écartée", near(withWalk.pace, 6) && withWalk.runs === 4, withWalk);
check("sortie future ignorée", referenceFromActivities([...steady.slice(0, 3), run(-2, 6, 30)], today) === null);

const old = (count: number) => Array.from({ length: count }, (_, i) => run(100 + i * 3, 6, 40)); // 6:40, hors des 8 dernières semaines
const mixed = referenceFromActivities([run(2, 6, 36), run(4, 6, 36), run(7, 6, 36), ...old(6)], today)!;
check("peu de sorties récentes : on prend les dernières, quelles que soient leurs dates", mixed.source === "dernieres" && mixed.runs === 9, mixed);
const many = referenceFromActivities(old(20), today)!;
check(`au plus ${FALLBACK_RUNS} sorties retenues`, many.runs === FALLBACK_RUNS && many.source === "dernieres");
check("allure absurde : pas de référence", referenceFromActivities(Array.from({ length: 5 }, (_, i) => run(i + 1, 5, 80)), today) === null);

// ---------- Modèle ----------
check("saisie manuelle prioritaire", paceModel(steady, today, 5.5)!.reference.source === "manuelle" && near(paceModel(steady, today, 5.5)!.reference.pace, 5.5));
check("saisie manuelle invalide : retour aux sorties", paceModel(steady, today, 2)!.reference.source === "recentes" && paceModel(steady, today, NaN)!.reference.source === "recentes");
check("rien à calculer : pas de modèle", paceModel([], today, null) === null);
check("saisie manuelle sans aucune sortie", paceModel([], today, 6)!.reference.runs === 0);

// ---------- Niveau et zones ----------
const v = vdotFromAveragePace(5.1);
check("l'allure moyenne retombe à 70 % du niveau", near(paceAt(v, 0.7), 5.1, 1e-9));
check("niveau d'environ 50 pour 5:06 /km", v > 48 && v < 52, v);
const e = zoneRange(v, "facile");
check("facile à ce niveau : environ 5:05 à 5:40", sec(e.fast) > 300 && sec(e.fast) < 315 && sec(e.slow) > 330 && sec(e.slow) < 345, [e.fast, e.slow]);
const k5 = zoneRange(v, "5k");
check("5 km à ce niveau : environ 3:55 à 4:00", sec(k5.fast) > 232 && sec(k5.fast) < 240 && sec(k5.slow) > 237 && sec(k5.slow) < 245, [k5.fast, k5.slow]);
const mar = zoneRange(v, "marathon");
check("marathon à ce niveau : environ 4:28 à 4:40", sec(mar.fast) > 264 && sec(mar.fast) < 275 && sec(mar.slow) > 272 && sec(mar.slow) < 285, [mar.fast, mar.slow]);
check("chaque fourchette va du lent au rapide", ZONE_ORDER.every((z) => zoneRange(v, z).slow > zoneRange(v, z).fast));
check("les zones vont de plus en plus vite", ZONE_ORDER.every((z, i) => i === 0 || zoneRange(v, z).fast < zoneRange(v, ZONE_ORDER[i - 1]).fast));
check("toutes les zones ont un libellé", ZONE_ORDER.every((z) => ZONES[z].label.length > 0));
check("plus rapide en moyenne : tout plus rapide", ZONE_ORDER.every((z) => zoneRange(vdotFromAveragePace(4.8), z).fast < zoneRange(vdotFromAveragePace(5.8), z).fast));
check("niveau borné pour des allures extrêmes", vdotFromAveragePace(11.9) >= 25 && vdotFromAveragePace(3.05) <= 85);

// ---------- Cibles par séance ----------
const model = paceModel(steady, today, 5.1)!;
const marathon = generatePlan({ race: "marathon", raceDate: "2027-05-02", level: "intermediaire", daysPerWeek: 6, currentWeeklyKm: 40, longDay: "dim", today: "2026-10-03" });
const tenK = generatePlan({ race: "10k", raceDate: "2027-01-10", level: "intermediaire", daysPerWeek: 5, currentWeeklyKm: 30, longDay: "dim", today: "2026-10-03" });
type Found = { s: Session; phase: string; recovery: boolean };
const find = (plan: typeof marathon, pred: (f: Found) => boolean): Found | undefined =>
  plan.weeks.flatMap((w) => w.sessions.map((s) => ({ s, phase: w.phase, recovery: w.isRecovery }))).find(pred);

const easy = find(marathon, (f) => f.s.type === "easy")!;
const tEasy = targetsFor(model, marathon, easy.s)!;
check("footing : allure facile, comparable", tEasy.targets.length === 1 && tEasy.targets[0].label === "Allure facile" && tEasy.comparable);
check("la fourchette du footing est celle de la zone", near(tEasy.targets[0].slow, zoneRange(model.vdot, "facile").slow));
const rec = find(marathon, (f) => f.s.type === "recovery")!;
check("récupération : très facile, plus lent que le footing", targetsFor(model, marathon, rec.s)!.targets[0].label === "Très facile" && targetsFor(model, marathon, rec.s)!.targets[0].slow > tEasy.targets[0].slow);
const tempo = find(marathon, (f) => f.s.type === "tempo")!;
check("tempo : allure seuil, non comparable", targetsFor(model, marathon, tempo.s)!.targets[0].label === "Allure seuil" && !targetsFor(model, marathon, tempo.s)!.comparable);
const longPlain = find(marathon, (f) => f.s.type === "long" && f.phase !== "specifique")!;
check("sortie longue ordinaire : allure facile seule, comparable", targetsFor(model, marathon, longPlain.s)!.targets.length === 1 && targetsFor(model, marathon, longPlain.s)!.comparable);
const longSpec = find(marathon, (f) => f.s.type === "long" && f.phase === "specifique" && !f.recovery && f.s.km >= 14)!;
const tLong = targetsFor(model, marathon, longSpec.s)!;
check("sortie longue spécifique : facile puis allure marathon, non comparable", tLong.targets.length === 2 && tLong.targets[1].label.includes("marathon") && !tLong.comparable, tLong);
check("sortie longue spécifique en semaine de récupération : facile seule", (() => {
  const f = find(marathon, (x) => x.s.type === "long" && x.phase === "specifique" && x.recovery);
  return !f || targetsFor(model, marathon, f.s)!.targets.length === 1;
})());
const qBase = find(marathon, (f) => f.s.type === "quality" && f.phase === "base")!;
check("fartlek de la phase de base : au ressenti, sans allure", targetsFor(model, marathon, qBase.s) === null);
const qBuild = find(marathon, (f) => f.s.type === "quality" && f.phase === "construction")!;
check("fractionné de construction : allure 10 km", targetsFor(model, marathon, qBuild.s)!.targets[0].label === "Allure 10 km" && !targetsFor(model, marathon, qBuild.s)!.comparable);
const qSpec = find(marathon, (f) => f.s.type === "quality" && f.phase === "specifique")!;
check("blocs spécifiques du marathon : allure marathon", targetsFor(model, marathon, qSpec.s)!.targets[0].label === "Allure marathon");
const q10 = find(tenK, (f) => f.s.type === "quality" && f.phase === "specifique")!;
const t10 = targetsFor(model, tenK, q10.s)!.targets[0];
check("fractionné spécifique du 10 km : allure de course ou plus vite", t10.label.includes("un peu plus vite") && t10.fast < zoneRange(model.vdot, "10k").fast && near(t10.slow, zoneRange(model.vdot, "10k").slow), t10);
const race = find(marathon, (f) => f.s.type === "race")!;
check("jour de course : pas de cible", targetsFor(model, marathon, race.s) === null);
check("séance inconnue : pas de cible", targetsFor(model, marathon, { ...easy.s, id: "inconnue" }) === null);
check("toute séance du plan a une réponse sans erreur", marathon.weeks.flatMap((w) => w.sessions).every((s) => { targetsFor(model, marathon, s); return true; }));

// ---------- Temps objectif ----------
const fasterMarathon = { race: "marathon" as const, minutes: predictMinutes(model.vdot + 5, RACE_KM.marathon) }; // objectif nettement plus rapide que le niveau
const slowerMarathon = { race: "marathon" as const, minutes: predictMinutes(model.vdot - 5, RACE_KM.marathon) }; // objectif plus facile que le niveau
const gp = goalPace(fasterMarathon);
const within = (t: { slow: number; fast: number }, pace: number, margin = 0.011) => t.slow <= pace * (1 + margin) && t.fast >= pace * (1 - margin - 0.001);

const raceDay = targetsFor(model, marathon, race.s, fasterMarathon)!;
check("jour de course : allure objectif", raceDay.targets[0].label === "Allure objectif" && within(raceDay.targets[0], gp) && !raceDay.comparable, raceDay);
check("jour de course sans objectif : toujours rien", targetsFor(model, marathon, race.s) === null);
const specGoal = targetsFor(model, marathon, qSpec.s, fasterMarathon)!;
check("blocs spécifiques : exactement l'allure objectif", specGoal.targets[0].label === "Allure objectif" && within(specGoal.targets[0], gp), specGoal);
check("l'objectif plus rapide donne des blocs plus rapides que sans objectif", specGoal.targets[0].fast < targetsFor(model, marathon, qSpec.s)!.targets[0].fast);
const longGoal = targetsFor(model, marathon, longSpec.s, fasterMarathon)!;
check("sortie longue spécifique : facile inchangé, derniers km à l'objectif", near(longGoal.targets[0].slow, tLong.targets[0].slow) && longGoal.targets[1].label.includes("objectif") && within(longGoal.targets[1], gp), longGoal);
const easyGoal = targetsFor(model, marathon, easy.s, fasterMarathon)!;
check("le facile ne bouge pas avec l'objectif", near(easyGoal.targets[0].slow, tEasy.targets[0].slow) && near(easyGoal.targets[0].fast, tEasy.targets[0].fast));
check("la récupération non plus", near(targetsFor(model, marathon, rec.s, fasterMarathon)!.targets[0].slow, targetsFor(model, marathon, rec.s)!.targets[0].slow));

const tempoSessions = marathon.weeks.flatMap((w) => w.sessions.filter((s) => s.type === "tempo").map((s) => ({ s, w })));
const firstTempo = tempoSessions[0];
const lastBuildTempo = [...tempoSessions].reverse().find((x) => x.w.phase !== "affutage" && x.w.phase !== "course")!;
check("seuil de la première semaine : niveau actuel", near(targetsFor(model, marathon, firstTempo.s, fasterMarathon)!.targets[0].fast, targetsFor(model, marathon, firstTempo.s)!.targets[0].fast, 1e-9));
check("seuil en fin de construction : plus rapide qu'au départ pour un objectif exigeant", targetsFor(model, marathon, lastBuildTempo.s, fasterMarathon)!.targets[0].fast < targetsFor(model, marathon, lastBuildTempo.s)!.targets[0].fast);
const seuilPaces = tempoSessions.filter((x) => x.w.phase !== "affutage" && x.w.phase !== "course").map((x) => targetsFor(model, marathon, x.s, fasterMarathon)!.targets[0].fast);
check("le seuil accélère régulièrement sur la construction", seuilPaces.every((p, i) => i === 0 || p <= seuilPaces[i - 1] + 1e-9), seuilPaces);
check("objectif plus facile que le niveau : le travail ne ralentit jamais", tempoSessions.every((x) => near(targetsFor(model, marathon, x.s, slowerMarathon)!.targets[0].fast, targetsFor(model, marathon, x.s)!.targets[0].fast, 1e-9)));
check("objectif d'une autre course : ignoré", targetsFor(model, marathon, lastBuildTempo.s, { race: "10k", minutes: 38 })!.targets[0].fast === targetsFor(model, marathon, lastBuildTempo.s)!.targets[0].fast && targetsFor(model, marathon, race.s, { race: "10k", minutes: 38 }) === null);
const q10Goal = targetsFor(model, tenK, q10.s, { race: "10k", minutes: 42 })!.targets[0];
check("10 km : allure objectif ou un peu plus vite", q10Goal.label === "Allure objectif ou un peu plus vite" && q10Goal.fast < goalPace({ race: "10k", minutes: 42 }) * 0.985 && q10Goal.slow > goalPace({ race: "10k", minutes: 42 }), q10Goal);

const goalOnly = paceModel([], today, null, { race: "10k", minutes: 42 })!;
check("sans sortie ni saisie : le niveau vient de l'objectif", goalOnly.reference.source === "objectif" && near(goalOnly.vdot, vdotFromRace(10, 42), 1e-9) && near(paceAt(goalOnly.vdot, 0.7), goalOnly.reference.pace, 1e-9));
check("avec des sorties, l'objectif ne change pas le niveau", paceModel(steady, today, null, { race: "10k", minutes: 42 })!.reference.source === "recentes" && near(paceModel(steady, today, null, { race: "10k", minutes: 42 })!.vdot, paceModel(steady, today, null)!.vdot, 1e-9));
check("rien du tout : pas de modèle", paceModel([], today, null, null) === null);
const onlyGoalTargets = targetsFor(goalOnly, tenK, q10.s, { race: "10k", minutes: 42 });
check("cibles possibles avec le seul objectif", onlyGoalTargets !== null && onlyGoalTargets.targets.length === 1);

// ---------- Comparaison ----------
const range = { slow: 6.5, fast: 6.0 };
check("dans la fourchette", comparePace(6.2, range).verdict === "dans");
check("sur les bords (marge de 3 s)", comparePace(6.5 + 2 / 60, range).verdict === "dans" && comparePace(6.0 - 2 / 60, range).verdict === "dans");
const slow = comparePace(6.6, range);
check("trop lent : écart au bord lent", slow.verdict === "lent" && slow.seconds === 6, slow);
const fast = comparePace(5.9, range);
check("trop rapide : écart au bord rapide", fast.verdict === "rapide" && fast.seconds === 6, fast);

console.log(failures === 0 ? "\nTout est bon." : `\n${failures} échec(s).`);
process.exit(failures === 0 ? 0 : 1);
