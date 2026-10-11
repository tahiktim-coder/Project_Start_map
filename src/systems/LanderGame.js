/* LanderGame — you fly the away team down yourself (Lunar Lander), in the travel view's look (2026-10-11; before that,
   the ship's green phosphor). The craft is our shuttle: a small copy of our Lander's hull, nose up on four legs, with a
   thruster on each front leg, painted by the travel view's recipe (MiniPaint.hull). The rules below did not change.
   A small lander with two thrusters and one tank of fuel, a planet's gravity, and ground that is
   different on every kind of world: jagged rock, ice spikes, smooth dunes, lava pools you must not
   touch, islands in an ocean, or no ground at all over a gas giant — just a platform in the wind.
   Nobody built a pad on an unexplored world. You look for LEVEL ground: every surface has a few natural
   flat stretches (a rock shelf, a dune crest, a frozen ledge), each wider than the lander; the rest rolls.
     ← / A  push left      → / D  push right      both (or Space)  brake hardest
   Slow, on level ground                → SOFT landing: the team steps out fresh (the trip down there is safer)
   A bit fast, or the ground a bit uneven → ROUGH landing: nothing changes
   Too fast, on a slope, in lava or water → CRASH: someone is hurt before they even step outside
   "Let A.U.R.A. land" hands her the stick: she steers to the nearest level stretch and puts it down there.
   After a landing the team steps out in suits and walks to the site while the view closes in (LanderCrew.js; the close-up
   is painted again, sharper, while the camera moves); a click or Enter skips the wait. The place is LanderScene.js, the
   site LanderSites.js. The physics runs on a 320 x 180 grid; the picture is 720 x 405 art pixels (2.25 per physics px).
   The frame is MiniHost's (minigames.css), so the landing and the minigames are one family: one quiet header line, the
   picture, the six readouts as one small mono line under it, the status (a quiet note) or the result (its name in its
   colour over the words) as the voice line, the hint (it fades after the first control input), and the three controls
   as plain words in sentence case (○ hold, ● held, › press).
   play(app, planet, team) → Promise<{ grade: 'soft'|'rough'|'crash', auto: boolean }> */

(function () {
    'use strict';
    const W = 320, H = 180, LANDER_HALF = 6, LANDER_TALL = 9, PAD_WIDTH = 42; // PAD_WIDTH: the gas-giant platform deck, the one built pad left
    // Tuned with a headless autopilot (scratchpad lander_sim.js): one thruster alone must out-lift 1 G, or steering costs you the landing
    const BASE_GRAVITY = 9, GRAVITY_CURVE = 0.5, THRUST_UP_ONE = 17, THRUST_SIDE = 16, THRUST_UP_BOTH = 34; // px/s²
    const FUEL_FULL = 100, FUEL_PER_THRUSTER = 6.5;                                         // units, units/s
    const SOFT = { down: 22, side: 11 }, ROUGH = { down: 42, side: 22 };                    // touchdown speed limits, px/s
    const LEVEL_TILT = 3, ROUGH_TILT = 9;   // height difference (px) under the lander's feet: up to LEVEL_TILT reads LEVEL, up to ROUGH_TILT is landable rough, more is a slope you cannot land on
    const LEVEL_COUNT_MIN = 2, LEVEL_COUNT_MAX = 3, LEVEL_WIDTH_MIN = 26, LEVEL_WIDTH_MAX = 36, LEVEL_BLEND = 8, LEVEL_MARGIN = 28; // natural flat stretches carved into every world, px
    const LAVA_LEVEL = 146, SEA_LEVEL = 138, SHORE_GAP = 2; // low ground floods to here (y grows downward); a shelf always sits SHORE_GAP above the flood line
    // A.U.R.A.'s hand: wanted speeds (px/s) by height, how tightly she holds the drift, and the height she keeps while still sliding over to level ground
    const AUTO = { cruiseDown: 26, approachDown: 14, settleDown: 8, hoverDown: 2, climbUp: -8, highAlt: 45, lowAlt: 14, glideAlt: 24, climbGap: 8, sideGain: 0.45, sideMax: 20, sideBand: 3, sideBandMin: 1, sideHard: 7, minRoom: 4, reach: 3 };
    const RESULT_HOLD_MS = 1700, MAX_STEP = 0.033, SKIP_AFTER_MS = 500, SKIP_KEYS = ['Enter', 'Escape'];
    const INK = '#06070a', BONE = '#c4d0c4', AMBER = '#d9a24a', RED = '#d85a4e', GREEN = '#74d99a', DIM = '#2f5a48';
    const LOW_FUEL = 25, LOW_FUEL_BEEP_MS = 900, THRUST_SOUND_MS = 120;
    const DOCKED_TEXT = 'Docked under the ship. Touch a control to let go.', AUTO_TEXT = 'A.U.R.A. has the stick. She is flying to the marked spot.';
    const MARK_BLINK_MS = 420, MARK_ROOM = 4;                                                // the marked spot's beacons, and how much room a stretch needs to be marked
    const GRADES = {
        soft: { label: 'SOFT LANDING', effect: 'the team steps out fresh — the trip is safer', color: GREEN, riskMod: -8 },
        rough: { label: 'ROUGH LANDING', effect: 'down in one piece', color: AMBER, riskMod: 0 },
        crash: { label: 'CRASH', effect: 'someone is hurt before the hatch even opens', color: RED, riskMod: 10 },
    };
    const OFF_MARK = { label: 'OFF THE MARK', effect: 'down safely, but a long walk from the marked spot', color: AMBER };
    // amp = hill height, jag = per-pixel roughness, spikes = sharp ridges, wind = sideways push, pools = lava, platform = no ground
    const GROUND = {
        rock: { amp: 26, jag: 4, spikes: 0, wind: 0 }, ice: { amp: 20, jag: 2, spikes: 1, wind: 2 },
        dunes: { amp: 13, jag: 1.5, spikes: 0, wind: 3 }, lava: { amp: 22, jag: 3, spikes: 0, wind: 0, pools: true },
        green: { amp: 11, jag: 2, spikes: 0, wind: 1 }, sea: { amp: 14, jag: 1.5, spikes: 0, wind: 3, sea: true },
        // gentle worlds still get sand ripples / pebbles / shingle (jag), so only their true shelves read LEVEL and the rest reads as a landable slope
        haze: { amp: 15, jag: 2, spikes: 0, wind: 4 }, sky: { amp: 0, jag: 0, spikes: 0, wind: 5, platform: true },
    };
    const GROUND_OF = {
        ICE_WORLD: 'ice', FROZEN_OCEAN: 'ice', CRYSTALLINE: 'ice', MIRROR: 'ice', DESERT: 'dunes', SULFUR: 'dunes',
        VOLCANIC: 'lava', SHATTERED: 'lava', TIDALLY_LOCKED: 'lava', HOLLOW: 'lava', VITAL: 'green', EDEN: 'green',
        TERRAFORMED: 'green', FUNGAL: 'green', SYMBIOTE_WORLD: 'green', OCEANIC: 'sea', SINGING: 'sea',
        TOXIC: 'haze', BIO_MASS: 'haze', RADIATION_BELT: 'haze', GHOST_WORLD: 'haze', GAS_GIANT: 'sky', STORM_WORLD: 'sky',
    };
    const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const sfx = (name, ...args) => { const audio = window.AudioSystem; if (audio && typeof audio[name] === 'function') audio[name](...args); }; // silent when muted
    const rgb = c => `rgb(${c.join(',')})`;
    const clampX = x => Math.max(0, Math.min(W - 1, x));
    const nextFrame = cb => (document.hidden ? setTimeout(() => cb(performance.now()), 16) : requestAnimationFrame(cb)); // rAF sleeps in a hidden tab

    function seeded(id) {
        let s = 11;
        String(id || 'x').split('').forEach(ch => { s = ((s * 31) + ch.charCodeAt(0)) >>> 0; });
        return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    }

    /** Ground radar: the height difference under the whole footprint (both feet and everything between) with the lander centred on x. */
    function tiltAt(g, x) {
        const cx = Math.round(x);
        let lo = Infinity, hi = -Infinity;
        for (let k = cx - LANDER_HALF; k <= cx + LANDER_HALF; k++) { const h = g.heights[clampX(k)]; if (h < lo) lo = h; if (h > hi) hi = h; }
        return hi - lo;
    }

    /** Carve a few genuinely level shelves into the hills, ramped into the slope either side so they read as ledges, not pads. */
    function carveShelves(heights, rand, kind) {
        const count = LEVEL_COUNT_MIN + Math.floor(rand() * (LEVEL_COUNT_MAX - LEVEL_COUNT_MIN + 1)), band = (W - 2 * LEVEL_MARGIN) / count;
        const floodLine = kind.pools ? LAVA_LEVEL : kind.sea ? SEA_LEVEL : Infinity;
        for (let k = 0; k < count; k++) {                                     // one shelf per band of the screen, so they never overlap
            const width = LEVEL_WIDTH_MIN + Math.floor(rand() * (LEVEL_WIDTH_MAX - LEVEL_WIDTH_MIN + 1));
            const x0 = Math.round(LEVEL_MARGIN + band * k + rand() * (band - width)), x1 = x0 + width - 1;
            let sum = 0;
            for (let x = x0; x <= x1; x++) sum += heights[x];
            const y = Math.min(sum / width, floodLine - SHORE_GAP);           // the hill's own mean height, kept above lava or water
            for (let x = x0; x <= x1; x++) heights[x] = y;
            for (let d = 1; d <= LEVEL_BLEND; d++) {                          // no cliff at either end: the neighbours lean toward the shelf
                const keep = d / (LEVEL_BLEND + 1);
                [x0 - d, x1 + d].forEach(x => { if (x >= 0 && x < W) heights[x] = y + (heights[x] - y) * keep; });
            }
        }
    }

    /** Every run of centre positions where the radar reads LEVEL on dry ground: what the guide goes green over and what A.U.R.A. steers for. */
    function findLevelStretches(g) {
        const runs = [];
        let start = -1;
        const close = end => { runs.push({ c0: start, c1: end, cx: (start + end) / 2, room: (end - start) / 2, x0: start - LANDER_HALF, x1: end + LANDER_HALF, y: g.heights[start] }); start = -1; };
        for (let x = LANDER_HALF + 1; x <= W - LANDER_HALF - 2; x++) {
            const isLevel = g.heights[x] <= H && !g.hot[x] && tiltAt(g, x) <= LEVEL_TILT;
            if (isLevel && start < 0) start = x;
            else if (!isLevel && start >= 0) close(x - 1);
        }
        if (start >= 0) close(W - LANDER_HALF - 2);
        return runs;
    }

    /** Height map (y of the ground at each x), hazards and the level stretches — fixed per planet, shaped by its type. Gas giants get a platform deck instead of ground. */
    function buildGround(planet) {
        const kindName = GROUND_OF[planet.type] || 'rock', kind = GROUND[kindName], rand = seeded(planet.id);
        const phases = [rand() * 6.28, rand() * 6.28, rand() * 6.28], heights = new Float32Array(W), hot = new Uint8Array(W);
        for (let x = 0; x < W; x++) {
            let y = 150 - kind.amp * (0.5 + 0.5 * Math.sin(x * 0.021 + phases[0])) - kind.amp * 0.4 * Math.sin(x * 0.057 + phases[1]);
            if (kind.spikes) y -= 12 * Math.pow(Math.abs(Math.sin(x * 0.11 + phases[2])), 6);
            heights[x] = kind.platform ? H + 40 : Math.min(H - 6, y + (rand() - 0.5) * kind.jag * 2);
        }
        const g = { kind, kindName, heights, hot, level: [], padX: -1, padY: H + 40, wind: 0 };
        if (kind.platform) {                                                  // a rig in the wind: the only built pad in the game
            g.padX = 50 + Math.floor(rand() * (W - 100 - PAD_WIDTH)); g.padY = 128;
            for (let x = g.padX; x < g.padX + PAD_WIDTH; x++) heights[x] = g.padY;
        } else carveShelves(heights, rand, kind);
        if (kind.pools || kind.sea) {                                         // low ground fills with lava (deadly) or water (deadly too: the lander does not float)
            const level = kind.sea ? SEA_LEVEL : LAVA_LEVEL;
            for (let x = 0; x < W; x++) if (heights[x] > level) { heights[x] = level; hot[x] = 1; }
        }
        g.level = findLevelStretches(g);
        g.wind = (rand() < 0.5 ? -1 : 1) * kind.wind;
        g.mark = pickMark(g, rand);
        return g;
    }

    /** The spot A.U.R.A. marks: a level stretch with room, chosen away from the middle so the drop needs real steering. */
    function pickMark(g, rand) {
        if (g.kind.platform) return null;                                     // on a rig the deck is the mark
        const roomy = g.level.filter(l => l.room >= MARK_ROOM), pool = roomy.length ? roomy : g.level;
        if (!pool.length) return null;
        const edgeFirst = pool.slice().sort((a, b) => Math.abs(b.cx - W / 2) - Math.abs(a.cx - W / 2));
        return edgeFirst[Math.floor(rand() * Math.min(2, edgeFirst.length))];
    }
    const isOnMark = (g, x) => !g.mark || (x >= g.mark.c0 && x <= g.mark.c1);

    /** Where the drop starts: the side of the screen with the longer flight to level ground, so there is always some steering to do. */
    function startState(g) {
        const leftX = 36, rightX = W - 36, nearest = x => (g.mark ? [g.mark] : g.level).reduce((best, l) => Math.min(best, Math.abs(l.cx - x)), Infinity);
        const startsLeft = nearest(leftX) >= nearest(rightX);
        return { x: startsLeft ? leftX : rightX, y: 10, vx: startsLeft ? 8 : -8, vy: 0, fuel: FUEL_FULL, altitude: 100, keys: { left: false, right: false }, grade: null, endedAt: 0 };
    }

    function palette(planet) {
        const recipe = window.DitherRecipes && window.DitherRecipes.TYPES[planet.type], ramp = recipe && recipe.ramp;
        return ramp ? { fill: rgb(ramp[1]), edge: rgb(ramp[Math.min(ramp.length - 1, 3)]) } : { fill: '#10201a', edge: DIM };
    }

    /** What the radar says about the spot straight below: LEVEL, SLOPE (amber = landable rough, red = too steep), LAVA / WATER, or NONE over open sky. */
    function groundReading(s, g) {
        const x = clampX(Math.round(s.x));
        if (g.heights[x] > H) return { word: 'NONE', color: RED };
        if (g.hot[x]) return { word: g.kind.sea ? 'WATER' : 'LAVA', color: RED };
        const tilt = tiltAt(g, x);
        if (tilt <= LEVEL_TILT) return { word: 'LEVEL', color: GREEN };
        return { word: 'SLOPE', color: tilt <= ROUGH_TILT ? AMBER : RED };
    }

    /** How a touchdown in this state goes: speed and drift as always, and the ground under both feet must be level for SOFT. */
    function gradeLanding(s, g) {
        const x = Math.round(s.x), within = limit => s.vy <= limit.down && Math.abs(s.vx) <= limit.side;
        if (g.kind.platform) {                                                // open sky: only the deck counts, and the whole lander must be on it
            const isOnPad = x - LANDER_HALF >= g.padX && x + LANDER_HALF <= g.padX + PAD_WIDTH;
            return !isOnPad ? 'crash' : within(SOFT) ? 'soft' : within(ROUGH) ? 'rough' : 'crash';
        }
        const tilt = tiltAt(g, x);
        if (g.hot[clampX(x)] || tilt > ROUGH_TILT) return 'crash';
        if (tilt <= LEVEL_TILT && within(SOFT)) return 'soft';
        return within(ROUGH) ? 'rough' : 'crash';
    }

    function step(s, g, gravity, dt) {
        const isLeft = s.keys.left && s.fuel > 0, isRight = s.keys.right && s.fuel > 0;
        let ax = g.wind, ay = gravity;
        if (isLeft && isRight) ay -= THRUST_UP_BOTH;
        else if (isLeft) { ax -= THRUST_SIDE; ay -= THRUST_UP_ONE; }
        else if (isRight) { ax += THRUST_SIDE; ay -= THRUST_UP_ONE; }
        s.fuel = Math.max(0, s.fuel - FUEL_PER_THRUSTER * ((isLeft ? 1 : 0) + (isRight ? 1 : 0)) * dt);
        s.vx += ax * dt; s.vy += ay * dt;
        s.x += s.vx * dt; s.y += s.vy * dt;
        if (s.x < LANDER_HALF + 1) { s.x = LANDER_HALF + 1; s.vx = 0; }
        if (s.x > W - LANDER_HALF - 2) { s.x = W - LANDER_HALF - 2; s.vx = 0; }
        if (s.y < 2) { s.y = 2; s.vy = Math.max(0, s.vy); }
        let ground = H + 100;
        for (let x = Math.round(s.x - LANDER_HALF); x <= Math.round(s.x + LANDER_HALF); x++) ground = Math.min(ground, g.heights[clampX(x)]);
        const feet = s.y + LANDER_TALL;
        s.altitude = (g.kind.platform && ground > H ? g.padY : ground) - feet; // over open sky, read height against the platform's level
        if (g.kind.platform && s.y > H + 10) return 'crash';                   // fell past the platform into the clouds
        return ground - feet <= 0 ? gradeLanding(s, g) : null;
    }

    /** The level stretch A.U.R.A. goes for: the nearest one with room to be a little off-centre (any one at all if none is that wide). */
    function pickLevelTarget(s, g) {
        const canReachMark = g.mark && (s.altitude >= AUTO.highAlt || Math.abs(g.mark.cx - s.x) <= Math.max(0, s.altitude) * AUTO.reach); // low and far: land safe off the mark instead
        if (canReachMark) return g.mark;
        const roomy = g.level.filter(l => l.room >= AUTO.minRoom), pool = roomy.length ? roomy : g.level;
        return pool.reduce((best, l) => (!best || Math.abs(l.cx - s.x) < Math.abs(best.cx - s.x) ? l : best), null);
    }

    /** A.U.R.A.'s hand on the stick: glide toward the stretch so she arrives over it low (no hovering: it burns the tank), climb if she is low and still off it, then come down in stages and settle. Sets s.keys each step. */
    function autopilot(s, g) {
        if (!s.autoTarget) s.autoTarget = pickLevelTarget(s, g);
        const target = s.autoTarget;
        if (!target) { s.keys.left = s.keys.right = s.altitude < AUTO.highAlt; return; } // nothing level anywhere: just brake the fall
        const dx = target.cx - s.x, isOff = Math.abs(dx) > Math.max(AUTO.sideBand, target.room - 1), isFarOff = Math.abs(dx) > target.room + AUTO.climbGap;
        const wantVx = Math.max(-AUTO.sideMax, Math.min(AUTO.sideMax, dx * AUTO.sideGain));
        const band = isOff ? Math.max(AUTO.sideBandMin, Math.min(AUTO.sideBand, Math.abs(wantVx) / 2)) : AUTO.sideBand; // a small offset still gets corrected, not sat in
        const secondsAcross = Math.max(0.5, Math.abs(dx) / AUTO.sideMax), glide = (s.altitude - AUTO.glideAlt) / secondsAcross; // sink rate that reaches glide height right over the stretch
        const staged = s.altitude > AUTO.highAlt ? AUTO.cruiseDown : s.altitude > AUTO.lowAlt ? AUTO.approachDown : AUTO.settleDown;
        const wantVy = !isOff ? staged : isFarOff && s.altitude < AUTO.lowAlt ? AUTO.climbUp : Math.max(AUTO.hoverDown, Math.min(AUTO.cruiseDown, glide));
        let left = false, right = false;
        if (s.vx > wantVx + band) left = true; else if (s.vx < wantVx - band) right = true;
        if (s.vy > wantVy) { left = right = true; if (s.vx > wantVx + AUTO.sideHard) right = false; if (s.vx < wantVx - AUTO.sideHard) left = false; }
        s.keys.left = left; s.keys.right = right;
    }

    // ── the picture: our shuttle (a small copy of our Lander, nose up on four legs), in art pixels through a view ──
    const Scene = () => window.LanderScene, U = () => window.LanderScene && window.LanderScene.util;
    const SH = { LEN: 13, BELL: 6.6, PODS: 3.5, POD_Y: 7, PAD: 5.9, FEET: LANDER_TALL, LAMP_Y: -2.7 };   // world px from (s.x, s.y): length, bell mouth, the two thrusters, pads, feet
    SH.HT = SH.LEN * 0.31;
    const COLOR = { soft: '#7fd3a0', rough: '#f0a24a', crash: '#e2574c' };                        // the lamp, the guide and the readouts: level, careful, no
    const LEVEL_INK = '#7fd3a0', CAUTION_INK = '#f0a24a', DANGER_INK = '#e2574c', QUIET_INK = '#c9d1d6';
    const shuttles = new Map();

    /** The shuttle, painted once per density and light side: hull by the travel view's recipe, legs, pads and the two thrusters. */
    function shuttleSprite(d, Ls) {
        const key = d + ':' + Ls;
        if (shuttles.has(key)) return shuttles.get(key);
        const N = window.MiniPaint, RP = N.RP, half = Math.ceil(7.5 * d), top = Math.ceil((SH.LEN - SH.BELL + 1) * d), bottom = Math.ceil((SH.FEET + 0.5) * d);
        const p = N.painter(half * 2, top + bottom, false), ox = half, oy = top;                              // (ox, oy): the art pixel of (s.x, s.y)
        const at = (x, y) => [ox + x * d, oy + y * d];
        const leg = (x0, y0, x1, y1, w, v) => { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * d * 1.5); for (let k = 0; k <= n; k++) { const t = k / n, [ax, ay] = at(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t); for (let i = 0; i < Math.max(1, w * d); i++) p.solid(ax + i - w * d / 2, ay, RP.HULL, v); } };
        [-1, 1].forEach(side => leg(side * SH.HT * 0.22, SH.BELL - 1.6, side * (SH.PAD - 2.8), SH.FEET - 0.3, 0.45, 0.2));            // the two legs behind
        N.hull(p, { x: ox, y: oy + SH.BELL * d, len: SH.LEN * d, ht: SH.HT * d, angle: Math.PI / 2, anchor: 1, mirror: Ls < 0, seed: 5, sunDir: [Ls, -0.45], sun: 0.45 }, N.shapeL);
        [-1, 1].forEach(side => {
            const lit = side === Ls ? 0.62 : 0.34;
            leg(side * SH.HT * 0.46, SH.BELL - 2.2, side * SH.PAD, SH.FEET - 0.3, 0.6, lit);                                     // the two legs in front
            const [px, py] = at(side * SH.PAD - 1, SH.FEET - 0.7); for (let y = 0; y < Math.max(1, Math.round(0.7 * d)); y++) for (let x = 0; x < 2 * d; x++) p.solid(px + x, py + y, RP.HULL, y === 0 ? lit + 0.15 : lit - 0.1);   // the pads
            const [bx, by] = at(side * SH.PODS, SH.POD_Y - 1.4);                                                                    // a thruster on each leg: a small bell
            for (let y = 0; y < 1.4 * d; y++) { const w = (0.5 + 0.5 * y / (1.4 * d)) * d; for (let x = -w / 2; x < w / 2; x++) p.solid(bx + x, by + y, RP.HULL, (x * Ls > 0 ? 0.5 : 0.28) + (y > 1.4 * d - 1.5 ? -0.08 : 0)); }
        });
        const S = { canvas: p.canvas(), ox, oy };
        shuttles.set(key, S);
        return S;
    }

    /** The shuttle at (x, y) world (top of the old 13 × 9 box), its lamp telling how touching down now would go. */
    function drawShuttle(ctx, V, x, y, Ls, lamp, alpha) {
        const S = shuttleSprite(V.d, Ls), ax = Math.round((x - V.ox) * V.d) - S.ox, ay = Math.round((y - V.oy) * V.d) - S.oy;
        if (alpha != null) { ctx.save(); ctx.globalAlpha = alpha; ctx.translate(0, 2 * (ay + S.oy + SH.FEET * V.d)); ctx.scale(1, -1); ctx.drawImage(S.canvas, ax, ay); ctx.restore(); return; }
        ctx.drawImage(S.canvas, ax, ay);
        if (!lamp) return;
        const N = window.MiniPaint, f = N.framer(ctx, V.w, V.h), lx = (x - V.ox) * V.d, ly = (y + SH.LAMP_Y - V.oy) * V.d, k = Math.max(1, Math.round(V.d * 0.7));
        f.px(lx - k / 2 + Ls * V.d * 0.5, ly, lamp, k, k);
    }

    /** A thruster's flame: the drive's blue, hot at the nozzle and thinning, flickering; dust when it is close to the ground (LanderScene's particles). */
    function drawPlume(ctx, V, wx, wy) {
        const N = window.MiniPaint, f = N.framer(ctx, V.w, V.h), len = (6 + Math.random() * 4) * V.d * 0.85, ax = (wx - V.ox) * V.d, ay = (wy - V.oy) * V.d;
        f.glow(ax, ay + V.d, Math.round(1.8 * V.d), N.RP.PLUME, 0.55);
        for (let k = 0; k < len; k++) {
            const t = k / len, w = Math.max(1, Math.round((1 - t * 0.65) * V.d * 1.1 + (t > 0.7 ? Math.random() : 0)));
            for (let i = 0; i < w; i++) f.tone(ax - w / 2 + i, ay + k, N.RP.PLUME, (1.05 - t) * (i === 0 || i === w - 1 ? 0.7 : 1));
        }
    }

    /** The lander's own radar line, straight down to where it would touch: green over level ground, amber over a slope, red over lava or water. */
    function drawGuideArt(ctx, V, s, g) {
        const groundY = g.heights[clampX(Math.round(s.x))];
        if (groundY > H) return;
        const reading = groundReading(s, g), ink = reading.word === 'LEVEL' ? LEVEL_INK : reading.word === 'SLOPE' ? CAUTION_INK : DANGER_INK, k = Math.max(1, Math.round(V.d / 2.25));
        ctx.fillStyle = ink;
        for (let gy = s.y + LANDER_TALL + 3; gy < groundY - 1; gy += GUIDE_GAP) ctx.fillRect(Math.round((s.x - V.ox) * V.d), Math.round((gy - V.oy) * V.d), k, k);
    }

    /** The marked spot: A.U.R.A.'s two little masts with blinking lights, the stretch lit between them, a chevron above (gone once the lander is down). */
    function drawMarkArt(ctx, V, g, now, isDown) {
        if (!g.mark) return;
        const m = g.mark, N = window.MiniPaint, f = N.framer(ctx, V.w, V.h), on = Math.floor(now / MARK_BLINK_MS) % 2 === 0, ICE = '#9fd8e6', ICE_DIM = '#3d6670';
        const A = (x, y) => [(x - V.ox) * V.d, (y - V.oy) * V.d], u = V.d, k = Math.max(1, Math.round(u / 2.25));
        [m.x0 + 1, m.x1 - 1].forEach(bx => {
            const [ax, ay] = A(bx, m.y);
            f.px(ax, ay - 4.5 * u, N.RP.HULL.hex[3], k, Math.round(4.5 * u));                                                     // the mast
            f.px(ax - k, ay - 5.4 * u, on ? ICE : ICE_DIM, 3 * k, Math.max(k, Math.round(u)));                                    // its light
            if (on) f.glow(ax, ay - 5 * u, Math.round(2.6 * u), N.RP.UI, 0.6);
        });
        for (let x = m.x0 + 1; x < m.x1 - 1; x += 1 / u) { const [ax, ay] = A(x, m.y); f.px(ax, ay - k, on ? ICE : ICE_DIM, 1, k); }   // the stretch itself, lit
        if (isDown) return;
        const cx = m.cx, cy = m.y - 34 - (on ? 0 : 3);
        for (let t = 0; t < 6; t += 1 / u) { const [l, ly] = A(cx - 6 + t, cy + t), [r] = A(cx + 6 - t, cy + t); f.px(l, ly, ICE, 2 * k, k); f.px(r - k, ly, ICE, 2 * k, k); }   // a big chevron pointing down at it
        for (let by = cy + 8; by < m.y - 7; by += 3) { const [ax, ay] = A(cx, by); f.px(ax, ay, ICE_DIM, k, k); }                     // and a dotted beam down to the ground
    }

    /** Hull pieces thrown out and pulled back down, with a short flash, then smoke. */
    function drawWreckArt(ctx, V, x, y, age) {
        const N = window.MiniPaint, f = N.framer(ctx, V.w, V.h), t = age / 1000, A = (wx, wy) => [(wx - V.ox) * V.d, (wy - V.oy) * V.d], k = Math.max(1, Math.round(V.d / 2.25));
        const [fx, fy] = A(x, y + 7);
        if (age < 260) f.glow(fx, fy, Math.round(16 * V.d * (1 - age / 320)), N.RP.SUN, 1.5 - age / 260);                   // the flash
        else f.glow(fx, fy + V.d, Math.round((3 + Math.sin(age / 90) * 0.6) * V.d), N.RP.AMBER, 0.55 + 0.15 * Math.sin(age / 70));   // and what still burns
        for (let i = 0; i < 18; i++) {
            const angle = i * 2.4, speed = 18 + (i * 7) % 22, [ax, ay] = A(x + Math.cos(angle) * speed * t, y + 4 - Math.abs(Math.sin(angle)) * speed * t + 30 * t * t);
            if (i % 3 === 0) f.tone(ax, ay, N.RP.HULL, 0.7, (i % 4 === 0 ? 3 : 2) * k, 2 * k); else f.tone(ax, ay, N.RP.SUN, Math.max(0.2, 0.95 - t * 0.6), k, k);
        }
        for (let i = 0; i < 10; i++) { const rise = (t * 9 + i * 1.7) % 14, [ax, ay] = A(x + Math.sin(i * 3.1 + t) * 3, y + 6 - rise); f.tone(ax, ay, N.RP.STONE, 0.45 - rise / 40, 2 * k, 2 * k); }
    }

    // ── the old pixel lander: kept for AwayTeam.descent and for the plain fallback when the picture recipes are missing ──
    // one character per pixel: o hull edge, b hull, w window, h window shine, l status lamp, n nozzle, f foot
    const SPRITE = [
        '....ooooo....',
        '...owwhwwo...',
        '..oowwwwwoo..',
        '.obbbbbbbbbo.',
        '.obbbblbbbbo.',
        '.ooooooooooo.',
        '.onn.....nno.',
        'o...........o',
        'ff.........ff'
    ];
    const SPRITE_INK = { o: BONE, b: '#8f8a7a', w: '#1d5563', h: '#7fd0de', n: '#5a574e', f: BONE };
    const NOZZLE_LEFT = 2, NOZZLE_RIGHT = 9, NOZZLE_ROW = 7, DUST_HEIGHT = 30, GUIDE_GAP = 4;
    const FLAME_INKS = ['#fff4d0', '#ffb84a', '#ff7038', '#a8321c'];

    /** Lamp on the hull: how touching down right now would go — green soft, amber rough, red crash. */
    const statusColor = (s, g) => GRADES[gradeLanding(s, g)].color;

    function drawSprite(ctx, left, top, lamp) {
        SPRITE.forEach((row, ry) => {
            for (let rx = 0; rx < row.length; rx++) {
                const ch = row[rx];
                if (ch === '.') continue;
                ctx.fillStyle = ch === 'l' ? lamp : SPRITE_INK[ch];
                ctx.fillRect(left + rx, top + ry, 1, 1);
            }
        });
    }
    function drawFlame(ctx, fx, fy, g, look) { // g + look are optional: without them there is no ground dust
        const length = 5 + Math.round(Math.random() * 4);
        for (let k = 0; k < length; k++) {
            ctx.fillStyle = FLAME_INKS[Math.min(FLAME_INKS.length - 1, Math.floor(k / length * FLAME_INKS.length))];
            const isTip = k > length - 3;
            ctx.fillRect(fx + (isTip ? Math.round(Math.random()) : 0), fy + k, isTip ? 1 : 2, 1);
        }
        if (!g) return;
        const groundY = g.heights[clampX(fx)];
        if (groundY > H || g.hot[fx] || groundY - fy > DUST_HEIGHT) return;
        ctx.fillStyle = look.edge;
        for (let k = 0; k < 5; k++) ctx.fillRect(fx + Math.round((Math.random() - 0.5) * 16), Math.round(groundY) - 1 - Math.round(Math.random() * 4), 1, 1);
    }
    function drawPlainGround(ctx, s, g, look, now) {
        ctx.fillStyle = INK; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = DIM;
        for (let k = 0; k < 46; k++) ctx.fillRect((k * k * 37 + k * 101) % W, (k * k * 17 + k * 59) % 112, 1, 1);
        for (let x = 0; x < W; x++) {
            const y = Math.round(g.heights[x]);
            if (y > H) continue;
            ctx.fillStyle = g.hot[x] ? (g.kind.sea ? '#1f4f9a' : '#ff7038') : look.fill; ctx.fillRect(x, y, 1, H - y);
            ctx.fillStyle = g.hot[x] ? BONE : look.edge; ctx.fillRect(x, y, 1, 1);
        }
        if (g.kind.platform) { ctx.fillStyle = BONE; ctx.fillRect(g.padX, g.padY, PAD_WIDTH, 2); }
        if (g.mark) { ctx.fillStyle = GREEN; ctx.fillRect(Math.round(g.mark.x0 + 1), Math.round(g.mark.y), Math.round(g.mark.x1 - g.mark.x0 - 1), 1); }
        if (!s.isReleased) { ctx.fillStyle = '#2a2d2a'; ctx.fillRect(Math.round(s.x) - 22, 0, 44, Math.max(1, Math.round(s.y) - 2)); }
        const x = Math.round(s.x), y = Math.round(s.y);
        drawSprite(ctx, x - LANDER_HALF, y, statusColor(s, g));
        if (!s.grade && s.fuel > 0 && s.keys.right) drawFlame(ctx, x - LANDER_HALF + NOZZLE_LEFT, y + NOZZLE_ROW, g, look);
        if (!s.grade && s.fuel > 0 && s.keys.left) drawFlame(ctx, x - LANDER_HALF + NOZZLE_RIGHT, y + NOZZLE_ROW, g, look);
    }

    /** One frame of the place, the lander and the team, through view V. */
    function draw(ctx, s, g, now, scene, V) {
        const isLit = !s.grade && s.fuel > 0, nozzles = [];                                                  // pushing left fires the RIGHT thruster, and the other way round
        if (isLit && s.keys.right) nozzles.push([s.x - SH.PODS, s.y + SH.POD_Y]);
        if (isLit && s.keys.left) nozzles.push([s.x + SH.PODS, s.y + SH.POD_Y]);
        Scene().drawLive(ctx, scene, g, s, now, nozzles, V);
        const Ls = scene.S.Ls, lamp = s.grade ? null : COLOR[gradeLanding(s, g)];
        if (s.grade === 'crash') { drawMarkArt(ctx, V, g, now, true); drawWreckArt(ctx, V, s.x, s.y, now - s.endedAt); return; }
        if (!s.grade) drawGuideArt(ctx, V, s, g);
        drawMarkArt(ctx, V, g, now, !!s.grade);
        if (scene.isMirror) {                                                                                // a mirror world: the shuttle upside down under its own feet
            const ground = g.heights[clampX(Math.round(s.x))], gap = ground - (s.y + LANDER_TALL);
            if (ground <= H && !g.hot[clampX(Math.round(s.x))] && gap >= 0) drawShuttle(ctx, V, s.x, ground + gap / 2.4 - LANDER_TALL, Ls, null, 0.45);
        }
        if (s.crew) window.LanderCrew.drawBehind(ctx, s.crew, g, now, V, scene.S);                          // the team steps out: see LanderCrew.js
        nozzles.forEach(([nx, ny]) => drawPlume(ctx, V, nx, ny));
        drawShuttle(ctx, V, s.x, s.y, Ls, lamp);
        if (s.crew) window.LanderCrew.drawFront(ctx, s.crew, g, now, V, scene.S);
    }

    /** Show this frame: the whole place, the window the camera is closing in on (scaled), or the close-up painted sharp. */
    function present(R, s, g, now) {
        const { viewCtx, world, worldCtx, scene } = R;
        if (!scene) { drawPlainGround(worldCtx, s, g, R.look, now); viewCtx.drawImage(world, 0, 0, W, H, 0, 0, viewCtx.canvas.width, viewCtx.canvas.height); return; }
        const cam = s.crew && window.LanderCrew ? window.LanderCrew.view(s.crew, now) : null;
        if (cam && cam.w < W && !R.closeV) R.closeV = Scene().closeUp(scene, g, window.LanderCrew.final(s.crew));
        if (R.closeV && scene.close && !scene.close.done) Scene().bake(scene.close, CLOSE_BAKE_MS);
        if (cam && cam.arrived && R.closeV && scene.close.done) { draw(viewCtx, s, g, now, scene, R.closeV); return; }
        draw(worldCtx, s, g, now, scene, Scene().MAIN);
        if (!cam || cam.w >= W) { viewCtx.drawImage(world, 0, 0); return; }
        const d = Scene().MAIN.d;
        viewCtx.drawImage(world, cam.left * d, cam.top * d, cam.w * d, cam.h * d, 0, 0, viewCtx.canvas.width, viewCtx.canvas.height);
    }

    // ── the frame around the picture: the travel view's quiet words (IBM Plex), no panel, no big buttons ──
    const CLOSE_BAKE_MS = 7, FIT_MARGIN = 16, CRISP_MIN_FILL = 0.8;
    const STYLE = `
.warp-plot.lander.lx { background: rgba(5, 7, 10, 0.95); -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); color: #e4e4e0; font: 400 15px/1.4 'IBM Plex Sans', system-ui, sans-serif; -webkit-font-smoothing: antialiased; padding: ${FIT_MARGIN}px; overflow: auto; }
.lx .lx-frame { width: min-content; display: grid; gap: 12px; }
.lx .lx-head { display: flex; align-items: baseline; gap: 16px; min-height: 26px; padding: 0 2px; text-shadow: 0 1px 0 #05070a; }
.lx .lx-kicker { margin: 0; font: 500 12px/1 'IBM Plex Sans Condensed', 'Arial Narrow', sans-serif; letter-spacing: 0.24em; text-transform: uppercase; color: #8b8d90; white-space: nowrap; }
.lx .lx-title { margin: 0; font: 300 22px/1.1 'IBM Plex Sans', system-ui, sans-serif; letter-spacing: 0.06em; color: #e4e4e0; white-space: nowrap; }
.lx .lx-screen { position: relative; background: #05070a; box-shadow: 0 0 0 1px rgba(201, 209, 214, 0.07), 0 30px 90px rgba(0, 0, 0, 0.6); }
.lx .lx-canvas { display: block; image-rendering: pixelated; image-rendering: crisp-edges; }
.lx .lx-readout { contain: inline-size; display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 26px; margin: 0; padding: 0 2px; font: 400 13px/1.2 'IBM Plex Mono', ui-monospace, Consolas, monospace; color: #8b8d90; }
.lx .lx-readout div { display: flex; align-items: baseline; gap: 8px; }
.lx .lx-readout dt { font: 400 13px/1 'IBM Plex Mono', ui-monospace, Consolas, monospace; letter-spacing: 0.02em; color: #5a6168; }
.lx .lx-readout dd { margin: 0; min-width: 3ch; color: #c9d1d6; font: 400 13px/1 'IBM Plex Mono', ui-monospace, Consolas, monospace; transition: color 120ms; }
.lx .lx-readout .lander-fuel { display: inline-block; width: 96px; height: 2px; margin: 0 0 3px; background: #22333b; vertical-align: middle; }
.lx .lx-readout .lander-fuel b { display: block; height: 100%; background: #f0a24a; transform-origin: left; }
.lx .lx-talk { contain: inline-size; min-height: 58px; display: grid; align-content: start; gap: 6px; padding: 2px 2px 0; text-shadow: 0 1px 0 #05070a; }
.lx .lx-talk p { margin: 0; }
.lx .lx-who { display: flex; align-items: center; gap: 8px; min-height: 15px; font: 500 14px/1 'IBM Plex Sans Condensed', 'Arial Narrow', sans-serif; letter-spacing: 0.18em; text-transform: uppercase; color: #c9d1d6; }
.lx .lx-who .lx-ring { flex: none; width: 0.82em; height: 0.82em; border: 1px solid currentColor; border-radius: 50%; }
.lx .lx-who.is-empty .lx-ring { display: none; }
.lx .lx-line { max-width: 62ch; font: 400 20px/1.36 'IBM Plex Sans', system-ui, sans-serif; color: #e4e4e0; text-wrap: balance; }
.lx .lx-line.is-note { max-width: 86ch; font: 400 15px/1.6 'IBM Plex Mono', ui-monospace, Consolas, monospace; color: #c7c9c6; }
.lx .lx-hint { contain: inline-size; margin: 0; padding: 0 2px; max-width: 110ch; font: 400 14px/1.5 'IBM Plex Sans', system-ui, sans-serif; color: #8b8d90; transition: opacity 900ms ease-out; }
.lx .lx-hint.is-gone { opacity: 0; }
.lx .lx-hint b { font-weight: 500; color: #c9d1d6; }
.lx .lx-hint kbd { padding: 0 4px; border: 1px solid #33373e; border-radius: 2px; font: 12px 'IBM Plex Mono', ui-monospace, Consolas, monospace; color: #c9d1d6; }
.lx .lx-buttons { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 30px; min-height: 36px; padding: 0 2px; }
.lx .lx-btn { display: inline-flex; align-items: baseline; gap: 9px; padding: 6px 0; border: 0; background: none; color: #e4e4e0; font: 400 18px/1.25 'IBM Plex Sans', system-ui, sans-serif; letter-spacing: 0.01em; text-shadow: 0 1px 0 #05070a; white-space: nowrap; cursor: pointer; touch-action: none; user-select: none; transition: color 140ms cubic-bezier(0.2, 0.7, 0.2, 1), transform 140ms cubic-bezier(0.2, 0.7, 0.2, 1); }
.lx .lx-btn::before { content: '\\203A'; font: 400 15px/1 'IBM Plex Mono', ui-monospace, monospace; color: #5a6168; transition: color 140ms cubic-bezier(0.2, 0.7, 0.2, 1); }
.lx .lx-btn.is-hold::before { content: '\\25CB'; font-size: 12px; }
.lx .lx-btn:hover:not([disabled]), .lx .lx-btn:focus-visible { color: #f08c2e; transform: translateX(3px); }
.lx .lx-btn:hover:not([disabled])::before, .lx .lx-btn:focus-visible::before { color: #f08c2e; }
.lx .lx-btn:focus-visible { outline: none; text-decoration: underline 1px; text-underline-offset: 5px; }
.lx .lx-btn.is-held:not([disabled]) { color: #ffc27a; transform: none; }
.lx .lx-btn.is-held:not([disabled])::before { content: '\\25CF'; color: #ffc27a; }
.lx .lx-btn[disabled] { color: #5a6168; cursor: default; }
.lx .lx-btn[disabled]::before { color: #33373e; }
@media (max-width: 640px) { .lx .lx-line { font-size: 17px; } .lx .lx-btn { font-size: 16px; } }
@media (prefers-reduced-motion: reduce) { .lx .lx-btn, .lx .lx-btn::before, .lx .lx-hint { transition: none; } }`;
    function addStyle() {
        if (document.getElementById('lander-lx-style')) return;
        const el = document.createElement('style'); el.id = 'lander-lx-style'; el.textContent = STYLE;
        document.head.appendChild(el);
    }

    /** Scale the picture to fit the window: whole device pixels per art pixel when that costs little room, so every dither dot is the same size. */
    function fitCanvas(overlay, canvas) {
        const frame = overlay.querySelector('.lx-frame'), dpr = window.devicePixelRatio || 1;
        canvas.style.width = canvas.style.height = '';
        const chromeH = frame.offsetHeight - canvas.offsetHeight;
        const room = Math.max(0.25, Math.min((window.innerWidth - 2 * FIT_MARGIN) / canvas.width, (window.innerHeight - 2 * FIT_MARGIN - chromeH) / canvas.height));
        const crisp = Math.floor(room * dpr + 0.01) / dpr, scale = crisp >= room * CRISP_MIN_FILL ? crisp : room;
        canvas.style.width = `${canvas.width * scale}px`; canvas.style.height = `${canvas.height * scale}px`;
    }

    function overlayHtml(planet, team, site, size) {
        return `<div class="lx-frame">
            <header class="lx-head"><p class="lx-kicker">LANDING — ${esc(team.map(m => m.name).join(' + '))} ABOARD</p><h2 class="lx-title">${esc(planet.name || 'The surface')}</h2></header>
            <div class="lx-screen"><canvas class="lx-canvas lander-canvas" width="${size[0]}" height="${size[1]}"></canvas></div>
            <dl class="lx-readout">
                <div><dt>FUEL</dt><dd><i class="lander-fuel"><b></b></i></dd></div>
                <div><dt>FALLING</dt><dd class="lander-down">0</dd></div>
                <div><dt>DRIFT</dt><dd class="lander-side">0</dd></div>
                <div><dt>HEIGHT</dt><dd class="lander-alt">0</dd></div>
                <div><dt>GROUND</dt><dd class="lander-ground">—</dd></div>
                <div><dt>MARK</dt><dd class="lander-mark">—</dd></div>
            </dl>
            <div class="lx-talk lx-result" aria-live="polite"><p class="lx-who is-empty"><span class="lx-ring" aria-hidden="true"></span><span class="lx-name"></span></p><p class="lx-line is-note"></p></div>
            <p class="lx-hint">Hold <kbd>←</kbd> / <kbd>→</kbd> (or <kbd>A</kbd> / <kbd>D</kbd>) to push left and right. Hold both to brake. A.U.R.A. has marked a safe spot${site ? ' next to the site' : ''} — the <b>blinking markers</b>. Put it down there, <b>slowly</b>. The line under the lander goes green over flat ground.</p>
            <div class="lx-buttons">
                <button class="lx-btn is-hold lander-hold" data-key="left">Push left</button>
                <button class="lx-btn is-hold lander-hold" data-key="right">Push right</button>
                <button class="lx-btn lander-auto">Let A.U.R.A. land</button>
            </div>
        </div>`;
    }

    /**
     * opts.site: what the team is going to ('wreck', 'ruins', 'stones', 'dome', 'beacon'), drawn beside the marked spot.
     * opts.wreck: for a wreck, its story id (ExodusDerelicts.js), so it is drawn as that story finds it: whole, broken, burned or a crater.
     */
    function play(app, planet, team, opts) {
        const site = (opts && opts.site) || null, wreck = (opts && opts.wreck) || null;
        return new Promise(resolve => {
            const colors = team.map(m => (window.ShipCutaway ? rgb(window.ShipCutaway.colorOf(m)) : BONE));
            const ids = team.map(m => m.name || m.role || m.id || null);
            const g = buildGround(planet), look = palette(planet);
            const scene = window.LanderScene ? window.LanderScene.build(g, planet, site, wreck) : null;       // null without the picture recipes: the plain fallback
            const size = scene ? [window.LanderScene.util.AW, window.LanderScene.util.AH] : [W * 2, H * 2];
            addStyle();
            const overlay = document.createElement('div');
            overlay.className = 'warp-plot lander lx';
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-label', 'Land the away team');
            overlay.innerHTML = overlayHtml(planet, team, site, size);
            document.body.appendChild(overlay);

            const canvas = overlay.querySelector('canvas'), viewCtx = canvas.getContext('2d'), world = document.createElement('canvas');
            world.width = scene ? size[0] : W; world.height = scene ? size[1] : H;
            const worldCtx = world.getContext('2d');                                                          // everything is drawn on `world`, then shown through the camera
            viewCtx.imageSmoothingEnabled = false; worldCtx.imageSmoothingEnabled = false;
            fitCanvas(overlay, canvas);
            const fitter = new ResizeObserver(() => fitCanvas(overlay, canvas)); fitter.observe(overlay);
            const R = { viewCtx, world, worldCtx, scene, look, closeV: null };
            const gravityG = Math.max(0.4, Math.min(2.2, (planet.metrics && planet.metrics.gravity) || 1));
            const gravity = BASE_GRAVITY * Math.pow(gravityG, GRAVITY_CURVE);
            const s = startState(g);
            s.site = site;
            window.LanderGame.current = { state: s, ground: g }; // read-only handle for automated play-tests
            const el = name => overlay.querySelector(name);
            const fuelBar = el('.lander-fuel b'), downEl = el('.lander-down'), sideEl = el('.lander-side'), altEl = el('.lander-alt'), groundEl = el('.lander-ground'), markEl = el('.lander-mark'), hintEl = el('.lx-hint');
            const whoEl = el('.lx-who'), nameEl = el('.lx-name'), lineEl = el('.lx-line');
            /** The voice line under the picture (MiniHost's): a status as a quiet note, a result as its name in its colour over the words. */
            function say(name, words, color) {
                nameEl.textContent = name || ''; whoEl.classList.toggle('is-empty', !name); whoEl.style.color = color || '';
                lineEl.textContent = words || ''; lineEl.classList.toggle('is-note', !name);
            }
            const holdBtns = Array.from(overlay.querySelectorAll('.lander-hold'));
            let last = performance.now(), isClosed = false, lastBeep = 0, lastFuelWarn = 0;
            const inkOf = c => (c === GREEN ? LEVEL_INK : c === AMBER ? CAUTION_INK : c === RED ? DANGER_INK : c);

            const KEYMAP = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' };
            function onKey(e) {
                const isDown = e.type === 'keydown';
                if (e.key === ' ') { s.keys.left = s.keys.right = isDown; e.preventDefault(); return; }
                if (KEYMAP[e.key]) { s.keys[KEYMAP[e.key]] = isDown; e.preventDefault(); }
            }
            const unlisten = () => { window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey); };
            window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey);
            holdBtns.forEach(btn => {
                const set = isOn => () => { if (!s.isAuto) s.keys[btn.dataset.key] = isOn; };
                btn.addEventListener('pointerdown', set(true)); btn.addEventListener('pointerup', set(false)); btn.addEventListener('pointerleave', set(false));
            });

            function close(result) {
                if (isClosed) return;
                isClosed = true;
                unlisten();
                fitter.disconnect();
                window.removeEventListener('keydown', onSkipKey);
                overlay.classList.add('is-leaving');
                setTimeout(() => { overlay.remove(); resolve(result); }, 350);
            }

            let result = null;
            const skip = () => { if (result && performance.now() - s.endedAt > SKIP_AFTER_MS) close(result); }; // once down, a click or Enter goes on at once
            function onSkipKey(e) { if (SKIP_KEYS.includes(e.key) && !e.repeat) skip(); }
            overlay.addEventListener('pointerdown', skip);
            window.addEventListener('keydown', onSkipKey);

            function end(landed) {
                const isOffMark = landed !== 'crash' && !g.kind.platform && !isOnMark(g, Math.round(s.x));
                const grade = isOffMark ? 'rough' : landed;
                s.grade = grade; s.endedAt = performance.now(); s.keys.left = s.keys.right = false; s.isOffMark = isOffMark;
                const info = isOffMark ? OFF_MARK : GRADES[grade];
                overlay.querySelectorAll('button').forEach(b => { b.disabled = true; b.classList.remove('is-held'); });
                say(info.label, info.effect, inkOf(info.color));
                sfx('sfxTouchdown', grade);
                if (grade === 'crash' && app.screenShake) app.screenShake('heavy');
                if (grade !== 'crash' && window.LanderCrew && scene) s.crew = window.LanderCrew.plan(g, s, colors, planet, s.endedAt, ids); // they suit up and step out
                result = { grade, auto: !!s.isAuto, offMark: isOffMark };
                setTimeout(() => close(result), s.crew ? s.crew.duration : RESULT_HOLD_MS);
            }

            el('.lander-auto').addEventListener('click', () => { // hand it to A.U.R.A.: she flies the same lander down to level ground while you watch
                if (s.grade || s.isAuto) return;
                if (!g.level.length) {                                         // no level ground on this world at all (should never happen): watch the old descent instead
                    s.grade = 'rough'; isClosed = true; unlisten(); fitter.disconnect(); overlay.remove();
                    const watch = window.AwayTeam ? window.AwayTeam.descent(app, planet, team) : Promise.resolve();
                    watch.then(() => resolve({ grade: 'rough', auto: true }));
                    return;
                }
                s.isAuto = true; s.keys.left = s.keys.right = false;
                unlisten();
                overlay.querySelectorAll('.lander-hold, .lander-auto').forEach(b => { b.disabled = true; b.classList.remove('is-held'); });
            });

            (function frame(now) {
                if (isClosed) return;
                const dt = Math.min(MAX_STEP, (now - last) / 1000); last = now;
                const isHolding = !s.isReleased && !s.isAuto && !s.keys.left && !s.keys.right;   // it hangs under the ship until you touch a control, so nobody crashes while reading
                if (!isHolding && !s.isReleased) { s.isReleased = true; sfx('sfxUndock'); }
                const status = s.grade ? null : isHolding ? DOCKED_TEXT : s.isAuto ? AUTO_TEXT : '';
                if (status !== null && status !== s.status) { s.status = status; say('', status); }
                if (!isHolding && !hintEl.classList.contains('is-gone')) hintEl.classList.add('is-gone');   // read once: it fades after the first control input (≤ 40 words on screen)
                if (!s.grade && !isHolding) {
                    if (s.isAuto) autopilot(s, g);
                    const landed = step(s, g, gravity, dt), reading = groundReading(s, g);
                    const isSafeDown = s.vy <= SOFT.down, isSafeSide = Math.abs(s.vx) <= SOFT.side;
                    fuelBar.style.transform = `scaleX(${s.fuel / FUEL_FULL})`; fuelBar.style.background = s.fuel < LOW_FUEL ? DANGER_INK : CAUTION_INK;
                    downEl.textContent = Math.max(0, Math.round(s.vy)); downEl.style.color = isSafeDown ? QUIET_INK : s.vy <= ROUGH.down ? CAUTION_INK : DANGER_INK;
                    sideEl.textContent = Math.abs(Math.round(s.vx)); sideEl.style.color = isSafeSide ? QUIET_INK : Math.abs(s.vx) <= ROUGH.side ? CAUTION_INK : DANGER_INK;
                    altEl.textContent = Math.max(0, Math.round(s.altitude));
                    groundEl.textContent = reading.word; groundEl.style.color = inkOf(reading.color);
                    if (g.mark) {                                                                   // which way to the marked spot, and how far
                        const off = g.mark.cx - s.x, isOn = isOnMark(g, Math.round(s.x));
                        markEl.textContent = isOn ? 'ON IT' : `${off < 0 ? '◀' : '▶'} ${Math.round(Math.abs(off))}`;
                        markEl.style.color = isOn ? LEVEL_INK : QUIET_INK;
                    }
                    if ((s.keys.left || s.keys.right) && s.fuel > 0 && now - lastBeep > THRUST_SOUND_MS) { lastBeep = now; sfx('sfxThruster', s.keys.left && s.keys.right); }
                    if (s.fuel > 0 && s.fuel < LOW_FUEL && now - lastFuelWarn > LOW_FUEL_BEEP_MS) { lastFuelWarn = now; sfx('sfxLowFuel'); }
                    if (landed) end(landed);
                }
                if (!s.isAuto && !s.grade) holdBtns.forEach(b => b.classList.toggle('is-held', !!s.keys[b.dataset.key]));   // a held key shows on its button
                present(R, s, g, now);
                nextFrame(frame);
            })(last);
            el('.lander-hold').focus();
        });
    }

    /** The same lander for other scenes (AwayTeam.descent): centred on x, top at y, both thrusters lit when isBurning. */
    function drawLander(ctx, x, y, isBurning) {
        drawSprite(ctx, x - LANDER_HALF, y, isBurning ? AMBER : GREEN);
        if (!isBurning) return;
        drawFlame(ctx, x - LANDER_HALF + NOZZLE_LEFT, y + NOZZLE_ROW);
        drawFlame(ctx, x - LANDER_HALF + NOZZLE_RIGHT, y + NOZZLE_ROW);
    }

    window.LanderGame = {
        play, GRADES, drawLander, LANDER_TALL, SPRITE, SPRITE_INK, SHUTTLE: SH,                  // SPRITE: the old pixel lander (AwayTeam.descent); SHUTTLE: the new one's measures
        internals: { buildGround, step, autopilot, startState, gradeLanding, groundReading, tiltAt, isOnMark, BASE_GRAVITY, GRAVITY_CURVE, FUEL_FULL, PAD_WIDTH, LANDER_HALF, LEVEL_TILT, ROUGH_TILT, SOFT, ROUGH, GROUND_OF }, // internals: for headless play-tests
    };
})();
