import { isDeepStrictEqual } from "node:util";
import { addDays, diffDays, generatePlan, weekdayIndex, type Plan } from "../src/lib/plan.ts";
import { MAX_SHIFT_WEEKS, MISSED_THRESHOLD, canUndoShift, missedStreak, resumeFactor, shiftPlan } from "../src/lib/shift.ts";

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (!ok) {
    failures++;
    console.log("ECHEC", name, detail ?? "");
  } else console.log("ok   ", name);
}

const input = { race: "10k" as const, raceDate: "2027-01-10", level: "intermediaire" as const, daysPerWeek: 4 as const, currentWeeklyKm: 25, longDay: "dim" as const };
const plan = generatePlan({ ...input, today: "2026-09-14" });
const today = "2026-10-14"; // mercredi
const sessionsOf = (p: Plan) => p.weeks.flatMap((w) => w.sessions);
const original = structuredClone(plan);

const week4 = plan.weeks.find((w) => w.startDate === "2026-10-12")!;
const missed = week4.sessions.find((s) => s.date < today)!; // mardi, non fait
const future = week4.sessions.filter((s) => s.date >= today);

const r1 = shiftPlan(plan, 1, {}, today);
if (!r1.ok) throw new Error(r1.error);
const p1 = r1.plan;

check("le plan d'origine n'est pas modifié", isDeepStrictEqual(plan, original));
check("reprise le lundi une semaine après la semaine en cours", r1.resumeDate === "2026-10-19" && weekdayIndex(r1.resumeDate) === 0, r1.resumeDate);
check("les semaines passées sont inchangées", p1.weeks.slice(0, 4).every((w, i) => isDeepStrictEqual({ ...w, index: 0 }, { ...plan.weeks[i], index: 0 })));
const paused1 = p1.weeks[4];
check("semaine en cours : séance manquée gardée, séances restantes retirées, semaine en pause", paused1.paused === true && paused1.sessions.length === 1 && paused1.sessions[0].id === missed.id, paused1);
check("kilomètres de la semaine en pause recalculés", paused1.totalKm === missed.km);
check("décaler d'1 semaine : une seule semaine en pause", r1.pausedWeeks === 1 && p1.weeks.filter((w) => w.paused).length === 1);
check("la semaine suivante reprend le programme", p1.weeks[5].startDate === "2026-10-19" && p1.weeks[5].sessions.length > 0 && !p1.weeks[5].paused);
check("la date de la course ne bouge pas", p1.input.raceDate === "2027-01-10" && sessionsOf(p1).filter((s) => s.type === "race").length === 1 && sessionsOf(p1).at(-1)!.date === "2027-01-10");
check("aucune séance après la course", sessionsOf(p1).every((s) => s.date <= "2027-01-10"));
check("semaines contiguës", p1.weeks.every((w, i) => i === 0 || w.startDate === addDays(p1.weeks[i - 1].startDate, 7)));
check("index consécutifs", p1.weeks.every((w, i) => w.index === i));
const ids = sessionsOf(p1).map((s) => s.id);
check("identifiants de séance uniques", new Set(ids).size === ids.length);
check("une semaine de préparation en moins", p1.weeks.length === plan.weeks.length, [p1.weeks.length, plan.weeks.length]);
check("semaines restantes après reprise", r1.weeksLeft === p1.weeks.length - 5, r1.weeksLeft);
check("le plan se termine toujours par la semaine de course", p1.weeks.at(-1)!.phase === "course");
check("remarque ajoutée", p1.warnings.some((w) => w.startsWith("Programme décalé de 1 semaine")), p1.warnings);
check("les séances reportées n'existent plus aux anciennes dates", future.every((s) => !ids.includes(s.id) || sessionsOf(p1).find((x) => x.id === s.id)!.date === s.date));

// ---------- Plusieurs semaines ----------
const r3 = shiftPlan(plan, 3, {}, today);
if (!r3.ok) throw new Error(r3.error);
check("3 semaines : 3 semaines en pause, reprise 3 semaines plus tard", r3.pausedWeeks === 3 && r3.resumeDate === "2026-11-02" && r3.plan.weeks.filter((w) => w.paused).length === 3);
check("semaines de pause vides (sauf le passé de la semaine en cours)", r3.plan.weeks.filter((w) => w.paused).slice(1).every((w) => w.sessions.length === 0 && w.totalKm === 0));
check("moins de semaines de préparation, plan condensé", r3.weeksLeft < r1.weeksLeft && r3.plan.weeks.at(-1)!.phase === "course");
check("contiguïté conservée avec la pause", r3.plan.weeks.every((w, i) => i === 0 || w.startDate === addDays(r3.plan.weeks[i - 1].startDate, 7)));

// ---------- Charge de reprise ----------
const normalKm = shiftPlan(plan, 1, {}, today);
check("charge de reprise : facteurs décroissants, planchers", resumeFactor(1) === 1 && resumeFactor(2) === 0.9 && resumeFactor(3) === 0.8 && resumeFactor(4) === 0.7 && resumeFactor(8) === 0.7);
if (!normalKm.ok) throw new Error("x");
const lastBefore = Math.max(...[plan.weeks[3], week4].map((w) => w.sessions.reduce((a, s) => a + s.km, 0)));
const firstAfter = normalKm.plan.weeks[5].totalKm;
check("reprise sans dépasser la charge d'avant la pause", firstAfter <= lastBefore * 1.1, [firstAfter, lastBefore]);
const longPause = shiftPlan(plan, 4, {}, today);
if (!longPause.ok) throw new Error("x");
check("après une longue pause, reprise plus douce", longPause.plan.weeks[longPause.plan.weeks.findIndex((w) => !w.paused && w.index > 4)].totalKm < firstAfter + 0.01);

// ---------- Séances déjà validées ----------
const preDone = future[1]; // une séance à venir déjà validée à l'avance
const rDone = shiftPlan(plan, 1, { [preDone.id]: true }, today);
if (!rDone.ok) throw new Error(rDone.error);
const kept = sessionsOf(rDone.plan).filter((s) => s.id === preDone.id);
check("séance validée à l'avance : conservée à sa date", kept.length === 1 && kept[0].date === preDone.date && rDone.plan.weeks[4].sessions.some((s) => s.id === preDone.id));
check("seule celle-là reste dans la semaine en pause", rDone.plan.weeks[4].sessions.length === 2);

// Validée dans une semaine qui sera régénérée : pas de doublon d'identifiant.
const laterWeek = plan.weeks[6].sessions[0]; // semaine d'après la reprise : remplacée par une séance de même date
const rLater = shiftPlan(plan, 1, { [laterWeek.id]: true }, today);
if (!rLater.ok) throw new Error(rLater.error);
const sameDate = sessionsOf(rLater.plan).filter((s) => s.date === laterWeek.date);
check("séance validée dans une semaine régénérée : une seule séance à cette date", sameDate.length === 1 && sameDate[0].id === laterWeek.id && isDeepStrictEqual(sameDate[0], laterWeek));
check("pas d'identifiant en double dans ce cas", new Set(sessionsOf(rLater.plan).map((s) => s.id)).size === sessionsOf(rLater.plan).length);

// ---------- Plan pas encore commencé ----------
const notStarted = generatePlan({ ...input, today: "2026-10-03" });
const rNS = shiftPlan(notStarted, 2, {}, "2026-10-03");
if (!rNS.ok) throw new Error(rNS.error);
check("plan pas commencé : les premières semaines sont en pause", rNS.plan.weeks[0].paused === true && rNS.plan.weeks[1].paused === true && rNS.plan.weeks[0].sessions.length === 0 && rNS.resumeDate === addDays(notStarted.weeks[0].startDate, 14), rNS.resumeDate);

// ---------- Décaler deux fois ----------
const twice = shiftPlan(p1, 1, {}, "2026-10-20");
if (!twice.ok) throw new Error(twice.error);
check("second décalage : les deux remarques sont conservées", twice.plan.warnings.filter((w) => w.startsWith("Programme décalé")).length === 2, twice.plan.warnings);
check("second décalage : cohérent", twice.plan.weeks.every((w, i) => w.index === i && (i === 0 || w.startDate === addDays(twice.plan.weeks[i - 1].startDate, 7))) && twice.plan.weeks.at(-1)!.phase === "course");

// ---------- Refus ----------
check("décalage nul ou fractionnaire refusé", !shiftPlan(plan, 0, {}, today).ok && !shiftPlan(plan, 1.5, {}, today).ok && !shiftPlan(plan, -1, {}, today).ok);
check(`plus de ${MAX_SHIFT_WEEKS} semaines refusé`, !shiftPlan(plan, MAX_SHIFT_WEEKS + 1, {}, today).ok);
const closeToRace = shiftPlan(plan, MAX_SHIFT_WEEKS, {}, "2026-12-30");
check("reprise après la course refusée, avec un message", !closeToRace.ok && closeToRace.error.includes("après la date de la course"), closeToRace);
check("course passée refusée", !shiftPlan(plan, 1, {}, "2027-01-11").ok);
const allDone: Record<string, boolean> = Object.fromEntries(sessionsOf(plan).filter((s) => s.date >= today).map((s) => [s.id, true]));
const nothing = shiftPlan(plan, 1, allDone, today);
check("rien à décaler quand tout est validé", !nothing.ok && nothing.error.includes("plus de séance"));
check("jusqu'à la veille de la reprise permise : pas de séance négative", (() => {
  const r = shiftPlan(plan, 1, {}, "2027-01-04");
  return !r.ok || diffDays(r.resumeDate, "2027-01-10") >= 0;
})());

// ---------- Annulation ----------
const changed = sessionsOf(p1).find((s) => {
  const old = sessionsOf(plan).find((o) => o.id === s.id);
  return old && JSON.stringify(old) !== JSON.stringify(s);
})!;
const unchanged = sessionsOf(p1).find((s) => sessionsOf(plan).some((o) => JSON.stringify(o) === JSON.stringify(s)))!;
check("le décalage change bien des séances sous le même identifiant", !!changed && !!unchanged);
check("annulation possible tant que seul l'inchangé est utilisé", canUndoShift(plan, p1, { [unchanged.id]: true }, []) && canUndoShift(plan, p1, {}, []) && canUndoShift(plan, p1, {}, [{ id: "a", date: "2026-10-01", km: 5, minutes: 30, sessionId: unchanged.id }]));
check("annulation impossible si une séance modifiée est validée", !canUndoShift(plan, p1, { [changed.id]: true }, []));
check("annulation impossible si une activité est liée à une séance modifiée", !canUndoShift(plan, p1, {}, [{ id: "a", date: "2026-10-20", km: 5, minutes: 30, sessionId: changed.id }]));
check("annulation impossible sans plan précédent", !canUndoShift(null, p1, {}, []));
check("annulation impossible si la séance validée n'existe pas dans l'ancien plan", !canUndoShift(plan, p1, { "s-2030-01-01": true }, []));

// ---------- Séances manquées d'affilée ----------
const late = "2026-10-21"; // mercredi de la semaine suivante : les séances de la semaine du 12 sont passées
const pastIds = sessionsOf(plan).filter((x) => x.date < late && x.date >= "2026-10-12").map((x) => x.id);
const m0 = missedStreak(plan, {}, [], late);
check("plusieurs séances manquées de suite : décalage proposé", !!m0 && m0.count >= MISSED_THRESHOLD && m0.suggestedWeeks >= 1 && m0.suggestedWeeks <= 3, m0);
check("la série remonte jusqu'au début du plan si rien n'est fait", !!m0 && m0.firstDate === sessionsOf(plan).find((x) => x.type !== "race")!.date && m0.lastDate < late, m0);
check("rien à proposer sous le seuil", missedStreak(plan, {}, [], "2026-09-16") === null);
check("une séance faite récemment referme la série", missedStreak(plan, { [pastIds[pastIds.length - 1]]: true }, [], late) === null);
check("une activité liée compte comme faite", missedStreak(plan, {}, [{ id: "a", date: "2026-10-20", km: 5, minutes: 30, sessionId: pastIds[pastIds.length - 1] }], late) === null);
check("une séance faite plus tôt limite la série", (() => {
  const all = sessionsOf(plan).filter((x) => x.date < late);
  const m = missedStreak(plan, { [all[all.length - 4].id]: true }, [], late);
  return !!m && m.count === 3;
})());
check("juste après un décalage, plus de proposition", missedStreak(p1, {}, [], today) === null);
check("pas de proposition si la course est passée", missedStreak(plan, {}, [], "2027-02-01") === null);

console.log(failures === 0 ? "\nTout est bon." : `\n${failures} échec(s).`);
process.exit(failures === 0 ? 0 : 1);
