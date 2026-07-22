# DrivePulse Web V4

## Nouveautés
- Séquenceur musical basé sur des mesures.
- Cinq modes de conduite : Cruise, Drive, Boost, Curve et Brake.
- Sélection dynamique de motifs de basse, batterie et mélodie.
- Alternance de motifs mélodiques selon la mesure.
- Transitions déclenchées uniquement au changement de mode.
- Réactivité musicale réglable.
- Composition recalculée quatre fois par seconde mais appliquée au début de la mesure suivante.

## Mise à jour GitHub Pages
Remplace tous les fichiers de la V3 par ceux de cette archive.
Conserve exactement le dossier `audio/synthwave`.

## Test recommandé
1. Lance le mode démonstration.
2. Observe les changements Cruise, Drive, Boost, Curve et Brake.
3. Vérifie que les changements sonores se produisent au début des mesures.
4. Ajuste la réactivité musicale.
5. Teste ensuite en voiture.

## Limite actuelle
La V4 compose à partir de motifs préenregistrés. La prochaine étape pourra générer certaines notes directement dans Web Audio.
