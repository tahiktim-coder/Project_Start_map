/* ═══ Silent Exodus · the living ship (study) · the picture, part 1: hull, light, space ══════════════════════════════
   The Lander (hull B in ../ship-study.html) cut open down its length. It flies nose first and lands on its tail, so its
   six decks are the floors of a tower. Everything is painted at the crew's own density: one art pixel is one sprite
   pixel (crew sprites are 48 × 104 cells, shown at 2×), so furniture and people never look mixed.
   Style: docs/ART_STYLE.md and src/systems/SceneArt.js — ramps from the ink, 8 × 8 Bayer dither, seeded noise, one
   light from the upper right outside, warm lamps inside. People and lamps are the only warm things.
   Load order: engine.js, the person files, ship-art.js, ship-rooms.js, ship-sim.js, then the page.

   window.ShipArt
     L                      layout, in world art pixels (y grows downward, the nose is at the top)
     deckTop(i) floorY(i)   deck i (0 = bridge … 5 = engineering): its top row and the row people stand on
     deck(i, look)          { canvas, lamps, fx }: deck i painted once per look and cached. lamps are world points.
     nose() tail()          the nose cone and the skirt with the engine bell, painted once
     stars(layer)           a 512 × 512 tile of space (layer 0 far, 1 near)
     R, api                 ramps and the painter helpers (ship-rooms.js draws the furniture with them)
*/
(function (root) {
    'use strict';

    const INK = '#05070a';
    // PITCH 208: a ceiling about 1.8 people high (not 2.3), and two decks (2 × 208 + 16 = 432 rows) fit on a maximized
    // 1080p browser at 2 device pixels per art pixel. PITCH is a multiple of 8 and TOP0 + DECK_FLOOR ≡ 4 (mod 8), so every
    // floor sits on the ladder's rung grid (rungs on world rows ≡ 6 mod 8, the first 6 rows above the floor).
    const PITCH = 208, TOP0 = 454, N = 6, TAIL0 = TOP0 + N * PITCH;
    const L = Object.freeze({ W: 720, CX: 360, HO: 300, PLATE: 12, IL: 72, IR: 648, LX: 98, PITCH, SLAB: 18, TOP0, N,
        TIP: 34, TAIL0, H: TAIL0 + 360, RIN: 288, DECK_FLOOR: PITCH - 18 });
    const deckTop = i => L.TOP0 + i * L.PITCH;
    const floorY = i => deckTop(i) + L.DECK_FLOOR;

    // ── noise and dither (SceneArt's recipe) ────────────────────────────────────────────────────────────────────────
    const BAYER8 = [0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22,
        3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21].map(v => (v + 0.5) / 64);
    const bay = (x, y) => BAYER8[((y & 7) << 3) | (x & 7)];
    const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
    const smooth = (a, b, v) => { const k = clamp01((v - a) / (b - a)); return k * k * (3 - 2 * k); };
    function seeded(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
    const PERM = (() => { const r = seeded(1337), p = Array.from({ length: 256 }, (_, i) => i); for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } return Uint8Array.from(p); })();
    const hash = (x, y, s = 0) => PERM[(PERM[(PERM[x & 255] + y) & 255] + s) & 255] / 255;
    function vnoise(x, y, s = 0) {
        const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
        const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
        return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
    }
    function fbm(x, y, s = 0, oct = 3) { let sum = 0, amp = 0.5, f = 1, n = 0; for (let i = 0; i < oct; i++) { sum += amp * vnoise(x * f, y * f, s + i * 17); n += amp; f *= 2.03; amp *= 0.5; } return sum / n; }
    const hexRgb = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
    const rgbHex = c => '#' + c.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
    const mix = (a, b, t) => { const x = hexRgb(a), y = hexRgb(b); return rgbHex(x.map((v, i) => v + (y[i] - v) * t)); };
    const ramp = (...hex) => ({ hex, rgb: hex.map(hexRgb) });
    function level(r, v, x, y) { const top = r.hex.length - 1, pos = clamp01(v) * top, lo = Math.floor(pos); return Math.min(top, lo + (pos - lo > bay(x, y) ? 1 : 0)); }

    // ── ramps: Deep field for the ship and space, warm only for lamps, food and what people keep ─────────────────
    const R = {
        WALL: ramp(INK, '#090e12', '#0e151a', '#131c22', '#19252c', '#213038', '#2c3e47', '#3c525c', '#566e78'),
        STEEL: ramp(INK, '#0d1317', '#151e24', '#1e2a31', '#29373f', '#37474f', '#4b5d66', '#677a82', '#8c9ea4'),
        HULL: ramp(INK, '#121c22', '#22333b', '#3d5560', '#8aa2aa', '#e6eef0'),
        SCR: ramp(INK, '#0b2a30', '#11505a', '#1e8c96', '#58d6dc', '#b8f6f4'),
        ICE: ramp(INK, '#0b1e26', '#123848', '#1f5f74', '#4fa8bf', '#a9e4f0', '#e8fbff'),
        AMBER: ramp(INK, '#3a2410', '#8a5422', '#e8964a', '#f7c483', '#fff3dc'),
        RED: ramp(INK, '#3a1210', '#8a2a22', '#e2574c', '#ffd2c8'),
        FABRIC: ramp(INK, '#11161e', '#1b232e', '#28323f', '#384452', '#4d5a69', '#68778a'),
        WOOL: ramp(INK, '#1a1416', '#2a2024', '#3e2f30', '#56423c', '#735a4b', '#8e735e'),
        LINEN: ramp(INK, '#1e2226', '#363c40', '#565d60', '#7f8584', '#a9ada6', '#cfd0c6'),
        CRATE: ramp(INK, '#111715', '#1b2420', '#27322d', '#36433d', '#4c5b54', '#6c7d74'),
        MED: ramp(INK, '#141c1e', '#26333a', '#40525a', '#65797f', '#93a8aa', '#c3d3d0', '#e4eeea'),
        GLASS: ramp(INK, '#0c201d', '#163830', '#24584a', '#3f8a72', '#7cc4a6'),
        PAPER: ramp(INK, '#1f1d19', '#38342b', '#5a5442', '#827a60', '#aaa082', '#cbc2a2'),
        FOOD: ramp(INK, '#2a160c', '#5a3016', '#8e5524', '#c2843a', '#e8b866'),
        TEAL: ramp(INK, '#062a2a', '#0e4d4a', '#1a7f72', '#2fcdb0', '#7ff5da'),
        STAR: ramp(INK, '#1b272c', '#4c5f66', '#b3c2c0', '#f6f1e4'),
        HAZE: ramp(INK, '#091115', '#0d1b21', '#12262e', '#193139'),
        DUST: ramp(INK, '#140e0a', '#26180f', '#3e2716', '#5e3c20'),
        PLUME: ramp(INK, '#0e1a26', '#183048', '#2a5878', '#5a9cc4', '#b4e2f4', '#f2fbff'),
    };

    // ── a painter: an RGBA buffer, empty (see-through) until painted ────────────────────────────────────────────────
    function painter(W, H, oy = 0) {
        const data = new Uint8ClampedArray(W * H * 4);
        const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
        const set = (x, y, rgb) => { x = Math.floor(x); y = Math.floor(y); if (!inside(x, y)) return; const o = (y * W + x) * 4; data[o] = rgb[0]; data[o + 1] = rgb[1]; data[o + 2] = rgb[2]; data[o + 3] = 255; };
        const clear = (x, y) => { x = Math.floor(x); y = Math.floor(y); if (inside(x, y)) data[(y * W + x) * 4 + 3] = 0; };
        const has = (x, y) => inside(x, y) && data[(y * W + x) * 4 + 3] > 0;
        const get = (x, y) => { const o = (y * W + x) * 4; return [data[o], data[o + 1], data[o + 2]]; };
        // tone dithers with the WORLD row (y + oy), so a deck's grain lines up with the deck above it
        const tone = (x, y, r, v) => { x = Math.floor(x); y = Math.floor(y); set(x, y, r.rgb[level(r, v, x, y + oy)]); };
        const hex = (x, y, h) => set(x, y, hexRgb(h));
        const region = (x0, y0, x1, y1, fn) => { for (let y = Math.max(0, Math.floor(y0)); y < Math.min(H, Math.ceil(y1)); y++) for (let x = Math.max(0, Math.floor(x0)); x < Math.min(W, Math.ceil(x1)); x++) fn(x, y); };
        const ellipse = (cx, cy, rx, ry, fn) => region(cx - rx - 1, cy - ry - 1, cx + rx + 1, cy + ry + 1, (x, y) => { const q = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2; if (q < 1) fn(x, y, q); });
        const line = (x0, y0, x1, y1, fn) => { const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0))); for (let k = 0; k <= n; k++) fn(Math.round(x0 + (x1 - x0) * k / n), Math.round(y0 + (y1 - y0) * k / n), k / n); };
        const canvas = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; c.getContext('2d').putImageData(new ImageData(data, W, H), 0, 0); return c; };
        return { W, H, oy, data, set, clear, has, get, tone, hex, region, ellipse, line, canvas };
    }

    /** A box seen face on: lit top, a lighter right edge, a dark left edge, a dark foot; optional inset panel. */
    function box(p, x0, y0, x1, y1, r, base, o = {}) {
        const tex = o.tex == null ? 0.05 : o.tex, s = o.seed || 7;
        p.region(x0, y0, x1, y1, (x, y) => {
            const dx = x - x0, dy = y - y0, ex = x1 - 1 - x, ey = y1 - 1 - y;
            let v = base + (fbm(x / 6, (y + p.oy) / 5, s) - 0.5) * tex * 2;
            if (dy === 0) v = base + (o.topLit == null ? 0.28 : o.topLit);
            else if (dy === 1 && o.topLit !== 0) v = base + 0.1;
            else if (ex === 0) v = base + 0.1;
            else if (dx === 0) v = base - 0.08;
            else if (ey === 0) v = base - 0.1;
            else if (o.panel && (dx === o.panel || ex === o.panel || dy === o.panel + 1 || ey === o.panel) && dx >= o.panel && ex >= o.panel && dy >= o.panel + 1 && ey >= o.panel) v = base - 0.07;
            else if (o.panel && (dx === o.panel + 1 && dy > o.panel + 1 && ey > o.panel) ) v = base + 0.04;
            p.tone(x, y, r, v);
        });
    }
    /** A top surface seen a little from above (things below eye height): `rows` rows over y, the front edge lit. */
    function topSurface(p, x0, x1, y, rows, r, base) {
        for (let k = 0; k < rows; k++) p.region(x0 + (rows - k) * 0.5, y - rows + k, x1 - (rows - k) * 0.5, y - rows + k + 1, (x, yy) => p.tone(x, yy, r, base + (k === rows - 1 ? 0.24 : 0.08 + k * 0.03)));
    }

    // 3 × 5 stencil letters (SceneArt's numbers, plus the letters the deck names need)
    const GLYPHS = { 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001', 5: '111100111001111', 6: '111100111101111',
        A: '010101111101101', B: '110101110101110', D: '110101101101110', E: '111100110100111', G: '011100101101011', H: '101101111101101',
        I: '111010010010111', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '111101101101111', Q: '010101101111011',
        R: '110101110101101', S: '111100111001111', T: '111010010010010', U: '101101101101111', Y: '101101010010010', ' ': '000000000000000' };
    function stencil(p, str, x0, y, r, v, wear = 0.18) {
        [...str].forEach((ch, i) => { const g = GLYPHS[ch] || GLYPHS[' ']; for (let k = 0; k < 15; k++) { const x = x0 + i * 4 + (k % 3), yy = y + Math.floor(k / 3); if (g[k] === '1' && hash(x, yy + p.oy, 5) > wear) p.tone(x, yy, r, v); } });
    }

    // ── light: lamps warm what is near them; a screen cools it; quantized with the Bayer grain ────────────────────
    function lamp(x, y, o = {}) { return Object.assign({ x, y, reach: 50, k: 1, tint: [1, 0.72, 0.45], up: 0.4, kind: 'lamp' }, o); }
    function lightPass(p, lights, o = {}) {
        if (!lights.length && !o.dim) return;
        const W = p.W, H = p.H, dim = o.dim || 1;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const k4 = (y * W + x) * 4; if (!p.data[k4 + 3]) continue;
            let r = p.data[k4] * dim, g = p.data[k4 + 1] * dim, b = p.data[k4 + 2] * dim;
            for (const s of lights) {
                const dx = (x - s.x) / 1.25, dy = y - s.y;
                const d = Math.hypot(dx, dy < 0 ? dy * 2.2 : dy * 0.82);
                let w = Math.exp(-d / s.reach) * s.k * (s.up + (1 - s.up) * smooth(-18, 0, dy));
                if (w < 0.02) continue;
                const q = Math.min(1, Math.floor(Math.min(1, w * 1.15) * 5 + bay(x, y + p.oy)) / 5);
                if (q <= 0) continue;
                const lum = 0.3 * r + 0.59 * g + 0.11 * b, gain = 1 + q * 2.2 * clamp01(1 - lum / 200);
                const t = Math.min(1, q * 1.4), bloom = q * q;
                r = r + (lum * gain * s.tint[0] - r) * t + bloom * 40 * s.tint[0];
                g = g + (lum * gain * s.tint[1] - g) * t + bloom * 40 * s.tint[1];
                b = b + (lum * gain * s.tint[2] - b) * t + bloom * 40 * s.tint[2];
            }
            p.data[k4] = Math.min(255, r); p.data[k4 + 1] = Math.min(255, g); p.data[k4 + 2] = Math.min(255, b);
        }
    }

    // ── the hull section and the inside of the cylinder ─────────────────────────────────────────────────────────
    /** The cut hull plating: a lit outer skin on the right (the light is outside, ahead and to the right), insulation, a liner. */
    function plating(p, x, y, d, side, wy, solid) {
        let v;
        if (d === 0) v = side > 0 ? 0.8 : 0.3;
        else if (d === 1) v = side > 0 ? 0.52 : 0.22;
        else if (d >= L.PLATE - 2) v = d === L.PLATE - 1 ? 0.42 : 0.3;
        else v = solid ? 0.32 + (d === 2 ? 0.08 : 0) : 0.1 + ((wy % 24) < 2 ? 0.16 : 0) + (fbm(d / 3, wy / 5, 31) - 0.5) * 0.08;
        p.tone(x, y, R.HULL, v);
    }
    /** The hull's outer skin, seen beyond the cut edge where the cylinder curves away: lit on the right, dark on the left.
        k counts outward from the cut (0 … SKIN-1). */
    const SKIN = 9;
    function skin(p, x, y, k, side, wy) {
        let v = side > 0 ? 0.4 + 0.045 * k + (k === SKIN - 1 ? 0.12 : 0) : 0.27 - 0.02 * k + (k === SKIN - 1 ? 0.07 : 0);
        const seam = ((wy % 30) + 30) % 30;
        if (seam === 0) v -= 0.14; else if (seam === 1) v += 0.05;
        if ((seam === 3 || seam === 27) && k % 3 === 1) v += 0.1;
        if (k === 4 && ((Math.floor(wy / 30) & 1) === 0)) v -= 0.06;
        v += (fbm(k / 3, wy / 9, 33 + (side > 0 ? 1 : 0)) - 0.5) * 0.08;
        p.tone(x, y, R.HULL, v);
    }
    function hullSides(p, y, wy, hw, solid, th = L.PLATE) {
        const xl = Math.round(L.CX - hw), xr = Math.round(L.CX + hw);
        for (let k = 0; k < SKIN; k++) { skin(p, xl - 1 - k, y, k, -1, wy); skin(p, xr + k, y, k, 1, wy); }
        for (let d = 0; d < th; d++) { plating(p, xl + d, y, d, -1, wy, solid); plating(p, xr - 1 - d, y, d, 1, wy, solid); }
        return [xl + th, xr - th];
    }
    const RIBS = Array.from({ length: 15 }, (_, k) => { const th = (k - 7) * 12 * Math.PI / 180; return { x: L.CX + L.RIN * Math.sin(th), w: Math.max(1, Math.round(6 * Math.cos(th))), c: Math.cos(th) }; });
    function backWall(p, x, y, wy, o) {
        const sx = (x + 0.5 - L.CX) / L.RIN, c = Math.sqrt(Math.max(0, 1 - sx * sx));
        let v = 0.15 + 0.13 * c + (fbm(x / 9, wy / 7, 3) - 0.5) * 0.07;
        const ly = y - 22;
        if (ly % 44 === 0) v -= 0.07; else if (ly % 44 === 1) v += 0.04;
        for (const r of RIBS) {
            const dx = x - (r.x - r.w / 2);
            if (dx >= 0 && dx < r.w) { v = 0.3 + 0.1 * r.c + (dx === r.w - 1 ? 0.12 : dx === 0 ? -0.08 : 0); if (ly % 44 === 3 && dx === Math.floor(r.w / 2)) v += 0.15; break; }
            if ((dx === -2 || dx === r.w + 1) && ly % 44 === 4) v += 0.12;                                   // a rivet by each rib
        }
        v *= 1 - 0.38 * smooth(L.DECK_FLOOR - 72, L.DECK_FLOOR, y);                                                                    // darker near the floor
        if (y < 34) v *= 0.82;
        if (o.shaft && x >= L.LX - 15 && x <= L.LX + 15) v *= 0.55;                                            // the ladder well is a recess
        p.tone(x, y, R.WALL, v);
    }
    function ceiling(p, x, y, wy) {
        const seg = (x + 13) % 64;
        let v;
        if (y < 2) v = 0.08;
        else if (y < 12) { v = y === 11 ? 0.42 : y === 2 ? 0.12 : 0.2 + (y === 10 ? 0.06 : 0); if (seg === 0) v = 0.08; else if (seg === 1 || seg === 63) v += 0.12; }
        else if (y === 12) v = 0.06;
        else if (y < 16) v = [0.14, 0.24, 0.4][y - 13];
        else if (y < 19) v = [0.1, 0.2, 0.34][y - 16];
        else v = (x % 5 === 0 && y === 20) ? 0.3 : 0.1;
        if ((x + 31) % 82 < 2 && y > 1) v = 0.3 + ((x + 31) % 82 === 1 ? 0.1 : 0);                              // brackets
        p.tone(x, y, R.STEEL, v);
    }
    function slab(p, x, y) {
        const ly = y - L.DECK_FLOOR;
        let v;
        if (ly === 0) v = 0.62; else if (ly === 1) v = 0.4; else if (ly < 4) v = 0.26 + ((x + ly * 2) % 6 === 0 ? 0.08 : 0);
        else if (ly === 4) v = 0.12;
        else if (ly < 13) { v = 0.18; const hx = (x + 20) % 40; if (ly > 5 && ly < 12 && Math.hypot((hx - 20) / 1.6, ly - 8.5) < 3.2) v = 0.05; if (ly === 8 && (hx < 12 || hx > 28)) v = 0.3; }
        else if (ly < 15) v = 0.24; else v = 0.1;
        p.tone(x, y, R.STEEL, v);
    }
    /** The hatch in a deck's floor, open (the lid stands up beside it) or shut (a lid with a wheel on top). */
    function hatch(p, closed) {
        const F = L.DECK_FLOOR, x0 = L.LX - 14, x1 = L.LX + 14;
        p.region(x0, F, x1 + 1, L.PITCH, (x, y) => p.tone(x, y, R.WALL, 0.05 + (y > F + 12 ? 0.03 : 0)));
        p.region(x0 - 1, F, x0, L.PITCH, (x, y) => p.tone(x, y, R.STEEL, 0.46));
        p.region(x1 + 1, F, x1 + 2, L.PITCH, (x, y) => p.tone(x, y, R.STEEL, 0.3));
        if (closed) {
            p.region(x0 - 1, F, x1 + 2, F + 4, (x, y) => p.tone(x, y, R.STEEL, [0.62, 0.42, 0.3, 0.16][y - F]));
            for (let dx = -4; dx <= 4; dx++) { p.tone(L.LX + dx, F - 3, R.STEEL, Math.abs(dx) === 4 ? 0.3 : 0.55); }
            p.tone(L.LX - 4, F - 2, R.STEEL, 0.4); p.tone(L.LX + 4, F - 2, R.STEEL, 0.62); p.tone(L.LX, F - 2, R.STEEL, 0.5); p.tone(L.LX, F - 1, R.STEEL, 0.4);
            p.region(L.LX - 2, F - 1, L.LX + 3, F, (x, y) => p.tone(x, y, R.STEEL, 0.34));
        } else {
            p.region(x1 + 3, F - 26, x1 + 6, F, (x, y) => p.tone(x, y, R.STEEL, [0.56, 0.36, 0.2][x - x1 - 3] + (y === F - 26 ? 0.1 : 0)));
            p.tone(x1 + 4, F - 14, R.STEEL, 0.7); p.tone(x1 + 4, F - 13, R.STEEL, 0.5);
        }
    }
    /** The landing legs lie folded along the outside of the hull beside the two lowest decks; the hinge is on the hold. */
    function legStruts(p, i) {
        const y0 = i === L.N - 2 ? 120 : 0;
        for (const s of [-1, 1]) {
            const hx = L.CX + s * (L.HO + 10);
            for (let y = y0; y < L.PITCH; y++) for (let k = 0; k < 5; k++) p.tone(hx + s * k, y, R.HULL, s > 0 ? [0.3, 0.5, 0.42, 0.34, 0.66][k] : [0.18, 0.26, 0.22, 0.18, 0.28][k] + ((y + p.oy) % 40 === 0 ? 0.12 : 0));
            if (y0) p.region(Math.min(hx, hx - s * 4) - 1, y0 - 3, Math.max(hx, hx - s * 4) + 4, y0 + 4, (x, y) => p.tone(x, y, R.HULL, y === y0 - 3 ? 0.6 : 0.36));
        }
    }
    /** The ladder: two rails and a rung every 8 rows, on the same world rows on every deck. */
    function ladder(p, yTop, yBot) {
        const lx = L.LX;
        p.region(lx - 13, yTop, lx - 11, yBot, (x, y) => p.tone(x, y, R.STEEL, x === lx - 13 ? 0.42 : 0.62));
        p.region(lx + 12, yTop, lx + 14, yBot, (x, y) => p.tone(x, y, R.STEEL, x === lx + 12 ? 0.5 : 0.3));
        for (let y = Math.ceil(yTop); y < yBot; y++) {
            if (((y + p.oy) % 8 + 8) % 8 !== 6) continue;
            p.region(lx - 11, y, lx + 12, y + 1, (x, yy) => p.tone(x, yy, R.STEEL, 0.56));
            p.region(lx - 11, y + 1, lx + 12, y + 2, (x, yy) => p.tone(x, yy, R.STEEL, 0.16));
        }
    }
    /** A round window in the back wall: see-through, with a lit rim on the upper right. */
    function porthole(p, cx, cy, r = 11) {
        p.region(cx - r - 5, cy - r - 5, cx + r + 6, cy + r + 6, (x, y) => {
            const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy);
            if (d < r) { p.clear(x, y); return; }
            if (d < r + 1) { p.tone(x, y, R.STEEL, 0.1); return; }
            if (d < r + 4) { const lit = (dx - dy) / (d * 1.41); p.tone(x, y, R.STEEL, 0.32 + 0.3 * lit + ((Math.round(Math.atan2(dy, dx) * 8 / Math.PI) & 1) && d > r + 2.5 ? 0.1 : 0)); return; }
            if (d < r + 5) p.tone(x, y, R.WALL, 0.08);
        });
        return { kind: 'glint', x: cx, y: cy, r };
    }

    /** No two floors alike: an inspection plate over the lightening holes, a pipe run down through the slab, and a lit
        grate in the deck plating, each at its own place on each deck. */
    function floorVariety(p, i) {
        const F = L.DECK_FLOOR, px = 170 + ((i * 97) % 300), gx = 360 + ((i * 131) % 230), vx = 600 - ((i * 59) % 260);
        p.region(px, F + 5, px + 38, F + 13, (x, y) => {                                                  // the plate, rivets in its corners
            const e = x === px || x === px + 37 || y === F + 5 || y === F + 12, rv = (x === px + 2 || x === px + 35) && (y === F + 7 || y === F + 10);
            p.tone(x, y, R.STEEL, rv ? 0.5 : e ? (y === F + 5 ? 0.38 : 0.12) : 0.24 + (fbm(x / 5, y / 3, 61 + i) - 0.5) * 0.08);
        });
        p.region(gx, F, gx + 16, F + 3, (x, y) => p.tone(x, y, (x - gx) % 3 === 1 ? (i % 2 ? R.TEAL : R.AMBER) : R.STEEL, (x - gx) % 3 === 1 ? 0.3 + (y === F ? 0.12 : 0) : 0.14));
        if (i === L.N - 1) return;                                                                        // the drum passes through engineering's floor
        p.region(vx, F + 3, vx + 5, L.PITCH, (x, y) => p.tone(x, y, R.STEEL, [0.16, 0.34, 0.48, 0.3, 0.12][x - vx] + (y === F + 15 ? 0.1 : 0)));
        p.region(vx - 2, F + 3, vx + 7, F + 5, (x, y) => p.tone(x, y, R.STEEL, y === F + 3 ? 0.52 : 0.26));
    }
    /** One deck's shell: hull section both sides, back wall, ceiling, floor slab, ladder, hatch, the deck's name. */
    function shell(p, i, o) {
        const top = deckTop(i);
        for (let y = 0; y < L.PITCH; y++) {
            const wy = top + y;
            hullSides(p, y, wy, L.HO, y >= L.DECK_FLOOR);
            for (let x = L.IL; x < L.IR; x++) {
                if (y >= L.DECK_FLOOR) slab(p, x, y);
                else if (y < 22) ceiling(p, x, y, wy);
                else backWall(p, x, y, wy, { shaft: true });
            }
        }
        for (const side of [-1, 1]) {                                                     // knee brackets where the hull meets the deck above
            const x0 = side < 0 ? L.IL : L.IR - 1, G = 22;
            for (let j = 0; j < G; j++) for (let k = 0; k < G - j; k++) {
                const x = x0 - side * k, y = 22 + j;
                if (side < 0 && x >= L.LX - 16) continue;
                const edge = k === G - j - 1, hole = Math.hypot(k - 6, j - 6) < 3.2;
                p.tone(x, y, R.STEEL, hole ? 0.06 : edge ? (side > 0 ? 0.3 : 0.5) : 0.24 + (j === 0 ? 0.08 : 0));
            }
        }
        floorVariety(p, i);
        if (i < L.N - 1) hatch(p, !!o.hatchClosed);
        if (i >= L.N - 2) legStruts(p, i);
        ladder(p, i === 0 ? L.DECK_FLOOR - 104 : 0, i === L.N - 1 ? L.DECK_FLOOR : L.PITCH);
        if (i === 0) {                                                                    // the top of the ladder: a grab bar
            p.region(L.LX - 13, L.DECK_FLOOR - 106, L.LX + 14, L.DECK_FLOOR - 103, (x, y) => p.tone(x, y, R.STEEL, y === L.DECK_FLOOR - 106 ? 0.62 : 0.3));
        }
        const name = ['1 BRIDGE', '2 LAB', '3 QUARTERS', '4 MED BAY', '5 HOLD', '6 ENGINEERING'][i];
        stencil(p, name, L.LX + 22, 92, R.WALL, 0.62);
        p.region(L.LX + 22, 99, L.LX + 22 + name.length * 4 - 1, 100, (x, y) => { if (hash(x, i, 9) > 0.25) p.tone(x, y, R.AMBER, 0.32); });
    }

    // ── decks: painted once per look and kept ───────────────────────────────────────────────────────────────────
    const ROOMS = [];                       // ship-rooms.js fills this: ROOMS[i] = (p, look, api) => { lamps, fx, lights }
    const deckCache = new Map();
    function deck(i, look = {}) {
        const key = i + '|' + JSON.stringify(look);
        if (deckCache.has(key)) return deckCache.get(key);
        const p = painter(L.W, L.PITCH, deckTop(i));
        shell(p, i, look);
        const room = ROOMS[i] ? ROOMS[i](p, look, api) : { lamps: [], fx: [], lights: [] };
        if (i === 1 || i === 4) [[-1, '#e2574c', '#3a1210', 0], [1, '#74d99a', '#0f2a1c', 1300]].forEach(([s, color, dim, phase]) =>    // navigation lights, red to port, green to starboard
            room.fx = (room.fx || []).concat([{ kind: 'nav', x: L.CX + s * (L.HO + 9), y: 60, color, dim, phase }]));
        const lamps = (room.lamps || []).filter(l => !l.off);
        lamps.forEach(l => drawLampCage(p, l.x, true, l.low));
        (room.lamps || []).filter(l => l.off).forEach(l => drawLampCage(p, l.x, false, l.low));
        const lights = lamps.map(l => lamp(l.x, (l.low ? l.low : 26) + 2, { reach: l.reach || 52, k: l.k || 1 })).concat(room.lights || []);
        lightPass(p, lights, { dim: look.dark ? 0.5 : 1 });
        const out = { canvas: p.canvas(), lamps: lamps.map(l => ({ x: l.x, y: deckTop(i) + (l.low || 26), reach: l.reach || 52 })), fx: (room.fx || []).map(f => Object.assign({}, f, { y: f.y + deckTop(i) })) };
        deckCache.set(key, out);
        return out;
    }
    /** A caged lamp hanging from the ceiling pipes; `low` hangs it lower on a cord (over the galley table). */
    function drawLampCage(p, lx, on, low) {
        const y0 = low || 26;
        for (let y = 20; y < y0 - 2; y++) p.tone(lx, y, R.STEEL, 0.34);
        const row = (y, x0, x1, fn) => { for (let x = x0; x <= x1; x++) fn(x, y); };
        row(y0 - 2, lx - 4, lx + 4, (x, y) => p.tone(x, y, R.STEEL, x === lx + 4 ? 0.5 : 0.3));
        if (on) {
            row(y0 - 1, lx - 4, lx + 4, (x, y) => p.hex(x, y, Math.abs(x - lx) === 4 ? '#7a4a1e' : '#ffd28a'));
            row(y0, lx - 3, lx + 3, (x, y) => p.hex(x, y, x === lx ? '#fff4d6' : '#f0b060'));
            row(y0 + 1, lx - 2, lx + 2, (x, y) => p.hex(x, y, '#c4803a'));
        } else {
            row(y0 - 1, lx - 4, lx + 4, (x, y) => p.tone(x, y, R.STEEL, 0.22));
            row(y0, lx - 3, lx + 3, (x, y) => p.tone(x, y, R.STEEL, x === lx + 1 ? 0.42 : 0.16));
            row(y0 + 1, lx - 2, lx + 2, (x, y) => p.tone(x, y, R.STEEL, 0.12));
        }
    }

    // ── the nose: a cone of ring frames above the bridge; a red light on the tip ───────────────────────────────────
    const NOSE_H = L.TOP0 - L.TIP;
    const noseHalf = y => { const t = clamp01((y - L.TIP) / NOSE_H); return L.HO * (0.05 + 0.95 * Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t)))); };
    let noseCache = null;
    function nose() {
        if (noseCache) return noseCache;
        const p = painter(L.W, L.TOP0, 0);
        for (let y = L.TIP; y < L.TOP0; y++) {
            const hw = noseHalf(y), th = Math.max(6, Math.round(L.PLATE * Math.min(1, hw / 120)));
            const [il, ir] = hullSides(p, y, y, hw, y >= L.TOP0 - 18, th);
            for (let x = il; x < ir; x++) {
                if (y >= L.TOP0 - 18) { slab(p, x, y - (L.TOP0 - 18) + L.DECK_FLOOR); continue; }
                const rel = (y - L.TIP) / NOSE_H, ring = (y - L.TIP) % 46;
                let v = 0.07 + 0.05 * Math.sqrt(Math.max(0, 1 - ((x - L.CX) / hw) ** 2)) + (fbm(x / 8, y / 6, 41) - 0.5) * 0.05;
                if (ring < 4 && rel > 0.12) v = [0.3, 0.2, 0.14, 0.08][ring];                    // a ring frame, cut through
                if (Math.abs(x - L.CX) < 2 && rel > 0.05) v = x === L.CX + 1 ? 0.28 : 0.2;      // the spine strut
                p.tone(x, y, R.WALL, v);
            }
        }
        // a dish antenna stowed in the cone, a tank, cables down to the bridge
        const dy = L.TIP + Math.round(NOSE_H * 0.5);
        p.ellipse(L.CX - 40, dy, 46, 14, (x, y) => { if (y >= dy - 2) p.tone(x, y, R.STEEL, 0.2 + 0.28 * (1 - (y - dy) / 14) + (x > L.CX - 20 ? 0.06 : 0)); });
        p.line(L.CX - 40, dy + 13, L.CX - 40, dy + 40, (x, y) => { p.tone(x, y, R.STEEL, 0.4); p.tone(x + 1, y, R.STEEL, 0.22); });
        p.ellipse(L.CX + 70, L.TIP + NOSE_H * 0.72, 30, 30, (x, y) => { const nx = (x - L.CX - 70) / 30, ny = (y - L.TIP - NOSE_H * 0.72) / 30; p.tone(x, y, R.STEEL, 0.14 + 0.32 * clamp01(nx * 0.6 - ny * 0.7 + 0.25)); });
        for (let k = 0; k < 4; k++) p.line(L.CX - 120 + k * 3, L.TIP + NOSE_H * 0.62, L.CX - 150 + k * 3, L.TOP0 - 18, (x, y) => p.tone(x, y, R.STEEL, 0.12 + (k === 1 ? 0.08 : 0)));
        // a service ladder up the spine, stowed crates and a coiled line on the cone's floor, bands on the tank
        for (let y = L.TOP0 - 18 - 120; y < L.TOP0 - 18; y++) { p.tone(L.CX + 6, y, R.STEEL, 0.34); p.tone(L.CX + 14, y, R.STEEL, 0.24); if (y % 8 === 0) for (let x = L.CX + 7; x < L.CX + 14; x++) p.tone(x, y, R.STEEL, 0.42); }
        [[L.CX - 160, 26, 18], [L.CX - 132, 20, 14], [L.CX - 156, 18, 12, 18]].forEach(([x, w, h, up]) => {
            const y1 = L.TOP0 - 18 - (up || 0), y0 = y1 - h;
            p.region(x, y0, x + w, y1, (xx, yy) => p.tone(xx, yy, R.CRATE, yy === y0 ? 0.6 : xx === x + w - 1 ? 0.48 : xx === x ? 0.22 : 0.34 + ((yy - y0) === Math.round(h * 0.4) ? -0.12 : 0)));
        });
        p.ellipse(L.CX + 40, L.TOP0 - 22, 10, 4, (x, y, q) => p.tone(x, y, R.WOOL, q > 0.55 ? 0.42 : q > 0.25 ? 0.2 : 0.3));
        { const cy = L.TIP + NOSE_H * 0.72; for (const dy of [-12, 0, 12]) p.ellipse(L.CX + 70, cy + dy, 30 * Math.sqrt(1 - (dy / 30) ** 2), 1, (x, y) => p.tone(x, y, R.STEEL, 0.1 + 0.2 * clamp01((x - L.CX - 40) / 60))); }
        // the mast on the tip
        p.region(L.CX - 1, L.TIP - 26, L.CX + 1, L.TIP, (x, y) => p.tone(x, y, R.HULL, x === L.CX ? 0.66 : 0.3));
        p.region(L.CX - 6, L.TIP - 14, L.CX + 7, L.TIP - 13, (x, y) => p.tone(x, y, R.HULL, 0.5));
        noseCache = { canvas: p.canvas(), fx: [{ kind: 'beacon', x: L.CX, y: L.TIP - 28 }] };
        return noseCache;
    }

    // ── the tail: the skirt flares over the engine; tanks and the thrust frame inside; two landing legs folded up ─
    let tailCache = null;
    function tail() {
        if (tailCache) return tailCache;
        const T0 = L.TAIL0, H = L.H - T0, p = painter(L.W, H, T0), SK = 150;
        const half = y => (y < 70 ? L.HO : L.HO + 46 * smooth(70, SK, y));
        for (let y = 0; y < SK; y++) {
            const hw = half(y), [il, ir] = hullSides(p, y, y + T0, hw, y > SK - 6);
            for (let x = il; x < ir; x++) {
                if (y >= SK - 6) { p.tone(x, y, R.HULL, y === SK - 6 ? 0.5 : 0.22); continue; }
                let v = 0.06 + (fbm(x / 9, y / 7, 51) - 0.5) * 0.05;
                const tr = (x - L.CX + 400) % 60;                                                   // the thrust frame: a lattice
                if (y > 8 && (Math.abs(((x + y) % 60) - 30) < 1 || Math.abs(((x - y + 600) % 60) - 30) < 1)) v = 0.2;
                if (tr === 0) v = 0.24;
                p.tone(x, y, R.WALL, v);
            }
        }
        for (const s of [-1, 1]) {                                                                 // two propellant tanks
            const cx = L.CX + s * 170, cy = 70;
            p.ellipse(cx, cy, 62, 52, (x, y) => {
                const nx = (x - cx) / 62, ny = (y - cy) / 52, band = [-0.55, 0, 0.55].some(b => Math.abs(ny - b) < 0.025), rivet = band && (x % 7 === 0);
                let v = 0.12 + 0.36 * clamp01(nx * 0.55 - ny * 0.75 + 0.2) + (fbm(x / 7, y / 5, 71 + s) - 0.5) * 0.1;
                if (band) v -= 0.08; if (rivet) v += 0.2; if (Math.abs(nx) < 0.02 && ny > 0) v -= 0.06;
                p.tone(x, y, R.STEEL, v);
            });
        }
        // the engine: a chamber in the middle, its bell out below the skirt
        p.region(L.CX - 22, 10, L.CX + 22, SK - 6, (x, y) => p.tone(x, y, R.STEEL, 0.18 + 0.3 * clamp01((x - L.CX + 22) / 44) * (y < 18 ? 1.3 : 1)));
        for (let y = 0; y < 120; y++) {
            const hw = 26 + 52 * Math.pow(y / 120, 1.15), yy = SK - 6 + y;
            for (let x = Math.round(L.CX - hw); x < Math.round(L.CX + hw); x++) {
                const u = (x + 0.5 - L.CX) / hw;
                const v = u > 0.86 ? 0.82 : u > 0.6 ? 0.55 : 0.16 + 0.26 * (u + 1) / 2 + (y % 14 === 0 ? 0.08 : 0);
                const seam = Math.abs(((u + 1) * 6) % 1 - 0.5) > 0.46 && Math.abs(u) < 0.86, soot = (fbm(x / 6, y / 4, 81) - 0.45) * 0.3 * (y / 120);
                p.tone(x, yy, R.HULL, Math.abs(u) > 0.97 ? 0.3 : v - (seam ? 0.06 : 0) - Math.max(0, soot));
            }
        }
        // landing legs folded flat along the skirt: strut, hinge and pad, both sides
        for (const s of [-1, 1]) {
            const hx = L.CX + s * (L.HO + 10), px = L.CX + s * (L.HO + 62);
            p.line(hx, 0, px, SK + 52, (x, y) => { for (let k = 0; k < 5; k++) p.tone(x + s * k, y, R.HULL, s > 0 ? [0.3, 0.5, 0.42, 0.34, 0.66][k] : [0.18, 0.26, 0.22, 0.18, 0.28][k]); });
            p.region(px - 12, SK + 52, px + 13, SK + 56, (x, y) => p.tone(x, y, R.HULL, y === SK + 52 ? (s > 0 ? 0.7 : 0.4) : 0.24));
                    }
        tailCache = { canvas: p.canvas(), fx: [{ kind: 'plume', x: L.CX, y: T0 + SK - 6 + 120, w: 78 }, { kind: 'chamber', x: L.CX, y: T0 + 10, h: SK - 16 }] };
        return tailCache;
    }

    // ── space: tiles of stars over a thin teal haze ─────────────────────────────────────────────────────────────
    const starTiles = [];
    function stars(layer) {
        if (starTiles[layer]) return starTiles[layer];
        const S = 512, p = painter(S, S, 0), rand = seeded(layer ? 917 : 211), list = [];
        const pv = (x, y, s, P) => {                                                   // value noise that wraps every P cells
            const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = n => ((n % P) + P) % P;
            const a = hash(w(xi), w(yi), s), b = hash(w(xi + 1), w(yi), s), c = hash(w(xi), w(yi + 1), s), d = hash(w(xi + 1), w(yi + 1), s);
            return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
        };
        const pf = (x, y, s, P) => { let sum = 0, amp = 0.5, n = 0, f = 1; for (let i = 0; i < 4; i++) { sum += amp * pv(x * f, y * f, s + i * 17, P * f); n += amp; f *= 2; amp *= 0.5; } return sum / n; };
        if (layer === 0) p.region(0, 0, S, S, (x, y) => {
            const tx = x / 64, ty = y / 64, h = Math.max(0, pf(tx, ty, 61, 8) - 0.5) * 1.15, d = Math.max(0, pf(tx * 0.5, ty * 0.5, 77, 4) - 0.64) * 1.5;
            if (h > 0.02) p.tone(x, y, R.HAZE, h); else p.tone(x, y, R.HAZE, 0);
        });
        const count = layer ? 70 : 520;
        for (let i = 0; i < count; i++) {
            const x = Math.floor(rand() * S), y = Math.floor(rand() * S), mag = rand();
            if (layer === 1) {
                if (mag > 0.8) { p.set(x, y, R.STAR.rgb[4]); [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dx, dy]) => p.set((x + dx + S) % S, (y + dy + S) % S, R.STAR.rgb[2])); }
                else p.set(x, y, R.STAR.rgb[3]);
            } else {
                if (mag > 0.985) { p.set(x, y, R.STAR.rgb[4]); p.set(x + 1, y, R.STAR.rgb[2]); }
                else p.set(x, y, R.STAR.rgb[mag > 0.7 ? 3 : mag > 0.35 ? 2 : 1]);
            }
            if (mag > 0.9) list.push({ x, y });
        }
        starTiles[layer] = { canvas: p.canvas(), size: S, bright: list };
        return starTiles[layer];
    }

    const api = { L, R, INK, deckTop, floorY, painter, box, topSurface, stencil, lamp, porthole, plating, hash, fbm, vnoise, bay, clamp01, smooth, mix, hexRgb, rgbHex, level };
    root.ShipArt = { L, R, INK, deckTop, floorY, deck, nose, tail, stars, ROOMS, api, noseHalf };
})(typeof window !== 'undefined' ? window : globalThis);
