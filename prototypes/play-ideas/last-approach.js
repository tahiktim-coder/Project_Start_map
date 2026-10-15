/* ═══ Silent Exodus · play ideas · last-approach.js: THE LAST APPROACH, flying into the light as an act of trust ═════════
   What it is: a standalone mock of one minigame idea (nothing in the game is changed). The light at the end looks
   frightening but is the good one; going in is trust. Seen from the bridge, as in the corridor flight: the light dead
   ahead, slowly filling the view, dust streaming past, our Lander's decks in the corner. The ship drifts off course by
   itself, faster the further off it is, and gets shoved as alarms go off; you steer to keep the light in the middle (point
   at it with the mouse, or the arrow keys). Off course you make no headway: the dust all but stops, a small chevron by the
   corner marks points back to the light, and A.U.R.A. says so. The crew plead in short plain lines with their portraits;
   A.U.R.A. says what the sensors really read. "Turn back" is always there. Hold course about 40 seconds: everything goes
   white, then quiet, and the five of them stand together somewhere calm. Turn back: the light shrinks to a point and
   green Eden waits outside the window. The decision: trust. Low skill, high feeling.

   Reuses the real art, loaded as it is: NSPaint (ramps, the 8 x 8 Bayer dither, noise, the space strip, the false sun's
   lightGlow, painted here every frame as it grows), NSSky / NSSky2 (sector 6's sky F: the vast ring of lit dust around
   the light), NSWorlds (Eden, in the orbit's own colours through BodyRenderer), MiniShip.draw (the Lander's decks, as the
   corridor's corner shows them; alarms are its emergency red) and MiniShip.lander (standing on its legs in the calm
   place), MiniCrew.person (the five crew-hires people), the crew portraits (assets/crew, as EncounterCard shows them).
   The corridor's feel: its camera shake, its dust streaks down the heading, its quiet ink behind the ship inset.
   NO SOUND: nothing here makes any.

   The art grid: one art pixel is a whole number of screen pixels (3 at 1920 x 1080, 2 at 1280 x 720: both 640 x 360 art
   pixels), so the dither stays crisp. Everything below thinks in art pixels.
   Test hooks: window.lastApproach.state() → the run's numbers; .skipTo(s) jumps the flight ahead (tests only). */
(function () {
    'use strict';
    const P = window.NSPaint, SKY = window.NSSky, SKY2 = window.NSSky2, WORLDS = window.NSWorlds, SHIP = window.MiniShip, CREW = window.MiniCrew;
    const $ = id => document.getElementById(id);
    if (!P || !SHIP) { $('line').textContent = 'The Last Approach could not load its art.'; $('voice').classList.add('is-in'); return; }
    const { INK, RP, ramp, threshold, fbm, clamp01, seeded, hash, hexRgb, lerp } = P;
    const ss = P.smooth;                                 // smoothstep(a, b, v)

    // ── the play: tuning ──
    const HOLD_S = 40;                                  // s on course to reach the light
    const WHITE_S = 3.4, QUIET_S = 1.8, DAWN_S = 2.8;   // everything goes white; the white holds; the calm place comes in
    const TURN_S = 3.8;                                 // the turn away, until Eden settles in the window
    const LINE_AFTER_S = 0.9, BUTTONS_AFTER_S = 2.2;    // the ending's one line, then the way out
    // Steering has to matter: left alone, the ship slides off the light in about four seconds and makes no headway (the
    // dust stops streaming past and A.U.R.A. says so); held on the light, it goes in steadily.
    const ON_R = 0.09, OFF_R = 0.3;                     // shares of the picture's height: full headway inside ON_R, none past OFF_R
    const STEER_V = 160, STICK_R = 0.25, STICK_DEAD = 0.04; // px/s the heading turns at full stick; the mouse's reach to full stick
    const DRIFT0 = 14, DRIFT1 = 34;                     // px/s the ship wanders off at the start and at the end
    const UNSTABLE0 = 0.3, UNSTABLE1 = 0.7;             // per second: how off begets off, at the start and at the end
    const SHOVE0 = 55, SHOVE1 = 45, SHOVE_DECAY = 1.3;  // an alarm's shove (px/s) and how fast it settles
    const MAX_OFF = [0.47, 0.46];                       // the light never quite leaves the window
    const LOST_S = 1.6, LOST_AGAIN_S = 9;               // off course this long and A.U.R.A. says so; not more often than this
    const FPS = 30;                                     // the corridor's rate: the picture is the travel view's grain, not a video game's

    // the ship's alarms, in shares of the approach: the deck that turns emergency red and the word the ship flashes
    const ALARMS = [
        { at: 0.18, deck: 'engineering', label: 'HULL TEMPERATURE' }, { at: 0.3, deck: 'bridge' }, { at: 0.42, deck: 'lab' },
        { at: 0.5, deck: 'quarters', label: 'RADIATION' }, { at: 0.62, deck: 'cargo' }, { at: 0.74, deck: 'upgrades' },
    ];
    // what they say on the way in (docs/STYLE.md: plain, one idea, no riddles). Everyone pleads; A.U.R.A. reads true.
    const LINES = [
        { at: 0.03, who: 'aura', say: 'Course set for the light, Commander.' },
        { at: 0.11, who: 'mira', say: "It's so bright. Are we sure about this?" },
        { at: 0.19, who: 'jaxon', say: "Commander, the hull's heating up. Turn us around." },
        { at: 0.27, who: 'aura', say: 'That alarm is wrong, Commander. The hull is cold.' },
        { at: 0.35, who: 'vance', say: "Don't trust A.U.R.A. on this. Turn us back." },
        { at: 0.43, who: 'aris', say: 'Eden is right behind us. We could stop there.' },
        { at: 0.51, who: 'aura', say: 'Every alarm is on, Commander. The sensors read nothing wrong.' },
        { at: 0.59, who: 'jaxon', say: 'I just want to stop somewhere and live. Please turn us around.' },
        { at: 0.67, who: 'mira', say: "I can't see anything. Commander, I can't see." },
        { at: 0.75, who: 'vance', say: "If you're wrong, we all die. Turn back." },
        { at: 0.83, who: 'aris', say: "Whatever happens, I'm glad we're together." },
        { at: 0.91, who: 'aura', say: 'Still on course, Commander.' },
    ];
    const LOST_LINES = [{ who: 'aura', say: "We're drifting off the light, Commander." },
        { who: 'aura', say: 'Bring the light back to the middle, Commander.' }];
    const END_TRUST = { who: 'jaxon', say: "It's warm here. I think we can stop now." };
    const END_TURN = { who: 'aura', say: 'Eden is still there, Commander.' };
    // who speaks: the name, the voice colour (reading.css tone-*) and the portrait EncounterCard shows (src/bundle.js crew)
    const WHO = {
        aura: { name: 'A.U.R.A.', tone: 'aura', face: null }, jaxon: { name: 'Jaxon', tone: 'jaxon', face: 'M_2' },
        aris: { name: 'Aris', tone: 'aris', face: 'F_3' }, vance: { name: 'Vance', tone: 'vance', face: 'M_4' }, mira: { name: 'Mira', tone: 'mira', face: 'F_5' },
    };
    const FACE_SRC = id => '../../assets/crew/' + id + '.png';

    // ── the picture: ramps (all from the ink) ──
    const SKYW = ramp(INK, '#122029', '#24384a', '#4d5c6a', '#8c7c6c', '#d4a274', '#f6d6a2', '#fff3dc');     // the calm sky: cool above, warm low
    const HILL = ramp(INK, '#0e1614', '#1a2620', '#2b3a2e', '#46553e', '#6d7650');                           // far hills in the haze
    const GRASS = ramp(INK, '#0d150e', '#172618', '#253a20', '#3b5428', '#5e7434', '#8f9a4a', '#c8be72');   // the meadow, sunlit tips
    const POLLEN = ramp(INK, '#3a2a14', '#8a6a34', '#e8c07a', '#fff3dc');                                     // specks in the warm air
    const WHITE = hexRgb('#fff3dc');                    // the false sun's own white (RP.SUN's top): what everything goes to

    const c32 = rgb => (0xff000000 | (rgb[2] << 16) | (rgb[1] << 8) | rgb[0]) >>> 0;
    const lumOf = rgb => (rgb[0] * 77 + rgb[1] * 150 + rgb[2] * 29) >> 8;
    const lum32 = p => ((p & 255) * 77 + ((p >> 8) & 255) * 150 + ((p >> 16) & 255) * 29) >> 8;
    const packs = new Map();                            // ramp → its colours as 32-bit pixels and their brightness
    function pack(r) {
        let k = packs.get(r);
        if (!k) { k = { c: Uint32Array.from(r.rgb.map(c32)), l: Uint8Array.from(r.rgb.map(lumOf)) }; packs.set(r, k); }
        return k;
    }
    const INK32 = c32(hexRgb(INK));

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // 1. The size: a whole number of screen pixels per art pixel; the world built for it
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
    const stage = $('stage'), canvas = $('view'), ctx = canvas.getContext('2d', { willReadFrequently: true });
    let G = null;                                       // the built world for this window size

    function measure() {
        const px = Math.max(1, Math.round(window.innerHeight / 360)), W = Math.ceil(window.innerWidth / px), H = Math.ceil(window.innerHeight / px);
        document.documentElement.style.setProperty('--t', clamp01((window.innerWidth - 1280) / 640).toFixed(3));
        document.documentElement.style.setProperty('--px', px + 'px');
        return { px, W, H };
    }

    /** Space ahead: sector 6's sky F (the ring of lit dust round the light) with the space strip over it, painted once on a
        canvas wider than the window, so the heading can wander and the turn can swing without running off its edge. The
        light itself is not painted here: it grows every frame. */
    function buildBackdrop(W, H) {
        const MX = Math.round(W * 0.5), MY = Math.round(H * 0.5), BW = W + 2 * MX, BH = H + 2 * MY, LP = [MX + (W >> 1), MY + (H >> 1)];
        const ox = LP[0] - 320, oy = LP[1] - 180;                                  // the 640 x 360 stage with the light at its middle
        let sky = null;
        try { sky = SKY2 ? SKY2.build(BW, BH, ox, oy, 6, [320, 180], 'f') : null; } catch (e) { console.warn('The Last Approach: no sky F', e); }
        const strip = P.spaceStrip(BW + 4, BH, 61, 0.5, 1 * (sky ? sky.haze : 1), 1), lit = new Float32Array(BW * BH);
        for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) lit[y * BW + x] = Math.exp(-Math.hypot(x - LP[0], (y - LP[1]) * 1.15) / 60);
        const bp = P.painter(BW, BH, true), keep = (x, y) => Math.hypot(x - LP[0], y - LP[1]) < 14;
        const bright = sky && SKY ? SKY.paintSpace(bp, strip, 0, lit, keep, sky, 0) : P.paintSpace(bp, strip, 0, lit, keep);
        return { canvas: bp.canvas(), sky, stars: P.keepVisible(bp, bright), LP, BW, BH };
    }

    /** The picture of one window size: the backdrop, the ship inset and the quiet ink behind it, the dust down the heading. */
    function build() {
        const { px, W, H } = measure();
        canvas.width = W; canvas.height = H;
        canvas.style.width = W * px + 'px'; canvas.style.height = H * px + 'px';
        ctx.imageSmoothingEnabled = false;
        const g = { px, W, H, CX: W >> 1, CY: H >> 1, back: buildBackdrop(W, H), calm: null, eden: null };
        // our ship in the corner, as the corridor shows it (its MiniShip.layout(8, 172, 36, 76) at 1.5, in this grid)
        g.shipL = SHIP.layout(11, H - 131, 48, 101, SHIP.LANDER_ORDER);
        g.shade = shadeBehind(W, H, g.shipL);
        g.img = ctx.createImageData(W, H);
        return g;
    }

    /** The space behind our own ship goes quiet (the corridor's drawOverlays): ink, dithered in, deepest at the hull. */
    function shadeBehind(W, H, L) {
        const c = document.createElement('canvas'); c.width = W; c.height = H;
        const g = c.getContext('2d'), ix = L.cx, iy = L.top + L.height * 0.55, rx = L.D * 1.6, ry = L.height * 0.62;
        g.fillStyle = INK;
        for (let y = Math.max(0, Math.floor(iy - ry)); y < Math.min(H, iy + ry); y++) for (let x = Math.max(0, Math.floor(ix - rx)); x < Math.min(W, ix + rx); x++) {
            const q = ((x - ix) / rx) ** 2 + ((y - iy) / ry) ** 2;
            if (q < 1 && 0.85 * (1 - q) ** 0.6 > threshold(x, y)) g.fillRect(x, y, 1, 1);
        }
        return c;
    }

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // 2. The calm place (after the white) and Eden (if you turn back): painted once, when first needed
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // the five, left to right: who, how, where across the picture; the sitters get a low rock under them
    const GROUP = [{ id: 'mira', act: 'sit', x: 0.3 }, { id: 'cora', act: 'idle', x: 0.375 }, { id: 'jaxon', act: 'sit', x: 0.44 },
        { id: 'aris', act: 'idle', x: 0.525 }, { id: 'vance', act: 'idle', x: 0.6 }];
    const SEAT = 22, SIT_HIP = -4;                      // the crew engine's sit: seat top above the floor; the hips over x + hipX

    /** A wide meadow at evening under a warm low light, far hills, our Lander standing on its legs, two rocks to sit on. */
    function buildCalm(g) {
        const { W, H } = g, p = P.painter(W, H, true), hy = Math.round(H * 0.6), LX = Math.round(W * 0.76), LY = hy - 16;
        const floorY = Math.round(H * 0.87), groundAt = x => Math.round(H * 0.74 - 14 * Math.exp(-(((x - W * 0.45) / (W * 0.28)) ** 2)) + 5 * (fbm(x / 70, 2, 47, 3) - 0.5));
        const hillAt = x => Math.round(hy - 5 - 18 * fbm(x / 150, 5, 41, 3) - 5 * Math.sin(x / 97));
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {                   // the sky: cool above, warm toward a low, soft sun
            const d = Math.hypot(x - LX, (y - LY) * 1.06), glow = 0.42 * Math.exp(-Math.hypot(x - LX, (y - LY) * 2.4) / (W * 0.24));
            const sun = d < 6 ? 1 : 0.5 * Math.exp(-(d - 6) / 7), cloud = (fbm(x / 120, y / 9, 31, 4) - 0.5) * 0.24 * (y / hy);
            p.solid(x, y, SKYW, 0.16 + 0.58 * Math.min(1, y / hy) ** 2.2 + glow + sun + cloud);
        }
        const stars = P.scatterStars(p, 77, 90, (x, y) => y < hy * 0.32 && Math.hypot(x - LX, y - LY) > W * 0.3);
        for (let x = 0; x < W; x++) {                                               // far hills, lit on the side toward the light
            const top = hillAt(x), toward = x < LX ? 1 : 0.4;
            for (let y = top; y < H; y++) p.solid(x, y, HILL, (y - top < 1 ? 0.5 * toward + 0.2 : 0.24 + 0.14 * fbm(x / 30, y / 10, 43, 3)) * (1 - 0.3 * clamp01((y - top) / 40)));
        }
        for (let x = 0; x < W; x++) {                                               // the meadow they stand in
            const top = groundAt(x), warm = Math.exp(-Math.abs(x - LX) / (W * 0.5));
            for (let y = top; y < H; y++) {
                const d = y - top, v = d < 1 ? 0.62 + 0.2 * warm : 0.3 + 0.3 * fbm(x / 26, y / 7, 53, 4) + 0.18 * warm - 0.12 * clamp01(d / (H - top));
                p.solid(x, y, GRASS, v);
            }
        }
        const rand = seeded(907), tufts = [];
        for (let i = 0; i < W / 3; i++) {                                           // grass blades along the meadow's edge and in it
            const x = Math.floor(rand() * W), y0 = groundAt(x) + Math.floor(rand() * rand() * (H - groundAt(x))), h = 1 + Math.floor(rand() * 3);
            for (let k = 1; k <= h; k++) p.solid(x, y0 - k, GRASS, 0.5 + 0.12 * k + 0.15 * rand());
            if (rand() < 0.3) tufts.push({ x, y: y0 - h - 1, ph: rand() * 6.28 });
        }
        GROUP.filter(m => m.act === 'sit').forEach((m, i) => {                      // a low flat boulder under each sitter, lit from the right
            const hx = Math.round(W * m.x) + SIT_HIP + 2, rx = 17 + i * 3, ry = SEAT / 2 + 1, cy = floorY - ry + 2;
            p.region(hx - rx, cy - ry, hx + rx + 1, cy + ry + 1, (x, y) => {
                const nx = (x + 0.5 - hx) / rx, ny = (y + 0.5 - cy) / ry, q = Math.abs(nx) ** 3 + Math.abs(ny) ** 2.2;   // squarer than an ellipse
                if (q >= 1 - 0.12 * (fbm(x / 3, y / 3, 71 + i, 2) - 0.5)) return;
                const lam = clamp01(0.4 * nx - 0.85 * ny + 0.1), lip = ny < 0 && q > 0.72 && nx > -0.4 ? 0.12 : 0;
                p.solid(x, y, RP.STONE, 0.2 + 0.5 * lam + lip + 0.1 * (fbm(x / 4, y / 4, 61 + i, 3) - 0.5));
            });
            for (let x = hx - rx; x <= hx + rx; x += 2) p.solid(x, floorY + 1 - Math.round(rand() * 3), GRASS, 0.55 + 0.2 * rand());   // grass at its foot
        });
        const c = p.canvas(), cx = c.getContext('2d'), sx = Math.round(W * 0.88);
        SHIP.lander(cx, { x: sx, y: hillAt(sx) + 7, len: 44, angle: Math.PI / 2, legs: 'down', anchor: 1.1, sunDir: [-1, -0.3], light: 0.8 });
        return { canvas: c, stars: P.keepVisible(p, stars), tufts, floorY, LX, LY };
    }

    /** Eden as the orbit shows it (Worlds.js, the game's green), lit from the light we turned from. */
    function buildEden(g) {
        const r = Math.round(g.H * 0.3), size = r * 2 + 24, c = size / 2, p = P.painter(size, size, false);
        const L = P.lightVector(g.W * 0.66, g.H * 0.52, g.W * 0.1, g.H * 0.4, 220);
        if (WORLDS) WORLDS.paint(p, { cx: c, cy: c, r, type: 'EDEN', seed: 41, sector: 1, L });
        else P.sphere(p, { cx: c, cy: c, r, ramp: RP.ICE, L, surface: P.surfaceFor('ice', 41, L) });
        return { canvas: p.canvas(), r, half: c, L };
    }

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // 3. The run: phases intro → fly → (white → quiet → calm) | (turn); the heading, the drift, the shoves, the lines
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
    const S = {};
    function reset() {
        Object.assign(S, {
            phase: 'intro', t: 0, clock: 0, s: 0, off: [0, 0], ctrl: [0, 0], shove: [0, 0], jolt: 0, driftA: Math.random() * 6.28,
            lineAt: 0, alarmAt: 0, damaged: {}, label: null, lostT: 0, lostSaid: 0, lostAt: -99, isEnd: false, spoke: false,
            turnFrom: null, onCourse: 0, rng: seeded((Math.random() * 4294967295) >>> 0),
        });
        dust.splice(0, dust.length, ...Array.from({ length: 140 }, () => newMote(false)));
    }
    const dust = [];
    /** A speck of dust down the heading: across (x, y) and how far ahead (z); never straight through the middle of us. */
    function newMote(isFar) {
        const r = S.rng || Math.random, a = r() * 6.28, d = 0.08 + r() * 1.3;
        return { x: Math.cos(a) * d, y: Math.sin(a) * d * 0.75, z: isFar ? 3.2 + r() * 0.8 : 0.2 + r() * 3.8 };
    }

    // ── input: the pointer is a stick (point at the light and the light comes to the middle); the arrows, the same ──
    let pointer = null, aiming = false;
    const held = new Set();
    const STEER_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'd', 'w', 's', 'A', 'D', 'W', 'S'];
    function stick() {
        const on = (...ks) => (ks.some(k => held.has(k)) ? 1 : 0);
        const k = [on('ArrowRight', 'd', 'D') - on('ArrowLeft', 'a', 'A'), on('ArrowDown', 's', 'S') - on('ArrowUp', 'w', 'W')];
        if (k[0] || k[1]) { const n = Math.hypot(k[0], k[1]); return [k[0] / n, k[1] / n]; }
        if (!aiming || !pointer) return [0, 0];
        const dx = (pointer.x - G.CX) / (STICK_R * G.H), dy = (pointer.y - G.CY) / (STICK_R * G.H), n = Math.hypot(dx, dy);
        return n > 1 ? [dx / n, dy / n] : n < STICK_DEAD ? [0, 0] : [dx, dy];
    }

    function start() {
        reset();
        S.phase = 'fly';
        $('intro').hidden = true; $('after').hidden = true; $('turn').hidden = false;
        hideVoice();
        if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
        stage.focus({ preventScroll: true });
    }
    function turnBack() {
        if (S.phase !== 'fly') return;
        S.phase = 'turn'; S.t = 0; S.turnFrom = { off: S.off.slice(), s: S.s };
        S.damaged = {}; S.label = null;                                          // the alarms stop the moment you turn
        $('turn').hidden = true; hideVoice();
        if (!G.eden) G.eden = buildEden(G);
    }
    function finish(line) {
        say(line);
        S.isEnd = true;
    }

    function update(dt) {
        S.t += dt; S.clock += dt;
        if (S.phase === 'intro') { S.off = [Math.sin(S.clock * 0.3) * 5, Math.cos(S.clock * 0.23) * 3]; driftDust(dt, 0.3); return; }
        if (S.phase === 'fly') return fly(dt);
        if (S.phase === 'white') {
            driftDust(dt, 2.2);
            if (S.t >= WHITE_S) { S.phase = 'quiet'; S.t = 0; hideVoice(); }
            return;
        }
        if (S.phase === 'quiet') {
            if (!G.calm) G.calm = buildCalm(G);                                     // painted while the screen is white
            if (S.t >= QUIET_S) { S.phase = 'calm'; S.t = 0; }
            return;
        }
        if (S.phase === 'calm') { ending(DAWN_S, END_TRUST); return; }
        if (S.phase === 'turn') { driftDust(dt, 0.4 * (1 - Math.min(1, S.t / TURN_S))); ending(TURN_S, END_TURN); }
    }
    /** The ending's one line a beat after the picture settles, then the way out. */
    function ending(settle, line) {
        if (!S.spoke && S.t >= settle + LINE_AFTER_S) { S.spoke = true; finish(line); }
        if (S.isEnd && $('after').hidden && S.t >= settle + LINE_AFTER_S + BUTTONS_AFTER_S) $('after').hidden = false;
    }

    function fly(dt) {
        const s = S.s, H = G.H, W = G.W;
        // the ship wanders off on its own, more as the light grows, and the further off the faster it slides
        S.driftA += (hash(Math.floor(S.clock * 2) & 255, 7, 3) - 0.5) * dt * 2.4;
        const mag = DRIFT0 + (DRIFT1 - DRIFT0) * s, unstable = UNSTABLE0 + (UNSTABLE1 - UNSTABLE0) * s;
        const drift = [Math.cos(S.driftA) * mag + S.off[0] * unstable, Math.sin(S.driftA) * mag * 0.7 + S.off[1] * unstable];
        const want = stick().map(v => v * STEER_V), k = Math.min(1, dt * 6);
        S.ctrl = S.ctrl.map((c, i) => c + (want[i] - c) * k);
        const decay = Math.exp(-dt * SHOVE_DECAY);
        S.shove = S.shove.map(v => v * decay); S.jolt *= Math.exp(-dt * 3);
        S.off = S.off.map((o, i) => Math.max(-MAX_OFF[i] * (i ? H : W), Math.min(MAX_OFF[i] * (i ? H : W), o + (drift[i] + S.shove[i] - S.ctrl[i]) * dt)));
        // headway: full inside ON_R, none past OFF_R
        const dist = Math.hypot(S.off[0], S.off[1]);
        S.onCourse = 1 - ss(ON_R * H, OFF_R * H, dist);
        S.s = Math.min(1, s + dt / HOLD_S * S.onCourse);
        S.lostT = S.onCourse < 0.2 ? S.lostT + dt : 0;
        if (S.lostT > LOST_S && S.clock - S.lostAt > LOST_AGAIN_S && S.clock > (S.voiceUntil || 0) - 1) {
            S.lostAt = S.clock; say(LOST_LINES[Math.min(S.lostSaid++, LOST_LINES.length - 1)]);
        }
        while (S.alarmAt < ALARMS.length && S.s >= ALARMS[S.alarmAt].at) {       // an alarm: a deck goes red, the ship is shoved
            const a = ALARMS[S.alarmAt++], ang = S.rng() * 6.28, f = SHOVE0 + SHOVE1 * S.s;
            S.damaged = Object.assign({}, S.damaged, { [a.deck]: true });
            if (a.label) S.label = a.label;
            S.shove = [S.shove[0] + Math.cos(ang) * f, S.shove[1] + Math.sin(ang) * f * 0.7];
            S.jolt = 1;
        }
        while (S.lineAt < LINES.length && S.s >= LINES[S.lineAt].at) say(LINES[S.lineAt++]);
        if (S.voiceUntil && S.clock > S.voiceUntil) hideVoice();
        driftDust(dt, (0.35 + 1.7 * S.s) * (0.12 + 0.88 * S.onCourse));          // off course, the dust all but stops: no headway
        if (S.s >= 1) { S.phase = 'white'; S.t = 0; $('turn').hidden = true; hideVoice(); }   // then nobody speaks: quiet
    }
    function driftDust(dt, speed) {
        for (let i = 0; i < dust.length; i++) { const m = dust[i]; m.z -= speed * dt; if (m.z < 0.08) dust[i] = newMote(true); }
    }

    // ── words: one line at a time, with the speaker's portrait ──
    function say(line) {
        const who = WHO[line.who], v = $('voice'), face = $('face');
        v.className = 'voice tone-' + who.tone;
        $('who-name').textContent = who.name;
        $('line').textContent = line.say;
        face.hidden = !who.face; $('who-ring').hidden = !!who.face;
        $('voice').querySelector('.film-line').classList.toggle('is-narr', !who.face);
        if (who.face) face.src = FACE_SRC(who.face);
        void v.offsetWidth;                                                         // restart the fade in
        v.classList.add('is-in');
        const words = line.say.split(/\s+/).length;
        S.voiceUntil = S.clock + Math.min(6, Math.max(3.4, 1.8 + words * 0.3));
    }
    function hideVoice() { $('voice').classList.remove('is-in'); S.voiceUntil = 0; }

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // 4. Drawing: space ahead and the growing light; the calm place; Eden. Art pixels, a pixel buffer, brighter-only light
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
    let buf = null;                                                                 // this frame's pixels (Uint32 over G.img)
    /** NSPaint's painter calls (region, tone, add) over this frame's pixels, so lightGlow paints the light as it is, every
        frame; light only ever adds (where it is brighter than what is there), as in the corridor. */
    const glowPainter = {
        region(x0, y0, x1, y1, fn) {
            for (let y = Math.max(0, Math.floor(y0)); y < Math.min(G.H, Math.ceil(y1)); y++) for (let x = Math.max(0, Math.floor(x0)); x < Math.min(G.W, Math.ceil(x1)); x++) fn(x, y);
        },
        tone(x, y, r) { lightPx(x, y, r, 1); },                                     // inside the core: white (the corridor's drawSun), no dark ring when it is big
        add(x, y, r, v) { lightPx(x, y, r, v); },
    };
    function lightPx(x, y, r, v) {
        x = Math.round(x); y = Math.round(y);
        if (x < 0 || y < 0 || x >= G.W || y >= G.H) return;
        const k = P.level(r, v, x, y);
        if (!k) return;
        const pk = pack(r), i = y * G.W + x;
        if (pk.l[k] > lum32(buf[i])) buf[i] = pk.c[k];
    }
    /** Mix pixel i toward rgb c by a, in `steps` dithered steps: shade that darkens or light that whitens, never a screen door. */
    function mixPx(x, y, c, a, steps) {
        a = Math.min(1, Math.floor(a * steps + threshold(x, y)) / steps);
        if (a <= 0) return;
        const i = y * G.W + x, p = buf[i], r = p & 255, g = (p >> 8) & 255, b = (p >> 16) & 255;
        buf[i] = (0xff000000 | (Math.round(b + (c[2] - b) * a) << 16) | (Math.round(g + (c[1] - g) * a) << 8) | Math.round(r + (c[0] - r) * a)) >>> 0;
    }
    /** A line of light from (x0, y0) to (x1, y1), its tone running v0 → v1 (a dust streak). */
    function streak(x0, y0, x1, y1, r, v0, v1) {
        x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
        const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, n = Math.max(1, dx, -dy);
        for (let k = 0, err = dx + dy; k < 400; k++) {
            lightPx(x0, y0, r, v0 + (v1 - v0) * Math.min(1, k / n));
            if (x0 === x1 && y0 === y1) break;
            const e2 = 2 * err;
            if (e2 >= dy) { err += dy; x0 += sx; }
            if (e2 <= dx) { err += dx; y0 += sy; }
        }
    }

    /** The light by how far in we are: a point with a soft halo at first, filling the window at the end. */
    function lightOf(s) {
        return { core: 1.6 + 30 * s ** 2.4, halo: 10 + 120 * s ** 1.7, strength: 1 + 0.35 * s, spikes: 4 + 12 * s };
    }
    const SMALL = { core: 1.2, halo: 7, strength: 0.9, spikes: 3 };               // the light, far behind, after the turn

    /** Where the light is this frame, how big, how much the view shakes, how much of the window the bloom fills. */
    function viewNow() {
        const W = G.W, H = G.H;
        let off = S.off, L = lightOf(S.phase === 'intro' ? 0 : S.s), bloom = 0.62 * ss(0.45, 1, S.s), fadeDust = 1;
        if (S.phase === 'white') {                                                  // still growing as it whites out
            const k = S.t / WHITE_S;
            L = lightOf(1 + 0.4 * k); bloom = 0.62 + 0.5 * k;
        }
        if (S.phase === 'turn') {                                                   // the view swings away: the light slides off and shrinks
            const k = ss(0, 1, Math.min(1, S.t / (TURN_S * 0.8))), from = lightOf(S.turnFrom.s);
            off = [lerp(S.turnFrom.off[0], -W * 0.4, k), lerp(S.turnFrom.off[1], -H * 0.1, k)];
            L = { core: lerp(from.core, SMALL.core, k), halo: lerp(from.halo, SMALL.halo, k), strength: lerp(from.strength, SMALL.strength, k), spikes: lerp(from.spikes, SMALL.spikes, k) };
            bloom = 0.62 * ss(0.45, 1, S.turnFrom.s) * (1 - k); fadeDust = 1 - k;
        }
        const shakeA = S.phase === 'fly' || S.phase === 'white' ? 1.4 * ss(0.4, 1, S.s) + 2.2 * S.jolt : 0;
        const sh = shakeA > 0.3 ? [Math.round((Math.random() - 0.5) * shakeA), Math.round((Math.random() - 0.5) * shakeA * 0.75)] : [0, 0];
        return { lx: Math.round(G.CX + off[0]) + sh[0], ly: Math.round(G.CY + off[1]) + sh[1], L, bloom, fadeDust };
    }

    function drawSpace(ms) {
        const W = G.W, H = G.H, B = G.back, v = viewNow(), bx = v.lx - B.LP[0], by = v.ly - B.LP[1];
        ctx.fillStyle = INK; ctx.fillRect(0, 0, W, H);
        ctx.drawImage(B.canvas, bx, by);
        ctx.save(); ctx.translate(bx, by);                                          // the sky's slow motion and its twinkle, fixed to it
        if (B.sky && B.sky.live) B.sky.live(ctx, ms, 0);
        P.twinkle(P.framer(ctx, B.BW, B.BH), B.stars, ms);
        ctx.restore();
        if (S.phase === 'turn' && G.eden) drawEden(ms);
        ctx.drawImage(G.shade, 0, 0);
        const plume = S.phase === 'turn' ? 0.55 : S.phase === 'intro' ? 0.3 : 0.4 + 0.5 * S.s;
        const flashing = Math.floor(S.clock * 2) % 2 === 0;                          // the alarms come and go, once a second
        SHIP.draw(ctx, G.shipL, ms, { damaged: flashing ? S.damaged : {}, labels: false, plume });
        const img = ctx.getImageData(0, 0, W, H);
        buf = new Uint32Array(img.data.buffer);
        const white = S.phase === 'white' ? ss(0, 1, S.t / WHITE_S) ** 1.4 * 1.05 : 0;
        if (white < 1) {                                                            // once all is white, nothing under it needs painting
            paintLight(v.lx, v.ly, v.L, 1 + 0.05 * Math.sin(S.clock * 1.7));
            if (v.bloom > 0.01) bloomPass(v);
            drawDust(v);
        }
        if (S.phase === 'fly') alarmEdges();
        shadeWords();
        whiten(white);
        ctx.putImageData(img, 0, 0);
        if (S.phase === 'fly') { reticle(); alarmWord(); }
    }

    /** The light. While it is small, NSPaint.lightGlow paints it, as the travel view does. Once it fills the window that is
        too slow for every frame (every pixel works out three exponentials), so the same numbers are looked up by distance
        from a table made once a frame, as the corridor's drawSun does. Light only adds; the core is white. */
    const GLOW_LUT = new Float32Array(1600), FAST_REACH = 120;
    function paintLight(lx, ly, o, breath) {
        const reach = o.halo * 3.2 + o.core + 8;
        if (reach < FAST_REACH) { P.lightGlow(glowPainter, lx, ly, o, breath); return; }
        const s = o.strength * breath, k1 = o.core * 0.5 + 1.4, k2 = o.halo * 0.32 + 1, k3 = o.halo * 1.1 + 1, k4 = o.halo * 0.9 + 8;
        const n = Math.min(GLOW_LUT.length - 2, Math.ceil(reach) + 1);
        for (let d = 0; d <= n; d++) GLOW_LUT[d] = s * (1.15 * Math.exp(-Math.max(0, d - o.core) / k1) + 0.7 * Math.exp(-d / k2) + 0.34 * Math.exp(-d / k3)) * (1 - ss(reach * 0.55, reach, d));
        const sun = pack(RP.SUN), top = RP.SUN.rgb.length - 1, white = sun.c[top], W = G.W, H = G.H;
        for (let y = Math.max(0, Math.floor(ly - reach)); y < Math.min(H, Math.ceil(ly + reach)); y++) {
            const dy = (y + 0.5 - ly) * 1.06, ady = Math.abs(dy), row = y * W;
            for (let x = Math.max(0, Math.floor(lx - reach)); x < Math.min(W, Math.ceil(lx + reach)); x++) {
                const dx = x + 0.5 - lx, d = Math.sqrt(dx * dx + dy * dy);
                if (d >= reach) continue;
                const i = row + x;
                if (d < o.core) { buf[i] = white; continue; }
                const di = d | 0, f = d - di, fade = 1 - ss(reach * 0.55, reach, d), adx = Math.abs(dx);
                let v = GLOW_LUT[di] + (GLOW_LUT[di + 1] - GLOW_LUT[di]) * f;
                if (ady < 0.6) v += 0.34 * s * Math.exp(-adx / k4) * fade;                                // the streak across
                if (o.spikes && (adx < 0.6 || ady < 0.6)) v += 0.7 * Math.exp(-d / o.spikes) * fade;    // the four spikes
                if (v < 0.004) continue;
                const pos = (v > 1 ? 1 : v) * top, lo = pos | 0, k = pos - lo > threshold(x, y) ? lo + 1 : lo;
                if (k && sun.l[k] > lum32(buf[i])) buf[i] = sun.c[k];
            }
        }
    }

    /** Deep in, a warm bloom that fills the window (the corridor's sector 6 bloom). */
    const BLOOM_LUT = new Float32Array(2048);                                       // the bloom by distance, one art pixel a step
    function bloomPass(v) {
        const W = G.W, H = G.H, R = H * (0.3 + 0.9 * v.bloom), sun = pack(RP.SUN), top = RP.SUN.rgb.length - 1;
        for (let d = 0; d < BLOOM_LUT.length; d++) BLOOM_LUT[d] = v.bloom * Math.exp(-d / R);
        for (let y = 0; y < H; y++) {
            const dy2 = ((y - v.ly) * 1.1) ** 2, row = y * W;
            for (let x = 0; x < W; x++) {
                const a = BLOOM_LUT[Math.min(2047, Math.sqrt((x - v.lx) * (x - v.lx) + dy2) | 0)];
                if (a < 0.04) continue;
                const pos = Math.min(1, a) * top, lo = pos | 0, k = pos - lo > threshold(x, y) ? lo + 1 : lo;   // P.level, inlined: this runs on every pixel
                if (k && sun.l[k] > lum32(buf[row + x])) buf[row + x] = sun.c[k];
            }
        }
    }
    /** Dust streaming past toward us from the light (the vanishing point), lit warm near it; faster the deeper in. */
    function drawDust(v) {
        if (v.fadeDust <= 0.02) return;
        const F = G.H * 0.14, tail = 0.05 + 0.2 * S.s, reach = v.L.halo * 1.6 + 24, n = Math.round(dust.length * v.fadeDust);
        for (let i = 0; i < n; i++) {
            const m = dust[i], ax = v.lx + m.x / m.z * F, ay = v.ly + m.y / m.z * F, bz = m.z + tail, bx = v.lx + m.x / bz * F, by = v.ly + m.y / bz * F;
            if (ax < -20 || ay < -20 || ax > G.W + 20 || ay > G.H + 20) { dust[i] = newMote(true); continue; }
            const near = clamp01((2.4 - m.z) / 2.2), lit = Math.exp(-Math.hypot(ax - v.lx, ay - v.ly) / reach), tone = 0.25 + 0.6 * near;
            streak(ax, ay, bx, by, lit > 0.35 ? RP.SUN : RP.STAR, tone * (lit > 0.35 ? 0.6 + 0.5 * lit : 1), tone * 0.35);
        }
    }
    /** An alarm: the window's edges flash emergency red, a thin dithered band (the corridor's scrape flash, quieter). */
    function alarmEdges() {
        if (!Object.keys(S.damaged).length || Math.floor(S.clock * 2) % 2) return;
        const W = G.W, H = G.H, red = pack(RP.RED), depth = 4 + 3 * S.s;
        for (let y = 0; y < H; y++) {
            const ey = Math.min(y, H - 1 - y);
            for (let x = 0; x < W; x++) {
                const e = Math.min(x, W - 1 - x, ey);
                if (e >= depth) { if (ey >= depth) x = Math.max(x, W - 1 - Math.ceil(depth)); continue; }
                const a = 0.42 * (1 - e / depth);
                if (a > threshold(x, y)) buf[y * W + x] = red.c[P.level(RP.RED, 0.35 + 0.35 * a, x, y)];
            }
        }
    }
    /** Under the words the picture darkens with the grain (reading.css's rule), so they read even inside the light. */
    function shadeWords() {
        const ink = hexRgb(INK), px = G.px, pad = 10;
        const els = [$('voice').classList.contains('is-in') ? $('voice').querySelector('.film-line') : null, $('turn').hidden ? null : $('turn'),
            $('intro').hidden ? null : $('intro'), $('after').hidden ? null : $('after')];
        els.forEach(el => {
            if (!el) return;
            const r = el.getBoundingClientRect(), x0 = Math.floor(r.left / px) - pad, x1 = Math.ceil(r.right / px) + pad, y0 = Math.floor(r.top / px) - pad, y1 = Math.ceil(r.bottom / px) + pad;
            for (let y = Math.max(0, y0); y < Math.min(G.H, y1); y++) for (let x = Math.max(0, x0); x < Math.min(G.W, x1); x++) {
                const e = Math.min(x - x0, x1 - 1 - x, y - y0, y1 - 1 - y) / pad;
                const lum = lum32(buf[y * G.W + x]) / 255;
                if (lum > 0.26) mixPx(x, y, ink, Math.min(0.86, (lum - 0.26) * 1.9) * ss(0, 1, e), 6);
            }
        });
    }
    function whiten(a) {
        if (a <= 0) return;
        if (a >= 1) { buf.fill(c32(WHITE)); return; }
        for (let y = 0; y < G.H; y++) for (let x = 0; x < G.W; x++) mixPx(x, y, WHITE, a, 8);
    }
    /** Where on course is: four quiet corner marks round the middle; brighter while the light is inside them. */
    function reticle() {
        const r = Math.round(ON_R * G.H), arm = 4, c = S.onCourse > 0.9 ? RP.UI.hex[4] : RP.UI.hex[2];
        ctx.fillStyle = c;
        [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([kx, ky]) => {
            const x = G.CX + kx * r, y = G.CY + ky * r;
            ctx.fillRect(kx < 0 ? x : x - arm + 1, y, arm, 1);
            ctx.fillRect(x, ky < 0 ? y : y - arm + 1, 1, arm);
        });
        // off course: a small chevron beside the marks, blinking, pointing the way to the light
        if (S.onCourse > 0.6 || Math.floor(S.clock * 3) % 2) return;
        const n = Math.hypot(S.off[0], S.off[1]) || 1, ux = S.off[0] / n, uy = S.off[1] / n, d = r * 1.45 + 6;
        const cx = Math.round(G.CX + ux * d), cy = Math.round(G.CY + uy * d), px = -uy, py = ux;
        ctx.fillStyle = RP.UI.hex[4];
        for (let k = -5; k <= 5; k++) for (let w = 0; w < 2; w++) {                // a V two pixels thick, its point toward the light
            const back = Math.abs(k) * 0.8 + w;
            ctx.fillRect(Math.round(cx + px * k - ux * back), Math.round(cy + py * k - uy * back), 1, 1);
        }
    }
    /** The ship's alarm word beside the decks, blinking red. */
    function alarmWord() {
        if (!S.label || Math.floor(S.clock * 3) % 3 === 2) return;
        ctx.fillStyle = RP.RED.hex[3];
        P.pixelText(S.label, Math.round(G.shipL.cx + G.shipL.D + 10), G.H - 26, (x, y) => ctx.fillRect(x, y, 1, 1));
    }

    function drawEden(ms) {
        const E = G.eden, k = ss(0, 1, clamp01((S.t - 0.7) / (TURN_S - 0.7))), cx = Math.round(G.W * 0.66 + (1 - k) * G.W * 0.75), cy = Math.round(G.H * 0.52);
        ctx.drawImage(E.canvas, cx - E.half, cy - E.half);
        if (WORLDS && k > 0.99) WORLDS.live(P.framer(ctx, G.W, G.H), null, cx, cy, E.r, ms, { L: E.L, sector: 1, type: 'EDEN', seed: 41 });
    }

    function drawCalm(ms) {
        const C = G.calm, W = G.W, tq = Math.floor(ms / 125) * 125;                // the moving layer steps eight times a second
        ctx.drawImage(C.canvas, 0, 0);
        const f = P.framer(ctx, W, G.H);
        P.twinkle(f, C.stars, tq);
        C.tufts.forEach((b, i) => { if (Math.sin(tq / 900 + b.ph) > 0.55) f.tone(b.x + 1, b.y, GRASS, 0.7); else f.tone(b.x, b.y, GRASS, 0.62); });
        for (let i = 0; i < 22; i++) {                                              // specks drifting up in the warm air
            const sp = 4 + 6 * hash(i, 1, 19), x = (hash(i, 2, 19) * W + tq / 1000 * sp) % W, y = G.H * (0.45 + 0.4 * hash(i, 3, 19)) - ((tq / 1000 * sp * 0.4) % (G.H * 0.3));
            f.tone(x, y + Math.sin(tq / 1100 + i) * 2, POLLEN, 0.35 + 0.5 * hash(i, 4, 19) * Math.exp(-Math.abs(x - C.LX) / W));
        }
        if (CREW) GROUP.forEach((m, i) => CREW.person(ctx, m.id, m.act, ms + i * 337, Math.round(W * m.x), C.floorY, { facing: 1, warm: 1, rim: 1 }));
        const k = 1 - ss(0, 1, S.t / DAWN_S);
        if (k > 0) {                                                                // the white clears into the calm place
            const img = ctx.getImageData(0, 0, W, G.H);
            buf = new Uint32Array(img.data.buffer);
            whiten(k * 1.05);
            ctx.putImageData(img, 0, 0);
        }
        if (S.isEnd) {                                                              // the words over the sky, still with the grain under them
            const img = ctx.getImageData(0, 0, W, G.H);
            buf = new Uint32Array(img.data.buffer);
            shadeWords();
            ctx.putImageData(img, 0, 0);
        }
    }

    function render(ms) {
        if (S.phase === 'quiet') { ctx.fillStyle = '#fff3dc'; ctx.fillRect(0, 0, G.W, G.H); return; }
        if (S.phase === 'calm') return drawCalm(ms);
        drawSpace(ms);
    }

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // 5. Wiring: the loop, the buttons, the keys, the pointer, resizing
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
    let last = 0, acc = 0, renderMs = 0;
    function frame(now) {
        requestAnimationFrame(frame);
        const dt = Math.min(0.1, (now - (last || now)) / 1000);
        last = now; acc += dt;
        if (acc < 1 / FPS - 0.002) return;
        const step = Math.min(0.1, acc); acc = 0;
        try {
            update(step);
            const t0 = performance.now();
            render(now);
            renderMs = renderMs * 0.9 + (performance.now() - t0) * 0.1;           // for the test hook: how heavy a frame is
        } catch (e) { console.error('The Last Approach:', e); }
    }

    document.addEventListener('click', e => {
        const b = e.target.closest('button[data-act]');
        if (!b) return;
        if (b.dataset.act === 'start') start();
        if (b.dataset.act === 'turn') turnBack();
    });
    window.addEventListener('keydown', e => {
        const k = e.key;
        if (STEER_KEYS.includes(k)) { held.add(k); aiming = false; e.preventDefault(); return; }
        if (e.repeat) return;
        const isOnButton = e.target && e.target.tagName === 'BUTTON';
        const isWaiting = S.phase === 'intro' || (S.isEnd && !$('after').hidden);
        if (isWaiting && (k === '1' || ((k === 'Enter' || k === ' ') && !isOnButton))) { e.preventDefault(); start(); return; }
        if (isWaiting && k === '2') { location.href = 'index.html'; return; }
        if (S.phase === 'fly' && (k === 't' || k === 'T')) { e.preventDefault(); turnBack(); }
    });
    window.addEventListener('keyup', e => { held.delete(e.key); });
    window.addEventListener('blur', () => held.clear());
    stage.addEventListener('pointermove', e => { pointer = { x: e.clientX / G.px, y: e.clientY / G.px }; aiming = true; });
    stage.addEventListener('pointerleave', () => { pointer = null; });
    let resizeTimer = 0;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            G = build();
            if (S.phase === 'quiet' || S.phase === 'calm') G.calm = buildCalm(G);
            if (S.phase === 'turn') G.eden = buildEden(G);
            render(performance.now());
        }, 150);
    });

    // the portraits, fetched now so a face never pops in after its line
    Object.values(WHO).forEach(w => { if (w.face) { const im = new Image(); im.src = FACE_SRC(w.face); } });

    G = build();
    reset();
    requestAnimationFrame(frame);

    window.lastApproach = {
        state: () => ({
            phase: S.phase, t: +S.t.toFixed(2), s: +S.s.toFixed(3), off: S.off.map(v => Math.round(v)), onCourse: +S.onCourse.toFixed(2),
            light: [(G.CX + S.off[0]) * G.px, (G.CY + S.off[1]) * G.px], isEnd: S.isEnd, line: $('line').textContent,
            alarms: Object.keys(S.damaged), art: [G.W, G.H, G.px], renderMs: +renderMs.toFixed(1), lostSaid: S.lostSaid,
        }),
        /** Tests only: jump the flight to share s of the way in (the lines and alarms before it are skipped). */
        skipTo: s => { if (S.phase !== 'fly') return; S.s = s; while (S.lineAt < LINES.length && LINES[S.lineAt].at < s - 0.02) S.lineAt++; },
    };
})();
