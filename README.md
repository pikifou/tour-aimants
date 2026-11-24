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
- La tour entre les étages : trois morceaux peints (`assets/tour-toit.webp`, `tour-etage.webp`, `tour-base.webp`) que le jeu empile en seize étages ; une fenêtre s'allume par étage réussi et le héros monte d'un étage à l'autre.
- « Le savais-tu ? » : seize petits écrans sur le magnétisme dans la vraie vie (`SAVOIRS` dans `cards.js`, images `assets/savoir-NN.webp`). Le n° n passe juste avant l'étage n (le 1 après l'histoire du début), une seule fois ; la fiche de l'étage permet de le relire.
- `tests/levels.test.js` : chaque démo doit gagner sa salle (`node --test tests/levels.test.js`)
- Le son : musique, bruitages et voix sont tous allumés au départ et se règlent dans Ludiworld pour toute la maison (`Ludi.onSon`, kit 0.5.0) ; le haut-parleur du jeu (en haut à droite, ou dans le bandeau d'une salle) ouvre trois interrupteurs, Musique, Bruitages et Voix, qui changent ce réglage. Trois musiques en boucle dans `assets/` : `musique-tour.mp3` (accueil, tour, fiches, histoire du début), `musique-salles.mp3` (les salles), `musique-fin.mp3` (histoire de la fin, « Bravo »). Elles commencent au premier geste, s'arrêtent quand le jeu est caché ou en pause, et sont dans le cache hors ligne.
- `tests/son.py` : le son sur chaque écran, les trois interrupteurs, `ludi:son` (`python build.py` puis `python tests/son.py`, serveur sur le port 7365)
- Ludiworld : `ludi.json` (la fiche du jeu) est copiée par le build à la racine du site ; `ludi.js` est le kit Ludiworld, copié tel quel depuis https://pikifou.github.io/ludiworld/kit/ludi.js et intégré à la page. Ouvert seul, le jeu ne change pas.

## Construire
```
python3 build.py
node --test tests/levels.test.js
```
