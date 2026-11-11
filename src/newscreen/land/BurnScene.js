/* ═══ Silent Exodus · new screen (?new=1) · land/BurnScene.js: THE BURN, the pictures ═════════════════════════════════
   Part of the new look's landing (BurnFlight.js has the rules and the plan; BurnFall.js is the minigame). Ported from the
   sketch prototypes/landing-burn/burn.js, sketch 5 (approved 2026-11-11: "Yes, build it"). One continuous side view,
   640 x 360 art px, no cut and no arrow, and ONE camera distance from the top of the fall to the touchdown (K.Z art px per
   px of the world: a push-in during the approach hid the ground coming, four sketches running). Space above, the cloud sea
   far below with the find's light under it, the deck we fall through, then night: under the cloud the picture is dark,
   the engine's catch flashes the place into view and the flame, many shuttles long, is the light the land is seen by.
   The land sits at the foot of the picture from the burn on and she comes down onto it (BurnFlight.gapf: one smooth curve).
   At the touchdown a ring of dust races out both ways; then quiet, a lamp, the team stepping out.
   Everything is the game's own recipe: NSPaint (ramps, the 8 x 8 Bayer dither, noise, the hull), the world's colours are
   the bridge glass's (NSWorlds.palette), the find's light is LandingArt.drawLight (the light you saw from the bridge),
   our shuttle is LandingArt.shuttleSprite, the team are MiniCrew.small in their suits. Each picture is painted in strips
   by LandingArt's idle queue (stripBake), a few milliseconds at a time, kept per world and per place.
   NO SOUND: nothing here makes any (the meteor it stands in for has none either).

   window.BurnScene (frozen)
     FW, FH                        the frame
     lookOf(world, find) → look    the world's ground and cloud ramps, the find's kind and its light
     prepare(world, find, W, look) → B   the pictures for this place, queued (B.tag); ready(B) when all are painted
     keep(ids)                     let go of every world's pictures but these
     view() → V                    one landing's moving things (the camera, the air's streaks, the dust)
     camera(V, S, dt)              the camera follows her down, at one distance
     burst(V, S)                   the dust thrown out at the touchdown
     draw(ctx, S, B, V, now, dt, o)   one frame (o.team: the people stepping out; o.shake 0..1)
*/
(function () {
    'use strict';
    const P = window.NSPaint, A = window.LandingArt, BF = window.BurnFlight;
    if (!P || !A || !BF || typeof document === 'undefined') return;
    const { RP, lerp, clamp01, smooth, fbm, vnoise, seeded, threshold } = P, K = BF.K, gapf = BF.gapf, SH = A.SH;
    const clamp = (v, a, b) => (v < a ? a : v > b ? b : v), mod = (v, n) => ((v % n) + n) % n;
    const FW = 640, FH = 360, GROUND_Y = 314, EDGE = 8;
    const Z = K.Z, D = K.D * Z, LEG_L = K.LEG_L * Z, SHIP_LEN = SH.LEN * D;         // the one camera distance: she is about 27 px tall, top to bottom
    const CLOUD_H = 220, AIR = RP.HAZE.hex[2], CREW_H = Math.round(16 * Z);
    const MARK_OF = { wreck: 'wreck', colony: 'colony', signal: 'signal', life: 'life', machines: 'machines', ruins: 'flare', graves: 'flare', plain: 'flare' };
    const LIGHT_RAMP = (window.MeteorLand && window.MeteorLand.LIGHT_RAMP) || { wreck: RP.RED, flare: RP.RED, colony: RP.AMBER, signal: RP.AMBER, life: RP.ICE, machines: RP.AMBER };

    /** The world's own colours (the bridge glass's), the find's kind and the light it shows by. */
    function lookOf(world, find) {
        let pal = null;
        try { pal = window.NSWorlds && typeof window.NSWorlds.palette === 'function' ? window.NSWorlds.palette(world.type) : null; } catch (err) { console.error('BurnScene: the world palette failed', err); }
        const ground = (pal && pal.ramp) || RP.STONE, kind = (find && find.kind) || 'plain', mark = MARK_OF[kind] || 'flare';
        return { ground, cloud: (pal && pal.atmo) || RP.DUSK, cloudLit: 0.42, kind, mark, lightRamp: LIGHT_RAMP[mark] || RP.RED };
    }

    // ═══ 1. the pictures, painted in strips by the idle queue, kept per world and per place ═══
    const worlds = new Map(), places = new Map();
    const rampId = new Map(), glows = new Map(), holes = new Map(), dims = new WeakMap();
    const idOf = r => { if (!rampId.has(r)) rampId.set(r, rampId.size + 1); return rampId.get(r); };
    /** A dithered glow, baked and kept: ramp, radius, peak in tenths. */
    function glowSprite(ramp, rad, peak) {
        const pk = clamp(Math.round(peak * 10), 0, 10);
        if (pk === 0) return null;
        const key = idOf(ramp) + ':' + rad + ':' + pk;
        const had = glows.get(key);
        if (had) { glows.delete(key); glows.set(key, had); return had; }               // asked for again: it is the newest (the one let go of is the one longest unused)
        const n = rad * 2 + 1, p = P.painter(n, n, false);
        p.region(0, 0, n, n, (x, y) => { const d = Math.hypot(x - rad, y - rad) / rad; if (d < 1) p.tone(x, y, ramp, (pk / 10) * Math.pow(1 - d, 1.5)); });
        const c = p.canvas();
        if (glows.size > 160) glows.delete(glows.keys().next().value);
        glows.set(key, c);
        return c;
    }
    /** A hole in the night: where the flame's light falls, the dark is taken away (dithered, strongest at the middle). */
    function holeSprite(rad) {
        if (holes.has(rad)) return holes.get(rad);
        const n = rad * 2 + 1, c = document.createElement('canvas'); c.width = c.height = n;
        const g = c.getContext('2d'), img = g.createImageData(n, n), px = new Uint32Array(img.data.buffer);
        for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
            const d = Math.hypot(x - rad, y - rad) / rad;
            if (d < 1 && threshold(x, y) < Math.pow(1 - d, 1.15) * 1.25) px[y * n + x] = 0xff000000;
        }
        g.putImageData(img, 0, 0);
        holes.set(rad, c);
        return c;
    }
    const HOLE_MIN = 40, HOLE_MAX = 280, HOLE_STEP = 20, CATCH_R = Math.round((80 + 40 * Z) / 8) * 8;   // CATCH_R: the catch's bloom, as light() rounds it
    /** The shuttle, dimmer: in the dark she is a shape, lit only by her own flame (a copy, kept with the sprite). */
    function dimmed(canvas, lum) {
        if (lum >= 1) return canvas;
        let m = dims.get(canvas);
        if (!m) { m = new Map(); dims.set(canvas, m); }
        let d = m.get(lum);
        if (!d) {
            d = document.createElement('canvas'); d.width = canvas.width; d.height = canvas.height;
            const g = d.getContext('2d');
            g.drawImage(canvas, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = 'rgba(3,5,8,' + (1 - lum).toFixed(2) + ')'; g.fillRect(0, 0, d.width, d.height);
            m.set(lum, d);
        }
        return d;
    }
    const shade = document.createElement('canvas'); shade.width = FW + EDGE * 2; shade.height = FH + EDGE * 2;
    const sg = shade.getContext('2d');
    /** The night over the picture from topY down, less where her light falls. list: [x, y, radius, strength] in art px. */
    function nightOver(ctx, dark, list, topY) {
        sg.setTransform(1, 0, 0, 1, 0, 0); sg.globalCompositeOperation = 'source-over'; sg.globalAlpha = 1;
        sg.clearRect(0, 0, shade.width, shade.height);
        sg.fillStyle = 'rgba(3,5,8,' + clamp01(dark).toFixed(3) + ')'; sg.fillRect(0, Math.max(0, topY + EDGE), shade.width, shade.height);
        sg.globalCompositeOperation = 'destination-out';
        for (let i = 0; i < list.length; i++) {
            const q = list[i];
            if (!(q[3] > 0.02)) continue;
            const r = clamp(Math.round(q[2] / HOLE_STEP) * HOLE_STEP, HOLE_MIN, HOLE_MAX);
            sg.globalAlpha = clamp01(q[3]); sg.drawImage(holeSprite(r), Math.round(q[0]) - r + EDGE, Math.round(q[1]) - r + EDGE);
        }
        sg.globalAlpha = 1;
        ctx.drawImage(shade, -EDGE, -EDGE);
    }
    function tiles(hex) {
        return Array.from({ length: 9 }, (_, k) => {
            const c = document.createElement('canvas'); c.width = 8; c.height = 8;
            const g = c.getContext('2d'); g.fillStyle = hex;
            for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (threshold(x, y) < k / 8) g.fillRect(x, y, 1, 1);
            return c;
        });
    }
    function cloudBake(look, seed, dens, tag) {
        const n = (x, y) => { const t = x / FW; return fbm(x / 70, y / 34, seed, 3) * (1 - t) + fbm((x - FW) / 70, y / 34, seed, 3) * t; };   // the same at both ends: it tiles
        return A.stripBake(FW, CLOUD_H, (p, y0) => p.region(0, 0, FW, p.H, (x, ly) => {
            const y = y0 + ly, a = smooth(0.33, 0.6, n(x, y) * (0.55 + 0.62 * Math.sin(Math.PI * clamp01(y / CLOUD_H)))) * dens;
            if (a > 0.02) p.cover(x, ly, look.cloud, look.cloudLit * (0.5 + 0.7 * clamp01(0.5 + (n(x, y + 7) - n(x, y)) * 5)), a);   // lit from above
        }), tag, true, 8);
    }
    function farBake(look, seed, i, tag) {
        const spec = [{ p: 0.06, rest: 214, amp: 16, v: 0.2, f: 190 }, { p: 0.2, rest: 242, amp: 26, v: 0.27, f: 120 }, { p: 0.5, rest: 270, amp: 30, v: 0.33, f: 80 }][i];   // dimmer the farther; a step lighter than they look, for the night lies over them
        const width = FW + Math.ceil(2 * 380 * spec.p) + EDGE * 3, PAD = 46, H = Math.ceil((FH - spec.rest + PAD + EDGE * 2) / 8) * 8;
        const tops = new Float32Array(width);
        for (let x = 0; x < width; x++) tops[x] = PAD - (fbm(x / spec.f, 3 + i * 5, seed + i * 13, 4) - 0.4) * 2 * spec.amp;
        const pic = A.stripBake(width, H, (p, y0) => { for (let x = 0; x < width; x++) for (let ly = Math.max(0, Math.floor(tops[x]) - y0); ly < p.H; ly++) { const y = y0 + ly, d = y - tops[x]; p.solid(x, ly, look.ground, spec.v + (d < 1.5 ? 0.07 : 0) + (fbm(x / 14, y / 9, seed + 40 + i, 2) - 0.5) * 0.1 - Math.min(0.08, d * 0.002)); } }, tag, true, 8);
        return { pic, p: spec.p, rest: spec.rest, pad: PAD };
    }
    /** What a world looks like on the way down: its sky, its cloud, its far land (the same for every find on it). */
    function worldPics(world, W, look) {
        if (worlds.has(world.id)) return worlds.get(world.id);
        const tag = 'burn:' + world.id, seed = W.seed, air = !!W.deck;
        const SKY_W = FW + EDGE * 2, SKY_H = Math.ceil((FH + K.ALT0 * 0.05 + EDGE * 2) / 8) * 8, rnd = seeded(seed * 7 + 1), stars = [], reach = air ? 0.55 : 0.92;
        for (let i = 0; i < (air ? 260 : 340); i++) { const x = Math.floor(rnd() * SKY_W), y = Math.floor(Math.pow(rnd(), air ? 1.4 : 1) * SKY_H * (air ? 0.74 : 0.95)), b = rnd(), keep = rnd(); if (y < SKY_H * reach && keep < 1 - (y / (SKY_H * reach)) * (air ? 0.8 : 0.3)) stars.push([x, y, b > 0.94 ? 4 : b > 0.72 ? 3 : 2]); }
        const Wp = { tag, air, thin: !!W.thin, look,
            sky: A.stripBake(SKY_W, SKY_H, (p, y0) => {                               // space above, the low air below (no air: stars to the ground)
                p.region(0, 0, SKY_W, p.H, (x, ly) => { const y = y0 + ly, low = y / SKY_H; p.tone(x, ly, RP.HAZE, air ? 0.05 + 0.5 * Math.pow(low, 2.2) + (fbm(x / 90, y / 60, seed, 2) - 0.5) * 0.14 * low : 0.04 + 0.1 * low); });
                stars.forEach(s => { if (s[1] >= y0 && s[1] < y0 + p.H) p.set(s[0], s[1] - y0, RP.STAR.rgb[s[2]]); });
            }, tag, true, 8),
            cloud: air ? cloudBake(look, seed + 3, W.thin ? 0.62 : 1, tag) : null, wisp: air ? cloudBake(look, seed + 71, 0.42, tag) : null,
            far: [0, 1, 2].map(i => farBake(look, seed, i, tag)),
            band: A.stripBake(FW + EDGE * 2, 88, (p, y0) => p.region(0, 0, p.W, p.H, (x, ly) => { const y = y0 + ly; p.tone(x, ly, look.ground, (air ? 0.46 : 0.2) * Math.pow(y / 88, 2.2) + (fbm(x / 60, y / 20, seed + 80, 2) - 0.5) * 0.07 * (y / 88)); }), tag, true, 8),
            hazeTiles: tiles(look.cloud.hex[clamp(Math.round(look.cloudLit * 0.85 * (look.cloud.hex.length - 1)), 1, look.cloud.hex.length - 1)]), airTiles: tiles(AIR), haze: null, air2: null };
        // the night's holes and the bloom of the engine's catch, made with this world's pictures, so the catch itself paints nothing new (or on the frame that first needs one)
        for (let r = HOLE_MIN; r <= HOLE_MAX; r += HOLE_STEP) if (!holes.has(r)) A.later(() => holeSprite(r), tag, true);
        for (let pk = 9; pk >= 2; pk--) A.later(() => glowSprite(RP.PLUME, CATCH_R, pk / 10), tag, true);
        worlds.set(world.id, Wp);
        return Wp;
    }
    /** The ground we land on: heights across 1520 px of the world, a level stretch by the light, the find's own things; painted at the camera's scale. */
    function placePics(world, find, W, look) {
        const key = world.id + ':' + ((find && find.id) || 'kind') + ':' + look.kind + ':' + W.pad;
        if (places.has(key)) return places.get(key);
        const tag = 'burn:' + world.id, X0 = -760, TW = 1520, UP = 96, seed = (W.seed + 131 * (key.length + key.charCodeAt(key.length - 1))) >>> 0;
        const hts = new Float32Array(TW);
        for (let i = 0; i < TW; i++) {
            const x = X0 + i, k = smooth(W.pad * 0.5, W.pad * 0.5 + 110, Math.abs(x));
            hts[i] = clamp(((fbm(x / 150, 4.2, seed, 4) - 0.42) * 2.2 * W.rough + (fbm(x / 23, 8.8, seed + 5, 2) - 0.5) * 9 + (vnoise(x / 6, 2.2, seed) - 0.5) * 1.6) * k, -14, UP - 8);
        }
        const at = x => { const f = clamp(x - X0, 0, TW - 1.001), i = Math.floor(f); return lerp(hts[i], hts[i + 1], f - i); };
        const AW = Math.ceil(TW * Z), TOP = Math.ceil(UP * Z), H = Math.ceil((TOP + 96 * Z) / 8) * 8, cap = 0.62;   // art px: the base line is TOP rows down; it reaches the foot of the picture
        const G = { key, tag, at, X0, top: TOP, H, light: { x: 44, up: 3 },
            pic: A.stripBake(AW, H, (p, y0) => { for (let i = 0; i < AW; i++) { const x = X0 + i / Z, surf = at(x) * Z; for (let ly = Math.max(0, Math.floor(TOP - surf) - y0); ly < p.H; ly++) { const r = y0 + ly, depth = surf - (TOP - r); p.solid(i, ly, look.ground, clamp(0.34 + (fbm(x / 26, r / Z / 14, seed + 9, 3) - 0.5) * 0.34 - depth * 0.01 + (depth < 1.5 ? 0.16 : depth < 3 ? 0.06 : 0), 0.08, cap)); } } }, tag, true, 8) };
        // the find's own things, set on the ground once it is painted (what is under the ground's line stays buried)
        A.later(() => {
            const sx0 = 36, sw = Math.ceil(150 * Z), sh = Math.ceil(64 * Z), foot = Math.round(14 * Z), p = P.painter(sw, sh, false);   // a small picture beside the level stretch
            const lx = x => (x - sx0) * Z, base = y => sh - foot - y * Z;              // the world's px → this picture's
            const rect = (x, w, h, r, v) => { const y = at(x), cx = lx(x), ww = Math.max(1.5, w * Z), hh = Math.max(1.5, h * Z); p.region(cx - ww / 2, base(y) - hh, cx + ww / 2, base(y) + 4, (px, py) => p.solid(px, py, r, v + (py < base(y) - hh + 1.2 ? 0.14 : 0) + (px < cx - ww / 2 + 1.2 ? 0.07 : 0))); };
            if (look.kind === 'wreck') {                                              // one of ours, half under the ground (the game's own hull recipe)
                P.hull(p, { x: lx(118), y: base(at(118)) - 4 * Z, len: 108 * Z, ht: 15 * Z, angle: 0.07, anchor: 0.5, from: 0.1, to: 0.86, ramp: RP.WRUST, light: 0.6, rust: true, holes: 0.6, seed: 21 }, P.shapeL);
                G.light = { x: 92, up: 15 };
            } else if (look.kind === 'colony') { [[74, 17, 8], [101, 22, 11], [133, 17, 8]].forEach(q => rect(q[0], q[1], q[2], RP.DARK, 0.26)); G.light = { x: 101, up: 7 }; }
            else if (look.kind === 'machines') { [[76, 20, 9], [106, 12, 16], [128, 24, 7]].forEach(q => rect(q[0], q[1], q[2], RP.DARK, 0.3)); G.light = { x: 106, up: 14 }; }
            else if (look.kind === 'ruins') { [[62, 5, 15], [80, 5, 9], [106, 6, 18], [124, 5, 6]].forEach(q => rect(q[0], q[1], q[2], RP.STONE, 0.3)); }
            else if (look.kind === 'graves') { [66, 78, 90, 102, 114].forEach((x, i) => rect(x, 3, 5 + (i % 2), RP.STONE, 0.36)); }
            else if (look.kind === 'signal') { rect(52, 1, 13, RP.STONE, 0.42); rect(52, 7, 1, RP.STONE, 0.34); G.light = { x: 52, up: 14 }; }
            for (let x = 0; x < sw; x++) { const yg = Math.ceil(base(at(sx0 + x / Z))); for (let y = Math.max(0, yg); y < sh; y++) p.clear(x, y); }   // under the ground's line: buried
            G.pic.g.drawImage(p.canvas(), Math.round((sx0 - X0) * Z), TOP - (sh - foot));
            G.dressed = true;
        }, tag, true);
        if (places.size > 3) places.delete(places.keys().next().value);
        places.set(key, G);
        return G;
    }
    function prepare(world, find, W, look) {
        const Wp = worldPics(world, W, look), G = placePics(world, find, W, look);
        return { tag: Wp.tag, world: Wp, ground: G, look, W };
    }
    const ready = B => !!(B && B.world.sky.done && (!B.world.air || (B.world.cloud.done && B.world.wisp.done)) && B.world.far.every(L => L.pic.done) && B.world.band.done && B.ground.pic.done && B.ground.dressed);
    /** Let go of every world's pictures but those of ids (the bridge left a stop, or moved to another world). */
    function keep(ids) {
        worlds.forEach((Wp, id) => { if (ids.includes(id)) return; A.drop(Wp.tag); worlds.delete(id); places.forEach((G, k) => { if (G.tag === Wp.tag) places.delete(k); }); });
    }

    // ═══ 2. one landing's moving things ═══
    function view() {
        return { cam: { x: 0, fy: 150 }, streaks: Array.from({ length: 110 }, () => ({ x: Math.random() * FW, y: Math.random() * FH, k: 0.85 + Math.random() * 0.9, b: Math.random() })),
            dust: [], embers: [], wasLit: false, layer: P.pixelLayer(FW + EDGE * 2, FH + EDGE * 2), fr: null, shipX: FW / 2 };
    }
    function camera(V, S, dt) {
        const look = lerp(160, 92, clamp01(Math.max(-S.vy / 380, S.thr * 0.9)));       // falling fast or burning, she sits high: room below for the flame and the land
        V.cam.fy += (Math.max(look, GROUND_Y - gapf(S.y)) - V.cam.fy) * Math.min(1, dt * 4);
        V.cam.x += (S.x * 0.85 - V.cam.x) * Math.min(1, dt * 3);
    }
    function puff(V, x, y, vx, vy, spark, max) { if (V.dust.length < 560) V.dust.push({ x, y, vx, vy, life: 0, max: max || 0.5 + Math.random() * 0.8, b: Math.random(), spark: !!spark }); }
    /** The touchdown: dust (and, in a crash, sparks) thrown out both ways along the ground; draw() adds the ring that races out with it. */
    function burst(V, S) {
        const L = S.landed, crash = L.grade === 'crash', n = crash ? 170 : L.grade === 'rough' ? 140 : 110;
        for (let i = 0; i < n; i++) {
            const side = i % 2 ? 1 : -1, sp = 130 + Math.random() * 360;
            puff(V, S.x + side * (8 + Math.random() * 22), L.restY + Math.random() * 3, side * sp, 3 + Math.random() * (16 + sp * 0.07), crash && i % 6 === 0, 0.9 + Math.random() * 1.5);
        }
    }

    // ═══ 3. one frame ═══
    function draw(ctx, S, B, V, now, dt, o) {
        o = o || {};
        const W = S.W, Wp = B.world, G = B.ground, look = B.look, t = now / 1000, cam = V.cam, deck = W.deck, k0 = o.shake == null ? 1 : o.shake, L = S.landed;
        if (!Wp.haze) { Wp.haze = Wp.hazeTiles.map(c => ctx.createPattern(c, 'repeat')); Wp.air2 = Wp.airTiles.map(c => ctx.createPattern(c, 'repeat')); }
        if (!V.fr) V.fr = P.framer(ctx, FW, FH);
        const tile = (tex, off, y) => { const x0 = -Math.round(mod(off, FW)); ctx.drawImage(tex, x0, y); ctx.drawImage(tex, x0 + FW, y); if (x0 > -EDGE) ctx.drawImage(tex, x0 - FW, y); };
        const light = (ramp, x, y, rad, peak) => { const r8 = Math.max(8, Math.round(rad / 8) * 8), c = glowSprite(ramp, r8, peak); if (c) ctx.drawImage(c, Math.round(x) - r8, Math.round(y) - r8); };
        const rho = BF.airAt(W, S.y), q = L ? 0 : S.q || 0, thr = L ? 0 : S.thr, kick = L ? 0 : S.kick, flick = Math.random();
        const sputter = !L && !S.lit && S.ign > 0;                                    // held, and not yet caught
        const strain = thr > 0.94 ? 1 : 0;                                            // all she has
        const amp = ((2.4 + 0.9 * q + 1.1 * strain) * thr + 2 * q * (1 - thr) + S.thump * 5 + kick * 6 + (sputter ? 0.9 : 0)) * k0;
        const shx = Math.round((Math.random() - 0.5) * 2 * amp), shy = Math.round((Math.random() - 0.5) * 2 * amp + Math.sin(t * 41) * 1.3 * thr * k0);
        const fy = cam.fy, gY = fy + gapf(S.y);                                       // her feet; the ground's own level
        const up = Y => fy + (S.y - Y), gr = Y => gY - Y * Z, scrX = X => FW / 2 + (X - cam.x) * Z, sx = scrX(S.x);
        const full = S.mode === 'full' && !!deck, dTop = deck ? deck[0] : 1e9, dBot = deck ? deck[1] : 1e9;
        const under = S.y < dBot + 140;
        // the night under the cloud (no cloud: night on the land from the start), and the light she makes in it
        const night = full ? smooth(dTop, dBot, S.y) : 1;
        const since = L ? S.t - L.at : 0, after = L ? Math.exp(-since / 0.9) : 0, lamp = L ? smooth(1, 1.9, since) : 0;   // the ground she scorched, cooling; then her lamp
        const glow = L ? after : clamp01(thr * (0.9 + 0.1 * flick) + kick * 0.5);
        // the ship's place on the screen; the catch throws her up a little
        const lean = Math.round(S.th / 0.03) * 0.03, c = Math.cos(S.th), sn = Math.sin(S.th), shaking = thr > 0.03 || sputter;
        const jx = L ? 0 : Math.round((Math.random() - 0.5) * (shaking ? 2 : q > 0.7 ? 1.4 : 0) * k0);
        const jy = L ? 0 : Math.round((Math.random() - 0.5) * (thr > 0.03 ? 2 : 0) * k0 - kick * 4 * k0);
        const bx = sx + LEG_L * sn + jx, by = fy - LEG_L * c + jy;                    // the bell: where she turns, where the flame leaves
        const dxA = -sn, dyA = c;                                                    // down her axis, on the screen
        V.shipX = sx;
        // the flame: a sputter while it catches, then as long as the engine is giving (many shuttles long at full); it stops at the ground
        const flame = thr > 0.03 ? SHIP_LEN * (1.2 + 5.4 * thr) * (0.95 + 0.1 * flick) * (1 + 0.3 * kick) : sputter && flick > 0.35 ? (7 + flick * 13) * Z : 0;
        let reach = flame, gHit = null;
        if (flame > 0 && under) for (let s2 = 6; s2 < flame; s2 += 3) { const px = bx + dxA * s2, py = by + dyA * s2, wx = S.x + (px - sx) / Z; if (py >= gr(G.at(wx))) { reach = s2; gHit = { x: wx, y: G.at(wx), near: clamp01(1 - s2 / flame) * thr }; break; } }

        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'source-over'; ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = P.INK; ctx.fillRect(0, 0, FW, FH);
        ctx.setTransform(1, 0, 0, 1, shx, shy);
        ctx.drawImage(Wp.sky.canvas, -EDGE, -EDGE - Math.round((Wp.sky.canvas.height - FH - EDGE * 2) * (1 - clamp01(S.y / K.ALT0))));

        // from high up: the cloud sea far below, the find's light under it
        if (full && S.y > dBot) {
            const seaY = Math.round(330 - (K.ALT0 - S.y) * (168 / (K.ALT0 - dTop)));
            if (seaY < FH + 60) {
                tile(Wp.cloud.canvas, cam.x * 0.14 + 80, seaY - 70);
                tile(Wp.cloud.canvas, cam.x * 0.2 + 311, seaY - 16);
                ctx.fillStyle = Wp.haze[Wp.thin ? 4 : 6]; ctx.fillRect(-EDGE, seaY + 110, FW + EDGE * 2, FH);
                ctx.globalCompositeOperation = 'lighten';
                light(look.lightRamp, clamp(FW / 2 - cam.x * 0.45, 40, FW - 40), seaY + 78, 34, 0.34 + 0.05 * Math.sin(t * 1.7));
                ctx.globalCompositeOperation = 'source-over';
            }
        }
        // under the cloud: the land at the foot of the picture, creeping up; then she comes down onto it (the far ridges slower than the ground itself)
        let horizon = -EDGE;
        if (under) {
            const sink = gY - GROUND_Y, tops = Wp.far.map((F, i) => Math.round(F.rest + sink * [0.55, 0.75, 0.9][i]));
            horizon = tops[0] - 82;
            ctx.drawImage(Wp.band.canvas, -EDGE, horizon);
            Wp.far.forEach((F, i) => { if (tops[i] - F.pad < FH + EDGE) ctx.drawImage(F.pic.canvas, Math.round(-(F.pic.canvas.width - FW) / 2 - cam.x * F.p), tops[i] - F.pad); });
            if (deck && S.y < dBot) {                                                 // the cloud we came through, now a ceiling
                const cy = Math.max(Math.round(up(dBot)) - CLOUD_H, -152);
                if (cy + CLOUD_H > -EDGE) { if (cy > -152) { ctx.fillStyle = Wp.haze[Wp.thin ? 4 : 6]; ctx.fillRect(-EDGE, -EDGE, FW + EDGE * 2, cy + 70 + EDGE); } tile(Wp.cloud.canvas, cam.x * 0.1 + 40, cy); }
            }
            const groundTop = Math.round(gY) - G.top;                                 // the ground itself, and the find's own things
            if (groundTop < FH + EDGE) {
                ctx.drawImage(G.pic.canvas, Math.round(scrX(G.X0)), groundTop);
                if (groundTop + G.H < FH + EDGE) { ctx.fillStyle = P.INK; ctx.fillRect(-EDGE, groundTop + G.H, FW + EDGE * 2, FH); }
            }
            const far = Wp.air ? clamp01((S.y - 160) / 1700) : 0;                     // the air between us and the land: thicker with depth, clearing as we come down
            for (let k = 1, n = Math.round(far * 4); k <= n; k++) { ctx.fillStyle = Wp.air2[k]; ctx.fillRect(-EDGE, tops[0] - 34 + (k - 1) * 16, FW + EDGE * 2, FH); }
        }
        // the cloud deck as we go through it
        const hd = full ? smooth(dTop + 90, dTop - 110, S.y) * smooth(dBot - 130, dBot + 70, S.y) : 0;
        if (full && S.y < dTop + 420 && S.y > dBot - 420) {
            const rows = Math.ceil((dTop - dBot) / 130) + 1;
            if (hd > 0.08) { ctx.fillStyle = Wp.haze[Math.round(hd * (Wp.thin ? 3 : 5))]; ctx.fillRect(-EDGE, -EDGE, FW + EDGE * 2, FH + EDGE * 2); }   // the murk first: the billows show on it as they rush up
            for (let k = 0; k < rows; k++) { const y = Math.round(up(dTop - k * 130)) - 40; if (y < FH + EDGE && y + CLOUD_H > -EDGE) tile(Wp.cloud.canvas, cam.x * (1 + 0.12 * (k % 3)) + k * 173, y); }
        }

        // the night: everything so far is dark, but for where her flame reaches (the catch flashes the whole place into view);
        // with no cloud the stars above the land are left alone
        const heat = thr < 0.05 && !L && Wp.air ? clamp01((q - 0.55) / 0.5) : 0;
        if (night > 0.02) {
            const list = [];
            if (!L && glow > 0.03) {
                list.push([bx + dxA * flame * 0.3, by + dyA * flame * 0.3, flame * 0.8 + 60 + 50 * Z, glow * 1.05]);
                list.push([bx + dxA * (flame + 60), by + dyA * (flame + 60), 170, 0.55 * glow]);          // it throws light ahead of itself: the land shows before the flame reaches it
                if (gHit) list.push([scrX(gHit.x), gr(gHit.y), 80 + 190 * gHit.near, (0.4 + 0.6 * gHit.near) * glow]);
            }
            if (!L && heat > 0.05) list.push([bx, by, 30 + 30 * Z, heat * 0.45]);
            if (L) { if (after > 0.03) list.push([sx, fy, 200, Math.min(1, after * 1.3)]); if (lamp > 0.02) list.push([sx, fy - 26, 180, 0.85 * lamp]); }
            nightOver(ctx, night * (0.64 - 0.46 * glow - 0.18 * kick - 0.1 * lamp), list, deck ? -EDGE : horizon + 24);
        }
        // the find's light shines through the dark, the one the bridge showed; while the place is still below the picture, its glow at the picture's foot
        if (under) {
            const lp = G.light, y0 = Math.round(gr(G.at(lp.x) + lp.up)), below = y0 > FH - 8, lx = clamp(Math.round(scrX(lp.x)), 12, FW - 12);
            V.fr.reset();
            try { A.drawLight(V.fr, look.mark, lx, below ? FH - 8 : y0, now, below ? { cloud: 0.55 } : { scale: 2, cloud: 0.45 * clamp01((S.y - 300) / 2400) }); } catch (err) { if (!V.lightErr) { V.lightErr = true; console.error('BurnScene: the find light failed', err); } }
            ctx.globalCompositeOperation = 'source-over';
        }

        // the air going past (dimmer in the dark), the rain, the flame (many pixels: one buffer)
        const layer = V.layer;
        layer.clear();
        const fallV = Math.max(0, -S.vy), streakOn = L ? 0 : clamp01(rho * 2.2 + hd) * clamp01((fallV - 50) / 140) * (Wp.air ? 1 : 0.35), streakDim = 1 - 0.42 * night;
        V.streaks.forEach(s => {
            s.y -= fallV * s.k * 0.9 * dt; s.x -= S.vx * 0.5 * dt;
            if (s.y < -40) { s.y = FH + Math.random() * 30; s.x = Math.random() * FW; }
            if (s.x < 0) s.x += FW; else if (s.x >= FW) s.x -= FW;
            if (streakOn <= 0.05 || s.b > streakOn + 0.15) return;
            const len = clamp(fallV * 0.07 * s.k, 2, 38);
            for (let i = 0; i < len; i++) layer.tone(s.x + EDGE, s.y + i + EDGE, RP.STAR, (0.28 + 0.34 * s.b) * (1 - i / len) * (0.6 + 0.6 * streakOn) * streakDim);
        });
        if (W.rain && S.y < dBot) for (let i = 0; i < 46; i++) {
            const rx = mod(i * 97.3 - t * 150 - S.vx * 0.2, FW + 40) - 20, ry = mod(i * 53.7 + t * (520 - S.vy * 0.5), FH + 40) - 20;
            for (let k = 0; k < 7; k++) layer.tone(rx - k * 0.45 + EDGE, ry + k + EDGE, RP.ICE, 0.52 - k * 0.045);
        }
        let groundLit = 0;
        if (flame > 0) {                                                             // a hard bright core, and a wider, softer burst around it that opens out behind her
            const lit = thr > 0.03, wb = (lit ? (0.6 + 0.4 * thr) * (1 + 0.3 * kick) : 0.4) * D * 2.2, hot = lit ? 0.66 + 0.34 * thr : 0.7;
            for (let s2 = 0; s2 < reach; s2++) {
                const k = s2 / flame, sway = lit ? Math.sin(k * 7 - t * 19) * k * 1.6 * Z : 0;
                const cx = bx + dxA * s2 + dyA * sway, cy = by + dyA * s2 - dxA * sway;
                const core = Math.max(0.6, wb * (Math.pow(1 - k, 0.55) * (1 + 0.3 * Math.exp(-Math.pow((k - 0.12) / 0.08, 2))) + 0.06));
                const env = lit ? core + wb * (0.5 + 1.5 * k) * (1 - k * k * k) * (0.75 + 0.5 * vnoise(s2 / 9 - t * 22, t * 9, 3)) : core;
                const bead = lit && k < 0.5 ? 0.1 * Math.cos(s2 / (1.9 * D)) * (1 - k * 2) : 0;   // the bright beads a hard flame holds near the bell
                for (let a = -Math.ceil(env); a <= Math.ceil(env); a++) {
                    const e = Math.abs(a), X = cx + dyA * a + EDGE, Y = cy - dxA * a + EDGE;
                    if (e <= core) layer.tone(X, Y, RP.PLUME, ((1.12 - k * 0.72) * (1 - (e / core) * (e / core) * 0.6) + bead) * hot);
                    else if (e <= env) layer.tone(X, Y, RP.PLUME, ((0.7 - 0.4 * k) * (1 - (e - core) / (env - core + 0.01)) + 0.12) * hot);
                }
            }
            if (gHit && thr > 0.2) {                                                  // where it meets the ground: light along it, and the dust blown out both ways
                groundLit = gHit.near;
                const gx = scrX(gHit.x), gy = gr(gHit.y), spread = 16 + 44 * gHit.near;
                for (let a = -spread; a <= spread; a++) for (let r = 0; r < 3; r++) layer.tone(gx + a + EDGE, gy - r - Math.abs(a) * 0.05 + EDGE, RP.PLUME, (1 - Math.abs(a) / spread) * (0.95 - r * 0.25) * (0.5 + 0.5 * flick));
                for (let i = 0, rate = 2 + Math.round(6 * gHit.near); i < rate; i++) puff(V, gHit.x + (Math.random() - 0.5) * 16, gHit.y + 1, (Math.random() < 0.5 ? -1 : 1) * (80 + Math.random() * 260) * (0.5 + gHit.near), 6 + Math.random() * 40);
            }
        }
        // the last of the flame, thrown clear when the engine stops
        if (V.wasLit && !S.lit && !L) for (let i = 0; i < 14; i++) V.embers.push({ x: bx + (Math.random() - 0.5) * 9 * Z, y: by + (4 + Math.random() * 22) * Z, vx: dxA * 150 + (Math.random() - 0.5) * 70, vy: dyA * (120 + Math.random() * 190), life: 0, max: 0.2 + Math.random() * 0.36 });
        V.wasLit = S.lit;
        for (let i = V.embers.length - 1; i >= 0; i--) {
            const e = V.embers[i]; e.life += dt;
            if (e.life > e.max) { V.embers.splice(i, 1); continue; }
            e.x += e.vx * dt; e.y += e.vy * dt;
            const k = 1 - e.life / e.max;
            layer.tone(e.x + EDGE, e.y + EDGE, RP.PLUME, 0.95 * k); layer.tone(e.x + EDGE, e.y - 1 + EDGE, RP.PLUME, 0.6 * k);
        }
        layer.draw(ctx, -EDGE, -EDGE);
        // the light she makes, as light: the air's heat on the way down, the flame's all along it, one hard bloom at the catch
        ctx.globalCompositeOperation = 'lighten';
        if (heat > 0.05) light(RP.SUN, bx + dxA * 6 * Z, by + dyA * 6 * Z, 24 * Z + 4, heat * 0.62);
        if (thr > 0.03) {
            light(RP.PLUME, bx + dxA * 10 * Z, by + dyA * 10 * Z, 36 + 30 * Z, clamp01((0.5 + 0.1 * flick) * thr + 0.1));
            light(RP.PLUME, bx + dxA * reach * 0.4, by + dyA * reach * 0.4, Math.min(120, 24 + reach * 0.36), clamp01(0.32 * thr + 0.08));
            light(RP.PLUME, bx + dxA * reach * 0.8, by + dyA * reach * 0.8, Math.min(96, 20 + reach * 0.28), clamp01(0.22 * thr + 0.05));
            if (gHit) light(RP.PLUME, scrX(gHit.x), gr(gHit.y) - 2, 56, (0.34 + 0.4 * groundLit) * thr);
        }
        if (kick > 0.2) light(RP.PLUME, bx + dxA * 10 * Z, by + dyA * 10 * Z, CATCH_R, clamp01(kick * 0.9));
        else if (sputter && flame > 0) light(RP.PLUME, bx + dxA * 6 * Z, by + dyA * 6 * Z, 16, 0.4);
        if (L && after > 0.08) light(RP.PLUME, sx, fy - 2, 48, after * 0.5);
        ctx.globalCompositeOperation = 'source-over';
        // our shuttle: lit by her own flame, a dim shape without it; the team stepping out in their suits, toward the light
        const broken = !!(L && L.grade === 'crash');
        const lum = (L ? lamp > 0.3 || after > 0.2 : thr > 0.22 || kick > 0.3) ? 1 : L ? 0.8 : night > 0.5 ? 0.6 : 0.8;
        const spr = A.shuttleSprite(D, 1, { lean, fold: S.fold < 0.25 ? 0 : S.fold < 0.75 ? 0.5 : 1, broken });
        ctx.drawImage(dimmed(spr.canvas, lum), Math.round(bx) - spr.ox, Math.round(by - SH.BELL * D) - spr.oy);
        if (!broken) { ctx.fillStyle = RP.AMBER.hex[3]; ctx.fillRect(Math.round(bx + spr.win[0]) - 1, Math.round(by - SH.BELL * D + spr.win[1]), 2, 1); }
        const MC = window.MiniCrew;
        if (MC && Array.isArray(o.team)) o.team.forEach(m => { try { MC.small(ctx, m.id, scrX(m.x), gr(G.at(m.x)) + 1, { h: CREW_H, pose: m.walking ? 'walk' : 'stand', t: m.t, facing: m.dir, suit: true, light: 0.6 + 0.4 * lamp }); } catch (err) { if (!V.crewErr) { V.crewErr = true; console.error('BurnScene: the team could not be drawn', err); } } });
        // the dust she raises: lit while there is a flame to light it
        const dustLit = Math.max(0.42 + 0.3 * lamp, glow), gn = look.ground.hex.length - 1;
        for (let i = V.dust.length - 1; i >= 0; i--) {
            const d = V.dust[i]; d.life += dt;
            if (d.life > d.max) { V.dust.splice(i, 1); continue; }
            d.vx *= Math.exp(-1.6 * dt); d.vy -= 26 * dt; d.x += d.vx * dt; d.y += d.vy * dt;
            const k = 1 - d.life / d.max, px = Math.round(scrX(d.x)), py = Math.round(gr(Math.max(d.y, G.at(d.x))));
            if (threshold(px, py) > k * 1.2) continue;
            const r = d.spark ? RP.AMBER : look.ground;
            ctx.fillStyle = r.hex[clamp(Math.round((d.spark ? 0.55 + 0.4 * k : (0.42 + 0.5 * d.b) * dustLit) * (r.hex.length - 1)), 1, r.hex.length - 1)];
            ctx.fillRect(px, py, d.b > 0.6 ? 2 : 1, d.b > 0.85 ? 2 : 1);
        }
        // the ring at the touchdown: a rounded front of dust racing out both ways, a wall behind it that thins and settles
        if (L && since > 0) {
            const big = L.grade === 'soft' ? 1 : 1.25, R = 430 * big * (1 - Math.exp(-since / 0.6)), fade = clamp01(1 - since / 3.2), ringLit = Math.max(0.72, Math.min(1, after * 1.5));
            if (fade > 0.02) for (let side = -1; side <= 1; side += 2) for (let off = 3; off < R + 22; off += 1 / Z) {
                const wx = S.x + side * off, px = Math.round(scrX(wx));
                if (px < -EDGE || px > FW + EDGE) continue;
                const base = Math.round(gr(G.at(wx))), behind = R - off, nose = behind < 0 ? Math.sqrt(Math.max(0, 1 - (behind / 22) * (behind / 22))) : 1;   // behind: how far back from the front
                const top = (6 + 17 * big * Math.exp(-Math.max(0, behind) / 70)) * nose * (0.45 + 0.55 * fade), dens = fade * (0.34 + 0.6 * Math.exp(-Math.max(0, behind) / 110));
                for (let r = 0; r < top; r++) {
                    const u = r / top, puffy = 0.45 + 1.1 * vnoise((wx - side * since * 46) / 18, (r + since * 7) / 6, 7);
                    if (threshold(px, base - r) > dens * (1 - u * u) * puffy) continue;
                    ctx.fillStyle = look.ground.hex[clamp(Math.round((0.5 + 0.45 * u) * ringLit * gn), 1, gn)];
                    ctx.fillRect(px, base - r, 1, 1);
                }
            }
        }
        // the cloud that whips past in front
        if (hd > 0.3) { const y = Math.round(mod(S.y * 1.6, CLOUD_H)) - CLOUD_H; for (let k = 0; k < 3; k++) tile(Wp.wisp.canvas, cam.x * 1.5 + k * 211, y + k * CLOUD_H); }
        ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    /** The world's own pictures alone, queued (the bridge's warm-up: the place is not known yet). → their tag */
    const warm = (world, W, look) => worldPics(world, W, look).tag;
    window.BurnScene = Object.freeze({ FW, FH, lookOf, prepare, ready, warm, keep, view, camera, burst, draw });
})();
