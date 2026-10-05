# Runner – contexte du projet

> L'application s'appelait Foulée avant d'être renommée Runner. Les identifiants techniques n'ont pas changé, pour ne perdre aucune donnée ni sauvegarde : clés `localStorage` en `foulee.*`, champ `app: "foulee"` des fichiers de sauvegarde. Les anciens journaux de session (`docs/sessions/`) gardent l'ancien nom.

Application web (PWA) de coach de course à pied, inspirée de Runna. Interface en français.

## Objectif produit

1. Plan de course à pied sur plusieurs mois pour préparer une course (fait, v0.1), avec hub, activités et progrès (fait, v0.2).
2. Suivi de la nutrition selon la charge d'entraînement (v0.3 : objectifs du jour et journal, fait).
3. Partie « Conseils » selon les apports recherchés (v0.4 : fiches par apport et conseils par phase, fait) et recettes conseillées selon des critères (v0.5, fait).
4. Import automatique des sorties de la montre Garmin via Strava (v0.6 : fait, à essayer avec un vrai compte).
5. Écran Progrès filtrable : programme actuel ou total, graphiques par semaine, mois ou année (v0.7, fait), avec records personnels (v0.8, fait).
6. Allures cibles par séance, déduites de la moyenne des sorties enregistrées (v0.9, fait), avec temps objectif de course (v0.10, fait), et décalage du programme avec pause (v0.11, fait), et onglet Hydratation (v0.12, fait).
7. Déroulé pas à pas des séances, avec l'allure de chaque portion (v0.13, fait), et catalogue de séances de qualité variées : côtes, pyramides, intervalles au seuil, sortie progressive (v0.14, fait), puis sorties longues variées : progressive, alternance, blocs au seuil (v0.15, fait), puis niveaux : course/marche pour les débutants, deux séances de travail pour les avancés sur 4 jours (v0.16, fait), et test de 5 km qui recale les allures (v0.17, fait), puis renforcement les jours sans course et conseils de repos (v0.18, fait), puis deuxième séance de qualité pour les avancés (v0.19, fait), test de 30 minutes en phase spécifique et garde-fou de charge hebdomadaire (v0.20, fait).
8. Détail d'une sortie importée : temps par kilomètre, cadence, calories, et courbes d'allure et de fréquence cardiaque, lus dans Strava et affichés au clic (v0.21, fait).
9. Onglet Exercices : échauffement avant les séances et étirements après, chaque exercice détaillé dans une carte dépliable, avec routines selon le type de séance et illustrations en bonshommes de traits (v0.22, fait).
10. Interface plus fine et plus colorée, version PC à partir de 1024 px (menu latéral, pleine largeur pour les listes et graphiques), activités regroupées par mois pliables, progrès affichables par jour (v0.23, fait).
11. Installation sur téléphone en PWA (icônes PNG, manifeste complet) et données Strava en plus : vitesse, altitudes, puissance, matériel, tracé, segments, zones de FC, cadence, pente, température, totaux du compte, chaussures, itinéraires, clubs (v0.24, fait), puis reprise d'un plan externe (Runna…) collé séance par séance, avec décalage de tout le programme (v0.25, fait), et déroulé écrit des séances reprises : allures, répétitions, marche (v0.26, fait).

## Stack

- Vite + React 19 + TypeScript, sans backend.
- Données dans le `localStorage` (clés `foulee.plan.v1`, `foulee.done.v1`, `foulee.activities.v1`, `foulee.confirmed.v1`, `foulee.profile.v1`, `foulee.foods.v1`, `foulee.favorites.v1` (recettes favorites), `foulee.shopping.v1` (liste de courses, hors sauvegarde), `foulee.theme.v1` (thème clair, sombre ou automatique, hors sauvegarde), `foulee.water.v1`, `foulee.sweat.v1`, `foulee.tests.v1` (tests de 5 km), `foulee.lossseen.v1` (rappels d'hydratation fermés, hors sauvegarde), `foulee.progressview.v1` (période et portée choisies dans Progrès, hors sauvegarde), `foulee.pace.v1` pour l'allure moyenne saisie à la main, `foulee.goal.v1` pour le temps objectif, `foulee.planprev.v1` pour le plan d'avant le dernier décalage (hors sauvegarde), `foulee.shiftseen.v1` pour la proposition de décalage fermée (hors sauvegarde), plus `foulee.strava.v1` pour la connexion Strava, avec les droits accordés et les données du compte). Une sauvegarde des données se télécharge et se réimporte en JSON depuis la page Profil (`src/lib/backup.ts`) ; elle n'inclut jamais la clé `foulee.strava.v1` (identifiant, secret et jetons Strava).
- Polices (Barlow Condensed, Source Sans 3) embarquées via `@fontsource` : aucune requête vers un service tiers, hors ligne compris. Le style est dans `src/styles.css` (jetons en tête de fichier, thèmes clair et sombre automatiques).
- Parcours : formulaire → relecture du plan → validation → hub à onglets (Accueil, Programme, Activités, Progrès, Exercices, Nutrition).
- Mise en page : pensée d'abord pour le téléphone (barre d'onglets en bas) ; à partir de 64 rem (1024 px) la section « Version PC » de `src/styles.css` passe en menu latéral et en pleine largeur ou deux colonnes selon l'écran. Vérifier un changement d'interface à 375, 1024 et 1400 px.
- PWA : `public/manifest.webmanifest` et `public/sw.js`.
- Strava : appels directs depuis le navigateur (CORS ouvert), sans serveur ; droits demandés `read,activity:read,profile:read_all,read_all` (une connexion plus ancienne propose de les accorder) ; le code secret client de l'utilisateur reste dans son `localStorage`. La logique est dans `src/lib/strava.ts` (pur) et `src/lib/stravaClient.ts` (réseau, `fetch` injectable).
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
npm run test:hydration   # vérifie le suivi d'eau et l'estimation de la transpiration
npm run test:strava      # vérifie l'import Strava (conversion, fusion sans doublon, client réseau simulé)
npm run test:steps       # vérifie le déroulé pas à pas des séances (blocs, répétitions, allures par portion)
npm run test:strength    # vérifie le renforcement (placement, programmes, conseils de repos)
npm run test:control     # vérifie le test de 5 km (placement, saisie, effet sur les allures)
npm run test:workouts    # vérifie le catalogue de séances (rotation, progression, cohérence, mise à jour d'un ancien plan)
npm run test:drills      # vérifie les exercices d'échauffement et d'étirements et leurs routines
npm run test:theme       # vérifie les choix de thème (clair, sombre, automatique)
npm run test:import      # vérifie la reprise d'un plan externe (lecture, types, plan, protections)
```

## Conventions

- Textes de l'interface et commentaires en français.
- Dates au format `AAAA-MM-JJ`, calculées en UTC dans le moteur pour éviter les décalages d'heure d'été.
- Toute modification du moteur de plan, de `src/lib/activities.ts`, `nutrition.ts`, `backup.ts`, `advice.ts`, `recipes.ts`, `strava.ts`, `progress.ts`, `records.ts`, `paces.ts`, `goal.ts`, `shift.ts`, `hydration.ts`, `steps.ts`, `workouts.ts`, `tests.ts`, `strength.ts`, `rest.ts`, `drills.ts`, `figures.ts`, `poses.ts`, `theme.ts` ou `planimport.ts` doit garder les vingt scripts `npm run test:*` au vert.
- Les imports de `src/lib/` utilisent l'extension `.ts` pour rester exécutables par Node seul.
- Commits courts, au présent, en français.

## Journal des sessions

Chaque session de travail avec Claude est résumée dans `docs/sessions/AAAA-MM-JJ-titre.md` : décisions prises, ce qui a été fait, ce qui reste. Lire la plus récente avant de reprendre le travail ; `docs/sessions/2026-10-04-bilan.md` fait la synthèse de la journée du 4 octobre et liste ce qui reste.

## Publication

- Le serveur de développement a un port fixe (5173, `strictPort`) : le `localStorage` est lié à l'adresse, un autre port ferait repartir l'application de zéro.
- `.github/workflows/deploy.yml` publie `dist/` sur GitHub Pages à chaque poussée sur `main` (réglage unique : Settings → Pages → Source : GitHub Actions). Adresse : `https://david-fumey.github.io/coach-running/`. Pour Strava, le « domaine de rappel d'autorisation » est `david-fumey.github.io`. Les données restent dans le navigateur de chacun ; changer d'appareil demande une sauvegarde JSON, et la connexion Strava se ressaisit.
