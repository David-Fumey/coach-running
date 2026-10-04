// Postures illustrant chaque exercice de `drills.ts` (voir `figures.ts` pour les conventions d'angle). TypeScript pur.
//
// Une ou deux images par exercice : le départ puis l'arrivée du mouvement, ou la position tenue pour un étirement.

import type { Angles, Pose } from "./figures.ts";

export interface Frame {
  /** Légende courte sous l'image, lue aussi par les lecteurs d'écran */
  label: string;
  pose: Pose;
}

const STAND: Pose = { torso: 0, armA: [0, 0], armB: [0, 0], legA: [0, 0], legB: [0, 0] };
/** Mains appuyées sur un mur devant soi */
const HANDS_WALL: { armA: Angles; armB: Angles } = { armA: [50, 100], armB: [55, 95] };
/** Jambe d'appui seule au sol, l'autre en l'air */
const ONE_LEG: { ground: "feet"; support: ("A" | "B")[] } = { ground: "feet", support: ["B"] };

export const POSES: Record<string, Frame[]> = {
  chevilles: [
    { label: "Pointe tendue vers le bas", pose: { ...STAND, ...HANDS_WALL, ...ONE_LEG, wall: true, legA: [60, 20], footA: 40 } },
    { label: "Pointe tirée vers le haut", pose: { ...STAND, ...HANDS_WALL, ...ONE_LEG, wall: true, legA: [60, 20], footA: 140 } },
  ],
  "balancier-avant": [
    { label: "Jambe vers l'avant", pose: { ...STAND, ...HANDS_WALL, ...ONE_LEG, wall: true, legA: [60, 55] } },
    { label: "Jambe vers l'arrière", pose: { ...STAND, ...HANDS_WALL, ...ONE_LEG, wall: true, legA: [-30, -35], footA: 120 } },
  ],
  "balancier-lateral": [
    { label: "Jambe vers l'extérieur", pose: { ...STAND, spread: 0.15, armA: [35, -30], armB: [-35, 30], ground: "feet", support: ["B"], legA: [40, 40] } },
    { label: "Jambe devant l'autre", pose: { ...STAND, spread: 0.15, armA: [35, -30], armB: [-35, 30], ground: "feet", support: ["B"], legA: [-30, -30] } },
  ],
  "fente-rotation": [
    { label: "Fente, bras devant", pose: { torso: 0, armA: [90, 90], armB: [90, 90], legA: [85, 0], legB: [-5, -105], footB: 20 } },
    { label: "Tourne le buste, bras ouverts", pose: { torso: 5, armA: [90, 90], armB: [-90, -90], legA: [85, 0], legB: [-5, -105], footB: 20 } },
  ],
  squats: [
    { label: "Debout, bras devant", pose: { ...STAND, armA: [90, 90], armB: [90, 90] } },
    { label: "Assis en arrière, dos droit", pose: { torso: 35, armA: [90, 90], armB: [90, 90], legA: [80, -25], legB: [80, -25] } },
  ],
  "pont-fessier": [
    { label: "Allongé, genoux fléchis", pose: { torso: -90, head: -90, armA: [90, 90], armB: [90, 90], legA: [135, 45], legB: [135, 45] } },
    { label: "Bassin monté, fessiers serrés", pose: { torso: -118, head: -70, armA: [88, 85], armB: [88, 85], legA: [100, 20], legB: [100, 20] } },
  ],
  pointes: [
    { label: "Pieds à plat", pose: { ...STAND, ...HANDS_WALL, wall: true } },
    { label: "Sur la pointe des pieds", pose: { ...STAND, ...HANDS_WALL, wall: true, footA: 30, footB: 30 } },
  ],
  "talons-fesses": [
    { label: "Talon vers la fesse", pose: { torso: 5, armA: [-40, 50], armB: [40, 130], legA: [-5, -160], legB: [5, 5], footB: 90, ...ONE_LEG } },
    { label: "Même geste de l'autre jambe", pose: { torso: 5, armA: [40, 130], armB: [-40, 50], legB: [-5, -160], legA: [5, 5], ground: "feet", support: ["A"] } },
  ],
  "montees-genoux": [
    { label: "Genou à hauteur de hanche", pose: { torso: 0, armA: [45, 120], armB: [-40, 50], legA: [90, 0], legB: [0, 0], footB: 50, ...ONE_LEG } },
    { label: "Même geste de l'autre jambe", pose: { torso: 0, armA: [-40, 50], armB: [45, 120], legB: [90, 0], legA: [0, 0], footA: 50, ground: "feet", support: ["A"] } },
  ],
  "pas-chasses": [
    { label: "Mini-squat, un pied part sur le côté", pose: { ...STAND, spread: 0.15, armA: [25, -155], armB: [-25, 155], legA: [50, 5], legB: [-20, 0] } },
    { label: "L'autre pied vient le rejoindre", pose: { ...STAND, spread: 0.15, armA: [25, -155], armB: [-25, 155], legA: [30, 0], legB: [-30, 0] } },
  ],
  skipping: [
    { label: "Genou haut, rebond sur l'autre pied", pose: { torso: 0, armA: [45, 120], armB: [-40, 50], legA: [75, 0], legB: [-5, -10], footB: 50, ...ONE_LEG } },
    { label: "On change de jambe", pose: { torso: 0, armA: [-40, 50], armB: [45, 120], legB: [75, 0], legA: [-5, -10], footA: 50, ground: "feet", support: ["A"] } },
  ],
  accelerations: [
    { label: "Départ souple", pose: { torso: 8, armA: [-40, 50], armB: [45, 120], legA: [50, -20], legB: [-35, -70], footB: 60 } },
    { label: "Foulée ample en fin de ligne", pose: { torso: 15, armA: [-60, 40], armB: [60, 130], legA: [75, -10], legB: [-45, -120], footB: 70 } },
  ],

  "mollet-mur": [{ label: "Jambe arrière tendue, talon au sol", pose: { torso: 12, armA: [75, 95], armB: [75, 95], wall: true, legA: [40, 0], legB: [-28, -28] } }],
  "mollet-flechi": [{ label: "Genoux fléchis, talon arrière au sol", pose: { torso: 10, armA: [75, 95], armB: [75, 95], wall: true, legA: [40, 0], legB: [20, -35] } }],
  quadriceps: [{ label: "Talon vers la fesse, genoux collés", pose: { torso: 0, armA: [-10, -20], armB: [60, 100], wall: true, legA: [-5, -165], legB: [0, 0], footA: 190, ...ONE_LEG } }],
  ischios: [{ label: "Talon sur une marche, dos long", pose: { torso: 25, armA: [60, 60], armB: [60, 60], legA: [35, 35], legB: [0, 0], footA: 135, box: "A", ...ONE_LEG } }],
  fessiers: [{ label: "Cheville sur le genou, cuisse tirée", pose: { torso: -90, head: -90, armA: [105, 115], armB: [105, 115], legA: [100, -145], legB: [160, 90] } }],
  psoas: [{ label: "Genou arrière au sol, bassin avancé", pose: { torso: -3, armA: [165, 170], armB: [170, 175], legA: [85, 0], legB: [-5, -105], footB: 20 } }],
  adducteurs: [{ label: "Plantes de pieds jointes, genoux ouverts", pose: { ...STAND, spread: 0.15, legA: [80, -130], legB: [-80, 130], armA: [15, -25], armB: [-15, 25] } }],
  "bande-iliotibiale": [{ label: "Jambes croisées, penché sur le côté", pose: { torso: 25, spread: 0.15, armA: [5, 5], armB: [140, 160], legA: [0, 0], legB: [15, 15] } }],
  "plante-pied": [{ label: "Jambe tendue, orteils tirés vers soi", pose: { torso: 55, armA: [80, 100], armB: [80, 100], legA: [90, 90], legB: [90, 90], footA: 130, footB: 130 } }],
  enfant: [{ label: "Fesses sur les talons, bras allongés", pose: { torso: 80, head: 80, armA: [70, 67], armB: [70, 67], legA: [75, -85], legB: [75, -85] } }],
};
