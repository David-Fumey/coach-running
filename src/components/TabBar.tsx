import type { ReactNode } from "react";
import { CalendarIcon, ChartIcon, HomeIcon, LeafIcon, RunIcon, StretchIcon } from "./icons";

export type Tab = "accueil" | "programme" | "activites" | "progres" | "exercices" | "nutrition";

export const TABS: { id: Tab; label: string; title: string; icon: ReactNode }[] = [
  { id: "accueil", label: "Accueil", title: "Accueil", icon: <HomeIcon /> },
  { id: "programme", label: "Programme", title: "Mon programme", icon: <CalendarIcon /> },
  { id: "activites", label: "Activités", title: "Mes activités", icon: <RunIcon /> },
  { id: "progres", label: "Progrès", title: "Mes progrès", icon: <ChartIcon /> },
  { id: "exercices", label: "Exercices", title: "Exercices", icon: <StretchIcon /> },
  { id: "nutrition", label: "Nutrition", title: "Nutrition", icon: <LeafIcon /> },
];

export default function TabBar({ tab, onChange }: { tab: Tab | null; onChange: (t: Tab) => void }) {
  return (
    <nav className="tabbar" aria-label="Navigation principale">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          className="tabbar__item"
          aria-current={tab === t.id ? "page" : undefined}
          onClick={() => onChange(t.id)}
        >
          <span className="tabbar__icon">{t.icon}</span>
          <span className="tabbar__label">{t.label}</span>
        </button>
      ))}
    </nav>
  );
}
