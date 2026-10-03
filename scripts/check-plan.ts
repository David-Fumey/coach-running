import { generatePlan } from "../src/lib/plan.ts";

const base = { today: "2026-10-03", currentWeeklyKm: 25, longDay: "dim" as const };
const cases = [
  { race: "semi" as const, raceDate: "2027-02-14", level: "intermediaire" as const, daysPerWeek: 4 as const },
  { race: "marathon" as const, raceDate: "2027-04-11", level: "intermediaire" as const, daysPerWeek: 5 as const },
  { race: "10k" as const, raceDate: "2026-11-15", level: "debutant" as const, daysPerWeek: 3 as const },
  { race: "5k" as const, raceDate: "2026-10-04", level: "avance" as const, daysPerWeek: 6 as const },
];

let failures = 0;
for (const c of cases) {
  const plan = generatePlan({ ...base, ...c });
  const last = plan.weeks[plan.weeks.length - 1];
  const ids = plan.weeks.flatMap((w) => w.sessions.map((s) => s.id));
  const unique = new Set(ids).size === ids.length;
  const endsWithRace = last.sessions[last.sessions.length - 1].type === "race" && last.sessions[last.sessions.length - 1].date === c.raceDate;
  const bad = plan.weeks.some((w) => !Number.isFinite(w.totalKm) || w.sessions.some((s) => !Number.isFinite(s.km) || s.km <= 0));
  console.log(`\n== ${c.race} ${c.level} ${c.daysPerWeek} j/sem -> ${c.raceDate} : ${plan.weeks.length} semaines`);
  console.log("km/sem :", plan.weeks.map((w) => w.totalKm).join(" "));
  console.log("phases :", plan.weeks.map((w) => w.phase[0] + (w.isRecovery ? "r" : "")).join(""));
  if (plan.warnings.length) console.log("alertes:", plan.warnings.length);
  if (!unique || !endsWithRace || bad) { failures++; console.log("ECHEC", { unique, endsWithRace, bad }); }
}

const p = generatePlan({ ...base, ...cases[0] });
console.log("\nSemaine 6 :");
for (const s of p.weeks[5].sessions) console.log(s.date, s.type, s.km, "-", s.title, "|", s.details);
console.log("\nSemaine de course :");
for (const s of p.weeks[p.weeks.length - 1].sessions) console.log(s.date, s.type, s.km, "-", s.title);
process.exit(failures ? 1 : 0);
