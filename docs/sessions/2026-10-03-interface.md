# Session du 3 octobre 2026 : refonte de l'interface

## Décisions

- Garder l'identité (bleu nuit et ambre, Barlow Condensed pour les chiffres et titres, Source Sans 3 pour le texte) et la peaufiner plutôt que la changer.
- **Polices embarquées** (`@fontsource/barlow-condensed`, `@fontsource-variable/source-sans-3`) au lieu de Google Fonts : cela contredisait « rien n'est envoyé en ligne » et cassait la mise en forme hors ligne.
- Les couleurs ont du sens : une couleur par type de séance (footing, qualité, tempo, sortie longue, récupération, course), par phase du plan, et par macro (glucides, protéines, lipides).

## Ce qui a été fait

- `src/styles.css` réécrit et organisé en sections : jetons (couleurs, ombres, rayons), base, composants, écrans, navigation, mouvement.
- Héros en dégradé avec compte à rebours, cartes avec relief, boutons et champs avec états (survol, focus, appui), puces et pastilles.
- Barre d'onglets avec icônes (SVG intégrés, `src/components/icons.tsx`) et flou d'arrière-plan.
- Accueil : prochaine séance avec bande de couleur, **semaine en pastilles** (faite, aujourd'hui, à faire, repos), anneau de progression du plan.
- Nutrition : anneau d'énergie et barres colorées par macro. Programme : chevrons, repères de couleur par type de séance. Graphiques : grille, cartes.
- Animation d'entrée discrète, désactivée avec `prefers-reduced-motion`.
- Vérifié dans le navigateur : mobile (375 px) et ordinateur, thèmes sombre et clair, accueil, programme, progrès, nutrition, formulaire d'activité, écran de départ.

## Points ouverts

- Pas de contrôle automatisé de l'accessibilité (contrastes, lecteur d'écran) : seulement des choix prudents (zones de 44 px, focus visible, libellés cachés pour les pastilles).
- Écran de relecture du plan, page Profil et fenêtres de confirmation non revus visuellement après la refonte.
- Sur grand écran, la colonne reste étroite (44 rem) : une mise en page en deux colonnes pourrait être envisagée.
- Le serveur de dev ne voit pas toujours les fichiers écrits depuis le shell : `touch` du fichier, ou rechargement du serveur.

## Prochaines étapes possibles

1. Partie « Conseils ».
2. Revue d'accessibilité (contrastes, navigation au clavier, lecteur d'écran).
3. Mise en page adaptée aux grands écrans.
