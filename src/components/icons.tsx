import type { ReactNode } from "react";

/** Icônes en trait, 24 px, sans dépendance. Décoratives : le libellé est toujours à côté. */
function Svg({ children }: { children: ReactNode }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const HomeIcon = () => (
  <Svg>
    <path d="M4 11.5 12 5l8 6.5" />
    <path d="M6 10.5V19h12v-8.5" />
    <path d="M10 19v-5h4v5" />
  </Svg>
);

export const CalendarIcon = () => (
  <Svg>
    <rect x="4" y="5.5" width="16" height="14" rx="2.5" />
    <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
  </Svg>
);

export const RunIcon = () => (
  <Svg>
    <circle cx="14.5" cy="5" r="1.8" />
    <path d="M12.5 9.5 10 12l3 2.5-1.5 5M12.5 9.5l3 1.5 2.5-1.5M10 12l-3.5 1" />
  </Svg>
);

export const ChartIcon = () => (
  <Svg>
    <path d="M4 19.5h16" />
    <path d="M6.5 16v-4M11 16V8M15.5 16v-6M20 16V5" />
  </Svg>
);

export const LeafIcon = () => (
  <Svg>
    <path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14" />
    <path d="M5 19c2-4 5-7 9-9" />
  </Svg>
);

export const ChevronIcon = () => (
  <Svg>
    <path d="m9 6 6 6-6 6" />
  </Svg>
);

export const CheckIcon = () => (
  <Svg>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Svg>
);

export const FlagIcon = () => (
  <Svg>
    <path d="M6 20.5V4M6 5h11l-2 3.5 2 3.5H6" />
  </Svg>
);

/** Anneau de progression : valeur sur objectif, texte au centre. */
export function Ring({ value, goal, label, sub, size = 96 }: { value: number; goal: number; label: string; sub?: string; size?: number }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const pct = goal > 0 ? Math.min(1, Math.max(0, value / goal)) : 0;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle className="ring__track" cx="50" cy="50" r={r} />
        <circle
          className="ring__value"
          cx="50"
          cy="50"
          r={r}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          transform="rotate(-90 50 50)"
        />
      </svg>
      <div className="ring__text">
        <strong>{label}</strong>
        {sub && <span>{sub}</span>}
      </div>
    </div>
  );
}
