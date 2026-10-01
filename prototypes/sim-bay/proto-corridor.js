/* proto-corridor.js — Fly the corridor (reworked).
   A forward view down the heading. The radio counts every transponder it picks up: eight in sector 1, hundreds in
   sector 3, tens of thousands in sector 5. But only a few dead hulls ever come close enough to SEE, and they drift
   past slowly: same class as EXODUS-9 (the outline ship.js draws), tagged with their hull numbers. What you dodge
   is the debris around each wreck. The world goes into its own pixel buffer; readouts go on top with Lab.text. */
(function () {
    'use strict';
    const Lab = window.Lab, { W, H, C } = Lab;

    const DUR = 25, JUMP_TIME = 1.3, SPEED = 6, FOCAL = 240, ZHIT = 2.8;      // seconds, depth units/s, px per unit at depth 1, where things cross us
    const FAR_HULL = 100, FAR_FRAG = 36, FAR_STAR = 40, SEE_AT = 32, LINE_GAP = 3.4; // draw distances; a hull counts as seen inside SEE_AT
    const VX = 160, VY = 80, BX = 3.2, BY = 2, MAXV = [5, 3.5], HULL_MAX = 10;   // vanishing point, steering box half-size, steering speed
    const SHIP_R = [0.45, 0.25], BOX = SHIP_R.map(r => Math.round(r * FOCAL / ZHIT)); // our half-size; the brackets where things cross us
    const HW = 0.33, DECKS = [0.624, 0.323, 0.022, -0.278, -0.579], STERN = -0.88;    // EXODUS class, in half-lengths: half-width, deck lines, stern
    const SECTORS = {
        1: { hulls: 2, lo: 1, hi: 8, heard: 8, curve: 1.3, frags: 16, beacon: 0.5, broken: 0.3, glow: 2 },
        3: { hulls: 5, lo: 212, hi: 980, heard: 640, curve: 2, frags: 14, beacon: 0.4, broken: 0.6, glow: 3 },
        5: { hulls: 11, lo: 9000, hi: 22000, heard: 22400, curve: 2.6, frags: 12, beacon: 0.3, broken: 0.8, glow: 5 },
    };
    const ONES = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split(' ');
    const TENS = ['twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
    const words = n => (n < 20 ? ONES[n] : TENS[Math.floor(n / 10) - 2] + (n % 10 ? '-' + ONES[n % 10] : ''));
    const cap = s => s[0].toUpperCase() + s.slice(1);
    // Crew lines, each said once: when the radio has heard enough, or when you have seen a hull.
    const LINES = {
        1: [{ seen: 1, who: 'Jaxon', say: () => "There's one of the eight." },
            { heard: 8, who: 'Aris', say: () => 'All eight ships are here. None of them got any further than this.' }],
        3: [{ heard: 9, who: 'Mira', say: () => 'Commander. There are more than eight.' },
            { seen: 1, who: 'Vance', say: r => "That's hull number " + r.hulls[0].num + ". We're number nine." }],
        5: [{ heard: 3000, who: 'Aris', say: () => "I've been writing every ship down. I can't keep up." },
            { heard: 12000, who: 'Vance', say: r => cap(words(Math.floor(r.heard / 1000))) + " thousand beacons, and I've seen " + words(r.seen) + ' ships.' }],
    };

    const u32 = hex => { const n = parseInt(hex.slice(1), 16); return (0xff000000 | ((n & 0xff) << 16) | (n & 0xff00) | (n >> 16)) >>> 0; };
    const P = Object.fromEntries(Object.entries(C).map(([k, v]) => [k, u32(v)]));
    const hash = (n, s) => { const h = Math.imul(Math.imul(n, 374761393) ^ s, 1274126177); return ((h ^ (h >>> 15)) & 1023) / 1023; };
    const fmt = n => n.toLocaleString('en-US');
    const plural = (n, word) => n + ' ' + word + (n === 1 ? '' : 's');

    /** Half-width of an EXODUS-class hull at u: the rounded nose over the bridge, the taper at the stern (as ship.js). */
    const hwAt = u => (u > DECKS[0] ? HW * (0.3 + 0.7 * Math.sin(((1 - u) / (1 - DECKS[0])) * Math.PI / 2))
        : u < DECKS[4] ? HW * (1 - 0.22 * (DECKS[4] - u) / (DECKS[4] - STERN)) : HW);
    /** 0 empty, 1 plating, 2 a deck seam. u runs stern (-1) to nose (+1), v across; px is half a pixel in these units. */
    function hullAt(h, u, v, px) {
        if (u > 1 || u < -0.93) return 0;
        const av = Math.abs(v), jag = h.cut ? hash(Math.floor(v * 40) + 64, h.seed) * 0.1 : 0;
        if (h.cut === 1 && u > h.deck - 0.03 - jag && u < h.deck + 0.08 + jag) return 0;  // torn in two at a deck
        if (h.cut === 2 && u > h.deck + jag) return 0;                                     // the front half gone
        if (h.cut === 3 && u < h.deck - jag) return 0;                                     // the back half gone
        if (u < STERN) return Math.abs(av - HW * 0.4) < HW * 0.13 ? 1 : 0;                 // engine bells
        const hw = hwAt(u);
        if (av > hw) return 0;
        return px < 0.04 && av < hw - px * 2 && DECKS.some(d => Math.abs(u - d) < px) ? 2 : 1;
    }
    /** A torn plate: four straight edges round the centre (inside one of the four triangles they make with it). */
    const cross = (ax, ay, bx, by) => ax * by - ay * bx;
    function shardAt(f, u, v) {
        return f.pts.some(([ax, ay], i) => {
            const [bx, by] = f.pts[(i + 1) % 4];
            return cross(ax, ay, u, v) >= 0 && cross(bx - ax, by - ay, u - ax, v - ay) >= 0 && cross(-bx, -by, u - bx, v - by) >= 0;
        }) ? 1 : 0;
    }

    /** Four corners round a centre, flattened: a torn piece of plating. */
    const plate = r => [0, 1, 2, 3].map(k => { const a = k * 1.571 + (r() - 0.5) * 0.9, d = 0.45 + r() * 0.55; return [Math.cos(a) * d, Math.sin(a) * d * 0.6]; });
    function makeHull(cfg, r, num, at) {
        const side = r() < 0.5 ? -1 : 1;                                     // they pass left or right: the picture is wider than tall
        const cut = r() < cfg.broken ? 1 + Math.floor(r() * 3) : 0, deck = DECKS[1 + Math.floor(r() * 3)];
        return {
            num, at, cut, deck, L: 1.15 + r() * 0.15, a0: r() * 6.28, spin: (r() - 0.5) * 0.12, ph: r() * 6.28, seed: (r() * 1e9) | 0,
            x: side * (5 + r() * 1.8), y: (r() * 2 - 1) * 2.5,
            beacon: r() < cfg.beacon, bu: cut === 2 ? deck - 0.3 : cut === 3 ? deck + 0.3 : 0.8, seenAt: -1,
        };
    }
    /** The debris around one wreck: most spread across our steering box, some hanging by the hull. None of it on the safe line. */
    function makeDebris(cfg, r, path, h) {
        const out = [], n = cfg.frags + (h.cut ? 5 : 0);
        for (let i = 0; i < n + 8; i++) {
            const near = i >= n, at = h.at + (r() - 0.5) * (near ? 0.8 : 4.5), rad = near ? 0.06 + r() * 0.16 : 0.1 + r() * r() * 0.32;
            const [px, py] = path(at), keep = SHIP_R[0] + rad + 0.15;
            let x, y;
            if (near) { const a = r() * 6.28, d = h.L * (0.7 + r() * 1.4); x = h.x + Math.cos(a) * d; y = h.y + Math.sin(a) * d; }
            else if (r() < 0.5) { const a = r() * 6.28, d = keep + 0.05 + r() * 0.8; x = px + Math.cos(a) * d; y = py + Math.sin(a) * d; }
            else {
                x = (r() * 2 - 1) * (BX + 0.6); y = (r() * 2 - 1) * (BY + 0.4);
                if (r() < 0.5) x = Math.abs(x) * Math.sign(h.x);               // leaning to the wreck's side
            }
            const dx = x - px, dy = y - py, d = Math.hypot(dx, dy);
            if (d < keep) { x = px + (d ? dx / d : 1) * keep; y = py + (d ? dy / d : 0) * keep; }
            out.push({ at, x, y, rad, a0: r() * 6.28, spin: (r() - 0.5) * 5, flip: 0.5 + r() * 3, pts: plate(r), done: false });
        }
        return out;
    }
    /** One jump: a smooth safe line (the one A.U.R.A. flies), the hulls close enough to see, their debris, and the radio. */
    function makeRun(n, r) {
        const cfg = SECTORS[n], ph = [0, 1, 2, 3].map(() => r() * 6.28);
        const path = t => [2 * Math.sin(0.45 * t + ph[0]) + 0.8 * Math.sin(1.1 * t + ph[1]), Math.sin(0.6 * t + ph[2]) + 0.4 * Math.sin(1.3 * t + ph[3])];
        const nums = new Set();
        while (nums.size < cfg.hulls) nums.add(cfg.lo + Math.floor(r() * (cfg.hi - cfg.lo + 1)));
        const gap = (DUR - 6) / cfg.hulls;                                    // deeper down the heading, higher numbers
        const hulls = [...nums].sort((a, b) => a - b).map((num, i) => makeHull(cfg, r, num, 6 + (i + 0.2 + r() * 0.6) * gap));
        const frags = hulls.flatMap(h => makeDebris(cfg, r, path, h)).sort((a, b) => a.at - b.at);
        const total = cfg.heard < 20 ? cfg.heard : Math.round(cfg.heard * (0.95 + r() * 0.1));
        const arrivals = cfg.heard < 20 ? Array.from({ length: total }, (_, i) => DUR * 0.86 * ((i + 0.2 + r() * 0.6) / total) ** (1 / cfg.curve)) : [];
        return { cfg, path, hulls, frags, total, arrivals, heard: 0, heardAt: -9, seen: 0, seenAt: -9, hits: 0, hull: HULL_MAX, lines: LINES[n].map(l => ({ ...l })) };
    }

    function mount(ctx, ui) {
        const img = ctx.createImageData(W, H), buf = new Uint32Array(img.data.buffer), depth = new Float32Array(W * H);
        const put = (x, y, c) => { if (x >= 0 && x < W && y >= 0 && y < H) buf[y * W + x] = c; };
        const dput = (x, y, tone, c) => { if (Lab.on(x, y, tone)) put(x, y, c); };
        const starR = Lab.rng(99), newStar = far => ({ x: (starR() * 2 - 1) * 30, y: (starR() * 2 - 1) * 18, z: far ? FAR_STAR : 1 + starR() * (FAR_STAR - 1) });
        const stars = Array.from({ length: 70 }, () => newStar(false));
        const held = { l: 0, r: 0, u: 0, d: 0 };
        let mode = 'ready', sector = 1, runs = 0, run = null, t = 0, cd = 0, fast = false, auto = false, phaseT = 0, clock = 0;
        let cam = [0, 0], vel = [0, 0], jolt = 0, nearT = 0, pointer = null, queue = [], nextLine = 0;
        const talk = (who, line) => { const at = Math.max(clock, nextLine); nextLine = at + LINE_GAP; queue.push({ at, who, line }); };

        // ── flow: ready → count → run → jump → done ──
        const sectorBtns = () => [1, 3, 5].map(n => ({ label: 'Sector ' + n, primary: mode === 'ready' && n === 1, onClick: () => prepare(n) }));
        const steerBtns = () => [['← Left', 'l'], ['→ Right', 'r'], ['↑ Up', 'u'], ['↓ Down', 'd']]
            .map(([label, k]) => ({ label, hold: true, onDown: () => { held[k] = 1; }, onUp: () => { held[k] = 0; } }));
        const flyBtns = () => [{ label: auto ? 'Take the stick' : 'Let A.U.R.A. fly', primary: auto, onClick: () => setAuto(!auto) }, ...steerBtns()];

        function toReady() {
            mode = 'ready'; run = null;
            ui.say('', 'Each sector is one jump further down the heading. Pick one to fly.');
            ui.buttons(sectorBtns());
        }
        function prepare(n) {
            sector = n; runs++;
            run = makeRun(n, Lab.rng(n * 7919 + runs * 104729));
            mode = 'count'; t = 0; cd = 10; fast = false; auto = false; cam = [0, 0]; vel = [0, 0]; jolt = 0; queue = []; nextLine = 0;
            ui.say('A.U.R.A.', 'Burn window in ten seconds. I can fly it, Commander, if you prefer.');
            ui.buttons([{ label: 'Fly it myself', primary: true, onClick: () => commit(false) }, { label: 'Let A.U.R.A. fly', onClick: () => commit(true) }, ...steerBtns()]);
        }
        function commit(isAuto) {
            if (mode !== 'count' || fast) return;
            fast = true; cd = Math.min(cd, 3);
            setAuto(isAuto);
        }
        function setAuto(on) {
            auto = on;
            ui.say('A.U.R.A.', on ? 'I have the ship, Commander.' : 'You have the ship, Commander. Keep us clear of the debris.');
            ui.buttons(flyBtns());
        }
        function begin() { mode = 'run'; t = 0; if (!fast) setAuto(false); }
        function finish() {
            mode = 'done'; phaseT = 0; queue = [];
            ui.say('A.U.R.A.', 'Jump complete.');
            const scrapes = run.hits ? cap(words(run.hits)) + (run.hits === 1 ? ' scrape' : ' scrapes') + ' on the hull.' : 'Not a scratch on the hull.';
            queue.push({ at: clock + 1.8, who: '', line: 'You heard ' + plural(run.heard, 'beacon').replace(/^\d+/, fmt(run.heard)) + ' and saw ' + plural(run.seen, 'ship') + '. ' + scrapes });
            ui.buttons([{ label: 'Run it again', primary: true, onClick: () => prepare(sector) }, ...sectorBtns()]);
        }

        // ── simulation ──
        function input() {
            const has = (...ks) => (ks.some(k => Lab.keys.has(k)) ? 1 : 0);
            let ix = has('ArrowRight', 'd') - has('ArrowLeft', 'a') + held.r - held.l;
            let iy = has('ArrowDown', 's') - has('ArrowUp', 'w') + held.d - held.u;
            if (pointer) {
                const dx = pointer.x - VX, dy = pointer.y - VY;
                if (Math.abs(dx) > 5) ix += Lab.clamp(dx / 40, -1, 1);
                if (Math.abs(dy) > 5) iy += Lab.clamp(dy / 25, -1, 1);
            }
            return [Lab.clamp(ix, -1, 1), Lab.clamp(iy, -1, 1)];
        }
        function fly(dt) {
            const live = mode === 'run' || mode === 'count', stick = live ? input() : [0, 0];
            if (auto && live && (stick[0] || stick[1])) setAuto(false);        // touching the controls takes the ship back
            if (auto && mode === 'run') {                                        // A.U.R.A. follows the safe line exactly
                const p = run.path(t), q = run.path(t + 0.05);
                vel = [0, 1].map(i => Lab.clamp((q[i] - p[i]) / 0.05 + (p[i] - cam[i]) * 6, -MAXV[i], MAXV[i]));
            } else vel = vel.map((v, i) => v + (stick[i] * MAXV[i] - v) * Math.min(1, dt * 7));
            cam = cam.map((c, i) => Lab.clamp(c + vel[i] * dt, -(i ? BY : BX), i ? BY : BX));
        }
        function cross(f) {                                                      // a fragment reaches our plane: does it touch us?
            f.done = true;
            const e = ((cam[0] - f.x) / (SHIP_R[0] + f.rad)) ** 2 + ((cam[1] - f.y) / (SHIP_R[1] + f.rad)) ** 2;
            if (e < 1) { run.hits++; run.hull = Math.max(0, run.hull - 1); jolt = 0.4; }
            else if (e < 2.4) nearT = 0.3;
        }
        function listen() {                                                      // transponders coming in, faster and faster
            const x = Math.min(1, t / (DUR * 0.94));
            const v = run.arrivals.length ? run.arrivals.filter(a => a <= t).length
                : x >= 1 ? run.total : Math.floor(run.total * x ** run.cfg.curve * (0.97 + Math.random() * 0.06));
            const heard = Math.min(run.total, Math.max(run.heard, v, run.seen));
            if (heard > run.heard) { run.heard = heard; run.heardAt = clock; }
        }
        function update(dt) {
            clock += dt; jolt = Math.max(0, jolt - dt); nearT = Math.max(0, nearT - dt);
            while (queue.length && queue[0].at <= clock) { const q = queue.shift(); ui.say(q.who, q.line); }
            if (mode === 'count') { cd -= dt * (fast ? 2 : 1); if (cd <= 0) begin(); }
            else if (mode === 'run') {
                t += dt;
                run.frags.forEach(f => { if (!f.done && f.at <= t) cross(f); });
                run.hulls.forEach(h => { if (h.seenAt < 0 && (h.at - t) * SPEED + ZHIT < SEE_AT) { h.seenAt = clock; run.seen++; run.seenAt = clock; } });
                listen();
                run.lines.forEach(l => { if (!l.done && run.seen >= (l.seen || 0) && run.heard >= (l.heard || 0)) { l.done = true; talk(l.who, l.say(run)); } });
                if (t >= DUR) { mode = 'jump'; phaseT = 0; }
            } else if (mode === 'jump' || mode === 'done') { phaseT += dt; if (mode === 'jump' && phaseT >= JUMP_TIME) finish(); }
            fly(dt);
            const mul = mode === 'run' ? 1 : mode === 'jump' ? 1 + (phaseT / JUMP_TIME) ** 2 * 9 : 0.15;
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
        function drawLight(o) {  // the light at the end of the heading, far ahead
            const r = run ? run.cfg.glow : 2;
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
                seg(b[0], b[1], a[0], a[1], s.z < 12 ? P.bone : s.z < 26 ? P.boneD : P.line2);
            }
        }
        /** Fill a shape centred on (sx, sy), turned by a; inside(u, v) works in units of `unit` px. Edges facing the light are lit. */
        function raster(sx, sy, R, unit, a, inside, z, fog) {
            const ca = Math.cos(a), sa = Math.sin(a), inv = 1 / unit, ll = Math.hypot(VX - sx, VY - sy) || 1;
            const lx = Math.round((VX - sx) / ll), ly = Math.round((VY - sy) / ll) || (lx ? 0 : -1);
            const shape = (px, py) => { const dx = (px - sx) * inv, dy = (py - sy) * inv; return inside(dx * ca + dy * sa, dy * ca - dx * sa); };
            for (let py = Math.max(0, Math.floor(sy - R)); py <= Math.min(H - 1, Math.ceil(sy + R)); py++) {
                for (let px = Math.max(0, Math.floor(sx - R)); px <= Math.min(W - 1, Math.ceil(sx + R)); px++) {
                    const s = shape(px, py);
                    if (!s) continue;
                    buf[py * W + px] = P.ink2; depth[py * W + px] = z;
                    if (s === 2) continue;                                                  // a deck seam stays dark
                    if (!shape(px + lx, py + ly)) dput(px, py, fog, P.bone);                // the edge facing the light
                    else if (!shape(px - lx, py - ly)) dput(px, py, fog * 0.5, P.greenD);   // the far edge
                    else dput(px, py, fog * Lab.clamp(0.3 + ((px - sx) * lx + (py - sy) * ly) / (R * 2), 0.06, 0.7), P.line2);
                }
            }
        }
        function beacon(bx, by, size) {
            const cx = Math.round(bx), cy = Math.round(by), r = Math.min(4, 1 + Math.floor(size));
            for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) { const d = Math.hypot(x, y) / r; if (d <= 1) dput(cx + x, cy + y, 0.3 * (1 - d), P.red); }
            put(cx, cy, P.red);
        }
        function brackets(cx, cy, r) {                                           // the ship's computer marking a hull it has identified
            const x0 = Math.round(cx - r), x1 = Math.round(cx + r), y0 = Math.round(cy - r), y1 = Math.round(cy + r);
            for (const [ex, ey, dx, dy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) {
                for (let i = 0; i < 3; i++) { put(ex + i * dx, ey, P.green); put(ex, ey + i * dy, P.green); }
            }
        }
        function drawHull(h, z, k, sx, sy, tags) {
            const unit = h.L * k, R = unit * 1.1, fog = Lab.clamp(1.3 - z / FAR_HULL, 0.2, 1), a = h.a0 + h.spin * t;
            const blink = h.beacon && Math.sin(clock * 2.2 + h.ph) > 0.75, cx = Math.round(sx), cy = Math.round(sy);
            if (R < 2.5) { dput(cx, cy, fog + 0.3, R < 1.2 ? P.line2 : P.boneD); if (blink) put(cx, cy, P.red); return; }
            const ca = Math.cos(a), sa = Math.sin(a), px = 0.5 / unit;
            raster(sx, sy, R, unit, a, (u, v) => hullAt(h, u, v, px), z, fog);
            if (blink) { const bv = hwAt(h.bu); beacon(sx + (h.bu * ca - bv * sa) * unit, sy + (h.bu * sa + bv * ca) * unit, unit * 0.06); }
            if (h.seenAt < 0) return;
            if (clock - h.seenAt < 1.6 && Math.floor((clock - h.seenAt) * 5) % 2 === 0) brackets(sx, sy, Math.max(6, R * 0.9));
            if (sx > 0 && sx < W && sy > 12 && sy < 168) tags.push({ z, s: 'HULL ' + fmt(h.num), sx, sy: sy - (Math.abs(sa) + Math.abs(ca) * HW) * unit - 7 });
        }
        function drawFrag(f, z, k, sx, sy) {
            const R = f.rad * k, fog = Lab.clamp(1.3 - z / FAR_FRAG, 0.15, 1);
            if (R < 1.3) { dput(Math.round(sx), Math.round(sy), fog + 0.2, R < 0.7 ? P.line2 : P.boneD); return; }
            const sq = 0.3 + 0.7 * Math.abs(Math.cos(f.flip * t + f.a0));          // tumbling: the plate turns edge-on and back
            raster(sx, sy, R + 1, R, f.a0 + f.spin * t, (u, v) => shardAt(f, u, v / sq), z, fog);
        }
        function drawField(o) {
            const vis = [], tags = [];
            run.hulls.forEach(h => { const z = (h.at - t) * SPEED + ZHIT; if (z > 0.5 && z < FAR_HULL) vis.push([z, h, true]); });
            run.frags.forEach(f => { const z = (f.at - t) * SPEED + ZHIT; if (z > 0.6 && z < FAR_FRAG) vis.push([z, f, false]); });
            vis.sort((p, q) => q[0] - p[0]);
            for (const [z, w, isHull] of vis) {
                const k = FOCAL / z, sx = VX + o[0] + (w.x - cam[0]) * k, sy = VY + o[1] + (w.y - cam[1]) * k;
                if (isHull) drawHull(w, z, k, sx, sy, tags); else drawFrag(w, z, k, sx, sy);
            }
            return tags;
        }
        function drawShip() {
            const hot = jolt > 0 ? P.red : nearT > 0 ? P.greenBr : P.greenD;
            for (const [y0, y1, edge] of [[0, 12, 11], [168, H, 168]]) {  // instrument bands, top and bottom
                for (let y = y0; y < y1; y++) for (let x = 0; x < W; x++) put(x, y, y === edge && x % 2 ? P.line2 : P.ink);
            }
            if (mode === 'count' || mode === 'run') {
                for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (let i = 0; i < 5; i++) {
                    put(VX + sx * (BOX[0] - i), VY + sy * BOX[1], hot);
                    put(VX + sx * BOX[0], VY + sy * (BOX[1] - i), hot);
                }
            }
            const nx = 160 + Math.round(vel[0] * 2), ny = 165 + Math.round(vel[1] * 1.2);
            for (let y = 0; ny + y < H; y++) {
                const hw = Math.floor(y * 1.2) + 1;
                for (let x = -hw; x <= hw; x++) {
                    put(nx + x, ny + y, Math.abs(x) === hw ? (jolt > 0 ? P.red : P.green) : P.ink2);
                    if (Math.abs(x) < hw) dput(nx + x, ny + y, x === 0 ? 0.6 : 0.3 - (Math.abs(x) / hw) * 0.2, x === 0 ? P.greenD : P.line2);
                }
            }
        }
        function drawOverlays() {
            if (jolt > 0) {
                for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
                    const e = Math.min(x, y, W - 1 - x, H - 1 - y);
                    if (e < 7) dput(x, y, jolt * 1.6 * (1 - e / 7), P.red);
                }
            }
            const white = mode === 'jump' ? Lab.clamp((phaseT - 0.4) / 0.9, 0, 0.75) : mode === 'done' ? Lab.clamp(0.75 - phaseT, 0, 0.75) : 0;
            if (white > 0) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) dput(x, y, white * (1.3 - Math.hypot(x - VX, y - VY) / 170), P.bone);
            const prog = mode === 'run' ? t / DUR : mode === 'jump' || mode === 'done' ? 1 : 0;
            for (let x = 78; x <= 208; x++) {
                const lit = x - 78 < prog * 130;
                put(x, 6, lit ? P.green : P.line); put(x, 7, lit ? P.greenD : P.line);
            }
            const hull = run ? run.hull : HULL_MAX;
            for (let i = 0; i < HULL_MAX; i++) for (let y = 171; y < 176; y++) for (let x = 0; x < 2; x++) {
                put(22 + i * 4 + x, y, i < hull ? P.green : jolt > 0 && i === hull ? P.red : P.line);
            }
            if (mode === 'done' && phaseT > 0.3) {
                for (let y = 30; y <= 114; y++) for (let x = 48; x <= 272; x++) put(x, y, y === 30 || y === 114 || x === 48 || x === 272 ? P.line2 : P.ink);
            }
        }
        const centred = (s, cx, y, c, sc = 1) => Lab.text(ctx, s, Math.round(cx - Lab.textWidth(s, sc) / 2), y, c, sc);
        function drawTags(tags) {
            const placed = [];
            for (const g of tags.sort((p, q) => p.z - q.z)) {           // nearest first gets the space
                const tw = Lab.textWidth(g.s);
                const x = Math.round(Lab.clamp(g.sx - tw / 2, 1, W - tw - 1)), y = Math.round(Lab.clamp(g.sy, 14, H - 20));
                if (placed.some(p => x < p[0] + p[2] + 3 && x + tw + 3 > p[0] && y < p[1] + 8 && y + 8 > p[1])) continue;
                if ([0, 0.5, 1].some(f => depth[(y + 2) * W + Math.round(x + tw * f)] < g.z - 0.3)) continue;  // hidden behind something nearer
                placed.push([x, y, tw]);
                Lab.text(ctx, g.s, x, y, g.z < 14 ? C.bone : C.boneD);
            }
        }
        function drawHud() {
            const heard = run ? run.heard : 0, seen = run ? run.seen : 0, hs = fmt(heard);
            Lab.text(ctx, 'EXODUS-9', 4, 4, C.green);
            if (run) Lab.text(ctx, 'SECTOR ' + sector, 42, 4, C.boneD);
            Lab.text(ctx, 'JUMP', 214, 4, mode === 'jump' || mode === 'done' ? C.greenBr : C.boneD);
            Lab.text(ctx, 'BEACONS HEARD', 236, 4, C.boneD);
            Lab.text(ctx, hs, W - 4 - Lab.textWidth(hs), 4, run && clock - run.heardAt < 0.35 ? C.greenBr : C.bone);
            Lab.text(ctx, 'HULL', 4, 171, C.boneD);
            if (auto && (mode === 'run' || mode === 'count')) Lab.text(ctx, 'A.U.R.A. FLYING', 68, 171, C.green);
            Lab.text(ctx, 'HULLS SEEN', 262, 171, C.boneD);
            Lab.text(ctx, String(seen), W - 4 - Lab.textWidth(String(seen)), 171, run && clock - run.seenAt < 1.2 ? C.greenBr : C.bone);
            if (mode === 'ready') centred('PICK A SECTOR', VX, 112, C.boneD);
            if (mode === 'count') { centred('BURN WINDOW', VX, 110, C.boneD); centred(String(Math.max(1, Math.ceil(cd))), VX, 118, C.bone, 3); }
            if (mode === 'done' && phaseT > 0.3) {
                const nums = run.hulls.filter(h => h.seenAt >= 0).map(h => h.num);
                centred('JUMP COMPLETE', VX, 38, C.green, 2);
                centred(hs, 108, 56, C.bone, 3); centred('BEACONS HEARD', 108, 76, C.boneD);
                centred(String(run.seen), 212, 56, C.bone, 3); centred('HULLS SEEN', 212, 76, C.boneD);
                if (nums.length) centred('HULL NUMBERS ' + fmt(Math.min(...nums)) + ' TO ' + fmt(Math.max(...nums)), VX, 92, C.boneD);
                centred(run.hits ? plural(run.hits, 'scrape') : 'no scrapes', VX, 102, run.hits ? C.amber : C.boneD);
            }
        }
        function render(mul) {
            const o = jolt > 0 ? [Math.round((Math.random() - 0.5) * 10 * jolt), Math.round((Math.random() - 0.5) * 8 * jolt)] : [0, 0];
            buf.fill(P.void); depth.fill(1e9);
            drawLight(o);
            drawStars(mul, o);
            const tags = run && mode !== 'done' ? drawField(o) : [];
            drawShip();
            drawOverlays();
            ctx.putImageData(img, 0, 0);
            if (mode !== 'jump') drawTags(tags);
            drawHud();
        }

        // ── input wiring ──
        ui.canvas.onpointerdown = e => { pointer = ui.toPixel(e); try { ui.canvas.setPointerCapture(e.pointerId); } catch (_) { /* capture is optional */ } };
        ui.canvas.onpointermove = e => { if (pointer) pointer = ui.toPixel(e); };
        ui.canvas.onpointerup = () => { pointer = null; };
        const release = () => { held.l = held.r = held.u = held.d = 0; pointer = null; };  // a hold button can vanish mid-press
        window.addEventListener('pointerup', release);
        window.addEventListener('pointercancel', release);
        Lab.onKey((k, e) => {
            if ((k === ' ' || k === 'Enter') && e && e.target && e.target.tagName === 'BUTTON') return;  // the button's own click handles it
            if ((k === '1' || k === '3' || k === '5') && mode !== 'run' && mode !== 'jump') prepare(Number(k));
            else if (k === ' ' || k === 'Enter') {
                if (mode === 'ready') prepare(1);
                else if (mode === 'count') commit(false);
                else if (mode === 'done') prepare(sector);
            }
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
        verb: 'Steer through the debris around each dead hull to the jump point, while the radio counts every transponder it hears.',
        serves: 'Told eight ships went before: the radio hears tens of thousands, but only a handful ever come close enough to see.',
        replaces: 'The timing bar used for jumps today.',
        controls: 'Arrows or WASD to steer · or hold the arrow buttons · or hold the mouse on the picture · Space starts',
        mount,
    });
})();
