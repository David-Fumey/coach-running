import { parseISO, type Phase } from "./plan";

export const PHASE_LABEL: Record<Phase, string> = {
  base: "Base",
  construction: "Construction",
  specifique: "Spécifique",
  affutage: "Affûtage",
  course: "Semaine de course",
};

export const fmtKm = (x: number) => (Number.isInteger(x) ? `${x}` : x.toFixed(1).replace(".", ","));

export function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("fr-FR", { ...opts, timeZone: "UTC" }).format(parseISO(iso));
}

/** 42 → « 42 min », 65 → « 1 h 05 ». */
export function fmtDuration(minutes: number) {
  const total = Math.round(minutes);
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h} h ${String(m).padStart(2, "0")}`;
}

/** Allure en minutes par km (5.5 → « 5:30 »). */
export function fmtPace(minPerKm: number) {
  const total = Math.round(minPerKm * 60);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** Allure cible : les secondes arrondies au multiple de 5 le plus proche (7:47 → « 7:45 »). */
export function fmtTargetPace(minPerKm: number) {
  const total = Math.round((minPerKm * 60) / 5) * 5;
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** Temps de course : 24.75 → « 24:45 », 105.5 → « 1:45:30 ». */
export function fmtClock(minutes: number) {
  const total = Math.round(minutes * 60);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${m}:${p(s)}`;
}

/** 750 → « 750 ml », 1250 → « 1,25 L ». */
export function fmtVolume(ml: number): string {
  if (ml < 1000) return `${Math.round(ml)} ml`;
  return `${String(Math.round(ml / 10) / 100).replace(".", ",")} L`;
}
