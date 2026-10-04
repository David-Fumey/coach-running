# Session du 4 octobre 2026 : essai Strava réel et déroulé des séances

## Strava avec un vrai compte

- Connexion réussie (49 sorties importées). Le message « 8 sorties analysées ; 8 à analyser » revenait à chaque synchro : la règle « 8 plus récentes sans température » prenait aussitôt les 8 suivantes, même très anciennes. `detailTargets` ne regarde plus que les 8 sorties les plus récentes du compte (`src/lib/strava.ts`).
- La montre ne remonte pas de température : toutes les sorties lues ont `temp: null`, le rappel d'hydratation retombe sur « tempéré ».

## Déroulé pas à pas (v0.13)

- Demande : les séances (« 2 km d'échauffement facile, puis 5 × (1 min soutenue / 1 min 30 de trot facile)… ») n'avaient pas d'allure par portion. Cible : un affichage découpé et coloré, comme Runna.
- `src/lib/steps.ts` (pur) : `workoutBlocks(plan, séance, modèle)` déduit des blocs (Échauffement, Séance avec nombre de répétitions, Retour au calme, Lignes droites) à partir du type, de la phase de la semaine et des km. Rien n'est stocké : les plans déjà enregistrés en profitent.
- Allures : échauffement, retour au calme et trots en « pas plus vite que X /km » (bord rapide de la zone facile ou très facile) ; effort soutenu du fartlek = zone 10 km (effort 7/10) ; fractionné, tempo, blocs et fin de sortie longue reprennent `targetsFor` (donc le temps objectif). Sans modèle d'allures, le ressenti reste affiché.
- Toutes les séances ont un déroulé, même d'un seul bloc (footing, sortie longue, récupération, footing d'affûtage, course) : même présentation colorée, une étape sur toute la distance avec son allure.
- Blocs d'allure semi/marathon de 6 km et plus : deux blocs avec 2 min de trot, et une note qui autorise le bloc unique (le texte du plan dit « 1 ou 2 blocs »).
- `WorkoutSteps.tsx` : visible sur l'Accueil (prochaine séance), repliable dans Programme. Classes CSS `wo-*` (la classe `.steps` existait déjà).
- `npm run test:steps` : répétitions du déroulé identiques à celles du texte du plan pour les quatre distances, fartlek, fractionné, tempo, blocs, sortie longue, lignes droites, sans modèle.

## Pistes

- Séance en pyramide (vue chez Runna) : il faudrait un nouveau type de séance dans le moteur de plan.
- Les marches de récupération sont des « trots faciles » ; ajouter un choix marche/trot au profil si besoin.
