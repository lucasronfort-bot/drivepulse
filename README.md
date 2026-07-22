# DrivePulse Web V7.3

## Correction majeure

La V7.2 ne se contente plus d'ajouter un panneau à l'ancienne interface :
elle reprend réellement la nouvelle maquette du tableau de bord.

## Nouvelle interface

- résumé supérieur : profil route, vitesse, vitesse musicale, énergie et section ;
- orchestre des douze personnages placé au centre de l'écran ;
- état visible pour chaque personnage : actif, transition ou inactif ;
- réglages regroupés dans une colonne dédiée ;
- frise des sections musicales ;
- mémoire courte et longue ;
- capteurs et état de composition déplacés dans des panneaux secondaires ;
- interface responsive pour iPhone et ordinateur.

## Moteur musical V7

Les personnages pilotent réellement les couches sonores :

- Pulse : kick ;
- Clap : snare et claps ;
- Spark : hi-hat ;
- Sub : basse principale ;
- Bounce : basse syncopée ;
- Keys : piano et accords ;
- Cloud : nappes ;
- Hook : mélodie principale ;
- Reply : contrechant ;
- Motion : percussions ;
- Voice : textures vocales synthétiques ;
- Rise : transitions et impacts.

## Réduction de la répétition

- six progressions harmoniques ;
- huit motifs mélodiques ;
- six contrechants ;
- cinq lignes de basse ;
- quatre arpèges ;
- variations de batterie selon les sections ;
- sélection évitant une répétition immédiate.

## Mise à jour GitHub

Créer la branche `drivepulse-v7-2`, puis remplacer les fichiers à la racine.

Commit conseillé :

`DrivePulse V7.2 - new dashboard and real living orchestra`


## Voice Engine V7.3

Le personnage Voice n'utilise aucun contenu audio ou code provenant d'Incredibox.

Le nouveau moteur vocal repose sur une synthèse originale avec la Web Audio API :

- source glottale composée de trois oscillateurs ;
- trois filtres de formants pour simuler le tractus vocal ;
- voyelles `ah`, `oh`, `eh`, `ee` et `oo` ;
- attaque soufflée pour créer des vocal chops proches de `hey` ;
- vibrato ;
- voix grave doublée dans les refrains ;
- cinq phrases vocales sélectionnées sans répétition immédiate ;
- activation pendant les montées, refrains et reprises ;
- bouton `Tester` sur la carte Voice.

Cette approche reprend uniquement le principe général de la synthèse par tractus vocal. Aucun son, personnage, arrangement ou code propriétaire d'Incredibox n'est inclus.

Commit conseillé :

`DrivePulse V7.3 - formant vocal engine and voice preview`
