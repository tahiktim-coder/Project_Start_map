/* StructureVista — the screen where you are parked in front of the Structure is not "a body in a box":
   the whole panel is the picture. This mounts one low-resolution canvas that fills the panel and paints it with
   StructureArt.renderVista through the game's own ordered dither (DitherCore.quantize), on the shared 8 fps clock.
   mount(container) — re-measures when the panel changes size, lets go when the screen goes away. */

(function () {
    'use strict';
    const PIXEL = 2, MIN_SIDE = 40, RESIZE_SLACK = 2, FIRST_PAINT_RETRY_MS = 120, FIRST_PAINT_TRIES = 12;
    const Core = window.DitherCore, Art = window.StructureArt;
    if (!Core || !Art || typeof Art.renderVista !== 'function') return;

    const HELPERS = { vnoise: Core.vnoise, fbm: Core.fbm, ridge: Core.ridge, rng: Core.rng };
    const LOOK = { ramp: Core.ramp(...Art.look.ramp), accent: Art.look.accent };
    const SEED = 7;
    let active = null;                                                         // { container, canvas, view } — only one vista is ever on screen

    function buildView(canvas, w, h) {
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        return { w, h, cx: w / 2, cy: h / 2, seed: SEED, ctx, img: ctx.createImageData(w, h), gray: new Float32Array(w * h), acc: new Float32Array(w * h), mask: new Uint8Array(w * h) };
    }

    /** Paints one frame. Returns false while the panel has no size yet. */
    function paint(now) {
        if (!active) return false;
        if (active.container.isConnected) active.wasAttached = true;
        else { if (active.wasAttached) active = null; return false; }   // built first, attached afterwards: only let go once it has been on the page
        const w = Math.round(active.container.clientWidth / PIXEL), h = Math.round(active.container.clientHeight / PIXEL);
        if (w < MIN_SIDE || h < MIN_SIDE) return false;
        let view = active.view;
        if (!view || Math.abs(view.w - w) > RESIZE_SLACK || Math.abs(view.h - h) > RESIZE_SLACK) view = active.view = buildView(active.canvas, w, h);
        view.gray.fill(0); view.acc.fill(0); view.mask.fill(0);
        Art.renderVista(view, now, HELPERS);
        Core.quantize(view.img, view.w, view.h, view.gray, view.acc, view.mask, LOOK);
        view.ctx.putImageData(view.img, 0, 0);
        return true;
    }

    Core.onTick(paint);                                                        // one listener for the life of the page

    function mount(container) {
        if (!container) return;
        container.querySelectorAll('.structure-vista').forEach(old => old.remove());
        const canvas = document.createElement('canvas');
        canvas.className = 'structure-vista';
        canvas.setAttribute('role', 'img');
        canvas.setAttribute('aria-label', 'The Structure: a black slab with one lit edge, far too large, with rings turning round it');
        container.appendChild(canvas);
        active = { container, canvas, view: null, wasAttached: false };
        // The shared clock does not run under "reduce motion" (or in a hidden tab), so make sure one still frame always lands
        let tries = 0;
        const first = () => { if (active && active.canvas === canvas && !paint(performance.now()) && ++tries < FIRST_PAINT_TRIES) setTimeout(first, FIRST_PAINT_RETRY_MS); };
        first();
    }

    window.StructureVista = { mount };
})();
