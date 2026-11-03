/* ═══ Silent Exodus · new screen (?new=1) · land/LandSite.js: THE METEOR in the game (PR #32) ═══
   Part of LandGround.js (the copy of prototypes/landing-meteor/landing-ground.js: its header has the GAME: marks), split
   off it: our wreck as the sketch draws it (the Exodus hull, tilted, snapped in two, the nose in a mound, the mast and
   its red beacon), laid into LanderSites.paint for this landing's scenes only (S.dummyWreck).
   The split (2026-11-03, the house's 800-line limit): the code moved as it was; nothing in it changed but the names that cross.
   It loads after LandGround.js (window.LandingGroundParts) and before LandGroundDraw.js.
   GAME (the final check, 2026-11-03): and where the shuttle may stand: the columns the site's art covers (siteSpan), where
   a touchdown comes to rest, clear of that art and on both pads (restAt), a pad of soil under the feet where nothing near
   will do (padUnder). LandingGround carries them (LandGroundDraw.js); LandFallFlight.js asks.
*/
(function () {
    'use strict';
    const Z = window.LandingGroundParts;
    if (!Z) return;                                                          // (LandGround.js did not start: LandFall.js stays out)
    const { P, RP, ramp, INK, clampX, H, U, clamp01, SITES, W, A } = Z;

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
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // GAME (the final check, 2026-11-03): where the shuttle may stand. The site's art (a hut and its mast on guy wires, a
    // wreck, a dome, graves, ruins) is measured once a place (siteSpan: the columns it covers, painted on a blank picture);
    // the shuttle comes to rest clear of it and on both pads (restAt: on the ground as it is drawn, each pad within
    // REST_TOL of it, nothing between the legs reaching up to the bell); where no such place is near, a pad of this
    // world's soil is laid under the feet (padUnder: the ground under the footprint raised to its highest point, its sides
    // sloping off, the field's picture painted with it, as LanderSites heaps soil against what came down).
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    const LGM = window.LanderGame, HALF = LGM.internals.LANDER_HALF, TALL = LGM.LANDER_TALL, PAD = A.SH.PAD;
    const REST_TOL = 0.75, PAD_HALF = 1, BELLY = 1.5, CLEAR = PAD + PAD_HALF + 1, SPAN_D = 2, SPAN_TOP = -24, CLIMB = 1, SLOPE = 1, SLOPE_MAX = 40, REST_STEP = 0.5;
    const DARK = [0.2, 0.21, 0.26];                                                // the night copy's six multiplies (LandGround.js paintView), at the ground
    /** The columns (world x) the site's art covers, [x0, x1] (1 px of margin each side), or null: LanderSites (or our wreck,
        above) painted on a blank picture SPAN_D px a world px, every column with a painted pixel. The site's own state (its
        live lights, where the team stands) is the field's, kept as it was. */
    function siteSpan(G) {
        if (G.siteSpan !== undefined) return G.siteSpan;
        G.siteSpan = null;
        const g = G.g, site = g.site;
        if (!G.siteKind || !site || !SITES || !SITES.paint) return null;
        const V2 = U.view(SPAN_D, 0, SPAN_TOP, W * SPAN_D, Math.round((H + 3 - SPAN_TOP) * SPAN_D)), p = G.S.N.painter(V2.w, V2.h, false);
        const keep = { live: site.live, stand: site.stand, standY: site.standY, goalX: site.goalX };
        try { SITES.paint(p, V2, G.S, g, U.seeded(G.planet.id + ':site')); } catch (err) { console.error('Landing: the site could not be measured', err); } finally { Object.assign(site, keep); }
        let a = Infinity, b = -Infinity;
        for (let x = 0; x < p.W; x++) for (let y = 0; y < p.H; y++) if (p.data[(y * p.W + x) * 4 + 3]) { a = Math.min(a, x / SPAN_D); b = Math.max(b, (x + 1) / SPAN_D); break; }
        if (a <= b) G.siteSpan = [Math.floor(a) - 1, Math.ceil(b) + 1];
        return G.siteSpan;
    }
    const clearOf = (span, x) => !span || x + CLEAR < span[0] || x - CLEAR > span[1];
    /** The highest point (least y) of the drawn ground over world x a..b: U.hAt runs straight between the columns' middles
        (x + 0.5), so it is at one of them or at an end (a spike's tip is never stepped over). */
    function topOver(g, a, b) {
        let t = Math.min(U.hAt(g, a), U.hAt(g, b));
        for (let c = Math.ceil(a - 0.5); c + 0.5 <= b; c++) t = Math.min(t, U.hAt(g, c + 0.5));
        return t;
    }
    /** The stance at x on the drawn ground: the feet's y (the higher pad's ground), how far the other pad hangs over its
        ground, how far the ground between the legs rises over the feet, and whether it is ground at all (no pool, no sky). */
    function stanceAt(g, x) {
        const l = topOver(g, x - PAD - PAD_HALF, x - PAD + PAD_HALF), r = topOver(g, x + PAD - PAD_HALF, x + PAD + PAD_HALF);
        const mid = topOver(g, x - PAD + PAD_HALF, x + PAD - PAD_HALF), feet = Math.min(l, r);
        let solid = feet <= H;
        for (let c = Math.floor(x - PAD - PAD_HALF); c <= Math.ceil(x + PAD + PAD_HALF) && solid; c++) if (g.hot[clampX(c)] || g.heights[clampX(c)] > H) solid = false;
        return { feet, hang: Math.max(l, r) - feet, belly: feet - mid, top: Math.min(feet, mid), solid };
    }
    /** How much soil a pad at x would take (world px²): the ground under the footprint raised to its highest point. */
    function fillCost(g, x, top) { let sum = 0; for (let wx = x - PAD - PAD_HALF; wx <= x + PAD + PAD_HALF + 1e-6; wx += 0.5) sum += (U.hAt(g, wx) - top) * 0.5; return sum; }
    /** Where the shuttle that touched down at x0 (its feet at top0, the physics' ground) comes to rest: { x, y (its top),
        pad: { x, level } | null }. Off the site's art first (the nearest clear place, however far: it hops there); then
        within reach the nearest place it stands on both pads (never up onto higher ground); else the one within reach that
        takes the least soil, a pad laid under it. */
    function restAt(G, x0, top0, reach) {
        const span = siteSpan(G), onSite = !clearOf(span, x0);
        return restNear(G, x0, top0, reach, span, onSite) || (onSite ? null : restNear(G, x0, top0, reach, span, true));   // nothing near (a pool's edge): the nearest place further off
    }
    /** restAt's search: outward from x0, every REST_STEP px; far: from the first place that may be stood on, reach px more
        (else reach px from x0, never climbing). */
    function restNear(G, x0, top0, reach, span, far) {
        const g = G.g, lo = HALF + 1, hi = W - HALF - 2;
        let dClear = far ? null : 0, best = null;
        for (let k = 0; k <= W; k += REST_STEP) {
            if (dClear != null && k > dClear + reach) break;
            for (const x of k ? [x0 - k, x0 + k] : [x0]) {
                if (x < lo || x > hi || !clearOf(span, x)) continue;
                const st = stanceAt(g, x);
                if (!st.solid || (!far && st.top < top0 - CLIMB)) continue;
                if (dClear == null) dClear = k;
                if (st.hang <= REST_TOL && st.belly <= BELLY) return { x, y: st.feet - TALL, pad: null };
                const top = topOver(g, x - PAD - PAD_HALF - 1, x + PAD + PAD_HALF + 1), cost = fillCost(g, x, top) + (k - dClear) * 0.6;   // (a pad as high as a spike just beside it: drawn, it leans in over the pad's edge)
                if (!best || cost < best.cost) best = { x, cost, top };
            }
        }
        return best ? { x: best.x, y: best.top - TALL, pad: { x: best.x, level: best.top } } : null;
    }
    /** A pad of this world's soil under the feet at pad.x: the ground over the footprint raised to pad.level, its sides
        sloping off at SLOPE; the ground the crew walk on (g.heights, and the drawn ground g.vis) and the field's picture
        (G.main: lit, and its night copy) take it. */
    function padUnder(G, pad) {
        const g = G.g, S = G.S, a = pad.x - PAD - PAD_HALF - 0.5, b = pad.x + PAD + PAD_HALF + 0.5, L = pad.level;
        const vis = g.vis && g.vis !== g.heights ? g.vis : null, before = { heights: Float32Array.from(g.heights), vis: vis ? Float32Array.from(vis) : null, hot: g.hot };   // (U.hAt reads vis, else heights)
        let deepest = L, cMin = Math.floor(a), cMax = Math.ceil(b);
        const raise = c => {                                                      // → whether column c was below the pad's slope
            if (c < 0 || c >= W || g.hot[c]) return false;
            const top = L + SLOPE * Math.max(0, a - (c + 0.5), (c + 0.5) - b);
            let low = false;
            if (g.heights[c] > top && g.heights[c] <= H) { deepest = Math.max(deepest, g.heights[c]); g.heights[c] = top; low = true; }
            if (vis && vis[c] > top && vis[c] <= H) { deepest = Math.max(deepest, vis[c]); vis[c] = top; low = true; }
            if (low) { cMin = Math.min(cMin, c); cMax = Math.max(cMax, c); }
            return low;
        };
        for (let c = Math.floor(a); c <= Math.ceil(b); c++) raise(c);
        [-1, 1].forEach(side => { for (let k = 1, c = side < 0 ? Math.floor(a) - 1 : Math.ceil(b) + 1; k <= SLOPE_MAX && raise(c); k++, c += side); });   // its sides slope off until they meet the ground
        const pic = G.main, Vx = pic && pic.V;
        if (!Vx || !pic.lit) return;
        const d = Vx.d, ax0 = Math.max(0, Math.floor(((cMin - 1 - Vx.ox) * d) / 8) * 8), ax1 = Math.min(Vx.w, Math.ceil((cMax + 2 - Vx.ox) * d));
        const ay0 = Math.max(0, Math.floor(((L - 1 - Vx.oy) * d) / 8) * 8), ay1 = Math.min(Vx.h, Math.ceil((deepest + 1 - Vx.oy) * d));
        if (ax1 <= ax0 || ay1 <= ay0) return;
        const p = S.N.painter(ax1 - ax0, ay1 - ay0, false);
        for (let ay = ay0; ay < ay1; ay++) for (let ax = ax0; ax < ax1; ax++) {
            const wx = Vx.ox + (ax + 0.5) / d, wy = Vx.oy + (ay + 0.5) / d, t = U.hAt(g, wx), was = U.hAt(before, wx);
            if (wy < t || wy > was + 0.5) continue;
            const slope = U.hAt(g, wx + 0.6) - U.hAt(g, wx - 0.6), lit = clamp01(0.5 + slope * S.Ls * 0.6), dd = wy - t, sunK = S.sunK ? S.sunK(wx) : 1;   // LanderSites' soil
            if (dd * d < 1.05) p.solid(ax - ax0, ay - ay0, S.GRD, (0.5 + 0.34 * lit) * (0.82 + 0.18 * sunK));
            else p.solid(ax - ax0, ay - ay0, S.GRD, 0.1 + Math.exp(-dd / 5) * (0.26 + 0.36 * lit * sunK) + (S.N.fbm(wx / 4, wy / 2, S.seed + 21, 2) - 0.5) * 0.18);
        }
        pic.lit.getContext('2d').drawImage(p.canvas(), ax0, ay0);
        if (pic.dark) {
            for (let i = 0; i < p.data.length; i += 4) if (p.data[i + 3]) { p.data[i] *= DARK[0]; p.data[i + 1] *= DARK[1]; p.data[i + 2] *= DARK[2]; }
            pic.dark.getContext('2d').drawImage(p.canvas(), ax0, ay0);
        }
    }
    Object.assign(Z, { siteSpan, restAt, padUnder });                          // (for LandGroundDraw.js: LandingGround)
})();
