import { addDays, mondayOf, type Plan } from "../src/lib/plan.ts";
import { buildImportedPlan, inferType, parseSessions } from "../src/lib/planimport.ts";
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

const bad = parseSessions("2026-02-30 ; Footing ; 5\nhier ; Footing ; 5\n2026-10-06 ; ; 5\n2026-10-06 ; Footing ; abc\n2026-10-06 ; Footing ; 5\n2026-10-06 ; Autre ; 6\nligne sans séparateur");
check("lecture : chaque ligne en erreur signalée", !bad.ok && bad.errors.length === 6 && bad.errors[0].startsWith("Ligne 1"), bad);
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

// ---------- Décalage d'un plan repris : mêmes séances, décalées, la course ne bouge pas ----------
const titles = (p: Plan) => p.weeks.map((w) => w.sessions.map((x) => x.title).join(" / "));
const one = shiftPlan(plan, 1, {}, "2026-10-05");
check("décalage : une semaine de pause acceptée", one.ok, one);
if (one.ok) {
  const p = one.plan;
  check("décalage : même nombre de semaines, la première en pause", p.weeks.length === 4 && p.weeks[0].paused === true && p.weeks[0].sessions.length === 0 && p.weeks.every((w, i) => w.index === i), p.weeks.map((w) => [w.index, w.startDate]));
  check("décalage : la semaine pas faite reprend après la pause, jour de la semaine conservé", p.weeks[1].startDate === "2026-10-12" && p.weeks[1].sessions.map((x) => x.date).join() === "2026-10-13,2026-10-15,2026-10-18" && p.weeks[1].sessions[2].title === "Sortie longue progressive" && p.weeks[1].sessions[2].km === 16, p.weeks[1].sessions);
  check("décalage : la semaine juste avant l'affûtage est retirée", titles(p)[1].includes("Fractionnés") && !titles(p).some((t) => t.includes("Tempo sur 5 km")), titles(p));
  check("décalage : affûtage et course gardent leur date", p.weeks[2].sessions.map((x) => x.date).join() === "2026-10-20,2026-10-22,2026-10-25" && p.weeks[3].sessions[1].date === "2026-11-01" && p.weeks[3].sessions[1].type === "race");
  check("décalage : identifiants alignés sur les nouvelles dates, uniques", p.weeks.flatMap((w) => w.sessions).every((x) => x.id === "s-" + x.date) && new Set(p.weeks.flatMap((w) => w.sessions.map((x) => x.id))).size === p.weeks.flatMap((w) => w.sessions).length);
  check("décalage : totaux de semaine recalculés, plan toujours repris, remarque ajoutée", p.weeks[1].totalKm === 35 && p.source === "Runna" && p.warnings.some((w) => w.startsWith("Programme décalé de 1 semaine") && w.includes("juste avant l'affûtage")) && p.warnings.some((w) => w.includes("après la course")), p.warnings);
  check("décalage : l'entrée du plan et le plan d'origine ne bougent pas", p.input.raceDate === "2026-11-01" && plan.weeks[0].startDate === "2026-10-05" && plan.weeks[0].sessions[0].date === "2026-10-06");
  check("décalage : annulable tant que rien n'est utilisé", canUndoShift(plan, p, {}, []));
}
const two = shiftPlan(plan, 2, {}, "2026-10-05");
check("décalage : deux semaines, on reprend directement sur l'affûtage", two.ok && two.plan.weeks[1].sessions.length === 0 && two.plan.weeks[1].paused === true && two.plan.weeks[2].sessions[0].title === "Course facile de 8 km" && two.plan.weeks[2].sessions[0].date === "2026-10-20", two.ok ? two.plan.weeks.map((w) => w.sessions.length) : two);
const three = shiftPlan(plan, 3, {}, "2026-10-05");
check("décalage : trop long pour laisser de la place à l'affûtage, refusé", !three.ok && three.error.includes("affûtage"), three);
// Une séance validée à l'avance reste à sa place ; celles du passé de la semaine aussi.
const doneAhead = shiftPlan(plan, 1, { "s-2026-10-11": true }, "2026-10-08");
check("décalage : séance validée à l'avance gardée à sa date, les autres décalées", doneAhead.ok && doneAhead.plan.weeks.flatMap((w) => w.sessions).filter((x) => x.id === "s-2026-10-11").length === 1 && doneAhead.plan.weeks[0].sessions.map((x) => x.date).join() === "2026-10-06,2026-10-11" , doneAhead.ok ? doneAhead.plan.weeks.map((w) => w.sessions.map((x) => x.date)) : doneAhead);

console.log(failures === 0 ? "\nTout est bon." : `\n${failures} échec(s).`);
process.exit(failures === 0 ? 0 : 1);
