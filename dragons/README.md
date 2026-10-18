# Chasseur de Dragons

Boss fight façon Archero : un jeune archer affronte 10 dragons, de salle en salle jusqu'au Roi Dragon.
Il tire tout seul quand il ne bouge plus. Entre deux salles, il choisit un pouvoir.

Jouer : https://pikifou.github.io/tour-aimants/dragons/ (installable sur Android et iPhone, joue hors ligne).

- `src/core.js` : logique du jeu (sans DOM, testable dans node)
- `src/render.js` : rendu canvas, `src/main.js` : son, contrôles, appli
- `python3 build.py` : `index.html` autonome et `artifact.html` ; `python3 build.py --pwa ../docs/dragons` : version appli
- `node tests/sim.js` : un robot joue les 10 salles (temps et coups reçus par salle)
