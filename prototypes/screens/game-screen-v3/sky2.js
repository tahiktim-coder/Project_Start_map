/* Silent Exodus game screen v3: the far sky, round two (2026-10-09). The designer liked the sky with more space in it (C)
   and asked for space "a bit more interesting and spacy". Three more skies, chosen in sky.js with ?sky=:
     ?sky=d  star river: the galaxy's band as a river of faint stars with dark rifts and a warm core, star clouds and empty
             holes, some stars warm and some cold, a cluster or two, galaxies of several shapes. No gas, nothing moves.
     ?sky=e  gas and dust: D's stars, thinner, under one structured cloud per sector (see RECIPES).
     ?sky=f  places: D and E quieter, far moons at other depths, the sector's one enormous thing, and slow motion (a pulsar's
             beam, a comet, tumbling fragments that glint, a rare far flash). Each sector is its own place:
               1 the graveyard   a vast planet's night side, wreck fragments glinting, an old shell of gas
               2 the dark void   dark clouds eating the galaxy's band, a huge faint spiral, almost nothing else
               3 the signal      a supernova shell with the pulsar that made it, sweeping its beam; far flashes
               4 the garden      pillars of dust lit on the side toward the light, a young cluster, a comet
               5 the tally       a ring nebula like an eye, a globular cluster, a lensed galaxy, twin moons
               6 the light       a vast ring of lit dust around the light, dust streaming into it, comets falling in
   House style (docs/ART_STYLE.md): ramps that start at the ink, 8 x 8 Bayer dither, seeded noise, no gradients or blur.
   Everything stays dim (rarely above the middle of its ramp) so the worlds, our ship and the words always win.
     window.V3Sky2 = { build(W, H, ox, oy, n, light, mode), RECIPES } */
(function () {
    'use strict';
    const P = window.V3Paint, SKY = window.V3Sky, SK = SKY && SKY.parts;
    if (!SK) return;
    const { INK, ramp, level, fbm, seeded, clamp01, smooth, norm3, RP } = P;
    const { R, galaxy, vastPlanet, lumOf, REACH_D } = SK;

    const C = {
        STAR: RP.STAR,
        WARM: ramp(INK, '#2a1f14', '#6a4b2c', '#b48650', '#efcf9c'),          // old suns: gold
        COLD: ramp(INK, '#141f29', '#355468', '#7fa5bc', '#d6e9f2'),          // young suns: ice
        RED: ramp(INK, '#27130f', '#56271b', '#965034', '#d39068'),           // a few red giants, dusty, never neon
        CORE: ramp(INK, '#0d0b0a', '#181411', '#251e18', '#372a20', '#4e3b2a', '#6c5139'),   // the galaxy's old warm core
        MOSS: ramp(INK, '#08100d', '#0c1813', '#12221a', '#1a3024', '#264131', '#365641'),   // the garden's gas
        EMBER: ramp(INK, '#170d09', '#2e170d', '#4a2515', '#6e381d', '#9a5328', '#c67c42'),  // dust lit by the light
        BEAM: ramp(INK, '#0c1820', '#16293a', '#25425a', '#3f6684', '#7aa2bf'),
        FAR: ramp(INK, '#0d1114', '#1a2025', '#2b333a', '#48525a', '#6f7a82'),
        BAND: R.BAND, TEAL: R.TEAL, RUST: R.RUST, ICE: R.ICE, NIGHT: R.NIGHT, GAL: R.GAL, OLD: R.OLD,
    };

    /** A hash that does not repeat across the sky (P.hash repeats every 256 px, which shows in a star field). */
    function h32(x, y, s) {
        let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul((s | 0) + 1, 0x9e3779b1);
        h = Math.imul(h ^ (h >>> 15), 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35); h ^= h >>> 16;
        return (h >>> 0) / 4294967296;
    }

    /** sky.js's buffer, plus solid(): a far body or a pillar paints over what is behind it and nothing later lands on it. */
    function sbuf(W, H) {
        const rgb = new Uint8ClampedArray(W * H * 3), lum = new Uint8Array(W * H), ext = new Uint8Array(W * H), block = new Uint8Array(W * H);
        const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? -1 : y * W + x);
        const write = (i, c, force) => { const l = lumOf(c); if (!force && l <= lum[i]) return; lum[i] = l; rgb[i * 3] = c[0]; rgb[i * 3 + 1] = c[1]; rgb[i * 3 + 2] = c[2]; };
        const put = (x, y, r, v) => { x = Math.floor(x); y = Math.floor(y); const i = at(x, y); if (i < 0 || block[i]) return; const k = level(r, v, x, y); if (k) write(i, r.rgb[k]); };
        const shade = (x, y, a) => { const i = at(Math.floor(x), Math.floor(y)); if (i >= 0) ext[i] = Math.max(ext[i], Math.round(clamp01(a) * 255)); };
        const solid = (x, y, r, v) => {
            x = Math.floor(x); y = Math.floor(y); const i = at(x, y); if (i < 0) return;
            const k = level(r, v, x, y); block[i] = 1; ext[i] = 255;
            if (k) write(i, r.rgb[k], true); else lum[i] = 0;
        };
        const region = (x0, y0, x1, y1, fn) => { for (let y = Math.max(0, Math.floor(y0)); y < Math.min(H, Math.ceil(y1)); y++) for (let x = Math.max(0, Math.floor(x0)); x < Math.min(W, Math.ceil(x1)); x++) fn(x, y); };
        return { W, H, rgb, lum, ext, block, put, shade, solid, region };
    }
    const starRamp = (mix, h) => (h < mix[0] ? C.WARM : h < mix[0] + mix[1] ? C.COLD : h < mix[0] + mix[1] + mix[2] ? C.RED : C.STAR);

    // ═══ the stars: the galaxy's band as a river of stars, star clouds and holes everywhere, warm and cold suns ═══
    function field(X, o, k) {
        const { B, seed } = X, bd = o.band, mix = o.mix, hole = X.hole;
        const ca = bd ? Math.cos(bd.ang) : 0, sa = bd ? Math.sin(bd.ang) : 0, bcx = bd ? X.sx(bd.cx) : 0, bcy = bd ? X.sy(bd.cy) : 0;
        for (let y = 0; y < B.H; y++) for (let x = 0; x < B.W; x++) {
            const hl = hole ? hole(x, y) : 0;
            let rift = 0, inBand = 0;
            if (bd) {
                const dx = x - bcx, dy = y - bcy, u = dx * ca + dy * sa, w = -dx * sa + dy * ca + (fbm(u / 170, 3.1, seed + 5, 3) - 0.5) * 80;
                const glow = Math.exp(-((w / bd.wide) ** 2)), inner = Math.exp(-((w / bd.core) ** 2));
                if (glow > 0.015) {
                    const clump = fbm(u / 60, w / 26, seed, 4), fine = fbm(u / 9, w / 6, seed + 9, 2);
                    const ridge = 1 - Math.abs(2 * fbm(u / 64 + 1.3 * fbm(u / 120, w / 40, seed + 31, 2), w / 8, seed + 21, 4) - 1);
                    const lanes = smooth(0.86, 0.97, ridge) * Math.min(1, glow * 1.5);                 // thin dust filaments along the band
                    const riftW = w - bd.core * 0.2 - (fbm(u / 80, 1.7, seed + 13, 3) - 0.5) * bd.core * 1.2;
                    const main = Math.exp(-((riftW / (bd.core * 0.3)) ** 2)) * smooth(0.3, 0.6, fbm(u / 44, riftW / 8, seed + 23, 3));
                    const flecks = smooth(0.64, 0.78, fbm(u / 16, w / 7, seed + 27, 3)) * inner * 0.7;   // small dark knots in the bright core
                    rift = clamp01(Math.max(main * 1.05, lanes * 0.9, flecks) + hl);
                    const v = bd.peak * k * (0.4 * glow + 0.75 * inner) * (0.5 + 0.85 * clump) * (0.85 + 0.3 * fine) * (1 - 0.94 * rift);
                    B.put(x, y, C.BAND, v);
                    if (bd.bulge) {
                        const bul = Math.exp(-(((u - bd.bulge[0]) / bd.bulge[1]) ** 2)) * Math.exp(-((w / (bd.core * 1.8)) ** 2));
                        if (bul > 0.02) B.put(x, y, C.CORE, bd.peak * k * 1.1 * bul * (0.5 + 0.8 * clump) * (1 - 0.9 * rift));
                    }
                    B.shade(x, y, rift * (0.35 + inner) * 1.2);
                    inBand = (0.8 * glow + 2.6 * inner) * (0.3 + clump) * (1 - rift) * (1 - hl);
                }
            }
            if (hl > 0.02) B.shade(x, y, hl * 1.4);
            const cloud = fbm(x / 70, y / 70, seed + 40, 3), dens = o.density * (0.2 + 1.6 * cloud * cloud) * (1 - rift) * (1 - hl) * k;
            const h = h32(x, y, seed), pBand = o.bandStars * inBand * 0.045 * k;              // the band is mostly stars too faint to tell apart
            if (h >= dens * 0.017 + pBand) continue;
            const m = h32(x, y, seed + 1), v = h >= dens * 0.017 ? 0.3 + 0.22 * m * m : m < 0.7 ? 0.24 + 0.14 * m : m < 0.95 ? 0.45 + 0.1 * m : 0.66;
            B.put(x, y, starRamp(mix, h32(x, y, seed + 2)), v);
        }
        const rand = seeded(seed + 3);                                                    // the brighter suns, a few of them coloured
        for (let i = 0; i < Math.round(o.bright * k); i++) {
            const x = Math.floor(rand() * B.W), y = Math.floor(rand() * B.H), m = rand(), rp = starRamp([mix[0] * 2, mix[1] * 1.8, mix[2] * 2.5], rand());
            if ((hole && hole(x, y) > 0.3) || B.block[y * B.W + x]) continue;
            if (m > 0.86) {
                B.put(x, y, rp, 1); [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dx, dy]) => B.put(x + dx, y + dy, rp, 0.5));
                if (m > 0.95) for (let a = 0; a < 12; a++) B.put(x + Math.round(Math.cos(a / 2) * 2), y + Math.round(Math.sin(a / 2) * 2), rp, 0.26);
            } else B.put(x, y, rp, m > 0.5 ? 0.76 : 0.6);
        }
    }
    /** An open cluster (young, cold, loose) or a globular one (old, warm, packed to a glowing core). */
    function cluster(X, o) {
        const { B } = X, cx = X.sx(o.x), cy = X.sy(o.y);
        if (o.kind === 'globular') {
            B.region(cx - o.r * 1.8, cy - o.r * 1.8, cx + o.r * 1.8, cy + o.r * 1.8, (x, y) => {
                const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / o.r;
                B.put(x, y, C.CORE, 0.55 * Math.exp(-d * 3.2));
                if (h32(x, y, o.seed) < 0.75 * Math.exp(-d * 2.1)) B.put(x, y, h32(x, y, o.seed + 1) < 0.5 ? C.WARM : C.STAR, 0.36 + 0.3 * h32(x, y, o.seed + 2));
            });
            return;
        }
        const rand = seeded(o.seed);
        B.region(cx - o.r * 2, cy - o.r * 2, cx + o.r * 2, cy + o.r * 2, (x, y) => B.put(x, y, C.COLD, 0.2 * Math.exp(-((Math.hypot(x - cx, y - cy) / o.r) ** 2) * 1.4) * (0.6 + 0.8 * fbm(x / 4, y / 4, o.seed, 2))));
        for (let i = 0; i < o.count; i++) {
            const a = rand() * Math.PI * 2, rr = Math.sqrt(-2 * Math.log(rand() + 1e-6)) * o.r * 0.5, x = Math.round(cx + Math.cos(a) * rr), y = Math.round(cy + Math.sin(a) * rr), m = rand();
            const rp = m < 0.55 ? C.COLD : m < 0.8 ? C.STAR : C.WARM;
            if (m > 0.93) { B.put(x, y, rp, 1); [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dx, dy]) => B.put(x + dx, y + dy, rp, 0.45)); } else B.put(x, y, rp, 0.5 + 0.3 * rand());
        }
    }

    // ═══ galaxies of several shapes (sky.js draws spirals, edge-ons and ellipticals; these add the rest) ═══
    function ringGalaxy(X, o) {
        const { B } = X, gx = X.sx(o.x), gy = X.sy(o.y), ct = Math.cos(o.tilt), st = Math.sin(o.tilt);
        B.region(gx - o.r * 1.3, gy - o.r * 1.3, gx + o.r * 1.3, gy + o.r * 1.3, (x, y) => {
            const dx = x + 0.5 - gx, dy = y + 0.5 - gy, u = dx * ct + dy * st, w = (-dx * st + dy * ct) / o.incl, q = Math.hypot(u, w) / o.r;
            const qn = Math.hypot(u + o.r * 0.28, w) / o.r;                                         // the core sits off centre: a collision's wake
            B.put(x, y, C.OLD, o.bright * 1.4 * Math.exp(-((qn / 0.2) ** 2)));
            B.put(x, y, C.GAL, o.bright * Math.exp(-(((q - 0.82) / 0.16) ** 2)) * (0.3 + 1.2 * fbm(x / 2, y / 2, o.seed, 2)) * (0.5 + 0.5 * Math.cos(Math.atan2(w, u) - 0.6)));
            B.put(x, y, C.GAL, o.bright * 0.45 * Math.exp(-q * 2.2) * (0.4 + fbm(x / 3, y / 3, o.seed + 2, 2)));
        });
    }
    function irregular(X, o) {
        const { B } = X, gx = X.sx(o.x), gy = X.sy(o.y);
        B.region(gx - o.r * 1.6, gy - o.r * 1.6, gx + o.r * 1.6, gy + o.r * 1.6, (x, y) => {
            const q = Math.hypot(x + 0.5 - gx + (fbm(x / 6, y / 6, o.seed, 2) - 0.5) * o.r, (y + 0.5 - gy) * 1.4) / o.r, e = Math.exp(-q * q * 1.6);
            B.put(x, y, C.GAL, o.bright * e * (0.25 + 1.3 * fbm(x / 2.2, y / 2.2, o.seed + 4, 3)));
            if (h32(x, y, o.seed) < 0.1 * e) B.put(x, y, C.COLD, o.bright * 1.15);
        });
    }
    /** Two galaxies pulling at each other, a faint tail of stars torn out behind. */
    function pair(X, o) {
        galaxy(X.B, { x: X.sx(o.x), y: X.sy(o.y), r: o.r, tilt: o.tilt, incl: 0.55, arms: 2, wind: 2.4, bright: o.bright, seed: o.seed });
        galaxy(X.B, { x: X.sx(o.x + o.r * 1.5), y: X.sy(o.y - o.r * 0.5), r: o.r * 0.55, tilt: o.tilt + 1, incl: 0.7, arms: 0, bright: o.bright * 0.95, seed: o.seed + 1 });
        const ax = X.sx(o.x), ay = X.sy(o.y), bx = ax - o.r * 1.3, by = ay - o.r * 2.6, ex = ax - o.r * 3.4, ey = ay - o.r * 1.6;
        for (let i = 0; i <= 120; i++) {
            const s = i / 120, x = (1 - s) * (1 - s) * ax + 2 * s * (1 - s) * bx + s * s * ex, y = (1 - s) * (1 - s) * ay + 2 * s * (1 - s) * by + s * s * ey;
            for (let j = 0; j < 3; j++) { const px = Math.round(x + (h32(i, j, o.seed) - 0.5) * 3), py = Math.round(y + (h32(i, j + 5, o.seed) - 0.5) * 3); X.B.put(px, py, C.GAL, o.bright * 0.7 * (1 - s * 0.6) * (0.5 + fbm(px / 3, py / 3, o.seed, 2))); }
        }
    }
    /** A galaxy seen through a heavier one: its light bent into arcs around it (the tally: distances that come back wrong). */
    function lensed(X, o) {
        const { B } = X, gx = X.sx(o.x), gy = X.sy(o.y), re = o.r;
        galaxy(B, { x: gx, y: gy, r: re * 0.55, tilt: 0.3, incl: 0.8, arms: 0, bright: 0.55, seed: o.seed });
        const arcs = [[0.6, 0.55], [2.6, 0.35], [4.3, 0.45]];
        B.region(gx - re * 1.6, gy - re * 1.6, gx + re * 1.6, gy + re * 1.6, (x, y) => {
            const dx = x + 0.5 - gx, dy = y + 0.5 - gy, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
            let m = 0; arcs.forEach(([a0, wa]) => { const da = Math.atan2(Math.sin(a - a0), Math.cos(a - a0)); m = Math.max(m, Math.exp(-((da / wa) ** 2))); });
            B.put(x, y, C.COLD, 0.62 * m * Math.exp(-(((d - re) / 0.85) ** 2)));
        });
    }
    function smudgeField(X, count, seed) {
        const rand = seeded(seed), { B } = X;
        for (let i = 0; i < count; i++) {
            const x = Math.floor(rand() * B.W), y = Math.floor(rand() * B.H), s = rand(), a = rand() * Math.PI, rp = rand() < 0.45 ? C.OLD : C.GAL;
            if (X.hole && X.hole(x, y) > 0.2) continue;
            if (s > 0.86) { galaxy(B, { x, y, r: 3 + s * 3, tilt: a, incl: 0.3 + rand() * 0.6, arms: rand() < 0.5 ? 2 : 0, bright: 0.42 + rand() * 0.12, seed: i + 3, ramp: rp }); continue; }
            B.put(x, y, rp, 0.3 + s * 0.15);
            const dx = Math.round(Math.cos(a)), dy = Math.round(Math.sin(a));
            if (s > 0.35) { B.put(x + dx, y + dy, rp, 0.2); B.put(x - dx, y - dy, rp, 0.2); }
        }
    }

    // ═══ far bodies: small moons and planets at other depths, lit from the light, hiding the stars behind them ═══
    function body(X, o) {
        const { B } = X, cx = X.sx(o.x), cy = X.sy(o.y), L = norm3(X.lx - cx, X.ly - cy, o.depth || 30), rp = o.ramp || C.FAR;
        B.region(cx - o.r - 1, cy - o.r - 1, cx + o.r + 1, cy + o.r + 1, (x, y) => {
            const nx = (x + 0.5 - cx) / o.r, ny = (y + 0.5 - cy) / o.r, q = nx * nx + ny * ny; if (q >= 1) return;
            const nz = Math.sqrt(1 - q), lam = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
            const surf = o.bands ? 0.7 + 0.5 * Math.sin((ny * 0.9 + nx * 0.25) * o.r * 0.9 + fbm(nx * 3, ny * 6, o.seed, 2) * 4) : 0.75 + 0.5 * fbm(nx * o.r / 3, ny * o.r / 3, o.seed, 3);
            B.solid(x, y, rp, o.peak * Math.pow(lam, 0.85) * surf + (q > 0.8 && lam > 0.15 ? 0.08 : 0));
        });
        if (!o.ring) return;
        const ct = Math.cos(o.ring.tilt), st = Math.sin(o.ring.tilt), Rr = o.r * 2.2;
        B.region(cx - Rr - 1, cy - Rr - 1, cx + Rr + 1, cy + Rr + 1, (x, y) => {
            const dx = x + 0.5 - cx, dy = y + 0.5 - cy, u = dx * ct + dy * st, w = (-dx * st + dy * ct) / o.ring.open, rr = Math.hypot(u, w) / o.r;
            if (rr < 1.45 || rr > 2.15) return;
            const v = o.peak * 0.6 * (0.6 + 0.4 * Math.sin(rr * 26));
            if (w > 0) B.solid(x, y, C.CORE, v); else B.put(x, y, C.CORE, v);       // the near half passes in front of the disc
        });
    }

    // ═══ gas and dust ═══
    /** Dark clouds: 0..1 at each pixel. They eat the band and swallow the stars behind them. */
    function holes(X, list) {
        const cl = list.map(c => ({ x: X.sx(c.x), y: X.sy(c.y), rx: c.rx, ry: c.ry, seed: c.seed || 5 }));
        return (x, y) => {
            let m = 0;
            for (const c of cl) {
                const dx = (x - c.x) / c.rx, dy = (y - c.y) / c.ry, q = dx * dx + dy * dy; if (q > 2.2) continue;
                const n = fbm(x / 26, y / 18, c.seed, 4);
                m = Math.max(m, smooth(0.32, 0.62, Math.exp(-q * 1.4) * (0.45 + 1.0 * n)));
            }
            return m;
        };
    }
    /** A supernova's shell: thin threads running round it like loose rope, braided where they cross and broken in places, two
        colours (ice and rust), a faint teal fill along the shell. */
    function remnant(X, o) {
        const { B } = X, cx = X.sx(o.x), cy = X.sy(o.y), g = o.gain, N = o.threads || 8;
        const th = Array.from({ length: N }, (_, k) => ({ r: 1 + (k - (N - 1) / 2) * 0.024, s: o.seed + k * 13, amp: 0.05 + 0.045 * (k % 3), rust: k % 3 === 1, k }));
        B.region(cx - o.R * 1.4, cy - o.R * 1.4, cx + o.R * 1.4, cy + o.R * 1.4, (x, y) => {
            const dx = x + 0.5 - cx, dy = y + 0.5 - cy, r = Math.hypot(dx, dy) || 1, q = r / o.R; if (Math.abs(q - 1) > 0.36) return;
            const ca = dx / r, sa = dy / r, gap = smooth(0.36, 0.64, fbm(ca * 1.6 + 5, sa * 1.6 + 5, o.seed + 9, 2));
            const lump = 1 + (fbm(ca * 1.3 + 2, sa * 1.3 + 2, o.seed + 40, 2) - 0.5) * 0.2;                // a real shell is lumpy, not a drawn circle
            B.put(x, y, C.TEAL, g * 0.2 * gap * Math.exp(-(((q - 1) / 0.09) ** 2)) * (0.5 + fbm(x / 12, y / 12, o.seed + 2, 3)));
            for (const t of th) {
                const Rk = o.R * lump * (t.r + (fbm(ca * 2.4 + t.k, sa * 2.4, t.s, 3) - 0.5) * t.amp * 2), d = r - Rk; if (Math.abs(d) > 2.5) continue;
                const v = g * Math.exp(-((d / 0.85) ** 2)) * gap * smooth(0.32, 0.66, fbm(ca * 5 + t.k * 3, sa * 5, t.s + 1, 3));
                B.put(x, y, t.rust ? C.RUST : C.ICE, v * (t.rust ? 0.95 : 0.8));
            }
        });
    }
    /** A ring nebula: a dying star's shell seen end on, ice inside, a rust rim outside, faint rays beyond. */
    function ringNebula(X, o) {
        const { B } = X, cx = X.sx(o.x), cy = X.sy(o.y), ct = Math.cos(o.tilt), st = Math.sin(o.tilt), g = o.gain, ext = o.R * 2.1;
        B.region(cx - ext, cy - ext, cx + ext, cy + ext, (x, y) => {
            const dx = x + 0.5 - cx, dy = y + 0.5 - cy, u = dx * ct + dy * st, w = (-dx * st + dy * ct) / o.incl, q = Math.hypot(u, w) / o.R, cu = u / (q * o.R || 1), cw = w / (q * o.R || 1);
            const side = 0.45 + 0.55 * Math.abs(cw);                                                 // brighter where we look along the shell
            const ring = Math.exp(-(((q - 1) / 0.15) ** 2)) * (0.45 + 0.9 * fbm(x / 3.5, y / 3.5, o.seed, 3)) * side;
            const inner = q < 1 ? 0.3 * (0.6 + 0.6 * fbm(x / 6, y / 6, o.seed + 4, 2)) * smooth(0.05, 0.95, q) : 0;
            const rim = 0.6 * Math.exp(-(((q - 1.18) / 0.06) ** 2)) * smooth(0.35, 0.7, fbm(x / 4, y / 4, o.seed + 8, 3));
            const rays = q > 1.25 && q < 2.1 ? 0.3 * Math.pow(1 - Math.abs(2 * fbm(cu * 7, cw * 7, o.seed + 12, 3) - 1), 5) * Math.exp(-(q - 1.25) * 2.4) : 0;
            B.put(x, y, C.TEAL, g * ring * 0.55);
            B.put(x, y, C.ICE, g * (ring * 0.72 + inner));
            B.put(x, y, C.RUST, g * (rim * 0.85 + rays));
        });
        B.put(cx, cy, C.COLD, 0.95); [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dx, dy]) => B.put(cx + dx, cy + dy, C.COLD, 0.32));
    }
    /** A star wrapped in the dust it lights: cold, wispy, small. */
    function reflection(X, o) {
        const { B } = X, cx = X.sx(o.x), cy = X.sy(o.y);
        B.region(cx - o.r * 2.4, cy - o.r * 2.4, cx + o.r * 2.4, cy + o.r * 2.4, (x, y) => {
            const d = Math.hypot(x + 0.5 - cx, (y + 0.5 - cy) * 1.2) / o.r, wx = fbm(x / 16, y / 16, o.seed, 3) - 0.5;
            const wisp = Math.pow(1 - Math.abs(2 * fbm(x / 14 + 2 * wx, y / 9, o.seed + 3, 4) - 1), 5);
            B.put(x, y, C.ICE, o.gain * Math.exp(-d * 1.4) * (0.3 + 0.9 * wisp));
            B.put(x, y, C.TEAL, o.gain * 0.8 * Math.exp(-d * 0.8) * fbm(x / 10, y / 10, o.seed + 6, 3));
        });
        B.put(cx, cy, C.COLD, 1); [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dx, dy]) => B.put(cx + dx, cy + dy, C.COLD, 0.5));
    }
    /** Pillars of dust rising out of a cloud, eaten away toward the light. The dust is a density field; each pixel is lit by how
        little dust lies between it and the light, so the side facing the light glows and the far side is brown-black. Edges are
        dithered, not drawn. Glowing gas behind, brightest round the tips. */
    function pillars(X, o) {
        const { B, lx, ly } = X, g = o.gain, floor = X.sy(o.floorY), thr = P.threshold;
        const cols = o.cols.map(([x, len, w, lean]) => {
            const bx = X.sx(x), by = floor + 10, aL = Math.atan2(ly - by, lx - bx), a = -Math.PI / 2 + (aL + Math.PI / 2) * lean;
            return { bx, by, ax: Math.cos(a), ay: Math.sin(a), len, w, tx: bx + Math.cos(a) * len, ty: by + Math.sin(a) * len };
        });
        const density = (x, y) => {
            const top = floor + (fbm(x / 26, 0.5, o.seed, 3) - 0.5) * 44 + (fbm(x / 8, y / 8, o.seed + 3, 3) - 0.5) * 12;
            let d = smooth(top - 6, top + 12, y) * (0.55 + 0.7 * fbm(x / 9, y / 7, o.seed + 5, 3)) * smooth(X.sx(o.fade[1]), X.sx(o.fade[0]), x + (fbm(x / 20, y / 20, o.seed + 9, 3) - 0.5) * 60);
            for (const c of cols) {
                const px = x - c.bx, py = y - c.by, t = (px * c.ax + py * c.ay) / c.len; if (t < -0.15 || t > 1.2) continue;
                let half = c.w * (1 - 0.48 * t) * (0.6 + 0.8 * fbm(t * 6, c.bx / 50, o.seed + 7, 3));
                if (t > 0.84) half *= Math.sqrt(Math.max(0, 1 - ((t - 0.84) / 0.3) ** 2));
                const dn = Math.abs(-px * c.ay + py * c.ax) / Math.max(0.5, half);
                d = Math.max(d, smooth(1.25, 0.55, dn + (fbm(x / 5, y / 5, o.seed + 11, 3) - 0.5) * 0.8) * (0.7 + 0.6 * fbm(x / 4, y / 4, o.seed + 15, 2)));
            }
            return clamp01(d);
        };
        const x0 = Math.max(0, X.sx(o.x0)), y0 = Math.max(0, X.sy(o.y0)), x1 = Math.min(B.W, X.sx(o.x1)), GW = x1 - x0, GH = B.H - y0, Dg = new Float32Array(GW * GH);
        for (let y = y0; y < B.H; y++) for (let x = x0; x < x1; x++) Dg[(y - y0) * GW + x - x0] = density(x, y);
        const dAt = (x, y) => (x < x0 || y < y0 || x >= x1 || y >= B.H ? 0 : Dg[(y - y0) * GW + x - x0]);
        const ex = X.sx(o.glow[0]), ey = X.sy(o.glow[1]);
        B.region(x0, y0, x1, B.H, (x, y) => {
            const dl = Math.hypot(lx - x, ly - y) || 1, Lx = (lx - x) / dl, Ly = (ly - y) / dl, d = dAt(x, y);
            let tau = 0; for (let k = 1; k <= 7; k++) tau += dAt(Math.round(x + Lx * k * 1.4), Math.round(y + Ly * k * 1.4));
            const lit = Math.exp(-tau * 0.7), n = fbm(x / 3, y / 3, o.seed + 13, 2);
            if (d > 0.08 && d * 1.15 > thr(x + 3, y + 5)) {                                        // a dust pixel; its edge is dithered
                if (lit > 0.2) B.solid(x, y, C.EMBER, g * (0.1 + 0.62 * lit) * (0.6 + 0.7 * n));
                else B.solid(x, y, C.CORE, 0.12 + 0.3 * fbm(x / 6, y / 6, o.seed + 17, 3));
                return;
            }
            const near = dAt(Math.round(x - Lx * 2.5), Math.round(y - Ly * 2.5));
            if (near > 0.35) B.put(x, y, C.EMBER, g * 0.3 * near * (0.3 + n));                    // gas boiling off the lit edge
            const env = Math.exp(-(((x - ex) / o.glow[2]) ** 2 + ((y - ey) / o.glow[3]) ** 2));
            if (env < 0.03) return;
            const wx = fbm(x / 50, y / 40, o.seed + 19, 3) - 0.5, nn = fbm(x / 38 + 2 * wx, y / 26, o.seed + 21, 5), dens = env * Math.pow(clamp01((nn - 0.3) / 0.5), 1.4) * (1 - d);
            let tip = 0; cols.forEach(c => { tip = Math.max(tip, Math.exp(-Math.hypot(x - c.tx, y - c.ty) / 30)); });
            B.put(x, y, C.TEAL, g * dens * 0.72);
            B.put(x, y, C.MOSS, g * dens * 0.85 * (1 - tip));
            B.put(x, y, C.EMBER, g * (dens * 0.5 + 0.3 * env * (1 - d)) * tip * 1.3);
        });
    }
    /** The light's own dust: a vast thin ring round it seen at a slant, and spokes of dust streaming in. */
    function lightRing(X, o) {
        const { B, lx, ly } = X, ct = Math.cos(o.tilt), st = Math.sin(o.tilt);
        for (let y = 0; y < B.H; y++) for (let x = 0; x < B.W; x++) {
            const dx = x + 0.5 - lx, dy = y + 0.5 - ly, u = dx * ct + dy * st, w = (-dx * st + dy * ct) / o.open, q = Math.hypot(u, w) / o.R;
            if (Math.abs(q - 1) > 0.2) continue;
            const wob = (fbm(u / 90, w / 90, o.seed + 3, 3) - 0.5) * 0.08, qq = q + wob;
            const band = Math.exp(-(((qq - 1) / 0.03) ** 2)) + 0.55 * Math.exp(-(((qq - 1.07) / 0.014) ** 2));
            const thread = Math.pow(1 - Math.abs(2 * fbm(u / 70, qq * 60, o.seed + 11, 3) - 1), 3);       // the ring is threads, not a haze
            const arcs = smooth(0.32, 0.58, fbm(u / 140 + 3, w / 140, o.seed + 7, 3));             // broken into long arcs of dust
            const lit = 0.45 + 0.55 * Math.exp(-Math.hypot(dx, dy) / 240), back = w < 0 ? 0.55 : 1;
            const v = o.gain * band * arcs * lit * back * (0.25 + 1.2 * thread);
            B.put(x, y, C.CORE, v); B.put(x, y, C.EMBER, v * 0.75);
        }
    }
    function streams(X, o) {
        const { B, lx, ly } = X;
        for (let y = 0; y < B.H; y++) for (let x = 0; x < B.W; x++) {
            const dx = x + 0.5 - lx, dy = y + 0.5 - ly, d = Math.hypot(dx, dy); if (d < 26) continue;
            const ca = dx / d, sa = dy / d, spoke = Math.pow(1 - Math.abs(2 * fbm(ca * o.k + d / 260, sa * o.k, o.seed, 3) - 1), 7);
            const v = o.gain * spoke * Math.exp(-d / o.reach) * (0.4 + 0.8 * fbm(x / 18, y / 18, o.seed + 4, 3)) * smooth(0.35, 0.7, fbm(x / 34, y / 34, o.seed + 6, 3));
            B.put(x, y, C.RUST, v); B.put(x, y, C.EMBER, v * 0.55);
        }
    }

    // ═══ the far motion (?sky=f): stepped at eight frames a second, fixed to the sky so it slides with it ═══
    const px = (c, x, y, hex, w = 1, h = 1) => { c.fillStyle = hex; c.fillRect(Math.round(x), Math.round(y), w, h); };
    const tone = (c, x, y, r, v) => { const k = level(r, v, Math.round(x), Math.round(y)); if (k) px(c, x, y, r.hex[k]); };
    function sprite(S, fn) { const p = P.painter(S, S, false); p.region(0, 0, S, S, (x, y) => fn(p, x, y)); return p.canvas(); }
    /** The pulsar: a dead star turning, two thin beams sweeping round, a tick of light each turn. */
    function pulsar(X, o) {
        const cx = X.sx(o.x), cy = X.sy(o.y), N = 48, frames = [], S = o.len * 2 + 3;
        const make = k => { const a = k / N * Math.PI, ca = Math.cos(a), sa = Math.sin(a); return sprite(S, (p, x, y) => {
            const dx = x + 0.5 - S / 2, dy = y + 0.5 - S / 2, u = dx * ca + dy * sa, w = -dx * sa + dy * ca, au = Math.abs(u); if (au < 2) return;
            const v = Math.exp(-((w / (0.6 + au * 0.1)) ** 2)) * Math.exp(-au / (o.len * 0.36)) * 0.6 * (0.65 + 0.7 * fbm(au / 5, u > 0 ? 1 : 9, o.seed, 2));
            if (v > 0.03) p.tone(x, y, C.BEAM, v); }); };
        return (c, t, off) => {
            const k = Math.floor((t % o.period) / o.period * N); const f = frames[k] || (frames[k] = make(k));
            c.drawImage(f, Math.round(cx - off - S / 2), Math.round(cy - S / 2));
            const tick = t % o.tick < 250, x = cx - off, y = cy;
            px(c, x, y, C.COLD.hex[tick ? 4 : 3]);
            if (tick) [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dx, dy]) => px(c, x + dx, y + dy, C.COLD.hex[2]));
        };
    }
    /** A comet: an ice head and two tails, the long ice one pointing straight away from the light, the dust one curving behind. */
    function comet(X, o) {
        const cache = new Map(), S = o.len * 2 + 5;
        const make = a => { const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(a + o.curl), sb = Math.sin(a + o.curl); return sprite(S, (p, x, y) => {
            const dx = x + 0.5 - S / 2, dy = y + 0.5 - S / 2;
            const u = dx * ca + dy * sa, w = -dx * sa + dy * ca, u2 = dx * cb + dy * sb, w2 = -dx * sb + dy * cb;
            let v = 0, r = C.ICE;
            if (u > 0) v = Math.exp(-((w / (0.5 + u * 0.06)) ** 2)) * Math.exp(-u / (o.len * 0.5)) * 0.8 * (0.7 + 0.6 * fbm(u / 3, 3, o.seed, 2));
            const v2 = u2 > 0 ? Math.exp(-((w2 / (0.6 + u2 * 0.13)) ** 2)) * Math.exp(-u2 / (o.len * 0.28)) * 0.5 : 0;
            if (v2 > v) { v = v2; r = C.EMBER; }
            const d = Math.hypot(dx, dy); if (d < 2.2) { v = Math.max(v, 0.75 - d * 0.18); r = C.ICE; }
            if (v > 0.04) p.tone(x, y, r, v); }); };
        return (c, t, off) => {
            const s = (t % o.period) / 1000, x = X.sx(o.x0) + o.vx * s, y = X.sy(o.y0) + o.vy * s;
            const a = Math.atan2(y - X.ly, x - X.lx), key = Math.round(a / (Math.PI / 32));
            const f = cache.get(key) || (cache.set(key, make(key * Math.PI / 32)), cache.get(key));
            c.drawImage(f, Math.round(x - off - S / 2), Math.round(y - S / 2));
            px(c, x - off, y, C.STAR.hex[4]);
        };
    }
    /** Fragments: far pieces of hull tumbling, so each catches the light now and then. */
    function glints(X, o) {
        const rand = seeded(o.seed), [x0, y0, x1, y1] = o.area;
        const list = Array.from({ length: o.n }, () => ({ x: X.sx(x0 + rand() * (x1 - x0)), y: X.sy(y0 + rand() * (y1 - y0)), vx: (rand() - 0.6) * o.drift, vy: (rand() - 0.5) * o.drift * 0.4, ph: rand() * 20000, per: 4500 + rand() * 9000, warm: rand() < o.warm }));
        return (c, t, off) => list.forEach(g => {
            const s = t / 1000, x = g.x + g.vx * s - off, y = g.y + g.vy * s, ph = (t + g.ph) % g.per, rp = g.warm ? C.WARM : C.STAR;
            if (ph < 125) { px(c, x, y, rp.hex[4]); [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dx, dy]) => px(c, x + dx, y + dy, rp.hex[2])); }
            else if (ph < 375) px(c, x, y, rp.hex[3]);
            else px(c, x, y, C.FAR.hex[(ph / 1500 | 0) % 2 ? 3 : 2]);
        });
    }
    /** A far flash, now and then: something a long way off going up, a second at most. */
    function flashes(X, o) {
        const [x0, y0, x1, y1] = o.area;
        return (c, t, off) => {
            const b = Math.floor(t / o.every); if (h32(b, 7, o.seed) > o.chance) return;
            const dt = t - (b * o.every + h32(b, 9, o.seed) * (o.every - 1200)); if (dt < 0 || dt >= 1000) return;
            const x = X.sx(x0 + h32(b, 11, o.seed) * (x1 - x0)) - off, y = X.sy(y0 + h32(b, 13, o.seed) * (y1 - y0)), r = o.ramp;
            const f = Math.floor(dt / 125), lv = [2, 4, 4, 3, 3, 2, 2, 1][f];
            px(c, x, y, r.hex[lv]);
            if (f >= 1 && f <= 4) [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dx, dy]) => px(c, x + dx, y + dy, r.hex[lv - 2]));
            if (f === 1 || f === 2) [[-2, 0], [2, 0], [0, -2], [0, 2]].forEach(([dx, dy]) => px(c, x + dx, y + dy, r.hex[1]));
        };
    }

    // ═══ rare colour (?sky=f, 2026-10-09): the designer's "noir with rare colour". The sky stays dark and muted; three to seven
    //     tiny, very distant things per sector carry a dull but distinct colour that holds the eye. Each is a small dithered
    //     sprite (a few px to a few dozen), fixed to the sky at its own depth (it slides a little faster or slower than the
    //     sky as we fly), some twinkling or slowly pulsing at 8 fps. Never neon, never a big glow, no magenta/cyan bloom.
    //     ?accents=0 turns them off (for before/after). ═══
    const ACC = {
        ROSE: ramp(INK, '#140b0e', '#2a161b', '#47252d', '#6a3a42', '#8f5a5e', '#b07d7b'),   // hydrogen glow, dusty: a far emission knot
        VERDIGRIS: ramp(INK, '#08130f', '#11271f', '#1d4136', '#2e5f51', '#4b8271', '#7aa898'),   // weathered copper
        SLATE: ramp(INK, '#0d0c14', '#191724', '#282538', '#3c3850', '#57516c', '#7b7590'),   // slate violet: a far galaxy, grey first
        CRIMSON: ramp(INK, '#160606', '#2c0c0b', '#4a1512', '#6b2119', '#8c3424', '#a85138'),   // a red dwarf, a carbon star: deep, not hot
        SULPHUR: ramp(INK, '#12110a', '#262412', '#433f1d', '#665f2b', '#8c8240', '#ada25e'),
        AMBER: ramp(INK, '#150e07', '#2c1d0d', '#4a3014', '#6d471d', '#93622b', '#b48144'),
        JADE: ramp(INK, '#0a110d', '#15241b', '#233a2c', '#365441', '#527359', '#7b977f'),   // a planetary nebula's oxygen, greyed
    };
    const ACCENTS_ON = (() => { try { return new URLSearchParams(location.search).get('accents') !== '0'; } catch (err) { return true; } })();
    const DOT4 = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    /** One accent's painting at a given brightness (g, or [gA, gB] for a binary) into a small clear sprite. */
    function paintAccent(o, g) {
        const S = o.S, c = S / 2, p = P.painter(S, S, false), r = o.ramp;
        const halo = (x, y, rp, v) => p.region(x - 3, y - 3, x + 4, y + 4, (hx, hy) => { const d = Math.hypot(hx - x, hy - y); if (d > 1.2 && d < 2.9) p.tone(hx, hy, rp, v * (1.25 - d / 2.9)); });   // a breath of its own colour, two px, so the hue reads
        const star = (x, y, rp, v, cross) => { halo(x, y, rp, v * 0.24); p.tone(x, y, rp, v); if (cross) DOT4.forEach(([dx, dy]) => p.tone(x + dx, y + dy, rp, v * cross)); };
        if (o.kind === 'star') star(c, c, r, 0.97 * g, o.cross == null ? 0.5 : o.cross);
        else if (o.kind === 'binary') { star(c, c, r, 0.95 * g[0], 0.45); star(c + o.sep, c - 1, o.ramp2, 0.85 * g[1], o.sep > 3 ? 0.4 : 0); }
        else if (o.kind === 'dwarf') {                                                      // a deep red point in a hint of its own dust
            p.region(0, 0, S, S, (x, y) => { const d = Math.hypot(x + 0.5 - c, y + 0.5 - c); if (d > 1.2 && d < o.r) p.tone(x, y, r, 0.16 * g * (1 - d / o.r) * (0.5 + fbm(x / 2, y / 2, o.seed, 2))); });
            star(c, c, r, 0.92 * g, 0.45 * Math.min(1.2, g));
        } else if (o.kind === 'knot') {                                                     // a lumpy blob of glowing gas, two or three cores
            const ca = Math.cos(o.tilt || 0), sa = Math.sin(o.tilt || 0);
            p.region(0, 0, S, S, (x, y) => {
                const dx = x + 0.5 - c, dy = y + 0.5 - c, u = dx * ca + dy * sa, w = (-dx * sa + dy * ca) * 1.6;
                const q = Math.hypot(u + (fbm(x / 4, y / 4, o.seed, 2) - 0.5) * o.r * 0.8, w) / o.r;
                const sub = Math.max(Math.exp(-((Math.hypot(u - o.r * 0.45, w - 1) / 1.6) ** 2)), Math.exp(-((Math.hypot(u + o.r * 0.5, w + 1.5) / 1.3) ** 2)) * 0.8);
                p.tone(x, y, r, g * (0.5 * Math.exp(-q * q * 2.2) * (0.35 + 1.1 * fbm(x / 2.4, y / 2.4, o.seed + 3, 3)) + 0.42 * sub));
            });
        } else if (o.kind === 'wisp') {                                                     // a thin curved thread of gas, broken in places
            for (let i = 0; i <= o.len * 3; i++) {
                const s = i / (o.len * 3), a = (o.tilt || 0) + (s - 0.5) * o.bend, x = c + Math.cos(a) * o.rr - Math.cos(o.tilt || 0) * o.rr, y = c + Math.sin(a) * o.rr - Math.sin(o.tilt || 0) * o.rr;
                const v = g * 0.62 * Math.sin(Math.PI * s) * smooth(0.3, 0.6, fbm(s * 7, 1, o.seed, 2) + 0.15);
                p.tone(x, y, r, v); p.tone(x + (s > 0.5 ? 1 : 0), y + 1, r, v * 0.45);
            }
        } else if (o.kind === 'galaxy') galaxy({ put: (x, y, rp, v) => p.tone(x, y, rp, v) }, { x: c, y: c, r: o.r, tilt: o.tilt, incl: o.incl, arms: o.arms, wind: 2.3, bright: 0.75 * g, seed: o.seed, ramp: r });
        else if (o.kind === 'planetary') {                                                  // a tiny shell, brighter on two sides, and its white dwarf
            p.region(0, 0, S, S, (x, y) => {
                const dx = x + 0.5 - c, dy = (y + 0.5 - c) * 1.15, d = Math.hypot(dx, dy), side = 0.55 + 0.45 * Math.abs(Math.cos(Math.atan2(dy, dx) - 0.7));
                p.tone(x, y, r, g * (0.66 * Math.exp(-(((d - o.r) / 0.9) ** 2)) * side * (0.6 + 0.6 * fbm(x / 2, y / 2, o.seed, 2)) + (d < o.r ? 0.12 : 0)));
            });
            p.tone(c, c, ACC.SLATE, 0.6 + 0.2 * g);
        }
        return p.canvas();
    }
    /** How bright an accent is at time t (8 fps already): 1 is its resting look. */
    function accentGain(o, t, i) {
        const ph = (t + o.phase) % o.period;
        if (o.live === 'pulse') return 0.78 + 0.22 * (0.5 + 0.5 * Math.sin(ph / o.period * Math.PI * 2));
        if (o.live === 'twinkle') { const b = Math.floor(t / 250); const h = h32(b, i, o.seed); return h < 0.12 ? 0.62 : h > 0.93 ? 1.18 : 0.9; }
        if (o.live === 'flare') return ph < 2500 ? 1 + 0.55 * Math.exp(-ph / 700) : 0.8;   // now and then a flare, a few seconds
        return 1;
    }
    function accents(X, list) {
        const out = X.out;
        const items = list.map((a, i) => {
            const S = a.S || (a.kind === 'galaxy' || a.kind === 'knot' || a.kind === 'wisp' ? Math.ceil((a.r || a.rr || 6) * 2.8) + 6 : a.kind === 'binary' ? 12 : a.kind === 'planetary' ? Math.ceil(a.r * 2.6) + 4 : a.kind === 'dwarf' ? Math.ceil(a.r * 2) + 4 : 6);
            return Object.assign({ S: S + (S & 1), depth: 1, period: 9000, phase: h32(i, 3, a.seed || 1) * 20000, seed: 7 + i, frames: new Map() }, a, { x: X.sx(a.x), y: X.sy(a.y), i });
        });
        const step = v => Math.round(v * 16) / 16;                                         // a few brightness steps, each painted once
        return (c, t, off, D) => items.forEach(o => {
            const x = Math.round(o.x - off * o.depth), y = o.y, bi = y * X.B.W + Math.round(o.x - off * o.depth) + off;
            if (out.thing && out.thing.covers(x, y, D)) return;                            // behind the vast planet
            if (bi >= 0 && bi < X.B.block.length && X.B.block[bi]) return;                 // behind a far moon
            let g;
            if (o.kind === 'binary') { const ph = (t + o.phase) % o.period; g = [o.live === 'twinkle' ? accentGain(o, t, o.i) : 1, ph < 1600 ? 0.38 : 1]; }   // the pair eclipses now and then
            else g = step(accentGain(o, t, o.i));
            const key = String(g); let f = o.frames.get(key);
            if (!f) { f = paintAccent(o, g); o.frames.set(key, f); }
            c.drawImage(f, x - o.S / 2, y - o.S / 2);
        });
    }

    // ═══ the six places. Coordinates in stage pixels (640 x 360); the light is at (604, 158), our ship at (224, 196). ═══
    const RECIPES = {
        1: { name: 'the graveyard', haze: 0.3, wash: { ang: -0.42, gain: 0.5, w0: 150, w1: 420 },
            band: { cx: 320, cy: 64, ang: -0.24, wide: 66, core: 21, peak: 0.6, bulge: [-200, 95] }, density: 1, bandStars: 1, mix: [0.14, 0.2, 0.03], bright: 26,
            galaxies: (X, k) => {
                galaxy(X.B, { x: X.sx(150), y: X.sy(302), r: 30, tilt: -0.55, incl: 0.42, arms: 2, wind: 2.4, bright: 0.58 * k, seed: 7 });
                galaxy(X.B, { x: X.sx(566), y: X.sy(252), r: 13, tilt: 0.35, incl: 0.18, arms: 2, bright: 0.5 * k, seed: 12 });
                ringGalaxy(X, { x: 468, y: 334, r: 13, tilt: 0.5, incl: 0.6, bright: 0.5 * k, seed: 31 });
                pair(X, { x: 70, y: 206, r: 8, tilt: 0.4, bright: 0.5 * k, seed: 41 });
                irregular(X, { x: 532, y: 34, r: 7, bright: 0.48 * k, seed: 51 });
            },
            clusters: [{ x: 505, y: 292, r: 9, count: 26, seed: 61 }], smudges: 30,
            gas: (X, g) => { if (X.out.mode !== 'f') remnant(X, { x: -30, y: 380, R: 200, gain: 0.6 * g, seed: 71, side: -0.8 }); },   // in F the vast planet is enough; the shell is sector 3's
            place: X => { X.out.thing = vastPlanet(X.W + Math.ceil(REACH_D * SKY.THING) + 4, X.H, { cx: X.sx(-200), cy: X.sy(-900), Rr: 1020, lx: X.lx, ly: X.ly, seed: 61 }); },
            bodies: [{ x: 34, y: 262, r: 5, peak: 0.55, ramp: P.RP.GAS, bands: true, seed: 5, ring: { tilt: -0.35, open: 0.3 } }],
            accents: [   // the graveyard: a dull rose knot above the giant's way, a red dwarf flaring by the planet's limb, a far violet spiral, an amber pair near the light, one verdigris star
                { kind: 'knot', x: 392, y: 104, r: 8, tilt: -0.5, ramp: ACC.ROSE, depth: 0.7, live: 'pulse', period: 14000, seed: 3 },
                { kind: 'dwarf', x: 262, y: 116, r: 4, ramp: ACC.CRIMSON, depth: 1.3, live: 'flare', period: 23000, seed: 5 },
                { kind: 'galaxy', x: 586, y: 322, r: 7, tilt: 0.6, incl: 0.5, arms: 2, ramp: ACC.SLATE, depth: 0.45, seed: 9 },
                { kind: 'binary', x: 486, y: 206, sep: 3, ramp: ACC.AMBER, ramp2: ACC.SULPHUR, depth: 1.1, live: 'twinkle', period: 17000, seed: 11 },
                { kind: 'star', x: 520, y: 104, cross: 0.45, ramp: ACC.VERDIGRIS, depth: 0.9, live: 'twinkle', seed: 13 },
            ],
            live: X => [glints(X, { n: 10, seed: 3, area: [240, 14, 590, 128], drift: 0.5, warm: 0.3 }), comet(X, { x0: 610, y0: 40, vx: -1.3, vy: 0.22, len: 34, curl: 0.35, period: 520000, seed: 9 }),
                flashes(X, { every: 26000, chance: 0.75, seed: 4, area: [30, 120, 600, 340], ramp: C.WARM })] },
        2: { name: 'the dark void', haze: 0.15, wash: { ang: 0.3, gain: 0.45, w0: 250, w1: 40 },
            band: { cx: 330, cy: 58, ang: 0.14, wide: 62, core: 19, peak: 0.85 }, density: 0.32, bandStars: 0.8, mix: [0.06, 0.32, 0.02], bright: 12,
            holes: [{ x: 230, y: 64, rx: 105, ry: 56, seed: 11 }, { x: 470, y: 38, rx: 48, ry: 34, seed: 13 }, { x: 90, y: 300, rx: 70, ry: 50, seed: 15 }],
            galaxies: (X, k) => { galaxy(X.B, { x: X.sx(90), y: X.sy(176), r: 6, tilt: -0.3, incl: 0.65, arms: 0, bright: 0.5 * k, seed: 18 }); irregular(X, { x: 560, y: 70, r: 6, bright: 0.44 * k, seed: 19 }); },
            clusters: [], smudges: 14,
            gas: (X, g) => { reflection(X, { x: 120, y: 236, r: 22, gain: 0.55 * g, seed: 21 }); },
            place: X => galaxy(X.hole ? Object.assign({}, X.B, { put: (x, y, r, v) => X.B.put(x, y, r, v * (1 - X.hole(x, y))) }) : X.B, { x: X.sx(350), y: X.sy(150), r: 185, tilt: -0.3, incl: 0.5, arms: 2, wind: 2.3, bright: 0.34, seed: 23, fall: 0.85, bulgeW: 0.5 }),
            bodies: [],
            accents: [   // the dark void: almost nothing, so three small colours carry it
                { kind: 'dwarf', x: 498, y: 254, r: 4, ramp: ACC.CRIMSON, depth: 1.2, live: 'flare', period: 31000, seed: 21 },
                { kind: 'star', x: 300, y: 312, cross: 0.4, ramp: ACC.VERDIGRIS, depth: 0.8, live: 'twinkle', seed: 23 },
                { kind: 'galaxy', x: 586, y: 26, r: 6, tilt: -0.4, incl: 0.35, arms: 2, ramp: ACC.SLATE, depth: 0.5, seed: 25 },
            ],
            live: X => [glints(X, { n: 2, seed: 8, area: [80, 40, 560, 140], drift: 0.3, warm: 0 }), flashes(X, { every: 40000, chance: 0.6, seed: 6, area: [40, 30, 600, 330], ramp: C.COLD })] },
        3: { name: 'the signal', haze: 0.25, wash: { ang: 0.2, gain: 0.45, w0: 280, w1: 330 },
            band: { cx: 320, cy: 322, ang: -0.1, wide: 60, core: 19, peak: 0.52, bulge: [130, 80] }, density: 1.1, bandStars: 1, mix: [0.1, 0.3, 0.03], bright: 24,
            galaxies: (X, k) => { galaxy(X.B, { x: X.sx(520), y: X.sy(48), r: 10, tilt: 0.4, incl: 0.8, arms: 2, bright: 0.48 * k, seed: 8 }); ringGalaxy(X, { x: 330, y: 30, r: 11, tilt: 0.2, incl: 0.7, bright: 0.48 * k, seed: 33 }); },
            clusters: [{ x: 470, y: 250, r: 8, count: 20, seed: 63 }], smudges: 28,
            gas: (X, g) => { remnant(X, { x: 104, y: 86, R: 84, gain: 0.86 * g, seed: 75, side: 0.2, threads: 6 }); X.B.put(X.sx(104), X.sy(86), C.COLD, 0.8); },   // clear of our ship's path
            place: () => {},
            bodies: [{ x: 528, y: 300, r: 7, peak: 0.6, ramp: P.RP.ICE, seed: 9 }],
            accents: [   // the signal: a jade planetary beside the shell, a sulphur point, a crimson dwarf, a rose wisp low in the band, a far violet edge-on
                { kind: 'planetary', x: 274, y: 62, r: 3.5, ramp: ACC.JADE, depth: 0.8, live: 'pulse', period: 11000, seed: 31 },
                { kind: 'star', x: 432, y: 118, cross: 0.4, ramp: ACC.SULPHUR, depth: 1.2, live: 'twinkle', seed: 33 },
                { kind: 'dwarf', x: 34, y: 212, r: 4, ramp: ACC.CRIMSON, depth: 1.4, live: 'flare', period: 19000, seed: 35 },
                { kind: 'wisp', x: 304, y: 280, rr: 14, len: 22, bend: 1.4, tilt: -1.9, ramp: ACC.ROSE, depth: 0.6, seed: 37 },
                { kind: 'star', x: 592, y: 38, cross: 0.4, ramp: ACC.VERDIGRIS, depth: 0.7, live: 'pulse', period: 7000, seed: 39 },
                { kind: 'galaxy', x: 152, y: 240, r: 8, tilt: 0.25, incl: 0.22, arms: 2, ramp: ACC.SLATE, depth: 0.4, seed: 41 },
            ],
            live: X => [pulsar(X, { x: 104, y: 86, len: 44, period: 16000, tick: 1500, seed: 3 }), flashes(X, { every: 13000, chance: 0.85, seed: 5, area: [20, 20, 620, 150], ramp: C.COLD })] },
        4: { name: 'the garden', haze: 0.25, wash: { ang: -0.15, gain: 0.5, w0: 60, w1: 250 },
            band: { cx: 330, cy: 38, ang: 0.08, wide: 58, core: 18, peak: 0.5 }, density: 1.35, bandStars: 1, mix: [0.16, 0.32, 0.02], bright: 34,
            galaxies: (X, k) => { galaxy(X.B, { x: X.sx(560), y: X.sy(300), r: 12, tilt: 0.7, incl: 0.3, arms: 2, bright: 0.5 * k, seed: 17 }); },
            clusters: [{ x: 150, y: 150, r: 15, count: 46, seed: 65 }], smudges: 20,
            gas: (X, g) => pillars(X, { floorY: 342, x0: -60, x1: 560, y0: 40, fade: [210, 330], glow: [110, 300, 200, 100], seed: 77, gain: g,
                cols: [[30, 150, 22, 0.28], [100, 100, 16, 0.34], [166, 60, 12, 0.4]] }),
            place: () => {},
            bodies: [{ x: 590, y: 318, r: 6, peak: 0.55, ramp: P.RP.DESERT, seed: 11 }],
            accents: [   // the garden: a rose knot near the pillar tips, a sulphur point, a jade planetary, an amber pair
                { kind: 'knot', x: 196, y: 108, r: 5, tilt: 0.7, ramp: ACC.ROSE, depth: 0.8, live: 'pulse', period: 12000, seed: 43 },
                { kind: 'star', x: 424, y: 64, cross: 0.4, ramp: ACC.SULPHUR, depth: 1.1, live: 'twinkle', seed: 45 },
                { kind: 'planetary', x: 520, y: 236, r: 3, ramp: ACC.JADE, depth: 0.7, seed: 47 },
                { kind: 'binary', x: 338, y: 168, sep: 4, ramp: ACC.AMBER, ramp2: ACC.VERDIGRIS, depth: 1.2, period: 21000, seed: 49 },
            ],
            live: X => [comet(X, { x0: 470, y0: 30, vx: -1.1, vy: 0.35, len: 34, curl: 0.4, period: 600000, seed: 12 }), flashes(X, { every: 34000, chance: 0.5, seed: 7, area: [300, 20, 620, 120], ramp: C.WARM })] },
        5: { name: 'the tally', haze: 0.25, wash: { ang: -0.35, gain: 0.45, w0: 330, w1: 230 },
            band: { cx: 330, cy: 74, ang: -0.32, wide: 64, core: 20, peak: 0.5, bulge: [190, 80] }, density: 1, bandStars: 1, mix: [0.14, 0.22, 0.04], bright: 24,
            galaxies: (X, k) => { lensed(X, { x: 478, y: 62, r: 9, seed: 35 }); pair(X, { x: 560, y: 330, r: 7, tilt: -0.3, bright: 0.48 * k, seed: 43 }); },
            clusters: [{ kind: 'globular', x: 508, y: 296, r: 12, seed: 67 }], smudges: 80,
            gas: (X, g) => ringNebula(X, { x: 118, y: 96, R: 40, tilt: 0.5, incl: 0.74, gain: 0.58 * g, seed: 79 }),
            place: () => {},
            bodies: [{ x: 40, y: 296, r: 6, peak: 0.55, ramp: P.RP.STONE, seed: 13 }, { x: 62, y: 306, r: 6, peak: 0.55, ramp: P.RP.STONE, seed: 13 }],
            accents: [   // the tally: an amber pair that eclipses, a jade planetary, a rose wisp, a violet face-on spiral, verdigris, crimson and sulphur points
                { kind: 'binary', x: 300, y: 38, sep: 4, ramp: ACC.AMBER, ramp2: ACC.SULPHUR, depth: 1.1, period: 13000, seed: 51 },
                { kind: 'planetary', x: 414, y: 232, r: 3, ramp: ACC.JADE, depth: 0.8, live: 'pulse', period: 9000, seed: 53 },
                { kind: 'wisp', x: 246, y: 304, rr: 16, len: 26, bend: 1.2, tilt: 2.2, ramp: ACC.ROSE, depth: 0.6, seed: 55 },
                { kind: 'galaxy', x: 380, y: 118, r: 8, tilt: 0.3, incl: 0.85, arms: 2, ramp: ACC.SLATE, depth: 0.4, seed: 57 },
                { kind: 'star', x: 28, y: 240, cross: 0.45, ramp: ACC.VERDIGRIS, depth: 1.3, live: 'twinkle', seed: 59 },
                { kind: 'dwarf', x: 436, y: 300, r: 3, ramp: ACC.CRIMSON, depth: 1.2, live: 'flare', period: 27000, seed: 61 },
                { kind: 'star', x: 198, y: 28, cross: 0.35, ramp: ACC.SULPHUR, depth: 0.9, live: 'pulse', period: 8000, seed: 63 },
            ],
            live: X => [flashes(X, { every: 22000, chance: 0.7, seed: 8, area: [20, 20, 620, 340], ramp: C.STAR }), glints(X, { n: 3, seed: 14, area: [300, 230, 620, 350], drift: 0.25, warm: 0 })] },
        6: { name: 'the light', haze: 0.25, wash: { ang: 0.1, gain: 0.45, w0: 120, w1: 220 },
            band: { cx: 300, cy: 302, ang: -0.2, wide: 60, core: 18, peak: 0.4 }, density: 1.2, bandStars: 0.9, mix: [0.3, 0.12, 0.05], bright: 26,
            galaxies: (X, k) => { galaxy(X.B, { x: X.sx(90), y: X.sy(60), r: 9, tilt: -0.3, incl: 0.6, arms: 0, bright: 0.48 * k, seed: 28 }); },
            clusters: [], smudges: 22,
            gas: (X, g) => { lightRing(X, { R: 540, tilt: -0.22, open: 0.27, gain: 1.05 * g, seed: 81 }); streams(X, { k: 9, reach: 260, gain: 0.45 * g, seed: 83 }); },
            place: () => {},
            bodies: [],
            accents: [   // the light: cold colours far from the warm ring
                { kind: 'star', x: 118, y: 40, cross: 0.4, ramp: ACC.VERDIGRIS, depth: 1.1, live: 'twinkle', seed: 71 },
                { kind: 'galaxy', x: 42, y: 300, r: 7, tilt: -0.6, incl: 0.45, arms: 2, ramp: ACC.SLATE, depth: 0.45, seed: 73 },
                { kind: 'dwarf', x: 462, y: 326, r: 4, ramp: ACC.CRIMSON, depth: 1.3, live: 'flare', period: 25000, seed: 75 },
                { kind: 'planetary', x: 252, y: 58, r: 3, ramp: ACC.JADE, depth: 0.7, live: 'pulse', period: 10000, seed: 77 },
            ],
            live: X => [comet(X, { x0: 330, y0: 20, vx: 1.4, vy: 0.5, len: 36, curl: -0.3, period: 300000, seed: 15 }), comet(X, { x0: 210, y0: 345, vx: 1.6, vy: -0.75, len: 26, curl: 0.3, period: 260000, seed: 16 }),
                flashes(X, { every: 18000, chance: 0.7, seed: 9, area: [200, 60, 560, 300], ramp: C.WARM })] },
    };

    /** The sky for one sector at one screen size, in one of round two's modes. Same contract as sky.js's build(). */
    function build(W, H, ox, oy, n, light, mode) {
        const rec = RECIPES[n] || RECIPES[((n - 1) % 6 + 6) % 6 + 1], extra = Math.ceil(REACH_D * SKY.DEEP) + 4, B = sbuf(W + extra, H);
        const X = { B, W, H, sx: x => ox + x, sy: y => oy + y, lx: ox + light[0], ly: oy + light[1], seed: 500 + n * 41, extra, hole: null };
        const full = mode === 'd', gas = mode !== 'd', placed = mode === 'f';
        const out = { mode, B, extra, haze: mode === 'f' ? rec.haze : mode === 'e' ? rec.haze * 0.8 : rec.haze * 1.1, thing: null, stripStars: 0.45, live: null };
        X.out = out;
        const quiet = placed && ACCENTS_ON && rec.accents, mix = quiet ? rec.mix.map(m => m * 0.4) : rec.mix;   // noir: the field's own tints go quiet so the rare colours read
        out.tint = (x, y) => starRamp([mix[0] * 0.8, mix[1] * 0.8, mix[2]], h32(x, y, 909));
        if (rec.holes && mode !== 'd') X.hole = holes(X, mode === 'e' ? rec.holes.map(h => Object.assign({}, h, { rx: h.rx * 1.25, ry: h.ry * 1.2 })) : rec.holes);
        if (rec.holes && mode === 'd') X.hole = holes(X, rec.holes.slice(0, 1).map(h => Object.assign({}, h, { rx: h.rx * 0.6, ry: h.ry * 0.6 })));
        if (placed) rec.bodies.forEach(b => body(X, b));
        if (gas && rec.name === 'the garden') rec.gas(X, placed ? 0.85 : 1);                   // pillars are solid: before the stars
        field(X, quiet ? Object.assign({}, rec, { mix }) : rec, full ? 1 : placed ? 0.9 : 0.62);
        (rec.clusters || []).forEach(c => cluster(X, c));
        rec.galaxies(X, full || placed ? 1 : 0.92);
        smudgeField(X, Math.round(rec.smudges * (full ? 1 : 0.7)), X.seed + 50);
        if (gas && rec.name !== 'the garden') rec.gas(X, placed ? 0.8 : 1);
        if (mode === 'e' && rec.wash) SK.nebula(B, Object.assign({ seed: X.seed + 200, lx: X.lx, ly: X.ly, reachL: 170 }, rec.wash, { w0: rec.wash.w0 + oy, w1: rec.wash.w1 + oy }));
        if (placed) {
            rec.place(X);
            const parts = rec.live(X).concat(ACCENTS_ON && rec.accents ? [accents(X, rec.accents)] : []);
            out.live = (c, t, D) => { const off = Math.max(0, Math.min(extra - 1, Math.round(D * SKY.DEEP))), tq = Math.floor(t / 125) * 125; c.save(); parts.forEach(fn => fn(c, tq, off, D)); c.restore(); };
        }
        return out;
    }

    window.V3Sky2 = { build, RECIPES };
})();
