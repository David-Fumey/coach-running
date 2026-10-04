# 4 octobre 2026 – Activités par mois

## Demande

Sur PC, afficher les activités sur une seule colonne en pleine largeur (comme les semaines du programme), et les séparer par mois, chaque mois pouvant se plier et se déplier.

## Ce qui a été fait

- `groupByMonth` (dans `src/lib/activities.ts`) : regroupe les activités par mois civil, du plus récent au plus ancien, avec le nombre de sorties, les kilomètres et la durée de chaque mois. Il ne modifie pas la liste d'origine. Sept nouvelles vérifications dans `npm run test:activities`.
- `Activities.tsx` : un bandeau par mois (« Septembre 2026 · 11 sorties · 90,8 km · 10 h 34 ») qui se plie et se déplie. Le mois le plus récent est ouvert au départ, les autres fermés ; le choix de l'utilisateur est gardé tant qu'il reste sur l'écran.
- Sur PC, les sorties repassent sur une seule colonne en pleine largeur, ce qui supprime aussi la règle qui élargissait une sortie ouverte.

## Vérification

Contrôlé à 1400 px avec les vraies données (six mois, du plus récent à avril) : ouverture et fermeture de plusieurs mois, ouverture d'une sortie dans un mois. Une première version plantait au pliage (lecture de l'événement dans une mise à jour d'état différée) ; corrigée avant le commit.

## Reste

- Les mois pourraient avoir un bouton « tout déplier / tout replier » si la liste s'allonge.
