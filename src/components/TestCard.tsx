import { useState, type FormEvent } from "react";
import type { Plan } from "../lib/plan";
import type { Activity } from "../lib/activities";
import type { PaceModel } from "../lib/paces";
import { zoneRange } from "../lib/paces";
import { latestTest, nextTestSession, parseTestTime, pendingTest, type TestResult } from "../lib/tests";
import { fmtClock, fmtDate } from "../lib/format";
import { fmtRange } from "./PaceCard";
import { todayISO } from "../storage";

interface Props {
  plan: Plan;
  activities: Activity[];
  tests: TestResult[];
  /** Modèle d'allures actuel */
  model: PaceModel | null;
  /** Modèle d'allures qu'on aurait avec ce temps sur 5 km (pour montrer l'effet avant d'enregistrer) */
  preview: (minutes: number) => PaceModel | null;
  /** Allure moyenne saisie à la main : elle reste prioritaire sur le test */
  manualPace: boolean;
  onSave: (result: { date: string; minutes: number; sessionId?: string }) => void;
  onDelete: (id: string) => void;
  /** Accueil : seulement l'invitation à renseigner le temps ; Programme : aussi le dernier test et le prochain */
  summary: boolean;
}

const easyOf = (m: PaceModel | null) => (m ? `${fmtRange(zoneRange(m.vdot, "facile"))} /km` : null);

/** Test de 5 km : saisie du temps après la séance, effet sur les allures, historique. */
export default function TestCard({ plan, activities, tests, model, preview, manualPace, onSave, onDelete, summary }: Props) {
  const today = todayISO();
  const pending = pendingTest(plan, activities, tests, today);
  const last = latestTest(tests);
  const next = nextTestSession(plan, today);
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  function saveMinutes(minutes: number) {
    if (!pending) return;
    onSave({ date: pending.session.date, minutes, sessionId: pending.session.id });
    setText("");
    setError("");
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const minutes = parseTestTime(text);
    if (minutes === null) return setError("Indique ton temps sur les 5 km entre 15:00 et 60:00, par exemple 24:30.");
    saveMinutes(minutes);
  }

  function effect(minutes: number) {
    const before = easyOf(model);
    const after = easyOf(preview(minutes));
    if (!after) return null;
    return (
      <p className="hint">
        {before && before !== after ? <>Ton allure facile passerait de {before} à <strong>{after}</strong>.</> : <>Ton allure facile serait de <strong>{after}</strong>.</>}
        {manualPace && " Attention : l'allure moyenne saisie à la main reste prioritaire sur le test."}
      </p>
    );
  }

  if (pending) {
    const when = fmtDate(pending.session.date, { weekday: "long", day: "numeric", month: "long" });
    return (
      <section className="card test-card" aria-labelledby="test-title">
        <p className="eyebrow">
          <span id="test-title">Test de 5 km</span>
        </p>
        <h2 className="card__title">Quel a été ton temps ?</h2>
        <p className="hint">Séance du {when}. Ton temps sur les 5 km chronométrés recale tes allures cibles.</p>
        {pending.stravaMinutes !== undefined && (
          <div className="test-card__strava">
            <p>
              Strava a relevé <strong>{fmtClock(pending.stravaMinutes)}</strong> sur ton meilleur 5 km de cette sortie.
            </p>
            {effect(pending.stravaMinutes)}
            <div className="actions">
              <button type="button" className="btn btn--primary" onClick={() => saveMinutes(pending.stravaMinutes!)}>
                Utiliser ce temps
              </button>
            </div>
            <p className="hint">Si ton test n'est pas ce meilleur 5 km, saisis ton temps ci-dessous.</p>
          </div>
        )}
        {pending.stravaMinutes === undefined && pending.activity && (
          <p className="hint">Strava n'a pas encore détaillé cette sortie : relance la synchronisation depuis le Profil, ou saisis ton temps.</p>
        )}
        <form className="test-card__form" onSubmit={submit}>
          <div className="field">
            <label htmlFor="test-time">Temps sur les 5 km</label>
            <input id="test-time" type="text" inputMode="numeric" placeholder="24:30" value={text} onChange={(e) => setText(e.target.value)} />
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="actions">
            <button type="submit" className="btn">
              Enregistrer
            </button>
          </div>
        </form>
      </section>
    );
  }

  if (!summary || (!last && !next)) return null;
  return (
    <section className="card test-card" aria-labelledby="test-sum-title">
      <h2 id="test-sum-title" className="card__title">Mon test de 5 km</h2>
      {last ? (
        <>
          <p>
            Dernier test : <strong>{fmtClock(last.minutes)}</strong> le {fmtDate(last.date, { day: "numeric", month: "long" })}.
          </p>
          <p className="hint">
            {model?.reference.source === "test"
              ? "Tes allures cibles s'appuient sur ce test."
              : manualPace
                ? "Ton allure moyenne saisie à la main reste prioritaire : le test n'est pas utilisé."
                : "Ce test date de plus de 12 semaines : tes allures s'appuient sur tes sorties récentes."}
          </p>
          <div className="actions">
            <button type="button" className="link" onClick={() => onDelete(last.id)}>
              Supprimer ce résultat
            </button>
          </div>
        </>
      ) : (
        <p className="hint">Aucun test enregistré. Le test donne une base plus précise que la moyenne de tes sorties.</p>
      )}
      {next && (
        <p className="hint">
          Prochain test : {fmtDate(next.date, { weekday: "long", day: "numeric", month: "long" })}. Il recalera tes allures.
        </p>
      )}
    </section>
  );
}
