# 4 octobre 2026 – Suivi de nutrition sur PC

## Demande

L'écran Suivi de nutrition n'avait jamais été vu en vrai et restait sur une colonne sur PC.

## Ce qui a été fait

- Écran vu pour la première fois avec un profil et deux repas de test (saisis dans le `localStorage` du navigateur de développement, pas dans l'application de l'utilisateur) : objectifs du jour (anneau de calories, barres de glucides, protéines, lipides, conseils) et journal alimentaire. Aucun défaut visible.
- À partir de 1024 px : la semaine reste en pleine largeur, les objectifs du jour sont à gauche, le journal à droite, le pied de page en pleine largeur. Une seule colonne sur téléphone.
- Contrôlé à 375 px (pas de débordement), 1024 px et environ 1400 px.

## Reste

- Le contenu nutritionnel est toujours à faire relire par un diététicien.
