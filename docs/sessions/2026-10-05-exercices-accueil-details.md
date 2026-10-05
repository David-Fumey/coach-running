# 5 octobre 2026 – Exercices détaillés sur l'accueil

## Demande

Sur l'accueil, « Échauffement et étirements conseillés » listait les exercices sans dire en quoi ils consistent.

## Décision

Plutôt qu'une page « Prochaine séance », chaque exercice de la liste se déplie sur place : on reste dans le cadre de la prochaine séance.

## Ce qui a été fait

- `DrillCard.tsx` : la fiche d'un exercice (figures, ce qu'il travaille, comment le faire, conseils, erreur fréquente) sort de `Drills.tsx` pour être partagée. Elle s'ouvre seule, ou pilotée de l'extérieur dans l'onglet Exercices (comme avant).
- `SessionDrills.tsx` : chaque exercice de la routine « Avant » et « Après » est une fiche dépliable numérotée, avec sa dose et sa zone du corps. Le lien devient « Voir toutes les fiches ».
- `npm run test:drills` et les dix-neuf autres scripts restent verts.
