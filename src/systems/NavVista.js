/* NavVista — the sector map, alive. Same picture language as the opening sequence, carried into play:
     · dithered nebulae in the sector's colour, stars that twinkle
     · the heading you were given runs across the map as a STILL field of dead transponder pips (a few in sector 1,
       a graveyard by sector 6). Nothing flies here: every ship ahead was thrown at once and has been dead for centuries.
       A few pips blink, slowly and out of step — dead beacons on backup cells. From sector 3 on, small dark hulls sit in the band.
     · in sector 6 the band runs into the light at the end of the heading: a warm gold glow round the Structure's node, breathing
     · a pulse on the place you are, and a moving dashed course line to whatever you point at or select
   It draws on one low-resolution canvas behind the planet nodes and reads their positions from the page,
   so it never has to know how NavView lays them out. mount(mapElement, state) — stops itself when the map goes away. */

(function () {
    'use strict';
    const PIXEL = 2, TICK_MS = 90, STAR_COUNT = 150, CLOUD_COUNT = 6, ATTACH_GRACE_MS = 5000;
    // The graveyard: how many dead transponders sit in the heading band, and how many hulls are big enough to see (index = sector)
    const PIP_COUNT = [0, 6, 14, 40, 90, 160, 260], HULL_COUNT = [0, 0, 0, 4, 6, 8, 10];
    const BAND_SPREAD = 0.26;                       // how far off the heading's centre line a pip may sit, as a share of the map height
    const BAND_END_KEEP = 0.45;                     // sector 6: the band narrows toward the light but never to a thread — this much width is kept
    const BAND_END_BIAS = 0.6;                      // sector 6: pips crowd toward the light (along = rand ^ this: <1 pushes them to the far end)
    const PIP_DRIFT_PX_PER_S = 0.12;                // effectively still: the fastest pip moves a pixel every eight seconds or so
    const PIP_BLINK_SHARE = 0.08, PIP_BLINK_MIN_MS = 5000, PIP_BLINK_MAX_MS = 12000, PIP_FLASH_MS = 200;
    const PIP_MID_SHARE = 0.3, PIP_BIG_SHARE = 0.35; // a few pips are a shade brighter, a few are 2 px
    const HULL_MIN_PX = 3, HULL_MAX_PX = 6;
    const CORE_CLEAR_X = 1.15;                      // no pip sits on the light's face (in node radii); hulls may, as transits
    // The light at the end: a warm gold glow round the Structure's node, dithered, breathing slowly
    const GLOW_RADIUS_X = 2.5, GLOW_BREATH_MS = 4000, GLOW_BREATH_MIN = 0.7, GLOW_FALLOFF = 1.5, GLOW_FRAMES = 16;
    const GOLD = ['#3e2f10', '#a8781f', '#ffd27a', '#fff3cf'];          // shadow → highlight; index 0 is never painted (nebula shows)
    // Nebulae are a hint of colour, never a wash: the brightest channel of a sector colour is capped before it is darkened,
    // so a white sector (6) or a grey one (1) cannot turn the map into bright static. Sector 6 is warmed by the light itself.
    const NEBULA_MAX_CHANNEL = 96, NEBULA_DENSITY = 0.6, NEBULA_OVERRIDE = { 6: [96, 70, 32] };
    const INK = [5, 7, 10], BONE = '#c4d0c4', DIM = '#2f5a48', GREEN = '#74d99a', AMBER = '#d9a24a';
    const PIP_DIM = '#3b6a55', PIP_MID = '#7a9686', PIP_FLASH = '#e2ecdf', HULL_EDGE = '#5c7566';
    // 8x8 Bayer threshold matrix, same recipe as DitherCore
    const BAYER_N = 8, BAYER = (function bayer(n) {
        if (n === 1) return [[0]];
        const s = bayer(n / 2), h = n / 2, m = Array.from({ length: n }, () => new Array(n));
        for (let y = 0; y < h; y++) for (let x = 0; x < h; x++) { const v = s[y][x] * 4; m[y][x] = v; m[y][x + h] = v + 2; m[y + h][x] = v + 3; m[y + h][x + h] = v + 1; }
        return m;
    })(BAYER_N).map(row => row.map(v => (v + 0.5) / (BAYER_N * BAYER_N)));
    const dith = (x, y, v) => v > BAYER[y & 7][x & 7];
    const css = c => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
    const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    const sectorIndex = sector => Math.min(6, Math.max(0, sector | 0));

    function seeded(seed) { let s = (seed * 2654435761) >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

    function sectorTint(sector) {
        if (NEBULA_OVERRIDE[sector]) return NEBULA_OVERRIDE[sector];
        const hex = (typeof SECTOR_CONFIG !== 'undefined' && SECTOR_CONFIG[sector] && SECTOR_CONFIG[sector].sectorColor) || '#2f5a48';
        const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(hex);
        const rgb = m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [47, 90, 72];
        const top = Math.max(...rgb);
        return top > NEBULA_MAX_CHANNEL ? rgb.map(c => c * NEBULA_MAX_CHANNEL / top) : rgb;
    }

    /** Everything that does not change while you look at this sector, painted once. */
    function buildBackdrop(w, h, sector) {
        const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d'), rand = seeded(sector + 3), tint = sectorTint(sector);
        ctx.fillStyle = css(INK); ctx.fillRect(0, 0, w, h);
        for (let k = 0; k < CLOUD_COUNT; k++) {
            const cx = rand() * w, cy = rand() * h, r = (0.18 + rand() * 0.3) * w;
            ctx.fillStyle = css(mix(tint, INK, k % 2 ? 0.72 : 0.82));
            for (let y = Math.max(0, Math.floor(cy - r)); y < Math.min(h, cy + r); y++) for (let x = Math.max(0, Math.floor(cx - r)); x < Math.min(w, cx + r); x++) {
                const d = Math.hypot(x - cx, (y - cy) * 1.6) / r;
                if (d < 1 && dith(x, y, (1 - d) * NEBULA_DENSITY)) ctx.fillRect(x, y, 1, 1);
            }
        }
        return canvas;
    }

    /** A place in the heading band, as a share of the way along it and an offset from its centre line. Sector 6 crowds toward the light. */
    function bandPlace(rand, w, sector) {
        return {
            along: Math.pow(rand(), sector >= 6 ? BAND_END_BIAS : 1),
            offset: (rand() - 0.5) * rand() * BAND_SPREAD,
            drift: (rand() - 0.5) * 2 * PIP_DRIFT_PX_PER_S / w / 1000,     // in "along" per ms
        };
    }

    function buildScene(w, h, sector) {
        const rand = seeded(sector + 41), idx = sectorIndex(sector);
        return {
            w, h, sector, backdrop: buildBackdrop(w, h, sector), glow: null,
            stars: Array.from({ length: STAR_COUNT }, () => ({ x: Math.floor(rand() * w), y: Math.floor(rand() * h), beat: rand() * 6.28, bright: rand() < 0.2 })),
            pips: Array.from({ length: PIP_COUNT[idx] }, () => Object.assign(bandPlace(rand, w, sector), {
                tone: rand() < PIP_MID_SHARE ? PIP_MID : PIP_DIM, size: rand() < PIP_BIG_SHARE ? 2 : 1,
                blink: rand() < PIP_BLINK_SHARE, period: PIP_BLINK_MIN_MS + rand() * (PIP_BLINK_MAX_MS - PIP_BLINK_MIN_MS), phase: rand() * PIP_BLINK_MAX_MS,
            })),
            hulls: Array.from({ length: HULL_COUNT[idx] }, () => Object.assign(bandPlace(rand, w, sector), { length: HULL_MIN_PX + Math.floor(rand() * (HULL_MAX_PX - HULL_MIN_PX + 1)) })),
        };
    }

    /**
     * The heading: from the lower left of the map to the upper right, where the next sector is. When the Structure is on
     * this map the heading runs into it instead, and the band narrows onto it — but keeps some width, so it reads as a
     * crowd gathered round a light, not a thread.
     */
    function headingPoint(scene, along, offset) {
        const end = scene.end;
        if (!end) return { x: along * scene.w, y: scene.h * (0.82 - along * 0.64) + offset * scene.h };
        const startY = scene.h * 0.86, keep = BAND_END_KEEP + (1 - BAND_END_KEEP) * Math.pow(1 - along, 0.8);
        return { x: along * end.x, y: startY + (end.y - startY) * along + offset * scene.h * keep };
    }

    /** Where something in the band is right now: its place plus a drift so slow it is still to the eye. */
    function bandPoint(scene, item, time) {
        return headingPoint(scene, (((item.along + time * item.drift) % 1) + 1) % 1, item.offset);
    }

    /** The dead transponders: still dots in the band. A few flash, slowly and out of step. */
    function drawPips(ctx, scene, time) {
        const clear = scene.end ? scene.end.r * CORE_CLEAR_X : 0;
        let last = null;
        scene.pips.forEach(pip => {
            const p = bandPoint(scene, pip, time);
            if (scene.end && Math.hypot(p.x - scene.end.x, p.y - scene.end.y) < clear) return;
            const lit = pip.blink && ((time + pip.phase) % pip.period) < PIP_FLASH_MS, colour = lit ? PIP_FLASH : pip.tone, size = lit ? 2 : pip.size;
            if (colour !== last) { ctx.fillStyle = colour; last = colour; }
            ctx.fillRect(Math.round(p.x), Math.round(p.y), size, size);
        });
    }

    /** Small dead hulls: a dark body, blacker than the nebula, with one edge catching what little light there is. In the glow they are transits. */
    function drawHulls(ctx, scene, time) {
        scene.hulls.forEach(hull => {
            const p = bandPoint(scene, hull, time), x = Math.round(p.x), y = Math.round(p.y);
            ctx.fillStyle = css(INK); ctx.fillRect(x, y, hull.length, 2);
            ctx.fillStyle = HULL_EDGE; ctx.fillRect(x + 1, y - 1, hull.length - 2, 1);
        });
    }

    /** The light at the end, painted once per breath phase and cached: a dithered gold glow round the Structure's node. */
    function buildGlowFrames(r) {
        const R = r * GLOW_RADIUS_X, size = Math.ceil(R) * 2 + 2, c = size / 2, top = GOLD.length - 1;
        const tone = new Float32Array(size * size);                         // how lit each pixel is at full breath, computed once
        for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
            const d = Math.hypot(x + 0.5 - c, y + 0.5 - c) / R;
            tone[y * size + x] = d < 1 ? Math.pow(1 - d, GLOW_FALLOFF) * top : 0;
        }
        return Array.from({ length: GLOW_FRAMES }, (_, i) => {
            const breath = 0.5 + 0.5 * Math.sin(i / GLOW_FRAMES * Math.PI * 2), bright = GLOW_BREATH_MIN + (1 - GLOW_BREATH_MIN) * breath;
            const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size;
            const ctx = canvas.getContext('2d');
            let last = 0;
            for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
                const pos = tone[y * size + x] * bright, base = Math.floor(pos);
                const level = pos ? Math.min(top, base + (pos - base > BAYER[y & 7][x & 7] ? 1 : 0)) : 0;
                if (!level) continue;
                if (level !== last) { ctx.fillStyle = GOLD[level]; last = level; }
                ctx.fillRect(x, y, 1, 1);
            }
            return canvas;
        });
    }

    function drawGlow(ctx, scene, time) {
        const { x, y, r } = scene.end, key = `${Math.round(x)},${Math.round(y)},${r}`;
        if (!scene.glow || scene.glow.key !== key) scene.glow = { key, frames: buildGlowFrames(r) };
        const frame = scene.glow.frames[Math.floor((time % GLOW_BREATH_MS) / GLOW_BREATH_MS * GLOW_FRAMES)];
        ctx.drawImage(frame, Math.round(x - frame.width / 2), Math.round(y - frame.height / 2));
    }

    /** The Structure's node, if it is on this map, measured in canvas pixels. */
    function structurePoint(map, scene, state) {
        const structure = (state.sectorNodes || []).find(p => p.isStructure || p.type === 'STRUCTURE');
        const node = structure && map.querySelector(`.nav-node[data-id="${CSS.escape(String(structure.id))}"]`);
        return node ? centreOf(map, node) : null;
    }

    function drawStars(ctx, scene, time) {
        scene.stars.forEach(star => {
            const glow = Math.sin(time / 900 + star.beat);
            if (glow < -0.6) return;
            ctx.fillStyle = star.bright && glow > 0.3 ? BONE : DIM;
            ctx.fillRect(star.x, star.y, star.bright && glow > 0.8 ? 2 : 1, 1);
        });
    }

    function centreOf(map, node) {
        const a = map.getBoundingClientRect(), b = node.getBoundingClientRect();
        return { x: (b.left - a.left + b.width / 2) / PIXEL, y: (b.top - a.top + b.height / 2) / PIXEL, r: b.width / 2 / PIXEL };
    }

    /** Where the ship is now: the planet it last visited, or the mouth of the heading when it has just arrived. */
    function shipPoint(map, scene, state) {
        const here = state.lastVisitedSystem && map.querySelector(`.nav-node[data-id="${CSS.escape(String(state.lastVisitedSystem.id))}"]`);
        return here ? centreOf(map, here) : Object.assign(headingPoint(scene, 0.04, 0), { r: 0 });
    }

    function drawCourse(ctx, from, to, time) {
        const length = Math.hypot(to.x - from.x, to.y - from.y);
        if (length < 4) return;
        for (let d = from.r + 3; d < length - to.r - 3; d += 1) {
            const inDash = (((d - time * 0.03) % 9) + 9) % 9;
            if (inDash > 4) continue;
            ctx.fillStyle = inDash > 3 ? '#ffe6a0' : AMBER;
            ctx.fillRect(Math.round(from.x + (to.x - from.x) * d / length), Math.round(from.y + (to.y - from.y) * d / length), 1, 1);
        }
    }

    function drawPulse(ctx, at, time) {
        const grow = (time % 2200) / 2200, r = at.r + 3 + grow * 12;
        ctx.fillStyle = grow < 0.5 ? GREEN : DIM;
        for (let a = 0; a < 6.283; a += 0.5 / r) ctx.fillRect(Math.round(at.x + Math.cos(a) * r), Math.round(at.y + Math.sin(a) * r), 1, 1);
    }

    function mount(map, state) {
        if (!map || !state) return;
        map.querySelectorAll('.nav-vista').forEach(old => old.remove());
        // NavView still writes the old static background's sweeping ".scanner-bar" (a 2 px, full-height glowing line that slides
        // left to right every 8 s). Over the living backdrop it reads as a stray vertical line at a random x. The vista replaces it.
        map.querySelectorAll('.scanner-bar').forEach(bar => bar.remove());
        const canvas = document.createElement('canvas');
        canvas.className = 'nav-vista';
        canvas.setAttribute('aria-hidden', 'true');
        map.insertBefore(canvas, map.firstChild);
        const ctx = canvas.getContext('2d'), startedAt = performance.now();
        let scene = null, targetId = null, pinnedId = null, wasAttached = false;
        map.addEventListener('mouseover', e => { const node = e.target.closest('.nav-node'); if (node) targetId = node.dataset.id; });
        map.addEventListener('mouseleave', () => { targetId = null; });
        map.addEventListener('click', e => { const node = e.target.closest('.nav-node'); if (node) pinnedId = node.dataset.id; });

        function paint() {
            // The view is built first and attached to the page afterwards: only let go once it HAS been attached and is gone again
            if (map.isConnected) wasAttached = true;
            else if (wasAttached || performance.now() - startedAt > ATTACH_GRACE_MS) { clearInterval(timer); return; }
            else return;
            const w = Math.round(map.clientWidth / PIXEL), h = Math.round(map.clientHeight / PIXEL);
            if (w < 20 || h < 20) return;                                     // not laid out yet
            if (!scene || scene.w !== w || scene.h !== h) { scene = buildScene(w, h, state.currentSector || 1); canvas.width = w; canvas.height = h; }
            const time = performance.now() - startedAt;
            scene.end = structurePoint(map, scene, state);
            ctx.drawImage(scene.backdrop, 0, 0);
            drawStars(ctx, scene, time);
            if (scene.end) drawGlow(ctx, scene, time);
            drawPips(ctx, scene, time);
            drawHulls(ctx, scene, time);
            const ship = shipPoint(map, scene, state), goal = map.querySelector(`.nav-node[data-id="${CSS.escape(String(targetId || pinnedId || ''))}"]`);
            if (goal) drawCourse(ctx, ship, centreOf(map, goal), time);
            if (ship.r) drawPulse(ctx, ship, time);
        }
        const timer = setInterval(paint, TICK_MS);
        paint();
    }

    window.NavVista = { mount };
})();
