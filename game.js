/* Rendu canvas, interface, enchaînement des écrans, démos et juice. */
(function () {
  'use strict';
  const { World, Replay, W, H } = window.Engine;
  const FLOORS = window.FLOORS;
  const { CARDS, INTRO } = window.CARDS_DATA;
  const $ = (s) => document.querySelector(s);
  const fr = (t) => t.replace(/ ([!?:;])/g, ' $1');
  const TOTAL = FLOORS.length;
  const IMG = {};
  const ASSETS = ['armure', 'armure_tas', 'epouvantail', 'epee', 'sorciere', 'sorciere_balai', 'sorciere_vol', 'chat_cage', 'chat_saute', 'chat_assis', 'magnetite', 'heros'];
  const HERO = { h: 195, handX: 0.905, handY: 0.02 };   // taille à l'écran, et position de la main levée dans l'image (fractions)
  const STEPS = FLOORS.STEPS;
  const REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- progression ----------
  const KEY = 'tour-aimants-v2';
  let progress = { floor: 1, room: 0, done: [] };
  try { const p = JSON.parse(localStorage.getItem(KEY) || 'null'); if (p && p.floor) progress = Object.assign({ room: 0, done: [] }, p); } catch (e) { /* stockage indisponible */ }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(progress)); } catch (e) { /* ignore */ } }

  // ---------- audio ----------
  let actx = null;
  function ac() { try { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); return actx; } catch (e) { return null; } }
  function tone(freq, dur, type = 'square', vol = 0.08, slide = 0, delay = 0) {
    const a = ac(); if (!a) return;
    try {
      const o = a.createOscillator(), g = a.createGain(); const t0 = a.currentTime + delay;
      o.type = type; o.frequency.setValueAtTime(freq, t0);
      if (slide) o.frequency.linearRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
      g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(a.destination); o.start(t0); o.stop(t0 + dur);
    } catch (e) { /* audio indisponible */ }
  }
  let noiseBuf = null;
  function noise(dur, vol = 0.06, freq = 800, delay = 0) {
    const a = ac(); if (!a) return;
    try {
      if (!noiseBuf) { noiseBuf = a.createBuffer(1, a.sampleRate, a.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
      const src = a.createBufferSource(); src.buffer = noiseBuf;
      const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8;
      const g = a.createGain(); const t0 = a.currentTime + delay;
      g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(f); f.connect(g); g.connect(a.destination); src.start(t0); src.stop(t0 + dur);
    } catch (e) { /* ignore */ }
  }
  const SFX = {
    attach: () => { tone(880, 0.07, 'square', 0.05); tone(1320, 0.07, 'square', 0.04, 0, 0.05); },
    detach: () => tone(440, 0.12, 'triangle', 0.05, -200),
    captured: () => { tone(600, 0.45, 'sawtooth', 0.06, -480); noise(0.3, 0.05, 400, 0.3); },
    ko: () => { tone(140, 0.25, 'square', 0.09, -80); noise(0.25, 0.08, 300); },
    button: () => { tone(520, 0.1, 'square', 0.06); tone(780, 0.12, 'square', 0.05, 0, 0.09); },
    latch: () => { tone(300, 0.06, 'square', 0.08); tone(220, 0.1, 'square', 0.07, 0, 0.06); },
    land: () => noise(0.12, 0.05, 250),
    secret: () => { tone(300, 0.3, 'sawtooth', 0.06, 200); noise(0.5, 0.06, 200); },
    win: () => { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, 'triangle', 0.1, 0, i * 0.12)); noise(0.6, 0.04, 2000, 0.3); },
    room: () => { tone(659, 0.12, 'triangle', 0.08); tone(880, 0.2, 'triangle', 0.08, 0, 0.12); },
    whoosh: () => noise(1.2, 0.08, 600),
    flip: () => tone(700, 0.06, 'triangle', 0.05),
    turn: (n) => tone(500 + n * 60, 0.08, 'triangle', 0.05),
    on: (on) => tone(on ? 900 : 300, 0.12, 'square', 0.06),
    bell: () => { [0, 0.35, 0.7].forEach((d) => { tone(1568, 0.5, 'triangle', 0.09, 0, d); tone(2093, 0.4, 'sine', 0.05, 0, d); }); },
    reveal: () => { [880, 1175, 1568].forEach((f, i) => tone(f, 0.18, 'triangle', 0.07, 0, i * 0.08)); },
    meow: () => { tone(700, 0.18, 'sine', 0.09, 200); tone(900, 0.25, 'sine', 0.09, -300, 0.18); },
  };
  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* ignore */ } }
  function speak(text, opts = {}) {
    try {
      if (!window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'fr-FR'; u.rate = opts.rate || 0.9; u.pitch = opts.pitch || 1;
      const voices = window.speechSynthesis.getVoices().filter((v) => v.lang && v.lang.startsWith('fr'));
      if (voices.length) u.voice = voices[0];
      window.speechSynthesis.speak(u);
    } catch (e) { /* synthèse vocale indisponible */ }
  }

  // ---------- écrans ----------
  const screens = ['title', 'tower', 'card', 'game', 'end'];
  let current = 'title';
  function show(name) {
    if (name !== current) pushScreen(name);
    current = name;
    for (const s of screens) { const el = $('#' + s); const was = !el.hidden; el.hidden = s !== name; if (s === name && !was) { el.classList.remove('in'); void el.offsetWidth; el.classList.add('in'); } }
    if (name !== 'game') stopLoop();
  }

  // ---------- titre ----------
  // ---------- plein écran, installation, bouton retour ----------
  const docEl = document.documentElement;
  const STANDALONE = (window.matchMedia && (window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: fullscreen)').matches)) || window.navigator.standalone === true;
  const IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const canFullscreen = !!(docEl.requestFullscreen || docEl.webkitRequestFullscreen);
  function isFullscreen() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
  function toggleFullscreen() {
    try {
      if (isFullscreen()) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
      const p = (docEl.requestFullscreen || docEl.webkitRequestFullscreen).call(docEl, { navigationUI: 'hide' });
      if (p && p.then) p.then(lockLandscape).catch(() => {});
      else lockLandscape();
    } catch (e) { /* plein écran refusé */ }
  }
  function updateFullscreenButtons() {
    const on = isFullscreen();
    for (const id of ['#btnFull', '#btnFullHud']) {
      const b = $(id); if (!b) continue;
      b.hidden = STANDALONE || !canFullscreen;
      if (id === '#btnFull') b.textContent = on ? '⛶ Quitter le plein écran' : '⛶ Plein écran';
      else b.textContent = on ? '⛶' : '⛶';
    }
    setTimeout(layout, 60);
  }
  document.addEventListener('fullscreenchange', updateFullscreenButtons);
  document.addEventListener('webkitfullscreenchange', updateFullscreenButtons);
  let installPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPrompt = e; const b = $('#btnInstall'); if (b) b.hidden = STANDALONE; });
  window.addEventListener('appinstalled', () => { installPrompt = null; $('#btnInstall').hidden = true; $('#iosHint').hidden = true; });
  async function install() {
    if (!installPrompt) return;
    try { installPrompt.prompt(); await installPrompt.userChoice; } catch (e) { /* ignore */ }
    installPrompt = null; $('#btnInstall').hidden = true;
  }
  // bouton Retour d'Android : revient à l'écran précédent au lieu de fermer l'appli
  const BACK = { title: null, tower: 'title', card: 'tower', game: 'tower', end: 'title' };
  let ignorePop = false;
  function pushScreen(name) { if (name !== 'title' && history.pushState) { try { history.pushState({ screen: name }, ''); } catch (e) { /* ignore */ } } }
  window.addEventListener('popstate', () => {
    if (ignorePop) { ignorePop = false; return; }
    const back = BACK[current];
    if (back === 'tower') { show('tower'); renderTower(); }
    else if (back === 'title') { show('title'); renderTitle(); }
  });
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost') && !/claude\.ai$|claudeusercontent\.com$/.test(location.hostname)) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}); });
  }

  function initTitle() {
    $('#intro').innerHTML = INTRO.lines.map((l, i) => `<p style="animation-delay:${0.2 + i * 0.35}s">${fr(l)}</p>`).join('');
    $('#btnFull').onclick = toggleFullscreen;
    tap($('#btnFullHud'), toggleFullscreen);
    $('#btnInstall').onclick = install;
    $('#iosHint').hidden = !(IOS && !STANDALONE && location.protocol === 'https:' && !/claude/.test(location.hostname));
    updateFullscreenButtons();
    $('#btnPlay').onclick = () => { unlockAudio(); show('tower'); renderTower(); };
    $('#btnReset').onclick = () => { progress = { floor: 1, room: 0, done: [] }; save(); renderTitle(); };
    $('#btnIntroRead').onclick = () => speak(INTRO.lines.join(' '));
    renderTitle();
  }
  function renderTitle() {
    $('#btnPlay').textContent = progress.done.length || progress.room ? `Continuer (étage ${progress.floor})` : 'Jouer';
    $('#btnReset').hidden = !(progress.done.length || progress.room);
  }
  function unlockAudio() { const a = ac(); if (a && a.resume) a.resume(); lockLandscape(); }

  // ---------- tour ----------
  function renderTower() {
    const list = $('#floors'); list.innerHTML = '';
    for (let n = TOTAL; n >= 1; n--) {
      const f = FLOORS[n - 1];
      const done = progress.done.includes(n);
      const cur = n === progress.floor;
      const locked = !done && !cur;
      const row = document.createElement('button');
      row.className = 'floor' + (done ? ' done' : '') + (cur ? ' current' : '') + (locked ? ' locked' : '');
      row.type = 'button'; row.disabled = locked;
      const dots = f.rooms.map((r, i) => `<i class="${r.kind}${(done || (cur && i < progress.room)) ? ' ok' : ''}"></i>`).join('');
      row.innerHTML = `<span class="num">${n}</span><span class="name">${locked ? '? ? ?' : f.title}<span class="dots">${dots}</span></span><span class="mark">${done ? '✓' : (cur ? '<img src="assets/chat_cage.png" alt="le chat">' : '')}</span>`;
      row.onclick = () => openCard(n);
      list.appendChild(row);
    }
    const cur = FLOORS[progress.floor - 1];
    const stepNow = cur.firstStep + Math.min(progress.room, cur.rooms.length - 1);
    $('#towerText').textContent = fr(progress.done.length ? `Marche ${stepNow} sur ${STEPS}. La sorcière est montée à l'étage ${progress.floor} avec Mei Mei !` : `${STEPS} marches jusqu'à Mei Mei. Tu es sur la première.`);
    drawStairs(stepNow);
    const roomLabel = progress.room ? ` (${roomName(cur.rooms[progress.room])})` : '';
    $('#btnClimb').textContent = `Monter à l'étage ${progress.floor}${roomLabel}`;
    $('#btnClimb').onclick = () => openCard(progress.floor);
    $('#btnHome').onclick = () => { show('title'); renderTitle(); };
    requestAnimationFrame(() => { const c = list.querySelector('.current'); if (c) c.scrollIntoView({ block: 'center' }); });
  }
  // Escalier (SVG) : en zigzag, des volées de 10 marches ; le héros sur la marche courante, la cage en haut
  function drawStairs(stepNow) {
    const el = $('#stairs'); if (!el) return;
    const per = 10, flights = Math.ceil(STEPS / per), sw = 36, rise = 9, pad = 24;
    const Wd = per * sw + pad * 2 + 70, Hd = STEPS * rise + pad * 2 + 90;
    let out = `<svg viewBox="0 0 ${Wd} ${Hd}" width="${Wd}" height="${Hd}" xmlns="http://www.w3.org/2000/svg">`;
    const pos = [];
    for (let i = 0; i < STEPS; i++) {
      const fl = Math.floor(i / per), j = i % per;
      const dir = fl % 2 === 0 ? 1 : -1;
      const x = dir === 1 ? pad + j * sw : pad + (per - 1 - j) * sw;
      const y = Hd - pad - 50 - i * rise;
      pos.push({ x, y });
      const done = i + 1 < stepNow, cur = i + 1 === stepNow;
      const floorStart = FLOORS.some((f) => f.firstStep === i + 1);
      out += `<rect x="${x}" y="${y}" width="${sw - 2}" height="${rise + 6}" rx="3" fill="${cur ? '#ffb020' : done ? '#3fbf5a' : '#5a4b7a'}" ${floorStart ? 'stroke="#fff6e6" stroke-width="2"' : 'stroke="#1b1430" stroke-width="1"'}/>`;
    }
    const p = pos[Math.min(STEPS, stepNow) - 1];
    out += `<image href="assets/heros.png" x="${p.x + 2}" y="${p.y - 54}" height="58"/>`;
    const top = pos[STEPS - 1];
    out += `<image href="assets/chat_cage.png" x="${top.x - 20 + (Math.floor((STEPS - 1) / per) % 2 === 0 ? 40 : -30)}" y="${top.y - 76}" height="76"/>`;
    out += '</svg>';
    el.innerHTML = out;
  }
  function roomName(r) {
    if (r.kind === 'atelier') return 'Atelier';
    if (r.finale) return 'La cage de Mei Mei';
    const f = FLOORS[r.n - 1]; return `Salle ${r.index + (f.rooms[0].kind === 'atelier' ? 0 : 1)}`;
  }

  // ---------- fiche ----------
  function openCard(n) {
    const c = CARDS[n - 1];
    $('#cardFloor').textContent = `Étage ${n}`;
    $('#cardTitle').textContent = c.title;
    $('#cardText').innerHTML = c.lines.map((l, i) => `<p style="animation-delay:${0.15 + i * 0.3}s">${fr(l)}</p>`).join('');
    $('#cardSvg').innerHTML = c.svg;
    $('#btnRead').onclick = () => speak(c.lines.join(' '));
    $('#btnGo').onclick = () => startRoom(n, n === progress.floor ? progress.room : 0);
    $('#btnCardBack').onclick = () => { show('tower'); renderTower(); };
    show('card');
  }

  // ---------- jeu ----------
  const canvas = $('#canvas'), ctx = canvas.getContext('2d');
  const app = $('#app');
  let world = null, room = null, floor = null, raf = 0, lastT = 0, dpr = 1;
  const L = { s: 1, rot: false, X: 0, Y: 0 };
  let shake = 0, winAt = 0, idleT = 0, hintUntil = 0, hintCount = 0, flashes = [], particles = [], fx = {}, witchFx = { t: 0, text: '' };
  let demo = null, demoMode = null, demoTimer = 0, bannerT = 0, bannerText = '', bannerSub = '', flashWhite = 0, roomClearT = 0;
  let flight = null;   // { phase: 'in'|'hover'|'out', t, from, to, cageTaken }
  let failAt = 0, meowT = 0;
  const hero = { x: 0, y: 0, face: 1, vx: 0, shown: false };

  function layout() {
    const de = document.documentElement;
    const gutter = 32;
    const iw = Math.max(200, (window.innerWidth || de.clientWidth) - gutter), ih = Math.max(200, window.innerHeight || de.clientHeight);
    const left = (window.innerWidth || de.clientWidth) - iw; // gouttières
    const rot = ih > iw;             // tablette en portrait : on tourne toute la scène
    const aw = rot ? ih : iw, ah = rot ? iw : ih;
    const s = Math.min(aw / W, ah / H);
    L.s = s; L.rot = rot;
    if (!rot) { L.X = left / 2 + (iw - W * s) / 2; L.Y = (ih - H * s) / 2; app.style.transform = `translate(${L.X}px, ${L.Y}px) scale(${s})`; }
    else { const ox = left / 2 + (iw - H * s) / 2, oy = (ih - W * s) / 2; L.X = ox + H * s; L.Y = oy; app.style.transform = `translate(${L.X}px, ${L.Y}px) rotate(90deg) scale(${s})`; }
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * s * dpr); canvas.height = Math.round(H * s * dpr);
    ctx.setTransform(s * dpr, 0, 0, s * dpr, 0, 0);
  }
  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', () => setTimeout(layout, 50));
  function lockLandscape() { try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); } catch (e) { /* ignore */ } }

  function startRoom(n, i) {
    floor = FLOORS[n - 1]; room = floor.rooms[Math.min(i, floor.rooms.length - 1)];
    resetWorld();
    $('#hudFloor').textContent = `Marche ${room.step} / ${STEPS}`;
    $('#hudTitle').textContent = `Étage ${n} · ${floor.title}`;
    renderDots();
    buildHud();
    $('#hint').hidden = true; hintCount = 0;
    show('game'); layout();
    banner(roomName(room), room.kind === 'atelier' ? 'Regarde, puis à toi.' : room.hint, 3.2);
    if (room.kind === 'atelier') startDemo('loop');
    lastT = performance.now();
    cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
  }
  function resetWorld() {
    world = new World(room);
    shake = 0; winAt = 0; idleT = 0; hintUntil = 0; flashes = []; particles = []; fx = {}; witchFx = { t: 0, text: '' }; flashWhite = 0; roomClearT = 0;
    demo = null; demoMode = null; demoTimer = 0; activePointer = null; flight = null; failAt = 0; meowT = 0;
  }
  function stopLoop() { cancelAnimationFrame(raf); raf = 0; }
  function renderDots() {
    $('#hudDots').innerHTML = floor.rooms.map((r, i) => `<i class="${r.kind}${i < room.index ? ' ok' : ''}${i === room.index ? ' now' : ''}" title="${roomName(r)}"></i>`).join('');
  }

  function buildHud() {
    const tools = $('#hudTools'); tools.innerHTML = '';
    if (world.tools.length > 1) {
      world.tools.forEach((t, i) => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'tool' + (i === world.toolIndex ? ' on' : '');
        b.innerHTML = toolIcon(t.type) + `<span>${t.label}</span>`;
        tap(b, () => { takeControl(); world.selectTool(i); buildHud(); SFX.flip(); });
        tools.appendChild(b);
      });
    }
    const t = world.tool;
    const flip = $('#btnFlip'); flip.hidden = !(room.canFlip && t && t.poles);
    flip.innerHTML = `↻ Retourner <span class="pole ${world.flipped ? 'flip' : ''}"><b>${world.flipped ? 'N' : 'S'}</b><b>${world.flipped ? 'S' : 'N'}</b></span>`;
    const on = $('#btnOn'); on.hidden = !(t && t.type === 'electro');
    on.textContent = world.electroOn ? 'ALLUMÉ' : 'ÉTEINT'; on.className = world.electroOn ? 'on' : '';
    const turn = $('#btnTurn'); turn.hidden = !(room.turnsNeeded);
    turn.innerHTML = `+ 1 tour <small>(${world.turns})</small>`;
    const fil = $('#btnFilings'); fil.hidden = !room.filingsButton;
    fil.className = world.filings ? 'on' : '';
    $('#gauge').hidden = !(t && (t.type === 'nail' || room.turnsNeeded));
    $('#btnShow').hidden = !(room.kind !== 'atelier' && hintCount >= 1);
  }
  // Boutons du jeu : réagissent dès que le doigt se pose (pointerdown), même si un autre doigt tient déjà le bonhomme.
  // Un tap tactile à deux doigts ne génère souvent pas de « click » : on ne s'appuie donc pas dessus.
  function tap(el, fn) {
    el.onpointerdown = (e) => { e.preventDefault(); e.stopPropagation(); unlockAudio(); fn(); };
    el.onclick = (e) => { if (e.detail === 0) fn(); };   // clavier (Entrée / Espace) seulement
  }
  function toolIcon(type) {
    if (type === 'bar') return '<i class="ico bar"></i>';
    if (type === 'double') return '<i class="ico bar"></i><i class="ico bar"></i>';
    if (type === 'horseshoe') return '<i class="ico hs"></i>';
    return '';
  }
  tap($('#btnFlip'), () => { takeControl(); world.flip(); buildHud(); SFX.flip(); pulseButton('#btnFlip'); });
  tap($('#btnOn'), () => { takeControl(); world.toggleElectro(); buildHud(); SFX.on(world.electroOn); pulseButton('#btnOn'); });
  tap($('#btnTurn'), () => { takeControl(); world.addTurn(); buildHud(); SFX.turn(world.turns); pulseButton('#btnTurn'); });
  tap($('#btnFilings'), () => { takeControl(); world.toggleFilings(); buildHud(); });
  tap($('#btnRestart'), () => { resetWorld(); buildHud(); if (room.kind === 'atelier') startDemo('loop'); });
  tap($('#btnHint'), () => { showHint(); hintCount++; buildHud(); });
  tap($('#btnShow'), () => { resetWorld(); buildHud(); startDemo('once'); });
  tap($('#btnTower'), () => { show('tower'); renderTower(); });
  function showHint() { $('#hintText').textContent = fr(room.hint); $('#hint').hidden = false; hintUntil = performance.now() + 7000; }
  $('#hint').onclick = () => { $('#hint').hidden = true; };
  function pulseButton(sel) { const b = $(sel); b.classList.remove('pulse'); void b.offsetWidth; b.classList.add('pulse'); }
  function banner(text, sub, dur) { bannerText = text; bannerSub = sub || ''; bannerT = dur; }

  // ---------- démo (atelier / Montre-moi) ----------
  function startDemo(mode) {
    demoMode = mode; demo = new Replay(world, room.demo); demoTimer = 0;
    if (mode === 'once') banner('Regarde…', 'Puis tu rejoues toi-même.', 2.5);
  }
  function takeControl() {
    if (!demo) return;
    demo = null; demoMode = null;
    resetWorld(); buildHud();
    banner('À toi !', room.hint, 3);
  }

  // ---------- entrées ----------
  function toLogical(e) {
    if (!L.rot) return { x: (e.clientX - L.X) / L.s, y: (e.clientY - L.Y) / L.s };
    return { x: (e.clientY - L.Y) / L.s, y: (L.X - e.clientX) / L.s };
  }
  let activePointer = null;
  const GRIP = 115;        // distance doigt → aimant (unités logiques)
  let gripOffset = GRIP;
  canvas.addEventListener('pointerdown', (e) => {
    if (!world) return;
    unlockAudio();
    if (demo) { takeControl(); }
    if (world.won) return;
    if (activePointer !== null) {
      // deuxième doigt pendant que le premier tient le bonhomme : il change l'état de l'aimant
      const t = world.tool;
      if (room.canFlip && t && t.poles) { world.flip(); buildHud(); SFX.flip(); pulseButton('#btnFlip'); }
      else if (t && t.type === 'electro') { world.toggleElectro(); buildHud(); SFX.on(world.electroOn); pulseButton('#btnOn'); }
      return;
    }
    activePointer = e.pointerId; try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    const raw = toLogical(e);
    // Le doigt se pose sur le bonhomme ; l'aimant est dans sa main, plus haut, bien visible.
    // Exception : taper un mur secret ou attraper un levier se fait là où on touche.
    const direct = world.sensors.some((s) => s.type === 'secret' && !s.done && raw.x >= s.x && raw.x <= s.x + s.w && raw.y >= s.y && raw.y <= s.y + s.h)
      || world.bodies.some((b) => b.grab && !b.hidden && raw.x >= b.x - 25 && raw.x <= b.x + b.w + 25 && raw.y >= b.y - 25 && raw.y <= b.y + b.h + 25);
    gripOffset = direct ? 0 : GRIP;
    const p = { x: raw.x, y: raw.y - gripOffset };
    world.pointerDown(p.x, p.y); idleT = 0;
    spawnRing(p.x, p.y, 'rgba(255,230,140,0.9)', 30);
  });
  canvas.addEventListener('pointermove', (e) => { if (!world || e.pointerId !== activePointer) return; const p = toLogical(e); world.pointerMove(p.x, p.y - gripOffset); });
  const up = (e) => { if (!world || e.pointerId !== activePointer) return; activePointer = null; world.pointerUp(); };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);

  // ---------- boucle ----------
  function loop(t) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(1 / 30, (t - lastT) / 1000); lastT = t;
    if (demo) {
      demo.step(dt);
      if (demo.done) { demoTimer += dt; if (demoTimer > (world.won ? 1.6 : 1.0)) { if (demoMode === 'loop') { resetWorld(); buildHud(); startDemo('loop'); } else { takeControl(); } } }
    }
    // la physique continue après la victoire (le dernier chevalier finit de tomber dans son trou), mais l'aimant est lâché
    if (world.won && activePointer !== null) { activePointer = null; world.pointerUp(); }
    world.step(dt); if (!demo && !world.won) idleT += dt;
    for (const ev of world.drainEvents()) onEvent(ev);
    if (!demo && idleT > (room.kind === 'atelier' ? 14 : 30) && $('#hint').hidden && !world.won) {
      if (room.kind === 'atelier') { resetWorld(); buildHud(); startDemo('loop'); banner('Regarde encore', '', 2); }
      else { showHint(); hintCount++; buildHud(); }
      idleT = -1e9;
    }
    if (hintUntil && t > hintUntil) { $('#hint').hidden = true; hintUntil = 0; }
    if (shake > 0) shake -= dt;
    if (bannerT > 0) bannerT -= dt;
    updateHero(dt);
    if (flashWhite > 0) flashWhite -= dt;
    if (witchFx.t > 0) witchFx.t -= dt;
    for (const k in fx) { fx[k].sq *= Math.exp(-7 * dt); fx[k].pop *= Math.exp(-6 * dt); }
    updateParticles(dt);
    updateGauge();
    if (world.won && !winAt && !demo) { winAt = t; shake = 0.4; flashWhite = 0.25; confetti(); if (room.index < floor.rooms.length - 1) banner(room.kind === 'atelier' ? 'Atelier réussi !' : 'Salle réussie !', '', 1.4); }
    if (winAt > 0 && t - winAt > 1500) { winAt = -1; onWin(); }
    if (world.failed && !failAt) { failAt = t; shake = 0.5; banner('Ding ding !', 'Le garde a sonné la cloche. On recommence la salle.', 2); SFX.bell(); buzz([80, 60, 80]); }
    if (failAt && t - failAt > 2000) { const wasDemo = !!demo; resetWorld(); buildHud(); if (wasDemo || room.kind === 'atelier') startDemo('loop'); }
    if (meowT > 0) meowT -= dt;
    if (flight) updateFlight(dt);
    draw(t / 1000, dt);
  }
  function updateHero(dt) {
    const f = world.finger;
    if (!f.down) { hero.shown = false; return; }
    if (!hero.shown) { hero.x = f.x; hero.y = f.y; hero.shown = true; hero.vx = 0; }
    // le corps suit la main avec un peu de retard, pour un balancement naturel
    const k = 1 - Math.exp(-14 * dt);
    hero.vx = (f.x - hero.x) / Math.max(dt, 1e-3);
    hero.x += (f.x - hero.x) * k; hero.y += (f.y - hero.y) * k;
    if (hero.vx > 60) hero.face = 1; else if (hero.vx < -60) hero.face = -1;
  }
  function drawHero(x, y, time) {
    const img = IMG.heros; if (!img) return;
    const h = HERO.h, w = img.width * h / img.height;
    const lean = Math.max(-0.25, Math.min(0.25, -hero.vx / 2500));
    const bob = Math.sin(time * 3) * 3;
    ctx.save();
    ctx.translate(x, y);                       // la main levée est sur le doigt
    ctx.rotate(lean);
    ctx.scale(hero.face, 1);
    ctx.drawImage(img, -w * HERO.handX, -h * HERO.handY + bob + 8, w, h);
    ctx.restore();
  }
  function updateGauge() {
    const g = $('#gauge'); if (g.hidden) return;
    const t = world.tool;
    if (t && t.type === 'nail') { const k = Math.round(world.nailCharge * 5); g.textContent = 'Aimantation ' + '▮'.repeat(k) + '▯'.repeat(5 - k); }
    else if (room.turnsNeeded) { const k = Math.min(5, Math.round(world.turns / room.turnsNeeded * 4)); g.textContent = 'Force ' + '▮'.repeat(k) + '▯'.repeat(5 - k); }
  }
  function onEvent(ev) {
    const b = ev.id && world.body(ev.id);
    const c = b ? { x: b.x + b.w / 2, y: b.y + b.h / 2 } : null;
    switch (ev.type) {
      case 'attach': SFX.attach(); if (!demo) buzz(12); if (b) { fxOf(b.id).pop = 0.25; spawnBurst(c.x, b.y, 10, '#ffe066', 220); } break;
      case 'detach': SFX.detach(); break;
      case 'captured': SFX.captured(); if (!demo) buzz(40); shake = Math.max(shake, 0.25); if (b) { flashes.push({ x: c.x, y: b.y + b.h, t: 0.7, text: 'Hop !' }); spawnSmoke(c.x, b.y + b.h, 14); } witchReact('Hé !'); break;
      case 'ko': SFX.ko(); if (!demo) buzz(60); shake = Math.max(shake, 0.35); if (b) { flashes.push({ x: c.x, y: b.y - 10, t: 0.9, text: 'Boum !' }); fxOf(b.id).stars = 1.4; spawnSmoke(c.x, b.y + b.h, 18); } witchReact('Oh non !'); break;
      case 'land': SFX.land(); if (b) { fxOf(b.id).sq = Math.min(1, ev.v / 900); spawnSmoke(c.x, b.y + b.h, 6, 0.6); if (b.kind === 'knight') shake = Math.max(shake, 0.12); } break;
      case 'button': case 'open': SFX.button(); spawnRing(c ? c.x : W / 2, c ? c.y : H / 2, '#3fbf5a', 50); break;
      case 'key': {
        SFX.latch();
        const sn = world.sensor(ev.id);
        if (sn) spawnBurst(sn.x + sn.w / 2, sn.y + sn.h / 2, 22, '#ffd24a', 300);
        if (ev.cage) { meowT = 2.2; setTimeout(() => SFX.meow(), 250); }
        break;
      }
      case 'reveal': SFX.reveal(); if (b) { spawnBurst(c.x, c.y, 18, '#ffe066', 260); if (b.kind === 'key' && !demo) banner('La clé de Mei Mei !', 'Apporte-la jusqu’à sa cage.', 2.4); } break;
      case 'objective': if (room.openOnObjective) spawnBurst(W / 2, 400, 20, '#bfe8ff', 300); break;
      case 'respawn': if (b) { spawnSmoke(c.x, c.y, 10, 0.8); spawnRing(c.x, c.y, '#ffe066', 40); } break;
      case 'latched': SFX.latch(); if (b) spawnBurst(c.x, b.y, 12, '#cfd3d9', 200); break;
      case 'secret': SFX.secret(); shake = Math.max(shake, 0.2); break;
      case 'unhook': tone(1200, 0.05, 'square', 0.04); break;
      case 'win': if (!demo) { SFX.win(); buzz([30, 40, 60]); witchReact(room.final ? 'Nooon !' : 'Grrr !'); } break;
    }
  }
  function fxOf(id) { return fx[id] || (fx[id] = { sq: 0, pop: 0, stars: 0 }); }
  function witchReact(text) { witchFx = { t: 1.2, text }; }

  function onWin() {
    const last = room.index >= floor.rooms.length - 1;
    if (!last) {
      progress.floor = floor.n; progress.room = room.index + 1; save();
      SFX.room();
      startRoom(floor.n, room.index + 1);
      return;
    }
    if (!progress.done.includes(floor.n)) progress.done.push(floor.n);
    if (floor.n >= progress.floor) { progress.floor = Math.min(TOTAL, floor.n + 1); progress.room = 0; }
    save();
    if (floor.final) { stopLoop(); showEnd(); return; }
    startFlight();
  }
  // La sorcière arrive par la fenêtre, attrape la cage, et repart avec le chat
  function startFlight() {
    const c = room.cage || { x: W - 240, y: 540 };
    flight = { phase: 'in', t: 0, from: { x: W + 260, y: 120 }, to: { x: c.x - 70, y: c.y - 150 }, cageTaken: false, spoken: false };
    SFX.whoosh();
  }
  const easeOut = (k) => 1 - Math.pow(1 - k, 3), easeIn = (k) => k * k * k;
  function updateFlight(dt) {
    const f = flight; f.t += dt;
    if (f.phase === 'in' && f.t >= 1.3) { f.phase = 'hover'; f.t = 0; }
    else if (f.phase === 'hover') {
      if (!f.spoken) { f.spoken = true; speak('Pas si vite ! ' + floor.taunt + ' Encore un étage !', { pitch: 1.5, rate: 1.05 }); }
      if (f.t >= 1.9) { f.phase = 'out'; f.t = 0; f.cageTaken = true; spawnSmoke(f.to.x + 150, f.to.y + 150, 22, 1.3); SFX.whoosh(); shake = 0.2; }
    } else if (f.phase === 'out' && f.t >= 1.6) { flight = null; stopLoop(); show('tower'); renderTower(); }
  }
  function flightPos() {
    const f = flight;
    if (f.phase === 'in') { const k = easeOut(Math.min(1, f.t / 1.3)); return { x: f.from.x + (f.to.x - f.from.x) * k, y: f.from.y + (f.to.y - f.from.y) * k }; }
    if (f.phase === 'hover') return { x: f.to.x, y: f.to.y + Math.sin(f.t * 6) * 8 };
    const k = easeIn(Math.min(1, f.t / 1.6)); return { x: f.to.x + (W + 300 - f.to.x) * k, y: f.to.y + (-360 - f.to.y) * k };
  }
  function drawFlight() {
    if (!flight) return;
    const p = flightPos();
    const img = flight.phase === 'out' ? IMG.sorciere_balai : IMG.sorciere_vol;
    drawImageFit(img, { x: p.x, y: p.y, w: 300, h: 270 }, 'center');
    if (flight.phase === 'hover') {
      ctx.save(); ctx.globalAlpha = Math.min(1, flight.t * 3);
      ctx.font = 'bold 26px Nunito, sans-serif'; const text = fr('Pas si vite ! ' + floor.taunt);
      const tw = Math.min(520, ctx.measureText(text).width + 40);
      const bx = Math.max(20, Math.min(W - tw - 20, p.x + 150 - tw / 2)), by = p.y - 70;
      ctx.fillStyle = C.text; rr(bx, by, tw, 54, 16); ctx.fill();
      ctx.fillStyle = '#2b1a00'; ctx.textAlign = 'center'; wrapText(text, bx + tw / 2, by + 35, tw - 30, 28);
      ctx.restore();
    }
  }
  function showEnd() {
    show('end');
    SFX.win(); setTimeout(SFX.meow, 500); setTimeout(SFX.win, 900);
    speak('Bravo ! Tu as délivré Mei Mei !', { rate: 0.95 });
    $('#btnEndHome').onclick = () => { show('title'); renderTitle(); };
  }

  // ---------- particules ----------
  function spawnBurst(x, y, n, color, speed) {
    if (REDUCED) n = Math.min(n, 4);
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = speed * (0.4 + Math.random() * 0.6); particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, life: 0.5 + Math.random() * 0.3, t: 0, color, size: 3 + Math.random() * 4, g: 600, kind: 'spark' }); }
  }
  function spawnSmoke(x, y, n, scale = 1) {
    if (REDUCED) n = Math.min(n, 3);
    for (let i = 0; i < n; i++) { const a = Math.PI + Math.random() * Math.PI, v = 60 + Math.random() * 90; particles.push({ x: x + (Math.random() - 0.5) * 40, y, vx: Math.cos(a) * v * (Math.random() < 0.5 ? 1 : -1), vy: Math.sin(a) * v * 0.5, life: 0.6 + Math.random() * 0.4, t: 0, color: 'rgba(210,200,220,0.7)', size: (8 + Math.random() * 10) * scale, g: -120, kind: 'puff' }); }
  }
  function spawnRing(x, y, color, r) { particles.push({ x, y, vx: 0, vy: 0, life: 0.5, t: 0, color, size: r, g: 0, kind: 'ring' }); }
  function confetti() {
    const n = REDUCED ? 20 : 80, colors = ['#ffb020', '#7ad3ff', '#e0453a', '#3fbf5a', '#fff6e6', '#c77dff'];
    for (let i = 0; i < n; i++) particles.push({ x: Math.random() * W, y: 60 + Math.random() * 100, vx: (Math.random() - 0.5) * 200, vy: 100 + Math.random() * 200, life: 2.2 + Math.random(), t: 0, color: colors[i % colors.length], size: 8 + Math.random() * 8, g: 300, kind: 'confetti', rot: Math.random() * 6, vr: (Math.random() - 0.5) * 10 });
  }
  function updateParticles(dt) {
    for (const p of particles) { p.t += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.kind === 'confetti') { p.rot += p.vr * dt; p.vx *= Math.exp(-1.5 * dt); } }
    particles = particles.filter((p) => p.t < p.life);
  }
  function drawParticles() {
    for (const p of particles) {
      const k = 1 - p.t / p.life;
      ctx.globalAlpha = Math.max(0, Math.min(1, k * 1.3));
      if (p.kind === 'spark') { ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * k, 0, 7); ctx.fill(); }
      else if (p.kind === 'puff') { ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.6 + 0.8 * (1 - k)), 0, 7); ctx.fill(); }
      else if (p.kind === 'ring') { ctx.strokeStyle = p.color; ctx.lineWidth = 4 * k; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (0.3 + 1.2 * (1 - k)), 0, 7); ctx.stroke(); }
      else if (p.kind === 'confetti') { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.color; ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); ctx.restore(); }
    }
    ctx.globalAlpha = 1;
  }

  // ---------- dessin ----------
  const C = {
    stoneA: '#4a3d5c', stoneB: '#56486a', floor: '#6b5a52', floorLine: '#4a3d36',
    wood: '#a0642c', woodLine: '#6e4218', glass: 'rgba(170,220,255,0.35)', glassLine: 'rgba(220,245,255,0.8)',
    iron: '#5a6068', ironLine: '#2c3036', rivet: '#8e959e', pit: '#120c1a', zone: 'rgba(255,240,180,0.09)', zoneLine: 'rgba(255,220,120,0.75)',
    red: '#e0453a', blue: '#2f6fd6', gold: '#e8b73a', hand: '#f3c89c', text: '#fff6e6',
  };
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
  let slideTick = 0;

  function draw(time, dt) {
    const lv = room, w = world;
    ctx.save();
    if (shake > 0 && !REDUCED) ctx.translate((Math.random() - 0.5) * 14 * shake, (Math.random() - 0.5) * 14 * shake);
    ctx.fillStyle = C.stoneA; ctx.fillRect(0, 0, W, H);
    drawBricks();
    if (lv.zone && w.tool && w.tool.type !== 'electro' && w.tool.type !== 'compass') drawZone(time);
    if (lv.well) { ctx.fillStyle = C.pit; ctx.fillRect(lv.well.x, lv.well.y, lv.well.w, lv.well.h); }
    for (const s of lv.sensors || []) if (s.type === 'trap') { ctx.fillStyle = C.pit; ctx.fillRect(s.x, s.y - 2, s.w, 100); }
    for (const s of w.solids) drawSolid(s);
    drawSensors();
    if (lv.lodestone) drawImageFit(IMG.magnetite, lv.lodestone);
    if (lv.kind === 'atelier') drawSign();
    drawCage(time);
    drawWitch(time);
    // poussière des corps qui glissent
    slideTick += dt;
    if (slideTick > 0.07) { slideTick = 0; for (const b of w.bodies) if (b.grounded && Math.abs(b.vx) > 90 && !b.hidden && !b.captured) spawnSmoke(b.x + b.w / 2 - Math.sign(b.vx) * b.w / 2, b.y + b.h, 1, 0.5); }
    for (const b of w.bodies) drawBody(b, time);
    if (w.filings) drawFilings();
    drawPulls(time);
    drawMagnet(time);
    if (lv.dark) drawDark();
    drawParticles();
    drawFlight();
    drawFlashes();
    drawBanner();
    if (flashWhite > 0) { ctx.fillStyle = `rgba(255,255,255,${flashWhite * 2})`; ctx.fillRect(0, 0, W, H); }
    ctx.restore();
  }

  function drawBricks() {
    const bw = 96, bh = 44;
    for (let row = 0, y = 90; y < H; row++, y += bh) {
      const off = row % 2 ? bw / 2 : 0;
      for (let x = -bw + off; x < W; x += bw) {
        const k = ((row * 7 + Math.round(x / bw) * 13) % 5);
        ctx.fillStyle = k < 2 ? C.stoneB : C.stoneA;
        ctx.fillRect(x + 2, y + 2, bw - 4, bh - 4);
      }
    }
  }
  function drawSign() {
    ctx.fillStyle = '#7a4a1e'; rr(W / 2 - 110, 128, 220, 56, 10); ctx.fill();
    ctx.fillStyle = C.wood; rr(W / 2 - 104, 134, 208, 44, 8); ctx.fill();
    ctx.fillStyle = '#fff6e6'; ctx.font = 'bold 30px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('ATELIER', W / 2, 167);
  }
  function drawZone(time) {
    const zones = Array.isArray(room.zone) ? room.zone : [room.zone];
    const blocked = world.fingerBlocked;
    for (const z of zones) {
      ctx.fillStyle = C.zone; ctx.fillRect(z.x, z.y, z.w, z.h);
      ctx.strokeStyle = C.zoneLine; ctx.lineWidth = blocked ? 6 : 2; ctx.setLineDash([14, 10]); ctx.lineDashOffset = -time * 30;
      ctx.globalAlpha = blocked ? 0.6 + 0.4 * Math.sin(time * 12) : 0.5;
      ctx.strokeRect(z.x + 3, z.y + 3, z.w - 6, z.h - 6); ctx.setLineDash([]); ctx.lineDashOffset = 0; ctx.globalAlpha = 1;
    }
    if (blocked) {
      ctx.font = 'bold 44px Fredoka, sans-serif'; ctx.fillStyle = C.red; ctx.textAlign = 'center';
      ctx.fillText('✗', world.finger.x, world.finger.y + 16);
      ctx.font = 'bold 26px Nunito, sans-serif'; ctx.fillStyle = C.text;
      ctx.fillText('Ta main reste dans la zone claire', world.finger.x, world.finger.y - 40);
    }
  }
  function drawSolid(s) {
    if (s.mat === 'stone') {
      ctx.fillStyle = C.floor; ctx.fillRect(s.x, s.y, s.w, s.h);
      if (s.h >= 60 && s.w >= 300) { ctx.fillStyle = C.floorLine; ctx.fillRect(s.x, s.y, s.w, 6); for (let x = s.x + 40; x < s.x + s.w; x += 80) ctx.fillRect(x, s.y + 6, 3, s.h - 6); }
      else { ctx.strokeStyle = C.floorLine; ctx.lineWidth = 4; ctx.strokeRect(s.x + 2, s.y + 2, s.w - 4, s.h - 4); }
    } else if (s.mat === 'wood') {
      ctx.fillStyle = C.wood; ctx.fillRect(s.x, s.y, s.w, s.h);
      ctx.strokeStyle = C.woodLine; ctx.lineWidth = 3; ctx.strokeRect(s.x + 1.5, s.y + 1.5, s.w - 3, s.h - 3);
      if (s.w > s.h) for (let x = s.x + 60; x < s.x + s.w; x += 60) { ctx.beginPath(); ctx.moveTo(x, s.y + 4); ctx.lineTo(x, s.y + s.h - 4); ctx.stroke(); }
      else for (let y = s.y + 60; y < s.y + s.h; y += 60) { ctx.beginPath(); ctx.moveTo(s.x + 4, y); ctx.lineTo(s.x + s.w - 4, y); ctx.stroke(); }
    } else if (s.mat === 'glass') {
      ctx.fillStyle = C.glass; ctx.fillRect(s.x, s.y, s.w, s.h);
      ctx.strokeStyle = C.glassLine; ctx.lineWidth = 2; ctx.strokeRect(s.x + 1, s.y + 1, s.w - 2, s.h - 2);
      ctx.beginPath(); ctx.moveTo(s.x + 5, s.y + 20); ctx.lineTo(s.x + 5, s.y + s.h * 0.4); ctx.stroke();
    } else if (s.mat === 'iron') {
      ctx.fillStyle = C.iron; ctx.fillRect(s.x, s.y, s.w, s.h);
      ctx.strokeStyle = C.ironLine; ctx.lineWidth = 3; ctx.strokeRect(s.x + 1.5, s.y + 1.5, s.w - 3, s.h - 3);
      ctx.fillStyle = C.rivet;
      for (let y = s.y + 14; y < s.y + s.h - 8; y += 40) { ctx.beginPath(); ctx.arc(s.x + s.w / 2, y, 4, 0, 7); ctx.fill(); }
    }
  }
  function drawSensors() {
    for (const s of world.sensors) {
      if (s.type === 'button') {
        ctx.fillStyle = '#3a3340'; rr(s.x - 6, s.y + 8, s.w + 12, s.h - 8 + 6, 6); ctx.fill();
        ctx.fillStyle = s.pressed ? '#3fbf5a' : C.red; rr(s.x, s.y + (s.pressed ? 10 : 0), s.w, 14, 7); ctx.fill();
      } else if (s.type === 'keyhole' && s.cageLock) {
        // dessiné avec la cage (drawCage)
      } else if (s.type === 'alarm') {
        // la cloche : si un garde l'atteint, la salle recommence
        const cx = s.x + s.w / 2, t = performance.now() / 1000, ring = world.failed ? Math.sin(t * 30) * 0.4 : Math.sin(t * 2) * 0.05;
        ctx.fillStyle = '#4a3d36'; ctx.fillRect(cx - 4, s.y - 150, 8, 70);
        ctx.save(); ctx.translate(cx, s.y - 80); ctx.rotate(ring);
        ctx.fillStyle = C.gold; ctx.beginPath(); ctx.moveTo(-38, 60); ctx.quadraticCurveTo(-34, 0, 0, 0); ctx.quadraticCurveTo(34, 0, 38, 60); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#b8860b'; ctx.fillRect(-42, 56, 84, 10); ctx.beginPath(); ctx.arc(0, 70, 8, 0, 7); ctx.fill();
        ctx.restore();
        ctx.strokeStyle = 'rgba(232,183,58,0.5)'; ctx.setLineDash([10, 8]); ctx.lineWidth = 3; ctx.strokeRect(s.x, s.y, s.w, s.h); ctx.setLineDash([]);
      } else if (s.type === 'keyhole') {
        const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
        ctx.fillStyle = s.pressed ? '#3fbf5a' : C.gold; rr(cx - 28, cy - 22, 56, 44, 8); ctx.fill();
        ctx.fillStyle = '#2b2b2b'; ctx.beginPath(); ctx.arc(cx, cy - 6, 8, 0, 7); ctx.fill(); ctx.fillRect(cx - 4, cy - 6, 8, 18);
        if (!s.pressed) { ctx.strokeStyle = C.zoneLine; ctx.setLineDash([8, 8]); ctx.lineWidth = 2; ctx.strokeRect(s.x, s.y, s.w, s.h); ctx.setLineDash([]); }
      } else if (s.type === 'latch') {
        const b = world.body(s.body);
        if (b && b.kind === 'herse') { ctx.fillStyle = '#2c3036'; ctx.fillRect(s.x - 12, s.y - 60, 12, 30); ctx.fillRect(s.x + s.w, s.y - 60, 12, 30); }
      } else if (s.type === 'secret' && s.done) {
        ctx.fillStyle = C.pit; ctx.fillRect(s.x, s.y, s.w, s.h);
      }
    }
  }
  function drawImageFit(img, r, align = 'bottom') {
    if (!img) return;
    const s = Math.min(r.w / img.width, r.h / img.height);
    const w = img.width * s, h = img.height * s;
    const x = r.x + (r.w - w) / 2, y = align === 'bottom' ? r.y + r.h - h : r.y + (r.h - h) / 2;
    ctx.drawImage(img, x, y, w, h);
  }
  function drawCage(time) {
    const c = room.cage; if (!c || room.index < room.total - 1) return;
    if (flight && flight.cageTaken) return;
    if (world.won && room.final) { drawImageFit(IMG.chat_saute, { x: c.x - 40, y: c.y - 60 - Math.abs(Math.sin(time * 4)) * 20, w: 240, h: 240 }); return; }
    const bob = world.won ? Math.sin(time * 40) * 4 : Math.sin(time * 1.6) * 2;
    drawImageFit(IMG.chat_cage, { x: c.x + bob, y: c.y, w: 150, h: 180 });
    const lock = world.sensors.find((s) => s.cageLock);
    if (lock && !lock.pressed) {
      // cadenas doré sur la porte de la cage de Mei Mei
      ctx.save(); ctx.translate(c.x + 78 + bob, c.y + 118); ctx.rotate(Math.sin(time * 3) * 0.08);
      ctx.strokeStyle = '#b8860b'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(0, -18, 15, Math.PI, 0); ctx.stroke();
      ctx.fillStyle = C.gold; rr(-25, -18, 50, 42, 9); ctx.fill(); ctx.strokeStyle = '#8a6508'; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = '#2b2b2b'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, 7); ctx.fill(); ctx.fillRect(-3, 0, 6, 14);
      ctx.restore();
    }
    if (meowT > 0) {
      ctx.save(); ctx.globalAlpha = Math.min(1, meowT * 2);
      ctx.fillStyle = C.text; rr(c.x - 10, c.y - 60, 170, 50, 16); ctx.fill();
      ctx.beginPath(); ctx.moveTo(c.x + 60, c.y - 10); ctx.lineTo(c.x + 80, c.y + 10); ctx.lineTo(c.x + 90, c.y - 10); ctx.fill();
      ctx.fillStyle = '#2b1a00'; ctx.font = 'bold 28px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Miaou !', c.x + 75, c.y - 25);
      ctx.restore();
    }
  }
  function drawWitch(time) {
    const wi = room.witch;
    if (wi && wi.rides) {
      const g = world.body(wi.rides);
      if (g) {
        const jump = witchFx.t > 0 ? Math.abs(Math.sin(witchFx.t * 8)) * 30 : 0;
        drawImageFit(IMG.sorciere, { x: g.x + g.w / 2 - 45, y: g.y - 150 + Math.sin(time * 2.5) * 5 - jump, w: 110, h: 150 });
      }
    }
    if (witchFx.t > 0 && !flight) {
      // elle crie depuis l'étage du dessus
      const x = W - 230, y = 130;
      ctx.save(); ctx.globalAlpha = Math.min(1, witchFx.t * 2);
      ctx.fillStyle = C.text; rr(x, y, 190, 50, 16); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x + 150, y); ctx.lineTo(x + 175, y - 22); ctx.lineTo(x + 178, y); ctx.fill();
      ctx.fillStyle = '#2b1a00'; ctx.font = 'bold 28px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(fr(witchFx.text), x + 95, y + 36);
      ctx.restore();
    }
  }
  function drawBody(b, time) {
    if (b.hidden) return;
    const f = fx[b.id];
    ctx.save();
    if (b.captured) ctx.globalAlpha = Math.max(0, 1 - (b.y - 700) / 200);
    // squash / pop / dandinement
    const cx = b.x + b.w / 2, by = b.y + b.h;
    let sx = 1, sy = 1, rot = 0;
    if (f) { sx += f.sq * 0.3 + f.pop; sy -= f.sq * 0.3 - f.pop; }
    if (b.grounded && Math.abs(b.vx) > 60 && !b.rail) rot = Math.sin(time * 22) * 0.06 * Math.min(1, Math.abs(b.vx) / 250);
    if (b.tilt) rot = b.tilt;
    if (b.captured) rot = (b.tilt || 0.3) + (b.y - 700) / 250;
    ctx.translate(cx, by); ctx.rotate(rot); ctx.scale(sx, sy); ctx.translate(-cx, -by);
    switch (b.kind) {
      case 'knight':
        if (b.ko) drawImageFit(IMG.armure_tas, { x: b.x - 10, y: b.y - 40, w: b.w + 20, h: b.h + 40 });
        else if (b.patrol && b.patrol.dir < 0) { ctx.save(); ctx.translate(cx, 0); ctx.scale(-1, 1); ctx.translate(-cx, 0); drawImageFit(IMG.armure, { x: b.x - 16, y: b.y - 14, w: b.w + 32, h: b.h + 14 }); ctx.restore(); }
        else drawImageFit(IMG.armure, { x: b.x - 16, y: b.y - 14, w: b.w + 32, h: b.h + 14 });
        if (b.drops && !b.ko) { const kb = world.body(b.drops); if (kb && kb.hidden) { ctx.fillStyle = C.gold; ctx.beginPath(); ctx.arc(b.x + b.w - 4, b.y + 62, 9, 0, 7); ctx.fill(); ctx.fillRect(b.x + b.w - 6, b.y + 62, 4, 22); } }
        if (b.pole && (!b.hiddenPole || world.filings)) drawPoleLabel(b);
        else if (b.pole) drawHiddenPole(b);
        if (f && f.stars > 0) { drawStars(cx, b.y - 20, time); f.stars -= 1 / 60; }
        break;
      case 'straw': drawImageFit(IMG.epouvantail, { x: b.x - 10, y: b.y, w: b.w + 20, h: b.h }); break;
      case 'sword': drawImageFit(IMG.epee, { x: b.x - 10, y: b.y, w: b.w + 20, h: b.h }); break;
      case 'bolt': drawBolt(b); break;
      case 'ring':
        ctx.strokeStyle = '#8e959e'; ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(b.x + b.w / 2, b.y + b.h / 2, b.w / 2 - 5, 0, 7); ctx.stroke();
        ctx.strokeStyle = '#c9ced4'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(b.x + b.w / 2, b.y + b.h / 2, b.w / 2 - 7, Math.PI * 1.1, Math.PI * 1.6); ctx.stroke();
        break;
      case 'key':
        ctx.fillStyle = C.gold; ctx.beginPath(); ctx.arc(b.x + 14, b.y + b.h / 2, 12, 0, 7); ctx.fill();
        ctx.fillStyle = '#2b2b2b'; ctx.beginPath(); ctx.arc(b.x + 14, b.y + b.h / 2, 5, 0, 7); ctx.fill();
        ctx.fillStyle = C.gold; ctx.fillRect(b.x + 24, b.y + b.h / 2 - 4, b.w - 26, 8); ctx.fillRect(b.x + b.w - 10, b.y + b.h / 2, 6, 10); ctx.fillRect(b.x + b.w - 22, b.y + b.h / 2, 6, 8);
        if (!b.attached && !b.consumed) { ctx.fillStyle = `rgba(255,230,120,${0.3 + 0.3 * Math.sin(time * 5)})`; ctx.beginPath(); ctx.arc(b.x + b.w / 2, b.y + b.h / 2, 36, 0, 7); ctx.fill(); }
        break;
      case 'herse': drawHerse(b); break;
      case 'gate': drawGate(b); break;
      case 'lever':
        ctx.fillStyle = '#2c3036'; ctx.fillRect(b.x + 8, b.y - 40, 14, b.h + 60);
        ctx.fillStyle = C.wood; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.fillStyle = C.red; ctx.beginPath(); ctx.arc(b.x + b.w / 2, b.y + 6, 16, 0, 7); ctx.fill();
        break;
      case 'giant': drawBar(b.x, b.y, b.w, b.h, b.pole === 'N', true); break;
    }
    ctx.restore();
  }
  function drawStars(x, y, time) {
    ctx.fillStyle = C.gold; ctx.font = 'bold 26px Fredoka, sans-serif'; ctx.textAlign = 'center';
    for (let i = 0; i < 4; i++) { const a = time * 4 + i * Math.PI / 2; ctx.fillText('★', x + Math.cos(a) * 46, y + Math.sin(a) * 12); }
  }
  function drawBolt(b) {
    ctx.fillStyle = '#2c3036'; rr(b.x - 8, b.y - 6, b.w + 16, b.h + 12, 6); ctx.fill();
    ctx.fillStyle = b.latched ? '#9fd6a8' : '#9aa1aa'; rr(b.x, b.y, b.w, b.h, 8); ctx.fill();
    ctx.fillStyle = '#d7dce2'; rr(b.x + 6, b.y + 4, b.w - 12, 5, 3); ctx.fill();
    ctx.fillStyle = '#5a6068'; ctx.beginPath(); ctx.arc(b.x + b.w / 2, b.y + b.h / 2, 5, 0, 7); ctx.fill();
  }
  function drawGate(b) {
    ctx.fillStyle = '#7a4a1e'; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = C.wood; for (let x = b.x + 4; x < b.x + b.w - 4; x += 14) ctx.fillRect(x, b.y, 9, b.h);
    ctx.fillStyle = '#5a6068'; for (let y = b.y + 30; y < b.y + b.h; y += 70) ctx.fillRect(b.x - 2, y, b.w + 4, 10);
    ctx.fillStyle = '#5a6068'; for (let x = b.x + 6; x < b.x + b.w; x += 14) { ctx.beginPath(); ctx.moveTo(x - 4, b.y + b.h); ctx.lineTo(x + 4, b.y + b.h); ctx.lineTo(x, b.y + b.h + 12); ctx.fill(); }
    if (b.closing) { ctx.fillStyle = 'rgba(224,69,58,0.8)'; ctx.font = 'bold 30px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('!', b.x + b.w / 2, Math.max(150, b.y + b.h - 20)); }
  }
  function drawHerse(b) {
    ctx.fillStyle = '#3f454d';
    for (let x = b.x + 6; x < b.x + b.w; x += 30) ctx.fillRect(x, b.y, 10, b.h);
    for (let y = b.y + 6; y < b.y + b.h; y += 36) ctx.fillRect(b.x, y, b.w, 10);
    ctx.fillStyle = '#9aa1aa'; ctx.fillRect(b.x, b.y, b.w, 8);
    if (b.lockedUntil && !b.lockedUntil(world)) { ctx.font = 'bold 48px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = C.gold; ctx.fillText('🔒', b.x + b.w / 2, b.y - 16); }
  }
  function drawBar(x, y, w, h, flipped, big) {
    const left = flipped ? C.red : C.blue, right = flipped ? C.blue : C.red;
    ctx.fillStyle = left; rr(x, y, w / 2, h, 8); ctx.fill(); ctx.fillStyle = right; rr(x + w / 2, y, w / 2, h, 8); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; rr(x + 6, y + 4, w - 12, h * 0.25, 4); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = `bold ${big ? 36 : 20}px Fredoka, sans-serif`;
    ctx.fillText(flipped ? 'N' : 'S', x + w / 4, y + h / 2 + (big ? 13 : 7)); ctx.fillText(flipped ? 'S' : 'N', x + 3 * w / 4, y + h / 2 + (big ? 13 : 7));
  }
  function drawPoleLabel(b) { drawBar(b.x - 14, b.y + b.h * 0.45, b.w + 28, 26, b.pole === 'N', false); }
  function drawHiddenPole(b) {
    const y = b.y + b.h * 0.45;
    ctx.fillStyle = '#7a6a8a'; rr(b.x - 14, y, b.w + 28, 26, 8); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 20px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('? ?', b.x + b.w / 2, y + 19);
  }
  function drawPulls(time) {
    for (const p of world.pulls) {
      const dx = p.from.x - p.to.x, dy = p.from.y - p.to.y, d = Math.hypot(dx, dy) || 1;
      const ux = dx / d, uy = dy / d;
      const n = Math.max(2, Math.floor(d / 60));
      ctx.strokeStyle = p.sign > 0 ? 'rgba(255,230,120,0.85)' : 'rgba(255,90,70,0.9)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      for (let i = 0; i < n; i++) {
        const t = ((i / n) + (time * 0.8 * (p.sign > 0 ? 1 : -1)) % 1 + 1) % 1;
        const x = p.to.x + ux * d * t, y = p.to.y + uy * d * t;
        const dir = p.sign;
        ctx.beginPath(); ctx.moveTo(x - ux * 10 * dir + uy * 8, y - uy * 10 * dir - ux * 8); ctx.lineTo(x, y); ctx.lineTo(x - ux * 10 * dir - uy * 8, y - uy * 10 * dir + ux * 8); ctx.stroke();
      }
    }
  }
  function drawMagnet(time) {
    const w = world, t = w.tool; if (!t) return;
    if (t.type === 'electro') { drawCrane(time); return; }
    if (!w.finger.down) return;
    const x = w.finger.x, y = w.finger.y;
    const src = w.sources.find((s) => s.root && s.kind === t.type);
    ctx.save();
    if (demo) ctx.globalAlpha = 0.8;
    if (src) {
      const pulse = 4 * Math.sin(time * 5);
      const g = ctx.createRadialGradient(x, y, 10, x, y, src.range + pulse); g.addColorStop(0, 'rgba(255,230,140,0.16)'); g.addColorStop(1, 'rgba(255,230,140,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, src.range + pulse, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(255,240,200,0.4)'; ctx.setLineDash([10, 12]); ctx.lineDashOffset = -time * 40; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, src.range + pulse, 0, 7); ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0;
      // étincelles qui tournent
      for (let i = 0; i < 3; i++) { const a = time * 3 + i * 2.1; ctx.fillStyle = 'rgba(255,240,160,0.9)'; ctx.beginPath(); ctx.arc(x + Math.cos(a) * 52, y + Math.sin(a) * 40, 3, 0, 7); ctx.fill(); }
    }
    drawHero(hero.x, hero.y, time);
    if (t.type === 'bar') drawBar(x - 36, y - 15, 72, 30, w.flipped, false);
    else if (t.type === 'double') { drawBar(x - 42, y - 30, 84, 28, w.flipped, false); drawBar(x - 42, y + 2, 84, 28, w.flipped, false); }
    else if (t.type === 'horseshoe') drawHorseshoe(x, y, w.flipped);
    else if (t.type === 'nail') drawNail(x, y, w.nailCharge);
    else if (t.type === 'compass') drawCompass(x, y);
    if (demo) { ctx.fillStyle = C.text; ctx.font = 'bold 24px Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Regarde…', x, y - 60); }
    ctx.restore();
  }
  function drawHorseshoe(x, y, flipped) {
    ctx.lineWidth = 22; ctx.lineCap = 'butt';
    ctx.strokeStyle = C.red; ctx.beginPath(); ctx.arc(x, y - 10, 30, Math.PI, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = flipped ? C.red : C.blue; ctx.fillRect(x - 41, y - 10, 22, 34);
    ctx.fillStyle = flipped ? C.blue : C.red; ctx.fillRect(x + 19, y - 10, 22, 34);
    ctx.fillStyle = C.red; ctx.fillRect(x - 41, y - 12, 22, 4); ctx.fillRect(x + 19, y - 12, 22, 4);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 18px Fredoka, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(flipped ? 'N' : 'S', x - 30, y + 14); ctx.fillText(flipped ? 'S' : 'N', x + 30, y + 14);
  }
  function drawNail(x, y, charge) {
    if (charge > 0.02) { const g = ctx.createRadialGradient(x, y, 5, x, y, 70); g.addColorStop(0, `rgba(120,200,255,${0.5 * charge})`); g.addColorStop(1, 'rgba(120,200,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 70, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#b8bec6'; ctx.fillRect(x - 5, y - 30, 10, 60); ctx.fillStyle = '#8e959e'; rr(x - 14, y - 36, 28, 10, 4); ctx.fill();
    ctx.fillStyle = '#b8bec6'; ctx.beginPath(); ctx.moveTo(x - 5, y + 30); ctx.lineTo(x + 5, y + 30); ctx.lineTo(x, y + 44); ctx.fill();
  }
  function drawCompass(x, y) {
    ctx.fillStyle = '#f7f1e3'; ctx.beginPath(); ctx.arc(x, y, 46, 0, 7); ctx.fill();
    ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = 5; ctx.stroke();
    const a = world.compassAngle();
    if (a !== null) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ctx.fillStyle = C.red; ctx.beginPath(); ctx.moveTo(38, 0); ctx.lineTo(0, -9); ctx.lineTo(0, 9); ctx.fill();
      ctx.fillStyle = C.blue; ctx.beginPath(); ctx.moveTo(-38, 0); ctx.lineTo(0, -9); ctx.lineTo(0, 9); ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#3a3a3a'; ctx.beginPath(); ctx.arc(x, y, 5, 0, 7); ctx.fill();
  }
  function drawCrane(time) {
    const c = world.crane; if (!c) return;
    const on = world.electroOn;
    ctx.fillStyle = '#2c3036'; ctx.fillRect(40, 110, W - 80, 10);
    ctx.fillStyle = '#5a6068'; rr(c.x - 30, 104, 60, 22, 6); ctx.fill();
    ctx.strokeStyle = '#2c3036'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(c.x, 126); ctx.lineTo(c.x, c.y - 30); ctx.stroke();
    const turns = world.turns;
    ctx.fillStyle = '#8e959e'; rr(c.x - 36, c.y - 30, 72, 44, 8); ctx.fill();
    ctx.strokeStyle = '#d96b2b'; ctx.lineWidth = 4;
    for (let i = 0; i < turns; i++) { const yy = c.y - 24 + i * (34 / Math.max(1, turns - 1) || 0); ctx.beginPath(); ctx.moveTo(c.x - 30, yy); ctx.lineTo(c.x + 30, yy + 4); ctx.stroke(); }
    ctx.fillStyle = on ? '#ffd24a' : '#4a4f56'; rr(c.x - 44, c.y + 10, 88, 14, 7); ctx.fill();
    if (on) {
      const g = ctx.createRadialGradient(c.x, c.y + 18, 6, c.x, c.y + 18, 70); g.addColorStop(0, 'rgba(255,220,80,0.5)'); g.addColorStop(1, 'rgba(255,220,80,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c.x, c.y + 18, 70, 0, 7); ctx.fill();
      for (let i = 0; i < 3; i++) { const a = time * 6 + i * 2.1; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(c.x + Math.cos(a) * 50, c.y + 18 + Math.sin(a) * 30, 2.5, 0, 7); ctx.fill(); }
    }
    const src = world.sources.find((s) => s.kind === 'electro');
    if (src) { ctx.strokeStyle = 'rgba(255,240,200,0.3)'; ctx.setLineDash([10, 12]); ctx.lineDashOffset = -time * 40; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(src.x, src.y, src.range, 0, 7); ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0; }
    ctx.fillStyle = C.text; ctx.font = 'bold 22px Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(on ? 'ALLUMÉ' : 'ÉTEINT', c.x, c.y - 44);
    if (demo) { ctx.fillText('Regarde…', c.x, c.y - 72); }
  }
  function drawFilings() {
    const src = world.sources.find((s) => s.root && s.poleLeft);
    const targets = [];
    if (src) targets.push({ x: src.x, y: src.y, w: 72 });
    for (const b of world.bodies) if (b.pole && !b.hidden) targets.push({ x: b.x + b.w / 2, y: b.y + b.h * 0.45 + 13, w: b.w + 28 });
    ctx.strokeStyle = 'rgba(60,60,70,0.85)'; ctx.lineWidth = 2;
    for (const t of targets) {
      for (let i = 1; i <= 4; i++) { ctx.beginPath(); ctx.ellipse(t.x, t.y, t.w / 2 + i * 26, 14 + i * 20, 0, 0, 7); ctx.stroke(); }
      ctx.fillStyle = 'rgba(40,40,50,0.8)';
      for (let i = 0; i < 60; i++) { const a = (i / 60) * Math.PI * 2; const r = 30 + (i % 5) * 18; ctx.fillRect(t.x + Math.cos(a) * (t.w / 2 + r) - 1, t.y + Math.sin(a) * (10 + r * 0.7) - 1, 3, 3); }
    }
  }
  function drawDark() {
    const f = world.finger;
    ctx.save();
    if (f.down) {
      const g = ctx.createRadialGradient(f.x, f.y, 40, f.x, f.y, 220);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.7, 'rgba(0,0,0,0.75)'); g.addColorStop(1, 'rgba(0,0,0,0.93)');
      ctx.fillStyle = g; ctx.fillRect(0, 90, W, H - 90);
    } else { ctx.fillStyle = 'rgba(0,0,0,0.9)'; ctx.fillRect(0, 90, W, H - 90); }
    ctx.restore();
    if (world.won || world.sensors.filter((x) => x.type === 'secret').every((x) => x.done)) return;
    ctx.fillStyle = C.text; ctx.font = 'bold 26px Nunito, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Touche l’écran : la boussole montre où chercher.', W / 2, 150);
  }
  function drawFlashes() {
    for (const f of flashes) {
      f.t -= 1 / 60;
      ctx.globalAlpha = Math.max(0, Math.min(1, f.t * 2));
      ctx.font = 'bold 44px Fredoka, sans-serif'; ctx.fillStyle = C.gold; ctx.textAlign = 'center'; ctx.strokeStyle = '#2b2b2b'; ctx.lineWidth = 6;
      const s = 1 + Math.max(0, f.t - 0.5) * 0.8;
      ctx.save(); ctx.translate(f.x, f.y - (0.9 - f.t) * 50); ctx.scale(s, s);
      ctx.strokeText(f.text, 0, 0); ctx.fillText(f.text, 0, 0); ctx.restore();
      ctx.globalAlpha = 1;
    }
    flashes = flashes.filter((f) => f.t > 0);
  }
  function drawBanner() {
    if (bannerT <= 0) return;
    const k = Math.min(1, bannerT * 3), slide = (1 - Math.min(1, (3.2 - bannerT) * 4)) * -40;
    ctx.save(); ctx.globalAlpha = k;
    ctx.fillStyle = 'rgba(20,16,32,0.85)'; rr(W / 2 - 360, 210 + slide, 720, bannerSub ? 110 : 70, 18); ctx.fill();
    ctx.fillStyle = C.gold; ctx.font = 'bold 40px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(fr(bannerText), W / 2, 258 + slide);
    if (bannerSub) { ctx.fillStyle = C.text; ctx.font = 'bold 22px Nunito, sans-serif'; wrapText(fr(bannerSub), W / 2, 296 + slide, 680, 26); }
    ctx.restore();
  }
  function wrapText(text, x, y, maxW, lh) {
    const words = text.split(' '); let line = '';
    for (const w of words) { const test = line ? line + ' ' + w : w; if (ctx.measureText(test).width > maxW) { ctx.fillText(line, x, y); line = w; y += lh; } else line = test; }
    if (line) ctx.fillText(line, x, y);
  }

  // ---------- démarrage ----------
  function loadImages(cb) {
    let n = ASSETS.length;
    for (const name of ASSETS) {
      const im = new Image();
      im.onload = im.onerror = () => { IMG[name] = im.complete && im.naturalWidth ? im : null; if (--n === 0) cb(); };
      im.src = `assets/${name}.png`;
    }
  }
  function boot(state) {
    layout();
    initTitle();
    if (state && state.screen === 'tower') { show('tower'); renderTower(); } else show('title');
    if (window.claude && window.claude.hot && window.claude.hot.snapshot) window.claude.hot.snapshot(() => ({ screen: current === 'title' ? 'title' : 'tower' }));
  }
  loadImages(() => {
    const hot = window.claude && window.claude.hot;
    if (hot && hot.ready) hot.ready(boot); else boot((hot && hot.data) || {});
  });
  window.__game = { startRoom, startDemo, get world() { return world; }, get demo() { return demo; }, show, openCard, renderTower, takeControl, FLOORS };
})();
