import { useState, type FormEvent } from "react";
import { RACES, type RaceKey } from "../lib/plan";
import { RACE_KM, assessGoal, goalPace, parseGoalTime, validGoal, type Ambition, type Goal } from "../lib/goal";
import type { PaceModel } from "../lib/paces";
import { fmtClock, fmtPace } from "../lib/format";

interface Props {
  race: RaceKey;
  /** Objectif en cours pour la course du plan */
  goal: Goal | null;
  model: PaceModel | null;
  onChange: (goal: Goal | null) => void;
}

const PLACEHOLDER: Record<RaceKey, string> = { "5k": "24:30", "10k": "50:00", semi: "1:50:00", marathon: "3:55:00" };

const VERDICT: Record<Ambition, string> = {
  realiste: "Réaliste avec ton niveau actuel : le plan est fait pour t'y amener.",
  prudent: "Prudent : tu as de la marge, tu peux viser plus vite si tu te sens bien.",
  ambitieux: "Ambitieux : possible si tu enchaînes les semaines sans blessure ni coupure.",
  "tres-ambitieux": "Très ambitieux : bien au-delà de ton niveau actuel. Mieux vaut un objectif intermédiaire, que tu relèveras en cours de route.",
};

const pct = (x: number) => `${Math.abs(Math.round(x * 100))} %`;

/** Carte « Mon objectif de course » : temps visé, allure nécessaire, et comparaison avec le niveau actuel. */
export default function GoalCard({ race, goal, model, onChange }: Props) {
  const [text, setText] = useState(goal ? fmtClock(goal.minutes) : "");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);

  function submit(e: FormEvent) {
    e.preventDefault();
    const minutes = parseGoalTime(text, race);
    if (minutes === null) return setError(race === "semi" || race === "marathon" ? "Indique un temps comme 1:50 ou 1:50:30 (heures, minutes, secondes)." : "Indique un temps comme 24:30 ou 1:05:00.");
    const next: Goal = { race, minutes: Math.round(minutes * 60) / 60 };
    if (!validGoal(next)) return setError(`Ce temps ne correspond pas à un ${RACES[race].label.toLowerCase()} réaliste (entre 3:00 et 12:00 par km).`);
    setError("");
    setEditing(false);
    onChange(next);
  }

  // Le niveau actuel n'est connu que si des sorties (ou une saisie) le donnent : sinon il est déduit de l'objectif lui-même.
  const level = model && model.reference.source !== "objectif" ? model : null;
  const assessment = goal && level ? assessGoal(goal, level.vdot) : null;
  const showForm = !goal || editing;

  return (
    <section className="card goal-card" aria-labelledby="goal-title">
      <h2 id="goal-title" className="card__title">
        Mon objectif de course
      </h2>

      {goal && !editing && (
        <>
          <p className="goal-card__time">
            {fmtClock(goal.minutes)} <small>sur {RACES[goal.race].label.toLowerCase()}</small>
          </p>
          <p className="hint">
            Il faut tenir {fmtPace(goalPace(goal))} /km sur {RACE_KM[goal.race] === 21.0975 ? "21,1" : String(RACE_KM[goal.race]).replace(".", ",")} km.
          </p>
          {assessment ? (
            <p className={`goal-card__verdict goal-card__verdict--${assessment.ambition}`}>
              <strong>{VERDICT[assessment.ambition]}</strong>
              <br />
              <span className="hint">
                D'après tes sorties, tu courrais aujourd'hui en {fmtClock(assessment.predicted)} environ ; ton objectif est {pct(assessment.gap)} {assessment.gap < 0 ? "plus rapide" : "plus lent"}. Estimation approximative : elle vient de ton allure moyenne d'entraînement.
              </span>
            </p>
          ) : (
            <p className="hint">Enregistre quelques sorties (ou saisis ton allure moyenne plus bas) pour que Runner compare cet objectif à ton niveau actuel.</p>
          )}
          <div className="actions">
            <button type="button" className="btn" onClick={() => setEditing(true)}>
              Modifier
            </button>
            <button
              type="button"
              className="link link--danger"
              onClick={() => {
                setText("");
                onChange(null);
              }}
            >
              Retirer l'objectif
            </button>
          </div>
        </>
      )}

      {showForm && (
        <form className="goal-card__form" onSubmit={submit} noValidate>
          {!goal && (
            <p className="hint">
              Indique le temps que tu vises sur ton {RACES[race].label.toLowerCase()}. Les séances à allure de course, les derniers kilomètres des sorties longues et le jour J afficheront alors l'allure à tenir, et le travail au seuil montera progressivement vers le niveau que demande ton objectif.
            </p>
          )}
          <div className="field">
            <label htmlFor="goal-time">Temps visé sur {RACES[race].label.toLowerCase()}</label>
            <input id="goal-time" type="text" inputMode="numeric" placeholder={PLACEHOLDER[race]} value={text} onChange={(e) => setText(e.target.value)} />
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="actions">
            <button type="submit" className="btn btn--primary">
              Enregistrer l'objectif
            </button>
            {editing && (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setEditing(false);
                  setError("");
                  setText(goal ? fmtClock(goal.minutes) : "");
                }}
              >
                Annuler
              </button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
