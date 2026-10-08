/* Silent Exodus · layouts · variant A · the journey: space, the light, the stream of dust and the worlds.
   Recipes from game-screen-v3 (paint.js is loaded as it is; sectorArt, glowFrames, the flow field, worldSprite, the
   glint and the flat disc are copied from game-screen-v3.html and re-measured). Changes:
     · one picture: space is painted over the whole screen, so it runs on behind the tower and shows through its windows;
     · sizes are in this layout's art pixels (two device pixels each on a 1080 screen; v3 used three), so a world is drawn
       half as big again in art pixels to keep v3's size on screen;
     · a world that has passed does not wait in our wake: it slides on to the left and goes behind our hull, where the
       windows catch it (each world's last height is chosen to cross a window the camera is showing at that time);
     · our own ship is not drawn in the lane: the tower on the left is our ship.
     window.TravelA = { make(G) } → { drawBack(c, st), drawWorlds(c, st), drawFront(c, st), drawNear(c, st), geom(pl, st),
                                       sprite(pl, r, grey), PLACES, LAP, CRUISE }
*/
(function () {
    'use strict';
    const P = window.V3Paint, DATA = window.V3Data;
    const { INK, TICK, RP, threshold, clamp01, smooth, hash, level } = P;
    const LAP = 200;                                     // seconds of flight before the heading repeats (the crew's routines loop with it)
    const CRUISE = 78;                                   // art px a second (v3's 52 stage px at 3 device px = 78 at 2)
    const K = 10;                                        // how many seconds out a world starts to swell
    const SEC = DATA.SECTORS[1];
    const byId = id => SEC.places.find(p => p.id === id);
    // the places of sector 1 on this heading: at = seconds into the lap when it is closest; pass = [u, v], where it is at
    // its closest as a fraction of the travel side (u across from our hull to the right edge, v down the screen);
    // hullY: the window it is seen through as it goes behind our hull ('win0pair', 'win0', 'port2'), or none
    const PLACES = [
        Object.assign({}, byId('zeta'), { at: 16, pass: [0.56, 0.15], s: 1.9, hullY: 'win0pair' }),
        Object.assign({}, byId('titan'), { at: 44, pass: [0.48, 0.46], r: 84, hullY: 'win0' }),
        Object.assign({}, byId('chronos'), { at: 105, pass: [0.55, 0.37], r: 84, hullY: 'port2' }),
        Object.assign({}, byId('zephyr'), { at: 170, pass: [0.42, 0.76], r: 60 }),
    ];

    function make(G) {
        // ── space for the whole screen, and the light ──
        const STRIP_EXTRA = 220, sec = SEC;
        const lightOpts = { core: sec.light.core * 1.5, halo: sec.light.halo * 1.5, strength: sec.light.strength, spikes: sec.light.spikes * 1.5 };
        const [lx, ly] = G.light;
        const strip = P.spaceStrip(G.W + STRIP_EXTRA, G.H, sec.seed, sec.dust, sec.haze, sec.stars);
        const lit = new Float32Array(G.W * G.H), halo = Math.max(lightOpts.halo, 18);
        for (let y = 0; y < G.H; y++) for (let x = 0; x < G.W; x++) lit[y * G.W + x] = Math.exp(-Math.hypot(x - lx, (y - ly) * 1.15) / (halo * 0.85 + 6));
        const bp = P.painter(G.W, G.H, true), back = document.createElement('canvas'); back.width = G.W; back.height = G.H;
        const bg = back.getContext('2d');
        let backOff = null, bright = [];
        function ensureBackdrop(off) {
            off = Math.max(0, Math.min(STRIP_EXTRA, off));
            if (backOff === off) return;
            const away = lightOpts.halo * 0.9 + lightOpts.core + 8;
            bright = P.paintSpace(bp, strip, off, lit, (x, y) => Math.hypot(x - lx, y - ly) < away);
            bg.putImageData(new ImageData(bp.data, G.W, G.H), 0, 0);
            backOff = off;
        }
        const reach = Math.ceil(lightOpts.halo * 3.2 + lightOpts.core + 10), size = reach * 2;
        const glow = Array.from({ length: 8 }, (_, k) => { const p = P.painter(size, size, false); P.lightGlow(p, reach, reach, lightOpts, 0.9 + 0.1 * Math.sin(k / 8 * Math.PI * 2)); return p.canvas(); });
        // far scenery: sector 1's small grey rock, toward the haze
        const rock = (() => {
            const sc = sec.scenery[0], r = Math.round(sc.r * 1.4), half = r + 2, p = P.painter(half * 2, half * 2, false), x = G.hull + (G.W - G.hull) * 0.2, y = G.H * 0.1;
            const Lv = P.lightVector(x, y, lx, ly, 60), hz = P.ramp(INK, RP.HAZE.hex[2], RP.HAZE.hex[4], RP.STONE.hex[2], RP.STONE.hex[3]);
            P.sphere(p, { cx: half, cy: half, r, ramp: hz, L: Lv, dim: 0.85, surface: P.surfaceFor(sc.type, sc.seed, Lv) });
            return { canvas: p.canvas(), half, x, y };
        })();

        // ── the places, measured for this screen ──
        PLACES.forEach(pl => {
            pl.P = [G.hull + pl.pass[0] * (G.W - G.hull), pl.pass[1] * G.H];
            pl.full = pl.kind === 'station' ? 24 * pl.s : pl.r;
            const d = Math.hypot(lx - pl.P[0], ly - pl.P[1]);
            pl.L = P.lightVector(pl.P[0], pl.P[1], lx, ly, 0.5 * d);
            pl.v0 = [(pl.P[0] - lx) / K, (pl.P[1] - ly) / K];                                       // its speed (px/s) as it passes its closest point
            pl.Yt = pl.hullY ? G.windowY(pl.hullY) : pl.P[1] + pl.v0[1] * 9;
        });

        /** Where a place is: d seconds ahead (negative once passed). Out of the light on v3's curve, then on to the left,
            past our hull, easing to the height of the window it will be seen through. */
        function geom(pl, st) {
            const lapD = LAP * CRUISE, Dl = st.D - Math.floor(st.D / lapD) * lapD, lap = Math.floor(st.D / lapD);
            let d = (pl.at * CRUISE - Dl) / CRUISE, onLap = lap;
            if (d < -14) { d += LAP; onLap = lap + 1; }
            const arr = st.arr && st.arr.id === pl.id && st.arr.lap === onLap ? st.arr : null;
            if (arr) return arrivalGeom(pl, st, arr);
            if (d >= 0) {
                const f = K / (K + d), fp = Math.sqrt(K / 2 / (K / 2 + d));
                return { x: lx + (pl.P[0] - lx) * fp, y: ly + (pl.P[1] - ly) * fp, r: pl.full * Math.pow(f, 1.4), d, lap: onLap };
            }
            const s = -d, x = pl.P[0] + pl.v0[0] * s * (1 + s / 12), e = smooth(0, 1, (pl.P[0] - x) / Math.max(40, pl.P[0] - G.hull));
            const y = (pl.P[1] + pl.v0[1] * s) * (1 - e) + pl.Yt * e;
            return { x, y, r: pl.full * (1 + 0.12 * Math.min(1, s / 5)), d, lap: onLap };
        }
        /** Stopping: the world comes in to the middle of the travel side, in stepped sizes; leaving, it slides off behind us. */
        function arrivalGeom(pl, st, arr) {
            const O = orbitPose();
            if (arr.t1 == null || st.t < arr.t1) {
                const k = clamp01((st.t - arr.t0 - 500) / 3600), e = k < 0.5 ? 2 * k * k : 1 - 2 * (1 - k) * (1 - k);   // it glides; its size steps, ten sizes on the way in
                return { x: arr.g0.x + (O.x - arr.g0.x) * e, y: arr.g0.y + (O.y - arr.g0.y) * e, r: radiusStep(arr, stepEase(k)), d: 0, lap: arr.lap, orbit: k };
            }
            const s = (st.t - arr.t1) / 1000, x = O.x - 55 * s * (1 + s / 4);
            return { x, y: O.y + (G.windowY('win0') - O.y) * smooth(0, 1, (O.x - x) / (O.x - G.hull + 1)), r: O.r, d: -s, lap: arr.lap, orbit: 1, leaving: true };
        }
        const stepEase = e => { const q = Math.floor(e * 10) / 10; return q < 0.5 ? 2 * q * q : 1 - 2 * (1 - q) * (1 - q); };
        const orbitPose = () => ({ x: Math.round(G.hull + 0.56 * (G.W - G.hull)), y: Math.round(G.H * 0.5), r: Math.round(Math.min(0.34 * G.H, 0.36 * (G.W - G.hull))) });
        const radiusStep = (arr, e) => Math.round(arr.g0.r * Math.pow(orbitPose().r / Math.max(1, arr.g0.r), e));

        // ── sprites, painted once per whole-pixel size ──
        const cache = new Map();
        const beaconOffset = (pl, r) => [Math.round(-0.6 * r), Math.round((pl.type === 'ice' ? -0.45 : 0.1) * r)];
        function sprite(pl, rInt, grey) {
            const key = `${pl.id}:${rInt}:${grey ? 1 : 0}`;
            if (cache.has(key)) return cache.get(key);
            let out;
            if (pl.kind === 'station') {
                const s = pl.s * rInt / pl.full, half = Math.ceil(27 * s + 3), p = P.painter(half * 2, half * 2, false);
                const win = P.drawStation(p, half, half, s, pl.seed, 0.75 + 0.25 * clamp01(rInt / pl.full));
                out = { canvas: p.canvas(), half, win: [win[0] - half, win[1] - half] };
            } else {
                const r = rInt, w = Math.max(2, Math.round(r / 22)), half = r + w + 3, p = P.painter(half * 2, half * 2, false);
                const frac = Math.min(1, r / pl.full), dim = 0.62 + 0.38 * smooth(0.12, 0.85, frac);
                P.sphere(p, { cx: half, cy: half, r, ramp: P.PLANET_RAMP[pl.type] || RP.STONE, L: pl.L, dim, surface: P.surfaceFor(pl.type, pl.seed, pl.L), rim: SEC.rim, ambient: 0.012, gain: 0.84,
                    atmo: { ramp: pl.type === 'gas' || pl.type === 'desert' ? RP.DUST : RP.ICE, w } });
                if (pl.beacon && r >= 60) { const [bx, by] = beaconOffset(pl, r), k = r / 118, X = half + bx, Y = half + by; p.line(X + 3 * k, Y + k, X + 16 * k, Y - 2 * k, (x, y) => p.solid(x, y, RP.STONE, 0.02)); }
                out = { canvas: p.canvas(), half };
            }
            cache.set(key, out);
            if (cache.size > 700) cache.clear();
            return out;
        }

        // ── the stream: specks on rays out of the light (v3's flow field, distances re-measured) ──
        const FMIN = 33, FLN = Math.log(1350 / 33);
        const FLOW = {
            motes: { n: 150, seed: 41, rate: 0.00033, tail: 0.1, ramp: 'DUST', v: 0.85, lit: true },
            streaks: { n: 340, seed: 43, rate: 0.001, tail: 0.17, ramp: 'STAR', v: 0.9 },
            near: { n: 40, seed: 47, rate: 0.0018, tail: 0.13, ramp: 'STAR', v: 1.05, wide: 0.5 },
        };
        const layers = { back: P.pixelLayer(G.W, G.H), front: P.pixelLayer(G.W, G.H), near: P.pixelLayer(G.W, G.H) };
        function flow(Lr, o, st, clipX) {
            const base = st.D * o.rate, ramp0 = RP[o.ramp], tailPh = Math.min(0.12, st.speed * o.rate * o.tail);
            for (let i = 0; i < o.n; i++) {
                const ph = hash(i, 1, o.seed) + hash(i, 7, o.seed) / 256 + base, cyc = Math.floor(ph), u = ph - cyc;
                const th = (hash(i + cyc * 13, 2, o.seed) + hash(i, cyc & 255, o.seed + 1) / 256) * Math.PI * 2, dx = Math.cos(th), dy = Math.sin(th);
                const d = FMIN * Math.exp(u * FLN), x = lx + dx * d, y = ly + dy * d;
                if (x < -60 || y < -60 || x > G.W + 60 || y > G.H + 60) continue;
                let v = o.v * smooth(FMIN, 130, d) * (0.55 + 0.45 * hash(i, 3, o.seed));
                if (o.lit) v *= 0.3 + 1.1 * Math.exp(-Math.hypot(x - lx, y - ly) / 250);
                if (v < 0.08) continue;
                const len = Math.max(0, d - FMIN * Math.exp(Math.max(0, u - tailPh) * FLN)), thick = o.wide && hash(i, 5, o.seed) < o.wide;
                for (let k = 0; k <= len; k++) {
                    const a = v * (1 - k / (len + 1)), px = x - dx * k, py = y - dy * k;
                    if (clipX != null && px < clipX) continue;
                    Lr.tone(px, py, ramp0, a);
                    if (thick) Lr.tone(px - dy, py + dx, ramp0, a * 0.8);
                }
            }
        }

        // ── drawing ──
        function drawBack(c, st) {
            ensureBackdrop(Math.round(st.D * 0.02));
            c.drawImage(back, 0, 0);
            const T = window.ShipArt.stars(1), n = T.size, ox = ((Math.round(-st.D * 0.1) % n) + n) % n;   // the mid stars: the living ship's own star tile
            for (let y = -n; y < G.H; y += n) for (let x = ox - n; x < G.W; x += n) c.drawImage(T.canvas, x, y + 37);
            c.drawImage(rock.canvas, Math.round(rock.x - st.D * 0.004) - rock.half, Math.round(rock.y) - rock.half);
            c.drawImage(glow[Math.floor(st.t / 500) % glow.length], Math.round(lx) - reach, Math.round(ly) - reach);
            const f = P.framer(c, G.W, G.H), discs = visibleDiscs(st);
            P.twinkle(f, bright.filter(s => !discs.some(([x, y, r]) => Math.hypot(s.x - x, s.y - y) < r + 2)), st.t);
            layers.back.clear(); flow(layers.back, FLOW.motes, st); layers.back.draw(c);
        }
        function visibleDiscs(st) { return PLACES.map(pl => { const g = geom(pl, st); return [g.x, g.y, g.r]; }).filter(([, , r]) => r > 2); }
        function drawWorlds(c, st) {
            const f = P.framer(c, G.W, G.H), t = st.t;
            PLACES.map(pl => ({ pl, g: geom(pl, st) })).sort((a, b) => a.g.r - b.g.r).forEach(({ pl, g }) => {
                const x = Math.round(g.x), y = Math.round(g.y);
                if (x < -g.r - 40 || x > G.W + g.r + 40 || y < -g.r - 40 || y > G.H + g.r + 40) return;
                if (g.r < 1.5) { glint(f, pl, x, y, t); return; }
                if (pl.kind === 'station' && g.r < 7) { f.tone(x, y, RP.HULL, 0.45); f.tone(x - 1, y, RP.UI, 0.3); f.tone(x + 1, y, RP.UI, 0.3); return; }
                if (g.r < 8 && pl.kind !== 'station') { flatDisc(f, pl, x, y, g.r); return; }
                const sp = sprite(pl, Math.round(g.r), false);
                c.drawImage(sp.canvas, x - sp.half, y - sp.half);
                if (pl.beacon && g.r >= 10) {
                    const [bx, by] = beaconOffset(pl, g.r), X = x + bx, Y = y + by, ph = Math.floor((t % 1500) / TICK);
                    if (g.r < 40) { if (ph < 3) { f.glow(X, Y, 4, RP.RED, 0.9); f.px(X, Y, RP.RED.hex[4]); } else f.px(X, Y, RP.RED.hex[2]); }
                    else if (ph < 2) { f.glow(X, Y, 9, RP.RED, 0.95); f.px(X - 1, Y - 1, RP.RED.hex[4], 3, 3); f.px(X - 3, Y, RP.RED.hex[3], 7, 1); f.px(X, Y - 3, RP.RED.hex[3], 1, 7); }
                    else if (ph < 4) { f.glow(X, Y, 6, RP.RED, 0.7); f.px(X, Y, RP.RED.hex[4], 2, 2); }
                    else f.px(X, Y, RP.RED.hex[ph < 7 ? 3 : 2], 2, 2);
                }
                if (pl.kind === 'station' && sp.win) f.px(x + sp.win[0], y + sp.win[1], RP.AMBER.hex[4], g.r > 40 ? 2 : 1, 1);
            });
        }
        function glint(f, pl, x, y, t) {
            if (Math.hypot(x - lx, y - ly) < lightOpts.core + 10) return;
            const ramp0 = pl.kind === 'station' ? RP.UI : pl.type === 'ice' ? RP.ICE : pl.type === 'rock' ? RP.DUST : RP.AMBER;
            const ph = Math.floor(t / TICK) * TICK, pulse = 0.5 + 0.5 * Math.sin(ph / 1100 + (pl.at % 97)), core = 0.7 + 0.28 * pulse, arm = 0.3 + 0.32 * pulse;
            [[-1, -1], [1, -1], [-1, 1], [1, 1], [-2, 0], [2, 0], [0, -2], [0, 2]].forEach(([dx, dy]) => f.px(x + dx, y + dy, INK));
            f.px(x, y, ramp0.hex[level(ramp0, core, x, y) || 1]);
            [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dx, dy]) => f.tone(x + dx, y + dy, ramp0, arm));
            if (pulse > 0.75) [[-2, 0], [2, 0], [0, -2], [0, 2]].forEach(([dx, dy]) => f.tone(x + dx, y + dy, ramp0, 0.3));
        }
        function flatDisc(f, pl, x, y, r) {
            const ramp0 = P.PLANET_RAMP[pl.type] || RP.STONE, Lv = pl.L;
            for (let yy = -Math.ceil(r); yy <= Math.ceil(r); yy++) for (let xx = -Math.ceil(r); xx <= Math.ceil(r); xx++) {
                const q = (xx * xx + yy * yy) / (r * r); if (q >= 1) continue;
                const lam = Math.max(0, (xx * Lv[0] + yy * Lv[1]) / r + 0.25 * Lv[2]), v = 0.12 + 0.42 * lam * (0.5 + 0.5 * r / 8);
                if (v < 0.16 && threshold(x + xx, y + yy) > 0.5) f.tone(x + xx, y + yy, RP.HAZE, 0.5); else f.tone(x + xx, y + yy, ramp0, Math.min(0.6, v));
            }
        }
        function drawFront(c, st) { layers.front.clear(); flow(layers.front, FLOW.streaks, st); layers.front.draw(c); }
        /** The nearest dust passes in front of our hull's outside, never into the cabins. */
        function drawNear(c, st) { layers.near.clear(); flow(layers.near, FLOW.near, st, G.hullIn); layers.near.draw(c); }

        return { drawBack, drawWorlds, drawFront, drawNear, geom, sprite, orbitPose, radiusStep, PLACES, LAP, CRUISE, light: G.light };
    }

    window.TravelA = { make, PLACES, LAP, CRUISE };
})();
