import { SOURCES_NOTE, TOPICS, phaseAdvice, topicById, type TopicId } from "../src/lib/advice.ts";
import type { Phase } from "../src/lib/plan.ts";
import type { Profile } from "../src/lib/nutrition.ts";

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (!ok) {
    failures++;
    console.log("ECHEC", name, detail ?? "");
  } else console.log("ok   ", name);
}

const man: Profile = { sex: "m", age: 30, weightKg: 70, heightCm: 175, goal: "maintenir" };
const woman: Profile = { sex: "f", age: 30, weightKg: 58, heightCm: 168, goal: "maintenir" };
const text = (id: TopicId, p: Profile | null) => topicById(id).targets(p).join(" | ");

// Structure
const ids = TOPICS.map((t) => t.id);
check("identifiants uniques", new Set(ids).size === ids.length);
check(
  "chaque fiche est complète",
  TOPICS.every((t) => t.label && t.goal && t.why && t.targets(null).length > 0 && t.sources.length > 0 && t.timing.length > 0 && t.watch.length > 0),
);
check(
  "aucune valeur manquante dans les textes",
  TOPICS.every((t) =>
    [t.why, ...t.targets(null), ...t.targets(man), ...t.targets(woman), ...t.timing, ...t.watch].every((s) => !/NaN|undefined|null/.test(s)),
  ),
);

// Personnalisation
check("glucides : repère personnalisé (70 kg)", text("glucides", man).includes("280 g") && text("glucides", man).includes("490 g"), text("glucides", man));
check("glucides : veille de course (70 kg)", text("glucides", man).includes("560 à 700 g"), text("glucides", man));
check("glucides : repère générique sans profil", text("glucides", null).includes("4 à 7 g par kg"));
check("protéines : par repas (70 kg)", text("proteines", man).includes("18 à 21 g"), text("proteines", man));
check("protéines : journée (70 kg)", text("proteines", man).includes("85 à 140 g") && text("proteines", man).includes("110 g"), text("proteines", man));
check("lipides : minimum (70 kg)", text("lipides", man).includes("55 g"), text("lipides", man));

// Caféine : 3 mg/kg, plafonnée à 200 mg en une prise
check("caféine : 3 mg/kg (58 kg → 170 mg)", text("cafeine", woman).includes("170 mg"), text("cafeine", woman));
check("caféine : plafond de 200 mg (70 kg → 200 mg, pas 210)", text("cafeine", man).includes("200 mg") && !text("cafeine", man).includes("210 mg"), text("cafeine", man));
check("caféine : plafond de 200 mg même à 100 kg", text("cafeine", { ...man, weightKg: 100 }).includes("environ 3 mg par kg, soit 200 mg"));
check("caféine : plafond journalier de 400 mg", text("cafeine", null).includes("400 mg"));

// Fer et magnésium selon le sexe
check("fer : homme", text("fer", man).includes("11 mg") && !text("fer", man).includes("16 mg"));
check("fer : femme", text("fer", woman).includes("11 à 16 mg"));
check("fer : sans profil", text("fer", null).includes("16 mg"));
check("magnésium : selon le sexe", text("magnesium", man).includes("420 mg") && text("magnesium", woman).includes("360 mg"));

// Sécurité : mises en garde indispensables
const watch = (id: TopicId) => topicById(id).watch.join(" ");
check("fer : complément seulement après prise de sang", /prise de sang/.test(watch("fer")));
check("hydratation : risque de boire trop", /hyponatr/i.test(topicById("hydratation").why) && /ne force pas/i.test(watch("hydratation")));
check("caféine : à tester à l'entraînement", /entraînement/.test(watch("cafeine")));
check("calcium : fracture de fatigue → consulter", /consulte/.test(watch("calcium")));

// Phases du plan
const phases: Phase[] = ["base", "construction", "specifique", "affutage", "course"];
check(
  "chaque phase a des conseils et des fiches valides",
  phases.every((ph) => {
    const a = phaseAdvice(ph, false);
    return a.title && a.intro && a.points.length >= 3 && a.topics.length > 0 && a.topics.every((id) => ids.includes(id));
  }),
);
check("semaine de récupération : note ajoutée en tête", phaseAdvice("base", true).points.length === phaseAdvice("base", false).points.length + 1 && /allégée/.test(phaseAdvice("base", true).points[0]));
check("la phase spécifique parle de répéter la stratégie de course", phaseAdvice("specifique", false).points.some((p) => /jour J/.test(p)));
check("note de sources et avertissement", /ne remplacent pas/.test(SOURCES_NOTE));

process.exit(failures ? 1 : 0);
