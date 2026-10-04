import { useState } from "react";
import { RECIPES, removeFromShopping, shoppingLines, type ShoppingEntry } from "../lib/recipes";

export interface ShoppingState {
  items: ShoppingEntry[];
  /** Aliments déjà dans le panier (cochés) */
  checked: string[];
}

interface Props {
  state: ShoppingState;
  onChange: (s: ShoppingState) => void;
}

const fmt = (x: number) => String(Math.round(x * 10) / 10).replace(".", ",");

/** Liste de courses : ingrédients des recettes ajoutées, regroupés par aliment, à cocher en faisant les courses. */
export default function ShoppingList({ state, onChange }: Props) {
  const lines = shoppingLines(state.items);
  const [copied, setCopied] = useState(false);
  if (state.items.length === 0) return null;

  const remaining = lines.filter((l) => !state.checked.includes(l.food)).length;
  const toggle = (food: string) =>
    onChange({ ...state, checked: state.checked.includes(food) ? state.checked.filter((f) => f !== food) : [...state.checked, food] });

  async function copy() {
    const text = lines.filter((l) => !state.checked.includes(l.food)).map((l) => `${l.name} : ${l.amount}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      /* presse-papiers indisponible : la liste reste affichée */
    }
  }

  return (
    <details className="card shopping" open>
      <summary>
        <h2 className="card__title">Liste de courses</h2>
        <span className="criteria-fold__preview">
          {state.items.length} recette{state.items.length > 1 ? "s" : ""} · {remaining} à acheter
        </span>
      </summary>
      <div className="shopping__body">
        <ul className="shopping__recipes" aria-label="Recettes de la liste">
          {state.items.map((e) => {
            const r = RECIPES.find((x) => x.id === e.recipe);
            if (!r) return null;
            return (
              <li key={e.recipe}>
                <span>
                  {r.name} · {fmt(e.portions)} portion{e.portions > 1 ? "s" : ""}
                </span>
                <button type="button" className="link link--danger" onClick={() => onChange({ ...state, items: removeFromShopping(state.items, e.recipe) })}>
                  Retirer
                </button>
              </li>
            );
          })}
        </ul>

        <ul className="shopping__lines">
          {lines.map((l) => {
            const on = state.checked.includes(l.food);
            return (
              <li key={l.food} className={on ? "shopping__line shopping__line--done" : "shopping__line"}>
                <label>
                  <input type="checkbox" checked={on} onChange={() => toggle(l.food)} />
                  <span className="shopping__name">{l.name}</span>
                  <span className="shopping__amount">{l.amount}</span>
                </label>
              </li>
            );
          })}
        </ul>

        <div className="actions">
          <button type="button" className="btn" onClick={copy}>
            {copied ? "Copié" : "Copier ce qui reste"}
          </button>
          <button type="button" className="link" onClick={() => onChange({ ...state, checked: [] })} disabled={state.checked.length === 0}>
            Tout décocher
          </button>
          <button
            type="button"
            className="link link--danger"
            onClick={() => window.confirm("Vider la liste de courses ?") && onChange({ items: [], checked: [] })}
          >
            Vider la liste
          </button>
        </div>
      </div>
    </details>
  );
}
