/* ═══ Silent Exodus · new screen (?new=1) · land/LandArtAir.js: THE METEOR in the game (PR #32) ═══
   Part of LandArt.js (the copy of prototypes/landing-meteor/landing-art.js: its header has the GAME: marks and the API of
   window.LandingArt), split off it: the long way down (§3: the planet's limb, its air, the cloud sea, the haze round the
   horizon, the sky's tints, the hulls in the air, the heat, the storm) and the old cloud deck (§4); forget(), and
   window.LandingArt itself.
   The split (2026-11-03, the house's 800-line limit): the code moved as it was; nothing in it changed but the names that cross.
   It loads after LandArt.js (window.LandingArtParts).
*/
(function () {
    'use strict';
    const Z = window.LandingArtParts;
    if (!Z) return;                                                          // (LandArt.js did not start)
    const { FH, ramp, norm3, FW, WORLDS, P, RP, fbm, smooth, threshold, clamp01, lerp, hash, PALE_HULL, INK, TOWER_W, R, sKey, globes, ORBIT, LW, LIGHT,
        SH, pending, stripBake, later, drawLight, rimEdge, dissolve, shuttleSprite, maskAt, drop, idle, demote, promote, orbitSky, hullShadow, globe,
        puffs, shuttle, podAt, plume, slowNow, lastTagNow, jobLogOn } = Z;

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // 3. The long way down: the planet's limb, its air, the cloud sea below us, side-on
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    const LIMB_R = 1150, LIMB_X = 380, LIMB_TOP = 210, LIMB_H = FH + 90;     // the limb canvas: horizon at LIMB_TOP, slides up 70
    const SEA_W = 960, SEA = [{ y: 0, h: 34, speed: 0.12, scale: 0.35, haze: 0.5 }, { y: 30, h: 84, speed: 0.3, scale: 0.6, haze: 0.25 }, { y: 70, h: 132, speed: 0.75, scale: 1, haze: 0 },
        { y: 118, h: 176, speed: 1.35, scale: 1.7, haze: 0 }, { y: 165, h: 230, speed: 2.4, scale: 2.9, haze: 0 }];   // the meteor: two nearer bands, their billows big (the sea we fall into grows as we near it)
    const horizonAt = x => LIMB_TOP + 1 + LIMB_R - Math.sqrt(LIMB_R * LIMB_R - (x - LIMB_X) * (x - LIMB_X));
    const TINTS = [0.1, 0.2, 0.32, 0.46];                                    // the upper sky takes the air's colour as we go deeper
    const HAZE_UP = 40, HAZE_DOWN = 70;                                      // the haze band round the horizon (rows above, below)
    const isWarm = rp => { const c = rp.rgb[Math.min(rp.rgb.length - 1, 3)]; return c[0] > c[2] + 18; };
    const hexOf = c => '#' + c.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
    /** A warm or strong air, cloud or ground seen in the dark: the same hue, desaturated, cooled toward blue and a step
        darker, so a red or amber light still reads on it. The orbit's orange becomes a dim rust, the poison's lime a dirty
        olive, the desert's dust a grey-brown: each world keeps its own colour family from orbit to the ground. k: how much. */
    function mute(rp, k) {
        k = k == null ? 1 : k;
        const s = 1 - 0.55 * k, dk = 1 - 0.2 * k;
        return ramp(...rp.rgb.map((c, i) => {
            if (i === 0) return rp.hex[0];
            const l = c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;
            return hexOf([(l + (c[0] - l) * s) * dk - 3 * k, (l + (c[1] - l) * s) * dk, (l + (c[2] - l) * s) * dk + 9 * k]);
        }));
    }

    /** The entry's still layers for one world: the limb (the world itself, huge, at the edge of its air), three bands of
        cloud sea (near to far, each a wide strip that repeats sideways), the haze round the horizon (the night's air-glow
        line in it), the sky's tints, and the cloud deck. S: LanderScene.look of this world (its cloud, air). */
    const entries = new Map();
    function entry(world, S) {
        const key = world.id + ':' + (world.night ? 'n' : 'd');
        if (entries.has(key)) return entries.get(key);
        // the limb is the world's equator seen edge-on: painted on its side (the disc's right edge) and turned a quarter
        // round, so the horizon is the equator, not a pole. Lf: the light in the frame; Lp: the same light on the side.
        const Lf = world.night ? [0.35, -0.6, -0.35] : [0.55, -0.75, 0.35], L = norm3(-Lf[1], Lf[0], Lf[2]);   // night: lit from beyond the limb, only its air glows
        const E = { key, world, S, done: false, air: world.atm > 0, layers: [], night: !!world.night, tints: [] }, tagE = 'entry:' + key;   // (the polish round: tagged by world)
        E.tag = tagE;
        const edge = LIMB_H - 1 - LIMB_TOP, twin = ringlessTwin(world), side = stripBake(LIMB_H, FW, (p, y0) => {
            const o = { cx: edge - LIMB_R, cy: LIMB_X - y0, r: LIMB_R, type: world.type, seed: world.seed, node: twin, sector: world.sector, L, dim: world.night ? 0.3 : world.atm > 0 ? 0.5 : 0.85 };   // seen through its air, the ground below is dim
            if (WORLDS) WORLDS.paint(p, o); else P.sphere(p, { cx: o.cx, cy: o.cy, r: o.r, ramp: RP.STONE, L });
        }, tagE, true);
        const lc = document.createElement('canvas'); lc.width = FW; lc.height = LIMB_H;
        E.limb = { canvas: lc, done: false };
        later(() => { const g = lc.getContext('2d'); g.save(); g.translate(0, LIMB_H); g.rotate(-Math.PI / 2); g.drawImage(side.canvas, 0, 0); g.restore(); E.limb.done = true; }, tagE, true);
        if (E.air) {
            // the world's own cloud and air (a warm or strong one already muted by the ground's look: landing-ground.js), so
            // the entry is the same colour family as the sky it opens onto under the cloud
            const cloud = (S && S.cloud) || mute(RP.DUST), airR = (S && S.airRamp) || RP.ICE, thin = world.atm < 0.6, seed = world.seed + 17, night = world.night ? 0.7 : 1;
            E.cloud = cloud; E.airR = airR;
            E.deckRamp = cloud;
            E.day = !world.night;
            SEA.forEach((band, i) => E.layers.push(Object.assign(seaBand(band, i, cloud, airR, thin, seed, night, tagE), band)));
            E.depth = stripBake(FW, LIMB_H - LIMB_TOP - DEPTH_FROM, paintDepth, tagE, true);
            E.haze = stripBake(FW, HAZE_UP + HAZE_DOWN, (p, y0) => paintHaze(p, y0, airR, E.night, world.atm), tagE, true);
            TINTS.forEach((cov, i) => E.tints.push(stripBake(FW, LIMB_TOP + 34, (p, y0) => paintTint(p, y0, airR, cov, i), tagE, true)));
            E.deck = null; E.sunLit = null;                                       // the meteor: its own deck (meteor-art.js); the old one is never baked
        }
        later(() => { E.done = true; }, tagE, true);
        entries.set(key, E);
        if (entries.size > 3) { const old = entries.keys().next().value; if (old !== key) entries.delete(old); }   // the decks are big: keep the last few
        return E;
    }
    /** One band of the cloud sea: billows lit along their crests, darker below, textured inside; the far bands hazier.
        Thin air tears it into patches with dithered edges, the ground showing between. */
    function seaBand(band, i, cloud, airR, thin, seed, night, tag) {
        const sc = band.scale, s0 = seed + i * 7;
        const wrap = (x, y, s, fx, fy) => { const a = fbm(x / (fx * sc), y / (fy * sc), s, 3), b = fbm((x - SEA_W) / (fx * sc), y / (fy * sc), s, 3); return 0.5 + ((a * (SEA_W - x) + b * x) / SEA_W - 0.5) * 1.45; };
        return stripBake(SEA_W, band.h + 24, (p, y0) => {
            for (let x = 0; x < SEA_W; x++) {
                const n = wrap(x, 3, s0, 90, 22), m = wrap(x, 40, s0 + 3, 90, 22);   // the billows' line, then their bodies
                const top = 18 - 15 * smooth(0.35, 0.8, n) - 5 * (m - 0.5);
                for (let y = 0; y < p.H; y++) {
                    const ay = y + y0;
                    if (ay < top) continue;
                    const d = ay - top, body = wrap(x, ay, s0 + 9, 90, 22), fine = wrap(x, ay, s0 + 13, 22, 6);
                    if (thin && d > 2) {                                                 // thin air: torn into patches, soft at their edges
                        const k = (body - 0.44) / 0.07;
                        if (k < 1 && k < threshold(x, ay) * 1.1) continue;
                    }
                    const above = thin ? wrap(x, ay - 2, s0 + 9, 90, 22) : 1, crest = d < 1.2 || (thin && above < 0.44 && body >= 0.44);
                    const lit = clamp01(0.55 - d / (band.h * 0.75) + (body - 0.5) * 0.75 + (fine - 0.5) * 0.4);
                    if (crest) { const top = airR.hex.length - 1, cv = lerp((0.32 + 0.16 * lit) * night, 0.24 * night, band.haze); p.solid(x, y, airR, Math.round(cv * top) / top); continue; }   // lit crests: the air's own light along the tops (the polish round: on a whole step and hazed with distance: never a dotted line on the horizon)
                    let v = (0.08 + 0.42 * lit + (d < 3 ? 0.06 : 0)) * night * (0.7 + 0.3 * sc);
                    v = lerp(v, 0.26 * night, band.haze);                                  // far: hazier, lower contrast
                    p.solid(x, y, cloud, v);
                }
            }
        }, tag || 'entry', true);
    }
    /** The haze round the horizon: lighter and hazier toward it, from HAZE_UP rows above to HAZE_DOWN below. At night a
        faint air-glow line on the limb so the horizon still reads. */
    function paintHaze(p, y0, airR, night, atm) {
        const top = airR.hex.length - 1, core = Math.round(0.55 * top) / top, glow = Math.round(0.35 * top) / top;   // on whole steps: solid, no dither dots
        for (let y = 0; y < p.H; y++) for (let x = 0; x < FW; x++) {
            const ay = y + y0 - HAZE_UP + LIMB_TOP, dh = ay - horizonAt(x);
            if (night && dh >= -0.5 && dh < 0.5) { p.solid(x, y, airR, core); continue; }       // the glowing air: one solid row on the limb
            if (night && dh >= -1.5 && dh < -0.5) { p.solid(x, y, airR, threshold(x, ay) < 0.7 ? glow : glow * 0.6); continue; }   // and a dithered row of it above
            if (night && dh >= 0.5 && dh < 2.5) { if (threshold(x, ay) < 0.4) p.solid(x, y, airR, glow * 0.6); continue; }
            const k = dh < 0 ? Math.exp(dh / 12) * 0.7 : Math.exp(-dh / 26);
            const cov = k * (night ? 0.35 : 0.55) * Math.min(1, 0.5 + atm * 0.5) * (0.45 + 1.1 * fbm(x / 9, ay / 2.5, 41, 2));   // (the polish round: in uneven veils, never one even dotted row)
            if (cov > 0.02 && threshold(x, ay) < cov) p.solid(x, y, airR, (dh < 0 ? 0.3 : 0.24) * (night ? 0.6 : 1));
        }
    }
    /** Darker toward the foot of the frame: the near cloud sea in its own shadow (the haze makes the far one lighter). */
    const DEPTH_FROM = 30;
    function paintDepth(p, y0) {
        const span = LIMB_H - LIMB_TOP - DEPTH_FROM;
        for (let y = 0; y < p.H; y++) { const ay = y + y0, k = 0.5 * smooth(0, 1, ay / span); for (let x = 0; x < FW; x++) if (threshold(x, ay + 3) < k) p.set(x, y, [5, 7, 10]); }
    }
    /** The upper sky's tint at one depth: the air's colour over space, thicker toward the horizon (thins the stars out). */
    function paintTint(p, y0, airR, cov, i) {
        for (let y = 0; y < p.H; y++) for (let x = 0; x < FW; x++) {
            const ay = y + y0, below = ay - horizonAt(x) + 34;
            if (below > 34) continue;
            const k = cov * (0.35 + 0.65 * clamp01(ay / LIMB_TOP));
            if (threshold(x, ay) < k) p.solid(x, y, airR, 0.1 + 0.05 * i + 0.1 * clamp01(ay / LIMB_TOP));
        }
    }

    /** A gas world may wear a ring; seen from inside its air, painted at the limb's size, a ring is a broad smear across the
        sky. A world of a type that can have one is painted at the limb from a ringless twin: the same type and light,
        another seed (the limb shows too little of the surface for the pattern to be missed). null: paint it as it is. */
    function ringlessTwin(world) {
        if (!WORLDS || !WORLDS.describe) return null;
        const node = k => ({ id: world.id + ':limb' + k, type: world.type, tags: [] });
        const ringOf = k => WORLDS.describe(node(k), world.sector).companion === 'ring';
        const ks = Array.from({ length: 40 }, (_, k) => k);
        if (!ks.slice(0, 12).some(ringOf)) return null;
        const k = ks.find(q => !ringOf(q));
        return k == null ? null : node(k);
    }

    /** One frame of the way down. v: { z 0..1, scroll (px flown), heat, shake, light: { kind, x, y, night, out } | null,
        hulls: [{ x, y, len, seed, from, to, angle, flip }], streaks: bool, speed, rho }. Returns whether the light showed. */
    function drawEntry(ctx, E, v, t) {
        const f = P.framer(ctx, FW, FH), sh = v.shake ? [Math.round((Math.random() - 0.5) * v.shake * 2), Math.round((Math.random() - 0.5) * v.shake * 2)] : [0, 0];
        ctx.save(); ctx.translate(sh[0], sh[1]);
        const lift = Math.round(70 * v.z);                                       // deeper: the horizon climbs
        if (E.air && E.tints.length) { const i = Math.min(E.tints.length - 1, Math.floor(v.z * (E.tints.length + 0.6)) - 1); if (i >= 0 && E.tints[i].done) ctx.drawImage(E.tints[i].canvas, 0, -lift); }
        if (E.limb.done) ctx.drawImage(E.limb.canvas, 0, -lift);
        if (E.air && E.layers.length) {
            const base = LIMB_TOP - lift, depth = v.z;
            E.layers.forEach((L, i) => {
                if (!L.done) return;
                const y = Math.round(base + 4 + L.y * (0.6 + 0.9 * depth) + (i === 2 ? 40 * (1 - depth) : 0) - 18);
                const off = ((Math.round(v.scroll * L.speed) % SEA_W) + SEA_W) % SEA_W;
                ctx.drawImage(L.canvas, -off, y); ctx.drawImage(L.canvas, SEA_W - off, y);
                if (i === 0 && E.haze && E.haze.done) ctx.drawImage(E.haze.canvas, 0, LIMB_TOP - HAZE_UP - lift);
            });
            if (E.depth && E.depth.done) ctx.drawImage(E.depth.canvas, 0, LIMB_TOP + DEPTH_FROM - lift);
        }
        f.reset();
        let shown = false;
        if (v.light && !v.noLight && v.light.x < FW + 20) shown = drawLight(f, v.light.kind, v.light.x, v.light.y, t, { night: v.light.night, cloud: E.air ? 0.55 : 0, wind: 0, out: v.light.out, burn: v.light.burn, beat: v.light.beat });
        (v.hulls || []).forEach(hu => drawHull(ctx, hu));
        if (v.streaks && E.air) streaks(ctx, v, LIMB_TOP - lift - 6, E);
        ctx.restore();
        return shown;
    }
    /** The air going past: wisps, not lines. Each is a few uneven specks along a slight wave, with gaps, brightest at its
        head, the rest fading back; more and faster the denser and quicker the air. */
    function streaks(ctx, v, top, E) {
        const air = E.airR || RP.ICE, n = Math.round(5 + 18 * clamp01(v.rho)), span = FH - top, hx = air.hex, last = hx.length - 1;
        for (let i = 0; i < n; i++) {
            const sp = 0.6 + hash(i, 7, 3), y0 = top + hash(i, 2, 3) * span, len = 6 + v.speed * 0.16 * sp, lit = clamp01(v.rho) > 0.25 ? 0 : 1;
            const x0 = FW + 20 - ((v.scroll * sp * 2.2 + hash(i, 1, 3) * 900) % (FW + 60)), ph = hash(i, 4, 3) * 6.28;
            for (let s = 0; s < len; s += 1 + hash((i * 7 + Math.round(s)) & 255, 9, 3) * 2.4) {   // uneven steps: gaps between specks
                if (hash((i * 13 + Math.round(s * 3)) & 255, 11, 3) < 0.28) continue;
                const q = s / len, x = Math.round(x0 + s), y = Math.round(y0 + Math.sin(ph + s * 0.35) * 1.2 * q);
                ctx.fillStyle = hx[Math.max(1, last - 1 - lit - Math.round(q * 2.4))];
                ctx.fillRect(x, y, 1, 1);
            }
        }
    }
    /** Dead hulls of our class drifting in the air: the living ship's own shape (nose cone, decks, skirt, bell), whole or
        snapped once, grey and rust-streaked, one row of dark deck windows, a cold pale rim on the side the false sun lights.
        Baked once each. */
    const hulls = new Map();
    function drawHull(ctx, hu) {
        const key = [hu.len, hu.seed, hu.from, hu.to, hu.angle, hu.flip].join(':');   // hu.len: already the size on screen (a few sizes: the caller rounds it)
        let c = hulls.get(key);
        if (!c) {
            const size = Math.ceil(hu.len * 1.25) + 10, p = P.painter(size, size, false);
            const o = { x: size / 2, y: size / 2, len: hu.len, ht: hu.len * 0.31, angle: hu.angle, flip: hu.flip, light: 0.66, rust: true, ramp: RP.HULL, seed: hu.seed, from: hu.from, to: hu.to, sun: 0, holes: 0.35 };
            const at = P.hull(p, o, P.shapeL);
            for (let u = Math.max(0.26, hu.from + 0.06); u < Math.min(0.84, hu.to - 0.04); u += 0.045) {   // the deck windows, dark: nobody aboard
                const [wx, wy] = at(u, -0.16), [wx2, wy2] = at(u + 0.014, -0.16);
                p.set(wx, wy, [8, 10, 13]); p.set(wx2, wy2, [8, 10, 13]);
            }
            rimEdge(p, 1, -1, PALE_HULL);
            c = { canvas: p.canvas(), half: size / 2 };
            hulls.set(key, c);
        }
        ctx.drawImage(c.canvas, Math.round(hu.x - c.half), Math.round(hu.y - c.half));
    }

    /** The heat: a bow of glowing air round the leading underside (we fly right and sink), in the air's own cold colour
        (never orange): brighter and wider as it heats, flickering, a cold plasma trail behind, sparks peeling back over 100.
        (x, y): the shuttle's centre. o: { lean } */
    function drawHeat(f, x, y, heat, t, rampH, o) {
        if (heat < 0.05) return;
        const k = clamp01(heat), hot = heat > 1, hx = rampH.hex, top = hx.length - 1, lean = (o && o.lean) || 0;
        const rx = 11 + 6 * k, ry = 15 + 5 * k, th = 1 + Math.round(2.5 * k) + (hot ? 1 : 0), peakA = 0.9 + lean, tick = Math.floor(t / 60);
        f.glow(Math.round(x + Math.cos(peakA) * rx * 0.8), Math.round(y + Math.sin(peakA) * ry * 0.8), Math.round(6 + 8 * k), rampH, 0.25 + 0.45 * k);
        for (let a = -0.9 + lean; a < 2.9 + lean; a += 0.7 / Math.max(rx, ry)) {
            const w = Math.exp(-Math.pow((a - peakA) / 1.05, 2));                        // brightest at the leading underside
            for (let j = 0; j < th; j++) {
                const r = 1 - j * 0.07, px = x + Math.cos(a) * rx * r, py = y + Math.sin(a) * ry * r;
                const flick = 0.75 + 0.25 * hash(Math.round(a * 40) & 255, (tick + j) & 255, 9);
                const val = k * w * flick * (1 - j / (th + 1) * 0.6) * (hot ? 1.15 : 1);
                if (val < 0.1) continue;
                f.px(px, py, hx[Math.max(1, Math.min(top, Math.round(val * top)))]);
            }
        }
        const trail = Math.round(14 + 40 * k);                                         // the plasma trail, cold, streaming back
        for (let s = 0; s < 3; s++) {
            const a0 = s === 0 ? -0.6 + lean : s === 1 ? 2.6 + lean : 2.1 + lean, sx = x + Math.cos(a0) * rx, sy = y + Math.sin(a0) * ry;
            for (let i = 0; i < trail * (s === 2 ? 0.6 : 1); i++) {
                const q = i / trail, wob = Math.sin(t / 90 + i * 0.4 + s) * q * 2;
                if (hash(i & 255, (tick + s * 7) & 255, 3) < q * 0.7) continue;
                f.px(sx - i, sy - i * 0.18 + wob, hx[Math.max(1, Math.round((top - 1) * (1 - q) * k))]);
            }
        }
        if (hot) for (let i = 0; i < 12; i++) {                                         // too hot: sparks peel back off the bow
            const age = ((t / 600) + hash(i, 5, 7)) % 1, a = peakA - 0.8 + hash(i, 9, 7) * 1.6;
            const sx = x + Math.cos(a) * rx - age * 70, sy = y + Math.sin(a) * ry - age * 22 + Math.sin(i + t / 120) * 2;
            f.px(sx, sy, hx[top]); f.px(sx - 1, sy, hx[Math.max(1, top - 1)]); if (age < 0.5) f.px(sx - 2, sy, hx[Math.max(1, top - 2)]);
        }
    }

    /** A storm world from above: lightning inside the cloud sea below, a cold flash and a second flicker every few seconds. */
    const BOLT = ramp(INK, '#16222e', '#3c5a78', '#9cc4e8', '#f2fbff');   // Worlds.js GLOW.bolt
    const STORM_EVERY_MS = 3300;
    function stormFlash(f, now, horizon) {
        const n = Math.floor(now / STORM_EVERY_MS), q = now - n * STORM_EVERY_MS;
        if (!(q < 140 || (q > 230 && q < 300))) return;
        const x = TOWER_W + 40 + hash(n & 255, 3, 17) * (FW - TOWER_W - 80), y = horizon + 30 + hash(n & 255, 9, 17) * (FH - horizon - 50);
        f.glow(x, y, q < 140 ? 34 : 22, BOLT, q < 140 ? 0.55 : 0.35);
    }
    /** A lightning cell across the way down: a tower of cloud lit from inside, dim, flickering every second or so with a
        short jagged bolt; struck: a bright flash round the shuttle. (x, y): its heart, at its depth. */
    const CELL_MS = 1150;
    function stormCell(f, x, y, now, struck) {
        x = Math.round(x); y = Math.round(y);
        const n = Math.floor(now / CELL_MS), q = now - n * CELL_MS, on = q < 110 || (q > 180 && q < 230);
        f.glow(x - 3, y - 26, 14, BOLT, 0.22); f.glow(x + 2, y - 12, 18, BOLT, 0.28); f.glow(x, y + 2, 22, BOLT, on ? 0.62 : 0.3);   // a tower of cloud, lit from inside
        if (on) { let bx = x + Math.round((hash(n & 255, 2, 23) - 0.5) * 10), by = y - 16; for (let i = 0; i < 6; i++) { const nx = bx + Math.round((hash((n + i) & 255, 4, 23) - 0.5) * 6), ny = by + 4 + Math.round(hash((n + i) & 255, 6, 23) * 3); for (let k = 0; k <= 4; k++) f.px(Math.round(bx + (nx - bx) * k / 4), Math.round(by + (ny - by) * k / 4), k % 2 ? BOLT.hex[3] : BOLT.hex[4]); bx = nx; by = ny; } }
        if (struck) f.glow(x, y, 34, BOLT, 0.7);
    }

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // 4. The cloud deck: baked once per world (a tall dark texture at a few coverages), scrolled up as we sink
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    const DECK_H = 760, DECK_FILL = [0.12, 0.3, 0.5, 0.72, 1.0], DECK_B = 4, DECK_UP = 70;   // DECK_UP: px a second the deck rises past us
    function deckBake(E, seed) {
        const rp = E.deckRamp, gw = FW / DECK_B, gh = DECK_H / DECK_B, n = new Float32Array(gw * gh), night = E.night ? 0.55 : 1;
        const out = { levels: DECK_FILL.map(() => { const c = document.createElement('canvas'); c.width = FW; c.height = DECK_H; return { canvas: c, g: c.getContext('2d') }; }), done: false };
        const ROWS = 12;                                                        // a few rows of all five levels a job
        for (let y0 = 0; y0 < DECK_H; y0 += ROWS) later(() => {
            for (let by = Math.floor(y0 / DECK_B); by < Math.min(gh, Math.ceil((y0 + ROWS) / DECK_B)); by++) for (let bx = 0; bx < gw; bx++) n[by * gw + bx] = fbm(bx * DECK_B / 70, by * DECK_B / 34, seed, 3);
            out.levels.forEach((L, li) => {
                const img = L.g.createImageData(FW, ROWS), d = img.data, fill = DECK_FILL[li];
                for (let y = 0; y < ROWS && y0 + y < DECK_H; y++) for (let x = 0; x < FW; x++) {
                    const ay = y0 + y, nn = n[Math.floor(ay / DECK_B) * gw + Math.floor(x / DECK_B)], cover = clamp01((nn - 0.5 + fill * 1.2) * 2.6);
                    if (cover <= 0 || cover < threshold(x, ay)) continue;
                    const v = Math.min(0.5, 0.06 + 0.5 * smooth(0.3, 0.74, nn)) * night, top = rp.rgb.length - 1, pos = v * top, lo = pos | 0, lv = Math.min(top, lo + (pos - lo > threshold(x + 3, ay + 1) ? 1 : 0)), c = rp.rgb[lv];   // billow tops lit to about half
                    const i = (y * FW + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
                }
                L.g.putImageData(img, 0, y0);
            });
        }, 'entry', true, 'deck');
        later(() => { out.done = true; }, 'entry', true, 'deck');
        return out;
    }
    const deckLevel = k => Math.min(DECK_FILL.length - 1, Math.round(smooth(0, 0.55, k) * (DECK_FILL.length - 1)));
    const deckScroll = t => Math.round((t / 1000) * DECK_UP) % (DECK_H - FH);
    /** The cloud deck: k 0 just at the tops, 1 deep inside; it rises from below and closes over. The light under it shows
        as a smudge of its own colour. Returns whether the light showed. */
    function drawCloud(ctx, E, k, t, o) {
        const f = P.framer(ctx, FW, FH), dk = E.deck;
        o = o || {};
        if (dk && dk.done) {
            const sy = deckScroll(t), fill = smooth(0, 0.55, k), line = Math.max(0, Math.round(FH * (1 - fill * 1.4) - 40));
            if (line > 0) ctx.drawImage(dk.levels[0].canvas, 0, sy, FW, line, 0, 0, FW, line);
            ctx.drawImage(dk.levels[deckLevel(k)].canvas, 0, sy + line, FW, FH - line, 0, line, FW, FH - line);
            if (E.sunLit && E.sunLit.done) dissolve(ctx, E.sunLit.canvas, 0.85 * (1 - smooth(0.15, 1, k)));   // by day the sun above the deck lights its top
        }
        if (o.lamp) f.glow(o.lamp[0], o.lamp[1], 30, R.LAMP, 0.3);                // the shuttle's own lamp lighting the murk round it
        let shown = false;
        if (o.light) shown = drawLight(f, o.light.kind, o.light.x, o.light.y, t, { night: o.light.night, cloud: 0.7 + 0.3 * k, out: o.light.out, burn: o.light.burn });
        if (o.beam) beam(f, o.beam, t);
        return shown;
    }
    /** Faster wisps of the deck passing in front of everything (the sparse level, scrolled quicker, through a dither). */
    let wispC = null;
    function cloudWisps(ctx, E, t, k) {
        const dk = E.deck;
        if (!dk || !dk.done) return;
        if (!wispC) { wispC = document.createElement('canvas'); wispC.width = FW; wispC.height = FH; }
        const g = wispC.getContext('2d'), sy = Math.round((t / 1000) * DECK_UP * 2.6 + 211) % (DECK_H - FH);
        g.globalCompositeOperation = 'copy'; g.drawImage(dk.levels[1].canvas, 0, sy, FW, FH, 0, 0, FW, FH); g.globalCompositeOperation = 'source-over';
        dissolve(ctx, wispC, 0.22 + 0.2 * k);
    }
    /** The shuttle inside the deck: solid but darkened toward the cloud's colour, wisps of the deck passing in front, its
        warm window the thing that still reads. (x, y) as shuttle(); k 0..1 how deep in. */
    const ghosts = new Map();
    let wisp = null;
    function ghost(ctx, E, x, y, k, t, o) {
        const d = 2, so = Object.assign({ rim: false }, o), S = shuttleSprite(d, 1, so), dk = 0.2 + 0.3 * k, key = sKey(d, 1, so) + ':' + dk.toFixed(1) + ':' + E.key;
        let c = ghosts.get(key);
        if (!c) {
            c = document.createElement('canvas'); c.width = S.canvas.width; c.height = S.canvas.height;
            const g = c.getContext('2d'); g.drawImage(S.canvas, 0, 0);
            g.globalCompositeOperation = 'source-atop'; g.globalAlpha = +dk.toFixed(1); g.fillStyle = (E.deckRamp || RP.DUST).hex[1]; g.fillRect(0, 0, c.width, c.height);
            if (ghosts.size > 24) ghosts.clear();
            ghosts.set(key, c);
        }
        const ax = Math.round(x) - S.ox, ay = Math.round(y) - S.oy;
        ctx.drawImage(c, ax, ay);
        if (E.deck && E.deck.done) {                                             // the deck's own wisps, passing in front of it (a sparse grain of it)
            const sy = deckScroll(t), w = c.width, h = c.height, src = E.deck.levels[DECK_FILL.length - 1].canvas, lvl = Math.round(3 + 4 * k);
            if (!wisp || wisp.c.width < w || wisp.c.height < h) { const wc = document.createElement('canvas'); wc.width = Math.max(w, 64); wc.height = Math.max(h, 96); wisp = { c: wc, g: wc.getContext('2d'), pats: [] }; }
            const g = wisp.g;
            if (!wisp.pats[lvl]) wisp.pats[lvl] = g.createPattern(maskAt(lvl), 'repeat');
            g.globalCompositeOperation = 'copy'; g.drawImage(src, Math.max(0, Math.min(FW - w, ax)), Math.max(0, Math.min(DECK_H - h, sy + ay)), w, h, 0, 0, w, h);
            g.globalCompositeOperation = 'destination-in'; g.fillStyle = wisp.pats[lvl]; g.fillRect(0, 0, w, h);
            g.globalCompositeOperation = 'source-over';
            ctx.drawImage(wisp.c, 0, 0, w, h, ax, ay, w, h);
        }
        ctx.fillStyle = RP.AMBER.hex[3];
        const win = S.win, kk = Math.max(1, Math.round(d * 0.7));
        ctx.fillRect(Math.round(x + win[0] - kk / 2), Math.round(y + win[1]), kk, kk);
    }
    /** The machines' searchlight: a pale shaft up through the cloud that has found us. */
    function beam(f, b) {
        const n = 90, w0 = 2, w1 = 9;
        for (let i = 0; i < n; i++) {
            const q = i / n, x = lerp(b.x0, b.x1, q), y = lerp(b.y0, b.y1, q), w = lerp(w1, w0, q);
            for (let k = -w; k <= w; k++) if (threshold(Math.round(x + k), Math.round(y)) < 0.22 * (1 - Math.abs(k) / (w + 1)) * (0.6 + 0.4 * q)) f.tone(x + k, y, R.LAMP, 0.55);
        }
    }


    /** GAME: a world's globes and its entry let go, with their queued jobs (LandFall.js, when the landing closes or the stop
        is left: up to 2.4 MB a globe size, more for the entry's layers). */
    function forget(worldId) {
        const pre = worldId + ':';
        globes.forEach((g, key) => { if (key.startsWith(pre)) { drop('globe:' + key); globes.delete(key); } });
        entries.forEach((E, key) => { if (key.startsWith(pre)) { drop(E.tag); entries.delete(key); } });
    }
    window.LandingArt = Object.freeze({
        forget,   // GAME
        FW, FH, TOWER_W, ORBIT, LW, LIGHT, SH, R, DECK_UP, ENTRY: Object.freeze({ LIMB_TOP, HAZE_UP, SEA_W, DEPTH_FROM, LIMB_H }), drawHull, shuttleSprite,
        later, idle, drop, pending, stripBake, demote, promote, slow: slowNow, lastTag: lastTagNow, jobLog: jobLogOn,
        orbitSky, hullShadow, globe, drawLight, puffs, entry, drawEntry, drawHeat, stormFlash, stormCell, drawCloud, cloudWisps, ghost, dissolve, shuttle, podAt, plume, beam, isWarm, mute, rimEdge, promote,
    });
})();
