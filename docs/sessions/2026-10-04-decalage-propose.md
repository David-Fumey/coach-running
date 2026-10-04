# 4 octobre 2026 – Décalage proposé après des séances manquées

## Demande

Reprise de la liste du 3 octobre : proposer le décalage du programme quand des séances sont manquées.

## Ce qui a été fait

- `missedStreak` (dans `src/lib/shift.ts`) : remonte depuis la séance passée la plus récente et compte les séances de course ni validées ni liées à une activité. La série s'arrête à la première séance faite et à une semaine de pause (un décalage déjà fait la referme). À partir de 3 séances (`MISSED_THRESHOLD`), elle propose 1 à 3 semaines de pause selon l'ancienneté de la première séance manquée, sans jamais dépasser ce que `shiftPlan` accepte. Huit vérifications de plus dans `npm run test:shift`.
- `src/components/ShiftSuggestion.tsx` : bandeau sur l'accueil (« N séances manquées d'affilée »), bouton « Décaler de N semaines » (avec confirmation, annulable ensuite depuis le Programme) et « Plus tard ». « Plus tard » mémorise la date de la dernière séance manquée dans `foulee.shiftseen.v1` (hors sauvegarde) : le bandeau ne revient qu'après une nouvelle séance manquée.
- Vérifié à l'écran avec un plan de test vieilli de trois semaines : le bandeau s'affiche en pleine largeur sur PC, le décalage met 3 semaines en pause et l'annulation est disponible. Les dix-huit scripts sont verts.

## Reste

- Les séances de renforcement manquées ne comptent pas.
- Autres reprises du 3 octobre : courbe de progression des records, recettes favorites, liste de courses.
