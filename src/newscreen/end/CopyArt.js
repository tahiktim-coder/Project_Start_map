/* ═══ Silent Exodus · new screen (?new=1) · end/CopyArt.js: the trap's ending, its pictures ═══════════════════════════
   What it is: the pictures of going down to the copy of Earth (the Wrong Place's "Go down", stop/Copy.js). Everything here
   is a copy that is slightly wrong, shown and never said:
     THE DESCENT  our Lander drops tail first into the blue; it passes through the clouds and they do not move or tear: they
                  are painted on, and they are one cloud, the same size every time, stamped in rows like the grass.
     THE GROUND   a perfect day by a perfect sea: the sun does not move, the sea's glints repeat like a floor tile, and the
                  grass is ONE blade copied over and over in rows (the pixel art's own copy-paste). The crew step out of the
                  Lander (the crew-hires people, as end/EdenArt.js draws them) and stand looking out.
     THE NIGHT    the view tilts up: the stars stand in rows, and our ship is a point of light crossing in orbit.
   House style (docs/ART_STYLE.md): ramps from the ink, the 8 x 8 Bayer dither, seeded noise, one light, stepped motion.
   end/Ending.js drives the clock and the words. Needs NSPaint, MiniShip, a crew engine (CrewEngine or MiniCrewEngine).
   Loaded only with the new-screen switch, before end/Ending.js.

   window.NSCopyArt (frozen)
     build(W, H, ids) → art           everything at this size (ids: who is alive, in the crew list's order)
     drawDescent(ctx, art, k, ms)     k 0..1 through the descent
     drawGround(ctx, art, t, ms, tilt)   t: seconds on the ground (the crew walk out, then stand); tilt 0..1: the view tilting up
     drawNight(ctx, art, ms)          the night sky, our ship crossing it, the ground's dark edge with the crew
     WALK_S                           seconds the crew take to step out and reach their places
*/
(function () {
    'use strict';
    const P = window.NSPaint, SHIP = window.MiniShip;
    if (!window.NEW_SCREEN || !P) return;
    const { INK, ramp, threshold, fbm, hash, clamp01, seeded } = P;
    const ss = P.smooth;
    const CE = () => window.CrewEngine || window.MiniCrewEngine || null;

    const R = {
        DAY: ramp(INK, '#10223e', '#1a3a64', '#2a5688', '#4276aa', '#6a98c4', '#9cbcd8', '#cfe0ea'),
        FALL: ramp(INK, '#060d1a', '#0b1a33', '#12284c', '#1a3a64', '#2a5688', '#4276aa', '#6a98c4', '#9cbcd8', '#cfe0ea'),   // out of the dark into the blue: one ramp, no seam
        CLOUD: ramp(INK, '#5c6c7c', '#8ea0ae', '#bfcdd6', '#e4ecf0', '#fbfdfe'),
        SEA: ramp(INK, '#0b2038', '#123258', '#1a4676', '#265e94', '#3a78ac'),
        SAND: ramp(INK, '#3a3022', '#6a5a40', '#9c8a62', '#c8b88a', '#e6dab4'),
        LAWN: ramp(INK, '#0e1e10', '#173018', '#22461f', '#2e5c26', '#3e742e'),
        BLADE: ramp(INK, '#1a3a1a', '#2c5a24', '#46802e', '#6aa43a', '#a2cc5a'),
        SUN: ramp(INK, '#ffe9b0', '#fff4d4', '#fffbee'),
        NIGHT: ramp(INK, '#060a14', '#0a1222', '#101c34', '#182a48'),
        STAR: ramp(INK, '#202a34', '#5a6874', '#a6b4bc', '#eef2f0'),
    };
    const WALK_S = 4.2;
    // the day: the horizon, the shore, the meadow (shares of the height), the sun (shares of the width / height)
    const DAYL = { horizon: 0.5, shore: 0.6, lawn: 0.645, sun: [0.8, 0.15], sunR: 0.034, feet: 0.93 };   // the sun up on the right: the words keep to the left
    const PLACES = ['mira', 'cora', 'jaxon', 'aris', 'vance'];                   // left to right, where they stop
    const BLADE = ['..3..', '..34.', '.23..', '.23..', '.12..', '1.2..', '.12..'];   // ONE blade of grass: every blade on this world
    // the descent's clouds: ONE cloud (w: share of the width), stamped in rows from `top` (heights down the descent's sky, in
    // screen heights) every stepY screens, stepX of its own widths apart
    const CLOUDS = Object.freeze({ w: 0.15, top: 1.12, rows: 4, stepX: 1.55, stepY: 0.27 });

    // ════════════════════════════════════════ the day ════════════════════════════════════════
    function paintDay(W, H) {
        const p = P.painter(W, H, true), hz = Math.round(H * DAYL.horizon), sh = Math.round(H * DAYL.shore), lw = Math.round(H * DAYL.lawn);
        const sx = Math.round(W * DAYL.sun[0]), sy = Math.round(H * DAYL.sun[1]), sr = Math.max(4, Math.round(H * DAYL.sunR));
        p.region(0, 0, W, hz, (x, y) => {                                         // a perfect sky: no cloud, no haze that moves
            const k = y / hz, d = Math.hypot(x - sx, (y - sy) * 1.1);
            p.solid(x, y, R.DAY, 0.28 + 0.55 * Math.pow(k, 1.3) + 0.22 * Math.exp(-d / (sr * 6)));
        });
        p.region(sx - sr * 3, sy - sr * 3, sx + sr * 3, sy + sr * 3, (x, y) => {  // the sun: still, a hard white disc, a short glow
            const d = Math.hypot(x + 0.5 - sx, y + 0.5 - sy) / sr;
            if (d < 1) p.solid(x, y, R.SUN, 0.9 - 0.3 * d);
            else if (d < 2.6 && (2.6 - d) / 1.6 * 0.7 > threshold(x, y)) p.solid(x, y, R.DAY, 0.95);
        });
        p.region(0, hz, W, sh, (x, y) => {                                        // the sea: flat; its glints a tile that repeats
            const k = (y - hz) / (sh - hz);
            p.solid(x, y, R.SEA, 0.3 + 0.35 * k);
            const gx = ((x % 23) + 23) % 23, row = y - hz;
            if (row % 4 === 1 && gx < 3 + (row % 8 === 1 ? 2 : 0)) p.solid(x, y, R.SEA, 0.95);
        });
        p.region(0, sh, W, lw, (x, y) => {                                        // the shore: its waterline a perfect wave
            const wave = sh + 1.5 + 1.5 * Math.sin(x / 9);
            if (y < wave) { p.solid(x, y, R.SEA, 0.82); return; }
            p.solid(x, y, R.SAND, 0.62 + 0.1 * ((y - sh) / (lw - sh)));
        });
        p.region(0, lw, W, H, (x, y) => p.solid(x, y, R.LAWN, 0.5 - 0.25 * (y - lw) / (H - lw)));
        // the grass: ONE blade, copied in perfect rows (the rows nearer us further apart; the blade never changes)
        let y = lw + 2, gap = 4, row = 0;
        while (y < H + 6) {
            const off = row % 2 ? 4 : 0;
            for (let x = -8 + off; x < W + 8; x += 8) stampBlade(p, x, Math.round(y));
            y += gap; gap = Math.min(9, gap + 0.45); row++;
        }
        return p.canvas();
    }
    function stampBlade(p, x, y) {
        BLADE.forEach((line, r) => { for (let c = 0; c < line.length; c++) { const v = line[c]; if (v === '.') continue; p.set(x + c, y - BLADE.length + r, R.BLADE.rgb[Number(v)]); } });
    }
    /** The meadow's people: their places along the front, the order they step out of the Lander. */
    function group(W, H, ids) {
        const set = new Set(ids || []), live = PLACES.filter(id => set.has(id)), x0 = W * 0.31, span = W * 0.32;
        return live.map((id, i) => ({ id, x: Math.round(x0 + span * (live.length < 2 ? 0.5 : i / (live.length - 1))), order: i, seed: i * 337 + 11 }));
    }

    // ════════════════════════════════════════ the descent ════════════════════════════════════════
    /** One cloud, painted once; the sky shows it again and again (a copy). Flat white, a hard edge: painted on. */
    function paintCloud(w, h) {
        const rand = seeded(901), blobs = Array.from({ length: 6 }, (_, i) => ({ cx: w * (0.16 + 0.68 * i / 5) + (rand() - 0.5) * w * 0.05, cy: h * (0.6 - 0.26 * Math.sin((i / 5) * Math.PI)), rx: w * (0.12 + rand() * 0.06), ry: h * (0.28 + rand() * 0.14) }));
        const p = P.painter(w, h, false);
        p.region(0, 0, w, h, (x, y) => {
            let m = -9;
            blobs.forEach(b => { m = Math.max(m, 1 - (((x + 0.5 - b.cx) / b.rx) ** 2 + ((y + 0.5 - b.cy) / b.ry) ** 2)); });
            if (y > h * 0.72) m -= (y - h * 0.72) * 0.12;
            if (m <= 0.05) return;
            p.solid(x, y, R.CLOUD, 0.55 + 0.3 * (0.5 - y / h) + 0.25 * (x / w - 0.5) * 0.5 + (m < 0.16 ? -0.12 : 0));
        });
        return p.canvas();
    }
    function paintDescent(W, H) {
        const SH = H * 3, p = P.painter(W, SH, true);
        p.region(0, 0, W, SH, (x, y) => {
            p.solid(x, y, R.FALL, 0.04 + 0.9 * Math.pow(y / SH, 0.75));                 // out of the dark, into the blue
        });
        for (let y = 7; y < H * 0.85; y += 17) for (let x = 9; x < W; x += 21) if ((x * 7 + y * 3) % 5) p.solid(x, y, R.STAR, 0.55 * (1 - y / (H * 0.85)) + 0.2);   // the stars in rows, fading as the blue comes
        return p.canvas();
    }

    function build(W, H, ids) {
        const cloudW = Math.round(W * CLOUDS.w), cloudH = Math.round(cloudW * 0.32);
        const art = { W, H, day: paintDay(W, H), descent: paintDescent(W, H), cloud: paintCloud(cloudW, cloudH), cloudW, cloudH, group: group(W, H, ids), night: null };
        art.lander = { x: Math.round(W * 0.2), y: Math.round(H * DAYL.feet) - 2, len: Math.round(H * 0.5) };
        return art;
    }

    // ── our Lander ──
    function lander(ctx, x, y, len, plume, ms) {
        if (!SHIP || typeof SHIP.lander !== 'function') return;
        try { SHIP.lander(ctx, { x, y, len, angle: Math.PI / 2, legs: 'down', anchor: 1.1, light: 0.95, plume, t: ms }); } catch (err) { /* left out */ }
    }

    /** k 0..1: the camera rides down with our Lander, out of the dark into the blue; the clouds pass up past it, unmoved:
        ONE cloud, stamped over the sky in even rows like the grass (each row half a step along from the last), all the same
        size, painted on. The middle of every other row is ours to go through: it stays whole, its edge as hard as before. */
    function drawDescent(ctx, art, k, ms) {
        const { W, H } = art, sy = Math.round((H * 2) * ss(0, 1, k)), lx = Math.round(W * 0.5), ly = Math.round(H * 0.46);
        ctx.drawImage(art.descent, 0, -sy);
        const sway = Math.round(Math.sin(ms / 900) * 1);
        lander(ctx, lx + sway, ly, Math.round(H * 0.2), 0.75, ms);
        const cw = art.cloudW, ch = art.cloudH, gx = Math.round(cw * CLOUDS.stepX), gy = Math.round(H * CLOUDS.stepY), y0 = Math.round(H * CLOUDS.top) - sy;
        for (let r = 0; r < CLOUDS.rows; r++) {
            const y = y0 + r * gy;
            if (y > H || y + ch < 0) continue;
            const x0 = Math.round(W * 0.5 - cw / 2) + (r % 2 ? gx >> 1 : 0);
            for (let x = x0 - gx * Math.ceil((x0 + cw) / gx); x < W; x += gx) ctx.drawImage(art.cloud, x, y);   // over the Lander: it passes through
        }
    }

    /** The sky over the day's own top edge (seen as the view tilts up): the day's blue and its sun glow carried on up, darker
        the higher it goes, so the night comes over one sky. Painted once. */
    function paintAbove(W, H) {
        const p = P.painter(W, H, true), sx = Math.round(W * DAYL.sun[0]), sy = Math.round(H * DAYL.sun[1]), sr = Math.max(4, Math.round(H * DAYL.sunR));
        p.region(0, 0, W, H, (x, y) => {
            const d = Math.hypot(x - sx, (y - H - sy) * 1.1);
            p.solid(x, y, R.DAY, 0.28 * Math.pow((y + 1) / H, 0.8) + 0.22 * Math.exp(-d / (sr * 6)));
        });
        return p.canvas();
    }

    /** t: seconds on the ground: the crew step out of the Lander one by one and walk to their places, then stand. tilt 0..1:
        the view tilts up (the ground slides down out of view; the sky above darkens to night). */
    function drawGround(ctx, art, t, ms, tilt) {
        const { W, H } = art, E = CE(), drop = Math.round(ss(0, 1, tilt || 0) * H * 1.1);
        if (!tilt && t > 2 && !art.above) art.above = paintAbove(W, H);           // painted ahead while they walk out (one each frame):
        else if (!tilt && t > 3 && !art.night) art.night = paintNight(W, H);      // the tilt then starts without a stall
        ctx.drawImage(art.day, 0, drop);
        if (drop > 0) {                                                           // above the day: the same sky, deepening toward the night
            if (!art.above) art.above = paintAbove(W, H);
            ctx.drawImage(art.above, 0, drop - H);
            if (drop > H) { ctx.fillStyle = INK; ctx.fillRect(0, 0, W, drop - H); }
        }
        lander(ctx, art.lander.x, art.lander.y + drop, art.lander.len, 0, ms);
        if (!E) return;
        const feet = Math.round(H * DAYL.feet) + drop, door = art.lander.x + Math.round(art.lander.len * 0.12), WALK = E.ACTIONS.walk;
        art.group.forEach(m => {
            const out = 0.3 + m.order * 0.5, dist = Math.max(0, m.x - door), dur = dist / WALK.move * WALK.ms / 1000;
            if (t < out) return;                                                  // still aboard
            const k = Math.min(1, (t - out) / Math.max(0.01, dur)), x = Math.round(door + dist * k), walking = k < 1;
            try { E.draw(ctx, m.id, walking ? 'walk' : 'idle', walking ? (t - out) * 1000 : ms + m.seed, x, feet, { facing: 1, warm: 1, rim: -1, seed: m.seed }); } catch (err) { /* left out */ }
        });
    }

    /** The night: the stars in rows, our ship a point of light crossing in orbit, the ground's dark edge with them on it. */
    function paintNight(W, H) {
        const p = P.painter(W, H, true);
        p.region(0, 0, W, H, (x, y) => p.solid(x, y, R.NIGHT, 0.25 + 0.45 * Math.pow(y / H, 1.6)));
        for (let y = 9, row = 0; y < H * 0.8; y += 19, row++) for (let x = 11 + (row % 2 ? 0 : 0); x < W; x += 23) {
            const bright = ((x / 23 | 0) + row * 2) % 7 === 0;
            p.solid(x, y, R.STAR, bright ? 0.95 : 0.6);
            if (bright) { p.solid(x - 1, y, R.STAR, 0.4); p.solid(x + 1, y, R.STAR, 0.4); }
        }
        const top = Math.round(H * 0.9);                                          // the ground's edge: the copied blades, black on the sky
        p.region(0, top, W, H, (x, y) => p.set(x, y, P.hexRgb(INK)));
        for (let x = 0; x < W + 8; x += 8) BLADE.forEach((line, r) => { for (let c = 0; c < line.length; c++) if (line[c] !== '.') p.set(x + c, top - BLADE.length + r, P.hexRgb(INK)); });
        return p.canvas();
    }
    function drawNight(ctx, art, ms) {
        const { W, H } = art;
        if (!art.night) art.night = paintNight(W, H);
        ctx.drawImage(art.night, 0, 0);
        const f = P.framer(ctx, W, H), u = (0.18 + ms / 60000) % 1, x = Math.round(-10 + (W + 20) * u), y = Math.round(H * 0.3 + H * 0.1 * Math.pow((u - 0.5) * 2, 2));
        f.glow(x, y, 4, P.RP.SUN, 0.5); f.px(x, y, '#fffaf0', 2, 2); f.px(x - 1, y, '#c8b080'); f.px(x + 2, y + 1, '#c8b080');   // our ship in orbit: a point of light, crossing
        const E = CE(), feet = Math.round(H * 0.9) + 1;
        if (!E) return;
        if (!art.silhouettes) art.silhouettes = silhouettes(art, E);             // them, black against the sky, at the ground's edge
        ctx.drawImage(art.silhouettes, 0, feet - art.silhouettes.height);
    }
    /** The crew as dark shapes at the ground's edge (their own figures, inked), painted once. */
    function silhouettes(art, E) {
        const { W } = art, big = document.createElement('canvas'); big.width = W * 2; big.height = 110;   // drawn whole, then at half size: far off, small under the sky
        const g = big.getContext('2d');
        art.group.forEach((m, i) => { try { E.draw(g, m.id, 'idle', m.seed, Math.round(W + (m.x - W * 0.47) * 1.15), 108, { facing: i % 2 ? -1 : 1, warm: 0, rim: 0, seed: m.seed }); } catch (err) { /* left out */ } });
        g.globalCompositeOperation = 'source-in'; g.fillStyle = '#04060a'; g.fillRect(0, 0, W * 2, 110);
        const c = document.createElement('canvas'); c.width = W; c.height = 55;
        const h = c.getContext('2d'); h.imageSmoothingEnabled = false; h.drawImage(big, 0, 0, W * 2, 110, 0, 0, W, 55);
        return c;
    }

    window.NSCopyArt = Object.freeze({ build, drawDescent, drawGround, drawNight, WALK_S });
})();
