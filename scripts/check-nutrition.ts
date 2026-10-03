import { generatePlan } from "../src/lib/plan.ts";
import { bmr, dayTarget, duringAdvice, recentFoods, totalsOf, validateProfile, type Food, type Profile } from "../src/lib/nutrition.ts";

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (!ok) {
    failures++;
    console.log("ECHEC", name, detail ?? "");
  } else console.log("ok   ", name);
}

const me: Profile = { sex: "m", age: 30, weightKg: 70, heightCm: 175, goal: "maintenir" };
check("BMR homme (Mifflin-St Jeor)", bmr(me) === 10 * 70 + 6.25 * 175 - 150 + 5, bmr(me));
check("BMR femme", bmr({ ...me, sex: "f" }) === bmr(me) - 166);

const plan = generatePlan({
  race: "marathon", raceDate: "2027-04-11", level: "intermediaire", daysPerWeek: 4,
  currentWeeklyKm: 30, longDay: "dim", today: "2026-10-03",
});
const sessions = plan.weeks.flatMap((w) => w.sessions);
const first = (type: string) => sessions.find((s) => s.type === type)!;
const today = "2026-10-03";
const at = (date: string, p = me, acts = [], done = {}) => dayTarget(plan, p, acts, done, date, today);

// Jour de repos : aucune séance
const restDate = "2026-10-05"; // lundi, la 1re séance est le mardi
check("lundi sans séance = repos", !sessions.some((s) => s.date === restDate) && at(restDate).kind === "repos");

const easy = at(first("easy").date);
const long = at(first("long").date);
const quality = at(first("quality").date);
const rest = at(restDate);
check("types de journée", easy.kind === "facile" && long.kind === "long" && quality.kind === "intense");
check("glucides croissent avec la charge", rest.carbs < easy.carbs && easy.carbs < quality.carbs && quality.carbs < long.carbs, [rest.carbs, easy.carbs, quality.carbs, long.carbs]);
check("énergie : sortie longue > repos", long.kcal > rest.kcal + long.km * 70 * 0.5);
check("protéines 1,6 g/kg", rest.protein === Math.round(1.6 * 70));
check("lipides au moins 0,8 g/kg", [rest, easy, quality, long].every((d) => d.fat >= 0.8 * 70 - 1));
check("kcal = 4G + 4P + 9L (à l'arrondi près)", [rest, long].every((d) => Math.abs(d.kcal - (4 * d.carbs + 4 * d.protein + 9 * d.fat)) <= 12));

// Veille et jour de course
const race = sessions.find((s) => s.type === "race")!;
const eve = at("2027-04-10");
const raceDay = at(race.date);
check("veille de marathon : 10 g/kg", eve.eve && eve.carbs === 700, eve.carbs);
check("jour de course", raceDay.kind === "course" && raceDay.km === race.km);

// Objectifs de poids
const lose = { ...me, goal: "perdre" as const };
const gain = { ...me, goal: "prendre" as const };
check("perdre : moins de kcal un jour de repos", at(restDate, lose).kcal <= at(restDate).kcal);
check("perdre : pas de déficit avant une sortie longue", at(long.date, lose).kcal === long.kcal);
check("perdre : pas de déficit la veille de course", at("2027-04-10", lose).kcal === eve.kcal);
check("prendre : plus de kcal", at(restDate, gain).kcal >= at(restDate).kcal);

// Jours passés et activités réelles
const pastToday = "2026-10-20";
const pastEasy = first("easy").date;
const missed = dayTarget(plan, me, [], {}, pastEasy, pastToday);
check("séance passée non faite = repos", missed.kind === "repos" && missed.km === 0);
const doneNoAct = dayTarget(plan, me, [], { [first("easy").id]: true }, pastEasy, pastToday);
check("séance passée cochée = distance prévue", doneNoAct.km === first("easy").km);
const withAct = dayTarget(plan, me, [{ id: "a", date: pastEasy, km: 12, minutes: 70 }], {}, pastEasy, pastToday);
check("activité réelle prime", withAct.km === 12 && withAct.runKcal === 12 * 70);
const free = dayTarget(plan, me, [{ id: "b", date: restDate, km: 6, minutes: 36 }], {}, restDate, today);
check("sortie libre un jour sans séance = facile", free.kind === "facile" && free.km === 6);

// Pendant l'effort
check("sortie courte : pas de conseil", duringAdvice(10, 6) === undefined);
check("1 h 30 : 30 à 60 g/h", duringAdvice(15, 6)?.carbsPerHour === "30 à 60 g");
check("3 h : 60 à 90 g/h", duringAdvice(30, 6)?.carbsPerHour === "60 à 90 g");

// Journal
const foods: Food[] = [
  { id: "1", date: "2026-10-01", label: "Pâtes", kcal: 600, carbs: 100, protein: 20, fat: 8 },
  { id: "2", date: "2026-10-02", label: "Banane", kcal: 100 },
  { id: "3", date: "2026-10-03", label: "pâtes ", kcal: 650, carbs: 110 },
];
const t = totalsOf(foods);
check("totaux du journal (macros facultatives)", t.kcal === 1350 && t.carbs === 210 && t.protein === 20 && t.fat === 8, t);
const recents = recentFoods(foods);
check("aliments récents sans doublon, récents d'abord", recents.length === 2 && recents[0].id === "3" && recents[1].label === "Banane", recents);

// Profil
check("profil valide", validateProfile(me) === null);
check("profil invalide", validateProfile({ ...me, age: 10 }) !== null && validateProfile({ ...me, weightKg: NaN }) !== null && validateProfile({ ...me, heightCm: 300 }) !== null);

process.exit(failures ? 1 : 0);
