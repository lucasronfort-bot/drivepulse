# Ajouter un morceau à DrivePulse

## 1. Préparer le dossier

Exemple :

```text
audio/
└── nouveau-morceau/
    ├── manifest.json
    ├── intro/
    ├── groove/
    ├── drive/
    ├── breakdown/
    ├── chorus/
    ├── finale/
    └── common/
```

Chaque scène doit fournir les bus disponibles parmi :

- rhythm
- tops
- bass
- harmony
- piano
- lead
- fx

## 2. Déclarer le morceau

Ajouter une entrée dans `audio/library.json` :

```json
{
  "id": "nouveau-morceau",
  "title": "Titre",
  "edition": "DrivePulse Edit",
  "artist": "Artiste",
  "license": "CC BY 4.0",
  "manifest": "audio/nouveau-morceau/manifest.json",
  "profile": "drive",
  "accent": "#38a4ff"
}
```

## 3. Transition

DrivePulse précharge l’Intro et le Groove du morceau suivant, puis effectue le changement au début de la prochaine mesure avec un fondu croisé.

Les morceaux peuvent avoir des BPM différents : le moteur adopte le tempo du nouveau manifeste après la transition.
