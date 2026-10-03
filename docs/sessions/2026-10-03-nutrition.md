# Session du 3 octobre 2026 : nutrition

## Décisions

- Inspiration : les apps qui adaptent l'apport à la charge (Gauge, MyRunBuddy : plus de glucides les jours durs, moins les jours de repos) et les repères de nutrition sportive (glucides en g/kg selon la charge, 30 à 60 g/h pendant l'effort).
- Les objectifs de chaque jour viennent du plan et des activités : la nutrition se cale sur la charge réelle.
- Estimation : métabolisme de base de Mifflin-St Jeor × 1,3 (vie quotidienne hors course) + environ 1 kcal par kg et par km couru. Objectif de poids : ±10 %, mais **jamais de déficit** avant ou pendant une séance dure, une sortie longue, une course, ni la veille de course.
- Glucides (g/kg) : repos 4, footing facile 5, séance intense 6, sortie longue 7, course 7, veille de course 8 (5 km, 10 km), 9 (semi), 10 (marathon). Protéines 1,6 g/kg. Lipides : le complément énergétique, au moins 0,8 g/kg. L'énergie totale découle des macros.
- Journal alimentaire manuel (nom, kcal, macros facultatives) avec « aliments récents » pour préremplir. Pas de base d'aliments ni de scan de code-barres (il faudrait un service en ligne).

## Ce qui a été fait

- `src/lib/nutrition.ts` (moteur pur) et `npm run test:nutrition` (26 vérifications).
- Onglet Nutrition : profil (sexe, âge, poids, taille, objectif), bandeau de la semaine avec le type de journée, objectifs du jour avec barres de progression, conseils du jour (avant, pendant pour les sorties de plus de 1 h 15, après), journal.
- Nouvelles clés `localStorage` : `foulee.profile.v1`, `foulee.foods.v1`. Elles ne sont pas effacées quand on recrée le plan.
- Vérifié : `tsc`, build, les trois scripts de test, et parcours dans le navigateur (profil, objectifs, ajout au journal).

## Points ouverts

- Les repères sont génériques : à relire par un diététicien-nutritionniste du sport avant tout usage large. Mineurs exclus (âge minimum 16 ans), pas de prise en compte de grossesse, diabète ou autres pathologies.
- L'allure utilisée pour estimer la durée des sorties est la moyenne des activités, 6:00/km par défaut.
- Pas d'hydratation suivie, pas de modification d'un aliment (suppression seulement), pas de copie de la veille.
- Le serveur de dev (Vite) n'a pas vu une modification faite avec `sed -i` : un `touch` du fichier suffit.

## Prochaines étapes possibles

1. Partie « Conseils » : fiches par phase du plan et par apport recherché (fer, hydratation, nutrition de course).
2. Suivi de l'hydratation, copie d'un repas de la veille, repas types.
3. Résumé nutrition hebdomadaire dans Progrès (apports contre objectifs).
