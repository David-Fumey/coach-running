import { useState } from "react";
import { generatePlan, type Plan, type PlanInput } from "./lib/plan";
import { paceModel } from "./lib/paces";
import type { Goal } from "./lib/goal";
import { toggleFavorite } from "./lib/recipes";
import { canUndoShift, shiftPlan } from "./lib/shift";
import { upgradePlan } from "./lib/workouts";
import { latestTest, withTest, type TestResult } from "./lib/tests";
import TestCard from "./components/TestCard";
import { DEFAULT_WEIGHT_KG, calibration, postRunLoss, type Water, type Weighing } from "./lib/hydration";
import LossBanner from "./components/LossBanner";
import type { View as NutritionView } from "./components/Nutrition";
import { EMPTY_SNAPSHOT, makeBackup, parseBackup, type Snapshot } from "./lib/backup";
import { addActivity, removeActivity, updateActivity, type Activity } from "./lib/activities";
import { todayISO, useStoredState } from "./storage";
import SetupForm from "./components/SetupForm";
import PlanReview from "./components/PlanReview";
import PlanView from "./components/PlanView";
import Home from "./components/Home";
import ShiftSuggestion from "./components/ShiftSuggestion";
import Activities from "./components/Activities";
import Progress from "./components/Progress";
import Nutrition from "./components/Nutrition";
import ProfilePage from "./components/ProfilePage";
import type { Food, Profile } from "./lib/nutrition";
import { useStrava } from "./useStrava";
import TabBar, { TABS, type Tab } from "./components/TabBar";
import Drills from "./components/Drills";

export type PlanFormValues = Omit<PlanInput, "today">;

export default function App() {
  const [plan, setPlan] = useStoredState<Plan | null>("foulee.plan.v1", null);
  const [done, setDone] = useStoredState<Record<string, boolean>>("foulee.done.v1", {});
  const [activities, setActivities] = useStoredState<Activity[]>("foulee.activities.v1", []);
  const [confirmed, setConfirmed] = useStoredState<boolean>("foulee.confirmed.v1", false);
  // Profil et journal alimentaire ne dépendent pas du plan : ils survivent à sa recréation.
  const [profile, setProfile] = useStoredState<Profile | null>("foulee.profile.v1", null);
  const [favorites, setFavorites] = useStoredState<string[]>("foulee.favorites.v1", []);
  const [foods, setFoods] = useStoredState<Food[]>("foulee.foods.v1", []);
  const [water, setWater] = useStoredState<Water[]>("foulee.water.v1", []);
  const [sweat, setSweat] = useStoredState<Weighing[]>("foulee.sweat.v1", []);
  // Tests de 5 km chronométrés : ils recalent les allures cibles.
  const [tests, setTests] = useStoredState<TestResult[]>("foulee.tests.v1", []);
  // Sorties dont le rappel d'hydratation a été fermé. Simple confort d'affichage : hors sauvegarde.
  const [lossSeen, setLossSeen] = useStoredState<string[]>("foulee.lossseen.v1", []);
  /** Volet de Nutrition à ouvrir (depuis le rappel d'hydratation) */
  const [nutritionStart, setNutritionStart] = useState<NutritionView | undefined>();
  // Allure moyenne d'entraînement saisie à la main ; null = calculée sur les sorties enregistrées.
  const [paceRef, setPaceRef] = useStoredState<number | null>("foulee.pace.v1", null);
  // Temps objectif de course. Il appartient à une course : s'il ne correspond pas à celle du plan, il est ignoré.
  const [goal, setGoal] = useStoredState<Goal | null>("foulee.goal.v1", null);
  // Plan d'avant le dernier décalage, pour pouvoir l'annuler. Pas dans la sauvegarde : c'est provisoire.
  const [planBeforeShift, setPlanBeforeShift] = useStoredState<Plan | null>("foulee.planprev.v1", null);
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
    setPlanBeforeShift(null);
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
      ...(origin?.efforts !== undefined ? { efforts: origin.efforts } : {}),
      ...(origin?.temp !== undefined ? { temp: origin.temp } : {}),
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

  /** Décale les séances à venir de `weeks` semaines (voir lib/shift.ts). Retourne un message d'erreur ou null. */
  function shiftProgram(weeks: number): string | null {
    if (!plan) return null;
    const r = shiftPlan(plan, weeks, done, todayISO());
    if (!r.ok) return r.error;
    setPlanBeforeShift(plan);
    setPlan(r.plan);
    return null;
  }

  function upgradeSessions() {
    if (!plan) return;
    setPlan(upgradePlan(plan, done, todayISO()));
  }

  function undoShift() {
    if (!planBeforeShift) return;
    setPlan(planBeforeShift);
    setPlanBeforeShift(null);
  }

  function addWater(date: string, ml: number) {
    const id = `w-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    setWater((prev) => [...prev, { id, date, ml }]);
  }

  function addWeighing(w: Omit<Weighing, "id">) {
    const id = `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    setSweat((prev) => [...prev, { ...w, id }]);
  }

  function applySnapshot(d: Snapshot) {
    setPlan(d.plan);
    setPlanBeforeShift(null);
    setDone(d.done);
    setActivities(d.activities);
    strava.forgetHistory();
    setConfirmed(d.confirmed);
    setProfile(d.profile);
    setFoods(d.foods);
    setWater(d.water);
    setSweat(d.sweat);
    setTests(d.tests);
    setFavorites(d.favorites);
    setPaceRef(d.paceRef);
    setGoal(d.goal);
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
    setNutritionStart(undefined);
    setShowProfile(false);
    setPresetSession(undefined);
    setTab(next);
    window.scrollTo({ top: 0 });
  }

  function dismissLoss(id: string) {
    setLossSeen((prev) => [...prev.filter((x) => x !== id), id].slice(-50));
  }

  function openHydration(id: string) {
    dismissLoss(id);
    setNutritionStart("hydratation");
    setShowProfile(false);
    setTab("nutrition");
    window.scrollTo({ top: 0 });
  }

  function logSession(sessionId?: string) {
    setPresetSession(sessionId);
    setTab("activites");
    window.scrollTo({ top: 0 });
  }

  const hubReady = !!plan && confirmed && !editing;
  const postRun = hubReady
    ? postRunLoss(activities, sweat, lossSeen, todayISO(), profile?.weightKg ?? DEFAULT_WEIGHT_KG, calibration(sweat)?.factor ?? 1)
    : null;
  const planGoal = plan && goal && goal.race === plan.input.race ? goal : null;
  const paces = paceModel(activities, todayISO(), paceRef, planGoal, latestTest(tests));

  function saveTest(r: { date: string; minutes: number; km?: number; sessionId?: string }) {
    const id = `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    setTests((prev) => withTest(prev, { id, ...r }));
  }
  const testCard = (summary: boolean) =>
    plan ? (
      <TestCard
        plan={plan}
        activities={activities}
        tests={tests}
        model={paces}
        preview={(minutes, km) => paceModel(activities, todayISO(), paceRef, planGoal, { id: "apercu", date: todayISO(), minutes, ...(km !== undefined ? { km } : {}) })}
        manualPace={paceRef !== null}
        onSave={saveTest}
        onDelete={(id) => setTests((prev) => prev.filter((t) => t.id !== id))}
        summary={summary}
      />
    ) : null;

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
            getBackup={() => makeBackup({ plan, done, activities, confirmed, profile, foods, paceRef, goal, water, sweat, tests, favorites }, new Date())}
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
            Runner
          </span>
          <button type="button" className="profile-btn" onClick={openProfile} aria-label="Mon profil">
            <span className="profile-btn__avatar" aria-hidden="true">
              {profile?.name ? profile.name.trim().charAt(0).toUpperCase() : "•"}
            </span>
            <span>{profile?.name || "Profil"}</span>
          </button>
        </header>
        {postRun && tab !== "nutrition" && (
          <LossBanner info={postRun} today={todayISO()} onOpen={() => openHydration(postRun.activity.id)} onDismiss={() => dismissLoss(postRun.activity.id)} />
        )}
        {tab !== "accueil" && <h1 className="page-title">{current.title}</h1>}
        {tab === "accueil" && (
          <Home
            plan={plan}
            done={done}
            activities={activities}
            onLog={logSession}
            onOpenProgram={() => goTo("programme")}
            onOpenProgress={() => goTo("progres")}
            onOpenDrills={() => goTo("exercices")}
            onToggle={toggle}
            paces={paces}
            testCard={testCard(false)}
            suggestion={<ShiftSuggestion plan={plan} done={done} activities={activities} onShift={shiftProgram} />}
          />
        )}
        {tab === "programme" && (
          <PlanView plan={plan} done={done} onToggle={toggle} onEdit={() => setEditing(true)} paces={paces} paceRef={paceRef} onChangePaceRef={setPaceRef} goal={planGoal}
            onChangeGoal={setGoal}
            canUndoShift={canUndoShift(planBeforeShift, plan, done, activities)}
            onShift={shiftProgram}
            onUndoShift={undoShift}
            onUpgrade={upgradeSessions}
            testCard={testCard(true)}
          />
        )}
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
            paces={paces}
          />
        )}
        {tab === "progres" && <Progress plan={plan} done={done} activities={activities} />}
        {tab === "exercices" && <Drills />}
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
            water={water}
            onAddWater={addWater}
            onDeleteWater={(id) => setWater((prev) => prev.filter((w) => w.id !== id))}
            sweat={sweat}
            onAddWeighing={addWeighing}
            onDeleteWeighing={(id) => setSweat((prev) => prev.filter((w) => w.id !== id))}
            favorites={favorites}
            onToggleFavorite={(id) => setFavorites((prev) => toggleFavorite(prev, id))}
            startView={nutritionStart}
          />
        )}
      </main>
      <TabBar tab={tab} onChange={goTo} />
    </>
  );
}
