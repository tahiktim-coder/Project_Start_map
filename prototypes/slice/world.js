/* Silent Exodus · sector 1 slice · the journey: sector 1 as a place, a field of worlds ahead (docs/SLICE_SPEC.md §2, §3, §7.1).
   OWNER: the world builder. Draws ONLY into canvas#world and the DOM layer #world-words (the hover note, the sector title).
   Never touches the tower, the bridge, the shade layer or the reading layer.
   Reuses by loading (never copied, never edited): game-screen-v3/paint.js (V3Paint: sphere, surfaceFor, lightVector,
   drawStation, paintGiant, paintRogue, contactBlip, lightGlow, spaceStrip, hull + shapeL for the Lander), sky.js + sky2.js
   (V3Sky2.build(..., 'f') with the slice's own far colours, V3Sky.paintSpace), data.js (V3Data names, tags, light, jump).
   Small helpers re-written here (each under 20 lines, as the spec allows): the Lander sprite and plume, the stream of specks
   and the jump stretch (game-screen-v3.html), the dither shade under the note.

   THE CAMERA (SPEC §3.3): one pinhole. A place at depth Z, at rest on screen at p, shows at
       light + (p - light) * m - c / (Z - C),  m = Z / (Z - C),  size times m
   C is how far we have flown in; c is the camera's sideways offset (the spec's X times C, so C = 0 with c != 0 is fine).
   The light never moves (m = 1). A flight eases the TARGET's on-screen place and size to the arrival framing and solves C and
   c from it, so every other place follows by its own depth. Sizes step in eight baked sizes per move (v3's push); places
   move smoothly. Tuned on top, as the spec allows: the fork pair's world slips behind the ring or the giant on its own path;
   a world we pass glides to the left edge and stays there in shadow (the giant low in the corner, its ring across it).

   window.Slice.mods.world = {
     init() · resize(G) · update(dt, t) · render(t) · pointer(type, e, ax, ay) → bool · goto(moment)
     landerPose()  → { x, y, len, angle } art px: our ship now (stop.js starts the dive here)
     placeAt(id)   → { x, y, r, shown } art px of a place now ('light' too)
     discs()       → [[x, y, r], ...] art px of every round thing on screen
     FIELD         where things are at rest, their depth and look (SPEC §3.1)
   }
   Emits:   'world:hover' { id | 'light' | null }   'world:click' { id | 'light' | null (empty space, only while the course is
            locked: the cancel click) }   'flight:arrived' { id }   'flight:switched' { id }   'jump:flash' {}   'opening:done' {}
   Listens: 'price:preview' 'price:changed' 'route:go' 'route:cancel' 'route:fired' 'dive:plated' 'stop:hidden' 'jump:start'
            'sector:arrive' 'hold' (also reads Slice.state: res.energy, hold, price, places.rhea.named, flags.light, mode)
   Registers anchors (Slice.anchors, CSS px): 'ship', 'sky', 'light', 'place:<id>'. Writes Slice.state.cam only. */
(function () {
    'use strict';
    const Slice = window.Slice, P = window.V3Paint, DATA = window.V3Data;
    const { INK, TICK, RP, clamp01, smooth, lerp, hash, threshold, level } = P;
    const $ = id => document.getElementById(id);
    const cv = $('world'), ctx = cv.getContext('2d', { alpha: false }), wordsEl = $('world-words');

    // ═══ 1. the field (SPEC §3.1): rest place (u, v on the space side), depth, size (fraction of H), look ═══
    // Depths are deeper than the spec's 6 / 8 / 12 for Kryos / Erebus / Rhea: with those, flying in to Titan made the giant
    // swell over the light. The order is kept (Zeta, Titan in front; then Kryos, Erebus behind it, Rhea farthest).
    const FIELD = {
        light: { u: 0.93, v: 0.40, kind: 'light' },
        lander: { u: 0.12, v: 0.58, len: 0.085, kind: 'lander' },
        zeta: { u: 0.36, v: 0.20, Z: 4, kind: 'station', s: 0.0026, seed: 3, slot: 'top' },
        titan: { u: 0.28, v: 0.84, Z: 4, kind: 'world', type: 'desert', r: 0.07, seed: 73, beacon: [-0.6, 0.1, 1500], slot: 'bottom' },
        kryos: { u: 0.66, v: 0.74, Z: 22, kind: 'giant', r: 0.25, slot: 'giant', rides: true },
        erebus: { u: 0.78, v: 0.50, Z: 27, kind: 'world', type: 'dark', r: 0.035, seed: 9, beacon: [-0.3, -0.55, 2200], onLimb: true, slot: 'top', rides: true },
        rhea: { u: 0.72, v: 0.26, Z: 40, kind: 'world', type: 'rock', r: 0.022, seed: 52, beacon: [-0.6, 0.1, 1800], slot: 'top' },
    };
    const IDS = ['rhea', 'erebus', 'kryos', 'zeta', 'titan'];
    const ORDER = { zeta: 1, titan: 1, kryos: 2, erebus: 2, rhea: 3, light: 4 };
    const LAYER = { rhea: 0, erebus: 1, kryos: 3, zeta: 5, titan: 5 };
    /** How the fork's other world goes out of sight (SPEC §3.3). arc: slips behind the ring's near arc where it crosses the
        giant's limb; body: the limb grows over it; pass: it slides past on the left and greys. Z: its depth on that path. */
    const HIDE = { titan: { who: 'zeta', by: 'arc', Z: 27, lift: -0.03 }, zeta: { who: 'titan', by: 'arc', Z: 27, lift: 0.12 }, kryos: { who: 'erebus', by: 'body', Z: 27 }, erebus: { who: 'kryos', by: 'pass' } };
    const ARC_AT = { phi: Math.PI - 0.5, rho: 1.58, shrink: 0.32 };          // on the near arc, between the left end and the limb
    const ARRIVE = { kryos: { u: 0.5, v: 0.6, r: 0.37 }, titan: { u: 0.44, v: 0.58, r: 0.27 } };   // the rest: the target at (0.55, 0.50), radius 0.30 H
    const STAGES = [null, { ref: 'kryos', m: 1.12, u: 0.62, v: 0.66 }, { ref: 'rhea', m: 1.8, u: 0.6, v: 0.34 }, { ref: 'rhea', m: 1.8, u: 0.6, v: 0.34 }];
    const NAMES = { erebus: { name: 'Erebus-40 Minor', tag: 'Distress call', doneTag: 'We answered it' } };
    const FLY = { fork: 7000, far: 9000 }, PASS = { move: 4000 }, REFRAME = 4000, GROW = 1.19;
    const SPEED = { rest: 52, hold: 26, flight: 150, held: 18, burn: 420 }, DRATE = { rest: 10, flight: 70 };
    const ease = s => (s < 0.5 ? 4 * s * s * s : 1 - Math.pow(-2 * s + 2, 3) / 2), easeOut = s => 1 - (1 - s) ** 3;
    const stepE = e => Math.min(1, Math.floor(e * 8) / 7);
    const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

    let G = null, sc = 1, LP = [0, 0], REST = {}, A1 = null, A2 = null, W = blank();
    function blank() {
        return { sector: 1, stage: 0, cam: { C: 0, c: [0, 0] }, modes: Object.fromEntries(IDS.map(id => [id, { m: 'field' }])), flight: null, ease: null,
            held: null, lock: null, hover: null, preview: null, visited: new Set(), named: false, namedT: -1e9, lightOpen: false, opening: null, openDone: true,
            jump: null, black: false, s2: null, hidden: false, D: 0, flow: 0, flareT: -1e9, bank: 0, pendingHover: undefined, last: null, noteKey: '', noteSide: null };
    }

    // ═══ 2. geometry ═══
    const spW = () => G.W - G.hull, ax = u => G.hull + u * spW(), ay = v => v * G.H;
    function computeRest() {
        REST = {}; LP = [ax(FIELD.light.u), ay(FIELD.light.v)];
        IDS.forEach(id => { const F = FIELD[id]; REST[id] = { x: ax(F.u), y: ay(F.v), r: F.kind === 'station' ? 24 * F.s * G.H : F.r * G.H }; });
        const k = REST.kryos, e = REST.erebus, d = Math.hypot(e.x - k.x, e.y - k.y);     // Erebus: its centre on the upper limb, top half showing
        const out = k.r + 0.6 * e.r;                                                       // integrator: a little above the limb, so after Titan (camera pushed in, the giant swells more than far Erebus) about half still shows
        e.x = k.x + (e.x - k.x) / d * out; e.y = k.y + (e.y - k.y) / d * out;
        REST.lander = { x: ax(FIELD.lander.u), y: ay(FIELD.lander.v), len: Math.round(FIELD.lander.len * G.H) };
    }
    const K0 = [0, 0];
    function proj(id, cam, Z) {
        Z = Z || FIELD[id].Z; const d = Z - cam.C; if (d < 0.25) return null;
        const m = Z / d, p = REST[id], k = FIELD[id].rides && cam.k ? cam.k : K0;
        return { x: LP[0] + (p.x - LP[0]) * m - cam.c[0] / d + k[0], y: LP[1] + (p.y - LP[1]) * m - cam.c[1] / d + k[1], m, r: p.r * m };
    }
    function camFor(id, x, y, r, k) {
        k = k || K0; if (FIELD[id].rides) { x -= k[0]; y -= k[1]; }
        const Z = FIELD[id].Z, p = REST[id], m = Math.max(1, r / p.r), C = Z * (1 - 1 / m), d = Z - C;
        return { C, c: [((p.x - LP[0]) * m + LP[0] - x) * d, ((p.y - LP[1]) * m + LP[1] - y) * d], k };
    }
    const mixCam = (a, b, e) => { const ka = a.k || K0, kb = b.k || K0; return { C: lerp(a.C, b.C, e), c: [lerp(a.c[0], b.c[0], e), lerp(a.c[1], b.c[1], e)], k: [lerp(ka[0], kb[0], e), lerp(ka[1], kb[1], e)] }; };
    function stageCam(s) { const S = STAGES[s]; return S ? camFor(S.ref, ax(S.u), ay(S.v), REST[S.ref].r * S.m) : { C: 0, c: [0, 0], k: K0 }; }
    function arriveFrame(id) { const A = ARRIVE[id] || { u: 0.55, v: 0.5, r: 0.3 }; return { x: ax(A.u), y: ay(A.v), r: A.r * G.H }; }
    const flightE = (f, t) => clamp01((t - f.t0) / f.dur);
    function flightCam(f, e) {
        if (f.id === 'light') return f.cam0;
        const es = ease(e), ep = ease(Math.min(1, e * 1.15)), r = f.g0.r * Math.pow(f.to.r / f.g0.r, es), k0 = f.cam0.k || K0;
        return camFor(f.id, lerp(f.g0.x, f.to.x, ep), lerp(f.g0.y, f.to.y, ep), r, [lerp(k0[0], f.lift[0], es), lerp(k0[1], f.lift[1], es)]);
    }
    function camAt(St, t, stepped) {
        if (St.flight) { const e = flightE(St.flight, t); return flightCam(St.flight, stepped ? stepE(e) : e); }
        if (St.ease) { const e = clamp01((t - St.ease.t0) / St.ease.dur); return mixCam(St.ease.from, St.ease.to, ease(stepped ? stepE(e) : e)); }
        return St.cam;
    }
    function arcPt(gs, phi, rho) {
        const ct = Math.cos(P.GIANT.tilt), sn = Math.sin(P.GIANT.tilt), u = rho * gs.r * Math.cos(phi), w = rho * gs.r * P.GIANT.open * Math.sin(phi);
        return [gs.x + u * ct - w * sn, gs.y + u * sn + w * ct];
    }
    /** True where something behind the giant is hidden: behind its body, or behind the near half of its ring. */
    function behindGiant(gs, x, y) {
        const dx = x - gs.x, dy = y - gs.y; if (dx * dx + dy * dy < gs.r * gs.r) return true;
        const ct = Math.cos(P.GIANT.tilt), sn = Math.sin(P.GIANT.tilt), u = dx * ct + dy * sn, w = -dx * sn + dy * ct, rho = Math.hypot(u, w / P.GIANT.open) / gs.r;
        return w > 0 && rho > P.GIANT.r0 && rho < P.GIANT.r1;
    }

    // ── a world we pass: it glides to the left edge and stays there in shadow, so the sector stays a place we are leaving
    //    (look playtest, 2026-10-10: after Erebus the field emptied to the light and one dot; a passed world in flat grey read
    //    as a disabled button). The giant settles low on the edge with its ring across the corner; the small ones line up. ──
    function passedMode(id, t, g0, modes) {
        const F = FIELD[id], giant = F.kind === 'giant', side = F.slot, H = G.H;
        const busy = IDS.filter(o => o !== id && modes[o] && modes[o].m === 'passed' && FIELD[o].slot === side).length;
        const rp = giant ? REST.kryos.r * 0.95 : Math.max(0.026 * H, Math.min(REST[id].r * 0.62, g0.r));
        const xr = giant ? G.hull + 0.16 * spW() : G.hull + rp + 0.035 * spW() + busy * (rp * 2.6 + 10);
        const yr = giant ? H + rp * 0.1 : side === 'top' ? Math.max(rp + 0.05 * H, 0.14 * H) : Math.min(H - rp - 0.08 * H, 0.76 * H);   // above the giant's corner, below our ship
        return { m: 'passed', t0: t, g0: { x: g0.x, y: g0.y, r: g0.r }, rp, xr, yr };
    }
    function passedGeom(md, t) {
        const s = t - md.t0, k = clamp01(s / PASS.move), e = ease(k), eq = ease(stepE(k));
        return { x: lerp(md.g0.x, md.xr, e), y: lerp(md.g0.y, md.yr, e), r: Math.max(2, Math.round(md.g0.r * Math.pow(md.rp / md.g0.r, eq))), grey: Math.min(1, Math.floor(clamp01(s / 1600) * 8) / 8) };
    }

    /** Everything in the field at time t for a world state St: the one source for drawing, pointing, discs and pre-baking. */
    function scene(St, t) {
        const cam = camAt(St, t), camQ = camAt(St, t, true), items = [], f = St.flight, e = f ? flightE(f, t) : 1;
        let gs = null;
        const km = St.modes.kryos;
        if (km.m === 'passed') { const g = passedGeom(km, t); if (g) items.push(Object.assign({ id: 'kryos', kind: 'giant', part: 'all', layer: 5.9, passed: true, clickable: true }, g)); }   // the small passed ones stay in front of it
        else if (km.m !== 'gone') {
            const p = proj('kryos', cam), q = proj('kryos', camQ);
            if (p && q) {
                gs = { x: p.x, y: p.y, r: q.r };
                const base = { id: 'kryos', kind: 'giant', x: p.x, y: p.y, r: Math.round(q.r), m: q.m, grey: 0, clickable: true };
                items.push(Object.assign({ part: 'body', layer: 3 }, base), Object.assign({ part: 'arc', layer: 4, hitless: true }, base));
            }
        }
        IDS.forEach(id => {
            if (id === 'kryos') return;
            const md = St.modes[id], F = FIELD[id];
            if (!md || md.m === 'gone') return;
            if (md.m === 'passed') { const g = passedGeom(md, t); if (g) items.push(Object.assign({ id, kind: F.kind, layer: 6 + md.t0 * 1e-9, passed: true, clickable: true }, g)); return; }
            const hiding = md.m === 'hiding' && f && gs, Z = hiding ? md.Z : null, p = proj(id, cam, Z), q = proj(id, camQ, Z);
            if (!p || !q) return;
            const it = { id, kind: F.kind, x: p.x, y: p.y, r: Math.max(2, Math.round(q.r)), m: q.m, grey: 0, layer: LAYER[id], clickable: true };
            if (hiding) {
                const w = smooth(0.04, 0.5, e), wq = smooth(0.04, 0.5, stepE(e)), off = md.off || [0, 0];
                const pt = md.by === 'arc' ? arcPt(gs, ARC_AT.phi, ARC_AT.rho) : (() => { const dx = p.x - gs.x, dy = p.y - gs.y, d = Math.hypot(dx, dy) || 1; return [gs.x + dx / d * gs.r * 0.62, gs.y + dy / d * gs.r * 0.62]; })();
                Object.assign(it, { x: lerp(p.x + off[0], pt[0], w), y: lerp(p.y + off[1], pt[1], w), r: Math.max(2, Math.round(q.r * (md.rk || 1) * lerp(1, md.by === 'arc' ? ARC_AT.shrink : 0.8, wq))),
                    layer: md.by === 'arc' ? 2 : 1, cut: md.by === 'arc' ? gs : null, fade: Math.floor(smooth(0.6, 0.72, e) * 8) / 8, clickable: w < 0.3, hiding: w });
                if (it.fade >= 1) return;
            } else if (md.m === 'hiding') return;
            items.push(it);
        });
        items.sort((a, b) => a.layer - b.layer);
        return { cam, items, gs, e };
    }

    // ═══ 3. moving between places: lock, fly, switch, arrive, leave ═══
    function planFlight(St, id, t) {
        const now = scene(St, t), cam = now.cam, modes = Object.assign({}, St.modes), hide = HIDE[id];
        const drawnAt = o => { const it = now.items.find(i => i.id === o && i.part !== 'arc'), p = proj(o, cam); return it ? { x: it.x, y: it.y, r: it.passed ? it.r : (p ? p.r : it.r) } : p; };
        IDS.forEach(o => {
            const md = modes[o]; if (o === id || !md || (md.m !== 'field' && md.m !== 'hiding')) return;
            const g = drawnAt(o); if (!g) { modes[o] = { m: 'gone' }; return; }
            if (hide && hide.who === o && hide.by !== 'pass') {
                const p = proj(o, cam, hide.Z) || g;
                modes[o] = { m: 'hiding', by: hide.by, Z: hide.Z, off: [g.x - p.x, g.y - p.y], rk: g.r / (p.r || g.r) };
            } else if (ORDER[o] <= ORDER[id]) modes[o] = passedMode(o, t, g, modes);
        });
        if (id !== 'light') modes[id] = { m: 'field' };
        // engineering down: the flight takes a quarter longer (fun playtest: a broken drive was not felt on the journey)
        const g0 = id === 'light' ? null : drawnAt(id), dur = (ORDER[id] >= 3 ? FLY.far : FLY.fork) * (id !== 'light' && Slice.broken && Slice.broken('engineering') ? 1.25 : 1);
        return Object.assign({}, St, { modes, cam, ease: null, held: null, flight: { id, t0: t, dur, g0, to: id === 'light' ? null : arriveFrame(id), cam0: cam, lift: [0, ((hide && hide.lift) || 0) * G.H] } });
    }
    function startFlight(id, t) { W = Object.assign(planFlight(W, id, t), { lock: null }); prebake(W, t); }
    function arrive(t) {
        const f = W.flight, modes = Object.assign({}, W.modes);
        IDS.forEach(o => { if (modes[o].m === 'hiding') modes[o] = { m: 'gone' }; });
        W = Object.assign({}, W, { cam: flightCam(f, 1), flight: null, held: f.id, modes });
        Slice.emit('flight:arrived', { id: f.id });
    }
    function leave(id, t) {
        if (!has(REST, id)) return;
        const now = scene(W, t), it = now.items.find(i => i.id === id && i.part !== 'arc'), p = proj(id, now.cam);
        const modes = Object.assign({}, W.modes);
        if (it || p) modes[id] = passedMode(id, t, it ? { x: it.x, y: it.y, r: p ? p.r : it.r } : p, modes); else modes[id] = { m: 'gone' };
        const stage = Math.max(W.stage, ORDER[id]), visited = new Set(W.visited).add(id);
        W = Object.assign({}, W, { modes, stage, visited, held: null, ease: { t0: t, dur: REFRAME, from: now.cam, to: stageCam(stage), vp: it ? [it.x, it.y] : LP } });
        prebake(W, t, REFRAME);
    }

    // ═══ 4. pictures: sprites painted once per size, big ones baked in idle frames (a still bakes on the spot) ═══
    const sprites = new Map(), fams = new Map(), queue = new Map();
    function want(fam, size, make, cheap) {
        const key = fam + ':' + size; let s = sprites.get(key);
        if (s) return s;
        const list = fams.get(fam);
        if (cheap || !Slice.clock.playing || !list || !list.size) { s = make(); sprites.set(key, s); (fams.get(fam) || fams.set(fam, new Map()).get(fam)).set(size, s); queue.delete(key); return s; }
        if (!queue.has(key)) queue.set(key, () => want(fam, size, make, true));
        let best = null, bd = 1e9; list.forEach((v, k) => { const d = Math.abs(k - size); if (d < bd) { bd = d; best = v; } });
        return best;
    }
    function bakeOne() { const it = queue.entries().next(); if (it.done) return; queue.delete(it.value[0]); try { it.value[1](); } catch (err) { console.error('Slice world: a bake failed', err); } }
    function clearSprites() { sprites.clear(); fams.clear(); queue.clear(); landerCache.clear(); glowCache.clear(); }
    /** Asks for every size a move will need, so the bake queue paints them before they are on screen. */
    function prebake(St, t, dur) {
        const d = dur || (St.flight ? St.flight.dur : 0); if (!d) return;
        const wasPlaying = Slice.clock.playing;
        for (let k = 1; k <= 8; k++) scene(St, t + d * k / 8).items.forEach(it => spriteFor(it, wasPlaying));
    }
    const litOf = id => { const p = REST[id]; return P.lightVector(p.x, p.y, LP[0], LP[1], (id === 'kryos' ? 0.258 : 0.5) * Math.hypot(LP[0] - p.x, LP[1] - p.y)); };
    /** Each world keeps its own vibe, and one or two carry a colour of their own (look playtest): Erebus a cold teal rim and
        haze, Titan a thicker dust haze. "grey" is the passed look: the same world in shadow, lit only on its far rim. */
    const RIM = { erebus: { rim: P.ramp(INK, '#0a1a1a', '#14363a', '#22585c', '#3f8a88', '#7cc2b8'), atmo: P.ramp(INK, '#081616', '#0f2a2c', '#1a4446', '#2c6966'), w: 1.7 },
        titan: { atmo: RP.DUST, w: 1.9 } };
    const shadowL = L => P.norm3(L[0], L[1], -0.62);                                       // the light behind the world: a crescent on the far side
    function worldSprite(id, r, grey) {
        const F = FIELD[id], L0 = litOf(id), L = grey ? shadowL(L0) : L0, own = RIM[id] || {}, w = Math.max(2, Math.round(r / 22 * (own.w || 1))), half = r + w + 3, p = P.painter(half * 2, half * 2, false), rims = [];
        P.sphere(p, { cx: half, cy: half, r, ramp: P.PLANET_RAMP[F.type], L, dim: grey ? 0.62 : 1, surface: P.surfaceFor(F.type, F.seed, L), rim: grey ? 0.2 : 0.12, rimRamp: own.rim, ambient: grey ? 0.006 : 0.012, gain: 0.84, rims,
            atmo: { ramp: own.atmo || (F.type === 'desert' ? RP.DUST : RP.ICE), w } });
        if (id === 'titan' && !grey && r >= 60) { const k = r / 118, X = half - 0.6 * r, Y = half + 0.1 * r; p.line(X + 3 * k, Y + k, X + 16 * k, Y - 2 * k, (x, y) => p.solid(x, y, RP.STONE, 0.02)); }   // the furrow the wreck cut
        return { canvas: p.canvas(), half, rims: rims.map(([x, y, rr, lv]) => [x - half, y - half, rr, lv]) };
    }
    /** In shadow: darker and cooler, the hue kept (never the flat grey of a disabled button). */
    function shade(canvas, k) {
        const g = canvas.getContext('2d'), img = g.getImageData(0, 0, canvas.width, canvas.height), d = img.data;
        for (let i = 0; i < d.length; i += 4) if (d[i + 3]) { d[i] = d[i] * k[0]; d[i + 1] = d[i + 1] * k[1]; d[i + 2] = d[i + 2] * k[2]; }
        g.putImageData(img, 0, 0); return canvas;
    }
    const SHADOW = [0.42, 0.48, 0.6];
    function stationSprite(r, grey) {
        const s = r / 24, half = Math.ceil(27 * s + 3), p = P.painter(half * 2, half * 2, false);
        const win = P.drawStation(p, half, half, s, FIELD.zeta.seed, grey ? 0.8 : 1, null);
        const canvas = p.canvas(); if (grey) shade(canvas, SHADOW);
        return { canvas, half, win: [win[0] - half, win[1] - half], rims: [] };
    }
    /** Kryos in two layers (SPEC §3.1): the body with the far ring, and the ring's near arc (w > 0), so a world can go between. */
    function giantSprite(R, grey) {
        const half = Math.ceil(R * P.GIANT.r1 * 1.03) + 8, S = half * 2, p = P.painter(S, S, false), out = P.paintGiant(p, { cx: half, cy: half, R, L: grey ? shadowL(litOf('kryos')) : litOf('kryos') });
        const ct = Math.cos(P.GIANT.tilt), sn = Math.sin(P.GIANT.tilt), open = P.GIANT.open, body = new ImageData(S, S), arc = new ImageData(S, S), d = p.data;
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
            const o = (y * S + x) * 4; if (!d[o + 3]) continue;
            const dx = x + 0.5 - half, dy = y + 0.5 - half, u = dx * ct + dy * sn, w = -dx * sn + dy * ct, rho = Math.hypot(u, w / open) / R;
            let c = [d[o], d[o + 1], d[o + 2]];
            if (grey) c = [c[0] * SHADOW[0], c[1] * SHADOW[1], c[2] * SHADOW[2]];              // in shadow: the gold kept, darker and cooler
            const dst = !grey && w > 0 && rho > P.GIANT.r0 - 0.03 && rho < P.GIANT.r1 + 0.03 ? arc : body;
            dst.data[o] = c[0]; dst.data[o + 1] = c[1]; dst.data[o + 2] = c[2]; dst.data[o + 3] = 255;
        }
        const toCanvas = img => { const c = document.createElement('canvas'); c.width = S; c.height = S; c.getContext('2d').putImageData(img, 0, 0); return c; };
        return { canvas: toCanvas(body), arc: grey ? null : toCanvas(arc), half, rims: grey ? [] : out.rims.map(([x, y, rr, lv]) => [x - half, y - half, rr, lv]) };
    }
    function spriteFor(it, queueOnly, grey) {
        const g = grey == null ? (it.grey >= 1 ? 1 : 0) : grey, prev = Slice.clock.playing;
        if (queueOnly) Slice.clock.playing = true;                                // pre-baking: only queue, never paint now
        try {
            if (it.kind === 'giant') return want('k' + g, it.r, () => giantSprite(it.r, !!g), false);
            if (it.kind === 'station') return want('s' + g, it.r, () => stationSprite(it.r, !!g), it.r < 70);
            return want('w:' + it.id + g, it.r, () => worldSprite(it.id, it.r, !!g), it.r < 70);
        } finally { Slice.clock.playing = prev; }
    }

    // ── the Lander from outside (game-screen-v3's paintLander recipe: V3Paint.hull with shapeL) ──
    const landerCache = new Map();
    function landerSprite(len, angle) {
        const deg = Math.round(angle * 90 / Math.PI) * 2, a = deg * Math.PI / 180, key = len + ':' + deg;
        if (landerCache.has(key)) return landerCache.get(key);
        const ht = Math.round(len / 3.15 * 10) / 10, half = Math.ceil(len / 2 + ht + 8), p = P.painter(half * 2, half * 2, false), L = REST.lander, sa = Math.atan2(LP[1] - L.y, LP[0] - L.x);
        const o = { x: half, y: half, len, ht, angle: a, flip: true, seed: 9, anchor: 0.5, sun: len < 80 ? 0.24 : 0.32, sunDir: [Math.cos(sa), Math.sin(sa)], fade: 0.22, mirror: false, flat: len < 130 };
        const at = P.hull(p, o, P.shapeL), rel = q => [q[0] - half, q[1] - half];
        const out = { canvas: p.canvas(), half, ports: [0, 1, 2, 3, 4, 5].map(i => rel(at(P.DECK_U(i) + 0.054, -0.32))), bridge: rel(at(P.LANDER.NOSE - 0.02, -0.12)),
            bell: rel(at(1.0, 0)), clamp: rel(at(P.DECK_U(4) + 0.05, 0.56 + 1.2 / ht)), skirt: [0.87, 0.89, 0.91, 0.93].map(u => rel(at(u, 0.6))) };
        if (landerCache.size > 400) landerCache.clear();
        landerCache.set(key, out);
        return out;
    }

    // ── the light: v1's glow, four breathing frames per size ──
    const glowCache = new Map();
    function lightScale(t) {
        const lost = IDS.filter(id => W.modes[id].m === 'passed' || W.modes[id].m === 'gone').length, f = W.flight;
        const boost = f && f.id === 'light' ? 1 + 0.5 * ease(flightE(f, t)) : W.held === 'light' || W.jump ? 1.5 : 1;
        return Math.pow(GROW, lost) * boost;
    }
    function lightOf(n, k) { const L = DATA.SECTORS[n].light, s = sc * k; return { core: L.core * s, halo: L.halo * s, strength: L.strength, spikes: L.spikes * sc * Math.sqrt(k) }; }
    function glowFrame(n, k, t) {
        const kq = Math.round(k * 10) / 10, key = n + ':' + kq;
        let fr = glowCache.get(key);
        if (!fr) {
            const L = lightOf(n, kq), reach = Math.ceil(L.halo * 3.2 + L.core + 10);
            fr = [0, 1, 2, 3].map(i => { const p = P.painter(reach * 2, reach * 2, false); P.lightGlow(p, reach + (LP[0] % 1), reach + (LP[1] % 1), L, 0.92 + 0.08 * Math.sin(i / 4 * Math.PI * 2)); return { canvas: p.canvas(), reach }; });
            glowCache.set(key, fr);
        }
        return fr[Math.floor(t / 500) % 4];
    }

    // ── the far sky: sky F, its enormous thing dropped, and the slice's own far colours (SPEC §3.1) ──
    function accentRamps() {
        const ACC = (window.V3Sky2 && window.V3Sky2.ACC) || {};
        return { ROSE: ACC.ROSE || RP.DUST, CRIMSON: ACC.CRIMSON || RP.RED, VERDIGRIS: ACC.VERDIGRIS || RP.ICE, JADE: ACC.JADE || RP.ICE, SLATE: ACC.SLATE || RP.PASSED,
            TEAL: P.ramp(INK, '#07120f', '#0f2621', '#1b4239', '#2c6556', '#4a8f7c', '#86c2ad'),                     // the ring nebula's lit shell: verdigris, one step louder
            COLD: P.ramp(INK, '#0f121c', '#22283c', '#454f70', '#8590b8', '#d4daf2'), CYAN: P.ramp(INK, '#051416', '#0b2a2d', '#134a4e', '#227479', '#4aa6aa', '#7cc8c8') };
    }
    /** The far colours (look playtest, 2026-10-10: "noir with rare colour" read as all brown and grey). Still rare, still far,
        dull: each is a few dozen pixels of one distinct hue at its own depth, and the eye can find it. Sizes are in the
        360-row stage's pixels (times sc). Never within 60 px of the light, a world or our ship (sector 1); u, v on the space side. */
    const FAR_COLOURS = {
        1: R => [
            { kind: 'veil', u: 0.30, v: 0.08, len: 150, wide: 7, tilt: 0.16, ramp: R.SLATE, depth: 0.3, gain: 1.15, seed: 61 },          // a long violet veil, deep in the far sky
            { kind: 'planetary', u: 0.20, v: 0.30, r: 3.4, ramp: R.TEAL, depth: 0.8, live: 'pulse', period: 11000, gain: 1.45, seed: 31 },   // a teal ring nebula, its shell lit
            { kind: 'knot', u: 0.55, v: 0.06, r: 7, tilt: -0.5, ramp: R.ROSE, depth: 0.7, live: 'pulse', period: 14000, gain: 1.25, seed: 3 },   // a rose-violet wisp of gas
            { kind: 'dwarf', u: 0.97, v: 0.08, r: 4, ramp: R.CRIMSON, depth: 1.3, live: 'flare', period: 23000, gain: 1.3, seed: 5 },      // a deep red carbon star
            { kind: 'binary', u: 0.04, v: 0.40, sep: 2, ramp: R.COLD, ramp2: R.COLD, depth: 1.1, live: 'twinkle', period: 17000, seed: 11 },   // a cold blue-white pair
            { kind: 'comet', u: 0.47, v: 0.38, ramp: R.JADE, depth: 0.6 },                                                              // a pale green comet, far off
            { kind: 'blink', u: 0.06, v: 0.95, ramp: R.CYAN, depth: 0.9, period: 5200 },                                                // a slow cyan blink
        ],
        2: R => [
            { kind: 'veil', u: 0.52, v: 0.30, len: 170, wide: 8, tilt: -0.22, ramp: R.JADE, depth: 0.3, gain: 1.1, seed: 71 },          // a faint green veil over the dark
            { kind: 'dwarf', u: 0.24, v: 0.16, r: 4, ramp: R.CRIMSON, depth: 1.2, live: 'flare', period: 31000, gain: 1.3, seed: 21 },
            { kind: 'planetary', u: 0.64, v: 0.10, r: 3, ramp: R.TEAL, depth: 0.8, live: 'pulse', period: 9000, gain: 1.4, seed: 23 },
            { kind: 'knot', u: 0.08, v: 0.46, r: 6, tilt: 0.6, ramp: R.ROSE, depth: 0.6, live: 'pulse', period: 12000, gain: 1.15, seed: 25 },
        ],
    };
    function accentList(n) {
        const make = FAR_COLOURS[n]; if (!make) return null;
        const R = accentRamps(), clear = 60 * G.dpr / G.k, sz = sc;
        const near = (x, y) => n === 1 && (Math.hypot(x - LP[0], y - LP[1]) < clear + 8 || Math.hypot(x - REST.lander.x, y - REST.lander.y) < clear + REST.lander.len / 2 ||
            IDS.some(id => Math.hypot(x - REST[id].x, y - REST[id].y) < clear + REST[id].r * (id === 'kryos' ? 1.05 : 1)));
        return make(R).map(a => Object.assign({ ax: ax(a.u), ay: ay(a.v) }, a, a.r ? { r: a.r * sz } : {}, a.len ? { len: a.len * sz, wide: a.wide * sz } : {}))
            .filter(a => a.kind === 'veil' || !near(a.ax, a.ay));
    }
    function buildArt(n) {
        const sec = DATA.SECTORS[n], ox = Math.round(G.hull + spW() / 2 - 320), oy = Math.round(G.H / 2 - 180), light = [LP[0] - ox, LP[1] - oy];
        const acc = accentList(n) || [], RN = window.V3Sky2 && window.V3Sky2.RECIPES && window.V3Sky2.RECIPES[n];
        let sky = null;
        if (window.V3Sky2) {
            const keep = RN && RN.accents;                                         // sky2's accents are swapped for the slice's own while it builds (restored at once)
            if (acc.length && RN) RN.accents = acc.filter(a => a.kind !== 'comet' && a.kind !== 'blink').map(a => Object.assign({}, a, { x: a.ax - ox, y: a.ay - oy }));
            try { sky = window.V3Sky2.build(G.W, G.H, ox, oy, n, light, 'f'); } finally { if (acc.length && RN) RN.accents = keep; }
            if (sky) sky.thing = null;                                // Kryos is sector 1's one enormous thing
        }
        const strip = P.spaceStrip(G.W + 200, G.H, sec.seed, sec.dust, sec.haze * (sky ? sky.haze : 1), sec.stars), L = lightOf(n, 1), lit = new Float32Array(G.W * G.H);
        for (let y = 0; y < G.H; y++) for (let x = 0; x < G.W; x++) lit[y * G.W + x] = Math.exp(-Math.hypot(x - LP[0], (y - LP[1]) * 1.15) / (L.halo * 0.85 + 6));
        const bp = P.painter(G.W, G.H, true), canvas = document.createElement('canvas'); canvas.width = G.W; canvas.height = G.H;
        const own = acc.filter(a => a.kind === 'comet' || a.kind === 'blink').map(a => Object.assign({ sprite: a.kind === 'comet' ? cometSprite(a) : null }, a));
        return { n, sky, strip, lit, bp, canvas, g: canvas.getContext('2d'), key: null, bright: [], keep: L.halo * 0.9 + L.core + 8, own };
    }
    /** The far comet: a pale jade head and a thin tail pointing away from the light, about 10 stage px long (look playtest:
        the 13 px speck was never seen). */
    function cometSprite(a) {
        const tail = Math.round(10 * sc), half = tail + 3, p = P.painter(half * 2, half * 2, false), ang = Math.atan2(a.ay - LP[1], a.ax - LP[0]), dx = Math.cos(ang), dy = Math.sin(ang);
        for (let k = tail; k >= 1; k--) { const v = 0.85 * Math.pow(1 - k / (tail + 1), 1.2); p.tone(half + dx * k, half + dy * k, a.ramp, v); if (k < tail * 0.5) p.tone(half + dx * k - dy, half + dy * k + dx, a.ramp, v * 0.45); }
        [[-1, 0], [1, 0], [0, 1], [0, -1]].forEach(([x, y]) => p.tone(half + x, half + y, a.ramp, 0.5));
        p.tone(half, half, a.ramp, 1); p.tone(half + 1, half, a.ramp, 0.82);
        const c = p.canvas(); c.half = half; return c;
    }
    function ensureBackdrop(A) {
        const off = Math.max(0, Math.min(200, Math.round(W.D * 0.02))), offD = A.sky ? Math.max(0, Math.min(A.sky.extra - 1, Math.round(W.D * window.V3Sky.DEEP))) : 0, key = off + ':' + offD;
        if (A.key === key) return;
        const keep = (x, y) => Math.hypot(x - LP[0], y - LP[1]) < A.keep;
        A.bright = A.sky ? window.V3Sky.paintSpace(A.bp, A.strip, off, A.lit, keep, A.sky, offD) : P.paintSpace(A.bp, A.strip, off, A.lit, keep);
        A.g.putImageData(new ImageData(A.bp.data, G.W, G.H), 0, 0);
        A.key = key;
    }

    // ═══ 5. drawing, frame by frame ═══
    const patCache = [];
    function pat(n) {
        n = Math.max(0, Math.min(64, Math.round(n)));
        if (!patCache[n]) { const c = document.createElement('canvas'); c.width = 8; c.height = 8; const g = c.getContext('2d'); g.fillStyle = INK; for (let i = 0; i < 64; i++) if (P.BAYER_RAW[i] < n) g.fillRect(i & 7, i >> 3, 1, 1); patCache[n] = ctx.createPattern(c, 'repeat'); }
        return patCache[n];
    }
    function dimAll(amount) { if (amount <= 0) return; ctx.fillStyle = pat(amount * 64); ctx.fillRect(0, 0, G.W, G.H); }
    let scratch = null;
    function scratchOf(w, h) {
        if (!scratch || scratch.c.width < w || scratch.c.height < h) { const c = document.createElement('canvas'); c.width = Math.max(w, scratch ? scratch.c.width : 0); c.height = Math.max(h, scratch ? scratch.c.height : 0); scratch = { c, g: c.getContext('2d', { willReadFrequently: true }) }; }
        scratch.g.clearRect(0, 0, w, h); return scratch.g;
    }
    /** One sprite on screen; cut: hidden where the giant's body or near ring covers it; fade: dithered away; mix: a second
        sprite dithered in on top (the colour → grey turn). */
    function blit(canvas, half, x, y, o) {
        const X = Math.round(x) - half, Y = Math.round(y) - half, w = canvas.width, h = canvas.height;
        if (!o || (!o.cut && !(o.fade > 0) && !o.mask)) { ctx.drawImage(canvas, X, Y); return; }
        const g = scratchOf(w, h); g.drawImage(canvas, 0, 0);
        if (o.cut) { const img = g.getImageData(0, 0, w, h), d = img.data; for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) { const i = (yy * w + xx) * 4 + 3; if (d[i] && behindGiant(o.cut, X + xx + 0.5, Y + yy + 0.5)) d[i] = 0; } g.putImageData(img, 0, 0); }
        if (o.fade > 0) { g.globalCompositeOperation = 'destination-out'; g.fillStyle = pat(o.fade * 64); g.fillRect(0, 0, w, h); }
        if (o.mask != null) { g.globalCompositeOperation = 'destination-in'; g.fillStyle = pat(o.mask * 64); g.fillRect(0, 0, w, h); }
        g.globalCompositeOperation = 'source-over';
        ctx.drawImage(g.canvas, 0, 0, w, h, X, Y, w, h);
    }
    function drawItem(f, it, t) {
        if (it.id === 'rhea' && !isNamed()) {                                                // a far grey disc, lit on its edge, and the contact's slow cold pulse on it
            // fun playtest: before dating it read as one cyan pixel among the stars. A faint world now (about 20 css px at 1080),
            // and the pulse is slow and wide: a cold halo that swells over 4 s, in eight dithered steps, never a ring or a marker
            const x = Math.round(it.x), y = Math.round(it.y), sw = [0, 0.12, 0.26, 0.4, 0.5, 0.4, 0.26, 0.12][Math.floor(t / 500) % 8], rr = Math.max(4, Math.round(3.6 * sc));
            const sp = want('w:rhea-far', rr, () => worldSprite('rhea', rr, false), true);
            f.glow(x, y, Math.round(rr + (5 + 6 * sw) * sc), RP.ICE, 0.24 + sw * 0.56); f.reset();
            blit(sp.canvas, sp.half, x, y);
            P.contactBlip(f, x + rr + 1, y - rr - 1, t, false); return;
        }
        const sp = spriteFor(it);
        if (it.kind === 'giant') {
            if (it.part === 'arc') { if (sp.arc) blit(sp.arc, sp.half, it.x, it.y); return; }
            if (it.grey > 0 && it.grey < 1) { blit(spriteFor(it, false, 0).canvas, spriteFor(it, false, 0).half, it.x, it.y); blit(sp.canvas, sp.half, it.x, it.y, { mask: it.grey }); if (it.part === 'all') { const c0 = spriteFor(it, false, 0); if (c0.arc) blit(c0.arc, c0.half, it.x, it.y, { fade: it.grey }); } return; }
            blit(sp.canvas, sp.half, it.x, it.y);
            if (it.part === 'all' && sp.arc) blit(sp.arc, sp.half, it.x, it.y);
            return;
        }
        if (it.grey > 0 && it.grey < 1) { const c0 = spriteFor(it, false, 0); blit(c0.canvas, c0.half, it.x, it.y); blit(sp.canvas, sp.half, it.x, it.y, { mask: it.grey }); }
        else blit(sp.canvas, sp.half, it.x, it.y, { cut: it.cut, fade: it.fade });
        if (it.id === 'rhea' && t - W.namedT < 900) P.contactBlip(f, Math.round(it.x), Math.round(it.y), t, true);   // the contact resolves into the moon
        if (it.grey >= 1 || (it.hiding || 0) > 0.2) return;
        const x = Math.round(it.x), y = Math.round(it.y);
        if (it.kind === 'station') { if (sp.win) f.px(x + sp.win[0], y + sp.win[1], RP.AMBER.hex[4], it.r > 40 ? 2 : 1, 1); return; }   // its one window, lit, steady
        const B = FIELD[it.id].beacon; if (!B || it.r < 8) return;
        const X = x + Math.round(B[0] * it.r), Y = y + Math.round(B[1] * it.r), ph = Math.floor((t % B[2]) / TICK);
        if (it.id === 'erebus' ? ph === 0 || ph === 2 : ph < 3) { f.glow(X, Y, it.r > 40 ? 7 : 4, RP.RED, 0.9); f.px(X, Y, RP.RED.hex[4], it.r > 40 ? 2 : 1, it.r > 40 ? 2 : 1); }   // Erebus: two short flashes, a call
        else f.px(X, Y, RP.RED.hex[2]);
    }
    function drawRims(f, it, up) {
        if (it.id === 'rhea' && !isNamed()) return;
        const sp = spriteFor(it); if (!sp || !sp.rims) return;
        const x = Math.round(it.x), y = Math.round(it.y);
        sp.rims.forEach(([rx, ry, r, lv]) => f.px(x + rx, y + ry, r.hex[Math.min(r.hex.length - 1, lv + up)]));
    }

    // ── our ship, outside ──
    function drift(t) { return [Math.round(2 * Math.sin(t / 3100)), Math.round(2.6 * Math.sin(t / 2300 + 1)), 0.035 * Math.sin(t / 2700 + 2)]; }
    const baseAngle = () => Math.atan2(LP[1] - REST.lander.y, LP[0] - REST.lander.x);
    function poseAt(t) { const R = REST.lander, [dx, dy, da] = drift(t); return { x: R.x + dx, y: R.y + dy, len: R.len, angle: baseAngle() + W.bank + da }; }
    function plumeLevel(t) {
        const energy = Slice.state.res ? Slice.state.res.energy : 100, J = W.jump;
        if (W.black) return 0.8;                                                           // in the corridor: a steady cruise
        if (J) return 1 + 2.4 * clamp01((t - J.t0) / 1500);
        let lvl = 0.25 + 0.75 * clamp01(energy / 100);
        if (W.flight) lvl *= 1.7; else if (W.lock) lvl *= 1.15; else if (W.held) lvl *= 0.5;
        if (Slice.broken && Slice.broken('engineering')) lvl *= sputter(t);                  // engineering down: a short plume that coughs
        if (t >= W.flareT) lvl += 1.6 * Math.exp(-(t - W.flareT) / 350);
        return lvl;
    }
    /** Engineering down (fun playtest: "Shut the drive down" left the plume burning full): the plume runs at half and cuts out
        for a beat or two every couple of seconds, on the same 2.9 s cycle as the brown-outs aboard (ship.js). */
    function sputter(t) {
        const k = t % 2900, n = Math.floor(t / 2900), dip = hash(n & 255, 7, 61) < 0.75;
        return dip && (k < 90 || (k > 170 && k < 240)) ? 0.08 : 0.45;
    }
    function drawLander(f, t) {
        const pose = poseAt(t), sp = landerSprite(pose.len, pose.angle), cx = Math.round(pose.x), cy = Math.round(pose.y), s = pose.len / 48, lvl = plumeLevel(t);
        const ca = Math.cos(pose.angle), sa = Math.sin(pose.angle), bx = cx + sp.bell[0], by = cy + sp.bell[1], frame = Math.floor(t / TICK) % 4;
        for (let i = 0; i < 9; i++) { const age = ((t / 1000) * 0.8 + hash(i, 1, 57)) % 1, dist = (14 + age * 40) * s, side = (hash(i, 2, 57) - 0.5) * age * 9 * s; f.tone(bx - ca * dist - sa * side, by - sa * dist + ca * side, RP.PLUME, 0.62 * (1 - age) * Math.min(1, lvl)); }
        const shut = landerSprite(Math.max(6, Math.round(pose.len * 0.18)), pose.angle);
        ctx.drawImage(shut.canvas, cx + sp.clamp[0] - shut.half, cy + sp.clamp[1] - shut.half);                  // the shuttle, clamped beside the hold
        ctx.drawImage(sp.canvas, cx - sp.half, cy - sp.half);
        const flick = [1, 0.72, 1.16, 0.88][frame], hot = [1, 0.86, 1, 0.92][frame], len = (6 + 19 * lvl) * s * flick, w0 = Math.max(1, 1.8 * s * (0.8 + 0.2 * Math.min(lvl, 2)));
        for (let d = 0; d < len; d++) { const hw = w0 * (1 - (d / len) * 0.6); for (let k = -Math.ceil(hw); k <= Math.ceil(hw); k++) { const u = Math.abs(k) / (hw + 0.01), v = (1 - d / len) ** 0.8 * (1 - u * u) * hot; if (v > 0.06) f.tone(bx - ca * d - sa * k, by - sa * d + ca * k, RP.PLUME, v); } }
        sp.skirt.forEach(([x, y], i) => { if ((i + frame) % 2 === 0 || lvl > 1) f.tone(cx + x, cy + y, RP.PLUME, 0.4 + 0.15 * Math.min(lvl, 2)); });
        const ship = Slice.mods.ship, on = ship && ship.occupied ? ship.occupied() : [true, true, true, true, true, true], b = ship && ship.beat ? ship.beat(t) : 0.5;
        const hi = b > 0.55 ? 4 : 3;                                                                                // the ports breathe with the reactor
        sp.ports.forEach(([px, py], i) => { if (on[i]) f.px(cx + px, cy + py, RP.AMBER.hex[i === 0 ? hi : hi - 1]); });
        f.px(cx + sp.bridge[0], cy + sp.bridge[1], RP.AMBER.hex[on[0] ? hi : 2]);
    }

    // ── space streaming past (game-screen-v3's flowField): specks on rays out of where we are heading ──
    const FLOWS = { motes: { n: 110, seed: 41, rate: 0.0005, tail: 0.1, ramp: 'DUST', v: 0.85, lit: true }, streaks: { n: 230, seed: 43, rate: 0.0015, tail: 0.17, ramp: 'STAR', v: 0.9 },
        near: { n: 30, seed: 47, rate: 0.0027, tail: 0.13, ramp: 'STAR', v: 1.05, wide: 0.5 } };
    const FLOW_LN = Math.log(900 / 22);
    let layerBack = null, layerFront = null;
    function flow(L, o, vp, speed) {
        const ramp0 = RP[o.ramp], tailPh = Math.min(0.12, speed * o.rate * o.tail), n = Math.round(o.n * Math.min(1.6, spW() * G.H / (640 * 360))), d0 = 22 * sc;
        for (let i = 0; i < n; i++) {
            const ph = hash(i, 1, o.seed) + hash(i, 7, o.seed) / 256 + W.flow * o.rate, cyc = Math.floor(ph), u = ph - cyc;
            const th = (hash(i + cyc * 13, 2, o.seed) + hash(i, cyc & 255, o.seed + 1) / 256) * Math.PI * 2, dx = Math.cos(th), dy = Math.sin(th);
            const d = d0 * Math.exp(u * FLOW_LN), x = vp[0] + dx * d - G.hull, y = vp[1] + dy * d;
            if (x < -60 || y < -60 || x > L.W + 60 || y > L.H + 60) continue;
            let v = o.v * smooth(d0, 90 * sc, d) * (0.55 + 0.45 * hash(i, 3, o.seed));
            if (o.lit) v *= 0.3 + 1.1 * Math.exp(-Math.hypot(x + G.hull - LP[0], y - LP[1]) / (170 * sc));
            if (v < 0.08) continue;
            const len = Math.max(0, d - d0 * Math.exp(Math.max(0, u - tailPh) * FLOW_LN)), thick = o.wide && hash(i, 5, o.seed) < o.wide;
            for (let k = 0; k <= len; k++) { const a = v * (1 - k / (len + 1)); L.tone(x - dx * k, y - dy * k, ramp0, a); if (thick) L.tone(x - dx * k - dy, y - dy * k + dx, ramp0, a * 0.8); }
        }
    }
    function speedNow(t) {
        if (W.jump) return SPEED.burn;
        const f = W.flight; if (f) { const e = flightE(f, t); return lerp(SPEED.held, SPEED.flight, smooth(0, 0.15, e) * (1 - smooth(0.8, 1, e))); }
        if (W.held) return SPEED.held;
        return Slice.state.hold > 0 ? SPEED.hold : SPEED.rest;
    }
    function vanishing(sn, t) {
        const f = W.flight, id = f ? f.id : W.held, it = id && sn.items.find(i => i.id === id && i.part !== 'arc');
        if (!it) { if (W.ease) { const k = 1 - ease(clamp01((t - W.ease.t0) / W.ease.dur)); return [lerp(LP[0], W.ease.vp ? W.ease.vp[0] : LP[0], k), lerp(LP[1], W.ease.vp ? W.ease.vp[1] : LP[1], k)]; } return LP; }
        const k = f ? smooth(0, 0.3, flightE(f, t)) : 1;
        return [lerp(LP[0], it.x, k), lerp(LP[1], it.y, k)];
    }

    // ── the jump (game-screen-v3's drawJump): the burn runs to full, every star stretches toward the light, white-gold, black ──
    function drawJump(t) {
        const J = W.jump, s = t - J.t0;
        if (s < 1500) return;
        if (s >= 2250) { ctx.fillStyle = RP.SUN.hex[6]; ctx.fillRect(0, 0, G.W, G.H); dimAll(Math.floor(clamp01((s - 2250) / 400) * 8) / 8); return; }
        const k = Math.min(6, Math.floor((s - 1500) / TICK) + 1), L = P.pixelLayer(G.W, G.H);
        dimAll(k / 8);
        A1.bright.forEach(st => { const dx = LP[0] - st.x, dy = LP[1] - st.y, d = Math.hypot(dx, dy) || 1, len = Math.min(d, k * k * 2.6 * sc * (0.5 + st.mag)); for (let i = 0; i < len; i++) L.tone(st.x + dx / d * i, st.y + dy / d * i, RP.STAR, (0.45 + 0.5 * st.mag) * (1 - i / len)); });
        L.draw(ctx);
    }

    function render(t) {
        if (!G || !A1 || W.hidden) return;                                                   // the bridge covers us while stopped
        ctx.imageSmoothingEnabled = false;
        const f = P.framer(ctx, G.W, G.H);
        if (W.black) { drawDark(f, t); return; }
        if (W.sector === 2) { drawSector2(f, t); return; }
        const sn = scene(W, t); W.last = sn;
        ensureBackdrop(A1); ctx.drawImage(A1.canvas, 0, 0);
        if (A1.sky && A1.sky.live) A1.sky.live(ctx, t, W.D);                                 // sky F's far motion and the far colours
        drawOwnAccents(f, t, A1);
        const gl = glowFrame(1, lightScale(t), t); ctx.drawImage(gl.canvas, Math.round(LP[0]) - gl.reach, Math.round(LP[1]) - gl.reach);
        const dl = discsOf(sn);
        P.twinkle(f, A1.bright.filter(st => !dl.some(([x, y, r]) => Math.hypot(st.x - x, st.y - y) < r + 2)), t);
        f.reset();
        const vp = vanishing(sn, t), sp = speedNow(t), streaksFront = !!(W.flight || W.jump);   // at rest the streaks pass behind the worlds (look playtest: scratches on the giant)
        layerBack.clear(); flow(layerBack, FLOWS.motes, vp, sp); layerBack.draw(ctx, G.hull, 0);
        if (!streaksFront) { layerFront.clear(); flow(layerFront, FLOWS.streaks, vp, sp); flow(layerFront, FLOWS.near, vp, sp); layerFront.draw(ctx, G.hull, 0); }
        sn.items.forEach(it => { drawItem(f, it, t); f.reset(); });
        const lockId = W.lock ? W.lock.id : null, hov = lockId || (W.flight ? null : W.hover);
        if (hov && hov !== 'light') sn.items.filter(i => i.id === hov && i.part !== 'arc' && !i.hiding).forEach(i => drawRims(f, i, lockId ? 2 : 1));
        if (hov === 'light' && W.lightOpen) { const r = lightOf(1, lightScale(t)), lx = Math.round(LP[0]), ly = Math.round(LP[1]); for (let d = Math.round(r.core + 2); d < r.core + 10 * sc; d++) { const v = 0.85 - (d - r.core) / (12 * sc); f.tone(lx - d, ly, RP.SUN, v); f.tone(lx, ly - d, RP.SUN, v); f.tone(lx, ly + d, RP.SUN, v); } }
        if (!['dive-in', 'dive-out'].includes(Slice.state.mode)) drawLander(f, t);   // stop.js draws our ship while it dives
        if (streaksFront) { layerFront.clear(); flow(layerFront, FLOWS.streaks, vp, sp); flow(layerFront, FLOWS.near, vp, sp); layerFront.draw(ctx, G.hull, 0); }
        drawNoteShade();
        if (W.jump) drawJump(t);
        if (W.opening) dimAll(1 - Math.floor(clamp01((t - W.opening.t0) / 1000) * 8) / 8);
    }
    function drawOwnAccents(f, t, A) {
        const off = A.sky ? Math.max(0, Math.min(A.sky.extra - 1, Math.round(W.D * window.V3Sky.DEEP))) : 0;
        A.own.forEach(a => {
            const x = Math.round(a.ax - off * a.depth), y = Math.round(a.ay);
            if (a.sprite) { ctx.drawImage(a.sprite, x - a.sprite.half, y - a.sprite.half); return; }
            const ph = (t + 1700) % a.period, on = ph < 625, mid = !on && ph < 1000;          // the slow cyan blink: a dim point always, a cross and a breath when it fires
            f.px(x, y, a.ramp.hex[on ? 6 : mid ? 4 : 3]); f.px(x + 1, y, a.ramp.hex[on ? 5 : 2]);
            if (on || mid) [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => f.px(x + dx * (dx > 0 ? 2 : 1), y + dy, a.ramp.hex[on ? 4 : 2]));
            if (on) { [[2, 2], [-2, 2], [2, -2], [-2, -2], [0, 3], [0, -3], [-3, 0], [4, 0]].forEach(([dx, dy]) => f.px(x + dx, y + dy, a.ramp.hex[1])); }
        });
    }
    /** After the flash: the corridor and the meal. Jump space is dark, but not empty (look playtest: the space side went pure
        black and our ship vanished): a faint teal haze down the corridor, the far light a warm smudge at its end, slow
        streaks, and our Lander still out there with the journey. */
    let darkArt = null;
    function corridorArt() {
        if (darkArt) return darkArt;
        const p = P.painter(G.W, G.H, true), reach = spW() * 0.42, L = REST.lander;
        p.region(G.hull, 0, G.W, G.H, (x, y) => {
            const dl = Math.hypot(x - LP[0], (y - LP[1]) * 1.6), along = clamp01((x - L.x) / (LP[0] - L.x + 1)), mid = lerp(L.y, LP[1], along), wall = Math.abs(Math.abs(y - mid) - lerp(G.H * 0.34, G.H * 0.04, along));
            const haze = 0.32 * Math.exp(-dl / reach) * (0.6 + 0.6 * P.fbm(x / 23, y / 11, 91, 3)) + 0.16 * Math.exp(-wall / (5 * sc)) * along * (0.5 + P.fbm(x / 9, y / 4, 93, 2));
            if (haze > 0.04) p.tone(x, y, RP.HAZE, haze);
            const core = 0.42 * Math.exp(-dl / (9 * sc)); if (core > 0.05) p.tone(x, y, RP.SUN, core);
        });
        darkArt = p.canvas(); return darkArt;
    }
    function drawDark(f, t) {
        ctx.drawImage(corridorArt(), 0, 0);
        layerFront.clear(); flow(layerFront, FLOWS.streaks, LP, 30); layerFront.draw(ctx, G.hull, 0);
        drawLander(f, t);
    }
    function drawSector2(f, t) {
        if (!A2) A2 = buildArt(2);
        const s = t - W.s2.t0;
        ensureBackdrop(A2); ctx.drawImage(A2.canvas, 0, 0);
        if (A2.sky && A2.sky.live) A2.sky.live(ctx, t, W.D);
        const gl = glowFrame(2, 1, t); ctx.drawImage(gl.canvas, Math.round(LP[0]) - gl.reach, Math.round(LP[1]) - gl.reach);
        P.twinkle(f, A2.bright, t); f.reset();
        const R = Math.round(0.42 * G.H), rg = want('rogue', R, () => { const half = R + 4, p = P.painter(half * 2, half * 2, false); P.paintRogue(p, { cx: half, cy: half, R, L: P.norm3(0.6, -0.8, 0.3) }); return { canvas: p.canvas(), half }; }, true);
        blit(rg.canvas, rg.half, ax(0.5), lerp(G.H * 1.4, G.H * 1.04, easeOut(clamp01(s / 30000))), null);      // the rogue world rising where the stars stop
        [[0.82, 0.28, RP.ICE], [0.78, 0.62, RP.DUST]].forEach(([u, v, rp], i) => {               // Hyperion and Nysa, two far glints
            const x = Math.round(ax(u)), y = Math.round(ay(v)), pulse = 0.5 + 0.5 * Math.sin(Math.floor(t / TICK) * TICK / 1100 + i * 2);
            [[-1, -1], [1, -1], [-1, 1], [1, 1], [-2, 0], [2, 0], [0, -2], [0, 2]].forEach(([dx, dy]) => f.px(x + dx, y + dy, INK));
            f.px(x, y, rp.hex[level(rp, 0.7 + 0.28 * pulse, x, y) || 1]); [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dx, dy]) => f.tone(x + dx, y + dy, rp, 0.3 + 0.32 * pulse));
        });
        const vp = LP; layerFront.clear(); flow(layerFront, FLOWS.streaks, vp, SPEED.rest); layerFront.draw(ctx, G.hull, 0);
        drawLander(f, t);
        dimAll(1 - Math.floor(clamp01(s / 1000) * 8) / 8);
    }

    // ═══ 6. words: the note when pointing (name and tag, the cost line in numbers mode), the sector title ═══
    let note = null, title = null, noteRect = null;
    const isNamed = () => W.named || !!(Slice.state.places && Slice.state.places.rhea && Slice.state.places.rhea.named) || !!(Slice.state.flags && Slice.state.flags.dated);
    function placeWords(id) {
        if (id === 'light') return { name: 'The light ahead', tag: 'The jump' };
        if (Slice.mods.script && typeof Slice.mods.script.note === 'function') {             // integrator: one source for the words (what we did there, "Behind us")
            try { const n = Slice.mods.script.note(id); if (n && n.name) return { name: n.name, tag: n.tag }; } catch (err) { console.error('Slice: script.note failed', err); }
        }
        const script = Slice.mods.script, S = (script && script.PLACES && script.PLACES[id]) || {}, D = Object.assign({}, DATA.SECTORS[1].places.find(p => p.id === id) || {}, NAMES[id] || {});
        if (id === 'rhea' && !isNamed()) return { name: D.contact.name, tag: D.contact.tag };
        const md = W.modes[id], tag = W.visited.has(id) ? S.doneTag || D.doneTag || 'We stopped here' : md && md.m === 'passed' ? 'We passed it' : S.tag || D.tag;
        return { name: S.name || D.name, tag };
    }
    function costLine(id) {
        const pv = W.preview; if (Slice.state.price !== 'numbers' || !pv || pv.id !== id) return null;
        const energy = Slice.state.res ? Slice.state.res.energy : 100;
        if (pv.free) return 'no energy · their last course';
        if (id === 'kryos') return `${pv.cost} energy · fills the tanks`;
        if (id === 'light') return `${pv.cost} energy · ${DATA.JUMP.rations} rations`;
        return `${pv.cost} energy · ${Math.max(0, energy - pv.cost)} left`;
    }
    const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
    function updateNote(t) {
        const id = W.hover && !(W.hover === 'light' && !W.lightOpen) && !(W.flight && W.flight.id === W.hover) ? W.hover : null, g = id ? placeAt(id) : null;   // the course is set: the note goes
        if (!id || !g.shown) { note.hidden = true; noteRect = null; W.noteKey = ''; return; }
        const w = placeWords(id), cost = costLine(id), key = [id, w.name, w.tag, cost].join('|');
        if (key !== W.noteKey) { note.replaceChildren(mk('p', 'name', w.name), mk('p', 'tag', w.tag)); if (cost) note.append(mk('p', 'cost', cost)); W.noteKey = key; W.noteSide = null; }
        note.hidden = false;
        const k = G.k / G.dpr, nw = note.offsetWidth / k, nh = note.offsetHeight / k, gap = (id === 'kryos' ? 10 : g.r + 8 * sc), ds = discsOf(W.last || scene(W, t)).filter(d => Math.hypot(d[0] - g.x, d[1] - g.y) > 1)
        if (id !== 'light') ds.push([LP[0], LP[1], 26 * sc]);                                   // integrator: the note keeps off the light's glare too
        const box = side => side === 'right' ? [g.x + gap, g.y - nh / 2] : side === 'left' ? [g.x - gap - nw, g.y - nh / 2] : side === 'above' ? [g.x - nw / 2, g.y - (id === 'kryos' ? g.r : 0) - gap - nh] : [g.x - nw / 2, g.y + gap];
        const ok = ([x, y]) => x >= G.hull + 6 && x + nw <= G.W - 6 && y >= 6 && y + nh <= G.H - 6 && !ds.some(([cx, cy, r]) => { const qx = Math.max(x, Math.min(cx, x + nw)), qy = Math.max(y, Math.min(cy, y + nh)); return Math.hypot(qx - cx, qy - cy) < r; });
        const ptr = W.pointer || [g.x, g.y], sides = ['right', 'left', 'above', 'below'].map(s => ({ s, b: box(s) })).filter(c => ok(c.b));
        sides.sort((a, b) => Math.hypot(b.b[0] + nw / 2 - ptr[0], b.b[1] + nh / 2 - ptr[1]) - Math.hypot(a.b[0] + nw / 2 - ptr[0], a.b[1] + nh / 2 - ptr[1]));   // away from the pointer
        let pick = sides.find(c => c.s === W.noteSide) || sides[0];
        if (!pick) { const b = box(g.x > G.hull + spW() / 2 ? 'left' : 'right'); pick = { s: 'x', b: [Math.max(G.hull + 6, Math.min(G.W - nw - 6, b[0])), Math.max(6, Math.min(G.H - nh - 6, b[1]))] }; }
        W.noteSide = pick.s;
        note.classList.toggle('is-left', pick.s === 'left');
        const [cx, cy] = G.toCss(pick.b[0], pick.b[1]);
        note.style.transform = `translate(${Math.round(cx)}px, ${Math.round(cy)}px)`;
        noteRect = { x: Math.round(pick.b[0]), y: Math.round(pick.b[1]), w: Math.ceil(nw), h: Math.ceil(nh) };
    }
    const shadeCache = new Map();
    function drawNoteShade() {                                                              // game-screen-v3's shadeSprite, simpler: the picture darkens softly under the note
        if (!noteRect) return;
        const r = noteRect, pad = 10, key = r.w + 'x' + r.h;
        let c = shadeCache.get(key);
        if (!c) {
            const Wd = r.w + pad * 2, Hd = r.h + pad * 2, p = P.painter(Wd, Hd, false), ink = P.hexRgb(INK), hw = r.w / 2, hh = r.h / 2, round = Math.min(hw, hh);
            p.region(0, 0, Wd, Hd, (x, y) => { const qx = Math.abs(x + 0.5 - pad - hw) - (hw - round), qy = Math.abs(y + 0.5 - pad - hh) - (hh - round), sd = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - round + (P.fbm(x / 7, y / 4, 17, 2) - 0.5) * 10;
                if (0.66 * (1 - smooth(-8, pad, sd)) > threshold(x, y)) p.set(x, y, ink); });
            c = p.canvas(); if (shadeCache.size > 60) shadeCache.clear(); shadeCache.set(key, c);
        }
        ctx.drawImage(c, r.x - pad, r.y - pad);
    }
    function showTitle(text, t, t0, inMs, holdMs, outMs) {
        const s = t - t0, a = s < 0 ? 0 : s < inMs ? s / inMs : s < inMs + holdMs ? 1 : 1 - (s - inMs - holdMs) / outMs;
        if (a <= 0) { title.hidden = true; return; }
        if (title.textContent !== text) title.textContent = text;
        title.hidden = false; title.style.opacity = String(Math.floor(clamp01(a) * 8) / 8);
        // in empty sky: the first of a few places whose box keeps clear of every world and the light (look playtest: the T sat on Zeta)
        const k = G.k / G.dpr, hw = title.offsetWidth / k / 2 + 8, hh = title.offsetHeight / k / 2 + 8, ds = (W.sector === 1 ? discsOf(W.last || scene(W, t)) : []).concat([[LP[0], LP[1], 30 * sc]]);
        const clear = ([x, y]) => !ds.some(([dx, dy, r]) => Math.hypot(Math.max(x - hw, Math.min(dx, x + hw)) - dx, Math.max(y - hh, Math.min(dy, y + hh)) - dy) < r);
        const spots = [[0.5, 0.2], [0.6, 0.1], [0.45, 0.1], [0.62, 0.2], [0.5, 0.06]].map(([u, v]) => [G.hull + spW() * u, G.H * v]);
        const [cx, cy] = G.toCss(...(spots.find(clear) || spots[0]));
        title.style.transform = `translate(${Math.round(cx)}px, ${Math.round(cy)}px) translate(-50%, -50%)`;
    }
    function injectStyle() {
        if ($('world-style')) return;
        const st = mk('style'); st.id = 'world-style';
        st.textContent = `#world-words .w-note { position: absolute; left: 0; top: 0; display: grid; gap: 3px; max-width: 22em; }
#world-words .w-note[hidden], #world-words .w-title[hidden] { display: none; }
#world-words .w-note .name { font: 500 var(--fs-note-name)/1.15 var(--f-ui); letter-spacing: 0.02em; color: var(--text); text-shadow: var(--shadow); }
#world-words .w-note .tag { font: 400 var(--fs-note-line)/1.35 var(--f-text); color: var(--dim); text-shadow: var(--shadow); }
#world-words .w-note .cost { font: 400 var(--fs-note-cost)/1.4 var(--f-num); color: var(--ui); text-shadow: var(--shadow); }
#world-words .w-note.is-left { text-align: right; justify-items: end; }
#world-words .w-title { position: absolute; left: 0; top: 0; font: 300 var(--fs-title)/1 var(--f-text); letter-spacing: 0.2em; color: var(--text); white-space: nowrap; text-shadow: var(--shadow); }`;
        document.head.appendChild(st);
    }

    // ═══ 7. pointing ═══
    function interactive() {
        const m = Slice.state.mode;
        return W.sector === 1 && !W.jump && !W.black && !W.held && !W.hidden && !(W.opening && Slice.clock.t - W.opening.t0 < 1000) && (m == null || m === 'travel' || m === 'flight');
    }
    function hitTest(x, y) {
        const sn = W.last || scene(W, Slice.clock.t);
        for (let i = sn.items.length - 1; i >= 0; i--) {
            const it = sn.items[i]; if (it.hitless || !it.clickable) continue;
            if (it.kind === 'giant') {
                const dx = x - it.x, dy = y - it.y, ct = Math.cos(P.GIANT.tilt), s = Math.sin(P.GIANT.tilt), u = dx * ct + dy * s, w = -dx * s + dy * ct, rho = Math.hypot(u, w / P.GIANT.open) / it.r;
                if (Math.hypot(dx, dy) < it.r + 4 || (rho > P.GIANT.r0 - 0.05 && rho < P.GIANT.r1 + 0.05)) return it.id;
                continue;
            }
            if (Math.hypot(x - it.x, y - it.y) < Math.max(it.r * (it.kind === 'station' ? 1.05 : 1) + 4, 10 * sc)) return it.id;
        }
        // playtest 1: while the camera re-frames after a stop (4 s) the worlds slide; the one already pointed at keeps the pointer
        // in a wider ring, so a hover is not lost and a click aimed a moment ago still lands
        if (W.ease && W.hover && W.hover !== 'light') {
            const it = sn.items.find(i => i.id === W.hover && i.part !== 'arc' && i.clickable && !i.hitless);
            if (it && Math.hypot(x - it.x, y - it.y) < it.r + 34 * sc) return it.id;
        }
        const L = lightOf(1, lightScale(Slice.clock.t));
        return Math.hypot(x - LP[0], y - LP[1]) < L.core * 3 + 10 * sc ? 'light' : null;
    }
    function setHover(id) {
        if (id === W.hover) return;
        W.hover = id; W.preview = null;
        Slice.emit('world:hover', { id: id === 'light' && !W.lightOpen ? null : id });
    }
    function pointer(type, e, x, y) {
        if (type === 'wheel') return false;
        if (!interactive() || type === 'leave') { if (W.hover) setHover(null); return false; }
        const hit = hitTest(x, y);
        if (type === 'move') { W.pointer = [x, y]; setHover(hit); return !!hit && !(hit === 'light' && !W.lightOpen); }
        if (type === 'down') {
            if (hit) { Slice.emit('world:click', { id: hit }); return true; }
            if (W.lock) { Slice.emit('world:click', { id: null }); return true; }
        }
        return false;
    }

    // ═══ 8. the module's life: init, resize, update, goto ═══
    function init() {
        injectStyle();
        note = mk('div', 'w-note'); note.hidden = true; title = mk('p', 'w-title'); title.hidden = true;
        wordsEl.append(note, title);
        const on = (name, fn) => Slice.on(name, p => fn(p || {}, Slice.clock.t));
        on('price:preview', p => { W.preview = p && p.id ? p : null; });
        on('route:go', (p, t) => {
            if (!p.id || W.sector !== 1) return;
            if (W.flight) { if (p.id !== W.flight.id) { startFlight(p.id, t); Slice.emit('flight:switched', { id: p.id }); } return; }
            W.lock = { id: p.id, t0: t };
            prebake(planFlight(W, p.id, t + 1000), t + 1000);
        });
        on('route:cancel', () => { W.lock = null; });
        on('route:fired', (p, t) => { W.flareT = t; if (!W.flight && p.id && W.sector === 1) startFlight(p.id, t); });
        on('dive:plated', p => { W.hidden = p.dir === 'in'; if (p.dir === 'in') W.pointer = null; });
        on('dive:back', () => { W.hidden = false; });
        on('stop:hidden', (p, t) => { W.hidden = false; leave(p.id || W.held, t); });
        on('jump:start', (p, t) => { W.jump = { t0: t, flashed: false }; W.hover = null; });
        on('sector:arrive', (p, t) => { if (p.n === 2) { W.sector = 2; W.black = false; W.jump = null; W.s2 = { t0: t }; } });
        Slice.anchors.set('ship', () => { if (!G) return []; const p = poseAt(Slice.clock.t), c = (x, y, side, align) => css(x, y, side, align); return [c(p.x - p.len / 2 - 6, p.y + p.len / 6 + 12, 'below'), c(p.x - p.len / 2 - 6, p.y - p.len / 6 - 12, 'above')]; });
        Slice.anchors.set('sky', () => { if (!G) return []; const p = poseAt(Slice.clock.t); return [css(p.x + p.len * 0.5, p.y - p.len * 1.3, 'above', 'center'), css(p.x + p.len * 0.9, p.y - p.len * 0.5, 'right')]; });
        Slice.anchors.set('light', () => { if (!G) return []; const L = lightOf(1, lightScale(Slice.clock.t)), gap = L.halo * 0.9 + 14; return [css(LP[0] - gap, LP[1] + gap * 0.6, 'left'), css(LP[0], LP[1] + gap * 1.2, 'below', 'center')]; });
        IDS.forEach(id => Slice.anchors.set('place:' + id, () => {
            if (!G) return []; const g = placeAt(id); if (!g.shown) return [];
            const gap = (id === 'kryos' ? 0 : g.r) + 8 * sc, list = [css(g.x + gap, g.y, 'right'), css(g.x - gap, g.y, 'left'), css(g.x, g.y - (id === 'kryos' ? g.r : 0) - gap, 'above', 'center'), css(g.x, g.y + gap, 'below', 'center')];
            return g.x > G.hull + spW() * 0.6 ? [list[1], list[0], list[2], list[3]] : list;
        }));
    }
    const css = (x, y, side, align) => { const [cx, cy] = G.toCss(x, y); return { x: cx, y: cy, side, align }; };
    function resize(g) {
        G = g; sc = G.H / 360;
        cv.width = G.W; cv.height = G.H; cv.style.width = (G.W * G.k / G.dpr) + 'px'; cv.style.height = (G.H * G.k / G.dpr) + 'px';
        computeRest(); clearSprites(); patCache.length = 0; shadeCache.clear(); darkArt = null;
        layerBack = P.pixelLayer(spW(), G.H); layerFront = P.pixelLayer(spW(), G.H);
        A1 = buildArt(1); A2 = null;
        if (W.held && W.held !== 'light') W = Object.assign({}, W, { cam: camFor(W.held, arriveFrame(W.held).x, arriveFrame(W.held).y, arriveFrame(W.held).r) });
        else if (!W.flight) W = Object.assign({}, W, { cam: stageCam(W.stage), ease: null });
    }
    function update(dt, t) {
        if (!G || !A1) return;
        if (W.pendingHover !== undefined) { const h = W.pendingHover; W.pendingHover = undefined; W.hover = null; setHover(h); }
        const s = speedNow(t);
        W.flow += s * dt / 1000; W.D = Math.min(9800, W.D + (W.flight ? DRATE.flight : DRATE.rest) * dt / 1000);
        if (W.flight && t - W.flight.t0 >= W.flight.dur) arrive(t);
        if (W.ease && t - W.ease.t0 >= W.ease.dur) W = Object.assign({}, W, { cam: W.ease.to, ease: null });
        const named = isNamed(); if (named && !W.namedSeen) { W.namedSeen = true; W.namedT = W.gotoT === t ? -1e9 : t; }
        W.lightOpen = W.lightOpen || W.visited.has('rhea') || !!(Slice.state.flags && Slice.state.flags.light);
        // the nose turns toward what we point at (6 degrees), banks toward where we fly
        const tgt = W.flight ? W.flight.id : W.lock ? W.lock.id : W.hover, sn = W.last, it = tgt && sn && sn.items.find(i => i.id === tgt && i.part !== 'arc');
        let wantB = 0;
        if (it || tgt === 'light') { const p = it || { x: LP[0], y: LP[1] }, da = Math.atan2(p.y - REST.lander.y, p.x - REST.lander.x) - baseAngle(), lim = (W.flight ? 10 : 6) * Math.PI / 180; wantB = Math.max(-lim, Math.min(lim, Math.atan2(Math.sin(da), Math.cos(da)))); }
        if (W.held) wantB = W.bank;
        W.bank += (wantB - W.bank) * Math.min(1, dt / 300);
        if (W.opening) { showTitle(DATA.SECTORS[1].title, t, W.opening.t0 + 900, 500, 2600, 600); if (!W.openDone && t - W.opening.t0 >= 4200) { W.openDone = true; Slice.emit('opening:done', {}); } if (t - W.opening.t0 > 5000) W.opening = null; }
        else if (W.s2) showTitle(DATA.SECTORS[2].title, t, W.s2.t0 + 600, 400, 2400, 600);
        else title.hidden = true;
        if (W.jump && !W.jump.flashed && t - W.jump.t0 >= 2650) { W.jump.flashed = true; W.black = true; Slice.emit('jump:flash', {}); }
        const f = W.flight;
        Slice.state.cam = { from: W.held || (W.stage ? 'stage' + W.stage : 'start'), to: f ? f.id : W.lock ? W.lock.id : null, e: f ? Math.round(flightE(f, t) * 1000) / 1000 : 1, stage: W.stage };
        if (W.hover && !interactive() && W.pendingHover === undefined) setHover(null);
        else if (W.ease && W.pointer && interactive() && W.pendingHover === undefined) setHover(hitTest(W.pointer[0], W.pointer[1]));   // the field slides under a still pointer   // integrator: a stop, the jump or a still never keeps a stale note
        updateNote(t);
        if (Slice.clock.playing && queue.size && dt > 0) bakeOne();
    }

    /** The world's half of each MOCKUP moment (SPEC §6.2). index.html calls this before script.goto writes the state, so the
        world keeps its own table; it reads the live state every frame after that (Rhea named, the light, prices, energy). */
    const AT_TITAN = { at: 'titan', gone: ['zeta'] };
    const MOMENTS = {
        open: { opening: true }, fork1: { hover: 'titan' }, flight1: { fly: 'titan' },
        dive: AT_TITAN, pick: AT_TITAN, torch: AT_TITAN, surge: AT_TITAN, stockpile: AT_TITAN, 'page-disc': AT_TITAN,
        bench: { stage: 1, gone: ['zeta'], passed: { titan: -8000 }, visited: ['titan'] },
        // a world we passed stays at the left edge in shadow; only the fork's other world, slipped behind the giant, is gone
        dating: { stage: 1, gone: ['zeta'], passed: { titan: -60000 }, visited: ['titan'] },
        signs: { stage: 1, gone: ['zeta'], passed: { titan: -60000 }, visited: ['titan'], named: true },
        fork2: { stage: 1, gone: ['zeta'], passed: { titan: -60000 }, visited: ['titan'], named: true, hover: 'erebus' },
        erebus: { at: 'erebus', gone: ['zeta'], passed: { titan: -90000, kryos: -9000 }, visited: ['titan'], named: true },
        reddeck: { stage: 2, gone: ['zeta'], passed: { titan: -120000, kryos: -60000, erebus: -9000 }, visited: ['titan', 'erebus'], named: true },
        kryos: { at: 'kryos', gone: ['zeta', 'erebus'], passed: { titan: -60000 }, visited: ['titan'], named: true },
        zeta: { at: 'zeta', gone: ['titan'] },
        rhea: { at: 'rhea', gone: ['zeta'], passed: { titan: -150000, kryos: -90000, erebus: -40000 }, visited: ['titan', 'erebus'], named: true },
        jump: { stage: 3, gone: ['zeta'], passed: { titan: -180000, kryos: -120000, erebus: -70000, rhea: -9000 }, visited: ['titan', 'erebus', 'rhea'], named: true, hover: 'light' },
        corridor: { black: true }, meal: { black: true }, s2: { s2: true },
    };
    MOMENTS.breach = MOMENTS.erebus; MOMENTS.call = MOMENTS.erebus;
    function goto(moment) {
        const M = MOMENTS[moment] || {}, t = Slice.clock.t;
        W = blank(); W.gotoT = t; noteRect = null;
        if (note) note.hidden = true;
        if (!G) return;
        const modes = Object.assign({}, W.modes);
        (M.gone || []).forEach(id => { modes[id] = { m: 'gone' }; });
        const stage = M.stage || (M.at ? Math.max(0, ORDER[M.at] - 1) : 0);
        W = Object.assign(W, { modes, stage, visited: new Set(M.visited || []), named: !!M.named, namedSeen: !!M.named, lightOpen: (M.visited || []).includes('rhea') });
        W.cam = M.at ? camFor(M.at, arriveFrame(M.at).x, arriveFrame(M.at).y, arriveFrame(M.at).r, [0, ((HIDE[M.at] && HIDE[M.at].lift) || 0) * G.H]) : stageCam(stage);
        if (M.at) W.held = M.at;
        Object.entries(M.passed || {}).forEach(([id, t0]) => {
            const from = M.visited && M.visited.includes(id) ? arriveFrame(id) : proj(id, stageCam(Math.max(0, ORDER[id] - 1)));
            W.modes = Object.assign({}, W.modes, { [id]: passedMode(id, t + t0, from, W.modes) });
        });
        if (M.opening) { W.opening = { t0: t }; W.openDone = false; }
        if (M.hover) W.pendingHover = M.hover;
        if (M.fly) startFlight(M.fly, t);
        if (M.black) W.black = true;
        if (M.s2) { W.sector = 2; W.s2 = { t0: t }; }
    }

    // ═══ 9. what the others ask for ═══
    function landerPose() { if (!G) return { x: 0, y: 0, len: 0, angle: 0 }; const p = poseAt(Slice.clock.t); return { x: p.x, y: p.y, len: p.len, angle: p.angle }; }
    function placeAt(id) {
        if (!G) return { x: 0, y: 0, r: 0, shown: false };
        if (id === 'light') { const L = lightOf(W.sector, W.sector === 1 ? lightScale(Slice.clock.t) : 1); return { x: LP[0], y: LP[1], r: L.core + L.halo, shown: !W.black }; }
        if (W.sector !== 1 || W.black) return { x: 0, y: 0, r: 0, shown: false };
        const sn = W.last || scene(W, Slice.clock.t), it = sn.items.find(i => i.id === id && i.part !== 'arc');
        return it ? { x: it.x, y: it.y, r: it.r, shown: !(it.hiding > 0.3) } : { x: 0, y: 0, r: 0, shown: false };
    }
    function discsOf(sn) { return sn.items.filter(i => i.part !== 'arc' && !(i.fade >= 1)).map(i => [i.x, i.y, i.kind === 'station' ? i.r * 1.1 : i.r + 3]); }
    function discs() { if (!G || W.sector !== 1 || W.black || W.hidden) return []; return discsOf(W.last || scene(W, Slice.clock.t)); }

    Slice.mods.world = { init, resize, update, render, pointer, goto, landerPose, placeAt, discs, FIELD };
})();
