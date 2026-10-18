# La Tour aux Aimants

Jeu de puzzles sur le magnétisme pour enfants (6 ans et plus), à jouer sur tablette ou téléphone.
Une sorcière a enfermé le chat tout en haut de sa tour : seize étages, un aimant, et une notion de physique par étage.

Jouer : https://pikifou.github.io/tour-aimants/ (installable comme une appli, fonctionne hors ligne).

## Structure
- `engine.js` : physique magnétique 2D et rejoueur de démos (sans DOM, testable en Node)
- `levels.js` : les 16 étages (atelier + salles), chaque salle avec sa démo
- `cards.js` : fiches de lecture et schémas SVG
- `game.js` : rendu canvas, interface, sons, juice
- `index.template.html` + `build.py` → `index.html` (artefact), `preview.html` (tests), `docs/` (site GitHub Pages, PWA)
- `tests/levels.test.js` : chaque démo doit gagner sa salle (`node --test tests/levels.test.js`)

## Construire
```
python3 build.py
node --test tests/levels.test.js
```

## Aussi dans ce dépôt

[Chasseur de Dragons](https://pikifou.github.io/chasseur-dragons/) a déménagé dans son propre dépôt : https://github.com/pikifou/chasseur-dragons
