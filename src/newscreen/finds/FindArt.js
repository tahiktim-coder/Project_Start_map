/* ═══ Silent Exodus · new screen (?new=1) · finds/FindArt.js: the found things, painted ═══════════════════════════════════
   What it is: the pictures under the words of every find in the new look (finds/Finds.js lays the words on top, so they stay
   sharp): a printed page from Earth, the Exodus programme's emblem, a dead ship's log screen in its housing, the crew plate
   with its names cast into the metal, the disc sketched in pencil on a logbook page, and the gold disc itself.
   House style (docs/ART_STYLE.md): ramps that start at the ink, 8 x 8 Bayer dither, seeded noise, one light from the top left.
   Every painter takes its size in art pixels (one art pixel is two CSS pixels) and returns pixels to put on a canvas.
   Loaded only when the new-screen switch is on, after art/Paint.js.

   window.NSFindArt (frozen)
     paper(W, H, { seed, ramp, fold: { axis, at }, corner: 'br' | 'bl', staple })   → painter   a page lit from the top left
     emblem()                                    → { N, cells }   the programme's mark, as cells to print
     bezel(W, H, glass)                          → painter        a log screen's housing round glass { x, y, w, h }
     led(ctx, glass, W, H, t)                    the housing's one standby light, blinking
     plate(W, H, names)                          → { p, vals, plateBox }   the crew plate; vals keeps every metal pixel's tone
     plateGlint(img, base, vals, W, H, t)        the slow glint across the plate, written into img
     sketch(W, H, layout)                        → { data, part, press }   the disc in pencil on a logbook page
     sketchFocus(base, W, H, layout, key)        → Uint8ClampedArray       the same page with one part pointed at
     gold(D)                                     → { frame(img, t, focus) }  the gold disc, its shine turning at t
     REGIONS                                     the parts of the disc, in the old drawing's units (radius 140) from its centre
*/
(function () {
    'use strict';
    const P = window.NSPaint;
    if (!P) return;
    const { INK, ramp, threshold, clamp01, smooth, seeded, hash, vnoise, fbm, painter, level } = P;

    // ── the ramps: every one starts at the ink, so every material can fade into the dark ──
    const PAPER = ramp(INK, '#3a3226', '#6b5f4b', '#9a8e74', '#bcb092', '#cfc4a7', '#dbd1b5', '#e5dcc3', '#eee7d3');
    const LOGPAPER = ramp(INK, '#35332d', '#66635a', '#949081', '#b7b3a2', '#cac6b5', '#d7d4c4', '#e2dfd0', '#ebe9dc');
    const GRAPHITE = ramp('#b3ad9d', '#8f8a7d', '#6c695f', '#4c4a44', '#33322e');                     // pencil on paper: light to dark
    const CASE = ramp(INK, '#101517', '#1b2225', '#2a3337', '#3f4a4f', '#5c696e', '#8a989b');           // a log screen's housing
    const GLASS = ramp(INK, '#040908', '#07120e', '#0b1a14', '#10251c', '#16301f');                   // dead glass, a little phosphor in it
    const PLATE = ramp(INK, '#141a1d', '#283034', '#424d52', '#66737a', '#94a2a6', '#c7d2d2', '#eef3f1');
    const WALL = ramp(INK, '#0d1418', '#152126', '#1f2f36', '#2e434c');
    const GOLD = ramp(INK, '#21160a', '#4a3312', '#7d5a1f', '#b3842f', '#dcae55', '#f6d98e', '#fff3cf');
    const ETCH = [42, 28, 8], ETCH_LIT = [255, 244, 208];
    const RULE = [150, 168, 176], MARGIN = [196, 104, 90], RUST = [122, 82, 54], DARK = [42, 36, 27];

    const inRound = (x, y, x0, y0, x1, y1, r) => {
        if (x < x0 || y < y0 || x >= x1 || y >= y1) return false;
        const cx = x < x0 + r ? x0 + r : x >= x1 - r ? x1 - r - 1 : x, cy = y < y0 + r ? y0 + r : y >= y1 - r ? y1 - r - 1 : y;
        return Math.hypot(x - cx, y - cy) <= r;
    };
    /** How much an edge pixel of a rounded box faces the light (top left): +0.7 on the top and left edges, −0.7 on the others,
        turning smoothly round the corners. */
    function edgeLight(x, y, x0, y0, x1, y1, r) {
        const cx = Math.min(Math.max(x, x0 + r), x1 - 1 - r), cy = Math.min(Math.max(y, y0 + r), y1 - 1 - r);
        let nx = x - cx, ny = y - cy;
        if (!nx && !ny) { const d = [y - y0, x - x0, y1 - 1 - y, x1 - 1 - x], k = d.indexOf(Math.min(...d)); [nx, ny] = [[0, -1], [-1, 0], [0, 1], [1, 0]][k]; }
        return -(nx + ny) / (Math.hypot(nx, ny) * Math.SQRT2);
    }
    /** Sets a pixel to a colour on `amount` of the pixels (the dither decides which): a faint printed line, a pale rule. */
    function cover(p, x, y, rgb, amount) { if (amount > threshold(x + 3, y + 5)) p.set(x, y, rgb); }
    /** Darkens everything outside the part being pointed at, behind a short dithered edge: the eye goes to the part. */
    function dimOutside(data, W, H, outside, amount) {
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const o = (y * W + x) * 4, d = outside(x, y);
            if (d <= 0 || data[o + 3] === 0 || threshold(x + 2, y + 5) > Math.min(1, d / 6)) continue;
            const k = 1 - amount;
            data[o] = Math.round(data[o] * k); data[o + 1] = Math.round(data[o + 1] * k); data[o + 2] = Math.round(data[o + 2] * k * 1.06);
        }
    }

    // ── 1. a printed page ──
    /** The folded-over corner: the back of the paper, lit, with a dark free edge; the hinge catches the light. */
    function flapTone(a, b, D, seed, x, y) {
        if (a >= D - 0.5 || b >= D - 0.5) return 0.52;
        if (a + b <= D + 1.2) return 0.9;
        return 0.72 + 0.1 * (1 - (a + b - D) / D) + (hash(x, y, seed + 2) - 0.5) * 0.04;
    }
    /** A page lit from the top left: its grain, old stains, darker worn edges with a few nicks, one fold (o.fold: the axis it runs
        along and where; the half past it turned a little from the light), o.corner folded over, o.staple pulled out at the top left. */
    function paper(W, H, o = {}) {
        const p = painter(W, H, false), seed = o.seed || 7, R = o.ramp || PAPER;
        const fold = o.fold || { axis: 'y', at: 0.5 }, D = o.corner ? Math.max(7, Math.round(Math.min(W, H) * 0.07)) : 0, isRight = o.corner !== 'bl';
        const at = Math.round((fold.axis === 'y' ? H : W) * fold.at);
        p.region(0, 0, W, H, (x, y) => {
            const e = Math.min(x, y, W - 1 - x, H - 1 - y);
            if (e === 0 && vnoise((x + y * 1.7) / 3.4, 1, seed + 9) > 0.88) return;                    // a worn edge: a few small nicks
            let shade = 0;
            if (D) {
                const a = isRight ? W - 1 - x : x, b = H - 1 - y;
                if (a + b < D) return;                                                             // the corner, folded over
                if (a <= D && b <= D && a + b > D) { p.solid(x, y, R, flapTone(a, b, D, seed, x, y)); return; }
                if ((a > D && a <= D + 2 && b < D) || (b > D && b <= D + 2 && a < D)) shade = 0.08;   // its shadow on the page
            }
            let v = 0.87 - 0.12 * Math.pow(0.58 * x / W + 0.42 * y / H, 1.1) - shade;                 // the lamp: top left
            v += (fbm(x / 6, y / 6, seed + 3, 3) - 0.5) * 0.045;                                      // the paper's grain
            const blot = fbm(x / 46, y / 38, seed + 5, 3); if (blot > 0.68) v -= (blot - 0.68) * 0.4;   // a faint old stain or two
            v -= 0.1 * Math.exp(-e / 1.6) + 0.07 * Math.exp(-e / 16);                                // the edges, handled and darker
            const along = fold.axis === 'y' ? x : y, across = fold.axis === 'y' ? y : x;
            const d = across - (at + Math.round((vnoise(along / 37, 3, seed) - 0.5) * 1.6));
            v += d < 0 ? 0.012 : -0.03;                                                             // the far half, turned from the light
            if (d === 0) v -= 0.2; else if (d === -1) v += 0.06; else if (d > 0 && d < 4) v -= [0, 0.07, 0.045, 0.02][d];
            if (hash(x, y, seed + 7) < 0.0025) v -= 0.3;                                              // grit
            p.solid(x, y, R, v);
        });
        if (o.staple) staple(p, W, seed);
        return p;
    }
    /** Two holes where a staple was pulled out, rust round them, and the staple's line pressed into the paper between. */
    function staple(p, W, seed) {
        const hx = Math.round(W * 0.045), hy = Math.round(W * 0.05), dx = Math.round(W * 0.05), dy = -Math.round(W * 0.03);
        p.line(hx, hy, hx + dx, hy + dy, (x, y) => { p.set(x, y + 1, [166, 156, 130]); if (hash(x, y, seed + 9) > 0.4) p.set(x, y, [205, 196, 170]); });
        [[hx, hy], [hx + dx, hy + dy]].forEach(([x0, y0]) => {
            for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) { const r = Math.hypot(i, j); if (r > 1.4 && r < 4.2) cover(p, x0 + i, y0 + j, RUST, 0.7 * (1 - (r - 1.4) / 2.8)); }
            p.region(x0 - 1, y0 - 1, x0 + 1, y0 + 1, (x, y) => p.set(x, y, DARK));
            p.set(x0 + 1, y0, [96, 84, 66]);
        });
    }

    /** The Exodus programme's mark, as printed on its paper: a ring, the curve of the Earth, a ship rising off it, four stars. */
    function emblem() {
        const N = 25, c = 12, cells = [], ringCells = new Set();
        [11, 12].forEach(r => { let x = r, y = 0, err = 1 - r; while (x >= y) { [[x, y], [y, x], [-y, x], [-x, y], [-x, -y], [-y, -x], [y, -x], [x, -y]].forEach(([a, b]) => ringCells.add((c + a) + ',' + (c + b))); y++; if (err < 0) err += 2 * y + 1; else { x--; err += 2 * (y - x) + 1; } } });   // two clean circles: an even ring
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
            const d = Math.hypot(x - c, y - c), dEarth = Math.hypot(x - c, y - (c + 17));
            const ring = ringCells.has(x + ',' + y);
            const earth = d < 9.4 && dEarth < 12.2 && Math.abs(dEarth - 9.7) > 0.55;                // with a line of latitude left as paper
            const ship = (x === c && y >= 3 && y <= 9) || (Math.abs(x - c) === 1 && y >= 5 && y <= 9) || (Math.abs(x - c) === 2 && y >= 8 && y <= 9);
            const trail = x === c && (y === 11 || y === 13);
            const star = [[6, 7], [18, 6], [17, 11], [6, 12]].some(([sx, sy]) => sx === x && sy === y);
            if (ring || earth || ship || trail || star) cells.push([x, y]);
        }
        return { N, cells };
    }

    // ── 2. a dead ship's log screen ──
    /** The housing round a screen: worn metal lit from the top left, a dark lip round the glass, four screws, vents; the glass
        itself dark, a little phosphor still in it, darker at the corners, one hairline crack low on the left. */
    function bezel(W, H, g) {
        const p = painter(W, H, false), R = Math.max(5, Math.round(Math.min(W, H) * 0.045)), lip = Math.max(3, Math.round(W * 0.012));
        p.region(0, 0, W, H, (x, y) => {
            if (!inRound(x, y, 0, 0, W, H, R)) return;
            const gx = x - g.x, gy = y - g.y;
            if (gx >= 0 && gy >= 0 && gx < g.w && gy < g.h && inRound(x, y, g.x, g.y, g.x + g.w, g.y + g.h, 6)) { p.solid(x, y, GLASS, glassTone(gx, gy, g, x, y)); return; }
            const out = Math.max(g.x - x, x - (g.x + g.w - 1), g.y - y, y - (g.y + g.h - 1));
            if (out <= lip) {                                                                        // the lip: in shadow above, lit below
                const isLow = y >= g.y + g.h - 1 && out === lip, isHigh = y < g.y && out <= 1;
                p.solid(x, y, CASE, isLow ? 0.5 : isHigh ? 0.06 : 0.13 + (hash(x, y, 3) - 0.5) * 0.04); return;
            }
            const fx = x / W, fy = y / H;
            let v = 0.44 + 0.13 * (1 - fy) - 0.06 * fx + (fbm(x / 34, y / 2.6, 41, 3) - 0.5) * 0.09;
            if (!inRound(x, y, 1, 1, W - 1, H - 1, R - 1)) v += 0.42 * edgeLight(x, y, 0, 0, W, H, R);            // the rounded outer edge
            else if (!inRound(x, y, 3, 3, W - 3, H - 3, R - 3)) v += 0.17 * edgeLight(x, y, 0, 0, W, H, R);
            if (out === lip + 1) v += y < g.y || x < g.x ? -0.16 : 0.14;                             // the step down to the lip: in shadow above
            const grime = fbm(x / 11, y / 8, 43, 3); if (grime > 0.66) v -= (grime - 0.66) * 0.7;
            p.solid(x, y, CASE, v);
        });
        const rand = seeded(311);                                                                    // scratches from a working life
        for (let i = 0; i < 7; i++) {
            const sx = rand() * W, sy = rand() < 0.5 ? rand() * g.y : g.y + g.h + lip + 2 + rand() * (H - g.y - g.h - lip - 4), len = 6 + rand() * 18, a = (rand() - 0.5) * 0.6;
            p.line(sx, sy, sx + Math.cos(a) * len, sy + Math.sin(a) * len, (x, y) => { const out = Math.max(g.x - x, x - (g.x + g.w - 1), g.y - y, y - (g.y + g.h - 1)); if (out > lip + 2 && inRound(x, y, 3, 3, W - 3, H - 3, R) && hash(x, y, 5) > 0.35) p.solid(x, y, CASE, 0.74); });
        }
        const sr = Math.max(2, Math.round(W * 0.007)), si = Math.round(Math.min(g.x, g.y) * 0.5);
        [[si, si], [W - 1 - si, si], [si, H - 1 - si], [W - 1 - si, H - 1 - si]].forEach(([cx, cy]) => screw(p, cx, cy, sr));
        const bottom = g.y + g.h + lip, vy = Math.round(bottom + (H - bottom) * 0.5) - 1, vw = Math.max(4, Math.round(W * 0.018));   // vents
        for (let k = 0; k < 8; k++) { const vx = Math.round(W / 2 - 4 * (vw + 3) + k * (vw + 3)); p.region(vx, vy, vx + vw, vy + 2, (x, y) => p.solid(x, y, CASE, y === vy ? 0.04 : 0.1)); p.region(vx, vy + 2, vx + vw, vy + 3, (x, y) => p.solid(x, y, CASE, 0.6)); }
        crack(p, g);
        return p;
    }
    function glassTone(gx, gy, g, x, y) {
        const u = gx / g.w, v0 = gy / g.h, d = Math.hypot((u - 0.5) * 1.15, (v0 - 0.5));
        let v = 0.36 * (1 - d * 1.45);                                                              // phosphor haze, the corners dark
        const edge = Math.min(gx, gy, g.w - 1 - gx, g.h - 1 - gy); if (edge < 3) v -= 0.12 * (3 - edge);
        const band = u + v0 * 0.55; if (v0 < 0.5 && band > 0.1 && band < 0.2) v += 0.1 * (1 - Math.abs(band - 0.15) / 0.05);   // the glass catches the room
        return v + (hash(x, y, 9) - 0.5) * 0.04;
    }
    function crack(p, g) {
        const rand = seeded(97), pts = [[g.x + 2, g.y + g.h - 2]];
        for (let k = 0; k < 9; k++) { const [x, y] = pts[pts.length - 1]; pts.push([x + 2 + rand() * 4, y - 1 - rand() * 3]); }
        const draw = list => list.forEach(([x0, y0], i) => { if (i === 0) return; const [x1, y1] = list[i - 1]; p.line(x1, y1, x0, y0, (x, y) => { p.set(x, y, [70, 88, 82]); p.set(x, y + 1, [3, 6, 5]); }); });
        draw(pts);
        const at = pts[4], branch = [at]; for (let k = 0; k < 4; k++) { const [x, y] = branch[branch.length - 1]; branch.push([x + 1 + rand() * 3, y + 1 + rand() * 2]); }
        draw(branch);
    }
    function screw(p, cx, cy, r) {
        p.ellipse(cx + 0.5, cy + 0.5, r + 1, r + 1, (x, y, q) => {
            const lit = ((cx - x) + (cy - y)) / (2 * r);
            p.solid(x, y, CASE, q > 0.7 ? 0.12 : 0.45 + 0.3 * lit);
        });
        p.line(cx - r + 1, cy + r - 1, cx + r - 1, cy - r + 1, (x, y) => p.solid(x, y, CASE, 0.1));     // the slot
    }
    /** The housing's one standby light, below the glass on the right: red, a slow blink. */
    function led(ctx, g, W, H, t) {
        const bottom = g.y + g.h, x = Math.round(g.x + g.w - Math.max(6, W * 0.03)), y = Math.round(bottom + (H - bottom) * 0.5) - 1;
        const isOn = Math.floor(t / 1400) % 2 === 0;
        ctx.fillStyle = isOn ? '#5a1c18' : '#2a0e0c'; ctx.fillRect(x - 1, y - 1, 4, 4);
        ctx.fillStyle = isOn ? '#ff6a58' : '#6e211b'; ctx.fillRect(x, y, 2, 2);
    }

    // ── 3. the crew plate ──
    /** The crew plate on the dark hull beside an airlock: brushed metal, five recessed panels, four names cast into them as raised
        letters (lit on the top left edge, shadowed on the other, a shadow on the panel), the fifth panel blank. vals keeps every
        metal pixel's tone (−1 elsewhere) so the glint can pass over it. */
    function plate(W, H, names) {
        const p = painter(W, H, false), vals = new Float32Array(W * H).fill(-1);
        const mx = Math.round(W * 0.055), my = Math.round(H * 0.075), x0 = mx, y0 = my, x1 = W - mx, y1 = H - my, Rr = Math.max(4, Math.round(W * 0.018));
        const pad = Math.round((x1 - x0) * 0.07), tp = Math.round((y1 - y0) * 0.075), gap = Math.round((y1 - y0) * 0.03);
        const ph = Math.floor(((y1 - y0) - 2 * tp - 4 * gap) / 5), cells = [0, 1, 2, 3, 4].map(i => ({ x: x0 + pad, y: y0 + tp + i * (ph + gap), w: (x1 - x0) - 2 * pad, h: ph }));
        const put = (x, y, v) => { vals[y * W + x] = v; p.solid(x, y, PLATE, v); };
        p.region(0, 0, W, H, (x, y) => {
            if (!inRound(x, y, x0, y0, x1, y1, Rr)) { wall(p, x, y, W, H, x0, y0, x1, y1); return; }
            const fy = (y - y0) / (y1 - y0), fx = (x - x0) / (x1 - x0);
            let v = 0.52 + 0.15 * (1 - fy) - 0.07 * fx + (fbm(x / 52, y / 1.3, 7, 3) - 0.5) * 0.18;     // brushed, lit from the top left
            if (!inRound(x, y, x0 + 1, y0 + 1, x1 - 1, y1 - 1, Rr - 1)) v += 0.4 * edgeLight(x, y, x0, y0, x1, y1, Rr);   // the cast edge
            else if (!inRound(x, y, x0 + 3, y0 + 3, x1 - 3, y1 - 3, Rr - 3)) v += 0.16 * edgeLight(x, y, x0, y0, x1, y1, Rr);
            const cell = cells.find(c => x >= c.x && x < c.x + c.w && y >= c.y && y < c.y + c.h);
            if (cell) {                                                                               // a recessed panel
                v = 0.3 + (fbm(x / 30, y / 2, 11, 2) - 0.5) * 0.1 + 0.06 * (1 - fx);
                if (y === cell.y || x === cell.x) v = 0.08; else if (y === cell.y + 1 || x === cell.x + 1) v = 0.18;
                if (y === cell.y + cell.h - 1 || x === cell.x + cell.w - 1) v = 0.68;
            } else {
                const age = fbm(x / 13, y / 9, 19, 3); if (age > 0.67) v -= (age - 0.67) * 0.8;           // salt and age, never in the panels
            }
            put(x, y, v);
        });
        const rand = seeded(441);                                                                     // scratches from years beside a hatch
        for (let i = 0; i < 10; i++) {
            const sx = x0 + 6 + rand() * (x1 - x0 - 12), sy = y0 + 4 + rand() * (y1 - y0 - 8), len = 6 + rand() * 18, a = (rand() - 0.5) * 0.4;
            p.line(sx, sy, sx + Math.cos(a) * len, sy + Math.sin(a) * len, (x, y) => { if (inRound(x, y, x0 + 3, y0 + 3, x1 - 3, y1 - 3, Rr) && hash(x, y, 4) > 0.4 && !cells.some(c => x >= c.x - 2 && x <= c.x + c.w + 1 && y >= c.y - 2 && y <= c.y + c.h + 1)) put(x, y, Math.min(0.74, vals[y * W + x] + 0.16)); });
        }
        const ri = Math.round(pad * 0.45), rr = Math.max(2, Math.round(W * 0.008));
        [[x0 + ri, y0 + ri], [x1 - 1 - ri, y0 + ri], [x0 + ri, y1 - 1 - ri], [x1 - 1 - ri, y1 - 1 - ri]].forEach(([cx, cy]) => rivet(put, p, cx, cy, rr));
        castNames(put, cells, names);
        return { p, vals, plateBox: { x0, y0, x1, y1 } };
    }
    /** The ship's dark hull round the plate, with its own seams, fading out through the dither into the dark of the screen. */
    function wall(p, x, y, W, H, x0, y0, x1, y1) {
        const e = Math.min(x, y, W - 1 - x, H - 1 - y), fade = smooth(0, Math.min(x0, y0) * 1.6, e);
        if (fade <= threshold(x + 1, y + 6)) return;
        let v = 0.5 + (fbm(x / 40, y / 6, 61, 3) - 0.5) * 0.18;
        if (y % 46 === 23 || x % 120 === 60) v -= 0.25; else if (y % 46 === 24) v += 0.12;              // the hull's own plate seams
        const sx = x - x1, sy = y - y1, shadow = (x > x0 + 3 && sx >= -1 && sx < 4 && y > y0 + 3 && y < y1 + 4) || (y > y0 + 3 && sy >= -1 && sy < 4 && x > x0 + 3 && x < x1 + 4);
        if (shadow) v -= 0.3;                                                                          // the plate stands off the wall a little
        p.solid(x, y, WALL, Math.max(0, v * (0.55 + 0.45 * fade)));
    }
    function rivet(put, p, cx, cy, r) {
        p.ellipse(cx + 0.5, cy + 0.5, r + 1, r + 1, (x, y, q) => {
            const lit = ((cx - x) + (cy - y)) / (2 * r);
            put(x, y, q > 0.72 ? 0.18 : 0.5 + 0.34 * lit);
        });
    }
    // the letters cast into the plate: a 5 x 7 face (the travel view's 3 x 5 font cannot tell a K from an H at this size)
    const CAST = {
        A: '01110 10001 10001 11111 10001 10001 10001', B: '11110 10001 10001 11110 10001 10001 11110', C: '01110 10001 10000 10000 10000 10001 01110',
        D: '11100 10010 10001 10001 10001 10010 11100', E: '11111 10000 10000 11110 10000 10000 11111', F: '11111 10000 10000 11110 10000 10000 10000',
        G: '01110 10001 10000 10111 10001 10001 01111', H: '10001 10001 10001 11111 10001 10001 10001', I: '111 010 010 010 010 010 111',
        J: '00111 00010 00010 00010 00010 10010 01100', K: '10001 10010 10100 11000 10100 10010 10001', L: '10000 10000 10000 10000 10000 10000 11111',
        M: '10001 11011 10101 10101 10001 10001 10001', N: '10001 10001 11001 10101 10011 10001 10001', O: '01110 10001 10001 10001 10001 10001 01110',
        P: '11110 10001 10001 11110 10000 10000 10000', Q: '01110 10001 10001 10001 10101 10010 01101', R: '11110 10001 10001 11110 10100 10010 10001',
        S: '01111 10000 10000 01110 00001 00001 11110', T: '11111 00100 00100 00100 00100 00100 00100', U: '10001 10001 10001 10001 10001 10001 01110',
        V: '10001 10001 10001 10001 10001 01010 00100', W: '10001 10001 10001 10101 10101 10101 01010', X: '10001 10001 01010 00100 01010 10001 10001',
        Y: '10001 10001 10001 01010 00100 00100 00100', Z: '11111 00001 00010 00100 01000 10000 11111',
        '.': '00 00 00 00 00 11 11', '·': '00 00 00 11 11 00 00', '-': '000 000 000 111 000 000 000', "'": '1 1 0 0 0 0 0', ' ': '000 000 000 000 000 000 000',
    };
    const castRows = ch => (CAST[String(ch).toUpperCase()] || CAST[' ']).split(' ');
    const castWidth = str => [...String(str)].reduce((w, ch) => w + castRows(ch)[0].length, 0) + Math.max(0, String(str).length - 1);
    /** The names in the cast face, as big as the panels allow, each font pixel a block of cell x cell: raised letters of the
        plate's own metal, their top and left edges catching the light, the other edges and a shadow on the panel in the dark. */
    function castNames(put, cells, names) {
        const list = (names || []).slice(0, 5), widest = Math.max(1, ...list.map(n => (n ? castWidth(n) : 0)));
        const room = cells[0].w - 2 * Math.round(cells[0].w * 0.05);
        const cell = [4, 3, 2, 1].find(c => widest * c <= room && 7 * c <= cells[0].h - 6) || 1;
        list.forEach((name, i) => {
            if (!name) return;                                                                         // the fifth: made blank
            const c = cells[i], w = castWidth(name) * cell, tx = Math.round(c.x + (c.w - w) / 2), ty = Math.round(c.y + (c.h - 7 * cell) / 2);
            const on = new Set();
            let gx = 0;
            [...name].forEach(ch => {
                const rows = castRows(ch);
                rows.forEach((row, gy) => { for (let k = 0; k < row.length; k++) if (row[k] === '1') for (let dy = 0; dy < cell; dy++) for (let dx = 0; dx < cell; dx++) on.add((tx + (gx + k) * cell + dx) + ',' + (ty + gy * cell + dy)); });
                gx += rows[0].length + 1;
            });
            const has = (x, y) => on.has(x + ',' + y);
            on.forEach(k => { const [x, y] = k.split(',').map(Number); for (const [sx, sy] of [[1, 1], [2, 2], [1, 2], [2, 1]]) if (!has(x + sx, y + sy)) put(x + sx, y + sy, 0.06); });   // the shadow on the panel
            on.forEach(k => {
                const [x, y] = k.split(',').map(Number);
                const top = !has(x, y - 1), left = !has(x - 1, y), low = !has(x, y + 1), right = !has(x + 1, y);
                put(x, y, top ? 0.8 : left ? 0.72 : low || right ? 0.34 : 0.56 + (hash(x, y, 13) - 0.5) * 0.06);
            });
        });
    }
    /** The glint: a band of light crossing the plate from the left every few seconds, then gone. */
    const GLINT_MS = 6200, GLINT_PASS_MS = 2300;
    function plateGlint(img, base, vals, W, H, t) {
        img.data.set(base);
        const k = (t % GLINT_MS) / GLINT_PASS_MS;
        if (k >= 1) return;
        const span = W + H * 0.7, centre = -H * 0.7 + span * smooth(0, 1, k) + W * 0.05, bw = Math.max(10, W * 0.07);
        for (let y = 0; y < H; y++) {
            const lo = Math.max(0, Math.floor(centre - bw - y * 0.7)), hi = Math.min(W, Math.ceil(centre + bw - y * 0.7));
            for (let x = lo; x < hi; x++) {
                const i = y * W + x, v = vals[i];
                if (v < 0) continue;
                const d = Math.abs(x + y * 0.7 - centre) / bw, add = 0.26 * (1 - d * d);
                if (add <= 0) continue;
                const rgb = PLATE.rgb[level(PLATE, v + add, x, y)], o = i * 4;
                img.data[o] = rgb[0]; img.data[o + 1] = rgb[1]; img.data[o + 2] = rgb[2];
            }
        }
    }

    // ── 4. the disc: its marks, shared by the pencil drawing and the gold itself ──
    // The parts, in the units of the old 300-px drawing (radius 140) from the disc's centre: [x, y, radius].
    const REGIONS = { disc: [0, 0, 140], map: [-54, 18, 62], figures: [56, -12, 40] };
    const ANCHORS = { disc: [128, 52], map: [-54, 18], figures: [56, -22] };
    /** Every mark on the disc for a disc of radius R art px: plot(dx, dy, part) from the centre. Parts: 2 the map, 3 the two
        figures, 4 the sun and its planets, hydrogen, the sign for how to play it. (DiscDocument's first drawing, scaled.) */
    function discMarks(R, plot) {
        const s = R / 140, rand = seeded(1977);
        const dot = (x, y, part) => plot(Math.round(x * s), Math.round(y * s), part);
        const line = (xa, ya, xb, yb, part) => { const n = Math.max(1, Math.ceil(Math.hypot(xb - xa, yb - ya) * s * 1.5)); for (let k = 0; k <= n; k++) dot(xa + (xb - xa) * k / n, ya + (yb - ya) * k / n, part); };
        const ring = (cx, cy, r, part) => { const st = 0.45 / Math.max(1, r * s); for (let a = 0; a < 6.2832; a += st) dot(cx + Math.cos(a) * r, cy + Math.sin(a) * r, part); };
        const ox = -54, oy = 18;
        for (let k = 0; k < 14; k++) {                                                                // fourteen pulsars, each with its ticking along its line
            const angle = (k / 14) * 6.283 + rand() * 0.3, length = 22 + rand() * 40;
            line(ox, oy, ox + Math.cos(angle) * length, oy + Math.sin(angle) * length, 2);
            for (let t = 8; t < length; t += 4) if (rand() < 0.6) dot(ox + Math.cos(angle) * t - Math.sin(angle) * 2, oy + Math.sin(angle) * t + Math.cos(angle) * 2, 2);
        }
        [[46, 0], [66, 1]].forEach(([x, isWaving]) => {                                               // two figures; the right one waves
            ring(x, -36, 4, 3); line(x, -32, x, -8, 3); line(x, -8, x - 5, 10, 3); line(x, -8, x + 5, 10, 3);
            line(x, -26, x - 7, -14, 3); if (isWaving) line(x, -26, x + 8, -36, 3); else line(x, -26, x + 7, -14, 3);
        });
        ring(-90, 86, 6, 4);                                                                          // our sun, its planets, the probe's way out
        for (let k = 0; k < 9; k++) ring(-72 + k * 15, 86, k === 4 || k === 5 ? 4 : 2, 4);
        for (let a = 3.4; a < 5.2; a += 0.02) dot(-2 + Math.cos(a) * 46, 122 + Math.sin(a) * 40, 4);
        ring(72, 54, 5, 4); ring(94, 54, 5, 4); line(77, 54, 89, 54, 4);                              // hydrogen: the ruler for everything else
        ring(0, -98, 16, 4); for (let a = 0; a < 6.283; a += 0.39) line(Math.cos(a) * 16, -98 + Math.sin(a) * 16, Math.cos(a) * 20, -98 + Math.sin(a) * 20, 4);   // how to play it
        ring(0, 0, 7, 1);                                                                             // the hole in the middle
    }

    // ── 5. the disc in pencil, on a page from a logbook ──
    /** layout (art px): { cx, cy, R, marginX, headY, rule }. Returns the page's pixels, which part each pencil mark belongs to
        (1 the disc's outline, its grooves and shading, 2 the map, 3 the figures, 4 the rest) and how hard it was pressed. */
    function sketch(W, H, L) {
        const p = paper(W, H, { seed: 31, ramp: LOGPAPER, fold: { axis: 'x', at: 0.5 }, corner: 'br' });
        for (let y = L.headY + L.rule; y < H - 3; y += L.rule) for (let x = 3; x < W - 3; x++) if (p.get(x, y)[3]) cover(p, x, y, RULE, 0.5);   // the ruled lines
        for (let x = 2; x < W - 2; x++) if (p.get(x, L.headY)[3]) cover(p, x, L.headY, RULE, 0.8);
        for (let y = 2; y < H - 2; y++) if (p.get(L.marginX, y)[3]) { if (hash(L.marginX, y, 33) > 0.06) p.set(L.marginX, y, MARGIN); cover(p, L.marginX + 1, y, MARGIN, 0.3); }
        const part = new Uint8Array(W * H), press = new Float32Array(W * H), rand = seeded(5);
        const mark = (x, y, k, v) => {
            x = Math.round(x); y = Math.round(y);
            if (x < 0 || y < 0 || x >= W || y >= H || !p.get(x, y)[3]) return;
            const i = y * W + x; if (press[i] >= v) return;
            press[i] = v; part[i] = k; p.solid(x, y, GRAPHITE, v);
        };
        const { cx, cy, R } = L;
        for (let pass = 0; pass < 2; pass++) {                                                         // the outline, twice round, not quite closed
            const r0 = R - pass * 1.3, a0 = pass ? 0.5 : -0.2, a1 = a0 + 6.2832 + (pass ? 0.25 : 0.35);
            for (let a = a0; a < a1; a += 0.35 / R) {
                if (hash(Math.round(a * 60), pass, 7) < (pass ? 0.16 : 0.06)) continue;
                const r = r0 + (vnoise(a * 2.2, pass, 11) - 0.5) * 1.6;
                mark(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 1, pass ? 0.42 : 0.66 + rand() * 0.15);
            }
        }
        [0.86, 0.91].forEach((f, i) => { for (let a = 0; a < 6.2832; a += 0.4 / R) if (hash(Math.round(a * 50), i, 9) > 0.4) mark(cx + Math.cos(a) * R * f, cy + Math.sin(a) * R * f, 1, 0.26); });   // the grooves
        for (let y = Math.floor(cy - R); y <= cy + R; y++) for (let x = Math.floor(cx - R); x <= cx + R; x++) {   // shading, in hatching, darker to the lower right
            const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy); if (d > R - 2) continue;
            const s = clamp01(0.5 + 0.55 * (dx + dy) / (R * 1.414));
            if (s > 0.58 && (x + y) % 5 === 0 && vnoise(x / 3, y / 3, 21) > 0.3) mark(x, y, 1, 0.06 + 0.2 * (s - 0.58) / 0.42);
            if (s > 0.84 && ((x - y) % 6 + 6) % 6 === 0 && vnoise(x / 3, y / 3, 22) > 0.35) mark(x, y, 1, 0.14);
        }
        discMarks(R, (dx, dy, k) => mark(cx + dx, cy + dy, k, 0.6 + hash(cx + dx, cy + dy, 3) * 0.25));
        for (let i = 0; i < 3; i++) {                                                                  // a graphite smudge where a hand rested
            const sx = cx + (rand() - 0.6) * R * 1.6, sy = cy + R * (0.6 + rand() * 0.4);
            for (let y = -4; y <= 4; y++) for (let x = -9; x <= 9; x++) if (hash(Math.round(sx + x), Math.round(sy + y), 23) > 0.55 + Math.hypot(x / 9, y / 4) * 0.45) mark(sx + x, sy + y, 4, 0.1);
        }
        return { data: p.data, part, press };
    }
    /** The page with one part pointed at: the rest of the page in shadow, that part's pencil pressed harder. */
    function sketchFocus(base, W, H, L, key) {
        const data = new Uint8ClampedArray(base.data);
        if (!key) return data;
        const s = L.R / 140, PART = { disc: 1, map: 2, figures: 3 };
        if (key === 'margin') dimOutside(data, W, H, (x, y) => y - L.headY, 0.34);
        else {
            const [rx, ry, rr] = REGIONS[key] || REGIONS.disc, cx = L.cx + rx * s, cy = L.cy + ry * s, r = rr * s + (key === 'disc' ? 2 : 4);
            dimOutside(data, W, H, (x, y) => Math.hypot(x - cx, y - cy) - r, 0.34);
            const k = PART[key];
            for (let i = 0; i < W * H; i++) if (base.part[i] === k || (key === 'disc' && base.part[i])) {
                const x = i % W, y = (i / W) | 0, rgb = GRAPHITE.rgb[level(GRAPHITE, Math.min(1, base.press[i] + 0.3), x, y)];
                data[i * 4] = rgb[0]; data[i * 4 + 1] = rgb[1]; data[i * 4 + 2] = rgb[2];
            }
        }
        return data;
    }

    // ── 6. the gold disc itself ──
    /** The gold disc, D art px across: brushed gold whose two bright fans turn slowly, grooves round the rim, every mark cut into
        the metal (dark, with the far wall of each cut catching the light). frame(img, t, focus) paints it at t ms; focus is a key
        of REGIONS, and the rest of the disc dims while that part lights up. */
    function gold(D) {
        const n = D * D, C = (D - 1) / 2, R = D / 2 - 0.5, ang = new Float32Array(n), dist = new Float32Array(n), cut = new Uint8Array(n);
        for (let y = 0; y < D; y++) for (let x = 0; x < D; x++) { const i = y * D + x; ang[i] = Math.atan2(y - C, x - C); dist[i] = Math.hypot(x - C, y - C); }
        discMarks(R - 2, (dx, dy, part) => { const x = Math.round(C + dx), y = Math.round(C + dy); if (x >= 0 && y >= 0 && x < D && y < D) cut[y * D + x] = part; });
        const s = (R - 2) / 140, PART = { map: 2, figures: 3 };
        function frame(img, t, focus) {
            const d8 = img.data, turn = t / 4200, f = focus && focus !== 'disc' ? REGIONS[focus] : null;
            const fx = f ? C + f[0] * s : 0, fy = f ? C + f[1] * s : 0, fr = f ? f[2] * s : 0;
            for (let y = 0; y < D; y++) for (let x = 0; x < D; x++) {
                const i = y * D + x, o = i * 4, d = dist[i];
                if (d > R) { d8[o + 3] = 0; continue; }
                d8[o + 3] = 255;
                const isIn = !f || Math.hypot(x - fx, y - fy) < fr, k = cut[i];
                if (k) {
                    const lit = isIn && (!f || k === PART[focus]) && f;
                    const rgb = lit ? ETCH_LIT : ETCH; d8[o] = rgb[0]; d8[o + 1] = rgb[1]; d8[o + 2] = rgb[2]; continue;
                }
                let v = 0.44 + 0.3 * Math.cos(2 * (ang[i] - turn)) + 0.08 * (1 - d / R) + (d > R - 3 ? 0.18 : 0);
                if (d > R * 0.8 && Math.floor(d) % 3 === 0) v -= 0.22;                                // the grooves round the rim
                if (d < 9 * s) v = d < 4 * s ? 0.06 : v + 0.12;                                       // the hole in the middle
                if (x > 0 && y > 0 && cut[i - D - 1] && !cut[i]) v += 0.24;                           // the far wall of a cut catches the light
                if (f && !isIn) v *= 0.45;
                const rgb = GOLD.rgb[level(GOLD, v, x, y)]; d8[o] = rgb[0]; d8[o + 1] = rgb[1]; d8[o + 2] = rgb[2];
            }
        }
        return { D, frame };
    }

    window.NSFindArt = Object.freeze({ paper, emblem, bezel, led, plate, plateGlint, sketch, sketchFocus, gold, discMarks, REGIONS, ANCHORS, GLINT_MS });
})();
