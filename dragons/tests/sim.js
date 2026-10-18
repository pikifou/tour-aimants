// Simulation : un robot qui esquive joue les 10 salles. Mesure le temps et les coups reçus.
const D = require('../src/core.js');
const { Game, A, DOOR, LEVELS } = D;
const PRIO0 = (process.env.PRIO || 'multi,rate,dmg,heart,diag,dmg,crit,rate,burn,shield,speed').split(',');
const SKILL = +(process.env.SKILL || 1);   // 1 = bon robot, 0.5 = réagit moins bien
function bot(g, t) {
  const p = g.player;
  const dirs = [[0, 0]]; for (let i = 0; i < 16; i++) dirs.push([Math.cos(i * Math.PI / 8), Math.sin(i * Math.PI / 8)]);
  let best = null, bs = -1e9;
  const Hz = .45 * SKILL + .12;
  for (const [dx, dy] of dirs) {
    let minc = 99;
    for (let k = 1; k <= 10; k++) {
      const tt = Hz * k / 10;
      const px = Math.max(A.l + 14, Math.min(A.r - 14, p.x + dx * p.speed * tt)), py = Math.max(A.t + 18, Math.min(A.b - 6, p.y + dy * p.speed * tt)) - 16;
      for (const b of g.bullets) {
        const bx = b.x + b.vx * tt, by = b.y + b.vy * tt, r = (b.kind === 'flame' ? (9 + (b.t + tt) * 16) * .45 : b.r * .8) + p.r;
        const c = Math.hypot(bx - px, by - py) - r; if (c < minc) minc = c;
      }
      for (const h of g.hazards) {
        if (h.kind === 'meteor') { const te = h.warn - h.t; if (te <= tt + .05) { const c = Math.hypot(h.x - px, h.y - py - 6) - h.R - p.r; if (c < minc) minc = c; } }
        if (h.kind === 'bolt') { const ts = h.warn - h.t, tend = ts + h.dur; if (tt >= ts - .1 && tt <= tend) { const ca = Math.cos(h.a), sa = Math.sin(h.a), rx = px - h.x, ry = py - h.y; if (rx * ca + ry * sa > 0) { const c = Math.abs(-rx * sa + ry * ca) - h.w - p.r; if (c < minc) minc = c; } } }
        if (h.kind === 'lane') { const dxl = h.x1 - h.x0, dyl = h.y1 - h.y0, L = Math.hypot(dxl, dyl) || 1, ux = dxl / L, uy = dyl / L, rx = px - h.x0, ry = py - h.y0, al = rx * ux + ry * uy; if (al > -40 && al < L + 60) { const c = Math.abs(-rx * uy + ry * ux) - h.w / 2 - p.r - 20; if (c < minc) minc = c; } }
      }
      for (const e of g.enemies) { if (e.dead || e.dying) continue; const rx = e.w * e.type.body[0] + p.r + 12, ry = e.h * e.type.body[1] + p.r + 12; const ex = e.x + (e.dash ? (e.dash.tx - e.x) * Math.min(1, tt * 3) : 0), ey = e.y + (e.dash ? (e.dash.ty - e.y) * Math.min(1, tt * 3) : 0); const v = Math.hypot((px - ex) / rx, (py - ey) / ry); const c = (v - 1) * 40; if (c < minc) minc = c; }
    }
    let s = Math.min(minc, 30) * 3;
    if (dx === 0 && dy === 0) s += 12;
    s -= Math.abs((p.y + dy * 20) - 720) * .03 + Math.abs((p.x + dx * 20) - 270) * .02;
    if (s > bs) { bs = s; best = [dx, dy]; }
  }
  return { x: best[0], y: best[1] };
}
function run(seed) {
  const PRIO = PRIO0.slice(); let dec = { x: 0, y: 0 }, decT = 0;
  const g = new Game({ headless: true, seed });
  g.godMode = true; g.startNew();
  const res = []; let t = 0, lvT = 0, lvHits = 0, cur = 0, guard = 0;
  while (g.state !== 'end' && guard++ < 60 * 60 * 40) {
    let inp = { x: 0, y: 0 };
    if (g.state === 'fight' || g.state === 'intro') { decT -= 1 / 60; if (decT <= 0) { dec = bot(g, t); decT = SKILL >= 1 ? 0 : (1 - SKILL) * .5; if (Math.random() < (1 - SKILL) * .25) dec = { x: Math.random() * 2 - 1, y: Math.random() * 2 - 1 }; } inp = dec; }
    if (g.state === 'upgrade' && g.cards && g.cards.picked == null) {
      const ids = g.cards.list.map(c => c.id); let pick = 0, bi = 99;
      ids.forEach((id, i) => { const k = PRIO.indexOf(id); const kk = k < 0 ? 50 : k; if (kk < bi) { bi = kk; pick = i; } });
      const k = PRIO.indexOf(ids[pick]); if (k >= 0) PRIO.splice(k, 1);
      g.chooseUpgrade(pick);
    }
    if (g.state === 'walk') { const p = g.player; inp = { x: Math.sign(DOOR.x - p.x) * Math.min(1, Math.abs(DOOR.x - p.x) / 20), y: -1 }; }
    g.update(1 / 60, inp); t += 1 / 60;
    if (g.state === 'fight') lvT += 1 / 60;
    if (g.levelIdx !== cur || g.state === 'end') {
      res.push({ lv: cur + 1, time: +lvT.toFixed(1), hits: g.player.hits - lvHits });
      lvHits = g.player.hits; lvT = 0; cur = g.levelIdx;
    }
  }
  return { res, ups: g.ups };
}
const seeds = (process.env.SEEDS || '1,2,3').split(',').map(Number);
const all = seeds.map(run);
for (let i = 0; i < LEVELS.length; i++) {
  const r = all.map(a => a.res[i]).filter(Boolean);
  console.log(String(i + 1).padStart(2), LEVELS[i].name.padEnd(14), 'temps', r.map(x => String(x.time).padStart(5)).join(' '), ' | coups', r.map(x => x.hits).join(' '));
}
console.log(JSON.stringify(all[0].ups));
