/* proto-corridor.js — Fly the corridor.
   A forward view down the heading. Dead ships come out of the vanishing point, each tagged with its hull number,
   and you weave past them to the jump point. Sector 1 holds a few of the eight. Sector 5 holds thousands.
   The world is drawn into its own pixel buffer (fast and crisp); numbers and readouts go on top with Lab.text. */
(function () {
    'use strict';
    const Lab = window.Lab, { W, H, C } = Lab;

    const DUR = 25, JUMP_TIME = 1.3, ZFAR = 40, ZHIT = 1.2, SPEED = 11, FOCAL = 100;  // seconds, depth units, px per unit at depth 1
    const VX = 160, VY = 80, BX = 5, BY = 2.8, MAXV = [6, 4.5], HULL_MAX = 10;       // vanishing point, lane half-size, steering speed
    const BOX = [Math.round(0.45 * FOCAL / ZHIT), Math.round(0.25 * FOCAL / ZHIT)];  // the ship's size where wrecks cross
    const SHIP = [[0, 0], [0.45, 0], [-0.45, 0], [0, 0.25], [0, -0.25], [0.32, 0.18], [-0.32, 0.18], [0.32, -0.18], [-0.32, -0.18]];
    const SECTORS = {
        1: { lanes: 6, deco: 0, lo: 1, hi: 8, size: [1.4, 2], beacon: 0.5, broken: 0.2, glow: 2, line: ['Jaxon', "There's one of the eight."], at: 3.6 },
        3: { lanes: 34, deco: 26, lo: 212, hi: 980, size: [1.1, 1.9], beacon: 0.2, broken: 0.5, glow: 3, line: ['Mira', 'Those numbers are higher than ours.'], at: 7 },
        5: { lanes: 110, deco: 110, lo: 9000, hi: 22000, size: [1, 2], beacon: 0.08, broken: 0.7, glow: 5, line: ['Vance', 'They said eight.'], at: 11 },
    };

    const u32 = hex => { const n = parseInt(hex.slice(1), 16); return (0xff000000 | ((n & 0xff) << 16) | (n & 0xff00) | (n >> 16)) >>> 0; };
    const P = Object.fromEntries(Object.entries(C).map(([k, v]) => [k, u32(v)]));
    const hash = (n, s) => { const h = Math.imul(Math.imul(n, 374761393) ^ s, 1274126177); return ((h ^ (h >>> 15)) & 1023) / 1023; };
    const fmt = n => n.toLocaleString('en-US');
    const plural = (n, word) => n + ' ' + word + (n === 1 ? '' : 's');

    /** True where a wreck is solid. u runs along the hull, v across it, both in hull half-lengths. */
    function solid(w, u, v) {
        if (u < -1 || u > 1) return false;
        const av = Math.abs(v), jag = w.broken ? hash(Math.floor(v * 24) + 64, w.seed) * 0.14 : 0;
        if (w.broken === 1 && u > w.gap - jag && u < w.gap + 0.18 + jag) return false;
        if (w.broken === 2 && u > 0.3 - jag) return false;
        if (u < -0.72) return av < 0.3 && !(u < -0.9 && av < 0.12);        // drive block, dark nozzle
        if (w.ring && u > -0.36 && u < -0.2) return av < 0.52;              // habitat ring, side-on
        if (w.beacon && Math.abs(u + 0.55) < 0.03 && v > -0.3 && v < 0) return true;  // beacon mast
        return av < (u > 0.5 ? 0.2 * (1 - (u - 0.5) / 0.5) : 0.2);
    }

    function makeWreck(cfg, r, path, at, inLane, num) {
        const L = cfg.size[0] + r() * (cfg.size[1] - cfg.size[0]), keep = L * 1.1 + 0.55;  // keep: clearance from the safe line
        let x, y;
        if (inLane) {
            const [px, py] = path(at);
            if (r() < 0.55) { const a = r() * 6.28, d = keep + 0.05 + r() * 0.6; x = px + Math.cos(a) * d; y = py + Math.sin(a) * d; }
            else {
                x = px + keep + 0.5; y = py;
                for (let k = 0; k < 30; k++) {
                    const cx = (r() * 2 - 1) * (BX + 1), cy = (r() * 2 - 1) * (BY + 0.6);
                    if (Math.hypot(cx - px, cy - py) > keep) { x = cx; y = cy; break; }
                }
            }
        } else {
            const side = r() < 0.5 ? -1 : 1;
            if (r() < 0.65) { x = side * (BX + 2.8 + r() * 9); y = (r() * 2 - 1) * (BY + 4); }
            else { x = (r() * 2 - 1) * (BX + 8); y = side * (BY + 2.8 + r() * 4); }
        }
        return {
            x, y, at, L, num, a0: (r() - 0.5) * 1.1, spin: (r() - 0.5) * (inLane ? 0.3 : 1.2),
            broken: r() < cfg.broken ? (r() < 0.5 ? 1 : 2) : 0, gap: -0.25 + r() * 0.5, ring: r() < 0.4,
            beacon: r() < cfg.beacon, ph: r() * 6.28, seed: (r() * 1e9) | 0, done: false,
        };
    }

    /** A field of wrecks around one safe, smooth line (the line A.U.R.A. flies). Numbers climb as you go deeper. */
    function makeField(cfg, r) {
        const ph = [0, 1, 2, 3].map(() => r() * 6.28);
        const path = t => [3.1 * Math.sin(0.45 * t + ph[0]) + 1.2 * Math.sin(1.1 * t + ph[1]), 1.5 * Math.sin(0.6 * t + ph[2]) + 0.6 * Math.sin(1.3 * t + ph[3])];
        const total = cfg.lanes + cfg.deco, nums = new Set();
        while (nums.size < total) nums.add(cfg.lo + Math.floor(r() * (cfg.hi - cfg.lo + 1)));
        const sorted = [...nums].sort((a, b) => a - b);
        const times = Array.from({ length: total }, (_, i) => (total < 10 ? 3.5 + (i + 0.5) * (20 / total) + (r() - 0.5) * 1.5 : 3 + r() * 21)).sort((a, b) => a - b);
        const kinds = Array.from({ length: total }, (_, i) => i < cfg.lanes);
        for (let i = kinds.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [kinds[i], kinds[j]] = [kinds[j], kinds[i]]; }
        return { path, wrecks: times.map((at, i) => makeWreck(cfg, r, path, at, kinds[i], sorted[i])) };
    }

    function mount(ctx, ui) {
        const img = ctx.createImageData(W, H), buf = new Uint32Array(img.data.buffer), depth = new Float32Array(W * H);
        const put = (x, y, c) => { if (x >= 0 && x < W && y >= 0 && y < H) buf[y * W + x] = c; };
        const dput = (x, y, tone, c) => { if (Lab.on(x, y, tone)) put(x, y, c); };
        const starR = Lab.rng(99), newStar = far => ({ x: (starR() * 2 - 1) * 26, y: (starR() * 2 - 1) * 15, z: far ? ZFAR : 1 + starR() * (ZFAR - 1) });
        const stars = Array.from({ length: 64 }, () => newStar(false));
        const held = { l: 0, r: 0, u: 0, d: 0 };
        let mode = 'ready', sector = 1, runs = 0, run = null, t = 0, cd = 0, fast = false, auto = false, phaseT = 0, clock = 0;
        let cam = [0, 0], vel = [0, 0], jolt = 0, nearT = 0, pointer = null, queue = [];

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
            run = { cfg: SECTORS[n], ...makeField(SECTORS[n], Lab.rng(n * 7919 + runs * 104729)), passed: 0, hull: HULL_MAX, hits: 0, spoke: false };
            mode = 'count'; t = 0; cd = 10; fast = false; auto = false; cam = [0, 0]; vel = [0, 0]; jolt = 0; queue = [];
            ui.say('A.U.R.A.', 'Burn window in ten seconds. I can fly it, Commander, if you prefer.');
            ui.buttons([{ label: 'Fly it myself', primary: true, onClick: () => commit(false) }, { label: 'Let A.U.R.A. fly', onClick: () => commit(true) }, ...steerBtns()]);
        }
        function commit(isAuto) {
            if (mode !== 'count' || fast) return;
            fast = true; cd = Math.min(cd, 3);
            setAuto(isAuto, !isAuto);
        }
        function setAuto(on, quiet) {
            auto = on;
            if (!quiet) ui.say('A.U.R.A.', on ? 'I have the ship, Commander.' : 'You have the ship, Commander.');
            ui.buttons(flyBtns());
        }
        function begin() { mode = 'run'; t = 0; if (!fast) ui.buttons(flyBtns()); }
        function finish() {
            mode = 'done'; phaseT = 0;
            ui.say('A.U.R.A.', 'Jump complete.');
            const scrapes = run.hits ? plural(run.hits, 'scrape') + ' on the hull.' : 'Not a scratch on the hull.';
            queue.push({ at: clock + 1.6, who: '', line: plural(run.passed, 'wreck') + ' passed. ' + scrapes });
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
        function cross(w) {
            w.done = true; run.passed++;
            const ca = Math.cos(w.a0), sa = Math.sin(w.a0);   // at the crossing the hull sits at its rest angle
            const hit = SHIP.some(([ox, oy]) => {
                const dx = (cam[0] + ox - w.x) / w.L, dy = (cam[1] + oy - w.y) / w.L;
                return solid(w, dx * ca + dy * sa, -dx * sa + dy * ca);
            });
            if (hit) { run.hits++; run.hull = Math.max(0, run.hull - 1); jolt = 0.4; }
            else if (Math.hypot(cam[0] - w.x, cam[1] - w.y) < w.L * 1.1 + 1) nearT = 0.3;
        }
        function update(dt) {
            clock += dt; jolt = Math.max(0, jolt - dt); nearT = Math.max(0, nearT - dt);
            while (queue.length && queue[0].at <= clock) { const q = queue.shift(); ui.say(q.who, q.line); }
            if (mode === 'count') { cd -= dt * (fast ? 2 : 1); if (cd <= 0) begin(); }
            else if (mode === 'run') {
                t += dt;
                run.wrecks.forEach(w => { if (!w.done && w.at <= t) cross(w); });
                if (!run.spoke && t >= run.cfg.at) { run.spoke = true; ui.say(...run.cfg.line); }
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
        function beacon(bx, by, k) {
            const cx = Math.round(bx), cy = Math.round(by), r = Math.min(5, 1 + Math.floor(k * 0.06));
            for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) { const d = Math.hypot(x, y) / r; if (d <= 1) dput(cx + x, cy + y, 0.35 * (1 - d), P.red); }
            put(cx, cy, P.red);
        }
        function drawWreck(w, z, k, sx, sy) {
            const R = w.L * k * 1.1, fog = Lab.clamp(1.25 - z / ZFAR, 0.2, 1);
            if (R < 2.5) { dput(Math.round(sx), Math.round(sy), fog + 0.3, R < 1.2 ? P.line2 : P.boneD); return; }
            const a = w.a0 + w.spin * (t - w.at), ca = Math.cos(a), sa = Math.sin(a), inv = 1 / (w.L * k);
            const x0 = Math.max(0, Math.floor(sx - R)), x1 = Math.min(W - 1, Math.ceil(sx + R));
            const y0 = Math.max(0, Math.floor(sy - R)), y1 = Math.min(H - 1, Math.ceil(sy + R));
            for (let py = y0; py <= y1; py++) {
                const dy = (py - sy) * inv;
                for (let px = x0; px <= x1; px++) {
                    const dx = (px - sx) * inv, u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
                    if (!solid(w, u, v)) continue;
                    buf[py * W + px] = P.ink2; depth[py * W + px] = z;
                    if (!solid(w, u - inv * sa, v - inv * ca)) dput(px, py, fog, P.bone);               // lit top edge
                    else if (!solid(w, u + inv * sa, v + inv * ca)) dput(px, py, fog * 0.5, P.greenD);  // faint lower edge
                    else dput(px, py, fog * Lab.clamp(0.55 - dy * 2.4, 0.08, 0.85), P.line2);
                }
            }
            if (w.beacon && Math.sin(clock * 3 + w.ph) > 0.2) beacon(sx + (-0.55 * ca + 0.3 * sa) * w.L * k, sy + (-0.55 * sa - 0.3 * ca) * w.L * k, k);
            return a;
        }
        function drawField(o) {
            const vis = run.wrecks.map(w => [(w.at - t) * SPEED + ZHIT, w]).filter(([z]) => z > 0.35 && z < ZFAR).sort((p, q) => q[0] - p[0]);
            const tags = [];
            for (const [z, w] of vis) {
                const k = FOCAL / z, sx = VX + o[0] + (w.x - cam[0]) * k, sy = VY + o[1] + (w.y - cam[1]) * k;
                const a = drawWreck(w, z, k, sx, sy);
                if (z > 1.8 && z < 26 && w.L * k > 5 && sx > 0 && sx < W && sy > 0 && sy < H) {
                    tags.push({ z, num: w.num, sx, sy: sy - w.L * k * (Math.abs(Math.sin(a)) * 0.9 + 0.25) - 3 });
                }
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
            for (let x = 42; x <= 236; x++) {
                const lit = x - 42 < prog * 194;
                put(x, 6, lit ? P.green : P.line); put(x, 7, lit ? P.greenD : P.line);
            }
            const hull = run ? run.hull : HULL_MAX;
            for (let i = 0; i < HULL_MAX; i++) for (let y = 171; y < 176; y++) for (let x = 0; x < 2; x++) {
                put(22 + i * 4 + x, y, i < hull ? P.green : jolt > 0 && i === hull ? P.red : P.line);
            }
            if (mode === 'done' && phaseT > 0.3) {
                for (let y = 32; y <= 116; y++) for (let x = 56; x <= 264; x++) {
                    put(x, y, y === 32 || y === 116 || x === 56 || x === 264 ? P.line2 : P.ink);
                }
            }
        }
        const centre = (s, y, c, sc = 1) => Lab.text(ctx, s, Math.round(VX - Lab.textWidth(s, sc) / 2), y, c, sc);
        function drawTags(tags) {
            const placed = [];
            for (const g of tags.sort((p, q) => p.z - q.z)) {           // nearest first gets the space
                const s = fmt(g.num), tw = Lab.textWidth(s);
                const x = Math.round(Lab.clamp(g.sx - tw / 2, 1, W - tw - 1)), y = Math.round(Lab.clamp(g.sy - 5, 14, H - 20));
                if (placed.some(p => x < p[0] + p[2] + 3 && x + tw + 3 > p[0] && y < p[1] + 8 && y + 8 > p[1])) continue;
                if ([0, 0.5, 1].some(f => depth[(y + 2) * W + Math.round(x + tw * f)] < g.z - 0.3)) continue;  // hidden behind a nearer hull
                placed.push([x, y, tw]);
                Lab.text(ctx, s, x, y, g.z < 12 ? C.bone : C.boneD);
                if (placed.length >= 9) break;
            }
        }
        function drawHud() {
            Lab.text(ctx, 'EXODUS-9', 4, 4, C.green);
            Lab.text(ctx, 'JUMP', 240, 4, mode === 'jump' || mode === 'done' ? C.greenBr : C.boneD);
            const n = String(run ? run.passed : 0), nx = W - 4 - Lab.textWidth(n);
            Lab.text(ctx, n, nx, 4, C.bone);
            Lab.text(ctx, 'PASSED', nx - 4 - Lab.textWidth('PASSED'), 4, C.boneD);
            Lab.text(ctx, 'HULL', 4, 171, C.boneD);
            const sec = run ? 'SECTOR ' + sector : 'NO SECTOR';
            Lab.text(ctx, sec, W - 4 - Lab.textWidth(sec), 171, C.boneD);
            if (auto && (mode === 'run' || mode === 'count')) Lab.text(ctx, 'A.U.R.A. FLYING', 200, 171, C.green);
            if (mode === 'ready') centre('PICK A SECTOR', 112, C.boneD);
            if (mode === 'count') { centre('BURN WINDOW', 110, C.boneD); centre(String(Math.max(1, Math.ceil(cd))), 118, C.bone, 3); }
            if (mode === 'done' && phaseT > 0.3) {
                const nums = run.wrecks.map(w => w.num);
                centre('JUMP COMPLETE', 40, C.green, 2);
                centre(fmt(run.passed), 58, C.bone, 4);
                centre(run.passed === 1 ? 'WRECK PASSED' : 'WRECKS PASSED', 83, C.boneD);
                centre('HULL NUMBERS ' + fmt(Math.min(...nums)) + ' TO ' + fmt(Math.max(...nums)), 96, C.boneD);
                centre(run.hits ? plural(run.hits, 'scrape') : 'no scrapes', 105, run.hits ? C.amber : C.boneD);
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
        return () => { window.removeEventListener('pointerup', release); window.removeEventListener('pointercancel', release); };
    }

    Lab.register({
        id: 'corridor',
        name: 'Fly the corridor',
        short: 'Weave the dead ships to the jump',
        verb: 'Steer down the heading past dead ships, each tagged with its hull number, and reach the jump point.',
        serves: 'Eight ships against forty thousand: you feel the count in how hard the flying gets.',
        replaces: 'The timing bar used for jumps today.',
        controls: 'Arrows or WASD to steer · or hold the arrow buttons · or hold the mouse on the picture · Space starts',
        mount,
    });
})();
