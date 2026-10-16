/* Moteur du jeu « La Tour aux Aimants » : physique magnétique 2D, sans DOM.
   Fonctionne dans le navigateur (window.Engine) et dans Node (module.exports) pour les tests. */
(function (root) {
  'use strict';

  const W = 1280, H = 800;
  const G = 2200;                 // gravité px/s²
  const DT = 1 / 120;             // pas de simulation fixe

  // ---------- Outils (aimants tenus par le doigt, ou grue) ----------
  const TOOLS = {
    bar:       { label: 'Aimant',        strength: 22000,  range: 210, liftMass: 1,   poles: true,  holdOnly: true },
    double:    { label: 'Aimant double', strength: 32000, range: 340, liftMass: 2,   poles: true,  holdOnly: true },
    horseshoe: { label: 'Fer à cheval',  strength: 45000, range: 230, liftMass: 3.5, poles: true,  holdOnly: true },
    nail:      { label: 'Clou',          strength: 16000,  range: 170, liftMass: 0.5, poles: false, holdOnly: true },
    electro:   { label: 'Électroaimant', strength: 36000, range: 240, liftMass: 6,   poles: false, holdOnly: false },
    compass:   { label: 'Boussole',      strength: 0,     range: 0,   liftMass: 0,   poles: false, holdOnly: true },
  };

  // ---------- Corps : valeurs par défaut par type ----------
  const KINDS = {
    knight: { w: 70, h: 110, mat: 'iron', mass: 5,   tag: 'knight', maxSpeed: 380 },
    straw:  { w: 70, h: 110, mat: 'straw', mass: 5,  tag: 'straw' },
    sword:  { w: 26, h: 96,  mat: 'iron', mass: 1,   tag: 'blade', hook: true },
    bolt:   { w: 90, h: 20,  mat: 'iron', mass: 1,   rail: 'x' },
    ring:   { w: 44, h: 44,  mat: 'iron', mass: 0.5, chain: true },
    key:    { w: 54, h: 30,  mat: 'iron', mass: 0.5, chain: true },
    herse:  { w: 180, h: 150, mat: 'iron', mass: 3,  rail: 'y', gravity: true },
    lever:  { w: 30, h: 90,  mat: 'wood', mass: 1,   rail: 'y', grab: true },
    giant:  { w: 170, h: 64, mat: 'iron', mass: 7,   rail: 'x', pole: 'N' },
  };

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }
  function pointIn(p, r) { return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h; }
  function center(b) { return { x: b.x + b.w / 2, y: b.y + b.h / 2 }; }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  // Le segment p1-p2 coupe-t-il le rectangle r ? (Liang–Barsky)
  function segmentHitsRect(p1, p2, r) {
    let t0 = 0, t1 = 1;
    const dx = p2.x - p1.x, dy = p2.y - p1.y;
    const checks = [[-dx, p1.x - r.x], [dx, r.x + r.w - p1.x], [-dy, p1.y - r.y], [dy, r.y + r.h - p1.y]];
    for (const [p, q] of checks) {
      if (p === 0) { if (q < 0) return false; }
      else {
        const t = q / p;
        if (p < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
        else { if (t < t0) return false; if (t < t1) t1 = t; }
      }
    }
    return true;
  }

  function opposite(pole) { return pole === 'N' ? 'S' : 'N'; }

  class World {
    constructor(level) {
      this.level = level;
      this.time = 0;
      this.won = false;
      this.winTime = 0;
      this.flags = {};
      this.events = [];
      this.solids = (level.solids || []).map((s, i) => Object.assign({ id: 's' + i, mat: 'stone' }, s));
      this.bodies = (level.bodies || []).map((b) => {
        const k = KINDS[b.kind] || {};
        const body = Object.assign({ vx: 0, vy: 0, grounded: false, attached: null, captured: false,
          ko: false, latched: false, hidden: false, consumed: false, hooked: false, pole: null }, k, b);
        if (k.hook && b.hook !== false) body.hooked = true;
        if (body.randomPole) body.pole = Math.random() < 0.5 ? 'N' : 'S';
        if (body.rail) {
          const r = body.rail;
          body.rail = typeof r === 'string' ? { axis: r } : Object.assign({}, r);
          if (body.rail.axis === 'x') { body.rail.min = body.rail.min ?? body.x; body.rail.max = body.rail.max ?? body.x; }
          else { body.rail.min = body.rail.min ?? body.y; body.rail.max = body.rail.max ?? body.y; }
        }
        return body;
      });
      this.sensors = (level.sensors || []).map((s) => Object.assign({ pressed: false, done: false }, s));
      this.tools = (level.tools || []).map((t) => Object.assign({}, TOOLS[t.type], t));
      this.toolIndex = 0;
      this.flipped = false;
      this.electroOn = false;
      this.turns = level.turns ?? 1;
      this.filings = false;
      this.nailCharge = 0;
      this.finger = { down: false, x: 0, y: 0, px: 0, py: 0 };
      this.crane = level.crane ? { x: level.crane.x, y: level.crane.y } : null;
      this.grabbing = null;          // corps saisi à la main (levier, grue)
      this.sources = [];
      this.pulls = [];
      this.fingerBlocked = false;
      this.cageOpen = 0;             // 0..1 ouverture de la cage
    }

    // ----- entrées -----
    get tool() { return this.tools[this.toolIndex] || null; }
    selectTool(i) { if (i >= 0 && i < this.tools.length) { this.toolIndex = i; this.flipped = false; } }
    flip() { if (this.tool && this.tool.poles) this.flipped = !this.flipped; }
    toggleElectro() { if (this.tool && this.tool.type === 'electro') this.electroOn = !this.electroOn; }
    addTurn() { if (this.turns < 8) this.turns += 1; }
    toggleFilings() { this.filings = !this.filings; }

    pointerDown(x, y) {
      this.finger.down = true; this.finger.x = this.finger.px = x; this.finger.y = this.finger.py = y;
      // Saisie à la main : levier ou grue
      for (const b of this.bodies) {
        if (b.grab && !b.hidden && pointIn({ x, y }, { x: b.x - 25, y: b.y - 25, w: b.w + 50, h: b.h + 50 })) {
          this.grabbing = { body: b, dy: y - b.y, dx: x - b.x }; return;
        }
      }
      // Passage secret : on tape sur le mur
      for (const s of this.sensors) {
        if (s.type === 'secret' && !s.done && pointIn({ x, y }, s)) {
          s.done = true; this.flags[s.id] = true; this.events.push({ type: 'secret', id: s.id });
          (s.reveals || []).forEach((id) => { const b = this.body(id); if (b) b.hidden = false; });
        }
      }
    }
    pointerMove(x, y) { this.finger.x = x; this.finger.y = y; }
    pointerUp() { this.finger.down = false; this.grabbing = null; }

    body(id) { return this.bodies.find((b) => b.id === id); }
    sensor(id) { return this.sensors.find((s) => s.id === id); }
    captured(id) { const b = this.body(id); return !!(b && b.captured); }
    pressed(id) { const s = this.sensor(id); return !!(s && s.pressed); }
    latched(id) { const b = this.body(id); return !!(b && b.latched); }
    ko(id) { const b = this.body(id); return !!(b && b.ko); }
    railAtMax(id) { const b = this.body(id); if (!b || !b.rail) return false; const v = b.rail.axis === 'x' ? b.x : b.y; return v >= b.rail.max - 2; }
    railAtMin(id) { const b = this.body(id); if (!b || !b.rail) return false; const v = b.rail.axis === 'x' ? b.x : b.y; return v <= b.rail.min + 2; }

    fingerInZone() {
      const z = this.level.zone;
      if (!z) return true;
      const zones = Array.isArray(z) ? z : [z];
      return zones.some((r) => pointIn(this.finger, r));
    }

    // ----- sources magnétiques actives -----
    computeSources() {
      const src = [];
      const tool = this.tool;
      if (tool) {
        if (tool.type === 'electro') {
          const pos = this.crane || { x: W / 2, y: 200 };
          if (this.electroOn) {
            const k = Math.min(this.turns, 8) / (this.level.turnsNeeded || 1);
            const strength = tool.strength * Math.min(k, 1.5);
            src.push({ kind: 'electro', x: pos.x, y: pos.y + 18, strength, range: tool.range,
              liftMass: tool.liftMass * k, poleLeft: null, poleRight: null, root: true });
          }
        } else if (tool.type !== 'compass') {
          const inZone = this.fingerInZone();
          this.fingerBlocked = this.finger.down && !inZone;
          let active = this.finger.down && inZone;
          let strength = tool.strength, liftMass = tool.liftMass;
          if (tool.type === 'nail') {
            active = active && this.nailCharge > 0.02;
            strength *= 0.4 + 0.6 * this.nailCharge;
          }
          if (active) {
            src.push({ kind: tool.type, x: this.finger.x, y: this.finger.y, strength, range: tool.range,
              liftMass, poleLeft: tool.poles ? (this.flipped ? 'N' : 'S') : null,
              poleRight: tool.poles ? (this.flipped ? 'S' : 'N') : null, root: true });
          }
        }
      }
      // Aimants fixes du niveau (cachés ou non)
      for (const m of this.level.magnets || []) {
        src.push(Object.assign({ kind: 'fixed', liftMass: 0, poleLeft: null, poleRight: null, root: true, strength: 6000, range: 180 }, m));
      }
      // Un aimant qui tient déjà un corps : les corps « chaînables » s'accrochent au bout de la chaîne, pas à lui
      for (const s of src) {
        if (s.root) s.hasChild = this.bodies.some((b) => b.attached && !b.attached.parentBody && b.attached.sourceKind === s.kind);
      }
      // Corps aimantés par contact : le dernier maillon accroché devient une petite source (force venue de l'aimant d'origine)
      for (const b of this.bodies) {
        if (b.attached && !b.hidden && !b.child) {
          let p = b;
          while (p.attached && p.attached.parentBody) p = p.attached.parentBody;
          const rootSrc = p.attached && src.find((s) => s.root && s.kind === p.attached.sourceKind);
          if (!rootSrc) continue;
          const c = center(b);
          src.push({ kind: 'induced', x: c.x, y: b.y + b.h - 4, strength: rootSrc.strength * 0.75, range: rootSrc.range * 0.65,
            liftMass: rootSrc.liftMass, poleLeft: null, poleRight: null, root: false, body: b, chainOnly: true });
        }
      }
      return src;
    }

    blockedByIron(p1, p2) {
      for (const s of this.solids) if (s.mat === 'iron' && segmentHitsRect(p1, p2, s)) return true;
      return false;
    }

    // Signe de l'interaction : +1 attire, -1 repousse
    sign(src, b) {
      if (!b.pole || !src.poleLeft) return 1;
      const c = center(b);
      const dx = c.x - src.x, dy = c.y - src.y;
      if (Math.abs(dx) < Math.abs(dy) * 0.6) return 1; // au-dessus / en-dessous : neutre
      const srcFacing = dx > 0 ? src.poleRight : src.poleLeft;         // pôle de l'aimant tourné vers le corps
      const bodyFacing = dx > 0 ? b.pole : opposite(b.pole);              // b.pole = pôle sur le côté gauche du corps
      return srcFacing === bodyFacing ? -1 : 1;
    }

    step(dt) {
      // sous-pas fixes
      let acc = dt;
      while (acc > 0) { const h = Math.min(DT, acc); this.substep(h); acc -= h; }
    }

    substep(dt) {
      this.time += dt;
      const tool = this.tool;
      const f = this.finger;

      // --- grue : la position suit le doigt quand on la tient ---
      if (tool && tool.type === 'electro' && f.down && this.crane) {
        const z = this.level.craneZone || { x: 40, y: 90, w: W - 80, h: 520 };
        this.crane.x = Math.max(z.x, Math.min(z.x + z.w, f.x));
        this.crane.y = Math.max(z.y, Math.min(z.y + z.h, f.y));
      }
      // --- levier saisi à la main ---
      if (this.grabbing) {
        const b = this.grabbing.body;
        if (b.rail) {
          if (b.rail.axis === 'y') b.y = Math.max(b.rail.min, Math.min(b.rail.max, f.y - this.grabbing.dy));
          else b.x = Math.max(b.rail.min, Math.min(b.rail.max, f.x - this.grabbing.dx));
        }
      }
      // --- clou frotté sur la magnétite ---
      if (tool && tool.type === 'nail') {
        const lode = this.level.lodestone;
        if (f.down && lode && pointIn(f, lode)) {
          const moved = Math.hypot(f.x - f.px, f.y - f.py);
          if (moved > 0) this.nailCharge = Math.min(1, this.nailCharge + moved * 0.0035);
        }
        this.nailCharge = Math.max(0, this.nailCharge - dt / 14);
      }
      f.px = f.x; f.py = f.y;

      const sources = this.computeSources();
      this.sources = sources;
      const pulls = [];

      // --- forces magnétiques et accroches ---
      for (const b of this.bodies) {
        if (b.hidden || b.captured || b.latched || b.consumed || b.mat !== 'iron') continue;
        if (b.grab) continue;
        if (b.attached) continue;
        if (b.lockedUntil && !b.lockedUntil(this)) continue;
        const c = center(b);
        let ax = 0, ay = 0, anyPull = false;
        for (const s of sources) {
          if (s.chainOnly && !b.chain) continue;
          if (b.chain && s.root && s.hasChild) continue;
          if (s.body === b || (s.body && s.body.child)) continue;
          const d = dist(s, c);
          const reach = s.range + Math.max(b.w, b.h) * 0.35;
          if (d > reach || d < 0.5) continue;
          if (this.blockedByIron(s, c)) continue;
          const sg = this.sign(s, b);
          const mag = s.strength * Math.max(0, 1 - d / reach) * sg;
          const ux = (s.x - c.x) / d, uy = (s.y - c.y) / d;
          const canLift = s.liftMass >= b.mass;
          ax += ux * mag / b.mass;
          if (canLift) ay += uy * mag / b.mass;
          anyPull = true;
          pulls.push({ from: s, to: c, sign: sg });
          // accroche : corps léger assez proche d'un aimant qui l'attire
          if (canLift && sg > 0) {
            if (s.kind === 'induced') {
              // maillon de chaîne : il s'accroche dès qu'il touche le maillon précédent
              if (dist(center(s.body), c) < (b.h + s.body.h) / 2 + 12) { this.attach(b, s); break; }
            } else {
              const top = { x: c.x, y: b.y };
              const dTop = dist(s, top);
              const attachDist = 34 + (s.kind === 'horseshoe' ? 10 : 0);
              if (dTop < attachDist || (d < attachDist + b.h * 0.5 && dTop < attachDist + 18)) {
                this.attach(b, s);
                break;
              }
            }
          }
        }
        if (b.attached) continue;
        if (anyPull && b.hooked) { b.hooked = false; this.events.push({ type: 'unhook', id: b.id }); }
        b.ax = ax; b.ay = ay;
      }
      this.pulls = pulls;

      // --- intégration ---
      for (const b of this.bodies) {
        if (b.hidden || b.latched || b.consumed || b.grab) continue;
        if (b.captured) { b.vy += G * dt; b.y += b.vy * dt; if (b.y > H + 200) b.hidden = true; continue; }
        if (b.attached) { this.followSource(b); continue; }
        if (b.hooked) { b.vx = b.vy = 0; continue; }
        const ax = b.ax || 0, ay = b.ay || 0;
        if (b.rail) {
          if (b.rail.axis === 'x') {
            b.vx += ax * dt;
            if (b.rail.flingAt !== undefined && b.x > b.rail.flingAt) b.vx = Math.max(b.vx, 700);
            else { b.vx *= Math.exp(-5 * dt); b.vx = Math.max(-500, Math.min(500, b.vx)); }
            if (Math.abs(ax) < 250 && Math.abs(b.vx) < 40) b.vx = 0;
            b.x = Math.max(b.rail.min, Math.min(b.rail.max, b.x + b.vx * dt));
            if (b.pole) this.stopAtMagnet(b);
            if (b.x === b.rail.min || b.x === b.rail.max) b.vx = 0;
          } else {
            if (b.gravity) b.vy += G * dt;
            b.vy += ay * dt;
            b.vy *= Math.exp(-5 * dt); b.vy = Math.max(-500, Math.min(600, b.vy));
            if (!b.gravity && Math.abs(ay) < 250 && Math.abs(b.vy) < 40) b.vy = 0;
            b.y = Math.max(b.rail.min, Math.min(b.rail.max, b.y + b.vy * dt));
            if (b.y === b.rail.min || b.y === b.rail.max) b.vy = 0;
          }
        } else {
          b.vy += (G + ay) * dt;
          b.vx += ax * dt;
          if (b.grounded) {
            const fr = Math.min(Math.abs(b.vx), 500 * dt);
            b.vx -= Math.sign(b.vx) * fr;
            if (Math.abs(ax) < 350 && Math.abs(b.vx) < 30) b.vx = 0;
          } else {
            b.vx *= Math.exp(-0.6 * dt);
          }
          const ms = b.maxSpeed || 900; b.vx = Math.max(-ms, Math.min(ms, b.vx));
          b.vy = Math.max(-1200, Math.min(1500, b.vy));
          this.moveWithCollisions(b, dt);
        }
        b.ax = b.ay = 0;
      }

      // --- interactions : épée sur chevalier ---
      for (const s of this.bodies) {
        if (s.tag !== 'blade' || s.hidden || s.attached) continue;
        if (s.vy < 150) continue;
        for (const k of this.bodies) {
          if (k.tag !== 'knight' || k.ko || k.hidden || k.captured) continue;
          const overlapX = s.x < k.x + k.w && s.x + s.w > k.x;
          if (overlapX && s.y + s.h >= k.y && s.y + s.h <= k.y + k.h * 0.6) {
            this.knockOut(k);
            s.y = k.y + k.h - s.h; s.vy = 0; s.grounded = true;
          }
        }
      }

      // --- capteurs ---
      for (const sn of this.sensors) {
        if (sn.type === 'trap') {
          for (const b of this.bodies) {
            if (b.hidden || b.captured || b.attached || b.latched) continue;
            if (sn.body && sn.body !== b.id) continue;
            if (b.tag === 'straw') continue;
            const c = center(b);
            if (pointIn({ x: c.x, y: b.y + b.h - 4 }, sn) && (b.tag === 'knight' || b.tag === 'straw')) {
              b.captured = true; b.vy = Math.max(0, b.vy); b.vx = 0;
              this.events.push({ type: 'captured', id: b.id });
            }
          }
        } else if (sn.type === 'button') {
          let on = false;
          for (const b of this.bodies) {
            if (b.hidden || b.captured || b.attached) continue;
            if (sn.minMass && b.mass < sn.minMass) continue;
            const overlapX = b.x < sn.x + sn.w && b.x + b.w > sn.x;
            const bottom = b.y + b.h;
            if (overlapX && bottom >= sn.y - 4 && bottom <= sn.y + sn.h + 4) on = true;
          }
          if (on && !sn.pressed) this.events.push({ type: 'button', id: sn.id });
          sn.pressed = on || (sn.sticky && sn.pressed);
          if (sn.pressed && sn.removes) {
            this.solids = this.solids.filter((s) => s.id !== sn.removes);
            sn.removes = null; this.events.push({ type: 'open', id: sn.id });
          }
        } else if (sn.type === 'latch') {
          const b = this.body(sn.body);
          if (b && !b.latched && !b.hidden && pointIn(center(b), sn)) {
            b.latched = true; this.detach(b); b.vx = b.vy = 0;
            if (sn.snapY !== undefined) b.y = sn.snapY;
            this.events.push({ type: 'latched', id: b.id });
          }
        } else if (sn.type === 'keyhole') {
          const b = this.body(sn.body);
          if (b && !b.consumed && !b.hidden && pointIn(center(b), sn)) {
            b.consumed = true; b.hidden = true; b.attached = null; sn.pressed = true;
            this.events.push({ type: 'key', id: sn.id });
          }
        }
      }

      // --- victoire ---
      if (!this.won && this.level.win && this.level.win(this)) {
        this.won = true; this.winTime = this.time; this.events.push({ type: 'win' });
      }
      if (this.won) this.cageOpen = Math.min(1, this.cageOpen + dt * 1.2);
    }

    attach(b, s) {
      b.attached = { source: s, sourceKind: s.kind, parentBody: s.body || null };
      if (s.body) s.body.child = b; else if (b.chain) s.hasChild = true;
      b.vx = b.vy = 0; b.hooked = false; b.grounded = false;
      this.events.push({ type: 'attach', id: b.id });
      this.followSource(b);
    }

    // Un corps accroché suit sa source ; s'il rentre dans un mur, il se décroche.
    followSource(b) {
      const a = b.attached;
      let src = null;
      if (a.parentBody) {
        const p = a.parentBody;
        if (!p.attached || p.hidden) { this.detach(b); return; }
        src = { x: p.x + p.w / 2, y: p.y + p.h - 4 };
      } else {
        src = this.sources.find((s) => s.root && s.kind === a.sourceKind) || null;
        if (!src) { this.detach(b); return; }
        a.source = src; // garde à jour la force transmise
      }
      let nx = src.x - b.w / 2, ny = src.y + 4;
      if (b.rail) {
        if (b.rail.axis === 'y') { nx = b.x; ny = Math.max(b.rail.min, Math.min(b.rail.max, ny)); }
        else { ny = b.y; nx = Math.max(b.rail.min, Math.min(b.rail.max, nx)); }
      }
      const probe = { x: nx, y: ny, w: b.w, h: b.h };
      for (const s of this.solids) {
        if (!rectsOverlap(probe, s)) continue;
        const overlapTop = probe.y + probe.h - s.y;     // le corps traîne sur un sol : on le pose dessus
        if (!b.rail && overlapTop > 0 && probe.y <= s.y + 2 && probe.x + probe.w > s.x + 4 && probe.x < s.x + s.w - 4) {
          ny = s.y - b.h; probe.y = ny; continue;
        }
        this.detach(b); return;
      }
      b.x = nx; b.y = ny;
    }

    detach(b) {
      if (b.attached && b.attached.parentBody) b.attached.parentBody.child = null;
      b.attached = null; b.vx = 0; b.vy = 0; b.grounded = false;
      if (b.child) { const c = b.child; b.child = null; this.detach(c); }
      this.events.push({ type: 'detach', id: b.id });
    }

    knockOut(k) {
      k.ko = true; k.tag = 'knight'; k.koTime = this.time;
      const bottom = k.y + k.h;
      k.h = 62; k.w = 110; k.x -= 20; k.y = bottom - k.h;
      k.vx = 0; k.vy = 0;
      this.events.push({ type: 'ko', id: k.id });
    }

    // Les corps qui portent un aimant ne passent pas à travers l'aimant du doigt
    stopAtMagnet(b) {
      for (const s of this.sources) {
        if (!s.root || s.kind === 'fixed' || s.kind === 'electro') continue;
        const m = { x: s.x - 34, y: s.y - 20, w: 68, h: 40 };
        if (!rectsOverlap(b, m)) continue;
        const cx = b.x + b.w / 2;
        if (cx < s.x) b.x = m.x - b.w; else b.x = m.x + m.w;
        b.vx = 0;
      }
    }

    moveWithCollisions(b, dt) {
      // X
      b.x += b.vx * dt;
      for (const s of this.solids) {
        if (!rectsOverlap(b, s)) continue;
        if (b.vx > 0) b.x = s.x - b.w; else if (b.vx < 0) b.x = s.x + s.w;
        b.vx = 0;
      }
      if (b.pole) this.stopAtMagnet(b);
      // Y
      const wasGrounded = b.grounded, vyBefore = b.vy;
      b.y += b.vy * dt;
      b.grounded = false;
      for (const s of this.solids) {
        if (!rectsOverlap(b, s)) continue;
        if (b.vy > 0) { b.y = s.y - b.h; b.grounded = true; if (!wasGrounded && vyBefore > 250) this.events.push({ type: 'land', id: b.id, v: vyBefore }); }
        else if (b.vy < 0) b.y = s.y + s.h;
        b.vy = 0;
      }
      // sol de secours
      if (b.y + b.h > H + 300) { b.hidden = true; }
      if (b.x < -200 || b.x > W + 200) b.hidden = true;
    }

    // Direction de la boussole (vers la cible désignée par le niveau)
    compassAngle() {
      const t = this.level.compassTarget; if (!t) return null;
      return Math.atan2(t.y - this.finger.y, t.x - this.finger.x);
    }

    drainEvents() { const e = this.events; this.events = []; return e; }
  }

  // Script de doigt : [['down',x,y,t], ['move',x,y,t], ['up',t], ['flip',t], ['tool',i,t], ['electro',t], ['turn',t], ['filings',t], ['tap',x,y,t], ['wait',t]]
  // t = temps absolu (secondes) auquel l'action est terminée ; un 'move' interpole depuis la position précédente.
  class Replay {
    constructor(world, steps) { this.w = world; this.steps = steps; this.i = 0; this.t = 0; this.pos = { x: 0, y: 0 }; this.from = { x: 0, y: 0 }; this.anchorT = 0; this.done = false; }
    get hand() { const s = this.steps[Math.min(this.i, this.steps.length - 1)]; return { x: this.pos.x, y: this.pos.y, down: this.w.finger.down, label: s && s[0] }; }
    step(dt) {
      if (this.done) return;
      this.t += dt;
      const w = this.w;
      while (this.i < this.steps.length) {
        const s = this.steps[this.i];
        const endT = s[s.length - 1];
        if (s[0] === 'move') {
          const x = s[1], y = s[2];
          if (this.t < endT) {
            const k = Math.max(0, Math.min(1, (this.t - this.anchorT) / Math.max(1e-6, endT - this.anchorT)));
            const nx = this.from.x + (x - this.from.x) * k, ny = this.from.y + (y - this.from.y) * k;
            this.pos = { x: nx, y: ny }; if (w.finger.down) w.pointerMove(nx, ny);
            return;
          }
          this.pos = { x, y }; if (w.finger.down) w.pointerMove(x, y);
        } else if (this.t < endT) {
          return;
        } else {
          switch (s[0]) {
            case 'down': this.pos = { x: s[1], y: s[2] }; w.pointerDown(s[1], s[2]); break;
            case 'up': w.pointerUp(); break;
            case 'flip': w.flip(); break;
            case 'tool': w.selectTool(s[1]); break;
            case 'electro': w.toggleElectro(); break;
            case 'turn': w.addTurn(); break;
            case 'filings': w.toggleFilings(); break;
            case 'tap': this.pos = { x: s[1], y: s[2] }; w.pointerDown(s[1], s[2]); w.pointerUp(); break;
            case 'wait': break;
          }
        }
        this.i++; this.anchorT = endT; this.from = { x: this.pos.x, y: this.pos.y };
      }
      this.done = true;
    }
  }

  const Engine = { World, Replay, TOOLS, KINDS, W, H, G, segmentHitsRect, rectsOverlap, pointIn };
  if (typeof module !== 'undefined' && module.exports) module.exports = Engine; else root.Engine = Engine;
})(typeof window !== 'undefined' ? window : globalThis);
