/* lab.js — the shared frame for the Sim Bay prototypes.
   Every prototype draws into one 320×180 canvas (shown scaled up, pixelated) in the game's dusty-phosphor palette,
   using ordered (Bayer) dither for shading, and talks to the player through one dialogue line and a row of buttons.

   A prototype registers itself:
     Lab.register({ id, name, verb, serves, replaces, controls, mount(ctx, ui) })
   mount() starts it and returns a cleanup function (or nothing). The shell stops every Lab.loop and clears the
   buttons, the dialogue line and the key state when you switch prototypes, so cleanup only needs to undo what
   the prototype itself added to the page. */

(function () {
    'use strict';

    const W = 320, H = 180;
    const C = {
        void: '#05070a', ink: '#0a0d0b', ink2: '#101611', line: '#1c2a21', line2: '#2f4a38',
        green: '#74d99a', greenBr: '#9bf0bd', greenD: '#2f6347', bone: '#c4d0c4', boneD: '#6b746c',
        amber: '#d9a24a', red: '#d85a4e', gold: '#ffd27a', white: '#f4f1e6', violet: '#8a6fd1',
    };

    // ── dither ──
    const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    /** Threshold in 0..1 for pixel (x, y): a pixel is lit when its tone is above this. */
    const bayer = (x, y) => (BAYER[((y & 3) << 2) | (x & 3)] + 0.5) / 16;
    const on = (x, y, tone) => tone > bayer(x | 0, y | 0);

    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const lerp = (a, b, t) => a + (b - a) * t;

    function dot(ctx, x, y, color) {
        ctx.fillStyle = color;
        ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
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
        for (let guard = 0; guard < 2000; guard++) {
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

    // ── a 3×5 pixel font for numbers and labels drawn inside the picture ──
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

    /** A field of stars, drawn once per call from a seed. */
    function stars(ctx, seed, count = 90, color = C.boneD) {
        const r = rng(seed);
        for (let i = 0; i < count; i++) dot(ctx, r() * W, r() * H, r() < 0.15 ? C.bone : color);
    }

    // ── loops and keys (the shell stops them when you switch prototypes) ──
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
    /** Listen for a key press while this prototype is open. `code` is KeyboardEvent.key, e.g. 'ArrowLeft', ' ', 'a'. */
    function onKey(fn) { keyListeners.push(fn); }

    // ── the registry ──
    const protos = [];
    function register(p) { protos.push(p); }

    window.Lab = {
        W, H, C, bayer, on, clamp, lerp, dot, shade, disc, line, ring, text, textWidth, rng, stars,
        loop, keys, onKey, register, protos,
        _reset() {
            loops.forEach(stop => stop()); loops = [];
            keys.clear(); keyListeners = [];
        },
        _key(e, isDown) {
            const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
            if (isDown) { keys.add(k); keyListeners.forEach(fn => fn(k, e)); } else keys.delete(k);
        },
    };
})();
