# 4 octobre 2026 – Recettes favorites

## Demande

Reprise de la liste du 3 octobre : recettes favorites.

## Ce qui a été fait

- `toggleFavorite` et `knownFavorites` (dans `src/lib/recipes.ts`) : ajout / retrait sans doublon, et nettoyage des identifiants qui ne désignent plus une recette. Trois vérifications de plus dans `npm run test:recipes`.
- Les favorites sont dans `foulee.favorites.v1` et **dans la sauvegarde JSON** (`favorites`, liste d'identifiants, validée à la lecture ; une ancienne sauvegarde sans ce champ donne une liste vide). `npm run test:backup` couvre l'aller-retour et les valeurs invalides.
- Écran Recettes : bouton « ☆ Ajouter aux favorites » / « ★ Retirer des favorites » dans chaque recette dépliée, étoile dorée devant le nom, et pastille « ★ Favorites (n) » à côté du compteur qui n'affiche que les favorites (en respectant les critères réglés). Message dédié quand aucune favorite ne correspond.
- Vérifié à l'écran : deux favorites ajoutées, filtre 12 → 2 recettes, étoiles et stockage corrects.

## Reste

- Autres reprises : courbe de progression des records, liste de courses.
