# Foulée – contexte du projet

Application web (PWA) de coach de course à pied, inspirée de Runna. Interface en français.

## Objectif produit

1. Plan de course à pied sur plusieurs mois pour préparer une course (fait, v0.1).
2. Suivi de la nutrition selon la charge d'entraînement (à faire).
3. Partie « Conseils » selon les apports recherchés (à faire).

## Stack

- Vite + React 19 + TypeScript, sans backend.
- Données dans le `localStorage` (clés `foulee.plan.v1`, `foulee.done.v1`).
- PWA : `public/manifest.webmanifest` et `public/sw.js`.
- Le moteur de plan (`src/lib/plan.ts`) est du TypeScript pur, sans dépendance, pour rester testable seul.

## Commandes

```bash
npm install
npm run dev        # développement
npm run build      # vérification des types + build
npm run test:plan  # vérifie le moteur de plan (Node 22.6+)
```

## Conventions

- Textes de l'interface et commentaires en français.
- Dates au format `AAAA-MM-JJ`, calculées en UTC dans le moteur pour éviter les décalages d'heure d'été.
- Toute modification du moteur de plan doit garder `npm run test:plan` au vert.
- Commits courts, au présent, en français.

## Journal des sessions

Chaque session de travail avec Claude est résumée dans `docs/sessions/AAAA-MM-JJ-titre.md` : décisions prises, ce qui a été fait, ce qui reste. Lire la plus récente avant de reprendre le travail.
