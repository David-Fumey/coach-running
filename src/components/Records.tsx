import type { Activity } from "../lib/activities";
import { currentStreak, distanceRecords, highlights, isRecent, type Highlight } from "../lib/records";
import { fmtClock, fmtDate, fmtDuration, fmtKm, fmtPace } from "../lib/format";

interface Props {
  /** Activités de la portée choisie dans Progrès */
  activities: Activity[];
  today: string;
  /** Rappel de ce que couvre la portée, pour le titre */
  scopeLabel: string;
}

const round1 = (x: number) => Math.round(x * 10) / 10;
const day = (iso: string) => fmtDate(iso, { day: "numeric", month: "short", year: "numeric" });

function valueOf(h: Highlight): string {
  switch (h.unit) {
    case "km":
      return `${fmtKm(round1(h.value))} km`;
    case "min":
      return fmtDuration(h.value);
    case "min/km":
      return `${fmtPace(h.value)} /km`;
    case "m":
      return `${Math.round(h.value).toLocaleString("fr-FR")} m`;
    case "semaines":
      return `${h.value} semaines`;
  }
}

function whenOf(h: Highlight): string {
  if (!h.endDate) return day(h.date);
  return `du ${fmtDate(h.date, { day: "numeric", month: "short" })} au ${day(h.endDate)}`;
}

/** Records personnels : meilleurs temps sur 5 km, 10 km, semi et marathon, puis les autres repères. */
export default function Records({ activities, today, scopeLabel }: Props) {
  if (activities.length === 0) return null;
  const distances = distanceRecords(activities);
  const others = highlights(activities);
  const streak = currentStreak(activities, today);

  return (
    <section className="card records-card" aria-labelledby="records-title">
      <h2 id="records-title" className="card__title">
        Records personnels
      </h2>
      <p className="hint records__scope">{scopeLabel}</p>

      <h3 className="topic__sub">Distances</h3>
      <ul className="records">
        {distances.map((r) =>
          r.best ? (
            <li key={r.id} className="record">
              <div className="record__main">
                <span className="record__label">
                  {r.label}
                  {isRecent(r.best.date, today) && <span className="tag">Récent</span>}
                </span>
                <span className="record__value">
                  {!r.best.exact && <abbr title={`Temps ramené à ${r.label} depuis une sortie de ${fmtKm(round1(r.best.km))} km`}>≈ </abbr>}
                  {fmtClock(r.best.minutes)}
                </span>
              </div>
              <p className="record__meta">
                {day(r.best.date)} · {fmtPace(r.best.minutes / r.km)} /km
                {r.previous !== null && r.previous - r.best.minutes > 1 / 60 && <> · {fmtClock(r.previous - r.best.minutes)} de mieux que le record précédent</>}
                {r.attempts > 1 && <> · {r.attempts} sorties</>}
              </p>
            </li>
          ) : (
            <li key={r.id} className="record record--empty">
              <div className="record__main">
                <span className="record__label">{r.label}</span>
                <span className="record__value">–</span>
              </div>
              <p className="record__meta">Pas encore de sortie de cette distance.</p>
            </li>
          )
        )}
      </ul>

      {others.length > 0 && (
        <>
          <h3 className="topic__sub">Autres repères</h3>
          <ul className="records">
            {others.map((h) => (
              <li key={h.id} className="record">
                <div className="record__main">
                  <span className="record__label">
                    {h.label}
                    {isRecent(h.endDate ?? h.date, today) && <span className="tag">Récent</span>}
                  </span>
                  <span className="record__value">{valueOf(h)}</span>
                </div>
                <p className="record__meta">{whenOf(h)}</p>
              </li>
            ))}
          </ul>
        </>
      )}

      {streak >= 2 && (
        <p className="notice" role="status">
          Série en cours : {streak} semaines de suite avec au moins une sortie.
        </p>
      )}

      <p className="hint">
        Un record de distance vient d'une sortie proche de cette distance (de 2 % en dessous à 6 % au-dessus). Le signe « ≈ » indique un temps ramené à la distance exacte. Foulée ne connaît pas les temps intermédiaires : le meilleur 5 km au milieu d'une sortie plus longue n'est pas détecté.
      </p>
    </section>
  );
}
