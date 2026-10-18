// ===== Chasseur de Dragons : logique du jeu (sans DOM, testable dans node) =====
(function (root) {
'use strict';
const W = 540, H = 960;
const A = { l: 84, r: 456, t: 172, b: 868 };          // arène jouable
const DOOR = { x: 270, half: 46, y: 140 };             // bas de la porte du haut
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return Math.abs(d); };
const ease = {
  out: t => 1 - Math.pow(1 - t, 3),
  inOut: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  back: t => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
};
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// Couleurs des projectiles
const COL = {
  green: { core: '#f6ffd9', glow: '#5cff2e', ring: '#174d0c' },
  fire:  { core: '#fff7cc', glow: '#ff5a00', ring: '#5c1200' },
  ice:   { core: '#ffffff', glow: '#22b0ff', ring: '#0a3563' },
  storm: { core: '#fff0ff', glow: '#c040ff', ring: '#33094f' },
  gold:  { core: '#fffbe0', glow: '#ffc21a', ring: '#5e3c00' },
};

// Types de dragons (sprites). ar = hauteur/largeur, body = demi-axes du corps (fraction de w,h), mouth = position de la gueule (fraction de h depuis le centre)
const DT = {
  vert:  { img: 'dragon_vert',  ar: 292 / 384, body: [.34, .40], hit: [.40, .44], mouth: -.06, col: 'green' },
  rouge: { img: 'dragon_rouge', ar: 409 / 512, body: [.18, .34], hit: [.36, .40], mouth: -.27, col: 'fire' },
  glace: { img: 'dragon_glace', ar: 366 / 512, body: [.18, .34], hit: [.36, .40], mouth: -.20, col: 'ice' },
  orage: { img: 'dragon_orage', ar: 436 / 512, body: [.17, .32], hit: [.34, .40], mouth: -.27, col: 'storm' },
  roi:   { img: 'dragon_roi',   ar: 511 / 600, body: [.20, .34], hit: [.36, .40], mouth: -.22, col: 'fire' },
};

// ------------------------------------------------------------------ niveaux
// pool : [motif, options, poids]
const LEVELS = [
  { name: 'Pousse', sub: 'le bébé dragon', world: 0, bosses: [
    { t: 'vert', w: 150, hp: 370, y: 300, spd: 60, phases: [
      { at: 1, cd: 1.5, pool: [['aimed', { n: 3, gap: .5, spd: 200 }], ['fan', { n: 3, spread: .5, spd: 180 }]] },
      { at: .5, cd: 1.3, pool: [['aimed', { n: 4, gap: .4, spd: 210 }], ['fan', { n: 5, spread: .8, spd: 180 }], ['ring', { n: 10, spd: 140 }]] },
    ] }] },
  { name: 'Braise', sub: 'le jeune dragon de feu', world: 0, bosses: [
    { t: 'rouge', w: 190, hp: 560, y: 300, spd: 70, phases: [
      { at: 1, cd: 1.3, pool: [['fan', { n: 5, spread: .9, spd: 195, rep: 2, gap: .7 }], ['aimed', { n: 4, gap: .32, spd: 240 }], ['ring', { n: 12, spd: 150 }]] },
      { at: .5, cd: 1.15, pool: [['fan', { n: 5, spread: .9, spd: 205, rep: 3, gap: .6 }], ['breath', { dur: 1.4, sweep: .9 }], ['ring', { n: 14, spd: 155, rep: 2, every: .7 }]] },
    ] }] },
  { name: 'Les Jumeaux', sub: 'deux bébés dragons', world: 0, bosses: [
    { t: 'vert', w: 130, hp: 380, x: 180, y: 290, side: -1, spd: 65, phases: [
      { at: 1, cd: 2.0, pool: [['aimed', { n: 3, gap: .45, spd: 210 }], ['ring', { n: 10, spd: 140 }], ['fan', { n: 3, spread: .5, spd: 190 }]] },
      { at: .5, cd: 1.7, pool: [['aimed', { n: 4, gap: .38, spd: 220 }], ['ring', { n: 12, spd: 145 }], ['fan', { n: 5, spread: .8, spd: 190 }]] },
    ] },
    { t: 'vert', w: 130, hp: 380, x: 360, y: 290, side: 1, spd: 65, delay: 1, phases: [
      { at: 1, cd: 2.0, pool: [['aimed', { n: 3, gap: .45, spd: 210 }], ['ring', { n: 10, spd: 140 }], ['fan', { n: 3, spread: .5, spd: 190 }]] },
      { at: .5, cd: 1.7, pool: [['aimed', { n: 4, gap: .38, spd: 220 }], ['ring', { n: 12, spd: 145 }], ['fan', { n: 5, spread: .8, spd: 190 }]] },
    ] }] },
  { name: 'Givre', sub: 'le dragon de glace', world: 1, bosses: [
    { t: 'glace', w: 220, hp: 800, y: 305, spd: 65, phases: [
      { at: 1, cd: 1.3, pool: [['shards', { n: 5, spread: 1.0, spd: 230, rep: 2, gap: .8 }], ['ring', { n: 14, spd: 125, rep: 2, every: .8, r: 11 }], ['homing', { n: 3, gap: .35, spd: 150, hom: 1.6, homT: 2.2 }]] },
      { at: .5, cd: 1.15, pool: [['shards', { n: 7, spread: 1.3, spd: 240, rep: 2, gap: .7 }], ['spiral', { arms: 3, dur: 2.4, rate: .14, rot: 1.8, spd: 170 }], ['homing', { n: 4, gap: .3, spd: 155, hom: 1.7, homT: 2.4 }]] },
    ] }] },
  { name: 'Zap', sub: "le dragon de l'orage", world: 1, bosses: [
    { t: 'orage', w: 220, hp: 1300, y: 300, spd: 75, phases: [
      { at: 1, cd: 1.35, pool: [['lightning', { n: 3, spread: .5, rep: 1 }], ['spiral', { arms: 3, dur: 2.2, rate: .13, rot: 2.1, spd: 175 }], ['aimed', { n: 5, gap: .22, spd: 280, r: 8 }]] },
      { at: .5, cd: 1.15, pool: [['lightning', { n: 4, spread: .8, rep: 2, gap: .9 }], ['spiral', { arms: 4, dur: 2.4, rate: .13, rot: -2.2, spd: 180 }], ['aimed', { n: 6, gap: .2, spd: 290, r: 8 }]] },
    ] }] },
  { name: 'Blizzard', sub: 'Givre et Zap ensemble', world: 1, bosses: [
    { t: 'glace', w: 175, hp: 670, x: 175, y: 300, side: -1, spd: 60, phases: [
      { at: 1, cd: 2.0, pool: [['shards', { n: 5, spread: 1.0, spd: 225, rep: 1 }], ['ring', { n: 12, spd: 125, r: 11 }], ['homing', { n: 3, gap: .4, spd: 145, hom: 1.5, homT: 2 }]] },
      { at: .5, cd: 1.7, pool: [['shards', { n: 6, spread: 1.2, spd: 235, rep: 2, gap: .8 }], ['ring', { n: 14, spd: 130, rep: 2, every: .8, r: 11 }]] },
    ] },
    { t: 'orage', w: 175, hp: 670, x: 365, y: 300, side: 1, spd: 70, delay: 1.2, phases: [
      { at: 1, cd: 2.0, pool: [['lightning', { n: 2, spread: .4 }], ['aimed', { n: 4, gap: .25, spd: 270, r: 8 }], ['spiral', { arms: 3, dur: 1.6, rate: .14, rot: 2, spd: 170 }]] },
      { at: .5, cd: 1.7, pool: [['lightning', { n: 3, spread: .6, rep: 2, gap: 1 }], ['spiral', { arms: 3, dur: 2, rate: .13, rot: -2, spd: 175 }]] },
    ] }] },
  { name: 'Pyros', sub: 'le grand dragon de feu', world: 2, bosses: [
    { t: 'rouge', w: 250, hp: 2200, y: 310, spd: 70, phases: [
      { at: 1, cd: 1.25, pool: [['breath', { dur: 1.8, sweep: 1.2 }], ['fan', { n: 7, spread: 1.2, spd: 210, rep: 2, gap: .7 }], ['meteors', { n: 4, gap: .45 }]] },
      { at: .5, cd: 1.05, pool: [['breath', { dur: 2.2, sweep: 1.5 }], ['charge', { ring: 10 }], ['meteors', { n: 6, gap: .35 }], ['ring', { n: 16, spd: 150, gapW: .8, rep: 2, every: .8 }]] },
    ] }] },
  { name: 'Tempête', sub: 'le dragon furieux', world: 2, bosses: [
    { t: 'orage', w: 250, hp: 2500, y: 305, spd: 80, phases: [
      { at: 1, cd: 1.25, pool: [['lightning', { n: 4, spread: .9, rep: 2, gap: .9 }], ['summon', { n: 2, max: 3 }], ['spiral', { arms: 4, dur: 2.4, rate: .13, rot: 2.2, spd: 175 }]] },
      { at: .5, cd: 1.05, pool: [['lightning', { n: 6, spread: 1.6, rep: 2, gap: .9 }], ['summon', { n: 2, max: 4 }], ['spiral', { arms: 5, dur: 2.6, rate: .13, rot: -2.3, spd: 180 }], ['charge', { ring: 12 }]] },
    ] }] },
  { name: 'Les Gardiens', sub: 'feu et glace', world: 2, bosses: [
    { t: 'rouge', w: 200, hp: 1400, x: 172, y: 300, side: -1, spd: 70, phases: [
      { at: 1, cd: 1.9, pool: [['breath', { dur: 1.5, sweep: 1.0 }], ['fan', { n: 5, spread: 1.0, spd: 210, rep: 2, gap: .7 }], ['meteors', { n: 3, gap: .5 }]] },
      { at: .5, cd: 1.6, pool: [['breath', { dur: 1.8, sweep: 1.2 }], ['meteors', { n: 5, gap: .4 }], ['charge', { ring: 8 }]] },
    ] },
    { t: 'glace', w: 200, hp: 1400, x: 368, y: 300, side: 1, spd: 65, delay: 1.1, phases: [
      { at: 1, cd: 1.9, pool: [['shards', { n: 5, spread: 1.1, spd: 230, rep: 2, gap: .8 }], ['homing', { n: 3, gap: .4, spd: 150, hom: 1.6, homT: 2.2 }], ['ring', { n: 14, spd: 130, r: 11, gapW: .8 }]] },
      { at: .5, cd: 1.6, pool: [['shards', { n: 7, spread: 1.3, spd: 235, rep: 2, gap: .7 }], ['spiral', { arms: 3, dur: 2, rate: .14, rot: 1.9, spd: 170 }]] },
    ] }] },
  { name: 'Le Roi Dragon', sub: 'maître de la tour', world: 2, king: true, bosses: [
    { t: 'roi', w: 320, hp: 6000, y: 315, spd: 55, phases: [
      { at: 1, cd: 1.2, pool: [['fan', { n: 7, spread: 1.2, spd: 210, rep: 3, gap: .6, col: 'gold' }], ['meteors', { n: 5, gap: .4 }], ['ring', { n: 18, spd: 150, gapW: .7, rep: 2, every: .8, col: 'gold' }]] },
      { at: .66, cd: 1.05, pool: [['breath', { dur: 2.2, sweep: 1.5 }], ['spiral', { arms: 4, dur: 2.6, rate: .13, rot: 2.1, spd: 175, col: 'gold' }], ['charge', { ring: 12 }], ['summon', { n: 2, max: 3 }]] },
      { at: .33, cd: .95, pool: [['breath', { dur: 2.4, sweep: 1.7 }], ['meteors', { n: 7, gap: .3, split: 6 }], ['lightning', { n: 5, spread: 1.4, rep: 2, gap: .9 }], ['spiral', { arms: 5, dur: 2.6, rate: .13, rot: -2.2, spd: 180, col: 'gold' }], ['charge', { ring: 14 }]] },
    ] }] },
];

const WORLDS = [
  { floor: 'sol_pierre', name: 'Donjon' },
  { floor: 'sol_glace', name: 'Grotte de glace' },
  { floor: 'sol_lave', name: 'Antre de lave' },
];

// ------------------------------------------------------------------ pouvoirs
const UPS = [
  { id: 'multi', name: 'Flèche double', desc: '+1 flèche devant', icon: '🏹', max: 3, apply: p => { p.multi++; } },
  { id: 'diag', name: 'Éventail', desc: '+2 flèches en biais', icon: '✨', max: 2, apply: p => { p.diag++; } },
  { id: 'rate', name: 'Tir rapide', desc: 'Tire 20 % plus vite', icon: '⚡', max: 4, apply: p => { p.rate *= 1.2; } },
  { id: 'dmg', name: "Pointes d'acier", desc: 'Dégâts +25 %', icon: '⚔️', max: 5, apply: p => { p.dmg *= 1.25; } },
  { id: 'crit', name: 'Œil de lynx', desc: 'Coups critiques x2', icon: '🎯', max: 3, apply: p => { p.crit += .15; } },
  { id: 'burn', name: 'Flèches de feu', desc: 'Le dragon brûle', icon: '🔥', max: 3, apply: p => { p.burn++; } },
  { id: 'heart', name: 'Grand cœur', desc: '+1 cœur et soin', icon: '❤️', max: 4, apply: p => { p.maxHp++; p.hp = p.maxHp; } },
  { id: 'shield', name: 'Bouclier', desc: 'Bloque un coup', icon: '🛡️', max: 2, apply: p => { p.shieldMax++; p.shield = p.shieldMax; } },
  { id: 'speed', name: 'Bottes de vent', desc: 'Court 15 % plus vite', icon: '👟', max: 3, apply: p => { p.speed *= 1.15; } },
];

// ------------------------------------------------------------------ motifs d'attaque (générateurs : yield = attente en secondes)
const P = {
  aimed: function* (g, d, o) {
    for (let i = 0; i < o.n; i++) { g.fire(d, g.aimAt(d) + (g.rand() - .5) * (o.jit || .08), o.spd, o); g.sfx('spit'); yield o.gap; }
  },
  fan: function* (g, d, o) {
    for (let k = 0; k < (o.rep || 1); k++) {
      const a0 = g.aimAt(d) + (k % 2 ? (o.spread / Math.max(1, o.n - 1)) / 2 : 0);
      for (let i = 0; i < o.n; i++) g.fire(d, a0 + (i - (o.n - 1) / 2) * o.spread / Math.max(1, o.n - 1), o.spd, o);
      g.sfx('fire'); g.mouthFx(d);
      if (k < (o.rep || 1) - 1) yield o.gap || .6;
    }
  },
  shards: function* (g, d, o) { yield* P.fan(g, d, Object.assign({ kind: 'shard', bounce: 1, r: 8 }, o)); },
  ring: function* (g, d, o) {
    for (let k = 0; k < (o.rep || 1); k++) {
      const off = g.rand() * TAU, gc = g.aimAt(d) + (g.rand() - .5) * 1.6;
      for (let i = 0; i < o.n; i++) {
        const a = off + i * TAU / o.n;
        if (o.gapW && angDiff(a, gc) < o.gapW / 2) continue;
        g.fire(d, a, o.spd, o);
      }
      g.sfx('fire'); g.mouthFx(d);
      if (k < (o.rep || 1) - 1) yield o.every || .6;
    }
  },
  spiral: function* (g, d, o) {
    let a = g.aimAt(d) + Math.PI;
    const steps = Math.floor(o.dur / o.rate);
    for (let i = 0; i < steps; i++) {
      for (let k = 0; k < o.arms; k++) g.fire(d, a + k * TAU / o.arms, o.spd, o);
      if (i % 3 === 0) g.sfx('spit');
      a += o.rot * o.rate; yield o.rate;
    }
  },
  homing: function* (g, d, o) {
    for (let i = 0; i < o.n; i++) { g.fire(d, g.aimAt(d) + (i - (o.n - 1) / 2) * .5, o.spd, Object.assign({ r: 12, kind: 'snow', life: 6 }, o)); g.sfx('spit'); yield o.gap; }
  },
  breath: function* (g, d, o) {
    const dir = g.rand() < .5 ? -1 : 1, base = g.aimAt(d);
    d.breath = o.dur; g.sfx('breath');
    const n = Math.floor(o.dur / .035);
    for (let i = 0; i < n; i++) {
      const t = i / n, a = base + (t - .5) * o.sweep * dir + (g.rand() - .5) * .14;
      g.fire(d, a, 250 + g.rand() * 90, { kind: 'flame', r: 9, life: 1.9, col: d.col === 'ice' ? 'ice' : 'fire' });
      yield .035;
    }
    d.breath = 0;
  },
  meteors: function* (g, d, o) {
    g.sfx('roarS');
    for (let i = 0; i < o.n; i++) {
      const p = g.player, R = i === 0 ? 0 : 110;
      const x = clamp(p.x + (g.rand() - .5) * 2 * R, A.l + 20, A.r - 20), y = clamp(p.y + (g.rand() - .5) * 2 * R, A.t + 120, A.b - 20);
      g.hazards.push({ kind: 'meteor', x, y, t: 0, warn: 1.15, R: 48, split: o.split || 0, col: d.col });
      g.sfx('warn');
      yield o.gap;
    }
  },
  lightning: function* (g, d, o) {
    for (let k = 0; k < (o.rep || 1); k++) {
      const m = g.mouth(d), base = g.aimAt(d) + (k % 2 ? o.spread / Math.max(1, o.n) / 2 : 0);
      for (let i = 0; i < o.n; i++) {
        const a = base + (o.n > 1 ? (i - (o.n - 1) / 2) * o.spread / (o.n - 1) : 0);
        g.hazards.push({ kind: 'bolt', x: m.x, y: m.y, a, t: 0, warn: .85, dur: .28, w: 13 });
      }
      g.sfx('charge');
      yield o.gap || 1;
    }
    yield .6;
  },
  charge: function* (g, d, o) {
    const p = g.player;
    const tx = clamp(p.x, A.l + d.w * .2, A.r - d.w * .2), ty = clamp(p.y, A.t + 120, A.b - 70);
    const hz = { kind: 'lane', x0: d.x, y0: d.y, x1: tx, y1: ty, w: d.w * .36, t: 0, dur: .85, d };
    g.hazards.push(hz); d.tremble = .85; g.sfx('roarS');
    yield .85;
    d.dash = { tx, ty, spd: o.spd || 900 }; g.sfx('whoosh');
    while (d.dash) yield .02;
    g.shake(12); g.sfx('boom'); g.dustRing(d.x, d.y + d.h * .3, d.w * .5);
    if (o.ring) { const off = g.rand() * TAU; for (let i = 0; i < o.ring; i++) g.fire(d, off + i * TAU / o.ring, 150, { fromBody: true }); }
    d.charging = false; d.home = true;
    yield .7;
  },
  summon: function* (g, d, o) {
    g.sfx('roarS'); d.tremble = .5; yield .4;
    for (let i = 0; i < o.n; i++) {
      if (g.enemies.filter(e => e.minion && !e.dead).length >= o.max) break;
      g.spawnWhelp(d.x + (i % 2 ? 1 : -1) * d.w * .35, d.y + 10);
      yield .35;
    }
  },
};

// ------------------------------------------------------------------ le jeu
class Game {
  constructor(opts = {}) {
    this.headless = !!opts.headless;
    this.rand = mulberry32(opts.seed || ((Date.now() * 9301) | 0));
    this.sfx = opts.sfx || (() => {});
    this.store = opts.store || null;
    this.t = 0;
    this.newRun();
    this.state = 'title';
  }

  newPlayer() {
    return { x: 270, y: 800, r: 11, hp: 5, maxHp: 5, inv: 0, speed: 245, dmg: 10, rate: 2.6, multi: 0, diag: 0, crit: 0, burn: 0,
      shieldMax: 0, shield: 0, shieldCd: 0, fireCd: 0, still: 0, face: 1, walk: 0, moving: false, recoil: 0, flash: 0, target: null, hits: 0 };
  }
  newRun() {
    this.player = this.newPlayer();
    this.ups = {}; this.gems = 0; this.levelIdx = 0; this.runTime = 0; this.deaths = 0;
    this.clearRoom();
  }
  clearRoom() {
    this.enemies = []; this.bullets = []; this.arrows = []; this.hazards = []; this.parts = []; this.texts = []; this.gemsArr = []; this.pickups = []; this.decals = [];
    this.door = 0; this.shakeAmt = 0; this.slowT = 0; this.freeze = 0; this.hurtFlash = 0; this.banner = null; this.cards = null; this.trans = null; this.stateT = 0;
  }
  get level() { return LEVELS[this.levelIdx]; }
  get world() { return WORLDS[this.level.world]; }

  // ---- sauvegarde
  save() { if (this.store) this.store.set({ level: this.levelIdx + 1, ups: this.ups, gems: this.gems }); }
  savedLevel() { const s = this.store && this.store.get(); return s && s.level > 0 && s.level < LEVELS.length ? s.level : 0; }

  // ---- actions (boutons)
  startNew() { this.newRun(); this.startLevel(0); }
  continueGame() {
    const s = this.store && this.store.get(); if (!s) return this.startNew();
    this.newRun(); this.gems = s.gems || 0;
    for (const id in (s.ups || {})) for (let i = 0; i < s.ups[id]; i++) this.applyUp(id, true);
    this.player.hp = this.player.maxHp;
    this.startLevel(s.level || 0);
  }
  retry() { this.deaths++; const p = this.player; p.hp = p.maxHp; p.shield = p.shieldMax; this.startLevel(this.levelIdx); }
  applyUp(id, silent) {
    const u = UPS.find(u => u.id === id); if (!u) return;
    this.ups[id] = (this.ups[id] || 0) + 1; u.apply(this.player);
    if (!silent) this.sfx('up');
  }
  chooseUpgrade(i) {
    if (this.state !== 'upgrade' || !this.cards || this.cards.picked != null) return;
    const c = this.cards.list[i]; if (!c) return;
    this.cards.picked = i; this.cards.pt = 0;
    this.applyUp(c.id);
    const p = this.player; p.hp = Math.min(p.maxHp, p.hp + 1); p.shield = p.shieldMax;
    this.save();
    this.ring(p.x, p.y, 70, '#ffe36b'); this.burst(p.x, p.y - 20, 24, ['#fff3a0', '#ffd23a', '#ffffff'], 260);
  }

  startLevel(i) {
    this.levelIdx = i; this.clearRoom();
    const L = this.level, p = this.player;
    p.x = 270; p.y = 990; p.inv = 0; p.fireCd = .3; p.still = 0; p.target = null;
    for (const b of L.bosses) {
      const ty = DT[b.t];
      const e = { boss: true, type: ty, t: b.t, w: b.w, h: b.w * ty.ar, x: b.x || 270, y: -200, baseY: b.y || 300, hp: b.hp, maxHp: b.hp, lag: b.hp,
        phases: b.phases, phase: 0, col: ty.col, spd: b.spd || 60, side: b.side || 0, gen: null, wait: 0, cd: 1.1 + (b.delay || 0), last: null,
        tx: b.x || 270, ty: b.y || 300, retarget: 2, flash: 0, tremble: 0, roar: 0, dash: null, burnT: 0, burnTick: 0, burnDps: 0, dying: 0, dead: false, anim: this.rand() * 10, tell: 0, breath: 0, entered: false, sx: b.x || 270 };
      this.enemies.push(e);
    }
    this.state = 'intro'; this.stateT = 0;
    this.banner = { t: 0, idx: i, name: L.name, sub: L.sub, king: !!L.king };
  }

  // ---- utilitaires de tir
  mouth(d) { return { x: d.x, y: d.y + d.h * d.type.mouth }; }
  aimAt(d) { const m = this.mouth(d), p = this.player; return Math.atan2(p.y - m.y, p.x - m.x); }
  fire(d, a, spd, o = {}) {
    const m = o.fromBody ? { x: d.x, y: d.y } : this.mouth(d);
    const b = { x: m.x, y: m.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, r: o.r || 9, col: o.col || d.col, life: o.life || 8, t: 0,
      kind: o.kind || 'orb', bounce: o.bounce || 0, hom: o.hom || 0, homT: o.homT || 0, spd };
    this.bullets.push(b); return b;
  }
  spawnWhelp(x, y) {
    const ty = DT.vert;
    this.enemies.push({ minion: true, type: ty, t: 'vert', w: 64, h: 64 * ty.ar, x, y, hp: 45, maxHp: 45, lag: 45, col: 'green', vx: 0, vy: 0,
      cd: 1.6 + this.rand(), flash: 0, anim: this.rand() * 10, burnT: 0, burnTick: 0, burnDps: 0, dead: false, spawn: .45 });
    this.puff(x, y, '#9dff6a', 14);
  }

  // ---- effets (rien en mode headless)
  part(o) { if (!this.headless && this.parts.length < 900) this.parts.push(o); }
  burst(x, y, n, cols, spd = 200, size = 4, opts = {}) {
    if (this.headless) return;
    for (let i = 0; i < n; i++) {
      const a = this.rand() * TAU, s = spd * (.3 + Math.random() * .7);
      this.part(Object.assign({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: .35 + Math.random() * .45, max: .8, size: size * (.6 + Math.random() * .8), col: cols[i % cols.length], kind: 'spark', drag: 3, add: true }, opts));
    }
  }
  puff(x, y, col, n = 10) {
    if (this.headless) return;
    for (let i = 0; i < n; i++) { const a = Math.random() * TAU, s = 30 + Math.random() * 90; this.part({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20, life: .6 + Math.random() * .5, max: 1.1, size: 10 + Math.random() * 12, col, kind: 'smoke', drag: 2.5 }); }
  }
  ring(x, y, R, col, w = 6) { this.part({ x, y, vx: 0, vy: 0, life: .45, max: .45, size: R, col, kind: 'ring', w }); }
  dustRing(x, y, R) { this.ring(x, y, R, 'rgba(255,240,220,.8)', 10); this.puff(x, y, 'rgba(200,190,170,.5)', 16); }
  mouthFx(d) { const m = this.mouth(d); this.burst(m.x, m.y, 8, [COL[d.col].glow, COL[d.col].core], 140, 5); }
  text(x, y, str, col = '#fff', size = 22) { if (!this.headless && this.texts.length < 60) this.texts.push({ x, y, vy: -70, t: 0, str, col, size }); }
  shake(a) { this.shakeAmt = Math.max(this.shakeAmt, a); }
  explosion(x, y, s = 1, col = 'fire') {
    if (this.headless) return;
    const c = COL[col] || COL.fire;
    this.part({ x, y, vx: 0, vy: 0, life: .22, max: .22, size: 90 * s, col: '#ffffff', kind: 'flash' });
    this.ring(x, y, 110 * s, c.glow, 12 * s);
    this.burst(x, y, Math.floor(26 * s), [c.core, c.glow, '#ffffff', '#ffd27a'], 420 * s, 7 * s);
    for (let i = 0; i < 10 * s; i++) { const a = Math.random() * TAU, sp = 40 + Math.random() * 120 * s; this.part({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30, life: .8 + Math.random() * .7, max: 1.5, size: (16 + Math.random() * 20) * s, col: 'rgba(60,45,50,.55)', kind: 'smoke', drag: 2 }); }
  }

  // ---- dégâts
  hurtPlayer(src) {
    const p = this.player;
    if (p.inv > 0 || this.state === 'dead' || this.godMode) { if (this.godMode && p.inv <= 0) { p.hits++; p.inv = 1.0; } return false; }
    if (p.shield > 0) {
      p.shield--; p.shieldCd = 8; p.inv = .9; this.sfx('shield');
      this.ring(p.x, p.y - 20, 60, '#7fe8ff', 8); this.burst(p.x, p.y - 20, 20, ['#bff4ff', '#7fe8ff', '#ffffff'], 260);
      this.text(p.x, p.y - 70, 'Bloqué !', '#9ef0ff', 24);
      return true;
    }
    p.hp--; p.hits++; p.inv = 1.3; p.flash = .15;
    this.hurtFlash = .5; this.shake(14); this.freeze = .07; this.sfx('hurt');
    this.burst(p.x, p.y - 20, 22, ['#ff4b4b', '#ffd0d0', '#ffffff'], 300);
    if (p.hp <= 0) { this.state = 'dead'; this.stateT = 0; this.slowT = 1.2; this.sfx('lose'); this.explosion(p.x, p.y - 20, .7, 'storm'); }
    return true;
  }
  damage(e, dmg, crit, burn) {
    if (e.dead || e.dying) return;
    e.hp -= dmg;
    if (!burn) e.flash = .06;
    this.text(e.x + (Math.random() - .5) * e.w * .4, e.y - e.h * .1 + (Math.random() - .5) * 30, String(Math.round(dmg)) + (crit ? '!' : ''), burn ? '#ffa53d' : crit ? '#ffe04a' : '#ffffff', crit ? 30 : burn ? 17 : 21);
    if (e.boss && e.phases) {
      const next = e.phases[e.phase + 1];
      if (next && e.hp / e.maxHp <= next.at) this.phaseUp(e);
    }
    if (e.hp <= 0) this.kill(e);
  }
  phaseUp(e) {
    e.phase++; e.roar = 1; e.tremble = .9; this.shake(16); this.sfx('roar');
    this.ring(e.x, e.y, e.w * .8, COL[e.col].glow, 14);
    this.text(e.x, e.y - e.h * .5, 'Il se fâche !', '#ff6a5a', 26);
    const p = this.player;
    if (p.hp < p.maxHp) this.pickups.push({ kind: 'heart', x: clamp(e.x, A.l + 40, A.r - 40), y: e.y + e.h * .4, vy: 0, t: 0, land: clamp(p.y - 150, A.t + 260, A.b - 120) });
  }
  kill(e) {
    e.hp = 0;
    if (e.minion) {
      e.dead = true; this.explosion(e.x, e.y, .5, 'green'); this.spawnGems(e.x, e.y, 3); this.sfx('pop'); return;
    }
    e.dying = 1.5; e.gen = null; e.dash = null; this.sfx('roar'); this.shake(10);
    if (this.enemies.every(x => !x.boss || x.dying || x.dead)) {
      // victoire : on nettoie l'écran
      this.state = 'victory'; this.stateT = 0; this.slowT = .9;
      for (const b of this.bullets) this.burst(b.x, b.y, 3, ['#fff7c0', '#ffe066'], 80, 3);
      this.bullets = []; this.hazards = this.hazards.filter(h => h.kind === 'scorch');
      for (const m of this.enemies) if (m.minion && !m.dead) this.kill(m);
    }
  }
  spawnGems(x, y, n) {
    for (let i = 0; i < n; i++) {
      const a = this.rand() * TAU, s = 120 + this.rand() * 260;
      this.gemsArr.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, z: 0, vz: 180 + this.rand() * 200, c: i % 4 });
    }
  }

  // ================================================================== mise à jour
  update(dtReal, input) {
    dtReal = Math.min(dtReal, 1 / 20);
    this.t += dtReal;
    if (this.paused) return;
    if (this.freeze > 0) { this.freeze -= dtReal; return; }
    let dt = dtReal;
    if (this.slowT > 0) { this.slowT -= dtReal; dt *= .35; }
    this.stateT += dtReal;
    if (this.state === 'title') { this.updateFx(dt); return; }
    if (['intro', 'fight', 'walk'].includes(this.state)) this.runTime += dtReal;

    const st = this.state;
    if (st === 'intro') this.updateIntro(dt, input);
    else if (st === 'fight') this.updatePlayer(dt, input, true);
    else if (st === 'victory' || st === 'loot') this.updatePlayer(dt, input, false);
    else if (st === 'upgrade') { if (this.cards && this.cards.picked != null) { this.cards.pt += dtReal; if (this.cards.pt > .9) { this.cards = null; this.state = 'open'; this.stateT = 0; this.sfx('door'); this.shake(5); } } }
    else if (st === 'open') { this.door = Math.min(1, this.stateT / 1.1); if (this.stateT > 1.1) { this.state = 'walk'; this.stateT = 0; } }
    else if (st === 'walk') { this.updatePlayer(dt, input, false); this.checkDoor(); }
    else if (st === 'transition') { this.updateTransition(dtReal); return; }
    else if (st === 'dead') { /* figé, l'écran de défaite s'affiche */ }

    this.updateEnemies(dt);
    this.updateArrows(dt);
    this.updateBullets(dt);
    this.updateHazards(dt);
    this.updatePickups(dt);
    this.updateFx(dt);

    if (st === 'victory') {
      if (this.stateT > 1.2 && !this.enemies.some(e => e.boss && !e.dead)) { this.state = 'loot'; this.stateT = 0; }
    } else if (st === 'loot') {
      if (this.stateT > 1.5 && this.gemsArr.length === 0 || this.stateT > 3) {
        if (this.levelIdx >= LEVELS.length - 1) { this.state = 'end'; this.stateT = 0; this.sfx('fanfare'); if (this.store) this.store.set(null); }
        else { this.state = 'upgrade'; this.stateT = 0; this.cards = { list: this.pickCards(), picked: null, pt: 0 }; this.sfx('cards'); }
      }
    }
  }

  pickCards() {
    const avail = UPS.filter(u => (this.ups[u.id] || 0) < u.max);
    const out = [];
    while (out.length < 3 && avail.length) out.push(avail.splice(Math.floor(this.rand() * avail.length), 1)[0]);
    return out;
  }

  updateIntro(dt, input) {
    const p = this.player, T = this.stateT;
    // le héros entre par le bas
    if (T < .8) { p.y = lerp(990, 800, ease.out(T / .8)); p.moving = true; p.walk += dt * 10; }
    else this.updatePlayer(dt, input, false);
    for (const e of this.enemies) {
      const d = clamp((T - .3) / 1.4, 0, 1);
      e.y = lerp(-e.h, e.baseY, ease.out(d)); e.x = e.sx;
      if (d >= 1 && !e.entered) { e.entered = true; e.roar = 1; this.shake(10); this.sfx('roar'); this.dustRing(e.x, e.baseY + e.h * .42, e.w * .45); }
    }
    if (T > 2.7) { this.state = 'fight'; this.stateT = 0; this.banner = null; }
  }

  checkDoor() {
    const p = this.player;
    if (this.door >= 1 && Math.abs(p.x - DOOR.x) < DOOR.half && p.y < A.t + 2) {
      this.state = 'transition'; this.trans = { t: 0, dur: 1.15, from: this.levelIdx }; this.sfx('whoosh');
    }
  }
  updateTransition(dt) {
    const tr = this.trans; tr.t += dt;
    const p = this.player; p.walk += dt * 12; p.moving = true;
    if (tr.t >= tr.dur) { this.startLevel(this.levelIdx + 1); p.y = 800; this.stateT = .8; }
  }

  // ---- joueur
  updatePlayer(dt, input, canShoot) {
    const p = this.player;
    let mx = input ? input.x : 0, my = input ? input.y : 0;
    const m = Math.hypot(mx, my);
    if (m > 1) { mx /= m; my /= m; }
    p.moving = m > .12;
    if (p.moving) {
      p.x += mx * p.speed * dt; p.y += my * p.speed * dt; p.walk += dt * 12; p.still = 0;
      if (Math.abs(mx) > .15) p.face = mx > 0 ? 1 : -1;
      if (!this.headless && Math.random() < dt * 8) this.part({ x: p.x + (Math.random() - .5) * 16, y: p.y + 2, vx: -mx * 30, vy: -my * 30 - 10, life: .45, max: .45, size: 6 + Math.random() * 5, col: 'rgba(220,210,200,.45)', kind: 'smoke', drag: 3 });
    } else p.still += dt;
    // limites (on peut monter dans la porte si elle est ouverte)
    const doorZone = this.door >= 1 && Math.abs(p.x - DOOR.x) < DOOR.half;
    p.x = clamp(p.x, A.l + 14, A.r - 14);
    p.y = clamp(p.y, doorZone ? DOOR.y - 30 : A.t + 18, A.b - 6);
    if (p.inv > 0) p.inv -= dt;
    if (p.flash > 0) p.flash -= dt;
    if (p.recoil > 0) p.recoil -= dt;
    if (p.shield < p.shieldMax) { p.shieldCd -= dt; if (p.shieldCd <= 0) { p.shield++; p.shieldCd = 8; this.sfx('shield'); this.ring(p.x, p.y - 22, 40, '#7fe8ff', 4); } }

    // cible = ennemi le plus proche
    let best = null, bd = 1e9;
    for (const e of this.enemies) { if (e.dead || e.dying || (e.spawn > 0)) continue; const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < bd) { bd = d; best = e; } }
    p.target = best;
    p.fireCd -= dt;
    if (canShoot && best && !p.moving && p.still > .08 && p.fireCd <= 0) {
      this.shoot(best); p.fireCd = 1 / p.rate;
    }
  }
  shoot(e) {
    const p = this.player;
    const sx = p.x, sy = p.y - 34;
    const a = Math.atan2(e.y - sy, e.x - sx);
    const front = 1 + p.multi, dmg = p.dmg * (p.multi ? .8 : 1);
    const px = -Math.sin(a), py = Math.cos(a);
    const mk = (ang, ox, oy, mult) => {
      const crit = this.rand() < p.crit;
      this.arrows.push({ x: sx + ox, y: sy + oy, vx: Math.cos(ang) * 950, vy: Math.sin(ang) * 950, a: ang, dmg: dmg * mult * (crit ? 2 : 1), crit, t: 0 });
    };
    for (let i = 0; i < front; i++) { const o = (i - (front - 1) / 2) * 13; mk(a, px * o, py * o, 1); }
    for (let k = 1; k <= p.diag; k++) { mk(a - .2 * k, 0, 0, .45); mk(a + .2 * k, 0, 0, .45); }
    p.recoil = .12; p.face = e.x >= p.x ? 1 : -1;
    this.sfx('shoot');
    this.part({ x: sx + Math.cos(a) * 14, y: sy + Math.sin(a) * 14, vx: 0, vy: 0, life: .1, max: .1, size: 16, col: '#fff6d0', kind: 'flash' });
  }
  updateArrows(dt) {
    const out = [];
    for (const ar of this.arrows) {
      ar.t += dt; ar.x += ar.vx * dt; ar.y += ar.vy * dt;
      if (ar.x < A.l - 30 || ar.x > A.r + 30 || ar.y < 60 || ar.y > H + 20) { this.burst(clamp(ar.x, A.l - 20, A.r + 20), Math.max(ar.y, 120), 3, ['#d8c8a8'], 80, 3); continue; }
      let hit = false;
      for (const e of this.enemies) {
        if (e.dead || e.dying || e.spawn > 0) continue;
        const rx = e.w * e.type.hit[0], ry = e.h * e.type.hit[1];
        const dx = (ar.x - e.x) / rx, dy = (ar.y - e.y) / ry;
        if (dx * dx + dy * dy < 1) {
          hit = true;
          this.damage(e, ar.dmg, ar.crit);
          const p = this.player;
          if (p.burn) { e.burnT = 3; e.burnDps = p.burn * 3 + p.dmg * .15 * p.burn; }
          this.burst(ar.x, ar.y, ar.crit ? 12 : 6, ar.crit ? ['#fff36b', '#ffffff', '#ffb300'] : ['#ffffff', '#ffe9b0', COL[e.col].glow], ar.crit ? 300 : 200, ar.crit ? 5 : 4);
          this.sfx(ar.crit ? 'crit' : 'hit');
          break;
        }
      }
      if (!hit) out.push(ar);
    }
    this.arrows = out;
  }

  // ---- ennemis
  updateEnemies(dt) {
    const fighting = this.state === 'fight';
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.anim += dt;
      if (e.flash > 0) e.flash -= dt;
      if (e.tremble > 0) e.tremble -= dt;
      if (e.roar > 0) e.roar -= dt * 1.2;
      e.lag = e.lag > e.hp ? Math.max(e.hp, e.lag - e.maxHp * dt * .45) : e.hp;
      if (e.burnT > 0 && !e.dying) {
        e.burnT -= dt; e.burnTick -= dt;
        if (!this.headless && Math.random() < dt * 20) this.part({ x: e.x + (Math.random() - .5) * e.w * .4, y: e.y + (Math.random() - .3) * e.h * .4, vx: 0, vy: -60, life: .5, max: .5, size: 7, col: '#ff8a1d', kind: 'spark', add: true, drag: 1 });
        if (e.burnTick <= 0) { e.burnTick = .5; this.damage(e, e.burnDps * .5, false, true); if (e.dead || e.dying) continue; }
      }
      if (e.minion) { this.updateWhelp(e, dt, fighting); continue; }
      if (e.dying) {
        e.dying -= dt;
        if (!this.headless && Math.random() < dt * 14) { this.explosion(e.x + (Math.random() - .5) * e.w * .6, e.y + (Math.random() - .5) * e.h * .6, .45, e.col); this.sfx('pop'); }
        if (e.dying <= 0) { e.dead = true; this.explosion(e.x, e.y, 1.6, e.col); this.shake(22); this.sfx('boom'); this.spawnGems(e.x, e.y, e.maxHp > 5000 ? 45 : 22); this.decals.push({ x: e.x, y: e.baseY + e.h * .42, r: e.w * .4, t: 0 }); }
        continue;
      }
      if (this.state === 'intro') continue;
      // déplacement
      if (e.dash) {
        const dx = e.dash.tx - e.x, dy = e.dash.ty - e.y, d = Math.hypot(dx, dy), st = e.dash.spd * dt;
        if (d <= st) { e.x = e.dash.tx; e.y = e.dash.ty; e.dash = null; }
        else { e.x += dx / d * st; e.y += dy / d * st; if (!this.headless) this.part({ x: e.x + (Math.random() - .5) * e.w * .5, y: e.y + e.h * .2, vx: 0, vy: 0, life: .4, max: .4, size: 18, col: 'rgba(255,255,255,.35)', kind: 'smoke', drag: 1 }); }
      } else if (!e.charging) {
        e.retarget -= dt;
        if (e.home || e.retarget <= 0 || Math.hypot(e.tx - e.x, e.ty - e.y) < 4) {
          e.home = false; e.retarget = 2 + this.rand() * 1.8;
          const half = e.side ? [e.side < 0 ? A.l : 270, e.side < 0 ? 270 : A.r] : [A.l, A.r];
          const mx = e.w * .32;
          e.tx = lerp(half[0] + mx, half[1] - mx, this.rand());
          e.ty = e.baseY + (this.rand() - .5) * 90;
        }
        const dx = e.tx - e.x, dy = e.ty - e.y, d = Math.hypot(dx, dy);
        const sp = (e.y > e.baseY + 80 ? 260 : e.spd) * (e.breath > 0 ? .25 : 1);
        if (d > 1) { const st = Math.min(d, sp * dt); e.x += dx / d * st; e.y += dy / d * st; }
      }
      // contact
      const p = this.player;
      { const dx = (p.x - e.x) / (e.w * e.type.body[0] + p.r), dy = (p.y - 14 - e.y) / (e.h * e.type.body[1] + p.r); if (dx * dx + dy * dy < 1) this.hurtPlayer(e); }
      if (!fighting) continue;
      // attaques
      if (e.gen) {
        e.wait -= dt; let guard = 0;
        while (e.gen && e.wait <= 0 && guard++ < 60) {
          const r = e.gen.next();
          if (r.done) { e.gen = null; e.charging = false; const ph = e.phases[e.phase]; e.cd = ph.cd * (.8 + this.rand() * .4); }
          else e.wait += r.value || 0;
        }
      } else {
        e.cd -= dt;
        if (e.cd <= 0) this.pickAttack(e);
      }
      if (e.tell > 0) e.tell -= dt;
    }
    this.enemies = this.enemies.filter(e => !(e.dead && e.minion));
  }
  pickAttack(e) {
    const ph = e.phases[e.phase];
    let pool = ph.pool;
    if (pool.length > 1) pool = pool.filter(x => x[0] !== e.last);
    const tot = pool.reduce((s, x) => s + (x[2] || 1), 0);
    let r = this.rand() * tot, pick = pool[0];
    for (const x of pool) { r -= (x[2] || 1); if (r <= 0) { pick = x; break; } }
    const [name, o] = pick; e.last = name;
    const g = this;
    e.charging = name === 'charge';
    e.tell = .4; this.sfx('tell');
    e.gen = (function* () { yield .4; yield* P[name](g, e, o); })();
    e.wait = 0;
  }
  updateWhelp(e, dt, fighting) {
    if (e.spawn > 0) { e.spawn -= dt; return; }
    const p = this.player;
    const dx = p.x - e.x, dy = p.y - 30 - e.y, d = Math.hypot(dx, dy) || 1;
    const sp = 70;
    e.vx = lerp(e.vx, dx / d * sp + Math.cos(e.anim * 3) * 40, dt * 2);
    e.vy = lerp(e.vy, dy / d * sp + Math.sin(e.anim * 2.4) * 30, dt * 2);
    if (d < 120) { e.vx *= .96; e.vy *= .96; }
    e.x = clamp(e.x + e.vx * dt, A.l + 20, A.r - 20); e.y = clamp(e.y + e.vy * dt, A.t + 40, A.b - 40);
    { const ddx = (p.x - e.x) / (e.w * .4 + p.r), ddy = (p.y - 14 - e.y) / (e.h * .4 + p.r); if (ddx * ddx + ddy * ddy < 1) this.hurtPlayer(e); }
    if (!fighting) return;
    e.cd -= dt;
    if (e.cd <= 0) { e.cd = 2.6 + this.rand(); this.fire(e, Math.atan2(p.y - e.y, p.x - e.x), 165, { r: 7, fromBody: true }); this.sfx('spit'); }
  }

  // ---- projectiles ennemis
  updateBullets(dt) {
    const p = this.player, out = [];
    for (const b of this.bullets) {
      b.t += dt;
      if (b.hom && b.t < b.homT) {
        const want = Math.atan2(p.y - 14 - b.y, p.x - b.x), cur = Math.atan2(b.vy, b.vx);
        let d = want - cur; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU;
        const na = cur + clamp(d, -b.hom * dt, b.hom * dt);
        b.vx = Math.cos(na) * b.spd; b.vy = Math.sin(na) * b.spd;
      }
      if (b.kind === 'flame') { b.vx *= (1 - dt * .55); b.vy *= (1 - dt * .55); b.r = 9 + b.t * 16; }
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.bounce > 0) {
        if (b.x < A.l && b.vx < 0) { b.vx *= -1; b.bounce--; this.burst(b.x, b.y, 4, ['#bfefff', '#fff'], 100, 3); }
        else if (b.x > A.r && b.vx > 0) { b.vx *= -1; b.bounce--; this.burst(b.x, b.y, 4, ['#bfefff', '#fff'], 100, 3); }
        else if (b.y > A.b && b.vy > 0) { b.vy *= -1; b.bounce--; this.burst(b.x, b.y, 4, ['#bfefff', '#fff'], 100, 3); }
      }
      if (b.t > b.life || b.x < A.l - 60 || b.x > A.r + 60 || b.y < 80 || b.y > H + 40) continue;
      const hr = b.kind === 'flame' ? b.r * .45 : b.r * .8;
      const dx = b.x - p.x, dy = b.y - (p.y - 24);
      if (dx * dx + dy * dy < (hr + p.r) * (hr + p.r)) {
        if (this.hurtPlayer(b) || p.inv > 0) { this.burst(b.x, b.y, 8, [COL[b.col].glow, COL[b.col].core], 160, 4); continue; }
      }
      out.push(b);
    }
    this.bullets = out;
  }
  updateHazards(dt) {
    const p = this.player, out = [];
    for (const h of this.hazards) {
      h.t += dt;
      if (h.kind === 'meteor') {
        if (h.t >= h.warn) {
          this.explosion(h.x, h.y, .75, h.col === 'ice' ? 'ice' : 'fire'); this.shake(8); this.sfx('boom');
          if (Math.hypot(p.x - h.x, p.y - 10 - h.y) < h.R + p.r) this.hurtPlayer(h);
          if (h.split) for (let i = 0; i < h.split; i++) { const a = i * TAU / h.split; this.bullets.push({ x: h.x, y: h.y, vx: Math.cos(a) * 150, vy: Math.sin(a) * 150, r: 8, col: 'gold', life: 4, t: 0, kind: 'orb', bounce: 0, hom: 0, homT: 0, spd: 150 }); }
          this.decals.push({ x: h.x, y: h.y, r: h.R * .9, t: 0 });
          continue;
        }
      } else if (h.kind === 'bolt') {
        if (h.t >= h.warn && !h.fired) { h.fired = true; this.sfx('zap'); this.shake(6); }
        if (h.fired && h.t < h.warn + h.dur) {
          const ca = Math.cos(h.a), sa = Math.sin(h.a), rx = p.x - h.x, ry = p.y - 16 - h.y;
          const along = rx * ca + ry * sa, perp = Math.abs(-rx * sa + ry * ca);
          if (along > 0 && perp < h.w + p.r) this.hurtPlayer(h);
        }
        if (h.t > h.warn + h.dur) continue;
      } else if (h.kind === 'lane') {
        if (h.t > h.dur + .25) continue;
      }
      out.push(h);
    }
    this.hazards = out;
    for (const d of this.decals) d.t += dt;
    this.decals = this.decals.filter(d => d.t < 6);
  }
  updatePickups(dt) {
    const p = this.player;
    for (const k of this.pickups) {
      k.t += dt;
      if (k.y < k.land) { k.vy += 900 * dt; k.y = Math.min(k.land, k.y + k.vy * dt); if (k.y >= k.land) this.puff(k.x, k.y, 'rgba(255,200,200,.5)', 6); }
      if (Math.hypot(p.x - k.x, p.y - 20 - k.y) < 34) {
        k.taken = true; p.hp = Math.min(p.maxHp, p.hp + 1); this.sfx('heal');
        this.burst(k.x, k.y, 16, ['#ff6b8a', '#ffd0dc', '#ffffff'], 200); this.text(p.x, p.y - 70, '+1 ❤', '#ff8fa8', 24);
      }
    }
    this.pickups = this.pickups.filter(k => !k.taken);
    // gemmes
    const out = [];
    for (const g of this.gemsArr) {
      g.t += dt;
      if (g.t < .55) { g.x += g.vx * dt; g.y += g.vy * dt; g.vx *= (1 - dt * 3); g.vy *= (1 - dt * 3); g.vz -= 900 * dt; g.z = Math.max(0, g.z + g.vz * dt); }
      else {
        const dx = p.x - g.x, dy = p.y - 25 - g.y, d = Math.hypot(dx, dy);
        const sp = 300 + (g.t - .55) * 1400;
        if (d < 22) { this.gems++; this.sfx('gem'); this.burst(p.x, p.y - 25, 3, ['#9ff', '#fff'], 90, 3); continue; }
        g.x += dx / d * Math.min(d, sp * dt); g.y += dy / d * Math.min(d, sp * dt); g.z *= .9;
      }
      out.push(g);
    }
    this.gemsArr = out;
  }
  updateFx(dt) {
    if (this.shakeAmt > 0) this.shakeAmt = Math.max(0, this.shakeAmt - dt * 40);
    if (this.hurtFlash > 0) this.hurtFlash -= dt;
    if (this.banner) this.banner.t += dt;
    if (this.headless) return;
    for (const q of this.parts) {
      q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt;
      if (q.drag) { q.vx *= (1 - Math.min(1, q.drag * dt)); q.vy *= (1 - Math.min(1, q.drag * dt)); }
      if (q.grav) q.vy += q.grav * dt;
    }
    this.parts = this.parts.filter(q => q.life > 0);
    for (const t of this.texts) { t.t += dt; t.y += t.vy * dt; t.vy *= (1 - dt * 2.5); }
    this.texts = this.texts.filter(t => t.t < .9);
  }
}

const API = { Game, LEVELS, WORLDS, UPS, DT, COL, A, DOOR, W, H, clamp, lerp, ease, TAU };
if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.DG = API;
})(typeof window !== 'undefined' ? window : globalThis);
