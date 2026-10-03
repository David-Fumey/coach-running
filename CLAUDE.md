# Runner – contexte du projet

> L'application s'appelait Foulée avant d'être renommée Runner. Les identifiants techniques n'ont pas changé, pour ne perdre aucune donnée ni sauvegarde : clés `localStorage` en `foulee.*`, champ `app: "foulee"` des fichiers de sauvegarde. Les anciens journaux de session (`docs/sessions/`) gardent l'ancien nom.

Application web (PWA) de coach de course à pied, inspirée de Runna. Interface en français.

## Objectif produit

1. Plan de course à pied sur plusieurs mois pour préparer une course (fait, v0.1), avec hub, activités et progrès (fait, v0.2).
2. Suivi de la nutrition selon la charge d'entraînement (v0.3 : objectifs du jour et journal, fait).
3. Partie « Conseils » selon les apports recherchés (v0.4 : fiches par apport et conseils par phase, fait) et recettes conseillées selon des critères (v0.5, fait).
4. Import automatique des sorties de la montre Garmin via Strava (v0.6 : fait, à essayer avec un vrai compte).
5. Écran Progrès filtrable : programme actuel ou total, graphiques par semaine, mois ou année (v0.7, fait), avec records personnels (v0.8, fait).
6. Allures cibles par séance, déduites de la moyenne des sorties enregistrées (v0.9, fait), avec temps objectif de course (v0.10, fait), et décalage du programme avec pause (v0.11, fait).

## Stack

- Vite + React 19 + TypeScript, sans backend.
- Données dans le `localStorage` (clés `foulee.plan.v1`, `foulee.done.v1`, `foulee.activities.v1`, `foulee.confirmed.v1`, `foulee.profile.v1`, `foulee.foods.v1`, `foulee.pace.v1` pour l'allure moyenne saisie à la main, `foulee.goal.v1` pour le temps objectif, `foulee.planprev.v1` pour le plan d'avant le dernier décalage (hors sauvegarde), plus `foulee.strava.v1` pour la connexion Strava). Une sauvegarde des données se télécharge et se réimporte en JSON depuis la page Profil (`src/lib/backup.ts`) ; elle n'inclut jamais la clé `foulee.strava.v1` (identifiant, secret et jetons Strava).
- Polices (Barlow Condensed, Source Sans 3) embarquées via `@fontsource` : aucune requête vers un service tiers, hors ligne compris. Le style est dans `src/styles.css` (jetons en tête de fichier, thèmes clair et sombre automatiques).
- Parcours : formulaire → relecture du plan → validation → hub à onglets (Accueil, Programme, Activités, Progrès, Nutrition).
- PWA : `public/manifest.webmanifest` et `public/sw.js`.
- Strava : appels directs depuis le navigateur (CORS ouvert), sans serveur ; le code secret client de l'utilisateur reste dans son `localStorage`. La logique est dans `src/lib/strava.ts` (pur) et `src/lib/stravaClient.ts` (réseau, `fetch` injectable).
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
npm run test:progress    # vérifie le regroupement par semaine, mois, année et les portées
npm run test:records     # vérifie les records personnels (distances, séries, repères)
npm run test:goal        # vérifie le temps objectif (saisie, niveau, prédictions, verdict)
npm run test:paces       # vérifie les allures cibles déduites des sorties
npm run test:shift       # vérifie le décalage du programme (pause, reprise, annulation)
npm run test:strava      # vérifie l'import Strava (conversion, fusion sans doublon, client réseau simulé)
```

## Conventions

- Textes de l'interface et commentaires en français.
- Dates au format `AAAA-MM-JJ`, calculées en UTC dans le moteur pour éviter les décalages d'heure d'été.
- Toute modification du moteur de plan, de `src/lib/activities.ts`, `nutrition.ts`, `backup.ts`, `advice.ts`, `recipes.ts`, `strava.ts`, `progress.ts`, `records.ts`, `paces.ts`, `goal.ts` ou `shift.ts` doit garder les douze scripts `npm run test:*` au vert.
- Les imports de `src/lib/` utilisent l'extension `.ts` pour rester exécutables par Node seul.
- Commits courts, au présent, en français.

## Journal des sessions

Chaque session de travail avec Claude est résumée dans `docs/sessions/AAAA-MM-JJ-titre.md` : décisions prises, ce qui a été fait, ce qui reste. Lire la plus récente avant de reprendre le travail.
