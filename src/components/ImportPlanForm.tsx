import { useState, type FormEvent } from "react";
import { RACES, type Plan, type RaceKey } from "../lib/plan";
import { buildImportedPlan, parseSessions } from "../lib/planimport";
import { todayISO } from "../storage";

interface Props {
  /** Un plan existe déjà : le nouveau le remplace, on le dit */
  hasPlan: boolean;
  onSubmit: (plan: Plan) => void;
  onCancel: () => void;
}

const EXAMPLE = `2026-10-06 ; Course facile de 10 km ; 10
2026-10-08 ; Fractionnés ; 9
2026-10-11 ; Sortie longue progressive ; 16`;

/** Reprise d'un plan créé ailleurs : on colle les séances, une par ligne. */
export default function ImportPlanForm({ hasPlan, onSubmit, onCancel }: Props) {
  const [race, setRace] = useState<RaceKey>("semi");
  const [raceDate, setRaceDate] = useState("");
  const [source, setSource] = useState("Runna");
  const [text, setText] = useState("");
  const [errors, setErrors] = useState<string[]>([]);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!raceDate) return setErrors(["Choisis la date de ta course."]);
    const parsed = parseSessions(text);
    if (!parsed.ok) return setErrors(parsed.errors.slice(0, 6));
    try {
      const plan = buildImportedPlan(parsed.sessions, { race, raceDate, text, source: source.trim() || "d'origine", today: todayISO() });
      if (hasPlan && !window.confirm("Ce plan remplace ton plan actuel. Tes activités et tes séances cochées sont gardées. Continuer ?")) return;
      setErrors([]);
      onSubmit(plan);
    } catch (err) {
      setErrors([err instanceof Error ? err.message : "Impossible de reprendre ce plan."]);
    }
  }

  return (
    <form className="setup" onSubmit={submit} noValidate>
      <header className="setup__intro">
        <h1 className="brand">Reprendre un plan</h1>
        <p className="lead">Tu suis déjà un plan ailleurs (Runna, un coach, un tableau) ? Colle ses séances : Runner les garde telles quelles et y ajoute le suivi, la nutrition et les progrès.</p>
      </header>

      <div className="field">
        <label htmlFor="imp-race">Course visée</label>
        <select id="imp-race" value={race} onChange={(e) => setRace(e.target.value as RaceKey)}>
          {(Object.keys(RACES) as RaceKey[]).map((k) => (
            <option key={k} value={k}>
              {RACES[k].label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="imp-date">Date de la course</label>
        <input id="imp-date" type="date" value={raceDate} onChange={(e) => setRaceDate(e.target.value)} />
      </div>

      <div className="field">
        <label htmlFor="imp-source">Plan d'origine</label>
        <input id="imp-source" type="text" value={source} onChange={(e) => setSource(e.target.value)} />
      </div>

      <div className="field">
        <label htmlFor="imp-text">Séances, une par ligne</label>
        <textarea id="imp-text" rows={10} spellCheck={false} placeholder={EXAMPLE} value={text} onChange={(e) => setText(e.target.value)} />
        <p className="hint">
          Format : date (AAAA-MM-JJ) ; titre ; kilomètres. Les séances après la course ne sont pas reprises, les lignes qui commencent par # sont ignorées.
        </p>
      </div>

      {errors.length > 0 && (
        <ul className="warnings" role="alert">
          {errors.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}

      <div className="actions">
        <button type="submit" className="btn btn--primary">
          Reprendre ce plan
        </button>
        <button type="button" className="btn" onClick={onCancel}>
          Annuler
        </button>
      </div>
    </form>
  );
}
