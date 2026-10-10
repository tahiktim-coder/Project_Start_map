/* ═══ Silent Exodus · new screen (?new=1) · art/Sky.js: the far sky, part 1 ════════════════════════════════════════
   What it is: the far sky behind the haze, the dust and the stars of the travel view. It moves far slower than they do,
   so the stars carry the motion and the sky gives the depth. The approved sky is F ("places"), painted by Sky2.js; this
   file keeps the shared pieces (the galaxy, the vast planet, the nebula wash) and paintSpace, which lays the far sky
   behind v1's haze and dust.
   Source: prototypes/screens/game-screen-v3/sky.js. Changes: V3Sky is now NSSky; the ?sky= read is gone and the mode is
   fixed to 'f', so build() only hands over to NSSky2 (the A, B, C and "none" skies are not ported).
   House style: docs/ART_STYLE.md. Load after Paint.js, before Sky2.js.

   window.NSSky (frozen)
     mode                    'f'
     DEEP, THING             px of far sky per px of flight (the sky and the enormous thing slide this much slower)
     build(W, H, ox, oy, n, light)   the sky for sector n at this screen size: NSSky2.build(..., n, light, 'f').
                             ox, oy: where the 640 x 360 stage sits on the canvas; light: [x, y] in stage px.
                             → { mode, B, extra, haze, thing, stripStars, live(ctx, t, D), tint(x, y) }
     paintSpace(p, strip, off, lit, keepAway, sky, offD) → bright stars   the strip of space over the far sky; offD: how far
                             the far sky has slid (px)
     parts                   { R, REACH_D, lumOf, galaxy, nebula, vastPlanet } for Sky2.js
*/
(function () {
    'use strict';
    const P = window.NSPaint;
    const { INK, ramp, level, fbm, vnoise, hash, seeded, clamp01, smooth, hexRgb, norm3 } = P;

    const MODE = 'f';                                                   // the approved sky: places (sky2.js), always

    const DEEP = 0.005, THING = 0.012, REACH_D = 10000;                // px of sky per px of flight; the farthest a sector runs
    const R = {
        BAND: ramp(INK, '#090c11', '#0e131b', '#151c26', '#202a36', '#33404e'),        // the galaxy's disc: cold, barely there
        GAL: ramp(INK, '#0b0f15', '#141b25', '#212b37', '#36424f', '#5d6a76', '#9aa6ad'),
        OLD: ramp(INK, '#0d0d10', '#19181b', '#2a2828', '#433e3a', '#6c6459', '#a39783'),   // ellipticals: old dusty light
        TEAL: ramp(INK, '#061114', '#0a1a1e', '#0f252a', '#153237', '#1e4146', '#2c565b'),
        RUST: ramp(INK, '#130c09', '#21150d', '#352112', '#4e3119', '#6d4522', '#91602f'),
        ICE: ramp(INK, '#0b151b', '#132330', '#1f3546', '#33506a', '#5a7c95', '#9cbacb'),
        LIMB: ramp(INK, '#0a1015', '#121d26', '#1d2e3b', '#2e4658', '#4f6e84', '#8fb0c2'),
        NIGHT: ramp(INK, '#07090d', '#0a0d12', '#0e1218'),
        STAR: P.RP.STAR,
    };
    const lumOf = rgb => (rgb[0] * 77 + rgb[1] * 150 + rgb[2] * 29) >> 8;

    // ── a galaxy: an inclined disc with a bulge and log-spiral arms, or (arms 0) a smooth elliptical ──
    function galaxy(B, g) {
        const { x: gx, y: gy, r, tilt, incl, arms, wind = 2.2, bright, seed = 1, fall = 0.42, bulgeW = 1 } = g, ct = Math.cos(tilt), st = Math.sin(tilt);
        const ext = Math.ceil(r * 1.35) + 2, rp = g.ramp || (arms ? R.GAL : R.OLD);
        for (let y = Math.floor(gy - ext); y <= gy + ext; y++) for (let x = Math.floor(gx - ext); x <= gx + ext; x++) {
            const dx = x + 0.5 - gx, dy = y + 0.5 - gy, u = dx * ct + dy * st, w = (-dx * st + dy * ct) / incl;
            const rr = Math.hypot(u, w) / r; if (rr > 1.35) continue;
            let v;
            if (!arms) v = bright * (Math.exp(-rr * 3.6) * 1.1 + 0.05 * (1 - rr / 1.35)) * (0.9 + 0.2 * vnoise(x / 3, y / 3, seed));
            else {
                const th = Math.atan2(w, u), sp = th - wind * Math.log(rr + 0.06);
                let arm = Math.pow(0.5 + 0.5 * Math.cos(arms * sp), 2.2);
                const grain = Math.max(3.5, Math.min(r * 0.18, 9));                              // arm texture: knots and gaps, never smoother than a few px
                arm *= 0.45 + 1.1 * fbm(u / grain + 9, w / grain, seed, 3);
                const bulge = Math.exp(-((rr / 0.15) ** 2)), disc = Math.exp(-rr / fall) * (0.3 + 1.05 * arm);
                v = bright * (bulgeW * bulge + 1.15 * disc) * smooth(1.35, 0.85, rr);
                if (incl < 0.5) {                                                      // edge-on enough: a dark lane on the near side
                    const lane = Math.exp(-((((w * incl) / r - 0.05) / 0.035) ** 2)) * smooth(1.0, 0.25, rr);
                    v *= 1 - 0.75 * lane;
                }
            }
            B.put(x, y, rp, v);
        }
    }
    // ── nebula: broad bands out of warped noise; rust-gold where the light reaches it, teal-black far off, ice in the wisps;
    //    dark lanes of dust across it that also swallow the faint stars ──
    function nebula(B, o) {
        const { seed, ang, lx, ly, gain, reachL, w0, w1 } = o, ca = Math.cos(ang), sa = Math.sin(ang);
        for (let y = 0; y < B.H; y++) for (let x = 0; x < B.W; x++) {
            const u = x * ca + y * sa, w = -x * sa + y * ca;
            const wx = fbm(u / 230, w / 140, seed + 3, 3) - 0.5, wy = fbm(u / 230 + 5.2, w / 140 + 1.3, seed + 4, 3) - 0.5;
            const ww = w + wy * 90;                                                        // the cloud's own wander
            const env = Math.exp(-(((ww - w0) / 118) ** 2)) + 0.95 * Math.exp(-(((ww - w1) / 64) ** 2));
            if (env < 0.03) continue;
            const n = fbm(u / 118 + 2.6 * wx, w / 64 + 2.6 * wy, seed, 5);
            const dens = env * Math.pow(clamp01((n - 0.34) / 0.5), 1.6);
            const fil = Math.pow(1 - Math.abs(2 * fbm(u / 46 + 3 * wx, w / 22 + 3 * wy, seed + 11, 4) - 1), 9) * env * smooth(0.05, 0.3, dens);
            const laneN = 1 - Math.abs(2 * fbm(u / 90 + 2 * wy, w / 30 + 2 * wx, seed + 29, 3) - 1);
            const lane = smooth(0.8, 0.97, laneN) * Math.min(1, env * 1.6);
            const near = Math.exp(-Math.hypot(x - lx, (y - ly) * 1.25) / reachL);       // how much the false light reaches it
            const dim = 1 - 0.82 * lane;
            B.shade(x, y, lane * 1.15);
            B.put(x, y, R.TEAL, gain * dens * 0.95 * dim);
            B.put(x, y, R.RUST, gain * dens * near * 2.0 * dim);
            B.put(x, y, R.ICE, gain * fil * 0.42 * dim * (1 - near));
        }
    }

    // ── sector 1, the deep: the night side of a vast planet across the top-left corner; only a thin lit limb and a breath of
    //    atmosphere show. It hides everything behind it (the stars too), which is what makes it read as enormous ──
    function vastPlanet(W, H, o) {
        const { cx, cy, Rr, lx, ly, seed } = o, buf = new Uint8ClampedArray(W * H * 4), ink = hexRgb(INK);
        const L = norm3(lx - cx, ly - cy, -1.9 * Math.hypot(lx - cx, ly - cy));     // the light is far behind it: a hair-thin crescent
        const set = (x, y, c) => { const i = (y * W + x) * 4; buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = 255; };
        const atm = 3.2;
        const yMax = Math.min(H, Math.ceil(cy + Rr + atm + 1)), xMax = Math.min(W, Math.ceil(cx + Rr + atm + 1));
        for (let y = 0; y < yMax; y++) for (let x = 0; x < xMax; x++) {
            const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy);
            if (d > Rr + atm) continue;
            const nx = dx / d, ny = dy / d;
            if (d >= Rr) {                                                              // the atmosphere: a hair of cold light on the lit side
                const facing = nx * L[0] + ny * L[1];
                if (facing <= 0.15) continue;
                const v = (1 - (d - Rr) / atm) * facing * 0.5 * (0.6 + 0.8 * fbm(Math.atan2(dy, dx) * 160, 2.5, seed + 9, 3));
                const k = level(R.ICE, v, x, y); if (k > 0) set(x, y, R.ICE.rgb[k]);
                continue;
            }
            const q = d / Rr, nz = Math.sqrt(Math.max(0, 1 - q * q)), lam = nx * Math.sqrt(1 - nz * nz) * L[0] + ny * Math.sqrt(1 - nz * nz) * L[1] + nz * L[2];
            const lat = (dx * 0.34 + dy * 0.94);                                         // cloud belts, tilted
            const belts = 0.5 + 0.5 * Math.sin(lat / 23 + 3 * fbm(dx / 160, dy / 60, seed, 3)) , grain = fbm(dx / 40, dy / 14, seed + 4, 3);
            let c = ink;
            if (lam > 0) {
                const along = fbm(Math.atan2(dy, dx) * 160, 2.5, seed + 9, 3);                  // the limb catches the light unevenly: cloud tops, haze
                const v = (Math.pow(lam / 0.47, 1.7) * 0.6 + (d > Rr - 1.3 ? 0.12 : 0)) * (0.55 + 0.3 * belts + 0.45 * along) * (0.85 + 0.3 * grain);
                const k = level(R.LIMB, v, x, y); if (k > 0) c = R.LIMB.rgb[k];
            }
            if (c === ink) {                                                            // the night side: banded, only just there
                const v = (0.1 + 0.22 * belts * grain) * smooth(0, 0.35, nz) ;
                const k = level(R.NIGHT, v, x, y); if (k > 0) c = R.NIGHT.rgb[k];
            }
            set(x, y, c);
        }
        const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
        canvas.getContext('2d').putImageData(new ImageData(buf, W, H), 0, 0);
        const shift = D => Math.min(W - 1, Math.round(D * THING));
        return { canvas, speed: THING, covers: (x, y, D) => { const xx = Math.round(x) + shift(D), yy = Math.round(y); return xx >= 0 && yy >= 0 && xx < W && yy < H && buf[(yy * W + xx) * 4 + 3] > 0; } };
    }

    /** The sky for one sector at one screen size. ox, oy: where the 640 x 360 stage sits on the canvas; light: stage px.
        Always sky F (places): NSSky2.build(W, H, ox, oy, n, light, 'f'). The 7th argument is accepted and ignored. */
    function build(W, H, ox, oy, n, light) {
        return window.NSSky2 ? window.NSSky2.build(W, H, ox, oy, n, light, MODE) : null;
    }

    /** v1's paintSpace with the far sky behind the haze: at each pixel the brighter of haze and sky shows; dust near the light
        stays on top; faint stars drown in the dark lanes. offD: how far the far sky has slid (px). */
    function paintSpace(p, strip, off, lit, keepAway, sky, offD) {
        const RP = P.RP, dustR = RP.DUST.rgb, hazeR = RP.HAZE.rgb, ink = hexRgb(INK), B = sky.B, hazeL = hazeR.map(lumOf);
        offD = Math.max(0, Math.min(sky.extra - 1, offD));
        const D = p.data, Brgb = B.rgb;
        for (let y = 0; y < p.H; y++) for (let x = 0; x < p.W; x++) {
            const sx = x + off, o = (y * p.W + x) * 4, bi = y * B.W + x + offD;
            let rgb = null, l = 0;
            if (y < B.H && x + offD < B.W) l = B.lum[bi];
            if (sx >= 0 && sx < strip.W && y < strip.H) {
                const i = y * strip.W + sx, vd = strip.dust[i] * 2.8 * lit[y * p.W + x], vh = strip.haze[i];
                if (vd > 0.12 && vd * 0.75 > vh) rgb = dustR[level(RP.DUST, vd, x, y)];
                else if (vh > 0.03) { const k = level(RP.HAZE, vh, x, y); if (hazeL[k] > l) rgb = hazeR[k]; }
            }
            if (rgb) { D[o] = rgb[0]; D[o + 1] = rgb[1]; D[o + 2] = rgb[2]; }
            else if (l > 0) { D[o] = Brgb[bi * 3]; D[o + 1] = Brgb[bi * 3 + 1]; D[o + 2] = Brgb[bi * 3 + 2]; }
            else { D[o] = ink[0]; D[o + 1] = ink[1]; D[o + 2] = ink[2]; }
            D[o + 3] = 255;
        }
        const bright = [], keepN = sky.stripStars == null ? 1 : sky.stripStars;
        strip.stars.forEach(s => {
            const x = s.x - off, y = s.y; if (x < -2 || x > p.W + 2 || (keepAway && keepAway(x, y))) return;
            if (keepN < 1 && s.mag < 0.87 && hash(s.x, s.y, 77) > keepN) return;          // round two's skies bring their own faint stars
            const e = (x >= 0 && x < p.W && y >= 0 && y < B.H) ? B.ext[y * B.W + x + offD] / 255 : 0;
            if (e > 0.85 || (e > 0.4 && s.mag < 0.87 + 0.1 * e)) return;                // the dark lanes swallow all but the brightest
            const SR = sky.tint ? sky.tint(s.x, s.y) : RP.STAR;                          // round two: some stars warm, some cold
            if (s.mag > 0.978) { p.set(x, y, SR.rgb[4]); [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dx, dy]) => p.set(x + dx, y + dy, SR.rgb[2])); }
            else if (s.mag > 0.87) p.set(x, y, SR.rgb[3]);
            else p.set(x, y, SR.rgb[s.mag > 0.55 ? 2 : 1]);
            if (s.mag > 0.87) bright.push({ x, y, mag: s.mag });
        });
        return bright;
    }

    window.NSSky = Object.freeze({ mode: MODE, DEEP, THING, build, paintSpace,
        parts: Object.freeze({ R, REACH_D, lumOf, galaxy, nebula, vastPlanet }) });          // for Sky2.js
})();
