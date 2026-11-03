/* ═══ Silent Exodus · new screen (?new=1) · cards/FramePictures.js: the frame's picture ═════════════════════════════════
   What it is: the 480 x 160 picture at the top of every frame (cards/Frame.js), painted in the house style (docs/ART_STYLE.md)
   and kept moving at the art's 8 fps until the frame leaves.
     'scene'  SceneArt's own picture (cfg.art): the wreck, the colony, the ruins, an anomaly, the gap, Eden.
     'view'   the sky ahead in this sector's sky F (NSSky / NSSky2): the heading and the light on it. Every card without a
              scene gets at least this; 'world' and 'deck' (look pass B03) show it until their painters come.
              Options: focus 'light' (the light big, for the light and the last jump), signal (a call's carrier wave, a
              whole-pixel dithered trace in --loss across the lower band), blink (what the jump leaves behind, a warm point
              blinking at the left edge).
   A view's still part is painted once per sector and focus and cached; prewarm() paints it in an idle moment while a card
   waits its turn at EncounterCard's gate, so the frame opens on a picture that is already there.
   Loaded only when the new-screen switch is on, after art/Sky2.js and before cards/Frame.js.

   window.NSFramePics (frozen)
     W, H                       480, 160 (art px)
     mount(canvas, spec) → stop()   paints spec into canvas (480 x 160) and keeps it moving; stops by itself once the
                                    canvas has been on the page and left it
     prewarm(spec)              paints a view's still part in an idle moment (a scene needs nothing)
     specOf(spec, state)        the spec as it will be painted: { kind: 'scene' | 'view', art, sector, focus, signal, blink }
*/
(function () {
    'use strict';
    if (!window.NEW_SCREEN) return;
    const W = 480, H = 160, TICK_MS = 125, NEVER_ATTACHED_MS = 5000;
    const LOSS = '#ff5468';                                   // the call's wave: --loss (tokens.css), drawn in whole art pixels
    const WARM = ['#4a2e12', '#e9a25e', '#fff3dc'];           // the point that blinks at the edge: RP.SUN's own steps
    const cache = new Map();                                  // 'view:<sector>:<focus>' → { canvas, sky }

    const P = () => window.NSPaint || null;
    const SKY = () => window.NSSky || null;

    /** What will be painted: a scene SceneArt knows, else the view (a 'world' or 'deck' asked for before B03 has its painter). */
    function specOf(spec, state) {
        const s = spec || {}, SA = window.SceneArt;
        if (s.kind === 'scene' && s.art && SA && SA.has(s.art)) return { kind: 'scene', art: s.art };
        const sector = Math.max(1, Math.min(6, Number(s.sector) || Number(state && state.currentSector) || 1));
        return { kind: 'view', sector, focus: s.focus === 'light' ? 'light' : 'heading', signal: !!s.signal, blink: !!s.blink };
    }
    const keyOf = v => `view:${v.sector}:${v.focus}`;

    /** The still part of a view: sector n's sky F, the dust and stars over it, and the light on the heading. */
    function paintView(v) {
        const k = keyOf(v);
        if (cache.has(k)) return cache.get(k);
        const p = P();
        if (!p) return null;
        const big = v.focus === 'light';
        const lx = Math.round(W * (big ? 0.62 : 0.74)), ly = Math.round(H * (big ? 0.5 : 0.44));
        const ox = lx - 320, oy = ly - 180;                                       // the 640 x 360 stage with its light on ours
        let sky = null;
        try { sky = SKY() ? SKY().build(W, H, ox, oy, v.sector, [320, 180]) : null; } catch (err) { console.warn('NSFramePics: no sky F for the view', err); }
        const pt = p.painter(W, H, true), strip = p.spaceStrip(W + 4, H, 61 + v.sector * 7, 0.5, sky ? sky.haze : 1, 1);
        const lit = new Float32Array(W * H);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) lit[y * W + x] = Math.exp(-Math.hypot(x - lx, (y - ly) * 1.15) / (big ? 90 : 60));
        const keep = (x, y) => Math.hypot(x - lx, y - ly) < (big ? 22 : 10);
        if (sky && SKY().paintSpace) SKY().paintSpace(pt, strip, 0, lit, keep, sky, 0); else p.paintSpace(pt, strip, 0, lit, keep);
        p.lightGlow(pt, lx, ly, big ? { core: 5, halo: 24, strength: 1, spikes: 7 } : { core: 1.6, halo: 9, strength: 0.9, spikes: 3 });
        const out = { canvas: pt.canvas(), sky, light: [lx, ly] };
        cache.set(k, out);
        return out;
    }

    /** A call's carrier wave: steady at the left, breaking up to the right, one art pixel wide, in the lower band. */
    function drawWave(ctx, t) {
        const p = P(), phase = Math.floor(t / TICK_MS) * 0.55, base = H - 26;
        ctx.fillStyle = LOSS;
        for (let x = 6; x < W - 6; x++) {
            const decay = x / W;
            const y = Math.round(base + Math.sin(x * 0.09 + phase) * 7 * (1 - decay * 0.45) + Math.sin(x * 0.31 + phase * 1.7) * 2 * decay);
            if (p && p.threshold(x, y + Math.floor(t / TICK_MS)) < decay * 0.8) continue;   // the dropouts grow, in the house dither
            ctx.fillRect(x, y, 1, 1);
        }
    }
    /** What the jump leaves behind: a warm point at the left edge, on two steps of eight. */
    function drawBlink(ctx, t) {
        if (Math.floor(t / TICK_MS) % 8 >= 2) return;
        const x = 18, y = Math.round(H * 0.56);
        ctx.fillStyle = WARM[0]; ctx.fillRect(x - 2, y, 5, 1); ctx.fillRect(x, y - 2, 1, 5);
        ctx.fillStyle = WARM[1]; ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3);
        ctx.fillStyle = WARM[2]; ctx.fillRect(x, y, 1, 1);
    }

    /** Draws and animates until the frame closes (the canvas may be attached after this is called). */
    function mount(canvas, spec) {
        const ctx = canvas && canvas.getContext && canvas.getContext('2d');
        if (!ctx) return () => {};
        const s = specOf(spec, window.app && window.app.state);
        if (s.kind === 'scene') { window.SceneArt.mount(canvas, s.art); return () => {}; }
        let view = null;
        try { view = paintView(s); } catch (err) { console.error('NSFramePics: the view could not be painted', err); }
        const startedAt = performance.now();
        let wasAttached = false, timer = 0;
        const stop = () => { clearInterval(timer); timer = 0; };
        const step = () => {
            const t = performance.now() - startedAt;
            if (canvas.isConnected) wasAttached = true;
            else if (wasAttached || t > NEVER_ATTACHED_MS) { stop(); return; }
            try {
                if (view) ctx.drawImage(view.canvas, 0, 0); else { ctx.fillStyle = '#05070a'; ctx.fillRect(0, 0, W, H); }
                if (view && view.sky && typeof view.sky.live === 'function') view.sky.live(ctx, t, 0);
                if (s.signal) drawWave(ctx, t);
                if (s.blink) drawBlink(ctx, t);
            } catch (err) { stop(); console.error('NSFramePics: a frame of the view failed', err); }
        };
        timer = setInterval(step, TICK_MS);
        step();
        return stop;
    }

    /** A view's still part painted ahead, in an idle moment (a card waiting at the gate). */
    function prewarm(spec) {
        const s = specOf(spec, window.app && window.app.state);
        if (s.kind !== 'view' || cache.has(keyOf(s))) return;
        const later = window.requestIdleCallback ? fn => window.requestIdleCallback(fn, { timeout: 800 }) : fn => setTimeout(fn, 60);
        later(() => { try { paintView(s); } catch (err) { console.warn('NSFramePics: prewarm failed', err); } });
    }

    window.NSFramePics = Object.freeze({ W, H, mount, prewarm, specOf });
})();
