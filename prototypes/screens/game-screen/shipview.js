/* Silent Exodus game screen: the ship, cut open. Click our ship (or press E): the plating dissolves through the dither grain
   and the same hull is seen side-on, five rooms in a row from the nose: bridge, lab, quarters, hold, engineering. The five
   crew are the 12 x 24 figures of crew/skeleton.js; they sit, work, sleep, kneel, carry and walk somewhere for a reason
   about every half minute. Supplies are written plainly under the rooms they belong to. Point at a person for their name and
   state; click the logbook on the bridge for the ship's record; Esc or a click outside closes.
     GameShipView.create(World) → { open(), close(), draw(ctx, t), hover(cx, cy) → bool, click(cx, cy) → 'record'|'inside'|'outside', anchor() }
   Everything is in canvas pixels of the world (640 x 360 at a whole-number scale). */
(function () {
    'use strict';
    const LEN = 560, HT = 64, FLOOR = 18, CEIL = -23, CEIL_HI = -36, SHELL = 3, DOOR_H = 28;
    const STEP = 125;                                     // the walk moves 2 px every 125 ms (crew/skeleton.js), so feet never slide
    const COVER_FOR = 600, DISSOLVE_MS = 700;             // the world's dissolve into this view, then the plating falls away
    const ROOMS = [
        { id: 'bridge', name: 'Bridge', u0: 0.03, u1: 0.235, lamp: 0.55 },
        { id: 'lab', name: 'Lab', u0: 0.235, u1: 0.41, lamp: 0.72 },
        { id: 'quarters', name: 'Quarters', u0: 0.41, u1: 0.585, lamp: 0.66 },
        { id: 'hold', name: 'Hold', u0: 0.585, u1: 0.76, lamp: 0.58 },
        { id: 'engineering', name: 'Engineering', u0: 0.76, u1: 0.965, lamp: 0.62 },
    ];
    const WHERE = { bridge: 'on the bridge', lab: 'in the lab', quarters: 'in the quarters', hold: 'in the hold', engineering: 'in engineering' };
    const NAMES = { cora: 'Cora', jaxon: 'Jaxon', vance: 'Vance', aris: 'Aris', mira: 'Mira' };

    function create(World) {
        const A = World.art, { RP, INK, ramp, painter, framer, drawHull, hullEdges, threshold, hash, fbm, clamp01, lerp, smooth } = A;
        const WALL = ramp(INK, '#0a0d10', '#121518', '#1c1d1e', '#2a2622', '#3f3327', '#5e4631');
        const WALL_RED = ramp(INK, '#120909', '#1f0d0c', '#321410', '#4e1c14', '#72281b');
        const DECK = ramp(INK, '#0d1216', '#172027', '#25313a', '#3a4852', '#566874');
        const STEEL = ramp(INK, '#0e1318', '#1a232c', '#2a3642', '#3e4c59', '#5d6d7a');
        const BLANKET = ramp(INK, '#2a1a11', '#4a2e1e', '#6a462e', '#87603f');
        const CRATE = ramp(INK, '#121816', '#26302c', '#43524b', '#6f8278');
        const LINEN = ramp(INK, '#2a2925', '#3e3a35', '#5d5850', '#77716a');
        const PAPER = ramp(INK, '#5c5446', '#aea38a', '#d9cfb8');

        const cache = new Map();
        let geo = null, built = null, people = [], st = null, openT = 0, hover = null, nextTrip = 0, tripN = 0, stars = null;

        // ── geometry: u runs from the nose (0, right) to the tail (1, left), as in drawHull ──
        function measure() {
            const g = World.geom(), cx = Math.round(g.W / 2), cy = Math.round(g.oy + 0.52 * 360);
            geo = { g, cx, cy, floorY: cy + FLOOR, feetY: cy + FLOOR - 1 };
            const at = {
                chair: xOf(0.135), lectern: xOf(0.205), map: xOf(0.30), bench: xOf(0.41) + 3, bunkL: geo.cx + 2, bunkR: geo.cx + 32,
                locker: xOf(0.565), broken: geo.cx - 12, crates: geo.cx - 58, pods: [geo.cx - 98, geo.cx - 112, geo.cx - 126],
                holdA: geo.cx - 88, holdB: geo.cx - 138, engDesk: geo.cx - 177, reactor: xOf(0.875),
            };
            at.lowerTop = geo.feetY - 6; at.upperTop = geo.feetY - 21; at.sleeper = at.bunkL + 15;
            geo.at = at;
        }
        const xOf = u => Math.round(geo.cx + (0.5 - u) * LEN);
        const uOf = x => 0.5 - (x + 0.5 - geo.cx) / LEN;
        const edgesAt = u => { const e = hullEdges(u); return e ? [geo.cy + e[0] * HT, geo.cy + e[1] * HT] : null; };
        const isRaised = u => u > 0.15 && u < 0.35;
        const ceilAt = u => Math.round(geo.cy + (isRaised(u) ? lerp(CEIL, CEIL_HI, Math.min(1, (u - 0.15) / 0.02, (0.35 - u) / 0.02)) : CEIL));
        const roomAt = u => ROOMS.find(r => u >= r.u0 && u < r.u1) || null;
        const roomOfX = x => roomAt(uOf(x));
        const hullTopAt = x => { const e = edgesAt(uOf(x)); return e ? e[0] : geo.cy - 40; };
        const hullBottomAt = x => { const e = edgesAt(uOf(x)); return e ? e[1] : geo.cy + 36; };
        const clearAbove = x => Math.min(...[-40, -28, -16, -4, 4, 16, 28, 40].map(d => hullTopAt(x + d))) - 2;   // above the hull all along a label

        // ── the still layers: the closed hull (for the dissolve) and the hull cut open, with the quarters' lamp on and off ──
        function build(s) {
            const key = `${geo.g.W}x${geo.g.H}:${s.sector}:${s.damaged.quarters ? 1 : 0}:${s.pods}`;
            if (cache.has(key)) return cache.get(key);
            const closed = painter(geo.g.W, geo.g.H, false);
            hull(closed);
            const lit = paintOpen(s, 1), out = { closed: closed.canvas(), open: lit.canvas, glass: lit.glass, off: null };
            if (s.damaged.quarters) out.off = paintOpen(s, 0.08).canvas;
            cache.set(key, out);
            return out;
        }
        function hull(p) {
            const at = drawHull(p, { x: geo.cx, y: geo.cy, len: LEN, ht: HT, flip: true, seed: 9, rimDir: [0.7, -0.7], rim: 0.12 });
            [0.24, 0.37, 0.49, 0.61, 0.72].forEach((u, i) => { const [wx, wy] = at(u, -0.05).map(Math.round); p.region(wx - 3, wy - 1, wx + 3, wy + 1, (x, y) => p.solid(x, y, RP.AMBER, i === 0 ? 0.75 : 0.6)); });
        }
        function paintOpen(s, quartersLamp) {
            const p = painter(geo.g.W, geo.g.H, false), glass = [];
            hull(p);
            p.region(xOf(0.97), geo.cy - 48, xOf(0.0) + 1, geo.cy + 40, (x, y) => cut(p, x, y, s, quartersLamp, glass));
            bulkheads(p);
            props(p, s, quartersLamp);
            return { canvas: p.canvas(), glass };
        }
        function cut(p, x, y, s, quartersLamp, glass) {
            const u = uOf(x), r = roomAt(u), e = edgesAt(u);
            if (!r || !e) return;
            const top = Math.ceil(e[0] + SHELL), bottom = Math.floor(e[1] - SHELL), fl = geo.floorY, ceil = ceilAt(u);
            if (y < top || y > bottom) return;                                                       // the shell stays: the cut edge of the plating
            if (y === top || y === bottom) { p.solid(x, y, RP.HULL, 0.58); return; }
            if (y > fl + 2) {                                                                         // under the deck: pipes and struts
                let v = 0.1;
                if (y === fl + 6 || y === fl + 11) v = 0.38; else if (y === fl + 7 || y === fl + 12) v = 0.2;
                if ((x - geo.cx) % 22 === 0) v = 0.2;
                p.solid(x, y, STEEL, v); return;
            }
            if (y >= fl) {                                                                            // the deck, with a pool of light under each lamp
                const lampK = lampAt(r, x, y - 3, s, quartersLamp), pool = poolAt(r, x, s, quartersLamp);
                if (y === fl && pool > threshold(x, y) * 0.9) { p.solid(x, y, WALL, 0.62 + 0.36 * pool); return; }
                p.solid(x, y, DECK, (y === fl ? 0.5 + 0.35 * lampK : y === fl + 1 ? 0.3 + 0.3 * pool : 0.16) - (x % 12 === 0 ? 0.08 : 0)); return;
            }
            if (y < ceil - 2) {
                if (isRaised(u) && y > top + 1) {                                                     // a skylight above the raised rooms
                    if ((x - geo.cx) % 10 === 0) { p.solid(x, y, STEEL, 0.28); return; }
                    glass.push([x, y]);
                    p.set(x, y, hash(x, y, 13) > 0.975 ? RP.STAR.rgb[3] : RP.HAZE.rgb[1]); return;
                }
                let v = 0.09; if (y === ceil - 5) v = 0.3; if (y === ceil - 4) v = 0.16;              // ducts above the ceiling
                p.solid(x, y, STEEL, v); return;
            }
            if (y < ceil) { p.solid(x, y, STEEL, y === ceil - 1 ? 0.22 : 0.32); return; }
            if (u < 0.1 && y < fl - 9) {                                                             // the nose glass: space ahead
                if (Math.abs(x - xOf(0.065)) < 1) { p.solid(x, y, STEEL, 0.3); return; }
                glass.push([x, y]);
                const v = Math.max(0, fbm(x / 20, y / 12, 41, 3) - 0.48) * 1.2;
                if (hash(x, y, 17) > 0.986) p.set(x, y, RP.STAR.rgb[3]); else if (v > 0.04) p.tone(x, y, RP.HAZE, v); else p.set(x, y, RP.HAZE.rgb[0]);
                return;
            }
            const damaged = r.id === 'quarters' && s.damaged.quarters;
            let v = 0.14 + lampAt(r, x, y, s, quartersLamp) + coneAt(r, x, y, s, quartersLamp);
            if ((x - xOf(r.u1)) % 14 === 0) v -= 0.07;
            if (y === fl - 13) v += 0.08; else if (y === fl - 12) v -= 0.05;
            if (y >= fl - 2) v -= 0.05;
            p.solid(x, y, damaged ? WALL_RED : WALL, damaged ? v * 0.95 : v);
        }
        function lampAt(r, x, y, s, quartersLamp) {
            const mid = (r.u0 + r.u1) / 2, lx = xOf(mid), ly = ceilAt(mid) + 1, d = Math.hypot((x - lx) / 1.7, y - ly);
            const on = r.id === 'quarters' && s.damaged.quarters ? quartersLamp : 1;
            return on * r.lamp * 1.32 * Math.exp(-d / 28);
        }
        /** The cone of light under a room's lamp: the walls warm where it falls, so each room is a lit place, not a box. */
        function coneAt(r, x, y, s, quartersLamp) {
            const mid = (r.u0 + r.u1) / 2, lx = xOf(mid), ly = ceilAt(mid) + 2, dy = y - ly;
            if (dy < 0) return 0;
            const half = 3 + dy * 0.6, on = r.id === 'quarters' && s.damaged.quarters ? quartersLamp : 1;
            return on * r.lamp * (1 - smooth(half - 3, half + 5, Math.abs(x + 0.5 - lx))) * (0.17 - 0.05 * Math.min(1, dy / 40));
        }
        /** The pool the cone makes on the deck (0..1). */
        function poolAt(r, x, s, quartersLamp) {
            const mid = (r.u0 + r.u1) / 2, lx = xOf(mid), half = 3 + (geo.floorY - ceilAt(mid) - 2) * 0.6, on = r.id === 'quarters' && s.damaged.quarters ? quartersLamp : 1;
            return on * r.lamp * (1 - smooth(half * 0.4, half + 2, Math.abs(x + 0.5 - lx)));
        }
        function bulkheads(p) {
            const fl = geo.floorY;
            [0.235, 0.41, 0.585, 0.76].forEach(u => {
                const x = xOf(u), e = edgesAt(u), top = Math.ceil(e[0] + SHELL) + 1, bottom = Math.floor(e[1] - SHELL) - 1;
                for (let y = top; y <= bottom; y++) {
                    const inDoor = y >= fl - DOOR_H && y < fl;
                    if (!inDoor) { for (let dx = -1; dx <= 1; dx++) p.solid(x + dx, y, STEEL, y > fl || y < ceilAt(u) ? 0.22 : dx === 1 ? 0.48 : 0.32); continue; }
                    p.solid(x - 2, y, STEEL, 0.4); p.solid(x + 2, y, STEEL, 0.5);                        // an open door: just its frame
                }
            });
            const aft = xOf(0.965), e = edgesAt(0.965);
            for (let y = Math.ceil(e[0] + SHELL); y <= Math.floor(e[1] - SHELL); y++) { p.solid(aft, y, STEEL, 0.4); p.solid(aft + 1, y, STEEL, 0.25); }
        }
        function box(p, x0, y0, x1, y1, r, v, lit) { p.region(x0, y0, x1 + 1, y1 + 1, (x, y) => p.solid(x, y, r, (y === y0 && lit ? v + 0.25 : x === x0 ? v - 0.06 : v))); }
        function props(p, s, quartersLamp) {
            const fl = geo.floorY, fy = geo.feetY, at = geo.at;
            ROOMS.forEach(r => {                                                                     // a lamp in every ceiling: the warm light people live by
                const mid = (r.u0 + r.u1) / 2, lx = xOf(mid), ly = ceilAt(mid), hit = r.id === 'quarters' && s.damaged.quarters, on = hit ? quartersLamp : 1;
                for (let x = lx - 3; x <= lx + 2; x++) { p.solid(x, ly, STEEL, 0.4); p.solid(x, ly + 1, hit ? RP.RED : RP.AMBER, on > 0.5 ? (Math.abs(x - lx + 0.5) < 2 ? 0.95 : 0.7) : 0.18); }
            });
            // bridge: the console under the nose glass, the commander's chair, the logbook on its stand
            box(p, xOf(0.105), fl - 9, xOf(0.072), fl - 1, STEEL, 0.3, true);
            for (let y = fy - 13; y <= fy - 4; y++) p.solid(at.chair - 5, y, STEEL, y === fy - 13 ? 0.6 : 0.42);
            for (let y = fl - 14; y < fl; y++) p.solid(at.lectern, y, STEEL, 0.36);
            box(p, at.lectern - 3, fl - 15, at.lectern + 3, fl - 15, STEEL, 0.4, true);
            for (let x = at.lectern - 3; x <= at.lectern + 3; x++) { p.solid(x, fl - 16, PAPER, x === at.lectern ? 0.2 : 0.75); p.solid(x, fl - 17, PAPER, x === at.lectern || Math.abs(x - at.lectern) === 3 ? 0.2 : 0.95); }
            // lab: the star map table, Aris's bench with its screen on the wall
            box(p, at.map - 6, fl - 10, at.map + 5, fl - 10, STEEL, 0.45, true);
            for (let y = fl - 9; y < fl; y++) for (let x = at.map - 1; x <= at.map + 1; x++) p.solid(x, y, STEEL, 0.28);
            box(p, at.bench, fl - 8, at.bench + 9, fl - 1, STEEL, 0.3, true);
            box(p, at.bench + 1, fl - 20, at.bench + 7, fl - 13, STEEL, 0.22, false);
            // quarters: two bunks, a locker; a broken ceiling panel when the room is hit
            bunk(p, at.lowerTop); bunk(p, at.upperTop);
            for (let y = at.upperTop - 7; y < fl; y++) { p.solid(at.bunkL - 1, y, STEEL, 0.38); p.solid(at.bunkR + 1, y, STEEL, 0.46); }
            for (let x = at.bunkL + 2; x <= at.bunkR - 2; x++) for (let y = at.upperTop - 2; y <= at.upperTop; y++) p.solid(x, y, BLANKET, 0.5 + (y === at.upperTop - 2 ? 0.25 : 0) - (x % 7 === 0 ? 0.1 : 0));
            box(p, at.locker - 4, fl - 30, at.locker + 3, fl - 1, STEEL, 0.26, true);
            for (let y = fl - 29; y < fl - 1; y++) p.solid(at.locker, y, STEEL, 0.14);
            if (s.damaged.quarters) {
                const c = ceilAt(0.5);
                for (let x = at.broken - 4; x <= at.broken + 3; x++) for (let y = c - 2; y < c; y++) p.set(x, y, A.hexRgb(INK));
                p.line(at.broken - 4, c, at.broken + 3, c + 6, (x, y) => p.solid(x, y, STEEL, 0.4));
            }
            // hold: crates, three sleeper pods
            [[0, 0], [9, 0], [18, 0], [4, 1], [13, 1], [9, 2]].forEach(([dx, row]) => {
                const x1 = at.crates - dx, x0 = x1 - 7, y1 = fl - 1 - row * 8, y0 = y1 - 6;
                p.region(x0, y0, x1 + 1, y1 + 1, (x, y) => p.solid(x, y, CRATE, y === y0 ? 0.85 : y === y1 ? 0.25 : x === x1 ? 0.62 : 0.45));
                p.solid(x0 + 3, y0 + 3, PAPER, 0.5); p.solid(x0 + 4, y0 + 3, PAPER, 0.5);
            });
            at.pods.forEach((px, i) => {
                const filled = i < s.pods;
                p.region(px - 4, fl - 24, px + 5, fl, (x, y) => {
                    const dx = x - px, dy = y - (fl - 24), round = dy < 3 && Math.abs(dx + 0.5) > 2 + dy;
                    if (round) return;
                    const glassIn = Math.abs(dx + 0.5) < 2.6 && dy > 3 && dy < 19;
                    if (glassIn) p.solid(x, y, RP.ICE, filled ? 0.32 + 0.12 * (1 - dy / 19) : 0.08);
                    else p.solid(x, y, STEEL, dx === 4 ? 0.48 : dx === -4 ? 0.22 : 0.34);
                });
                if (filled) { p.solid(px, fl - 19, RP.AMBER, 0.42); p.solid(px - 1, fl - 19, RP.AMBER, 0.3); }   // someone asleep inside
            });
            // engineering: Jaxon's console, the reactor and its pipes
            box(p, at.engDesk, fl - 8, at.engDesk + 9, fl - 1, STEEL, 0.3, true);
            box(p, at.engDesk + 1, fl - 20, at.engDesk + 6, fl - 13, STEEL, 0.22, false);
            const rx = at.reactor, rTop = ceilAt(0.875) + 2;
            p.region(rx - 8, rTop, rx + 8, fl, (x, y) => {
                const k = (x - rx + 0.5) / 8, bandY = (y - rTop) % 7 === 0;
                p.solid(x, y, STEEL, 0.18 + 0.36 * Math.max(0, 1 - Math.abs(k + 0.25) * 1.2) - (bandY ? 0.1 : 0));
            });
            for (let y = ceilAt(0.875) - 6; y < rTop; y++) { p.solid(rx - 3, y, STEEL, 0.3); p.solid(rx + 3, y, STEEL, 0.36); }
            for (let x = rx + 8; x < xOf(0.76) - 1; x++) { p.solid(x, fl - 21, STEEL, 0.36); p.solid(x, fl - 20, STEEL, 0.18); }
            decor(p, s);
        }
        /** The things people live with, one or two per room, so every room says what it is for and who uses it. */
        function decor(p, s) {
            const fl = geo.floorY, at = geo.at, cx = geo.cx;
            const vent = (x0, y) => { for (let x = x0; x < x0 + 9; x++) { p.solid(x, y, STEEL, 0.34); p.solid(x, y + 1, STEEL, (x - x0) % 2 ? 0.1 : 0.26); p.solid(x, y + 2, STEEL, 0.34); } };
            ROOMS.forEach(r => vent(xOf((r.u0 + r.u1) / 2) - 18, ceilAt((r.u0 + r.u1) / 2) + 3));        // a vent high on every wall
            // bridge: a chart on the wall, a mug left on the console
            box(p, cx + 178, fl - 33, cx + 193, fl - 24, STEEL, 0.2, false);
            for (let i = 0; i < 6; i++) { const a = i * 1.05 + 0.3, len = 2 + (i * 3) % 4; for (let d = 1; d <= len; d++) p.solid(Math.round(cx + 185 + Math.cos(a) * d * 1.4), Math.round(fl - 29 + Math.sin(a) * d * 0.8), RP.UI, 0.4); }
            p.solid(cx + 236, fl - 11, RP.AMBER, 0.55); p.solid(cx + 237, fl - 11, RP.AMBER, 0.55); p.solid(cx + 236, fl - 10, RP.AMBER, 0.4); p.solid(cx + 237, fl - 10, RP.AMBER, 0.4); p.solid(cx + 238, fl - 10, RP.AMBER, 0.3);
            // lab: shelves of samples, and Aris's list of the dead pinned to the wall
            [fl - 29, fl - 21].forEach((y, row) => {
                for (let x = cx + 66; x <= cx + 92; x++) { p.solid(x, y, STEEL, 0.46); p.solid(x, y + 1, STEEL, 0.2); }
                for (let k = 0; k < 6; k++) { const jx = cx + 68 + k * 4 + row, glass = hash(k, row, 5) > 0.5 ? RP.ICE : RP.STONE; p.solid(jx, y - 1, glass, 0.55); p.solid(jx, y - 2, glass, 0.4); p.solid(jx + 1, y - 1, glass, 0.35); if (k % 3 === 1) p.solid(jx, y - 3, glass, 0.3); }
            });
            p.region(cx + 128, fl - 27, cx + 135, fl - 16, (x, y) => p.solid(x, y, PAPER, y === fl - 27 ? 0.95 : 0.7));
            for (let y = fl - 25; y < fl - 17; y += 2) for (let x = cx + 129; x < cx + 133 + ((y >> 1) % 2); x++) p.solid(x, y, PAPER, 0.15);
            p.solid(cx + 131, fl - 28, RP.RED, 0.6);                                                        // the pin
            // quarters: a photo above the bunk, a small table with a mug, a jacket on a hook
            p.region(cx - 7, fl - 25, cx - 2, fl - 20, (x, y) => p.solid(x, y, x === cx - 7 || y === fl - 25 ? PAPER : BLANKET, x === cx - 7 || y === fl - 25 ? 0.9 : 0.55 + 0.3 * hash(x, y, 1)));
            for (let x = at.locker + 6; x <= at.locker + 14; x++) p.solid(x, fl - 7, STEEL, 0.44);
            [at.locker + 7, at.locker + 13].forEach(x => { for (let y = fl - 6; y < fl; y++) p.solid(x, y, STEEL, 0.26); });
            p.solid(at.locker + 10, fl - 8, RP.AMBER, 0.5); p.solid(at.locker + 11, fl - 8, RP.AMBER, 0.5);
            p.solid(at.locker - 7, fl - 27, STEEL, 0.5);
            p.region(at.locker - 9, fl - 26, at.locker - 5, fl - 17, (x, y) => p.solid(x, y, BLANKET, 0.35 + (x === at.locker - 6 ? 0.15 : 0)));
            // hold: cargo netting on the wall over the crates, a rack of bins
            for (let y = fl - 37; y <= fl - 28; y++) for (let x = at.crates - 26; x <= at.crates; x++) if ((x + y) % 5 === 0 || (x - y) % 5 === 0) p.solid(x, y, CRATE, 0.35);
            for (let row = 0; row < 2; row++) { const y = fl - 30 + row * 7; for (let x = at.holdB - 6; x <= at.holdB + 6; x++) p.solid(x, y, STEEL, 0.42); for (let k = 0; k < 2; k++) box(p, at.holdB - 5 + k * 6, y - 4, at.holdB - 2 + k * 6, y - 1, CRATE, 0.4, true); }
            // engineering: a board of tools, three gauges by the reactor
            box(p, cx - 162, fl - 34, cx - 149, fl - 22, STEEL, 0.16, false);
            [[cx - 160, 7], [cx - 157, 5], [cx - 154, 8], [cx - 151, 6]].forEach(([x, len]) => { for (let y = fl - 32; y < fl - 32 + len; y++) p.solid(x, y, STEEL, 0.52); p.solid(x - 1, fl - 32 + len, STEEL, 0.46); p.solid(x + 1, fl - 32 + len, STEEL, 0.46); });
            [cx - 197, cx - 192, cx - 187].forEach(gx => p.ellipse(gx + 0.5, fl - 29.5, 2, 2, (x, y, q) => p.solid(x, y, STEEL, q > 0.5 ? 0.5 : 0.12)));
        }
        function bunk(p, top) {
            const at = geo.at;
            for (let x = at.bunkL; x <= at.bunkR; x++) {
                p.solid(x, top + 1, LINEN, 0.66); p.solid(x, top + 2, LINEN, 0.45);
                p.solid(x, top + 3, STEEL, 0.48); p.solid(x, top + 4, STEEL, 0.22);
            }
            for (let x = at.bunkR - 6; x <= at.bunkR - 1; x++) { p.solid(x, top, LINEN, 0.82); if (x > at.bunkR - 6 && x < at.bunkR - 1) p.solid(x, top - 1, LINEN, 0.95); }   // the pillow
        }

        // ── the five people: where each one is, what they do, and a reason to walk somewhere now and then ──
        function homes(s) {
            const at = geo.at, hurt = s.hurt, hit = s.damaged.quarters;
            return {
                cora: { x: at.chair, act: 'sit', dir: 1 },
                mira: { x: at.map - 11, act: 'console', dir: 1 },
                aris: hurt.vance ? { x: at.bunkR + 9, act: 'tend', dir: -1 } : { x: at.bench + 15, act: 'console', dir: -1 },
                vance: hurt.vance ? { x: at.sleeper, act: 'sleep', dir: -1, feet: at.lowerTop } : { x: at.holdB, act: 'idle', dir: 1, loop: true },
                jaxon: hit ? { x: at.reactor + 14, act: 'tend', dir: -1 } : { x: at.engDesk + 15, act: 'console', dir: -1 },
            };
        }
        function trips(s) {
            const at = geo.at;
            if (s.damaged.quarters) return [
                { id: 'mira', to: at.chair - 14, ms: 5200, dir: 1 },                                  // to the bridge, with a find
                { id: 'jaxon', to: at.broken + 3, ms: 4200, dir: 1 },                                  // to look at the damage
            ];
            return [
                { id: 'mira', to: at.chair - 14, ms: 5200, dir: 1 },
                { id: 'jaxon', to: at.holdA + 30, ms: 4000, dir: 1 },
                { id: 'aris', to: at.locker + 9, ms: 3600, dir: -1 },
            ];
        }
        function makePeople(s, t) {
            const H = homes(s);
            people = Object.keys(NAMES).map((id, i) => {
                const home = H[id], p = { id, home, x: home.x, dir: home.dir, plan: [], cur: null, phase: i * 530 };
                p.cur = { kind: 'act', act: home.act, dir: home.dir, t0: t, until: home.loop ? t + 600 : null };
                return p;
            });
            const aris = people.find(p => p.id === 'aris');
            if (s.hurt.vance) { aris.x = geo.at.map + 20; aris.plan = [{ to: aris.home.x }]; begin(aris, aris.plan.shift(), t); }   // she walks to Vance's bunk
            nextTrip = t + 6000; tripN = 0;
        }
        function begin(p, s, t) {
            if (s.to != null) {
                if (s.to === p.x) { next(p, t); return; }
                p.dir = s.to > p.x ? 1 : -1;
                p.cur = { kind: 'move', act: s.carry ? 'carry' : 'walk', to: s.to, x0: p.x, dir: p.dir, t0: t };
                return;
            }
            p.dir = s.dir || p.dir;
            p.cur = { kind: 'act', act: s.act, dir: p.dir, t0: t, until: s.ms != null ? t + s.ms : null };
        }
        function next(p, t) {
            if (!p.plan.length && p.home.loop) {                                                      // Vance stacks crates in the hold
                const at = geo.at;
                p.plan = p.x <= at.holdB ? [{ to: at.holdA, carry: true }, { act: 'idle', ms: 900, dir: 1 }] : [{ to: at.holdB }, { act: 'idle', ms: 700, dir: -1 }];
            }
            if (!p.plan.length) { p.dir = p.home.dir; p.cur = { kind: 'act', act: p.home.act, dir: p.home.dir, t0: t, until: null }; return; }
            begin(p, p.plan.shift(), t);
        }
        function advance(p, t) {
            for (let guard = 0; guard < 6; guard++) {
                const c = p.cur;
                if (c.kind === 'move') {
                    const steps = Math.floor((t - c.t0) / STEP), nx = c.x0 + c.dir * 2 * steps;
                    if ((c.dir > 0 && nx >= c.to) || (c.dir < 0 && nx <= c.to)) { const done = c.t0 + Math.ceil(Math.abs(c.to - c.x0) / 2) * STEP; p.x = c.to; next(p, done); continue; }
                    p.x = nx; return;
                }
                if (c.until != null && t >= c.until) { next(p, c.until); continue; }
                return;
            }
        }
        function maybeTrip(t) {
            if (t < nextTrip) return;
            const list = trips(st), trip = list[tripN % list.length], p = people.find(q => q.id === trip.id);
            tripN++;
            nextTrip = t + 26000 + hash(tripN, 3, 1) * 8000;
            if (!p || p.plan.length || p.cur.kind !== 'act' || p.cur.until != null) return;
            p.plan = [{ to: trip.to }, { act: 'idle', ms: trip.ms, dir: trip.dir }, { to: p.home.x }, { act: p.home.act, dir: p.home.dir }];
            next(p, t);
        }

        // ── drawing, frame by frame ──
        function starField() {
            const key = `${geo.g.W}x${geo.g.H}`;
            if (stars && stars.key === key) return stars;
            const list = [];
            for (let i = 0; i < 240; i++) { const tier = hash(i, 2, 8); list.push({ x: hash(i, 1, 3) * geo.g.W, y: Math.floor(hash(i, 5, 7) * geo.g.H), speed: tier > 0.93 ? 0.03 : tier > 0.7 ? 0.012 : 0.004, v: 0.35 + 0.55 * hash(i, 9, 2) }); }
            stars = { key, list };
            return stars;
        }
        function drawBackdrop(c, f, t) {
            const P = World.sectorBase();
            if (P) { c.drawImage(P.base, 0, 0); if (P.glow) { const gl = P.glow[Math.floor(t / 500) % P.glow.length]; c.drawImage(gl.canvas, gl.x, gl.y); } }
            else { c.fillStyle = INK; c.fillRect(0, 0, geo.g.W, geo.g.H); }
            A.dimWith(c, 0.62);
            starField().list.forEach(s => {                                                           // we are moving: the stars stream past, to the left
                const x = Math.floor(((s.x - t * s.speed) % geo.g.W + geo.g.W) % geo.g.W), len = s.speed > 0.02 ? 4 : s.speed > 0.01 ? 2 : 1;
                for (let i = 0; i < len; i++) f.tone(x + i, s.y, RP.STAR, s.v * (1 - i / (len + 1)));
            });
        }
        function drawMoving(c, f, t) {
            const at = geo.at, fl = geo.floorY, step = Math.floor(t / STEP), s = st;
            built.glass.forEach(([x, y], i) => { if (((i * 7 + step) % 97) === 0) f.px(x, y, RP.STAR.hex[2]); });   // stars sliding past the glass
            if (s.damaged.quarters && built.off) {                                                    // the quarters' lamp is failing
                const out = hash(step, 7, 3) > 0.74 || (hash(Math.floor(t / 900), 1, 9) > 0.8 && step % 2 === 0);
                if (out) { const x0 = xOf(0.585) + 2, x1 = xOf(0.41) - 2, y0 = Math.floor(edgesAt(0.5)[0]); c.drawImage(built.off, x0, y0, x1 - x0, fl - y0, x0, y0, x1 - x0, fl - y0); }
                if (t % 1400 < 350) { f.glow(xOf(0.41) - 5, ceilAt(0.5) + 2, 3, RP.RED, 0.8); f.px(xOf(0.41) - 5, ceilAt(0.5) + 2, RP.RED.hex[3]); }
                const sp = (t % 1700) / STEP;                                                           // sparks from the broken panel
                if (sp < 6) { const k = Math.floor(sp); f.px(at.broken + (k % 2), ceilAt(0.5) + 2 + k * 2, k < 3 ? RP.AMBER.hex[5] : RP.AMBER.hex[3]); if (k > 1) f.px(at.broken - 2 + k, ceilAt(0.5) + 1 + k * 2, RP.AMBER.hex[2]); }
            }
            const screen = (x0, y0, w, hgt, seed) => { for (let y = 0; y < hgt; y++) for (let x = 0; x < w; x++) f.tone(x0 + x, y0 + y, RP.UI, 0.32 + ((y + step + seed) % 3 === 0 ? 0.3 : 0) + (hash(x + seed, y, Math.floor(t / 375)) > 0.86 ? 0.25 : 0)); };
            screen(xOf(0.105) + 2, fl - 8, 3, 2, 1); screen(xOf(0.105) + 7, fl - 8, 4, 2, 2); screen(xOf(0.105) + 13, fl - 8, 3, 2, 3);
            screen(at.bench + 2, fl - 19, 5, 6, 4); screen(at.engDesk + 2, fl - 19, 4, 6, 5);
            const mx = at.map, my = fl - 22, turn = Math.floor(t / 375) * 0.03;                       // the star map, turning slowly over its table
            for (let i = 0; i < 14; i++) {
                const a = i * 2.39 + turn, len = 3 + (i * 5) % 6;
                for (let d = 1; d <= len; d++) f.tone(mx + Math.cos(a) * d, my + Math.sin(a) * d * 0.55, RP.UI, 0.42 + 0.35 * (d === len ? 1 : 0));
            }
            f.px(mx, my, RP.UI.hex[5]); f.tone(mx, fl - 11, RP.UI, 0.75, 1, 1);
            const low = s.res.energy <= 25, beat = 0.5 + 0.5 * Math.sin(Math.floor(t / STEP) * STEP / (low ? 900 : 480));   // the reactor's core
            const rx = at.reactor, rTop = ceilAt(0.875) + 2;
            for (let y = rTop + 5; y < fl - 6; y++) for (let x = rx - 2; x <= rx + 1; x++) f.tone(x, y, RP.UI, (low ? 0.3 : 0.5) + (low ? 0.2 : 0.35) * beat - (x === rx - 2 ? 0.1 : 0));
            at.pods.forEach((px, i) => { if (i < s.pods && (step + i * 3) % 16 < 8) f.tone(px - 1, fl - 20 + ((step + i * 5) % 14), RP.ICE, 0.6, 3, 1); });
            [geo.cx - 197, geo.cx - 192, geo.cx - 187].forEach((gx, i) => {                          // the gauges' needles twitch; low power, they sag
                const a = -2.4 + (low ? 0.5 : 1.4) + 0.25 * Math.sin(step * 0.7 + i * 2);
                f.px(Math.round(gx + Math.cos(a) * 1.4), Math.round(fl - 30 + Math.sin(a) * 1.4), i === 1 && low ? RP.RED.hex[3] : RP.AMBER.hex[3]);
            });
            if ((step >> 2) % 4 === 0) f.px(geo.cx - 150, fl - 38, RP.RED.hex[3]); else f.px(geo.cx - 150, fl - 38, RP.RED.hex[1]);
            if ((step >> 3) % 3 !== 2) f.px(at.holdB + 8, fl - 36, RP.UI.hex[4]);
            if (hover && hover.kind === 'log') for (let x = at.lectern - 4; x <= at.lectern + 4; x++) { f.tone(x, fl - 18, RP.AMBER, 0.7); }
        }
        function drawPeople(c, t) {
            const CS = window.CrewSprites;
            people.slice().sort((a, b) => (a.cur.act === 'sleep' ? -1 : 0) - (b.cur.act === 'sleep' ? -1 : 0)).forEach(p => {
                const cc = p.cur, act = cc.act, feet = act === 'sleep' && p.home.feet != null ? p.home.feet : geo.feetY;
                const frame = cc.kind === 'move' ? Math.floor((t - cc.t0) / STEP) % 6 : CS ? CS.frameAt(act, t - cc.t0 + p.phase) : 0;
                if (CS && CS.get(p.id)) CS.draw(c, p.id, act, frame, p.x, feet, { dir: p.dir });
                else stand(c, p, feet);
                if (act === 'sit') chairFront(c, p.x);
                if (act === 'sleep') blanket(c, p, frame, feet);
            });
        }
        /** If a costume is missing (its file is being redrawn), a plain warm figure stands in. */
        function stand(c, p, feet) { c.fillStyle = '#c9a27a'; c.fillRect(Math.round(p.x) - 2, feet - 20, 4, 14); c.fillRect(Math.round(p.x) - 2, feet - 24, 4, 4); c.fillStyle = '#3a3f46'; c.fillRect(Math.round(p.x) - 2, feet - 6, 4, 7); }
        function chairFront(c, sx) {
            const fy = geo.feetY;
            c.fillStyle = STEEL.hex[4]; c.fillRect(sx - 5, fy - 4, 8, 1);
            c.fillStyle = STEEL.hex[2]; c.fillRect(sx - 5, fy - 3, 8, 1); c.fillRect(sx - 4, fy - 2, 1, 3); c.fillRect(sx + 1, fy - 2, 1, 3);
        }
        function blanket(c, p, frame, feet) {
            const CS = window.CrewSprites; if (!CS || !CS.get(p.id)) return;
            const tops = new Map();
            CS.pixels(p.id, 'sleep', frame).forEach(([x, y]) => { const X = Math.round(p.x) - x, Y = feet + 1 + y; if (!tops.has(X) || Y < tops.get(X)) tops.set(X, Y); });
            const x0 = Math.round(p.x) - 13, x1 = Math.round(p.x) + 3;
            for (let x = x0; x <= x1; x++) {
                const top = Math.min(tops.has(x) ? tops.get(x) - 1 : feet - 1, feet - 1);
                for (let y = top; y <= feet + 1; y++) { c.fillStyle = BLANKET.hex[Math.max(1, Math.min(4, y === top ? 4 : 3 - Math.floor((y - top) / 2) + (threshold(x, y) > 0.5 ? 0 : -1)))]; c.fillRect(x, y, 1, 1); }
            }
        }

        // ── the words under the rooms, and on the person you point at ──
        function roomWords() {
            const ss = World.shipState();
            const stopsLine = ss.sector === 6 ? (ss.stops > 0 ? `${['No', 'One', 'Two', 'Three'][ss.stops] || ss.stops} more stop${ss.stops === 1 ? '' : 's'} before the light` : 'Only the light is left')
                : ss.stops > 0 ? `${['No', 'One', 'Two', 'Three'][ss.stops] || ss.stops} more stop${ss.stops === 1 ? '' : 's'} before the jump` : 'No stops left · only the jump';
            const food = ss.foodForJumps;
            const lines = {
                quarters: ss.damaged.quarters ? [['Damaged', 'bad']] : [],
                hold: [[`Rations ${ss.res.rations} · ${food > 0 ? `food for ${food} jump${food === 1 ? '' : 's'}` : 'not enough for a jump'}`, food > 0 ? '' : 'bad'], [`Salvage ${ss.res.salvage}`, '']],
                engineering: [[`Energy ${ss.res.energy}`, ss.res.energy <= 25 ? 'low' : ''], [stopsLine, '']],
            };
            ROOMS.forEach(r => {
                const el = document.createElement('div'); el.className = 'room-words';
                const n = document.createElement('p'); n.className = 'rname'; n.textContent = r.name; el.append(n);
                (lines[r.id] || []).forEach(([text, kind]) => { const q = document.createElement('p'); q.className = 'rline' + (kind ? ' is-' + kind : ''); q.textContent = text; el.append(q); });
                const mid = xOf((r.u0 + r.u1) / 2);
                World.word('ship:room:' + r.id, el, { at: () => [mid, hullBottomAt(mid) + 3], side: 'below', gap: 2, view: 'ship', fade: { t0: openT + COVER_FOR + DISSOLVE_MS - 200, inMs: 500, holdMs: 1e9, outMs: 0 } });
            });
        }
        function stateOf(p) {
            if (p.home.act === 'sleep' && st.hurt[p.id]) return { text: 'hurt', bad: true };
            if (p.id === 'aris' && st.hurt.vance && p.cur.act === 'tend') return { text: 'with Vance' };
            if (p.cur.kind === 'move') { const r = roomOfX(p.cur.to); return { text: r ? 'going to the ' + r.name.toLowerCase() : 'walking' }; }
            const r = roomOfX(p.x); return { text: r ? WHERE[r.id] : 'aboard' };
        }
        function showTag(target) {
            World.unwordAll('ship:who');
            if (!target) return;
            const el = document.createElement('div');
            if (target.kind === 'log') {
                el.className = 'who-tag';
                el.innerHTML = '<p class="wname"></p><p class="wstate"></p>';
                el.firstChild.textContent = "The ship's record"; el.lastChild.textContent = 'Click to read';
                World.word('ship:who', el, { at: () => [geo.at.lectern, clearAbove(geo.at.lectern)], side: 'above', gap: 2, view: 'ship', shade: true });
                return;
            }
            const p = people.find(q => q.id === target.id); if (!p) return;
            el.className = 'who-tag tone-' + p.id;
            const n = document.createElement('p'), s = document.createElement('p'), state = stateOf(p);
            n.className = 'wname'; n.textContent = NAMES[p.id]; s.className = 'wstate' + (state.bad ? ' is-bad' : ''); s.textContent = state.text;
            el.append(n, s);
            World.word('ship:who', el, { at: () => [Math.round(p.x), clearAbove(p.x)], side: 'above', gap: 2, view: 'ship', shade: true });
        }
        function pick(cx, cy) {
            const at = geo.at, fl = geo.floorY;
            if (Math.abs(cx - at.lectern) <= 5 && cy >= fl - 20 && cy <= fl - 10) return { kind: 'log' };
            for (let i = people.length - 1; i >= 0; i--) {
                const p = people[i], act = p.cur.act, feet = act === 'sleep' && p.home.feet != null ? p.home.feet : geo.feetY;
                const [w, hgt] = act === 'sleep' ? [14, 9] : act === 'sit' || act === 'tend' ? [7, 19] : [7, 25];
                if (Math.abs(cx - p.x) <= w && cy <= feet + 1 && cy >= feet - hgt) return { kind: 'person', id: p.id };
            }
            return null;
        }
        const insideHull = (cx, cy) => { const u = uOf(cx), e = edgesAt(u); return !!e && u >= -0.01 && u <= 1.01 && cy >= e[0] - 3 && cy <= e[1] + 3; };

        return {
            /** Paints the cut-open hull ahead of time (it takes a moment), so opening the ship never stalls a frame. */
            prepare() { measure(); build(World.shipState()); },
            open(t) {
                measure();
                st = World.shipState();
                built = build(st);
                openT = t; hover = null;
                makePeople(st, t);
                roomWords();
            },
            close() { World.unwordAll('ship'); hover = null; },
            /** Where a voice sits while the ship is open: under the tail of the cut-open hull. */
            anchor() { if (!geo) return null; const x = xOf(0.93); return [x, hullBottomAt(x) + 34]; },
            draw(c, t) {
                if (!geo || !built) return;
                const f = framer(c, geo.g.W, geo.g.H);
                drawBackdrop(c, f, t);
                c.drawImage(built.open, 0, 0);
                drawMoving(c, f, t);
                people.forEach(p => advance(p, t));
                maybeTrip(t);
                drawPeople(c, t);
                const k = clamp01((t - openT - COVER_FOR) / DISSOLVE_MS);                              // the plating falls away through the grain
                if (k < 1) {
                    const o = offscreen(); o.g.clearRect(0, 0, geo.g.W, geo.g.H); o.g.drawImage(built.closed, 0, 0);
                    o.g.globalCompositeOperation = 'destination-in'; o.g.fillStyle = A.pattern(Math.round((1 - Math.floor(k * 8) / 8) * 64)); o.g.fillRect(0, 0, geo.g.W, geo.g.H); o.g.globalCompositeOperation = 'source-over';
                    c.drawImage(o.c, 0, 0);
                }
            },
            hover(cx, cy) {
                const target = pick(cx, cy), same = (hover && target && hover.kind === target.kind && hover.id === target.id) || (!hover && !target);
                if (!same) { hover = target; showTag(target); }
                return !!target && target.kind === 'log';
            },
            click(cx, cy) {
                const target = pick(cx, cy);
                if (target && target.kind === 'log') return 'record';
                return insideHull(cx, cy) || target ? 'inside' : 'outside';
            },
            relayout() { if (!st) return; measure(); built = build(st); makePeople(st, World.now()); World.unwordAll('ship'); hover = null; roomWords(); },
        };
        function offscreen() {
            const W = geo.g.W, H = geo.g.H;
            if (!offscreen.o || offscreen.o.c.width !== W || offscreen.o.c.height !== H) { const cv = document.createElement('canvas'); cv.width = W; cv.height = H; offscreen.o = { c: cv, g: cv.getContext('2d') }; }
            return offscreen.o;
        }
    }

    window.GameShipView = { create };
})();
