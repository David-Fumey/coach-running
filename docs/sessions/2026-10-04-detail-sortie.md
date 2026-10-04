# Détail d'une sortie importée (4 octobre 2026)

## Demande
Les activités de la liste n'affichaient qu'une ligne de résumé. Pouvoir cliquer sur une sortie passée et voir tous ses détails.

## Ce que l'import gardait avant
Distance, durée, fréquence cardiaque moyenne et maximale, dénivelé positif, titre, température et meilleurs efforts (5 km, 10 km, semi, marathon). Rien du reste de la réponse de Strava.

## Ce qui est fait (v0.21)
- `Activity.detail` (`RunDetail`) : temps par kilomètre (`splits`, avec FC et dénivelé par kilomètre), cadence en pas par minute (la valeur de Strava, donnée pour un seul pied, est doublée), calories, durée totale arrêts compris, appareil.
- `parseRunDetail` (src/lib/strava.ts) lit le détail d'une activité Strava. Il rend toujours un objet pour une réponse lisible, même sans kilomètres (tapis) : la sortie est alors marquée « lue » et n'est plus redemandée. Une sortie supprimée sur Strava (404) est marquée de la même façon.
- La synchro lit déjà le détail de quelques sorties (les 8 plus récentes, les candidats aux meilleurs efforts) : ces lectures remplissent maintenant aussi `detail`, sans requête de plus.
- Pour les autres, `loadDetail` (src/useStrava.ts) lit le détail à la demande : une seule requête à l'ouverture, avec renouvellement du jeton si besoin. Le résultat est gardé, donc jamais relu.
- Écran : bouton « Voir le détail » sur chaque sortie ; grille de chiffres, puis barres « temps par kilomètre » (le kilomètre le plus rapide en accent). Une sortie saisie à la main n'a que son résumé, et le dit.
- La sauvegarde conserve et valide le détail (`validDetail`).

## Tests
`check-strava.ts` : lecture du détail (valeurs invalides écartées, dénivelé négatif conservé, cadence doublée), client réseau (404 marqué lu), application sans écrasement, aller-retour et refus d'une sauvegarde invalide.

## Réparation d'un test existant
`check-workouts.ts` ne se chargeait plus depuis le garde-fou de charge (variable `pyr` déclarée deux fois), donc sa fin n'avait pas tourné. Une fois chargé, trois vérifications étaient à corriger, sans toucher au moteur :
- le seuil « plus de 2000 semaines testées » était trop haut (le balayage en compte 1992) ;
- la charge d'une semaine peut dépasser le plafond quand la sortie longue est déjà facile (la règle ne fait que rendre la sortie longue facile) ;
- deux scénarios cherchaient une semaine « fractionné + tempo » que la rotation ne produit plus : ils construisent maintenant leur cas explicitement.

## Ce qui reste
- Le tracé de la fréquence cardiaque et de l'allure dans le temps (flux Strava) demanderait une requête de plus par sortie : à voir si le besoin se confirme.
- Les kilomètres partiels de fin de sortie s'affichent avec leur distance (par exemple « 0,52 km »).
