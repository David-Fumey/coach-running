import { useState } from "react";
import type { Plan } from "../lib/plan";
import type { Activity } from "../lib/activities";
import { DAY_KIND_LABEL, dayContext, dayTarget, type DayTarget, type Food, type Profile } from "../lib/nutrition";
import {
  DEFAULT_CRITERIA,
  DIET_LABEL,
  FOCUS_LABEL,
  MOMENT_LABEL,
  describeSuggestion,
  dietsOf,
  filterRecipes,
  ingredientLines,
  nutritionOf,
  suggestCriteria,
  type Criteria,
  type Diet,
  type Focus,
  type MomentFilter,
  type Recipe,
} from "../lib/recipes";
import { todayISO } from "../storage";

interface Props {
  plan: Plan;
  done: Record<string, boolean>;
  activities: Activity[];
  profile: Profile | null;
  onAddFood: (f: Omit<Food, "id">) => void;
}

const MOMENTS: MomentFilter[] = ["tous", "petit-dej", "avant", "pendant", "apres", "repas", "veille"];
const DIETS = Object.keys(DIET_LABEL) as Diet[];
const FOCUSES = Object.keys(FOCUS_LABEL) as Focus[];
const TIMES: { label: string; value: number | null }[] = [
  { label: "Peu importe", value: null },
  { label: "15 min max.", value: 15 },
  { label: "30 min max.", value: 30 },
];

const fmt = (x: number) => String(Math.round(x * 10) / 10).replace(".", ",");

/** Recettes conseillées : on règle les critères, et on ajoute une portion au journal d'un clic. */
export default function Recipes({ plan, done, activities, profile, onAddFood }: Props) {
  const today = todayISO();
  const ctx = dayContext(plan, activities, done, today, today);
  const [criteria, setCriteria] = useState<Criteria>(() => suggestCriteria(ctx.kind, ctx.eve));
  const [openId, setOpenId] = useState<string | null>(null);

  const suggestion = suggestCriteria(ctx.kind, ctx.eve);
  const results = filterRecipes(criteria);
  const target = profile ? dayTarget(plan, profile, activities, done, today, today) : null;
  const isDefault = JSON.stringify(criteria) === JSON.stringify(DEFAULT_CRITERIA);

  const set = (patch: Partial<Criteria>) => setCriteria((c) => ({ ...c, ...patch }));
  const toggleDiet = (d: Diet) =>
    setCriteria((c) => ({ ...c, diets: c.diets.includes(d) ? c.diets.filter((x) => x !== d) : [...c.diets, d] }));

  return (
    <div className="recipes">
      <section className="card suggest" aria-labelledby="suggest-title">
        <p className="eyebrow">
          <span id="suggest-title">Pour aujourd'hui</span> · {ctx.eve ? "Veille de course" : DAY_KIND_LABEL[ctx.kind]}
        </p>
        <p>{describeSuggestion(ctx.kind, ctx.eve)}</p>
        {suggestion.moment !== "tous" || suggestion.focus !== null ? (
          <button type="button" className="btn" onClick={() => setCriteria((c) => ({ ...suggestion, diets: c.diets, maxMinutes: c.maxMinutes }))}>
            Appliquer ces critères
          </button>
        ) : null}
      </section>

      <section className="card criteria" aria-labelledby="criteria-title">
        <div className="card__head">
          <h2 id="criteria-title" className="card__title">
            Mes critères
          </h2>
          <button type="button" className="link" disabled={isDefault} onClick={() => setCriteria(DEFAULT_CRITERIA)}>
            Tout effacer
          </button>
        </div>

        <ChipGroup label="Moment">
          {MOMENTS.map((m) => (
            <Chip key={m} pressed={criteria.moment === m} onClick={() => set({ moment: m })}>
              {MOMENT_LABEL[m]}
            </Chip>
          ))}
        </ChipGroup>

        <ChipGroup label="Régime et allergies">
          {DIETS.map((d) => (
            <Chip key={d} pressed={criteria.diets.includes(d)} onClick={() => toggleDiet(d)}>
              {DIET_LABEL[d]}
            </Chip>
          ))}
        </ChipGroup>

        <ChipGroup label="Apport à privilégier">
          <Chip pressed={criteria.focus === null} onClick={() => set({ focus: null })}>
            Aucun
          </Chip>
          {FOCUSES.map((f) => (
            <Chip key={f} pressed={criteria.focus === f} onClick={() => set({ focus: f })}>
              {FOCUS_LABEL[f]}
            </Chip>
          ))}
        </ChipGroup>

        <ChipGroup label="Temps de préparation">
          {TIMES.map((t) => (
            <Chip key={t.label} pressed={criteria.maxMinutes === t.value} onClick={() => set({ maxMinutes: t.value })}>
              {t.label}
            </Chip>
          ))}
        </ChipGroup>
      </section>

      <p className="recipes__count" role="status">
        {results.length === 0 ? "Aucune recette" : results.length === 1 ? "1 recette" : `${results.length} recettes`}
      </p>

      {results.length === 0 ? (
        <div className="empty">
          <p>Aucune recette ne répond à tous ces critères. Retire-en un (le temps ou l'apport sont les plus restrictifs) pour en voir davantage.</p>
          <button type="button" className="btn" onClick={() => setCriteria(DEFAULT_CRITERIA)}>
            Tout effacer
          </button>
        </div>
      ) : (
        <div className="recipe-list">
          {results.map((r) => (
            <RecipeCard
              key={r.id}
              recipe={r}
              focus={criteria.focus}
              target={target}
              open={openId === r.id}
              onToggle={(o) => setOpenId((cur) => (o ? r.id : cur === r.id ? null : cur))}
              onAddFood={onAddFood}
              today={today}
            />
          ))}
        </div>
      )}

      <p className="hint advice__note">
        Valeurs nutritionnelles estimées à partir des quantités indiquées (tables de composition usuelles) : elles varient selon les produits. Les mentions « sans gluten », « sans lactose » ou « sans fruits à coque » ne tiennent pas compte des traces ni des produits transformés : vérifie les étiquettes en cas d'allergie ou de maladie cœliaque.
      </p>
    </div>
  );
}

function ChipGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <span className="field__label" id={`g-${label}`}>
        {label}
      </span>
      <div className="chips" role="group" aria-labelledby={`g-${label}`}>
        {children}
      </div>
    </div>
  );
}

function Chip({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className="chip-btn" aria-pressed={pressed} onClick={onClick}>
      {children}
    </button>
  );
}

function RecipeCard({
  recipe,
  focus,
  target,
  open,
  onToggle,
  onAddFood,
  today,
}: {
  recipe: Recipe;
  focus: Focus | null;
  target: DayTarget | null;
  open: boolean;
  onToggle: (open: boolean) => void;
  onAddFood: (f: Omit<Food, "id">) => void;
  today: string;
}) {
  const [portions, setPortions] = useState(1);
  const [added, setAdded] = useState(false);
  const n = nutritionOf(recipe, portions);
  const diets = dietsOf(recipe);
  const portionLabel = portions === 1 ? "1 portion" : `${fmt(portions)} portions`;

  function add() {
    onAddFood({
      date: today,
      label: portions === 1 ? recipe.name : `${recipe.name} (${portionLabel})`,
      kcal: n.kcal,
      carbs: Math.round(n.carbs),
      protein: Math.round(n.protein),
      fat: Math.round(n.fat),
    });
    setAdded(true);
  }

  const highlight =
    focus === "fer"
      ? `${fmt(n.iron)} mg de fer`
      : focus === "calcium"
        ? `${n.calcium} mg de calcium`
        : focus === "proteines"
          ? `${Math.round(n.protein)} g de protéines`
          : `${Math.round(n.carbs)} g de glucides`;

  return (
    <details className="recipe" open={open} onToggle={(e) => onToggle((e.currentTarget as HTMLDetailsElement).open)}>
      <summary>
        <span className="recipe__name">{recipe.name}</span>
        <span className="recipe__meta">
          {recipe.minutes} min · {n.kcal} kcal · {highlight}
        </span>
      </summary>

      <div className="recipe__body">
        <p className="recipe__note">{recipe.note}</p>

        <div className="portions" role="group" aria-label="Nombre de portions">
          <button type="button" className="portions__btn" aria-label="Moins de portions" disabled={portions <= 0.5} onClick={() => { setPortions((p) => p - 0.5); setAdded(false); }}>
            −
          </button>
          <span className="portions__value" aria-live="polite">
            {portionLabel}
          </span>
          <button type="button" className="portions__btn" aria-label="Plus de portions" disabled={portions >= 4} onClick={() => { setPortions((p) => p + 0.5); setAdded(false); }}>
            +
          </button>
        </div>

        <dl className="macros">
          <div>
            <dt>Énergie</dt>
            <dd>{n.kcal} kcal</dd>
          </div>
          <div>
            <dt>Glucides</dt>
            <dd>{fmt(n.carbs)} g</dd>
          </div>
          <div>
            <dt>Protéines</dt>
            <dd>{fmt(n.protein)} g</dd>
          </div>
          <div>
            <dt>Lipides</dt>
            <dd>{fmt(n.fat)} g</dd>
          </div>
          <div>
            <dt>Fibres</dt>
            <dd>{fmt(n.fiber)} g</dd>
          </div>
          <div>
            <dt>Fer</dt>
            <dd>{fmt(n.iron)} mg</dd>
          </div>
          <div>
            <dt>Calcium</dt>
            <dd>{n.calcium} mg</dd>
          </div>
        </dl>

        {target && target.carbs > 0 && (
          <p className="hint">
            Couvre environ {Math.round((n.carbs / target.carbs) * 100)} % de tes glucides et {Math.round((n.protein / target.protein) * 100)} % de tes protéines d'aujourd'hui.
          </p>
        )}

        <h3 className="topic__sub">Ingrédients</h3>
        <ul className="ingredients">
          {ingredientLines(recipe, portions).map((l) => (
            <li key={l.name}>
              <span>{l.name}</span>
              <span>{l.amount}</span>
            </li>
          ))}
        </ul>

        <h3 className="topic__sub">Préparation</h3>
        <ol className="steps">
          {recipe.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>

        {diets.length > 0 && (
          <ul className="sources" aria-label="Convient pour">
            {diets.map((d) => (
              <li key={d}>{DIET_LABEL[d]}</li>
            ))}
          </ul>
        )}

        <div className="actions">
          <button type="button" className="btn btn--primary" onClick={add}>
            Ajouter au journal d'aujourd'hui
          </button>
        </div>
        {added && (
          <p className="notice" role="status">
            Ajouté : {recipe.name}, {n.kcal} kcal. Retrouve-le dans « Suivi du jour ».
          </p>
        )}
      </div>
    </details>
  );
}
