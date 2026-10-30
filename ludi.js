/*!
 * Ludiworld kit (ludi.js) v0.2.0
 * Temps de jeu, scores, progression et notions apprises, pour les jeux Ludiworld.
 * N'envoie rien sur le réseau. Ne parle qu'au launcher Ludiworld qui a ouvert le jeu.
 * Spec : https://github.com/pikifou/ludiworld/blob/main/spec/kit.md
 */
(function () {
  'use strict';

  var VERSION = '0.2.0';
  var DEFAULT_LAUNCHERS = ['https://pikifou.github.io'];
  var LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
  var MAX_EVENTS = 300;
  var FLUSH_MS = 30000;

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
      } else if (m.type === 'ludi:pause') {
        flush();
        st.pauseFns.forEach(function (fn) { try { fn(m.reason || null); } catch (err) { warn(err); } });
      } else if (m.type === 'ludi:wrapup') {
        var min = Number(m.minutes);
        st.wrapFns.forEach(function (fn) { try { fn(isFinite(min) ? min : null); } catch (err) { warn(err); } });
      }
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
          game: game, key: key, data: data, player: null, pauseFns: [], wrapFns: [],
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

      // Moment où l'enfant peut s'arrêter sans rien perdre (fin de niveau, de course, de série).
      // Le launcher s'en sert pour fermer le jeu en douceur quand le temps du jour est écoulé.
      checkpoint: function (label) {
        if (!ready('checkpoint')) return;
        record({ kind: 'checkpoint', label: label === undefined || label === null ? null : String(label).slice(0, 60) });
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

      // Pour les tests : force l'enregistrement du temps de jeu en cours.
      _flush: function () { flush(); }
    };
    return api;
  }

  if (typeof window !== 'undefined' && !window.Ludi) window.Ludi = createLudi(window);
  if (typeof module !== 'undefined' && module.exports) module.exports = { createLudi: createLudi, VERSION: VERSION };
})();
