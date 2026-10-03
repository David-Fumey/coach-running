# Session du 3 octobre 2026 : démarrage du projet

## Décisions

- Plateforme : application web / PWA (une seule base de code, utilisable sur téléphone et ordinateur).
- Stack : React + TypeScript avec Vite, stockage local, pas de serveur pour l'instant.
- Périmètre de la v0.1 : uniquement le générateur de plan d'entraînement. La nutrition et les conseils viennent ensuite.
- Organisation : projet dans VSCode, dépôt git, une note par session dans `docs/sessions/`.

## Ce qui a été fait

- Moteur de génération de plan (`src/lib/plan.ts`) : phases base, construction, spécifique, affûtage et semaine de course ; semaine allégée toutes les 4 semaines ; séances de footing, fartlek, fractionné, tempo, blocs à allure de course et sortie longue.
- Interface : formulaire d'objectif, vue du plan semaine par semaine, validation des séances, graphique des kilomètres par semaine, compte à rebours.
- Sauvegarde locale et mode hors ligne (PWA).
- Vérifié : le moteur passe la vérification de types stricte et `npm run test:plan` sur 4 scénarios ; l'interface a été testée dans un navigateur (création du plan, validation de séances, persistance après rechargement).

## Points ouverts

- `npm install` et `npm run build` n'ont pas pu être lancés pendant la session (registre npm inaccessible depuis l'environnement de Claude). À lancer en premier sur ton ordinateur ; signaler toute erreur.
- Les composants React n'ont pas été vérifiés par `tsc` avec les types de React, seulement compilés et exécutés.

## Prochaines étapes possibles

1. Nutrition : besoins en calories et macros selon l'objectif et la charge de la semaine, journal alimentaire simple.
2. Conseils selon la phase du plan et les apports (hydratation, repas avant la sortie longue, récupération).
3. Allures cibles à partir d'un chrono récent ou d'un objectif de temps.
4. Comptes utilisateurs et synchronisation entre appareils.
