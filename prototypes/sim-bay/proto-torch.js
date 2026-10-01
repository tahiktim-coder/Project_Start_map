/* proto-torch.js — The cutting torch.
   HATCH: a dead ship has no power, so you cut its hatch open along the seam. The flame only cuts through where it
   sits long enough; linger and the plate overheats (the torch pauses, the plate warps); stray off the seam and you
   burn a scar that wastes fuel. THE DISC: the same torch in the finale, on the 1977 disc. Burn the centre point and
   each of the fourteen lines close to it, and leave the two figures and the rim alone. Draws at 320×180 through Lab. */
(function () {
    'use strict';
    const Lab = window.Lab, C = Lab.C, W = Lab.W, H = Lab.H;
    const RAMP = Lab.ship.HULL_RAMP, DARK_RED = '#6e241d';      // the ship's hull ramp and its emergency red (ship.js)
    const PLUS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

    // ── the torch: one set of physics for both parts ──
    const BURN = 8.5, BURN_R = 1.8;             // depth per second under the flame (1 = through), flame radius: cuts below ~15 px/s
    const FIRE_SPEED = 22, FREE_SPEED = 260;    // how fast the tip follows the pointer while cutting, and while not (px/s)
    const KEY_FIRE = 12, KEY_FREE = 24, KEY_DELAY = 0.2;   // keys and arrow buttons: a tap moves one pixel, holding glides
    const BURST = 0.12;                         // even a quick click on the trigger gives a short burst
    const CELL = 2, GW = W / CELL, GH = H / CELL;          // the heat grid
    const HEAT_IN = 1.6, WARN = 0.75, COOLED = 0.45;       // heat per second under the flame; at 1 it pauses until COOLED
    const PARTS = { hatch: { fuel: 45, tau: 1.5, spread: 1, burn: 1 }, disc: { fuel: 25, tau: 2.5, spread: 2, burn: 2.5 } };   // fuel seconds, cooling, heat spread, burn speed: the disc is thin gold

    // ── HATCH: a rounded-rectangle seam, measured by its signed distance ──
    const HB = { cx: 214, cy: 86, hw: 28, hh: 34, r: 7 };
    const sdf = (x, y) => {
        const qx = Math.abs(x - HB.cx) - HB.hw + HB.r, qy = Math.abs(y - HB.cy) - HB.hh + HB.r;
        return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - HB.r;
    };
    const ON_SEAM = 2.5;                        // a kerf within two pixels of the seam frees it; further out is a scar
    const SEAM = [], SEAM_AT = new Int16Array(W * H).fill(-1);
    for (let y = HB.cy - HB.hh - 1; y <= HB.cy + HB.hh + 1; y++) {
        for (let x = HB.cx - HB.hw - 1; x <= HB.cx + HB.hw + 1; x++) if (Math.abs(sdf(x, y)) <= 0.5) { SEAM_AT[y * W + x] = SEAM.length; SEAM.push(y * W + x); }
    }
    const EDGES = [27, 137], JOINTS = [[118, 262], [92, 292], [54, 200]];   // the hull's plate joints
    const GLINT = { x: HB.cx - 11, y: HB.cy + 19 };

    // ── THE DISC: the same fourteen lines as the dating sketch, closer ──
    const DX = 160, DY = 90, DR = 84, CUT_NEAR = 5, CUT_FAR = 28, ON_LINE = 1.1;
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
    const FIGS = [{ x: 167, y: 135, rows: MAN }, { x: 180, y: 135, rows: WOMAN }];
    const guardAt = (x, y) => (Math.abs(Math.hypot(x - DX, y - DY) - DR) <= 3 ? 'rim'     // the rim, and the figures plus two pixels
        : x >= 165 && x <= 188 && y >= 133 && y <= 153 ? 'fig' : null);

    const SAY = {
        hatch: [['', "EXODUS-6. Dead about twenty years. No power, so the airlock won't open."],
            ['Jaxon', 'Trace the seam all the way round. Let it cut through before you move on.']],
        fast: ['Jaxon', "Too fast. That's only marking the plate, not cutting it."], hot: ['Jaxon', "The plate's getting hot. Keep moving."],
        stray: ['Vance', "You're off the seam. That's fuel we don't get back."], half: ['Vance', 'Halfway. Still nothing warm on the other side.'],
        warp: ['Jaxon', "Too hot, and now it's warped. Let it cool a second."], gap: ['Jaxon', "It's still holding somewhere. Find the bit you missed."],
        open: [['', 'The seam lets go. The hatch drifts out.'], ['Vance', 'Hold on. Something in there caught your light.'],
            ['Jaxon', 'Twenty years in the dark. Go slow in there.']],
        hatchDry: [['', 'The tank is empty. The hatch still holds.'], ['Jaxon', "Come back to the lander. We'll swap the tank."]],
        disc: [['', 'The disc. Fourteen lines from one point. Where they meet is home.'],
            ['', 'Burn the centre, then each line close to it. Leave the figures and the rim.']],
        discHot: ['', 'The gold is too hot to cut. Wait for it to cool.'],
        fig: ['', 'You pull the torch back from the figures.'], rim: ['', 'You pull the torch back from the rim.'],
        done: ['A.U.R.A.', 'The map is gone, Commander.'],
        clean: ['', 'The two figures are still there. The light already knew what we look like.'],
        marked: ['', 'The figures are scorched where the torch touched. The map is gone all the same.'],
        discDry: [['', 'The tank is empty. The map is still there.']],
    };
    const DIRS = { ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0], ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1] };

    // ── the pictures, painted once ──
    const hash = (a, b) => { const h = Math.imul(a, 374761393) + Math.imul(b, 668265263) | 0, k = Math.imul(h ^ (h >>> 13), 1274126177); return ((k ^ (k >>> 16)) >>> 0) / 4294967296; };
    function paint(fn) { const c = document.createElement('canvas'); c.width = W; c.height = H; fn(c.getContext('2d')); return c; }
    function eachPixel(fn) { for (let i = 0; i < W * H; i++) fn(i % W, (i / W) | 0); }
    function paintWorn(b, str, x, y, scale, color, keep) {          // old paint: the pixel font with a few flakes missing
        const data = paint(c => Lab.text(c, str, 0, 0, '#fff', scale)).getContext('2d').getImageData(0, 0, W, 5 * scale).data;
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
        FIGS.forEach(f => f.rows.forEach((row, ry) => [...row].forEach((c, rx) => { if (c === '#') Lab.dot(b, f.x + rx, f.y + ry, C.gold); })));
    }

    function mount(ctx, ui) {
        const hullBg = paint(paintHull), discBg = paint(paintDisc), hole = paint(paintHole);
        const lid = paint(b => { b.drawImage(hullBg, 0, 0); eachPixel((x, y) => { if (sdf(x, y) > -0.5) b.clearRect(x, y, 1, 1); }); });
        const lidShadow = paint(b => { b.fillStyle = C.void; eachPixel((x, y) => { if (sdf(x, y) <= -0.5 && Lab.on(x, y, 0.6)) b.fillRect(x, y, 1, 1); }); });
        let s = null, clock = 0, ptrFire = false, btnFire = false, btnDir = null, aim = null;
        const speak = (line, then) => { s.speech = s.speech.concat({ line, then }); };
        const once = (key, line) => { if (!s.said[key]) { s.said = { ...s.said, [key]: true }; speak(line); } };
        const clampTip = (x, y) => ({ x: Lab.clamp(x, 2, W - 3), y: Lab.clamp(y, 2, H - 3) });
        const cellOf = p => Lab.clamp(Math.floor((p.y + 0.5) / CELL), 0, GH - 1) * GW + Lab.clamp(Math.floor((p.x + 0.5) / CELL), 0, GW - 1);
        const heatAt = p => s.heat[cellOf(p)];
        const paused = () => s.pause > 0 || !!s.hotSpot;

        function start(part) {
            ptrFire = btnFire = false; btnDir = null; aim = null;
            s = { part, P: PARTS[part], phase: 'cut', tip: part === 'hatch' ? { x: HB.cx - HB.hw - 12, y: HB.cy } : { x: 118, y: 124 },
                speed: 0, holdT: 0, burst: 0, fuel: 1, pause: 0, hotSpot: null, firing: false, heat: new Float32Array(GW * GH), spare: new Float32Array(GW * GH),
                depth: new Float32Array(W * H), lastT: new Float32Array(W * H).fill(-99), thruT: new Float32Array(W * H), marks: [],
                sparks: [], warps: [], speech: [], nextSay: 0, said: {}, scars: 0, strayT: 0, fastT: 0,
                seamCut: new Uint8Array(SEAM.length), cut: 0, lastCut: 0, stall: 0, openT: 0,
                lineCut: LINES.map(() => null), centre: false, touches: 0, figTouched: false };
            ui.clear();
            SAY[part].forEach(l => speak(l));
            showButtons();
        }
        function showButtons() {
            const hatch = { label: 'Hatch', onClick: () => start('hatch') }, disc = { label: 'The disc', onClick: () => start('disc') };
            if (s.phase === 'end' && s.part === 'hatch') return ui.buttons([{ ...disc, primary: true }, { label: 'Run it again', onClick: () => start('hatch') }]);
            if (s.phase === 'end') return ui.buttons([{ label: 'Run it again', primary: true, onClick: () => start('hatch') }, disc]);
            if (s.phase === 'dry') return ui.buttons([{ label: 'New tank', primary: true, onClick: () => start(s.part) }, hatch, disc]);
            if (s.phase !== 'cut') return ui.buttons([{ ...hatch, quiet: true }, { ...disc, quiet: true }]);
            const arrow = (label, d) => ({ label, hold: true, onDown: () => { nudge(d); btnDir = d; }, onUp: () => { btnDir = null; } });
            ui.buttons([arrow('←', [-1, 0]), arrow('↑', [0, -1]), arrow('↓', [0, 1]), arrow('→', [1, 0]),
                { label: 'Fire', hold: true, primary: true, onDown: () => { btnFire = true; s.burst = BURST; }, onUp: () => { btnFire = false; } }, hatch, disc]);
        }

        // ── the tip and the flame ──
        function nudge(d) { if (s.phase === 'cut') { aim = null; s.tip = clampTip(s.tip.x + d[0], s.tip.y + d[1]); } }
        function moveTip(dt, wants) {
            const before = s.tip;
            let dx = btnDir ? btnDir[0] : 0, dy = btnDir ? btnDir[1] : 0;
            Object.entries(DIRS).forEach(([k, [x, y]]) => { if (Lab.keys.has(k)) { dx += x; dy += y; } });
            if (dx || dy) {
                aim = null; s.holdT += dt;
                const k = s.holdT > KEY_DELAY ? ((wants ? KEY_FIRE : KEY_FREE) * dt) / Math.hypot(Math.sign(dx), Math.sign(dy)) : 0;
                s.tip = clampTip(s.tip.x + Math.sign(dx) * k, s.tip.y + Math.sign(dy) * k);
            } else s.holdT = 0;
            if (aim) {
                const ax = aim.x - s.tip.x, ay = aim.y - s.tip.y, dist = Math.hypot(ax, ay), max = (wants ? FIRE_SPEED : FREE_SPEED) * dt;
                s.tip = dist <= max ? clampTip(aim.x, aim.y) : clampTip(s.tip.x + (ax / dist) * max, s.tip.y + (ay / dist) * max);
            }
            s.speed = Math.hypot(s.tip.x - before.x, s.tip.y - before.y) / Math.max(dt, 0.001);
        }
        const solid = (x, y) => s.part === 'hatch' || Math.hypot(x - DX, y - DY) <= DR;     // off the disc there is nothing to burn
        function burn(dt) {
            const { x: tx, y: ty } = s.tip, x0 = Math.round(tx), y0 = Math.round(ty);
            if (!solid(tx, ty)) return;
            for (let y = y0 - 2; y <= y0 + 2; y++) for (let x = x0 - 2; x <= x0 + 2; x++) {
                const w = 1 - Math.hypot(x - tx, y - ty) / BURN_R, i = y * W + x, was = s.depth[i];
                if (w <= 0 || x < 0 || y < 0 || x >= W || y >= H || !solid(x, y)) continue;
                if (was === 0) s.marks.push(i);
                s.depth[i] = Math.min(2, was + BURN * s.P.burn * w * dt); s.lastT[i] = clock;
                if (was < 1 && s.depth[i] >= 1) { s.thruT[i] = clock; through(x, y); }
            }
            const c = cellOf(s.tip), gx = c % GW, gy = (c - gx) / GW;
            for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) if (gx + ox >= 0 && gy + oy >= 0 && gx + ox < GW && gy + oy < GH) s.heat[c + oy * GW + ox] += HEAT_IN * dt * (ox && oy ? 0.25 : ox || oy ? 0.5 : 1);
            for (let k = 0; k < 2; k++) if (Math.random() < dt * 30) {
                const a = Math.random() * Math.PI * 2, v = 20 + Math.random() * 40;       // no air: sparks fly straight
                s.sparks = s.sparks.concat({ x: tx, y: ty, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.2 + Math.random() * 0.4 });
            }
        }
        function through(x, y) {
            if (s.part === 'hatch') {                                       // a kerf within two pixels frees that bit of seam
                for (let k, oy = -2; oy <= 2; oy++) for (let ox = -2; ox <= 2; ox++) if ((k = SEAM_AT[(y + oy) * W + x + ox]) >= 0 && !s.seamCut[k]) { s.seamCut[k] = 1; s.cut++; }
                return;
            }
            if (Math.hypot(x - DX, y - DY) <= 1.2) s.centre = true;
            LINES.forEach((l, j) => { const a = along({ x, y }, l); if (s.lineCut[j] === null && a >= CUT_NEAR && a <= CUT_FAR && across({ x, y }, l) <= ON_LINE) s.lineCut[j] = a; });
        }
        function isStray(p) {
            if (s.part === 'hatch') return Math.abs(sdf(p.x, p.y)) > ON_SEAM;
            return Math.hypot(p.x - DX, p.y - DY) > 2 && !LINES.some(l => along(p, l) >= -1 && along(p, l) <= l.len + 1 && across(p, l) <= 1.6);
        }
        function touch(g) {
            const i = Math.round(s.tip.y) * W + Math.round(s.tip.x);
            s.pause = 0.9; s.touches++; s.figTouched = s.figTouched || g === 'fig';
            if (solid(s.tip.x, s.tip.y)) { if (s.depth[i] === 0) s.marks.push(i); s.depth[i] = Math.max(s.depth[i], 0.6); s.lastT[i] = clock; }   // a scorch, not a cut
            once(g, SAY[g]);
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
            if (s.phase === 'open' || s.phase === 'end') s.openT += dt;
            if (s.speech.length && clock >= s.nextSay) {                  // one line at a time, long enough to read
                const [next, ...rest] = s.speech;
                s.speech = rest;
                ui.say(next.line[0], next.line[1]);
                s.nextSay = clock + Lab.clamp(1.2 + 0.24 * next.line[1].split(' ').length, 2.2, 4);
                if (next.then) next.then();
            }
            if (s.phase !== 'cut') { s.firing = false; return; }
            s.burst = Math.max(0, s.burst - dt);
            const wants = ptrFire || btnFire || Lab.keys.has(' ') || s.burst > 0;
            moveTip(dt, wants);
            s.pause = Math.max(0, s.pause - dt);
            if (s.hotSpot && s.pause <= 0 && heatAt(s.hotSpot) <= COOLED) s.hotSpot = null;
            const guard = s.part === 'disc' && wants && !paused() && guardAt(s.tip.x, s.tip.y);
            if (guard) touch(guard);
            s.firing = wants && !paused() && s.fuel > 0;
            if (s.firing) fire(dt);
            else { s.strayT = 0; s.fastT = 0; }
            if (s.part === 'hatch') hatchRules(dt); else discRules();
            if (s.fuel <= 0 && s.phase === 'cut') { s.phase = 'dry'; s.speech = []; SAY[s.part + 'Dry'].forEach(l => speak(l)); showButtons(); }
        }
        function fire(dt) {
            s.fuel = Math.max(0, s.fuel - dt / s.P.fuel);
            burn(dt);
            const h = heatAt(s.tip), stray = isStray(s.tip), w = { x: Math.round(s.tip.x), y: Math.round(s.tip.y) };
            if (h >= WARN && s.part === 'hatch') once('hot', SAY.hot);
            if (h >= 1) {
                s.pause = 1; s.hotSpot = { ...s.tip };
                if (!s.warps.some(o => Math.hypot(o.x - w.x, o.y - w.y) < 5)) s.warps = s.warps.concat(w);   // one warp per spot
                once('warp', s.part === 'hatch' ? SAY.warp : SAY.discHot);
            }
            s.strayT = stray ? s.strayT + dt : 0;
            if (stray && s.strayT >= 0.15 && s.strayT - dt < 0.15) { s.scars++; if (s.part === 'hatch') once('stray', SAY.stray); }
            s.fastT = !stray && s.speed > 16 ? s.fastT + dt : Math.max(0, s.fastT - dt);
        }
        function hatchRules(dt) {
            const f = s.cut / SEAM.length;
            if (s.fastT > 0.8) once('fast', SAY.fast);
            if (f >= 0.5) once('half', SAY.half);
            s.stall = s.cut === s.lastCut ? s.stall + dt : 0; s.lastCut = s.cut;
            if (f >= 0.9 && s.stall > 3) once('gap', SAY.gap);
            if (s.cut < SEAM.length) return;
            s.phase = 'open'; s.openT = 0; s.speech = []; s.nextSay = 0;
            for (let k = 0; k < 60; k++) {                                   // the last of the air, and twenty years of dust
                const i = SEAM[Math.floor(Math.random() * SEAM.length)], x = i % W, y = (i - x) / W, a = Math.atan2(y - HB.cy, x - HB.cx), v = 6 + Math.random() * 16;
                s.sparks = s.sparks.concat({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1 + Math.random() * 1.4, dust: true });
            }
            SAY.open.forEach((l, j) => speak(l, j === SAY.open.length - 1 ? () => { s.phase = 'end'; showButtons(); } : null));
            showButtons();
        }
        function discRules() {
            if (!s.centre || s.lineCut.some(v => v === null)) return;
            s.phase = 'closing'; s.speech = []; s.nextSay = clock + 1.4;    // a breath, then A.U.R.A.
            speak(SAY.done);
            speak(s.figTouched ? SAY.marked : SAY.clean, () => { s.phase = 'end'; showButtons(); });
            showButtons();
        }

        // ── drawing ──
        function markColor(i) {
            const d = s.depth[i];
            if (d >= 1) { const age = clock - s.thruT[i]; return age < 0.35 ? C.white : age < 1.1 ? C.gold : age < 2.6 ? C.amber : age < 5 ? C.red : DARK_RED; }
            if (clock - s.lastT[i] < 0.8) return d > 0.5 ? C.amber : C.red;
            return d > 0.3 ? C.ink : null;
        }
        function drawBurns(opened) {                                         // tint, glow, kerf, sparks
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
            const col = paused() ? (Math.floor(clock * 4) % 2 ? C.red : DARK_RED) : s.part === 'disc' ? C.white : C.amber;
            PLUS.forEach(([ox, oy]) => Lab.dot(ctx, x + ox * 3, y + oy * 3, col));
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
            const opened = s.phase === 'open' || s.phase === 'end', f = s.cut / SEAM.length;
            ctx.drawImage(hullBg, 0, 0);
            if (opened) ctx.drawImage(hole, 0, 0);
            if (opened && s.openT > 2) {                                     // one small glint, far inside
                const tw = (clock * 0.8) % 1 < 0.14;
                Lab.dot(ctx, GLINT.x, GLINT.y, tw ? C.white : C.gold);
                if (tw) PLUS.forEach(([ox, oy]) => Lab.dot(ctx, GLINT.x + ox, GLINT.y + oy, C.amber));
            }
            drawBurns(opened);
            if (!opened && f >= 0.85 && Math.floor(clock * 3) % 2) SEAM.forEach((i, k) => { if (!s.seamCut[k]) Lab.dot(ctx, i % W, (i / W) | 0, C.amber); });
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
        function renderDisc(now) {
            ctx.drawImage(discBg, 0, 0);
            const bx = DX - DR + ((now / 8000) % 1) * 2 * DR;                // the light's slow sweep, as on the dating sketch
            for (let x = Math.ceil(bx - 5); x <= bx + 5; x++) {
                const half = Math.sqrt(Math.max(0, DR * DR - (x - DX) * (x - DX)));
                Lab.shade(ctx, x, DY - half, 1, half * 2, 0.07 * (1 - Math.abs(x - bx) / 5), C.gold);
            }
            LINES.forEach((l, j) => {
                const ex = DX + l.ux * l.len, ey = DY + l.uy * l.len, cut = s.lineCut[j];
                const notch = col => [-3, -2, 2, 3].forEach(o => Lab.dot(ctx, DX + l.ux * l.notch - l.uy * o, DY + l.uy * l.notch + l.ux * o, col));
                if (cut === null) { Lab.line(ctx, DX, DY, ex, ey, C.boneD); return notch(C.bone); }
                const mx = DX + l.ux * cut, my = DY + l.uy * cut;
                Lab.line(ctx, DX, DY, mx, my, s.centre ? C.amber : C.boneD, s.centre ? 0.35 : 1);
                Lab.line(ctx, mx, my, ex, ey, C.amber, 0.35);                // a cut line goes dead past the cut
                notch(C.amber);
            });
            if (!s.centre) { Lab.dot(ctx, DX, DY, C.white); PLUS.forEach(([ox, oy]) => Lab.dot(ctx, DX + ox, DY + oy, C.gold)); }
            drawBurns(false); drawSparks();
            if (s.phase === 'cut' || s.phase === 'dry') drawTorch();
            const n = s.lineCut.filter(v => v !== null).length;
            hud(8, 8, [], [['LINES ' + String(n).padStart(2, '0') + '/14', n === 14 ? C.greenBr : C.bone], ['CENTRE ' + (s.centre ? 'CUT' : '--'), s.centre ? C.greenBr : C.bone],
                ['STRAY ' + s.scars + '  TOUCH ' + s.touches, s.touches ? C.amber : C.boneD]]);
        }

        // ── input ──
        const cv = ui.canvas, toAim = e => { const p = ui.toPixel(e); return { x: p.x - 0.5, y: p.y - 0.5 }; };
        cv.onpointerdown = e => {
            aim = toAim(e);
            if (s.phase === 'cut') { s.tip = clampTip(aim.x, aim.y); ptrFire = true; s.burst = BURST; }
            try { cv.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointers cannot be captured */ }
        };
        cv.onpointermove = e => { aim = toAim(e); };
        cv.onpointerup = cv.onpointercancel = () => { ptrFire = false; };
        Lab.onKey((k, e) => {
            if (DIRS[k]) nudge(DIRS[k]);
            else if (k === ' ' && s.phase === 'cut') s.burst = BURST;
            else if (k === 'Enter' && !(e && e.target && e.target.tagName === 'BUTTON') && (s.phase === 'end' || s.phase === 'dry')) {
                start(s.phase === 'dry' ? s.part : s.part === 'hatch' ? 'disc' : 'hatch');      // Enter takes the highlighted button
            }
        });

        Lab.loop((dt, now) => { clock += dt; update(dt); if (s.part === 'hatch') renderHatch(); else renderDisc(now); }, 30);
        start('hatch');
        renderHatch();
        return () => { ptrFire = btnFire = false; btnDir = null; cv.onpointercancel = null; ctx.setTransform(1, 0, 0, 1, 0, 0); };
    }

    Lab.register({
        id: 'torch', badge: 'new',
        name: 'The cutting torch',
        short: 'Cut open a dead hatch',
        verb: "Trace a dead ship's hatch seam with a torch, slow enough to cut and quick enough not to overheat, then take the same torch to the disc.",
        serves: 'Boarding the dead ships, and the finale: the same torch is how the map on the disc gets destroyed.',
        replaces: 'The instant "enter the wreck" choice.',
        controls: 'Hold the mouse to cut · or arrows/WASD to move, Space to fire · Enter: next',
        mount,
    });
})();
