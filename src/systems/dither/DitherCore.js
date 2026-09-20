/* DitherCore — shared pieces of the opt-in 1-bit ordered-dither art mode.
   Style reference: ART_STYLE_1BIT_DITHER.md. Two inks (INK / PAPER) plus one accent per object,
   accent only ever on pixels the dither already turned on.
   Art mode is opt-in (`?art=dither`, or the ART header button) so the classic SVG look keeps working. */

(function () {
    'use strict';

    const MODE_KEY = 'psm-art-mode';
    const MODES = ['classic', 'dither'];
    const DEFAULT_MODE = 'dither'; // the look the game ships with; the ART button still switches to classic
    const INK = [11, 11, 13];
    const PAPER = [233, 230, 217];
    const ACCENT_MIX = 0.85; // how far a fully-accented pixel moves from its ramp colour to the accent
    const FRAME_MS = 125; // stepped ~8fps: reads as deliberate, and keeps terminator boil down

    // ── art mode ──
    function readMode() {
        const fromUrl = new URLSearchParams(location.search).get('art');
        if (MODES.includes(fromUrl)) {
            try { localStorage.setItem(MODE_KEY, fromUrl); } catch (e) { /* storage blocked: URL still wins for this load */ }
            return fromUrl;
        }
        try {
            const saved = localStorage.getItem(MODE_KEY);
            return MODES.includes(saved) ? saved : DEFAULT_MODE;
        } catch (e) {
            return DEFAULT_MODE;
        }
    }
    const mode = readMode();
    document.documentElement.dataset.art = mode; // dither.css keys off this

    function setMode(next) {
        if (!MODES.includes(next)) return;
        try { localStorage.setItem(MODE_KEY, next); } catch (e) { /* fall through to the URL param below */ }
        const url = new URL(location.href);
        url.searchParams.set('art', next);
        location.href = url.toString();
    }

    // ── Bayer threshold matrix (recursive) ──
    function bayer(n) {
        if (n === 1) return [[0]];
        const s = bayer(n / 2), h = n / 2, m = [];
        for (let y = 0; y < n; y++) m.push(new Array(n));
        for (let y = 0; y < h; y++) for (let x = 0; x < h; x++) {
            const v = s[y][x] * 4;
            m[y][x] = v; m[y][x + h] = v + 2; m[y + h][x] = v + 3; m[y + h][x + h] = v + 1;
        }
        return m;
    }
    const BAYER_N = 8;
    const BAYER = bayer(BAYER_N).map(row => row.map(v => (v + 0.5) / (BAYER_N * BAYER_N)));

    // ── seeded value noise ──
    const perm = new Uint8Array(256);
    (function () {
        let s = 1337;
        for (let i = 0; i < 256; i++) perm[i] = i;
        for (let i = 255; i > 0; i--) {
            s = (s * 1664525 + 1013904223) >>> 0;
            const j = s % (i + 1), t = perm[i];
            perm[i] = perm[j]; perm[j] = t;
        }
    })();
    function h2(x, y) { return perm[(perm[x & 255] + (y & 255)) & 255] / 255; }
    function vnoise(x, y) {
        const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
        const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
        const a = h2(xi, yi), b = h2(xi + 1, yi), c = h2(xi, yi + 1), d = h2(xi + 1, yi + 1);
        return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
    }
    function fbm(x, y, octaves) {
        let sum = 0, amp = 0.5, freq = 1;
        for (let i = 0; i < (octaves || 4); i++) { sum += amp * vnoise(x * freq, y * freq); freq *= 2.07; amp *= 0.5; }
        return sum;
    }
    function ridge(x, y) { return 1 - Math.abs(fbm(x, y, 3) * 2 - 1); }
    function rng(seed) {
        let s = ((seed || 1) * 2654435761 + 7) >>> 0;
        return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    }

    function hexToRgb(hex) {
        const n = parseInt(hex.replace('#', ''), 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    const ramp = (...hexes) => hexes.map(hexToRgb);
    const MONO_RAMP = [INK, PAPER];

    /**
     * Ordered-dither a greyscale buffer onto a colour ramp (shadow → highlight) and write it to `img`.
     * Tone picks a position on the ramp; the Bayer threshold decides between the two neighbouring
     * stops, so a 5-stop ramp reads as smooth coloured shading with a dither grain instead of 1-bit noise.
     * look = { ramp, accent, contrast }. Pixels outside `mask` that land on the darkest stop stay
     * transparent so the backdrop shows through; pass mask=null for a fully opaque image.
     */
    function quantize(img, w, h, gray, acc, mask, look) {
        const d = img.data, stops = look.ramp || MONO_RAMP, top = stops.length - 1;
        const k = look.contrast || 1.1, accent = look.accent;
        for (let y = 0; y < h; y++) {
            const row = BAYER[y % BAYER_N];
            for (let x = 0; x < w; x++) {
                const i = y * w + x, o = i * 4, solid = !mask || mask[i];
                let g = (gray[i] - 0.5) * k + 0.5;
                g = g < 0 ? 0 : g > 1 ? 1 : g;
                const pos = g * top, base = Math.floor(pos);
                let level = Math.min(top, base + (pos - base > row[x % BAYER_N] ? 1 : 0));
                if (!solid && level === 0) { d[o + 3] = 0; continue; }
                if (!solid) level = Math.min(top, level + 1); // halos glow in the lit colours, not the shadow ones
                const c = stops[level], a = (accent && acc && level > 1) ? Math.min(1, acc[i]) * ACCENT_MIX : 0;
                d[o] = c[0] + (accent ? (accent[0] - c[0]) * a : 0);
                d[o + 1] = c[1] + (accent ? (accent[1] - c[1]) * a : 0);
                d[o + 2] = c[2] + (accent ? (accent[2] - c[2]) * a : 0);
                d[o + 3] = 255;
            }
        }
    }

    /** Per-channel ordered dither down to `levels` steps — keeps a source image's own colours. */
    function posterize(img, w, h, levels) {
        const d = img.data, n = levels - 1;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            const o = (y * w + x) * 4, th = BAYER[y % BAYER_N][x % BAYER_N];
            for (let ch = 0; ch < 3; ch++) d[o + ch] = Math.min(n, Math.floor(d[o + ch] / 255 * n + th)) / n * 255;
        }
    }

    // ── one shared stepped clock for everything animated ──
    const tickers = new Set();
    let last = 0;
    const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    function loop(now) {
        if (now - last >= FRAME_MS) {
            last = now;
            tickers.forEach(fn => fn(now));
        }
        requestAnimationFrame(loop);
    }
    function onTick(fn) {
        tickers.add(fn);
        if (tickers.size === 1 && !reduceMotion) requestAnimationFrame(loop);
    }

    const artButton = document.getElementById('btn-art');
    if (artButton) {
        artButton.textContent = mode === 'dither' ? 'ART: DITHER' : 'ART: CLASSIC';
        artButton.addEventListener('click', () => setMode(mode === 'dither' ? 'classic' : 'dither'));
    }

    window.DitherCore = {
        mode, isOn: mode === 'dither', setMode,
        toggle: () => setMode(mode === 'dither' ? 'classic' : 'dither'),
        INK, PAPER, ramp, vnoise, fbm, ridge, rng, quantize, posterize, onTick,
    };
})();
