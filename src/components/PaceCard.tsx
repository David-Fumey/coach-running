import { useState, type FormEvent } from "react";
import type { Plan, Session } from "../lib/plan";
import { parseMinutes } from "../lib/activities";
import { RECENT_DAYS, MIN_RUNS, MIN_RUN_KM, ZONES, ZONE_ORDER, comparePace, isValidPace, targetsFor, zoneRange, type PaceModel, type PaceRange } from "../lib/paces";
import { fmtKm, fmtPace, fmtTargetPace } from "../lib/format";

/** « 5:25–5:35 » : l'allure la plus rapide d'abord. */
export const fmtRange = (r: PaceRange) => `${fmtTargetPace(r.fast)}–${fmtTargetPace(r.slow)}`;

const ZONE_HINT: Record<(typeof ZONE_ORDER)[number], string> = {
  recuperation: "Récupération, lendemain de séance dure",
  facile: "Footings et sorties longues",
  marathon: "Blocs spécifiques du marathon",
  semi: "Blocs spécifiques du semi",
  seuil: "Tempo",
  "10k": "Fractionné de construction",
  "5k": "Allure de course sur 5 km",
};

/** Ligne « allure cible » d'une séance, ou rien si le ressenti suffit (fartlek, course) ou s'il manque une référence. */
export function PaceLine({ plan, model, session }: { plan: Plan; model: PaceModel | null; session: Session }) {
  if (!model) return null;
  const t = targetsFor(model, plan, session);
  if (!t) return null;
  return (
    <p className="session__pace">
      <span className="session__pace-label">Allure cible</span>{" "}
      {t.targets.map((x, i) => (
        <span key={x.label} className="session__pace-item">
          {i > 0 && " · "}
          {t.targets.length > 1 && <>{x.label} </>}
          <strong>{fmtRange(x)} /km</strong>
        </span>
      ))}
    </p>
  );
}

interface Props {
  model: PaceModel | null;
  /** Allure saisie à la main, null si elle est calculée */
  manual: number | null;
  onChangeManual: (pace: number | null) => void;
}

/** Carte repliable « Mes allures cibles » : d'où elles viennent, la table par type d'effort, et le réglage manuel. */
export default function PaceCard({ model, manual, onChangeManual }: Props) {
  const [text, setText] = useState(manual !== null ? fmtPace(manual) : "");
  const [error, setError] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    const minutes = parseMinutes(text);
    if (minutes === null || !isValidPace(minutes)) return setError("Indique une allure entre 3:00 et 12:00 par km, par exemple 6:05.");
    setError("");
    onChangeManual(Math.round(minutes * 60) / 60);
  }

  const easy = model ? zoneRange(model.vdot, "facile") : null;
  const ref = model?.reference;

  return (
    <details className="card pace-card">
      <summary>
        <h2 className="card__title">Mes allures cibles</h2>
        <span className="pace-card__preview">{easy ? `Facile ${fmtRange(easy)} /km` : "Pas encore estimées"}</span>
      </summary>

      <div className="pace-card__body">
        {ref ? (
          <p className="hint">
            {ref.source === "objectif" && <>Calculées à partir de ton temps objectif, faute de sorties enregistrées. Dès que tu auras couru, elles s'appuieront sur tes sorties.</>}
            {ref.source === "manuelle" && <>Calculées à partir de l'allure moyenne que tu as saisie : {fmtPace(ref.pace)} /km.</>}
            {ref.source === "recentes" && (
              <>
                Calculées à partir de tes {ref.runs} sorties des {RECENT_DAYS / 7} dernières semaines ({fmtKm(Math.round(ref.km))} km) : allure moyenne {fmtPace(ref.pace)} /km.
              </>
            )}
            {ref.source === "dernieres" && (
              <>
                Calculées à partir de tes {ref.runs} dernières sorties ({fmtKm(Math.round(ref.km))} km) : allure moyenne {fmtPace(ref.pace)} /km.
              </>
            )}
          </p>
        ) : (
          <p className="hint">
            Il faut au moins {MIN_RUNS} sorties de {MIN_RUN_KM} km ou plus pour estimer tes allures. Enregistre-les, importe-les depuis Strava, ou saisis ton allure moyenne ci-dessous.
          </p>
        )}

        {model && (
          <ul className="pace-table">
            {ZONE_ORDER.map((z) => (
              <li key={z}>
                <span className="pace-table__zone">
                  {ZONES[z].label}
                  <small>{ZONE_HINT[z]}</small>
                </span>
                <span className="pace-table__range">{fmtRange(zoneRange(model.vdot, z))} /km</span>
              </li>
            ))}
          </ul>
        )}

        <form className="pace-card__form" onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="pace-ref">Mon allure moyenne d'entraînement (min/km)</label>
            <input id="pace-ref" type="text" inputMode="numeric" placeholder="6:05" value={text} onChange={(e) => setText(e.target.value)} />
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="actions">
            <button type="submit" className="btn">
              Utiliser cette allure
            </button>
            {manual !== null && (
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setText("");
                  setError("");
                  onChangeManual(null);
                }}
              >
                Revenir au calcul sur mes sorties
              </button>
            )}
          </div>
        </form>

        <p className="hint">
          Ce sont des repères estimés, pas des prescriptions : si tu ne fais que du facile, ils seront un peu lents ; si tu cours toujours vite, un peu rapides. L'effort ressenti prime, et la saisie manuelle corrige l'écart. Les échauffements, les récupérations entre répétitions et le fartlek restent au ressenti.
        </p>
      </div>
    </details>
  );
}

/** Compare l'allure d'une sortie à la cible de sa séance (seulement quand la sortie entière est comparable). */
export function PaceCheck({ plan, model, session, pace }: { plan: Plan; model: PaceModel | null; session: Session; pace: number }) {
  if (!model) return null;
  const t = targetsFor(model, plan, session);
  if (!t || !t.comparable) return null;
  const target = t.targets[0];
  const c = comparePace(pace, target);
  const verdict =
    c.verdict === "dans" ? "dans la cible" : c.verdict === "rapide" ? `${c.seconds} s/km plus vite que la cible` : `${c.seconds} s/km plus lent que la cible`;
  return (
    <p className={`activity__pace activity__pace--${c.verdict}`}>
      Cible {fmtRange(target)} /km · {verdict}
    </p>
  );
}
