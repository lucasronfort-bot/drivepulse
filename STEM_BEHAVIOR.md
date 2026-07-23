# DrivePulse V8.3 — comportement des stems

## Principe général

La V8.3 restaure une vraie marge dynamique : la vitesse constante ne met plus presque tous les stems au maximum. Les fichiers audio de tous les bus sauf Piano ont été reconstruits depuis les FLAC originaux et remontés avec un plafond de sécurité.

## Niveaux audio

- Rhythm : plafond -5 dB, gain de sortie +12 %.
- Tops : plafond -7 dB, gain de sortie +18 %.
- Bass : plafond -6 dB, gain de sortie +12 %.
- Harmony : plafond -6 dB, gain de sortie +10 %, sans Rhodes.
- Piano : fichier et gain inchangés.
- Lead : plafond -6 dB, gain de sortie +16 %.
- FX : plafond -8 dB, gain de sortie +12 %.

Le compresseur master protège la somme des stems sans réduire le piano séparément.

## Activation

### Piano
- 0 à 26 km/h : niveau principal.
- 26 à 34 km/h : fondu progressif.
- au-delà de 34 km/h : coupé.

### Harmony
Toujours présent. Il contient uniquement les pads, la guitare et les textures Omnisphere. Le Rhodes a été retiré pour éviter le doublage du piano.

### Rhythm
Entre vers 20 % d'énergie et atteint son niveau principal vers 62 %. Le freinage le réduit rapidement. Les changements sont quantifiés au prochain temps (0 à 0,5 s).

### Tops
Entre avec une accélération, un virage ou à partir d'environ 38 % d'énergie. Changement au prochain temps.

### Bass
Entre vers 26 % d'énergie et atteint son niveau principal vers 62 %. Changement à la prochaine mesure (0 à 2 s).

### Lead
Entre vers 56 % d'énergie et atteint son niveau principal vers 82 %. Changement à la prochaine mesure.

### FX
Réagit immédiatement aux accélérations, freinages et changements de scène.

## Scènes

Les seuils de refrain dépendent maintenant du profil routier :

- Ville : refrain au-dessus d'environ 52 km/h, avec énergie et mémoire maintenues.
- Campagne : refrain au-dessus d'environ 74 km/h.
- Autoroute : refrain au-dessus d'environ 112 km/h.

Le refrain ne dépend donc plus uniquement d'une vitesse urbaine normale.

## Capteurs

L'accélération GPS est désormais la source principale de l'accélération longitudinale. L'IMU sert à anticiper les mouvements courts, mais ne peut plus déclencher seule une forte montée. Le freinage et les virages conservent la fusion qui fonctionnait correctement lors du trajet V8.1.
