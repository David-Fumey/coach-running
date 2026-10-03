# Foulée – contexte du projet

Application web (PWA) de coach de course à pied, inspirée de Runna. Interface en français.

## Objectif produit

1. Plan de course à pied sur plusieurs mois pour préparer une course (fait, v0.1), avec hub, activités et progrès (fait, v0.2).
2. Suivi de la nutrition selon la charge d'entraînement (v0.3 : objectifs du jour et journal, fait).
3. Partie « Conseils » selon les apports recherchés (v0.4 : fiches par apport et conseils par phase, fait) et recettes conseillées selon des critères (v0.5, fait).

## Stack

- Vite + React 19 + TypeScript, sans backend.
- Données dans le `localStorage` (clés `foulee.plan.v1`, `foulee.done.v1`, `foulee.activities.v1`, `foulee.confirmed.v1`, `foulee.profile.v1`, `foulee.foods.v1`). Une sauvegarde de toutes ces clés se télécharge et se réimporte en JSON depuis la page Profil (`src/lib/backup.ts`)..
- Polices (Barlow Condensed, Source Sans 3) embarquées via `@fontsource` : aucune requête vers un service tiers, hors ligne compris. Le style est dans `src/styles.css` (jetons en tête de fichier, thèmes clair et sombre automatiques).
- Parcours : formulaire → relecture du plan → validation → hub à onglets (Accueil, Programme, Activités, Progrès, Nutrition).
- PWA : `public/manifest.webmanifest` et `public/sw.js`.
- Le moteur de plan (`src/lib/plan.ts`) est du TypeScript pur, sans dépendance, pour rester testable seul.

## Commandes

```bash
npm install
npm run dev        # développement
npm run build      # vérification des types + build
npm run test:plan        # vérifie le moteur de plan (Node 22.6+)
npm run test:activities  # vérifie activités et statistiques
npm run test:nutrition   # vérifie les besoins nutritionnels et le journal
npm run test:backup      # vérifie la sauvegarde / restauration en fichier
npm run test:advice      # vérifie les fiches de conseils et leur personnalisation
npm run test:recipes     # vérifie les recettes, les régimes calculés et les filtres
```

## Conventions

- Textes de l'interface et commentaires en français.
- Dates au format `AAAA-MM-JJ`, calculées en UTC dans le moteur pour éviter les décalages d'heure d'été.
- Toute modification du moteur de plan, de `src/lib/activities.ts`, `nutrition.ts`, `backup.ts`, `advice.ts` ou `recipes.ts` doit garder les six scripts `npm run test:*` au vert.
- Les imports de `src/lib/` utilisent l'extension `.ts` pour rester exécutables par Node seul.
- Commits courts, au présent, en français.

## Journal des sessions

Chaque session de travail avec Claude est résumée dans `docs/sessions/AAAA-MM-JJ-titre.md` : décisions prises, ce qui a été fait, ce qui reste. Lire la plus récente avant de reprendre le travail.
