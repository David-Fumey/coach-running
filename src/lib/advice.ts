// Conseils nutritionnels selon l'apport recherché et la phase du plan. TypeScript pur.
// Repères généraux de nutrition sportive et de santé publique (ANSES, EFSA, ACSM, recommandations
// de nutrition sportive) : ils ne remplacent pas l'avis d'un professionnel de santé.

import type { Phase } from "./plan.ts";
import type { Profile } from "./nutrition.ts";

export type TopicId = "glucides" | "proteines" | "lipides" | "hydratation" | "fer" | "calcium" | "magnesium" | "cafeine";

export interface Topic {
  id: TopicId;
  /** Titre de la fiche */
  label: string;
  /** Ce que l'on cherche, en peu de mots (étiquette de filtre) */
  goal: string;
  why: string;
  /** Repères chiffrés, personnalisés avec le profil quand il existe */
  targets: (p: Profile | null) => string[];
  sources: string[];
  timing: string[];
  /** Points de vigilance : limites, quand consulter */
  watch: string[];
}

/** Arrondit à 5 près (g, mg) pour éviter une fausse précision. */
const r5 = (x: number) => Math.round(x / 5) * 5;
const r1 = (x: number) => Math.round(x);

export const TOPICS: Topic[] = [
  {
    id: "glucides",
    label: "Glucides",
    goal: "Énergie",
    why: "Ce sont ton carburant principal en course : les réserves du corps (glycogène) s'épuisent en 1 h 30 à 2 h d'effort soutenu. Des réserves pleines retardent le « mur » et aident à récupérer d'une séance à l'autre.",
    targets: (p) => [
      p
        ? `Au quotidien : de ${r5(4 * p.weightKg)} g (jour de repos) à ${r5(7 * p.weightKg)} g (sortie longue), soit 4 à 7 g par kg.`
        : "Au quotidien : 4 à 7 g par kg de poids, du jour de repos à la sortie longue.",
      p
        ? `La veille d'une course : 8 à 10 g par kg, soit ${r5(8 * p.weightKg)} à ${r5(10 * p.weightKg)} g.`
        : "La veille d'une course : 8 à 10 g par kg de poids.",
      "Pendant l'effort au-delà de 1 h 15 : 30 à 60 g par heure, jusqu'à 90 g par heure après 2 h 30 si ton ventre le supporte.",
    ],
    sources: ["Riz", "Pâtes", "Pain", "Pommes de terre", "Flocons d'avoine", "Banane", "Fruits secs", "Compote", "Miel"],
    timing: [
      "Avant une séance longue ou intense : un repas riche en glucides 2 à 3 h avant.",
      "Pendant : une gorgée de boisson sucrée, un gel ou un fruit sec toutes les 20 à 30 min.",
      "Après : des glucides dans l'heure qui suit, surtout si tu t'entraînes à nouveau dans les 24 h.",
    ],
    watch: [
      "Ne teste rien de nouveau le jour d'une course : répète ton ravitaillement à l'entraînement.",
      "Beaucoup de fibres juste avant l'effort peuvent gêner la digestion.",
    ],
  },
  {
    id: "proteines",
    label: "Protéines",
    goal: "Récupération",
    why: "Elles réparent et renforcent les muscles sollicités par la course. Ce qui compte, c'est le total sur la journée, réparti sur tous les repas.",
    targets: (p) => [
      p
        ? `Sur la journée : 1,2 à 2 g par kg, soit ${r5(1.2 * p.weightKg)} à ${r5(2 * p.weightKg)} g (tes objectifs nutrition visent ${r5(1.6 * p.weightKg)} g).`
        : "Sur la journée : 1,2 à 2 g par kg de poids.",
      p
        ? `Par repas, surtout après l'effort : 0,25 à 0,3 g par kg, soit ${r1(0.25 * p.weightKg)} à ${r1(0.3 * p.weightKg)} g.`
        : "Par repas, surtout après l'effort : 0,25 à 0,3 g par kg de poids (environ 20 à 25 g).",
    ],
    sources: ["Œufs", "Poisson", "Volaille", "Yaourt, fromage blanc", "Lait", "Lentilles, pois chiches", "Tofu", "Viande maigre"],
    timing: [
      "Répartis-les sur 3 à 4 prises dans la journée plutôt qu'en un seul gros repas.",
      "Après une séance dure : une portion de protéines avec des glucides dans l'heure.",
    ],
    watch: ["Au-delà de ces repères, plus de protéines n'apporte rien de plus.", "En cas de maladie des reins, demande l'avis de ton médecin avant d'augmenter."],
  },
  {
    id: "lipides",
    label: "Lipides",
    goal: "Énergie durable",
    why: "Ils fournissent de l'énergie pour les efforts faciles et longs, et apportent les vitamines A, D, E, K et les acides gras essentiels (oméga-3).",
    targets: (p) => [
      p
        ? `Au moins 0,8 g par kg, soit ${r5(0.8 * p.weightKg)} g par jour, ce qui représente environ 20 à 35 % de l'énergie.`
        : "Au moins 0,8 g par kg de poids par jour, soit environ 20 à 35 % de l'énergie.",
    ],
    sources: ["Huile d'olive, huile de colza", "Noix, amandes", "Poissons gras (sardine, maquereau, saumon)", "Avocat", "Graines de lin"],
    timing: ["Évite les repas très gras dans les 3 h avant une séance : la digestion est plus lente."],
    watch: ["Réduire trop les lipides pour « perdre du poids » peut fatiguer et dérégler les hormones, surtout chez les femmes."],
  },
  {
    id: "hydratation",
    label: "Hydratation",
    goal: "Hydratation",
    why: "Une perte d'eau importante fait monter le rythme cardiaque et baisser l'allure. À l'inverse, boire beaucoup trop est dangereux (hyponatrémie, un manque de sodium dans le sang).",
    targets: () => [
      "Au quotidien : bois régulièrement, avec des urines claires. Les repas et les aliments apportent aussi de l'eau.",
      "Pendant l'effort de plus d'une heure : 400 à 800 ml par heure selon la chaleur et ta transpiration.",
      "Au-delà d'1 heure, une boisson avec 0,5 à 0,7 g de sodium par litre aide à retenir l'eau et réduit le risque d'hyponatrémie.",
      "Après : environ 1,2 à 1,5 L par kg perdu à la pesée (pèse-toi avant et après une sortie longue pour estimer ta transpiration).",
    ],
    sources: ["Eau", "Boisson d'effort légèrement salée et sucrée", "Bouillon", "Fruits et légumes riches en eau"],
    timing: [
      "Avant : un grand verre d'eau 2 h avant, puis quelques gorgées juste avant le départ.",
      "Pendant une séance de moins d'une heure : bois à la soif.",
    ],
    watch: [
      "Ne force pas à boire sans soif lors d'un effort long : plus de boisson n'est pas mieux.",
      "Maux de tête, nausées, gonflement des doigts pendant ou après un effort long : arrête de boire de l'eau seule et demande conseil.",
    ],
  },
  {
    id: "fer",
    label: "Fer",
    goal: "Fatigue et endurance",
    why: "Il sert à transporter l'oxygène vers les muscles. Un manque donne une fatigue inhabituelle, des jambes lourdes et une baisse de performance. Les coureuses et les coureurs qui s'entraînent beaucoup en perdent davantage.",
    targets: (p) => [
      p?.sex === "m"
        ? "Repère pour un homme adulte : environ 11 mg par jour (ANSES)."
        : p?.sex === "f"
          ? "Repère pour une femme avant la ménopause : de 11 à 16 mg par jour selon l'importance des règles (ANSES)."
          : "Repère adulte : environ 11 mg par jour, jusqu'à 16 mg pour une femme avant la ménopause selon l'importance des règles (ANSES).",
    ],
    sources: ["Viande rouge", "Volaille (cuisses)", "Poisson et fruits de mer", "Lentilles, pois chiches, haricots", "Tofu", "Épinards et céréales complètes (moins bien absorbés)"],
    timing: [
      "Associe-le à de la vitamine C (agrumes, kiwi, poivron) : elle améliore l'absorption du fer végétal.",
      "Évite le thé et le café pendant le repas : ils réduisent l'absorption.",
    ],
    watch: [
      "Un complément n'est utile que si une prise de sang (ferritine) montre un manque : un excès de fer est nocif. Parles-en à ton médecin.",
      "Fatigue inhabituelle, essoufflement, froid permanent, jambes lourdes depuis des semaines : consulte avant de te supplémenter.",
      "Les régimes végétariens et les règles abondantes augmentent le risque.",
    ],
  },
  {
    id: "calcium",
    label: "Calcium et vitamine D",
    goal: "Os et fractures de fatigue",
    why: "Chaque foulée impose un choc aux os. Le calcium et la vitamine D les rendent plus résistants, ce qui compte à mesure que le volume augmente.",
    targets: () => [
      "Calcium : environ 950 mg par jour pour un adulte (ANSES), soit 3 à 4 portions de produits riches en calcium.",
      "Vitamine D : environ 15 µg par jour (ANSES), en comptant la synthèse par la peau au soleil.",
    ],
    sources: ["Yaourt, fromage, lait", "Eaux minérales riches en calcium", "Sardines en conserve (avec les arêtes)", "Brocoli, chou", "Amandes", "Poissons gras, œufs (vitamine D)"],
    timing: ["Répartis le calcium sur les repas : le corps en absorbe mieux de petites quantités à la fois.", "De novembre à mars, le soleil ne suffit généralement pas pour la vitamine D."],
    watch: [
      "Une douleur osseuse précise qui s'aggrave en courant peut être une fracture de fatigue : arrête de courir et consulte.",
      "Manger trop peu au regard de l'entraînement fragilise les os. Si tu perds du poids sans le vouloir ou que tes règles disparaissent, consulte.",
      "Un dosage de vitamine D et un éventuel complément se décident avec un médecin.",
    ],
  },
  {
    id: "magnesium",
    label: "Magnésium",
    goal: "Crampes et récupération",
    why: "Il intervient dans la contraction musculaire et la production d'énergie. On en perd un peu par la sueur, mais un déficit réel est moins fréquent qu'on ne le croit.",
    targets: (p) => [
      p?.sex === "m"
        ? "Repère pour un homme adulte : environ 420 mg par jour."
        : p?.sex === "f"
          ? "Repère pour une femme adulte : environ 360 mg par jour."
          : "Repère adulte : environ 360 mg par jour pour une femme, 420 mg pour un homme.",
    ],
    sources: ["Amandes, noix de cajou, noix", "Légumineuses", "Céréales complètes", "Chocolat noir", "Banane", "Eaux minérales riches en magnésium"],
    timing: ["Les repas variés suffisent en général : inutile de chercher un moment précis."],
    watch: [
      "Les crampes ont plusieurs causes (fatigue, chaleur, intensité, manque de sodium) : le magnésium n'est qu'une piste.",
      "Un complément à forte dose provoque souvent des troubles digestifs. Avec un problème rénal, demande l'avis d'un médecin.",
    ],
  },
  {
    id: "cafeine",
    label: "Caféine",
    goal: "Performance",
    why: "Une dose modérée avant l'effort peut diminuer la sensation d'effort et améliorer légèrement la performance sur les courses de 5 km au marathon.",
    targets: (p) => [
      p
        ? `Dose conseillée : environ 3 mg par kg, soit ${Math.round(Math.min(200, 3 * p.weightKg) / 10) * 10} mg, sans dépasser 200 mg en une prise (EFSA).`
        : "Dose conseillée : environ 3 mg par kg, sans dépasser 200 mg en une prise (EFSA).",
      "Total sur la journée, café et boissons compris : pas plus de 400 mg (EFSA), et 200 mg en cas de grossesse.",
      "Repère : un expresso contient environ 60 à 80 mg, une tasse de café filtre 90 à 100 mg, un gel caféiné 25 à 100 mg.",
    ],
    sources: ["Café", "Thé", "Gel ou boisson caféinée", "Cola"],
    timing: ["Prends-la 45 à 60 min avant le départ, ou en cours de course pour les efforts longs.", "Évite-en dans les 6 h avant de te coucher : le sommeil est ton meilleur allié de récupération."],
    watch: [
      "Teste-la à l'entraînement : palpitations, tremblements, nausées ou envies pressantes sont possibles.",
      "Si tu en bois déjà beaucoup chaque jour, l'effet avant la course sera moindre.",
      "Déconseillé en cas de problème cardiaque ou d'anxiété importante, et chez les moins de 18 ans au-delà de 3 mg par kg par jour.",
    ],
  },
];

export function topicById(id: TopicId): Topic {
  return TOPICS.find((t) => t.id === id)!;
}

export interface PhaseAdvice {
  title: string;
  intro: string;
  points: string[];
  /** Fiches à lire en priorité */
  topics: TopicId[];
}

const PHASE_ADVICE: Record<Phase, PhaseAdvice> = {
  base: {
    title: "Phase de base",
    intro: "Le volume est encore modeste : c'est le moment d'installer de bonnes habitudes.",
    points: [
      "Des repas réguliers, avec des glucides à chaque repas et des protéines à chaque repas.",
      "Évite de chercher à perdre du poids vite : tu t'entraînes pour progresser, pas pour te priver.",
      "Prends l'habitude de boire régulièrement dans la journée.",
    ],
    topics: ["glucides", "proteines", "hydratation"],
  },
  construction: {
    title: "Phase de construction",
    intro: "Le volume et l'intensité montent : tes besoins aussi.",
    points: [
      "Mange assez : un manque d'énergie se paie en fatigue et en blessures.",
      "Surveille les signes de manque de fer (fatigue inhabituelle, jambes lourdes).",
      "Soigne le repas et la collation après les séances intenses.",
    ],
    topics: ["glucides", "fer", "proteines"],
  },
  specifique: {
    title: "Phase spécifique",
    intro: "Les sorties longues sont l'occasion de répéter ta stratégie de course.",
    points: [
      "Teste pendant tes sorties longues les gels, boissons et horaires que tu utiliseras le jour J.",
      "Entraîne ton ventre : monte progressivement vers 60 g de glucides par heure si ta course dure plus de 2 h.",
      "Teste la caféine à l'entraînement si tu comptes en prendre en course.",
    ],
    topics: ["glucides", "hydratation", "cafeine"],
  },
  affutage: {
    title: "Phase d'affûtage",
    intro: "Le volume baisse : ne coupe pas les glucides, tu veux des réserves pleines.",
    points: [
      "Garde des repas habituels : pas de nouveautés, pas de régime.",
      "Les besoins totaux baissent un peu avec le volume, mais les glucides restent la priorité.",
      "Dors suffisamment et bois régulièrement.",
    ],
    topics: ["glucides", "hydratation"],
  },
  course: {
    title: "Semaine de course",
    intro: "Rien de nouveau : tu t'appuies sur ce que tu as testé.",
    points: [
      "La veille : repas riche en glucides, pauvre en fibres et en graisses, et une bonne hydratation.",
      "Le matin : petit-déjeuner connu 2 à 3 h avant le départ.",
      "En course : bois et mange à chaque ravitaillement prévu, sans attendre d'avoir faim ou soif.",
    ],
    topics: ["glucides", "hydratation", "cafeine"],
  },
};

const RECOVERY_NOTE = "Semaine allégée : ne réduis pas les protéines ni le sommeil, c'est maintenant que le corps assimile le travail des semaines précédentes.";

export function phaseAdvice(phase: Phase, isRecovery: boolean): PhaseAdvice {
  const base = PHASE_ADVICE[phase];
  return isRecovery ? { ...base, points: [RECOVERY_NOTE, ...base.points] } : base;
}

export const SOURCES_NOTE =
  "Repères inspirés de l'ANSES (références nutritionnelles pour la population), de l'EFSA (avis sur la caféine, 2015), de l'ACSM (hydratation) et des recommandations de nutrition sportive. Ils concernent un adulte en bonne santé et ne remplacent pas l'avis d'un médecin ou d'un diététicien-nutritionniste du sport.";
