import {
  DEFAULT_CRITERIA,
  DIET_LABEL,
  FOCUS_MIN,
  FOODS,
  RECIPES,
  describeSuggestion,
  dietsOf,
  filterRecipes,
  formatAmount,
  ingredientLines,
  isVeille,
  nutritionOf,
  suggestCriteria,
  suitsDiet,
  addToShopping,
  removeFromShopping,
  shoppingLines,
  knownFavorites,
  toggleFavorite,
  type Criteria,
  type Diet,
  type FoodId,
  type Moment,
  type MomentFilter,
} from "../src/lib/recipes.ts";

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (!ok) {
    failures++;
    console.log("ECHEC", name, detail ?? "");
  } else console.log("ok   ", name);
}

const byId = (id: string) => RECIPES.find((r) => r.id === id)!;
const crit = (c: Partial<Criteria>): Criteria => ({ ...DEFAULT_CRITERIA, ...c });
const ids = (c: Partial<Criteria>) => filterRecipes(crit(c)).map((r) => r.id);

// ---------- Table d'aliments ----------

const foodEntries = Object.entries(FOODS) as [FoodId, (typeof FOODS)[FoodId]][];
const badFoods = foodEntries.filter(([, f]) => {
  const atwater = 4 * f.carbs + 4 * f.protein + 9 * f.fat;
  return Math.abs(f.kcal - atwater) > Math.max(12, 0.2 * f.kcal);
});
check("aliments : calories cohérentes avec les macros (±20 %)", badFoods.length === 0, badFoods.map(([id]) => id));
check(
  "aliments : valeurs positives et glucides + protéines + lipides ≤ 100 g",
  foodEntries.every(([, f]) => f.kcal > 0 && f.carbs >= 0 && f.protein >= 0 && f.fat >= 0 && f.fiber >= 0 && f.iron >= 0 && f.calcium >= 0 && f.carbs + f.protein + f.fat <= 100),
);
check("aliments : un produit animal n'est ni végétal ni sans lactose par erreur", FOODS.miel.animal === true && FOODS.lait.dairy === true && FOODS.oeuf.egg === true);

// ---------- Recettes : structure ----------

check("recettes : identifiants uniques", new Set(RECIPES.map((r) => r.id)).size === RECIPES.length);
check("recettes : ingrédients connus et quantités positives", RECIPES.every((r) => r.ingredients.length >= 2 && r.ingredients.every((i) => i.food in FOODS && i.grams > 0)));
check("recettes : étapes, durée, note et moment renseignés", RECIPES.every((r) => r.steps.length >= 2 && r.minutes > 0 && r.note.length > 10 && r.moments.length > 0));
check("recettes : pas d'ingrédient en double", RECIPES.every((r) => new Set(r.ingredients.map((i) => i.food)).size === r.ingredients.length));

const nuts = RECIPES.map((r) => ({ r, n: nutritionOf(r) }));
check(
  "recettes : calories plausibles par portion (150 à 1 000 kcal)",
  nuts.every(({ n }) => n.kcal >= 150 && n.kcal <= 1000),
  nuts.filter(({ n }) => n.kcal < 150 || n.kcal > 1000).map(({ r, n }) => [r.id, n.kcal]),
);
check("recettes : le « pendant l'effort » est léger et sucré", RECIPES.filter((r) => r.moments.includes("pendant")).every((r) => nutritionOf(r).carbs >= 40 && nutritionOf(r).kcal <= 450));
check("recettes : aucune valeur NaN", nuts.every(({ n }) => Object.values(n).every(Number.isFinite)));

// ---------- Calculs ----------

const porridge = byId("porridge-banane-miel");
const one = nutritionOf(porridge);
const two = nutritionOf(porridge, 2);
check("proportionnalité : 2 portions = 2 × (à l'arrondi près)", Math.abs(two.kcal - 2 * one.kcal) <= 2 && Math.abs(two.carbs - 2 * one.carbs) <= 0.2, [one, two]);
check("porridge : ordre de grandeur (≈ 440 kcal, 70 à 80 g de glucides)", one.kcal > 400 && one.kcal < 480 && one.carbs > 68 && one.carbs < 80, one);
check("quantités affichées : unités", formatAmount("oeuf", 110) === "2 œufs" && formatAmount("oeuf", 55) === "1 œuf" && formatAmount("huile", 15) === "1,5 c. à soupe" && formatAmount("dattes", 80) === "4 dattes");
check("quantités affichées : g et ml", formatAmount("riz", 252) === "250 g" && formatAmount("lait", 200) === "200 ml" && formatAmount("fruits_rouges", 12) === "12 g");
check("quantités affichées : jamais « 0 »", formatAmount("oeuf", 5).startsWith("0,5") && !ingredientLines(porridge, 0.5).some((l) => l.amount.startsWith("0 ")));
check("lignes d'ingrédients : mises à l'échelle", ingredientLines(porridge, 2).find((l) => l.name === "Banane")?.amount === "2 bananes" && ingredientLines(porridge).find((l) => l.name === "Banane")?.amount === "1 banane");

// ---------- Régimes : calculés, jamais déclarés ----------

check("régime : le curry de pois chiches est végétalien et sans gluten", suitsDiet(byId("curry-pois-chiches-epinards"), "vegetalien") && suitsDiet(byId("curry-pois-chiches-epinards"), "sans-gluten"));
check("régime : le miel n'est pas végétalien mais est végétarien", !suitsDiet(byId("tartines-banane-miel"), "vegetalien") && suitsDiet(byId("tartines-banane-miel"), "vegetarien"));
check("régime : l'avoine compte comme du gluten", !suitsDiet(porridge, "sans-gluten"));
check("régime : lait = lactose, soja = sans lactose", !suitsDiet(porridge, "sans-lactose") && suitsDiet(byId("porridge-soja-fruits-rouges"), "sans-lactose"));
check("régime : les boules dattes-amandes contiennent des fruits à coque", !suitsDiet(byId("boules-dattes-amandes"), "sans-coque") && suitsDiet(byId("boules-dattes-amandes"), "sans-gluten"));
check("régime : le poulet n'est pas végétarien, le saumon non plus", !suitsDiet(byId("riz-poulet-brocoli"), "vegetarien") && !suitsDiet(byId("saumon-pommes-de-terre"), "vegetarien"));
check("régime : le végétalien implique le végétarien", RECIPES.every((r) => !suitsDiet(r, "vegetalien") || suitsDiet(r, "vegetarien")));
check("régime : dietsOf cohérent avec suitsDiet", RECIPES.every((r) => dietsOf(r).length === (Object.keys(DIET_LABEL) as Diet[]).filter((d) => suitsDiet(r, d)).length));

// ---------- Filtres ----------

check("sans critère : toutes les recettes", filterRecipes(DEFAULT_CRITERIA).length === RECIPES.length);
check("filtre végétalien : aucun produit animal", filterRecipes(crit({ diets: ["vegetalien"] })).every((r) => suitsDiet(r, "vegetalien")) && ids({ diets: ["vegetalien"] }).length >= 6);
check("filtres combinés : végétalien + sans gluten + sans fruits à coque", filterRecipes(crit({ diets: ["vegetalien", "sans-gluten", "sans-coque"] })).every((r) => suitsDiet(r, "vegetalien") && suitsDiet(r, "sans-gluten") && suitsDiet(r, "sans-coque")));
check("filtre temps : ≤ 15 min", filterRecipes(crit({ maxMinutes: 15 })).every((r) => r.minutes <= 15) && ids({ maxMinutes: 15 }).length >= 6);
check("filtre temps : plus strict = moins de résultats", ids({ maxMinutes: 10 }).length <= ids({ maxMinutes: 15 }).length && ids({ maxMinutes: 15 }).length <= ids({ maxMinutes: 30 }).length);

const moments: Moment[] = ["petit-dej", "avant", "pendant", "apres", "repas"];
check(
  "chaque moment a au moins 2 recettes",
  moments.every((m) => ids({ moment: m }).length >= 2),
  moments.map((m) => [m, ids({ moment: m }).length]),
);
check(
  "chaque moment a au moins 1 recette végétalienne",
  moments.every((m) => ids({ moment: m, diets: ["vegetalien"] }).length >= 1),
  moments.map((m) => [m, ids({ moment: m, diets: ["vegetalien"] }).length]),
);
check(
  "chaque moment a au moins 1 recette sans gluten",
  moments.every((m) => ids({ moment: m, diets: ["sans-gluten"] }).length >= 1),
  moments.map((m) => [m, ids({ moment: m, diets: ["sans-gluten"] }).length]),
);

check(
  "chaque moment a au moins 1 recette végétalienne et sans gluten",
  moments.every((m) => ids({ moment: m, diets: ["vegetalien", "sans-gluten"] }).length >= 1),
  moments.map((m) => [m, ids({ moment: m, diets: ["vegetalien", "sans-gluten"] }).length]),
);

// Veille de course : calculée
const veille = filterRecipes(crit({ moment: "veille" }));
check("veille de course : au moins 3 recettes", veille.length >= 3, veille.map((r) => r.id));
check(
  "veille de course : chaque recette riche en glucides, pauvre en fibres et en graisses",
  veille.every((r) => {
    const n = nutritionOf(r);
    return n.carbs >= 80 && n.fiber <= 9 && n.fat <= 22 && isVeille(r);
  }),
);
check("veille de course : seulement des recettes de repas", veille.every((r) => r.moments.includes("repas")));
check("veille de course : jamais le chili (trop de fibres)", !veille.some((r) => r.id === "chili-patate-douce" || r.id === "dahl-lentilles"));
check("veille de course : une option végétalienne et une sans gluten", filterRecipes(crit({ moment: "veille", diets: ["vegetalien"] })).length >= 1 && filterRecipes(crit({ moment: "veille", diets: ["sans-gluten"] })).length >= 1);

// Apports recherchés
const focuses = Object.keys(FOCUS_MIN) as (keyof typeof FOCUS_MIN)[];
check("apport : chaque recette retenue atteint le seuil", focuses.every((f) => filterRecipes(crit({ focus: f })).every((r) => {
  const n = nutritionOf(r);
  const v = { glucides: n.carbs, proteines: n.protein, fer: n.iron, calcium: n.calcium }[f];
  return v >= FOCUS_MIN[f];
})));
check("apport : au moins 3 recettes pour chaque apport", focuses.every((f) => ids({ focus: f }).length >= 3), focuses.map((f) => [f, ids({ focus: f }).length]));
check("apport : trié du plus riche au moins riche", (() => {
  const l = filterRecipes(crit({ focus: "fer" })).map((r) => nutritionOf(r).iron);
  return l.every((v, i) => i === 0 || l[i - 1] >= v);
})());
check("fer : le curry de pois chiches y figure, pas le porridge", ids({ focus: "fer" }).includes("curry-pois-chiches-epinards") && !ids({ focus: "fer" }).includes("porridge-banane-miel"));
check("calcium : les sardines et le tofu y figurent", ids({ focus: "calcium" }).includes("tartines-sardines") && ids({ focus: "calcium" }).includes("tofu-riz-legumes"));
check("critères impossibles : liste vide, sans erreur", (() => {
  const r = filterRecipes(crit({ moment: "pendant", diets: ["vegetalien", "sans-coque"], maxMinutes: 5 }));
  return Array.isArray(r) && r.length === 0;
})());

// ---------- Suggestion selon la journée ----------

check("suggestion : veille de course", suggestCriteria("repos", true).moment === "veille");
check("suggestion : jour de course → avant l'effort", suggestCriteria("course", false).moment === "avant");
check("suggestion : sortie longue → glucides", suggestCriteria("long", false).focus === "glucides");
check("suggestion : repos → protéines", suggestCriteria("repos", false).focus === "proteines");
check("suggestion : footing facile → rien d'imposé", (() => { const c = suggestCriteria("facile", false); return c.moment === "tous" && c.focus === null; })());
check("suggestion : conserve régimes et temps", (() => { const c = suggestCriteria("long", false, { diets: ["sans-gluten"], maxMinutes: 30 }); return c.diets[0] === "sans-gluten" && c.maxMinutes === 30; })());
check("suggestion : chaque journée est expliquée", (["repos", "facile", "intense", "long", "course"] as const).every((k) => describeSuggestion(k, false).length > 10) && describeSuggestion("repos", true).includes("Veille"));
check("suggestions : toujours au moins 1 résultat", (["repos", "facile", "intense", "long", "course"] as const).every((k) => [false, true].every((e) => filterRecipes(suggestCriteria(k, e)).length >= 1)));

const labels: MomentFilter[] = ["tous", "petit-dej", "avant", "pendant", "apres", "repas", "veille"];
check("momentspossibles : tous les filtres retournent un tableau", labels.every((m) => Array.isArray(filterRecipes(crit({ moment: m })))));

// ---------- Favorites ----------

check("favorites : ajout puis retrait", (() => {
  const a = toggleFavorite([], RECIPES[0].id);
  const b = toggleFavorite(a, RECIPES[1].id);
  const c = toggleFavorite(b, RECIPES[0].id);
  return a.length === 1 && b.length === 2 && c.length === 1 && c[0] === RECIPES[1].id;
})());
check("favorites : la liste d'origine n'est pas modifiée", (() => {
  const base = [RECIPES[0].id];
  toggleFavorite(base, RECIPES[1].id);
  return base.length === 1;
})());
check("favorites : identifiants inconnus et doublons écartés", (() => {
  const k = knownFavorites([RECIPES[0].id, "inconnue", RECIPES[0].id, RECIPES[2].id]);
  return k.length === 2 && k[0] === RECIPES[0].id && k[1] === RECIPES[2].id;
})());

// ---------- Liste de courses ----------

check("courses : une recette ajoutée donne ses ingrédients", (() => {
  const r = RECIPES[0];
  const lines = shoppingLines(addToShopping([], r.id, 1));
  return lines.length === new Set(r.ingredients.map((i) => i.food)).size && lines.every((l) => l.from.includes(r.name));
})());
check("courses : les portions multiplient les quantités", (() => {
  const r = RECIPES[0];
  const one = shoppingLines(addToShopping([], r.id, 1));
  const three = shoppingLines(addToShopping([], r.id, 3));
  return one.every((l, i) => Math.abs(three[i].grams - 3 * l.grams) < 1e-9);
})());
check("courses : la même recette cumule ses portions", (() => {
  const l = addToShopping(addToShopping([], RECIPES[0].id, 1.5), RECIPES[0].id, 2);
  return l.length === 1 && l[0].portions === 3.5;
})());
check("courses : un aliment commun est additionné", (() => {
  const shared = RECIPES.flatMap((a) => RECIPES.filter((b) => b.id > a.id).map((b) => [a, b] as const)).find(([a, b]) => a.ingredients.some((i) => b.ingredients.some((j) => j.food === i.food)))!;
  const food = shared[0].ingredients.find((i) => shared[1].ingredients.some((j) => j.food === i.food))!.food;
  const lines = shoppingLines(addToShopping(addToShopping([], shared[0].id, 1), shared[1].id, 1));
  const line = lines.find((l) => l.food === food)!;
  const expected = shared[0].ingredients.filter((i) => i.food === food).reduce((a, i) => a + i.grams, 0) + shared[1].ingredients.filter((i) => i.food === food).reduce((a, i) => a + i.grams, 0);
  return line.from.length === 2 && Math.abs(line.grams - expected) < 1e-9 && lines.filter((l) => l.food === food).length === 1;
})());
check("courses : retrait d'une recette et recette inconnue", (() => {
  const l = addToShopping(addToShopping([], RECIPES[0].id, 1), RECIPES[1].id, 1);
  const rest = removeFromShopping(l, RECIPES[0].id);
  return rest.length === 1 && rest[0].recipe === RECIPES[1].id && shoppingLines([{ recipe: "inconnue", portions: 2 }]).length === 0;
})());
check("courses : lignes triées et libellés non vides", (() => {
  const lines = shoppingLines(RECIPES.reduce((acc, r) => addToShopping(acc, r.id, 1), [] as ReturnType<typeof addToShopping>));
  return lines.every((l, i) => l.amount.length > 0 && (i === 0 || lines[i - 1].name.localeCompare(l.name, "fr") <= 0));
})());

process.exit(failures ? 1 : 0);
