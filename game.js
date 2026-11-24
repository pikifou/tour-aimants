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
  const ASSETS = ['armure', 'armure_tas', 'epouvantail', 'epee', 'sorciere', 'sorciere_balai', 'sorciere_vol', 'chat_cage', 'chat_saute', 'chat_assis', 'magnetite', 'heros',
    ...Array.from({ length: 16 }, (_, i) => 'mur-' + String(i + 1).padStart(2, '0')),
    ...['pierre', 'bois', 'fer', 'verre'].map(name => 'matiere-' + name),
    // Objets du jeu peints (tour 64) ; sans eux, l'ancien dessin en code reste.
    ...['aimant', 'fer', 'boussole', 'clou', 'levier', 'glissiere', 'niche', 'cloche', 'cle', 'anneau', 'serrure',
      'plaque', 'verrou', 'herse', 'porte', 'cadenas', 'chariot'].map(name => 'obj-' + name),
    ...['porte2', 'porte3'].flatMap((d) => ['haut', 'bande', 'planches', 'bas'].map((k) => `obj-${d}-${k}`))];
  const HERO = { h: 125, handX: 0.9022, handY: 0.1056 }; // Même échelle que les gardes (124), main sur l'aimant.
  const STEPS = FLOORS.STEPS;
  const REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- progression ----------
  const KEY = 'tour-aimants-v2';
  let progress = { floor: 1, room: 0, done: [] };
  try { const p = JSON.parse(localStorage.getItem(KEY) || 'null'); if (p && p.floor) progress = Object.assign({ room: 0, done: [] }, p); } catch (e) { /* stockage indisponible */ }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(progress)); } catch (e) { /* ignore */ }
    // Ludiworld garde aussi la progression dans le compte du parent (copie en ligne) ; sans lui, rien ne change.
    try { if (window.Ludi) window.Ludi.save(progress); } catch (e) { /* ignore */ }
  }

  // ---------- Ludiworld (kit ludi.js) ----------
  // Sans le kit, ou ouvert seul, rien ne change. Ouvert depuis le launcher Ludiworld, chaque salle réussie lui remonte :
  // un point d'arrêt (la « fin douce » attend la fin de la salle au lieu de couper au milieu), la progression et la notion travaillée.
  const LUDI = window.Ludi ? window.Ludi.init({ game: 'tour-aimants' }) : null;
  const DANS_LUDI = !!(LUDI && LUDI.inLauncher());
  // Une progression plus récente venue d'un autre appareil : on la range comme la nôtre et on recharge.
  if (LUDI) LUDI.onRestore(function (d) {
    try {
      if (!d || !d.floor || !Array.isArray(d.done)) return;
      localStorage.setItem(KEY, JSON.stringify(Object.assign({ room: 0, done: [] }, d)));
      location.reload();
    } catch (e) { /* ignore */ }
  });
  // Une partie commencée avant ce changement : on la confie aussi à Ludiworld (sans écraser une plus récente venue d'ailleurs).
  try { if (LUDI && localStorage.getItem(KEY)) LUDI.save(progress, { existante: true }); } catch (e) { /* ignore */ }
  // La tour est finie quand Mei Mei est délivrée (étage 16) : ça ne s'enlève plus, même si on recommence la tour.
  if (progress.done.includes(FLOORS.length)) progress.fini = true;
  if (LUDI && progress.fini) LUDI.fini();
  // Une notion par étage (la fiche de cards.js) ; les étages 15 et 16 mélangent tout, ils ne comptent pour aucune notion.
  const NOTIONS = ['aimant', 'attire-ou-pas', 'a-travers', 'epee', 'poles', 'portee', 'fer-a-cheval', 'chaine',
    'bouclier', 'clou-aimante', 'electroaimant', 'bobine', 'boussole', 'pole-cache', null, null];
  let ludiAide = false;   // « Montre-moi » utilisé dans cette salle
  let ludiSalleMax = 0;
  if (LUDI) { const d = LUDI.data(), p = d && d.progress.salle; ludiSalleMax = p ? p.value : 0; }
  function ludiSalleFinie(r, f, quoi) {
    if (!LUDI) return;
    // salle réussie seul = juste ; après « Montre-moi » = la notion n'est pas encore acquise. L'atelier (démo d'abord) ne compte pas.
    if (r.kind === 'salle' && NOTIONS[f.n - 1]) LUDI.skill('sciences.magnetisme', NOTIONS[f.n - 1], !ludiAide);
    // plus haute salle atteinte (1 à 100) et son étage : on peut rejouer un étage déjà fait, d'où le max
    let s = FLOORS[progress.floor - 1].firstStep + progress.room;
    for (const n of progress.done) s = Math.max(s, FLOORS[n - 1].firstStep + FLOORS[n - 1].rooms.length);
    s = ludiSalleMax = Math.min(STEPS, Math.max(s, ludiSalleMax));
    LUDI.progress('salle', s);
    LUDI.progress('etage', FLOORS.find((x) => s < x.firstStep + x.rooms.length).n);
    LUDI.checkpoint(quoi);
  }

  // ---------- audio ----------
  // Le son se règle dans Ludiworld, pour toute la maison (Julien, 2026-11-23) : trois réglages séparés, tous allumés au départ.
  // Le jeu ne démarre jamais muet. Son bouton (le haut-parleur) change le réglage de tout Ludiworld ; ouvert seul, celui de l'appareil.
  let SON = { musique: true, bruitages: true, voix: true };
  let actx = null;
  function ac() { try { if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)(); return actx; } catch (e) { return null; } }
  function tone(freq, dur, type = 'square', vol = 0.08, slide = 0, delay = 0) {
    if (!SON.bruitages) return;
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
    if (!SON.bruitages) return;
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
    door: () => { noise(0.9, 0.06, 180, 0.4); tone(160, 0.7, 'sawtooth', 0.04, 140); tone(523, 0.12, 'triangle', 0.07, 0, 0.5); tone(784, 0.2, 'triangle', 0.07, 0, 0.62); },
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
  // Chaque bruitage passe par le réglage « bruitages » ; les tests lisent ceux qui ont joué dans window.__sonsJoues.
  for (const k of Object.keys(SFX)) {
    const f = SFX[k];
    SFX[k] = (...args) => { if (!SON.bruitages) return; if (Array.isArray(window.__sonsJoues)) window.__sonsJoues.push(k); f(...args); };
  }
  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* ignore */ } }
  function taire() { try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) { /* ignore */ } baisserMusique(false); }
  // La voix qui lit les textes : seulement si le réglage « voix » est allumé. La musique baisse un peu pendant qu'elle parle.
  function speak(text, opts = {}) {
    if (!SON.voix) return;
    try {
      if (!window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'fr-FR'; u.rate = opts.rate || 0.9; u.pitch = opts.pitch || 1;
      const voices = window.speechSynthesis.getVoices().filter((v) => v.lang && v.lang.startsWith('fr'));
      if (voices.length) u.voice = voices[0];
      u.onend = u.onerror = () => baisserMusique(false);
      baisserMusique(true, 3 + text.length * 0.09);
      window.speechSynthesis.speak(u);
    } catch (e) { /* synthèse vocale indisponible */ }
  }

  // ---------- musique ----------
  // Trois morceaux (ElevenLabs Music, factory/direction-artistique/son-tour-aimants) : « tour » pour l'accueil, la tour,
  // les fiches et l'histoire du début ; « salles » pendant le jeu ; « fin » pour l'histoire de la fin et l'écran « Bravo ».
  // Elle tourne en boucle sans couture (la fin du morceau se fond dans son début), commence au premier geste de l'enfant,
  // s'arrête quand le jeu est caché ou mis en pause par Ludiworld, et reprend au geste suivant.
  const PISTES = { title: 'tour', tower: 'tour', card: 'tour', game: 'salles', end: 'fin' };
  const VOLUME_MUSIQUE = 0.5, FONDU = 1.5, RACCORD = 4;
  let musiqueVoulue = 'tour', musiquePause = false, geste = false, courante = null, baisse = false, baisseTimer = 0;
  const tampons = new Map();
  function chargerMusique(nom) {
    if (location.protocol === 'file:') return Promise.resolve(null);   // page ouverte comme fichier : le navigateur refuse de lire la musique
    if (!tampons.has(nom)) {
      const a = ac();
      tampons.set(nom, fetch('assets/musique-' + nom + '.mp3').then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
        .then((b) => new Promise((ok, ko) => a.decodeAudioData(b, ok, ko))).then(bouclable)
        .catch(() => { tampons.delete(nom); return null; }));
    }
    return tampons.get(nom);
  }
  // Le morceau sans ses RACCORD premières secondes, et sa fin fondue avec elles : on n'entend pas où la boucle repart.
  function bouclable(buf) {
    const a = ac(), x = Math.min(Math.floor(RACCORD * buf.sampleRate), Math.floor(buf.length / 4));
    const n = buf.length - x, out = a.createBuffer(buf.numberOfChannels, n, buf.sampleRate);
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const src = buf.getChannelData(c), dst = out.getChannelData(c);
      dst.set(src.subarray(x));
      for (let i = 0; i < x; i++) { const t = i / x, k = n - x + i; dst[k] = src[x + k] * Math.cos(t * Math.PI / 2) + src[i] * Math.sin(t * Math.PI / 2); }
    }
    return out;
  }
  function volumeMusique() { return VOLUME_MUSIQUE * (baisse ? 0.45 : 1); }
  function eteindreMusique(m, fondu) {
    if (!m) return;
    const a = ac(), t = a.currentTime;
    try { m.gain.gain.cancelScheduledValues(t); m.gain.gain.setValueAtTime(m.gain.gain.value, t); m.gain.gain.linearRampToValueAtTime(0, t + fondu); } catch (e) { /* ignore */ }
    setTimeout(() => { try { m.src.stop(); } catch (e) { /* déjà arrêtée */ } }, fondu * 1000 + 100);
  }
  function majMusique() {
    const jouer = SON.musique && geste && !musiquePause && musiqueVoulue && !document.hidden;
    if (!jouer) { eteindreMusique(courante, document.hidden ? 0.2 : 0.6); courante = null; return; }
    if (courante && courante.nom === musiqueVoulue) return;
    const nom = musiqueVoulue, a = ac(); if (!a) return;
    chargerMusique(nom).then((buf) => {
      if (!buf || musiqueVoulue !== nom || !SON.musique || musiquePause || document.hidden || (courante && courante.nom === nom)) return;
      eteindreMusique(courante, FONDU);
      const src = a.createBufferSource(), gain = a.createGain();
      src.buffer = buf; src.loop = true;
      gain.gain.setValueAtTime(0, a.currentTime); gain.gain.linearRampToValueAtTime(volumeMusique(), a.currentTime + FONDU);
      src.connect(gain); gain.connect(a.destination); src.start();
      courante = { nom, src, gain };
    });
  }
  function musique(nom) { musiqueVoulue = nom; majMusique(); }
  function baisserMusique(oui, duree) {
    clearTimeout(baisseTimer); baisse = oui;
    if (oui) baisseTimer = setTimeout(() => baisserMusique(false), duree * 1000);   // au cas où la voix ne dit pas qu'elle a fini
    if (courante) { try { const t = actx.currentTime; courante.gain.gain.cancelScheduledValues(t); courante.gain.gain.setValueAtTime(courante.gain.gain.value, t); courante.gain.gain.linearRampToValueAtTime(volumeMusique(), t + 0.4); } catch (e) { /* ignore */ } }
  }
  // Le navigateur n'autorise le son qu'après un geste : au premier toucher (ou touche du clavier), la musique commence ;
  // après une pause de Ludiworld, le toucher suivant la relance.
  function premierGeste() {
    geste = true; musiquePause = false;
    const a = ac(); if (a && a.state === 'suspended' && a.resume) a.resume();
    majMusique();
  }
  window.addEventListener('pointerdown', premierGeste, true);
  window.addEventListener('keydown', premierGeste, true);
  document.addEventListener('visibilitychange', majMusique);
  // Pour les tests : le morceau qu'on entend en ce moment (ou null), et le réglage du son.
  window.__musique = () => (courante ? courante.nom : null);
  window.__son = () => Object.assign({}, SON);

  // ---------- écrans ----------
  const screens = ['title', 'tower', 'card', 'game', 'end'];
  let current = 'title';
  function show(name) {
    if (name !== current) pushScreen(name);
    current = name;
    for (const s of screens) { const el = $('#' + s); const was = !el.hidden; el.hidden = s !== name; if (s === name && !was) { el.classList.remove('in'); void el.offsetWidth; el.classList.add('in'); } }
    if (name !== 'game') stopLoop();
    // dans une salle, le haut-parleur est dans le bandeau du haut ; ailleurs, en haut à droite
    $('#btnSon').hidden = name === 'game';
    ouvrirSon(false);
    musique(PISTES[name]);
  }

  // ---------- le bouton du son : un haut-parleur qui ouvre trois réglages (Musique, Bruitages, Voix) ----------
  // L'état se voit à la forme, pas seulement à la couleur : icône barrée, interrupteur avec ✓ ou ✕ et pastille à droite ou à gauche.
  const ICO = {
    hp: (ondes) => '<svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true"><path d="M5 12h5l7-6v20l-7-6H5z" fill="currentColor"/>'
      + (ondes === 0 ? '<path d="M21 11l8 10M29 11l-8 10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>'
        : '<path d="M21 12.5a5 5 0 0 1 0 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>'
          + (ondes > 1 ? '<path d="M24.5 9a10 10 0 0 1 0 14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>' : '')) + '</svg>',
    musique: '<path d="M12 23V8l13-3v15" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linejoin="round"/><ellipse cx="9" cy="23" rx="4" ry="3.2" fill="currentColor"/><ellipse cx="22" cy="20" rx="4" ry="3.2" fill="currentColor"/>',
    bruitages: '<path d="M16 3l3 8 8 1-6 5 2 9-7-5-7 5 2-9-6-5 8-1z" fill="currentColor"/>',
    voix: '<path d="M5 7h22v14H14l-6 5v-5H5z" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linejoin="round"/><path d="M10 12h12M10 16h8" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
  };
  const NOMS_SON = { musique: 'Musique', bruitages: 'Bruitages', voix: 'Voix' };
  function reglerSon(o) {
    if (LUDI && LUDI.reglerSon) LUDI.reglerSon(o);   // Ludi.onSon nous renvoie le nouveau réglage
    else { SON = Object.assign({}, SON, o); appliquerSon(); }
  }
  function appliquerSon() {
    if (!SON.voix) taire();
    majMusique(); majBoutonsSon();
  }
  function majBoutonsSon() {
    const n = ['musique', 'bruitages', 'voix'].filter((k) => SON[k]).length;
    const ondes = n === 3 ? 2 : n === 0 ? 0 : 1;
    for (const b of [$('#btnSon'), $('#btnSonHud')]) { b.innerHTML = ICO.hp(ondes); b.dataset.ondes = ondes; }
    for (const b of document.querySelectorAll('#sonPanel [data-son]')) {
      const k = b.dataset.son, on = SON[k];
      b.setAttribute('aria-checked', on ? 'true' : 'false'); b.classList.toggle('off', !on);
      b.innerHTML = `<svg class="ico-son" viewBox="0 0 32 32" width="34" height="34" aria-hidden="true">${ICO[k]}${on ? '' : '<path class="barre" d="M4 4l24 24"/>'}</svg>`
        + `<span class="nom">${NOMS_SON[k]}</span><span class="inter" aria-hidden="true"><i>${on ? '✓' : '✕'}</i></span>`;
    }
    // « Écouter » n'a plus de sens quand la voix est coupée : on le cache
    $('#btnIntroRead').hidden = !SON.voix; $('#btnRead').hidden = !SON.voix;
  }
  function ouvrirSon(oui) {
    const p = $('#sonPanel'); p.hidden = !oui;
    p.classList.toggle('jeu', current === 'game');
    for (const b of [$('#btnSon'), $('#btnSonHud')]) b.setAttribute('aria-expanded', oui ? 'true' : 'false');
  }
  $('#btnSon').onclick = () => ouvrirSon($('#sonPanel').hidden);
  for (const b of document.querySelectorAll('#sonPanel [data-son]')) b.onclick = () => { const k = b.dataset.son; reglerSon({ [k]: !SON[k] }); };
  // un toucher ailleurs referme les réglages
  document.addEventListener('pointerdown', (e) => { if (!$('#sonPanel').hidden && !e.target.closest('#sonPanel, #btnSon, #btnSonHud')) ouvrirSon(false); }, true);
  if (LUDI && LUDI.onSon) LUDI.onSon((s) => { SON = Object.assign({}, SON, s); appliquerSon(); });
  else appliquerSon();

  // ---------- titre ----------
  // ---------- plein écran, installation, bouton retour ----------
  const docEl = document.documentElement;
  const STANDALONE = (window.matchMedia && (window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: fullscreen)').matches)) || window.navigator.standalone === true;
  const IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const canFullscreen = !!(docEl.requestFullscreen || docEl.webkitRequestFullscreen);
  function isFullscreen() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
  function toggleFullscreen() {
    if (DANS_LUDI) return;
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
      b.hidden = STANDALONE || !canFullscreen || DANS_LUDI; // dans Ludiworld, c'est Ludiworld qui décide du plein écran
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
    $('#btnPlay').onclick = () => {
      unlockAudio();
      const neuve = !progress.done.length && !progress.room && progress.floor === 1;
      // une partie qui commence : d'abord l'histoire (la sorcière emporte Mei Mei), puis la tour
      if (neuve) cinematique('intro', () => { show('tower'); renderTower(); });
      else { show('tower'); renderTower(); }
    };
    $('#btnReset').onclick = () => { progress = { floor: 1, room: 0, done: [], fini: !!progress.fini }; save(); renderTitle(); };
    $('#btnIntroRead').onclick = () => speak(INTRO.lines.join(' '));
    renderTitle();
  }
  function renderTitle() {
    $('#btnPlay').textContent = progress.done.length || progress.room ? `Continuer (étage ${progress.floor})` : 'Jouer';
    $('#btnReset').hidden = !(progress.done.length || progress.room);
    $('#fini').hidden = !progress.fini;
    $('#finiTxt').textContent = HISTOIRE[LANG].fini;
  }

  // ---------- histoire : une intro au premier départ, une fin quand Mei Mei est libre ----------
  // Une petite vidéo si elle est là (version installée et aperçu), sinon directement l'image et le texte
  // (fichier unique, hors ligne, mouvement réduit). « Passer » saute à l'image et au texte.
  const LANG = /^en/i.test(new URLSearchParams(location.search).get('lang') || document.documentElement.lang || '') ? 'en' : 'fr';
  const HISTOIRE = {
    fr: {
      intro: ['La sorcière a emporté Mei Mei, notre chat, en haut de sa tour.', 'Avec ton aimant, monte les seize étages et va le délivrer !'], introGo: 'En route !',
      fin: ['Tu as ouvert la cage tout en haut de la tour !', 'Mei Mei est libre, et la sorcière s’envole au loin.'], finTitre: 'Fin', finGo: 'Continuer',
      passer: 'Passer', fini: 'Fini',
    },
    en: {
      intro: ['The witch has carried Mei Mei, our cat, to the top of her tower.', 'With your magnet, climb the sixteen floors and set Mei Mei free!'], introGo: 'Let’s go!',
      fin: ['You opened the cage at the very top of the tower!', 'Mei Mei is free, and the witch flies far away.'], finTitre: 'The End', finGo: 'Continue',
      passer: 'Skip', fini: 'Finished',
    },
  };
  const CINE = {
    intro: { video: (window.CINE || {}).intro, image: 'assets/histoire_debut.webp', titre: null, lignes: 'intro', go: 'introGo' },
    fin: { video: (window.CINE || {}).fin, image: 'assets/histoire_fin.webp', titre: 'finTitre', lignes: 'fin', go: 'finGo' },
  };
  function cinematique(nom, ensuite) {
    const c = CINE[nom], t = HISTOIRE[LANG], box = $('#cine'), vid = box.querySelector('video'), img = box.querySelector('.fixe'), h2 = box.querySelector('h2');
    h2.textContent = c.titre ? fr(t[c.titre]) : ''; h2.hidden = !c.titre;
    box.querySelector('.l1').textContent = fr(t[c.lignes][0]); box.querySelector('.l2').textContent = fr(t[c.lignes][1]);
    box.querySelector('.go').textContent = fr(t[c.go]); box.querySelector('.passer').textContent = t.passer;
    img.src = c.image; box.classList.remove('texte'); box.hidden = false;
    ouvrirSon(false);
    musique(nom === 'fin' ? 'fin' : 'tour');
    let lu = false;
    const texte = () => {
      vid.pause(); box.classList.add('texte');
      if (!lu) { lu = true; if (LANG === 'fr') speak(t[c.lignes].join(' ')); }
    };
    vid.onended = texte; vid.onerror = texte;
    if (c.video && !REDUCED) { vid.hidden = false; vid.src = c.video; const p = vid.play(); if (p && p.catch) p.catch(texte); }
    else { vid.hidden = true; vid.removeAttribute('src'); texte(); }
    box.querySelector('.go').onclick = () => {
      vid.pause(); vid.removeAttribute('src'); box.hidden = true;
      taire();
      if (ensuite) ensuite();
    };
    box.querySelector('.passer').onclick = texte;
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
    if (DANS_LUDI) ludiDegager();
  }
  // Dans Ludiworld, le bouton « ← Ludiworld » du launcher occupe le coin haut gauche de l'écran (à 8 px du bord, environ 117 × 34 px) :
  // le texte du bandeau du haut (marche, étage) se pousse à sa droite. Les autres écrans sont centrés, rien à faire. Ouvert seul, rien ne bouge.
  function ludiDegager() {
    const hud = $('#hud');
    const pad = !L.rot && L.Y < 50 ? Math.ceil((135 - L.X) / L.s) : 0;
    hud.style.paddingLeft = Math.max(16, pad) + 'px';
    // salle très chargée (beaucoup d'outils) : les boutons passent avant, on rend juste la place qui manque
    const trop = hud.scrollWidth - hud.clientWidth;
    if (trop > 0) hud.style.paddingLeft = Math.max(16, pad - trop) + 'px';
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
    $('#hint').hidden = true; hintCount = 0; ludiAide = false;
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
    if (DANS_LUDI) ludiDegager();
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
  tap($('#btnShow'), () => { ludiAide = true; resetWorld(); buildHud(); startDemo('once'); });
  tap($('#btnTower'), () => { show('tower'); renderTower(); });
  tap($('#btnSonHud'), () => ouvrirSon($('#sonPanel').hidden));
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
    if (ludiFige) { ludiFige = false; if (current === 'game' && !raf) { lastT = performance.now(); raf = requestAnimationFrame(loop); } }
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
  // Le launcher Ludiworld demande une pause (temps de jeu écoulé) : on lâche l'aimant, on se tait et la salle se fige.
  // Un nouveau toucher sur la salle la relance.
  let ludiFige = false;
  if (LUDI) LUDI.onPause(() => {
    taire();
    musiquePause = true; majMusique();   // la musique s'arrête ; le toucher suivant la relance
    if (current !== 'game' || !world) return;
    if (activePointer !== null) { activePointer = null; world.pointerUp(); }
    stopLoop(); ludiFige = true;
  });

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
    ctx.save();
    ctx.translate(x, y);                       // la main levée est sur le doigt
    ctx.rotate(lean);
    ctx.scale(hero.face, 1);
    ctx.drawImage(img, -w * HERO.handX, -h * HERO.handY, w, h);
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
      case 'latched': SFX.latch(); if (b) { spawnBurst(c.x, b.y, 12, '#9fd6a8', 200); flashes.push({ x: c.x, y: b.y - 20, t: 0.7, text: 'Clic !' }); } break;
      case 'door': SFX.door(); shake = Math.max(shake, 0.2); spawnSmoke(ev.x, 140, 16, 1); flashes.push({ x: ev.x, y: 300, t: 1.4, text: 'La porte s’ouvre !' }); break;
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
      ludiSalleFinie(room, floor, room.kind === 'atelier' ? 'atelier' : 'salle');
      SFX.room();
      startRoom(floor.n, room.index + 1);
      return;
    }
    if (!progress.done.includes(floor.n)) progress.done.push(floor.n);
    if (floor.n >= progress.floor) { progress.floor = Math.min(TOTAL, floor.n + 1); progress.room = 0; }
    if (floor.final) progress.fini = true;
    save();
    ludiSalleFinie(room, floor, floor.final ? 'tour' : 'etage');
    if (floor.final) { if (LUDI) LUDI.fini(); stopLoop(); cinematique('fin', showEnd); return; }
    startFlight();
  }
  // La sorcière arrive par la fenêtre, attrape la cage, et repart avec le chat
  function startFlight() {
    const c = room.cage || { x: W - 240, y: 540 };
    flight = { phase: 'in', t: 0, from: { x: W + 260, y: 120 }, to: { x: c.x - 70, y: c.y - 235 }, cageTaken: false, spoken: false };
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
    if (flight.cageTaken) {
      // La cage garde sa taille et sa position à la prise, puis suit le balai.
      ctx.save(); ctx.strokeStyle = '#b8a28a'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(p.x + 145, p.y + 194); ctx.lineTo(p.x + 145, p.y + 249); ctx.stroke();
      ctx.restore();
      drawImageFit(IMG.chat_cage, { x: p.x + 70, y: p.y + 235, w: 150, h: 180 });
    }
    drawImageFit(IMG.sorciere_vol, { x: p.x, y: p.y, w: 300, h: 270 }, 'center');
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
    iron: '#5a6068', ironLine: '#2c3036', rivet: '#8e959e', pit: '#120c1a', zone: 'rgba(255,250,236,0.055)', zoneLine: 'rgba(255,220,120,0.75)',
    red: '#e0453a', blue: '#2f6fd6', gold: '#e8b73a', hand: '#f3c89c', text: '#fff6e6',
  };
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
  function objet(name, x, y, w, h, flip = false, flipY = false) {
    const im = IMG['obj-' + name]; if (!im) return false;
    if (flip || flipY) { ctx.save(); ctx.translate(x + (flip ? w : 0), y + (flipY ? h : 0)); ctx.scale(flip ? -1 : 1, flipY ? -1 : 1); ctx.drawImage(im, 0, 0, w, h); ctx.restore(); }
    else ctx.drawImage(im, x, y, w, h);
    return true;
  }
  // Une haute porte de planches : le haut et le bas gardent leurs proportions, le milieu alterne bandes de fer et planches.
  function hautePorte(s) {
    const d = s.w >= 60 ? 'porte3' : 'porte2', I = (k) => IMG[`obj-${d}-${k}`];
    if (!I('haut') || !I('bande') || !I('planches') || !I('bas')) return false;
    const w = s.w + 6, x = s.x - 3, hh = hauteur(`${d}-haut`, w), hb = hauteur(`${d}-bas`, w), hband = hauteur(`${d}-bande`, w);
    ctx.save(); ctx.beginPath(); ctx.rect(x, s.y, w, s.h); ctx.clip();
    objet(`${d}-haut`, x, s.y, w, hh);
    const y0 = s.y + hh - 1, y1 = s.y + s.h - hb + 1, n = Math.max(1, Math.round((y1 - y0) / 130)), step = (y1 - y0) / n;
    for (let i = 0; i < n; i++) {
      const y = y0 + i * step;
      objet(`${d}-bande`, x, y, w, hband);
      objet(`${d}-planches`, x, y + hband - 1, w, step - hband + 2);
    }
    objet(`${d}-bas`, x, y1 - 1, w, hb + 1);
    ctx.restore();
    return true;
  }
  function drawShaft(x, y, w, h) {
    paintMaterial('pierre', { x, y, w, h });
    const down = ctx.createLinearGradient(0, y, 0, y + h);
    down.addColorStop(0, 'rgba(14,10,26,.45)'); down.addColorStop(0.3, 'rgba(14,10,26,.82)'); down.addColorStop(0.7, 'rgba(10,7,18,.97)'); down.addColorStop(1, 'rgba(8,5,14,1)');
    ctx.fillStyle = down; ctx.fillRect(x, y, w, h);
    const side = Math.min(w * 0.3, 26);
    const l = ctx.createLinearGradient(x, 0, x + side, 0); l.addColorStop(0, 'rgba(8,6,16,.7)'); l.addColorStop(1, 'rgba(8,6,16,0)');
    ctx.fillStyle = l; ctx.fillRect(x, y, side, h);
    const r = ctx.createLinearGradient(x + w, 0, x + w - side, 0); r.addColorStop(0, 'rgba(8,6,16,.7)'); r.addColorStop(1, 'rgba(8,6,16,0)');
    ctx.fillStyle = r; ctx.fillRect(x + w - side, y, side, h);
  }
  // Hauteur d'une image d'objet pour une largeur donnée (garde ses proportions)
  const hauteur = (name, w) => { const im = IMG['obj-' + name]; return im ? w * im.height / im.width : 0; };
  let slideTick = 0;

  function draw(time, dt) {
    const lv = room, w = world;
    ctx.save();
    if (shake > 0 && !REDUCED) ctx.translate((Math.random() - 0.5) * 14 * shake, (Math.random() - 0.5) * 14 * shake);
    ctx.fillStyle = C.stoneA; ctx.fillRect(0, 0, W, H);
    drawBricks();
    if (lv.zone && w.tool && w.tool.type !== 'electro' && w.tool.type !== 'compass') drawZone(time);
    drawMagneticFields(time);
    if (lv.well) drawShaft(lv.well.x, lv.well.y, lv.well.w, lv.well.h);
    for (const s of lv.sensors || []) if (s.type === 'trap') drawShaft(s.x, s.y - 2, s.w, H - s.y + 2);
    for (const s of w.solids) drawSolid(s);
    drawOpeningDoors(w);
    drawSensors();
    if (lv.lodestone) drawImageFit(IMG.magnetite, lv.lodestone);
    if (lv.kind === 'atelier') drawSign();
    drawCage(time);
    drawWitch(time);
    if (w.filings) drawFilings();
    drawPulls(time);
    if (w.finger.down && w.tool && w.tool.type !== 'electro') drawHero(w.finger.x, w.finger.y, time);
    // poussière des corps qui glissent
    slideTick += dt;
    if (slideTick > 0.07) { slideTick = 0; for (const b of w.bodies) if (b.grounded && Math.abs(b.vx) > 90 && !b.hidden && !b.captured) spawnSmoke(b.x + b.w / 2 - Math.sign(b.vx) * b.w / 2, b.y + b.h, 1, 0.5); }
    for (const b of w.bodies) drawBody(b, time);
    drawKeepers(w);
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
    const image = IMG['mur-' + String(floor.n).padStart(2, '0')];
    if (image) ctx.drawImage(image, 0, 90, W, H - 90);
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
  const MATERIALS = {};
  function paintMaterial(name, s) {
    const image = IMG['matiere-' + name];
    if (!image) return;
    if (!MATERIALS[name]) {
      const pattern = ctx.createPattern(image, 'repeat');
      pattern.setTransform(new DOMMatrix([320 / image.width, 0, 0, 80 / image.height, 0, 0]));
      MATERIALS[name] = pattern;
    }
    ctx.fillStyle = MATERIALS[name];
    ctx.fillRect(s.x, s.y, s.w, s.h);
  }
  function drawSolid(s) {
    if (s.mat === 'stone') {
      paintMaterial('pierre', s);
      if (s.h >= 150 && s.w >= 100) {
        const g = ctx.createLinearGradient(0, s.y + 12, 0, s.y + s.h);
        g.addColorStop(0, 'rgba(10,12,28,0)'); g.addColorStop(1, 'rgba(10,12,28,.6)');
        ctx.fillStyle = g; ctx.fillRect(s.x, s.y, s.w, s.h);
      }
      if (s.id === 'bottom') { ctx.fillStyle = 'rgba(10,7,18,.82)'; ctx.fillRect(s.x, s.y, s.w, s.h); return; } // le fond du puits, dans l'ombre
      ctx.fillStyle = 'rgba(244,235,219,.38)'; ctx.fillRect(s.x, s.y, s.w, 3);
      ctx.fillStyle = 'rgba(24,29,44,.3)'; ctx.fillRect(s.x, s.y + s.h - 4, s.w, 4);
    } else if (s.mat === 'wood' && s.h > s.w * 3 && hautePorte(s)) {
      // haute porte en images
    } else if (s.mat === 'wood') {
      paintMaterial('bois', s);
      ctx.strokeStyle = 'rgba(104,61,32,.65)'; ctx.lineWidth = 3;
      ctx.strokeRect(s.x + 1.5, s.y + 1.5, s.w - 3, s.h - 3);
    } else if (s.mat === 'glass') {
      ctx.save(); ctx.globalAlpha = .28; paintMaterial('verre', s); ctx.restore();
      ctx.strokeStyle = '#d5f1f3'; ctx.lineWidth = 2;
      ctx.strokeRect(s.x + 1, s.y + 1, s.w - 2, s.h - 2);
      ctx.fillStyle = 'rgba(244,253,255,.5)'; ctx.fillRect(s.x + 4, s.y + 8, 2, Math.max(0, s.h - 16));
    } else if (s.mat === 'iron') {
      paintMaterial('fer', s);
      ctx.strokeStyle = C.ironLine; ctx.lineWidth = 3; ctx.strokeRect(s.x + 1.5, s.y + 1.5, s.w - 3, s.h - 3);
      ctx.fillStyle = C.rivet;
      for (let y = s.y + 14; y < s.y + s.h - 8; y += 40) { ctx.beginPath(); ctx.arc(s.x + s.w / 2, y, 4, 0, 7); ctx.fill(); }
    }
  }
  function drawSensors() {
    for (const s of world.sensors) {
      if (s.type === 'button') {
        if (IMG['obj-plaque']) {
          const pw = s.w + 16, ph = hauteur('plaque', pw), py = s.y + s.h + 4 - ph + (s.pressed ? 6 : 0);
          objet('plaque', s.x - 8, py, pw, ph);
          if (s.pressed) { ctx.fillStyle = 'rgba(90,220,120,.45)'; rr(s.x, py, s.w, ph * 0.45, 5); ctx.fill(); }
        } else {
          ctx.fillStyle = '#3a3340'; rr(s.x - 6, s.y + 8, s.w + 12, s.h - 8 + 6, 6); ctx.fill();
          ctx.fillStyle = s.pressed ? '#3fbf5a' : C.red; rr(s.x, s.y + (s.pressed ? 10 : 0), s.w, 14, 7); ctx.fill();
        }
      } else if (s.type === 'keyhole' && s.cageLock) {
        // dessiné avec la cage (drawCage)
      } else if (s.type === 'alarm') {
        // la cloche : si un garde l'atteint, la salle recommence
        const cx = s.x + s.w / 2, t = performance.now() / 1000, ring = world.failed ? Math.sin(t * 30) * 0.4 : Math.sin(t * 2) * 0.05;
        if (IMG['obj-cloche']) {
          const ch = 150, cw = ch * IMG['obj-cloche'].width / IMG['obj-cloche'].height;
          ctx.save(); ctx.translate(cx, s.y - 150); ctx.rotate(ring * 0.7);
          objet('cloche', -cw / 2, 0, cw, ch);
          ctx.restore();
        } else {
          ctx.fillStyle = '#4a3d36'; ctx.fillRect(cx - 4, s.y - 150, 8, 70);
          ctx.save(); ctx.translate(cx, s.y - 80); ctx.rotate(ring);
          ctx.fillStyle = C.gold; ctx.beginPath(); ctx.moveTo(-38, 60); ctx.quadraticCurveTo(-34, 0, 0, 0); ctx.quadraticCurveTo(34, 0, 38, 60); ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#b8860b'; ctx.fillRect(-42, 56, 84, 10); ctx.beginPath(); ctx.arc(0, 70, 8, 0, 7); ctx.fill();
          ctx.restore();
        }
        ctx.strokeStyle = IMG['obj-cloche'] ? 'rgba(232,183,58,0.3)' : 'rgba(232,183,58,0.5)'; ctx.setLineDash([10, 8]); ctx.lineWidth = 3; ctx.strokeRect(s.x, s.y, s.w, s.h); ctx.setLineDash([]);
      } else if (s.type === 'keyhole') {
        const cx = s.x + s.w / 2, cy = s.y + s.h / 2;
        if (IMG['obj-serrure']) {
          if (s.pressed) { const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, 70); g.addColorStop(0, 'rgba(110,230,140,.7)'); g.addColorStop(1, 'rgba(110,230,140,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 70, 0, 7); ctx.fill(); }
          const lh = 76, lw = lh * IMG['obj-serrure'].width / IMG['obj-serrure'].height;
          objet('serrure', cx - lw / 2, cy - lh / 2, lw, lh);
        } else {
          ctx.fillStyle = s.pressed ? '#3fbf5a' : C.gold; rr(cx - 28, cy - 22, 56, 44, 8); ctx.fill();
          ctx.fillStyle = '#2b2b2b'; ctx.beginPath(); ctx.arc(cx, cy - 6, 8, 0, 7); ctx.fill(); ctx.fillRect(cx - 4, cy - 6, 8, 18);
        }
        if (!s.pressed) { ctx.strokeStyle = C.zoneLine; ctx.setLineDash([8, 8]); ctx.lineWidth = 2; ctx.strokeRect(s.x, s.y, s.w, s.h); ctx.setLineDash([]); }
      } else if (s.type === 'latch') {
        const b = world.body(s.body);
        if (b && b.kind === 'bolt' && b.lockStart) withLift(b.rail.axis === 'y' ? doorLift(world, s.door) : null, () => drawBoltTrack(b, s));
        if (b && b.kind === 'herse') { ctx.fillStyle = '#2c3036'; ctx.fillRect(s.x - 12, s.y - 60, 12, 30); ctx.fillRect(s.x + s.w, s.y - 60, 12, 30); }
      } else if (s.type === 'secret' && s.done) {
        const lv = (s.reveals || []).map((id) => world.body(id)).find((b) => b && b.rail);
        if (IMG['obj-niche']) {
          const top = Math.min(s.y - 6, lv ? lv.rail.min - 30 : s.y - 6), bottom = Math.max(s.y + s.h + 6, lv ? lv.rail.max + lv.h + 30 : 0);
          const nh = bottom - top, nw = Math.max(s.w + 12, nh * IMG['obj-niche'].width / IMG['obj-niche'].height);
          objet('niche', s.x + s.w / 2 - nw / 2, top, nw, nh);
        } else { ctx.fillStyle = C.pit; ctx.fillRect(s.x, s.y, s.w, s.h); }
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
      if (IMG['obj-cadenas']) { const ch = 60, cw = ch * IMG['obj-cadenas'].width / IMG['obj-cadenas'].height; objet('cadenas', -cw / 2, -36, cw, ch); ctx.restore(); }
      else {
      ctx.strokeStyle = '#b8860b'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(0, -18, 15, Math.PI, 0); ctx.stroke();
      ctx.fillStyle = C.gold; rr(-25, -18, 50, 42, 9); ctx.fill(); ctx.strokeStyle = '#8a6508'; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = '#2b2b2b'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, 7); ctx.fill(); ctx.fillRect(-3, 0, 6, 14);
      ctx.restore();
      }
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
      case 'bolt': { const sn = boltSensor(world, b); withLift(sn && b.rail.axis === 'y' ? doorLift(world, sn.door) : null, () => drawBolt(b)); break; }
      case 'ring':
        if (objet('anneau', b.x - 2, b.y - 2, b.w + 4, b.h + 4)) break;
        ctx.strokeStyle = '#8e959e'; ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(b.x + b.w / 2, b.y + b.h / 2, b.w / 2 - 5, 0, 7); ctx.stroke();
        ctx.strokeStyle = '#c9ced4'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(b.x + b.w / 2, b.y + b.h / 2, b.w / 2 - 7, Math.PI * 1.1, Math.PI * 1.6); ctx.stroke();
        break;
      case 'key':
        if (IMG['obj-cle']) {
          const kw = b.w + 16, kh = kw * IMG['obj-cle'].height / IMG['obj-cle'].width;
          objet('cle', b.x - 8, b.y + b.h / 2 - kh / 2, kw, kh);
          if (!b.attached && !b.consumed) {
            ctx.strokeStyle = '#fff1b5'; ctx.lineWidth = 2;
            const size = 3 + Math.sin(time * 4);
            ctx.beginPath(); ctx.moveTo(b.x + b.w - 4, b.y - 7 - size); ctx.lineTo(b.x + b.w - 4, b.y - 7 + size);
            ctx.moveTo(b.x + b.w - 4 - size, b.y - 7); ctx.lineTo(b.x + b.w - 4 + size, b.y - 7); ctx.stroke();
          }
          break;
        }
        {
          const gold = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
          gold.addColorStop(0, '#fff0b5'); gold.addColorStop(.4, '#dcac53'); gold.addColorStop(1, '#987044');
          ctx.strokeStyle = gold; ctx.lineWidth = 7;
          ctx.beginPath(); ctx.arc(b.x + 14, b.y + b.h / 2, 8.5, 0, Math.PI * 2); ctx.stroke();
          ctx.fillStyle = gold; rr(b.x + 22, b.y + b.h / 2 - 4, b.w - 24, 8, 3); ctx.fill();
          ctx.fillRect(b.x + b.w - 10, b.y + b.h / 2, 6, 10); ctx.fillRect(b.x + b.w - 22, b.y + b.h / 2, 6, 8);
          if (!b.attached && !b.consumed) {
            ctx.strokeStyle = '#fff1b5'; ctx.lineWidth = 2;
            const size = 3 + Math.sin(time * 4);
            ctx.beginPath(); ctx.moveTo(b.x + b.w - 4, b.y - 7 - size); ctx.lineTo(b.x + b.w - 4, b.y - 7 + size);
            ctx.moveTo(b.x + b.w - 4 - size, b.y - 7); ctx.lineTo(b.x + b.w - 4 + size, b.y - 7); ctx.stroke();
          }
        }
        break;
      case 'herse': drawHerse(b); break;
      case 'gate': drawGate(b); break;
      case 'lever':
        if (IMG['obj-glissiere'] && IMG['obj-levier'] && b.rail) {
          const cx = b.x + b.w / 2, top = b.rail.min - 24, len = b.rail.max - b.rail.min + b.h + 48;
          objet('glissiere', cx - 20, top, 40, len);
          const hh = b.h, hw = hh * IMG['obj-levier'].width / IMG['obj-levier'].height;
          objet('levier', cx - hw / 2, b.y - 10, hw, hh);
        } else {
          ctx.fillStyle = '#2c3036'; ctx.fillRect(b.x + 8, b.y - 40, 14, b.h + 60);
          ctx.fillStyle = C.wood; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.fillStyle = C.red; ctx.beginPath(); ctx.arc(b.x + b.w / 2, b.y + 6, 16, 0, 7); ctx.fill();
        }
        break;
      case 'giant': drawBar(b.x, b.y, b.w, b.h, b.pole === 'N', true); break;
    }
    ctx.restore();
  }
  function drawStars(x, y, time) {
    ctx.fillStyle = C.gold; ctx.font = 'bold 26px Fredoka, sans-serif'; ctx.textAlign = 'center';
    for (let i = 0; i < 4; i++) { const a = time * 4 + i * Math.PI / 2; ctx.fillText('★', x + Math.cos(a) * 46, y + Math.sin(a) * 12); }
  }
  // Verrou : il glisse dans sa rainure ; au départ il est coincé dans ses crochets (la gâche) et tient la porte.
  function boltTarget(b, s) {
    const r = b.rail, ax = r.axis === 'x';
    const c = ax ? s.x + s.w / 2 - b.w / 2 : (s.snapY ?? s.y + s.h / 2 - b.h / 2);
    const end = Math.abs(c - r.min) < Math.abs(c - r.max) ? r.min : r.max;
    return ax ? { x: end, y: b.lockStart.y } : { x: b.lockStart.x, y: end };
  }
  function drawBoltTrack(b, s) {
    const t = boltTarget(b, s), a = b.lockStart;
    const x0 = Math.min(a.x, t.x) - 5, y0 = Math.min(a.y, t.y) - 5, x1 = Math.max(a.x, t.x) + b.w + 5, y1 = Math.max(a.y, t.y) + b.h + 5;
    ctx.fillStyle = 'rgba(18,10,28,0.55)'; rr(x0, y0, x1 - x0, y1 - y0, 10); ctx.fill();
    if (b.latched) return;
    // chevrons qui montrent dans quel sens tirer
    const ax = b.rail.axis === 'x', dir = Math.sign(ax ? t.x - a.x : t.y - a.y) || -1, now = performance.now() / 1000;
    ctx.strokeStyle = 'rgba(140,240,160,0.85)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const k = ((i / 3 + now * 0.6) % 1);
      const px = ax ? a.x + b.w / 2 + (t.x - a.x) * k : a.x + b.w / 2, py = ax ? a.y + b.h / 2 : a.y + b.h / 2 + (t.y - a.y) * k;
      ctx.globalAlpha = Math.sin(k * Math.PI);
      ctx.beginPath();
      if (ax) { ctx.moveTo(px - dir * 8, py - 9); ctx.lineTo(px + dir * 4, py); ctx.lineTo(px - dir * 8, py + 9); }
      else { ctx.moveTo(px - 10, py - dir * 8); ctx.lineTo(px, py + dir * 4); ctx.lineTo(px + 10, py - dir * 8); }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // la place libre, au bout de la rainure
    ctx.strokeStyle = 'rgba(140,240,160,0.9)'; ctx.setLineDash([8, 6]); ctx.lineWidth = 3; rr(t.x, t.y, b.w, b.h, 8); ctx.stroke(); ctx.setLineDash([]);
  }
  // les crochets (gâche) devant le verrou : tant qu'il est dedans, la porte reste fermée
  function drawKeepers(w) {
    for (const s of w.sensors) {
      if (s.type !== 'latch') continue;
      const b = w.body(s.body); if (!b || b.kind !== 'bolt' || !b.lockStart) continue;
      withLift(doorLift(w, s.door), () => drawKeeper(b, s));
    }
  }
  function drawKeeper(b, s) {
    {
      const a = b.lockStart, t = boltTarget(b, s);
      ctx.strokeStyle = '#1f2328'; ctx.lineWidth = 7; ctx.lineJoin = 'round';
      if (b.rail.axis === 'x') {
        // un anneau sur la porte : le verrou glisse dedans
        const lx = a.x + b.w - (t.x < a.x ? 26 : 74);
        ctx.strokeRect(lx, a.y - 8, 18, b.h + 16);
      } else {
        const up = t.y < a.y;
        for (const ex of [a.x - 4, a.x + b.w - 14]) {
          ctx.beginPath();
          if (up) { ctx.moveTo(ex, a.y - 4); ctx.lineTo(ex, a.y + b.h + 7); ctx.lineTo(ex + 18, a.y + b.h + 7); ctx.lineTo(ex + 18, a.y - 4); }
          else { ctx.moveTo(ex, a.y + b.h + 4); ctx.lineTo(ex, a.y - 7); ctx.lineTo(ex + 18, a.y - 7); ctx.lineTo(ex + 18, a.y + b.h + 4); }
          ctx.stroke();
        }
      }
    }
  }
  // la porte qui se lève dans le plafond
  // une porte qui se lève emporte ses verrous et ses crochets
  function doorLift(w, id) {
    const d = id && w.openingDoors.find((x) => x.id === id); if (!d) return null;
    const k = Math.min(1, (w.time - d.t0) / 0.9);
    return { d, done: k >= 1, dy: -(k * k * (3 - 2 * k)) * d.h };
  }
  function withLift(lift, fn) {
    if (!lift) { fn(); return; }
    if (lift.done) return;
    ctx.save(); ctx.beginPath(); ctx.rect(0, 110, W, 610); ctx.clip(); ctx.translate(0, lift.dy); fn(); ctx.restore();
  }
  function boltSensor(w, b) { return w.sensors.find((x) => x.type === 'latch' && x.body === b.id); }
  function drawOpeningDoors(w) {
    for (const d of w.openingDoors) {
      const k = Math.min(1, (w.time - d.t0) / 0.9); if (k >= 1) continue;
      const e = k * k * (3 - 2 * k);
      ctx.save(); ctx.beginPath(); ctx.rect(d.x - 10, 110, d.w + 20, 610); ctx.clip();
      drawSolid(Object.assign({}, d, { y: d.y - e * d.h }));
      ctx.restore();
    }
  }
  function drawPadlock(x, y, open) {
    if (IMG['obj-cadenas']) {
      const ch = 30, cw = ch * IMG['obj-cadenas'].width / IMG['obj-cadenas'].height;
      if (open) { ctx.fillStyle = 'rgba(90,220,120,.5)'; ctx.beginPath(); ctx.arc(x, y, 20, 0, 7); ctx.fill(); }
      ctx.save(); if (open) ctx.globalAlpha = 0.55; objet('cadenas', x - cw / 2, y - ch / 2 - (open ? 6 : 0), cw, ch); ctx.restore();
      return;
    }
    ctx.save(); ctx.translate(x, y);
    ctx.strokeStyle = open ? '#2e8b45' : '#8a6508'; ctx.lineWidth = 3.5;
    ctx.beginPath(); if (open) ctx.arc(5, -9, 6, Math.PI, 0); else ctx.arc(0, -5, 6, Math.PI, 0); ctx.stroke();
    if (!open) { ctx.beginPath(); ctx.moveTo(-6, -5); ctx.lineTo(-6, 0); ctx.moveTo(6, -5); ctx.lineTo(6, 0); ctx.stroke(); }
    ctx.fillStyle = open ? '#5fd17a' : C.gold; rr(-9, -3, 18, 14, 3); ctx.fill();
    ctx.fillStyle = '#2b2b2b'; ctx.fillRect(-1.5, 1, 3, 6);
    ctx.restore();
  }
  function drawBolt(b) {
    if (IMG['obj-verrou']) {
      const vw = b.w + 20, vh = hauteur('verrou', vw);
      if (b.latched) { ctx.fillStyle = 'rgba(90,220,120,.35)'; rr(b.x - 10, b.y - 4, b.w + 20, b.h + 8, 8); ctx.fill(); }
      objet('verrou', b.x - 10, b.y + b.h / 2 - vh * 0.62, vw, vh);
      if (b.lockStart) drawPadlock(b.x + b.w / 2, b.y + b.h / 2 - 2, b.latched);
      return;
    }
    ctx.fillStyle = '#2c3036'; rr(b.x - 8, b.y - 6, b.w + 16, b.h + 12, 6); ctx.fill();
    ctx.fillStyle = b.latched ? '#9fd6a8' : '#9aa1aa'; rr(b.x, b.y, b.w, b.h, 8); ctx.fill();
    ctx.fillStyle = '#d7dce2'; rr(b.x + 6, b.y + 4, b.w - 12, 5, 3); ctx.fill();
    if (b.lockStart) drawPadlock(b.x + b.w / 2, b.y + b.h / 2 - 2, b.latched);
    else { ctx.fillStyle = '#5a6068'; ctx.beginPath(); ctx.arc(b.x + b.w / 2, b.y + b.h / 2, 5, 0, 7); ctx.fill(); }
  }
  function drawGate(b) {
    if (objet('porte', b.x - 4, b.y, b.w + 8, b.h)) {
      if (b.closing) { ctx.fillStyle = 'rgba(224,69,58,0.8)'; ctx.font = 'bold 30px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('!', b.x + b.w / 2, Math.max(150, b.y + b.h - 20)); }
      return;
    }
    paintMaterial('bois', b);
    ctx.fillStyle = 'rgba(70,39,24,.35)'; for (let x = b.x + 12; x < b.x + b.w - 2; x += 14) ctx.fillRect(x, b.y, 2, b.h);
    ctx.fillStyle = '#5a6068'; for (let y = b.y + 30; y < b.y + b.h; y += 70) ctx.fillRect(b.x - 2, y, b.w + 4, 10);
    ctx.fillStyle = '#5a6068'; for (let x = b.x + 6; x < b.x + b.w; x += 14) { ctx.beginPath(); ctx.moveTo(x - 4, b.y + b.h); ctx.lineTo(x + 4, b.y + b.h); ctx.lineTo(x, b.y + b.h + 12); ctx.fill(); }
    if (b.closing) { ctx.fillStyle = 'rgba(224,69,58,0.8)'; ctx.font = 'bold 30px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('!', b.x + b.w / 2, Math.max(150, b.y + b.h - 20)); }
  }
  function drawHerse(b) {
    if (objet('herse', b.x - 4, b.y, b.w + 8, b.h + 14)) {
      if (b.lockedUntil && !b.lockedUntil(world)) { ctx.font = 'bold 48px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = C.gold; ctx.fillText('🔒', b.x + b.w / 2, b.y - 16); }
      return;
    }
    for (let x = b.x + 6; x < b.x + b.w; x += 30) {
      paintMaterial('fer', { x, y: b.y, w: 10, h: b.h });
      ctx.fillStyle = '#a9b7c2'; ctx.fillRect(x, b.y, 2, b.h);
    }
    for (let y = b.y + 6; y < b.y + b.h; y += 36) {
      paintMaterial('fer', { x: b.x, y, w: b.w, h: 10 });
      ctx.fillStyle = '#b6c1ca'; ctx.fillRect(b.x, y, b.w, 2);
    }
    ctx.fillStyle = '#9aa1aa'; ctx.fillRect(b.x, b.y, b.w, 8);
    if (b.lockedUntil && !b.lockedUntil(world)) { ctx.font = 'bold 48px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = C.gold; ctx.fillText('🔒', b.x + b.w / 2, b.y - 16); }
  }
  function drawBar(x, y, w, h, flipped, big) {
    const left = flipped ? C.red : C.blue, right = flipped ? C.blue : C.red;
    if (!objet('aimant', x - 2, y - 2, w + 4, h + 4, flipped)) for (const [index, color] of [left, right].entries()) {
      const paint = ctx.createLinearGradient(0, y, 0, y + h);
      paint.addColorStop(0, color === C.red ? '#ef9177' : '#8ab9e6');
      paint.addColorStop(.4, color); paint.addColorStop(1, color === C.red ? '#933f42' : '#354c86');
      ctx.fillStyle = paint; rr(x + index * w / 2, y, w / 2, h, 7); ctx.fill();
    }
    if (!IMG['obj-aimant']) { ctx.fillStyle = 'rgba(255,249,231,.35)'; ctx.fillRect(x + w / 2 - 1, y + 3, 2, h - 6); }
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.font = `bold ${big ? 36 : 20}px Fredoka, sans-serif`;
    ctx.fillText(flipped ? 'N' : 'S', x + w / 4, y + h / 2 + (big ? 13 : 7)); ctx.fillText(flipped ? 'S' : 'N', x + 3 * w / 4, y + h / 2 + (big ? 13 : 7));
  }
  function drawPoleLabel(b) { drawBar(b.x - 14, b.y + b.h * 0.45, b.w + 28, 26, b.pole === 'N', false); }
  function drawHiddenPole(b) {
    const y = b.y + b.h * 0.45;
    ctx.fillStyle = '#7a6a8a'; rr(b.x - 14, y, b.w + 28, 26, 8); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 20px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('? ?', b.x + b.w / 2, y + 19);
  }
  function curvePoint(curve, t) {
    const u = 1 - t;
    return {
      x: u * u * u * curve.a.x + 3 * u * u * t * curve.b.x + 3 * u * t * t * curve.c.x + t * t * t * curve.d.x,
      y: u * u * u * curve.a.y + 3 * u * u * t * curve.b.y + 3 * u * t * t * curve.c.y + t * t * t * curve.d.y,
    };
  }
  function traceField(curve, source) {
    ctx.beginPath();
    let connected = false;
    for (let i = 0; i <= 40; i++) {
      const p = curvePoint(curve, i / 40);
      if (source && world.blockedByIron(source, p)) { connected = false; continue; }
      if (connected) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y);
      connected = true;
    }
    ctx.stroke();
  }
  function fieldArrow(curve, t, direction, size, color) {
    const p = curvePoint(curve, t), next = curvePoint(curve, Math.min(1, t + .015));
    const angle = Math.atan2(next.y - p.y, next.x - p.x) + (direction < 0 ? Math.PI : 0);
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(angle);
    ctx.fillStyle = color; ctx.beginPath();
    ctx.moveTo(size, 0); ctx.lineTo(-size, -size * .55); ctx.lineTo(-size * .5, 0); ctx.lineTo(-size, size * .55);
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
  function drawMagneticFields(time) {
    for (const source of world.sources) {
      // Les aimants cachés de la boussole restent à découvrir.
      if (!source.root || source.kind === 'fixed' || !source.range) continue;
      ctx.save();
      ctx.beginPath(); ctx.arc(source.x, source.y, source.range, 0, Math.PI * 2); ctx.clip();
      ctx.lineCap = 'round';
      for (const side of [-1, 1]) {
        for (const fraction of [.3, .62, 1]) {
          const spread = source.range * fraction;
          let curve;
          if (source.poleLeft) {
            const north = source.poleLeft === 'N' ? -1 : 1;
            const y = source.y + (source.kind === 'horseshoe' ? 14 : 0);
            curve = { a: { x: source.x + north * 34, y }, b: { x: source.x + north * spread, y: y + side * spread },
              c: { x: source.x - north * spread, y: y + side * spread }, d: { x: source.x - north * 34, y } };
          } else {
            curve = { a: { x: source.x, y: source.y - 18 }, b: { x: source.x + side * spread, y: source.y - spread },
              c: { x: source.x + side * spread, y: source.y + spread }, d: { x: source.x, y: source.y + 18 } };
          }
          const gradient = ctx.createLinearGradient(curve.a.x, curve.a.y, curve.d.x, curve.d.y);
          gradient.addColorStop(0, source.poleLeft ? '#e86451' : '#f8e8b2');
          gradient.addColorStop(.5, '#f8e8c6');
          gradient.addColorStop(1, source.poleLeft ? '#70b8ec' : '#c8e4ef');
          ctx.strokeStyle = 'rgba(35,43,62,.2)'; ctx.lineWidth = 5; traceField(curve, source);
          ctx.strokeStyle = gradient; ctx.globalAlpha = .75; ctx.lineWidth = 2.3; traceField(curve, source);
          const t = REDUCED ? .5 : .2 + ((time * .18 + fraction * .31) % .6);
          const point = curvePoint(curve, t);
          if (source.poleLeft && !world.blockedByIron(source, point)) fieldArrow(curve, t, 1, 5, '#fdf3da');
          ctx.globalAlpha = 1;
        }
      }
      ctx.restore();
    }
  }
  function drawPulls(time) {
    ctx.save(); ctx.lineCap = 'round';
    for (const pull of world.pulls) {
      const dx = pull.from.x - pull.to.x, dy = pull.from.y - pull.to.y, distance = Math.hypot(dx, dy);
      if (distance < 12) continue;
      const bend = Math.min(22, distance * .1), nx = -dy / distance, ny = dx / distance;
      const curve = { a: pull.to, b: { x: pull.to.x + dx / 3 + nx * bend, y: pull.to.y + dy / 3 + ny * bend },
        c: { x: pull.to.x + dx * 2 / 3 + nx * bend, y: pull.to.y + dy * 2 / 3 + ny * bend }, d: pull.from };
      const color = pull.sign > 0 ? '#fff1b4' : '#f18b68';
      ctx.strokeStyle = 'rgba(41,37,53,.5)'; ctx.lineWidth = 6; traceField(curve);
      ctx.strokeStyle = color; ctx.lineWidth = 2.5; traceField(curve);
      for (let i = 0; i < 3; i++) {
        const phase = REDUCED ? (i + .5) / 3 : ((time * .7 + i / 3) % 1);
        const t = .12 + .76 * (pull.sign > 0 ? phase : 1 - phase);
        fieldArrow(curve, t, pull.sign, 7, color);
      }
    }
    ctx.restore();
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
      ctx.strokeStyle = 'rgba(245,237,214,.32)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, src.range, 0, Math.PI * 2); ctx.stroke();
    }
    if (t.type === 'bar') drawBar(x - 36, y - 15, 72, 30, w.flipped, false);
    else if (t.type === 'double') { drawBar(x - 42, y - 30, 84, 28, w.flipped, false); drawBar(x - 42, y + 2, 84, 28, w.flipped, false); }
    else if (t.type === 'horseshoe') drawHorseshoe(x, y, w.flipped);
    else if (t.type === 'nail') drawNail(x, y, w.nailCharge);
    else if (t.type === 'compass') drawCompass(x, y);
    if (demo) { ctx.fillStyle = C.text; ctx.font = 'bold 24px Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Regarde…', x, y - 60); }
    ctx.restore();
  }
  function drawHorseshoe(x, y, flipped) {
    if (IMG['obj-fer']) {
      const fw = 86, fh = hauteur('fer', fw), top = y - 44;
      objet('fer', x - fw / 2, top, fw, fh, flipped, true);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 18px Fredoka, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(flipped ? 'N' : 'S', x - 30, top + fh * 0.68); ctx.fillText(flipped ? 'S' : 'N', x + 30, top + fh * 0.68);
      return;
    }
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
    if (objet('clou', x - 14, y - 38, 28, 83)) return;
    ctx.fillStyle = '#b8bec6'; ctx.fillRect(x - 5, y - 30, 10, 60); ctx.fillStyle = '#8e959e'; rr(x - 14, y - 36, 28, 10, 4); ctx.fill();
    ctx.fillStyle = '#b8bec6'; ctx.beginPath(); ctx.moveTo(x - 5, y + 30); ctx.lineTo(x + 5, y + 30); ctx.lineTo(x, y + 44); ctx.fill();
  }
  function drawCompass(x, y) {
    const painted = objet('boussole', x - 52, y - 52, 104, 104);
    if (!painted) { ctx.fillStyle = '#f7f1e3'; ctx.beginPath(); ctx.arc(x, y, 46, 0, 7); ctx.fill(); ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = 5; ctx.stroke(); }
    const a = world.compassAngle();
    if (a !== null) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      const n = painted ? 32 : 38;
      ctx.fillStyle = C.red; ctx.beginPath(); ctx.moveTo(n, 0); ctx.lineTo(0, -8); ctx.lineTo(0, 8); ctx.fill();
      ctx.fillStyle = C.blue; ctx.beginPath(); ctx.moveTo(-n, 0); ctx.lineTo(0, -8); ctx.lineTo(0, 8); ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#3a3a3a'; ctx.beginPath(); ctx.arc(x, y, 5, 0, 7); ctx.fill();
  }
  function drawCrane(time) {
    const c = world.crane; if (!c) return;
    const on = world.electroOn;
    paintMaterial('fer', { x: 40, y: 110, w: W - 80, h: 10 });
    if (!objet('chariot', c.x - 34, 98, 68, hauteur('chariot', 68))) { ctx.fillStyle = '#5a6068'; rr(c.x - 30, 104, 60, 22, 6); ctx.fill(); }
    ctx.strokeStyle = '#2c3036'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(c.x, IMG['obj-chariot'] ? 98 + hauteur('chariot', 68) - 4 : 126); ctx.lineTo(c.x, c.y - 30); ctx.stroke();
    const turns = world.turns;
    const steel = ctx.createLinearGradient(c.x - 36, 0, c.x + 36, 0);
    steel.addColorStop(0, '#4b5667'); steel.addColorStop(.35, '#bdc8cd'); steel.addColorStop(.65, '#8c9baa'); steel.addColorStop(1, '#465268');
    ctx.fillStyle = steel; rr(c.x - 36, c.y - 30, 72, 44, 8); ctx.fill();
    const copper = ctx.createLinearGradient(c.x - 38, 0, c.x + 38, 0);
    copper.addColorStop(0, '#81503c'); copper.addColorStop(.3, '#ffd39a'); copper.addColorStop(.55, '#cc864f'); copper.addColorStop(1, '#93523c');
    ctx.strokeStyle = copper; ctx.lineWidth = 5;
    for (let i = 0; i < turns; i++) {
      const y = c.y - 22 + (i + .5) * 32 / turns;
      ctx.beginPath(); ctx.ellipse(c.x, y, 37, 8, 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.fillStyle = steel; rr(c.x - 44, c.y + 10, 88, 14, 6); ctx.fill();
    ctx.fillStyle = on ? '#ffdc7d' : '#697585'; rr(c.x - 33, c.y + 19, 66, 4, 2); ctx.fill();
    const src = world.sources.find((s) => s.kind === 'electro');
    if (src) { ctx.strokeStyle = 'rgba(255,240,200,0.3)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(src.x, src.y, src.range, 0, 7); ctx.stroke(); }
    ctx.fillStyle = '#28344a'; rr(c.x - 52, c.y - 66, 104, 29, 7); ctx.fill();
    ctx.fillStyle = C.text; ctx.font = 'bold 20px Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(on ? 'ALLUMÉ' : 'ÉTEINT', c.x, c.y - 44);
    if (demo) { ctx.fillText('Regarde…', c.x, c.y - 72); }
  }
  function drawFilings() {
    const src = world.sources.find((s) => s.root && s.poleLeft);
    const targets = [];
    if (src) targets.push({ x: src.x, y: src.y, w: 72 });
    for (const b of world.bodies) if (b.pole && !b.hidden) targets.push({ x: b.x + b.w / 2, y: b.y + b.h * 0.45 + 13, w: b.w + 28 });
    ctx.save(); ctx.lineCap = 'round';
    for (const target of targets) {
      const half = target.w / 2;
      ctx.beginPath();
      for (let y = -140; y <= 140; y += 22) {
        for (let x = -half - 150; x <= half + 150; x += 22) {
          if (Math.abs(x) < half + 12 && Math.abs(y) < 24) continue;
          if (Math.hypot(x, y) > half + 145) continue;
          const left = Math.max(16, Math.hypot(x + half, y)), right = Math.max(16, Math.hypot(x - half, y));
          const bx = (x + half) / left ** 3 - (x - half) / right ** 3;
          const by = y / left ** 3 - y / right ** 3;
          const angle = Math.atan2(by, bx), dx = Math.cos(angle) * 5, dy = Math.sin(angle) * 5;
          ctx.moveTo(target.x + x - dx, target.y + y - dy); ctx.lineTo(target.x + x + dx, target.y + y + dy);
        }
      }
      ctx.strokeStyle = 'rgba(249,233,190,.7)'; ctx.lineWidth = 3.5; ctx.stroke();
      ctx.strokeStyle = '#3b485a'; ctx.lineWidth = 1.6; ctx.stroke();
    }
    ctx.restore();
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
      const extension = name.startsWith('mur-') || name.startsWith('matiere-') || name.startsWith('obj-') ? 'webp' : 'png';
      im.src = `assets/${name}.${extension}`;
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
  window.__game = { startRoom, startDemo, get world() { return world; }, get demo() { return demo; }, show, openCard, renderTower, takeControl, FLOORS, cinematique, get progress() { return progress; }, sfx: SFX };
})();
