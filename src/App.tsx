import { useState } from "react";
import { generatePlan, type Plan, type PlanInput } from "./lib/plan";
import { todayISO, useStoredState } from "./storage";
import SetupForm from "./components/SetupForm";
import PlanView from "./components/PlanView";

export type PlanFormValues = Omit<PlanInput, "today">;

export default function App() {
  const [plan, setPlan] = useStoredState<Plan | null>("foulee.plan.v1", null);
  const [done, setDone] = useStoredState<Record<string, boolean>>("foulee.done.v1", {});
  const [editing, setEditing] = useState(false);

  // Peut lever une erreur (date passée) : le formulaire l'affiche.
  function createPlan(values: PlanFormValues) {
    const next = generatePlan({ ...values, today: todayISO() });
    setPlan(next);
    setDone({});
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

  if (!plan || editing) {
    return (
      <main className="shell">
        <SetupForm
          initial={plan ? plan.input : undefined}
          onSubmit={createPlan}
          onCancel={plan ? () => setEditing(false) : undefined}
        />
      </main>
    );
  }

  return (
    <main className="shell">
      <PlanView plan={plan} done={done} onToggle={toggle} onEdit={() => setEditing(true)} />
    </main>
  );
}
