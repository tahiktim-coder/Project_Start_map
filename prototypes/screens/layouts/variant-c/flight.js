/* ═══ Silent Exodus · layout variant C ("Deck strip") · the journey above the deck ════════════════════════════════════
   The travel view of game-screen-v3, drawn with its own recipes (../game-screen-v3/paint.js: spaceStrip, paintSpace,
   lightGlow, sphere, surfaceFor, twinkle, framer, pixelLayer) and its own world (../game-screen-v3/data.js: sector 1,
   Titan-61 IV). The stream of worlds (geom), the specks (flowField), the far glint and flat disc are v3's, copied here
   and re-measured: this canvas is one sprite pixel per art pixel (the living ship's density), which is 1.5 of v3's
   stage pixels, so every v3 length is multiplied by 1.5 (DENS).
     V3Flight.create(W, H, layout) → { draw(ctx, t, state), geom(state), hit(x, y, state), noteAnchor(state), world }
*/
(function () {
    'use strict';
    const P = window.V3Paint, DATA = window.V3Data;
    const { INK, TICK, RP, threshold, clamp01, smooth, lerp, hash, level } = P;
    const DENS = 1.5;
    const CRUISE = 52 * DENS;                                  // art px of flight a second
    const SEC = DATA.SECTORS[1];

    function create(W, H, LY) {
        const LIGHT = LY.light;                                 // where everything comes out of; it never moves
        const src = SEC.places.find(p => p.id === 'titan');
        // the one world of this slice: Titan-61 IV (desert, the red beacon of EXODUS-4), at its closest at LY.pass
        const world = Object.assign({}, src, { pass: LY.pass, full: Math.round(src.r * DENS), at: LY.passAt * CRUISE });
        world.k = Math.hypot(LIGHT[0] - world.pass[0], LIGHT[1] - world.pass[1]) / CRUISE;
        const dirx = world.pass[0] - LIGHT[0], diry = world.pass[1] - LIGHT[1], dl = Math.hypot(dirx, diry);
        // once past, it glides back along our wake and rests near the left edge, grey and shrinking, then slips away (v3)
        const restR = world.full * 0.45, slope = diry / -dirx, rx = 30 * DENS + restR;
        world.rest = [rx, Math.max(restR + 10, Math.min(LY.floor - restR - 24, world.pass[1] + slope * (world.pass[0] - rx) * 0.35))];
        world.L = P.lightVector(world.pass[0], world.pass[1], LIGHT[0], LIGHT[1], 0.5 * dl);

        // ── space: v3's strip, painted for this canvas ──
        const STRIP_EXTRA = 200;
        const strip = P.spaceStrip(W + STRIP_EXTRA, H, SEC.seed, SEC.dust, SEC.haze, SEC.stars * 0.8);
        const halo = Math.max(SEC.light.halo * DENS, 18);
        const lit = new Float32Array(W * H);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) lit[y * W + x] = Math.exp(-Math.hypot(x - LIGHT[0], (y - LIGHT[1]) * 1.15) / (halo * 0.85 + 6));
        const bp = P.painter(W, H, true), back = document.createElement('canvas'); back.width = W; back.height = H;
        const bg = back.getContext('2d');
        let backOff = null, bright = [];
        function ensureBack(off) {
            off = Math.max(0, Math.min(STRIP_EXTRA, off));
            if (backOff === off) return;
            const away = SEC.light.halo * DENS * 0.9 + SEC.light.core * DENS + 8;
            bright = P.paintSpace(bp, strip, off, lit, (x, y) => Math.hypot(x - LIGHT[0], y - LIGHT[1]) < away);
            bg.putImageData(new ImageData(bp.data, W, H), 0, 0);
            backOff = off;
        }
        const LT = { core: SEC.light.core * DENS, halo: SEC.light.halo * DENS, strength: SEC.light.strength, spikes: SEC.light.spikes * DENS };
        const reach = Math.ceil(LT.halo * 3.2 + LT.core + 10);
        const glows = Array.from({ length: 8 }, (_, k) => { const p = P.painter(reach * 2, reach * 2, false); P.lightGlow(p, reach, reach, LT, 0.9 + 0.1 * Math.sin(k / 8 * Math.PI * 2)); return p.canvas(); });
        // far scenery: v3's small grey rock, high on the left
        const scenery = (SEC.scenery || []).map(sc => {
            const r = Math.round(sc.r * DENS), half = r + 2, p = P.painter(half * 2, half * 2, false), x = sc.x * DENS + 40, y = sc.y * DENS;
            const L = P.lightVector(x, y, LIGHT[0], LIGHT[1], 60);
            const haze = P.ramp(INK, RP.HAZE.hex[2], RP.HAZE.hex[4], RP.STONE.hex[2], RP.STONE.hex[3]);
            P.sphere(p, { cx: half, cy: half, r, ramp: haze, L, dim: 0.85, surface: P.surfaceFor(sc.type, sc.seed, L) });
            return { canvas: p.canvas(), half, x, y, speed: sc.speed };
        });

        // ── the world: v3's geom, re-measured ──
        const LINGER = 900 * DENS, GREY_E = 0.42;
        function geom(D, orbit) {
            if (orbit) return orbit;
            const d = (world.at - D) / CRUISE;
            if (d >= 0) {
                const f = world.k / (world.k + d), fp = Math.sqrt(world.k / 2 / (world.k / 2 + d));
                return { x: LIGHT[0] + (world.pass[0] - LIGHT[0]) * fp, y: LIGHT[1] + (world.pass[1] - LIGHT[1]) * fp, r: world.full * Math.pow(f, 1.4), d, s: 0 };
            }
            const s = D - world.at, tau = world.pass[0] - world.rest[0], e = 1 - Math.exp(-s / tau), out = Math.max(0, s - LINGER);
            // it turns grey once it has slid well past us (v3: past our tail); greyS counts the flight since then
            const s0 = -tau * Math.log(1 - GREY_E), greyS = s - s0;
            return { x: world.pass[0] - tau * e - out * 1.4, y: world.pass[1] + (world.rest[1] - world.pass[1]) * e, r: world.full * (1 - 0.55 * e), d, s, grey: greyS > 0, greyS };
        }
        const sprites = new Map();
        function worldSprite(rInt, grey, L) {
            const key = rInt + ':' + (grey ? 1 : 0) + ':' + (L === world.L ? 'lane' : 'orbit');
            if (sprites.has(key)) return sprites.get(key);
            const r = rInt, w = Math.max(2, Math.round(r / 22)), half = r + w + 3, p = P.painter(half * 2, half * 2, false), rims = [];
            const frac = Math.min(1, r / world.full), dim = grey ? 0.85 : 0.62 + 0.38 * smooth(0.12, 0.85, frac);
            P.sphere(p, { cx: half, cy: half, r, ramp: grey ? RP.PASSED : RP.DESERT, L, dim, surface: P.surfaceFor('desert', world.seed, L), rim: grey ? 0 : SEC.rim, ambient: 0.012, gain: 0.84, rims,
                atmo: grey ? null : { ramp: RP.DUST, w } });
            if (!grey && r >= 60) { const [bx, by] = beaconOffset(r), k = r / 118, X = half + bx, Y = half + by; p.line(X + 3 * k, Y + k, X + 16 * k, Y - 2 * k, (x, y) => p.solid(x, y, RP.STONE, 0.02)); }
            const out = { canvas: p.canvas(), half, rims: rims.map(([x, y, rr, lv]) => [x - half, y - half, rr, lv]) };
            sprites.set(key, out);
            if (sprites.size > 400) sprites.clear();
            return out;
        }
        const beaconOffset = r => [Math.round(-0.6 * r), Math.round(0.1 * r)];

        // ── the specks streaming out of the light (v3's flowField), drawn behind the ship ──
        const FLOW_LN = Math.log(900 * DENS / (22 * DENS));
        const FLOW = {
            motes: { n: 200, seed: 41, rate: 0.0005 / DENS, tail: 0.1, ramp: 'DUST', v: 0.85, lit: true },
            streaks: { n: 420, seed: 43, rate: 0.0015 / DENS, tail: 0.17, ramp: 'STAR', v: 0.9 },
        };
        const layer = P.pixelLayer(W, H);
        function flowField(Lr, o, flow, speed) {
            const [vx, vy] = LIGHT, base = flow * o.rate, r0 = RP[o.ramp], tailPh = Math.min(0.12, speed * o.rate * o.tail), d0 = 22 * DENS;
            for (let i = 0; i < o.n; i++) {
                const ph = hash(i, 1, o.seed) + hash(i, 7, o.seed) / 256 + base, cyc = Math.floor(ph), u = ph - cyc;
                const th = (hash(i + cyc * 13, 2, o.seed) + hash(i, cyc & 255, o.seed + 1) / 256) * Math.PI * 2, dx = Math.cos(th), dy = Math.sin(th);
                const d = d0 * Math.exp(u * FLOW_LN), x = vx + dx * d, y = vy + dy * d;
                if (x < -60 || y < -60 || x > W + 60 || y > H + 60) continue;
                let v = o.v * smooth(d0, 90 * DENS, d) * (0.55 + 0.45 * hash(i, 3, o.seed));
                if (o.lit) v *= 0.3 + 1.1 * Math.exp(-Math.hypot(x - vx, y - vy) / (170 * DENS));
                if (v < 0.08) continue;
                const len = Math.max(0, d - d0 * Math.exp(Math.max(0, u - tailPh) * FLOW_LN));
                for (let k = 0; k <= len; k++) Lr.tone(x - dx * k, y - dy * k, r0, v * (1 - k / (len + 1)));
            }
        }

        // ── one frame of the journey: everything behind the ship ──
        function draw(c, t, st) {
            const f = P.framer(c, W, H);
            ensureBack(Math.round(st.D * 0.02));
            c.imageSmoothingEnabled = false;
            c.drawImage(back, 0, 0);
            const T = window.ShipArt.stars(1), n = T.size, ox = ((Math.round(-st.D * 0.1) % n) + n) % n;     // mid stars: the living ship's own tile
            for (let y = -n + 37; y < H; y += n) for (let x = ox - n; x < W; x += n) c.drawImage(T.canvas, x, y);
            scenery.forEach(sc => c.drawImage(sc.canvas, Math.round(sc.x - sc.speed * DENS * st.D / DENS - sc.half), Math.round(sc.y - sc.half)));
            c.drawImage(glows[Math.floor(t / 500) % 8], Math.round(LIGHT[0]) - reach, Math.round(LIGHT[1]) - reach);
            const g = geom(st.D, st.orbit);
            P.twinkle(f, bright.filter(s => Math.hypot(s.x - g.x, s.y - g.y) > g.r + 2), t);
            layer.clear();
            flowField(layer, FLOW.motes, st.D, st.speed);
            flowField(layer, FLOW.streaks, st.D, st.speed);
            layer.draw(c);
            drawWorld(c, f, t, st, g);
            return g;
        }
        function drawWorld(c, f, t, st, g) {
            const x = Math.round(g.x), y = Math.round(g.y);
            if (x < -g.r - 40 || x > W + g.r + 40 || y < -g.r - 40 || y > H + g.r + 40) return;
            if (g.r < 1.5) { glint(f, x, y, t); return; }
            if (g.r < 8) { flatDisc(f, x, y, g.r); return; }
            const L = st.orbit ? st.orbit.L : world.L, grey = !st.orbit && !!g.grey;
            const sp = worldSprite(Math.round(g.r), grey, L);
            if (grey && g.greyS < 900 * DENS * 0.08) {                               // turning grey: a dither crossfade in steps
                const k = Math.floor(g.greyS / (900 * DENS * 0.08) * 8) / 8, colour = worldSprite(Math.round(g.r), false, L);
                c.drawImage(colour.canvas, x - colour.half, y - colour.half);
                const o = fadeCanvas(); o.g.clearRect(0, 0, W, H); o.g.drawImage(sp.canvas, x - sp.half, y - sp.half);
                o.g.globalCompositeOperation = 'destination-out'; o.g.fillStyle = st.pattern((1 - k) * 64); o.g.fillRect(0, 0, W, H); o.g.globalCompositeOperation = 'source-over';
                c.drawImage(o.c, 0, 0);
            } else c.drawImage(sp.canvas, x - sp.half, y - sp.half);
            if (st.hot && !grey) sp.rims.forEach(([rx, ry, r, lv]) => f.px(x + rx, y + ry, r.hex[Math.min(r.hex.length - 1, lv + 1)]));
            if (grey) return;
            const [bx, by] = beaconOffset(g.r), X = x + bx, Y = y + by, ph = Math.floor((t % 1500) / TICK);           // v3's beacon blink
            if (g.r < 40) { if (ph < 3) { f.glow(X, Y, 4, RP.RED, 0.9); f.px(X, Y, RP.RED.hex[4]); } else f.px(X, Y, RP.RED.hex[2]); }
            else if (ph < 2) { f.glow(X, Y, 9, RP.RED, 0.95); f.px(X - 1, Y - 1, RP.RED.hex[4], 3, 3); f.px(X - 3, Y, RP.RED.hex[3], 7, 1); f.px(X, Y - 3, RP.RED.hex[3], 1, 7); }
            else if (ph < 4) { f.glow(X, Y, 6, RP.RED, 0.7); f.px(X, Y, RP.RED.hex[4], 2, 2); }
            else f.px(X, Y, RP.RED.hex[ph < 7 ? 3 : 2], 2, 2);
        }
        let fade = null;
        function fadeCanvas() { if (!fade) { const c = document.createElement('canvas'); c.width = W; c.height = H; fade = { c, g: c.getContext('2d') }; } return fade; }
        function glint(f, x, y, t) {
            if (Math.hypot(x - LIGHT[0], y - LIGHT[1]) < LT.core + 10) return;
            const r0 = RP.AMBER, ph = Math.floor(t / TICK) * TICK, pulse = 0.5 + 0.5 * Math.sin(ph / 1100 + (world.at % 97)), core = 0.7 + 0.28 * pulse, arm = 0.3 + 0.32 * pulse;
            [[-1, -1], [1, -1], [-1, 1], [1, 1], [-2, 0], [2, 0], [0, -2], [0, 2]].forEach(([dx, dy]) => f.px(x + dx, y + dy, INK));
            f.px(x, y, r0.hex[level(r0, core, x, y) || 1]);
            [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dx, dy]) => f.tone(x + dx, y + dy, r0, arm));
            if (pulse > 0.75) [[-2, 0], [2, 0], [0, -2], [0, 2]].forEach(([dx, dy]) => f.tone(x + dx, y + dy, r0, 0.3));
        }
        function flatDisc(f, x, y, r) {
            const L = world.L;
            for (let yy = -Math.ceil(r); yy <= Math.ceil(r); yy++) for (let xx = -Math.ceil(r); xx <= Math.ceil(r); xx++) {
                const q = (xx * xx + yy * yy) / (r * r); if (q >= 1) continue;
                const lam = Math.max(0, (xx * L[0] + yy * L[1]) / r + 0.25 * L[2]), v = 0.12 + 0.42 * lam * (0.5 + 0.5 * r / 8);
                if (v < 0.16 && threshold(x + xx, y + yy) > 0.5) f.tone(x + xx, y + yy, RP.HAZE, 0.5); else f.tone(x + xx, y + yy, RP.DESERT, Math.min(0.6, v));
            }
        }
        /** The world in orbit: where it settles, how big, and its light. */
        function orbitFrame(pos, r) { const d = Math.hypot(LIGHT[0] - pos[0], LIGHT[1] - pos[1]); return { x: pos[0], y: pos[1], r, d: 0, s: 0, L: P.lightVector(pos[0], pos[1], LIGHT[0], LIGHT[1], 0.5 * d) }; }

        return { draw, geom, world, orbitFrame, CRUISE, LIGHT, worldSprite };
    }
    window.V3Flight = { create, CRUISE, DENS };
})();
