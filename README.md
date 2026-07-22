# DrivePulse Web V7.1

## Orchestre vivant

La V7 remplace le réglage manuel de densité par un directeur musical autonome.

Le moteur utilise douze personnages musicaux originaux, inspirés du principe général d’un ensemble vocal et instrumental modulaire :

- Pulse : kick
- Clap : caisse claire
- Spark : hi-hat et shaker
- Sub : basse profonde
- Bounce : basse rythmique
- Keys : piano et accords
- Cloud : nappes
- Hook : mélodie principale
- Reply : contrechant
- Motion : percussions
- Voice : voix synthétique originale
- Rise : transitions et impacts

Chaque personnage s’active ou se désactive selon :
- la vitesse ;
- l’énergie ;
- le type de route ;
- les virages ;
- la section du morceau ;
- la mémoire courte et longue de conduite.

## Réduction de la répétition

La V7 ajoute :
- plusieurs progressions d’accords ;
- plusieurs motifs de hook ;
- plusieurs contrechants ;
- une sélection évitant la répétition immédiate ;
- des phrases qui évoluent sur plusieurs mesures ;
- des arrangements différents selon Intro, Groove, Montée, Refrain, Respiration et Reprise.

## Réglages

Le réglage `Densité musicale` a été supprimé. La richesse du morceau est désormais gérée automatiquement.

Les réglages conservés sont :
- Réactivité musicale ;
- Sensibilité accélération ;
- Sensibilité virage.

## Déploiement GitHub

Remplacer les fichiers de la V6.1 par ceux de cette archive.

Commit conseillé :

`DrivePulse V7 - living orchestra and non-repeating arrangements`


## Correctifs V7.1

- suppression complète du réglage `Densité musicale` dans le HTML et le JavaScript ;
- ajout d'une interface détaillée pour les douze personnages musicaux ;
- état visible pour chaque personnage : Actif, En transition ou Inactif ;
- animation visuelle lors des entrées et sorties ;
- indicateur graphique d'activité par personnage ;
- cache PWA renommé en `drivepulse-v7-1`.

Commit conseillé :

`DrivePulse V7.1 - fix settings and show active music agents`
