# 5 octobre 2026 – Données Strava supplémentaires

## Demande

Récupérer tout ce que l'API Strava offre et qui n'était pas encore utilisé, sauf les tours, le profil, les photos et les commentaires.

## Ce qui a été fait

**Dans le détail d'une sortie** (lu avec la requête de détail et celle des flux, plus une requête de zones) :
- vitesse moyenne et maximale, altitudes basse et haute, temps à l'arrêt ;
- puissance moyenne, pondérée et maximale, **seulement si elle est mesurée** (Strava estime des watts sans capteur : ils sont ignorés) ;
- description, type de sortie (compétition, sortie longue, séance), chaussures utilisées ;
- courbes de cadence, puissance, température et pente, en plus de l'allure et de la FC ;
- tracé de la sortie dessiné en SVG, sans fond de carte (aucun service tiers, lisible hors ligne), avec un repère qui suit le curseur des courbes ;
- zones de FC et de puissance (temps passé par zone) ;
- segments Strava parcourus, avec la mention « Record perso » ;
- les anciens détails (version 1) sont relus une fois à l'ouverture de la sortie (`DETAIL_VERSION` dans `activities.ts`).

**Compte** (Profil, carte Strava, section dépliable « Mon compte Strava ») :
- totaux de course : 4 dernières semaines, année, depuis toujours ;
- chaussures avec kilométrage et alerte à 700 km (repère courant de 600 à 800 km) ;
- itinéraires de course enregistrés (tracé en vignette) ;
- clubs ;
- lecture à l'ouverture si elle date de plus d'un jour, bouton « Actualiser ».

**Droits** : la connexion demande maintenant `read,activity:read,profile:read_all,read_all`. Les droits accordés sont gardés dans `foulee.strava.v1`. Une connexion plus ancienne affiche un bouton « Accorder les droits manquants » (reconnexion sans nouvel import). Chaque rubrique se dégrade seule : droit refusé, abonnement Strava requis (zones) ou quota ne bloquent pas les autres.

**Vie privée** : de `GET /athlete`, seuls l'identifiant et les chaussures sont gardés.

## Tests

`npm run test:strava` passe de 132 à 176 vérifications : décodage du tracé, détail étendu, flux, zones, compte, droits, versions, sauvegarde. Les dix-neuf scripts et le build sont verts.

## Limites

- Non essayé avec un vrai compte Strava : les réponses sont simulées d'après la documentation de l'API. À vérifier : les zones demandent un abonnement Strava, et le droit `read_all` pour les itinéraires est à confirmer à la première connexion.
- Les segments dépendent de ce que renvoie `include_all_efforts=false` ; à vérifier sur une vraie sortie.
- Le détail étendu alourdit un peu `foulee.activities.v1` (tracé, courbes) : surveiller la taille du stockage si l'historique est très long.
- Tours, profil, photos et commentaires volontairement exclus.
