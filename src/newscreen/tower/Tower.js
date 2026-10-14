/* ═══ Silent Exodus · new screen (?new=1) · tower/Tower.js: the living ship beside the journey ═══════════════════════
   What it is: the tower module of the travel screen (docs/BUILD_A.md §3, §6; docs/BUILD_B.md §8). The WHOLE tower fits the
   screen height: all six decks, the nose's shoulder and the top of the engine bell (tower rows L.TOP0 - 40 .. L.TAIL0 + 48,
   1336 rows), both hull walls. It is drawn in its own pixels into an offscreen canvas, then onto canvas#ns-ship (sized in
   device px) scaled by ts = screen height / 1336 with smooth, high-quality scaling (0.81 at 1080p, 0.54 at 720p): the crew
   are about 84 px tall at 1080p, 56 px at 720p. No scrolling: the wheel does nothing. Space keeps the rest of the width
   (the tower takes about 26 %; never more than 45 %, then ts shrinks and the tower centres vertically).
   It reads the REAL game through NewScreen.game and never writes game state; clicks go to NewScreen.flow.
   - People: ShipRoutine.at('travel', t), bent by the real crew: dead not drawn; hurt in the med bay bed (a second hurt in
     their own bunk, asleep); asleep (sedated) in the med bay bed when no one hurt has it, else in their bunk; confined
     standing still at their bunk in the quarters; nobody stays on a red deck (they wait at the galley table, or in the
     med bay when the quarters are red); Aris tends whoever is in the med bay bed while she is in there; Mira works at her
     bench while a star fix waits there (NSOrbit.datable).
   - The reactor follows the real energy (ShipArt.reactor.set; a step lower with engineering red); the beat runs 1.1 s at
     100, 1.5 s at 10, a missed beat in four below 25; the conduit carries it up to the bridge (TowerMarks).
   - Red decks from NewScreen.game.decks(); engineering red browns the ship out every 2.9 s.
   - Clicks in travel (BUILD_B §8): a person → flow.person(id); Mira or her bench while a fix waits → flow.bench(); a red
     deck → its choices as a few words in #ns-ship-words, away from the pointer, deaf for 400 ms → flow.deckChoose(key, i).
     Pointing at a red deck names it ("Engine room, broken" over "Fix, patch or live with it"); the first time a deck goes
     red, A.U.R.A. says once, in travel, that it can be clicked.
   - A new sector: closed until 'opening:done' (5 s at most), then it slides in (1.2 s).
   - The ship's stock (NSStock, below): energy by the reactor, rations over the galley table, salvage over the hold's
     crates, as small lit numbers in #ns-ship-words. A change flashes (warm up, red down, the difference beside it for
     1.6 s); the first change of each, A.U.R.A. says once what it is for. Stop.js shows the same three on the bridge wall.
   Source: prototypes/slice/ship.js (minus the price charge, signs, asks, meal, plates and pages).
   Load after the art files and TowerMarks.js, and after NewScreen.js (it registers itself as 'tower').

   NewScreen.mods.tower = {
     init()                      once: TowerArt.warm() jobs (one a frame), the anchors, the bus
     resize(G)                   the fit (G.ts, G.tTop, G.tLeft, G.tY0 if the shell set them, else the same formula here)
                                 and canvas#ns-ship in device px
     update(dt, t), render(t)    the shell's loop
     pointer(type, e, ax, ay)    'move' → true over something clickable; 'down' → a click; 'wheel' → false (no scroll)
     occupied() → [6 booleans]   someone on deck i now (the outside Lander's lit ports)
     beat(t) → 0..1              the reactor's pulse now (the ports and the plume breathe with it)
     personAt(id) → { x, y } | null   CSS px over that person's head
     fit() → { ts, tTop, tLeft, tY0, rows, devW, devH, wDev }   the tower's frame (ts device px per tower px; tY0, wDev
                                 device px); wDev is the tower's width on screen
     debug() → { fit, k, dark, E, decks, crew, people: [{ id, deck, x, act, say }], chips }
   }
   Listens: 'shown' 'hidden' 'hud' 'opening:done' 'jump:burn' 'jump:flash'.

   window.NSStock (frozen): the ship's stock, read from the real game (never written)
     KEYS                        ['energy', 'rations', 'salvage']
     tick()                      reads the numbers; a change starts its flash (and the first time, A.U.R.A.'s line). The
                                 tower's update calls it every frame; a hidden view's return reads afresh (no flash). A
                                 change made out of sight (a card or minigame up, the dive) is held until the numbers
                                 are in view again, so its flash is seen; the numbers hide under a card or a minigame
     board(layer) → { put(key, x, y, align), hide() }   three readouts in a word layer; put places one at CSS px (x, y
                                 its top-left, or top-right with align 'right') and shows it
   Anchors: 'person:<id>' for the five, 'tower:deck:<name>' for the six decks (CSS px, [] when not in view).
   Uses, if present: NewScreen.mode() (only 'travel' takes clicks), NewScreen.mods.voice.speaking() → 'aura' | id | null
   (the computer's speaker glows while A.U.R.A. talks), NewScreen.flow.{ person(id), bench(), datable(), deckChoices(key),
   deckChoose(key, i) } (key: the game's deck key, the hold is 'cargo'); NSOrbit.{ datable, deckChoices } as a fallback.
*/
(function () {
    'use strict';
    const A = window.ShipArt, TW = window.TowerArt, SIM = window.ShipRoutine, CE = window.CrewEngine, MK = window.NSTowerMarks;
    if (!A || !TW || !SIM || !CE || !MK) { console.error('Tower: the art files and TowerMarks.js must load first'); return; }
    const L = A.L, S = A.SPOTS, F = L.DECK_FLOOR, DESK = CE.ACTIONS.console.desk;
    const IDS = ['cora', 'jaxon', 'aris', 'vance', 'mira'];
    const DECKS = MK.DECKS;
    const GAME_KEY = { bridge: 'bridge', lab: 'lab', quarters: 'quarters', medbay: null, hold: 'cargo', engineering: 'engineering' };
    const DECK_WORD = { bridge: 'The bridge', lab: 'The lab', quarters: 'The quarters', hold: 'The hold', engineering: 'The engine room' };

    const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
    const ease = k => 1 - Math.pow(1 - clamp(k, 0, 1), 3);
    const SLIDE_MS = 1200, OPEN_FALLBACK_MS = 5000, READ_MS = 500, CHIP_GUARD_MS = 400;
    const LOW_ENERGY = 25, CORE_ENG_DOWN = 0.7, SCALE_PROBE = 40, SCALE_SLOW_MS = 3;
    const MOVING = { walk: 1, climb: 1, carry: 1 };

    // ── the frame: every deck whole, the nose's shoulder, the top of the bell; both hull walls (BUILD_B §8) ──
    const FRAME = Object.freeze({ TOP: L.TOP0 - 40, BOT: L.TAIL0 + 48, LEFT: 40 });
    const ROWS = FRAME.BOT - FRAME.TOP, HULL_OUT = L.CX + L.HO + 9, OFF_W = HULL_OUT - FRAME.LEFT + 2, MAX_SHARE = 0.45;
    const BENCH = { deck: 1, x0: 350, x1: 582, y0: F - DESK - 34 };              // Mira's bench (the lab)
    const SLATE = { x: 440, y: A.deckTop(1) + F - DESK - 6 };                     // the star fix, waiting on the bench

    // ── where people go when the real state moves them (tower art px; deck 2 is the galley and the bunks) ──
    const BUNK = { cora: 'bedCora', jaxon: 'bedJaxon', aris: 'bedAris', vance: 'bedVance', mira: 'bedMira' };
    const CONFINE = { cora: { deck: 2, x: 204, facing: 1 }, aris: { deck: 2, x: 226, facing: 1 },   // standing still at their bunk
        jaxon: { deck: 2, x: 516, facing: -1 }, vance: { deck: 2, x: 536, facing: -1 }, mira: { deck: 2, x: 556, facing: -1 } };
    const SEAT = { cora: ['seatR2', 'sit'], mira: ['seatR1', 'sit'], jaxon: ['seatL2', 'sit'], aris: ['seatL1', 'sit'], vance: ['mealStand', 'idle'] };
    const MED_WAIT = { cora: { deck: 3, x: 436, facing: 1 }, jaxon: { deck: 3, x: 372, facing: 1 }, aris: { deck: 3, x: 402, facing: 1 },
        vance: { deck: 3, x: 470, facing: -1 }, mira: { deck: 3, x: 346, facing: 1 } };   // the quarters red too: they wait in the med bay
    const MEAL_STAND = { deck: 2, x: 548, facing: -1 };
    const spot = name => (name === 'mealStand' ? MEAL_STAND : S[name]);

    // ── the module's own picture state (never game state) ──
    const V = {
        cv: null, ctx: null, off: null, offCtx: null, jobs: [], inited: false, fit: null,
        people: [], drawn: [], slideX: 0,
        slide: { closedUntil: 0, start: null }, dark: false,
        beat: { phase: 0, n: 0, val: 0, onsets: [] },
        E: null, Eshown: 100, coreSet: null, flood: null,
        real: { crew: {}, decks: {}, engDown: false, datable: false }, readAt: -1e9, dirty: true,
        tendX: null, hover: null, chips: null, words: null, quality: 'high', scaleN: 0, scaleMs: 0,
        tag: null, toldRed: new Set(), tellRed: null, stock: null,
    };
    let NS = null;
    const G = () => (NS && NS.G) || {};
    const now = () => (NS && NS.clock ? NS.clock.t : 0);
    const modeNow = () => { try { return NS && typeof NS.mode === 'function' ? NS.mode() : 'travel'; } catch (err) { return 'travel'; } };

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
    /** A star fix waiting on Mira's bench (NSOrbit, checkpoint B); false while that part is not there. */
    function datable() {
        const fl = NS && NS.flow;
        if (fl && typeof fl.datable === 'function') { try { return !!fl.datable(); } catch (err) { console.error('Tower: flow.datable failed', err); return false; } }
        const O = window.NSOrbit, s = call('state', null);
        if (!O || typeof O.datable !== 'function' || !s) return false;
        try { return !!O.datable(s); } catch (err) { console.error('Tower: NSOrbit.datable failed', err); return false; }
    }
    function readReal(t) {
        const list = call('crew', []) || [], crew = {};
        list.forEach(c => { if (c && IDS.includes(c.id)) crew[c.id] = { status: c.status || 'well', stress: c.stress || 0 }; });
        const raw = call('decks', {}) || {}, decks = {};
        DECKS.forEach(k => { decks[k] = raw[k] === 'red' ? 'red' : 'ok'; });
        const was = (V.real && V.real.decks) || {};
        DECKS.forEach(k => { if (decks[k] === 'red' && was[k] !== 'red' && GAME_KEY[k] && !V.toldRed.has(k)) { V.toldRed.add(k); V.tellRed = k; } });
        V.real = { crew, decks, engDown: decks.engineering === 'red', datable: datable() };
        V.readAt = t; V.dirty = false;
    }
    /** A deck just went red: A.U.R.A. says once, in travel, where to click (the voice, not the log). */
    function tellRed() {
        const k = V.tellRed, v = NS.mods && NS.mods.voice;
        if (!k || modeNow() !== 'travel' || (NS.blocked && NS.blocked()) || slideK(now()) < 1 || !v || typeof v.say !== 'function') return;
        V.tellRed = null;
        if (V.real.decks[k] !== 'red') return;
        try { v.say({ id: 'aura', who: 'A.U.R.A.', text: `${DECK_WORD[k] || 'A deck'} is broken, Commander. Click it in the ship to fix it.` }); } catch (err) { console.error('Tower: the voice failed', err); }
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
    function override(p, t, bed) {
        const c = V.real.crew[p.id];
        if (!c) return p;                                                  // not in the game's crew list: the routine as it is
        if (c.status === 'dead') return null;
        if (c.status === 'hurt') return p.id === bed ? stay(p.id, S.patient, 'sleep', t, 'hurt:bed') : stay(p.id, S[BUNK[p.id]], 'sleep', t, 'hurt:bunk');
        if (c.status === 'asleep') return p.id === bed ? stay(p.id, S.patient, 'sleep', t, 'asleep:bed') : stay(p.id, S[BUNK[p.id]], 'sleep', t, 'asleep');
        if (c.status === 'confined') return stay(p.id, CONFINE[p.id], 'idle', t, 'confined');
        if (p.id === 'mira' && V.real.datable && !isRed(1)) return Object.assign(stay('mira', S.bench, 'console', t, 'bench'), { screen: true });
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
    /** Who has the med bay bed: the first hurt, else the first sedated. */
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
    // The fit: tower px → device px (ts), the slide-in, the beat
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    /** BUILD_B §8. The shell's own numbers when it has them (G.ts, G.tTop, G.tLeft, G.tY0), else the same formula. */
    function computeFit(g) {
        const dpr = g.dpr || window.devicePixelRatio || 1, devW = Math.round(innerWidth * dpr), devH = Math.round(innerHeight * dpr);
        let ts, tTop = FRAME.TOP, tLeft = FRAME.LEFT, tY0;
        if (typeof g.ts === 'number' && g.ts > 0) {
            ts = g.ts; tTop = typeof g.tTop === 'number' ? g.tTop : tTop; tLeft = typeof g.tLeft === 'number' ? g.tLeft : tLeft;
            tY0 = typeof g.tY0 === 'number' ? g.tY0 : Math.round((devH - ROWS * ts) / 2);
        } else {
            ts = devH / ROWS;
            if ((HULL_OUT - tLeft) * ts > MAX_SHARE * devW) ts = MAX_SHARE * devW / (HULL_OUT - tLeft);
            tY0 = Math.round((devH - ROWS * ts) / 2);
        }
        return { ts, tTop, tLeft, tY0, rows: ROWS, dpr, devW, devH, wDev: Math.ceil((HULL_OUT - tLeft) * ts) };
    }
    /** Tower px → CSS px, through the fit and the slide. */
    function toCss(wx, wy) {
        const f = V.fit;
        return [((wx - f.tLeft) * f.ts + V.slideX) / f.dpr, ((wy - f.tTop) * f.ts + f.tY0) / f.dpr];
    }
    /** A pointer (CSS px) → tower px. */
    function fromCss(cx, cy) {
        const f = V.fit;
        return [(cx * f.dpr - V.slideX) / f.ts + f.tLeft, (cy * f.dpr - f.tY0) / f.ts + f.tTop];
    }
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
        if (!V.off) { V.off = document.createElement('canvas'); V.off.width = OFF_W; V.off.height = ROWS; V.offCtx = V.off.getContext('2d'); }
        return V.cv;
    }
    function init() {
        if (V.inited) return;
        V.inited = true;
        canvas();
        injectStyle();
        V.jobs = TW.warm();
        const bus = NS.bus;
        bus.on('shown', p => onShown(p || {}));
        bus.on('hidden', () => { hideChips(); ST.state = null; });          // the view back later: the stock is read afresh, no flash
        bus.on('hud', () => { V.dirty = true; });
        bus.on('opening:done', () => openTower(now()));
        bus.on('jump:burn', () => { V.flood = { kind: 'jump', t0: now() }; hideChips(); });
        bus.on('jump:flash', () => { V.dark = true; });
        IDS.forEach(id => NS.anchors.set('person:' + id, () => {
            const a = personAt(id);
            if (!a) return [];
            const y = rowTop(id, a.y), f = V.fit;
            return [{ x: a.x, y, side: 'above', align: 'center' }, { x: a.x + 20, y: a.y + 30, side: 'right' }, { x: Math.max(20, (f.wDev + V.slideX) / f.dpr + 12), y: a.y, side: 'right' }];
        }));
        DECKS.forEach((name, i) => NS.anchors.set('tower:deck:' + name, () => deckAnchor(i)));
        document.addEventListener('pointerdown', e => { if (V.chips && !V.chips.el.contains(e.target)) hideChips(); }, true);
        readReal(now());
    }
    function onShown(p) {
        const t = now();
        V.dirty = true;
        V.dark = false;
        if (p.first) closeTower(t, OPEN_FALLBACK_MS);                       // a new sector: from black, the title; then the tower
    }
    function deckAnchor(i) {
        if (!V.fit || slideK(now()) < 1 || V.dark) return [];
        const [cx, cy] = toCss(460, A.deckTop(i) + 60);
        return [{ x: cx, y: cy, side: 'above', align: 'center' }];
    }
    function resize(g) {
        const cv = canvas();
        if (!g || !g.W) return;
        V.fit = computeFit(g);
        hideChips();
        if (!cv) return;
        const f = V.fit, w = f.wDev + 2;
        if (cv.width !== w) cv.width = w;
        if (cv.height !== f.devH) cv.height = f.devH;
        cv.style.width = (w / f.dpr) + 'px'; cv.style.height = (f.devH / f.dpr) + 'px';
        cv.style.imageRendering = 'auto';
    }
    function update(dt, t) {
        const job = V.jobs.shift();
        if (job) { try { job(); } catch (err) { console.error('Tower: a warm job failed', err); } }
        const g = G();
        if (!g.H || !V.fit) return;
        if (V.dirty || t - V.readAt > READ_MS || t < V.readAt) readReal(t);
        stepEnergy(dt, t);
        stepBeat(dt, t);
        if (V.flood && MK.floodDone({ t, flood: V.flood })) V.flood = null;
        if (V.slide.start != null && t >= V.slide.start + SLIDE_MS) V.slide = { closedUntil: 0, start: null };
        V.people = peopleNow(t);
        if (V.chips && (modeNow() !== 'travel' || (NS.blocked && NS.blocked()) || V.real.decks[V.chips.deck] !== 'red')) hideChips();
        if (V.tag && (modeNow() !== 'travel' || (NS.blocked && NS.blocked()) || V.real.decks[V.tag.deck] !== 'red' || V.chips)) hideTag();
        tellRed();
        if (modeNow() !== 'travel' || V.dark || slideK(t) < 1 || (NS.blocked && NS.blocked())) placeStock(false);   // never over a card or a minigame
        stockTick();
    }
    function render(t) {
        const c = V.ctx, o = V.offCtx, f = V.fit;
        if (!c || !o || !f) return;
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.clearRect(0, 0, V.cv.width, V.cv.height);
        const k = slideK(t);
        if (V.dark || k <= 0) { V.drawn = []; return; }
        V.slideX = Math.round(-(1 - k) * (f.wDev + 12));
        o.setTransform(1, 0, 0, 1, 0, 0);
        o.clearRect(0, 0, OFF_W, ROWS);
        o.imageSmoothingEnabled = false;
        TW.draw(o, { t, camY: f.tTop, offX: -f.tLeft, W: OFF_W, H: ROWS, people: V.people, auraTalking: auraTalking() });
        V.drawn = TW.drawn.slice();
        const sunY = (0.4 * f.devH - f.tY0) / f.ts;                       // level with the light (Field's light sits at 40 % of the height)
        const view = { t, G: { W: OFF_W, H: ROWS }, offX: -f.tLeft, cam: f.tTop, decks: V.real.decks, engDown: V.real.engDown, E: V.Eshown, beat: V.beat,
            flood: V.flood, sunY, fix: V.real.datable ? SLATE : null };
        MK.draw(o, view);
        c.imageSmoothingEnabled = true;
        c.imageSmoothingQuality = V.quality;
        const s0 = performance.now();
        c.drawImage(V.off, 0, 0, OFF_W, ROWS, V.slideX, f.tY0, OFF_W * f.ts, ROWS * f.ts);
        watchScale(performance.now() - s0);
        placeStock(k >= 1 && modeNow() === 'travel' && !(NS.blocked && NS.blocked()));
    }
    /** 'high' scaling where it is cheap (a GPU canvas); a machine where it costs over 3 ms a frame on average gets 'low'
        (bilinear: at these scales the two look nearly the same, checked at 1080p and 720p). */
    function watchScale(ms) {
        if (V.quality !== 'high' || V.scaleN >= SCALE_PROBE) return;
        V.scaleN += 1; V.scaleMs += ms;
        if (V.scaleN === SCALE_PROBE && V.scaleMs / SCALE_PROBE > SCALE_SLOW_MS) V.quality = 'low';
    }
    function auraTalking() {
        const voice = NS && NS.mods && NS.mods.voice;
        if (voice && typeof voice.speaking === 'function') { try { return voice.speaking() === 'aura'; } catch (err) { return false; } }
        return false;
    }

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // Input: a person, Mira's bench while a fix waits, a red deck. The wheel does nothing (the whole tower is in view).
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    function hit(e) {
        if (!V.fit) return null;
        const [fx, fy] = fromCss(e.clientX, e.clientY), wx = Math.round(fx), wy = Math.round(fy);   // whole tower px (TowerArt reads sprite pixels by index)
        const who = TW.hitPerson(wx - V.fit.tLeft, wy - V.fit.tTop);
        if (who) return who === 'mira' && V.real.datable ? { what: 'bench', id: 'mira' } : { what: 'person', id: who };
        const deck = Math.floor((wy - L.TOP0) / L.PITCH), local = wy - A.deckTop(deck);
        if (deck < 0 || deck >= L.N || wx < L.IL - 2 || wx > L.IR + 2 || local >= F) return null;
        if (deck === BENCH.deck && V.real.datable && wx >= BENCH.x0 && wx < BENCH.x1 && local >= BENCH.y0) return { what: 'bench', id: 'bench' };
        const name = DECKS[deck];
        if (V.real.decks[name] === 'red' && GAME_KEY[name]) return { what: 'deck', id: name };
        return null;
    }
    function flowCall(name, ...args) {
        const fl = NS && NS.flow;
        if (!fl || typeof fl[name] !== 'function') return undefined;
        try { return fl[name](...args); } catch (err) { console.error('Tower: flow.' + name + ' failed', err); return undefined; }
    }
    function pointer(type, e) {
        const t = now();
        if (type === 'wheel') return false;                                // the whole tower is in view: nothing to scroll
        if (type === 'leave' || V.dark || slideK(t) < 1 || modeNow() !== 'travel') { V.hover = null; hideTag(); return false; }
        const h = hit(e);
        if (type === 'move') { V.hover = h; if (h && h.what === 'deck' && !V.chips) showTag(h.id, e); else hideTag(); return !!h; }
        if (type === 'down') hideTag();
        if (type !== 'down') return false;
        if (!h) return false;
        if (h.what === 'person') flowCall('person', h.id);
        else if (h.what === 'bench') flowCall('bench');
        else if (h.what === 'deck') showChips(h.id, e);
        return true;
    }

    // ── a red deck's choices: a few words in #ns-ship-words, away from the pointer, deaf for 400 ms ──
    const FALLBACK_CHOICES = [{ words: 'Fix it', note: 'costs salvage' }, { words: 'Patch it', note: 'a little salvage' }, { words: 'Live with it', note: '' }];
    function choicesFor(key) {
        let list = flowCall('deckChoices', key);
        const O = window.NSOrbit, s = call('state', null);
        if (!Array.isArray(list) && O && typeof O.deckChoices === 'function' && s) {
            try { list = O.deckChoices(s, key); } catch (err) { console.error('Tower: NSOrbit.deckChoices failed', err); list = null; }
        }
        if (!Array.isArray(list) || !list.length) list = FALLBACK_CHOICES;
        return list.map((c, i) => (typeof c === 'string' ? { i, words: c, note: '' }
            : { i: c.i != null ? c.i : i, words: c.words || c.verb || c.label || c.text || '', note: c.note || c.sub || c.chip || c.cost || '' }))
            .filter(c => c.words);
    }
    function wordsLayer() {
        if (!V.words || !V.words.isConnected) V.words = document.getElementById('ns-ship-words');
        return V.words;
    }
    function showChips(deck, e) {
        const layer = wordsLayer(), key = GAME_KEY[deck];
        if (!layer || !key) return;
        hideChips();
        const el = document.createElement('div'), list = document.createElement('ol');
        el.className = 'nsk-chips'; list.className = 'nsk-list';
        choicesFor(key).forEach(c => {
            const li = document.createElement('li'), b = document.createElement('button'), verb = document.createElement('span');
            b.type = 'button'; b.className = 'nsk-choice';
            verb.className = 'nsk-verb'; verb.textContent = c.words; b.append(verb);
            if (c.note) { const n = document.createElement('span'); n.className = 'nsk-note'; n.textContent = c.note; b.append(n); }
            b.addEventListener('pointerdown', ev => ev.stopPropagation());
            b.addEventListener('click', ev => { ev.stopPropagation(); choose(deck, key, c.i); });
            li.append(b); list.append(li);
        });
        el.append(list);
        el.addEventListener('pointerdown', ev => ev.stopPropagation());
        layer.append(el);
        V.chips = { el, deck, ready: performance.now() + CHIP_GUARD_MS };
        placeChips(deck, e);
        void el.offsetWidth; el.classList.add('is-in');
    }
    function choose(deck, key, i) {
        if (!V.chips || performance.now() < V.chips.ready) return;
        hideChips();
        flowCall('deckChoose', key, i);
    }
    function hideChips() { if (V.chips) { V.chips.el.remove(); V.chips = null; } }
    /** Pointing at a red deck: its name and what can be done, beside it (the same place the choices will take). */
    function showTag(deck, e) {
        const layer = wordsLayer();
        if (!layer) return;
        if (!V.tag || V.tag.deck !== deck) {
            hideTag();
            const el = document.createElement('div'), b = document.createElement('span'), n = document.createElement('span');
            el.className = 'nsk-chips nsk-tag'; b.className = 'nsk-verb'; n.className = 'nsk-note';
            b.textContent = `${DECK_WORD[deck] || 'This deck'}, broken`; n.textContent = 'Fix, patch or live with it';
            el.append(b, n); layer.append(el);
            V.tag = { el, deck };
            void el.offsetWidth; el.classList.add('is-in');
        }
        const keep = V.chips; V.chips = V.tag; placeChips(deck, e); V.chips = keep;            // placed as the choices would be
    }
    function hideTag() { if (V.tag) { V.tag.el.remove(); V.tag = null; } }
    /** Beside the deck, on the side of the tower away from the pointer (over space when the pointer is near the hull edge). */
    function placeChips(deck, e) {
        const el = V.chips.el, w = el.offsetWidth, h = el.offsetHeight, f = V.fit, i = DECKS.indexOf(deck);
        const towerR = (f.wDev + V.slideX) / f.dpr, [, cy] = toCss(0, A.deckTop(i) + F * 0.5), px = e ? e.clientX : 0;
        const right = px < towerR * 0.55;                                      // pointer on the tower's left: the words go right, past it
        const x = right ? Math.min(innerWidth - w - 16, Math.max(px + 48, towerR * 0.62)) : Math.max(16, Math.min(px - w - 48, towerR * 0.12));
        const y = clamp(cy - h / 2, 16, innerHeight - h - 16);
        el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    }
    function injectStyle() {
        if (document.getElementById('ns-tower-style')) return;
        const st = document.createElement('style'); st.id = 'ns-tower-style';
        st.textContent = `#ns-ship-words .nsk-chips { position: absolute; left: 0; top: 0; pointer-events: auto; padding: 10px 16px 10px 12px; background: rgba(5, 7, 10, 0.86); box-shadow: 0 0 18px 10px rgba(5, 7, 10, 0.72); border-radius: 2px; opacity: 0; transition: opacity 160ms var(--ease, ease); }
#ns-ship-words .nsk-chips.is-in { opacity: 1; }
#ns-ship-words .nsk-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
#ns-ship-words .nsk-choice { display: grid; grid-template-columns: max-content max-content; align-items: baseline; gap: 12px; padding: 6px 0; margin: 0; background: none; border: 0; cursor: pointer; text-align: left; text-shadow: var(--shadow, 0 1px 0 #05070a); }
#ns-ship-words .nsk-verb { font: 400 var(--fs-voice, 22px)/1.25 var(--f-text, 'IBM Plex Sans', sans-serif); color: var(--text, #e4e4e0); transition: color 140ms var(--ease, ease), transform 140ms var(--ease, ease); }
#ns-ship-words .nsk-note { font: 400 max(14px, calc(var(--fs-who, 15px) * 0.95))/1 var(--f-num, 'IBM Plex Mono', monospace); color: var(--dim, #8b8d90); }
#ns-ship-words .nsk-choice:hover .nsk-verb, #ns-ship-words .nsk-choice:focus-visible .nsk-verb { color: var(--warm, #f08c2e); transform: translateX(3px); }
#ns-ship-words .nsk-choice:active .nsk-verb { color: var(--warm-br, #ffc27a); }
#ns-ship-words .nsk-choice:focus-visible { outline: none; }
#ns-ship-words .nsk-tag { display: grid; gap: 4px; pointer-events: none; }
#ns-ship-words .nsk-tag .nsk-verb { color: #ff7a6a; }
@media (prefers-reduced-motion: reduce) { #ns-ship-words .nsk-chips, #ns-ship-words .nsk-verb { transition: none; } }`;
        document.head.appendChild(st);
    }

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // The ship's stock: small lit numbers beside the rooms they belong to (here) and on the bridge wall (Stop.js)
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    const STOCK_KEYS = Object.freeze(['energy', 'rations', 'salvage']);
    const STOCK_TELL = {
        energy: 'Energy runs the drive. Every flight costs some, Commander.',
        rations: 'Rations feed the crew. We eat on every jump, Commander.',
        salvage: 'Salvage fixes the ship. Mining and wrecks bring more, Commander.',
    };
    const STOCK_LOW = { energy: 20, rations: 4, salvage: -1 };               // at or under: the number burns amber
    const STOCK_FLASH_MS = 1600, STOCK_SETTLE_MS = 1300;
    // where each sits in the tower (tower art px, top-left): by the reactor's top, over the galley table, over the crates
    const STOCK_AT = { energy: { deck: 5, x: 498, y: 50 }, rations: { deck: 2, x: 424, y: 38 }, salvage: { deck: 4, x: 500, y: 44 } };
    const ST = { state: null, val: {}, flash: {}, seenAt: null };                     // seenAt: since when the numbers have been in view
    function stockTick() {
        const s = call('state', null);
        if (!s) return;
        const now = { energy: Math.round(energy()), rations: Math.round(Number(s.rations) || 0), salvage: Math.round(Number(s.salvage) || 0) };
        if (s !== ST.state) { ST.state = s; ST.val = now; ST.flash = {}; return; }        // a new run, or the view back: read afresh
        if (!stockSeen()) { ST.seenAt = null; return; }                                   // out of sight (a card, a minigame, the dive): the change waits to be seen
        if (ST.seenAt == null) ST.seenAt = performance.now();
        if (performance.now() - ST.seenAt < STOCK_SETTLE_MS) return;                      // in view a moment first: a follow-up card often opens just after one closes
        STOCK_KEYS.forEach(k => {
            const d = now[k] - ST.val[k];
            if (!d) return;
            ST.val = Object.assign({}, ST.val, { [k]: now[k] });
            ST.flash = Object.assign({}, ST.flash, { [k]: { at: performance.now(), d } });
            const v = NS.mods && NS.mods.voice;
            if (v && typeof v.once === 'function') v.once('stock:' + k, STOCK_TELL[k]).catch(err => console.error('NSStock: the voice failed', err));
        });
    }
    /** Are the numbers in view now (the tower's or the bridge wall's, nothing over them)? */
    function stockSeen() {
        if (NS.blocked && NS.blocked()) return false;
        return !!document.querySelector('#ns-root .nss.on');
    }
    function stockStyle() {
        if (document.getElementById('ns-stock-style')) return;
        const st = document.createElement('style'); st.id = 'ns-stock-style';
        st.textContent = `#ns-root .nss { position: absolute; left: 0; top: 0; display: flex; align-items: baseline; gap: 0.4em; white-space: nowrap; pointer-events: none; opacity: 0; transition: opacity 400ms var(--ease, ease); }
#ns-root .nss.on { opacity: 1; }
#ns-root .nss b { font: 400 calc(15px + 2px * var(--t, 1))/1 var(--f-num, monospace); color: var(--ui, #c9d1d6); text-shadow: 0 0 6px rgba(201, 209, 214, 0.45), 0 1px 0 #05070a; transition: color 300ms var(--ease, ease); }
#ns-root .nss span { font: 400 calc(12px + 1px * var(--t, 1))/1 var(--f-text, sans-serif); color: var(--dim, #8b8d90); text-shadow: 0 1px 0 #05070a, 0 0 4px #05070a; }
#ns-root .nss i { position: absolute; left: 100%; margin-left: 0.4em; font: 400 calc(12px + 1px * var(--t, 1))/1 var(--f-num, monospace); font-style: normal; opacity: 0; transition: opacity 200ms var(--ease, ease); }
#ns-root .nss.is-low b { color: var(--warm, #f08c2e); text-shadow: 0 0 6px rgba(240, 140, 46, 0.5), 0 1px 0 #05070a; }
#ns-root .nss.is-up b, #ns-root .nss.is-up i { color: var(--warm-br, #ffc27a); text-shadow: 0 0 9px rgba(255, 194, 122, 0.8), 0 1px 0 #05070a; }
#ns-root .nss.is-down b, #ns-root .nss.is-down i { color: #ff7a6a; text-shadow: 0 0 9px rgba(255, 90, 70, 0.8), 0 1px 0 #05070a; }
#ns-root .nss.is-up i, #ns-root .nss.is-down i { opacity: 1; }
@media (prefers-reduced-motion: reduce) { #ns-root .nss, #ns-root .nss b, #ns-root .nss i { transition: none; } }`;
        document.head.appendChild(st);
    }
    /** Three readouts in a word layer. Each frame put() writes only what changed (text, class, place). */
    function stockBoard(layer) {
        stockStyle();
        const items = {};
        STOCK_KEYS.forEach(k => {
            const el = document.createElement('div'), b = document.createElement('b'), w = document.createElement('span'), i = document.createElement('i');
            el.className = 'nss'; el.dataset.stock = k; w.textContent = k;
            el.append(b, w, i); layer.append(el);
            items[k] = { el, b, i, text: '', cls: '', pos: '', w: 0 };
        });
        function paint(it, k) {
            const v = ST.val[k], f = ST.flash[k], fresh = f && performance.now() - f.at < STOCK_FLASH_MS;
            const text = v == null ? '' : String(v), delta = fresh ? (f.d > 0 ? '+' : '−') + Math.abs(f.d) : '';
            const cls = (fresh ? (f.d > 0 ? ' is-up' : ' is-down') : '') + (v != null && v <= STOCK_LOW[k] ? ' is-low' : '');
            if (it.text !== text) { it.b.textContent = text; it.text = text; it.w = 0; }
            if (delta && it.i.textContent !== delta) it.i.textContent = delta;     // kept after the flash, faded out
            if (it.cls !== cls) { ['is-up', 'is-down', 'is-low'].forEach(c => it.el.classList.toggle(c, cls.includes(c))); it.cls = cls; }
        }
        return {
            put(k, x, y, align) {
                const it = items[k];
                if (!it) return;
                paint(it, k);
                if (!it.w) it.w = it.el.offsetWidth;
                const pos = `translate(${Math.round(align === 'right' ? x - it.w : x)}px, ${Math.round(y)}px)`;
                if (it.pos !== pos) { it.el.style.transform = pos; it.pos = pos; }
                it.el.classList.add('on');
            },
            hide() { STOCK_KEYS.forEach(k => items[k].el.classList.remove('on')); },
        };
    }
    /** The tower's own three, beside their rooms (only in travel, the tower in, not in the dark of a jump). */
    function placeStock(show) {
        if (!V.stock) { const layer = wordsLayer(); if (!layer) return; V.stock = stockBoard(layer); }
        if (!show) { V.stock.hide(); return; }
        STOCK_KEYS.forEach(k => { const a = STOCK_AT[k], [x, y] = toCss(a.x, A.deckTop(a.deck) + a.y); V.stock.put(k, x, y); });
    }
    window.NSStock = Object.freeze({ KEYS: STOCK_KEYS, tick: stockTick, board: stockBoard });

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
        const d = V.drawn.find(p => p.id === id);
        if (!d || !V.fit) return null;
        const head = d.act === 'sleep' ? d.y - 26 : d.act === 'sit' ? d.y - 84 : d.y - 104;
        const [x, y] = toCss(d.x, head);
        if (x < 0 || y < -10 || y > V.fit.devH / V.fit.dpr) return null;
        return { x, y };
    }
    function fit() { return V.fit ? Object.assign({}, V.fit) : null; }
    function debug() {
        return { fit: fit(), quality: V.quality, k: slideK(now()), dark: V.dark, E: V.E, decks: Object.assign({}, V.real.decks), datable: V.real.datable,
            crew: JSON.parse(JSON.stringify(V.real.crew)), people: V.people.map(p => ({ id: p.id, deck: p.deck, x: p.x, act: p.act, say: p.say })),
            chips: V.chips ? V.chips.deck : null, stock: Object.assign({}, ST.val) };
    }

    const mod = Object.freeze({ init, resize, update, render, pointer, occupied, beat, personAt, fit, debug });
    function attach() {
        NS = window.NewScreen;
        if (!NS) { console.error('Tower: NewScreen is missing; the tower is not registered'); return; }
        if (typeof NS.register === 'function') NS.register('tower', mod);
        else if (NS.mods) NS.mods.tower = mod;
    }
    if (window.NewScreen) attach();
    else document.addEventListener('DOMContentLoaded', attach, { once: true });
})();
