import { RACE_KM, assessGoal, goalPace, parseGoalTime, predictMinutes, validGoal, vdotFromRace } from "../src/lib/goal.ts";

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (!ok) {
    failures++;
    console.log("ECHEC", name, detail ?? "");
  } else console.log("ok   ", name);
}
const near = (a: number, b: number, eps: number) => Math.abs(a - b) <= eps;

// ---------- Saisie ----------
check("5 km : mm:ss", parseGoalTime("24:30", "5k") === 24.5);
check("10 km : mm:ss", parseGoalTime("45:00", "10k") === 45);
check("h:mm:ss pour toutes les courses", parseGoalTime("1:45:30", "semi") === 105.5 && parseGoalTime("1:45:30", "10k") === 105.5);
check("semi : « 1:45 » veut dire 1 h 45", parseGoalTime("1:45", "semi") === 105);
check("marathon : « 3:30 » veut dire 3 h 30", parseGoalTime("3:30", "marathon") === 210);
check("10 km : « 1:45 » reste 1 min 45 s (refusé plus loin par la plausibilité)", near(parseGoalTime("1:45", "10k")!, 1.75, 1e-9));
check("espaces tolérés", parseGoalTime(" 24 : 30 ", "5k") === 24.5);
check("saisies invalides", ["", "abc", "24", "1:75", "24:60", "1:2:3:4", "1::3", "-5:00", "24:30.5", "100:00"].every((s) => parseGoalTime(s, "5k") === null), ["", "abc", "24", "1:75", "24:60", "1:2:3:4", "1::3", "-5:00", "24:30.5", "100:00"].map((s) => parseGoalTime(s, "5k")));

// ---------- Plausibilité ----------
check("objectif plausible", validGoal({ race: "10k", minutes: 45 }) && validGoal({ race: "marathon", minutes: 210 }) && validGoal({ race: "5k", minutes: 24.5 }));
check("trop rapide ou trop lent", !validGoal({ race: "10k", minutes: 20 }) && !validGoal({ race: "5k", minutes: 1.75 }) && !validGoal({ race: "10k", minutes: 130 }));
check("objectif mal formé", !validGoal(null) && !validGoal(undefined) && !validGoal({ race: "ultra", minutes: 100 }) && !validGoal({ race: "10k", minutes: NaN }) && !validGoal({ race: "10k", minutes: "45" }) && !validGoal({ minutes: 45 }));
check("allure requise", near(goalPace({ race: "10k", minutes: 50 }), 5, 1e-9) && near(goalPace({ race: "marathon", minutes: 210 }), 210 / 42.195, 1e-9));

// ---------- Niveau et prédictions (tables de Daniels, niveau 50) ----------
check("niveau déduit d'un 5 km en 19:57", near(vdotFromRace(5, 19 + 57 / 60), 50, 0.7), vdotFromRace(5, 19.95));
check("niveau déduit d'un 10 km en 41:21", near(vdotFromRace(10, 41 + 21 / 60), 50, 0.7), vdotFromRace(10, 41.35));
check("niveau déduit d'un semi en 1:31:35", near(vdotFromRace(RACE_KM.semi, 91 + 35 / 60), 50, 0.9), vdotFromRace(RACE_KM.semi, 91.58));
check("niveau déduit d'un marathon en 3:10:49", near(vdotFromRace(RACE_KM.marathon, 190 + 49 / 60), 50, 1.2), vdotFromRace(RACE_KM.marathon, 190.8));
check("prédiction 5 km au niveau 50", near(predictMinutes(50, 5), 19.95, 0.4), predictMinutes(50, 5));
check("prédiction 10 km au niveau 50", near(predictMinutes(50, 10), 41.35, 0.8), predictMinutes(50, 10));
check("prédiction semi au niveau 50", near(predictMinutes(50, RACE_KM.semi), 91.6, 2), predictMinutes(50, RACE_KM.semi));
check("prédiction marathon au niveau 50", near(predictMinutes(50, RACE_KM.marathon), 190.8, 4), predictMinutes(50, RACE_KM.marathon));
check("aller-retour niveau / temps", [30, 45, 60, 75].every((v) => near(vdotFromRace(10, predictMinutes(v, 10)), v, 1e-6)));
check("meilleur niveau, temps plus court", predictMinutes(55, 10) < predictMinutes(50, 10) && predictMinutes(50, 10) < predictMinutes(45, 10));
check("plus long, plus lent par km", predictMinutes(50, 42.195) / 42.195 > predictMinutes(50, 10) / 10);

// ---------- Ambition ----------
const base = predictMinutes(50, 10);
const rate = (minutes: number) => assessGoal({ race: "10k", minutes }, 50);
check("objectif proche de l'estimation : réaliste", rate(base * 0.99).ambition === "realiste" && rate(base * 1.01).ambition === "realiste");
check("objectif plus lent : prudent", rate(base * 1.08).ambition === "prudent");
check("objectif nettement plus rapide : ambitieux", rate(base * 0.9).ambition === "ambitieux");
check("objectif très rapide : très ambitieux", rate(base * 0.8).ambition === "tres-ambitieux");
check("écart signé et estimation fournie", near(rate(base * 0.9).gap, -0.1, 1e-9) && near(rate(base * 0.9).predicted, base, 1e-9) && rate(base * 1.08).gap > 0);

console.log(failures === 0 ? "\nTout est bon." : `\n${failures} échec(s).`);
process.exit(failures === 0 ? 0 : 1);
