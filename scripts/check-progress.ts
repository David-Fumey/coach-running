import { addDays, diffDays, generatePlan, weekdayIndex } from "../src/lib/plan.ts";
import type { Activity } from "../src/lib/activities.ts";
import {
  WINDOW_SIZE, bucketsOf, extrasOf, clampStart, defaultSelection, defaultStart, inScope, niceTicks, nextStart, planRange, startOf,
} from "../src/lib/progress.ts";

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (!ok) {
    failures++;
    console.log("ECHEC", name, detail ?? "");
  } else console.log("ok   ", name);
}

const plan = generatePlan({
  race: "10k", raceDate: "2027-01-10", level: "debutant", daysPerWeek: 3,
  currentWeeklyKm: 15, longDay: "dim", today: "2026-10-03",
});
const { from, to } = planRange(plan);
const act = (id: string, date: string, km: number, minutes: number): Activity => ({ id, date, km, minutes });
const today = "2026-10-20";

// ---------- Débuts de période ----------
check("semaine : le lundi", startOf("2026-10-07", "semaine") === "2026-10-05" && startOf("2026-10-05", "semaine") === "2026-10-05" && startOf("2026-10-11", "semaine") === "2026-10-05");
check("semaine : à cheval sur deux mois", startOf("2026-11-01", "semaine") === "2026-10-26");
check("mois / année", startOf("2026-10-31", "mois") === "2026-10-01" && startOf("2026-10-31", "annee") === "2026-01-01");
check("jour : le jour même, suivant = lendemain", startOf("2026-10-07", "jour") === "2026-10-07" && nextStart("2026-10-31", "jour") === "2026-11-01" && nextStart("2026-12-31", "jour") === "2027-01-01");
check("période suivante", nextStart("2026-12-28", "semaine") === "2027-01-04" && nextStart("2026-12-01", "mois") === "2027-01-01" && nextStart("2026-01-01", "annee") === "2027-01-01");
check("le plan commence un lundi", weekdayIndex(from) === 0, from);

// ---------- Portées ----------
const before = act("a", "2026-09-01", 10, 60); // avant le plan
const during = act("b", "2026-10-06", 5, 30);
const after = act("c", "2027-02-01", 7, 40); // après la course
const all = [before, during, after];
check("programme : seulement la période du plan", inScope(plan, all, "programme").length === 1 && inScope(plan, all, "programme")[0].id === "b");
check("total : tout", inScope(plan, all, "total").length === 3);
check("bornes du plan incluses", inScope(plan, [act("x", from, 5, 30), act("y", to, 5, 30), act("z", "2026-09-27", 5, 30)], "programme").length === 2);

// ---------- Périodes ----------
const days = bucketsOf(plan, [act("j1", "2026-10-06", 10, 55), act("j2", "2026-10-06", 5, 30), act("j3", "2026-10-08", 8, 48)], "programme", "jour", today);
const d6 = days.find((b) => b.start === "2026-10-06")!;
check("jour : une période par jour, du premier jour du plan à la course", days.length === diffDays(planRange(plan).from, planRange(plan).to) + 1 && days[0].start === planRange(plan).from && days[days.length - 1].start === planRange(plan).to, [days.length, planRange(plan)]);
check("jour : début et fin identiques", days.every((b) => b.start === b.end));
check("jour : deux sorties le même jour s'additionnent", d6.km === 15 && d6.minutes === 85 && d6.count === 2 && Math.abs(d6.pace! - 85 / 15) < 1e-9, d6);
check("jour : sans sortie, zéro et sans allure", days.find((b) => b.start === "2026-10-07")!.km === 0 && days.find((b) => b.start === "2026-10-07")!.pace === null);
check("jour : un seul jour en cours, les suivants à venir", days.filter((b) => b.current).length === 1 && days.find((b) => b.current)!.start === today && days.find((b) => b.start === addDays(today, 1))!.future && !days.find((b) => b.start === today)!.future, today);
check("jour : kilomètres prévus du jour", days.every((b) => Math.abs((b.plannedKm ?? -1) - plan.weeks.flatMap((w) => w.sessions).filter((s) => s.date === b.start).reduce((a, s) => a + s.km, 0)) < 1e-9));
check("jour : périodes contiguës", days.every((b, i) => i === 0 || nextStart(days[i - 1].start, "jour") === b.start));
check("jour : la somme des jours égale celle des semaines", Math.abs(days.reduce((a, b) => a + b.km, 0) - bucketsOf(plan, [act("j1", "2026-10-06", 10, 55), act("j2", "2026-10-06", 5, 30), act("j3", "2026-10-08", 8, 48)], "programme", "semaine", today).reduce((a, b) => a + b.km, 0)) < 1e-9);
check("jour : fenêtre d'un mois", WINDOW_SIZE.jour === 30);
const weeks = bucketsOf(plan, all, "programme", "semaine", today);
check("programme : une période par semaine du plan", weeks.length === plan.weeks.length, [weeks.length, plan.weeks.length]);
check("programme : première et dernière période", weeks[0].start === from && weeks[weeks.length - 1].end >= to);
check("km prévus par semaine = ceux du plan", weeks.every((b, i) => Math.abs((b.plannedKm ?? -1) - plan.weeks[i].sessions.reduce((s, x) => s + x.km, 0)) < 1e-9));
const w = weeks.find((b) => b.start === "2026-10-05")!;
check("somme d'une semaine", w.km === 5 && w.minutes === 30 && w.count === 1 && w.pace === 6, w);
check("semaine vide : zéro, sans allure", weeks.find((b) => b.start === "2026-10-12")!.km === 0 && weeks.find((b) => b.start === "2026-10-12")!.pace === null);
check("semaine en cours et futures", weeks.filter((b) => b.current).length === 1 && weeks.find((b) => b.current)!.start === "2026-10-19" && weeks.find((b) => b.start === "2026-10-26")!.future && !weeks.find((b) => b.start === "2026-10-12")!.future);
check("périodes contiguës, sans trou", weeks.every((b, i) => i === 0 || nextStart(weeks[i - 1].start, "semaine") === b.start));

const months = bucketsOf(plan, all, "programme", "mois", today);
check("programme par mois : oct. à janv.", months[0].start === "2026-10-01" || months[0].start === "2026-09-01", months.map((m) => m.start));
check("km prévus par mois = total du plan", Math.abs(months.reduce((s, b) => s + (b.plannedKm ?? 0), 0) - plan.weeks.flatMap((x) => x.sessions).reduce((s, x) => s + x.km, 0)) < 1e-9);
check("km courus par mois", months.reduce((s, b) => s + b.km, 0) === 5);

const years = bucketsOf(plan, all, "programme", "annee", today);
check("programme sur deux années", years.length === 2 && years[0].start === "2026-01-01" && years[1].start === "2027-01-01", years.map((y) => y.start));

const totalW = bucketsOf(plan, all, "total", "mois", today);
check("total : de la première activité à aujourd'hui", totalW[0].start === "2026-09-01" && totalW[totalW.length - 1].start === "2027-02-01");
check("total : pas de km prévus", totalW.every((b) => b.plannedKm === null));
check("total : toutes les sorties comptées", totalW.reduce((s, b) => s + b.km, 0) === 22);
const totalToday = bucketsOf(plan, [before, during], "total", "mois", today);
check("total : s'arrête au mois courant", totalToday[totalToday.length - 1].start === "2026-10-01" && totalToday[totalToday.length - 1].current);
check("total sans activité : aucune période", bucketsOf(plan, [], "total", "semaine", today).length === 0);
check("programme sans activité : périodes prévues seulement", bucketsOf(plan, [], "programme", "semaine", today).every((b) => b.km === 0 && b.count === 0));

const pace = bucketsOf(plan, [act("p1", "2026-10-06", 10, 55), act("p2", "2026-10-07", 5, 30)], "programme", "semaine", today).find((b) => b.start === "2026-10-05")!;
check("allure d'une période = temps total / distance totale", Math.abs(pace.pace! - 85 / 15) < 1e-9 && pace.count === 2);

const year = bucketsOf(plan, [act("y1", "2024-03-02", 10, 60), act("y2", "2025-06-10", 20, 100), act("y3", "2025-12-31", 5, 30)], "total", "annee", today);
check("total par année : années vides incluses", year.map((b) => b.start).join() === "2024-01-01,2025-01-01,2026-01-01" && year[1].km === 25 && year[2].km === 0, year);
check("fin de période", year[0].end === "2024-12-31" && weeks[0].end === addDaysStr(from, 6));
function addDaysStr(d: string, n: number) {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

// ---------- Dénivelé et fréquence cardiaque ----------
const rich = bucketsOf(
  plan,
  [
    { ...act("r1", "2026-10-06", 10, 60), elevation: 100, avgHr: 150 },
    { ...act("r2", "2026-10-07", 5, 20), elevation: 40, avgHr: 170 },
    act("r3", "2026-10-08", 5, 30), // sans capteur ni dénivelé
  ],
  "programme", "semaine", today
).find((b) => b.start === "2026-10-05")!;
check("dénivelé cumulé", rich.elevation === 140, rich);
check("fréquence moyenne pondérée par la durée", Math.abs(rich.hr! - (150 * 60 + 170 * 20) / 80) < 1e-9, rich.hr);
const none = weeks.find((b) => b.start === "2026-10-12")!;
check("sans donnée : null et non zéro", none.elevation === null && none.hr === null);
const flat = bucketsOf(plan, [{ ...act("f1", "2026-10-06", 5, 30), elevation: 0 }], "programme", "semaine", today).find((b) => b.start === "2026-10-05")!;
check("dénivelé nul enregistré : zéro", flat.elevation === 0);
const mixedMonth = bucketsOf(plan, [{ ...act("m1", "2026-10-06", 5, 30), elevation: 20 }, { ...act("m2", "2026-10-20", 5, 30), elevation: 30 }], "total", "mois", today);
check("dénivelé par mois", mixedMonth[mixedMonth.length - 1].elevation === 50);

const ex = extrasOf([{ ...act("e1", "2026-10-06", 10, 60), elevation: 100, avgHr: 150 }, { ...act("e2", "2026-10-07", 5, 20), elevation: 40, avgHr: 170 }, act("e3", "2026-10-08", 5, 30)]);
check("totaux : dénivelé et fréquence moyenne", ex.elevation === 140 && Math.abs(ex.hr! - (150 * 60 + 170 * 20) / 80) < 1e-9, ex);
check("totaux sans donnée : null", extrasOf([act("n1", "2026-10-06", 5, 30)]).elevation === null && extrasOf([]).hr === null);

// ---------- Fenêtre ----------
check("fenêtre bornée", clampStart(30, 24, -3) === 0 && clampStart(30, 24, 99) === 6 && clampStart(10, 24, 5) === 0);
const long = bucketsOf(plan, [act("l1", "2025-01-06", 5, 30)], "total", "semaine", today);
check("total : fenêtre la plus récente", defaultStart(long, WINDOW_SIZE.semaine, "total") === long.length - 24);
check("programme : fenêtre autour de la semaine en cours", defaultStart(weeks, 6, "programme") === Math.max(0, weeks.findIndex((b) => b.current) - 3));
const notStarted = bucketsOf(plan, [], "programme", "semaine", "2026-08-01");
check("programme pas commencé : début", defaultStart(notStarted, 6, "programme") === 0);
const finished = bucketsOf(plan, [], "programme", "semaine", "2027-06-01");
check("programme terminé : fin", defaultStart(finished, 6, "programme") === finished.length - 6);
check("sélection : période en cours", defaultSelection(weeks) === weeks.findIndex((b) => b.current));
check("sélection : dernière période avec sortie", defaultSelection(finished.map((b, i) => ({ ...b, count: i === 3 ? 1 : 0 }))) === 3);
check("sélection : liste vide", defaultSelection([]) === 0);

// ---------- Graduations ----------
const t1 = niceTicks(37);
check("graduations rondes", t1.ticks[0] === 0 && t1.top >= 37 && t1.ticks.every((v) => Number.isInteger(v * 2)), t1);
check("graduations : dernier = sommet", niceTicks(37).ticks.at(-1) === niceTicks(37).top);
check("graduations : max nul", niceTicks(0).top >= 1 && niceTicks(0).ticks.length >= 2);
check("graduations : petites valeurs", niceTicks(0.8).top >= 0.8 && niceTicks(0.8).ticks.length <= 8);
check("graduations : grandes valeurs", niceTicks(1840).top >= 1840 && niceTicks(1840).ticks.length <= 8, niceTicks(1840));

console.log(failures === 0 ? "\nTout est bon." : `\n${failures} échec(s).`);
process.exit(failures === 0 ? 0 : 1);
