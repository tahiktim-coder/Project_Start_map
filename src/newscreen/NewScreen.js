/* ═══ Silent Exodus · new screen (?new=1) · NewScreen.js: the shell of the new screen ══════════════════════════════════
   What it is: the full-screen view that replaces today's map AND today's orbit screen while the switch is on
   (docs/BUILD_A.md §1, §2, §4; docs/BUILD_B.md §1). It mounts #ns-root, measures the art pixel, the bridge and the tower,
   runs the loop, routes the pointer by mode, carries the bus, reads the REAL game state for the modules (game) and hands
   their clicks to the REAL game code (flow). It draws nothing itself: Travel draws space and the worlds, Tower the ship,
   Stop the dive and the bridge, Voice the spoken lines. What each stop offers lives in Orbit.js (NSOrbit).
   Source: the boot of prototypes/slice/index.html (measure, the loop, input) and prototypes/slice/state.js (the bus).
   Loaded only when the new-screen switch is on; bundle.js calls show/hide/stop/playJump only behind isNewScreen().

   window.NewScreen (frozen)
     on                      the switch (window.NEW_SCREEN)
     G                       { dpr, k, W, H, offX, hull, HULL_OUT, toArt(cx, cy) → [ax, ay], toCss(ax, ay) → [cx, cy],
                               bk, bW 640, bH 360, bLeft, bTop,  ts, tTop, tBot, tRows, tLeft, tY0 }
                             k: device px per art px (at least 540 art rows); hull: the art column where space starts.
                             bk: device px per bridge px, the largest that shows the whole 640 x 360 bridge (3 at 1080,
                             2.4 at 864, 2.58 at 928; not a whole number: nearest-neighbour); bLeft, bTop: CSS px, centred.
                             Stop.js fills what is left beside it with the space outside our hull. The tower fit (BUILD_B §8): ts device px per tower px (rows tTop..tBot, the whole
                             tower: devH / 1336), columns from tLeft; tY0 device px from the top (the tower centred when
                             the 45 % width cap shrank it). hull = ceil((HULL_OUT − tLeft) × ts / k).
     clock.t                 ms; runs only while the view is shown
     app                     the real App (set by show / stop)
     mode() → 'travel' | 'dive-in' | 'stop' | 'dive-out'
     bus.on(name, fn) → off, bus.emit(name, payload), bus.once(name, fn) → off
     anchors                 Map name → () => [{ x, y, side, align }] in CSS px
     register(name, mod)     name: 'travel' | 'tower' | 'stop' | 'voice'; mod: { init(), resize(G), update(dt, t),
                             render(t), pointer(type, e, x, y) → bool (type 'move' | 'down' | 'leave' | 'wheel'), key?(e) }.
                             travel and tower get art px; stop gets CSS px (e.clientX, e.clientY), as in the slice.
     mods                    { travel, tower, stop, voice } as registered
     game                    read-only, the real state: energy(), sector(), crew(), decks(), broken(deck), route(), state()
     flow                    what the modules call (the real game does the rest):
       click, canGo, refuse, go, arrive, light, contact, ghost   travel (BUILD_A §4)
       actions() → [{ key, words, near, team, run() }]          what this stop offers now (NSOrbit.actions)
       act(key, ids?) → bool  run one (ids: the two picked for 'team');  eligible() → ids fit to go
       leave() → Promise<bool>  Leave orbit (the dive back out, or refused with a line)
       trip() → { ids, aboard } | null   who is down now;  sign() → { kind, comes } | null   this stop's crisis sign
       person(id, say?)       a person in the tower clicked: their line, said beside them (not logged: saves keep 20 lines)
       bench() → bool         Mira's bench clicked: date the wreck whose star fix is on it
       datable() → node | null    a wreck whose fix is on Mira's bench now
       deckChoices(key) → [{ words, note }]   a red deck clicked: fix, patch, live with it
       deckChoose(key, i) → bool
     show(app), hide(), stop(app) → bool, hint(), isShown(), blocked() → bool, playJump() → Promise
     debug.state(), debug.placeAt(id) → { x, y, r } CSS px    for the headless runs

   Bus: 'showing', 'shown' { sector, first, from }, 'hidden', 'hud', 'refresh', 'resize' (G), 'mode' { mode }, 'jump:burn';
   Travel emits 'opening:done' and 'jump:flash'; flow emits 'flow:go' { id }, 'flow:arrived' { id }, 'flow:failed' { id }.
   The stop (BUILD_B §1): the shell emits 'dive:start' { id }, 'dive:cancel' { id }, 'stop:open' { id, dived },
   'stop:refresh' { id }, 'stop:close' { id } (at once, no dive), 'dive:back' { id }; NSOrbit emits 'trip:down' { ids,
   aboard }, 'trip:back' { ids }; the stop module emits 'dive:plated' { dir }, 'stop:shown' { id }, 'stop:hidden' { id }.
*/
(function () {
    'use strict';
    const ON = !!window.NEW_SCREEN;
    const SPACE_MIN = 0.55, TOWER_SHARE = 0.42, MIN_ART_ROWS = 540, RESIZE_MS = 150, MAX_DT = 100;
    const TOWER_MAX = 0.45, TOWER_PAD_TOP = 40, TOWER_PAD_TAIL = 48, TOWER_LEFT = 40, BRIDGE_W = 640, BRIDGE_H = 360;
    const JUMP_FALLBACK_MS = 5000, REFUSE_GAP_MS = 4000, DIVE_WATCH_MS = 4500;
    const BLOCKED_RENDER_EVERY = 12;                      // under a card or a minigame the picture is drawn only every 12th frame (it is covered)
    const HOLD_STOP_MS = 4000, HOLD_TRAVEL_MS = 1800, CLICK_GRACE_MS = 700;   // a card that turns up on its own waits until the picture has been seen
    const FIRST_HINT = 'A.U.R.A.: "One of our ships is calling, Commander. Point at a world to fly there."';
    const ORDER = ['travel', 'tower', 'stop', 'voice'];
    const OUTSIDE = new Set(['travel', 'dive-in', 'dive-out']);                          // travel and the tower are drawn only then
    const BLOCKERS = '.modal-overlay:not(.ns-held), .story-reel, .mini-host, .warp-plot, .throw-veil, .end-screen, #start-menu, #narrative-modal.active, .ns-film';
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
    let mode = 'travel', stopId = null, watch = null;
    let stopShownAt = -1e9, travelShownAt = -1e9, lastDown = -1e9;
    const theApp = () => app || window.app || null;
    const st = () => { const a = theApp(); return (a && a.state) || null; };
    const orbit = () => window.NSOrbit || null;
    const drawn = name => name !== 'travel' && name !== 'tower' || OUTSIDE.has(mode);
    const each = (fn, ...args) => ORDER.forEach(n => {
        const m = mods[n];
        if (fn === 'render' && !drawn(n)) return;
        if (m && typeof m[fn] === 'function') { try { m[fn](...args); } catch (err) { console.error(`NewScreen: ${n}.${fn} failed`, err); } }
    });

    function register(name, mod) {
        mods[name] = mod;
        if (inited && mod && typeof mod.init === 'function') {
            try { mod.init(); if (G.W && mod.resize) mod.resize(G); } catch (err) { console.error(`NewScreen: ${name}.init failed`, err); }
        }
    }

    // ── the page: #ns-root, back to front: space, the ship, the dive, the bridge, the shade under words, the words ──
    function mount() {
        if (root) return;
        root = document.createElement('div');
        root.id = 'ns-root';
        root.hidden = true;
        root.dataset.mode = mode;
        root.setAttribute('aria-label', 'The ship beside the journey toward the light');
        root.innerHTML = '<canvas id="ns-world" aria-hidden="true"></canvas><canvas id="ns-ship" aria-hidden="true"></canvas>'
            + '<canvas id="ns-dive" aria-hidden="true"></canvas><canvas id="ns-bridge" aria-hidden="true"></canvas>'
            + '<canvas id="ns-shade" aria-hidden="true"></canvas><div id="ns-words"><div class="ns-layer" id="ns-world-words"></div>'
            + '<div class="ns-layer" id="ns-ship-words"></div><div class="ns-layer" id="ns-stop-words"></div>'
            + '<div class="ns-layer" id="ns-voice" aria-live="polite"></div></div>';
        document.body.appendChild(root);
        root.addEventListener('pointermove', e => route('move', e));
        root.addEventListener('pointerdown', e => { lastDown = performance.now(); route('down', e); });
        root.addEventListener('pointerleave', e => route('leave', e));
        root.addEventListener('wheel', onWheel, { passive: false });
        addEventListener('keydown', onKey);
        let resizeTimer = 0;
        addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (shown) measure(); else G.stale = true; }, RESIZE_MS); });
        inited = true;
        each('init');
        measure();
        new MutationObserver(onAdded).observe(document.body, { childList: true });
    }

    // ── a card that turns up on its own (a crew moment, a story card, the head count) waits, hidden, until the dive is over
    //    and the world in the window (or the travel view) has been seen for a moment; one the player asked for opens at once ──
    function holding() {
        const now = performance.now();
        if (!shown || now - lastDown < CLICK_GRACE_MS) return false;
        if (mode === 'dive-in' || mode === 'dive-out') return true;
        if (mode === 'stop') return now - stopShownAt < HOLD_STOP_MS;
        return !!pendingShown || now - travelShownAt < HOLD_TRAVEL_MS;
    }
    function onAdded(list) {
        if (!holding()) return;
        list.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1 && n.classList.contains('modal-overlay')) n.classList.add('ns-held'); }));
    }
    function release(all) {
        const held = document.querySelectorAll('.modal-overlay.ns-held');
        if (!held.length || (!all && (holding() || document.querySelector(BLOCKERS)))) return;
        held.forEach(el => {
            el.classList.remove('ns-held');
            if (window.ChoiceGuard) window.ChoiceGuard.hold(el);                             // it appears under a moving cursor: no click lands for 400 ms
            const decide = el.querySelector('.enc-decide:not([hidden])'), next = el.querySelector('.enc-next');
            try { (decide || next || el).focus({ preventScroll: true }); } catch (err) { /* nothing to focus */ }
        });
    }

    // ── the screen: whole device px per art px; the bridge at whole px; the whole tower fits the height (BUILD_B §1, §8) ──
    function measure() {
        const A = window.ShipArt, L = A && A.L, dpr = window.devicePixelRatio || 1, devW = Math.round(innerWidth * dpr), devH = Math.round(innerHeight * dpr);
        G.dpr = dpr;
        G.k = Math.max(1, Math.floor(devH / MIN_ART_ROWS));
        G.W = Math.ceil(devW / G.k); G.H = Math.ceil(devH / G.k);
        G.HULL_OUT = L ? L.CX + L.HO + 9 : 669;
        // the tower: all six decks, the nose's shoulder and the bell's top, scaled to the height (at most 45 % of the width)
        G.tTop = (L ? L.TOP0 : 454) - TOWER_PAD_TOP; G.tBot = (L ? L.TAIL0 : 1702) + TOWER_PAD_TAIL; G.tRows = G.tBot - G.tTop;
        G.tLeft = TOWER_LEFT;
        const towerW = G.HULL_OUT - G.tLeft;
        G.ts = Math.min(devH / G.tRows, TOWER_MAX * devW / towerW);
        G.tY0 = Math.round((devH - G.tRows * G.ts) / 2);
        G.hull = Math.ceil(towerW * G.ts / G.k);
        if (G.W - G.hull < SPACE_MIN * G.W) G.hull = Math.floor((1 - SPACE_MIN) * G.W);
        G.offX = G.hull - G.HULL_OUT - 1;                                                    // the tower art at 1:1 would end at the hull edge (older code)
        // the bridge (layout D): 640 x 360 bridge px, as large as the window shows it whole, centred (Stop fills the sides)
        G.bW = BRIDGE_W; G.bH = BRIDGE_H;
        G.bk = Math.max(1, Math.min(devW / BRIDGE_W, devH / BRIDGE_H));
        G.bLeft = Math.round((innerWidth - BRIDGE_W * G.bk / dpr) / 2); G.bTop = Math.round((innerHeight - BRIDGE_H * G.bk / dpr) / 2);
        G.toArt = (cx, cy) => [Math.floor(cx * dpr / G.k), Math.floor(cy * dpr / G.k)];
        G.toCss = (ax, ay) => [ax * G.k / dpr, ay * G.k / dpr];
        G.stale = false;
        if (root) {
            root.style.setProperty('--t', String(Math.max(0, Math.min(1, (innerWidth - 1280) / 640))));
            root.style.setProperty('--px', (G.k / dpr) + 'px');
            root.style.setProperty('--bpx', (G.bk / dpr) + 'px');
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
        release(false);
        frameBlocked = !!document.querySelector(BLOCKERS);                                   // once a frame: every module asks
        inFrame = true;
        try {
            if (pendingShown && !frameBlocked && mode === 'travel') { const p = pendingShown; pendingShown = null; carryFirst = false; travelShownAt = performance.now(); bus.emit('shown', p); }
            checkWatch(dt);
            const o = orbit();
            if (o && typeof o.tick === 'function') { try { o.tick(dt, frameBlocked); } catch (err) { console.error('NewScreen: NSOrbit.tick failed', err); } }
            each('update', dt, clock.t);
            if (!frameBlocked || jumping || frameN % BLOCKED_RENDER_EVERY === 0) each('render', clock.t);
        } finally { inFrame = false; }
        frameId = window.FrameClock ? window.FrameClock.request(frame) : requestAnimationFrame(frame);
    }
    function startLoop() { if (frameId == null) { last = null; frameId = window.FrameClock ? window.FrameClock.request(frame) : requestAnimationFrame(frame); } }
    function stopLoop() { if (frameId != null) { (window.FrameClock ? window.FrameClock.cancel : cancelAnimationFrame)(frameId); frameId = null; } }

    // ── input: in travel the tower side (left of the hull edge) or the space side; otherwise the stop; nothing under a card ──
    function blocked() { return inFrame ? frameBlocked : !!document.querySelector(BLOCKERS); }
    const tell = (m, type, e, x, y) => { try { return !!(m && m.pointer && m.pointer(type, e, x, y)); } catch (err) { console.error('NewScreen: pointer failed', err); return false; } };
    let lastSide = null;
    function route(type, e) {
        if (!shown || !G.W) return;
        if (blocked()) { root.classList.remove('is-pointing'); return; }
        if (mode !== 'travel') {
            const used = tell(mods.stop, type, e, e.clientX, e.clientY);
            if (type === 'move') { lastSide = mods.stop; root.classList.toggle('is-pointing', used); }
            return;
        }
        const [ax, ay] = G.toArt(e.clientX, e.clientY), m = ax < G.hull ? mods.tower : mods.travel;
        const used = tell(m, type, e, ax, ay);
        if (type === 'leave') [mods.tower, mods.travel].forEach(o => { if (o !== m) tell(o, 'leave', e, ax, ay); });
        else if (type === 'move' && m !== lastSide) {                                        // crossing the hull edge: the other side lets go
            [mods.tower, mods.travel, mods.stop].forEach(o => { if (o !== m) tell(o, 'leave', e, ax, ay); });
        }
        if (type === 'move') { lastSide = m; root.classList.toggle('is-pointing', used); }
    }
    function onWheel(e) {
        if (!shown || !G.W || blocked() || mode !== 'travel') return;
        const [ax, ay] = G.toArt(e.clientX, e.clientY);
        if (ax >= G.hull) return;                                                            // over space: the tower stays put
        if (tell(mods.tower, 'wheel', e, ax, ay)) e.preventDefault();
    }
    function onKey(e) {
        if (!shown || blocked() || e.defaultPrevented) return;
        const m = mode === 'travel' ? mods.travel : mods.stop;
        let used = false;
        try { used = !!(m && m.key && m.key(e)); } catch (err) { console.error('NewScreen: key failed', err); }
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

    // ── flow: a click becomes the real game's own warp, jump, action or line ──
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
    const ask = (fn, ...args) => { const o = orbit(); if (!o || typeof o[fn] !== 'function') return null; try { return o[fn](...args); } catch (err) { console.error(`NewScreen: NSOrbit.${fn} failed`, err); return null; } };
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
            const diving = !!mods.stop && mode === 'travel';
            if (diving) { stopId = node.id; setMode('dive-in'); bus.emit('dive:start', { id: node.id }); }
            a.handleWarp(node, { flown: true });
            if (s.currentSystem === node) {
                window.NSRoute.arrive(s, node.id);
                bus.emit('flow:arrived', { id: node.id });
                return true;
            }
            if (diving) { disarm(); setMode('travel'); stopId = null; bus.emit('dive:cancel', { id: node.id }); }
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
        // ── the stop (BUILD_B §3, §4) ──
        actions: () => (mode === 'stop' ? ask('actions', theApp()) || [] : []),
        act(key, ids) {
            const a = theApp();
            if (!a || mode !== 'stop' || blocked() || a._isInTransit) return false;
            return !!ask('act', a, key, ids);
        },
        eligible: () => ask('eligible', theApp()) || [],
        trip: () => ask('trip') || null,
        sign: () => { const s = st(), n = s && s.currentSystem; return (n && n._nsCrisis) || null; },
        leave() {
            const a = theApp(), s = st(), node = s && s.currentSystem;
            if (!a || !node || mode !== 'stop' || blocked() || a._isInTransit) return Promise.resolve(false);
            const r = ask('beforeLeave', a);
            return Promise.resolve(r).then(v => {
                if (!v || !v.ok) { if (v && v.say) speak(v.say); return false; }
                if (v.direct || !mods.stop) { window.dispatchEvent(new Event('req-break-orbit')); return true; }   // the Structure refuses itself
                if (mode !== 'stop' || s.currentSystem !== node) return false;
                stopId = node.id;
                setMode('dive-out');
                bus.emit('dive:back', { id: node.id });
                arm('plated', node.id);
                return true;
            });
        },
        person(id, say) {
            const s = st(), R = window.ShipRoutine;
            if (!s || !R || !id) return;
            const l = R.line('travel', id, say || 'work'), v = mods.voice;
            if (!l || !l.text || !v || typeof v.say !== 'function') return;
            try { v.say({ id, who: l.who, text: l.text }); } catch (err) { console.error('NewScreen: voice.say failed', err); }
        },
        datable: () => ask('datable', st()) || null,
        bench() { const a = theApp(), n = flow.datable(); if (!a || !n || blocked()) return false; a.dateWreck(n); return true; },
        deckChoices: key => ask('deckChoices', st(), key) || [],
        deckChoose(key, i) { const a = theApp(); if (!a || blocked()) return false; return !!ask('deckChoose', a, key, i); },
    };

    // ── the modes: travel, the dive in, the bridge, the dive back out (BUILD_B §1) ──
    function setMode(m) {
        if (m === mode) return;
        mode = m;
        if (root) root.dataset.mode = m;
        if (m !== 'travel' && root) root.classList.remove('is-pointing');
        bus.emit('mode', { mode: m });
    }
    /** A watchdog: if the stop module never answers (it failed), the game still goes on. */
    function arm(kind, id) { watch = { kind, id, left: DIVE_WATCH_MS }; }                // counts only shown, unblocked time
    function disarm() { watch = null; }
    function checkWatch(dt) {
        if (!watch || frameBlocked) return;
        watch.left -= dt;
        if (watch.left > 0) return;
        const w = watch; watch = null;
        console.warn(`NewScreen: the stop did not answer (${w.kind}); going on without it`);
        if (w.kind === 'open' && mode === 'dive-in') { const s = st(); if (s && s.currentSystem) onStopShown({ id: s.currentSystem.id }); else { setMode('travel'); bus.emit('dive:cancel', { id: w.id }); } }
        else if (w.kind === 'plated' && mode === 'dive-out') { onPlated({ dir: 'out' }); arm('hidden', w.id); }
        else if (w.kind === 'hidden' && mode === 'dive-out') onStopHidden({ id: w.id });
    }
    function onStopShown(p) {
        if (mode === 'travel') return;
        disarm();
        setMode('stop');
        stopShownAt = performance.now();
        const s = st();
        stopId = (s && s.currentSystem && s.currentSystem.id) || (p && p.id) || stopId;
        orbitFrom = stopId;
        ask('opened', theApp());
    }
    function onPlated(p) {
        if (!p || p.dir !== 'out' || mode !== 'dive-out') return;
        if (watch && watch.kind === 'plated') arm('hidden', stopId);
        const s = st();
        if (s && s.currentSystem) window.dispatchEvent(new Event('req-break-orbit'));     // today's handler: the log, currentSystem, renderNav
    }
    function onStopHidden(p) {
        if (mode !== 'dive-out') return;
        disarm();
        const from = orbitFrom != null ? orbitFrom : (p && p.id) || stopId;
        setMode('travel');
        stopId = null; orbitFrom = null;
        const s = st();
        if (s && s.currentSystem) { stop(theApp()); return; }                                // the leave was refused after all: back to the bridge
        pendingShown = { sector: s ? s.currentSector : 1, first: carryFirst, from };
    }
    /** Seen this sector before? (a Continue straight into orbit has not.) Keeps 'first' for the travel view's next show. */
    function noteSector(s) {
        const nodes = (s && s.sectorNodes) || [];
        const first = carryFirst || !nodes.some(n => seenIds.has(n.id));
        seenIds = new Set(nodes.map(n => n.id));
        return first;
    }
    function reveal() {
        shown = true;
        document.body.classList.add('ns-travel');
        root.hidden = false;
        if (G.stale || !G.W) measure();
        startLoop();
    }

    // ── show, stop and hide: bundle.js calls these instead of NavView and OrbitView ──
    function show(realApp) {
        if (!ON) return;
        app = realApp || app;
        const s = st();
        bus.emit('showing', {});                                                             // now: the voice keeps a line said just before this
        if (s && s.gameOver) { hide(); return; }                                             // the end screen stays on top
        mount();
        const first = noteSector(s);
        if (s) window.NSRoute.plan(s);
        const wasShown = shown;
        reveal();
        if (mode === 'dive-out') { carryFirst = carryFirst || first; bus.emit('refresh', {}); bus.emit('hud', {}); return; }   // the world slides away once the dive is out
        let closed = false;
        if (mode === 'stop' || mode === 'dive-in') {                                         // travel while the bridge was up (a fold, an escape): close it at once
            const id = stopId; disarm(); setMode('travel'); stopId = null; closed = true;
            bus.emit('stop:close', { id });
        }
        if (!wasShown || first || pendingShown || closed) {                                  // closed: the world we were at slides away as after a leave
            pendingShown = { sector: s ? s.currentSector : 1, first: first || !!(pendingShown && pendingShown.first), from: orbitFrom != null ? orbitFrom : pendingShown ? pendingShown.from : null };
            carryFirst = pendingShown.first;
            orbitFrom = null;
        } else bus.emit('refresh', {});
        bus.emit('hud', {});
    }
    /** renderOrbit under the switch: the bridge instead of today's orbit screen. false: no stop module (today's orbit then). */
    function stop(realApp) {
        if (!ON || !mods.stop) return false;
        app = realApp || app;
        const s = st(), node = s && s.currentSystem;
        if (!node || (s && s.gameOver)) return false;
        mount();
        if (mode === 'stop' && stopId === node.id) { bus.emit('stop:refresh', { id: node.id }); bus.emit('hud', {}); return true; }
        if (mode === 'dive-in' && shown) { stopId = node.id; bus.emit('stop:open', { id: node.id, dived: true }); arm('open', node.id); bus.emit('hud', {}); return true; }
        // from travel without a flight (an anomaly's throw), from the title (Continue in orbit), or a different place: fade in
        if (mode === 'stop' || mode === 'dive-out') bus.emit('stop:close', { id: stopId });
        noteSector(s);                                                                       // seen now: leaving this orbit later is not a first arrival
        if (s) window.NSRoute.plan(s);
        bus.emit('showing', {});
        reveal();
        stopId = node.id;
        setMode('stop');
        bus.emit('stop:open', { id: node.id, dived: false });
        onStopShown({ id: node.id });
        bus.emit('hud', {});
        return true;
    }
    function hide() {
        const s = st();
        if (s && s.currentSystem) orbitFrom = s.currentSystem.id;                         // leaving this orbit later: it slides away
        if (mode !== 'travel') { const id = stopId; disarm(); setMode('travel'); stopId = null; bus.emit('stop:close', { id }); }
        if (!root) return;
        const wasShown = shown;
        release(true);                                                                       // nothing stays hidden once the view is gone
        shown = false;
        stopLoop();
        document.body.classList.remove('ns-travel');
        root.hidden = true;
        root.classList.remove('is-pointing');
        if (wasShown) bus.emit('hidden', {});
    }
    function playJump() {
        if (!shown || mode !== 'travel') return Promise.resolve();
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
            const s = st(), p = s ? window.NSRoute.plan(s) : null, o = orbit();
            return {
                shown, sector: s ? s.currentSector : null, energy: s ? s.energy : null, t: Math.round(clock.t), view: mode,
                mode: !shown ? 'hidden' : blocked() ? 'blocked' : mode, at: s && s.currentSystem ? s.currentSystem.id : null,
                G: { k: G.k, W: G.W, H: G.H, hull: G.hull, offX: G.offX, bk: G.bk, bLeft: G.bLeft, bTop: G.bTop, ts: G.ts, tTop: G.tTop, tY0: G.tY0 },
                plan: p ? { at: p.at, giant: p.giant, story: p.story, light: p.light.id, worlds: p.worlds.map(w => ({ id: w.id, name: w.node.name, type: w.node.type, band: w.band, slot: w.slot, status: w.status, mate: w.mate, hidden: !!w.node.storyHidden })) } : null,
                actions: mode === 'stop' ? flow.actions().map(x => ({ key: x.key, words: x.words, near: x.near, team: !!x.team })) : [],
                trip: flow.trip(), sign: flow.sign(), orbit: o && typeof o.debug === 'function' ? o.debug() : null,
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
        if (hintGiven || !shown || mode !== 'travel' || !s || s.currentSector !== 1 || !v || typeof v.sayLine !== 'function') return;
        const p = window.NSRoute.plan(s), signal = (s.sectorNodes || []).find(n => n.isFirstSignal && !n.exodusInvestigated);
        if (p.at !== 0 || !signal) return;
        hintGiven = true;
        try { v.sayLine(FIRST_HINT); } catch (err) { console.error('NewScreen: the first hint failed', err); }
    }
    /** The wake-up talk is still going (start/Wake.js): it calls hint() itself when it ends. */
    const talking = () => { const w = window.NSWake; try { return !!(w && typeof w.pending === 'function' && w.pending()); } catch (err) { return false; } };

    if (ON) {
        bus.on('opening:done', () => setTimeout(() => { if (!talking()) firstHint(); }, 1400));   // after the tower has slid in
        bus.on('stop:shown', onStopShown);
        bus.on('dive:plated', onPlated);
        bus.on('stop:hidden', onStopHidden);
        addEventListener('hud-updated', () => { if (shown) bus.emit('hud', {}); });
        addEventListener('game-over', () => hide());
    }

    window.NewScreen = Object.freeze({
        on: ON, G, clock, bus, anchors, mods, game, flow, debug, register, sizeCanvas,
        get app() { return theApp(); },
        mode: () => mode,
        show, hide, stop, hint: firstHint, isShown: () => shown, blocked, playJump,
    });
})();
