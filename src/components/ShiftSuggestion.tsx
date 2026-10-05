import { addDays, type Plan } from "../lib/plan";
import type { Activity } from "../lib/activities";
import { missedStreak } from "../lib/shift";
import { fmtDate } from "../lib/format";
import { todayISO, useStoredState } from "../storage";

interface Props {
  plan: Plan;
  done: Record<string, boolean>;
  activities: Activity[];
  /** Décale le programme ; retourne un message d'erreur ou null */
  onShift: (weeks: number) => string | null;
}

/** Proposition de décalage après plusieurs séances manquées d'affilée (fermée jusqu'à la prochaine séance manquée). */
export default function ShiftSuggestion({ plan, done, activities, onShift }: Props) {
  const [seen, setSeen] = useStoredState<string>("foulee.shiftseen.v1", "");
  const m = missedStreak(plan, done, activities, todayISO());
  if (!m || m.lastDate <= seen) return null;
  const w = m.suggestedWeeks;

  function accept() {
    if (!m || !window.confirm(`Décaler le programme de ${w} semaine${w > 1 ? "s" : ""} ? ${plan.source ? `Tout le programme est décalé et la course passe au ${fmtDate(addDays(plan.input.raceDate, 7 * w), { day: "numeric", month: "long" })}.` : "Les séances à venir seront remplacées et le plan recalculé jusqu'à la course."}`)) return;
    const err = onShift(w);
    if (err) window.alert(err);
  }

  return (
    <aside className="loss-banner shift-suggest" role="status" aria-label="Séances manquées">
      <div className="loss-banner__text">
        <p className="loss-banner__title">{m.count} séances manquées d'affilée</p>
        <p className="loss-banner__detail">
          Depuis le {fmtDate(m.firstDate, { weekday: "long", day: "numeric", month: "long" })}, aucune séance n'est validée. Une pause de <strong>{w} semaine{w > 1 ? "s" : ""}</strong> permet de reprendre
          sans te forcer à rattraper : {plan.source ? "" : "la date de la course ne bouge pas, "}{plan.source ? "tout le programme est décalé, la course aussi." : "le plan est recalculé."}
        </p>
        <div className="loss-banner__actions">
          <button type="button" className="btn btn--primary" onClick={accept}>
            Décaler de {w} semaine{w > 1 ? "s" : ""}
          </button>
          <button type="button" className="link" onClick={() => setSeen(m.lastDate)}>
            Plus tard
          </button>
        </div>
      </div>
    </aside>
  );
}
