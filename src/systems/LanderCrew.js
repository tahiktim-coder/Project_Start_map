/* LanderCrew — the away team leaving the lander after a touchdown in the landing game, as the crew-hires people
   (2026-10-11; before that they were 5 × 7 pixel suits). Nobody strolls out in their clothes onto a world at -50°C with
   thin air. The hatch opens on the side facing the site, the cabin air puffs out, and the team comes down one at a time
   in EVA suits: each person's own suit from crew-hires (MiniCrew.small: the helmet with a visor that catches the light,
   the life-support pack, the shell in their colours). Only where the air is breathable (planet.atmosphere 'BREATHABLE')
   and the temperature mild (MILD_C) do they step out as they dress aboard. They walk to the site (g.site.goalX), not
   anywhere, over the soil it piled up, stopping at lava, water or a cliff, and line up there.
   While they step out, the view closes in on them so the moment can be seen; LanderGame paints the close-up sharper
   (LanderScene.closeUp) once the camera has arrived. The walk, the timing and the camera are as before; only the drawing changed.
     plan(g, s, colors, planet, now, ids) once at touchdown → crew (crew.duration: how long to hold the screen)
     drawBehind / drawFront(ctx, crew, g, now, V, S) around the lander; view(crew, now) → the camera window (world px);
     final(crew) → the window the camera ends on. */

(function () {
    'use strict';
    if (!window.LanderScene || !window.LanderScene.util) return;
    const { W, H, toAX, toAY, clampX } = window.LanderScene.util;
    const LANDER_HALF = 6;
    const HATCH_AT = 450, PUFF_LIFE = 1.0, FIRST_OUT = 950, STAGGER = 650, CLIMB_MS = 420;
    const WALK_PX_S = 15, SPACING = 7, CLEAR_OF_HULL = 11, ROAM = 30, LINGER = 800, MAX_MS = 5600, MAX_STEP_UP = 3, MAX_STEP_DOWN = 6;
    const ZOOM = 2, ZOOM_AT = 150, ZOOM_MS = 750, MILD_C = [-15, 40];                // MILD_C: °C they can step out in without suits
    const PERSON_H = 6.4, HATCH_Y = 2.4, HATCH_W = 1.5, HATCH_H = 2.6;                // world px: a person's height; the hatch on the hull (from the lander's top y)
    const ORDER = ['jaxon', 'mira', 'aris', 'vance', 'cora'];

    const clamp01 = v => Math.max(0, Math.min(1, v));
    const ease = t => t * t * (3 - 2 * t);
    /** The ground they walk on: the terrain, or the soil heaped up around the site where that is higher. */
    function groundY(g, x) {
        const k = clampX(Math.round(x)), heap = g.site && g.site.standY ? g.site.standY[k] : Infinity;
        return Math.min(g.heights[k], heap);
    }

    /** How far they can walk from x toward stopX: not into lava or water, not off the screen. */
    function reachable(g, from, stopX, dir) {
        for (let x = Math.round(from); dir > 0 ? x <= stopX : x >= stopX; x += dir) {
            const rise = Math.round(groundY(g, x)) - Math.round(groundY(g, x + dir)), isSteep = rise > MAX_STEP_UP || -rise > MAX_STEP_DOWN;   // an ice spike or a cliff: they stop
            if (g.hot[clampX(x)] || x < 3 || x > W - 4) return x - dir * 3;
            if (isSteep && x !== Math.round(from)) return x;
        }
        return stopX;
    }

    /** No suits only where the air is breathable and the cold or heat would not kill them (the planet data can say both). */
    function isMild(planet) {
        if (!planet || planet.atmosphere !== 'BREATHABLE') return false;
        const temp = planet.metrics && Number.isFinite(planet.metrics.temp) ? planet.metrics.temp : parseFloat(planet.temperature);
        return !Number.isFinite(temp) || (temp >= MILD_C[0] && temp <= MILD_C[1]);
    }

    /** Who each member is ('jaxon' …): from the ids passed, else from their old colour, else in crew order. */
    function idsFor(colors, ids) {
        const MC = window.MiniCrew, used = new Set();
        return colors.map((c, i) => {
            let id = (ids && ids[i] && MC && MC.idOf(ids[i])) || (MC && MC.idOf(c)) || null;
            if (!id || used.has(id)) id = ORDER.find(o => !used.has(o)) || 'jaxon';
            used.add(id); return id;
        });
    }

    function plan(g, s, colors, planet, now, ids) {
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
        const who = idsFor(colors, ids);
        const members = colors.map((color, i) => ({ color, id: who[i], stopX: stops[i], startAt: FIRST_OUT + i * STAGGER, walkMs: (Math.abs(stops[i] - outX) / WALK_PX_S) * 1000 }));
        const hatch = { x: s.x + dir * 0.4, y: s.y + HATCH_Y };
        const puff = Array.from({ length: isLight ? 7 : 18 }, () => ({ vx: dir * (12 + Math.random() * 30), vy: -(4 + Math.random() * 16), life: PUFF_LIFE * (0.5 + Math.random() * 0.5) }));
        const end = Math.max(...members.map(m => m.startAt + CLIMB_MS + m.walkMs)) + LINGER;
        return { at: now, x, sx: s.x, top, dir, outX, hatch, puff, members, isLight, duration: Math.min(MAX_MS, end), ...frame(g, x, goal) };
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
        if (out < CLIMB_MS) {                                                          // comes down and out from behind the hull
            const k = ease(out / CLIMB_MS), x = crew.x + crew.dir * 2 + (crew.outX - crew.x - crew.dir * 2) * k;
            return { x, feetY: groundY(g, x) - 3 * (1 - k), isClimbing: true, isStepping: false, walkT: 0 };
        }
        const walked = Math.min(1, (out - CLIMB_MS) / Math.max(1, m.walkMs)), x = crew.outX + (m.stopX - crew.outX) * walked;
        return { x, feetY: groundY(g, x), isClimbing: false, isStepping: walked < 1, walkT: out - CLIMB_MS };
    }

    function drawMembers(ctx, crew, g, now, isBehind, V, S) {
        const MC = window.MiniCrew, t = now - crew.at;
        if (!MC || !V) return;
        crew.members.forEach(m => {
            const at = whereIs(crew, g, m, t);
            if (!at || at.isClimbing !== isBehind) return;
            MC.small(ctx, m.id, toAX(V, at.x), toAY(V, at.feetY), {
                h: PERSON_H * V.d, pose: at.isClimbing ? 'climb' : at.isStepping ? 'walk' : 'stand', t: at.isClimbing ? t : at.walkT, facing: crew.dir,
                suit: !crew.isLight, light: S && S.Ls < 0 ? -1 : 1, dim: at.isClimbing ? 0.25 : 0,
            });
        });
    }

    /** Figures still coming out: drawn before the lander, so they come round from behind its hull. */
    const drawBehind = (ctx, crew, g, now, V, S) => drawMembers(ctx, crew, g, now, true, V, S);

    /** The open hatch with the cabin's warm light behind it, its door swung out, the puff of air, and the team on the ground. */
    function drawFront(ctx, crew, g, now, V, S) {
        const t = now - crew.at;
        if (t >= HATCH_AT && V && S) {
            const f = S.N.framer(ctx, V.w, V.h), hx = toAX(V, crew.hatch.x - HATCH_W / 2), hy = toAY(V, crew.hatch.y), w = Math.max(2, Math.round(HATCH_W * V.d)), h = Math.max(3, Math.round(HATCH_H * V.d));
            f.px(hx, hy, S.K.WARM_DIM, w, h); f.px(hx + 1, hy + 1, S.K.WARM, Math.max(1, w - 2), Math.max(1, h - 2));
            f.px(crew.dir > 0 ? hx + w : hx - Math.max(1, Math.round(V.d * 0.6)), hy, S.K.RP.HULL.hex[4], Math.max(1, Math.round(V.d * 0.6)), h);   // the door, swung out
            f.glow(hx + w / 2, hy + h / 2, Math.round(2.4 * V.d), S.K.RP.AMBER, 0.25);
            drawPuff(f, crew, (t - HATCH_AT) / 1000, V, S);
        }
        drawMembers(ctx, crew, g, now, false, V, S);
    }

    function drawPuff(f, crew, age, V, S) {
        const hx = crew.hatch.x + crew.dir * HATCH_W, hy = crew.hatch.y + 1;
        crew.puff.forEach(p => {
            if (age > p.life) return;
            const k = age / p.life, drift = age * (1 - k / 2), x = hx + p.vx * drift, y = hy + p.vy * drift + 6 * age * age;
            const size = Math.max(1, Math.round(V.d * (k < 0.4 ? 0.8 : 0.5)));                                // fresh vapour is thicker
            f.tone(toAX(V, x), toAY(V, y), S.K.RP.STAR, 0.95 - k * 0.8, size, size);
        });
    }

    /** The camera window over the 320×180 world: { left, top, w, h }. Eases in after touchdown, crisp once it arrives. */
    function view(crew, now) {
        const e = ease(clamp01((now - crew.at - ZOOM_AT) / ZOOM_MS)), z = 1 + (crew.zoom - 1) * e, w = W / z, h = H / z;
        const cx = W / 2 + (crew.focus.x - W / 2) * e, cy = H / 2 + (crew.focus.y - H / 2) * e;
        let left = Math.max(0, Math.min(W - w, cx - w / 2)), top = Math.max(0, Math.min(H - h, cy - h / 2));
        if (e >= 1) { left = Math.round(left); top = Math.round(top); }
        return { left, top, w, h, arrived: e >= 1 };
    }
    /** Where the camera ends up (the close-up is painted for this window while it moves there). */
    const final = crew => view(crew, crew.at + ZOOM_AT + ZOOM_MS + 1);

    window.LanderCrew = { plan, drawBehind, drawFront, view, final, isMild };
})();
