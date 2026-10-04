import { useState, type FormEvent } from "react";
import type { Plan } from "../lib/plan";
import type { Activity } from "../lib/activities";
import type { PaceModel } from "../lib/paces";
import { zoneRange } from "../lib/paces";
import { TEST30_MINUTES, latestTest, nextTestSession, parseTestDistance, parseTestTime, pendingTest, testKindOf, testKm, type TestResult } from "../lib/tests";
import { fmtClock, fmtDate, fmtKm } from "../lib/format";
import { fmtRange } from "./PaceCard";
import { todayISO } from "../storage";

interface Props {
  plan: Plan;
  activities: Activity[];
  tests: TestResult[];
  /** Modèle d'allures actuel */
  model: PaceModel | null;
  /** Modèle d'allures qu'on aurait avec ce résultat (pour montrer l'effet avant d'enregistrer) */
  preview: (minutes: number, km?: number) => PaceModel | null;
  /** Allure moyenne saisie à la main : elle reste prioritaire sur le test */
  manualPace: boolean;
  onSave: (result: { date: string; minutes: number; km?: number; sessionId?: string }) => void;
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

  const thirty = pending?.kind === "30min";

  function saveMinutes(minutes: number) {
    if (!pending) return;
    onSave({ date: pending.session.date, minutes, sessionId: pending.session.id });
    setText("");
    setError("");
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!pending) return;
    if (thirty) {
      const km = parseTestDistance(text);
      if (km === null) return setError("Indique la distance parcourue en 30 minutes, entre 2,5 et 10 km, par exemple 6,8.");
      onSave({ date: pending.session.date, minutes: TEST30_MINUTES, km, sessionId: pending.session.id });
      setText("");
      setError("");
      return;
    }
    const minutes = parseTestTime(text);
    if (minutes === null) return setError("Indique ton temps sur les 5 km entre 15:00 et 60:00, par exemple 24:30.");
    saveMinutes(minutes);
  }

  function effect(minutes: number, km?: number) {
    const before = easyOf(model);
    const after = easyOf(preview(minutes, km));
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
          <span id="test-title">{thirty ? "Test de 30 minutes" : "Test de 5 km"}</span>
        </p>
        <h2 className="card__title">{thirty ? "Quelle distance as-tu parcourue ?" : "Quel a été ton temps ?"}</h2>
        <p className="hint">
          Séance du {when}. {thirty ? "La distance parcourue pendant les 30 minutes à fond recale tes allures cibles (ta montre l'indique)." : "Ton temps sur les 5 km chronométrés recale tes allures cibles."}
        </p>
        {!thirty && pending.stravaMinutes !== undefined && (
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
        {!thirty && pending.stravaMinutes === undefined && pending.activity && (
          <p className="hint">Strava n'a pas encore détaillé cette sortie : relance la synchronisation depuis le Profil, ou saisis ton temps.</p>
        )}
        <form className="test-card__form" onSubmit={submit}>
          <div className="field">
            <label htmlFor="test-time">{thirty ? "Distance parcourue en 30 minutes (km)" : "Temps sur les 5 km"}</label>
            <input id="test-time" type="text" inputMode={thirty ? "decimal" : "numeric"} placeholder={thirty ? "6,8" : "24:30"} value={text} onChange={(e) => setText(e.target.value)} />
            {thirty && text.trim() !== "" && parseTestDistance(text) !== null && effect(TEST30_MINUTES, parseTestDistance(text)!)}
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
      <h2 id="test-sum-title" className="card__title">Mon test de contrôle</h2>
      {last ? (
        <>
          <p>
            Dernier test : <strong>{last.km !== undefined ? `${fmtKm(testKm(last))} km en 30 min` : `5 km en ${fmtClock(last.minutes)}`}</strong> le {fmtDate(last.date, { day: "numeric", month: "long" })}.
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
          Prochain test ({testKindOf(next) === "30min" ? "30 minutes à fond" : "5 km chronométré"}) : {fmtDate(next.date, { weekday: "long", day: "numeric", month: "long" })}. Il recalera tes allures.
        </p>
      )}
    </section>
  );
}
