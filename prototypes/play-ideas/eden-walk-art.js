/* ═══ Silent Exodus · play ideas · eden-walk-art.js: the meadow on Eden, painted once ═════════════════════════════════════
   What it is: every still picture of EDEN'S WALK (eden-walk.html), painted at load into pixel buffers with the game's own
   recipe (window.MiniPaint: the copy of src/newscreen/art/Paint.js that the minigames use; MiniLab.js loads it). The play
   (eden-walk.js) only moves these layers and draws the few live things over them.
   House style (docs/ART_STYLE.md): ramps that start at the ink, 8 x 8 Bayer dither, seeded noise, one light. Eden is the lie,
   so here the warmth is everywhere: a low gold light from the false sun, lit rims on the right, long shadows to the left.
   Picture: 640 x 360 art pixels (exactly 3 screen pixels each at 1920 x 1080, 2 at 1280 x 720).

   THE WRONG THINGS painted here (the play decides when they count):
     one tree on the far hill has no shadow (mid.trees[i].noShadow)
     two clouds are the same cloud (clouds with the same seed: rep 'a' and 'b')
     one flower patch is a tile repeated in a perfect grid (meadow.tiled)
   Everything else (the other trees, clouds and patches, the fence, the bench) is plain and lovely.

   window.EdenArt (frozen)
     W, H, SUN { x, y, core }, HORIZON, FACTOR { cloud, far, mid, near, tuft } (parallax), CLOUD_DRIFT (px/s), R (ramps)
     build(travel) → { sky, clouds, far, mid, meadow, tufts, veilTop, veilLow }   travel: how far the near layer scrolls (px)
       sky        canvas W x H
       clouds     [{ canvas, x, y, w, h, seed, rep }]   x in cloud space (screen x = x - cam * FACTOR.cloud - clock * DRIFT)
       far, mid   { canvas, factor }  full-height strips, clear above the hills; mid.trees [{ x, gy, h, noShadow }]
       meadow     { canvas, y0, fences [[x0, x1]], bench { x0, x1, y0, y1 }, patches [box], tiled box }  (boxes in world px)
       tufts      { canvas, y0, factor }  the dark grass in front
       veilTop, veilLow   ink in fine dithered steps: the sky darkening toward the start's corner; the grass under the voice */
(function () {
    'use strict';
    const P = window.MiniPaint;
    if (!P) { console.error('EdenArt: MiniPaint must load first (MiniLab.js loads it)'); return; }
    const { INK, ramp, painter, fbm, hash, seeded, clamp01, smooth, lightGlow, threshold, hexRgb } = P;
    const TAU = Math.PI * 2;
    const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

    const W = 640, H = 360;
    const SUN = Object.freeze({ x: 478, y: 92, core: 7 });
    const HORIZON = 210;
    // parallax: how much of the camera's travel each layer shows (the sky and the light never move)
    const FACTOR = Object.freeze({ cloud: 0.06, far: 0.12, mid: 0.35, near: 1, tuft: 1.35 });
    const CLOUD_DRIFT = 2.4;                                    // the wind moves the clouds (and the petals). Not the grass.

    // ── ramps: one per material, every one from the ink ──
    const R = Object.freeze({
        SKY: ramp(INK, '#0c1622', '#16263a', '#25394e', '#3e5464', '#6a7372', '#a48c6c', '#d8ae78', '#f4d29a', '#fff3dc'),
        CLOUD: ramp(INK, '#2a2e3c', '#4c4a58', '#7c6c70', '#b4927e', '#e2b98e', '#f8dcb4', '#fff1dc'),
        FAR: ramp(INK, '#101c26', '#1a2c36', '#28404a', '#3c5658', '#5a7068', '#869078', '#b4a884'),
        HILL: ramp(INK, '#0c170f', '#152616', '#21391c', '#345022', '#4e6a2a', '#748636', '#a8a44c', '#d6c26a'),
        LEAF: ramp(INK, '#0a140c', '#132216', '#1e321a', '#2e4a20', '#46642a', '#6c8034', '#a2a046', '#d0bc62'),
        BARK: ramp(INK, '#160f0a', '#2a1d14', '#44301f', '#634a30', '#8a6a44'),
        WOOD: ramp(INK, '#1a110b', '#33231a', '#523a28', '#76563a', '#9e7a52', '#caa474'),
        PETAL_W: ramp(INK, '#4a4440', '#8e8478', '#d8ccb4', '#f6eedc'),
        PETAL_Y: ramp(INK, '#3a2a0c', '#7a5a18', '#c8962a', '#f2cc5a'),
        PETAL_V: ramp(INK, '#2a1e36', '#4e3a64', '#7c62a0', '#b49ad0'),
    });
    const lum = c => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];

    // ── the sky and the light ──
    function paintSky() {
        const p = painter(W, H, true);
        p.region(0, 0, W, H, (x, y) => {
            const k = clamp01(y / HORIZON), d = Math.hypot((x - SUN.x) * 0.55, (y - SUN.y) * 1.3);
            const v = 0.36 + 0.54 * Math.pow(k, 1.5) + 0.2 * Math.exp(-d / 110) + 0.06 * (fbm(x / 120, y / 7, 5, 3) - 0.5);
            p.solid(x, y, R.SKY, v);
        });
        // the light is the travel view's false sun (lightGlow), painted on its own. It was made for black space, so on a day
        // sky only the pixels brighter than the sky behind them are kept.
        const g = painter(W, H, false);
        lightGlow(g, SUN.x, SUN.y, { core: SUN.core, halo: 26, strength: 0.8, spikes: 0 });
        p.region(SUN.x - 110, SUN.y - 110, SUN.x + 110, SUN.y + 110, (x, y) => {
            const c = g.get(x, y);
            if (c[3] && lum(c) > lum(p.get(x, y))) p.set(x, y, c);
        });
        return p.canvas();
    }

    // ── clouds: a few soft blobs roughened by noise, lit from the upper right, a darker underside ──
    const CLOUDS = [
        { x: 30, y: 40, w: 96, h: 26, seed: 11 }, { x: 190, y: 22, w: 70, h: 20, seed: 23 },
        { x: 330, y: 52, w: 84, h: 24, seed: 37, rep: 'a' }, { x: 470, y: 18, w: 110, h: 28, seed: 51 },
        { x: 600, y: 52, w: 84, h: 24, seed: 37, rep: 'b' },              // the same cloud again, at the same height
        { x: 780, y: 30, w: 92, h: 24, seed: 63 }, { x: 950, y: 62, w: 76, h: 22, seed: 77 }, { x: 1080, y: 24, w: 100, h: 26, seed: 89 },
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
            if (m < -0.2) return m;                                 // noise roughens the edge; it never makes loose specks
            m += 0.4 * (fbm(x / 9, y / 6, seed, 3) - 0.5);
            if (y > h * 0.74) m -= (y - h * 0.74) * 0.09;           // a flatter base
            return m;
        };
        const p = painter(w, h, false);
        p.region(0, 0, w, h, (x, y) => {
            if (dens(x + 0.5, y + 0.5) <= IN) return;
            let v = 0.56 + 0.3 * (x / w - 0.5) + 0.3 * (0.5 - y / h) + 0.18 * (fbm(x / 6, y / 5, seed + 3, 2) - 0.5);
            if (dens(x + 2.5, y - 1.5) <= IN) v += 0.32;              // the edge toward the light
            else if (dens(x + 0.5, y + 3.5) <= IN) v -= 0.14;         // the underside
            p.solid(x, y, R.CLOUD, clamp(v, 0.26, 1));
        });
        return p.canvas();
    }

    // ── the far hills: hazy blue-green, a lit crest, gold mist in the valleys ──
    function paintFar(width) {
        const top = x => 176 + 20 * fbm(x / 150, 0.5, 21, 3) + 5 * Math.sin(x / 70);
        const p = painter(width, H, false);
        for (let x = 0; x < width; x++) {
            const t0 = top(x), slope = clamp(top(x + 3) - top(x - 3), -4, 4);
            for (let y = Math.floor(t0); y < 270; y++) {
                const dy = y - t0;
                let v = 0.68 - 0.1 * Math.min(1, dy / 40) + 0.1 * (fbm(x / 26, y / 10, 22, 3) - 0.5) + 0.035 * slope + 0.16 * smooth(12, 40, dy);
                if (dy < 1) v += 0.22;
                p.solid(x, y, R.FAR, v);
            }
        }
        return { canvas: p.canvas(), factor: FACTOR.far };
    }

    // ── the near hill and its trees; every tree throws a shadow to the left but one. The shadows start at the trunk and are
    //    short enough that you can tell whose is whose, so the one tree without one stands out ──
    const TREES = [
        { x: 40, h: 34 }, { x: 150, h: 44 }, { x: 196, h: 30 }, { x: 330, h: 50 }, { x: 470, h: 36 }, { x: 540, h: 40, noShadow: true },
        { x: 690, h: 46 }, { x: 742, h: 32 }, { x: 900, h: 52 }, { x: 1080, h: 38 }, { x: 1150, h: 44 }, { x: 1300, h: 36 },
    ];
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
            if (bq > edge - 0.18 && toward > 0.2) v += 0.22;            // the lit edge
            p.solid(px, py, R.LEAF, clamp(v, 0.08, 1));
        });
    }
    function paintMid(width) {
        const top = x => 206 + 16 * fbm(x / 170, 1.5, 31, 3) + 6 * Math.sin(x / 110 + 1);
        const p = painter(width, H, false), shade = new Float32Array(width * H);
        const dark = (x, y) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < width && y < H) shade[y * width + x] = 1; };
        const trees = TREES.map((t, i) => ({ ...t, gy: Math.round(top(t.x)) + 1, seed: 300 + i * 13 }));
        trees.filter(t => !t.noShadow).forEach(t => {                   // the low sun throws shadows to the left, from the trunk
            const len = t.h * 1.15, mid = t.x - len * 0.45, rx = len * 0.42, ry = 1.5 + t.h * 0.09;
            for (let k = 0; k < len * 0.3; k++) dark(t.x - 1 - k, top(t.x - 1 - k) + 1.5 + k * 0.1);
            for (let sx = mid - rx; sx <= mid + rx; sx++) {
                const u = (sx - mid) / rx, half = ry * Math.sqrt(Math.max(0, 1 - u * u)), sy = top(sx) + 2 + (t.x - sx) * 0.1;
                for (let sy2 = sy - half; sy2 <= sy + half; sy2++) dark(sx, sy2);
            }
        });
        for (let x = 0; x < width; x++) {
            const t0 = top(x), slope = clamp(top(x + 3) - top(x - 3), -4, 4);
            for (let y = Math.floor(t0); y < 276; y++) {
                const dy = y - t0;
                let v = 0.6 + 0.04 * slope - 0.18 * Math.min(1, dy / 50) + 0.12 * (fbm(x / 4, y / 9, 32, 3) - 0.5) + 0.06 * (fbm(x / 40, y / 14, 33, 2) - 0.5);
                if (dy < 1) v += 0.2;
                v -= 0.38 * shade[y * width + x];
                p.solid(x, y, R.HILL, v);
            }
        }
        trees.forEach(t => paintTree(p, t.x, t.gy, t.h, t.seed));
        return { canvas: p.canvas(), factor: FACTOR.mid, trees: trees.map(({ x, gy, h, noShadow }) => ({ x, gy, h, noShadow: !!noShadow })) };
    }

    // ── the meadow the crew walk across: lit grass, a wooden fence, a bench, wild flowers, one patch that tiles ──
    const MEADOW_Y0 = 236;
    const FENCES = [[60, 1360], [1880, 2520]];
    const BENCH = { x0: 1180, x1: 1224, base: 292 };
    const PATCHES = [[150, 296], [420, 326], [610, 304], [860, 330], [1010, 300], [1300, 328], [1760, 302], [1990, 330], [2240, 298],
        [2460, 326], [2700, 304]];
    const TILE = { x: 1560, y: 312, cols: 5, rows: 2, w: 9, h: 6,
        dots: [[1, 1, 'PETAL_W', 3], [5, 0, 'PETAL_Y', 3], [3, 3, 'PETAL_V', 3], [7, 4, 'PETAL_W', 2], [0, 5, 'PETAL_Y', 2]] };
    const FENCE_BASE = 284, POST_H = 23, RAILS = [9, 18];

    function paintMeadow(width) {
        const NH = H - MEADOW_Y0, p = painter(width, NH, false), shade = new Float32Array(width * NH);
        const dark = (x, y, a = 1) => { x = Math.round(x); y = Math.round(y) - MEADOW_Y0; if (x >= 0 && y >= 0 && x < width && y < NH) shade[y * width + x] = Math.max(shade[y * width + x], a); };
        const at = (x, y, rp, v) => p.solid(x, y - MEADOW_Y0, rp, v);
        const top = x => 246 + 3 * fbm(x / 70, 2.5, 41, 2);

        // the fence: posts every forty-odd pixels, two rails; shadows fall left and toward us
        const rand = seeded(57), posts = [];
        FENCES.forEach(([x0, x1]) => { for (let x = x0; x <= x1; x += 40 + Math.floor(rand() * 8)) posts.push({ x, h: POST_H - Math.floor(rand() * 3) }); });
        posts.forEach(({ x, h }) => { for (let k = 0; k < h * 0.6; k++) dark(x - k, FENCE_BASE + 1 + k * 0.25); });
        FENCES.forEach(([x0, x1]) => RAILS.forEach(r => { for (let x = x0; x <= x1; x++) dark(x - r * 0.9, FENCE_BASE + 1 + r * 0.25, 0.8); }));
        for (let x = BENCH.x0 - 9; x <= BENCH.x1 - 9; x++) for (let y = 1; y <= 3; y++) dark(x, BENCH.base + y);

        // the grass: fine upright streaks, the far edge lit gold, darker toward us
        for (let x = 0; x < width; x++) {
            const t0 = top(x) - 2 * hash(x, 3, 43);
            for (let y = Math.floor(t0); y < H; y++) {
                const dy = y - t0, k = dy / (H - t0);
                let v = 0.66 - 0.36 * k + 0.17 * (fbm(x / 2.2, y / 8, 42, 3) - 0.5) + 0.07 * (fbm(x / 50, y / 16, 44, 2) - 0.5);
                if (dy < 1.2) v += 0.16;
                v -= 0.3 * shade[(y - MEADOW_Y0) * width + x];
                at(x, y, R.HILL, v);
            }
        }

        // single wild flowers everywhere, more of them near us; never inside the tiled patch, so it stays clean
        const tileBox = [TILE.x - 4, TILE.y - 4, TILE.x + TILE.cols * TILE.w + 4, TILE.y + TILE.rows * TILE.h + 4];
        const fr = seeded(71), petals = [R.PETAL_W, R.PETAL_W, R.PETAL_Y, R.PETAL_V];
        for (let i = 0; i < width / 5; i++) {
            const x = Math.floor(fr() * width), y = Math.floor(252 + Math.pow(fr(), 0.7) * 92), rp = petals[Math.floor(fr() * 4)];
            if (x > tileBox[0] && x < tileBox[2] && y > tileBox[1] && y < tileBox[3]) continue;
            at(x, y, rp, 0.5 + 0.3 * fr() + 0.2 * ((y - 252) / 92));
        }
        // the patches: loose clusters, every flower a little different
        const patches = PATCHES.map(([cx, cy], i) => {
            const pr = seeded(500 + i * 7), rx = 12 + pr() * 8, ry = 4 + pr() * 2, n = 18 + Math.floor(pr() * 14);
            for (let k = 0; k < n; k++) {
                const a = pr() * TAU, r = Math.sqrt(pr()), x = cx + Math.cos(a) * r * rx, y = cy + Math.sin(a) * r * ry;
                const pick = pr(), rp = pick < 0.5 ? R.PETAL_W : pick < 0.8 ? R.PETAL_Y : R.PETAL_V;
                at(x, y + 1, R.HILL, 0.28);
                at(x, y, rp, 0.62 + 0.3 * pr());
                if (pr() < 0.35) at(x + 1, y, rp, 0.92);
            }
            return [cx - rx - 2, cy - ry - 3, cx + rx + 2, cy + ry + 3];
        });
        // THE WRONG ONE: the same tile of five flowers, repeated in a perfect grid, every colour exact (no dither)
        for (let r = 0; r < TILE.rows; r++) for (let c = 0; c < TILE.cols; c++) TILE.dots.forEach(([dx, dy, name, k]) => {
            const x = TILE.x + c * TILE.w + dx, y = TILE.y + r * TILE.h + dy;
            p.set(x, y + 1 - MEADOW_Y0, R.HILL.rgb[2]);
            p.set(x, y - MEADOW_Y0, R[name].rgb[k]);
        });

        // the rails, then the posts in front of them: old wood, lit on the right
        FENCES.forEach(([x0, x1]) => RAILS.forEach(r => {
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

        // the bench: two slats to sit on, two for the back, legs at the ends
        const { x0, x1, base } = BENCH;
        [x0 + 3, x1 - 4].forEach(lx => {
            for (let y = base - 9; y <= base; y++) { at(lx, y, R.WOOD, 0.34); at(lx + 1, y, R.WOOD, 0.62); }
            for (let y = base - 23; y <= base - 10; y++) { at(lx + 1, y, R.WOOD, 0.36); at(lx + 2, y, R.WOOD, 0.64); }
        });
        for (let x = x0; x <= x1; x++) {
            const g = 0.06 * (hash(x >> 2, 9, 64) - 0.5);
            at(x, base - 11, R.WOOD, 0.82 + g); at(x, base - 10, R.WOOD, 0.46 + g);
            [17, 21].forEach(r => { at(x + 1, base - r - 1, R.WOOD, 0.7 + g); at(x + 1, base - r, R.WOOD, 0.4 + g); });
        }

        const tiled = [TILE.x - 2, TILE.y - 2, TILE.x + TILE.cols * TILE.w + 1, TILE.y + TILE.rows * TILE.h + 1];
        return { canvas: p.canvas(), y0: MEADOW_Y0, fences: FENCES.map(f => f.slice()), bench: { x0, x1, y0: base - 25, y1: base + 1 }, patches, tiled,
            fenceBox: [FENCE_BASE - POST_H - 1, FENCE_BASE + 2] };
    }

    // ── the grass in front: dark tufts with gold tips, the light behind them. It never moves. ──
    function paintTufts(width) {
        const Y0 = 300, TH = H - Y0, p = painter(width, TH, false), rand = seeded(91);
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
        return { canvas: p.canvas(), y0: Y0, factor: FACTOR.tuft };
    }

    // ── the dark under words: on a day sky a box of shade reads as a panel, so the sky itself darkens toward the corner the
    //    words sit in, like dusk at the edge of the sky. Ink at a dithered strength in fine steps (never on/off ink, which
    //    reads as a screen door) ──
    const VEIL_STEPS = 7;
    function veil(strength) {
        const c = document.createElement('canvas'); c.width = W; c.height = H;
        const g = c.getContext('2d'), img = g.createImageData(W, H), d = img.data, ink = hexRgb(INK);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const a = Math.min(1, Math.floor(strength(x / W, y / H) * VEIL_STEPS + threshold(x, y)) / VEIL_STEPS), i = (y * W + x) * 4;
            d[i] = ink[0]; d[i + 1] = ink[1]; d[i + 2] = ink[2]; d[i + 3] = Math.round(a * 255);
        }
        g.putImageData(img, 0, 0);
        return c;
    }

    function build(travel) {
        const cloudCanvas = new Map();
        const clouds = CLOUDS.map(c => {
            const key = c.seed + ':' + c.w + 'x' + c.h;
            if (!cloudCanvas.has(key)) cloudCanvas.set(key, paintCloud(c.seed, c.w, c.h));   // the repeated cloud is ONE picture
            return { ...c, rep: c.rep || null, canvas: cloudCanvas.get(key) };
        });
        return {
            sky: paintSky(),
            clouds,
            far: paintFar(Math.ceil(W + travel * FACTOR.far + 40)),
            mid: paintMid(Math.ceil(W + travel * FACTOR.mid + 40)),
            meadow: paintMeadow(Math.ceil(W + travel * FACTOR.near + 60)),
            tufts: paintTufts(Math.ceil(W + travel * FACTOR.tuft + 60)),
            veilTop: veil((u, v) => 0.86 * (1 - smooth(0.42, 1, Math.hypot(u / 0.75, v / 0.6)))),          // the start's words
            veilLow: veil((u, v) => 0.72 * (1 - smooth(0.3, 0.68, u)) * smooth(0.66, 0.86, v)),            // the voice, low left
        };
    }

    window.EdenArt = Object.freeze({ W, H, SUN, HORIZON, FACTOR, CLOUD_DRIFT, R, build });
})();
