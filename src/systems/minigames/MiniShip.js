/* MiniShip — our ship for the minigames: the Lander, as the travel view and the living ship draw it (2026-10-11; before that
   it was the old EXODUS-9 cutaway with a FABRICATION deck, which is gone). Needs art/MiniPaint.js (the travel view's recipes).

   THE CUTAWAY (the ship's decks, nose up, as a small map):
     const L = MiniShip.layout(x, top, width, height, order)   → rooms with unit bounds, halfWidth(y), roomAt(x, y), room(key), floor(key, slot)
     MiniShip.draw(ctx, L, t, { damaged: { cargo: true }, dim: { lab: 0.5 }, labels: true, plume: 0..1 })
   The Lander: a nose cone with the bridge's ring of windows, six decks under it (a ladder down the left, two lamps in
   every ceiling, a porthole on the right), the skirt, the folded legs and the engine bell; the reactor in engineering
   breathes ice-blue and the drive's plume is the same blue. A damaged deck turns emergency red; dim darkens a deck
   (1 = black: no power, no air). It fits the box keeping the Lander's proportions (about a third as wide as it is tall).
   order: the deck keys top to bottom. Default MiniShip.ROOMS order (the old one, so code that indexes L.rooms keeps
   working); pass MiniShip.LANDER_ORDER for the real Lander's order (bridge, lab, quarters, med bay, hold, engineering).
   The six keys are the game's shipDecks keys; 'upgrades' (the old fabrication deck) is drawn as the Lander's MED BAY.

   OUR LANDER FROM OUTSIDE (the travel view's hull, MiniPaint.hull + shapeL):
     const s = MiniShip.lander(ctx, { x, y, len, angle, flip, anchor, view: 'side' | 'top', legs: 'folded' | 'down',
                                      ramp, light, rust, holes, from, to, seed, sunDir, plume, t })
       x, y, len in units; angle in radians: 0 lies it nose LEFT, bell right (flip: nose right); Math.PI / 2 stands it nose
       up (with legs: 'down' and anchor: 1.1 its pads are on (x, y)); anchor 0..1 along the hull
       (0 nose, 1 the bell's mouth) sits at (x, y), default 0.5; view 'top' is seen from above (lit down the spine);
       legs 'down' for standing on the ground; ramp: a MiniPaint ramp or its name ('HULL' default, 'RUST' / 'WRUST' for a wreck);
       light 0..1 dims it; rust/holes/from/to/seed as the travel view's wrecks;
       sunDir [x, y] gives it a warm rim on that side; plume 0..1 lights the drive (t, ms, flickers it).
       Painted once per look and cached. Returns { at(u, v) → [x, y] in units } to hang things on it (u along, v across, -0.5..0.5).

   PEOPLE: MiniShip.figure(ctx, feetX, feetY, who, isStepping, isLying) draws a crew member nine units tall in ship
   clothes (MiniCrew.small). who: an id ('you', 'jaxon' …), a name, or an old MiniShip.CREW colour.
   MiniShip.CREW → { you, jaxon, aris, vance, mira } with id, name, role, color (their voice tone) and station room. */

(function () {
    'use strict';
    const MiniLab = window.MiniLab;
    if (!MiniLab) return;
    const P = () => window.MiniPaint;

    const ROOMS = [
        { key: 'bridge', label: 'BRIDGE' }, { key: 'lab', label: 'LAB' }, { key: 'quarters', label: 'QUARTERS' },
        { key: 'cargo', label: 'HOLD' }, { key: 'engineering', label: 'ENGINEERING' }, { key: 'upgrades', label: 'MED BAY' },
    ];
    const LANDER_ORDER = ['bridge', 'lab', 'quarters', 'upgrades', 'cargo', 'engineering'];
    const LANDER_ROOMS = LANDER_ORDER.map(k => ROOMS.find(r => r.key === k));
    const TONE = (window.MiniCrew && window.MiniCrew.TONE) || { cora: '#f2e2c4', jaxon: '#f08c2e', aris: '#ffc27a', vance: '#c4622a', mira: '#e8836a' };
    const CREW = {
        you: { id: 'cora', name: 'You', role: 'COMMANDER', color: TONE.cora, station: 'bridge' },
        aris: { id: 'aris', name: 'Aris', role: 'DOCTOR', color: TONE.aris, station: 'upgrades' },
        mira: { id: 'mira', name: 'Mira', role: 'SCIENTIST', color: TONE.mira, station: 'lab' },
        vance: { id: 'vance', name: 'Vance', role: 'SECURITY', color: TONE.vance, station: 'cargo' },
        jaxon: { id: 'jaxon', name: 'Jaxon', role: 'ENGINEER', color: TONE.jaxon, station: 'engineering' },
    };
    const ASPECT = 0.31;                          // the Lander's diameter over its length (600 over 1938 rows)
    const NOSE = 0.215, SKIRT = 0.86;             // MiniPaint.LANDER's, so the profile is the travel view's
    const DECK_U = i => NOSE + i * (SKIRT - NOSE) / 6;
    const BEAT_MS = 4000;                         // the reactor's slow breath

    // the living ship's interior ramps (src/newscreen/ship/ShipArt.js R), from the ink
    const INK = '#05070a';
    const mk = (...hex) => P() ? P().ramp(INK, ...hex) : null;
    let R = null;
    function ramps() {
        if (R || !P()) return R;
        R = {
            WALL: mk('#090e12', '#0e151a', '#131c22', '#19252c', '#213038', '#2c3e47', '#3c525c', '#566e78'),
            WARM: mk('#0e0c0a', '#16120e', '#211a13', '#2e2419', '#3f3121', '#57432c', '#76593a'),
            REDW: mk('#140909', '#1f0d0c', '#2c1210', '#3d1814', '#56201a', '#7a2c22'),
            STEEL: mk('#0d1317', '#151e24', '#1e2a31', '#29373f', '#37474f', '#4b5d66', '#677a82', '#8c9ea4'),
            SCR: mk('#0b2a30', '#11505a', '#1e8c96', '#58d6dc', '#b8f6f4'),
            CRATE: mk('#111715', '#1b2420', '#27322d', '#36433d', '#4c5b54', '#6c7d74'),
            LINEN: mk('#1e2226', '#363c40', '#565d60', '#7f8584', '#a9ada6', '#cfd0c6'),
            MED: mk('#141c1e', '#26333a', '#40525a', '#65797f', '#93a8aa', '#c3d3d0', '#e4eeea'),
            GLASS: mk('#0c201d', '#163830', '#24584a', '#3f8a72', '#7cc4a6'),
            PAPER: mk('#1f1d19', '#38342b', '#5a5442', '#827a60', '#aaa082', '#cbc2a2'),
        };
        return R;
    }

    // ── the cutaway's geometry, in units ──
    function layout(x, top, width, height, order) {
        const keys = Array.isArray(order) && order.length === 6 ? order : ROOMS.map(r => r.key);
        const list = keys.map(k => ROOMS.find(r => r.key === k)).filter(Boolean);
        const D = Math.max(6, Math.min(width - 2, height * ASPECT)), cx = x + width / 2;
        const rooms = list.map((r, i) => ({ ...r, top: Math.round(top + height * DECK_U(i)), bottom: Math.round(top + height * DECK_U(i + 1)) }));
        const L = { x, top, width, height, cx, D, maxHalf: D / 2, rooms, order: keys.slice(), cache: null, cacheKey: '' };
        L.halfWidth = yy => halfWidth(L, yy);
        L.roomAt = (px, py) => {
            if (Math.abs(px - cx) > halfWidth(L, py)) return null;
            if (py >= top && py < rooms[0].top) return rooms[0];                     // the nose cone is the bridge's dome
            return rooms.find(r => py >= r.top && py < r.bottom) || null;
        };
        L.room = key => rooms.find(r => r.key === key);
        /** A standing spot on a deck's floor: slot 0..1 across the deck. */
        L.floor = (key, slot = 0.5) => {
            const r = L.room(key), hw = Math.max(2, halfWidth(L, r.bottom - 1) - 2), slab = Math.max(1, Math.round((r.bottom - r.top) * 0.1));
            return { x: Math.round(cx - hw + 2 + slot * (hw * 2 - 4)), y: r.bottom - slab };
        };
        return L;
    }
    /** Half the hull's width at row y (units): the nose cone, the decks, the skirt, the bell; 0 outside. */
    function halfWidth(L, y) {
        const u = (y - L.top) / L.height;
        if (u < 0 || u > 1) return 0;
        const r = P() ? P().radiusL(u) : (u < NOSE ? 0.5 * Math.sqrt(u / NOSE) : u < 0.94 ? 0.5 : 0.13);
        return Math.max(0, r) * L.D;
    }

    // ── the cutaway, painted once per look into art pixels ──
    const WALL_K = 0.045;                         // the cut hull wall, a share of the diameter
    function paintCutaway(L, d, damaged) {
        const N = P(), Rm = ramps(), RP = N.RP;
        const cx = L.cx * d, top = L.top * d, len = L.height * d, D = L.D * d;
        const bx0 = Math.floor(cx - D * 0.75), by0 = Math.floor(top) - 1, bw = Math.ceil(D * 1.5) + 2, bh = Math.ceil(len) + 3;
        const p = N.painter(bw, bh, false), shape = { len, ht: D }, wall = Math.max(1, Math.round(D * WALL_K)) / D;
        const decks = L.rooms.map((r, i) => ({ key: r.key, top: top + len * DECK_U(i), bottom: top + len * DECK_U(i + 1), hurt: !!damaged[r.key] }));
        const fx = [];                            // where the moving layer lights things: lamps, the reactor's core
        for (let Y = 0; Y < bh; Y++) for (let X = 0; X < bw; X++) {
            const wx = bx0 + X + 0.5, wy = by0 + Y + 0.5, u = (wy - top) / len, v = -(wx - cx) / D, r = N.radiusL(u);
            if (r < 0) continue;
            const inCyl = u >= NOSE && u < SKIRT;
            if (!inCyl || Math.abs(v) > r) {                                              // outside: the travel view's hull
                const l = N.shapeL(u, v, shape);
                if (l >= 0) p.solid(X, Y, RP.HULL, l * 0.85);
                continue;
            }
            if (Math.abs(v) > r - wall) { p.solid(X, Y, Rm.STEEL, Math.abs(v) > r - 0.6 / D ? (v < 0 ? 0.78 : 0.42) : 0.3); continue; }   // the cut wall
            const i = Math.min(5, Math.max(0, Math.floor((u - NOSE) / ((SKIRT - NOSE) / 6)))), dk = decks[i];
            const iw = 2 * (r - wall) * D, lx = wx - (cx - iw / 2), ly = wy - dk.top, dh = dk.bottom - dk.top;
            const slab = Math.max(1, Math.round(dh * 0.11)), fh = dh - slab;
            if (ly >= fh) { p.solid(X, Y, Rm.STEEL, ly < fh + 1 ? 0.62 : 0.26); continue; }                 // the floor slab
            const thing = furniture(dk.key, lx, ly, iw, fh, Rm, dk.hurt);
            if (thing) { p.solid(X, Y, thing[0], thing[1]); continue; }
            const lamps = [iw * 0.3, iw * 0.72], glow = lamps.reduce((s, ax) => s + Math.exp(-Math.hypot(lx - ax, ly * 1.3) / (fh * 0.75)), 0);
            const tone = 0.13 + 0.3 * Math.min(1, glow) + (N.fbm(wx / 5, wy / 4, 3, 2) - 0.5) * 0.08;
            const lit = glow * 0.8 > N.threshold(Math.floor(wx), Math.floor(wy));
            p.solid(X, Y, dk.hurt ? Rm.REDW : lit ? Rm.WARM : Rm.WALL, tone);
        }
        decks.forEach(dk => {                                                         // lamp fixtures, the reactor, the labels' places
            const r = 0.5 - wall, iw = 2 * r * D, x0 = cx - iw / 2, slab = Math.max(1, Math.round((dk.bottom - dk.top) * 0.11)), fh = dk.bottom - dk.top - slab;
            [0.3, 0.72].forEach(k => fx.push({ kind: 'lamp', x: x0 + iw * k - bx0, y: dk.top - by0 + 0.5, hurt: dk.hurt, deck: dk.key }));
            if (dk.key === 'engineering') fx.push({ kind: 'core', x: x0 + iw * 0.5 - bx0, y: dk.top + fh * 0.5 - by0, r: Math.max(2, Math.min(iw * 0.16, fh * 0.32)), hurt: dk.hurt });
            dk.x0 = x0 - bx0; dk.iw = iw; dk.fh = fh; dk.y0 = dk.top - by0;
        });
        return { canvas: p.canvas(), bx0, by0, fx, decks, bell: { x: cx - bx0, y: top + len - by0 } };
    }

    /** What stands in a deck at (lx, ly) of a deck iw wide and fh tall (art pixels): [ramp, tone] or null. */
    function furniture(key, lx, ly, iw, fh, Rm, hurt) {
        if (fh < 5) return null;
        const fy = fh - ly;                                                                 // height above the floor
        const ladderW = Math.max(2, Math.round(iw * 0.07));
        if (lx >= 1 && lx < 2 + ladderW) {                                                  // the ladder down the left
            if (lx < 2 || lx >= 1 + ladderW) return [Rm.STEEL, 0.48];
            if (Math.floor(ly) % 3 === 1) return [Rm.STEEL, 0.4];
        }
        const porthole = Math.hypot(lx - (iw - Math.max(3, fh * 0.32)), ly - fh * 0.4), pr = Math.max(1.2, fh * 0.15);
        if (fh >= 9 && porthole < pr + 0.9) return porthole < pr ? [Rm.SCR, 0.06] : [Rm.STEEL, 0.6];
        const inX = (a, b) => lx >= iw * a && lx < iw * b, inY = (a, b) => fy >= fh * a && fy < fh * b;
        const box = (ramp, base, a, b, h0, h1) => (inX(a, b) && inY(h0, h1) ? [ramp, fy >= fh * h1 - 1 ? base + 0.26 : base] : null);
        switch (key) {
            case 'bridge':
                return box(Rm.STEEL, 0.3, 0.42, 0.88, 0, 0.3)                                      // the helm
                    || (inX(0.5, 0.8) && inY(0.42, 0.62) ? [Rm.SCR, hurt ? 0.12 : 0.34 + ((Math.floor(fy) % 2) ? 0.08 : 0)] : null)
                    || box(Rm.STEEL, 0.24, 0.24, 0.33, 0, 0.36);                                    // the commander's chair
            case 'lab':
                return box(Rm.STEEL, 0.28, 0.46, 0.95, 0, 0.3)                                      // the bench
                    || (inX(0.5, 0.92) && [0.62, 0.8].some(h => Math.abs(fy - fh * h) < 0.6) ? [Rm.STEEL, 0.5] : null)
                    || (inX(0.52, 0.9) && [0.62, 0.8].some(h => fy > fh * h && fy < fh * h + Math.max(1, fh * 0.08)) && Math.floor(lx) % 3 === 0 ? [Rm.GLASS, 0.62] : null)
                    || box(Rm.PAPER, 0.42, 0.18, 0.36, 0.42, 0.78);                                 // the star map pinned up
            case 'quarters':
                return [0.08, 0.5].map(h => box(Rm.LINEN, 0.42, 0.18, 0.4, h, h + 0.1) || box(Rm.LINEN, 0.42, 0.66, 0.94, h, h + 0.1)).find(Boolean)
                    || box(Rm.STEEL, 0.32, 0.47, 0.6, 0.26, 0.32) || (inX(0.52, 0.55) && inY(0, 0.26) ? [Rm.STEEL, 0.24] : null);
            case 'upgrades':                                                                        // the med bay
                return box(Rm.MED, 0.58, 0.5, 0.86, 0.22, 0.32) || (inX(0.52, 0.55) && inY(0, 0.22) ? [Rm.STEEL, 0.3] : null)
                    || box(Rm.GLASS, 0.3, 0.16, 0.32, 0.18, 0.78);
            case 'cargo': {                                                                         // the hold: crate stacks
                const stacks = [[0.16, 0.34, 0.5], [0.36, 0.55, 0.74], [0.57, 0.72, 0.38], [0.74, 0.94, 0.58]];
                const s = stacks.find(([a, b]) => inX(a, b));
                if (s && fy < fh * s[2]) return [Rm.CRATE, (fy >= fh * s[2] - 1 ? 0.62 : 0.34) + ((Math.floor(fy) % Math.max(3, Math.round(fh * 0.22))) === 0 ? -0.12 : 0)];
                return null;
            }
            case 'engineering': {                                                                   // the reactor and its pipes
                const cr = Math.max(2, Math.min(iw * 0.16, fh * 0.32)), dx = lx - iw * 0.5, dy = ly - fh * 0.5, dc = Math.hypot(dx, dy * 0.8);
                if (dc < cr) return [RPof('ICE'), hurt ? 0.18 : 0.42 + 0.3 * (1 - dc / cr)];
                if (Math.abs(dx) < cr + Math.max(1, iw * 0.04)) return [Rm.STEEL, 0.3 + (Math.floor(ly) % 3 === 0 ? 0.14 : 0)];
                if (Math.abs(fy - fh * 0.72) < Math.max(0.6, fh * 0.04) && inX(0.1, 0.92)) return [Rm.STEEL, 0.36];
                return null;
            }
            default: return null;
        }
    }
    const RPof = name => P().RP[name];

    /**
     * Draw the cutaway. opts.damaged: { roomKey: true } paints a deck in emergency red. opts.dim: { roomKey: 0..1 } darkens
     * a deck (1 = black). opts.labels: deck names (default on). opts.plume 0..1: the drive (default 0.5). Cached per look.
     */
    function draw(ctx, L, t = 0, opts = {}) {
        if (!P()) return;
        const damaged = opts.damaged || {}, d = MiniLab.inArt(ctx, (c, k) => k);
        const key = MiniLab.palette + d + JSON.stringify(damaged);
        if (!L.cache || L.cacheKey !== key) { L.cache = paintCutaway(L, d, damaged); L.cacheKey = key; }
        const S = L.cache, N = P(), RP = N.RP;
        MiniLab.inArt(ctx, c => {
            c.drawImage(S.canvas, S.bx0, S.by0);
            const f = N.framer(c, c.canvas.width, c.canvas.height), ox = S.bx0, oy = S.by0, beat = Math.pow(1 - ((t / BEAT_MS) % 1), 3.4);
            S.fx.forEach(q => {
                if (q.kind === 'core') { f.glow(ox + q.x, oy + q.y, Math.round(q.r * 1.8), q.hurt ? RP.RED : RP.ICE, (q.hurt ? 0.3 : 0.45) + 0.4 * beat); f.tone(ox + q.x, oy + q.y, RP.ICE, 0.8 + 0.2 * beat); return; }
                const blink = q.hurt && Math.floor(t / 500) % 2;
                f.px(ox + q.x, oy + q.y, q.hurt ? (blink ? RP.RED.hex[2] : RP.RED.hex[3]) : RP.AMBER.hex[4]);
            });
            const plume = opts.plume == null ? 0.5 : opts.plume;
            if (plume > 0) {                                                                  // the drive, the same blue as the reactor
                const len = Math.max(2, L.D * d * (0.25 + 0.5 * plume)) * (0.85 + 0.15 * Math.sin(t / 70)), w = L.D * d * 0.12;
                for (let k = 0; k < len; k++) {
                    const half = w * (1 - k / len * 0.7), v = (1 - k / len) * (0.55 + 0.4 * plume);
                    for (let x = -half; x <= half; x++) f.tone(ox + S.bell.x + x, oy + S.bell.y + k, RP.PLUME, v * (1 - Math.abs(x) / (half + 1) * 0.6));
                }
            }
            Object.entries(opts.dim || {}).forEach(([k, amount]) => {                          // decks without power
                const dk = S.decks.find(q => q.key === k);
                if (!dk || !(amount > 0)) return;
                c.fillStyle = MiniLab.C.void;
                for (let y = 0; y < dk.fh; y++) for (let x = 0; x < dk.iw; x++) {
                    const X = Math.floor(ox + dk.x0 + x), Y = Math.floor(oy + dk.y0 + y);
                    if (MiniLab.on(X, Y, amount)) c.fillRect(X, Y, 1, 1);
                }
            });
            if (opts.labels !== false) S.decks.forEach(dk => {
                if (dk.fh < 9) return;
                const name = (ROOMS.find(r => r.key === dk.key) || {}).label || '';
                if (N.pixelTextWidth(name) > dk.iw - 6) return;
                c.fillStyle = dk.hurt ? MiniLab.C.danger : MiniLab.C.textDim;
                N.pixelText(name, Math.round(ox + dk.x0 + Math.max(4, dk.iw * 0.09) + 2), Math.round(oy + dk.y0 + 2), (gx, gy) => c.fillRect(gx, gy, 1, 1));
            });
        });
    }

    // ── the Lander from outside ──
    /** Seen from above: the same round body, lit down its spine; the hold's hatch on top; legs as in the side view. */
    function shapeTop(u, v, o) {
        const N = P(), r = N.radiusL(u);
        if (r < 0) return -1;
        if (Math.abs(v) > r) return N.shapeL(u, v, o);
        if (u >= 0.94) return 0.2 + 0.3 * (1 - Math.abs(v) / r);
        const k = Math.abs(v) / r, pu = u * o.len;
        let l = 0.8 - 0.55 * k * k - (u > SKIRT ? 0.12 : 0) + (k > 0.9 ? -0.08 : 0);
        if (o.len > 30) for (let i = 0; i <= 6; i++) if (Math.abs(pu - DECK_U(i) * o.len) < 0.6) l -= 0.15;
        if (o.len > 30 && Math.abs(pu - NOSE * o.len) < 0.6) l -= 0.2;
        const h0 = DECK_U(4) + 0.02, h1 = DECK_U(4) + 0.07;
        if (u > h0 && u < h1 && Math.abs(v) < 0.14) l -= 0.22;                                // the hatch
        return l;
    }
    shapeTop.span = 0.8;
    /** Standing on its legs: four struts splay from the skirt to pads below the bell's mouth. */
    function shapeDown(u, v, o) {
        const N = P(), av = Math.abs(v);
        if (u > 0.82 && u < 1.1) {
            const k = (u - 0.84) / 0.24, c = 0.5 + 0.34 * Math.max(0, k), w = Math.max(1 / o.ht, 0.03);
            if (k >= 0 && k <= 1 && Math.abs(av - c) < w) return v < 0 ? 0.62 : 0.34;
            if (u > 1.06 && u < 1.1 && Math.abs(av - 0.88) < w * 3) return v < 0 ? 0.7 : 0.3;     // the pads
        }
        if (u > 1) return -1;
        if (av > N.radiusL(u)) return -1;
        return N.shapeL(u, v, o);
    }
    shapeDown.span = 0.95;

    const landerCache = new Map();
    function lander(ctx, o = {}) {
        const N = P();
        if (!N) return { at: () => [o.x || 0, o.y || 0] };
        const d = MiniLab.inArt(ctx, (c, k) => k), len = Math.max(4, (o.len || 40) * d), ht = len * ASPECT;
        const view = o.view === 'top' ? 'top' : 'side', down = o.legs === 'down', angle = Math.round((o.angle || 0) * 64) / 64;
        const key = [d, len, view, down, angle, o.flip, o.anchor, typeof o.ramp === 'string' ? o.ramp : o.ramp ? o.ramp.hex.join() : '', o.light, o.rust, o.holes, o.from, o.to, o.seed, o.sunDir, o.mirror].join('|');
        let S = landerCache.get(key);
        if (!S) {
            const box = Math.ceil(len * 1.35) + 6, p = N.painter(box * 2, box * 2, false);
            const anchor = o.anchor == null ? 0.5 : o.anchor, shape = view === 'top' ? shapeTop : down ? shapeDown : N.shapeL;
            const ramp = typeof o.ramp === 'string' ? N.RP[o.ramp] : o.ramp;
            const opts = { x: box, y: box, len, ht, angle, flip: !!o.flip, anchor, ramp, light: o.light, rust: o.rust, holes: o.holes, from: o.from, to: down && o.to == null ? 1.1 : o.to,
                seed: o.seed, sunDir: o.sunDir, sun: o.sunDir ? 0.6 : 0, mirror: o.mirror };
            const at = N.hull(p, opts, shape);
            S = { canvas: p.canvas(), box, at };
            if (landerCache.size > 80) landerCache.clear();
            landerCache.set(key, S);
        }
        const ax = Math.round((o.x || 0) * d) - S.box, ay = Math.round((o.y || 0) * d) - S.box;
        MiniLab.inArt(ctx, c => {
            c.drawImage(S.canvas, ax, ay);
            if (o.plume > 0) {                                                                  // the drive, out of the bell
                const f = N.framer(c, c.canvas.width, c.canvas.height), t = o.t || 0, n = Math.round(len * (0.25 + 0.6 * o.plume) * (0.88 + 0.12 * Math.sin(t / 60)));
                for (let k = 0; k < n; k++) {
                    const half = ht * 0.13 * (1 - k / n * 0.6), v = (1 - k / n) * (0.5 + 0.45 * o.plume);
                    for (let s = -Math.ceil(half); s <= Math.ceil(half); s++) {
                        const [px, py] = S.at(1 + k / len, s / ht);
                        f.tone(ax + px, ay + py, N.RP.PLUME, v * (1 - Math.abs(s) / (half + 1) * 0.6));
                    }
                }
            }
        });
        return { at: (u, v) => { const [px, py] = S.at(u, v); return [(ax + px) / d, (ay + py) / d]; } };
    }

    /** A crew member nine units tall standing with their feet on (feetX, feetY); isLying lays them down. */
    function figure(ctx, feetX, feetY, who, isStepping = false, isLying = false) {
        const MC = window.MiniCrew;
        if (!MC) return;
        const id = (CREW[who] && CREW[who].id) || MC.idOf(who) || 'cora';
        MC.small(ctx, id, feetX + 0.5, feetY, { h: 9, suit: false, pose: isLying ? 'lie' : isStepping ? 'walk' : 'stand', t: isStepping ? 375 : 0 });
    }

    /** Pick a ramp colour for tone g (0..1) at pixel (x, y) (kept for old callers; MiniLab.pick is the same). */
    const rampAt = (ramp, g, x, y) => MiniLab.pick(ramp, g, x, y);

    window.MiniShip = {
        ROOMS, LANDER_ROOMS, LANDER_ORDER, CREW, ASPECT, get HULL_RAMP() { return MiniLab.C.hull; },
        layout, draw, lander, figure, rampAt,
    };
})();
