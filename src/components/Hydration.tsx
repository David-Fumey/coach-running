import { useState, type FormEvent } from "react";
import { addDays, type Plan } from "../lib/plan";
import { summarize, type Activity } from "../lib/activities";
import { dayContext, type Profile } from "../lib/nutrition";
import {
  CONDITIONS,
  DEFAULT_WEIGHT_KG,
  MAX_ENTRY_ML,
  MIN_ENTRY_ML,
  QUICK_AMOUNTS,
  calibration,
  conditionsFromTemp,
  duringRange,
  hydrationTargetFromLoss,
  lastActivity,
  measuredLossMl,
  sweatRate,
  progressOf,
  replaceRange,
  sweatLoss,
  totalMl,
  type Conditions,
  type Progress,
  type Water,
  type Weighing,
} from "../lib/hydration";
import { fmtDate, fmtDuration, fmtKm } from "../lib/format";
import { todayISO } from "../storage";
import SweatTest from "./SweatTest";

interface Props {
  plan: Plan;
  done: Record<string, boolean>;
  activities: Activity[];
  profile: Profile | null;
  water: Water[];
  onAdd: (date: string, ml: number) => void;
  onDelete: (id: string) => void;
  onOpenProfile: () => void;
  sweat: Weighing[];
  onAddWeighing: (w: Omit<Weighing, "id">) => void;
  onDeleteWeighing: (id: string) => void;
}

/** 750 → « 750 ml », 1250 → « 1,25 L ». */
function fmtVolume(ml: number): string {
  if (ml < 1000) return `${Math.round(ml)} ml`;
  return `${String(Math.round(ml / 10) / 100).replace(".", ",")} L`;
}

const STATE_TEXT: Record<Progress, string> = {
  debut: "La journée commence : bois régulièrement, un verre à la fois.",
  "en-route": "Tu es en route : continue à boire dans la journée.",
  presque: "Presque : il ne reste plus grand-chose.",
  atteint: "Objectif atteint. Bois ensuite à ta soif.",
  large: "Tu as bu bien plus que prévu : inutile de te forcer, bois à ta soif. Trop d'eau d'un coup n'est pas sans risque.",
};

/** Onglet Hydratation : boissons du jour, besoin selon la séance, eau perdue à la dernière sortie, conseils. */
export default function Hydration({ plan, done, activities, profile, water, onAdd, onDelete, onOpenProfile, sweat, onAddWeighing, onDeleteWeighing }: Props) {
  const today = todayISO();
  const [date, setDate] = useState(today);
  /** Conditions choisies à la main pour la dernière sortie ; null = d'après la température de la montre */
  const [override, setOverride] = useState<Conditions | null>(null);
  const [custom, setCustom] = useState("");
  const [error, setError] = useState("");

  const ctxOf = (d: string) => dayContext(plan, activities, done, d, today);
  const ctx = ctxOf(date);
  const weight = profile?.weightKg ?? DEFAULT_WEIGHT_KG;
  const cal = calibration(sweat);
  const factor = cal?.factor ?? 1;
  /** Eau perdue le jour `d` : sorties courues (avec la température de la montre quand on l'a) ou séance prévue. */
  const lossOn = (d: string): number => {
    const ran = activities.filter((a) => a.date === d);
    if (ran.length > 0) return ran.reduce((s, a) => s + sweatLoss(a.km, weight, conditionsFromTemp(a.temp) ?? "temperee", factor).ml, 0);
    const km = ctxOf(d).km;
    return km > 0 ? sweatLoss(km, weight, "temperee", factor).ml : 0;
  };
  const target = hydrationTargetFromLoss(profile, lossOn(date));
  const drunk = totalMl(water, date);
  const state = progressOf(drunk, target.total);
  const ratio = target.total > 0 ? Math.min(1, drunk / target.total) : 0;
  const entries = water.filter((w) => w.date === date);
  const isToday = date === today;

  function submitCustom(e: FormEvent) {
    e.preventDefault();
    const ml = Number(custom.trim().replace(",", ".").replace(/\s*ml$/i, ""));
    if (!Number.isFinite(ml) || ml < MIN_ENTRY_ML || ml > MAX_ENTRY_ML) {
      return setError(`Indique un volume en ml, entre ${MIN_ENTRY_ML} et ${MAX_ENTRY_ML} (par exemple 400).`);
    }
    setError("");
    setCustom("");
    onAdd(date, Math.round(ml));
  }

  // Les 7 jours qui se terminent à la date affichée : un coup d'œil sur la régularité.
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(date, i - 6);
    const t = hydrationTargetFromLoss(profile, lossOn(d)).total;
    return { date: d, drunk: totalMl(water, d), target: t };
  }).filter((d) => d.date <= today);

  const last = lastActivity(activities, today);
  const conditions: Conditions = override ?? conditionsFromTemp(last?.temp) ?? "temperee";
  const loss = last ? sweatLoss(last.km, weight, conditions, factor) : null;
  // Une pesée de cette sortie vaut mieux que n'importe quelle estimation.
  const weighed = last ? sweat.find((w) => w.date === last.date && Math.abs(w.km - last.km) < 0.05) : undefined;
  const lossMl = weighed ? measuredLossMl(weighed) : (loss?.ml ?? 0);
  const back = last ? replaceRange(lossMl) : null;
  const pace = summarize(plan, activities, done, today).avgPace ?? 6;
  const sessionMinutes = ctx.km > 0 ? ctx.km * pace : 0;
  const during = duringRange(sessionMinutes);

  return (
    <div className="hydration">
      {!profile && (
        <p className="hint">
          Sans profil, je suppose un adulte de {DEFAULT_WEIGHT_KG} kg.{" "}
          <button type="button" className="link" onClick={onOpenProfile}>
            Renseigner mon poids
          </button>{" "}
          pour des repères plus justes.
        </p>
      )}

      <section className="card hydro" aria-labelledby="hydro-title">
        <div className="hydro__nav">
          <button type="button" className="pager__btn" aria-label="Jour précédent" onClick={() => setDate(addDays(date, -1))}>
            ‹
          </button>
          <h2 id="hydro-title" className="card__title">
            {isToday ? "Aujourd'hui" : fmtDate(date, { weekday: "long", day: "numeric", month: "long" })}
          </h2>
          <button type="button" className="pager__btn" aria-label="Jour suivant" disabled={isToday} onClick={() => setDate(addDays(date, 1))}>
            ›
          </button>
        </div>

        <p className="hydro__amount">
          {fmtVolume(drunk)} <small>sur {fmtVolume(target.total)}</small>
        </p>
        <div
          className={`hydro__meter hydro__meter--${state}`}
          role="progressbar"
          aria-label="Eau bue par rapport à l'objectif du jour"
          aria-valuemin={0}
          aria-valuemax={target.total}
          aria-valuenow={Math.min(drunk, target.total)}
        >
          <span style={{ width: `${Math.round(ratio * 100)}%` }} />
        </div>
        <p className="hint">
          Base {fmtVolume(target.base)}
          {target.training > 0 && <> + {fmtVolume(target.training)} pour compenser la transpiration d'environ {fmtKm(Math.round(ctx.km * 10) / 10)} km</>}.
        </p>
        <p className="hydro__state" role="status">
          {STATE_TEXT[state]}
        </p>

        <div className="hydro__quick" role="group" aria-label="Ajouter une boisson">
          {QUICK_AMOUNTS.map((q) => (
            <button key={q.ml} type="button" className="chip-btn" onClick={() => onAdd(date, q.ml)}>
              + {q.ml} ml
              <small>{q.label}</small>
            </button>
          ))}
        </div>

        <form className="hydro__custom" onSubmit={submitCustom} noValidate>
          <div className="field">
            <label htmlFor="hydro-ml">Autre volume (ml)</label>
            <input id="hydro-ml" type="text" inputMode="numeric" placeholder="400" value={custom} onChange={(e) => setCustom(e.target.value)} />
          </div>
          <button type="submit" className="btn">
            Ajouter
          </button>
        </form>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        {entries.length > 0 && (
          <ul className="hydro__entries" aria-label="Boissons du jour">
            {entries.map((w) => (
              <li key={w.id}>
                <span>{fmtVolume(w.ml)}</span>
                <button type="button" className="link link--danger" aria-label={`Supprimer ${w.ml} ml`} onClick={() => onDelete(w.id)}>
                  Supprimer
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {week.length > 1 && (
        <section className="card" aria-labelledby="hydro-week">
          <h2 id="hydro-week" className="card__title">
            Les 7 derniers jours
          </h2>
          <ul className="hydro__week">
            {week.map((d) => {
              const r = d.target > 0 ? Math.min(1.25, d.drunk / d.target) : 0;
              return (
                <li key={d.date}>
                  <button
                    type="button"
                    className="hydro__day"
                    aria-pressed={d.date === date}
                    aria-label={`${fmtDate(d.date, { weekday: "long", day: "numeric", month: "long" })} : ${fmtVolume(d.drunk)} sur ${fmtVolume(d.target)}`}
                    onClick={() => setDate(d.date)}
                  >
                    <span className="hydro__bar" aria-hidden="true">
                      <span className={d.drunk >= d.target ? "is-full" : ""} style={{ height: `${Math.round((r / 1.25) * 100)}%` }} />
                      <i style={{ bottom: `${Math.round((1 / 1.25) * 100)}%` }} />
                    </span>
                    <span className="hydro__label">{fmtDate(d.date, { weekday: "narrow" })}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="hint">Le trait marque l'objectif de chaque jour.</p>
        </section>
      )}

      <section className="card" aria-labelledby="hydro-loss">
        <h2 id="hydro-loss" className="card__title">
          Eau perdue à la dernière sortie
        </h2>
        {last && loss && back ? (
          <>
            <p className="hint">
              {fmtDate(last.date, { weekday: "long", day: "numeric", month: "long" })} · {fmtKm(last.km)} km en {fmtDuration(last.minutes)}
            </p>
            {typeof last.temp === "number" ? (
              <p className="hint">
                Température relevée par ta montre : <strong>{Math.round(last.temp)} °C</strong> (via Strava).{override === null ? "" : " Tu as choisi d'autres conditions."} Une montre au poignet affiche souvent quelques degrés de trop : corrige si besoin.
              </p>
            ) : (
              <p className="hint">{last.source === "strava" ? "Pas de température enregistrée pour cette sortie : choisis les conditions." : "Choisis les conditions de la sortie."}</p>
            )}
            <div className="chips" role="group" aria-label="Conditions de la sortie">
              {(Object.keys(CONDITIONS) as Conditions[]).map((c) => (
                <button key={c} type="button" className="chip-btn" aria-pressed={conditions === c} onClick={() => setOverride(c)}>
                  {CONDITIONS[c].label}
                </button>
              ))}
            </div>
            {weighed ? (
              <>
                <p className="hydro__loss">
                  {fmtVolume(lossMl)} <small>mesurés avec ta pesée ({String(Math.round(sweatRate(weighed) / 10) / 100).replace(".", ",")} L/h)</small>
                </p>
                <p className="hint">Estimation du modèle pour comparer : {fmtVolume(loss.ml)}.</p>
              </>
            ) : (
              <>
                <p className="hydro__loss">
                  ≈ {fmtVolume(loss.ml)} <small>(entre {fmtVolume(loss.low)} et {fmtVolume(loss.high)})</small>
                </p>
                <p className="hint">
                  Cela représente environ {String(loss.percentOfBody).replace(".", ",")} % de ton poids.
                  {loss.percentOfBody >= 2 && " Au-delà de 2 %, l'effort devient plus difficile : pense à boire pendant les prochaines sorties."}
                  {cal && ` Estimation ajustée à toi avec tes ${cal.count} pesée${cal.count > 1 ? "s" : ""} (× ${String(Math.round(cal.factor * 100) / 100).replace(".", ",")}).`}
                </p>
              </>
            )}
            <p>
              À boire dans les 2 à 4 heures suivantes, en plusieurs fois : <strong>{fmtVolume(back.low)} à {fmtVolume(back.high)}</strong>, en plus de ta base.
            </p>
            {!weighed && (
              <p className="hint">
                C'est un ordre de grandeur calculé à partir de la distance, de ton poids et des conditions. Pour connaître ta vraie transpiration, pèse-toi avant et après une sortie : voir la carte « Ma transpiration » plus bas.
              </p>
            )}
          </>
        ) : (
          <p className="hint">Enregistre ou importe une sortie pour estimer l'eau perdue.</p>
        )}
      </section>

      <SweatTest activities={activities} profile={profile} sweat={sweat} cal={cal} onAdd={onAddWeighing} onDelete={onDeleteWeighing} />

      <section className="card hydro-tips" aria-labelledby="hydro-tips">
        <h2 id="hydro-tips" className="card__title">
          Conseils d'hydratation
        </h2>

        <h3 className="topic__sub">Avant</h3>
        <ul className="tips">
          <li>Un grand verre d'eau (300 à 500 ml) environ 2 heures avant, puis quelques gorgées juste avant de partir.</li>
          <li>Avant une sortie longue, arrive déjà bien hydraté : urines jaune pâle la veille et le matin.</li>
        </ul>

        <h3 className="topic__sub">Pendant</h3>
        <ul className="tips">
          <li>Sortie de moins d'une heure : bois à la soif, sans te forcer.</li>
          {during && (
            <li>
              Pour ta séance du jour (environ {fmtDuration(sessionMinutes)}) : <strong>{fmtVolume(during.low)} à {fmtVolume(during.high)}</strong> en tout, par petites gorgées toutes les 15 à 20 minutes.
            </li>
          )}
          <li>Au-delà d'une heure ou par temps chaud : 400 à 800 ml par heure, avec une boisson contenant 0,5 à 0,7 g de sodium par litre.</li>
        </ul>

        <h3 className="topic__sub">Après</h3>
        <ul className="tips">
          <li>Dans les 2 à 4 heures : 120 à 150 % de ce que tu as perdu (voir l'estimation ci-dessus), en plusieurs fois.</li>
          <li>Un repas un peu salé ou un bouillon aide le corps à retenir l'eau.</li>
        </ul>

        <h3 className="topic__sub">Au quotidien</h3>
        <ul className="tips">
          <li>Bois régulièrement dans la journée plutôt que beaucoup d'un coup. Des urines jaune pâle sont un bon repère.</li>
          <li>Thé et café comptent dans tes boissons, avec modération.</li>
        </ul>

        <h3 className="topic__sub">À surveiller</h3>
        <ul className="tips tips--watch">
          <li>Plus de boisson n'est pas mieux : boire bien au-delà de ses pertes pendant un effort long peut faire chuter le sodium dans le sang (hyponatrémie).</li>
          <li>Maux de tête, nausées, doigts gonflés ou confusion pendant ou après un effort long : arrête de boire de l'eau seule et demande conseil à un professionnel de santé.</li>
          <li>Chaleur intense, vertiges ou arrêt de la transpiration : arrête, mets-toi à l'ombre et appelle de l'aide si cela ne passe pas.</li>
        </ul>

        <p className="hint">
          Repères tirés des recommandations de l'ACSM sur l'hydratation à l'effort (2007), des apports en eau de l'EFSA et du consensus sur l'hyponatrémie à l'effort. Ce sont des repères généraux : ils ne remplacent pas l'avis d'un médecin, surtout en cas de maladie, de traitement ou de grossesse.
        </p>
      </section>
    </div>
  );
}
