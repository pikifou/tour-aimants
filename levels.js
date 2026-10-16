/* Les 16 étages de la tour. Chaque étage = (atelier) + salle 1 + salle 2.
   Coordonnées logiques 1280×800 (zone de jeu : y de 90 à 800).
   Chaque salle a une démo (script de doigt) : elle sert d'exemple dans l'atelier, de « Montre-moi », et de test automatique. */
(function (root) {
  'use strict';

  const FLOOR = 720;
  const KY = FLOOR - 110;
  const WALLS = () => [
    { id: 'ceil', x: 0, y: 90, w: 1280, h: 20, mat: 'stone' },
    { id: 'wallL', x: 0, y: 90, w: 40, h: 710, mat: 'stone' },
    { id: 'wallR', x: 1240, y: 90, w: 40, h: 710, mat: 'stone' },
  ];
  // Sol avec des trous [[a,b],...]
  function room(gaps = []) {
    const s = WALLS();
    let x = 0, i = 0;
    for (const [a, b] of gaps) { s.push({ id: 'floor' + i++, x, y: FLOOR, w: a - x, h: 80, mat: 'stone' }); x = b; }
    s.push({ id: 'floor' + i, x, y: FLOOR, w: 1280 - x, h: 80, mat: 'stone' });
    return s;
  }
  const trap = (id, a, b, y = FLOOR) => ({ id, type: 'trap', x: a, y: y + 2, w: b - a, h: 70 });
  const glass = (x) => ({ id: 'glass' + x, x, y: 110, w: 20, h: 610, mat: 'glass' });
  const niche = (x, id = '') => [{ id: 'nL' + id, x: x - 50, y: 560, w: 24, h: 160, mat: 'stone' }, { id: 'nR' + id, x: x + 96, y: 560, w: 24, h: 160, mat: 'stone' }];
  const latchAt = (id, body, x, y, w, snapY) => ({ id, type: 'latch', body, x, y, w, h: 36, snapY });

  // Constructeur de démo : temps cumulé
  function D() {
    const steps = []; let t = 0;
    const api = {
      down(x, y, d = 0.3) { t += d; steps.push(['down', x, y, t]); return api; },
      move(x, y, d) { t += d; steps.push(['move', x, y, t]); return api; },
      up(d = 0.15) { t += d; steps.push(['up', t]); return api; },
      flip(d = 0.4) { t += d; steps.push(['flip', t]); return api; },
      tool(i, d = 0.5) { t += d; steps.push(['tool', i, t]); return api; },
      electro(d = 0.5) { t += d; steps.push(['electro', t]); return api; },
      turn(d = 0.35) { t += d; steps.push(['turn', t]); return api; },
      filings(d = 0.4) { t += d; steps.push(['filings', t]); return api; },
      tap(x, y, d = 0.4) { t += d; steps.push(['tap', x, y, t]); return api; },
      wait(d) { t += d; steps.push(['wait', t]); return api; },
      rub(n = 10) { for (let i = 0; i < n; i++) { api.move(300, 620, 0.25); api.move(130, 600, 0.25); } return api; },
      end() { return steps; },
    };
    return api;
  }
  // Pêche à la chaîne : anneaux de x1 à x2 (hauteur de ramassage 230), puits à wx, serrure à kx
  const fish = (d, x1, x2, wx, kx, ky = 150) => d.down(x1, 366).wait(0.3).move(x1, 230, 0.5).move(x2, 230, 3.5).wait(0.4).move(wx, 230, 1.5).move(wx, 412, 2).wait(1.5).move(wx, ky, 2).move(kx, ky, 2).wait(1.2);

  const bar = [{ type: 'bar' }];
  const F = [];

  // 1 ------------------------------------------------------------ L'aimant
  F.push({ n: 1, title: "L'aimant", taunt: 'Ha ha ! Trop tard !', rooms: [
    { kind: 'atelier', tools: bar, solids: room([[700, 830]]), bodies: [{ id: 'k', kind: 'knight', x: 400, y: KY }], sensors: [trap('t', 700, 830)],
      hint: 'Touche près du chevalier et glisse vers le trou.', win: (w) => w.captured('k'),
      demo: D().down(500, 650).move(900, 650, 2.5).wait(2.5).end() },
    { kind: 'salle', tools: bar, solids: room([[720, 850]]), bodies: [{ id: 'k', kind: 'knight', x: 300, y: KY }], sensors: [trap('t', 720, 850)],
      cage: { x: 1040, y: 540 }, witch: { x: 920, y: 560 }, hint: 'Ton doigt tient l’aimant. Attire le chevalier dans le trou.', win: (w) => w.captured('k'),
      demo: D().down(420, 650).move(900, 650, 2.5).wait(3).end() },
    { kind: 'salle', tools: bar, solids: room([[380, 510], [760, 890]]), bodies: [{ id: 'k1', kind: 'knight', x: 200, y: KY }, { id: 'k2', kind: 'knight', x: 560, y: KY }],
      sensors: [trap('t1', 380, 510), trap('t2', 760, 890)], cage: { x: 1060, y: 540 }, witch: { x: 940, y: 560 },
      hint: 'Deux chevaliers, deux trous. Un par un.', win: (w) => w.captured('k1') && w.captured('k2'),
      demo: D().down(300, 650).move(650, 650, 2).wait(1).move(1000, 650, 2.5).wait(3).end() },
  ] });

  // 2 ------------------------------------------------------------ Attire ou pas
  F.push({ n: 2, title: 'Attire ou pas', taunt: 'La paille, ça ne colle pas !', rooms: [
    { kind: 'atelier', tools: bar, solids: room([[800, 930]]), bodies: [{ id: 's', kind: 'straw', x: 600, y: KY }, { id: 'k', kind: 'knight', x: 300, y: KY }], sensors: [trap('t', 800, 930)],
      hint: 'Essaie sur les deux. Un seul est en fer.', win: (w) => w.captured('k'),
      demo: D().down(700, 650).wait(1.5).up().down(420, 650).move(1000, 650, 3).wait(3).end() },
    { kind: 'salle', tools: bar, solids: room([[560, 690]]), bodies: [{ id: 's', kind: 'straw', x: 380, y: KY }, { id: 'k', kind: 'knight', x: 960, y: KY }], sensors: [trap('t', 560, 690)],
      cage: { x: 100, y: 540 }, witch: { x: 230, y: 560 }, hint: 'Un garde est en fer, l’autre en paille. Lequel vient vers l’aimant ?', win: (w) => w.captured('k'),
      demo: D().down(480, 650).wait(1.5).up().down(800, 665).move(560, 665, 2.5).wait(3).end() },
    { kind: 'salle', tools: bar, solids: room([[560, 690]]), bodies: [{ id: 's1', kind: 'straw', x: 380, y: KY }, { id: 's2', kind: 'straw', x: 760, y: KY }, { id: 'k', kind: 'knight', x: 120, y: KY }],
      sensors: [trap('t', 560, 690)], cage: { x: 1060, y: 540 }, witch: { x: 940, y: 560 }, hint: 'Trois gardes. Cherche celui qui est en fer.', win: (w) => w.captured('k'),
      demo: D().down(300, 665).move(700, 665, 3).wait(3).end() },
  ] });

  // 3 ------------------------------------------------------------ La serrure
  const door = (x) => ({ id: 'door', x, y: 110, w: 70, h: 610, mat: 'wood' });
  F.push({ n: 3, title: 'La serrure', taunt: 'Ma porte est fermée à clé !', rooms: [
    { kind: 'atelier', tools: bar, zone: { x: 40, y: 110, w: 600, h: 610 }, solids: room().concat([door(640)]),
      bodies: [{ id: 'bolt', kind: 'bolt', x: 630, y: 420, rail: { axis: 'y', min: 290, max: 420 } }], sensors: [latchAt('l', 'bolt', 620, 282, 110, 290)],
      hint: 'Reste à gauche de la porte. Tire le verrou vers le haut.', win: (w) => w.latched('bolt'),
      demo: D().down(600, 430).move(600, 280, 1.5).wait(1.5).end() },
    { kind: 'salle', tools: bar, zone: { x: 40, y: 110, w: 600, h: 610 }, solids: room().concat([door(640)]),
      bodies: [{ id: 'bolt', kind: 'bolt', x: 630, y: 420, rail: { axis: 'y', min: 290, max: 420 } }], sensors: [latchAt('l', 'bolt', 620, 282, 110, 290)],
      cage: { x: 1000, y: 540 }, witch: { x: 860, y: 560 }, hint: 'Le verrou est en fer, derrière la porte en bois. Fais-le glisser vers le haut.', win: (w) => w.latched('bolt'),
      demo: D().down(600, 300).wait(3).end() },
    { kind: 'salle', tools: bar, zone: { x: 40, y: 110, w: 600, h: 610 }, solids: room().concat([door(640)]),
      bodies: [{ id: 'bA', kind: 'bolt', x: 630, y: 420, rail: { axis: 'y', min: 290, max: 420 } }, { id: 'bB', kind: 'bolt', x: 630, y: 520, rail: { axis: 'y', min: 520, max: 650 } }],
      sensors: [latchAt('lA', 'bA', 620, 282, 110, 290), latchAt('lB', 'bB', 620, 642, 110, 650)],
      cage: { x: 1000, y: 540 }, witch: { x: 860, y: 560 }, hint: 'Deux verrous : un vers le haut, un vers le bas.', win: (w) => w.latched('bA') && w.latched('bB'),
      demo: D().down(600, 300).wait(2.5).move(600, 680, 1.5).wait(2.5).end() },
  ] });

  // 4 ------------------------------------------------------------ L'épée
  F.push({ n: 4, title: "L'épée", taunt: 'Mon garde ne bougera pas !', rooms: [
    { kind: 'atelier', tools: bar, solids: room().concat(niche(760)), bodies: [{ id: 'k', kind: 'knight', x: 760, y: KY }, { id: 'sword', kind: 'sword', x: 600, y: 250 }],
      sensors: [], hint: 'Touche l’épée, porte-la au-dessus du chevalier, lève le doigt.', win: (w) => w.ko('k'),
      demo: D().down(613, 240).wait(0.4).move(773, 300, 1.5).up().wait(3).end() },
    { kind: 'salle', tools: bar, solids: room().concat(niche(810)), bodies: [{ id: 'k', kind: 'knight', x: 810, y: KY }, { id: 'sword', kind: 'sword', x: 150, y: 250 }],
      sensors: [], cage: { x: 1060, y: 540 }, witch: { x: 1130, y: 380 }, hint: 'Soulève l’épée, mets-la au-dessus du chevalier, puis lève le doigt.', win: (w) => w.ko('k'),
      demo: D().down(163, 240).wait(0.4).move(823, 300, 2.2).up().wait(3).end() },
    { kind: 'salle', tools: bar, solids: room().concat(niche(460, 'a'), niche(860, 'b')),
      bodies: [{ id: 'k1', kind: 'knight', x: 460, y: KY }, { id: 'k2', kind: 'knight', x: 860, y: KY }, { id: 'sword', kind: 'sword', x: 150, y: 250 }],
      sensors: [], cage: { x: 1080, y: 540 }, witch: { x: 1140, y: 380 }, hint: 'Une seule épée pour deux chevaliers. Reprends-la après le premier.', win: (w) => w.ko('k1') && w.ko('k2'),
      demo: D().down(163, 240).wait(0.4).move(473, 300, 2).up().wait(2.5).down(473, 610).wait(0.5).move(473, 300, 1).move(873, 300, 1.5).up().wait(3).end() },
  ] });

  // 5 ------------------------------------------------------------ Les pôles
  const polesRoom = (x0, pole, mirror) => {
    const z = mirror ? { x: 780, y: 110, w: 460, h: 610 } : { x: 40, y: 110, w: 460, h: 610 };
    const gap = mirror ? [400, 580] : [700, 880];
    const plat = mirror ? { id: 'plat', x: 580, y: 600, w: 180, h: 120, mat: 'stone' } : { id: 'plat', x: 520, y: 600, w: 180, h: 120, mat: 'stone' };
    return { tools: bar, canFlip: true, zone: z, solids: room([gap]).concat([glass(mirror ? 760 : 500), plat]),
      bodies: [{ id: 'k', kind: 'knight', x: x0, y: 600 - 110, pole }], sensors: [trap('t', gap[0], gap[1])], win: (w) => w.captured('k') };
  };
  F.push({ n: 5, title: 'Les pôles', taunt: 'Mon chevalier a son propre aimant !', rooms: [
    Object.assign(polesRoom(560, 'S', false), { kind: 'atelier', hint: 'Il vient vers toi ? Retourne ton aimant, et il recule.',
      demo: D().down(480, 560).wait(2.5).flip().wait(4).end() }),
    Object.assign(polesRoom(620, 'S', true), { kind: 'salle', cage: { x: 100, y: 540 }, witch: { x: 240, y: 560 },
      hint: 'Même chose, mais de l’autre côté. Pense au pôle qui est en face.', demo: D().down(800, 560).wait(2.5).flip().wait(4).end() }),
    { kind: 'salle', tools: bar, canFlip: true, solids: room([[560, 650], [1000, 1240]]).concat([{ id: 'pA', x: 400, y: 520, w: 160, h: 120, mat: 'stone' }, { id: 'pB', x: 650, y: 520, w: 350, h: 120, mat: 'stone' }]),
      bodies: [{ id: 'kA', kind: 'knight', x: 670, y: 410, pole: 'S' }, { id: 'kB', kind: 'knight', x: 880, y: 410, pole: 'N' }],
      sensors: [trap('tA', 560, 650), trap('tB', 1000, 1240)], cage: { x: 100, y: 540 }, witch: { x: 240, y: 560 },
      hint: 'Deux chevaliers, deux aimants. L’un vient, l’autre recule : approche du bon côté.', win: (w) => w.captured('kA') && w.captured('kB'),
      demo: D().down(520, 540).wait(3).move(790, 540, 1.5).wait(3).end() },
  ] });

  // 6 ------------------------------------------------------------ La portée
  const reachRoom = (bodies, gaps, sensors, win) => ({ tools: [{ type: 'bar' }, { type: 'double' }], zone: { x: 40, y: 110, w: 200, h: 610 }, solids: room(gaps).concat([glass(240)]), bodies, sensors, win });
  F.push({ n: 6, title: 'La portée', taunt: 'Trop loin pour ton aimant !', rooms: [
    Object.assign(reachRoom([{ id: 'k', kind: 'knight', x: 500, y: KY }], [[330, 460]], [trap('t', 330, 460)], (w) => w.captured('k')),
      { kind: 'atelier', hint: 'L’aimant simple ne porte pas assez loin. Prends l’aimant double.', demo: D().down(230, 650).wait(2).up().tool(1).down(230, 650).wait(5).end() }),
    Object.assign(reachRoom([{ id: 'k', kind: 'knight', x: 500, y: KY }], [[330, 460]], [trap('t', 330, 460)], (w) => w.captured('k')),
      { kind: 'salle', cage: { x: 1040, y: 540 }, witch: { x: 900, y: 560 }, hint: 'Reste derrière la vitre. Quel aimant tire assez loin ?', demo: D().tool(1).down(230, 650).wait(5).end() }),
    Object.assign(reachRoom([{ id: 'k1', kind: 'knight', x: 430, y: KY }, { id: 'k2', kind: 'knight', x: 540, y: KY }], [[330, 420]], [trap('t', 330, 420)], (w) => w.captured('k1') && w.captured('k2')),
      { kind: 'salle', cage: { x: 1040, y: 540 }, witch: { x: 900, y: 560 }, hint: 'Le premier est près, le second est loin. Change d’aimant quand il le faut.',
        demo: D().down(230, 650).wait(3).up().tool(1).down(230, 650).wait(5).end() }),
  ] });

  // 7 ------------------------------------------------------------ Le fer à cheval
  const herse = (id, x) => ({ id, kind: 'herse', x, y: 570, rail: { axis: 'y', min: 360, max: 570 } });
  const hTools = [{ type: 'bar' }, { type: 'horseshoe' }];
  F.push({ n: 7, title: 'Le fer à cheval', taunt: 'Ma herse est bien trop lourde !', rooms: [
    { kind: 'atelier', tools: hTools, solids: room(), bodies: [herse('herse', 880)], sensors: [latchAt('latch', 'herse', 880, 420, 180, 360)],
      hint: 'La herse est lourde. Essaie le fer à cheval.', win: (w) => w.latched('herse'),
      demo: D().down(970, 560).wait(1.5).up().tool(1).down(970, 560).wait(0.6).move(970, 330, 2).wait(1).end() },
    { kind: 'salle', tools: hTools, solids: room(), bodies: [herse('herse', 880)], sensors: [latchAt('latch', 'herse', 880, 420, 180, 360)],
      cage: { x: 900, y: 540 }, witch: { x: 1110, y: 560 }, hint: 'Le fer à cheval a ses deux pôles au même endroit : il tire plus fort.', win: (w) => w.latched('herse'),
      demo: D().tool(1).down(970, 560).wait(0.6).move(970, 330, 2).wait(1).end() },
    { kind: 'salle', tools: hTools, solids: room(), bodies: [herse('hA', 300), herse('hB', 880)], sensors: [latchAt('lA', 'hA', 300, 420, 180, 360), latchAt('lB', 'hB', 880, 420, 180, 360)],
      cage: { x: 900, y: 540 }, witch: { x: 1110, y: 560 }, hint: 'Deux herses. Une après l’autre.', win: (w) => w.latched('hA') && w.latched('hB'),
      demo: D().tool(1).down(390, 560).wait(0.6).move(390, 330, 2).wait(0.5).up().down(970, 560).wait(0.6).move(970, 330, 2).wait(1).end() },
  ] });

  // 8 ------------------------------------------------------------ La chaîne
  const wellSolids = (depth) => [
    { id: 'ceil', x: 0, y: 90, w: 1280, h: 20 }, { id: 'wallL', x: 0, y: 90, w: 40, h: 710 }, { id: 'wallR', x: 1240, y: 90, w: 40, h: 710 },
    { id: 'platL', x: 0, y: 420, w: 600, h: 380 }, { id: 'platR', x: 720, y: 420, w: 560, h: 380 }, { id: 'bottom', x: 600, y: 420 + depth, w: 120, h: 380 - depth },
  ];
  const rings = (xs, prefix = 'r') => xs.map((x, i) => ({ id: prefix + (i + 1), kind: 'ring', x, y: 376 }));
  F.push({ n: 8, title: 'La chaîne', taunt: 'La clé est tout au fond du puits !', rooms: [
    { kind: 'atelier', tools: bar, zone: { x: 40, y: 110, w: 1200, h: 310 }, solids: wellSolids(200), bodies: rings([180, 250, 320]).concat([{ id: 'key', kind: 'key', x: 633, y: 590 }]),
      sensors: [{ id: 'keyhole', type: 'keyhole', body: 'key', x: 960, y: 260, w: 150, h: 150 }], well: { x: 600, y: 420, w: 120, h: 200 },
      hint: 'Colle les anneaux les uns aux autres, puis descends la chaîne dans le puits.', win: (w) => w.pressed('keyhole'),
      demo: fish(D(), 202, 400, 660, 1035).end() },
    { kind: 'salle', tools: bar, zone: { x: 40, y: 110, w: 1200, h: 310 }, solids: wellSolids(320), bodies: rings([180, 250, 320, 390]).concat([{ id: 'key', kind: 'key', x: 633, y: 710 }]),
      sensors: [{ id: 'keyhole', type: 'keyhole', body: 'key', x: 960, y: 260, w: 150, h: 150 }], cage: { x: 1040, y: 250 }, witch: { x: 860, y: 270 }, well: { x: 600, y: 420, w: 120, h: 320 },
      hint: 'Il faut les quatre anneaux : le puits est profond.', win: (w) => w.pressed('keyhole'),
      demo: fish(D(), 202, 470, 660, 1035).end() },
    { kind: 'salle', tools: bar, zone: { x: 40, y: 110, w: 1200, h: 310 }, solids: wellSolids(320),
      bodies: rings([860, 930], 'rR').concat(rings([380, 450], 'rL'), [{ id: 'key', kind: 'key', x: 633, y: 710 }]),
      sensors: [{ id: 'keyhole', type: 'keyhole', body: 'key', x: 150, y: 260, w: 150, h: 150 }], cage: { x: 100, y: 250 }, witch: { x: 300, y: 270 }, well: { x: 600, y: 420, w: 120, h: 320 },
      hint: 'Les anneaux sont des deux côtés du puits. Ramasse-les tous, la serrure est à gauche.', win: (w) => w.pressed('keyhole'),
      demo: D().down(882, 366).wait(0.3).move(882, 230, 0.5).move(1000, 230, 1.5).move(430, 230, 3).move(520, 230, 1.5).wait(0.4).move(660, 230, 1.2).move(660, 412, 2).wait(1.5).move(660, 150, 2).move(225, 150, 2.5).wait(1.2).end() },
  ] });

  // 9 ------------------------------------------------------------ Le bouclier
  const plates = (slitY, slitH) => [{ id: 'plateTop', x: 640, y: 110, w: 22, h: slitY - 110, mat: 'iron' }, { id: 'plateBot', x: 640, y: slitY + slitH, w: 22, h: 720 - slitY - slitH, mat: 'iron' }];
  const shieldRoom = (slitY, slitH, boltY) => ({ tools: bar, zone: { x: 40, y: 110, w: 600, h: 610 }, solids: room().concat(plates(slitY, slitH)),
    bodies: [{ id: 'bolt', kind: 'bolt', x: 780, y: boltY, rail: { axis: 'x', min: 680, max: 780 } }], sensors: [latchAt('l', 'bolt', 660, boltY - 8, 90, undefined)], win: (w) => w.latched('bolt') });
  F.push({ n: 9, title: 'Le bouclier', taunt: 'Une plaque de fer, et ton aimant ne passe plus !', rooms: [
    Object.assign(shieldRoom(380, 60, 400), { kind: 'atelier', hint: 'Le fer bloque l’aimant. Mets ta main en face de la fente.', demo: D().down(610, 250).wait(1.5).move(610, 410, 1).wait(3).end() }),
    Object.assign(shieldRoom(380, 60, 400), { kind: 'salle', cage: { x: 1040, y: 540 }, witch: { x: 1120, y: 380 }, hint: 'Le fer bloque l’aimant. Trouve la fente dans la plaque.', demo: D().down(610, 410).wait(3).end() }),
    Object.assign(shieldRoom(480, 80, 400), { kind: 'salle', cage: { x: 1040, y: 540 }, witch: { x: 1120, y: 380 }, hint: 'La fente n’est pas en face du verrou. Colle ta main à la plaque, au niveau de la fente.', demo: D().down(632, 545).wait(3).end() }),
  ] });

  // 10 ----------------------------------------------------------- Le clou aimanté
  const nailRoom = (doors, bolts, win) => ({ tools: [{ type: 'nail' }], lodestone: { x: 90, y: 540, w: 230, h: 180 }, solids: room().concat(doors), bodies: bolts, sensors: bolts.map((b) => latchAt('l' + b.id, b.id, b.x - 10, 282, 110, 290)), win });
  const nb = (id, x) => ({ id, kind: 'bolt', x, y: 420, mass: 0.5, rail: { axis: 'y', min: 290, max: 420 } });
  F.push({ n: 10, title: 'Le clou aimanté', taunt: 'Je t’ai pris ton aimant ! Ha ha !', rooms: [
    Object.assign(nailRoom([Object.assign(door(520), { id: 'door' })], [nb('bolt', 510)], (w) => w.latched('bolt')),
      { kind: 'atelier', hint: 'Frotte le clou sur la pierre noire, puis vite au verrou !', demo: D().down(130, 600).rub(10).move(440, 300, 1).wait(3).end() }),
    Object.assign(nailRoom([door(700)], [nb('bolt', 690)], (w) => w.latched('bolt')),
      { kind: 'salle', cage: { x: 1040, y: 540 }, witch: { x: 900, y: 560 }, hint: 'Frotte le clou sur la pierre noire. Il devient aimant… pour un moment !',
        demo: D().down(130, 600).rub(12).move(620, 300, 1).wait(3).end() }),
    Object.assign(nailRoom([door(640), Object.assign(door(960), { id: 'door2' })], [nb('bA', 630), nb('bB', 950)], (w) => w.latched('bA') && w.latched('bB')),
      { kind: 'salle', cage: { x: 1100, y: 540 }, witch: { x: 1040, y: 400 }, hint: 'Deux verrous, et le clou faiblit. Refrotte s’il le faut.',
        demo: D().down(130, 600).rub(12).move(560, 300, 1).wait(2.5).move(880, 300, 1).wait(3).end() }),
  ] });

  // 11 ----------------------------------------------------------- L'électroaimant
  const craneRoom = (extra, bodies, btnX, win, crane = { x: 300, y: 250 }) => ({ tools: [{ type: 'electro' }], crane, craneZone: { x: 80, y: 130, w: 1120, h: 470 }, solids: room().concat(extra), bodies,
    sensors: [{ id: 'btn', type: 'button', x: btnX, y: 700, w: 160, h: 20, minMass: 4, sticky: true }], win });
  F.push({ n: 11, title: "L'électroaimant", taunt: 'Un bouton ? Il faut quelque chose de lourd !', rooms: [
    Object.assign(craneRoom([], [{ id: 'k', kind: 'knight', x: 200, y: KY }], 880, (w) => w.pressed('btn')),
      { kind: 'atelier', hint: 'Allume, soulève le chevalier, va au-dessus du bouton, éteins.', demo: D().electro().down(300, 580).wait(2).move(960, 560, 2).up().electro().wait(3).end() }),
    Object.assign(craneRoom([], [{ id: 'k', kind: 'knight', x: 1000, y: KY }], 240, (w) => w.pressed('btn'), { x: 900, y: 250 }),
      { kind: 'salle', cage: { x: 1060, y: 540 }, witch: { x: 1130, y: 380 }, hint: 'Allume l’électroaimant, soulève le chevalier, et éteins-le au-dessus du bouton.',
        demo: D().electro().down(1000, 580).wait(2).move(320, 560, 2.5).up().electro().wait(3).end() }),
    Object.assign(craneRoom([{ id: 'wall', x: 600, y: 400, w: 40, h: 320, mat: 'stone' }], [{ id: 'k', kind: 'knight', x: 200, y: KY }], 880, (w) => w.pressed('btn')),
      { kind: 'salle', cage: { x: 1060, y: 540 }, witch: { x: 1130, y: 380 }, hint: 'Un mur. Monte haut avant de passer de l’autre côté.',
        demo: D().electro().down(300, 580).wait(2).move(300, 180, 1.5).move(960, 180, 2.5).move(960, 560, 1.5).up().electro().wait(3).end() }),
  ] });

  // 12 ----------------------------------------------------------- La bobine
  const coilRoom = (bodies, sensors, win, crane = { x: 400, y: 250 }) => ({ tools: [{ type: 'electro' }], turns: 1, turnsNeeded: 4, crane, craneZone: { x: 80, y: 130, w: 1120, h: 470 }, solids: room(), bodies, sensors, win });
  const herse5 = (id, x, mass = 5) => ({ id, kind: 'herse', x, y: 570, mass, rail: { axis: 'y', min: 360, max: 570 } });
  F.push({ n: 12, title: 'La bobine', taunt: 'Ton électroaimant est tout faible !', rooms: [
    Object.assign(coilRoom([herse5('herse', 880)], [latchAt('latch', 'herse', 880, 420, 180, 360)], (w) => w.latched('herse')),
      { kind: 'atelier', hint: 'Trop faible ? Ajoute des tours de fil, puis réessaie.', demo: D().electro().down(970, 560).wait(1.5).turn().turn().turn().wait(0.6).move(970, 330, 2).wait(1).end() }),
    Object.assign(coilRoom([herse5('herse', 880), { id: 'k', kind: 'knight', x: 200, y: KY }], [latchAt('latch', 'herse', 880, 420, 180, 360), { id: 'btn', type: 'button', x: 480, y: 700, w: 160, h: 20, minMass: 4, sticky: true }], (w) => w.latched('herse') && w.pressed('btn')),
      { kind: 'salle', cage: { x: 900, y: 540 }, witch: { x: 1110, y: 560 }, hint: 'Plus la bobine a de tours de fil, plus l’électroaimant est fort. Ajoute des tours.',
        demo: D().electro().turn().turn().turn().down(970, 560).wait(0.8).move(970, 330, 2).wait(0.5).up().down(300, 580).wait(2).move(560, 560, 1.5).up().electro().wait(3).end() }),
    Object.assign(coilRoom([herse5('hA', 300, 3), herse5('hB', 880, 9)], [latchAt('lA', 'hA', 300, 420, 180, 360), latchAt('lB', 'hB', 880, 420, 180, 360)], (w) => w.latched('hA') && w.latched('hB')),
      { kind: 'salle', cage: { x: 900, y: 540 }, witch: { x: 1110, y: 560 }, hint: 'Une herse légère, une herse très lourde. Encore plus de tours pour la seconde.',
        demo: D().electro().turn().turn().down(390, 560).wait(0.8).move(390, 330, 2).wait(0.4).up().turn().turn().turn().turn().down(970, 560).wait(0.8).move(970, 330, 2).wait(1).end() }),
  ] });

  // 13 ----------------------------------------------------------- La boussole
  const darkRoom = (tx, ty, leverX) => ({ tools: [{ type: 'compass' }], dark: true, compassTarget: { x: tx, y: ty }, solids: room(),
    bodies: [{ id: 'lever', kind: 'lever', x: leverX, y: ty - 50, hidden: true, rail: { axis: 'y', min: ty - 50, max: ty + 60 } }],
    sensors: [{ id: 'secret', type: 'secret', x: tx - 60, y: ty - 60, w: 120, h: 120, reveals: ['lever'] }], win: (w) => w.railAtMax('lever') });
  F.push({ n: 13, title: 'La boussole', taunt: 'Dans le noir, tu ne trouveras jamais !', rooms: [
    Object.assign(darkRoom(400, 300, 385), { kind: 'atelier', hint: 'Suis l’aiguille, tape sur le mur, puis baisse le levier.',
      demo: D().down(900, 500).move(450, 320, 2.5).up().tap(400, 300).wait(0.5).down(400, 300).move(400, 450, 1.2).up().wait(1).end() }),
    Object.assign(darkRoom(985, 400, 970), { kind: 'salle', cage: { x: 1060, y: 540 }, witch: { x: 760, y: 560 }, hint: 'L’aiguille montre l’aimant caché. Tape sur le mur à cet endroit, puis baisse le levier.',
      demo: D().down(300, 500).move(950, 420, 2.5).up().tap(985, 400).wait(0.5).down(985, 400).move(985, 550, 1.2).up().wait(1).end() }),
    Object.assign(darkRoom(300, 560, 285), { kind: 'salle', cage: { x: 1060, y: 540 }, witch: { x: 760, y: 560 }, hint: 'Nouvelle cachette. La boussole sait.',
      demo: D().down(900, 300).move(330, 540, 2.5).up().tap(300, 560).wait(0.5).down(300, 560).move(300, 700, 1.2).up().wait(1).end() }),
  ] });

  // 14 ----------------------------------------------------------- Le pôle caché
  const hiddenRoom = (mirror, fixed) => Object.assign(polesRoom(mirror ? 620 : 560, fixed || 'N', mirror), { filingsButton: true });
  const hr = (mirror, fixed) => { const r = hiddenRoom(mirror, fixed); r.bodies[0].hiddenPole = true; if (!fixed) r.bodies[0].randomPole = true; return r; };
  F.push({ n: 14, title: 'Le pôle caché', taunt: 'J’ai peint son aimant. Devine les pôles !', rooms: [
    Object.assign(hr(false, 'S'), { kind: 'atelier', hint: 'Appuie sur Limaille : les lignes montrent les pôles cachés.', demo: D().filings().wait(1).down(480, 560).wait(2.5).flip().wait(4).end() }),
    Object.assign(hr(false), { kind: 'salle', cage: { x: 1060, y: 540 }, witch: { x: 1130, y: 380 }, hint: 'La limaille de fer dessine les lignes invisibles. Regarde, puis choisis le bon côté.', demo: D().filings().down(480, 560).wait(2.5).flip().wait(4).end() }),
    Object.assign(hr(true), { kind: 'salle', cage: { x: 100, y: 540 }, witch: { x: 240, y: 560 }, hint: 'De l’autre côté, et les pôles sont encore cachés.', demo: D().filings().down(800, 560).wait(2.5).flip().wait(4).end() }),
  ] });

  // 15 ----------------------------------------------------------- Tout ensemble
  F.push({ n: 15, title: 'Tout ensemble', taunt: 'Trois pièges d’un coup. Bonne chance !', rooms: [
    { kind: 'salle', tools: bar, zone: { x: 40, y: 110, w: 1200, h: 310 },
      solids: wellSolids(320).concat([{ id: 'trapdoor', x: 600, y: 420, w: 120, h: 22, mat: 'wood' }]),
      bodies: [{ id: 'k', kind: 'knight', x: 120, y: 420 - 110 }].concat(rings([800, 870, 940, 1010]), [{ id: 'key', kind: 'key', x: 633, y: 710 }]),
      sensors: [{ id: 'btn', type: 'button', x: 380, y: 400, w: 150, h: 20, minMass: 4, sticky: true, removes: 'trapdoor' }, { id: 'keyhole', type: 'keyhole', body: 'key', x: 1010, y: 250, w: 150, h: 150 }],
      cage: { x: 1090, y: 250 }, witch: { x: 760, y: 270 }, well: { x: 600, y: 420, w: 120, h: 320 },
      hint: 'Le chevalier sur le bouton ouvre la trappe. Puis la chaîne va chercher la clé.', win: (w) => w.pressed('keyhole'),
      demo: fish(D().down(300, 360).move(560, 360, 3).wait(2).up(), 822, 1090, 660, 1085).end() },
    { kind: 'salle', tools: bar, zone: { x: 40, y: 110, w: 720, h: 610 }, solids: room().concat(niche(400), [{ id: 'plateTop', x: 760, y: 110, w: 22, h: 270, mat: 'iron' }, { id: 'plateBot', x: 760, y: 440, w: 22, h: 280, mat: 'iron' }]),
      bodies: [{ id: 'k', kind: 'knight', x: 400, y: KY }, { id: 'sword', kind: 'sword', x: 150, y: 250 }, { id: 'bolt', kind: 'bolt', x: 900, y: 400, rail: { axis: 'x', min: 800, max: 900 } }],
      sensors: [latchAt('l', 'bolt', 780, 392, 110, undefined)], cage: { x: 1060, y: 540 }, witch: { x: 1130, y: 380 },
      hint: 'L’épée sur le chevalier, puis le verrou derrière la plaque de fer.', win: (w) => w.ko('k') && w.latched('bolt'),
      demo: D().down(163, 240).wait(0.4).move(413, 300, 1.5).up().wait(2.5).down(735, 410).wait(3).end() },
  ] });

  // 16 ----------------------------------------------------------- Le sommet
  F.push({ n: 16, title: 'Le sommet', taunt: 'Mon aimant géant tient la cage. Tu ne l’ouvriras jamais !', final: true, rooms: [
    { kind: 'salle', tools: [{ type: 'horseshoe' }], canFlip: true, final: true, solids: room(),
      bodies: [
        { id: 'giant', kind: 'giant', x: 560, y: 260, pole: 'S', rail: { axis: 'x', min: 300, max: 1300, flingAt: 700 } },
        { id: 'porte', kind: 'herse', x: 900, y: 570, mass: 3, rail: { axis: 'y', min: 360, max: 570 }, lockedUntil: (w) => w.railAtMax('giant') },
      ],
      sensors: [latchAt('latch', 'porte', 900, 420, 180, 360)], cage: { x: 920, y: 540 }, witch: { x: 600, y: 120, rides: 'giant' },
      hint: 'Retourne ton aimant pour repousser l’aimant géant. Puis soulève la porte de la cage.', win: (w) => w.latched('porte'),
      demo: D().down(500, 292).wait(2).flip().wait(4).up().down(990, 560).wait(0.6).move(990, 330, 2).wait(1).end() },
  ] });

  // Propage n/title/taunt/final dans chaque salle
  for (const f of F) f.rooms.forEach((r, i) => { r.n = f.n; r.floorTitle = f.title; r.taunt = f.taunt; r.index = i; r.total = f.rooms.length; if (f.final) r.final = true; });

  const out = F;
  if (typeof module !== 'undefined' && module.exports) module.exports = out; else root.FLOORS = out;
})(typeof window !== 'undefined' ? window : globalThis);
