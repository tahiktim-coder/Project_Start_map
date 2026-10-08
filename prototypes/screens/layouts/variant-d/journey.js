/* ═══ Silent Exodus · layout variant D, "The bridge" · what the big window shows ═══════════════════════════════════
   The travel view of game-screen-v3.html, seen from the bridge: always flying toward the light; worlds come out of it as
   glints, grow, and slide past the glass; click one to stop. Every picture is v3's (game-screen-v3/paint.js and data.js,
   loaded, not changed): its space strip, the light, the sphere and its surfaces, the station, the flow of specks. The
   pieces that live only inside game-screen-v3.html (the stream curve, the world sprite, the glint, the flat disc, the
   flow field) are copied here. Coordinates are the screen's art pixels with the camera on the bridge (640 x 360).
   Everything is a pure function of the clock t (ms) and the stop (null, or { id, t0 }), so ?t= gives the same picture.

   window.Journey = { WIN, LIGHT, PLACES, D(t, stop), speed(t, stop), geomAt(pl, t, stop), arrival(t, stop), passed(t, stop),
                      inReach(pl, t, stop), draw(ctx, t, stop, hoverId), hit(x, y, t, stop) }
*/
(function (root) {
    'use strict';
    const P = root.V3Paint, DATA = root.V3Data, RP = P.RP, INK = P.INK, { clamp01, smooth, lerp, hash, level, threshold } = P;
    const W = 640, H = 360;
    const LIGHT = [515, 92];                                       // the light, in the right pane; it never moves
    const WIN = { x0: 116, x1: 570, y0: 34, y1: 236 };            // the window's glass (screen at rest)
    const CRUISE = 24;                                             // px a second at a world's closest point
    const FLOW_K = 52 / CRUISE;                                    // space streams at v3's pace
    const TAU = 1.1;                                               // s: how quickly we slow to a stop
    const ARRIVE_MS = 3800;                                        // the pull into orbit
    const ORBIT = { x: 384, y: 146, r: 90 };                       // in orbit a world fills the middle of the window
    const SEC = DATA.SECTORS[1];
    const FLOW_LN = Math.log(900 / 22);

    // the two places this run meets, at this window's own closest points (sector 1's Titan-61 IV, then Platform Zeta)
    const PLACES = [
        Object.assign({}, SEC.places.find(p => p.id === 'titan'), { passT: 62, pass: [330, 164], r: 66 }),
        Object.assign({}, SEC.places.find(p => p.id === 'zeta'), { passT: 205, pass: [258, 86], s: 1.15 }),
    ].map(pl => {
        const [px, py] = pl.pass, d = Math.hypot(LIGHT[0] - px, LIGHT[1] - py);
        pl.at = pl.passT * CRUISE;
        pl.k = (LIGHT[0] - px) / CRUISE;
        pl.full = pl.kind === 'station' ? 24 * pl.s : pl.r;
        pl.vel = [(px - LIGHT[0]) / pl.k, (py - LIGHT[1]) / pl.k];
        pl.L = P.lightVector(px, py, LIGHT[0], LIGHT[1], 0.5 * d);
        pl.rim = SEC.rim;
        pl.orbitR = pl.kind === 'station' ? 2.6 : ORBIT.r;
        return pl;
    });

    // ── the clock: cruise, or slowing to a stop ──
    function D(t, stop) {
        if (!stop || t <= stop.t0) return CRUISE * t / 1000;
        const s = (t - stop.t0) / 1000;
        return CRUISE * stop.t0 / 1000 + CRUISE * TAU * (1 - Math.exp(-s / TAU));
    }
    const speed = (t, stop) => (!stop || t <= stop.t0 ? CRUISE : CRUISE * Math.exp(-(t - stop.t0) / 1000 / TAU));
    const arrival = (t, stop) => (!stop ? 0 : smooth(0, 1, (t - stop.t0) / ARRIVE_MS));

    /** v3's stream: a world d seconds ahead sits on a curve out of the light; after its closest point it carries on past. */
    function geom(pl, Dn) {
        const d = (pl.at - Dn) / CRUISE;
        if (d >= 0) {
            const f = pl.k / (pl.k + d), fp = Math.sqrt(pl.k / 2 / (pl.k / 2 + d));
            return { x: LIGHT[0] + (pl.pass[0] - LIGHT[0]) * fp, y: LIGHT[1] + (pl.pass[1] - LIGHT[1]) * fp, r: pl.full * Math.pow(f, 1.4), d };
        }
        const s = -d;
        return { x: pl.pass[0] + pl.vel[0] * s, y: pl.pass[1] + pl.vel[1] * s, r: pl.full * (1 + 0.3 * (1 - Math.exp(-s / 4))), d };
    }
    function geomAt(pl, t, stop) {
        const g = geom(pl, D(t, stop));
        if (!stop || stop.id !== pl.id) return g;
        const e = arrival(t, stop), g0 = geom(pl, D(stop.t0, null));
        const r1 = pl.kind === 'station' ? pl.full * pl.orbitR : pl.orbitR;
        return { x: lerp(g0.x, ORBIT.x, e), y: lerp(g0.y, ORBIT.y, e), r: lerp(g0.r, r1, e), d: g.d, e };
    }
    const passedCount = (t, stop) => PLACES.filter(pl => (!stop || stop.id !== pl.id) && geom(pl, D(t, stop)).d < -3).length;
    function inReach(pl, t, stop) {
        if (stop) return false;
        const g = geomAt(pl, t, stop);
        return g.r >= 3 && g.x + g.r > WIN.x0 + 8 && g.x - g.r < WIN.x1;
    }
    function hit(x, y, t, stop) {
        for (const pl of PLACES) {
            const g = geomAt(pl, t, stop);
            if (stop && stop.id !== pl.id) continue;
            if (!stop && !inReach(pl, t, stop)) continue;
            if (x < WIN.x0 || x >= WIN.x1 || y < WIN.y0 || y >= WIN.y1) continue;
            const reach = pl.kind === 'station' ? g.r * 1.1 + 6 : g.r + 6;
            if (Math.hypot(x - g.x, y - g.y) < reach) return pl;
        }
        return null;
    }

    // ── still parts: space (v1's haze, dust and stars on v3's sliding strip), the light's breathing frames ──
    const STRIP_EXTRA = 360;
    let art = null;
    function backdrop() {
        if (art) return art;
        const strip = P.spaceStrip(W + STRIP_EXTRA, H, SEC.seed, SEC.dust, SEC.haze, SEC.stars), lit = new Float32Array(W * H);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) lit[y * W + x] = Math.exp(-Math.hypot(x - LIGHT[0], (y - LIGHT[1]) * 1.15) / (SEC.light.halo * 0.85 + 6));
        const bp = P.painter(W, H, true), canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
        const half = 9, rock = P.painter(half * 2, half * 2, false), Lr = P.lightVector(230, 66, LIGHT[0], LIGHT[1], 60);
        P.sphere(rock, { cx: half, cy: half, r: 7, ramp: P.ramp(INK, RP.HAZE.hex[2], RP.HAZE.hex[4], RP.STONE.hex[2], RP.STONE.hex[3]), L: Lr, dim: 0.85, surface: P.surfaceFor('rock', 404, Lr) });
        art = { strip, lit, bp, canvas, g: canvas.getContext('2d'), off: null, bright: [], glows: new Map(), rock: rock.canvas() };
        return art;
    }
    function ensureBackdrop(a, off) {
        off = Math.max(0, Math.min(STRIP_EXTRA, off));
        if (a.off === off) return;
        const away = SEC.light.halo * 0.9 + SEC.light.core + 8;
        a.bright = P.paintSpace(a.bp, a.strip, off, a.lit, (x, y) => Math.hypot(x - LIGHT[0], y - LIGHT[1]) < away);
        a.g.putImageData(new ImageData(a.bp.data, W, H), 0, 0);
        a.off = off;
    }
    const LIGHT_STEP = 1.13;                                       // the light grows a little after each world we pass
    function lightNow(n) { const L = SEC.light, k = Math.pow(LIGHT_STEP, n); return { core: L.core * k, halo: L.halo * k, strength: L.strength, spikes: L.spikes * Math.sqrt(k) }; }
    function glowFrames(a, n) {
        const L = lightNow(n), key = L.core.toFixed(2);
        if (a.glows.has(key)) return a.glows.get(key);
        const reach = Math.ceil(L.halo * 3.2 + L.core + 10), size = reach * 2;
        const frames = Array.from({ length: 8 }, (_, k) => { const p = P.painter(size, size, false); P.lightGlow(p, reach, reach, L, 0.9 + 0.1 * Math.sin(k / 8 * Math.PI * 2)); return { canvas: p.canvas(), x: LIGHT[0] - reach, y: LIGHT[1] - reach }; });
        a.glows.set(key, frames);
        return frames;
    }

    // ── worlds (game-screen-v3.html worldSprite, drawGlint, flatDisc, copied) ──
    const spriteCache = new Map();
    const quant = r => (r < 24 ? Math.round(r) : r < 48 ? 2 * Math.round(r / 2) : 3 * Math.round(r / 3));
    function worldSprite(pl, rInt) {
        const key = pl.id + ':' + rInt;
        if (spriteCache.has(key)) return spriteCache.get(key);
        let out;
        if (pl.kind === 'station') {
            const s = pl.s * rInt / pl.full, half = Math.ceil(27 * s + 3), p = P.painter(half * 2, half * 2, false);
            const win = P.drawStation(p, half, half, s, pl.seed, 0.75 + 0.25 * clamp01(rInt / pl.full));
            out = { canvas: p.canvas(), half, win: [win[0] - half, win[1] - half], rims: [] };
        } else {
            const r = rInt, w = Math.max(2, Math.round(r / 22)), half = r + w + 3, p = P.painter(half * 2, half * 2, false), rims = [];
            const frac = Math.min(1, r / pl.full), dim = 0.62 + 0.38 * smooth(0.12, 0.85, frac);
            P.sphere(p, { cx: half, cy: half, r, ramp: P.PLANET_RAMP[pl.type] || RP.STONE, L: pl.L, dim, surface: P.surfaceFor(pl.type, pl.seed, pl.L), rim: pl.rim, ambient: 0.012, gain: 0.84, rims,
                atmo: { ramp: pl.type === 'gas' || pl.type === 'desert' ? RP.DUST : RP.ICE, w } });
            if (pl.beacon && r >= 60) {                                                                   // the furrow the wreck cut coming down
                const [bx, by] = beaconOffset(pl, r), k = r / 118, X = half + bx, Y = half + by;
                p.line(X + 3 * k, Y + k, X + 16 * k, Y - 2 * k, (x, y) => p.solid(x, y, RP.STONE, 0.02));
            }
            out = { canvas: p.canvas(), half, rims: rims.map(([x, y, rr, lv]) => [x - half, y - half, rr, lv]) };
        }
        spriteCache.set(key, out);
        return out;
    }
    const beaconOffset = (pl, r) => [Math.round(-0.6 * r), Math.round(0.1 * r)];
    function drawGlint(f, pl, x, y, t, n) {
        if (Math.hypot(x - LIGHT[0], y - LIGHT[1]) < lightNow(n).core + 8) return;
        const ramp0 = pl.kind === 'station' ? RP.UI : pl.type === 'ice' ? RP.ICE : pl.type === 'rock' ? RP.DUST : RP.AMBER;
        const ph = Math.floor(t / 125) * 125, pulse = 0.5 + 0.5 * Math.sin(ph / 1100 + (pl.at % 97)), core = 0.7 + 0.28 * pulse, arm = 0.3 + 0.32 * pulse;
        [[-1, -1], [1, -1], [-1, 1], [1, 1], [-2, 0], [2, 0], [0, -2], [0, 2]].forEach(([dx, dy]) => f.px(x + dx, y + dy, INK));
        f.px(x, y, ramp0.hex[level(ramp0, core, x, y) || 1]);
        [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dx, dy]) => f.tone(x + dx, y + dy, ramp0, arm));
        if (pulse > 0.75) [[-2, 0], [2, 0], [0, -2], [0, 2]].forEach(([dx, dy]) => f.tone(x + dx, y + dy, ramp0, 0.3));
    }
    function flatDisc(f, pl, x, y, r) {
        const ramp0 = P.PLANET_RAMP[pl.type] || RP.STONE, L = pl.L;
        for (let yy = -Math.ceil(r); yy <= Math.ceil(r); yy++) for (let xx = -Math.ceil(r); xx <= Math.ceil(r); xx++) {
            const q = (xx * xx + yy * yy) / (r * r); if (q >= 1) continue;
            const lam = Math.max(0, (xx * L[0] + yy * L[1]) / r + 0.25 * L[2]), v = 0.12 + 0.42 * lam * (0.5 + 0.5 * r / 8);
            if (v < 0.16 && threshold(x + xx, y + yy) > 0.5) f.tone(x + xx, y + yy, RP.HAZE, 0.5); else f.tone(x + xx, y + yy, ramp0, Math.min(0.6, v));
        }
    }
    function drawWorlds(c, f, t, stop, hoverId, n) {
        const list = PLACES.map(pl => ({ pl, g: geomAt(pl, t, stop) })).sort((a, b) => a.g.r - b.g.r);
        const discs = [];
        list.forEach(({ pl, g }) => {
            const x = Math.round(g.x), y = Math.round(g.y);
            if (x < -g.r - 60 || x > W + g.r + 60 || y < -g.r - 60 || y > H + g.r + 60) return;
            if (g.r < 1.5) { drawGlint(f, pl, x, y, t, n); return; }
            if (g.r < 8 && pl.kind !== 'station') { flatDisc(f, pl, x, y, g.r); discs.push([x, y, g.r]); return; }
            if (pl.kind === 'station' && g.r < 7) { f.tone(x, y, RP.HULL, 0.45); f.tone(x - 1, y, RP.UI, 0.3); f.tone(x + 1, y, RP.UI, 0.3); return; }
            const sp = worldSprite(pl, quant(g.r));
            c.drawImage(sp.canvas, x - sp.half, y - sp.half);
            discs.push([x, y, g.r]);
            if (hoverId === pl.id) sp.rims.forEach(([rx, ry, r, lv]) => f.px(x + rx, y + ry, r.hex[Math.min(r.hex.length - 1, lv + 1)]));
            if (pl.beacon && g.r >= 10) {
                const [bx, by] = beaconOffset(pl, g.r), X = x + bx, Y = y + by, ph = Math.floor((t % 1500) / 125);
                if (g.r < 40) { if (ph < 3) { f.glow(X, Y, 4, RP.RED, 0.9); f.px(X, Y, RP.RED.hex[4]); } else f.px(X, Y, RP.RED.hex[2]); }
                else if (ph < 2) { f.glow(X, Y, 9, RP.RED, 0.95); f.px(X - 1, Y - 1, RP.RED.hex[4], 3, 3); f.px(X - 3, Y, RP.RED.hex[3], 7, 1); f.px(X, Y - 3, RP.RED.hex[3], 1, 7); }
                else if (ph < 4) { f.glow(X, Y, 6, RP.RED, 0.7); f.px(X, Y, RP.RED.hex[4], 2, 2); }
                else f.px(X, Y, RP.RED.hex[ph < 7 ? 3 : 2], 2, 2);
            }
            if (pl.kind === 'station' && sp.win) f.px(x + sp.win[0], y + sp.win[1], RP.AMBER.hex[4], g.r > 40 ? 2 : 1, 1);
        });
        return discs;
    }

    // ── space streaming past (game-screen-v3.html flowField, copied): specks on rays out of the light ──
    const FLOW = {
        motes: { n: 110, seed: 41, rate: 0.0005, tail: 0.1, ramp: 'DUST', v: 0.85, lit: true },
        streaks: { n: 220, seed: 43, rate: 0.0015, tail: 0.17, ramp: 'STAR', v: 0.9 },
        near: { n: 30, seed: 47, rate: 0.0027, tail: 0.13, ramp: 'STAR', v: 1.05, wide: 0.5 },
    };
    function flowField(Lyr, o, flow, sp) {
        const [vx, vy] = LIGHT, base = flow * o.rate, ramp0 = RP[o.ramp], tailPh = Math.min(0.12, sp * o.rate * o.tail);
        for (let i = 0; i < o.n; i++) {
            const ph = hash(i, 1, o.seed) + hash(i, 7, o.seed) / 256 + base, cyc = Math.floor(ph), u = ph - cyc;
            const th = (hash(i + cyc * 13, 2, o.seed) + hash(i, cyc & 255, o.seed + 1) / 256) * Math.PI * 2, dx = Math.cos(th), dy = Math.sin(th);
            const d = 22 * Math.exp(u * FLOW_LN), x = vx + dx * d, y = vy + dy * d;
            if (x < WIN.x0 - 40 || y < WIN.y0 - 40 || x > WIN.x1 + 40 || y > WIN.y1 + 40) continue;
            let v = o.v * smooth(22, 90, d) * (0.55 + 0.45 * hash(i, 3, o.seed));
            if (o.lit) v *= 0.3 + 1.1 * Math.exp(-Math.hypot(x - LIGHT[0], y - LIGHT[1]) / 170);
            if (v < 0.08) continue;
            const len = Math.max(0, d - 22 * Math.exp(Math.max(0, u - tailPh) * FLOW_LN)), thick = o.wide && hash(i, 5, o.seed) < o.wide;
            for (let k = 0; k <= len; k++) {
                const a = v * (1 - k / (len + 1)), px = x - dx * k, py = y - dy * k;
                Lyr.tone(px, py, ramp0, a);
                if (thick) Lyr.tone(px - dy, py + dx, ramp0, a * 0.8);
            }
        }
    }

    let back = null, front = null;
    function draw(c, t, stop, hoverId) {
        const a = backdrop(), Dn = D(t, stop), n = passedCount(t, stop), f = P.framer(c, W, H);
        if (!back) { back = P.pixelLayer(W, H); front = P.pixelLayer(W, H); }
        ensureBackdrop(a, Math.round(Dn * 0.02 * FLOW_K));
        c.imageSmoothingEnabled = false;
        c.drawImage(a.canvas, 0, 0);
        c.drawImage(a.rock, Math.round(230 - Dn * 0.006) - 9, 66 - 9);
        const gl = glowFrames(a, n), g = gl[Math.floor(t / 500) % gl.length]; c.drawImage(g.canvas, g.x, g.y);
        const flow = Dn * FLOW_K, sp = speed(t, stop) * FLOW_K;
        back.clear(); front.clear();
        flowField(back, FLOW.motes, flow, sp); back.draw(c);
        const discs = drawWorlds(c, f, t, stop, hoverId, n);
        P.twinkle(f, a.bright.filter(st => !discs.some(([x, y, r]) => Math.hypot(st.x - x, st.y - y) < r + 2)), t);
        flowField(front, FLOW.streaks, flow, sp); flowField(front, FLOW.near, flow, sp); front.draw(c);
    }

    /** Paint, ahead of time, every size a world will be shown at, one a call (so nothing stalls when it comes close). */
    function bakeJobs() {
        const jobs = [() => backdrop(), () => { const a = backdrop(); glowFrames(a, 0); glowFrames(a, 1); glowFrames(a, 2); }];
        PLACES.forEach(pl => {
            const sizes = new Set();
            for (let r = 8; r <= Math.max(pl.full * 1.3, pl.kind === 'station' ? pl.full * pl.orbitR : pl.orbitR) + 3; r++) sizes.add(quant(r));
            sizes.forEach(r => jobs.push(() => worldSprite(pl, r)));
        });
        return jobs;
    }

    root.Journey = { W, H, WIN, LIGHT, ORBIT, PLACES, CRUISE, ARRIVE_MS, D, speed, geomAt, arrival, passedCount, inReach, draw, hit, bakeJobs };
})(typeof window !== 'undefined' ? window : globalThis);
