# Foulée – plan de course à pied

Application web (PWA) qui génère un plan d'entraînement semaine par semaine jusqu'au jour de ta course, et te laisse suivre ta progression. Inspirée de Runna.

Tout fonctionne dans le navigateur : aucune donnée n'est envoyée en ligne, le plan et les séances validées sont gardés dans le `localStorage` de l'appareil.

## Lancer le projet

Prérequis : Node.js 20 ou plus.

```bash
npm install
npm run dev        # serveur de développement
npm run build      # build de production dans dist/
npm run preview    # tester le build
npm run test:plan  # vérifie le moteur de plan (Node 22.6+)
```

Une fois en ligne (n'importe quel hébergement statique), l'application peut s'installer sur l'écran d'accueil du téléphone et fonctionne hors connexion.

## Ce que fait la version 0.1

- Choix de la course : 5 km, 10 km, semi-marathon ou marathon, avec sa date.
- Plan adapté au niveau (débutant, intermédiaire, avancé), au nombre de séances par semaine (3 à 6), au jour de la sortie longue et au volume actuel.
- Quatre phases : base, construction, spécifique, affûtage, puis semaine de course. Une semaine allégée toutes les 4 semaines.
- Séances détaillées : footing, fartlek, fractionné, tempo, blocs à allure de course, sortie longue.
- Alertes si le délai est trop court ou si la montée en charge est rapide.
- Suivi : validation des séances, kilomètres courus, compte à rebours, profil des kilomètres par semaine.

## Organisation du code

| Fichier | Rôle |
| --- | --- |
| `src/lib/plan.ts` | Moteur de génération du plan (TypeScript pur, sans dépendance) |
| `src/components/SetupForm.tsx` | Formulaire d'objectif |
| `src/components/PlanView.tsx` | Vue du plan, semaines et séances |
| `src/components/VolumeChart.tsx` | Graphique des kilomètres par semaine |
| `src/storage.ts` | Sauvegarde locale et date du jour |
| `public/sw.js`, `public/manifest.webmanifest` | Installation et mode hors ligne |
| `scripts/check-plan.ts` | Vérifications automatiques du moteur |

## Limites à connaître

- Les séances sont décrites en sensations (effort sur 10), pas en allures chiffrées : le plan ne connaît pas encore ton chrono actuel.
- Le plan est une base générique, pas un avis médical. En cas de douleur ou de reprise après une longue pause, demande l'avis d'un professionnel de santé.

## Pistes pour la suite

1. Allures cibles à partir d'un chrono récent ou d'un objectif de temps.
2. Nutrition : besoins en calories et macros selon l'objectif et la charge de la semaine, journal alimentaire simple.
3. Conseils : recommandations selon la phase du plan et les apports (hydratation, repas avant la sortie longue, récupération).
4. Comptes utilisateurs et synchronisation entre appareils (par exemple Next.js avec une base de données).
5. Import des séances depuis une montre ou Strava.
