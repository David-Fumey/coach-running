// Exercices d'échauffement (avant la séance) et d'étirements (après). TypeScript pur, sans dépendance.
//
// Chaque exercice est détaillé : muscles visés, dosage, gestes pas à pas, conseils et erreur fréquente. Deux routines
// prêtes à suivre en sont tirées : l'échauffement (plus court avant un footing, plus complet avant une séance rapide)
// et les étirements (version courte ou complète).

export type DrillKind = "echauffement" | "etirement";

export type Zone = "chevilles" | "mollets" | "cuisses" | "ischios" | "fessiers" | "hanches" | "dos" | "corps";

export const ZONE_LABEL: Record<Zone, string> = {
  chevilles: "Chevilles et pieds",
  mollets: "Mollets",
  cuisses: "Cuisses",
  ischios: "Arrière des cuisses",
  fessiers: "Fessiers",
  hanches: "Hanches",
  dos: "Dos",
  corps: "Tout le corps",
};

export interface Drill {
  id: string;
  kind: DrillKind;
  name: string;
  zone: Zone;
  /** Muscles ou articulations travaillés */
  target: string;
  /** Nombre de séries (ou de passages) */
  sets: number;
  /** Répétitions par série (échauffement) */
  reps?: number;
  /** Secondes à tenir par série (étirement) */
  seconds?: number;
  /** Distance en mètres par passage (lignes droites, gammes) */
  meters?: number;
  /** À faire des deux côtés : on compte alors deux fois */
  perSide?: boolean;
  /** Réservé aux séances rapides (fractionné, tempo, test, course) */
  fast?: boolean;
  /** Dans la version courte des étirements */
  essential?: boolean;
  steps: string[];
  tips: string[];
  /** Erreur fréquente à éviter */
  avoid: string;
}

export const DRILLS: Drill[] = [
  // ---------- Échauffement : à faire avant de partir, puis footing facile de la séance ----------
  {
    id: "chevilles",
    kind: "echauffement",
    name: "Cercles de cheville",
    zone: "chevilles",
    target: "Articulation de la cheville, tendons d'Achille",
    sets: 1,
    reps: 10,
    perSide: true,
    steps: ["Tiens-toi sur une jambe, une main sur un mur ou une chaise si besoin.", "Lève l'autre pied et dessine de grands cercles avec la pointe du pied.", "Fais 5 cercles dans un sens, 5 dans l'autre, puis change de pied."],
    tips: ["Va lentement et le plus grand possible : c'est l'amplitude qui compte.", "La cheville réveillée limite les mauvais appuis dans les premiers kilomètres."],
    avoid: "Faire des petits cercles rapides avec tout le bas de la jambe : seul le pied doit bouger.",
  },
  {
    id: "balancier-avant",
    kind: "echauffement",
    name: "Balancements de jambe avant-arrière",
    zone: "ischios",
    target: "Ischio-jambiers, fléchisseurs de hanche",
    sets: 1,
    reps: 10,
    perSide: true,
    steps: ["Appuie une main sur un mur, le buste droit.", "Balance la jambe libre vers l'avant puis vers l'arrière, comme un pendule.", "Augmente peu à peu l'amplitude sans forcer, genou presque tendu."],
    tips: ["Garde le bassin stable : ne cambre pas le dos quand la jambe part vers l'arrière.", "Les premiers balancements sont petits, les derniers plus larges."],
    avoid: "Donner des coups secs pour aller plus haut : le mouvement reste fluide et contrôlé.",
  },
  {
    id: "balancier-lateral",
    kind: "echauffement",
    name: "Balancements de jambe latéraux",
    zone: "hanches",
    target: "Adducteurs, abducteurs, articulation de la hanche",
    sets: 1,
    reps: 10,
    perSide: true,
    steps: ["Place-toi face à un mur, les deux mains dessus, les pieds sous les hanches.", "Balance une jambe vers l'extérieur puis devant l'autre jambe, en travers du corps.", "Garde le buste immobile et les hanches de face."],
    tips: ["Monte progressivement en amplitude sur les 10 balancements.", "Pose la main un peu plus loin si tu perds l'équilibre."],
    avoid: "Pencher le buste du côté opposé pour lever la jambe plus haut.",
  },
  {
    id: "fente-rotation",
    kind: "echauffement",
    name: "Fente marchée avec rotation",
    zone: "hanches",
    target: "Fléchisseurs de hanche, fessiers, cuisses, bas du dos",
    sets: 1,
    reps: 6,
    perSide: true,
    steps: ["Fais un grand pas en avant et descends jusqu'à ce que les deux genoux soient fléchis.", "Tourne le buste vers la jambe avant, bras tendus devant toi ou mains jointes.", "Reviens au centre, pousse sur la jambe avant et enchaîne avec l'autre jambe en avançant."],
    tips: ["Le genou avant reste au-dessus de la cheville, il ne rentre pas vers l'intérieur.", "Prévois environ 6 pas de chaque côté, sur une dizaine de mètres."],
    avoid: "Faire des pas trop courts : le genou avant dépasse alors les orteils et la hanche ne s'ouvre pas.",
  },
  {
    id: "squats",
    kind: "echauffement",
    name: "Squats au poids du corps",
    zone: "cuisses",
    target: "Quadriceps, fessiers, genoux",
    sets: 1,
    reps: 10,
    steps: ["Pieds écartés à la largeur des épaules, pointes légèrement ouvertes.", "Descends en reculant les fesses, comme pour t'asseoir, le dos droit et les bras tendus devant toi.", "Remonte en poussant sur tout le pied, sans verrouiller les genoux."],
    tips: ["Les genoux restent dans l'axe des pieds.", "Descends à la profondeur où ton dos reste plat, pas plus."],
    avoid: "Laisser les genoux rentrer vers l'intérieur à la remontée.",
  },
  {
    id: "pont-fessier",
    kind: "echauffement",
    name: "Pont fessier d'activation",
    zone: "fessiers",
    target: "Grands fessiers, ischio-jambiers",
    sets: 1,
    reps: 12,
    steps: ["Allonge-toi sur le dos, genoux fléchis, pieds à plat près des fesses.", "Pousse sur les talons et monte le bassin jusqu'à aligner épaules, hanches et genoux.", "Serre les fessiers une seconde en haut, puis redescends lentement."],
    tips: ["Les fessiers qui s'allument dès le départ soulagent les genoux et le bas du dos.", "Monte en 1 seconde, redescends en 2."],
    avoid: "Cambrer le bas du dos pour monter plus haut : l'effort doit se sentir dans les fessiers.",
  },
  {
    id: "pointes",
    kind: "echauffement",
    name: "Montées sur pointes",
    zone: "mollets",
    target: "Mollets, tendon d'Achille, voûte du pied",
    sets: 1,
    reps: 12,
    steps: ["Tiens-toi debout, pieds parallèles, une main sur un appui.", "Monte le plus haut possible sur la pointe des pieds.", "Redescends lentement en 2 à 3 secondes."],
    tips: ["Garde les chevilles bien droites, sans les laisser basculer vers l'extérieur."],
    avoid: "Redescendre d'un coup : la phase de descente est celle qui prépare le tendon.",
  },
  {
    id: "talons-fesses",
    kind: "echauffement",
    name: "Talons-fesses",
    zone: "cuisses",
    target: "Ischio-jambiers, quadriceps",
    sets: 2,
    meters: 15,
    steps: ["Cours sur place ou en avançant doucement, le buste droit.", "Ramène chaque talon vers la fesse à chaque foulée.", "Reste léger sur l'avant du pied, les bras suivent le mouvement."],
    tips: ["Les genoux restent sous les hanches, ils ne partent pas vers l'avant."],
    avoid: "Pencher le buste en avant ou taper dans le sol avec le talon.",
  },
  {
    id: "montees-genoux",
    kind: "echauffement",
    name: "Montées de genoux",
    zone: "hanches",
    target: "Fléchisseurs de hanche, abdominaux, coordination",
    sets: 2,
    meters: 15,
    steps: ["Avance en levant un genou à hauteur de hanche à chaque pas.", "Pousse le sol avec la jambe d'appui, jusqu'à monter sur la pointe du pied.", "Balance les bras en opposition, le buste haut et grand."],
    tips: ["Pense à « grandir » : le rythme est vif mais les pas restent légers."],
    avoid: "Se pencher vers l'arrière pour monter le genou : garde le buste droit.",
  },
  {
    id: "pas-chasses",
    kind: "echauffement",
    name: "Pas chassés latéraux",
    zone: "fessiers",
    target: "Moyens fessiers, abducteurs, stabilité du bassin",
    sets: 2,
    meters: 10,
    perSide: true,
    steps: ["Fléchis légèrement les genoux, comme pour un mini-squat.", "Déplace-toi sur le côté en écartant le pied de tête puis en rapprochant l'autre, sans croiser les pieds.", "Fais 10 mètres dans un sens puis reviens dans l'autre."],
    tips: ["Garde les pointes de pieds vers l'avant et le buste droit."],
    avoid: "Se redresser entre deux pas : la position fléchie fait travailler les fessiers.",
  },
  {
    id: "skipping",
    kind: "echauffement",
    name: "Montées de genoux dynamiques (skipping)",
    zone: "corps",
    target: "Coordination, réactivité des pieds, mollets",
    sets: 2,
    meters: 20,
    fast: true,
    steps: ["Avance en montant les genoux vite, avec de petits rebonds sur l'avant du pied.", "Les bras travaillent en rythme, coudes à 90°.", "Garde un contact très court avec le sol, comme si tu marchais sur des braises."],
    tips: ["À placer avant une séance rapide : il prépare tes pieds à la vitesse.", "Mets de la qualité de rythme, pas de la puissance."],
    avoid: "S'écraser sur les talons : reste sur l'avant du pied.",
  },
  {
    id: "accelerations",
    kind: "echauffement",
    name: "Lignes droites progressives",
    zone: "corps",
    target: "Foulée, système cardio-respiratoire, tendons",
    sets: 4,
    meters: 80,
    fast: true,
    steps: ["Après ton footing d'échauffement, choisis une ligne droite plate de 80 mètres.", "Accélère progressivement : la première moitié souple, la seconde proche de l'allure de la séance.", "Reviens en marchant ou en trottant lentement, puis recommence."],
    tips: ["Reste décontracté : les épaules, les mains et le visage sans crispation.", "C'est la dernière étape, juste avant d'attaquer la partie rapide."],
    avoid: "Partir à fond dès le premier mètre : la vitesse monte petit à petit.",
  },

  // ---------- Étirements : à faire après la séance, muscles chauds ----------
  {
    id: "mollet-mur",
    kind: "etirement",
    name: "Étirement du mollet contre un mur",
    zone: "mollets",
    target: "Gastrocnémiens (mollets), tendon d'Achille",
    sets: 1,
    seconds: 30,
    perSide: true,
    essential: true,
    steps: ["Place-toi face à un mur, les mains à hauteur des épaules.", "Recule une jambe, le talon bien à plat au sol, la jambe tendue.", "Avance le bassin vers le mur jusqu'à sentir l'étirement dans le mollet arrière."],
    tips: ["Les orteils pointent droit devant, pas vers l'extérieur.", "Respire calmement, l'étirement s'accentue sur la durée."],
    avoid: "Décoller le talon du sol : l'étirement ne porte plus sur le mollet.",
  },
  {
    id: "mollet-flechi",
    kind: "etirement",
    name: "Étirement du mollet, genou fléchi",
    zone: "mollets",
    target: "Soléaire (bas du mollet), tendon d'Achille",
    sets: 1,
    seconds: 30,
    perSide: true,
    steps: ["Reste dans la position du mollet contre le mur, pieds rapprochés.", "Fléchis les deux genoux en gardant le talon arrière collé au sol.", "Sens l'étirement plus bas dans le mollet, près du tendon."],
    tips: ["Alterne avec l'étirement jambe tendue : les deux zones sont complémentaires."],
    avoid: "Monter sur la pointe du pied arrière.",
  },
  {
    id: "quadriceps",
    kind: "etirement",
    name: "Étirement du quadriceps debout",
    zone: "cuisses",
    target: "Quadriceps, fléchisseurs de hanche",
    sets: 1,
    seconds: 30,
    perSide: true,
    essential: true,
    steps: ["Tiens-toi debout sur une jambe, une main sur un appui.", "Attrape le pied de l'autre jambe et ramène le talon vers la fesse.", "Garde les genoux collés et pousse légèrement le bassin vers l'avant."],
    tips: ["Le buste reste droit et le ventre rentré, pour ne pas cambrer.", "Si tu n'atteins pas le pied, utilise une sangle ou une serviette."],
    avoid: "Écarter le genou de l'étirement vers l'arrière ou cambrer le bas du dos.",
  },
  {
    id: "ischios",
    kind: "etirement",
    name: "Étirement des ischio-jambiers",
    zone: "ischios",
    target: "Ischio-jambiers (arrière de la cuisse)",
    sets: 1,
    seconds: 30,
    perSide: true,
    essential: true,
    steps: ["Pose le talon d'une jambe sur une marche basse ou une chaise, la jambe tendue.", "Garde le dos long et penche-toi depuis les hanches vers le pied.", "Arrête-toi dès que tu sens l'étirement à l'arrière de la cuisse."],
    tips: ["Imagine que tu avances le nombril vers le genou, pas la tête vers le pied.", "Si l'étirement tire derrière le genou, fléchis légèrement la jambe."],
    avoid: "Arrondir le dos pour aller plus loin : l'étirement quitte alors la cuisse.",
  },
  {
    id: "fessiers",
    kind: "etirement",
    name: "Étirement des fessiers, position du 4",
    zone: "fessiers",
    target: "Grands fessiers, piriforme",
    sets: 1,
    seconds: 30,
    perSide: true,
    essential: true,
    steps: ["Allonge-toi sur le dos, genoux fléchis, pieds à plat.", "Croise une cheville sur le genou opposé, en formant un 4.", "Attrape l'arrière de la cuisse de la jambe du bas et ramène-la vers la poitrine."],
    tips: ["Garde la tête et les épaules au sol, détends le visage.", "Pousse doucement le genou croisé vers l'extérieur pour accentuer."],
    avoid: "Tirer d'un coup sec : on amène la jambe en douceur.",
  },
  {
    id: "psoas",
    kind: "etirement",
    name: "Étirement de la hanche en fente basse",
    zone: "hanches",
    target: "Psoas, fléchisseurs de hanche, avant de la cuisse",
    sets: 1,
    seconds: 30,
    perSide: true,
    essential: true,
    steps: ["Mets un genou au sol (sur un coussin) et l'autre pied loin devant, genou à 90°.", "Contracte le fessier de la jambe arrière et avance le bassin.", "Garde le buste droit : l'étirement se sent à l'avant de la hanche arrière."],
    tips: ["Lève le bras du côté du genou au sol pour accentuer l'étirement.", "Plus tu serres le fessier, plus l'étirement est profond."],
    avoid: "Creuser le bas du dos : le bassin reste rentré, les côtes basses.",
  },
  {
    id: "adducteurs",
    kind: "etirement",
    name: "Étirement des adducteurs, position papillon",
    zone: "hanches",
    target: "Adducteurs (intérieur des cuisses)",
    sets: 1,
    seconds: 30,
    steps: ["Assieds-toi au sol, plantes de pieds collées, genoux ouverts.", "Attrape tes pieds et garde le dos long.", "Penche-toi doucement vers l'avant, depuis les hanches, jusqu'à sentir l'étirement."],
    tips: ["Laisse la gravité faire descendre les genoux, sans les pousser avec les coudes."],
    avoid: "Forcer les genoux vers le sol avec les mains.",
  },
  {
    id: "bande-iliotibiale",
    kind: "etirement",
    name: "Étirement de la bande iliotibiale",
    zone: "hanches",
    target: "Face externe de la cuisse et de la hanche, tenseur du fascia lata",
    sets: 1,
    seconds: 30,
    perSide: true,
    steps: ["Debout, croise une jambe derrière l'autre, les pieds serrés.", "Penche le buste du côté opposé à la jambe croisée, un bras levé au-dessus de la tête.", "Pousse la hanche vers l'extérieur, jusqu'à sentir l'étirement sur le côté de la cuisse."],
    tips: ["Un appui du bras libre sur un mur aide à garder l'équilibre."],
    avoid: "Se pencher vers l'avant au lieu de sur le côté.",
  },
  {
    id: "plante-pied",
    kind: "etirement",
    name: "Étirement de la plante du pied",
    zone: "chevilles",
    target: "Fascia plantaire, mollet, tendon d'Achille",
    sets: 1,
    seconds: 30,
    perSide: true,
    steps: ["Assieds-toi au sol, une jambe tendue devant toi.", "Attrape les orteils (ou une serviette passée sous le pied) et tire-les doucement vers toi.", "Garde le dos long et sens la tension sous le pied et dans le mollet."],
    tips: ["Utile si tu as la plante du pied tendue après les longues sorties."],
    avoid: "Forcer sur les orteils jusqu'à ressentir une douleur vive.",
  },
  {
    id: "enfant",
    kind: "etirement",
    name: "Position de l'enfant",
    zone: "dos",
    target: "Bas du dos, hanches, épaules",
    sets: 1,
    seconds: 30,
    steps: ["À genoux, assieds-toi sur tes talons.", "Penche le buste vers l'avant et allonge les bras devant toi, le front vers le sol.", "Respire profondément en laissant le dos s'étirer à chaque expiration."],
    tips: ["C'est la fin de séance idéale : relâche tout et ralentis la respiration.", "Écarte un peu les genoux si le ventre gêne."],
    avoid: "Rester crispé : si les épaules montent, repose le front sur un coussin.",
  },
];

/** Exercices d'une catégorie, dans l'ordre où on les enchaîne. */
export function drillsOf(kind: DrillKind): Drill[] {
  return DRILLS.filter((d) => d.kind === kind);
}

/** Dosage lisible : « 2 × 10 par jambe », « 30 s par côté », « 4 × 80 m ». */
export function doseLabel(d: Drill): string {
  const side = d.perSide ? " par côté" : "";
  const unit = d.seconds !== undefined ? `${d.seconds} s` : d.meters !== undefined ? `${d.meters} m` : `${d.reps ?? 0}`;
  return d.sets > 1 ? `${d.sets} × ${unit}${side}` : `${unit}${side}`;
}

/** Durée approximative en secondes (changement de côté et de position compris). */
export function drillSeconds(d: Drill): number {
  const work = d.seconds ?? (d.meters !== undefined ? d.meters / 2.5 : (d.reps ?? 0) * 2.5);
  return Math.round(d.sets * work * (d.perSide ? 2 : 1) + 10);
}

export interface Routine {
  drills: Drill[];
  /** Minutes, arrondies à la minute supérieure */
  minutes: number;
}

function routineOf(list: Drill[]): Routine {
  return { drills: list, minutes: Math.max(1, Math.ceil(list.reduce((acc, d) => acc + drillSeconds(d), 0) / 60)) };
}

/** Échauffement à faire avant de partir. `fast` : séance rapide (fractionné, tempo, test, course), avec gammes et lignes droites. */
export function warmupRoutine(fast: boolean): Routine {
  return routineOf(drillsOf("echauffement").filter((d) => fast || !d.fast));
}

/** Étirements d'après séance : version courte (les grands groupes musculaires) ou complète. */
export function stretchRoutine(full: boolean): Routine {
  return routineOf(drillsOf("etirement").filter((d) => full || d.essential));
}

/** Repères d'ensemble pour chaque catégorie. */
export const GUIDE: Record<DrillKind, { title: string; lead: string; rules: string[] }> = {
  echauffement: {
    title: "Avant la séance",
    lead: "Cinq à dix minutes de mouvements dynamiques réveillent les articulations et les muscles. Fais-les juste avant de partir, puis enchaîne avec le footing d'échauffement prévu dans ta séance.",
    rules: [
      "Mouvements en douceur, sans rebond ni à-coup : l'amplitude augmente peu à peu.",
      "Pas d'étirements longs avant de courir : ils sont réservés à l'après-séance.",
      "Avant une séance rapide, ajoute les gammes et les lignes droites progressives.",
    ],
  },
  etirement: {
    title: "Après la séance",
    lead: "Les muscles sont chauds : c'est le bon moment pour les allonger doucement et ralentir le cœur. Tiens chaque position sans bouger, en respirant calmement.",
    rules: [
      "Maintiens 20 à 30 secondes par position, sans rebond.",
      "Tu dois sentir une tension agréable, jamais une douleur vive : relâche si ça pince.",
      "Après un footing facile, la version courte suffit ; après une séance dure ou une sortie longue, fais la complète.",
    ],
  },
};

/** Routines adaptées à un type de séance (`Session["type"]` du plan) : échauffement avant, étirements après. */
export function routinesFor(type: string): { warmup: Routine; stretch: Routine; fast: boolean; fullStretch: boolean } {
  const fast = type === "quality" || type === "tempo" || type === "test" || type === "race";
  const fullStretch = fast || type === "long";
  return { warmup: warmupRoutine(fast), stretch: stretchRoutine(fullStretch), fast, fullStretch };
}
