import { useState, type FormEvent } from "react";
import { addDays, mondayOf, type Plan } from "../lib/plan";
import { summarize, type Activity } from "../lib/activities";
import {
  DAY_KIND_LABEL,
  dayTarget,
  recentFoods,
  totalsOf,
  type DayKind,
  type DayTarget,
  type Food,
  type Macros,
  type Profile,
} from "../lib/nutrition";
import { fmtDate, fmtDuration, fmtKm } from "../lib/format";
import { todayISO } from "../storage";
import ProfileForm from "./ProfileForm";
import { Ring } from "./icons";

interface Props {
  plan: Plan;
  done: Record<string, boolean>;
  activities: Activity[];
  profile: Profile | null;
  foods: Food[];
  onSaveProfile: (p: Profile) => void;
  onOpenProfile: () => void;
  onAddFood: (f: Omit<Food, "id">) => void;
  onDeleteFood: (id: string) => void;
}

const KIND_SHORT: Record<DayKind, string> = { repos: "Repos", facile: "Facile", intense: "Intense", long: "Long", course: "Course" };

/** Onglet « Nutrition » : objectifs du jour selon la charge, et journal alimentaire. */
export default function Nutrition(props: Props) {
  const { plan, done, activities, profile, foods, onSaveProfile } = props;
  const today = todayISO();
  const [date, setDate] = useState(today);

  if (!profile) {
    return (
      <>
        <p className="hint">Pour calculer tes besoins, il me faut quelques informations sur toi. Tu pourras les modifier dans ton profil.</p>
        <ProfileForm onSubmit={onSaveProfile} />
      </>
    );
  }

  const pace = summarize(plan, activities, done, today).avgPace ?? 6;
  const targetFor = (d: string) => dayTarget(plan, profile, activities, done, d, today, pace);
  const monday = mondayOf(date);
  const week = Array.from({ length: 7 }, (_, i) => targetFor(addDays(monday, i)));
  const target = targetFor(date);
  const dayFoods = foods.filter((f) => f.date === date);

  return (
    <div className="nutrition">
      <section aria-label="Semaine" className="weekstrip">
        <div className="weekstrip__nav">
          <button type="button" className="link" onClick={() => setDate(addDays(date, -7))}>
            ← Semaine précédente
          </button>
          <button type="button" className="link" onClick={() => setDate(addDays(date, 7))}>
            Semaine suivante →
          </button>
        </div>
        <ul className="days">
          {week.map((d) => (
            <li key={d.date}>
              <button
                type="button"
                className={`day day--${d.kind}${d.date === today ? " day--today" : ""}`}
                aria-pressed={d.date === date}
                aria-label={`${fmtDate(d.date, { weekday: "long", day: "numeric", month: "long" })} : ${DAY_KIND_LABEL[d.kind]}, ${d.carbs} g de glucides`}
                onClick={() => setDate(d.date)}
              >
                <span className="day__name">{fmtDate(d.date, { weekday: "short" })}</span>
                <span className="day__num">{fmtDate(d.date, { day: "numeric" })}</span>
                <span className="day__kind">{d.eve ? "Veille" : KIND_SHORT[d.kind]}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <TargetCard target={target} eaten={totalsOf(dayFoods)} />

      <Journal
        key={date}
        date={date}
        foods={foods}
        dayFoods={dayFoods}
        onAdd={props.onAddFood}
        onDelete={props.onDeleteFood}
      />

      <footer className="nutrition__footer">
        <button type="button" className="link" onClick={props.onOpenProfile}>
          Modifier mon profil
        </button>
        <p className="hint">
          Estimations à partir de repères de nutrition sportive, pas un avis médical. Consulte un professionnel en cas de pathologie ou de doute.
        </p>
      </footer>
    </div>
  );
}

function TargetCard({ target: t, eaten }: { target: DayTarget; eaten: Macros }) {
  const title = fmtDate(t.date, { weekday: "long", day: "numeric", month: "long" });
  return (
    <section className="card target" aria-labelledby="target-title">
      <h2 id="target-title" className="card__title target__date">
        {title}
      </h2>
      <p className="target__kind">
        {t.eve ? "Veille de course : charge en glucides" : DAY_KIND_LABEL[t.kind]}
        {t.session && t.km > 0 ? ` · ${t.session.title} ${fmtKm(t.km)} km` : t.km > 0 ? ` · ${fmtKm(t.km)} km` : ""}
      </p>

      <div className="energy">
        <Ring value={eaten.kcal} goal={t.kcal} label={String(Math.round(eaten.kcal))} sub={`/ ${t.kcal} kcal`} size={124} />
        <div className="energy__meters">
          <Meter tone="carbs" label="Glucides" unit="g" value={eaten.carbs} goal={t.carbs} />
          <Meter tone="protein" label="Protéines" unit="g" value={eaten.protein} goal={t.protein} />
          <Meter tone="fat" label="Lipides" unit="g" value={eaten.fat} goal={t.fat} />
        </div>
      </div>

      {t.runKcal > 0 && <p className="hint">Dont environ {t.runKcal} kcal dépensées en courant.</p>}

      <h3 className="target__sub">Conseils du jour</h3>
      <ul className="tips">
        {t.tips.map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
        {t.during && (
          <li>
            Pendant la sortie (environ {fmtDuration(t.during.minutes)}) : {t.during.carbsPerHour} de glucides et {t.during.waterMlPerHour} d'eau par heure.
          </li>
        )}
      </ul>
    </section>
  );
}

function Meter({ label, unit, value, goal, tone }: { label: string; unit: string; value: number; goal: number; tone: string }) {
  const pct = goal > 0 ? Math.min(100, Math.round((value / goal) * 100)) : 0;
  return (
    <div className={`meter meter--${tone}`}>
      <div className="meter__head">
        <span>{label}</span>
        <span className="meter__nums">
          <strong>{Math.round(value)}</strong> / {goal} {unit}
        </span>
      </div>
      <div className="progress__bar" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={goal} aria-valuenow={Math.round(value)}>
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const optNum = (s: string) => {
  const t = s.trim();
  if (t === "") return undefined;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : NaN;
};

function Journal({
  date,
  foods,
  dayFoods,
  onAdd,
  onDelete,
}: {
  date: string;
  foods: Food[];
  dayFoods: Food[];
  onAdd: (f: Omit<Food, "id">) => void;
  onDelete: (id: string) => void;
}) {
  const [label, setLabel] = useState("");
  const [kcal, setKcal] = useState("");
  const [carbs, setCarbs] = useState("");
  const [protein, setProtein] = useState("");
  const [fat, setFat] = useState("");
  const [error, setError] = useState("");
  const recent = recentFoods(foods);

  function fill(f: Food) {
    setLabel(f.label);
    setKcal(String(f.kcal));
    setCarbs(f.carbs === undefined ? "" : String(f.carbs));
    setProtein(f.protein === undefined ? "" : String(f.protein));
    setFat(f.fat === undefined ? "" : String(f.fat));
    setError("");
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const k = optNum(kcal);
    const c = optNum(carbs);
    const p = optNum(protein);
    const l = optNum(fat);
    if (label.trim() === "") return setError("Donne un nom à l'aliment ou au repas.");
    if (k === undefined || Number.isNaN(k) || k > 5000) return setError("Indique les calories (kcal), par exemple 450.");
    if ([c, p, l].some((x) => x !== undefined && (Number.isNaN(x) || x > 1000))) return setError("Les glucides, protéines et lipides doivent être des nombres en grammes.");
    onAdd({ date, label: label.trim(), kcal: Math.round(k), carbs: c, protein: p, fat: l });
    setLabel("");
    setKcal("");
    setCarbs("");
    setProtein("");
    setFat("");
    setError("");
  }

  return (
    <section className="card journal" aria-labelledby="journal-title">
      <h2 id="journal-title" className="card__title">
        Journal alimentaire
      </h2>

      {dayFoods.length === 0 ? (
        <p className="hint">Rien d'enregistré pour ce jour.</p>
      ) : (
        <ul className="foods">
          {dayFoods.map((f) => (
            <li key={f.id} className="food">
              <span className="food__label">{f.label}</span>
              <span className="food__kcal">{f.kcal} kcal</span>
              <button
                type="button"
                className="link link--danger"
                aria-label={`Supprimer ${f.label}`}
                onClick={() => onDelete(f.id)}
              >
                Supprimer
              </button>
              {(f.carbs !== undefined || f.protein !== undefined || f.fat !== undefined) && (
                <span className="food__macros">
                  {f.carbs ?? 0} g glucides · {f.protein ?? 0} g protéines · {f.fat ?? 0} g lipides
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {recent.length > 0 && (
        <div className="recent">
          <p className="hint">Déjà saisis (touche pour préremplir) :</p>
          <div className="chips">
            {recent.map((f) => (
              <button type="button" key={f.id} className="chip-btn" onClick={() => fill(f)}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <form className="form" onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="food-label">Aliment ou repas</label>
          <input id="food-label" type="text" value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <div className="field-row field-row--4">
          <div className="field">
            <label htmlFor="food-kcal">kcal</label>
            <input id="food-kcal" type="text" inputMode="numeric" value={kcal} onChange={(e) => setKcal(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="food-carbs">Glucides (g)</label>
            <input id="food-carbs" type="text" inputMode="decimal" value={carbs} onChange={(e) => setCarbs(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="food-protein">Protéines (g)</label>
            <input id="food-protein" type="text" inputMode="decimal" value={protein} onChange={(e) => setProtein(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="food-fat">Lipides (g)</label>
            <input id="food-fat" type="text" inputMode="decimal" value={fat} onChange={(e) => setFat(e.target.value)} />
          </div>
        </div>
        <p className="hint">Les macros sont facultatives, mais sans elles les barres de glucides, protéines et lipides ne montent pas. Les valeurs sont sur l'emballage.</p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="actions">
          <button type="submit" className="btn btn--primary">
            Ajouter
          </button>
        </div>
      </form>
    </section>
  );
}
