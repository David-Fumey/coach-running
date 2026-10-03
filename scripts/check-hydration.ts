import type { Activity } from "../src/lib/activities.ts";
import type { Profile } from "../src/lib/nutrition.ts";
import {
  CONDITIONS, DEFAULT_BASE_ML, QUICK_AMOUNTS, baseMl, duringRange, hydrationTarget, lastActivity, progressOf, replaceRange, sweatLoss, totalMl, validAmount,
} from "../src/lib/hydration.ts";

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (!ok) {
    failures++;
    console.log("ECHEC", name, detail ?? "");
  } else console.log("ok   ", name);
}
const near = (a: number, b: number, eps = 1e-9) => Math.abs(a - b) <= eps;

const prof = (weightKg: number): Profile => ({ sex: "m", age: 30, weightKg, heightCm: 178, goal: "maintenir" });

// ---------- Besoin de base ----------
check("base : 30 ml par kg, arrondi à 50", baseMl(prof(70)) === 2100 && baseMl(prof(62)) === 1850, [baseMl(prof(70)), baseMl(prof(62))]);
check("base : bornée entre 1,5 et 3,5 L", baseMl(prof(40)) === 1500 && baseMl(prof(150)) === 3500);
check("base sans profil : repère moyen", baseMl(null) === DEFAULT_BASE_ML);

// ---------- Eau perdue ----------
const s = sweatLoss(10, 70);
check("10 km à 70 kg, tempéré : environ 770 ml", s.ml === 770, s);
check("fourchette de ±25 %", s.low === 580 && s.high === 960, s);
check("part du poids du corps", near(s.percentOfBody, 1.1), s.percentOfBody);
check("plus de chaleur, plus de transpiration", sweatLoss(10, 70, "chaude").ml > s.ml && sweatLoss(10, 70, "fraiche").ml < s.ml && CONDITIONS.chaude.factor > CONDITIONS.temperee.factor);
check("chaud : 35 % de plus", sweatLoss(10, 70, "chaude").ml === 1040, sweatLoss(10, 70, "chaude"));
check("proportionnel à la distance et au poids", sweatLoss(20, 70).ml === 2 * 770 && sweatLoss(10, 140).ml === 2 * 770);
check("sortie nulle : aucune perte", sweatLoss(0, 70).ml === 0);
check("ordre low ≤ ml ≤ high", [0.5, 5, 12, 21, 42].every((km) => { const e = sweatLoss(km, 65); return e.low <= e.ml && e.ml <= e.high; }));
check("un semi fait dépasser 2 % du poids en chaleur", sweatLoss(21, 60, "chaude").percentOfBody > 2, sweatLoss(21, 60, "chaude"));

// ---------- À boire ----------
check("après : 120 à 150 % de la perte", (() => { const r = replaceRange(800); return r.low === 950 && r.high === 1200; })(), replaceRange(800));
check("pendant : rien de systématique avant 1 h", duringRange(45) === null && duringRange(59) === null);
check("pendant : 400 à 800 ml par heure", (() => { const r = duringRange(90)!; return r.low === 600 && r.high === 1200; })(), duringRange(90));
check("pendant : une heure pile", duringRange(60)!.low === 400 && duringRange(60)!.high === 800);

// ---------- Besoin du jour ----------
const t0 = hydrationTarget(prof(70), 0);
check("jour de repos : la base seule", t0.base === 2100 && t0.training === 0 && t0.total === 2100);
const t10 = hydrationTarget(prof(70), 10);
check("jour de sortie : base + eau perdue, arrondi à 50", t10.training === 770 && t10.total === 2850, t10);
check("sans profil : poids de 70 kg supposé", hydrationTarget(null, 10).training === 770 && hydrationTarget(null, 0).total === DEFAULT_BASE_ML);
check("la perte compense la séance : plus de km, plus à boire", hydrationTarget(prof(70), 20).total > t10.total);

// ---------- Suivi ----------
const entries = [
  { id: "a", date: "2026-10-05", ml: 250 }, { id: "b", date: "2026-10-05", ml: 500 }, { id: "c", date: "2026-10-06", ml: 330 },
];
check("total du jour", totalMl(entries, "2026-10-05") === 750 && totalMl(entries, "2026-10-06") === 330 && totalMl(entries, "2026-10-07") === 0);
check("état de la journée", progressOf(0, 2000) === "debut" && progressOf(400, 2000) === "debut" && progressOf(700, 2000) === "en-route" && progressOf(1500, 2000) === "presque" && progressOf(2000, 2000) === "atteint" && progressOf(3000, 2000) === "atteint" && progressOf(3100, 2000) === "large");
check("cible nulle : début", progressOf(500, 0) === "debut");
check("contenants usuels croissants", QUICK_AMOUNTS.every((q, i) => i === 0 || q.ml > QUICK_AMOUNTS[i - 1].ml) && QUICK_AMOUNTS.length >= 4);

const acts: Activity[] = [
  { id: "x1", date: "2026-10-01", km: 5, minutes: 30 },
  { id: "x3", date: "2026-10-03", km: 8, minutes: 48 },
  { id: "x2", date: "2026-10-03", km: 6, minutes: 36 },
  { id: "fut", date: "2026-10-09", km: 12, minutes: 70 },
];
check("dernière sortie : la plus récente, départagée par identifiant", lastActivity(acts, "2026-10-05")?.id === "x3");
check("une sortie future est ignorée", lastActivity(acts, "2026-10-02")?.id === "x1");
check("aucune sortie", lastActivity([], "2026-10-05") === null && lastActivity(acts, "2026-09-01") === null);

// ---------- Validation ----------
check("quantité valide", validAmount(250) && validAmount(10) && validAmount(3000));
check("quantité invalide", !validAmount(0) && !validAmount(5) && !validAmount(3001) && !validAmount(-200) && !validAmount(NaN) && !validAmount("250") && !validAmount(undefined));

console.log(failures === 0 ? "\nTout est bon." : `\n${failures} échec(s).`);
process.exit(failures === 0 ? 0 : 1);
