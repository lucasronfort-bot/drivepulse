# DrivePulse Web V8.1 — Quality, Low Latency & Sensor Fusion

La V8.1 corrige les trois problèmes constatés pendant le premier essai en voiture : qualité audio, latence musicale et mauvaise interprétation de l’accélération par l’iPhone.

## 1. Nouveau pipeline audio

Les 48 stems FLAC ne sont plus convertis en douze pistes AAC à faible débit.

Ils sont regroupés hors ligne en six bus cohérents :

- `RHYTHM` : kick, snare et rim ;
- `TOPS` : hi-hats, bongos et percussions ;
- `BASS` : sub, basse médium et basse haute ;
- `HARMONY` : Rhodes, pads, guitare et textures ;
- `LEAD` : pluck et synthés principaux ;
- `FX` : risers, lifts et downlifters.

Caractéristiques :

- AAC-LC 256 kb/s ;
- 44,1 kHz stéréo ;
- plafond de sécurité de chaque bus à environ −6 dB ;
- aucune normalisation agressive piste par piste ;
- suppression des stems de retours `Delay` et `TrueVerb`, qui doublaient le signal et brouillaient le mix ;
- compresseur master beaucoup plus doux.

Le bouton `Mix fixe A/B` force une scène Refrain avec des niveaux stables. Il sert à distinguer un problème de qualité audio d’un problème d’automation adaptative.

## 2. Réactions à faible latence

Les six bus restent synchronisés et disponibles pendant la lecture.

- filtre et effets : réaction en environ 40 à 100 ms ;
- batterie et percussions : changement au prochain temps, soit 0 à 500 ms ;
- basse et mélodie : changement à la prochaine mesure, soit 0 à 2 secondes ;
- changement de scène : prochaine mesure, avec fondu court et position harmonique conservée.

Les scènes restent longues de huit mesures, mais il n’est plus nécessaire d’attendre la fin des seize secondes pour réagir.

## 3. Calibration 3D et fusion des capteurs

La calibration utilise maintenant les axes `x`, `y` et `z`.

1. véhicule immobile pendant 2,5 secondes pour détecter la gravité ;
2. accélération douce en ligne droite pendant 6 secondes pour déterminer l’axe avant ;
3. calcul automatique de l’axe latéral ;
4. sauvegarde de la calibration sur l’iPhone.

Les signaux combinent :

- accélération linéaire 3D ;
- variation de vitesse GPS ;
- accélération latérale ;
- rotation autour de la verticale ;
- variation du cap GPS.

Sans calibration, l’axe avant par défaut utilise principalement `z`, ce qui correspond mieux à un iPhone fixé verticalement face au conducteur.

## Diagnostic et journal CSV

Le panneau `Fusion Motion + GPS` affiche les valeurs brutes et fusionnées.

Le bouton `Enregistrer capteurs` mémorise cinq lignes par seconde. `Télécharger CSV` exporte ensuite le journal pour analyse.

Consulter `SENSOR_TEST_GUIDE.md` avant le prochain essai.

## Source musicale

`Kalte Ohren (Cold Ears)` — starfrosch feat. Jerry Spoon, sous licence CC BY 3.0.

Consulter `ATTRIBUTION.md` pour le crédit complet.

## Installation GitHub

Créer la branche :

`drivepulse-v8-1`

Remplacer intégralement les fichiers de la V8 par ceux de cette archive, notamment tout le dossier :

`audio/kalte-ohren/`

Commit conseillé :

`DrivePulse V8.1 - audio quality low latency and 3D sensor fusion`
