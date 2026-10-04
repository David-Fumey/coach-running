import type { Plan } from "../lib/plan";
import { restDay } from "../lib/rest";
import { fmtDate } from "../lib/format";

/** Accueil : conseils du jour quand le plan prévoit du repos. */
export default function RestCard({ plan, today }: { plan: Plan; today: string }) {
  const rest = restDay(plan, today);
  if (!rest) return null;
  return (
    <section className="card rest-card" aria-labelledby="rest-title">
      <p className="eyebrow">
        <span id="rest-title">{fmtDate(today, { weekday: "long", day: "numeric", month: "long" })} · repos</span>
      </p>
      <h2 className="card__title">Jour de repos</h2>
      <ul className="rest-card__tips">
        {rest.tips.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </section>
  );
}
