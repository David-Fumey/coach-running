# 4 octobre 2026 – Interface plus fine et plus colorée

## Demande

L'interface paraissait trop épaisse, « pâteuse » et grosse. L'utilisateur voulait aussi plus de couleur.

## Ce qui a changé (tout est dans `src/styles.css`)

**Finesse**
- Échelle générale réduite de 6 % (`html { font-size: 93.75% }`) : tout ce qui est en `rem` suit.
- Arrondis plus petits (`--r` 1 → 0,75 rem, `--r-sm` 0,625 → 0,5 rem, `--r-lg` 1,375 → 1 rem) et ombres plus légères.
- Bordures de 1,5 / 2 px ramenées à 1 / 1,5 px (boutons, champs, pastilles, jours de la semaine, coches) ; liserés latéraux de 4 à 6 px ramenés à 3 / 4 px.
- Titres d'affichage plus petits : titre de page 2,5 → 2 rem, titre de carte 1,5 → 1,3 rem, héros, prochaine séance, chiffres des tuiles, kilométrage des semaines et des activités.
- Espacements resserrés (cartes, résumés de semaine, lignes de séance, barre d'onglets). Les cibles tactiles restent à 40 px ou plus.

**Couleur**
- Fond : deux halos très doux (violet et turquoise) au lieu d'un aplat bleu.
- Héros : dégradé plus vif (bleu, halo ambre et halo turquoise).
- Tuiles de chiffres (Progrès, Accueil, détail d'une sortie) : liseré supérieur d'une couleur différente par tuile ; en liste empilée, liseré à gauche.
- Prochaine séance : kilométrage et étiquette prennent la couleur du type de séance.
- Programme : titre de phase et kilométrage de la semaine à la couleur de la phase ; kilométrage de chaque séance à la couleur de son type.
- Barre d'onglets : une couleur par onglet (ambre, bleu, turquoise, violet, vert), l'onglet actif est teinté.
- Bouton principal en léger dégradé ambre, pastille cochée en bleu, barre de progression en dégradé.

## Vérification

`npm run build` passe ; les 17 scripts de test ne sont pas concernés (aucun changement de logique). Contrôle à l'écran en thème sombre (Accueil, Progrès) et clair en largeur mobile (Programme), avec les vraies données (lecture seule).

## Reste

- Le CSS comporte des tailles écrites en dur dans les sections plus anciennes (Nutrition, Conseils, Recettes) : à repasser si l'une d'elles paraît encore lourde.
- Les nuances de couleur sont des jetons en tête de feuille (`--c-green`, `--tab-home`) : faciles à ajuster.
