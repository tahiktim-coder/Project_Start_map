/* ═══ Silent Exodus · new screen (?new=1) · land/BurnScene.js: THE BURN, the pictures ═════════════════════════════════
   Part of the new look's landing (BurnFlight.js has the rules and the plan; BurnFall.js is the minigame). Ported from the
   sketch prototypes/landing-burn/burn.js (sketch 2, approved 2026-11-11). One continuous side view, 640 x 360 art px, no
   cut and no arrow: space above, the cloud sea far below with the find's light under it, the deck we fall through, then
   the land far below under haze, coming up the whole way (drawn nearer than true while we are high: BurnFlight.gapf),
   the engine's catch, the flame on the ground, the dust, the team stepping out.
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
     camera(V, S, dt)              the camera follows her
     draw(ctx, S, B, V, now, dt, o)   one frame (o.team: the people stepping out; o.shake 0..1)
*/
(function () {
    'use strict';
    const P = window.NSPaint, A = window.LandingArt, BF = window.BurnFlight;
    if (!P || !A || !BF || typeof document === 'undefined') return;
    const { RP, lerp, clamp01, smooth, fbm, vnoise, seeded, threshold } = P, K = BF.K, gapf = BF.gapf, SH = A.SH;
    const clamp = (v, a, b) => (v < a ? a : v > b ? b : v), mod = (v, n) => ((v % n) + n) % n;
    const FW = 640, FH = 360, GROUND_Y = 314, EDGE = 8, D = K.D, LEG_L = K.LEG_L;
    const CLOUD_H = 220, AIR = RP.HAZE.hex[2];
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
    const rampId = new Map(), glows = new Map();
    const idOf = r => { if (!rampId.has(r)) rampId.set(r, rampId.size + 1); return rampId.get(r); };
    /** A dithered glow, baked and kept: ramp, radius, peak in tenths. */
    function glowSprite(ramp, rad, peak) {
        const pk = clamp(Math.round(peak * 10), 0, 10);
        if (pk === 0) return null;
        const key = idOf(ramp) + ':' + rad + ':' + pk;
        if (glows.has(key)) return glows.get(key);
        const n = rad * 2 + 1, p = P.painter(n, n, false);
        p.region(0, 0, n, n, (x, y) => { const d = Math.hypot(x - rad, y - rad) / rad; if (d < 1) p.tone(x, y, ramp, (pk / 10) * Math.pow(1 - d, 1.5)); });
        const c = p.canvas();
        if (glows.size > 90) glows.clear();
        glows.set(key, c);
        return c;
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
        const spec = [{ p: 0.06, rest: 214, amp: 16, v: 0.13, f: 190 }, { p: 0.2, rest: 242, amp: 26, v: 0.18, f: 120 }, { p: 0.5, rest: 270, amp: 30, v: 0.23, f: 80 }][i];   // dimmer the farther: the ground we land on is the lightest
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
            band: A.stripBake(FW + EDGE * 2, 88, (p, y0) => p.region(0, 0, p.W, p.H, (x, ly) => { const y = y0 + ly; p.tone(x, ly, look.ground, (air ? 0.32 : 0.12) * Math.pow(y / 88, 2.2) + (fbm(x / 60, y / 20, seed + 80, 2) - 0.5) * 0.07 * (y / 88)); }), tag, true, 8),
            hazeTiles: tiles(look.cloud.hex[clamp(Math.round(look.cloudLit * 0.85 * (look.cloud.hex.length - 1)), 1, look.cloud.hex.length - 1)]), airTiles: tiles(AIR), haze: null, air2: null };
        worlds.set(world.id, Wp);
        return Wp;
    }
    /** The ground we land on: heights across 1520 px, a level stretch by the light, the find's own things. */
    function placePics(world, find, W, look) {
        const key = world.id + ':' + ((find && find.id) || 'kind') + ':' + look.kind + ':' + W.pad;
        if (places.has(key)) return places.get(key);
        const tag = 'burn:' + world.id, X0 = -760, TW = 1520, UP = 96, H = 160, seed = (W.seed + 131 * (key.length + key.charCodeAt(key.length - 1))) >>> 0;
        const hts = new Float32Array(TW);
        for (let i = 0; i < TW; i++) {
            const x = X0 + i, k = smooth(W.pad * 0.5, W.pad * 0.5 + 110, Math.abs(x));
            hts[i] = clamp(((fbm(x / 150, 4.2, seed, 4) - 0.42) * 2.2 * W.rough + (fbm(x / 23, 8.8, seed + 5, 2) - 0.5) * 9 + (vnoise(x / 6, 2.2, seed) - 0.5) * 1.6) * k, -14, UP - 8);
        }
        const at = x => { const f = clamp(x - X0, 0, TW - 1.001), i = Math.floor(f); return lerp(hts[i], hts[i + 1], f - i); };
        const row = Y => UP - Y, col = x => x - X0, cap = 0.56;                    // the picture stays mostly dark: a world's brightest steps are for its lights
        const G = { key, tag, at, X0, UP, H, light: { x: 44, up: 3 }, dark: look.ground.hex[1],
            pic: A.stripBake(TW, H, (p, y0) => { for (let i = 0; i < TW; i++) for (let ly = Math.max(0, Math.floor(row(hts[i])) - y0); ly < p.H; ly++) { const r = y0 + ly, depth = hts[i] - (UP - r); p.solid(i, ly, look.ground, clamp(0.3 + (fbm((X0 + i) / 26, r / 14, seed + 9, 3) - 0.5) * 0.34 - depth * 0.006 + (depth < 1.5 ? 0.16 : depth < 3.5 ? 0.06 : 0), 0.08, cap)); } }, tag, true, 8) };
        // the find's own things, set on the ground once it is painted (what is under the ground's line stays buried)
        A.later(() => {
            const sw = 150, sh = 64, sx0 = 36, p = P.painter(sw, sh, false), base = y => sh - 14 - y;      // a small picture beside the level stretch; local x = world x - sx0
            const rect = (x, w, h, r, v) => { const y = at(x + sx0); p.region(x - w / 2, base(y) - h, x + w / 2, base(y) + 6, (px, py) => p.solid(px, py, r, v + (py < base(y) - h + 1.5 ? 0.14 : 0) + (px < x - w / 2 + 2 ? 0.07 : 0))); };
            if (look.kind === 'wreck') {                                              // one of ours, half under the ground (the game's own hull recipe)
                P.hull(p, { x: 82, y: base(at(118)) - 4, len: 108, ht: 15, angle: 0.07, anchor: 0.5, from: 0.1, to: 0.86, ramp: RP.WRUST, light: 0.6, rust: true, holes: 0.6, seed: 21 }, P.shapeL);
                G.light = { x: 92, up: 15 };
            } else if (look.kind === 'colony') { [[38, 17, 8], [65, 22, 11], [97, 17, 8]].forEach(q => rect(q[0], q[1], q[2], RP.DARK, 0.26)); G.light = { x: 101, up: 7 }; }
            else if (look.kind === 'machines') { [[40, 20, 9], [70, 12, 16], [92, 24, 7]].forEach(q => rect(q[0], q[1], q[2], RP.DARK, 0.3)); G.light = { x: 106, up: 14 }; }
            else if (look.kind === 'ruins') { [[26, 5, 15], [44, 5, 9], [70, 6, 18], [88, 5, 6]].forEach(q => rect(q[0], q[1], q[2], RP.STONE, 0.3)); }
            else if (look.kind === 'graves') { [30, 42, 54, 66, 78].forEach((x, i) => rect(x, 3, 5 + (i % 2), RP.STONE, 0.36)); }
            else if (look.kind === 'signal') { rect(16, 1, 13, RP.STONE, 0.42); rect(16, 7, 1, RP.STONE, 0.34); G.light = { x: 52, up: 14 }; }
            for (let x = 0; x < sw; x++) { const yg = Math.ceil(base(at(x + sx0))); for (let y = yg; y < sh; y++) p.clear(x, y); }   // under the ground's line: buried
            G.pic.g.drawImage(p.canvas(), col(sx0), row(0) - (sh - 14));
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
        return { cam: { x: 0, fy: 178 }, streaks: Array.from({ length: 110 }, () => ({ x: Math.random() * FW, y: Math.random() * FH, k: 0.85 + Math.random() * 0.9, b: Math.random() })),
            dust: [], embers: [], wasLit: false, layer: P.pixelLayer(FW + EDGE * 2, FH + EDGE * 2), fr: null, shipX: FW / 2 };
    }
    function camera(V, S, dt) {
        const look = lerp(170, 108, clamp01(-S.vy / 380));                           // falling fast, she sits high: more of what is below
        V.cam.fy += (Math.max(look, GROUND_Y - gapf(S.y)) - V.cam.fy) * Math.min(1, dt * 5);
        V.cam.x += (S.x * 0.85 - V.cam.x) * Math.min(1, dt * 3);
    }
    function puff(V, x, y, vx, vy, spark) { if (V.dust.length < 260) V.dust.push({ x, y, vx, vy, life: 0, max: 0.5 + Math.random() * 0.8, b: Math.random(), spark: !!spark }); }
    /** The dust (and, in a crash, the sparks) thrown out at the touchdown. */
    function burst(V, S) {
        const L = S.landed, n = L.grade === 'crash' ? 90 : L.grade === 'rough' ? 60 : 34;
        for (let i = 0; i < n; i++) puff(V, S.x + (Math.random() - 0.5) * 50, L.restY, (Math.random() < 0.5 ? -1 : 1) * (40 + Math.random() * 190), 12 + Math.random() * 60, L.grade === 'crash' && i % 5 === 0);
    }

    // ═══ 3. one frame ═══
    function draw(ctx, S, B, V, now, dt, o) {
        o = o || {};
        const W = S.W, Wp = B.world, G = B.ground, look = B.look, t = now / 1000, cam = V.cam, deck = W.deck, k0 = o.shake == null ? 1 : o.shake;
        if (!Wp.haze) { Wp.haze = Wp.hazeTiles.map(c => ctx.createPattern(c, 'repeat')); Wp.air2 = Wp.airTiles.map(c => ctx.createPattern(c, 'repeat')); }
        if (!V.fr) V.fr = P.framer(ctx, FW, FH);
        const tile = (tex, off, y) => { const x0 = -Math.round(mod(off, FW)); ctx.drawImage(tex, x0, y); ctx.drawImage(tex, x0 + FW, y); if (x0 > -EDGE) ctx.drawImage(tex, x0 - FW, y); };
        const light = (ramp, x, y, rad, peak) => { const c = glowSprite(ramp, rad, peak); if (c) ctx.drawImage(c, Math.round(x) - rad, Math.round(y) - rad); };
        const rho = BF.airAt(W, S.y), q = S.landed ? 0 : S.q || 0, thr = S.landed ? 0 : S.thr, kick = S.landed ? 0 : S.kick, flick = Math.random();
        const sputter = !S.landed && !S.lit && S.ign > 0;                             // held, and not yet caught
        const amp = ((2.5 + 0.9 * q) * thr + 1.5 * q * (1 - thr) + S.thump * 5 + kick * 5 + (sputter ? 0.8 : 0)) * k0;
        const shx = Math.round((Math.random() - 0.5) * 2 * amp), shy = Math.round((Math.random() - 0.5) * 2 * amp + Math.sin(t * 41) * 1.3 * thr * k0);
        const fy = cam.fy, gY = fy + gapf(S.y);                                       // our feet; the ground's own level (drawn nearer than true while we are high)
        const up = Y => fy + (S.y - Y), gr = Y => gY - Y, scrX = X => FW / 2 + (X - cam.x), sx = scrX(S.x);
        const full = S.mode === 'full' && !!deck, dTop = deck ? deck[0] : 1e9, dBot = deck ? deck[1] : 1e9;
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
        // under the cloud: the land far below, coming up the whole way (the far ridges slower than the ground itself)
        const under = S.y < dBot + 140;
        if (under) {
            const sink = gY - GROUND_Y, tops = Wp.far.map((L, i) => Math.round(L.rest + sink * [0.55, 0.75, 0.9][i]));
            ctx.drawImage(Wp.band.canvas, -EDGE, tops[0] - 82);
            Wp.far.forEach((L, i) => { if (tops[i] - L.pad < FH + EDGE) ctx.drawImage(L.pic.canvas, Math.round(-(L.pic.canvas.width - FW) / 2 - cam.x * L.p), tops[i] - L.pad); });
            if (deck && S.y < dBot) {                                                 // the cloud we came through, now a ceiling
                const cy = Math.max(Math.round(up(dBot)) - CLOUD_H, -152);
                if (cy + CLOUD_H > -EDGE) { if (cy > -152) { ctx.fillStyle = Wp.haze[Wp.thin ? 4 : 6]; ctx.fillRect(-EDGE, -EDGE, FW + EDGE * 2, cy + 70 + EDGE); } tile(Wp.cloud.canvas, cam.x * 0.1 + 40, cy); }
            }
            const groundTop = Math.round(gr(G.UP));                                   // the ground itself, and the find's own things
            if (groundTop < FH + EDGE) {
                ctx.drawImage(G.pic.canvas, Math.round(scrX(G.X0)), groundTop);
                if (groundTop + G.H < FH + EDGE) { ctx.fillStyle = G.dark; ctx.fillRect(-EDGE, groundTop + G.H, FW + EDGE * 2, FH); }
            }
            const far = Wp.air ? clamp01((S.y - 160) / 1700) : 0;                     // the air between us and the land: thicker with depth, clearing as we come down
            for (let k = 1, n = Math.round(far * 4); k <= n; k++) { ctx.fillStyle = Wp.air2[k]; ctx.fillRect(-EDGE, tops[0] - 34 + (k - 1) * 16, FW + EDGE * 2, FH); }
            // the find's light, the one the bridge showed; while the place is still below the picture, its glow at the picture's foot
            const lp = G.light, y0 = Math.round(gr(G.at(lp.x) + lp.up)), below = y0 > FH - 8, lx = clamp(Math.round(scrX(lp.x)), 12, FW - 12);
            V.fr.reset();
            try { A.drawLight(V.fr, look.mark, lx, below ? FH - 8 : y0, now, below ? { cloud: 0.55 } : { scale: 3, cloud: 0.45 * clamp01((S.y - 300) / 2400) }); } catch (err) { if (!V.lightErr) { V.lightErr = true; console.error('BurnScene: the find light failed', err); } }
            ctx.globalCompositeOperation = 'source-over';
        }
        // the cloud deck as we go through it
        const hd = full ? smooth(dTop + 90, dTop - 110, S.y) * smooth(dBot - 130, dBot + 70, S.y) : 0;
        if (full && S.y < dTop + 420 && S.y > dBot - 420) {
            const rows = Math.ceil((dTop - dBot) / 130) + 1;
            if (hd > 0.08) { ctx.fillStyle = Wp.haze[Math.round(hd * (Wp.thin ? 3 : 5))]; ctx.fillRect(-EDGE, -EDGE, FW + EDGE * 2, FH + EDGE * 2); }   // the murk first: the billows show on it as they rush up
            for (let k = 0; k < rows; k++) { const y = Math.round(up(dTop - k * 130)) - 40; if (y < FH + EDGE && y + CLOUD_H > -EDGE) tile(Wp.cloud.canvas, cam.x * (1 + 0.12 * (k % 3)) + k * 173, y); }
        }

        // the air going past, the rain, the flame (many pixels: one buffer)
        const layer = V.layer;
        layer.clear();
        const fallV = Math.max(0, -S.vy), streakOn = S.landed ? 0 : clamp01(rho * 2.2 + hd) * clamp01((fallV - 50) / 140) * (Wp.air ? 1 : 0.35);
        V.streaks.forEach(s => {
            s.y -= fallV * s.k * 0.9 * dt; s.x -= S.vx * 0.5 * dt;
            if (s.y < -40) { s.y = FH + Math.random() * 30; s.x = Math.random() * FW; }
            if (s.x < 0) s.x += FW; else if (s.x >= FW) s.x -= FW;
            if (streakOn <= 0.05 || s.b > streakOn + 0.15) return;
            const len = clamp(fallV * 0.07 * s.k, 2, 38);
            for (let i = 0; i < len; i++) layer.tone(s.x + EDGE, s.y + i + EDGE, RP.STAR, (0.28 + 0.34 * s.b) * (1 - i / len) * (0.6 + 0.6 * streakOn));
        });
        if (W.rain && S.y < dBot) for (let i = 0; i < 46; i++) {
            const rx = mod(i * 97.3 - t * 150 - S.vx * 0.2, FW + 40) - 20, ry = mod(i * 53.7 + t * (520 - S.vy * 0.5), FH + 40) - 20;
            for (let k = 0; k < 7; k++) layer.tone(rx - k * 0.45 + EDGE, ry + k + EDGE, RP.ICE, 0.52 - k * 0.045);
        }
        // the ship's place on the screen; the catch throws her up a little
        const lean = Math.round(S.th / 0.02) * 0.02, c = Math.cos(S.th), sn = Math.sin(S.th), shaking = thr > 0.03 || sputter;
        const jx = S.landed ? 0 : Math.round((Math.random() - 0.5) * (shaking ? 2 : q > 0.7 ? 1.4 : 0) * k0);
        const jy = S.landed ? 0 : Math.round((Math.random() - 0.5) * (thr > 0.03 ? 2 : 0) * k0 - kick * 4 * k0);
        const bx = sx + LEG_L * sn + jx, by = fy - LEG_L * c + jy;                    // the bell: where she turns, where the flame leaves
        const dxA = -sn, dyA = c;                                                    // down her axis, on the screen
        V.shipX = sx;
        let groundLit = 0, gHit = null;
        // the flame: a sputter while it catches, long and wide at the catch, then steady; it dies away when we let go
        const flame = thr > 0.03 ? (122 + flick * 16) * (0.2 + 0.8 * thr) * (1 + 0.4 * kick) : sputter && flick > 0.35 ? 7 + flick * 13 : 0;
        if (flame > 0) {
            const wide = thr > 0.03 ? (0.5 + 0.5 * thr) * (1 + 0.3 * kick) : 0.4, hot = thr > 0.03 ? 0.62 + 0.38 * thr : 0.7;
            let reach = flame;                                                       // the flame stops at the ground
            if (under) for (let s2 = 6; s2 < flame + 40; s2 += 3) { const px = bx + dxA * s2, py = by + dyA * s2, wx = S.x + (px - sx); if (py >= gr(G.at(wx))) { reach = Math.min(flame, s2); gHit = { x: wx, y: G.at(wx), near: clamp01(1 - s2 / (flame + 40)) * thr }; break; } }
            for (let s2 = 0; s2 < reach; s2++) {
                const k = s2 / flame, w = Math.max(0.6, (Math.pow(1 - k, 0.8) * 5.4 + 1.3) * wide + (vnoise(s2 / 7 - t * 26, t * 11, 3) - 0.5) * 3.4 * k);
                for (let a = -Math.ceil(w); a <= Math.ceil(w); a++) { const e = Math.abs(a) / w; if (e <= 1) layer.tone(bx + dxA * s2 + dyA * a + EDGE, by + dyA * s2 - dxA * a + EDGE, RP.PLUME, (1.1 - k * 0.82) * (1 - e * e * 0.7) * hot); }
            }
            if (gHit && thr > 0.2) {
                groundLit = gHit.near;
                const gx = scrX(gHit.x), gy = gr(gHit.y), spread = 14 + 34 * gHit.near;
                for (let a = -spread; a <= spread; a++) for (let r = 0; r < 3; r++) layer.tone(gx + a + EDGE, gy - r - Math.abs(a) * 0.05 + EDGE, RP.PLUME, (1 - Math.abs(a) / spread) * (0.95 - r * 0.25) * (0.5 + 0.5 * flick));
                for (let i = 0, rate = 2 + Math.round(5 * gHit.near); i < rate; i++) puff(V, gHit.x + (Math.random() - 0.5) * 16, gHit.y + 1, (Math.random() < 0.5 ? -1 : 1) * (70 + Math.random() * 230) * (0.5 + gHit.near), 8 + Math.random() * 46);
            }
        }
        // the last of the flame, thrown clear when the engine stops
        if (V.wasLit && !S.lit && !S.landed) for (let i = 0; i < 14; i++) V.embers.push({ x: bx + (Math.random() - 0.5) * 9, y: by + 4 + Math.random() * 22, vx: dxA * 150 + (Math.random() - 0.5) * 70, vy: dyA * (120 + Math.random() * 190), life: 0, max: 0.2 + Math.random() * 0.36 });
        V.wasLit = S.lit;
        for (let i = V.embers.length - 1; i >= 0; i--) {
            const e = V.embers[i]; e.life += dt;
            if (e.life > e.max) { V.embers.splice(i, 1); continue; }
            e.x += e.vx * dt; e.y += e.vy * dt;
            const k = 1 - e.life / e.max;
            layer.tone(e.x + EDGE, e.y + EDGE, RP.PLUME, 0.95 * k); layer.tone(e.x + EDGE, e.y - 1 + EDGE, RP.PLUME, 0.6 * k);
        }
        layer.draw(ctx, -EDGE, -EDGE);
        // the light she makes: the air's heat on the way down, the flame's on the way in, one hard bloom at the catch
        ctx.globalCompositeOperation = 'lighten';
        const heat = thr < 0.05 && !S.landed && Wp.air ? clamp01((q - 0.55) / 0.5) : 0;
        if (heat > 0.05) light(RP.SUN, bx + dxA * 6, by + dyA * 6, 24, heat * 0.62);
        if (thr > 0.03) { light(RP.PLUME, bx + dxA * 12, by + dyA * 12, 42, clamp01((0.5 + 0.1 * flick) * thr)); if (gHit) light(RP.PLUME, scrX(gHit.x), gr(gHit.y) - 2, 44, (0.32 + 0.38 * groundLit) * thr); }
        if (kick > 0.2) light(RP.PLUME, bx + dxA * 10, by + dyA * 10, 62, clamp01(kick * 0.8));
        else if (sputter && flame > 0) light(RP.PLUME, bx + dxA * 6, by + dyA * 6, 16, 0.4);
        ctx.globalCompositeOperation = 'source-over';
        // our shuttle; the team stepping out in their suits, toward the light
        const broken = !!(S.landed && S.landed.grade === 'crash');
        const spr = A.shuttleSprite(D, 1, { lean, fold: S.fold < 0.25 ? 0 : S.fold < 0.75 ? 0.5 : 1, broken });
        ctx.drawImage(spr.canvas, Math.round(bx) - spr.ox, Math.round(by - SH.BELL * D) - spr.oy);
        if (!broken) { ctx.fillStyle = RP.AMBER.hex[3]; ctx.fillRect(Math.round(bx + spr.win[0]) - 1, Math.round(by - SH.BELL * D + spr.win[1]), 2, 2); }
        const MC = window.MiniCrew;
        if (MC && Array.isArray(o.team)) o.team.forEach(m => { try { MC.small(ctx, m.id, scrX(m.x), gr(G.at(m.x)) + 1, { h: 16, pose: m.walking ? 'walk' : 'stand', t: m.t, facing: m.dir, suit: true, light: 1 }); } catch (err) { if (!V.crewErr) { V.crewErr = true; console.error('BurnScene: the team could not be drawn', err); } } });
        // the dust she raises, the cloud that whips past in front
        for (let i = V.dust.length - 1; i >= 0; i--) {
            const d = V.dust[i]; d.life += dt;
            if (d.life > d.max) { V.dust.splice(i, 1); continue; }
            d.vx *= Math.exp(-1.6 * dt); d.vy -= 26 * dt; d.x += d.vx * dt; d.y += d.vy * dt;
            const k = 1 - d.life / d.max, px = Math.round(scrX(d.x)), py = Math.round(gr(Math.max(d.y, G.at(d.x))));
            if (threshold(px, py) > k * 1.2) continue;
            const r = d.spark ? RP.AMBER : look.ground;
            ctx.fillStyle = r.hex[clamp(Math.round((d.spark ? 0.55 + 0.4 * k : 0.4 + 0.3 * d.b) * (r.hex.length - 1)), 1, r.hex.length - 1)];
            ctx.fillRect(px, py, d.b > 0.7 ? 2 : 1, 1);
        }
        if (hd > 0.3) { const y = Math.round(mod(S.y * 1.6, CLOUD_H)) - CLOUD_H; for (let k = 0; k < 3; k++) tile(Wp.wisp.canvas, cam.x * 1.5 + k * 211, y + k * CLOUD_H); }
        ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    /** The world's own pictures alone, queued (the bridge's warm-up: the place is not known yet). → their tag */
    const warm = (world, W, look) => worldPics(world, W, look).tag;
    window.BurnScene = Object.freeze({ FW, FH, lookOf, prepare, ready, warm, keep, view, camera, burst, draw });
})();
