/* ═══ Silent Exodus · play ideas · play-shade.js: the picture darkens under the words ═══════════════════════════════════════
   reading.css's rule: no boxes behind words; under them the picture darkens with the dither grain, in a few dithered steps
   (never a screen door). The slice and The Last Approach do it in their own frame buffers; Cloud Scoop and Twin Shadow
   call this once a frame, after the picture is drawn, so no star or speck of dust ever sits on a letter. (Eden's Walk is a
   bright day sky, where a box of shade reads as a panel: its sky darkens toward the words instead, in eden-walk-art.js.)
   PlayShade.under(ctx, W, H, px, elements, o): elements are DOM nodes (hidden or faded-out ones are skipped); px is screen px
   per art px; o (optional) { ox, oy } is where the canvas's top left sits on the page, { pad } the soft edge in art px.
   Needs NSPaint (the travel view's Paint.js) or its minigame copy, MiniPaint, for the ink and the Bayer grain. */
(function () {
    'use strict';
    const PAD = 10, STEPS = 6, FLOOR = 0.06, MAX = 0.9;          // art px of grain round the words; dithered steps; already dark; at most
    const paint = () => window.NSPaint || window.MiniPaint;      // looked up when used: MiniPaint is written in after MiniLab.js

    /** Is this element on screen right now (not hidden, not faded out)? */
    function isShown(el) {
        if (!el || el.hidden || el.closest('[hidden]')) return false;
        for (let e = el; e && e !== document.body; e = e.parentElement) if (+getComputedStyle(e).opacity < 0.05) return false;
        return true;
    }

    function under(ctx, W, H, px, elements, o = {}) {
        const P = paint();
        if (!P) return;
        const ink = P.hexRgb(P.INK), ox = o.ox || 0, oy = o.oy || 0, pad = o.pad || PAD;
        elements.forEach(el => {
            if (!isShown(el)) return;
            const r = el.getBoundingClientRect();
            if (r.width < 1 || r.height < 1) return;
            const fx0 = Math.floor((r.left - ox) / px) - pad, fx1 = Math.ceil((r.right - ox) / px) + pad;
            const fy0 = Math.floor((r.top - oy) / px) - pad, fy1 = Math.ceil((r.bottom - oy) / px) + pad;
            const x0 = Math.max(0, fx0), x1 = Math.min(W, fx1), y0 = Math.max(0, fy0), y1 = Math.min(H, fy1);
            if (x1 <= x0 || y1 <= y0) return;
            const img = ctx.getImageData(x0, y0, x1 - x0, y1 - y0), d = img.data, w = x1 - x0;
            for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
                const i = ((y - y0) * w + (x - x0)) * 4, lum = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) / 255;
                if (lum <= FLOOR) continue;                                   // already dark enough to read on
                const edge = Math.min(1, Math.min(x - fx0, fx1 - 1 - x, y - fy0, fy1 - 1 - y) / pad);
                const a = Math.min(MAX, (lum - FLOOR) * 3) * edge * edge, q = Math.min(1, Math.floor(a * STEPS + P.threshold(x, y)) / STEPS);
                if (q <= 0) continue;
                for (let k = 0; k < 3; k++) d[i + k] = Math.round(d[i + k] + (ink[k] - d[i + k]) * q);
            }
            ctx.putImageData(img, x0, y0);
        });
    }

    window.PlayShade = Object.freeze({ under, isShown });
})();
