# 4 octobre 2026 – Version PC

## Demande

L'application ressemblait à un téléphone posé au milieu de l'écran sur PC (colonne unique d'environ 700 px). L'utilisateur a demandé une vraie version pour grand écran.

## Ce qui a changé

Tout est dans `src/styles.css` (section « Version PC », à partir de 1024 px de large) et une ligne de balisage dans `TabBar.tsx` (le nom de l'application, visible seulement sur PC). Le téléphone et la tablette en portrait ne changent pas.

- **Menu latéral** à la place de la barre du bas : nom de l'application en haut, onglets en liste verticale avec leur couleur, onglet actif teinté. Le contenu laisse la place au menu (`body:has(.tabbar)`).
- **Contenu plus large** : jusqu'à 72 rem au lieu de 44 rem dans le hub. Les écrans de démarrage (formulaire, relecture du plan) gardent leur largeur, comme la page Profil.
- **Accueil** : le héros et la prochaine séance en pleine largeur (les blocs échauffement, séance et retour au calme se rangent côte à côte), puis la semaine et le bilan côte à côte dessous.
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

## Complément : Progrès et Hydratation

- **Progrès** : filtres sur une ligne (menu à gauche, rappel de la période à droite), chiffres par rangées de quatre, records en pleine largeur, puis les graphiques « Distance » et « Allure moyenne » en pleine largeur, l’un sous l’autre, pour rester lisibles.
- **Hydratation** : les cartes (suivi du jour, sept derniers jours, eau perdue, transpiration) se répartissent sur deux colonnes sans trou ; le rappel de profil et les conseils d'hydratation gardent la pleine largeur.
- Contrôlé à 1400 px avec les vraies données. L'écran « Suivi » de Nutrition n'a pas pu être vu (pas de profil nutrition saisi) : il garde une seule colonne.
- La page Profil et le Suivi nutrition restent sur une colonne : ce sont des formulaires et un journal où une colonne unique se lit bien.

## Correction : trou dans les cartes d'outils du Programme

- Les cinq cartes d'outils (graphique, objectif, test de contrôle, allures cibles, décalage) étaient sur une grille à deux colonnes : la rangée suivait la carte la plus haute, d'où un grand vide entre le graphique et « Mon test de contrôle ».
- Elles sont maintenant dans deux colonnes indépendantes (`plan__tools` et `plan__col`) : graphique et objectif à gauche, test, allures et décalage à droite. Sans trou, et déplier une carte ne déplace pas les autres (une première version en colonnes CSS faisait sauter une carte d'une colonne à l'autre).
- Une seule colonne sur téléphone, dans le même ordre qu'avant.
