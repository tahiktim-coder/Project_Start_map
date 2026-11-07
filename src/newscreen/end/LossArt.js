/* ═══ Silent Exodus · new screen (?new=1) · end/LossArt.js: every game over, its picture ═══════════════════════════════════
   What it is: the picture of the loss ending (call C73; DESIGN.md section 3): our Lander cut open at the hold, at the bridge's
   own pixel (start/PodArt.js's frame, read only: the hold with its five sleeper pods, the med bay above, the engine room
   below). The ship goes dark deck by deck in the void-drain's steps: the engine room, then the med bay, then the hold's
   lamps, then each pod's cold light, one at a time. The dead are named on their pod plates in the pixel stencil (a plate
   stays blank for whoever is not in a pod). What is left at the end: the plates, and A.U.R.A.'s ring round her intercom,
   the last light; it lights in steps while she speaks.
   House style (docs/ART_STYLE.md): ramps from the ink, the 8 x 8 Bayer steps, motion in 125 ms steps, no randomness.
   end/Ending.js drives the clock and the words. Needs NSPaint, NSPodArt (start/PodArt.js), ShipArt. Loaded only with the
   new-screen switch, after start/PodArt.js, before end/Ending.js.

   window.NSLossArt (frozen)
     build(W, H, o) → art     o: { names: { id: 'Name' } } the dead, named on their plates; W x H the art frame (the hold's
                              640 x 360 sits in its middle, ink round it)
     draw(ctx, art, v, t)     v: { below, above, hold: 0..1 (dark), pods: [5] 0..1 (each pod's light gone), talking (bool) }
     ring(art) → [x, y]       where A.U.R.A.'s ring is (art px)
*/
(function () {
    'use strict';
    const P = window.NSPaint, PA = window.NSPodArt, A = window.ShipArt;
    if (!window.NEW_SCREEN || !P || !PA || !A) return;
    const { INK, threshold, clamp01 } = P;
    const { SW, SH, TOP, F, PODS, INTERCOM } = PA;
    const PITCH = A.L.PITCH;
    const BANDS = { above: [0, TOP - 18], hold: [TOP - 18, TOP + PITCH], below: [TOP + PITCH, SH] };   // PodArt's own: the med bay's floor slab is the hold's ceiling
    const PLATE = { fill: '#141b20', top: '#3d5560', low: '#0b1013', rivet: '#8aa2aa', word: '#a9b6bc' };   // --cool on dark steel
    const RING_R = 7, SCR = ['#2c3a40', '#8aa2aa', '#c9d1d6', '#eef4f6'];                       // her ring: dim steel, --ui on its beat, brighter while she speaks

    const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
    // ── ink in Bayer steps (n eighths of the pixels), the house fade ──
    const pats = new Map();
    function inkFill(g, n) {
        if (n >= 8) return INK;
        if (!pats.has(n)) {
            const c = mk(8, 8), x = c.getContext('2d');
            x.fillStyle = INK;
            for (let y = 0; y < 8; y++) for (let k = 0; k < 8; k++) if (threshold(k, y) < n / 8) x.fillRect(k, y, 1, 1);
            pats.set(n, c);
        }
        return g.createPattern(pats.get(n), 'repeat');
    }
    function inkRect(g, x, y, w, h, a) {
        const n = Math.round(clamp01(a) * 8);
        if (!n || w <= 0 || h <= 0) return;
        g.fillStyle = inkFill(g, n);
        g.fillRect(x, y, w, h);
    }

    function build(W, H, o) {
        (PA.prepare() || []).forEach(job => job());                                 // the room, lit (cached once painted)
        const names = (o && o.names) || {};
        return { W, H, ox: Math.floor((W - SW) / 2), oy: Math.floor((H - SH) / 2), c: mk(SW, SH), names };
    }

    /** A pod's plate under its window: dark steel, a lit top edge, two rivets, the name stencilled (blank: nobody in it). */
    function plate(g, p, name) {
        const word = String(name || '').toUpperCase(), tw = word ? P.pixelTextWidth(word) : 9, w = Math.max(15, tw + 6), x0 = p.x - (w >> 1), y0 = F - 28;
        g.fillStyle = PLATE.fill; g.fillRect(x0, y0, w, 9);
        g.fillStyle = PLATE.top; g.fillRect(x0, y0, w, 1);
        g.fillStyle = PLATE.low; g.fillRect(x0, y0 + 8, w, 1);
        g.fillStyle = PLATE.rivet; g.fillRect(x0 + 1, y0 + 4, 1, 1); g.fillRect(x0 + w - 2, y0 + 4, 1, 1);
        if (!word) return;
        g.fillStyle = PLATE.word;
        P.pixelText(word, x0 + ((w - tw) >> 1), y0 + 2, (x, y) => g.fillRect(x, y, 1, 1));
    }
    const ringAt = () => [INTERCOM.x + (INTERCOM.w >> 1), INTERCOM.y + (INTERCOM.h >> 1)];
    /** A.U.R.A.'s ring round her intercom: a one-pixel circle of steel light, its glow in Bayer steps; brighter in steps
        while she speaks (her grille lights too). */
    function aura(g, t, talking) {
        const [cx, cy] = ringAt(), on = talking ? Math.floor(t / 125) % 3 !== 2 : Math.floor(t / 1000) % 4 !== 3, f = P.framer(g, SW, SH);
        for (let dy = -RING_R - 3; dy <= RING_R + 3; dy++) for (let dx = -RING_R - 3; dx <= RING_R + 3; dx++) {
            const d = Math.abs(Math.hypot(dx, dy) - RING_R);
            if (d > 0.5 && d < 3 && (on ? 0.5 : 0.3) * (1 - d / 3) > threshold(cx + dx, cy + dy)) f.px(cx + dx, cy + dy, SCR[0]);
        }
        const seen = new Set();
        for (let k = 0; k < 72; k++) {
            const x = Math.round(cx + RING_R * Math.cos(k / 72 * Math.PI * 2)), y = Math.round(cy + RING_R * Math.sin(k / 72 * Math.PI * 2)), key = x * 1000 + y;
            if (!seen.has(key)) { seen.add(key); f.px(x, y, on ? SCR[talking ? 3 : 2] : SCR[1]); }
        }
        if (talking && on) { const I = INTERCOM; for (let y = 2; y < I.h - 2; y += 2) f.px(I.x + 2, I.y + y, SCR[2], I.w - 4, 1); }
    }

    function draw(ctx, art, v, t) {
        const g = art.c.getContext('2d'), pods = v.pods || [];
        g.drawImage(PA.room(true), 0, 0);
        if ((v.hold || 0) < 0.5) PA.fx(g, t, {});                                   // the hold's LEDs and screen, while it has power
        Object.keys(BANDS).forEach(k => { const [y0, y1] = BANDS[k]; inkRect(g, 0, y0, SW, y1 - y0, v[k] || 0); });
        PODS.forEach((p, i) => {
            const dead = !!art.names[p.id];
            PA.pod(g, i, { id: p.id, warm: 0, ice: 1, level: dead ? 1 : 0, awake: false, door: 0, inside: dead, alarm: false, frame: 0 }, t);
            inkRect(g, p.win.x, p.win.y, p.win.w, p.win.h, pods[i] || 0);
            plate(g, p, art.names[p.id]);
        });
        aura(g, t, !!v.talking);
        ctx.fillStyle = INK; ctx.fillRect(0, 0, art.W, art.H);
        ctx.drawImage(art.c, art.ox, art.oy);
    }

    window.NSLossArt = Object.freeze({ build, draw, ring: art => { const [x, y] = ringAt(); return [x + art.ox, y + art.oy]; } });
})();
