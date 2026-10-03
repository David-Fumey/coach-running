# Session du 3 octobre 2026 : onglet Hydratation

## Décisions

- Un quatrième volet dans Nutrition : « Suivi / Hydratation / Recettes / Conseils ».
- **Suivi** : boissons du jour en un clic (tasse 150 ml, verre 250, canette 330, petite bouteille 500, gourde 750) ou volume libre (10 à 3 000 ml), liste du jour avec suppression, navigation jour par jour (pas de jour futur), et les 7 derniers jours en petites barres avec le trait de l'objectif de chaque jour. Données dans `foulee.water.v1`, incluses dans la sauvegarde JSON et validées à l'import.
- **Objectif du jour** = besoin de base + eau perdue par la séance du jour (prévue, ou courue le jour même).
  - Base : 30 ml par kg de poids, arrondi à 50 ml, entre 1,5 et 3,5 L (les boissons font environ 80 % de l'apport total en eau recommandé par l'EFSA) ; sans profil, 1,8 L et un poids supposé de 70 kg (signalé).
  - Mention claire « base + compensation de la transpiration d'environ X km ».
- **Eau perdue à la dernière sortie** (estimation) :
  - énergie dépensée (1 kcal par kg et par km, comme dans la nutrition) × 75 % qui devient chaleur ÷ 0,58 kcal évacuée par ml de sueur évaporée × 85 % d'efficacité = environ 1,1 ml de sueur par kcal ;
  - réglable selon la chaleur : frais ×0,75, tempéré ×1, chaud ×1,35 (la météo n'est pas connue de l'application) ;
  - fourchette de ±25 %, car la transpiration varie beaucoup d'une personne à l'autre ;
  - exemple : 10 km à 70 kg par temps tempéré ≈ 770 ml (580 à 960 ml), soit 1,1 % du poids ; au-delà de 2 %, l'effort se dégrade (signalé) ;
  - à boire ensuite : 120 à 150 % de la perte dans les 2 à 4 heures, en plus de la base ;
  - rappel que la pesée avant/après (1 kg perdu ≈ 1 L) reste la meilleure mesure.
- **Conseils** par moment (avant, pendant, après, au quotidien, à surveiller), avec le volume à emporter pour la séance du jour quand elle dure une heure ou plus (400 à 800 ml par heure), les risques d'hyponatrémie et les signes d'alerte, et un avertissement de ne pas remplacer un avis médical. Repères : ACSM (hydratation à l'effort, 2007), EFSA (apports en eau), consensus sur l'hyponatrémie d'effort ; cohérents avec la fiche Hydratation de l'onglet Conseils.
- Au-delà de 150 % de l'objectif, un message dit qu'il est inutile de se forcer.

## Recettes : critères repliables

La carte « Mes critères » est repliable (ouverte par défaut). Repliée, elle résume les critères actifs (« Végétarien · 15 min max. », ou « Aucun critère : toutes les recettes »).

## Ce qui a été fait

- `src/lib/hydration.ts` (pur), `scripts/check-hydration.ts` / `npm run test:hydration` (base, pertes selon la chaleur et le poids, plages à boire, objectif, états de la journée, dernière sortie, validation) ; sauvegarde et tests de sauvegarde étendus.
- `Hydration.tsx`, intégration dans `Nutrition.tsx` et `App.tsx`.
- Vérifié dans le navigateur (ajouts, suppression, estimation, conseils, mobile avec quatre onglets, repli des critères).

## Points ouverts

- L'estimation de la perte ne tient compte ni de l'allure, ni de la météo réelle, ni de l'acclimatation : elle ne vaut que comme ordre de grandeur.
- Aucune heure de prise n'est enregistrée (seulement le volume et le jour) ; pas de distinction eau / boisson d'effort / café.
- Pas de rappel pour boire (une appli sans serveur n'a pas de notifications fiables).

## Prochaines étapes possibles

1. Saisir son poids avant/après une sortie pour étalonner sa propre transpiration.
2. Température de la sortie importée de Strava, pour remplacer le réglage manuel.
