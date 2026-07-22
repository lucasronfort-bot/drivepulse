# DrivePulse Web V8 — Adaptive Stem Engine

DrivePulse V8 remplace le moteur musical procédural principal par un morceau composé par des artistes et découpé en stems synchronisés.

## Source musicale

`Kalte Ohren (Cold Ears)` — starfrosch feat. Jerry Spoon, sous licence CC BY 3.0.

Consulter `ATTRIBUTION.md` pour le crédit complet.

## Architecture audio

- tempo fixe : 120 BPM ;
- mesure : 4/4 ;
- boucle : 8 mesures, soit 16 secondes ;
- 6 séquences : Intro, Groove, Montée, Respiration, Refrain et Finale ;
- 12 personnages/stems ;
- changement de séquence uniquement à la limite d'une boucle ;
- niveaux des stems modifiés continuellement selon la conduite.

## Personnages

- Pulse : kick ;
- Clap : snare et rim ;
- Spark : hi-hats ;
- Sub : sub-bass ;
- Bounce : basses médium et haute ;
- Keys : Rhodes ;
- Cloud : pads et textures ;
- Hook : pluck et synth lead ;
- Motion : bongos et percussions ;
- Guitar : guitare ;
- Rise : risers, lifts et impacts ;
- Aura : delay et réverbération.

## Chargement

Seule la séquence actuelle et la séquence demandée sont décodées. Les autres fichiers restent compressés, afin de limiter la mémoire utilisée sur iPhone.

Les fichiers audio sont mis en cache progressivement par le service worker après leur première utilisation.

## Installation GitHub

Déposer tous les fichiers et dossiers à la racine de la branche :

- `index.html`
- `style.css`
- `app.js`
- `manifest.webmanifest`
- `sw.js`
- `README.md`
- `ATTRIBUTION.md`
- `audio/kalte-ohren/`

Commit conseillé :

`DrivePulse V8 - adaptive CC BY stem engine`
