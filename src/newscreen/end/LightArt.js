/* ═══ Silent Exodus · new screen (?new=1) · end/LightArt.js: the last approach, its pictures ═══════════════════════════
   What it is: the pictures of flying into the light, from the mockup the designer loved (prototypes/play-ideas/
   last-approach.js §1 and §4, ported nearly as they are, without the steering: the ship holds its own course). Space ahead
   in sector 6's sky F, the light growing until it fills the window, its warm bloom, dust streaming past toward us, our
   Lander's decks in the corner with their alarms (a deck in emergency red, the window's edges flashing), the shake, and
   everything going white. The Eden ending borrows it for the turn away: the light shrinking behind us while Eden slides into
   the window. end/Ending.js drives the clock and the words; this file only paints, in art pixels (about 640 x 360 of them).
   Needs NSPaint, NSSky, NSSky2, MiniShip; NSWorlds for Eden. Loaded only when the new-screen switch is on.

   window.NSLightArt (frozen)
     create(W, H) → scene         the backdrop, our ship's corner, the dust; built once per window size
     tick(scene, dt, speed)       the dust streams toward us (speed in depth units a second; 0 stands still)
     draw(ctx, scene, v, ms)      one frame. v: { phase 'fly' | 'white' | 'turn', s (0 a point .. 1 fills the window),
                                  k (how far through 'white' or 'turn', 0..1), off [x, y], shake (art px), clock (s),
                                  damaged { deck: true }, flash (the alarms' on beat), label, edges (bool), plume,
                                  from { s, off } (where the turn began), edenK (Eden sliding in, 0..1), white (0..1),
                                  words [[x0, y0, x1, y1]] (art px boxes the picture darkens under) }
     eden(scene, node)            paints Eden for the turn, as the orbit shows it (node: the sector's Eden, or null)
     shade(ctx, W, H, words)      darkens a drawn frame under words, with the grain;  white(ctx, W, H, a) whitens it;
                                  darken(ctx, W, H, a) dims all of it toward the ink;  veil(W, H) → canvas: the top left
                                  darkening like dusk, for words over a day sky (cached per size)
     lightOf(s)                   the light's size at s
*/
(function () {
    'use strict';
    const P = window.NSPaint, SKY = window.NSSky, SKY2 = window.NSSky2, SHIP = window.MiniShip;
    if (!window.NEW_SCREEN || !P || !SHIP) return;
    const { INK, RP, threshold, clamp01, seeded, hexRgb, lerp } = P;
    const ss = P.smooth;

    const DUST_N = 140, SHADE_PAD = 10, WHITE_STEPS = 8;
    const WHITE = hexRgb('#fff3dc');                    // the false sun's own white (RP.SUN's top): what everything goes to
    const INK_RGB = hexRgb(INK);
    const SMALL = { core: 1.2, halo: 7, strength: 0.9, spikes: 3 };   // the light far behind us, after the turn

    const c32 = rgb => (0xff000000 | (rgb[2] << 16) | (rgb[1] << 8) | rgb[0]) >>> 0;
    const lumOf = rgb => (rgb[0] * 77 + rgb[1] * 150 + rgb[2] * 29) >> 8;
    const lum32 = p => ((p & 255) * 77 + ((p >> 8) & 255) * 150 + ((p >> 16) & 255) * 29) >> 8;
    const packs = new Map();                            // ramp → its colours as 32-bit pixels and their brightness
    function pack(r) {
        let k = packs.get(r);
        if (!k) { k = { c: Uint32Array.from(r.rgb.map(c32)), l: Uint8Array.from(r.rgb.map(lumOf)) }; packs.set(r, k); }
        return k;
    }
    const WHITE32 = c32(WHITE);

    // ── this frame's pixels: the one picture being painted (only one is, at a time) ──
    let cur = { buf: null, W: 0, H: 0 };

    // ════════════════════════════════════════ 1. built once per window size ════════════════════════════════════════
    /** Space ahead: sector 6's sky F (the ring of lit dust round the light) with the space strip over it, painted once on a
        canvas wider than the window, so the heading can sway and the turn can swing without running off its edge. The light
        itself is not painted here: it grows every frame. */
    function buildBackdrop(W, H) {
        const MX = Math.round(W * 0.5), MY = Math.round(H * 0.5), BW = W + 2 * MX, BH = H + 2 * MY, LP = [MX + (W >> 1), MY + (H >> 1)];
        const ox = LP[0] - 320, oy = LP[1] - 180;                                  // the 640 x 360 stage with the light at its middle
        let sky = null;
        try { sky = SKY2 ? SKY2.build(BW, BH, ox, oy, 6, [320, 180], 'f') : null; } catch (err) { console.warn('NSLightArt: no sky F', err); }
        const strip = P.spaceStrip(BW + 4, BH, 61, 0.5, sky ? sky.haze : 1, 1), lit = new Float32Array(BW * BH);
        for (let y = 0; y < BH; y++) for (let x = 0; x < BW; x++) lit[y * BW + x] = Math.exp(-Math.hypot(x - LP[0], (y - LP[1]) * 1.15) / 60);
        const bp = P.painter(BW, BH, true), keep = (x, y) => Math.hypot(x - LP[0], y - LP[1]) < 14;
        const bright = sky && SKY ? SKY.paintSpace(bp, strip, 0, lit, keep, sky, 0) : P.paintSpace(bp, strip, 0, lit, keep);
        return { canvas: bp.canvas(), sky, stars: P.keepVisible(bp, bright), LP, BW, BH };
    }
    /** The space behind our own ship goes quiet (the corridor's look): ink, dithered in, deepest at the hull. */
    function shadeBehind(W, H, L) {
        const c = document.createElement('canvas'); c.width = W; c.height = H;
        const g = c.getContext('2d'), ix = L.cx, iy = L.top + L.height * 0.55, rx = L.D * 1.6, ry = L.height * 0.62;
        g.fillStyle = INK;
        for (let y = Math.max(0, Math.floor(iy - ry)); y < Math.min(H, iy + ry); y++) for (let x = Math.max(0, Math.floor(ix - rx)); x < Math.min(W, ix + rx); x++) {
            const q = ((x - ix) / rx) ** 2 + ((y - iy) / ry) ** 2;
            if (q < 1 && 0.85 * (1 - q) ** 0.6 > threshold(x, y)) g.fillRect(x, y, 1, 1);
        }
        return c;
    }
    function create(W, H) {
        const scene = { W, H, CX: W >> 1, CY: H >> 1, back: buildBackdrop(W, H), rng: seeded(4211), dust: [], eden: null };
        scene.shipL = SHIP.layout(11, H - 131, 48, 101, SHIP.LANDER_ORDER);       // our ship in the corner, as the corridor shows it
        scene.shade = shadeBehind(W, H, scene.shipL);
        for (let i = 0; i < DUST_N; i++) scene.dust.push(newMote(scene, false));
        return scene;
    }
    /** Eden as the orbit shows it (Worlds.js, the game's own Eden), lit from the light we turned from. */
    function eden(scene, node) {
        const r = Math.round(scene.H * 0.3), size = r * 2 + 24, c = size / 2, p = P.painter(size, size, false);
        const L = P.lightVector(scene.W * 0.66, scene.H * 0.52, scene.W * 0.1, scene.H * 0.4, 220), W = window.NSWorlds;
        const o = node ? { cx: c, cy: c, r, node, sector: 6, L } : { cx: c, cy: c, r, type: 'EDEN', seed: 41, sector: 6, L };
        let painted = false;
        if (W && typeof W.paint === 'function') { try { W.paint(p, o); painted = true; } catch (err) { console.error('NSLightArt: NSWorlds.paint failed', err); } }
        if (!painted) P.sphere(p, { cx: c, cy: c, r, ramp: RP.ICE, L, surface: P.surfaceFor('ice', 41, L) });
        scene.eden = { canvas: p.canvas(), r, half: c, L, node, o };
        return scene.eden;
    }

    // ════════════════════════════════════════ 2. the dust ════════════════════════════════════════
    /** A speck of dust down the heading: across (x, y) and how far ahead (z); never straight through the middle of us. */
    function newMote(scene, isFar) {
        const r = scene.rng, a = r() * 6.28, d = 0.08 + r() * 1.3;
        return { x: Math.cos(a) * d, y: Math.sin(a) * d * 0.75, z: isFar ? 3.2 + r() * 0.8 : 0.2 + r() * 3.8 };
    }
    function tick(scene, dt, speed) {
        const dust = scene.dust;
        for (let i = 0; i < dust.length; i++) { const m = dust[i]; m.z -= speed * dt; if (m.z < 0.08) dust[i] = newMote(scene, true); }
    }

    // ════════════════════════════════════════ 3. painting into this frame's pixels ════════════════════════════════════════
    /** NSPaint's painter calls (region, tone, add) over this frame's pixels, so lightGlow paints the light as it is, every
        frame; light only ever adds (where it is brighter than what is there). */
    const glowPainter = {
        region(x0, y0, x1, y1, fn) {
            for (let y = Math.max(0, Math.floor(y0)); y < Math.min(cur.H, Math.ceil(y1)); y++) for (let x = Math.max(0, Math.floor(x0)); x < Math.min(cur.W, Math.ceil(x1)); x++) fn(x, y);
        },
        tone(x, y, r) { lightPx(x, y, r, 1); },                                     // inside the core: white, no dark ring when it is big
        add(x, y, r, v) { lightPx(x, y, r, v); },
    };
    function lightPx(x, y, r, v) {
        x = Math.round(x); y = Math.round(y);
        if (x < 0 || y < 0 || x >= cur.W || y >= cur.H) return;
        const k = P.level(r, v, x, y);
        if (!k) return;
        const pk = pack(r), i = y * cur.W + x;
        if (pk.l[k] > lum32(cur.buf[i])) cur.buf[i] = pk.c[k];
    }
    /** Mix pixel (x, y) toward rgb c by a, in `steps` dithered steps: shade that darkens or light that whitens, never a screen door. */
    function mixPx(x, y, c, a, steps) {
        a = Math.min(1, Math.floor(a * steps + threshold(x, y)) / steps);
        if (a <= 0) return;
        const i = y * cur.W + x, p = cur.buf[i], r = p & 255, g = (p >> 8) & 255, b = (p >> 16) & 255;
        cur.buf[i] = (0xff000000 | (Math.round(b + (c[2] - b) * a) << 16) | (Math.round(g + (c[1] - g) * a) << 8) | Math.round(r + (c[0] - r) * a)) >>> 0;
    }
    /** A line of light from (x0, y0) to (x1, y1), its tone running v0 → v1 (a dust streak). */
    function streak(x0, y0, x1, y1, r, v0, v1) {
        x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
        const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, n = Math.max(1, dx, -dy);
        for (let k = 0, err = dx + dy; k < 400; k++) {
            lightPx(x0, y0, r, v0 + (v1 - v0) * Math.min(1, k / n));
            if (x0 === x1 && y0 === y1) break;
            const e2 = 2 * err;
            if (e2 >= dy) { err += dy; x0 += sx; }
            if (e2 <= dx) { err += dx; y0 += sy; }
        }
    }

    /** The light by how far in we are: a point with a soft halo at first, filling the window at the end. */
    function lightOf(s) {
        return { core: 1.6 + 30 * s ** 2.4, halo: 10 + 120 * s ** 1.7, strength: 1 + 0.35 * s, spikes: 4 + 12 * s };
    }
    /** Where the light is this frame, how big, how much of the window the bloom fills. */
    function view(scene, v) {
        let off = v.off || [0, 0], L = lightOf(v.s), bloom = 0.62 * ss(0.45, 1, v.s), fadeDust = 1;
        if (v.phase === 'white') { L = lightOf(1 + 0.4 * v.k); bloom = 0.62 + 0.5 * v.k; }   // still growing as it whites out
        if (v.phase === 'turn') {                                                   // the view swings away: the light slides off and shrinks
            const k = ss(0, 1, Math.min(1, v.k / 0.8)), from = lightOf(v.from.s);
            off = [lerp(v.from.off[0], -scene.W * 0.4, k), lerp(v.from.off[1], -scene.H * 0.1, k)];
            L = { core: lerp(from.core, SMALL.core, k), halo: lerp(from.halo, SMALL.halo, k), strength: lerp(from.strength, SMALL.strength, k), spikes: lerp(from.spikes, SMALL.spikes, k) };
            bloom = 0.62 * ss(0.45, 1, v.from.s) * (1 - k); fadeDust = 1 - k;
        }
        const a = v.shake || 0, sh = a > 0.3 ? [Math.round((Math.random() - 0.5) * a), Math.round((Math.random() - 0.5) * a * 0.75)] : [0, 0];
        return { lx: Math.round(scene.CX + off[0]) + sh[0], ly: Math.round(scene.CY + off[1]) + sh[1], L, bloom, fadeDust };
    }

    /** The light. While it is small, NSPaint.lightGlow paints it, as the travel view does; once it fills the window that is too
        slow for every frame, so the same numbers are looked up by distance from a table made once a frame. Light only adds. */
    const GLOW_LUT = new Float32Array(1600), FAST_REACH = 120;
    function paintLight(lx, ly, o, breath) {
        const reach = o.halo * 3.2 + o.core + 8;
        if (reach < FAST_REACH) { P.lightGlow(glowPainter, lx, ly, o, breath); return; }
        const s = o.strength * breath, k1 = o.core * 0.5 + 1.4, k2 = o.halo * 0.32 + 1, k3 = o.halo * 1.1 + 1, k4 = o.halo * 0.9 + 8;
        const n = Math.min(GLOW_LUT.length - 2, Math.ceil(reach) + 1);
        for (let d = 0; d <= n; d++) GLOW_LUT[d] = s * (1.15 * Math.exp(-Math.max(0, d - o.core) / k1) + 0.7 * Math.exp(-d / k2) + 0.34 * Math.exp(-d / k3)) * (1 - ss(reach * 0.55, reach, d));
        const sun = pack(RP.SUN), top = RP.SUN.rgb.length - 1, white = sun.c[top], W = cur.W, H = cur.H, buf = cur.buf;
        for (let y = Math.max(0, Math.floor(ly - reach)); y < Math.min(H, Math.ceil(ly + reach)); y++) {
            const dy = (y + 0.5 - ly) * 1.06, ady = Math.abs(dy), row = y * W;
            for (let x = Math.max(0, Math.floor(lx - reach)); x < Math.min(W, Math.ceil(lx + reach)); x++) {
                const dx = x + 0.5 - lx, d = Math.sqrt(dx * dx + dy * dy);
                if (d >= reach) continue;
                const i = row + x;
                if (d < o.core) { buf[i] = white; continue; }
                const di = d | 0, f = d - di, fade = 1 - ss(reach * 0.55, reach, d), adx = Math.abs(dx);
                let v = GLOW_LUT[di] + (GLOW_LUT[di + 1] - GLOW_LUT[di]) * f;
                if (ady < 0.6) v += 0.34 * s * Math.exp(-adx / k4) * fade;                                // the streak across
                if (o.spikes && (adx < 0.6 || ady < 0.6)) v += 0.7 * Math.exp(-d / o.spikes) * fade;    // the four spikes
                if (v < 0.004) continue;
                const pos = (v > 1 ? 1 : v) * top, lo = pos | 0, k = pos - lo > threshold(x, y) ? lo + 1 : lo;
                if (k && sun.l[k] > lum32(buf[i])) buf[i] = sun.c[k];
            }
        }
    }
    /** Deep in, a warm bloom that fills the window (the corridor's sector 6 bloom). */
    const BLOOM_LUT = new Float32Array(2048);
    function bloomPass(vw) {
        const W = cur.W, H = cur.H, buf = cur.buf, R = H * (0.3 + 0.9 * vw.bloom), sun = pack(RP.SUN), top = RP.SUN.rgb.length - 1;
        for (let d = 0; d < BLOOM_LUT.length; d++) BLOOM_LUT[d] = vw.bloom * Math.exp(-d / R);
        for (let y = 0; y < H; y++) {
            const dy2 = ((y - vw.ly) * 1.1) ** 2, row = y * W;
            for (let x = 0; x < W; x++) {
                const a = BLOOM_LUT[Math.min(2047, Math.sqrt((x - vw.lx) * (x - vw.lx) + dy2) | 0)];
                if (a < 0.04) continue;
                const pos = Math.min(1, a) * top, lo = pos | 0, k = pos - lo > threshold(x, y) ? lo + 1 : lo;
                if (k && sun.l[k] > lum32(buf[row + x])) buf[row + x] = sun.c[k];
            }
        }
    }
    /** Dust streaming past toward us from the light (the vanishing point), lit warm near it; faster the deeper in. */
    function drawDust(scene, vw, s) {
        if (vw.fadeDust <= 0.02) return;
        const dust = scene.dust, F = scene.H * 0.14, tail = 0.05 + 0.2 * Math.min(1, s), reach = vw.L.halo * 1.6 + 24, n = Math.round(dust.length * vw.fadeDust);
        for (let i = 0; i < n; i++) {
            const m = dust[i], ax = vw.lx + m.x / m.z * F, ay = vw.ly + m.y / m.z * F, bz = m.z + tail, bx = vw.lx + m.x / bz * F, by = vw.ly + m.y / bz * F;
            if (ax < -20 || ay < -20 || ax > scene.W + 20 || ay > scene.H + 20) { dust[i] = newMote(scene, true); continue; }
            const near = clamp01((2.4 - m.z) / 2.2), lit = Math.exp(-Math.hypot(ax - vw.lx, ay - vw.ly) / reach), tone = 0.25 + 0.6 * near;
            streak(ax, ay, bx, by, lit > 0.35 ? RP.SUN : RP.STAR, tone * (lit > 0.35 ? 0.6 + 0.5 * lit : 1), tone * 0.35);
        }
    }
    /** An alarm: the window's edges flash emergency red, a thin dithered band (the corridor's scrape flash, quieter). */
    function alarmEdges(s) {
        const W = cur.W, H = cur.H, red = pack(RP.RED), depth = 4 + 3 * Math.min(1, s);
        for (let y = 0; y < H; y++) {
            const ey = Math.min(y, H - 1 - y);
            for (let x = 0; x < W; x++) {
                const e = Math.min(x, W - 1 - x, ey);
                if (e >= depth) { if (ey >= depth) x = Math.max(x, W - 1 - Math.ceil(depth)); continue; }
                const a = 0.42 * (1 - e / depth);
                if (a > threshold(x, y)) cur.buf[y * W + x] = red.c[P.level(RP.RED, 0.35 + 0.35 * a, x, y)];
            }
        }
    }
    /** Under the words the picture darkens with the grain, so they read even inside the light. Boxes in art px. */
    function shadeBuf(words) {
        (words || []).forEach(([x0, y0, x1, y1]) => {
            x0 -= SHADE_PAD; y0 -= SHADE_PAD; x1 += SHADE_PAD; y1 += SHADE_PAD;
            for (let y = Math.max(0, y0); y < Math.min(cur.H, y1); y++) for (let x = Math.max(0, x0); x < Math.min(cur.W, x1); x++) {
                const e = Math.min(x - x0, x1 - 1 - x, y - y0, y1 - 1 - y) / SHADE_PAD, lum = lum32(cur.buf[y * cur.W + x]) / 255;
                if (lum > 0.26) mixPx(x, y, INK_RGB, Math.min(0.86, (lum - 0.26) * 1.9) * ss(0, 1, e), 6);
            }
        });
    }
    function whitenBuf(a) {
        if (a <= 0) return;
        if (a >= 1) { cur.buf.fill(WHITE32); return; }
        for (let y = 0; y < cur.H; y++) for (let x = 0; x < cur.W; x++) mixPx(x, y, WHITE, a, WHITE_STEPS);
    }
    /** The ship's alarm word beside the decks, blinking red. */
    function alarmWord(ctx, scene, label) {
        ctx.fillStyle = RP.RED.hex[3];
        P.pixelText(label, Math.round(scene.shipL.cx + scene.shipL.D + 10), scene.H - 26, (x, y) => ctx.fillRect(x, y, 1, 1));
    }
    function drawEden(ctx, scene, v, ms) {
        const E = scene.eden, k = ss(0, 1, clamp01(v.edenK || 0)), cx = Math.round(scene.W * 0.66 + (1 - k) * scene.W * 0.75), cy = Math.round(scene.H * 0.52);
        ctx.drawImage(E.canvas, cx - E.half, cy - E.half);
        const W = window.NSWorlds;
        if (W && typeof W.live === 'function' && k > 0.99) {
            try { W.live(P.framer(ctx, scene.W, scene.H), E.node || null, cx, cy, E.r, ms, { L: E.L, sector: 6, type: 'EDEN', seed: 41 }); } catch (err) { /* the still picture is enough */ }
        }
    }

    /** One frame of the approach, the white or the turn (see v at the top of this file). */
    function draw(ctx, scene, v, ms) {
        const W = scene.W, H = scene.H, B = scene.back, vw = view(scene, v), bx = vw.lx - B.LP[0], by = vw.ly - B.LP[1];
        ctx.fillStyle = INK; ctx.fillRect(0, 0, W, H);
        ctx.drawImage(B.canvas, bx, by);
        ctx.save(); ctx.translate(bx, by);                                          // the sky's slow motion and its twinkle, fixed to it
        if (B.sky && B.sky.live) { try { B.sky.live(ctx, ms, 0); } catch (err) { /* the still sky is enough */ } }
        P.twinkle(P.framer(ctx, B.BW, B.BH), B.stars, ms);
        ctx.restore();
        if (v.phase === 'turn' && scene.eden) drawEden(ctx, scene, v, ms);
        ctx.drawImage(scene.shade, 0, 0);
        SHIP.draw(ctx, scene.shipL, ms, { damaged: v.flash ? (v.damaged || {}) : {}, labels: false, plume: v.plume == null ? 0.5 : v.plume });
        const img = ctx.getImageData(0, 0, W, H);
        cur = { buf: new Uint32Array(img.data.buffer), W, H };
        const white = clamp01(v.white || 0);
        if (white < 1) {                                                            // once all is white, nothing under it needs painting
            paintLight(vw.lx, vw.ly, vw.L, 1 + 0.05 * Math.sin((v.clock || 0) * 1.7));
            if (vw.bloom > 0.01) bloomPass(vw);
            drawDust(scene, vw, v.s);
        }
        if (v.edges && v.flash) alarmEdges(v.s);
        shadeBuf(v.words);
        whitenBuf(white);
        ctx.putImageData(img, 0, 0);
        if (v.label && v.flash && white < 0.5) alarmWord(ctx, scene, v.label);
    }

    /** On a frame already drawn: darken under words / whiten by a. One getImageData each. */
    function onFrame(ctx, W, H, fn) {
        const img = ctx.getImageData(0, 0, W, H);
        cur = { buf: new Uint32Array(img.data.buffer), W, H };
        fn();
        ctx.putImageData(img, 0, 0);
    }
    const shade = (ctx, W, H, words) => { if (words && words.length) onFrame(ctx, W, H, () => shadeBuf(words)); };
    const white = (ctx, W, H, a) => { if (a > 0) onFrame(ctx, W, H, () => whitenBuf(a)); };
    /** On a day sky or a pale one, a box of shade under words reads as a panel; instead the sky darkens toward the top left,
        where the words sit, like dusk at the edge of the sky (eden-walk-art.js's veil): ink in fine dithered steps. Cached. */
    const veils = new Map(), VEIL_STEPS = 7;
    function veil(W, H) {
        const key = W + 'x' + H;
        if (veils.has(key)) return veils.get(key);
        const c = document.createElement('canvas'); c.width = W; c.height = H;
        const g = c.getContext('2d'), img = g.createImageData(W, H), d = img.data;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const s = 0.86 * (1 - ss(0.42, 1, Math.hypot(x / W / 0.75, y / H / 0.6))), a = Math.min(1, Math.floor(s * VEIL_STEPS + threshold(x, y)) / VEIL_STEPS), i = (y * W + x) * 4;
            d[i] = INK_RGB[0]; d[i + 1] = INK_RGB[1]; d[i + 2] = INK_RGB[2]; d[i + 3] = Math.round(a * 255);
        }
        g.putImageData(img, 0, 0);
        if (veils.size > 4) veils.clear();
        veils.set(key, c);
        return c;
    }
    /** The whole frame toward the ink by a, in dithered steps: a dim that never turns into a screen door on a pale picture. */
    const darken = (ctx, W, H, a) => {
        if (a <= 0) return;
        onFrame(ctx, W, H, () => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) mixPx(x, y, INK_RGB, a, 6); });
    };

    window.NSLightArt = Object.freeze({ create, tick, draw, eden, shade, white, darken, veil, lightOf, WHITE: '#fff3dc' });
})();
