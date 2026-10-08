/* Silent Exodus game screen v3: the picture recipes. Nothing here is new art: it is lifted, function by function, from
     main-screens.html (v1)   the dither recipe, the Deep field palette, space and dust, the light, sphere, surfaceFor (v1's
                              gentler gas bands), lightVector, drawStation, twinkle
     game-screen.html (v2)    painter.add, rims for the pointing highlight, contactBlip, the pixel font, paintGiant, paintRogue
     ship-study.html          hull(), cyl(), shapeB (the Lander), stencil, dust, duskLand, wreckB, wreckPicture
   Changes, all of them listed: paintGiant and paintRogue take their geometry as arguments (so the giant can drift across a
   sector and be pushed in on); the Lander's radius is re-proportioned to the living ship (crew-hires/ship-art.js: nose cone
   23 % of the length, decks 69 %, skirt 8 %, the bell beyond; width a third of the length); hull() paints only the box the
   turned hull covers, and can roll the hull over (mirror) for the quarter turn into the ship view.
     window.V3Paint = { ... } (see the export at the bottom) */
(function () {
    'use strict';

    // ── 1. the recipe: ordered 8 x 8 Bayer dither between colour ramps, seeded value noise, one light ──
    const INK = '#05070a', TICK = 125;
    const BAYER_RAW = [0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22,
        3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21];
    const BAYER8 = BAYER_RAW.map(v => (v + 0.5) / 64);
    const threshold = (x, y) => BAYER8[((y & 7) << 3) | (x & 7)];
    const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
    const smooth = (a, b, v) => { const k = clamp01((v - a) / (b - a)); return k * k * (3 - 2 * k); };
    const lerp = (a, b, k) => a + (b - a) * k;
    function seeded(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
    const PERM = (() => { const r = seeded(1337), p = Array.from({ length: 256 }, (_, i) => i); for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } return Uint8Array.from(p); })();
    const hash = (x, y, s = 0) => PERM[(PERM[(PERM[x & 255] + y) & 255] + s) & 255] / 255;
    function vnoise(x, y, s = 0) {
        const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
        const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
        return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
    }
    function fbm(x, y, s = 0, oct = 4) { let sum = 0, amp = 0.5, f = 1, n = 0; for (let i = 0; i < oct; i++) { sum += amp * vnoise(x * f, y * f, s + i * 17); n += amp; f *= 2.03; amp *= 0.5; } return sum / n; }
    const hexRgb = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
    const ramp = (...hex) => ({ hex, rgb: hex.map(hexRgb) });
    function level(r, v, x, y) { const top = r.hex.length - 1, pos = clamp01(v) * top, lo = Math.floor(pos); return Math.min(top, lo + (pos - lo > threshold(x, y) ? 1 : 0)); }
    const norm3 = (x, y, z) => { const n = Math.hypot(x, y, z) || 1; return [x / n, y / n, z / n]; };

    // "Deep field": teal-black space, rust-gold dust, ice instruments; amber only for people; the false sun warmest.
    const RP = {
        STAR: ramp(INK, '#1b272c', '#4c5f66', '#b3c2c0', '#f6f1e4'),
        HAZE: ramp(INK, '#0a1317', '#0f222a', '#152f38', '#1f3a43'),
        DUST: ramp(INK, '#160f0b', '#2c1a10', '#4e2f1a', '#7c4a26', '#b0733c'),
        SUN: ramp(INK, '#1f140b', '#4a2e12', '#9a5a26', '#e9a25e', '#f7c483', '#fff3dc'),
        HULL: ramp(INK, '#121c22', '#22333b', '#3d5560', '#8aa2aa', '#e6eef0'),
        UI: ramp(INK, '#13232a', '#284650', '#3d6670', '#9fd8e6', '#e1f6fb'),
        ICE: ramp(INK, '#0c1a20', '#1a3440', '#33606e', '#7fb3c2', '#d6eef4'),
        STONE: ramp(INK, '#13181a', '#272f31', '#465153', '#7c8786', '#c4ccc8'),
        DESERT: ramp(INK, '#1a110c', '#38231a', '#664129', '#9c6a42', '#d0a376'),
        GAS: ramp(INK, '#1c120b', '#3f2715', '#6c4523', '#a26f3b', '#d9ad74'),
        DARK: ramp(INK, '#0e1216', '#1d242b', '#333d47', '#66727d', '#b4c0c8'),
        AMBER: ramp(INK, '#3a2410', '#8a5422', '#e8964a', '#f7c483', '#fff3dc'),
        RED: ramp(INK, '#3a1210', '#8a2a22', '#e2574c', '#ffd2c8'),
        RING: ramp(INK, '#130e0a', '#22180f', '#372615', '#553b1f', '#7d5a33', '#a88150'),   // the giant's ring: the body's own dust gold, dimmer
        RUST: ramp(INK, '#140f0e', '#261c19', '#3a2b25', '#564034', '#7a604f'),
        // the living ship's own plume (crew-hires/ship-art.js R.PLUME): the drive is the same blue inside and out
        PLUME: ramp(INK, '#0e1a26', '#183048', '#2a5878', '#5a9cc4', '#b4e2f4', '#f2fbff'),
        // a world we passed: cold and grey
        PASSED: ramp(INK, '#0d1114', '#1a2025', '#2b333a', '#48525a', '#6f7a82'),
        // the wreck at dusk (ship-study.html)
        WRUST: ramp(INK, '#1e0f0d', '#4a2320', '#7a3a2e', '#a8604a', '#d6a882'),
        DUSK: ramp(INK, '#0d1016', '#1c1f26', '#3a3632', '#6e5c46', '#a88a60'),
        GROUND: ramp(INK, '#0e0f10', '#1d1d1c', '#34312c', '#56504a', '#7a7064'),
        MOON: ramp(INK, '#141a20', '#2c363f', '#58666f', '#9aa8ae', '#dde6e8'),
    };
    const PLANET_RAMP = { desert: RP.DESERT, gas: RP.GAS, ice: RP.ICE, rock: RP.STONE, dark: RP.DARK };

    /** A pixel buffer painted once. An opaque buffer starts as ink; a clear one starts empty, and tone() leaves its darkest step empty. */
    function painter(W, H, isOpaque) {
        W = Math.max(1, Math.ceil(W)); H = Math.max(1, Math.ceil(H));
        const data = new Uint8ClampedArray(W * H * 4);
        if (isOpaque) { const k = hexRgb(INK); for (let i = 0; i < W * H; i++) { data[i * 4] = k[0]; data[i * 4 + 1] = k[1]; data[i * 4 + 2] = k[2]; data[i * 4 + 3] = 255; } }
        const set = (x, y, rgb) => { x = Math.floor(x); y = Math.floor(y); if (x < 0 || y < 0 || x >= W || y >= H) return; const o = (y * W + x) * 4; data[o] = rgb[0]; data[o + 1] = rgb[1]; data[o + 2] = rgb[2]; data[o + 3] = 255; };
        const clear = (x, y) => { x = Math.floor(x); y = Math.floor(y); if (x < 0 || y < 0 || x >= W || y >= H) return; data[(y * W + x) * 4 + 3] = 0; };
        const get = (x, y) => { const o = (y * W + x) * 4; return [data[o], data[o + 1], data[o + 2], data[o + 3]]; };
        const solid = (x, y, r, v) => set(x, y, r.rgb[level(r, v, Math.floor(x), Math.floor(y))]);
        const tone = (x, y, r, v) => { const k = level(r, v, Math.floor(x), Math.floor(y)); if (k === 0 && !isOpaque) return; set(x, y, r.rgb[k]); };
        const add = (x, y, r, v) => { const k = level(r, v, Math.floor(x), Math.floor(y)); if (k > 0) set(x, y, r.rgb[k]); };
        const over = add;
        const cover = (x, y, r, v, a) => { if (a > threshold(Math.floor(x) + 3, Math.floor(y) + 5)) tone(x, y, r, v); };
        const region = (x0, y0, x1, y1, fn) => { for (let y = Math.max(0, Math.floor(y0)); y < Math.min(H, Math.ceil(y1)); y++) for (let x = Math.max(0, Math.floor(x0)); x < Math.min(W, Math.ceil(x1)); x++) fn(x, y); };
        const ellipse = (cx, cy, rx, ry, fn) => region(cx - rx - 1, cy - ry - 1, cx + rx + 1, cy + ry + 1, (x, y) => { const q = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2; if (q < 1) fn(x, y, q); });
        const line = (x0, y0, x1, y1, fn) => { const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0))); for (let k = 0; k <= n; k++) fn(Math.round(x0 + (x1 - x0) * k / n), Math.round(y0 + (y1 - y0) * k / n), k / n); };
        const canvas = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; c.getContext('2d').putImageData(new ImageData(data, W, H), 0, 0); return c; };
        return { W, H, data, set, clear, get, solid, tone, add, over, cover, region, ellipse, line, canvas };
    }

    /** The moving layer: a few rectangles a frame, straight onto the canvas. */
    function framer(ctx, W, H) {
        let cur = '';
        const px = (x, y, hex, w = 1, h = 1) => { const xi = Math.round(x), yi = Math.round(y); if (xi + w <= 0 || yi + h <= 0 || xi >= W || yi >= H) return; if (hex !== cur) { ctx.fillStyle = hex; cur = hex; } ctx.fillRect(xi, yi, w, h); };
        const tone = (x, y, r, v, w = 1, h = 1) => { const xi = Math.round(x), yi = Math.round(y), k = level(r, v, xi, yi); if (k === 0) return; px(xi, yi, r.hex[k], w, h); };
        const glow = (cx, cy, rad, r, peak) => { for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) { const d = Math.hypot(x, y) / rad; if (d < 1) tone(cx + x, cy + y, r, peak * (1 - d) ** 1.5); } };
        return { px, tone, glow, reset: () => { cur = ''; } };
    }

    /** Many pixels a frame (streaks, the searchlight, the wake): written into one buffer and drawn once. */
    function pixelLayer(W, H) {
        const c = document.createElement('canvas'); c.width = W; c.height = H;
        const g = c.getContext('2d'), img = g.createImageData(W, H), d = img.data, d32 = new Uint32Array(d.buffer);
        const set = (x, y, rgb) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= W || y >= H) return; const o = (y * W + x) * 4; d[o] = rgb[0]; d[o + 1] = rgb[1]; d[o + 2] = rgb[2]; d[o + 3] = 255; };
        const tone = (x, y, r, v) => { const xi = Math.round(x), yi = Math.round(y), k = level(r, v, xi, yi); if (k > 0) set(xi, yi, r.rgb[k]); };
        return { W, H, set, tone, clear: () => d32.fill(0), draw: (ctx, x = 0, y = 0) => { g.putImageData(img, 0, 0); ctx.drawImage(c, x, y); } };
    }

    // ── 2. stars, space, the light (main-screens.html) ──
    function scatterStars(p, seed, count, where) {
        const rand = seeded(seed), list = [];
        for (let i = 0; i < count; i++) {
            const x = Math.floor(rand() * p.W), y = Math.floor(rand() * p.H), mag = rand();
            if (where && !where(x, y)) continue;
            if (mag > 0.978) { p.set(x, y, RP.STAR.rgb[4]); [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dx, dy]) => p.set(x + dx, y + dy, RP.STAR.rgb[2])); }
            else if (mag > 0.87) p.set(x, y, RP.STAR.rgb[3]);
            else p.set(x, y, RP.STAR.rgb[mag > 0.55 ? 2 : 1]);
            list.push({ x, y, mag });
        }
        return list;
    }
    function keepVisible(p, list) {
        return list.filter(s => { if (s.mag < 0.87 || s.x < 0 || s.y < 0 || s.x >= p.W || s.y >= p.H) return false; const c = p.get(s.x, s.y); return RP.STAR.rgb.slice(3).some(k => k[0] === c[0] && k[1] === c[1] && k[2] === c[2]); });
    }
    function twinkle(f, list, t, dx = 0) {
        const step = Math.floor(t / 375);
        list.forEach((s, i) => { if (hash(i, step, 5) < 0.88) return; const x = s.x - dx; f.px(x - 1, s.y, RP.STAR.hex[3], 3, 1); f.px(x, s.y - 1, RP.STAR.hex[3], 1, 3); f.px(x, s.y, RP.STAR.hex[4]); });
    }

    /** Space for a whole sector, wider than the screen so it can slide: v1's spaceAndDust, split in two. The noise is worked
        out once for the strip (raw dust and haze, and v1's stars); the light's reach is applied per screen pixel when the
        strip moves on by a whole pixel (about once a second: it is the far layer). Same formula as v1, so the same sky. */
    function spaceStrip(W, H, seed, dustAmount, hazeAmount, starMul) {
        const dust = new Float32Array(W * H), haze = new Float32Array(W * H);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const i = y * W + x;
            dust[i] = Math.max(0, fbm(x / 46, y / 26, seed + 7, 4) - 0.5) * 3.4 * dustAmount;
            haze[i] = Math.max(0, fbm(x / 70, y / 38, seed, 4) - 0.5) * 1.15 * hazeAmount;
        }
        const rand = seeded(seed + 1), stars = [], count = Math.round(W * H / 200 * (starMul || 1));
        for (let i = 0; i < count; i++) stars.push({ x: Math.floor(rand() * W), y: Math.floor(rand() * H), mag: rand() });
        return { W, H, dust, haze, stars };
    }
    /** Paints the strip as seen from offset `off` into an opaque painter the size of the screen. lit(x, y): the light's reach. */
    function paintSpace(p, strip, off, lit, keepAway) {
        const dustR = RP.DUST.rgb, hazeR = RP.HAZE.rgb, ink = hexRgb(INK);
        for (let y = 0; y < p.H; y++) for (let x = 0; x < p.W; x++) {
            const sx = x + off, o = (y * p.W + x) * 4;
            let rgb = ink;
            if (sx >= 0 && sx < strip.W && y < strip.H) {
                const i = y * strip.W + sx, vd = strip.dust[i] * 2.8 * lit[y * p.W + x], vh = strip.haze[i];
                if (vd > 0.12 && vd * 0.75 > vh) rgb = dustR[level(RP.DUST, vd, x, y)];
                else if (vh > 0.03) rgb = hazeR[level(RP.HAZE, vh, x, y)];
            }
            p.data[o] = rgb[0]; p.data[o + 1] = rgb[1]; p.data[o + 2] = rgb[2]; p.data[o + 3] = 255;
        }
        const bright = [];
        strip.stars.forEach(s => {
            const x = s.x - off, y = s.y; if (x < -2 || x > p.W + 2 || (keepAway && keepAway(x, y))) return;
            if (s.mag > 0.978) { p.set(x, y, RP.STAR.rgb[4]); [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dx, dy]) => p.set(x + dx, y + dy, RP.STAR.rgb[2])); }
            else if (s.mag > 0.87) p.set(x, y, RP.STAR.rgb[3]);
            else p.set(x, y, RP.STAR.rgb[s.mag > 0.55 ? 2 : 1]);
            if (s.mag > 0.87) bright.push({ x, y, mag: s.mag });
        });
        return bright;
    }

    /** The false sun: a white-gold core, a soft dithered halo and a thin horizontal streak. */
    function lightGlow(p, lx, ly, o, breath = 1) {
        const reach = o.halo * 3.2 + o.core + 8, s = o.strength * breath;
        p.region(lx - reach, ly - reach, lx + reach, ly + reach, (x, y) => {
            const dx = x + 0.5 - lx, dy = (y + 0.5 - ly) * 1.06, d = Math.hypot(dx, dy);
            if (d < o.core) { p.tone(x, y, RP.SUN, 1.02 - 0.3 * (d / o.core) ** 3); return; }
            let v = s * (1.15 * Math.exp(-(d - o.core) / (o.core * 0.5 + 1.4)) + 0.7 * Math.exp(-d / (o.halo * 0.32 + 1)) + 0.34 * Math.exp(-d / (o.halo * 1.1 + 1)));
            if (Math.abs(dy) < 0.6) v += 0.34 * s * Math.exp(-Math.abs(dx) / (o.halo * 0.9 + 8));
            if (o.spikes && (Math.abs(dx) < 0.6 || Math.abs(dy) < 0.6)) v += 0.7 * Math.exp(-d / o.spikes);
            v *= 1 - smooth(reach * 0.55, reach, d);
            if (v > 0.004) p.add(x, y, RP.SUN, v);
        });
    }

    // ── 3. worlds (main-screens.html sphere + surfaceFor; v2's rims) ──
    /** A planet lit from L. The edge facing the light can catch a warm rim. Edge pixels go into o.rims (for the pointing highlight). */
    function sphere(p, o) {
        const L = o.L, edge = Math.max(0, 1 - 1.5 / o.r) ** 2, ramp0 = o.ramp;
        if (o.atmo) p.ellipse(o.cx, o.cy, o.r + o.atmo.w, o.r + o.atmo.w, (x, y) => {
            const nx = (x + 0.5 - o.cx) / o.r, ny = (y + 0.5 - o.cy) / o.r, d = Math.hypot(nx, ny);
            if (d < 1) return;
            const facing = (nx * L[0] + ny * L[1]) / d;
            if (facing > 0.1) p.cover(x, y, o.atmo.ramp, 0.55 * facing * (o.dim == null ? 1 : o.dim), (1 - (d - 1) * o.r / o.atmo.w) * facing);
        });
        p.ellipse(o.cx, o.cy, o.r, o.r, (x, y, q) => {
            const nx = (x + 0.5 - o.cx) / o.r, ny = (y + 0.5 - o.cy) / o.r, nz = Math.sqrt(Math.max(0, 1 - q));
            const lam = Math.max(0, (nx * L[0] + ny * L[1] + nz * L[2] + 0.06) / 1.06);                // a slightly soft dusk line
            let v = (o.ambient == null ? 0.02 : o.ambient) + Math.pow(lam, 1.1) * (o.gain || 0.92);
            if (o.surface) v = o.surface(v, nx, ny, nz, lam);
            v *= o.dim == null ? 1 : o.dim;
            const isEdge = q > edge;
            if (o.rim && isEdge && lam > 0.12) { const rv = Math.min(0.95, 0.25 + o.rim * lam) * (o.dim == null ? 1 : o.dim); p.solid(x, y, o.rimRamp || RP.SUN, rv); if (o.rims) o.rims.push([x, y, o.rimRamp || RP.SUN, level(o.rimRamp || RP.SUN, rv, x, y)]); return; }
            p.solid(x, y, ramp0, v);
            if (o.rims && isEdge && lam > 0.06) o.rims.push([x, y, ramp0, level(ramp0, v, x, y)]);
        });
    }
    /** v1's surfaces (main-screens.html): the gentle gas bands, the dunes, the cracked ice, the craters. */
    function surfaceFor(type, seed, L) {
        if (type === 'desert') return (v, nx, ny) => v * (0.8 + 0.34 * fbm(nx * 2.4 + seed, ny * 7, seed, 3)) - 0.16 * smooth(0.55, 0.68, fbm(nx * 2.2 + 9, ny * 2.2, seed + 4, 3)) * Math.min(1, v * 3);
        if (type === 'gas') return (v, nx, ny) => v * (0.68 + 0.38 * (0.5 + 0.5 * Math.sin(ny * 12 + 2.8 * fbm(nx * 1.6, ny * 5, seed, 3)))) - (Math.hypot((nx - 0.25) / 0.2, (ny - 0.32) / 0.09) < 1 ? 0.12 : 0);
        if (type === 'ice') return (v, nx, ny) => {
            let k = v * (0.84 + 0.2 * fbm(nx * 4, ny * 4, seed, 2));
            if (Math.abs(vnoise(nx * 9 + seed, ny * 9, seed) - 0.5) < 0.013) k *= 0.74;                // thin cracks
            const cap = smooth(-0.6, -0.86, ny + (fbm(nx * 5, 3, seed, 2) - 0.5) * 0.16);              // a ragged polar cap
            return k * (1 - cap) + Math.min(1, v * 1.22 + 0.03) * cap;
        };
        if (type === 'dark') return (v, nx, ny) => v * 0.62 * (0.82 + 0.36 * fbm(nx * 5, ny * 5, seed, 2));
        const rand = seeded(seed + 3), craters = Array.from({ length: 12 }, () => [(rand() - 0.5) * 1.6, (rand() - 0.5) * 1.6, 0.06 + rand() * rand() * 0.2]);
        return (v, nx, ny) => {
            let k = v - 0.18 * smooth(0.5, 0.62, fbm(nx * 2.6 + 4, ny * 2.6, seed, 3)) * Math.min(1, v * 3);
            craters.forEach(([ux, uy, ur]) => {
                const d = Math.hypot(nx - ux, ny - uy) / ur, toward = (nx - ux) * L[0] + (ny - uy) * L[1];
                if (d < 0.85) k *= toward > 0 ? 0.95 : 0.7;
                else if (d < 1.15 && toward < 0) k += 0.1 * Math.min(1, -toward / ur);
            });
            return k;
        };
    }
    const lightVector = (fx, fy, lx, ly, depth) => norm3(lx - fx, ly - fy, depth);

    /** A small station: a hub, a ring, two panel arms. Lit from the right. Returns where its one window is. */
    function drawStation(p, cx, cy, s, seed, dim = 1, ramps) {
        const HULL = (ramps && ramps.hull) || RP.HULL, PANEL = (ramps && ramps.panel) || RP.UI;
        for (const side of [-1, 1]) {
            p.region(Math.min(cx + side * 4 * s, cx + side * 26 * s), cy - 0.5 * s, Math.max(cx + side * 4 * s, cx + side * 26 * s), cy + 0.5 * s + 1, (x, y) => p.solid(x, y, HULL, 0.42 * dim));
            p.region(Math.min(cx + side * 9 * s, cx + side * 24 * s), cy - 7 * s, Math.max(cx + side * 9 * s, cx + side * 24 * s), cy + 7 * s, (x, y) => {
                if (Math.abs(y + 0.5 - cy) < 1.6 * s) return;
                const gx = (x - cx) / (2.5 * s), gy = (y - cy) / (2.2 * s), isGrid = Math.abs(gx - Math.round(gx)) < 0.12 || Math.abs(gy - Math.round(gy)) < 0.14;
                p.solid(x, y, PANEL, (isGrid ? 0.22 : 0.3 + 0.18 * (side > 0 ? 1 : 0) + 0.1 * fbm(x / 3, y / 3, seed, 2)) * dim);
            });
        }
        const ring = (front) => p.ellipse(cx, cy, 15 * s, 5 * s, (x, y, q) => {
            if (q < 0.62) return;
            const isFront = y + 0.5 > cy; if (isFront !== front) return;
            p.solid(x, y, HULL, (0.32 + 0.4 * clamp01((x - cx) / (15 * s) * 0.5 + 0.5) + (q > 0.9 ? -0.12 : 0)) * dim);
        });
        ring(false);
        p.region(cx - 3.4 * s, cy - 11 * s, cx + 3.4 * s, cy + 11 * s, (x, y) => {
            const nx = (x + 0.5 - cx) / (3.4 * s), ends = Math.abs(y + 0.5 - cy) / (11 * s);
            if (ends > 0.9 && Math.abs(nx) > 0.6) return;
            p.solid(x, y, HULL, (0.3 + 0.42 * (nx * 0.5 + 0.5) + (Math.abs((y - cy) % (4 * s)) < 0.6 ? -0.15 : 0)) * dim);
        });
        ring(true);
        return [Math.round(cx + 1.2 * s), Math.round(cy - 4 * s)];
    }
    /** A faint contact: a soft dithered smudge of cold light that brightens and fades in slow steps. No ring, no reticle. */
    function contactBlip(f, x, y, t, strong) {
        const step = Math.floor(t / (TICK * 3)) % 8, swell = [0, 0.15, 0.3, 0.42, 0.42, 0.3, 0.15, 0.05][step];
        f.glow(x, y, 5, RP.ICE, (strong ? 0.62 : 0.34) + swell * 0.4);
        f.tone(x, y, RP.ICE, (strong ? 0.95 : 0.62) + swell * 0.3);
    }

    // ── 4. the pixel font (v2): numbers on hulls, names cast into a plate, pencil marks on a drawing ──
    const FONT = {
        A: '010/101/111/101/101', B: '110/101/110/101/110', C: '011/100/100/100/011', D: '110/101/101/101/110', E: '111/100/110/100/111',
        F: '111/100/110/100/100', G: '011/100/101/101/011', H: '101/101/111/101/101', I: '111/010/010/010/111', J: '001/001/001/101/010',
        K: '101/101/110/101/101', L: '100/100/100/100/111', M: '10001/11011/10101/10001/10001', N: '1001/1101/1011/1001/1001', O: '010/101/101/101/010',
        P: '110/101/110/100/100', Q: '010/101/101/110/011', R: '110/101/110/101/101', S: '011/100/010/001/110', T: '111/010/010/010/010',
        U: '101/101/101/101/111', V: '101/101/101/101/010', W: '10001/10001/10101/11011/10001', X: '101/101/010/101/101', Y: '101/101/010/010/010',
        Z: '111/001/010/100/111', 0: '111/101/101/101/111', 1: '010/110/010/010/111', 2: '111/001/111/100/111', 3: '111/001/111/001/111',
        4: '101/101/111/001/001', 5: '111/100/111/001/111', 6: '111/100/111/101/111', 7: '111/001/001/001/001', 8: '111/101/111/101/111',
        9: '111/101/111/001/111', '.': '0/0/0/0/1', ',': '00/00/00/01/10', '·': '0/0/1/0/0', '-': '000/000/111/000/000', ':': '0/1/0/1/0',
        "'": '1/1/0/0/0', '?': '111/001/010/000/010', ' ': '00/00/00/00/00',
    };
    const glyphRows = ch => (FONT[ch] || FONT[String(ch).toUpperCase()] || FONT[' ']).split('/');
    function pixelTextWidth(str, gap = 1) { const s = [...String(str)]; return s.reduce((w, ch) => w + glyphRows(ch)[0].length, 0) + Math.max(0, s.length - 1) * gap; }
    function pixelText(str, x, y, cell, gap = 1) {
        let cx = 0;
        [...String(str)].forEach(ch => { const rows = glyphRows(ch); rows.forEach((row, r) => { for (let c = 0; c < row.length; c++) if (row[c] === '1') cell(x + cx + c, y + r); }); cx += rows[0].length + gap; });
    }

    // ── 5. the Lander (ship-study.html hull B), re-proportioned to the living ship ──
    // u runs nose (0) to the end of the bell (1). The living ship, in rows: nose cone 34..454, six decks 454..1702,
    // skirt 1702..1852, bell 1852..1972 (1938 rows). Width 600: a third of the hull without the bell.
    const LANDER = { NOSE: 0.215, SKIRT: 0.86, BELL: 0.94, ROWS: 1938, WIDTH: 600, TIP: 34 };
    const DECK_U = i => LANDER.NOSE + i * (LANDER.SKIRT - LANDER.NOSE) / 6;          // the top of deck i (0 bridge .. 5 engineering)
    function radiusL(u) {
        if (u < 0 || u > 1) return -1;
        if (u < LANDER.NOSE) { const t = u / LANDER.NOSE; return 0.5 * (0.05 + 0.95 * Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t)))); }   // the living ship's nose cone
        if (u < LANDER.SKIRT) return 0.5;
        if (u < LANDER.BELL) { const k = (u - LANDER.SKIRT) / (LANDER.BELL - LANDER.SKIRT); return 0.5 + 0.077 * smooth(0.47, 1, k); }   // the skirt flares over the engine
        const k = (u - LANDER.BELL) / (1 - LANDER.BELL);
        return 0.5 * (26 + 52 * Math.pow(k, 1.15)) / 300;                                     // the bell
    }
    /** A round body lit from above: bright rim along the top, dark underneath. (ship-study.html) */
    const cyl = (v, top, bottom, ht) => 0.7 - 0.42 * ((v - (top + bottom) / 2) / ((bottom - top) / 2)) + ((v - top) * ht < 1.4 ? 0.22 : 0);
    function shapeL(u, v, o) {
        const r = radiusL(u);
        if (r < 0) return -1;
        const av = Math.abs(v), pu = u * o.len, pv = v * o.ht, big = o.len > 60;
        if (av > r) {                                                                       // the landing legs, folded along the skirt
            if (!big || u < 0.7 || u > 0.97) return -1;
            const d = av * o.ht - 0.5 * o.ht, k = clamp01((u - LANDER.SKIRT) / 0.104), c = Math.max(1.2, (12.5 + 52 * k) / 600 * o.ht), w = Math.max(0.8, 2.6 / 600 * o.ht);
            if (Math.abs(d - c) < w) return v < 0 ? 0.64 : 0.3;
            if (u > 0.955 && d > c - 2 * w && d < c + 3 * w) return v < 0 ? 0.7 : 0.24;     // the pad
            return -1;
        }
        if (u >= LANDER.BELL) return 0.22 + 0.32 * (1 - (v + r) / (2 * r)) + (big && Math.abs((u - LANDER.BELL) * o.len % 5) < 0.6 ? 0.08 : 0);
        let l = cyl(v, -r, r, o.ht) - (u > LANDER.SKIRT ? 0.12 : 0);
        if (u < 0.006) l = 0.5;
        if (!big) {
            if (o.len > 30 && [1, 2, 3, 4, 5].some(i => Math.abs(pu - DECK_U(i) * o.len) < 0.5)) l -= 0.1;
            if (o.len > 30 && Math.abs(pu - LANDER.NOSE * o.len) < 0.6) l -= 0.22;                   // the nose cone's seam: reads as a nose even at lane size
            else if (u < LANDER.NOSE) l += 0.06;                                                        // the cone catches a little more light than the decks
            return l;
        }
        for (let i = 0; i <= 6; i++) if (Math.abs(pu - DECK_U(i) * o.len) < 0.6) l -= 0.18;                // a seam at every deck
        if (o.len > 300) {                                                                                 // seen close (the turn into the ship view): plating, not a smooth tube
            const pw = Math.max(6, o.ht / 9), ph = (LANDER.SKIRT - LANDER.NOSE) * o.len / 18;
            if (Math.abs(((pv / pw) % 1 + 1) % 1 - 0.5) > 0.47 || Math.abs(((pu / ph) % 1 + 1) % 1 - 0.5) > 0.485) l -= 0.07;
            l += (fbm(pu / 60, pv / 40, 11, 3) - 0.5) * 0.14 + (vnoise(pu / 7, pv / 5, 12) - 0.5) * 0.04;
        }
        if (u > LANDER.SKIRT && pu % 4 < 1) l -= 0.1;                                                      // ribs on the skirt
        if (u > LANDER.NOSE && u < LANDER.SKIRT && Math.abs(pv + 0.22 * o.ht) < 0.5) l -= 0.12;
        if (u > LANDER.NOSE - 0.03 && u < LANDER.NOSE - 0.008 && [-0.3, -0.05, 0.2].some(k => Math.abs(v - k) * o.ht < Math.max(1.3, o.ht * 0.04))) return 0.1;   // the bridge's ring of windows
        if (o.len < 300) for (let i = 1; i < 6; i++) { const cu = DECK_U(i) + 0.054; if (Math.hypot((u - cu) * o.len, pv + 0.32 * o.ht) < 1.6) return 0.24; }   // a porthole per deck (dark glass; lit from inside when someone is on that deck)
        const h0 = DECK_U(4) + 0.02, h1 = DECK_U(4) + 0.07;                                                 // the hold's hatch
        if (u > h0 && u < h1 && v > -0.08 && v < 0.3) { const edge = Math.min((u - h0) * o.len, (h1 - u) * o.len, (v + 0.08) * o.ht, (0.3 - v) * o.ht); if (edge < 1) return l - 0.24; }
        return l;
    }
    shapeL.span = 0.8;

    /** hull() from ship-study.html: a shape turned into pixels, with breaks, rust, holes and a warm rim where the light hits.
        o: { x, y, len, ht, angle, flip (nose right at angle 0), anchor, from, to, ramp, light, rust, holes, seed, sun, sunDir,
        fade, mirror (rolled over: the lit side swaps) }. Paints only the box the hull covers. Returns at(u, v). */
    function hull(p, o, shape) {
        const c = Math.cos(o.angle || 0), s = Math.sin(o.angle || 0), dir = o.flip ? -1 : 1, seed = o.seed || 1, mir = o.mirror ? -1 : 1;
        const from = o.from || 0, to = o.to == null ? 1 : o.to, anchor = o.anchor == null ? (from + to) / 2 : o.anchor, dim = o.light == null ? 1 : o.light;
        const at = (u, v) => { const a = (u - anchor) * o.len * dir, b = v * mir * o.ht; return [o.x + a * c - b * s, o.y + a * s + b * c]; };
        const uvOf = (x, y) => { const dx = x + 0.5 - o.x, dy = y + 0.5 - o.y; return [anchor + (dx * c + dy * s) * dir / o.len, mir * (-dx * s + dy * c) / o.ht]; };
        const span = (shape.span || 0.8) + 3 / o.ht;
        const corners = [[from, -span], [from, span], [to, -span], [to, span]].map(([u, v]) => at(u, v));
        const x0 = Math.min(...corners.map(q => q[0])) - 2, x1 = Math.max(...corners.map(q => q[0])) + 2, y0 = Math.min(...corners.map(q => q[1])) - 2, y1 = Math.max(...corners.map(q => q[1])) + 2;
        const [sx, sy] = o.sunDir ? [o.sunDir[0] * 1.5, o.sunDir[1] * 1.5] : [0, 0];
        p.region(x0, y0, x1, y1, (x, y) => {
            const [u, v] = uvOf(x, y), jag = (vnoise(v * 6, u * 4, seed) - 0.5) * 0.07;
            if ((from > 0 && u < from + jag) || (to < 1 && u > to + jag)) return;
            let light = shape(u, v, o);
            if (light < 0) return;
            const pu = u * o.len, pv = v * o.ht;
            if (o.rust) light -= (fbm(pu / 9, pv / 6, seed, 3) - 0.45) * 0.5;
            if (o.holes && fbm(pu / 16, pv / 10, seed + 3, 3) > o.holes) light = pu % 6 < 1.2 ? 0.3 : 0.05;
            if ((from > 0 && u < from + jag + 0.02) || (to < 1 && u > to + jag - 0.02)) light *= 0.45;
            if (o.fade) light *= 1 - o.fade * clamp01(u);                                                      // lit from ahead: the tail is in shadow
            if (o.sun) { const [u2, v2] = uvOf(x + sx, y + sy); if (shape(u2, v2, o) < 0 && threshold(x, y) < o.sun) { p.solid(x, y, RP.SUN, 0.5 + 0.35 * o.sun); return; } }
            if (o.flat) { const top = (o.ramp || RP.HULL).hex.length - 1; light = Math.round(clamp01(light * dim) * top) / top; p.solid(x, y, o.ramp || RP.HULL, light); return; }   // small: clean bands, no dither noise
            p.solid(x, y, o.ramp || RP.HULL, light * dim);
        });
        return at;
    }
    /** Stencil letters along the hull, each pixel placed through at(), so the name turns with the ship. */
    function hullName(p, at, o, str, uc, vc) {
        const w = pixelTextWidth(str);
        pixelText(str, 0, 0, (gx, gy) => { const [x, y] = at(uc + (w / 2 - gx - 0.5) / o.len, vc + (gy - 2) / o.ht); p.solid(x, y, RP.HULL, 0.24); });
    }

    // ── 6. the enormous things (v2 paintGiant / paintRogue, geometry passed in) ──
    const GIANT = { tilt: 0.38, open: 0.24, r0: 1.46, r1: 1.7, storm: [0.3, -0.86] };
    /** Kryos-68 Prime. g: { cx, cy, R, L } in the painter's own pixels. Its face lit from the front, rust and gold belts, one
        storm; the ring goes behind it and passes in front, backlit; broken hulls (Landers) caught in the ring. */
    function paintGiant(p, g) {
        const { cx, cy, R, L } = g, tilt = g.tilt == null ? GIANT.tilt : g.tilt, open = g.open == null ? GIANT.open : g.open;
        const ct = Math.cos(tilt), sn = Math.sin(tilt), rims = [];
        const ringV = rho => {
            const k = (rho - GIANT.r0) / (GIANT.r1 - GIANT.r0);
            let v = 0.2 + 0.36 * smooth(0, 0.14, k) * (1 - smooth(0.8, 1, k));
            if (k > 0.56 && k < 0.63) v *= 0.15;                                                 // the gap
            if (k < 0.2) v *= 0.55;
            return v * (0.75 + 0.4 * vnoise(rho * 90, 3.3, 9));
        };
        const edge = R - 1.6, stormLat = -GIANT.storm[0] * sn + GIANT.storm[1] * ct, stormLon = GIANT.storm[0] * ct + GIANT.storm[1] * sn;
        const b = open, ax = [ct, sn, 0], mz = [-sn * b, ct * b, Math.sqrt(1 - b * b)];
        const nrm = [ax[1] * mz[2] - ax[2] * mz[1], ax[2] * mz[0] - ax[0] * mz[2], ax[0] * mz[1] - ax[1] * mz[0]], nL = nrm[0] * L[0] + nrm[1] * L[1] + nrm[2] * L[2];
        const ringShadow = (px, py, pz) => {
            if (Math.abs(nL) < 1e-4) return 0;
            const tt = -(nrm[0] * px + nrm[1] * py + nrm[2] * pz) / nL; if (tt <= 0) return 0;
            const rho = Math.hypot(px + L[0] * tt, py + L[1] * tt, pz + L[2] * tt) / R;
            return rho > GIANT.r0 && rho < GIANT.r1 ? Math.min(0.85, ringV(rho) * 2.2) : 0;
        };
        const ringPixel = (x, y, rho, shade) => {
            if (hash(x, y, 31) > 0.988 && hash(x + 7, y, 2) > 0.5) { p.solid(x, y, RP.HULL, 0.3 + 0.25 * hash(x, y, 4)); return; }   // a glint of old hull, one pixel
            const clump = fbm((x - cx) / 9 * (240 / R) + 40, (y - cy) / 5 * (240 / R) + 40, 69, 3);   // scaled with the giant, so a push-in keeps the same clumps
            const lit = 0.7 + 0.45 * clamp01(((x - cx) * L[0] + (y - cy) * L[1]) / (R * 1.7) * 0.5 + 0.5);   // lit from the light's side, like the body
            p.cover(x, y, RP.RING, ringV(rho) * shade * lit * (0.85 + 0.3 * clump), 0.5 + 0.4 * clump);
        };
        const reach = R * GIANT.r1 + 4;
        p.region(cx - reach, cy - reach, cx + reach, cy + reach, (x, y) => {
            const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy);
            const u = dx * ct + dy * sn, w = -dx * sn + dy * ct, rho = Math.hypot(u, w / open) / R;
            const isRing = rho > GIANT.r0 && rho < GIANT.r1;
            if (d < R) {
                if (isRing && w > 0) { ringPixel(x, y, rho, 0.55); return; }
                const nx = dx / R, ny = dy / R, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
                const lam = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
                const lat = -nx * sn + ny * ct, lon = nx * ct + ny * sn;
                const band = 0.5 + 0.5 * Math.sin(lat * 21 + 4.4 * fbm(lon * 2.4 + 7, lat * 9, 68, 4));
                const fine = 0.5 + 0.5 * Math.sin(lat * 74 + 7 * fbm(lon * 5 + 2, lat * 24, 67, 3));
                const tone = 0.64 * band + 0.36 * fine;
                const sd = Math.hypot((lon - stormLon) / 0.12, (lat - stormLat) / 0.05);
                const storm = sd < 1 ? -0.34 * (1 - sd * sd) : sd < 1.45 ? 0.24 * (1 - (sd - 1) / 0.45) : 0;
                const shadow = lam > 0 ? ringShadow(nx * R, ny * R, nz * R) : 0;
                const v = 0.03 + 0.06 * tone + Math.pow(lam, 0.62) * (0.16 + 1.05 * tone + storm) * (1 - shadow);
                if (d > edge && lam > 0.05) { const rv = Math.min(0.92, 0.32 + 1.4 * lam); p.solid(x, y, RP.SUN, rv); rims.push([x, y, RP.SUN, level(RP.SUN, rv, x, y)]); return; }
                p.solid(x, y, RP.GAS, v);
                if (d > edge - 1 && lam > 0.02) rims.push([x, y, RP.GAS, level(RP.GAS, v, x, y)]);
                return;
            }
            if (isRing) { ringPixel(x, y, rho, 1); return; }
            if (d < R + 6 * R / 240) { const facing = (dx * L[0] + dy * L[1]) / d; if (facing > 0.25) p.cover(x, y, RP.DUST, 0.6 * facing, (1 - (d - R) / (6 * R / 240)) * facing); }
        });
        const rand = seeded(68);                                                                     // the graveyard: broken Landers caught in the ring
        for (let i = 0; i < 16; i++) {
            const rho = lerp(GIANT.r0 + 0.08, GIANT.r1 - 0.05, rand()), phi = Math.PI + (rand() - 0.5) * 0.5;
            const uu = rho * R * Math.cos(phi), ww = rho * R * open * Math.sin(phi) * (rand() < 0.5 ? 1 : -1);
            const x = cx + uu * ct - ww * sn, y = cy + uu * sn + ww * ct;
            const len = (5 + rand() * rand() * 9) * R / 240, ang = tilt + (rand() - 0.5) * 1.4, flip = rand() < 0.5, from = rand() < 0.5 ? 0.2 + rand() * 0.3 : 0, to = rand() < 0.4 ? 0.6 + rand() * 0.3 : 1;
            if (Math.hypot(x - cx, y - cy) < R + 6) continue;
            hull(p, { x, y, len, ht: len / 3, angle: ang, flip, light: 0.5, rust: true, ramp: RP.RUST, seed: i + 70, from, to }, shapeL);
        }
        return { rims };
    }
    /** Sector 2's rogue world: a disc of pure black where the stars stop; a thin ice edge on the side facing the light. */
    function paintRogue(p, g) {
        const { cx, cy, R, L } = g, ink = hexRgb(INK);
        p.region(cx - R - 3, cy - R - 3, cx + R + 3, cy + R + 3, (x, y) => {
            const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy);
            if (d > R + 2) return;
            const facing = (dx * L[0] + dy * L[1]) / d;
            if (d > R) { if (facing > 0.55) p.cover(x, y, RP.ICE, 0.3 * facing, 0.5 * (R + 2 - d) / 2); return; }
            if (d > R - 1.2 && facing > 0.35) { p.solid(x, y, RP.ICE, 0.35 + 0.55 * facing); return; }
            if (d > R - 2.6 && facing > 0.6) { p.solid(x, y, RP.ICE, 0.18 + 0.2 * facing); return; }
            p.set(x, y, ink);
        });
    }

    // ── 7. the film: EXODUS-4 at dusk, a Lander standing where it came down (ship-study.html wreckPicture + wreckB) ──
    function duskLand(p, horizon, glowAt, seed) {
        p.region(0, 0, p.W, horizon, (x, y) => p.tone(x, y, RP.DUSK, 0.05 + 0.72 * Math.pow(y / horizon, 2.4) + 0.3 * Math.exp(-Math.hypot(x - glowAt, (y - horizon) * 3) / 56)));
        const stars = scatterStars(p, seed, 190, (x, y) => y < horizon * 0.5);
        p.region(0, horizon - 14, p.W, horizon + 1, (x, y) => { if (y > horizon - 3 - 11 * fbm(x / 36, 0, seed, 3) * smooth(0, 40, Math.abs(x - glowAt))) p.tone(x, y, RP.DUSK, 0.16); });
        p.region(0, horizon, p.W, p.H, (x, y) => p.tone(x, y, RP.GROUND, 0.12 + 0.36 * Math.exp(-(y - horizon) / 10) + (fbm(x / 5, y / 2.5, seed + 1, 3) - 0.5) * 0.24));
        p.ellipse(242, 24, 9, 9, (x, y) => { const nx = (x + 0.5 - 242) / 9, ny = (y + 0.5 - 24) / 9; p.tone(x, y, RP.MOON, clamp01(-nx * 0.8 + ny * 0.3 + 0.2) * 1.1); });
        return stars;
    }
    const mound = (p, cx, cy, rx, ry, seed) => p.ellipse(cx, cy, rx, ry, (x, y) => p.tone(x, y, RP.GROUND, 0.42 - (y - (cy - ry)) / (ry * 3.4) + (fbm(x / 4, y / 2.5, seed, 2) - 0.5) * 0.3));
    const beam = (p, x0, y0, x1, y1, r, v, w = 1) => p.line(x0, y0, x1, y1, (x, y) => p.region(x, y, x + w, y + 1, (a, b) => p.tone(a, b, r, a === x ? v : v * 0.6)));
    function wreckLander(p) {
        const WRECK = { ramp: RP.WRUST, rust: true, seed: 3, light: 0.8 };
        [[206, 97, 22, 0.06], [248, 96, 15, -0.36], [176, 97, 11, 0.14]].forEach(([x, y, len, lean], i) =>                // others, on the horizon
            hull(p, { x, y, len, ht: len / 3, angle: -Math.PI / 2 + lean, flip: true, anchor: 1, light: 0.4 - i * 0.05, ramp: RP.WRUST, seed: i + 20 }, shapeL));
        const o = Object.assign({}, WRECK, { x: 86, y: 121, len: 104, ht: 34, angle: -Math.PI / 2 + 0.16, flip: true, anchor: 1, holes: 0.74, seed: 5 });
        const at = hull(p, o, shapeL);
        const [lx, ly] = at(0.9, -0.6), [rx, ry] = at(0.9, 0.6);
        beam(p, lx, ly, lx - 15, 122, RP.WRUST, 0.55, 2);                                       // one leg still planted
        p.region(lx - 19, 122, lx - 10, 124, (x, y) => p.tone(x, y, RP.WRUST, 0.45));
        beam(p, rx, ry, rx + 9, ry + 6, RP.WRUST, 0.45, 2); beam(p, rx + 9, ry + 6, rx + 13, 123, RP.WRUST, 0.38, 2);   // the other one buckled
        const [hx, hy] = at(DECK_U(4) + 0.045, -0.55);
        beam(p, hx, hy, hx - 24, 121, RP.WRUST, 0.62, 2);                                       // the ramp, still down
        mound(p, 86, 126, 34, 8, 5);
        const [nx, ny] = at(0, 0);
        p.line(nx, ny, nx, ny - 4, (x, y) => p.tone(x, y, RP.HULL, 0.55));
        return { light: [Math.round(nx), Math.round(ny - 5)] };
    }
    const FILM_W = 288, FILM_H = 144;
    let filmCache = null;
    function filmPicture() {
        if (filmCache) return filmCache;
        const p = painter(FILM_W, FILM_H, true), stars = duskLand(p, 96, 64, 61), state = wreckLander(p);
        filmCache = Object.assign({ canvas: p.canvas(), stars: keepVisible(p, stars) }, state);
        return filmCache;
    }
    function filmFrame(ctx, t) {
        const s = filmPicture(), f = framer(ctx, FILM_W, FILM_H);
        ctx.drawImage(s.canvas, 0, 0);
        twinkle(f, s.stars, t);
        const [x, y] = s.light;
        if (t % 1500 < 380) { f.glow(x, y, 6, RP.RED, 0.9); f.px(x - 1, y - 1, RP.RED.hex[4], 2, 2); } else f.px(x, y, RP.RED.hex[2]);
        for (let i = 0; i < 10; i++) {                                                             // dust low over the ground
            const v = 6 * (0.5 + hash(i, 1, 13)), xx = (hash(i, 2, 13) * FILM_W + t / 1000 * v) % FILM_W;
            f.tone(xx, 104 + hash(i, 3, 13) * 38 + Math.sin(t / 1300 + i) * 2, RP.GROUND, 0.45 + hash(i, 4, 13) * 0.4, hash(i, 5, 13) > 0.5 ? 2 : 1, 1);
        }
    }

    window.V3Paint = {
        INK, TICK, BAYER_RAW, threshold, clamp01, smooth, lerp, seeded, hash, vnoise, fbm, hexRgb, ramp, level, norm3, RP, PLANET_RAMP,
        painter, framer, pixelLayer, scatterStars, keepVisible, twinkle, spaceStrip, paintSpace, lightGlow,
        sphere, surfaceFor, lightVector, drawStation, contactBlip, pixelText, pixelTextWidth,
        LANDER, DECK_U, radiusL, shapeL, cyl, hull, hullName, GIANT, paintGiant, paintRogue, FILM_W, FILM_H, filmFrame, filmPicture,
    };
})();
