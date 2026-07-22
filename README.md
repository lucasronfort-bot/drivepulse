# DrivePulse Web V1

Prototype web pour iPhone, développé et hébergé depuis Windows.

## Contenu
- Accès aux capteurs DeviceMotion de l’iPhone
- Vitesse GPS
- Calibration de l’axe avant
- Jauges accélération, freinage et virage
- Ambiance audio synthétique réactive avec Web Audio
- Manifest PWA et cache hors ligne après le premier chargement

## Important
Les capteurs et le GPS nécessitent un site servi en HTTPS. Ouvrir directement `index.html`
depuis un fichier local ne suffit pas sur l’iPhone.

## Méthode simple de test depuis Windows
1. Installe Visual Studio Code.
2. Ouvre ce dossier.
3. Installe l’extension Live Server pour les tests visuels sur PC.
4. Pour l’iPhone, publie le dossier sur GitHub Pages, Netlify ou Cloudflare Pages.
5. Ouvre l’adresse HTTPS dans Safari sur l’iPhone.
6. Appuie sur « Autoriser et démarrer ».
7. Accepte Motion et Localisation.
8. Dans Safari : Partager > Sur l’écran d’accueil.

## Calibration
- Fixer l’iPhone rigidement en mode portrait.
- Démarrer DrivePulse.
- Appuyer sur « Calibrer en ligne droite » avec la voiture immobile.
- Poser l’iPhone.
- Accélérer doucement en ligne droite pendant quelques secondes.
- La calibration est mémorisée dans Safari.

## Sécurité
Faire les manipulations à l’arrêt ou les confier à un passager.
Ce prototype n’est pas un instrument de conduite.
