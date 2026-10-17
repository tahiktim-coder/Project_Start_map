/* ═══ Silent Exodus · new screen (?new=1) · end/EdenArt.js: Eden's meadow, and the pull back from it ══════════════════
   What it is: the pictures of the Eden ending. The meadow is prototypes/play-ideas/eden-walk-art.js, ported (the sky with
   the light in it as Eden's sun, drifting clouds, far hills, the near hill and its trees, the meadow with its fence and
   flowers, the dark grass in front). Eden is the trap, so the warmth is everywhere, and its three quiet wrong things stay,
   shown and never said: one tree has no shadow, two clouds are the same cloud, one flower patch tiles like a floor. The living
   crew settle into the grass (the crew-hires people, MiniCrewEngine): Jaxon lies back, Aris kneels, Mira sits on a stone,
   Cora and Vance stand; our Lander stands on the hill. Then the camera rises out of the meadow, Eden is a whole world in the
   dark, and it shrinks in steps (as the bridge glass brakes a world in) until it is one cold point of light.
   House style (docs/ART_STYLE.md). end/Ending.js drives the clock. Needs NSPaint, MiniCrewEngine, MiniShip; NSWorlds for
   Eden from orbit. Loaded only with the new-screen switch.

   window.NSEdenArt (frozen)
     build(W, H, ids, node) → eden   the meadow at this size (the 640 x 360 picture anchored to the bottom, the sky above it
                                     carried on), the crew group (ids: who is alive), Eden's node (for its orbit picture)
     bakeNext(eden) → bool           paints the next size of Eden from orbit; true while sizes are left (one per idle slot)
     drawMeadow(ctx, eden, t, ms, rise)   t: seconds since they stopped (they settle at SETTLE); rise 0..1: the camera rising
     drawGlobe(ctx, eden, k, ms)     k 0..1 through the pull back: Eden from orbit, shrinking in steps, then the cold point
     SETTLE                          { id: seconds } when each one settles into the grass
*/
(function () {
    'use strict';
    const P = window.NSPaint, SHIP = window.MiniShip;
    if (!window.NEW_SCREEN || !P) return;
    const { INK, ramp, fbm, hash, seeded, clamp01, lightGlow, threshold } = P;
    const smooth = P.smooth;
    const TAU = Math.PI * 2;
    const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

    const PW = 640, PH = 360;                                   // the picture eden-walk-art paints, in art px
    const SUN = { u: 0.747, y: 92, core: 7 };                   // u: across the width (478 of the picture's 640)
    const HORIZON = 210;
    const FACTOR = { cloud: 0.2, far: 0.35, mid: 0.6, near: 1, tuft: 1.4 };   // how far each layer slides as the camera rises
    const CLOUD_DRIFT = 2.4;                                    // the wind moves the clouds. Not the grass.
    const R = {
        SKY: ramp(INK, '#0c1622', '#16263a', '#25394e', '#3e5464', '#6a7372', '#a48c6c', '#d8ae78', '#f4d29a', '#fff3dc'),
        CLOUD: ramp(INK, '#2a2e3c', '#4c4a58', '#7c6c70', '#b4927e', '#e2b98e', '#f8dcb4', '#fff1dc'),
        FAR: ramp(INK, '#101c26', '#1a2c36', '#28404a', '#3c5658', '#5a7068', '#869078', '#b4a884'),
        HILL: ramp(INK, '#0c170f', '#152616', '#21391c', '#345022', '#4e6a2a', '#748636', '#a8a44c', '#d6c26a'),
        LEAF: ramp(INK, '#0a140c', '#132216', '#1e321a', '#2e4a20', '#46642a', '#6c8034', '#a2a046', '#d0bc62'),
        BARK: ramp(INK, '#160f0a', '#2a1d14', '#44301f', '#634a30', '#8a6a44'),
        WOOD: ramp(INK, '#1a110b', '#33231a', '#523a28', '#76563a', '#9e7a52', '#caa474'),
        STONE: ramp(INK, '#141813', '#2a2f27', '#454b3f', '#6c705c', '#9c9a7c', '#cdc4a0'),
        PETAL_W: ramp(INK, '#4a4440', '#8e8478', '#d8ccb4', '#f6eedc'),
        PETAL_Y: ramp(INK, '#3a2a0c', '#7a5a18', '#c8962a', '#f2cc5a'),
        PETAL_V: ramp(INK, '#2a1e36', '#4e3a64', '#7c62a0', '#b49ad0'),
        POINT: ['#d6eef4', '#7fb3c2', '#33606e'],               // the cold point, the last thing on screen
    };
    const lum = c => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];

    // ── the crew in the grass: where, which way, and what they do once they stop ──
    const FEET = 336;                                           // picture rows
    const PLACES = {
        mira: { x: 160, act: 'sit', face: 1, at: 3.0 }, jaxon: { x: 250, act: 'sleep', face: 1, at: 1.6, dy: 4 },
        aris: { x: 335, act: 'tend', face: 1, at: 2.3, dy: 2 }, cora: { x: 402, act: 'idle', face: 1 }, vance: { x: 470, act: 'idle', face: -1, dy: -2 },
    };
    const SETTLE = Object.freeze(Object.fromEntries(Object.entries(PLACES).filter(([, p]) => p.at).map(([id, p]) => [id, p.at])));
    const SEAT = 22, GROUP_MID = 315;                           // the group's middle in the 640-wide picture

    // ════════════════════════════════════════ the meadow (eden-walk-art.js, ported) ════════════════════════════════════════
    function paintSky(W, H, oy) {
        const p = P.painter(W, H, true), sx = Math.round(W * SUN.u);
        p.region(0, 0, W, H, (x, y0) => {
            const y = y0 - oy, k = clamp01(y / HORIZON), d = Math.hypot((x - sx) * 0.55, (y - SUN.y) * 1.3);
            p.solid(x, y0, R.SKY, 0.36 + 0.54 * Math.pow(k, 1.5) + 0.2 * Math.exp(-d / 110) + 0.06 * (fbm(x / 120, y / 7, 5, 3) - 0.5));
        });
        // the light is the travel view's false sun (lightGlow), painted on its own: made for black space, so on a day sky only
        // the pixels brighter than the sky behind them are kept
        const g = P.painter(W, H, false);
        lightGlow(g, sx, SUN.y + oy, { core: SUN.core, halo: 26, strength: 0.8, spikes: 0 });
        p.region(sx - 110, SUN.y + oy - 110, sx + 110, SUN.y + oy + 110, (x, y) => {
            const c = g.get(x, y);
            if (c[3] && lum(c) > lum(p.get(x, y))) p.set(x, y, c);
        });
        return p.canvas();
    }
    const CLOUDS = [
        { x: 30, y: 40, w: 96, h: 26, seed: 11 }, { x: 190, y: 22, w: 70, h: 20, seed: 23 },
        { x: 330, y: 52, w: 84, h: 24, seed: 37 }, { x: 470, y: 18, w: 110, h: 28, seed: 51 },
        { x: 600, y: 52, w: 84, h: 24, seed: 37 },                // the same cloud again, at the same height
        { x: 780, y: 30, w: 92, h: 24, seed: 63 }, { x: 950, y: 62, w: 76, h: 22, seed: 77 },
    ];
    function paintCloud(seed, w, h) {
        const rand = seeded(seed), n = 5 + Math.floor(rand() * 3), blobs = [];
        for (let i = 0; i < n; i++) {
            const u = (i + 0.5) / n;
            blobs.push({ cx: w * (0.2 + 0.6 * u) + (rand() - 0.5) * w * 0.06, cy: h * (0.64 - 0.22 * Math.sin(u * Math.PI) * (0.6 + 0.4 * rand())),
                rx: w * (0.1 + rand() * 0.08), ry: h * (0.26 + rand() * 0.16) });
        }
        const IN = 0.08;
        const dens = (x, y) => {
            let m = -9;
            for (const b of blobs) m = Math.max(m, 1 - (((x - b.cx) / b.rx) ** 2 + ((y - b.cy) / b.ry) ** 2));
            if (m < -0.2) return m;
            m += 0.4 * (fbm(x / 9, y / 6, seed, 3) - 0.5);
            if (y > h * 0.74) m -= (y - h * 0.74) * 0.09;
            return m;
        };
        const p = P.painter(w, h, false);
        p.region(0, 0, w, h, (x, y) => {
            if (dens(x + 0.5, y + 0.5) <= IN) return;
            let v = 0.56 + 0.3 * (x / w - 0.5) + 0.3 * (0.5 - y / h) + 0.18 * (fbm(x / 6, y / 5, seed + 3, 2) - 0.5);
            if (dens(x + 2.5, y - 1.5) <= IN) v += 0.32;
            else if (dens(x + 0.5, y + 3.5) <= IN) v -= 0.14;
            p.solid(x, y, R.CLOUD, clamp(v, 0.26, 1));
        });
        return p.canvas();
    }
    function paintFar(width) {
        const top = x => 176 + 20 * fbm(x / 150, 0.5, 21, 3) + 5 * Math.sin(x / 70);
        const p = P.painter(width, PH, false);
        for (let x = 0; x < width; x++) {
            const t0 = top(x), slope = clamp(top(x + 3) - top(x - 3), -4, 4);
            for (let y = Math.floor(t0); y < PH; y++) {                             // down to the bottom: no sky shows under it as the camera rises
                const dy = y - t0;
                let v = 0.68 - 0.1 * Math.min(1, dy / 40) + 0.1 * (fbm(x / 26, y / 10, 22, 3) - 0.5) + 0.035 * slope + 0.16 * smooth(12, 40, dy);
                if (dy < 1) v += 0.22;
                p.solid(x, y, R.FAR, v);
            }
        }
        return p.canvas();
    }
    // every tree throws a shadow to the left but one
    const TREES = [{ x: 40, h: 34 }, { x: 150, h: 44 }, { x: 196, h: 30 }, { x: 330, h: 50 }, { x: 470, h: 36 }, { x: 540, h: 40, noShadow: true },
        { x: 690, h: 46 }, { x: 742, h: 32 }, { x: 900, h: 52 }, { x: 1080, h: 38 }];
    const midTop = x => 206 + 16 * fbm(x / 170, 1.5, 31, 3) + 6 * Math.sin(x / 110 + 1);
    function paintTree(p, x, gy, h, seed) {
        const rand = seeded(seed), trunkH = h * 0.42, tw = Math.max(2, Math.round(h * 0.07));
        for (let y = Math.floor(gy - trunkH); y <= gy; y++) for (let i = 0; i < tw; i++) {
            const xx = Math.round(x - tw / 2 + i);
            p.solid(xx, y, R.BARK, 0.25 + 0.45 * (i / Math.max(1, tw - 1)) + 0.1 * (hash(xx, y, 7) - 0.5));
        }
        const cy = gy - h * 0.66, blobs = [];
        for (let i = 0; i < 7; i++) blobs.push({ x: x + (rand() - 0.5) * h * 0.5, y: cy + (rand() - 0.5) * h * 0.32, r: h * (0.17 + rand() * 0.09) });
        const reach = h * 0.62;
        p.region(x - reach, gy - h * 1.15, x + reach, gy - h * 0.25, (px, py) => {
            let best = blobs[0], bq = 9;
            for (const b of blobs) { const q = Math.hypot(px + 0.5 - b.x, py + 0.5 - b.y) / b.r; if (q < bq) { bq = q; best = b; } }
            const edge = 1 + 0.32 * (fbm(px / 3, py / 3, seed, 2) - 0.5);
            if (bq > edge) return;
            const nx = (px + 0.5 - best.x) / best.r, ny = (py + 0.5 - best.y) / best.r, toward = nx * 0.8 - ny * 0.6;
            let v = 0.34 + 0.34 * toward + 0.2 * (fbm(px / 2.5, py / 2.5, seed + 1, 2) - 0.5) - 0.12 * ((py - (gy - h)) / h);
            if (bq > edge - 0.18 && toward > 0.2) v += 0.22;
            p.solid(px, py, R.LEAF, clamp(v, 0.08, 1));
        });
    }
    function paintMid(width) {
        const p = P.painter(width, PH, false), shade = new Float32Array(width * PH);
        const dark = (x, y) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < width && y < PH) shade[y * width + x] = 1; };
        const trees = TREES.map((t, i) => ({ ...t, gy: Math.round(midTop(t.x)) + 1, seed: 300 + i * 13 }));
        trees.filter(t => !t.noShadow).forEach(t => {                   // the low sun throws shadows to the left, from the trunk
            const len = t.h * 1.15, mid = t.x - len * 0.45, rx = len * 0.42, ry = 1.5 + t.h * 0.09;
            for (let k = 0; k < len * 0.3; k++) dark(t.x - 1 - k, midTop(t.x - 1 - k) + 1.5 + k * 0.1);
            for (let sx = mid - rx; sx <= mid + rx; sx++) {
                const u = (sx - mid) / rx, half = ry * Math.sqrt(Math.max(0, 1 - u * u)), sy = midTop(sx) + 2 + (t.x - sx) * 0.1;
                for (let sy2 = sy - half; sy2 <= sy + half; sy2++) dark(sx, sy2);
            }
        });
        for (let x = 0; x < width; x++) {
            const t0 = midTop(x), slope = clamp(midTop(x + 3) - midTop(x - 3), -4, 4);
            for (let y = Math.floor(t0); y < PH; y++) {
                const dy = y - t0;
                let v = 0.6 + 0.04 * slope - 0.18 * Math.min(1, dy / 50) + 0.12 * (fbm(x / 4, y / 9, 32, 3) - 0.5) + 0.06 * (fbm(x / 40, y / 14, 33, 2) - 0.5);
                if (dy < 1) v += 0.2;
                v -= 0.38 * shade[y * width + x];
                p.solid(x, y, R.HILL, v);
            }
        }
        trees.forEach(t => paintTree(p, t.x, t.gy, t.h, t.seed));
        return p.canvas();
    }
    const MEADOW_Y0 = 236, FENCE_BASE = 284, POST_H = 23, RAILS = [9, 18];
    const PATCHES = [[110, 296], [300, 326], [520, 304], [610, 330], [760, 300]];
    const TILE = { x: 548, y: 314, cols: 5, rows: 2, w: 9, h: 6,                 // the wrong one: the same five flowers, a perfect grid
        dots: [[1, 1, 'PETAL_W', 3], [5, 0, 'PETAL_Y', 3], [3, 3, 'PETAL_V', 3], [7, 4, 'PETAL_W', 2], [0, 5, 'PETAL_Y', 2]] };
    function paintMeadow(width) {
        const NH = PH - MEADOW_Y0, p = P.painter(width, NH, false), shade = new Float32Array(width * NH);
        const dark = (x, y, a = 1) => { x = Math.round(x); y = Math.round(y) - MEADOW_Y0; if (x >= 0 && y >= 0 && x < width && y < NH) shade[y * width + x] = Math.max(shade[y * width + x], a); };
        const at = (x, y, rp, v) => p.solid(x, y - MEADOW_Y0, rp, v);
        const top = x => 246 + 3 * fbm(x / 70, 2.5, 41, 2);
        const fences = [[20, width - 20]];
        const rand = seeded(57), posts = [];
        fences.forEach(([x0, x1]) => { for (let x = x0; x <= x1; x += 40 + Math.floor(rand() * 8)) posts.push({ x, h: POST_H - Math.floor(rand() * 3) }); });
        posts.forEach(({ x, h }) => { for (let k = 0; k < h * 0.6; k++) dark(x - k, FENCE_BASE + 1 + k * 0.25); });
        fences.forEach(([x0, x1]) => RAILS.forEach(r => { for (let x = x0; x <= x1; x++) dark(x - r * 0.9, FENCE_BASE + 1 + r * 0.25, 0.8); }));
        for (let x = 0; x < width; x++) {                                           // the grass: fine upright streaks, the far edge lit gold
            const t0 = top(x) - 2 * hash(x, 3, 43);
            for (let y = Math.floor(t0); y < PH; y++) {
                const dy = y - t0, k = dy / (PH - t0);
                let v = 0.66 - 0.36 * k + 0.17 * (fbm(x / 2.2, y / 8, 42, 3) - 0.5) + 0.07 * (fbm(x / 50, y / 16, 44, 2) - 0.5);
                if (dy < 1.2) v += 0.16;
                v -= 0.3 * shade[(y - MEADOW_Y0) * width + x];
                at(x, y, R.HILL, v);
            }
        }
        const tileBox = [TILE.x - 4, TILE.y - 4, TILE.x + TILE.cols * TILE.w + 4, TILE.y + TILE.rows * TILE.h + 4];
        const fr = seeded(71), petals = [R.PETAL_W, R.PETAL_W, R.PETAL_Y, R.PETAL_V];
        for (let i = 0; i < width / 5; i++) {                                       // single wild flowers, more near us; never in the tiled patch
            const x = Math.floor(fr() * width), y = Math.floor(252 + Math.pow(fr(), 0.7) * 92), rp = petals[Math.floor(fr() * 4)];
            if (x > tileBox[0] && x < tileBox[2] && y > tileBox[1] && y < tileBox[3]) continue;
            at(x, y, rp, 0.5 + 0.3 * fr() + 0.2 * ((y - 252) / 92));
        }
        PATCHES.forEach(([cx, cy], i) => {                                          // loose clusters, every flower a little different
            const pr = seeded(500 + i * 7), rx = 12 + pr() * 8, ry = 4 + pr() * 2, n = 18 + Math.floor(pr() * 14);
            for (let k = 0; k < n; k++) {
                const a = pr() * TAU, r = Math.sqrt(pr()), x = cx + Math.cos(a) * r * rx, y = cy + Math.sin(a) * r * ry;
                const pick = pr(), rp = pick < 0.5 ? R.PETAL_W : pick < 0.8 ? R.PETAL_Y : R.PETAL_V;
                at(x, y + 1, R.HILL, 0.28);
                at(x, y, rp, 0.62 + 0.3 * pr());
                if (pr() < 0.35) at(x + 1, y, rp, 0.92);
            }
        });
        for (let r = 0; r < TILE.rows; r++) for (let c = 0; c < TILE.cols; c++) TILE.dots.forEach(([dx, dy, name, k]) => {   // every colour exact: no dither
            const x = TILE.x + c * TILE.w + dx, y = TILE.y + r * TILE.h + dy;
            p.set(x, y + 1 - MEADOW_Y0, R.HILL.rgb[2]);
            p.set(x, y - MEADOW_Y0, R[name].rgb[k]);
        });
        fences.forEach(([x0, x1]) => RAILS.forEach(r => {                          // the rails, then the posts: old wood, lit on the right
            const y = FENCE_BASE - r;
            for (let x = x0; x <= x1; x++) {
                const knot = hash(x, r, 61) > 0.93 ? -0.18 : 0, grain = 0.08 * (hash(x >> 2, r, 62) - 0.5);
                at(x, y - 1, R.WOOD, 0.72 + grain + knot);
                at(x, y, R.WOOD, 0.42 + grain + knot);
            }
        }));
        posts.forEach(({ x, h }) => {
            for (let y = FENCE_BASE - h; y <= FENCE_BASE; y++) [0.3, 0.5, 0.78].forEach((v, i) => {
                at(x + i, y, R.WOOD, v + (y === FENCE_BASE - h ? 0.15 : 0) + 0.08 * (hash(x + i, y, 63) - 0.5));
            });
        });
        return p.canvas();
    }
    /** The grass in front: dark tufts with gold tips, the light behind them. It never moves. */
    function paintTufts(width) {
        const Y0 = 300, TH = PH - Y0, p = P.painter(width, TH, false), rand = seeded(91);
        for (let x = 0; x < width; x++) {
            const baseTop = TH - 10 - 6 * fbm(x / 30, 0, 92, 2);
            for (let y = Math.floor(baseTop); y < TH; y++) p.solid(x, y, R.LEAF, 0.1 + 0.06 * (hash(x, y, 93) - 0.5) + (y === Math.floor(baseTop) ? 0.12 : 0));
        }
        for (let x = 0; x < width;) {
            x += 5 + rand() * 12;
            const n = 4 + Math.floor(rand() * 6), tall = rand() < 0.12 ? 1.8 : 1;
            for (let i = 0; i < n; i++) {
                const bx = x + (rand() - 0.5) * 8, bh = (10 + rand() * 16) * tall, lean = (rand() - 0.5) * 0.7 + 0.15;
                for (let s = 0; s < bh; s++) {
                    const u = s / bh, px = bx + lean * bh * u * u * 0.6, py = TH - 4 - s;
                    p.solid(px, py, R.LEAF, 0.1 + 0.16 * u + (u > 0.82 ? 0.32 : 0));
                    if (u < 0.3) p.solid(px + 1, py, R.LEAF, 0.1);
                }
            }
        }
        return { canvas: p.canvas(), y0: Y0 };
    }
    /** A low stone in the grass for the one who sits (the mockup's boulder, in Eden's light: lit from the sun on the right). */
    function paintStone(g, hx, floorY) {
        const rx = 17, ry = SEAT / 2 + 1, cy = floorY - ry + 2, w = rx * 2 + 4, h = ry * 2 + 4, p = P.painter(w, h, false), ox = hx - rx - 2, oy = cy - ry - 2;
        p.region(0, 0, w, h, (x, y) => {
            const nx = (x + ox + 0.5 - hx) / rx, ny = (y + oy + 0.5 - cy) / ry, q = Math.abs(nx) ** 3 + Math.abs(ny) ** 2.2;
            if (q >= 1 - 0.12 * (fbm(x / 3, y / 3, 71, 2) - 0.5)) return;
            const lam = clamp01(0.4 * nx - 0.85 * ny + 0.1), lip = ny < 0 && q > 0.72 && nx > -0.4 ? 0.12 : 0;
            p.solid(x, y, R.STONE, 0.2 + 0.5 * lam + lip + 0.1 * (fbm(x / 4, y / 4, 61, 3) - 0.5));
        });
        g.drawImage(p.canvas(), ox, oy);
    }

    function build(W, H, ids, node) {
        const oy = H - PH, width = W + 60, set = new Set(ids || []);
        const cloudCanvas = new Map();
        const clouds = CLOUDS.map(c => {
            const key = c.seed + ':' + c.w + 'x' + c.h;
            if (!cloudCanvas.has(key)) cloudCanvas.set(key, paintCloud(c.seed, c.w, c.h));   // the repeated cloud is ONE picture
            return { ...c, canvas: cloudCanvas.get(key) };
        });
        // the ground: the near hill with our Lander on it, the meadow with a stone for the one who sits
        const mid = paintMid(width), meadow = paintMeadow(width);
        if (SHIP && typeof SHIP.lander === 'function') {
            const sx = Math.round(W * 0.934);                                       // on the near hill, right, below the sun
            try { SHIP.lander(mid.getContext('2d'), { x: sx, y: Math.round(midTop(sx)) + 6, len: 30, angle: Math.PI / 2, legs: 'down', anchor: 1.1, sunDir: [-1, -0.3], light: 0.8 }); } catch (err) { console.warn('NSEdenArt: no Lander', err); }
        }
        const shift = Math.round(W / 2) - GROUP_MID;                                // the group stays in the middle, whatever the width
        const group = Object.keys(PLACES).filter(id => set.has(id)).map(id => ({ id, ...PLACES[id], x: PLACES[id].x + shift, seed: Object.keys(PLACES).indexOf(id) * 337 }));
        const sitter = group.find(m => m.act === 'sit');
        if (sitter) paintStone(meadow.getContext('2d'), sitter.x - 4 + 2, FEET + (sitter.dy || 0) - MEADOW_Y0);
        const eden = {
            W, H, oy, sky: paintSky(W, H, oy), clouds, far: paintFar(width), mid, meadow, tufts: paintTufts(width), group, node: node || null,
            frames: [], radii: RADII.slice(), space: null, L: P.norm3(-0.35, -0.3, 0.88),
        };
        return eden;
    }

    /** The meadow as the camera rises out of it (rise 0..1: the layers slide down, the nearer the faster; the sky stays). */
    function drawMeadow(ctx, eden, t, ms, rise = 0) {
        const { W, H, oy } = eden, E = window.MiniCrewEngine, k = smooth(0, 1, rise) * H * 1.15, drop = f => Math.round(k * f);
        ctx.drawImage(eden.sky, 0, 0);
        const drift = ms / 1000 * CLOUD_DRIFT;
        eden.clouds.forEach(c => {
            const x = Math.round(((c.x - drift) % (W + 220) + (W + 220)) % (W + 220) - 110);
            ctx.drawImage(c.canvas, x, c.y + oy + drop(FACTOR.cloud));
        });
        ctx.drawImage(eden.far, 0, oy + drop(FACTOR.far));
        ctx.drawImage(eden.mid, 0, oy + drop(FACTOR.mid));
        ctx.drawImage(eden.meadow, 0, MEADOW_Y0 + oy + drop(FACTOR.near));
        if (E) eden.group.forEach(m => {
            const act = m.at && t >= m.at ? m.act : 'idle', y = FEET + (m.dy || 0) + oy + drop(FACTOR.near);
            if (y - 110 > H) return;
            try { E.draw(ctx, m.id, act, ms + m.seed, m.x, act === 'sleep' ? y - 1 : y, { facing: m.face, warm: 2, rim: 1, seed: m.seed }); } catch (err) { /* left out */ }
        });
        ctx.drawImage(eden.tufts.canvas, 0, eden.tufts.y0 + 16 + oy + drop(FACTOR.tuft));
    }

    // ════════════════════════════════════════ the pull back: Eden from orbit, in steps, then one cold point ═══════════════════
    const RADII = [150, 116, 90, 70, 54, 42, 32, 24, 18, 13, 9, 6, 4, 3];
    function space(eden) {
        if (eden.space) return eden.space;
        const p = P.painter(eden.W, eden.H, true);
        const stars = P.scatterStars(p, 83, Math.round(eden.W * eden.H / 2600), () => true);
        eden.space = { canvas: p.canvas(), stars: P.keepVisible(p, stars) };
        return eden.space;
    }
    function paintGlobe(eden, r) {
        const Wd = window.NSWorlds, node = eden.node;
        let reach = 1.9;
        if (Wd && typeof Wd.reach === 'function') { try { reach = Math.max(1.05, Wd.reach(node, 6, 'EDEN') || reach); } catch (err) { /* the default */ } }
        const half = Math.ceil(r * reach) + 4, p = P.painter(half * 2, half * 2, false);
        const o = node ? { cx: half, cy: half, r, node, sector: 6, L: eden.L } : { cx: half, cy: half, r, type: 'EDEN', seed: 41, sector: 6, L: eden.L };
        let painted = false;
        if (Wd && typeof Wd.paint === 'function') { try { Wd.paint(p, o); painted = true; } catch (err) { console.error('NSEdenArt: NSWorlds.paint failed', err); } }
        if (!painted) P.sphere(p, { cx: half, cy: half, r, ramp: P.RP.ICE, L: eden.L, surface: P.surfaceFor('ice', 41, eden.L), atmo: { ramp: P.RP.ICE, w: Math.max(2, Math.round(r / 22)) } });
        return { canvas: p.canvas(), half, r };
    }
    function bakeNext(eden) {
        space(eden);
        if (eden.frames.length >= eden.radii.length) return false;
        eden.frames.push(paintGlobe(eden, eden.radii[eden.frames.length]));
        return eden.frames.length < eden.radii.length;
    }
    /** k 0..1: the world shrinks in steps from filling the view to a few pixels, then it is a cold point (from k = POINT_AT). */
    const POINT_AT = 0.86, POINT_Y = 0.32;
    function drawGlobe(ctx, eden, k, ms) {
        const { W, H } = eden, sp = space(eden), f = P.framer(ctx, W, H);
        ctx.drawImage(sp.canvas, 0, 0);
        P.twinkle(f, sp.stars, Math.floor(ms / 125) * 125);
        const cx = W >> 1, n = eden.radii.length;
        if (k < POINT_AT) {                                                         // it drifts up as it shrinks: the point ends high, clear of the words
            const i = Math.min(n - 1, Math.floor(k / POINT_AT * n));
            while (eden.frames.length <= i) bakeNext(eden);                          // not baked in time: now
            const fr = eden.frames[i], cy = Math.round(H * (POINT_Y + 0.28 * (1 - i / (n - 1))));
            ctx.drawImage(fr.canvas, cx - fr.half, cy - fr.half);
            return;
        }
        const cy = Math.round(H * POINT_Y), blink = Math.floor(ms / 700) % 5 === 0;   // one cold point of light in the dark
        f.px(cx, cy, R.POINT[0]);
        if (!blink) { f.px(cx - 1, cy, R.POINT[1]); f.px(cx + 1, cy, R.POINT[1]); f.px(cx, cy - 1, R.POINT[1]); f.px(cx, cy + 1, R.POINT[1]); }
        f.px(cx - 2, cy, R.POINT[2]); f.px(cx + 2, cy, R.POINT[2]);
    }

    window.NSEdenArt = Object.freeze({ build, bakeNext, drawMeadow, drawGlobe, SETTLE, POINT_AT });
})();
