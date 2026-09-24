/* SceneArt — the picture at the top of a scene card, so the player SEES the strange place instead of only reading about it.
   One wide dithered picture (480 x 160) per place: the graveyard that runs to the horizon, the archive's shelves rising into
   cloud, seventeen dead ships in a ring, our own ship holding position beside us, and the rest. Each picture is drawn once and
   kept; about eight times a second only the small moving parts are drawn on top (a blinking beacon, dust, birds, a slow crawl).
     has(key)            → true when there is a picture for that key (anomaly ids, 'GRAVE', 'GARDEN', 'LIGHTHOUSE', 'EXODUS_WRECK', …)
     mount(canvas, key)  → draws into the card's canvas and keeps it moving until the card is closed
     paint(ctx, key, t)  → one frame at t ms (lets a test page or harness paint any moment) */

(function () {
    'use strict';
    const W = 480, H = 160, TICK_MS = 125, NEVER_ATTACHED_MS = 5000;
    const INK = '#05070a';
    const BAYER8 = [0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22,
        3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21].map(v => (v + 0.5) / 64);
    const threshold = (x, y) => BAYER8[((y & 7) << 3) | (x & 7)];
    const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
    const smooth = (a, b, v) => { const k = clamp01((v - a) / (b - a)); return k * k * (3 - 2 * k); };
    function seeded(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
    const PERM = (() => { const rand = seeded(1337), perm = Array.from({ length: 256 }, (_, i) => i); for (let i = 255; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; } return Uint8Array.from(perm); })();
    const hash = (x, y, s = 0) => PERM[(PERM[(PERM[x & 255] + y) & 255] + s) & 255] / 255;   // a fixed shuffle: fast, and the same every run
    function vnoise(x, y, s = 0) {
        const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
        const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
        return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
    }
    function fbm(x, y, s = 0, octaves = 4) { let sum = 0, amp = 0.5, f = 1, norm = 0; for (let i = 0; i < octaves; i++) { sum += amp * vnoise(x * f, y * f, s + i * 17); norm += amp; f *= 2.03; amp *= 0.5; } return sum / norm; }

    // ── colour ramps, dark → light, from the game's palette. A ramp that starts at INK can fade into the dark. ──
    const hexRgb = hex => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
    const ramp = (...hex) => ({ hex, rgb: hex.map(hexRgb) });
    function level(r, v, x, y) { const top = r.hex.length - 1, pos = clamp01(v) * top, lo = Math.floor(pos); return Math.min(top, lo + (pos - lo > threshold(x, y) ? 1 : 0)); }
    const STAR = ramp(INK, '#27343a', '#61777d', '#c4d0c4', '#f2f8f2');
    const HAZE = ramp(INK, '#0c0b18', '#171430', '#261e4a');
    const BONE = ramp(INK, '#1a2320', '#3c4a44', '#7d8a82', '#c4d0c4');
    const HULL = ramp(INK, '#171d20', '#343f43', '#66747a', '#a6b3b3', '#e0e9e5');
    const RUST = ramp(INK, '#1e0f0d', '#4a2320', '#7a3a2e', '#a8604a', '#d6a882');
    const GREEN = ramp(INK, '#0f2a1c', '#2f5a48', '#74d99a', '#d6ffe4');
    const AMBER = ramp(INK, '#3a2610', '#8a5f22', '#d9a24a', '#ffe6a0');
    const RED = ramp(INK, '#3a1210', '#a8453c', '#d85a4e', '#ffd0c0');
    const VIOLET = ramp(INK, '#1c1236', '#3a1f66', '#8844ff', '#c9b4ff', '#f0eaff');
    const SUN = ramp(INK, '#6a4a18', '#d9a24a', '#ffe6a0', '#fffaf0');
    const MOON = ramp(INK, '#141a20', '#2c363f', '#58666f', '#9aa8ae', '#dde6e8');
    const PALE_SKY = ramp(INK, '#10161a', '#28322f', '#56625b', '#98a49a', '#c4d0c4');
    const REGOLITH = ramp(INK, '#101416', '#20282a', '#39433f', '#5d6862', '#8a968e');
    const STONE = ramp(INK, '#1a211f', '#323d39', '#5b6862', '#a5b3a7', '#dfe9dd');
    const SHELF = ramp(INK, '#0e1519', '#1d2a30', '#3a5058', '#7f9ca4', '#d5e6e8');
    const CLOUD = ramp(INK, '#141220', '#2a2640', '#4d4872', '#8a84b4', '#cfcbe8');
    const GRASS = ramp(INK, '#0f2a1c', '#1f4a2e', '#3f7a48', '#74d99a', '#c8f0c0');
    const SOIL = ramp(INK, '#1c120c', '#3a2416', '#5e3c22', '#8a6040');
    const WOOD = ramp(INK, '#2a1a0c', '#5a3a1a', '#8a5f22', '#c49a5a');
    const DUSK = ramp(INK, '#0d1016', '#1c1f26', '#3a3632', '#6e5c46', '#a88a60');
    const DUSK_WARM = ramp(INK, '#120d0c', '#2a1a14', '#4e2e1c', '#8a5a30', '#c8904a');
    const GROUND = ramp(INK, '#0e0f10', '#1d1d1c', '#34312c', '#56504a', '#7a7064');
    const WALL = ramp(INK, '#1a1614', '#342c26', '#5a4c40', '#8e7a64', '#c4ae90');
    const DAYLIGHT = ramp('#0a1a1c', '#1e3a3a', '#3f6a64', '#7fa89a', '#c6dccd', '#f2faf0');
    const NEBULA = ramp(INK, '#0c1418', '#16262c', '#26404a', '#3f6470', '#6f98a0');
    const PLANET = ramp(INK, '#0c141c', '#1a2c3a', '#34546a', '#6a8ea4', '#b8d0dc');

    // ── the static layer: an RGBA buffer painted once per picture ──
    function painter() {
        const data = new Uint8ClampedArray(W * H * 4), ink = hexRgb(INK);
        for (let i = 0; i < W * H; i++) { data[i * 4] = ink[0]; data[i * 4 + 1] = ink[1]; data[i * 4 + 2] = ink[2]; data[i * 4 + 3] = 255; }
        const set = (x, y, rgb) => { x = Math.floor(x); y = Math.floor(y); if (x < 0 || y < 0 || x >= W || y >= H) return; const o = (y * W + x) * 4; data[o] = rgb[0]; data[o + 1] = rgb[1]; data[o + 2] = rgb[2]; };
        const get = (x, y) => { const o = (y * W + x) * 4; return [data[o], data[o + 1], data[o + 2]]; };
        const tone = (x, y, r, v) => set(x, y, r.rgb[level(r, v, Math.floor(x), Math.floor(y))]);
        const cover = (x, y, r, v, a) => { if (a > threshold(Math.floor(x) + 3, Math.floor(y) + 5)) tone(x, y, r, v); };   // see-through: only some pixels
        const region = (x0, y0, x1, y1, fn) => { for (let y = Math.max(0, Math.floor(y0)); y < Math.min(H, Math.ceil(y1)); y++) for (let x = Math.max(0, Math.floor(x0)); x < Math.min(W, Math.ceil(x1)); x++) fn(x, y); };
        const ellipse = (cx, cy, rx, ry, fn) => region(cx - rx - 1, cy - ry - 1, cx + rx + 1, cy + ry + 1, (x, y) => { const q = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2; if (q < 1) fn(x, y, q); });
        const line = (x0, y0, x1, y1, fn) => { const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0))); for (let k = 0; k <= n; k++) fn(Math.round(x0 + (x1 - x0) * k / n), Math.round(y0 + (y1 - y0) * k / n), k / n); };
        function poly(pts, fn) {
            const ys = pts.map(q => q[1]), y0 = Math.max(0, Math.floor(Math.min(...ys))), y1 = Math.min(H - 1, Math.ceil(Math.max(...ys)));
            for (let y = y0; y <= y1; y++) {
                const cy = y + 0.5, xs = [];
                pts.forEach(([ax, ay], i) => { const [bx, by] = pts[(i + 1) % pts.length]; if ((ay <= cy) !== (by <= cy)) xs.push(ax + (cy - ay) / (by - ay) * (bx - ax)); });
                xs.sort((a, b) => a - b);
                for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.max(0, Math.round(xs[k])); x < Math.min(W, Math.round(xs[k + 1])); x++) fn(x, y);
            }
        }
        return { data, set, get, tone, cover, region, ellipse, line, poly };
    }

    // ── the moving layer: a few fillRects a frame, straight onto the canvas ──
    function framer(ctx) {
        let current = '';
        const px = (x, y, hex, w = 1, h = 1) => {
            const xi = Math.round(x), yi = Math.round(y);
            if (xi + w <= 0 || yi + h <= 0 || xi >= W || yi >= H) return;
            if (hex !== current) { ctx.fillStyle = hex; current = hex; }                            // the canvas is slow to change colour: only when it must
            ctx.fillRect(xi, yi, w, h);
        };
        const tone = (x, y, r, v, w = 1, h = 1) => { const xi = Math.round(x), yi = Math.round(y), k = level(r, v, xi, yi); if (k === 0 && r.hex[0] === INK) return; px(xi, yi, r.hex[k], w, h); };
        const glow = (cx, cy, rad, r, peak) => { for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) { const d = Math.hypot(x, y) / rad; if (d < 1) tone(cx + x, cy + y, r, peak * (1 - d) ** 1.5); } };
        return { px, tone, glow };
    }

    // ── shared pieces ──
    function scatterStars(p, seed, count, where) {
        const rand = seeded(seed), list = [];
        for (let i = 0; i < count; i++) {
            const x = Math.floor(rand() * W), y = Math.floor(rand() * H), mag = rand();
            if (where && !where(x, y)) continue;
            if (mag > 0.975) { p.set(x, y, STAR.rgb[4]); [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dx, dy]) => p.set(x + dx, y + dy, STAR.rgb[2])); }
            else if (mag > 0.86) { p.set(x, y, STAR.rgb[3]); p.set(x + 1, y, STAR.rgb[2]); }
            else p.set(x, y, STAR.rgb[mag > 0.5 ? 2 : 1]);
            list.push({ x, y, mag });
        }
        return list;
    }
    /** Only the bright stars that nothing was painted over can twinkle later. */
    function keepVisible(p, list) {
        return list.filter(s => { if (s.mag < 0.86 || s.x < 0 || s.y < 0 || s.x >= W || s.y >= H) return false; const c = p.get(s.x, s.y); return STAR.rgb.slice(3).some(k => k[0] === c[0] && k[1] === c[1] && k[2] === c[2]); });
    }
    function twinkle(f, list, t) {
        const step = Math.floor(t / 375);
        list.forEach((s, i) => { if (hash(i, step, 5) < 0.86) return; f.px(s.x - 1, s.y, STAR.hex[3], 3, 1); f.px(s.x, s.y - 1, STAR.hex[3], 1, 3); f.px(s.x, s.y, STAR.hex[4]); });
    }
    function space(p, seed, count = 420, hazeAmount = 0.3) {
        p.region(0, 0, W, H, (x, y) => { const v = Math.max(0, fbm(x / 70, y / 38, seed, 4) - 0.42) * hazeAmount * 3; if (v > 0.03) p.tone(x, y, HAZE, v); });
        return scatterStars(p, seed + 1, count);
    }
    /** Drifting specks. Each has its own speed; they wrap round the picture. */
    function dust(f, t, count, box, r, seed, speed = 4) {
        const [x0, y0, x1, y1] = box; for (let i = 0; i < count; i++) {
            const v = speed * (0.5 + hash(i, 1, seed)), x = x0 + ((hash(i, 2, seed) * (x1 - x0) + t / 1000 * v) % (x1 - x0));
            const y = y0 + hash(i, 3, seed) * (y1 - y0) + Math.sin(t / 1300 + i) * 2;
            f.tone(x, y, r, 0.45 + hash(i, 4, seed) * 0.4, hash(i, 5, seed) > 0.5 ? 2 : 1, 1);
        }
    }

    /** Top and bottom of an Exodus-class hull at u (0 = nose, 1 = tail), in units of its height: round nose, raised bridge, engine block, fins. */
    function hullEdges(u) {
        if (u < 0 || u > 1) return null;
        const nose = u < 0.12 ? Math.sqrt(u / 0.12) : 1;
        let top = -0.5 * (0.35 + 0.65 * nose), bottom = 0.5 * (0.35 + 0.65 * nose);
        if (u > 0.14 && u < 0.36) top -= 0.2 * Math.min(1, (u - 0.14) / 0.04, (0.36 - u) / 0.05);
        if (u > 0.74 && u < 0.8) { top += 0.08; bottom -= 0.08; }
        if (u >= 0.8) { top -= 0.06; bottom += 0.06; }
        if (u > 0.86) { const fin = (u - 0.86) / 0.14; top -= 0.3 * fin; bottom += 0.3 * fin; }
        return [top, bottom];
    }
    /**
     * Draws an Exodus hull side on. o: { x, y, len, ht, angle, flip (nose to the right), ramp, light (0..1 dims it), holes, rust, seed,
     * from, to (0..1: a broken piece), anchor (the u that sits at x, y) }. Returns at(u, v) → [x, y] on screen, for masts and lights.
     */
    function drawHull(p, o) {
        const { len, ht } = o, c = Math.cos(o.angle || 0), s = Math.sin(o.angle || 0), dir = o.flip ? -1 : 1, seed = o.seed || 1;
        const from = o.from || 0, to = o.to == null ? 1 : o.to, anchor = o.anchor == null ? (from + to) / 2 : o.anchor, dim = o.light == null ? 1 : o.light;
        const at = (u, v) => { const along = (u - anchor) * len * dir, across = v * ht; return [o.x + along * c - across * s, o.y + along * s + across * c]; };
        const reach = len * Math.max(anchor - from, to - anchor) + ht;
        p.region(o.x - reach, o.y - reach, o.x + reach, o.y + reach, (x, y) => {
            const dx = x + 0.5 - o.x, dy = y + 0.5 - o.y, u = anchor + (dx * c + dy * s) * dir / len, v = (-dx * s + dy * c) / ht;
            const jag = (vnoise(v * 6, u * 4, seed) - 0.5) * 0.07;
            if ((from > 0 && u < from + jag) || (to < 1 && u > to + jag)) return;
            const e = hullEdges(u); if (!e || v < e[0] || v > e[1]) return;
            const mid = (e[0] + e[1]) / 2, half = (e[1] - e[0]) / 2, n = (v - mid) / half, px = u * len;
            let light = 0.7 - 0.42 * n;
            if ((v - e[0]) * ht < 1.4) light += 0.22;                                           // a bright rim along the top
            if (u > 0.8) light -= 0.14;                                                         // the engine block is darker metal
            if (px % 15 < 1 || Math.abs((v - mid) * ht - half * ht * 0.35) < 0.5) light -= 0.2; // hull plates
            if (u > 0.17 && u < 0.33 && (v - e[0]) * ht > 2 && (v - e[0]) * ht < 4.5 && px % 5 > 1.5) light = 0.12; // bridge windows, dark
            if (u > 0.985) light = 0.18;
            if (o.rust) light -= (fbm(px / 9, v * ht / 6, seed, 3) - 0.45) * 0.5;
            if (o.holes && fbm(px / 16, v * ht / 10, seed + 3, 3) > (o.holes === true ? 0.64 : o.holes)) light = px % 6 < 1.2 ? 0.3 : 0.05; // torn open: the frame shows through
            if ((from > 0 && u < from + jag + 0.02) || (to < 1 && u > to + jag - 0.02)) light *= 0.45;           // scorched break
            p.tone(x, y, o.ramp || HULL, light * dim);
        });
        return at;
    }

    // a small 3 × 5 font for hull numbers
    const GLYPHS = { 0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001', 5: '111100111001111', 6: '111100111101111', 7: '111001001001001', 8: '111101111101111', 9: '111101111001111',
        E: '111100111100111', X: '101101010101101', O: '111101101101111', D: '110101101101110', U: '101101101101111', S: '111100111001111', '-': '000000111000000', ' ': '000000000000000' };
    function text(str, x, y, scale, cell) {
        [...String(str)].forEach((ch, i) => { const g = GLYPHS[ch] || GLYPHS[' ']; for (let k = 0; k < 15; k++) if (g[k] === '1') cell(x + (i * 4 + (k % 3)) * scale, y + Math.floor(k / 3) * scale, scale); });
    }

    const SCENES = {};

    // ═══ THE GRAVE — a whole moon of stones, rows to every horizon, four names on each. An aisle leads toward the light. ═══
    const GRAVE = { horizon: 66, sunX: 322, sunY: 58, k: 96, nearZ: 1.0, rowStep: 1.15, stoneW: 20, stoneH: 36, pitch: 40, aisle: 26, dust: 16 };
    function graveStone(p, x0, base, w, h, isLeft, seed) {
        if (h < 2.4) { p.tone(x0 + w / 2, base - 1, STONE, 0.3); return; }
        const top = base - h, round = w * 0.45;
        p.region(x0 + 1, base, x0 + w - 1, base + Math.max(1, h * 0.25), (x, y) => p.tone(x, y, REGOLITH, 0.05));  // the light is behind: shadows fall toward us
        p.region(x0, top, x0 + w, base, (x, y) => {
            const u = (x + 0.5 - x0) / w * 2 - 1, edge = top + round * (1 - Math.sqrt(Math.max(0, 1 - u * u)));
            if (y + 0.5 < edge) return;
            let v = 0.2 + (fbm(x / 2, y / 2, seed, 2) - 0.5) * 0.1;
            if (y < edge + 1.3 && w > 3) v = 0.8;                                              // rim light along the top
            if (w > 5 && (isLeft ? u > 0.8 : u < -0.8)) v = Math.max(v, 0.6);                 // and down the side that faces the light
            p.tone(x, y, STONE, v);
        });
        if (h < 11) return;
        for (let n = 0; n < 4; n++) {                                                          // four names
            const y = Math.round(top + round * 0.9 + 3 + n * Math.max(2, h * 0.13)), x1 = x0 + w * 0.2, len = w * (0.45 + hash(seed, n) * 0.35), gap = x1 + len * (0.3 + hash(seed, n + 9) * 0.3);
            for (let x = Math.round(x1); x < x1 + len; x++) if (Math.abs(x + 0.5 - gap) > 0.8) p.tone(x, y, STONE, 0.68);
        }
    }
    SCENES.GRAVE = {
        build(p) {
            const G = GRAVE;
            p.region(0, 0, W, G.horizon, (x, y) => p.tone(x, y, PALE_SKY, 0.08 + 0.72 * Math.pow(y / G.horizon, 1.7) + 0.42 * Math.exp(-Math.hypot(x - G.sunX, (y - G.sunY) * 2.2) / 48)));
            const stars = scatterStars(p, 71, 320, (x, y) => y < G.horizon * 0.42 && Math.hypot(x - G.sunX, y - G.sunY) > 90);
            p.region(0, G.horizon, W, H, (x, y) => {
                const dy = y - G.horizon, sheen = 0.24 * Math.exp(-Math.abs(x - G.sunX) / (8 + dy * 1.5)) * Math.exp(-dy / 40);
                p.tone(x, y, REGOLITH, 0.15 + 0.4 * Math.exp(-dy / 8) + sheen + (fbm(x / 3, y / 2, 5, 2) - 0.5) * 0.14);
            });
            p.ellipse(G.sunX, G.sunY, 5, 5, (x, y, q) => p.tone(x, y, SUN, 1 - q * 0.35));
            const depths = []; for (let z = G.nearZ; G.k / z > 0.7; z *= G.rowStep) depths.push(z);
            for (let row = depths.length - 1; row >= 0; row--) {                               // far rows first; the near ones cover them
                const z = depths[row], base = G.horizon + G.k / z, w = G.stoneW / z, h = G.stoneH / z, offset = (row % 2) * G.pitch / 2 + hash(row, 1) * 6;
                const xFrom = (-G.sunX - w - 2) * z, xTo = (W - G.sunX + w + 2) * z;
                for (let X = Math.floor((xFrom - offset) / G.pitch) * G.pitch + offset; X < xTo; X += G.pitch) {
                    if (Math.abs(X) < G.aisle) continue;
                    graveStone(p, G.sunX + X / z - w / 2, base, w, h, X < 0, row * 977 + Math.round(X));
                }
            }
            return { stars: keepVisible(p, stars) };
        },
        frame(f, t, s) { twinkle(f, s.stars, t); dust(f, t, GRAVE.dust, [0, 100, W, 156], STONE, 3, 5); },
    };

    // ═══ THE ARCHIVE — inside a hollow moon: shelves of copied cargo, columns rising into cloud. One crate is ours. ═══
    const ARCH = { vx: 240, vy: 56, focal: 118, floor: 1.35, walls: [1, 2.7], period: [2.3, 2.9], tower: [1.55, 2.0], shelf: 0.26, bay: 0.42, motes: 26, edgePx: 1.8, cloudTop: 64 };
    function archiveSurface(x, y) {
        const dx = (x + 0.5 - ARCH.vx) / ARCH.focal, dy = (y + 0.5 - ARCH.vy) / ARCH.focal, ax = Math.abs(dx), side = dx < 0 ? 0 : 1;
        for (let k = 0; k < 2 && ax > 1e-4; k++) {
            const z = ARCH.walls[k] / ax, Y = dy * z; if (Y >= ARCH.floor) break;
            const m = (z + side * 0.9 + k * 0.5) % ARCH.period[k];
            if (m < ARCH.tower[k]) return { kind: 'shelf', z, Y, m, k, side };
        }
        if (dy > 0) { const z = ARCH.floor / dy; return { kind: 'floor', z, X: dx * z }; }
        return { kind: 'void', z: 60 };
    }
    function shelfTone(hit) {
        const { z, Y, m, k, side } = hit, cu = Math.floor(z / ARCH.bay), cv = Math.floor(Y / ARCH.shelf), fu = z / ARCH.bay - cu, fv = Y / ARCH.shelf - cv;
        const edge = ARCH.edgePx * z * z / (ARCH.walls[k] * ARCH.focal);                        // about two pixels wide, near or far
        if (m < edge || ARCH.tower[k] - m < edge) return [SHELF, 0.95];                        // the bright edge of each column
        if (fv > 0.86) return [SHELF, 0.62];                                                  // a shelf
        if (fu < 0.07) return [SHELF, 0.42];                                                  // an upright
        const h = hash(cu, cv, k * 7 + side);
        if (h > 0.2 && fv > 0.3 && fu > 0.14 && fu < 0.9) {
            if (h > 0.985) return [AMBER, 0.8];                                               // our crates, with our batch numbers
            return [SHELF, fv > 0.5 && fv < 0.6 && fu > 0.4 && fu < 0.6 ? 0.85 : 0.28 + h * 0.3];
        }
        return [SHELF, 0.1];
    }
    SCENES.ANOMALY_ARCHIVE = {
        build(p) {
            p.region(0, 0, W, H, (x, y) => {
                const hit = archiveSurface(x, y);
                const cloudV = 0.16 + (0.5 * fbm(x / 60, y / 20, 3) + 0.1) * smooth(110, 0, y) + 0.3 * smooth(ARCH.cloudTop, 0, y) + 0.35 * Math.exp(-Math.hypot(x - ARCH.vx, (y - ARCH.vy) * 1.6) / 46);
                let r = CLOUD, v = cloudV, fog = 1;
                if (hit.kind === 'shelf') { [r, v] = shelfTone(hit); fog = Math.max(1 - Math.exp(-hit.z / 7), smooth(-0.25, -1.7, hit.Y), 0.95 * smooth(ARCH.cloudTop, 6, y)); }
                else if (hit.kind === 'floor') {
                    r = SHELF; fog = 1 - Math.exp(-hit.z / 6);
                    v = 0.1 + 0.18 * Math.exp(-Math.abs(1 - Math.abs(hit.X)) * 5) + (hit.z % 0.5 < 0.03 ? 0.12 : 0);
                    if (Math.abs(hit.X) < 0.035 && hit.z % 0.8 < 0.3) { r = AMBER; v = 0.7; }         // lights set into the floor, down the aisle
                }
                if (fog > threshold(x + 3, y + 5)) p.tone(x, y, CLOUD, cloudV); else p.tone(x, y, r, v);
            });
            return {};
        },
        frame(f, t) {
            for (let i = 0; i < ARCH.motes; i++) {                                            // dust rising up the aisle into the cloud
                const x = ARCH.vx + (hash(i, 1, 9) - 0.5) * 300, y = H + 4 - ((hash(i, 2, 9) * (H + 8) + t / 1000 * (3 + hash(i, 3, 9) * 5)) % (H + 8));
                f.tone(x, y, CLOUD, 0.6 + hash(i, 4, 9) * 0.4, 1, 2);
            }
        },
    };

    // ═══ THE RING OF SHIPS — seventeen dead ships in a ring, all pointing inward at nothing, all playing our briefing. ═══
    const RING = { cx: 240, cy: 82, rx: 190, ry: 50, count: 17, turn: 0.21, tilt: 0.42, len: 44, ht: 10, blinkMs: 2400, onMs: 700 };
    SCENES.ANOMALY_CHORUS = {
        build(p) {
            const stars = space(p, 17, 440);
            for (let a = 0, k = 0; a < Math.PI * 2; a += 0.011, k++) if (k % 3 === 0) p.tone(RING.cx + RING.rx * Math.cos(a), RING.cy + RING.ry * Math.sin(a), BONE, 0.3);
            const ships = Array.from({ length: RING.count }, (_, i) => { const a = RING.turn + (i / RING.count) * Math.PI * 2; return { a, i, depth: Math.sin(a) }; }).sort((m, n) => m.depth - n.depth);
            const lights = ships.map(({ a, i, depth }) => {
                const scale = 1 + 0.42 * depth, dx = -Math.cos(a), dy = -Math.sin(a) * RING.tilt;
                const at = drawHull(p, { x: RING.cx + RING.rx * Math.cos(a), y: RING.cy + RING.ry * Math.sin(a), len: Math.max(7, RING.len * scale * Math.hypot(dx, dy)), ht: RING.ht * scale,
                    angle: Math.atan2(-dy, -dx), ramp: RUST, seed: i + 3, light: 0.82 + 0.18 * depth });
                return at(0.55, -0.45);
            });
            return { stars: keepVisible(p, stars), lights };
        },
        frame(f, t, s) {
            twinkle(f, s.stars, t);
            const isOn = t % RING.blinkMs < RING.onMs;                                        // every ship, the same recording, the same moment
            s.lights.forEach(([x, y]) => { if (isOn) { f.glow(x, y, 4, GREEN, 0.7); f.px(x - 1, y - 1, GREEN.hex[4], 2, 2); } else f.px(x, y, GREEN.hex[2]); });
        },
    };

    // ═══ OUR OWN SHIP — our ship facing us: same hull, same number. Five windows, four people waving, one seat empty. ═══
    const MIRROR = { x: 312, y: 74, len: 300, ht: 46, windows: 5, winX: 196, winY: 62, winW: 16, winH: 13, winPitch: 22, blinkMs: 1500 };
    SCENES.ANOMALY_MIRROR = {
        build(p) {
            const stars = space(p, 29, 460);
            const theirs = drawHull(p, { x: MIRROR.x, y: MIRROR.y, len: MIRROR.len, ht: MIRROR.ht, ramp: HULL, seed: 9 });
            const ours = drawHull(p, { x: -66, y: 118, len: 330, ht: 60, flip: true, ramp: HULL, seed: 9, light: 0.55 });
            const windows = [];
            for (let k = 0; k < MIRROR.windows; k++) {
                const wx = MIRROR.winX + k * MIRROR.winPitch, wy = MIRROR.winY, isEmpty = k === MIRROR.windows - 1;
                p.region(wx - 1, wy - 1, wx + MIRROR.winW + 1, wy + MIRROR.winH + 1, (x, y) => p.tone(x, y, HULL, 0.12));
                p.region(wx, wy, wx + MIRROR.winW, wy + MIRROR.winH, (x, y) => p.tone(x, y, AMBER, 0.86 - (y - wy) / MIRROR.winH * 0.3));
                if (!isEmpty) {
                    const cx = wx + MIRROR.winW / 2 - 1;
                    p.ellipse(cx, wy + 4.5, 2.6, 2.8, (x, y) => p.tone(x, y, WOOD, 0.26));
                    p.region(cx - 4, wy + 8, cx + 5, wy + MIRROR.winH, (x, y) => { if (!(y === wy + 8 && (x < cx - 3 || x > cx + 3))) p.tone(x, y, WOOD, 0.26); });
                }
                windows.push({ wx, wy, isEmpty });
            }
            text('EXODUS-9', 318, 81, 2, (x, y, k) => p.region(x, y, x + k, y + k, (a, b) => p.tone(a, b, HULL, 0.2)));
            return { stars: keepVisible(p, stars), windows, noses: [theirs(0.01, 0), ours(0.01, 0)] };
        },
        frame(f, t, s) {
            twinkle(f, s.stars, t);
            s.windows.forEach((w, k) => {                                                     // they wave back
                if (w.isEmpty) return;
                const cx = w.wx + MIRROR.winW / 2 - 1, isUp = Math.floor(t / 420 + k * 1.7) % 2 === 0;
                f.px(cx + 4, w.wy + (isUp ? 2 : 5), WOOD.hex[1], 1, isUp ? 7 : 4);
                f.px(cx + 5, w.wy + (isUp ? 1 : 4), WOOD.hex[1], 2, 2);
            });
            if (t % MIRROR.blinkMs < 400) s.noses.forEach(([x, y]) => { f.glow(x, y, 5, RED, 0.8); f.px(x - 1, y - 1, RED.hex[4], 2, 2); });
        },
    };

    // ═══ THE SAME PLANET TWICE — two identical planets side by side; between them a seam where the sky does not line up. ═══
    const FOLD = { seam: 240, shift: 13, r: 52, left: 136, right: 344, y: 84, craters: 16 };
    function foldPlanet(p, cx, cy, craters) {
        const L = [-0.55, -0.48, 0.68];
        p.ellipse(cx, cy, FOLD.r, FOLD.r, (x, y, q) => {
            const nx = (x + 0.5 - cx) / FOLD.r, ny = (y + 0.5 - cy) / FOLD.r, nz = Math.sqrt(1 - q);
            let v = 0.04 + 0.92 * Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
            v -= 0.2 * smooth(0.5, 0.62, fbm(nx * 2.6 + 4, ny * 2.6, 21, 3)) * Math.min(1, v * 3);                // dark plains
            craters.forEach(([ux, uy, ur]) => {
                const d = Math.hypot(nx - ux, ny - uy) / ur;
                if (d < 0.85) v *= 0.72 + 0.3 * ((nx - ux) * L[0] + (ny - uy) * L[1] < 0 ? 0 : 1) * d;      // the floor is in shadow on the lit side
                else if (d < 1.15) v += 0.14 * Math.max(0, -((nx - ux) * L[0] + (ny - uy) * L[1]) / ur);   // the rim catches light
            });
            p.tone(x, y, MOON, v);
        });
    }
    SCENES.ANOMALY_FOLD = {
        build(p) {
            const bandY = x => 128 - x * 0.21 + (x >= FOLD.seam ? FOLD.shift : 0);
            p.region(0, 0, W, H, (x, y) => {
                const shift = x >= FOLD.seam ? FOLD.shift : 0, d = Math.exp(-(((y - bandY(x)) / 24) ** 2));
                const v = d * (0.2 + 0.6 * fbm(x / 26, (y - shift) / 12, 7, 4));
                if (v > 0.05) p.tone(x, y, HAZE, v * 1.2);
            });
            const rand = seeded(88), stars = [];
            for (let i = 0; i < 1100; i++) {                                                  // one sky, torn at the seam: the right half sits lower
                const x = Math.floor(rand() * W), y0 = Math.floor(rand() * H), mag = rand(), keep = rand();
                const y = y0 + (x >= FOLD.seam ? FOLD.shift : 0);
                if (keep > 0.22 + Math.exp(-(((y - bandY(x)) / 22) ** 2)) || Math.abs(x - FOLD.seam) < 2) continue;
                if (mag > 0.96) { p.set(x, y, STAR.rgb[4]); [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([a, b]) => p.set(x + a, y + b, STAR.rgb[2])); }
                else p.set(x, y, STAR.rgb[mag > 0.8 ? 3 : mag > 0.4 ? 2 : 1]);
                stars.push({ x, y, mag });
            }
            p.region(FOLD.seam - 4, 0, FOLD.seam + 4, H, (x, y) => { const d = Math.abs(x + 0.5 - FOLD.seam); p.cover(x, y, VIOLET, d < 1 ? 0.8 : 0.45, d < 1 ? 1 : 0.5 - d * 0.1); });
            const rand2 = seeded(5), craters = Array.from({ length: FOLD.craters }, () => [(rand2() - 0.5) * 1.5, (rand2() - 0.5) * 1.5, 0.06 + rand2() * rand2() * 0.22]);
            foldPlanet(p, FOLD.left, FOLD.y, craters);
            foldPlanet(p, FOLD.right, FOLD.y, craters);
            return { stars: keepVisible(p, stars) };
        },
        frame(f, t, s) {
            twinkle(f, s.stars, t);
            const step = Math.floor(t / TICK_MS);
            for (let i = 0; i < 14; i++) { const y = Math.floor(hash(i, step, 3) * H); f.tone(FOLD.seam + (hash(i, step, 4) < 0.5 ? -1 : 0), y, VIOLET, 0.9, 2, 1 + Math.floor(hash(i, step, 6) * 4)); }
        },
    };

    // ═══ THE OTHER VOICE — something far off is calling us on every channel, in A.U.R.A.'s voice. ═══
    const VOICE = { sx: 452, sy: 80, spacing: 30, rings: 16, speed: 0.009, spread: 1.05 };
    SCENES.ANOMALY_WHISPER = {
        build(p) {
            const stars = space(p, 37, 420, 0.25);
            p.ellipse(VOICE.sx, VOICE.sy, 12, 12, (x, y, q) => p.tone(x, y, VIOLET, (1 - Math.sqrt(q)) ** 1.4 * 1.1));
            drawHull(p, { x: 70, y: 84, len: 96, ht: 19, flip: true, ramp: HULL, seed: 9 });
            return { stars: keepVisible(p, stars) };
        },
        frame(f, t, s) {
            twinkle(f, s.stars, t);
            const cycle = VOICE.spacing * VOICE.rings;
            for (let k = 0; k < VOICE.rings; k++) {                                          // her voice, coming in from out there, in waves
                const r = (k * VOICE.spacing + t * VOICE.speed) % cycle, fade = 1 - r / cycle, word = Math.floor((k * VOICE.spacing + t * VOICE.speed) / cycle) * 7 + k;
                if (r < 16) continue;
                for (let a = -VOICE.spread; a <= VOICE.spread; a += 2 / r) {
                    const env = Math.abs(Math.sin(a * 7 + word * 1.9) * Math.sin(a * 3.1 - word));
                    if (env < 0.22) continue;
                    f.tone(VOICE.sx - r * Math.cos(a), VOICE.sy + r * Math.sin(a) * 0.85, GREEN, 0.2 + 0.75 * fade * env, 2, 2);
                }
            }
            f.px(VOICE.sx - 1, VOICE.sy - 1, VIOLET.hex[t % 900 < 450 ? 5 : 4], 3, 3);
        },
    };

    // ═══ THE DARK PATCH — a hole in the sky with no stars in it; distress beacons inside switch off one by one. ═══
    const HUNGER = { x: 282, y: 80, r: 62, wrecks: 9, deadAtStart: 2, firstOffMs: 9000, offEveryMs: 7000, keepLit: 2, blinkMs: 1700, tries: 600 };
    const hungerDist = (x, y) => Math.hypot(x - HUNGER.x, (y - HUNGER.y) * 1.35) / HUNGER.r + (fbm(x / 26, y / 26, 9, 3) - 0.5) * 0.6;
    SCENES.ANOMALY_HUNGER = {
        build(p) {
            p.region(0, 0, W, H, (x, y) => { const v = (0.1 + 0.62 * Math.pow(fbm(x / 60, y / 34, 4), 1.5)) * smooth(1, 1.35, hungerDist(x, y)); if (v > 0.03) p.tone(x, y, NEBULA, v); });
            const stars = scatterStars(p, 43, 1200, (x, y) => hungerDist(x, y) > 1.06);
            const rand = seeded(12), beacons = [];
            for (let tries = 0; beacons.length < HUNGER.wrecks && tries < HUNGER.tries; tries++) {
                const x = HUNGER.x + (rand() - 0.5) * 140, y = HUNGER.y + (rand() - 0.5) * 80;
                if (hungerDist(x, y) > 0.8 || beacons.some(b => Math.hypot(b.x - x, b.y - y) < 20)) continue;
                const at = drawHull(p, { x, y, len: 14 + rand() * 10, ht: 4 + rand() * 2, angle: rand() * 6.28, ramp: RUST, light: 0.5, seed: beacons.length + 1 });
                const [bx, by] = at(0.5, -0.5);
                beacons.push({ x: Math.round(bx), y: Math.round(by), phase: rand() * HUNGER.blinkMs });
            }
            return { stars: keepVisible(p, stars), beacons };
        },
        frame(f, t, s) {
            twinkle(f, s.stars, t);
            s.beacons.slice(HUNGER.deadAtStart).forEach((b, j) => {
                const offAt = j < s.beacons.length - HUNGER.deadAtStart - HUNGER.keepLit ? HUNGER.firstOffMs + j * HUNGER.offEveryMs : Infinity;
                if (t > offAt) return;                                                        // gone
                if ((t + b.phase) % HUNGER.blinkMs < HUNGER.blinkMs * 0.4) { f.glow(b.x, b.y, 5, RED, 0.75); f.px(b.x - 1, b.y - 1, RED.hex[4], 2, 2); }
                else f.px(b.x - 1, b.y - 1, RED.hex[2], 2, 2);
            });
        },
    };

    // ═══ THE BACK GARDEN — a lawn, a white fence, a tree and a bench, floating in open space with the soil hanging underneath. ═══
    const LAWN = { cx: 236, cy: 90, rx: 124, ry: 19, tree: [176, 30], bench: 284 };
    const lawnFront = x => LAWN.cy + LAWN.ry * Math.sqrt(Math.max(0, 1 - ((x - LAWN.cx) / LAWN.rx) ** 2));
    const lawnBack = x => LAWN.cy - LAWN.ry * Math.sqrt(Math.max(0, 1 - ((x - LAWN.cx) / LAWN.rx) ** 2));
    function gardenIsland(p) {
        const { cx, cy, rx } = LAWN;
        p.region(cx - rx, cy, cx + rx, H, (x, y) => {                                       // the soil and rock it was cut out with
            const n = (x + 0.5 - cx) / rx, top = lawnFront(x), depth = 46 * Math.pow(Math.max(0, 1 - n * n), 0.8) + (vnoise(x / 7, 0, 3) - 0.5) * 12;
            if (y < top || y > top + Math.max(2, depth)) return;
            const k = (y - top) / 50;
            let v = 0.5 - k * 0.35 - n * 0.12 + Math.sin((y - top) * 0.9 + vnoise(x / 9, y / 5, 4) * 3) * 0.07;
            if (fbm(x / 4, y / 4, 8, 2) > 0.66) v = 0.8;
            if (y - top < 3) { p.tone(x, y, GRASS, 0.35); return; }
            p.tone(x, y, SOIL, v);
        });
        [[150, 138, 5], [318, 132, 4], [246, 150, 3]].forEach(([x, y, r]) => p.ellipse(x, y, r, r * 0.8, (a, b, q) => p.tone(a, b, SOIL, 0.6 - q * 0.4)));
        const [tx] = LAWN.tree;
        p.ellipse(cx, cy, rx, LAWN.ry, (x, y) => {                                           // the lawn, mown in stripes
            const stripe = Math.sin((x - cx) * (1 + 0.35 * (y - cy) / LAWN.ry) / 7) > 0 ? 0.08 : -0.06;
            const shade = Math.hypot((x - tx - 18) / 24, (y - cy + 6) / 6) < 1 ? -0.2 : 0;
            p.tone(x, y, GRASS, 0.56 + stripe + shade - (y - cy) / LAWN.ry * 0.08);
        });
    }
    function gardenFence(p) {
        const { cx, rx } = LAWN;
        for (let x = Math.round(cx - rx * 0.93); x < cx + rx * 0.93; x++) { const b = lawnBack(x) + 1; p.tone(x, b - 4, STONE, 0.62); p.tone(x, b - 10, STONE, 0.62); }
        for (let x = Math.round(cx - rx * 0.93); x < cx + rx * 0.93; x += 6) {
            const b = Math.round(lawnBack(x) + 1);
            p.region(x, b - 13, x + 2, b, (a, y) => p.tone(a, y, STONE, a === x ? 0.86 : 0.6));
            p.tone(x, b - 14, STONE, 0.7);
        }
    }
    function gardenTree(p) {
        const [tx, ty] = LAWN.tree, blobs = [[tx, ty + 12, 17], [tx - 15, ty + 20, 12], [tx + 16, ty + 18, 13], [tx + 2, ty, 12]];
        p.region(tx - 2, ty + 20, tx + 2, LAWN.cy - 12, (x, y) => p.tone(x, y, WOOD, x < tx ? 0.55 : 0.32));
        p.line(tx, ty + 34, tx + 9, ty + 26, (x, y) => p.region(x, y, x + 2, y + 1, (a, b) => p.tone(a, b, WOOD, 0.4)));
        p.region(tx - 34, ty - 14, tx + 32, ty + 34, (x, y) => {
            let best = null;
            blobs.forEach(([bx, by, br]) => { const d = Math.hypot(x + 0.5 - bx, y + 0.5 - by) / br; if (d < 1 && (!best || d < best.d)) best = { d, nx: (x - bx) / br, ny: (y - by) / br }; });
            if (best) p.tone(x, y, GRASS, 0.25 + 0.55 * Math.max(0, -best.nx * 0.6 - best.ny * 0.8) + (fbm(x / 3.5, y / 3.5, 6, 2) - 0.5) * 0.45);
        });
    }
    function gardenBench(p) {
        const x0 = LAWN.bench, y0 = LAWN.cy + 2;
        [[x0 + 1, y0, 2, 7], [x0 + 23, y0, 2, 7], [x0 + 1, y0 - 10, 2, 10], [x0 + 23, y0 - 10, 2, 10]].forEach(([x, y, w, h]) => p.region(x, y, x + w, y + h, (a, b) => p.tone(a, b, WOOD, 0.3)));
        [[y0, 3, 0.8], [y0 - 9, 2, 0.7], [y0 - 5, 2, 0.62]].forEach(([y, h, v]) => p.region(x0 - 1, y, x0 + 27, y + h, (a, b) => p.tone(a, b, WOOD, b === y ? v : v - 0.25)));
    }
    SCENES.ANOMALY_GARDEN = {
        build(p) {
            const stars = space(p, 23, 420, 0.25);
            gardenIsland(p); gardenFence(p); gardenTree(p); gardenBench(p);
            return { stars: keepVisible(p, stars) };
        },
        frame(f, t, s) {
            twinkle(f, s.stars, t);
            for (let x = Math.round(LAWN.cx - LAWN.rx * 0.95); x < LAWN.cx + LAWN.rx * 0.95; x += 2) {   // the grass sways, with no wind
                const b = Math.round(lawnFront(x)), h = 3 + Math.floor(hash(x, 1, 2) * 4), lean = Math.round(Math.sin(t / 700 + x * 0.06) * 1.3);
                f.px(x, b - Math.ceil(h / 2), GRASS.hex[3], 1, Math.ceil(h / 2));
                f.px(x + lean, b - h, GRASS.hex[hash(x, 2, 2) > 0.6 ? 4 : 3], 1, Math.floor(h / 2) || 1);
            }
        },
    };

    // ═══ THE DOOR — our own rear airlock, floating on its own in space. The light above it is green. ═══
    const DOOR = { x: 206, y: 30, w: 66, h: 108, depth: 8, rim: 9 };
    function doorFrame(p) {
        const { x, y, w, h, rim } = DOOR, dp = DOOR.depth, dq = DOOR.depth * 0.6;
        p.poly([[x + w, y + 4], [x + w + dp, y + 4 + dq], [x + w + dp, y + h + dq], [x + w, y + h]], (a, b) => p.tone(a, b, HULL, 0.22));
        p.poly([[x + 4, y + h], [x + w, y + h], [x + w + dp, y + h + dq], [x + 4 + dp, y + h + dq]], (a, b) => p.tone(a, b, HULL, 0.14));
        p.region(x, y, x + w, y + h, (a, b) => {
            const lx = a - x, ly = b - y, cornerOut = Math.min(lx, w - 1 - lx) < 4 && Math.min(ly, h - 1 - ly) < 4 && Math.hypot(Math.min(lx, w - 1 - lx) - 4, Math.min(ly, h - 1 - ly) - 4) > 4;
            if (cornerOut) return;
            const inRim = lx < rim || ly < rim || w - 1 - lx < rim || h - 1 - ly < rim;
            let v;
            if (inRim) v = lx < 2 || ly < 2 ? 0.82 : w - 1 - lx < 2 || h - 1 - ly < 2 ? 0.3 : lx === rim - 1 || ly === rim - 1 ? 0.3 : w - lx === rim || h - ly === rim ? 0.75 : 0.5;
            else {
                v = 0.62 - ly / h * 0.18 + ((ly - rim) % 18 === 0 ? -0.2 : (ly - rim) % 18 === 1 ? 0.12 : 0);
                if (ly > h - rim - 14 && ly < h - rim - 3) { p.tone(a, b, Math.floor((lx + ly) / 4) % 2 ? AMBER : HULL, Math.floor((lx + ly) / 4) % 2 ? 0.72 : 0.14); return; } // hazard stripes
            }
            p.tone(a, b, HULL, v);
        });
    }
    SCENES.ANOMALY_DOOR = {
        build(p) {
            const stars = space(p, 31, 480, 0.35), { x, y, w } = DOOR;
            doorFrame(p);
            const wx = x + w / 2, wy = y + 28, wr = 11;                                         // its porthole: nothing behind it but stars
            p.ellipse(wx, wy, wr + 3, wr + 3, (a, b) => p.tone(a, b, HULL, a + b < wx + wy ? 0.3 : 0.75));
            p.ellipse(wx, wy, wr, wr, (a, b) => p.tone(a, b, HAZE, 0.2 + (Math.abs(a - wx + b - wy + 4) < 2 ? 0.5 : 0)));
            [[wx - 5, wy + 3], [wx + 4, wy - 5], [wx + 2, wy + 6]].forEach(([a, b]) => p.set(a, b, STAR.rgb[3]));
            p.region(x + w - 17, y + 48, x + w - 11, y + 60, (a, b) => p.tone(a, b, HULL, 0.28));    // the handle
            p.region(x + w - 16, y + 42, x + w - 13, y + 66, (a, b) => p.tone(a, b, HULL, a === x + w - 16 ? 0.9 : 0.55));
            p.line(x + w - 27, y + 76, x + w - 20, y + 67, (a, b) => p.tone(a, b, HULL, 0.95));       // the scratch by the handle
            p.line(x + w - 24, y + 78, x + w - 20, y + 73, (a, b) => p.tone(a, b, HULL, 0.85));
            p.region(x + w / 2 - 7, y - 8, x + w / 2 + 7, y - 1, (a, b) => p.tone(a, b, HULL, 0.35));
            p.region(0, y - 8, W, y + 30, (a, b) => { const d = Math.hypot(a - (x + w / 2), (b - (y - 4)) * 1.2); if (d < 30 && d > 5) p.cover(a, b, GREEN, 0.55, 0.5 * (1 - d / 30) * (b > y - 1 ? 1 : 0.4)); });
            return { stars: keepVisible(p, stars), lamp: [x + w / 2, y - 5] };
        },
        frame(f, t, s) {
            twinkle(f, s.stars, t);
            const [lx, ly] = s.lamp, pulse = 0.72 + 0.2 * Math.sin(t / 650);
            f.glow(lx, ly, 10, GREEN, pulse);
            f.px(lx - 4, ly - 1, GREEN.hex[4], 8, 3);
            dust(f, t, 10, [0, 0, W, H], BONE, 7, 3);
        },
    };

    // ═══ THE LIST IN THE SKY — kilometres of light: hull numbers climbing past forty thousand, and beside every one, a 4. ═══
    const LIST = { vx: 240, vy: 14, near: 0.9, a: 150, glyph: 4.2, depthPerPixel: 0.02, rowDepth: 0.16, rows: 130, first: 39620, step: 23, last: 41207, rowMs: 2500, limb: [240, 1000, 865] };
    SCENES.ANOMALY_GEOMETRY = {
        build(p) {
            const stars = space(p, 53, 460, 0.4);
            p.region(0, 130, W, H, (x, y) => { const d = LIST.limb[2] - Math.hypot(x - LIST.limb[0], y - LIST.limb[1]); if (d > 0) p.tone(x, y, PLANET, d < 1.5 ? 0.5 : 0.08 + 0.2 * Math.exp(-d / 6) + (fbm(x / 30, y / 6, 12, 3) - 0.5) * 0.15); });
            drawHull(p, { x: 404, y: 112, len: 56, ht: 11, ramp: HULL, seed: 9 });                    // us, for scale
            return { stars: keepVisible(p, stars) };
        },
        frame(f, t) {
            const L = LIST, progress = t / L.rowMs, base = Math.floor(progress), slide = (progress - base) * L.rowDepth;
            const toY = z => L.vy + L.a / z, cell = (col, z, gx, gy, v) => {
                const y0 = toY(z + gy * L.depthPerPixel), y1 = toY(z + (gy + 1) * L.depthPerPixel), w = L.glyph / z, x = L.vx + gx * w;
                f.tone(x, y0, VIOLET, v, Math.max(1, Math.round(w * 0.8)), Math.max(1, Math.round(y0 - y1)));
            };
            for (let n = L.rows - 1; n >= 0; n--) {                                           // far rows first
                const z = L.near + n * L.rowDepth - slide, hull = L.first + (base + n) * L.step;
                if (z < 0.62 || hull > L.last) continue;
                const v = 0.35 + 0.65 * Math.exp(-(z - 0.6) / 1.4), digits = String(hull);
                if (L.glyph / z < 0.9) {                                                      // too far to read: a line of light
                    const w = L.glyph / z, y = Math.round(toY(z));
                    f.tone(L.vx - (digits.length * 4 + 1) * w, y, VIOLET, v * 0.9, Math.max(1, Math.round(digits.length * 4 * w)), 1);
                    f.tone(L.vx + 4 * w, y, VIOLET, v, Math.max(1, Math.round(3 * w)), 1);
                    continue;
                }
                text(digits, -(digits.length * 4 + 1), 0, 1, (gx, gy) => cell(0, z, gx, 4 - gy, v));    // the rows lean back, like writing on the ground
                text('4', 4, 0, 1, (gx, gy) => cell(1, z, gx, 4 - gy, Math.min(1, v + 0.15)));
                cell(0, z, 1.5, 2, v * 0.6);
            }
        },
    };

    // ═══ THE LIGHTHOUSE — a dead ship in orbit, its beacon still giving directions. Every route points the same way. ═══
    const BEACON = { light: [462, 44], blinkMs: 1600, routes: [-48, -24, 2, 28, 52], dashSpeed: 0.012 };
    SCENES.LIGHTHOUSE = {
        build(p) {
            const stars = space(p, 41, 420, 0.25), [lx, ly] = BEACON.light;
            p.region(lx - 40, ly - 40, W, ly + 40, (x, y) => { const d = Math.hypot(x - lx, y - ly); const v = 1.1 * Math.exp(-d / 4) + 0.4 * Math.exp(-d / 20) + (Math.abs(y - ly) < 1 ? 0.35 * Math.exp(-Math.abs(x - lx) / 30) : 0); if (v > 0.1) p.tone(x, y, SUN, v); });
            const pc = [240, 1100], pr = 985;
            p.region(0, 110, W, H, (x, y) => {                                                // a dead planet below, lit from the light's side
                const d = Math.hypot(x - pc[0], y - pc[1]);
                if (d <= pr) p.tone(x, y, GROUND, 0.1 + 0.5 * (x / W) ** 2 + (fbm(x / 30, y / 8, 12, 4) - 0.5) * 0.3 + (pr - d < 2 ? 0.25 + 0.5 * x / W : 0));
            });
            const at = drawHull(p, { x: 168, y: 64, len: 150, ht: 26, angle: -0.06, ramp: RUST, holes: true, rust: true, seed: 5 });
            const [mx, my] = at(0.26, -0.72);
            p.line(mx, my, mx, my - 24, (x, y) => p.region(x, y, x + 2, y + 1, (a, b) => p.tone(a, b, HULL, a === x ? 0.7 : 0.4)));
            [[-5, -10], [-4, -18]].forEach(([dx, dy]) => p.line(mx + dx, my + dy, mx - dx + 1, my + dy, (x, y) => p.tone(x, y, HULL, 0.5)));
            return { stars: keepVisible(p, stars), beacon: [Math.round(mx), Math.round(my - 26)] };
        },
        frame(f, t, s) {
            twinkle(f, s.stars, t);
            const [bx, by] = s.beacon, [lx, ly] = BEACON.light;
            BEACON.routes.forEach((bend, k) => {                                              // every route it gives: down our heading, toward the light
                const cx = (bx + lx) / 2, cy = (by + ly) / 2 + bend;
                for (let i = 0; i <= 200; i++) {
                    const u = i / 200, x = (1 - u) * (1 - u) * bx + 2 * u * (1 - u) * cx + u * u * lx, y = (1 - u) * (1 - u) * by + 2 * u * (1 - u) * cy + u * u * ly;
                    if (((i * 1.8 - t * BEACON.dashSpeed + k * 3) % 11 + 11) % 11 < 4) f.tone(x, y, AMBER, 0.62 - u * 0.25);
                }
            });
            const phase = t % BEACON.blinkMs, ring = phase / BEACON.blinkMs * 22;
            if (phase < 320) { f.glow(bx, by, 6, AMBER, 0.95); f.px(bx - 1, by - 1, AMBER.hex[4], 3, 3); } else f.px(bx, by, AMBER.hex[2], 2, 2);
            for (let a = 0; a < 6.28; a += 2 / Math.max(ring, 1)) f.tone(bx + Math.cos(a) * ring, by + Math.sin(a) * ring, AMBER, 0.6 * (1 - ring / 22));
        },
    };

    // ═══ THE WRECK — an Exodus hull broken on the ground at dusk. One light on it still blinks. ═══
    const WRECK = { horizon: 104, blinkMs: 1500, onMs: 380 };
    function duskLand(p, r, horizon, glowAt, seed) {
        p.region(0, 0, W, horizon, (x, y) => p.tone(x, y, r, 0.05 + 0.72 * Math.pow(y / horizon, 2.4) + 0.3 * Math.exp(-Math.hypot(x - glowAt, (y - horizon) * 3) / 90)));
        const stars = scatterStars(p, seed, 300, (x, y) => y < horizon * 0.5);
        p.region(0, horizon - 20, W, horizon + 1, (x, y) => { if (y > horizon - 4 - 16 * fbm(x / 60, 0, seed, 3) * smooth(0, 60, Math.abs(x - glowAt))) p.tone(x, y, r, 0.16); });
        p.region(0, horizon, W, H, (x, y) => p.tone(x, y, GROUND, 0.12 + 0.36 * Math.exp(-(y - horizon) / 12) + (fbm(x / 5, y / 2.5, seed + 1, 3) - 0.5) * 0.24));
        return stars;
    }
    SCENES.EXODUS_WRECK = {
        build(p) {
            const stars = duskLand(p, DUSK, WRECK.horizon, 110, 61);
            p.ellipse(392, 30, 15, 15, (x, y, q) => { const nx = (x + 0.5 - 392) / 15, ny = (y + 0.5 - 30) / 15; p.tone(x, y, MOON, clamp01(-nx * 0.8 + ny * 0.3 + 0.2) * 1.1); });
            p.poly([[330, 118], [470, 105], [476, 106], [340, 126]], (x, y) => p.tone(x, y, GROUND, 0.04));  // the furrow it cut coming down
            p.ellipse(186, 140, 150, 7, (x, y) => p.tone(x, y, GROUND, 0.03));
            const hull = { x: 172, y: 118, len: 260, ht: 42, ramp: RUST, holes: 0.7, rust: true, seed: 3 };
            drawHull(p, Object.assign({}, hull, { angle: -0.05, from: 0.55, anchor: 0.5 }));
            const at = drawHull(p, Object.assign({}, hull, { angle: -0.08, to: 0.52, anchor: 0.5 }));
            p.ellipse(56, 138, 54, 16, (x, y, q) => p.tone(x, y, GROUND, 0.42 - (y - 122) / 40 + (fbm(x / 4, y / 2.5, 3, 2) - 0.5) * 0.3)); // the nose is buried
            const [mx, my] = at(0.3, -0.72);
            p.line(mx, my, mx + 3, my - 16, (x, y) => p.tone(x, y, HULL, 0.5));
            return { stars: keepVisible(p, stars), light: [Math.round(mx + 3), Math.round(my - 17)] };
        },
        frame(f, t, s) {
            twinkle(f, s.stars, t);
            const [x, y] = s.light;
            if (t % WRECK.blinkMs < WRECK.onMs) { f.glow(x, y, 7, RED, 0.9); f.px(x - 1, y - 1, RED.hex[4], 2, 2); } else f.px(x, y, RED.hex[2]);
            dust(f, t, 12, [0, 112, W, 158], GROUND, 13, 6);
        },
    };

    // ═══ THE COLONY RUINS — a half-collapsed dome gone wild, roofless walls, one window still lit. ═══
    const COLONY = { horizon: 92, sunX: 404, dome: [150, 132, 80, 74], rooms: [[436, 110, 32, 16], [322, 116, 40, 22], [262, 124, 46, 26], [370, 130, 56, 30]], lampRoom: 1 };
    function colonyDome(p) {
        const [cx, base, rx, ry] = COLONY.dome, broken = (x, y) => x > cx + 12 + 22 * Math.sin(y * 0.21) && y < base - 12;
        p.ellipse(cx, base, rx, ry, (x, y) => {                                             // inside: the garden, grown wild
            if (y > base) return;
            const growth = base - y < ry * 0.55 + 16 * fbm(x / 14, 0, 3, 3) - 8;
            if (growth) { p.tone(x, y, GRASS, 0.12 + 0.5 * fbm(x / 5, y / 5, 5, 3)); return; }
            if (!broken(x, y)) p.cover(x, y, STONE, 0.3, 0.3);
        });
        const rib = (x, y) => { if (y <= base && !broken(x, y)) p.tone(x, y, STONE, 0.72); };
        [-1, -0.75, -0.42, -0.14, 0.14, 0.42, 0.75, 1].forEach(sk => { for (let th = 0; th < Math.PI / 2; th += 0.006) rib(cx + rx * sk * Math.cos(th), base - ry * Math.sin(th)); });
        [0.35, 0.75, 1.15].forEach(th => { for (let x = cx - rx * Math.cos(th); x < cx + rx * Math.cos(th); x++) rib(x, base - ry * Math.sin(th)); });
        [[232, 136, 250, 128], [226, 140, 246, 140], [254, 134, 262, 124]].forEach(([a, b, c, d]) => p.line(a, b, c, d, (x, y) => p.tone(x, y, STONE, 0.6)));  // fallen ribs
        p.region(cx + 30, base - 20, cx + 110, base + 10, (x, y) => { if (fbm(x / 6, y / 6, 7, 3) > 0.55 + (x - cx - 30) / 160) p.tone(x, y, GRASS, 0.3 + 0.3 * fbm(x / 3, y / 3, 2, 2)); });
    }
    function colonyRoom(p, [x, b, w, h], seed) {
        const dp = 12, dq = -10, top = b - h;
        p.poly([[x + w, b], [x + w + dp, b + dq], [x + w + dp, top + dq], [x + w, top]], (a, c) => p.tone(a, c, WALL, 0.28));
        p.poly([[x, top], [x + w, top], [x + w + dp, top + dq], [x + dp, top + dq]], (a, c) => p.tone(a, c, WALL, c - (top + dq) < 5 ? 0.36 : 0.05));  // no roof: the inside of the back wall, and a dark floor
        p.line(x + dp, top + dq, x + w + dp, top + dq, (a, c) => p.tone(a, c, WALL, 0.62));
        p.line(x, top, x + dp, top + dq, (a, c) => p.tone(a, c, WALL, 0.55));
        p.region(x, top, x + w, b, (a, c) => {
            const notch = c - top < 9 * vnoise(a / 5, 0, seed) - 3;                           // broken wall tops
            if (notch) return;
            const lx = a - x, ly = c - top, isWindow = ly > h * 0.3 && ly < h * 0.6 && (lx % 14) > 5 && (lx % 14) < 11 && lx < w - 4;
            p.tone(a, c, WALL, isWindow ? 0.04 : ly < 1.5 ? 0.78 : 0.48 + (fbm(a / 3, c / 3, seed, 2) - 0.5) * 0.25);
        });
    }
    SCENES.FAILED_COLONY = {
        build(p) {
            const stars = duskLand(p, DUSK_WARM, COLONY.horizon, COLONY.sunX, 71);
            p.ellipse(COLONY.sunX, COLONY.horizon - 1, 8, 8, (x, y, q) => { if (y < COLONY.horizon - 2) p.tone(x, y, SUN, 0.95 - q * 0.3); });
            colonyDome(p);
            COLONY.rooms.forEach((room, k) => colonyRoom(p, room, k + 2));
            p.line(236, 124, 236, 68, (x, y) => p.region(x, y, x + 2, y + 1, (a, b) => p.tone(a, b, WALL, a === x ? 0.6 : 0.35)));   // the radio mast, bent over
            p.line(237, 68, 250, 62, (x, y) => p.tone(x, y, WALL, 0.55));
            for (let y = 76; y < 122; y += 9) p.line(233, y, 240, y + 5, (x, b) => p.tone(x, b, WALL, 0.4));
            const [x, b, , h] = COLONY.rooms[COLONY.lampRoom];
            return { stars: keepVisible(p, stars), lamp: [x + 6, b - h + Math.ceil(h * 0.3) + 1, 5, Math.floor(h * 0.3) - 1] };
        },
        frame(f, t, s) {
            twinkle(f, s.stars, t);
            const step = Math.floor(t / TICK_MS), [x, y, w, h] = s.lamp;                     // nobody lives here, but the power still runs
            if (hash(step, 1, 4) > 0.18) { f.px(x, y, AMBER.hex[hash(step, 2, 4) > 0.5 ? 3 : 2], w, h); f.px(x + 1, y + h, AMBER.hex[1], w - 2, 1); }
            dust(f, t, 14, [0, 96, W, 158], WALL, 17, 9);
        },
    };

    // ═══ THE GARDEN — on a dead planet, a dome kilometres wide: an Earth garden in its own daylight. The door is open. ═══
    const DOME = { cx: 240, base: 140, rx: 212, ry: 126, horizon: 128, door: [228, 112, 24, 28], birds: 5 };
    const inDome = (x, y) => y <= DOME.base && ((x + 0.5 - DOME.cx) / DOME.rx) ** 2 + ((y + 0.5 - DOME.base) / DOME.ry) ** 2 < 1;
    function domeInside(x, y) {
        const top = DOME.base - DOME.ry, back = 96 + 9 * Math.sin(x / 37) + 8 * fbm(x / 50, 1, 2, 2), front = 116 + 6 * Math.sin(x / 29 + 2);
        const stream = 250 + 22 * Math.sin((y - 96) / 9), streamW = 1 + (y - 100) * 0.16;
        if (y > front && Math.abs(x - stream) < streamW) return [DAYLIGHT, 0.95 - (Math.abs(x - stream) > streamW - 1 ? 0.3 : 0)];
        if (y > front) return [GRASS, 0.62 + (fbm(x / 4, y / 3, 3, 2) - 0.5) * 0.3 - (y - front) * 0.006];
        if (y > back) return [GRASS, 0.44 + (fbm(x / 5, y / 3, 4, 2) - 0.5) * 0.25];
        return [DAYLIGHT, 0.82 - (y - top) / DOME.ry * 0.4];
    }
    SCENES.GARDEN = {
        build(p) {
            const stars = scatterStars(p, 81, 420, (x, y) => y < DOME.horizon && !inDome(x, y));
            p.region(0, DOME.horizon, W, H, (x, y) => p.tone(x, y, REGOLITH, 0.12 + 0.2 * Math.exp(-(y - DOME.horizon) / 6) + (fbm(x / 4, y / 2, 9, 3) - 0.5) * 0.2));
            p.region(0, 0, W, DOME.base + 1, (x, y) => { if (inDome(x, y)) { const [r, v] = domeInside(x, y); p.tone(x, y, r, v); } });
            [[62, 104, 9], [108, 96, 12], [150, 104, 7], [196, 110, 6], [312, 94, 11], [354, 102, 8], [398, 98, 10], [430, 108, 6]].forEach(([tx, ty, r]) => {
                p.region(tx - 1, ty + r - 2, tx + 1, ty + r + 6, (x, y) => p.tone(x, y, WOOD, 0.3));
                p.ellipse(tx, ty, r, r * 0.9, (x, y) => { const nx = (x - tx) / r, ny = (y - ty) / r; p.tone(x, y, GRASS, 0.2 + 0.55 * Math.max(0, -nx * 0.6 - ny * 0.8) + (fbm(x / 3, y / 3, 6, 2) - 0.5) * 0.4); });
            });
            p.region(0, 0, W, DOME.base + 1, (x, y) => {                                     // the glass: a sheen, a lattice, a bright rim
                if (!inDome(x, y)) return;
                const q = ((x + 0.5 - DOME.cx) / DOME.rx) ** 2 + ((y + 0.5 - DOME.base) / DOME.ry) ** 2, sheen = Math.exp(-(((x * 0.7 + y - 150) / 12) ** 2)) * smooth(0.2, 0.9, q);
                const lon = Math.asin(clamp01(Math.abs(x + 0.5 - DOME.cx) / (DOME.rx * Math.sqrt(Math.max(0.01, 1 - ((y - DOME.base) / DOME.ry) ** 2))))), lat = Math.asin(clamp01((DOME.base - y) / DOME.ry));
                if (q > 0.965) p.tone(x, y, STONE, 0.9 - (q - 0.965) * 4);
                else if ((lon * 6) % 1 < 0.05 || (lat * 4) % 1 < 0.04) p.cover(x, y, STONE, 0.72, 0.4);
                else if (sheen > 0.1) p.cover(x, y, DAYLIGHT, 1, sheen * 0.5);
            });
            const [dx, dy, dw, dh] = DOME.door;
            p.poly([[dx, DOME.base], [dx + dw, DOME.base], [dx + dw + 30, H], [dx - 30, H]], (x, y) => p.cover(x, y, DAYLIGHT, 0.7, 0.75 * (1 - (y - DOME.base) / (H - DOME.base))));  // light spilling out
            p.region(dx - 2, dy - 2, dx + dw + 2, dy + dh, (x, y) => p.tone(x, y, HULL, 0.3));
            p.region(dx, dy, dx + dw, dy + dh, (x, y) => p.tone(x, y, DAYLIGHT, 1));
            p.poly([[dx + dw + 2, dy - 2], [dx + dw + 13, dy + 3], [dx + dw + 13, dy + dh + 4], [dx + dw + 2, dy + dh]], (x, y) => p.tone(x, y, HULL, 0.45));
            return { stars: keepVisible(p, stars) };
        },
        frame(f, t, s) {
            twinkle(f, s.stars, t);
            for (let i = 0; i < DOME.birds; i++) {
                const x = DOME.cx + Math.sin(t / 9000 + i * 1.3) * 140, y = 40 + i * 8 + Math.sin(t / 2300 + i) * 4, isUp = Math.floor(t / 250 + i) % 2 === 0, c = DAYLIGHT.hex[1];
                f.px(x - 3, y + (isUp ? -1 : 1), c, 2, 1); f.px(x - 1, y, c, 3, 1); f.px(x + 2, y + (isUp ? -1 : 1), c, 2, 1);
            }
            const step = Math.floor(t / 250);
            for (let i = 0; i < 8; i++) { const y = 118 + Math.floor(hash(i, step, 8) * 22); f.px(250 + 22 * Math.sin((y - 96) / 9) + (hash(i, step, 9) - 0.5) * (1 + (y - 100) * 0.3), y, DAYLIGHT.hex[5]); }
        },
    };

    // ═══ THE WRECK IN ORBIT — a ship broken into three pieces above a planet, with the wreckage drifting between them. ═══
    const DERELICT = { planet: [400, 330, 250], pieces: [[0, 0.34, 108, 60, -0.22], [0.38, 0.66, 236, 84, 0.3], [0.7, 1, 368, 56, -0.08]], debris: 34, drifting: 10 };
    SCENES.DERELICT = {
        build(p) {
            const stars = space(p, 61, 480, 0.3), [pcx, pcy, pr] = DERELICT.planet, L = [-0.62, -0.6, 0.5];
            p.region(0, 60, W, H, (x, y) => {
                const d = Math.hypot(x + 0.5 - pcx, y + 0.5 - pcy);
                if (d > pr + 3) return;
                const nx = (x + 0.5 - pcx) / pr, ny = (y + 0.5 - pcy) / pr;
                if (d > pr) { if (nx * L[0] + ny * L[1] > 0.2) p.cover(x, y, PLANET, 0.7, 0.6); return; }
                const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny)), lit = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
                p.tone(x, y, PLANET, 0.03 + lit * (0.7 + (fbm(x / 40, y / 7, 14, 4) - 0.5) * 0.7));
            });
            const base = { len: 236, ht: 36, ramp: RUST, holes: true, rust: true, seed: 8 };
            const ats = DERELICT.pieces.map(([from, to, x, y, angle]) => drawHull(p, Object.assign({}, base, { from, to, x, y, angle })));
            const [ax, ay] = ats[0](0.33, 0.1), [bx, by] = ats[1](0.39, 0.05);
            for (let u = 0; u <= 1; u += 0.01) p.tone(ax + (bx - ax) * u, ay + (by - ay) * u + Math.sin(u * Math.PI) * 14, HULL, 0.45);   // a cable still holds two pieces together
            const rand = seeded(19), chunks = [];
            for (let i = 0; i < DERELICT.debris; i++) {
                const x = 80 + rand() * 340, y = 30 + rand() * 90, w = 1 + Math.floor(rand() * 4), h = 1 + Math.floor(rand() * 3), v = 0.35 + rand() * 0.4;
                if (i < DERELICT.drifting) { chunks.push({ x, y, w, h, v, vx: (rand() - 0.5) * 1.6, vy: (rand() - 0.5) * 0.8 }); continue; }
                p.region(x, y, x + w, y + h, (a, b) => p.tone(a, b, RUST, b === Math.floor(y) ? v + 0.2 : v));
            }
            return { stars: keepVisible(p, stars), chunks, spark: ats[1](0.4, -0.2).map(Math.round) };
        },
        frame(f, t, s) {
            twinkle(f, s.stars, t);
            s.chunks.forEach(c => { const x = c.x + c.vx * t / 1000, y = c.y + c.vy * t / 1000; f.tone(x, y, RUST, c.v + 0.15, c.w, 1); if (c.h > 1) f.tone(x, y + 1, RUST, c.v, c.w, c.h - 1); });
            const step = Math.floor(t / TICK_MS);
            if (hash(step, 3, 1) > 0.55) { const [x, y] = s.spark; f.glow(x, y, 4, AMBER, 0.8); f.px(x, y, AMBER.hex[4], 1, 1); }
        },
    };

    // ── drawing and running ──
    const layers = new Map();                                                                  // key → { data, state }: each picture is painted once
    function staticLayer(key) {
        if (!layers.has(key)) { const p = painter(), state = SCENES[key].build(p) || {}; layers.set(key, { data: p.data, state }); }
        return layers.get(key);
    }
    const images = new WeakMap();                                                              // ctx → { key, image }
    function paint(ctx, key, t) {
        const scene = SCENES[key];
        if (!scene) return;
        const layer = staticLayer(key);
        let held = images.get(ctx);
        if (!held || held.key !== key) { const image = ctx.createImageData(W, H); image.data.set(layer.data); held = { key, image }; images.set(ctx, held); }
        ctx.putImageData(held.image, 0, 0);
        if (scene.frame) scene.frame(framer(ctx), t, layer.state);
    }
    const has = key => Object.prototype.hasOwnProperty.call(SCENES, key);
    const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
    const timers = new WeakMap();

    /** Draws and animates until the card closes. The card may attach its DOM after this is called, so it only stops once it has
        been on the page and left it — or if it never arrives within a few seconds. */
    function mount(canvas, key) {
        if (!canvas || !canvas.getContext || !has(key)) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        clearInterval(timers.get(canvas));
        const startedAt = now();
        let wasAttached = false;
        const timer = setInterval(() => step(), TICK_MS);
        function step() {
            const t = now() - startedAt;
            if (canvas.isConnected) wasAttached = true;
            else if (wasAttached || t > NEVER_ATTACHED_MS) { clearInterval(timer); timers.delete(canvas); return; }
            try { paint(ctx, key, t); } catch (err) { clearInterval(timer); timers.delete(canvas); throw err; }
        }
        timers.set(canvas, timer);
        step();
    }

    window.SceneArt = { W, H, has, mount, paint, keys: Object.keys(SCENES) };
})();
