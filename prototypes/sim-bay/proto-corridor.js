/* proto-corridor.js — Fly the corridor (reworked).
   One flight, three jumps down the heading: sector 1, then sector 3, then sector 5. The radio logs every transponder it
   picks up: eight, then hundreds, then tens of thousands. Only six dead hulls come close enough to SEE, each the same class
   as EXODUS-9 (nose up, decks, engine bells, as ship.js draws it), and the ship eases off as each one drifts past so you can
   read its number. What you dodge is the debris. Our own ship is the Lab.ship inset: a scrape turns a room red. */
(function () {
    'use strict';
    const Lab = window.Lab, { W, H, C } = Lab;

    const SPEED = 6, FOCAL = 240, ZHIT = 2.8, JUMP_TIME = 1.2, LINE_GAP = 3.4;  // course units/s, px per unit at depth 1, depth where things cross us
    const FAR_HULL = 100, FAR_FRAG = 36, FAR_STAR = 40, SEE_AT = 22, AIM_AT = 20, WARN = 0.9; // draw distances, where a hull is identified, where debris sets its course, warning (s)
    const VX = 160, VY = 80, BX = 3.2, BY = 2, MAXV = [5, 3.5];               // vanishing point, steering box half-size, steering speed
    const SHIP_R = [0.45, 0.25], BOX = SHIP_R.map(r => Math.round(r * FOCAL / ZHIT)); // our half-size; the brackets where things cross us
    const HULL_L = 1.2, HW = 0.33, DECKS = [0.624, 0.323, 0.022, -0.278, -0.579], STERN = -0.88; // EXODUS class: half-length (our size), and in half-lengths: half-width, decks, stern
    const LEGS = [
        { sector: 1, dur: 11, nums: [[1, 7], [1, 7]], heard: 8, curve: 1.2, debris: 12, aim: 0.3, glow: 2, broken: 0.3, beacon: 0.6 },
        { sector: 3, dur: 12, nums: [[200, 599], [600, 999]], heard: 650, curve: 1.6, debris: 22, aim: 0.25, glow: 3, broken: 0.6, beacon: 0.4 },
        { sector: 5, dur: 14, nums: [[2000, 9999], [10000, 21000]], heard: 22400, curve: 2.2, debris: 34, aim: 0.2, glow: 5, broken: 0.8, beacon: 0.3 },
    ];
    const ONES = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split(' ');
    const TENS = ['twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
    const words = n => (n < 20 ? ONES[n] : TENS[Math.floor(n / 10) - 2] + (n % 10 ? '-' + ONES[n % 10] : ''));
    const cap = s => s[0].toUpperCase() + s.slice(1);
    const fmt = n => n.toLocaleString('en-US');
    // Crew lines per leg, each said once: when this leg has shown enough hulls and the radio has heard enough.
    const LINES = [
        [{ seen: 1, who: 'Jaxon', say: () => "That's one of the eight." },
            { heard: 8, who: 'Aris', say: () => "Eight beacons. That's every ship they told us about." }],
        [{ heard: 20, who: 'Mira', say: () => "That can't be right. They told us eight." },
            { seen: 1, who: 'Vance', say: (g, leg) => 'Hull ' + fmt(leg.hulls[0].num) + ". We're hull nine." },
            { seen: 2, who: 'Jaxon', say: () => "That one's been dead about a hundred years." }],
        [{ seen: 1, who: 'Mira', say: () => "That one's been out here about two hundred years." },
            { heard: 2000, who: 'Aris', say: () => "I've been writing every ship down. I can't keep up." },
            { seen: 2, heard: 12000, who: 'Vance', say: g => cap(words(Math.floor(g.heard / 1000))) + ' thousand beacons. So where are all the ships?' }],
    ];

    const u32 = hex => { const n = parseInt(hex.slice(1), 16); return (0xff000000 | ((n & 0xff) << 16) | (n & 0xff00) | (n >> 16)) >>> 0; };
    const P = Object.fromEntries(Object.entries(C).map(([k, v]) => [k, u32(v)]));
    const RAMP = Lab.ship.HULL_RAMP.map(u32);                               // the main screen's hull colours, so the wrecks read as our class
    const ramp = (g, x, y) => { const pos = Lab.clamp(g, 0, 1) * 5, lo = Math.floor(pos); return RAMP[Math.min(5, pos - lo > Lab.bayer(x, y) ? lo + 1 : lo)]; };
    const hash = (n, s) => { const h = Math.imul(Math.imul(n, 374761393) ^ s, 1274126177); return ((h ^ (h >>> 15)) & 1023) / 1023; };

    /** Half-width of an EXODUS-class hull at u: the rounded nose over the bridge, the taper at the stern (as ship.js). */
    const hwAt = u => (u > DECKS[0] ? HW * (0.3 + 0.7 * Math.sin(((1 - u) / (1 - DECKS[0])) * Math.PI / 2))
        : u < DECKS[4] ? HW * (1 - 0.22 * (DECKS[4] - u) / (DECKS[4] - STERN)) : HW);
    /** 0 empty, 1 plating, 2 a deck seam. u runs stern (-1) to nose (+1), v across; px is half a pixel in these units. */
    function hullAt(h, u, v, px) {
        if (u > 1 || u < -1) return 0;
        const av = Math.abs(v), jag = h.cut ? hash(Math.floor(v * 40) + 64, h.seed) * 0.1 : 0;
        if (h.cut === 1 && u > h.deck - 0.03 - jag && u < h.deck + 0.08 + jag) return 0;  // torn in two at a deck
        if (h.cut === 2 && u > h.deck + jag) return 0;                                     // the front half gone
        if (h.cut === 3 && u < h.deck - jag) return 0;                                     // the back half gone
        if (u < STERN) return Math.abs(av - HW * 0.4) < HW * 0.16 ? 1 : 0;                 // engine bells
        const hw = hwAt(u);
        if (av > hw) return 0;
        return px < 0.04 && av < hw - px * 2 && DECKS.some(d => Math.abs(u - d) < px) ? 2 : 1;
    }
    /** A torn plate: four straight edges round the centre (inside one of the four triangles they make with it). */
    const crs = (ax, ay, bx, by) => ax * by - ay * bx;
    function shardAt(f, u, v) {
        return f.pts.some(([ax, ay], i) => {
            const [bx, by] = f.pts[(i + 1) % 4];
            return crs(ax, ay, u, v) >= 0 && crs(bx - ax, by - ay, u - ax, v - ay) >= 0 && crs(-bx, -by, u - bx, v - by) >= 0;
        }) ? 1 : 0;
    }
    const plate = r => [0, 1, 2, 3].map(k => { const a = k * 1.571 + (r() - 0.5) * 0.9, d = 0.45 + r() * 0.55; return [Math.cos(a) * d, Math.sin(a) * d * 0.6]; });

    /** A dead hull drifting nose up beside the corridor, just outside where we can steer. */
    function makeHull(cfg, r, num, at, side) {
        const cut = r() < cfg.broken ? 1 + Math.floor(r() * 3) : 0, deck = DECKS[1 + Math.floor(r() * 3)];
        return {
            num, at, cut, deck, a0: -Math.PI / 2 + (r() - 0.5) * (cut ? 0.8 : 0.5), spin: (r() - 0.5) * 0.05, ph: r() * 6.28, seed: (r() * 1e9) | 0,
            x: side * (4.5 + r() * 0.5), y: -r() * 1.2,                        // level or a little above us, clear of the ship panel
            beacon: r() < cfg.beacon, bu: cut === 2 ? deck - 0.3 : cut === 3 ? deck + 0.3 : 0.8, seenAt: -1,
        };
    }
    /** Loose debris down the leg (some of it will set a course for wherever we are) and a cloud round each hull. None on the safe line. */
    function makeDebris(cfg, r, path, hulls) {
        const out = [];
        const add = (at, x, y, rad, aimed) => {
            const [px, py] = path(at), keep = SHIP_R[0] + rad + 0.15, dx = x - px, dy = y - py, d = Math.hypot(dx, dy);
            if (d < keep) { x = px + (d ? dx / d : 1) * keep; y = py + (d ? dy / d : 0) * keep; }
            out.push({ at, x, y, vx: 0, vy: 0, rad, aimed, a0: r() * 6.28, spin: (r() - 0.5) * 5, flip: 0.5 + r() * 3, pts: plate(r), done: false });
        };
        for (let i = 0; i < cfg.debris; i++) {
            const inBox = r() < 0.65, at = 2 + r() * (cfg.dur - 2.6);
            add(at, (r() * 2 - 1) * (inBox ? BX + 0.5 : 7), (r() * 2 - 1) * (inBox ? BY + 0.4 : 4.5), 0.1 + r() * r() * 0.3, inBox && at > 3.2 && r() < cfg.aim);
        }
        hulls.forEach(h => {
            for (let i = 0; i < 12; i++) { const a = r() * 6.28, d = HULL_L * (0.6 + r() * 1.3); add(h.at + (r() - 0.5) * 1.4, h.x + Math.cos(a) * d, h.y + Math.sin(a) * d, 0.06 + r() * 0.16, false); }
        });
        return out.sort((a, b) => a.at - b.at);
    }
    /** One leg: a smooth safe line (the one A.U.R.A. flies), two hulls, their debris, and what the radio will have heard by the end. */
    function makeLeg(i, r, from) {
        const cfg = LEGS[i], ph = [0, 1, 2, 3].map(() => r() * 6.28);
        const path = t => [2 * Math.sin(0.45 * t + ph[0]) + 0.8 * Math.sin(1.1 * t + ph[1]), Math.sin(0.6 * t + ph[2]) + 0.4 * Math.sin(1.3 * t + ph[3])];
        const nums = [];
        cfg.nums.forEach(([lo, hi]) => { let n; do n = lo + Math.floor(r() * (hi - lo + 1)); while (nums.includes(n)); nums.push(n); });
        let side = r() < 0.5 ? -1 : 1;
        const hulls = nums.sort((a, b) => a - b).map((num, k) => makeHull(cfg, r, num, cfg.dur * (0.4 + 0.36 * k) + (r() - 0.5) * 0.6, side = -side));
        const to = cfg.heard < 20 ? cfg.heard : Math.round(cfg.heard * (0.97 + r() * 0.06));
        return { cfg, path, hulls, frags: makeDebris(cfg, r, path, hulls), from, to, seen: 0, lines: LINES[i].map(l => ({ ...l })) };
    }

    function mount(ctx, ui) {
        const img = ctx.createImageData(W, H), buf = new Uint32Array(img.data.buffer), depth = new Float32Array(W * H);
        const put = (x, y, c) => { if (x >= 0 && x < W && y >= 0 && y < H) buf[y * W + x] = c; };
        const dput = (x, y, tone, c) => { if (Lab.on(x, y, tone)) put(x, y, c); };
        const starR = Lab.rng(99), newStar = far => ({ x: (starR() * 2 - 1) * 30, y: (starR() * 2 - 1) * 18, z: far ? FAR_STAR : 1 + starR() * (FAR_STAR - 1) });
        const stars = Array.from({ length: 50 }, () => newStar(false));
        const ship = Lab.ship.layout(6, 116, 20, 44), ROOM_KEYS = Lab.ship.ROOMS.map(r => r.key);
        let mode = 'ready', li = 0, leg = null, g = null, t = 0, phaseT = 0, clock = 0, legAt = -9, whiteAt = -9, rowAt = 0, runs = 0;
        let auto = false, cam = [0, 0], vel = [0, 0], jolt = 0, nearT = 0, threat = false, pointer = null, queue = [], nextLine = 0;
        const taps = new Map(), STEER = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'd', 'w', 's'];

        // ── flow: ready → run (three legs, a jump after each) → done ──
        const row = defs => {  // a second click of a double click must not land on the button that replaces the first
            rowAt = clock;
            ui.buttons(defs.map(d => ({ ...d, onClick: () => { if (clock - rowAt > 0.3) d.onClick(); } })));
        };
        const say = (who, line, gap) => { ui.say(who, line); nextLine = clock + gap; };
        const talk = (who, line) => queue.push({ who, line });

        function toReady() {
            mode = 'ready';
            say('A.U.R.A.', 'Debris on the heading, Commander. I can fly us through, if you prefer.', 0);
            row([{ label: 'Fly it myself', primary: true, onClick: () => start(false) }, { label: 'Let A.U.R.A. fly', onClick: () => start(true) }]);
        }
        function start(isAuto) {
            runs++;
            g = { heard: 0, heardAt: -9, seen: 0, seenAt: -9, hits: 0, damaged: {}, nums: [], r: Lab.rng(runs * 104729 + 7) };
            cam = [0, 0]; vel = [0, 0]; jolt = 0; nearT = 0;
            beginLeg(0);
            setAuto(isAuto);
        }
        function beginLeg(i) { li = i; leg = makeLeg(i, g.r, g.heard); t = 0; mode = 'run'; legAt = clock; queue = []; }
        function setAuto(on) {
            auto = on;
            say('A.U.R.A.', on ? 'I have the ship, Commander.' : 'You have the ship, Commander.', 2);
            row([{ label: on ? 'Take the stick' : 'Let A.U.R.A. fly', primary: on, onClick: () => setAuto(!auto) }]);
        }
        function finish() {
            mode = 'done'; phaseT = 0; queue = []; nextLine = clock + 2.8;
            talk('A.U.R.A.', "We're through, Commander. Four crew, no injuries.");
            row([{ label: 'Run it again', primary: true, onClick: () => start(false) }]);
        }

        // ── simulation ──
        function input() {   // a key counts while held, and for a moment after any press, so a quick tap between frames still steers
            const has = (...ks) => (ks.some(k => Lab.keys.has(k) || (taps.get(k) || 0) > clock) ? 1 : 0);
            let ix = has('ArrowRight', 'd') - has('ArrowLeft', 'a'), iy = has('ArrowDown', 's') - has('ArrowUp', 'w');
            if (pointer) {
                const dx = pointer.x - VX, dy = pointer.y - VY;
                if (Math.abs(dx) > 5) ix += Lab.clamp(dx / 40, -1, 1);
                if (Math.abs(dy) > 5) iy += Lab.clamp(dy / 25, -1, 1);
            }
            return [Lab.clamp(ix, -1, 1), Lab.clamp(iy, -1, 1)];
        }
        /** The ship eases off while a hull drifts past, so you can read it: slowest when the hull is about 11 units out. */
        const paceAt = tt => 1 - 0.6 * Math.max(0, ...leg.hulls.map(h => {
            const p = Lab.clamp(1 - Math.abs((h.at - tt) * SPEED + ZHIT - 11) / 8, 0, 1);
            return p * p * (3 - 2 * p);
        }));
        function fly(dt, stick, pace) {
            if (auto && mode === 'run' && (stick[0] || stick[1])) setAuto(false);      // touching the controls takes the ship back
            if (auto && mode === 'run') {                                                // A.U.R.A. follows the safe line exactly
                const p = leg.path(t), q = leg.path(t + 0.05);
                vel = [0, 1].map(i => Lab.clamp((q[i] - p[i]) / 0.05 * pace + (p[i] - cam[i]) * 6, -MAXV[i], MAXV[i]));
            } else vel = vel.map((v, i) => v + (stick[i] * MAXV[i] - v) * Math.min(1, dt * 7));
            cam = cam.map((c, i) => Lab.clamp(c + vel[i] * dt, -(i ? BY : BX), i ? BY : BX));
        }
        function reach(f) {                                                              // a fragment reaches our plane: does it touch us?
            f.done = true;
            const e = ((cam[0] - f.x) / (SHIP_R[0] + f.rad)) ** 2 + ((cam[1] - f.y) / (SHIP_R[1] + f.rad)) ** 2;
            if (e < 1 && !auto) {
                g.hits++; jolt = 0.4;
                const free = ROOM_KEYS.filter(k => !g.damaged[k]);
                if (free.length) g.damaged = { ...g.damaged, [free[Math.floor(g.r() * free.length)]]: true };
            } else if (e < 2.4) nearT = 0.3;
        }
        function drift(f, dt, pace) {                                                    // some debris sets a course for wherever we are
            const left = f.at - t;
            if (f.aimed && (left * SPEED + ZHIT) < AIM_AT) {
                f.aimed = false;
                if (!auto) { f.vx = (cam[0] + (g.r() - 0.5) * 1.6 - f.x) / left; f.vy = (cam[1] + (g.r() - 0.5) * 0.9 - f.y) / left; } // about half would hit a ship that sat still
            }
            f.x += f.vx * dt * pace; f.y += f.vy * dt * pace;
        }
        function listen() {                                                              // transponders coming in, faster and faster
            const x = Math.min(1, t / (leg.cfg.dur * 0.9)), v = leg.from + (leg.to - leg.from) * x ** leg.cfg.curve;
            const heard = x >= 1 ? leg.to : Math.min(leg.to, Math.floor(leg.to < 20 ? v : v * (0.985 + Math.random() * 0.03)));
            if (heard > g.heard) { g.heard = heard; g.heardAt = clock; }
        }
        function update(dt) {
            clock += dt; jolt = Math.max(0, jolt - dt); nearT = Math.max(0, nearT - dt);
            if (queue.length && clock >= nextLine) { const q = queue.shift(); say(q.who, q.line, LINE_GAP); }
            const stick = input();
            if (mode === 'ready' && (stick[0] || stick[1])) start(false);               // steering from the start screen just goes
            let pace = 1;
            if (mode === 'run') {
                pace = paceAt(t); t += dt * pace;
                leg.frags.forEach(f => { if (!f.done) { drift(f, dt, pace); if (f.at <= t) reach(f); } });
                leg.hulls.forEach(h => {
                    if (h.seenAt >= 0 || (h.at - t) * SPEED + ZHIT >= SEE_AT) return;
                    h.seenAt = clock; leg.seen++; g.seen++; g.seenAt = clock; g.nums.push(h.num);
                });
                listen();
                leg.lines.forEach(l => { if (!l.done && leg.seen >= (l.seen || 0) && g.heard >= (l.heard || 0)) { l.done = true; talk(l.who, l.say(g, leg)); } });
                if (t >= leg.cfg.dur) { mode = 'jump'; phaseT = 0; }
            } else if (mode === 'jump' || mode === 'done') {
                phaseT += dt;
                if (mode === 'jump' && phaseT >= JUMP_TIME) { whiteAt = clock; if (li < LEGS.length - 1) beginLeg(li + 1); else finish(); }
            }
            fly(dt, mode === 'run' ? stick : [0, 0], pace);
            const mul = mode === 'run' ? pace : mode === 'jump' ? 1 + (phaseT / JUMP_TIME) ** 2 * 9 : 0.15;
            for (let i = 0; i < stars.length; i++) { stars[i].z -= SPEED * mul * dt; if (stars[i].z < 0.6) stars[i] = newStar(true); }
            return mul;
        }

        // ── drawing ──
        const project = (x, y, z, o) => { const k = FOCAL / z; return [Math.round(VX + o[0] + (x - cam[0]) * k), Math.round(VY + o[1] + (y - cam[1]) * k)]; };
        function seg(x0, y0, x1, y1, c) {
            const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
            let err = dx + dy;
            for (let i = 0; i < 400; i++) {
                put(x0, y0, c);
                if (x0 === x1 && y0 === y1) break;
                const e2 = 2 * err;
                if (e2 >= dy) { err += dy; x0 += sx; }
                if (e2 <= dx) { err += dx; y0 += sy; }
            }
        }
        function drawLight(o) {  // the light at the end of the heading, far ahead: a little larger each leg
            const r = LEGS[li].glow;
            for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
                const d = Math.hypot(x, y) / r;
                if (d <= 1) dput(VX + o[0] + x, VY + o[1] + y, 0.5 * (1 - d) + 0.05, d < 0.3 ? P.white : P.bone);
            }
        }
        function drawStars(mul, o) {
            const tail = 0.25 + mul * 0.5;
            for (const s of stars) {
                const a = project(s.x, s.y, s.z, o), b = project(s.x, s.y, s.z + tail, o);
                if (a[0] < -60 || a[0] > W + 60 || a[1] < -60 || a[1] > H + 60) { s.z = 0; continue; }
                seg(b[0], b[1], a[0], a[1], s.z < 8 ? P.bone : s.z < 22 ? P.boneD : P.line2);
            }
        }
        /** Fill a shape centred on (sx, sy), turned by a; inside(u, v) works in units of `unit` px. paint(px, py, kind, lean) colours
            each pixel: kind 0 inside, 1 the edge facing the light, 2 the far edge, 3 a deck seam; lean is -0.5..0.5 towards the light. */
        function raster(sx, sy, R, unit, a, inside, z, paint) {
            const ca = Math.cos(a), sa = Math.sin(a), inv = 1 / unit, ll = Math.hypot(VX - sx, VY - sy) || 1;
            const lx = Math.round((VX - sx) / ll), ly = Math.round((VY - sy) / ll) || (lx ? 0 : -1);
            const shape = (px, py) => { const dx = (px - sx) * inv, dy = (py - sy) * inv; return inside(dx * ca + dy * sa, dy * ca - dx * sa); };
            for (let py = Math.max(0, Math.floor(sy - R)); py <= Math.min(H - 1, Math.ceil(sy + R)); py++) {
                for (let px = Math.max(0, Math.floor(sx - R)); px <= Math.min(W - 1, Math.ceil(sx + R)); px++) {
                    const s = shape(px, py);
                    if (!s) continue;
                    buf[py * W + px] = P.ink2; depth[py * W + px] = z;
                    paint(px, py, s === 2 ? 3 : !shape(px + lx, py + ly) ? 1 : !shape(px - lx, py - ly) ? 2 : 0, ((px - sx) * lx + (py - sy) * ly) / (R * 2));
                }
            }
        }
        function beacon(bx, by, size) {
            const cx = Math.round(bx), cy = Math.round(by), r = Math.min(4, 1 + Math.floor(size));
            for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) { const d = Math.hypot(x, y) / r; if (d <= 1) dput(cx + x, cy + y, 0.3 * (1 - d), P.red); }
            put(cx, cy, P.red);
        }
        function brackets(cx, cy, rx, ry, c) {
            const x0 = Math.round(cx - rx), x1 = Math.round(cx + rx), y0 = Math.round(cy - ry), y1 = Math.round(cy + ry);
            for (const [ex, ey, dx, dy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) {
                for (let i = 0; i < 4; i++) { put(ex + i * dx, ey, c); put(ex, ey + i * dy, c); }
            }
        }
        function drawHull(h, z, k, sx, sy, tags) {
            const unit = HULL_L * k, R = unit * 1.1, fog = Lab.clamp(1.3 - z / FAR_HULL, 0.2, 1), a = h.a0 + h.spin * t;
            const blink = h.beacon && Math.sin(clock * 2.2 + h.ph) > 0.75, cx = Math.round(sx), cy = Math.round(sy);
            if (R < 2.5) { dput(cx, cy, fog + 0.3, R < 1.2 ? P.line2 : P.boneD); if (blink) put(cx, cy, P.red); return; }
            const ca = Math.cos(a), sa = Math.sin(a), px = 0.5 / unit, dim = 0.45 + 0.55 * fog;   // dead: the plating of our own ship, unlit
            raster(sx, sy, R, unit, a, (u, v) => hullAt(h, u, v, px), z,
                (x, y, kind, lean) => put(x, y, ramp(([0.42, 0.74, 0.3, 0.2][kind] + (kind ? 0 : 0.16 * lean)) * dim, x, y)));
            if (blink) { const bv = hwAt(h.bu); beacon(sx + (h.bu * ca - bv * sa) * unit, sy + (h.bu * sa + bv * ca) * unit, unit * 0.06); }
            if (h.seenAt < 0) return;
            const since = clock - h.seenAt;
            if (since < 1.6 && Math.floor(since * 5) % 2 === 0) brackets(sx, sy, (Math.abs(ca) + Math.abs(sa) * HW) * unit + 3, (Math.abs(sa) + Math.abs(ca) * HW) * unit + 3, P.green);
            if (sx > 8 && sx < W - 8) tags.push({ z, s: 'EXODUS-' + fmt(h.num), sx, sy: sy - (Math.abs(sa) + Math.abs(ca) * HW) * unit - 9 });
        }
        function drawFrag(f, z, k, sx, sy) {
            const R = f.rad * k, fog = Lab.clamp(1.3 - z / FAR_FRAG, 0.15, 1);
            if (R < 1.3) { dput(Math.round(sx), Math.round(sy), fog + 0.2, f.threat ? P.amber : R < 0.7 ? P.line2 : P.boneD); return; }
            const sq = 0.3 + 0.7 * Math.abs(Math.cos(f.flip * t + f.a0));          // tumbling: the plate turns edge-on and back
            raster(sx, sy, R + 1, R, f.a0 + f.spin * t, (u, v) => shardAt(f, u, v / sq), z, (x, y, kind, lean) => {
                if (kind === 1) dput(x, y, fog, f.threat ? P.amber : P.bone);
                else if (kind === 2) dput(x, y, fog * 0.6, P.greenD);
                else dput(x, y, fog * Lab.clamp(0.3 + lean, 0.06, 0.75), P.line2);
            });
        }
        function drawField(o) {
            const vis = [], tags = [];
            threat = false;
            leg.hulls.forEach(h => { const z = (h.at - t) * SPEED + ZHIT; if (z > 0.5 && z < FAR_HULL) vis.push([z, h, true]); });
            leg.frags.forEach(f => {
                const z = (f.at - t) * SPEED + ZHIT, left = f.at - t;
                if (f.done || z < 0.6 || z > FAR_FRAG) return;
                f.threat = !auto && left < WARN && ((cam[0] - f.x - f.vx * left) / (SHIP_R[0] + f.rad)) ** 2 + ((cam[1] - f.y - f.vy * left) / (SHIP_R[1] + f.rad)) ** 2 < 1;
                threat = threat || f.threat;
                vis.push([z, f, false]);
            });
            vis.sort((p, q) => q[0] - p[0]);
            for (const [z, w, isHull] of vis) {
                const k = FOCAL / z, sx = VX + o[0] + (w.x - cam[0]) * k, sy = VY + o[1] + (w.y - cam[1]) * k;
                if (isHull) drawHull(w, z, k, sx, sy, tags); else drawFrag(w, z, k, sx, sy);
            }
            return tags;
        }
        function drawFrame() {
            for (const [y0, y1, edge] of [[0, 12, 11], [166, H, 166]]) {  // instrument bands, top and bottom
                for (let y = y0; y < y1; y++) for (let x = 0; x < W; x++) put(x, y, y === edge && x % 2 ? P.line2 : P.ink);
            }
            for (let y = 112; y < 164; y++) for (let x = 2; x < 30; x++) {  // the panel behind our own ship
                put(x, y, y === 112 || y === 163 || x === 2 || x === 29 ? (jolt > 0 ? P.red : P.line2) : P.ink);
            }
            if (mode === 'ready' || mode === 'run') brackets(VX, VY, BOX[0], BOX[1], jolt > 0 ? P.red : threat ? P.amber : nearT > 0 ? P.greenBr : P.greenD);
            const prog = mode === 'run' ? t / leg.cfg.dur : mode === 'jump' || mode === 'done' ? 1 : 0;
            for (let x = 80; x <= 294; x++) { const lit = x - 80 < prog * 214; put(x, 5, lit ? P.green : P.line); put(x, 6, lit ? P.greenD : P.line); }
        }
        function drawOverlays() {
            if (jolt > 0) {
                for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
                    const e = Math.min(x, y, W - 1 - x, H - 1 - y);
                    if (e < 7) dput(x, y, jolt * 1.6 * (1 - e / 7), P.red);
                }
            }
            // the jump: stars stretch, then one short flash that clears as the next sector opens
            const white = mode === 'jump' ? Lab.clamp((phaseT - JUMP_TIME + 0.3) / 0.25, 0, 1) : Lab.clamp(1 - (clock - whiteAt) / 0.4, 0, 1);
            if (white > 0) for (let y = 12; y < 166; y++) for (let x = 0; x < W; x++) dput(x, y, white * 1.6 - Math.hypot(x - VX, y - VY) / 200, P.bone);
            if (mode === 'done' && phaseT > 0.3) {
                for (let y = 24; y <= 108; y++) for (let x = 44; x <= 276; x++) put(x, y, y === 24 || y === 108 || x === 44 || x === 276 ? P.line2 : P.ink);
            }
        }
        const centred = (s, cx, y, c, sc = 1) => Lab.text(ctx, s, Math.round(cx - Lab.textWidth(s, sc) / 2), y, c, sc);
        function drawTags(tags) {
            const placed = [];
            for (const tag of tags.sort((p, q) => p.z - q.z)) {           // nearest first gets the space
                const tw = Lab.textWidth(tag.s);
                const x = Math.round(Lab.clamp(tag.sx - tw / 2, 1, W - tw - 1)), y = Math.round(Lab.clamp(tag.sy, 15, 158));
                if (placed.some(p => x < p[0] + p[2] + 3 && x + tw + 3 > p[0] && y < p[1] + 8 && y + 8 > p[1])) continue;
                if ([0, 0.5, 1].some(f => depth[(y + 2) * W + Math.round(x + tw * f)] < tag.z - 0.3)) continue;  // hidden behind something nearer
                placed.push([x, y, tw]);
                ctx.fillStyle = C.ink; ctx.fillRect(x - 1, y - 1, tw + 2, 7);
                Lab.text(ctx, tag.s, x, y, tag.z < 16 ? C.bone : C.boneD);
            }
        }
        function drawHud() {
            const hs = fmt(g ? g.heard : 0), seen = String(g ? g.seen : 0), nw = Lab.textWidth(hs, 2);
            Lab.text(ctx, 'EXODUS-9', 4, 3, C.green);
            Lab.text(ctx, 'SECTOR ' + LEGS[li].sector, 42, 3, C.boneD);
            Lab.text(ctx, 'JUMP', W - 4 - Lab.textWidth('JUMP'), 3, mode === 'jump' ? C.greenBr : C.boneD);
            Lab.text(ctx, 'SHIPS SEEN', 4, 171, C.boneD);
            Lab.text(ctx, seen, 47, 168, g && clock - g.seenAt < 1.2 ? C.greenBr : C.bone, 2);
            Lab.text(ctx, hs, W - 4 - nw, 168, g && clock - g.heardAt < 0.35 ? C.greenBr : C.bone, 2);
            Lab.text(ctx, 'BEACONS HEARD', W - 9 - nw - Lab.textWidth('BEACONS HEARD'), 171, C.boneD);
            if (auto && (mode === 'run' || mode === 'jump')) centred('A.U.R.A. FLYING', 116, 171, C.green);
            if (mode === 'ready') { centred('STEER CLEAR OF THE DEBRIS', VX, 112, C.bone); centred('ARROWS, WASD, OR HOLD THE MOUSE', VX, 121, C.boneD); }
            if (mode === 'run' && clock - legAt > 0.3 && clock - legAt < 2.7) {    // once the jump flash has cleared
                if (li) centred('TWO JUMPS LATER', VX, 24, C.boneD);
                centred('SECTOR ' + LEGS[li].sector, VX, 32, C.bone, 2);
            }
            if (mode === 'done' && phaseT > 0.3) {
                centred('JUMP COMPLETE', VX, 31, C.green, 2);
                [['8', 'IN THE BRIEFING', 92], [hs, 'BEACONS HEARD', 160], [seen, 'SHIPS SEEN', 228]].forEach(([n, label, x], i) => {
                    if (phaseT < 0.8 + i * 0.6) return;                            // told, heard, seen: one at a time
                    centred(n, x, 50, i === 1 ? C.greenBr : C.bone, 3); centred(label, x, 69, C.boneD);
                });
                if (phaseT < 2.4) return;
                centred('EXODUS-' + fmt(Math.min(...g.nums)) + ' TO EXODUS-' + fmt(Math.max(...g.nums)), VX, 84, C.boneD);
                centred(g.hits ? g.hits + (g.hits === 1 ? ' SCRAPE' : ' SCRAPES') : 'NO SCRAPES', VX, 96, g.hits ? C.amber : C.boneD);
            }
        }
        function render(mul) {
            const o = jolt > 0 ? [Math.round((Math.random() - 0.5) * 10 * jolt), Math.round((Math.random() - 0.5) * 8 * jolt)] : [0, 0];
            buf.fill(P.void); depth.fill(1e9);
            drawLight(o);
            drawStars(mul, o);
            const tags = leg && (mode === 'run' || mode === 'jump') ? drawField(o) : [];
            drawFrame();
            drawOverlays();
            ctx.putImageData(img, 0, 0);
            Lab.ship.draw(ctx, ship, clock * 1000, { damaged: g ? g.damaged : {}, labels: false });
            if (mode === 'run') drawTags(tags);
            drawHud();
        }

        // ── input wiring ──
        ui.canvas.onpointerdown = e => {
            pointer = ui.toPixel(e);
            try { ui.canvas.setPointerCapture(e.pointerId); } catch (_) { /* capture is optional */ }
            if (mode === 'ready') start(false);
        };
        ui.canvas.onpointermove = e => { if (pointer) pointer = ui.toPixel(e); };
        ui.canvas.onpointerup = () => { pointer = null; };
        const release = () => { pointer = null; };
        window.addEventListener('pointerup', release);
        window.addEventListener('pointercancel', release);
        Lab.onKey((k, e) => {
            const target = (e && e.target) || {}, isGameKey = STEER.includes(k) || k === ' ' || k === 'Enter';
            // our own entry in the sketch list keeps focus after you pick it: its keys belong to the game, not to reopening the sketch
            const isOwnPick = target.classList && target.classList.contains('pick') && target.dataset.id === 'corridor';
            if (isOwnPick && isGameKey) e.preventDefault();
            if (STEER.includes(k)) { taps.set(k, clock + 0.12); return; }
            if (!isGameKey || (target.tagName === 'BUTTON' && !isOwnPick)) return;  // a focused button handles its own
            if (mode === 'ready' || (mode === 'done' && phaseT > 2)) start(false);
        });

        toReady();
        render(0.15);
        Lab.loop(dt => render(update(dt)), 30);
        return () => { window.removeEventListener('pointerup', release); window.removeEventListener('pointercancel', release); queue = []; };
    }

    Lab.register({
        id: 'corridor', badge: 'reworked',
        name: 'Fly the corridor',
        short: 'Hear thousands, see a few',
        verb: 'Steer through the debris on three jumps down the heading, while the radio counts every transponder it hears.',
        serves: 'Told eight ships went before: the radio hears tens of thousands, but only a handful ever come close enough to see.',
        replaces: 'The timing bar used for jumps today.',
        controls: 'Arrows or WASD to steer · or hold the mouse on the picture · Space starts',
        mount,
    });
})();
