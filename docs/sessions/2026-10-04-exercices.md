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

## Complément : illustrations

- `src/lib/figures.ts` (pur) : un bonhomme en traits dessiné d'après les angles de ses membres (bras, jambes, tronc, pieds), posé sur le sol et centré. Vue de profil ou de face (`spread`), mur et marche optionnels. Les conventions d'angle sont décrites en tête du fichier.
- `src/lib/poses.ts` : une ou deux postures par exercice (départ et arrivée du mouvement, ou position tenue pour un étirement), avec une légende.
- `src/components/Figure.tsx` : dessin SVG. Les membres du premier plan prennent la couleur de la zone du corps, ceux du second plan sont grisés. Les images sont affichées en haut de chaque carte, avec leur légende.
- Le texte de l'étirement de la plante du pied a été simplifié (jambe tendue, orteils tirés vers soi) pour correspondre au dessin.
- Contrôle : une feuille temporaire a affiché les 22 exercices ; plusieurs postures ont été corrigées (papillon, position de l'enfant, pont, cercles de cheville, montée sur pointes). `npm run test:drills` compte 39 vérifications, dont une par exercice (images présentes, personnages dans le cadre, sur le sol, mur et marche).

## Limites

- Ce sont des silhouettes schématiques, pas des photos : elles montrent le placement des membres, pas les détails (rotation du buste, position du pied, regard). Les textes restent la référence.
- Les mouvements hors du plan de profil (rotation du buste, cercles de cheville) sont suggérés par deux images, pas animés.
- Idée suivante : de courtes animations entre les deux images, ou de vraies photos si l'utilisateur en fournit.
