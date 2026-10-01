/* proto-torch.js — The cutting torch.
   HATCH: a dead ship has no power, so you cut its hatch open along the seam. The flame only cuts through where it
   moves slowly enough; linger and the plate overheats (the torch pauses, the plate warps); stray off the seam and you
   burn a scar that wastes fuel. With the keys, the torch rides the seam once it is on it, round the corners.
   THE DISC: the same torch in the finale, on the 1977 disc. The light's sweep reads every live line as it passes.
   Burn the centre and cut each of the fourteen lines close to it; the last sweep finds no map, only the two figures.
   Draws at 320×180 through Lab. */
(function () {
    'use strict';
    const Lab = window.Lab, C = Lab.C, W = Lab.W, H = Lab.H;
    const RAMP = Lab.ship.HULL_RAMP, DARK_RED = '#6e241d';      // the ship's hull ramp and its emergency red (ship.js)
    const PLUS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

    // ── the torch: one set of physics for both parts ──
    const BURN = 11, BURN_R = 1.8;              // depth per second under the flame (1 = through), flame radius: cuts below ~20 px/s
    const FAST = 21;                            // px/s: faster than this only marks the plate
    const FOLLOW = 300;                         // px/s: the tip follows the pointer, near enough at once
    const KEY_FIRE = 15, KEY_FREE = 30, KEY_DELAY = 0.2;   // keys: a tap moves one pixel, holding glides
    const BURST = 0.2;                          // even a quick click on the trigger gives a short burst, enough to go through
    const CELL = 2, GW = W / CELL, GH = H / CELL;          // the heat grid
    const HEAT_IN = 1.6, WARN = 0.75, COOLED = 0.45;       // heat per second under the flame; at 1 it pauses until COOLED
    const PARTS = { hatch: { fuel: 40, tau: 1.5, spread: 1, burn: 1, heat: 1 },   // fuel seconds, cooling, heat spread, burn speed,
        disc: { fuel: 20, tau: 2.5, spread: 2, burn: 1.3, heat: 1.8 } };               // heat taken in: the disc is thin gold
    const REACT_GAP = 1.2;                      // a reaction waits at least this long after the line before it

    // ── HATCH: a rounded-rectangle seam, measured by its signed distance ──
    const HB = { cx: 214, cy: 86, hw: 28, hh: 34, r: 7 };
    const sdf = (x, y) => {
        const qx = Math.abs(x - HB.cx) - HB.hw + HB.r, qy = Math.abs(y - HB.cy) - HB.hh + HB.r;
        return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - HB.r;
    };
    const normal = (x, y, nx = sdf(x + 0.5, y) - sdf(x - 0.5, y), ny = sdf(x, y + 0.5) - sdf(x, y - 0.5)) =>   // which way is "out" from the seam
        ({ x: nx / (Math.hypot(nx, ny) || 1), y: ny / (Math.hypot(nx, ny) || 1) });
    const ON_SEAM = 2.5;                        // a kerf within two pixels of the seam frees it; further out is a scar
    const TEAR = 0.97;                          // with this much of the seam cut, the last few pixels tear free
    const SEAM = [], SEAM_AT = new Int16Array(W * H).fill(-1);
    for (let y = HB.cy - HB.hh - 1; y <= HB.cy + HB.hh + 1; y++) {
        for (let x = HB.cx - HB.hw - 1; x <= HB.cx + HB.hw + 1; x++) if (Math.abs(sdf(x, y)) <= 0.5) { SEAM_AT[y * W + x] = SEAM.length; SEAM.push(y * W + x); }
    }
    const EDGES = [27, 137], JOINTS = [[118, 262], [92, 292], [54, 200]];   // the hull's plate joints
    const GLINT = { x: HB.cx - 11, y: HB.cy + 19 };

    // ── THE DISC: the same fourteen lines as the dating sketch, closer ──
    const DX = 160, DY = 90, DR = 84, CUT_NEAR = 5, CUT_FAR = 28, ON_LINE = 1.1;
    const SWEEP = 6, FINAL_SWEEP = 2.4;         // seconds for the light's sweep to cross the disc, and its last pass
    const LINES = [
        [-176, 70, 0.62], [-151, 46, 0.55], [-129, 60, 0.72], [-104, 38, 0.60], [-83, 66, 0.45], [-58, 52, 0.70], [-36, 32, 0.66],
        [-11, 64, 0.50], [12, 42, 0.74], [35, 58, 0.58], [61, 36, 0.52], [92, 68, 0.64], [124, 48, 0.68], [153, 56, 0.48],
    ].map(([deg, len, f]) => {
        const a = (deg * Math.PI) / 180, l = Math.round(len * 1.12);
        return { ux: Math.cos(a), uy: Math.sin(a), len: l, notch: Math.round(l * f) };
    });
    const along = (p, l) => (p.x - DX) * l.ux + (p.y - DY) * l.uy, across = (p, l) => Math.abs((p.x - DX) * l.uy - (p.y - DY) * l.ux);
    const MAN = ['#.........', '#...###...', '#..#####..', '#...###...', '.#...#....', '..########', '...#####.#', '...#####.#',
        '...#####.#', '....###..#', '....###...', '....#.#...', '....#.#...', '....#.#...', '....#.#...', '....#.#...', '...##.##..'];
    const WOMAN = ['.......', '..###..', '.#####.', '.#####.', '.#####.', '...#...', '.#####.', '#.###.#', '#.###.#',
        '#.###.#', '..###..', '..#.#..', '..#.#..', '..#.#..', '..#.#..', '..#.#..', '.##.##.'];
    const FIG_PX = [{ x: 167, y: 135, rows: MAN }, { x: 180, y: 135, rows: WOMAN }]
        .flatMap(f => f.rows.flatMap((row, ry) => [...row].map((c, rx) => (c === '#' ? { x: f.x + rx, y: f.y + ry } : null)).filter(Boolean)));
    const nearFigures = (p, r) => FIG_PX.filter(q => Math.abs(q.x - p.x) <= r && Math.abs(q.y - p.y) <= r);   // figure pixels by the flame

    const SAY = {
        hatch: [['', "EXODUS-6. Dead about twenty years. No power, so the airlock won't open."],
            ['Jaxon', 'Trace the seam all the way round. Let it cut through before you move on.']],
        fast: ['Jaxon', "Too fast. That's only marking the plate, not cutting it."], hot: ['Jaxon', "The plate's getting hot. Keep moving."],
        warp: ['Jaxon', "Too hot, and now it's warped. Let it cool a second."], stray: ['Vance', "You're off the seam. That's fuel we don't get back."],
        half: ['Vance', 'Still nothing warm on the other side.'], gap: ['Jaxon', "It's still holding somewhere. Find the bit you missed."],
        open: [['Vance', 'Hold on. Something in there caught your light.'], ['Jaxon', 'Twenty years in the dark. Go slow in there.']],
        hatchDry: [['', 'The tank is empty. The hatch still holds.'], ['Jaxon', "Come back to the lander. We'll swap the tank."]],
        disc: [['', 'The disc is drifting into the light. The light reads whatever reaches it.'],
            ['', 'Where the lines meet is home. Burn the centre, then cut each line close to it.']],
        discHot: ['', 'The gold is too hot to cut. Wait for it to cool.'], fig: ['', 'You pull the torch back from the figures.'],
        done: ['A.U.R.A.', 'The map is gone, Commander.'],
        clean: ['', 'The two figures are still there. The light already knew what we look like.'],
        marked: ['', 'The figures are scorched, but still there. The light already knew what we look like.'],
        discDry: [['', 'The tank is empty. The map is still there.']],
    };
    const DIRS = { ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0], ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1] };

    // ── the pictures, painted once ──
    const hash = (a, b) => { const h = Math.imul(a, 374761393) + Math.imul(b, 668265263) | 0, k = Math.imul(h ^ (h >>> 13), 1274126177); return ((k ^ (k >>> 16)) >>> 0) / 4294967296; };
    function paint(fn) { const c = document.createElement('canvas'); c.width = W; c.height = H; fn(c.getContext('2d')); return c; }
    function eachPixel(fn) { for (let i = 0; i < W * H; i++) fn(i % W, (i / W) | 0); }
    function paintWorn(b, str, x, y, scale, color, keep) {          // old paint: the pixel font with a few flakes missing
        const g = Object.assign(document.createElement('canvas'), { width: W, height: 5 * scale }).getContext('2d', { willReadFrequently: true });
        Lab.text(g, str, 0, 0, '#fff', scale);
        const data = g.getImageData(0, 0, W, 5 * scale).data;
        b.fillStyle = color;
        for (let py = 0; py < 5 * scale; py++) for (let px = 0; px < Lab.textWidth(str, scale); px++) if (data[(py * W + px) * 4 + 3] && hash(px, py + 50) <= keep) b.fillRect(x + px, y + py, 1, 1);
    }
    const isRivet = (x, y, row) => Math.abs(sdf(x, y)) > 3 && ((EDGES.some(e => Math.abs(y - e) === 3) && x % 7 === 3) || (JOINTS[row].some(j => Math.abs(x - j) === 3) && y % 7 === 3));
    function paintHull(b) {
        const rnd = Lab.rng(6), pits = new Set(Array.from({ length: 180 }, () => Math.floor(rnd() * W * H)));
        eachPixel((x, y) => {
            const row = y < EDGES[0] ? 0 : y < EDGES[1] ? 1 : 2, d = sdf(x, y), hx = x - (HB.cx + HB.hw - 13), hy = y - (HB.cy - 2);
            const lit = Math.max(0, 1 - Math.hypot(x - 200, y - 70) / 250);                  // our work light, on the hatch
            let g = 0.13 + 0.25 * lit * lit + (hash(row, JOINTS[row].filter(j => x > j).length) - 0.5) * 0.05;
            if (EDGES.includes(y) || JOINTS[row].includes(x)) g = 0.04;                      // plate joints
            else if (EDGES.includes(y - 1) || JOINTS[row].includes(x - 1)) g += 0.1;         // and their lit lip
            else if (isRivet(x, y, row)) g = 0.45 + 0.15 * lit;
            else if (isRivet(x - 1, y - 1, row)) g = 0.05;                                    // rivet shadow
            if (pits.has(y * W + x)) g -= 0.07;                                               // micrometeorite pits
            if (Math.abs(d) <= 0.5) g = 0.02;                                                 // the hatch seam
            else if (d < -0.5 && d >= -1.5) g += 0.08;
            else if (hx >= 0 && hx <= 7 && hy >= 0 && hy <= 4) g = hy === 4 ? 0.42 : hx === 0 || hx === 7 || hy === 0 ? 0.04 : 0.12; // handle recess
            b.fillStyle = Lab.ship.rampAt(RAMP, g, x, y); b.fillRect(x, y, 1, 1);
        });
        paintWorn(b, 'EXODUS-6', 18, 44, 3, C.boneD, 0.82);
        paintWorn(b, 'RESCUE', HB.cx - 11, HB.cy - HB.hh - 9, 1, C.amber, 1);
    }
    function paintHole(b) {
        eachPixel((x, y) => {
            const d = sdf(x, y), far = (x - HB.cx) / HB.hw + (y - HB.cy) / HB.hh;
            if (d > 0.5) return;
            let col = C.void;
            if (d > -3) col = far > 0.2 ? Lab.ship.rampAt(RAMP, 0.26 + 0.1 * (d + 3) / 3.5, x, y) : C.ink;   // the plate's cut edge
            else if (Math.abs(d + 11) < 0.5 && Lab.on(x, y, 0.3)) col = C.line;                          // the inner door's frame
            else if (Lab.on(x, y, 0.2 * Math.max(0, 1 - Math.hypot(x - HB.cx - 8, y - HB.cy - 14) / 22))) col = C.line;   // our light, landing inside
            b.fillStyle = col; b.fillRect(x, y, 1, 1);
        });
    }
    function paintDisc(b) {
        b.fillStyle = C.void; b.fillRect(0, 0, W, H);
        Lab.disc(b, DX, DY, DR, d => (d < 0.82 ? 0.05 : 0.05 + 0.3 * ((d - 0.82) / 0.18) ** 2), C.amber);
        for (let r = 14; r < DR - 6; r += 9) Lab.ring(b, DX, DY, r, C.amber, 0.12);
        Lab.ring(b, DX, DY, DR, C.gold, 0.75);
        Lab.ring(b, DX, DY, DR + 1, C.amber, 0.35);
    }

    function mount(ctx, ui) {
        const hullBg = paint(paintHull), discBg = paint(paintDisc), hole = paint(paintHole);
        const lid = paint(b => { b.drawImage(hullBg, 0, 0); eachPixel((x, y) => { if (sdf(x, y) > -0.5) b.clearRect(x, y, 1, 1); }); });
        const lidShadow = paint(b => { b.fillStyle = C.void; eachPixel((x, y) => { if (sdf(x, y) <= -0.5 && Lab.on(x, y, 0.6)) b.fillRect(x, y, 1, 1); }); });
        let s = null, clock = 0, ptrFire = false, aim = null, bornAt = 0;
        const clampTip = (x, y) => ({ x: Lab.clamp(x, 2, W - 3), y: Lab.clamp(y, 2, H - 3) });
        const cellOf = p => Lab.clamp(Math.floor((p.y + 0.5) / CELL), 0, GH - 1) * GW + Lab.clamp(Math.floor((p.x + 0.5) / CELL), 0, GW - 1);
        const heatAt = p => s.heat[cellOf(p)];
        const paused = () => s.pause > 0 || !!s.hotSpot;

        // ── one line at a time: scripted lines wait to be read, reactions come straight after the line before ──
        function show(line) { ui.say(line[0], line[1]); s.saidAt = clock; s.nextSay = clock + Lab.clamp(1 + 0.22 * line[1].split(' ').length, 2, 3.6); }
        function script(lines, delay, then) {
            s.speech = lines.map((line, j) => ({ line, then: j === lines.length - 1 ? then : null })); s.react = null; s.nextSay = clock + delay;
        }
        const react = (key, line) => { if (!s.said[key]) { s.said = { ...s.said, [key]: true }; s.react = line; } };
        function talk() {
            if (s.react && clock - s.saidAt >= REACT_GAP) { show(s.react); s.react = null; return; }
            if (!s.speech.length || clock < s.nextSay) return;
            const [next, ...rest] = s.speech;
            s.speech = rest; show(next.line);
            if (next.then) next.then();
        }

        function start(part) {
            ptrFire = false; aim = null; bornAt = performance.now();
            s = { part, P: PARTS[part], phase: 'cut', tip: part === 'hatch' ? { x: HB.cx - HB.hw - 12, y: HB.cy } : { x: 118, y: 124 },
                speed: 0, trail: [], holdT: 0, burst: 0, fuel: 1, pause: 0, hotSpot: null, firing: false, fired: false,
                heat: new Float32Array(GW * GH), spare: new Float32Array(GW * GH),
                depth: new Float32Array(W * H), lastT: new Float32Array(W * H).fill(-99), thruT: new Float32Array(W * H), marks: [],
                sparks: [], warps: [], speech: [], react: null, nextSay: 0, saidAt: -99, said: {}, scars: 0, strayT: 0, fastT: 0,
                seamCut: new Uint8Array(SEAM.length), cut: 0, lastCut: 0, stall: 0, openT: 0,
                cutT: LINES.map(() => null), centre: false, figTouched: false, sweep: 0, final: false };
            ui.clear();
            script(SAY[part], 0);
            showButtons();
        }
        function showButtons() {
            const go = part => () => { if (performance.now() - bornAt > 400) start(part); };   // a double click must not start twice
            const hatch = { label: 'Hatch', onClick: go('hatch') }, disc = { label: 'The disc', onClick: go('disc') };
            if (s.phase === 'end' && s.part === 'hatch') return ui.buttons([{ ...disc, primary: true }, { label: 'Run it again', onClick: go('hatch') }]);
            if (s.phase === 'end') return ui.buttons([{ label: 'Run it again', primary: true, onClick: go('hatch') }, disc]);
            if (s.phase === 'dry') return ui.buttons([{ label: 'New tank', primary: true, onClick: go(s.part) }, hatch, disc]);
            ui.buttons([{ ...hatch, quiet: true }, { ...disc, quiet: true }]);
        }
        const next = () => start(s.phase === 'dry' ? s.part : s.part === 'hatch' ? 'disc' : 'hatch');   // what Enter does at the end

        // ── the tip and the flame ──
        function step(dx, dy, k) {                                         // a key move of k px
            const p = s.tip, l = Math.hypot(dx, dy), mx = (dx / l) * k, my = (dy / l) * k, d = sdf(p.x, p.y);
            if (s.part === 'hatch' && Math.abs(d) <= ON_SEAM) {             // on the seam, the keys ride it, round the corners
                const n = normal(p.x, p.y), dir = (my * n.x - mx * n.y) / k;
                if (Math.abs(dir) > 0.1) {
                    const q = { x: p.x - n.y * Math.sign(dir) * k, y: p.y + n.x * Math.sign(dir) * k }, e = sdf(q.x, q.y);
                    s.tip = clampTip(q.x - n.x * e, q.y - n.y * e);
                    return;
                }
                if (Math.abs(sdf(p.x + mx, p.y + my)) >= Math.abs(d)) return;   // straight across it: hold still rather than scar
            }
            s.tip = clampTip(p.x + mx, p.y + my);
        }
        function nudge(d) { if (s.phase === 'cut') { aim = null; step(d[0], d[1], 1); } }
        function moveTip(dt, wants) {
            let dx = 0, dy = 0;
            Object.entries(DIRS).forEach(([k, [x, y]]) => { if (Lab.keys.has(k)) { dx += x; dy += y; } });
            if (Math.sign(dx) || Math.sign(dy)) {
                aim = null; s.holdT += dt;
                if (s.holdT > KEY_DELAY) step(Math.sign(dx), Math.sign(dy), (wants ? KEY_FIRE : KEY_FREE) * dt);
            } else s.holdT = 0;
            if (aim) {
                const ax = aim.x - s.tip.x, ay = aim.y - s.tip.y, dist = Math.hypot(ax, ay), max = FOLLOW * dt;
                s.tip = dist <= max ? clampTip(aim.x, aim.y) : clampTip(s.tip.x + (ax / dist) * max, s.tip.y + (ay / dist) * max);
            }
            s.trail = s.trail.filter(p => clock - p.t < 0.3).concat({ t: clock, ...s.tip });   // speed over the last third of a second: a shaky hand is not a fast one
            const o = s.trail[0];
            s.speed = clock > o.t ? Math.hypot(s.tip.x - o.x, s.tip.y - o.y) / (clock - o.t) : 0;
        }
        const solid = (x, y) => s.part === 'hatch' || Math.hypot(x - DX, y - DY) <= DR;     // off the disc there is nothing to burn
        function burn(p, dt) {
            const x0 = Math.round(p.x), y0 = Math.round(p.y);
            if (!solid(p.x, p.y)) return;
            for (let y = y0 - 2; y <= y0 + 2; y++) for (let x = x0 - 2; x <= x0 + 2; x++) {
                const w = 1 - Math.hypot(x - p.x, y - p.y) / BURN_R, i = y * W + x, was = s.depth[i];
                if (w <= 0 || x < 0 || y < 0 || x >= W || y >= H || !solid(x, y)) continue;
                if (was === 0) s.marks.push(i);
                s.depth[i] = Math.min(2, was + BURN * s.P.burn * w * dt); s.lastT[i] = clock;
                if (was < 1 && s.depth[i] >= 1) { s.thruT[i] = clock; through(x, y); }
            }
            const c = cellOf(p), gx = c % GW, gy = (c - gx) / GW;
            for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) if (gx + ox >= 0 && gy + oy >= 0 && gx + ox < GW && gy + oy < GH) s.heat[c + oy * GW + ox] += HEAT_IN * s.P.heat * dt * (ox && oy ? 0.25 : ox || oy ? 0.5 : 1);
            for (let k = 0; k < 2; k++) if (Math.random() < dt * 30) {
                const a = Math.random() * Math.PI * 2, v = 20 + Math.random() * 40;       // no air: sparks fly straight
                s.sparks = s.sparks.concat({ x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.2 + Math.random() * 0.4 });
            }
        }
        function through(x, y) {
            if (s.part === 'hatch') {                                       // a kerf within two pixels frees that bit of seam
                for (let k, oy = -2; oy <= 2; oy++) for (let ox = -2; ox <= 2; ox++) if ((k = SEAM_AT[(y + oy) * W + x + ox]) >= 0 && !s.seamCut[k]) { s.seamCut[k] = 1; s.cut++; }
                return;
            }
            if (Math.hypot(x - DX, y - DY) <= 1.2) s.centre = true;
            LINES.forEach((l, j) => { const a = along({ x, y }, l); if (s.cutT[j] === null && a >= CUT_NEAR && a <= CUT_FAR && across({ x, y }, l) <= ON_LINE) s.cutT[j] = clock; });
        }
        function touch(p) {                                                 // the torch will not burn the two figures: a scorch, not a cut
            s.pause = 0.9; s.figTouched = true;
            nearFigures(p, 3).forEach(q => { const i = q.y * W + q.x; if (s.depth[i] === 0) s.marks.push(i); s.depth[i] = Math.max(s.depth[i], 0.6); s.lastT[i] = clock; });
            react('fig', SAY.fig);
        }
        function cool(dt) {
            const k = Math.exp(-dt / s.P.tau), D = Math.min(0.9, s.P.spread * dt), h = s.heat, n = s.spare;
            for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
                const i = gy * GW + gx, avg = (h[gx > 0 ? i - 1 : i] + h[gx < GW - 1 ? i + 1 : i] + h[gy > 0 ? i - GW : i] + h[gy < GH - 1 ? i + GW : i]) / 4;
                n[i] = (h[i] + (avg - h[i]) * D) * k;
            }
            s.heat = n; s.spare = h;
        }

        // ── the rules ──
        function update(dt) {
            s.sparks = s.sparks.map(p => ({ ...p, x: p.x + p.vx * dt, y: p.y + p.vy * dt, life: p.life - dt })).filter(p => p.life > 0);
            cool(dt);
            talk();
            if (s.part === 'disc') sweepOn(dt);
            if (s.phase === 'open' || s.phase === 'end') s.openT += dt;
            if (s.phase !== 'cut') { s.firing = false; return; }
            s.burst = Math.max(0, s.burst - dt);
            const wants = ptrFire || Lab.keys.has(' ') || s.burst > 0, from = s.tip;
            moveTip(dt, wants);
            s.pause = Math.max(0, s.pause - dt);
            if (s.hotSpot && s.pause <= 0 && heatAt(s.hotSpot) <= COOLED) s.hotSpot = null;
            s.firing = wants && !paused() && s.fuel > 0;
            if (s.firing) fire(dt, from);
            else { s.strayT = 0; s.fastT = 0; }
            if (s.part === 'hatch') hatchRules(dt); else discRules();
            if (s.fuel <= 0 && s.phase === 'cut') { s.phase = 'dry'; script(SAY[s.part + 'Dry'], 0); showButtons(); }
        }
        function fire(dt, from) {
            const to = s.tip, n = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 0.7));
            s.fuel = Math.max(0, s.fuel - dt / s.P.fuel); s.fired = true;
            for (let k = 1; k <= n; k++) {                                  // burn along the whole path, so a quick stroke leaves a shallow line
                const p = { x: Lab.lerp(from.x, to.x, k / n), y: Lab.lerp(from.y, to.y, k / n) };
                if (s.part === 'disc' && nearFigures(p, 2).length) return touch(p);
                burn(p, dt / n);
            }
            const h = heatAt(to);
            if (h >= WARN && s.part === 'hatch') react('hot', SAY.hot);
            if (h >= 1) {
                const w = { x: Math.round(to.x), y: Math.round(to.y) };
                s.pause = 1; s.hotSpot = { ...to };
                if (!s.warps.some(o => Math.hypot(o.x - w.x, o.y - w.y) < 5)) s.warps = s.warps.concat(w);   // one warp per spot
                react('warp', s.part === 'hatch' ? SAY.warp : SAY.discHot);
            }
            if (s.part !== 'hatch') return;
            const stray = Math.abs(sdf(to.x, to.y)) > ON_SEAM;
            s.strayT = stray ? s.strayT + dt : 0;
            if (stray && s.strayT >= 0.15 && s.strayT - dt < 0.15) { s.scars++; react('stray', SAY.stray); }
            s.fastT = !stray && s.speed > FAST ? s.fastT + dt : Math.max(0, s.fastT - dt);
        }
        function hatchRules(dt) {
            const f = s.cut / SEAM.length;
            if (s.fastT > 0.6) react('fast', SAY.fast);
            if (f >= 0.5) react('half', SAY.half);
            s.stall = s.cut === s.lastCut ? s.stall + dt : 0; s.lastCut = s.cut;
            if (f >= 0.9 && s.stall > 3) react('gap', SAY.gap);
            if (f < TEAR) return;
            s.phase = 'open'; s.openT = 0;
            for (let k = 0; k < 60; k++) {                                   // the last of the air, and twenty years of dust
                const i = SEAM[Math.floor(Math.random() * SEAM.length)], x = i % W, y = (i - x) / W, a = Math.atan2(y - HB.cy, x - HB.cx), v = 6 + Math.random() * 16;
                s.sparks = s.sparks.concat({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1 + Math.random() * 1.4, dust: true });
            }
            script(SAY.open, 2.1, () => { s.phase = 'end'; showButtons(); });   // Vance speaks as the glint shows
            showButtons();
        }
        function discRules() {
            if (!s.centre || s.cutT.some(v => v === null)) return;
            s.phase = 'closing'; s.final = true; s.sweep = -0.2;               // the light makes one more pass, and reads nothing
            script([], 0);
            showButtons();
        }
        function sweepOn(dt) {
            s.sweep += dt / (s.final ? FINAL_SWEEP : SWEEP);
            if (s.sweep < 1) return;
            s.sweep -= 1;
            if (!s.final) return;
            s.final = false;
            script([SAY.done, s.figTouched ? SAY.marked : SAY.clean], 0, () => { s.phase = 'end'; showButtons(); });
        }

        // ── drawing ──
        function markColor(i) {
            const d = s.depth[i];
            if (d >= 1) { const age = clock - s.thruT[i]; return age < 0.35 ? C.white : age < 1.1 ? C.gold : age < 2.6 ? C.amber : age < 5 ? C.red : DARK_RED; }
            if (clock - s.lastT[i] < 0.8) return d > 0.5 ? C.amber : C.red;
            return d > 0.3 ? C.ink : null;
        }
        function drawBurns(opened) {                                         // tint, glow, kerf
            s.warps.forEach(w => { Lab.ring(ctx, w.x, w.y, 2, C.violet, 0.5); Lab.ring(ctx, w.x, w.y, 4, C.amber, 0.3); Lab.ring(ctx, w.x, w.y, 5, C.violet, 0.25); });
            for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
                const v = s.heat[gy * GW + gx], x0 = gx * CELL, y0 = gy * CELL;
                if (v < 0.2 || (opened && sdf(x0, y0) <= 0.5)) continue;
                for (let y = y0; y < y0 + CELL; y++) for (let x = x0; x < x0 + CELL; x++) {
                    const col = v > 0.85 && Lab.on(x, y, (v - 0.85) * 3) ? C.gold : v > 0.5 && Lab.on(x, y, (v - 0.5) * 1.5) ? C.amber : Lab.on(x, y, (v - 0.2) * 0.9) ? C.red : null;
                    if (col) { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); }
                }
            }
            s.marks.forEach(i => {
                const x = i % W, y = (i - x) / W, col = opened && sdf(x, y) <= 0.5 ? null : markColor(i);
                if (col) { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); }
            });
        }
        function drawSparks() {
            s.sparks.forEach(p => Lab.dot(ctx, p.x, p.y, p.dust ? (p.life > 0.8 ? C.bone : C.boneD) : p.life > 0.35 ? C.white : p.life > 0.15 ? C.gold : C.amber));
        }
        function drawTorch() {
            const x = Math.round(s.tip.x), y = Math.round(s.tip.y);
            for (let k = 5; k < 32; k++) Lab.shade(ctx, x + Math.round(k * 0.4) - 1, y + k, 3, 1, k < 9 ? 0.85 : 0.5, k < 9 ? C.boneD : C.line2);
            if (s.firing) {                                                  // the flame: a white point in a gold glow
                Lab.disc(ctx, x, y, 4, d => 0.55 * (1 - d), C.gold);
                return [[0, 0], ...PLUS].forEach(([ox, oy]) => Lab.dot(ctx, x + ox, y + oy, ox || oy ? (Math.random() < 0.5 ? C.white : C.gold) : C.white));
            }
            const col = paused() ? (Math.floor(clock * 4) % 2 ? C.red : DARK_RED) : s.part === 'disc' ? C.greenBr : C.amber;
            PLUS.forEach(([ox, oy]) => [3, 4, 5].forEach(k => {                 // the aim: four short ticks, outlined so they stand out on the gold
                Lab.dot(ctx, x + ox * k + oy, y + oy * k + ox, C.void); Lab.dot(ctx, x + ox * k - oy, y + oy * k - ox, C.void); Lab.dot(ctx, x + ox * k, y + oy * k, col);
            }));
            Lab.dot(ctx, x, y, paused() ? C.red : C.boneD);
        }
        function hud(x, y, extra, rows) {
            const h = heatAt(s.tip), bars = [['FUEL', s.fuel, s.fuel < 0.2 ? C.red : C.green], ['HEAT', h, h >= WARN ? C.red : h > 0.5 ? C.amber : C.greenD], ...extra];
            const all = rows.concat(s.phase === 'cut' && paused() && Math.floor(clock * 3) % 2 ? [['COOLING', C.red]] : [['', C.red]]);
            Lab.shade(ctx, x - 4, y - 4, 72, 10 + (bars.length + all.length) * 8, 0.8, C.void);
            bars.forEach(([label, v, col], k) => {
                Lab.text(ctx, label, x, y + k * 8, C.boneD);
                [[44, 0.25, C.line2], [Math.round(44 * Lab.clamp(v, 0, 1)), 0.9, col]].forEach(([w, tone, c]) => Lab.shade(ctx, x + 18, y + k * 8 + 1, w, 3, tone, c));
            });
            all.forEach(([str, col], k) => Lab.text(ctx, str, x, y + (bars.length + k) * 8 + 2, col));
        }
        function renderHatch() {
            const opened = s.phase === 'open' || s.phase === 'end', f = opened ? 1 : s.cut / SEAM.length;
            ctx.drawImage(hullBg, 0, 0);
            if (opened) ctx.drawImage(hole, 0, 0);
            if (opened && s.openT > 2) {                                     // one small glint, far inside
                const tw = (clock * 1.1) % 1 < 0.22;
                Lab.dot(ctx, GLINT.x, GLINT.y, tw ? C.white : C.gold);
                if (tw) PLUS.forEach(([ox, oy]) => Lab.dot(ctx, GLINT.x + ox, GLINT.y + oy, C.amber));
            }
            drawBurns(opened);
            const march = Math.floor(clock * 6), blink = f >= 0.85 && Math.floor(clock * 3) % 2;   // cut here, as a dashed line; later, what is left
            if (!opened && (!s.fired || blink)) SEAM.forEach((i, k) => { const x = i % W, y = (i - x) / W; if (s.seamCut[k]) return;
                if (blink) [[0, 0], ...PLUS].forEach(([ox, oy]) => Lab.dot(ctx, x + ox, y + oy, C.amber)); else if ((x + y + march) % 4 < 2) Lab.dot(ctx, x, y, C.amber); });
            if (opened && s.openT < 9) {                                     // the hatch drifts out towards us and away
                const t = s.openT, k = 1 + 0.08 * t;
                ctx.save(); ctx.imageSmoothingEnabled = false;
                ctx.translate(Math.round(HB.cx + 12 * t + 2.5 * t * t), Math.round(HB.cy - 5 * t)); ctx.rotate(0.06 * t); ctx.scale(k, k);
                ctx.drawImage(lidShadow, Math.round(-HB.cx + 2 + 3 * t), Math.round(-HB.cy + 2 + 3 * t));   // lifting off, it casts a shadow
                ctx.drawImage(lid, -HB.cx, -HB.cy);
                ctx.restore();
            }
            drawSparks();
            if (s.phase === 'cut' || s.phase === 'dry') drawTorch();
            hud(8, 132, [['SEAM', f, f >= 1 ? C.greenBr : C.bone]], [['SCARS ' + s.scars + '  WARPS ' + s.warps.length, C.boneD]]);
        }
        function renderDisc() {
            ctx.drawImage(discBg, 0, 0);
            const bx = DX - DR - 6 + s.sweep * (2 * DR + 12), lit = s.phase === 'closing' ? 0.6 : 0.3;   // the light's sweep, reading
            for (let x = Math.ceil(bx - 5); x <= bx + 5; x++) {
                const half = Math.sqrt(Math.max(0, DR * DR - (x - DX) * (x - DX)));
                if (half > 0) Lab.shade(ctx, x, DY - half, 1, half * 2, lit * (1 - Math.abs(x - bx) / 5), C.gold);
            }
            const glint = x => (Math.abs(x - bx) < 1 ? C.white : C.gold);
            LINES.forEach((l, j) => {
                const ex = DX + l.ux * l.len, ey = DY + l.uy * l.len, t = s.cutT[j];
                if (t !== null && clock - t > 0.35) return Lab.line(ctx, DX, DY, ex, ey, C.boneD, 0.3);   // cut: a dead line, nothing to read
                Lab.line(ctx, DX, DY, ex, ey, t !== null ? C.gold : C.boneD);                            // just cut, it flashes
                [-3, -2, 2, 3].forEach(o => Lab.dot(ctx, DX + l.ux * l.notch - l.uy * o, DY + l.uy * l.notch + l.ux * o, t !== null ? C.gold : C.bone));
                if (t === null) for (let d = 0; d <= l.len; d += 0.5) { const x = DX + l.ux * d; if (Math.abs(x - bx) < 3) Lab.dot(ctx, x, DY + l.uy * d, glint(x)); }
            });
            FIG_PX.forEach(p => Lab.dot(ctx, p.x, p.y, Math.abs(p.x - bx) < 3 ? glint(p.x) : C.gold));
            if (!s.centre) { Lab.dot(ctx, DX, DY, C.white); PLUS.forEach(([ox, oy]) => Lab.dot(ctx, DX + ox, DY + oy, C.gold)); }
            drawBurns(false); drawSparks();
            if (s.phase === 'cut' || s.phase === 'dry') drawTorch();
            const n = s.cutT.filter(v => v !== null).length;
            hud(8, 8, [], [['LINES ' + String(n).padStart(2, '0') + '/14', n === 14 ? C.greenBr : C.bone], ['CENTRE ' + (s.centre ? 'CUT' : '--'), s.centre ? C.greenBr : C.bone]]);
        }

        // ── input ──
        const cv = ui.canvas, toAim = e => { const p = ui.toPixel(e); return { x: p.x - 0.5, y: p.y - 0.5 }; };
        cv.onpointerdown = e => {
            if (e.button > 0) return;
            aim = toAim(e);
            if (s.phase === 'cut') { s.tip = clampTip(aim.x, aim.y); ptrFire = true; s.burst = BURST; }
            try { cv.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointers cannot be captured */ }
        };
        cv.onpointermove = e => { aim = toAim(e); };
        cv.onpointerup = cv.onpointercancel = () => { ptrFire = false; };
        Lab.onKey((k, e) => {
            const own = !!(e && e.target && e.target.dataset && e.target.dataset.id === 'torch');    // this sketch's own list item has focus
            if (own && (DIRS[k] || k === ' ' || k === 'Enter')) e.preventDefault();                // so Space does not restart it, arrows do not scroll
            if (DIRS[k]) { if (!e || !e.repeat) nudge(DIRS[k]); }                                   // held keys glide in moveTip, not by key repeat
            else if (k === ' ' && s.phase === 'cut') s.burst = BURST;
            else if (k === 'Enter' && (own || !(e && e.target && e.target.tagName === 'BUTTON')) && (s.phase === 'end' || s.phase === 'dry')) next();
        });

        Lab.loop(dt => { clock += dt; update(dt); if (s.part === 'hatch') renderHatch(); else renderDisc(); }, 30);
        start('hatch');
        renderHatch();
        return () => { ptrFire = false; cv.onpointercancel = null; ctx.setTransform(1, 0, 0, 1, 0, 0); };
    }

    Lab.register({
        id: 'torch', badge: 'new',
        name: 'The cutting torch',
        short: 'Cut open a dead hatch',
        verb: "Trace a dead ship's hatch seam with a torch, slow enough to cut and quick enough not to overheat, then take the same torch to the disc.",
        serves: 'Boarding the dead ships, and the finale: the same torch is how the map on the disc gets destroyed before the light can read it.',
        replaces: 'The instant "enter the wreck" choice.',
        controls: 'Hold the mouse and drag to cut · or arrows/WASD and hold Space · Enter: next',
        mount,
    });
})();
