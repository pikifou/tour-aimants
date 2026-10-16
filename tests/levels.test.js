// Chaque salle est jouée par sa propre démo (script de doigt) : si la démo ne gagne pas, la salle n'est pas résoluble.
const test = require('node:test');
const assert = require('node:assert');
const { World, Replay } = require('../engine.js');
const FLOORS = require('../levels.js');

const FPS = 60;
function playDemo(room, extra = 4) {
  const w = new World(room);
  const r = new Replay(w, room.demo);
  let guard = 0;
  while (!r.done && guard++ < 60 * FPS) { r.step(1 / FPS); w.step(1 / FPS); }
  for (let i = 0; i < extra * FPS && !w.won; i++) w.step(1 / FPS);
  return w;
}

for (const f of FLOORS) {
  for (const room of f.rooms) {
    const name = `${f.n} ${f.title} — ${room.kind} ${room.index + 1}/${room.total}`;
    test(name, () => {
      assert.ok(Array.isArray(room.demo) && room.demo.length, 'la salle a une démo');
      // les salles à pôle aléatoire sont jouées plusieurs fois
      const runs = room.bodies.some((b) => b.randomPole) ? 6 : 1;
      for (let i = 0; i < runs; i++) {
        const w = playDemo(room);
        assert.ok(w.won, `démo gagnante (essai ${i + 1})`);
      }
    });
  }
}

test('la paille ne bouge pas (2, salle 1)', () => {
  const room = FLOORS[1].rooms[1];
  const w = new World(room); w.pointerDown(480, 650); for (let i = 0; i < 120; i++) w.step(1 / 60);
  assert.strictEqual(w.body('s').x, 380);
});
test('hors de la zone, rien ne bouge (3, salle 1)', () => {
  const w = new World(FLOORS[2].rooms[1]); w.pointerDown(800, 300); for (let i = 0; i < 120; i++) w.step(1 / 60);
  assert.strictEqual(w.body('bolt').y, 420); assert.ok(w.fingerBlocked);
});
test('la plaque de fer bloque (9, salle 1)', () => {
  const w = new World(FLOORS[8].rooms[1]); w.pointerDown(610, 300); for (let i = 0; i < 120; i++) w.step(1 / 60);
  assert.strictEqual(w.body('bolt').x, 780);
});
test('un clou non aimanté ne fait rien, et la charge disparaît (10, salle 1)', () => {
  const w = new World(FLOORS[9].rooms[1]); w.pointerDown(620, 300); for (let i = 0; i < 120; i++) w.step(1 / 60);
  assert.strictEqual(w.body('bolt').y, 420);
  w.nailCharge = 1; w.pointerUp(); for (let i = 0; i < 20 * 60; i++) w.step(1 / 60);
  assert.ok(w.nailCharge < 0.05);
});
test('trop faible avec 1 ou 3 tours (12, atelier)', () => {
  const w = new World(FLOORS[11].rooms[0]); w.toggleElectro(); w.pointerDown(970, 560); for (let i = 0; i < 120; i++) w.step(1 / 60);
  assert.ok(!w.body('herse').attached); w.addTurn(); w.addTurn(); for (let i = 0; i < 60; i++) w.step(1 / 60);
  assert.ok(!w.body('herse').attached); w.addTurn(); for (let i = 0; i < 60; i++) w.step(1 / 60);
  assert.ok(w.body('herse').attached);
});
test('la porte est bloquée tant que l’aimant géant tient la cage (16)', () => {
  const w = new World(FLOORS[15].rooms[0]); w.pointerDown(990, 560); for (let i = 0; i < 60; i++) w.step(1 / 60);
  assert.ok(!w.body('porte').attached);
});
