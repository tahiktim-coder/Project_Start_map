/* LanderGame — you fly the away team down yourself (Lunar Lander, in the ship's phosphor).
   A small lander with two thrusters and one tank of fuel, a planet's gravity, and ground that is
   different on every kind of world: jagged rock, ice spikes, smooth dunes, lava pools you must not
   touch, islands in an ocean, or no ground at all over a gas giant — just a platform in the wind.
   Nobody built a pad on an unexplored world. You look for LEVEL ground: every surface has a few natural
   flat stretches (a rock shelf, a dune crest, a frozen ledge), each wider than the lander; the rest rolls.
     ← / A  push left      → / D  push right      both (or Space)  brake hardest
   Slow, on level ground                → SOFT landing: the team steps out fresh (the trip down there is safer)
   A bit fast, or the ground a bit uneven → ROUGH landing: nothing changes
   Too fast, on a slope, in lava or water → CRASH: someone is hurt before they even step outside
   "LET A.U.R.A. LAND" hands her the stick: she steers to the nearest level stretch and puts it down there.
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
    const AUTO = { cruiseDown: 26, approachDown: 14, settleDown: 8, hoverDown: 2, climbUp: -8, highAlt: 45, lowAlt: 14, glideAlt: 24, climbGap: 8, sideGain: 0.45, sideMax: 20, sideBand: 3, sideBandMin: 1, sideHard: 7, minRoom: 4 };
    const RESULT_HOLD_MS = 1700, MAX_STEP = 0.033;
    const GRACE_MS = 3000; // the lander hangs under the ship until you touch a control (or this long), so nobody crashes while reading
    const INK = '#06070a', BONE = '#c4d0c4', AMBER = '#d9a24a', RED = '#d85a4e', GREEN = '#74d99a', DIM = '#2f5a48';
    const LOW_FUEL = 25, LOW_FUEL_BEEP_MS = 900, THRUST_SOUND_MS = 120;
    const DOCKED_TEXT = 'Docked under the ship. Touch a control to let go.', AUTO_TEXT = 'A.U.R.A. has the stick. She is looking for level ground.';
    const GRADES = {
        soft: { label: 'SOFT LANDING', effect: 'the team steps out fresh — the trip is safer', color: GREEN, riskMod: -8 },
        rough: { label: 'ROUGH LANDING', effect: 'down in one piece', color: AMBER, riskMod: 0 },
        crash: { label: 'CRASH', effect: 'someone is hurt before the hatch even opens', color: RED, riskMod: 10 },
    };
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
        return g;
    }

    /** Where the drop starts: the side of the screen with the longer flight to level ground, so there is always some steering to do. */
    function startState(g) {
        const leftX = 36, rightX = W - 36, nearest = x => g.level.reduce((best, l) => Math.min(best, Math.abs(l.cx - x)), Infinity);
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

    // The lander, one character per pixel: o hull edge, b hull, w window, h window shine, l status lamp, n nozzle, f foot
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

    /** A flickering flame, hot at the nozzle and cooling toward the tip, plus dust when it is close to the ground. */
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

    /** The lander's own radar line, straight down to where it would touch: green over level ground, amber over a slope, red over lava or water. */
    function drawGuide(ctx, s, g, x, y) {
        const groundY = g.heights[clampX(x)];
        if (groundY > H) return;
        const reading = groundReading(s, g);
        ctx.fillStyle = reading.word === 'LEVEL' ? GREEN : reading.word === 'SLOPE' ? AMBER : RED;
        for (let gy = y + LANDER_TALL + 3; gy < groundY - 1; gy += GUIDE_GAP) ctx.fillRect(x, gy, 1, 1);
    }

    /** The clamp it hangs from before it is let go. */
    function drawDock(ctx, x, y) {
        ctx.fillStyle = '#2a2d2a'; ctx.fillRect(x - 22, 0, 44, Math.max(1, y - 2));
        ctx.fillStyle = DIM; ctx.fillRect(x - 22, Math.max(0, y - 3), 44, 1);
        ctx.fillStyle = AMBER; ctx.fillRect(x - 8, Math.max(0, y - 2), 2, 3); ctx.fillRect(x + 6, Math.max(0, y - 2), 2, 3);
    }

    /** Hull pieces thrown out and pulled back down, with a short flash. */
    function drawWreck(ctx, x, y, age) {
        const t = age / 1000;
        if (age < 140) { ctx.fillStyle = FLAME_INKS[0]; ctx.fillRect(x - 9, y - 4, 18, 14); }
        for (let k = 0; k < 16; k++) {
            const angle = k * 2.4, speed = 18 + (k * 7) % 22;
            const px = x + Math.cos(angle) * speed * t, py = y + 4 - Math.abs(Math.sin(angle)) * speed * t + 30 * t * t;
            ctx.fillStyle = k % 3 === 0 ? BONE : FLAME_INKS[1 + (k % 3)];
            ctx.fillRect(Math.round(px), Math.round(py), k % 4 === 0 ? 2 : 1, k % 4 === 0 ? 2 : 1);
        }
    }

    /** Plain fallback backdrop, used only if LanderScene.js is missing. */
    function drawPlainGround(ctx, g, look, now) {
        ctx.fillStyle = INK; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = DIM;
        for (let k = 0; k < 46; k++) ctx.fillRect((k * k * 37 + k * 101) % W, (k * k * 17 + k * 59) % 112, 1, 1);
        if (g.kind.platform) { ctx.fillStyle = look.fill; for (let x = 0; x < W; x++) ctx.fillRect(x, 160 + Math.round(Math.sin(x * 0.06 + now / 900) * 4), 1, H); } // cloud tops
        for (let x = 0; x < W; x++) {
            const y = Math.round(g.heights[x]);
            if (y > H) continue;
            ctx.fillStyle = g.hot[x] ? (g.kind.sea ? '#1f4f9a' : (Math.floor(now / 160 + x) % 3 ? '#ff7038' : '#ffb060')) : look.fill;
            ctx.fillRect(x, y, 1, H - y);
            ctx.fillStyle = g.hot[x] ? BONE : look.edge; ctx.fillRect(x, y, 1, 1);
        }
        if (g.wind) { ctx.fillStyle = DIM; for (let k = 0; k < 5; k++) ctx.fillRect(((now / 1000 * g.wind * 6 + k * 70) % W + W) % W, 20 + k * 22, 6, 1); } // wind streaks
        if (!g.kind.platform) return;
        ctx.fillStyle = BONE; ctx.fillRect(g.padX, g.padY, PAD_WIDTH, 2);                                   // the platform deck and its beacons
        ctx.fillStyle = DIM; ctx.fillRect(g.padX + 4, g.padY + 2, PAD_WIDTH - 8, 3);
        ctx.fillStyle = Math.floor(now / 350) % 2 ? AMBER : '#5a4520';
        ctx.fillRect(g.padX - 1, g.padY - 3, 2, 3); ctx.fillRect(g.padX + PAD_WIDTH - 1, g.padY - 3, 2, 3);
    }

    function draw(ctx, s, g, colors, look, now, scene) {
        const x = Math.round(s.x), y = Math.round(s.y);
        const isLit = !s.grade && s.fuel > 0, nozzles = [];                                                  // pushing left fires the RIGHT thruster, and the other way round
        if (isLit && s.keys.right) nozzles.push([x - LANDER_HALF + NOZZLE_LEFT, y + NOZZLE_ROW]);
        if (isLit && s.keys.left) nozzles.push([x - LANDER_HALF + NOZZLE_RIGHT, y + NOZZLE_ROW]);
        if (scene) window.LanderScene.drawLive(ctx, scene, g, s, now, nozzles);
        else { drawPlainGround(ctx, g, look, now); if (!s.isReleased) drawDock(ctx, x, y); }
        if (s.grade === 'crash') drawWreck(ctx, x, y, now - s.endedAt);
        else {
            const isLeftBurn = s.keys.right && s.fuel > 0, isRightBurn = s.keys.left && s.fuel > 0; // pushing left fires the RIGHT thruster, and the other way round
            if (!s.grade) drawGuide(ctx, s, g, x, y);
            drawSprite(ctx, x - LANDER_HALF, y, statusColor(s, g));
            if (isLeftBurn) drawFlame(ctx, x - LANDER_HALF + NOZZLE_LEFT, y + NOZZLE_ROW, g, look);
            if (isRightBurn) drawFlame(ctx, x - LANDER_HALF + NOZZLE_RIGHT, y + NOZZLE_ROW, g, look);
        }
        if (s.grade && s.grade !== 'crash') colors.forEach((c, i) => {                                       // the team steps out
            const out = Math.min(1, (now - s.endedAt) / 900), fx = x + (i ? 1 : -1) * Math.round(8 + out * 12), fy = Math.round(g.heights[clampX(fx)]) - 9;
            ctx.fillStyle = BONE; ctx.fillRect(fx, fy, 3, 3); ctx.fillStyle = c; ctx.fillRect(fx - 1, fy + 3, 5, 4); ctx.fillRect(fx, fy + 7, 1, 2); ctx.fillRect(fx + 2, fy + 7, 1, 2);
        });
    }

    function overlayHtml(planet, team, colors) {
        return `<div class="warp-plot-frame">
            <p class="warp-plot-kicker">LANDING — ${esc(team.map(m => m.name).join(' + '))} ABOARD</p>
            <h2 class="warp-plot-target">${esc(planet.name || 'The surface')}</h2>
            <canvas class="warp-plot-canvas lander-canvas" width="${W}" height="${H}"></canvas>
            <dl class="lander-readout" style="grid-template-columns: 2fr 1fr 1fr 1fr 1.4fr">
                <div><dt>FUEL</dt><dd><i class="lander-fuel"><b></b></i></dd></div>
                <div><dt>FALLING</dt><dd class="lander-down">0</dd></div>
                <div><dt>DRIFT</dt><dd class="lander-side">0</dd></div>
                <div><dt>HEIGHT</dt><dd class="lander-alt">0</dd></div>
                <div><dt>GROUND</dt><dd class="lander-ground">—</dd></div>
            </dl>
            <p class="warp-plot-hint">Hold <kbd>←</kbd> / <kbd>→</kbd> (or <kbd>A</kbd> / <kbd>D</kbd>) to push left and right. Hold both to brake. Find <b>level</b> ground and put it down <b>slowly</b> — the line under the lander goes green over a flat stretch.</p>
            <div class="warp-plot-buttons lander-buttons">
                <button class="warp-plot-engage lander-hold" data-key="left">◀ PUSH LEFT</button>
                <button class="warp-plot-engage lander-hold" data-key="right">PUSH RIGHT ▶</button>
                <button class="warp-plot-auto lander-auto">LET A.U.R.A. LAND</button>
            </div>
            <div class="warp-plot-result" aria-live="polite"></div>
        </div>`;
    }

    function play(app, planet, team) {
        return new Promise(resolve => {
            const colors = team.map(m => (window.ShipCutaway ? rgb(window.ShipCutaway.colorOf(m)) : BONE));
            const overlay = document.createElement('div');
            overlay.className = 'warp-plot lander';
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-label', 'Land the away team');
            overlay.innerHTML = overlayHtml(planet, team, colors);
            document.body.appendChild(overlay);

            const ctx = overlay.querySelector('canvas').getContext('2d'), g = buildGround(planet), look = palette(planet);
            const scene = window.LanderScene ? window.LanderScene.build(g, planet) : null;
            const gravityG = Math.max(0.4, Math.min(2.2, (planet.metrics && planet.metrics.gravity) || 1));
            const gravity = BASE_GRAVITY * Math.pow(gravityG, GRAVITY_CURVE);
            const s = startState(g);
            window.LanderGame.current = { state: s, ground: g }; // read-only handle for automated play-tests
            const el = name => overlay.querySelector(name);
            const fuelBar = el('.lander-fuel b'), downEl = el('.lander-down'), sideEl = el('.lander-side'), altEl = el('.lander-alt'), groundEl = el('.lander-ground'), resultEl = el('.warp-plot-result');
            const startedAt = performance.now();
            let last = startedAt, isClosed = false, lastBeep = 0, lastFuelWarn = 0;

            const KEYMAP = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' };
            function onKey(e) {
                const isDown = e.type === 'keydown';
                if (e.key === ' ') { s.keys.left = s.keys.right = isDown; e.preventDefault(); return; }
                if (KEYMAP[e.key]) { s.keys[KEYMAP[e.key]] = isDown; e.preventDefault(); }
            }
            const unlisten = () => { window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey); };
            window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey);
            overlay.querySelectorAll('.lander-hold').forEach(btn => {
                const set = isOn => () => { if (!s.isAuto) s.keys[btn.dataset.key] = isOn; };
                btn.addEventListener('pointerdown', set(true)); btn.addEventListener('pointerup', set(false)); btn.addEventListener('pointerleave', set(false));
            });

            function close(result) {
                if (isClosed) return;
                isClosed = true;
                unlisten();
                overlay.classList.add('is-leaving');
                setTimeout(() => { overlay.remove(); resolve(result); }, 350);
            }

            function end(grade) {
                s.grade = grade; s.endedAt = performance.now(); s.keys.left = s.keys.right = false;
                const info = GRADES[grade];
                overlay.querySelectorAll('button').forEach(b => { b.disabled = true; });
                resultEl.innerHTML = `<strong style="color:${info.color}">${info.label}</strong><span>${info.effect}</span>`;
                sfx('sfxTouchdown', grade);
                if (grade === 'crash' && app.screenShake) app.screenShake('heavy');
                setTimeout(() => close({ grade, auto: !!s.isAuto }), RESULT_HOLD_MS);
            }

            el('.lander-auto').addEventListener('click', () => { // hand it to A.U.R.A.: she flies the same lander down to level ground while you watch
                if (s.grade || s.isAuto) return;
                if (!g.level.length) {                                         // no level ground on this world at all (should never happen): watch the old descent instead
                    s.grade = 'rough'; isClosed = true; unlisten(); overlay.remove();
                    const watch = window.AwayTeam ? window.AwayTeam.descent(app, planet, team) : Promise.resolve();
                    watch.then(() => resolve({ grade: 'rough', auto: true }));
                    return;
                }
                s.isAuto = true; s.keys.left = s.keys.right = false;
                unlisten();
                overlay.querySelectorAll('.lander-hold, .lander-auto').forEach(b => { b.disabled = true; });
            });

            (function frame(now) {
                if (isClosed) return;
                const dt = Math.min(MAX_STEP, (now - last) / 1000); last = now;
                const isHolding = !s.isReleased && !s.isAuto && !s.keys.left && !s.keys.right && now - startedAt < GRACE_MS;
                if (!isHolding && !s.isReleased) { s.isReleased = true; sfx('sfxUndock'); }
                const status = s.grade ? null : isHolding ? DOCKED_TEXT : s.isAuto ? AUTO_TEXT : '';
                if (status !== null && status !== s.status) { s.status = status; resultEl.textContent = status; }
                if (!s.grade && !isHolding) {
                    if (s.isAuto) autopilot(s, g);
                    const landed = step(s, g, gravity, dt), reading = groundReading(s, g);
                    const isSafeDown = s.vy <= SOFT.down, isSafeSide = Math.abs(s.vx) <= SOFT.side;
                    fuelBar.style.transform = `scaleX(${s.fuel / FUEL_FULL})`; fuelBar.style.background = s.fuel < LOW_FUEL ? RED : AMBER;
                    downEl.textContent = Math.max(0, Math.round(s.vy)); downEl.style.color = isSafeDown ? GREEN : s.vy <= ROUGH.down ? AMBER : RED;
                    sideEl.textContent = Math.abs(Math.round(s.vx)); sideEl.style.color = isSafeSide ? GREEN : Math.abs(s.vx) <= ROUGH.side ? AMBER : RED;
                    altEl.textContent = Math.max(0, Math.round(s.altitude));
                    groundEl.textContent = reading.word; groundEl.style.color = reading.color;
                    if ((s.keys.left || s.keys.right) && s.fuel > 0 && now - lastBeep > THRUST_SOUND_MS) { lastBeep = now; sfx('sfxThruster', s.keys.left && s.keys.right); }
                    if (s.fuel > 0 && s.fuel < LOW_FUEL && now - lastFuelWarn > LOW_FUEL_BEEP_MS) { lastFuelWarn = now; sfx('sfxLowFuel'); }
                    if (landed) end(landed);
                }
                draw(ctx, s, g, colors, look, now, scene);
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
        play, GRADES, drawLander, LANDER_TALL,
        internals: { buildGround, step, autopilot, startState, gradeLanding, groundReading, tiltAt, BASE_GRAVITY, GRAVITY_CURVE, FUEL_FULL, PAD_WIDTH, LANDER_HALF, LEVEL_TILT, ROUGH_TILT, SOFT, ROUGH, GROUND_OF }, // internals: for headless play-tests
    };
})();
