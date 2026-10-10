/* ═══ Silent Exodus · new screen (?new=1) · travel/Travel.js: the travel view (the space side) ══════════════════════════
   What it is: the module the shell runs while we travel. The field of worlds ahead (the real sector's nodes, planned by
   NSRoute), our Lander flying with its plume, space streaming past, pointing a world (its name and one line, no numbers),
   a click with one second to cancel, the flight (the fork's other world slipping behind the giant or passing), the
   arrival handed to the real game, leaving a world (it glides to the left edge in shadow), the light, the jump's burn and
   flash, the corridor's dark, and the next sector arriving from black with its title.
   Source: prototypes/slice/world.js §5-9 (render, words, pointing, the module's life). The slice's script.js lock and
   cancel (route:go, route:cancel, route:fired) live here now; the real game's rules come through NewScreen.flow.
   Draws ONLY into canvas#ns-world and #ns-world-words. Pictures: travel/Pictures.js; places and moves: travel/Field.js;
   looks per sector: travel/SectorLooks.js. Reads the real game only through NewScreen.game and NewScreen.flow.

   NewScreen.mods.travel = {
     init() · resize(G) · update(dt, t) · render(t) · pointer(type, e, ax, ay) → bool · key(e) → bool
     placeAt(id)    → { x, y, r, shown } art px of a place now ('light' too; NewScreen.debug.placeAt turns it to CSS px)
     placeCss(id)   → the same in CSS px
     landerPose()   → { x, y, len, angle } art px: our ship now
     discs()        → [[x, y, r]] art px of every round thing on screen
     noteUp()       → true while a hover note is showing (the voice waits)
     debugState()   → { sector, mode, at, hover, lock, flight, modes }
   }
   Uses:    NewScreen.{ register, bus, anchors, clock, game.{ sector, energy, broken, route }, flow.{ click, canGo, refuse, go,
            arrive }, blocked, isShown, app, mods.tower.{ occupied, beat } (optional) }
   Listens: 'shown' { sector, first, from } · 'hidden' · 'hud' · 'refresh' · 'jump:burn'
   The hover note goes on a click and stays away until the pointer really moves (a refusal is then seen at once); in a
   flight what is under a still pointer is worked out again every frame. The jump's white-gold flash washes the whole
   screen, the tower too (a div over both canvases, warm steps down to the corridor's dark).
   Emits:   'opening:done' (4.2 s after a sector's first show; at once on a show that is not the first) · 'jump:flash'
            (2.65 s after the burn) · 'note' { up } (the hover note shows or goes: the voice waits)
   Registers anchors (CSS px): 'ship', 'light', 'place:<node id>'.
*/
(function () {
    'use strict';
    const P = window.NSPaint, F = window.NSField, PIC = window.NSPictures, LOOKS = window.NSLooks;
    if (!P || !F || !PIC || !LOOKS) { console.error('NewScreen travel: the art or the travel parts did not load'); return; }
    const { clamp01, smooth, lerp, hash } = P;

    const LOCK_MS = 1000, GROW = 1.19, OPEN = { dim: 1000, titleAt: 900, in: 500, hold: 2000, out: 600, done: 4200, end: 5000 };
    const SPEED = { rest: 52, flight: 150, held: 18, burn: 420 }, DRATE = { rest: 10, flight: 70 };
    const JUMP = { white: 2250, flash: 2650, step: 100 }, REFRESH_MS = 400, QUIET_MOVE = 4;
    const FLASH = [['#fff3dc', 1], ['#f7c483', 0.85], ['#e9a25e', 0.6], ['#9a5a26', 0.35]];   // the flash's warm steps (RP.SUN 6..3), over the tower too
    const BUSY_LINE = 'A.U.R.A.: "We are already on our way, Commander. One thing at a time."';
    const ease = s => (s < 0.5 ? 4 * s * s * s : 1 - Math.pow(-2 * s + 2, 3) / 2);
    const $ = id => document.getElementById(id);
    const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
    const NS = () => window.NewScreen;

    let G = null, sc = 1, cv = null, ctx = null, wordsEl = null, note = null, title = null, flashEl = null, noteRect = null, A = null;
    let W = F.blank(1), shownSector = 0, lastRefresh = -1e9, holdRefreshUntil = -1e9, rogueT0 = 0, openedSector = 0, noteWasUp = false;
    const story = new Map();                                                          // node id → { hidden, resolvedAt }
    const placeAnchors = new Set();

    // ═══ 1. the real game, read cheaply ═══
    const now = () => (NS() && NS().clock ? NS().clock.t : 0);
    const game = () => (NS() && NS().game) || null;
    const flow = () => (NS() && NS().flow) || null;
    const emit = (name, p) => { const ns = NS(); if (ns && ns.bus) ns.bus.emit(name, p); };
    function sectorNow() { const g = game(); try { return (g && g.sector()) || 1; } catch (err) { return 1; } }
    function energyNow() { const g = game(); try { const e = g ? g.energy() : 100; return typeof e === 'number' ? e : 100; } catch (err) { return 100; } }
    function broken(deck) { const g = game(); try { return !!(g && g.broken && g.broken(deck)); } catch (err) { return false; } }
    function blocked() { const ns = NS(); return !!(ns && typeof ns.blocked === 'function' && ns.blocked()); }
    /** Plans the sector (NSRoute through the shell) and lays the field out from the planned nodes. */
    function refresh(t, force) {
        if (!force && (t - lastRefresh < REFRESH_MS || t < holdRefreshUntil)) return;
        lastRefresh = t;
        const g = game(), ns = NS(), n = sectorNow();
        try { if (g && g.route) g.route(); } catch (err) { console.error('NewScreen travel: the route plan failed', err); }
        const st = ns && ns.app && ns.app.state, nodes = (st && st.sectorNodes || []).filter(nd => nd && nd.nsRoute && nd.nsRoute.sector === n);
        if (F.build(nodes, n)) { registerPlaces(); W = Object.assign({}, W, { modes: Object.assign(Object.fromEntries(F.ids().map(id => [id, { m: 'field' }])), keepModes(W.modes)) }); }
        W = F.sync(W, t);
        F.ids().forEach(id => {                                                     // the story world: a faint contact until a wreck is dated
            const e = F.entry(id); if (!e.story || !e.node) return;
            const s = story.get(id) || { hidden: !!e.node.storyHidden, resolvedAt: null };
            if (s.hidden && !e.node.storyHidden) s.resolvedAt = t;
            s.hidden = !!e.node.storyHidden; story.set(id, s);
        });
    }
    const keepModes = modes => Object.fromEntries(Object.entries(modes || {}).filter(([id]) => F.has(id)));

    // ═══ 2. the light, our ship, speed ═══
    const lostCount = () => F.ids().filter(id => { const m = (W.modes[id] || {}).m, e = F.entry(id); return !e.scenery && (m === 'passed' || m === 'gone'); }).length;
    function lightScale(t) {
        const f = W.flight, boost = f && f.light ? 1 + 0.5 * ease(F.flightE(f, t)) : W.held && W.held === F.light().node || W.jump ? 1.5 : 1;
        return Math.pow(GROW, lostCount()) * boost;
    }
    function drift(t) { return [Math.round(2 * Math.sin(t / 3100)), Math.round(2.6 * Math.sin(t / 2300 + 1)), 0.035 * Math.sin(t / 2700 + 2)]; }
    const baseAngle = () => { const L = F.lander(), l = F.light(); return Math.atan2(l.y - L.y, l.x - L.x); };
    function poseAt(t) { const R = F.lander(), [dx, dy, da] = drift(t); return { x: R.x + dx, y: R.y + dy, len: R.len, angle: baseAngle() + W.bank + da }; }
    /** The plume follows the real energy: 0.25 + 0.75 x energy / 100; x1.7 in flight; a flare on go; it coughs with the drive down. */
    function plumeLevel(t) {
        if (W.black) return 0.8;
        if (W.jump) return 1 + 2.4 * clamp01((t - W.jump.t0) / 1500);
        let lvl = 0.25 + 0.75 * clamp01(energyNow() / 100);
        if (W.flight) lvl *= 1.7; else if (W.lock) lvl *= 1.15; else if (W.held) lvl *= 0.5;
        if (broken('engineering')) lvl *= sputter(t);
        if (t >= W.flareT) lvl += 1.6 * Math.exp(-(t - W.flareT) / 350);
        return lvl;
    }
    function sputter(t) {                                                             // on the same 2.9 s cycle as the brown-outs aboard
        const k = t % 2900, n = Math.floor(t / 2900), dip = hash(n & 255, 7, 61) < 0.75;
        return dip && (k < 90 || (k > 170 && k < 240)) ? 0.08 : 0.45;
    }
    function towerBits(t) {
        const tw = NS() && NS().mods && NS().mods.tower;
        let on = [true, true, true, true, true, true], b = 0.5;
        try { if (tw && tw.occupied) on = tw.occupied() || on; if (tw && tw.beat) b = tw.beat(t); } catch (err) { /* the tower is optional here */ }
        return { on, b };
    }
    function speedNow(t) {
        if (W.jump) return SPEED.burn;
        const f = W.flight; if (f) { const e = F.flightE(f, t); return lerp(SPEED.held, SPEED.flight, smooth(0, 0.15, e) * (1 - smooth(0.8, 1, e))); }
        return W.held ? SPEED.held : SPEED.rest;
    }
    function vanishing(sn, t) {
        const l = F.light(), LP = [l.x, l.y], f = W.flight, id = f && !f.light ? f.id : W.held, it = id && sn.items.find(i => i.id === id && i.part !== 'arc');
        if (!it) { if (W.ease) { const k = 1 - ease(clamp01((t - W.ease.t0) / W.ease.dur)), vp = W.ease.vp || LP; return [lerp(LP[0], vp[0], k), lerp(LP[1], vp[1], k)]; } return LP; }
        const k = f ? smooth(0, 0.3, F.flightE(f, t)) : 1;
        return [lerp(LP[0], it.x, k), lerp(LP[1], it.y, k)];
    }

    // ═══ 3. drawing ═══
    function render(t) {
        if (!G || !ctx) return;
        ctx.imageSmoothingEnabled = false;
        const f = P.framer(ctx, G.W, G.H), pose = poseAt(t), tb = towerBits(t);
        if (!W.black && shownSector !== sectorNow()) { PIC.dimAll(1); return; }       // before a sector's first show (under the briefing): black
        if (W.black) {                                                                // the corridor: dark, not empty, our Lander still with us
            PIC.dark(); PIC.stream('front', [F.light().x, F.light().y], 30, W.flow);
            PIC.lander(f, t, pose, plumeLevel(t), tb.on, tb.b); return;
        }
        if (!A) A = PIC.art(W.sector);
        const sn = F.scene(W, t); W.last = sn;
        PIC.backdrop(A, W.D, t);
        const l = F.light(), gl = PIC.glow(W.sector, lightScale(t), t); ctx.drawImage(gl.canvas, gl.x, gl.y);
        const dl = F.discsOf(sn);
        P.twinkle(f, A.bright.filter(st => !dl.some(([x, y, r]) => Math.hypot(st.x - x, st.y - y) < r + 2)), t); f.reset();
        if (W.sector === 2) PIC.rogue(rogueT0, t);
        const vp = vanishing(sn, t), sp = speedNow(t), front = !!(W.flight || W.jump);  // at rest the streaks pass behind the worlds
        PIC.stream('back', vp, sp, W.flow);
        if (!front) PIC.stream('front', vp, sp, W.flow);
        sn.items.forEach(it => { const s = story.get(it.id); PIC.item(f, it, t, s ? { hidden: s.hidden, resolvedAt: s.resolvedAt } : null); f.reset(); });
        const lockId = W.lock ? (W.lock.id === F.light().node ? 'light' : W.lock.id) : null, hov = lockId || (W.flight ? null : W.hover);
        if (hov && hov !== 'light' && !(story.get(hov) || {}).hidden) sn.items.filter(i => i.id === hov && i.part !== 'arc' && !i.hiding && !i.passed).forEach(i => PIC.rims(f, i, lockId ? 2 : 1));
        if (hov === 'light') { const r = PIC.lightOf(W.sector, lightScale(t)), lx = Math.round(l.x), ly = Math.round(l.y); for (let d = Math.round(r.core + 2); d < r.core + 10 * sc; d++) { const v = 0.85 - (d - r.core) / (12 * sc); f.tone(lx - d, ly, P.RP.SUN, v); f.tone(lx, ly - d, P.RP.SUN, v); f.tone(lx, ly + d, P.RP.SUN, v); } }
        PIC.lander(f, t, pose, plumeLevel(t), tb.on, tb.b);
        if (front) PIC.stream('front', vp, sp, W.flow);
        PIC.shade(noteRect);
        if (W.jump) PIC.jump(A, t - W.jump.t0);
        if (W.opening) PIC.dimAll(1 - Math.floor(clamp01((t - W.opening.t0) / OPEN.dim) * 8) / 8);
    }

    // ═══ 4. words: the note when pointing (a name and one line), the sector title ═══
    const TYPE_WORDS = { ROCKY: 'A rocky world', GAS_GIANT: 'A gas giant', ICE_WORLD: 'An ice world', OCEANIC: 'An ocean world', DESERT: 'A desert world', VOLCANIC: 'A world of volcanoes',
        TOXIC: 'A world with poison air', VITAL: 'A world with life on it', BIO_MASS: 'A living world', MECHA: 'A world of old war machines', SHATTERED: 'A broken world',
        TERRAFORMED: 'A world someone made for us', CRYSTALLINE: 'A world of crystal', ROGUE: 'A world with no sun', TIDALLY_LOCKED: 'One side burns, one side freezes',
        HOLLOW: 'A hollow world', SYMBIOTE_WORLD: 'A living world', MIRROR: 'A world like a mirror', GRAVEYARD: 'A world made of dead ships', SINGING: 'A world sending one note',
        STORM_WORLD: 'A world of storms', FUNGAL: 'A world of fungus', TOMB_WORLD: 'A world of dead cities', EDEN: 'A green world', MACHINE_WORLD: 'A world of machines',
        FROZEN_OCEAN: 'A frozen ocean', SULFUR: 'A sulphur world', CARBON: 'A carbon world', RADIATION_BELT: 'A world in deadly radiation', GHOST_WORLD: 'A world the scanner cannot hold' };
    function placeWords(id) {
        if (id === 'light') return W.sector >= 6 ? { name: 'The light', tag: 'Where the heading ends' } : { name: 'The light ahead', tag: 'The jump' };
        const e = F.entry(id), nd = e && e.node; if (!nd) return null;
        const status = (nd.nsRoute || {}).status, md = W.modes[id] || {};
        if (nd.isStoryPlanet && nd.storyHidden) return { name: 'A faint contact', tag: 'No fix on it yet' };
        const tags = nd.tags || [];
        const tag = status === 'visited' || W.visited.has(id) ? 'We stopped here'
            : status === 'passed' || status === 'gone' || md.m === 'passed' ? 'We passed it'
            : nd.isFirstSignal ? 'An old ship beacon'
            : nd.isStoryPlanet ? 'Their last course'
            : tags.includes('EXODUS_WRECK') ? 'One of our ships'
            : nd.isStation ? 'An empty station'
            : nd.isAsteroidField ? 'Rocks and old metal'
            : TYPE_WORDS[nd.type] || 'A world';
        return { name: nd.name || '', tag };
    }
    function updateNote(t) {
        const target = W.flight && (W.flight.light ? 'light' : W.flight.id), id = W.hover && W.hover !== target && !W.lock && !W.quiet ? W.hover : null, g = id ? placeAt(id) : null;
        const up = !!(id && g && g.shown);
        if (up !== noteWasUp) { noteWasUp = up; emit('note', { up }); }
        if (!up) { note.hidden = true; noteRect = null; W.noteKey = ''; return; }
        const w = placeWords(id); if (!w) { note.hidden = true; noteRect = null; return; }
        const key = [id, w.name, w.tag].join('|');
        if (key !== W.noteKey) { note.replaceChildren(mk('p', 'name', w.name), mk('p', 'tag', w.tag)); W.noteKey = key; W.noteSide = null; }
        note.hidden = false;
        const l = F.light(), k = G.k / G.dpr, nw = note.offsetWidth / k, nh = note.offsetHeight / k, e = F.entry(id), giant = e && e.kind === 'giant';
        const gap = giant ? 10 : g.r + 8 * sc, ds = F.discsOf(W.last || F.scene(W, t));                    // its own disc too: never words over a world
        if (id !== 'light') ds.push([l.x, l.y, 26 * sc]);                                 // off the light's glare too
        const box = side => side === 'right' ? [g.x + gap, g.y - nh / 2] : side === 'left' ? [g.x - gap - nw, g.y - nh / 2] : side === 'above' ? [g.x - nw / 2, g.y - (giant ? g.r : 0) - gap - nh] : [g.x - nw / 2, g.y + gap];
        const ok = ([x, y]) => x >= G.hull + 6 && x + nw <= G.W - 6 && y >= 6 && y + nh <= G.H - 6 && !ds.some(([cx, cy, r]) => { const qx = Math.max(x, Math.min(cx, x + nw)), qy = Math.max(y, Math.min(cy, y + nh)); return Math.hypot(qx - cx, qy - cy) < r; });
        const ptr = W.pointer || [g.x, g.y], sides = ['right', 'left', 'above', 'below'].map(s => ({ s, b: box(s) })).filter(c => ok(c.b));
        sides.sort((a, b) => Math.hypot(b.b[0] + nw / 2 - ptr[0], b.b[1] + nh / 2 - ptr[1]) - Math.hypot(a.b[0] + nw / 2 - ptr[0], a.b[1] + nh / 2 - ptr[1]));   // away from the pointer
        let pick = sides.find(c => c.s === W.noteSide) || sides[0];
        if (!pick) { const b = box(g.x > G.hull + (G.W - G.hull) / 2 ? 'left' : 'right'); pick = { s: 'x', b: [Math.max(G.hull + 6, Math.min(G.W - nw - 6, b[0])), Math.max(6, Math.min(G.H - nh - 6, b[1]))] }; }
        W.noteSide = pick.s;
        note.classList.toggle('is-left', pick.s === 'left');
        const [cx, cy] = G.toCss(pick.b[0], pick.b[1]);
        note.style.transform = `translate(${Math.round(cx)}px, ${Math.round(cy)}px)`;
        noteRect = { x: Math.round(pick.b[0]), y: Math.round(pick.b[1]), w: Math.ceil(nw), h: Math.ceil(nh) };
    }
    /** The white-gold flash over the whole screen (the tower too), in warm steps, then the corridor's dark. */
    function updateFlash(t) {
        const s = W.jump ? t - W.jump.t0 : -1, i = s >= JUMP.white && s < JUMP.flash ? Math.min(FLASH.length - 1, Math.floor((s - JUMP.white) / JUMP.step)) : -1;
        if (i < 0) { if (!flashEl.hidden) flashEl.hidden = true; return; }
        flashEl.hidden = false; flashEl.style.background = FLASH[i][0]; flashEl.style.opacity = String(FLASH[i][1]);
    }
    function showTitle(text, t, t0) {
        const s = t - t0, a = s < 0 ? 0 : s < OPEN.in ? s / OPEN.in : s < OPEN.in + OPEN.hold ? 1 : 1 - (s - OPEN.in - OPEN.hold) / OPEN.out;
        if (a <= 0 || !text) { title.hidden = true; return; }
        if (title.textContent !== text) title.textContent = text;
        title.hidden = false; title.style.opacity = String(Math.floor(clamp01(a) * 8) / 8);
        // in empty sky: the first of a few places whose box keeps clear of every world and the light
        const l = F.light(), k = G.k / G.dpr, hw = title.offsetWidth / k / 2 + 8, hh = title.offsetHeight / k / 2 + 8, ds = F.discsOf(W.last || F.scene(W, t)).concat([[l.x, l.y, 30 * sc]]);
        const clear = ([x, y]) => !ds.some(([dx, dy, r]) => Math.hypot(Math.max(x - hw, Math.min(dx, x + hw)) - dx, Math.max(y - hh, Math.min(dy, y + hh)) - dy) < r);
        const spW = G.W - G.hull, spots = [[0.5, 0.2], [0.6, 0.1], [0.45, 0.1], [0.62, 0.2], [0.5, 0.06], [0.5, 0.9]].map(([u, v]) => [G.hull + spW * u, G.H * v]);
        const [cx, cy] = G.toCss(...(spots.find(clear) || spots[0]));
        title.style.transform = `translate(${Math.round(cx)}px, ${Math.round(cy)}px) translate(-50%, -50%)`;
    }
    function injectStyle() {
        if ($('ns-travel-style')) return;
        const st = mk('style'); st.id = 'ns-travel-style';
        st.textContent = `#ns-world-words .nst-note { position: absolute; left: 0; top: 0; display: grid; gap: 3px; max-width: 22em; pointer-events: none; }
#ns-world-words .nst-note[hidden], #ns-world-words .nst-title[hidden] { display: none; }
#ns-world-words .nst-note .name { margin: 0; font: 500 var(--fs-note-name, 19px)/1.15 var(--f-ui, 'IBM Plex Sans Condensed', sans-serif); letter-spacing: 0.02em; color: var(--text, #e4e4e0); text-shadow: var(--shadow, 0 1px 0 #05070a); }
#ns-world-words .nst-note .tag { margin: 0; font: 400 var(--fs-note-line, 16px)/1.35 var(--f-text, 'IBM Plex Sans', sans-serif); color: var(--dim, #8b8d90); text-shadow: var(--shadow, 0 1px 0 #05070a); }
#ns-world-words .nst-note.is-left { text-align: right; justify-items: end; }
#ns-world-words .nst-flash { position: absolute; inset: 0; pointer-events: none; }
#ns-world-words .nst-flash[hidden] { display: none; }
#ns-world-words .nst-title { position: absolute; left: 0; top: 0; margin: 0; font: 300 var(--fs-title, 44px)/1 var(--f-text, 'IBM Plex Sans', sans-serif); letter-spacing: 0.2em; color: var(--text, #e4e4e0); white-space: nowrap; text-shadow: var(--shadow, 0 1px 0 #05070a); pointer-events: none; }`;
        document.head.appendChild(st);
    }

    // ═══ 5. pointing, the lock, flying ═══
    function interactive(t) {
        const ns = NS();
        return !!G && !!(ns && (!ns.isShown || ns.isShown())) && !W.jump && !W.black && !W.held && !(W.opening && t - W.opening.t0 < OPEN.dim) && !blocked();
    }
    function hitTest(x, y, t) {
        const sn = W.last || F.scene(W, t), order = sn.items.filter(i => i.kind === 'giant').concat(sn.items.filter(i => i.kind !== 'giant'));
        for (let i = order.length - 1; i >= 0; i--) {                                // the small worlds first: one on the giant's limb stays pointable
            const it = order[i]; if (it.hitless || !it.clickable) continue;
            if (it.kind === 'giant') {
                const dx = x - it.x, dy = y - it.y, ct = Math.cos(P.GIANT.tilt), s = Math.sin(P.GIANT.tilt), u = dx * ct + dy * s, w = -dx * s + dy * ct, rho = Math.hypot(u, w / P.GIANT.open) / it.r;
                if (Math.hypot(dx, dy) < it.r + 4 || (rho > P.GIANT.r0 - 0.05 && rho < P.GIANT.r1 + 0.05)) return it.id;
                continue;
            }
            const r = (story.get(it.id) || {}).hidden ? 10 * sc : Math.max(it.r * (it.kind === 'station' ? 1.05 : 1) + 4, 10 * sc);
            if (Math.hypot(x - it.x, y - it.y) < r) return it.id;
        }
        if (W.ease && W.hover && W.hover !== 'light') {                              // the field slides under a still pointer: keep the pointed one
            const it = sn.items.find(i => i.id === W.hover && i.part !== 'arc' && i.clickable && !i.hitless);
            if (it && Math.hypot(x - it.x, y - it.y) < it.r + 34 * sc) return it.id;
        }
        const L = PIC.lightOf(W.sector, lightScale(t)), l = F.light();
        return Math.hypot(x - l.x, y - l.y) < L.core * 3 + 10 * sc ? 'light' : null;
    }
    function setHover(id) { if (id !== W.hover) W = Object.assign({}, W, { hover: id }); }
    const refused = r => !r || r === false || (typeof r === 'object' && r.ok === false);
    function ask(fn, ...args) { const fl = flow(); if (!fl || typeof fl[fn] !== 'function') return null; try { return fl[fn](...args); } catch (err) { console.error(`NewScreen travel: flow.${fn} failed`, err); return null; } }
    /** A click on a world or the light. flow.click does the game's part (a refusal spoken, the contact's line, a ghost
        removed, the jump asked for); fly: lock for one second, then go. */
    function click(id, t) {
        if (W.lock) return;                                                          // a second click on the world does nothing; empty space cancels (pointer)
        if (W.flight) { if (id !== 'light') turnTo(id, t); else busy(); return; }
        const e = id === 'light' ? null : F.entry(id);
        if (id !== 'light' && (!e || !e.node)) return;
        const ghost = !!(e && e.kind === 'ghost' && !(e.node.isStoryPlanet && e.node.storyHidden));
        if (ghost) { W = Object.assign({}, W, { modes: Object.assign({}, W.modes, { [id]: { m: 'fading', t0: t } }), hover: null }); holdRefreshUntil = t + 1300; }
        if (id === 'light') W = Object.assign({}, W, { flareT: t });
        const r = ask('click', id);
        if (ghost && (!r || !r.ok)) { W = Object.assign({}, W, { modes: Object.assign({}, W.modes, { [id]: { m: 'field' } }) }); holdRefreshUntil = -1e9; }
        if (r && r.ok && r.fly) lockOn(r.id || id, t);
    }
    /** A click that cannot change the course now (the light, a phantom, mid-flight): A.U.R.A. says so, once. */
    function busy() { const v = NS() && NS().mods && NS().mods.voice; if (v && typeof v.sayLine === 'function') { try { v.sayLine(BUSY_LINE); } catch (err) { console.error('NewScreen travel: the busy line failed', err); } } }
    /** In flight: the fork's other world turns us, a world further on flies straight there. Nothing is recorded until we arrive. */
    function turnTo(id, t) {
        if (id === W.flight.id) return;
        const r = ask('canGo', id);
        if (!r || !r.ok) { ask('refuse', id); return; }
        if (r.kind !== 'world') { busy(); return; }
        if (refused(ask('go', id))) return;
        W = F.planFlight(W, id, t, broken('engineering')); PIC.prebake(prebakeItems(W, t));
    }
    function lockOn(id, t) {
        W = Object.assign({}, W, { lock: { id, t0: t } });
        PIC.prebake(prebakeItems(F.planFlight(W, id, t + LOCK_MS, broken('engineering')), t + LOCK_MS));
    }
    function cancelLock() { if (W.lock) W = Object.assign({}, W, { lock: null }); }
    function fire(t) {
        const id = W.lock.id;
        if (refused(ask('go', id))) { W = Object.assign({}, W, { lock: null }); return; }   // flow.go speaks why not
        W = Object.assign(F.planFlight(W, id, t, broken('engineering')), { flareT: t });
        PIC.prebake(prebakeItems(W, t));
    }
    /** The game did not pull in (flow.arrive said no): back to the field as it was before the flight. */
    function undoArrival(t) {
        const B = W.before || F.blank(W.sector);
        W = F.sync(Object.assign({}, B, { cam: W.cam, held: null, before: null, flight: null, lock: null, flow: W.flow, D: W.D, bank: W.bank, ease: { t0: t, dur: 2000, from: W.cam, to: B.cam } }), t);
    }
    /** Every size a move will need, so the bake queue paints them before they are on screen. */
    function prebakeItems(St, t) {
        const d = St.flight ? St.flight.dur : St.ease ? St.ease.dur : 0, out = [];
        if (!d) return out;
        for (let k = 1; k <= 8; k++) F.scene(St, t + d * k / 8).items.forEach(it => out.push(it));
        return out;
    }
    function pointer(type, e, x, y) {
        const t = now();
        if (type === 'wheel') return false;
        if (type === 'leave' || !interactive(t)) { if (W.hover) setHover(null); return false; }
        const hit = hitTest(x, y, t);
        if (type === 'move') {
            const quiet = W.quiet && Math.hypot(x - W.quiet[0], y - W.quiet[1]) <= QUIET_MOVE ? W.quiet : null;
            W = Object.assign({}, W, { pointer: [x, y], quiet }); setHover(hit); return !!hit;
        }
        if (type === 'down') {
            if (W.lock) { if (!hit || hit !== W.lock.id) cancelLock(); return true; }
            if (hit) { W = Object.assign({}, W, { quiet: [x, y] }); click(hit, t); return true; }
        }
        return false;
    }
    function key(e) { if (e && e.key === 'Escape' && W.lock) { cancelLock(); return true; } return false; }

    // ═══ 6. the module's life ═══
    function onShown(p) {
        const t = now(), n = (p && p.sector) || sectorNow();
        shownSector = n;
        refresh(t, true);
        if (n !== W.sector || (p && p.first)) {
            F.reset(); PIC.clear(); refresh(t, true);
            W = F.sync(F.blank(n), t); A = null;
            story.clear(); refresh(t, true);
            rogueT0 = p && p.first ? t : t - 30000;
            if (p && p.first) W = Object.assign({}, W, { opening: { t0: t }, openDone: false });
        }
        PIC.preglow(n, Math.pow(GROW, F.ids().length) * 1.5);                          // every size the light can reach here, baked in idle frames
        if (!(p && p.first) && openedSector !== n) { openedSector = n; emit('opening:done', {}); }
        W = Object.assign({}, W, { black: false, jump: null, lock: null, hover: null });
        const from = p && p.from;
        if (from && F.has(from)) {
            if (W.held !== from) W = Object.assign({}, W, { cam: F.arriveCam(from), held: from, flight: null, ease: null, modes: Object.assign({}, W.modes, { [from]: { m: 'field' } }) });
            W = F.leave(W, from, t);
            PIC.prebake(prebakeItems(W, t));
        } else if (W.held) W = F.sync(Object.assign({}, W, { held: null, ease: { t0: t, dur: 2000, from: W.cam, to: F.stageCam(W.at, W.modes) } }), t);
    }
    function onHidden() { W = Object.assign({}, W, { lock: null, hover: null, pointer: null, quiet: null }); if (note) note.hidden = true; noteRect = null; if (title) title.hidden = true; if (flashEl) flashEl.hidden = true; PIC.setLive(false); }
    function update(dt, t) {
        if (!G) return;
        PIC.setLive(true);
        refresh(t, false);
        const s = speedNow(t);
        W.flow += s * dt / 1000; W.D = Math.min(9800, W.D + (W.flight ? DRATE.flight : DRATE.rest) * dt / 1000);
        if (W.lock && t - W.lock.t0 >= LOCK_MS && !blocked()) fire(t);                // a card up: the course waits for it
        if (W.flight && t - W.flight.t0 >= W.flight.dur && !blocked()) {              // the flight lands (once no card is up): the real game pulls in
            const id = W.flight.id; W = F.land(W);
            if (ask('arrive', id) === false) undoArrival(t);
        }
        if (W.ease && t - W.ease.t0 >= W.ease.dur) W = Object.assign({}, W, { cam: W.ease.to, ease: null });
        const tgt = W.flight ? (W.flight.light ? 'light' : W.flight.id) : W.lock ? (W.lock.id === F.light().node ? 'light' : W.lock.id) : W.hover, sn = W.last;
        const it = tgt && tgt !== 'light' && sn && sn.items.find(i => i.id === tgt && i.part !== 'arc');
        let wantB = 0;
        if (it || tgt === 'light') { const L = F.lander(), l = F.light(), p = it || { x: l.x, y: l.y }, da = Math.atan2(p.y - L.y, p.x - L.x) - baseAngle(), lim = (W.flight ? 10 : 6) * Math.PI / 180; wantB = Math.max(-lim, Math.min(lim, Math.atan2(Math.sin(da), Math.cos(da)))); }
        if (W.held) wantB = W.bank;
        W.bank += (wantB - W.bank) * Math.min(1, dt / 300);
        if (W.opening) {
            showTitle(LOOKS.titleOf(W.sector), t, W.opening.t0 + OPEN.titleAt);
            if (!W.openDone && t - W.opening.t0 >= OPEN.done) { W.openDone = true; openedSector = W.sector; emit('opening:done', {}); }
            if (t - W.opening.t0 > OPEN.end) W.opening = null;
        } else title.hidden = true;
        if (W.jump && !W.jump.flashed && t - W.jump.t0 >= JUMP.flash) { W.jump.flashed = true; W.black = true; emit('jump:flash', {}); }
        if (W.hover && !interactive(t)) setHover(null);
        else if ((W.ease || W.flight) && W.pointer && interactive(t)) setHover(hitTest(W.pointer[0], W.pointer[1], t));
        updateNote(t);
        updateFlash(t);
        if (dt > 0) PIC.bakeOne();
    }
    function resize(g) {
        G = g; sc = G.H / 360;
        ensureDom();
        cv.width = G.W; cv.height = G.H; cv.style.width = (G.W * G.k / G.dpr) + 'px'; cv.style.height = (G.H * G.k / G.dpr) + 'px';
        F.setup(G); PIC.setup(G, ctx); A = null;
        if (W.held && W.held !== F.light().node && F.has(W.held)) W = Object.assign({}, W, { cam: F.arriveCam(W.held) });
        else if (!W.flight) W = Object.assign({}, W, { cam: F.stageCam(W.at, W.modes), ease: null });
    }
    function ensureDom() {
        const root = $('ns-root');
        cv = $('ns-world');
        if (!cv) { cv = mk('canvas'); cv.id = 'ns-world'; cv.setAttribute('aria-hidden', 'true'); if (root) root.insertBefore(cv, root.firstChild); else document.body.appendChild(cv); }
        if (!ctx) ctx = cv.getContext('2d', { alpha: false });
        cv.style.imageRendering = 'pixelated';
        wordsEl = $('ns-world-words');
        if (!wordsEl) { wordsEl = mk('div', 'ns-layer'); wordsEl.id = 'ns-world-words'; const words = $('ns-words') || root || document.body; words.appendChild(wordsEl); }
        if (!note || !wordsEl.contains(note)) { note = mk('div', 'nst-note'); note.hidden = true; title = mk('p', 'nst-title'); title.hidden = true; flashEl = mk('div', 'nst-flash'); flashEl.hidden = true; wordsEl.append(flashEl, note, title); }
    }
    const css = (x, y, side, align) => { const [cx, cy] = G.toCss(x, y); return { x: cx, y: cy, side, align }; };
    function registerPlaces() {
        const ns = NS(); if (!ns || !ns.anchors) return;
        placeAnchors.forEach(name => ns.anchors.delete(name)); placeAnchors.clear();
        F.ids().forEach(id => {
            if (!F.entry(id).node) return;
            const name = 'place:' + id; placeAnchors.add(name);
            ns.anchors.set(name, () => {
                if (!G) return []; const g = placeAt(id); if (!g.shown) return [];
                const giant = F.entry(id) && F.entry(id).kind === 'giant', gap = (giant ? 0 : g.r) + 8 * sc;
                const list = [css(g.x + gap, g.y, 'right'), css(g.x - gap, g.y, 'left'), css(g.x, g.y - (giant ? g.r : 0) - gap, 'above', 'center'), css(g.x, g.y + gap, 'below', 'center')];
                return g.x > G.hull + (G.W - G.hull) * 0.6 ? [list[1], list[0], list[2], list[3]] : list;
            });
        });
    }
    function init() {
        injectStyle(); ensureDom();
        const ns = NS(); if (!ns) return;
        const on = (name, fn) => { if (ns.bus) ns.bus.on(name, p => { try { fn(p || {}); } catch (err) { console.error(`NewScreen travel: "${name}" failed`, err); } }); };
        on('shown', onShown);
        on('hidden', onHidden);
        on('hud', () => { lastRefresh = -1e9; });
        on('refresh', () => { lastRefresh = -1e9; });
        on('jump:burn', () => { W = Object.assign({}, W, { jump: { t0: now(), flashed: false }, hover: null, lock: null }); });
        if (ns.anchors) {
            ns.anchors.set('ship', () => { if (!G) return []; const p = poseAt(now()); return [css(p.x - p.len / 2 - 6, p.y + p.len / 6 + 12, 'below'), css(p.x - p.len / 2 - 6, p.y - p.len / 6 - 12, 'above')]; });
            ns.anchors.set('light', () => { if (!G || W.black) return []; const L = PIC.lightOf(W.sector, lightScale(now())), l = F.light(), gap = L.halo * 0.9 + 14; return [css(l.x - gap, l.y + gap * 0.6, 'left'), css(l.x, l.y + gap * 1.2, 'below', 'center')]; });
        }
    }

    // ═══ 7. what the others ask for ═══
    function placeAt(id) {
        if (!G) return { x: 0, y: 0, r: 0, shown: false };
        if (id === 'light') { const L = PIC.lightOf(W.sector, lightScale(now())), l = F.light(); return { x: l.x, y: l.y, r: L.core + L.halo, shown: !W.black }; }
        if (W.black) return { x: 0, y: 0, r: 0, shown: false };
        const sn = W.last || F.scene(W, now()), it = sn.items.find(i => i.id === id && i.part !== 'arc');
        return it ? { x: it.x, y: it.y, r: it.r, shown: !(it.hiding > 0.3) && !(it.fade >= 1) } : { x: 0, y: 0, r: 0, shown: false };
    }
    function placeCss(id) { const g = placeAt(id); if (!G) return g; const [x, y] = G.toCss(g.x, g.y); return { x, y, r: g.r * G.k / G.dpr, shown: g.shown }; }
    function landerPose() { if (!G) return { x: 0, y: 0, len: 0, angle: 0 }; const p = poseAt(now()); return { x: p.x, y: p.y, len: p.len, angle: p.angle }; }
    function discs() { if (!G || W.black) return []; return F.discsOf(W.last || F.scene(W, now())); }
    function debugState() {
        const mode = W.black ? 'corridor' : W.jump ? 'jump' : W.flight ? 'flight' : W.lock ? 'lock' : W.held ? 'held' : W.opening ? 'opening' : 'rest';
        return { sector: W.sector, mode, at: W.at, hover: W.hover, lock: W.lock ? W.lock.id : null, flight: W.flight ? W.flight.id : null, held: W.held,
            modes: Object.fromEntries(Object.entries(W.modes).map(([id, m]) => [id, m.m])), slots: Object.fromEntries(F.ids().map(id => [id, F.entry(id).slot + '/' + F.entry(id).band])), light: F.light().node };
    }

    const MOD = { init, resize, update, render, pointer, key, placeAt, placeCss, landerPose, discs, noteUp: () => noteWasUp, debugState };
    let registered = false;
    function register() { const ns = NS(); if (registered || !ns || typeof ns.register !== 'function') return; registered = true; ns.register('travel', MOD); }
    window.NSTravel = MOD;
    register();
    if (!registered) document.addEventListener('DOMContentLoaded', register, { once: true });
})();
