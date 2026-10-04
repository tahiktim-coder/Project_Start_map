/* proto-disc.js — Date it with the disc, then follow where the dead were going.
   WHEN × WHERE: a wreck's last star fix holds fourteen pulsar readings. Years dead slide each mark along its line toward the
   disc's notch (every pulsar slows at its own rate); light-years down the heading swing each line onto the disc's. One point
   on the chart gets both. THE REWARD: the fix also says where that crew was heading last. The view moves to the sector map,
   their course draws out and a place nobody could see before appears, named; you set a course there. The third course is
   our own heading, into the light. At the end the line through every wreck runs on to the light at the chart's edge. */

(function () {
    'use strict';
    const Lab = window.Lab, C = Lab.C, W = Lab.W, H = Lab.H, { clamp, lerp, mix } = Lab;

    const CX = 160, CY = 134, R = 112, MIN_R = 18;                      // the disc; marks never crowd its centre
    const PAD = { x: 334, y: 50, w: 128, h: 112 }, BIG = { x: 92, y: 58, w: 300, h: 160 };   // the chart, and opened up at the end
    const MARK_TOL = 1, ANGLE_TOL = 0.012, SNAP = 3, SNAP_FRAC = 0.02;  // only the exact answer is 14/14; letting go this near settles in
    const EASE = 12, RESCALE = 6, FRESH = 0.3, HOLD_DELAY = 0.35, HOLD_EVERY = 0.06, HOLD_FAST_AFTER = 1.1;
    const FLASH = 0.8, LINE_GAP = 2.6, TO_MAP = 2.2, WIPE = 0.75, ZOOM = 0.9, TREND = 1.3, REACH = 1.8, END_RANGE = { y: 750, l: 300 };
    const T_LINE = 0.8, LINE_DUR = 1.5, T_FOUND = 2.3, T_PORT = 2.9, T_AURA = 3.6, BEND = 0.9, FADE = 0.7;   // the map's beats (s)
    const IR = 34, PORT = [434, 218], TEXT_X = 392, GLOW_MAP = 62, GLOW_END = 30, GLOW_FRAMES = 12, BREATH = 4;

    // Fourteen pulsars: angle (degrees), line length, notch as a fraction of the length (round two's numbers, × 1.5).
    const PULSARS = [
        [-176, 70, 0.62], [-151, 46, 0.55], [-129, 60, 0.72], [-104, 38, 0.60], [-83, 66, 0.45],
        [-58, 52, 0.70], [-36, 32, 0.66], [-11, 64, 0.50], [12, 42, 0.74], [35, 58, 0.58],
        [61, 36, 0.52], [92, 68, 0.64], [124, 48, 0.68], [153, 56, 0.48],
    ].map(([deg, len, f]) => { const l = Math.round(len * 1.5); return { a: (deg * Math.PI) / 180, len: l, notch: Math.round(Math.max(MIN_R + 6, l * f)) }; });
    // Per year each mark slides outward (px): every pulsar slows, so they all go the same way. Per light-year each line swings (rad).
    const RATES = [0.07, 0.1, 0.14, 0.18, 0.24, 0.3, 0.38, 0.46, 0.55, 0.65, 0.78, 0.92, 1.1, 1.3].map(r => r * 1.5);
    const SWINGS = [0.0016, 0.0022, 0.003, 0.0038, 0.0046, 0.0055, 0.0064, 0.0074, 0.0085, 0.0096, 0.011, 0.0122, 0.0136, 0.015];

    const WRECKS = [
        {   num: '4', sector: 1, age: 21, ly: 9, seed: 4, range: { y: 50, l: 20 },
            intro: [['A.U.R.A.', "EXODUS-4's last star fix, Commander. It can tell us when the ship died."],
                ['Mira', "Move the point on the chart until the wreck's lines and marks fit the disc."]],
            locked: [['Aris', 'Twenty-one years. We were still asleep when they died.']],
            place: { name: 'AEA-29 b', readout: '3.2 LY · BEARING 012', react: ['Jaxon', "Beacons don't run that long on their own. Somebody kept it going."],
                aura: 'AEA-29 b, Commander. A moon, three point two light-years out, bearing zero one two.' } },
        {   num: '980', sector: 3, age: 104, ly: 61, seed: 980, range: { y: 200, l: 80 },
            intro: [['Vance', 'Hull 980. Only eight ships launched before us.']],
            locked: [['Mira', "A hundred and four years. That can't be right. A higher number should be newer."]],
            place: { name: 'Phoebe-17 Minor', readout: '5.6 LY · BEARING 004', react: ['Aris', 'Someone was left alive to bury them.'],
                aura: 'Phoebe-17 Minor, Commander. Five point six light-years ahead. Three hundred and twelve graves.' } },
        {   num: '30,211', sector: 6, age: 396, ly: 188, seed: 30211, range: { y: 500, l: 200 },
            intro: [['Jaxon', 'Hull 30,211. How many ships did they send?']],
            locked: [['Vance', 'Four hundred years ago there was no Exodus programme.'],
                ['A.U.R.A.', 'Three hundred and ninety-six years, Commander. The reading is correct.']],
            place: { name: 'End of the heading', readout: 'BEARING 000 · NO RANGE', react: ['Mira', 'Maybe some of them made it there.'],
                aura: 'Bearing zero. I cannot give you a distance.' } },
    ];
    const END = [['Vance', "Every one of them was going where we're going."], ['A.U.R.A.', 'Our heading has not changed, Commander.']];
    const LAST = WRECKS[WRECKS.length - 1];             // each chart range keeps years : light-years at 5 : 2, so the trend keeps its angle

    // The sector maps, like the game's main map: the heading runs lower left to upper right as a band of dead transponders.
    // Bearings shrink as the wrecks get older (12°, 4°, 0): the dead were all pointing the same way. The bottom right stays clear.
    const MAPS = [
        {   seed: 104, pips: 8, hulls: 0, end: [480, 46], hint: 1, dest: { kind: 'beacon', x: 300, y: 54, r: 6, giant: [282, 71, 15] },
            planets: [['HELIOS-12 MINOR', 150, 96, 11, 'rock'], ['KRYOS-7 IV', 236, 226, 5, 'grey'], ['ZEPHYR-40 X', 58, 74, 8, 'gas']] },
        {   seed: 980, pips: 50, hulls: 4, end: [480, 46], hint: 2, dest: { kind: 'graves', x: 364, y: 68, r: 10 },
            planets: [['ATLAS-3 PRIME', 128, 74, 9, 'grey'], ['NYX-52 IV', 54, 130, 6, 'rock'], ['HYPERION-9 X', 196, 224, 12, 'gas']] },
        {   seed: 3021, pips: 240, hulls: 9, end: [452, 72], hint: 0, final: true, dest: { kind: 'light', x: 452, y: 72, r: 18 },
            planets: [['CHRONOS-6 MINOR', 150, 66, 8, 'grey'], ['TITAN-81 X', 262, 230, 10, 'rock']] },
    ];
    const START = [0, 224], US_AT = 0.1, WRECK_AT = 0.19, BAND = 70;

    const RAMP = {
        rock: () => C.hull,
        grey: () => [C.void, C.deep, C.dusk, mix(C.haze, C.textDim, 0.25), mix(C.textDim, C.haze, 0.3), C.textDim, mix(C.textDim, C.text, 0.5)],
        gas: () => [C.void, C.nebA, C.dusk, C.haze, C.mist, mix(C.mist, C.text, 0.35)],
        gold: () => [0.9, 0.74, 0.56, 0.34].map(k => mix(C.warm, C.void, k)).concat(C.warm, mix(C.warm, C.light, 0.55), C.light),
        glow: () => [null, mix(C.lightHalo, C.void, 0.74), mix(C.lightHalo, C.void, 0.45), C.lightHalo, mix(C.lightHalo, C.light, 0.55), C.light],
    };

    // ── small helpers ──
    const smooth = t => t * t * (3 - 2 * t), two = n => String(n).padStart(2, '0');
    const makeCanvas = (w = W, h = H) => Object.assign(document.createElement('canvas'), { width: w, height: h });
    const px = (c, x, y, color) => { c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), 1, 1); };
    const right = (c, str, x, y, color, scale = 1) => Lab.text(c, str, x - Lab.textWidth(str, scale), y, color, scale);
    const centre = (c, str, x, y, color, scale = 1) => Lab.text(c, str, Math.round(x - Lab.textWidth(str, scale) / 2), y, color, scale);
    /** Ramp index for `tone` at (x, y), dithered between the two nearest stops (index 0 can mean "leave it clear"). */
    const stop = (ramp, tone, x, y) => { const top = ramp.length - 1, pos = clamp(tone, 0, 1) * top, lo = Math.floor(pos); return Math.min(top, (pos - lo) > Lab.bayer(x, y) ? lo + 1 : lo); };
    function segDist(x, y, x0, y0, x1, y1) {
        const vx = x1 - x0, vy = y1 - y0, l2 = vx * vx + vy * vy, t = l2 ? clamp(((x - x0) * vx + (y - y0) * vy) / l2, 0, 1) : 0;
        return Math.hypot(x - (x0 + vx * t), y - (y0 + vy * t));
    }
    /** A short bar across a disc line at angle `a`, `pos` px from the centre, running `from`..`to` px across it. */
    function bar(c, a, pos, from, to, color) {
        const dx = Math.cos(a), dy = Math.sin(a);
        for (let o = from; o <= to; o++) px(c, CX + dx * pos - dy * o, CY + dy * pos + dx * o, color);
    }
    /** A lit sphere. Every body is lit from the end of the heading, up and to the right. `fade` < 1 brings it in from the dark. */
    function planet(c, x, y, r, ramp, fade = 1, banded = false) {
        for (let py = Math.max(0, Math.floor(y - r)); py <= Math.min(c.canvas.height - 1, Math.ceil(y + r)); py++) {
            for (let qx = Math.max(0, Math.floor(x - r)); qx <= Math.min(c.canvas.width - 1, Math.ceil(x + r)); qx++) {
                const dx = (qx - x) / r, dy = (py - y) / r, d2 = dx * dx + dy * dy;
                if (d2 > 1) continue;
                let tone = 0.04 + 0.92 * Math.pow(Math.max(0, dx * 0.62 - dy * 0.42 + Math.sqrt(1 - d2) * 0.66), 1.3);
                if (banded) tone *= 0.8 + 0.2 * Math.sin(dy * r * 0.9 + Math.sin(dx * 3) * 1.2);
                const k = stop(ramp, tone * fade, qx, py);
                if (fade === 1 || k > 0) px(c, qx, py, ramp[k]);   // fading in: the silhouette arrives with the light
            }
        }
    }

    // ── the disc: gold, engraved, painted once ──
    // The two figures, as capsules [x0, y0, x1, y1, radius] standing on (0, 0). He raises a hand; she stands beside him.
    const MAN = [[0, -30.5, 0, -30.5, 3.3], [0, -27, 0, -25, 1.3], [-4.6, -23, 4.6, -23, 1.7], [-1.9, -22, -1.6, -14, 2.6],
        [1.9, -22, 1.6, -14, 2.6], [-5, -23, -8, -27.5, 1.1], [-8, -27.5, -8.4, -33.5, 1], [5, -23, 6, -15, 1.1], [6, -15, 6.3, -11.5, 0.9],
        [-1.9, -14, -2.4, -1, 1.5], [1.9, -14, 2.4, -1, 1.5], [-2.4, -0.6, -4.6, -0.6, 0.8], [2.4, -0.6, 4.6, -0.6, 0.8]];
    const WOMAN = [[0, -28.5, 0, -28.5, 3.1], [-2.6, -29, -3.2, -24.5, 1], [2.6, -29, 3.2, -24.5, 1], [0, -25, 0, -23.5, 1.1],
        [-3.8, -22, 3.8, -22, 1.4], [-1.6, -21, -1.6, -14, 2.3], [1.6, -21, 1.6, -14, 2.3], [-2.1, -12.5, 2.1, -12.5, 2.6],
        [-4.1, -22, -5, -14, 1], [-5, -14, -5.2, -11, 0.9], [4.1, -22, 5, -14, 1], [5, -14, 5.2, -11, 0.9],
        [-1.6, -12, -1.7, -1, 1.4], [1.6, -12, 1.5, -1, 1.4], [-1.7, -0.6, -3.1, -0.6, 0.7], [1.5, -0.6, 2.9, -0.6, 0.7]];
    const FIGURES = [[MAN, CX + 20, CY + 93], [WOMAN, CX + 37, CY + 91]];   // in the gap between the 61° and 92° lines

    /** The disc. `boost` brightens the whole face: the lock's flash is the same disc, catching the light. */
    function paintDisc(b, boost = 0) {
        const G = RAMP.gold(), groove = mix(C.warm, C.void, 0.86), hollow = mix(C.warm, C.void, 0.64), glint = mix(C.warm, C.light, 0.35);
        if (!boost) Lab.disc(b, CX, CY, R + 8, d => (d * (R + 8) > R + 1 ? 0.2 * (1 - (d * (R + 8) - R) / 8) : 0), mix(C.lightHalo, C.void, 0.55));
        if (!boost) Lab.disc(b, CX, CY, R + 2, 1, C.void);
        for (let y = CY - R; y <= CY + R; y++) for (let x = CX - R; x <= CX + R; x++) {
            const dx = x - CX, dy = y - CY, r = Math.hypot(dx, dy);
            if (r > R) continue;
            let tone = 0.3 + boost + 0.24 * Math.pow(Math.abs(Math.cos(Math.atan2(dy, dx) - 0.8)), 8) * (0.35 + 0.65 * r / R);   // light across a record
            if (Math.round(r) % 3 === 0) tone -= 0.05;                          // fine grooves
            if (r > R - 2) tone = 0.72 + boost + 0.22 * Math.max(0, -(dx + dy) / (r * 1.42));   // the rim, brightest at the top left
            else if ((r > R - 10 && r < R - 8) || (r > 14 && r < 16)) tone -= 0.12;   // the edge band and the hub
            px(b, x, y, G[stop(G, tone, x, y)]);
        }
        PULSARS.forEach(p => {
            const ex = CX + Math.cos(p.a) * p.len, ey = CY + Math.sin(p.a) * p.len, nx = Math.round(-Math.sin(p.a)), ny = Math.round(Math.cos(p.a));
            Lab.line(b, CX + nx, CY + ny, ex + nx, ey + ny, glint, 0.5);
            Lab.line(b, CX, CY, ex, ey, groove);
            [[0, groove], [1, glint]].forEach(([k, col]) => { bar(b, p.a, p.notch + k, -4, -2, col); bar(b, p.a, p.notch + k, 2, 4, col); });   // the notch
        });
        FIGURES.forEach(([parts, fx, fy]) => {              // engraved: a dark hollow, a groove at its edge, the cut's lit wall
            const inside = (x, y) => parts.some(([x0, y0, x1, y1, r]) => segDist(x - fx, y - fy, x0, y0, x1, y1) <= r);
            for (let y = fy - 37; y <= fy + 1; y++) for (let x = fx - 11; x <= fx + 9; x++) {
                if (inside(x, y)) px(b, x, y, !inside(x + 1, y) || !inside(x - 1, y) || !inside(x, y + 1) || !inside(x, y - 1) ? groove : hollow);
                else if ((inside(x - 1, y) || inside(x, y - 1)) && Lab.on(x, y, 0.6)) px(b, x, y, mix(C.warm, C.light, 0.4));
            }
        });
        Lab.text(b, '1977', CX - 50, CY - 90, groove);
        Lab.ring(b, CX, CY, 2, C.light);
        px(b, CX, CY, C.light);
    }

    /** The light at the end, breathing: cached frames of a warm glow `r` px across. */
    function buildGlow(r) {
        const ramp = RAMP.glow(), n = Math.ceil(r) * 2 + 2;
        return Array.from({ length: GLOW_FRAMES }, (_, i) => {
            const bright = 0.74 + 0.26 * (0.5 + 0.5 * Math.sin((i / GLOW_FRAMES) * Math.PI * 2)), c = makeCanvas(n, n), b = c.getContext('2d');
            for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
                const d = Math.hypot(x + 0.5 - n / 2, y + 0.5 - n / 2) / r, k = d < 1 ? stop(ramp, d < 0.16 ? 1 : Math.pow(1 - d, 1.7) * bright, x, y) : 0;
                if (k) px(b, x, y, ramp[k]);
            }
            return c;
        });
    }

    // ── the close-up portholes ──
    const BEACON = [47, 31];                                // the lamp on AEA-29 b, in the porthole's own pixels
    function buildInset(kind) {
        const n = IR * 2 + 1, c = makeCanvas(n, n), b = c.getContext('2d'), rnd = Lab.rng(kind === 'beacon' ? 29 : 17);
        b.fillStyle = C.void; b.fillRect(0, 0, n, n);
        for (let i = 0; i < 22; i++) px(b, Math.floor(rnd() * n), Math.floor(rnd() * n * 0.45), rnd() < 0.3 ? C.star : C.textDim);
        if (kind === 'beacon') {                            // AEA-29 low in the sky, the moon's cratered limb, a mast with a lamp
            planet(b, 12, 10, 24, RAMP.gas(), 1, true);
            for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
                const d = Math.hypot(x - 44, y - 106);
                if (d > 70) continue;
                let tone = 0.16 + 0.42 * Math.exp(-(70 - d) / 9) * (0.55 + 0.45 * x / n);
                [[20, 52, 6], [53, 58, 4], [33, 44, 3]].forEach(([cx, cy, cr]) => { const e = Math.hypot(x - cx, (y - cy) * 1.8); tone += e < cr - 0.6 ? -0.07 : e < cr + 0.6 ? 0.1 : 0; });
                px(b, x, y, C.hull[stop(C.hull, tone, x, y)]);
            }
            for (let k = 1; k <= 4; k++) px(b, BEACON[0], BEACON[1] + k, C.hull[4]);
            px(b, BEACON[0] - 1, BEACON[1] + 4, C.hull[3]); px(b, BEACON[0] + 1, BEACON[1] + 4, C.hull[3]);
        } else {                                            // a grey plain, and rows of stones out to the horizon
            const G = RAMP.grey(), horizon = x => 29 + Math.pow(x - IR, 2) / 300;
            for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (y >= horizon(x)) px(b, x, y, G[stop(G, 0.2 + 0.38 * Math.min(1, (y - horizon(x)) / 36), x, y)]);
            for (let x = 0; x < n; x++) px(b, x, horizon(x), C.hull[3]);
            for (let k = 0; k < 9; k++) {                   // nearer rows are bigger, and the nearest stones have arms
                const y = Math.round(31 + k * 2.2 + k * k * 0.5), tall = 1 + Math.floor(k / 2), wide = k > 4 ? 2 : 1, gap = 3 + k * 1.2;
                for (let x = (k % 2) * gap / 2 + rnd() * 2; x < n && y <= n - 2; x += gap) {
                    const sx = Math.round(x);
                    b.fillStyle = C.textDim; b.fillRect(sx, y - tall, wide, tall);
                    if (k > 5) b.fillRect(sx - 1, y - tall + 1, wide + 2, 1);
                    px(b, sx, y - tall, mix(C.textDim, C.text, 0.5)); px(b, sx + wide, y, C.void);
                }
            }
        }
        for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (Math.hypot(x - IR, y - IR) > IR + 0.3) b.clearRect(x, y, 1, 1);
        return c;
    }

    // ── the sector map ──
    /** A point on the heading: `along` 0..1 from the lower left, `off` px to one side. In sector 6 the band narrows into the light. */
    function headingPoint(M, along, off = 0) {
        const ex = M.end[0] - START[0], ey = M.end[1] - START[1], len = Math.hypot(ex, ey), keep = M.final ? 0.4 + 0.6 * Math.pow(1 - along, 0.8) : 1;
        return { x: START[0] + ex * along - (ey / len) * off * keep, y: START[1] + ey * along + (ex / len) * off * keep };
    }
    function buildMap(M, w) {
        const c = makeCanvas(), b = c.getContext('2d'), rnd = Lab.rng(M.seed), blinkers = [];
        b.fillStyle = C.void; b.fillRect(0, 0, W, H);
        Lab.nebula(b, M.seed, 0.32);
        Lab.stars(b, M.seed + 7, 130);
        if (M.hint > 1) Lab.disc(b, 474, 48, 2.5, 0.55, C.lightHalo);           // far off, at the end of the heading, something warm
        if (M.hint) px(b, 474, 48, M.hint > 1 ? C.light : C.lightHalo);
        M.planets.forEach(([name, x, y, r, kind]) => { planet(b, x, y, r, RAMP[kind](), 1, kind === 'gas'); centre(b, name, x, y + r + 5, C.textDim); });
        for (let i = 0; i < M.pips; i++) {                  // dead transponders, still in the band; a few still blink
            const along = M.final ? Math.pow(rnd(), 0.6) : rnd(), p = headingPoint(M, along, (rnd() - 0.5) * rnd() * BAND), x = Math.round(p.x), y = Math.round(p.y);
            const mid = rnd() < 0.3, big = rnd() < 0.3, blink = rnd() < 0.08, period = 5 + rnd() * 7, phase = rnd() * 12;
            if (M.final && Math.hypot(x - M.end[0], y - M.end[1]) < GLOW_MAP * 0.55) continue;
            if (blink) blinkers.push({ x, y, period, phase });
            else { b.fillStyle = mid ? C.textDim : mix(C.uiDim, C.textDim, 0.35); b.fillRect(x, y, big ? 2 : 1, 1); }
        }
        for (let i = 0; i < M.hulls; i++) {                 // the handful of hulls close enough to see
            const p = headingPoint(M, 0.3 + rnd() * 0.62, (rnd() - 0.5) * BAND * 0.7), len = 3 + Math.floor(rnd() * 4), x = Math.round(p.x), y = Math.round(p.y);
            b.fillStyle = C.void; b.fillRect(x, y, len, 2);
            b.fillStyle = C.hull[3]; b.fillRect(x + 1, y - 1, len - 2, 1);
        }
        const wreck = headingPoint(M, WRECK_AT, -4), x = Math.round(wreck.x), y = Math.round(wreck.y);
        b.fillStyle = C.void; b.fillRect(x - 4, y - 1, 8, 3);
        b.fillStyle = C.hull[4]; b.fillRect(x - 3, y - 2, 3, 1); b.fillRect(x + 1, y - 2, 2, 1);   // one edge catches light; it is broken
        Lab.text(b, 'EXODUS-' + w.num, x + 7, y + 3, C.textDim);
        Lab.text(b, w.age + ' YEARS', x + 7, y + 10, C.uiDim);
        return { canvas: c, blinkers, us: headingPoint(M, US_AT), wreck };
    }

    // ── sound: quiet, and only when the page's sound is on ──
    function tone(freq, o = {}) {
        const ac = Lab.audio.get(), out = Lab.audio.master;
        if (!ac || !out) return;
        const t0 = ac.currentTime + (o.at || 0), dur = o.dur || 0.4, osc = ac.createOscillator(), amp = ac.createGain(), lp = ac.createBiquadFilter();
        osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(freq, t0); lp.frequency.value = o.cut || 2400;
        if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + dur * 0.7);
        amp.gain.setValueAtTime(0.0001, t0); amp.gain.exponentialRampToValueAtTime(o.gain || 0.03, t0 + (o.attack || 0.01));
        amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(lp); lp.connect(amp); amp.connect(out); osc.start(t0); osc.stop(t0 + dur + 0.05);
    }
    function click() {                                      // a soft tick of filtered noise
        const ac = Lab.audio.get(), out = Lab.audio.master, buf = Lab.audio.noiseBuffer();
        if (!ac || !out || !buf) return;
        const src = ac.createBufferSource(), bp = ac.createBiquadFilter(), amp = ac.createGain(), t0 = ac.currentTime;
        src.buffer = buf; bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 1.2;
        amp.gain.setValueAtTime(0.08, t0); amp.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.035);
        src.connect(bp); bp.connect(amp); amp.connect(out); src.start(t0, Math.random() * 1.5, 0.05);
    }
    const SOUND = {
        tick: n => tone(520 + n * 22, { dur: 0.06, gain: 0.012, cut: 3000 }),   // rises as more of the fix falls into place
        lock: () => { click(); tone(392, { to: 784, type: 'triangle', dur: 1.1, gain: 0.045, attack: 0.03, cut: 2200 }); tone(587, { to: 1175, at: 0.08, dur: 1, gain: 0.02, attack: 0.04 }); },
        found: () => { tone(880, { dur: 1.6, gain: 0.024 }); tone(1318, { at: 0.14, dur: 1.4, gain: 0.014 }); },
        course: () => [330, 415, 494].forEach((f, k) => tone(f, { at: k * 0.12, dur: 1.4, gain: 0.022, attack: 0.08, type: 'triangle', cut: 1600 })),
        light: () => [110, 131, 165].forEach((f, k) => tone(f, { at: k * 0.25, dur: 4.5, gain: 0.03, attack: 1.4, cut: 900 })),
    };

    function mount(ctx, ui) {
        const smoothing = ctx.imageSmoothingEnabled, sky = makeCanvas(), bg = makeCanvas(), bright = makeCanvas(), cv = ui.canvas;
        ctx.imageSmoothingEnabled = false;
        [[sky, 0], [bg, 0.32]].forEach(([c, neb]) => {     // the ending's sky has no nebula, so the opened chart is not a hole in one
            const b = c.getContext('2d');
            b.fillStyle = C.void; b.fillRect(0, 0, W, H);
            if (neb) Lab.nebula(b, 1977, neb);
            Lab.stars(b, 1977, 140);
        });
        paintDisc(bg.getContext('2d'));
        paintDisc(bright.getContext('2d'), 0.42);          // the same disc catching the light, for the lock's flash
        const focused = document.activeElement;
        if (focused && focused.classList && focused.classList.contains('pick')) focused.blur();   // so Space does not reopen the list item

        const maps = [], insets = {}, glows = {}, beaconLit = () => clock % 1.6 < 0.5;
        const mapAt = i => maps[i] || (maps[i] = buildMap(MAPS[i], WRECKS[i]));
        const insetOf = kind => insets[kind] || (insets[kind] = buildInset(kind));
        const glowFrame = r => (glows[r] || (glows[r] = buildGlow(r)))[Math.floor(((clock % BREATH) / BREATH) * GLOW_FRAMES)];
        let mode = 'date', s = null, m = null, wipe = null, held = null, endReady = false, endT = 0, gen = 0, clock = 0, lastCount = 99, lastTick = 0;
        let view = { ...WRECKS[0].range }, plotted = [], courses = [], queue = [];   // view: the chart's range, zooming out with depth
        const later = (sec, fn) => { const g = gen; queue = queue.concat({ at: clock + sec, fn: () => g === gen && fn() }); };
        const sayLater = (sec, [who, line]) => later(sec, () => ui.say(who, line));
        const busy = () => mode !== 'date' || !s || s.locked, fresh = () => clock - s.born < FRESH;
        const toChart = (b, yr, ly) => ({ x: Math.round(b.x + (yr / view.y) * b.w), y: Math.round(b.y + b.h - (ly / view.l) * b.h) });
        const onPad = p => p.x >= PAD.x - 6 && p.x <= PAD.x + PAD.w + 6 && p.y >= PAD.y - 6 && p.y <= PAD.y + PAD.h + 6;
        const nearPlace = p => { const D = MAPS[m.i].dest; return Math.hypot(p.x - D.x, p.y - D.y) < D.r + 14; };
        const setReady = (k = 'ready') => { m = { ...m, [k]: true }; showButtons(); };

        // ── the flow: date → map → (next wreck | the end) ──
        function startWreck(i, from) {
            gen++; queue = []; held = null; lastCount = 99; mode = 'date';
            const w = WRECKS[i], rnd = Lab.rng(w.seed);
            const shuffle = list => { const out = list.slice(); for (let k = out.length - 1; k > 0; k--) { const j = Math.floor(rnd() * (k + 1)); [out[k], out[j]] = [out[j], out[k]]; } return out; };
            s = { i, v: from, d: from, locked: false, moved: false, dragging: false, flash: 0, born: clock, rates: shuffle(RATES), swings: shuffle(SWINGS).map(k => (rnd() < 0.5 ? -k : k)) };
            w.intro.forEach((line, j) => (j ? sayLater(LINE_GAP * j, line) : ui.say(line[0], line[1])));
            showButtons();
        }
        const restart = () => { endReady = false; plotted = []; courses = []; startWreck(0, { y: 0, l: 0 }); };   // the first fix starts from us
        const startWipe = () => { const snap = makeCanvas(); snap.getContext('2d').drawImage(ctx.canvas, 0, 0); wipe = { snap, t: 0 }; };
        function lock() {
            const w = WRECKS[s.i];
            gen++; queue = []; held = null;                 // an intro line still waiting would now be out of place
            s = { ...s, locked: true, dragging: false, flash: FLASH, d: { ...s.v } };
            plotted = plotted.concat(w); SOUND.lock(); showButtons();
            w.locked.forEach((line, j) => sayLater(0.4 + j * LINE_GAP, line));
            later(0.4 + (w.locked.length - 1) * LINE_GAP + TO_MAP, () => openMap(s.i));
        }
        function openMap(i) {
            const w = WRECKS[i], final = MAPS[i].final;
            mapAt(i); startWipe();                          // built before the snapshot: the nebula takes a moment
            mode = 'map'; m = { i, t: 0, set: false, setAt: 0, canSet: false, ready: false };
            showButtons();
            later(T_FOUND, SOUND.found);
            later(T_AURA, () => { ui.say('A.U.R.A.', w.place.aura); if (!final) setReady('canSet'); });
            if (final) { sayLater(T_AURA + LINE_GAP, w.place.react); later(T_AURA + LINE_GAP + 1.2, setReady); }
        }
        function setCourse() {
            const w = WRECKS[m.i];
            m = { ...m, set: true, setAt: m.t, canSet: false }; courses = courses.concat(w.place.name.toUpperCase());
            SOUND.course(); showButtons();
            sayLater(BEND + 0.3, w.place.react); later(BEND + 1.6, setReady);
        }
        function finish() {
            const t = ZOOM + TREND + REACH + 0.5;
            startWipe(); mode = 'end'; endT = 0; endReady = false; courses = courses.concat(WRECKS[m.i].place.name.toUpperCase());
            showButtons();
            later(ZOOM + TREND, SOUND.light); sayLater(t, END[0]);
            later(t + LINE_GAP, () => { ui.say(END[1][0], END[1][1]); endReady = true; showButtons(); });
        }
        function advance() {
            if (wipe) return;                               // let the view finish moving
            if (mode === 'end') { if (endReady) { startWipe(); restart(); } return; }
            if (mode !== 'map') return;
            if (m.canSet) setCourse();
            else if (m.ready && MAPS[m.i].final) finish();
            else if (m.ready) { const i = m.i; startWipe(); startWreck(i + 1, { y: WRECKS[i].age, l: WRECKS[i].ly }); }
        }

        function setPad(y, l) {
            if (busy()) return;
            const r = WRECKS[s.i].range;
            s = { ...s, moved: true, v: { y: clamp(Math.round(y), 0, r.y), l: clamp(Math.round(l), 0, r.l) } };
        }
        const nudge = (dy, dl) => setPad(s.v.y + dy, s.v.l + dl);
        const padAt = p => setPad(((p.x - PAD.x) / PAD.w) * view.y, ((PAD.y + PAD.h - p.y) / PAD.h) * view.l);
        function release() {
            if (!s || !s.dragging) return;
            const w = WRECKS[s.i], near = k => Math.abs(s.v[k] - (k === 'y' ? w.age : w.ly)) <= Math.max(SNAP, w.range[k] * SNAP_FRAC);
            s = { ...s, dragging: false, v: !s.locked && near('y') && near('l') ? { y: w.age, l: w.ly } : s.v };
        }
        function showButtons() {
            const go = label => [{ label, primary: true, onClick: advance }];
            if (mode === 'end') return ui.buttons(endReady ? go('Run it again') : []);
            if (mode === 'map') return ui.buttons(m.canSet ? go('Set course') : m.ready ? go(MAPS[m.i].final ? 'Back to the chart' : 'Next wreck') : []);
            ui.buttons(s.locked ? [] : [[-1, 0, 'Fewer years'], [1, 0, 'More years'], [0, -1, 'Nearer'], [0, 1, 'Farther']].map(([dy, dl, label]) => ({
                label, hold: true, onUp: () => { held = null; },
                onDown: () => { if (busy() || fresh()) return; nudge(dy, dl); held = { dy, dl, wait: HOLD_DELAY, age: 0 }; },
            })));
        }

        // ── drawing: the disc and the chart ──
        function drawFix() {                                // the wreck's fourteen lines and marks over the disc; counts those in place
            const w = WRECKS[s.i], white = s.flash > FLASH * 0.55, base = ctx.globalAlpha, a0 = s.flash / FLASH;
            let lines = 0, marks = 0;
            ctx.drawImage(bg, 0, 0);
            if (s.flash > 0) { ctx.globalAlpha = base * Math.pow(a0, 2.2); ctx.drawImage(bright, 0, 0); ctx.globalAlpha = base; }   // the gold catches the light
            PULSARS.forEach((p, j) => {
                const off = s.swings[j] * (s.d.l - w.ly), a = p.a + off, want = p.notch + s.rates[j] * (s.d.y - w.age), at = clamp(want, MIN_R, p.len);
                const lineOn = Math.abs(off) < ANGLE_TOL, markOn = Math.abs(want - p.notch) < MARK_TOL, far = want !== at, reach = markOn ? 4 : far ? 1 : 2;
                lines += lineOn ? 1 : 0; marks += markOn ? 1 : 0;
                Lab.line(ctx, CX, CY, CX + Math.cos(a) * p.len, CY + Math.sin(a) * p.len, white ? C.star : lineOn ? C.uiBright : C.ui, lineOn ? 1 : 0.6);
                bar(ctx, a, at, -reach, reach, far ? C.textDim : markOn && !white ? C.uiBright : C.star);   // the mark; dim while the years are far out
            });
            px(ctx, CX, CY, C.star);
            if (s.flash > 0) {                              // a ring runs out from the centre
                Lab.ring(ctx, CX, CY, (1 - a0) * (R + 26) + 4, C.uiBright, Math.min(1, a0 * 1.6));
                Lab.ring(ctx, CX, CY, Math.max(1, (1 - a0) * (R + 26) - 6), C.ui, a0 * 0.8);
            }
            return { lines, marks };
        }
        function drawChart(b, opts) {                       // opts.cursor: the point you move; opts.trend / opts.reach (0..1): the ending's line
            const o = toChart(b, 0, 0), top = toChart(b, view.y, view.l), c = opts.cursor && toChart(b, s.d.y, s.d.l);
            ctx.fillStyle = C.void; ctx.fillRect(o.x - 22, top.y - 14, top.x - o.x + 28, o.y - top.y + 26);   // no stars posing as data
            for (let i = 1; i < 5; i++) for (let j = 1; j < 4; j++) px(ctx, b.x + (b.w * i) / 5, b.y + (b.h * j) / 4, C.line2);
            if (opts.reach > 0) {                           // past the deepest wreck to the light, where the line leaves the chart
                const k = Math.min(view.y / LAST.age, view.l / LAST.ly), from = toChart(b, LAST.age, LAST.ly), edge = toChart(b, LAST.age * k, LAST.ly * k);
                const grow = smooth(clamp((opts.reach - 0.45) / 0.55, 0, 1)), t = smooth(Math.min(1, opts.reach * 1.25)), f = glowFrame(GLOW_END), sw = Math.round(f.width * (0.25 + 0.75 * grow));
                if (grow > 0) ctx.drawImage(f, Math.round(edge.x - sw / 2), Math.round(edge.y - sw / 2), sw, sw);
                Lab.line(ctx, from.x, from.y, lerp(from.x, edge.x, t), lerp(from.y, edge.y, t), C.lightHalo, 0.75);
            }
            if (opts.trend > 0) { const q = toChart(b, LAST.age * opts.trend, LAST.ly * opts.trend); Lab.line(ctx, o.x, o.y, q.x, q.y, C.ui); }
            if (c) { Lab.line(ctx, c.x, top.y, c.x, o.y - 1, C.line2); Lab.line(ctx, o.x + 1, c.y, top.x, c.y, C.line2); }
            Lab.line(ctx, o.x, o.y, top.x, o.y, C.textDim); Lab.line(ctx, o.x, top.y, o.x, o.y, C.textDim);
            Lab.text(ctx, 'LY DOWN THE HEADING', o.x, top.y - 10, C.textDim); right(ctx, String(Math.round(view.l)), o.x - 4, top.y, C.textDim);
            Lab.text(ctx, '0', o.x - 1, o.y + 4, C.textDim); centre(ctx, 'YEARS DEAD', (o.x + top.x) / 2, o.y + 4, C.textDim);
            right(ctx, String(Math.round(view.y)), top.x, o.y + 4, C.textDim);
            Lab.disc(ctx, o.x + 1, o.y - 1, 2, 1, C.ui); right(ctx, 'US', o.x - 7, o.y - 3, C.ui);   // us: alive, and where we started
            plotted.forEach(wk => {
                const p = toChart(b, wk.age, wk.ly), tw = Lab.textWidth(wk.num), lx = p.x + 5 + tw > top.x ? p.x - 5 - tw : p.x + 5;
                ctx.fillStyle = C.void; ctx.fillRect(lx - 1, p.y - 8, tw + 2, 7);
                Lab.text(ctx, wk.num, lx, p.y - 7, C.textDim); Lab.disc(ctx, p.x, p.y, 2, 1, C.text);
            });
            if (!c) return;
            const col = s.locked || s.dragging ? C.uiBright : C.ui;
            Lab.ring(ctx, c.x, c.y, 4, col); px(ctx, c.x, c.y, col);
            if (s.locked && s.flash > 0) Lab.ring(ctx, c.x, c.y, 4 + (1 - s.flash / FLASH) * 12, C.uiBright, s.flash / FLASH);
            if (!s.moved && !s.locked && Math.floor(clock * 2) % 2) Lab.ring(ctx, c.x, c.y, 7, C.uiBright);   // this is the thing you move
        }
        function drawHud(w, lines, marks) {
            Lab.text(ctx, 'EXODUS', 10, 10, C.textDim); Lab.text(ctx, w.num, 10, 18, C.text, 3); Lab.text(ctx, 'SECTOR ' + w.sector, 10, 38, C.textDim);
            // each counter sits on the row of the axis that moves it; MARKS in the marks' white, LINES in the lines' colour
            [['YEARS', s.v.y, 'MARKS', marks, C.star, 182], ['LY', s.v.l, 'LINES', lines, C.ui, 198]].forEach(([axis, v, what, n, col, y]) => {
                Lab.text(ctx, axis, 306, y, C.textDim, 2);
                right(ctx, String(v), 376, y, s.locked ? C.uiBright : C.text, 2);
                Lab.text(ctx, what, 386, y, n === 14 ? C.uiBright : mix(col, C.void, 0.3), 2);
                right(ctx, two(n) + '/14', W - 10, y, n === 14 ? C.uiBright : C.text, 2);
            });
            if (s.locked) right(ctx, 'DATED', W - 10, 10, C.uiBright, 2);
        }
        function drawCourses() {                            // every course the crew has earned so far
            if (courses.length) Lab.text(ctx, 'COURSES', 10, 232, C.textDim);
            courses.forEach((name, k) => Lab.text(ctx, '> ' + name, 10, 241 + k * 9, k === 2 ? C.lightHalo : C.warm));
        }
        function renderDate() {
            const { lines, marks } = drawFix(), count = lines + marks;
            drawChart(PAD, { cursor: true }); drawHud(WRECKS[s.i], lines, marks); drawCourses();
            if (count > lastCount && !s.locked && clock - lastTick > 0.06) { SOUND.tick(count); lastTick = clock; }
            lastCount = count;
        }
        function renderEnd() {                              // the disc fades and the chart the player filled in opens up past it
            const e = smooth(clamp(endT / ZOOM, 0, 1));
            ctx.drawImage(sky, 0, 0);
            if (e < 1) { ctx.globalAlpha = 1 - e; drawFix(); ctx.globalAlpha = 1; }
            view = { y: lerp(LAST.range.y, END_RANGE.y, e), l: lerp(LAST.range.l, END_RANGE.l, e) };
            const b = { x: lerp(PAD.x, BIG.x, e), y: lerp(PAD.y, BIG.y, e), w: lerp(PAD.w, BIG.w, e), h: lerp(PAD.h, BIG.h, e) };
            drawChart(b, { trend: clamp((endT - ZOOM) / TREND, 0, 1), reach: clamp((endT - ZOOM - TREND) / REACH, 0, 1) });
            drawCourses();
        }

        // ── drawing: the sector map ──
        function drawRoute(M, P) {                          // our course in warm dashes: down the heading, or bent through the place
            const us = P.us, end = { x: M.end[0], y: M.end[1] }, D = M.dest, vx = end.x - us.x, vy = end.y - us.y;
            const t = ((D.x - us.x) * vx + (D.y - us.y) * vy) / (vx * vx + vy * vy), bend = m.set ? smooth(clamp((m.t - m.setAt) / BEND, 0, 1)) : 0;
            const pts = M.final ? [us, end] : [us, { x: lerp(us.x + vx * t, D.x, bend), y: lerp(us.y + vy * t, D.y, bend) }, end];
            const lens = pts.slice(1).map((q, k) => Math.hypot(q.x - pts[k].x, q.y - pts[k].y));
            let run = 0, left = (M.final ? smooth(clamp((m.t - T_LINE - LINE_DUR) / 0.9, 0, 1)) : 1) * lens.reduce((a, q) => a + q, 0);   // sector 6: ours traces theirs
            lens.forEach((len, k) => {
                const a = pts[k], q = pts[k + 1];
                for (let d = 0; d < Math.min(len, left); d++) {
                    const x = a.x + ((q.x - a.x) * d) / len, y = a.y + ((q.y - a.y) * d) / len, phase = (((run + d - clock * 30) % 9) + 9) % 9;
                    if (phase > 4 || Math.hypot(x - us.x, y - us.y) < 6 || (M.final && Math.hypot(x - end.x, y - end.y) < 10)) continue;
                    px(ctx, x, y, phase > 3 ? C.warmBright : C.warm);
                }
                run += len; left -= len;
            });
        }
        function drawWreckCourse(M, P) {                    // where the dead crew was steering; it fades once our course takes it over
            const g = smooth(clamp((m.t - T_LINE) / LINE_DUR, 0, 1)), fadeAt = m.set ? m.setAt + BEND : M.final ? T_LINE + LINE_DUR + 0.9 : Infinity;
            const shade = 0.6 * (1 - clamp((m.t - fadeAt) / FADE, 0, 1)), a = P.wreck, D = M.dest, dx = D.x - a.x, dy = D.y - a.y, d = Math.hypot(dx, dy);
            if (g <= 0 || shade <= 0) return;
            const len = (d - (M.final ? 12 : D.r + 3) - 6) * g, sx = a.x + (dx / d) * 6, sy = a.y + (dy / d) * 6, tx = sx + (dx / d) * len, ty = sy + (dy / d) * len;
            Lab.line(ctx, sx, sy, tx, ty, C.ui, shade);
            if (g < 1) { ctx.fillStyle = C.uiBright; ctx.fillRect(Math.round(tx) - 1, Math.round(ty) - 1, 2, 2); }
        }
        function drawLight(M) {                             // sector 6: the light at the end, small until their course reaches it
            const D = M.dest, f = glowFrame(GLOW_MAP), sw = Math.round(f.width * (0.35 + 0.65 * smooth(clamp((m.t - T_FOUND) / 0.8, 0, 1))));
            ctx.drawImage(f, Math.round(D.x - sw / 2), Math.round(D.y - sw / 2), sw, sw);
            for (let k = 0; k < 3 && sw >= f.width * 0.95; k++) {   // small dark hulls drift across its face
                const hx = D.x - 30 + ((clock * 1.2 + k * 23) % 60), hy = D.y - 12 + k * 11;
                if (Math.hypot(hx - D.x, hy - D.y) < GLOW_MAP * 0.62) { ctx.fillStyle = C.void; ctx.fillRect(Math.round(hx), Math.round(hy), 5 - k, 2); }
            }
        }
        function drawPlace(M, w) {                          // the place appears, brackets close on it, and it is named like every planet here
            const D = M.dest, f = smooth(clamp((m.t - T_FOUND) / 0.8, 0, 1)), fb = clamp((m.t - T_FOUND) / 0.6, 0, 1), lit = beaconLit() && f === 1;
            if (f <= 0) return;
            if (D.kind === 'graves') planet(ctx, D.x, D.y, D.r, RAMP.grey(), f);
            if (D.kind === 'beacon') {                      // the beacon is a person's lamp, so it is warm
                planet(ctx, D.giant[0], D.giant[1], D.giant[2], RAMP.gas(), f, true); planet(ctx, D.x, D.y, 4, C.hull, f);
                if (lit) Lab.disc(ctx, D.x + 1, D.y - 4, 2.5, d => 0.55 * (1 - d), C.warm);
                if (f === 1) px(ctx, D.x + 1, D.y - 4, lit ? C.warmBright : mix(C.warm, C.void, 0.45));
            }
            const hs = Math.round(lerp(34, D.r + 5, smooth(fb))), col = fb < 1 ? C.uiBright : C.ui;
            [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => { for (let k = 0; k <= 4; k++) { px(ctx, D.x + sx * (hs - k), D.y + sy * hs, col); px(ctx, D.x + sx * hs, D.y + sy * (hs - k), col); } });
            if (fb === 1 && !M.final) centre(ctx, w.place.name.toUpperCase(), D.x, D.y - D.r - 14, C.text);
        }
        function drawPanel(M, w) {                          // what the fix says, in words, beside a close look at the place
            const f = m.t - T_FOUND, g = clamp((m.t - T_PORT) / 0.35, 0, 1), [ix, iy] = PORT, kind = M.dest.kind;
            if (f < 0.3) return;
            const x = M.final ? W - 10 : TEXT_X, y = iy - 14, name = w.place.name.toUpperCase(), sub = 'WHERE EXODUS-' + w.num + ' WAS GOING';
            const wide = Math.max(Lab.textWidth(sub), Lab.textWidth(name, 2), Lab.textWidth(w.place.readout));
            Lab.shade(ctx, x - wide - 3, y - 3, wide + 6, 35, 0.7, C.void);   // keep the stars off the words
            right(ctx, sub, x, y, C.textDim);
            Lab.text(ctx, name.slice(0, Math.floor((f - 0.3) / 0.05)), x - Lab.textWidth(name, 2), y + 9, C.text, 2);
            if (m.t >= T_AURA) right(ctx, w.place.readout, x, y + 25, C.ui);
            if (M.final || g <= 0) return;
            if (g < 1) Lab.disc(ctx, ix, iy, IR * g, 1, C.void);
            else {
                const bx = ix - IR + BEACON[0], by = iy - IR + BEACON[1], lit = beaconLit(), open = clamp((m.t - T_PORT - 0.35) / 0.45, 0, 1);
                ctx.drawImage(insetOf(kind), ix - IR, iy - IR);
                if (kind === 'beacon' && lit) Lab.disc(ctx, bx, by, 4, d => 0.6 * (1 - d), C.warm);
                if (kind === 'beacon') px(ctx, bx, by, lit ? C.warmBright : mix(C.warm, C.void, 0.4));
                if (open < 1) Lab.disc(ctx, ix, iy, IR, 1 - open, C.void);
            }
            Lab.ring(ctx, ix, iy, IR * g + 1, C.line2); Lab.ring(ctx, ix, iy, IR * g + 2, C.hull[3], 0.6);
        }
        function renderMap() {
            const M = MAPS[m.i], P = mapAt(m.i), w = WRECKS[m.i], x = Math.round(P.us.x), y = Math.round(P.us.y), grow = (clock % 2.2) / 2.2;
            ctx.drawImage(P.canvas, 0, 0);
            P.blinkers.forEach(b => {                       // a few dead beacons still flash, slowly and out of step
                const lit = (clock + b.phase) % b.period < 0.22;
                ctx.fillStyle = lit ? C.uiBright : C.uiDim; ctx.fillRect(b.x, b.y, lit ? 2 : 1, lit ? 2 : 1);
            });
            if (M.final) drawLight(M);
            drawWreckCourse(M, P); drawRoute(M, P); drawPlace(M, w);
            Lab.ring(ctx, x, y, 3 + grow * 10, grow < 0.5 ? C.ui : C.uiDim, 1 - grow * 0.6);   // our marker, as the main map shows it
            ctx.fillStyle = C.uiBright; ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3);
            Lab.text(ctx, 'EXODUS-9', x - 14, y + 8, C.ui);
            drawPanel(M, w);
            Lab.text(ctx, 'SECTOR ' + w.sector, 10, 10, C.textDim, 2);
            if (m.set) right(ctx, 'COURSE SET', W - 10, 10, C.warm, 2);
        }
        function drawWipe(dt) {                             // the view re-plots behind a scan line
            wipe = { ...wipe, t: wipe.t + dt };
            const k = clamp(wipe.t / WIPE, 0, 1), x = Math.round(smooth(k) * (W + 16)) - 8, sx = Math.max(0, x);
            if (sx < W) ctx.drawImage(wipe.snap, sx, 0, W - sx, H, sx, 0, W - sx, H);
            Lab.shade(ctx, x - 14, 0, 14, H, 0.22, C.uiDim);
            ctx.fillStyle = C.ui; ctx.fillRect(x, 0, 1, H);
            if (k >= 1) wipe = null;
        }

        // ── input ──
        cv.onpointerdown = e => {
            const p = ui.toPixel(e);
            if (mode === 'map') { if (m.canSet && nearPlace(p)) advance(); return; }
            if (!onPad(p) || busy() || fresh()) return;
            s = { ...s, dragging: true };
            try { cv.setPointerCapture(e.pointerId); } catch (err) { /* capture is optional */ }
            padAt(p);
        };
        cv.onpointermove = e => {
            const p = ui.toPixel(e);
            if (mode === 'map') { cv.style.cursor = m.canSet && nearPlace(p) ? 'pointer' : 'default'; return; }
            cv.style.cursor = (onPad(p) && !busy()) || (s && s.dragging) ? 'crosshair' : 'default';
            if (s && s.dragging) { if (e.buttons) padAt(p); else release(); }
        };
        cv.onpointerup = release;
        Lab.onKey((k, e) => {
            if (k === ' ' || k === 'Enter') {
                if (e && e.target && e.target.classList && e.target.classList.contains('pick')) return;   // the list item handles it
                if (e) e.preventDefault();                  // one press, one step, whichever button has focus
                return advance();
            }
            const step = { ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0], ArrowDown: [0, -1], s: [0, -1], ArrowUp: [0, 1], w: [0, 1] }[k], big = e && e.shiftKey ? 10 : 1;
            if (step && !busy()) nudge(step[0] * big, step[1] * big);
        });

        function stepDate(dt) {
            const w = WRECKS[s.i], k = Math.min(1, dt * EASE), kz = Math.min(1, dt * RESCALE), fast = held && held.age > HOLD_FAST_AFTER;
            if (held && !busy()) {
                held = { ...held, wait: held.wait - dt, age: held.age + dt };
                for (; held.wait <= 0; held = { ...held, wait: held.wait + HOLD_EVERY }) nudge(held.dy * (fast ? Math.max(1, Math.round(w.range.y / 100)) : 1), held.dl * (fast ? Math.max(1, Math.round(w.range.l / 100)) : 1));
            }
            const ease = (a, b) => (Math.abs(b - a) < 0.01 ? b : a + (b - a) * k), zoom = (a, b) => a * Math.pow(b / a, kz);   // the zoom is even in ratio
            s = { ...s, d: { y: ease(s.d.y, s.v.y), l: ease(s.d.l, s.v.l) }, flash: Math.max(0, s.flash - dt) };
            view = Math.abs(view.y / w.range.y - 1) < 0.01 ? { ...w.range } : { y: zoom(view.y, w.range.y), l: zoom(view.l, w.range.l) };
            if (!s.locked && s.v.y === w.age && s.v.l === w.ly && Math.abs(s.d.y - s.v.y) < 0.02 && Math.abs(s.d.l - s.v.l) < 0.02) lock();
        }

        Lab.loop(dt => {
            clock += dt;
            const due = queue.filter(q => q.at <= clock);
            if (due.length) { queue = queue.filter(q => q.at > clock); due.forEach(q => q.fn()); }
            if (mode === 'map') { m = { ...m, t: m.t + dt }; renderMap(); }
            else if (mode === 'end') { endT += dt; renderEnd(); }
            else { stepDate(dt); renderDate(); }
            if (wipe) drawWipe(dt);
        }, 30);

        restart();
        renderDate();
        return () => { cv.style.cursor = ''; ctx.imageSmoothingEnabled = smoothing; held = null; queue = []; wipe = null; gen++; };
    }

    Lab.register({
        id: 'disc', badge: 'reworked',
        name: 'Date it with the disc',
        short: 'Date a wreck, find its course',
        verb: "Move one point on a chart of years dead against light-years down the heading until a wreck's fourteen star lines and marks fit the disc. The dated fix shows where that crew was going, and you set a course there.",
        serves: 'The disc, the time throw and the light: the deeper the wreck, the older it is, and every dead crew was flying the way we are.',
        replaces: "The deep-scan tuning dials, the captain's log that explains the time throw, and story places appearing on the sector map unexplained.",
        controls: 'Drag on the chart · ←/→ years · ↑/↓ distance · Shift: ×10 · Space: set course / next',
        mount,
    });
})();
