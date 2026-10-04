// Thème d'affichage : suit l'appareil par défaut, ou force le clair ou le sombre. TypeScript pur.

export type Theme = "auto" | "clair" | "sombre";

export const THEME_KEY = "foulee.theme.v1";

export const THEMES: { id: Theme; label: string }[] = [
  { id: "auto", label: "Automatique" },
  { id: "clair", label: "Clair" },
  { id: "sombre", label: "Sombre" },
];

export function validTheme(x: unknown): x is Theme {
  return x === "auto" || x === "clair" || x === "sombre";
}

/** Valeur de l'attribut `data-theme` de la page : absente en mode automatique. */
export function themeAttribute(theme: Theme): "light" | "dark" | null {
  return theme === "clair" ? "light" : theme === "sombre" ? "dark" : null;
}
