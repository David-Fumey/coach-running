import { useState, type FormEvent } from "react";
import { diffDays, type Plan, type Session } from "../lib/plan";
import { FEELINGS, groupByMonth, paceOf, parseMinutes, type Activity, type MonthGroup } from "../lib/activities";
import { fmtDate, fmtDuration, fmtKm, fmtPace } from "../lib/format";
import { todayISO } from "../storage";
import type { StravaApi } from "../useStrava";
import { fmtSync } from "./StravaCard";
import { PaceCheck } from "./PaceCard";
import ActivityDetail from "./ActivityDetail";
import type { PaceModel } from "../lib/paces";

interface Props {
  plan: Plan;
  done: Record<string, boolean>;
  activities: Activity[];
  /** Séance à pré-sélectionner (arrivée depuis l'accueil) */
  presetSessionId?: string;
  /** Sans id : création ; avec id : modification */
  onSave: (a: Omit<Activity, "id">, id?: string) => void;
  onDelete: (id: string) => void;
  strava: StravaApi;
  onOpenProfile: () => void;
  paces: PaceModel | null;
}

export default function Activities({ plan, done, activities, presetSessionId, onSave, onDelete, strava, onOpenProfile, paces }: Props) {
  const today = todayISO();
  const sessions = plan.weeks.flatMap((w) => w.sessions);
  const byId = new Map(sessions.map((s) => [s.id, s]));
  // Séances proposables : pas encore faites et au plus tard aujourd'hui (la présélection est toujours incluse).
  const preset = presetSessionId ? byId.get(presetSessionId) : undefined;

  const [showForm, setShowForm] = useState(!!preset);
  /** Id de l'activité en cours de modification, undefined pour une création */
  const [editingId, setEditingId] = useState<string | undefined>();
  const [sessionId, setSessionId] = useState(preset?.id ?? "");
  const [date, setDate] = useState(preset && preset.date <= today ? preset.date : today);
  const [km, setKm] = useState(preset ? String(preset.km).replace(".", ",") : "");
  const [time, setTime] = useState("");
  const [feeling, setFeeling] = useState<Activity["feeling"]>(undefined);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  /** Activité dont le détail est ouvert */
  const [openId, setOpenId] = useState<string | undefined>();
  /** Mois ouverts ou fermés par l'utilisateur ; sans choix, seul le mois le plus récent est ouvert */
  const [monthsOpen, setMonthsOpen] = useState<Record<string, boolean>>({});

  // Séances proposables : pas encore faites et au plus tard aujourd'hui, plus la séance déjà liée ou présélectionnée.
  const open = sessions.filter((s) => (!done[s.id] && diffDays(s.date, today) >= 0) || s.id === presetSessionId || s.id === sessionId);

  function startEdit(a: Activity) {
    setEditingId(a.id);
    setSessionId(a.sessionId ?? "");
    setDate(a.date);
    setKm(String(a.km).replace(".", ","));
    setTime(fmtTimeInput(a.minutes));
    setFeeling(a.feeling);
    setNote(a.note ?? "");
    setError("");
    setShowForm(true);
    window.scrollTo({ top: 0 });
  }

  function pickSession(id: string) {
    setSessionId(id);
    const s = byId.get(id);
    if (s) {
      setKm(String(s.km).replace(".", ","));
      if (s.date <= today) setDate(s.date);
    }
  }

  function reset() {
    setShowForm(false);
    setEditingId(undefined);
    setSessionId("");
    setDate(today);
    setKm("");
    setTime("");
    setFeeling(undefined);
    setNote("");
    setError("");
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const distance = Number(km.replace(",", "."));
    const minutes = parseMinutes(time);
    if (!date || date > today) return setError("Choisis une date qui n'est pas dans le futur.");
    if (!Number.isFinite(distance) || distance <= 0 || distance > 250) return setError("Indique une distance en km (par exemple 8,5).");
    if (minutes === null || minutes <= 0 || minutes > 24 * 60) return setError("Indique une durée, par exemple 45 (minutes) ou 1:05:30.");
    onSave(
      {
        date,
        km: Math.round(distance * 100) / 100,
        minutes: Math.round(minutes * 100) / 100,
        sessionId: sessionId || undefined,
        feeling,
        note: note.trim() || undefined,
      },
      editingId
    );
    reset();
  }

  const groups = groupByMonth(activities);

  return (
    <div className="activities">
      {strava.connected ? (
        <div className="syncbar">
          <p className="syncbar__text" role="status">
            {strava.status.kind === "syncing"
              ? (strava.status.text ?? "Synchronisation avec Strava…")
              : strava.status.kind === "error"
                ? strava.status.text
                : strava.status.kind === "ok"
                  ? strava.status.text
                  : `Strava · dernière synchro : ${fmtSync(strava.state.lastSync)}`}
          </p>
          <button type="button" className="btn" disabled={strava.status.kind === "syncing"} onClick={strava.sync}>
            Synchroniser
          </button>
        </div>
      ) : (
        <button type="button" className="link link--arrow" onClick={onOpenProfile}>
          Importer automatiquement depuis ma montre Garmin (via Strava)
        </button>
      )}

      {!showForm && (
        <button type="button" className="btn btn--primary" onClick={() => setShowForm(true)}>
          Enregistrer une activité
        </button>
      )}

      {showForm && (
        <form className="card form" onSubmit={handleSubmit} noValidate>
          <h2 className="card__title">{editingId ? "Modifier l'activité" : "Nouvelle activité"}</h2>

          <div className="field">
            <label htmlFor="act-session">Séance du plan</label>
            <select id="act-session" value={sessionId} onChange={(e) => pickSession(e.target.value)}>
              <option value="">Sortie libre (hors plan)</option>
              {open.map((s) => (
                <option key={s.id} value={s.id}>
                  {sessionLabel(s)}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="act-date">Date</label>
            <input id="act-date" type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="act-km">Distance (km)</label>
              <input id="act-km" type="text" inputMode="decimal" value={km} onChange={(e) => setKm(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="act-time">Durée</label>
              <input id="act-time" type="text" inputMode="numeric" placeholder="45 ou 1:05:30" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>

          <fieldset className="field">
            <legend>Ressenti (facultatif)</legend>
            <div className="chips">
              {([1, 2, 3, 4, 5] as const).map((n) => (
                <label className="chip" key={n}>
                  <input type="radio" name="feeling" checked={feeling === n} onChange={() => setFeeling(n)} />
                  <span>{FEELINGS[n]}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="field">
            <label htmlFor="act-note">Note (facultatif)</label>
            <input id="act-note" type="text" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="actions">
            <button type="submit" className="btn btn--primary">
              Enregistrer
            </button>
            <button type="button" className="btn" onClick={reset}>
              Annuler
            </button>
          </div>
        </form>
      )}

      {groups.length === 0 ? (
        <p className="hint empty">Aucune activité pour l'instant. Enregistre ta première sortie pour alimenter tes statistiques.</p>
      ) : (
        <div className="months">
          {groups.map((g, i) => (
            <details key={g.month} className="month" open={monthsOpen[g.month] ?? i === 0} onToggle={(e) => {
                const isOpen = (e.currentTarget as HTMLDetailsElement).open;
                setMonthsOpen((prev) => ({ ...prev, [g.month]: isOpen }));
              }}>
              <summary>
                <span className="month__name">{fmtDate(`${g.month}-01`, { month: "long", year: "numeric" })}</span>
                <span className="month__meta">{monthSummary(g)}</span>
              </summary>
              <ul className="activity-list">
                {g.activities.map((a) => {
            const s = a.sessionId ? byId.get(a.sessionId) : undefined;
            return (
              <li key={a.id} className={`activity${openId === a.id ? " activity--open" : ""}`}>
                <button type="button" className="activity__toggle" aria-expanded={openId === a.id} onClick={() => setOpenId(openId === a.id ? undefined : a.id)}>
                  <span className="activity__head">
                    <span className="session__date">{fmtDate(a.date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</span>
                    <span className="activity__km">{fmtKm(a.km)} km</span>
                  </span>
                  <span className="activity__meta">
                    {s ? s.title : "Sortie libre"}{a.source === "strava" ? " · Strava" : ""} · {fmtDuration(a.minutes)} · {fmtPace(paceOf(a))} /km
                    {a.avgHr ? ` · FC ${a.avgHr} bpm` : ""}
                    {a.elevation ? ` · D+ ${a.elevation} m` : ""}
                    {typeof a.temp === "number" ? ` · ${Math.round(a.temp)} °C` : ""}
                    {a.feeling ? ` · ${FEELINGS[a.feeling]}` : ""}
                  </span>
                  <span className="activity__chevron" aria-hidden="true" />
                </button>
                {s && <PaceCheck plan={plan} model={paces} session={s} pace={paceOf(a)} />}
                {a.note && <p className="hint">{a.note}</p>}
                {openId === a.id && (
                  <>
                    <ActivityDetail activity={a} onLoad={strava.loadDetail} connected={strava.connected} />
                    <div className="activity__actions">
                      <button type="button" className="link" onClick={() => startEdit(a)}>
                        Modifier
                      </button>
                      <button type="button" className="link link--danger" onClick={() => window.confirm("Supprimer cette activité ?") && onDelete(a.id)}>
                        Supprimer
                      </button>
                    </div>
                  </>
                )}
              </li>
            );
                })}
              </ul>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

/** « 12 sorties · 85,5 km · 9 h 12 » */
function monthSummary(g: MonthGroup) {
  return `${g.activities.length} ${g.activities.length > 1 ? "sorties" : "sortie"} · ${fmtKm(g.km)} km · ${fmtDuration(g.minutes)}`;
}

/** Minutes décimales → saisie relisible par parseMinutes (« 38:30 » ou « 1:05:30 »). */
function fmtTimeInput(minutes: number) {
  const total = Math.round(minutes * 60);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${m}:${p(s)}`;
}

function sessionLabel(s: Session) {
  return `${fmtDate(s.date, { weekday: "short", day: "numeric", month: "short" })} · ${s.title} · ${fmtKm(s.km)} km`;
}
