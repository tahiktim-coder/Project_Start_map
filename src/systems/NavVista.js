/* NavVista — the sector map, alive. Same picture language as the opening sequence, carried into play:
     · dithered nebulae in the sector's colour, stars that twinkle
     · the heading you were given runs across the map as a stream of moving dashes (thin in sector 1, a river by sector 6)
     · dead hulls drift in that stream from sector 3 on
     · a pulse on the place you are, and a moving dashed course line to whatever you point at or select
   It draws on one low-resolution canvas behind the planet nodes and reads their positions from the page,
   so it never has to know how NavView lays them out. mount(mapElement, state) — stops itself when the map goes away. */

(function () {
    'use strict';
    const PIXEL = 2, TICK_MS = 90, STAR_COUNT = 150, CLOUD_COUNT = 6;
    const STREAM_LANES = [0, 3, 5, 9, 14, 20, 28];        // index = sector: how many lanes of ships the heading carries
    const WRECKS_FROM_SECTOR = 3, WRECKS_PER_SECTOR = 14;
    const INK = [5, 7, 10], BONE = '#c4d0c4', DIM = '#2f5a48', GREEN = '#74d99a', AMBER = '#d9a24a', RED = '#a8453c';
    const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    const dith = (x, y, v) => v * 16 > BAYER[(y & 3) * 4 + (x & 3)];
    const css = c => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
    const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

    function seeded(seed) { let s = (seed * 2654435761) >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

    function sectorTint(sector) {
        const hex = (typeof SECTOR_CONFIG !== 'undefined' && SECTOR_CONFIG[sector] && SECTOR_CONFIG[sector].sectorColor) || '#2f5a48';
        const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(hex);
        return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [47, 90, 72];
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
                if (d < 1 && dith(x, y, (1 - d) * 0.75)) ctx.fillRect(x, y, 1, 1);
            }
        }
        return canvas;
    }

    function buildScene(w, h, sector) {
        const rand = seeded(sector + 41);
        return {
            w, h, sector, backdrop: buildBackdrop(w, h, sector),
            stars: Array.from({ length: STAR_COUNT }, () => ({ x: Math.floor(rand() * w), y: Math.floor(rand() * h), beat: rand() * 6.28, bright: rand() < 0.2 })),
            lanes: Array.from({ length: STREAM_LANES[Math.min(6, sector)] || 3 }, () => ({ offset: (rand() - 0.5) * rand() * 0.22, speed: 0.5 + rand(), phase: rand() * 40 })),
            wrecks: Array.from({ length: sector >= WRECKS_FROM_SECTOR ? (sector - 2) * WRECKS_PER_SECTOR : 0 }, () => ({ along: rand(), offset: (rand() - 0.5) * rand() * 0.3, drift: 0.2 + rand() * 0.5 })),
        };
    }

    /** The heading: from the lower left of the map to the upper right, where the next sector is. */
    const headingPoint = (scene, along, offset) => ({ x: along * scene.w, y: scene.h * (0.82 - along * 0.64) + offset * scene.h });

    function drawStream(ctx, scene, time) {
        scene.lanes.forEach(lane => {
            for (let step = 0; step < scene.w; step += 2) {
                const inDash = (((step - time * 0.02 * lane.speed - lane.phase) % 26) + 26) % 26;
                if (inDash > 8) continue;
                const p = headingPoint(scene, step / scene.w, lane.offset);
                ctx.fillStyle = inDash > 6 ? '#d6ffe4' : inDash > 3 ? GREEN : DIM;
                ctx.fillRect(Math.round(p.x), Math.round(p.y), inDash > 6 ? 2 : 1, 1);
            }
        });
        scene.wrecks.forEach((wreck, i) => {
            const p = headingPoint(scene, (wreck.along + time * 0.000004 * wreck.drift) % 1, wreck.offset), x = Math.round(p.x), y = Math.round(p.y);
            ctx.fillStyle = i % 3 ? RED : BONE; ctx.fillRect(x, y, 3, 1); ctx.fillRect(x + 1, y - 1, 1, 1);
            if (i % 5 === 0 && Math.floor(time / 600 + i) % 3 === 0) { ctx.fillStyle = AMBER; ctx.fillRect(x + 1, y - 2, 1, 1); }
        });
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
        const canvas = document.createElement('canvas');
        canvas.className = 'nav-vista';
        canvas.setAttribute('aria-hidden', 'true');
        map.insertBefore(canvas, map.firstChild);
        const ctx = canvas.getContext('2d'), startedAt = performance.now();
        let scene = null, targetId = null, pinnedId = null;
        map.addEventListener('mouseover', e => { const node = e.target.closest('.nav-node'); if (node) targetId = node.dataset.id; });
        map.addEventListener('mouseleave', () => { targetId = null; });
        map.addEventListener('click', e => { const node = e.target.closest('.nav-node'); if (node) pinnedId = node.dataset.id; });

        function paint() {
            if (!map.isConnected) { clearInterval(timer); return; }
            const w = Math.round(map.clientWidth / PIXEL), h = Math.round(map.clientHeight / PIXEL);
            if (w < 20 || h < 20) return;                                     // not laid out yet
            if (!scene || scene.w !== w || scene.h !== h) { scene = buildScene(w, h, state.currentSector || 1); canvas.width = w; canvas.height = h; }
            const time = performance.now() - startedAt;
            ctx.drawImage(scene.backdrop, 0, 0);
            drawStars(ctx, scene, time);
            drawStream(ctx, scene, time);
            const ship = shipPoint(map, scene, state), goal = map.querySelector(`.nav-node[data-id="${CSS.escape(String(targetId || pinnedId || ''))}"]`);
            if (goal) drawCourse(ctx, ship, centreOf(map, goal), time);
            if (ship.r) drawPulse(ctx, ship, time);
        }
        const timer = setInterval(paint, TICK_MS);
        paint();
    }

    window.NavVista = { mount };
})();
