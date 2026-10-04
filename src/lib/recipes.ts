// Recettes conseillées selon des critères modifiables. TypeScript pur.
// Les valeurs nutritionnelles et les régimes (végétarien, sans gluten...) sont CALCULÉS à partir des
// ingrédients, pour rester cohérents : ce sont des estimations (tables de composition usuelles).

import type { DayKind } from "./nutrition.ts";

// ---------- Aliments (pour 100 g ou 100 ml) ----------

interface Food100 {
  name: string;
  kcal: number;
  carbs: number;
  protein: number;
  fat: number;
  fiber: number;
  /** mg */
  iron: number;
  /** mg */
  calcium: number;
  meat?: boolean;
  fish?: boolean;
  egg?: boolean;
  dairy?: boolean;
  /** Produit animal sans être de la viande, du poisson, un œuf ni un laitage (le miel) */
  animal?: boolean;
  /** Contient du gluten (l'avoine est comptée : elle est souvent contaminée) */
  gluten?: boolean;
  /** Fruits à coque et arachide */
  nuts?: boolean;
  liquid?: boolean;
  /** Unité d'usage : « 2 œufs », « 1 c. à soupe » */
  unit?: { singular: string; plural: string; grams: number };
}

export const FOODS = {
  riz: { name: "Riz cuit", kcal: 130, carbs: 28, protein: 2.7, fat: 0.3, fiber: 0.4, iron: 0.2, calcium: 10 },
  pates: { name: "Pâtes cuites", kcal: 158, carbs: 31, protein: 5.8, fat: 0.9, fiber: 1.8, iron: 0.5, calcium: 7, gluten: true },
  flocons: { name: "Flocons d'avoine", kcal: 370, carbs: 60, protein: 13, fat: 7, fiber: 10, iron: 4, calcium: 50, gluten: true },
  pain_blanc: {
    name: "Pain blanc", kcal: 270, carbs: 55, protein: 9, fat: 1.5, fiber: 2.5, iron: 1.2, calcium: 20, gluten: true,
    unit: { singular: "tranche", plural: "tranches", grams: 40 },
  },
  pain_complet: {
    name: "Pain complet", kcal: 240, carbs: 42, protein: 9, fat: 2.5, fiber: 6.5, iron: 2.5, calcium: 40, gluten: true,
    unit: { singular: "tranche", plural: "tranches", grams: 40 },
  },
  farine: { name: "Farine de blé", kcal: 350, carbs: 73, protein: 10, fat: 1, fiber: 3, iron: 1.2, calcium: 15, gluten: true },
  pdt: { name: "Pommes de terre cuites", kcal: 85, carbs: 19, protein: 2, fat: 0.1, fiber: 1.8, iron: 0.8, calcium: 8 },
  patate_douce: { name: "Patate douce cuite", kcal: 90, carbs: 20, protein: 1.6, fat: 0.1, fiber: 3, iron: 0.7, calcium: 30 },
  quinoa: { name: "Quinoa cuit", kcal: 120, carbs: 21, protein: 4.4, fat: 1.9, fiber: 2.8, iron: 1.5, calcium: 17 },
  lentilles: { name: "Lentilles cuites", kcal: 115, carbs: 17, protein: 9, fat: 0.5, fiber: 8, iron: 3.3, calcium: 20 },
  pois_chiches: { name: "Pois chiches cuits", kcal: 140, carbs: 20, protein: 8.5, fat: 2.6, fiber: 7, iron: 2.5, calcium: 50 },
  haricots_rouges: { name: "Haricots rouges cuits", kcal: 110, carbs: 17, protein: 8, fat: 0.5, fiber: 6.5, iron: 2.5, calcium: 30 },
  oeuf: {
    name: "Œuf", kcal: 143, carbs: 0.7, protein: 12.5, fat: 9.5, fiber: 0, iron: 1.8, calcium: 55, egg: true,
    unit: { singular: "œuf", plural: "œufs", grams: 55 },
  },
  poulet: { name: "Blanc de poulet cuit", kcal: 165, carbs: 0, protein: 31, fat: 3.6, fiber: 0, iron: 0.7, calcium: 12, meat: true },
  thon: { name: "Thon au naturel", kcal: 110, carbs: 0, protein: 25, fat: 1, fiber: 0, iron: 1.2, calcium: 15, fish: true },
  saumon: { name: "Saumon cuit", kcal: 200, carbs: 0, protein: 22, fat: 12, fiber: 0, iron: 0.5, calcium: 15, fish: true },
  sardines: { name: "Sardines en conserve", kcal: 210, carbs: 0, protein: 24, fat: 12, fiber: 0, iron: 2.5, calcium: 380, fish: true },
  boeuf: { name: "Bœuf haché 5 %, cuit", kcal: 170, carbs: 0, protein: 27, fat: 6.5, fiber: 0, iron: 2.7, calcium: 15, meat: true },
  jambon: { name: "Jambon blanc", kcal: 110, carbs: 0.5, protein: 20, fat: 3, fiber: 0, iron: 0.8, calcium: 8, meat: true },
  tofu: { name: "Tofu ferme", kcal: 125, carbs: 2, protein: 13, fat: 7, fiber: 1.2, iron: 2.4, calcium: 300 },
  yaourt: {
    name: "Yaourt nature", kcal: 55, carbs: 4.5, protein: 4, fat: 1.5, fiber: 0, iron: 0.1, calcium: 150, dairy: true,
    unit: { singular: "pot", plural: "pots", grams: 125 },
  },
  fromage_blanc: { name: "Fromage blanc 0 %", kcal: 45, carbs: 4, protein: 8, fat: 0.2, fiber: 0, iron: 0.1, calcium: 110, dairy: true },
  lait: { name: "Lait demi-écrémé", kcal: 46, carbs: 4.8, protein: 3.3, fat: 1.6, fiber: 0, iron: 0, calcium: 120, dairy: true, liquid: true },
  soja: { name: "Boisson soja enrichie en calcium", kcal: 40, carbs: 2.5, protein: 3.5, fat: 1.9, fiber: 0.5, iron: 0.4, calcium: 120, liquid: true },
  banane: {
    name: "Banane", kcal: 90, carbs: 20, protein: 1.1, fat: 0.3, fiber: 2.5, iron: 0.3, calcium: 6,
    unit: { singular: "banane", plural: "bananes", grams: 100 },
  },
  fruits_rouges: { name: "Fruits rouges", kcal: 45, carbs: 8, protein: 0.8, fat: 0.3, fiber: 4, iron: 0.7, calcium: 20 },
  compote: { name: "Compote sans sucre ajouté", kcal: 45, carbs: 10, protein: 0.3, fat: 0.1, fiber: 1.5, iron: 0.2, calcium: 4 },
  miel: {
    name: "Miel", kcal: 320, carbs: 80, protein: 0.4, fat: 0, fiber: 0, iron: 0.4, calcium: 5, animal: true,
    unit: { singular: "c. à café", plural: "c. à café", grams: 7 },
  },
  raisins_secs: { name: "Raisins secs", kcal: 300, carbs: 70, protein: 3, fat: 0.5, fiber: 4, iron: 2, calcium: 60 },
  dattes: {
    name: "Dattes", kcal: 280, carbs: 65, protein: 2.5, fat: 0.4, fiber: 7, iron: 1, calcium: 40,
    unit: { singular: "datte", plural: "dattes", grams: 20 },
  },
  amandes: { name: "Amandes", kcal: 600, carbs: 6, protein: 21, fat: 52, fiber: 12, iron: 3.7, calcium: 260, nuts: true },
  beurre_cacahuete: {
    name: "Beurre de cacahuète", kcal: 600, carbs: 12, protein: 25, fat: 50, fiber: 6, iron: 1.9, calcium: 40, nuts: true,
    unit: { singular: "c. à soupe", plural: "c. à soupe", grams: 15 },
  },
  huile: {
    name: "Huile d'olive", kcal: 900, carbs: 0, protein: 0, fat: 100, fiber: 0, iron: 0, calcium: 0,
    unit: { singular: "c. à soupe", plural: "c. à soupe", grams: 10 },
  },
  epinards: { name: "Épinards cuits", kcal: 25, carbs: 1, protein: 3, fat: 0.4, fiber: 2.5, iron: 2.7, calcium: 130 },
  brocoli: { name: "Brocoli cuit", kcal: 30, carbs: 3, protein: 3, fat: 0.4, fiber: 3, iron: 0.7, calcium: 40 },
  carotte: { name: "Carottes cuites", kcal: 30, carbs: 6, protein: 0.6, fat: 0.2, fiber: 3, iron: 0.3, calcium: 30 },
  tomate: { name: "Tomates", kcal: 20, carbs: 3, protein: 0.9, fat: 0.2, fiber: 1.2, iron: 0.3, calcium: 10 },
  courgette: { name: "Courgette cuite", kcal: 17, carbs: 2.5, protein: 1.2, fat: 0.3, fiber: 1.1, iron: 0.4, calcium: 15 },
  poivron: { name: "Poivron", kcal: 28, carbs: 5, protein: 1, fat: 0.3, fiber: 2, iron: 0.4, calcium: 10 },
  avocat: { name: "Avocat", kcal: 160, carbs: 2, protein: 2, fat: 15, fiber: 6.7, iron: 0.6, calcium: 12 },
  sauce_tomate: { name: "Sauce tomate", kcal: 35, carbs: 6, protein: 1.5, fat: 0.5, fiber: 1.5, iron: 0.8, calcium: 20 },
  graines_courge: { name: "Graines de courge", kcal: 560, carbs: 15, protein: 30, fat: 46, fiber: 6, iron: 8, calcium: 40 },
} satisfies Record<string, Food100>;

export type FoodId = keyof typeof FOODS;

const food = (id: FoodId): Food100 => FOODS[id];

// ---------- Recettes ----------

export type Moment = "petit-dej" | "avant" | "pendant" | "apres" | "repas";
export type MomentFilter = Moment | "veille" | "tous";

export const MOMENT_LABEL: Record<MomentFilter, string> = {
  tous: "Tous",
  "petit-dej": "Petit-déjeuner",
  avant: "Avant l'effort",
  pendant: "Pendant l'effort",
  apres: "Après l'effort",
  repas: "Repas complet",
  veille: "Veille de course",
};

export interface Recipe {
  id: string;
  name: string;
  moments: Moment[];
  /** Préparation + cuisson, en minutes */
  minutes: number;
  /** Quantités pour UNE portion, en g (ou ml) */
  ingredients: { food: FoodId; grams: number }[];
  steps: string[];
  /** Pourquoi cette recette aide un coureur */
  note: string;
}

export const RECIPES: Recipe[] = [
  {
    id: "porridge-banane-miel",
    name: "Porridge banane-miel",
    moments: ["petit-dej", "avant"],
    minutes: 8,
    ingredients: [
      { food: "flocons", grams: 60 },
      { food: "lait", grams: 200 },
      { food: "banane", grams: 100 },
      { food: "miel", grams: 7 },
    ],
    steps: [
      "Chauffe le lait dans une casserole.",
      "Ajoute les flocons et cuis 5 minutes en remuant, jusqu'à obtenir une texture crémeuse.",
      "Verse dans un bol, ajoute la banane en rondelles et le miel.",
    ],
    note: "Des glucides à libération progressive : idéal 2 à 3 h avant une sortie.",
  },
  {
    id: "porridge-soja-fruits-rouges",
    name: "Porridge soja et fruits rouges",
    moments: ["petit-dej", "avant"],
    minutes: 8,
    ingredients: [
      { food: "flocons", grams: 60 },
      { food: "soja", grams: 250 },
      { food: "fruits_rouges", grams: 80 },
      { food: "graines_courge", grams: 10 },
    ],
    steps: [
      "Chauffe la boisson au soja dans une casserole.",
      "Ajoute les flocons et cuis 5 minutes en remuant.",
      "Garnis avec les fruits rouges (frais ou décongelés) et les graines de courge.",
    ],
    note: "Version végétale : le soja enrichi apporte du calcium, les graines un peu de fer.",
  },
  {
    id: "riz-au-lait-soja-banane",
    name: "Riz au lait de soja et banane",
    moments: ["petit-dej", "avant"],
    minutes: 10,
    ingredients: [
      { food: "riz", grams: 200 },
      { food: "soja", grams: 200 },
      { food: "banane", grams: 100 },
      { food: "dattes", grams: 20 },
    ],
    steps: [
      "Réchauffe le riz déjà cuit avec la boisson au soja, 5 minutes à feu doux, en remuant.",
      "Verse dans un bol et ajoute la banane en rondelles et la datte coupée en petits morceaux.",
    ],
    note: "Sans gluten, sans lactose et végétal : une bonne façon de réutiliser le riz de la veille.",
  },
  {
    id: "yaourt-banane-dattes",
    name: "Yaourt, banane et dattes",
    moments: ["petit-dej", "avant", "apres"],
    minutes: 5,
    ingredients: [
      { food: "yaourt", grams: 250 },
      { food: "banane", grams: 100 },
      { food: "dattes", grams: 40 },
    ],
    steps: ["Verse les yaourts dans un bol.", "Ajoute la banane en rondelles et les dattes coupées en morceaux."],
    note: "Sans gluten, sans cuisson, avec des glucides rapides et des protéines.",
  },
  {
    id: "pancakes-banane",
    name: "Pancakes banane-œuf",
    moments: ["petit-dej", "apres"],
    minutes: 15,
    ingredients: [
      { food: "farine", grams: 60 },
      { food: "oeuf", grams: 55 },
      { food: "banane", grams: 100 },
      { food: "lait", grams: 100 },
    ],
    steps: [
      "Écrase la banane à la fourchette, mélange-la à l'œuf et au lait.",
      "Incorpore la farine et mélange sans excès.",
      "Fais cuire de petites louches dans une poêle antiadhésive, 2 minutes de chaque côté.",
    ],
    note: "Glucides et protéines dans la même assiette : bon pour la récupération du dimanche matin.",
  },
  {
    id: "tartines-banane-miel",
    name: "Tartines banane-miel",
    moments: ["avant", "petit-dej"],
    minutes: 5,
    ingredients: [
      { food: "pain_blanc", grams: 80 },
      { food: "banane", grams: 100 },
      { food: "miel", grams: 14 },
    ],
    steps: ["Grille légèrement le pain.", "Écrase la banane dessus et ajoute le miel."],
    note: "Rapide et facile à digérer, parfait environ 1 h avant de partir.",
  },
  {
    id: "tartine-cacahuete-banane",
    name: "Tartine cacahuète-banane",
    moments: ["avant", "petit-dej"],
    minutes: 5,
    ingredients: [
      { food: "pain_blanc", grams: 80 },
      { food: "beurre_cacahuete", grams: 15 },
      { food: "banane", grams: 100 },
    ],
    steps: ["Tartine le pain de beurre de cacahuète.", "Dispose la banane en rondelles par-dessus."],
    note: "Un peu de graisses et de protéines pour tenir une sortie plus longue.",
  },
  {
    id: "barres-flocons-banane",
    name: "Barres moelleuses flocons-banane",
    moments: ["pendant", "avant"],
    minutes: 25,
    ingredients: [
      { food: "flocons", grams: 60 },
      { food: "banane", grams: 100 },
      { food: "raisins_secs", grams: 20 },
      { food: "compote", grams: 40 },
    ],
    steps: [
      "Préchauffe le four à 180 °C.",
      "Écrase la banane, mélange-la à la compote, aux flocons et aux raisins secs.",
      "Étale en couche de 1,5 cm sur une plaque et cuis 15 minutes. Découpe en barres une fois refroidi.",
    ],
    note: "À emporter pendant les sorties longues : des glucides faciles à mâcher.",
  },
  {
    id: "boules-dattes-amandes",
    name: "Boules d'énergie dattes-amandes",
    moments: ["pendant"],
    minutes: 10,
    ingredients: [
      { food: "dattes", grams: 80 },
      { food: "amandes", grams: 25 },
    ],
    steps: [
      "Dénoyaute les dattes et mixe-les avec les amandes jusqu'à obtenir une pâte.",
      "Forme 6 petites boules avec les mains légèrement humides.",
      "Conserve-les au frais, à emporter dans une poche pendant l'effort.",
    ],
    note: "Sans cuisson, sans gluten et sans lactose : des glucides rapides pour les sorties de plus d'une heure et quart.",
  },
  {
    id: "riz-poulet-brocoli",
    name: "Riz, poulet et brocoli",
    moments: ["repas", "apres"],
    minutes: 25,
    ingredients: [
      { food: "riz", grams: 250 },
      { food: "poulet", grams: 120 },
      { food: "brocoli", grams: 100 },
      { food: "huile", grams: 10 },
    ],
    steps: [
      "Cuis le riz selon le temps indiqué sur le paquet et garde-le au chaud.",
      "Fais dorer le poulet coupé en dés dans l'huile, 6 à 8 minutes.",
      "Cuis le brocoli 5 minutes à la vapeur, puis assemble le tout.",
    ],
    note: "Le classique de récupération : glucides, protéines maigres et légumes.",
  },
  {
    id: "pates-thon-tomate",
    name: "Pâtes thon-tomate",
    moments: ["repas"],
    minutes: 20,
    ingredients: [
      { food: "pates", grams: 300 },
      { food: "thon", grams: 80 },
      { food: "sauce_tomate", grams: 100 },
      { food: "huile", grams: 10 },
    ],
    steps: [
      "Fais cuire les pâtes.",
      "Réchauffe la sauce tomate avec l'huile et le thon émietté.",
      "Mélange avec les pâtes égouttées.",
    ],
    note: "Facile et peu coûteux : une base de dîner la veille d'une grosse séance.",
  },
  {
    id: "pates-jambon-tomate",
    name: "Pâtes tomate-jambon",
    moments: ["repas"],
    minutes: 20,
    ingredients: [
      { food: "pates", grams: 350 },
      { food: "sauce_tomate", grams: 120 },
      { food: "jambon", grams: 60 },
      { food: "huile", grams: 10 },
    ],
    steps: [
      "Fais cuire les pâtes (blanches : elles sont plus digestes que les complètes la veille d'une course).",
      "Réchauffe la sauce tomate avec le jambon coupé en dés.",
      "Mélange avec les pâtes et l'huile d'olive.",
    ],
    note: "Beaucoup de glucides, peu de fibres et de graisses : le repas type de la veille d'une course.",
  },
  {
    id: "riz-oeufs-carottes",
    name: "Riz, œufs et carottes",
    moments: ["repas"],
    minutes: 20,
    ingredients: [
      { food: "riz", grams: 300 },
      { food: "oeuf", grams: 110 },
      { food: "carotte", grams: 80 },
      { food: "huile", grams: 10 },
    ],
    steps: [
      "Cuis le riz et les carottes en rondelles fines.",
      "Fais cuire les œufs brouillés ou au plat dans l'huile.",
      "Sers sur le riz avec les carottes.",
    ],
    note: "Sans gluten et très digeste : une option pour la veille d'une course.",
  },
  {
    id: "curry-pois-chiches-epinards",
    name: "Curry pois chiches-épinards",
    moments: ["repas", "apres"],
    minutes: 25,
    ingredients: [
      { food: "pois_chiches", grams: 200 },
      { food: "epinards", grams: 150 },
      { food: "sauce_tomate", grams: 100 },
      { food: "riz", grams: 200 },
      { food: "huile", grams: 10 },
    ],
    steps: [
      "Fais chauffer l'huile avec une cuillère à café de curry.",
      "Ajoute la sauce tomate, les pois chiches égouttés et les épinards, et laisse mijoter 10 minutes.",
      "Sers sur le riz cuit.",
    ],
    note: "Végétal et riche en fer. Un peu de citron ou de jus d'orange améliore l'absorption du fer.",
  },
  {
    id: "dahl-lentilles",
    name: "Dahl de lentilles",
    moments: ["repas", "apres"],
    minutes: 30,
    ingredients: [
      { food: "lentilles", grams: 200 },
      { food: "riz", grams: 200 },
      { food: "sauce_tomate", grams: 80 },
      { food: "epinards", grams: 80 },
      { food: "huile", grams: 10 },
    ],
    steps: [
      "Fais revenir des épices (curcuma, cumin) dans l'huile.",
      "Ajoute les lentilles cuites, la sauce tomate et les épinards, et laisse mijoter 15 minutes.",
      "Sers avec le riz.",
    ],
    note: "Riche en fer et en protéines végétales, pour les semaines de gros volume.",
  },
  {
    id: "chili-patate-douce",
    name: "Chili sin carne à la patate douce",
    moments: ["repas", "apres"],
    minutes: 30,
    ingredients: [
      { food: "haricots_rouges", grams: 180 },
      { food: "patate_douce", grams: 200 },
      { food: "sauce_tomate", grams: 120 },
      { food: "poivron", grams: 80 },
      { food: "huile", grams: 10 },
    ],
    steps: [
      "Coupe la patate douce et le poivron en dés et fais-les revenir dans l'huile.",
      "Ajoute la sauce tomate, les haricots rouges et un peu de piment.",
      "Laisse mijoter 20 minutes à couvert.",
    ],
    note: "Complet et réconfortant, avec des glucides lents et des protéines végétales.",
  },
  {
    id: "saumon-pommes-de-terre",
    name: "Saumon, pommes de terre et brocoli",
    moments: ["apres", "repas"],
    minutes: 30,
    ingredients: [
      { food: "saumon", grams: 120 },
      { food: "pdt", grams: 300 },
      { food: "brocoli", grams: 120 },
      { food: "huile", grams: 10 },
    ],
    steps: [
      "Cuis les pommes de terre en morceaux à l'eau ou à la vapeur, 20 minutes.",
      "Fais cuire le saumon 4 minutes de chaque côté dans l'huile.",
      "Ajoute le brocoli vapeur pendant les 5 dernières minutes.",
    ],
    note: "Des oméga-3 pour limiter l'inflammation, des protéines et des glucides pour récupérer.",
  },
  {
    id: "boeuf-patate-douce-courgette",
    name: "Bœuf, patate douce et courgette",
    moments: ["repas", "apres"],
    minutes: 25,
    ingredients: [
      { food: "boeuf", grams: 120 },
      { food: "patate_douce", grams: 250 },
      { food: "courgette", grams: 150 },
      { food: "huile", grams: 10 },
    ],
    steps: [
      "Cuis la patate douce en cubes 15 minutes à la vapeur ou au four.",
      "Fais revenir la courgette en rondelles et le bœuf haché dans l'huile.",
      "Assemble dans une assiette.",
    ],
    note: "Une bonne source de fer héminique, le mieux absorbé.",
  },
  {
    id: "bowl-quinoa-avocat-oeuf",
    name: "Bowl quinoa, avocat et œuf",
    moments: ["repas"],
    minutes: 20,
    ingredients: [
      { food: "quinoa", grams: 200 },
      { food: "oeuf", grams: 110 },
      { food: "avocat", grams: 60 },
      { food: "tomate", grams: 100 },
    ],
    steps: [
      "Cuis le quinoa et les œufs durs (9 minutes dans l'eau bouillante).",
      "Coupe l'avocat et les tomates en dés.",
      "Dispose dans un bol avec un filet de citron.",
    ],
    note: "Végétarien, sans gluten, avec des protéines complètes et de bonnes graisses.",
  },
  {
    id: "tofu-riz-legumes",
    name: "Tofu sauté, riz et légumes",
    moments: ["repas", "apres"],
    minutes: 25,
    ingredients: [
      { food: "tofu", grams: 140 },
      { food: "riz", grams: 280 },
      { food: "poivron", grams: 100 },
      { food: "brocoli", grams: 100 },
      { food: "huile", grams: 10 },
    ],
    steps: [
      "Cuis le riz.",
      "Fais dorer le tofu en cubes dans l'huile, 6 minutes.",
      "Ajoute le poivron et le brocoli en morceaux et cuis 5 minutes. Sers sur le riz.",
    ],
    note: "Végétal, riche en calcium grâce au tofu, et assez léger la veille d'une course.",
  },
  {
    id: "fromage-blanc-fruits-flocons",
    name: "Fromage blanc, fruits rouges et flocons",
    moments: ["apres", "petit-dej"],
    minutes: 5,
    ingredients: [
      { food: "fromage_blanc", grams: 200 },
      { food: "fruits_rouges", grams: 100 },
      { food: "flocons", grams: 30 },
      { food: "miel", grams: 14 },
    ],
    steps: ["Verse le fromage blanc dans un bol.", "Ajoute les fruits rouges, les flocons et le miel."],
    note: "Une collation de récupération rapide, riche en protéines et en calcium.",
  },
  {
    id: "smoothie-banane-lait",
    name: "Smoothie banane-lait-flocons",
    moments: ["apres", "avant"],
    minutes: 5,
    ingredients: [
      { food: "lait", grams: 250 },
      { food: "banane", grams: 100 },
      { food: "flocons", grams: 30 },
      { food: "miel", grams: 7 },
    ],
    steps: ["Mets tous les ingrédients dans un blender.", "Mixe 1 minute, bois frais."],
    note: "Se boit même quand on n'a pas faim après une séance difficile.",
  },
  {
    id: "smoothie-soja-banane",
    name: "Smoothie soja-banane-dattes",
    moments: ["apres", "avant"],
    minutes: 5,
    ingredients: [
      { food: "soja", grams: 250 },
      { food: "banane", grams: 100 },
      { food: "flocons", grams: 30 },
      { food: "dattes", grams: 20 },
    ],
    steps: ["Dénoyaute la datte et mets tout dans un blender.", "Mixe 1 minute, bois frais."],
    note: "Version végétale du smoothie de récupération.",
  },
  {
    id: "sandwich-poulet",
    name: "Sandwich poulet-crudités",
    moments: ["avant", "repas"],
    minutes: 10,
    ingredients: [
      { food: "pain_blanc", grams: 120 },
      { food: "poulet", grams: 80 },
      { food: "tomate", grams: 60 },
      { food: "carotte", grams: 40 },
    ],
    steps: ["Coupe le poulet en lamelles.", "Garnis le pain avec le poulet, la tomate et la carotte râpée."],
    note: "Facile à emporter, peu gras : bon deux heures avant une sortie.",
  },
  {
    id: "omelette-pommes-de-terre",
    name: "Omelette aux pommes de terre",
    moments: ["repas"],
    minutes: 25,
    ingredients: [
      { food: "oeuf", grams: 165 },
      { food: "pdt", grams: 250 },
      { food: "tomate", grams: 100 },
      { food: "huile", grams: 10 },
    ],
    steps: [
      "Fais revenir les pommes de terre cuites en rondelles dans l'huile.",
      "Verse les œufs battus et cuis à feu doux 6 minutes.",
      "Sers avec la tomate en salade.",
    ],
    note: "Végétarien, sans gluten et sans lactose, avec des protéines et des glucides.",
  },
  {
    id: "tartines-sardines",
    name: "Tartines sardines-tomate",
    moments: ["repas"],
    minutes: 10,
    ingredients: [
      { food: "pain_complet", grams: 80 },
      { food: "sardines", grams: 90 },
      { food: "tomate", grams: 100 },
      { food: "huile", grams: 10 },
    ],
    steps: ["Grille le pain.", "Écrase légèrement les sardines (avec leurs arêtes, source de calcium) sur le pain.", "Ajoute la tomate en tranches et un filet d'huile."],
    note: "Une source de calcium, d'oméga-3 et de fer, prête en 10 minutes.",
  },
  {
    id: "pates-saumon-epinards",
    name: "Pâtes au saumon et aux épinards",
    moments: ["apres", "repas"],
    minutes: 20,
    ingredients: [
      { food: "pates", grams: 300 },
      { food: "saumon", grams: 100 },
      { food: "epinards", grams: 100 },
      { food: "huile", grams: 10 },
    ],
    steps: [
      "Fais cuire les pâtes.",
      "Fais chauffer l'huile, ajoute le saumon émietté et les épinards, et laisse 4 minutes.",
      "Mélange avec les pâtes.",
    ],
    note: "Glucides et protéines pour recharger après une séance longue.",
  },
];

// ---------- Calculs ----------

export interface RecipeNutrition {
  kcal: number;
  carbs: number;
  protein: number;
  fat: number;
  fiber: number;
  iron: number;
  calcium: number;
}

const round1 = (x: number) => Math.round(x * 10) / 10;

/** Valeurs nutritionnelles pour `portions` portions (non arrondies pour kcal et macros : arrondi à l'affichage). */
export function nutritionOf(recipe: Recipe, portions = 1): RecipeNutrition {
  const sum = { kcal: 0, carbs: 0, protein: 0, fat: 0, fiber: 0, iron: 0, calcium: 0 };
  for (const { food: id, grams } of recipe.ingredients) {
    const f = food(id);
    const k = (grams * portions) / 100;
    sum.kcal += f.kcal * k;
    sum.carbs += f.carbs * k;
    sum.protein += f.protein * k;
    sum.fat += f.fat * k;
    sum.fiber += f.fiber * k;
    sum.iron += f.iron * k;
    sum.calcium += f.calcium * k;
  }
  return {
    kcal: Math.round(sum.kcal),
    carbs: round1(sum.carbs),
    protein: round1(sum.protein),
    fat: round1(sum.fat),
    fiber: round1(sum.fiber),
    iron: round1(sum.iron),
    calcium: Math.round(sum.calcium),
  };
}

/** « 2 œufs », « 1,5 c. à soupe », « 250 g », « 200 ml ». */
export function formatAmount(id: FoodId, grams: number): string {
  const f: Food100 = food(id);
  if (f.unit) {
    const n = Math.max(0.5, Math.round((grams / f.unit.grams) * 2) / 2);
    return `${String(n).replace(".", ",")} ${n > 1 ? f.unit.plural : f.unit.singular}`;
  }
  const rounded = grams < 20 ? Math.round(grams) : Math.round(grams / 5) * 5;
  return `${rounded} ${f.liquid ? "ml" : "g"}`;
}

export function ingredientLines(recipe: Recipe, portions = 1): { name: string; amount: string }[] {
  return recipe.ingredients.map(({ food: id, grams }) => ({ name: food(id).name, amount: formatAmount(id, grams * portions) }));
}

// ---------- Régimes ----------

export type Diet = "vegetarien" | "vegetalien" | "sans-gluten" | "sans-lactose" | "sans-coque";

export const DIET_LABEL: Record<Diet, string> = {
  vegetarien: "Végétarien",
  vegetalien: "Végétalien",
  "sans-gluten": "Sans gluten",
  "sans-lactose": "Sans lactose",
  "sans-coque": "Sans fruits à coque",
};

export function suitsDiet(recipe: Recipe, diet: Diet): boolean {
  const foods = recipe.ingredients.map((i) => food(i.food));
  switch (diet) {
    case "vegetarien":
      return foods.every((f) => !f.meat && !f.fish);
    case "vegetalien":
      return foods.every((f) => !f.meat && !f.fish && !f.egg && !f.dairy && !f.animal);
    case "sans-gluten":
      return foods.every((f) => !f.gluten);
    case "sans-lactose":
      return foods.every((f) => !f.dairy);
    case "sans-coque":
      return foods.every((f) => !f.nuts);
  }
}

export function dietsOf(recipe: Recipe): Diet[] {
  return (Object.keys(DIET_LABEL) as Diet[]).filter((d) => suitsDiet(recipe, d));
}

// ---------- Critères ----------

export type Focus = "glucides" | "proteines" | "fer" | "calcium";

export const FOCUS_LABEL: Record<Focus, string> = {
  glucides: "Riche en glucides",
  proteines: "Riche en protéines",
  fer: "Riche en fer",
  calcium: "Riche en calcium",
};

/** Seuils par portion pour « riche en ». */
export const FOCUS_MIN: Record<Focus, number> = { glucides: 70, proteines: 25, fer: 4, calcium: 250 };

const focusValue = (n: RecipeNutrition, focus: Focus) =>
  ({ glucides: n.carbs, proteines: n.protein, fer: n.iron, calcium: n.calcium })[focus];

export interface Criteria {
  moment: MomentFilter;
  diets: Diet[];
  /** Temps maximal en minutes, null pour ne pas limiter */
  maxMinutes: number | null;
  focus: Focus | null;
}

export const DEFAULT_CRITERIA: Criteria = { moment: "tous", diets: [], maxMinutes: null, focus: null };

/**
 * Veille de course : un vrai repas, avec beaucoup de glucides, peu de fibres et de graisses (digestion facile).
 * Les critères nutritionnels sont calculés sur les ingrédients, jamais déclarés à la main.
 */
export function isVeille(recipe: Recipe): boolean {
  if (!recipe.moments.includes("repas")) return false;
  const n = nutritionOf(recipe);
  return n.carbs >= 80 && n.fiber <= 9 && n.fat <= 22;
}

export function matchesMoment(recipe: Recipe, moment: MomentFilter): boolean {
  if (moment === "tous") return true;
  if (moment === "veille") return isVeille(recipe);
  return recipe.moments.includes(moment);
}

export function filterRecipes(c: Criteria, recipes: Recipe[] = RECIPES): Recipe[] {
  const matching = recipes.filter((r) => {
    if (!matchesMoment(r, c.moment)) return false;
    if (!c.diets.every((d) => suitsDiet(r, d))) return false;
    if (c.maxMinutes !== null && r.minutes > c.maxMinutes) return false;
    if (c.focus && focusValue(nutritionOf(r), c.focus) < FOCUS_MIN[c.focus]) return false;
    return true;
  });
  const focus = c.focus;
  return matching.sort((a, b) => {
    if (focus) {
      const d = focusValue(nutritionOf(b), focus) - focusValue(nutritionOf(a), focus);
      if (d !== 0) return d;
    }
    return a.minutes - b.minutes || a.name.localeCompare(b.name, "fr");
  });
}

/** Critères proposés selon la journée d'entraînement (les régimes et le temps sont conservés). */
export function suggestCriteria(kind: DayKind, eve: boolean, keep: Pick<Criteria, "diets" | "maxMinutes"> = { diets: [], maxMinutes: null }): Criteria {
  const base: Criteria = { moment: "tous", diets: keep.diets, maxMinutes: keep.maxMinutes, focus: null };
  if (eve) return { ...base, moment: "veille" };
  switch (kind) {
    case "course":
      return { ...base, moment: "avant" };
    case "long":
    case "intense":
      return { ...base, focus: "glucides" };
    case "repos":
      return { ...base, focus: "proteines" };
    default:
      return base;
  }
}

export function describeSuggestion(kind: DayKind, eve: boolean): string {
  if (eve) return "Veille de course : beaucoup de glucides, peu de fibres et de graisses.";
  switch (kind) {
    case "course":
      return "Jour de course : un petit-déjeuner ou une collation que tu connais, riche en glucides.";
    case "long":
      return "Sortie longue : des recettes riches en glucides pour recharger les réserves.";
    case "intense":
      return "Séance intense : des recettes riches en glucides pour bien l'aborder et récupérer.";
    case "repos":
      return "Jour de repos : mets les protéines en avant pour la réparation musculaire.";
    default:
      return "Footing facile : toutes les recettes conviennent, choisis selon ton envie.";
  }
}

/** Ajoute ou retire une recette des favorites (liste d'identifiants, sans doublon). */
export function toggleFavorite(favorites: string[], id: string): string[] {
  return favorites.includes(id) ? favorites.filter((f) => f !== id) : [...favorites, id];
}

/** Garde les identifiants qui désignent encore une recette connue, sans doublon. */
export function knownFavorites(favorites: string[], recipes: Recipe[] = RECIPES): string[] {
  const known = new Set(recipes.map((r) => r.id));
  return [...new Set(favorites)].filter((id) => known.has(id));
}

// ---------- Liste de courses ----------

/** Une recette de la liste de courses, avec le nombre de portions voulu. */
export interface ShoppingEntry {
  recipe: string;
  portions: number;
}

export const MAX_SHOPPING_PORTIONS = 40;

/** Ajoute des portions d'une recette (cumulées si elle y est déjà). */
export function addToShopping(list: ShoppingEntry[], recipe: string, portions: number): ShoppingEntry[] {
  const found = list.find((e) => e.recipe === recipe);
  if (!found) return [...list, { recipe, portions }];
  return list.map((e) => (e.recipe === recipe ? { ...e, portions: Math.min(MAX_SHOPPING_PORTIONS, e.portions + portions) } : e));
}

export function removeFromShopping(list: ShoppingEntry[], recipe: string): ShoppingEntry[] {
  return list.filter((e) => e.recipe !== recipe);
}

export interface ShoppingLine {
  food: FoodId;
  name: string;
  grams: number;
  amount: string;
  /** Recettes qui utilisent cet aliment */
  from: string[];
}

/** Ingrédients de toutes les recettes de la liste, regroupés par aliment, par ordre alphabétique. */
export function shoppingLines(list: ShoppingEntry[], recipes: Recipe[] = RECIPES): ShoppingLine[] {
  const byFood = new Map<FoodId, { grams: number; from: string[] }>();
  for (const e of list) {
    const r = recipes.find((x) => x.id === e.recipe);
    if (!r) continue;
    for (const { food: id, grams } of r.ingredients) {
      const cur = byFood.get(id) ?? { grams: 0, from: [] };
      cur.grams += grams * e.portions;
      if (!cur.from.includes(r.name)) cur.from.push(r.name);
      byFood.set(id, cur);
    }
  }
  return [...byFood.entries()]
    .map(([id, v]) => ({ food: id, name: food(id).name, grams: v.grams, amount: formatAmount(id, v.grams), from: v.from }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}
