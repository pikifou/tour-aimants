/*!
 * Ludiworld kit (ludi.js) v0.5.0
 * Temps de jeu, scores, progression et notions apprises, réglage du son, pour les jeux Ludiworld.
 * N'envoie rien sur le réseau. Ne parle qu'au launcher Ludiworld qui a ouvert le jeu.
 * Spec : https://github.com/pikifou/ludiworld/blob/main/spec/kit.md
 */
(function () {
  'use strict';

  var VERSION = '0.5.0';
  var DEFAULT_LAUNCHERS = ['https://ludiworld.app', 'https://pikifou.github.io'];
  var LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
  var MAX_EVENTS = 300;
  var FLUSH_MS = 30000;
  var MAX_SAVE = 250000; // taille maximale d'une sauvegarde (texte JSON)
  // Le son (Julien, 2026-11-23) : trois réglages séparés, tous allumés au départ ; un jeu ne démarre jamais muet.
  // Dans Ludiworld, c'est le réglage de la maison ; ouvert seul, celui de cet appareil.
  var SON_CLE = 'ludi.v1.son';
  var SON_DEFAUT = { musique: true, bruitages: true, voix: true };
  function sonPropre(o, base) {
    base = base || SON_DEFAUT;
    var out = {};
    for (var k in SON_DEFAUT) out[k] = o && typeof o[k] === 'boolean' ? o[k] : base[k];
    return out;
  }
  function memeSon(a, b) { for (var k in SON_DEFAUT) if (a[k] !== b[k]) return false; return true; }

  function createLudi(win, opts) {
    opts = opts || {};
    var now = opts.now || function () { return Date.now(); };
    var doc = win.document || null;
    var st = null;

    function warn(msg) { try { win.console && win.console.warn('[Ludi] ' + msg); } catch (e) { /* rien */ } }

    function load(key) {
      try { var s = win.localStorage.getItem(key); return s ? JSON.parse(s) : null; } catch (e) { return null; }
    }
    function save() {
      if (!st) return;
      try { win.localStorage.setItem(st.key, JSON.stringify(st.data)); } catch (e) { /* stockage plein ou interdit : on continue */ }
    }
    function emptyData() {
      return { playMs: 0, sessions: 0, firstAt: null, lastAt: null, scores: {}, progress: {}, skills: {}, events: [] };
    }

    function allowed(origin, extra) {
      if (!origin || origin === 'null') return false;
      if (LOCAL_ORIGIN.test(origin)) return true;
      return DEFAULT_LAUNCHERS.concat(extra || []).indexOf(origin) !== -1;
    }

    function findLauncher(extra) {
      var parent;
      try { parent = win.parent; } catch (e) { return null; }
      if (!parent || parent === win) return null;
      var origin = null;
      try {
        var ao = win.location && win.location.ancestorOrigins;
        if (ao && ao.length) origin = ao[0];
      } catch (e) { /* rien */ }
      if (!origin && doc && doc.referrer) {
        try { origin = new URL(doc.referrer).origin; } catch (e) { /* rien */ }
      }
      return allowed(origin, extra) ? origin : null;
    }

    function post(type, payload) {
      if (!st || !st.launcher) return;
      var msg = { type: type, game: st.game };
      for (var k in payload) msg[k] = payload[k];
      try { win.parent.postMessage(msg, st.launcher); } catch (e) { /* rien */ }
    }

    function record(ev) {
      ev.at = now();
      var list = st.data.events;
      var last = list[list.length - 1];
      if (ev.kind === 'session' && last && last.kind === 'session' && last.session === ev.session) {
        last.ms += ev.ms; last.at = ev.at;
      } else {
        list.push(JSON.parse(JSON.stringify(ev)));
        if (list.length > MAX_EVENTS) list.splice(0, list.length - MAX_EVENTS);
      }
      st.data.lastAt = ev.at;
      save();
      post('ludi:event', { event: ev });
    }

    // Temps de jeu : ne compte que quand la page est visible.
    function visible() { return !doc || doc.visibilityState !== 'hidden'; }
    function flush() {
      if (!st || st.activeSince === null) return;
      var t = now();
      var ms = Math.max(0, Math.min(t - st.activeSince, FLUSH_MS * 4));
      st.activeSince = visible() ? t : null;
      if (ms < 250) return;
      st.data.playMs += ms;
      record({ kind: 'session', session: st.sessionId, ms: ms });
    }
    function onVisibility() {
      if (!st) return;
      if (visible()) { if (st.activeSince === null) st.activeSince = now(); }
      else flush();
    }

    function onMessage(e) {
      if (!st || !st.launcher || e.origin !== st.launcher || e.source !== win.parent) return;
      var m = e.data;
      if (!m || typeof m !== 'object') return;
      if (m.type === 'ludi:welcome') {
        var name = m.player && typeof m.player.name === 'string' ? m.player.name.slice(0, 40) : null;
        st.player = name ? { name: name } : null;
        if (m.son && typeof m.son === 'object') changerSon(m.son, false);
        receiveSave(m.save);
      } else if (m.type === 'ludi:pause') {
        flush();
        st.pauseFns.forEach(function (fn) { try { fn(m.reason || null); } catch (err) { warn(err); } });
      } else if (m.type === 'ludi:son') {
        if (m.son && typeof m.son === 'object') changerSon(m.son, false);
      } else if (m.type === 'ludi:wrapup') {
        var min = Number(m.minutes);
        st.wrapFns.forEach(function (fn) { try { fn(isFinite(min) ? min : null); } catch (err) { warn(err); } });
      }
    }

    // Sauvegarde du jeu, gardée par Ludiworld dans le compte du parent : voir Ludi.save et Ludi.onRestore.
    function validSave(sv) {
      return !!(sv && typeof sv === 'object' && isFinite(Number(sv.at)) && sv.data !== undefined && sv.data !== null);
    }
    function saveSize(data) { try { return JSON.stringify(data).length; } catch (e) { return Infinity; } }
    function restoreNow(fn, data) { try { fn(JSON.parse(JSON.stringify(data))); } catch (err) { warn(err); } }
    // Le launcher donne la sauvegarde qu'il garde pour cet enfant. Plus récente que celle de cet appareil : on la rend au jeu.
    // Absente alors que cet appareil en a une : on la lui confie (première fois, ou appareil qui reprend le fil).
    function receiveSave(remote) {
      var local = st.data.save;
      if (validSave(remote) && saveSize(remote.data) <= MAX_SAVE) {
        if (!validSave(local) || Number(remote.at) > Number(local.at)) {
          st.data.save = { data: remote.data, at: Number(remote.at) };
          save();
          st.pending = st.data.save.data;
          if (st.restoreFns.length) { var d = st.pending; st.pending = null; st.restoreFns.forEach(function (fn) { restoreNow(fn, d); }); }
        } else if (Number(remote.at) < Number(local.at)) {
          post('ludi:event', { event: { kind: 'save', data: local.data, at: local.at } });
        }
      } else if (validSave(local)) {
        post('ludi:event', { event: { kind: 'save', data: local.data, at: local.at } });
      }
    }

    // Le son : gardé sur l'appareil (clé commune à tous les jeux de la même adresse), appliqué par le jeu via onSon.
    // depuisJeu : le jeu l'a changé lui-même (son bouton) ; Ludiworld l'apprend et le garde pour toute la maison.
    function changerSon(o, depuisJeu) {
      var nouveau = sonPropre(o, st.son);
      if (!memeSon(nouveau, st.son)) {
        st.son = nouveau;
        try { win.localStorage.setItem(SON_CLE, JSON.stringify(nouveau)); } catch (e) { /* rien */ }
        st.sonFns.forEach(function (fn) { try { fn(sonPropre(nouveau)); } catch (err) { warn(err); } });
      }
      if (depuisJeu) post('ludi:son', { son: sonPropre(st.son) });
    }

    function ready(fnName) {
      if (!st) { warn(fnName + ' appelé avant Ludi.init()'); return false; }
      return true;
    }

    var api = {
      version: VERSION,

      init: function (o) {
        o = o || {};
        var game = String(o.game || '').trim();
        if (!/^[a-z0-9][a-z0-9-]{0,60}$/.test(game)) { warn('init : "game" doit être l\'id de la fiche (minuscules et tirets)'); return api; }
        if (st) { if (st.game !== game) warn('init déjà fait pour ' + st.game); return api; }
        var key = 'ludi.v1.' + game;
        var data = load(key) || emptyData();
        var t = now();
        st = {
          game: game, key: key, data: data, player: null, pauseFns: [], wrapFns: [], restoreFns: [], pending: null,
          son: sonPropre(load(SON_CLE)), sonFns: [],
          launcher: findLauncher(o.launchers),
          sessionId: t, activeSince: visible() ? t : null
        };
        data.sessions += 1;
        if (!data.firstAt) data.firstAt = t;
        data.lastAt = t;
        save();
        if (win.addEventListener) {
          win.addEventListener('message', onMessage);
          win.addEventListener('pagehide', flush);
        }
        if (doc && doc.addEventListener) doc.addEventListener('visibilitychange', onVisibility);
        if (win.setInterval) st.timer = win.setInterval(flush, FLUSH_MS);
        post('ludi:hello', { kit: VERSION });
        return api;
      },

      score: function (key, value, o) {
        if (!ready('score')) return null;
        value = Number(value);
        if (!key || !isFinite(value)) { warn('score : clé ou valeur invalide'); return null; }
        var better = o && o.better === 'lower' ? 'lower' : 'higher';
        var prev = st.data.scores[key];
        var isRecord = !prev || (better === 'lower' ? value < prev.value : value > prev.value);
        if (isRecord) st.data.scores[key] = { value: value, better: better, at: now() };
        record({ kind: 'score', key: String(key), value: value, better: better, record: isRecord });
        return { best: st.data.scores[key].value, record: isRecord };
      },

      progress: function (key, value) {
        if (!ready('progress')) return;
        if (!key) { warn('progress : clé manquante'); return; }
        st.data.progress[key] = { value: value, at: now() };
        record({ kind: 'progress', key: String(key), value: value });
      },

      skill: function (domain, item, success) {
        if (!ready('skill')) return;
        if (!domain) { warn('skill : domaine manquant'); return; }
        var id = String(domain) + (item !== undefined && item !== null ? '/' + item : '');
        var s = st.data.skills[id] || { ok: 0, ko: 0, streak: 0 };
        if (success) { s.ok += 1; s.streak = Math.max(1, s.streak + 1); }
        else { s.ko += 1; s.streak = Math.min(-1, s.streak - 1); }
        s.at = now();
        st.data.skills[id] = s;
        record({ kind: 'skill', domain: String(domain), item: item === undefined ? null : item, success: !!success });
      },

      // Où en est l'enfant dans le jeu : fini() quand le parcours principal est terminé (ça ne s'enlève pas),
      // complet(x) de 0 à 1 pour ce qui reste en option (mode difficile, médailles, étoiles). Le jeu les montre sur son écran
      // principal ; Ludiworld les lit pour ranger le jeu et les garde dans le compte. complet() ne redescend jamais.
      fini: function () {
        if (!ready('fini')) return;
        var e = st.data.etat || (st.data.etat = { fini: false, complet: null });
        if (e.fini) return;
        e.fini = true; e.at = now(); save();
        record({ kind: 'etat', fini: true, complet: e.complet });
      },
      complet: function (x) {
        if (!ready('complet')) return;
        x = Number(x);
        if (!isFinite(x)) { warn('complet : valeur invalide'); return; }
        x = Math.max(0, Math.min(1, Math.round(x * 100) / 100));
        var e = st.data.etat || (st.data.etat = { fini: false, complet: null });
        if (e.complet !== null && e.complet !== undefined && x <= e.complet) return;
        e.complet = x; e.at = now(); save();
        record({ kind: 'etat', fini: !!e.fini, complet: x });
      },

      // Moment où l'enfant peut s'arrêter sans rien perdre (fin de niveau, de course, de série).
      // Le launcher s'en sert pour fermer le jeu en douceur quand le temps du jour est écoulé.
      checkpoint: function (label) {
        if (!ready('checkpoint')) return;
        record({ kind: 'checkpoint', label: label === undefined || label === null ? null : String(label).slice(0, 60) });
      },

      // Sauvegarde complète du jeu (n'importe quoi qui passe par JSON, 250 000 caractères au plus) : étage, village, leçons faites.
      // Ludiworld la garde dans le compte du parent si la copie en ligne est active, pour que l'enfant reprenne sur un autre appareil.
      // À appeler quand le jeu enregistre sa propre sauvegarde. Garde la dernière. Renvoie true si elle est gardée.
      // Option { existante: true } : à l'ouverture, pour confier à Ludiworld une sauvegarde qui date d'avant le kit. Elle est
      // alors réputée très ancienne : si Ludiworld en a déjà une, c'est la sienne qui revient ; sinon il garde celle-ci.
      save: function (data, o) {
        if (!ready('save')) return false;
        if (o && o.existante && st.data.save) return false;
        if (data === undefined || data === null) { warn('save : rien à garder'); return false; }
        if (saveSize(data) > MAX_SAVE) { warn('save : sauvegarde trop grosse (' + MAX_SAVE + ' caractères au plus)'); return false; }
        var copy = JSON.parse(JSON.stringify(data));
        var at = o && o.existante ? 1 : Math.max(now(), st.data.save ? Number(st.data.save.at) + 1 : 0);
        st.data.save = { data: copy, at: at };
        save();
        post('ludi:event', { event: { kind: 'save', data: copy, at: at } });
        return true;
      },

      // Le jeu s'abonne pour recevoir une sauvegarde venue d'un autre appareil : fn(data), appelée au plus une fois par ouverture,
      // seulement si la sauvegarde de Ludiworld est plus récente que celle de cet appareil. Le jeu la range comme la sienne
      // (et se redessine, ou recharge sa page) ; il n'a rien d'autre à faire. Appelée aussitôt si elle est déjà arrivée.
      onRestore: function (fn) {
        if (!ready('onRestore') || typeof fn !== 'function') return;
        st.restoreFns.push(fn);
        if (st.pending) { var d = st.pending; st.pending = null; restoreNow(fn, d); }
      },

      player: function () { return st && st.player ? { name: st.player.name } : null; },

      data: function () {
        if (!st) return null;
        flush();
        return JSON.parse(JSON.stringify(st.data));
      },

      onPause: function (fn) { if (ready('onPause') && typeof fn === 'function') st.pauseFns.push(fn); },

      // Le launcher prévient que le temps de jeu touche à sa fin : le jeu peut inviter à finir la manche.
      onWrapUp: function (fn) { if (ready('onWrapUp') && typeof fn === 'function') st.wrapFns.push(fn); },

      inLauncher: function () { return !!(st && st.launcher); },

      // Le son : { musique, bruitages, voix }, des booléens. Le jeu l'applique (musique, bruitages, voix qui lit les textes).
      son: function () { return sonPropre(st ? st.son : load(SON_CLE)); },
      // fn(son) est appelée tout de suite avec le réglage actuel, puis à chaque changement (Ludiworld, ou le bouton du jeu).
      onSon: function (fn) {
        if (!ready('onSon') || typeof fn !== 'function') return;
        st.sonFns.push(fn);
        try { fn(sonPropre(st.son)); } catch (err) { warn(err); }
      },
      // Le bouton du son du jeu : reglerSon({ musique: false }). Dans Ludiworld, ça change le réglage de toute la maison.
      reglerSon: function (o) {
        if (!ready('reglerSon') || !o || typeof o !== 'object') return null;
        changerSon(o, true);
        return sonPropre(st.son);
      },

      // Pour les tests : force l'enregistrement du temps de jeu en cours.
      _flush: function () { flush(); }
    };
    return api;
  }

  if (typeof window !== 'undefined' && !window.Ludi) window.Ludi = createLudi(window);
  if (typeof module !== 'undefined' && module.exports) module.exports = { createLudi: createLudi, VERSION: VERSION };
})();
