import { isDeepStrictEqual } from "node:util";
import { generatePlan } from "../src/lib/plan.ts";
import { EMPTY_SNAPSHOT, backupFileName, makeBackup, parseBackup, type Snapshot } from "../src/lib/backup.ts";

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
const sid = plan.weeks[0].sessions[0].id;
const full: Snapshot = {
  plan,
  done: { [sid]: true },
  activities: [{ id: "a1", date: "2026-10-05", km: 6.5, minutes: 40, sessionId: sid, feeling: 4, note: "ok" }],
  confirmed: true,
  profile: { name: "Alex", sex: "f", age: 31, weightKg: 58.5, heightCm: 168, goal: "maintenir" },
  foods: [{ id: "f1", date: "2026-10-05", label: "Riz", kcal: 300, carbs: 60 }],
  paceRef: 6.25,
  goal: { race: "10k", minutes: 47.5 },
};
const text = makeBackup(full, new Date("2026-10-05T10:00:00Z"));

const back = parseBackup(text);
check("aller-retour identique", back.ok && isDeepStrictEqual(back.data, full));
check("sauvegarde vide", parseBackup(makeBackup(EMPTY_SNAPSHOT, new Date())).ok);
check("nom de fichier", backupFileName("2026-10-05") === "foulee-2026-10-05.json");

const err = (t: string) => {
  const r = parseBackup(t);
  return r.ok ? null : r.error;
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mutate = (fn: (d: any) => void) => {
  const obj = JSON.parse(text);
  fn(obj);
  return JSON.stringify(obj);
};

check("pas du JSON", err("pas du json") !== null);
check("JSON étranger", err('{"hello":1}') !== null && err("[]") !== null && err("null") !== null);
check("version future refusée", err(mutate((o) => (o.version = 99))) !== null);
check("clés absentes = valeurs par défaut", (() => {
  const r = parseBackup(JSON.stringify({ app: "foulee", version: 1, data: {} }));
  return r.ok && r.data.plan === null && r.data.activities.length === 0 && r.data.profile === null;
})());
check("plan invalide", err(mutate((o) => (o.data.plan.weeks = "x"))) !== null && err(mutate((o) => (o.data.plan.weeks[0].sessions[0].km = "5"))) !== null);
check("activité invalide", err(mutate((o) => (o.data.activities[0].km = -2))) !== null && err(mutate((o) => (o.data.activities[0].date = "hier"))) !== null && err(mutate((o) => (o.data.activities[0].feeling = 9))) !== null);
check("aliment invalide", err(mutate((o) => (o.data.foods[0].kcal = "beaucoup"))) !== null && err(mutate((o) => (o.data.foods[0].carbs = -1))) !== null);
check("profil invalide", err(mutate((o) => (o.data.profile.weightKg = 5))) !== null && err(mutate((o) => (o.data.profile.goal = "x"))) !== null && err(mutate((o) => (o.data.profile.sex = "z"))) !== null);
check("allure moyenne invalide", err(mutate((o) => (o.data.paceRef = 1))) !== null && err(mutate((o) => (o.data.paceRef = "6:00"))) !== null && err(mutate((o) => (o.data.paceRef = 40))) !== null);
check("allure moyenne absente : null", (() => {
  const r = parseBackup(mutate((o) => delete o.data.paceRef));
  return r.ok && r.data.paceRef === null;
})());
check("temps objectif invalide", err(mutate((o) => (o.data.goal = { race: "10k", minutes: 5 }))) !== null && err(mutate((o) => (o.data.goal = { race: "ultra", minutes: 50 }))) !== null && err(mutate((o) => (o.data.goal = "47:30"))) !== null);
check("temps objectif absent : null", (() => {
  const r = parseBackup(mutate((o) => delete o.data.goal));
  return r.ok && r.data.goal === null;
})());
check("séances validées invalides", err(mutate((o) => (o.data.done = { x: "oui" }))) !== null);
check("sans plan, jamais confirmé", (() => {
  const r = parseBackup(mutate((o) => ((o.data.plan = null), (o.data.confirmed = true))));
  return r.ok && r.data.confirmed === false;
})());

process.exit(failures ? 1 : 0);
