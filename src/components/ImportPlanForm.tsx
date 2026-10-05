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
2026-10-08 ; Fractionnés en km ; 9
Échauffement
- 1,5 km, pas plus vite que 7:30/km
Répéter 3x
- 1 km à 7:05/km
- 1 km à 6:30/km
Repos
- Marche 90 s
Retour au calme
- 1,5 km conversationnelle`;

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
        <details className="hint import-help">
          <summary>Ajouter le déroulé d'une séance (allures, répétitions, marche)</summary>
          <p>
            Sous la ligne d'une séance, une ligne sans tiret ouvre un bloc (« Échauffement », « Répéter 3x », « Repos », « Retour au calme »…) et chaque étape est une ligne avec un tiret : distance ou durée, puis l'allure.
            Allures acceptées : « à 7:05/km », « 6:30-7:00 », « pas plus vite que 7:30/km » (ou « &gt;= 7:30 »), « conversationnelle ». « Marche 90 s » ou « Marche de repos 90 s » pour la marche. Ce qui suit « | » est une consigne affichée sous l'étape. Sans bloc, les étapes forment un bloc « Séance ».
          </p>
        </details>
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
