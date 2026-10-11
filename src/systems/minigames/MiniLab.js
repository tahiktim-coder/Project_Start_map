/* MiniLab — the shared drawing kit for the minigames (first a port of prototypes/sim-bay/lab.js; 2026-10-11 moved to the
   travel view's look: the Deep field world, 8 × 8 Bayer dither, the false sun warmest, people warm, everything else cold).

   PICTURE UNITS. Every minigame thinks in one 480 × 270 picture (MiniLab.W × MiniLab.H): its gameplay, hit tests and
   ui.toPixel() stay in these units. How many ART PIXELS stand behind one unit is the minigame's density (MiniHost.register
   { density }): 1 (the old chunky look, the default), 1.5 (720 × 405 art pixels: one art pixel is two screen pixels in a
   1080p window, as in the travel view — the recommended one), 2 or 3. MiniHost hands mount() a context already scaled by
   the density, so code that draws in units still lands in the right place; the helpers below snap to the art grid and
   dither per art pixel, so they come out crisp and fine at any density. Plain ctx.fillRect(x, y, 1, 1) in units is NOT
   snapped (at 1.5 it blurs): use MiniLab.dot / px, or paint in art pixels (inArt, blit, MiniLab.paint).

   Colours: MiniLab.C holds ROLES (void, ui, warm, light …), not fixed hues; MiniLab.RP holds the travel view's ramps
   (MiniPaint.RP: STAR HAZE DUST SUN HULL UI ICE STONE DESERT GAS DARK AMBER RED RING RUST PLUME PASSED WRUST DUSK GROUND MOON).
   The rule (docs/ART_STYLE.md): the universe is cold; only people and the lie are warm; the false sun is the warmest thing.

   Loops, keys and sound belong to the minigame on screen: MiniHost calls _open() before mount and _close() on finish,
   which stops every MiniLab.loop, forgets keys and key listeners, and silences every sound.

   NEW (2026-10-11), on top of the old API (all of it kept):
     MiniLab.paint                the travel view's recipes (window.MiniPaint, a copy of NSPaint): painter, sphere, hull …
     MiniLab.RP                   its ramps;  MiniLab.ramp(name) → the ramp's hex array (for pick())
     MiniLab.density              the open minigame's art pixels per unit;  MiniLab.art → { w, h, d }
     MiniLab.px(ctx, x, y, col)   one ART pixel at a picture-unit position (stars, sparks, fine lines)
     MiniLab.inArt(ctx, fn)       run fn(ctx, d) with ctx in art pixels (identity scale, the game's translation kept)
     MiniLab.blit(ctx, cv, ax, ay) draw an art-pixel canvas 1:1 at art pixel (ax, ay)
     MiniLab.toArt(v)             units → art pixels (rounded);  MiniLab.bayer8(x, y) the 8 × 8 threshold
     MiniLab.label(ctx, str, x, y, color, align)   small quiet pixel words (the travel view's font, one art pixel per cell)
     MiniLab.labelWidth(str)      in units */

(function () {
    'use strict';

    /** The art files this kit draws with (art/: MiniPaint, MiniPeople, MiniCrew), written into the page right after this
        script while the page is still being read, so every page that loads MiniLab.js gets them without tags of its own.
        Bump ART_VERSION (and this file's ?v=) when one of them changes. */
    const ART_VERSION = 1;
    (function loadArt() {
        const me = document.currentScript;
        if (!me || !me.src || document.readyState !== 'loading') return;
        const base = me.src.replace(/MiniLab\.js(\?.*)?$/, 'art/');
        const want = [['MiniPaint', 'MiniPaint.js'], ['MiniCrewEngine', 'MiniPeople.js'], ['MiniCrew', 'MiniCrew.js']].filter(([name]) => !window[name]);
        if (want.length) document.write(want.map(([, file]) => '<script src="' + base + file + '?v=' + ART_VERSION + '"></script>').join(''));
    })();

    /** The palette every minigame uses: 'exodus' is the travel view's (Deep field world, Graphite words). The older
        moods stay here so the set can still switch in one line ('lonely', 'dusk', 'deepfield', 'narrowband', 'graphite',
        'record', 'polar', 'inkbone' or 'phosphor'). */
    const GAME_PALETTE = 'exodus';

    const W = 480, H = 270;
    const MASTER_VOLUME = 0.55, SILENCE_MS = 200;
    const DENSITIES = [1, 1.5, 2, 3];

    // ── palettes: the same roles, many moods ──
    const PALETTES = {
        exodus: {
            name: 'Exodus (the travel view)', note: 'Deep field: teal-black space, rust and gold dust, pale ice instruments; amber only for people and lamps; the false sun warmest. Words in Graphite.',
            void: '#05070a', deep: '#0a1317', dusk: '#0f222a', haze: '#152f38', mist: '#1f3a43',
            line: '#142329', line2: '#284650', text: '#e4e4e0', textDim: '#8b8d90', star: '#f6f1e4',
            ui: '#9fd8e6', uiBright: '#e1f6fb', uiDim: '#3d6670',
            warm: '#e8964a', warmBright: '#f7c483', light: '#fff3dc', lightHalo: '#e9a25e',
            danger: '#e2574c', anomaly: '#b98bd6', nebA: '#2c1a10', nebB: '#0f222a',
            hull: ['#05070a', '#121c22', '#22333b', '#3d5560', '#8aa2aa', '#e6eef0'],
            hurt: ['#05070a', '#1d0d0c', '#3a1714', '#6e2a22', '#e2574c', '#ffd2c8'],
        },
        lonely: {
            name: 'Lonely blue', note: 'Cold indigo space, cyan instruments, amber only for people, a rose-gold false sun.',
            void: '#05060d', deep: '#0a0d1c', dusk: '#141a33', haze: '#253058', mist: '#3e4c80',
            line: '#1a2140', line2: '#303d6b', text: '#d6dcef', textDim: '#7d86a8', star: '#eef2ff',
            ui: '#5fd0d6', uiBright: '#b5f1f0', uiDim: '#275a68',
            warm: '#f0a65a', warmBright: '#ffd9a0', light: '#fff0c8', lightHalo: '#f2b48a',
            danger: '#ef6a5a', anomaly: '#a77ce0', nebA: '#1b1f45', nebB: '#3a2346',
            hull: ['#05060d', '#121831', '#232c4f', '#3d4a73', '#7f8db3', '#dfe6f7'],
            hurt: ['#05060d', '#1d0c12', '#3b1520', '#6e2430', '#ef6a5a', '#ffd0c8'],
        },
        dusk: {
            name: 'Nebula dusk', note: 'Violet-black space, sea-foam instruments, dusty rose nebulae, a coral-gold false sun.',
            void: '#0a0610', deep: '#140c1c', dusk: '#221530', haze: '#3b2547', mist: '#5e3d63',
            line: '#24172f', line2: '#42294f', text: '#f0e1dc', textDim: '#a08a96', star: '#fff5ee',
            ui: '#6fd6c0', uiBright: '#c4f5e8', uiDim: '#2c5f58',
            warm: '#f2a65e', warmBright: '#ffe0b0', light: '#fff2d6', lightHalo: '#f5a8a0',
            danger: '#ff6b6b', anomaly: '#c78bff', nebA: '#2a1840', nebB: '#4a1f3a',
            hull: ['#0a0610', '#1d1428', '#33243f', '#57425f', '#a08aa0', '#f4e6e8'],
            hurt: ['#0a0610', '#200a12', '#40121e', '#72202c', '#ff6b6b', '#ffd6d6'],
        },
        deepfield: {
            name: 'Deep field', note: 'From the James Webb images: rust and gold dust against teal-black, pale ice instruments. Warm only where people are.',
            void: '#06090c', deep: '#0b1418', dusk: '#13232a', haze: '#1f3a43', mist: '#35606b',
            line: '#142329', line2: '#284650', text: '#e8e2d4', textDim: '#8c9590', star: '#f6f1e4',
            ui: '#9fd8e6', uiBright: '#e1f6fb', uiDim: '#3d6670',
            warm: '#e8964a', warmBright: '#f7c483', light: '#fff3dc', lightHalo: '#e9a25e',
            danger: '#e2574c', anomaly: '#b98bd6', nebA: '#3a2416', nebB: '#10303a',
            hull: ['#06090c', '#121c22', '#22333b', '#3d5560', '#8aa2aa', '#e6eef0'],
            hurt: ['#06090c', '#1d0d0c', '#3a1714', '#6e2a22', '#e2574c', '#ffd2c8'],
        },
        narrowband: {
            name: 'Narrowband', note: 'The Hubble filter palette: oxygen teal, sulphur gold, a trace of hydrogen magenta on warm black.',
            void: '#070807', deep: '#0d0f0c', dusk: '#171b17', haze: '#26302b', mist: '#3f4f46',
            line: '#182019', line2: '#2c3a32', text: '#ece6d6', textDim: '#8d8f84', star: '#fffbea',
            ui: '#4fb6a5', uiBright: '#a8e8dc', uiDim: '#23574f',
            warm: '#e3b04b', warmBright: '#f6d98a', light: '#fff4d0', lightHalo: '#eab95a',
            danger: '#d9624a', anomaly: '#c06aa0', nebA: '#1d3a34', nebB: '#3b2e12',
            hull: ['#070807', '#141813', '#252b24', '#404a3f', '#8e9a8a', '#e8eee4'],
            hurt: ['#070807', '#1c0d0a', '#391812', '#6a2a1e', '#d9624a', '#ffd6c8'],
        },
        graphite: {
            name: 'Graphite & sodium', note: 'Moon and 2001: almost colourless steel and grey, sodium-orange lamps, one red. The loneliest.',
            void: '#0a0a0b', deep: '#111214', dusk: '#1a1c20', haze: '#2a2d33', mist: '#44484f',
            line: '#1d1f23', line2: '#33373e', text: '#e4e4e0', textDim: '#8b8d90', star: '#f2f2ee',
            ui: '#c9d1d6', uiBright: '#ffffff', uiDim: '#5a6168',
            warm: '#f08c2e', warmBright: '#ffc27a', light: '#fff6e6', lightHalo: '#f2b06a',
            danger: '#e0453a', anomaly: '#8f8fc7', nebA: '#1c1e24', nebB: '#24201c',
            hull: ['#0a0a0b', '#17181b', '#2a2c31', '#474b52', '#9a9ea5', '#f0f1f2'],
            hurt: ['#0a0a0b', '#1e0c0b', '#3c1512', '#70241e', '#e0453a', '#ffd0ca'],
        },
        record: {
            name: 'Golden record', note: 'The disc itself: brass, tarnished gold and paper on warm black, pale sage instruments. Nostalgic and sad.',
            void: '#0b0906', deep: '#14100b', dusk: '#201912', haze: '#33281c', mist: '#52412c',
            line: '#221a12', line2: '#3c2f20', text: '#efe3c8', textDim: '#9a8a6c', star: '#fff3d6',
            ui: '#a9c4a0', uiBright: '#dcefd2', uiDim: '#4b6046',
            warm: '#e0a03c', warmBright: '#f6cf7d', light: '#fff1c4', lightHalo: '#d9a640',
            danger: '#c8553d', anomaly: '#8d7bb5', nebA: '#2a1f14', nebB: '#1a2422',
            hull: ['#0b0906', '#1a140d', '#2e2418', '#4d3d29', '#a08a66', '#f2e6cc'],
            hurt: ['#0b0906', '#1d0c08', '#3a1610', '#6a2a1c', '#c8553d', '#ffd2c2'],
        },
        polar: {
            name: 'Polar night', note: 'Blue-grey dark with thin aurora mint and lilac, snow-white text, warm windows. Cold but not empty.',
            void: '#070a10', deep: '#0d121b', dusk: '#172030', haze: '#26344a', mist: '#40546f',
            line: '#18202e', line2: '#2c3b52', text: '#e9edf2', textDim: '#8a96a8', star: '#f4f8ff',
            ui: '#9ae6c4', uiBright: '#d4fbe9', uiDim: '#3b6b5b',
            warm: '#f2a65a', warmBright: '#ffd6a3', light: '#fff2d8', lightHalo: '#f5b98c',
            danger: '#ff6b5e', anomaly: '#c3a4f0', nebA: '#13314a', nebB: '#2f2448',
            hull: ['#070a10', '#121a26', '#22304a', '#3d5170', '#8a9fbe', '#e4ecf7'],
            hurt: ['#070a10', '#1d0c10', '#3b161c', '#6e2630', '#ff6b5e', '#ffd2cc'],
        },
        inkbone: {
            name: 'Ink & bone', note: 'Nearly monochrome: blue-black ink and bone white. Colour is almost absent, so people and the false sun are all that glows.',
            void: '#08090b', deep: '#0f1114', dusk: '#181b20', haze: '#252a31', mist: '#3a414b',
            line: '#1a1e23', line2: '#2e343c', text: '#ebe5d8', textDim: '#8e8a82', star: '#f3eee2',
            ui: '#ebe5d8', uiBright: '#ffffff', uiDim: '#6b675f',
            warm: '#c9a05b', warmBright: '#ead2a1', light: '#fff4e0', lightHalo: '#d6b07a',
            danger: '#c4473d', anomaly: '#7f8fb5', nebA: '#15181d', nebB: '#1d1a18',
            hull: ['#08090b', '#15171b', '#262a30', '#41464e', '#9a9690', '#f0ebe0'],
            hurt: ['#08090b', '#1c0c0b', '#38160f', '#68261c', '#c4473d', '#ffd0c4'],
        },
        phosphor: {
            name: 'Phosphor', note: 'The old game: green-black phosphor with amber accents.',
            void: '#05070a', deep: '#0a0d0b', dusk: '#101611', haze: '#1c2a21', mist: '#2f4a38',
            line: '#1c2a21', line2: '#2f4a38', text: '#c4d0c4', textDim: '#6b746c', star: '#f4f1e6',
            ui: '#74d99a', uiBright: '#9bf0bd', uiDim: '#2f6347',
            warm: '#d9a24a', warmBright: '#ffd27a', light: '#fff1c9', lightHalo: '#d9a24a',
            danger: '#d85a4e', anomaly: '#8a6fd1', nebA: '#101a14', nebB: '#1a1420',
            hull: ['#06070a', '#0d1a15', '#1b3329', '#2f5a48', '#74d99a', '#d6ffe4'],
            hurt: ['#06070a', '#1a0b0a', '#3a1512', '#6e241d', '#d85a4e', '#ffd0c8'],
        },
    };
    const paletteId = PALETTES[GAME_PALETTE] ? GAME_PALETTE : 'exodus';
    /** MiniLab.C: the colour roles of the active palette. */
    const C = Object.freeze({ ...PALETTES[paletteId] });

    // ── dither: the old 4 × 4 threshold (kept for code that builds its own 4 × 4 tables) and the travel view's 8 × 8 ──
    const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    const BAYER8 = [0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22,
        3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21].map(v => (v + 0.5) / 64);
    /** The 4 × 4 threshold in 0..1 (the old grain). */
    const bayer = (x, y) => (BAYER[((y & 3) << 2) | (x & 3)] + 0.5) / 16;
    /** The 8 × 8 threshold in 0..1 (the travel view's grain). */
    const bayer8 = (x, y) => BAYER8[((y & 7) << 3) | (x & 7)];
    /** Is pixel (x, y) lit at `tone` 0..1? (8 × 8 grain) */
    const on = (x, y, tone) => tone > bayer8(x | 0, y | 0);

    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const lerp = (a, b, t) => a + (b - a) * t;

    /** Hex colour helpers, for gradients and glows. */
    function rgb(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
    function hex([r, g, b]) { return '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join(''); }
    function mix(a, b, t) { const x = rgb(a), y = rgb(b); return hex([lerp(x[0], y[0], t), lerp(x[1], y[1], t), lerp(x[2], y[2], t)]); }
    /** A ramp of colours as an array; pick(ramp, tone, x, y) dithers between the two nearest stops (8 × 8 grain). */
    function pick(ramp, tone, x, y) {
        const top = ramp.length - 1, pos = clamp(tone, 0, 1) * top, lo = Math.floor(pos);
        return ramp[Math.min(top, (pos - lo) > bayer8(x, y) ? lo + 1 : lo)];
    }

    // ── the art grid: how a context maps picture units to its own pixels ──
    let density = 1;                     // the open minigame's (MiniHost sets it); 1 when none is open
    /** The context's unit → pixel scale and offset, or null when one unit is one pixel (a plain 480 × 270 canvas). */
    function gridOf(ctx) {
        const m = ctx.getTransform();
        return (m.a === 1 && m.d === 1) ? null : m;
    }
    /** Run fn with ctx drawing in its own pixels (scale 1, the translation kept); restores the transform after. */
    function rawly(ctx, m, fn) {
        ctx.setTransform(1, 0, 0, 1, m.e, m.f);
        try { return fn(); } finally { ctx.setTransform(m); }
    }
    /** Fill the unit rectangle (x, y, w, h) snapped to whole pixels of the grid. Call inside rawly(). */
    function snapRect(ctx, m, x, y, w, h) {
        const x0 = Math.round(x * m.a), y0 = Math.round(y * m.d), x1 = Math.round((x + w) * m.a), y1 = Math.round((y + h) * m.d);
        if (x1 > x0 && y1 > y0) ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
    /** The pixel box of the whole picture on this context (for clipping loops). */
    const pixW = (ctx, m) => Math.min(ctx.canvas.width - m.e, Math.round(W * m.a));
    const pixH = (ctx, m) => Math.min(ctx.canvas.height - m.f, Math.round(H * m.d));

    /** One picture unit, filled: snapped to the art grid on a scaled context. */
    function dot(ctx, x, y, color) {
        ctx.fillStyle = color;
        const m = gridOf(ctx);
        if (!m) { ctx.fillRect(Math.round(x), Math.round(y), 1, 1); return; }
        const ux = Math.round(x), uy = Math.round(y);
        rawly(ctx, m, () => snapRect(ctx, m, ux, uy, 1, 1));
    }
    /** One ART pixel at the picture-unit position (x, y): the finest mark there is (a star, a spark, a hairline). */
    function px(ctx, x, y, color) {
        ctx.fillStyle = color;
        const m = gridOf(ctx);
        if (!m) { ctx.fillRect(Math.round(x), Math.round(y), 1, 1); return; }
        rawly(ctx, m, () => ctx.fillRect(Math.round(x * m.a), Math.round(y * m.d), 1, 1));
    }
    /** Dithered rectangle: `tone` 0..1 is how much of it is lit. Dithered per art pixel. */
    function shade(ctx, x, y, w, h, tone, color) {
        ctx.fillStyle = color;
        const m = gridOf(ctx);
        if (!m) {
            const x0 = Math.round(x), y0 = Math.round(y), x1 = x0 + Math.round(w), y1 = y0 + Math.round(h);
            for (let py = Math.max(0, y0); py < Math.min(H, y1); py++) {
                for (let ppx = Math.max(0, x0); ppx < Math.min(W, x1); ppx++) if (on(ppx, py, tone)) ctx.fillRect(ppx, py, 1, 1);
            }
            return;
        }
        rawly(ctx, m, () => {
            const x0 = Math.round(Math.round(x) * m.a), y0 = Math.round(Math.round(y) * m.d);
            const x1 = Math.round((Math.round(x) + Math.round(w)) * m.a), y1 = Math.round((Math.round(y) + Math.round(h)) * m.d);
            const xe = Math.min(pixW(ctx, m), x1), ye = Math.min(pixH(ctx, m), y1);
            if (tone >= 1) { if (xe > x0 && ye > y0) ctx.fillRect(Math.max(0, x0), Math.max(0, y0), xe - Math.max(0, x0), ye - Math.max(0, y0)); return; }
            for (let py = Math.max(0, y0); py < ye; py++) for (let ppx = Math.max(0, x0); ppx < xe; ppx++) if (on(ppx, py, tone)) ctx.fillRect(ppx, py, 1, 1);
        });
    }
    /** Dithered disc. `tone` may be a number or a function (distance 0..1 from the centre) → tone. */
    function disc(ctx, cx, cy, r, tone, color) {
        ctx.fillStyle = color;
        const toneAt = typeof tone === 'function' ? tone : () => tone, m = gridOf(ctx);
        if (!m) {
            for (let py = Math.floor(cy - r); py <= Math.ceil(cy + r); py++) {
                if (py < 0 || py >= H) continue;
                for (let ppx = Math.floor(cx - r); ppx <= Math.ceil(cx + r); ppx++) {
                    if (ppx < 0 || ppx >= W) continue;
                    const d = Math.hypot(ppx - cx, py - cy) / r;
                    if (d <= 1 && on(ppx, py, toneAt(d))) ctx.fillRect(ppx, py, 1, 1);
                }
            }
            return;
        }
        rawly(ctx, m, () => {
            const k = m.a, ax = (cx + 0.5) * k, ay = (cy + 0.5) * k, ar = Math.max(0.5, r * k), pw = pixW(ctx, m), ph = pixH(ctx, m);
            for (let py = Math.max(0, Math.floor(ay - ar)); py <= Math.min(ph - 1, Math.ceil(ay + ar)); py++) {
                for (let ppx = Math.max(0, Math.floor(ax - ar)); ppx <= Math.min(pw - 1, Math.ceil(ax + ar)); ppx++) {
                    const d = Math.hypot(ppx + 0.5 - ax, py + 0.5 - ay) / ar;
                    if (d <= 1 && on(ppx, py, toneAt(d))) ctx.fillRect(ppx, py, 1, 1);
                }
            }
        });
    }
    /** A line one art pixel wide (Bresenham), optionally dithered by `tone`. */
    function line(ctx, x0, y0, x1, y1, color, tone = 1) {
        ctx.fillStyle = color;
        const m = gridOf(ctx), k = m ? m.a : 1, LW = m ? pixW(ctx, m) : W, LH = m ? pixH(ctx, m) : H;
        const off = m ? 0.5 : 0;   // a unit's centre, so a line between two dots runs through them
        const draw = () => {
            let ax = Math.round((Math.round(x0) + off) * k - off), ay = Math.round((Math.round(y0) + off) * k - off);
            const bx = Math.round((Math.round(x1) + off) * k - off), by = Math.round((Math.round(y1) + off) * k - off);
            const dx = Math.abs(bx - ax), dy = -Math.abs(by - ay), sx = ax < bx ? 1 : -1, sy = ay < by ? 1 : -1;
            let err = dx + dy;
            for (let guard = 0; guard < 12000; guard++) {
                if (ax >= 0 && ax < LW && ay >= 0 && ay < LH && on(ax, ay, tone)) ctx.fillRect(ax, ay, 1, 1);
                if (ax === bx && ay === by) break;
                const e2 = 2 * err;
                if (e2 >= dy) { err += dy; ax += sx; }
                if (e2 <= dx) { err += dx; ay += sy; }
            }
        };
        if (m) rawly(ctx, m, draw); else draw();
    }
    /** A circle one art pixel wide. */
    function ring(ctx, cx, cy, r, color, tone = 1) {
        ctx.fillStyle = color;
        const m = gridOf(ctx), k = m ? m.a : 1, LW = m ? pixW(ctx, m) : W, LH = m ? pixH(ctx, m) : H, off = m ? 0.5 : 0;
        const draw = () => {
            const ax = (cx + off) * k - off, ay = (cy + off) * k - off, ar = r * k, steps = Math.max(12, Math.ceil(ar * 7));
            for (let i = 0; i < steps; i++) {
                const a = (i / steps) * Math.PI * 2, x = Math.round(ax + Math.cos(a) * ar), y = Math.round(ay + Math.sin(a) * ar);
                if (x >= 0 && x < LW && y >= 0 && y < LH && on(x, y, tone)) ctx.fillRect(x, y, 1, 1);
            }
        };
        if (m) rawly(ctx, m, draw); else draw();
    }

    // ── a 3×5 pixel font for numbers and labels drawn inside the picture (one cell = one unit; use scale 2 for anything important) ──
    const GLYPHS = {
        '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111', '4': '101101111001001',
        '5': '111100111001111', '6': '111100111101111', '7': '111001001010010', '8': '111101111101111', '9': '111101111001111',
        A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
        F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
        K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
        P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
        U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
        Z: '111001010100111', '-': '000000111000000', '.': '000000000000010', ':': '000010000010000', '/': '001001010100100',
        '#': '101111101111101', ',': '000000000010100', "'": '010010000000000', ' ': '000000000000000', '?': '111001011000010',
        '%': '101001010100101', '+': '000010111010000', '·': '000000010000000', '>': '100010001010100', '<': '001010100010001',
    };
    /** Draw `str` in the pixel font. Returns the width in units. `scale` enlarges each cell. */
    function text(ctx, str, x, y, color, scale = 1) {
        ctx.fillStyle = color;
        const s = String(str).toUpperCase(), m = gridOf(ctx), x0 = Math.round(x), y0 = Math.round(y);
        const draw = () => {
            let cx = x0;
            for (const ch of s) {
                const g = GLYPHS[ch] || GLYPHS['?'];
                for (let i = 0; i < 15; i++) {
                    if (g[i] !== '1') continue;
                    const gx = cx + (i % 3) * scale, gy = y0 + Math.floor(i / 3) * scale;
                    if (m) snapRect(ctx, m, gx, gy, scale, scale); else ctx.fillRect(gx, gy, scale, scale);
                }
                cx += 4 * scale;
            }
            return cx - x0 - scale;
        };
        return m ? rawly(ctx, m, draw) : draw();
    }
    const textWidth = (str, scale = 1) => String(str).length * 4 * scale - scale;

    /** Small quiet words in the travel view's pixel font, one art pixel per cell (labels on a drawing, a hull number).
        align: 'left' (default), 'right' or 'center' about x. Returns the width in units. Needs MiniPaint. */
    function label(ctx, str, x, y, color, align = 'left') {
        const P = window.MiniPaint;
        if (!P) return text(ctx, str, x, y, color);
        const m = gridOf(ctx), k = m ? m.a : 1, w = P.pixelTextWidth(String(str).toUpperCase());
        ctx.fillStyle = color;
        const draw = () => {
            const ax = Math.round(x * k) - (align === 'right' ? w : align === 'center' ? Math.round(w / 2) : 0), ay = Math.round(y * k);
            P.pixelText(String(str).toUpperCase(), ax, ay, (gx, gy) => ctx.fillRect(gx, gy, 1, 1));
        };
        if (m) rawly(ctx, m, draw); else draw();
        return w / k;
    }
    const labelWidth = str => (window.MiniPaint ? window.MiniPaint.pixelTextWidth(String(str).toUpperCase()) / density : textWidth(str));

    /** Seeded random numbers, so a scene looks the same every time it opens. */
    function rng(seed) {
        let s = (seed >>> 0) || 1;
        return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    }

    // the travel view's star ramp (MiniPaint RP.STAR) and its space ramps, kept here so MiniLab works on its own
    const STAR = ['#05070a', '#1b272c', '#4c5f66', '#b3c2c0', '#f6f1e4'];
    const HAZE = ['#05070a', '#0a1317', '#0f222a', '#152f38', '#1f3a43'];
    const DUST = ['#05070a', '#160f0b', '#2c1a10', '#4e2f1a', '#7c4a26', '#b0733c'];

    /** A field of stars, drawn once per call from a seed: mostly faint cold points, a few bright ones with a small cross,
        a rare warm one. One art pixel each. */
    function stars(ctx, seed, count = 160) {
        const r = rng(seed);
        for (let i = 0; i < count; i++) {
            const x = r() * W, y = r() * H, mag = r(), warm = r() < 0.05;
            if (mag > 0.975) {
                px(ctx, x, y, STAR[4]);
                const m = gridOf(ctx), s = m ? 1 / m.a : 1;
                [[-s, 0], [s, 0], [0, -s], [0, s]].forEach(([dx, dy]) => px(ctx, x + dx, y + dy, STAR[2]));
            } else if (mag > 0.86) px(ctx, x, y, warm ? C.lightHalo : STAR[3]);
            else px(ctx, x, y, STAR[mag > 0.5 ? 2 : 1]);
        }
    }
    // the travel view's noise (MiniPaint's vnoise / fbm), for the nebula below
    const PERM = (() => { const r = rng(1337), p = Array.from({ length: 256 }, (_, i) => i); for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } return Uint8Array.from(p); })();
    const hash = (x, y, s = 0) => PERM[(PERM[(PERM[x & 255] + y) & 255] + s) & 255] / 255;
    function vnoise(x, y, s = 0) {
        const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
        const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
        return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
    }
    function fbm(x, y, s = 0, oct = 4) { let sum = 0, amp = 0.5, f = 1, n = 0; for (let i = 0; i < oct; i++) { sum += amp * vnoise(x * f, y * f, s + i * 17); n += amp; f *= 2.03; amp *= 0.5; } return sum / n; }

    /** Deep-field space: teal haze and a rust-gold dust lane, dithered per art pixel over the void (the travel view's
        spaceStrip, seeded). `strength` 0..1. Expensive: draw it once into a cached canvas. */
    function nebula(ctx, seed, strength = 0.5) {
        const m = gridOf(ctx), k = m ? m.a : 1, AW = m ? pixW(ctx, m) : W, AH = m ? pixH(ctx, m) : H, s = (seed >>> 0) % 9973;
        const draw = () => {
            for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) {
                const ux = x / k, uy = y / k;
                const dust = Math.max(0, fbm(ux / 23, uy / 13, s + 7, 4) - 0.5) * 3.4 * strength * 1.1;   // as the travel view lit by a far light
                const haze = Math.max(0, fbm(ux / 35, uy / 19, s, 4) - 0.5) * 1.15 * (0.5 + strength);
                let col = null;
                if (dust > 0.2 && dust * 0.75 > haze) col = pick(DUST, (dust - 0.08) * 0.8, x, y);
                else if (haze > 0.03) col = pick(HAZE, haze, x, y);
                if (!col || col === HAZE[0]) continue;
                ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1);
            }
        };
        if (m) rawly(ctx, m, draw); else draw();
    }

    // ── art pixels ──
    /** Units → art pixels of the open minigame, rounded. */
    const toArt = v => Math.round(v * density);
    /** Run fn(ctx, d) with ctx in its own pixels (the art grid; the game's translation kept). Returns what fn returns. */
    function inArt(ctx, fn) {
        const m = gridOf(ctx);
        if (!m) return fn(ctx, 1);
        return rawly(ctx, m, () => fn(ctx, m.a));
    }
    /** Draw `canvas` (made in art pixels) 1:1 at art pixel (ax, ay). */
    function blit(ctx, canvas, ax = 0, ay = 0) {
        inArt(ctx, () => ctx.drawImage(canvas, Math.round(ax), Math.round(ay)));
    }

    // ── sound: plays only when the game's own sound is on (read when a minigame opens), through its own master gain ──
    /** The game's sound switch: off with ?mute=1, when the player muted the game, or when the game has no audio. */
    function isGameSoundOn() {
        const game = window.AudioSystem, isUrlMuted = new URLSearchParams(location.search).get('mute') === '1';
        return !!(game && game.ctx && !game.muted) && !isUrlMuted;
    }

    const audio = {
        enabled: false, ctx: null, master: null, noise: null,
        /** The AudioContext if sound is on, else null. Safe to call every frame. Minigames connect to audio.master. */
        get() {
            if (!this.enabled) return null;
            if (!this.master) {
                this.master = this.ctx.createGain();
                this.master.gain.value = MASTER_VOLUME;
                this.master.connect(this.ctx.destination);
            }
            if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => { /* resumes on the next click */ });
            return this.ctx;
        },
        /** Two seconds of white noise, shared by every minigame (hiss, wind, static, sparks). */
        noiseBuffer() {
            if (!this.ctx) return null;
            if (!this.noise) {
                const len = this.ctx.sampleRate * 2, buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = buf.getChannelData(0);
                for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
                this.noise = buf;
            }
            return this.noise;
        },
        /** Fade the master bus out and drop it: every sound a minigame left running goes quiet with it. */
        silence() {
            const old = this.master;
            this.master = null;
            if (!old) return;
            old.gain.setTargetAtTime(0, this.ctx.currentTime, SILENCE_MS / 4000);
            setTimeout(() => { try { old.disconnect(); } catch (e) { /* already gone */ } }, SILENCE_MS);
        },
        /** Sound follows the game's switch, read now. Shares the game's AudioContext: one context for the whole page. */
        open() {
            this.silence();
            this.enabled = isGameSoundOn();
            if (!this.enabled) return;
            const ac = window.AudioSystem.ctx;
            if (ac !== this.ctx) { this.ctx = ac; this.noise = null; }
        },
        close() {
            this.silence();
            this.enabled = false;
        },
    };

    // ── loops and keys (MiniHost stops them when a minigame closes) ──
    let loops = [];
    /** Calls fn(dt seconds, t ms) about `fps` times a second until stopped. Returns a stop function. */
    function loop(fn, fps = 30) {
        let last = performance.now(), alive = true;
        const id = setInterval(() => {
            if (!alive) return;
            const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000);
            last = now;
            try { fn(dt, now); } catch (e) { alive = false; clearInterval(id); console.error(e); }
        }, 1000 / fps);
        const stop = () => { alive = false; clearInterval(id); };
        loops.push(stop);
        return stop;
    }
    const keys = new Set();
    let keyListeners = [];
    /** Listen for a key press while this minigame is open. `k` is KeyboardEvent.key, lower-cased for letters. */
    function onKey(fn) { keyListeners.push(fn); }

    function stopAll() {
        loops.forEach(stop => stop());
        loops = [];
        keys.clear();
        keyListeners = [];
    }

    /** A density MiniHost accepts: one of DENSITIES, else 1. */
    const validDensity = d => (DENSITIES.includes(d) ? d : 1);

    window.MiniLab = {
        W, H, C, PALETTES, DENSITIES, bayer, bayer8, on, clamp, lerp, rgb, hex, mix, pick, dot, px, shade, disc, line, ring, text, textWidth,
        label, labelWidth, rng, stars, nebula, vnoise, fbm, toArt, inArt, blit, validDensity,
        audio, loop, keys, onKey,
        get palette() { return paletteId; },
        /** The travel view's recipes (window.MiniPaint, a copy of NSPaint), or null when art/MiniPaint.js is not loaded. */
        get paint() { return window.MiniPaint || null; },
        /** The travel view's ramps ({ hex, rgb } each), or {} without MiniPaint. */
        get RP() { return window.MiniPaint ? window.MiniPaint.RP : {}; },
        /** A travel-view ramp as a hex array, for pick(): MiniLab.ramp('HULL'). Falls back to C.hull. */
        ramp(name) { const P = window.MiniPaint; return P && P.RP[name] ? P.RP[name].hex : C.hull; },
        /** Art pixels per picture unit of the minigame on screen (1 when none is open). */
        get density() { return density; },
        /** The picture in art pixels: { w, h, d }. */
        get art() { return { w: Math.round(W * density), h: Math.round(H * density), d: density }; },
        /** MiniHost only: a clean slate before a minigame mounts, at its density. */
        _open(d = 1) { stopAll(); density = validDensity(d); audio.open(); },
        /** MiniHost only: stop every loop, forget keys, silence every sound. */
        _close() { stopAll(); audio.close(); density = 1; },
        /** MiniHost only: one key event, down or up. */
        _key(e, isDown) {
            const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
            if (!isDown) { keys.delete(k); return; }
            keys.add(k);
            keyListeners.forEach(fn => fn(k, e));
        },
    };
})();
