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
- L'histoire : au premier départ, une petite vidéo (la sorcière emporte Mei Mei), puis une image et deux phrases ; au sommet, la vidéo de fin (la cage s'ouvre) puis l'écran « Bravo ». Vidéos dans `cine/` (copiées dans `docs/cine/`, hors du cache du service worker) ; sans vidéo (fichier unique, hors ligne, mouvement réduit), directement l'image (`assets/histoire_debut.webp`, `assets/histoire_fin.webp`) et le texte. Une fois la tour finie, l'accueil montre la marque « Fini » (et `Ludi.fini()` prévient Ludiworld) ; elle reste si on recommence la tour. Textes en français, en anglais avec `?lang=en`.
- `tests/levels.test.js` : chaque démo doit gagner sa salle (`node --test tests/levels.test.js`)
- Ludiworld : `ludi.json` (la fiche du jeu) est copiée par le build à la racine du site ; `ludi.js` est le kit Ludiworld, copié tel quel depuis https://pikifou.github.io/ludiworld/kit/ludi.js et intégré à la page. Ouvert seul, le jeu ne change pas.

## Construire
```
python3 build.py
node --test tests/levels.test.js
```
