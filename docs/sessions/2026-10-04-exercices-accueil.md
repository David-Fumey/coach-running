# 4 octobre 2026 – Exercices sur l'accueil

## Demande

Relier les Exercices à la séance du jour : proposer sur l'accueil la routine adaptée au type de séance.

## Ce qui a été fait

- `routinesFor(type)` dans `src/lib/drills.ts` : séance rapide (qualité, tempo, test, course) = échauffement avec gammes et lignes droites ; étirements complets pour les séances rapides et la sortie longue, courts sinon.
- `src/components/SessionDrills.tsx` : bloc replié « Échauffement et étirements conseillés » sous le déroulé de la prochaine séance (Avant / Après, durée et dosage de chaque exercice), avec un lien vers l'onglet Exercices.
- `npm run test:drills` : 4 vérifications de plus. Vérifié à l'écran (fartlek : gammes présentes).

## Reste

- Les exercices de l'accueil ne sont pas dépliables : le détail est dans l'onglet Exercices (le lien n'ouvre pas la fiche précise).
