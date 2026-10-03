import { useState, type FormEvent } from "react";
import { GOALS, validateProfile, type Goal, type Profile, type Sex } from "../lib/nutrition";

interface Props {
  initial?: Profile;
  onSubmit: (p: Profile) => void;
  onCancel?: () => void;
  /** Affiche le titre « Ton profil » (inutile quand la page a déjà le sien) */
  showTitle?: boolean;
}

const toNum = (s: string) => Number(s.trim().replace(",", "."));

/** Profil physique : sert uniquement à estimer les besoins, il reste sur l'appareil. */
export default function ProfileForm({ initial, onSubmit, onCancel, showTitle = true }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [sex, setSex] = useState<Sex>(initial?.sex ?? "m");
  const [age, setAge] = useState(initial ? String(initial.age) : "");
  const [weight, setWeight] = useState(initial ? String(initial.weightKg).replace(".", ",") : "");
  const [height, setHeight] = useState(initial ? String(initial.heightCm) : "");
  const [goal, setGoal] = useState<Goal>(initial?.goal ?? "maintenir");
  const [error, setError] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const profile: Profile = { ...(name.trim() ? { name: name.trim().slice(0, 40) } : {}), sex, age: toNum(age), weightKg: toNum(weight), heightCm: toNum(height), goal };
    const problem = age.trim() === "" || weight.trim() === "" || height.trim() === "" ? "Renseigne ton âge, ton poids et ta taille." : validateProfile(profile);
    if (problem) return setError(problem);
    onSubmit(profile);
  }

  return (
    <form className="card form" onSubmit={handleSubmit} noValidate>
      {showTitle && <h2 className="card__title">Ton profil</h2>}
      <p className="hint">Il sert à estimer tes besoins chaque jour, selon ta charge d'entraînement. Rien n'est envoyé en ligne.</p>

      <div className="field">
        <label htmlFor="p-name">Prénom (facultatif)</label>
        <input id="p-name" type="text" maxLength={40} autoComplete="given-name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <fieldset className="field">
        <legend>Sexe</legend>
        <div className="chips">
          <label className="chip">
            <input type="radio" name="sex" checked={sex === "m"} onChange={() => setSex("m")} />
            <span>Homme</span>
          </label>
          <label className="chip">
            <input type="radio" name="sex" checked={sex === "f"} onChange={() => setSex("f")} />
            <span>Femme</span>
          </label>
        </div>
      </fieldset>

      <div className="field-row field-row--3">
        <div className="field">
          <label htmlFor="p-age">Âge</label>
          <input id="p-age" type="text" inputMode="numeric" value={age} onChange={(e) => setAge(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="p-weight">Poids (kg)</label>
          <input id="p-weight" type="text" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="p-height">Taille (cm)</label>
          <input id="p-height" type="text" inputMode="numeric" value={height} onChange={(e) => setHeight(e.target.value)} />
        </div>
      </div>

      <fieldset className="field">
        <legend>Objectif</legend>
        <div className="chips">
          {(Object.keys(GOALS) as Goal[]).map((g) => (
            <label className="chip" key={g}>
              <input type="radio" name="goal" checked={goal === g} onChange={() => setGoal(g)} />
              <span>{GOALS[g]}</span>
            </label>
          ))}
        </div>
        {goal === "perdre" && (
          <p className="hint">L'apport n'est réduit (de 10 %) que les jours de repos et de footing facile, jamais avant une grosse séance ni une course.</p>
        )}
      </fieldset>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="actions">
        <button type="submit" className="btn btn--primary">
          Enregistrer mon profil
        </button>
        {onCancel && (
          <button type="button" className="btn" onClick={onCancel}>
            Annuler
          </button>
        )}
      </div>
    </form>
  );
}
