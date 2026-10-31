/* ═══ Silent Exodus · new screen (?new=1) · dock/DockRelay.js: Last Port, the dark moon's relay ══════════════════════════
   "Last Port" (prototypes/ideas/last-port, approved 2026-10-31): on the way to the disc's wreck in sector 5 (the story
   planet with page PAGE_DISC, Iapetus-60 Minor) the ship docks at the old relay on its moon, flown (App.flyRelay:
   MiniHost.play('dock-flight', { kind: 'dock', relay: true, ... })), between three of our own dead ships clamped to its
   ring. As our clamps close their windows light one by one and the relay's screen says SENT. The flight, the ring face
   and the film cut are Bring Her In's own files (DockFlight.js, DockFace.js, DockExterior.js), each change there behind
   opts.relay; this file only supplies what is new. Loaded only when the new-screen switch is on (index.html), before
   dock/DockFace.js; needs NSPaint, NSWorlds and STORY_PLANETS at load (all three load earlier).
     - the run: sector 5's sky (SECTORS[5], the corridor's), half of its debris, the relay's lamp ahead, pulsing slowly like
       a beacon and growing all the way (Mira's map line: "Its lamp is still on"); the dark moon low on the left, growing
       as we come. Rushing in is the danger: the throttle held over the last seconds of the run brings us to the ring
       nearer and faster (near, startSpeed), a slope, not a cliff: the longer it is held, the likelier a hard dock
     - the moon: the story planet itself (STORY_PLANETS, found by its page), painted by the game's own NSWorlds.paint
       (src/newscreen/art/Worlds.js, BodyRenderer's colours, its darkest steps taken down) into a field of ramp tones, lit
       from behind (a thin lit rim), then laid into the sky every frame with the flight's own 8 x 8 grain, so it turns with
       the sky as the glass rolls; the film cut turns the sky so it sits low on the right
     - the three hulls of our class clamped to the ring, nose in like us, numbered in the 17,000s (the story wreck, 17,207,
       the far one): through the glass in perspective, crooked in their old clamps; named by the radio once each is big
       enough to see, one after another; from outside (DockExterior.js, relay) the game's own Lander sprite, dark and
       rusted, in a row beside our port
     - the lines (DRAFT), the chips (no air: nobody walks a station here; the disc is not named before it is found)
   window.DockRelay (frozen)
     dock        the numbers the flight takes instead of Bring Her In's (DOCK), and the relay's own (near, rushT, tags)
     lines, who  the new lines and who says them
     hulls       [{ num, at }]: hull number, its port's angle from the free port (degrees, clockwise on the glass)
     exterior    what DockExterior.create takes: the dead ports (rad from ours), the hull numbers, which one a hard dock
                 tears loose (never the story wreck), SENT
     arrival(k)  the start of the docking for k (0..1, the throttle held lately): { dist, speed }
     lamp(k, t)  the lamp far off at k (0..1 of the run) and t s: { rad, tick }
     prepare(D)  a new docking: the names start again; the moon painted once (about 0.1 s; the start screen)
     sky(A)      the moon, into the frame (after the stars, before the station)
     glass(A, G) the three hulls through the glass; returns their name tags (with places to try, in units)
     covers(D, box)  whether this frame's hulls are in a box on the glass (units)
     cutFrame(A) what the film cut needs from the flight this frame: { moon: [x, y, r] in art px }
     chips(o), energyDelta(o), debug()
   Every new line of words is marked DRAFT for the designer to rewrite (docs/STYLE.md).
   ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────── */
(function () {
    'use strict';
    const P = window.NSPaint, Wd = window.NSWorlds;
    if (!P || !Wd) { console.error('DockRelay: NSPaint and NSWorlds must load first'); return; }
    const clamp = (v, a, b) => (v < a ? a : v > b ? b : v), clamp01 = v => clamp(v, 0, 1), lerp = (a, b, k) => a + (b - a) * k;
    const RAD = Math.PI / 180;
    const story = (window.STORY_PLANETS || []).find(p => p.page === 'PAGE_DISC') || { sector: 5, type: 'CRYSTALLINE', hull: 17207, name: 'Iapetus-60 Minor' };   // the disc's moon

    // ── the run and the docking (Bring Her In's DOCK, these keys replaced). Sector 5's sky; the run a little longer; its
    //    debris half of sector 5's jump (SECTORS[5].debris 56: three clusters of eight and four between = 28), aimed a little
    //    less than Bring Her In's plates; no mast and no drifting hulls (the three on the ring are the hulls here). The
    //    ring turns slower (an old relay: spin, °/s). Rushing in: the throttle held lately (a mean over rushT s, from the
    //    jump to the end of the run) brings the station nearer at the run's end (near, m: 80 for a careful pilot, 38 for one
    //    who held it all the way; over the last nearLock course seconds it only ever comes nearer) and the docking starts
    //    that much faster (startSpeed, m/s: DockingGame's 3 up to its top speed, 8). Let go at once and it can still dock
    //    soft, with less time to line up; keep holding a second and a half and it strikes (the rules are DockingGame's:
    //    braking at its THRUST, 1.2 m/s²). bakeMs: the film cut's three cameras, ms a frame on the start screen and after it.
    //    The film cut: the sky turns cutTurn rad/s behind the station and starts at cutRoll (the
    //    moon low on the right). hullsSayAt: metres out when Aris speaks of the hulls (their names are on the glass by then);
    //    tagFrom/tagTo: the metres the names may show between; tagMinPx: a hull at least this many art px across before its
    //    name shows; tagStep: s between one name and the next. lampR: the lamp's radius at the start and end of the run (art
    //    px), lampHz: its pulse (on, then off, each half of 1 / lampHz s).
    const SECTOR = story.sector || 5;
    const dock = Object.freeze({
        sector: SECTOR, dur: 26, aim: 0.24, aimAt: 24, perBreak: 2,
        clusters: [[0.24, 8], [0.5, 8], [0.76, 8]], clusterR: [2.4, 1.6], clusterT: 1.1, big: [0.24, 0.42], sprinkle: 4,
        mast: null, parked: [], spin: [14, 20], near: [80, 38], nearLock: 3, startSpeed: [3, 8], rushT: 0.9, bakeMs: [16, 7],
        cutTurn: 0.02, cutRoll: -1.74, hullsSayAt: 24, tagFrom: 40, tagTo: 0.4, tagMinPx: 16, tagStep: 0.8,
        lampR: [2.5, 8], lampHz: 0.6,
    });
    // ── DRAFT lines (2026-10-30 and 2026-10-31; the designer rewrites them; docs/STYLE.md). The rest are Bring Her In's.
    //    grade: A.U.R.A.'s words for the grade at the relay (after the cause), DockingGame's grade lines without their air
    //    sentence: nobody walks a station here; held: a hard dock that broke nothing
    const lines = Object.freeze({
        offer: n => `A relay on the dark moon, Commander. I can dock us for ${n} energy.`,  // DRAFT: on the start screen
        offerFree: 'A relay on the dark moon, Commander. I can dock us, if you prefer.',     // DRAFT (2026-10-31): the same with no energy left to charge
        hold: 'Relay ahead. Hold to close in. Let go to slow.',                              // DRAFT: as the run starts (every time: it teaches the rush)
        hulls: 'They docked here and never left.',                                           // DRAFT (Aris): the three hulls, named
        mira: 'It sent something. Back the way we came.',                                    // DRAFT (the idea's own line): after SENT
        grade: Object.freeze({ soft: 'The clamps take hold, Commander.', rough: 'We scraped the ring.', crash: 'The hull is damaged.', held: 'The hull held.' }),   // DRAFT (2026-10-31)
    });
    const who = Object.freeze({ hulls: ['Aris', 'MEDIC'], mira: ['Mira', 'SPECIALIST'] });
    // the three hulls: their numbers (the story planet's own, 17207, the far one: the team goes into it, so a hard dock
    // never tears it loose) and their ports' angles from the free port (degrees clockwise on the glass; outside, round the
    // ring, the same order, packed closer: exterior below)
    const NUMS = [17199, 17212, story.hull || 17207], AT = [-26, 26, 52];
    const hulls = Object.freeze(NUMS.map((num, k) => Object.freeze({ num, at: AT[k] })));
    const fmt = n => n.toLocaleString('en-US');

    /** The docking's start for k, the throttle held lately (0 none .. 1 all the way): how near and how fast. */
    function arrival(k) {
        const s = clamp01(k) * clamp01(k) * (3 - 2 * clamp01(k));
        return { dist: lerp(dock.near[0], dock.near[1], s), speed: lerp(dock.startSpeed[0], dock.startSpeed[1], s) };
    }
    /** The lamp far off: bigger as the run goes (k 0..1), on and off slowly (the face's own lamp takes a tick: on for two of four). */
    const lamp = (k, t) => ({ rad: lerp(dock.lampR[0], dock.lampR[1], clamp01(k)), tick: Math.floor(t * dock.lampHz * 4) });

    // ════════ the moon ════════
    // where it hangs in the sky (units from straight ahead, the corridor's sky units: about one stage pixel) and its radius
    // at the end of the run (grow: its size at the start, a share of that); low on the left, our Lander's corner on its
    // night side; lit from behind, above and to the right (a thin lit rim of ice facets on the limb that faces the relay);
    // its colours: the type's own (NSWorlds.palette: BodyRenderer's CRYSTALLINE), the two darkest steps taken down
    const MOON = { u: -170, v: 200, r: 200, grow: 0.74, L: [0.6, -0.5, -0.66], dim: 0.55, night: ['#08141a', '#0e2229'] };
    let field = null;                                   // { D, W, rid, val, ramps } once painted
    /** A painter (NSPaint.painter's shape) that keeps each pixel's ramp and tone instead of its colour, so the grain can be
        laid on screen later, per art pixel, whatever the sky's turn. */
    function capture(W, H) {
        const rid = new Uint8Array(W * H), val = new Float32Array(W * H), ramps = [null], ids = new Map();
        const idOf = r => { let k = ids.get(r); if (!k) { k = ramps.length; ramps.push(r); ids.set(r, k); } return k; };
        const store = (x, y, r, v) => { x = Math.floor(x); y = Math.floor(y); if (x < 0 || y < 0 || x >= W || y >= H) return; const i = y * W + x; rid[i] = idOf(r); val[i] = clamp01(v); };
        const tone = (x, y, r, v) => { if (v > 0.02) store(x, y, r, v); };
        const region = (x0, y0, x1, y1, fn) => { for (let y = Math.max(0, Math.floor(y0)); y < Math.min(H, Math.ceil(y1)); y++) for (let x = Math.max(0, Math.floor(x0)); x < Math.min(W, Math.ceil(x1)); x++) fn(x, y); };
        const ellipse = (cx, cy, rx, ry, fn) => region(cx - rx - 1, cy - ry - 1, cx + rx + 1, cy + ry + 1, (x, y) => { const q = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2; if (q < 1) fn(x, y, q); });
        const line = (x0, y0, x1, y1, fn) => { const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0))); for (let k = 0; k <= n; k++) fn(Math.round(x0 + (x1 - x0) * k / n), Math.round(y0 + (y1 - y0) * k / n), k / n); };
        return { W, H, rid, val, ramps, solid: store, tone, add: tone, over: tone, cover: (x, y, r, v, a) => { if (a > P.threshold(Math.floor(x) + 3, Math.floor(y) + 5)) tone(x, y, r, v); },
            region, ellipse, line, set: () => {}, clear: () => {}, get: () => [0, 0, 0, 0] };
    }
    /** A new docking: the names start again; the moon painted once (moonField). */
    function prepare(D) { tagRun = null; return moonField(D); }
    /** The moon, painted once at D art pixels a sky unit (one field cell an art pixel at its full size). */
    function moonField(D) {
        if (field && field.D === D) return field;
        const t0 = performance.now(), rc = Math.round(MOON.r * D), W = 2 * (rc + 6), p = capture(W, W);
        const base = Wd.palette(story.type).ramp.hex.slice(1), ramp = P.ramp(P.INK, MOON.night[0], MOON.night[1], ...base.slice(1, 5));
        Wd.paint(p, { cx: W / 2, cy: W / 2, r: rc, type: story.type, seed: story.hull || 17207, sector: SECTOR, L: P.norm3(...MOON.L), dim: MOON.dim, ramp });
        // each cell kept as the colour it takes below its dither's threshold (an index into one flat table, each ramp's top
        // step written twice so the step above is always there) and how far towards the next step it is (0..255)
        const at = [0], flat = [0];
        p.ramps.forEach((r, id) => { if (!r) return; at[id] = flat.length; r.rgb.forEach(([a, b, c]) => flat.push((0xff000000 | (c << 16) | (b << 8) | a) >>> 0)); flat.push(flat[flat.length - 1]); });
        const N = W * W, cell = new Uint16Array(N), frac = new Uint8Array(N);
        for (let k = 0; k < N; k++) {
            const id = p.rid[k];
            if (!id) continue;
            const n = p.ramps[id].rgb.length, pos = p.val[k] * (n - 1), lo = Math.min(n - 1, pos | 0);
            cell[k] = at[id] + lo; frac[k] = Math.min(255, Math.round((pos - lo) * 256));
        }
        field = { D, W, cell, frac, flat: Uint32Array.from(flat), ms: Math.round(performance.now() - t0) };
        return field;
    }
    let bay255 = null;                                  // the flight's 8 x 8 grain as 0..255 thresholds
    /** The moon into the frame: every art pixel inside its disc on screen looks up its cell through the sky's own turn
        (drawBackdrop's sums) and takes its ramp's step by the flight's 8 x 8 grain. Only the disc's own span of each row,
        and none of the span the station's face will cover (A.faceSpan). Over the stars and the haze; the station, the hulls
        and the debris come after. It grows as the run goes (A.grow(): 0 at the drop-out .. 1 at its end, and after). */
    let lastMoon = null;
    function sky(A) {
        const F = moonField(A.D), v = A.view, D = A.D, zm = v.zm, sc = lerp(MOON.grow, 1, clamp01(A.grow ? A.grow() : 1));
        const [mx, my] = A.sky(MOON.u, MOON.v), R = MOON.r * sc * zm * D;
        lastMoon = [mx, my, R];
        const cr = v.cr / zm / D, sr = v.sr / zm / D, ox = (A.CX + v.ox) * D, oy = (A.CY + v.oy) * D, half = F.W / 2, inv = 1 / sc;
        const y0 = Math.max(0, Math.floor(my - R)), y1 = Math.min(A.AH - 1, Math.ceil(my + R));
        const { buf, AW } = A, cell = F.cell, frac = F.frac, flat = F.flat, W = F.W, R2 = R * R;
        if (!bay255) bay255 = Uint8Array.from(A.BAY8, t => Math.min(255, Math.floor(t * 256)));
        const B = bay255, du = cr * inv * D, dw = -sr * inv * D;                              // a field cell's step per art px along a row
        for (let y = y0; y <= y1; y++) {
            const dyc = y + 0.5 - my, rest = R2 - dyc * dyc;
            if (rest <= 0) continue;
            const hw = Math.sqrt(rest) + 1, xa = Math.max(0, Math.floor(mx - hw)), xb = Math.min(AW - 1, Math.ceil(mx + hw));
            const span = A.faceSpan ? A.faceSpan(y) : null;
            const ey = y + 0.5 - oy, by = (y & 7) << 3, row = y * AW, ex0 = xa + 0.5 - ox;
            let fu = (ex0 * cr + ey * sr + v.lx - MOON.u) * inv * D + half, fw = (-ex0 * sr + ey * cr + v.ly - MOON.v) * inv * D + half;
            for (let x = xa; x <= xb; x++, fu += du, fw += dw) {
                if (span && x >= span[0] && x <= span[1]) { const n = span[1] - x; x += n; fu += du * n; fw += dw * n; continue; }   // (behind the face)
                const i = fu | 0, j = fw | 0;
                if (fu < 0 || fw < 0 || i >= W || j >= W) continue;
                const k = j * W + i, c = cell[k];
                if (c) buf[row + x] = flat[frac[k] > B[by | (x & 7)] ? c + 1 : c];
            }
        }
    }
    /** What the film cut needs from the flight this frame: where the moon is in the picture (art px), drawn already by sky(). */
    const cutFrame = () => ({ moon: lastMoon ? lastMoon.slice() : null });

    // ════════ the three hulls through the glass ════════
    // In the face's own space (DockFace.js: its radius faceA / (metres + faceB) art px, so a pinhole faceB metres behind
    // the hatch with the flight's focal length FA): each hull stands off the ring at its port, nose in, its tail towards
    // us; DIAM and LEN in those units (the port is about 3.3 across). Drawn far to near as the corridor draws the twin
    // (slices from the nose to the bell, at most maxSlices), each slice only where the nearer one does not cover it (its
    // outer band), so a hull close up costs a few thousand pixels, not millions. Our class, dead: our Lander's own pale
    // plating on the steel ramp (the travel view's HULL, as the sprite in the corner is painted), dimmed by about a third
    // and unlit inside, rust in a few ragged patches; a lit edge where the side turns away from us; a dark window on every
    // deck along the line that faces us; the skirt's underside and the bell's mouth in shadow, the bell's rim lit; the four
    // legs splayed off the skirt with their feet, as our Lander stands. Lit from the upper left, as the face is. Far off
    // (its bell under `tiny` art px), a dark notch by the lamp. A dark collar where its nose goes in. Dead, they hang
    // crooked in their old clamps (LEAN: degrees off straight, which way along the ring, as outside), so the glass sees
    // their sides, decks and windows, not only their tails; ours comes in straight.
    const G3 = { DIAM: 1.7, LEN: 1.7 * 3.15, NEAR: 0.7, minRd: 5, tiny: 2.4, maxSlices: 80, light: [-0.6, -0.8] };
    const TONE = { plate: [0.27, 0.44], deck: 0.025, seam: 0.74, rim: 0.82, shade: 0.1, window: 0.02, rust: 1.2, notch: 0.05 };
    const LEG = { from: 0.8, to: 1.62, foot: 0.22, w: 0.075 };
    const LEAN = [{ deg: 24, side: -1 }, { deg: 28, side: 1 }, { deg: 22, side: 1 }], LEAN_OUT = 0.45;
    const L_NOSE = 0.215, L_SKIRT = 0.86, L_BELL = 0.94;
    const deckU = i => L_NOSE + i * (L_SKIRT - L_NOSE) / 6;
    const hash = (a, b, s) => { let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(s | 0, 1274126177); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
    /** A ragged rust patch at lu along the hull and (ax, ay) round it (the hull's own turn taken out): big cells, a few
        rusted, their edges eaten by a finer grain, so stains and not bands. Round the hull as a diamond angle (0..4), cheap. */
    const isRustAt = (lu, ax, ay, k) => {
        const s = Math.abs(ax) + Math.abs(ay) || 1, d = ay >= 0 ? (ax >= 0 ? ay / s : 1 - ax / s) : (ax < 0 ? 2 - ay / s : 3 + ax / s);
        return hash(Math.floor(lu * 8 + d * 0.45), Math.floor(d * 3), 40 + k) < 0.2 && hash(Math.floor(lu * 46), Math.floor(d * 12.5), 90 + k) < 0.7;
    };
    let glassInfo = [], tagRun = null;                    // tagRun: this approach's names, when each first could show and does
    let stamp = null, stampN = 0, frameMark = 1, stampW = 0;   // which hull last painted each pixel (a hull is painted near to far, each pixel once); this frame's first
    /** Whether a box on the glass (units, [x0, y0, x1, y1]) has any of this frame's hulls in it (a name is best beside one, not on it). */
    function covers(D, b) {
        if (!stamp) return false;
        const AH = stamp.length / stampW, x0 = Math.max(0, Math.floor(b[0] * D)), x1 = Math.min(stampW - 1, Math.ceil(b[2] * D)), y0 = Math.max(0, Math.floor(b[1] * D)), y1 = Math.min(AH - 1, Math.ceil(b[3] * D));
        for (let y = y0; y <= y1; y += 2) for (let x = x0; x <= x1; x += 2) if (stamp[y * stampW + x] >= frameMark) return true;
        return false;
    }
    function glass(A, G) {
        glassInfo = []; frameMark = stampN + 1; stampW = A.AW;
        if (!G || G.dist > dock.tagFrom + 4) tagRun = null;
        if (!G || G.rd < G3.minRd) return [];
        if (!tagRun) tagRun = { showAt: [-1, -1, -1], last: -99 };
        const f = A.FA * A.view.zm, Zf = Math.max(0.5, G.dist) + A.faceB, tags = [], now = A.now ? A.now() : 0;
        hulls.forEach((h, k) => {
            const a = (G.phi + h.at) * RAD, px = G.hx + G.h * Math.sin(a), py = G.hy - G.h * Math.cos(a);
            const Lx = (px - G.mx) * Zf / f, Ly = (py - G.my) * Zf / f;
            // its lean: along the ring (the tangent at its port), a little outward, tan(deg) face units sideways per unit nearer
            const le = LEAN[k], wx = Math.cos(a) * le.side + Math.sin(a) * LEAN_OUT, wy = Math.sin(a) * le.side - Math.cos(a) * LEAN_OUT, tn = Math.tan(le.deg * RAD) / (Math.hypot(wx, wy) || 1);
            const info = drawHull(A, G, f, Zf, Lx, Ly, a, k, wx * tn, wy * tn);
            glassInfo.push(info);
            // its name goes by its tail while that is on the glass, else by its middle (close in, the tails pass out of it)
            const isOn = ([x, y]) => x >= 0 && x < A.AW && y >= 0 && y < A.AH, at = isOn(info.tail) ? info.at : isOn(info.mid) ? info.atMid : null;
            if (!info.drawn || !at || info.r * 2 < dock.tagMinPx || G.dist >= dock.tagFrom || G.dist <= dock.tagTo) return;
            if (tagRun.showAt[k] < 0) { tagRun.showAt[k] = Math.max(now, tagRun.last + dock.tagStep); tagRun.last = tagRun.showAt[k]; }
            if (now >= tagRun.showAt[k]) tags.push({ k, s: 'EXODUS-' + fmt(h.num), at, near: G.dist < 25 });
        });
        return tags;
    }
    function drawHull(A, G, f, Zf, Lx, Ly, roll, k, Tx, Ty) {
        const { buf, depth, AW, AH, R, level } = A, mx = G.mx, my = G.my, HR = R.HULL, RU = R.RUST;
        const proj = z => [mx + (Lx + Tx * (Zf - z)) * f / z, my + (Ly + Ty * (Zf - z)) * f / z, f / z];
        const [nx, ny, ns] = proj(Zf), zTail = Math.max(G3.NEAR, Zf - G3.LEN), [tx, ty] = proj(zTail);
        const n = clamp(Math.ceil(Math.hypot(tx - nx, ty - ny) * 1.3), 24, G3.maxSlices), faceK = Math.round(n * (1 - L_BELL));
        const isTiny = P.radiusL(L_BELL - 1e-3) * G3.DIAM * f / zTail < G3.tiny;
        const lx = G3.light[0], ly = G3.light[1];
        // the collar its nose sits in: a dark block round it on the ring, its upper left edge lit
        const cr = G3.DIAM * 0.72 * ns;
        if (!isTiny && nx + cr > 0 && nx - cr < AW && ny + cr > 0 && ny - cr < AH) {
            const co = Math.cos(roll), si = Math.sin(roll);
            for (let y = Math.max(0, Math.floor(ny - cr)); y <= Math.min(AH - 1, Math.ceil(ny + cr)); y++) for (let x = Math.max(0, Math.floor(nx - cr)); x <= Math.min(AW - 1, Math.ceil(nx + cr)); x++) {
                const dx = x + 0.5 - nx, dy = y + 0.5 - ny, q = Math.max(Math.abs(dx * co + dy * si), Math.abs(-dx * si + dy * co));
                if (q > cr) continue;
                const edge = q > cr - Math.max(1, cr * 0.12), lit = (dx * lx + dy * ly) > 0;
                buf[y * AW + x] = HR.c32[level(HR, edge ? (lit ? 0.62 : 0.08) : 0.16, x, y)];
            }
        }
        // the side that shows is the one the slices move away from as they near us (their drift on the glass: outward from
        // the middle, and the way it leans)
        const z0 = depth, rl = Math.hypot(tx - nx, ty - ny) || 1, rx = (tx - nx) / rl, ry = (ty - ny) / rl;
        const WIN = [0, 1, 2, 3, 4, 5].map(d => deckU(d) + 0.054), cR = Math.cos(-roll), sR = Math.sin(-roll);
        if (!stamp || stamp.length !== AW * AH) stamp = new Uint32Array(AW * AH);
        const st = stamp, mark = ++stampN;
        let prev = null, drawn = 0, tailPt = null, tailR = 0, midPt = null, midR = 0;
        const put = (x, y, r, v, z) => { const i = y * AW + x; buf[i] = r.c32[level(r, v, x, y)]; z0[i] = z; st[i] = mark; drawn++; };
        for (let i = 0; i <= n; i++) {                                                    // near (the bell) to far (the nose): each pixel shaded once, by the nearest slice
            const lu = 1 - i / n, z = Zf - lu * G3.LEN;
            if (z < G3.NEAR) continue;
            const s = f / z, cx = mx + (Lx + Tx * (Zf - z)) * s, cy = my + (Ly + Ty * (Zf - z)) * s, rad = P.radiusL(i === faceK ? L_BELL - 1e-3 : lu) * G3.DIAM * s;
            if (!tailPt) tailPt = [cx, cy];
            tailR = Math.max(tailR, rad);
            if (!midPt && lu <= 0.5) { midPt = [cx, cy]; midR = rad; }
            if (rad < 0.4 || cx + rad < 0 || cx - rad >= AW || cy + rad < 0 || cy - rad >= AH) { prev = { cx, cy, rad }; continue; }
            const full = !prev || i === faceK, band = full ? rad + 1 : Math.abs(cx - prev.cx) + Math.abs(cy - prev.cy) + Math.abs(rad - prev.rad) + 1.2;
            const inner = Math.max(0, rad - band), R2 = rad * rad, I2 = inner * inner, E2 = Math.max(0, rad - 1.3) ** 2, inv = 1 / (rad || 1);
            const seam = [0, 1, 2, 3, 4, 5, 6].some(d => Math.abs(lu - deckU(d)) < 1.2 / n), deck = [0, 1, 2, 3, 4, 5].findIndex(d => lu < deckU(d + 1)) % 2 ? 1 : -1;
            const isMouth = i === 0;
            for (let y = Math.max(0, Math.floor(cy - rad)); y <= Math.min(AH - 1, Math.ceil(cy + rad)); y++) {
                const dy = y + 0.5 - cy, dy2 = dy * dy;
                if (dy2 > R2) continue;
                // only this row's spans of the ring (or of the whole disc): a slice close up is wide, its band is thin
                const ow = Math.sqrt(R2 - dy2), iw = !full && dy2 < I2 ? Math.sqrt(I2 - dy2) : -1;
                let xa = Math.max(0, Math.floor(cx - ow - 0.5)), xb = Math.min(AW - 1, Math.ceil(cx + ow));
                if (!full) {                                                               // a body slice's far side is the nearer slices': only the half facing back along the drift
                    const T = 0.2 * rad - dy * ry;
                    if (rx > 0.02) xb = Math.min(xb, Math.ceil(cx - 0.5 + T / rx)); else if (rx < -0.02) xa = Math.max(xa, Math.floor(cx - 0.5 + T / rx)); else if (T < 0) continue;
                }
                const ia = iw < 0 ? xb + 1 : Math.ceil(cx - iw - 0.5), ib = iw < 0 ? xb + 1 : Math.floor(cx + iw - 0.5);
                if (xa >= ia && xa < ib) xa = ib;                                          // (starting inside the ring: from its far edge)
                for (let x = xa; x <= xb; x++) {
                    if (x === ia && ib > ia) x = ib;                                       // skip the inside of the ring
                    const dx = x + 0.5 - cx, d2 = dx * dx + dy2;
                    if (d2 > R2 || (!full && d2 < I2) || st[y * AW + x] === mark) continue;   // (or a nearer slice has it)
                    if (isTiny) { put(x, y, HR, TONE.notch, z); continue; }               // far off: a dark notch
                    const nxp = dx * inv, nyp = dy * inv, c = nxp * lx + nyp * ly, sOut = nxp * rx + nyp * ry, isRim = d2 > E2;
                    if (i === faceK) {                                                     // the skirt's underside, round the bell, in shadow
                        const q = Math.sqrt(d2) * inv;
                        put(x, y, HR, isRim ? (c > 0.25 ? 0.62 : 0.16) : Math.abs(q - 0.5) < 0.05 ? 0.26 : 0.11 + 0.1 * q + 0.06 * Math.max(0, c), z);
                        continue;
                    }
                    if (isMouth) { put(x, y, HR, isRim ? (c > 0 ? 0.7 : 0.2) : Math.sqrt(d2) * inv > 0.78 ? 0.12 : 0.02, z); continue; }   // the bell's mouth: its rim lit, dark inside
                    if (lu >= L_BELL) { put(x, y, HR, isRim && c > 0.2 ? 0.66 : 0.1 + 0.22 * Math.max(0, c), z); continue; }   // the bell: cold, its edge lit
                    if (!full && sOut > 0.2) continue;                                     // the far side: the nearer slices cover it
                    if (isRim && Math.abs(sOut) < 0.24) { put(x, y, HR, c > 0.15 ? TONE.rim : TONE.shade, z); continue; }   // the edge that turns away: lit, or dark
                    const hl = 0.5 + 0.5 * c, lit = hl * (0.7 + 0.3 * hl), tone =(TONE.plate[0] + TONE.plate[1] * lit) * (seam ? TONE.seam : 1) + TONE.deck * deck;
                    if (isRustAt(lu, nxp * cR - nyp * sR, nxp * sR + nyp * cR, k)) put(x, y, RU, tone * TONE.rust, z);
                    else put(x, y, HR, tone, z);
                }
            }
            if (i === faceK && !isTiny) for (let q = 0; q < 4; q++) {                     // the four legs, splayed off the skirt, and their feet
                const la = Math.PI / 4 + q * Math.PI / 2 + roll, w = Math.max(1, rad * LEG.w), ux = Math.cos(la), uy = Math.sin(la);
                const lit = ux * lx + uy * ly, step = 0.5 / Math.max(4, rad);
                for (let e = LEG.from; e <= LEG.to; e += step) for (let t = -w; t <= w; t += 0.7) {
                    const X = Math.round(cx + ux * rad * e - uy * t), Y = Math.round(cy + uy * rad * e + ux * t);
                    if (X >= 0 && X < AW && Y >= 0 && Y < AH && st[Y * AW + X] !== mark) put(X, Y, HR, 0.28 + 0.16 * lit + (t * (-uy * lx + ux * ly) > 0 ? 0.24 : 0), z);
                }
                const fx = cx + ux * rad * LEG.to, fy = cy + uy * rad * LEG.to, fw = rad * LEG.foot;    // the foot: a short pad across the leg
                for (let t = -fw; t <= fw; t += 0.6) for (let e = -w; e <= w * 0.6; e += 0.7) {
                    const X = Math.round(fx + ux * e - uy * t), Y = Math.round(fy + uy * e + ux * t);
                    if (X >= 0 && X < AW && Y >= 0 && Y < AH && st[Y * AW + X] !== mark) put(X, Y, HR, e < 0 ? 0.5 + 0.2 * lit : 0.22, z);
                }
            }
            prev = { cx, cy, rad };
        }
        // its portholes, after the slices: one a deck, a dark round port down the middle of the side we see (only where that
        // part of the side is what shows: the depth there is that deck's), its lower lip catching a little light
        if (!isTiny) WIN.forEach(w => {
            const z = Zf - w * G3.LEN;
            if (z < G3.NEAR) return;
            const s = f / z, rad = P.radiusL(w) * G3.DIAM * s, rr = Math.max(0.9, rad * 0.1), tol = G3.LEN * 0.07;
            const cx = mx + (Lx + Tx * (Zf - z)) * s - rx * rad * 0.88, cy = my + (Ly + Ty * (Zf - z)) * s - ry * rad * 0.88;
            for (let y = Math.max(0, Math.floor(cy - rr)); y <= Math.min(AH - 1, Math.ceil(cy + rr)); y++) for (let x = Math.max(0, Math.floor(cx - rr)); x <= Math.min(AW - 1, Math.ceil(cx + rr)); x++) {
                const ex = x + 0.5 - cx, ey = y + 0.5 - cy, d = Math.hypot(ex, ey), i = y * AW + x;
                if (d > rr || Math.abs(z0[i] - z) > tol) continue;
                buf[i] = HR.c32[level(HR, d > rr - 0.9 && ex * lx + ey * ly < 0 ? 0.42 : TONE.window, x, y)];
            }
        });
        // where its name may go (units): just outside the hull away from the middle of the glass, else above it, below it,
        // or on its other side (the flight takes the first that is free)
        // (and the same round its middle, for when its tail has passed out of the glass)
        const placesBy = (pt, reach) => {
            const ox = pt[0] - mx, oy = pt[1] - my, on = Math.hypot(ox, oy) || 1, ux = ox / on, uy = oy / on;
            return [[ux * (reach + 30), uy * (reach + 14)], [0, -(reach + 12)], [0, reach + 12], [-ux * (reach + 30), -uy * (reach + 14)]]
                .map(([dx, dy]) => [(pt[0] + dx) / A.D, (pt[1] + dy) / A.D]);
        };
        if (!tailPt) tailPt = [tx, ty];
        const mid = midPt || tailPt;
        return { nose: [Math.round(nx), Math.round(ny)], tail: [Math.round(tailPt[0]), Math.round(tailPt[1])], mid: [Math.round(mid[0]), Math.round(mid[1])], r: Math.round(tailR), drawn,
            at: placesBy(tailPt, tailR * LEG.to), atMid: placesBy(mid, midR * 1.1), tiny: isTiny };
    }

    // ════════ the chips (the game's format: { icon, text, tone }; DRAFT words) ════════
    // The grade in every dock's words (Soft dock, Rough dock, Hard dock); Energy +3 for a soft dock flown all by hand (the
    // relay's clamps top us up); a rough or hard dock breaks a deck (within the game's allowance); a hard one tears one of
    // the three hulls loose (named by its number, as the radio named it). A.U.R.A.'s share: Energy −n. Decks broken on the
    // way in add to the deck chip ("2 decks broken"). No air (nobody walks a station here) and no disc (not found yet).
    const ENERGY_SOFT = 3;
    const DECK_WORD = { bridge: 'Bridge', lab: 'Lab', quarters: 'Quarters', cargo: 'Hold', engineering: 'Engine room' };
    const chip = (icon, text, tone) => Object.freeze(tone ? { icon, text, tone } : { icon, text });
    function chips(o) {
        const out = [chip('dock', { soft: 'Soft dock', rough: 'Rough dock', crash: 'Hard dock' }[o.grade] || 'Soft dock')];   // (the game's dock chips)
        const rooms = o.rooms || [];
        if (rooms.length === 1) out.push(chip('deck', (DECK_WORD[rooms[0]] || 'Deck') + ' broken', 'loss'));
        else if (rooms.length > 1) out.push(chip('deck', rooms.length + ' decks broken', 'loss'));
        if (o.torn) out.push(chip('hull', (o.tornNum ? fmt(o.tornNum) : 'A hull') + ' torn loose', 'loss'));   // DRAFT
        const e = energyDelta(o);
        if (e) out.push(chip('energy', (e > 0 ? 'Energy +' : 'Energy −') + Math.abs(e), e > 0 ? 'gain' : 'loss'));
        return out;
    }
    /** What the dock gives or costs in energy: A.U.R.A.'s share costs (cost), a soft dock flown all by hand gives (helped:
        she had the stick at some point, even when the tank had nothing left for her to take). */
    const energyDelta = o => (o.cost ? -o.cost : o.grade === 'soft' && !o.helped && !o.auto ? ENERGY_SOFT : 0);

    // ════════ outside: what DockExterior.create takes (DockExterior.js, relay) ════════
    // the dead ports round the ring from ours (rad: the glass's order, packed closer, so outside they stand in a row beside
    // us and the camera at our port holds all four), their numbers; which of them a hard dock tears loose (the nearest on
    // the side we struck: 1 for +, 0 for −; never 2, the story wreck); SENT
    // (sag: each one's lean outside, along the ring, the glass's LEAN a little gentler: OUT_LEAN of its angle)
    const OUT_AT = [-11, 11, 22], OUT_LEAN = 0.7;
    const exterior = Object.freeze({ ports: OUT_AT.map(d => d * RAD), nums: NUMS.slice(), torn: side => (side > 0 ? 1 : 0), sent: 'SENT', sag: LEAN.map(l => l.side * Math.tan(l.deg * RAD * OUT_LEAN)) });

    const debug = () => ({ moonMs: field ? field.ms : null, moon: lastMoon && lastMoon.map(Math.round), glass: glassInfo.map(g => g && { tail: g.tail, r: g.r, drawn: g.drawn, tiny: g.tiny }) });

    window.DockRelay = Object.freeze({ dock, lines, who, hulls, exterior, arrival, lamp, prepare, sky, glass, covers, cutFrame, chips, energyDelta, debug });
})();
