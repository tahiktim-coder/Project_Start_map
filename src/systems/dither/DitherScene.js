/* DitherScene — the parts of dither mode that aren't celestial bodies:
   a baked nebula + starfield backdrop, crew portraits pushed through a colour dither pass,
   and the DOM observer that hydrates whatever the views inject. */

(function () {
    'use strict';
    const Core = window.DitherCore;
    if (!Core || !Core.isOn) return;

    const { fbm, rng, ramp, quantize, posterize } = Core;
    const BACKDROP_PX = 2;
    const STAR_DENSITY = 1 / 1400;      // stars per buffer pixel
    const BRIGHT_STAR_SHARE = 0.06;     // fraction drawn as a 5-pixel cross
    const BACKDROP_EVERY = 4;           // twinkle on every 4th clock tick (~2fps)
    // nebula stays under ~12% luminance so UI text on top of it never loses contrast
    const NEBULA_RAMP = ramp('#06070a', '#0b0d16', '#121225', '#1b1630', '#241a38');
    const STAR_TINTS = [[233, 230, 217], [233, 230, 217], [170, 200, 245], [245, 205, 150]];
    const PORTRAIT_CROP = 0.78;         // fraction of the source kept, centred
    const PORTRAIT_LEVELS = 5;          // colour steps per channel
    const PORTRAIT_SELECTOR = 'img[src*="assets/crew/"]:not([data-dithered])';

    // ── backdrop: dark dithered nebula baked once, stars re-stamped on the twinkle tick ──
    const backdrop = document.createElement('canvas');
    backdrop.id = 'dither-backdrop';
    backdrop.setAttribute('aria-hidden', 'true');
    document.body.insertBefore(backdrop, document.body.firstChild);
    let scene = null;

    function bakeBackdrop() {
        const w = Math.max(80, Math.floor(window.innerWidth / BACKDROP_PX));
        const h = Math.max(45, Math.floor(window.innerHeight / BACKDROP_PX));
        backdrop.width = w; backdrop.height = h;
        const ctx = backdrop.getContext('2d'), img = ctx.createImageData(w, h);
        const gray = new Float32Array(w * h), r = rng(9001), stars = [];
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            const cloud = fbm(x * 0.006 + fbm(x * 0.003, y * 0.003, 2) * 2, y * 0.008, 5);
            gray[y * w + x] = Math.max(0, cloud - 0.38) * 1.7;
        }
        quantize(img, w, h, gray, null, null, { ramp: NEBULA_RAMP, contrast: 1 });
        for (let k = 0; k < Math.round(w * h * STAR_DENSITY); k++) {
            stars.push({
                x: 1 + Math.floor(r() * (w - 2)), y: 1 + Math.floor(r() * (h - 2)),
                b: 0.3 + r() * 0.7, tint: STAR_TINTS[Math.floor(r() * STAR_TINTS.length)], big: r() < BRIGHT_STAR_SHARE,
            });
        }
        scene = { w, h, ctx, img, base: new Uint8ClampedArray(img.data), stars };
        paintBackdrop(0);
    }

    function stamp(d, w, x, y, tint, k) {
        const o = (y * w + x) * 4;
        d[o] = tint[0] * k; d[o + 1] = tint[1] * k; d[o + 2] = tint[2] * k;
    }

    function paintBackdrop(now) {
        const s = scene, d = s.img.data;
        d.set(s.base);
        s.stars.forEach(st => {
            const k = st.b * (0.75 + 0.25 * Math.sin(now * 0.0007 + st.b * 37));
            stamp(d, s.w, st.x, st.y, st.tint, k);
            if (!st.big) return;
            stamp(d, s.w, st.x - 1, st.y, st.tint, k * 0.45); stamp(d, s.w, st.x + 1, st.y, st.tint, k * 0.45);
            stamp(d, s.w, st.x, st.y - 1, st.tint, k * 0.45); stamp(d, s.w, st.x, st.y + 1, st.tint, k * 0.45);
        });
        s.ctx.putImageData(s.img, 0, 0);
    }

    // ── crew portraits: keep their colours, add the same dither grain ──
    const portraitCache = new Map();    // "src|px" → data URL
    let warnedTainted = false;

    function ditherPortrait(source, px) {
        const c = document.createElement('canvas');
        c.width = px; c.height = px;
        const ctx = c.getContext('2d');
        // crop in on the face: at ~40px every pixel spent on helmet and background is wasted
        const sw = source.naturalWidth * PORTRAIT_CROP, sh = source.naturalHeight * PORTRAIT_CROP;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(source, (source.naturalWidth - sw) / 2, (source.naturalHeight - sh) / 2, sw, sh, 0, 0, px, px);
        const img = ctx.getImageData(0, 0, px, px);
        posterize(img, px, px, PORTRAIT_LEVELS);
        ctx.putImageData(img, 0, 0);
        return c.toDataURL();
    }

    function hydratePortrait(el) {
        el.dataset.dithered = '1';
        const shown = Math.round(el.getBoundingClientRect().width) || el.width || 64;
        const px = Math.max(32, shown >= 160 ? Math.round(shown / 2) : shown);
        const src = el.getAttribute('src'), key = src + '|' + px;
        const apply = url => { el.src = url; };
        if (portraitCache.has(key)) { apply(portraitCache.get(key)); return; }
        const loader = new Image();
        loader.onload = () => {
            try {
                const url = ditherPortrait(loader, px);
                portraitCache.set(key, url);
                apply(url);
            } catch (err) {
                if (!warnedTainted) console.warn('[DitherScene] portrait left un-dithered (serve over http, not file://):', err.message);
                warnedTainted = true;
            }
        };
        loader.onerror = () => console.warn('[DitherScene] portrait failed to load:', src);
        loader.src = src;
    }

    // ── hydrate whatever the views inject ──
    let queued = false;
    function hydrateAll() {
        queued = false;
        if (window.DitherBodies) window.DitherBodies.hydrate(document);
        document.querySelectorAll(PORTRAIT_SELECTOR).forEach(hydratePortrait);
    }
    new MutationObserver(() => {
        if (queued) return;
        queued = true;
        queueMicrotask(hydrateAll); // before paint, so a re-rendered view never shows a blank canvas
    }).observe(document.body, { childList: true, subtree: true });

    let resizeTimer = 0, tick = 0;
    window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(bakeBackdrop, 150); });
    Core.onTick(now => { if (scene && ++tick % BACKDROP_EVERY === 0) paintBackdrop(now); });

    bakeBackdrop();
    hydrateAll();
})();
