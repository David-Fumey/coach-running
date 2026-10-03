import { useEffect, useState } from "react";

/** Date du jour au format AAAA-MM-JJ, dans le fuseau de l'utilisateur. */
export function todayISO(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** useState synchronisé avec le localStorage (les données restent sur l'appareil). */
export function useStoredState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* stockage indisponible (navigation privée, quota) : on continue sans sauvegarde */
    }
  }, [key, value]);

  return [value, setValue] as const;
}
