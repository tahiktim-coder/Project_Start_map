/* LanderScene — everything in the landing minigame that is not physics: the place you are landing on.
   build(ground, planet) paints a static backdrop once (dithered sky glow, a lit moon, far ridges or cloud decks,
   shaded terrain with strata, rocks and per-world dressing, the pad structure). drawLive() adds what moves each frame:
   lava and water, pad beacons and approach chevrons, wind, fog, exhaust smoke, dust, the lander's shadow, the ship above.
   Colours come from the planet's own dither ramp, so the ground matches the globe you saw from orbit. */

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

    const isFreeGround = (g, x) => x > 2 && x < W - 3 && !g.hot[x] && g.heights[x] < H && (x < g.padX - 3 || x > g.padX + PAD_WIDTH + 3);

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

    function paintPad(ctx, g) {
        const x = g.padX, y = g.padY;
        for (let k = 0; k < PAD_WIDTH; k++) put(ctx, x + k, y + 1, Math.floor(k / 4) % 2 ? AMBER_DIM : '#15181a'); // hazard stripes under the deck
        ctx.fillStyle = BONE; ctx.fillRect(x, y, PAD_WIDTH, 1);
        ctx.fillStyle = '#3a3f3c';
        if (g.kind.platform) { // a floating rig: girders hanging under the deck, two lift pods
            for (let d = 2; d < 16; d++) for (let k = d; k < PAD_WIDTH - d; k++) if ((k + d) % 4 === 0 || d === 2) put(ctx, x + k, y + d, '#3a3f3c');
            ctx.fillRect(x - 5, y - 1, 5, 6); ctx.fillRect(x + PAD_WIDTH, y - 1, 5, 6);
        } else { ctx.fillRect(x + 3, y + 2, 2, 5); ctx.fillRect(x + PAD_WIDTH - 5, y + 2, 2, 5); ctx.fillRect(x + PAD_WIDTH / 2 - 1, y + 2, 2, 4); }
        ctx.fillStyle = '#3a3f3c'; ctx.fillRect(x - 1, y - 4, 1, 4); ctx.fillRect(x + PAD_WIDTH, y - 4, 1, 4); // beacon masts
    }

    function build(g, planet) {
        const kindName = g.kindName || 'rock';
        const ramp = rampOf(planet), rand = seeded(planet.id + ':scene');
        const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext('2d');
        paintSky(ctx, ramp, rand, g.kind);
        paintMoon(ctx, ramp, rand);
        if (g.kind.platform) paintCloudDecks(ctx, ramp, rand); else paintFarRidge(ctx, ramp, rand);
        paintTerrain(ctx, g, ramp, kindName);
        paintDressing(ctx, g, ramp, rand, kindName);
        paintPad(ctx, g);
        return { backdrop: canvas, ramp, kindName, particles: [], lastNow: 0, dustColor: css(ramp[3]), fogColor: css(mix(ramp[2], INK, 0.3)) };
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

    /** Blinking masts and chevrons sliding down toward the deck: "land here". */
    function drawPadLights(ctx, g, now) {
        const isOn = Math.floor(now / 350) % 2 === 0, cx = g.padX + PAD_WIDTH / 2, slide = Math.floor(now / 110) % 12;
        ctx.fillStyle = isOn ? AMBER : AMBER_DIM;
        ctx.fillRect(g.padX - 2, g.padY - 6, 3, 2); ctx.fillRect(g.padX + PAD_WIDTH - 1, g.padY - 6, 3, 2);
        for (let y = g.padY - 40 + slide; y < g.padY - 8; y += 12) {
            const fade = (y - (g.padY - 40)) / 32;
            ctx.fillStyle = fade > 0.5 ? AMBER : AMBER_DIM;
            for (let k = 0; k < 4; k++) { ctx.fillRect(cx - 4 + k, y + k, 1, 1); ctx.fillRect(cx + 3 - k, y + k, 1, 1); }
        }
        if (g.kind.platform) { ctx.fillStyle = isOn ? '#7fd0de' : '#1d5563'; ctx.fillRect(g.padX - 4, g.padY + 5, 3, 2); ctx.fillRect(g.padX + PAD_WIDTH + 1, g.padY + 5, 3, 2); } // lift pods
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
        drawPadLights(ctx, g, now);
        drawShadow(ctx, g, s);
        if (nozzles.length && !s.grade) emit(scene, g, s, nozzles);
        drawParticles(ctx, scene, g, dt);
        if (scene.dockX == null) scene.dockX = Math.round(s.x);
        drawShip(ctx, scene.dockX, now, !s.isReleased);
    }

    window.LanderScene = { build, drawLive };
})();
