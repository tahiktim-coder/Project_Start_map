/* ═══ Silent Exodus · layout variant B, "Nose up" · the journey around the ship ═══════════════════════════════════════
   Everything outside the hull: space streaming down, the far light at the top, dust, and the worlds that come down
   past us on either side. All of it is painted with game-screen-v3's own recipes (V3Paint: sphere, surfaceFor,
   lightGlow, the Deep field ramps) and the living ship's star tiles (ShipArt.stars), so the two halves are one picture.

   window.Journey
     WORLDS                          the places on the heading, in the voyage clock (ms, loops every CYCLE)
     CYCLE
     place(w, J, frame)              { cx, cy, r, on } where world w is at journey time J in this frame
     paintWorld(w, frame)            { canvas, rims, pad } painted once per frame size
     lightAt(frame)                  { x, y } the far light, fixed on the screen (it is at infinity)
     drawSpace(ctx, frame, D, cam)   stars and haze, streaming down by the distance flown
     drawLight(ctx, frame)           the light's halo
     drawDust(f, frame, D, speed)    dust streaks, longer the faster we fly
   frame: { W, H, offX, hullL, hullR } in art pixels (hullL / hullR: the hull's outer edges on screen)
*/
(function (root) {
    'use strict';
    const P = root.V3Paint, A = root.ShipArt, RP = P.RP;
    const CYCLE = 180000, PASS = 36000;                 // a world is on screen for PASS ms either side of its closest point

    // Sector 1's worlds (game-screen-v3/data.js: names, seeds, types and lines), now beside the ship instead of ahead.
    const WORLDS = [
        { id: 'titan', name: 'Titan-61 IV', tag: 'Dry world · old ship beacon', type: 'desert', seed: 73, r: 170, side: -1, tuck: 0.62, closest: 42000,
          beacon: [0.34, -0.22], line: 'A dry world. A ship beacon is still running down there.' },
        { id: 'chronos', name: 'Chronos-37 Proxima', tag: 'Ice world', type: 'ice', seed: 80, r: 124, side: 1, tuck: 0.6, closest: 132000,
          line: 'An ice world. Nothing on the scanner.' },
    ];

    const lightAt = fr => ({ x: Math.round(fr.hullR + (fr.W - fr.hullR) * 0.52), y: 30 });

    /** Where a world is: it comes in over the top edge, is closest (level with the middle of the screen) at w.closest,
        and leaves under the bottom edge. A bigger world is nearer, so it slides a little faster. */
    function place(w, J, fr) {
        const dt = ((J - w.closest) % CYCLE + CYCLE * 1.5) % CYCLE - CYCLE / 2;
        const v = (fr.H / 2 + w.r + 24) / PASS;
        const cx = w.side < 0 ? fr.hullL - w.r * w.tuck : fr.hullR + w.r * w.tuck;
        const cy = fr.H / 2 + dt * v;
        return { cx: Math.round(cx), cy: Math.round(cy), r: w.r, dt, on: cy + w.r > -4 && cy - w.r < fr.H + 4 };
    }

    // ── a world, painted once: v1's sphere and surfaces, lit from the far light ─────────────────────────────────
    const painted = new Map();
    function paintWorld(w, fr) {
        const key = w.id + ':' + fr.W + 'x' + fr.H;
        if (painted.has(key)) return painted.get(key);
        const pad = 6, S = w.r * 2 + pad * 2, p = P.painter(S, S, false), rims = [];
        // the light is far ahead and above: every world is lit from the top, a little from the light's side, and
        // mostly on the face we see (the side toward the hull would be hidden behind it)
        const L = P.norm3(w.side < 0 ? 0.34 : 0.1, -0.5, 0.8);
        const ramp = P.PLANET_RAMP[w.type], base = P.surfaceFor(w.type, w.seed, L);
        // v1's surfaces were drawn for small worlds; this close, they get a finer grain on top so they do not read as a smudge
        const surface = (v, nx, ny, nz, lam) => base(v, nx, ny, nz, lam) * (0.84 + 0.3 * P.fbm(nx * 11 + 3, ny * 11, w.seed + 9, 3)) - 0.05 * P.smooth(0.56, 0.64, P.fbm(nx * 26, ny * 26, w.seed + 5, 2));
        P.sphere(p, { cx: S / 2, cy: S / 2, r: w.r, L, ramp, surface, rim: 0.55, rimRamp: w.type === 'ice' ? RP.ICE : RP.SUN,
            ambient: 0.02, gain: 0.86, rims, atmo: w.type === 'ice' ? { w: 4, ramp: RP.ICE } : { w: 3, ramp: RP.DUST } });
        const out = { canvas: p.canvas(), rims, pad, S };
        painted.set(key, out);
        return out;
    }

    // ── far off: v3's little grey rock (sector 1 scenery), so the right side never sits still ──────────────────
    let farRock = null;
    function drawFar(ctx, fr, D) {
        if (!farRock) {
            const r = 9, p = P.painter(r * 2 + 4, r * 2 + 4, false), L = P.norm3(0.2, -0.6, 0.75);
            P.sphere(p, { cx: r + 2, cy: r + 2, r, L, ramp: RP.STONE, surface: P.surfaceFor('rock', 404, L), ambient: 0.02, gain: 0.8 });
            farRock = p.canvas();
        }
        const span = fr.H + 60, y = ((D * 0.0042 + span * 0.12) % span) - 30, x = Math.round(fr.hullR + (fr.W - fr.hullR) * 0.3);
        ctx.drawImage(farRock, x - 11, Math.round(y) - 11);
    }

    // ── space: the living ship's star tiles, streaming down as we fly ───────────────────────────────────────────
    function drawSpace(ctx, fr, D, cam) {
        [[0, 0.004, 0.08, 0], [1, 0.014, 0.2, 137]].forEach(([layer, speed, par, ox]) => {
            const T = A.stars(layer), n = T.size, oy = ((Math.round(D * speed - cam * par) % n) + n) % n;
            for (let y = oy - n; y < fr.H; y += n) for (let x = -(ox % n); x < fr.W; x += n) ctx.drawImage(T.canvas, x, y);
        });
    }

    // ── the light: v3's false sun (core, halo, spikes), small and far, fixed at the top ──────────────────────────
    let glow = null;
    function drawLight(ctx, fr) {
        const o = { core: 3, halo: 22, strength: 1.05, spikes: 9 }, reach = Math.ceil(o.halo * 3.2 + o.core + 8);
        if (!glow) {
            const p = P.painter(reach * 2, reach * 2, false);
            P.lightGlow(p, reach, reach, o);
            glow = p.canvas();
        }
        const li = lightAt(fr);
        ctx.drawImage(glow, li.x - reach, li.y - reach);
    }

    // ── dust: rust-gold specks, lit where the light reaches, streaming down past the hull ────────────────────────
    const DUST_N = 120;
    function drawDust(f, fr, D, speed) {
        const li = lightAt(fr), span = fr.H + 40;
        for (let i = 0; i < DUST_N; i++) {
            const near = P.hash(i, 3, 21), sp = 0.035 + 0.09 * near;                               // nearer specks fall faster
            const x = Math.floor(P.hash(i, 1, 21) * fr.W + P.hash(i, 7, 21) * 255) % fr.W;
            if (x > fr.hullL + 2 && x < fr.hullR - 2) continue;                                    // the hull hides them anyway
            const y = ((P.hash(i, 2, 21) * span + D * sp) % span) - 20;
            if (fr.discs && fr.discs.some(d => Math.hypot(x - d[0], y - d[1]) < d[2] + 2)) continue;     // dark specks on a lit world read as holes
            const lit = 0.6 + 0.7 * Math.exp(-Math.hypot(x - li.x, y - li.y) / 240);
            const v = (0.3 + 0.42 * near) * lit, len = Math.max(1, Math.round(sp * speed * 52));
            for (let k = 0; k < len; k++) f.tone(x, y - k, RP.DUST, v * (1 - k / (len + 1)));
        }
    }

    root.Journey = Object.freeze({ WORLDS, CYCLE, PASS, place, paintWorld, lightAt, drawSpace, drawLight, drawDust, drawFar });
})(typeof window !== 'undefined' ? window : globalThis);
