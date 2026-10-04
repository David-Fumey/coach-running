# 4 octobre 2026 – Onglet Exercices

## Demande

Une section « Exercices » : des exercices d'échauffement avant les séances, des étirements après, chacun détaillé dans une carte dépliable.

## Ce qui a été fait

- `src/lib/drills.ts` (pur) : 12 exercices d'échauffement et 10 étirements. Chaque fiche donne les muscles visés, le dosage (répétitions, secondes à tenir ou mètres, par côté), les gestes pas à pas, des conseils et l'erreur fréquente.
- Deux routines construites à partir des fiches : `warmupRoutine(fast)` (footing ou sortie longue, ou séance rapide avec skipping et lignes droites progressives, placées en dernier) et `stretchRoutine(full)` (version courte des grands groupes musculaires ou complète). La durée est estimée.
- Nouvel onglet « Exercices » (sixième de la barre, icône de personne qui s'étire) : bascule Échauffement / Étirements, carte de repères, routine conseillée avec ses deux variantes, puis toutes les fiches en cartes dépliables (même présentation que les conseils de nutrition, liseré de couleur par zone du corps). Un clic sur un exercice de la routine ouvre sa fiche et y amène l'écran.
- `scripts/check-drills.ts` et `npm run test:drills` : 29 vérifications (fiches complètes, dosages, durées, contenu des routines). Les dix-huit scripts sont verts.

## Décisions

- L'échauffement proposé est de la mobilité dynamique à faire avant de partir ; le footing d'échauffement reste celui de la séance du plan.
- Les étirements longs sont réservés à l'après-séance, comme le rappelle le texte de l'onglet.
- Les exercices sont les mêmes pour tous les niveaux ; seules les routines changent selon le type de séance.

## Reste

- Relier à la séance du jour : proposer sur l'accueil la routine adaptée au type de séance (rapide ou non).
- Un relecteur sportif (coach ou kiné) devrait valider le contenu.
