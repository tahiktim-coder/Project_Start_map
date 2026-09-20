/* LanderGame — you fly the away team down yourself (Lunar Lander, in the ship's phosphor).
   A small lander with two thrusters and one tank of fuel, a planet's gravity, and ground that is
   different on every kind of world: jagged rock, ice spikes, smooth dunes, lava pools you must not
   touch, islands in an ocean, or no ground at all over a gas giant — just a platform in the wind.
     ← / A  push left      → / D  push right      both (or Space)  brake hardest
   Touch down slowly on the lit pad  → SOFT landing: the team starts fresh (the trip down there is safer)
   Anywhere flat, or a bit fast      → ROUGH landing: nothing changes
   Too fast, on a slope, in lava     → CRASH: someone is hurt before they even step outside
   "LET A.U.R.A. LAND" plays the old watch-from-orbit descent and always gives ROUGH.
   play(app, planet, team) → Promise<{ grade: 'soft'|'rough'|'crash', auto: boolean }> */

(function () {
    'use strict';
    const W = 320, H = 180, LANDER_HALF = 6, LANDER_TALL = 9, PAD_WIDTH = 42;
    // Tuned with a headless autopilot (scratchpad lander_sim.js): one thruster alone must out-lift 1 G, or steering costs you the landing
    const BASE_GRAVITY = 9, GRAVITY_CURVE = 0.5, THRUST_UP_ONE = 17, THRUST_SIDE = 16, THRUST_UP_BOTH = 34; // px/s²
    const FUEL_FULL = 100, FUEL_PER_THRUSTER = 6.5;                                         // units, units/s
    const SOFT = { down: 22, side: 11 }, ROUGH = { down: 42, side: 22 }, FLAT_SLOPE = 7;
    const RESULT_HOLD_MS = 1700, MAX_STEP = 0.033;
    const GRACE_MS = 3000; // the lander hangs under the ship until you touch a control (or this long), so nobody crashes while reading
    const INK = '#06070a', BONE = '#c4d0c4', AMBER = '#d9a24a', RED = '#d85a4e', GREEN = '#74d99a', DIM = '#2f5a48';
    const LOW_FUEL = 25, LOW_FUEL_BEEP_MS = 900, THRUST_SOUND_MS = 120;
    const GRADES = {
        soft: { label: 'SOFT LANDING', effect: 'the team steps out fresh — the trip is safer', color: GREEN, riskMod: -8 },
        rough: { label: 'ROUGH LANDING', effect: 'down in one piece', color: AMBER, riskMod: 0 },
        crash: { label: 'CRASH', effect: 'someone is hurt before the hatch even opens', color: RED, riskMod: 10 },
    };
    // amp = hill height, jag = per-pixel roughness, spikes = sharp ridges, wind = sideways push, pools = lava, platform = no ground
    const GROUND = {
        rock: { amp: 26, jag: 4, spikes: 0, wind: 0 }, ice: { amp: 20, jag: 2, spikes: 1, wind: 2 },
        dunes: { amp: 13, jag: 0, spikes: 0, wind: 3 }, lava: { amp: 22, jag: 3, spikes: 0, wind: 0, pools: true },
        green: { amp: 11, jag: 1, spikes: 0, wind: 1 }, sea: { amp: 9, jag: 0, spikes: 0, wind: 3, sea: true },
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
    const nextFrame = cb => (document.hidden ? setTimeout(() => cb(performance.now()), 16) : requestAnimationFrame(cb)); // rAF sleeps in a hidden tab

    function seeded(id) {
        let s = 11;
        String(id || 'x').split('').forEach(ch => { s = ((s * 31) + ch.charCodeAt(0)) >>> 0; });
        return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    }

    /** Height map (y of the ground at each x), pad position and hazards — fixed per planet, shaped by its type. */
    function buildGround(planet) {
        const kind = GROUND[GROUND_OF[planet.type] || 'rock'], rand = seeded(planet.id);
        const phases = [rand() * 6.28, rand() * 6.28, rand() * 6.28], heights = new Float32Array(W), hot = new Uint8Array(W);
        for (let x = 0; x < W; x++) {
            let y = 150 - kind.amp * (0.5 + 0.5 * Math.sin(x * 0.021 + phases[0])) - kind.amp * 0.4 * Math.sin(x * 0.057 + phases[1]);
            if (kind.spikes) y -= 12 * Math.pow(Math.abs(Math.sin(x * 0.11 + phases[2])), 6);
            heights[x] = kind.platform ? H + 40 : Math.min(H - 6, y + (rand() - 0.5) * kind.jag * 2);
        }
        const padX = 50 + Math.floor(rand() * (W - 100 - PAD_WIDTH));
        const padY = kind.platform ? 128 : Math.max(...heights.slice(padX, padX + PAD_WIDTH)); // cut into the hill, never float above it
        for (let x = padX; x < padX + PAD_WIDTH; x++) heights[x] = padY;
        if (kind.pools || kind.sea) { // low ground fills with lava (deadly) or water (deadly too: the lander does not float)
            const level = kind.sea ? 138 : 146;
            for (let x = 0; x < W; x++) if (heights[x] > level && (x < padX || x >= padX + PAD_WIDTH)) { heights[x] = level; hot[x] = 1; }
        }
        return { kind, heights, hot, padX, padY, wind: (rand() < 0.5 ? -1 : 1) * kind.wind };
    }

    function palette(planet) {
        const recipe = window.DitherRecipes && window.DitherRecipes.TYPES[planet.type], ramp = recipe && recipe.ramp;
        return ramp ? { fill: rgb(ramp[1]), edge: rgb(ramp[Math.min(ramp.length - 1, 3)]) } : { fill: '#10201a', edge: DIM };
    }

    function gradeLanding(s, g) {
        const left = Math.round(s.x - LANDER_HALF), right = Math.round(s.x + LANDER_HALF);
        const isOnPad = left >= g.padX && right <= g.padX + PAD_WIDTH;
        const isFlat = Math.abs(g.heights[Math.max(0, left)] - g.heights[Math.min(W - 1, right)]) <= FLAT_SLOPE;
        const isHot = g.hot[Math.max(0, Math.min(W - 1, Math.round(s.x)))] === 1;
        const within = limit => s.vy <= limit.down && Math.abs(s.vx) <= limit.side;
        if (isHot || (g.kind.platform && !isOnPad)) return 'crash';
        if (isOnPad && within(SOFT)) return 'soft';
        return (isOnPad || isFlat) && within(ROUGH) ? 'rough' : 'crash';
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
        for (let x = Math.round(s.x - LANDER_HALF); x <= Math.round(s.x + LANDER_HALF); x++) ground = Math.min(ground, g.heights[Math.max(0, Math.min(W - 1, x))]);
        const feet = s.y + LANDER_TALL;
        s.altitude = (g.kind.platform && ground > H ? g.padY : ground) - feet; // over open sky, read height against the platform's level
        if (g.kind.platform && s.y > H + 10) return 'crash';                   // fell past the platform into the clouds
        return ground - feet <= 0 ? gradeLanding(s, g) : null;
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

    /** Lamp on the hull: green = safe to touch down at this speed, amber = rough, red = too fast. */
    function statusColor(s) {
        const fits = (lim) => s.vy <= lim.down && Math.abs(s.vx) <= lim.side;
        return fits(SOFT) ? GREEN : fits(ROUGH) ? AMBER : RED;
    }

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
        const groundY = g.heights[Math.max(0, Math.min(W - 1, fx))];
        if (groundY > H || g.hot[fx] || groundY - fy > DUST_HEIGHT) return;
        ctx.fillStyle = look.edge;
        for (let k = 0; k < 5; k++) ctx.fillRect(fx + Math.round((Math.random() - 0.5) * 16), Math.round(groundY) - 1 - Math.round(Math.random() * 4), 1, 1);
    }

    /** Dotted line straight down to where it would touch: makes height and the pad edge easy to judge. */
    function drawGuide(ctx, s, g, x, y) {
        const groundY = g.heights[Math.max(0, Math.min(W - 1, x))];
        if (groundY > H) return;
        const isOverPad = x - LANDER_HALF >= g.padX && x + LANDER_HALF <= g.padX + PAD_WIDTH;
        ctx.fillStyle = isOverPad ? GREEN : DIM;
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

    function draw(ctx, s, g, colors, look, now) {
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
        ctx.fillStyle = BONE; ctx.fillRect(g.padX, g.padY, PAD_WIDTH, 2);                                   // the pad and its beacons
        if (g.kind.platform) { ctx.fillStyle = DIM; ctx.fillRect(g.padX + 4, g.padY + 2, PAD_WIDTH - 8, 3); }
        ctx.fillStyle = Math.floor(now / 350) % 2 ? AMBER : '#5a4520';
        ctx.fillRect(g.padX - 1, g.padY - 3, 2, 3); ctx.fillRect(g.padX + PAD_WIDTH - 1, g.padY - 3, 2, 3);
        if (g.wind) { ctx.fillStyle = DIM; for (let k = 0; k < 5; k++) ctx.fillRect(((now / 1000 * g.wind * 6 + k * 70) % W + W) % W, 20 + k * 22, 6, 1); } // wind streaks
        const x = Math.round(s.x), y = Math.round(s.y);
        if (!s.isReleased) drawDock(ctx, x, y);
        if (s.grade === 'crash') drawWreck(ctx, x, y, now - s.endedAt);
        else {
            const isLeftBurn = s.keys.right && s.fuel > 0, isRightBurn = s.keys.left && s.fuel > 0; // pushing left fires the RIGHT thruster, and the other way round
            if (!s.grade) drawGuide(ctx, s, g, x, y);
            drawSprite(ctx, x - LANDER_HALF, y, statusColor(s));
            if (isLeftBurn) drawFlame(ctx, x - LANDER_HALF + NOZZLE_LEFT, y + NOZZLE_ROW, g, look);
            if (isRightBurn) drawFlame(ctx, x - LANDER_HALF + NOZZLE_RIGHT, y + NOZZLE_ROW, g, look);
        }
        if (s.grade && s.grade !== 'crash') colors.forEach((c, i) => {                                       // the team steps out
            const out = Math.min(1, (now - s.endedAt) / 900), fx = x + (i ? 1 : -1) * Math.round(8 + out * 12), fy = Math.round(g.heights[Math.max(0, Math.min(W - 1, fx))]) - 9;
            ctx.fillStyle = BONE; ctx.fillRect(fx, fy, 3, 3); ctx.fillStyle = c; ctx.fillRect(fx - 1, fy + 3, 5, 4); ctx.fillRect(fx, fy + 7, 1, 2); ctx.fillRect(fx + 2, fy + 7, 1, 2);
        });
    }

    function overlayHtml(planet, team, colors) {
        return `<div class="warp-plot-frame">
            <p class="warp-plot-kicker">LANDING — ${esc(team.map(m => m.name).join(' + '))} ABOARD</p>
            <h2 class="warp-plot-target">${esc(planet.name || 'The surface')}</h2>
            <canvas class="warp-plot-canvas lander-canvas" width="${W}" height="${H}"></canvas>
            <dl class="lander-readout">
                <div><dt>FUEL</dt><dd><i class="lander-fuel"><b></b></i></dd></div>
                <div><dt>FALLING</dt><dd class="lander-down">0</dd></div>
                <div><dt>DRIFT</dt><dd class="lander-side">0</dd></div>
                <div><dt>HEIGHT</dt><dd class="lander-alt">0</dd></div>
            </dl>
            <p class="warp-plot-hint">Hold <kbd>←</kbd> / <kbd>→</kbd> (or <kbd>A</kbd> / <kbd>D</kbd>) to push left and right. Hold both to brake. Put it down <b>slowly</b> on the lit pad — the numbers turn green when it is safe to touch.</p>
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
            const gravityG = Math.max(0.4, Math.min(2.2, (planet.metrics && planet.metrics.gravity) || 1));
            const gravity = BASE_GRAVITY * Math.pow(gravityG, GRAVITY_CURVE);
            const startsLeft = g.padX + PAD_WIDTH / 2 > W / 2; // start on the far side from the pad
            const s = { x: startsLeft ? 36 : W - 36, y: 10, vx: startsLeft ? 8 : -8, vy: 0, fuel: FUEL_FULL, altitude: 100, keys: { left: false, right: false }, grade: null, endedAt: 0 };
            window.LanderGame.current = { state: s, ground: g }; // read-only handle for automated play-tests
            const el = name => overlay.querySelector(name);
            const fuelBar = el('.lander-fuel b'), downEl = el('.lander-down'), sideEl = el('.lander-side'), altEl = el('.lander-alt'), resultEl = el('.warp-plot-result');
            const startedAt = performance.now();
            let last = startedAt, isClosed = false, lastBeep = 0, lastFuelWarn = 0;

            const KEYMAP = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' };
            function onKey(e) {
                const isDown = e.type === 'keydown';
                if (e.key === ' ') { s.keys.left = s.keys.right = isDown; e.preventDefault(); return; }
                if (KEYMAP[e.key]) { s.keys[KEYMAP[e.key]] = isDown; e.preventDefault(); }
            }
            window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey);
            overlay.querySelectorAll('.lander-hold').forEach(btn => {
                const set = isOn => () => { s.keys[btn.dataset.key] = isOn; };
                btn.addEventListener('pointerdown', set(true)); btn.addEventListener('pointerup', set(false)); btn.addEventListener('pointerleave', set(false));
            });

            function close(result) {
                if (isClosed) return;
                isClosed = true;
                window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey);
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
                setTimeout(() => close({ grade, auto: false }), RESULT_HOLD_MS);
            }

            el('.lander-auto').addEventListener('click', () => { // hand it to A.U.R.A.: watch the old descent instead
                if (s.grade) return;
                s.grade = 'rough';
                isClosed = true;
                window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey);
                overlay.remove();
                const watch = window.AwayTeam ? window.AwayTeam.descent(app, planet, team) : Promise.resolve();
                watch.then(() => resolve({ grade: 'rough', auto: true }));
            });

            (function frame(now) {
                if (isClosed) return;
                const dt = Math.min(MAX_STEP, (now - last) / 1000); last = now;
                const isHolding = !s.isReleased && !s.keys.left && !s.keys.right && now - startedAt < GRACE_MS;
                if (!isHolding && !s.isReleased) { s.isReleased = true; sfx('sfxUndock'); }
                if (isHolding !== s.wasHolding) { s.wasHolding = isHolding; resultEl.textContent = isHolding ? 'Docked under the ship. Touch a control to let go.' : ''; }
                if (!s.grade && !isHolding) {
                    const landed = step(s, g, gravity, dt);
                    const isSafeDown = s.vy <= SOFT.down, isSafeSide = Math.abs(s.vx) <= SOFT.side;
                    fuelBar.style.transform = `scaleX(${s.fuel / FUEL_FULL})`; fuelBar.style.background = s.fuel < LOW_FUEL ? RED : AMBER;
                    downEl.textContent = Math.max(0, Math.round(s.vy)); downEl.style.color = isSafeDown ? GREEN : s.vy <= ROUGH.down ? AMBER : RED;
                    sideEl.textContent = Math.abs(Math.round(s.vx)); sideEl.style.color = isSafeSide ? GREEN : Math.abs(s.vx) <= ROUGH.side ? AMBER : RED;
                    altEl.textContent = Math.max(0, Math.round(s.altitude));
                    if ((s.keys.left || s.keys.right) && s.fuel > 0 && now - lastBeep > THRUST_SOUND_MS) { lastBeep = now; sfx('sfxThruster', s.keys.left && s.keys.right); }
                    if (s.fuel > 0 && s.fuel < LOW_FUEL && now - lastFuelWarn > LOW_FUEL_BEEP_MS) { lastFuelWarn = now; sfx('sfxLowFuel'); }
                    if (landed) end(landed);
                }
                draw(ctx, s, g, colors, look, now);
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

    window.LanderGame = { play, GRADES, drawLander, LANDER_TALL, internals: { buildGround, step, BASE_GRAVITY, GRAVITY_CURVE, FUEL_FULL, PAD_WIDTH } }; // internals: for headless play-tests
})();
