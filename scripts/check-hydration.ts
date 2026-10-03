import type { Activity } from "../src/lib/activities.ts";
import type { Profile } from "../src/lib/nutrition.ts";
import {
  CONDITIONS, DEFAULT_BASE_ML, calibration, conditionsFromTemp, hydrationTargetFromLoss, measuredLossMl, sweatRate, validateWeighing, weighingRatio, type Weighing, QUICK_AMOUNTS, baseMl, duringRange, hydrationTarget, lastActivity, progressOf, replaceRange, sweatLoss, totalMl, validAmount,
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

// ---------- Température ----------
check("conditions d'après la température", conditionsFromTemp(5) === "fraiche" && conditionsFromTemp(11.9) === "fraiche" && conditionsFromTemp(12) === "temperee" && conditionsFromTemp(22) === "temperee" && conditionsFromTemp(22.1) === "chaude" && conditionsFromTemp(35) === "chaude");
check("température inconnue : pas de conditions", conditionsFromTemp(null) === null && conditionsFromTemp(undefined) === null && conditionsFromTemp(NaN) === null);
check("ajustement personnel appliqué à l'estimation", sweatLoss(10, 70, "temperee", 1.2).ml === 920 && sweatLoss(10, 70, "temperee", 0.5).ml === 390, [sweatLoss(10, 70, "temperee", 1.2).ml, sweatLoss(10, 70, "temperee", 0.5).ml]);
check("ajustement personnel dans l'objectif du jour", hydrationTarget(prof(70), 10, 1.2).training === 920 && hydrationTarget(prof(70), 10, 1.2).total === 3000);
check("objectif d'après une perte connue", hydrationTargetFromLoss(prof(70), 1000).total === 3100 && hydrationTargetFromLoss(null, 0).total === DEFAULT_BASE_ML);

// ---------- Pesées ----------
const wg = (extra: Partial<Weighing> = {}): Weighing => ({ id: "p", date: "2026-10-01", km: 10, minutes: 60, before: 70, after: 69.3, drankMl: 200, conditions: "temperee", ...extra });
check("perte mesurée = masse perdue + boisson", measuredLossMl(wg()) === 900, measuredLossMl(wg()));
check("taux de transpiration en ml/h", sweatRate(wg()) === 900 && sweatRate(wg({ minutes: 45 })) === 1200);
check("rapport mesure / modèle", near(weighingRatio(wg()), 900 / 770, 1e-6), weighingRatio(wg()));
check("le rapport neutralise les conditions de la sortie", near(weighingRatio(wg({ conditions: "chaude" })), 900 / (770 * 1.35), 1e-6));
check("pesée valide", validateWeighing(wg()) === null);
check("pesées invalides", [
  wg({ before: 20 }), wg({ after: 250 }), wg({ drankMl: -5 }), wg({ drankMl: 9000 }), wg({ minutes: 10 }), wg({ km: 0 }),
  wg({ before: 80, after: 70 }), wg({ after: 70, drankMl: 0 }), wg({ before: 70, after: 69.99, drankMl: 0 }), wg({ minutes: 20, before: 70, after: 65 }),
  wg({ before: NaN }),
].every((w) => validateWeighing(w) !== null));
check("durée minimale pour mesurer", validateWeighing(wg({ minutes: 20 })) === null && validateWeighing(wg({ minutes: 19 })) !== null);
check("sans pesée : pas d'ajustement", calibration([]) === null);
const one = calibration([wg({ drankMl: 200 })])!;
check("une pesée : un tiers de l'écart seulement", one.count === 1 && near(one.trust, 1 / 3, 1e-9) && near(one.factor, 1 + (900 / 770 - 1) / 3, 1e-3), one);
const three = calibration([wg(), wg({ id: "q" }), wg({ id: "r" })])!;
check("trois pesées : écart appliqué en entier", three.trust === 1 && near(three.factor, 900 / 770, 1e-3), three);
const robust = calibration([wg(), wg({ id: "q" }), wg({ id: "r" }), wg({ id: "s", drankMl: 2500 })])!;
check("la médiane résiste à une pesée aberrante", near(robust.factor, 900 / 770, 1e-3) || robust.factor < 2, robust);
const low = calibration([wg({ before: 70, after: 69.8, drankMl: 0, id: "a" }), wg({ before: 70, after: 69.8, drankMl: 0, id: "b" }), wg({ before: 70, after: 69.8, drankMl: 0, id: "c" })])!;
check("peu de transpiration : facteur inférieur à 1, plancher à 0,5", low.factor < 1 && low.factor >= 0.5, low);
const huge = calibration([wg({ before: 70, after: 68, drankMl: 1000, id: "a", km: 5 }), wg({ before: 70, after: 68, drankMl: 1000, id: "b", km: 5 }), wg({ before: 70, after: 68, drankMl: 1000, id: "c", km: 5 })])!;
check("facteur plafonné à 2", huge.factor === 2, huge);
check("taux moyen, arrondi à 10", calibration([wg({ id: "a" }), wg({ id: "b", minutes: 45 })])!.ratePerHour === 1050);
check("pesées invalides écartées du calcul", calibration([wg({ minutes: 5 })]) === null);

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
