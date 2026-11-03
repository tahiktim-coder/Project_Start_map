/* ═══ Silent Exodus · new screen (?new=1) · land/LandSite.js: THE METEOR in the game (PR #32) ═══
   Part of LandGround.js (the copy of prototypes/landing-meteor/landing-ground.js: its header has the GAME: marks), split
   off it: our wreck as the sketch draws it (the Exodus hull, tilted, snapped in two, the nose in a mound, the mast and
   its red beacon), laid into LanderSites.paint for this landing's scenes only (S.dummyWreck).
   The split (2026-11-03, the house's 800-line limit): the code moved as it was; nothing in it changed but the names that cross.
   It loads after LandGround.js (window.LandingGroundParts) and before LandGroundDraw.js.
*/
(function () {
    'use strict';
    const Z = window.LandingGroundParts;
    if (!Z) return;                                                          // (LandGround.js did not start: LandFall.js stays out)
    const { P, RP, ramp, INK, clampX, H, U, clamp01, SITES, W } = Z;

    // ── our wreck, as SceneArt's wreck at dusk: the Exodus hull (round nose, raised bridge, engine block, fins), tilted,
    //    snapped in two, the nose ploughed into a mound of this world's soil, a mast on the bridge carrying its red beacon ──
    function hullEdges(u) {                                                // SceneArt.js hullEdges, copied
        if (u < 0 || u > 1) return null;
        const nose = u < 0.12 ? Math.sqrt(u / 0.12) : 1;
        let top = -0.5 * (0.35 + 0.65 * nose), bottom = 0.5 * (0.35 + 0.65 * nose);
        if (u > 0.14 && u < 0.36) top -= 0.2 * Math.min(1, (u - 0.14) / 0.04, (0.36 - u) / 0.05);
        if (u > 0.74 && u < 0.8) { top += 0.08; bottom -= 0.08; }
        if (u >= 0.8) { top -= 0.06; bottom += 0.06; }
        if (u > 0.86) { const fin = (u - 0.86) / 0.14; top -= 0.3 * fin; bottom += 0.3 * fin; }
        return [top, bottom];
    }
    /** SceneArt.js drawHull, copied onto an NSPaint painter: o { x, y, len, ht, angle, flip, ramp, light, holes, rust, seed, from, to, anchor }. */
    function exodusHull(p, o) {
        const { len, ht } = o, c = Math.cos(o.angle || 0), s = Math.sin(o.angle || 0), dir = o.flip ? -1 : 1, seed = o.seed || 1;
        const from = o.from || 0, to = o.to == null ? 1 : o.to, anchor = o.anchor == null ? (from + to) / 2 : o.anchor, dim = o.light == null ? 1 : o.light;
        const at = (u, v) => { const along = (u - anchor) * len * dir, across = v * ht; return [o.x + along * c - across * s, o.y + along * s + across * c]; };
        const reach = len * Math.max(anchor - from, to - anchor) + ht, cx0 = o.clip ? o.clip[0] : -Infinity, cx1 = o.clip ? o.clip[1] : Infinity;
        const band = ht * 0.95 + Math.abs(s) * reach;                          // the rows it can reach at this angle (it lies nearly flat)
        p.region(Math.max(cx0, o.x - reach), o.y - band, Math.min(cx1, o.x + reach), o.y + band, (x, y) => {
            const dx = x + 0.5 - o.x, dy = y + 0.5 - o.y, u = anchor + (dx * c + dy * s) * dir / len, v = (-dx * s + dy * c) / ht;
            const jag = (P.vnoise(v * 6, u * 4, seed) - 0.5) * 0.07;
            if ((from > 0 && u < from + jag) || (to < 1 && u > to + jag)) return;
            const e = hullEdges(u); if (!e || v < e[0] || v > e[1]) return;
            const mid = (e[0] + e[1]) / 2, half = (e[1] - e[0]) / 2, n = (v - mid) / half, px = u * len;
            let light = 0.7 - 0.42 * n;
            if ((v - e[0]) * ht < 1.4) light += 0.22;                                           // a bright rim along the top
            if (u > 0.8) light -= 0.14;                                                         // the engine block is darker metal
            if (px % (len / 17) < 1 || Math.abs((v - mid) * ht - half * ht * 0.35) < 0.5) light -= 0.2;   // hull plates
            if (u > 0.17 && u < 0.33 && (v - e[0]) * ht > ht * 0.05 && (v - e[0]) * ht < ht * 0.11 && px % (len / 50) > len / 140) light = 0.12;   // bridge windows, dark
            if (u > 0.985) light = 0.18;
            if (o.rust) light -= (P.fbm(px / (len / 28), v * ht / (ht / 7), seed, 3) - 0.45) * 0.5;
            if (o.holes && P.fbm(px / (len / 16), v * ht / (ht / 4), seed + 3, 3) > o.holes) light = px % (len / 40) < len / 200 ? 0.3 : 0.05;   // torn open: the frame shows through
            if ((from > 0 && u < from + jag + 0.02) || (to < 1 && u > to + jag - 0.02)) light *= 0.45;   // scorched break
            p.tone(x, y, o.ramp || RP.HULL, light * dim);
        });
        return at;
    }
    const WRECK_RAMP = ramp(INK, '#141a1d', '#2c3538', '#4f5a5c', '#7b8584', '#a9b1ab');   // our hull, weathered (SceneArt's HULL, a step duller)
    function paintWreck(p, V2, S, g, rand, site) {
        const { dir, near, length } = site, L = Math.max(56, length - 4), ht = L * 0.2, d = V2.d, flip = dir > 0;
        const mean = x => { let sum = 0; for (let k = -3; k <= 3; k++) sum += Math.min(g.heights[clampX(Math.round(x + k))], H - 2); return sum / 7; };
        const xBreak = near + dir * L * 0.46, xTail = near + dir * 3, xNose = near + dir * (L - 3);
        const yB = mean(xBreak) - ht * 0.22, yT = mean(xTail) - ht * 0.3, yN = mean(xNose) - ht * 0.05;
        const slope = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]);
        const L2 = [Math.min(xTail, xBreak), 0], R2 = [Math.max(xTail, xBreak), 0];
        L2[1] = L2[0] === xTail ? yT : yB; R2[1] = R2[0] === xTail ? yT : yB;
        const tilt = a => Math.max(-0.1, Math.min(0.1, a));                    // it lies along the ground, never stood up on a hill: a hill buries it instead
        const angAft = tilt(slope(L2, R2)), lf = [Math.min(xBreak, xNose), 0], rf = [Math.max(xBreak, xNose), 0];
        lf[1] = lf[0] === xBreak ? yB : yN; rf[1] = rf[0] === xBreak ? yB : yN;
        const angFore = tilt(slope(lf, rf)) + 0.07 * dir;                     // the fore piece dips its nose into the ground
        const box = Math.ceil((L + ht) * d) + 16, q = P.painter(box * 2, box * 2, false), ox = Math.round((xBreak - V2.ox) * d) - box, oy = Math.round((yB - V2.oy) * d) - box;
        const clip = [Math.max(0, -ox - 2), Math.min(q.W, p.W - ox + 2)];        // only the part this column of the picture shows
        const base = { len: L * d, ht: ht * d, flip, ramp: WRECK_RAMP, rust: true, holes: 0.74, seed: 30 + Math.floor(rand() * 40), light: 1, clip };
        exodusHull(q, Object.assign({}, base, { x: box - dir * 1.2 * d, y: box + 0.6 * d, angle: angAft, from: 0.55, anchor: 0.54 }));
        const fore = exodusHull(q, Object.assign({}, base, { x: box + dir * 1.4 * d, y: box, angle: angFore, to: 0.52, anchor: 0.53 }));
        const bury = wx => (Math.abs(wx - xNose) < 9 ? 1.6 : 0.5);
        const yb = Math.ceil(ht * d * 1.1 + 0.2 * L * d);
        for (let y = Math.max(0, box - yb); y < Math.min(q.H, box + yb); y++) for (let x = clip[0]; x < clip[1]; x++) {   // half buried: only what is above the ground
            const i = (y * q.W + x) * 4; if (!q.data[i + 3]) continue;
            const ax = ox + x, ay = oy + y; if (ax < 0 || ay < 0 || ax >= p.W || ay >= p.H) continue;
            const wx = V2.ox + (ax + 0.5) / d, wy = V2.oy + (ay + 0.5) / d;
            if (wy > U.hAt(g, wx) + bury(wx)) continue;
            p.set(ax, ay, [q.data[i], q.data[i + 1], q.data[i + 2]]);
        }
        const world = (axy) => [V2.ox + (ox + axy[0]) / d, V2.oy + (oy + axy[1]) / d];
        // the mound it ploughed up over its nose, the soil the team would walk on
        const hm = ht * 0.42;
        U.region(p, V2, xNose - 12, 0, xNose + 12, H, (wx, wy, ax, ay) => {
            const k = Math.max(0, 1 - Math.abs(wx - (xNose + dir * 2)) / 11), top = U.hAt(g, wx) - hm * Math.pow(k, 1.4) * (0.85 + 0.3 * P.vnoise(wx / 2, 3, 7));
            if (k <= 0 || wy < top || wy > U.hAt(g, wx) + 0.5) return;
            const dd = wy - top, lit = clamp01(0.5 + (wx - xNose) * S.Ls * 0.05);
            p.solid(ax, ay, S.GRD, dd * d < 1.05 ? 0.42 + 0.2 * lit : 0.1 + Math.exp(-dd / 4) * 0.24 + (P.fbm(wx / 3, wy / 2, 21, 2) - 0.5) * 0.16);
            const col = clampX(Math.floor(wx)); site.stand[col] = Math.min(site.stand[col], top);
        });
        for (let k = 0; k < 6; k++) {                                          // plates torn off at the break, lying in the dirt
            const x = xBreak + dir * (rand() * 10 - 5), w = 1 + rand() * 2.5, top = U.hAt(g, x);
            U.region(p, V2, x, top - 1, x + w, top + 0.2, (wx, wy, ax, ay) => p.solid(ax, ay, WRECK_RAMP, (wy - (top - 1)) * d < 1 ? 0.62 : 0.32));
        }
        const [mbx, mby] = world(fore(0.27, -0.66)), mast = 6.5;              // the mast on the bridge, its beacon at the top
        U.stroke(p, V2, mbx, mby, mbx + dir * 0.6, mby - mast, 0.5, (ax, ay) => { if (ax >= 0 && ay >= 0 && ax < p.W && ay < p.H) p.solid(ax, ay, WRECK_RAMP, 0.55); });
        site.live.transponder = { x: mbx + dir * 0.6, y: mby - mast - 0.6 };
        site.goalX = Math.round(xBreak - dir * 2);                            // to the break: the way in
    }
    if (SITES && SITES.paint && !SITES.dummyWreck) {                           // this dummy's own wreck, for its scenes only (S.dummyWreck)
        const basePaint = SITES.paint;
        SITES.paint = function (p, V2, S, g, rand) {
            const site = g.site;
            if (site && site.kind === 'wreck' && S && S.dummyWreck) { site.live = {}; site.stand = new Float32Array(W).fill(Infinity); paintWreck(p, V2, S, g, rand, site); site.standY = site.stand; return; }
            return basePaint.apply(this, arguments);
        };
        SITES.dummyWreck = true;
    }
})();
