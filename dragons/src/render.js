// ===== Chasseur de Dragons : rendu canvas =====
(function () {
'use strict';
const { W, H, A, DOOR, COL, LEVELS, WORLDS, UPS, TAU, clamp, lerp, ease } = DG;
const FONT = "'Luckiest Guy', 'Arial Black', 'Trebuchet MS', sans-serif";
const IMG = {}, SIL = {}, GLOW = {};
let ROOMS = {}, VIGNETTE = null;
const ambient = [];
const R = { buttons: [], tutoMoved: false, confetti: [] };

function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function srand(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

R.load = function (sources, cb) {
  const keys = Object.keys(sources); let n = keys.length;
  keys.forEach(k => { const im = new Image(); im.onload = im.onerror = () => { if (--n === 0) { prep(); cb(); } }; im.src = sources[k]; IMG[k] = im; });
};
function prep() {
  for (const w of WORLDS) ROOMS[w.floor] = buildRoom(w);
  VIGNETTE = mk(W, H);
  const v = VIGNETTE.getContext('2d'), g = v.createRadialGradient(W / 2, H * .55, H * .25, W / 2, H * .55, H * .72);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.5)');
  v.fillStyle = g; v.fillRect(0, 0, W, H);
}
function sil(name, col) {
  const k = name + col; if (SIL[k]) return SIL[k];
  const im = IMG[name]; const c = mk(im.width, im.height), x = c.getContext('2d');
  x.drawImage(im, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height);
  return SIL[k] = c;
}
function glow(col) {
  if (GLOW[col]) return GLOW[col];
  const c = mk(64, 64), x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, col); g.addColorStop(.35, col + 'aa'); g.addColorStop(1, col + '00');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return GLOW[col] = c;
}

// ------------------------------------------------------------------ pièces (sol + mur du haut), pré-rendues
const WALL = [
  { face: '#323a54', dark: '#1d2234', mortar: '#12151f', lip: '#4a5372', flame: ['#fff2a8', '#ffb32b', '#ff5a12'] },
  { face: '#5f93bf', dark: '#3c6c97', mortar: '#244a70', lip: '#e9f6ff', flame: ['#e9fbff', '#7fdcff', '#2a8cff'] },
  { face: '#3d2722', dark: '#25150f', mortar: '#0f0605', lip: '#5a3a30', flame: ['#fff2a8', '#ffb32b', '#ff5a12'] },
];
function buildRoom(w) {
  const wi = WORLDS.indexOf(w), C = WALL[wi];
  const c = mk(W, H), x = c.getContext('2d');
  const im = IMG[w.floor];
  x.drawImage(im, 0, (H - im.height * W / im.width) / 2, W, im.height * W / im.width);
  if (wi === 1) { x.fillStyle = 'rgba(20,50,90,.16)'; x.fillRect(0, 0, W, H); }
  if (wi === 2) { x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(0, 0, W, H); }
  // ombre portée du mur
  let g = x.createLinearGradient(0, 140, 0, 205); g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 140, W, 65);
  // mur
  x.fillStyle = C.mortar; x.fillRect(0, 0, W, 132);
  const rnd = srand(77 + wi);
  for (let row = 0; row < 6; row++) {
    const y = row * 22, off = row % 2 ? 27 : 0;
    for (let bx = -54 + off; bx < W; bx += 54) {
      const sh = rnd() * .18 - .09;
      x.fillStyle = shade(C.face, sh); x.fillRect(bx + 2, y + 2, 50, 18);
      x.fillStyle = 'rgba(255,255,255,.10)'; x.fillRect(bx + 2, y + 2, 50, 3);
      x.fillStyle = 'rgba(0,0,0,.22)'; x.fillRect(bx + 2, y + 17, 50, 3);
    }
  }
  g = x.createLinearGradient(0, 0, 0, 132); g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(.6, 'rgba(0,0,0,.1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, W, 132);
  // rebord
  x.fillStyle = C.lip; x.fillRect(0, 128, W, 14);
  x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0, 138, W, 5);
  if (wi === 1) { // neige sur le rebord
    x.fillStyle = '#ffffff';
    for (let i = 0; i < 40; i++) { x.beginPath(); x.ellipse(i * 14 + rnd() * 8, 129, 10 + rnd() * 6, 5, 0, 0, TAU); x.fill(); }
  }
  if (wi === 2) { // fissures de lave dans le mur
    x.strokeStyle = 'rgba(255,110,30,.75)'; x.lineWidth = 2;
    for (let i = 0; i < 9; i++) { let px = rnd() * W, py = 10 + rnd() * 100; x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 4; k++) { px += (rnd() - .5) * 30; py += rnd() * 12; x.lineTo(px, py); } x.stroke(); }
  }
  // embrasure de la porte (le fond, la grille est dynamique)
  doorPath(x); x.fillStyle = '#05060b'; x.fill();
  // cadre de pierre
  x.save(); doorPath(x, 9); x.lineWidth = 16; x.strokeStyle = shade(C.lip, -.15); x.stroke();
  x.lineWidth = 3; x.strokeStyle = 'rgba(0,0,0,.6)'; x.stroke(); x.restore();
  x.fillStyle = shade(C.lip, .1); x.fillRect(DOOR.x - 11, 14, 22, 18); x.strokeStyle = 'rgba(0,0,0,.6)'; x.lineWidth = 2; x.strokeRect(DOOR.x - 11, 14, 22, 18);
  // supports de torche
  for (const tx of [150, 390]) { x.fillStyle = '#1b1410'; x.fillRect(tx - 4, 70, 8, 26); x.fillStyle = '#4b3a2a'; x.beginPath(); x.moveTo(tx - 13, 62); x.lineTo(tx + 13, 62); x.lineTo(tx + 7, 74); x.lineTo(tx - 7, 74); x.closePath(); x.fill(); x.strokeStyle = '#000'; x.lineWidth = 2; x.stroke(); }
  // bas de l'écran
  g = x.createLinearGradient(0, H - 50, 0, H); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.6)');
  x.fillStyle = g; x.fillRect(0, H - 50, W, 50);
  return c;
}
function doorPath(x, grow = 0) {
  const l = DOOR.x - DOOR.half - grow, r = DOOR.x + DOOR.half + grow, b = DOOR.y + 2, top = 78;
  x.beginPath(); x.moveTo(l, b); x.lineTo(l, top); x.arc(DOOR.x, top, DOOR.half + grow, Math.PI, 0); x.lineTo(r, b); x.closePath();
}
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = n >> 8 & 255, b = n & 255;
  const t = f < 0 ? 0 : 255, p = Math.abs(f);
  r = Math.round((t - r) * p + r); g = Math.round((t - g) * p + g); b = Math.round((t - b) * p + b);
  return '#' + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1);
}

function drawRoom(ctx, game, worldIdx, oy, door, t) {
  const w = WORLDS[worldIdx], C = WALL[worldIdx];
  ctx.drawImage(ROOMS[w.floor], 0, oy);
  // grille + lumière
  ctx.save(); ctx.translate(0, oy);
  if (door > 0) {
    ctx.save(); doorPath(ctx); ctx.clip();
    const g = ctx.createLinearGradient(0, 30, 0, DOOR.y); g.addColorStop(0, `rgba(255,236,170,${.9 * door})`); g.addColorStop(1, `rgba(255,190,90,${.5 * door})`);
    ctx.fillStyle = g; ctx.fillRect(DOOR.x - 60, 20, 120, 130); ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .35 * door * (.85 + .15 * Math.sin(t * 3));
    const g2 = ctx.createLinearGradient(0, DOOR.y, 0, DOOR.y + 300); g2.addColorStop(0, '#ffd98a'); g2.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = g2; ctx.beginPath(); ctx.moveTo(DOOR.x - 44, DOOR.y); ctx.lineTo(DOOR.x + 44, DOOR.y); ctx.lineTo(DOOR.x + 120, DOOR.y + 300); ctx.lineTo(DOOR.x - 120, DOOR.y + 300); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.save(); doorPath(ctx); ctx.clip();
  const lift = door * 112;
  ctx.translate(0, -lift);
  ctx.strokeStyle = '#111'; ctx.lineWidth = 7;
  for (let bx = DOOR.x - 42; bx <= DOOR.x + 42; bx += 14) { ctx.beginPath(); ctx.moveTo(bx, 28); ctx.lineTo(bx, DOOR.y + 4); ctx.stroke(); }
  for (const by of [70, 110]) { ctx.beginPath(); ctx.moveTo(DOOR.x - 48, by); ctx.lineTo(DOOR.x + 48, by); ctx.stroke(); }
  ctx.strokeStyle = '#7b808c'; ctx.lineWidth = 4;
  for (let bx = DOOR.x - 42; bx <= DOOR.x + 42; bx += 14) { ctx.beginPath(); ctx.moveTo(bx, 28); ctx.lineTo(bx, DOOR.y + 4); ctx.stroke(); }
  for (const by of [70, 110]) { ctx.beginPath(); ctx.moveTo(DOOR.x - 48, by); ctx.lineTo(DOOR.x + 48, by); ctx.stroke(); }
  ctx.fillStyle = '#9aa0ac'; for (let bx = DOOR.x - 42; bx <= DOOR.x + 42; bx += 14) { ctx.beginPath(); ctx.moveTo(bx - 3, DOOR.y + 2); ctx.lineTo(bx + 3, DOOR.y + 2); ctx.lineTo(bx, DOOR.y + 10); ctx.fill(); }
  ctx.restore();
  // torches
  for (const tx of [150, 390]) {
    const f = Math.sin(t * 13 + tx) * .5 + Math.sin(t * 7.3 + tx * .3) * .5;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .55 + .1 * f;
    ctx.drawImage(glow(C.flame[2]), tx - 70, 58 - 70, 140, 140); ctx.restore();
    flame(ctx, tx, 62, 13 + f * 1.5, 30 + f * 4, C.flame);
  }
  ctx.restore();
}
function flame(ctx, x, y, w, h, cols) {
  for (let i = 0; i < 3; i++) {
    const k = 1 - i * .3;
    ctx.fillStyle = cols[2 - i];
    ctx.beginPath(); ctx.moveTo(x, y - h * k); ctx.quadraticCurveTo(x + w * k, y - h * k * .35, x + w * .55 * k, y); ctx.quadraticCurveTo(x, y + w * .4 * k, x - w * .55 * k, y); ctx.quadraticCurveTo(x - w * k, y - h * k * .35, x, y - h * k); ctx.fill();
  }
}

// ------------------------------------------------------------------ texte & UI
function txt(ctx, s, x, y, size, fill, align = 'center', stroke = '#1a0f24', lw) {
  ctx.font = size + 'px ' + FONT; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  if (stroke) { ctx.lineWidth = lw || Math.max(3, size * .2); ctx.strokeStyle = stroke; ctx.strokeText(s, x, y); }
  ctx.fillStyle = fill; ctx.fillText(s, x, y);
}
function rrect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function heart(ctx, x, y, s, fill, stroke = '#2a0a12') {
  ctx.beginPath(); ctx.moveTo(x, y + s * .35);
  ctx.bezierCurveTo(x - s * .1, y + s * .25, x - s * .55, y + s * .05, x - s * .5, y - s * .2);
  ctx.bezierCurveTo(x - s * .45, y - s * .5, x - s * .05, y - s * .5, x, y - s * .22);
  ctx.bezierCurveTo(x + s * .05, y - s * .5, x + s * .45, y - s * .5, x + s * .5, y - s * .2);
  ctx.bezierCurveTo(x + s * .55, y + s * .05, x + s * .1, y + s * .25, x, y + s * .35);
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = stroke; ctx.stroke();
}
function button(ctx, label, cx, cy, w, h, action, col = '#ffcf3a', t = 0, small) {
  const pulse = 1 + Math.sin(t * 4) * .025;
  ctx.save(); ctx.translate(cx, cy); ctx.scale(pulse, pulse);
  rrect(ctx, -w / 2, -h / 2 + 6, w, h, 18); ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fill();
  rrect(ctx, -w / 2, -h / 2, w, h, 18);
  const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2); g.addColorStop(0, shade(col, .35)); g.addColorStop(1, shade(col, -.2));
  ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = '#2a1408'; ctx.stroke();
  rrect(ctx, -w / 2 + 8, -h / 2 + 6, w - 16, h * .32, 10); ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.fill();
  txt(ctx, label, 0, 3, small ? 22 : 30, '#fffdf2', 'center', '#3a1c06');
  ctx.restore();
  R.buttons.push({ x: cx - w / 2, y: cy - h / 2, w, h, action });
}

// ------------------------------------------------------------------ entités
function drawShadow(ctx, x, y, rx, a = .35) { ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.beginPath(); ctx.ellipse(x, y, rx, rx * .3, 0, 0, TAU); ctx.fill(); }

function dragonGround(e, game) { return (game.state === 'intro' ? e.baseY : e.y) + e.h * .46 + 10; }
function drawDragon(ctx, e, game, t) {
  const im = IMG[e.type.img];
  const fl = Math.sin(e.anim * (e.minion ? 11 : 5.5));
  const bob = Math.sin(e.anim * 2.6) * (e.minion ? 3 : 7);
  let sx = 1 + .045 * fl, sy = 1 - .035 * fl, sc = 1;
  if (e.roar > 0) sc *= 1 + .09 * Math.sin(Math.min(1, e.roar) * Math.PI);
  if (e.spawn > 0) sc *= 1 - e.spawn / .45;
  if (e.dying) sc *= .9 + .1 * (e.dying / 1.5);
  let ox = 0, oy = 0;
  if (e.tremble > 0 || e.dying) { ox = (Math.random() - .5) * 6; oy = (Math.random() - .5) * 6; }
  const w = e.w * sx * sc, h = e.h * sy * sc, x = e.x + ox, y = e.y + bob + oy;
  ctx.drawImage(im, x - w / 2, y - h / 2, w, h);
  if (e.boss && e.phase > 0 && !e.dying) { ctx.globalAlpha = .1 + .08 * Math.sin(t * 6); ctx.drawImage(sil(e.type.img, '#ff2020'), x - w / 2, y - h / 2, w, h); ctx.globalAlpha = 1; }
  const fla = e.dying ? (Math.floor(t * 18) % 2 ? .8 : 0) : e.flash > 0 ? Math.min(1, e.flash / .06) * .5 : 0;
  if (fla > 0) { ctx.globalAlpha = fla; ctx.drawImage(sil(e.type.img, '#ffffff'), x - w / 2, y - h / 2, w, h); ctx.globalAlpha = 1; }
  // lueur de la gueule (annonce d'attaque)
  if (!e.minion && !e.dying && (e.tell > 0 || e.breath > 0)) {
    const m = { x: x, y: y + e.h * e.type.mouth * sy };
    const s = (e.breath > 0 ? 90 : 70 * (1 - e.tell / .4) + 20) * (1 + .15 * Math.sin(t * 30));
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glow(COL[e.col].glow), m.x - s / 2, m.y - s / 2, s, s); ctx.restore();
  }
}
function drawTarget(ctx, e, t) {
  const rx = e.w * e.type.hit[0] * .8, ry = e.h * e.type.hit[1] * .8, a = t * 2;
  ctx.save(); ctx.translate(e.x, e.y); ctx.strokeStyle = 'rgba(255,70,70,.85)'; ctx.lineWidth = 3;
  for (let i = 0; i < 4; i++) { const an = a + i * TAU / 4; ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, an - .25, an + .25); ctx.stroke(); }
  ctx.restore();
}
const HERO_H = 88;
function drawHero(ctx, p, game, t, forceY) {
  const im = IMG.hero, h = HERO_H, w = h * im.width / im.height;
  const y0 = forceY != null ? forceY : p.y;
  const bob = p.moving ? -Math.abs(Math.sin(p.walk)) * 6 : Math.sin(t * 2.5) * 1.2;
  const tilt = p.moving ? Math.sin(p.walk) * .07 : 0;
  const rc = p.recoil > 0 ? p.recoil / .12 : 0;
  const sx = (1 + .07 * rc) * (p.face > 0 ? -1 : 1), sy = 1 - .06 * rc;
  if (p.inv > 0 && Math.floor(t * 16) % 2 && game.state !== 'dead') ctx.globalAlpha = .35;
  ctx.save(); ctx.translate(p.x, y0 + bob); ctx.rotate(tilt); ctx.scale(sx, sy);
  ctx.drawImage(im, -w / 2, -h, w, h);
  if (p.flash > 0) { ctx.globalAlpha = .85; ctx.drawImage(sil('hero', '#ff3030'), -w / 2, -h, w, h); }
  ctx.restore(); ctx.globalAlpha = 1;
  if (p.shield > 0) {
    ctx.save(); ctx.globalAlpha = .55 + .15 * Math.sin(t * 4);
    ctx.strokeStyle = '#8ff0ff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, y0 - 40, 44, 0, TAU); ctx.stroke();
    ctx.globalAlpha = .12; ctx.fillStyle = '#8ff0ff'; ctx.fill();
    ctx.globalAlpha = .8; ctx.lineWidth = 4; ctx.strokeStyle = '#ffffff'; ctx.beginPath(); ctx.arc(p.x, y0 - 40, 44, t * 2, t * 2 + .6); ctx.stroke();
    ctx.restore();
  }
}
function drawArrow(ctx, a) {
  ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(a.a);
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(-70, 0, -18, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, a.crit ? 'rgba(255,220,80,.8)' : 'rgba(255,255,255,.55)');
  ctx.strokeStyle = g; ctx.lineWidth = a.crit ? 6 : 4; ctx.beginPath(); ctx.moveTo(-70, 0); ctx.lineTo(-18, 0); ctx.stroke();
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = '#3a210c'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-22, 0); ctx.lineTo(8, 0); ctx.stroke();
  ctx.strokeStyle = '#b07a3e'; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(-22, 0); ctx.lineTo(8, 0); ctx.stroke();
  ctx.fillStyle = a.crit ? '#ffe04a' : '#e6ecf2'; ctx.strokeStyle = '#1b1b22'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(18, 0); ctx.lineTo(6, -6); ctx.lineTo(6, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#e8322f'; ctx.beginPath(); ctx.moveTo(-24, 0); ctx.lineTo(-30, -6); ctx.lineTo(-18, 0); ctx.lineTo(-30, 6); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function drawBullet(ctx, b, t) {
  const c = COL[b.col] || COL.fire;
  if (b.kind === 'flame') {
    const k = 1 - b.t / b.life, s = b.r * 3.2;
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, k * 1.4);
    ctx.drawImage(glow(c.glow), b.x - s / 2, b.y - s / 2, s, s);
    ctx.globalAlpha = Math.min(1, k * 1.2) * .9; ctx.drawImage(glow(c.core), b.x - s / 4, b.y - s / 4, s / 2, s / 2);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    return;
  }
  const pulse = 1 + .12 * Math.sin(t * 18 + b.x * .05);
  const s = b.r * 4.4 * pulse;
  ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glow(c.glow), b.x - s / 2, b.y - s / 2, s, s); ctx.globalCompositeOperation = 'source-over';
  if (b.kind === 'shard') {
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vy, b.vx));
    ctx.beginPath(); ctx.moveTo(b.r * 1.6, 0); ctx.lineTo(0, -b.r * .65); ctx.lineTo(-b.r * 1.2, 0); ctx.lineTo(0, b.r * .65); ctx.closePath();
    ctx.fillStyle = '#eafcff'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = c.ring; ctx.stroke();
    ctx.restore(); return;
  }
  ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU);
  ctx.fillStyle = b.kind === 'snow' ? '#ffffff' : c.core; ctx.fill();
  ctx.lineWidth = 2.5; ctx.strokeStyle = c.ring; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(b.x - b.r * .35, b.y - b.r * .35, b.r * .3, 0, TAU); ctx.fill();
}
function drawHazardGround(ctx, h, t) {
  if (h.kind === 'meteor') {
    const k = h.t / h.warn;
    ctx.fillStyle = `rgba(255,50,30,${.12 + .08 * Math.sin(t * 20)})`; ctx.beginPath(); ctx.arc(h.x, h.y, h.R, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,80,40,.35)'; ctx.beginPath(); ctx.arc(h.x, h.y, h.R * k, 0, TAU); ctx.fill();
    ctx.setLineDash([10, 8]); ctx.lineDashOffset = -t * 40; ctx.strokeStyle = 'rgba(255,60,40,.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(h.x, h.y, h.R, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  } else if (h.kind === 'bolt' && !h.fired) {
    const k = h.t / h.warn;
    ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(h.a);
    ctx.fillStyle = `rgba(200,90,255,${.10 + .14 * k})`; ctx.fillRect(0, -h.w, 1200, h.w * 2);
    ctx.strokeStyle = `rgba(240,190,255,${.4 + .5 * (Math.floor(t * 14) % 2)})`; ctx.lineWidth = 2; ctx.setLineDash([14, 10]); ctx.lineDashOffset = -t * 120;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(1200, 0); ctx.stroke(); ctx.setLineDash([]);
    ctx.restore();
  } else if (h.kind === 'lane') {
    const dx = h.x1 - h.x0, dy = h.y1 - h.y0, L = Math.hypot(dx, dy) + 60, k = Math.min(1, h.t / h.dur);
    ctx.save(); ctx.translate(h.x0, h.y0); ctx.rotate(Math.atan2(dy, dx));
    ctx.fillStyle = `rgba(255,40,40,${.12 + .1 * Math.sin(t * 16)})`; ctx.fillRect(0, -h.w / 2, L, h.w);
    ctx.fillStyle = 'rgba(255,60,60,.28)'; ctx.fillRect(0, -h.w / 2, L * k, h.w);
    ctx.strokeStyle = 'rgba(255,70,60,.9)'; ctx.lineWidth = 3; ctx.strokeRect(0, -h.w / 2, L, h.w);
    ctx.fillStyle = 'rgba(255,200,190,.7)';
    for (let i = 0; i < 5; i++) { const px = ((t * 260 + i * L / 5) % L); ctx.beginPath(); ctx.moveTo(px + 14, 0); ctx.lineTo(px, -12); ctx.lineTo(px + 5, 0); ctx.lineTo(px, 12); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }
}
function drawHazardAir(ctx, h, t) {
  if (h.kind === 'meteor') {
    const k = h.t / h.warn, f = 1 - k;
    const x = h.x + f * 160, y = h.y - f * f * 900 - f * 60;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 1; i < 6; i++) { const s = 46 - i * 6; ctx.globalAlpha = .5 - i * .07; ctx.drawImage(glow('#ff6a10'), x + i * 14 - s / 2, y - i * 26 - s / 2, s, s); }
    ctx.globalAlpha = 1; ctx.drawImage(glow('#ffb040'), x - 40, y - 40, 80, 80); ctx.restore();
    ctx.fillStyle = '#3a1d14'; ctx.beginPath(); ctx.arc(x, y, 15, 0, TAU); ctx.fill(); ctx.strokeStyle = '#ff9a3a'; ctx.lineWidth = 3; ctx.stroke();
  } else if (h.kind === 'bolt' && h.fired) {
    const k = 1 - (h.t - h.warn) / h.dur;
    const pts = []; const ca = Math.cos(h.a), sa = Math.sin(h.a);
    for (let d = 0; d < 1200; d += 38) { const o = d ? (Math.random() - .5) * 26 : 0; pts.push([h.x + ca * d - sa * o, h.y + sa * d + ca * o]); }
    ctx.save(); ctx.lineJoin = 'round';
    const pass = (w, col, a) => { ctx.globalAlpha = a; ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const p of pts) ctx.lineTo(p[0], p[1]); ctx.stroke(); };
    ctx.globalCompositeOperation = 'lighter'; pass(30, '#a030ff', .35 * k); pass(12, '#d690ff', .8 * k);
    ctx.globalCompositeOperation = 'source-over'; pass(4, '#ffffff', k);
    ctx.restore();
  }
}
function drawGem(ctx, g, t) {
  const cols = [['#7ff7ff', '#0b8aa8'], ['#d58cff', '#5b1f8a'], ['#8cff9a', '#1d7a2b'], ['#ffe066', '#9a6a00']][g.c];
  const y = g.y - g.z, s = 8;
  drawShadow(ctx, g.x, g.y + 4, 6, .25);
  ctx.save(); ctx.translate(g.x, y); ctx.rotate(Math.sin(t * 5 + g.x) * .3);
  ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * .8, 0); ctx.lineTo(0, s); ctx.lineTo(-s * .8, 0); ctx.closePath();
  ctx.fillStyle = cols[0]; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = cols[1]; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fillRect(-2, -s * .5, 3, 3);
  ctx.restore();
}
function drawParts(ctx, parts, add) {
  for (const q of parts) {
    if (!!q.add !== add) continue;
    const k = clamp(q.life / q.max, 0, 1);
    if (q.kind === 'spark') {
      ctx.strokeStyle = q.col; ctx.globalAlpha = Math.min(1, k * 1.5); ctx.lineWidth = q.size * k; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - q.vx * .035, q.y - q.vy * .035); ctx.stroke();
    } else if (q.kind === 'smoke') {
      ctx.globalAlpha = k * .7; ctx.fillStyle = q.col; ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (1.6 - k * .6), 0, TAU); ctx.fill();
    } else if (q.kind === 'ring') {
      ctx.globalAlpha = k; ctx.strokeStyle = q.col; ctx.lineWidth = q.w * k + 1; ctx.beginPath(); ctx.arc(q.x, q.y, q.size * ease.out(1 - k) + 4, 0, TAU); ctx.stroke();
    } else if (q.kind === 'flash') {
      ctx.globalAlpha = k; const s = q.size * (1.4 - k * .4) * 2; ctx.drawImage(glow(q.col === '#ffffff' ? '#fff8e0' : q.col), q.x - s / 2, q.y - s / 2, s, s);
    }
  }
  ctx.globalAlpha = 1; ctx.lineCap = 'butt';
}

// ------------------------------------------------------------------ ambiance
function updAmbient(dt, wi, t) {
  const rate = wi === 1 ? 22 : wi === 2 ? 3 : 5;
  if (Math.random() < rate * dt) {
    if (wi === 1) ambient.push({ x: Math.random() * W * 1.2 - 60, y: -10, vx: 20 + Math.random() * 20, vy: 40 + Math.random() * 40, s: 1.5 + Math.random() * 2.5, life: 20, wi });
    else if (wi === 2) ambient.push({ x: Math.random() < .5 ? Math.random() * A.l : A.r + Math.random() * (W - A.r), y: H + 10, vx: (Math.random() - .5) * 20, vy: -40 - Math.random() * 50, s: 1 + Math.random() * 1.2, life: 12, wi });
    else ambient.push({ x: Math.random() * W, y: 200 + Math.random() * 700, vx: (Math.random() - .5) * 8, vy: -4 - Math.random() * 6, s: 1 + Math.random() * 1.5, life: 6, wi });
  }
  for (const a of ambient) { a.x += (a.vx + Math.sin(t + a.y * .02) * 10) * dt; a.y += a.vy * dt; a.life -= dt; }
  for (let i = ambient.length - 1; i >= 0; i--) if (ambient[i].life <= 0 || ambient[i].wi !== wi || ambient[i].y > H + 20 || ambient[i].y < -20) ambient.splice(i, 1);
}
function drawAmbient(ctx) {
  for (const a of ambient) {
    const k = Math.min(1, a.life);
    if (a.wi === 2) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .45 * k; ctx.drawImage(glow('#ff7a1a'), a.x - a.s * 4, a.y - a.s * 4, a.s * 8, a.s * 8); ctx.globalCompositeOperation = 'source-over'; }
    else { ctx.globalAlpha = (a.wi === 1 ? .85 : .3) * k; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(a.x, a.y, a.s, 0, TAU); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
}

// ------------------------------------------------------------------ HUD
function drawHUD(ctx, game, t) {
  const p = game.player;
  // bandeau du haut
  const g = ctx.createLinearGradient(0, 0, 0, 110); g.addColorStop(0, 'rgba(8,6,14,.75)'); g.addColorStop(1, 'rgba(8,6,14,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, 110);
  txt(ctx, 'SALLE ' + (game.levelIdx + 1) + ' / ' + LEVELS.length, 18, 20, 17, '#ffe7a6', 'left');
  // gemmes
  ctx.save(); ctx.translate(374, 20); ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(9, 0); ctx.lineTo(0, 10); ctx.lineTo(-9, 0); ctx.closePath(); ctx.fillStyle = '#7ff7ff'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#0b4a5a'; ctx.stroke(); ctx.restore();
  txt(ctx, String(game.gems), 390, 21, 19, '#ffffff', 'left');
  // boss
  const bosses = game.enemies.filter(e => e.boss);
  if (bosses.length && game.state !== 'title') {
    const n = bosses.length, gap = 24, bw = n === 1 ? 400 : (W - 60 - gap) / 2;
    bosses.forEach((e, i) => {
      const x = n === 1 ? (W - bw) / 2 : 30 + i * (bw + gap), y = 58, bh = 15;
      const L = LEVELS[game.levelIdx].bosses[i];
      const name = n === 1 ? LEVELS[game.levelIdx].name : (L.t === 'vert' ? (i ? 'Pousse II' : 'Pousse I') : L.t === 'glace' ? 'Givre' : L.t === 'orage' ? 'Zap' : 'Braise');
      txt(ctx, name.toUpperCase(), x + bw / 2, y - 14, n === 1 ? 20 : 16, '#ffffff');
      rrect(ctx, x - 3, y - 3, bw + 6, bh + 6, 8); ctx.fillStyle = '#12080f'; ctx.fill();
      const k = Math.max(0, e.hp / e.maxHp), kl = Math.max(0, e.lag / e.maxHp);
      if (kl > 0) { rrect(ctx, x, y, bw * kl, bh, 5); ctx.fillStyle = '#ffffff'; ctx.fill(); }
      if (k > 0) {
        rrect(ctx, x, y, Math.max(8, bw * k), bh, 5);
        const gg = ctx.createLinearGradient(0, y, 0, y + bh);
        if (game.level.king) { gg.addColorStop(0, '#ffe169'); gg.addColorStop(1, '#d1720b'); } else { gg.addColorStop(0, '#ff7a63'); gg.addColorStop(1, '#c4142c'); }
        ctx.fillStyle = gg; ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(x + 4, y + 2, Math.max(0, bw * k - 8), 3);
      }
      ctx.fillStyle = 'rgba(0,0,0,.7)';
      for (const ph of (e.phases || []).slice(1)) ctx.fillRect(x + bw * ph.at - 1.5, y - 2, 3, bh + 4);
    });
  }
  // cœurs
  for (let i = 0; i < p.maxHp; i++) {
    const full = i < p.hp, x = 30 + i * 32, y = 98;
    const s = 26 * (full && game.hurtFlash > 0 && i === p.hp ? 1.2 : 1);
    heart(ctx, x, y, s, full ? '#ff3b55' : 'rgba(40,20,30,.85)');
    if (full) { ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.ellipse(x - 6, y - 5, 4, 3, -.6, 0, TAU); ctx.fill(); }
  }
  for (let i = 0; i < p.shieldMax; i++) {
    const x = 30 + p.maxHp * 32 + 6 + i * 28, y = 98, on = i < p.shield;
    ctx.beginPath(); ctx.moveTo(x, y - 12); ctx.lineTo(x + 10, y - 8); ctx.lineTo(x + 8, y + 6); ctx.lineTo(x, y + 12); ctx.lineTo(x - 8, y + 6); ctx.lineTo(x - 10, y - 8); ctx.closePath();
    ctx.fillStyle = on ? '#6fe3ff' : 'rgba(30,40,60,.8)'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#0a2a3a'; ctx.stroke();
  }
  // pouvoirs
  let ux = W - 18;
  ctx.font = '18px sans-serif'; ctx.textBaseline = 'middle';
  for (const u of UPS.slice().reverse()) {
    const n = game.ups[u.id]; if (!n) continue;
    if (n > 1) { txt(ctx, 'x' + n, ux, 104, 13, '#ffe7a6', 'right'); ux -= 22; }
    ctx.textAlign = 'right'; ctx.fillText(u.icon, ux, 98); ux -= 26;
  }
  // bouton son
  R.buttons.push({ x: W - 46, y: 0, w: 46, h: 40, action: 'mute' });
  if (['intro', 'fight', 'walk', 'open', 'upgrade', 'victory', 'loot'].includes(game.state)) {
    R.buttons.push({ x: W - 94, y: 0, w: 46, h: 40, action: 'pause' });
    ctx.fillStyle = '#ffe7a6'; ctx.fillRect(W - 78, 12, 5, 18); ctx.fillRect(W - 68, 12, 5, 18);
  }
  ctx.save(); ctx.translate(W - 22, 21); ctx.fillStyle = '#ffe7a6'; ctx.strokeStyle = '#ffe7a6'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(-9, -4); ctx.lineTo(-4, -4); ctx.lineTo(2, -10); ctx.lineTo(2, 10); ctx.lineTo(-4, 4); ctx.lineTo(-9, 4); ctx.closePath(); ctx.fill();
  if (R.muted) { ctx.beginPath(); ctx.moveTo(6, -6); ctx.lineTo(14, 6); ctx.moveTo(14, -6); ctx.lineTo(6, 6); ctx.stroke(); }
  else { ctx.beginPath(); ctx.arc(3, 0, 7, -.8, .8); ctx.stroke(); ctx.beginPath(); ctx.arc(3, 0, 12, -.8, .8); ctx.stroke(); }
  ctx.restore();
}

function drawBanner(ctx, b) {
  const t = b.t, ins = ease.out(clamp(t / .35, 0, 1)), outs = ease.inOut(clamp((t - 2.1) / .35, 0, 1));
  const ox = (1 - ins) * -W + outs * W;
  if (ins <= 0 || outs >= 1) return;
  ctx.save(); ctx.translate(ox, 0);
  const y = 470;
  const g = ctx.createLinearGradient(0, y - 70, 0, y + 70); g.addColorStop(0, 'rgba(20,6,10,0)'); g.addColorStop(.2, 'rgba(20,6,10,.85)'); g.addColorStop(.8, 'rgba(20,6,10,.85)'); g.addColorStop(1, 'rgba(20,6,10,0)');
  ctx.fillStyle = g; ctx.fillRect(0, y - 80, W, 160);
  ctx.fillStyle = b.king ? '#ff4a3a' : '#ffc94a'; ctx.fillRect(0, y - 58, W, 3); ctx.fillRect(0, y + 55, W, 3);
  txt(ctx, b.king ? 'COMBAT FINAL' : 'SALLE ' + (b.idx + 1), W / 2, y - 34, 22, b.king ? '#ff8a7a' : '#ffd36b');
  txt(ctx, b.name.toUpperCase(), W / 2, y + 6, b.name.length > 12 ? 42 : 50, '#ffffff', 'center', '#2a0a10', 10);
  txt(ctx, b.sub, W / 2, y + 40, 19, '#ffd9b0');
  ctx.restore();
}
function wrapText(ctx, s, x, y, maxW, size, col) {
  ctx.font = size + 'px ' + FONT; const words = s.split(' '); const lines = []; let cur = '';
  for (const w of words) { const test = cur ? cur + ' ' + w : w; if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; } else cur = test; }
  lines.push(cur);
  lines.forEach((l, i) => txt(ctx, l, x, y + i * size * 1.15, size, col, 'center', '#140a20', 4));
}
function drawCards(ctx, game, t) {
  const c = game.cards; if (!c) return;
  const T = game.stateT, fade = clamp(T / .3, 0, 1) * (c.picked != null ? 1 - clamp((c.pt - .5) / .4, 0, 1) : 1);
  ctx.fillStyle = `rgba(6,4,14,${.68 * fade})`; ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = fade;
  txt(ctx, 'CHOISIS UN POUVOIR !', W / 2, 270, 34, '#ffd34a', 'center', '#2a1206', 8);
  ctx.globalAlpha = 1;
  const cw = 152, ch = 230;
  c.list.forEach((u, i) => {
    const cx = 100 + i * 170, cy = 470;
    let s = ease.back(clamp((T - .15 - i * .1) / .4, 0, 1)), a = 1, dy = 0;
    if (c.picked != null) { if (c.picked === i) { s *= 1 + .15 * Math.sin(Math.min(1, c.pt / .3) * Math.PI / 2); a = 1 - clamp((c.pt - .5) / .4, 0, 1); } else { a = 1 - clamp(c.pt / .25, 0, 1); dy = c.pt * 300; } }
    if (s <= 0 || a <= 0) return;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(cx, cy + dy); ctx.scale(s, s);
    if (c.picked === i) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(glow('#ffd34a'), -150, -170, 300, 340); ctx.restore(); }
    rrect(ctx, -cw / 2, -ch / 2 + 7, cw, ch, 18); ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fill();
    rrect(ctx, -cw / 2, -ch / 2, cw, ch, 18);
    const g = ctx.createLinearGradient(0, -ch / 2, 0, ch / 2); g.addColorStop(0, '#4a3478'); g.addColorStop(1, '#22163c');
    ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = '#ffcf4a'; ctx.stroke();
    rrect(ctx, -cw / 2 + 10, -ch / 2 + 12, cw - 20, 92, 12); ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fill();
    ctx.font = '56px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(u.icon, 0, -ch / 2 + 60 + Math.sin(t * 3 + i) * 3);
    wrapText(ctx, u.name.toUpperCase(), 0, -2, cw - 18, 19, '#ffffff');
    wrapText(ctx, u.desc, 0, 56, cw - 22, 15, '#d9ccff');
    const lv = game.ups[u.id] || 0;
    for (let k = 0; k < u.max; k++) { ctx.beginPath(); ctx.arc((k - (u.max - 1) / 2) * 14, ch / 2 - 20, 4.5, 0, TAU); ctx.fillStyle = k < lv ? '#ffcf4a' : 'rgba(255,255,255,.2)'; ctx.fill(); }
    ctx.restore();
    if (c.picked == null && s > .9) R.buttons.push({ x: cx - cw / 2, y: cy - ch / 2, w: cw, h: ch, action: 'card' + i });
  });
}

// ------------------------------------------------------------------ écrans
function drawTitle(ctx, game, t, saved) {
  drawRoom(ctx, game, 0, 0, 0, t);
  drawAmbient(ctx);
  ctx.fillStyle = 'rgba(8,4,16,.45)'; ctx.fillRect(0, 0, W, H);
  // dragon roi
  const im = IMG.dragon_roi, dw = 430, dh = dw * im.height / im.width, fl = Math.sin(t * 3);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .55; ctx.drawImage(glow('#ff5a10'), W / 2 - 260, 400 - 230, 520, 460); ctx.restore();
  drawShadow(ctx, W / 2, 590, 130 * (1 - .04 * fl), .4);
  ctx.drawImage(im, W / 2 - dw * (1 + .03 * fl) / 2, 380 - dh / 2 + Math.sin(t * 1.6) * 8, dw * (1 + .03 * fl), dh * (1 - .02 * fl));
  // titre
  const s = 1 + Math.sin(t * 2) * .02;
  ctx.save(); ctx.translate(W / 2, 120); ctx.scale(s, s); ctx.rotate(-.03);
  txt(ctx, 'CHASSEUR', 0, -30, 60, '#ffd84a', 'center', '#2a0c04', 13);
  txt(ctx, 'DE DRAGONS', 0, 32, 50, '#ff8a3a', 'center', '#2a0c04', 12);
  ctx.restore();
  // héros
  const hi = IMG.hero, hh = 150, hw = hh * hi.width / hi.height;
  drawShadow(ctx, 130, 912, 40, .45);
  ctx.drawImage(hi, 130 - hw / 2, 912 - hh + Math.sin(t * 2.5) * 2, hw, hh);
  button(ctx, 'JOUER', 325, 700, 280, 78, 'new', '#ffbf2a', t);
  if (saved) button(ctx, 'CONTINUER · SALLE ' + (saved + 1), 325, 800, 280, 62, 'continue', '#4fb0ff', t + 1, true);
  txt(ctx, 'Glisse pour bouger · Arrête-toi pour tirer', W / 2, 940, 15, '#e8dcff', 'center', '#140a20', 4);
  const ins = R.installMode && R.installMode();
  if (ins === 'prompt') button(ctx, "INSTALLER L'APPLI", 340, saved ? 878 : 790, 250, 48, 'install', '#5fd38a', t + 2, true);
  else if (ins === 'ios') { const y = saved ? 868 : 790; txt(ctx, "Pour l'installer :", 340, y, 16, '#ffe7a6', 'center', '#140a20', 4); txt(ctx, 'Partager puis « Sur l\'écran d\'accueil »', 340, y + 22, 16, '#ffe7a6', 'center', '#140a20', 4); }
}
function drawDead(ctx, game, t) {
  const k = clamp((game.stateT - .8) / .4, 0, 1); if (k <= 0) return;
  ctx.fillStyle = `rgba(40,0,10,${.65 * k})`; ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = k;
  txt(ctx, 'AÏE !', W / 2, 360, 80, '#ff5a5a', 'center', '#1a0408', 14);
  txt(ctx, "Le dragon t'a eu…", W / 2, 440, 26, '#ffe0e0');
  txt(ctx, 'Tes pouvoirs sont gardés.', W / 2, 480, 18, '#ffbcbc');
  ctx.globalAlpha = 1;
  if (k >= 1) button(ctx, 'RÉESSAYER', W / 2, 580, 270, 78, 'retry', '#ffbf2a', t);
}
function drawEnd(ctx, game, t, dt) {
  const k = clamp(game.stateT / .6, 0, 1);
  ctx.fillStyle = `rgba(10,6,24,${.7 * k})`; ctx.fillRect(0, 0, W, H);
  if (Math.random() < dt * 40) R.confetti.push({ x: Math.random() * W, y: -10, vx: (Math.random() - .5) * 60, vy: 120 + Math.random() * 120, r: Math.random() * TAU, vr: (Math.random() - .5) * 8, c: ['#ffd34a', '#ff5a7a', '#5ad1ff', '#8cff8a', '#d58cff'][Math.floor(Math.random() * 5)] });
  for (const c of R.confetti) { c.x += c.vx * dt; c.y += c.vy * dt; c.r += c.vr * dt; ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.r); ctx.fillStyle = c.c; ctx.fillRect(-5, -3, 10, 6); ctx.restore(); }
  R.confetti = R.confetti.filter(c => c.y < H + 20);
  ctx.globalAlpha = k;
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(W / 2, 300); ctx.rotate(t * .3);
  for (let i = 0; i < 12; i++) { ctx.rotate(TAU / 12); ctx.fillStyle = 'rgba(255,210,80,.12)'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-40, -420); ctx.lineTo(40, -420); ctx.closePath(); ctx.fill(); }
  ctx.restore();
  const s = ease.back(clamp(game.stateT / .7, 0, 1));
  ctx.save(); ctx.translate(W / 2, 280); ctx.scale(s, s); txt(ctx, 'BRAVO !', 0, 0, 84, '#ffd84a', 'center', '#2a0c04', 15); ctx.restore();
  txt(ctx, 'Le Roi Dragon est vaincu !', W / 2, 370, 27, '#ffffff');
  const tm = Math.floor(game.runTime), mm = Math.floor(tm / 60), ss = String(tm % 60).padStart(2, '0');
  txt(ctx, 'Gemmes : ' + game.gems, W / 2, 450, 24, '#7ff7ff');
  txt(ctx, 'Temps : ' + mm + ' min ' + ss, W / 2, 490, 24, '#ffe7a6');
  txt(ctx, 'Chutes : ' + game.deaths, W / 2, 530, 24, '#ffb4b4');
  ctx.globalAlpha = 1;
  if (game.stateT > 1.2) button(ctx, 'REJOUER', W / 2, 660, 260, 78, 'new', '#ffbf2a', t);
}

// ------------------------------------------------------------------ rendu principal
R.draw = function (ctx, game, dt, joy) {
  const t = game.t;
  R.buttons = [];
  const st = game.state;
  const wi = st === 'title' ? 0 : game.level.world;
  updAmbient(dt, st === 'transition' && game.trans.t > game.trans.dur / 2 && game.levelIdx + 1 < LEVELS.length ? LEVELS[game.levelIdx + 1].world : wi, t);
  if (st === 'title') { drawTitle(ctx, game, t, game.savedLevel()); return; }

  ctx.save();
  if (game.shakeAmt > 0) ctx.translate((Math.random() - .5) * game.shakeAmt, (Math.random() - .5) * game.shakeAmt);
  let cam = 0;
  if (st === 'transition') {
    const tr = game.trans, k = ease.inOut(clamp(tr.t / tr.dur, 0, 1)); cam = k * H;
    const nwi = LEVELS[Math.min(LEVELS.length - 1, game.levelIdx + 1)].world;
    drawRoom(ctx, game, nwi, cam - H, 0, t);
    drawRoom(ctx, game, wi, cam, 1, t);
    drawAmbient(ctx);
    const p = game.player, py = lerp(DOOR.y - 20, 800, k);
    drawShadow(ctx, p.x, py + 2, 20);
    drawHero(ctx, p, game, t, py);
    ctx.restore();
    ctx.drawImage(VIGNETTE, 0, 0);
    return;
  }
  drawRoom(ctx, game, wi, 0, game.door, t);
  // décalques
  for (const d of game.decals) { const a = .5 * Math.min(1, (6 - d.t) / 2); const g = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r); g.addColorStop(0, `rgba(15,8,8,${a})`); g.addColorStop(1, 'rgba(15,8,8,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(d.x, d.y, d.r, d.r * .6, 0, 0, TAU); ctx.fill(); }
  for (const h of game.hazards) drawHazardGround(ctx, h, t);
  // ombres
  const p = game.player;
  for (const e of game.enemies) if (!e.dead) { const gy = dragonGround(e, game); const k = st === 'intro' ? clamp((e.y + e.h) / (e.baseY + e.h), .2, 1) : 1; drawShadow(ctx, e.x, e.minion ? e.y + e.h * .7 : gy, e.w * .3 * k * (1 - .05 * Math.sin(e.anim * 5.5)), .32 * k); }
  drawShadow(ctx, p.x, p.y + 2, 20);
  for (const k of game.pickups) drawShadow(ctx, k.x, k.land + 6, 12, .25);
  // cible
  if (st === 'fight' && p.target && !p.moving) drawTarget(ctx, p.target, t);
  for (const g of game.gemsArr) drawGem(ctx, g, t);
  for (const k of game.pickups) { const y = k.y - 6 + Math.sin(t * 4 + k.t) * 4; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .6; ctx.drawImage(glow('#ff4d7a'), k.x - 30, y - 30, 60, 60); ctx.restore(); heart(ctx, k.x, y, 26, '#ff3b55'); }
  // entités triées par profondeur
  const ents = game.enemies.filter(e => !e.dead).map(e => ({ y: e.minion ? e.y + e.h * .5 : dragonGround(e, game) - 30, f: () => drawDragon(ctx, e, game, t) }));
  if (st !== 'dead' || game.stateT < .3) ents.push({ y: p.y, f: () => drawHero(ctx, p, game, t) });
  ents.sort((a, b) => a.y - b.y).forEach(o => o.f());
  for (const a of game.arrows) drawArrow(ctx, a);
  drawParts(ctx, game.parts, false);
  for (const b of game.bullets) drawBullet(ctx, b, t);
  for (const h of game.hazards) drawHazardAir(ctx, h, t);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; drawParts(ctx, game.parts, true); ctx.restore();
  drawAmbient(ctx);
  // nombres
  for (const tx of game.texts) {
    const k = tx.t, s = k < .12 ? .6 + k / .12 * .6 : 1.2 - Math.min(.2, (k - .12));
    ctx.globalAlpha = k > .6 ? 1 - (k - .6) / .3 : 1;
    ctx.save(); ctx.translate(tx.x, tx.y); ctx.scale(s, s); txt(ctx, tx.str, 0, 0, tx.size, tx.col, 'center', '#1a0a14', 5); ctx.restore();
  }
  ctx.globalAlpha = 1;
  // flèche vers la porte
  if ((st === 'walk' || st === 'open') && game.door > .5) {
    const by = 190 + Math.sin(t * 6) * 8;
    ctx.save(); ctx.translate(DOOR.x, by); ctx.fillStyle = '#ffd34a'; ctx.strokeStyle = '#2a1206'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(20, 4); ctx.lineTo(8, 4); ctx.lineTo(8, 18); ctx.lineTo(-8, 18); ctx.lineTo(-8, 4); ctx.lineTo(-20, 4); ctx.closePath(); ctx.stroke(); ctx.fill(); ctx.restore();
  }
  ctx.restore(); // fin du tremblement

  ctx.drawImage(VIGNETTE, 0, 0);
  if (game.hurtFlash > 0) { ctx.fillStyle = `rgba(255,0,30,${game.hurtFlash * .35})`; ctx.fillRect(0, 0, W, H); }
  if (game.level.world === 2) { ctx.fillStyle = 'rgba(255,90,20,.05)'; ctx.fillRect(0, 0, W, H); }
  drawHUD(ctx, game, t);
  if (game.banner && st === 'intro') drawBanner(ctx, game.banner);
  // tuto
  if (game.levelIdx === 0 && game.deaths === 0 && st === 'fight' && game.stateT < 14) {
    if (p.moving) R.tutoMoved = true;
    const msg = !R.tutoMoved ? 'Glisse ton doigt pour bouger' : 'Arrête-toi pour tirer !';
    if (!(R.tutoMoved && game.stateT > 10)) { ctx.globalAlpha = .75 + .25 * Math.sin(t * 5); txt(ctx, msg, W / 2, 640, 26, '#ffffff', 'center', '#1a0a20', 6); ctx.globalAlpha = 1; }
  }
  if (st === 'victory' || st === 'loot') {
    const k = game.stateT + (st === 'loot' ? 1.2 : 0);
    const s = ease.back(clamp(k / .5, 0, 1)), a = 1 - clamp((k - 2.2) / .4, 0, 1);
    if (a > 0) {
      ctx.save(); ctx.globalAlpha = a; ctx.translate(W / 2, 450);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.rotate(t * .5); for (let i = 0; i < 10; i++) { ctx.rotate(TAU / 10); ctx.fillStyle = 'rgba(255,210,80,.13)'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-30, -260); ctx.lineTo(30, -260); ctx.closePath(); ctx.fill(); } ctx.restore();
      ctx.scale(s, s); txt(ctx, 'VICTOIRE !', 0, 0, 66, '#ffd84a', 'center', '#2a0c04', 13); ctx.restore();
    }
  }
  if (st === 'upgrade') drawCards(ctx, game, t);
  if (st === 'walk' && game.stateT > 4 && Math.hypot(p.x - DOOR.x, p.y - A.t) > 150) txt(ctx, 'Monte vers la porte !', W / 2, 250, 22, '#ffe7a6', 'center', '#1a0a20', 5);
  if (st === 'dead') drawDead(ctx, game, t);
  if (st === 'end') drawEnd(ctx, game, t, dt);
  // joystick
  if (joy && joy.active) {
    ctx.globalAlpha = .28; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(joy.bx, joy.by, 58, 0, TAU); ctx.fill();
    ctx.globalAlpha = .55; ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
    ctx.globalAlpha = .75; ctx.beginPath(); ctx.arc(joy.bx + joy.dx * 58, joy.by + joy.dy * 58, 26, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (game.paused) {
    R.buttons = [];
    ctx.fillStyle = 'rgba(6,4,14,.72)'; ctx.fillRect(0, 0, W, H);
    txt(ctx, 'PAUSE', W / 2, 360, 70, '#ffffff', 'center', '#1a0a20', 12);
    button(ctx, 'REPRENDRE', W / 2, 500, 270, 78, 'resume', '#ffbf2a', t);
    button(ctx, 'MENU', W / 2, 610, 200, 62, 'menu', '#4fb0ff', t + 1, true);
  }
};
R.bars = function (ctx, game, top, bottom) {
  const wi = game.state === 'title' ? 0 : game.level.world, room = ROOMS[WORLDS[wi].floor]; if (!room) return;
  for (let y = -44; y > -top - 44; y -= 44) for (let x = 0; x < W; x += 108) ctx.drawImage(room, 0, 44, 108, 44, x, y, 108, 44);
  let g = ctx.createLinearGradient(0, -top, 0, 0); g.addColorStop(0, 'rgba(5,4,10,.95)'); g.addColorStop(1, 'rgba(5,4,10,.55)');
  ctx.fillStyle = g; ctx.fillRect(0, -top, W, top);
  ctx.drawImage(room, 0, H - 100, W, 100, 0, H, W, Math.max(100, bottom));
  g = ctx.createLinearGradient(0, H, 0, H + bottom); g.addColorStop(0, 'rgba(5,4,10,.6)'); g.addColorStop(1, 'rgba(5,4,10,.95)');
  ctx.fillStyle = g; ctx.fillRect(0, H, W, bottom);
};
window.DR = R;
})();
