/* ═══ Silent Exodus · new screen (?new=1) · NewScreen.js: the shell of the travel view ════════════════════════════════
   What it is: the full-screen travel view that replaces today's map while the switch is on (docs/BUILD_A.md §1, §2, §4).
   It mounts #ns-root, measures the art pixel, runs the loop, routes the pointer, carries the bus, reads the REAL game
   state for the modules (game) and hands their clicks to the REAL game code (flow). It draws nothing itself: Travel draws
   space and the worlds, Tower the ship, Voice the spoken lines.
   Source: the boot of prototypes/slice/index.html (measure, the loop, input) and prototypes/slice/state.js (the bus).
   Loaded only when the new-screen switch is on; bundle.js calls show/hide/playJump only behind isNewScreen().

   window.NewScreen (frozen)
     on                      the switch (window.NEW_SCREEN)
     G                       { dpr, k, W, H, offX, hull, HULL_OUT, toArt(cx, cy) → [ax, ay], toCss(ax, ay) → [cx, cy] }
                             k: device px per art px (at least 540 art rows); hull: the art column where space starts
     clock.t                 ms; runs only while the view is shown
     app                     the real App (set by show)
     bus.on(name, fn) → off, bus.emit(name, payload), bus.once(name, fn) → off
     anchors                 Map name → () => [{ x, y, side, align }] in CSS px ('ship' by Travel, 'person:<id>' by Tower)
     register(name, mod)     name: 'travel' | 'tower' | 'voice'; mod: { init(), resize(G), update(dt, t), render(t),
                             pointer(type, e, ax, ay) → bool (type 'move' | 'down' | 'leave' | 'wheel'), key?(e) → bool }
     mods                    { travel, tower, voice } as registered
     game                    read-only, the real state: energy(), sector(), crew() → [{ id, status, stress, hurt }]
                             (status 'well' | 'hurt' | 'dead' | 'confined' | 'asleep'), decks() → { bridge, lab, quarters,
                             medbay, hold, engineering: 'ok' | 'red' }, broken(deck), route() → NSRoute.plan(state), state()
     flow                    what Travel calls (the real game does the rest):
       click(id) → { ok, kind, fly }   the easy way: one call per click on a world or the light. Speaks a refusal, removes a
                             ghost, speaks for the faint contact, asks before the jump. fly: true when Travel should lock
                             (1 s), then go(id), fly, then arrive(id)
       canGo(id) → { ok, say, kind }   pure (says nothing); kind as NSRoute.canGo
       refuse(id)            A.U.R.A. says why not (once per few seconds)
       go(id) → { ok }       the 1 s lock closed: checks again; on no it speaks and Travel returns to rest
       arrive(id) → bool     the flight landed: the REAL warp (handleWarp, flown) runs: costs, the breach, barks, the 1 s,
                             then today's orbit view. false: the warp did not happen (Travel returns to rest)
       light() → { jump } | { fly: id }   sectors 1-5: today's jump (it asks first if something is left); sector 6: fly to
                             the STRUCTURE node, then arrive(id)
       contact()             the faint contact's line;  ghost(id)   a phantom world dissolves (as NavView does today)
     show(app), hide(), isShown(), blocked() → bool (a card, a page, a reel, a minigame or the title is up)
     playJump() → Promise    the burn and the white flash before the real Corridor (emits 'jump:burn'; resolves on
                             'jump:flash' or after 5 s; at once while hidden)
     debug.state(), debug.placeAt(id) → { x, y, r } CSS px    for the headless runs

   Bus: 'showing' (show() was called: at once, before anything else), 'shown' { sector, first, from } (deferred until
   nothing blocks), 'hidden', 'hud', 'refresh' (renderNav while
   already shown), 'resize' (G), 'jump:burn'; Travel emits 'opening:done' and 'jump:flash'; flow emits 'flow:go' { id },
   'flow:arrived' { id }, 'flow:failed' { id }.
*/
(function () {
    'use strict';
    const ON = !!window.NEW_SCREEN;
    const SPACE_MIN = 0.55, TOWER_SHARE = 0.42, MIN_ART_ROWS = 540, RESIZE_MS = 150, MAX_DT = 100;
    const JUMP_FALLBACK_MS = 5000, REFUSE_GAP_MS = 4000;
    const BLOCKED_RENDER_EVERY = 12;                      // under a card or a minigame the picture is drawn only every 12th frame (it is covered)
    const FIRST_HINT = 'A.U.R.A.: "One of our ships is calling, Commander. Point at a world to fly there."';
    const ORDER = ['travel', 'tower', 'voice'];
    const BLOCKERS = '.modal-overlay, .story-reel, .mini-host, .warp-plot, .throw-veil, .end-screen, #start-menu, #narrative-modal.active';
    const CREW_BY_TAG = { LEADER: 'cora', ENGINEER: 'jaxon', MEDIC: 'aris', SECURITY: 'vance', SPECIALIST: 'mira' };

    // ── the bus ──
    const handlers = new Map();
    const bus = {
        on(name, fn) { if (!handlers.has(name)) handlers.set(name, new Set()); handlers.get(name).add(fn); return () => handlers.get(name).delete(fn); },
        once(name, fn) { const off = bus.on(name, p => { off(); fn(p); }); return off; },
        emit(name, payload) {
            const set = handlers.get(name);
            if (set) [...set].forEach(fn => { try { fn(payload); } catch (err) { console.error(`NewScreen: a handler for "${name}" failed`, err); } });
        },
    };

    const G = {}, clock = { t: 0 }, anchors = new Map(), mods = {};
    let app = null, root = null, shown = false, frameId = null, last = null, inited = false;
    let pendingShown = null, carryFirst = false, orbitFrom = null, seenIds = new Set();
    let inFrame = false, frameBlocked = false, frameN = 0, jumping = false, hintGiven = false;
    const theApp = () => app || window.app || null;
    const st = () => { const a = theApp(); return (a && a.state) || null; };
    const each = (fn, ...args) => ORDER.forEach(n => {
        const m = mods[n];
        if (m && typeof m[fn] === 'function') { try { m[fn](...args); } catch (err) { console.error(`NewScreen: ${n}.${fn} failed`, err); } }
    });

    function register(name, mod) {
        mods[name] = mod;
        if (inited && mod && typeof mod.init === 'function') {
            try { mod.init(); if (G.W && mod.resize) mod.resize(G); } catch (err) { console.error(`NewScreen: ${name}.init failed`, err); }
        }
    }

    // ── the page: #ns-root, back to front: space, the ship, the shade under words, the words ──
    function mount() {
        if (root) return;
        root = document.createElement('div');
        root.id = 'ns-root';
        root.hidden = true;
        root.setAttribute('aria-label', 'The ship beside the journey toward the light');
        root.innerHTML = '<canvas id="ns-world" aria-hidden="true"></canvas><canvas id="ns-ship" aria-hidden="true"></canvas>'
            + '<canvas id="ns-shade" aria-hidden="true"></canvas><div id="ns-words"><div class="ns-layer" id="ns-world-words"></div>'
            + '<div class="ns-layer" id="ns-ship-words"></div><div class="ns-layer" id="ns-voice" aria-live="polite"></div></div>';
        document.body.appendChild(root);
        root.addEventListener('pointermove', e => route('move', e));
        root.addEventListener('pointerdown', e => route('down', e));
        root.addEventListener('pointerleave', e => route('leave', e));
        root.addEventListener('wheel', onWheel, { passive: false });
        addEventListener('keydown', onKey);
        let resizeTimer = 0;
        addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (shown) measure(); else G.stale = true; }, RESIZE_MS); });
        inited = true;
        each('init');
        measure();
    }

    // ── the screen: whole device px per art px; space keeps at least 55 % of the width (BUILD_A §4) ──
    function measure() {
        const A = window.ShipArt, dpr = window.devicePixelRatio || 1, devW = Math.round(innerWidth * dpr), devH = Math.round(innerHeight * dpr);
        G.dpr = dpr;
        G.k = Math.max(1, Math.floor(devH / MIN_ART_ROWS));
        G.W = Math.ceil(devW / G.k); G.H = Math.ceil(devH / G.k);
        G.HULL_OUT = A && A.L ? A.L.CX + A.L.HO + 9 : 669;
        G.offX = Math.round(G.W * TOWER_SHARE) - G.HULL_OUT;
        G.hull = G.offX + G.HULL_OUT + 1;
        if (G.W - G.hull < SPACE_MIN * G.W) { G.hull = Math.floor((1 - SPACE_MIN) * G.W); G.offX = G.hull - G.HULL_OUT - 1; }
        G.toArt = (cx, cy) => [Math.floor(cx * dpr / G.k), Math.floor(cy * dpr / G.k)];
        G.toCss = (ax, ay) => [ax * G.k / dpr, ay * G.k / dpr];
        G.stale = false;
        if (root) {
            root.style.setProperty('--t', String(Math.max(0, Math.min(1, (innerWidth - 1280) / 640))));
            root.style.setProperty('--px', (G.k / dpr) + 'px');
        }
        each('resize', G);
        bus.emit('resize', G);
    }
    /** A canvas the size of the art screen, shown at the window's size, its pixels square. Modules may use it in resize(G). */
    function sizeCanvas(c) {
        if (!c || !G.W) return;
        if (c.width !== G.W) c.width = G.W;
        if (c.height !== G.H) c.height = G.H;
        c.style.width = (G.W * G.k / G.dpr) + 'px'; c.style.height = (G.H * G.k / G.dpr) + 'px';
    }

    // ── the loop: FrameClock (it still ticks in a hidden tab); stops while the view is hidden ──
    function frame(now) {
        frameId = null;
        if (!shown) return;
        const dt = last == null ? 16 : Math.min(MAX_DT, Math.max(0, now - last));
        last = now;
        clock.t += dt;
        frameN++;
        frameBlocked = !!document.querySelector(BLOCKERS);                                   // once a frame: every module asks
        inFrame = true;
        try {
            if (pendingShown && !frameBlocked) { const p = pendingShown; pendingShown = null; carryFirst = false; bus.emit('shown', p); }
            each('update', dt, clock.t);
            if (!frameBlocked || jumping || frameN % BLOCKED_RENDER_EVERY === 0) each('render', clock.t);
        } finally { inFrame = false; }
        frameId = window.FrameClock ? window.FrameClock.request(frame) : requestAnimationFrame(frame);
    }
    function startLoop() { if (frameId == null) { last = null; frameId = window.FrameClock ? window.FrameClock.request(frame) : requestAnimationFrame(frame); } }
    function stopLoop() { if (frameId != null) { (window.FrameClock ? window.FrameClock.cancel : cancelAnimationFrame)(frameId); frameId = null; } }

    // ── input: the tower side (left of the hull edge) or the space side; nothing while a card or a game is up ──
    function blocked() { return inFrame ? frameBlocked : !!document.querySelector(BLOCKERS); }
    function route(type, e) {
        if (!shown || !G.W) return;
        if (blocked()) { root.classList.remove('is-pointing'); return; }
        const [ax, ay] = G.toArt(e.clientX, e.clientY), m = ax < G.hull ? mods.tower : mods.travel;
        let used = false;
        try { used = !!(m && m.pointer && m.pointer(type, e, ax, ay)); } catch (err) { console.error('NewScreen: pointer failed', err); }
        if (type === 'leave') { [mods.tower, mods.travel].forEach(o => { if (o && o !== m && o.pointer) { try { o.pointer('leave', e, ax, ay); } catch (err) { console.error('NewScreen: pointer failed', err); } } }); }
        else if (type === 'move' && m !== lastSide) {                                        // crossing the hull edge: the other side lets go
            const other = m === mods.tower ? mods.travel : mods.tower;
            if (other && other.pointer) { try { other.pointer('leave', e, ax, ay); } catch (err) { console.error('NewScreen: pointer failed', err); } }
        }
        if (type === 'move') { lastSide = m; root.classList.toggle('is-pointing', used); }
    }
    let lastSide = null;
    function onWheel(e) {
        if (!shown || !G.W || blocked()) return;
        const [ax, ay] = G.toArt(e.clientX, e.clientY);
        if (ax >= G.hull) return;                                                            // over space: the tower stays put
        let used = false;
        try { used = !!(mods.tower && mods.tower.pointer && mods.tower.pointer('wheel', e, ax, ay)); } catch (err) { console.error('NewScreen: wheel failed', err); }
        if (used) e.preventDefault();
    }
    function onKey(e) {
        if (!shown || blocked() || e.defaultPrevented) return;
        let used = false;
        try { used = !!(mods.travel && mods.travel.key && mods.travel.key(e)); } catch (err) { console.error('NewScreen: key failed', err); }
        if (used) e.preventDefault();
    }

    // ── game: the real state, read only ──
    const game = {
        state: st,
        energy: () => { const s = st(); return s ? s.energy : 0; },
        sector: () => { const s = st(); return s ? s.currentSector : 1; },
        crew() {
            const s = st();
            return ((s && s.crew) || []).map(c => {
                const tags = c.tags || [], tag = Object.keys(CREW_BY_TAG).find(t => tags.includes(t));
                const hurt = c.status === 'INJURED';
                const status = c.status === 'DEAD' ? 'dead' : tags.includes('CONFINED') ? 'confined' : tags.includes('SEDATED') ? 'asleep' : hurt ? 'hurt' : 'well';
                return { id: tag ? CREW_BY_TAG[tag] : String(c.name || '').toLowerCase(), status, stress: c.stress || 0, hurt };
            });
        },
        decks() {
            const s = st(), red = key => (s && s.isDeckOperational && !s.isDeckOperational(key) ? 'red' : 'ok');
            return { bridge: red('bridge'), lab: red('lab'), quarters: red('quarters'), medbay: 'ok', hold: red('cargo'), engineering: red('engineering') };
        },
        broken: deck => game.decks()[deck] === 'red',
        route: () => window.NSRoute.plan(st()),
    };

    // ── flow: a click in space becomes the real game's own warp, jump or line ──
    let lastRefusal = { line: null, at: -Infinity };
    /** A line caused by a click: on screen at once (it cuts the one showing), and in the log as today. */
    function speak(line) {
        const s = st();
        if (!s || !line) return;
        const now = performance.now();
        if (line === lastRefusal.line && now - lastRefusal.at < REFUSE_GAP_MS) return;
        lastRefusal = { line, at: now };
        const v = mods.voice;
        if (v && typeof v.sayLine === 'function') { try { v.sayLine(line); } catch (err) { console.error('NewScreen: voice.sayLine failed', err); } }
        s.addLog(line);
    }
    const flow = {
        canGo: id => window.NSRoute.canGo(st(), id),
        refuse(id) { const r = flow.canGo(id); if (!r.ok) speak(r.say); },
        click(id) {
            const s = st(), r = flow.canGo(id);
            if (!s || !theApp()) return { ok: false, kind: 'none', fly: false };
            if (r.kind === 'contact') { flow.contact(); return { ok: false, kind: r.kind, fly: false }; }
            if (!r.ok) { speak(r.say); return { ok: false, kind: r.kind, fly: false }; }
            if (r.kind === 'ghost') { flow.ghost(id); return { ok: true, kind: r.kind, fly: false }; }
            if (r.kind === 'light') { const l = flow.light(); return { ok: true, kind: r.kind, fly: !!l.fly, id: l.fly || 'light' }; }
            return { ok: true, kind: r.kind, fly: true, id };
        },
        go(id) {
            const r = flow.canGo(id);
            if (!r.ok || (theApp() && theApp()._isInTransit)) { speak(r.say); return { ok: false }; }
            bus.emit('flow:go', { id });
            return { ok: true };
        },
        arrive(id) {
            const s = st(), a = theApp(), node = window.NSRoute.find(s, id);
            if (!s || !a || !node) { bus.emit('flow:failed', { id }); return false; }
            a.handleWarp(node, { flown: true });
            if (s.currentSystem === node) {
                window.NSRoute.arrive(s, node.id);
                bus.emit('flow:arrived', { id: node.id });
                return true;
            }
            bus.emit('flow:failed', { id });
            return false;
        },
        light() {
            const s = st(), a = theApp();
            if (!s || !a) return { jump: false };
            if (s.currentSector >= (window.FINAL_SECTOR || 6)) {                              // bundle.js's own FINAL_SECTOR
                const structure = window.NSRoute.find(s, 'light');
                if (structure) return { fly: structure.id };
            }
            a.handleSectorJump();
            return { jump: true };
        },
        contact() { speak(window.NSRoute.LINES.contact); },
        ghost(id) {                                                                         // the map's own rule (App.dissolveGhost)
            const s = st(), a = theApp(), node = window.NSRoute.find(s, id);
            if (!s || !a || !node || typeof a.dissolveGhost !== 'function') return;
            if (a.dissolveGhost(node)) bus.emit('refresh', { ghost: id });
        },
    };

    // ── show and hide: bundle.js calls these instead of NavView, and before OrbitView ──
    function show(realApp) {
        if (!ON) return;
        app = realApp || app;
        const s = st();
        bus.emit('showing', {});                                                             // now: the voice keeps a line said just before this
        if (s && s.gameOver) { hide(); return; }                                             // the end screen stays on top
        mount();
        const nodes = (s && s.sectorNodes) || [];
        const first = carryFirst || !nodes.some(n => seenIds.has(n.id));
        seenIds = new Set(nodes.map(n => n.id));
        if (s) window.NSRoute.plan(s);
        const wasShown = shown;
        shown = true;
        document.body.classList.add('ns-travel');
        root.hidden = false;
        if (G.stale || !G.W) measure();
        if (!wasShown || first || pendingShown) {
            pendingShown = { sector: s ? s.currentSector : 1, first: first || !!(pendingShown && pendingShown.first), from: orbitFrom != null ? orbitFrom : pendingShown ? pendingShown.from : null };
            carryFirst = pendingShown.first;
            orbitFrom = null;
        } else bus.emit('refresh', {});
        bus.emit('hud', {});
        startLoop();
    }
    function hide() {
        const s = st();
        if (s && s.currentSystem) orbitFrom = s.currentSystem.id;                         // leaving this orbit later: it slides away
        if (!root) return;
        const wasShown = shown;
        shown = false;
        stopLoop();
        document.body.classList.remove('ns-travel');
        root.hidden = true;
        root.classList.remove('is-pointing');
        if (wasShown) bus.emit('hidden', {});
    }
    function playJump() {
        if (!shown) return Promise.resolve();
        jumping = true;
        return new Promise(resolve => {
            let done = false;
            const finish = () => { if (done) return; done = true; jumping = false; off(); clearTimeout(timer); resolve(); };
            const off = bus.on('jump:flash', finish), timer = setTimeout(finish, JUMP_FALLBACK_MS);
            bus.emit('jump:burn', {});
        });
    }

    // ── debug, for the headless runs ──
    const debug = {
        state() {
            const s = st(), p = s ? window.NSRoute.plan(s) : null;
            return {
                shown, sector: s ? s.currentSector : null, energy: s ? s.energy : null, t: Math.round(clock.t),
                mode: !shown ? 'orbit' : blocked() ? 'blocked' : 'travel', G: { k: G.k, W: G.W, H: G.H, hull: G.hull, offX: G.offX },
                plan: p ? { at: p.at, giant: p.giant, story: p.story, light: p.light.id, worlds: p.worlds.map(w => ({ id: w.id, name: w.node.name, type: w.node.type, band: w.band, slot: w.slot, status: w.status, mate: w.mate, hidden: !!w.node.storyHidden })) } : null,
                mods: ORDER.filter(n => mods[n]),
            };
        },
        placeAt(id) {
            const t = mods.travel;
            if (!t || typeof t.placeAt !== 'function' || !G.W) return null;
            const a = t.placeAt(id);
            if (!a) return null;
            const [x, y] = G.toCss(a.x, a.y);
            return { x, y, r: (a.r || 0) * G.k / G.dpr, shown: a.shown !== false };
        },
    };

    /** Sector 1, nothing visited yet: the Coach's first tip, said once in the travel view instead (the Coach is hidden there). */
    function firstHint() {
        const s = st(), v = mods.voice;
        if (hintGiven || !shown || !s || s.currentSector !== 1 || !v || typeof v.sayLine !== 'function') return;
        const p = window.NSRoute.plan(s), signal = (s.sectorNodes || []).find(n => n.isFirstSignal && !n.exodusInvestigated);
        if (p.at !== 0 || !signal) return;
        hintGiven = true;
        try { v.sayLine(FIRST_HINT); } catch (err) { console.error('NewScreen: the first hint failed', err); }
    }

    if (ON) {
        bus.on('opening:done', () => setTimeout(firstHint, 1400));                          // after the tower has slid in
        addEventListener('hud-updated', () => { if (shown) bus.emit('hud', {}); });
        addEventListener('game-over', () => hide());
    }

    window.NewScreen = Object.freeze({
        on: ON, G, clock, bus, anchors, mods, game, flow, debug, register, sizeCanvas,
        get app() { return theApp(); },
        show, hide, isShown: () => shown, blocked, playJump,
    });
})();
