# 4 octobre 2026 – Liste de courses

## Demande

Reprise de la liste du 3 octobre : liste de courses à partir des recettes.

## Ce qui a été fait

- `addToShopping`, `removeFromShopping` et `shoppingLines` (dans `src/lib/recipes.ts`) : une recette ajoutée avec son nombre de portions (cumulées si elle y est déjà), et les ingrédients de toutes les recettes regroupés par aliment (quantités additionnées, recettes d'origine gardées), triés par ordre alphabétique. Six vérifications de plus dans `npm run test:recipes`.
- Bouton « Ajouter à la liste de courses » dans chaque recette dépliée (avec le nombre de portions réglé).
- `src/components/ShoppingList.tsx` : carte « Liste de courses » en haut de l'écran Recettes, visible dès qu'il y a une recette : recettes ajoutées (avec « Retirer »), lignes à cocher en faisant les courses (barrées une fois cochées), « Copier ce qui reste » (presse-papiers), « Tout décocher » et « Vider la liste » (avec confirmation).
- Stockage dans `foulee.shopping.v1`, **hors sauvegarde JSON** : la liste est provisoire.
- Vérifié à l'écran : deux recettes (1,5 et 1 portion), quantités additionnées, ligne cochée.

## Limites

- Les quantités sont celles des recettes (arrondies comme dans les fiches) : pas de conversion en conditionnements de magasin.
- Pas de classement par rayon.

## Reste

- Courbe de progression des records.
