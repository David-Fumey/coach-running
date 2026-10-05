# 5 octobre 2026 – Installation sur téléphone

## Demande

Une version mobile de Runner, installable comme une app sur le téléphone.

## Décision

Runner est déjà une PWA publiée en HTTPS sur GitHub Pages : on l'installe depuis le navigateur du téléphone, sans magasin d'applications ni compte développeur. Une vraie app native (Capacitor, APK ou App Store) reste possible plus tard, mais demande Android Studio (ou un Mac pour iOS) et, pour les magasins, un compte payant.

## Ce qui a été fait

- Icônes PNG (192, 512 et 180 px pour iOS) générées depuis `public/icon.svg` : Chrome sur Android exige du PNG pour proposer l'installation.
- `manifest.webmanifest` : `id`, `orientation: portrait`, catégories, icônes PNG « any » et « maskable ».
- `index.html` : `apple-touch-icon` en PNG et balises « application web » pour iOS.
- Les zones sûres (encoche, barre de gestes) étaient déjà gérées dans `src/styles.css`.

## Installer

- **Android (Chrome)** : ouvrir https://david-fumey.github.io/coach-running/ → menu ⋮ → « Installer l'application ».
- **iPhone (Safari)** : même adresse → Partager → « Sur l'écran d'accueil ».

## Limites

- Les données restent dans le navigateur de l'appareil : sur le téléphone, importer une sauvegarde JSON depuis le Profil et ressaisir la connexion Strava.
- Sur iOS, les données d'une web app peuvent être effacées après des semaines sans l'ouvrir : faire des sauvegardes.
