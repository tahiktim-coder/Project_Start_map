/* ═══ Silent Exodus · new screen (?new=1) · ship/ShipReactor.js: the reactor, the heart of the ship ════════════════
   What it is: engineering's reactor, painted into the deck by ShipRooms.js (ROOMS[5] calls paint) and brought to life
   here. It is the sign of energy on screen: full is bright and steady with a slow even beat; low is dim and slow, beats
   missed, the light dropping out for a tick, a red lamp blinking. Nothing on screen says a number. Its light is not baked
   into the deck: ShipArt.js lights the deck once more at each of LEVELS steps, and draw() lays the step it needs over it.
   Source: prototypes/screens/crew-hires/ship-reactor.js. Changes: the ?energy= read is gone; the reactor starts at 100
   and the game sets the real energy with set(); fromUrl is always false.
   Load after ShipRooms.js.

   window.ShipArt.reactor (frozen)
     paint(p)                the still reactor into engineering's buffer (called by ROOMS[5])
     fx()                    its moving-layer entry: { kind: 'core', x, y, ly }
     glow                    { levels, lights(s) } for ShipArt.deck()
     draw(ctx, f, X, Y, t)   the moving layer (TowerArt calls it for kind 'core'; X, Y: f's screen point)
     set(energy) → target    energy 0..100; the light eases to it in whole steps.   get() → target
     LEVELS, G               the light's steps, the reactor's place in the deck
     fromUrl                 false
   ShipArt.setEnergy(n) is the same as reactor.set(n).
*/
(function (root) {
    'use strict';
    const A = root.ShipArt;
    if (!A) return;
    const { L, R, api } = A, { box, topSurface, hash, fbm, clamp01, lamp, level, painter } = api;
    const F = L.DECK_FLOOR, TICK = 125;
    const ICE_T = [0.62, 0.92, 1.1];

    // ── where it stands (deck-local art pixels; F = 190 is the floor) ──────────────────────────────────────────────
    const G = Object.freeze({
        dc: 464, cy: 99,                         // the centre line and the heart
        gx0: 440, gx1: 488, gy0: 62, gy1: 137,   // the glass chamber (x1, y1 exclusive)
        struts: [452, 453, 476, 477],            // the cage bars in front of the glass
        vents: [152, 158, 164],                  // slits in the base
        ring: { rx: 41, ry: 7 },                 // the turning ring round the heart, as wide as the collars
        dials: [[401, 91], [412, 91], [423, 91]], lampsY: 100, lampsX: [398, 404, 410, 416],
        OX: 288, OW: 368,                        // the moving layer covers deck columns OX … OX + OW (OX a multiple of 8)
    });
    const LEVELS = 6;
    const PATHS = [                              // charges run out along these: the conduits, then the ceiling headers
        [[508, 162], [580, 162], [580, 38]],
        [[420, 156], [403, 156], [403, 189]],
        [[500, 35], [642, 35]],
        [[428, 35], [304, 35]],
    ].map(pts => { let len = 0; const seg = []; for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push({ a: pts[i - 1], b: pts[i], at: len, d }); len += d; } return { seg, len }; });

    // ── the still reactor ─────────────────────────────────────────────────────────────────────────────────────────
    /** A cylinder seen side on, lit from the upper right: u is -1 … 1 across it. */
    const cyl = (u, base, span) => base + span * clamp01(u * 0.7 + 0.45) - (Math.abs(u) > 0.92 ? 0.08 : 0);
    function collar(p, y0, y1, below) {
        const x0 = 424, x1 = 505;
        p.region(x0, y0, x1, y1, (x, y) => {
            const u = (x + 0.5 - G.dc) / 40.5;
            let v = cyl(u, 0.2, 0.36);
            if (y === y0) v += below ? 0.3 : 0.16; else if (y === y1 - 1) v -= below ? 0.06 : 0.12;
            if (y === y0 + 3 && (x - x0) % 8 === 4) v += 0.22;                                  // bolts
            p.tone(x, y, R.STEEL, v);
        });
    }
    function paint(p) {
        const { dc, gx0, gx1, gy0, gy1 } = G;
        // through the floor to the drive below: a trunk with bands
        p.region(444, F + 4, 485, L.PITCH, (x, y) => p.tone(x, y, R.STEEL, cyl((x + 0.5 - dc) / 20.5, 0.12, 0.3) + ((y - F) % 6 === 0 ? 0.1 : 0)));
        // feeds into the ceiling and a flange where they go through
        for (const cx of [442, 486]) p.region(cx - 4, 12, cx + 4, 32, (x, y) => p.tone(x, y, R.STEEL, cyl((x + 0.5 - cx) / 4, 0.14, 0.4)));
        p.region(428, 20, 501, 23, (x, y) => p.tone(x, y, R.STEEL, [0.56, 0.34, 0.16][y - 20]));
        // the cap: a short dome, a band of bolts, a seam
        p.region(430, 28, 499, 54, (x, y) => {
            const shoulder = y < 34 ? 34 - y : 0; if (x < 430 + shoulder * 1.4 || x >= 499 - shoulder * 1.4) return;
            const u = (x + 0.5 - dc) / 34.5;
            let v = cyl(u, 0.14, 0.34) + (fbm(x / 6, (y + p.oy) / 5, 91) - 0.5) * 0.06;
            if (y === 28 || (shoulder > 0 && x >= 499 - shoulder * 1.4 - 1)) v += 0.2;                // the dome's lit rim
            if (y === 40 && (x - 430) % 6 === 3) v += 0.24;
            if (y === 46) v -= 0.1; else if (y === 47) v += 0.06;
            p.tone(x, y, R.STEEL, v);
        });
        collar(p, 54, gy0, false);
        // the glass: dead and dark until draw() lights the core in it; a streak of reflection on the right
        p.region(gx0, gy0, gx1, gy1, (x, y) => {
            const c = 1 - Math.abs(x + 0.5 - dc) / 24;
            let v = 0.1 + 0.08 * c + (fbm(x / 4, (y + p.oy) / 9, 93) - 0.5) * 0.06;
            if (x === gx1 - 5 || (x === gx1 - 4 && (y + p.oy) % 5)) v += 0.26;
            if (x === gx0 + 3) v += 0.12;
            if (y < gy0 + 2 || y >= gy1 - 2) { p.tone(x, y, R.STEEL, y === gy0 || y === gy1 - 1 ? 0.12 : 0.3); return; }
            p.tone(x, y, R.ICE, v);
        });
        // the shield posts each side, riveted, and the cage bars in front of the glass
        for (const [x0, x1] of [[429, gx0], [gx1, 499]]) p.region(x0, gy0, x1, gy1, (x, y) => {
            const u = (x + 0.5 - (x0 + x1) / 2) / ((x1 - x0) / 2);
            p.tone(x, y, R.STEEL, cyl(u, 0.16, 0.34) + ((y - gy0) % 12 === 6 && Math.abs(u) < 0.3 ? 0.22 : 0));
        });
        p.region(gx0 - 1, gy0, gx0, gy1, (x, y) => p.tone(x, y, R.STEEL, 0.06));
        p.region(gx1, gy0, gx1 + 1, gy1, (x, y) => p.tone(x, y, R.STEEL, 0.5));
        for (const sx of G.struts) p.region(sx, gy0 + 2, sx + 1, gy1 - 2, (x, y) => p.tone(x, y, R.STEEL, G.struts.indexOf(sx) % 2 ? 0.16 : 0.34));
        collar(p, gy1, gy1 + 9, true);
        // the base: a housing with three vents, on a plinth
        box(p, 420, gy1 + 9, 509, F - 14, R.STEEL, 0.22, { panel: 3, seed: 95, topLit: 0.1 });
        for (const vy of G.vents) {
            p.region(438, vy, 491, vy + 1, (x, y) => p.tone(x, y, R.STEEL, 0.03));
            p.region(438, vy + 1, 491, vy + 2, (x, y) => p.tone(x, y, R.STEEL, 0.36));
        }
        topSurface(p, 400, 528, F - 14, 3, R.STEEL, 0.32);
        box(p, 400, F - 14, 528, F, R.STEEL, 0.26, { panel: 0, seed: 96, topLit: 0.16 });
        // conduits out of the base: right, to the pipe up the wall; left, down into the floor
        p.region(509, 159, 579, 166, (x, y) => p.tone(x, y, R.STEEL, [0.14, 0.3, 0.46, 0.38, 0.26, 0.16, 0.08][y - 159]));
        for (const fx0 of [512, 572]) p.region(fx0, 157, fx0 + 3, 168, (x, y) => p.tone(x, y, R.STEEL, x === fx0 + 2 ? 0.5 : 0.3));
        p.region(400, 153, 420, 160, (x, y) => p.tone(x, y, R.STEEL, [0.14, 0.3, 0.46, 0.38, 0.26, 0.16, 0.08][y - 153]));
        p.region(400, 153, 407, F, (x, y) => { if (y < 157 && x > 403) return; p.tone(x, y, R.STEEL, [0.12, 0.26, 0.42, 0.36, 0.24, 0.14, 0.08][x - 400] + (y === 176 ? 0.1 : 0)); });
        p.region(398, F - 3, 409, F, (x, y) => p.tone(x, y, R.STEEL, y === F - 3 ? 0.5 : 0.24));
        // the gauge panel on the left post, where Jaxon reads it: three dials and a row of lamps
        box(p, 394, 82, 430, 107, R.STEEL, 0.2, { panel: 2, seed: 97, topLit: 0.3 });
        p.region(429, 90, 431, 97, (x, y) => p.tone(x, y, R.STEEL, 0.42));
        for (const [gx, gy] of G.dials) p.ellipse(gx + 0.5, gy + 0.5, 4.5, 4.5, (x, y, q) => p.tone(x, y, R.LINEN, q > 0.6 ? 0.3 : 0.62));
        for (const lx of G.lampsX) p.region(lx, G.lampsY, lx + 2, G.lampsY + 2, (x, y) => p.tone(x, y, R.STEEL, 0.08));
        p.region(421, 99, 428, 104, (x, y) => p.tone(x, y, R.SCR, 0.12));
    }

    /** The reactor's light at step s (0 … 1]: the core lights the room, and a pool spreads on the floor from the base. */
    const lights = s => [
        lamp(G.dc, G.cy, { reach: 30 + 52 * s, k: 0.28 + 0.82 * s, tint: ICE_T, up: 1, kind: 'reactor' }),
        lamp(G.dc, F - 10, { reach: 22 + 40 * s, k: 0.18 + 0.6 * s, tint: ICE_T, up: 0.15, kind: 'reactor' }),
    ];

    // ── energy and the beat ───────────────────────────────────────────────────────────────────────────────────────
    const clampE = n => Math.max(0, Math.min(100, Math.round(Number(n))));
    const st = { target: 100, shown: 100, lastTick: null, key: '', level: 0, p: null, img: null, cv: null };   // the game sets the real energy with set()

    /** Where the heart is in its beat at this tick, for energy E (0 … 1). b: how bright the core is (0 … 1). */
    function beat(tick, E) {
        if (E <= 0) return { b: 0, shape: 0, drop: false };
        const t = tick * TICK, period = 2400 + 1800 * (1 - E), n = Math.floor(t / period), ph = (t - n * period) / period;
        const skip = hash(n & 255, (n >> 8) & 255, 41) < 0.55 * Math.pow(1 - E, 1.5);           // a missed beat
        const shape = skip ? 0 : Math.min(1, Math.exp(-ph * 9) + (ph > 0.28 ? 0.55 * Math.exp(-(ph - 0.28) * 11) : 0));   // lub … dub
        const drop = hash(tick & 255, (tick >> 8) & 255, 43) < 0.3 * (1 - E) * (1 - E);          // the light cuts out for a tick
        const b = clamp01((0.06 + 0.84 * E + (0.1 + 0.18 * (1 - E)) * shape) * (drop ? 0.3 : 1));
        return { b, shape, drop };
    }

    // ── the moving layer, painted once a tick into its own buffer ────────────────────────────────────────────────
    function layer() {
        if (st.p) return st;
        st.p = painter(G.OW, L.PITCH, A.deckTop(L.N - 1));
        st.cv = document.createElement('canvas'); st.cv.width = G.OW; st.cv.height = L.PITCH;
        st.img = new ImageData(st.p.data, G.OW, L.PITCH);
        return st;
    }
    function pointOn(path, s) {
        for (const g of path.seg) if (s <= g.at + g.d) { const k = (s - g.at) / g.d; return [Math.round(g.a[0] + (g.b[0] - g.a[0]) * k), Math.round(g.a[1] + (g.b[1] - g.a[1]) * k)]; }
        const g = path.seg[path.seg.length - 1]; return g.b;
    }
    function paintLayer(tick, E) {
        const p = layer().p, oy = p.oy;
        p.data.fill(0);
        const T = (x, y, r, v) => { if (v <= 0) return; const k = level(r, v, x, y + oy); if (k > 0) p.set(x - G.OX, y, r.rgb[k]); };
        const H = (x, y, hex) => p.hex(x - G.OX, y, hex);
        const { dc, cy, gx0, gx1, gy0, gy1 } = G, { b, shape, drop } = beat(tick, E);
        st.level = Math.max(0, Math.min(LEVELS, Math.round(b * LEVELS)));

        // the core: a column of light, bands rising through it, the heart swelling on the beat
        const rise = 1 + Math.round(4 * E), rh = 4 + 6 * b + 3 * shape * E;
        for (let y = gy0 + 2; y < gy1 - 2; y++) for (let x = gx0 + 1; x < gx1 - 1; x++) {
            if (G.struts.includes(x)) continue;
            const c = Math.max(0, 1 - Math.abs(x + 0.5 - dc) / 24);
            let v = b * (0.16 + 0.64 * c * c) * (0.6 + 0.4 * Math.exp(-Math.abs(y + 0.5 - cy) / 26));   // brightest at the heart
            if ((gy1 - y + tick * rise) % 19 < 2) v += 0.22 * b * (0.4 + c);
            const d = Math.hypot((x + 0.5 - dc) / 1.1, (y + 0.5 - cy) / 1.35);
            if (d < rh * 2) v += 0.24 * b * (1 - d / (rh * 2));
            if (d < rh) v = Math.max(v, (0.45 + 0.6 * (1 - d / rh)) * (0.35 + 0.75 * b));
            if (hash(x & 255, (y + tick * 7) & 255, 45) < 0.03 * E && !drop) v += 0.3;
            if (v > 0.06) T(x, y, R.ICE, v);
        }
        // the vents in the base breathe with it
        for (const vy of G.vents) for (let x = 438; x < 491; x++) {
            const c = Math.max(0, 1 - Math.abs(x + 0.5 - dc) / 28);
            T(x, vy, R.ICE, b * (0.3 + 0.5 * c) * (hash((x >> 2) & 255, tick & 255, 46) > 0.15 ? 1 : 0.6));
        }
        // arcs: a few filaments from the heart to the glass, new each tick; more of them, and longer, the more energy
        if (!drop) for (let k = 0; k < Math.round(3 * E + 0.3); k++) {
            const side = hash(tick & 255, k, 50) < 0.5 ? -1 : 1, aim = (hash(tick & 255, k, 51) - 0.5) * 1.6;
            let x = dc + side * rh * 0.7, y = cy + aim * 4;
            const len = 6 + Math.round(12 * E * hash(tick & 255, k, 52));
            for (let i = 0; i < len; i++) {
                x += side; y += aim * 0.6 + (hash((tick + i) & 255, k, 53) - 0.5) * 2.4;
                if (x <= gx0 + 1 || x >= gx1 - 2) break;
                if (!G.struts.includes(Math.round(x))) T(Math.round(x), Math.round(y), R.ICE, 0.95 - i * 0.03);
            }
        }
        // the ring round the heart: a steel torus; its lit ports and dark notches travel round as it turns, and it
        // strains (jerks back and forth) when there is little energy
        const { rx, ry } = G.ring, turn = 0.05 + 0.13 * E, strain = (1 - E) * 0.6 * (hash((tick >> 1) & 255, 9, 47) - 0.5);
        const ph = tick * turn + strain, STEP = Math.PI * 2 / 10;
        const BAND = [0.62, 0.44, 0.3, 0.12];                                                       // lit rim, body, body, shadow
        for (let k = 0; k < 300; k++) {
            const th = k * Math.PI * 2 / 300, x = Math.round(dc - 0.5 + rx * Math.cos(th)), y = Math.round(cy - 1 + ry * Math.sin(th)), front = Math.sin(th) > -0.08;
            if (!front) { if (x < gx0 - 1 || x > gx1) { T(x, y, R.STEEL, 0.3 + 0.2 * b); T(x, y + 1, R.STEEL, 0.16 + 0.12 * b); } continue; }   // behind the core
            const side = 0.1 * Math.cos(th) + 0.2 * b * (1 - Math.abs(Math.cos(th)) * 0.5);                // the right is lit; the core lights its face
            BAND.forEach((v, r) => T(x, y + r, R.STEEL, v + side));
            const m = (((th - ph) / STEP) % 1 + 1) % 1, idx = ((Math.floor((th - ph) / STEP) % 2) + 2) % 2;
            if (m < 0.22) {
                if (idx === 0) { T(x, y + 1, R.ICE, 0.36 + 0.6 * b); T(x, y + 2, R.ICE, 0.24 + 0.46 * b); }   // a port, lit by the core
                else { T(x, y + 1, R.STEEL, 0.06); T(x, y + 2, R.STEEL, 0.06); }                       // a notch
            }
        }
        // charges running out along the conduits and the ceiling headers
        if (E > 0.02 && !drop) {
            const speed = 1 + Math.round(5 * E), n = 2 + Math.round(2 * E);
            PATHS.forEach((path, j) => {
                for (let i = 0; i < n; i++) {
                    const s0 = (tick * speed + i * path.len / n + j * 17) % path.len;
                    [1, 0.66, 0.4].forEach((k, tail) => { const s = s0 - tail; if (s < 0) return; const [x, y] = pointOn(path, s); T(x, y, R.ICE, (0.42 + 0.5 * b) * k); });
                }
            });
        }
        // the gauges: needles that sit high and steady when full, low and shaking when not; lamps for what is left
        G.dials.forEach(([gx, gy], k) => {
            const val = [E, 0.3 + 0.35 * E + 0.08 * shape, 0.85 - 0.6 * E][k];
            const shake = (hash(tick & 255, k, 48) - 0.5) * (0.05 + 0.5 * (1 - E) * (1 - E));
            const a = 2.36 + 4.71 * clamp01(val) + shake;
            for (let r = 1; r <= 3; r++) H(gx + Math.round(Math.cos(a) * r), gy + Math.round(Math.sin(a) * r), '#a8604a');
        });
        G.lampsX.forEach((lx, i) => {
            if (i === 0 && E < 0.25) { if ((tick % 8) < 4) { H(lx, G.lampsY, '#e2574c'); H(lx + 1, G.lampsY, '#e2574c'); H(lx, G.lampsY + 1, '#8a2a22'); H(lx + 1, G.lampsY + 1, '#e2574c'); } return; }
            if (E * 4 < i + 0.15) return;
            if (hash(lx & 255, tick & 255, 49) < 0.04 + 0.2 * (1 - E) * (1 - E)) return;            // a flicker
            H(lx, G.lampsY, '#7ff5da'); H(lx + 1, G.lampsY, '#2fcdb0'); H(lx, G.lampsY + 1, '#2fcdb0'); H(lx + 1, G.lampsY + 1, '#1a7f72');
        });
        st.cv.getContext('2d').putImageData(st.img, 0, 0);
    }

    /** The moving layer for a page's fx(): the deck lit at this tick's step, then the core, ring, charges and gauges. */
    function draw(ctx, f, X, Y, t) {
        const tick = Math.floor(t / TICK);
        if (st.lastTick == null || Math.abs(tick - st.lastTick) > 40) st.shown = st.target;      // a jump in time: no easing
        else if (tick !== st.lastTick) { const step = 3 * Math.abs(tick - st.lastTick), d = st.target - st.shown; st.shown += Math.max(-step, Math.min(step, d)); }
        st.lastTick = tick;
        const key = tick + '|' + st.shown;
        if (key !== st.key) { paintLayer(tick, st.shown / 100); st.key = key; }
        const dx = X - f.x, dy = Y - (f.ly == null ? G.cy : f.ly), keep = ctx.fillStyle;
        if (st.level > 0 && f.glow && f.glow[st.level]) ctx.drawImage(f.glow[st.level], dx, dy);
        ctx.drawImage(st.cv, dx + G.OX, dy);
        ctx.fillStyle = keep;
    }

    const set = n => { if (Number.isFinite(Number(n))) st.target = clampE(n); return st.target; };
    A.reactor = Object.freeze({
        paint, draw, set, get: () => st.target, LEVELS, G, fromUrl: false,
        fx: () => ({ kind: 'core', x: G.dc, y: G.cy, ly: G.cy }),
        glow: Object.freeze({ levels: LEVELS, lights }),
    });
    A.setEnergy = set;
})(typeof window !== 'undefined' ? window : globalThis);
