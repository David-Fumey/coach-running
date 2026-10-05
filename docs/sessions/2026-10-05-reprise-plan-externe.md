# 5 octobre 2026 – Reprise d'un plan externe (Runna)

## Demande

Reprendre dans Runner le programme en cours sur Runna, dont l'utilisateur a envoyé des captures d'écran du calendrier. Runna n'a pas d'export : les séances ont été relues sur les captures.

## Décisions

- Les séances sont reprises **telles quelles** (date, titre, kilomètres). Runner n'invente ni déroulé ni allure pour elles.
- Le plan s'enregistre avec `plan.source` (ex. « Runna »). La mise à jour du catalogue (`upgradePlan`) et le pas à pas deviné pour les anciennes séances (`workoutOf`) l'ignorent : ses séances ne sont jamais réécrites.
- **Décalage** (`shiftPlan`) : le plan repris peut être décalé. Les séances ne sont pas régénérées : elles sont décalées de la durée de la pause (même jour de la semaine, mêmes titre et kilomètres), et pour tenir la date de la course on retire autant de semaines d'entraînement que de semaines de pause, celles qui précèdent l'affûtage. Refusé si la pause ne laisse pas de place à l'affûtage. La proposition automatique après 3 séances manquées et l'annulation du décalage fonctionnent aussi.
- Activités et séances cochées sont gardées (contrairement à la création d'un plan neuf). Le plan passe par l'écran de relecture avant validation.
- Les séances après la course ne sont pas reprises (un avertissement le dit) : après la course, on refait un plan.

## Ce qui a été fait

- `src/lib/planimport.ts` : lecture du texte collé (`date ; titre ; km`, erreurs signalées ligne par ligne), type deviné d'après le titre (longue, course, tempo, qualité, facile…), construction du plan (semaines du lundi de la première séance à la semaine de la course, phases spécifique, affûtage, course).
- `src/components/ImportPlanForm.tsx` et lien « Je suis déjà un plan ailleurs » en bas du formulaire de création.
- `npm run test:import` : 33 vérifications, avec le vrai plan de semi-marathon de l'utilisateur ; les vingt scripts sont verts.
- Vérifié à l'écran : formulaire, relecture (4 semaines, 11 séances, 35 / 28,5 / 23 / 27,6 km) et onglet Programme.

## Limites

- Trois titres étaient tronqués sur les captures (« Sortie longue progressive… », « Sortie longue d'entraînem… », « Km d'entraînement à allure… ») : repris sous une forme courte.
- Le niveau est fixé à « intermédiaire » (il n'est pas dans le plan d'origine).
- Les semaines d'après la course (2 au 29 novembre sur Runna) ne sont pas reprises.
