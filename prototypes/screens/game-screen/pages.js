/* Silent Exodus game screen: the pictures of things you read. The crew plate, the drawing from a dead ship's logbook, and
   the ship's own logbook lying open. Same recipe as the world (docs/ART_STYLE.md): a small canvas, colour ramps that start
   at the ink, an 8 x 8 Bayer dither between steps, seeded noise for the material. The words themselves are HTML laid on
   top by the reading layer, so they stay sharp; these painters say where they go.
     GamePages.create(art) → { plate(focus), drawing(focus), logbook(w, h) }
   Each returns { canvas, W, H, ... } in low-resolution pixels; the caller scales it by the world's whole-number scale. */
(function () {
    'use strict';

    function create(A) {
        const { INK, ramp, painter, threshold, hash, fbm, vnoise, seeded, clamp01, glyphText, glyphWidth } = A;

        const PAPER = ramp(INK, '#221e19', '#4a4337', '#7d7462', '#aea38a', '#cfc5ad', '#e2d9c3');
        const PENCIL = ramp(INK, '#3a342b', '#5c5446', '#7d7462');
        const DRAW = ramp(INK, '#1a1612', '#2f2920', '#4a4234');
        const METAL = ramp(INK, '#12181b', '#253036', '#3e4c53', '#62747b', '#97a9ad', '#cfdcdc');
        const GOLD = ramp(INK, '#2b1b08', '#5a3a10', '#8f6420', '#c8963e', '#ecc77a', '#fbe7b0');
        const LEATHER = ramp(INK, '#140e0a', '#21160e', '#332215', '#4d331d');
        const RIBBON = ramp(INK, '#3a1210', '#6e1f18', '#9a3424');
        const RUST = ramp(INK, '#1c120d', '#3a2216', '#5e361f', '#7c4a2a');

        const inRound = (x, y, x0, y0, x1, y1, r) => {
            if (x < x0 || y < y0 || x >= x1 || y >= y1) return false;
            const cx = x < x0 + r ? x0 + r : x >= x1 - r ? x1 - r - 1 : x, cy = y < y0 + r ? y0 + r : y >= y1 - r ? y1 - r - 1 : y;
            return Math.hypot(x - cx, y - cy) <= r;
        };
        /** Puts everything outside the lit part in shadow, so the eye goes to what the current line is about. The edge of the
            shadow is a short dithered fade, not a line. outside(x, y) → how far (px) a pixel is outside the lit part, 0 inside. */
        function dimOutside(p, outside, amount) {
            p.region(0, 0, p.W, p.H, (x, y) => {
                const d = outside(x, y), o = (y * p.W + x) * 4;
                if (d <= 0 || p.data[o + 3] === 0 || threshold(x + 2, y + 5) > Math.min(1, d / 7)) return;
                const k = 1 - amount;
                p.data[o] = Math.round(p.data[o] * k); p.data[o + 1] = Math.round(p.data[o + 1] * k); p.data[o + 2] = Math.round(p.data[o + 2] * k * 1.05);
            });
        }
        const outsideRect = (r, pad) => (x, y) => Math.hypot(Math.max(r.x - pad - x, 0, x - (r.x + r.w - 1 + pad)), Math.max(r.y - pad - y, 0, y - (r.y + r.h - 1 + pad)));
        const outsideRects = (list, pad) => (x, y) => Math.min(...list.map(r => outsideRect(r, pad)(x, y)));

        // ── the crew plate: brushed metal from beside an airlock, four cast name panels and a fifth, blank. The names are cast
        //    into the metal: raised letters lit from the top left, a shadow under each, drawn in the plate's own pixels. ──
        function plate(focus, cast) {
            const W = 200, H = 112, p = painter(W, H, false), x0 = 3, y0 = 3, x1 = W - 3, y1 = H - 3, R = 6;
            const cells = [0, 1, 2, 3, 4].map(i => ({ x: 24, y: 12 + i * 19, w: W - 48, h: 14 }));
            p.region(0, 0, W, H, (x, y) => {
                if (!inRound(x, y, x0, y0, x1, y1, R)) return;
                const fy = (y - y0) / (y1 - y0), fx = (x - x0) / (x1 - x0);
                let v = 0.5 + 0.16 * (1 - fy) - 0.08 * fx + (fbm(x / 46, y / 1.4, 7, 3) - 0.5) * 0.24;
                if (!inRound(x, y, x0 + 1, y0 + 1, x1 - 1, y1 - 1, R - 1)) v += y < H / 2 ? 0.3 : -0.28;            // the cast edge
                else if (!inRound(x, y, x0 + 2, y0 + 2, x1 - 2, y1 - 2, R - 2)) v += y < H / 2 ? 0.12 : -0.14;
                const cell = cells.find(c => x >= c.x && x < c.x + c.w && y >= c.y && y < c.y + c.h);
                if (cell) {                                                                           // a recessed panel
                    v = 0.3 + (fbm(x / 30, y / 2, 11, 2) - 0.5) * 0.12;
                    if (y === cell.y || x === cell.x) v = 0.12;
                    if (y === cell.y + cell.h - 1 || x === cell.x + cell.w - 1) v = 0.66;
                }
                if (fbm(x / 13, y / 9, 19, 3) > 0.67 && !cell) { p.solid(x, y, RUST, 0.35 + 0.4 * fbm(x / 4, y / 4, 3, 2)); return; }   // salt and age
                p.solid(x, y, METAL, v);
            });
            const rand = seeded(441);                                                                // scratches from years beside a hatch
            for (let i = 0; i < 9; i++) {
                const sx = 8 + rand() * (W - 16), sy = 6 + rand() * (H - 12), len = 6 + rand() * 22, a = (rand() - 0.5) * 0.5;
                p.line(sx, sy, sx + Math.cos(a) * len, sy + Math.sin(a) * len, (x, y) => { if (inRound(x, y, x0 + 2, y0 + 2, x1 - 2, y1 - 2, R) && hash(x, y, 4) > 0.3 && !cells.some(c => x >= c.x - 1 && x <= c.x + c.w && y >= c.y - 1 && y <= c.y + c.h)) p.solid(x, y, METAL, 0.78); });   // never across the names
            }
            [[x0 + 8, y0 + 8], [x1 - 9, y0 + 8], [x0 + 8, y1 - 9], [x1 - 9, y1 - 9]].forEach(([cx, cy]) => {   // four rivets
                p.ellipse(cx + 0.5, cy + 0.5, 2.6, 2.6, (x, y, q) => p.solid(x, y, METAL, q > 0.55 ? 0.16 : 0.5 + 0.4 * ((cx - x) + (cy - y) + 2) / 4));
            });
            if (cast && glyphText) cells.forEach((c, i) => {                                          // the cast names
                const text = cast[i]; if (!text) return;
                const w = glyphWidth(text), tx = Math.round(c.x + (c.w - w) / 2), ty = Math.round(c.y + (c.h - 5) / 2), lit = new Set();
                glyphText(text, tx, ty, (x, y) => lit.add(x + ',' + y));
                lit.forEach(k => { const [x, y] = k.split(',').map(Number); if (!lit.has((x + 1) + ',' + (y + 1))) p.solid(x + 1, y + 1, METAL, 0.1); });   // the shadow side
                lit.forEach(k => { const [x, y] = k.split(',').map(Number); p.solid(x, y, METAL, lit.has(x + ',' + (y - 1)) ? 0.62 : 0.86); });             // top edges catch the light
            });
            if (focus === 'names') dimOutside(p, outsideRects(cells.slice(0, 4), 3), 0.5);
            if (focus === 'blank') dimOutside(p, outsideRect(cells[4], 3), 0.5);
            return { canvas: p.canvas(), W, H, cells };
        }

        // ── the drawing folded into a dead ship's logbook: the gold disc, the star map, two figures, a note in the margin ──
        const DRAWING_PARTS = {
            disc: { x: 18, y: 18, w: 98, h: 98, callout: [104, 22] },
            map: { x: 132, y: 16, w: 80, h: 64, callout: [210, 18] },
            figures: { x: 140, y: 82, w: 46, h: 44, callout: [192, 88] },
            margin: { x: 10, y: 118, w: 128, h: 20, callout: [136, 122] },
        };
        /** marks: [{ part, n, isNow, isRead }]: the numbers pencilled on beside each part as you read about it (the one you
            are reading in red pencil, the ones before it in grey), each with a rough pencil ring round the number. */
        function drawing(focus, marks) {
            const W = 224, H = 142, p = painter(W, H, false);
            p.region(0, 0, W, H, (x, y) => {                                                         // the page: worn, folded in four
                if (x + y > W + H - 16 && (x - W + y - H + 16) > (hash(x, y, 2) - 0.5) * 3) return;  // a torn corner
                const edge = Math.min(x, y, W - 1 - x, H - 1 - y);
                let v = 0.72 - 0.22 * Math.exp(-edge / 3) - 0.08 * (y / H) + (fbm(x / 9, y / 9, 31, 3) - 0.5) * 0.12;
                if (fbm(x / 28, y / 22, 32, 3) > 0.63) v -= 0.1;                                       // old stains
                if (Math.abs(x - W * 0.5) < 0.6) v -= 0.2;
                if (Math.abs(y - H * 0.5) < 0.6) v -= 0.09;
                p.solid(x, y, PAPER, v);
            });
            const dx = 66, dy = 66, R = 44;                                                           // the disc, printed in gold
            p.ellipse(dx + 0.5, dy + 0.5, R, R, (x, y, q) => {
                const d = Math.sqrt(q) * R, nx = (x - dx) / R, ny = (y - dy) / R;
                if (d < 2) { p.solid(x, y, DRAW, 0.2); return; }
                if (d < 12) { p.solid(x, y, PAPER, 0.62 + 0.1 * (1 - d / 12)); return; }
                if (d > R - 1.2) { p.solid(x, y, DRAW, 0.45); return; }
                const lit = clamp01(0.5 - 0.42 * nx - 0.42 * ny), groove = (d % 3) < 1 ? -0.12 : 0;
                p.solid(x, y, GOLD, 0.34 + 0.52 * lit + groove + (vnoise(x / 3, y / 3, 5) - 0.5) * 0.1);
            });
            const mx = 166, my = 50, rand = seeded(1414), ang = [];                                    // fourteen lines from one point
            while (ang.length < 14) { const a = rand() * Math.PI * 2; if (ang.every(b => Math.abs(((a - b + Math.PI * 3) % (Math.PI * 2)) - Math.PI) > 0.26)) ang.push(a); }
            ang.forEach((a, i) => {
                const len = 12 + rand() * 22, bits = Math.floor(rand() * 1023);
                p.line(mx, my, mx + Math.cos(a) * len, my + Math.sin(a) * len, (x, y, k) => {
                    p.solid(x, y, DRAW, 0.5);
                    const step = Math.round(k * len);
                    if (step > 4 && step % 3 === 0 && ((bits >> (step / 3 % 10)) & 1)) p.solid(x - Math.round(Math.sin(a) * 1.6), y + Math.round(Math.cos(a) * 1.6), DRAW, 0.42);
                });
                if (i === 0) p.line(mx, my, mx + 42, my, (x, y) => p.solid(x, y, DRAW, 0.6));                // the long line, to the middle of the galaxy
            });
            p.ellipse(mx + 0.5, my + 0.5, 1.6, 1.6, (x, y) => p.solid(x, y, DRAW, 0.2));
            figure(p, 152, 124, false);                                                             // what we look like; one of them waves
            figure(p, 170, 124, true);
            const hand = seeded(77);                                                                  // a note in pencil, and an arrow to the map
            for (let row = 0; row < 2; row++) {
                let x = 16 + row * 6, y = 124 + row * 7;
                while (x < (row ? 92 : 126)) {
                    const n = 3 + Math.floor(hand() * 6);
                    for (let i = 0; i < n * 2; i++) { const yy = y + Math.round(Math.sin(i * 1.7 + x) * 1.4 - (hand() < 0.18 ? 2 : 0)); p.solid(x + i * 0.5, yy, PENCIL, 0.55 + hand() * 0.3); }
                    x += n + 3;
                }
            }
            p.line(128, 119, 146, 86, (x, y, k) => { if (k < 0.96) p.solid(x, y, PENCIL, 0.6); });
            p.line(146, 86, 143, 91, (x, y) => p.solid(x, y, PENCIL, 0.6)); p.line(146, 86, 148, 92, (x, y) => p.solid(x, y, PENCIL, 0.6));
            const part = DRAWING_PARTS[focus];
            if (focus === 'disc') dimOutside(p, (x, y) => Math.hypot(x - dx, y - dy) - (R + 3), 0.5);
            else if (part) dimOutside(p, outsideRect(part, 0), 0.5);
            (marks || []).forEach(m => {                                                              // after the shadow, so the mark you are on stays clear
                const at = DRAWING_PARTS[m.part] && DRAWING_PARTS[m.part].callout; if (!at || !glyphText) return;
                const ink = m.isNow ? RIBBON : PENCIL, v = m.isNow ? 0.95 : 0.55, [mx, my] = at;
                glyphText(String(m.n), mx - 1, my - 2, (x, y) => p.solid(x, y, ink, v));
                for (let q = 0; q < Math.PI * 2; q += 0.16) {                                         // a quick ring in pencil, not quite closed
                    if (q > 5.6 && q < 6.0) continue;
                    const rr = 5 + (hash(Math.round(q * 10), m.n, 3) - 0.5) * 0.9, x = Math.round(mx + 0.5 + Math.cos(q) * rr), y = Math.round(my + 0.5 + Math.sin(q) * rr * 0.92);
                    if (hash(x, y, m.n) > 0.18) p.solid(x, y, ink, v - 0.12);
                }
            });
            return { canvas: p.canvas(), W, H };
        }
        /** A small standing figure in ink, feet on row `feet`. */
        function figure(p, x, feet, waving) {
            p.ellipse(x + 0.5, feet - 19.5, 2.4, 2.6, (px, py) => p.solid(px, py, DRAW, 0.42));
            p.region(x - 2, feet - 17, x + 3, feet - 8, (px, py) => p.solid(px, py, DRAW, 0.48));
            p.region(x - 2, feet - 8, x, feet, (px, py) => p.solid(px, py, DRAW, 0.48));
            p.region(x + 1, feet - 8, x + 3, feet, (px, py) => p.solid(px, py, DRAW, 0.48));
            p.line(x - 3, feet - 16, x - 4, feet - 9, (px, py) => p.solid(px, py, DRAW, 0.48));
            if (waving) { p.line(x + 3, feet - 16, x + 6, feet - 21, (px, py) => p.solid(px, py, DRAW, 0.48)); p.line(x + 6, feet - 21, x + 6, feet - 24, (px, py) => p.solid(px, py, DRAW, 0.48)); }
            else p.line(x + 3, feet - 16, x + 4, feet - 9, (px, py) => p.solid(px, py, DRAW, 0.48));
        }

        // ── the ship's own logbook, lying open under a lamp ──
        function logbook(W, H) {
            const p = painter(W, H, false), m = 6, gutter = 3, mid = Math.floor(W / 2);
            const pages = [{ x: m, y: m, w: mid - gutter - m, h: H - m * 2 }, { x: mid + gutter, y: m, w: W - m - mid - gutter, h: H - m * 2 }];
            p.region(0, 0, W, H, (x, y) => {
                if (!inRound(x, y, 0, 0, W, H, 5)) return;
                const pg = pages.find(q => x >= q.x - 1 && x < q.x + q.w + 1 && y >= q.y - 1 && y < q.y + q.h + 1);
                if (!pg) {                                                                            // the cover, worn at the edges
                    let v = 0.55 + (fbm(x / 6, y / 6, 51, 3) - 0.5) * 0.3 + (y < 3 ? 0.2 : 0) - (y > H - 3 ? 0.25 : 0);
                    if (Math.abs(x - mid) < 2) v -= 0.25;
                    p.solid(x, y, LEATHER, v); return;
                }
                const toSpine = Math.abs(x + 0.5 - mid) - gutter, toOuter = pg === pages[0] ? x - pg.x : pg.x + pg.w - 1 - x;
                let v = 0.77 - 0.34 * Math.exp(-toSpine / 9) - 0.12 * Math.exp(-toOuter / 3) - 0.07 * (y - m) / (H - m * 2) + (fbm(x / 10, y / 10, 52, 3) - 0.5) * 0.06;
                if (y === pg.y + pg.h || x === pg.x - 1 || x === pg.x + pg.w) v = 0.6;                // the edges of the pages under it
                p.solid(x, y, PAPER, v);
            });
            for (let y = m + 4; y < H - m - 2; y += 9) { p.solid(mid - 1, y, LEATHER, 0.2); p.solid(mid, y + 1, LEATHER, 0.2); }   // stitches
            const rx = pages[1].x + pages[1].w - 5;                                                   // a ribbon in the outer margin, out of the bottom: never across the words
            for (let y = m; y < H; y++) { const wob = y > H - 8 ? Math.round((y - H + 8) / 3) : 0; p.solid(rx + wob, y, RIBBON, 0.7); p.solid(rx + 1 + wob, y, RIBBON, 0.45); }
            return { canvas: p.canvas(), W, H, pages };
        }

        return { plate, drawing, logbook };
    }

    window.GamePages = { create };
})();
