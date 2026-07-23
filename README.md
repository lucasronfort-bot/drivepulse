# DrivePulse Web V8.4

## Objectif

La V8.3 corrige les problèmes révélés par le CSV du trajet du 23 juillet 2026 : trop de stems actifs en permanence, refrain trop fréquent en ville, accélération IMU peu fiable et Rhodes joué deux fois.

## Changements principaux

- tous les stems sauf Piano sont plus forts ;
- reconstruction depuis les FLAC originaux pour éviter une nouvelle génération AAC ;
- Harmony ne contient plus le Rhodes ;
- Piano reste au même niveau ;
- seuils d'activation espacés pour restaurer la dynamique ;
- refrain plus rare et adapté à chaque profil de route ;
- GPS prioritaire pour l'accélération ;
- nouvelles colonnes CSV avec le niveau réel de chaque bus.

## Déploiement GitHub

Créer la branche `drivepulse-v8-3`, puis remplacer intégralement la V8.2, y compris `audio/kalte-ohren/`.

Commit conseillé :

`DrivePulse V8.3 - louder stems dynamic scenes and GPS acceleration`


## Bibliothèque musicale V8.4

La V8.4 introduit un système générique de bibliothèque :

- sélection manuelle depuis une liste ;
- boutons morceau précédent et suivant ;
- transition au début de la prochaine mesure ;
- fondu croisé d’environ 1,1 seconde ;
- rotation automatique toutes les 3, 5, 10 ou 15 minutes ;
- mémorisation du morceau et des préférences dans `localStorage` ;
- identification du morceau dans le CSV des capteurs.

### Contenu installé

Le prototype contient actuellement une composition sous deux arrangements :

1. `Kalte Ohren — Original Drive`
2. `Kalte Ohren — Night Drive Edit`

Le second arrangement utilise des scènes et niveaux différents afin de tester le changement de morceau sans doubler les fichiers audio.

### Ajouter un véritable morceau

Ajouter son manifeste et ses fichiers audio, puis déclarer le morceau dans :

`audio/library.json`

Le manifeste doit exposer les sept bus utilisés par DrivePulse :

`rhythm`, `tops`, `bass`, `harmony`, `piano`, `lead`, `fx`.

Commit conseillé :

`DrivePulse V8.4 - music library manual switch and auto rotation`
