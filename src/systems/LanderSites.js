/* LanderSites — the place the away team is going, drawn beside A.U.R.A.'s marked spot in the landing game, in the travel
   view's look (2026-10-11): one of our ships crashed (wreck), an empty colony (ruins), graves (stones), a garden under
   glass (dome), a beacon.
   Nothing here grew out of the planet. Every site is made of what the Exodus ships carried: our own hull (the Lander's
   shape, painted by the travel view's recipe MiniPaint.hull), the same shuttle, the same helmets. So it reads as people
   like us, half buried in this world's own soil. The only warm lights are theirs: an emergency lamp, a transponder, a beacon.
   A wreck is drawn the way its story (ExodusDerelicts.js) finds it: whole, broken in two and torn open, burned, or only
   a crater around the flight recorder; the story id comes in as `detail`.
   place(g, kind, detail) picks the side of the mark with room, clear of other level ground (LanderScene calls it first,
   so rocks keep off). paint(p, V, S, g, rand) paints it into a backdrop for view V (LanderScene.backdrop: the main picture
   and again, sharper, for the close-up), in world coordinates per art pixel. drawLive(ctx, g, now, V, S) adds what moves:
   the transponder, the lamp in a torn hull, the beacon's pulse, the glint on the dome, a torn flag. g.site.goalX is where
   the team walks to; g.site.standY is the soil it piled up (per world column), which they walk on. */

(function () {
    'use strict';
    if (!window.LanderScene || !window.LanderScene.util) return;
    const U = window.LanderScene.util, { W, H, region, hAt, toAX, toAY, clampX, clamp01, lump, buriedHull } = U;
    const GAP = 9, CLEAR = 4, SPILL = 0.3;                                               // px from the mark; px kept off other level ground; share allowed off-screen
    const SIZE = { wreck: [86, 40], ruins: [74, 22], stones: [46, 22], dome: [44, 34], beacon: [36, 24] }; // [wanted, least] footprint, px

    const groundAt = (g, x) => g.heights[clampX(Math.round(x))];
    function meanGround(g, x) { let sum = 0; for (let k = -3; k <= 3; k++) sum += Math.min(groundAt(g, x + k), H - 2); return sum / 7; }

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

    // ── shared pieces: this world's soil heaped against what came down ──
    /** Soil from top(wx) down to the ground between world x0 and x1: drift against a wall, the berm a crash pushed up. It is the ground the team walks on. */
    function soil(p, V, S, g, site, x0, x1, top) {
        const lo = Math.min(x0, x1), hi = Math.max(x0, x1);
        for (let c = Math.floor(lo); c <= Math.ceil(hi); c++) { const t = top(c + 0.5); if (c >= 0 && c < W && !g.hot[c] && t < g.heights[c]) site.stand[c] = Math.min(site.stand[c], t); }
        region(p, V, lo, 0, hi, H, (wx, wy, ax, ay) => {
            const t = top(wx), ground = hAt(g, wx);
            if (wy < t || wy > ground + 0.5 || g.hot[clampX(Math.floor(wx))]) return;
            const slope = top(wx + 0.6) - top(wx - 0.6), lit = clamp01(0.5 + slope * S.Ls * 0.6), d = wy - t;
            const sunK = S.sunK ? S.sunK(wx) : 1;                                         // lit like the ground round it (LanderScene.paintGround)
            if (d * V.d < 1.05) p.solid(ax, ay, S.GRD, (0.5 + 0.34 * lit) * (0.82 + 0.18 * sunK));
            else p.solid(ax, ay, S.GRD, 0.1 + Math.exp(-d / 5) * (0.26 + 0.36 * lit * sunK) + (S.N.fbm(wx / 4, wy / 2, S.seed + 21, 2) - 0.5) * 0.18);
        });
    }
    /** A flat piece of something: a world rectangle shaded with a lit top edge and a lit side toward the sun. */
    function slab(p, V, S, x0, y0, w, h, ramp, base) {
        region(p, V, x0, y0, x0 + w, y0 + h, (wx, wy, ax, ay) => {
            const top = (wy - y0) * V.d < 1, side = (wx - x0) / w;
            p.solid(ax, ay, ramp, base + (top ? 0.24 : 0) + ((S.Ls > 0 ? side > 0.7 : side < 0.3) ? 0.1 : 0) - (wy > y0 + h - 0.8 ? 0.08 : 0));
        });
    }
    const line = (p, V, x0, y0, x1, y1, w, paint) => U.stroke(p, V, x0, y0, x1, y1, w, (ax, ay, t) => { if (ax >= 0 && ay >= 0 && ax < p.W && ay < p.H) paint(ax, ay, t); });

    // ── one of ours: the Lander's hull lying on its side, as its story says it was found ──
    const WRECK_LOOKS = {
        EXODUS_DEAD_CREW: { form: 'whole', windows: 'dark' }, EXODUS_INFECTED: { form: 'whole', windows: 'mould' },
        EXODUS_CRYO: { form: 'whole', windows: 'cryo' }, EXODUS_PARTIAL: { form: 'whole', windows: 'warm', hasFence: true },
        EXODUS_CACHE: { form: 'broken', windows: 'dark' }, EXODUS_BURNED: { form: 'burned', windows: 'none' }, EXODUS_LOG: { form: 'crater' },
    };
    const lookOfWreck = detail => WRECK_LOOKS[detail] || { form: 'broken', windows: 'dark' };      // story not known yet: broken in two
    const WRECK_SIZE = { whole: [76, 44], broken: [86, 40], burned: [76, 44], crater: [48, 30] };
    const WINDOW_INK = { mould: '#cfe0c8', cryo: '#7fd3a0', warm: '#f7c483' };
    const NOSE = 0.215, SKIRT = 0.86, DECK_U = i => NOSE + i * (SKIRT - NOSE) / 6;

    function paintWreck(p, V, S, g, rand, site) {
        const wl = lookOfWreck(site.detail);
        if (wl.form === 'crater') { paintCrater(p, V, S, g, rand, site); return; }
        const { dir, near, length } = site, RP = S.K.RP, isBroken = wl.form === 'broken' && length >= 64, isBurned = wl.form === 'burned';
        const fenceLen = wl.hasFence && length >= 70 ? 22 : 0, L = length - fenceLen, R = L * 0.31 / 2, lift = R * 0.62;
        const ya = meanGround(g, near + dir * 3) - lift - R * 0.15, yb = meanGround(g, near + dir * (L - 3)) - lift;
        const slope = Math.max(-0.3, Math.min(0.3, (yb - ya) / L)), axisY = x => ya + (x - near) * dir * slope;
        const look = isBurned ? { ramp: RP.RUST, light: 0.55, rust: 1, holes: 0.6 } : isBroken ? { ramp: RP.RUST, light: 1.05, rust: 1 } : { ramp: RP.DUSK, light: 0.62 };
        const seed = 30 + Math.floor(rand() * 50), angle = Math.atan(slope) * dir, flip = dir < 0;
        const bermTop = (from, to, extra) => wx => { const k = (wx - near) * dir, out = k < from ? from - k : k > to ? k - to : 0; return axisY(wx) + R * 0.5 - (extra ? extra(k) : 0) + out * 1.2 + (Math.sin(k * 1.7) > 0.7 ? 0.6 : 0); };
        const nose = k => (k < 4 ? R * 0.45 * Math.max(0, 1 - Math.abs(k + 1) / 6) : 0);                    // the nose ploughed a mound
        let fore;
        if (isBroken) {
            const foreLen = L * 0.54, gap = L * 0.12, aftX = near + dir * (foreLen + gap), ac = axisY(aftX) + R * 0.12;
            fore = buriedHull(p, V, S, g, { x: near, y: ya, anchor: 0, len: L, angle, flip, to: 0.54, seed, ...look });
            buriedHull(p, V, S, g, { x: aftX, y: ac, anchor: 0.66, len: L, angle: angle - dir * 0.06, flip, from: 0.66, seed: seed + 1, ...look });
            soil(p, V, S, g, site, near - dir * 5, near + dir * (foreLen + 4), bermTop(0, foreLen, nose));
            soil(p, V, S, g, site, aftX - dir * 3, near + dir * (L + 4), bermTop(foreLen + gap, L));
            scatterDebris(p, V, S, g, rand, near + dir * foreLen, dir, gap, fore(0.52, -0.1));
            const lamp = fore(0.5, -0.08); site.live.lamp = { x: lamp[0], y: lamp[1] };
        } else {
            fore = buriedHull(p, V, S, g, { x: near, y: ya, anchor: 0, len: L, angle, flip, seed, ...look });
            soil(p, V, S, g, site, near - dir * 5, near + dir * (L + 4), bermTop(0, L, nose));
            if (wl.windows !== 'none' && wl.windows !== 'dark') site.live.windows = [1, 2, 3, 4, 5].map(i => ({ at: fore(DECK_U(i) + 0.054, -0.32), on: wl.windows === 'cryo' ? i >= 2 && i <= 4 : i % 2 === 1, ink: WINDOW_INK[wl.windows] }));
        }
        if (fenceLen) paintFence(p, V, S, g, near + dir * (L + 4), dir, fenceLen - 4);
        const [mx, my] = fore(0.3, -0.5);                                                                 // the transponder: the one thing every wreck still has
        line(p, V, mx, my, mx, my - 3, 0.5, (ax, ay) => p.solid(ax, ay, RP.HULL, 0.5));
        site.live.transponder = { x: mx, y: my - 3 };
        site.goalX = Math.round(fore(isBurned ? 0.35 : 0.24, 0)[0]);                                      // to the hatch (a burned hull has none left)
    }

    /** Hull plates in the gap and around, one driven into the ground on a slant, a cable sagging from the torn end. */
    function scatterDebris(p, V, S, g, rand, from, dir, gap, cableTop) {
        const HULL = S.K.RP.WRUST;
        for (let k = 0; k < 8; k++) {
            const x = from + dir * (rand() * (gap + 8) - 4), w = 1 + rand() * 2.5;
            slab(p, V, S, x, groundAt(g, x) - 1.2, w, 1.2, HULL, 0.32);
        }
        const sx = from + dir * (gap * 0.5 + 1), sy = groundAt(g, sx);
        line(p, V, sx, sy, sx + dir * 2.5, sy - 5, 1.1, (ax, ay, t) => p.solid(ax, ay, HULL, 0.3 + t * 0.35));
        const ex = from + dir * Math.max(4, gap * 0.7), ey = groundAt(g, ex) - 1;
        for (let t = 0; t <= 1; t += 0.02) {
            const x = cableTop[0] + (ex - cableTop[0]) * t, y = Math.min(groundAt(g, x) - 0.5, cableTop[1] + (ey - cableTop[1]) * t + Math.sin(t * Math.PI) * 3);
            region(p, V, x, y, x + 0.45, y + 0.45, (wx, wy, ax, ay) => p.solid(ax, ay, S.K.RP.HULL, 0.22));
        }
    }

    /** The crew that landed safely tried to stay: a fence of hull struts with a wire sagging between them. */
    function paintFence(p, V, S, g, from, dir, len) {
        const posts = [];
        for (let k = 0; k <= len; k += 6) posts.push({ x: from + dir * k, y: groundAt(g, from + dir * k) });
        posts.forEach((q, i) => {
            line(p, V, q.x, q.y, q.x, q.y - 6, 0.7, (ax, ay, t) => p.solid(ax, ay, S.K.RP.HULL, 0.32 + (t > 0.9 ? 0.3 : 0)));
            const next = posts[i + 1];
            if (next) for (let s = 0.04; s < 1; s += 0.04) { const x = q.x + (next.x - q.x) * s, y = q.y - 4 + (next.y - q.y) * s + Math.sin(s * Math.PI) * 1.2; region(p, V, x, y, x + 0.4, y + 0.4, (wx, wy, ax, ay) => p.solid(ax, ay, S.K.RP.HULL, 0.28)); }
        });
    }

    /** Only a crater: the ground scorched and fused glassy, twisted bits of hull, and the armoured flight recorder, still pinging. */
    function paintCrater(p, V, S, g, rand, site) {
        const { dir, near, length } = site, RP = S.K.RP, mid = near + dir * length / 2;
        region(p, V, Math.min(near, near + dir * length) - 4, 60, Math.max(near, near + dir * length) + 4, H, (wx, wy, ax, ay) => {
            const top = hAt(g, wx), d = wy - top; if (d < 0 || d > 8 || g.hot[clampX(Math.floor(wx))]) return;
            const heat = Math.max(0, 1 - Math.abs(wx - mid) / (length / 2 + 4));
            if (heat > 0.25 && d < 2) p.solid(ax, ay, S.K.DEAD, (S.N.hash(Math.floor(wx * 2), Math.floor(wy * 2), 3) > 0.86 ? 0.95 : 0.25));       // charred black, fused to glass that glints
            else if (S.N.threshold(ax, ay) < heat * (0.9 - d * 0.11)) p.solid(ax, ay, S.K.DEAD, 0.12);
        });
        for (let k = 0; k < 9; k++) { const x = near + dir * (4 + rand() * (length - 8)), w = 1 + rand() * 2; slab(p, V, S, x, groundAt(g, x) - 1.2, w, 1.2, RP.WRUST, 0.34); }
        const rx = near + dir * length * 0.45, ry = groundAt(g, rx);
        soil(p, V, S, g, site, rx - 4, rx + 4, wx => ry - 0.5 + Math.abs(wx - rx) * 0.35);
        region(p, V, rx - 2.5, ry - 3.5, rx + 2.5, ry - 0.5, (wx, wy, ax, ay) => {                       // the recorder: orange, banded
            const band = Math.floor((wx - rx + 2.5) * 1.2) % 3 === 1;
            p.solid(ax, ay, RP.AMBER, (wy < ry - 3 ? 0.75 : 0.55) + (band ? -0.2 : 0) + ((wx - rx) * S.Ls > 1.5 ? 0.1 : 0));
        });
        site.live.transponder = { x: rx, y: ry - 5 };
        site.goalX = Math.round(rx - dir * 4);
    }

    // ── an empty colony: hab modules from the same ships, one fallen in, a shuttle like ours under the drift ──
    /** An upright hab module: a squat drum with a domed roof, lit from the sun's side. The door faces the lander. A fallen one has lost its roof. */
    function hab(p, V, S, g, site, cx, dir, w, wall, o) {
        const half = w / 2, base = meanGround(g, cx), capH = half * 0.7, HULL = S.K.RP.HULL;
        soil(p, V, S, g, site, cx - half - 3, cx + half + 3, wx => { const out = Math.max(0, Math.abs(wx - cx) - half); return base + 1 + out * 0.9 - ((wx - cx) * dir > 0 && out < 1 ? 1.6 : 0); });
        region(p, V, cx - half, base - wall - capH - 1, cx + half, base + 1, (wx, wy, ax, ay) => {
            const dx = (wx - cx) / half, side = dx * dir; if (Math.abs(dx) > 1 || wy > hAt(g, wx) + 0.5) return;
            const broken = o.isCollapsed ? 1.4 * Math.abs(Math.sin(wx * 2.3)) : 0, top = o.isCollapsed ? base - wall + broken : base - wall - capH * Math.sqrt(Math.max(0, 1 - dx * dx));
            if (wy < top || wy > base) return;
            const isRoof = wy < base - wall, lit = clamp01(0.5 + dx * S.Ls * 0.6);
            let v = (isRoof ? 0.3 : 0.22) + 0.4 * lit - (wy > base - 1 ? 0.12 : 0) - (Math.abs(wy - (base - wall)) < 0.5 / V.d + 0.3 ? 0.15 : 0);
            if (o.hasDoor && side > -0.78 && side < -0.3 && wy > base - 5) v = Math.abs(wy - (base - 5)) < 0.6 ? 0.6 : 0;                    // the door, open on the dark
            else if (side > 0.2 && side < 0.6 && Math.abs(wy - (base - wall + 2)) < 0.5) v = 0.02;                                          // a window slit
            else if (o.isCollapsed && wy < top + 1.2) v = wy < top + 0.5 ? 0.62 : 0.05;                                                    // the torn rim, and the dark inside
            p.solid(ax, ay, HULL, v * (o.dim || 1));
        });
        return { doorX: Math.round(cx - dir * half * 0.55) };
    }
    function solarPanel(p, V, S, g, x) {
        const gy = groundAt(g, x);
        line(p, V, x, gy, x, gy - 4, 0.6, (ax, ay) => p.solid(ax, ay, S.K.RP.HULL, 0.3));
        region(p, V, x - 4.5, gy - 8.5, x + 4.5, gy - 4, (wx, wy, ax, ay) => {
            const tilt = (wx - x) * 0.3, r = wy - (gy - 8 + tilt); if (r < 0 || r > 3) return;
            if (wx > x + 2.5 && r < 1) return;                                                               // a corner broken off
            const isFrame = r < 0.5 || Math.abs(((wx - x + 4.5) % 3) - 1.5) > 1.25;
            p.solid(ax, ay, isFrame ? S.K.RP.HULL : S.K.PANEL, isFrame ? 0.45 : 0.25 + (r < 1 ? 0.25 : 0));
        });
    }
    function mast(p, V, S, g, x, site) {
        const gy = groundAt(g, x), tall = 20, lean = 0.16, tx = x + tall * lean, ty = gy - tall;
        line(p, V, x, gy, tx, ty, 0.7, (ax, ay, t) => p.solid(ax, ay, S.K.RP.HULL, 0.32 + (Math.floor(t * 20) % 6 === 0 ? 0.2 : 0)));
        line(p, V, tx - 2, ty + 2, tx + 2, ty + 2, 0.5, (ax, ay) => p.solid(ax, ay, S.K.RP.HULL, 0.4));
        soil(p, V, S, g, site, x - 2.5, x + 2.5, wx => gy - 1.5 + Math.abs(wx - x) * 0.7);
        site.live.flag = { x: tx, y: ty + 4 };
    }
    /** A shuttle exactly like ours, sunk in drift up to its middle, leaning, the window dark, dusted with this world's soil. */
    function buriedShuttle(p, V, S, g, site, x) {
        const gy = meanGround(g, x), drift = wx => gy - 4 + Math.abs(wx - x) * 0.4;
        buriedHull(p, V, S, g, { x, y: gy - 3, anchor: 0.62, len: 14, angle: Math.PI / 2 - 0.35, ramp: S.K.RP.DUSK, light: 0.85, rust: 1, seed: 7, dirt: drift });
        soil(p, V, S, g, site, x - 9, x + 9, drift);
    }
    function paintRuins(p, V, S, g, rand, site) {
        const { dir, near, length } = site, at = offset => near + dir * offset;
        if (length >= 66) buriedShuttle(p, V, S, g, site, at(60));
        if (length >= 50) mast(p, V, S, g, at(47), site);
        if (length >= 42) hab(p, V, S, g, site, at(35), dir, 11, 5, { isCollapsed: true, dim: 0.85 });
        if (length >= 28) solarPanel(p, V, S, g, at(22));
        site.goalX = hab(p, V, S, g, site, at(8), dir, 13, 6, { hasDoor: true }).doorX;                // the team walks to the open door
    }

    // ── graves: low mounds, markers cut from hull plate, one helmet left on a marker ──
    function marker(p, V, S, x, gy, style, lean, isBack) {
        const HULL = S.K.RP.STONE, base = isBack ? 0.18 : 0.32;
        if (style === 0) {                                                                                  // a plate cut from hull metal, a name scratched across it
            const tall = isBack ? 3.4 : 4.6, wide = isBack ? 2.6 : 3.4;
            region(p, V, x - wide / 2, gy - tall, x + wide / 2, gy, (wx, wy, ax, ay) => {
                const r = gy - wy, isCorner = r > tall - 0.7 && Math.abs(wx - x) > wide / 2 - 0.6, isName = !isBack && Math.abs(r - tall * 0.55) < 0.35 && Math.abs(wx - x) < wide / 2 - 0.8;
                if (isCorner) return;
                p.solid(ax, ay, HULL, isName ? base - 0.14 : base + (r > tall - 0.6 ? 0.25 : 0) + ((wx - x) * S.Ls > wide / 4 ? 0.12 : 0));
            });
        } else if (style === 1) {                                                                           // a strut with a small plate on top
            line(p, V, x, gy, x + lean, gy - (isBack ? 5 : 7), 0.7, (ax, ay) => p.solid(ax, ay, HULL, base));
            slab(p, V, S, x + lean - 1.5, gy - (isBack ? 5.5 : 7.5), 3, 1.4, HULL, base);
        } else [[0, 3], [1, 2.2], [2, 1.4]].forEach(([r, w]) => lump(p, V, S, { heights: [] , hot: [] }, x, gy - 0.7 - r * 1.1, w / 2 + 0.3, 0.7, S.K.RP.STONE, 0.9, false));
    }
    function paintGraves(p, V, S, g, rand, site) {
        const { dir, near, length } = site, step = 8, count = Math.max(3, Math.min(5, Math.floor((length - 2) / step)));
        for (let k = 0; k < count - 1; k++) {                                                               // the row behind: smaller and dimmer, between the front ones
            const x = near + dir * (6 + k * step), gy = groundAt(g, x) - 1;
            soil(p, V, S, g, site, x - 2.5, x + 2.5, wx => gy - 0.8 + Math.abs(wx - x) * 0.35);
            marker(p, V, S, x, gy - 0.6, rand() < 0.5 ? 0 : 1, 0, true);
        }
        let helmetAt = null;
        for (let k = 0; k < count; k++) {                                                                   // the front row: a mound each, a plate cut from hull metal
            const x = near + dir * (2 + k * step), gy = groundAt(g, x);
            soil(p, V, S, g, site, x - 4, x + 4, wx => gy - 2 * Math.max(0, 1 - ((wx - x) / 4) ** 2) + 0.2);
            const style = k % 3 === 2 ? 1 : 0, lean = k > 0 && rand() < 0.3 ? -dir : 0;
            marker(p, V, S, x, gy - 1.6, style, lean, false);
            if (k === 0) helmetAt = { x, y: gy - 8.2 };
        }
        if (helmetAt) helmet(p, V, S, helmetAt.x, helmetAt.y, -dir, site);
        site.goalX = Math.round(near - dir * 2);
    }
    /** One of our EVA helmets, set on top of a marker, the visor toward the lander. */
    function helmet(p, V, S, x, y, face, site) {
        lump(p, V, S, { heights: [], hot: [] }, x, y, 1.8, 1.6, S.K.mk('#2a2e30', '#5a6064', '#9aa2a4', '#d8dedc', '#f4f6f2'), 1.15, false);
        region(p, V, x - 1.8, y - 0.8, x + 1.8, y + 0.6, (wx, wy, ax, ay) => { if ((wx - x) * face > 0.1 && (wx - x) * face < 1.7) p.solid(ax, ay, S.K.GLASS, 0.22); });
        site.live.glint = { x: x + face * 1.1, y: y - 0.4 };
    }

    // ── a garden under glass: a framed dome, green inside, an airlock toward the lander ──
    function paintDome(p, V, S, g, rand, site) {
        const { dir, near, length } = site, r = Math.max(13, Math.min(16, Math.floor((length - 9) / 2)));
        const cx = near + dir * (8 + r), baseY = meanGround(g, cx) - 1, HULL = S.K.RP.HULL;
        soil(p, V, S, g, site, cx - r - 4, cx + r + 4, wx => baseY + 2 + Math.max(0, Math.abs(wx - cx) - r) * 0.8);
        region(p, V, cx - r, baseY - r, cx + r, baseY + 1, (wx, wy, ax, ay) => {
            const dx = wx - cx, dy = wy - baseY; if (dx * dx + dy * dy > r * r || wy > hAt(g, wx)) return;
            const ring = r * Math.sqrt(Math.max(0, 1 - (dy / r) ** 2)), lw = 0.45;
            const isFrame = dx * dx + dy * dy > (r - 0.9) ** 2 || [-0.866, -0.5, 0, 0.5, 0.866].some(s => Math.abs(dx - ring * s) < lw) || [0.38, 0.71, 0.92].some(s => Math.abs(-dy - r * s) < lw);
            if (isFrame) { p.solid(ax, ay, HULL, 0.4 + (dx * S.Ls > 0 ? 0.25 : 0)); return; }
            const crown = Math.hypot(dx, wy - (baseY - 12)), plantTop = baseY - 3 - 3 * Math.abs(Math.sin(wx * 0.7 + 1)) - 2 * Math.abs(Math.sin(wx * 0.23));
            let v = -1, R = S.K.GREEN;
            if (crown < 4.5) v = 0.45 + (dx * S.Ls > 0 && crown < 3 ? 0.3 : 0) + (S.N.fbm(wx, wy, 5, 2) - 0.5) * 0.3;
            else if (Math.abs(dx) < 0.8 && wy > baseY - 10) { v = 0.3; R = S.K.mk('#1a120a', '#3a2814', '#5a4024'); }
            else if (wy >= plantTop) v = (wy - plantTop) * V.d < 1 ? 0.75 : 0.32 + (S.N.fbm(wx / 2, wy, 6, 2) - 0.5) * 0.3;
            const isSheen = dx * S.Ls > r * 0.15 && dy < -r * 0.4 && dx * S.Ls < r * 0.7 && S.N.threshold(ax, ay) < 0.22;
            if (isSheen) p.solid(ax, ay, S.K.GLASS, 0.5); else if (v >= 0) p.solid(ax, ay, R, v); else p.solid(ax, ay, S.K.GLASS, 0.1);
        });
        region(p, V, cx - r - 1, baseY, cx + r + 1, baseY + 1.5, (wx, wy, ax, ay) => { if (wy <= hAt(g, wx)) p.solid(ax, ay, HULL, wy < baseY + 0.6 ? 0.55 : 0.25); });   // the ring it sits on
        const axL = cx - dir * (r + 2);                                                                      // the airlock, facing the lander
        region(p, V, Math.min(axL, axL - dir * 6), baseY - 6, Math.max(axL, axL - dir * 6), baseY, (wx, wy, ax, ay) => {
            if (wy > hAt(g, wx)) return;
            const k = (axL - wx) * dir, isDoor = k >= 3 && k <= 4.6 && wy > baseY - 5;
            p.solid(ax, ay, HULL, isDoor ? 0 : wy < baseY - 5.4 ? 0.62 : 0.3 + ((wx - axL) * S.Ls > 0 ? 0.1 : 0));
        });
        site.live.dome = { cx, baseY, r };
        site.goalX = Math.round(axL - dir * 7);
    }

    // ── a beacon still transmitting: a lattice mast on guy wires, a hut at its foot, a light that pulses ──
    function paintBeacon(p, V, S, g, rand, site) {
        const { dir, near } = site, HULL = S.K.RP.HULL, mx = near + dir * 17, gy = groundAt(g, mx), tall = 44, top = gy - tall;
        [[0.35, 17], [0.62, 11]].forEach(([h, reach]) => [-1, 1].forEach(side => {                         // guy wires, behind everything
            const ay = top + tall * h, bx = mx + side * reach, by = groundAt(g, bx) - 0.5;
            line(p, V, mx, ay, bx, by, 0.35, (px, py, t) => { if (Math.floor(t * 40) % 2 === 0) p.solid(px, py, HULL, 0.24); });
        }));
        region(p, V, mx - 3.2, top, mx + 3.2, gy, (wx, wy, ax, ay) => {                                    // the lattice, tapering
            const k = gy - wy, half = 3 - (k / tall) * 2, dx = wx - mx, rail = Math.abs(Math.abs(dx) - half) < 0.35;
            const s = ((k % 5) + 5) % 5 / 5, brace = k % 5 < 3.5 && Math.abs(dx - (-half + s * 2 * half * 1.4)) < 0.35 && Math.abs(dx) < half;
            if (rail || brace) p.solid(ax, ay, HULL, 0.32 + (dx * S.Ls > 0 ? 0.22 : 0));
        });
        const hx = near + dir * 2;                                                                           // the hut, its door toward the lander
        region(p, V, Math.min(hx, hx + dir * 10), gy - 6, Math.max(hx, hx + dir * 10), gy, (wx, wy, ax, ay) => {
            const k = (wx - hx) * dir, isDoor = k > 0.8 && k < 2.8 && wy > gy - 5, isVent = k > 5.5 && k < 9 && (Math.abs(wy - (gy - 4)) < 0.35 || Math.abs(wy - (gy - 2)) < 0.35);
            p.solid(ax, ay, HULL, isDoor ? 0 : wy < gy - 5.5 ? 0.62 : isVent ? 0.1 : 0.28 + ((wx - hx - dir * 5) * S.Ls > 3 ? 0.12 : 0));
        });
        soil(p, V, S, g, site, hx - dir * 2, hx + dir * 12, wx => { const k = (wx - hx) * dir; return gy - 0.6 + (k < 0 || k > 10 ? Math.min(k < 0 ? -k : k - 10, 2) * 0.6 : 0); });
        site.live.beacon = { x: mx, y: top - 1.5 };
        site.goalX = Math.round(hx - dir * 2);
    }

    const PAINTERS = { wreck: paintWreck, ruins: paintRuins, stones: paintGraves, dome: paintDome, beacon: paintBeacon };

    /** Paint g.site (from place) into the backdrop painter p for view V. S: the scene's look (LanderScene: colours, the sun's side). */
    function paint(p, V, S, g, rand) {
        const site = g.site, painter = site && PAINTERS[site.kind];
        if (!painter) return;
        site.live = {}; site.stand = new Float32Array(W).fill(Infinity);
        painter(p, V, S, g, rand, site);
        site.standY = site.stand;                                                                            // where the soil the site piled up is the ground to walk on
    }

    // ── what moves: small, slow, the only warm lights in the picture ──
    function drawLive(ctx, g, now, V, S) {
        const site = g.site, live = site && site.live;
        if (!live || !S) return;
        const N = S.N, K = S.K, f = N.framer(ctx, V.w, V.h), u = Math.max(1, Math.round(V.d / 2.25)), ax = x => toAX(V, x), ay = y => toAY(V, y);
        if (live.transponder) { const on = now % 1800 < 260; f.px(ax(live.transponder.x) - u / 2, ay(live.transponder.y), on ? '#fff3dc' : K.WARM_DIM, u, u); if (on) f.glow(ax(live.transponder.x), ay(live.transponder.y), 3 * u, K.RP.AMBER, 0.5); }
        if (live.lamp) {                                                                                     // the emergency lamp in the torn hull, breathing, now and then a stutter
            const isStutter = Math.floor(now / 90) % 41 === 0, breath = isStutter ? 0.1 : 0.55 + 0.15 * Math.sin(now / 1100);
            f.glow(ax(live.lamp.x), ay(live.lamp.y), Math.round(4.5 * V.d), K.RP.AMBER, breath);
            f.px(ax(live.lamp.x), ay(live.lamp.y), isStutter ? K.WARM_DIM : '#fff3dc', u, u);
        }
        (live.windows || []).forEach(w => { if (w.on) f.px(ax(w.at[0]) - u / 2, ay(w.at[1]) - u / 2, w.ink, u + 1, u + 1); });
        if (live.flag) {                                                                                     // a torn strip on the mast, in whatever wind there is
            const blow = Math.sign(g.wind), frame = Math.floor(now / 200) % 2;
            for (let k = 0; k < 4; k++) { const x = blow ? live.flag.x + blow * (k + 1) : live.flag.x + 1, y = blow ? live.flag.y + ((k + frame) % 2) * 0.6 : live.flag.y + k; f.tone(ax(x), ay(y), K.RP.WRUST, k < 2 ? 0.7 : 0.5, Math.ceil(V.d), Math.ceil(V.d * 0.7)); }
        }
        if (live.glint && Math.floor(now / 160) % 14 < 2) f.px(ax(live.glint.x), ay(live.glint.y), '#f2fbff', u, u);
        if (live.dome) {                                                                                     // the light slides over the glass
            const d = live.dome, t = (now % 6000) / 6000, a = Math.PI * (1 - t);
            if (t < 0.8) { f.px(ax(d.cx + Math.cos(a) * (d.r - 0.5)), ay(d.baseY - Math.sin(a) * (d.r - 0.5)), '#f2fbff', u, u); f.px(ax(d.cx + Math.cos(a) * (d.r - 0.5)) + u, ay(d.baseY - Math.sin(a) * (d.r - 0.5)), '#9fd8e0', u, u); }
        }
        if (live.beacon) {
            const b = live.beacon, t = (now % 1800) / 1800, isFlash = t < 0.09;
            f.glow(ax(b.x), ay(b.y), Math.round((isFlash ? 4 : 2) * V.d), K.RP.AMBER, isFlash ? 0.95 : t < 0.5 ? 0.55 : 0.25);
            [0, 0.33].forEach(lag => {                                                                       // the signal going out, as rings
                const q = t - lag; if (q <= 0 || q > 0.6) return;
                const rad = 3 + (q / 0.6) * 30, fade = 1 - q / 0.6;
                for (let a = Math.PI * 1.05; a < Math.PI * 1.95; a += 0.8 / (rad * V.d)) f.tone(ax(b.x + Math.cos(a) * rad), ay(b.y + Math.sin(a) * rad * 0.8), K.RP.AMBER, 0.42 * fade);
            });
        }
    }

    window.LanderSites = { place, paint, drawLive, SIZE };
})();
