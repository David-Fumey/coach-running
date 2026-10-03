import { useState, type FormEvent } from "react";
import { LEVELS, RACES, addDays, diffDays, type Level, type LongDay, type PlanInput, type RaceKey } from "../lib/plan";
import { todayISO } from "../storage";
import type { PlanFormValues } from "../App";

interface Props {
  initial?: PlanInput;
  onSubmit: (values: PlanFormValues) => void;
  onCancel?: () => void;
}

const DAY_OPTIONS = [3, 4, 5, 6] as const;

export default function SetupForm({ initial, onSubmit, onCancel }: Props) {
  const [race, setRace] = useState<RaceKey>(initial?.race ?? "10k");
  const [raceDate, setRaceDate] = useState(initial?.raceDate ?? "");
  const [level, setLevel] = useState<Level>(initial?.level ?? "intermediaire");
  const [days, setDays] = useState<3 | 4 | 5 | 6>(initial?.daysPerWeek ?? 4);
  const [currentKm, setCurrentKm] = useState(initial && initial.currentWeeklyKm > 0 ? String(initial.currentWeeklyKm) : "");
  const [longDay, setLongDay] = useState<LongDay>(initial?.longDay ?? "dim");
  const [error, setError] = useState("");

  const today = todayISO();
  const minDate = addDays(today, 1);
  const weeksLeft = raceDate ? Math.ceil(diffDays(today, raceDate) / 7) : null;
  const tooShort = weeksLeft !== null && weeksLeft > 0 && weeksLeft < RACES[race].minWeeks;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!raceDate) {
      setError("Choisis la date de ta course.");
      return;
    }
    if (diffDays(today, raceDate) < 1) {
      setError("La date de la course doit être dans le futur.");
      return;
    }
    const km = currentKm.trim() === "" ? 0 : Number(currentKm.replace(",", "."));
    if (!Number.isFinite(km) || km < 0 || km > 200) {
      setError("Indique un volume hebdomadaire entre 0 et 200 km, ou laisse le champ vide.");
      return;
    }
    setError("");
    try {
      onSubmit({ race, raceDate, level, daysPerWeek: days, currentWeeklyKm: km, longDay });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de créer le plan.");
    }
  }

  return (
    <form className="setup" onSubmit={handleSubmit} noValidate>
      <header className="setup__intro">
        <img className="brand__mark" src="./icon.svg" alt="" width="56" height="56" />
        <h1 className="brand">Runner</h1>
        <p className="lead">
          Dis-nous quelle course tu prépares. On construit ton plan semaine par semaine, jusqu'au jour J.
        </p>
      </header>

      <fieldset className="field">
        <legend>Ta course</legend>
        <div className="chips">
          {(Object.keys(RACES) as RaceKey[]).map((key) => (
            <label className="chip" key={key}>
              <input type="radio" name="race" checked={race === key} onChange={() => setRace(key)} />
              <span>{RACES[key].label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="field">
        <label htmlFor="raceDate">Date de la course</label>
        <input id="raceDate" type="date" min={minDate} value={raceDate} onChange={(e) => setRaceDate(e.target.value)} />
        {weeksLeft !== null && weeksLeft > 0 && (
          <p className={tooShort ? "hint hint--warn" : "hint"}>
            {tooShort
              ? `Dans ${weeksLeft} semaine${weeksLeft > 1 ? "s" : ""} : c'est court, ${RACES[race].minWeeks} semaines sont recommandées pour cette distance.`
              : `Dans ${weeksLeft} semaine${weeksLeft > 1 ? "s" : ""}.`}
          </p>
        )}
      </div>

      <fieldset className="field">
        <legend>Ton niveau</legend>
        <div className="chips">
          {(Object.keys(LEVELS) as Level[]).map((key) => (
            <label className="chip" key={key}>
              <input type="radio" name="level" checked={level === key} onChange={() => setLevel(key)} />
              <span>{LEVELS[key]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="field">
        <legend>Séances par semaine</legend>
        <div className="chips">
          {DAY_OPTIONS.map((n) => (
            <label className="chip" key={n}>
              <input type="radio" name="days" checked={days === n} onChange={() => setDays(n)} />
              <span>{n}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="field">
        <legend>Jour de la sortie longue</legend>
        <div className="chips">
          <label className="chip">
            <input type="radio" name="longDay" checked={longDay === "sam"} onChange={() => setLongDay("sam")} />
            <span>Samedi</span>
          </label>
          <label className="chip">
            <input type="radio" name="longDay" checked={longDay === "dim"} onChange={() => setLongDay("dim")} />
            <span>Dimanche</span>
          </label>
        </div>
      </fieldset>

      <div className="field">
        <label htmlFor="currentKm">Kilomètres courus en ce moment par semaine</label>
        <input
          id="currentKm"
          type="text"
          inputMode="decimal"
          placeholder="Laisse vide si tu ne sais pas"
          value={currentKm}
          onChange={(e) => setCurrentKm(e.target.value)}
        />
        <p className="hint">Ton plan démarre à ce volume et monte progressivement.</p>
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <div className="actions">
        <button type="submit" className="btn btn--primary">
          {initial ? "Recréer mon plan" : "Créer mon plan"}
        </button>
        {onCancel && (
          <button type="button" className="btn" onClick={onCancel}>
            Annuler
          </button>
        )}
      </div>
      {initial && <p className="hint">Recréer le plan efface les séances que tu as déjà validées.</p>}
    </form>
  );
}
