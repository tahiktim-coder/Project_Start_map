/* ═══ Silent Exodus · new screen (?new=1) · start/Title.js: the title screen in the new look ═══════════════════════════
   What it is: the first screen of the game under the switch (docs/BUILD_B.md §6). The dark field of space, the far warm
   light low on the right (sector 1's size), our Lander small with its nose on the light and its plume burning, the name
   "Silent Exodus", the one line under it, the way on as the framed warm keycap ("› New game", or "› Continue" when there is
   a save: the dock cut's key, C07), the save's line, "New game" as a quiet word under it, "Erase the saved run?" lower
   down when there is a save, and the sound line. No ringed planet, no green, no boxes.
   Look pass B11: every colour, face and size from tokens.css (no copy here); the menu is one family, the frame key's
   (.mini-btn, minigames.css, read through its --mg-* names as the endings do); pointing at or focusing a quiet word hangs
   a warm "›" left of it, so the word never moves; the sound line is one style (Plex Mono 14: "Sound off · turn on", the
   toggle underlined warm only while pointed at or focused); the house dither darkens the sky behind the words (ink about
   70 %, gone by 45 % of the width) and no star is painted inside a line of words; the stepped fade-in waits for the Plex
   faces (document.fonts), so its first frame is never the fallback face.
   The markup keeps today's ids (btn-continue-game, btn-start-game, erase-confirm, btn-erase-yes, btn-erase-keep,
   audio-status, btn-toggle-audio), so bundle.js's own title logic (save, erase, sound) runs unchanged; the sound line's
   words are kept plain here ("Sound on · turn off") whatever bundle writes into them.
   Source: the picture recipes of art/Paint.js (spaceStrip, paintSpace, lightGlow, hull + shapeL) as travel draws them
   (travel/Pictures.js lander, travel/SectorLooks.js sector 1); words in the slice's type (IBM Plex). No URL reads.
   Loaded only when the new-screen switch is on. Needs NSPaint.

   window.NSTitle (frozen)
     markup({ hasSave, saveInfo: { sector, crew }, soundLabel, audioIsOn }) → the overlay's inner HTML
     mount(overlay)          bundle calls it right after appendChild: it styles the overlay (class ns-title), paints the
                             picture and runs its stepped motion until the overlay leaves the page
*/
(function () {
    'use strict';
    const P = window.NSPaint;
    if (!window.NEW_SCREEN || !P) return;
    const { RP, hash } = P;
    const MIN_ART_ROWS = 540, TICK = 125, RESIZE_MS = 150, FONT_WAIT_MS = 1200;
    const SHADE = { ink: 0.7, end: 0.45, flat: 0.4 };                                         // the dither behind the words: ink share, gone at 45 % of the width, flat for the first 40 % of that
    const TITLE_FACES = ["600 64px 'IBM Plex Sans Condensed'", "400 18px 'IBM Plex Sans'", "400 14px 'IBM Plex Mono'"];   // the faces the title draws with
    const SKY = { seed: 11, dust: 0.12, haze: 1, stars: 1 };                                   // sector 1's field (travel/SectorLooks.js)
    const LIGHT = { u: 0.84, v: 0.7, core: 2, halo: 14, strength: 1, spikes: 5 };            // sector 1's light, at the 360-row scale
    const SHIP = { u: 0.6, v: 0.47, len: 0.07 };                                               // our Lander: small, far from the words

    const CSS = `
#start-menu.ns-title { position: fixed; inset: 0; z-index: 10000; overflow: hidden; background: var(--ink); color: var(--text);
    --mg-words: var(--text); --mg-quiet: var(--ui); --mg-faint: var(--faint); --mg-amber: var(--warm); --mg-amber-br: var(--warm-br);
    --mg-f-text: var(--f-text); --mg-f-num: var(--f-num); --mg-shadow: var(--shadow); --mg-ease: var(--ease);   /* the frame key (.mini-btn) reads these */
    font: 400 var(--fs-prev)/1.4 var(--f-text); -webkit-font-smoothing: antialiased; user-select: none; -webkit-user-select: none;
    opacity: 0; transition-timing-function: steps(8, end) !important; }   /* hidden until the faces are in; bundle.js's fade out (1 s) steps too */
#start-menu.ns-title.is-in { opacity: 1; animation: ns-title-in 1.2s steps(8, end) backwards; }
@keyframes ns-title-in { from { opacity: 0; } }
#start-menu.ns-title p { margin: 0; }
#start-menu.ns-title .ns-title-art { position: absolute; left: 0; top: 0; display: block; image-rendering: pixelated; image-rendering: crisp-edges; }
#start-menu.ns-title .ns-title-block { position: absolute; left: clamp(32px, 8vw, 160px); top: 50%; transform: translateY(-50%); width: min(42vw, 640px);
    display: grid; justify-items: start; text-shadow: var(--shadow); }
#start-menu.ns-title .ns-title-name { margin: 0; font: 600 clamp(56px, 5.4vw, 104px)/0.95 var(--f-ui); letter-spacing: 0.04em; color: var(--text); white-space: nowrap; }
#start-menu.ns-title .ns-title-line { margin: var(--s4) 0 0; font: 400 clamp(16px, 1.1vw, 21px)/1.4 var(--f-text); color: var(--ui); }
#start-menu.ns-title .ns-title-menu { margin: clamp(40px, 6vh, 72px) 0 0; display: grid; justify-items: start; gap: var(--s2); }
#start-menu.ns-title :where(button:not(.mini-btn)) { margin: 0; padding: 0; background: none; border: 0; color: inherit; font: inherit; cursor: pointer; text-align: left; }
/* the menu: the frame key (.mini-btn) in one family, the way on framed warm (C07); pointing and focus look the same, the word never moves */
#start-menu.ns-title .mini-btn { margin: 0; font-size: var(--fs-key); transition-timing-function: steps(2, end); }
#start-menu.ns-title .mini-btn:hover, #start-menu.ns-title .mini-btn:focus-visible { color: var(--warm); transform: none; outline: none; text-decoration: none; }
#start-menu.ns-title .mini-btn:active { color: var(--warm-br); }
#start-menu.ns-title .mini-btn.is-primary { border-color: color-mix(in srgb, var(--warm) 55%, transparent); background: color-mix(in srgb, var(--warm) 8%, var(--ink)); }
#start-menu.ns-title .mini-btn.is-primary::before { color: var(--warm); }
#start-menu.ns-title .mini-btn.is-primary:hover, #start-menu.ns-title .mini-btn.is-primary:focus-visible { border-color: var(--warm); background: color-mix(in srgb, var(--warm) 16%, var(--ink)); }
#start-menu.ns-title .mini-btn:not(.is-primary) { position: relative; }   /* a quiet word: its warm › hangs left of it, only while pointed at or focused */
#start-menu.ns-title .mini-btn:not(.is-primary)::before { position: absolute; right: calc(100% + 0.45em); top: 50%; transform: translateY(-50%); color: var(--warm); visibility: hidden; }
#start-menu.ns-title .mini-btn:not(.is-primary):hover::before, #start-menu.ns-title .mini-btn:not(.is-primary):focus-visible::before { visibility: visible; }
#start-menu.ns-title #btn-erase-yes:hover, #start-menu.ns-title #btn-erase-yes:focus-visible, #start-menu.ns-title #btn-erase-yes:hover::before, #start-menu.ns-title #btn-erase-yes:focus-visible::before { color: var(--loss); }
#start-menu.ns-title .ns-title-save { margin: 0 0 var(--s3); font: 400 var(--fs-floor)/1.3 var(--f-num); color: var(--dim); }
#start-menu.ns-title .ns-title-erase { margin: var(--s6) 0 0; display: grid; gap: var(--s1); }
#start-menu.ns-title .ns-title-erase p { font: 400 var(--fs-prev)/1.3 var(--f-text); color: var(--text); }
#start-menu.ns-title .ns-title-erase div { display: flex; gap: var(--s8); }
#start-menu.ns-title .ns-title-sound { margin: clamp(28px, 4vh, 48px) 0 0; font: 400 var(--fs-floor)/1.2 var(--f-num); color: var(--dim); white-space: pre; }
#start-menu.ns-title #btn-toggle-audio { padding: 2px 0; font: 400 var(--fs-floor)/1.2 var(--f-num); color: var(--ui);
    text-decoration: underline 1px transparent; text-underline-offset: 4px; transition: color 120ms steps(2, end), text-decoration-color 120ms steps(2, end); }
#start-menu.ns-title #btn-toggle-audio:hover, #start-menu.ns-title #btn-toggle-audio:focus-visible { color: var(--text); text-decoration-color: var(--warm); outline: none; }
@media (max-width: 900px) { #start-menu.ns-title .ns-title-block { width: calc(100vw - 64px); } }
@media (prefers-reduced-motion: reduce) { #start-menu.ns-title.is-in { animation: none; } #start-menu.ns-title, #start-menu.ns-title .mini-btn, #start-menu.ns-title #btn-toggle-audio { transition: none !important; } }
`;
    function injectCss() {
        if (document.getElementById('ns-title-css')) return;
        const s = document.createElement('style'); s.id = 'ns-title-css'; s.textContent = CSS; document.head.appendChild(s);
    }
    const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const soundWords = on => ({ status: on ? 'Sound on' : 'Sound off', button: on ? 'turn off' : 'turn on' });   // DRAFT (look pass): "Sound off · turn on"

    function markup(o) {
        const opts = o || {}, hasSave = !!opts.hasSave, info = opts.saveInfo || {}, words = soundWords(opts.audioIsOn !== false);
        const crew = Number(info.crew), sector = Number(info.sector) || 1;
        const saveLine = `Sector ${sector}${Number.isFinite(crew) ? ` · ${crew} crew alive` : ''}`;
        return `
            <canvas class="ns-title-art" aria-hidden="true"></canvas>
            <div class="ns-title-block">
                <h1 class="ns-title-name">Silent Exodus</h1>
                <p class="ns-title-line">Eight went before you. None of them called home.</p>
                <div class="ns-title-menu">
                    ${hasSave ? `<button type="button" id="btn-continue-game" class="mini-btn is-primary">Continue</button>
                    <p class="ns-title-save">${esc(saveLine)}</p>` : ''}
                    <button type="button" id="btn-start-game" class="mini-btn${hasSave ? ' is-quiet' : ' is-primary'}">New game</button>
                </div>
                ${hasSave ? `<div id="erase-confirm" class="ns-title-erase" style="visibility: hidden;">
                    <p>Erase the saved run?</p>
                    <div><button type="button" id="btn-erase-keep" class="mini-btn is-quiet">Keep it</button><button type="button" id="btn-erase-yes" class="mini-btn is-quiet">Erase</button></div>
                </div>` : ''}
                <p class="ns-title-sound"><span id="audio-status">${words.status}</span><span aria-hidden="true"> · </span><button type="button" id="btn-toggle-audio">${words.button}</button></p>
            </div>`;
    }

    // ── the picture: painted once per size, then only the stars, the plume and the ports move (eight times a second) ──
    function measure() {
        const dpr = window.devicePixelRatio || 1, devW = Math.round(innerWidth * dpr), devH = Math.round(innerHeight * dpr);
        const k = Math.max(1, Math.floor(devH / MIN_ART_ROWS));
        return { dpr, k, W: Math.ceil(devW / k), H: Math.ceil(devH / k) };
    }
    /** The ink share of the dither behind the words at art column x (0..SHADE.ink): flat, then down to nothing at SHADE.end. */
    function shadeAt(G, x) {
        const end = G.W * SHADE.end, flat = end * SHADE.flat;
        return x >= end ? 0 : x <= flat ? SHADE.ink : SHADE.ink * (end - x) / (end - flat);
    }
    /** words: the lines of words (art px rects) no star may sit in. */
    function paint(G, words) {
        const sc = G.H / 360, LX = Math.round(G.W * LIGHT.u), LY = Math.round(G.H * LIGHT.v);
        const L = { core: LIGHT.core * sc, halo: LIGHT.halo * sc, strength: LIGHT.strength, spikes: LIGHT.spikes * sc };
        const strip = P.spaceStrip(G.W, G.H, SKY.seed, SKY.dust, SKY.haze, SKY.stars), lit = new Float32Array(G.W * G.H);
        for (let y = 0; y < G.H; y++) for (let x = 0; x < G.W; x++) lit[y * G.W + x] = Math.exp(-Math.hypot(x - LX, (y - LY) * 1.15) / (L.halo * 0.85 + 6));
        const p = P.painter(G.W, G.H, true), keep = L.halo * 0.9 + L.core + 8, rects = words || [];
        const inWords = (x, y) => rects.some(r => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1);
        const bright = P.paintSpace(p, strip, 0, lit, (x, y) => Math.hypot(x - LX, y - LY) < keep || inWords(x, y));
        P.lightGlow(p, LX, LY, L, 1);
        // the house dither behind the words: ink over a share of the pixels, in the 8 x 8 Bayer order
        const ink = P.hexRgb(P.INK), shaded = (x, y) => P.threshold(x, y) < shadeAt(G, x);
        for (let y = 0; y < G.H; y++) for (let x = 0; x < Math.ceil(G.W * SHADE.end); x++) {
            if (!shaded(x, y)) continue;
            const o = (y * G.W + x) * 4; p.data[o] = ink[0]; p.data[o + 1] = ink[1]; p.data[o + 2] = ink[2];
        }
        const len = Math.max(18, Math.round(SHIP.len * G.H)), x = Math.round(G.W * SHIP.u), y = Math.round(G.H * SHIP.v);
        return { canvas: p.canvas(), bright: bright.filter(s => !shaded(s.x, s.y)), ship: { x, y, len, angle: Math.atan2(LY - y, LX - x), sprite: landerSprite(len, Math.atan2(LY - y, LX - x)) } };
    }
    /** The lines of words now (CSS rects, a few px round them) in art px: no star is painted or twinkles inside them. */
    function wordRects(overlay, G) {
        const f = G.dpr / G.k, pad = 6;
        return [...overlay.querySelectorAll('.ns-title-block h1, .ns-title-block p, .ns-title-block button')].map(e => e.getBoundingClientRect()).filter(r => r.width && r.height)
            .map(r => ({ x0: Math.floor((r.left - pad) * f) - 1, y0: Math.floor((r.top - pad) * f) - 1, x1: Math.ceil((r.right + pad) * f) + 1, y1: Math.ceil((r.bottom + pad) * f) + 1 }));
    }
    /** The title's faces are in (or they never will be: blocked, or slow past FONT_WAIT_MS): its first frame is never the
        fallback. The font sheet comes first (index.html asks for it without holding the page up): until it is in, the Plex
        faces are not even declared, and asking for one would answer at once, with nothing. */
    function facesIn() {
        const F = document.fonts;
        if (!F || typeof F.load !== 'function') return Promise.resolve();
        const t0 = performance.now(), declared = () => { try { return [...F].some(f => /IBM Plex Sans Condensed/.test(f.family)); } catch (err) { return true; } };
        const sheet = new Promise(r => { (function poll() { if (declared() || performance.now() - t0 > FONT_WAIT_MS) r(); else setTimeout(poll, 50); })(); });
        const all = sheet.then(() => Promise.all(TITLE_FACES.map(f => F.load(f).catch(() => null)))).then(() => F.ready);
        return Promise.race([all, new Promise(r => setTimeout(r, FONT_WAIT_MS))]);
    }
    /** Our Lander from outside, lit by the light it flies toward (as travel/Pictures.js landerSprite). */
    function landerSprite(len, angle) {
        const deg = Math.round(angle * 90 / Math.PI) * 2, a = deg * Math.PI / 180, ht = Math.round(len / 3.15 * 10) / 10, half = Math.ceil(len / 2 + ht + 8);
        const p = P.painter(half * 2, half * 2, false);
        const at = P.hull(p, { x: half, y: half, len, ht, angle: a, flip: true, seed: 9, anchor: 0.5, sun: 0.24, sunDir: [Math.cos(angle), Math.sin(angle)], fade: 0.22, mirror: false, flat: true }, P.shapeL);
        const rel = q => [q[0] - half, q[1] - half];
        return { canvas: p.canvas(), half, ports: [0, 1, 2, 3, 4, 5].map(i => rel(at(P.DECK_U(i) + 0.054, -0.32))), bridge: rel(at(P.LANDER.NOSE - 0.02, -0.12)),
            bell: rel(at(1.0, 0)), skirt: [0.87, 0.89, 0.91, 0.93].map(u => rel(at(u, 0.6))) };
    }
    /** One step of the motion: the stars twinkle, the Lander drifts a pixel, the plume flickers, the ports breathe. */
    function frame(g, A, t) {
        g.drawImage(A.canvas, 0, 0);
        const f = P.framer(g, A.canvas.width, A.canvas.height), s = A.ship, sp = s.sprite, st = Math.floor(t / TICK);
        P.twinkle(f, A.bright, t);
        const cx = s.x + Math.round(Math.sin(t / 2300)), cy = s.y + Math.round(Math.sin(t / 3100 + 1) * 1.4), k = s.len / 48;
        const ca = Math.cos(s.angle), sa = Math.sin(s.angle), bx = cx + sp.bell[0], by = cy + sp.bell[1], fr = st % 4;
        for (let i = 0; i < 9; i++) { const age = ((t / 1000) * 0.8 + hash(i, 1, 57)) % 1, dist = (14 + age * 40) * k, side = (hash(i, 2, 57) - 0.5) * age * 9 * k; f.tone(bx - ca * dist - sa * side, by - sa * dist + ca * side, RP.PLUME, 0.5 * (1 - age)); }
        g.drawImage(sp.canvas, cx - sp.half, cy - sp.half);
        const flick = [1, 0.72, 1.16, 0.88][fr], hot = [1, 0.86, 1, 0.92][fr], len = 21 * k * flick, w0 = Math.max(1, 1.8 * k * 0.95);
        for (let d = 0; d < len; d++) { const hw = w0 * (1 - (d / len) * 0.6); for (let j = -Math.ceil(hw); j <= Math.ceil(hw); j++) { const u = Math.abs(j) / (hw + 0.01), v = (1 - d / len) ** 0.8 * (1 - u * u) * hot; if (v > 0.06) f.tone(bx - ca * d - sa * j, by - sa * d + ca * j, RP.PLUME, v); } }
        sp.skirt.forEach(([x, y], i) => { if ((i + fr) % 2 === 0) f.tone(cx + x, cy + y, RP.PLUME, 0.45); });
        const hi = Math.sin(t / 1100 * Math.PI * 2) > 0.2 ? 4 : 3;
        sp.ports.forEach(([px, py], i) => f.px(cx + px, cy + py, RP.AMBER.hex[i === 0 ? hi : hi - 1]));
        f.px(cx + sp.bridge[0], cy + sp.bridge[1], RP.AMBER.hex[hi]);
    }

    /** The sound line says the real state in plain words, whatever bundle.js writes into it ("♪ SOUND: ON", "TURN OFF"). */
    function keepSoundWords(overlay) {
        const status = overlay.querySelector('#audio-status'), btn = overlay.querySelector('#btn-toggle-audio');
        if (!status || !btn || typeof MutationObserver !== 'function') return null;
        const sync = () => {
            const w = soundWords(!!window.AudioSystem && !window.AudioSystem.muted);
            if (status.textContent !== w.status) status.textContent = w.status;
            if (btn.textContent !== w.button) btn.textContent = w.button;
        };
        const mo = new MutationObserver(sync);
        [status, btn].forEach(n => mo.observe(n, { childList: true, characterData: true, subtree: true }));
        sync();
        return mo;
    }

    function mount(overlay) {
        if (!overlay) return;
        injectCss();
        overlay.removeAttribute('style');                                                     // today's inline look (the green glow) goes
        overlay.classList.add('ns-title');
        const cv = overlay.querySelector('.ns-title-art');
        const mo = keepSoundWords(overlay);
        let shown = false;
        facesIn().then(() => {                                                                // the stepped fade-in, once the faces are in
            if (!overlay.isConnected || shown) return;
            shown = true;
            if (cv) size();                                                                   // the words' places in the true face: no star inside them
            overlay.classList.add('is-in');
        });
        if (!cv) return;
        const g = cv.getContext('2d', { alpha: false });
        let G = null, A = null, frameId = null, seen = false, resizeTimer = 0, t0 = performance.now(), lastStep = -1;
        function size() {
            G = measure();
            cv.width = G.W; cv.height = G.H;
            cv.style.width = (G.W * G.k / G.dpr) + 'px'; cv.style.height = (G.H * G.k / G.dpr) + 'px';
            g.imageSmoothingEnabled = false;
            try { A = paint(G, wordRects(overlay, G)); } catch (err) { A = null; console.error('NSTitle: the picture failed', err); }
            lastStep = -1;
        }
        const onResize = () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(size, RESIZE_MS); };
        function stop() {
            if (frameId != null) { (window.FrameClock ? window.FrameClock.cancel : cancelAnimationFrame)(frameId); frameId = null; }
            removeEventListener('resize', onResize);
            clearTimeout(resizeTimer);
            if (mo) mo.disconnect();
        }
        function loop(now) {
            frameId = null;
            if (overlay.isConnected) seen = true;
            else if (seen) { stop(); return; }                                                // it has left the page: the title is over
            const t = now - t0, step = Math.floor(t / TICK);
            if (A && step !== lastStep) { lastStep = step; try { frame(g, A, step * TICK); } catch (err) { console.error('NSTitle: a frame failed', err); A = null; } }
            frameId = window.FrameClock ? window.FrameClock.request(loop) : requestAnimationFrame(loop);
        }
        size();
        addEventListener('resize', onResize);
        frameId = window.FrameClock ? window.FrameClock.request(loop) : requestAnimationFrame(loop);
    }

    window.NSTitle = Object.freeze({ markup, mount });
})();
