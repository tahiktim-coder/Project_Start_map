/* ═══ Silent Exodus · new screen (?new=1) · start/LaunchArt.js: the six shots of the launch film ══════════════════════
   What it is: the opening film's pictures, a news broadcast from the launch yard at dusk, 42.5 s (take two): the yard
   (eight scorched empty pads, hull nine floodlit, hull ten in scaffolding), the crowd, the five on the podium in dress
   uniform, the walk to the lift, ignition, the long-lens climb until the ship is one point of light.
   Source: prototypes/films/launch.html (take two, 2026-10-10), the shots and their drawing ported unchanged: V3Paint is
   NSPaint, window.NS_DRESS is window.NS_DRESS (start/Dress.js), no URL reads, and the drawing closes over the canvas
   that create() is given instead of the page's #art. The words (LINES) are the film's own, as they are. The player, the
   broadcast graphics and the sound score are in start/LaunchFilm.js; the sound kit in start/FilmSound.js.
   Loaded only when the new-screen switch is on. Needs NSPaint and CrewEngine (with Dress.js before the five people).

   window.NSLaunchArt (frozen)
     AW, AH (640 x 360 art px), TICK (125 ms), DUR (42500 ms), LINES [{ t0, t1, kicker, line, names? }],
     COUNT { t0, zero }, LIVE_ENDS, FADE [t0, t1], CLIMB_AT
     create(canvas) → { ctx, SHOTS: [{ id, t0, t1, caption, build() → state, draw(t, state) }] }
                             sizes the canvas to 640 x 360 and draws every shot into it
*/
(function () {
    'use strict';
    const P = window.NSPaint;
    if (!window.NEW_SCREEN || !P) return;
    const { INK, RP, ramp, clamp01, smooth, lerp, hash, fbm, seeded, threshold } = P;
    const AW = 640, AH = 360, TICK = 125, DUR = 42500;

    // ════════════════════════════════════ the lines (every word on screen) ════════════════════════════════════
    // Plain words, one idea each (docs/STYLE.md). [placeholder] = depends on what the public was told; kept neutral.
    const LINES = [
        { t0: 1200, t1: 6400, kicker: 'Live · The launch yard', line: 'Tonight the ninth Exodus ship leaves Earth.' },
        { t0: 13000, t1: 19400, kicker: 'The crew of Exodus-9', line: 'They will sleep for sixty-one years.', names: 'Mira Chen · Jaxon Mercer · Cora Moon · Kael Vance · Aris Novak' },   // in stage order, left to right. [placeholder] five names on air: if the count question takes Cora off the official list, the strap shows four
        { t0: 35400, t1: 39600, kicker: 'Live · The launch yard', line: 'Exodus-9 is on its way.' },
    ];
    const COUNT = { t0: 26500, zero: 29500 };   // the clock shows only the last three seconds, on the ignition shot
    const LIVE_ENDS = 40000;                     // the broadcast's graphics leave; only the ship and the dark remain
    const FADE = [40400, 42500];
    const CLIMB_AT = 34000;                      // the long lens: the roar drops to a distant one

    function create(cv) {
        const CE = window.CrewEngine;
        const ctx = cv.getContext('2d', { alpha: false });
        cv.width = AW; cv.height = AH; ctx.imageSmoothingEnabled = false;
        const ease = k => k * k * (3 - 2 * k);
        const step8 = t => Math.floor(t / TICK) * TICK;           // the moving details step eight times a second

        // ── colour ramps for the yard (each starts at the shared ink) ──
        const R = {
            NIGHT: ramp(INK, '#0a1016', '#111b24', '#1a2a36', '#26394a', '#36506a'),
            GLOW: ramp(INK, '#1a1210', '#3a2216', '#6e3a1e', '#b0602a', '#e89a48', '#ffd08a'),
            CLOUD: ramp(INK, '#16121a', '#2a1e24', '#4a2e2a', '#7a4630', '#b87040', '#e8a860'),
            HILL: ramp(INK, '#0b0d11', '#12161c', '#1a2028', '#232b35'),
            CONC: ramp(INK, '#141618', '#25282a', '#3b3f40', '#5d6160', '#8c8f8a', '#c4c6bc'),
            STEEL: ramp(INK, '#11161a', '#1f272d', '#323d44', '#56646c', '#8a9aa0', '#c6d2d2'),
            CROWD: ramp(INK, '#0d0a09', '#1a120e', '#2c1e15', '#58391f', '#a06a36', '#e8b070'),
            FLAG: ramp(INK, '#0e1626', '#18243c', '#243656', '#344c74', '#4a6694'),
            CREAM: ramp(INK, '#3a3226', '#7a6a50', '#c4b08a', '#f0e2c0', '#fffaf0'),
            FLOOD: ramp(INK, '#2a2418', '#5a4a30', '#a08a5a', '#e8d6a0', '#fff6dc'),
            WOOD: ramp(INK, '#1e140c', '#3a2616', '#5e3e22', '#8a5f34', '#b8864e'),
            SMOKE: ramp(INK, '#14181c', '#283038', '#46525c', '#7a8a94', '#b8c8d0', '#eef6f8'),
            WELD: ramp(INK, '#5a3010', '#c06a20', '#ffb050', '#fff0c0', '#ffffff'),
            GOLD: ramp(INK, '#4a3410', '#8a6420', '#c49a3a', '#e8c66a', '#fff0b0'),
            RED: RP.RED, PLUME: RP.PLUME, HULL: RP.HULL, STAR: RP.STAR, GROUND: RP.GROUND, SUN: RP.SUN, AMBER: RP.AMBER,
        };

        // ════════════════════════════════════ shared drawing pieces ════════════════════════════════════
        /** A dusk sky into an opaque painter: night above, a warm band where the sun went down, long clouds lit from below. */
        function sky(p, horizon, gx, glow, seed) {
            p.region(0, 0, p.W, horizon + 1, (x, y) => {
                const k = y / horizon, vn = 0.07 + 0.55 * Math.pow(k, 1.7);
                const gv = glow * (0.95 * Math.pow(k, 3.4) + 0.62 * Math.exp(-Math.hypot((x - gx) / 190, (y - horizon) / 34)));
                let c = fbm(x / 120, y / 6.5, seed, 4) - 0.56;                               // long thin clouds
                c *= smooth(0.25, 0.5, k) * (1 - smooth(0.86, 0.98, k));
                if (c > 0) { const lit = 0.18 + 2.6 * c * (0.3 + glow * Math.exp(-Math.abs(x - gx) / 260)) * (0.4 + 0.8 * k); p.tone(x, y, R.CLOUD, lit + (fbm(x / 9, y / 3, seed + 2, 2) - 0.5) * 0.12); return; }
                if (smooth(0.1, 0.42, gv) > threshold(x + 3, y + 5)) p.tone(x, y, R.GLOW, gv); else p.tone(x, y, R.NIGHT, vn);
            });
            return P.keepVisible(p, P.scatterStars(p, seed + 5, Math.round(p.W * horizon / 260), (x, y) => y < horizon * 0.5));
        }
        function hills(p, horizon, seed) {
            for (let x = 0; x < p.W; x++) {
                const far = horizon - 5 - 12 * fbm(x / 90, 0.5, seed, 3), near = horizon - 1 - 6 * fbm(x / 40, 3.5, seed + 1, 3);
                for (let y = Math.floor(far); y <= horizon; y++) p.tone(x, y, y >= near ? R.HILL : R.NIGHT, y >= near ? 0.55 : 0.32);
            }
        }
        function ground(p, horizon, seed, lit) {
            p.region(0, horizon + 1, p.W, p.H, (x, y) => p.tone(x, y, R.GROUND, 0.1 + 0.28 * Math.exp(-(y - horizon) / 9) + (lit ? lit(x, y) : 0) + (fbm(x / 6, y / 2.2, seed, 3) - 0.5) * 0.18));
        }
        /** A see-through cone of light: the pixels fall on the ramp, only some of them are drawn (cover). */
        function beam(p, x0, y0, x1, y1, w0, w1, r, v, a) {
            const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0)), dx = (x1 - x0) / n, dy = (y1 - y0) / n, nx = -dy, ny = dx;
            for (let i = 0; i <= n; i++) {
                const k = i / n, w = lerp(w0, w1, k), fall = (1 - k) * (1 - k);
                for (let j = -w; j <= w; j += 0.7) { const e = 1 - Math.abs(j) / (w + 0.01); p.cover(x0 + dx * i + nx * j, y0 + dy * i + ny * j, r, v * (0.5 + 0.5 * fall), a * e * (0.3 + 0.7 * fall)); }
            }
        }
        /** Pixel-font words at a whole-number scale, centred on cx. */
        function bigText(p, str, cx, y, k, r, v) {
            const x0 = Math.round(cx - P.pixelTextWidth(str) * k / 2);
            P.pixelText(str, 0, 0, (gx, gy) => p.region(x0 + gx * k, y + gy * k, x0 + gx * k + k, y + gy * k + k, (a, b) => p.tone(a, b, r, v)));
        }
        const steelBar = (p, x0, y0, x1, y1, v, w = 1) => p.line(x0, y0, x1, y1, (x, y) => p.region(x, y, x + w, y + 1, (a, b) => p.tone(a, b, R.STEEL, a === x ? v : v * 0.6)));
        /** A lattice service tower: two legs, cross braces, a platform on top. s = scale. Lit from the left. */
        function tower(p, x, base, h, w, s, v = 0.4) {
            steelBar(p, x, base, x, base - h, v + 0.12, s > 0.7 ? 2 : 1); steelBar(p, x + w, base, x + w, base - h, v * 0.7, s > 0.7 ? 2 : 1);
            const stepY = Math.max(4, 7 * s);
            for (let y = base; y > base - h + stepY; y -= stepY) { steelBar(p, x, y, x + w, y - stepY, v * 0.55); steelBar(p, x, y - stepY, x + w, y - stepY, v * 0.75); }
            p.region(x - 2 * s, base - h - 2 * s, x + w + 2 * s + 1, base - h, (a, b) => p.tone(a, b, R.STEEL, b === Math.floor(base - h - 2 * s) ? 0.7 : 0.35));
            return [Math.round(x + w / 2), Math.round(base - h - 3 * s)];      // where its aviation light sits
        }
        /** An empty launch pad, seen low and from the front: a concrete apron, its centre burnt black, a flame trench. */
        function emptyPad(p, x, y, s, seed) {
            p.ellipse(x, y, 30 * s, 5.2 * s, (a, b, qq) => p.tone(a, b, R.CONC, 0.36 - qq * 0.12 + (b < y ? 0.06 : 0) + (fbm(a / 3, b / 2, seed, 2) - 0.5) * 0.14));
            p.ellipse(x, y - 0.4 * s, 12 * s, 2.3 * s, (a, b, qq) => { if (fbm(a / 2.4, b / 1.6, seed + 4, 2) < 0.62 + qq * 0.3) p.tone(a, b, R.CONC, 0.04); });
            p.region(x - 5 * s, y + 2 * s, x + 5 * s, y + 4.6 * s, (a, b) => p.tone(a, b, R.CONC, 0.03));
            return tower(p, x + 16 * s, y - 1, 74 * s, 6 * s, s, 0.3);
        }
        /** Our Lander standing on its tail, legs out. o: x, base (the ground under the bell), len; returns at(u, v). */
        function standingLander(p, o) {
            const len = o.len, ht = len / 3.15, x = o.x, base = o.base, bell = base - Math.round(len * 0.05);
            const at = P.hull(p, { x, y: bell, len, ht, angle: -Math.PI / 2, flip: true, anchor: 1, seed: 9, ramp: o.ramp || R.HULL,
                sun: o.sun || 0, sunDir: o.sunDir || [-1, 0], light: o.light, flat: len < 90 }, o.shape || P.shapeL);
            [-1, 1].forEach(side => {                                                                 // the legs, down and out
                const [lx, ly] = at(0.9, side * 0.6), fx = x + side * ht * 0.95, w = Math.max(1, Math.round(len / 70));
                p.line(lx, ly, fx, base - 1, (a, b) => p.region(a, b, a + w, b + 1, (c, d) => p.tone(c, d, R.HULL, side < 0 ? 0.62 : 0.3)));
                p.region(fx - 2 * w, base - 1, fx + 2 * w + 1, base + 1, (c, d) => p.tone(c, d, R.HULL, side < 0 ? 0.55 : 0.3));
            });
            return at;
        }
        /** Hull ten's shape: the Lander's, longer in the decks, a second ring round the drive, the top half still bare frames. */
        function shapeTen(u, v, o) {
            const l = P.shapeL(u, v, o);
            if (l < 0) return -1;
            const pu = u * o.len, built = o.built == null ? 0.48 : o.built;
            if (u > 0.79 && u < 0.83) return l + 0.12;                                               // the new drive's collar
            if (u > built) return l;
            const rib = (pu % 9) < 1.4, edge = Math.abs(Math.abs(v) - 0.47) * o.ht < 1.1, spine = Math.abs(v + 0.1) * o.ht < 0.8;
            if (rib || edge || spine) return l * 0.85;
            const strip = Math.floor((v + 1) * o.ht / 6), plate = built - 0.07 * hash(strip, 5, 3);      // plates going on in whole strips: a stepped top edge
            if (u > plate) return (u - plate) * o.len < 1.2 ? l * 0.55 : l - 0.05;
            return -1;                                                                                // open: the sky shows through
        }
        /** The programme emblem: the star map from the gold disc (lines out from one point, one long line). [placeholder: it is only
            drawn because the opening storyboard B suggested it; drop it if the 2029 message is cut.] */
        const EMBLEM = Array.from({ length: 14 }, (_, i) => { const r = seeded(77 + i); return [i / 14 * Math.PI * 2 + r() * 0.3, 0.42 + r() * 0.58]; });
        function emblem(set, cx, cy, rad) {
            EMBLEM.forEach(([a, l]) => { const n = Math.round(rad * l); for (let k = 2; k <= n; k++) set(cx + Math.cos(a) * k, cy + Math.sin(a) * k * 0.92, k === n); });
            for (let k = 2; k <= rad * 1.25; k++) set(cx + k, cy, false);
            set(cx, cy, true);
        }

        // ── people in the crowd: a silhouette with a rim where the light comes from ──
        /** Paints one person from behind into painter p, as a near-black silhouette with a rim of light on the edges that face the
            light (heads brightest, shoulders less). kind: 0 plain, 1 arm up, 2 phone up, 3 child on shoulders. */
        function crowdPerson(p, cx, base, s, seed, kind, toLight, rimV = 0.78, rr = R.CROWD) {
            const r = seeded(seed), hr = 3.0 * s * (0.86 + r() * 0.28), sh = 6.2 * s * (0.86 + r() * 0.3), headY = base - 8.6 * s - hr, lean = (r() - 0.5) * 1.6 * s;
            const hat = r() < 0.16, bun = !hat && r() < 0.22, hood = !hat && !bun && r() < 0.15, armSide = r() < 0.5 ? -1 : 1, kid = kind === 3;
            const shapes = [[cx + lean, headY, hr, hr * 1.14], [cx, base + 1.5 * s, sh, 8 * s], [cx + lean * 0.5, headY + hr + 1.2 * s, hr * 0.6, 2.4 * s]];
            if (hat) shapes.push([cx + lean, headY - hr * 0.5, hr * 1.45, hr * 0.38], [cx + lean, headY - hr * 0.8, hr * 0.9, hr * 0.5]);
            if (bun) shapes.push([cx + lean + hr * 0.3, headY - hr * 0.95, hr * 0.42, hr * 0.42]);
            if (hood) shapes.push([cx + lean, headY + hr * 0.2, hr * 1.25, hr * 1.2]);
            if (kid) shapes.push([cx + lean, headY - hr * 2.1, hr * 0.78, hr * 0.84], [cx + lean, headY - hr * 0.95, hr * 1.25, hr * 0.85]);
            const limbs = [];
            if (kind === 1 || kind === 2) { const ax = cx + armSide * sh * 0.62, hy = headY - hr * (2.1 + r() * 1.3); limbs.push([ax, base - 5 * s, ax + armSide * 1.2 * s, hy, Math.max(0.8, 1.15 * s)]); }
            const inside = (x, y) => shapes.some(([ex, ey, rx, ry]) => ((x + 0.5 - ex) / rx) ** 2 + ((y + 0.5 - ey) / ry) ** 2 < 1) ||
                limbs.some(([x0, y0, x1, y1, w]) => { const t = clamp01(((x - x0) * (x1 - x0) + (y - y0) * (y1 - y0)) / ((x1 - x0) ** 2 + (y1 - y0) ** 2)); return Math.hypot(x - (x0 + (x1 - x0) * t), y - (y0 + (y1 - y0) * t)) < w; });
            const [lx, ly] = toLight, top = Math.floor(headY - hr * (kid ? 3.2 : 2) - (limbs.length ? 4 * hr : 0) - 2), thick = s > 1.4 ? 2 : 1;
            p.region(cx - sh - 3 * s - 2, top, cx + sh + 3 * s + 2, base + 10 * s, (x, y) => {
                if (!inside(x, y)) return;
                let rim = 0;
                for (let k = 1; k <= thick; k++) if (!inside(x + lx * k, y + ly * k)) { rim = k; break; }
                const upper = y < headY + hr * 1.4 ? 1 : 0.62;
                p.tone(x, y, rim ? rr : R.CROWD, rim ? (rimV - (rim - 1) * 0.25) * upper : 0.025 + (fbm(x / 3, y / 3, seed, 2) - 0.5) * 0.05);
            });
            if (kind === 2 && limbs.length) { const [, , x1, y1] = limbs[0]; p.region(x1 - 1.3 * s, y1 - 2.6 * s, x1 + 1.3 * s, y1 + 0.4 * s, (x, y) => p.tone(x, y, R.CROWD, 0.02)); }
            return limbs.length ? limbs[0] : null;
        }
        /** A packed band of crowd, back rows first; neighbours overlap so it reads as one mass with lit heads.
            rows: [[baseY, scale, density, rimV]]; rr: the rim's ramp. Returns raised hands (for flags and phones drawn on top). */
        function crowdBand(p, rows, toLight, seed, x0 = 0, x1 = p.W, rr = R.CROWD) {
            const hands = [];
            rows.forEach(([base, s, density, rimV], ri) => {
                const r = seeded(seed + ri * 31), count = Math.ceil((x1 - x0) / (7.4 * s) * density), gap = (x1 - x0) / count;
                for (let i = 0; i < count; i++) {
                    const x = x0 + (i + 0.15 + r() * 0.7) * gap, kindR = r(), kind = kindR < 0.09 ? 2 : kindR < 0.17 ? 1 : kindR < 0.2 && s > 0.6 ? 3 : 0;
                    const hand = crowdPerson(p, x, base + (r() - 0.5) * 4 * s, s, seed + ri * 977 + i, kind, toLight, rimV, rr);
                    if (hand) hands.push({ x: hand[2], y: hand[3], s, kind });
                }
            });
            return hands;
        }
        /** The nearest crowd as one dark mass: the gaps between shoulders filled in black first, so only the heads and the shoulder
            line catch the light (people packed together, never a row of separate bubbles). */
        function crowdMass(p, rows, toLight, seed, x0, x1, rr) {
            const [base, s] = rows[0];
            p.region(x0, base + 3 * s, x1, p.H, (x, y) => p.solid(x, y, R.CROWD, 0.02 + (fbm(x / 5, y / 5, seed, 2) - 0.5) * 0.04));
            return crowdBand(p, rows, toLight, seed, x0, x1, rr);
        }
        /** A waving flag, drawn every frame. The cloth ripples away from the pole; the emblem rides on it. */
        function flag(L, px, py, w, h, t, seed, pole = true) {
            if (pole) for (let y = py - 1; y < py + h * 2.6; y++) L.tone(px, y, R.STEEL, 0.5);
            const ph = t / 380 + seed;
            for (let x = 0; x < w; x++) {
                const k = x / w, off = Math.sin(k * 5.2 - ph) * h * 0.16 * k, slope = Math.cos(k * 5.2 - ph) * k;
                for (let y = 0; y < h; y++) {
                    const gx = px + 1 + x, gy = py + y + off, e = (x === w - 1 || y === 0) ? 0.06 : 0;
                    L.tone(gx, gy, R.FLAG, 0.42 + slope * 0.32 + e);
                }
            }
            if (w >= 14) { const rad = Math.round(h * 0.34); emblem((x, y, tip) => { const k = (x - px - 1) / w; L.tone(x, y + Math.sin(k * 5.2 - ph) * h * 0.16 * k, R.CREAM, tip ? 0.9 : 0.66); }, px + 1 + Math.round(w * 0.38), py + Math.round(h / 2), rad); }
        }
        /** A camera flash: a white star, gone in two ticks. */
        function flashes(f, t, n, box, seed) {
            const st = Math.floor(t / TICK);
            for (let i = 0; i < n; i++) {
                if (hash(i, st, seed) < 0.93) continue;
                const x = box[0] + hash(i, st + 1, seed) * (box[2] - box[0]), y = box[1] + hash(i, st + 2, seed) * (box[3] - box[1]);
                f.glow(x, y, 6, R.CREAM, 0.75); f.px(x - 2, y, R.CREAM.hex[4], 5, 1); f.px(x, y - 2, R.CREAM.hex[4], 1, 5);
            }
        }
        function blink(f, x, y, t, period, phase, on = 0.35) {
            if (((t + phase) % period) / period < on) { f.glow(x, y, 3, R.RED, 0.7); f.px(x, y, R.RED.hex[4]); } else f.px(x, y, R.RED.hex[2]);
        }

        // ════════════════════════════════════ the shots ════════════════════════════════════
        const SHOTS = [];
        const shot = (o) => { SHOTS.push(o); return o; };

        // 1 · THE YARD, WIDE (0-7 s): eight empty pads going back into the dusk, hull nine floodlit on the ninth, hull ten in its
        //     scaffolding; the crowd along the fence in front. The camera drifts right, from the empty pads to the two hulls.
        const YARD = { W: 820, horizon: 232, gx: 420, ship: [566, 270], ten: [722, 274] };
        shot({
            id: 'yard', t0: 0, t1: 7000, caption: 'The yard at dusk: eight empty pads, hull nine floodlit, hull ten in scaffolding.',
            build() {
                const p = P.painter(YARD.W, AH, true), Y = YARD;
                const stars = sky(p, Y.horizon, Y.gx, 1, 11);
                hills(p, Y.horizon, 3);
                const pools = [[Y.ship[0] - 4, Y.ship[1], 90, 0.22], [Y.ten[0], Y.ten[1], 70, 0.12]];
                ground(p, Y.horizon, 5, (x, y) => pools.reduce((s, [px, py, r, v]) => s + v * Math.exp(-Math.hypot((x - px) / r, (y - py) / (r * 0.18))), 0) + 0.2 * smooth(268, 300, y) * (0.6 + 0.4 * fbm(x / 40, 1, 6, 2)));
                const lights = [];
                for (let i = 0; i < 8; i++) { const k = i / 7, s = lerp(0.36, 0.8, k * k); lights.push(emptyPad(p, lerp(36, 470, Math.pow(k, 1.25)), lerp(240, 264, k * k), s, 40 + i)); }
                // hull ten, inside its scaffolding, a crane over it
                const [tx, tb] = Y.ten;
                P.hull(p, { x: tx, y: tb - 8, len: 168, ht: 168 / 3.6, angle: -Math.PI / 2, flip: true, anchor: 1, seed: 21, ramp: R.STEEL, light: 0.85, built: 0.5, sun: 0.18, sunDir: [-1, 0] }, shapeTen);
                for (let x = tx - 34; x <= tx + 34; x += 8.5) steelBar(p, x, tb, x, tb - 150, 0.24);
                for (let y = tb - 10; y > tb - 150; y -= 11) steelBar(p, tx - 34, y, tx + 34, y, 0.3);
                tower(p, tx + 52, tb, 196, 5, 0.8, 0.28);
                steelBar(p, tx - 48, tb - 196, tx + 62, tb - 196, 0.4, 2);
                p.line(tx - 10, tb - 195, tx - 10, tb - 166, (a, b) => p.tone(a, b, R.STEEL, 0.3));
                // hull nine: floodlit, its tower and arms, three light masts and their beams
                const [sx, sb] = Y.ship;
                p.ellipse(sx, sb, 40, 6.5, (a, b, qq) => p.tone(a, b, R.CONC, 0.62 - qq * 0.3 + (fbm(a / 3, b / 2, 4, 2) - 0.5) * 0.12));
                [[sx - 92, sb - 2], [sx + 70, sb + 1], [sx - 40, sb + 8]].forEach(([mx, mb]) => { steelBar(p, mx, mb, mx, mb - 54, 0.4); beam(p, mx, mb - 55, sx, sb - 60, 2, 26, R.FLOOD, 0.5, 0.42); });
                const at = standingLander(p, { x: sx, base: sb, len: 124 });
                lights.push(tower(p, sx + 30, sb, 132, 6, 1, 0.42));
                [0.3, 0.62].forEach(u => { const [hx, hy] = at(u, 0.5); steelBar(p, hx, hy, sx + 30, hy, 0.45); });
                P.pixelText('9', sx - 4, sb - 52, (a, b) => p.tone(a, b, R.HULL, 0.16));
                // the fence and the crowd behind it, backlit by the yard
                for (let x = 0; x < Y.W; x += 7) for (let y = 286; y < 304; y++) p.tone(x, y, R.STEEL, 0.18);
                for (let x = 0; x < Y.W; x++) { p.tone(x, 288, R.STEEL, 0.16); p.tone(x, 296, R.STEEL, 0.16); }
                const hands = crowdBand(p, [[308, 0.6, 1, 0.5], [322, 0.76, 1, 0.58], [339, 0.96, 1, 0.66], [360, 1.22, 1, 0.74]], [0, -1], 300);
                return { canvas: p.canvas(), stars, lights, hands, mastLamps: [[sx - 92, sb - 56], [sx + 70, sb - 53], [sx - 40, sb - 46]] };
            },
            draw(t, S) {
                const pan = Math.round(150 * ease(clamp01(t / 7000)));
                ctx.drawImage(S.canvas, -pan, 0);
                const f = P.framer(ctx, AW, AH), L = P.pixelLayer(AW, AH), ts = step8(t);
                P.twinkle(f, S.stars, ts, pan);
                [[YARD.ship[0] - 20, YARD.ship[1] - 6, 0.5], [YARD.ship[0] + 46, YARD.ship[1] - 4, -0.4]].forEach(([bx, by, ph], i) => {   // searchlights sweeping
                    const a = -Math.PI / 2 + Math.sin(t / 3400 + ph * 3) * 0.42 + ph * 0.25, len = 330, ca = Math.cos(a), sa = Math.sin(a);
                    for (let d = 6; d < len; d += 1) {
                        const w = 1.5 + d * 0.075, fall = 1 - d / len, cx = bx - pan + ca * d, cy = by + sa * d;
                        for (let k = -w; k <= w; k += 0.7) { const x = Math.round(cx - sa * k), y = Math.round(cy + ca * k), core = 1 - Math.abs(k) / (w + 0.5); if (0.4 * fall * (0.35 + 0.65 * core) > threshold(x + 2, y + 1)) L.tone(x, y, R.SMOKE, 0.3 + 0.36 * core * fall); }
                    }
                });
                L.draw(ctx);
                S.mastLamps.forEach(([x, y]) => { f.glow(x - pan, y, 6, R.FLOOD, 0.9); f.px(x - pan - 2, y - 1, R.FLOOD.hex[5], 5, 2); });
                S.lights.forEach(([x, y], i) => blink(f, x - pan, y, ts, 2000, i * 97, i === 8 ? 0.5 : 0.2));
                for (let i = 0; i < 9; i++) { const x = YARD.ten[0] - 30 + (i % 3) * 30 - pan, y = YARD.ten[1] - 30 - Math.floor(i / 3) * 40; if (hash(i, Math.floor(ts / 250), 3) > 0.15) f.px(x, y, R.AMBER.hex[3], 2, 1); }
                if (hash(1, Math.floor(ts / TICK), 9) > 0.6) { const x = YARD.ten[0] - 8 - pan, y = YARD.ten[1] - 120; f.glow(x, y, 4, R.WELD, 0.9); f.px(x, y, R.WELD.hex[4]); }
                const W8 = P.pixelLayer(AW, AH);
                S.hands.forEach((h, i) => { if (h.kind === 1 && i % 3 === 0) flag(W8, h.x - pan, h.y - 6 * h.s, Math.round(9 * h.s), Math.round(6 * h.s), t + i * 300, i, false); });
                W8.draw(ctx);
                S.hands.forEach((h, i) => { if (h.kind === 2) f.px(h.x - pan - 1, h.y - 2, R.CREAM.hex[hash(i, Math.floor(ts / 500), 4) > 0.5 ? 4 : 3], 2, 2); });
            },
        });

        // 2 · THE CROWD (7-12 s): closer, a packed crowd seen from behind, the heads black against the last of the sunset and the
        //     floodlit yard; three big programme flags, phones up, a child on someone's shoulders, paper confetti. Hull nine stands
        //     floodlit on the horizon above them.
        const CROWD = { W: 700, horizon: 196, ship: 470 };
        shot({
            id: 'crowd', t0: 7000, t1: 12000, caption: 'The crowd, black against the sunset and the floodlit yard: flags, phones, a child on shoulders.',
            build() {
                const p = P.painter(CROWD.W, AH, true), hz = CROWD.horizon, X = CROWD.ship;
                const stars = sky(p, hz, 250, 1, 23);
                hills(p, hz, 8);
                ground(p, hz, 9, (x, y) => 0.55 * Math.exp(-Math.hypot((x - X) / 150, (y - hz - 6) / 12)) + 0.18 * Math.exp(-(y - hz) / 30));
                for (let i = 0; i < 7; i++) emptyPad(p, 40 + i * 52, hz + 3 + i * 0.4, 0.34, 60 + i);
                [[X - 70, hz + 8], [X + 64, hz + 7]].forEach(([mx, mb]) => { steelBar(p, mx, mb, mx, mb - 44, 0.4); beam(p, mx, mb - 45, X, hz - 20, 2, 16, R.FLOOD, 0.5, 0.4); });
                standingLander(p, { x: X, base: hz + 9, len: 70 });
                tower(p, X + 18, hz + 9, 76, 4, 0.6, 0.38);
                p.region(0, hz - 50, CROWD.W, hz + 60, (x, y) => { const v = 0.42 * Math.exp(-Math.hypot((x - X) / 170, (y - hz) / 34)); if (v > 0.04) p.cover(x, y, R.FLOOD, 0.32, v); });   // haze over the yard
                const hands = crowdBand(p, [[hz + 24, 0.6, 1.1, 0.58], [hz + 40, 0.82, 1.05, 0.64], [hz + 66, 1.12, 1, 0.7], [hz + 104, 1.6, 0.95, 0.76], [hz + 168, 2.5, 0.85, 0.82], [hz + 236, 3.6, 0.75, 0.86]], [0.6, -1], 500, -20, CROWD.W + 20);
                return { canvas: p.canvas(), stars, hands, lamps: [[X - 70, hz - 37], [X + 64, hz - 38]], light: [X + 18, hz + 9 - 76 - 2] };
            },
            draw(t, S) {
                const pan = Math.round(40 * ease(clamp01(t / 5000)));
                ctx.drawImage(S.canvas, -pan, 0);
                const f = P.framer(ctx, AW, AH), ts = step8(t), L = P.pixelLayer(AW, AH);
                P.twinkle(f, S.stars, ts, pan);
                S.lamps.forEach(([x, y]) => { f.glow(x - pan, y, 5, R.FLOOD, 0.9); f.px(x - pan - 2, y, R.FLOOD.hex[5], 4, 1); });
                blink(f, S.light[0] - pan, S.light[1], ts, 2000, 0, 0.5);
                [[120, 150, 46, 30, 0], [344, 132, 54, 34, 2], [588, 158, 42, 28, 4]].forEach(([x, y, w, h, sd]) => flag(L, x - pan, y, w, h, t, sd));
                S.hands.forEach((h, i) => { if (h.kind === 1 && h.s < 1.2 && i % 2) flag(L, h.x - pan, h.y - 7 * h.s, Math.round(12 * h.s), Math.round(8 * h.s), t + i * 211, i, false); });
                for (let i = 0; i < 52; i++) {                                                     // paper confetti, drifting down through the light
                    const x = (hash(i, 1, 41) * 760 + Math.sin(t / 900 + i) * 6) - pan, y = (hash(i, 2, 41) * 400 + t / 1000 * (8 + hash(i, 3, 41) * 10)) % 380 - 10;
                    L.tone(x, y, hash(i, 4, 41) > 0.5 ? R.CREAM : R.FLOOD, 0.45 + 0.5 * (Math.sin(t / 160 + i) * 0.5 + 0.5));
                }
                L.draw(ctx);
                S.hands.forEach((h, i) => {
                    if (h.kind !== 2) return;
                    const v = hash(i, Math.floor(ts / 375), 4) > 0.4 ? 4 : 3, w = Math.max(2, Math.round(2.6 * h.s)), hh = Math.max(2, Math.round(3.4 * h.s));
                    f.px(h.x - pan - w / 2, h.y - 2.6 * h.s, R.CREAM.hex[v], w, hh);
                    if (h.s > 1.2) f.glow(h.x - pan, h.y - h.s, Math.round(4 * h.s), R.CREAM, 0.35);
                });
                flashes(f, t, 26, [0, 210, AW, 330], 13);
            },
        });

        // 3 · THE PODIUM (12-20 s): the five on an open stage at nightfall, under a truss of lamps. Each stands in the pool of its own
        //     spot; behind them a dark backdrop with the ship's name, two programme banners, and between them, far off, hull nine
        //     floodlit on its pad. Three layers drift at different speeds (sky, stage, the crowd's heads) so the stage has depth.
        //     Mira, Jaxon and Aris wave; Vance does not; Cora stands with her hands behind her back. The press pit flashes.
        const POD = { W: 680, floor: 280, back: 258, front: 290, skirt: 312, panel: [176, 120, 504], banners: [104, 524], ship: 600 };
        const CREW = [
            { id: 'mira', x: 220, facing: 1, wave: 'big', seed: 1 }, { id: 'jaxon', x: 276, facing: 1, wave: 'small', seed: 2 },
            { id: 'cora', x: 332, facing: 1, wave: null, seed: 3 }, { id: 'vance', x: 388, facing: -1, wave: null, seed: 4 },
            { id: 'aris', x: 444, facing: -1, wave: 'small', seed: 5 },
        ];
        const POD_LAMPS = [140, ...CREW.map(c => c.x), 540];
        shot({
            id: 'podium', t0: 12000, t1: 20000, caption: 'The podium: the five crew in dress uniform, each in their own spot; hull nine floodlit far behind.',
            build() {
                // far: the dusk, the yard, hull nine on its pad between the banners
                const bg = P.painter(660, AH, true), hz = 236, SX = POD.ship;
                const stars = sky(bg, hz, 470, 0.8, 31);
                hills(bg, hz, 7);
                ground(bg, hz, 8, (x, y) => 0.45 * Math.exp(-Math.hypot((x - SX) / 70, (y - hz - 4) / 8)));
                const bgLamps = [];
                [[552, hz + 5], [648, hz + 4]].forEach(([mx, mb]) => { steelBar(bg, mx, mb, mx, mb - 34, 0.36); beam(bg, mx, mb - 35, SX, hz - 20, 1.5, 12, R.FLOOD, 0.5, 0.36); bgLamps.push([mx, mb - 35]); });
                standingLander(bg, { x: SX, base: hz + 6, len: 62 });
                const shipLight = tower(bg, SX + 16, hz + 6, 66, 4, 0.5, 0.36);
                bg.region(SX - 120, hz - 70, SX + 120, hz + 12, (x, y) => { const v = 0.4 * Math.exp(-Math.hypot((x - SX) / 90, (y - hz + 10) / 30)); if (v > 0.05) bg.cover(x, y, R.FLOOD, 0.3, v); });
                // near: the stage, painted opaque where it is solid and see-through where the light is only in the air
                const st = P.painter(POD.W, AH, false), [p0, pTop, p1] = POD.panel;
                st.region(p0, pTop, p1, POD.back, (x, y) => {                                           // the backdrop: black cloth, scalloped by the lamps' spill
                    const fold = 0.5 + 0.5 * Math.sin((x - p0) / 4.6), spill = POD_LAMPS.reduce((s, lx) => s + Math.exp(-(((x - lx) / 16) ** 2) - (y - pTop) / 46), 0);
                    const behind = CREW.reduce((s, c) => s + Math.exp(-(((x - c.x) / 24) ** 2)), 0) * smooth(POD.back - 90, POD.back, y);
                    st.solid(x, y, R.FLAG, 0.05 + 0.06 * fold + 0.36 * spill * (0.7 + 0.3 * fold) + 0.3 * behind * (0.6 + 0.4 * fold) + (fbm(x / 6, y / 24, 3, 2) - 0.5) * 0.05 - (y > POD.back - 6 ? 0.04 : 0));
                });
                bigText(st, 'EXODUS-9', 332, 134, 3, R.GOLD, 0.62);
                POD.banners.forEach((bx, bi) => {                                                       // two banners, gold edged, the emblem on each
                    const w = 52, cx = bx + w / 2;
                    st.region(bx, 50, bx + w, 260, (x, y) => {
                        if (y > 244 + 10 * (1 - Math.abs(x + 0.5 - cx) / (w / 2))) return;
                        const fold = 0.5 + 0.5 * Math.sin((x - bx) / 3.2 + bi), lit = Math.exp(-(y - 50) / 70);
                        const edge = x === bx + 3 || x === bx + w - 4;
                        if (edge && y > 54) st.solid(x, y, R.GOLD, 0.3 + 0.4 * lit); else st.solid(x, y, R.FLAG, 0.16 + 0.14 * fold + 0.42 * lit + (x === bx ? 0.1 : 0));
                    });
                    st.region(bx - 3, 47, bx + w + 3, 50, (x, y) => st.solid(x, y, R.STEEL, y === 47 ? 0.6 : 0.3));
                    emblem((x, y, tip) => st.solid(x, y, R.GOLD, tip ? 0.95 : 0.7), cx - 4, 98, 15);
                    for (let y = 140; y < 230; y += 9) st.region(bx + 10, y, bx + w - 10, y + 1, (x, yy) => st.solid(x, yy, R.FLAG, 0.12));   // the hem lines
                });
                for (let x = 56; x < 624; x++) { st.solid(x, 36, R.STEEL, 0.55); st.solid(x, 37, R.STEEL, 0.3); st.solid(x, 45, R.STEEL, 0.36); }   // the truss
                for (let x = 56; x < 624; x += 12) { st.line(x, 37, x + 6, 45, (a, b) => st.solid(a, b, R.STEEL, 0.3)); st.line(x + 6, 45, x + 12, 37, (a, b) => st.solid(a, b, R.STEEL, 0.22)); }
                [60, 612].forEach(lx => {
                    for (let y = 45; y < POD.front; y++) { st.solid(lx, y, R.STEEL, 0.48); st.solid(lx + 8, y, R.STEEL, 0.24); }
                    for (let y = 45; y < POD.front - 10; y += 10) { st.line(lx, y, lx + 8, y + 5, (a, b) => st.solid(a, b, R.STEEL, 0.3)); st.line(lx + 8, y + 5, lx, y + 10, (a, b) => st.solid(a, b, R.STEEL, 0.2)); }
                });
                POD_LAMPS.forEach(lx => {                                                               // the lamps, hung under the truss
                    st.line(lx, 45, lx, 48, (a, b) => st.solid(a, b, R.STEEL, 0.4));
                    st.region(lx - 3, 48, lx + 4, 55, (x, y) => st.solid(x, y, R.STEEL, x === lx - 3 ? 0.5 : 0.18));
                });
                CREW.forEach(c => beam(st, c.x, 56, c.x, POD.floor - 6, 4, 30, R.FLOOD, 0.55, 0.26));   // each spot straight down on its person
                [[140, 130], [540, 550]].forEach(([lx, tx]) => beam(st, lx, 56, tx, 150, 2, 18, R.FLOOD, 0.45, 0.22));
                for (let y = POD.back; y <= POD.front; y++) {                                           // the deck, in perspective: boards run away from us
                    const k = (y - POD.back) / (POD.front - POD.back), xl = lerp(96, 36, k), xr = lerp(584, 644, k);
                    for (let x = Math.ceil(xl); x < xr; x++) {
                        const u = (x - 340) / (xr - 340), seam = (((u * 13) % 1) + 1) % 1 < 0.07 ? -0.12 : 0;
                        const pool = CREW.reduce((s, c) => s + 0.5 * Math.exp(-(((x - c.x) / 19) ** 2) - ((y - POD.floor) / 6) ** 2), 0);
                        st.solid(x, y, R.WOOD, y === POD.back ? 0.12 : y === POD.front ? 0.78 : 0.2 + 0.1 * k + pool + seam + (fbm(x / 14, y / 2, 4, 2) - 0.5) * 0.08);
                    }
                }
                CREW.forEach(c => st.ellipse(c.x, POD.floor + 1, 12, 2.2, (x, y) => st.solid(x, y, R.WOOD, 0.07)));
                st.region(36, POD.front + 1, 644, POD.skirt, (x, y) => st.solid(x, y, R.FLAG, 0.07 + (y === POD.front + 1 ? 0.06 : 0)));
                for (let x = 40; x < 640; x += 12) for (let k = 0; k < 6; k++) for (let j = -5 + k; j <= 5 - k; j++) st.solid(x + 6 + j, POD.front + 2 + k, (x / 12) % 2 ? R.CREAM : R.GOLD, (x / 12) % 2 ? 0.5 : 0.6);
                st.region(150, POD.floor - 34, 172, POD.floor + 2, (x, y) => st.solid(x, y, R.WOOD, x < 154 ? 0.6 : 0.3));   // the lectern
                st.region(146, POD.floor - 38, 176, POD.floor - 33, (x, y) => st.solid(x, y, R.WOOD, y === POD.floor - 38 ? 0.8 : 0.5));
                emblem((x, y) => st.solid(x, y, R.GOLD, 0.8), 161, POD.floor - 20, 6);
                [[156, -1], [166, 1]].forEach(([x, d]) => st.line(x, POD.floor - 38, x + d * 4, POD.floor - 48, (a, b) => st.solid(a, b, R.STEEL, 0.5)));
                [26, 654].forEach(x => { for (let y = 62; y < POD.front; y++) { st.solid(x, y, R.STEEL, 0.46); st.solid(x + 1, y, R.STEEL, 0.2); } });
                // nearest: the crowd's heads and the press pit's cameras, black against the stage, lit along the top
                const fr = P.painter(720, AH, false);
                const hands = crowdMass(fr, [[322, 1.7, 1.2, 0.52], [344, 2.3, 1.1, 0.62], [380, 3.2, 1.0, 0.72]], [0, -1], 900, -30, 750, R.CROWD);
                [[60, 318], [628, 316]].forEach(([x, y]) => {
                    fr.region(x - 9, y - 7, x + 10, y + 5, (a, b) => fr.solid(a, b, R.CROWD, b === y - 7 ? 0.5 : 0.06));
                    fr.region(x + 10, y - 4, x + 16, y + 2, (a, b) => fr.solid(a, b, R.CROWD, a === x + 15 ? 0.4 : 0.1));
                    for (let k = 0; k < 44; k++) { fr.solid(x - k * 0.25, y + 5 + k, R.STEEL, 0.25); fr.solid(x + k * 0.25, y + 5 + k, R.STEEL, 0.25); }
                });
                const warm = document.createElement('canvas').getContext('2d');                         // bake every idle frame now, so the cut never stalls
                CREW.forEach(c => [0, 750, 1550, 2450].forEach(ms => { CE.sprite(dressId(c.id), 'idle', CE.frameAt('idle', ms)); CE.draw(warm, dressId(c.id), 'idle', ms, 20, 60, { facing: c.facing, warm: 3, rim: -c.facing, seed: c.seed }); }));
                return { bg: bg.canvas(), stage: st.canvas(), front: fr.canvas(), stars, shipLight, bgLamps, hands };
            },
            draw(t, S) {
                const e = ease(clamp01(t / 8000)), bgPan = Math.round(6 * e), stPan = Math.round(14 * e), frPan = Math.round(34 * e), ts = step8(t);
                ctx.drawImage(S.bg, -bgPan, 0);
                const f = P.framer(ctx, AW, AH);
                P.twinkle(f, S.stars, ts, bgPan);
                S.bgLamps.forEach(([x, y]) => { f.glow(x - bgPan, y, 4, R.FLOOD, 0.85); f.px(x - bgPan - 1, y, R.FLOOD.hex[5], 3, 1); });
                blink(f, S.shipLight[0] - bgPan, S.shipLight[1], ts, 2000, 0, 0.45);
                ctx.drawImage(S.stage, -stPan, 0);
                POD_LAMPS.forEach(lx => { f.glow(lx - stPan, 56, 7, R.FLOOD, 0.95); f.px(lx - stPan - 2, 54, R.FLOOD.hex[5], 5, 2); });
                const L = P.pixelLayer(AW, AH);
                [[26, 62, 36, 24, 1], [654, 62, 36, 24, 3]].forEach(([x, y, w, h, s]) => flag(L, x - stPan, y, w, h, t * 0.7, s, false));
                L.draw(ctx);
                CREW.forEach(c => drawCrew(c, t, stPan));
                const C = P.pixelLayer(AW, AH);
                for (let i = 0; i < 44; i++) {                                                     // paper confetti, bright only where it falls through a spot
                    const x = hash(i, 1, 43) * 660 - 10 + Math.sin(t / 700 + i) * 5 - stPan, y = (hash(i, 2, 43) * 300 + t / 1000 * (9 + hash(i, 3, 43) * 9)) % 300 + 10;
                    const inSpot = CREW.some(c => Math.abs(x + stPan - c.x) < 6 + (y - 56) * 0.09), v = (inSpot ? 0.75 : 0.32) + 0.2 * Math.sin(t / 150 + i * 1.7);
                    C.tone(x, y, hash(i, 4, 43) > 0.4 ? R.CREAM : R.GOLD, v);
                }
                C.draw(ctx);
                const bob = Math.round(Math.sin(ts / 700) * 0.6);
                ctx.drawImage(S.front, -frPan, bob);
                flashes(f, t, 30, [20, 300, 620, 356], 7);
            },
        });
        const dressId = id => (window.NS_DRESS ? id + '-dress' : id);
        /** One crew member on the stage: the far arm raised and waving behind the body first, then the person, warm in the spot. */
        function drawCrew(c, t, ox) {
            const ms = t + c.seed * 1300, id = dressId(c.id), X = c.x - ox;
            const S = CE.sprite(id, 'idle', CE.frameAt('idle', ms));
            const top = POD.floor - S.origin.y, nx = X + (S.neck.x - S.origin.x) * c.facing, ny = top + S.neck.y;
            if (c.wave) waveArm(c, nx - c.facing * 4, ny + 4, t);
            CE.draw(ctx, id, 'idle', ms, X, POD.floor, { facing: c.facing, warm: 3, rim: -c.facing, seed: c.seed });
        }
        function waveArm(c, sx, sy, t) {
            const big = c.wave === 'big', k = Math.sin((t + c.seed * 400) / (big ? 230 : 320)), dark = window.NS_DRESS ? ['#161d2e', '#2a3752', '#384866', '#5a6e92'] : ['#1a1f24', '#2a2f36', '#3a414a', '#4d5560'];
            const ex = sx - c.facing * 8, ey = sy - 4, hx = ex - c.facing * 1 + k * (big ? 3.5 : 2), hy = ey - 14 + Math.abs(k);
            const seg = (x0, y0, x1, y1, w, col) => { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0)); ctx.fillStyle = col; for (let i = 0; i <= n; i++) ctx.fillRect(Math.round(x0 + (x1 - x0) * i / n - w / 2), Math.round(y0 + (y1 - y0) * i / n), w, 1); };
            seg(sx, sy, ex, ey, 4, dark[1]); seg(sx, sy - 2, ex, ey - 2, 1, dark[3]);
            seg(ex, ey, hx, hy + 2, 3, dark[1]); seg(ex - c.facing, ey, hx - c.facing, hy + 2, 1, dark[2]); seg(ex + c.facing, ey, hx + c.facing, hy + 2, 1, dark[0]);
            const skin = { mira: ['#975749', '#d99f70'], jaxon: ['#5e3520', '#93583a'], aris: ['#b04a40', '#d8784c'] }[c.id] || ['#7a4a30', '#c8a080'];
            const hxr = Math.round(hx), hyr = Math.round(hy);
            ctx.fillStyle = skin[0]; ctx.fillRect(hxr - 1, hyr - 3, 4, 4);
            ctx.fillStyle = skin[1]; ctx.fillRect(hxr - 1, hyr - 3, 3, 3); ctx.fillRect(hxr - 1 + (k > 0 ? 3 : -1), hyr - 2, 1, 2);
            ctx.fillStyle = window.NS_DRESS ? '#c49a3a' : dark[3]; ctx.fillRect(hxr - 1, hyr + 1, 4, 1);   // the gold cuff
        }
        /** A person's shadow: their own shape, dithered dark, laid flat on the ground away from the light. Baked once per frame shape. */
        const shadowCache = new WeakMap();
        function shadowOf(S) {
            if (shadowCache.has(S)) return shadowCache.get(S);
            const c = document.createElement('canvas'); c.width = S.w; c.height = S.h;
            const g = c.getContext('2d'), src = S.canvas.getContext('2d').getImageData(0, 0, S.w, S.h).data, img = g.createImageData(S.w, S.h);
            for (let i = 0; i < S.w * S.h; i++) if (src[i * 4 + 3] > 0 && threshold(i % S.w, Math.floor(i / S.w)) < 0.86) { img.data[i * 4] = 8; img.data[i * 4 + 1] = 10; img.data[i * 4 + 2] = 12; img.data[i * 4 + 3] = 255; }
            g.putImageData(img, 0, 0); shadowCache.set(S, c);
            return c;
        }
        function castShadow(S, x, floorY, facing, kx, ky) {
            ctx.save();
            ctx.setTransform(facing, 0, kx, ky, Math.round(x) + (facing < 0 ? 1 : 0), Math.round(floorY));
            ctx.drawImage(shadowOf(S), -S.origin.x, -S.origin.y);
            ctx.restore();
        }

        // 4 · TO THE LIFT (20-26.5 s): low on the apron of pad nine. The bottom of hull nine fills the frame, floodlit from the left, its
        //     top lost in the dark; the five walk across the concrete in their own long shadows to the lift cage at the foot of the
        //     tower, where one warm lamp is lit. The vents under the ship already breathe. The camera keeps pace with them.
        const WALK = { W: 700, hz: 226, X: 316, B: 296, len: 640, floor: 338, tower: 560, cage: [566, 612], order: ['cora', 'vance', 'mira', 'jaxon', 'aris'] };
        const floodShape = (u, v, o) => { const l = P.shapeL(u, v, o); return l < 0 ? l : l * (0.36 + 0.64 * smooth(0.4, 0.97, u)) + 0.05 * smooth(0.9, 1, u); };
        floodShape.span = P.shapeL.span;
        shot({
            id: 'walk', t0: 20000, t1: 26500, caption: 'To the lift: under the floodlit hull, the five walk in their long shadows to the lift at the tower.',
            build() {
                const p = P.painter(WALK.W, AH, true), { hz, X, B } = WALK;
                const stars = sky(p, hz, 60, 0.5, 51);
                hills(p, hz, 14);
                p.region(0, hz + 1, WALK.W, AH, (x, y) => {                                           // the apron: concrete slabs running away from us, the floodlight's pool
                    const d = Math.max(1, y - hz), z = 1000 / d, lane = (x - 350) * 60 / d;
                    const joint = (((lane % 40) + 40) % 40) < 60 / d || (z % 40) < 1000 / (d * d);
                    const pool = 0.5 * Math.exp(-Math.hypot((x - X) / 230, (y - B - 6) / 34)) + 0.22 * Math.exp(-Math.hypot((x - 380) / 300, (y - WALK.floor) / 22));
                    const far = smooth(hz, hz + 24, y), v = 0.08 + far * (0.12 + pool) + (fbm(x / 7, y / 2.2, 15, 3) - 0.5) * 0.12 - (joint && far > 0.5 ? 0.1 : 0);
                    p.tone(x, y, far > 0.4 ? R.CONC : R.GROUND, v);
                });
                const mastLamps = [];
                [[46, 306, 214, 0.55], [676, 252, 112, 0.4]].forEach(([mx, mb, mh, v]) => {
                    steelBar(p, mx, mb, mx, mb - mh, v, 2);
                    p.region(mx - 6, mb - mh - 6, mx + 8, mb - mh, (a, b) => p.tone(a, b, R.STEEL, 0.3));
                    mastLamps.push([mx + 1, mb - mh - 3]);
                    beam(p, mx + 1, mb - mh - 2, X + (mx < X ? -20 : 40), B - 90, 3, 62, R.FLOOD, 0.5, mx < X ? 0.26 : 0.16);
                });
                const at = standingLander(p, { x: X, base: B, len: WALK.len, shape: floodShape, light: 0.95 });
                bigText(p, '9', at(0.74, -0.08)[0], at(0.74, 0)[1] - 18, 5, R.HULL, 0.14);
                // the tower: two legs, X-braces, platforms; the lift cage at its foot with one warm lamp inside
                const T0 = WALK.tower, T1 = T0 + 58, base = WALK.floor - 10;
                for (let y = base; y > -10; y--) { p.tone(T0, y, R.STEEL, 0.5); p.tone(T0 + 1, y, R.STEEL, 0.36); p.tone(T1, y, R.STEEL, 0.26); p.tone(T1 + 1, y, R.STEEL, 0.18); }
                for (let y = base - 90; y > -40; y -= 30) { steelBar(p, T0, y, T1, y - 30, 0.3); steelBar(p, T1, y, T0, y - 30, 0.2); }
                for (let y = base - 90; y > -10; y -= 60) p.region(T0 - 6, y, T1 + 8, y + 2, (a, b) => p.tone(a, b, R.STEEL, b === y ? 0.5 : 0.22));
                const [c0, c1] = WALK.cage;
                p.region(c0, base - 82, c1, base, (a, b) => p.tone(a, b, R.AMBER, 0.06 + 0.32 * Math.exp(-Math.hypot((a - (c0 + c1) / 2) / 26, (b - base + 76) / 40))));
                p.region(c0 - 2, base - 86, c1 + 2, base - 82, (a, b) => p.tone(a, b, R.STEEL, 0.45));
                p.region(c0 - 2, base, c1 + 2, base + 3, (a, b) => p.tone(a, b, R.STEEL, b === base ? 0.55 : 0.25));
                for (let k = 0; k <= 1; k += 1 / 180) {                                                // a feed line from the tower to the hull, sagging
                    const x = lerp(T0, X + 98, k), y = lerp(150, 178, k) + 30 * Math.sin(Math.PI * k);
                    p.tone(x, y, R.STEEL, 0.4); p.tone(x, y + 1, R.STEEL, 0.16);
                }
                WALK.order.forEach(id => ['walk', 'idle'].forEach(a => { for (let k = 0; k < CE.ACTIONS[a].frames; k++) shadowOf(CE.sprite(dressId(id), a, k, { warm: 1, rim: -1 })); }));   // bake every frame and shadow now, so the shot never stalls on its first steps
                return { canvas: p.canvas(), stars, mastLamps, cageLamp: [(c0 + c1) / 2, base - 78], base, vents: steppedLayer() };
            },
            draw(t, S) {
                const pan = Math.round(60 * ease(clamp01(t / 6500))), ts = step8(t), { X, B } = WALK;
                ctx.drawImage(S.canvas, -pan, 0);
                const f = P.framer(ctx, AW, AH);
                P.twinkle(f, S.stars, ts, pan);
                S.mastLamps.forEach(([x, y]) => { f.glow(x - pan, y, 9, R.FLOOD, 0.95); f.px(x - pan - 4, y - 1, R.FLOOD.hex[5], 9, 3); });
                S.vents.draw(ts, L => steamCloud(L, ventPuffs(ts, X, B + 4, 1.3, 24), { light: [-40, 60], heat: 0.55, reach: 460, ambient: 0.36, seed: 51, t: ts, edge: 0.18, soft: 0.6 }), -pan);   // the vents under the ship: slow white breath
                // the five: walking at the engine's own pace, single file; the first stops in the cage, the next waits at its door
                const stop = [589, 540, 500, 460, 420];
                WALK.order.map((id, i) => {
                    const x = Math.min(stop[i], 330 - i * 40 + CE.ACTIONS.walk.move * t / CE.ACTIONS.walk.ms);
                    return { id: dressId(id), x, i, walking: x < stop[i] };
                }).reverse().forEach(c => {
                    const action = c.walking ? 'walk' : 'idle', ms = t + c.i * 230, S = CE.sprite(c.id, action, CE.frameAt(action, ms), { warm: 1, rim: -1 });
                    castShadow(S, c.x - pan, WALK.floor, 1, -0.75, -0.17);
                    CE.draw(ctx, c.id, action, ms, c.x - pan, WALK.floor, { facing: 1, warm: 1, rim: -1, seed: c.i });
                });
                const [c0, c1] = WALK.cage;                                                        // the cage's front mesh, over whoever is inside
                for (let x = c0; x <= c1; x += 4) f.px(x - pan, S.base - 82, R.STEEL.hex[2], 1, 82);
                for (let y = S.base - 80; y < S.base; y += 10) f.px(c0 - pan, y, R.STEEL.hex[2], c1 - c0 + 1, 1);
                f.glow(S.cageLamp[0] - pan, S.cageLamp[1], 6, R.AMBER, 0.8); f.px(S.cageLamp[0] - pan - 2, S.cageLamp[1], R.AMBER.hex[4], 5, 1);
            },
        });

        // 5 · IGNITION (26.5-34 s): from the press stand. T-3 on the clock, the vents breathing; then the drive lights under the bell,
        //     the flame hits the trench and steam rolls out both ways in great billows lit from inside, the whole yard and the tower
        //     turn cold and bright, the heads in front go black against it, the picture shakes. The ship holds a moment on the fire,
        //     then lifts, slowly at first.
        const IGN = { X: 300, B: 268, len: 160, hz: 250, ign: 3000, hold: 1500 };
        const ignRise = t => (t < IGN.ign + IGN.hold ? 0 : 1.7e-5 * (t - IGN.ign - IGN.hold) ** 2);
        const drivenShape = (u, v, o) => { const l = P.shapeL(u, v, o); return l < 0 ? l : l * 0.62 + 0.55 * Math.exp(-(1 - u) * 5.5) * (0.65 + 0.35 * (1 - Math.abs(v))); };
        drivenShape.span = P.shapeL.span;
        shot({
            id: 'ignition', t0: 26500, t1: 34000, caption: 'Ignition: steam rolls over the pad, the yard turns cold and bright, the ship holds on the fire, then climbs.',
            build() {
                const { X, B, hz } = IGN;
                const mk = lit => {
                    const p = P.painter(AW, AH, true);
                    const stars = sky(p, hz, 110, 0.45 * (1 - lit * 0.4), 61);
                    if (lit) p.region(0, 0, AW, hz + 1, (x, y) => {                                      // the drive's cold light on the low sky, fading into the night without grain
                        const v = 0.44 * Math.exp(-Math.hypot((x - X) / 240, (y - B) / 80));
                        if (smooth(0.05, 0.18, v) > threshold(x + 3, y + 5)) p.tone(x, y, R.PLUME, 0.06 + v);
                    });
                    hills(p, hz, 16);
                    ground(p, hz, 17, (x, y) => (0.24 + 0.55 * lit) * Math.exp(-Math.hypot((x - X) / (200 + 140 * lit), (y - B) / 26)));
                    p.ellipse(X, B + 4, 120, 13, (a, b, qq) => p.tone(a, b, R.CONC, 0.4 + 0.3 * lit - qq * 0.26 + (fbm(a / 4, b / 2, 7, 2) - 0.5) * 0.12));
                    [[X - 210, B + 8, 120], [X + 190, B + 6, 110]].forEach(([mx, mb, mh]) => { steelBar(p, mx, mb, mx, mb - mh, 0.36 + 0.3 * lit, 2); if (!lit) beam(p, mx, mb - mh - 2, X, B - 60, 2, 30, R.FLOOD, 0.5, 0.22); });
                    const top = tower(p, X + 46, B, 214, 13, 1.3, 0.38 + 0.4 * lit);
                    for (let y = B - 40; y > B - 200; y -= 52) steelBar(p, X + 30, y, X + 46, y, 0.35 + 0.3 * lit);   // the swung-back arms
                    return { canvas: p.canvas(), stars, top };
                };
                const ship = shape => { const s = P.painter(150, 200, false); standingLander(s, { x: 75, base: 192, len: IGN.len, shape }); return s.canvas(); };
                const phones = [];
                const heads = (rr, k) => { const p = P.painter(AW + 40, AH, false); const h = crowdMass(p, [[318, 1.9, 1.25, 0.5 * k], [342, 2.6, 1.15, 0.58 * k], [384, 3.7, 1.05, 0.64 * k]], [0.25, -1], 700, -30, AW + 60, rr); if (!phones.length) h.forEach(o => { if (o.kind === 2) phones.push([o.x, o.y]); }); return p.canvas(); };
                const headsDark = heads(R.CROWD, 0.85), headsLit = heads(R.PLUME, 0.6);
                return { dark: mk(0), bright: mk(1), shipFlood: ship(floodShape), shipLit: ship(drivenShape), headsDark, headsLit, phones, back: steppedLayer(), front: steppedLayer() };
            },
            draw(t, S) {
                const { X, B, ign } = IGN, ts = step8(t), heat = clamp01((t - ign) / 350), rise = ignRise(t), flick = [1, 0.92, 1.06, 0.96][Math.floor(ts / TICK) % 4];
                const base = heat > 0.5 ? S.bright : S.dark;
                ctx.drawImage(base.canvas, 0, 0);
                const f = P.framer(ctx, AW, AH);
                P.twinkle(f, base.stars, ts);
                if (heat < 0.5) { [[X - 210, B - 114], [X + 190, B - 106]].forEach(([x, y]) => { f.glow(x, y, 7, R.FLOOD, 0.95); f.px(x - 3, y, R.FLOOD.hex[5], 7, 2); }); }
                blink(f, base.top[0], base.top[1], ts, 1800, 0, 0.45);
                const by = Math.round(B - rise) - 8;                                                // the bell's mouth
                const fireAt = [X, Math.min(B - 2, by + 14)], hf = heat * flick;
                S.back.draw(ts, L => {                                                               // the steam behind the ship (and, before, the vents)
                    const puffs = t < ign + 500 ? ventPuffs(ts, X, B, 1.1, 12) : [];
                    if (t > ign) puffs.push(...ignitionPuffs(ts - ign, X, B, false));
                    steamCloud(L, puffs, { light: t > ign ? fireAt : [X - 220, B - 120], heat: t > ign ? hf : 0.5, reach: t > ign ? 170 : 320, ambient: t > ign ? 0.2 : 0.34, seed: 61, t: ts, soft: t > ign ? 0.16 : 0.6, edge: t > ign ? 0.34 : 0.18 });
                });
                ctx.drawImage(heat > 0.3 ? S.shipLit : S.shipFlood, X - 75, Math.round(B - rise) - 192);
                if (t > ign) {
                    const L2 = P.pixelLayer(AW, AH), padY = B + 2, plume = (t < ign + IGN.hold ? 16 + (t - ign) / 30 : 66 + Math.min(240, rise * 0.8)) * heat * flick;
                    for (let d = 0; d < plume; d++) {                                               // the drive: a white core in a blue sheath
                        if (by + d > padY) break;
                        const w = 7 * (1 - d / (plume * 1.6)) + d * 0.06;
                        for (let k = -w; k <= w; k++) { const v = (1 - d / plume) ** 0.6 * (1 - (k / (w + 0.01)) ** 2); if (v > 0.04) L2.tone(X + k, by + d, R.PLUME, Math.min(1, 0.3 + v * 1.1)); }
                    }
                    const gap = padY - by;
                    if (gap < plume + 10) {                                                          // the flame hits the trench and runs out along the ground
                        const hit = clamp01(1 - gap / (plume + 10)) * heat, reach = 30 + 170 * hit;
                        for (let k = -reach; k <= reach; k++) for (let j = 0; j < 3; j++) { const v = hit * (1 - Math.abs(k) / reach) ** 0.7 * (1 - j / 3); if (v > 0.06) L2.tone(X + k, padY - j, R.PLUME, Math.min(1, 0.3 + v)); }
                    }
                    L2.draw(ctx);
                    bloom(f, X, by + 2, 16, R.PLUME, heat);
                    f.px(X - 5, by, R.PLUME.hex[6], 11, 3);
                    S.front.draw(ts, L => steamCloud(L, ignitionPuffs(ts - ign, X, B, true), { light: fireAt, heat: hf, reach: 150, ambient: 0.18, seed: 62, t: ts }));
                }
                const hx = -20 - Math.round(8 * ease(clamp01(t / 7500)));
                ctx.drawImage(heat > 0.5 ? S.headsLit : S.headsDark, hx, 0);
                S.phones.forEach(([x, y], i) => { if (hash(i, Math.floor(ts / 500), 8) > 0.15) f.px(x + hx - 1, y - 2, R.CREAM.hex[hash(i, Math.floor(ts / 375), 4) > 0.4 ? 4 : 3], 3, 4); });
                flashes(f, t, 16, [0, 300, AW, 356], 19);
                const amp = t > ign ? 1.6 * heat * (1 - clamp01((t - ign - 1200) / 2600)) : 0;      // the picture shakes with the roar
                if (amp > 0.3) { const sx = Math.round((hash(1, Math.floor(ts / TICK), 7) - 0.5) * 2 * amp), sy = Math.round((hash(2, Math.floor(ts / TICK), 7) - 0.5) * 2 * amp); if (sx || sy) ctx.drawImage(cv, sx, sy); }
            },
        });
        /** A glow that only brightens: the faint outer steps are skipped, so it never rings a bright fire with dark pixels. */
        function bloom(f, cx, cy, rad, r, peak) {
            for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) { const d = Math.hypot(x, y) / rad, v = peak * (1 - d) ** 1.5; if (d < 1 && v > 0.5) f.tone(cx + x, cy + y, r, v); }
        }
        // ── steam as one body ──
        // Every puff is added into one density field (soft blobs that melt into each other), the edge is eaten by drifting noise,
        // and each pixel is lit by how much steam lies between it and the light: the side facing the fire glows, the far side and the
        // inside stay dark. So the mass reads as one rolling cloud lit from inside, never as separate balls. One ramp from the ink to
        // white, so the light runs through it without a seam.
        const STEAM = ramp(INK, '#11161b', '#1c242c', '#2b3640', '#3f4e5b', '#5a6f80', '#7f9aae', '#aecbdc', '#dcf0fa', '#ffffff');
        const FIELD = new Float32Array(AW * AH);
        /** puffs: [[cx, cy, rx, ry, weight]]. o: { light: [x, y], heat 0..1, reach (px the fire light carries), ambient, seed, t, edge }. */
        function steamCloud(L, puffs, o) {
            let bx0 = AW, by0 = AH, bx1 = -1, by1 = -1;
            puffs.forEach(([cx, cy, rx, ry, w]) => {
                const x0 = Math.max(0, Math.floor(cx - rx)), x1 = Math.min(AW - 1, Math.ceil(cx + rx)), y0 = Math.max(0, Math.floor(cy - ry)), y1 = Math.min(AH - 1, Math.ceil(cy + ry));
                if (x0 > x1 || y0 > y1) return;
                bx0 = Math.min(bx0, x0); by0 = Math.min(by0, y0); bx1 = Math.max(bx1, x1); by1 = Math.max(by1, y1);
                for (let y = y0; y <= y1; y++) { const dy = (y + 0.5 - cy) / ry, dy2 = dy * dy; if (dy2 >= 1) continue; for (let x = x0; x <= x1; x++) { const dx = (x + 0.5 - cx) / rx, q = 1 - dx * dx - dy2; if (q > 0) FIELD[y * AW + x] += w * q * q; } }
            });
            if (bx1 < 0) return;
            const at = (x, y) => { x = Math.round(x); y = Math.round(y); return x < bx0 || y < by0 || x > bx1 || y > by1 ? 0 : FIELD[y * AW + x]; };
            const [lx, ly] = o.light, edge = o.edge || 0.34, amb = o.ambient == null ? 0.2 : o.ambient;
            for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) {
                const f0 = FIELD[y * AW + x];
                if (f0 < 0.05) continue;
                const n = fbm(x / 9, y / 6 - o.t / 1500, o.seed, 3), d = f0 + (n - 0.5) * 0.62;
                if (d < edge) continue;
                if (smooth(edge, edge + (o.soft || 0.16), d) < threshold(x + 1, y + 2)) continue;          // a soft, dithered edge (soft: see-through wisps)
                const dx = lx - x, dy = ly - y, dist = Math.hypot(dx, dy) || 1, ux = dx / dist, uy = dy / dist;
                const toward = at(x + ux * 5, y + uy * 5) + 0.5 * at(x + ux * 11, y + uy * 11);           // steam between this pixel and the fire
                const gx = at(x + 2, y) - at(x - 2, y), gy = at(x, y + 2) - at(x, y - 2), gl = Math.hypot(gx, gy) || 1;
                const face = clamp01(0.5 - 0.5 * (gx * ux + gy * uy) / gl);                                 // the billow's own surface, turned to the fire or away
                const lit = clamp01(1.15 - 0.85 * toward) * (0.45 + 0.55 * face);
                const sky = clamp01(1 - at(x, y - 4) * 1.4);                                                 // the tops catch a little of the sky
                const fire = o.heat * Math.exp(-dist / o.reach);
                L.tone(x, y, STEAM, amb + 0.08 * sky + (n - 0.5) * 0.1 + fire * lit * 0.95 + fire * 0.08);
            }
            for (let y = by0; y <= by1; y++) FIELD.fill(0, y * AW + bx0, y * AW + bx1 + 1);
        }
        /** Steam drawn only when the eight-a-second tick changes, kept in its own layer (the house's stepped motion, and cheap). */
        function steppedLayer() {
            const L = P.pixelLayer(AW, AH); let key = null;
            return { draw(k, paint, ox = 0) { if (k !== key) { key = k; L.clear(); paint(L); } L.draw(ctx, ox, 0); } };
        }
        /** The vents breathing before ignition: small slow puffs rising either side of the trench. */
        function ventPuffs(t, X, B, s, spread) {
            const out = [];
            const vents = [-1.6, -1, 1, 1.5];                                                          // four vents, each a steady stream: puff after puff, so it rises as one wisp
            vents.forEach((vx, vi) => {
                for (let i = 0; i < 12; i++) {
                    const age = ((t / 3000) + i / 12 + vi * 0.29) % 1, r = (2.5 + age * 9) * s, sway = Math.sin(age * 4 + vi * 2 + t / 1700) * 3 * age * s;
                    out.push([X + vx * spread + Math.sign(vx) * age * 8 * s + sway, B - age * 38 * s, r * 1.15, r, 0.62 * (1 - age) ** 1.2]);
                }
            });
            return out;
        }
        /** The ignition's steam: billows born one after another at the trench, rolling out both ways along the ground and climbing as
            they go, over a low bank. front: the part nearer to us than the ship (drawn over its legs). */
        function ignitionPuffs(t, X, B, front) {
            const out = [], n = 90;
            const bw = 290 * (1 - Math.exp(-t / 1400)), bh = 14 * (1 - Math.exp(-t / 900));
            if (!front) for (let k = -1; k <= 1; k += 0.125) out.push([X + k * bw, B + 3, 34 + 10 * (1 - Math.abs(k)), bh * (1 - 0.5 * Math.abs(k)) + 2, 0.9]);   // the bank
            for (let i = 0; i < n; i++) {
                const born = (i / n) * 4200 + hash(i, 5, 33) * 140, age = (t - born) / 1000;
                if (age <= 0) continue;
                const toUs = hash(i, 3, 33);
                if ((toUs > 0.62) !== front) continue;
                const side = i % 2 ? 1 : -1, sp = 0.5 + 0.6 * hash(i, 1, 33), lift = hash(i, 4, 33), out1 = 1 - Math.exp(-age * 1.0);
                const r = Math.min(46, (8 + 34 * (1 - Math.exp(-age * 0.9))) * (0.7 + 0.5 * hash(i, 2, 33))) * (front ? 0.7 : 1);
                const cx = X + side * (10 + 270 * sp * out1), cy = B + 6 - r * 0.55 - age * 7 * lift - lift * 26 * out1 + (front ? 8 : 0);
                out.push([cx, cy, r * 1.2, r, 0.95]);
            }
            return out;
        }

        // 6 · INTO THE DARK (34-42.5 s): from far off, a long lens on the climb. The ship rises straight off the horizon, then pitches
        //     over toward its heading and shrinks. Its trail spreads and drifts in the wind; low down it is in the earth's shadow, grey,
        //     but higher up the sun has not yet set, so the trail and the exhaust behind the ship catch the last of it and open into a
        //     gold fan. The drive is the last thing you can see: one point of light among the stars. The graphics go; then black.
        const CLIMB = { horizon: 330, p0: [236, 326], p1: [244, 150], p2: [474, 62], fly: 6600, shadow: 250, yard: 236 };
        const climbCache = new Map();
        function climbSprite(len, angle) {
            const deg = Math.round(angle * 90 / Math.PI) * 2, key = len + ':' + deg;
            if (climbCache.has(key)) return climbCache.get(key);
            const ht = len / 3.15, half = Math.ceil(len / 2 + ht + 4), p = P.painter(half * 2, half * 2, false);
            const at = P.hull(p, { x: half, y: half, len, ht, angle: deg * Math.PI / 180, flip: true, anchor: 0.5, seed: 9, flat: len < 90, light: 0.7, sun: 0.85, sunDir: [-0.8, 0.6] }, P.shapeL);
            const bell = at(1, 0), out = { canvas: p.canvas(), half, bell: [bell[0] - half, bell[1] - half] };
            climbCache.set(key, out);
            return out;
        }
        /** Where the ship is at k (0..1 of the flight) and which way it travels: up off the pad, then over (a gravity turn). */
        function climbAt(k) {
            const e = 1 - Math.pow(1 - k, 1.6), a = CLIMB.p0, b = CLIMB.p1, c = CLIMB.p2, m = 1 - e;
            return { x: m * m * a[0] + 2 * m * e * b[0] + e * e * c[0], y: m * m * a[1] + 2 * m * e * b[1] + e * e * c[1],
                     a: Math.atan2(2 * m * (b[1] - a[1]) + 2 * e * (c[1] - b[1]), 2 * m * (b[0] - a[0]) + 2 * e * (c[0] - b[0])) };
        }
        const sunlitAt = y => smooth(CLIMB.shadow + 26, CLIMB.shadow - 30, y);   // above the earth's shadow line the sun still reaches
        shot({
            id: 'climb', t0: 34000, t1: DUR, caption: 'Into the dark: the trail catches the last sun; the ship shrinks to one point of light among the stars; black.',
            build() {
                const p = P.painter(AW, AH, true), hz = CLIMB.horizon, Y = CLIMB.yard;
                p.region(0, 0, AW, hz, (x, y) => {
                    const k = y / hz, gv = 0.62 * Math.pow(k, 5) + 0.36 * Math.exp(-Math.hypot((x - 90) / 230, (y - hz) / 34));
                    if (smooth(0.08, 0.3, gv) > threshold(x + 3, y + 5)) p.tone(x, y, R.GLOW, gv); else p.tone(x, y, R.NIGHT, 0.05 + 0.32 * Math.pow(k, 2));
                });
                p.region(0, hz - 74, AW, hz - 22, (x, y) => {                                         // long clouds low over the sunset, lit from below
                    const c = fbm(x / 80, y / 4.5, 5, 4) - 0.56;
                    if (c > 0) p.tone(x, y, R.CLOUD, 0.16 + 2.8 * c * (0.35 + Math.exp(-Math.abs(x - 90) / 220)) + (fbm(x / 7, y / 3, 6, 2) - 0.5) * 0.1);
                });
                const stars = P.keepVisible(p, P.scatterStars(p, 72, 820, (x, y) => y < hz - 70));
                p.region(Y - 110, hz - 40, Y + 110, hz, (x, y) => {                                   // the yard far off, behind the hills: its floodlights in the haze
                    const v = 0.34 * Math.exp(-Math.hypot((x - Y) / 60, (y - hz) / 12));
                    if (smooth(0.04, 0.2, v) > threshold(x + 3, y + 5)) p.tone(x, y, R.FLOOD, 0.14 + v);
                });
                p.region(0, hz, AW, AH, (x, y) => p.tone(x, y, R.HILL, 0.3 + (fbm(x / 6, y / 2, 3, 2) - 0.5) * 0.2));
                for (let x = 0; x < AW; x++) { const top = hz - 2 - 6 * fbm(x / 50, 2, 4, 3); for (let y = Math.floor(top); y < hz; y++) p.tone(x, y, R.HILL, 0.42); }
                const lights = [];
                for (let i = 0; i < 26; i++) lights.push([Y - 80 + hash(i, 1, 55) * 160, hz + 1 + Math.round(hash(i, 2, 55) * 4), hash(i, 3, 55)]);
                return { canvas: p.canvas(), stars, lights, trail: steppedLayer() };
            },
            draw(t, S) {
                ctx.drawImage(S.canvas, 0, 0);
                const f = P.framer(ctx, AW, AH), ts = step8(t), k = clamp01(t / CLIMB.fly), c = climbAt(k), dir = [Math.cos(c.a), Math.sin(c.a)];
                P.twinkle(f, S.stars, ts);
                S.lights.forEach(([lx, ly, r], i) => f.px(lx, ly, (r > 0.75 ? R.FLOOD : R.AMBER).hex[hash(i, Math.floor(ts / 500), 3) > 0.2 ? 4 : 3]));
                S.trail.draw(ts, L => climbTrail(L, clamp01(ts / CLIMB.fly)));
                const len = Math.round(40 * Math.pow(1 - k, 1.5));
                if (len >= 7) {
                    const sp = climbSprite(len, c.a), bx = c.x + sp.bell[0], by = c.y + sp.bell[1];
                    ctx.drawImage(sp.canvas, Math.round(c.x - sp.half), Math.round(c.y - sp.half));
                    const pl = len * 0.8; for (let d = 0; d < pl; d++) { const w = Math.max(1, len / 14) * (1 - d / pl); for (let j = -w; j <= w; j++) f.tone(bx - dir[0] * d - dir[1] * j, by - dir[1] * d + dir[0] * j, R.PLUME, 1 - d / pl); }
                    f.glow(bx, by, Math.max(3, Math.round(len / 7)), R.PLUME, 0.95);
                } else {                                                                              // one point of light
                    f.glow(c.x, c.y, 5, R.PLUME, 0.8 + 0.1 * Math.sin(t / 300));
                    f.px(c.x, c.y, R.PLUME.hex[6]);
                    if (Math.floor(ts / 500) % 3 === 0) { f.px(c.x - 2, c.y, R.PLUME.hex[4], 5, 1); f.px(c.x, c.y - 2, R.PLUME.hex[4], 1, 5); }
                }
            },
        });
        /** The trail, eight times a second: smoke left along the path, older parts wider, drifting on the wind and frayed by noise.
            In the earth's shadow it is cold grey; in the last sun it is gold, brighter on the side toward the sunset. Above the shadow
            the exhaust behind the ship opens into a fan, lit gold. */
        function climbTrail(L, k) {
            const fly = CLIMB.fly / 1000, N = 300, sunX = 90;
            for (let i = 0; i <= N; i++) {
                const kk = k * i / N, q = climbAt(kk), age = (k - kk) * fly;
                if (q.y > CLIMB.horizon - 1) continue;
                const nx = -Math.sin(q.a), ny = Math.cos(q.a), sun = sunlitAt(q.y), sunSide = (sunX - q.x) * nx > 0 ? 1 : -1;
                const wind = 1.6 * (smooth(300, 120, q.y) - 0.35), w = 1 + age * (1.8 + 2.2 * sun);     // the wind shears: low air one way, high air the other
                const drift = age * age * wind + Math.sin(q.y / 23 + 1) * age * 1.3, young = Math.exp(-age / 1.1);
                for (let j = -w; j <= w; j += 0.55) {
                    const x = q.x + nx * j + drift, y = q.y + ny * j, e = 1 - Math.abs(j) / (w + 0.4);
                    const n = fbm(x / 6 + age * 0.3, y / 6, 71, 2), a = (0.4 + 0.6 * young) * (0.25 + 0.75 * e) * (0.55 + 0.9 * (n - 0.3)) + 0.3 * young * e;
                    if (a <= threshold(Math.round(x) + 1, Math.round(y) + 2)) continue;
                    const toSun = clamp01(0.5 + 0.5 * sunSide * j / (w + 0.01));
                    if (sun > 0.25) L.tone(x, y, young * e > 0.55 ? R.CREAM : R.GLOW, (0.3 + 0.4 * sun * (0.5 + 0.5 * toSun)) * (0.7 + 0.3 * e) + 0.3 * young * e);
                    else L.tone(x, y, R.SMOKE, (0.26 + 0.22 * e + 0.25 * young * e) * (1 - age * 0.04));
                }
            }
            const q = climbAt(k), sun = sunlitAt(q.y);                                                 // the fan: thin air, the exhaust spreads wide in the sun
            if (sun < 0.05 || k > 0.995) return;
            const back = q.a + Math.PI, spread = 0.12 + 0.5 * smooth(0.25, 0.9, k), reach = (24 + 70 * smooth(0.2, 0.9, k)) * sun;
            for (let d = 3; d < reach; d += 0.6) for (let s = -spread; s <= spread; s += 0.9 / d) {
                const a = back + s, x = q.x + Math.cos(a) * d, y = q.y + Math.sin(a) * d, off = Math.abs(s) / spread;
                const al = (1 - d / reach) * (1 - off * off) * 0.75 * sun + (off > 0.82 ? 0.15 * (1 - d / reach) * sun : 0);
                if (al <= threshold(Math.round(x) + 5, Math.round(y) + 3)) continue;
                L.tone(x, y, d < 10 && off < 0.3 ? R.CREAM : R.GLOW, 0.4 + 0.5 * (1 - d / reach) * (1 - 0.5 * off));
            }
        }

        return { ctx, SHOTS };
    }

    window.NSLaunchArt = Object.freeze({ AW, AH, TICK, DUR, LINES, COUNT, LIVE_ENDS, FADE, CLIMB_AT, create });
})();
