# 4 octobre 2026 – Progrès par jour

## Demande

Ajouter un affichage par jour à l'écran Progrès, en plus des semaines, mois et années.

## Ce qui a été fait

- `src/lib/progress.ts` : nouvelle période `jour` (une période = un jour, début et fin identiques, le lendemain pour la suivante) ; fenêtre de 30 jours affichée d'un coup, le reste s'atteint avec les flèches. Deux sorties le même jour s'additionnent ; un jour sans sortie vaut zéro et n'a pas d'allure.
- Interface : un quatrième choix « Jours » (en premier) dans le menu des graphiques ; les deux graphiques (distance ou dénivelé, allure ou fréquence cardiaque) s'affichent par jour, avec une étiquette « 5 oct. » sous l'axe (une sur plusieurs selon la place) et le jour complet dans le détail (« mercredi 9 septembre 2026 »).
- Dix nouvelles vérifications dans `npm run test:progress` (58 au total) : une période par jour du plan, début = fin, cumul de deux sorties, jour vide, jour en cours, kilomètres prévus, périodes contiguës, somme des jours égale à celle des semaines.

## Vérification

Contrôlé à 1400 px avec les vraies données (portée Total) : trente barres, un clic sur un jour affiche ses chiffres (7,5 km, 53 min, 7:06 /km, 144 bpm) ; quatre boutons visibles à 375 px. Tests progrès, records et activités verts, build vert.

## Reste

- Par défaut l'écran reste sur « Semaines » ; le choix n'est pas mémorisé d'une visite à l'autre.
- L'allure par jour est une série de points isolés quand les sorties sont espacées.
