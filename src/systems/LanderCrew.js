/* LanderCrew — the away team leaving the lander after a touchdown in the landing game.
   Nobody strolls out in their clothes onto a world at -50°C with thin air. The hatch opens on the side facing the site,
   the cabin air puffs out, and the team comes down one at a time in EVA suits: a helmet with a visor that catches the
   light, a backpack, a neutral suit with a stripe in their role colour (white commander, blue Aris, violet Mira,
   red Vance, amber Jaxon). Only where the air is breathable (planet.atmosphere 'BREATHABLE') and the temperature mild
   (MILD_C) do they wear a light suit with a hood and a mask instead. They walk to the site (g.site.goalX), not anywhere,
   over the soil it piled up, stopping at lava, water or a cliff, and line up there.
   While they step out, the view closes in on them so the moment can be seen.
     plan(g, s, colors, planet, now) once at touchdown → crew (crew.duration: how long to hold the screen)
     drawBehind / drawFront(ctx, crew, g, now) around the lander sprite; view(crew, now) → the camera window. */

(function () {
    'use strict';
    if (!window.LanderScene || !window.LanderScene.util) return;
    const { W, H, dith, put, clampX } = window.LanderScene.util;
    const LANDER_HALF = 6, HULL_ROW = 3;                                               // the lander sprite: 13 px wide, the hatch in hull rows 3-4
    const HATCH_AT = 450, PUFF_LIFE = 1.0, FIRST_OUT = 950, STAGGER = 650, CLIMB_MS = 420, STEP_MS = 170;
    const WALK_PX_S = 15, SPACING = 7, CLEAR_OF_HULL = 11, ROAM = 30, LINGER = 800, MAX_MS = 5600, MAX_STEP_UP = 3, MAX_STEP_DOWN = 6;
    const ZOOM = 2, ZOOM_AT = 150, ZOOM_MS = 750, GLINT_EVERY = 1700, GLINT_MS = 220, MILD_C = [-15, 40]; // MILD_C: °C a light suit can take
    const OUTLINE = '#0b0d10', GLINT = '#f2fbff', CABIN = ['#c8913c', '#6a4a20'], PUFF = ['#eef4ef', '#b9c4bd', '#7d8a83'], DOOR = '#c4d0c4';
    // facing right. H helmet, h helmet shade, V visor, B pack, b pack shade, S suit, s suit shade, R role stripe, K boot, F face, M mask
    const EVA = ['..HH.', '.BHVV', '.BSSS', '.RRRs', '..Ss.'];                       // the stripe runs right round, over the pack
    const LIGHT = ['..hh.', '.bFM.', '.bSSS', '.RRRs', '..Ss.'];
    const LEGS = [['..S.s', '..K.K'], ['...S.', '..KK.']];                         // standing, mid-stride
    const INK = { H: '#f0f2ec', h: '#b9bcb3', V: '#1d5563', B: '#8a887c', b: '#6e6c62', S: '#a9aba1', s: '#7f8178', K: '#55534b', F: '#e8d8c0', M: '#5c6058' };

    const clamp01 = v => Math.max(0, Math.min(1, v));
    const ease = t => t * t * (3 - 2 * t);
    /** The ground they walk on: the terrain, or the soil heaped up around the site where that is higher. */
    function groundY(g, x) {
        const k = clampX(Math.round(x)), heap = g.site && g.site.standY ? g.site.standY[k] : Infinity;
        return Math.round(Math.min(g.heights[k], heap));
    }

    /** One suited figure, 5×7, feet on y = feetY, centred on x. */
    function drawSuit(ctx, x, feetY, color, dir, isStepping, isLight, isGlinting) {
        const rows = (isLight ? LIGHT : EVA).concat(LEGS[isStepping ? 1 : 0]), front = dir > 0 ? 4 : 0, left = Math.round(x) - 2, top = feetY - rows.length;
        const at = (r, c) => r >= 0 && r < rows.length && c >= 0 && c < 5 && rows[r][dir > 0 ? c : 4 - c] !== '.';
        for (let r = -1; r < rows.length; r++) for (let c = -1; c <= 5; c++) {              // a dark edge, so they read against a grey hull too
            if (!at(r, c) && (at(r, c - 1) || at(r, c + 1) || at(r + 1, c))) put(ctx, left + c, top + r, OUTLINE);
        }
        rows.forEach((row, r) => {
            for (let c = 0; c < 5; c++) {
                const ch = row[dir > 0 ? c : 4 - c];
                if (ch === '.') continue;
                put(ctx, left + c, top + r, ch === 'R' ? color : ch === 'V' && isGlinting && c === front ? GLINT : INK[ch]);
            }
        });
    }

    /** How far they can walk from x toward stopX: not into lava or water, not off the screen. */
    function reachable(g, from, stopX, dir) {
        for (let x = Math.round(from); dir > 0 ? x <= stopX : x >= stopX; x += dir) {
            const rise = groundY(g, x) - groundY(g, x + dir), isSteep = rise > MAX_STEP_UP || -rise > MAX_STEP_DOWN;   // an ice spike or a cliff: they stop
            if (g.hot[clampX(x)] || x < 3 || x > W - 4) return x - dir * 3;
            if (isSteep && x !== Math.round(from)) return x;
        }
        return stopX;
    }

    /** A light suit only where the air is breathable and the cold or heat would not kill them (the planet data can say both). */
    function isMild(planet) {
        if (!planet || planet.atmosphere !== 'BREATHABLE') return false;
        const temp = planet.metrics && Number.isFinite(planet.metrics.temp) ? planet.metrics.temp : parseFloat(planet.temperature);
        return !Number.isFinite(temp) || (temp >= MILD_C[0] && temp <= MILD_C[1]);
    }

    function plan(g, s, colors, planet, now) {
        const x = Math.round(s.x), top = Math.round(s.y), isLight = isMild(planet);
        const goal = g.site ? g.site.goalX : x + (x < W / 2 ? 1 : -1) * ROAM;           // nowhere special: out toward open ground
        const dir = goal >= x ? 1 : -1, outX = x + dir * (LANDER_HALF + 3);
        const wanted = colors.map((c, i) => goal - dir * i * SPACING), last = wanted[wanted.length - 1];
        const push = Math.max(0, CLEAR_OF_HULL - dir * (last - x));                     // the last one still stands clear of the hull
        const stops = [];
        wanted.forEach((want, i) => {                                                   // each one stops short of where the one ahead stopped
            const own = reachable(g, outX, want + dir * push, dir), behind = i ? stops[i - 1] - dir * SPACING : own;
            stops.push(dir * (own - behind) > 0 ? (dir * (behind - outX) > 0 ? behind : outX) : own);
        });
        const members = colors.map((color, i) => ({ color, stopX: stops[i], startAt: FIRST_OUT + i * STAGGER, walkMs: (Math.abs(stops[i] - outX) / WALK_PX_S) * 1000 }));
        const hatch = { x: x - LANDER_HALF + (dir > 0 ? 9 : 2), y: top + HULL_ROW };
        const puff = Array.from({ length: isLight ? 7 : 18 }, () => ({ vx: dir * (12 + Math.random() * 30), vy: -(4 + Math.random() * 16), life: PUFF_LIFE * (0.5 + Math.random() * 0.5) }));
        const end = Math.max(...members.map(m => m.startAt + CLIMB_MS + m.walkMs)) + LINGER;
        return { at: now, x, top, dir, outX, hatch, puff, members, isLight, duration: Math.min(MAX_MS, end), ...frame(g, x, goal) };
    }

    /** The camera's goal: the lander, the walk and as much of the site as fits, at up to ZOOM×. */
    function frame(g, x, goal) {
        let lo = Math.min(x - 14, goal - 10), hi = Math.max(x + 14, goal + 10);
        const site = g.site, room = (W / ZOOM) * 0.92;
        if (site) { const spare = Math.max(0, room - (hi - lo)); if (site.dir > 0) hi = Math.max(hi, Math.min(site.x1 + 6, hi + spare)); else lo = Math.min(lo, Math.max(site.x0 - 6, lo - spare)); }
        return { zoom: Math.max(1, Math.min(ZOOM, (W * 0.92) / (hi - lo))), focus: { x: (lo + hi) / 2, y: groundY(g, x) - 24 } };
    }

    /** Where member m is at time t (ms since touchdown): climbing out, walking, or standing at the site. */
    function whereIs(crew, g, m, t) {
        const out = t - m.startAt;
        if (out < 0) return null;
        if (out < CLIMB_MS) {                                                          // comes down the ladder and out from behind the hull
            const k = ease(out / CLIMB_MS), x = crew.x + crew.dir * 2 + (crew.outX - crew.x - crew.dir * 2) * k;
            return { x, feetY: groundY(g, x) - Math.round(3 * (1 - k)), isClimbing: true, isStepping: false };
        }
        const walked = Math.min(1, (out - CLIMB_MS) / Math.max(1, m.walkMs)), x = crew.outX + (m.stopX - crew.outX) * walked;
        return { x, feetY: groundY(g, x), isClimbing: false, isStepping: walked < 1 && Math.floor(out / STEP_MS) % 2 === 1 };
    }

    function drawMembers(ctx, crew, g, now, isBehind) {
        const t = now - crew.at;
        crew.members.forEach((m, i) => {
            const at = whereIs(crew, g, m, t);
            if (!at || at.isClimbing !== isBehind) return;
            const isGlinting = (t + i * 600) % GLINT_EVERY < GLINT_MS;
            drawSuit(ctx, at.x, at.feetY, m.color, crew.dir, at.isStepping, crew.isLight, isGlinting);
        });
    }

    /** Figures still coming out of the hatch: drawn before the lander, so they slide out from behind its hull. */
    const drawBehind = (ctx, crew, g, now) => drawMembers(ctx, crew, g, now, true);

    /** The open hatch with cabin light behind it, its door swung out, the puff of air, and the team on the ground. */
    function drawFront(ctx, crew, g, now) {
        const t = now - crew.at;
        if (t >= HATCH_AT) {
            const { x, y } = crew.hatch;
            for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) put(ctx, x + c, y + r, CABIN[r]);
            const doorX = crew.dir > 0 ? crew.x + LANDER_HALF + 1 : crew.x - LANDER_HALF - 1;
            put(ctx, doorX, y, DOOR); put(ctx, doorX, y + 1, DOOR);
            drawPuff(ctx, crew, (t - HATCH_AT) / 1000);
        }
        drawMembers(ctx, crew, g, now, false);
    }

    function drawPuff(ctx, crew, age) {
        const hx = crew.dir > 0 ? crew.x + LANDER_HALF + 1 : crew.x - LANDER_HALF - 1, hy = crew.hatch.y;
        crew.puff.forEach(p => {
            if (age > p.life) return;
            const k = age / p.life, drift = age * (1 - k / 2);
            const x = Math.round(hx + p.vx * drift), y = Math.round(hy + p.vy * drift + 6 * age * age);
            if (x < 0 || x >= W || y < 0 || y >= H || !dith(x, y, 1.1 - k)) return;
            const ink = PUFF[Math.min(PUFF.length - 1, Math.floor(k * PUFF.length))];
            put(ctx, x, y, ink);
            if (k < 0.4 && x + 1 < W) put(ctx, x + 1, y, ink);                              // fresh vapour is thicker
        });
    }

    /** The camera window over the 320×180 world: { left, top, w, h }. Eases in after touchdown, crisp once it arrives. */
    function view(crew, now) {
        const e = ease(clamp01((now - crew.at - ZOOM_AT) / ZOOM_MS)), z = 1 + (crew.zoom - 1) * e, w = W / z, h = H / z;
        const cx = W / 2 + (crew.focus.x - W / 2) * e, cy = H / 2 + (crew.focus.y - H / 2) * e;
        let left = Math.max(0, Math.min(W - w, cx - w / 2)), top = Math.max(0, Math.min(H - h, cy - h / 2));
        if (e >= 1) { left = Math.round(left); top = Math.round(top); }
        return { left, top, w, h };
    }

    window.LanderCrew = { plan, drawBehind, drawFront, view, drawSuit };
})();
