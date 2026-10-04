import { generatePlan } from "../src/lib/plan.ts";
import {
  addActivity,
  groupByMonth,
  parseMinutes,
  removeActivity,
  summarize,
  updateActivity,
  weeklyTotals,
  type Activity,
  type Tracked,
} from "../src/lib/activities.ts";

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (!ok) {
    failures++;
    console.log("ECHEC", name, detail ?? "");
  } else console.log("ok   ", name);
}
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

// parseMinutes
check("45 → 45", parseMinutes("45") === 45);
check("42:30 → 42,5", parseMinutes("42:30") === 42.5);
check("1:05:30 → 65,5", parseMinutes("1:05:30") === 65.5);
check("45,5 (virgule)", parseMinutes("45,5") === 45.5);
check("texte invalide", parseMinutes("abc") === null && parseMinutes("") === null && parseMinutes("1::2") === null && parseMinutes("1:2:3:4") === null);

// Plan : lundi 2026-10-05 pour une date du jour au samedi 2026-10-03.
const plan = generatePlan({
  race: "semi", raceDate: "2027-02-14", level: "intermediaire", daysPerWeek: 4,
  currentWeeklyKm: 25, longDay: "dim", today: "2026-10-03",
});
const [s1, s2] = plan.weeks[0].sessions;
const act = (id: string, date: string, km: number, minutes: number, sessionId?: string): Activity => ({ id, date, km, minutes, sessionId });

let state: Tracked = { activities: [], done: {} };

// Ajout lié → séance faite ; sortie libre → done inchangé
state = addActivity(state, act("a1", s1.date, 8, 48, s1.id));
state = addActivity(state, act("a2", s2.date, 10, 60));
check("ajout lié marque la séance", state.done[s1.id] === true && Object.keys(state.done).length === 1);

// Modification sans changer de séance
state = updateActivity(state, act("a1", s1.date, 9, 50, s1.id));
check("modif km/durée", state.activities.find((a) => a.id === "a1")?.km === 9 && state.done[s1.id] === true);

// Changer la séance liée : l'ancienne est libérée, la nouvelle cochée
state = updateActivity(state, act("a1", s1.date, 9, 50, s2.id));
check("changement de séance", !state.done[s1.id] && state.done[s2.id] === true, state.done);

// Délier : la séance n'est plus faite
state = updateActivity(state, act("a1", s1.date, 9, 50));
check("délier libère la séance", !state.done[s2.id], state.done);

// Deux activités sur la même séance : on garde la séance faite tant qu'il en reste une
state = updateActivity(state, act("a1", s1.date, 9, 50, s1.id));
state = addActivity(state, act("a3", s1.date, 3, 20, s1.id));
state = removeActivity(state, "a3");
check("suppression avec autre activité liée", state.done[s1.id] === true);
state = removeActivity(state, "a1");
check("suppression de la dernière activité liée", !state.done[s1.id] && state.activities.length === 1);
check("id inconnu ignoré", removeActivity(state, "zzz") === state && updateActivity(state, act("zzz", s1.date, 1, 1)) === state);

// Résumé et totaux hebdomadaires
const sample = [act("x", plan.weeks[0].startDate, 10, 50), act("y", plan.weeks[1].startDate, 5, 30)];
const sum = summarize(plan, sample, {}, "2026-10-03");
check("résumé", sum.count === 2 && sum.km === 15 && sum.minutes === 80 && near(sum.avgPace!, 80 / 15) && sum.longestKm === 10, sum);
check("régularité nulle sans séance échue", sum.adherence === null);
const later = plan.weeks[1].startDate;
const sumLater = summarize(plan, [], { [s1.id]: true }, later);
check("régularité = faites / échues", sumLater.adherence !== null && sumLater.adherence > 0 && sumLater.adherence < 1, sumLater);
check("résumé vide", summarize(plan, [], {}, "2026-10-03").avgPace === null);
const totals = weeklyTotals(plan, [...sample, act("z", plan.weeks[0].startDate, 2, 12)]);
check("totaux par semaine", totals[0].actualKm === 12 && totals[1].actualKm === 5 && totals[2].actualKm === 0 && totals[0].plannedKm === plan.weeks[0].totalKm, totals.slice(0, 3));

// ---------- Regroupement par mois ----------
const months = groupByMonth([act("a", "2026-09-30", 5, 30), act("b", "2026-10-02", 10, 60), act("c", "2026-09-01", 8, 48), act("d", "2026-10-02", 3, 20), act("e", "2025-12-31", 6, 40)]);
check("mois du plus récent au plus ancien", months.map((m) => m.month).join() === "2026-10,2026-09,2025-12", months.map((m) => m.month));
check("totaux d'un mois", months[0].activities.length === 2 && months[0].km === 13 && months[0].minutes === 80, months[0]);
check("activités d'un mois triées du plus récent au plus ancien", months[1].activities.map((a) => a.id).join() === "a,c", months[1].activities.map((a) => a.id));
check("l'année est distinguée", months[2].month === "2025-12" && months[2].km === 6);
check("aucune activité, aucun mois", groupByMonth([]).length === 0);
check("le regroupement ne modifie pas la liste d'origine", (() => { const l = [act("x", "2026-01-01", 1, 1), act("y", "2026-02-01", 1, 1)]; groupByMonth(l); return l[0].id === "x"; })());
check("total de kilomètres arrondi", groupByMonth([act("p", "2026-03-01", 0.1, 1), act("q", "2026-03-02", 0.2, 1)])[0].km === 0.3);

process.exit(failures ? 1 : 0);
