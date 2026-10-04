# Session du 4 octobre 2026 : catalogue de séances de qualité

## Décisions

- Objectif : un programme plus proche de celui de Runna, avec des séances de qualité variées et qui progressent, au lieu d'une séance identique pendant toute une phase.
- Les séances de qualité et de tempo sont décrites par des **données** (`Workout` dans `plan.ts` : échauffement, séries d'efforts, récupérations, intensité de chaque effort). Ces données servent à la fois au texte du plan et à l'affichage pas à pas : plus de règle dupliquée entre `plan.ts` et `steps.ts`.
- Une `Session` peut porter `workout`. Les plans enregistrés avant ce catalogue n'en ont pas : `steps.ts` retombe sur leur ancien contenu (`legacyQualityWorkout`, `legacyTempoWorkout`).

## Catalogue (`src/lib/workouts.ts`, pur)

| Phase | Séance de qualité (rotation) |
|---|---|
| Base | fartlek (1 min / 1 min 30), côtes courtes (30 à 50 s), fartlek en pyramide (1-2-3-2-1 min) |
| Construction | fractionné à allure 10 km (5 km pour un 5 km), pyramide (200→800 m, 400→1200 m ou 200→1000 m), côtes longues (60 à 90 s) |
| Spécifique semi / marathon | blocs d'allure de course (1 ou 2 blocs), intervalles d'allure de course (3 × 2 km…), sortie progressive (facile, allure de course, seuil) |
| Spécifique 5 km / 10 km | répétitions à allure de course ou un peu plus vite, fractionné vif (400 m à allure 5 km) |
| Affûtage | rappel d'allure (répétitions courtes à allure de course) |
| Créneau tempo | bloc continu au seuil, puis intervalles au seuil (1 → 3 km), en alternance |

- **Rotation** : le rang de la séance parmi celles de sa phase choisit le format ; un tour complet fait passer au **cycle** suivant, qui allonge les répétitions (fractionné 1 000 → 2 000 m selon la course, montées en côte, blocs au seuil).
- **Volume** : le nombre de répétitions suit les kilomètres de la séance. Les longues répétitions (1,6 km et plus) descendent à 2 répétitions au lieu de 3 pour ne pas dépasser la séance.
- Les structures sans clé indéfinie (`undefined`) pour que le plan survive à JSON (sauvegarde en fichier).
- **Allures** : `intensityTarget` (paces.ts) donne l'allure de chaque intensité, avec le temps objectif pour l'allure de course ; `targetsFor` lit les intensités du déroulé pour une séance du catalogue. Fartlek et côtes restent au ressenti (pas d'allure).
- **Mise à jour d'un plan enregistré** : `upgradePlan` remplace les séances de qualité et de tempo à venir (non faites, à partir d'aujourd'hui) par celles du catalogue, mêmes dates et mêmes kilomètres. Carte « Nouvelles séances disponibles » dans l'onglet Programme, avec un bouton ; rien ne change sans clic.
- Plan généré pour la première fois : le catalogue s'applique directement.

## Ce qui a été fait

- `workouts.ts`, `plan.ts` (types `Workout`, `Seg`, `WorkSet`, compteurs de rotation), `paces.ts` (`intensityTarget`, `timedIntensities`), `steps.ts` (déroulé générique à partir des données), carte de mise à jour (`PlanView.tsx`, `App.tsx`).
- `npm run test:workouts` (15e script) : rotation, progression, cohérence texte / données / déroulé pour 4 distances × 3 niveaux × 4 fréquences, détails de chaque format, anciens plans, mise à jour (égale à un plan neuf), sérialisation.
- Vérifié dans le navigateur : la mise à jour transforme 9 séances à venir (côtes, fartlek en pyramide, fractionné…), avec leurs allures ; le plan de l'utilisateur a ensuite été remis dans son état d'origine, il peut cliquer lui-même.

## Pistes

- Course/marche pour les débutants, deux séances de qualité par semaine pour les avancés.
- Sorties longues variées (progressive, alternance d'allures, blocs au seuil).
- Séance de contrôle (test 5 km ou 30 min) pour recaler les allures.
- Jours de repos, renforcement, vélo.

## Sorties longues variées (ajout)

- Les sorties longues passent aussi par des données (`Workout`, sans échauffement ni retour au calme) : `longWorkout` dans `workouts.ts`.
- **Formats** : facile et régulière (la majorité), **progressive** (dernier quart en accélérant jusqu'à l'allure marathon ; à allure de course en phase spécifique semi / marathon), **en alternance** (n × 1 km à allure marathon / 1 km facile en construction ; n × 2 km à allure de course / 2 km facile en phase spécifique semi / marathon), **blocs au seuil** (2 ou 3 × 2 km au seuil, 1 km facile entre eux, dès 12 km), **fin à allure de course** (30 % des km, semi et marathon à partir de 14 km, comme avant).
- **Rotation** (rang parmi les sorties longues de la phase, semaines de récupération exclues) : base = facile, facile, progressive ; construction = facile, progressive, facile, alternance, facile, seuil ; spécifique semi / marathon = fin à allure de course, alternance ; spécifique 5 km / 10 km = facile, progressive. Les semaines de récupération et l'affûtage restent faciles.
- Seuils de distance : pas de progressive sous 8 km, pas d'alternance ni de seuil sous 12 km.
- `targetsFor` : sortie longue facile = comparable à la cible ; avec un effort au programme, allure facile puis allures de l'effort (non comparable). Avec un temps objectif, l'allure de course devient l'allure objectif.
- Les anciennes sorties longues gardent leur affichage d'avant ; `upgradePlan` les met aussi à jour (la carte du Programme le précise).
- Tests : `test:workouts` couvre la distance du déroulé, la rotation, les formats, la récupération et l'affûtage faciles.

## Niveaux (ajout)

- **Débutant qui court peu** (niveau Débutant et 10 km par semaine ou moins, ou rien de saisi) : les premières semaines alternent **course et marche**. Sept paliers de plus en plus de course (1 min / 1 min 30 de marche, puis 1 min 30, 2, 3, 5, 8 et 10 min de course), répartis sur 40 % de la préparation (3 à 8 semaines). Concerne les footings, la récupération et la sortie longue (un palier plus loin). La séance de qualité devient un « fartlek en douceur » (5 min de course facile, puis 4 à 6 × 1 min un peu plus vite avec marche). Durée de la séance : environ 8 min par km affiché, 5 min de marche avant et après. Ensuite, les footings se courent d'un seul tenant. Un débutant qui court déjà plus de 10 km par semaine n'a pas de course/marche.
- Nouvelles données : `Seg.walk` (marche), `Workout.warm` et `Workout.cool` (échauffement et retour au calme chronométrés). Étape « Marcher » dans le déroulé. `targetsFor` ne compare pas l'allure moyenne d'une sortie en course/marche à la cible.
- **Débutant** : les répétitions de qualité s'arrêtent au deuxième cran de la progression, pas d'alternance ni de blocs au seuil en sortie longue. **Avancé** : la progression démarre un cran plus loin (répétitions plus longues dès le début). Voir `levelCycle`.
- **Avancé sur 4 jours** : deux séances de travail par semaine (qualité + tempo, créneau « footing » remplacé), le tempo pèse 20 % du volume (au lieu de 15 %) pour que le footing restant ne dépasse pas la sortie longue. Sur 5 et 6 jours, les intermédiaires et les avancés avaient déjà qualité + tempo.
- La mise à jour d'un plan enregistré (`upgradePlan`) couvre aussi la course/marche des débutants.
- Pistes restantes : séance de contrôle, jours de repos ou de renforcement, deuxième séance de qualité sur 5 et 6 jours pour les avancés.

## Séance de contrôle : test de 5 km (ajout)

- **Idée** : un 5 km chronométré donne le niveau du coureur plus précisément que la moyenne de ses sorties, donc des allures cibles plus justes.
- **Placement** (`generatePlan`) : un test (`type: "test"`, « Test 5 km chronométré », 8 km = 2 km d'échauffement + 5 km + 1 km de retour au calme) au début de la phase de construction et au début de la phase spécifique, à la place de la séance de qualité de la première semaine qui n'est pas une semaine de récupération. Pas de test pour une préparation de moins de 8 semaines, ni pendant les semaines de course/marche d'un débutant. Le rang de rotation des séances de qualité n'avance pas à cause du test.
- **Résultat** (`src/lib/tests.ts`, pur) : le temps sur 5 km se renseigne dans une carte « Test de 5 km » (Accueil et Programme) dès le jour du test, pendant 21 jours. Si Strava a lu le détail de la sortie, il propose son meilleur 5 km (`efforts["5k"]`) en un clic ; sinon (ou si le test n'est pas ce meilleur 5 km) saisie à la main, de 15:00 à 60:00. La carte montre l'effet avant d'enregistrer : « Ton allure facile passerait de X à Y ». Clé `foulee.tests.v1`, incluse dans la sauvegarde et validée à l'import (anciennes sauvegardes sans `tests` acceptées).
- **Priorité des références** (`paceModel`) : allure moyenne saisie à la main > test de moins de 12 semaines > moyenne des sorties > test plus ancien > temps objectif. Nouvelle source « test » dans la carte « Mes allures cibles ».
- **Programme** : la carte « Mon test de 5 km » montre le dernier résultat (et le supprime) et la date du prochain test.
- **Mise à jour d'un plan enregistré** (`upgradePlan`) : place aussi les tests dans les phases qui n'en ont pas (première séance de qualité à venir non faite), et recalcule les kilomètres de la semaine concernée. `upgradableCount` compte désormais les séances qui changeraient réellement.
- Tests : `npm run test:control` (16e script) : placement, mise à jour d'un ancien plan, saisie, séance en attente avec Strava, priorité des références, sauvegarde.
- Vérifié dans le navigateur avec un plan daté du passé : la carte propose le meilleur 5 km relevé par Strava et chiffre l'effet sur l'allure facile (rien n'a été enregistré, plan d'origine remis).
- Pistes restantes : jours de repos et renforcement ; deuxième séance de qualité sur 5 et 6 jours pour les avancés ; test de 30 minutes comme alternative.

## Jours de repos et renforcement (ajout)

- **Renforcement** (`src/lib/strength.ts`, pur) : séances sans matériel placées les jours sans course, rangées à part dans `Week.extras` (type `strength`, `km: 0`, durée en minutes, identifiant `r-AAAA-MM-JJ`). Elles ne comptent ni dans les kilomètres, ni dans la régularité, ni dans le rapprochement avec les sorties Strava ; elles se valident comme les autres séances.
- **Placement** : un jour de repos qui n'est jamais la veille d'une séance dure (qualité, tempo, test, sortie longue, course). Base et construction : 2 séances par semaine (1 pour un débutant, ou avec 5 à 6 jours de course) ; phase spécifique : 1 ; semaine de récupération et affûtage : une mobilité de 10 minutes ; semaine de course : aucune. Deux séances ne se suivent pas. Sans jour libre, pas de renforcement.
- **Programmes** : « jambes et fessiers » (squats, fentes, pont fessier, montées sur marche, mollets) en alternance avec « gainage et stabilité » (planches, dead-bug, quadrupédie, pont sur une jambe), et « mobilité et détente » (hanches, ischios, chevilles, dos, rotation). Séries : 2 en base et en spécifique, 3 en construction, ±1 selon le niveau ; répétitions et tenues qui augmentent à chaque retour du programme (plafonnées) ; débutant ×0,8, avancé ×1,25. Durée estimée de 10 à 35 minutes.
- **Jours de repos** (`src/lib/rest.ts`) : l'Accueil affiche une carte « Jour de repos » les jours sans course ni renforcement pendant la préparation (pas pendant une pause du programme) : un conseil général, un conseil selon la veille (sortie longue, séance dure, course) et le lendemain (fraîcheur avant une séance dure, veille de course), et la consigne de consulter si une douleur persiste.
- **Écran** : Programme (séance repliable « Voir les exercices », durée à la place des kilomètres), Accueil (carte « Aujourd'hui » avec les exercices et « Séance faite » le jour d'un renforcement ; pastille « R » dans la semaine). `StrengthSteps.tsx`, `RestCard.tsx`.
- **Décalage du programme** : les semaines de pause n'ont pas de renforcement, les semaines régénérées en ont.
- **Mise à jour d'un plan enregistré** : ajoute le renforcement à venir (pas dans le passé) aux semaines qui n'en ont pas. `upgradableCount` le compte.
- **Sauvegarde** : `extras` validés à l'import ; les anciennes sauvegardes sans renforcement restent lisibles.
- Tests : `npm run test:strength` (17e script) : placement sur 96 combinaisons (courses, niveaux, fréquences, jour de la sortie longue), contenu et progression, conseils de repos, décalage, ancien plan, sauvegarde.
- Vérifié dans le navigateur (plans temporaires, ton plan remis tel quel) : semaine avec renforcement, carte « Aujourd'hui », carte de repos.
- Pistes restantes : deuxième séance de qualité sur 5 et 6 jours pour les avancés, test de 30 minutes, renforcement avec charges, validation du contenu par un coach ou un kiné.
