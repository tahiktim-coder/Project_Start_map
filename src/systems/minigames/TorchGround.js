/* TorchGround.js — the cutting torch on a planet's surface (2026-10-21; used by Torch.js and TorchDoors.js).
   Every one of our wrecks lies on a planet (ExodusDerelicts.js: it landed, or it came down hard), so boarding one is played
   on the ground: bundle.js cutIntoWreck passes place 'ground' and world { type, temp, air, id }. What changes from space:
     SKY AND SOIL  the world's own sky over the hull's edge: its air glowing along the edge, its cloud colour, fewer stars
                   where the air is thick, its sun where the heading's light was; and its own soil heaped at the hull's foot.
                   The colours are the landing's for that world (LanderScene.look), so this is the place you just landed on
     JAXON         stands on the soil: no bobbing, no tether. With the torch he walks along under the seam and holds it up on
                   a telescopic pole (the hatch is high up the hull)
     GRAVITY       sparks arc down and bounce once off the soil; dust drifts down slowly in air and falls fast where there is
                   none; meltwater beads run down the plate; vapour and ice sink
     THE CRACK     a puff of dust out of the seam where there is air (the flash of ice stays where there is none)
     THE HATCH     it tips back into the wreck and falls flat on the corridor floor with a thud, and stays there
   The rules, timings, lines and results stay Torch.js's own. Without this file every place is space.
   window.TorchGround (frozen) = { is(setup), world(raw), look(setup), floorAt(x, setup), standAt(x, setup), paintSky,
                                   paintSoil, fly(q, dt, setup), puff(L, setup, x, y, k), lidAt(t), drawLid(g, angle, lid, d),
                                   jaxonAt(setup), drawPole(L, from, to, d) }
   Needs MiniLab, MiniPaint and Torch.js (window.MiniTorchKit); LanderScene and LanderGame for the world's look (without
   them the soil is plain stone and the sky plain dark). Load right after Torch.js, before TorchDoors.js. */
(function () {
    'use strict';
    const MiniLab = window.MiniLab, K = window.MiniTorchKit;
    if (!MiniLab || !K) return;
    const C = MiniLab.C, W = K.W, H = K.H, HB = K.HB, clamp = MiniLab.clamp;
    const P = () => window.MiniPaint;

    // ── the world: what the game passed, made safe ──
    const AIRS = ['BREATHABLE', 'THIN', 'TOXIC', 'CORROSIVE', 'HIGH_PRESSURE', 'NONE', 'UNKNOWN'];
    const AIR_GLOW = { NONE: 0.3, THIN: 0.7 };                        // how much of the landing's air glow shows: none, thin, the rest whole
    /** { type, temp, air, id } from whatever the game passed: a missing type is bare rock, missing air is thin. */
    function world(raw) {
        const w = raw && typeof raw === 'object' ? raw : {}, temp = Number(w.temp);
        return Object.freeze({
            type: typeof w.type === 'string' && w.type ? w.type : 'ROCKY',
            temp: Number.isFinite(temp) ? temp : null,
            air: AIRS.includes(w.air) ? w.air : 'THIN',
            id: w.id != null && String(w.id) ? String(w.id) : null,
        });
    }
    const is = setup => !!setup && setup.place === 'ground';
    const hasAir = setup => !(setup && setup.world && setup.world.air === 'NONE');

    /** The landing's look for this world (LanderScene.look over LanderGame's ground): its colours, air, cloud, sun, soil.
        Kept per world; null without the landing's recipes. */
    const looks = new Map();
    function look(setup) {
        const w = (setup && setup.world) || world(null), key = (w.id || '') + ':' + w.type;
        if (looks.has(key)) return looks.get(key);
        let S = null;
        try {
            const LS = window.LanderScene, LG = window.LanderGame;
            if (LS && LS.look && LG && LG.internals && LG.internals.buildGround) {
                const planet = { id: w.id || 'wreck:' + w.type, type: w.type };
                S = LS.look(LG.internals.buildGround(planet), planet);
            }
        } catch (e) { console.error('TorchGround: the world\'s look failed', e); S = null; }
        if (looks.size > 12) looks.clear();
        looks.set(key, S);
        return S;
    }
    const seedOf = setup => { const S = look(setup); return S ? S.seed % 997 : 7; };
    const kindOf = setup => { const S = look(setup), k = S ? S.kindName : 'rock'; return k === 'sky' ? 'haze' : k; };

    // ── the soil: where it meets the hull (floorAt: the berm's crest against the plates) and where people stand ──
    const FLOOR = 240, STAND = 251;                                      // units: the berm's crest about here, feet about here
    /** The y (units) where the soil meets the hull at x: a heaped, uneven line, never over the hatch or our lamp. */
    function floorAt(x, setup) {
        const s = seedOf(setup), N = P();
        const heap = 4 * Math.sin(x / 41 + s * 0.13) + 2.6 * Math.sin(x / 17 + s * 0.7) + (N.fbm(x / 23, 3.7, s + 5, 3) - 0.5) * 7;
        return clamp(FLOOR + heap, 233, 247);
    }
    /** Where someone standing in front of the hull at x has their feet (units): on the near ground, a little in front of the berm. */
    function standAt(x, setup) {
        const s = seedOf(setup);
        return Math.max(floorAt(x, setup) + 7, STAND + 1.6 * Math.sin(x / 53 + s * 0.3));
    }

    // ── the sky over the hull's edge: the landing's sky, its air hugging the edge ──
    const SUN_AT = K.FAR_LIGHT;                                          // the world's sun stands where the heading's light was
    /** Paints the sky above the hull's edge into p (art pixels, density d): replaces the sector's space and the heading's light. */
    function paintSky(p, setup, d) {
        const N = P(), S = look(setup), RP = N.RP, seed = S ? S.seed : 7;
        const airK = (S ? S.air : 0.16) * (AIR_GLOW[(setup.world || {}).air] == null ? 1 : AIR_GLOW[setup.world.air]);
        const airRamp = S ? S.airRamp : RP.ICE, cloud = S ? S.cloud : RP.DUST, haze = S ? S.haze : 1, dustK = S ? S.dust : 0.8;
        const sun = !S || S.sun, lx = (SUN_AT.x + 0.5) * d, ly = (SUN_AT.y + 0.5) * d;
        const edgeMax = Math.ceil((K.horizon(0) + 2) * d);
        for (let ay = 0; ay < Math.min(p.H, edgeMax); ay++) {
            for (let ax = 0; ax < p.W; ax++) {
                const x = (ax + 0.5) / d - 0.5, y = (ay + 0.5) / d - 0.5, t = K.horizon(x) - y;
                if (t < -1.5) continue;                                  // under the hull's edge: the plating covers it
                const reach = sun ? Math.exp(-Math.hypot(x - SUN_AT.x, (y - SUN_AT.y) * 1.3) / 120) : 0;
                const hz = Math.max(0, N.fbm(x / 46, y / 22, seed, 3) - 0.5) * 0.9 * haze;
                const ds = Math.max(0, N.fbm(x / 32, y / 15, seed + 7, 3) - 0.52) * 3.2 * dustK * (0.05 + 0.9 * reach);
                const air = airK * Math.exp(-Math.max(0, t) / 14) * (0.8 + 0.4 * N.fbm(x / 66, y / 12, seed + 3, 2)) + reach * 0.16 * airK;
                if (air > 0.02 && air >= ds * 0.6 && N.threshold(ax, ay) < N.smooth(0.02, 0.1, air)) p.solid(ax, ay, airRamp, air * 1.6);
                else if (ds > 0.12 && ds * 0.75 > hz) p.solid(ax, ay, cloud, ds);
                else if (hz > 0.03) p.solid(ax, ay, RP.HAZE, hz);
                else p.set(ax, ay, [5, 7, 10]);
            }
        }
        const rand = N.seeded(seed * 31 + 17), count = Math.round(260 * (1 - Math.min(0.9, airK * 1.4)));
        for (let i = 0; i < count; i++) {                                // stars where the air is thin enough: the landing's rule
            const x = rand() * W, y = rand() * 40, mag = rand(), ax = Math.floor((x + 0.5) * d), ay = Math.floor((y + 0.5) * d), t = K.horizon(x) - y;
            if (t < 2 || airK * Math.exp(-t / 11) > 0.22 * mag + 0.04 || Math.hypot(x - SUN_AT.x, y - SUN_AT.y) < 26) continue;
            if (mag > 0.985) { p.set(ax, ay, RP.STAR.rgb[4]); [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([ox, oy]) => p.set(ax + ox, ay + oy, RP.STAR.rgb[2])); }
            else p.set(ax, ay, RP.STAR.rgb[mag > 0.9 ? 3 : mag > 0.55 ? 2 : 1]);
        }
        if (sun) N.lightGlow(p, lx, ly, { core: 2.2 * d, halo: 9 * d, strength: 0.8 - 0.25 * Math.min(1, airK * 1.5), spikes: 5 * d }, 1);   // a sun seen through air is softer
    }

    // ── the soil at the hull's foot, in the world's own ground colour, and the dirt splashed up the lowest plates ──
    function paintSoil(p, setup, d, RR) {
        const N = P(), S = look(setup), GRD = S ? S.GRD : N.RP.STONE, seed = seedOf(setup), kind = kindOf(setup), L = K.LAMP;
        const top = Math.floor((233 - 8 + 0.5) * d);
        for (let ay = top; ay < p.H; ay++) for (let ax = 0; ax < p.W; ax++) {
            const x = (ax + 0.5) / d - 0.5, y = (ay + 0.5) / d - 0.5, f = floorAt(x, setup), t = y - f;
            if (t < -7) continue;
            if (t < 0) {                                                 // the plates just above the soil: dirt thrown up when it came down
                const dirt = (1 + t / 7) * (0.55 + 0.45 * N.fbm(x / 5, y / 2.5, seed + 3, 2));
                if (N.threshold(ax, ay) < dirt * 0.55) p.solid(ax, ay, GRD, 0.1 + 0.08 * N.vnoise(x / 3, y, seed + 4));
                continue;
            }
            p.solid(ax, ay, ...soilTone(N, S, GRD, kind, x, y, t, ax, ay, seed));
            const warm = Math.max(0, 1 - Math.hypot(x - L.x - 6, (y - f - 3) * 3) / 46);   // our lamp's spill on the soil just under it
            if (warm > 0 && N.threshold(ax, ay) < 0.22 * warm * warm) p.solid(ax, ay, N.RP.SUN, 0.16 + 0.14 * warm);
        }
        dress(p, setup, d, GRD, seed, kind, S);
    }
    /** One pixel of soil t units in front of the berm's crest → [ramp, tone]. Lit from above by the sky, in the hull's shadow;
        nearer the bottom of the picture is nearer to us: coarser, darker. */
    function soilTone(N, S, GRD, kind, x, y, t, ax, ay, seed) {
        const near = clamp(t / 30, 0, 1), sc = 1 + 2 * near;
        const strata = N.fbm(x / (16 * sc), y / (1.9 * sc), seed + 11, 3) - 0.5;   // a ground seen at a slant: long, low streaks
        const tex = N.fbm(x / (5 * sc), y / (2.4 * sc), seed + 12, 2) - 0.5;
        const g = N.vnoise(x / (1.5 * sc), y / (0.95 * sc), seed + 13), up = N.vnoise(x / (1.5 * sc), (y - 0.5 * sc) / (0.95 * sc), seed + 13);
        let v = 0.1 + 0.13 * (1 - near) - 0.05 * near * near + strata * 0.2 + tex * 0.08;
        if (t < 0.9) return [GRD, 0.04];                                 // tight under the hull: its shadow
        if (t < 2.4) v += 0.14 * (1 - Math.abs(t - 1.6) / 0.8);          // the berm's crest catches the sky
        else if (t < 5) v -= 0.03;                                       // and just in front of it, a little hollow
        if (g > 0.68) v += g > up ? 0.12 * (g - 0.68) / 0.32 + 0.05 : -0.05;   // stones: a lit top, a dark underside
        if (kind === 'ice') {
            v += 0.07;
            if (Math.abs(N.vnoise(x / (7 * sc), y / (2.2 * sc), seed + 5) - 0.5) < 0.015) v -= 0.14;   // cracks in the ice
            if (N.hash(ax, ay, 17) < 0.0012 && v > 0.2) return [GRD, 0.92];                         // now and then a glint
        } else if (kind === 'dunes') {
            v += 0.05 * Math.sin(x * 0.5 / sc + y * 2.1 / sc + strata * 4);                        // wind ripples
        } else if (kind === 'lava') {
            v = Math.min(0.3, v * 0.62);                                   // dark rock: its bright steps are the lava's own colours
            const crack = Math.abs(N.fbm(x / (22 * sc), y / (6 * sc), seed + 8, 2) - 0.5), patch = N.fbm(x / 70, y / 24, seed + 9, 2);
            if (S && patch > 0.6 && near > 0.2 && crack < 0.004) return [S.K.LAVA, 0.3 + 0.12 * near];   // here and there a crack still glows
        } else if (kind === 'sea') {
            if (S && N.hash(ax, ay, 19) < 0.0005 && g > 0.7) return [S.WATER, 0.4];             // now and then a wet stone catches the light, faintly
            v -= 0.01;
        } else if (kind === 'haze') {
            v -= 0.02;
        }
        return [GRD, clamp(v, 0.02, 0.6)];
    }
    /** What lies on the soil: stones (and tufts of grass on a living world, stalks on a hazy one), never where the team walks. */
    function dress(p, setup, d, GRD, seed, kind, S) {
        rocks(p, setup, d, GRD, seed, kind);
        if (kind !== 'green' && kind !== 'haze') return;
        const N = P(), rand = N.seeded(seed * 13 + 5), tuft = kind === 'green';
        for (let i = 0; i < (tuft ? 22 : 12); i++) {
            const x = 8 + rand() * 464, near = rand() < 0.5, base = near ? 258 + rand() * 9 : floorAt(x, setup) + 2 + rand() * 3;
            if (near && x > 140 && x < 440) continue;                   // nothing tall in front of where the team walks
            const blades = tuft ? 3 + Math.floor(rand() * 3) : 1, tall = (tuft ? 3 : 5) + rand() * (tuft ? 4 : 6) * (near ? 1.4 : 1);
            for (let b = 0; b < blades; b++) {
                const lean = (rand() - 0.5) * (tuft ? 1.2 : 0.3), h = tall * (0.6 + 0.4 * rand()), x0 = x + (b - blades / 2) * 0.7;
                const n = Math.ceil(h * d * 1.4);
                for (let k = 0; k <= n; k++) {
                    const q = k / n, px = (x0 + lean * h * q * q + 0.5) * d, py = (base - h * q + 0.5) * d;
                    p.solid(px, py, GRD, q > 0.75 ? 0.42 : 0.16 + 0.12 * q);
                }
            }
        }
    }
    /** A few stones: small ones at the berm, big ones in the corners, never where the team stands or walks. */
    function rocks(p, setup, d, GRD, seed, kind) {
        const N = P(), rand = N.seeded(seed * 7 + 3), L3 = N.norm3(0.62, -0.62, 0.48);
        const spots = [];
        for (let i = 0; i < 7; i++) spots.push({ x: 20 + rand() * 440, r: 1.6 + rand() * 2.4, near: false });
        spots.push({ x: 18 + rand() * 60, r: 6 + rand() * 4, near: true }, { x: 440 + rand() * 30, r: 5 + rand() * 4, near: true });
        spots.forEach(s => {
            if (!s.near && s.x > 140 && s.x < 440 && s.r > 2.6) s.r = 2.2;              // small where the team walks (they pass in front of them)
            const base = s.near ? 266 + s.r * 0.35 : floorAt(s.x, setup) + 2.5 + s.r * 0.4, cx = s.x, cy = base - s.r * 0.55, rx = s.r * 1.25, ry = s.r * 0.8;   // the big ones low, in front of anyone walking past
            K.eachArt(d, cx - rx - 2, cy - ry - 2, cx + rx + 3, base + 2, (ax, ay, x, y) => {
                const nx = (x - cx) / rx, ny = (y - cy) / ry, q = nx * nx + ny * ny;
                if (q >= 1) { if (y > base - 0.6 && y < base + 1.2 && Math.abs(x - cx - 1) < rx * 1.1 && N.threshold(ax, ay) < 0.7) p.solid(ax, ay, GRD, 0.03); return; }   // its shadow on the soil
                if (y > base) return;
                const nz = Math.sqrt(1 - q), lam = Math.max(0, nx * L3[0] + ny * L3[1] + nz * L3[2]);
                const ice = kind === 'ice' ? 0.08 : 0, dark = kind === 'lava' ? 0.6 : 1;   // lava rock stays dark
                p.solid(ax, ay, GRD, (0.06 + 0.42 * lam + ice + (N.fbm(x / 2, y / 2, seed + 21, 2) - 0.5) * 0.1) * dark);
            });
        });
    }

    // ── gravity: what flies off the hatch falls here ──
    const G = { spark: 300, ice: 210, vapour: 110, bead: 140, dustAir: 22, dustNone: 190 };   // units per second²
    const BEAD_MAX = 38, DUST_DRAG = 2.4, BOUNCE = 0.28;
    /** One step of a particle on the ground (Torch's sparks list: spark, ice, dust, vapour, bead, steam). */
    function fly(q, dt, setup) {
        const air = hasAir(setup);
        let vx = q.vx, vy = q.vy, life = q.life - dt, hit = q.hit;
        if (q.steam) { vy -= (air ? 4 : 0) * dt; }                         // steam rises in air
        else if (q.bead) { vx *= Math.exp(-3 * dt); vy = Math.min(BEAD_MAX, vy + G.bead * dt); }   // meltwater runs down the plate
        else if (q.dust) { if (air) { vx *= Math.exp(-DUST_DRAG * dt); vy = vy * Math.exp(-DUST_DRAG * dt) + G.dustAir * dt; } else vy += G.dustNone * dt; }
        else if (q.vapour) { vx *= Math.exp(-(air ? 1.2 : 0) * dt); vy += G.vapour * dt; }
        else vy += (q.ice ? G.ice : G.spark) * dt;
        const x = q.x + vx * dt, y = q.y + vy * dt, floor = floorAt(x, setup) - 0.5;
        if (y >= floor && vy > 0 && !q.steam) {                           // the soil: sparks bounce once and go out, the rest settles
            if (!q.dust && !q.bead && !hit) return Object.assign({}, q, { x, y: floor, vx: vx * 0.5, vy: -vy * BOUNCE, life: Math.min(life, 0.22), hit: true });
            return Object.assign({}, q, { x, y: floor, vx: 0, vy: 0, life: Math.min(life, q.dust ? 0.5 : 0.08), hit: true });
        }
        return Object.assign({}, q, { x, y, vx, vy, life });
    }
    /** A puff of dust (or of ice where there is no air) round (x, y) units, k: 1 fresh → 0 gone. Written into the layer L. */
    function puff(L, setup, x, y, k, d, r0) {
        const air = hasAir(setup), R = (r0 || 2) + 7 * (1 - k), tone = 0.68 * k * k;
        const cx = (x + 0.5) * d, cy = (y + 0.5) * d, rad = R * d;
        for (let ay = Math.floor(cy - rad); ay <= cy + rad; ay++) for (let ax = Math.floor(cx - rad); ax <= cx + rad; ax++) {
            const q = Math.hypot(ax + 0.5 - cx, (ay + 0.5 - cy) * 1.25) / rad;
            if (q < 1 && MiniLab.on(ax, ay, tone * (1 - q * q))) L.set(ax, ay, air ? (q < 0.45 ? C.textDim : C.mist) : (q < 0.5 ? C.uiBright : C.uiDim));
        }
    }

    // ── the hatch, cut free: it tips back into the wreck and falls flat on the corridor floor ──
    const HANG = 0.55, LAND = 2.3, THETA0 = 0.03, DEPTH = 120;        // s it hangs; s it lands (Torch's thud); its first lean; the corridor's depth scale (units)
    const GROW = Math.acosh((Math.PI / 2) / THETA0) / (LAND - HANG);    // a falling slab: slow to start, fast at the end
    /** The hatch's angle back from upright (radians), t seconds after the crack: hangs, falls, lands at LAND, rocks once, lies flat. */
    function lidAt(t) {
        if (t <= 0) return 0;
        if (t < HANG) return THETA0 * MiniLab.clamp(t / HANG, 0, 1) ** 2;
        if (t < LAND) return Math.min(Math.PI / 2, THETA0 * Math.cosh(GROW * (t - HANG)));
        const k = t - LAND;
        return Math.PI / 2 - (k < 0.36 ? 0.07 * Math.sin(Math.PI * k / 0.36) : 0);   // one small bounce
    }
    const shaded = new WeakMap();
    /** The lid darkened toward the ink in three steps (art pixels, the house dither), made once per lid. */
    function shades(lid) {
        if (shaded.has(lid)) return shaded.get(lid);
        const make = k => {
            const c = Object.assign(document.createElement('canvas'), { width: lid.width, height: lid.height }), g = c.getContext('2d');
            g.drawImage(lid, 0, 0);
            const img = g.getImageData(0, 0, c.width, c.height), px = img.data;
            for (let ay = 0; ay < c.height; ay++) for (let ax = 0; ax < c.width; ax++) {
                const o = (ay * c.width + ax) * 4;
                if (!px[o + 3] || !MiniLab.on(ax, ay, k)) continue;
                px[o] = 5; px[o + 1] = 7; px[o + 2] = 10;
            }
            g.putImageData(img, 0, 0);
            return c;
        };
        const out = [lid, make(0.22), make(0.42)];
        shaded.set(lid, out);
        return out;
    }
    /** Draws the hatch at `angle` back from upright, hinged on its bottom edge, in the corridor's own perspective (VP). */
    function drawLid(g, angle, lid, d) {
        const VP = K.VP, bot = HB.cy + HB.hh, x0 = HB.cx - HB.hw - 1, x1 = HB.cx + HB.hw + 1, ay0 = Math.floor((HB.cy - HB.hh - 1 + 0.5) * d), ay1 = Math.ceil((bot + 1 + 0.5) * d);
        const imgs = shades(lid), img = imgs[angle < 0.5 ? 0 : angle < 1.1 ? 1 : 2], c = Math.cos(angle), s = Math.sin(angle);
        const sx0 = Math.floor((x0 + 0.5) * d), sw = Math.ceil((x1 + 0.5) * d) - sx0;
        const at = ay => { const h = bot - ((ay + 0.5) / d - 0.5), z = 1 + (h * s) / DEPTH; return { y: VP.y + (bot - VP.y - h * c) / z, z }; };
        g.save(); g.imageSmoothingEnabled = false;
        for (let ay = ay0; ay <= ay1; ay++) {                            // the top first: it is the farthest
            const a = at(ay), b = at(ay + 1), left = VP.x + (x0 - VP.x) / a.z, right = VP.x + (x1 - VP.x) / a.z;
            const top = Math.round((a.y + 0.5) * d), hgt = Math.max(1, Math.round((b.y + 0.5) * d) - top + 1);
            g.drawImage(img, sx0, ay, sw, 1, Math.round((left + 0.5) * d), top, Math.max(1, Math.round((right - left) * d)), hgt);
        }
        if (angle > 1.2) {                                               // lying down: its far edge (the top it fell on) catches what light there is
            const e = at(Math.floor((HB.cy - HB.hh + 1.5 + 0.5) * d)), l = VP.x + (HB.cx - HB.hw + HB.r * 0.6 - VP.x) / e.z, r = VP.x + (HB.cx + HB.hw - HB.r * 0.6 - VP.x) / e.z;
            g.fillStyle = C.hull[3];
            g.fillRect(Math.round((l + 0.5) * d), Math.round((e.y + 0.5) * d), Math.max(1, Math.round((r - l) * d)), 1);
        }
        g.restore();
    }

    // ── Jaxon on the ground ──
    const SIDE_GAP = 8, OFF = 34, WALK = 62, JAX_MIN = 150, JAX_MAX = 436;   // he stands this far beside the tip, on the hatch's own side
    /** Where Jaxon stands while he works the tip with the pole: on the soil beside it, on the side of the hatch the tip is on. */
    function workAt(tip, side, setup) {
        const nextSide = tip.x < HB.cx - SIDE_GAP ? -1 : tip.x > HB.cx + SIDE_GAP ? 1 : side;
        const x = clamp(tip.x + nextSide * OFF, JAX_MIN, JAX_MAX);
        return { x, y: standAt(x, setup), side: nextSide, facing: tip.x >= x ? 1 : -1 };
    }
    /** Moves Jaxon toward `want` at walking pace (units a second); returns him and whether he is walking. */
    function walkTo(j, want, dt, setup) {
        const dx = want.x - j.x, step = Math.min(Math.abs(dx), WALK * dt), x = j.x + Math.sign(dx) * step;
        return { x, y: standAt(x, setup), walking: step > 0.4 * WALK * dt && Math.abs(dx) > 1.5 };
    }
    /** The telescopic pole from the torch's grip down to his hands: a thin tube, lit on its upper side, two collars. */
    function drawPole(L, from, to, d, tool) {
        const len = Math.hypot(to.x - from.x, to.y - from.y);
        if (len < 2) return;
        const ux = (to.x - from.x) / len, uy = (to.y - from.y) / len, nx = -uy, ny = ux, lit = nx - ny >= 0 ? 1 : -1;
        const n = Math.ceil(len * d * 1.5);
        for (let i = 0; i <= n; i++) {                                   // an ink outline, a dark underside, a lit top; the collars brighter
            const k = i / n, x = (from.x + (to.x - from.x) * k + 0.5) * d, y = (from.y + (to.y - from.y) * k + 0.5) * d;
            const collar = [0.34, 0.67].some(c => Math.abs(k - c) < 1.4 / len);
            L.set(x + nx * lit * 1.7, y + ny * lit * 1.7, C.void);
            L.set(x - nx * lit * 1.5, y - ny * lit * 1.5, C.void);
            L.set(x - nx * lit * 0.6, y - ny * lit * 0.6, collar ? tool[3] : tool[2]);
            L.set(x, y, collar ? tool[4] : tool[3]);
            L.set(x + nx * lit * 0.8, y + ny * lit * 0.8, collar ? tool[5] : tool[4]);
        }
    }
    /** Where Jaxon waits on the ground: his feet by our lamp. */
    const jaxonAt = setup => ({ x: K.JAX.IDLE.x, y: standAt(K.JAX.IDLE.x, setup) });
    /** A soft dark patch under someone standing on the soil. */
    function footShadow(L, x, y, d, w) {
        const cx = (x + 0.5) * d, cy = (y + 0.5) * d, rx = (w || 10) * d, ry = 1.6 * d;
        for (let ay = Math.floor(cy - ry); ay <= cy + ry; ay++) for (let ax = Math.floor(cx - rx); ax <= cx + rx; ax++) {
            const q = ((ax + 0.5 - cx) / rx) ** 2 + ((ay + 0.5 - cy) / ry) ** 2;
            if (q < 1 && MiniLab.on(ax, ay, 0.75 * (1 - q))) L.set(ax, ay, C.void);
        }
    }

    // ── the airlock's panel stands lower on the ground, where Jaxon can reach it from the soil (TorchDoors.js) ──

    window.TorchGround = Object.freeze({
        is, world, look, hasAir, floorAt, standAt, paintSky, paintSoil, fly, puff, lidAt, drawLid, LAND,
        workAt, walkTo, drawPole, jaxonAt, footShadow,
    });
})();
