/* LanderSites — the place the away team is going, drawn beside A.U.R.A.'s marked spot in the landing game:
   one of our ships, crashed (wreck), an empty colony (ruins), graves (stones), a garden under glass (dome), a beacon.
   Nothing here grew out of the planet. Every site is made of what the Exodus ships carried: the same hull metal,
   the same lander, the same helmets. So it reads as people like us, half buried in this world's own soil.
   A wreck is drawn the way its story (ExodusDerelicts.js) finds it: whole, broken in two and torn open, burned, or only
   a crater around the flight recorder; the story id comes in as `detail`.
   place(g, kind, detail) picks the side of the mark with room, clear of other level ground (LanderScene calls it first,
   so rocks keep off). paint() draws it once into the backdrop. drawLive() adds what moves: the transponder light, the
   emergency lamp in a torn hull, the beacon's pulse, the glint on the dome, a torn flag. g.site.goalX is where the team
   walks to; g.site.standY is the soil it piled up, which they walk on. */

(function () {
    'use strict';
    if (!window.LanderScene || !window.LanderScene.util) return;
    const { W, H, dith, css, mix, put, clampX } = window.LanderScene.util;
    const AMBER = '#d9a24a', AMBER_HOT = '#ffe6a0', AMBER_DIM = '#5a4520', GLASS_DARK = '#0f2a33', GLASS_LIT = '#3f7f8f', GLINT = '#e8fbff', WARM_DARK = '#2a1e10';
    const METAL = [[9, 10, 12], [22, 25, 26], [40, 45, 44], [70, 76, 72], [116, 124, 114], [176, 188, 176], [214, 224, 212]]; // our hull, dark to bright
    const GAP = 9, CLEAR = 4, SPILL = 0.3, LAMP_REACH = 4.5;                             // LAMP_REACH: px the wreck's emergency lamp lights around it                                       // px from the mark; px kept off other level ground; share allowed off-screen
    const SIZE = { wreck: [86, 40], ruins: [74, 22], stones: [46, 22], dome: [44, 34], beacon: [36, 24] }; // [wanted, least] footprint, px

    const groundAt = (g, x) => g.heights[clampX(Math.round(x))];
    const isOn = (x, y) => x >= 0 && x < W && y >= 0 && y < H;
    const dot = (ctx, x, y, color) => { x = Math.round(x); y = Math.round(y); if (isOn(x, y)) put(ctx, x, y, color); };
    const hexRgb = hex => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
    /** A tone t (0 dark … 1 bright) on a ramp: solid bands with a thin dithered seam between them, so metal reads as metal. */
    function tone(stops, t, x, y) {
        const pos = Math.max(0, Math.min(0.999, t)) * (stops.length - 1), lo = Math.floor(pos), f = pos - lo;
        return stops[dith(x, y, Math.max(0, Math.min(1, (f - 0.5) * 3 + 0.5))) ? lo + 1 : lo];
    }
    function meanGround(g, x) {
        let sum = 0;
        for (let k = -3; k <= 3; k++) sum += Math.min(groundAt(g, x + k), H - 2);
        return sum / 7;
    }

    /** Where the site stands (detail: for a wreck, which wreck story it is): beside the mark on the side you can see more of, stopping short of any other level stretch. */
    function place(g, kind, detail) {
        const wl = kind === 'wreck' ? lookOfWreck(detail) : null, size = wl ? (wl.hasFence ? [96, 50] : WRECK_SIZE[wl.form]) : SIZE[kind], m = g.mark;
        if (!size || !m) return null;
        const [want, least] = size, startRight = Math.round(m.x1 + GAP), startLeft = Math.round(m.x0 - GAP);
        function sides(isClearOfLevel) {
            const others = isClearOfLevel ? (g.level || []).filter(l => l.c1 < m.c0 || l.c0 > m.c1) : [];
            const endRight = others.filter(l => l.c0 > m.c1).reduce((e, l) => Math.min(e, l.x0 - CLEAR), W + want * SPILL);
            const endLeft = others.filter(l => l.c1 < m.c0).reduce((e, l) => Math.max(e, l.x1 + CLEAR), -want * SPILL);
            return { roomRight: endRight - startRight, roomLeft: startLeft - endLeft, seenRight: Math.min(endRight, W) - startRight, seenLeft: startLeft - Math.max(endLeft, 0) };
        }
        let r = sides(true);
        if (Math.max(r.seenRight, r.seenLeft) < least) r = sides(false);             // hemmed in both ways: it may stand over other level ground
        const dir = r.seenRight >= r.seenLeft ? 1 : -1, near = dir > 0 ? startRight : startLeft;
        const length = Math.round(Math.max(least, Math.min(want, dir > 0 ? r.roomRight : r.roomLeft))), far = near + dir * length;
        return { kind, detail: detail || null, dir, near, length, x0: Math.min(near, far), x1: Math.max(near, far), goalX: near, live: {} };
    }

    // ── shared pieces: soil, and bodies lying half buried ──
    /** This world's soil at column x, from y = top down into the ground: drift against a wall, the berm a crash pushed up. */
    function heap(ctx, g, look, x, top, isLit) {
        x = Math.round(x); top = Math.round(top);
        if (x < 0 || x >= W || g.hot[x]) return;
        const ground = Math.round(g.heights[x]);
        if (top < ground && look.stand) look.stand[x] = Math.min(look.stand[x], top);       // the team walks on the heap, not through it
        for (let y = top; y <= ground; y++) dot(ctx, x, y, y === top ? (isLit ? look.soil.lit : look.soil.edge) : dith(x, y, 0.62 - (y - top) * 0.05) ? look.soil.upper : look.soil.mid);
    }

    /** An axis for a body lying from x = near toward dir, resting on the ground: lift raises the near end, tip the far end (px). */
    const MAX_SLOPE = 0.32;                                                          // a body lying on the ground is never steeper than this
    function restingAxis(g, near, dir, len, sink, lift, tip) {
        const ya = meanGround(g, near + dir * 3) - sink - (lift || 0), yb = meanGround(g, near + dir * (len - 3)) - sink - (tip || 0);
        const slope = Math.max(-MAX_SLOPE, Math.min(MAX_SLOPE, (yb - ya) / len)), mid = (ya + yb) / 2;
        return { ox: near, oy: mid - slope * len / 2, dir, slope };                   // pivot on the middle, so a clamped tilt stays seated
    }
    const axisY = (a, x) => a.oy + (x - a.ox) * a.dir * a.slope;
    function toScreen(a, u, v) {                                                   // local (along, across) → screen
        const len = Math.hypot(1, a.slope), ex = a.dir / len, ey = a.slope / len;
        return { x: a.ox + u * ex - v * a.dir * ey, y: a.oy + u * ey + v / len };
    }

    /**
     * Paint a body lying along axis a: shade(u, v, x, y) → colour or null, u = along the axis from its near end, v = across
     * (down is +). Nothing is painted below the dirt line min(ground, axis + bury): that is how it lies half buried.
     */
    function body(ctx, g, a, uMax, vMax, bury, shade) {
        const len = Math.hypot(1, a.slope), ex = a.dir / len, ey = a.slope / len, nx = -a.dir * ey, ny = 1 / len;
        const ends = [a.ox - a.dir * 2, a.ox + a.dir * (uMax + 2)];
        for (let x = Math.max(0, Math.floor(Math.min(...ends))); x <= Math.min(W - 1, Math.ceil(Math.max(...ends))); x++) {
            const yc = axisY(a, x), dirt = Math.min(g.heights[x], yc + bury);
            for (let y = Math.max(0, Math.floor(yc - vMax - 2)); y < Math.min(H, dirt); y++) {
                const du = x + 0.5 - a.ox, dv = y + 0.5 - a.oy, c = shade(du * ex + dv * ey, du * nx + dv * ny, x, y, dirt - y);
                if (c) put(ctx, x, y, c);
            }
        }
    }

    /** The soil a body pushed up along its length, tapering off past both ends; mound(k) adds more at k px along. */
    function berm(ctx, g, look, a, uMax, bury, taper, mound) {
        for (let k = -taper; k <= uMax + taper; k++) {
            const outside = k < 0 ? -k : k > uMax ? k - uMax : 0, x = Math.round(a.ox + a.dir * k);
            const top = a.oy + k * a.slope + bury + outside * 1.3 + (Math.sin(k * 1.7) > 0.7 ? -1 : 0) - (mound ? mound(k) : 0);
            heap(ctx, g, look, x, top, (k < 0) === (a.dir > 0));
        }
    }

    /** Cylinder shading for hull metal: a lit top with dust on it, a bright band along the flank, dark where it meets the soil. */
    function skin(look, v, hw, x, y, aboveDirt, darken) {
        const q = v / hw;
        if (q < -0.9) return darken > 0.4 ? look.metal[2] : dith(x, y, 0.5) ? look.dust : look.metal[5];
        let t = 0.84 - 0.62 * Math.pow(Math.max(0, (q + 1) / 1.35), 0.9) - (darken || 0);
        if (Math.abs(q + 0.6) < 0.1) t += 0.14;
        if (aboveDirt < 2.5) t -= 0.18;
        return tone(look.metal, t, x, y);
    }

    // ── one of ours: the Exodus hull from the main screen, lying on its side, as its story (ExodusDerelicts.js) says it was found ──
    const WRECK_LOOKS = {
        EXODUS_DEAD_CREW: { form: 'whole', windows: 'dark' }, EXODUS_INFECTED: { form: 'whole', windows: 'mould' },
        EXODUS_CRYO: { form: 'whole', windows: 'cryo' }, EXODUS_PARTIAL: { form: 'whole', windows: 'warm', hasFence: true },
        EXODUS_CACHE: { form: 'broken', windows: 'dark' }, EXODUS_BURNED: { form: 'burned', windows: 'none' }, EXODUS_LOG: { form: 'crater' },
    };
    const lookOfWreck = detail => WRECK_LOOKS[detail] || { form: 'broken', windows: 'dark' };      // story not known yet: broken in two
    const WRECK_SIZE = { whole: [76, 44], broken: [86, 40], burned: [76, 44], crater: [48, 30] };
    const WINDOW_INK = { mould: '#cfe0c8', cryo: '#74d99a', warm: AMBER };
    const BELL_LEN = 6;

    function paintWreck(ctx, g, rand, site, look) {
        const wl = lookOfWreck(site.detail);
        if (wl.form === 'crater') { paintCrater(ctx, g, rand, site, look); return; }
        const { dir, near, length } = site, M = look.metal, isBroken = wl.form === 'broken' && length >= 64;
        const R = Math.max(8, Math.min(13, Math.round(length * 0.15))), bury = R * 0.32, seed = rand() * 10;
        const fenceLen = wl.hasFence && length >= 70 ? 22 : 0, hullLen = length - BELL_LEN - fenceLen;
        const foreLen = isBroken ? Math.round(length * 0.54) : hullLen, gap = isBroken ? Math.round(length * 0.12) : 0, aftLen = hullLen - foreLen - gap;
        const shipLen = isBroken ? foreLen + aftLen + 4 : hullLen, noseLen = Math.round(R * 1.4), gashLen = Math.min(20, Math.round(foreLen * 0.42));
        const fore = restingAxis(g, near, dir, foreLen, bury, R * 0.2, isBroken ? 0 : R * 0.1);
        const lampU = isBroken ? [0.36, 0.52, 0.68].map(f => f * shipLen).find(b => b > foreLen - gashLen + 4 && b < foreLen - 3) || foreLen - gashLen * 0.45 : 0;
        const lamp = isBroken ? toScreen(fore, lampU + 1, -R * 0.38) : { x: -99, y: -99 };
        const ship = {
            M, look, R, seed, noseLen, lamp, glow: [], windows: wl.windows, isBurned: wl.form === 'burned', hatchU: wl.form === 'burned' ? -99 : noseLen + 3,
            bulkheads: [0.2, 0.36, 0.52, 0.68, 0.84].map(f => f * shipLen), cryoK: Math.floor(shipLen * 0.45 / 8), // cryoK: the first of the three lit cryo-bay portholes
            dents: dentsFor(rand, noseLen + 10, foreLen - (isBroken ? gashLen : 10), R),
            tear: v => 1 + 2.2 * Math.abs(Math.sin(v * 1.9 + seed)) + (Math.sin(v * 5.3 + seed * 2) > 0.8 ? 1 : 0),
        };
        const melt = wl.form === 'burned' ? u => 0.4 * Math.max(0, Math.sin(Math.PI * (u - hullLen * 0.28) / (hullLen * 0.44))) + (Math.sin(u * 3.1) > 0.6 ? 0.06 : 0) : null;
        berm(ctx, g, look, fore, foreLen, bury, 5, k => (k < 4 ? R * 0.42 * Math.max(0, 1 - Math.abs(k + 1) / 6) : 0)); // the nose ploughed a mound
        body(ctx, g, fore, foreLen + (isBroken ? 0 : BELL_LEN + 0.5), R + 1, bury, hullShade(ship, { len: foreLen, uStart: 0, hasNose: true, hasStern: !isBroken, isTornFar: isBroken, gashLen: isBroken ? gashLen : 0, melt }));
        if (isBroken) {
            const aft = restingAxis(g, near + dir * (foreLen + gap), dir, aftLen, bury, -R * 0.1, R * 0.2);
            ship.dents = dentsFor(rand, 6, aftLen - 4, R);
            berm(ctx, g, look, aft, aftLen, bury, 4);
            body(ctx, g, aft, aftLen + BELL_LEN + 0.5, R + 1, bury, hullShade(ship, { len: aftLen, uStart: shipLen - aftLen, hasStern: true, isTornNear: true }));
            scatterDebris(ctx, g, look, rand, near + dir * foreLen, dir, gap, toScreen(fore, foreLen - 3, -R * 0.15));
            site.live.lamp = { x: Math.round(lamp.x), y: Math.round(lamp.y), glow: ship.glow };
        }
        if (fenceLen) paintFence(ctx, g, look, near + dir * (hullLen + BELL_LEN + 4), dir, fenceLen - 4);
        const mast = toScreen(fore, noseLen + 7, -R * (melt ? 0.95 : 1));                 // the transponder: the one thing every wreck still has
        dot(ctx, mast.x, mast.y, M[3]); dot(ctx, mast.x, mast.y - 1, M[4]);
        site.live.transponder = { x: Math.round(mast.x), y: Math.round(mast.y) - 2 };
        site.goalX = Math.round(toScreen(fore, ship.isBurned ? hullLen * 0.35 : ship.hatchU + 2.5, 0).x);   // to the hatch (a burned hull has none left)
    }

    /**
     * The shader for one hull piece: u along it from the nose end (uStart: where this piece sat in the whole ship), v across.
     * A piece can have the rounded nose, the tapered stern with both engine bells, a torn end, a gash torn in its side, a melted top.
     */
    function hullShade(ship, o) {
        const { M, R, noseLen, tear } = ship;
        function half(u) {
            if (u < 0 || u > o.len) return 0;
            const hw = o.hasNose && u < noseLen ? R * (0.3 + 0.7 * Math.sin((u / noseLen) * Math.PI / 2)) : R;
            return o.hasStern ? hw * (1 - 0.22 * Math.max(0, Math.min(1, (u - o.len * 0.72) / (o.len * 0.28)))) : hw;
        }
        const gashEdge = u => { const s = (u - (o.len - o.gashLen)) / o.gashLen, jag = Math.sin(u * 2.1 + ship.seed) * 0.9 + (Math.sin(u * 4.7) > 0.7 ? 1 : 0); return s > 0 ? [-0.8 * Math.sqrt(s) + jag / R, 0.32 * Math.sqrt(s) - jag / R] : null; };
        const inGash = (u, q) => { if (!o.gashLen) return false; const e = gashEdge(u); return !!e && q > e[0] && q < e[1]; };
        return (u, v, x, y, aboveDirt) => {
            if (o.hasStern && u > o.len) return bell(M, R, u - o.len, v, x, y);
            const hw = half(u), uShip = o.uStart + u, top = o.melt ? hw * (1 - o.melt(u)) : hw;
            if (hw <= 0 || v < -top || v > hw) return null;
            if (o.isTornFar && u > o.len - tear(v)) return null;
            if (o.isTornNear && u < tear(-v + 3)) return null;
            const q = v / hw, edgeNear = o.isTornNear ? tear(-v + 3) : -9;
            if (o.isTornNear && u < edgeNear + 4 && q > -0.75 && q < 0.3) return u < edgeNear + 1 ? (v < 0 ? M[5] : M[3]) : interior(ship, uShip, v, hw, x, y);
            if (inGash(u, q)) return interior(ship, uShip, v, hw, x, y);
            if (inGash(u, q + 1 / hw) || inGash(u, q - 1 / hw) || inGash(u + 1, q) || (o.isTornFar && u > o.len - tear(v) - 1)) return v < 0 ? M[5] : M[3]; // torn edges catch the light
            if (o.melt && v < -top + 1.2 && o.melt(u) > 0.05) return M[1];             // the slumped, melted rim
            if (o.hasStern && u > o.len - 1.5) return u > o.len - 0.6 ? M[2] : M[3];  // the stern plate
            if (o.hasNose && !ship.isBurned && u > noseLen * 0.3 && u < noseLen * 0.85 && Math.abs(q + 0.34) < 0.15) return q < -0.42 ? (u < noseLen * 0.42 ? GLINT : GLASS_LIT) : GLASS_DARK; // the bridge window
            if (o.hasNose && u >= ship.hatchU && u < ship.hatchU + 5 && q > -0.3 && q < 0.3) return u < ship.hatchU + 1 || u >= ship.hatchU + 4 || q < -0.22 ? M[2] : q > 0.22 ? M[4] : M[3]; // the crew hatch, shut
            if (o.hasNose && u >= ship.hatchU + 1 && u < ship.hatchU + 4 && Math.abs(q + 0.42) < 0.06) return AMBER_DIM;   // its faded RESCUE marking
            const scorch = ship.isBurned ? 0.3 + (Math.floor(v * 0.8 + u * 0.12) % 3 === 0 ? 0.12 : 0) : o.gashLen ? Math.max(0, 1 - Math.min(Math.abs(u - (o.len - o.gashLen)), o.len - u) / 5) * 0.45 : o.isTornNear ? Math.max(0, 1 - (u - edgeNear) / 6) * 0.45 : 0;
            return hullPixel(ship, uShip, v, hw, x, y, aboveDirt, scorch, u > noseLen + 2 || !o.hasNose);
        };
    }

    /** An engine bell, seen from the side: a narrow throat, then a flare with a lit lip. */
    function bell(M, R, du, v, x, y) {
        for (const vb of [-R * 0.45, R * 0.45]) {
            const bh = du < 1.5 ? 1.6 : 1.6 + (du - 1.5) * 0.7, off = Math.abs(v - vb);
            if (du > BELL_LEN + 0.5 || off > bh) continue;
            if (du < 1.5) return M[1];
            if (du > BELL_LEN - 0.5) return off > bh - 1.2 ? M[5] : M[2];
            return off > bh - 1 ? (v < vb ? M[5] : M[2]) : tone(M, 0.5 - (v - vb) / bh * 0.2, x, y);
        }
        return null;
    }

    /** A few dents and missing plates on the hull: [u, v, w, h] in hull pixels. */
    function dentsFor(rand, from, to, R) {
        return to - from < 6 ? [] : Array.from({ length: 3 }, () => [from + rand() * (to - from - 4), -R * (0.75 - rand() * 0.6), 2 + Math.floor(rand() * 3), 1 + Math.floor(rand() * 2)]);
    }

    /** Outer hull: cylinder shading, plate seams every 8 px, portholes (lit as its story says), dents, scorch. */
    function hullPixel(ship, uShip, v, hw, x, y, aboveDirt, scorch, hasPortholes) {
        const { M, look } = ship, q = v / hw;
        const dent = ship.dents.find(([du, dv, w, h]) => uShip >= du && uShip < du + w && v >= dv && v < dv + h + 1);
        if (dent && !ship.isBurned) return v >= dent[1] + dent[3] ? M[5] : M[2];                 // a dent: dark, with a lit lower lip
        if (hasPortholes && ship.windows !== 'none' && Math.floor(uShip) % 8 === 4 && Math.round(v) === Math.round(-0.36 * hw)) return windowInk(ship, uShip);
        if (Math.floor(uShip) % 8 === 0 && q > -0.9) return tone(M, 0.62 - 0.5 * (q + 1) / 1.35 - scorch, x, y);   // plate seams
        return skin(look, v, hw, x, y, aboveDirt, scorch);
    }

    /** What shows in a porthole: dark, or the cryo bay's three green lights, the white mould, a deck that still has power. */
    function windowInk(ship, uShip) {
        const k = Math.floor(uShip / 8), ink = WINDOW_INK[ship.windows];
        if (ship.windows === 'cryo') return k >= ship.cryoK && k < ship.cryoK + 3 ? ink : ship.M[0];           // three pods, three green lights
        if (ink) return k % 3 === 1 ? ink : ship.M[0];
        return ship.M[0];
    }

    /** Inside, through a tear: dark, deck walls with their hatchways, ribs of the far wall, and the one lamp still on. */
    function interior(ship, uShip, v, hw, x, y) {
        const { M, lamp, glow } = ship, d = Math.hypot(x - lamp.x, y - lamp.y), q = v / hw;
        if (d < LAMP_REACH) glow.push([x, y, d]);
        if (ship.bulkheads.some(b => Math.abs(uShip - b) < 0.7)) return Math.abs(q) < 0.18 ? M[0] : d < 6 ? AMBER_DIM : M[3];
        if (d < 2.2) return WARM_DARK;                                                  // the light it throws on the wall behind
        if (Math.floor(uShip) % 4 === 0) return M[1];                                   // ribs of the far wall
        return q > 0.1 ? M[1] : M[0];
    }

    /** Hull plates in the gap and around, one driven into the ground on a slant, a cable sagging from the torn end. */
    function scatterDebris(ctx, g, look, rand, from, dir, gap, cableTop) {
        const M = look.metal;
        for (let k = 0; k < 7; k++) {
            const x = Math.round(from + dir * (rand() * (gap + 8) - 4)), y = Math.round(groundAt(g, x)) - 1, w = 1 + Math.floor(rand() * 3);
            for (let c = 0; c < w; c++) dot(ctx, x + c, y, c === 0 ? M[5] : M[3]);
            if (w > 1) dot(ctx, x + 1, y - 1, M[4]);
        }
        const sx = Math.round(from + dir * (gap * 0.5 + 1)), sy = Math.round(groundAt(g, sx));
        for (let k = 0; k < 5; k++) dot(ctx, sx + dir * Math.floor(k / 2), sy - k, k === 4 ? M[5] : M[3]);
        const end = { x: from + dir * Math.max(4, gap * 0.7), y: groundAt(g, from + dir * Math.max(4, gap * 0.7)) - 1 };
        for (let s = 0; s <= 1; s += 0.06) {
            const x = cableTop.x + (end.x - cableTop.x) * s, sag = Math.sin(s * Math.PI) * 3;
            dot(ctx, x, Math.min(groundAt(g, x) - 1, cableTop.y + (end.y - cableTop.y) * s + sag), M[2]);
        }
    }

    /** The crew that landed safely tried to stay: a fence of hull struts with a wire sagging between them. */
    function paintFence(ctx, g, look, from, dir, len) {
        const M = look.metal, posts = [];
        for (let k = 0; k <= len; k += 6) posts.push({ x: Math.round(from + dir * k), y: Math.round(groundAt(g, from + dir * k)) });
        posts.forEach((p, i) => {
            for (let d = 1; d <= 6; d++) dot(ctx, p.x, p.y - d, d === 6 ? M[5] : M[3]);
            const next = posts[i + 1];
            if (next) for (let s = 0.15; s < 1; s += 0.15) dot(ctx, p.x + (next.x - p.x) * s, p.y - 4 + (next.y - p.y) * s + Math.sin(s * Math.PI) * 1.2, M[2]);
        });
    }

    /** Only a crater: the ground scorched and fused glassy, twisted bits of hull, and the armoured flight recorder, still pinging. */
    function paintCrater(ctx, g, rand, site, look) {
        const { dir, near, length } = site, M = look.metal;
        for (let k = -4; k <= length + 4; k++) {
            const x = Math.round(near + dir * k);
            if (x < 0 || x >= W || g.hot[x]) continue;
            const top = Math.round(g.heights[x]), heat = Math.max(0, 1 - Math.abs(k - length / 2) / (length / 2 + 4));
            for (let d = 0; d < 8; d++) {                                               // charred black, fused to glass that glints
                const isGlass = d < 2 && (x * 7 + d * 3) % 5 === 0;
                if (heat > 0.25 && d < 2) put(ctx, x, top + d, isGlass ? '#8a9098' : '#1a1a1d');
                else if (dith(x, top + d, heat * (0.9 - d * 0.11))) put(ctx, x, top + d, '#141416');
            }
        }
        for (let k = 0; k < 9; k++) {                                                   // what is left of the hull
            const x = Math.round(near + dir * (4 + rand() * (length - 8))), y = Math.round(groundAt(g, x)) - 1, w = 1 + Math.floor(rand() * 3);
            for (let c = 0; c < w; c++) dot(ctx, x + c, y - (c === 1 && k % 3 === 0 ? 1 : 0), c === 0 ? M[4] : M[2]);
        }
        const rx = Math.round(near + dir * length * 0.45), ry = Math.round(groundAt(g, rx));
        for (let r = 0; r < 3; r++) for (let c = -2; c <= 2; c++) dot(ctx, rx + c, ry - 1 - r, c === -2 || r === 2 ? '#e0874a' : c === 1 ? '#7a3a1a' : '#c8642a');   // the recorder: orange, banded
        for (let c = -3; c <= 3; c++) heap(ctx, g, look, rx + c, ry - (Math.abs(c) < 3 ? 0 : -1), c < 0);
        site.live.transponder = { x: rx, y: ry - 4 };
        site.goalX = rx - dir * 4;
    }

    /** The emergency lamp inside a torn hull, and the transponder light every wreck still has, blinking slow. */
    function drawWreckLive(ctx, g, site, now) {
        const lamp = site.live.lamp, ping = site.live.transponder;
        if (ping) dot(ctx, ping.x, ping.y, now % 1800 < 260 ? AMBER_HOT : AMBER_DIM);
        if (!lamp) return;
        const isStutter = Math.floor(now / 90) % 41 === 0, breath = isStutter ? 0.1 : 0.7 + 0.2 * Math.sin(now / 1100);
        lamp.glow.forEach(([x, y, d]) => { if (d < 1.5 || dith(x, y, breath * (1 - d / LAMP_REACH) * 0.8)) put(ctx, x, y, d < 1.5 ? AMBER : AMBER_DIM); });
        dot(ctx, lamp.x, lamp.y, isStutter ? AMBER_DIM : AMBER_HOT);
    }

    // ── an empty colony: hab modules from the same ships, one fallen in, a lander like ours under the drift ──
    /** An upright hab module: a squat drum with a domed roof, lit from the left. The door faces the lander. A fallen one has lost its roof. */
    function hab(ctx, g, look, cx, dir, w, wall, opts) {
        const M = look.metal, half = w / 2, base = Math.round(meanGround(g, cx)), capH = Math.round(half * 0.7);
        for (let k = -Math.ceil(half) - 3; k <= Math.ceil(half) + 3; k++) {             // drift under it and piled against the far side
            const out = Math.max(0, Math.abs(k) - half), isFar = k * dir > 0;
            heap(ctx, g, look, cx + k, base + 1 + out * 0.9 - (isFar && out < 1 ? 2 : 0), k < 0);
        }
        for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half); x++) {
            const dx = (x + 0.5 - cx) / half, side = dx * dir;                            // side < 0: toward the lander
            if (Math.abs(dx) > 1) continue;
            const broken = opts.isCollapsed ? Math.round(1.4 * Math.abs(Math.sin(x * 2.3))) : 0;
            const top = opts.isCollapsed ? base - wall + broken : base - wall - Math.round(capH * Math.sqrt(Math.max(0, 1 - dx * dx)));
            for (let y = top; y <= Math.min(base, groundAt(g, x)); y++) {
                const isRoof = y < base - wall, isDoor = opts.hasDoor && side > -0.78 && side < -0.3 && y > base - 5;
                const isWindow = side > 0.2 && side < 0.6 && y === base - wall + 2;
                let c = tone(M, 0.84 - 0.42 * (dx + 1) / 2 + (isRoof ? 0.12 : 0) - (y === base - wall ? 0.22 : 0) - (y >= base - 1 ? 0.15 : 0), x, y);
                if (isDoor) c = y === base - 4 ? M[5] : '#06070a';
                else if (isWindow) c = M[0];
                else if (opts.isCollapsed && y <= top + 1) c = y === top ? M[5] : M[1];      // the torn rim, and the dark inside
                dot(ctx, x, y, c);
            }
        }
        if (opts.isCollapsed) for (let x = Math.floor(cx - half * 0.7); x <= Math.ceil(cx + half * 0.2); x += 2) {   // what is left of the roof ribs
            const dx = (x + 0.5 - cx) / half;
            dot(ctx, x, base - wall - Math.round(capH * Math.sqrt(Math.max(0, 1 - dx * dx))), M[3]);
        }
        return { doorX: Math.round(cx - dir * half * 0.55) };
    }

    function solarPanel(ctx, g, look, x) {
        const gy = Math.round(groundAt(g, x)), M = look.metal;
        for (let k = 1; k <= 4; k++) dot(ctx, x, gy - k, M[3]);
        for (let row = 0; row < 3; row++) for (let c = 0; c < 9; c++) {
            if (row === 0 && c > 6) continue;                                        // a corner broken off
            const px = x - 4 + c, py = gy - 7 + row + Math.round((c - 4) * 0.3);
            dot(ctx, px, py, row === 0 ? '#5f8fb0' : c % 3 === 2 ? '#3a5a74' : '#14263a');
        }
    }

    function mast(ctx, g, look, x, site) {
        const gy = Math.round(groundAt(g, x)), tall = 20, lean = 0.16, M = look.metal;
        for (let k = 0; k < tall; k++) dot(ctx, x + Math.round(k * lean), gy - k, k % 6 === 0 ? M[4] : M[3]);
        const tx = x + Math.round(tall * lean), ty = gy - tall;
        for (let k = -2; k <= 2; k++) dot(ctx, tx + k, ty + 2, M[3]);
        dot(ctx, tx - 2, ty + 1, M[4]); dot(ctx, tx + 2, ty + 1, M[4]);
        for (let k = -2; k <= 2; k++) heap(ctx, g, look, x + k, gy - 2 + Math.abs(k), k < 0);
        site.live.flag = { x: tx, y: ty + 4 };
    }

    /** A lander exactly like ours, sunk in drift up to its hull: the window dark, its lamp long dead. */
    function buriedLander(ctx, g, look, x) {
        const LG = window.LanderGame;
        if (!LG || !LG.SPRITE) return;
        const gy = Math.round(meanGround(g, x)), top = gy - 7, dust = hexRgb(look.soilHex);
        const driftTop = px => gy - 3 + Math.abs(px - x) * 0.35;
        for (let k = -9; k <= 9; k++) heap(ctx, g, look, x + k, driftTop(x + k), k < 0);
        LG.SPRITE.forEach((row, ry) => {
            for (let rx = 0; rx < row.length; rx++) {
                const ch = row[rx], px = x - 6 + rx + (ry < 3 ? 1 : 0), py = top + ry;  // leaning a little
                if (ch === '.' || py >= driftTop(px)) continue;
                const base = ch === 'w' || ch === 'h' || ch === 'l' ? [12, 26, 30] : hexRgb(LG.SPRITE_INK[ch] || '#8f8a7a');
                dot(ctx, px, py, css(mix(base, dust, ry < 2 ? 0.45 : 0.25)));
            }
        });
    }

    function paintRuins(ctx, g, rand, site, look) {
        const { dir, near, length } = site, at = offset => near + dir * offset;
        if (length >= 66) buriedLander(ctx, g, look, at(60));
        if (length >= 50) mast(ctx, g, look, at(47), site);
        if (length >= 42) hab(ctx, g, look, at(35), dir, 11, 5, { isCollapsed: true });
        if (length >= 28) solarPanel(ctx, g, look, at(22));
        site.goalX = hab(ctx, g, look, at(8), dir, 13, 6, { hasDoor: true }).doorX;     // the team walks to the open door
    }

    function drawRuinsLive(ctx, g, site, now) {                                       // a torn strip on the mast, in whatever wind there is
        const f = site.live.flag;
        if (!f) return;
        const blow = Math.sign(g.wind), frame = Math.floor(now / 200) % 2;
        for (let k = 0; k < 4; k++) {
            const x = blow ? f.x + blow * (k + 1) : f.x + 1, y = blow ? f.y + ((k + frame) % 2) : f.y + k;
            dot(ctx, x, y, k < 2 ? '#9a5a3a' : '#6a3a2a');
        }
    }

    // ── graves: low mounds, markers cut from hull plate, one helmet left on a marker ──
    function marker(ctx, look, x, gy, style, lean, isBack) {
        const M = look.metal, lit = isBack ? M[3] : M[5], body = isBack ? M[2] : M[4], dark = isBack ? M[1] : M[2];
        if (style === 0) {                                                            // a plate cut from hull metal, rounded off, a name scratched across it
            const tall = isBack ? 4 : 5, wide = isBack ? 3 : 4;
            for (let r = 0; r < tall; r++) for (let c = 0; c < wide; c++) {
                if (r === tall - 1 && (c === 0 || c === wide - 1)) continue;
                const isName = !isBack && r === 2 && c > 0 && c < wide - 1;
                dot(ctx, x - 1 + c + (r > 2 ? lean : 0), gy - 1 - r, isName ? dark : c === 0 || r === tall - 1 ? lit : c === wide - 1 ? dark : body);
            }
        } else if (style === 1) {                                                     // a strut with a small plate on top
            for (let r = 0; r < (isBack ? 5 : 7); r++) dot(ctx, x + (r > 4 ? lean : 0), gy - 1 - r, r % 3 === 0 ? lit : body);
            for (let c = -1; c <= 1; c++) { dot(ctx, x + c + lean, gy - (isBack ? 5 : 7), lit); dot(ctx, x + c + lean, gy - (isBack ? 4 : 6), dark); }
        } else {                                                                      // stones piled up
            [[0, 1, 3], [1, 2, 2], [2, 2, 1]].forEach(([r, w, c0]) => { for (let c = 0; c < w + 1; c++) dot(ctx, x - c0 + c + r, gy - 1 - r, c === 0 ? lit : body); });
        }
    }

    function paintGraves(ctx, g, rand, site, look) {
        const { dir, near, length } = site, step = 8, count = Math.max(3, Math.min(5, Math.floor((length - 2) / step)));
        for (let k = 0; k < count - 1; k++) {                                          // the row behind: smaller and dimmer, between the front ones
            const x = Math.round(near + dir * (6 + k * step)), gy = Math.round(groundAt(g, x)) - 1;
            for (let c = -2; c <= 2; c++) heap(ctx, g, look, x + c, gy - (Math.abs(c) < 2 ? 1 : 0), c < 0);
            marker(ctx, look, x, gy - 1, rand() < 0.5 ? 0 : 1, 0, true);
        }
        let helmetAt = null;
        for (let k = 0; k < count; k++) {                                              // the front row: a mound each, a plate cut from hull metal
            const x = Math.round(near + dir * (2 + k * step)), gy = Math.round(groundAt(g, x));
            for (let c = -3; c <= 3; c++) heap(ctx, g, look, x + c, gy - (Math.abs(c) < 2 ? 2 : Math.abs(c) < 3 ? 1 : 0), c < 0);
            marker(ctx, look, x, gy - 2, k % 3 === 2 ? 1 : 0, k > 0 && rand() < 0.3 ? -dir : 0, false);
            if (k === 0) helmetAt = { x: x + 1, y: gy - 8 };
        }
        if (helmetAt) helmet(ctx, look, helmetAt.x, helmetAt.y, -dir, site);
        site.goalX = near - dir * 2;
    }

    /** One of our EVA helmets, set on top of a marker, visor toward the lander. */
    function helmet(ctx, look, x, y, face, site) {
        const rows = ['.HH.', 'HHVV', '.hh.'], ink = { H: '#c9cec4', h: '#8f8a7a', V: '#1d5563' };
        rows.forEach((row, r) => { for (let c = 0; c < 4; c++) { const ch = row[face > 0 ? c : 3 - c]; if (ch !== '.') dot(ctx, x - 2 + c, y - 2 + r, ink[ch]); } });
        site.live.glint = { x: x - 2 + (face > 0 ? 3 : 0), y: y - 1 };
    }

    function drawGlint(ctx, g, site, now) {
        const glint = site.live.glint;
        if (glint && Math.floor(now / 160) % 14 < 2) dot(ctx, glint.x, glint.y, GLINT);
    }

    // ── a garden under glass: a framed dome, green inside, an airlock toward the lander ──
    function paintDome(ctx, g, rand, site, look) {
        const { dir, near, length } = site, M = look.metal, r = Math.max(13, Math.min(16, Math.floor((length - 9) / 2)));
        const cx = Math.round(near + dir * (8 + r)), baseY = Math.round(meanGround(g, cx)) - 1;
        const plantTop = x => baseY - 3 - Math.round(3 * Math.abs(Math.sin(x * 0.7 + 1)) + 2 * Math.abs(Math.sin(x * 0.23)));
        for (let x = cx - r - 4; x <= cx + r + 4; x++) heap(ctx, g, look, x, baseY + 2 + Math.max(0, Math.abs(x - cx) - r) * 0.8, x < cx);
        for (let y = baseY - r; y <= baseY; y++) for (let x = cx - r; x <= cx + r; x++) {
            const dx = x - cx, dy = y - baseY;
            if (dx * dx + dy * dy > r * r || y > groundAt(g, x)) continue;              // where the ground rises, it is drifted over
            dot(ctx, x, y, domePixel(x, y, dx, dy, r, baseY, cx, plantTop, M));
        }
        for (let x = cx - r - 1; x <= cx + r + 1; x++) {                                 // the ring it sits on
            if (baseY <= groundAt(g, x)) dot(ctx, x, baseY, M[4]);
            if (baseY + 1 <= groundAt(g, x)) dot(ctx, x, baseY + 1, M[2]);
        }
        const ax = Math.round(cx - dir * (r + 2));                                     // the airlock, facing the lander
        for (let y = baseY - 6; y <= baseY; y++) for (let k = 0; k < 6; k++) {
            const x = ax - dir * k, isDoor = k >= 3 && k <= 4 && y > baseY - 5;
            if (y <= groundAt(g, x)) dot(ctx, x, y, isDoor ? '#06070a' : y === baseY - 6 ? M[5] : k === 5 ? M[4] : M[3]);
        }
        site.live.dome = { cx, baseY, r };
        site.goalX = ax - dir * 7;
    }

    function domePixel(x, y, dx, dy, r, baseY, cx, plantTop, M) {
        const ny = dy / r, ring = r * Math.sqrt(Math.max(0, 1 - ny * ny));
        const isMeridian = [-0.866, -0.5, 0, 0.5, 0.866].some(s => Math.abs(dx - ring * s) < 0.55);
        const isParallel = [0.38, 0.71, 0.92].some(s => Math.abs(-dy - r * s) < 0.55);
        if (dx * dx + dy * dy > (r - 1) * (r - 1) || isMeridian || isParallel) return dx < 0 ? M[5] : M[4]; // the frame
        const isTrunk = Math.abs(dx) < 1 && y > baseY - 10, crown = Math.hypot(dx, y - (baseY - 12));
        let inside = '#0b1612';
        if (crown < 4.5) inside = crown < 2 && dx < 0 ? '#8fd08a' : dith(x, y, 0.6) ? '#4f9a5a' : '#2f6a3e';
        else if (isTrunk) inside = '#3a2d20';
        else if (y >= plantTop(x)) inside = y === plantTop(x) ? '#8fd08a' : dith(x, y, 0.55) ? '#2f6a3e' : '#1f4a2a';
        const isSheen = dx < -r * 0.15 && dy < -r * 0.35 && dx > -r * 0.75;
        return isSheen && dith(x, y, 0.35) ? '#9fd8e0' : inside;
    }

    function drawDomeLive(ctx, g, site, now) {                                        // the light slides over the glass
        const d = site.live.dome;
        if (!d) return;
        const t = (now % 6000) / 6000, a = Math.PI * (1 - t), x = Math.round(d.cx + Math.cos(a) * (d.r - 0.5)), y = Math.round(d.baseY - Math.sin(a) * (d.r - 0.5));
        if (t < 0.8) { dot(ctx, x, y, GLINT); dot(ctx, x + 1, y, '#9fd8e0'); }
    }

    // ── a beacon still transmitting: a lattice mast on guy wires, a hut at its foot, a light that pulses ──
    function paintBeacon(ctx, g, rand, site, look) {
        const { dir, near } = site, M = look.metal, mx = Math.round(near + dir * 17), gy = Math.round(groundAt(g, mx)), tall = 44, top = gy - tall;
        [[0.35, 17], [0.62, 11]].forEach(([h, reach]) => [-1, 1].forEach(side => {   // guy wires, behind everything
            const ay = top + Math.round(tall * h), bx = mx + side * reach, by = Math.round(groundAt(g, bx)) - 1;
            for (let s = 0; s <= 1; s += 0.035) if (Math.round(s * 30) % 2 === 0) dot(ctx, mx + (bx - mx) * s, ay + (by - ay) * s, M[3]);
            dot(ctx, bx, by, M[4]);
        }));
        for (let k = 0; k < tall; k++) {
            const half = Math.round(3 - (k / tall) * 2), y = gy - k;
            dot(ctx, mx - half, y, M[5]); dot(ctx, mx + half, y, M[3]);
            if (half > 0 && k % 5 < 3) { const s = (k % 5) / 2; dot(ctx, mx - half + Math.round(s * half * 2), y, M[4]); dot(ctx, mx + half - Math.round(s * half * 2), y, M[3]); }
        }
        for (let c = -1; c <= 1; c++) dot(ctx, mx + c, top - 1, M[2]);
        const hx = Math.round(near + dir * 2);                                         // the hut, its door toward the lander
        for (let y = gy - 6; y <= gy; y++) for (let k = 0; k < 10; k++) {
            const x = hx + dir * k, isDoor = (k === 1 || k === 2) && y > gy - 5, isVent = k > 5 && k < 9 && (y === gy - 4 || y === gy - 2);
            dot(ctx, x, y, isDoor ? '#06070a' : y === gy - 6 ? M[5] : isVent ? M[1] : k === 0 ? M[4] : M[3]);
        }
        for (let k = -2; k <= 12; k++) heap(ctx, g, look, hx + dir * k, gy - 1 + (k < 0 || k > 9 ? 1 : 0) + (Math.sin(k) > 0.6 ? -1 : 0), dir * k < 0);
        site.live.beacon = { x: mx, y: top - 2 };
        site.goalX = hx - dir * 2;
    }

    function drawBeaconLive(ctx, g, site, now) {
        const b = site.live.beacon;
        if (!b) return;
        const t = (now % 1800) / 1800, isFlash = t < 0.09;
        dot(ctx, b.x, b.y, isFlash ? '#fff2c0' : t < 0.5 ? AMBER : AMBER_DIM);
        if (isFlash) { dot(ctx, b.x - 1, b.y, AMBER); dot(ctx, b.x + 1, b.y, AMBER); dot(ctx, b.x, b.y - 1, AMBER); }
        [0, 0.33].forEach(lag => {                                                       // the signal going out, as rings
            const p = t - lag;
            if (p <= 0 || p > 0.6) return;
            const rad = 3 + (p / 0.6) * 30, fade = 1 - p / 0.6;
            for (let a = Math.PI * 1.05; a < Math.PI * 1.95; a += 1.2 / rad) {
                const x = Math.round(b.x + Math.cos(a) * rad), y = Math.round(b.y + Math.sin(a) * rad * 0.8);
                if (isOn(x, y) && dith(x, y, fade * 0.8)) put(ctx, x, y, AMBER_DIM);
            }
        });
    }

    const PAINTERS = { wreck: paintWreck, ruins: paintRuins, stones: paintGraves, dome: paintDome, beacon: paintBeacon };
    const LIVE = { wreck: drawWreckLive, ruins: drawRuinsLive, stones: drawGlint, dome: drawDomeLive, beacon: drawBeaconLive };

    /** Paint g.site (from place) once into the backdrop. soil: the ground's own tones, so the drift matches the terrain. */
    function paint(ctx, g, ramp, rand, soil) {
        const site = g.site, painter = site && PAINTERS[site.kind];
        if (!painter) return;
        const look = {
            metal: METAL.map(c => css(mix(c, ramp[3], 0.14))), dust: css(ramp[3]), soilHex: '#' + ramp[3].map(c => Math.round(c).toString(16).padStart(2, '0')).join(''),
            soil: { edge: css(ramp[3]), lit: css(ramp[4]), upper: css(soil.upper), mid: css(soil.mid) }, stand: new Float32Array(W).fill(Infinity),
        };
        painter(ctx, g, rand, site, look);
        site.standY = look.stand;                                                   // where the soil the site piled up is the ground to walk on
    }

    function drawLive(ctx, g, now) {
        const live = g.site && LIVE[g.site.kind];
        if (live) live(ctx, g, g.site, now);
    }

    window.LanderSites = { place, paint, drawLive, SIZE };
})();
