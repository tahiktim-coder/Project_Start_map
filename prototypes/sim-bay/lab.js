/* lab.js — the shared frame for the Sim Bay sketches.
   Every sketch draws into one 480×270 canvas (shown scaled up, pixel-crisp) and talks to the player through one dialogue
   line and a row of buttons. Colours come from Lab.C, which holds ROLES (void, ui, warm, light …), not fixed hues: the
   page can switch the whole palette, and every sketch re-opens in the new one.

   The palette idea (docs/MINIGAME_IDEAS.md): the universe is cold, only people and the lie are warm.
   Space and machines are cool (blue, violet, teal); amber belongs to people, suits and lamps; the false sun is the warmest,
   most inviting thing on screen. Saturation is spent only where it means something; most of every frame stays dark.

   A sketch registers itself:
     Lab.register({ id, name, badge, short, verb, serves, replaces, controls, mount(ctx, ui) })
   mount() starts it and returns a cleanup function. The shell stops every Lab.loop, clears keys, buttons, dialogue,
   canvas handlers and all sound when you switch sketches or palettes. */

(function () {
    'use strict';

    const W = 480, H = 270;

    // ── palettes: the same roles, three moods ──
    const PALETTES = {
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
            name: 'Phosphor (current)', note: 'The game today: green-black phosphor with amber accents.',
            void: '#05070a', deep: '#0a0d0b', dusk: '#101611', haze: '#1c2a21', mist: '#2f4a38',
            line: '#1c2a21', line2: '#2f4a38', text: '#c4d0c4', textDim: '#6b746c', star: '#f4f1e6',
            ui: '#74d99a', uiBright: '#9bf0bd', uiDim: '#2f6347',
            warm: '#d9a24a', warmBright: '#ffd27a', light: '#fff1c9', lightHalo: '#d9a24a',
            danger: '#d85a4e', anomaly: '#8a6fd1', nebA: '#101a14', nebB: '#1a1420',
            hull: ['#06070a', '#0d1a15', '#1b3329', '#2f5a48', '#74d99a', '#d6ffe4'],
            hurt: ['#06070a', '#1a0b0a', '#3a1512', '#6e241d', '#d85a4e', '#ffd0c8'],
        },
    };
    const DEFAULT_PALETTE = 'lonely';

    /** Lab.C: the live colour roles. Old round-one names stay as aliases so nothing breaks while sketches are rebuilt. */
    const C = {};
    let paletteId = DEFAULT_PALETTE;
    function applyPalette(id) {
        paletteId = PALETTES[id] ? id : DEFAULT_PALETTE;
        const p = PALETTES[paletteId];
        Object.keys(C).forEach(k => delete C[k]);
        Object.assign(C, p, {
            // aliases (round one / two)
            ink: p.deep, ink2: p.dusk, green: p.ui, greenBr: p.uiBright, greenD: p.uiDim,
            bone: p.text, boneD: p.textDim, amber: p.warm, gold: p.warmBright, white: p.star, red: p.danger, violet: p.anomaly,
        });
        return paletteId;
    }
    applyPalette(DEFAULT_PALETTE);

    // ── dither ──
    const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    /** Threshold in 0..1 for pixel (x, y): a pixel is lit when its tone is above this. */
    const bayer = (x, y) => (BAYER[((y & 3) << 2) | (x & 3)] + 0.5) / 16;
    const on = (x, y, tone) => tone > bayer(x | 0, y | 0);

    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const lerp = (a, b, t) => a + (b - a) * t;

    /** Hex colour helpers, for gradients and glows. */
    function rgb(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
    function hex([r, g, b]) { return '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join(''); }
    function mix(a, b, t) { const x = rgb(a), y = rgb(b); return hex([lerp(x[0], y[0], t), lerp(x[1], y[1], t), lerp(x[2], y[2], t)]); }
    /** A ramp of colours as an array; pick(ramp, tone, x, y) dithers between the two nearest stops. */
    function pick(ramp, tone, x, y) {
        const top = ramp.length - 1, pos = clamp(tone, 0, 1) * top, lo = Math.floor(pos);
        return ramp[Math.min(top, (pos - lo) > bayer(x, y) ? lo + 1 : lo)];
    }

    function dot(ctx, x, y, color) { ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); }
    /** Dithered rectangle: `tone` 0..1 is how much of it is lit. */
    function shade(ctx, x, y, w, h, tone, color) {
        ctx.fillStyle = color;
        const x0 = Math.round(x), y0 = Math.round(y), x1 = x0 + Math.round(w), y1 = y0 + Math.round(h);
        for (let py = Math.max(0, y0); py < Math.min(H, y1); py++) {
            for (let px = Math.max(0, x0); px < Math.min(W, x1); px++) if (on(px, py, tone)) ctx.fillRect(px, py, 1, 1);
        }
    }
    /** Dithered disc. `tone` may be a number or a function (distance 0..1 from the centre) → tone. */
    function disc(ctx, cx, cy, r, tone, color) {
        ctx.fillStyle = color;
        const toneAt = typeof tone === 'function' ? tone : () => tone;
        for (let py = Math.floor(cy - r); py <= Math.ceil(cy + r); py++) {
            if (py < 0 || py >= H) continue;
            for (let px = Math.floor(cx - r); px <= Math.ceil(cx + r); px++) {
                if (px < 0 || px >= W) continue;
                const d = Math.hypot(px - cx, py - cy) / r;
                if (d <= 1 && on(px, py, toneAt(d))) ctx.fillRect(px, py, 1, 1);
            }
        }
    }
    /** One-pixel line (Bresenham), optionally dithered by `tone`. */
    function line(ctx, x0, y0, x1, y1, color, tone = 1) {
        ctx.fillStyle = color;
        x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
        const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
        let err = dx + dy;
        for (let guard = 0; guard < 4000; guard++) {
            if (x0 >= 0 && x0 < W && y0 >= 0 && y0 < H && on(x0, y0, tone)) ctx.fillRect(x0, y0, 1, 1);
            if (x0 === x1 && y0 === y1) break;
            const e2 = 2 * err;
            if (e2 >= dy) { err += dy; x0 += sx; }
            if (e2 <= dx) { err += dx; y0 += sy; }
        }
    }
    function ring(ctx, cx, cy, r, color, tone = 1) {
        const steps = Math.max(12, Math.ceil(r * 7));
        ctx.fillStyle = color;
        for (let i = 0; i < steps; i++) {
            const a = (i / steps) * Math.PI * 2, x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r);
            if (x >= 0 && x < W && y >= 0 && y < H && on(x, y, tone)) ctx.fillRect(x, y, 1, 1);
        }
    }

    // ── a 3×5 pixel font for numbers and labels drawn inside the picture (use scale 2 for anything important) ──
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
    /** Draw `str` in the pixel font. Returns the width in pixels. `scale` enlarges each pixel. */
    function text(ctx, str, x, y, color, scale = 1) {
        ctx.fillStyle = color;
        const s = String(str).toUpperCase();
        let cx = Math.round(x);
        for (const ch of s) {
            const g = GLYPHS[ch] || GLYPHS['?'];
            for (let i = 0; i < 15; i++) if (g[i] === '1') ctx.fillRect(cx + (i % 3) * scale, Math.round(y) + Math.floor(i / 3) * scale, scale, scale);
            cx += 4 * scale;
        }
        return cx - Math.round(x) - scale;
    }
    const textWidth = (str, scale = 1) => String(str).length * 4 * scale - scale;

    /** Seeded random numbers, so a scene looks the same every time it opens. */
    function rng(seed) {
        let s = (seed >>> 0) || 1;
        return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    }

    /** A field of stars, drawn once per call from a seed. A few are warm, a few are blue-white. */
    function stars(ctx, seed, count = 160) {
        const r = rng(seed);
        for (let i = 0; i < count; i++) {
            const k = r(), col = k < 0.08 ? C.star : k < 0.14 ? C.lightHalo : k < 0.24 ? C.uiBright : C.textDim;
            dot(ctx, r() * W, r() * H, col);
        }
    }
    /** A soft nebula: two palette hues dithered over the void with value noise. Expensive: draw once into a cached canvas. */
    function nebula(ctx, seed, strength = 0.5) {
        const r = rng(seed), ox = r() * 100, oy = r() * 100;
        const noise = (x, y) => {
            const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
            const h = (a, b) => { const v = Math.sin((a + ox) * 127.1 + (b + oy) * 311.7) * 43758.5453; return v - Math.floor(v); };
            const s = t => t * t * (3 - 2 * t), a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
            return lerp(lerp(a, b, s(xf)), lerp(c, d, s(xf)), s(yf));
        };
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const n = noise(x / 90, y / 70) * 0.6 + noise(x / 30, y / 24) * 0.3 + noise(x / 9, y / 8) * 0.1;
            const t = clamp((n - 0.42) * 2.2, 0, 1) * strength;
            if (t <= 0) continue;
            const col = noise(x / 140 + 5, y / 110) > 0.5 ? C.nebA : C.nebB;
            if (on(x, y, t)) { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); }
        }
    }

    // ── sound (off by default; the page has a toggle; sketches build their own sounds from these) ──
    const audio = {
        enabled: false, ctx: null, master: null, noise: null,
        /** The AudioContext if sound is on, else null. Safe to call every frame. */
        get() {
            if (!this.enabled) return null;
            if (!this.ctx) {
                const AC = window.AudioContext || window.webkitAudioContext;
                if (!AC) return null;
                this.ctx = new AC();
                this.fresh();
            }
            if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
            return this.ctx;
        },
        /** A new master bus; dropping the old one silences every sound a sketch left running. */
        fresh() {
            if (!this.ctx) return;
            if (this.master) { try { this.master.disconnect(); } catch (e) { /* already gone */ } }
            this.master = this.ctx.createGain();
            this.master.gain.value = 0.55;
            this.master.connect(this.ctx.destination);
        },
        /** Two seconds of white noise, shared by every sketch (hiss, wind, static, sparks). */
        noiseBuffer() {
            if (!this.ctx) return null;
            if (!this.noise) {
                const len = this.ctx.sampleRate * 2, buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = buf.getChannelData(0);
                for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
                this.noise = buf;
            }
            return this.noise;
        },
        setEnabled(v) {
            this.enabled = !!v;
            if (!this.enabled && this.ctx) this.fresh();
        },
    };

    // ── loops and keys (the shell stops them when you switch sketches) ──
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
    /** Listen for a key press while this sketch is open. `k` is KeyboardEvent.key lower-cased for letters. */
    function onKey(fn) { keyListeners.push(fn); }

    // ── the registry ──
    const protos = [];
    function register(p) { protos.push(p); }

    window.Lab = {
        W, H, C, PALETTES, bayer, on, clamp, lerp, rgb, hex, mix, pick, dot, shade, disc, line, ring, text, textWidth, rng, stars, nebula,
        audio, loop, keys, onKey, register, protos,
        get palette() { return paletteId; },
        setPalette: applyPalette,
        _reset() {
            loops.forEach(stop => stop()); loops = [];
            keys.clear(); keyListeners = [];
            audio.fresh();
        },
        _key(e, isDown) {
            const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
            if (isDown) { keys.add(k); keyListeners.forEach(fn => fn(k, e)); } else keys.delete(k);
        },
    };
})();
