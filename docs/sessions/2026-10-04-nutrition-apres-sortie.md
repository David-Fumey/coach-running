# 4 octobre 2026 – Nutrition après une sortie

## Demande

Depuis une activité, un lien vers la nutrition qui conseille la journée en fonction de l'activité effectuée.

## Ce qui a été fait

- **Lien** « Nutrition de ce jour » dans le détail d'une activité (Activités). Il ouvre Nutrition > Suivi sur le jour de l'activité. Le suivi calculait déjà les objectifs du jour d'après la distance réellement courue ; il s'ouvre maintenant directement sur le bon jour (`startDate`).
- **`recoveryAdvice`** (dans `src/lib/nutrition.ts`) : conseils de récupération selon la durée de la sortie et, si elle suit le plan, le type de séance. Courte (moins de 45 min, hors séance intense) : pas d'encas particulier. Moyenne : 0,8 à 1 g de glucides par kg et environ 0,3 g de protéines par kg (20 à 40 g) dans l'heure. Longue (90 min et plus, ou course) : 1 à 1,2 g de glucides par kg et un second repas riche en glucides dans les 2 à 3 heures. Séance intense : glucides faciles à digérer. Rappel de l'hydratation. Sans profil, pas de quantité chiffrée.
- Carte « Après ta sortie » sous les objectifs du jour dans le Suivi, pour chaque sortie du jour affiché.
- **Sortie libre** : à partir de 15 km (`LONG_FREE_RUN_KM`), une sortie hors plan est traitée comme une sortie longue (7 g de glucides par kg, conseils de sortie longue) au lieu d'une sortie facile.
- `npm run test:nutrition` : 11 vérifications de plus ; les dix-neuf scripts sont verts.
- Vérifié à l'écran : sortie de 16 km, lien, jour affiché, carte de récupération sur PC.

## Limites

- Les repères sont ceux de la nutrition sportive courante, pas un avis médical ; ils restent à faire relire par un diététicien.
- L'intensité d'une sortie libre n'est pas connue : seule la durée compte.
