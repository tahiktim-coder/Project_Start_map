/* ═══ Silent Exodus · new screen (?new=1) · end/CalmArt.js: the calm place, after the white ═══════════════════════════
   What it is: where the light ending comes to rest. Not Eden's meadow (Eden is the trap, green and warm): a still, pale,
   luminous place. Shallow water to the horizon holds the sky like a mirror; the sky is soft and pale; the light lies low on
   the horizon as a broad glow, with a path of light across the water toward us. The living crew stand together in the
   shallow water, Jaxon sitting on a low pale stone, each with a soft reflection: the crew-hires people the mockup used
   (prototypes/play-ideas/last-approach.js buildCalm, MiniCrewEngine). Our Lander stands on its legs out in the water. Far
   off along the path of light, a few small, still figures.
   House style (docs/ART_STYLE.md): ramps from the ink, the 8 x 8 Bayer dither, seeded noise, one light. Painted once (while
   the screen is white); the moving layer is a few glints on the water, the ripple at their feet and the people themselves.
   Needs NSPaint, MiniCrewEngine (art/MiniPeople.js, loaded by MiniLab.js), MiniShip. Loaded only with the new-screen switch.

   window.NSCalmArt (frozen)
     build(W, H, ids) → calm      ids: who is alive ('cora', 'jaxon' ...), in the crew list's order
     draw(ctx, calm, ms)          one frame of it
*/
(function () {
    'use strict';
    const P = window.NSPaint, SHIP = window.MiniShip;
    if (!window.NEW_SCREEN || !P) return;
    const { INK, ramp, threshold, fbm, hash, clamp01, seeded, hexRgb } = P;
    const ss = P.smooth;

    // ── ramps, all from the ink: cool and pale, the light's own white at the top ──
    const SKY = ramp(INK, '#141c24', '#26323d', '#3f4d58', '#62707a', '#8b979c', '#b7bfbf', '#dcdfd8', '#f3f1e6', '#fffaee');
    const WATER = ramp(INK, '#0e151b', '#1c2730', '#303e48', '#4c5b64', '#727f85', '#9ea8a9', '#c9cecb', '#ebebe2', '#fffaee');
    const STONE = ramp(INK, '#1f2427', '#3a4144', '#5e6567', '#8b9192', '#bcc0bd', '#e2e2dc');
    const GLINT = ['#fffaee', '#ebebe2'];

    // the group, left to right, as the mockup stood them (shares of the width); Jaxon sits on a stone
    const PLACE = { mira: 0, cora: 1, jaxon: 2, aris: 3, vance: 4 };
    const ACT = { jaxon: 'sit' };
    const SEAT = 22, SIT_HIP = -4;                      // the crew engine's sit: seat top above the floor; the hips over x + hipX
    const REFLECT = 0.42, REFLECT_STEPS = 4;            // how strongly the water shows them, in dithered steps
    const FIGURES = [[-0.33, 3, 7], [-0.3, 4, 7], [-0.21, 2, 6], [0.07, 2, 6], [0.12, 5, 8], [0.15, 5, 8], [0.18, 7, 9], [0.3, 2, 6], [-0.5, 4, 7], [-0.58, 2, 6]];   // [x from the light (of W), feet below the horizon, height]

    function build(W, H, ids) {
        const hy = Math.round(H * 0.5), LX = Math.round(W * 0.66), floorY = Math.round(H * 0.86);
        const p = P.painter(W, H, true);
        const skyV = (x, y) => {
            const up = clamp01(1 - y / hy);
            const glow = Math.exp(-Math.hypot((x - LX) / (W * 0.34), (y - hy) / (H * 0.2)));
            const core = Math.exp(-Math.hypot((x - LX) / (W * 0.075), (y - hy) / (H * 0.02)));
            const cloud = (fbm(x / 150, y / 9, 17, 4) - 0.5) * 0.13 * (1 - 0.5 * up);
            return 0.3 + 0.3 * (1 - up) ** 1.5 + 0.34 * glow + 0.55 * core + cloud;
        };
        for (let y = 0; y < hy; y++) for (let x = 0; x < W; x++) p.solid(x, y, SKY, skyV(x, y));
        for (let y = hy; y < H; y++) {
            const d = (y - hy) / (H - hy);                                         // 0 at the horizon, 1 at our feet
            for (let x = 0; x < W; x++) {
                const wob = Math.round(1.6 * Math.sin(y * 0.9 + 6 * fbm(x / 40, y / 3, 23, 2)) * d);   // the faintest ripple, more near us
                let v = skyV(x + wob, Math.max(0, hy - (y - hy) * 0.85)) * (0.9 - 0.2 * d);
                const path = Math.exp(-Math.abs(x - LX) / (W * (0.012 + 0.09 * d)));   // the path of light, widening toward us
                v += 0.26 * path * (0.6 + 0.4 * fbm(x / 6, y / 2, 29, 2)) + (hash(x, y, 31) > 0.86 - 0.2 * path ? 0.12 * path : 0);
                v += (fbm(x / 70, y * 1.3, 37, 2) - 0.5) * 0.08 * d;                 // long, flat streaks of calm water
                if (y === hy) v += 0.1;                                             // the horizon line, a little brighter
                p.solid(x, y, WATER, v);
            }
        }
        const stars = P.scatterStars(p, 59, Math.round(W * H / 3400), (x, y) => y < hy * 0.38 && Math.abs(x - LX) > W * 0.2);
        FIGURES.forEach(([fx, fy, h], i) => {                                       // far off on the water: small, still, backlit people
            const x = Math.round(LX + fx * W), y = hy + fy, w = h >= 8 ? 3 : 2, v = 0.27 + 0.03 * (i % 3);
            p.solid(x + (w >> 1), y - h + 1, WATER, v);                              // a head, a gap for the neck, shoulders, a body, legs
            for (let k = 2; k < h; k++) for (let j = 0; j < w; j++) {
                const isLegGap = w === 3 && j === 1 && k >= h - 2;
                if (!isLegGap) p.solid(x + j, y - (h - 1) + k, WATER, v);
            }
            for (let k = 1; k <= Math.ceil(h / 2); k += 1) if (k % 2) for (let j = 0; j < w; j++) p.solid(x + j, y + k, WATER, 0.46);   // a broken reflection
        });
        const group = placeGroup(W, ids);
        const seat = group.find(m => m.act === 'sit');
        if (seat) paintStone(p, seat.x + SIT_HIP + 2, floorY, hy);
        const c = p.canvas(), g = c.getContext('2d');
        if (SHIP && typeof SHIP.lander === 'function') paintLander(g, W, H, hy);
        return { canvas: c, W, H, hy, LX, floorY, group, stars: P.keepVisible(p, stars), refl: document.createElement('canvas') };
    }
    /** Where each living person stands: the mockup's spacing, the whole group centred left of the path of light. */
    function placeGroup(W, ids) {
        const live = (ids || []).filter(id => id in PLACE).sort((a, b) => PLACE[a] - PLACE[b]);
        const gap = W * 0.075, left = W * 0.37 - (live.length - 1) * gap / 2;
        return live.map((id, i) => ({ id, act: ACT[id] || 'idle', x: Math.round(left + i * gap), seed: i * 337 }));
    }
    /** A low, flat, pale stone under the one who sits, lit from the light on the right, half in the water with its reflection. */
    function paintStone(p, hx, floorY, hy) {
        const rx = 18, ry = SEAT / 2 + 1, cy = floorY - ry + 3;
        p.region(hx - rx, cy - ry, hx + rx + 1, floorY + ry, (x, y) => {
            const nx = (x + 0.5 - hx) / rx, isUnder = y >= floorY, yy = isUnder ? 2 * floorY - y : y, ny = (yy + 0.5 - cy) / ry;
            const q = Math.abs(nx) ** 3 + Math.abs(ny) ** 2.2;
            if (q >= 1 - 0.12 * (fbm(x / 3, yy / 3, 71, 2) - 0.5)) return;
            const lam = clamp01(0.45 * nx - 0.85 * ny + 0.15), lip = ny < 0 && q > 0.72 && nx > -0.4 ? 0.12 : 0;
            const v = 0.26 + 0.52 * lam + lip + 0.1 * (fbm(x / 4, yy / 4, 61, 3) - 0.5);
            if (isUnder) { if (y - floorY < ry * 1.4 && hash(x, y, 7) < 0.7) p.solid(x, y, WATER, 0.25 + 0.4 * v); return; }   // its reflection, broken by the water
            p.solid(x, y, STONE, v);
        });
        for (let x = hx - rx - 2; x <= hx + rx + 2; x++) if (hash(x, 3, 9) > 0.35) p.solid(x, floorY, WATER, 0.72);   // the waterline round it
    }
    /** Our Lander, standing on its legs out in the shallow water, and a broken reflection under it. */
    function paintLander(g, W, H, hy) {
        const x = Math.round(W * 0.88), y = hy + 22;
        const t = document.createElement('canvas'); t.width = W; t.height = H;
        const tg = t.getContext('2d');
        try { SHIP.lander(tg, { x, y, len: 40, angle: Math.PI / 2, legs: 'down', anchor: 1.1, sunDir: [-1, -0.2], light: 0.82 }); } catch (err) { console.warn('NSCalmArt: no Lander', err); return; }
        g.drawImage(t, 0, 0);
        const img = tg.getImageData(0, 0, W, H), out = g.getImageData(0, 0, W, H), src = img.data, dst = out.data;
        for (let yy = y + 1; yy < Math.min(H, y + 50); yy++) {
            const sy = 2 * y - yy, k = (yy - y) / 50;
            if (sy < 0) continue;
            for (let xx = Math.max(0, x - 40); xx < Math.min(W, x + 40); xx++) {
                const sx = xx + Math.round(Math.sin(yy * 1.3) * 1.2 * k), i = (sy * W + sx) * 4, o = (yy * W + xx) * 4;
                if (sx < 0 || sx >= W || src[i + 3] < 128 || 0.5 * (1 - k) < threshold(xx, yy) || hash(xx, yy, 11) < 0.25) continue;
                dst[o] = (dst[o] + src[i]) >> 1; dst[o + 1] = (dst[o + 1] + src[i + 1]) >> 1; dst[o + 2] = (dst[o + 2] + src[i + 2]) >> 1;
            }
        }
        g.putImageData(out, 0, 0);
    }

    /** The people's reflections: each sprite mirrored under the waterline and mixed into the water in dithered steps. */
    function reflect(ctx, calm, ms) {
        const E = window.MiniCrewEngine, { W, H, floorY } = calm, depth = Math.min(H - floorY, 110);
        if (!E || depth <= 2) return;
        const r = calm.refl;
        if (r.width !== W || r.height !== depth) { r.width = W; r.height = depth; }
        const rg = r.getContext('2d');
        rg.clearRect(0, 0, W, depth);
        calm.group.forEach(m => {
            const S = E.sprite(m.id, m.act, E.frameAt(m.act, ms + m.seed), { warm: 1, rim: 1 });
            rg.save(); rg.translate(Math.round(m.x) - S.origin.x, S.origin.y); rg.scale(1, -1); rg.drawImage(S.canvas, 0, 0); rg.restore();
        });
        const src = rg.getImageData(0, 0, W, depth).data, img = ctx.getImageData(0, floorY, W, depth), dst = img.data;
        for (let y = 1; y < depth; y++) {
            const fade = REFLECT * (1 - y / depth) ** 0.8, wob = Math.round(Math.sin(y * 0.8 + ms / 900) * (y > 6 ? 1 : 0));
            for (let x = 0; x < W; x++) {
                const sx = x + wob, i = (y * W + sx) * 4;
                if (sx < 0 || sx >= W || src[i + 3] < 128) continue;
                const a = Math.min(1, Math.floor(fade * REFLECT_STEPS + threshold(x, y + floorY)) / REFLECT_STEPS);
                if (a <= 0) continue;
                const o = (y * W + x) * 4;
                dst[o] += (src[i] - dst[o]) * a; dst[o + 1] += (src[i + 1] - dst[o + 1]) * a; dst[o + 2] += (src[i + 2] - dst[o + 2]) * a;
            }
        }
        ctx.putImageData(img, 0, floorY);
    }

    function draw(ctx, calm, ms) {
        const E = window.MiniCrewEngine, tq = Math.floor(ms / 125) * 125, f = P.framer(ctx, calm.W, calm.H);   // the moving layer steps eight times a second
        ctx.drawImage(calm.canvas, 0, 0);
        P.twinkle(f, calm.stars, tq);
        for (let i = 0; i < 26; i++) {                                              // glints along the path of light, coming and going
            const d = hash(i, 1, 41), y = Math.round(calm.hy + 2 + d * d * (calm.H - calm.hy - 6)), spread = calm.W * (0.012 + 0.09 * (y - calm.hy) / (calm.H - calm.hy));
            const x = Math.round(calm.LX + (hash(i, 2, 41) - 0.5) * 2.2 * spread);
            if (hash(i, Math.floor(tq / 250), 43) > 0.55) f.px(x, y, GLINT[i % 2], hash(i, 3, 41) > 0.7 ? 2 : 1, 1);
        }
        reflect(ctx, calm, ms);
        if (!E) return;
        calm.group.forEach(m => {
            try { E.draw(ctx, m.id, m.act, ms + m.seed, m.x, calm.floorY, { facing: 1, warm: 1, rim: 1, seed: m.seed }); } catch (err) { /* a person who cannot be drawn is left out */ }
            if (m.act === 'sit') return;
            const shift = Math.floor(tq / 500) % 2;                                 // the ripple round their feet
            f.px(m.x - 7 + shift, calm.floorY, GLINT[1], 6, 1); f.px(m.x + 2 - shift, calm.floorY + 1, GLINT[1], 5, 1);
        });
    }

    window.NSCalmArt = Object.freeze({ build, draw });
})();
