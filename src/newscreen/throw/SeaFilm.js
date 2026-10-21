/* ═══ Silent Exodus · new screen (?new=1) · throw/SeaFilm.js: the sea of ships, played ═════════════════════════════════
   What it is: the second half of the jump into sector 3 (throw/Throw.js plays it after the stall): a full-screen film
   (.ns-film, so the travel view stops drawing under it) of throw/SeaArt.js's pictures, about 32 s. Our dark Lander among
   wrecks of our own class; the camera pulls back until our ship is one red dot in a sea of thousands; the drive relights,
   white. TheThrow's narration for this part is said one line at a time, in the travel view's type (the narration's italic,
   on the house dither shade, never in capitals), its words unchanged. No sound of its own.
   A click, Esc, Enter or Space skips to the end (a short dither to ink). Reduced motion: the lamps steady, no white flash
   (a slow fade to ink), the lines fade in and out without moving.
   Source: the player of prototypes/films/sea.html (clock, fit, skip) and start/LaunchFilm.js (the .ns-film frame).
   Loaded only when the new-screen switch is on, after throw/SeaArt.js.

   window.NSSea (frozen)
     prepare(delayMs)        work out the film's pictures ahead, one job a frame, from delayMs on (the stall calls it)
     play(app) → Promise     mounts the film (z-index 5000), resolves when it ends or is skipped (at once if the art is missing)
     isPlaying() → bool
     debug: { state() → { t, line, playing, ended, built }, setTime(ms) (pauses there), resume(), skip() }
*/
(function () {
    'use strict';
    const P = window.NSPaint, SA = window.NSSeaArt;
    if (!window.NEW_SCREEN || !P || !SA) return;
    const { INK, clamp01, smooth, threshold } = P;
    const { AW, AH, DUR } = SA;
    const SKIP_MS = 360, SKIP_GUARD_MS = 400, MAX_DT = 100, SKIP_HINT_MS = 4200, LINE_FADE = 350, JOB_EVERY = 3;
    const MAX_FAILS = 20;                                                              // frames in a row that may fail before the film gives up
    const SKIP_KEYS = ['Escape', 'Enter', ' '];
    // TheThrow's narration for this part, one line at a time: [from, to (ms), words]
    const LINES = [
        [4300, 9700, 'Ships. Thousands of them, in one long line. None of them are moving.'],
        [10500, 15300, 'Every ship Earth ever built. All on the same heading.'],
        [16300, 20100, 'Yours is the last one in the line.'],
        [21200, 26000, 'At the far end, a light the size of a pinhead.'],
        [28900, 30450, 'The burn finishes.'],                                              // gone before the white
    ];
    const isCalm = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    const CSS = `
.ns-film.ns-sea { position: fixed; inset: 0; z-index: 5000; background: #05070a; overflow: hidden; cursor: default; user-select: none; -webkit-user-select: none;
    --ink: #05070a; --text: #e4e4e0; --dim: #8b8d90; --u: 3px; --t: 1;
    --f-ui: 'IBM Plex Sans Condensed', 'Arial Narrow', sans-serif; --f-text: 'IBM Plex Sans', system-ui, sans-serif;
    color: var(--text); font: 400 15px/1.4 var(--f-text); -webkit-font-smoothing: antialiased; }
.ns-sea p { margin: 0; }
.ns-sea-frame { position: absolute; overflow: hidden; }
.ns-sea-art { position: absolute; inset: 0; width: 100%; height: 100%; image-rendering: pixelated; image-rendering: crisp-edges; }
.ns-sea-say { position: absolute; left: calc(var(--u) * 40); bottom: calc(var(--u) * 44); max-width: min(calc(var(--u) * 260), calc(100vw - 64px)); margin: 0;
    font: italic 400 calc(19px + 5px * var(--t))/1.36 var(--f-text); color: #c9cccd; text-wrap: balance; text-shadow: 0 1px 0 #05070a; opacity: 0; pointer-events: none; }
.ns-sea-skip { position: absolute; right: calc(var(--u) * 10); bottom: calc(var(--u) * 8); margin: 0; font: 400 max(12px, calc(var(--u) * 4))/1 var(--f-ui); letter-spacing: 0.2em;
    text-transform: uppercase; color: var(--dim); opacity: 0; pointer-events: none; }
`;
    function injectCss() {
        if (document.getElementById('ns-sea-css')) return;
        const s = document.createElement('style'); s.id = 'ns-sea-css'; s.textContent = CSS; document.head.appendChild(s);
    }

    // ── the pictures, worked out ahead ──
    let art = null, prepTimer = 0, prepFrame = null, prepN = 0;
    function ensureArt() { if (!art) art = SA.create(); return art; }
    function runJob() { const a = ensureArt(), job = a.jobs.shift(); if (job) { try { job(); } catch (err) { console.error('NSSea: a picture job failed', err); } } return a.jobs.length > 0; }
    function prepare(delayMs) {
        ensureArt();
        if (prepTimer || prepFrame != null) return;
        prepTimer = setTimeout(() => {
            prepTimer = 0;
            const tick = () => {
                prepFrame = null;
                if (++prepN % JOB_EVERY === 0 && !runJob()) return;                       // one job every few frames: the stall stays smooth
                prepFrame = (window.FrameClock ? window.FrameClock.request : requestAnimationFrame)(tick);
            };
            prepFrame = (window.FrameClock ? window.FrameClock.request : requestAnimationFrame)(tick);
        }, Math.max(0, delayMs || 0));
    }
    function stopPrep() {
        if (prepTimer) { clearTimeout(prepTimer); prepTimer = 0; }
        if (prepFrame != null) { (window.FrameClock ? window.FrameClock.cancel : cancelAnimationFrame)(prepFrame); prepFrame = null; }
    }

    // ── the shade under the words: the house dither, soft at its edge (Voice.js's, simpler) ──
    const shades = new Map();
    function shadeOf(w, h) {
        const key = w + 'x' + h;
        if (shades.has(key)) return shades.get(key);
        const pad = 14, W2 = w + pad * 2, H2 = h + pad * 2, c = document.createElement('canvas'); c.width = W2; c.height = H2;
        const g = c.getContext('2d'), img = g.createImageData(W2, H2), ink = P.hexRgb(INK), hw = w / 2, hh = h / 2, round = Math.min(hw, hh);
        for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) {
            const qx = Math.abs(x + 0.5 - pad - hw) - (hw - round), qy = Math.abs(y + 0.5 - pad - hh) - (hh - round);
            const sd = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - round + (P.fbm(x / 7, y / 4, 17, 2) - 0.5) * 12;
            if (0.94 * (1 - smooth(-10, pad, sd)) > threshold(x, y)) { const o = (y * W2 + x) * 4; img.data[o] = ink[0]; img.data[o + 1] = ink[1]; img.data[o + 2] = ink[2]; img.data[o + 3] = 255; }
        }
        g.putImageData(img, 0, 0);
        const out = { canvas: c, pad };
        if (shades.size > 30) shades.clear();
        shades.set(key, out);
        return out;
    }

    // ── the player ──
    let film = null;
    function mount() {
        injectCss();
        const root = document.createElement('div');
        root.className = 'ns-film ns-sea';
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-label', 'Film: the jump stalls among thousands of still ships. Click to skip.');   // DRAFT: for screen readers only, never on screen (as LaunchFilm's)
        root.innerHTML = '<div class="ns-sea-frame"><canvas class="ns-sea-art" aria-hidden="true"></canvas>'
            + '<p class="ns-sea-say" aria-live="polite"></p><p class="ns-sea-skip">Click to skip</p></div>';
        document.body.appendChild(root);
        const q = s => root.querySelector(s);
        return { root, frame: q('.ns-sea-frame'), canvas: q('canvas'), say: q('.ns-sea-say'), skip: q('.ns-sea-skip') };
    }

    function play() {
        if (film) return film.done;
        let ui = null;
        try { ui = mount(); } catch (err) { console.error('NSSea: the film could not start', err); return Promise.resolve(); }
        stopPrep();
        const a = ensureArt(), still = isCalm(), ctx = ui.canvas.getContext('2d', { alpha: false });
        ui.canvas.width = AW; ui.canvas.height = AH; ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = INK; ctx.fillRect(0, 0, AW, AH);
        let T = 0, playing = true, ended = false, last = null, frameId = null, skipT = null, finish = null, shown = null, unit = 3, drawMs = 0;
        const startedAt = performance.now(), dimPat = new Map();
        const done = new Promise(resolve => { finish = resolve; });

        function dim(k) {
            const n = Math.round(clamp01(k) * 8); if (!n) return;
            if (n >= 8) { ctx.fillStyle = INK; ctx.fillRect(0, 0, AW, AH); return; }
            if (!dimPat.has(n)) { const c = document.createElement('canvas'); c.width = c.height = 8; const g = c.getContext('2d'); g.fillStyle = INK; for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (threshold(x, y) < n / 8) g.fillRect(x, y, 1, 1); dimPat.set(n, ctx.createPattern(c, 'repeat')); }
            ctx.fillStyle = dimPat.get(n); ctx.fillRect(0, 0, AW, AH);
        }
        function words() {
            const L = skipT == null && !ended ? LINES.find(l => T >= l[0] && T < l[1]) : null;
            if (L !== shown) { shown = L; ui.say.textContent = L ? L[2] : ''; }
            const op = L ? Math.min(1, (T - L[0]) / LINE_FADE, (L[1] - T) / LINE_FADE) : 0;
            ui.say.style.opacity = String(Math.max(0, Math.round(op * 6) / 6));
            ui.skip.style.opacity = T < SKIP_HINT_MS && playing && !ended && skipT == null && a.ready() ? '0.85' : '0';
            return L ? op : 0;
        }
        function shadeUnder(op) {
            if (op <= 0) return;
            const r = ui.say.getBoundingClientRect(), f = ui.frame.getBoundingClientRect();
            if (!r.width) return;
            const x = Math.floor((r.left - f.left) / unit), y = Math.floor((r.top - f.top) / unit), w = Math.ceil(r.width / unit), h = Math.ceil(r.height / unit), s = shadeOf(w, h);
            ctx.save(); ctx.globalAlpha = Math.min(1, op * 1.2); ctx.drawImage(s.canvas, x - s.pad, y - s.pad); ctx.restore();
        }
        function render(now) {
            ctx.fillStyle = INK; ctx.fillRect(0, 0, AW, AH);
            if (!a.ready()) { while (runJob() && !a.ready()) { /* the rest of the picture, under the ink */ } }
            else if (a.jobs.length) runJob();                                               // the rest of the nearest wrecks, a little each frame
            const t0 = performance.now();
            try { a.draw(ctx, T, still, playing && !ended && skipT == null); } catch (err) { console.error('NSSea: a frame failed', err); }
            drawMs = drawMs * 0.9 + (performance.now() - t0) * 0.1;
            const op = words();
            shadeUnder(op);
            if (skipT != null) dim(clamp01((now - skipT) / SKIP_MS));
        }
        function fit() {
            const dpr = window.devicePixelRatio || 1, k = Math.max(1, Math.floor(Math.min(innerWidth * dpr / AW, innerHeight * dpr / AH)));
            const w = AW * k / dpr, h = AH * k / dpr;
            Object.assign(ui.frame.style, { width: w + 'px', height: h + 'px', left: Math.round((innerWidth - w) / 2) + 'px', top: Math.round((innerHeight - h) / 2) + 'px' });
            unit = k / dpr;
            ui.root.style.setProperty('--u', unit + 'px');
            ui.root.style.setProperty('--t', String(clamp01((innerWidth - 1280) / 640)));
        }
        function request() { frameId = (window.FrameClock ? window.FrameClock.request : requestAnimationFrame)(loop); }
        let fails = 0;
        function loop(now) {
            frameId = null;
            if (!film || film.ui !== ui) return;
            const dt = last == null ? 16 : Math.min(MAX_DT, Math.max(0, now - last)); last = now;
            if (playing && !ended && skipT == null && a.ready()) { T += dt; if (T >= DUR) { T = DUR; ended = true; } }
            try { render(now); fails = 0; } catch (err) { console.error('NSSea: the film failed', err); if (++fails >= MAX_FAILS) ended = true; }   // failing frame after frame: the jump goes on
            if (!a.ready() && !a.jobs.length) ended = true;                                // nothing left to build and still not ready: it cannot play
            if (ended || (skipT != null && now - skipT >= SKIP_MS)) { close(); return; }
            request();
        }
        function skip() {
            if (ended || skipT != null || performance.now() - startedAt < SKIP_GUARD_MS) return;
            skipT = performance.now();
        }
        const onDown = e => { e.preventDefault(); e.stopPropagation(); skip(); };
        const onKey = e => { if (!SKIP_KEYS.includes(e.key)) return; e.preventDefault(); e.stopPropagation(); skip(); };
        function close() {
            if (!film || film.ui !== ui) return;
            if (frameId != null) { (window.FrameClock ? window.FrameClock.cancel : cancelAnimationFrame)(frameId); frameId = null; }
            removeEventListener('resize', fit);
            removeEventListener('keydown', onKey, true);
            ui.root.remove();
            film = null; art = null;                                                     // the next run works its pictures out again
            finish();
        }
        film = { ui, done, debug: {
            state: () => ({ t: Math.round(T), line: shown ? shown[2] : null, playing, ended, built: a.ready(), drawMs: +drawMs.toFixed(1) }),
            setTime(ms) { playing = false; T = clamp01(ms / DUR) * DUR; },
            resume() { playing = true; },
            skip() { skipT = performance.now() - SKIP_GUARD_MS; },
        } };
        ui.root.addEventListener('pointerdown', onDown);
        addEventListener('keydown', onKey, true);
        addEventListener('resize', fit);
        fit();
        setTimeout(() => request(), 30);                                                 // the ink shows first; the rest of the pictures are worked out under it
        return done;
    }

    window.NSSea = Object.freeze({
        prepare, play,
        isPlaying: () => !!film,
        debug: Object.freeze({
            state: () => (film ? film.debug.state() : null),
            setTime: ms => { if (film) film.debug.setTime(ms); },
            resume: () => { if (film) film.debug.resume(); },
            skip: () => { if (film) film.debug.skip(); },
        }),
    });
})();
