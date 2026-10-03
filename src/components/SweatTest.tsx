import { useState, type FormEvent } from "react";
import { byDateDesc, type Activity } from "../lib/activities";
import type { Profile } from "../lib/nutrition";
import {
  CONDITIONS,
  MIN_WEIGHING_MINUTES,
  conditionsFromTemp,
  measuredLossMl,
  sweatLoss,
  sweatRate,
  validateWeighing,
  weighingRatio,
  type Calibration,
  type Conditions,
  type Weighing,
} from "../lib/hydration";
import { fmtDate, fmtDuration, fmtKm } from "../lib/format";

interface Props {
  activities: Activity[];
  profile: Profile | null;
  sweat: Weighing[];
  cal: Calibration | null;
  onAdd: (w: Omit<Weighing, "id">) => void;
  onDelete: (id: string) => void;
}

const fmtMl = (ml: number) => (ml < 1000 ? `${Math.round(ml)} ml` : `${String(Math.round(ml / 10) / 100).replace(".", ",")} L`);
const fmtX = (x: number) => String(Math.round(x * 100) / 100).replace(".", ",");
const num = (s: string) => Number(s.trim().replace(",", "."));

/** Étalonnage de la transpiration : on se pèse avant et après une sortie, l'estimation du modèle s'ajuste à soi. */
export default function SweatTest({ activities, profile, sweat, cal, onAdd, onDelete }: Props) {
  const weighed = (a: Activity) => sweat.some((w) => w.date === a.date && Math.abs(w.km - a.km) < 0.05);
  const candidates = [...activities]
    .filter((a) => a.minutes >= MIN_WEIGHING_MINUTES && !weighed(a))
    .sort(byDateDesc)
    .slice(0, 10);

  const [actId, setActId] = useState("");
  const [before, setBefore] = useState(profile ? String(profile.weightKg).replace(".", ",") : "");
  const [after, setAfter] = useState("");
  const [drank, setDrank] = useState("0");
  const [override, setOverride] = useState<Conditions | null>(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");

  const act = candidates.find((a) => a.id === actId) ?? candidates[0];
  const conditions: Conditions = override ?? conditionsFromTemp(act?.temp) ?? "temperee";

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!act) return;
    const w = { date: act.date, km: act.km, minutes: act.minutes, before: num(before), after: num(after), drankMl: num(drank || "0"), conditions };
    const problem = validateWeighing(w);
    if (problem) {
      setResult("");
      return setError(problem);
    }
    setError("");
    const measured = measuredLossMl(w);
    const modeled = sweatLoss(w.km, w.before, w.conditions).ml;
    setResult(
      `Enregistré : ${fmtMl(measured)} perdus en ${fmtDuration(w.minutes)}, soit ${fmtX(sweatRate(w) / 1000)} L/h. Le modèle estimait ${fmtMl(modeled)} (${weighingRatio(w) >= 1 ? "+" : "−"}${Math.round(Math.abs(weighingRatio(w) - 1) * 100)} % d'écart).`
    );
    onAdd(w);
    setAfter("");
    setDrank("0");
    setOverride(null);
    setActId("");
  }

  return (
    <section className="card sweat" aria-labelledby="sweat-title">
      <h2 id="sweat-title" className="card__title">
        Ma transpiration
      </h2>
      <p className="hint">
        Pèse-toi avant et après une sortie pour mesurer ce que tu perds vraiment. Les estimations de l'onglet s'ajustent alors à toi, d'autant mieux que tu répètes la mesure (en conditions variées).
      </p>

      {cal && (
        <p className="notice" role="status">
          Tu transpires en moyenne <strong>{fmtX(cal.ratePerHour / 1000)} L/h</strong>. Ajustement appliqué aux estimations : <strong>× {fmtX(cal.factor)}</strong> ({cal.count} pesée{cal.count > 1 ? "s" : ""}
          {cal.trust < 1 && ", appliqué en partie : trois pesées donnent un résultat complet"}).
        </p>
      )}

      <details className="sweat__how">
        <summary>Comment se peser</summary>
        <ol className="steps">
          <li>Avant de partir, après être passé aux toilettes, pèse-toi (nu ou avec la même tenue) sur la même balance.</li>
          <li>Pendant la sortie, note ce que tu bois, en ml.</li>
          <li>Au retour, retire les vêtements mouillés, essuie la sueur et pèse-toi tout de suite.</li>
          <li>Choisis la sortie ci-dessous et entre les deux poids.</li>
        </ol>
        <p className="hint">
          Il faut au moins {MIN_WEIGHING_MINUTES} minutes de course : sur moins, l'écart se perd dans la précision de la balance. La mesure inclut un peu d'eau perdue par la respiration, c'est normal.
        </p>
      </details>

      {candidates.length === 0 ? (
        <p className="hint">Enregistre ou importe une sortie d'au moins {MIN_WEIGHING_MINUTES} minutes pour y associer une pesée.</p>
      ) : (
        <form className="sweat__form" onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="sw-act">Sortie</label>
            <select id="sw-act" value={act?.id} onChange={(e) => { setActId(e.target.value); setOverride(null); }}>
              {candidates.map((a) => (
                <option key={a.id} value={a.id}>
                  {fmtDate(a.date, { weekday: "short", day: "numeric", month: "short" })} · {fmtKm(a.km)} km · {fmtDuration(a.minutes)}
                  {typeof a.temp === "number" ? ` · ${Math.round(a.temp)} °C` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="sw-before">Poids avant (kg)</label>
              <input id="sw-before" type="text" inputMode="decimal" placeholder="68,4" value={before} onChange={(e) => setBefore(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="sw-after">Poids après (kg)</label>
              <input id="sw-after" type="text" inputMode="decimal" placeholder="67,6" value={after} onChange={(e) => setAfter(e.target.value)} />
            </div>
          </div>

          <div className="field">
            <label htmlFor="sw-drank">Bu pendant la sortie (ml)</label>
            <input id="sw-drank" type="text" inputMode="numeric" value={drank} onChange={(e) => setDrank(e.target.value)} />
          </div>

          <div className="field">
            <span className="field__label">Conditions</span>
            <div className="chips" role="group" aria-label="Conditions de la sortie">
              {(Object.keys(CONDITIONS) as Conditions[]).map((c) => (
                <button key={c} type="button" className="chip-btn" aria-pressed={conditions === c} onClick={() => setOverride(c)}>
                  {CONDITIONS[c].label}
                </button>
              ))}
            </div>
            {typeof act?.temp === "number" && override === null && <p className="hint">D'après la température de ta montre ({Math.round(act.temp)} °C).</p>}
          </div>

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="actions">
            <button type="submit" className="btn btn--primary">
              Enregistrer la pesée
            </button>
          </div>
        </form>
      )}

      {result && (
        <p className="notice" role="status">
          {result}
        </p>
      )}

      {sweat.length > 0 && (
        <ul className="sweat__list" aria-label="Mes pesées">
          {[...sweat]
            .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
            .map((w) => (
              <li key={w.id}>
                <div>
                  <strong>{fmtMl(measuredLossMl(w))}</strong> · {fmtX(sweatRate(w) / 1000)} L/h
                  <small>
                    {fmtDate(w.date, { day: "numeric", month: "short" })} · {fmtKm(w.km)} km · {CONDITIONS[w.conditions].label.split(" (")[0].toLowerCase()} · modèle {weighingRatio(w) >= 1 ? "+" : "−"}
                    {Math.round(Math.abs(weighingRatio(w) - 1) * 100)} %
                  </small>
                </div>
                <button type="button" className="link link--danger" onClick={() => window.confirm("Supprimer cette pesée ?") && onDelete(w.id)}>
                  Supprimer
                </button>
              </li>
            ))}
        </ul>
      )}
    </section>
  );
}
