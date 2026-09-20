/* OrbitVista — makes the planet you are orbiting feel big.
   Two low-resolution dithered layers around the planet body that OrbitView already draws:
     back  — the star this world belongs to (glare + long spikes, on the side the planet is lit from), a haze of air
             round the limb, drifting dust, and the far half of your orbit
     front — the near half of the orbit, EXODUS-9 itself going round (it passes behind the planet and comes back),
             and faint lens ghosts strung along the line from the star through the planet
   Colours come from the planet's own ramp. mount(container, planet, bodySize) — cleans itself up when the screen changes. */

(function () {
    'use strict';
    const PIXEL = 2, TICK_MS = 100, ORBIT_MS = 46000, DUST_COUNT = 70; // PIXEL matches the planet body's own pixel size
    const ORBIT = { rx: 0.98, ry: 0.24, tilt: -0.2 };                       // in planet diameters / radians
    const STAR_DISTANCE = 1.25, HALO_WIDTH = 0.2;
    const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    const dith = (x, y, v) => v * 16 > BAYER[(y & 3) * 4 + (x & 3)];
    const css = c => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
    const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    const STARLIGHT = [255, 236, 190], INK = [6, 7, 10];

    function recipeOf(planet) {
        const recipes = window.DitherRecipes;
        return (recipes && recipes.TYPES && recipes.TYPES[planet.type]) || (recipes && recipes.FALLBACK) || { ramp: [[6, 7, 10], [16, 32, 26], [27, 51, 41], [47, 90, 72], [116, 217, 154]], light: [-0.55, -0.35, 0.75] };
    }

    function seeded(id) {
        let s = 17;
        String(id || 'x').split('').forEach(ch => { s = ((s * 31) + ch.charCodeAt(0)) >>> 0; });
        return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    }

    function layer(className) {
        const canvas = document.createElement('canvas');
        canvas.className = `vista-layer ${className}`;
        canvas.setAttribute('aria-hidden', 'true');
        return canvas;
    }

    /** The star: a hot core, a wide soft glow, one long horizontal spike and a short vertical one. It breathes slightly. */
    function drawStar(ctx, scene, time) {
        const { sx, sy, R, w, h } = scene, breath = 1 + 0.06 * Math.sin(time / 1700), reach = R * 1.5 * breath;
        const core = css(STARLIGHT), glow = css(mix(STARLIGHT, scene.tint, 0.55)), far = css(mix(scene.tint, INK, 0.45));
        for (let y = Math.max(0, Math.floor(sy - reach)); y < Math.min(h, sy + reach); y++) for (let x = Math.max(0, Math.floor(sx - reach)); x < Math.min(w, sx + reach); x++) {
            const d = Math.hypot(x - sx, y - sy) / reach;
            if (d >= 1) continue;
            const v = Math.pow(1 - d, 2.4);
            if (dith(x, y, v * 1.5)) { ctx.fillStyle = d < 0.12 ? core : d < 0.4 ? glow : far; ctx.fillRect(x, y, 1, 1); }
        }
        ctx.fillStyle = glow;
        for (let x = 0; x < w; x++) { const v = 1 - Math.abs(x - sx) / (R * 3.2); if (v > 0 && dith(x, Math.round(sy), v * breath)) ctx.fillRect(x, Math.round(sy), 1, 1); }
        for (let y = 0; y < h; y++) { const v = 1 - Math.abs(y - sy) / (R * 1.1); if (v > 0 && dith(Math.round(sx), y, v * 0.8)) ctx.fillRect(Math.round(sx), y, 1, 1); }
    }

    /** Air catching the light: a ring of haze just outside the limb, bright toward the star and gone on the night side. */
    function drawHalo(ctx, scene) {
        const { cx, cy, R, lx, ly, w, h } = scene, outer = R * (1 + HALO_WIDTH), haze = css(mix(scene.tint, STARLIGHT, 0.25));
        ctx.fillStyle = haze;
        for (let y = Math.max(0, Math.floor(cy - outer)); y < Math.min(h, cy + outer); y++) for (let x = Math.max(0, Math.floor(cx - outer)); x < Math.min(w, cx + outer); x++) {
            const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy);
            if (d < R * 0.97 || d >= outer) continue;
            const facing = Math.max(0, (dx * lx + dy * ly) / d * 0.75 + 0.35), fade = 1 - (d - R * 0.97) / (outer - R * 0.97);
            if (dith(x, y, fade * fade * facing * scene.air)) ctx.fillRect(x, y, 1, 1);
        }
    }

    function orbitPoint(scene, angle) {
        const ox = Math.cos(angle) * scene.R * 2 * ORBIT.rx, oy = Math.sin(angle) * scene.R * 2 * ORBIT.ry;
        return { x: scene.cx + ox * Math.cos(ORBIT.tilt) - oy * Math.sin(ORBIT.tilt), y: scene.cy + ox * Math.sin(ORBIT.tilt) + oy * Math.cos(ORBIT.tilt) };
    }

    /** Half of the orbit as a dotted line: the far half goes on the back layer, the near half on the front. */
    function drawOrbitHalf(ctx, scene, isNear) {
        ctx.fillStyle = isNear ? '#2f5a48' : '#1b3329';
        const from = isNear ? 0 : Math.PI, to = from + Math.PI;
        for (let a = from; a < to; a += 0.045) { const p = orbitPoint(scene, a); ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); }
    }

    function drawShip(ctx, scene, angle, time) {
        const p = orbitPoint(scene, angle), x = Math.round(p.x), y = Math.round(p.y), heading = Math.cos(angle) < 0 ? 1 : -1; // it flies along the line
        ctx.fillStyle = '#c4d0c4'; ctx.fillRect(x - 2, y, 5, 1); ctx.fillRect(x - heading, y - 1, 2, 1);
        ctx.fillStyle = Math.floor(time / 300) % 2 ? '#d9a24a' : '#ffb84a'; ctx.fillRect(x - heading * 3, y, 1, 1);        // drive
    }

    function drawDust(ctx, scene, time) {
        ctx.fillStyle = css(mix(scene.tint, INK, 0.4));
        scene.dust.forEach(mote => {
            const x = ((mote.x + time * mote.speed) % scene.w + scene.w) % scene.w;
            ctx.fillRect(Math.round(x), Math.round(mote.y + Math.sin(time / 3000 + mote.x) * 2), 1, 1);
        });
    }

    /** Small rings of light on the far side of the planet from the star, the way a lens does it. */
    function drawGhosts(ctx, scene) {
        ctx.fillStyle = css(mix(STARLIGHT, scene.tint, 0.6));
        [[-0.55, 5], [-1.0, 9], [-1.5, 3]].forEach(([along, radius]) => {
            const gx = scene.cx + (scene.sx - scene.cx) * along, gy = scene.cy + (scene.sy - scene.cy) * along;
            for (let a = 0; a < 6.283; a += 0.35 / radius) { const x = Math.round(gx + Math.cos(a) * radius), y = Math.round(gy + Math.sin(a) * radius); if (dith(x, y, 0.4)) ctx.fillRect(x, y, 1, 1); }
        });
    }

    function buildScene(container, planet, bodySize) {
        const w = Math.max(60, Math.round(container.clientWidth / PIXEL)), h = Math.max(40, Math.round(container.clientHeight / PIXEL));
        const recipe = recipeOf(planet), light = recipe.light || [-0.55, -0.35, 0.75], rand = seeded(planet.id);
        const flat = Math.hypot(light[0], light[1]) || 1, lx = light[0] / flat, ly = light[1] / flat;
        const RING_SCALE = 0.66;                                                   // DitherBodies shrinks ringed globes so the ring fits the same box
        const cx = w / 2, cy = h / 2, R = bodySize / PIXEL / 2 * (recipe.ring ? RING_SCALE : 1);
        const ramp = recipe.ramp || [];
        const isAirless = ['ROCKY', 'SHATTERED', 'HOLLOW', 'ROGUE', 'GRAVEYARD', 'MIRROR', 'CRYSTALLINE'].includes(planet.type);
        return {
            w, h, cx, cy, R, lx, ly,
            sx: Math.max(6, Math.min(w - 6, cx + lx * R * 2 * STAR_DISTANCE)), sy: Math.max(6, Math.min(h - 6, cy + ly * R * 2 * STAR_DISTANCE)),
            tint: ramp[3] || [116, 217, 154], air: isAirless ? 0.25 : 1,
            dust: Array.from({ length: DUST_COUNT }, () => ({ x: rand() * w, y: rand() * h, speed: 0.001 + rand() * 0.004 })),
        };
    }

    function mount(container, planet, bodySize) {
        if (!container || !planet) return;
        container.querySelectorAll('.vista-layer').forEach(old => old.remove());
        const back = layer('vista-back'), front = layer('vista-front');
        container.insertBefore(back, container.firstChild);
        container.appendChild(front);
        let scene = null;
        const startedAt = performance.now(), phase = seeded(planet.id + ':orbit')() * 6.283;

        function paint() {
            if (!container.isConnected) { clearInterval(timer); return; }
            if (!container.clientWidth) return;                                   // not laid out yet (hidden tab)
            if (!scene || Math.abs(scene.w - Math.round(container.clientWidth / PIXEL)) > 2) {
                scene = buildScene(container, planet, bodySize);
                [back, front].forEach(c => { c.width = scene.w; c.height = scene.h; });
            }
            const time = performance.now() - startedAt, angle = phase + (time / ORBIT_MS) * 6.283, isNear = Math.sin(angle) > 0;
            const b = back.getContext('2d'), f = front.getContext('2d');
            b.clearRect(0, 0, scene.w, scene.h); f.clearRect(0, 0, scene.w, scene.h);
            drawDust(b, scene, time); drawStar(b, scene, time); drawHalo(b, scene); drawOrbitHalf(b, scene, false);
            drawOrbitHalf(f, scene, true); drawGhosts(f, scene);
            drawShip(isNear ? f : b, scene, angle, time);
        }
        const timer = setInterval(paint, TICK_MS);
        paint();
    }

    window.OrbitVista = { mount };
})();
