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
     prepare(D)  a new docking: the names and the hulls' sprites start again
     paintMoon(D, ms)  paint the moon about ms more (a band at a time); true once it is ready (sky() goes on with it)
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
    //    jump to the end of the run) brings the station nearer at the run's end (near, m: 80 for a careful pilot, 50 for one
    //    who held it all the way; over the last nearLock course seconds it only ever comes nearer) and the docking starts
    //    that much faster (startSpeed, m/s: DockingGame's 3, up to 6). A slope, not a cliff (2026-10-31, lpv/tools/rush-sim.js:
    //    DockingGame's own step, the careful bot, 400 rings a point, the throttle held through the run and then x s into
    //    the docking): hard 34 % at 0.5 s, 41 % at 1.5, 64 % at 2.5, 71 % at 3, every time at 3.5 and all the way (the sketch's
    //    80 → 38 m and 3 → 8 m/s: 55 % at 0.5 s, then every time from 1.75 s). The rules are DockingGame's (braking at its
    //    THRUST, 1.2 m/s², up to 8 m/s). bakeMs: the film cut's three cameras, ms a frame on the start screen and after it
    //    (most of the bake is done before: DockFlight.warm, at idle on the relay's bridge).
    //    The film cut: the sky turns cutTurn rad/s behind the station and starts at cutRoll (the
    //    moon low on the right). hullsSayAt: metres out when Aris speaks of the hulls (their names are on the glass by then);
    //    tagFrom/tagTo: the metres the names may show between; tagMinPx: a hull at least this many art px across before its
    //    name shows; tagStep: s between one name and the next. lampR: the lamp's radius at the start and end of the run (art
    //    px), lampHz: its pulse (on, then off, each half of 1 / lampHz s).
    const SECTOR = story.sector || 5;
    const dock = Object.freeze({
        sector: SECTOR, dur: 26, aim: 0.24, aimAt: 24, perBreak: 2,
        clusters: [[0.24, 8], [0.5, 8], [0.76, 8]], clusterR: [2.4, 1.6], clusterT: 1.1, big: [0.24, 0.42], sprinkle: 4,
        mast: null, parked: [], spin: [14, 20], near: [80, 50], nearLock: 3, startSpeed: [3, 6], rushT: 1.2, bakeMs: [5, 5],
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
    // (band: rows of the field painted at a time, about a fifteenth of it)
    const MOON = { u: -170, v: 200, r: 200, grow: 0.74, L: [0.6, -0.5, -0.66], dim: 0.55, night: ['#08141a', '#0e2229'], band: 40 };
    let field = null, painting = null;                  // { D, W, cell, frac, flat, ms } once painted; the paint under way
    /** A painter (NSPaint.painter's shape) that keeps each pixel's ramp and tone instead of its colour, so the grain can be
        laid on screen later, per art pixel, whatever the sky's turn. band: the rows it may write now ([y0, y1)), so the
        world's painter can be run over it a band at a time (each run writes only its band; the painter is the same each time). */
    function capture(W, H) {
        const rid = new Uint8Array(W * H), val = new Float32Array(W * H), ramps = [null], ids = new Map(), band = [0, H];
        const idOf = r => { let k = ids.get(r); if (!k) { k = ramps.length; ramps.push(r); ids.set(r, k); } return k; };
        const store = (x, y, r, v) => { x = Math.floor(x); y = Math.floor(y); if (x < 0 || y < band[0] || x >= W || y >= band[1]) return; const i = y * W + x; rid[i] = idOf(r); val[i] = clamp01(v); };
        const tone = (x, y, r, v) => { if (v > 0.02) store(x, y, r, v); };
        const region = (x0, y0, x1, y1, fn) => { for (let y = Math.max(band[0], Math.floor(y0)); y < Math.min(band[1], Math.ceil(y1)); y++) for (let x = Math.max(0, Math.floor(x0)); x < Math.min(W, Math.ceil(x1)); x++) fn(x, y); };
        const ellipse = (cx, cy, rx, ry, fn) => region(cx - rx - 1, cy - ry - 1, cx + rx + 1, cy + ry + 1, (x, y) => { const q = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2; if (q < 1) fn(x, y, q); });
        const line = (x0, y0, x1, y1, fn) => { const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0))); for (let k = 0; k <= n; k++) fn(Math.round(x0 + (x1 - x0) * k / n), Math.round(y0 + (y1 - y0) * k / n), k / n); };
        return { W, H, rid, val, ramps, band, solid: store, tone, add: tone, over: tone, cover: (x, y, r, v, a) => { if (a > P.threshold(Math.floor(x) + 3, Math.floor(y) + 5)) tone(x, y, r, v); },
            region, ellipse, line, set: () => {}, clear: () => {}, get: () => [0, 0, 0, 0] };
    }
    /** A new docking: the names start again, and the hulls' sprites (their sizes start over). The moon is kept. */
    function prepare(D) { tagRun = null; sprites.clear(); lastSprite.fill(null); paintMoon(D, 0); }
    /** The moon at D art pixels a sky unit (one field cell an art pixel at its full size), painted by the world painter a
        band of MOON.band rows at a time for about ms (at least one band); true once it is ready. About 0.13 s in all: done
        at idle on the bridge (DockFlight.warm) it never shows; otherwise sky() paints a band a frame and draws it when ready. */
    function paintMoon(D, ms) {
        if (field && field.D === D) return true;
        if (!painting || painting.D !== D) {
            const rc = Math.round(MOON.r * D), W = 2 * (rc + 6), base = Wd.palette(story.type).ramp.hex.slice(1);
            painting = { D, W, rc, y: 0, ms: 0, p: capture(W, W), ramp: P.ramp(P.INK, MOON.night[0], MOON.night[1], ...base.slice(1, 5)) };
        }
        const g = painting, t0 = performance.now();
        do {
            g.p.band[0] = g.y; g.p.band[1] = Math.min(g.W, g.y + MOON.band);
            Wd.paint(g.p, { cx: g.W / 2, cy: g.W / 2, r: g.rc, type: story.type, seed: story.hull || 17207, sector: SECTOR, L: P.norm3(...MOON.L), dim: MOON.dim, ramp: g.ramp });
            g.y += MOON.band;
        } while (g.y < g.W && performance.now() - t0 < ms);
        g.ms += performance.now() - t0;
        if (g.y < g.W) return false;
        // each cell kept as the colour it takes below its dither's threshold (an index into one flat table, each ramp's top
        // step written twice so the step above is always there) and how far towards the next step it is (0..255)
        const p = g.p, W = g.W, at = [0], flat = [0];
        p.ramps.forEach((r, id) => { if (!r) return; at[id] = flat.length; r.rgb.forEach(([a, b, c]) => flat.push((0xff000000 | (c << 16) | (b << 8) | a) >>> 0)); flat.push(flat[flat.length - 1]); });
        const N = W * W, cell = new Uint16Array(N), frac = new Uint8Array(N);
        for (let k = 0; k < N; k++) {
            const id = p.rid[k];
            if (!id) continue;
            const n = p.ramps[id].rgb.length, pos = p.val[k] * (n - 1), lo = Math.min(n - 1, pos | 0);
            cell[k] = at[id] + lo; frac[k] = Math.min(255, Math.round((pos - lo) * 256));
        }
        field = { D, W, cell, frac, flat: Uint32Array.from(flat), ms: Math.round(g.ms) };
        painting = null;
        return true;
    }
    let bay255 = null;                                  // the flight's 8 x 8 grain as 0..255 thresholds
    /** The moon into the frame: every art pixel inside its disc on screen looks up its cell through the sky's own turn
        (drawBackdrop's sums) and takes its ramp's step by the flight's 8 x 8 grain. Only the disc's own span of each row,
        and none of the span the station's face will cover (A.faceSpan). Over the stars and the haze; the station, the hulls
        and the debris come after. It grows as the run goes (A.grow(): 0 at the drop-out .. 1 at its end, and after). */
    let lastMoon = null;
    function sky(A) {
        if (!paintMoon(A.D, 4)) return;                                                     // (not painted yet: a band this frame)
        const F = field, v = A.view, D = A.D, zm = v.zm, sc = lerp(MOON.grow, 1, clamp01(A.grow ? A.grow() : 1));
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
    // In the face's own space (DockFace.js: its radius faceA / (metres + faceB) art px, so a pinhole faceB metres behind the
    // hatch with the flight's focal length FA): each hull stands off the ring at its port, nose in, its tail towards us,
    // DIAM across and LEN long in those units (the port is about 3.3 across). Dead, they hang crooked in their old clamps
    // (LEAN: degrees off straight, which way along the ring, and a little outward, as outside), so the glass sees their
    // sides. Each is drawn as the film cut draws ours and theirs (2026-10-31, the designer: the sketch's slices read as rusty
    // tubes): its nose and tail projected through the pinhole, the game's own Lander painted along that line (NSPaint.hull
    // with shapeL: the nose cone, the decks and their dark portholes, the skirt and its folded legs, the bell), dimmed, in
    // the painter's own light rust; seen nearly end on, the bell's mouth over its tail end (the cut's endCap). Each keeps the
    // sprite it was last painted with until its length has moved SPRITE.step of itself or its angle SPRITE.deg, at most
    // perFrame painted a frame. A Lander longer than SPRITE.max art px (closer than about 20 m) is painted at a whole
    // fraction of its size and laid on the glass that many times bigger (its pixels 2 x 2 or more), so no paint costs more
    // than about 12 ms (painting one 400 px long costs about 80). Far off (under tiny art px across), a dark notch by the lamp.
    // A dark collar where its nose goes in.
    const G3 = { DIAM: 1.7, LEN: 1.7 * 3.15, minRd: 5, tiny: 3, light: [-0.6, -0.8] };
    const SPRITE = { step: 0.05, deg: 3, perFrame: 1, keep: 24, max: 160, light: 0.6, notch: 0.06, mouth: 0.04, rim: 0.7 };
    const LEAN = [{ deg: 42, side: -1 }, { deg: 46, side: 1 }, { deg: 40, side: 1 }], LEAN_OUT = 0.45, REACH = 1.6;
    const BELL_R = P.radiusL(1 - 1e-6);                                                    // the bell's mouth, a share of DIAM
    let glassInfo = [], tagRun = null;                    // tagRun: this approach's names, when each first could show and does
    let stamp = null, stampN = 0, frameMark = 1, stampW = 0;   // which hull last painted each pixel; this frame's first mark
    const sprites = new Map(), lastSprite = [null, null, null];   // painted sprites by size and angle; each hull's last
    let paintedNow = 0;
    /** Whether a box on the glass (units, [x0, y0, x1, y1]) has any of this frame's hulls in it (a name is best beside one, not on it). */
    function covers(D, b) {
        if (!stamp) return false;
        const AH = stamp.length / stampW, x0 = Math.max(0, Math.floor(b[0] * D)), x1 = Math.min(stampW - 1, Math.ceil(b[2] * D)), y0 = Math.max(0, Math.floor(b[1] * D)), y1 = Math.min(AH - 1, Math.ceil(b[3] * D));
        for (let y = y0; y <= y1; y += 2) for (let x = x0; x <= x1; x += 2) if (stamp[y * stampW + x] >= frameMark) return true;
        return false;
    }
    function glass(A, G) {
        glassInfo = []; frameMark = stampN + 1; stampW = A.AW; paintedNow = 0;
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
            if (now >= tagRun.showAt[k]) tags.push({ k, s: 'EXODUS-' + fmt(h.num), at, near: G.dist < 25, since: tagRun.showAt[k] });
        });
        return tags;
    }
    /** Hull k's Lander, len x ht art px, lying at deg (its tail to its nose), from the cache or painted now (perFrame a frame;
        past that the hull keeps its last sprite for a frame or two). */
    function spriteOf(k, len, ht, deg) {
        const f = len > SPRITE.max ? Math.ceil(len / SPRITE.max) : 1, bl = len / f, step = Math.max(2, bl * SPRITE.step);   // (f: how many times bigger it is laid down)
        const L = Math.max(8, Math.round(bl / step) * step), H = Math.max(3, Math.round(ht / f * 2) / 2), Dg = Math.round(deg / SPRITE.deg) * SPRITE.deg;
        const key = k + '|' + f + '|' + L.toFixed(1) + '|' + H + '|' + Dg;
        let sp = sprites.get(key);
        if (!sp && (paintedNow < SPRITE.perFrame || !lastSprite[k])) {
            paintedNow++;
            const ang = Dg * RAD, half = Math.ceil(L / 2 + H + 3), W = half * 2, p = P.painter(W, W, false);
            const at = P.hull(p, { x: half, y: half, len: L, ht: H, angle: ang, flip: true, seed: 50 + k, anchor: 0.5, light: SPRITE.light, rust: true, flat: L < 130, mirror: Math.cos(ang) - Math.sin(ang) < 0 }, P.shapeL);
            const b = at(1, 0);
            sp = { d32: new Uint32Array(p.data.buffer), w: W, half, f, bell: [(b[0] - half) * f, (b[1] - half) * f] };
            if (sprites.size >= SPRITE.keep) sprites.delete(sprites.keys().next().value);
            sprites.set(key, sp);
        }
        if (sp) lastSprite[k] = sp;
        return sp || lastSprite[k];
    }
    function drawHull(A, G, f, Zf, Lx, Ly, roll, k, Tx, Ty) {
        const { buf, depth, AW, AH, R, level } = A, mx = G.mx, my = G.my, HR = R.HULL;
        const proj = z => [mx + (Lx + Tx * (Zf - z)) * f / z, my + (Ly + Ty * (Zf - z)) * f / z, f / z];
        const zT = Zf - G3.LEN, zM = Zf - G3.LEN / 2, [nx, ny, ns] = proj(Zf), [tx, ty, ts] = proj(zT), [, , ms] = proj(zM);
        const len = Math.hypot(tx - nx, ty - ny), ht = G3.DIAM * ms, cx = (nx + tx) / 2, cy = (ny + ty) / 2, isTiny = ht < G3.tiny;
        if (!stamp || stamp.length !== AW * AH) stamp = new Uint32Array(AW * AH);
        const st = stamp, mark = ++stampN;
        let drawn = 0;
        const put = (x, y, r, v) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= AW || y >= AH) return; const i = y * AW + x; buf[i] = r.c32[level(r, v, x, y)]; depth[i] = zM; st[i] = mark; drawn++; };
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
        if (isTiny) {                                                                       // far off: a dark notch from its nose to its tail
            const n = Math.max(1, Math.ceil(len));
            for (let q = 0; q <= n; q++) put(nx + (tx - nx) * q / n, ny + (ty - ny) * q / n, HR, SPRITE.notch);
        } else {
            const sp = spriteOf(k, len, ht, Math.atan2(ny - ty, nx - tx) / RAD), sf = sp.f, x0 = Math.round(cx) - sp.half * sf, y0 = Math.round(cy) - sp.half * sf;
            for (let y = 0; y < sp.w; y++) {
                const row = y * sp.w;
                for (let x = 0; x < sp.w; x++) {
                    const c = sp.d32[row + x];
                    if (!(c >>> 24)) continue;
                    for (let j = 0; j < sf; j++) {                                          // (each sprite pixel sf x sf art px)
                        const Y = y0 + y * sf + j; if (Y < 0 || Y >= AH) continue;
                        for (let q = 0; q < sf; q++) { const X = x0 + x * sf + q; if (X < 0 || X >= AW) continue; const i = Y * AW + X; buf[i] = c; depth[i] = zM; st[i] = mark; drawn++; }
                    }
                }
            }
            // seen nearly end on (much shorter on the glass than it is): the bell's mouth over its tail end, dark inside, its
            // rim lit on the side the light comes from
            const full = G3.LEN * ms, cosT = Math.sqrt(Math.max(0, 1 - Math.min(1, len / (full || 1)) ** 2));
            if (cosT > 0.15) {
                const ax = (tx - nx) / (len || 1), ay = (ty - ny) / (len || 1), bx = Math.round(cx) + sp.bell[0], by = Math.round(cy) + sp.bell[1];
                const Ra = BELL_R * G3.DIAM * ts, Rb = Math.max(0.7, Ra * cosT), m = Math.ceil(Ra + 1), rimQ = (1 - Math.min(0.45, 1.3 / Rb)) ** 2;
                for (let yy = -m; yy <= m; yy++) for (let xx = -m; xx <= m; xx++) {
                    const along = xx * ax + yy * ay, across = -xx * ay + yy * ax, q = (across / Ra) ** 2 + (along / Rb) ** 2;
                    if (q > 1) continue;
                    const lit = (xx * -lx + yy * -ly) / (Math.hypot(xx, yy) || 1);           // (the far side of the mouth's rim catches the light)
                    put(bx + xx, by + yy, HR, q > rimQ ? (lit > 0.1 ? SPRITE.rim : 0.2) : SPRITE.mouth);
                }
            }
        }
        // where its name may go (units): just outside the hull away from the middle of the glass, else above it, below it,
        // or on its other side (the flight takes the first that is free); the same round its middle, for when its tail has
        // passed out of the glass
        const placesBy = (pt, reach) => {
            const ox = pt[0] - mx, oy = pt[1] - my, on = Math.hypot(ox, oy) || 1, ux = ox / on, uy = oy / on;
            return [[ux * (reach + 30), uy * (reach + 14)], [0, -(reach + 12)], [0, reach + 12], [-ux * (reach + 30), -uy * (reach + 14)]]
                .map(([dx, dy]) => [(pt[0] + dx) / A.D, (pt[1] + dy) / A.D]);
        };
        const tailR = Math.max(ht, G3.DIAM * ts) / 2, tail = [tx, ty], mid = [cx, cy];
        return { nose: [Math.round(nx), Math.round(ny)], tail: tail.map(Math.round), mid: mid.map(Math.round), r: Math.round(Math.max(tailR, len / 4)), drawn,
            at: placesBy(tail, tailR * REACH), atMid: placesBy(mid, Math.max(tailR, len / 2) * 1.1), tiny: isTiny };
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
    // (sag: each one's lean outside, along the ring: OUT_LEAN of the glass's angle, so the cut keeps the gentle lean it was
    // approved with, about 18-21 degrees, while the glass's 40-46 show their sides)
    const OUT_AT = [-11, 11, 22], OUT_LEAN = 0.45;
    const exterior = Object.freeze({ ports: OUT_AT.map(d => d * RAD), nums: NUMS.slice(), torn: side => (side > 0 ? 1 : 0), sent: 'SENT', sag: LEAN.map(l => l.side * Math.tan(l.deg * RAD * OUT_LEAN)) });

    const debug = () => ({ moonMs: field ? field.ms : null, sprites: sprites.size, moon: lastMoon && lastMoon.map(Math.round), glass: glassInfo.map(g => g && { tail: g.tail, r: g.r, drawn: g.drawn, tiny: g.tiny }) });

    window.DockRelay = Object.freeze({ dock, lines, who, hulls, exterior, arrival, lamp, prepare, paintMoon, sky, glass, covers, cutFrame, chips, energyDelta, debug });
})();
