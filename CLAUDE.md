# Teckel de Poche - contexte projet

Jeu mobile "life-sim" mignon avec un teckel (chibi). Type Sims + petites bêtises.
Web 100% front (HTML + CSS + JS vanilla), **aucun build, aucune dépendance**, installable en
**PWA**. Plusieurs fichiers JS "classiques" (pas de modules) partagent l'objet global `TDP`,
ce qui permet encore d'ouvrir `index.html` en double-clic (sans PWA ni service worker).

## Structure

```
index.html              # en-tête (charset, viewport, PWA) + markup + chargement des fichiers
css/game.css            # tous les styles (verre, pièces, écrans)
js/data.js              # TOUTES les données et valeurs chiffrées (équilibrage ici)
js/save.js              # sauvegarde versionnée + migrations + export/import, utilitaires, bus
js/game.js              # moteur : pièce, chien, missions, bêtises, temps, boucle (expose TDP.api)
js/features/*.js        # systèmes branchés sur le bus : complicite.js, dailies.js
js/ui/plus.js           # menu Plus : fiche du chien (renommer), sauvegarde
js/main.js              # démarrage (chargé en dernier) + enregistrement du service worker
sw.js                   # service worker (hors ligne, stratégie réseau d'abord)
manifest.webmanifest    # PWA
icons/                  # icônes de l'app (180, 192, 512, 1024)
assets/
  <tenue>_<pose>.png    # sprites du chien, 500x281 px, fond transparent
  dog_bain.png          # tête + mousse pour la scène du bain (500x444)
  rooms/<piece>_<jour|nuit>.jpg   # 8 décors 900x900, jour et nuit au même cadrage
process.py, process_rooms.py      # anciens scripts Python (chemins d'une autre machine)
```

Ordre de chargement (important) : `data.js`, `save.js`, `game.js`, `features/*`, `ui/*`, `main.js`.
Un nouveau système = un fichier dans `js/features/` qui s'abonne au bus (`TDP.bus.on`) et utilise
`TDP.api` (state, save, render, toast, showView, txt, addThoughts...), à ajouter dans `index.html`
et dans la liste `CORE` de `sw.js`.

Évènements du bus : `start`, `tick` (toutes les 8 s + retour au premier plan : gérer ici le
changement de jour), `render`, `mission:<besoin>`, `hug`, `interact`, `repair`, `coffre`,
`misdeed`, `misdeed:caught`, `level`.

Tenues : `neutre`, `mariniere`, `pull_rose`. Poses : `assis, joyeux, endormi, allonge, marche,
debout, etonne, triste` (toutes les tenues n'ont pas toutes les poses, cf. `ASSETS` ; repli sur
`assis`). Attention : `triste` est un GROS PLAN de la tête, pas un chien en pied.

## Sauvegarde et mises à jour (IMPORTANT)

- `localStorage`, clé **`teckel_state_v4`** (champ `version`). L'ancienne clé `teckel_state_v3`
  est migrée au premier lancement et **laissée intacte** en secours.
- Changer le format de l'état = ajouter une migration dans `MIGRATIONS` (`js/save.js`) et
  incrémenter `SAVE_VERSION`. Ne jamais casser une partie existante.
- Export/import : code `TDP4-...` (menu Plus > Sauvegarde).
- **À chaque livraison** : incrémenter le `?v=` des fichiers dans `index.html` ET
  `CACHE_VERSION` dans `sw.js`, sinon les joueurs gardent d'anciens fichiers en cache.

## Règles de jeu actuelles (valeurs dans `js/data.js`)

- Besoins : baisse par heure `NEED_DECAY_PER_HOUR` (faim 10, jeu 12, sommeil 7, propreté 5).
  Jeu fermé ou veille > 2 min : jamais sous `OFFLINE_FLOOR` (20). Sous `LOW_NEED` (20) : pose
  `LOW_NEED_POSE` et gains de pièces /2.
- Missions de besoin : gain plein si le besoin était < 60 %, sinon 25 %.
- Jour/nuit : heure réelle (nuit 20 h - 7 h). Forcer pour tester : `index.html?nuit` / `?jour`.
- Complicité : câlin (toucher le chien) +5, 5 fois/jour ; premier passage du jour +15 ;
  -10 par jour d'absence dans le niveau en cours (on ne perd jamais un niveau) ; 20 niveaux.
- Personnalité : compteurs de traits (`TRAITS`) nourris par les évènements ; le trait dominant
  s'affiche sur la fiche et colore les bulles.
- Défis du jour : 3 tirés dans `DAILY_POOL`, renouvelés à minuit local, bonus si les 3 sont reçus.
- Bêtises (provisoire, la version visuelle arrive) : une toutes les 4 à 8 min de jeu actif,
  -10 sagesse ; toucher le chien pendant qu'il y va = attrapé (+3 sagesse, +5 pièces) ;
  "Câliner" pour réparer (+10 sagesse, +5 pièces).
- Prix prévus (boutique à venir) : tenue commune 300-500, rare 1000-1600, légendaire non
  achetable ; pièces : jardin 1500, salle de jeu 2500, bureau 4000.

## Concepts clés du moteur (`js/game.js`)

- **Pièces** : objet `ROOMS`. Chaque pièce a `spotX` (position de repos) et `floorY`
  (ligne de sol en % depuis le HAUT, ou le chien pose ses pattes). `floorY` peut être un
  nombre OU un objet `{ jour, nuit }` quand le cadrage jour/nuit diffère (ex. `salon`).
  `roomFloorY(room)` résout la bonne valeur selon `state.timeOfDay`.
- **Ancrage du chien au sol (IMPORTANT)** : `.dog-sprite` a `aspect-ratio:500/281`
  (hauteur déterministe), est centré sur `posX` (`translateX(-50%)`) et ancré **par le bas** :
  `bottom = 100 - seat - foot`, où `foot` compense le vide transparent sous les pattes de la
  pose (`POSE_FOOT`, mesuré sur les PNG ; ex. `endormi` = 14 %). Ne jamais repasser à un
  ancrage par `top` deviné (ancien bug : chien qui flotte). Nouveau sprite -> mesurer son vide
  bas et l'ajouter à `POSE_FOOT`.
- **Meubles** : `FURNITURE_Y` (`canape`, `lit`, `gamelle`) = `{ seat, depth }` : `seat` = ligne
  des pattes sur le meuble, `depth` = où les pieds du meuble touchent le sol (sert à l'échelle).
  `floorOverride` (même forme) remplace le sol pendant l'action. Toujours le remettre à `null`
  en fin d'action.
- **Caméra** : le décor suit le chien via `el.roomBg.style.objectPosition = posX + "% 30%"`
  (panoramique horizontal, révèle les bords cachés). Mis à jour dans `updateSpritePosition()`.
- **Missions** : `MISSION_DEFS` (faim, jeu, sommeil, proprete). Champs utiles : `actMs`,
  `actClass` (transform CSS type "se baisse pour manger"), `scene` (`"bain"`, ou un nom de `FURNITURE_Y` : `"canape"`, `"gamelle"`),
  `spotX`, `pose`. Le moteur est dans `frame()` (machine à états `autoSeq` :
  phases `walk` -> `act`, avec `kind` = `mission` | `misdeed` | `interact`).
- **Scène du bain** : `enterBath()` / `exitBath()` cachent le sprite normal et affichent
  `#bathDog` (dog_bain.png) posé au bord de la baignoire, taille = `scaleAt(BATH_DEPTH)`.
- **Objets tactiles** : `INTERACTIONS[piece]` (data.js) = zones `{at, pose, act, raise,
  thought, toast}` ; `at.jour`/`at.nuit` = `{x,y,w,h,targetX}` en % de l'IMAGE du décor (pas du cadre).
  `renderHotspots()` crée les zones, `positionHotspots()` les recale à chaque frame selon le
  panoramique (object-fit:cover). Note : `posX`/`spotX`/`targetX` = abscisse en % de l'image ;
  au tap, `interact(spot)` lance une séquence (le chien marche puis fait le geste).
  Actuellement : salon -> chaussons (mord), chambre -> lit (monte dessus).

## Règles d'échelle et de cadre (à respecter pour toute nouvelle feature)

1. **Échelle = profondeur au sol.** La taille de tout ce qui est posé dans une pièce (chien,
   tête du bain, futurs objets/personnages) vient de `scaleAt(depthY)`, où `depthY` est le
   point de contact avec le SOL (en % depuis le haut du décor), jamais la hauteur à l'écran :
   `scale = (depthY - HORIZON_Y) / (REF_Y - HORIZON_Y)` avec `HORIZON_Y = 35` (ligne d'horizon
   commune aux décors) et `REF_Y = 80` (profondeur où le chien fait `DOG_W = 48` % du cadre).
   Un objet surélevé (chien sur le canapé) garde la profondeur des pieds du meuble.
   Ex. : canapé depth 58 -> 0,51 ; lit 68,5 -> 0,74 ; baignoire 59,5 -> 0,54.
2. **Fond perdu de 3 px.** Le chien visible ne sort jamais du cadre : `clampX()` borne `posX`
   pour garder `BLEED_PX = 3` px entre le bord du dessin (`SPRITE_INSET` = vide latéral mini des
   PNG) et le bord du cadre. Toute nouvelle position (cible de mission, bêtise, objet) passe par
   `clampX()`.
3. Jour et nuit d'une même pièce doivent garder le même cadrage (sinon valeurs `{jour, nuit}`).

## Procédure quand on ajoute / remplace un décor

C'est la base du jeu : le chien doit TOUJOURS être pile au niveau du sol.
1. Passer l'image par `process_rooms.py` (largeur 900, JPEG q82) -> `assets/rooms/`.
   Sans Python : `sips -s format jpeg -s formatOptions 82 --resampleWidth 900 src.jpg --out assets/rooms/<piece>_<jour|nuit>.jpg`.
2. Repérer la ligne de sol dans l'image (là où le mur rejoint le sol, en % de la hauteur).
3. Régler `floorY` de la pièce (nombre, ou `{jour, nuit}` si les deux cadrages diffèrent).
4. Si un meuble est concerné (canapé/lit/baignoire), ajuster `FURNITURE_Y` ou les coords
   de scène.
5. **Tester le rendu réel** en viewport téléphone (voir ci-dessous), pas juste au jugé.

## Lancer / tester

- Double-clic sur `index.html` (sans PWA), ou serveur local (nécessaire pour la PWA) :
  `ruby -run -e httpd . -p 8000` (Python n'est pas installé sur ce Mac), puis
  http://localhost:8000. macOS peut interdire au serveur de lire le Bureau : servir une copie.
- Tester en viewport téléphone 390x844 (clair/sombre, jour/nuit via `?jour` / `?nuit`).
- Le service worker ne s'enregistre pas dans le navigateur intégré de l'app Claude : tester
  le hors ligne dans Chrome ou Safari.
- L'installation sur téléphone exige un hébergement HTTPS.

## Réglages restant à peaufiner (retours utilisateur en cours)

- Philodendron tactile "qui tombe" : demandé mais reporté (nécessiterait un PNG de plante
  séparé pour une vraie chute).

## Style / conventions

- Pas de tiret cadratin « — » dans les textes destinés à l'utilisatrice : utiliser « - ».
- Français dans toute l'UI. Nom du chien par défaut : "Saucisse".
