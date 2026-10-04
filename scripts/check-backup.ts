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
  water: [{ id: "w1", date: "2026-10-05", ml: 250 }, { id: "w2", date: "2026-10-05", ml: 500 }],
  tests: [{ id: "t1", date: "2026-10-05", minutes: 24.5, sessionId: "s-2026-10-05" }],
  sweat: [{ id: "p1", date: "2026-10-05", km: 10, minutes: 60, before: 70, after: 69.3, drankMl: 200, conditions: "temperee" }],
};
const text = makeBackup(full, new Date("2026-10-05T10:00:00Z"));

const back = parseBackup(text);
check("aller-retour identique", back.ok && isDeepStrictEqual(back.data, full));
check("sauvegarde vide", parseBackup(makeBackup(EMPTY_SNAPSHOT, new Date())).ok);
check("nom de fichier", backupFileName("2026-10-05") === "runner-2026-10-05.json");

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
check("hydratation invalide", err(mutate((o) => (o.data.water[0].ml = 0))) !== null && err(mutate((o) => (o.data.water[0].ml = 9000))) !== null && err(mutate((o) => (o.data.water[0].date = "hier"))) !== null && err(mutate((o) => (o.data.water = "beaucoup"))) !== null);
check("hydratation absente : liste vide", (() => {
  const r = parseBackup(mutate((o) => delete o.data.water));
  return r.ok && r.data.water.length === 0;
})());
check("pesée invalide", err(mutate((o) => (o.data.sweat[0].after = 99))) !== null && err(mutate((o) => (o.data.sweat[0].conditions = "tropicale"))) !== null && err(mutate((o) => (o.data.sweat[0].minutes = 5))) !== null && err(mutate((o) => (o.data.sweat = "x"))) !== null);
check("pesées absentes : liste vide", (() => {
  const r = parseBackup(mutate((o) => delete o.data.sweat));
  return r.ok && r.data.sweat.length === 0;
})());
check("température d'activité", (() => {
  const t = (v: unknown) => parseBackup(mutate((o) => (o.data.activities[0].temp = v))).ok;
  return t(21.5) && t(null) && t(-8) && !t("chaud") && !t(120);
})());
check("séances validées invalides", err(mutate((o) => (o.data.done = { x: "oui" }))) !== null);
check("sans plan, jamais confirmé", (() => {
  const r = parseBackup(mutate((o) => ((o.data.plan = null), (o.data.confirmed = true))));
  return r.ok && r.data.confirmed === false;
})());

process.exit(failures ? 1 : 0);
