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
- Courbes dans le temps (`Series`) : allure, fréquence cardiaque et altitude, lues dans les flux Strava (`/activities/{id}/streams`, une requête de plus, une seule fois par sortie) et ramenées à 100 points (moyenne par tronçon de temps) pour garder le stockage léger. 0 signifie « inconnu » (arrêt, pas de capteur). Un 404 ou une sortie sans flux est marquée « lue ». Un quota ou une coupure ne marque rien : la lecture sera retentée à la prochaine ouverture.
- Affichage : l'allure (la plus rapide en haut) sur un fond d'altitude, puis la fréquence cardiaque. Chaque graphique a des axes gradués (temps en minutes en abscisse, valeurs rondes en ordonnée) et un curseur au survol ou au toucher qui indique le temps et la valeur ; le curseur est synchronisé entre les deux graphiques. Lissage léger à l'affichage (le GPS rend l'allure en dents de scie) ; l'échelle ignore les 5 % de valeurs extrêmes.

## Tests
`check-strava.ts` : courbes (échantillonnage, arrêts, capteur absent, longueurs alignées, client, sauvegarde) et lecture du détail (valeurs invalides écartées, dénivelé négatif conservé, cadence doublée), client réseau (404 marqué lu), application sans écrasement, aller-retour et refus d'une sauvegarde invalide.

## Réparation d'un test existant
`check-workouts.ts` ne se chargeait plus depuis le garde-fou de charge (variable `pyr` déclarée deux fois), donc sa fin n'avait pas tourné. Une fois chargé, trois vérifications étaient à corriger, sans toucher au moteur :
- le seuil « plus de 2000 semaines testées » était trop haut (le balayage en compte 1992) ;
- la charge d'une semaine peut dépasser le plafond quand la sortie longue est déjà facile (la règle ne fait que rendre la sortie longue facile) ;
- deux scénarios cherchaient une semaine « fractionné + tempo » que la rotation ne produit plus : ils construisent maintenant leur cas explicitement.

## Ce qui reste
- Les kilomètres partiels de fin de sortie s'affichent avec leur distance (par exemple « 0,52 km »).
