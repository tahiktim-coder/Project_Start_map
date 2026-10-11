/* DiscDating.js — "Date it with the disc", played over the game by MiniHost as 'disc' (ported from prototypes/sim-bay/proto-disc.js).
   Played after the crew visits one of our wrecks, once they have the disc drawing. The wreck's last star fix holds fourteen
   pulsar readings. Years dead slide each mark along its line toward the disc's notch (every pulsar slows at its own rate);
   light-years down the heading swing each line onto the disc's. One point on the chart gets both, and that dates the wreck.
   With a reward, the fix also says where that crew was heading: the view moves to the sector map, their course draws out,
   the place appears, named, and the crew sets a course there. A reward of kind 'light' goes back to the chart instead, where
   the line through every dated wreck runs on to the light at its edge.

   const result = await MiniHost.play('disc', opts)
   opts: { wreck:   { hull: 980, sector: 3 }          the wreck just visited; its age and distance come from these
           plotted: [{ hull: 4, age: 21, ly: 8 }]     wrecks dated before (their results), drawn on the chart; may be empty
           reward:  { name: 'Phoebe-17 Minor', kind: 'beacon' | 'graves' | 'light',
                      line: { who: 'Aris', text: 'Someone was left alive to bury them.' } }   or null: no map
           crew:    optional: the game's crew list; lines of crew whose status is 'DEAD' are never said
           names:   optional: other planets on the game's sector map; the sketch's planets wear these names (up to three) }
   result: { dated: true, hull, age, ly } after Continue (push it onto plotted for next time), or { dated: false } after "Not now"
   DiscDating.ageOf(hull) and DiscDating.lyOf(hull, sector) give the same date without playing (docs/CANON.md §2).

   THE LOOK (2026-10-11): the travel view's. Drawn at density 1.5 (720 × 405 art pixels) with its recipes (MiniPaint, the
   minigames' copy of src/newscreen/art/Paint.js): its deep-field sky, an old-gold disc cut like a record, the sector map's
   worlds lit from the end of the heading, our Lander flying with its drive lit, the wreck broken in two with its red
   beacon, the light as the false sun. Words are MiniHost readouts (ui.note): few, small, quiet. The rules, the controls,
   the timing, the lines and the result are unchanged; they still think in 480 × 270 picture units. */
(function () {
    'use strict';

    // ── the dates (CANON.md §2): a higher hull number was thrown further back, so its wreck has been dead longer ──
    const SECTORS = 6;
    const AGE_BY_HULL = [                   // [hull number, years dead]; between two anchors the age runs in a straight line
        [1, 18], [8, 24],                   // EXODUS-1 … 8: about twenty years
        [212, 96], [980, 104],              // sector 3: a century
        [1400, 190], [6000, 212],           // sector 4: two centuries
        [9000, 290], [22000, 318],          // sector 5: three centuries
        [30000, 390], [41000, 410],         // sector 6: four centuries
    ];
    const LY_PER_YEAR = 0.4, LY_PER_SECTOR = 4; // older wrecks lie further down the heading; a deeper sector adds a little more

    /** Years the wreck of hull number `hull` has been dead, as the disc dates it. */
    function ageOf(hull) {
        if (!(hull >= 1)) throw new RangeError(`DiscDating: hull must be a number, 1 or more (got ${hull})`);
        const next = AGE_BY_HULL.findIndex(([n]) => n >= hull);
        if (next === 0) return AGE_BY_HULL[0][1];
        if (next < 0) return AGE_BY_HULL[AGE_BY_HULL.length - 1][1];
        const [h0, a0] = AGE_BY_HULL[next - 1], [h1, a1] = AGE_BY_HULL[next];
        return Math.round(a0 + ((a1 - a0) * (hull - h0)) / (h1 - h0));
    }
    /** Light-years down the heading to that wreck, found in sector `sector` (1 to 6). */
    function lyOf(hull, sector) {
        if (!(sector >= 1 && sector <= SECTORS)) throw new RangeError(`DiscDating: sector must be 1 to ${SECTORS} (got ${sector})`);
        return Math.round(ageOf(hull) * LY_PER_YEAR) + (Math.round(sector) - 1) * LY_PER_SECTOR;
    }
    window.DiscDating = { ageOf, lyOf };

    const MiniLab = window.MiniLab, MiniHost = window.MiniHost;
    if (!MiniLab || !MiniHost) return;
    const C = MiniLab.C, W = MiniLab.W, H = MiniLab.H, { clamp, lerp } = MiniLab;
    const DENSITY = 1.5, D = DENSITY, AW = Math.round(W * D), AH = Math.round(H * D);   // 720 × 405 art pixels, as the travel view

    const CX = 160, CY = 134, R = 112, MIN_R = 18;                      // the disc; marks never crowd its centre
    const PAD = { x: 334, y: 50, w: 128, h: 112 }, BIG = { x: 92, y: 58, w: 300, h: 160 };   // the chart, and opened up at the end
    const MARK_TOL = 1, ANGLE_TOL = 0.012, SNAP = 3, SNAP_FRAC = 0.02;  // only the exact answer is 14/14; letting go this near settles in
    const EASE = 12, RESCALE = 6, FRESH = 0.3, HOLD_DELAY = 0.35, HOLD_EVERY = 0.06, HOLD_FAST_AFTER = 1.1;
    const FLASH = 0.8, LINE_GAP = 2.6, TO_MAP = 2.2, READY_AFTER = 1.2, WIPE = 0.75, ZOOM = 0.9, TREND = 1.3, REACH = 1.8, END_ZOOM = 1.5;
    const T_LINE = 0.8, LINE_DUR = 1.5, T_FOUND = 2.3, T_PORT = 2.9, T_AURA = 3.6, BEND = 0.9, FADE = 0.7;   // the map's beats (s)
    const IR = 34, PORT = [434, 218], TEXT_X = 392, GLOW_MAP = 62, GLOW_END = 30, BREATH = 4;

    // Fourteen pulsars: angle (degrees), line length, notch as a fraction of the length (round two's numbers, × 1.5).
    const PULSARS = [
        [-176, 70, 0.62], [-151, 46, 0.55], [-129, 60, 0.72], [-104, 38, 0.60], [-83, 66, 0.45],
        [-58, 52, 0.70], [-36, 32, 0.66], [-11, 64, 0.50], [12, 42, 0.74], [35, 58, 0.58],
        [61, 36, 0.52], [92, 68, 0.64], [124, 48, 0.68], [153, 56, 0.48],
    ].map(([deg, len, f]) => { const l = Math.round(len * 1.5); return { a: (deg * Math.PI) / 180, len: l, notch: Math.round(Math.max(MIN_R + 6, l * f)) }; });
    // Per year each mark slides outward (px): every pulsar slows, so they all go the same way. Per light-year each line swings (rad).
    const RATES = [0.07, 0.1, 0.14, 0.18, 0.24, 0.3, 0.38, 0.46, 0.55, 0.65, 0.78, 0.92, 1.1, 1.3].map(r => r * 1.5);
    const SWINGS = [0.0016, 0.0022, 0.003, 0.0038, 0.0046, 0.0055, 0.0064, 0.0074, 0.0085, 0.0096, 0.011, 0.0122, 0.0136, 0.015];

    // The chart's ranges: the smallest that holds every point. Each keeps years : light-years at 5 : 2, so the trend keeps its angle.
    const RANGES = [[50, 20], [100, 40], [200, 80], [300, 120], [500, 200], [750, 300]].map(([y, l]) => ({ y, l }));
    const FIT = 0.95;                                    // a point never sits right on the chart's edge
    const rangeFor = points => RANGES.find(r => points.every(p => p.age <= r.y * FIT && p.ly <= r.l * FIT)) || RANGES[RANGES.length - 1];
    const NUDGES = [[-1, 0, 'Fewer years'], [1, 0, 'More years'], [0, -1, 'Nearer'], [0, 1, 'Farther']];
    const STEPS = { ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0], ArrowDown: [0, -1], s: [0, -1], ArrowUp: [0, 1], w: [0, 1] };

    // ── what the crew says (docs/STYLE.md). A depth's reactions play only the first time the crew dates a wreck that deep ──
    const STAR_FIX = ['A.U.R.A.', w => `EXODUS-${w.num}'s last star fix, Commander. It can tell us when the ship died.`];
    const FIRST_FIX = [['Mira', () => "Move the point on the chart until the wreck's lines and marks fit the disc."],   // the first alive says it
        ['A.U.R.A.', () => "Commander, move the point on the chart until the wreck's lines and marks fit the disc."]];
    const AGE_ONLY = ['A.U.R.A.', w => `${spoken(w.age)} years, Commander.`];
    const DEPTHS = [
        {   upTo: 8,                                     // EXODUS-1 … 8
            intro: [],
            locked: [['Aris', w => `${spoken(w.age)} years. We were still asleep when they died.`]] },
        {   upTo: 999,                                   // hulls in the hundreds
            intro: [['Vance', w => `Hull ${w.num}. Only eight ships launched before us.`]],
            locked: [['Mira', w => `${spoken(w.age)} years. That can't be right. A higher number should be newer.`]] },
        {   upTo: Infinity,                              // thousands and more
            intro: [['Jaxon', w => `Hull ${w.num}. How many ships did they send?`]],
            locked: [['Vance', w => `${spoken(w.age)} years ago there was no Exodus programme.`],
                ['A.U.R.A.', w => `${spoken(w.age)} years, Commander. The reading is correct.`]] },
    ];
    const END = [['Vance', "Every one of them was going where we're going."], ['A.U.R.A.', 'Our heading has not changed, Commander.']];

    // What a fix can point at, where the sketch put it on the map, and how A.U.R.A. names it.
    const PLACES = {
        beacon: { x: 300, y: 54, r: 6, giant: [282, 71, 15], readout: 'BEARING 012',          // a moon with one lamp lit, by a gas giant
            aura: name => `${name}, Commander. A moon, bearing zero one two.` },
        graves: { x: 364, y: 68, r: 10, readout: 'BEARING 004',                                // a grey world; the porthole shows its graves
            aura: name => `${name}, Commander. Bearing zero zero four. There are graves.` },
        light: { x: 452, y: 72, r: 18, readout: 'BEARING 000 · NO RANGE', final: true,        // the light at the end of the heading
            aura: () => 'Bearing zero. I cannot give you a distance.' },
    };

    // The sector maps, like the game's main map: the heading runs lower left to upper right as a band of dead transponders that
    // thickens with depth. The bottom right stays clear for the panel. Planet names follow src/generators/PlanetGenerator.js.
    const SECTOR_MAPS = [
        { seed: 104, pips: 8, hulls: 0, planets: [['HELIOS-12 MINOR', 150, 96, 11, 'rock'], ['KRYOS-7 IV', 236, 226, 5, 'grey'], ['ZEPHYR-40 X', 58, 74, 8, 'gas']] },
        { seed: 212, pips: 24, hulls: 2, planets: [['EREBUS-21 PRIME', 140, 80, 9, 'grey'], ['AEA-29', 60, 120, 7, 'gas'], ['NYX-14 IV', 220, 230, 6, 'rock']] },
        { seed: 980, pips: 50, hulls: 4, planets: [['ATLAS-3 PRIME', 128, 74, 9, 'grey'], ['NYX-52 IV', 54, 130, 6, 'rock'], ['HYPERION-9 X', 196, 224, 12, 'gas']] },
        { seed: 1400, pips: 110, hulls: 6, planets: [['TARTARUS-8', 150, 70, 10, 'rock'], ['PHOEBE-33 IV', 60, 110, 7, 'grey']] },
        { seed: 9000, pips: 170, hulls: 8, planets: [['KRYOS-90 MINOR', 120, 62, 8, 'gas'], ['ATLAS-71 X', 230, 228, 9, 'grey']] },
        { seed: 3021, pips: 240, hulls: 9, planets: [['CHRONOS-6 MINOR', 150, 66, 8, 'grey'], ['TITAN-81 X', 262, 230, 10, 'rock']] },
    ];
    const START = [0, 224], HEADING_END = [480, 46], US_AT = 0.1, WRECK_AT = 0.19, BAND = 70;


    // ── reading opts (the game's side of the contract) ──
    const hullName = hull => Math.round(hull).toLocaleString('en-US');      // 30211 → "30,211"
    function readWreck(wreck) {
        if (!wreck) throw new Error('DiscDating needs opts.wreck = { hull, sector }');
        const hull = Math.round(wreck.hull), sector = Math.round(wreck.sector);
        return { hull, sector, num: hullName(hull), age: ageOf(hull), ly: lyOf(hull, sector) };
    }
    function readPlotted(list) {
        if (list == null) return [];
        const isAtLeast = (v, min) => Number.isFinite(v) && v >= min, isPoint = p => p && isAtLeast(p.hull, 1) && isAtLeast(p.age, 0) && isAtLeast(p.ly, 0);
        if (!Array.isArray(list) || !list.every(isPoint)) throw new Error('DiscDating: opts.plotted must be a list of { hull, age, ly }');
        return list.map(p => ({ hull: p.hull, num: hullName(p.hull), age: p.age, ly: p.ly }));
    }
    function readReward(reward) {
        if (reward == null) return null;
        const line = reward.line, kinds = Object.keys(PLACES);
        const isValid = typeof reward.name === 'string' && reward.name && kinds.includes(reward.kind)
            && line && typeof line.who === 'string' && typeof line.text === 'string';
        if (!isValid) throw new Error(`DiscDating: opts.reward must be null or { name, kind: ${kinds.join(' | ')}, line: { who, text } }`);
        return { name: reward.name, kind: reward.kind, line: [line.who, line.text] };
    }
    const ROLES = { Jaxon: 'ENGINEER', Aris: 'MEDIC', Vance: 'SECURITY', Mira: 'SPECIALIST' };   // the game's crew tags
    /** Whether `who` may speak: A.U.R.A. always; crew only if alive in the game's list (everyone, when the game sent none). */
    function readCrew(crew) {
        if (!Array.isArray(crew)) return () => true;
        const living = new Set(crew.filter(c => c && c.status !== 'DEAD').flatMap(c => c.tags || []));
        return who => !ROLES[who] || living.has(ROLES[who]);
    }

    // ── the crew's lines for this wreck ──
    const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
        'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
    const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
    /** A number as a person says it: 21 → "twenty-one", 104 → "a hundred and four". */
    function inWords(n) {
        if (n < 20) return ONES[n];
        if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');
        if (n >= 1000) return hullName(n);
        const hundreds = Math.floor(n / 100) === 1 ? 'a hundred' : ONES[Math.floor(n / 100)] + ' hundred';
        return hundreds + (n % 100 ? ' and ' + inWords(n % 100) : '');
    }
    /** The same, starting a sentence. */
    const spoken = n => { const words = inWords(Math.round(n)); return words[0].toUpperCase() + words.slice(1); };
    /** The lines for this wreck, said only by the living. With nobody left to react, A.U.R.A. gives the age. */
    function talkFor(w, plotted, canSpeak) {
        const depthOf = hull => DEPTHS.findIndex(D => hull <= D.upTo), depth = DEPTHS[depthOf(w.hull)];
        const isNewDepth = !plotted.some(p => depthOf(p.hull) === depthOf(w.hull));
        const lines = list => list.filter(([who]) => canSpeak(who)).map(([who, say]) => [who, say(w)]);
        const howTo = plotted.length ? [] : lines(FIRST_FIX).slice(0, 1), reactions = isNewDepth ? lines(depth.locked) : [];
        return {
            intro: lines([STAR_FIX]).concat(howTo, isNewDepth ? lines(depth.intro) : []),
            locked: reactions.length ? reactions : lines([AGE_ONLY]),
        };
    }

    // ── small helpers. Everything below draws in ART pixels (AW × AH): the rules above stay in picture units ──
    const smooth = t => t * t * (3 - 2 * t), two = n => String(n).padStart(2, '0');
    const A = v => v * D;                                                   // picture units → art pixels
    const makeCanvas = (w = AW, h = AH) => Object.assign(document.createElement('canvas'), { width: w, height: h });
    const on = (x, y, tone) => tone >= 1 || tone > MiniLab.bayer8(x & 7, y & 7);
    /** One art pixel (or a w × h block) at art (x, y). */
    const fill = (g, x, y, color, w = 1, h = 1) => { g.fillStyle = color; g.fillRect(Math.round(x), Math.round(y), w, h); };
    /** Every pixel of a straight line between two art points (Bresenham): the disc's grooves and the fix's lines use the
        same one, so a line in place lies exactly on its groove. */
    function raster(x0, y0, x1, y1, cb) {
        let x = Math.round(x0), y = Math.round(y0);
        const bx = Math.round(x1), by = Math.round(y1), dx = Math.abs(bx - x), dy = -Math.abs(by - y), sx = x < bx ? 1 : -1, sy = y < by ? 1 : -1;
        let err = dx + dy;
        for (let guard = 0; guard < 4000; guard++) {
            cb(x, y);
            if (x === bx && y === by) return;
            const e2 = 2 * err;
            if (e2 >= dy) { err += dy; x += sx; }
            if (e2 <= dx) { err += dx; y += sy; }
        }
    }
    const aline = (g, x0, y0, x1, y1, color, tone = 1) => { g.fillStyle = color; raster(x0, y0, x1, y1, (x, y) => { if (on(x, y, tone)) g.fillRect(x, y, 1, 1); }); };
    function aring(g, cx, cy, r, color, tone = 1) {
        g.fillStyle = color;
        const steps = Math.max(16, Math.ceil(r * 7));
        for (let i = 0; i < steps; i++) {
            const a = (i / steps) * Math.PI * 2, x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r);
            if (on(x, y, tone)) g.fillRect(x, y, 1, 1);
        }
    }
    /** A dithered disc; `tone` is a number or a function of the distance 0..1 from the centre. */
    function adisc(g, cx, cy, r, tone, color) {
        const toneAt = typeof tone === 'function' ? tone : () => tone;
        g.fillStyle = color;
        for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
            const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r;
            if (d <= 1 && on(x, y, toneAt(d))) g.fillRect(x, y, 1, 1);
        }
    }
    function segDist(x, y, x0, y0, x1, y1) {
        const vx = x1 - x0, vy = y1 - y0, l2 = vx * vx + vy * vy, t = l2 ? clamp(((x - x0) * vx + (y - y0) * vy) / l2, 0, 1) : 0;
        return Math.hypot(x - (x0 + vx * t), y - (y0 + vy * t));
    }
    const ACX = A(CX), ACY = A(CY), AR = A(R);                               // the disc, in art pixels
    const LIGHT = [Math.SQRT1_2, -Math.SQRT1_2];                             // every body is lit from up and to the right: the end of the heading
    const HEAD_ANGLE = Math.atan2(HEADING_END[1] - START[1], HEADING_END[0] - START[0]);
    /** A short bar across a disc line at angle `a`, `pos` units from the centre, running `from`..`to` units across it. */
    function bar(g, a, pos, from, to, color) {
        const dx = Math.cos(a), dy = Math.sin(a), x0 = ACX + dx * A(pos), y0 = ACY + dy * A(pos);
        g.fillStyle = color;
        for (let o = Math.round(A(from)); o <= Math.round(A(to)); o++) g.fillRect(Math.round(x0 - dy * o), Math.round(y0 + dx * o), 1, 1);
    }

    // ── the travel view's recipes (MiniPaint, the minigames' copy of the travel view's Paint.js; NSPaint is the same) ──
    function recipes() {
        const P = window.MiniPaint || window.NSPaint;
        if (!P) throw new Error('DiscDating needs MiniPaint (src/systems/minigames/art/MiniPaint.js, loaded by MiniLab.js)');
        const { ramp, INK, RP } = P;
        return {
            P, RP, INK, ink: P.hexRgb(INK),
            // the disc: old gold, darker than a coin, the light running across it as on a record
            GOLD: ramp(INK, '#1a1209', '#33240f', '#563c17', '#7e5a22', '#a97b33', '#d3a24e', '#f0cd84', '#fff0c8'),
            // the sector map's worlds, as the travel view paints them
            WORLD: { rock: [RP.STONE, 'rock', RP.ICE], grey: [RP.MOON, 'rock', RP.ICE], gas: [RP.GAS, 'gas', RP.DUST] },
        };
    }

    // ── the sky: the travel view's deep field (teal haze, rust-gold dust where the far light reaches, its stars) ──
    /** Paints space into the opaque painter p. o: { seed, dust, haze, stars, light: [x, y] art, keep(x, y) → no star }. */
    function paintSky(K, p, o) {
        const strip = K.P.spaceStrip(p.W, p.H, o.seed, o.dust, o.haze, o.stars), lit = new Float32Array(p.W * p.H), [lx, ly] = o.light;
        for (let y = 0; y < p.H; y++) for (let x = 0; x < p.W; x++) lit[y * p.W + x] = 0.25 + 0.9 * Math.exp(-Math.hypot(x - lx, (y - ly) * 1.2) / (p.W * 0.42));
        K.P.paintSpace(p, strip, 0, lit, o.keep);
    }
    /** The chart's ground: space fades to ink around it (no stars posing as data), dithered at the edge. b in units. */
    function clearChart(K, p, b) {
        const x0 = A(b.x - 26), y0 = A(b.y - 18), x1 = A(b.x + b.w + 10), y1 = A(b.y + b.h + 16), F = 16;
        p.region(x0 - F, y0 - F, x1 + F, y1 + F, (x, y) => {
            const e = Math.min(x - x0, x1 - x, y - y0, y1 - y), k = e >= 0 ? 1 : 1 + e / F;
            if (k > K.P.threshold(x, y)) p.set(x, y, K.ink);
        });
    }

    // ── the disc: old gold, engraved, painted once ──
    // The two figures, as capsules [x0, y0, x1, y1, radius] standing on (0, 0) (units). He raises a hand; she stands beside him.
    const MAN = [[0, -30.5, 0, -30.5, 3.3], [0, -27, 0, -25, 1.3], [-4.6, -23, 4.6, -23, 1.7], [-1.9, -22, -1.6, -14, 2.6],
        [1.9, -22, 1.6, -14, 2.6], [-5, -23, -8, -27.5, 1.1], [-8, -27.5, -8.4, -33.5, 1], [5, -23, 6, -15, 1.1], [6, -15, 6.3, -11.5, 0.9],
        [-1.9, -14, -2.4, -1, 1.5], [1.9, -14, 2.4, -1, 1.5], [-2.4, -0.6, -4.6, -0.6, 0.8], [2.4, -0.6, 4.6, -0.6, 0.8]];
    const WOMAN = [[0, -28.5, 0, -28.5, 3.1], [-2.6, -29, -3.2, -24.5, 1], [2.6, -29, 3.2, -24.5, 1], [0, -25, 0, -23.5, 1.1],
        [-3.8, -22, 3.8, -22, 1.4], [-1.6, -21, -1.6, -14, 2.3], [1.6, -21, 1.6, -14, 2.3], [-2.1, -12.5, 2.1, -12.5, 2.6],
        [-4.1, -22, -5, -14, 1], [-5, -14, -5.2, -11, 0.9], [4.1, -22, 5, -14, 1], [5, -14, 5.2, -11, 0.9],
        [-1.6, -12, -1.7, -1, 1.4], [1.6, -12, 1.5, -1, 1.4], [-1.7, -0.6, -3.1, -0.6, 0.7], [1.5, -0.6, 2.9, -0.6, 0.7]];
    const FIGURES = [[MAN, CX + 20, CY + 93], [WOMAN, CX + 37, CY + 91]];   // in the gap between the 61° and 92° lines
    const GROOVE = 0.1, WALL = 0.62;                                          // a cut's dark floor, and its lit far wall

    /** The face: a record's fine grooves, tarnish, the light running across it in two wedges, a bevelled rim. */
    function paintFace(K, p, boost) {
        const G = K.GOLD, { fbm } = K.P, sheenAt = Math.atan2(LIGHT[1], LIGHT[0]);
        p.region(ACX - AR - 1, ACY - AR - 1, ACX + AR + 1, ACY + AR + 1, (x, y) => {
            const dx = x + 0.5 - ACX, dy = y + 0.5 - ACY, r = Math.hypot(dx, dy);
            if (r > AR) return;
            let v = 0.28 + boost + 0.34 * Math.pow(Math.abs(Math.cos(Math.atan2(dy, dx) - sheenAt)), 9) * (0.25 + 0.75 * r / AR);
            v += (fbm(x / 22, y / 22, 77, 3) - 0.5) * 0.14;                                   // tarnish
            if (Math.floor(r) % 2 === 0) v -= 0.04;                                           // the fine grooves
            const facing = (dx * LIGHT[0] + dy * LIGHT[1]) / (r || 1);
            if (r > AR - 3) v = 0.48 + boost + 0.44 * Math.max(0, facing) - 0.26 * Math.max(0, -facing);   // the rim, bevelled to the light
            else if ((r > AR - 17 && r < AR - 14) || (r > 21 && r < 25)) v -= 0.15;             // the edge band and the hub
            else if ((r >= AR - 14 && r < AR - 13) || (r >= 25 && r < 26)) v += 0.08;           // their lit lips
            p.solid(x, y, G, v);
        });
    }
    /** The fourteen pulsar lines, cut into the face, each with its notch. */
    function paintGrooves(K, p, boost) {
        const G = K.GOLD;
        PULSARS.forEach(q => {
            const ex = ACX + Math.cos(q.a) * A(q.len), ey = ACY + Math.sin(q.a) * A(q.len);
            let nx = -Math.sin(q.a), ny = Math.cos(q.a);
            if (nx * LIGHT[0] + ny * LIGHT[1] > 0) { nx = -nx; ny = -ny; }                    // the far wall catches the light
            const wx = Math.round(nx), wy = Math.round(ny);
            raster(ACX + wx, ACY + wy, ex + wx, ey + wy, (x, y) => p.solid(x, y, G, WALL + boost));
            raster(ACX, ACY, ex, ey, (x, y) => p.solid(x, y, G, GROOVE + boost));
            const dx = Math.cos(q.a), dy = Math.sin(q.a);
            [[0, GROOVE], [1, WALL]].forEach(([k, v]) => [[-6, -3], [3, 6]].forEach(([o0, o1]) => {    // the notch
                for (let o = o0; o <= o1; o++) p.solid(Math.round(ACX + dx * (A(q.notch) + k) - dy * o), Math.round(ACY + dy * (A(q.notch) + k) + dx * o), G, v + boost);
            }));
        });
    }
    /** The man and the woman, and the year, engraved: a dark floor, a shadowed near edge, a lit far wall. */
    function paintFigures(K, p, boost) {
        const G = K.GOLD;
        FIGURES.forEach(([parts, fx, fy]) => {
            const inside = (x, y) => parts.some(([x0, y0, x1, y1, r]) => segDist((x + 0.5) / D - fx, (y + 0.5) / D - fy, x0, y0, x1, y1) <= r);
            p.region(A(fx - 11), A(fy - 37), A(fx + 10), A(fy + 2), (x, y) => {
                if (!inside(x, y)) return;
                const litWall = !inside(x - 1, y) || !inside(x, y + 1), nearWall = !inside(x + 1, y) || !inside(x, y - 1);
                p.solid(x, y, G, (litWall ? WALL : nearWall ? GROOVE : 0.2) + boost);
            });
        });
        const cut = new Set(), tx = Math.round(A(CX - 50)), ty = Math.round(A(CY - 90));   // the year, cut in two-pixel strokes
        K.P.pixelText('1977', 0, 0, (gx, gy) => [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([a, b]) => cut.add((tx + gx * 2 + a) + ',' + (ty + gy * 2 + b))));
        cut.forEach(k => {
            const [x, y] = k.split(',').map(Number);
            p.solid(x, y, G, (cut.has((x - 1) + ',' + y) && cut.has(x + ',' + (y + 1)) ? 0.2 : GROOVE) + boost);
            if (!cut.has((x - 1) + ',' + y)) p.solid(x - 1, y, G, WALL + boost);   // the lit wall on the far side
        });
    }
    /** The disc. `boost` brightens the whole face: the lock's flash is the same disc, catching the light. */
    function paintDisc(K, p, boost = 0) {
        if (!boost) p.region(ACX - AR - 14, ACY - AR - 14, ACX + AR + 14, ACY + AR + 14, (x, y) => {   // a faint warm breath of light around the rim
            const d = Math.hypot(x + 0.5 - ACX, y + 0.5 - ACY) - AR;
            if (d > 0 && d < 14) p.add(x, y, K.RP.AMBER, 0.2 * Math.pow(1 - d / 14, 2) * (0.6 + 0.4 * Math.max(0, ((x - ACX) * LIGHT[0] + (y - ACY) * LIGHT[1]) / (AR + d))));
        });
        paintFace(K, p, boost);
        paintGrooves(K, p, boost);
        paintFigures(K, p, boost);
        p.ellipse(ACX, ACY, 3.5, 3.5, (x, y) => p.solid(x, y, K.GOLD, 0.08));               // the spindle hole
        p.set(Math.round(ACX), Math.round(ACY), K.GOLD.rgb[8]);
    }

    /** The light at the end, as the travel view paints its false sun: baked per size step and breath. `radius` in units. */
    function makeGlows(K) {
        const cache = new Map();
        return (radius, k, breath) => {
            const step = Math.max(1, Math.round(clamp(k, 0, 1) * 12)), key = radius + ':' + step + ':' + breath;
            if (!cache.has(key)) {
                const r = A(radius) * step / 12, o = { core: Math.max(1.2, r * 0.12), halo: r * 0.5, strength: 1, spikes: Math.max(2, r * 0.16) };
                const reach = Math.ceil(o.halo * 3.2 + o.core + 8), p = K.P.painter(reach * 2 + 2, reach * 2 + 2, false);
                K.P.lightGlow(p, reach + 1, reach + 1, o, 0.9 + 0.1 * Math.sin((breath / 4) * Math.PI * 2));
                cache.set(key, { canvas: p.canvas(), half: reach + 1 });
            }
            return cache.get(key);
        };
    }

    // ── the close-up portholes ──
    const BEACON = [47, 31];                                // the lamp on the beacon's moon, in the porthole's own units
    const PORT_L = [0.62, -0.5, 0.6];                       // the porthole's light: up and to the right, a little from the front
    function paintBeaconMoon(K, p) {                        // a gas giant low in the sky, the moon's cratered limb, a mast with a lamp
        const { P, RP } = K, L = P.norm3(...PORT_L);
        P.sphere(p, { cx: A(12), cy: A(10), r: A(24), ramp: RP.GAS, L, surface: P.surfaceFor('gas', 7, L), ambient: 0.012, gain: 0.9, rim: 0.2 });
        P.sphere(p, { cx: A(44), cy: A(106), r: A(70), ramp: RP.MOON, L, surface: P.surfaceFor('rock', 31, L), ambient: 0.02, gain: 0.78, rim: 0.12, rimRamp: RP.MOON });
        const bx = Math.round(A(BEACON[0])), by = Math.round(A(BEACON[1]));
        for (let k = 1; k <= 6; k++) p.solid(bx, by + k, RP.HULL, k < 2 ? 0.75 : 0.6);       // the mast
        [[-1, 6], [1, 6], [-2, 7], [2, 7]].forEach(([dx, dy]) => p.solid(bx + dx, by + dy, RP.HULL, 0.45));
    }
    function paintGraves(K, p, n) {                         // a grey plain, and rows of stones out to the horizon
        const { P, RP } = K, horizon = x => A(29 + Math.pow(x / D - IR, 2) / 300), L = P.norm3(...PORT_L);
        P.sphere(p, { cx: A(15), cy: A(11), r: A(7), ramp: RP.PASSED, L, surface: P.surfaceFor('rock', 5, L), ambient: 0.01 });
        p.region(0, 0, n, n, (x, y) => {
            const h = horizon(x);
            if (y < h) return;
            p.solid(x, y, RP.GROUND, y - h < 1 ? 0.44 : 0.14 + 0.36 * Math.min(1, (y - h) / A(36)) + (P.fbm(x / 9, y / 4, 13, 3) - 0.5) * 0.18);
        });
        const rnd = MiniLab.rng(17);
        for (let k = 0; k < 9; k++) {                       // nearer rows are bigger, and the nearest stones have arms
            const y = Math.round(A(31 + k * 2.2 + k * k * 0.5)), wide = Math.max(1, Math.round(1 + k * 0.45)), gap = A(3 + k * 1.2), near = k / 8;
            for (let x = (k % 2) * gap / 2 + rnd() * 3; x < n && y <= n - 2; x += gap) {
                const sx = Math.round(x + (rnd() - 0.5) * k * 0.6), tall = Math.round(1.5 + k * 1.05 + (k > 3 ? rnd() * 2 : 0)), top = y - tall;
                if (rnd() < 0.1) continue;                  // a gap in the row
                for (let q = 1; q <= wide + 1 + Math.floor(k / 3); q++) p.solid(sx - q, y, RP.GROUND, 0.05);   // its shadow, away from the light
                p.region(sx, top, sx + wide, y, (a, b) => p.solid(a, b, RP.STONE, (a === sx && wide > 1 ? 0.36 : 0.56) + 0.14 * near));
                if (k > 5) { const arm = Math.max(1, Math.round(wide * 0.6)), ay = top + Math.round(tall * 0.28); p.region(sx - arm, ay, sx + wide + arm, ay + Math.max(1, Math.round(wide / 2)), (a, b) => p.solid(a, b, RP.STONE, 0.6 + 0.14 * near)); }
                p.region(sx, top, sx + wide, top + 1, (a, b) => p.solid(a, b, RP.STONE, 0.9));   // the lit top
            }
        }
    }
    function buildInset(K, kind) {
        const n = Math.round(A(IR * 2)) + 1, c = (n - 1) / 2, p = K.P.painter(n, n, true);
        K.P.scatterStars(p, kind === 'beacon' ? 29 : 17, 70, (x, y) => y < n * 0.45);
        if (kind === 'beacon') paintBeaconMoon(K, p);
        else paintGraves(K, p, n);
        p.region(0, 0, n, n, (x, y) => { if (Math.hypot(x - c, y - c) > c + 0.3) p.clear(x, y); });
        return p.canvas();
    }

    // ── the sector map ──
    /** The map of the wreck's sector with the reward's place on it. A 'light' map ends the heading at the light itself. */
    function mapFor(sector, kind) {
        const place = PLACES[kind], final = !!place.final;
        return { ...SECTOR_MAPS[sector - 1], dest: { kind, ...place }, final, end: final ? [place.x, place.y] : HEADING_END, hint: final ? 0 : sector >= 3 ? 2 : 1 };
    }
    /** The sketch's planets wear the real map's names, so the chart matches the sector map. With no names sent, the sketch's own. */
    function withNames(M, names) {
        if (!Array.isArray(names) || !names.length) return M;
        return { ...M, planets: M.planets.slice(0, names.length).map((p, k) => [String(names[k]).toUpperCase(), ...p.slice(1)]) };
    }
    /** A point on the heading: `along` 0..1 from the lower left, `off` units to one side. On a 'light' map the band narrows into it. */
    function headingPoint(M, along, off = 0) {
        const ex = M.end[0] - START[0], ey = M.end[1] - START[1], len = Math.hypot(ex, ey), keep = M.final ? 0.4 + 0.6 * Math.pow(1 - along, 0.8) : 1;
        return { x: START[0] + ex * along - (ey / len) * off * keep, y: START[1] + ey * along + (ex / len) * off * keep };
    }
    /** A world on the map, lit from the end of the heading as in the travel view. dim < 1 brings it in from the dark. */
    function paintWorld(K, p, M, x, y, r, kind, seed, dim = 1, rims) {
        const [ramp, surface, atmo] = K.WORLD[kind] || K.WORLD.rock, cx = A(x), cy = A(y);
        const L = K.P.lightVector(cx, cy, A(M.end[0]), A(M.end[1]), AW * 0.35);
        K.P.sphere(p, { cx, cy, r: A(r), ramp, L, surface: K.P.surfaceFor(surface, seed, L), dim, rim: 0.22, ambient: 0.014, gain: 0.86, atmo: { ramp: atmo, w: Math.max(1.5, A(r) / 9) }, rims });
    }
    /** A small hull lying in the band: our own Lander's shape, dead. */
    function paintHull(K, p, x, y, len, angle, o = {}) {
        const ht = len / 3.15;
        return K.P.hull(p, { x, y, len, ht, angle, flip: true, anchor: 0.5, seed: o.seed || 3, ramp: o.ramp || K.RP.HULL, light: o.light == null ? 0.55 : o.light,
            rust: o.rust, holes: o.holes, from: o.from, to: o.to, flat: len < 24 }, K.P.shapeL);
    }
    function buildMap(K, M, w) {
        const p = K.P.painter(AW, AH, true), rnd = MiniLab.rng(M.seed), blinkers = [];
        paintSky(K, p, { seed: M.seed % 9973, dust: 0.11, haze: 0.9, stars: 1.1, light: [A(M.end[0]), A(M.end[1])] });
        if (M.hint > 1) K.P.lightGlow(p, A(474), A(48), { core: 1.2, halo: 4.5, strength: 0.75, spikes: 4 });   // far off, at the end of the heading, something warm
        else if (M.hint) p.set(Math.round(A(474)), Math.round(A(48)), K.RP.SUN.rgb[4]);
        M.planets.forEach(([, x, y, r, kind], k) => paintWorld(K, p, M, x, y, r, kind, M.seed + k * 7));
        for (let i = 0; i < M.pips; i++) {                  // dead transponders, still in the band; a few still blink
            const along = M.final ? Math.pow(rnd(), 0.6) : rnd(), q = headingPoint(M, along, (rnd() - 0.5) * rnd() * BAND), x = Math.round(A(q.x)), y = Math.round(A(q.y));
            const mid = rnd() < 0.3, big = rnd() < 0.3, blink = rnd() < 0.08, period = 5 + rnd() * 7, phase = rnd() * 12;
            if (M.final && Math.hypot(q.x - M.end[0], q.y - M.end[1]) < GLOW_MAP * 0.55) continue;
            if (blink) blinkers.push({ x, y, period, phase });
            else { const c = K.RP.HULL.rgb[mid ? 3 : 2]; p.set(x, y, c); if (big) p.set(x + 1, y, c); }
        }
        for (let i = 0; i < M.hulls; i++) {                 // the handful of hulls close enough to see
            const q = headingPoint(M, 0.3 + rnd() * 0.62, (rnd() - 0.5) * BAND * 0.7), len = A(4 + rnd() * 4);
            paintHull(K, p, A(q.x), A(q.y), len, HEAD_ANGLE + (rnd() - 0.5) * 1.6, { seed: 5 + i, rust: true, light: 0.45 + rnd() * 0.2 });
        }
        const wreck = headingPoint(M, WRECK_AT, -4), seed = (w.hull % 89) + 2;   // this wreck: broken in two, rust where the paint went
        const at = paintHull(K, p, A(wreck.x - 2), A(wreck.y), A(16), HEAD_ANGLE + 0.5, { seed, ramp: K.RP.WRUST, light: 1, rust: true, holes: 0.66, to: 0.6 });
        paintHull(K, p, A(wreck.x + 9), A(wreck.y + 4), A(16), HEAD_ANGLE + 1.0, { seed: seed + 1, ramp: K.RP.WRUST, light: 0.85, rust: true, from: 0.68 });
        return { canvas: p.canvas(), blinkers, us: headingPoint(M, US_AT), wreck, beacon: at(0.3, -0.45) };
    }
    /** The place on the map, painted once per step of its arrival (it comes out of the dark): sprites with their lit rims. */
    function buildPlace(K, M) {
        const D0 = M.dest, bodies = D0.kind === 'beacon' ? [[D0.giant[0], D0.giant[1], D0.giant[2], 'gas'], [D0.x, D0.y, 4, 'grey']] : D0.kind === 'graves' ? [[D0.x, D0.y, D0.r, 'grey']] : [];
        if (!bodies.length) return null;
        const x0 = Math.floor(A(Math.min(...bodies.map(b => b[0] - b[2])) - 4)), y0 = Math.floor(A(Math.min(...bodies.map(b => b[1] - b[2])) - 4));
        const x1 = Math.ceil(A(Math.max(...bodies.map(b => b[0] + b[2])) + 4)), y1 = Math.ceil(A(Math.max(...bodies.map(b => b[1] + b[2])) + 4));
        const frames = [0.25, 0.5, 0.75, 1].map(dim => {
            const p = K.P.painter(x1 - x0, y1 - y0, false), rims = [];
            bodies.forEach(([x, y, r, kind], k) => paintWorld(K, p, { end: [M.end[0] - x0 / D, M.end[1] - y0 / D] }, x - x0 / D, y - y0 / D, r, kind, 61 + k, dim, k === bodies.length - 1 ? rims : null));
            return { canvas: p.canvas(), rims };
        });
        return { x: x0, y: y0, frames };
    }

    // ── sound: quiet, and only when the game's sound is on ──
    function tone(freq, o = {}) {
        const ac = MiniLab.audio.get(), out = MiniLab.audio.master;
        if (!ac || !out) return;
        const t0 = ac.currentTime + (o.at || 0), dur = o.dur || 0.4, osc = ac.createOscillator(), amp = ac.createGain(), lp = ac.createBiquadFilter();
        osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(freq, t0); lp.frequency.value = o.cut || 2400;
        if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + dur * 0.7);
        amp.gain.setValueAtTime(0.0001, t0); amp.gain.exponentialRampToValueAtTime(o.gain || 0.03, t0 + (o.attack || 0.01));
        amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(lp); lp.connect(amp); amp.connect(out); osc.start(t0); osc.stop(t0 + dur + 0.05);
    }
    function click() {                                      // a soft tick of filtered noise
        const ac = MiniLab.audio.get(), out = MiniLab.audio.master, buf = MiniLab.audio.noiseBuffer();
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

    function mount(ctx, ui, opts) {
        const wreck = readWreck(opts.wreck), plotted = readPlotted(opts.plotted), reward = readReward(opts.reward), canSpeak = readCrew(opts.crew);
        const range = rangeFor(plotted.concat(wreck)), endRange = { y: range.y * END_ZOOM, l: range.l * END_ZOOM };
        const talk = talkFor(wreck, plotted, canSpeak), M = reward && withNames(mapFor(wreck.sector, reward.kind), opts.names);
        const K = recipes(), RP = K.RP, cv = ui.canvas, art = fn => MiniLab.inArt(ctx, fn), glowOf = makeGlows(K);
        const smoothing = ctx.imageSmoothingEnabled;
        ctx.imageSmoothingEnabled = false;
        const SKY = { seed: 1977, dust: 0.1, haze: 0.85, stars: 1, light: [AW + 40, -30] };
        const bg = (() => {                                 // space, the chart's clear ground, the disc
            const p = K.P.painter(AW, AH, true);
            paintSky(K, p, { ...SKY, keep: (x, y) => Math.hypot(x - ACX, y - ACY) < AR + 2 });
            clearChart(K, p, PAD);
            paintDisc(K, p);
            return p.canvas();
        })();
        const bright = (() => { const p = K.P.painter(AW, AH, false); paintDisc(K, p, 0.42); return p.canvas(); })();   // the same disc catching the light
        let sky = null;                                     // the ending's sky: no dust, so the opened chart is not a hole in it
        const skyEnd = () => sky || (sky = (() => { const p = K.P.painter(AW, AH, true); paintSky(K, p, { ...SKY, dust: 0, haze: 0.5 }); clearChart(K, p, BIG); return p.canvas(); })());

        // the readouts: few, small, quiet words over the picture (MiniHost's ui.note), set fresh each frame
        const shownNotes = new Map();
        let wantNotes = new Map();
        const note = (id, text, o) => { wantNotes.set(id, [String(text), o]); };
        function flushNotes() {
            if (typeof ui.note !== 'function') { wantNotes = new Map(); return; }
            if (wipe) wantNotes = new Map();                // while the view re-plots, no words
            wantNotes.forEach(([text, o], id) => {
                const key = text + '|' + o.x + '|' + o.y + '|' + o.align + '|' + o.tone + '|' + o.size;
                if (shownNotes.get(id) !== key) { ui.note(id, text, o); shownNotes.set(id, key); }
            });
            [...shownNotes.keys()].filter(id => !wantNotes.has(id)).forEach(id => { ui.note(id, null); shownNotes.delete(id); });
            wantNotes = new Map();
        }

        const insets = {}, beaconLit = () => clock % 1.6 < 0.5;
        let map = null, place;
        const mapView = () => map || (map = buildMap(K, M, wreck));
        const placeView = () => (place === undefined ? (place = buildPlace(K, M)) : place);
        const insetOf = kind => insets[kind] || (insets[kind] = buildInset(K, kind));
        const breath = () => Math.floor(((clock % BREATH) / BREATH) * 4);
        let mode = 'date', s = null, m = null, wipe = null, held = null, canContinue = false, endT = 0, gen = 0, clock = 0, lastCount = 99, lastTick = 0, hover = false;
        let view = { ...rangeFor(plotted.length ? plotted : [wreck]) }, points = plotted, queue = [];   // view: the chart's range, zooming out to this wreck's
        const later = (sec, fn) => { const g = gen; queue = queue.concat({ at: clock + sec, fn: () => g === gen && fn() }); };
        const sayLater = (sec, [who, line]) => canSpeak(who) && later(sec, () => ui.say(who, line));   // the dead say nothing
        const busy = () => mode !== 'date' || !s || s.locked, fresh = () => clock - s.born < FRESH;
        /** A chart point in art pixels, in the chart box b (units). */
        const toChart = (b, yr, ly) => ({ x: Math.round(A(b.x + (yr / view.y) * b.w)), y: Math.round(A(b.y + b.h - (ly / view.l) * b.h)) });
        const onPad = q => q.x >= PAD.x - 6 && q.x <= PAD.x + PAD.w + 6 && q.y >= PAD.y - 6 && q.y <= PAD.y + PAD.h + 6;
        const nearPlace = q => Math.hypot(q.x - M.dest.x, q.y - M.dest.y) < M.dest.r + 14;
        const setReady = () => { m = { ...m, ready: true }; showButtons(); };
        const close = () => ui.finish({ dated: true, hull: wreck.hull, age: wreck.age, ly: wreck.ly });

        // ── the flow: date → (map → (chart)) → close ──
        function startDating() {
            const rnd = MiniLab.rng(wreck.hull), last = plotted[plotted.length - 1];
            const shuffle = list => { const out = list.slice(); for (let k = out.length - 1; k > 0; k--) { const j = Math.floor(rnd() * (k + 1)); [out[k], out[j]] = [out[j], out[k]]; } return out; };
            const isAnswer = last && Math.round(last.age) === wreck.age && Math.round(last.ly) === wreck.ly;
            const from = last && !isAnswer ? { y: Math.round(Math.min(last.age, range.y)), l: Math.round(Math.min(last.ly, range.l)) } : { y: 0, l: 0 };   // from the last fix, or from us
            s = { v: from, d: from, locked: false, moved: false, dragging: false, flash: 0, born: clock, rates: shuffle(RATES), swings: shuffle(SWINGS).map(k => (rnd() < 0.5 ? -k : k)) };
            talk.intro.forEach((line, j) => (j ? sayLater(LINE_GAP * j, line) : ui.say(line[0], line[1])));
            showButtons();
        }
        const startWipe = () => { const snap = makeCanvas(); snap.getContext('2d').drawImage(ctx.canvas, 0, 0); wipe = { snap, t: 0 }; };
        function lock() {
            const lastLine = 0.4 + (talk.locked.length - 1) * LINE_GAP;
            gen++; queue = []; held = null;                 // an intro line still waiting would now be out of place
            s = { ...s, locked: true, dragging: false, flash: FLASH, d: { ...s.v } };
            points = plotted.concat(wreck); SOUND.lock(); showButtons();
            talk.locked.forEach((line, j) => sayLater(0.4 + j * LINE_GAP, line));
            if (reward) later(lastLine + TO_MAP, openMap);
            else later(lastLine + READY_AFTER, () => { canContinue = true; showButtons(); });
        }
        function openMap() {
            mapView(); placeView(); startWipe();            // built before the snapshot: the sky takes a moment
            mode = 'map'; m = { t: 0, set: false, setAt: 0, canSet: false, ready: false };
            showButtons();
            later(T_FOUND, SOUND.found);
            later(T_AURA, () => {
                ui.say('A.U.R.A.', M.dest.aura(reward.name));
                if (!M.final) { m = { ...m, canSet: true }; showButtons(); }
            });
            if (M.final) { sayLater(T_AURA + LINE_GAP, reward.line); later(T_AURA + LINE_GAP + 1.2, setReady); }
        }
        function setCourse() {
            m = { ...m, set: true, setAt: m.t, canSet: false };
            SOUND.course(); showButtons();
            sayLater(BEND + 0.3, reward.line); later(BEND + 1.6, setReady);
        }
        function openEnd() {                                // back to the chart: the line through every wreck runs on to the light
            const t = ZOOM + TREND + REACH + 0.5;
            skyEnd(); startWipe(); mode = 'end'; endT = 0; canContinue = false;
            showButtons();
            later(ZOOM + TREND, SOUND.light); sayLater(t, END[0]);
            later(t + LINE_GAP, () => { ui.say(END[1][0], END[1][1]); canContinue = true; showButtons(); });
        }
        function advance() {
            if (wipe) return;                               // let the view finish moving
            if (mode !== 'map') { if (canContinue) close(); return; }
            if (m.canSet) setCourse();
            else if (m.ready && M.final) openEnd();
            else if (m.ready) close();
        }

        function setPad(y, l) {
            if (busy()) return;
            s = { ...s, moved: true, v: { y: clamp(Math.round(y), 0, range.y), l: clamp(Math.round(l), 0, range.l) } };
        }
        const nudge = (dy, dl) => setPad(s.v.y + dy, s.v.l + dl);
        const padAt = q => setPad(((q.x - PAD.x) / PAD.w) * view.y, ((PAD.y + PAD.h - q.y) / PAD.h) * view.l);
        function release() {
            if (!s || !s.dragging) return;
            const near = (v, want, span) => Math.abs(v - want) <= Math.max(SNAP, span * SNAP_FRAC);
            const isNear = !s.locked && near(s.v.y, wreck.age, range.y) && near(s.v.l, wreck.ly, range.l);
            s = { ...s, dragging: false, v: isNear ? { y: wreck.age, l: wreck.ly } : s.v };
        }
        function showButtons() {
            const go = label => [{ label, primary: true, onClick: advance }];
            if (mode === 'map') return ui.buttons(m.canSet ? go('Set course') : m.ready ? go(M.final ? 'Back to the chart' : 'Continue') : []);
            if (mode === 'end' || s.locked) return ui.buttons(canContinue ? go('Continue') : []);
            ui.buttons(NUDGES.map(([dy, dl, label]) => ({
                label, hold: true, onUp: () => { held = null; },
                onDown: () => { if (busy() || fresh()) return; nudge(dy, dl); held = { dy, dl, wait: HOLD_DELAY, age: 0 }; },
            })).concat({ label: 'Not now', quiet: true, onClick: () => ui.finish({ dated: false }) }));
        }

        // ── drawing: the disc and the chart (g: the canvas in art pixels) ──
        function drawFix(g) {                               // the wreck's fourteen lines and marks over the disc; counts those in place
            const white = s.flash > FLASH * 0.55, base = g.globalAlpha, a0 = s.flash / FLASH;
            let lines = 0, marks = 0;
            g.drawImage(bg, 0, 0);
            if (s.flash > 0) { g.globalAlpha = base * Math.pow(a0, 2.2); g.drawImage(bright, 0, 0); g.globalAlpha = base; }   // the gold catches the light
            PULSARS.forEach((q, j) => {
                const off = s.swings[j] * (s.d.l - wreck.ly), a = q.a + off, want = q.notch + s.rates[j] * (s.d.y - wreck.age), at = clamp(want, MIN_R, q.len);
                const lineOn = Math.abs(off) < ANGLE_TOL, markOn = Math.abs(want - q.notch) < MARK_TOL, far = want !== at, reach = markOn ? 4 : far ? 1 : 2;
                lines += lineOn ? 1 : 0; marks += markOn ? 1 : 0;
                aline(g, ACX, ACY, ACX + Math.cos(lineOn ? q.a : a) * A(q.len), ACY + Math.sin(lineOn ? q.a : a) * A(q.len), white ? C.star : lineOn ? C.uiBright : C.ui, lineOn ? 1 : 0.55);
                bar(g, a, at, -reach, reach, far ? RP.HULL.hex[3] : markOn && !white ? C.uiBright : C.star);   // the mark; dim while the years are far out
                if (markOn) bar(g, a, at + 1 / D, -reach, reach, white ? C.star : C.ui);
            });
            fill(g, ACX, ACY, C.star);
            if (s.flash > 0) {                              // a ring runs out from the centre
                aring(g, ACX, ACY, A((1 - a0) * (R + 26) + 4), C.uiBright, Math.min(1, a0 * 1.6));
                aring(g, ACX, ACY, Math.max(1, A((1 - a0) * (R + 26) - 6)), C.ui, a0 * 0.8);
            }
            return { lines, marks };
        }
        function drawTrend(g, b, o, opts) {                 // the ending's line: from us through this wreck, then on to the light at the edge
            if (opts.reach > 0) {
                const k = Math.min(view.y / wreck.age, view.l / wreck.ly), from = toChart(b, wreck.age, wreck.ly), edge = toChart(b, wreck.age * k, wreck.ly * k);
                const grow = smooth(clamp((opts.reach - 0.45) / 0.55, 0, 1)), t = smooth(Math.min(1, opts.reach * 1.25));
                if (grow > 0) { const f = glowOf(GLOW_END, 0.25 + 0.75 * grow, breath()); g.drawImage(f.canvas, edge.x - f.half, edge.y - f.half); }
                aline(g, from.x, from.y, lerp(from.x, edge.x, t), lerp(from.y, edge.y, t), RP.SUN.hex[4], 0.75);
            }
            if (opts.trend > 0) { const q = toChart(b, wreck.age * opts.trend, wreck.ly * opts.trend); aline(g, o.x, o.y, q.x, q.y, C.ui); }
        }
        function drawChart(g, b, opts) {                    // opts.cursor: the point you move; opts.trend / opts.reach (0..1): the ending's line
            const o = toChart(b, 0, 0), top = toChart(b, view.y, view.l), c = opts.cursor && toChart(b, s.d.y, s.d.l), u = v => v / D;
            for (let i = 1; i < 5; i++) for (let j = 1; j < 4; j++) fill(g, A(b.x + (b.w * i) / 5), A(b.y + (b.h * j) / 4), RP.UI.hex[2]);
            drawTrend(g, b, o, opts);
            if (c) { aline(g, c.x, top.y, c.x, o.y - 1, RP.UI.hex[2], 0.6); aline(g, o.x + 1, c.y, top.x, c.y, RP.UI.hex[2], 0.6); }
            aline(g, o.x, o.y, top.x, o.y, RP.HULL.hex[3]); aline(g, o.x, top.y, o.x, o.y, RP.HULL.hex[3]);
            note('c-ly', 'LY DOWN THE HEADING', { x: u(o.x), y: u(top.y) - 13 });
            note('c-lmax', String(Math.round(view.l)), { x: u(o.x) - 4, y: u(top.y) - 3, align: 'right' });
            note('c-0', '0', { x: u(o.x) - 1, y: u(o.y) + 3 });
            note('c-yd', 'YEARS DEAD', { x: (u(o.x) + u(top.x)) / 2, y: u(o.y) + 3, align: 'center' });
            note('c-ymax', String(Math.round(view.y)), { x: u(top.x), y: u(o.y) + 3, align: 'right' });
            adisc(g, o.x + 0.5, o.y + 0.5, 3.2, 1, C.ui); note('c-us', 'US', { x: u(o.x) - 6, y: u(o.y) - 3, align: 'right', tone: 'ui' });   // us: alive, and where we started
            points.forEach((wk, i) => {
                const q = toChart(b, wk.age, wk.ly), right = q.x / D + 5 + wk.num.length * 2.6 > u(top.x);
                adisc(g, q.x + 0.5, q.y + 0.5, 2.6, 1, C.text); fill(g, q.x, q.y, C.star);
                note('c-p' + i, wk.num, { x: u(q.x) + (right ? -4 : 4), y: u(q.y) - 10, align: right ? 'right' : 'left' });
            });
            if (!c) return;
            const col = s.locked || s.dragging ? C.uiBright : C.ui;
            aring(g, c.x, c.y, A(4), col); fill(g, c.x, c.y, col);
            if (s.locked && s.flash > 0) aring(g, c.x, c.y, A(4 + (1 - s.flash / FLASH) * 12), C.uiBright, s.flash / FLASH);
            if (!s.moved && !s.locked && Math.floor(clock * 2) % 2) aring(g, c.x, c.y, A(7), C.uiBright, 0.7);   // this is the thing you move
        }
        function drawHud(lines, marks) {                    // the wreck, and the two counts the player needs, in small quiet words
            const nb = ' ';
            note('h-hull', 'EXODUS' + nb + wreck.num, { x: 10, y: 8, tone: 'text', size: 'm' });
            note('h-sector', 'SECTOR' + nb + wreck.sector, { x: 10, y: 20 });
            [['YEARS', s.v.y, 'MARKS', marks, 178], ['LY', s.v.l, 'LINES', lines, 189]].forEach(([axis, v, what, n, y]) => {
                note('h-' + axis, axis.padEnd(6, nb) + String(v).padStart(4, nb), { x: PAD.x - 22, y, tone: s.locked ? 'ui' : 'text' });
                note('h-' + what, what + nb + two(n) + '/14', { x: W - 10, y, align: 'right', tone: n === 14 ? 'ui' : 'dim' });
            });
            if (s.locked) note('h-dated', 'DATED', { x: W - 10, y: 8, align: 'right', tone: 'ui', size: 'm' });
        }
        function renderDate(g) {
            const { lines, marks } = drawFix(g), count = lines + marks;
            drawChart(g, PAD, { cursor: true }); drawHud(lines, marks);
            if (count > lastCount && !s.locked && clock - lastTick > 0.06) { SOUND.tick(count); lastTick = clock; }
            lastCount = count;
        }
        function renderEnd(g) {                             // the disc fades and the chart the player filled in opens up past it
            const e = smooth(clamp(endT / ZOOM, 0, 1));
            g.drawImage(skyEnd(), 0, 0);
            if (e < 1) { g.globalAlpha = 1 - e; drawFix(g); g.globalAlpha = 1; }
            view = { y: lerp(range.y, endRange.y, e), l: lerp(range.l, endRange.l, e) };
            const b = { x: lerp(PAD.x, BIG.x, e), y: lerp(PAD.y, BIG.y, e), w: lerp(PAD.w, BIG.w, e), h: lerp(PAD.h, BIG.h, e) };
            drawChart(g, b, { trend: clamp((endT - ZOOM) / TREND, 0, 1), reach: clamp((endT - ZOOM - TREND) / REACH, 0, 1) });
        }

        // ── drawing: the sector map ──
        function drawRoute(g, V) {                          // our course in warm dashes: down the heading, or bent through the place
            const us = { x: A(V.us.x), y: A(V.us.y) }, end = { x: A(M.end[0]), y: A(M.end[1]) }, Dp = { x: A(M.dest.x), y: A(M.dest.y) }, vx = end.x - us.x, vy = end.y - us.y;
            const t = ((Dp.x - us.x) * vx + (Dp.y - us.y) * vy) / (vx * vx + vy * vy), bend = m.set ? smooth(clamp((m.t - m.setAt) / BEND, 0, 1)) : 0;
            const pts = M.final ? [us, end] : [us, { x: lerp(us.x + vx * t, Dp.x, bend), y: lerp(us.y + vy * t, Dp.y, bend) }, end];
            const lens = pts.slice(1).map((q, k) => Math.hypot(q.x - pts[k].x, q.y - pts[k].y));
            let run = 0, left = (M.final ? smooth(clamp((m.t - T_LINE - LINE_DUR) / 0.9, 0, 1)) : 1) * lens.reduce((a, q) => a + q, 0);   // to the light: ours traces theirs
            lens.forEach((len, k) => {
                const a = pts[k], q = pts[k + 1];
                for (let d = 0; d < Math.min(len, left); d++) {
                    const x = a.x + ((q.x - a.x) * d) / len, y = a.y + ((q.y - a.y) * d) / len, phase = (((run + d - clock * 45) % 14) + 14) % 14;
                    if (phase > 7 || Math.hypot(x - us.x, y - us.y) < A(11) || (M.final && Math.hypot(x - end.x, y - end.y) < A(10))) continue;
                    fill(g, x, y, phase > 5.5 ? RP.AMBER.hex[4] : RP.AMBER.hex[3]);
                }
                run += len; left -= len;
            });
        }
        function drawWreckCourse(g, V) {                    // where the dead crew was steering; it fades once our course takes it over
            const gr = smooth(clamp((m.t - T_LINE) / LINE_DUR, 0, 1)), fadeAt = m.set ? m.setAt + BEND : M.final ? T_LINE + LINE_DUR + 0.9 : Infinity;
            const shade = 0.6 * (1 - clamp((m.t - fadeAt) / FADE, 0, 1)), a = V.wreck, Dd = M.dest, dx = Dd.x - a.x, dy = Dd.y - a.y, d = Math.hypot(dx, dy);
            if (gr <= 0 || shade <= 0) return;
            const len = (d - (M.final ? 12 : Dd.r + 3) - 6) * gr, sx = a.x + (dx / d) * 6, sy = a.y + (dy / d) * 6, tx = sx + (dx / d) * len, ty = sy + (dy / d) * len;
            aline(g, A(sx), A(sy), A(tx), A(ty), C.ui, shade);
            if (gr < 1) fill(g, A(tx) - 1, A(ty) - 1, C.uiBright, 2, 2);
        }
        function drawLight(g) {                             // the light at the end, small until their course reaches it
            const Dd = M.dest, grow = smooth(clamp((m.t - T_FOUND) / 0.8, 0, 1)), f = glowOf(GLOW_MAP, 0.35 + 0.65 * grow, breath());
            g.drawImage(f.canvas, Math.round(A(Dd.x)) - f.half, Math.round(A(Dd.y)) - f.half);
            for (let k = 0; k < 3 && grow >= 0.95; k++) {   // small dark hulls drift across its face
                const hx = Dd.x - 30 + ((clock * 1.2 + k * 23) % 60), hy = Dd.y - 12 + k * 11;
                if (Math.hypot(hx - Dd.x, hy - Dd.y) < GLOW_MAP * 0.62) { fill(g, A(hx), A(hy), RP.HULL.hex[1], Math.round(A(5 - k)), 2); fill(g, A(hx) + 1, A(hy), K.INK, Math.round(A(5 - k)) - 2, 1); }
            }
        }
        function drawPlace(g) {                             // the place comes out of the dark, brackets close on it, and it is named
            const Dd = M.dest, f = smooth(clamp((m.t - T_FOUND) / 0.8, 0, 1)), fb = clamp((m.t - T_FOUND) / 0.6, 0, 1), lit = beaconLit() && f === 1, pl = placeView();
            if (f <= 0) return;
            if (pl) {
                const fr = pl.frames[Math.min(3, Math.ceil(f * 4) - 1)];
                g.drawImage(fr.canvas, pl.x, pl.y);
                if (hover && f === 1) fr.rims.forEach(([x, y, r, lv]) => fill(g, pl.x + x, pl.y + y, r.hex[Math.min(r.hex.length - 1, lv + 2)]));   // pointed at: its lit edge brightens
            }
            if (Dd.kind === 'beacon') {                     // the beacon is a person's lamp, so it is warm
                const bx = A(Dd.x + 1), by = A(Dd.y - 4);
                if (lit) adisc(g, bx + 0.5, by + 0.5, 4.5, d => 0.6 * (1 - d), RP.AMBER.hex[3]);
                if (f === 1) fill(g, bx, by, lit ? RP.AMBER.hex[5] : RP.AMBER.hex[2]);
            }
            const hs = A(lerp(34, Dd.r + 5, smooth(fb))), col = fb < 1 || hover ? C.uiBright : RP.UI.hex[3], cx = Math.round(A(Dd.x)), cy = Math.round(A(Dd.y)), arm = Math.round(A(3));
            [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
                const x = Math.round(cx + sx * hs), y = Math.round(cy + sy * hs);
                aline(g, x, y, x - sx * arm, y, col); aline(g, x, y, x, y - sy * arm, col);
            });
            if (fb === 1 && !M.final) note('m-place', reward.name.toUpperCase(), { x: Dd.x, y: Dd.y - Dd.r - 17, align: 'center', tone: hover ? 'warm' : 'text' });
        }
        function drawPorthole(g) {                          // a close look at the place, opening beside the words
            const gr = clamp((m.t - T_PORT) / 0.35, 0, 1), kind = M.dest.kind, ix = A(PORT[0]), iy = A(PORT[1]), ir = A(IR);
            if (M.final || gr <= 0) return;
            if (gr < 1) adisc(g, ix, iy, ir * gr, 1, K.INK);
            else {
                const inset = insetOf(kind), half = (inset.width - 1) / 2, bx = Math.round(ix - half + A(BEACON[0])), by = Math.round(iy - half + A(BEACON[1])), lit = beaconLit();
                const open = clamp((m.t - T_PORT - 0.35) / 0.45, 0, 1);
                g.drawImage(inset, Math.round(ix - half), Math.round(iy - half));
                if (kind === 'beacon' && lit) adisc(g, bx + 0.5, by + 0.5, 6, d => 0.6 * (1 - d), RP.AMBER.hex[3]);
                if (kind === 'beacon') { fill(g, bx, by, lit ? RP.AMBER.hex[5] : RP.AMBER.hex[2]); if (lit) fill(g, bx - 1, by, RP.AMBER.hex[4], 3, 1); }
                if (open < 1) adisc(g, ix, iy, ir, 1 - open, K.INK);
            }
            aring(g, ix, iy, ir * gr + 1, RP.HULL.hex[3]); aring(g, ix, iy, ir * gr + 2.5, RP.HULL.hex[2], 0.7);
        }
        function drawPanel(g) {                             // what the fix says, in words
            const f = m.t - T_FOUND, x = M.final ? W - 10 : TEXT_X, y = PORT[1] - 16;
            if (f < 0.3) return;
            const name = reward.name.toUpperCase();
            note('m-sub', 'WHERE EXODUS-' + wreck.num + ' WAS GOING', { x, y, align: 'right' });
            note('m-name', name.slice(0, Math.floor((f - 0.3) / 0.05)) || ' ', { x, y: y + 6, align: 'right', tone: 'text', size: 'm' });
            if (m.t >= T_AURA) note('m-read', M.dest.readout, { x, y: y + 15, align: 'right', tone: 'ui' });
            drawPorthole(g);
        }
        /** Our Lander on the heading, its drive lit, as the travel view flies it. */
        let ours = null;
        function drawUs(g, V) {
            if (!ours) {
                const len = Math.round(A(15)), ht = len / 3.15, half = Math.ceil(len / 2 + ht + 8), p = K.P.painter(half * 2, half * 2, false);
                const at = K.P.hull(p, { x: half, y: half, len, ht, angle: HEAD_ANGLE, flip: true, seed: 9, anchor: 0.5, sun: 0.3, sunDir: LIGHT, fade: 0.2, flat: true }, K.P.shapeL);
                const rel = q => [q[0] - half, q[1] - half];
                ours = { canvas: p.canvas(), half, bell: rel(at(1.0, 0)), ports: [1, 3, 4].map(i => rel(at(K.P.DECK_U(i) + 0.054, -0.32))), len };
            }
            const x = Math.round(A(V.us.x)), y = Math.round(A(V.us.y)), ca = Math.cos(HEAD_ANGLE), sa = Math.sin(HEAD_ANGLE), fr = K.P.framer(g, AW, AH), flick = Math.floor(clock * 8) % 4;
            const bx = x + ours.bell[0], by = y + ours.bell[1], plume = (5 + 9 * [1, 0.75, 1.15, 0.9][flick]) * ours.len / 22;
            for (let d = 0; d < plume; d++) { const hw = 1.6 * (1 - d / plume * 0.6); for (let k = -Math.ceil(hw); k <= Math.ceil(hw); k++) { const v = (1 - d / plume) ** 0.8 * (1 - (k / (hw + 0.01)) ** 2); if (v > 0.06) fr.tone(bx - ca * d - sa * k, by - sa * d + ca * k, RP.PLUME, v); } }
            g.drawImage(ours.canvas, x - ours.half, y - ours.half);
            ours.ports.forEach(([px, py], i) => fill(g, x + px, y + py, RP.AMBER.hex[i === 0 ? 4 : 3]));   // people aboard: the ports are lit
            note('m-us', 'EXODUS-9', { x: V.us.x - 8, y: V.us.y + 7, tone: 'ui' });
        }
        function renderMap(g) {
            const V = mapView();
            g.drawImage(V.canvas, 0, 0);
            V.blinkers.forEach(b => {                       // a few dead beacons still flash, slowly and out of step
                const lit = (clock + b.phase) % b.period < 0.22;
                fill(g, b.x, b.y, lit ? C.uiBright : RP.UI.hex[2]);
                if (lit) { fill(g, b.x - 1, b.y, RP.UI.hex[3], 3, 1); fill(g, b.x, b.y - 1, RP.UI.hex[3], 1, 3); fill(g, b.x, b.y, C.uiBright); }
            });
            const wb = V.beacon, red = clock % 2.4 < 0.3;   // the wreck's own beacon: still blinking red
            if (red) { adisc(g, wb[0] + 0.5, wb[1] + 0.5, 3.5, d => 0.55 * (1 - d), RP.RED.hex[2]); fill(g, wb[0], wb[1], RP.RED.hex[4]); } else fill(g, wb[0], wb[1], RP.RED.hex[2]);
            note('m-wreck', 'EXODUS-' + wreck.num, { x: V.wreck.x + 9, y: V.wreck.y - 2 });
            note('m-age', wreck.age + ' YEARS', { x: V.wreck.x + 9, y: V.wreck.y + 4 });
            M.planets.forEach(([name, x, y, r], k) => note('m-planet' + k, name, { x, y: y + r + 3, align: 'center' }));
            if (M.final) drawLight(g);
            drawWreckCourse(g, V); drawRoute(g, V); drawPlace(g); drawUs(g, V);
            drawPanel(g);
            note('m-sector', 'SECTOR ' + wreck.sector, { x: 10, y: 8, size: 'm' });
            if (m.set) note('m-set', 'COURSE SET', { x: W - 10, y: 8, align: 'right', tone: 'warm', size: 'm' });
        }
        function drawWipe(g, dt) {                          // the view re-plots behind a scan line
            wipe = { ...wipe, t: wipe.t + dt };
            const k = clamp(wipe.t / WIPE, 0, 1), x = Math.round(smooth(k) * (AW + 24)) - 12, sx = Math.max(0, x);
            if (sx < AW) g.drawImage(wipe.snap, sx, 0, AW - sx, AH, sx, 0, AW - sx, AH);
            for (let y = 0; y < AH; y++) for (let k2 = 1; k2 <= 21; k2++) if (on(x - k2, y, 0.3 * (1 - k2 / 22))) fill(g, x - k2, y, RP.UI.hex[3]);
            fill(g, x, 0, C.ui, 1, AH);
            if (k >= 1) wipe = null;
        }

        // ── input ──
        cv.onpointerdown = e => {
            const q = ui.toPixel(e);
            if (mode === 'map') { if (m.canSet && nearPlace(q)) advance(); return; }
            if (!onPad(q) || busy() || fresh()) return;
            s = { ...s, dragging: true };
            try { cv.setPointerCapture(e.pointerId); } catch (err) { /* capture is optional */ }
            padAt(q);
        };
        cv.onpointermove = e => {
            const q = ui.toPixel(e);
            if (mode === 'map') { hover = m.canSet && nearPlace(q); cv.style.cursor = hover ? 'pointer' : 'default'; return; }
            cv.style.cursor = (onPad(q) && !busy()) || (s && s.dragging) ? 'crosshair' : 'default';
            if (s && s.dragging) { if (e.buttons) padAt(q); else release(); }
        };
        cv.onpointerleave = () => { hover = false; };
        cv.onpointerup = release;
        MiniLab.onKey((k, e) => {
            if (k === ' ' || k === 'Enter') {
                if (e && e.target instanceof HTMLButtonElement) return;   // a focused button presses itself
                if (e) e.preventDefault();                  // one press, one step
                return advance();
            }
            const step = STEPS[k], big = e && e.shiftKey ? 10 : 1;
            if (!step || busy()) return;
            if (e) e.preventDefault();
            nudge(step[0] * big, step[1] * big);
        });

        function stepDate(dt) {
            const k = Math.min(1, dt * EASE), kz = Math.min(1, dt * RESCALE), fast = held && held.age > HOLD_FAST_AFTER;
            const stride = span => (fast ? Math.max(1, Math.round(span / 100)) : 1);   // held long, a button moves faster on a long axis
            if (held && !busy()) {
                held = { ...held, wait: held.wait - dt, age: held.age + dt };
                for (; held.wait <= 0; held = { ...held, wait: held.wait + HOLD_EVERY }) nudge(held.dy * stride(range.y), held.dl * stride(range.l));
            }
            const ease = (a, b) => (Math.abs(b - a) < 0.01 ? b : a + (b - a) * k), zoom = (a, b) => a * Math.pow(b / a, kz);   // the zoom is even in ratio
            s = { ...s, d: { y: ease(s.d.y, s.v.y), l: ease(s.d.l, s.v.l) }, flash: Math.max(0, s.flash - dt) };
            view = Math.abs(view.y / range.y - 1) < 0.01 ? { ...range } : { y: zoom(view.y, range.y), l: zoom(view.l, range.l) };
            if (!s.locked && s.v.y === wreck.age && s.v.l === wreck.ly && Math.abs(s.d.y - s.v.y) < 0.02 && Math.abs(s.d.l - s.v.l) < 0.02) lock();
        }
        function frame(dt) {
            art(g => {
                if (mode === 'map') { m = { ...m, t: m.t + dt }; renderMap(g); }
                else if (mode === 'end') { endT += dt; renderEnd(g); }
                else { stepDate(dt); renderDate(g); }
                if (wipe) drawWipe(g, dt);
            });
            flushNotes();
        }

        MiniLab.loop(dt => {
            clock += dt;
            const due = queue.filter(q => q.at <= clock);
            if (due.length) { queue = queue.filter(q => q.at > clock); due.forEach(q => q.fn()); }
            frame(dt);
        }, 30);

        startDating();
        frame(0);
        return () => { cv.style.cursor = ''; ctx.imageSmoothingEnabled = smoothing; held = null; queue = []; wipe = null; gen++; if (typeof ui.clearNotes === 'function') ui.clearNotes(); };
    }

    MiniHost.register({
        id: 'disc',
        title: 'Date it with the disc',
        kicker: 'Star fix',
        density: DENSITY,
        mount,
        /** TEST_MODE: dated at once. Opts the game should never send resolve as not dated, with the reason in the console. */
        autoResult(opts = {}) {
            try { const w = readWreck(opts.wreck); return { dated: true, hull: w.hull, age: w.age, ly: w.ly }; }
            catch (e) { console.error(e); return { dated: false }; }
        },
    });
})();
