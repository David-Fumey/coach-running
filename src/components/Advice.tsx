import { useState } from "react";
import type { Plan } from "../lib/plan";
import { SOURCES_NOTE, TOPICS, phaseAdvice, topicById, type Topic, type TopicId } from "../lib/advice";
import type { Profile } from "../lib/nutrition";
import { todayISO } from "../storage";
import { currentWeekIndex } from "./PlanView";

interface Props {
  plan: Plan;
  profile: Profile | null;
  onOpenProfile: () => void;
}

/** Conseils : par phase du plan, puis par apport recherché (énergie, récupération, fer...). */
export default function Advice({ plan, profile, onOpenProfile }: Props) {
  const today = todayISO();
  const week = plan.weeks[currentWeekIndex(plan, today)];
  const phase = phaseAdvice(week.phase, week.isRecovery);
  // Fiche ouverte et filtre : on peut afficher tout, ou un seul apport.
  const [filter, setFilter] = useState<TopicId | null>(null);
  const [open, setOpen] = useState<TopicId | null>(null);

  const shown = filter ? TOPICS.filter((t) => t.id === filter) : TOPICS;

  function openTopic(id: TopicId) {
    setFilter(id);
    setOpen(id);
    document.getElementById("topics")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="advice">
      <section className="card phase-card" aria-labelledby="phase-title">
        <p className="eyebrow">
          Pour ta phase · semaine {week.index + 1}
        </p>
        <h2 id="phase-title" className="card__title">
          {phase.title}
        </h2>
        <p>{phase.intro}</p>
        <ul className="tips">
          {phase.points.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <p className="hint">À lire en priorité :</p>
        <div className="chips">
          {phase.topics.map((id) => (
            <button key={id} type="button" className="chip-btn" onClick={() => openTopic(id)}>
              {topicById(id).label}
            </button>
          ))}
        </div>
      </section>

      {!profile && (
        <p className="notice">
          Les repères sont génériques.{" "}
          <button type="button" className="link" onClick={onOpenProfile}>
            Complète ton profil
          </button>{" "}
          pour obtenir des quantités à ta mesure.
        </p>
      )}

      <section id="topics" aria-labelledby="topics-title" className="topics">
        <h2 id="topics-title" className="topics__title">
          Je cherche à améliorer…
        </h2>
        <div className="chips" role="group" aria-label="Filtrer par apport">
          <button type="button" className="chip-btn" aria-pressed={filter === null} onClick={() => setFilter(null)}>
            Tout
          </button>
          {TOPICS.map((t) => (
            <button
              key={t.id}
              type="button"
              className="chip-btn"
              aria-pressed={filter === t.id}
              onClick={() => {
                setFilter(t.id);
                setOpen(t.id);
              }}
            >
              {t.goal}
            </button>
          ))}
        </div>

        <div className="topic-list">
          {shown.map((t) => (
            <TopicCard key={t.id} topic={t} profile={profile} open={open === t.id} onToggle={(o) => setOpen(o ? t.id : open === t.id ? null : open)} />
          ))}
        </div>
      </section>

      <p className="hint advice__note">{SOURCES_NOTE}</p>
    </div>
  );
}

function TopicCard({ topic: t, profile, open, onToggle }: { topic: Topic; profile: Profile | null; open: boolean; onToggle: (open: boolean) => void }) {
  return (
    <details className={`topic topic--${t.id}`} open={open} onToggle={(e) => onToggle((e.currentTarget as HTMLDetailsElement).open)}>
      <summary>
        <span className="topic__label">{t.label}</span>
        <span className="topic__goal">{t.goal}</span>
      </summary>
      <div className="topic__body">
        <p>{t.why}</p>

        <h3 className="topic__sub">{profile ? "Pour toi" : "Repères"}</h3>
        <ul className="tips">
          {t.targets(profile).map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>

        <h3 className="topic__sub">Où le trouver</h3>
        <ul className="sources">
          {t.sources.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>

        <h3 className="topic__sub">Quand</h3>
        <ul className="tips">
          {t.timing.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>

        <div className="topic__watch">
          <h3 className="topic__sub">À surveiller</h3>
          <ul className="tips">
            {t.watch.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
      </div>
    </details>
  );
}
