/* Les 16 étages de la tour (100 salles). Chaque étage = atelier + salles de plus en plus difficiles + la cage de Mei Mei.
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
    const steps = [];
    const api = {
      down(x, y, d = 0.3) { steps.push(['down', x, y, d]); return api; },
      move(x, y, d) { steps.push(['move', x, y, d]); return api; },
      up(d = 0.15) { steps.push(['up', d]); return api; },
      flip(d = 0.4) { steps.push(['flip', d]); return api; },
      tool(i, d = 0.5) { steps.push(['tool', i, d]); return api; },
      electro(d = 0.5) { steps.push(['electro', d]); return api; },
      turn(d = 0.35) { steps.push(['turn', d]); return api; },
      filings(d = 0.4) { steps.push(['filings', d]); return api; },
      tap(x, y, d = 0.4) { steps.push(['tap', x, y, d]); return api; },
      wait(d) { steps.push(['wait', d]); return api; },
      until(fn, max = 15) { steps.push(['until', fn, max]); return api; },
      rub(n = 10) { for (let i = 0; i < n; i++) { api.move(300, 620, 0.25); api.move(130, 600, 0.25); } return api; },
      // aller chercher un corps là où il est (position lue au moment de l'étape)
      grab(id, dy = -12, d = 0.8) { api.up().move((w) => cx(w, id), (w) => w.body(id).y + dy, d).down((w) => cx(w, id), (w) => w.body(id).y + dy, 0.1).wait(0.5); return api; },
      end() { return steps; },
    };
    return api;
  }
  const cx = (w, id) => { const b = w.body(id); return b.x + b.w / 2; };

  // Pêche à la chaîne : anneaux de x1 à x2 (hauteur de ramassage 230), puits à wx, serrure à kx
  const fish = (d, x1, x2, wx, kx, ky = 150) => d.down(x1, 366).wait(0.3).move(x1, 230, 0.5).move(x2, 230, 3.5).wait(0.4).move(wx, 230, 1.5).move(wx, 412, 2).wait(1.5).move(wx, ky, 2).move(kx, ky, 2).wait(1.2);

  // Fin d'étage : quand l'objectif est atteint, la clé de Mei Mei tombe ; la clé dans le cadenas de la cage termine l'étage.
  const cageLock = (cx, cy = 540) => ({ id: 'lock', type: 'keyhole', body: 'key', cageLock: true, x: cx - 10, y: cy + 20, w: 170, h: 170 });
  function fin(r, { keyX, keyY = 150, cageX = 1060, cageY = 540, open, drop } = {}) {
    r.finale = true; delete r.witch;
    r.cage = { x: cageX, y: cageY };
    r.sensors = (r.sensors || []).concat([cageLock(cageX, cageY)]);
    if (drop) {                      // la clé est portée par un chevalier : elle tombe quand il est assommé
      r.bodies = r.bodies.map((b) => (b.id === drop ? Object.assign({}, b, { drops: 'key' }) : b));
      r.bodies = r.bodies.concat([{ id: 'key', kind: 'key', x: 0, y: 0, hidden: true, respawn: true }]);
    } else if (keyX !== undefined) {   // la clé tombe du plafond quand l'objectif est réussi
      r.objective = r.win;
      r.bodies = r.bodies.concat([{ id: 'key', kind: 'key', x: keyX, y: keyY, hidden: true, revealOnObjective: true, respawn: true }]);
    }
    if (open) r.openOnObjective = open;
    r.win = (w) => w.pressed('lock');
    return r;
  }
  const bell = (x, y = 560, id = 'bell') => ({ id, type: 'alarm', x, y, w: 120, h: 160 });
  // Démo : lâcher l'aimant, prendre la clé posée en (kx, ky) [haut de la clé], la porter jusqu'à la cage
  const carry = (d, kx, ky, cx0, viaY = 300, cy = 600) => d.grab('key').move((w) => cx(w, 'key'), viaY, 0.8).move(cx0 + 75, viaY, 1.8).move(cx0 + 75, cy, 0.8).wait(1.2);

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
    fin({ kind: 'salle', tools: bar, solids: room([[300, 430]]), bodies: [{ id: 'k', kind: 'knight', x: 560, y: KY, patrol: { min: 470, max: 1200, speed: 70, dir: 1 } }],
      sensors: [trap('t', 300, 430), bell(1110)], hint: 'Il court sonner la cloche ! Ramène-le vite dans le trou, puis apporte la clé à Mei Mei.', win: (w) => w.captured('k'),
      demo: carry(D().down(520, 650).wait(0.6).move(365, 650, 1.6).wait(1.4), 640, 690, 880).end() }, { keyX: 640, cageX: 880 }),
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
    fin({ kind: 'salle', tools: bar, solids: room([[460, 590]]), bodies: [{ id: 's1', kind: 'straw', x: 260, y: KY }, { id: 's2', kind: 'straw', x: 1080, y: KY },
        { id: 'k', kind: 'knight', x: 900, y: KY, patrol: { min: 700, max: 1000, speed: 60, dir: -1 } }],
      sensors: [trap('t', 460, 590)], hint: 'Le garde en fer fait sa ronde. Attrape-le au bon moment, puis la clé !', win: (w) => w.captured('k'),
      demo: carry(D().down(820, 650).wait(0.8).move(525, 650, 2.2).wait(1.4), 700, 690, 80).end() }, { keyX: 700, cageX: 80 }),
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
    fin({ kind: 'salle', tools: bar, solids: room([[250, 380]]).concat([door(640)]),
      bodies: [{ id: 'bolt', kind: 'bolt', x: 630, y: 420, rail: { axis: 'y', min: 290, max: 420 } }, { id: 'k', kind: 'knight', x: 900, y: KY }],
      sensors: [trap('t', 250, 380), Object.assign(latchAt('l', 'bolt', 620, 282, 110, 290), { removes: 'door' })],
      hint: 'Ouvre le verrou : la porte s’ouvre. Puis amène le chevalier dans le trou.', win: (w) => w.captured('k'),
      demo: carry(D().down(600, 300).wait(1.8).move(860, 650, 1.2).wait(0.6).move(315, 650, 3.2).wait(1.5), 500, 690, 1060).end() }, { keyX: 500 }),
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
    fin({ kind: 'salle', tools: bar, solids: room(), bodies: [{ id: 'k', kind: 'knight', x: 500, y: KY, patrol: { min: 450, max: 900, speed: 80, dir: 1 } }, { id: 'sword', kind: 'sword', x: 150, y: 250, respawn: true }],
      sensors: [], hint: 'Le garde a la clé ! Tiens l’épée au-dessus de son chemin, et lâche-la au bon moment.', win: (w) => w.ko('k'),
      demo: carry(D().down(163, 240).wait(0.4).move(700, 300, 1.2).wait(0.15).up().wait(1.5), 748, 690, 1060).end() }, { drop: 'k' }),
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
    fin({ kind: 'salle', tools: bar, canFlip: true, solids: room([[960, 1090]]), bodies: [{ id: 'k', kind: 'knight', x: 800, y: KY, pole: 'S', patrol: { min: 150, max: 860, speed: 60, dir: -1 } }],
      sensors: [trap('t', 960, 1090), bell(40)], hint: 'Il file vers la cloche ! Tire-le ou repousse-le vers le trou.', win: (w) => w.captured('k'),
      demo: carry(D().down(1000, 560).wait(4), 600, 690, 230).end() }, { keyX: 600, cageX: 230 }),
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
    Object.assign(fin(reachRoom([{ id: 'k', kind: 'knight', x: 700, y: KY, patrol: { min: 470, max: 1000, speed: 60, dir: -1 } }], [[330, 460]], [trap('t', 330, 460)], (w) => w.captured('k')),
      { keyX: 900, open: ['glass240'] }), { kind: 'salle', hint: 'Il fait sa ronde. Attends qu’il s’approche, puis tire avec l’aimant double.',
      demo: carry(D().tool(1).wait(2).down(230, 650).wait(5), 900, 690, 1060).end() }),
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
    fin({ kind: 'salle', tools: hTools, solids: room().concat([{ id: 'shelf', x: 40, y: 430, w: 190, h: 24, mat: 'stone' }]),
      bodies: [{ id: 'grille', kind: 'herse', x: 230, y: 430, w: 30, h: 290, rail: { axis: 'y', min: 140, max: 430 } },
        { id: 'sword', kind: 'sword', x: 110, y: 470, respawn: true },
        { id: 'k', kind: 'knight', x: 700, y: KY, patrol: { min: 600, max: 900, speed: 70, dir: 1 } }],
      sensors: [latchAt('lg', 'grille', 215, 250, 60, 140)], hint: 'L’épée est enfermée. Lève la grille avec le fer à cheval, puis l’épée sur le garde qui a la clé.', win: (w) => w.ko('k'),
      demo: carry(D().tool(1).down(245, 420).wait(0.6).move(245, 130, 1.5).wait(0.5).move(215, 600, 0.8).wait(1).move(215, 470, 0.5).move(400, 470, 1).move(750, 300, 1.2).wait(0.5).up().wait(1.5), 764, 690, 1060).end() }, { drop: 'k' }),
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
    fin({ kind: 'salle', tools: bar, zone: { x: 40, y: 110, w: 1200, h: 310 }, solids: wellSolids(320),
      bodies: rings([180, 250, 320, 390]).concat([{ id: 'key', kind: 'key', x: 633, y: 710, respawn: true },
        { id: 'gate', kind: 'gate', x: 880, y: 110, w: 40, h: 310, rail: { axis: 'y', min: -220, max: 110 }, cycle: { open: 2, closed: 2.2 } }]),
      sensors: [], well: { x: 600, y: 420, w: 120, h: 320 },
      hint: 'Une porte s’ouvre et se ferme toute seule. Passe avec la clé quand elle est levée !',
      demo: fish(D(), 202, 470, 660, 1135).end() }, { cageX: 1060, cageY: 250 }),
  ] });

  // 9 ------------------------------------------------------------ Le bouclier
  const plates = (slitY, slitH) => [{ id: 'plateTop', x: 640, y: 110, w: 22, h: slitY - 110, mat: 'iron' }, { id: 'plateBot', x: 640, y: slitY + slitH, w: 22, h: 720 - slitY - slitH, mat: 'iron' }];
  const shieldRoom = (slitY, slitH, boltY) => ({ tools: bar, zone: { x: 40, y: 110, w: 600, h: 610 }, solids: room().concat(plates(slitY, slitH)),
    bodies: [{ id: 'bolt', kind: 'bolt', x: 780, y: boltY, rail: { axis: 'x', min: 680, max: 780 } }], sensors: [latchAt('l', 'bolt', 660, boltY - 8, 90, undefined)], win: (w) => w.latched('bolt') });
  F.push({ n: 9, title: 'Le bouclier', taunt: 'Une plaque de fer, et ton aimant ne passe plus !', rooms: [
    Object.assign(shieldRoom(380, 60, 400), { kind: 'atelier', hint: 'Le fer bloque l’aimant. Mets ta main en face de la fente.', demo: D().down(610, 250).wait(1.5).move(610, 410, 1).wait(3).end() }),
    Object.assign(shieldRoom(480, 80, 400), { kind: 'salle', cage: { x: 1040, y: 540 }, witch: { x: 1120, y: 380 }, hint: 'La fente n’est pas en face du verrou. Colle ta main à la plaque, au niveau de la fente.', demo: D().down(632, 545).wait(3).end() }),
    fin({ kind: 'salle', tools: bar, zone: { x: 40, y: 110, w: 600, h: 610 }, solids: room().concat(plates(480, 80), [{ id: 'shelf', x: 662, y: 560, w: 220, h: 20, mat: 'stone' }]),
      bodies: [{ id: 'key', kind: 'key', x: 720, y: 530, respawn: true }], sensors: [],
      hint: 'La clé de Mei Mei est derrière la plaque de fer. Attire-la par la fente.',
      demo: D().down(630, 525).wait(2).move(375, 525, 1.5).move(375, 600, 0.8).wait(1.2).end() }, { cageX: 300 }),
  ] });

  // 10 ----------------------------------------------------------- Le clou aimanté
  const nailRoom = (doors, bolts, win) => ({ tools: [{ type: 'nail' }], lodestone: { x: 90, y: 540, w: 230, h: 180 }, solids: room().concat(doors), bodies: bolts, sensors: bolts.map((b) => latchAt('l' + b.id, b.id, b.x - 10, 282, 110, 290)), win });
  const nb = (id, x) => ({ id, kind: 'bolt', x, y: 420, mass: 0.5, rail: { axis: 'y', min: 290, max: 420 } });
  F.push({ n: 10, title: 'Le clou aimanté', taunt: 'Je t’ai pris ton aimant ! Ha ha !', rooms: [
    Object.assign(nailRoom([door(700)], [nb('bolt', 690)], (w) => w.latched('bolt')),
      { kind: 'atelier', hint: 'Frotte le clou sur la pierre noire. Il devient aimant… pour un moment !',
        demo: D().down(130, 600).rub(12).move(620, 300, 1).wait(3).end() }),
    Object.assign(nailRoom([door(640), Object.assign(door(960), { id: 'door2' })], [nb('bA', 630), nb('bB', 950)], (w) => w.latched('bA') && w.latched('bB')),
      { kind: 'salle', cage: { x: 1100, y: 540 }, witch: { x: 1040, y: 400 }, hint: 'Deux verrous, et le clou faiblit. Refrotte s’il le faut.',
        demo: D().down(130, 600).rub(12).move(560, 300, 1).wait(2.5).move(880, 300, 1).wait(3).end() }),
    (() => {
      const r = nailRoom([door(760)], [nb('bolt', 750)], null); r.sensors[0].removes = 'door';
      r.bodies.push({ id: 'key', kind: 'key', x: 1000, y: 690, respawn: true });
      return fin(Object.assign(r, { kind: 'salle', hint: 'Frotte le clou, ouvre le verrou, et vite, la clé avant que le clou faiblisse !',
        demo: D().down(130, 600).rub(12).move(680, 300, 1).wait(1.5).move(1027, 650, 1.2).wait(0.8).move(1027, 300, 0.6).move(525, 300, 1.2).move(525, 600, 0.6).wait(1.2).end() }), { cageX: 450 });
    })(),
  ] });

  // 11 ----------------------------------------------------------- L'électroaimant
  const craneRoom = (extra, bodies, btnX, win, crane = { x: 300, y: 250 }) => ({ tools: [{ type: 'electro' }], crane, craneZone: { x: 80, y: 130, w: 1120, h: 470 }, solids: room().concat(extra), bodies,
    sensors: [{ id: 'btn', type: 'button', x: btnX, y: 700, w: 160, h: 20, minMass: 4, sticky: true }], win });
  F.push({ n: 11, title: "L'électroaimant", taunt: 'Un bouton ? Il faut quelque chose de lourd !', rooms: [
    Object.assign(craneRoom([], [{ id: 'k', kind: 'knight', x: 200, y: KY }], 880, (w) => w.pressed('btn')),
      { kind: 'atelier', hint: 'Allume, soulève le chevalier, va au-dessus du bouton, éteins.', demo: D().electro().down(300, 580).wait(2).move(960, 560, 2).up().electro().wait(3).end() }),
    Object.assign(craneRoom([{ id: 'wall', x: 600, y: 400, w: 40, h: 320, mat: 'stone' }], [{ id: 'k', kind: 'knight', x: 200, y: KY }], 880, (w) => w.pressed('btn')),
      { kind: 'salle', cage: { x: 1060, y: 540 }, witch: { x: 1130, y: 380 }, hint: 'Un mur. Monte haut avant de passer de l’autre côté.',
        demo: D().electro().down(300, 580).wait(2).move(300, 180, 1.5).move(960, 180, 2.5).move(960, 560, 1.5).up().electro().wait(3).end() }),
    (() => {
      const r = craneRoom([{ id: 'door', x: 1010, y: 110, w: 30, h: 610, mat: 'wood' }], [{ id: 'k', kind: 'knight', x: 400, y: KY }, { id: 'key', kind: 'key', x: 60, y: 690, respawn: true }], 700, null, { x: 500, y: 250 });
      r.sensors[0].removes = 'door';
      return fin(Object.assign(r, { kind: 'salle', hint: 'Le chevalier sur le bouton ouvre la porte. Puis la clé, avec l’électroaimant.',
        demo: D().electro().down(500, 580).wait(2).move(780, 560, 2).up().electro().wait(1.5).electro().down(87, 600).wait(1.5).move(87, 300, 1).move(1135, 300, 2.5).move(1135, 560, 1).wait(1.2).end() }), {});
    })(),
  ] });

  // 12 ----------------------------------------------------------- La bobine
  const coilRoom = (bodies, sensors, win, crane = { x: 400, y: 250 }) => ({ tools: [{ type: 'electro' }], turns: 1, turnsNeeded: 4, crane, craneZone: { x: 80, y: 130, w: 1120, h: 470 }, solids: room(), bodies, sensors, win });
  const herse5 = (id, x, mass = 5) => ({ id, kind: 'herse', x, y: 570, mass, rail: { axis: 'y', min: 360, max: 570 } });
  F.push({ n: 12, title: 'La bobine', taunt: 'Ton électroaimant est tout faible !', rooms: [
    Object.assign(coilRoom([herse5('herse', 880)], [latchAt('latch', 'herse', 880, 420, 180, 360)], (w) => w.latched('herse')),
      { kind: 'atelier', hint: 'Trop faible ? Ajoute des tours de fil, puis réessaie.', demo: D().electro().down(970, 560).wait(1.5).turn().turn().turn().wait(0.6).move(970, 330, 2).wait(1).end() }),
    Object.assign(coilRoom([herse5('hA', 300, 3), herse5('hB', 880, 9)], [latchAt('lA', 'hA', 300, 420, 180, 360), latchAt('lB', 'hB', 880, 420, 180, 360)], (w) => w.latched('hA') && w.latched('hB')),
      { kind: 'salle', cage: { x: 900, y: 540 }, witch: { x: 1110, y: 560 }, hint: 'Une herse légère, une herse très lourde. Encore plus de tours pour la seconde.',
        demo: D().electro().turn().turn().down(390, 560).wait(0.8).move(390, 330, 2).wait(0.4).up().turn().turn().turn().turn().down(970, 560).wait(0.8).move(970, 330, 2).wait(1).end() }),
    fin(Object.assign(coilRoom([herse5('grille', 1050, 9), { id: 'key', kind: 'key', x: 120, y: 690, respawn: true }], [latchAt('lg', 'grille', 1050, 420, 180, 360)], null), {
      kind: 'salle', hint: 'Une grille très lourde devant Mei Mei. Ajoute des tours, lève-la, puis apporte la clé.',
      demo: D().electro().turn().turn().turn().turn().turn().down(1140, 560).wait(0.8).move(1140, 330, 2).wait(0.5).move(147, 600, 2.5).wait(1.5).move(1135, 580, 3).wait(1.2).end() }), { cageX: 1060 }),
  ] });

  // 13 ----------------------------------------------------------- La boussole
  const darkRoom = (tx, ty, leverX) => ({ tools: [{ type: 'compass' }], dark: true, compassTarget: { x: tx, y: ty }, solids: room(),
    bodies: [{ id: 'lever', kind: 'lever', x: leverX, y: ty - 50, hidden: true, rail: { axis: 'y', min: ty - 50, max: ty + 60 } }],
    sensors: [{ id: 'secret', type: 'secret', x: tx - 60, y: ty - 60, w: 120, h: 120, reveals: ['lever'] }], win: (w) => w.railAtMax('lever') });
  F.push({ n: 13, title: 'La boussole', taunt: 'Dans le noir, tu ne trouveras jamais !', rooms: [
    Object.assign(darkRoom(985, 400, 970), { kind: 'atelier', hint: 'L’aiguille montre l’aimant caché. Tape sur le mur à cet endroit, puis baisse le levier.',
      demo: D().down(300, 500).move(950, 420, 2.5).up().tap(985, 400).wait(0.5).down(985, 400).move(985, 550, 1.2).up().wait(1).end() }),
    Object.assign(darkRoom(300, 560, 285), { kind: 'salle', cage: { x: 1060, y: 540 }, witch: { x: 760, y: 560 }, hint: 'Nouvelle cachette. La boussole sait.',
      demo: D().down(900, 300).move(330, 540, 2.5).up().tap(300, 560).wait(0.5).down(300, 560).move(300, 700, 1.2).up().wait(1).end() }),
    Object.assign(darkRoom(640, 300, 625), { kind: 'salle', finale: true, cage: { x: 1060, y: 540 }, hint: 'Le levier caché ouvre la cage de Mei Mei. La boussole sait où il est.',
      demo: D().down(200, 600).move(600, 330, 2.5).up().tap(640, 300).wait(0.5).down(640, 300).move(640, 440, 1.2).up().wait(1).end() }),
  ] });

  // 14 ----------------------------------------------------------- Le pôle caché
  const hiddenRoom = (mirror, fixed) => Object.assign(polesRoom(mirror ? 620 : 560, fixed || 'N', mirror), { filingsButton: true });
  const hr = (mirror, fixed) => { const r = hiddenRoom(mirror, fixed); r.bodies[0].hiddenPole = true; if (!fixed) r.bodies[0].randomPole = true; return r; };
  F.push({ n: 14, title: 'Le pôle caché', taunt: 'J’ai peint son aimant. Devine les pôles !', rooms: [
    Object.assign(hr(false, 'S'), { kind: 'atelier', hint: 'Appuie sur Limaille : les lignes montrent les pôles cachés. Regarde, puis choisis le bon côté.', demo: D().filings().wait(1).down(480, 560).wait(2.5).flip().wait(4).end() }),
    Object.assign(hr(true), { kind: 'salle', cage: { x: 100, y: 540 }, witch: { x: 240, y: 560 }, hint: 'De l’autre côté, et les pôles sont encore cachés.', demo: D().filings().down(800, 560).wait(2.5).flip().wait(4).end() }),
    fin(Object.assign(hr(false), { kind: 'salle', hint: 'Pôle caché, et la clé de Mei Mei au bout. Regarde la limaille !',
      demo: carry(D().filings().down(480, 560).wait(2.5).flip().wait(4), 300, 690, 1060).end() }), { keyX: 300, open: ['glass500'] }),
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
    { kind: 'salle', tools: [{ type: 'bar' }, { type: 'double' }], canFlip: true, zone: { x: 40, y: 110, w: 200, h: 610 },
      solids: room([[620, 800]]).concat([glass(240), { id: 'plat', x: 440, y: 600, w: 180, h: 120, mat: 'stone' }]),
      bodies: [{ id: 'k', kind: 'knight', x: 480, y: 600 - 110, pole: 'S' }], sensors: [trap('t', 620, 800)],
      cage: { x: 1060, y: 540 }, witch: { x: 1130, y: 380 },
      hint: 'Trop loin, et il a un aimant. Le bon aimant, et le bon côté.', win: (w) => w.captured('k'),
      demo: D().tool(1).flip().down(230, 560).wait(5).end() },
    fin({ kind: 'salle', tools: bar, solids: room().concat([{ id: 'door', x: 360, y: 110, w: 40, h: 610, mat: 'wood' }]),
      bodies: [{ id: 'bolt', kind: 'bolt', x: 335, y: 420, rail: { axis: 'y', min: 290, max: 420 } }, { id: 'sword', kind: 'sword', x: 160, y: 300, respawn: true },
        { id: 'k', kind: 'knight', x: 620, y: KY, patrol: { min: 620, max: 1200, speed: 45, dir: 1 } }],
      sensors: [Object.assign(latchAt('l', 'bolt', 325, 282, 110, 290), { removes: 'door' }), bell(1110)],
      hint: 'Vite ! Ouvre la porte, prends l’épée, et assomme le garde avant qu’il sonne la cloche.', win: (w) => w.ko('k'),
      demo: carry(D().down(470, 300).wait(1.5).move(173, 290, 1).wait(0.8).move(1000, 300, 1.5).wait(1.75).up().wait(1.5), 992, 690, 430).end() }, { drop: 'k', cageX: 430 }),
  ] });

  // 16 ----------------------------------------------------------- Le sommet
  F.push({ n: 16, title: 'Le sommet', taunt: 'Mon aimant géant tient la cage. Tu ne l’ouvriras jamais !', final: true, rooms: [
    { kind: 'salle', tools: bar, solids: room().concat([{ id: 'lintel', x: 620, y: 110, w: 40, h: 260, mat: 'stone' }]),
      bodies: [{ id: 'key', kind: 'key', x: 180, y: 690, respawn: true }, { id: 'gate', kind: 'gate', x: 620, y: 370, w: 40, h: 350, rail: { axis: 'y', min: 20, max: 370 }, cycle: { open: 1.6, closed: 2.2 } }],
      sensors: [{ id: 'keyhole', type: 'keyhole', body: 'key', x: 1000, y: 420, w: 180, h: 200 }],
      hint: 'La porte du sommet s’ouvre et se ferme. Passe avec la clé quand elle est levée !', win: (w) => w.pressed('keyhole'),
      demo: D().down(207, 678).wait(0.6).move(207, 600, 0.5).move(560, 600, 1.2).wait(1.6).move(1090, 600, 1.0).wait(1.2).end() },
    { kind: 'salle', tools: [{ type: 'horseshoe' }], canFlip: true, final: true, solids: room(),
      bodies: [
        { id: 'giant', kind: 'giant', x: 560, y: 260, pole: 'S', rail: { axis: 'x', min: 300, max: 1300, flingAt: 700 } },
        { id: 'porte', kind: 'herse', x: 900, y: 570, mass: 3, rail: { axis: 'y', min: 360, max: 570 }, lockedUntil: (w) => w.railAtMax('giant') },
      ],
      sensors: [latchAt('latch', 'porte', 900, 420, 180, 360)], cage: { x: 920, y: 540 }, witch: { x: 600, y: 120, rides: 'giant' },
      hint: 'Retourne ton aimant pour repousser l’aimant géant. Puis soulève la porte de la cage.', win: (w) => w.latched('porte'),
      demo: D().down(500, 292).wait(2).flip().wait(4).up().down(990, 560).wait(0.6).move(990, 330, 2).wait(1).end() },
  ] });

  // ============================================================ Salles de combinaison (100 salles au total)

  // ----- démos génériques -----
  const toward = (w, id, x) => cx(w, id) + Math.sign(x - cx(w, id)) * 70;
  // tirer un chevalier jusqu'au-dessus d'un trou
  const pull = (d, id, toX, dur = 2.2) => d.up()
    .move((w) => toward(w, id, toX), (w) => w.body(id).y + 40, 0.6)
    .down((w) => toward(w, id, toX), (w) => w.body(id).y + 40, 0.1).wait(0.4)
    .move(toX, (w) => w.body(id).y + 40, dur).wait(1.4);
  // prendre l'épée, la tenir au-dessus du chemin du chevalier, la lâcher au bon moment
  const willBeUnder = (k, x, fall = 0.44) => (w) => {
    const b = w.body(k); const c = b.x + b.w / 2;
    if (!b.patrol) return true;
    return Math.abs(c + b.patrol.speed * fall * b.patrol.dir - x) < 12;
  };
  const dropOn = (d, sw, k, holdX, holdY = 300) => d.grab(sw)
    .move(holdX ?? ((w) => cx(w, k)), holdY, 1.2)
    .until(holdX === undefined ? () => true : willBeUnder(k, holdX), 25)
    .up().wait(1.2);
  const gateJustOpen = (id, a = 0.5, b = 0.8) => (w) => { const g = w.body(id), c = g.cycle, t = (w.time + (c.offset || 0)) % (c.open + c.closed); return t > a && t < b; };
  const all = (ids, fn) => (w) => ids.every((id) => fn(w, id));
  const capturedAll = (...ids) => all(ids, (w, id) => w.captured(id));
  const koAll = (...ids) => all(ids, (w, id) => w.ko(id));
  const sword = (x = 150, y = 250, extra = {}) => Object.assign({ id: 'sword', kind: 'sword', x, y, respawn: true }, extra);
  const K = (id, x, extra = {}) => Object.assign({ id, kind: 'knight', x, y: KY }, extra);
  const cell = () => ({ solid: { id: 'shelf', x: 40, y: 430, w: 190, h: 24, mat: 'stone' },
    bodies: [{ id: 'grille', kind: 'herse', x: 230, y: 430, w: 30, h: 290, rail: { axis: 'y', min: 140, max: 430 } }, sword(110, 470)],
    sensor: latchAt('lg', 'grille', 215, 250, 60, 140) });
  // ouvrir la grille au fer à cheval puis sortir l'épée de la cellule (outil 1 = fer à cheval)
  const openCell = (d) => d.tool(1).down(245, 420).wait(0.6).move(245, 130, 1.5).wait(0.5).move(215, 600, 0.8).wait(1).move(215, 470, 0.5).move(400, 470, 1);
  const multiDark = (pts) => ({ tools: [{ type: 'compass' }], dark: true, solids: room(),
    bodies: pts.map(([tx, ty], i) => ({ id: 'lever' + i, kind: 'lever', x: tx - 15, y: ty - 50, hidden: true, rail: { axis: 'y', min: ty - 50, max: ty + 60 } })),
    sensors: pts.map(([tx, ty], i) => ({ id: 'secret' + i, type: 'secret', x: tx - 60, y: ty - 60, w: 120, h: 120, reveals: ['lever' + i] })),
    win: (w) => pts.every((_, i) => w.railAtMax('lever' + i)) });
  const darkDemo = (pts) => {
    const d = D().down(640, 650).move(pts[0][0], pts[0][1] + 30, 1.6).up();
    pts.forEach(([tx, ty], i) => {
      if (i) d.down(pts[i - 1][0] + (tx > pts[i - 1][0] ? 100 : -100), Math.min(680, pts[i - 1][1] + 160)).move(tx, ty + 30, 1.6).up();
      d.tap(tx, ty).wait(0.5).down(tx, ty).move(tx, ty + 140, 1.2).up();
    });
    return d.wait(1).end();
  };
  const pedestalBtn = (x) => [{ id: 'ped', x, y: 560, w: 200, h: 160, mat: 'stone' }];
  const EXTRA = {};

  // 1 · L'aimant
  EXTRA[1] = [
    { kind: 'salle', tools: bar, solids: room([[380, 510], [1050, 1180]]), bodies: [K('k1', 200), K('k2', 600), K('k3', 880)],
      sensors: [trap('t1', 380, 510), trap('t2', 1050, 1180)], hint: 'Trois chevaliers, deux trous. Pour chacun, choisis le trou le plus proche.', win: capturedAll('k1', 'k2', 'k3'),
      demo: pull(pull(pull(D(), 'k1', 445), 'k2', 445), 'k3', 1115).end() },
  ];
  // 2 · Attire ou pas
  EXTRA[2] = [
    { kind: 'salle', tools: bar, solids: room([[450, 580]]), bodies: [K('k1', 250), { id: 's1', kind: 'straw', x: 640, y: KY }, { id: 's2', kind: 'straw', x: 820, y: KY }, K('k2', 1000)],
      sensors: [trap('t', 450, 580)], hint: 'Deux gardes en fer cachés parmi la paille. Un seul trou pour les deux.', win: capturedAll('k1', 'k2'),
      demo: pull(pull(D(), 'k1', 515), 'k2', 515, 3).end() },
  ];
  // 3 · La serrure
  EXTRA[3] = [
    { kind: 'salle', tools: bar, zone: { x: 40, y: 110, w: 600, h: 610 }, solids: room().concat([door(640)]),
      bodies: [{ id: 'bA', kind: 'bolt', x: 630, y: 300, rail: { axis: 'y', min: 180, max: 300 } }, { id: 'bB', kind: 'bolt', x: 630, y: 420, rail: { axis: 'y', min: 420, max: 520 } }, { id: 'bC', kind: 'bolt', x: 630, y: 600, rail: { axis: 'y', min: 600, max: 680 } }],
      sensors: [latchAt('lA', 'bA', 620, 172, 110, 180), latchAt('lB', 'bB', 620, 512, 110, 520), latchAt('lC', 'bC', 620, 672, 110, 680)],
      hint: 'Trois verrous : un vers le haut, deux vers le bas.', win: all(['bA', 'bB', 'bC'], (w, id) => w.latched(id)),
      demo: D().down(600, 170).wait(2).move(600, 540, 1).wait(2).move(600, 700, 1).wait(2).end() },
  ];
  // 4 · L'épée
  EXTRA[4] = [
    { kind: 'salle', tools: bar, solids: room(), bodies: [K('k', 450, { patrol: { min: 400, max: 950, speed: 70, dir: 1 } }), sword()],
      hint: 'Il marche ! Tiens l’épée au-dessus de son chemin et lâche-la juste avant qu’il passe dessous.', win: (w) => w.ko('k'),
      demo: dropOn(D(), 'sword', 'k', 700).end() },
    { kind: 'salle', tools: bar, solids: room(), bodies: [K('k1', 300, { patrol: { min: 250, max: 560, speed: 80, dir: 1 } }), K('k2', 900, { patrol: { min: 700, max: 1100, speed: 90, dir: -1 } }), sword()],
      hint: 'Deux gardes en ronde, une seule épée. Reprends-la après le premier.', win: koAll('k1', 'k2'),
      demo: dropOn(dropOn(D(), 'sword', 'k1', 420), 'sword', 'k2', 900).end() },
  ];
  // 5 · Les pôles
  EXTRA[5] = [
    { kind: 'salle', tools: bar, canFlip: true, solids: room([[560, 690]]), bodies: [K('k1', 420, { pole: 'N' }), K('k2', 760, { pole: 'N' })],
      sensors: [trap('t', 560, 690)], hint: 'Ils te repoussent tous les deux. Retourne ton aimant pour les attirer dans le trou.', win: capturedAll('k1', 'k2'),
      demo: D().flip().down(625, 560).wait(5).end() },
    { kind: 'salle', tools: bar, canFlip: true, zone: { x: 720, y: 110, w: 520, h: 610 }, solids: room([[380, 540]]).concat([glass(700)]), bodies: [K('k', 580, { pole: 'N' })],
      sensors: [trap('t', 380, 540)], hint: 'Le trou est de l’autre côté. Pousse-le sans le toucher !', win: (w) => w.captured('k'),
      demo: D().down(730, 650).wait(4).end() },
  ];
  // 6 · La portée
  EXTRA[6] = [
    Object.assign(reachRoom([K('k1', 400), K('k2', 700, { patrol: { min: 520, max: 950, speed: 70, dir: 1 } })], [[280, 390]], [trap('t', 280, 390)], capturedAll('k1', 'k2')),
      { kind: 'salle', hint: 'Le premier est tout près. Le second fait sa ronde : attends-le avec l’aimant double.',
        demo: D().down(230, 650).wait(3).up().tool(1).until((w) => cx(w, 'k2') < 600).down(230, 650).wait(5).end() }),
    Object.assign(reachRoom([K('k1', 445), K('k2', 520)], [[330, 440]], [trap('t', 330, 440)], capturedAll('k1', 'k2')),
      { kind: 'salle', hint: 'Deux d’un coup ? Avec l’aimant double, peut-être…', demo: D().tool(1).down(230, 650).wait(7).end() }),
  ];
  // 7 · Le fer à cheval
  EXTRA[7] = [
    { kind: 'salle', tools: hTools, solids: room([[300, 430]]), bodies: [herse('hA', 700), K('k', 1000)], sensors: [latchAt('lA', 'hA', 700, 420, 180, 360), trap('t', 300, 430)],
      hint: 'La herse bloque le chevalier. Lève-la, puis attire-le dans le trou.', win: (w) => w.captured('k'),
      demo: pull(D().tool(1).down(790, 560).wait(0.6).move(790, 330, 2).wait(0.5), 'k', 365, 3).end() },
    (() => { const c = cell(); return { kind: 'salle', tools: hTools, solids: room().concat([c.solid], niche(800)), bodies: c.bodies.concat([K('k', 800)]), sensors: [c.sensor],
      hint: 'L’épée est enfermée derrière une grille. Lève la grille, puis l’épée sur le chevalier.', win: (w) => w.ko('k'),
      demo: openCell(D()).move(833, 300, 1.2).up().wait(2).end() }; })(),
    { kind: 'salle', tools: hTools, solids: room([[250, 380]]), bodies: [herse('hA', 450), herse('hB', 700), K('k', 1000)],
      sensors: [latchAt('lA', 'hA', 450, 420, 180, 360), latchAt('lB', 'hB', 700, 420, 180, 360), trap('t', 250, 380)],
      hint: 'Deux herses entre toi et le chevalier.', win: (w) => w.captured('k'),
      demo: pull(D().tool(1).down(540, 560).wait(0.6).move(540, 330, 2).wait(0.5).up().down(790, 560).wait(0.6).move(790, 330, 2).wait(0.5), 'k', 315, 3.5).end() },
  ];
  // 8 · La chaîne
  const fishGate = (d, x1, x2, gate, wx, kx, ky = 150) => d.down(x1, 366).wait(0.3).move(x1, 230, 0.5).move(x2, 230, 3.5).wait(0.4)
    .until(gateJustOpen(gate), 10).move(wx, 230, 1.0).move(wx, 412, 2).wait(1.5).move(wx, ky, 2).move(kx, ky, 2).wait(1.2);
  EXTRA[8] = [
    { kind: 'salle', tools: bar, zone: { x: 40, y: 110, w: 1200, h: 310 }, solids: wellSolids(320),
      bodies: rings([416, 346], 'rL').concat(rings([846, 776], 'rR'), [{ id: 'key', kind: 'key', x: 633, y: 710 }]),
      sensors: [{ id: 'keyhole', type: 'keyhole', body: 'key', x: 1020, y: 260, w: 150, h: 150 }], well: { x: 600, y: 420, w: 120, h: 320 },
      hint: 'Les anneaux sont des deux côtés. La serrure est à droite.', win: (w) => w.pressed('keyhole'),
      demo: D().down(438, 366).wait(0.3).move(438, 230, 0.5).move(320, 230, 1.5).move(890, 230, 3).move(800, 230, 1.5).wait(0.4).move(660, 230, 1.2).move(660, 412, 2).wait(1.5).move(660, 150, 2).move(1095, 150, 2.5).wait(1.2).end() },
    { kind: 'salle', tools: bar, zone: { x: 40, y: 110, w: 1200, h: 310 }, solids: wellSolids(320),
      bodies: rings([180, 250, 320, 390]).concat([{ id: 'key', kind: 'key', x: 633, y: 710 }, { id: 'gate', kind: 'gate', x: 480, y: 110, w: 40, h: 310, rail: { axis: 'y', min: -220, max: 110 }, cycle: { open: 2, closed: 2 } }]),
      sensors: [{ id: 'keyhole', type: 'keyhole', body: 'key', x: 960, y: 260, w: 150, h: 150 }], well: { x: 600, y: 420, w: 120, h: 320 },
      hint: 'Une porte s’ouvre et se ferme avant le puits. Passe avec la chaîne quand elle est levée.', win: (w) => w.pressed('keyhole'),
      demo: fishGate(D(), 202, 440, 'gate', 660, 1035).end() },
    { kind: 'salle', tools: bar, zone: { x: 40, y: 110, w: 1200, h: 310 }, solids: wellSolids(320),
      bodies: rings([800, 870, 940, 1010]).concat([{ id: 'key', kind: 'key', x: 633, y: 710 }, { id: 'gate', kind: 'gate', x: 745, y: 110, w: 40, h: 310, rail: { axis: 'y', min: -220, max: 110 }, cycle: { open: 1.6, closed: 1.8 } }]),
      sensors: [{ id: 'keyhole', type: 'keyhole', body: 'key', x: 150, y: 260, w: 150, h: 150 }], well: { x: 600, y: 420, w: 120, h: 320 },
      hint: 'La porte est plus rapide. Attends le bon moment !', win: (w) => w.pressed('keyhole'),
      demo: D().down(1032, 366).wait(0.3).move(1032, 230, 0.5).move(810, 230, 3.5).wait(0.4).until(gateJustOpen('gate', 0.45, 0.7), 10).move(660, 230, 0.8).move(660, 412, 2).wait(1.5).move(660, 150, 2).move(225, 150, 2.5).wait(1.2).end() },
  ];
  // 9 · Le bouclier
  EXTRA[9] = [
    { kind: 'salle', tools: bar, zone: { x: 40, y: 110, w: 600, h: 610 },
      solids: room().concat([{ id: 'p1', x: 640, y: 110, w: 22, h: 190, mat: 'iron' }, { id: 'p2', x: 640, y: 360, w: 22, h: 140, mat: 'iron' }, { id: 'p3', x: 640, y: 560, w: 22, h: 160, mat: 'iron' }]),
      bodies: [{ id: 'bA', kind: 'bolt', x: 780, y: 320, rail: { axis: 'x', min: 680, max: 780 } }, { id: 'bB', kind: 'bolt', x: 780, y: 520, rail: { axis: 'x', min: 680, max: 780 } }],
      sensors: [latchAt('lA', 'bA', 660, 312, 90), latchAt('lB', 'bB', 660, 512, 90)], hint: 'Deux verrous, deux fentes.', win: (w) => w.latched('bA') && w.latched('bB'),
      demo: D().down(632, 330).wait(2.5).move(632, 530, 1).wait(2.5).end() },
    { kind: 'salle', tools: bar, zone: { x: 40, y: 110, w: 600, h: 610 }, solids: room([[665, 790]]).concat([{ id: 'p1', x: 640, y: 110, w: 22, h: 450, mat: 'iron' }]),
      bodies: [K('k', 795)], sensors: [trap('t', 665, 790)], hint: 'Le chevalier est derrière la plaque. La fente est tout en bas.', win: (w) => w.captured('k'),
      demo: D().down(632, 650).wait(4).end() },
    { kind: 'salle', tools: bar, zone: { x: 40, y: 110, w: 600, h: 610 }, solids: room([[680, 790]]).concat([{ id: 'p1', x: 640, y: 110, w: 22, h: 450, mat: 'iron' }]),
      bodies: [K('k', 950, { patrol: { min: 800, max: 1200, speed: 60, dir: -1 } })], sensors: [trap('t', 680, 790), bell(1110)],
      hint: 'Il fait demi-tour vers la cloche ! Attrape-le par la fente quand il s’approche.', win: (w) => w.captured('k'),
      demo: D().down(632, 650).wait(6).end() },
  ];
  // 10 · Le clou aimanté
  EXTRA[10] = [
    Object.assign(nailRoom([Object.assign(door(450), { id: 'd1' }), Object.assign(door(750), { id: 'd2' }), Object.assign(door(1050), { id: 'd3' })], [nb('b1', 440), nb('b2', 740), nb('b3', 1040)], all(['b1', 'b2', 'b3'], (w, id) => w.latched(id))),
      { kind: 'salle', hint: 'Trois verrous ! Le clou va faiblir : frotte bien.', demo: D().down(130, 600).rub(12).move(370, 300, 1).wait(1.5).move(670, 300, 1).wait(1.5).move(970, 300, 1).wait(2).end() }),
    { kind: 'salle', tools: [{ type: 'nail' }], lodestone: { x: 90, y: 540, w: 230, h: 180 }, solids: room([[800, 930]]), bodies: [K('k', 600)], sensors: [trap('t', 800, 930)],
      hint: 'Le clou aimanté tire aussi les chevaliers.', win: (w) => w.captured('k'),
      demo: pull(D().down(130, 600).rub(12), 'k', 865).end() },
    (() => { const r = { kind: 'salle', tools: [{ type: 'nail' }], lodestone: { x: 90, y: 540, w: 230, h: 180 }, solids: room([[450, 580]]).concat([door(760)]),
      bodies: [nb('bolt', 750), K('k', 950)], sensors: [Object.assign(latchAt('l', 'bolt', 740, 282, 110, 290), { removes: 'door' }), trap('t', 450, 580)],
      hint: 'Ouvre le verrou avec le clou, puis refrotte-le pour attirer le chevalier.', win: (w) => w.captured('k'),
      demo: pull(D().down(130, 600).rub(12).move(680, 300, 1).wait(1.5).move(130, 600, 1).rub(10), 'k', 515).end() }; return r; })(),
  ];
  // 11 · L'électroaimant
  const crane = (extra) => Object.assign({ tools: [{ type: 'electro' }], crane: { x: 500, y: 250 }, craneZone: { x: 80, y: 130, w: 1120, h: 470 } }, extra);
  const btn = (id, x, y = 700) => ({ id, type: 'button', x, y, w: 160, h: 20, minMass: 4, sticky: true });
  EXTRA[11] = [
    crane({ kind: 'salle', solids: room(), bodies: [K('k1', 150), K('k2', 600)], sensors: [btn('b1', 750), btn('b2', 1000)],
      hint: 'Deux boutons, deux chevaliers. Passe en hauteur !', win: (w) => w.pressed('b1') && w.pressed('b2'),
      demo: D().electro().down(185, 580).wait(2).move(185, 200, 1).move(1080, 200, 2).move(1080, 560, 1).up().electro().wait(1.5).electro().down(635, 580).wait(2).move(830, 560, 1.5).up().electro().wait(2).end() }),
    crane({ kind: 'salle', solids: room([[900, 1030]]).concat([{ id: 'wall', x: 600, y: 400, w: 40, h: 320, mat: 'stone' }]), bodies: [K('k', 200)], sensors: [trap('t', 900, 1030)],
      hint: 'Fais tomber le chevalier dans le trou, de l’autre côté du mur.', win: (w) => w.captured('k'),
      demo: D().electro().down(235, 580).wait(2).move(235, 200, 1).move(965, 200, 2).move(965, 450, 1).up().electro().wait(2).end() }),
    crane({ kind: 'salle', solids: room().concat([{ id: 'door', x: 1010, y: 110, w: 30, h: 610, mat: 'wood' }]), bodies: [K('k', 400), { id: 'key', kind: 'key', x: 60, y: 690, respawn: true }],
      sensors: [Object.assign(btn('btn', 700), { removes: 'door' }), { id: 'keyhole', type: 'keyhole', body: 'key', x: 1060, y: 450, w: 160, h: 200 }],
      hint: 'Le bouton ouvre la porte. Puis la clé dans la serrure.', win: (w) => w.pressed('keyhole'),
      demo: D().electro().down(435, 580).wait(2).move(780, 560, 2).up().electro().wait(1.5).electro().down(87, 600).wait(1.5).move(87, 300, 1).move(1140, 300, 2.5).move(1140, 520, 1).wait(1.2).end() }),
    crane({ kind: 'salle', solids: room().concat(pedestalBtn(1000)), bodies: [K('k', 800, { patrol: { min: 60, max: 900, speed: 55, dir: -1 } })], sensors: [btn('btn', 1020, 540), bell(40)],
      hint: 'Il file vers la cloche ! Attrape-le avec la grue et pose-le sur le bouton en hauteur.', win: (w) => w.pressed('btn'),
      demo: D().electro().down((w) => cx(w, 'k'), 580).wait(2).move((w) => cx(w, 'k'), 300, 1).move(1100, 300, 2).move(1100, 400, 0.6).up().electro().wait(2).end() }),
  ];
  // 12 · La bobine
  const coil = (extra) => Object.assign({ tools: [{ type: 'electro' }], turns: 1, turnsNeeded: 4, crane: { x: 400, y: 250 }, craneZone: { x: 80, y: 130, w: 1120, h: 470 } }, extra);
  EXTRA[12] = [
    coil({ kind: 'salle', solids: room(), bodies: [herse5('hA', 120, 3), herse5('hB', 520, 5), herse5('hC', 920, 7)],
      sensors: [latchAt('lA', 'hA', 120, 420, 180, 360), latchAt('lB', 'hB', 520, 420, 180, 360), latchAt('lC', 'hC', 920, 420, 180, 360)],
      hint: 'Trois herses, de plus en plus lourdes. Ajoute des tours à chaque fois.', win: all(['hA', 'hB', 'hC'], (w, id) => w.latched(id)),
      demo: D().electro().turn().down(210, 560).wait(0.8).move(210, 330, 2).wait(0.4).up().turn().turn().down(610, 560).wait(0.8).move(610, 330, 2).wait(0.4).up().turn().down(1010, 560).wait(0.8).move(1010, 330, 2).wait(1).end() }),
    coil({ kind: 'salle', solids: room(), bodies: [K('k', 200)], sensors: [btn('btn', 900)],
      hint: 'Le chevalier est lourd. Combien de tours de fil pour le soulever ?', win: (w) => w.pressed('btn'),
      demo: D().electro().turn().turn().turn().down(235, 580).wait(2).move(980, 560, 2).up().electro().wait(2).end() }),
    coil({ kind: 'salle', solids: room(), bodies: [herse5('grille', 700, 9), K('k', 200)], sensors: [latchAt('lg', 'grille', 700, 420, 180, 360), btn('btn', 710)],
      hint: 'Le bouton est sous une herse très lourde. Lève-la d’abord.', win: (w) => w.pressed('btn'),
      demo: D().electro().turn().turn().turn().turn().turn().down(790, 560).wait(0.8).move(790, 330, 2).wait(0.5).up().down(235, 580).wait(2).move(235, 200, 1).move(790, 200, 2).move(790, 560, 1).up().electro().wait(2).end() }),
    coil({ kind: 'salle', solids: room().concat(pedestalBtn(1000)), bodies: [K('k', 800, { patrol: { min: 60, max: 900, speed: 45, dir: -1 } })], sensors: [btn('btn', 1020, 540), bell(40)],
      hint: 'Vite, des tours de fil ! Puis attrape le garde avant la cloche.', win: (w) => w.pressed('btn'),
      demo: D().electro().turn(0.25).turn(0.25).turn(0.25).down((w) => cx(w, 'k'), 580).wait(2).move((w) => cx(w, 'k'), 300, 1).move(1100, 300, 2).move(1100, 400, 0.6).up().electro().wait(2).end() }),
  ];
  // 13 · La boussole
  EXTRA[13] = [
    Object.assign(multiDark([[1000, 250]]), { kind: 'salle', hint: 'Tout là-haut, cette fois.', demo: darkDemo([[1000, 250]]) }),
    Object.assign(multiDark([[300, 300], [1000, 500]]), { kind: 'salle', hint: 'Deux cachettes, deux leviers. La boussole montre la suivante.', demo: darkDemo([[300, 300], [1000, 500]]) }),
    Object.assign(multiDark([[200, 500], [640, 220], [1080, 480]]), { kind: 'salle', hint: 'Trois leviers dans le noir !', demo: darkDemo([[200, 500], [640, 220], [1080, 480]]) }),
  ];
  // 14 · Le pôle caché
  const twoWay = (ks, gaps, extra = {}) => ({ kind: 'salle', tools: bar, canFlip: true, filingsButton: true,
    solids: room(gaps), bodies: ks.map((k) => Object.assign({ kind: 'knight', y: KY, hiddenPole: true, randomPole: true, pole: 'N' }, k)),
    sensors: gaps.map(([a, b], i) => trap('t' + i, a, b)), ...extra });
  EXTRA[14] = [
    twoWay([{ id: 'k', x: 535 }], [[400, 520], [615, 760]],
      { hint: 'Pôle caché, deux trous. Qu’il soit attiré ou repoussé, il tombe !', win: (w) => w.captured('k'), demo: D().filings().down(430, 650).wait(2.5).move(330, 650, 1).wait(2).end() }),
    twoWay([{ id: 'k1', x: 290 }, { id: 'k2', x: 840 }], [[150, 270], [380, 520], [700, 820], [930, 1070]],
      { hint: 'Deux pôles cachés. Un chevalier à la fois.', win: capturedAll('k1', 'k2'), demo: D().filings().down(190, 650).wait(2.5).move(90, 650, 1).wait(1.5).up().down(740, 650).wait(2.5).move(650, 650, 1).wait(2).end() }),
    twoWay([{ id: 'k', x: 535, patrol: { min: 525, max: 545, speed: 30, dir: 1 } }], [[400, 520], [615, 760]],
      { hint: 'Il fait sa ronde entre les deux trous, pôle caché.', win: (w) => w.captured('k'), demo: D().filings().down(430, 650).wait(3).move(330, 650, 1).wait(2).end() }),
    twoWay([{ id: 'k', x: 450 }], [[300, 430], [540, 680]],
      { tools: [{ type: 'bar' }, { type: 'double' }], zone: { x: 40, y: 110, w: 200, h: 610 },
        hint: 'Derrière la vitre, pôle caché. L’aimant double porte plus loin.', win: (w) => w.captured('k'), demo: D().tool(1).filings().down(230, 650).wait(5).end() }),
  ];
  EXTRA[14][3].solids.push(glass(240));
  // 15 · Tout ensemble
  EXTRA[15] = [
    { kind: 'salle', tools: bar, solids: room([[450, 580]]).concat(niche(800)), bodies: [K('kA', 300), K('kB', 800), sword()], sensors: [trap('t', 450, 580)],
      hint: 'Un chevalier pour le trou, un autre pour l’épée.', win: (w) => w.captured('kA') && w.ko('kB'),
      demo: dropOn(pull(D(), 'kA', 515), 'sword', 'kB').end() },
    { kind: 'salle', tools: hTools, solids: room([[150, 280]]).concat([{ id: 'door', x: 300, y: 110, w: 40, h: 610, mat: 'wood' }]),
      bodies: [{ id: 'bolt', kind: 'bolt', x: 275, y: 420, rail: { axis: 'y', min: 290, max: 420 } }, herse('hA', 600), K('k', 950)],
      sensors: [Object.assign(latchAt('l', 'bolt', 265, 282, 110, 290), { removes: 'door' }), latchAt('lA', 'hA', 600, 420, 180, 360), trap('t', 150, 280)],
      hint: 'Une porte, une herse, un chevalier. Dans quel ordre ?', win: (w) => w.captured('k'),
      demo: pull(D().down(380, 300).wait(1.5).up().tool(1).down(690, 560).wait(0.6).move(690, 330, 2).wait(0.5), 'k', 215, 4).end() },
    { kind: 'salle', tools: bar, zone: { x: 40, y: 110, w: 1200, h: 310 }, solids: wellSolids(320),
      bodies: rings([180, 250, 320, 390]).concat([{ id: 'key', kind: 'key', x: 633, y: 710 }, { id: 'k', kind: 'knight', x: 760, y: 310, patrol: { min: 740, max: 1200, speed: 45, dir: 1 } }]),
      sensors: [{ id: 'keyhole', type: 'keyhole', body: 'key', x: 150, y: 260, w: 150, h: 150 }, trap('tw', 600, 720, 420), bell(1110, 260)], well: { x: 600, y: 420, w: 120, h: 320 },
      hint: 'D’abord le garde dans le puits, avant la cloche. Ensuite la clé.', win: (w) => w.pressed('keyhole'),
      demo: fish(pull(D(), 'k', 660).up(), 202, 470, 660, 225).end() },
    crane({ kind: 'salle', solids: room().concat(niche(800)), bodies: [K('k', 800), sword(200, 624, { hook: false })], sensors: [],
      hint: 'L’électroaimant peut porter l’épée. Éteins-le au-dessus du chevalier.', win: (w) => w.ko('k'),
      demo: D().electro().down(213, 600).wait(1).move(213, 250, 1).move(835, 250, 1.5).wait(0.3).electro().wait(2).end() }),
    crane({ kind: 'salle', solids: room(), bodies: [K('k', 420, { patrol: { min: 400, max: 1200, speed: 50, dir: 1 } }), sword(150, 624, { hook: false })], sensors: [bell(1110)],
      hint: 'La grue, l’épée, et le garde qui marche vers la cloche. Éteins au bon moment !', win: (w) => w.ko('k'),
      demo: D().electro().down(163, 600).wait(1).move(163, 250, 1).move(800, 250, 1.5).until(willBeUnder('k', 800, 0.47), 20).electro().wait(2).end() }),
    (() => { const c = cell(); return { kind: 'salle', tools: hTools, solids: room().concat([c.solid]), bodies: c.bodies.concat([K('k', 520, { patrol: { min: 500, max: 1200, speed: 45, dir: 1 } })]), sensors: [c.sensor, bell(1110)],
      hint: 'Grille, épée, et un garde qui court à la cloche. Pas de temps à perdre !', win: (w) => w.ko('k'),
      demo: openCell(D()).move(990, 300, 1.2).until(willBeUnder('k', 990), 20).up().wait(2).end() }; })(),
  ];
  // 16 · Le sommet
  EXTRA[16] = [
    { kind: 'salle', tools: bar, solids: room().concat([{ id: 'l1', x: 450, y: 110, w: 40, h: 260, mat: 'stone' }, { id: 'l2', x: 850, y: 110, w: 40, h: 260, mat: 'stone' }]),
      bodies: [{ id: 'key', kind: 'key', x: 150, y: 690, respawn: true },
        { id: 'g1', kind: 'gate', x: 450, y: 370, w: 40, h: 350, rail: { axis: 'y', min: 20, max: 370 }, cycle: { open: 1.6, closed: 2.0 } },
        { id: 'g2', kind: 'gate', x: 850, y: 370, w: 40, h: 350, rail: { axis: 'y', min: 20, max: 370 }, cycle: { open: 1.6, closed: 2.0, offset: 1.8 } }],
      sensors: [{ id: 'keyhole', type: 'keyhole', body: 'key', x: 1060, y: 450, w: 160, h: 200 }],
      hint: 'Deux portes qui ne s’ouvrent pas en même temps. Attends entre les deux.', win: (w) => w.pressed('keyhole'),
      demo: D().grab('key').move(177, 600, 0.6).move(390, 600, 1).until(gateJustOpen('g1', 0.5, 0.7), 10).move(670, 600, 0.8).until(gateJustOpen('g2', 0.5, 0.7), 10).move(1140, 600, 0.9).wait(1.2).end() },
    { kind: 'salle', tools: bar, solids: room([[450, 580]]).concat(niche(300)), bodies: [K('kA', 620, { patrol: { min: 620, max: 1200, speed: 55, dir: 1 } }), K('kB', 300), sword(700, 250)],
      sensors: [trap('t', 450, 580), bell(1110)], hint: 'La garde du sommet : un garde vers la cloche, un autre dans sa niche.', win: (w) => w.captured('kA') && w.ko('kB'),
      demo: dropOn(pull(D(), 'kA', 515, 2.5), 'sword', 'kB').end() },
  ];

  // insérer avant la salle finale de chaque étage
  for (const f of F) {
    const extra = EXTRA[f.n]; if (!extra) continue;
    const last = f.rooms.length - 1;
    f.rooms.splice(last, 0, ...extra);
  }

  // Propage n/title/taunt/final dans chaque salle, et numérote les marches
  let step = 0;
  for (const f of F) { f.firstStep = step + 1; f.rooms.forEach((r, i) => { r.n = f.n; r.floorTitle = f.title; r.taunt = f.taunt; r.index = i; r.total = f.rooms.length; r.step = ++step; if (f.final && i === f.rooms.length - 1) r.final = true; }); }
  F.STEPS = step;

  const out = F;
  if (typeof module !== 'undefined' && module.exports) module.exports = out; else root.FLOORS = out;
})(typeof window !== 'undefined' ? window : globalThis);
