# DrivePulse V8.2 — comportement détaillé des stems

## Calcul de l’énergie

L’énergie musicale combine :

- 54 % de vitesse relative au profil choisi ;
- 19 % de mémoire courte ;
- 11 % de mémoire longue ;
- 20 % d’accélération ;
- 8 % de virage ;
- retrait de 13 % du freinage.

Les pourcentages ne constituent pas une somme fixe : la valeur finale est bornée entre 0 et 100 %.

## Bus audio

### PIANO

- Source : stem `Rhodes`.
- Niveau maximal de 0 à environ 26 km/h.
- Fondu progressif entre 26 et 34 km/h.
- Pratiquement inaudible au-dessus de 34 km/h.
- Réaction immédiate.

### HARMONY

- Sources : pads, guitare, Omnisphere et éléments harmoniques propres à la scène.
- Toujours présent pour éviter les silences.
- Diminue légèrement lorsque l’énergie augmente.
- Est également réduit lorsque le piano est fort, afin de conserver de la place dans le mix.
- Réaction immédiate.

### RHYTHM

- Sources : kick, snare et rim.
- Commence à apparaître vers 10 % d’énergie.
- Atteint son niveau principal vers 36 % d’énergie.
- Le freinage peut réduire son niveau jusqu’à environ 72 %.
- Changement synchronisé au prochain temps : délai maximal théorique 0,5 seconde.

### TOPS

- Sources : hi-hats, bongos et percussions hautes.
- Peut être déclenché de trois façons : énergie au-dessus de 27 %, accélération ou virage.
- L’accélération et les virages peuvent donc l’activer même à faible vitesse.
- Changement au prochain temps.

### BASS

- Sources : sub, basse médium et basse haute.
- Commence à apparaître vers 12 % d’énergie.
- Atteint son niveau principal vers 40 % d’énergie.
- Changement à la prochaine mesure : délai maximal théorique 2 secondes à 120 BPM.

### LEAD

- Sources : pluck arpégé et synthés principaux.
- Commence à apparaître vers 40 % d’énergie.
- Atteint son niveau principal vers 72 % d’énergie.
- Changement à la prochaine mesure.

### FX

- Sources : risers, lifts, bruit blanc et downlifters.
- Un fond léger reste toujours présent.
- Le niveau augmente avec l’accélération, le freinage et lorsqu’une nouvelle scène est demandée.
- Réaction immédiate.

## Choix des scènes

- `Intro` : véhicule à l’arrêt ou énergie très faible.
- `Groove` : vitesse relative > 27 % ou vitesse stable suffisamment longtemps.
- `Montée` : accélération > 24 % ou mémoire courte > 54 %.
- `Respiration` : freinage > 36 %.
- `Refrain` : vitesse relative > 74 % et mémoire longue > 45 %.
- `Finale` : même condition que Refrain avec mémoire longue > 70 %.

Les changements de scène sont appliqués à la prochaine mesure, en conservant la position musicale dans la boucle.
