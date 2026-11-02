/* ═══ Silent Exodus · new screen (?new=1) · land/MeteorArt.js: THE METEOR in the game (PR #32) ═══
   Copied from prototypes/landing-meteor/meteor-art.js (sha1 032634c797d4, the sketch as polished 2026-11-03; round 3 is
   not yet approved by the designer). Every game change is marked // GAME: (a later round of the sketch folds in with a plain
   diff against that file).
   GAME: forget(worldId), a world's bakes let go when the landing closes (LandFall.js).
*/
/* ═══ Silent Exodus · prototypes · landing-meteor/meteor-art.js: the pictures of the fall ══════════════════════════════
   What it is: what the meteor adds to the landing dummy's art (landing-art.js stays the source of the orbit, the lights,
   the far air and the cloud sea): the cloud deck seen close (its billowing top, its body, its torn underside), the cloud
   wisps that tear past behind and in front of the shuttle, the air streaking by, the cold plasma round the leading face,
   the plates rattling, and a thruster flame that turns with the shuttle. Everything is NSPaint's recipe (ramps from the
   ink, the 8 x 8 Bayer dither, seeded noise); the heavy pictures are baked a few rows at a time in LandingArt's idle queue.
   Re-entry light is cold (blue-white), never orange fire. NO SOUND.
   window.MeteorArt (frozen)
     prepare(E, G) → M             the deck's top, its underside and the wisps for one place (queued under M.tag, its own): M.done
     far(ctx, E, o)                 the limb, the sky's tint and the cloud sea far below; o: { z 0..1 deep, hz (horizon y),
                                    spread (how far down the frame the sea reaches), scroll (px flown), shake [dx, dy] }
     deck(ctx, E, M, o)             the deck in world place: o: { top, base (screen y of its top and floor), ox, oy (texture
                                    offset, art px), k (world scale / the field's), t, shafts: [{ cx, hwTop, hwBot, kind }] (round 3:
                                    clear air through the deck over its breaks, the walls torn, lit along the light's side),
                                    near (false: its top and body are not drawn: the cover far above is the deck then) }
     wisp(ctx, M, w, o)             one cloud wisp; o: { x, y, s (scale), sx, sy (stretch), shear, front }
     streaks(ctx, E, o)             the air going by; o: { sx, sy (world offset, art px), ux, uy (unit motion on screen),
                                    v (art px/s), n, top (no streaks above this y) }
     plasmaBack(f, o), plasmaFront(f, o)   the cold light round the leading face as one envelope: its sheath streaming back
                                    (before the hull), the bow on the face and its light on the hull (after it, brighten-only)
     flame(f, x, y, dx, dy, d, k, sputter)       a thruster's flame along (dx, dy)
     rattle(f, x, y, d, k, t)       loose plates and flecks round the hull when it shakes
     PLASMA                         the plasma's ramp
*/
(function () {
    'use strict';
    const P = window.NSPaint, A = window.LandingArt;
    if (!P || !A) { console.error('Meteor: NSPaint and landing-art.js must load first'); return; }
    const { INK, RP, ramp, threshold, clamp01, smooth, lerp, hash, fbm, vnoise } = P;
    const FW = A.FW, FH = A.FH;
    const PLASMA = ramp(INK, '#0f1b26', '#22405a', '#4a7ca4', '#8fc2e2', '#d4eefb', '#f6fcff');
    const WN = new Float32Array(64 * 64); for (let i = 0; i < WN.length; i++) WN[i] = hash(i & 63, i >> 6, 211);   // (the final fix round: a white-noise threshold for soft haze, where the Bayer grid would show as a lattice of dots)
    const BAND0_UP = 6, SKY_COV = [0.22, 0.42, 0.6, 0.78, 0.94], CEIL_H = 200, BODY_H = 720, TOP_W = 960, TOP_H = 150, UNDER_W = 960, UNDER_H = 84, WISP_W = 132, WISP_H = 60, WISPS = 5;

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // 1. The bakes for one place
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    const cache = new Map();
    /** The bakes go under their own tag ('meteor:' + key): both finds on a world share them, and picking the other light
        (which drops the first find's field) must never drop them. */
    function prepare(E, G) {
        const key = E.key + ':' + (G.tod || 'day');
        if (cache.has(key)) {
            const old = cache.get(key);
            if (old.done || A.pending(old.tag) > 0) return old;
            cache.delete(key);                                                    // its jobs were lost: bake it again
        }
        const tag = 'meteor:' + key, M = { key, tag, done: false, air: !!E.air, wisps: [], front: [], ink: (E.cloud || RP.HAZE).hex[1] };
        cache.set(key, M);
        if (cache.size > 4) { const old = cache.keys().next().value; if (old !== key) { A.drop(cache.get(old).tag); cache.delete(old); } }
        if (!E.air) { A.later(() => { M.done = true; }, tag, false, 'meteor none'); return M; }
        const cloud = E.cloud || A.mute(RP.DUST), airR = E.airR || RP.ICE, night = G.tod === 'night' ? 0.62 : 1, seed = (E.world.seed || 3) + 101, thin = E.world.atm < 0.6;
        const orbit = A.orbitSky(E.world.sector).canvas, src = { data: null, n: new Float32Array(FW * FH), rows: new Uint8Array(FH) };
        M.skies = SKY_COV.map(cov => A.stripBake(FW, FH, (p, y0) => { if (!src.data) src.data = skyPixels(orbit); paintSkyLevel(p, y0, src, airR, night, seed + 3, cov); }, tag, false, 8));
        M.body = A.stripBake(TOP_W, BODY_H, (p, y0) => paintBody(p, y0, cloud, night, seed + 21), tag, false, 12);
        M.ceil = ceilValues(cloud, airR, night, seed + 29, tag);
        M.top = A.stripBake(TOP_W, TOP_H, (p, y0) => paintTop(p, y0, cloud, airR, night, seed, thin), tag, false, 8);
        M.under = A.stripBake(UNDER_W, UNDER_H, (p, y0) => paintUnder(p, y0, cloud, airR, night, seed + 7), tag, false, 8);
        M.deep = A.stripBake(FW, FH, (p, y0) => paintDeep(p, y0, cloud, airR, night, seed + 33), tag, false, 24);   // (the fix round: the air seen down a shaft, never a flat panel)
        for (let i = 0; i < WISPS; i++) {
            M.wisps.push(A.stripBake(WISP_W, WISP_H, (p, y0) => paintWisp(p, y0, cloud, airR, night, seed + 13 * i, i, false), tag, false, 24));
            M.front.push(A.stripBake(WISP_W, WISP_H, (p, y0) => paintWisp(p, y0, cloud, airR, night, seed + 13 * i, i, true), tag, false, 24));
        }
        A.later(() => { M.done = true; }, tag, false, 'meteor done');
        return M;
    }
    /** The orbit sky's pixels, read once per sky (round 3: never read back again for another place). */
    const skyPx = new WeakMap();
    function skyPixels(canvas) { if (!skyPx.has(canvas)) { const c = document.createElement('canvas'); c.width = FW; c.height = FH; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(canvas, 0, 0); skyPx.set(canvas, g.getImageData(0, 0, FW, FH).data); } return skyPx.get(canvas); }
    /** One level of the sky as we sink into the air: the orbit's own sky (its stars, its false sun) mixed toward the
        air's colour (cov of the way), the air darker overhead and paler toward the horizon, dithered in its own ramp. */
    function paintSkyLevel(p, y0, S, airR, night, seed, cov) {
        const src = S.data;
        for (let y = 0; y < p.H; y++) {
            const ay = y + y0, k = smooth(-40, FH * 0.66, ay);
            if (!S.rows[ay]) { for (let x = 0; x < FW; x++) S.n[ay * FW + x] = fbm(x / 90, ay / 30, seed, 3); S.rows[ay] = 1; }   // the noise once for all five levels
            for (let x = 0; x < FW; x++) {
                const i = (ay * FW + x) * 4, v = (0.1 + 0.32 * k + (S.n[ay * FW + x] - 0.5) * 0.16) * night, c = airR.rgb[P.level(airR, v, x, ay)];
                const sun = A.LIGHT ? 1 - smooth(9, 30, Math.hypot(x - A.LIGHT[0], (ay - A.LIGHT[1]) * 1.1)) : 0, cv = Math.max(cov, sun);   // (the fix round: the false sun is gone from the fall's sky: the find's light is the one bright point)
                p.set(x, y, [src[i] + (c[0] - src[i]) * cv, src[i + 1] + (c[1] - src[i + 1]) * cv, src[i + 2] + (c[2] - src[i + 2]) * cv]);
            }
        }
    }
    /** The sky at depth z (0 at the edge of the air .. 1 at the deck): the nearest two levels, the second dithered in. */
    function skyAt(ctx, M, z) {
        if (!M || !M.skies || !M.skies.every(s => s.done)) return false;
        const f = clamp01(z) * (SKY_COV.length - 1), i = Math.floor(f), q = f - i;
        ctx.drawImage(M.skies[i].canvas, 0, 0);
        if (q > 0.04 && i + 1 < SKY_COV.length) A.dissolve(ctx, M.skies[i + 1].canvas, q);
        return true;
    }
    /** The sky deep in the air: the air's own colour, darker overhead, paler toward the horizon (about two thirds down),
        uneven (seeded noise); it is laid over the stars through the dither, more of it the deeper we are. */
    function paintAir(p, y0, airR, night, seed) {
        for (let y = 0; y < p.H; y++) { const ay = y + y0, k = smooth(-40, FH * 0.66, ay); for (let x = 0; x < FW; x++) p.solid(x, y, airR, (0.1 + 0.32 * k + (fbm(x / 90, ay / 30, seed, 3) - 0.5) * 0.16) * night); }
    }
    /** Under the deck, looking out: its floor receding to the horizon over the ground, a soft cloud underside: big billows
        near overhead, smaller and flatter with distance (the distance capped, so it never turns to stripes), a smooth haze
        over its last rows where the day comes in under it, its foot thinning away so the far hills show through. Kept as
        values (v, cover, glow) per row of the distance; ceiling() dithers them on the screen's own grid when it lays them out. */
    function ceilValues(cloud, airR, night, seed, tag) {
        const out = { v: new Float32Array(FW * CEIL_H), a: new Float32Array(FW * CEIL_H), g: new Float32Array(FW * CEIL_H), done: false, cloud, airR, cache: null };
        for (let r0 = 0; r0 < CEIL_H; r0 += 20) A.later(() => {
            for (let r = r0; r < Math.min(CEIL_H, r0 + 20); r++) {
                const q = r / (CEIL_H - 1), z = Math.min(6, 1 / (0.06 + 0.94 * (1 - q))), haze = smooth(0.78, 1, q);
                for (let x = 0; x < FW; x++) {
                    const i = r * FW + x, n = fbm((x - FW / 2) * z / 190 + 40, z * 0.9, seed, 3), lit = smooth(0.38, 0.72, n);
                    out.v[i] = lerp((0.13 + 0.2 * lit) * (1 - 0.3 * q), 0.2, haze) * night;
                    out.a[i] = smooth(0, 0.12, q + (fbm(x / 23, 3.3, seed + 5, 2) - 0.5) * 0.12) * (1 - smooth(0.7, 1, q));
                    out.g[i] = haze * 0.55 * (0.6 + 0.4 * lit);
                }
            }
        }, tag, false, 'meteor ceiling');
        A.later(() => { out.done = true; }, tag, false, 'meteor ceiling');
        return out;
    }
    /** The ceiling from y0 (the floor on screen) to y1 (the horizon, just over the far hills), dithered on the screen's grid;
        the last picture is kept while the camera holds still. */
    function ceiling(ctx, M, y0, y1) {
        const C = M && M.ceil;
        if (!C || !C.done) return;
        const Y0 = Math.round(y0), Y1 = Math.round(y1), a = Math.max(0, Y0), b = Math.min(FH, Y1);
        if (b - a < 4 || Y1 - Y0 < 4) return;
        const key = Y0 + ':' + Y1;
        if (!C.cache || C.cache.key !== key) {
            if (!C.canvas) { C.canvas = document.createElement('canvas'); C.canvas.width = FW; C.canvas.height = FH; C.g2 = C.canvas.getContext('2d'); C.img = C.g2.createImageData(FW, FH); C.d32 = new Uint32Array(C.img.data.buffer); }
            const d = C.img.data, span = Y1 - Y0, cr = C.cloud.rgb, ar = C.airR.rgb;
            C.d32.fill(0, a * FW, b * FW);
            for (let y = a; y < b; y++) {
                const r = Math.min(CEIL_H - 1, Math.max(0, Math.floor((y - Y0) / span * CEIL_H))), row = r * FW;
                for (let x = 0; x < FW; x++) {
                    const i = row + x;
                    if (WN[((y & 63) << 6) | (x & 63)] >= C.a[i]) continue;
                    const glow = C.g[i] > WN[(((y + 17) & 63) << 6) | ((x + 29) & 63)], rp = glow ? C.airR : C.cloud, c = (glow ? ar : cr)[P.level(rp, glow ? 0.2 + 0.1 * C.g[i] : C.v[i], x, y)], o = (y * FW + x) * 4;
                    d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
                }
            }
            C.g2.putImageData(C.img, 0, 0, 0, a, FW, b - a);
            C.cache = { key, a, b };
        }
        ctx.drawImage(C.canvas, 0, C.cache.a, FW, C.cache.b - C.cache.a, 0, C.cache.a, FW, C.cache.b - C.cache.a);
    }
    /** The deck's body: dense cloud, darker than its top, billows lit to about half and holes of darker murk; tileable
        sideways; laid from the deck's top down (never wrapped up and down: no seam). */
    function paintBody(p, y0, cloud, night, seed) {
        // the polish round: the noise on a 4 px grid, blended per pixel (smooth, never 3-px blocks); each billow inside lit on
        // its top and dark below (its value from the slope of the noise up the picture), the darkest murk between them
        const G4 = 4, gw = TOP_W / G4 + 2, wrap = (x, y, s) => { const a = fbm(x / 70, y / 30, s, 3), b = fbm((x - TOP_W) / 70, y / 30, s, 3); return 0.5 + ((a * (TOP_W - x) + b * x) / TOP_W - 0.5) * 1.45; };
        const gy0 = Math.floor((y0 - 8) / G4), gy1 = Math.ceil((y0 + p.H) / G4) + 1, grid = new Float32Array((gy1 - gy0 + 1) * gw);
        for (let j = gy0; j <= gy1; j++) for (let i = 0; i < gw; i++) grid[(j - gy0) * gw + i] = wrap(Math.min(TOP_W, i * G4), j * G4, seed);
        const nAt = (x, y) => { const fx = x / G4, fy = y / G4 - gy0, i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j, a = grid[j * gw + i], b = grid[j * gw + i + 1], c = grid[(j + 1) * gw + i], d = grid[(j + 1) * gw + i + 1]; return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v; };
        for (let y = 0; y < p.H; y++) {
            const ay = y + y0;
            for (let x = 0; x < TOP_W; x++) {
                const n = nAt(x, ay), up = nAt(x, Math.max(y0 - 8, ay - 6)), slope = Math.max(-0.12, Math.min(0.16, (n - up) * 1.6));
                p.solid(x, y, cloud, (0.07 + 0.38 * smooth(0.3, 0.8, n) + slope) * night);
            }
        }
    }
    /** The fix round: the air deep inside the deck, seen through a shaft above the land. The final fix round: air with
        depth, never a flat panel: darkest high up (the deck's own murk), paler toward the foot of the frame where the day
        comes up from under the deck, in long soft veils of the air's own light. */
    function paintDeep(p, y0, cloud, airR, night, seed) {
        for (let y = 0; y < p.H; y++) {
            const ay = y + y0, k = ay / FH, kk = k * k * (3 - 2 * k);
            for (let x = 0; x < FW; x++) {
                const n = fbm(x / 90, ay / 14, seed, 3), m = fbm(x / 34, ay / 22, seed + 4, 2), veil = smooth(0.46, 0.78, n) * (0.3 + 0.7 * kk);
                if (WN[((ay & 63) << 6) | (x & 63)] < veil * 0.75) p.solid(x, y, airR, (0.12 + 0.13 * kk + 0.06 * m) * night);
                else p.solid(x, y, cloud, (0.05 + 0.14 * kk + (m - 0.5) * 0.08) * night);
            }
        }
    }
    /** The deck's top, seen close: billows lit along their crests in the air's own light, darker inside, closing into
        solid cloud toward the foot (where the deck's body takes over). Repeats sideways. */
    function paintTop(p, y0, cloud, airR, night, seed, thin) {
        const wrap = (x, y, s, fx, fy) => { const a = fbm(x / fx, y / fy, s, 3), b = fbm((x - TOP_W) / fx, y / fy, s, 3); return 0.5 + ((a * (TOP_W - x) + b * x) / TOP_W - 0.5) * 1.45; };
        for (let x = 0; x < TOP_W; x++) {
            const wisp = wrap(x, 4, seed + 17, 22, 9);                         // wisps streaming off the crests
            const n1 = wrap(x, 2, seed, 150, 30), dome = Math.pow(Math.max(0, Math.sin(x / 34 + 5 * n1)), 0.55), crest = 70 - 42 * dome * (0.45 + n1) - 12 * (wrap(x, 9, seed + 3, 40, 9) - 0.5);
            for (let y = 0; y < p.H; y++) {
                const ay = y + y0, d = ay - crest;
                if (d < 0 && d > -10 && wisp > 0.58 && threshold(x, ay) < (wisp - 0.58) * 3 * (1 + d / 10)) { p.solid(x, y, airR, (0.3 + 0.1 * wisp) * night); continue; }
                if (d < 0 || ay > TOP_H - 50 + 46 * fbm(x / 26, 7, seed + 5, 2)) continue;   // its foot ends in a ragged edge over the body below
                const body = wrap(x, ay, seed + 9, 70, 26), fine = wrap(x, ay, seed + 11, 18, 7);
                if (thin && d > 3 && d < 70 && body < 0.42 && threshold(x, ay) > (0.42 - body) * -6 + 1) continue;   // thin air: torn
                if (d < 6 && threshold(x + 5, ay + 2) > 0.25 + d / 6 + (fine - 0.5) * 0.5) continue;              // a soft edge: the sky shows through its rim
                if (d < 2.5) { p.solid(x, y, airR, (0.48 + 0.2 * fine) * night); continue; }
                const lit = clamp01(0.7 - d / 90 + (body - 0.5) * 0.8 + (fine - 0.5) * 0.4);
                p.solid(x, y, cloud, (0.2 + 0.46 * lit + (d < 6 ? 0.08 : 0)) * night);
            }
        }
    }
    /** The deck's floor seen from under it: solid cloud above, torn into hanging rags and holes along the bottom edge,
        lighter where it thins (the light from below and the sky's own). Its bottom edge sits at the field's cloud base. */
    function paintUnder(p, y0, cloud, airR, night, seed) {
        for (let x = 0; x < UNDER_W; x++) {
            const a = fbm(x / 60, 1, seed, 3), b = fbm((x - UNDER_W) / 60, 1, seed, 3), n = (a * (UNDER_W - x) + b * x) / UNDER_W;
            const edge = UNDER_H - 6 - (n - 0.35) * 70 - 8 * (vnoise(x / 9, 3, seed + 2) - 0.5);
            for (let y = 0; y < p.H; y++) {
                const ay = y + y0, d = edge - ay;
                const up = ay - 34 * fbm(x / 26, 3, seed + 9, 2);
                if (d < 0 || (d < 10 && threshold(x, ay) > d / 10) || up < 0 || (up < 14 && threshold(x + 3, ay + 1) > up / 14)) continue;   // its top thins into the body above
                const tex = fbm(x / 34, ay / 12, seed + 5, 3);
                p.solid(x, y, cloud, (0.1 + 0.22 * tex + (d < 4 ? 0.14 : 0)) * night);
            }
        }
    }
    /** A wisp of cloud: an uneven blob, denser in its heart, lit along its top in the air's light; front: the same shape as
        a darker, sparser veil (it passes between us and the shuttle). */
    function paintWisp(p, y0, cloud, airR, night, seed, i, front) {
        const cx = WISP_W / 2, cy = WISP_H / 2;
        for (let y = 0; y < p.H; y++) for (let x = 0; x < WISP_W; x++) {
            const ay = y + y0, q = Math.hypot((x - cx) / (WISP_W * 0.46), (ay - cy) / (WISP_H * 0.42)), n = fbm(x / 22, ay / 11, seed, 3);
            const dens = (1 - q) * 1.5 + (n - 0.5) * 1.6;
            if (dens <= 0) continue;
            const k = front ? Math.min(0.62, dens * 0.7) : Math.min(1, dens * 1.4);
            if (threshold(x + i, ay + 2 * i) > k) continue;
            const top = ay < cy - 4 && fbm(x / 22, (ay - 3) / 11, seed, 3) < n - 0.04;
            if (front) p.solid(x, y, cloud, (0.08 + 0.14 * n) * night);
            else if (top) p.solid(x, y, airR, (0.32 + 0.16 * n) * night);
            else p.solid(x, y, cloud, (0.14 + 0.3 * n + 0.12 * (1 - q)) * night);
        }
    }

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // 2. Far: the limb, the sky's tint and the cloud sea far below (landing-art's layers, laid out for the fall)
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    function far(ctx, E, o) {
        const C = A.ENTRY, shx = o.shake ? o.shake[0] : 0, shy = o.shake ? o.shake[1] : 0, lift = Math.round(C.LIMB_TOP - o.hz);
        ctx.save(); ctx.translate(Math.round(shx * 0.3), Math.round(shy * 0.3));          // the far world shakes least
        if (E.air && E.tints.length) { const i = Math.min(E.tints.length - 1, Math.floor(o.z * (E.tints.length + 0.6)) - 1); if (i >= 0 && E.tints[i].done) ctx.drawImage(E.tints[i].canvas, 0, -lift); }
        if (E.limb.done) ctx.drawImage(E.limb.canvas, 0, -lift);
        if (E.air && E.layers.length) {
            const y0 = Math.round(o.hz + 4 - 18 + 22);                              // under the far band's billows: cloud all the way down
            if (y0 < FH && E.layers[0].done && E.world.atm >= 0.6) { if (o.M && o.M.deep && o.M.deep.done) ctx.drawImage(o.M.deep.canvas, 0, y0, FW, FH - y0, 0, y0, FW, FH - y0); else { ctx.fillStyle = (E.cloud || RP.HAZE).hex[1]; ctx.fillRect(0, y0, FW, FH - y0); } }   // (the polish round: the far sea under the bands in its own dim haze, never a black slot)   // (thin air: its torn sea shows the ground, as it should)
            E.layers.forEach((L, i) => {
                if (!L.done) return;
                const y = Math.round(o.hz + 4 + L.y * o.spread - 18 - (i === 0 ? BAND0_UP : 0));   // (the polish round: the farthest band a little higher, over the limb's own lit rim: no dotted line at the horizon between its billows)
                if (y >= FH) return;
                const off = ((Math.round(o.scroll * L.speed) % C.SEA_W) + C.SEA_W) % C.SEA_W;
                ctx.drawImage(L.canvas, -off, y); ctx.drawImage(L.canvas, C.SEA_W - off, y);
                if (i === 0 && E.haze && E.haze.done) ctx.drawImage(E.haze.canvas, 0, C.LIMB_TOP - C.HAZE_UP - lift);
            });
            if (E.depth && E.depth.done) ctx.drawImage(E.depth.canvas, 0, Math.round(o.hz + C.DEPTH_FROM));
        }
        ctx.restore();
    }

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // 3. The deck, close: its top, its body, its floor, all in world place (they rush past at the fall's speed)
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    function deck(ctx, E, M, o) {
        if ((o.shafts && o.shafts.length) || o.thin || (o.fadeIn != null && o.fadeIn < 1)) return deckShafts(ctx, E, M, Object.assign({}, o, { shafts: o.shafts || [] }));
        const k = o.k || 1, top = Math.round(o.top), base = Math.round(o.base), y0 = Math.max(0, Math.round(top + 58 * k)), y1 = Math.min(FH, base - Math.round(40 * k));   // the body: from under the billows' foot to above the torn floor (each edge ragged)
        if (o.near !== false && M && M.body && M.body.done && y1 > y0) {         // the body, laid from the deck's top: it moves with the world
            const B = M.body.canvas, sx = ((Math.round(o.ox * 0.95) % TOP_W) + TOP_W) % TOP_W, h = Math.min(y1 - y0, BODY_H), ty = Math.max(0, Math.min(BODY_H - h, y0 - top)), w1 = Math.min(FW, TOP_W - sx);
            ctx.drawImage(B, sx, ty, w1, h, 0, y0, w1, h);
            if (w1 < FW) ctx.drawImage(B, 0, ty, FW - w1, h, w1, y0, FW - w1, h);
            if (y1 - y0 > BODY_H) { ctx.fillStyle = M.ink; ctx.fillRect(0, y0 + BODY_H, FW, y1 - y0 - BODY_H); }
        }
        if (o.near !== false && M && M.top && M.top.done && top > -TOP_H * k && top < FH + 40) {   // the billows of its top, lit along their crests
            const w = Math.round(TOP_W * k), h = Math.round(TOP_H * k), ox = ((Math.round(o.ox * 0.9) % w) + w) % w, y = Math.round(top - 40 * k);
            ctx.drawImage(M.top.canvas, -ox, y, w, h); if (w - ox < FW) ctx.drawImage(M.top.canvas, w - ox, y, w, h);
        }
        if (M && M.under && M.under.done && base > -10 && base - UNDER_H * k < FH) {   // its torn floor
            const w = Math.round(UNDER_W * k), h = Math.round(UNDER_H * k), ox = ((Math.round(o.ox * 0.8) % w) + w) % w, y = Math.round(base - h + 6 * k);
            ctx.drawImage(M.under.canvas, -ox, y, w, h); if (w - ox < FW) ctx.drawImage(M.under.canvas, w - ox, y, w, h);
        }
    }

    /** Round 3, redone in the fix round: the deck with its shafts. The deck is drawn whole into its own layer; each shaft is
        a funnel of clearer air (as wide as its break at the deck's top, narrowing through it) cut out of that layer through
        one mask: its walls big billows bulging in and out (slow noise by the world row, a quarter of its width), torn over a
        few px into the mist; its top ragged (the hole opens below the deck's own billows); inside it the deck thins to torn
        mist toward the foot (a baked noise tile that moves with the world, never the Bayer grid), so the land shows through
        below. The find's own light glows up the light's shaft as a soft halo (graded steps of its ramp, brighten-only), the
        far wall lit in short patches only, a few rags stream up past us. o.shafts: [{ cx, hwTop, hwBot, kind, litSide }]. */
    let deckC = null, maskC = null, mistT = null;
    /** The polish round: P.pixelLayer that clears and puts only the rows and columns written since the last clear. */
    function dirtyLayer(W, H) {
        const c = document.createElement('canvas'); c.width = W; c.height = H;
        const g = c.getContext('2d'), img = g.createImageData(W, H), d = img.data, d32 = new Uint32Array(d.buffer);
        let x0 = W, y0 = H, x1 = -1, y1 = -1;
        const set = (x, y, rgb) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= W || y >= H) return; const o = (y * W + x) * 4; d[o] = rgb[0]; d[o + 1] = rgb[1]; d[o + 2] = rgb[2]; d[o + 3] = 255; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; };
        const tone = (x, y, r, v) => { const xi = Math.round(x), yi = Math.round(y), k = P.level(r, v, xi, yi); if (k > 0) set(xi, yi, r.rgb[k]); };
        const clear = () => { if (x1 >= 0) for (let y = y0; y <= y1; y++) d32.fill(0, y * W + x0, y * W + x1 + 1); x0 = W; y0 = H; x1 = -1; y1 = -1; };
        const draw = (ctx, x = 0, y = 0) => { if (x1 < 0) return; const w = x1 - x0 + 1, h = y1 - y0 + 1; g.putImageData(img, 0, 0, x0, y0, w, h); ctx.drawImage(c, x0, y0, w, h, x + x0, y + y0, w, h); };
        return { W, H, set, tone, clear, draw };
    }
    const wallRags = dirtyLayer(FW, FH), MIST_N = 128, halos = new Map(), THIN_MAX = 0.6;   // (THIN_MAX, the polish round, DRAFT: how much of the deck's floor band is holes at its very foot)
    function mistTile() {
        if (mistT) return mistT;
        mistT = new Float32Array(MIST_N * MIST_N);
        const wrap = (x, y) => { const a = fbm(x / 18, y / 11, 91, 3), b = fbm((x - MIST_N) / 18, y / 11, 91, 3), c = fbm(x / 18, (y - MIST_N) / 11, 91, 3), d = fbm((x - MIST_N) / 18, (y - MIST_N) / 11, 91, 3), u = x / MIST_N, v = y / MIST_N; return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v; };
        let lo = 1, hi = 0;
        for (let y = 0; y < MIST_N; y++) for (let x = 0; x < MIST_N; x++) { const n = wrap(x, y); mistT[y * MIST_N + x] = n; lo = Math.min(lo, n); hi = Math.max(hi, n); }
        for (let i = 0; i < mistT.length; i++) mistT[i] = (mistT[i] - lo) / (hi - lo || 1);
        return mistT;
    }
    /** A soft halo in a ramp's own steps (each pixel dithered between two neighbouring steps, so it reads as a gradient;
        the darkest steps left out: it only ever brightens), baked once per ramp and radius. */
    function halo(rp, rad, peak) {
        const key = rp.hex.join() + ':' + rad + ':' + peak;
        if (halos.has(key)) return halos.get(key);
        const c = document.createElement('canvas'); c.width = c.height = rad * 2 + 1;
        const g = c.getContext('2d'), img = g.createImageData(c.width, c.height);
        for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) {
            const dd = Math.hypot(x, y * 1.25) / rad; if (dd >= 1) continue;
            const k = P.level(rp, peak * Math.pow(1 - dd, 1.8), x + rad, y + rad);
            if (k < 2) continue;
            const rgb = rp.rgb[k], i = ((y + rad) * c.width + x + rad) * 4; img.data[i] = rgb[0]; img.data[i + 1] = rgb[1]; img.data[i + 2] = rgb[2]; img.data[i + 3] = 255;
        }
        g.putImageData(img, 0, 0);
        halos.set(key, c);
        return c;
    }
    /** A wall's bulge at screen row yy (0..1): rounded billows about 70 rows apart, unevenly spaced. */
    const bulge = (yy, s) => Math.pow(0.5 + 0.5 * Math.sin(yy / 11 + 7 * fbm(yy / 120, s, 61, 2)), 0.7);
    const BAY = new Float32Array(64); for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) BAY[y * 8 + x] = threshold(x, y);
    const WALL_N = 2048, wallKey = new Int32Array(4 * WALL_N).fill(-1 >>> 1), wallVal = new Float32Array(4 * WALL_N * 6), wr6 = new Float32Array(6);
    /** A shaft's wall at world row yy (its bulges, its fine tearing, its lit patches), cached by the row (the fix round). */
    function wallRow(si, yy) {
        const j = (si & 3) * WALL_N + (yy & (WALL_N - 1)), b = j * 6;
        if (wallKey[j] !== (yy | 0) + si * 100003) {
            const wy = yy / 4;
            wallKey[j] = (yy | 0) + si * 100003;
            wallVal[b] = bulge(yy, si * 7 + 1); wallVal[b + 1] = 2.5 * (vnoise(wy / 3, si + 2, 63) - 0.5);
            wallVal[b + 2] = bulge(yy + 37, si * 7 + 4); wallVal[b + 3] = 2.5 * (vnoise(wy / 3, si + 5, 63) - 0.5);
            wallVal[b + 4] = fbm(wy / 9, si + 11, 67, 1); wallVal[b + 5] = fbm(wy / 6, si + 9, 67, 2);
        }
        for (let k = 0; k < 6; k++) wr6[k] = wallVal[b + k];
        return wr6;
    }
    function deckShafts(ctx, E, M, o) {
        if (o.near === false && (o.base == null || o.base - UNDER_H * (o.k || 1) >= FH)) return;   // (the polish round: high above the deck nothing of it is drawn close: no shafts to cut)
        if (!deckC) { const c = document.createElement('canvas'); c.width = FW; c.height = FH; deckC = { c, g: c.getContext('2d') }; deckC.g.imageSmoothingEnabled = false; }
        if (!maskC) { const c = document.createElement('canvas'); c.width = FW; c.height = FH; const g = c.getContext('2d'), img = g.createImageData(FW, FH); maskC = { c, g, img, d32: new Uint32Array(img.data.buffer) }; }
        const g = deckC.g, air = E.airR || RP.ICE, cloud = E.cloud || A.mute(RP.DUST), top = Math.max(0, Math.round(o.top)), oy = Math.round(o.oy || 0), night = o.night || 1;
        const span = Math.max(60, (o.base || FH) - o.top), mist = mistTile(), md = maskC.d32, CUT = 0xff000000;
        g.clearRect(0, 0, FW, FH);
        deck(g, E, M, Object.assign({}, o, { shafts: null, thin: 0, fadeIn: 1 }));
        if (top >= FH) { ctx.drawImage(deckC.c, 0, 0); return; }
        md.fill(0, top * FW, FH * FW);
        wallRags.clear();
        let rags = false;
        o.shafts.forEach((s, si) => {
            const isL = s.kind === 'light';
            for (let y = top; y < FH; y++) {
                const q = clamp01((y - o.top) / span), qq = q * q * (3 - 2 * q), hw = s.hwTop + (s.hwBot - s.hwTop) * qq, yy = y + oy, wy = yy / 4;
                const wr = wallRow(si, yy), bl = hw * (0.4 * wr[0] - 0.12) + wr[1], br = hw * (0.4 * wr[2] - 0.12) + wr[3];   // big rounded billows bulging in (up to 0.28 of the width) and out, a little fine tearing (worked out once per world row: the fix round)
                const xl = s.cx - hw + bl, xr = s.cx + hw - br;
                if (xr - xl < 4) continue;
                const keep = o.landTop != null ? 0.5 * (1 - smooth(o.top, o.landTop + 30, y)) : 0.46 * (1 - smooth(0.05, 0.75, q)), mrow = ((y + oy) & (MIST_N - 1)) * MIST_N, dy = y - top;   // the mist left inside: thicker high in the deck, gone toward its foot
                const x0 = Math.max(0, Math.floor(xl) - 4), x1 = Math.min(FW - 1, Math.ceil(xr) + 4);
                for (let x = x0; x <= x1; x++) {
                    const din = Math.min(x - xl, xr - x);
                    if (din < -4) continue;
                    const mv = mist[mrow + ((x - Math.round(o.ox ? o.ox * 0.95 : 0)) & (MIST_N - 1))];
                    let open = din >= 5 ? 1 : (din + 4) / 9;                      // the wall torn over a few px into the mist
                    if (dy < 30) open *= clamp01((dy - 4 - 22 * mv) / 6);        // the hole opens below the deck's own billows, raggedly
                    open *= 1 - keep;
                    if (mv + (BAY[((y & 7) << 3) | (x & 7)] - 0.5) * 0.1 < open) md[y * FW + x] = CUT;
                }
                {                                                                 // (the polish round) each wall's edge lit a few px into the cloud: it reads as a rounded wall of cloud, never a dark wedge
                    const rp = isL && o.glow ? o.glow : air, tp = rp.hex.length - 1, lift = isL && o.glow ? 0.12 + 0.22 * qq : 0.14 + 0.08 * qq, rim = 3 + 4 * wr[4];
                    if (q < 0.3 || wr[5] < 0.42) continue;                         // low on the walls and broken: lit patches, never an outline
                    for (let side = -1; side <= 1; side += 2) {
                        const xe = side < 0 ? xl : xr, lit = (s.litSide ? (s.litSide === side ? 1 : 0.55) : 1) * 0.5 * (wr[5] - 0.42) / 0.58 * (0.4 + qq);
                        for (let k = 1; k <= rim; k++) {
                            const x = Math.round(xe + side * k), cov = (1 - k / (rim + 1)) * lit * (0.55 + 0.45 * wr[5]);
                            if (x < 0 || x >= FW || BAY[((y & 7) << 3) | ((x + 2) & 7)] >= cov) continue;
                            const v = (lift * (1 - 0.35 * k / rim)) * night, i = Math.max(1, Math.min(tp, Math.round(v * tp)));
                            wallRags.set(x, y, rp.rgb[i]); rags = true;
                        }
                    }
                }
            }
            for (let i = 0; i < 3; i++) {                                         // rags torn off the walls, streaming up past us
                const side = i % 2 ? 1 : -1, hw = (s.hwTop + s.hwBot) / 2, x = s.cx + side * (hw * 0.7 - 8 * hash(i, si, 63)), y = ((hash(i, si + 3, 63) * 900 - oy * 1.0) % (FH + 200) + FH + 200) % (FH + 200) - 100;
                if (y < top - 20) continue;
                if (rag(wallRags, { x, y, len: 90, w: 22, ux: 0, uy: -1, seed: 120 + i * 9 + si, front: false, cloud, air, night, litSide: -side })) rags = true;
            }
        });
        if (o.thin && o.base != null) {                                           // (the polish round) the deck's lower part torn into more and more holes toward its floor (world-locked mist): out of blind cloud the land comes in through them, never all at once
            const b = Math.round(o.base), y0 = Math.max(top, Math.floor(b - o.thin)), y1 = Math.min(FH - 1, b + 6), ox = Math.round(o.ox ? o.ox * 0.95 : 0);
            for (let y = y0; y <= y1; y++) {
                const k = THIN_MAX * clamp01((y - (b - o.thin)) / (o.thin + 4)), mrow = ((y + oy) & (MIST_N - 1)) * MIST_N, row = y * FW;   // (the final fix round: over the whole deck, evenly: a blind pass lets the land in steadily)
                if (k <= 0.01) continue;
                for (let x = 0; x < FW; x++) if (mist[mrow + ((x - ox) & (MIST_N - 1))] + (BAY[((y & 7) << 3) | (x & 7)] - 0.5) * 0.08 < k) md[row + x] = CUT;
            }
        }
        if (o.fadeIn != null && o.fadeIn < 1) {                                   // (the polish round) the deck close comes in exactly where the cover far above has dissolved (the same mist and jitter: meteor-land.js drawCover), never all at once at A_HAND
            const fi = o.fadeIn, ox = Math.round(o.ox ? o.ox * 0.95 : 0);
            for (let y = top; y < FH; y++) {
                const mrow = ((y + oy) & (MIST_N - 1)) * MIST_N, row = y * FW, by = (y & 7) << 3;
                for (let x = 0; x < FW; x++) if (mist[mrow + ((x - ox) & (MIST_N - 1))] + (BAY[by | (x & 7)] - 0.5) * 0.1 >= fi) md[row + x] = CUT;
            }
        }
        maskC.g.putImageData(maskC.img, 0, 0, 0, top, FW, FH - top);
        g.globalCompositeOperation = 'destination-out'; g.drawImage(maskC.c, 0, 0); g.globalCompositeOperation = 'source-over';
        const L = o.glow && o.glowAt && o.shafts.find(s => s.kind === 'light');
        if (L) { const hb = halo(o.glow, 110, 0.44); ctx.drawImage(hb, Math.round(o.glowAt[0] - 110), Math.round(o.glowAt[1] - 110)); }   // (the final fix round: its light coming up the shaft, wide and faint)
        if (L) { const h = halo(o.glow, 46, 0.56); ctx.drawImage(h, Math.round(o.glowAt[0] - 46), Math.round(o.glowAt[1] - 46)); }   // the find's light glowing up its shaft (under the deck: it shows through the clear air)
        ctx.drawImage(deckC.c, 0, 0);
        if (rags) wallRags.draw(ctx);
    }

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // 4. What tears past: wisps, the air's streaks
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    function wisp(ctx, M, i, o) {
        const set = o.front ? M.front : M.wisps, c = set[i % set.length];
        if (!c || !c.done) return false;
        const w = WISP_W * o.s * o.sx, h = WISP_H * o.s * o.sy;
        if (o.x + w < -40 || o.x - w > FW + 40 || o.y + h < -40 || o.y - h > FH + 40) return false;
        ctx.save();
        ctx.setTransform(o.s * o.sx, 0, (o.shear || 0) * o.s * o.sy, o.s * o.sy, Math.round(o.x), Math.round(o.y));
        ctx.drawImage(c.canvas, -WISP_W / 2, -WISP_H / 2);
        ctx.restore();
        return true;
    }
    /** A rag of cloud torn past at speed, into a pixel layer at the art's own size: a long soft streak along (ux, uy), its
        body uneven (seeded noise that travels with it), lit along the edge toward the light; front: darker and sparser (it
        passes between us and the shuttle). o: { x, y, len, w, ux, uy, seed, front, cloud, air, night } */
    const RAG_T = (() => {                                                    // (the polish round) the rags' fine noise baked once: vnoise(a / 14, b / 4.5) tiled 256 x 128
        const t = new Float32Array(256 * 128), f = (a, b) => vnoise(a / 14, b / 4.5, 3);
        for (let j = 0; j < 128; j++) for (let i = 0; i < 256; i++) { const u = i / 256, v = j / 128; t[j * 256 + i] = (f(i, j) * (1 - u) + f(i - 256, j) * u) * (1 - v) + (f(i, j - 128) * (1 - u) + f(i - 256, j - 128) * u) * v; }
        return t;
    })();
    function rag(L, o) {
        const nx = -o.uy, ny = o.ux, hl = o.len / 2, hw = o.w / 2, R = o.front ? o.cloud : o.cloud, night = o.night || 1;
        const ex = Math.abs(o.ux) * hl + Math.abs(nx) * hw, ey = Math.abs(o.uy) * hl + Math.abs(ny) * hw;
        if (o.x + ex < 0 || o.x - ex > FW || o.y + ey < 0 || o.y - ey > FH) return false;
        const tearL = Math.max(14, o.len * 0.28);
        for (let a = -hl; a < hl; a += 1) {
            const tear = smooth(0.3, 0.52, vnoise(a / tearL + 3.7, 7.3, o.seed + 11));   // torn into a few ragged pieces with gaps
            if (tear <= 0) continue;
            const qa = a / hl, along = (1 - qa * qa * (qa > 0 ? 1 : 0.6)) * tear;  // the head (toward the way it goes) rounder, the tail longer
            const wHere = hw * (0.45 + 0.55 * Math.sqrt(Math.max(0, along))) * (0.55 + 0.8 * vnoise(a / 15, 1, o.seed));   // a ragged outline (never a smooth capsule)
            for (let b = -wHere; b < wHere; b += 1) {
                const qb = b / wHere, n = RAG_T[(((b + o.seed * 7) | 0) & 127) * 256 + (((a + o.seed * 29) | 0) & 255)], dens = along * (1 - qb * qb) * (0.2 + 1.1 * n) * (o.front ? 0.5 : 0.9);
                const x = Math.round(o.x + o.ux * a + nx * b), y = Math.round(o.y + o.uy * a + ny * b);
                if (x < 0 || y < 0 || x >= FW || y >= FH || threshold(x, y) > dens) continue;
                const lit = qb * (o.litSide || -1) > 0.5 && n > 0.42;
                L.tone(x, y, lit ? o.air : R, (o.front ? (lit ? 0.36 + 0.12 * n : 0.16 + 0.18 * n) : lit ? 0.5 + 0.14 * n : 0.3 + 0.3 * n + 0.1 * (1 - Math.abs(qb))) * night);
            }
        }
        return true;
    }
    /** Under the deck: rain or snow hanging from its floor in thin veils, falling slowly, fading before the ground (y: the
        floor on screen; ox: the world's offset, art px, so the veils stay where they hang). */
    function virga(f, y, ox, t, cloud, air, k) {
        if (y > FH || k <= 0) return;
        for (let i = 0; i < 46; i++) {
            const x = ((hash(i, 3, 41) * 1400 - ox * 0.95) % FW + FW) % FW, len = 30 + hash(i, 4, 41) * 90, speed = 18 + hash(i, 5, 41) * 22, ph = (t / 1000 * speed + hash(i, 6, 41) * len) % len;
            for (let s = 0; s < len; s += 2 + hash((i + s) & 255, 7, 41) * 3) {
                const yy = y + 4 + ((s + ph) % len), q = (yy - y) / len;
                if (yy < 0 || yy >= FH || threshold(Math.round(x), Math.round(yy)) > (1 - q) * 0.75 * k) continue;
                f.tone(x + q * 3, yy, i % 3 ? cloud : air, 0.2 + 0.18 * (1 - q));
            }
        }
    }
    /** The air going by: uneven specks along the way we move, brightest at the head, thinning back; more and longer the
        denser and faster the air; each streak at its own depth (front ones larger and brighter, two or three px wide at
        speed). Always a cold colour: on a warm world the streaks take the plasma's blue, never rust (they would read as
        embers). Near the hot shuttle they catch its light. o: { sx, sy, ux, uy, v, n, spd 0..1, near: [x, y, heat] } */
    function streaks(ctx, E, o) {
        const air = E.airR && !A.isWarm(E.airR) ? E.airR : PLASMA, hx = air.hex, last = hx.length - 1, BW = FW + 160, BH = FH + 200, spd = o.spd || 0, nr = o.near;
        for (let i = 0; i < o.n; i++) {
            const p = 0.35 + 1.5 * hash(i, 7, 3) * hash(i, 8, 3) + (i % 5 === 0 ? 0.6 : 0), front = p > 1.1;
            const hxp = ((hash(i, 1, 3) * BW * 7 - o.sx * p) % BW + BW) % BW - 80, hyp = ((hash(i, 2, 3) * BH * 7 - o.sy * p) % BH + BH) % BH - 100;
            if (hyp < (o.top || -999)) continue;
            const len = Math.min(150, 5 + o.v * p * 0.045), wide = front ? 1 + Math.round(2 * spd * Math.min(1, (p - 1.1) / 0.8)) : 1;
            const hot = nr && nr[2] > 0.2 && Math.hypot(hxp - nr[0], hyp - nr[1]) < 90 ? 1 : 0, lit = front || hot ? 0 : 1, rp = front && spd > 0.4 ? PLASMA : air, rh = rp.hex, rl = rh.length - 1;
            const line = front && spd > 0.3, hotOne = hot || i % 7 === 0;
            for (let s = 0; s < len; s += line ? 1 : 1 + hash((i * 7 + Math.round(s)) & 255, 9, 3) * 2.2) {
                if (!line && hash((i * 13 + Math.round(s * 3)) & 255, 11, 3) < 0.25) continue;
                const q = s / len, x = Math.round(hxp - o.ux * s), y = Math.round(hyp - o.uy * s);
                if (x < -2 || y < -2 || x >= FW || y >= FH) continue;
                if (line && threshold(x, y) > 1 - q * 0.9) continue;                // a line of moving air, thinning back to nothing
                const r2 = line && !hotOne ? air.hex : rh, l2 = r2.length - 1;
                ctx.fillStyle = r2[Math.max(1, l2 - lit - (line ? 1 : 0) - Math.round(q * (2.6 - spd)))];
                ctx.fillRect(x - (wide >> 1), y, wide, 1);
            }
        }
    }

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // 5. The shuttle in the fall: the cold plasma, its flames, its rattling plates
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    /** A soft light round (cx, cy) that only ever brightens: its darkest steps are left out (on a lit cloud they would
        read as a dark ring). */
    function glowLit(f, cx, cy, rad, rp, peak, min) {
        const lo = min == null ? 2 : min;
        for (let y = -rad; y <= rad; y++) for (let x = -rad; x <= rad; x++) {
            const d = Math.hypot(x, y) / rad; if (d >= 1) continue;
            const k = P.level(rp, peak * (1 - d) ** 1.6, Math.round(cx + x), Math.round(cy + y));
            if (k >= lo) f.px(cx + x, cy + y, rp.hex[k]);
        }
    }
    /** The bow of cold light round the leading face. o: { x, y (the bell on screen), dx, dy (the hull's axis toward its
        face: down the sprite), ux, uy (the way we move), d, heat 0..1.5, spd 0..1, t }. One envelope in two passes:
        plasmaBack (before the hull): the glowing air streaming back past the hull from the bow's horns, at most two hull
        lengths, filled in its core, frayed and broken into puffs that fade well before the frame's edge;
        plasmaFront (after the hull): the bow itself hugging the face (its inner edge half a px-scale off it, its ends swept
        back along the sides into the sheath), the face and the hull's leading half lit by it, sparks peeling back when it is
        too hot. In front of the hull only bright steps are used: it only ever brightens. */
    function bowGeom(o) {
        const d = o.d, k = clamp01(Math.max(o.heat, 0.75 * o.spd)), wx0 = 0.72 * o.dx + 0.28 * o.ux, wy0 = 0.72 * o.dy + 0.28 * o.uy, wl = Math.hypot(wx0, wy0) || 1;
        const wx = wx0 / wl, wy = wy0 / wl, nx = -wy, ny = wx, fx = o.x + o.dx * 1.4 * d, fy = o.y + o.dy * 1.4 * d, R = 3.1 * d;
        return { d, k, wx, wy, nx, ny, fx, fy, R, cx: fx - wx * (R - 0.6 * d), cy: fy - wy * (R - 0.6 * d), hot: o.heat > 1, top: PLASMA.hex.length - 1 };
    }
    function plasmaBack(f, o) {
        const g = bowGeom(o), { d, k, R } = g;
        if (k < 0.06) return;
        const L = Math.min(26 * d, (6 + 14 * k + 12 * o.spd) * d), flow = o.t * (0.06 + 0.3 * o.spd), tick = Math.floor(o.t / 70), ux = o.ux, uy = o.uy, nx = -uy, ny = ux;
        for (let i = 0; i < L; i++) {
            const q = i / L, fade = Math.pow(1 - q, 1.6) * (0.35 + 0.65 * k);
            if (fade < 0.05) continue;
            const puff = smooth(0.26, 0.55, vnoise((i + flow) / 9, 3.1, 71));      // broken into puffs as it trails
            if (puff <= 0) continue;
            const hw = R * (0.92 + 0.5 * q) * (0.85 + 0.3 * vnoise((i + flow) / 6, (tick & 63) / 3, 73)), cx = g.fx - ux * i, cy = g.fy - uy * i;
            for (let j = -hw; j <= hw; j += 1) {
                const e = Math.abs(j) / hw, prof = q < 0.15 ? 0.25 + 0.75 * e * e : lerp(0.35 + 0.65 * e * e, 1 - e * e, smooth(0.15, 0.45, q));   // edges by the face, a filled core behind
                const n = vnoise((i + flow) / 7, j / 2.6, 71), dens = fade * prof * puff * (0.45 + 0.9 * n) * (1 - e * e * 0.4);
                const px = cx + nx * j, py = cy + ny * j;
                if (threshold(Math.round(px) & 255, Math.round(py) & 255) > dens) continue;
                f.px(px, py, PLASMA.hex[Math.max(2, Math.min(g.top, Math.round(1.6 + dens * (g.top - 1))))]);
            }
        }
    }
    function plasmaFront(f, o) {
        const g = bowGeom(o), { d, k, R, wx, wy, nx, ny, cx, cy, top, hot } = g, tick = Math.floor(o.t / 50);
        if (k < 0.06) return;
        glowLit(f, Math.round(g.fx - o.dx * 2.6 * d), Math.round(g.fy - o.dy * 2.6 * d), Math.round(5.6 * d), PLASMA, 0.1 + 0.32 * k, 4);   // the hull's leading half lit by it
        glowLit(f, Math.round(g.fx + wx * 0.3 * d), Math.round(g.fy + wy * 0.3 * d), Math.round(R * 1.15), PLASMA, 0.2 + 0.55 * k, 3);   // the face, between the bow and the hull: strongest at the stagnation point
        const th = Math.max(1, Math.round((0.2 + 0.45 * k) * d));
        for (let a = -1.05; a <= 1.05; a += 0.4 / R) {                            // the bow: a thin bright line dead ahead, thinning and breaking up along the sides
            const aa = Math.abs(a), w = Math.pow(Math.cos(a * 1.25), 1.4), sweep = aa > 0.6 ? (aa - 0.6) * (aa - 0.6) * 5 * d : 0;
            const ca = Math.cos(a), sa = Math.sin(a), n = Math.max(1, Math.round(th * w));
            for (let j = 0; j < n; j++) {
                const r = R + j * 0.9, px = cx + (wx * ca + nx * sa) * r - wx * sweep, py = cy + (wy * ca + ny * sa) * r - wy * sweep;
                const flick = 0.75 + 0.25 * hash(Math.round(a * 50) & 255, (tick + j) & 255, 9), val = k * (0.4 + 0.6 * w) * flick * (1 - j / (n + 1) * 0.5);
                if (val < 0.22 || threshold(Math.round(px) & 255, Math.round(py) & 255) > 0.35 + 0.65 * w) continue;   // its ends only a dither of light
                f.px(px, py, PLASMA.hex[Math.max(4, Math.min(top, Math.round(val * top + 0.6 + (hot ? 0.6 : 0))))]);
            }
        }
        if (hot) for (let i = 0; i < 18; i++) {                                    // too hot: sparks peel back off the bow's horns
            const age = ((o.t / 480) + hash(i, 5, 7)) % 1, a = (hash(i, 9, 7) < 0.5 ? -1 : 1) * (0.8 + 0.5 * hash(i, 4, 7)), ca = Math.cos(a), sa = Math.sin(a), far = age * (50 + 40 * o.spd) * d / 3;
            const sx = cx + (wx * ca + nx * sa) * R - o.ux * far + nx * Math.sin(i + o.t / 110) * 2, sy = cy + (wy * ca + ny * sa) * R - o.uy * far + ny * Math.sin(i + o.t / 110) * 2;
            f.px(sx, sy, PLASMA.hex[top]); f.px(sx - o.ux, sy - o.uy, PLASMA.hex[top - 1]); if (age < 0.5) f.px(sx - 2 * o.ux, sy - 2 * o.uy, PLASMA.hex[top - 2]);
        }
    }
    /** A thruster's flame from (x, y) along (dx, dy) (unit): the drive's blue, hot at the nozzle; it coughs on the last of the fuel. */
    function flame(f, x, y, dx, dy, d, k, sputter) {
        const sp = sputter || 0, tick = Math.floor(performance.now() / 70);
        if (sp > 0 && hash(tick & 255, Math.round(x) & 255, 13) < sp * 0.55) { f.px(x, y, RP.PLUME.hex[2], Math.max(1, Math.round(d / 2)), 1); return; }
        const len = (6 + Math.random() * 4) * d * 0.85 * (k == null ? 1 : k) * (1 - sp * 0.5), nx = -dy, ny = dx;
        f.glow(Math.round(x + dx * d), Math.round(y + dy * d), Math.max(1, Math.round(1.8 * d)), RP.PLUME, 0.55);
        for (let i = 0; i < len; i++) {
            const q = i / len, w = Math.max(1, Math.round((1 - q * 0.65) * d * 1.1 + (q > 0.7 ? Math.random() : 0)));
            for (let j = 0; j < w; j++) f.tone(x + dx * i + nx * (j - w / 2), y + dy * i + ny * (j - w / 2), RP.PLUME, (1.05 - q) * (j === 0 || j === w - 1 ? 0.7 : 1));
        }
    }
    /** Loose plates and flecks round the hull while it shakes: a few hull-coloured chips flickering at its edge, k 0..1. */
    function rattle(f, x, y, d, k, t) {
        if (k < 0.15) return;
        const n = Math.round(2 + 6 * k), tick = Math.floor(t / 45);
        for (let i = 0; i < n; i++) {
            if (hash(i, tick & 255, 21) > 0.35 + 0.5 * k) continue;
            const a = hash(i, 3, 21) * 6.28, r = (3.2 + 2.6 * hash(i, 4, 21)) * d, jx = (hash(i, (tick + 1) & 255, 22) - 0.5) * 2 * k, jy = (hash(i, (tick + 2) & 255, 23) - 0.5) * 2 * k;
            f.px(x + Math.cos(a) * r * 0.55 + jx, y + Math.sin(a) * r + jy, RP.HULL.hex[i % 2 ? 3 : 2], Math.max(1, Math.round(d / 2.5)), 1);
        }
    }

    /** The polish round: what the deck's first close frames would build on first use, made ahead (rp: the light's ramp). */
    function warm(rp) {
        mistTile();
        if (!deckC) { const c = document.createElement('canvas'); c.width = FW; c.height = FH; deckC = { c, g: c.getContext('2d') }; deckC.g.imageSmoothingEnabled = false; }
        if (!maskC) { const c = document.createElement('canvas'); c.width = FW; c.height = FH; const g = c.getContext('2d'), img = g.createImageData(FW, FH); maskC = { c, g, img, d32: new Uint32Array(img.data.buffer) }; }
        if (rp) halo(rp, 46, 0.56);
    }
    /** GAME: a world's bakes let go (LandFall.js, when the landing closes or the stop is left): its cache entries and their
        queued jobs. */
    function forget(worldId) { const pre = worldId + ':'; cache.forEach((M, key) => { if (key.startsWith(pre)) { A.drop(M.tag); cache.delete(key); } }); }
    window.MeteorArt = Object.freeze({ forget /* GAME */, PLASMA, mist: () => mistTile(), warm, halo, dirtyLayer, glowLit, rag, virga, ceiling, skyAt, prepare, far, deck, wisp, streaks, plasmaBack, plasmaFront, flame, rattle, TOP_H, UNDER_H });
})();
