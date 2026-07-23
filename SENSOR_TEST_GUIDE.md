# Guide d’essai en voiture — DrivePulse V8.3

## Avant de partir

1. Fixer rigidement l’iPhone, sans possibilité de rotation.
2. Ouvrir DrivePulse et appuyer sur `Démarrer`.
3. Appuyer sur `Calibration 3D`.
4. Garder la voiture immobile pendant la première étape.
5. À l’étape 2, accélérer doucement en ligne droite pendant environ six secondes.
6. Attendre le message confirmant la fin de la calibration.

La manipulation doit être réalisée par un passager ou dans des conditions sûres.

## Essai qualité

Appuyer sur `Mix fixe A/B` pendant une portion de route stable.

- si le mix fixe est propre mais l’adaptatif ne l’est pas, noter les moments où la qualité se dégrade ;
- si le mix fixe est également mauvais, vérifier le Bluetooth, l’égaliseur du véhicule et le volume de sortie.

## Essai des capteurs

Appuyer sur `Enregistrer capteurs`, puis réaliser séparément :

1. une accélération douce en ligne droite ;
2. une accélération plus franche ;
3. un freinage doux ;
4. un virage à gauche ;
5. un virage à droite ;
6. une ligne droite à vitesse stable.

Arrêter l’enregistrement puis appuyer sur `Télécharger CSV`.

## Résultat attendu

- accélération : `Accélération` monte, `Virage` reste faible ;
- freinage : `Freinage` monte rapidement ;
- virage gauche et droite : `Virage` monte dans les deux directions ;
- ligne droite stable : les trois signaux retombent progressivement.


## Vérifications spécifiques V8.3

- vérifier que le piano disparaît progressivement entre 26 et 34 km/h ;
- vérifier que Harmony reste audible sans donner l'impression d'un piano doublé ;
- faire plusieurs accélérations progressives et franches ;
- rester à 45–50 km/h pendant au moins une minute afin de confirmer que le refrain ne reste pas actif en permanence ;
- comparer les nouvelles colonnes `rhythm_level`, `tops_level`, `bass_level`, `harmony_level`, `piano_level`, `lead_level` et `fx_level`.
