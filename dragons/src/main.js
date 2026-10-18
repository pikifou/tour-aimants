// ===== Chasseur de Dragons : son, contrôles, boucle =====
(function () {
'use strict';
const { W, H, Game } = DG;

// ------------------------------------------------------------------ son (synthétisé)
const Snd = {
  ctx: null, out: null, muted: false, last: {}, music: null,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    this.ctx = new AC(); this.out = this.ctx.createGain(); this.out.gain.value = this.muted ? 0 : .8;
    const comp = this.ctx.createDynamicsCompressor(); this.out.connect(comp); comp.connect(this.ctx.destination);
    const len = this.ctx.sampleRate; this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.startMusic();
  },
  setMuted(m) { this.muted = m; if (this.out) this.out.gain.value = m ? 0 : .8; try { localStorage.setItem('dragon-mute', m ? '1' : ''); } catch (e) {} },
  tone(type, f0, f1, dur, vol, when = 0, dest) {
    const c = this.ctx, t = c.currentTime + when, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .008); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g); g.connect(dest || this.out); o.start(t); o.stop(t + dur + .05);
  },
  noiseHit(dur, vol, type, f0, f1, when = 0, q = 1) {
    const c = this.ctx, t = c.currentTime + when, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; s.playbackRate.value = 1; f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.out); s.start(t, Math.random() * .5); s.stop(t + dur + .05);
  },
  play(name) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime, gap = { hit: .045, crit: .05, gem: .04, spit: .06, fire: .08, shoot: .05, pop: .08, warn: .12, tell: .2 }[name] || 0;
    if (gap && this.last[name] && now - this.last[name] < gap) return; this.last[name] = now;
    switch (name) {
      case 'shoot': this.noiseHit(.09, .18, 'bandpass', 3200, 900, 0, 2); this.tone('triangle', 900, 260, .08, .07); break;
      case 'hit': this.tone('square', 220, 90, .06, .05); this.noiseHit(.04, .12, 'highpass', 3000, 2000); break;
      case 'crit': this.tone('square', 520, 140, .09, .07); this.noiseHit(.07, .2, 'highpass', 4000, 2000); break;
      case 'spit': this.noiseHit(.12, .1, 'lowpass', 1800, 400); break;
      case 'fire': this.noiseHit(.22, .16, 'lowpass', 1400, 250); this.tone('sawtooth', 160, 70, .2, .04); break;
      case 'breath': this.noiseHit(1.6, .2, 'lowpass', 900, 300, 0, .7); break;
      case 'tell': this.tone('sine', 300, 600, .25, .05); break;
      case 'warn': this.tone('square', 880, 880, .07, .03); break;
      case 'charge': this.tone('sawtooth', 200, 1200, .6, .04); break;
      case 'zap': this.noiseHit(.3, .35, 'highpass', 5000, 1500); this.tone('square', 1200, 100, .25, .06); break;
      case 'whoosh': this.noiseHit(.45, .22, 'bandpass', 400, 2400, 0, 1.5); break;
      case 'roar': case 'roarS': {
        const L = name === 'roar' ? 1 : .55, c = this.ctx, t = c.currentTime, f = c.createBiquadFilter(), g = c.createGain();
        f.type = 'lowpass'; f.frequency.value = 900; g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.3, t + .08); g.gain.exponentialRampToValueAtTime(.0001, t + L);
        for (const fr of [92, 138, 69]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(fr * 1.3, t); o.frequency.exponentialRampToValueAtTime(fr * .8, t + L); const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 23; lg.gain.value = fr * .12; lfo.connect(lg); lg.connect(o.frequency); o.connect(f); o.start(t); lfo.start(t); o.stop(t + L + .05); lfo.stop(t + L + .05); }
        f.connect(g); g.connect(this.out); this.noiseHit(L, .18, 'bandpass', 700, 300, 0, .8); break;
      }
      case 'boom': this.noiseHit(.8, .5, 'lowpass', 900, 60); this.tone('sine', 110, 30, .6, .35); break;
      case 'pop': this.noiseHit(.25, .25, 'lowpass', 1500, 100); this.tone('sine', 200, 50, .2, .15); break;
      case 'hurt': this.tone('square', 440, 110, .25, .1); this.noiseHit(.2, .25, 'bandpass', 1200, 300); break;
      case 'lose': [392, 330, 262, 196].forEach((f, i) => this.tone('triangle', f, f, .3, .12, i * .18)); break;
      case 'gem': this.tone('sine', 1320 + Math.random() * 400, 1320, .08, .05); this.tone('sine', 1980, 1980, .1, .03, .04); break;
      case 'heal': [660, 880, 1320].forEach((f, i) => this.tone('sine', f, f, .2, .08, i * .07)); break;
      case 'shield': this.tone('sine', 1500, 900, .4, .08); this.tone('sine', 2200, 1500, .3, .04, .03); break;
      case 'up': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone('triangle', f, f, .22, .1, i * .07)); break;
      case 'cards': [392, 523, 659].forEach((f, i) => this.tone('triangle', f, f, .18, .07, i * .09)); break;
      case 'door': this.noiseHit(1.1, .3, 'lowpass', 300, 80); this.tone('square', 60, 50, 1, .05); break;
      case 'fanfare': [523, 523, 523, 659, 784, 659, 784, 1047].forEach((f, i) => this.tone('square', f, f, i === 7 ? .8 : .16, .07, [0, .15, .3, .45, .75, .9, 1.05, 1.2][i])); break;
    }
  },
  // petite boucle musicale (la mineur), plus intense en combat
  startMusic() {
    const c = this.ctx, bus = c.createGain(); bus.gain.value = .5; bus.connect(this.out); this.musicBus = bus;
    const step = 60 / 132 / 4; let next = c.currentTime + .1, i = 0;
    const bass = [45, 45, 57, 45, 48, 48, 60, 48, 43, 43, 55, 43, 40, 40, 52, 47];
    const lead = [69, 0, 72, 0, 76, 0, 74, 72, 67, 0, 71, 0, 74, 0, 72, 71, 69, 0, 72, 76, 81, 0, 79, 76, 74, 0, 72, 0, 71, 0, 0, 0];
    const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
    const tick = () => {
      if (!this.ctx) return;
      while (next < c.currentTime + .15) {
        const when = next - c.currentTime, fight = this.intensity || 0;
        if (!this.muted && fight > 0) {
          const b = bass[Math.floor(i / 2) % 16];
          if (i % 2 === 0) this.tone('triangle', mtof(b), mtof(b), step * 1.8, .11 * fight, when, bus);
          if (fight > .5) {
            if (i % 8 === 0 || i % 16 === 10) { this.tone('sine', 140, 40, .18, .35, when, bus); }
            if (i % 8 === 4) this.noiseHit(.12, .12, 'highpass', 1800, 900, when);
            if (i % 2 === 1) this.noiseHit(.03, .035, 'highpass', 7000, 6000, when);
            const l = lead[i % 32]; if (l && i % 64 >= 32) this.tone('square', mtof(l), mtof(l), step * 1.6, .025, when, bus);
          }
        }
        next += step; i++;
      }
    };
    setInterval(tick, 40);
  },
};

// ------------------------------------------------------------------ sauvegarde
const store = {
  get() { try { return JSON.parse(localStorage.getItem('dragon-save') || 'null'); } catch (e) { return null; } },
  set(v) { try { if (v) localStorage.setItem('dragon-save', JSON.stringify(v)); else localStorage.removeItem('dragon-save'); } catch (e) {} },
};

// ------------------------------------------------------------------ canvas & boucle
const cv = document.getElementById('c'), ctx = cv.getContext('2d');
let scale = 1, offX = 0, offY = 0, dpr = 1;
function resize() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  const rc = cv.getBoundingClientRect(), vw = rc.width || window.innerWidth, vh = rc.height || window.innerHeight;
  cv.width = Math.round(vw * dpr); cv.height = Math.round(vh * dpr);
  scale = Math.min(vw / W, vh / H); offX = (vw - W * scale) / 2; offY = (vh - H * scale) / 2;
}
window.addEventListener('resize', resize); resize();

const game = new Game({ sfx: n => Snd.play(n), store });
window.__game = game;
try { Snd.muted = localStorage.getItem('dragon-mute') === '1'; } catch (e) {}
DR.muted = Snd.muted;

// ---- contrôles
const joy = { active: false, id: null, bx: 0, by: 0, dx: 0, dy: 0 };
const keys = {};
function toLogic(e) { const rc = cv.getBoundingClientRect(); return { x: (e.clientX - rc.left - offX) / scale, y: (e.clientY - rc.top - offY) / scale }; }
// ---- appli : installation, plein écran, bouton retour, écran allumé
const PWA = !!window.PWA;
const STANDALONE = (window.matchMedia && (matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches)) || navigator.standalone === true;
const IOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let installPrompt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; });
window.addEventListener('appinstalled', () => { installPrompt = null; });
DR.installMode = () => STANDALONE || !PWA ? null : installPrompt ? 'prompt' : IOS ? 'ios' : null;
async function install() { if (!installPrompt) return; try { installPrompt.prompt(); await installPrompt.userChoice; } catch (e) {} installPrompt = null; }
function goFullscreen() {
  if (!PWA || STANDALONE || IOS) return;
  const d = document.documentElement, f = d.requestFullscreen || d.webkitRequestFullscreen;
  if (f && !document.fullscreenElement && !document.webkitFullscreenElement) { try { const p = f.call(d, { navigationUI: 'hide' }); if (p && p.catch) p.catch(() => {}); } catch (e) {} }
  try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('portrait').catch(() => {}); } catch (e) {}
}
let wake = null;
async function keepAwake() { try { if (navigator.wakeLock && !wake) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); } } catch (e) {} }
document.addEventListener('visibilitychange', () => { if (!document.hidden && game.state !== 'title') keepAwake(); });
function enterGame() { goFullscreen(); keepAwake(); try { history.pushState({ g: 1 }, ''); } catch (e) {} }
window.addEventListener('popstate', () => {
  if (game.state === 'title') return;
  if (game.paused) { game.paused = false; game.state = 'title'; return; }
  game.paused = true; try { history.pushState({ g: 1 }, ''); } catch (e) {}
});
if (PWA && 'serviceWorker' in navigator && location.protocol === 'https:') window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}); });

function act(a) {
  if (a === 'mute') { Snd.setMuted(!Snd.muted); DR.muted = Snd.muted; return; }
  if (a === 'pause') { game.paused = true; return; }
  if (a === 'resume') { game.paused = false; return; }
  if (a === 'menu') { game.paused = false; game.state = 'title'; try { history.back(); } catch (e) {} return; }
  if (a === 'install') { install(); return; }
  if (a === 'new') { DR.tutoMoved = false; if (game.state === 'title') enterGame(); game.startNew(); return; }
  if (a === 'continue') { enterGame(); game.continueGame(); return; }
  if (a === 'retry') { game.retry(); return; }
  if (a.startsWith('card')) { game.chooseUpgrade(+a.slice(4)); return; }
}
cv.addEventListener('pointerdown', e => {
  e.preventDefault(); Snd.init();
  const p = toLogic(e);
  for (const b of DR.buttons) if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) { act(b.action); return; }
  if (game.paused) return;
  if (!joy.active) { joy.active = true; joy.id = e.pointerId; joy.bx = p.x; joy.by = p.y; joy.dx = joy.dy = 0; try { cv.setPointerCapture(e.pointerId); } catch (er) {} }
});
cv.addEventListener('pointermove', e => {
  if (!joy.active || e.pointerId !== joy.id) return;
  const p = toLogic(e); let dx = (p.x - joy.bx) / 58, dy = (p.y - joy.by) / 58; const m = Math.hypot(dx, dy);
  if (m > 1) { joy.bx += (p.x - joy.bx) * (1 - 1 / m); joy.by += (p.y - joy.by) * (1 - 1 / m); dx /= m; dy /= m; }
  joy.dx = dx; joy.dy = dy;
});
const end = e => { if (e.pointerId === joy.id) { joy.active = false; joy.dx = joy.dy = 0; joy.id = null; } };
cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
window.addEventListener('keydown', e => {
  keys[e.key.toLowerCase()] = true; Snd.init();
  if (e.key === 'Enter' || e.key === ' ') {
    if (game.state === 'title') act(game.savedLevel() ? 'continue' : 'new');
    else if (game.state === 'dead' && game.stateT > 1.2) act('retry');
    else if (game.state === 'end' && game.stateT > 1.2) act('new');
  }
  if (game.state === 'upgrade' && ['1', '2', '3'].includes(e.key)) act('card' + (+e.key - 1));
  if (e.key.toLowerCase() === 'm') act('mute');
  if (e.key === 'Escape' || e.key.toLowerCase() === 'p') { if (game.paused) act('resume'); else if (game.state !== 'title') act('pause'); }
});
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
document.addEventListener('visibilitychange', () => { if (document.hidden && ['fight', 'intro', 'walk'].includes(game.state)) game.paused = true; });
function input() {
  let x = 0, y = 0;
  if (keys.arrowleft || keys.a || keys.q) x -= 1; if (keys.arrowright || keys.d) x += 1;
  if (keys.arrowup || keys.w || keys.z) y -= 1; if (keys.arrowdown || keys.s) y += 1;
  if (x || y) return { x, y };
  if (joy.active) return { x: joy.dx, y: joy.dy };
  return { x: 0, y: 0 };
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  game.update(dt, input());
  Snd.intensity = ['fight', 'intro'].includes(game.state) ? 1 : ['walk', 'open', 'upgrade', 'victory', 'loot'].includes(game.state) ? .4 : 0;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#07050c'; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, offX * dpr, offY * dpr);
  if (offY > 1) DR.bars(ctx, game, offY / scale, offY / scale);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
  DR.draw(ctx, game, dt, joy);
  ctx.restore();
  requestAnimationFrame(frame);
}
const start = () => DR.load(window.ASSETS, () => { document.getElementById('load').style.display = 'none'; requestAnimationFrame(t => { last = t; frame(t); }); });
if (document.fonts && document.fonts.load) Promise.race([document.fonts.load('40px "Luckiest Guy"'), new Promise(r => setTimeout(r, 2500))]).then(start, start); else start();
})();
