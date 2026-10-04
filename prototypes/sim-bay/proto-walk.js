/* proto-walk.js — THE WALK OUT (Sim Bay sketch, round three: 480×270, palette roles). The ending, played.
   You drift from EXODUS-9's airlock on a tether to the gold disc at the edge of the false sun. Every seven seconds the
   light shimmers and sends a band of reading light out, alternately short and long (the long ones reach the ship and
   silence one of the crew). Move between passes; during one, stay in the long shadow of a wreck. Caught in the open you
   are read: bleach, a HUD line lost, a tumble. The line snags on debris. At the disc: scrape off the map, take it or
   let it go. Back inside you watch A.U.R.A. count the crew: she skips you unless the light has read you. */
(function () {
    'use strict';
    const Lab = window.Lab;
    if (!Lab || !Lab.ship) return;
    const C = Lab.C, W = Lab.W, H = Lab.H, SHIP = Lab.ship, CREW = SHIP.CREW, TAU = Math.PI * 2;
    const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v), dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const cross = (ax, ay, bx, by) => ax * by - ay * bx, name = id => CREW[id].name;

    // ── where things are (1 px is about 20 cm: a crew figure is 9 px tall) ──
    const L = SHIP.layout(4, 6, 72, 258), HULL_X = Math.round(L.cx + L.maxHalf);
    const DOOR = { x: HULL_X - 1, y: L.room('cargo').bottom - 14, h: 10 };             // the airlock, in the cargo hold's outer wall
    const ANCHOR = { x: HULL_X + 1, y: DOOR.y + 5 }, START = { x: HULL_X + 10, y: DOOR.y + 5 };
    const POSTS = { aris: ['lab', 0.25], mira: ['lab', 0.75], vance: ['cargo', 0.8], jaxon: ['engineering', 0.2], you: ['cargo', 0.45] };
    const SPOT = Object.fromEntries(Object.entries(POSTS).map(([id, [room, slot]]) => [id, L.floor(room, slot)]));
    const RADIO = ['aris', 'mira', 'vance', 'jaxon'], ORDER = ['aris', 'vance', 'mira', 'jaxon'];   // the HUD's radio row; whom each long pass reads
    const COUNTED = ['aris', 'mira', 'you', 'vance', 'jaxon'];                         // A.U.R.A. counts deck by deck, left to right
    const SUN = { x: 418, y: 132, r: 58 }, DISC0 = { x: 346, y: 108 }, INSET = { x: 252, y: 78, r: 40 };
    const HUD = { x: 90, y: 8, pitch: 13 }, HUD_LINES = ['name', 'disc', 'line', 'ship'];
    const metres = px => Math.max(0, Math.round(px * 0.2)), says = px => `${metres(px)} metre${metres(px) === 1 ? '' : 's'}`;

    // ── tuning ──
    const ACC = 44, TOP = 15, DAMP = 1.6, STUN = 2.2, KNOCK = 22;   // suit thrust, its limiter, the stabiliser; after a read: seconds adrift, the shove
    const MAX_LINE = Math.ceil(dist(ANCHOR, DISC0)) + 50, CATCH = 9, GAP = 2.2, NUDGE = 0.15, REEL = 70, TUG = 1.5, SLOTS = 4, NB = 2880;
    const PASS = { first: 7, every: 7, warn: 2, speed: 80, band: 46, long: 560, short: 225, fade: 70 };
    const CUT = { start: 0.5, each: 0.18 }, CUT_DONE = CUT.start + 14 * CUT.each + 0.4, BEAT = 0.5;
    const DIRS = { ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down' };
    const CHOICES = { 1: 'cut', 2: 'take', 3: 'leave' };
    const HIT0 = PASS.first + (dist(SUN, SPOT.aris) - SUN.r) / PASS.speed;               // when the first long pass reaches Aris
    const reaches = (reach, d) => clamp01((reach - d) / PASS.fade) >= 0.35;              // is a pass still strong enough here to read

    // ── words (docs/STYLE.md: plain speech, one idea a line, 20 words at most) ──
    const toDisc = s => says(dist(s, s.disc));
    const OPENING = [
        { at: 0.4, note: 'The gold disc is drifting at the edge of the light.' },
        { at: 2.6, who: 'vance', text: 'That light reads whatever it touches. When it sweeps, stay in a shadow.' },
        { at: PASS.first - PASS.warn, aura: 'The next sweep starts in two seconds, Commander.' },
        { at: HIT0 - 2.5, who: 'aris', text: "There are ships inside the light. I'm adding them to my—" },
    ];
    const REACT = {                                                                       // after the light reads someone aboard
        aris: [{ dt: 2.4, who: 'mira', text: 'Aris stopped talking in the middle of a sentence.' },
            { dt: 4.8, who: 'vance', text: 'These hulls are numbered in the tens of thousands. We were told eight went before us.' }],
        vance: [{ dt: 2.4, who: 'jaxon', text: "Vance isn't answering. On the camera he's just standing there." },
            { dt: 4.8, who: 'mira', text: "It gives off no heat at all. That's not how a sun works." }],
        mira: [{ dt: 2.4, aura: 'Mira is not responding, Commander. Her heart rate is normal.' },
            { dt: 4.8, who: 'jaxon', text: "It's just me now. I'll keep talking as long as I can." },
            { dt: 8.4, who: 'jaxon', text: 'If we get out of this, I want to stop somewhere and stay.' }],
        jaxon: [{ dt: 2.6, aura: s => `The disc is ${toDisc(s)} ahead, Commander.` }],
    };
    const READ_LINES = [                                                                  // each list: the first speaker who can still talk
        [{ who: 'vance', text: 'Commander, your name just dropped off my screen. Get out of the light.' },
            { who: 'jaxon', text: 'Your name just went blank on my screen. Get out of the light.' },
            { aura: 'Your suit no longer shows your name, Commander.' }],
        [{ aura: s => `Your suit has lost its heading, Commander. The disc is ${toDisc(s)} ahead.` }],
        [{ aura: s => `Your line readout is gone, Commander. You have ${says(MAX_LINE - s.used)} left.` }],
    ];
    const SNAG = [{ who: 'jaxon', text: "Your line's caught on something. Go back around it, or pull hard." },
        { aura: 'Your line is caught, Commander. Go back around it, or pull until it tears free.' }];
    const TAUT = [{ who: 'jaxon', text: "That's the end of the line. It's holding." }, { aura: 'You are at the end of the line, Commander.' }];
    const SLIP = [{ aura: 'Your line has pulled free, Commander.' }], NEAR_LOST = [{ aura: 'The disc is almost inside the light, Commander.' }];
    const CAUGHT = 'The disc is in your glove. Fourteen lines on it, and where they meet is home.';
    const ENDINGS = {
        cut: { label: 'Scrape off the map', note: 'You scrape off all fourteen lines. Now it says we exist, but not where.' },
        take: { label: 'Take it aboard', note: 'You clip the disc to your suit and start back along the line.' },
        leave: { label: 'Let it go', note: 'You let go. The disc turns once and slides into the light.' },
        lost: { note: 'The disc slides into the light before you reach it.' },
    };
    const HOME = { aris: "You're back inside. I won't have to add you to my list.", vance: "You're inside. I'm sealing that door myself.",
        mira: 'You made it back. I watched the whole way.', jaxon: "Airlock's sealed. You can take the suit off now." };
    const COUNT = { four: 'Four crew, Commander.', five: 'Five crew, Commander.' };
    const MAP = (() => { const r = Lab.rng(1977); return Array.from({ length: 14 }, (_, i) => ({ a: (i / 14) * TAU + (r() - 0.5) * 0.35, len: 9 + r() * 13, bright: i % 2 === 0 })); })();
    const FIGURES = [{ x: 12, y: -10, rows: ['#.#.', '.###', '..#.', '..#.', '.#.#', '.#.#'] }, { x: 22, y: -8, rows: ['.#.', '###', '.#.', '#.#', '#.#'] }];

    // ── the debris (all of it from dead ships): shape(x, y) in the piece's own frame → metal tone, WINDOW, DARK or OUT ──
    const OUT = -1, WINDOW = 2, DARK = 3;
    const ragged = (k, n) => (((Math.imul(k | 0, 2654435761) >>> 0) % 1009) / 1009) * n;
    const SHAPES = {
        plate: (x, y) => (Math.abs(y) > 3.5 || Math.abs(x) > 16 - ragged(Math.round(y) * 3 + (x < 0 ? 17 : 0), 5) ? OUT   // a torn hull plate
            : Math.round(x) % 6 === 0 ? 0.28 : Math.abs(y) > 2.4 ? 0.5 : 0.4),
        pod(x, y) {                                                                       // an empty sleeper pod, its lid frosted
            const ax = Math.abs(x);
            if (Math.abs(y) > 5 || ax > 11 || (ax > 6 && (ax - 6) ** 2 + y * y > 25)) return OUT;
            return x > -5 && x < 3 && y > -3.5 && y < 0 ? WINDOW : Math.round(x) === 6 ? 0.26 : 0.46 - y * 0.02;
        },
        bell(x, y) {                                                                      // an engine bell, torn off at the throat
            const hw = 3 + (y + 11) * 0.4;
            if (y < -11 || y > 10 || Math.abs(x) > hw) return OUT;
            if (y > 7.5) return Math.abs(x) > hw - 1.6 ? 0.58 : DARK;
            return y < -8.5 ? 0.52 : Math.round(y) % 4 === 0 ? 0.28 : 0.42;
        },
        hull(x, y) {                                                                      // a section of a dead EXODUS hull: two empty decks
            const top = -17 + ragged(Math.floor((x + 40) / 3), 9);                       // torn along the top
            if (Math.abs(x) > 34 || y > 17 || y < top) return OUT;
            if (y < top + 1.5 || Math.abs(x) > 32 || y > 15) return 0.52;
            if (Math.abs(y + 1) < 0.8 || Math.abs(y - 13) < 0.8) return 0.56;              // deck floors
            return Math.abs(x + 10) < 0.7 || Math.abs(x - 15) < 0.7 ? 0.4 : 0.1 + 0.1 * ((y + 17) / 34);   // bulkheads, dark rooms
        },
        lander(x, y) {                                                                    // a small lander on two legs
            if (y >= 3 && y <= 8) return Math.abs(Math.abs(x) - (5 + (y - 3) * 0.8)) < 0.8 ? 0.44 : OUT;
            if (y < -7 || y > 3 || Math.abs(x) > 4 + (y + 7) * 0.45) return OUT;
            return y < -4 && Math.abs(x) < 2 ? WINDOW : y > 1.5 ? 0.3 : 0.45;
        },
        hatch(x, y) {                                                                     // a round hatch door, still with its wheel
            const d = Math.hypot(x, y);
            if (d > 9) return OUT;
            return d > 7.6 ? 0.55 : Math.abs(d - 4) < 0.7 || ((Math.abs(x) < 0.6 || Math.abs(y) < 0.6) && d < 4) ? 0.62 : 0.38;
        },
        tank(x, y) {                                                                      // a split fuel tank
            const ax = Math.abs(x);
            if (Math.abs(y) > 6 || ax > 12 || (ax > 7 && (ax - 7) ** 2 + y * y > 36)) return OUT;
            return x > 2 && x < 6 && y > -1 && y < 6 - (x - 2) ? DARK : Math.round(x) % 5 === 0 ? 0.3 : 0.46;
        },
    };
    const piece = (kind, x, y, dx, dy, period, phase, angle, spin, circles) => ({ kind, x, y, dx, dy, period, phase, angle, spin, circles,
        R: Math.ceil(Math.max(...circles.map(([cx, cy, r]) => Math.hypot(cx, cy) + r))) + 3 });
    const DEBRIS = [
        piece('plate', 128, 166, 4, 12, 130, 0.4, 1.2, 0.012, [[-10, 0, 5.5], [0, 0, 5.5], [10, 0, 5.5]]),   // its shadow covers the airlock
        piece('pod', 210, 98, 5, 24, 150, 2.2, -0.35, -0.02, [[-5.5, 0, 6], [5.5, 0, 6]]),
        piece('bell', 192, 212, 4, -16, 120, 4.0, 0.9, 0.03, [[0, -5, 6], [0, 5, 11]]),
        piece('lander', 296, 70, 4, 20, 140, 5.2, -0.25, 0.015, [[0, -1, 8.5]]),
        // the hull, its hatch and a tank drift together, one cloud from one wreck, so the way through it keeps its shape
        piece('hull', 262, 168, 4, 10, 180, 1.0, 0.3, 0.006, [[-24, 1, 15], [-8, 1, 15], [8, 1, 15], [24, 1, 15]]),
        piece('hatch', 302, 152, 4, 10, 180, 1.0, 0, 0.06, [[0, 0, 9]]),
        piece('tank', 322, 146, 4, 10, 180, 1.0, 1.3, -0.008, [[-6, 0, 6.5], [6, 0, 6.5]]),   // the last cover: open light from here to the disc
    ];
    /** Where a piece is at time t: it drifts slowly on a long swing and turns. */
    function placeDebris(def, t) {
        const w = TAU / def.period, a = def.angle + def.spin * t, ca = Math.cos(a), sa = Math.sin(a);
        const x = def.x + def.dx * (Math.sin(w * t + def.phase) - Math.sin(def.phase));
        const y = def.y + def.dy * (Math.sin(w * t + def.phase + 1.3) - Math.sin(def.phase + 1.3));
        return { def, x, y, a, circles: def.circles.map(([cx, cy, r]) => ({ x: x + cx * ca - cy * sa, y: y + cx * sa + cy * ca, r })) };
    }

    // ── shadows: one per piece, from behind its middle, tapering to a point far from the light. Stored per angle from the
    //    light as stretches of distance, so the picture and the "am I hidden?" test read the same table. ──
    function buildShadows(V, debris) {
        V.sCount.fill(0);
        debris.forEach(p => {
            const D = Math.hypot(p.x - SUN.x, p.y - SUN.y), ux = (p.x - SUN.x) / D, uy = (p.y - SUN.y) / D;
            const r = 0.9 * Math.max(...p.circles.map(c => Math.abs((c.x - p.x) * -uy + (c.y - p.y) * ux) + c.r));   // its width as the light sees it
            if (D <= r + 1) return;
            const th = Math.atan2(uy, ux), half = Math.asin(r / D), len = Math.min(200, 70 + 7 * r);
            for (let b = Math.floor(((th - half + Math.PI) / TAU) * NB), b1 = Math.ceil(((th + half + Math.PI) / TAU) * NB); b <= b1; b++) {
                const bb = ((b % NB) + NB) % NB;
                let phi = ((bb + 0.5) / NB) * TAU - Math.PI - th;
                phi -= TAU * Math.round(phi / TAU);
                const sp = Math.abs(Math.sin(phi));
                if (D * sp >= r || V.sCount[bb] >= SLOTS) continue;
                const o = bb * SLOTS + V.sCount[bb]++;
                V.sA[o] = D * Math.cos(phi);
                V.sB[o] = (r * (1 + D / len)) / (sp + r / len);
            }
        });
    }
    const binOf = (x, y) => Math.floor(((Math.atan2(y - SUN.y, x - SUN.x) + Math.PI) / TAU) * NB) % NB;
    const inShadow = (V, d, b) => { for (let j = 0, o = b * SLOTS; j < V.sCount[b]; j++, o++) if (d > V.sA[o] && d < V.sB[o]) return true; return false; };

    // ── the passes: a band of reading light whose front runs out from the light ──
    const frontOf = (p, t) => SUN.r + PASS.speed * (t - p.t0);
    function bandTone(R, reach, d) {
        const u = (R - d) / PASS.band;
        if (u < 0 || u > 1) return 0;
        return clamp01((reach - d) / PASS.fade) * (u < 0.05 ? 1 : u < 0.12 ? 0.72 : 0.05 + 0.45 * (1 - u) ** 3);   // a hard bright front, a soft wake
    }
    const bandAt = (s, d) => s.passes.reduce((v, p) => Math.max(v, bandTone(frontOf(p, s.t), p.reach, d)), 0);

    // ── the tether: anchor → the points where it has caught on debris → the suit ──
    function wrapAt(s, w) {
        const p = s.debris[w.k], ca = Math.cos(p.a), sa = Math.sin(p.a);
        return { x: p.x + w.ox * ca - w.oy * sa, y: p.y + w.ox * sa + w.oy * ca };
    }
    const chainPoints = s => [ANCHOR, ...s.wraps.map(w => wrapAt(s, w)), { x: s.x, y: s.y }];
    const lineLength = s => chainPoints(s).reduce((sum, p, i, pts) => sum + (i ? dist(pts[i - 1], p) : 0), 0);
    /** If the line's last stretch (P → suit) now cuts through a piece, where it catches: the piece's outer edge on its side. */
    function snagPoint(s, P, prev) {
        const ux = s.x - P.x, uy = s.y - P.y, ul2 = ux * ux + uy * uy;
        if (ul2 < 4) return null;
        let best = null;
        s.debris.forEach((p, k) => p.circles.forEach(c => {
            if (Math.hypot(P.x - c.x, P.y - c.y) < c.r + 1.5) return;                     // the stretch starts on this one
            const u = ((c.x - P.x) * ux + (c.y - P.y) * uy) / ul2;
            if (u > 0.02 && u < 0.98 && Math.hypot(P.x + ux * u - c.x, P.y + uy * u - c.y) < c.r * 0.7 && (!best || u < best.u)) best = { u, k, c };
        }));
        if (!best) return null;
        const side = Math.sign(cross(prev.x - P.x, prev.y - P.y, best.c.x - P.x, best.c.y - P.y)) || 1;
        const ul = Math.sqrt(ul2), nx = -uy / ul, ny = ux / ul, pc = s.debris[best.k];
        let pick = best.c, far = -Infinity;
        pc.circles.forEach(c => {
            const u = ((c.x - P.x) * ux + (c.y - P.y) * uy) / ul2, out = -side * ((c.x - P.x) * nx + (c.y - P.y) * ny) + c.r;
            if (u > 0 && u < 1 && out > far) { far = out; pick = c; }
        });
        const wx = pick.x - side * nx * (pick.r + 0.5), wy = pick.y - side * ny * (pick.r + 0.5);
        const ca = Math.cos(pc.a), sa = Math.sin(pc.a), ox = wx - pc.x, oy = wy - pc.y;
        return { k: best.k, ox: ox * ca + oy * sa, oy: -ox * sa + oy * ca, turn: Math.sign(cross(wx - P.x, wy - P.y, pick.x - wx, pick.y - wy)) || 1 };
    }

    // ── colours and the per-pixel field, worked out once per mount (the palette can change between mounts) ──
    const pack = hex => { const n = parseInt(hex.slice(1), 16); return (0xff000000 | ((n & 255) << 16) | (n & 0xff00) | (n >> 16)) >>> 0; };
    const rampPick = (ramp, tone, thr) => { const top = ramp.length - 1, pos = clamp01(tone) * top, lo = pos | 0; return pos - lo > thr && lo < top ? ramp[lo + 1] : ramp[lo]; };
    function valueNoise(seed) {
        const r = Lab.rng(seed), ox = r() * 100, oy = r() * 100, sm = t => t * t * (3 - 2 * t);
        const h = (a, b) => { const v = Math.sin((a + ox) * 127.1 + (b + oy) * 311.7) * 43758.5453; return v - Math.floor(v); };
        return (x, y) => {
            const xi = Math.floor(x), yi = Math.floor(y), xf = sm(x - xi), yf = sm(y - yi);
            return Lab.lerp(Lab.lerp(h(xi, yi), h(xi + 1, yi), xf), Lab.lerp(h(xi, yi + 1), h(xi + 1, yi + 1), xf), yf);
        };
    }
    /** The sky twice: lit (nebula and stars) and in shadow (stars only), so a shadow reads as a clean dark lane. */
    function buildSky(withNebula) {
        const c = Object.assign(document.createElement('canvas'), { width: W, height: H }), g = c.getContext('2d');
        g.fillStyle = C.void; g.fillRect(0, 0, W, H);
        if (withNebula) Lab.nebula(g, 1977, 0.55);
        Lab.stars(g, 61, 240);
        return new Uint32Array(g.getImageData(0, 0, W, H).data.buffer);
    }
    function buildView(ctx) {
        const n = W * H, r = Lab.rng(909), cloud = valueNoise(31), grain = valueNoise(57), F = k => new Float32Array(k), img = ctx.createImageData(W, H);
        const V = { dS: F(n), bin: new Uint16Array(n), thr: F(n), rnd: F(n), hz: F(n), glow: F(n), rayA: F(NB), rayB: F(NB), gr1: F(n), gr2: F(n),
            mask: new Uint8Array(n), img, px: new Uint32Array(img.data.buffer), lit: buildSky(true), dark: buildSky(false),
            sCount: new Uint8Array(NB), sA: F(NB * SLOTS), sB: F(NB * SLOTS) };
        for (let b = 0; b < NB; b++) {                                                    // two layers of thin streamers, by angle
            const a = ((b + 0.5) / NB) * TAU - Math.PI;
            V.rayA[b] = (0.5 + 0.5 * Math.sin(a * 9 + 1.7 * Math.sin(a * 4))) ** 6;
            V.rayB[b] = (0.5 + 0.5 * Math.sin(a * 14 - 0.7 + 2.2 * Math.sin(a * 3 + 1))) ** 5;
        }
        for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i++) {
            const d = Math.hypot(x - SUN.x, y - SUN.y), out = Math.max(0, d - SUN.r);
            V.dS[i] = d; V.bin[i] = binOf(x, y); V.thr[i] = Lab.bayer(x, y); V.rnd[i] = r();
            V.hz[i] = d < SUN.r ? 0 : (0.03 + 0.06 * Math.exp(-out / 160)) * (0.4 + 1.2 * cloud(x / 70, y / 50));   // sparse dust in the light
            V.glow[i] = 0.27 * Math.exp(-out / 80) + 0.5 * Math.exp(-out * 0.12) + 0.06 * Math.exp(-out / 240);     // wide glow, bright limb, a long faint reach
            if (d < SUN.r + 2) { V.gr1[i] = grain(x / 4, y / 4) - 0.5; V.gr2[i] = grain(x / 6 + 40, y / 6 + 9) - 0.5; }
        }
        V.P = {
            VOID: pack(C.void), HULL: C.hull.map(pack), LIGHT: pack(C.light), WIN: pack(Lab.mix(C.uiDim, C.haze, 0.3)),
            SUN: [C.void, Lab.mix(C.nebB, C.lightHalo, 0.22), Lab.mix(C.nebB, C.lightHalo, 0.55), C.lightHalo, Lab.mix(C.lightHalo, C.light, 0.5), C.light].map(pack),
            DUST: pack(Lab.mix(C.dusk, C.lightHalo, 0.16)), DUST2: pack(Lab.mix(C.haze, C.lightHalo, 0.3)), RIM: pack(Lab.mix(C.hull[4], C.lightHalo, 0.45)),
            EDGE: pack(Lab.mix(C.line2, C.haze, 0.5)), EDGE_HOT: pack(Lab.mix(C.mist, C.uiDim, 0.5)),
        };
        return V;
    }

    // ── painting the field: the light's face and corona, lit dust, the shadows and their edges, the passing bands ──
    function composeField(V, s) {
        const { px, lit, dark, dS, bin, thr, rnd, hz, glow, rayA, rayB, gr1, gr2, mask, sCount, sA, sB, P } = V;
        const t = s.t, R0 = SUN.r, warn = s.warnK, n = W * H;
        const reach = (0.82 + 0.14 * Math.sin(t * 0.55)) * 1.35, coronaEnd = R0 * (1 + reach);   // the corona breathes in and out
        const breathe = (0.9 + 0.1 * Math.sin(t * 0.55) + s.lift + 0.25 * warn) * 0.6, gc = Math.cos(t * 0.4) * 0.11, gs = Math.sin(t * 0.4) * 0.11;
        const limb = 1 + 0.6 * warn + s.lift, shA = Math.floor(t * 9) % NB, shB = NB - (Math.floor(t * 6) % NB);   // streamers turn slowly
        const ringR = R0 * (1 + 0.4 * (1 - warn)), flick = warn > 0 ? Math.floor(t * 18) * 0.618 : 0, dustGain = 1 + warn * 0.9;
        const bands = s.passes.map(p => ({ R: frontOf(p, t), reach: p.reach }));
        for (let i = 0; i < n; i++) {                                                     // 1) which pixels lie in a shadow (inShadow, inlined)
            const b = bin[i], d = dS[i];
            let m = 0;
            for (let j = 0, o = b * SLOTS, k = sCount[b]; j < k; j++, o++) if (d > sA[o] && d < sB[o]) { m = 1; break; }
            mask[i] = m;
        }
        for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i++) {            // 2) the picture
            const d = dS[i];
            if (d < R0) {                                                                 // the face of the light, slowly churning
                const dn = d / R0, ripple = 0.05 * (0.5 + 0.5 * Math.sin(dn * 16 - t * 1.1));
                px[i] = rampPick(P.SUN, 0.47 + 0.53 * Math.sqrt(1 - dn * dn) + gr1[i] * gc + gr2[i] * gs - ripple + s.lift * 0.3, thr[i]);
                continue;
            }
            const shade = mask[i] === 1;
            let col = shade ? dark[i] : lit[i];
            if (!shade) {
                if ((warn > 0 ? (rnd[i] + flick) % 1 : rnd[i]) < hz[i] * dustGain) col = d < 150 ? P.DUST2 : P.DUST;
            } else if (y > 0 && y < H - 1 && x > 0 && x < W - 1 && (mask[i - 1] === 0 || mask[i + 1] === 0 || mask[i - W] === 0 || mask[i + W] === 0)) {
                if (thr[i] < 0.7 + 0.3 * warn) col = warn > 0.3 ? P.EDGE_HOT : P.EDGE;     // the shadow's edge, sharper before a pass
            }
            let v = glow[i] * limb * 0.7;
            const ra = rayA[(bin[i] + shA) % NB];
            if (d < coronaEnd) {                                                          // streamers
                const f = 1 - (d / R0 - 1) / reach;
                v += f * f * (0.04 + 0.5 * Math.max(ra, 0.8 * rayB[(bin[i] + shB) % NB])) * breathe;
                if (warn > 0.02 && Math.abs(d - ringR) < 1.6) v = Math.max(v, warn);      // the light gathering itself
            }
            if (shade) v *= 0.2;                                                          // shadows cut dark lanes through the glow
            else for (let q = 0; q < bands.length; q++) v = Math.max(v, bandTone(bands[q].R, bands[q].reach, d) * (0.85 + 0.15 * ra));
            if (v > 0.012) { const c2 = rampPick(P.SUN, v, thr[i]); if (c2 !== P.VOID) col = c2; }
            px[i] = col;
        }
    }
    function drawDebrisInto(V, s) {
        const { px, thr, P } = V;
        s.debris.forEach(p => {
            const shape = SHAPES[p.def.kind], R = p.def.R, ca = Math.cos(p.a), sa = Math.sin(p.a);
            const tx = SUN.x - p.x, ty = SUN.y - p.y, td = Math.hypot(tx, ty), lx0 = tx / td, ly0 = ty / td;
            const slx = (lx0 * ca + ly0 * sa) * 1.6, sly = (-lx0 * sa + ly0 * ca) * 1.6;   // one step toward the light, in the piece's frame
            const lit = bandAt(s, td), rim = lit > 0.3 ? P.LIGHT : P.RIM;
            for (let y = Math.max(0, Math.floor(p.y - R)); y <= Math.min(H - 1, Math.ceil(p.y + R)); y++) {
                for (let x = Math.max(0, Math.floor(p.x - R)); x <= Math.min(W - 1, Math.ceil(p.x + R)); x++) {
                    const wx = x - p.x, wy = y - p.y, lx = wx * ca + wy * sa, ly = -wx * sa + wy * ca, v = shape(lx, ly), i = y * W + x;
                    if (v === OUT) continue;
                    px[i] = v === WINDOW ? P.WIN : v === DARK ? P.VOID : shape(lx + slx, ly + sly) === OUT ? rim   // the edge that faces the light
                        : rampPick(P.HULL, v + (0.16 * (wx * lx0 + wy * ly0)) / R + 0.25 * lit, thr[i]);
                }
            }
        });
    }

    // ── drawn on top ──
    const SHIPS = [['.#.', '###', '###', '###', '#.#'], ['.#.', '###', '###', '###', '###', '###', '.#.', '#.#'],   // dead hulls, nose up
        ['..#..', '.###.', '.###.', '#####', '#####', '#####', '#####', '#####', '#####', '#####', '#####', '#####', '.###.', '##.##']];
    const TRANSITS = [{ dy: -38, v: 1.1, o: 10, k: 0, f: 0.45 }, { dy: -19, v: -0.6, o: 60, k: 1, f: 0.65 }, { dy: 12, v: 0.25, o: 40, k: 2, f: 1 },
        { dy: 31, v: -0.9, o: 90, k: 0, f: 0.55 }, { dy: -4, v: 0.45, o: 100, k: 1, f: 0.8 }, { dy: 44, v: 0.5, o: 5, k: 0, f: 0.4 }];
    /** Dead hulls crossing the face of the light: the far ones small and faint, one near one large and black. */
    function drawTransits(ctx, t) {
        TRANSITS.forEach(q => {
            const rows = SHIPS[q.k], half = Math.sqrt(SUN.r ** 2 - q.dy ** 2), span = 2 * half + 10;
            const x0 = Math.round(SUN.x - half - 5 + ((((q.o + q.v * t) % span) + span) % span)), y0 = SUN.y + q.dy - (rows.length >> 1);
            ctx.fillStyle = Lab.mix(C.lightHalo, C.void, q.f);
            rows.forEach((row, r) => [...row].forEach((ch, c) => {
                if (ch === '#' && Math.hypot(x0 + c - SUN.x, y0 + r - SUN.y) < SUN.r - 0.5) ctx.fillRect(x0 + c, y0 + r, 1, 1);
            }));
        });
    }
    function ellipse(ctx, x, y, rx, ry, color) {
        ctx.fillStyle = color;
        for (let dy = -ry; dy <= ry; dy++) for (let dx = -Math.ceil(rx); dx <= Math.ceil(rx); dx++) {
            if ((dx / Math.max(rx, 0.5)) ** 2 + (dy / ry) ** 2 <= 1.05) ctx.fillRect(x + dx, y + dy, 1, 1);
        }
    }
    function drawCoin(ctx, s) {
        if (s.t - s.discFlash < 1) Lab.ring(ctx, s.disc.x, s.disc.y, 2 + (s.t - s.discFlash) * 18, C.light, 1 - (s.t - s.discFlash));
        if (s.discGone || s.ending === 'take') return;
        const x = Math.round(s.disc.x), y = Math.round(s.disc.y), w = Math.abs(Math.cos(s.t * 1.1)) * 3.6;
        ellipse(ctx, x, y, w + 1.2, 5, C.void);
        ellipse(ctx, x, y, w + 0.2, 4, C.lightHalo);
        if (w > 1.6) ellipse(ctx, x, y, w - 1.4, 2, C.light);
        if (w > 3.3 || bandAt(s, dist(s.disc, SUN)) > 0.4) {                             // a glint as it turns, or as a pass reads it
            ctx.fillStyle = C.star;
            [[0, -6], [0, -7], [0, 6], [0, 7], [-6, 0], [6, 0]].forEach(([dx, dy]) => ctx.fillRect(x + dx, y + dy, 1, 1));
        }
        if (s.phase !== 'walk' || s.lost.some(l => l.line === 'disc')) return;           // the suit's marker on it, until the heading is read away
        const c = Math.floor(s.t * 1.5) % 2 ? C.uiBright : C.ui;
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => [[9, 9], [8, 9], [9, 8]].forEach(([a, b]) => Lab.dot(ctx, x + sx * a, y + sy * b, c)));
    }
    function drawShip(ctx, s) {
        SHIP.draw(ctx, L, s.t * 1000, { labels: true });
        const shut = s.homeT < 0 ? 0 : clamp01((s.t - s.homeT) / 0.6);                   // the airlock, lit from inside until it shuts
        ctx.fillStyle = C.hull[3]; ctx.fillRect(DOOR.x - 1, DOOR.y - 1, 3, DOOR.h + 2);
        ctx.fillStyle = C.void; ctx.fillRect(DOOR.x, DOOR.y, 2, DOOR.h);
        Lab.shade(ctx, DOOR.x - 2, DOOR.y + 1, 1, DOOR.h - 2, 0.5, C.warm);
        if (shut > 0) { ctx.fillStyle = C.hull[2]; ctx.fillRect(DOOR.x, DOOR.y, 2, Math.round(DOOR.h * shut)); }
        Lab.dot(ctx, DOOR.x + 1, DOOR.y - 3, shut >= 1 ? C.warm : Math.floor(s.t * 2) % 2 ? C.uiBright : C.uiDim);
        s.passes.forEach(p => {                                                           // a long pass sliding over our hull
            const R = frontOf(p, s.t);
            if (!p.long || R < 330 || R - PASS.band > 470) return;
            ctx.fillStyle = C.light;
            for (let y = L.top; y < L.top + L.height; y++) {
                const hw = L.halfWidth(y);
                for (let x = Math.round(L.cx - hw); hw > 0 && x <= Math.round(L.cx + hw); x++) {
                    const tone = bandTone(R, p.reach, Math.hypot(x - SUN.x, y - SUN.y)) * 0.6;
                    if (tone > 0 && Lab.on(x, y, tone)) ctx.fillRect(x, y, 1, 1);
                }
            }
        });
        RADIO.forEach(id => {
            const p = SPOT[id], hit = s.quiet[id], awake = hit === undefined, since = awake ? 0 : s.t - hit;
            SHIP.figure(ctx, p.x, p.y, awake ? CREW[id].color : since < 0.6 ? C.light : C.textDim, awake && (s.t * 0.6 + p.x * 0.37) % 3 < 0.25);
            if (awake && s.talker === id && s.t - s.talkT < GAP) {                       // who is talking: a mark over their head
                Lab.dot(ctx, p.x, p.y - 11, CREW[id].color);
                if (Math.floor(s.t * 4) % 2) Lab.dot(ctx, p.x, p.y - 13, CREW[id].color);
            }
            if (!awake && since < 1.8) for (let k = 0; k < 6; k++) Lab.dot(ctx, p.x - 4 + Math.random() * 9, p.y - 13 + Math.random() * 6, C.textDim);
        });
        if (s.homeT < 0 || s.t - s.homeT < 0.6) return;
        SHIP.figure(ctx, SPOT.you.x, SPOT.you.y, CREW.you.color);
        if (s.ending === 'take') Lab.dot(ctx, SPOT.you.x + 3, SPOT.you.y - 5, C.lightHalo);
        COUNTED.filter(id => id !== 'you' || s.reads > 0).slice(0, s.countN)            // A.U.R.A. counting aloud: a number over each one she counts
            .forEach((id, k) => Lab.text(ctx, String(k + 1), SPOT[id].x - 1, SPOT[id].y - 17, C.uiBright));
    }
    function drawTether(ctx, s) {
        const pts = chainPoints(s), slack = Math.max(0, MAX_LINE - s.used);
        const col = s.jolt > 0 ? C.warmBright : slack < 10 ? C.warm : Lab.mix(C.warm, C.mist, 0.55);
        for (let i = 1; i < pts.length; i++) {
            const a = pts[i - 1], b = pts[i];
            if (i < pts.length - 1 || slack < 2) { Lab.line(ctx, a.x, a.y, b.x, b.y, col); continue; }
            const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, amp = Math.min(7, slack * 0.06), steps = Math.ceil(len * 1.4) + 1;
            ctx.fillStyle = col;
            for (let k = 0; k <= steps; k++) {                                            // slack line floats in a lazy curve
                const u = k / steps, wave = Math.sin(Math.PI * u) * Math.sin(u * 6 + s.t * 0.9) * amp;
                ctx.fillRect(Math.round(a.x + dx * u - (dy / len) * wave), Math.round(a.y + dy * u + (dx / len) * wave), 1, 1);
            }
        }
        if (Math.floor(s.t * 3) % 2) s.wraps.forEach((w, i) => { ctx.fillStyle = C.danger; ctx.fillRect(Math.round(pts[i + 1].x) - 1, Math.round(pts[i + 1].y) - 1, 3, 3); });
    }
    const SUIT = ['.hhh..', 'hhvvg.', 'hhvvv.', 'pssssa', 'pssss.', 'pssss.', '.l.l..', '.l..l.'];   // facing right
    /** The suit: dim in a shadow, ringed with light while it stands in the path of a pass, white for a moment when read. */
    function drawSuit(ctx, s) {
        const turn = s.stun > 0 ? Math.floor(s.t * 7) % 4 : 0, flip = s.face < 0, hot = s.t - s.flash < 0.45, ox = Math.round(s.x), oy = Math.round(s.y);
        const warm = Lab.mix(Lab.mix(C.warm, C.textDim, Math.min(0.5, s.reads * 0.13)), C.deep, s.hidden ? 0.3 : 0);   // reads take its warmth
        const pal = { h: warm, s: warm, a: s.hidden ? warm : C.warmBright, p: Lab.mix(warm, C.deep, 0.4), l: Lab.mix(warm, C.deep, 0.25), v: Lab.mix(C.deep, C.uiDim, 0.4), g: C.light };
        const cells = [];
        SUIT.forEach((row, r) => [...row].forEach((ch, c) => {
            if (ch === '.') return;
            let dx = (flip ? 5 - c : c) - 3, dy = r - 4;
            for (let q = 0; q < turn; q++) [dx, dy] = [-dy, dx];                          // tumbling, out of control
            cells.push([dx, dy, ch]);
        }));
        if (s.exposed && Math.floor(s.t * 6) % 2) { ctx.fillStyle = C.light; cells.forEach(([dx, dy]) => ctx.fillRect(ox + dx - 1, oy + dy - 1, 3, 3)); }
        cells.forEach(([dx, dy, ch]) => Lab.dot(ctx, ox + dx, oy + dy, hot ? C.light : pal[ch]));
        if (!hot && !turn && Math.floor(s.t * 1.2) % 2 === 0) Lab.dot(ctx, ox + (flip ? 2 : -3), oy - 2, s.hidden ? C.uiDim : C.ui);   // suit beacon
        if (s.ending === 'take') Lab.dot(ctx, ox + (flip ? -2 : 1), oy + 1, C.lightHalo);
    }
    /** The disc up close: fourteen pulsar lines from one point, and two figures. Scraped lines go grey one by one. */
    function drawInset(ctx, s) {
        const { x: cx, y: cy, r: R } = INSET, mx = cx - 14, my = cy + 3, erased = s.ending === 'cut' ? s.scraped : 0;
        Lab.line(ctx, cx + R * 0.72, cy + R * 0.72, s.disc.x - 6, s.disc.y - 2, C.line2, 0.6);
        Lab.disc(ctx, cx, cy, R + 4, 1, C.void);
        Lab.ring(ctx, cx, cy, R + 4, C.line2);
        Lab.disc(ctx, cx, cy, R, d => 0.06 + 0.16 * d, C.lightHalo);
        Lab.ring(ctx, cx, cy, R, C.lightHalo);
        Lab.ring(ctx, cx, cy, R - 4, C.lightHalo, 0.3);
        MAP.forEach((mp, i) => {
            const ex = mx + Math.cos(mp.a) * mp.len, ey = my + Math.sin(mp.a) * mp.len;
            if (i < erased) { Lab.line(ctx, mx, my, ex, ey, C.textDim, 0.3); return; }
            const col = mp.bright ? C.light : C.lightHalo, tx = -Math.sin(mp.a) * 2, ty = Math.cos(mp.a) * 2;
            Lab.line(ctx, mx, my, ex, ey, col);
            Lab.dot(ctx, ex + tx, ey + ty, col); Lab.dot(ctx, ex - tx, ey - ty, col);       // the pulsar's tick marks
            if (s.ending === 'cut' && i === erased && Math.floor(s.t * 12) % 2) Lab.disc(ctx, ex, ey, 2, 1, C.star);   // the scraper
        });
        if (erased < 14) Lab.disc(ctx, mx, my, 1.5, 1, C.star);
        ctx.fillStyle = C.light;
        FIGURES.forEach(({ x, y, rows }) => rows.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === '#') ctx.fillRect(cx + x + c * 2, cy + y + r * 2, 2, 2); })));
    }
    function hudLine(s, key) {
        if (key === 'name') return ['CORA MOON', C.warm];
        if (key === 'ship') return ['SHIP EXODUS-9', C.ui];
        const inHand = s.phase === 'choose' || s.ending === 'take' || (s.ending === 'cut' && s.endT <= CUT_DONE);
        if (key === 'disc') return [s.discGone ? 'DISC GONE' : inHand ? 'DISC IN HAND' : `DISC ${metres(dist(s, s.disc))} M`, C.ui];
        const left = metres(MAX_LINE - s.used);
        return [`LINE ${left} M LEFT`, left <= 3 ? C.danger : C.ui];
    }
    /** The suit's readout. A line the light has read is wiped out by light, column by column, and stays empty. */
    function drawHud(ctx, s) {
        const { x, y, pitch } = HUD;
        ctx.fillStyle = s.exposed && Math.floor(s.t * 6) % 2 ? C.danger : C.uiDim;     // the bracket flashes while you stand in a pass's path
        ctx.fillRect(x - 6, y - 2, 1, pitch * 4 + 12); ctx.fillRect(x - 6, y - 2, 3, 1); ctx.fillRect(x - 6, y + pitch * 4 + 9, 3, 1);
        HUD_LINES.forEach((key, i) => {
            const ly = y + i * pitch, [str, col] = hudLine(s, key), gone = s.lost.find(l => l.line === key), k = gone ? (s.t - gone.t) / 0.9 : 0;
            if (k >= 1) { Lab.text(ctx, '-'.repeat(str.length), x, ly, C.uiDim, 2); return; }   // the line is blank now
            Lab.text(ctx, str, x + 1, ly + 1, C.void, 2); Lab.text(ctx, str, x, ly, col, 2);
            if (!gone) return;
            ctx.fillStyle = C.light;
            for (let cx = 0, cover = Math.round(Lab.textWidth(str, 2) * Math.min(1, k * 1.4)); cx < cover; cx += 2) if ((cx * 7 + Math.floor(s.t * 30)) % 5) ctx.fillRect(x + cx - 1, ly - 1, 2, 12);
        });
        const ry = y + pitch * 4 + 2;
        Lab.text(ctx, 'RADIO', x, ry, C.uiDim);
        RADIO.forEach((id, k) => {
            const rx = x + 24 + k * 7;
            if (s.quiet[id] === undefined) Lab.text(ctx, name(id)[0], rx, ry, CREW[id].color);
            else for (let c = 0; c < 15; c++) if (Math.random() < 0.3) Lab.dot(ctx, rx + (c % 3), ry + Math.floor(c / 3), C.textDim);
        });
    }

    // ── sound (only with the page's sound on): breathing in the suit, a low swell with each pass, static when a voice drops ──
    function makeSound() {
        let ac = null, bus = null, hum = null;
        function stop() {
            if (!hum) return;
            hum.src.forEach(n => { try { n.stop(); } catch (e) { /* already stopped */ } });
            hum.out.forEach(n => { try { n.disconnect(); } catch (e) { /* already gone */ } });
            hum = null;
        }
        function ensure() {
            const a = Lab.audio.get();
            if (!a || !Lab.audio.master) { stop(); return null; }
            if (a === ac && Lab.audio.master === bus && hum) return a;
            stop(); ac = a; bus = Lab.audio.master;
            const gain = () => { const g = a.createGain(); g.gain.value = 0; g.connect(bus); return g; };
            const filter = (type, f, q) => { const b = a.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
            const breath = a.createBufferSource(), breathF = filter('bandpass', 700, 0.7), breathG = gain();
            breath.buffer = Lab.audio.noiseBuffer(); breath.loop = true; breath.connect(breathF).connect(breathG);
            const o1 = a.createOscillator(), o2 = a.createOscillator(), swellF = filter('lowpass', 320, 0.5), swellG = gain();
            o1.frequency.value = 55; o2.frequency.value = 82.41; o1.connect(swellF); o2.connect(swellF).connect(swellG);
            hum = { src: [breath, o1, o2], out: [breathG, swellG], breathG, breathF, swellG };
            hum.src.forEach(n => n.start());
            return a;
        }
        function frame(s) {
            const a = ensure();
            if (!a) return;
            const now = a.currentTime, p = s.breath % 1, inhale = p < 0.4 ? Math.sin((p / 0.4) * Math.PI) : 0;
            const exhale = p > 0.5 && p < 0.95 ? Math.sin(((p - 0.5) / 0.45) * Math.PI) : 0;
            const passing = s.passes.reduce((m, q) => Math.max(m, 1 - (frontOf(q, s.t) - SUN.r) / q.reach), 0);
            hum.breathG.gain.setTargetAtTime(s.homeT >= 0 ? 0 : 0.016 * inhale + 0.022 * exhale, now, 0.06);
            hum.breathF.frequency.setTargetAtTime(inhale > 0 ? 1100 : 600, now, 0.12);
            hum.swellG.gain.setTargetAtTime(0.05 * Math.max(s.warnK * 0.7, passing), now, 0.3);
        }
        /** 'static' when a voice drops off the radio; 'thunk', a soft low knock, when the light reads you or the line jerks. */
        function blip(kind) {
            const a = ensure();
            if (!a) return;
            const now = a.currentTime, isStatic = kind === 'static', len = isStatic ? 0.75 : 0.25, g = a.createGain(), f = a.createBiquadFilter();
            const src = isStatic ? a.createBufferSource() : a.createOscillator();
            if (isStatic) { src.buffer = Lab.audio.noiseBuffer(); f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = 0.8; }
            else { f.type = 'lowpass'; f.frequency.value = 400; src.frequency.setValueAtTime(110, now); src.frequency.exponentialRampToValueAtTime(48, now + 0.2); }
            g.gain.setValueAtTime(0.0001, now); g.gain.linearRampToValueAtTime(isStatic ? 0.03 : 0.05, now + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, now + len);
            src.connect(f).connect(g).connect(bus);
            src.start(now); src.stop(now + len + 0.05);
        }
        return { frame, blip, stop };
    }

    function fresh() {
        return {
            t: 0, phase: 'walk', x: START.x, y: START.y, vx: 0, vy: 0, face: 1, stun: 0, jolt: 0, puffs: [], breath: 0, hidden: false, exposed: false,
            debris: DEBRIS.map(d => placeDebris(d, 0)), wraps: [], used: dist(START, ANCHOR), tug: 0,
            passes: [], nextAt: PASS.first, nextLong: true, warnK: 0, lift: 0, reads: 0, lost: [], flash: -10,
            quiet: {}, queue: OPENING.slice(), lastT: -10, talker: null, talkT: -10, cues: {},
            disc: { ...DISC0 }, discGone: false, discFlash: -10, ending: null, endT: 0, homeT: -1, countAt: Infinity, countN: 0, countSaid: false, counted: false, scraped: 0,
        };
    }

    Lab.register({
        id: 'walk', badge: 'reworked',
        name: 'The walk out',
        short: 'Cross the light to the disc',
        verb: 'Drift on a tether from the ship to the gold disc. Move between sweeps of the light; stay in the shadow of a wreck while one passes.',
        serves: 'The ending, played. Each sweep that reaches the ship silences one of the crew. Back inside, A.U.R.A. counts: she counts you only if the light read you.',
        replaces: 'The six ending paragraphs.',
        controls: 'Arrows / WASD or hold the mouse to steer · 1 2 3 to choose at the disc · R to run again',
        mount(ctx, ui) {
            const V = buildView(ctx), snd = makeSound(), held = new Set(), canvas = ui.canvas;
            let s = null, aim = null, nudge = {};

            // ── the radio: one line at a time, at least GAP apart. Nobody speaks after the light has read them. ──
            const words = v => (typeof v === 'function' ? v(s) : v);
            const pickSpeaker = options => options.find(o => !o.who || s.quiet[o.who] === undefined);
            const say = item => { s.queue = [...s.queue, { at: s.t, ...item }].sort((a, b) => a.at - b.at); };
            function cue(key, options) {
                const o = s.cues[key] ? null : pickSpeaker(options);
                if (!o) return;
                s.cues = { ...s.cues, [key]: true };
                say({ ...o, at: s.t + 0.2 });
            }
            function show(speaker, line) { ui.say(speaker, line); s.lastT = s.t; }
            function radio() {
                while (s.queue.length && s.queue[0].at <= s.t && s.t - s.lastT >= GAP) {
                    const [item, ...rest] = s.queue;
                    s.queue = rest;
                    if ((item.who && s.quiet[item.who] !== undefined) || (!item.always && (s.phase !== 'walk' || s.t - item.at > 6))) continue;
                    if (item.note) show('', words(item.note));
                    else if (item.aura) show('A.U.R.A.', words(item.aura));
                    else { show(name(item.who), words(item.text)); s.talker = item.who; s.talkT = s.t; }
                    if (item.then) item.then();
                    return;
                }
            }

            // ── the light: a shimmer, then a pass; long passes reach the ship and read one person each. It holds still while you hold the disc. ──
            function schedule(dt) {
                s.lift = Math.max(0, s.lift - dt * 0.35);
                s.passes = s.passes.filter(p => frontOf(p, s.t) - PASS.band < p.reach);
                if (s.phase !== 'walk') { s.warnK = Math.max(0, s.warnK - dt * 2); return; }
                const ahead = s.nextAt - s.t;
                s.warnK = ahead < PASS.warn ? clamp01(1 - ahead / PASS.warn) * (s.nextLong ? 1 : 0.7) : 0;
                if (ahead > 0) return;
                s.passes = [...s.passes, { t0: s.nextAt, long: s.nextLong, reach: s.nextLong ? PASS.long : PASS.short, you: false, crew: false }];
                s.lift = s.nextLong ? 0.3 : 0.18; s.nextAt += PASS.every; s.nextLong = !s.nextLong; s.warnK = 0;
            }
            function lightOnShip() {
                s.passes.forEach((p, i) => {
                    const id = ORDER[Object.keys(s.quiet).length];
                    if (!p.long || p.crew || !id || frontOf(p, s.t) < dist(SUN, SPOT[id])) return;
                    s.passes = s.passes.map((q, j) => (j === i ? { ...q, crew: true } : q));
                    s.quiet = { ...s.quiet, [id]: s.t };
                    say({ at: s.t + 0.3, note: `${name(id)}'s channel goes to static.`, always: true });
                    REACT[id].forEach(r => say({ ...r, at: s.t + r.dt }));
                    snd.blip('static');
                });
            }
            /** Hidden: inside a shadow. Exposed: in the open with a pass coming (or passing) that is strong enough here to read you. */
            function senses() {
                const d = dist(s, SUN);
                s.hidden = s.phase === 'walk' && inShadow(V, d, binOf(s.x, s.y));
                s.exposed = s.phase === 'walk' && !s.hidden && ((s.warnK > 0.05 && reaches(s.nextLong ? PASS.long : PASS.short, d))
                    || s.passes.some(p => !p.you && frontOf(p, s.t) - PASS.band * 0.85 < d && reaches(p.reach, d)));
                if (s.phase !== 'walk' || s.hidden) return;
                s.passes.forEach((p, i) => {
                    const u = (frontOf(p, s.t) - d) / PASS.band;
                    if (p.you || u < 0 || u > 0.85 || !reaches(p.reach, d)) return;
                    s.passes = s.passes.map((q, j) => (j === i ? { ...q, you: true } : q));
                    beRead();
                });
            }
            function beRead() {
                const n = s.reads, o = n < READ_LINES.length ? pickSpeaker(READ_LINES[n]) : null;
                s.reads = n + 1; s.flash = s.t; s.exposed = false;
                if (n < HUD_LINES.length) s.lost = [...s.lost, { line: HUD_LINES[n], t: s.t }];
                if (o) say({ ...o, at: s.t + 0.9 });
                const ax = s.x - SUN.x, ay = s.y - SUN.y, ad = Math.hypot(ax, ay) || 1;         // shoved away from the light, out of control
                s.stun = STUN; s.vx = (ax / ad) * KNOCK + (Math.random() - 0.5) * 5; s.vy = (ay / ad) * KNOCK + (Math.random() - 0.5) * 5;
                snd.blip('thunk');
            }

            // ── moving, and the line ──
            function thrustDir() {
                const on = dir => held.has(dir) || (nudge[dir] || 0) > s.t || [...Lab.keys].some(k => DIRS[k] === dir);
                let ix = (on('right') ? 1 : 0) - (on('left') ? 1 : 0), iy = (on('down') ? 1 : 0) - (on('up') ? 1 : 0);
                if (!ix && !iy && aim && (aim.held || aim.until > s.t) && Math.hypot(aim.x - s.x, aim.y - s.y) > 3) { ix = aim.x - s.x; iy = aim.y - s.y; }
                const m = Math.hypot(ix, iy);
                return m ? { x: ix / m, y: iy / m } : null;
            }
            function move(dt) {
                const prev = { x: s.x, y: s.y }, dir = s.stun > 0 ? null : thrustDir();
                let vx = s.vx, vy = s.vy;
                if (dir) { vx += dir.x * ACC * dt; vy += dir.y * ACC * dt; } else if (s.stun <= 0) { const k = Math.exp(-DAMP * dt); vx *= k; vy *= k; }
                const sp = Math.hypot(vx, vy), top = s.stun > 0 ? KNOCK + 4 : TOP;
                if (sp > top) { vx *= top / sp; vy *= top / sp; }
                if (dir && Math.random() < 0.6) s.puffs = [...s.puffs, { x: s.x - dir.x * 4, y: s.y - dir.y * 4, vx: vx - dir.x * 22 + (Math.random() - 0.5) * 8, vy: vy - dir.y * 22 + (Math.random() - 0.5) * 8, life: 0.45 }];
                if (dir && Math.abs(dir.x) > 0.2) s.face = Math.sign(dir.x);
                s.vx = vx; s.vy = vy; s.x += vx * dt; s.y += vy * dt;
                collide();
                updateTether(prev);
                tug(dt, enforceLine());
            }
            function collide() {
                s.debris.forEach(p => p.circles.forEach(c => {
                    const dx = s.x - c.x, dy = s.y - c.y, d = Math.hypot(dx, dy), min = c.r + 3;
                    if (d >= min || d === 0) return;
                    const nx = dx / d, ny = dy / d, vn = s.vx * nx + s.vy * ny;
                    s.x = c.x + nx * min; s.y = c.y + ny * min;
                    if (vn < 0) { s.vx -= 1.4 * vn * nx; s.vy -= 1.4 * vn * ny; }
                }));
                const ds = dist(s, SUN), keep = SUN.r + 3, edge = L.cx + Math.max(6, L.halfWidth(Math.round(s.y))) + 4;
                if (ds < keep) { s.x = SUN.x + ((s.x - SUN.x) / ds) * keep; s.y = SUN.y + ((s.y - SUN.y) / ds) * keep; }
                if (s.x < edge) { s.x = edge; s.vx = Math.abs(s.vx) * 0.3; }
                if (s.x > W - 6) { s.x = W - 6; s.vx = -Math.abs(s.vx) * 0.3; }
                if (s.y < 8 || s.y > H - 8) { s.y = Lab.clamp(s.y, 8, H - 8); s.vy = -s.vy * 0.3; }
            }
            function updateTether(prev) {
                for (let g = 0; g < 4 && s.wraps.length; g++) {                           // let go where the line has swung back past
                    const pts = chainPoints(s), n = pts.length, A = pts[n - 3], P = pts[n - 2], S = pts[n - 1];
                    if (Math.sign(cross(P.x - A.x, P.y - A.y, S.x - P.x, S.y - P.y)) === s.wraps[s.wraps.length - 1].turn) break;
                    s.wraps = s.wraps.slice(0, -1);
                }
                for (let g = 0; g < 3; g++) {                                             // catch on whatever the last stretch cuts through
                    const pts = chainPoints(s), w = snagPoint(s, pts[pts.length - 2], prev);
                    if (!w) break;
                    s.wraps = [...s.wraps, w];
                    snd.blip('thunk');
                }
            }
            function enforceLine() {
                const pts = chainPoints(s);
                let fixed = 0;
                for (let i = 1; i < pts.length - 1; i++) fixed += dist(pts[i - 1], pts[i]);
                const P = pts[pts.length - 2], room = MAX_LINE - fixed;
                if (room < 8 && s.wraps.length) {                                         // drifting debris dragged it tight: it slips off
                    s.wraps = s.wraps.slice(0, -1); s.jolt = 0.3;
                    cue('slip', SLIP); snd.blip('thunk');
                    return enforceLine();
                }
                const dx = s.x - P.x, dy = s.y - P.y, d = Math.hypot(dx, dy);
                if (d > room) {                                                           // the line runs out: stop with a jolt
                    const nx = dx / d, ny = dy / d, out = s.vx * nx + s.vy * ny;
                    s.x = P.x + nx * room; s.y = P.y + ny * room;
                    if (out > 0) { s.vx -= 1.3 * out * nx; s.vy -= 1.3 * out * ny; }
                    if (out > 3) { s.jolt = 0.35; snd.blip('thunk'); if (s.wraps.length) cue('snag', SNAG); else cue('taut', TAUT); }   // say so when it matters
                }
                s.used = fixed + Math.min(d, room);
                return d > room - 1.5;
            }
            /** Pulling against a caught, taut line long enough tears it free of the last thing it caught on. */
            function tug(dt, taut) {
                s.tug = taut && s.wraps.length && thrustDir() ? s.tug + dt : Math.max(0, s.tug - dt);
                if (s.tug > 0.3) cue('snag', SNAG);
                if (s.tug < TUG) return;
                s.tug = 0; s.wraps = s.wraps.slice(0, -1); s.jolt = 0.4;
                cue('slip', SLIP); snd.blip('thunk');
            }

            // ── the disc, the choice, the way back and the count ──
            function moveDisc(dt) {
                if (s.discGone || s.ending === 'take' || s.phase === 'choose') return;
                const dx = SUN.x - s.disc.x, dy = SUN.y - s.disc.y, d = Math.hypot(dx, dy);
                const falling = s.ending === 'leave' || (s.ending === 'cut' && s.endT > CUT_DONE), inward = falling ? 16 : 0.14, along = falling ? 0 : 0.12;
                s.disc = { x: s.disc.x + ((dx / d) * inward - (dy / d) * along) * dt, y: s.disc.y + ((dy / d) * inward + (dx / d) * along) * dt };
                if (d >= SUN.r * 0.97) return;
                s.discGone = true; s.discFlash = s.t; s.lift = 0.5;
                if (s.phase === 'walk') finish('lost');
            }
            function catchDisc() {
                s.phase = 'choose'; s.vx = 0; s.vy = 0; s.stun = 0; aim = null; held.clear(); nudge = {};
                s.passes = s.passes.map(p => ({ ...p, reach: Math.min(p.reach, frontOf(p, s.t)), crew: true }));   // the light stops where it is
                show('', CAUGHT);
                ui.buttons(Object.entries(CHOICES).map(([key, kind]) => ({ label: `${key} · ${ENDINGS[kind].label}`, onClick: () => choose(kind) })));
            }
            function choose(kind) { if (s.phase === 'choose') finish(kind); }
            function finish(kind) {
                s.phase = 'end'; s.ending = kind; s.endT = 0; s.vx = 0; s.vy = 0; s.stun = 0;
                ui.buttons([]);
                show('', ENDINGS[kind].note);
            }
            function playEnding(dt) {
                s.endT += dt;
                if (s.ending === 'cut') s.scraped = Lab.clamp(Math.floor((s.endT - CUT.start) / CUT.each), 0, 14);
                const wait = { cut: CUT_DONE + 0.6, take: 1.0, leave: 2.4, lost: 1.8 }[s.ending];
                if (s.homeT < 0) { if (s.endT >= wait) reel(dt, s.endT - wait); return; }
                const total = s.reads > 0 ? 5 : 4, k = Math.floor((s.t - s.countAt) / BEAT) + 1;   // A.U.R.A. counts, one person a beat
                s.countN = Lab.clamp(k, 0, total);
                if (k <= total || s.countSaid) return;
                s.countSaid = true;
                say({ at: s.t, aura: total === 5 ? COUNT.five : COUNT.four, always: true, then: () => {
                    s.counted = true;
                    ui.buttons([{ label: 'Run it again', primary: true, onClick: () => { if (s.counted) restart(); } }]);
                } });
            }
            /** Pull yourself back along the line, around every point it caught on, to the airlock. */
            function reel(dt, since) {
                const pts = chainPoints(s), target = pts[pts.length - 2], dx = target.x - s.x, dy = target.y - s.y, d = Math.hypot(dx, dy);
                const stepLen = Math.min(REEL, 8 + since * 40) * dt;
                if (d > stepLen + 0.5) { s.x += (dx / d) * stepLen; s.y += (dy / d) * stepLen; if (Math.abs(dx) > 1) s.face = Math.sign(dx); return; }
                s.x = target.x; s.y = target.y;
                if (s.wraps.length) { s.wraps = s.wraps.slice(0, -1); return; }
                s.homeT = s.t;
                const waiting = ORDER.find(id => s.quiet[id] === undefined);                 // whoever the light has not read meets you at the door
                if (waiting) say({ at: s.t + 0.9, who: waiting, text: HOME[waiting], always: true });
                s.countAt = s.t + (waiting ? 3.4 : 1.4);
            }

            function step(dt) {
                s.t += dt;
                s.debris = DEBRIS.map(d => placeDebris(d, s.t));
                buildShadows(V, s.debris);
                schedule(dt);
                s.jolt = Math.max(0, s.jolt - dt); s.stun = Math.max(0, s.stun - dt);
                s.breath += dt * (s.stun > 0 || s.warnK > 0.3 ? 0.42 : 0.27);
                s.puffs = s.puffs.map(p => ({ ...p, x: p.x + p.vx * dt, y: p.y + p.vy * dt, life: p.life - dt })).filter(p => p.life > 0);
                if (s.phase === 'walk') {
                    move(dt);
                    if (!s.discGone && dist(s, s.disc) < CATCH) catchDisc();
                    else if (dist(s.disc, SUN) < SUN.r + 7) cue('nearLost', NEAR_LOST);
                } else if (s.phase === 'choose') {
                    s.x = s.disc.x - 6; s.y = s.disc.y + 1;
                    updateTether({ x: s.x, y: s.y });
                    s.used = lineLength(s);
                } else playEnding(dt);
                moveDisc(dt);
                senses();
                lightOnShip();
                radio();
                snd.frame(s);
            }
            function render() {
                composeField(V, s);
                drawDebrisInto(V, s);
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.putImageData(V.img, 0, 0);
                drawTransits(ctx, s.t);
                drawCoin(ctx, s);
                drawShip(ctx, s);
                const outside = s.homeT < 0;
                if (outside) drawTether(ctx, s);
                s.puffs.forEach(p => Lab.dot(ctx, p.x, p.y, p.life > 0.22 ? C.textDim : C.mist));
                if (outside) drawSuit(ctx, s);
                if (s.phase === 'choose' || (s.ending === 'cut' && s.endT < CUT_DONE)) drawInset(ctx, s);
                if (outside) drawHud(ctx, s);                                             // the suit's readout goes off once you are inside
                const k = 1 - (s.t - s.flash) / 1.3;                                      // the bleach when the light reads you
                if (k > 0) { ctx.globalAlpha = 0.92 * k * k; ctx.fillStyle = C.light; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
            }
            function restart() {
                s = fresh(); held.clear(); aim = null; nudge = {};
                buildShadows(V, s.debris);
                ui.clear();
                ui.buttons(['left', 'up', 'down', 'right'].map(dir => ({
                    label: { left: '←', up: '↑', down: '↓', right: '→' }[dir], hold: true,
                    onDown: () => { held.add(dir); nudge = { ...nudge, [dir]: s.t + NUDGE }; }, onUp: () => held.delete(dir),
                })));
                render();
            }

            canvas.onpointerdown = e => {
                if (s.phase !== 'walk') return;
                aim = { ...ui.toPixel(e), held: true, until: s.t + NUDGE };
                try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointers cannot be captured */ }
            };
            canvas.onpointermove = e => { if (aim && aim.held) aim = { ...aim, ...ui.toPixel(e) }; };
            canvas.onpointerup = canvas.onpointercancel = () => { if (aim) aim = { ...aim, held: false }; };
            Lab.onKey(k => {
                if (s.phase === 'walk' && DIRS[k]) nudge = { ...nudge, [DIRS[k]]: s.t + NUDGE };
                else if (s.phase === 'choose' && CHOICES[k]) choose(CHOICES[k]);
                else if (s.counted && (k === 'r' || k === 'Enter' || k === ' ')) restart();
            });

            restart();
            Lab.loop(dt => { step(dt); render(); }, 30);
            return () => { snd.stop(); canvas.onpointercancel = null; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; };
        },
    });
})();
