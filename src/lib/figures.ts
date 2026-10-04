// Bonshommes en traits pour illustrer les exercices. TypeScript pur : une posture (angles des membres) donne les
// points à tracer, sans dépendance ni image.
//
// Conventions d'angle, en degrés, pour un personnage de profil qui regarde vers la droite :
// - membres (bras, jambes) : angle absolu depuis la verticale vers le bas, positif vers l'avant ;
//   0 = pendant vers le bas, 90 = horizontal vers l'avant, 180 = vers le haut, -90 = horizontal vers l'arrière ;
// - tronc et tête : inclinaison depuis la verticale vers le haut, positive vers l'avant ; -90 = allongé sur le dos,
//   la tête à gauche ;
// - pied : angle absolu de la direction cheville → orteils (90 = à plat vers l'avant, 40 = pointe vers le bas).
// Avec `spread` (vue de face) l'écran remplace l'avant : A est le côté droit de l'écran, B le côté gauche.

export type Angles = [upper: number, lower: number];

export interface Pose {
  torso: number;
  head?: number;
  armA: Angles;
  armB: Angles;
  legA: Angles;
  legB: Angles;
  footA?: number;
  footB?: number;
  /** Vue de face : demi-écart des hanches et des épaules (en longueurs de tronc) ; pas de pieds dessinés */
  spread?: number;
  /** « all » : le point le plus bas touche le sol ; « feet » : seuls les pieds des jambes d'appui */
  ground?: "all" | "feet";
  support?: ("A" | "B")[];
  /** Mur vertical à la hauteur des mains */
  wall?: boolean;
  /** Marche posée sous le pied du membre indiqué */
  box?: "A" | "B";
}

export interface Pt {
  x: number;
  y: number;
}

export interface Seg {
  a: Pt;
  b: Pt;
  /** « body » : tronc, « near » : membres du premier plan, « far » : membres du second plan */
  kind: "body" | "near" | "far";
}

export interface Layout {
  segs: Seg[];
  head: Pt & { r: number };
  floor: number;
  wallX?: number;
  box?: { x: number; y: number; w: number; h: number };
}

export const VIEW = { w: 160, h: 140, floor: 122, scale: 36 };

const TORSO = 1;
const SHOULDER = 0.92;
const HEAD_OFFSET = 0.2;
const HEAD_R = 0.17;
const UPPER_ARM = 0.55;
const LOWER_ARM = 0.5;
const THIGH = 0.75;
const SHIN = 0.75;
const FOOT = 0.3;

const rad = (d: number) => (d * Math.PI) / 180;
const down = (a: number): Pt => ({ x: Math.sin(rad(a)), y: Math.cos(rad(a)) });
const up = (a: number): Pt => ({ x: Math.sin(rad(a)), y: -Math.cos(rad(a)) });
const add = (p: Pt, q: Pt, k = 1): Pt => ({ x: p.x + q.x * k, y: p.y + q.y * k });

/** Points d'un membre : [départ, milieu, bout]. */
function chain(start: Pt, [a1, a2]: Angles, l1: number, l2: number): [Pt, Pt, Pt] {
  const mid = add(start, down(a1), l1);
  return [start, mid, add(mid, down(a2), l2)];
}

/** Calcule les segments à tracer, posés sur le sol et centrés dans la vue (VIEW). */
export function layout(p: Pose): Layout {
  const s = p.spread ?? 0;
  const hipA: Pt = { x: s, y: 0 };
  const hipB: Pt = { x: -s, y: 0 };
  const dir = up(p.torso);
  const neck = add({ x: 0, y: 0 }, dir, TORSO);
  const shoulder = add({ x: 0, y: 0 }, dir, SHOULDER);
  const headC = add(neck, up(p.head ?? p.torso), HEAD_OFFSET);

  const legA = chain(hipA, p.legA, THIGH, SHIN);
  const legB = chain(hipB, p.legB, THIGH, SHIN);
  const armA = chain(add(shoulder, { x: s, y: 0 }), p.armA, UPPER_ARM, LOWER_ARM);
  const armB = chain(add(shoulder, { x: -s, y: 0 }), p.armB, UPPER_ARM, LOWER_ARM);
  const toeA = s ? legA[2] : add(legA[2], down(p.footA ?? 90), FOOT);
  const toeB = s ? legB[2] : add(legB[2], down(p.footB ?? 90), FOOT);

  const line = (pts: Pt[], kind: Seg["kind"]): Seg[] => pts.slice(1).map((b, i) => ({ a: pts[i], b, kind }));
  const feet = (leg: [Pt, Pt, Pt], toe: Pt, kind: Seg["kind"]): Seg[] => line(s ? leg : [...leg, toe], kind);
  let segs: Seg[] = [
    ...feet(legB, toeB, "far"),
    ...line(armB, "far"),
    { a: { x: 0, y: 0 }, b: neck, kind: "body" },
    ...feet(legA, toeA, "near"),
    ...line(armA, "near"),
  ];

  // Point le plus bas : le sol.
  const support = p.support ?? ["A", "B"];
  const grounded: Pt[] = [];
  if (p.ground === "feet") {
    if (support.includes("A")) grounded.push(legA[2], toeA);
    if (support.includes("B")) grounded.push(legB[2], toeB);
  } else {
    for (const sg of segs) grounded.push(sg.a, sg.b);
    grounded.push({ x: headC.x, y: headC.y + HEAD_R });
  }
  const floor = Math.max(...grounded.map((q) => q.y));

  const hands = [armA[2], armB[2]];
  const wallX = p.wall ? Math.max(...hands.map((h) => h.x)) + 0.08 : undefined;
  let box: Layout["box"];
  if (p.box) {
    const ankle = p.box === "A" ? legA[2] : legB[2];
    const toe = p.box === "A" ? toeA : toeB;
    const x0 = Math.min(ankle.x, toe.x) - 0.2;
    const top = Math.max(ankle.y, toe.y) + 0.02;
    box = { x: x0, y: top, w: Math.max(ankle.x, toe.x) + 0.15 - x0, h: Math.max(0.05, floor - top) };
  }

  // Cadrage : centré horizontalement, posé sur la ligne de sol.
  const xs = segs.flatMap((sg) => [sg.a.x, sg.b.x]).concat(headC.x - HEAD_R, headC.x + HEAD_R);
  if (wallX !== undefined) xs.push(wallX);
  if (box) xs.push(box.x, box.x + box.w);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const k = VIEW.scale;
  const tx = (x: number) => VIEW.w / 2 + (x - cx) * k;
  const ty = (y: number) => VIEW.floor + (y - floor) * k;
  const tp = (q: Pt): Pt => ({ x: tx(q.x), y: ty(q.y) });
  segs = segs.map((sg) => ({ ...sg, a: tp(sg.a), b: tp(sg.b) }));
  const head = { ...tp(headC), r: HEAD_R * k };

  return {
    segs,
    head,
    floor: VIEW.floor,
    ...(wallX !== undefined ? { wallX: tx(wallX) } : {}),
    ...(box ? { box: { x: tx(box.x), y: ty(box.y), w: box.w * k, h: box.h * k } } : {}),
  };
}

/** Tous les points d'une mise en page, pour vérifier qu'ils restent dans la vue. */
export function points(l: Layout): Pt[] {
  return [...l.segs.flatMap((s) => [s.a, s.b]), { x: l.head.x - l.head.r, y: l.head.y - l.head.r }, { x: l.head.x + l.head.r, y: l.head.y + l.head.r }];
}
