/* ═══ Silent Exodus · new screen (?new=1) · start/Title.js: the title screen in the new look ═══════════════════════════
   What it is: the first screen of the game under the switch (docs/BUILD_B.md §6). The dark field of space, the far warm
   light low on the right (sector 1's size), our Lander small with its nose on the light and its plume burning, the name
   "Silent Exodus", the one line under it, CONTINUE and NEW GAME as words, the save's line, "Erase the saved run?" lower
   down when there is a save, and the sound line. No ringed planet, no green, no boxes.
   The markup keeps today's ids (btn-continue-game, btn-start-game, erase-confirm, btn-erase-yes, btn-erase-keep,
   audio-status, btn-toggle-audio), so bundle.js's own title logic (save, erase, sound) runs unchanged; the sound line's
   words are kept plain here ("Sound on" / "turn it off") whatever bundle writes into them.
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
    const MIN_ART_ROWS = 540, TICK = 125, RESIZE_MS = 150;
    const SKY = { seed: 11, dust: 0.12, haze: 1, stars: 1 };                                   // sector 1's field (travel/SectorLooks.js)
    const LIGHT = { u: 0.84, v: 0.7, core: 2, halo: 14, strength: 1, spikes: 5 };            // sector 1's light, at the 360-row scale
    const SHIP = { u: 0.6, v: 0.47, len: 0.07 };                                               // our Lander: small, far from the words

    const CSS = `
#start-menu.ns-title { position: fixed; inset: 0; z-index: 10000; overflow: hidden; background: #05070a; color: #e4e4e0;
    --ink: #05070a; --text: #e4e4e0; --dim: #8b8d90; --ui: #c9d1d6; --warm: #f08c2e; --warm-br: #ffc27a; --danger: #ff5468;
    --f-ui: 'IBM Plex Sans Condensed', 'Arial Narrow', sans-serif; --f-text: 'IBM Plex Sans', system-ui, sans-serif; --f-num: 'IBM Plex Mono', ui-monospace, Consolas, monospace;
    font: 400 15px/1.4 var(--f-text); -webkit-font-smoothing: antialiased; user-select: none; -webkit-user-select: none;
    animation: ns-title-in 1.2s cubic-bezier(0.2, 0.7, 0.2, 1) both; }
@keyframes ns-title-in { from { opacity: 0; } }
#start-menu.ns-title p { margin: 0; }
#start-menu.ns-title .ns-title-art { position: absolute; left: 0; top: 0; display: block; image-rendering: pixelated; image-rendering: crisp-edges; }
#start-menu.ns-title .ns-title-block { position: absolute; left: clamp(32px, 8vw, 160px); top: 50%; transform: translateY(-50%); width: min(42vw, 640px);
    display: grid; justify-items: start; text-shadow: 0 1px 0 #05070a; }
#start-menu.ns-title .ns-title-name { margin: 0; font: 600 clamp(56px, 5.4vw, 104px)/0.95 var(--f-ui); letter-spacing: 0.04em; color: var(--text); white-space: nowrap; }
#start-menu.ns-title .ns-title-line { margin: 18px 0 0; font: 400 clamp(16px, 1.1vw, 21px)/1.4 var(--f-text); color: var(--ui); }
#start-menu.ns-title .ns-title-menu { margin: clamp(40px, 6vh, 72px) 0 0; display: grid; justify-items: start; gap: 4px; }
#start-menu.ns-title button { margin: 0; padding: 0; background: none; border: 0; color: inherit; font: inherit; cursor: pointer; text-align: left; }
#start-menu.ns-title .ns-title-word { position: relative; padding: 8px 0; font: 500 clamp(20px, 1.45vw, 28px)/1.1 var(--f-ui);
    letter-spacing: 0.2em; text-transform: uppercase; color: var(--text); transition: color 140ms ease, transform 140ms ease; }
#start-menu.ns-title .ns-title-word.is-quiet { font-size: clamp(16px, 1.1vw, 21px); color: var(--ui); }
#start-menu.ns-title .ns-title-word::before { content: ''; position: absolute; right: calc(100% + 0.5em); top: 50%; width: 0.6em; height: 1px; background: currentColor; opacity: 0; transition: opacity 140ms ease; }
#start-menu.ns-title .ns-title-word:hover, #start-menu.ns-title .ns-title-word:focus-visible { color: var(--warm); transform: translateX(4px); outline: none; }
#start-menu.ns-title .ns-title-word:hover::before, #start-menu.ns-title .ns-title-word:focus-visible::before { opacity: 1; }
#start-menu.ns-title .ns-title-word:active { color: var(--warm-br); }
#start-menu.ns-title .ns-title-save { margin: 0 0 14px; font: 400 14px/1.3 var(--f-num); color: var(--dim); }
#start-menu.ns-title .ns-title-erase { margin: 26px 0 0; display: grid; gap: 8px; }
#start-menu.ns-title .ns-title-erase p { font: 400 16px/1.3 var(--f-text); color: var(--text); }
#start-menu.ns-title .ns-title-erase div { display: flex; gap: 28px; }
#start-menu.ns-title .ns-title-small { padding: 4px 0; font: 500 15px/1.2 var(--f-ui); letter-spacing: 0.18em; text-transform: uppercase; color: var(--ui); transition: color 140ms ease; }
#start-menu.ns-title .ns-title-small:hover, #start-menu.ns-title .ns-title-small:focus-visible { color: var(--warm); outline: none; }
#start-menu.ns-title #btn-erase-yes:hover, #start-menu.ns-title #btn-erase-yes:focus-visible { color: var(--danger); }
#start-menu.ns-title .ns-title-sound { margin: clamp(28px, 4vh, 48px) 0 0; font: 400 13px/1.2 var(--f-num); color: var(--dim); }
#start-menu.ns-title #btn-toggle-audio { margin-left: 12px; padding: 2px 0; font: 400 13px/1.2 var(--f-num); letter-spacing: 0; color: var(--ui); border-bottom: 1px solid rgba(201, 209, 214, 0.35); }
#start-menu.ns-title #btn-toggle-audio:hover, #start-menu.ns-title #btn-toggle-audio:focus-visible { color: var(--warm); border-bottom-color: var(--warm); outline: none; }
@media (max-width: 900px) { #start-menu.ns-title .ns-title-block { width: calc(100vw - 64px); } }
@media (prefers-reduced-motion: reduce) { #start-menu.ns-title, #start-menu.ns-title .ns-title-word { animation: none; transition: none; } }
`;
    function injectCss() {
        if (document.getElementById('ns-title-css')) return;
        const s = document.createElement('style'); s.id = 'ns-title-css'; s.textContent = CSS; document.head.appendChild(s);
    }
    const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const soundWords = on => ({ status: on ? 'Sound on' : 'Sound off', button: on ? 'turn it off' : 'turn it on' });

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
                    ${hasSave ? `<button type="button" id="btn-continue-game" class="ns-title-word">Continue</button>
                    <p class="ns-title-save">${esc(saveLine)}</p>` : ''}
                    <button type="button" id="btn-start-game" class="ns-title-word${hasSave ? ' is-quiet' : ''}">New game</button>
                </div>
                ${hasSave ? `<div id="erase-confirm" class="ns-title-erase" style="visibility: hidden;">
                    <p>Erase the saved run?</p>
                    <div><button type="button" id="btn-erase-keep" class="ns-title-small">Keep it</button><button type="button" id="btn-erase-yes" class="ns-title-small">Erase</button></div>
                </div>` : ''}
                <p class="ns-title-sound"><span id="audio-status">${words.status}</span><button type="button" id="btn-toggle-audio">${words.button}</button></p>
            </div>`;
    }

    // ── the picture: painted once per size, then only the stars, the plume and the ports move (eight times a second) ──
    function measure() {
        const dpr = window.devicePixelRatio || 1, devW = Math.round(innerWidth * dpr), devH = Math.round(innerHeight * dpr);
        const k = Math.max(1, Math.floor(devH / MIN_ART_ROWS));
        return { dpr, k, W: Math.ceil(devW / k), H: Math.ceil(devH / k) };
    }
    function paint(G) {
        const sc = G.H / 360, LX = Math.round(G.W * LIGHT.u), LY = Math.round(G.H * LIGHT.v);
        const L = { core: LIGHT.core * sc, halo: LIGHT.halo * sc, strength: LIGHT.strength, spikes: LIGHT.spikes * sc };
        const strip = P.spaceStrip(G.W, G.H, SKY.seed, SKY.dust, SKY.haze, SKY.stars), lit = new Float32Array(G.W * G.H);
        for (let y = 0; y < G.H; y++) for (let x = 0; x < G.W; x++) lit[y * G.W + x] = Math.exp(-Math.hypot(x - LX, (y - LY) * 1.15) / (L.halo * 0.85 + 6));
        const p = P.painter(G.W, G.H, true), keep = L.halo * 0.9 + L.core + 8;
        const bright = P.paintSpace(p, strip, 0, lit, (x, y) => Math.hypot(x - LX, y - LY) < keep);
        P.lightGlow(p, LX, LY, L, 1);
        const len = Math.max(18, Math.round(SHIP.len * G.H)), x = Math.round(G.W * SHIP.u), y = Math.round(G.H * SHIP.v);
        return { canvas: p.canvas(), bright, ship: { x, y, len, angle: Math.atan2(LY - y, LX - x), sprite: landerSprite(len, Math.atan2(LY - y, LX - x)) } };
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
        if (!cv) return;
        const g = cv.getContext('2d', { alpha: false });
        let G = null, A = null, frameId = null, seen = false, resizeTimer = 0, t0 = performance.now(), lastStep = -1;
        function size() {
            G = measure();
            cv.width = G.W; cv.height = G.H;
            cv.style.width = (G.W * G.k / G.dpr) + 'px'; cv.style.height = (G.H * G.k / G.dpr) + 'px';
            g.imageSmoothingEnabled = false;
            try { A = paint(G); } catch (err) { A = null; console.error('NSTitle: the picture failed', err); }
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
