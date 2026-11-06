/* ═══ Silent Exodus · new screen (?new=1) · stop/RoomFx.js: what happens to the bridge's room ═══════════════════════════
   What it is (look pass B07, out of stop/Stop.js): the room's own light states, drawn on the room layer only (before the
   crew), never on the glass: the world and the sun stay bright, and the crew carry no specks.
   - a broken deck: the bridge (or the lab under it) under an 8 x 8 Bayer --wash at about 25 %, 1.2 s on, 0.6 s off: added
     red light on a quarter of the room's pixels (the wash at 40 %), so the room keeps its shapes and the words their ground;
   - engineering down: the room and its lamps brown out for 160 ms every 2.9 s, an ink dither (never a flat veil);
   - the hull hit ('hull:hit'): the lamps dip twice (reduced motion: once) the same way, and the bridge jolts (up to 4 art
     px, easing out over 520 ms); the words on the glass, the voice line and its shade move with the room (follow);
   - beside the bridge: the space outside our hull on a wider window; at a whole scale that leaves a margin all round
     (NewScreen G.bkSnap: 2x at 1366), the hull's own colour.
   Loaded only when the new-screen switch is on, after stop/Dive.js and before stop/Stop.js.

   window.NSRoomFx (frozen)
     create({ room, deck, OFFX, H }) → fx    room: NSBridgeArt.paint()'s; deck: the lab under it (a canvas); H: the bridge's rows
       fx.damage(c, t, decks)    the washes and the brown-out (decks: NewScreen.game.decks())
       fx.hit(t)                 the strike came now;  fx.dip(c, t)  the lamps dip;  fx.shake(t) → [dx, dy] art px
     follow(dx, dy)              the word layers move with the room, CSS px (0, 0: back in place)
     margins(bctx, geo, t, j)    beside the bridge (geo: Stop.js's, j: how many of the 8 dissolve steps show)
     sides(c, t)                 the drifting stars at the frame's own edges (under the room)
     dissolve(j) → canvas        the bridge's Bayer dissolve: step j shows (j + 1) / 8 of the pixels
*/
(function () {
    'use strict';
    const NS = window.NewScreen, P = window.NSPaint, A = window.ShipArt, D = window.NSDive;
    if (!NS || !NS.on || !P || !A || !D) return;
    const { INK, RP, threshold } = P, SW = 640, SH = 360, STEPS = D.STEPS;
    const WASH = 0.25, WASH_LIGHT = 0.4, WASH_ON = 1200, WASH_CYCLE = 1800;   // the red wash: 25 % of the room's pixels, --wash at 40 % added; 1.2 s on, 0.6 s off
    const BROWN = 0.5, BROWN_EVERY = 2900, BROWN_MS = 160;                // engineering down: half the room's pixels to ink, a moment every 2.9 s
    const HIT = { shake: 4, shakeMs: 520, dips: [[0, 120], [210, 300]], dark: 0.55 };   // the hull hit: the jolt, the lamps' two dips
    const HULL = RP.HULL.hex[1];                                          // round the bridge at a whole scale: our hull
    const isReduced = () => { const J = window.Juice; try { return !!(J && typeof J.reduced === 'function' && J.reduced()); } catch (err) { return false; } };
    const token = (name, or) => { try { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || or; } catch (err) { return or; } };

    /** A frame-size mask: where the sources have a pixel and the Bayer threshold is under k, the colour hex. */
    function mask(sources, k, hex) {
        const cv = document.createElement('canvas'); cv.width = SW; cv.height = SH;
        const g = cv.getContext('2d'), img = g.createImageData(SW, SH), [r, gg, b] = P.hexRgb(hex);
        sources.forEach(({ src, x0, y0 }) => {
            if (!src || !src.width) return;
            let d;
            try {                                                         // read through a copy made for reading (the room's own canvas is drawn every frame)
                const cp = document.createElement('canvas'); cp.width = src.width; cp.height = src.height;
                const cg = cp.getContext('2d', { willReadFrequently: true }); cg.drawImage(src, 0, 0);
                d = cg.getImageData(0, 0, src.width, src.height).data;
            } catch (err) { console.error('NSRoomFx: a room mask failed', err); return; }
            for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) {
                const X = x + x0, Y = y + y0;
                if (X < 0 || Y < 0 || X >= SW || Y >= SH || !d[(y * src.width + x) * 4 + 3] || threshold(X, Y) >= k) continue;
                const o = (Y * SW + X) * 4; img.data[o] = r; img.data[o + 1] = gg; img.data[o + 2] = b; img.data[o + 3] = 255;
            }
        });
        g.putImageData(img, 0, 0);
        return cv;
    }

    function create(o) {
        const bridge = { src: o.room && o.room.canvas, x0: o.OFFX, y0: 0 }, lab = { src: o.deck, x0: 0, y0: o.H };
        let m = null, hitAt = -1e9;
        function masks() {
            if (!m) {
                const w = P.hexRgb(token('--wash', '#d4402c')), wash = '#' + w.map(v => Math.round(v * WASH_LIGHT).toString(16).padStart(2, '0')).join('');
                m = { bridge: mask([bridge], WASH, wash), lab: mask([lab], WASH, wash), brown: mask([bridge, lab], BROWN, INK), dip: mask([bridge, lab], HIT.dark, INK) };
            }
            return m;
        }
        function damage(c, t, d) {
            if (!d) return;
            const on = t % WASH_CYCLE < WASH_ON;
            c.save(); c.globalCompositeOperation = 'lighter';                 // added red light: the room's own shapes stay
            if (d.bridge === 'red' && on) c.drawImage(masks().bridge, 0, 0);
            if (d.lab === 'red' && on) c.drawImage(masks().lab, 0, 0);
            c.restore();
            if (d.engineering === 'red' && t % BROWN_EVERY < BROWN_MS) c.drawImage(masks().brown, 0, 0);
        }
        function dip(c, t) {
            const age = t - hitAt;
            if (HIT.dips.some(([a, b], i) => age >= a && age < b && (i === 0 || !isReduced()))) c.drawImage(masks().dip, 0, 0);
        }
        function shake(t) {
            const age = t - hitAt;
            if (age < 0 || age >= HIT.shakeMs || isReduced()) return [0, 0];
            const k = HIT.shake * (1 - age / HIT.shakeMs) ** 2, tick = Math.floor(age / 40);
            return [Math.round((P.hash(tick & 255, 7, 21) - 0.5) * 2 * k), Math.round((P.hash(tick & 255, 9, 21) - 0.5) * 1.2 * k)];
        }
        return { damage, dip, shake, hit: t => { hitAt = t; } };
    }

    let moved = '';
    /** The words on the glass, the voice line and its shade move with the room (a jolt), CSS px. */
    function follow(dx, dy) {
        const v = dx || dy ? `${Math.round(dx)}px ${Math.round(dy)}px` : '';
        if (v === moved) return;
        moved = v;
        ['ns-stop-words', 'ns-voice', 'ns-shade'].forEach(id => { const el = document.getElementById(id); if (el) el.style.translate = v; });
    }

    /** Beside the bridge: ink, and on a window wider than 16:9 the same drifting stars as the frame's own edges, dissolving in
        with it; where the whole scale leaves a margin all round (geo.snap), the hull's colour. */
    function margins(bctx, geo, t, j) {
        const { CW, CH, ox, oy } = geo;
        if (ox <= 0 && oy <= 0) return;
        bctx.save();
        bctx.globalAlpha = Math.min(1, j / STEPS);
        bctx.fillStyle = geo.snap ? HULL : INK; bctx.fillRect(0, 0, CW, CH);
        if (ox > 0 && !geo.snap) {
            bctx.beginPath(); bctx.rect(0, oy, ox, SH); bctx.rect(ox + SW, oy, CW - ox - SW, SH); bctx.clip();
            [[0, 0.002, 0], [1, 0.006, 137]].forEach(([layer0, drift, sx]) => {
                const T = A.stars(layer0), n = T.size, dy = ((Math.round(t * drift) % n) + n) % n;
                for (let y = oy + dy - n; y < oy + SH; y += n) for (let x = ox - (sx % n) - n * Math.ceil(ox / n); x < CW; x += n) bctx.drawImage(T.canvas, x, y);
            });
        }
        bctx.restore();
    }

    /** The drifting stars at the frame's own edges (the room covers the rest). */
    function sides(c, t) {
        [[0, 0.002, 0], [1, 0.006, 137]].forEach(([layer0, drift, ox]) => {
            const T = A.stars(layer0), n = T.size, oy = ((Math.round(t * drift) % n) + n) % n;
            for (let y = oy - n; y < SH; y += n) for (let x = -(ox % n); x < SW; x += n) c.drawImage(T.canvas, x, y);
        });
    }
    let steps = null;
    function dissolve(j) {
        if (!steps) steps = Array.from({ length: STEPS }, (_, k) => {
            const c = document.createElement('canvas'); c.width = SW; c.height = SH;
            const g = c.getContext('2d'), img = g.createImageData(SW, SH);
            for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) if (threshold(x, y) < (k + 1) / STEPS) img.data[(y * SW + x) * 4 + 3] = 255;
            g.putImageData(img, 0, 0); return c;
        });
        return steps[Math.max(0, Math.min(STEPS - 1, j))];
    }

    window.NSRoomFx = Object.freeze({ create, follow, margins, sides, dissolve });
})();
