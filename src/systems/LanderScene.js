/* LanderScene — everything in the landing minigame that is not physics: the place you are landing on.
   build(ground, planet) paints a static backdrop once (dithered sky glow, a lit moon, far ridges or cloud decks,
   shaded terrain with strata, rocks and per-world dressing). drawLive() adds what moves each frame:
   lava and water, wind, fog, exhaust smoke, dust, the lander's shadow, the ship above.
   Nobody built anything on these worlds: the level ground you land on is just ground. The one exception is a gas
   giant, which has no ground at all — there a floating rig with beacons, chevrons and lift pods is the only place to set down.
   Colours come from the planet's own dither ramp, so the ground matches the globe you saw from orbit.
   Strange worlds (crystal, mirror, singing, ghost, tomb, graveyard, hollow, living, machine, shattered, fungal, symbiote,
   rogue, radiation) get their own look on top of the terrain; the flat strips you land on stay clear. */

(function () {
    'use strict';
    const W = 320, H = 180, PAD_WIDTH = 42, HORIZON = 150;
    const INK = [6, 7, 10], BONE = '#c4d0c4', AMBER = '#d9a24a', AMBER_DIM = '#5a4520';
    const FALLBACK_RAMP = [[6, 7, 10], [16, 32, 26], [27, 51, 41], [47, 90, 72], [116, 217, 154], [214, 255, 228]];
    const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    const MAX_PARTICLES = 90, SMOKE_LIFE = 1.1, DUST_LIFE = 0.7, DUST_HEIGHT = 30;
    const SHIP_HALF = 46, SHIP_TALL = 8;

    /** Ordered dither: true for a share `v` (0..1) of pixels, in a fixed 4×4 pattern. */
    const dith = (x, y, v) => v * 16 > BAYER[(y & 3) * 4 + (x & 3)];
    const css = c => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
    const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    const clampX = x => Math.max(0, Math.min(W - 1, x));

    function seeded(id) {
        let s = 23;
        String(id || 'x').split('').forEach(ch => { s = ((s * 31) + ch.charCodeAt(0)) >>> 0; });
        return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    }

    function rampOf(planet) {
        const recipe = window.DitherRecipes && window.DitherRecipes.TYPES && window.DitherRecipes.TYPES[planet.type];
        const ramp = recipe && recipe.ramp && recipe.ramp.length >= 5 ? recipe.ramp : FALLBACK_RAMP;
        return ramp.length >= 6 ? ramp : ramp.concat([ramp[ramp.length - 1]]);
    }

    const put = (ctx, x, y, color) => { ctx.fillStyle = color; ctx.fillRect(x, y, 1, 1); };

    // ── static backdrop ──
    function paintSky(ctx, ramp, rand, kind) {
        const glow = css(mix(ramp[1], INK, 0.35)), horizonGlow = css(mix(ramp[2], INK, 0.45));
        ctx.fillStyle = css(INK); ctx.fillRect(0, 0, W, H);
        for (let y = 0; y < HORIZON + 10; y++) {
            const t = y / HORIZON;
            for (let x = 0; x < W; x++) {
                if (dith(x, y, (t - 0.62) * 1.5)) put(ctx, x, y, horizonGlow);
                else if (dith(x, y, Math.pow(t, 2.2) * 0.85)) put(ctx, x, y, glow);
            }
        }
        const starCount = kind.platform || kind.wind >= 4 ? 25 : 70; // thick air hides the stars
        for (let k = 0; k < starCount; k++) {
            const x = Math.floor(rand() * W), y = Math.floor(rand() * 105);
            put(ctx, x, y, rand() < 0.2 ? BONE : css(mix(ramp[4], INK, 0.55)));
        }
    }

    /** A moon (or the sun's neighbour) hanging in the sky, lit from one side so it reads as a crescent. */
    function paintMoon(ctx, ramp, rand) {
        const cx = 40 + rand() * 240, cy = 24 + rand() * 40, r = 14 + rand() * 22, lx = rand() < 0.5 ? -0.8 : 0.8;
        const lit = css(mix(ramp[4], INK, 0.25)), mid = css(mix(ramp[3], INK, 0.4));
        for (let y = Math.floor(cy - r); y <= cy + r; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
            const dx = (x - cx) / r, dy = (y - cy) / r, q = dx * dx + dy * dy;
            if (q >= 1 || x < 0 || x >= W || y < 0) continue;
            const light = dx * lx + dy * -0.35 + Math.sqrt(1 - q) * 0.45;
            if (light > 0.15 && dith(x, y, light)) put(ctx, x, y, light > 0.7 ? lit : mid);
        }
    }

    function paintFarRidge(ctx, ramp, rand) {
        const a = rand() * 6.28, b = rand() * 6.28, body = css(mix(ramp[1], INK, 0.5)), haze = css(mix(ramp[2], INK, 0.5));
        for (let x = 0; x < W; x++) {
            const top = Math.round(116 + 10 * Math.sin(x * 0.017 + a) + 6 * Math.sin(x * 0.043 + b) - 8 * Math.pow(Math.abs(Math.sin(x * 0.009 + a)), 3));
            for (let y = top; y < H; y++) put(ctx, x, y, y - top < 7 && dith(x, y, 0.55 - (y - top) * 0.07) ? haze : body);
        }
    }

    /** Gas giants have no ground: three decks of cloud, the nearest one brightest. */
    function paintCloudDecks(ctx, ramp, rand) {
        [[112, 0.011, 1], [134, 0.019, 2], [156, 0.031, 3]].forEach(([base, freq, stop]) => {
            const phase = rand() * 6.28, top = css(mix(ramp[stop + 1], INK, 0.3)), body = css(mix(ramp[stop], INK, 0.35));
            for (let x = 0; x < W; x++) {
                const y0 = Math.round(base + 7 * Math.sin(x * freq * 3 + phase) + 4 * Math.sin(x * freq * 7 + phase * 2));
                for (let y = y0; y < H; y++) put(ctx, x, y, dith(x, y, 0.8 - (y - y0) * 0.05) ? top : body);
            }
        });
    }

    /** Soil tones from the planet's ramp. Living worlds keep ocean blues in their low stops, so their land is tinted from the bright end instead. */
    function soilOf(ramp, kindName) {
        const isBlueLow = ramp[2][2] > ramp[2][1];
        if (kindName !== 'green' || !isBlueLow) return { upper: ramp[2], mid: ramp[1] };
        return { upper: mix(ramp[4], INK, 0.5), mid: mix(ramp[4], INK, 0.72) };
    }

    function paintTerrain(ctx, g, ramp, kindName) {
        if (g.kind.platform) return; // nothing but cloud under a floating rig
        const soil = soilOf(ramp, kindName);
        const edge = css(ramp[3]), edgeLit = css(ramp[4]), upper = css(soil.upper), mid = css(soil.mid), deep = css(mix(soil.mid, INK, 0.6));
        for (let x = 0; x < W; x++) {
            const top = Math.round(g.heights[x]);
            if (top > H || g.hot[x]) continue;
            const isFacingLight = g.heights[clampX(x + 1)] > g.heights[x] + 0.3; // light comes from the left
            for (let y = top; y < H; y++) {
                const depth = y - top, strata = 0.1 * Math.sin(y * 0.55 + x * 0.025);
                if (depth === 0) put(ctx, x, y, isFacingLight ? edgeLit : edge);
                else if (depth < 26) put(ctx, x, y, dith(x, y, 0.85 - depth / 30 + strata) ? upper : mid);
                else put(ctx, x, y, dith(x, y, 0.7 - (depth - 26) / 40 + strata) ? mid : deep);
            }
        }
    }

    const DRESSING_GAP = 3; // rocks and growth keep this far off a level stretch, so a flat ledge looks like one
    const isOnLevel = (g, x) => (g.level || []).some(l => x >= l.x0 - DRESSING_GAP && x <= l.x1 + DRESSING_GAP);
    const isFreeGround = (g, x) => x > 2 && x < W - 3 && !g.hot[x] && g.heights[x] < H && !isOnLevel(g, x);

    /** What grows, juts or lies on the surface: this is what makes an ice world not look like a desert. */
    function paintDressing(ctx, g, ramp, rand, kindName) {
        const light = css(ramp[5]), bright = css(ramp[4]), body = css(ramp[3]), dark = css(mix(ramp[1], INK, 0.4));
        for (let k = 0; k < 26; k++) {
            const x = Math.floor(rand() * W), top = Math.round(g.heights[x]);
            if (!isFreeGround(g, x)) continue;
            if (kindName === 'ice') { const tall = 3 + Math.floor(rand() * 7); for (let d = 0; d < tall; d++) put(ctx, x + (d > tall / 2 ? 1 : 0), top - d, d === tall - 1 ? light : bright); }
            else if (kindName === 'green' && k % 3 === 0) { ctx.fillStyle = dark; ctx.fillRect(x, top - 4, 1, 4); ctx.fillStyle = body; ctx.fillRect(x - 2, top - 8, 5, 4); ctx.fillStyle = bright; ctx.fillRect(x - 1, top - 9, 3, 2); }
            else if (kindName === 'green') { put(ctx, x, top - 1, bright); put(ctx, x + 1, top - 2, bright); }
            else if (kindName === 'haze') { const tall = 4 + Math.floor(rand() * 6); ctx.fillStyle = dark; ctx.fillRect(x, top - tall, 1, tall); put(ctx, x + 1, top - tall + 1, dark); }
            else if (kindName === 'lava') { let cx = x; for (let d = 1; d < 9; d++) { cx += rand() < 0.5 ? -1 : 1; put(ctx, clampX(cx), top + d, d < 4 ? '#ff7038' : '#a8321c'); } }
            else if (kindName === 'dunes') { for (let d = 3; d < 16; d += 4) for (let r = 0; r < 9; r++) if ((r + d) % 3) put(ctx, clampX(x + r), Math.round(g.heights[clampX(x + r)]) + d, body); }
            else { const size = 2 + Math.floor(rand() * 3); ctx.fillStyle = body; ctx.fillRect(x, top - size + 1, size + 1, size); put(ctx, x, top - size + 1, bright); } // boulders
        }
    }

    /** The gas-giant rig: a floating deck with girders hanging under it, two lift pods, and beacon masts. */
    function paintPlatform(ctx, g) {
        const x = g.padX, y = g.padY;
        for (let k = 0; k < PAD_WIDTH; k++) put(ctx, x + k, y + 1, Math.floor(k / 4) % 2 ? AMBER_DIM : '#15181a'); // hazard stripes under the deck
        ctx.fillStyle = BONE; ctx.fillRect(x, y, PAD_WIDTH, 1);
        ctx.fillStyle = '#3a3f3c';
        for (let d = 2; d < 16; d++) for (let k = d; k < PAD_WIDTH - d; k++) if ((k + d) % 4 === 0 || d === 2) put(ctx, x + k, y + d, '#3a3f3c');
        ctx.fillRect(x - 5, y - 1, 5, 6); ctx.fillRect(x + PAD_WIDTH, y - 1, 5, 6);
        ctx.fillStyle = '#3a3f3c'; ctx.fillRect(x - 1, y - 4, 1, 4); ctx.fillRect(x + PAD_WIDTH, y - 4, 1, 4); // beacon masts
    }


    // ── strange worlds: the places that should not look like anywhere else ──
    const freeSpots = (g, rand, count, gap) => {                      // x positions on open ground, spread out, off the flat strips
        const spots = [];
        for (let tries = 0; spots.length < count && tries < count * 20; tries++) {
            const x = 6 + Math.floor(rand() * (W - 12));
            if (isFreeGround(g, x) && spots.every(o => Math.abs(o - x) >= gap)) spots.push(x);
        }
        return spots;
    };
    const groundAt = (g, x) => Math.round(g.heights[clampX(x)]);

    function paintCrystals(ctx, g, ramp, rand) {                      // tall glassy spires, lit on one edge, a glint at the tip
        freeSpots(g, rand, 11, 14).forEach(x => {
            const top = groundAt(g, x), tall = 12 + Math.floor(rand() * 18), half = 2 + Math.floor(rand() * 2), lean = rand() < 0.5 ? -1 : 1;
            for (let d = 0; d < tall; d++) {
                const w = Math.max(0, Math.round(half * (1 - d / tall))), cx = x + Math.round(lean * d * 0.18);
                for (let k = -w; k <= w; k++) put(ctx, clampX(cx + k), top - d, k === -w ? css(ramp[5]) : dith(cx + k, top - d, 0.55) ? css(ramp[4]) : css(ramp[3]));
            }
            put(ctx, clampX(x + Math.round(lean * tall * 0.18)), top - tall, '#ffffff');
        });
    }

    function paintMirror(ctx, g) {                                     // the ground is a mirror: the sky, the moon and the stars shine back up out of it
        const img = ctx.getImageData(0, 0, W, H), src = new Uint8ClampedArray(img.data), STRETCH = 2.4;
        for (let x = 0; x < W; x++) {
            const top = groundAt(g, x);
            if (top > H || g.hot[x]) continue;
            for (let d = 1; top + d < H; d++) {
                const sy = Math.round(top - d * STRETCH); if (sy < 0) break;
                const si = (sy * W + x) * 4, di = ((top + d) * W + x) * 4, fade = 0.95 - d / 90;
                const glint = (x + d * 3) % 23 === 0 ? 40 : 0;                                   // thin bright streaks: it is polished
                img.data[di] = Math.min(255, src[si] * fade * 1.5 + 18 + glint); img.data[di + 1] = Math.min(255, src[si + 1] * fade * 1.5 + 24 + glint); img.data[di + 2] = Math.min(255, src[si + 2] * fade * 1.5 + 40 + glint);
            }
            const edge = (top * W + x) * 4; img.data[edge] = 230; img.data[edge + 1] = 236; img.data[edge + 2] = 240;   // a bright polished rim
        }
        ctx.putImageData(img, 0, 0);
    }
    function drawReflection(ctx, g, s) {                               // …and so is the lander, upside down, under its own feet
        const x = Math.round(s.x), ground = groundAt(g, x);
        if (ground > H || g.hot[clampX(x)]) return;
        const feet = Math.round(s.y) + 9, gap = ground - feet, top = ground + Math.round(gap / 2.4);
        if (gap < 0 || top > H - 4) return;
        ctx.fillStyle = 'rgba(214, 224, 214, 0.55)';
        ctx.fillRect(x - 5, top + 3, 11, 6); ctx.fillRect(x - 6, top, 2, 3); ctx.fillRect(x + 5, top, 2, 3); ctx.fillRect(x - 2, top + 9, 5, 2);
    }

    function paintPillars(ctx, g, ramp, rand, scene) {                 // hollow stone columns full of holes; the wind sings through them
        scene.pillars = freeSpots(g, rand, 9, 22).map(x => {
            const top = groundAt(g, x), tall = 34 + Math.floor(rand() * 34), half = 3;
            for (let d = 0; d < tall; d++) for (let k = -half; k <= half; k++) {
                const isHole = Math.abs(k) <= 1 && d % 8 >= 3 && d % 8 <= 4 && d > 4;
                put(ctx, clampX(x + k), top - d, isHole ? css(INK) : k === -half ? css(ramp[5]) : k === half ? css(mix(ramp[1], INK, 0.3)) : css(ramp[3]));
            }
            return { x, y: top - tall, phase: rand() * 1600 };
        });
    }
    function drawSoundRings(ctx, g, scene, now) {
        (scene.pillars || []).forEach(p => {
            for (let ring = 0; ring < 2; ring++) {
                const t = ((now + p.phase + ring * 800) % 1600) / 1600, r = 4 + t * 34;
                ctx.fillStyle = css(scene.ramp[5]);
                for (let a = 0; a < 6.28; a += 0.12) { const px = Math.round(p.x + Math.cos(a) * r), py = Math.round(p.y + 6 + Math.sin(a) * r * 0.4); if (dith(px, py, 1.05 - t)) ctx.fillRect(px, py, 1, 1); }
            }
        });
    }

    function paintGhostRidge(ctx, g, ramp) {                           // a see-through copy of the ground hangs above the real one
        const body = css(mix(ramp[3], INK, 0.35)), edge = css(ramp[5]);
        for (let x = 0; x < W; x++) {
            const y0 = groundAt(g, x - 14) - 34;
            if (y0 < 30 || y0 > H) continue;
            put(ctx, x, y0, edge);
            for (let y = y0 + 1; y < y0 + 26 && y < groundAt(g, x) - 2; y++) if (dith(x, y, 0.32 - (y - y0) * 0.011)) put(ctx, x, y, body);
        }
    }
    function drawGhostFlicker(ctx, g, scene, now) {
        if (Math.floor(now / 230) % 9 !== 0) return;                   // now and then the copy is brighter than the real ground
        ctx.fillStyle = css(scene.ramp[5]);
        for (let x = 0; x < W; x++) { const y = groundAt(g, x - 14) - 34; if (y > 30 && y < H) { ctx.fillRect(x, y, 1, 1); ctx.fillRect(x, y + 1, 1, 1); } }
    }

    function paintMarkers(ctx, g, ramp, rand) {                        // rows of grave markers, as far as you can see
        [[0, 0], [3, -3]].forEach(([shift, lift]) => {
            for (let x = 4 + shift; x < W - 4; x += 7) {
                if (!isFreeGround(g, x)) continue;
                const top = groundAt(g, x) + lift;
                ctx.fillStyle = css(lift ? mix(ramp[3], INK, 0.45) : ramp[4]); ctx.fillRect(x, top - 5, 3, 5);
                ctx.fillStyle = css(lift ? mix(ramp[4], INK, 0.4) : ramp[5]); ctx.fillRect(x, top - 5, 3, 1);
            }
        });
    }

    function paintHullDebris(ctx, g, ramp, rand) {                     // dead ships, broken and half in the ground, as far as you can see
        freeSpots(g, rand, 5, 46).forEach((x, i) => {
            const top = groundAt(g, x), len = 26 + Math.floor(rand() * 22), tall = 7 + Math.floor(rand() * 4), tilt = (rand() - 0.5) * 0.35;
            for (let k = 0; k < len; k++) {
                const y = Math.round(top - tall + 3 + tilt * k), isTorn = k > len - 5 && (k + i) % 2;
                if (isTorn) continue;
                ctx.fillStyle = '#231a18'; ctx.fillRect(clampX(x + k), y, 1, tall);
                put(ctx, clampX(x + k), y, k % 6 === 0 ? '#c4d0c4' : '#8a4a3a');                                   // the lit top edge, with rivet lines
                if (k % 9 === 4) put(ctx, clampX(x + k), y + 3, '#4a3a34');                                          // a window, dark
            }
            if (i % 2 === 0) { ctx.fillStyle = '#3a2d28'; ctx.fillRect(clampX(x + len), top - tall - 2, 6, tall + 2); ctx.fillStyle = '#8a4a3a'; ctx.fillRect(clampX(x + len), top - tall - 2, 6, 1); } // a drive bell
        });
    }

    function paintHoles(ctx, g, ramp, rand, scene) {                   // round holes into the dark, with a light far down in some
        scene.holes = freeSpots(g, rand, 6, 26).map(x => {
            const top = groundAt(g, x) + 3, r = 4 + Math.floor(rand() * 4);
            for (let y = -r; y <= r; y++) for (let k = -r * 2; k <= r * 2; k++) if ((k * k) / 4 + y * y <= r * r) put(ctx, clampX(x + k), top + y, css(INK));
            ctx.fillStyle = css(ramp[4]); ctx.fillRect(clampX(x - r * 2), top - r, r * 4, 1);
            return { x, y: top, lit: rand() < 0.6 };
        });
    }
    function drawHoleLights(ctx, g, scene, now) {
        (scene.holes || []).forEach((h, i) => { if (h.lit && Math.floor(now / 700 + i) % 4) { ctx.fillStyle = AMBER; ctx.fillRect(h.x, h.y + 1, 1, 1); } });
    }

    function paintVeins(ctx, g, ramp, rand, scene) {                   // the ground is alive: veins running under the skin
        scene.veins = [];
        for (let v = 0; v < 9; v++) {
            let x = Math.floor(rand() * W), depth = 3 + Math.floor(rand() * 10);
            for (let k = 0; k < 40; k++) {
                x += rand() < 0.5 ? -1 : 1; depth += rand() < 0.3 ? (rand() < 0.5 ? -1 : 1) : 0;
                const gx = clampX(x), y = groundAt(g, gx) + Math.max(2, depth);
                if (y < H && !g.hot[gx]) { put(ctx, gx, y, css(mix(ramp[4], INK, 0.3))); scene.veins.push([gx, y, k + v * 7]); }
            }
        }
    }
    function drawPulse(ctx, g, scene, now) {
        const wave = (now / 60) % 60;
        ctx.fillStyle = css(scene.ramp[5]);
        (scene.veins || []).forEach(([x, y, k]) => { if (Math.abs((k % 60) - wave) < 3) ctx.fillRect(x, y, 1, 1); });
    }

    function paintPlating(ctx, g, ramp, rand, scene) {                 // machine ground: plates, seams, small lights
        const seam = css(mix(ramp[1], INK, 0.5));
        for (let x = 0; x < W; x++) {
            const top = groundAt(g, x);
            if (top > H || g.hot[x]) continue;
            for (let y = top + 1; y < H; y++) if (x % 12 === 0 || (y - top) % 9 === 0) put(ctx, x, y, seam);
        }
        scene.lamps = freeSpots(g, rand, 10, 16).map(x => ({ x, y: groundAt(g, x) + 4, phase: Math.floor(rand() * 5) }));
    }
    function drawPlateLights(ctx, g, scene, now) {
        (scene.lamps || []).forEach(l => { ctx.fillStyle = (Math.floor(now / 400) + l.phase) % 5 === 0 ? '#7fd0de' : AMBER_DIM; ctx.fillRect(l.x, l.y, 2, 1); });
    }

    function planFloatingRocks(g, rand, scene) {                       // pieces of the planet hang in the air
        scene.rocks = Array.from({ length: 7 }, () => ({ x: 20 + rand() * (W - 40), y: 36 + rand() * 60, r: 3 + rand() * 6, phase: rand() * 6.28 }));
    }
    function drawFloatingRocks(ctx, g, scene, now) {
        (scene.rocks || []).forEach(rock => {
            const cy = Math.round(rock.y + Math.sin(now / 1400 + rock.phase) * 2), r = rock.r;
            for (let y = -r; y <= r; y++) for (let x = -r * 1.3; x <= r * 1.3; x++) {
                if ((x * x) / 1.69 + y * y > r * r) continue;
                const px = Math.round(rock.x + x), py = cy + y;
                ctx.fillStyle = y < -r * 0.3 ? css(scene.ramp[4]) : dith(px, py, 0.5) ? css(scene.ramp[2]) : css(scene.ramp[1]);
                ctx.fillRect(px, py, 1, 1);
            }
        });
    }

    function paintSporeTowers(ctx, g, ramp, rand, scene) {             // mushroom towers taller than the lander
        scene.caps = freeSpots(g, rand, 7, 26).map(x => {
            const top = groundAt(g, x), tall = 16 + Math.floor(rand() * 22), capR = 4 + Math.floor(rand() * 4);
            ctx.fillStyle = css(mix(ramp[2], INK, 0.2)); ctx.fillRect(x, top - tall, 2, tall);
            for (let y = -capR; y <= 0; y++) for (let k = -capR * 2; k <= capR * 2; k++) if ((k * k) / 4 + y * y <= capR * capR) put(ctx, clampX(x + k), top - tall + y, y > -2 ? css(ramp[2]) : css(ramp[4]));
            return { x, y: top - tall - capR };
        });
    }
    function drawSpores(ctx, g, scene, now) {
        ctx.fillStyle = css(scene.ramp[5]);
        (scene.caps || []).forEach((c, i) => { for (let k = 0; k < 3; k++) { const t = ((now / 2600) + k / 3 + i * 0.13) % 1; ctx.fillRect(Math.round(c.x + Math.sin(t * 9 + i) * 4), Math.round(c.y - t * 40), 1, 1); } });
    }

    function paintTendrils(ctx, g, ramp, rand, scene) {                // soft glowing stalks, leaning toward whoever lands
        scene.tips = freeSpots(g, rand, 12, 16).map(x => {
            const top = groundAt(g, x), tall = 8 + Math.floor(rand() * 14), bend = (rand() - 0.5) * 0.6;
            for (let d = 0; d < tall; d++) put(ctx, clampX(x + Math.round(Math.sin(d * 0.2) * 2 + d * bend)), top - d, css(mix(ramp[3], INK, 0.2)));
            return { x: clampX(x + Math.round(Math.sin(tall * 0.2) * 2 + tall * bend)), y: top - tall };
        });
    }
    function drawTips(ctx, g, scene, now) {
        (scene.tips || []).forEach((t, i) => { ctx.fillStyle = Math.floor(now / 500 + i) % 3 ? css(scene.ramp[5]) : css(scene.ramp[3]); ctx.fillRect(t.x - 1, t.y - 1, 2, 2); });
    }

    function paintStarless(ctx, ramp, rand) {                          // a rogue world has no sun: black sky, a few cold stars
        ctx.fillStyle = css(INK); ctx.fillRect(0, 0, W, 112);
        for (let k = 0; k < 40; k++) put(ctx, Math.floor(rand() * W), Math.floor(rand() * 108), rand() < 0.3 ? BONE : '#3a4a40');
    }

    function drawAurora(ctx, g, scene, now) {                          // radiation lights the sky in moving curtains
        for (let band = 0; band < 3; band++) {
            const base = 26 + band * 16, drift = now / (1800 + band * 500);
            for (let x = 0; x < W; x += 1) {
                const y = Math.round(base + 6 * Math.sin(x * 0.03 + drift + band));
                for (let d = 0; d < 10; d++) if (dith(x, y + d, 0.35 - d * 0.03)) { ctx.fillStyle = band % 2 ? '#74d99a' : '#3f8a6a'; ctx.fillRect(x, y + d, 1, 1); }
            }
        }
    }

    // type → [static painter, live painter]
    const STRANGE = {
        CRYSTALLINE: [paintCrystals], MIRROR: [(ctx, g) => paintMirror(ctx, g), (ctx, g, scene, now, s) => drawReflection(ctx, g, s)],
        SINGING: [paintPillars, drawSoundRings], GHOST_WORLD: [paintGhostRidge, drawGhostFlicker], TOMB_WORLD: [paintMarkers],
        GRAVEYARD: [paintHullDebris], HOLLOW: [paintHoles, drawHoleLights], BIO_MASS: [paintVeins, drawPulse],
        MECHA: [paintPlating, drawPlateLights], MACHINE_WORLD: [paintPlating, drawPlateLights],
        SHATTERED: [(ctx, g, ramp, rand, scene) => planFloatingRocks(g, rand, scene), drawFloatingRocks],
        FUNGAL: [paintSporeTowers, drawSpores], SYMBIOTE_WORLD: [paintTendrils, drawTips], RADIATION_BELT: [null, drawAurora],
    };

    function build(g, planet) {
        const kindName = g.kindName || 'rock';
        const ramp = rampOf(planet), rand = seeded(planet.id + ':scene');
        const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext('2d');
        paintSky(ctx, ramp, rand, g.kind);
        if (planet.type === 'ROGUE') paintStarless(ctx, ramp, rand); else paintMoon(ctx, ramp, rand);
        if (g.kind.platform) paintCloudDecks(ctx, ramp, rand); else paintFarRidge(ctx, ramp, rand);
        paintTerrain(ctx, g, ramp, kindName);
        const strange = STRANGE[planet.type] || [], scene = { ramp, kindName, type: planet.type, live: strange[1] || null, particles: [], lastNow: 0, dustColor: css(ramp[3]), fogColor: css(mix(ramp[2], INK, 0.3)) };
        if (!strange.length) paintDressing(ctx, g, ramp, rand, kindName);                // strange worlds get their own dressing instead of rocks and ice
        if (strange[0]) strange[0](ctx, g, ramp, rand, scene);
        if (g.kind.platform) paintPlatform(ctx, g);
        scene.backdrop = canvas;
        return scene;
    }

    // ── what moves ──
    function drawPools(ctx, g, now) {
        const tick = Math.floor(now / 180);
        for (let x = 0; x < W; x++) {
            if (!g.hot[x]) continue;
            const top = Math.round(g.heights[x]);
            for (let y = top; y < H; y++) {
                const depth = y - top;
                if (g.kind.sea) put(ctx, x, y, depth === 0 ? ((x + tick) % 9 < 3 ? '#9fd0f0' : '#3f78c0') : (dith(x + tick, y, 0.55 - depth / 40) ? '#1f4f9a' : '#0f2a5c'));
                else put(ctx, x, y, depth < 2 ? ((x * 7 + tick * 3) % 11 < 4 ? '#ffe0a0' : '#ffb060') : (dith(x, y + tick, 0.7 - depth / 30) ? '#ff7038' : '#a8321c'));
            }
        }
    }

    /** The rig's blinking masts and chevrons sliding down toward the deck: "land here". Gas giants only — real ground has no lights. */
    function drawPlatformLights(ctx, g, now) {
        const isOn = Math.floor(now / 350) % 2 === 0, cx = g.padX + PAD_WIDTH / 2, slide = Math.floor(now / 110) % 12;
        ctx.fillStyle = isOn ? AMBER : AMBER_DIM;
        ctx.fillRect(g.padX - 2, g.padY - 6, 3, 2); ctx.fillRect(g.padX + PAD_WIDTH - 1, g.padY - 6, 3, 2);
        for (let y = g.padY - 40 + slide; y < g.padY - 8; y += 12) {
            const fade = (y - (g.padY - 40)) / 32;
            ctx.fillStyle = fade > 0.5 ? AMBER : AMBER_DIM;
            for (let k = 0; k < 4; k++) { ctx.fillRect(cx - 4 + k, y + k, 1, 1); ctx.fillRect(cx + 3 - k, y + k, 1, 1); }
        }
        ctx.fillStyle = isOn ? '#7fd0de' : '#1d5563'; ctx.fillRect(g.padX - 4, g.padY + 5, 3, 2); ctx.fillRect(g.padX + PAD_WIDTH + 1, g.padY + 5, 3, 2); // lift pods
    }

    function drawWeather(ctx, g, scene, now) {
        if (!g.wind) return;
        ctx.fillStyle = scene.fogColor;
        for (let k = 0; k < 9; k++) {
            const y = 16 + k * 15, x = (((now / 1000) * g.wind * (7 + k % 3 * 3) + k * 83) % (W + 20) + W + 20) % (W + 20) - 10;
            ctx.fillRect(Math.round(x), y, 5 + (k % 3) * 3, 1);
        }
        if (scene.kindName !== 'haze' && scene.kindName !== 'sky') return;
        const shift = Math.floor(now / 90 * Math.sign(g.wind));                  // drifting murk low over the ground
        for (let y = 96; y < 146; y += 1) for (let x = 0; x < W; x += 1) if (dith(x + shift, y, 0.16 + 0.1 * Math.sin(y * 0.2))) ctx.fillRect(x, y, 1, 1);
    }

    function spawn(scene, particle) {
        if (scene.particles.length >= MAX_PARTICLES) scene.particles.shift();
        scene.particles.push(particle);
    }

    /** Exhaust smoke from each lit nozzle, and dust thrown sideways when the flame reaches the ground. */
    function emit(scene, g, s, nozzles) {
        nozzles.forEach(([nx, ny]) => {
            spawn(scene, { x: nx + Math.random() * 2, y: ny + 6, vx: (Math.random() - 0.5) * 8 - s.vx * 0.1, vy: 26 + Math.random() * 14, life: SMOKE_LIFE, max: SMOKE_LIFE, kind: 'smoke' });
            const ground = g.heights[clampX(Math.round(nx))];
            if (ground > H || g.hot[clampX(Math.round(nx))] || ground - ny > DUST_HEIGHT) return;
            const side = Math.random() < 0.5 ? -1 : 1;
            spawn(scene, { x: nx, y: ground - 1, vx: side * (20 + Math.random() * 30), vy: -(6 + Math.random() * 14), life: DUST_LIFE, max: DUST_LIFE, kind: 'dust' });
        });
    }

    function drawParticles(ctx, scene, g, dt) {
        scene.particles = scene.particles.filter(p => p.life > 0);
        scene.particles.forEach(p => {
            p.life -= dt; p.x += (p.vx + g.wind * 4) * dt; p.y += p.vy * dt;
            if (p.kind === 'smoke') p.vy *= 0.94; else p.vy += 40 * dt;
            const age = 1 - p.life / p.max;
            ctx.fillStyle = p.kind === 'dust' ? scene.dustColor : age < 0.25 ? '#ffb84a' : age < 0.6 ? '#7a766a' : '#3a3f3c';
            if (dith(Math.round(p.x), Math.round(p.y), 1.05 - age)) ctx.fillRect(Math.round(p.x), Math.round(p.y), age > 0.5 && p.kind === 'smoke' ? 2 : 1, 1);
        });
    }

    function drawShadow(ctx, g, s) {
        const x = Math.round(s.x), ground = g.heights[clampX(x)];
        if (ground > H || s.altitude > 70) return;
        const half = Math.max(2, Math.round(7 - s.altitude / 12));
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        for (let k = -half; k <= half; k++) { const gx = clampX(x + k); if (!g.hot[gx]) ctx.fillRect(gx, Math.round(g.heights[gx]), 1, 1); }
    }

    /** EXODUS-9's belly at the top of the screen: where the lander drops from, clamps open once it is away. */
    function drawShip(ctx, x, now, isDocked) {
        ctx.fillStyle = '#1b201d'; ctx.fillRect(x - SHIP_HALF, 0, SHIP_HALF * 2, SHIP_TALL);
        ctx.fillStyle = '#2a2d2a'; ctx.fillRect(x - SHIP_HALF + 6, SHIP_TALL, SHIP_HALF * 2 - 12, 2);
        ctx.fillStyle = '#3a3f3c'; ctx.fillRect(x - SHIP_HALF, SHIP_TALL - 1, SHIP_HALF * 2, 1);
        for (let k = -SHIP_HALF + 5; k < SHIP_HALF - 4; k += 7) put(ctx, x + k, 3, (k + Math.floor(now / 900)) % 21 === 0 ? '#1d5563' : '#7fd0de'); // windows
        ctx.fillStyle = Math.floor(now / 500) % 2 ? '#d85a4e' : '#4a1f1b'; ctx.fillRect(x - SHIP_HALF, SHIP_TALL - 2, 2, 2); ctx.fillRect(x + SHIP_HALF - 2, SHIP_TALL - 2, 2, 2);
        ctx.fillStyle = AMBER;
        const open = isDocked ? 0 : 4;                                            // the clamps swing apart after release
        ctx.fillRect(x - 8 - open, SHIP_TALL + 2, 2, 3); ctx.fillRect(x + 6 + open, SHIP_TALL + 2, 2, 3);
    }

    /** Call once per frame, before the lander itself is drawn. nozzles = [[x, y], …] of the thrusters firing right now. */
    function drawLive(ctx, scene, g, s, now, nozzles) {
        const dt = Math.min(0.05, scene.lastNow ? (now - scene.lastNow) / 1000 : 0); scene.lastNow = now;
        ctx.drawImage(scene.backdrop, 0, 0);
        drawPools(ctx, g, now);
        drawWeather(ctx, g, scene, now);
        if (scene.live) scene.live(ctx, g, scene, now, s);
        if (g.kind.platform) drawPlatformLights(ctx, g, now);
        drawShadow(ctx, g, s);
        if (nozzles.length && !s.grade) emit(scene, g, s, nozzles);
        drawParticles(ctx, scene, g, dt);
        if (scene.dockX == null) scene.dockX = Math.round(s.x);
        drawShip(ctx, scene.dockX, now, !s.isReleased);
    }

    window.LanderScene = { build, drawLive };
})();
