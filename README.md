# Teckel de Poche

Prototype de jeu mobile "life-sim" avec un teckel chibi (type Sims + petites bêtises).

## Lancer le jeu

Aucune installation, aucun build. Deux options :

- **Le plus simple** : ouvrir `index.html` dans un navigateur (sans mode hors ligne).
- **Serveur local** (nécessaire pour la PWA) :
  ```bash
  cd teckel-de-poche
  ruby -run -e httpd . -p 8000
  # puis ouvrir http://localhost:8000
  ```
- **Sur téléphone, installable comme une app** : le jeu doit être hébergé en HTTPS.
  Voir `CLAUDE.md`.

Le jeu est pensé pour un écran de téléphone (portrait). Sur ordinateur, il s'affiche
dans un cadre façon téléphone.

## Contenu

- `index.html`, `css/`, `js/` : le jeu (HTML + CSS + JS, sans dépendance ni build).
- `manifest.webmanifest`, `sw.js`, `icons/` : PWA (installation, hors ligne).
- `assets/` : sprites du chien (par tenue et pose) + décors des pièces (`assets/rooms/`).
- `process.py`, `process_rooms.py` : scripts Python (Pillow) pour redimensionner les
  images sources vers les tailles utilisées par le jeu.
- `CLAUDE.md` : documentation d'architecture et conventions, à lire en priorité pour
  reprendre le développement dans Claude Code.

## Reprendre dans Claude Code

Ouvre ce dossier dans Claude Code : le fichier `CLAUDE.md` sera pris en compte
automatiquement et donne tout le contexte (comment le chien est calé au sol, comment
ajouter un décor, les missions, les objets tactiles, les points en cours).

## Fonctionnalités actuelles

- 4 pièces (cuisine, chambre, salon, salle de bain), mode jour / nuit.
- Le chien marche (maintenir gauche / droite), le décor le suit.
- Missions : nourrir, jouer, sieste (sur le canapé), bain (tête moussante dans la baignoire).
- Objets tactiles : chaussons (le chien les mordille), lit (il saute dessus).
- Câlins (toucher le chien), complicité sur 20 niveaux, personnalité, fiche (renommer).
- Défis du jour (3 par jour), sauvegarde exportable, jour/nuit à l'heure réelle.
- Bêtises aléatoires avec notification.
- Dressing (tenues) et coffre quotidien.

## Dépendances des scripts Python (optionnel)

Seulement si tu retouches les images :
```bash
pip install pillow
```
