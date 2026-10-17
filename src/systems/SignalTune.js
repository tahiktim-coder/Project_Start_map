/* SignalTune — a deep scan is something you tune, not a button you press.
   The planet sends back a wave. You have two dials (pitch, strength) and a few seconds: make your
   wave sit on top of theirs and lock it. The target drifts, more in deeper sectors, so you cannot
   wait for a perfect moment forever.
     sharp lock (85%+) → the scan picks up extra detail (+1 data)
     fair lock         → a normal scan
     weak lock (<45%)  → the scan has to run twice (1 extra energy)
   A.U.R.A. will tune it for you: always fair, never sharp.
   play(opts) → Promise<{ match: 0..1, grade: 'sharp'|'fair'|'weak', auto: boolean }>
     opts: { targetName, sector, effects? }  effects: { sharp, fair, weak } the result's words when a lock means something
     else (the new look: src/newscreen/Scan.js LOCK, where a lock decides the marked landing spot); the labels stay

   THE LOOK (2026-10-11): the travel view's, like the redrawn minigames (src/systems/minigames/, LanderGame.js): no panel and
   no big buttons; the picture floats on the dimmed game, a quiet header above it, the match as one small readout over the
   picture, the time left as a hairline along its foot, the dials as thin scales, the result under it as LanderGame.js says
   its own (the grade's label over its effect, the words unchanged).
   The picture is painted in art pixels (8 x 8 Bayer dither between ramps that start at the ink, docs/ART_STYLE.md): deep
   field behind a dotted graticule, the planet's wave a dim, grainy ice trace, yours a clean pale one that warms when it
   sits on theirs. Needs nothing but the page; uses MiniPaint (the minigames' art kit, loaded by MiniLab.js in both modes)
   for the sky when it is there. Gameplay is the old one: the same units, rules, drift, timing, controls and result. */

(function () {
    'use strict';

    // ── the game (unchanged): one picture 320 x 110 units wide/high, the wave's middle and height in those units ──
    const BUFFER_W = 320, BUFFER_H = 110, MID_Y = 55, WAVE_HEIGHT = 40;
    const TIME_LIMIT_MS = 14000, RESULT_HOLD_MS = 1500, LEAVE_MS = 350;
    const PITCH = { min: 1.5, max: 6 }, STRENGTH = { min: 0.25, max: 1 };
    const SHARP_AT = 0.85, WEAK_BELOW = 0.45, AUTO_MATCH = 0.7;
    const BASE_DRIFT = 0.25, DRIFT_PER_SECTOR = 0.09;
    const GRADES = {                                             // the words as before; color: the label's ink in the new look
        sharp: { label: 'SHARP LOCK', effect: 'extra detail recovered — +1 data', color: '#ffc27a' },
        fair: { label: 'FAIR LOCK', effect: 'a normal scan', color: '#c9d1d6' },
        weak: { label: 'WEAK LOCK', effect: 'the scan has to run twice — 1 extra energy', color: '#f0a24a' },
    };
    const AUTO_LABEL = 'A.U.R.A. TUNED IT';
    const HINT = 'The dim wave is the planet. The bright wave is yours. Move the two dials until they sit on top of each other, then lock — before the signal fades.';
    const sfx = (name, ...args) => { const audio = window.AudioSystem; if (audio && typeof audio[name] === 'function') audio[name](...args); }; // silent when muted
    const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

    const gradeOf = match => (match >= SHARP_AT ? 'sharp' : match < WEAK_BELOW ? 'weak' : 'fair');

    function matchOf(s) {
        const pitchMiss = Math.abs(s.pitch - s.targetPitch) / (PITCH.max - PITCH.min);
        const strengthMiss = Math.abs(s.strength - s.targetStrength) / (STRENGTH.max - STRENGTH.min);
        return Math.max(0, 1 - (pitchMiss * 2.4 + strengthMiss * 1.2)); // pitch matters twice as much as strength
    }

    // ── the picture: art pixels (2.25 per unit: 720 x 248, two screen pixels each in a 1080p window) ──
    const ART = 2.25, AW = Math.round(BUFFER_W * ART), AH = Math.round(BUFFER_H * ART);
    const GRID_STEP = 16, LOCK_NEAR = 2.5;                       // graticule every 16 units; "sitting on theirs" within 2.5 art pixels
    const INK = '#05070a';
    // the travel view's ramps (MiniPaint.RP), as hex: ice for the planet's trace, ui for yours, amber when they lock
    const RAMP = {
        haze: [INK, '#0a1317', '#0f222a', '#152f38', '#1f3a43'],
        ice: [INK, '#0c1a20', '#1a3440', '#33606e', '#7fb3c2', '#d6eef4'],
        ui: [INK, '#13232a', '#284650', '#3d6670', '#9fd8e6', '#e1f6fb'],
        amber: [INK, '#3a2410', '#8a5422', '#e8964a', '#f7c483', '#fff3dc'],
    };
    const BAYER_4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
    const threshold = (x, y) => (window.MiniPaint ? window.MiniPaint.threshold(x, y) : BAYER_4[((y & 3) << 2) | (x & 3)]);
    const px32 = hex => { const n = parseInt(hex.slice(1), 16); return (255 << 24 | (n & 255) << 16 | ((n >> 8) & 255) << 8 | (n >> 16) & 255) >>> 0; }; // ABGR (little-endian ImageData)
    const RAMP32 = Object.fromEntries(Object.entries(RAMP).map(([k, r]) => [k, r.map(px32)]));
    /** The ramp step for brightness v (0..1) at art pixel (x, y), dithered. */
    function step(ramp, v, x, y) {
        const top = ramp.length - 1, pos = Math.max(0, Math.min(1, v)) * top, lo = Math.floor(pos);
        return Math.min(top, lo + (pos - lo > threshold(x, y) ? 1 : 0));
    }

    function seedOf(str) { let h = 2166136261; for (const ch of String(str)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return (h >>> 0) % 9973; }

    /** The still layer, painted once: deep field (dim, so the traces carry), then the dotted graticule. Returns its pixels. */
    function paintBackground(seed) {
        const P = window.MiniPaint, bg = new Uint32Array(AW * AH).fill(px32(INK));
        if (P) {
            const p = P.painter(AW, AH, true), strip = P.spaceStrip(AW, AH, seed, 0.16, 0.36, 0.4);
            P.paintSpace(p, strip, 0, new Float32Array(AW * AH).fill(0.3));
            bg.set(new Uint32Array(p.data.buffer));
        }
        const dim = RAMP32.haze, put = (x, y, c) => { if (x >= 0 && y >= 0 && x < AW && y < AH) bg[y * AW + x] = c; };
        for (let gx = GRID_STEP; gx < BUFFER_W; gx += GRID_STEP) {                                    // the verticals, every other pixel
            const x = Math.round(gx * ART);
            for (let y = 0; y < AH; y += 2) put(x, y, dim[2]);
        }
        const mid = Math.round(MID_Y * ART), top = Math.round((MID_Y - WAVE_HEIGHT) * ART), low = Math.round((MID_Y + WAVE_HEIGHT) * ART);
        for (let x = 0; x < AW; x += 2) put(x, mid, dim[3]);                                          // the centre line
        for (let x = 0; x < AW; x += 6) { put(x, top, dim[2]); put(x, low, dim[2]); }                 // the full-strength marks
        for (let gx = 0; gx <= BUFFER_W; gx += GRID_STEP / 2) {                                       // small ticks on the centre line
            const x = Math.round(gx * ART), h = gx % GRID_STEP === 0 ? 3 : 1;
            for (let d = -h; d <= h; d++) put(x, mid + d, dim[4]);
        }
        return bg;
    }

    /** One wave's height in art pixels at every art column. Same sum as the old drawing: units in, art pixels out. */
    function traceOf(pitch, strength, phase, jitter) {
        const ys = new Float32Array(AW);
        for (let x = 0; x < AW; x++) {
            const u = x / ART;
            const noise = jitter ? (Math.sin(u * 12.9898 + phase * 78.233) * 43758.5453 % 1) * jitter : 0;
            ys[x] = (MID_Y + Math.sin((u / BUFFER_W) * Math.PI * 2 * pitch + phase) * WAVE_HEIGHT * strength + noise) * ART;
        }
        return ys;
    }

    /** Lay a trace into the frame: a dithered glow `halo` art pixels deep, then the core joined column to column (no gaps on steep slopes). */
    function plotTrace(buf, ys, look) {
        const ramp = RAMP32[look.ramp], R = RAMP[look.ramp];
        const put = (x, y, v) => { if (y < 0 || y >= AH) return; const k = step(R, v, x, y); if (k > 0) buf[y * AW + x] = ramp[k]; };
        for (let x = 0; x < AW; x++) {
            const y = Math.round(ys[x]), prev = Math.round(ys[x > 0 ? x - 1 : 0]);
            for (let d = 1; d <= look.halo; d++) {
                const v = look.haloTone * (1 - d / (look.halo + 1)) ** 1.6;
                put(x, Math.min(y, prev) - d, v); put(x, Math.max(y, prev) + look.width - 1 + d, v);
            }
            for (let yy = Math.min(y, prev); yy <= Math.max(y, prev) + look.width - 1; yy++) put(x, yy, look.core + (look.grain ? (threshold(x * 7, yy * 3) - 0.5) * look.grain : 0));
        }
    }

    const PLANET_LOOK = { ramp: 'ice', width: 3, core: 0.55, grain: 0.4, halo: 3, haloTone: 0.4 };
    const YOURS_LOOK = { ramp: 'ui', width: 2, core: 1, grain: 0, halo: 4, haloTone: 0.5 };
    const LOCKED_LOOK = { ramp: 'amber', width: 2, core: 1, grain: 0, halo: 4, haloTone: 0.62 };

    /** Where your trace sits on theirs, a few warm pixels: the lock you are making, shown where it happens. */
    function plotTouch(buf, mine, theirs) {
        const warm = RAMP32.amber;
        for (let x = 0; x < AW; x++) {
            if (Math.abs(mine[x] - theirs[x]) > LOCK_NEAR) continue;
            const y = Math.round(mine[x]);
            if (y >= 0 && y < AH) buf[y * AW + x] = warm[threshold(x, y) > 0.5 ? 5 : 4];
        }
    }

    function draw(view, s, now) {
        const phase = now / 600, isClose = s.match >= SHARP_AT;
        view.buf.set(view.bg);
        const theirs = traceOf(s.targetPitch, s.targetStrength, phase, s.jitter);
        const mine = traceOf(s.pitch, s.strength, phase, 0);
        plotTrace(view.buf, theirs, PLANET_LOOK);
        plotTrace(view.buf, mine, isClose ? LOCKED_LOOK : YOURS_LOOK);
        if (!isClose) plotTouch(view.buf, mine, theirs);
        view.ctx.putImageData(view.img, 0, 0);
    }

    // ── the frame around the picture: the travel view's quiet words (IBM Plex, loaded by minigames.css), as LanderGame.js ──
    const FIT_MARGIN = 16, CRISP_MIN_FILL = 0.8, STYLE_ID = 'signal-tune-st-style';
    const MAX_SCALE = 2;                                         // at most two screen pixels per art pixel, as the travel view in a 1080p window
    // the type and the easing (minigames.css's --mg-f-* and --mg-ease), as custom properties on the overlay: as plain JS
    // strings tools/export_script.js would list them in docs/script as lines a player reads
    const TYPE = `--st-f-ui: 'IBM Plex Sans Condensed', 'Arial Narrow', sans-serif; --st-f-text: 'IBM Plex Sans', system-ui, sans-serif; --st-f-num: 'IBM Plex Mono', ui-monospace, Consolas, monospace; --st-ease: cubic-bezier(0.2, 0.7, 0.2, 1);`;
    const THUMB = `width: 13px; height: 13px; border: 1px solid #c9d1d6; border-radius: 50%; background: #05070a; box-shadow: 0 0 0 3px rgba(5, 7, 10, 0.85); transition: border-color 140ms var(--st-ease), background 140ms var(--st-ease);`;
    const TRACK = 'height: 9px; background: linear-gradient(#3d6670, #3d6670) 0 4px / 100% 1px no-repeat, repeating-linear-gradient(90deg, #284650 0 1px, transparent 1px 10%) 0 0 / 100% 9px no-repeat;';
    const STYLE = `
.warp-plot.signal-tune.st { ${TYPE} background: rgba(5, 7, 10, 0.95); -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); color: #e4e4e0; font: 400 15px/1.4 var(--st-f-text); -webkit-font-smoothing: antialiased; padding: ${FIT_MARGIN}px; overflow: auto; }
.st .st-frame { width: min-content; display: grid; gap: 12px; }
.st .st-head { display: flex; align-items: baseline; gap: 16px; min-height: 26px; padding: 0 2px; text-shadow: 0 1px 0 #05070a; }
.st .st-kicker { margin: 0; font: 500 12px/1 var(--st-f-ui); letter-spacing: 0.24em; text-transform: uppercase; color: #8b8d90; white-space: nowrap; }
.st .st-title { margin: 0; font: 300 22px/1.1 var(--st-f-text); letter-spacing: 0.06em; color: #e4e4e0; white-space: nowrap; }
.st .st-screen { position: relative; background: #05070a; box-shadow: 0 0 0 1px rgba(201, 209, 214, 0.07), 0 30px 90px rgba(0, 0, 0, 0.6); }
.st .st-canvas { display: block; image-rendering: pixelated; image-rendering: crisp-edges; }
.st .st-note { position: absolute; left: 1.6%; top: 4%; margin: 0; display: flex; align-items: baseline; gap: 8px; font: 400 13px/1.2 var(--st-f-num); letter-spacing: 0.02em; color: #5a6168; text-shadow: 0 1px 0 #05070a, 0 0 6px rgba(5, 7, 10, 0.9); pointer-events: none; }
.st .tune-match { min-width: 4ch; font: 400 16px/1.2 var(--st-f-num); letter-spacing: 0.02em; color: #c9d1d6; transition: color 150ms; }
.st .tune-match.is-warm { color: #ffc27a; }
.st .tune-match.is-danger { color: #e2574c; }
.st .tune-timer { position: absolute; left: 0; right: 0; bottom: 0; height: 2px; background: none; pointer-events: none; }
.st .tune-timer i { display: block; height: 100%; background: #3d6670; transform-origin: left; transition: background 400ms; }
.st .tune-timer.is-low i { background: #e8964a; }
.st .st-dials { contain: inline-size; display: grid; grid-template-columns: 1fr 1fr; gap: 8px 40px; padding: 2px 2px 0; }
.st .st-dials label { display: grid; gap: 6px; font: 400 13px/1 var(--st-f-num); letter-spacing: 0.02em; color: #5a6168; }
.st .st-dials input[type="range"] { -webkit-appearance: none; appearance: none; width: 100%; height: 22px; margin: 0; background: none; cursor: ew-resize; }
.st .st-dials input[type="range"]::-webkit-slider-runnable-track { ${TRACK} }
.st .st-dials input[type="range"]::-moz-range-track { ${TRACK} }
.st .st-dials input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; margin-top: -2px; ${THUMB} }
.st .st-dials input[type="range"]::-moz-range-thumb { ${THUMB} }
.st .st-dials input[type="range"]:focus { outline: none; }
.st .st-dials input[type="range"]:hover:not([disabled])::-webkit-slider-thumb, .st .st-dials input[type="range"]:focus-visible::-webkit-slider-thumb { border-color: #f08c2e; }
.st .st-dials input[type="range"]:hover:not([disabled])::-moz-range-thumb, .st .st-dials input[type="range"]:focus-visible::-moz-range-thumb { border-color: #f08c2e; }
.st .st-dials input[type="range"]:active:not([disabled])::-webkit-slider-thumb { background: #ffc27a; border-color: #ffc27a; }
.st .st-dials input[type="range"]:active:not([disabled])::-moz-range-thumb { background: #ffc27a; border-color: #ffc27a; }
.st .st-dials label:focus-within { color: #c9d1d6; }
.st .st-dials input[disabled] { opacity: 0.4; cursor: default; }
.st .st-talk { contain: inline-size; min-height: 58px; display: grid; align-content: start; gap: 6px; padding: 2px 2px 0; text-shadow: 0 1px 0 #05070a; }
.st .st-talk p { margin: 0; }
.st .st-who { display: flex; align-items: center; gap: 8px; min-height: 15px; font: 500 14px/1 var(--st-f-ui); letter-spacing: 0.18em; text-transform: uppercase; color: #c9d1d6; }
.st .st-who .st-ring { flex: none; width: 0.82em; height: 0.82em; border: 1px solid currentColor; border-radius: 50%; }
.st .st-who.is-empty .st-ring { display: none; }
.st .st-line { max-width: 62ch; font: 400 20px/1.36 var(--st-f-text); color: #e4e4e0; text-wrap: balance; }
.st .st-line.is-note { max-width: 86ch; font: 400 15px/1.6 var(--st-f-num); color: #8b8d90; }
.st .st-buttons { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 30px; min-height: 36px; padding: 0 2px; }
.st .st-btn { display: inline-flex; align-items: baseline; gap: 9px; padding: 6px 0; border: 0; background: none; color: #e4e4e0; font: 400 18px/1.25 var(--st-f-text); letter-spacing: 0.01em; text-shadow: 0 1px 0 #05070a; white-space: nowrap; cursor: pointer; user-select: none; transition: color 140ms var(--st-ease), transform 140ms var(--st-ease); }
.st .st-btn::before { content: '\\203A'; font: 400 15px/1 var(--st-f-num); color: #5a6168; transition: color 140ms var(--st-ease); }
.st .st-btn.is-primary::before { color: #f08c2e; }
.st .st-btn.is-quiet { color: #8b8d90; }
.st .st-btn:hover:not([disabled]), .st .st-btn:focus-visible { color: #f08c2e; transform: translateX(3px); }
.st .st-btn:hover:not([disabled])::before, .st .st-btn:focus-visible::before { color: #f08c2e; }
.st .st-btn:focus-visible { outline: none; text-decoration: underline 1px; text-underline-offset: 5px; }
.st .st-btn:active:not([disabled]) { color: #ffc27a; transform: none; }
.st .st-btn[disabled] { color: #5a6168; cursor: default; }
.st .st-btn[disabled]::before { color: #33373e; }
@media (max-width: 640px) { .st .st-line { font-size: 17px; } .st .st-btn { font-size: 16px; } .st .st-dials { grid-template-columns: 1fr; } }
@media (prefers-reduced-motion: reduce) { .st .st-btn, .st .st-btn::before, .tune-timer i { transition: none; } }`;

    function addStyle() {
        if (document.getElementById(STYLE_ID)) return;
        const el = document.createElement('style'); el.id = STYLE_ID; el.textContent = STYLE;
        document.head.appendChild(el);
    }

    /** Scale the picture to fit the window: whole device pixels per art pixel when that costs little room, so every dither dot is the same size. */
    function fitCanvas(overlay, canvas) {
        const frame = overlay.querySelector('.st-frame'), dpr = window.devicePixelRatio || 1;
        canvas.style.width = canvas.style.height = '';
        const chromeH = frame.offsetHeight - canvas.offsetHeight;
        const room = Math.max(0.25, Math.min(MAX_SCALE, (window.innerWidth - 2 * FIT_MARGIN) / canvas.width, (window.innerHeight - 2 * FIT_MARGIN - chromeH) / canvas.height));
        const crisp = Math.floor(room * dpr + 0.01) / dpr, scale = crisp >= room * CRISP_MIN_FILL ? crisp : room;
        canvas.style.width = `${canvas.width * scale}px`; canvas.style.height = `${canvas.height * scale}px`;
    }

    function overlayHtml(opts) {
        return `<div class="st-frame">
            <header class="st-head"><p class="st-kicker">DEEP SCAN</p><h2 class="st-title">${esc(opts.targetName)}</h2></header>
            <div class="st-screen">
                <canvas class="st-canvas" width="${AW}" height="${AH}" aria-label="The planet's wave and yours"></canvas>
                <p class="st-note">MATCH <b class="tune-match">0%</b></p>
                <div class="tune-timer" aria-hidden="true"><i></i></div>
            </div>
            <div class="st-dials">
                <label>PITCH<input type="range" class="tune-pitch" min="${PITCH.min}" max="${PITCH.max}" step="0.02"></label>
                <label>STRENGTH<input type="range" class="tune-strength" min="${STRENGTH.min}" max="${STRENGTH.max}" step="0.01"></label>
            </div>
            <div class="st-talk" aria-live="polite"><p class="st-who is-empty"><span class="st-ring" aria-hidden="true"></span><span class="st-name"></span></p><p class="st-line is-note">${esc(HINT)}</p></div>
            <div class="st-buttons">
                <button type="button" class="st-btn is-primary st-lock">Lock signal</button>
                <button type="button" class="st-btn is-quiet st-auto">Let A.U.R.A. tune it</button>
            </div>
        </div>`;
    }

    function play(opts) {
        return new Promise(resolve => {
            addStyle();
            const overlay = document.createElement('div');
            overlay.className = 'warp-plot signal-tune st';
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-label', 'Tune the scan');
            overlay.innerHTML = overlayHtml(opts);
            document.body.appendChild(overlay);

            const q = sel => overlay.querySelector(sel);
            const canvas = q('canvas'), ctx = canvas.getContext('2d');
            const img = ctx.createImageData(AW, AH);
            const view = { ctx, img, buf: new Uint32Array(img.data.buffer), bg: paintBackground(seedOf(opts.targetName)) };
            fitCanvas(overlay, canvas);
            const fitter = new ResizeObserver(() => fitCanvas(overlay, canvas)); fitter.observe(overlay);
            const pitchEl = q('.tune-pitch'), strengthEl = q('.tune-strength');
            const matchEl = q('.tune-match'), timerEl = q('.tune-timer i'), timerBox = q('.tune-timer');
            const lockBtn = q('.st-lock'), autoBtn = q('.st-auto');
            const talkEl = q('.st-talk'), whoEl = q('.st-who'), nameEl = q('.st-name'), lineEl = q('.st-line');
            const depth = (opts.sector || 1) - 1, startedAt = performance.now();
            const basePitch = PITCH.min + 0.6 + Math.random() * (PITCH.max - PITCH.min - 1.2);
            const s = {
                pitch: PITCH.min, strength: STRENGTH.min, match: 0, isDone: false,
                targetPitch: basePitch, targetStrength: STRENGTH.min + 0.15 + Math.random() * (STRENGTH.max - STRENGTH.min - 0.15),
                drift: BASE_DRIFT + DRIFT_PER_SECTOR * depth, jitter: depth * 1.2,
            };
            pitchEl.value = s.pitch; strengthEl.value = s.strength;
            let raf = 0;

            /** How it went, under the picture (LanderGame's voice line): the label in its ink over the effect. */
            function say(label, words, color) {
                talkEl.style.minHeight = `${talkEl.offsetHeight}px`;     // keep the frame still: the hint was the taller text
                nameEl.textContent = label; whoEl.classList.remove('is-empty'); whoEl.style.color = color;
                lineEl.textContent = words; lineEl.classList.remove('is-note');
            }

            function finish(match, isAuto) {
                if (s.isDone) return;
                s.isDone = true;
                (window.FrameClock ? window.FrameClock.cancel : cancelAnimationFrame)(raf);
                const grade = isAuto ? 'fair' : gradeOf(match), info = GRADES[grade];
                const effect = (opts.effects && opts.effects[grade]) || info.effect;
                sfx(grade === 'sharp' ? 'sfxDiscovery' : grade === 'weak' ? 'sfxError' : 'sfxScan');
                [pitchEl, strengthEl, lockBtn, autoBtn].forEach(el => { el.disabled = true; });
                say(isAuto ? AUTO_LABEL : info.label, effect, info.color);
                setTimeout(() => {
                    overlay.classList.add('is-leaving');
                    setTimeout(() => { fitter.disconnect(); overlay.remove(); resolve({ match, grade, auto: isAuto }); }, LEAVE_MS);
                }, RESULT_HOLD_MS);
            }

            function frame(now) {
                const elapsed = now - startedAt, left = Math.max(0, 1 - elapsed / TIME_LIMIT_MS);
                s.targetPitch = basePitch + Math.sin(elapsed / 2300) * s.drift; // the signal wanders
                s.pitch = +pitchEl.value; s.strength = +strengthEl.value;
                s.match = matchOf(s);
                matchEl.textContent = Math.round(s.match * 100) + '%';
                matchEl.className = 'tune-match' + (s.match >= SHARP_AT ? ' is-warm' : s.match < WEAK_BELOW ? ' is-danger' : '');
                timerEl.style.transform = `scaleX(${left})`;
                timerBox.classList.toggle('is-low', left < 0.3);
                draw(view, s, now);
                if (left === 0) { finish(s.match, false); return; } // signal faded: you get whatever you had
                raf = (window.FrameClock ? window.FrameClock.request : requestAnimationFrame)(frame);
            }

            lockBtn.addEventListener('click', () => finish(s.match, false));
            autoBtn.addEventListener('click', () => finish(AUTO_MATCH, true));
            pitchEl.focus();
            raf = (window.FrameClock ? window.FrameClock.request : requestAnimationFrame)(frame);
        });
    }

    window.SignalTune = { play };
})();
