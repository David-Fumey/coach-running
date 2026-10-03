import { useState } from "react";
import { generatePlan, type Plan, type PlanInput } from "./lib/plan";
import { EMPTY_SNAPSHOT, makeBackup, parseBackup, type Snapshot } from "./lib/backup";
import { addActivity, removeActivity, updateActivity, type Activity } from "./lib/activities";
import { todayISO, useStoredState } from "./storage";
import SetupForm from "./components/SetupForm";
import PlanReview from "./components/PlanReview";
import PlanView from "./components/PlanView";
import Home from "./components/Home";
import Activities from "./components/Activities";
import Progress from "./components/Progress";
import Nutrition from "./components/Nutrition";
import ProfilePage from "./components/ProfilePage";
import type { Food, Profile } from "./lib/nutrition";
import { useStrava } from "./useStrava";
import TabBar, { TABS, type Tab } from "./components/TabBar";

export type PlanFormValues = Omit<PlanInput, "today">;

export default function App() {
  const [plan, setPlan] = useStoredState<Plan | null>("foulee.plan.v1", null);
  const [done, setDone] = useStoredState<Record<string, boolean>>("foulee.done.v1", {});
  const [activities, setActivities] = useStoredState<Activity[]>("foulee.activities.v1", []);
  const [confirmed, setConfirmed] = useStoredState<boolean>("foulee.confirmed.v1", false);
  // Profil et journal alimentaire ne dépendent pas du plan : ils survivent à sa recréation.
  const [profile, setProfile] = useStoredState<Profile | null>("foulee.profile.v1", null);
  const [foods, setFoods] = useStoredState<Food[]>("foulee.foods.v1", []);
  const [editing, setEditing] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [tab, setTab] = useState<Tab>("accueil");
  /** Séance à pré-sélectionner dans l'onglet Activités (depuis l'accueil) */
  const [presetSession, setPresetSession] = useState<string | undefined>();
  const strava = useStrava({
    plan,
    confirmed,
    activities,
    done,
    setActivities,
    setDone,
    onReturn: () => setShowProfile(true),
  });

  // Peut lever une erreur (date passée) : le formulaire l'affiche.
  function createPlan(values: PlanFormValues) {
    const next = generatePlan({ ...values, today: todayISO() });
    setPlan(next);
    setDone({});
    setActivities([]);
    strava.forgetHistory();
    setConfirmed(false);
    setTab("accueil");
    setEditing(false);
  }

  function toggle(id: string) {
    setDone((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = true;
      return next;
    });
  }

  /** Sans `id` : nouvelle activité ; avec `id` : modification. */
  function saveActivity(a: Omit<Activity, "id">, id?: string) {
    // Une activité importée garde son origine quand on la modifie : elle ne sera pas réimportée.
    const origin = id ? activities.find((x) => x.id === id) : undefined;
    const activity: Activity = {
      ...a,
      id: id ?? `a-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      ...(origin?.externalId ? { source: origin.source, externalId: origin.externalId } : {}),
      ...(origin?.avgHr !== undefined ? { avgHr: origin.avgHr } : {}),
      ...(origin?.maxHr !== undefined ? { maxHr: origin.maxHr } : {}),
      ...(origin?.elevation !== undefined ? { elevation: origin.elevation } : {}),
    };
    const next = id ? updateActivity({ activities, done }, activity) : addActivity({ activities, done }, activity);
    setActivities(next.activities);
    setDone(next.done);
    setPresetSession(undefined);
  }

  function deleteActivity(id: string) {
    const next = removeActivity({ activities, done }, id);
    setActivities(next.activities);
    setDone(next.done);
  }

  function addFood(f: Omit<Food, "id">) {
    const id = `f-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    setFoods((prev) => [...prev, { ...f, id }]);
  }

  function applySnapshot(d: Snapshot) {
    setPlan(d.plan);
    setDone(d.done);
    setActivities(d.activities);
    strava.forgetHistory();
    setConfirmed(d.confirmed);
    setProfile(d.profile);
    setFoods(d.foods);
    setEditing(false);
    setTab("accueil");
    setPresetSession(undefined);
  }

  /** Retourne un message d'erreur, ou null si la sauvegarde a été appliquée. */
  function importData(text: string): string | null {
    const r = parseBackup(text);
    if (!r.ok) return r.error;
    applySnapshot(r.data);
    return null;
  }

  function openProfile() {
    setShowProfile(true);
    window.scrollTo({ top: 0 });
  }

  function goTo(next: Tab) {
    setShowProfile(false);
    setPresetSession(undefined);
    setTab(next);
    window.scrollTo({ top: 0 });
  }

  function logSession(sessionId?: string) {
    setPresetSession(sessionId);
    setTab("activites");
    window.scrollTo({ top: 0 });
  }

  const hubReady = !!plan && confirmed && !editing;

  if (showProfile) {
    return (
      <>
        <main className={hubReady ? "shell shell--hub" : "shell"}>
          <button type="button" className="link back" onClick={() => setShowProfile(false)}>
            ← Retour
          </button>
          <h1 className="page-title">Mon profil</h1>
          <ProfilePage
            profile={profile}
            plan={plan}
            activityCount={activities.length}
            foodCount={foods.length}
            onSaveProfile={setProfile}
            getBackup={() => makeBackup({ plan, done, activities, confirmed, profile, foods }, new Date())}
            onImport={importData}
            strava={strava}
            onReset={() => {
              applySnapshot(EMPTY_SNAPSHOT);
              strava.reset();
              setShowProfile(false);
            }}
          />
        </main>
        {hubReady && <TabBar tab={null} onChange={goTo} />}
      </>
    );
  }

  if (!plan || editing) {
    return (
      <main className="shell">
        <SetupForm
          initial={plan ? plan.input : undefined}
          onSubmit={createPlan}
          onCancel={plan ? () => setEditing(false) : undefined}
        />
        {!plan && (
          <button type="button" className="link setup__import" onClick={openProfile}>
            J'ai déjà une sauvegarde : l'importer
          </button>
        )}
      </main>
    );
  }

  if (!confirmed) {
    return (
      <main className="shell">
        <PlanReview plan={plan} onConfirm={() => setConfirmed(true)} onEdit={() => setEditing(true)} />
      </main>
    );
  }

  const current = TABS.find((t) => t.id === tab)!;

  return (
    <>
      <main className="shell shell--hub">
        <header className="topbar">
          <span className="topbar__brand">
            <img src="./icon.svg" alt="" width="28" height="28" />
            Foulée
          </span>
          <button type="button" className="profile-btn" onClick={openProfile} aria-label="Mon profil">
            <span className="profile-btn__avatar" aria-hidden="true">
              {profile?.name ? profile.name.trim().charAt(0).toUpperCase() : "•"}
            </span>
            <span>{profile?.name || "Profil"}</span>
          </button>
        </header>
        {tab !== "accueil" && <h1 className="page-title">{current.title}</h1>}
        {tab === "accueil" && (
          <Home
            plan={plan}
            done={done}
            activities={activities}
            onLog={logSession}
            onOpenProgram={() => goTo("programme")}
            onOpenProgress={() => goTo("progres")}
          />
        )}
        {tab === "programme" && <PlanView plan={plan} done={done} onToggle={toggle} onEdit={() => setEditing(true)} />}
        {tab === "activites" && (
          <Activities
            plan={plan}
            done={done}
            activities={activities}
            presetSessionId={presetSession}
            onSave={saveActivity}
            onDelete={deleteActivity}
            strava={strava}
            onOpenProfile={openProfile}
          />
        )}
        {tab === "progres" && <Progress plan={plan} done={done} activities={activities} />}
        {tab === "nutrition" && (
          <Nutrition
            plan={plan}
            done={done}
            activities={activities}
            profile={profile}
            foods={foods}
            onSaveProfile={setProfile}
            onOpenProfile={openProfile}
            onAddFood={addFood}
            onDeleteFood={(id) => setFoods((prev) => prev.filter((f) => f.id !== id))}
          />
        )}
      </main>
      <TabBar tab={tab} onChange={goTo} />
    </>
  );
}
