import { addDays, mondayOf, type Plan } from "../src/lib/plan.ts";
import { buildImportedPlan, inferType, parseSessions, parseStep } from "../src/lib/planimport.ts";
import { upgradePlan, upgradableCount } from "../src/lib/workouts.ts";
import { workoutBlocks } from "../src/lib/steps.ts";
import { makeBackup, parseBackup, EMPTY_SNAPSHOT } from "../src/lib/backup.ts";
import { canUndoShift, shiftPlan } from "../src/lib/shift.ts";

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (!ok) {
    failures++;
    console.log("ECHEC", name, detail ?? "");
  } else console.log("ok   ", name);
}

// Un vrai plan de semi-marathon repris de Runna (semaines 9 à 12, puis les semaines d'après la course).
const TEXT = `
# Semaine 9
2026-10-06 ; Course facile de 10 km ; 10
2026-10-08 ; Fractionnés en km ; 9
2026-10-11 ; Sortie longue progressive ; 16
# Semaine 10
2026-10-13 ; Course facile de 9 km ; 9
2026-10-15 ; Tempo sur 5 km ; 7,5
2026-10-18 ; Sortie longue de 12 km ; 12
# Semaine 11
2026-10-20 ; Course facile de 8 km ; 8
2026-10-22 ; 1 km + 200 m ; 6
2026-10-25 ; Sortie longue d'entraînement ; 9
# Semaine 12
2026-10-29 ; Km d'entraînement à allure ; 6,5
2026-11-01 ; Course sur semi-marathon ; 21,1
# Après la course
2026-11-06 ; Course facile de 4 km ; 4
2026-11-10 ; Course facile de 4,5 km ; 4,5
`;

const parsed = parseSessions(TEXT);
check("lecture : toutes les séances reconnues", parsed.ok && parsed.sessions.length === 13, parsed);
if (!parsed.ok) process.exit(1);
check("lecture : virgule décimale, « km » accepté", parsed.sessions[4].km === 7.5 && parseSessions("2026-10-06 | Footing | 5 km").ok);

const bad = parseSessions("hier ; Footing ; 5\n2026-02-30 ; Footing ; 5\n2026-10-06 ; ; 5\n2026-10-06 ; Footing ; abc\n2026-10-06 ; Footing ; 5\n2026-10-06 ; Autre ; 6\n2026-10-07");
check("lecture : chaque ligne en erreur signalée", !bad.ok && bad.errors.length === 6 && bad.errors[0].startsWith("Ligne 1") && bad.errors[1].startsWith("Ligne 2"), bad);
check("lecture : texte vide refusé", !parseSessions("  \n# rien").ok);

check("type : sorties longues, course, tempo, qualité, facile", inferType("Sortie longue progressive") === "long" && inferType("Course sur semi-marathon") === "race" && inferType("Tempo sur 5 km") === "tempo" && inferType("Km d'entraînement à allure") === "tempo" && inferType("Fractionnés en km") === "quality" && inferType("1 km + 200 m") === "quality" && inferType("400 m variables") === "quality" && inferType("Course facile de 10 km") === "easy");
check("type : récupération, décrassage, renforcement", inferType("Footing de récupération") === "recovery" && inferType("Décrassage") === "shakeout" && inferType("Renforcement jambes") === "strength");

const plan: Plan = buildImportedPlan(parsed.sessions, { race: "semi", raceDate: "2026-11-01", text: TEXT, source: "Runna", today: "2026-10-05" });
check("plan : quatre semaines, du lundi 5 octobre au lundi 26 octobre", plan.weeks.length === 4 && plan.weeks[0].startDate === "2026-10-05" && plan.weeks[3].startDate === "2026-10-26" && plan.weeks.every((w, i) => w.index === i));
check("plan : totaux de Runna retrouvés (35 ; 28,5 ; 23 ; 27,6 km)", plan.weeks.map((w) => w.totalKm).join() === "35,28.5,23,27.6", plan.weeks.map((w) => w.totalKm));
check("plan : séances d'après la course non reprises, avertissement", plan.weeks.flatMap((w) => w.sessions).length === 11 && plan.warnings.length === 1 && plan.warnings[0].startsWith("2 séances après la course"), plan.warnings);
check("plan : phases (travail, affûtage, course)", plan.weeks.map((w) => w.phase).join() === "specifique,specifique,affutage,course", plan.weeks.map((w) => w.phase));
check("plan : entrée du plan déduite", plan.input.race === "semi" && plan.input.raceDate === "2026-11-01" && plan.input.longDay === "dim" && plan.input.daysPerWeek === 3 && plan.input.currentWeeklyKm === 35 && plan.source === "Runna", plan.input);
check("plan : titres et distances gardés tels quels", plan.weeks[0].sessions[2].title === "Sortie longue progressive" && plan.weeks[0].sessions[2].km === 16 && plan.weeks[3].sessions[1].type === "race" && plan.weeks[3].sessions[1].km === 21.1);
check("plan : identifiants datés, uniques", new Set(plan.weeks.flatMap((w) => w.sessions.map((s) => s.id))).size === 11 && plan.weeks[0].sessions[0].id === "s-2026-10-06");

// Un plan repris n'est jamais réécrit par le catalogue, ni deviné par le pas à pas.
check("mise à jour du catalogue : rien à changer", upgradableCount(plan, {}, "2026-10-05") === 0 && upgradePlan(plan, {}, "2026-10-05") === plan);
const q = plan.weeks[0].sessions[1];
const blocks = workoutBlocks(plan, q, null);
check("pas à pas : pas de déroulé inventé pour une séance reprise", blocks === null || blocks.length <= 1, blocks);

// Semaines à cheval sur plusieurs mois, plan démarrant en milieu de semaine, plan sans séance de course.
const sparse = parseSessions("2026-10-07 ; Footing ; 5\n2026-10-25 ; Sortie longue ; 12");
const noRace = buildImportedPlan(sparse.ok ? sparse.sessions : [], { race: "10k", raceDate: "2026-11-01", text: "", source: "Coach", today: "2026-10-05" });
check("plan : semaines vides entre deux séances gardées, avertissement sans course", noRace.weeks.length === 4 && noRace.weeks[1].sessions.length === 0 && noRace.warnings.some((w) => w.includes("jour de la course")), noRace.warnings);
check("plan : lundi de départ", noRace.weeks[0].startDate === mondayOf("2026-10-07"));

let err = "";
try {
  buildImportedPlan(parsed.sessions, { race: "semi", raceDate: "2026-10-01", text: "", source: "x", today: "2026-10-05" });
} catch (e) {
  err = (e as Error).message;
}
check("plan : toutes les séances après la course, refusé", err.includes("avant la date"), err);
err = "";
try {
  buildImportedPlan(parsed.sessions, { race: "semi", raceDate: "2026-13-45", text: "", source: "x", today: "2026-10-05" });
} catch (e) {
  err = (e as Error).message;
}
check("plan : date de course invalide, refusé", err.includes("pas valide"), err);
err = "";
try {
  buildImportedPlan([{ date: "2020-01-01", title: "Footing", km: 5 }, { date: "2026-10-05", title: "Footing", km: 5 }], { race: "semi", raceDate: "2026-11-01", text: "", source: "x", today: "2026-10-05" });
} catch (e) {
  err = (e as Error).message;
}
check("plan : plus de 60 semaines, refusé", err.includes("60 semaines"), err);

// Le reste de l'application accepte le plan : sauvegarde, décalage.
const text = makeBackup({ ...EMPTY_SNAPSHOT, plan, activities: [], done: {}, confirmed: true }, new Date("2026-10-05T10:00:00Z"));
const back = parseBackup(text);
check("sauvegarde : le plan repris survit à l'aller-retour, source comprise", back.ok && back.data.plan?.source === "Runna" && back.data.plan.weeks[0].sessions.length === 3, back);

// ---------- Déroulé des séances : allures, répétitions, marche ----------
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
const mmss = (m: number, sec: number) => m + sec / 60;
const st = (t: string) => {
  const r = parseStep(t);
  if (typeof r === "string") throw new Error(r);
  return r;
};
const a1 = st("1,5 km conversationnelle, pas plus vite que 7:30/km");
check("étape : « pas plus vite que » donne un plafond", a1.kind === "easy" && a1.distanceM === 1500 && a1.paceMode === "plafond" && near(a1.pace!.fast, 7.5) && a1.label === "Allure conversationnelle", a1);
const a2 = st("1 km >= 7:30");
check("étape : « >= 7:30 » est la même chose", a2.paceMode === "plafond" && near(a2.pace!.fast, 7.5) && a2.distanceM === 1000);
const a3 = st("1 km à 7:05/km");
check("étape : allure unique", a3.kind === "work" && near(a3.pace!.fast, mmss(7, 5)) && a3.pace!.fast === a3.pace!.slow && a3.paceMode === "fourchette", a3);
check("étape : « 1 km : 7:05/km » (écriture de Runna) lue aussi", st("1 km : 7:05/km").distanceM === 1000 && near(st("1 km : 7:05/km").pace!.fast, mmss(7, 5)));
const a4 = st("5 km 6:30-7:00");
check("étape : fourchette d'allures", near(a4.pace!.fast, 6.5) && near(a4.pace!.slow, 7) && a4.paceMode === "fourchette");
check("étape : distance en mètres, durée en minutes et en secondes", st("200 m à 5:45/km").distanceM === 200 && st("2 min facile").seconds === 120 && st("45 s à 5:00/km").seconds === 45);
const a5 = st("Marche de repos de 90 s");
check("étape : marche de repos", a5.kind === "rest" && a5.seconds === 90 && a5.pace === undefined && a5.label === "Marche de repos");
check("étape : marche active", st("Marche 5 min").kind === "walk" && st("Marche 5 min").seconds === 300);
const a6 = st("2 km conversationnelle | Ajoutez deux fois 15 secondes d'accélérations");
check("étape : consigne après |", a6.kind === "easy" && a6.effort === "Ajoutez deux fois 15 secondes d'accélérations" && a6.pace === undefined);
check("étape : allure absente, allure libre", st("3 km").label === "Allure libre" && st("3 km").pace === undefined);
check("étape : erreurs claires", typeof parseStep("à 7:05/km") === "string" && typeof parseStep("1 km à 7:75/km") === "string" && typeof parseStep("1 km à 1:05/km") === "string" && typeof parseStep("Marche") === "string" && typeof parseStep("0 km") === "string");

// Les trois séances vues dans l'application Runna : fractionné en kilomètres, sortie progressive, 1 km + 200 m avec marche.
const DETAILED = `
2026-10-08 ; Fractionnés en km ; 9
Échauffement
- 1,5 km conversationnelle, pas plus vite que 7:30/km
Répéter 3x
- 1 km à 7:05/km
- 1 km à 6:30/km
Repos
- Marche de repos de 90 s
Retour au calme
- 1,5 km conversationnelle | Ou plus lentement !
2026-10-11 ; Sortie longue progressive ; 16
- 6 km à 7:30/km
- 5 km à 7:15/km
- 4 km à 7:05/km
- 1 km conversationnelle
2026-10-22 ; 1 km + 200 m ; 6
Échauffement
- 2 km conversationnelle | Ajoutez deux fois 15 secondes d'accélérations rapides à votre jogging d'échauffement
- Marche de repos de 90 s
Répéter 2x
- 1 km à 6:20/km
- 200 m à 5:45/km
- Marche de repos de 120 s
Retour au calme
- 1,6 km conversationnelle | ou plus lentement !
2026-11-01 ; Course sur semi-marathon ; 21,1
`;
const det = parseSessions(DETAILED);
check("déroulé : trois séances détaillées et la course sans détail", det.ok && det.sessions.length === 4 && det.sessions[3].blocks === undefined, det);
if (det.ok) {
  const [frac, prog, cote] = det.sessions;
  const meters = (b: NonNullable<typeof frac.blocks>) => b.reduce((acc, x) => acc + x.repeat * x.steps.reduce((a, y) => a + (y.distanceM ?? 0), 0), 0);
  check("fractionné : blocs échauffement, répétitions x3, repos, retour au calme", frac.blocks!.map((b) => b.title + "/" + b.repeat + "/" + b.tone).join() === "Échauffement/1/warmup,Séance/3/main,Repos/1/cooldown,Retour au calme/1/cooldown", frac.blocks!.map((b) => b.title));
  check("fractionné : les distances font bien les 9 km de la séance", meters(frac.blocks!) === 9000, meters(frac.blocks!));
  check("fractionné : deux allures dans la répétition, plafond à l'échauffement, repos en marche", frac.blocks![1].steps.length === 2 && near(frac.blocks![1].steps[1].pace!.fast, 6.5) && frac.blocks![0].steps[0].paceMode === "plafond" && frac.blocks![2].steps[0].kind === "rest");
  check("progressive : un seul bloc, allures de plus en plus rapides, 16 km", prog.blocks!.length === 1 && prog.blocks![0].title === "Séance" && prog.blocks![0].repeat === 1 && prog.blocks![0].steps.map((x) => x.pace?.fast ?? 0).join() === [mmss(7, 30), mmss(7, 15), mmss(7, 5), 0].join() && meters(prog.blocks!) === 16000, prog.blocks);
  check("1 km + 200 m : marche dans l'échauffement et dans la répétition, 6 km", cote.blocks![0].steps.length === 2 && cote.blocks![0].steps[1].kind === "rest" && cote.blocks![1].repeat === 2 && cote.blocks![1].steps.length === 3 && cote.blocks![1].steps[2].seconds === 120 && meters(cote.blocks!) === 6000, cote.blocks);
  check("1 km + 200 m : consigne de l'échauffement gardée", cote.blocks![0].steps[0].effort?.startsWith("Ajoutez deux fois 15 secondes") === true);

  const dp = buildImportedPlan(det.sessions, { race: "semi", raceDate: "2026-11-01", text: "", source: "Runna", today: "2026-10-05" });
  const frac2 = dp.weeks.flatMap((w) => w.sessions).find((x) => x.title === "Fractionnés en km")!;
  const shown = workoutBlocks(dp, frac2, null);
  check("pas à pas : la séance reprise affiche son déroulé, sans modèle d'allures", shown !== null && shown.length === 4 && shown[1].repeat === 3 && shown[0].steps[0].paceMode === "plafond", shown);
  const strava = workoutBlocks(dp, dp.weeks.flatMap((w) => w.sessions).find((x) => x.title.startsWith("Course sur"))!, null);
  check("pas à pas : une séance sans détail garde l'affichage de base", strava !== null && strava.length === 1, strava);
  const shifted = shiftPlan(dp, 1, {}, "2026-10-05");
  check("décalage : le déroulé suit la séance", shifted.ok && shifted.plan.weeks.flatMap((w) => w.sessions).find((x) => x.title === "Fractionnés en km")?.blocks?.length === 4);
}
const headless = parseSessions("- 1 km à 7:05/km");
check("déroulé : une étape avant toute séance est refusée", !headless.ok && headless.errors[0].startsWith("Ligne 1"), headless);
const empty = parseSessions("2026-10-06 ; Fractionnés ; 9\nÉchauffement\nRépéter 3x\n- 1 km à 7:05/km");
check("déroulé : un bloc sans étape est signalé", !empty.ok && empty.errors[0].includes("aucune étape"), empty);
const wrongTimes = parseSessions("2026-10-06 ; Fractionnés ; 9\nRépéter 1x\n- 1 km à 7:05/km");
check("déroulé : une seule répétition refusée", !wrongTimes.ok, wrongTimes);
const badStep = parseSessions("2026-10-06 ; Fractionnés ; 9\n- à 7:05\n2026-10-07 ; Footing ; 5");
check("déroulé : étape illisible signalée avec son numéro de ligne, la suite est lue", !badStep.ok && badStep.errors.length === 1 && badStep.errors[0].startsWith("Ligne 2"), badStep);
check("déroulé : écritures de répétition (x3, 3 fois, Repeter 4x)", ["Répéter x3", "3x", "x3", "3 fois", "Repeter 3x"].every((h) => { const r = parseSessions("2026-10-06 ; Fractionnés ; 3\n" + h + "\n- 1 km à 7:00/km"); return r.ok && r.sessions[0].blocks![0].repeat === 3; }));

// ---------- Décalage d'un plan repris : tout est décalé, la course aussi, aucune semaine perdue ----------
const one = shiftPlan(plan, 1, {}, "2026-10-05");
check("décalage : une semaine de pause acceptée", one.ok, one);
if (one.ok) {
  const p = one.plan;
  const all = p.weeks.flatMap((w) => w.sessions);
  check("décalage : une semaine de plus, la première en pause", p.weeks.length === 5 && p.weeks[0].paused === true && p.weeks[0].sessions.length === 0 && p.weeks.every((w, i) => w.index === i), p.weeks.map((w) => [w.index, w.startDate]));
  check("décalage : aucune séance perdue, mêmes titres et mêmes kilomètres", all.length === 11 && all.map((x) => x.title).join() === plan.weeks.flatMap((w) => w.sessions).map((x) => x.title).join() && all.reduce((a, x) => a + x.km, 0) === plan.weeks.flatMap((w) => w.sessions).reduce((a, x) => a + x.km, 0));
  check("décalage : chaque séance reculée d'exactement sept jours", plan.weeks.flatMap((w) => w.sessions).every((x, i) => all[i].date === addDays(x.date, 7)));
  check("décalage : reprise le lundi suivant, jour de la semaine conservé", p.weeks[1].startDate === "2026-10-12" && p.weeks[1].sessions.map((x) => x.date).join() === "2026-10-13,2026-10-15,2026-10-18", p.weeks[1].sessions);
  check("décalage : la course est repoussée d'une semaine", p.input.raceDate === "2026-11-08" && one.raceDate === "2026-11-08" && p.weeks[4].sessions[1].date === "2026-11-08" && p.weeks[4].sessions[1].type === "race" && p.weeks[4].phase === "course");
  check("décalage : identifiants alignés sur les nouvelles dates, uniques", all.every((x) => x.id === "s-" + x.date) && new Set(all.map((x) => x.id)).size === all.length);
  check("décalage : totaux de semaine gardés, plan toujours repris, remarque ajoutée", p.weeks.map((w) => w.totalKm).join() === "0,35,28.5,23,27.6" && p.source === "Runna" && p.warnings.some((w) => w.startsWith("Programme décalé de 1 semaine") && w.includes("01/11") && w.includes("08/11")) && p.warnings.some((w) => w.includes("après la course")), p.warnings);
  check("décalage : le plan d'origine n'est pas modifié", plan.input.raceDate === "2026-11-01" && plan.weeks[0].sessions[0].date === "2026-10-06" && plan.weeks.length === 4);
  check("décalage : annulable tant que rien n'est utilisé", canUndoShift(plan, p, {}, []));
  const again = shiftPlan(p, 2, {}, "2026-10-12");
  check("décalage : un second décalage s'ajoute au premier", again.ok && again.plan.input.raceDate === "2026-11-22" && again.plan.weeks.length === 7 && again.plan.warnings.filter((w) => w.startsWith("Programme décalé")).length === 2, again.ok ? again.plan.warnings : again);
}
const three = shiftPlan(plan, 3, {}, "2026-10-05");
check("décalage : trois semaines, la course passe au 22 novembre", three.ok && three.plan.input.raceDate === "2026-11-22" && three.plan.weeks.length === 7 && three.plan.weeks.slice(0, 3).every((w) => w.paused), three.ok ? "" : three);
// Une séance validée à l'avance reste à sa place ; celles du passé de la semaine aussi.
const doneAhead = shiftPlan(plan, 1, { "s-2026-10-11": true }, "2026-10-08");
check("décalage : séance validée à l'avance gardée à sa date, les autres décalées", doneAhead.ok && doneAhead.plan.weeks.flatMap((w) => w.sessions).filter((x) => x.id === "s-2026-10-11").length === 1 && doneAhead.plan.weeks[0].sessions.map((x) => x.date).join() === "2026-10-06,2026-10-11", doneAhead.ok ? doneAhead.plan.weeks.map((w) => w.sessions.map((x) => x.date)) : doneAhead);

console.log(failures === 0 ? "\nTout est bon." : `\n${failures} échec(s).`);
process.exit(failures === 0 ? 0 : 1);
