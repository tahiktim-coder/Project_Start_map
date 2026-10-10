/* ═══ Silent Exodus · new screen (?new=1) · tower/Tower.js: the living ship beside the journey ═══════════════════════
   What it is: the tower module of the travel screen (docs/BUILD_A.md §3, §6). It draws only into canvas#ns-ship
   (transparent outside the hull, so space shows round it and through its windows). It reads the REAL game through
   NewScreen.game and never writes game state. No clicks in checkpoint A (BUILD_A §6): only the wheel.
   - People: ShipRoutine.at('travel', t), bent by the real crew: dead not drawn; hurt in the med bay bed (a second hurt in
     their own bunk, asleep); asleep (sedated) in the med bay bed when no one hurt has it, else in their bunk (Cora's and
     Aris's bunks are out of frame on a wide screen); confined standing still at their bunk in the quarters (Cora and
     Aris just inside the frame); nobody stays on a red deck (they wait at the galley table, or in the med bay when the
     quarters are red); Aris tends whoever is in the med bay bed while she is in there.
   - The reactor follows the real energy (ShipArt.reactor.set; a step lower with engineering red); the beat runs 1.1 s at
     100, 1.5 s at 10, a missed beat in four below 25; the conduit carries it up to the bridge (TowerMarks).
   - Red decks from NewScreen.game.decks(); engineering red browns the ship out every 2.9 s.
   - The frame: the galley table at the bottom, or from the roof when the screen is short; the wheel (over the tower only)
     scrolls it, from just above the bridge down to above the engine bell, and it eases back to the usual frame after
     8 s untouched. A new sector: closed until 'opening:done' (5 s at most), then it slides in (1.2 s).
   Source: prototypes/slice/ship.js, minus the price charge, signs, asks, chips, meal, plates and pages (checkpoint B).
   Load after the art files and TowerMarks.js, and after NewScreen.js (it registers itself as 'tower').

   NewScreen.mods.tower = {
     init()                      once: TowerArt.warm() jobs (one a frame), the anchors, the bus
     resize(G)                   sizes canvas#ns-ship (G.W x G.H, CSS G.W * G.k / G.dpr)
     update(dt, t), render(t)    the shell's loop
     pointer(type, e, ax, ay)    only 'wheel' is used (true); the rest returns false
     occupied() → [6 booleans]   someone on deck i now (the outside Lander's lit ports)
     beat(t) → 0..1              the reactor's pulse now (the ports and the plume breathe with it)
     personAt(id) → { x, y } | null   CSS px over that person's head, if in view
     debug() → { cam, k, dark, E, decks, crew, people: [{ id, deck, x, act, say }] }
   }
   Listens: 'shown' 'hud' 'opening:done' 'jump:burn' 'jump:flash'.
   Anchors: 'person:<id>' for the five, 'tower:deck:<name>' for the six decks (CSS px, [] when not in view).
   Uses, if present: NewScreen.mods.voice.speaking() → 'aura' | id | null (the computer's speaker glows while A.U.R.A. talks).
*/
(function () {
    'use strict';
    const A = window.ShipArt, TW = window.TowerArt, SIM = window.ShipRoutine, CE = window.CrewEngine, MK = window.NSTowerMarks;
    if (!A || !TW || !SIM || !CE || !MK) { console.error('Tower: the art files and TowerMarks.js must load first'); return; }
    const L = A.L, S = A.SPOTS;
    const IDS = ['cora', 'jaxon', 'aris', 'vance', 'mira'];
    const DECKS = MK.DECKS;

    const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
    const ease = k => 1 - Math.pow(1 - clamp(k, 0, 1), 3);
    const SLIDE_MS = 1200, OPEN_FALLBACK_MS = 5000, READ_MS = 500, CAM_EASE_MS = 260;
    const TOP_MARGIN = 40, WHEEL_IDLE_MS = 8000;                  // the wheel stops this far above the top deck; untouched this long, the frame eases back
    const LOW_ENERGY = 25, CORE_ENG_DOWN = 0.7, VIG_W = 64;   // VIG_W: the left-edge fade's width (TowerMarks)
    const MOVING = { walk: 1, climb: 1, carry: 1 };

    // ── where people go when the real state moves them (tower art px; deck 2 is the galley and the bunks) ──
    const BUNK = { cora: 'bedCora', jaxon: 'bedJaxon', aris: 'bedAris', vance: 'bedVance', mira: 'bedMira' };
    const CONFINE = { cora: { deck: 2, x: 204, facing: 1 }, aris: { deck: 2, x: 226, facing: 1 },   // standing still at their bunk
        jaxon: { deck: 2, x: 516, facing: -1 }, vance: { deck: 2, x: 536, facing: -1 }, mira: { deck: 2, x: 556, facing: -1 } };
    const SEAT = { cora: ['seatR2', 'sit'], mira: ['seatR1', 'sit'], jaxon: ['seatL2', 'sit'], aris: ['seatL1', 'sit'], vance: ['mealStand', 'idle'] };
    // the quarters red too: they wait in the med bay, all inside the frame on a wide screen (the med bay's door and terminal,
    // at x 226 and 238, are past its left edge)
    const MED_WAIT = { cora: { deck: 3, x: 436, facing: 1 }, jaxon: { deck: 3, x: 372, facing: 1 }, aris: { deck: 3, x: 402, facing: 1 },
        vance: { deck: 3, x: 470, facing: -1 }, mira: { deck: 3, x: 346, facing: 1 } };
    const MEAL_STAND = { deck: 2, x: 548, facing: -1 };
    const spot = name => (name === 'mealStand' ? MEAL_STAND : S[name]);

    // ── the module's own picture state (never game state) ──
    const V = {
        cv: null, ctx: null, jobs: [], inited: false,
        cam: null, manual: null, manualAt: -1e9, offX: 0, people: [], drawn: [],
        slide: { closedUntil: 0, start: null }, dark: false,
        beat: { phase: 0, n: 0, val: 0, onsets: [] },
        E: null, Eshown: 100, coreSet: null, flood: null,
        real: { crew: {}, decks: {}, engDown: false }, readAt: -1e9, dirty: true,
        tendX: null,
    };
    let NS = null;
    const G = () => (NS && NS.G) || {};
    const now = () => (NS && NS.clock ? NS.clock.t : 0);

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // The real game, read (NewScreen.game only: the crew and deck mapping lives in one place, the shell)
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    function call(name, empty) {
        const g = NS && NS.game;
        try { if (g && typeof g[name] === 'function') return g[name](); } catch (err) { console.error('Tower: game.' + name + '() failed', err); }
        return empty;
    }
    function energy() {
        const e = Number(call('energy', 100));
        return Number.isFinite(e) ? clamp(e, 0, 100) : 100;
    }
    function readReal(t) {
        const list = call('crew', []) || [], crew = {};
        list.forEach(c => { if (c && IDS.includes(c.id)) crew[c.id] = { status: c.status || 'well', stress: c.stress || 0 }; });
        const raw = call('decks', {}) || {}, decks = {};
        DECKS.forEach(k => { decks[k] = raw[k] === 'red' ? 'red' : 'ok'; });
        V.real = { crew, decks, engDown: decks.engineering === 'red' };
        V.readAt = t; V.dirty = false;
    }

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // People: the crew's day, bent by the real state
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    function stay(id, s, act, t, say) {
        const lying = act === 'sleep';
        return { id, deck: s.deck, x: s.x, y: A.floorY(s.deck) - (lying ? s.h || 0 : 0), act, facing: s.facing, ms: t, say,
            z: lying ? 1 : act === 'sit' && (s === S.seatL2 || s === S.seatR2) ? 1.5 : 2 };
    }
    function tendSpot() {
        if (V.tendX == null) V.tendX = S.patient.x + 42 - CE.sprite('aris', 'tend', 0).hands[1].x;
        return { deck: S.patient.deck, x: V.tendX, facing: 1 };
    }
    const isRed = i => V.real.decks[DECKS[i]] === 'red';
    /** Where someone waits while their deck is sealed: the galley table, or the med bay when the quarters are red too. */
    function waitPose(id, t, fromDeck) {
        const say = 'sealed:' + DECKS[fromDeck];
        if (!isRed(2)) { const [name, act] = SEAT[id]; return stay(id, spot(name), act, t, say); }
        return stay(id, MED_WAIT[id], 'idle', t, say);
    }
    /** Cora's and Aris's bunks are at the far left, out of frame on a wide screen: someone confined there stands just
        inside the frame instead (past the left-edge fade), still in the quarters. */
    function confinedSpot(id) {
        const s = CONFINE[id], left = -(G().offX || 0) + VIG_W + 16;
        return s.x >= left ? s : Object.assign({}, s, { x: left + (id === 'aris' ? 22 : 0) });
    }
    function override(p, t, bed) {
        const c = V.real.crew[p.id];
        if (!c) return p;                                                  // not in the game's crew list: the routine as it is
        if (c.status === 'dead') return null;
        if (c.status === 'hurt') return p.id === bed ? stay(p.id, S.patient, 'sleep', t, 'hurt:bed') : stay(p.id, S[BUNK[p.id]], 'sleep', t, 'hurt:bunk');
        if (c.status === 'asleep') return p.id === bed ? stay(p.id, S.patient, 'sleep', t, 'asleep:bed') : stay(p.id, S[BUNK[p.id]], 'sleep', t, 'asleep');
        if (c.status === 'confined') return stay(p.id, confinedSpot(p.id), 'idle', t, 'confined');
        if (MOVING[p.act]) return p;                                       // passing through is fine, even a red deck
        if (p.id === 'aris' && bed && bed !== 'aris' && p.deck === 3 && !isRed(3)) return stay('aris', tendSpot(), 'tend', t, 'tend');
        if (isRed(p.deck)) return waitPose(p.id, t, p.deck);
        return p;
    }
    /** Two people on one spot: the one the real state moved keeps it; the routine one steps aside. */
    function unstack(list, moved) {
        return list.map(p => {
            if (moved.has(p.id) || MOVING[p.act]) return p;
            const clash = list.find(q => q !== p && moved.has(q.id) && q.deck === p.deck && Math.abs(q.x - p.x) < 16);
            return clash ? Object.assign({}, p, { x: p.x + (p.x >= clash.x ? 20 : -20) }) : p;
        });
    }
    /** Who has the med bay bed: the first hurt, else the first sedated (the bed is always in frame; two bunks are not). */
    function bedOf() {
        const has = s => IDS.find(id => V.real.crew[id] && V.real.crew[id].status === s);
        return has('hurt') || has('asleep') || null;
    }
    function peopleNow(t) {
        const bed = bedOf(), moved = new Set();
        const list = SIM.at('travel', t).map(p => { const o = override(p, t, bed); if (o !== p) moved.add(p.id); return o; }).filter(Boolean);
        return unstack(list, moved);
    }

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // The camera, the slide-in, the beat
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    /** The galley table at the bottom, but never a cut top deck: on a short screen the frame opens on the roof. */
    const camBase = () => Math.min(A.floorY(2) + 12 - G().H, A.deckTop(0) - 8);
    /** The scroll stops above the engine bell (past it the tower's flared tail sat against the small outside Lander) and just
        above the bridge (past it the nose is an empty dark dome); never above the usual frame itself. */
    const camClamp = y => {
        const hi = Math.max(0, Math.min(L.H, L.TAIL0 + 24) - G().H), lo = Math.max(0, Math.min(camBase(), A.deckTop(0) - TOP_MARGIN));
        return clamp(y, Math.min(lo, hi), hi);
    };
    const camTarget = () => (V.manual != null ? V.manual : Math.round(camClamp(camBase())));
    function slideK(t) {
        if (t < V.slide.closedUntil) return 0;
        if (V.slide.start == null) return 1;
        return ease((t - V.slide.start) / SLIDE_MS);
    }
    function closeTower(t, ms) { V.slide = { closedUntil: t + ms, start: t + ms }; }
    function openTower(t) { if (t < V.slide.closedUntil) V.slide = { closedUntil: t, start: t }; }

    function stepBeat(dt, t) {
        const E = V.Eshown, period = MK.BEAT.FULL + (MK.BEAT.LOW - MK.BEAT.FULL) * clamp((100 - E) / 90, 0, 1), b = V.beat;
        b.phase += dt / period;
        while (b.phase >= 1) {
            b.phase -= 1; b.n += 1;
            const missed = E < LOW_ENERGY && b.n % 4 === 3;                 // a missed beat in four below 25
            if (!missed) b.onsets = b.onsets.concat([t - b.phase * period]).slice(-3);
        }
        const last = b.onsets[b.onsets.length - 1], ms = last == null ? 1e9 : t - last;
        b.val = clamp(Math.exp(-ms / 140) + (ms > 230 ? 0.55 * Math.exp(-(ms - 230) / 150) : 0), 0, 1);
    }
    /** The core's level: the real energy, a step lower while engineering is red. */
    function setCore(E) {
        const lvl = Math.round(V.real.engDown ? E * CORE_ENG_DOWN : E);
        if (lvl !== V.coreSet && A.reactor) { A.reactor.set(lvl); V.coreSet = lvl; }
    }
    function stepEnergy(dt, t) {
        const E = energy();
        if (V.E == null) { V.E = E; V.Eshown = E; }
        if (E > V.E + 4) V.flood = { kind: 'fill', t0: t };               // energy came back: the conduit fills upward
        V.E = E;
        V.Eshown += (E - V.Eshown) * (dt > 0 ? 1 - Math.exp(-dt / 220) : 0);
        setCore(E);
    }

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // The module
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    function canvas() {
        if (!V.cv || !V.cv.isConnected) { V.cv = document.getElementById('ns-ship'); V.ctx = V.cv ? V.cv.getContext('2d') : null; }
        return V.cv;
    }
    function init() {
        if (V.inited) return;
        V.inited = true;
        canvas();
        V.jobs = TW.warm();
        const bus = NS.bus;
        bus.on('shown', p => onShown(p || {}));
        bus.on('hud', () => { V.dirty = true; });
        bus.on('opening:done', () => openTower(now()));
        bus.on('jump:burn', () => { V.flood = { kind: 'jump', t0: now() }; });
        bus.on('jump:flash', () => { V.dark = true; });
        IDS.forEach(id => NS.anchors.set('person:' + id, () => {
            const a = personAt(id);
            if (!a) return [];
            const y = rowTop(id, a.y);
            return [{ x: a.x, y, side: 'above', align: 'center' }, { x: a.x + 20, y: a.y + 30, side: 'right' }, { x: 20, y, side: 'above' }];
        }));
        DECKS.forEach((name, i) => NS.anchors.set('tower:deck:' + name, () => deckAnchor(i)));
        readReal(now());
    }
    function onShown(p) {
        const t = now();
        V.dirty = true;
        V.dark = false;
        if (p.first) {                                                     // a new sector: from black, the title; then the tower
            V.manual = null;
            V.cam = null;
            closeTower(t, OPEN_FALLBACK_MS);
        }
    }
    function deckAnchor(i) {
        const g = G(), ay = A.deckTop(i) + 60 - Math.round(V.cam || 0);
        if (!g.toCss || ay < 0 || ay > g.H || slideK(now()) < 1 || V.dark) return [];
        const [cx, cy] = g.toCss(460 + V.offX, ay);
        return [{ x: cx, y: cy, side: 'above', align: 'center' }];
    }
    function resize(g) {
        const cv = canvas();
        if (!cv || !g || !g.W) return;
        cv.width = g.W; cv.height = g.H;
        cv.style.width = (g.W * g.k / g.dpr) + 'px'; cv.style.height = (g.H * g.k / g.dpr) + 'px';
        cv.style.imageRendering = 'pixelated';
        V.manual = V.manual == null ? null : Math.round(camClamp(V.manual));
        V.cam = camTarget();
    }
    function update(dt, t) {
        const job = V.jobs.shift();
        if (job) { try { job(); } catch (err) { console.error('Tower: a warm job failed', err); } }
        const g = G();
        if (!g.H) return;
        if (V.dirty || t - V.readAt > READ_MS || t < V.readAt) readReal(t);
        stepEnergy(dt, t);
        stepBeat(dt, t);
        if (V.flood && MK.floodDone({ t, flood: V.flood })) V.flood = null;
        const target = camTarget();
        V.cam = V.cam == null || (dt === 0 && Math.abs(target - V.cam) > 400) ? target : V.cam + (target - V.cam) * (1 - Math.exp(-dt / CAM_EASE_MS));
        if (Math.abs(target - V.cam) < 0.5) V.cam = target;
        if (V.slide.start != null && t >= V.slide.start + SLIDE_MS) V.slide = { closedUntil: 0, start: null };
        V.people = peopleNow(t);
        if (V.manual != null && t - V.manualAt > WHEEL_IDLE_MS) V.manual = null;   // left alone: back to the usual frame
    }
    function render(t) {
        const c = V.ctx, g = G();
        if (!c || !g.W) return;
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.clearRect(0, 0, g.W, g.H);
        const k = slideK(t);
        if (V.dark || k <= 0 || V.cam == null) { V.drawn = []; return; }
        c.imageSmoothingEnabled = false;
        V.offX = Math.round(g.offX - (1 - k) * (g.hull + 12));
        const cam = Math.round(V.cam);
        TW.draw(c, { t, camY: cam, offX: V.offX, W: g.W, H: g.H, people: V.people, auraTalking: auraTalking() });
        V.drawn = TW.drawn.slice();
        const view = { t, G: g, offX: V.offX, cam, decks: V.real.decks, engDown: V.real.engDown, E: V.Eshown, beat: V.beat, flood: V.flood, sunY: null };
        MK.draw(c, view);
        MK.vignette(c, view, V.drawn);
    }
    function auraTalking() {
        const voice = NS && NS.mods && NS.mods.voice;
        if (voice && typeof voice.speaking === 'function') { try { return voice.speaking() === 'aura'; } catch (err) { return false; } }
        return false;
    }

    // ── input: the wheel scrolls the tower (BUILD_A §6: no clicks in A) ──
    function pointer(type, e) {
        const t = now();
        if (type !== 'wheel' || V.dark || slideK(t) < 1) return false;
        const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY, from = V.manual != null ? V.manual : V.cam;
        V.manual = Math.round(camClamp(from + dy * 0.6));
        V.manualAt = t;
        return true;
    }

    // ── what others read ──
    function occupied() {
        const on = [false, false, false, false, false, false];
        V.people.forEach(p => { if (p.deck >= 0 && p.deck < 6) on[p.deck] = true; });
        return on;
    }
    function beat() { return V.beat.val; }
    /** The highest head (CSS y) among the people on the same floor as this one. */
    function rowTop(id, y) {
        const me = V.drawn.find(p => p.id === id);
        if (!me) return y;
        return V.drawn.filter(p => Math.abs(p.y - me.y) < 8).reduce((m, p) => { const q = personAt(p.id); return q ? Math.min(m, q.y) : m; }, y);
    }
    function personAt(id) {
        const g = G(), d = V.drawn.find(p => p.id === id);
        if (!d || !g.toCss || V.cam == null) return null;
        const head = d.act === 'sleep' ? d.y - 26 : d.act === 'sit' ? d.y - 84 : d.y - 104;
        const ax = d.x + V.offX, ay = head - Math.round(V.cam);
        if (ax < 0 || ax > g.hull || ay < -10 || ay > g.H) return null;
        const [x, y] = g.toCss(ax, ay);
        return { x, y };
    }
    function debug() {
        return { cam: V.cam == null ? null : Math.round(V.cam), k: slideK(now()), dark: V.dark, E: V.E, decks: Object.assign({}, V.real.decks),
            crew: JSON.parse(JSON.stringify(V.real.crew)), people: V.people.map(p => ({ id: p.id, deck: p.deck, x: p.x, act: p.act, say: p.say })) };
    }

    const mod = Object.freeze({ init, resize, update, render, pointer, occupied, beat, personAt, debug });
    function attach() {
        NS = window.NewScreen;
        if (!NS) { console.error('Tower: NewScreen is missing; the tower is not registered'); return; }
        if (typeof NS.register === 'function') NS.register('tower', mod);
        else if (NS.mods) NS.mods.tower = mod;
    }
    if (window.NewScreen) attach();
    else document.addEventListener('DOMContentLoaded', attach, { once: true });
})();
