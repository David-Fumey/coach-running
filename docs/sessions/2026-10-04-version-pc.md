# 4 octobre 2026 – Version PC

## Demande

L'application ressemblait à un téléphone posé au milieu de l'écran sur PC (colonne unique d'environ 700 px). L'utilisateur a demandé une vraie version pour grand écran.

## Ce qui a changé

Tout est dans `src/styles.css` (section « Version PC », à partir de 1024 px de large) et une ligne de balisage dans `TabBar.tsx` (le nom de l'application, visible seulement sur PC). Le téléphone et la tablette en portrait ne changent pas.

- **Menu latéral** à la place de la barre du bas : nom de l'application en haut, onglets en liste verticale avec leur couleur, onglet actif teinté. Le contenu laisse la place au menu (`body:has(.tabbar)`).
- **Contenu plus large** : jusqu'à 72 rem au lieu de 44 rem dans le hub. Les écrans de démarrage (formulaire, relecture du plan) gardent leur largeur, comme la page Profil.
- **Accueil** : le héros en haut sur toute la largeur, la séance du jour à gauche, la semaine et le bilan empilés à droite.
- **Programme** : les cartes d'outils (nouvelles séances, graphique, objectif, allures, décalage) deux par deux ; la liste des semaines reste sur une seule colonne, en pleine largeur.
- **Activités** : sorties sur deux colonnes ; une sortie ouverte prend toute la largeur et affiche ses deux courbes côte à côte.
- **Exercices** : repères et routine côte à côte, cartes sur deux colonnes.
- **Conseils et Recettes** : cartes sur deux colonnes (une carte ouverte ne déforme pas sa voisine).
- **Menus à choix** (Échauffement / Étirements, périodes, etc.) : largeur limitée à 30 rem (38 rem pour quatre choix) au lieu de s'étirer sur toute la page.

## Vérification

Contrôlé à 1400 et 1024 px, puis en mobile (375 px) pour s'assurer que rien n'a bougé : Accueil, Programme, Activités (sortie ouverte), Progrès, Exercices, Nutrition (Conseils et Recettes). Pas de défilement horizontal. Build vert ; la logique n'a pas changé.

## Reste

- Les écrans Suivi, Hydratation et Profil n'ont pas été retravaillés pour le PC : ils restent sur une colonne.
- Progrès garde ses graphiques en pleine largeur ; ils pourraient être placés par deux.
- Tablette en paysage (moins de 1024 px) : disposition téléphone, barre du bas.
