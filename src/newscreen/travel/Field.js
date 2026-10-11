/* ═══ Silent Exodus · new screen (?new=1) · travel/Field.js: the field of worlds ahead, its camera and its moves ══════
   What it is: the real sector nodes (planned by NSRoute into bands, slots and forks: node.nsRoute) laid out as places in
   space ahead of us, the one pinhole camera that flies in among them, and the moves: a flight (the fork's other world
   slipping behind the giant's ring or limb, or passing), an arrival, leaving a world (it glides to the left edge and stays
   there in shadow), and the camera easing on to frame what is left. No drawing here: travel/Pictures.js draws what
   scene() returns, travel/Travel.js runs it.
   Source: prototypes/slice/world.js §1-3 (FIELD, HIDE, ARC_AT, ARRIVE, STAGES, proj, camFor, scene, planFlight, arrive,
   leave, passedMode), generalised from the slice's five fixed places to any planned sector (BUILD_A.md §5).

   THE CAMERA: one pinhole. A place at depth Z, at rest on screen at p, shows at
       light + (p - light) * m - c / (Z - C),  m = Z / (Z - C),  size times m.
   The light never moves. A flight eases the target's place and size to its arrival framing and solves C and c from it.

   window.NSField (frozen; one field: the travel view has one)
     setup(G)                       after every resize: rest places in art px
     build(nodes, sector)           → true if the field changed. nodes: the sector's planned nodes (each with nsRoute)
     ids() · entry(id) · light()    the entries ([id]), one entry, the light { x, y } and its node id in sector 6 (or null)
     blank(sector)                  a fresh world state W (Travel keeps it; every move returns a new W)
     sync(W, t)                     → W with every mode matched to the route's statuses (a load, a refusal undone)
     scene(W, t)                    → { cam, items, gs, e }: everything in the field now, back to front
     planFlight(W, id, t, slow)     → W flying to id (slow: engineering is down, a quarter longer)
     land(W)                        → W arrived (held = id)       leave(W, id, t) → W leaving id (it slides left)
     stageCam(at, modes)            the framing once band `at` is behind us; arriveCam(id)
     flightE(f, t) · passedGeom(md, t)
     discsOf(scene) → [[x, y, r]]   every round thing on screen (art px)
     nextBand(W) → the first band still ahead
   An entry: { id, node, slot, band, side, kind: 'world'|'station'|'giant'|'rocks'|'ghost', look, type, seed, Z, r, s,
               rides, onLimb, layer, story, beacon: [bx, by, period] | null, scenery, rim, reach (NSWorlds.reach: radii) }
*/
(function () {
    'use strict';
    const P = window.NSPaint;
    if (!P) return;
    const { clamp01, smooth, lerp } = P;

    // ═══ 1. the slots (BUILD_A.md §5): u, v on the space side, depth Z, size r (fraction of H). Tuned on screen: every world
    //    clear of the light's glare and of the giant, none touching, nearer bands bigger. ═══
    const SLOTS = {
        'fork1-top': { u: 0.36, v: 0.20, Z: 4, r: 0.05, s: 0.0026, side: 'top' },
        'fork1-bottom': { u: 0.28, v: 0.84, Z: 4, r: 0.07, side: 'bottom' },
        'fork2-giant': { u: 0.66, v: 0.74, Z: 22, r: 0.25, side: 'bottom', rides: true },
        'fork2-limb': { u: 0.78, v: 0.50, Z: 27, r: 0.035, side: 'top', rides: true, onLimb: true },
        'fork2-top': { u: 0.50, v: 0.40, Z: 14, r: 0.045, side: 'top' },
        // sectors 2-6: the first world alone, then one fork, then singles
        first: { u: 0.30, v: 0.72, Z: 4, r: 0.066, side: 'bottom' },
        'fork-top': { u: 0.40, v: 0.20, Z: 11, r: 0.05, s: 0.0024, side: 'top' },
        'fork-bottom': { u: 0.50, v: 0.62, Z: 11, r: 0.055, side: 'bottom' },
        'single-1': { u: 0.52, v: 0.30, Z: 30, r: 0.032, side: 'top' },
        'single-2': { u: 0.60, v: 0.12, Z: 33, r: 0.03, side: 'top' },
        'single-3': { u: 0.80, v: 0.16, Z: 35, r: 0.028, side: 'top' },
        'single-4': { u: 0.86, v: 0.66, Z: 31, r: 0.03, side: 'bottom' },
        'single-5': { u: 0.70, v: 0.90, Z: 34, r: 0.028, side: 'bottom' },
        'single-6': { u: 0.22, v: 0.34, Z: 36, r: 0.026, side: 'top' },
        'single-7': { u: 0.64, v: 0.46, Z: 38, r: 0.026, side: 'bottom' },
        story: { u: 0.72, v: 0.26, Z: 40, r: 0.022, side: 'top' },
    };
    const ALIAS = { 'band-1': 'first', band1: 'first', 'single-0': 'first', 'fork-giant': 'fork2-giant', 'fork-limb': 'fork2-limb' };
    /** A slot the table does not know (a ninth world, a late one): small and far, in the gaps between the table's places. */
    const SPARE = [[0.30, 0.08], [0.78, 0.80], [0.56, 0.78], [0.34, 0.46], [0.88, 0.08], [0.20, 0.88]];
    const arcSlot = i => { const [u, v] = SPARE[i % SPARE.length]; return { u, v, Z: 40 + i, r: 0.02, side: v < 0.5 ? 'top' : 'bottom' }; };
    const LIGHT_UV = { u: 0.93, v: 0.40 }, LANDER = { u: 0.12, v: 0.58, len: 0.085 };

    /** How the fork's other world goes out of sight, by the slot we fly to. arc: behind the ring's near arc where it crosses the
        giant's limb; body: the limb grows over it; pass: it slides past on the left and greys. Z: its depth on that path. */
    const HIDE = {
        'fork1-bottom': { who: ['fork1-top'], by: 'arc', Z: 27, lift: -0.03 },
        'fork1-top': { who: ['fork1-bottom'], by: 'arc', Z: 27, lift: 0.12 },
        'fork2-giant': { who: ['fork2-limb'], by: 'body', Z: 27 },
        'fork2-top': { who: ['fork2-limb'], by: 'body', Z: 27 },
    };
    const ARC_AT = { phi: Math.PI - 0.5, rho: 1.58, shrink: 0.32 };
    const ARRIVE = { 'fork2-giant': { u: 0.5, v: 0.6, r: 0.37 }, 'fork1-bottom': { u: 0.44, v: 0.58, r: 0.27 }, first: { u: 0.46, v: 0.56, r: 0.27 } };
    const FLY = { next: 7000, far: 9000, slow: 1.25 }, PASS = { move: 4000 }, REFRAME = 4000;
    const ease = s => (s < 0.5 ? 4 * s * s * s : 1 - Math.pow(-2 * s + 2, 3) / 2);
    const stepE = e => Math.min(1, Math.floor(e * 8) / 7);
    const K0 = [0, 0];

    // the real type → one of the five planet recipes, and a rim for the living worlds (slice world.js RIM: Erebus's teal)
    const LOOK = {
        DESERT: 'desert', SULFUR: 'desert', VOLCANIC: 'desert', TIDALLY_LOCKED: 'desert', RADIATION_BELT: 'desert',
        GAS_GIANT: 'gas', STORM_WORLD: 'gas',
        ICE_WORLD: 'ice', FROZEN_OCEAN: 'ice', OCEANIC: 'ice', CRYSTALLINE: 'ice', MIRROR: 'ice', EDEN: 'ice', VITAL: 'ice', TERRAFORMED: 'ice', SYMBIOTE_WORLD: 'ice', SINGING: 'ice',
        ROCKY: 'rock', SHATTERED: 'rock', MECHA: 'rock', GRAVEYARD: 'rock', TOMB_WORLD: 'rock', HOLLOW: 'rock', MACHINE_WORLD: 'rock',
        ROGUE: 'dark', GHOST_WORLD: 'dark', CARBON: 'dark', TOXIC: 'dark', BIO_MASS: 'dark', FUNGAL: 'dark',
    };
    const RIM = { VITAL: 'teal', EDEN: 'teal', TERRAFORMED: 'teal', SYMBIOTE_WORLD: 'teal', OCEANIC: 'teal', FUNGAL: 'teal', BIO_MASS: 'teal',
        DESERT: 'dust', SULFUR: 'dust', VOLCANIC: 'dust', RADIATION_BELT: 'dust' };
    function hashId(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }

    // ═══ 2. state of the one field ═══
    let G = null, sc = 1, LP = [0, 0], REST = {}, E = new Map(), IDS = [], lightNode = null, sector = 1, key = '';
    const spW = () => G.W - G.hull, ax = u => G.hull + u * spW(), ay = v => v * G.H;

    function setup(g) { G = g; sc = G.H / 360; computeRest(); }
    function computeRest() {
        if (!G) return;
        REST = {}; LP = [ax(LIGHT_UV.u), ay(LIGHT_UV.v)];
        IDS.forEach(id => { const e = E.get(id); REST[id] = { x: ax(e.u), y: ay(e.v), r: e.kind === 'station' ? 24 * e.s * G.H : e.r * G.H }; });
        const giant = IDS.find(id => E.get(id).kind === 'giant');
        IDS.forEach(id => {                                                          // a world on the giant's upper limb, top half showing
            const e = E.get(id); if (!e.onLimb || !giant) return;
            const k = REST[giant], p = REST[id], d = Math.hypot(p.x - k.x, p.y - k.y) || 1, out = k.r + 0.6 * p.r;
            p.x = k.x + (p.x - k.x) / d * out; p.y = k.y + (p.y - k.y) / d * out;
        });
        REST.lander = { x: ax(LANDER.u), y: ay(LANDER.v), len: Math.round(LANDER.len * G.H) };
    }

    function kindOf(node, slot) {
        if (slot === 'fork2-giant') return 'giant';
        if (node.isStation) return 'station';
        if (node.isAsteroidField) return 'rocks';
        if (node.ghost) return 'ghost';
        return 'world';
    }
    /** The field from the planned nodes. Kept when nothing changed (same ids, slots and bands). */
    function build(nodes, n) {
        const list = (nodes || []).filter(nd => nd && nd.nsRoute && nd.nsRoute.slot);
        const k = n + '|' + list.map(nd => nd.id + ':' + nd.nsRoute.slot + ':' + nd.nsRoute.band).join(',');
        if (k === key) return false;
        key = k; sector = n; E = new Map(); IDS = []; lightNode = null;
        let arcI = 0, fork2Band = 0;
        list.forEach(nd => {
            const R = nd.nsRoute, slot = ALIAS[R.slot] || R.slot;
            if (slot === 'light') { lightNode = nd.id; return; }
            if (/^fork2/.test(slot)) fork2Band = R.band;
            const S = SLOTS[slot] || arcSlot(arcI++), kind = kindOf(nd, slot), h = hashId(nd.id), tags = nd.tags || [];
            const wreck = !!(nd.isFirstSignal || tags.includes('EXODUS_WRECK') || nd.isStoryPlanet);
            const e = { id: nd.id, node: nd, slot, band: R.band || 1, side: S.side, kind, type: nd.type, look: LOOK[nd.type] || 'rock', rim: RIM[nd.type] || null,
                seed: 1 + (h % 997), Z: S.Z, u: S.u, v: S.v, r: kind === 'rocks' ? S.r * 0.9 : S.r, s: S.s || S.r / 24, rides: !!S.rides, onLimb: !!S.onLimb,
                story: !!nd.isStoryPlanet, scenery: false,
                beacon: wreck ? [-0.6 + 0.3 * ((h >> 8) % 5) / 4, -0.5 + ((h >> 12) % 7) / 10, 1500 + (h >> 4) % 900] : null };
            if (kind === 'station' && !S.s) e.s = S.r / 24;
            e.reach = (kind === 'world' || kind === 'ghost') && window.NSWorlds ? window.NSWorlds.reach(nd, n, nd.type) : 1;   // rings and moons stay inside the picture
            E.set(e.id, e); IDS.push(e.id);
        });
        if (n === 1 && !IDS.some(id => E.get(id).kind === 'giant')) {      // sector 1 without a gas giant: the giant is scenery only
            const S = SLOTS['fork2-giant'];
            E.set('giant', { id: 'giant', node: null, slot: 'fork2-giant', band: fork2Band || 2, side: 'bottom', kind: 'giant', type: 'GAS_GIANT', look: 'gas', seed: 1,
                Z: S.Z, u: S.u, v: S.v, r: S.r, s: 0, rides: true, onLimb: false, story: false, scenery: true, beacon: null });
            IDS.unshift('giant');
        }
        IDS.forEach(id => { const e = E.get(id); e.layer = e.kind === 'giant' ? 3 : e.onLimb ? 1 : e.Z < 22 ? 5 + (22 - e.Z) / 100 : 2 - e.Z / 100; });
        computeRest();
        return true;
    }

    // ═══ 3. geometry ═══
    function proj(id, cam, Z) {
        const e = E.get(id); Z = Z || e.Z; const d = Z - cam.C; if (d < 0.25) return null;
        const m = Z / d, p = REST[id], k = e.rides && cam.k ? cam.k : K0;
        return { x: LP[0] + (p.x - LP[0]) * m - cam.c[0] / d + k[0], y: LP[1] + (p.y - LP[1]) * m - cam.c[1] / d + k[1], m, r: p.r * m };
    }
    function camFor(id, x, y, r, k) {
        k = k || K0; const e = E.get(id); if (e.rides) { x -= k[0]; y -= k[1]; }
        const Z = e.Z, p = REST[id], m = Math.max(1, r / p.r), C = Z * (1 - 1 / m), d = Z - C;
        return { C, c: [((p.x - LP[0]) * m + LP[0] - x) * d, ((p.y - LP[1]) * m + LP[1] - y) * d], k };
    }
    const mixCam = (a, b, e) => { const ka = a.k || K0, kb = b.k || K0; return { C: lerp(a.C, b.C, e), c: [lerp(a.c[0], b.c[0], e), lerp(a.c[1], b.c[1], e)], k: [lerp(ka[0], kb[0], e), lerp(ka[1], kb[1], e)] }; };
    const IDENT = { C: 0, c: [0, 0], k: K0 };
    /** Once band `at` is behind us: push in on the next band (the slice's STAGES, generalised). The light never moves. */
    function stageCam(at, modes) {
        if (!G || !at) return IDENT;
        const ahead = IDS.filter(id => { const md = modes && modes[id]; return E.get(id).band > at && (!md || md.m === 'field'); });
        if (!ahead.length) return IDENT;
        const nb = Math.min(...ahead.map(id => E.get(id).band)), band = ahead.filter(id => E.get(id).band === nb);
        const ref = band.slice().sort((a, b) => REST[b].r - REST[a].r)[0], e = E.get(ref), minZ = Math.min(...ahead.map(id => E.get(id).Z));
        let m = e.kind === 'giant' ? 1.12 : e.story ? 1.8 : Math.min(1.8, 1.2 + 0.15 * at);
        const mMax = 1 / Math.max(0.05, 1 - Math.max(0, minZ - 3) / e.Z);                    // C stays 3 short of the nearest world ahead
        m = Math.max(1, Math.min(m, mMax));
        const p = REST[ref], tx = lerp(p.x, ax(0.6), e.kind === 'giant' ? 0.12 : 0.3), ty = lerp(p.y, ay(0.42), e.kind === 'giant' ? 0.3 : 0.3);
        return camFor(ref, tx, ty, p.r * m);
    }
    function arriveFrame(id) { const e = E.get(id), A = (e && ARRIVE[e.slot]) || { u: 0.55, v: 0.5, r: 0.3 }; return { x: ax(A.u), y: ay(A.v), r: (e && e.kind === 'station' ? 0.22 : A.r) * G.H }; }
    function arriveCam(id) { const A = arriveFrame(id), e = E.get(id), h = e && HIDE[e.slot]; return camFor(id, A.x, A.y, A.r, [0, ((h && h.lift) || 0) * G.H]); }
    const flightE = (f, t) => clamp01((t - f.t0) / f.dur);
    function flightCam(f, e) {
        if (f.light) return f.cam0;
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

    // ── a world we pass glides to the left edge and stays there in shadow (top ones high, bottom ones low, in rows of three);
    //    the giant settles low in the corner with its ring across it ──
    function passedMode(id, t, g0, modes) {
        const e = E.get(id), giant = e.kind === 'giant', H = G.H;
        const busy = IDS.filter(o => o !== id && modes[o] && modes[o].m === 'passed' && E.get(o).kind !== 'giant' && E.get(o).side === e.side).length;
        const rp = giant ? REST[id].r * 0.95 : Math.max(0.026 * H, Math.min(REST[id].r * 0.62, g0.r)), col = busy % 3, row = Math.floor(busy / 3), reach = Math.min(1.8, e.reach || 1), step = rp * 2.4 + 8;
        const xr = giant ? G.hull + 0.16 * spW() : G.hull + rp * reach + 0.035 * spW() + col * (rp * 1.3 * (1 + reach) + 10);
        const yr = giant ? H + rp * 0.1 : e.side === 'top' ? Math.max(rp + 0.05 * H, 0.14 * H) + row * step : Math.min(H - rp - 0.08 * H, 0.76 * H) - row * step;
        return { m: 'passed', t0: t, g0: { x: g0.x, y: g0.y, r: g0.r }, rp, xr, yr };
    }
    function passedGeom(md, t) {
        const s = t - md.t0, k = clamp01(s / PASS.move), e = ease(k), eq = ease(stepE(k));
        return { x: lerp(md.g0.x, md.xr, e), y: lerp(md.g0.y, md.yr, e), r: Math.max(2, Math.round(md.g0.r * Math.pow(md.rp / md.g0.r, eq))), grey: Math.min(1, Math.floor(clamp01(s / 1600) * 8) / 8) };
    }

    // ═══ 4. the world state and the scene ═══
    function blank(n) {
        return { sector: n, at: 0, cam: IDENT, modes: Object.fromEntries(IDS.map(id => [id, { m: 'field' }])), flight: null, ease: null, held: null, lock: null,
            hover: null, visited: new Set(), opening: null, jump: null, black: false, D: 0, flow: 0, flareT: -1e9, bank: 0, pointer: null, last: null, before: null };
    }
    const GHOST_FADE = [0, 0, 0.125, 0.375, 0.625, 0.75, 0.5, 0.25], GHOST_SLOW = [0, 0, 0, 0.125, 0.25, 0.375, 0.25, 0.125];
    function scene(St, t) {
        const cam = camAt(St, t), camQ = camAt(St, t, true), items = [], f = St.flight, e = f ? flightE(f, t) : 1;
        let gs = null;
        IDS.forEach(id => {                                                         // the giant first: the others hide behind it
            const en = E.get(id); if (en.kind !== 'giant') return;
            const md = St.modes[id] || { m: 'field' };
            if (md.m === 'passed') { items.push(Object.assign({ id, kind: 'giant', part: 'all', layer: 5.9, passed: true, clickable: !en.scenery }, passedGeom(md, t))); return; }
            if (md.m === 'gone') return;
            const p = proj(id, cam), q = proj(id, camQ); if (!p || !q) return;
            gs = { x: p.x, y: p.y, r: q.r };
            const base = { id, kind: 'giant', x: p.x, y: p.y, r: Math.round(q.r), m: q.m, grey: 0, clickable: !en.scenery };
            items.push(Object.assign({ part: 'body', layer: 3 }, base), Object.assign({ part: 'arc', layer: 4, hitless: true }, base));
        });
        IDS.forEach(id => {
            const en = E.get(id); if (en.kind === 'giant') return;
            const md = St.modes[id] || { m: 'field' };
            if (md.m === 'gone') return;
            if (md.m === 'passed') { items.push(Object.assign({ id, kind: en.kind, layer: 6 + md.t0 * 1e-9, passed: true, clickable: true }, passedGeom(md, t))); return; }
            const hiding = md.m === 'hiding' && f && gs, Z = hiding ? md.Z : null, p = proj(id, cam, Z), q = proj(id, camQ, Z);
            if (!p || !q) return;
            const it = { id, kind: en.kind, x: p.x, y: p.y, r: Math.max(2, Math.round(q.r)), m: q.m, grey: 0, layer: en.layer, clickable: true };
            if (hiding) {
                const w = smooth(0.04, 0.5, e), wq = smooth(0.04, 0.5, stepE(e)), off = md.off || [0, 0];
                const pt = md.by === 'arc' ? arcPt(gs, ARC_AT.phi, ARC_AT.rho) : (() => { const dx = p.x - gs.x, dy = p.y - gs.y, d = Math.hypot(dx, dy) || 1; return [gs.x + dx / d * gs.r * 0.62, gs.y + dy / d * gs.r * 0.62]; })();
                Object.assign(it, { x: lerp(p.x + off[0], pt[0], w), y: lerp(p.y + off[1], pt[1], w), r: Math.max(2, Math.round(q.r * (md.rk || 1) * lerp(1, md.by === 'arc' ? ARC_AT.shrink : 0.8, wq))),
                    layer: md.by === 'arc' ? 2 : 1, cut: md.by === 'arc' ? gs : null, fade: Math.floor(smooth(0.6, 0.72, e) * 8) / 8, clickable: w < 0.3, hiding: w });
                if (it.fade >= 1) return;
            } else if (md.m === 'hiding') return;
            if (md.m === 'fading') { it.fade = Math.min(1, Math.floor(clamp01((t - md.t0) / 1200) * 8) / 8); it.clickable = false; if (it.fade >= 1) return; }
            else if (en.kind === 'ghost') it.fade = GHOST_FADE[Math.floor(t / 420) % 8];
            else if (en.type === 'GHOST_WORLD') it.fade = GHOST_SLOW[Math.floor(t / 700) % 8];   // a ghost world dithers in and out, gently
            items.push(it);
        });
        items.sort((a, b) => a.layer - b.layer);
        return { cam, items, gs, e };
    }

    // ═══ 5. the moves ═══
    function nextBand(St) { const b = IDS.filter(id => E.get(id).band > St.at && (St.modes[id] || {}).m === 'field').map(id => E.get(id).band); return b.length ? Math.min(...b) : St.at + 1; }
    function drawnAt(now, cam, o) { const it = now.items.find(i => i.id === o && i.part !== 'arc'), p = proj(o, cam); return it ? { x: it.x, y: it.y, r: it.passed ? it.r : (p ? p.r : it.r) } : p; }
    /** id: an entry, or the light node (sector 6: the light is the STRUCTURE node; every world passes). */
    function planFlight(St, id, t, slow) {
        const now = scene(St, t), cam = now.cam, modes = Object.assign({}, St.modes), light = id === lightNode, T = E.get(id);
        const band = light ? Infinity : T.band, hide = !light && HIDE[T.slot], next = nextBand(St);
        IDS.forEach(o => {
            const md = modes[o]; if (o === id || !md || (md.m !== 'field' && md.m !== 'hiding')) return;
            const g = drawnAt(now, cam, o); if (!g) { modes[o] = { m: 'gone' }; return; }
            const en = E.get(o);
            if (hide && now.gs && en.band === band && hide.who.includes(en.slot)) {
                const p = proj(o, cam, hide.Z) || g;
                modes[o] = { m: 'hiding', by: hide.by, Z: hide.Z, off: [g.x - p.x, g.y - p.y], rk: g.r / (p.r || g.r) };
            } else if (en.band <= band) modes[o] = passedMode(o, t, g, modes);
            else modes[o] = { m: 'field' };
        });
        if (!light) modes[id] = { m: 'field' };
        const g0 = light ? null : drawnAt(now, cam, id), dur = (light || band > next ? FLY.far : FLY.next) * (slow ? FLY.slow : 1);
        return Object.assign({}, St, { modes, cam, ease: null, held: null, lock: null, before: St.before || St,
            flight: { id, light, t0: t, dur, g0, to: light ? null : arriveFrame(id), cam0: cam, lift: [0, ((hide && hide.lift) || 0) * G.H] } });
    }
    function land(St) {
        const f = St.flight, modes = Object.assign({}, St.modes);
        IDS.forEach(o => { if (modes[o].m === 'hiding') modes[o] = { m: 'gone' }; });
        return Object.assign({}, St, { cam: flightCam(f, 1), flight: null, held: f.id, modes });
    }
    function leave(St, id, t) {
        if (!E.has(id)) return Object.assign({}, St, { held: null, before: null });
        const now = scene(St, t), it = now.items.find(i => i.id === id && i.part !== 'arc'), p = proj(id, now.cam), modes = Object.assign({}, St.modes);
        if (it || p) modes[id] = passedMode(id, t, it ? { x: it.x, y: it.y, r: p ? p.r : it.r } : p, modes); else modes[id] = { m: 'gone' };
        const at = Math.max(St.at, E.get(id).band), visited = new Set(St.visited).add(id);
        IDS.forEach(o => { const en = E.get(o); if (en.scenery && en.band <= at && modes[o].m === 'field') { const q = proj(o, now.cam); modes[o] = q ? passedMode(o, t, q, modes) : { m: 'gone' }; } });
        return Object.assign({}, St, { modes, at, visited, held: null, before: null, ease: { t0: t, dur: REFRAME, from: now.cam, to: stageCam(at, modes), vp: it ? [it.x, it.y] : LP } });
    }
    /** Every mode matched to the route (a load, a sector we come back to): visited and passed at the left edge, gone gone. */
    function sync(St, t) {
        const modes = Object.assign({}, St.modes);
        let at = St.at, changed = false;
        IDS.forEach(id => { const en = E.get(id); if (en.node && en.node.nsRoute && en.node.nsRoute.status === 'visited') at = Math.max(at, en.band); });
        IDS.forEach(id => {
            if (id === St.held || (St.flight && St.flight.id === id)) return;           // where we are, or are flying to: its own moves
            const en = E.get(id), md = modes[id] || { m: 'field' }, st = en.node ? (en.node.nsRoute || {}).status : (en.band <= at ? 'passed' : 'ahead');
            let want = md;
            if ((st === 'gone') && md.m !== 'gone' && md.m !== 'hiding') want = { m: 'gone' };
            else if ((st === 'passed' || st === 'visited') && (md.m === 'field' || md.m === 'gone' && en.node && st === 'visited')) {
                const q = proj(id, IDENT) || { x: REST[id].x, y: REST[id].y, r: REST[id].r };
                want = Object.assign(passedMode(id, t, q, modes), { t0: t - 1e6 });
            } else if (st === 'ahead' && (md.m === 'passed' || md.m === 'gone') && !St.flight) want = { m: 'field' };
            else if (!modes[id]) want = { m: 'field' };
            if (want !== md) { modes[id] = want; changed = true; }
        });
        Object.keys(modes).forEach(id => { if (!E.has(id)) { delete modes[id]; changed = true; } });
        if (!changed && at === St.at) return St;
        const visited = new Set(St.visited); IDS.forEach(id => { const en = E.get(id); if (en.node && en.node.nsRoute && en.node.nsRoute.status === 'visited') visited.add(id); });
        const out = Object.assign({}, St, { modes, at, visited });
        if (!St.flight && !St.held && !St.ease) out.cam = stageCam(at, modes);
        return out;
    }
    function discsOf(sn) { return sn.items.filter(i => i.part !== 'arc' && !(i.fade >= 1)).map(i => [i.x, i.y, i.kind === 'station' ? i.r * 1.1 : i.r * ((E.get(i.id) || {}).reach || 1) + 3]); }

    window.NSField = Object.freeze({
        SLOTS, setup, build, blank, sync, scene, planFlight, land, leave, stageCam, arriveCam, arriveFrame, flightE, passedGeom, discsOf, nextBand, behindGiant, mixCam,
        ids: () => IDS.slice(), entry: id => E.get(id) || null, has: id => E.has(id), light: () => ({ x: LP[0], y: LP[1], node: lightNode }),
        rest: id => REST[id] || null, lander: () => REST.lander, sector: () => sector, reset: () => { key = ''; },
        geom: () => ({ G, sc, LP, spW: G ? spW() : 0, ax, ay }),
    });
})();
