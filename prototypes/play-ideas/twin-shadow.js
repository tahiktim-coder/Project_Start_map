/* ═══ Silent Exodus · play ideas · twin-shadow.js: TWIN SHADOW, sector 5's jump flight as a chase ═══════════════════════
   What it is: a standalone mock of one minigame idea (nothing in the game is changed). In the real jump flight
   (src/systems/minigames/Corridor.js) sector 5 has a ship exactly like ours flying beside us, a quarter of a second late.
   Here it is the whole flight: seen side on, our Lander crosses a debris field toward the light, and the twin (our Lander
   again, its windows dark) flies behind us on our own path, a quarter of a second late, slowly closing in. The player moves
   up and down. To shake it, lure it: hold a line on a piece of debris and turn away at the last moment, so the twin, still
   copying where we were, flies into it. A hit only counts on a piece we cut close (luck does not shake it), and after each
   one it drops back into the dark and weaves in again for a few seconds, off our path, before it can be lured again; hurt,
   it trails smoke and its drive sputters. Three hits and it falls back into the dark. If it catches us, the screen goes cold
   and A.U.R.A. says something plainly unsettling; it drops back and the flight goes on (no game over). The flight ends when
   the debris does. The decision: when to cut it close (too close and the debris scrapes us, and the twin gains).

   Reuses the real art, loaded as it is: NSPaint (ramps, the 8 x 8 Bayer dither, noise, the false sun, the space strip),
   NSSky / NSSky2 (sector 5's place in sky F: "the tally", the ring nebula like an eye), SectorLooks' sector 5 numbers,
   MiniShip.lander (our Lander and the twin, painted by MiniPaint's hull; wrecks with rust and holes). The debris is
   Corridor.js's: its torn hull plates (the same four-edged shard, lit edge toward the light, tumbling edge-on, glints) and
   the dust that streaks past, drawn side on; rocks are added in the same recipe (STONE ramp, seeded noise, one light).
   play-shade.js darkens the picture under the words.
   NO SOUND: nothing here makes any (MiniLab's sound only ever wakes through the game's AudioSystem, which is not loaded).

   The art grid: one art pixel is a whole number of screen pixels (3 at 1920 x 1080, 2 at 1280 x 720: both 640 x 360 art
   pixels), so the dither stays crisp. Everything below thinks in art pixels; K scales the tuning from a 640-wide picture.
   Test hooks: window.twinShadow.state() → the run's numbers; ?seed=N fixes the debris; ?field=N makes the field N s long. */
(function () {
    'use strict';
    const P = window.NSPaint, SKY = window.NSSky, SKY2 = window.NSSky2, SHIP = window.MiniShip, MP = window.MiniPaint;
    if (!P || !SHIP || !MP) { document.getElementById('line').textContent = 'Twin Shadow could not load its art.'; return; }
    const { INK, RP, threshold, fbm, smooth, clamp01, seeded, hash, norm3 } = P;

    // ── the play: tuning (px are at 640 wide; K scales them) ──
    const url = new URLSearchParams(location.search);
    const fixedSeed = url.has('seed') ? (Number(url.get('seed')) >>> 0) || 1 : null;
    // s: the debris field, start to clear space (?field=N shortens it, for testing)
    const FIELD_S = url.has('field') ? Math.max(20, Math.min(120, Number(url.get('field')) || 75)) : 75;
    const DEBRIS_FROM = 4.5, DEBRIS_UNTIL = FIELD_S - 5; // s: quiet before the first piece; the field thins before the end
    const FLY = 130;                                     // px/s: the field passing us
    const LAG = 0.25;                                    // s: how late the twin copies us, on our own path
    const SHIP_LEN = 60, SHIP_AT = 0.56;                 // our Lander's length; where it flies across the picture
    const LANE = [0.34, 0.86];                            // the band our centre may fly in (shares of the height): the words sit above
    const VMAX = 240, EASE_V = 12, AIM_GAIN = 9;         // px/s up or down at most; how keenly the ship takes up a new speed; the pointer's pull
    const TWIN_IN_AT = 3.5, ENTER_K = 1.1;               // s into the flight the twin comes out of the dark; how slowly it settles in
    const GAP0 = 62, CLOSE = 3.2;                        // px between its nose and our tail when it settles; px/s it gains
    const SCRAPE_GAIN = 12, GAP_MAX = 104;               // a scrape lets it gain; never further back than this
    const HITS_TO_SHAKE = 3;
    // A hit has to be earned: it only counts on a piece we passed within CUT_CLOSE px of (a lure, not luck), and after a hit
    // the twin drops back into the dark and weaves its way in again for RECOVER_S, off our path, so it cannot be hit then.
    const CUT_CLOSE = 18, RECOVER_S = 6.5, DROP_S = 2.2;
    const CATCH_AT = -0.12;                              // the gap (in lengths) at which it has caught us: it overlaps
    const COLD_S = 3.4, COLD_IN = 0.3, COLD_OUT = 0.7, COLD_SLOW = 0.12;   // the cold: how long, fade in / out, the world's speed in it
    const FALL_S = 3.6, OUT_S = 1.4;                     // the twin's fall after the third hit; the pause before the result
    const SAY_MS = 2800, GAP_LINES = 0.6;                // how long a line in the play stays; the quiet between two lines
    // our hit box is a little smaller than the hull, so a close call reads as close, not unfair; the twin's is the same (it
    // is our ship): it only meets what we led it into
    const OURS = { hw: 0.44, hh: 0.36, r: 0.75, pad: 0 }, TWINS = OURS;

    // ── the picture ──
    const LOOK5 = { seed: 55, dust: 0.1, haze: 0.8, stars: 1.1, light: { core: 11, halo: 58, strength: 1, spikes: 10 } };   // SectorLooks.js sector 5
    const SUN_DIR = [0.95, -0.3];                        // the false sun is ahead and a little above: our hulls' warm rim
    const ICE = RP.ICE, PORTHOLE = RP.AMBER.hex[4], BRIDGE = RP.AMBER.hex[3];
    const c32 = rgb => (0xff000000 | (rgb[2] << 16) | (rgb[1] << 8) | rgb[0]) >>> 0;
    const ICE32 = Uint32Array.from(ICE.rgb.map(c32));
    const lerp = (a, b, k) => a + (b - a) * k;
    const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // 1. The size: a whole number of screen pixels per art pixel; where the ships fly
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
    const stage = document.getElementById('stage'), canvas = document.getElementById('view');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });   // the cold reads the frame back
    let G = null;                                        // the built picture for this window size

    function measure() {
        const px = Math.max(1, Math.round(window.innerHeight / 360)), W = Math.ceil(window.innerWidth / px), H = Math.ceil(window.innerHeight / px);
        document.documentElement.style.setProperty('--t', clamp01((window.innerWidth - 1280) / 640).toFixed(3));
        document.documentElement.style.setProperty('--px', px + 'px');
        return { px, W, H };
    }
    function geometry(px, W, H) {
        const K = W / 640, len = Math.round(SHIP_LEN * K), ht = len * SHIP.ASPECT;
        return { px, W, H, K, len, ht, shipX: Math.round(W * SHIP_AT), top: Math.round(H * LANE[0]), bottom: Math.round(H * LANE[1]),
            LP: [Math.round(W * 0.945), Math.round(H * 0.43)] };
    }

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // 2. The still backdrop: sector 5's sky F, the space strip, the false sun (painted once per size)
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
    function buildBackdrop(g) {
        const { W, H, LP } = g, ox = Math.round(W / 2 - 320), oy = Math.round(H / 2 - 180);
        let sky = null;
        try { sky = SKY2 ? SKY2.build(W, H, ox, oy, 5, [LP[0] - ox, LP[1] - oy], 'f') : null; } catch (e) { console.warn('Twin Shadow: no sky F', e); }
        const strip = P.spaceStrip(W + 4, H, LOOK5.seed, LOOK5.dust, LOOK5.haze * (sky ? sky.haze : 1), LOOK5.stars), lit = new Float32Array(W * H);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) lit[y * W + x] = Math.exp(-Math.hypot(x - LP[0], (y - LP[1]) * 1.15) / (LOOK5.light.halo * 0.85 + 6));
        const bp = P.painter(W, H, true), reach = LOOK5.light.halo * 0.9 + LOOK5.light.core + 8;
        const keep = (x, y) => Math.hypot(x - LP[0], y - LP[1]) < reach;
        const bright = sky && SKY ? SKY.paintSpace(bp, strip, 0, lit, keep, sky, 0) : P.paintSpace(bp, strip, 0, lit, keep);
        P.lightGlow(bp, LP[0], LP[1], LOOK5.light, 1);
        return { canvas: bp.canvas(), sky, stars: P.keepVisible(bp, bright) };
    }

    function build() {
        const m = measure(), g = geometry(m.px, m.W, m.H);
        canvas.width = g.W; canvas.height = g.H;
        canvas.style.width = g.W * m.px + 'px'; canvas.style.height = g.H * m.px + 'px';
        const t0 = performance.now();
        g.back = buildBackdrop(g);
        g.layer = P.pixelLayer(g.W, g.H);
        g.buildMs = Math.round(performance.now() - t0);
        G = g;
        if (S) { S.y = clampY(S.y); S.motes = makeMotes(S.rand); }
    }

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // 3. The debris: Corridor.js's torn hull plates and the rocks among them, seen side on
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
    /** A torn plate: four straight edges round the centre (Corridor.js plate / shardAt, the same numbers). */
    const plate = r => [0, 1, 2, 3].map(k => { const a = k * 1.571 + (r() - 0.5) * 0.9, d = 0.45 + r() * 0.55; return [Math.cos(a) * d, Math.sin(a) * d * 0.6]; });
    const crs = (ax, ay, bx, by) => ax * by - ay * bx;
    const shardAt = (pts, u, v) => pts.some(([ax, ay], i) => {
        const [bx, by] = pts[(i + 1) % 4];
        return crs(ax, ay, u, v) >= 0 && crs(bx - ax, by - ay, u - ax, v - ay) >= 0 && crs(-bx, -by, u - bx, v - by) >= 0;
    });
    /** A rock's outline: its radius at 64 angles round it, roughened with seeded noise. */
    const rockProfile = seed => Float32Array.from({ length: 64 }, (_, i) => { const a = i / 64 * Math.PI * 2; return 0.74 + 0.36 * fbm(Math.cos(a) * 1.4 + seed, Math.sin(a) * 1.4, seed & 255, 3); });

    /** One piece of debris. near: in our plane (it can hit us); far: behind us, slower and dimmer (depth only). */
    function makePiece(rand, x, y, r, isNear) {
        const isRock = rand() < 0.5, seed = Math.floor(rand() * 9999);
        return { x, y, r, near: isNear, rock: isRock, seed, pts: isRock ? null : plate(rand), prof: isRock ? rockProfile(seed % 97) : null,
            ramp: isRock ? (rand() < 0.25 ? RP.DUST : RP.STONE) : rand() < 0.45 ? RP.RUST : RP.HULL,
            a0: rand() * 6.28, spin: (rand() - 0.5) * (isRock ? 1.4 : 3.2), flip: 0.5 + rand() * 2.5,
            vy: isNear ? 0 : (rand() - 0.5) * 7,                 // ours hold their line, so the twin meets only what we led it into
            speed: isNear ? 1 : 0.3 + rand() * 0.3, dim: isNear ? 1 : 0.32 + rand() * 0.18, gone: false, passed: false, clear: Infinity };
    }

    /** The unit vector from (x, y) toward the false sun. */
    function towardLight(x, y) { const dx = G.LP[0] - x, dy = G.LP[1] - y, d = Math.hypot(dx, dy) || 1; return [dx / d, dy / d]; }

    /** A plate, tumbling: it turns in the picture and swings edge-on and back; the edge facing the light is bright. */
    function drawPlate(pl, f, t) {
        const r = f.r, a = f.a0 + f.spin * t, face = Math.cos(f.flip * t + f.a0), sq = 0.22 + 0.78 * Math.abs(face);
        const ca = Math.cos(a), sa = Math.sin(a), [Lx, Ly] = towardLight(f.x, f.y), lu = (Lx * ca + Ly * sa) / r, lv = (-Lx * sa + Ly * ca) / r;
        const inside = (u, v) => shardAt(f.pts, u, v / sq);
        if (r < 1.6) { pl.tone(f.x, f.y, f.ramp, 0.5 * f.dim); return; }
        for (let py = Math.floor(f.y - r - 1); py <= Math.ceil(f.y + r + 1); py++) for (let px = Math.floor(f.x - r - 1); px <= Math.ceil(f.x + r + 1); px++) {
            const dx = px + 0.5 - f.x, dy = py + 0.5 - f.y, u = (dx * ca + dy * sa) / r, v = (-dx * sa + dy * ca) / r;
            if (!inside(u, v)) continue;
            const edge = !inside(u + lu, v + lv) ? 1 : !inside(u - lu, v - lv) ? 2 : 0, lean = (dx * Lx + dy * Ly) / r;
            const tone = edge === 1 ? 0.86 : edge === 2 ? 0.1 : 0.3 + 0.24 * lean + 0.3 * Math.abs(face);
            pl.tone(px, py, edge === 1 ? RP.HULL : f.ramp, tone * f.dim);
        }
        if (face > 0.97 && f.near) {                                                // a glint: a point and a small cross
            const gx = Math.round(f.x + Lx), gy = Math.round(f.y + Ly), arm = Math.min(4, Math.floor(r / 2));
            pl.tone(gx, gy, RP.STAR, 1);
            for (let i = 1; i <= arm; i++) [[i, 0], [-i, 0], [0, i], [0, -i]].forEach(([dx, dy]) => pl.tone(gx + dx, gy + dy, RP.STAR, 1 - i / (arm + 1)));
        }
    }
    /** A rock: a rough lump lit from the light's side, its surface turning with it. */
    function drawRock(pl, f, t) {
        const r = f.r, a = f.a0 + f.spin * t, ca = Math.cos(a), sa = Math.sin(a), [Lx, Ly] = towardLight(f.x, f.y), L3 = norm3(Lx, Ly, 0.6), R = r * 1.12;
        if (r < 1.6) { pl.tone(f.x, f.y, f.ramp, 0.45 * f.dim); return; }
        for (let py = Math.floor(f.y - R - 1); py <= Math.ceil(f.y + R + 1); py++) for (let px = Math.floor(f.x - R - 1); px <= Math.ceil(f.x + R + 1); px++) {
            const dx = px + 0.5 - f.x, dy = py + 0.5 - f.y, d = Math.hypot(dx, dy);
            let th = (Math.atan2(dy, dx) - a) / (Math.PI * 2); th -= Math.floor(th);
            const edgeR = r * f.prof[Math.floor(th * 64) & 63];
            if (d > edgeR) continue;
            const q = d / edgeR, nx = dx / edgeR, ny = dy / edgeR, nz = Math.sqrt(Math.max(0, 1 - q * q * 0.92));
            const lam = Math.max(0, nx * L3[0] + ny * L3[1] + nz * L3[2]), tu = (dx * ca + dy * sa) / 3.2, tv = (-dx * sa + dy * ca) / 3.2;
            let tone = 0.1 + 0.8 * lam * (0.92 + 0.7 * (fbm(tu + f.seed % 31, tv, 3, 3) - 0.5));
            if (q > 0.8 && nx * Lx + ny * Ly > 0.4) tone += 0.2;                     // the rim toward the light
            pl.tone(px, py, f.ramp, tone * f.dim);
        }
    }
    const drawPiece = (pl, f, t) => (f.rock ? drawRock(pl, f, t) : drawPlate(pl, f, t));

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // 4. The run: state, input, the words
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
    let S = null;
    const input = { up: false, down: false, ptrY: null, mode: 'mouse' };

    function makeMotes(rand) {   // the dust that streaks past: most far and slow, a few near and fast, in front of us
        return Array.from({ length: 46 }, (_, i) => ({ x: rand() * G.W, y: rand() * G.H, near: i < 9, v: i < 9 ? 1.7 + rand() * 0.8 : 0.12 + rand() * 0.35 }));
    }
    function newState(phase) {
        const seed = fixedSeed != null ? fixedSeed : ((Date.now() ^ (Math.random() * 1e9)) >>> 0) || 1, rand = seeded(seed);
        return {
            phase, seed, rand, t: 0, clock: 0, dist: 0, y: null, vy: 0, tilt: 0, plume: 0.4, trail: [],
            pieces: [], nextAt: DEBRIS_FROM, farAt: 0, sparks: [], flashes: [], motes: G ? makeMotes(rand) : [],
            twin: null, scrapes: 0, catches: 0, hurtT: 0, shake: 0, cold: null, outT: 0, result: null,
            said: {}, busyUntil: 0, closeWarned: false,
        };
    }
    /** The twin: our Lander again, its windows dark. gap: px between its nose and our tail (where it is heading); shown: where
        it is now (it eases there, so knocks and drops read as motion). */
    function newTwin() {
        return { gap: GAP0 * G.K, shown: G.shipX + G.len, k: ENTER_K, y: S.y, tilt: 0, plume: 0.4, hits: 0, jolt: 0, fallT: -1,
            hold: 0, settled: false, x: -G.len, recover: 0, smokeAt: 0 };
    }
    const clampY = y => (y == null ? (G.top + G.bottom) / 2 : clamp(y, G.top, G.bottom));

    // ── the words: one line at a time, said by a person; buttons are words ──
    const els = { intro: document.getElementById('intro'), voice: document.getElementById('voice'), who: document.getElementById('who'),
        name: document.getElementById('who-name'), line: document.getElementById('line'), after: document.getElementById('after') };
    const TONE = { 'A.U.R.A.': 'tone-aura', Jaxon: 'tone-jaxon', Mira: 'tone-mira', Aris: 'tone-aris', Vance: 'tone-vance' };
    let sayTimer = 0;
    function say(who, words, ms) {
        clearTimeout(sayTimer);
        els.who.className = 'who ' + (TONE[who] || '');
        els.name.textContent = who;
        els.line.textContent = words;
        els.voice.classList.add('is-in');
        if (ms) sayTimer = setTimeout(() => els.voice.classList.remove('is-in'), ms);
        if (S) S.busyUntil = S.clock + (ms || 0) / 1000 + GAP_LINES;
    }
    function hush() { clearTimeout(sayTimer); els.voice.classList.remove('is-in'); }
    /** A line said once per run. Something happening (a hit, a scrape) speaks over whatever is showing; a timed line waits
        for quiet. */
    function sayOnce(id, who, words, isEvent, ms = SAY_MS) {
        if (S.said[id] || (!isEvent && S.clock < S.busyUntil)) return;
        S.said[id] = true;
        say(who, words, ms);
    }

    const ONES = 'zero one two three four five six seven eight nine ten eleven twelve'.split(' ');
    const word = n => (n < ONES.length ? ONES[n] : String(n));
    const cap = s => s[0].toUpperCase() + s.slice(1);
    // what A.U.R.A. says when it catches us: calm, exact, and wrong. A new one each time it catches us.
    const CAUGHT = ['Its hull number is nine, Commander. The same as ours.', 'It answered my call, Commander. In my own voice.',
        'I read no heat aboard it, Commander. No one is alive in there.', 'Its crew list matches ours, Commander. Name for name.'];
    function resultLine() {
        const tw = S.twin, scr = S.scrapes;
        if (tw && tw.hits >= HITS_TO_SHAKE) return scr ? `It's gone, Commander. ${cap(word(scr))} ${scr > 1 ? 'scrapes' : 'scrape'} on our hull.` : "It's gone, Commander. Not a scrape on us.";
        if (tw && tw.hits > 0) return "We're out of the debris, Commander. It's damaged, but still behind us.";
        return "We're out of the debris, Commander. It's still behind us.";
    }

    function start() {
        const prevY = S ? S.y : null;                          // play again: the ship carries on from where it is
        S = newState('play');
        S.y = clampY(prevY);
        els.intro.hidden = true; els.after.hidden = true; hush();
        stage.classList.add('is-flying');
        stage.focus({ preventScroll: true });
    }
    function finish() {
        S.phase = 'out'; S.outT = 0;
        S.pieces.forEach(f => { f.passed = true; });            // what is left of the field drifts past harmlessly
    }

    // ── input: the ship goes to the pointer's height, or the arrows (W / S) move it ──
    const UP_KEYS = ['ArrowUp', 'w', 'W'], DOWN_KEYS = ['ArrowDown', 's', 'S'];
    stage.addEventListener('pointermove', e => { if (G) { input.ptrY = e.clientY / G.px; input.mode = 'mouse'; } });
    window.addEventListener('blur', () => { input.up = false; input.down = false; });
    window.addEventListener('keydown', e => {
        const isChoosing = S.phase === 'intro' || S.phase === 'end';
        if (isChoosing && e.key === 'Enter' && e.target.closest && e.target.closest('a, button')) return;   // a focused word acts for itself
        if (isChoosing && (e.key === 'Enter' || e.key === '1' || e.key === ' ')) { e.preventDefault(); if (!e.repeat) start(); return; }
        if (isChoosing && e.key === '2') { e.preventDefault(); location.href = 'index.html'; return; }
        if (UP_KEYS.includes(e.key)) { e.preventDefault(); input.up = true; input.mode = 'keys'; }
        if (DOWN_KEYS.includes(e.key)) { e.preventDefault(); input.down = true; input.mode = 'keys'; }
    });
    window.addEventListener('keyup', e => {
        if (UP_KEYS.includes(e.key)) input.up = false;
        if (DOWN_KEYS.includes(e.key)) input.down = false;
    });
    document.querySelectorAll('[data-act="start"]').forEach(b => b.addEventListener('click', start));

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // 5. One step of the play
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
    function step(dt) {
        const K = G.K, playing = S.phase === 'play';
        S.clock += dt;
        if (playing) S.t += dt;
        if (S.phase === 'out' || S.phase === 'end') S.outT += dt;
        const cold = S.cold ? S.cold.t : -1, isCold = cold >= 0;
        const pace = S.phase === 'intro' ? 0.35 : isCold ? lerp(1, COLD_SLOW, coldAmount()) : 1;   // the world slows in the cold
        const fly = FLY * K * pace;
        S.dist += fly * dt;

        steer(dt, isCold);
        S.trail.push([S.clock, S.y, S.tilt, S.plume]);
        while (S.trail.length > 2 && S.trail[1][0] < S.clock - 6) S.trail.shift();

        spawnFar();
        if (playing) {
            if (!S.twin && S.t >= TWIN_IN_AT) S.twin = newTwin();
            spawn();
        }
        S.pieces.forEach(f => { f.x -= fly * f.speed * dt; f.y += f.vy * K * dt; });
        S.pieces = S.pieces.filter(f => !f.gone && f.x > -40 * K);
        if (S.twin) moveTwin(dt, fly);
        if (playing && !isCold) collide();
        if (S.cold) runCold(dt);
        lines();
        if (playing && S.t >= FIELD_S && !(S.twin && S.twin.fallT >= 0)) finish();
        if (playing && S.twin && S.twin.fallT >= FALL_S) finish();                    // shaken off: the flight is won
        if (S.phase === 'out' && S.outT > OUT_S && !S.result) { S.result = resultLine(); say('A.U.R.A.', S.result, 0); }
        if (S.phase === 'out' && S.outT > OUT_S + 1) { S.phase = 'end'; els.after.hidden = false; stage.classList.remove('is-flying'); }

        S.hurtT = Math.max(0, S.hurtT - dt);
        S.shake = Math.max(0, S.shake - dt * 5);
        sparks(dt, fly);
        S.motes.forEach(m => { m.x -= fly * m.v * dt; if (m.x < -8) { m.x = G.W + 4 + S.rand() * 20; m.y = S.rand() * G.H; } });
    }

    /** Our Lander: up and down toward the pointer or with the arrows; it leans a little into the move; its drive burns
        harder while it moves. In the intro and the cold it just holds its height. */
    function steer(dt, isCold) {
        const K = G.K, flying = S.phase !== 'intro' && !isCold;
        let want = 0;
        if (flying && (input.up || input.down)) want = ((input.down ? 1 : 0) - (input.up ? 1 : 0)) * VMAX * K;
        else if (flying && input.mode === 'mouse' && input.ptrY != null) want = clamp((input.ptrY - S.y) * AIM_GAIN, -VMAX * K, VMAX * K);
        if (S.phase === 'intro') want = (G.top + (G.bottom - G.top) * 0.45 + Math.sin(S.clock * 0.8) * 10 * K - S.y) * 1.5;   // idle: a slow float
        S.vy += (want - S.vy) * Math.min(1, dt * EASE_V);
        const ny = S.y + S.vy * dt;
        S.y = clampY(ny);
        if (S.y !== ny) S.vy = 0;
        S.tilt = clamp(S.vy / (1100 * K), -0.13, 0.13);
        S.plume = clamp01(0.38 + 0.4 * Math.abs(S.vy) / (VMAX * K));
    }

    /** Far debris, passing behind us: depth only, it touches nothing. */
    function spawnFar() {
        const rand = S.rand;
        if (S.clock < S.farAt) return;
        S.farAt = S.clock + (0.18 + rand() * 0.24) * (S.phase === 'intro' ? 2 : 1);
        const y = rand() * G.H;
        if (Math.abs(y - G.LP[1]) < (LOOK5.light.core + 14) * G.K) return;      // never a dark blot across the light's white core
        S.pieces.push(makePiece(rand, G.W + 10, y, (1.5 + rand() * 3) * G.K, false));
    }
    /** New debris in our plane, coming out of the right edge: in waves that build, near a third of it on our height (both
        the danger and the chance to lure); never stacked on a piece that has just come in. */
    function spawn() {
        const K = G.K, rand = S.rand, t = S.t;
        if (t < S.nextAt || t > DEBRIS_UNTIL || (S.twin && S.twin.fallT >= 0)) return;
        const wave = Math.max(smooth(24, 30, t) * (1 - smooth(36, 40, t)), smooth(50, 56, t) * (1 - smooth(62, 66, t)));
        const every = lerp(1.1, 0.62, smooth(DEBRIS_FROM, 40, t)) * (1 - 0.3 * wave);   // the pieces are bigger now: a little sparser
        S.nextAt = t + every * (0.7 + 0.6 * rand());
        const r = (8 + rand() * 8) * K, aimed = rand() < 0.3;               // big enough to read as what matters, beside the ships
        for (let tries = 0; tries < 6; tries++) {
            const y = aimed && tries < 2 ? S.y + (rand() - 0.5) * 24 * K : lerp(G.top - 10 * K, G.bottom + 10 * K, rand());
            const isClear = S.pieces.every(f => !f.near || f.x < G.W - 70 * K || Math.abs(f.y - y) > f.r + r + 14 * K);
            if (isClear) { S.pieces.push(makePiece(rand, G.W + r + 6, y, r, true)); return; }
        }
    }

    /** Where we were `lag` seconds ago, from the trail: [y, tilt, plume]. */
    function lagged(lag) {
        const when = S.clock - lag, tr = S.trail;
        for (let i = tr.length - 1; i > 0; i--) {
            const a = tr[i - 1], b = tr[i];
            if (a[0] <= when) { const k = b[0] > a[0] ? clamp01((when - a[0]) / (b[0] - a[0])) : 1; return [lerp(a[1], b[1], k), lerp(a[2], b[2], k), lerp(a[3], b[3], k)]; }
        }
        return [tr[0][1], tr[0][2], tr[0][3]];
    }
    /** The twin flies our own path: it is where we were when we were where it is now, a quarter of a second later still.
        It gains on us slowly; it eases to where it is heading (in from the dark, knocked back, falling away). */
    function moveTwin(dt, fly) {
        const tw = S.twin, K = G.K;
        if (tw.fallT >= 0) {                                                  // the third hit: its drive is out and it falls back
            tw.fallT += dt;
            tw.gap += 46 * K * dt * (1 + tw.fallT);
            tw.y += 9 * K * tw.fallT * dt;
            tw.tilt = Math.min(0.55, tw.tilt + 0.16 * dt);
            tw.plume = 0;
        } else if (tw.recover > 0) {                                          // hit: back into the dark, then it weaves in again
            tw.recover = Math.max(0, tw.recover - dt);
            const into = RECOVER_S - tw.recover;
            tw.gap = into < DROP_S ? GAP_MAX * K * 1.25 : lerp(GAP0 * K, GAP_MAX * K * 1.25, tw.recover / (RECOVER_S - DROP_S));
            if (tw.recover === 0 && tw.hits === 1) sayOnce('back', 'Vance', "It's coming back. Do it again.", true);
        } else if (S.phase === 'play' && !S.cold && tw.settled) tw.gap -= CLOSE * K * dt;
        if (S.phase !== 'play' && tw.fallT < 0) tw.gap = Math.max(tw.gap, GAP0 * K);   // after the flight it sits behind us, waiting
        tw.shown += (tw.gap - tw.shown) * Math.min(1, dt * tw.k);
        if (Math.abs(tw.shown - tw.gap) < 4 * K && !tw.settled) { tw.settled = true; tw.k = 5; }
        tw.x = G.shipX - G.len - tw.shown;
        if (tw.fallT < 0) {
            const [y, tilt, plume] = lagged((G.len + tw.shown) / (FLY * K) + LAG), hold = tw.hold;
            const weave = tw.recover > 0 ? Math.sin(S.clock * 2.3) * 16 * K * Math.min(1, tw.recover / 1.5) : 0;   // off our path, finding it again
            tw.y = clamp(lerp(y + weave, S.y - 2 * K, hold), G.top - 20 * K, G.bottom + 20 * K);   // in the cold it sits a hair above us
            tw.tilt = lerp(tilt, S.tilt, hold);  // it leans as we leaned, late
            tw.plume = tw.hits >= 2 && hash(Math.floor(S.clock * 9), 5, 11) < 0.35 ? 0.04 : plume;   // hurt, its drive sputters
        }
        tw.jolt = Math.max(0, tw.jolt - dt * 2.6);
        if (tw.hits > 0 && S.clock >= tw.smokeAt && tw.x > -G.len) smoke(tw);
    }

    const touches = (f, x, y, box) => Math.abs(f.x - x) < G.len * box.hw + f.r * box.r + box.pad * G.K && Math.abs(f.y - y) < G.ht * box.hh + f.r * box.r + box.pad * G.K;
    /** Debris against us and against the twin; and the twin against us. */
    function collide() {
        const tw = S.twin;
        S.pieces.forEach(f => {
            if (!f.near || f.gone || f.passed) return;
            if (touches(f, G.shipX, S.y, OURS)) { scrape(f); return; }
            if (Math.abs(f.x - G.shipX) < G.len * OURS.hw + f.r) {               // how close we cut it as it went by
                f.clear = Math.min(f.clear, Math.abs(f.y - S.y) - (G.ht * OURS.hh + f.r * OURS.r));
            }
            const isLure = f.clear < CUT_CLOSE * G.K;
            if (tw && tw.settled && tw.fallT < 0 && tw.recover === 0 && isLure && touches(f, tw.x, tw.y, TWINS)) twinHit(f);
            if (f.x < (tw ? tw.x : G.shipX) - G.len) f.passed = true;
        });
        const lim = CATCH_AT * G.len;
        if (tw && tw.settled && tw.fallT < 0 && tw.gap < lim && tw.shown < lim) caught();   // both: not while it drops back after the cold
    }
    function scrape(f) {
        f.gone = true; S.scrapes++; S.hurtT = 0.7; S.shake = 3; S.vy += (S.y > f.y ? 1 : -1) * 60 * G.K;
        shatter(f.x, f.y, f.ramp, 10);
        if (S.twin && S.twin.fallT < 0) { S.twin.gap -= SCRAPE_GAIN * G.K; S.closeWarned = false; }
        if (S.scrapes === 1) sayOnce('scrape1', 'Jaxon', 'That scraped the hull. Not so close.', true);
        else sayOnce('scrape2', 'A.U.R.A.', 'Another scrape, Commander. It gains on us when we slow.', true);
    }
    function twinHit(f) {
        const tw = S.twin;
        f.gone = true; tw.hits++; tw.jolt = 1; S.shake = Math.max(S.shake, 1.6); S.closeWarned = false;
        if (tw.hits < HITS_TO_SHAKE) tw.recover = RECOVER_S;
        shatter(f.x, f.y, f.ramp, 26);
        S.flashes.push({ x: f.x, y: f.y, age: 0 });                          // a burst where it struck: you see what it hit
        if (tw.hits === 1) sayOnce('hit1', 'Mira', 'It flew straight into it!', true);
        if (tw.hits === 2) sayOnce('hit2', 'Jaxon', "It's hurt. It's dropping back.", true);
        if (tw.hits >= HITS_TO_SHAKE) { tw.fallT = 0; sayOnce('hit3', 'A.U.R.A.', "Its drive is out, Commander. It's falling back.", true, FALL_S * 1000); }
    }
    /** It caught us: the cold begins. */
    function caught() {
        S.catches++;
        S.cold = { t: 0, line: CAUGHT[(S.catches - 1) % CAUGHT.length] };
        S.twin.gap = -0.9 * G.len; S.twin.k = 4; S.shake = Math.max(S.shake, 2.5);   // it slides on into us, almost all the way
        say('A.U.R.A.', S.cold.line, (COLD_S + 0.6) * 1000);
    }
    function coldAmount() {
        const c = S.cold;
        if (!c) return 0;
        return c.t < COLD_IN ? smooth(0, 1, c.t / COLD_IN) : c.t > COLD_S - COLD_OUT ? 1 - smooth(0, 1, (c.t - (COLD_S - COLD_OUT)) / COLD_OUT) : 1;
    }
    /** In the cold the twin sits in us, matching our height, then it drops back and the flight goes on; the debris right
        ahead is cleared so the first thing after is not a scrape. */
    function runCold(dt) {
        const c = S.cold, tw = S.twin;
        c.t += dt;
        tw.hold = Math.min(1, tw.hold + dt * 2.5);
        if (c.t >= COLD_S - COLD_OUT && !c.dropped) {
            c.dropped = true;
            tw.gap = GAP0 * G.K * 1.15; tw.k = 2.2; S.closeWarned = false;
            S.pieces.forEach(f => { if (f.near && f.x > G.shipX - G.len * 2 && f.x < G.shipX + 150 * G.K) f.gone = true; });
        }
        if (c.dropped) tw.hold = Math.max(0, tw.hold - dt * 1.6);
        if (c.t >= COLD_S) { S.cold = null; tw.hold = 0; }
    }

    /** The lines in the flight, each said once: what the twin is, what it does, how to shake it, that it is close. */
    function lines() {
        const tw = S.twin;
        if (S.phase !== 'play' || !tw) return;
        if (S.t > TWIN_IN_AT + 1.4) sayOnce('behind', 'A.U.R.A.', 'A ship behind us, Commander. Exactly like ours.');
        if (S.t > TWIN_IN_AT + 5.5) sayOnce('copies', 'A.U.R.A.', 'It turns when we turn, Commander. A quarter second late.');
        if (S.t > TWIN_IN_AT + 9 && tw.hits === 0) sayOnce('lure', 'Vance', 'Lead it into the debris. Turn away at the last second.');
        if (tw.settled && tw.fallT < 0 && !S.cold && tw.shown < 20 * G.K && !S.closeWarned && S.clock > S.busyUntil) {
            S.closeWarned = true;
            say('A.U.R.A.', "It's closing on us, Commander.", 2200);
        }
        if (S.t > FIELD_S - 9 && tw.fallT < 0) sayOnce('thins', 'A.U.R.A.', 'The debris thins out ahead, Commander.');
    }

    /** Bits of a broken piece and a few sparks, flying off and fading. */
    function shatter(x, y, ramp, n) {
        const rand = S.rand, K = G.K;
        for (let i = 0; i < n; i++) {
            const a = rand() * 6.28, v = (20 + rand() * 70) * K, isSpark = i % 3 === 0;
            S.sparks.push({ x, y, vx: Math.cos(a) * v - 40 * K, vy: Math.sin(a) * v, age: 0, life: isSpark ? 0.35 + rand() * 0.25 : 0.7 + rand() * 0.6, ramp: isSpark ? RP.SUN : ramp, size: isSpark ? 1 : 1 + (rand() < 0.3 ? 1 : 0) });
        }
    }
    function sparks(dt, fly) {
        S.sparks.forEach(s => { s.age += dt; s.x += (s.vx - fly * 0.3) * dt; s.y += s.vy * dt; s.vx *= 0.985; s.vy *= 0.985; });
        S.sparks = S.sparks.filter(s => s.age < s.life);
        S.flashes.forEach(f => { f.age += dt; f.x -= fly * dt; });
        S.flashes = S.flashes.filter(f => f.age < 0.5);
    }
    /** The hurt twin trails smoke from its stern; badly hurt, sparks too: its damage reads at play size. */
    function smoke(tw) {
        const rand = S.rand, K = G.K, x = tw.x - G.len * 0.5, y = tw.y + (rand() - 0.5) * G.ht * 0.6;
        tw.smokeAt = S.clock + (tw.hits >= 2 ? 0.05 : 0.09);
        S.sparks.push({ x, y, vx: -(10 + rand() * 20) * K, vy: (rand() - 0.5) * 12 * K, age: 0, life: 0.9 + rand() * 0.6, ramp: RP.STONE, size: 2 + (rand() < 0.4 ? 1 : 0), v: 0.55 });
        if (tw.hits >= 2 && rand() < 0.5) S.sparks.push({ x: x + G.len * 0.3 * rand(), y, vx: -(30 + rand() * 40) * K, vy: (rand() - 0.5) * 40 * K, age: 0, life: 0.3 + rand() * 0.2, ramp: RP.SUN, size: 1 });
    }

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // 6. One frame of the picture
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
    function draw(ms) {
        const { W, H } = G, tq = Math.floor(ms / 125) * 125, secs = ms / 1000;   // the moving bits of the sky step at 8 a second
        const fr = () => P.framer(ctx, W, H);              // a fresh one per step: each caches the fill colour, which others change
        const sx = S.shake > 0.2 ? Math.round((S.rand() - 0.5) * 2 * S.shake) : 0, sy = S.shake > 0.2 ? Math.round((S.rand() - 0.5) * 2 * S.shake) : 0;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = INK; ctx.fillRect(0, 0, W, H);

        // the far sky does not shake: it is far
        ctx.drawImage(G.back.canvas, 0, 0);
        if (G.back.sky && G.back.sky.live) G.back.sky.live(ctx, tq, S.dist * 0.02);
        P.twinkle(fr(), G.back.stars, ms);
        drawMotes(fr(), false);
        ctx.setTransform(1, 0, 0, 1, sx, sy);

        // the debris: the far pieces first, then ours
        const pl = G.layer;
        pl.clear();
        S.pieces.forEach(f => { if (!f.near) drawPiece(pl, f, secs); });
        S.pieces.forEach(f => { if (f.near) drawPiece(pl, f, secs); });
        pl.draw(ctx, 0, 0);

        // the twin behind us, then us; then what flies in front. In the cold it is in us: drawn over us
        const isInUs = S.twin && S.twin.hold > 0.5, seeTwin = S.twin && S.twin.x > -G.len * 1.2;
        if (seeTwin && !isInUs) drawTwin(fr(), ms);
        drawUs(fr(), ms, tq);
        if (seeTwin && isInUs) drawTwin(fr(), ms);
        drawSparks(fr());
        drawMotes(fr(), true);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        const k = coldAmount();
        if (k > 0.01) coldPass(k);
        if (window.PlayShade) PlayShade.under(ctx, W, H, G.px, [els.intro, els.voice, els.after]);   // no star on a letter
    }

    /** Our Lander, nose toward the light: its decks lit behind the portholes (people are warm), its drive burning blue. */
    function drawUs(f, ms, tq) {
        const L = SHIP.lander(ctx, { x: G.shipX, y: Math.round(S.y), len: G.len, angle: S.tilt, flip: true, plume: S.plume, t: ms, sunDir: SUN_DIR });
        const isDark = S.cold && S.cold.t > 0.15 && S.cold.t < COLD_S - 0.4;    // in the cold our lights go out
        if (!isDark) portholes(f, L);
        if (S.hurtT > 0 && Math.floor(tq / 125) % 2 === 0) hurt(f, L, 0.36);
    }
    function portholes(f, L) {
        for (let i = 1; i < 6; i++) { const [x, y] = L.at(MP.DECK_U(i) + 0.054, -0.32); f.px(Math.floor(x), Math.floor(y), PORTHOLE); }
        [-0.3, -0.05].forEach(v => { const [x, y] = L.at(MP.LANDER.NOSE - 0.019, v); f.px(Math.floor(x), Math.floor(y), BRIDGE); });
    }
    /** A scrape: the decks flicker emergency red for a moment. */
    function hurt(f, L, k) {
        const du = 1 / G.len, dv = 1 / G.ht;
        for (let u = MP.DECK_U(0) + du; u < MP.DECK_U(6) - du; u += du) for (let v = -0.42; v <= 0.42; v += dv) { const [x, y] = L.at(u, v); f.tone(x, y, RP.RED, k); }
    }
    /** The twin: our Lander exactly, its windows dark. Hits show on it (rust, then holes); after the third its light dies. */
    function drawTwin(f, ms) {
        const tw = S.twin, jolt = tw.jolt, wob = jolt > 0 ? Math.sin(S.clock * 38) * jolt : 0;
        const light = tw.fallT >= 0 ? Math.max(0.05, Math.round((0.8 * (1 - tw.fallT / FALL_S)) * 12) / 12) : 0.8;
        if (light <= 0.05 && tw.fallT > FALL_S) return;
        SHIP.lander(ctx, { x: Math.round(tw.x), y: Math.round(tw.y + wob * 2.5 * G.K), len: G.len, angle: tw.tilt + wob * 0.1, flip: true,
            plume: tw.plume, t: ms - LAG * 1000, sunDir: light > 0.5 ? SUN_DIR : null, light,
            rust: tw.hits >= 1 || undefined, holes: tw.hits >= 2 ? 0.64 : undefined, seed: 5 });
    }
    function drawSparks(f) {
        S.sparks.forEach(s => f.tone(s.x, s.y, s.ramp, (s.v || 0.9) * (1 - s.age / s.life), s.size, s.size));
        S.flashes.forEach(fl => f.glow(Math.round(fl.x), Math.round(fl.y), Math.round((6 + 10 * fl.age) * G.K), RP.STAR, 1 - fl.age / 0.5));
    }
    /** Dust streaking past (Corridor.js's motes, side on): far specks slow and dim; near ones fast, long, in front of us; the
        light warms the ones near it. */
    function drawMotes(f, isNear) {
        S.motes.forEach(m => {
            if (m.near !== isNear) return;
            const len = Math.max(1, Math.round(m.v * (S.phase === 'intro' ? 1.2 : 3.2) * G.K)), lit = Math.exp(-Math.hypot(m.x - G.LP[0], m.y - G.LP[1]) / (90 * G.K));
            const ramp = lit > 0.35 ? RP.SUN : isNear ? RP.STAR : RP.HAZE, v = isNear ? 0.55 : 0.85;
            f.tone(m.x, m.y, ramp, v * (lit > 0.35 ? 0.4 + 0.6 * lit : 1), len, 1);
        });
    }
    /** The cold: the whole frame, read back, its pixels dithered over to ice by their brightness, thickest at the edges; the
        false sun's warmth goes with it. */
    function coldPass(k) {
        const { W, H } = G, img = ctx.getImageData(0, 0, W, H), d32 = new Uint32Array(img.data.buffer), top = ICE32.length - 1;
        for (let y = 0; y < H; y++) {
            const ey = Math.abs(y / H - 0.5) * 2;
            for (let x = 0; x < W; x++) {
                const ex = Math.abs(x / W - 0.5) * 2, edge = Math.max(ex, ey), th = threshold(x, y);
                if (k * (1.05 + 0.3 * edge * edge) <= threshold(x + 3, y + 5)) continue;  // all of it goes to ice: it reads as an event
                const i = y * W + x, p = d32[i], l = ((p & 255) * 77 + ((p >> 8) & 255) * 150 + ((p >> 16) & 255) * 29) >> 8;
                const pos = clamp01(0.12 + l / 255 * 1.35 - 0.3 * edge * edge * k) * top, lo = pos | 0;   // frost darkens the edges
                d32[i] = ICE32[lo < top && pos - lo > th ? lo + 1 : lo];
            }
        }
        ctx.putImageData(img, 0, 0);
    }

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // 7. The loop, the window, the test hooks
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════════
    let last = 0;
    function frame(ms) {
        const dt = last ? Math.min(0.05, (ms - last) / 1000) : 0.016;
        last = ms;
        step(dt);
        draw(ms);
        requestAnimationFrame(frame);
    }
    let resizeTimer = 0;
    window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(build, 200); });

    build();
    S = newState('intro');
    S.y = clampY(null);
    requestAnimationFrame(frame);

    window.twinShadow = Object.freeze({
        state: () => {
            const tw = S.twin;
            return { phase: S.phase, t: +S.t.toFixed(2), y: +S.y.toFixed(1), px: G.px, shipX: G.shipX, len: G.len, ht: +G.ht.toFixed(1), fly: FLY * G.K,
                lane: [G.top, G.bottom], scrapes: S.scrapes, catches: S.catches, cold: !!S.cold, result: S.result, buildMs: G.buildMs,
                twin: tw ? { hits: tw.hits, gap: +tw.shown.toFixed(1), x: Math.round(tw.x), y: +tw.y.toFixed(1), settled: tw.settled, falling: tw.fallT >= 0, recover: +tw.recover.toFixed(1) } : null,
                pieces: S.pieces.filter(f => f.near && !f.gone && !f.passed).map(f => ({ x: +(f.x - G.shipX).toFixed(1), y: +f.y.toFixed(1), r: +f.r.toFixed(1) })) };
        },
    });
})();
