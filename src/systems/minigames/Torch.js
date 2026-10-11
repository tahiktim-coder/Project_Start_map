/* Torch.js — the cutting torch, played over the game by MiniHost as 'torch' (ported from prototypes/sim-bay/proto-torch.js).
   HATCH: the away team boards one of our wrecks. It has no power, so you cut its hatch open along the seam. The flame only cuts
   through where it moves slowly enough; linger and the plate overheats (the torch pauses, the plate warps); stray off the seam
   and you burn a scar. The suit marks what is still to cut. With the keys, the torch rides the seam round corners.
   FEEDBACK: the metal under the flame shows its heat (dull, red, orange, then white when it is cut through), and the cut cools to
   a dark slot behind you; sparks fly only while metal is really cut. Off the seam the plate is thick: the flame only scorches it.
   One short readout by the torch says what to do the first time, what is going wrong, and how far the cut has got.
   The system pointer is hidden over the picture while you hold the torch: the drawn torch is the pointer.
   A crew member can take the torch at any time ("Let Jaxon cut it"): they finish the cut slowly and carefully, without you.
   THE DISC (for the finale): the same torch on the 1977 disc. The light's sweep reads every live line. Burn the centre and cut
   each line inside the marked ring; the last sweep finds no map, only the two figures.
   SOUND (only while the game's sound is on): a hiss that brightens with heat, spits while metal is really cut, ticks of cooling
   metal, a groan as the last of the seam holds; then a clunk, a rush of air, a long ring and a soft thud as the hatch drifts off.
   On the disc a finer hiss, and one bell when the last line goes.
   LOOK (2026-10-11, the travel view's world; the rules, timings, words and results unchanged): 720 × 405 art pixels (density
   1.5). The wreck is our own hull class seen close: plated, riveted, a porthole, rust by how long it has been dead, the sector's
   own sky and light over its edge. Our clamp lamp lights the hatch; Jaxon (the cutter) floats by it in his suit on a tether,
   and when he takes the torch he works the seam from beside it. The disc is pressed gold drifting into a close false sun.
   The readouts are MiniHost notes in IBM Plex: one by the torch, a few quiet ones in the corner.

   const result = await MiniHost.play('torch', opts)
   opts: { mode: 'hatch' | 'disc'  (default 'hatch')
           hull: 'EXODUS-6'         named in the first line; the game's getWreckName() ('EXODUS-4 "LAZARUS"') is fine, the number is painted
           sector: 1..6             how long the wreck has been dead (docs/CANON.md §2); deadFor: 'twenty years' overrides it
           cutter: 'Jaxon'          coaches the cut and can take the torch; pass a living crew member ('Vance' if Jaxon is dead);
                                    a titled name from an old save ('Eng. Jaxon') is shortened to its last word
           spotter: 'Vance' }       says the other lines; pass a living crew member (may be the same as cutter)
   result, hatch: { opened: true, fuelLeft: 0..1 in the last tank, scars, warps, tanks: tanks used, bySelf: false if handed over }
   result, disc:  { destroyed: true, figuresScorched: the torch touched the two figures, fuelLeft, tanks } */
(function () {
    'use strict';
    const MiniLab = window.MiniLab, MiniHost = window.MiniHost;
    if (!MiniLab || !MiniHost) return;
    const C = MiniLab.C, W = MiniLab.W, H = MiniLab.H, PLUS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

    // ── the torch: one set of physics for both parts ──
    const BURN = 12.5, BURN_R = 2.4, FAST = 31;              // depth per second under the flame (1 = through), its radius: it cuts below ~30 px/s
    const BURST = 0.2, FPS = 60;                             // even a quick click gives a short burst; the drawn torch is the pointer, so it draws at 60 a second
    const KEY_FIRE = 22, KEY_FREE = 45, KEY_DELAY = 0.2;     // keys: a tap moves one pixel, holding glides
    const CELL = 3, GW = W / CELL, GH = H / CELL, HEAT_IN = 1.6, WARN = 0.75, COOLED = 0.45;   // the heat grid; at 1 the torch pauses until COOLED
    const PARTS = { hatch: { fuel: 40, tau: 1.5, spread: 1, burn: 1, heat: 1 }, disc: { fuel: 20, tau: 2.5, spread: 2, burn: 1.3, heat: 1.8 } };   // the disc is thin gold
    const REACT_GAP = 1.2, KERF_COOL = 1.6, HOT_FADE = 3.5;  // reactions wait after the line before; a cut fades white → warm → dark; cooling ticks fade
    const HEAT_SHOW = 0.45, OFF_SEAM_MAX = 0.45, SPARK_CHANCE = 0.7;   // s an uncut patch keeps its red; off the seam the flame only scorches; sparks per pixel cut through

    // ── the readout by the torch: one short line at a time, never over the seam the torch is on ──
    const STANDOFF = 3, LABEL_GAP = 8, LABEL_SCALE = 2;      // the nozzle is held this far off the metal, so the glow under the flame stays in view
    const STRAY_AFTER = 0.15, FAST_AFTER = 0.3, IDLE_AFTER = 0.35, IDLE_SPEED = 6, READOUT_FOR = 0.8, TAUGHT_AT = 0.05;   // s, s, s, px/s, s, share of the seam
    const HINTS = {                                          // the first time only: what to do, in plain words
        hatch: [['PRESS AND HOLD', 'ON THE DOTTED LINE'], ['WHITE MEANS CUT', 'FOLLOW THE LINE SLOWLY']],
        disc: [['PRESS AND HOLD ON A LINE', 'INSIDE THE DOTTED RING']],
    };
    let taught = { hatch: false, disc: false };              // for this page: once the player has cut a little, the hints stay away

    // ── HATCH: a rounded-rectangle seam, measured by its signed distance ──
    const HB = { cx: 322, cy: 132, hw: 42, hh: 51, r: 10 }, HATCH_BOX = [HB.cx - HB.hw - 1, HB.cy - HB.hh - 1, HB.cx + HB.hw + 1, HB.cy + HB.hh + 1];
    const sdf = (x, y) => {
        const qx = Math.abs(x - HB.cx) - HB.hw + HB.r, qy = Math.abs(y - HB.cy) - HB.hh + HB.r;
        return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - HB.r;
    };
    const normal = (x, y, nx = sdf(x + 0.5, y) - sdf(x - 0.5, y), ny = sdf(x, y + 0.5) - sdf(x, y - 0.5)) =>   // which way is "out" from the seam
        ({ x: nx / (Math.hypot(nx, ny) || 1), y: ny / (Math.hypot(nx, ny) || 1) });
    const ON_SEAM = 3.5, FREE_R = 3, TEAR = 0.97, GROAN_FROM = 0.8, THUD_AT = 2.3;   // a kerf within 3 px frees the seam; at TEAR it tears free; it groans from 80%; the lid knocks the rim
    const SEAM = [], SEAM_AT = new Int16Array(W * H).fill(-1);
    for (let y = HATCH_BOX[1]; y <= HATCH_BOX[3]; y++) for (let x = HATCH_BOX[0]; x <= HATCH_BOX[2]; x++) if (Math.abs(sdf(x, y)) <= 0.5) { SEAM_AT[y * W + x] = SEAM.length; SEAM.push(y * W + x); }
    const NEAR_SEAM = new Uint8Array(W * H);                 // where the plate is thin enough to cut: the seam and a hand's width either side
    for (let y = HATCH_BOX[1] - 5; y <= HATCH_BOX[3] + 5; y++) for (let x = HATCH_BOX[0] - 5; x <= HATCH_BOX[2] + 5; x++) if (Math.abs(sdf(x, y)) <= ON_SEAM) NEAR_SEAM[y * W + x] = 1;

    // ── the crew member's cut: the seam walked one pixel at a time, clockwise from the left edge ──
    const AUTO_CUT = KEY_FIRE, AUTO_GLIDE = 45, AUTO_REACH = 90;   // px/s: cutting (a held key's steady pace, under FAST), over seam already cut, out to the seam
    const AUTO_HOT = 0.6, AUTO_COOLED = 0.35, AUTO_BEHIND = 2, AUTO_AHEAD = 4;   // they stop to let the plate cool long before it warps
    const PATH = (() => {
        const pts = [{ x: HB.cx - HB.hw, y: HB.cy }];
        for (let k = 0; k < 1000; k++) {                         // step along the seam, then settle back onto it (as the keys do)
            const p = pts[pts.length - 1], n = normal(p.x, p.y), q = { x: p.x - n.y, y: p.y + n.x }, e = sdf(q.x, q.y);
            const next = { x: q.x - n.x * e, y: q.y - n.y * e };
            if (k > 10 && Math.hypot(next.x - pts[0].x, next.y - pts[0].y) < 1) break;
            pts.push(next);
        }
        return pts;
    })();
    const PATH_SEAM = PATH.map(p => {                            // the seam pixels at each step of the path
        const ks = [];
        for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) { const k = SEAM_AT[(Math.round(p.y) + oy) * W + Math.round(p.x) + ox]; if (k >= 0) ks.push(k); }
        return ks;
    });
    const STEPS = PATH.length, wrapPath = j => ((j % STEPS) + STEPS) % STEPS, stepAt = j => Math.round(wrapPath(j)) % STEPS;
    function pathAt(j) {                                         // a point between two steps; j is already wrapped
        const i = Math.floor(j), a = PATH[i], b = PATH[(i + 1) % STEPS];
        return { x: MiniLab.lerp(a.x, b.x, j - i), y: MiniLab.lerp(a.y, b.y, j - i) };
    }
    const bend = x => ((x - 330) / 330) ** 2, horizon = x => Math.round(14 + 26 * bend(x));   // the wreck's hull curves away towards the top of the picture
    const EDGES = [[50, 14], [200, 3]], JOINTS = [[176, 404], [98, 252, 446], [64, 300]];   // plate joints: across (y, bend), and down each row of plates
    const edgeY = (k, x) => Math.round(EDGES[k][0] + EDGES[k][1] * bend(x)), rowOf = (x, y) => (y < edgeY(0, x) ? 0 : y < edgeY(1, x) ? 1 : 2);
    const VP = { x: HB.cx + 5, y: HB.cy + 2 }, GLINT = { x: HB.cx - 2, y: HB.cy + 22 };   // where the corridor behind the hatch vanishes; the glint on its floor
    const FAR_LIGHT = { x: 444, y: 7 };                      // the light at the end of the heading, a warm point past the hull's edge

    // ── THE DISC: the same fourteen lines as the dating sketch, closer ──
    const DX = 236, DY = 136, DR = 122, CUT_NEAR = 7, CUT_FAR = 42, ON_LINE = 1.6, SWEEP = 6, FINAL_SWEEP = 2.4;   // a line is cut between NEAR and FAR; sweep seconds
    const SWEEP_HALF = 18;                                       // the sweep's soft band of light, half its width (picture units; drawing only)
    const SUN = { x: 548, y: 112, r: 104, halo: 330 };       // the light itself, just off the right edge
    const LINES = [[-176, 70, 0.62], [-151, 46, 0.55], [-129, 60, 0.72], [-104, 38, 0.60], [-83, 66, 0.45], [-58, 52, 0.70], [-36, 32, 0.66],
        [-11, 64, 0.50], [12, 42, 0.74], [35, 58, 0.58], [61, 36, 0.52], [92, 68, 0.64], [124, 48, 0.68], [153, 56, 0.48]]
        .map(([deg, len, f]) => { const a = (deg * Math.PI) / 180, l = Math.round(len * 1.68); return { ux: Math.cos(a), uy: Math.sin(a), len: l, notch: Math.round(l * f) }; });
    const along = (p, l) => (p.x - DX) * l.ux + (p.y - DY) * l.uy, across = (p, l) => Math.abs((p.x - DX) * l.uy - (p.y - DY) * l.ux);
    const MAN = ['#..........', '#....###...', '#...#####..', '#...#####..', '#...#####..', '.#...###...', '.#....#....', '..#######..',
        '...#####.#.', '...#####.#.', '...#####.#.', '...#####.#.', '...#####.#.', '....###..#.', '....###....', '....###....',
        '....#.#....', '....#.#....', '....#.#....', '....#.#....', '....#.#....', '....#.#....', '....#.#....', '...##.##...'];
    const WOMAN = ['.........', '...###...', '..#####..', '..#####..', '..#####..', '...###...', '....#....', '.#######.',
        '#.#####.#', '#.#####.#', '#.#####.#', '#.#####.#', '#..###..#', '...###...', '...###...', '...###...',
        '...#.#...', '...#.#...', '...#.#...', '...#.#...', '...#.#...', '...#.#...', '...#.#...', '..##.##..'];
    const FIG_PX = [{ x: DX + 9, y: DY + 62, rows: MAN }, { x: DX + 23, y: DY + 62, rows: WOMAN }]
        .flatMap(f => f.rows.flatMap((row, ry) => [...row].map((c, rx) => (c === '#' ? { x: f.x + rx, y: f.y + ry } : null)).filter(Boolean)));
    const nearFigures = (p, r) => FIG_PX.filter(q => Math.abs(q.x - p.x) <= r && Math.abs(q.y - p.y) <= r);   // figure pixels by the flame
    const TU = { x: 0.6, y: 0.8 }, TN = { x: 0.8, y: -0.6 };   // the torch: along it towards its hose, and its lit side

    // ── what is said: the wreck and the speakers come from the game ──
    const DEAD_FOR = ['twenty years', 'twenty years', 'a hundred years', 'two hundred years', 'three hundred years', 'four hundred years'];   // by sector
    const named = (v, fallback) => (typeof v === 'string' && v.trim() ? v.trim() : fallback);
    const shortName = (v, fallback) => named(v, fallback).split(' ').pop();   // 'Eng. Jaxon' (an old save) → 'Jaxon', as the mission log shortens names
    function readOpts(opts) {
        const o = opts || {}, sector = MiniLab.clamp(Math.round(Number(o.sector) || 1), 1, DEAD_FOR.length);
        return { mode: o.mode === 'disc' ? 'disc' : 'hatch', hull: named(o.hull, 'EXODUS-6'), deadFor: named(o.deadFor, DEAD_FOR[sector - 1]),
            cutter: shortName(o.cutter, 'Jaxon'), spotter: shortName(o.spotter, 'Vance'), sector };   // sector: the sky and the rust
    }
    const sayLines = ({ hull, deadFor, cutter, spotter }) => ({
        hatch: [['', `${hull}. Dead about ${deadFor}. The hatch has no power, so it won't open.`],
            [cutter, 'Hold the torch on the line until it glows white, then move on.']],
        fast: [cutter, "Too fast. That's only marking the plate, not cutting it."], hot: [cutter, "The plate's getting hot. Keep moving."],
        warp: [cutter, "Too hot, and now it's warped. Let it cool a second."], stray: [spotter, "You're off the seam. That's fuel we don't get back."],
        half: [spotter, 'Still nothing warm on the other side.'], gap: [cutter, "It's still holding somewhere. Find the bit you missed."],
        open: [[spotter, 'Hold on. Something in there caught your light.'], [cutter, `${deadFor[0].toUpperCase()}${deadFor.slice(1)} in the dark. Go slow in there.`]],
        hatchDry: [['', 'The tank is empty. The hatch still holds.'], [cutter, "Come back to the lander. We'll swap the tank."]],
        handOver: [cutter, "Give it here. I'll go slow so it cuts clean."], newTank: ['', 'A full tank. Pick up where you left off.'],
        disc: [['', 'The disc is drifting into the light. The light reads whatever it touches.'],
            ['', 'Where the lines meet is home. Burn the centre, then cut each line inside the ring.']],
        discHot: ['', 'The gold is too hot to cut. Wait for it to cool.'], fig: ['', 'You pull the torch back from the figures.'],
        done: ['A.U.R.A.', 'The map is gone, Commander.'], clean: ['', 'The light already knows what we look like.'],
        marked: ['', 'Scorched or not, the light already knows what we look like.'], discDry: [['', 'The tank is empty. The map is still there.']],
    });
    const DIRS = { ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0], ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1] };

    // ── sound: built only while the game's sound is on; everything goes into MiniLab.audio.master ──
    const LET_GO_S = 0.25;                                       // on close the master bus fades out (MiniLab.audio); the flame's noise stops just after
    const RING =[[0.5, 0.068, 9], [1, 0.15, 12], [1.0035, 0.11, 11], [1.5, 0.06, 8], [2, 0.052, 7], [2.006, 0.038, 6], [2.98, 0.019, 4], [4.16, 0.008, 2.5]];   // the hatch: [ratio, level, seconds]; detuned pairs beat slowly
    const BELL = [[0.5, 0.03, 7], [1, 0.11, 10], [1.0022, 0.07, 9], [2, 0.035, 6], [3.01, 0.015, 3]];   // the disc's one bell
    function makeSound() {
        let bus = null, wired = null, flame = null, wasFiring = false;
        function ready() {                                       // a fresh master bus: wire up again
            const a = MiniLab.audio.get();
            if (!a || !MiniLab.audio.master) return null;
            if (wired !== MiniLab.audio.master) { drop(); bus = a.createGain(); bus.gain.value = 0.75; bus.connect(MiniLab.audio.master); wired = MiniLab.audio.master; }
            return a;
        }
        function drop() {                                        // let go; the old bus stays on the old master, which fades the ringing hatch out
            if (flame) { try { flame.src.stop(flame.src.context.currentTime + LET_GO_S); } catch (e) { /* never started */ } flame = null; }
            bus = null; wired = null; wasFiring = false;
        }
        function filter(a, type, freq, q = 0.7) { const f = a.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; return f; }
        function strike(a, node, peak, t, attack, decay, pan = 0) {   // route `node` through a struck envelope (and a pan) into the bus
            const g = a.createGain();
            g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
            node.connect(g);
            if (pan && a.createStereoPanner) { const p = a.createStereoPanner(); p.pan.value = MiniLab.clamp(pan, -1, 1); g.connect(p); p.connect(bus); } else g.connect(bus);
        }
        function burst(a, t, type, freq, q, peak, attack, decay, pan) {   // a grain of filtered noise; returns the filter so a caller can sweep it
            const n = a.createBufferSource(), f = filter(a, type, freq, q), dur = attack + decay + 0.05;
            n.buffer = MiniLab.audio.noiseBuffer(); n.connect(f); strike(a, f, peak, t, attack, decay, pan);
            n.start(t, Math.random() * Math.max(0, 1.9 - dur), dur);
            return f;
        }
        function tone(a, t, freq, type, peak, attack, decay, pan, glideTo) {
            const o = a.createOscillator();
            o.type = type; o.frequency.setValueAtTime(freq, t);
            if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + Math.min(decay, 0.4));
            strike(a, o, peak, t, attack, decay, pan); o.start(t); o.stop(t + attack + decay + 0.05);
        }
        function ring(a, t, f0, partials, cutoff) {             // layered sines, each dying away at its own rate: a struck plate, a bell
            const lp = filter(a, 'lowpass', cutoff);
            lp.connect(bus);
            partials.forEach(([ratio, peak, decay]) => {
                const o = a.createOscillator(), g = a.createGain();
                o.frequency.value = f0 * ratio;
                g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
                o.connect(g); g.connect(lp); o.start(t); o.stop(t + decay + 0.05);
            });
        }
        function flameOn(a, st) {                                // one looping noise: a bright band for the hiss, a low band for its body
            if (!flame) {
                const src = a.createBufferSource(), hiss = filter(a, 'bandpass', 900, 0.8), hissG = a.createGain(), body = filter(a, 'lowpass', 300), bodyG = a.createGain();
                src.buffer = MiniLab.audio.noiseBuffer(); src.loop = true; hissG.gain.value = 0; bodyG.gain.value = 0;
                src.connect(hiss); hiss.connect(hissG); hissG.connect(bus); src.connect(body); body.connect(bodyG); bodyG.connect(bus);
                src.start(); flame = { src, hiss, hissG, bodyG };
            }
            const now = a.currentTime, disc = st.part === 'disc', on = st.firing ? 1 : 0, bright = disc ? 3200 + 3400 * st.heat : 650 + 2500 * st.heat;   // hotter metal, brighter hiss
            flame.hissG.gain.setTargetAtTime(on * (disc ? 0.11 : 0.17) * (0.85 + Math.random() * 0.3), now, on ? 0.04 : 0.16);
            flame.bodyG.gain.setTargetAtTime(on * (disc ? 0.06 : 0.34), now, on ? 0.05 : 0.2);
            flame.hiss.frequency.setTargetAtTime(on ? bright : bright * 0.45, now, on ? 0.1 : 0.25);   // it drops when you stop
            flame.hiss.Q.setTargetAtTime(disc ? 1.8 : 0.8, now, 0.1);
            if (on && !wasFiring) burst(a, now, 'lowpass', disc ? 1600 : 800, 0.7, disc ? 0.035 : 0.07, 0.008, 0.14, st.pan);   // the flame catching
            wasFiring = !!on;
        }
        return {
            drop,
            frame(dt, st) {                                      // every frame: the flame, spits while metal is really cut, ticks of metal cooling
                const a = ready();
                if (!a) { if (bus) drop(); return; }               // sound switched off: let the flame's noise go
                flameOn(a, st);
                const now = a.currentTime, disc = st.part === 'disc', spits = st.firing ? (st.thru > 0 ? 9 + Math.min(9, st.thru * 0.5) : 1.2) : 0;
                if (Math.random() < 1 - Math.exp(-spits * dt)) burst(a, now + Math.random() * 0.02, 'bandpass', disc ? 4500 + Math.random() * 3500 : 1400 + Math.random() * 2600, 2.5,
                    (disc ? 0.04 : 0.07) * (0.5 + Math.random() * 0.5), 0.002, 0.012 + Math.random() * 0.03, st.pan + (Math.random() - 0.5) * 0.3);
                if (Math.random() < 1 - Math.exp(-Math.min(4, st.hot * 0.012) * dt)) {
                    const f = 2000 + Math.random() * 1800, p = (st.hotX / W) * 1.4 - 0.7;
                    tone(a, now, f, 'sine', 0.024 + Math.random() * 0.016, 0.002, 0.04 + Math.random() * 0.04, p);
                    if (Math.random() < 0.45) tone(a, now + 0.07 + Math.random() * 0.06, f * 0.92, 'sine', 0.018, 0.002, 0.04, p);
                }
            },
            groan(k) {                                           // the last of the seam holding: a low groan with a slow creak; k grows towards the end
                const a = ready();
                if (!a) return;
                const t = a.currentTime, f0 = 44 + Math.random() * 12, lp = filter(a, 'lowpass', 230, 2.5), g = a.createGain();
                g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.08 + 0.08 * k, t + 0.6); g.gain.setTargetAtTime(0.0001, t + 1.1, 0.4);
                lp.connect(g); g.connect(bus);
                [[1, 'triangle', 1], [1.504, 'sine', 0.5], [2.01, 'triangle', 0.25]].forEach(([r, type, v]) => {
                    const o = a.createOscillator(), og = a.createGain();
                    o.type = type; og.gain.value = v; o.frequency.setValueAtTime(f0 * r * 1.05, t); o.frequency.exponentialRampToValueAtTime(f0 * r * 0.93, t + 2.4);
                    o.connect(og); og.connect(lp); o.start(t); o.stop(t + 3.4);
                });
                const c = a.createOscillator(), lfo = a.createOscillator(), depth = a.createGain(), bp = filter(a, 'bandpass', 480, 5);
                c.type = 'sawtooth'; c.frequency.value = 90 + Math.random() * 25; lfo.frequency.value = 4 + Math.random() * 3; depth.gain.value = 5;
                lfo.connect(depth); depth.connect(c.frequency); c.connect(bp); strike(a, bp, 0.012 + 0.02 * k, t + 0.25, 0.4, 1.1);
                c.start(t + 0.25); lfo.start(t + 0.25); c.stop(t + 1.9); lfo.stop(t + 1.9);
            },
            warp(disc) { const a = ready(); if (a) tone(a, a.currentTime, disc ? 520 : 150, 'sine', 0.06, 0.005, 0.35, 0, disc ? 470 : 118); },   // one soft, dull knock
            crack() {                                            // a deep clunk, a short rush of air, a long ring, and a soft thud as it drifts off
                const a = ready();
                if (!a) return;
                const t = a.currentTime + 0.01;
                tone(a, t, 98, 'sine', 0.2, 0.004, 0.6, 0, 40); tone(a, t, 196, 'triangle', 0.08, 0.003, 0.24, 0, 112);
                burst(a, t, 'lowpass', 650, 0.7, 0.14, 0.002, 0.13);
                const rush = burst(a, t + 0.03, 'bandpass', 2600, 0.9, 0.1, 0.04, 0.9);
                rush.frequency.setValueAtTime(2600, t + 0.03); rush.frequency.exponentialRampToValueAtTime(480, t + 0.97);
                ring(a, t + 0.03, 174.6, RING, 2600);
                tone(a, t + THUD_AT, 72, 'sine', 0.18, 0.01, 0.45, 0, 44); burst(a, t + THUD_AT, 'lowpass', 300, 0.7, 0.1, 0.005, 0.2);
            },
            bell() { const a = ready(); if (a) ring(a, a.currentTime + 0.02, 659.3, BELL, 6000); },   // the last line on the disc goes
        };
    }

    // ── the pictures (2026-10-11: the travel view's world). Painted once in ART pixels, 1.5 to a unit (720 × 405), with the
    //    travel view's recipes (MiniLab.paint = art/MiniPaint.js) and its 8 × 8 grain. The rules above stay in units: an art
    //    pixel's centre is ((ax + 0.5) / d − 0.5) in the same index space the seam, the heat grid and the cuts use. ──
    const DENSITY = 1.5, INK = '#05070a';
    const hash = (a, b) => { const h = Math.imul(a, 374761393) + Math.imul(b, 668265263) | 0, k = Math.imul(h ^ (h >>> 13), 1274126177); return ((k ^ (k >>> 16)) >>> 0) / 4294967296; };
    // the travel view's sector skies (src/newscreen/travel/SectorLooks.js), copied so the default game has them too
    const LOOKS = {
        1: { seed: 11, dust: 0.12, haze: 1, stars: 1, light: { core: 2, halo: 14, spikes: 5 } },
        2: { seed: 22, dust: 0.08, haze: 0.6, stars: 1.6, light: { core: 5, halo: 34, spikes: 7 } },
        3: { seed: 33, dust: 0.1, haze: 0.9, stars: 1.2, light: { core: 7, halo: 40, spikes: 8 } },
        4: { seed: 44, dust: 0.14, haze: 1, stars: 1.3, light: { core: 9, halo: 48, spikes: 9 } },
        5: { seed: 55, dust: 0.1, haze: 0.8, stars: 1.1, light: { core: 11, halo: 58, spikes: 10 } },
        6: { seed: 66, dust: 0.16, haze: 1.1, stars: 1, light: { core: 15, halo: 80, spikes: 12 } },
    };
    const DISC_SKY = { seed: 77, dust: 0.1, haze: 0.8, stars: 1.1 };
    const RUST_BY_SECTOR = [0.1, 0.16, 0.28, 0.4, 0.5, 0.6];      // the longer a wreck has been dead, the more of it has rusted
    const LAMP = { x: 247, y: 209, aimX: 318, aimY: 128 };          // our work lamp, clamped to the hull, aimed at the hatch
    const PORT = { x: 66, y: 168, r: 10, glass: 7.2 };               // one of the wreck's portholes: the Lander has one per deck
    const NAME_AT = { x: 30, y: 92 };
    let RAMPS = null;
    function ramps() {                                           // the materials, made once MiniPaint is there
        if (RAMPS) return RAMPS;
        const P = window.MiniPaint, RP = P.RP, warmed = c => MiniLab.mix(c, '#e8964a', 0.16);
        RAMPS = {
            HULL: RP.HULL, RUST: RP.RUST, SUN: RP.SUN, AMBER: RP.AMBER, ICE: RP.ICE,
            LIT: P.ramp(...RP.HULL.hex.map((c, i) => (i ? warmed(c) : c))),                 // the hull where our lamp falls
            PAINT: P.ramp(INK, '#1d272c', '#3c4a50', '#6d7c80', '#a9b4b5', '#d6dcda'),     // the hull number, old white paint
            GOLD: P.ramp(INK, '#1a1008', '#2f1d0c', '#4e3014', '#74481d', '#9c6428', '#c88a3e', '#e9b467', '#f7d9a0', '#fff3dc'),
            COPPER: P.ramp(INK, '#2a1408', '#5a2c12', '#9a5426', '#d08850', '#f2c08a'),     // the torch's nozzle
            RUBBER: P.ramp(INK, '#0e1316', '#1a2226', '#2a3439', '#3f4c52', '#5d6c72'),     // its grip
            GLASS: P.ramp(INK, '#070c10', '#0c1a20', '#16303a', '#33606e', '#7fb3c2', '#d6eef4'),
        };
        return RAMPS;
    }
    const sizeOf = d => ({ AW: Math.round(W * d), AH: Math.round(H * d) });
    /** Every art pixel whose centre lies inside the index-space box: fn(ax, ay, fx, fy). */
    function eachArt(d, x0, y0, x1, y1, fn) {
        const { AW, AH } = sizeOf(d);
        const ax0 = Math.max(0, Math.ceil((x0 + 0.5) * d - 0.5)), ax1 = Math.min(AW - 1, Math.floor((x1 + 0.5) * d - 0.5));
        const ay0 = Math.max(0, Math.ceil((y0 + 0.5) * d - 0.5)), ay1 = Math.min(AH - 1, Math.floor((y1 + 0.5) * d - 0.5));
        for (let ay = ay0; ay <= ay1; ay++) for (let ax = ax0; ax <= ax1; ax++) fn(ax, ay, (ax + 0.5) / d - 0.5, (ay + 0.5) / d - 0.5);
    }
    /** The sector's own sky (the travel view's spaceStrip and paintSpace), lit by the light at (lx, ly) in art pixels. */
    function paintSky(p, look, L, lx, ly) {
        const P = window.MiniPaint, strip = P.spaceStrip(p.W, p.H, look.seed, look.dust, look.haze, look.stars), lit = new Float32Array(p.W * p.H);
        for (let y = 0; y < p.H; y++) for (let x = 0; x < p.W; x++) lit[y * p.W + x] = Math.exp(-Math.hypot(x - lx, (y - ly) * 1.15) / (L.halo * 0.85 + 6));
        const keep = L.halo * 0.9 + L.core + 8;
        P.paintSpace(p, strip, 0, lit, (x, y) => Math.hypot(x - lx, y - ly) < keep);
    }
    const horizonF = x => 14 + 26 * bend(x), edgeF = (k, x) => EDGES[k][0] + EDGES[k][1] * bend(x);
    const rowAt = (x, y) => (y < edgeF(0, x) ? 0 : y < edgeF(1, x) ? 1 : 2);
    function rivetNear(x, y, row) {                              // the nearest rivet: along the plate joints, every 9 units, 4 off the joint
        let best = null;
        const take = (cx, cy) => { const dd = Math.hypot(x - cx, y - cy); if (dd < 2.6 && Math.abs(sdf(cx, cy)) > 4 && (!best || dd < best.d)) best = { d: dd, dx: x - cx, dy: y - cy }; };
        [0, 1].forEach(k => { const cx = 9 * Math.round((x - 4) / 9) + 4; take(cx, edgeF(k, cx) - 4); take(cx, edgeF(k, cx) + 4); });
        JOINTS[row].forEach(j => { const cy = 9 * Math.round((y - 4) / 9) + 4; take(j - 4, cy); take(j + 4, cy); });
        return best;
    }
    /** The wreck's plating at one point: 0..1 on the hull ramp (−1 is space above its edge). */
    function plateTone(x, y, hp, rustAmt, ax, ay) {
        const P = window.MiniPaint, t = y - horizonF(x);
        if (t < -hp) return { v: -1 };
        const lampD = Math.hypot(x - LAMP.aimX, (y - LAMP.aimY) * 1.15), lamp = Math.max(0, 1 - lampD / 235);
        if (t < hp) return { v: 0.66 + 0.2 * (x / W), lamp };    // its edge, lit by the far light
        if (t < 3 * hp) return { v: 0.44 + 0.1 * (x / W), lamp };
        const row = rowAt(x, y), joints = JOINTS[row], left = joints.filter(j => x > j).length;
        const ptop = row === 0 ? horizonF(x) : edgeF(row - 1, x), pbot = row < 2 ? edgeF(row, x) : H, fy = (y - ptop) / Math.max(1, pbot - ptop);
        const sky = Math.exp(-t / 15), band = x * 0.45 + y - 236, sheen = 0.12 * Math.exp(-((band / 30) ** 2)) + 0.08 * Math.exp(-(((band - 46) / 5) ** 2));   // the dust lane, reflected
        let v = 0.12 + 0.36 * lamp * lamp + 0.32 * sky + sheen + (hash(row, left) - 0.5) * 0.08 + 0.07 * (0.5 - fy) - 0.06 * (y / H);
        v += (P.fbm(x / 34, y / 20, 31, 3) - 0.5) * 0.12 + (P.vnoise(x / 9, y * 0.9, 32) - 0.5) * 0.035;   // grime, and the grain of the plate
        for (let k = 0; k < 2; k++) { const dy = y - edgeF(k, x); if (Math.abs(dy) < hp) return { v: 0.03, lamp }; if (dy >= hp && dy < 3 * hp) v += 0.09; }   // plate joints and their lit lip
        for (const j of joints) { const dx = x - j; if (Math.abs(dx) < hp) return { v: 0.03, lamp }; if (dx >= hp && dx < 3 * hp) v += 0.09; }
        const rv = rivetNear(x, y, row);
        if (rv && rv.d < 0.95) { const nx = rv.dx / 0.95, ny = rv.dy / 0.95; return { v: 0.2 + 0.3 * MiniLab.clamp(0.6 * nx - 0.8 * ny + 0.35, 0, 1) + 0.18 * lamp + 0.4 * sky * 0.5, lamp }; }
        if (rv && Math.hypot(rv.dx + 0.7, rv.dy - 0.7) < 0.95) return { v: Math.max(0.03, v - 0.1), lamp };   // its shadow, down and to the left
        let rust = (P.fbm(x / 22, y / 12, 41, 4) - (0.8 - rustAmt * 0.26)) * 14 > P.threshold(ax, ay);
        if (rv && rv.dy > 1 && Math.abs(rv.dx) < 0.6 && hash(Math.round(x - rv.dx), Math.round(y - rv.dy)) < rustAmt * 1.6 && rv.dy < 2 + 9 * P.vnoise(x, y / 6, 43) * (1 - (rv.dy - 1) / 3) && P.threshold(ax, ay) < 0.8 - rv.dy / 4) rust = true;   // rust runs down from the rivets
        if (P.hash(ax, ay, 44) < 0.004) v -= 0.12;               // pits from micrometeorites
        return { v, lamp, rust };
    }
    function doorTone(x, y, v, hp) {                             // the door inside the seam: its lip, a pressed panel, the handle recess, four bolts
        const dd = sdf(x, y);
        if (dd > 0.5) return v;
        if (dd >= -0.5) return 0.02;
        if (dd >= -1.6) return v + 0.1;
        const g = dd + 8;
        if (Math.abs(g) < hp) return 0.05;
        if (g < -hp && g >= -3 * hp) return v + 0.07;
        const hx = x - (HB.cx + HB.hw - 22), hy = y - (HB.cy - 3);
        if (hx >= -0.5 && hx <= 10.5 && hy >= -0.5 && hy <= 6.5) {
            if (hy > 5.6) return 0.46;                           // the recess: its lit lower lip, its shadowed walls, the grip bar inside
            if (hx < 0.4 || hx > 9.6 || hy < 0.4) return 0.04;
            if (hy > 2 && hy < 3.6 && hx > 1.6 && hx < 8.4) return hy < 2.7 ? 0.62 : 0.4;
            return 0.12;
        }
        const bx = Math.abs(x - HB.cx) - 28.5, by = Math.abs(y - HB.cy) - 37.5, br = Math.hypot(bx, by);
        if (br < 1.4) return 0.32 + 0.4 * MiniLab.clamp(0.6 * bx * Math.sign(x - HB.cx) - 0.8 * by * Math.sign(y - HB.cy) + 0.4, 0, 1);
        if (Math.hypot(bx + 0.7 * Math.sign(x - HB.cx), by - 0.7 * Math.sign(y - HB.cy)) < 1.4) return 0.05;
        return v - (dd < -9 ? 0.03 : 0) + (dd < -9 ? (window.MiniPaint.vnoise(x * 1.4, y / 9, 47) - 0.5) * 0.04 : 0);
    }
    const NAME_ROOM = 240;                                       // the wreck's name fits between the left edge and the hatch
    const hullNumber = hull => hull.split('"')[0].trim() || hull;   // 'EXODUS-4 "LAZARUS"' is painted as EXODUS-4, as on the sketch
    function stencil(p, str, ax0, ay0, cell, gap, toneAt) {      // old paint in the travel view's pixel font, flaking
        window.MiniPaint.pixelText(str, 0, 0, (gx, gy) => {
            for (let yy = 0; yy < cell - gap; yy++) for (let xx = 0; xx < cell - gap; xx++) { const ax = ax0 + gx * cell + xx, ay = ay0 + gy * cell + yy, v = toneAt(ax, ay); if (v) p.solid(ax, ay, v[0], v[1]); }
        });
    }
    function paintHull(o, d) {
        const P = window.MiniPaint, RR = ramps(), { AW, AH } = sizeOf(d), p = P.painter(AW, AH, true), hp = 0.5 / d;
        const look = LOOKS[o.sector] || LOOKS[1], k = AH / 360, L = { core: look.light.core * k, halo: look.light.halo * k, strength: 1, spikes: look.light.spikes * k };
        const lx = (FAR_LIGHT.x + 0.5) * d, ly = (FAR_LIGHT.y + 0.5) * d, rustAmt = RUST_BY_SECTOR[o.sector - 1] || 0.2;
        paintSky(p, look, L, lx, ly);
        P.lightGlow(p, lx, ly, L, 1);                            // the light at the end of the heading, just past the hull's edge
        eachArt(d, -1, -1, W, H, (ax, ay, x, y) => {
            const pt = plateTone(x, y, hp, rustAmt, ax, ay);
            if (pt.v < 0) return;
            const pool = Math.max(0, 1 - Math.hypot(x - LAMP.aimX, (y - LAMP.aimY) * 1.15) / 150), v = doorTone(x, y, pt.v, hp);
            const ramp = pt.rust && v === pt.v ? RR.RUST : P.threshold(ax, ay) < 0.7 * pool * pool ? RR.LIT : RR.HULL;   // our lamp warms the metal a little
            p.solid(ax, ay, ramp, ramp === RR.RUST ? 0.1 + v * 1.25 : v);
        });
        [[70, 168, 196, 150], [372, 236, 468, 222], [150, 66, 236, 58]].forEach(([x0, y0, x1, y1]) =>   // old scrapes
            p.line((x0 + 0.5) * d, (y0 + 0.5) * d, (x1 + 0.5) * d, (y1 + 0.5) * d, (x, y) => { if (P.threshold(x, y) < 0.45) p.solid(x, y, RR.HULL, 0.5); }));
        [[118, 236], [428, 96], [214, 74]].forEach(([cx, cy]) => eachArt(d, cx - 4, cy - 4, cx + 4, cy + 4, (ax, ay, x, y) => {   // small craters
            const r = Math.hypot(x - cx, y - cy);
            if (r < 1.6) p.solid(ax, ay, RR.HULL, 0.06 + 0.1 * MiniLab.clamp(x - cx - (y - cy), 0, 1));
            else if (r < 2.6) p.solid(ax, ay, RR.HULL, 0.42 + 0.2 * MiniLab.clamp(((x - cx) - (y - cy)) / 2.6, -1, 1));
        }));
        paintPorthole(p, d, RR);
        // the hull number: a thin worn stencil (strokes two or three art pixels wide), flaking in patches, with rust
        // run down from it; a little bigger than the RESCUE paint, never the old blocky letters
        const name = hullNumber(o.hull), tw = P.pixelTextWidth(name), cell = [3, 2].find(c => tw * c <= NAME_ROOM * d * 0.6) || 2;
        const nx0 = Math.round((NAME_AT.x + 0.5) * d), ny0 = Math.round((NAME_AT.y + 0.5) * d), painted = new Map();
        stencil(p, name, nx0, ny0, cell, 0, (ax, ay) => {
            if (P.fbm(ax / 6, ay / 6, 51, 3) < 0.31 || P.hash(ax, ay, 52) < 0.06) return null;   // flaked off
            painted.set(ax, Math.max(painted.get(ax) || 0, ay));
            const x = (ax + 0.5) / d - 0.5, y = (ay + 0.5) / d - 0.5, lamp = Math.max(0, 1 - Math.hypot(x - LAMP.aimX, (y - LAMP.aimY) * 1.15) / 235);
            return [RR.PAINT, 0.36 + 0.28 * lamp + (P.vnoise(ax / 3, ay / 3, 53) - 0.5) * 0.18];
        });
        painted.forEach((bottom, ax) => {                        // rust runs down from the paint's lower edges
            if (P.hash(ax, 7, 56) > 0.22) return;
            const run = Math.round((3 + P.hash(ax, 9, 57) * 9) * d);
            for (let k = 1; k <= run; k++) if (P.threshold(ax, bottom + k) < 0.85 - k / run * 0.7) p.solid(ax, bottom + k, RR.RUST, 0.62 - 0.32 * k / run);
        });
        const rw = P.pixelTextWidth('RESCUE') * 2;
        stencil(p, 'RESCUE', Math.round((HB.cx + 0.5) * d - rw / 2), Math.round((HB.cy - HB.hh - 10 + 0.5) * d), 2, 0, (ax, ay) =>
            (P.hash(ax, ay, 54) < 0.1 ? null : [RR.AMBER, 0.42 + (P.vnoise(ax / 2, ay / 2, 55) - 0.5) * 0.2]));
        paintLamp(p, d, RR);
        return p.canvas();
    }
    function paintPorthole(p, d, RR) {                           // dark glass in a bolted ring, the sky caught in it
        const P = window.MiniPaint;
        eachArt(d, PORT.x - PORT.r - 2, PORT.y - PORT.r - 2, PORT.x + PORT.r + 2, PORT.y + PORT.r + 2, (ax, ay, x, y) => {
            const dx = x - PORT.x, dy = y - PORT.y, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
            if (r > PORT.r + 1.2) return;
            if (r > PORT.r) { if (dx - dy < 0) p.solid(ax, ay, RR.HULL, 0.04); return; }   // the ring's shadow on the hull
            if (r > PORT.glass) {
                const n = (r - PORT.glass) / (PORT.r - PORT.glass), lit = MiniLab.clamp((dx * 0.6 - dy * 0.8) / r, -1, 1);
                const bolt = Math.abs(((a / (Math.PI / 4)) % 1 + 1) % 1 - 0.5) > 0.42 && Math.abs(n - 0.5) < 0.3;
                p.solid(ax, ay, RR.HULL, bolt ? 0.62 : 0.26 + 0.24 * lit * (1 - Math.abs(n - 0.5)) + (n < 0.2 ? -0.12 : 0));
                return;
            }
            const g = r / PORT.glass, shade = dx + dy < -PORT.glass * 0.6 ? 0 : 0.06;   // the frame shadows the top-left of the glass
            let v = 0.1 + shade + 0.12 * g * g + (P.fbm(x / 3, y / 3, 57, 2) - 0.5) * 0.06;
            const arc = Math.abs(r - PORT.glass * 0.72) < 0.7 && a > -1.25 && a < -0.15;   // the far light's sky, a thin bright arc
            if (arc) v = 0.62; else if (Math.hypot(dx - 2.6, dy + 3.2) < 1) v = 0.9;
            p.solid(ax, ay, RR.GLASS, v);
        });
    }
    function paintLamp(p, d, RR) {                               // a clamp lamp on a magnetic foot, its lens towards the hatch
        const ang = Math.atan2(LAMP.aimY - LAMP.y, LAMP.aimX - LAMP.x), c = Math.cos(ang), sn = Math.sin(ang), S = 1.4;
        const lx = (LAMP.x + c * 5 * S + 0.5) * d, ly = (LAMP.y + sn * 5 * S + 0.5) * d, R0 = 22;   // first a soft warm halo round the lens
        p.region(lx - R0, ly - R0, lx + R0, ly + R0, (x, y) => { const r = Math.hypot(x + 0.5 - lx, y + 0.5 - ly) / R0; if (r < 1) p.add(x, y, RR.SUN, 0.4 * (1 - r) ** 2.4); });
        eachArt(d, LAMP.x - 10, LAMP.y - 10, LAMP.x + 10, LAMP.y + 12, (ax, ay, x, y) => {
            const fy = (y - LAMP.y) / S, fx = (x - LAMP.x) / S;
            if (fy > 4 && fy < 6 && Math.abs(fx + 1) < 4.5) return p.solid(ax, ay, RR.HULL, fy < 4.7 ? 0.6 : 0.2);   // the foot
            if (Math.abs(fx + 1) < 0.6 && fy > 1 && fy <= 4) return p.solid(ax, ay, RR.HULL, 0.42);   // its stem
            const u = fx * c + fy * sn, v = -fx * sn + fy * c;   // along the lamp, across it
            if (Math.abs(u) > 4.4 || Math.abs(v) > 2.5) return;
            if (Math.abs(u) > 3.8 || Math.abs(v) > 1.9) return p.solid(ax, ay, RR.HULL, 0.03);
            if (u > 3) return p.solid(ax, ay, RR.SUN, 0.95 - 0.1 * Math.abs(v));   // the lens, lit
            p.solid(ax, ay, RR.HULL, 0.22 + 0.36 * MiniLab.clamp(-v / 1.9 + 0.3, 0, 1) - (Math.abs(u % 1.4) < 0.3 ? 0.08 : 0));
        });
    }
    function paintHole(d) {                                      // behind the hatch: a dead corridor, lit only by our lamp
        const RR = ramps(), P = window.MiniPaint, { AW, AH } = sizeOf(d), p = P.painter(AW, AH, false), hp = 0.5 / d;
        eachArt(d, ...HATCH_BOX, (ax, ay, x, y) => {
            const dd = sdf(x, y);
            if (dd > 0.5) return;
            const qx = Math.abs(x - VP.x) / HB.hw, qy = Math.abs(y - VP.y) / HB.hh, q = Math.max(qx, qy);   // q: 1 at the hole, 0 far away
            if (dd > -4) return p.solid(ax, ay, RR.HULL, (x - HB.cx) / HB.hw + (y - HB.cy) / HB.hh > 0.2 ? 0.24 + 0.14 * (dd + 4) / 4.5 : 0.04);   // the plate's cut edge
            if (q <= 0.3) { if (q > 0.3 - 2 * hp / HB.hw) p.solid(ax, ay, RR.HULL, 0.05); else p.set(ax, ay, [5, 7, 10]); return; }   // the far end, black
            const floor = y > VP.y && qy > qx, z = 1 / q;
            let v = 0.02 + 0.24 * ((q - 0.3) / 0.7) ** 2 + (qx > qy ? 0 : y > VP.y ? 0.05 : -0.03);   // the walls fade into the dark; the floor a little lit
            if ([0.42, 0.56, 0.76].some(r => Math.abs(q - r) < 0.008)) v -= 0.05;   // the corridor's ribs
            else if ([0.42, 0.56, 0.76].some(r => q - r >= 0.008 && q - r < 0.02)) v += 0.04;
            else if (Math.abs(qx - qy) < 0.012) v += 0.05;      // its corners catch the light
            if (floor && (z * 5) % 1 < 0.16) v += 0.035;         // the floor grating
            if (!floor && qx > qy && Math.abs(y - (VP.y - HB.hh * q * 0.55)) < 0.6 * q) v += 0.04;   // a cable run along the wall
            v += (P.fbm(x / 6, y / 6, 61, 2) - 0.5) * 0.05 * q;
            p.solid(ax, ay, P.threshold(ax, ay) < 0.5 * q * q ? RR.LIT : RR.HULL, v);
        });
        return p.canvas();
    }
    function paintLid(hullBg, d) {                               // the cut-out door, to drift away: a mask of the door, then the hull drawn into it
        const { AW, AH } = sizeOf(d), lid = Object.assign(document.createElement('canvas'), { width: AW, height: AH }), shadow = Object.assign(document.createElement('canvas'), { width: AW, height: AH });
        const lg = lid.getContext('2d'), sg = shadow.getContext('2d');
        lg.fillStyle = '#000'; sg.fillStyle = INK;
        eachArt(d, ...HATCH_BOX, (ax, ay, x, y) => {
            if (sdf(x, y) > -0.5) return;
            lg.fillRect(ax, ay, 1, 1);
            if (MiniLab.on(ax, ay, 0.6)) sg.fillRect(ax, ay, 1, 1);
        });
        lg.globalCompositeOperation = 'source-in'; lg.drawImage(hullBg, 0, 0);
        return { lid, lidShadow: shadow };
    }
    function paintSun(p, sx, sy, R, RR) {                        // the false sun, close: a white-gold face, a warm limb, a long soft glow and a thin streak
        const reach = R * 3.6;
        p.region(sx - reach, sy - reach, sx + reach, sy + reach, (x, y) => {
            const dx = x + 0.5 - sx, dy = (y + 0.5 - sy) * 1.04, r = Math.hypot(dx, dy);
            if (r < R) return p.tone(x, y, RR.SUN, 1.02 - 0.2 * (r / R) ** 8);
            const e = r - R;
            let v = 0.9 * Math.exp(-e / (R * 0.07)) + 0.42 * Math.exp(-e / (R * 0.32)) + 0.2 * Math.exp(-e / (R * 1.1));
            if (Math.abs(dy) < 0.8) v += 0.3 * Math.exp(-Math.abs(dx) / (R * 1.3));
            v *= 1 - window.MiniPaint.smooth(reach * 0.6, reach, r);
            if (v > 0.004) p.add(x, y, RR.SUN, v);
        });
    }
    function paintDiscScene(d) {
        const P = window.MiniPaint, RR = ramps(), { AW, AH } = sizeOf(d), p = P.painter(AW, AH, true);
        const sx = (SUN.x + 0.5) * d, sy = (SUN.y + 0.5) * d;
        paintSky(p, DISC_SKY, { core: SUN.r * d, halo: 80 * d }, sx, sy);
        paintSun(p, sx, sy, (SUN.r + 8) * d, RR);                // the light the disc is drifting into: the warmest thing there is
        eachArt(d, DX - DR - 2, DY - DR - 2, DX + DR + 2, DY + DR + 2, (ax, ay, x, y) => {
            const r = Math.hypot(x - DX, y - DY), lit = MiniLab.clamp(0.5 + 0.5 * (x - DX) / DR, 0, 1), a = Math.atan2(y - DY, x - DX);
            if (r > DR + 1.2) return;
            if (r > DR + 0.4) { if (x > DX) p.add(ax, ay, RR.SUN, 0.32 * lit); return; }   // the light caught round its edge
            const wedge = Math.abs(Math.cos(a + 0.35));
            let g = 0.16 + 0.34 * Math.pow(lit, 1.7) + 0.2 * Math.pow(wedge, 16) + 0.05 * Math.pow(wedge, 3);   // lit from the right; a pressed disc catches light in two wedges
            if (r > 26 && r < DR - 4) g += (Math.floor(r * d) % 2 ? 0.035 : -0.015) + 0.02 * Math.sin(r * 0.83);   // grooves
            else if (r <= 24) g = 0.2 + 0.26 * lit + (P.fbm(x / 5, y / 5, 71, 2) - 0.5) * 0.06;   // the label, matte
            if (r > 24 && r <= 26) g -= 0.08;                    // the label's edge
            if (r > DR - 2.5) g = 0.46 + 0.44 * lit - (r > DR - 0.3 && x < DX ? 0.2 : 0);   // the rim, bright on the side facing the light
            p.solid(ax, ay, RR.GOLD, g);
        });
        LINES.forEach(l => {                                     // each line's engraved shadow, one art pixel to the dark side
            const o = l.uy > 0 ? -1 : 1, x0 = (DX + 0.5) * d + l.uy * o, y0 = (DY + 0.5) * d - l.ux * o;
            p.line(x0, y0, x0 + l.ux * l.len * d, y0 + l.uy * l.len * d, (x, y) => p.solid(x, y, RR.GOLD, 0.1));
        });
        return p.canvas();
    }
    function paintScene(o, d) {                                  // only the pictures this part needs
        if (o.mode === 'disc') return { discBg: paintDiscScene(d) };
        const hullBg = paintHull(o, d);
        return Object.assign({ hullBg, hole: paintHole(d) }, paintLid(hullBg, d));
    }

    /** A layer of art pixels drawn fresh every frame (the burns, the sparks, the torch): written into one buffer, drawn once. */
    function makeLayer(w, h) {
        const c = Object.assign(document.createElement('canvas'), { width: w, height: h }), g = c.getContext('2d');
        const img = g.createImageData(w, h), u32 = new Uint32Array(img.data.buffer), packed = new Map();
        const pack = hex => {
            let v = packed.get(hex);
            if (v === undefined) { const n = parseInt(hex.slice(1), 16); v = (0xff000000 | ((n & 0xff) << 16) | (n & 0xff00) | ((n >> 16) & 0xff)) >>> 0; packed.set(hex, v); }
            return v;
        };
        let x0 = w, y0 = h, x1 = -1, y1 = -1;                       // the box written since the last clear: only it is cleared and drawn
        const set = (x, y, hex) => {
            x = Math.floor(x); y = Math.floor(y);
            if (!hex || x < 0 || y < 0 || x >= w || y >= h) return;
            u32[y * w + x] = pack(hex);
            if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        };
        return {
            w, h, set,
            pick(x, y, ramp, v) { x = Math.floor(x); y = Math.floor(y); set(x, y, MiniLab.pick(ramp.hex || ramp, v, x, y)); },   // ramp: a MiniPaint ramp or a hex array
            line(x0, y0, x1, y1, color, tone = 1) {                  // one art pixel wide
                let ax = Math.round(x0), ay = Math.round(y0);
                const bx = Math.round(x1), by = Math.round(y1), dx = Math.abs(bx - ax), dy = -Math.abs(by - ay), sx = ax < bx ? 1 : -1, sy = ay < by ? 1 : -1;
                let err = dx + dy;
                for (let guard = 0; guard < 4000; guard++) {
                    if (tone >= 1 || MiniLab.on(ax, ay, tone)) set(ax, ay, color);
                    if (ax === bx && ay === by) break;
                    const e2 = 2 * err;
                    if (e2 >= dy) { err += dy; ax += sx; }
                    if (e2 <= dx) { err += dx; ay += sy; }
                }
            },
            clear() { for (let y = y0; y <= y1; y++) u32.fill(0, y * w + x0, y * w + x1 + 1); x0 = w; y0 = h; x1 = -1; y1 = -1; },
            draw(ctx) {
                if (x1 < x0) return;
                const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
                g.putImageData(img, 0, 0, x0, y0, bw, bh); ctx.drawImage(c, x0, y0, bw, bh, x0, y0, bw, bh);
            },
        };
    }

    function mount(ctx, ui, opts) {
        const HEATING = [C.hurt[2], C.hurt[3], C.danger, C.warm, C.warmBright], GLOW = [C.hurt[2], C.hurt[3], C.warm, C.warmBright];   // metal under the flame: dull → red → orange; the plate heating
        const KERF = [C.void, C.hurt[2], C.hurt[3], C.danger, C.warm, C.warmBright, C.star];   // a cut: white-hot while the flame is on it, then cooling to a dark slot
        const TEMPER = MiniLab.mix(C.warm, C.hull[2], 0.45), CUT_LINE = MiniLab.mix(C.lightHalo, C.void, 0.62), DIM_GOLD = MiniLab.mix(C.lightHalo, C.void, 0.55);
        const SCORCH = MiniLab.mix(C.warm, C.hull[1], 0.62), HOSE = [MiniLab.mix(C.warm, C.void, 0.82), MiniLab.mix(C.warm, C.void, 0.66), MiniLab.mix(C.warm, C.void, 0.45)];   // a cut's tempered edge; the suit's hose
        const setup = readOpts(opts), SAY = sayLines(setup), snd = makeSound();
        const d = (ui.art && ui.art.d) || MiniLab.density || 1, { AW, AH } = sizeOf(d);
        const { hullBg, hole, lid, lidShadow, discBg } = paintScene(setup, d);
        let s = null, clock = 0, ptrFire = false, aim = null;
        const clampTip = (x, y) => ({ x: MiniLab.clamp(x, 2, W - 3), y: MiniLab.clamp(y, 2, H - 3) });
        const cellOf = p => MiniLab.clamp(Math.floor((p.y + 0.5) / CELL), 0, GH - 1) * GW + MiniLab.clamp(Math.floor((p.x + 0.5) / CELL), 0, GW - 1);
        const heatAt = p => s.heat[cellOf(p)], paused = () => s.pause > 0 || !!s.hotSpot, isOpen = () => ['open', 'end', 'closing'].includes(s.phase);

        // ── one line at a time: scripted lines wait to be read, reactions come straight after the line before ──
        function show(line) { ui.say(line[0], line[1]); s.saidAt = clock; s.nextSay = clock + MiniLab.clamp(1 + 0.22 * line[1].split(' ').length, 2, 3.6); }
        function script(lines, delay, then) {
            s.speech = lines.map((line, j) => ({ line, then: j === lines.length - 1 ? then : null })); s.react = null; s.nextSay = clock + delay;
            if (!lines.length && then) then();
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
            s = { part, P: PARTS[part], phase: 'cut', tip: part === 'hatch' ? { x: HB.cx - HB.hw - 18, y: HB.cy } : { x: DX - 64, y: DY + 50 },
                speed: 0, trail: [], holdT: 0, burst: 0, fuel: 1, tanks: 1, auto: null, pause: 0, hotSpot: null, firing: false,
                heat: new Float32Array(GW * GH), spare: new Float32Array(GW * GH),
                depth: new Float32Array(W * H), lastT: new Float32Array(W * H).fill(-99), marks: [],
                glow: 0, idleT: 0, lastThruT: -99, progT: -99, progText: '',   // the metal's heat under the tip; for the readout by the torch
                sparks: [], warps: [], speech: [], react: null, nextSay: 0, saidAt: -99, said: {}, scars: 0, strayT: 0, fastT: 0,
                seamCut: new Uint8Array(SEAM.length), cut: 0, lastCut: 0, stall: 0, openT: 0, groanT: 0, thruNow: 0, hot: 0, hotX: W / 2,
                cutT: LINES.map(() => null), centre: false, figTouched: false, sweep: 0, final: false };
            script(SAY[part], 0); showButtons();
        }
        function showButtons() {
            const canHandOver = s.part === 'hatch' && !s.auto, handOverButton = { label: `Let ${setup.cutter} cut it`, onClick: handOver };
            if (s.phase === 'end') return ui.buttons([{ label: 'Continue', primary: true, onClick: done }]);
            if (s.phase === 'dry') return ui.buttons([{ label: 'New tank', primary: true, onClick: newTank }, ...(canHandOver ? [handOverButton] : [])]);
            ui.buttons(s.phase === 'cut' && canHandOver ? [{ ...handOverButton, quiet: true }] : []);
        }
        const canSteer = () => s.phase === 'cut' && !s.auto;
        function swapTank() { s.fuel = 1; s.tanks += 1; }
        function newTank() {                                     // back to the lander for a full tank; the cut so far stays cut
            if (s.phase !== 'dry') return;
            swapTank(); s.phase = 'cut';
            script([SAY.newTank], 0); showButtons();
        }
        function handOver() {                                    // the crew member takes the torch and finishes the cut alone
            if (s.auto || s.part !== 'hatch' || (s.phase !== 'cut' && s.phase !== 'dry')) return;
            if (s.phase === 'dry') swapTank();
            s.phase = 'cut'; s.auto = { j: null, dir: 1, cooling: false }; ptrFire = false; aim = null; s.burst = 0;
            script([SAY.handOver], 0); showButtons();
        }
        function done() {
            if (s.phase !== 'end') return;
            const fuelLeft = Math.round(s.fuel * 100) / 100;
            ui.finish(s.part === 'hatch'
                ? { opened: true, fuelLeft, scars: s.scars, warps: s.warps.length, tanks: s.tanks, bySelf: !s.auto }
                : { destroyed: true, figuresScorched: s.figTouched, fuelLeft, tanks: s.tanks });
        }

        // ── the tip and the flame ──
        function step(dx, dy, k) {                               // a key move of k px
            const p = s.tip, l = Math.hypot(dx, dy), mx = (dx / l) * k, my = (dy / l) * k, d = sdf(p.x, p.y);
            if (s.part === 'hatch' && Math.abs(d) <= ON_SEAM) {   // on the seam, the keys ride it, round the corners
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
        function moveTip(dt, wants) {
            let dx = 0, dy = 0;
            Object.entries(DIRS).forEach(([k, [x, y]]) => { if (MiniLab.keys.has(k)) { dx += x; dy += y; } });
            if (Math.sign(dx) || Math.sign(dy)) {
                aim = null; s.holdT += dt;
                if (s.holdT > KEY_DELAY) step(Math.sign(dx), Math.sign(dy), (wants ? KEY_FIRE : KEY_FREE) * dt);
            } else s.holdT = s.holdT > KEY_DELAY ? Math.min(s.holdT, KEY_DELAY + 0.25) - dt : 0;   // switching arrows mid-glide keeps gliding
            if (aim) s.tip = clampTip(aim.x, aim.y);             // the drawn torch is the pointer: it sits exactly under it (fire() burns the whole way between)
        }
        function playerMove(dt) {                                // returns whether the player wants the flame
            const wants = ptrFire || MiniLab.keys.has(' ') || s.burst > 0;
            moveTip(dt, wants);
            return wants;
        }
        function trackSpeed() {                                  // speed over the last third of a second: a shaky hand is not a fast one
            s.trail = s.trail.filter(p => clock - p.t < 0.3).concat({ t: clock, ...s.tip });
            const first = s.trail[0];
            s.speed = clock > first.t ? Math.hypot(s.tip.x - first.x, s.tip.y - first.y) / (clock - first.t) : 0;
        }

        // ── the crew member's hands: out to the nearest bit still holding, then once round the seam ──
        const uncutAt = j => PATH_SEAM[stepAt(j)].some(k => !s.seamCut[k]);
        function uncutNear(j, dir) {                             // still holding just behind the torch or a little ahead of it
            for (let d = -AUTO_BEHIND; d <= AUTO_AHEAD; d++) if (uncutAt(j + dir * d)) return true;
            return false;
        }
        function reachSeam(dt) {
            let best = null;
            PATH.forEach((p, j) => { const d = Math.hypot(p.x - s.tip.x, p.y - s.tip.y); if (uncutAt(j) && (!best || d < best.d)) best = { j, d }; });
            if (!best) return;
            const p = PATH[best.j], max = AUTO_REACH * dt;
            if (best.d > max) { s.tip = clampTip(s.tip.x + ((p.x - s.tip.x) / best.d) * max, s.tip.y + ((p.y - s.tip.y) / best.d) * max); return; }
            s.tip = { ...p };
            s.auto = { ...s.auto, j: best.j, dir: uncutAt(best.j + 3) ? 1 : -1 };   // ride the way the uncut seam goes
        }
        function autoMove(dt) {                                  // returns whether they fire
            const a = s.auto, h = heatAt(s.tip), cooling = a.cooling ? h > AUTO_COOLED : h >= AUTO_HOT;   // a careful hand waits for the plate
            s.auto = { ...a, cooling };
            if (a.j === null) { reachSeam(dt); return false; }
            if (cooling || paused()) return false;
            const cut = uncutNear(a.j, a.dir), j = wrapPath(a.j + a.dir * (cut ? AUTO_CUT : AUTO_GLIDE) * dt);
            s.auto = { ...s.auto, j };
            s.tip = pathAt(j);
            return cut;
        }
        const solid = (x, y) => s.part === 'hatch' || Math.hypot(x - DX, y - DY) <= DR;   // off the disc there is nothing to burn
        function burn(p, dt) {
            if (!solid(p.x, p.y)) return;
            const x0 = Math.round(p.x), y0 = Math.round(p.y), c = cellOf(p), gx = c % GW, gy = (c - gx) / GW;
            for (let y = y0 - 3; y <= y0 + 3; y++) for (let x = x0 - 3; x <= x0 + 3; x++) {
                const w = 1 - Math.hypot(x - p.x, y - p.y) / BURN_R, i = y * W + x, was = s.depth[i];
                if (x < 0 || y < 0 || x >= W || y >= H || w <= 0 || !solid(x, y)) continue;
                const most = s.part === 'hatch' && !NEAR_SEAM[i] ? OFF_SEAM_MAX : 2;   // off the seam the plate is thick: a scorch, never a cut
                if (was === 0) s.marks.push(i);
                s.depth[i] = Math.min(most, was + BURN * s.P.burn * w * dt); s.lastT[i] = clock;
                if (was < 1 && s.depth[i] >= 1) through(x, y);
            }
            for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) if (gx + ox >= 0 && gy + oy >= 0 && gx + ox < GW && gy + oy < GH) s.heat[c + oy * GW + ox] += HEAT_IN * s.P.heat * dt * (ox && oy ? 0.25 : ox || oy ? 0.5 : 1);
        }
        function spark(x, y) {                                   // no air: sparks fly straight, out of the metal being cut
            const a = Math.random() * Math.PI * 2, v = 30 + Math.random() * 70;
            s.sparks = s.sparks.concat({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.2 + Math.random() * 0.45 });
        }
        function progress(text) { s.progT = clock; s.progText = text; }
        function teach() { if (!s.auto && !taught[s.part]) taught = { ...taught, [s.part]: true }; }   // only the player's own hand learns
        function through(x, y) {                                 // a pixel just cut through
            s.thruNow++; s.hotX = x;
            if (Math.random() < SPARK_CHANCE) spark(x, y);
            if (s.part === 'hatch') {                            // a kerf within three pixels frees that bit of seam
                const was = s.cut;
                for (let k, oy = -FREE_R; oy <= FREE_R; oy++) for (let ox = -FREE_R; ox <= FREE_R; ox++) if ((k = SEAM_AT[(y + oy) * W + x + ox]) >= 0 && !s.seamCut[k]) { s.seamCut[k] = 1; s.cut++; }
                if (s.cut > was) progress('');
                return;
            }
            if (!s.centre && Math.hypot(x - DX, y - DY) <= 1.6) { s.centre = true; progress('CENTRE'); teach(); }
            LINES.forEach((l, j) => {
                const a = along({ x, y }, l);
                if (s.cutT[j] !== null || a < CUT_NEAR || a > CUT_FAR || across({ x, y }, l) > ON_LINE) return;
                s.cutT[j] = clock; progress(s.cutT.filter(v => v !== null).length + '/' + LINES.length); teach();
            });
        }
        function uncutNearTip() {                                // the hatch: is any seam still holding within reach of the flame?
            const x0 = Math.round(s.tip.x), y0 = Math.round(s.tip.y);
            for (let y = y0 - FREE_R; y <= y0 + FREE_R; y++) for (let x = x0 - FREE_R; x <= x0 + FREE_R; x++) { const k = SEAM_AT[y * W + x]; if (k >= 0 && !s.seamCut[k]) return true; }
            return false;
        }
        function touch(p) {                                      // the torch will not burn the two figures: a scorch, not a cut
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
            s.thruNow = 0;
            s.sparks = s.sparks.map(p => ({ ...p, x: p.x + p.vx * dt, y: p.y + p.vy * dt, life: p.life - dt })).filter(p => p.life > 0);
            cool(dt); talk();
            if (s.part === 'disc') sweepOn(dt);
            if (isOpen()) s.openT += dt;
            if (s.phase === 'cut') cutting(dt); else { s.firing = false; s.glow = 0; }
            if (s.thruNow) s.lastThruT = clock;
            s.hot = s.hot * Math.exp(-dt / HOT_FADE) + s.thruNow;
            snd.frame(dt, { firing: s.firing, heat: Math.max(heatAt(s.tip), s.glow), part: s.part, thru: s.thruNow, hot: s.hot, hotX: s.hotX, pan: (s.tip.x / W) * 1.2 - 0.6 });   // the hiss brightens as the metal heats
        }
        function cutting(dt) {
            s.burst = Math.max(0, s.burst - dt);
            const from = s.tip, wants = s.auto ? autoMove(dt) : playerMove(dt);
            trackSpeed();
            s.pause = Math.max(0, s.pause - dt);
            if (s.hotSpot && s.pause <= 0 && heatAt(s.hotSpot) <= COOLED) s.hotSpot = null;
            s.firing = wants && !paused() && s.fuel > 0;
            if (s.firing) fire(dt, from); else { s.strayT = 0; s.fastT = 0; s.idleT = 0; s.glow = 0; }
            if (s.part === 'hatch') hatchRules(dt); else discRules();
            if (s.fuel <= 0 && s.phase === 'cut') runDry();
        }
        function runDry() {
            if (s.auto) return swapTank();                       // the crew member just fetches another tank
            s.phase = 'dry'; s.firing = false; script(SAY[s.part + 'Dry'], 0); showButtons();
        }
        function fire(dt, from) {
            const to = s.tip, n = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 0.7));
            s.fuel = Math.max(0, s.fuel - dt / s.P.fuel);
            for (let k = 1; k <= n; k++) {                       // burn along the whole path, so a quick stroke leaves a shallow line
                const p = { x: MiniLab.lerp(from.x, to.x, k / n), y: MiniLab.lerp(from.y, to.y, k / n) };
                if (s.part === 'disc' && nearFigures(p, 2).length) return touch(p);
                burn(p, dt / n);
            }
            readMetal(dt, to);
            const h = heatAt(to);
            if (h >= WARN && s.part === 'hatch') react('hot', SAY.hot);
            if (h >= 1) {
                const w = { x: Math.round(to.x), y: Math.round(to.y) };
                s.pause = 1; s.hotSpot = { ...to };
                if (!s.warps.some(o => Math.hypot(o.x - w.x, o.y - w.y) < 7)) s.warps = s.warps.concat(w);   // one warp per spot
                snd.warp(s.part === 'disc'); react('warp', s.part === 'hatch' ? SAY.warp : SAY.discHot);
            }
            if (s.part !== 'hatch') return;
            const stray = Math.abs(sdf(to.x, to.y)) > ON_SEAM;
            s.strayT = stray ? s.strayT + dt : 0;
            if (stray && s.strayT >= STRAY_AFTER && s.strayT - dt < STRAY_AFTER) { s.scars++; react('stray', SAY.stray); }
        }
        function readMetal(dt, to) {                             // what the metal under the flame is doing: its heat, too fast, done here
            const i = Math.round(to.y) * W + Math.round(to.x), hatch = s.part === 'hatch', cuttable = solid(to.x, to.y) && (!hatch || NEAR_SEAM[i] === 1);
            const holding = hatch ? uncutNearTip() : s.depth[i] < 1;   // something here still to cut
            s.glow = cuttable ? Math.min(1, s.depth[i]) : 0;
            s.fastT = cuttable && holding && s.speed > FAST * s.P.burn ? s.fastT + dt : Math.max(0, s.fastT - dt);
            s.idleT = hatch && cuttable && !holding && s.glow >= 1 && s.speed < IDLE_SPEED ? s.idleT + dt : 0;
        }
        function hatchRules(dt) {
            const f = s.cut / SEAM.length;
            if (f >= TAUGHT_AT) teach();
            if (s.fastT > 0.6 && !s.auto) react('fast', SAY.fast);
            if (f >= 0.5) react('half', SAY.half);
            s.stall = s.cut === s.lastCut ? s.stall + dt : 0; s.lastCut = s.cut;
            if (f >= 0.9 && s.stall > 3 && !s.auto) react('gap', SAY.gap);   // the coaching is for the player's hand only
            if (f >= GROAN_FROM && (s.groanT -= dt) <= 0 && s.hot >= 30) {   // the last of the seam holding: the plate groans and sheds a little dust
                s.groanT = 2.4 + Math.random() * 1.6;
                snd.groan(MiniLab.clamp((f - GROAN_FROM) / (TEAR - GROAN_FROM), 0, 1));
                const left = SEAM.filter((_, j) => !s.seamCut[j]);
                s.sparks = s.sparks.concat(Array.from({ length: Math.min(6, left.length) }, () => {
                    const i = left[Math.floor(Math.random() * left.length)], x = i % W;
                    return { x, y: (i - x) / W, vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8, life: 1 + Math.random(), dust: true };
                }));
            }
            if (f >= TEAR) crackOpen();
        }
        function crackOpen() {
            s.phase = 'open'; s.openT = 0;
            snd.crack();
            s.sparks = s.sparks.concat(Array.from({ length: 120 }, (_, k) => {   // the last of the air: a flash of ice, then twenty years of dust
                const i = SEAM[Math.floor(Math.random() * SEAM.length)], x = i % W, y = (i - x) / W, a = Math.atan2(y - HB.cy, x - HB.cx), ice = k < 80;
                const v = ice ? 20 + Math.random() * 60 : 5 + Math.random() * 16;
                return { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: (ice ? 0.5 : 1.4) + Math.random() * 1.2, ice, dust: !ice };
            }));
            script(SAY.open, 3.2, () => { s.phase = 'end'; showButtons(); });   // the spotter speaks once the hatch has moved off the glint
            showButtons();
        }
        function discRules() {
            if (!s.centre || s.cutT.some(v => v === null)) return;
            s.phase = 'closing'; s.final = true; s.sweep = -0.2; s.openT = 0;   // the light makes one more pass, and reads nothing
            snd.bell(); script([], 0); showButtons();
        }
        function sweepOn(dt) {
            s.sweep += dt / (s.final ? FINAL_SWEEP : SWEEP);
            if (s.sweep < 1) return;
            s.sweep -= 1;
            if (!s.final) return;
            s.final = false;
            script([SAY.done, s.figTouched ? SAY.marked : SAY.clean], 0, () => { s.phase = 'end'; showButtons(); });
        }

        // ── drawing, in art pixels: the still picture, then two layers drawn fresh each frame (under and over the drifting lid) ──
        const under = makeLayer(AW, AH), over = makeLayer(AW, AH), R = ramps();
        const A = v => Math.floor((v + 0.5) * d);                // an index-space position → the art pixel it falls in
        const art = fn => MiniLab.inArt(ctx, fn);
        function udot(L, x, y, col) {                            // one picture unit, as MiniLab.dot: the art pixels of unit pixel (x, y)
            const ux = Math.round(x), uy = Math.round(y);
            for (let ay = Math.floor(uy * d + 0.5); ay < Math.floor((uy + 1) * d + 0.5); ay++) for (let ax = Math.floor(ux * d + 0.5); ax < Math.floor((ux + 1) * d + 0.5); ax++) L.set(ax, ay, col);
        }
        function ring(L, x, y, r, col, tone) {                   // a circle one art pixel wide about index-space (x, y)
            const cx = (x + 0.5) * d, cy = (y + 0.5) * d, ar = r * d, n = Math.ceil(ar * 7);
            for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, px = Math.floor(cx + Math.cos(a) * ar), py = Math.floor(cy + Math.sin(a) * ar); if (MiniLab.on(px, py, tone)) L.set(px, py, col); }
        }

        // the cuts, in art pixels: each unit the flame has touched spreads over the art pixels round it, read between units
        const artSeen = new Uint8Array(AW * AH);
        let artMarks = [], marksDone = 0, marksOf = null;
        function syncMarks() {
            if (marksOf !== s.marks) { marksOf = s.marks; marksDone = 0; artMarks = []; artSeen.fill(0); }
            for (; marksDone < s.marks.length; marksDone++) {
                const i = s.marks[marksDone], x = i % W, y = (i - x) / W;
                const ax0 = Math.max(0, Math.ceil((x - 0.5) * d - 0.5)), ax1 = Math.min(AW - 1, Math.floor((x + 1.5) * d - 0.5 - 1e-6));
                const ay0 = Math.max(0, Math.ceil((y - 0.5) * d - 0.5)), ay1 = Math.min(AH - 1, Math.floor((y + 1.5) * d - 0.5 - 1e-6));
                for (let ay = ay0; ay <= ay1; ay++) for (let ax = ax0; ax <= ax1; ax++) { const k = ay * AW + ax; if (!artSeen[k]) { artSeen[k] = 1; artMarks.push(k); } }
            }
        }
        function sampleMark(ax, ay) {                            // depth between the four nearest units; the newest touch of them; the plate there
            const fx = (ax + 0.5) / d - 0.5, fy = (ay + 0.5) / d - 0.5, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
            let depth = 0, last = -99;
            for (let k = 0; k < 4; k++) {
                const x = MiniLab.clamp(x0 + (k & 1), 0, W - 1), y = MiniLab.clamp(y0 + (k >> 1), 0, H - 1), i = y * W + x, w = (k & 1 ? tx : 1 - tx) * (k >> 1 ? ty : 1 - ty);
                depth += s.depth[i] * w;
                if (s.depth[i] > 0 && s.lastT[i] > last) last = s.lastT[i];
            }
            const near = MiniLab.clamp(Math.round(fy), 0, H - 1) * W + MiniLab.clamp(Math.round(fx), 0, W - 1);
            return { depth, age: clock - last, near, fx, fy };
        }
        function markColor(m, x, y) {                            // the metal's heat, read at a glance (x, y: the art pixel, for the grain)
            const dd = m.depth;
            if (dd >= 1) return MiniLab.pick(KERF, Math.exp(-m.age / KERF_COOL), x, y);   // cut through: white while the flame is on it, then warm, red, a dark slot
            if (s.part === 'hatch' && !NEAR_SEAM[m.near]) return dd > 0.12 && MiniLab.on(x, y, 0.2 + 0.5 * dd) ? SCORCH : null;   // thick plate: a faint scorch, no glow
            const glow = dd * Math.exp(-m.age / HEAT_SHOW);
            if (glow > 0.08) return MiniLab.pick(HEATING, glow, x, y);   // heating: dull, red, orange; it fades if the flame moves on too soon
            if (dd <= 0.3) return null;
            return s.part === 'hatch' ? (MiniLab.on(x, y, 0.5) ? SCORCH : C.hull[1]) : CUT_LINE;   // where it never went through: a scorch, the cut's tempered edge
        }
        function drawBurns(L, opened) {                          // warps, the plate's glow, the kerf
            const disc = s.part === 'disc';
            s.warps.forEach(w => {                               // a buckled dimple, tempered warm inside and cool outside
                ring(L, w.x, w.y, 3, disc ? DIM_GOLD : TEMPER, 0.55); ring(L, w.x, w.y, 4.2, disc ? DIM_GOLD : TEMPER, 0.3); ring(L, w.x, w.y, 5, disc ? DIM_GOLD : C.mist, 0.4);
                L.set(A(w.x - 1.2), A(w.y - 1.2), disc ? C.lightHalo : C.hull[4]); L.set(A(w.x + 1), A(w.y + 1), C.void); L.set(A(w.x + 1.6), A(w.y + 1), C.void);
            });
            for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {   // the plate's heat, read smoothly between the cells
                const c = gy * GW + gx, v = s.heat[c];
                if (v < 0.18 && (gx === 0 || s.heat[c - 1] < 0.18) && (gx === GW - 1 || s.heat[c + 1] < 0.18) && (gy === 0 || s.heat[c - GW] < 0.18) && (gy === GH - 1 || s.heat[c + GW] < 0.18)) continue;
                const ax0 = Math.floor(gx * CELL * d), ax1 = Math.floor((gx + 1) * CELL * d), ay0 = Math.floor(gy * CELL * d), ay1 = Math.floor((gy + 1) * CELL * d);
                for (let ay = ay0; ay < ay1; ay++) for (let ax = ax0; ax < ax1; ax++) {
                    const hv = heatBetween((ax + 0.5) / d, (ay + 0.5) / d);
                    if (hv < 0.18 || (opened && sdf((ax + 0.5) / d - 0.5, (ay + 0.5) / d - 0.5) <= 0.5)) continue;
                    if (MiniLab.on(ax, ay, Math.min(1, (hv - 0.18) * 1.4))) L.set(ax, ay, MiniLab.pick(GLOW, MiniLab.clamp((hv - 0.18) / 0.82, 0, 1), ax, ay));
                }
            }
            syncMarks();
            for (let n = 0; n < artMarks.length; n++) {
                const k = artMarks[n], ax = k % AW, ay = (k - ax) / AW, m = sampleMark(ax, ay);
                if (opened && sdf(m.fx, m.fy) <= 0.5) continue;
                const col = markColor(m, ax, ay);
                if (col) L.set(ax, ay, col);
            }
        }
        function heatBetween(ux, uy) {                           // the heat grid at a point in units, read between cell centres
            const cx = ux / CELL - 0.5, cy = uy / CELL - 0.5, x0 = Math.floor(cx), y0 = Math.floor(cy), tx = cx - x0, ty = cy - y0;
            const at = (x, y) => s.heat[MiniLab.clamp(y, 0, GH - 1) * GW + MiniLab.clamp(x, 0, GW - 1)];
            return (at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx) * (1 - ty) + (at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx) * ty;
        }
        function drawSparks(L) {
            s.sparks.forEach(p => {
                const x = (p.x + 0.5) * d, y = (p.y + 0.5) * d;
                if (p.dust) return L.set(x, y, p.life > 0.9 ? C.textDim : C.mist);
                const k = (p.ice ? 0.03 : 0.025) * d;            // a short streak behind each
                if (p.ice || p.life > 0.25) L.line(x - p.vx * k, y - p.vy * k, x, y, p.ice ? C.uiDim : C.warm);
                L.set(x, y, p.ice ? (p.life > 0.7 ? C.star : C.uiBright) : p.life > 0.3 ? C.warmBright : p.life > 0.12 ? C.warm : C.hurt[3]);
            });
        }
        function reticle(L, x, y) {                              // the aim, and the pointer: four short ticks, outlined so they stand out on gold and bright plate
            const col = s.phase === 'cut' && paused() ? (Math.floor(clock * 4) % 2 ? C.danger : C.hurt[3]) : C.ui, cx = A(x), cy = A(y);
            PLUS.forEach(([ox, oy]) => { for (let k = Math.round(4 * d); k <= Math.round(6.4 * d); k++) { L.set(cx + ox * k + oy, cy + oy * k + ox, C.void); L.set(cx + ox * k - oy, cy + oy * k - ox, C.void); } });
            PLUS.forEach(([ox, oy]) => { for (let k = Math.round(4 * d); k <= Math.round(6.4 * d); k++) L.set(cx + ox * k, cy + oy * k, col); });
            if (!s.firing) { PLUS.forEach(([ox, oy]) => L.set(cx + ox, cy + oy, C.void)); L.set(cx, cy, C.uiBright); }   // the exact point the flame will touch
        }
        function drawFlameLight(L) {                             // under the burns: the flame lights the metal round it, more as the metal glows
            if (!s.firing) return;
            const cx = (s.tip.x + 0.5) * d, cy = (s.tip.y + 0.5) * d, r = 15 * d, peak = 0.1 + 0.2 * s.glow;
            for (let ay = Math.floor(cy - r); ay <= cy + r; ay++) for (let ax = Math.floor(cx - r); ax <= cx + r; ax++) {
                const q = Math.hypot(ax + 0.5 - cx, ay + 0.5 - cy) / r;
                if (q < 1 && MiniLab.on(ax, ay, peak * (1 - q) * (1 - q))) L.set(ax, ay, C.warm);
            }
        }
        const TOOL_R = k => (k < 6 ? 0.75 + 0.06 * k : k < 7.2 ? 1.45 : k < 9.4 ? 1.2 : k < 11.4 ? 2.05 : k < 28.4 ? 2.5 : 2.5 - (k - 28.4) * 1.6);
        /** The torch: nozzle, valve, ribbed grip and hose, held STANDOFF off the metal along U from the tip; `away` pulls it back.
            hoseTo: where the hose goes (off the bottom of the picture for you, to Jaxon's pack when he has it). */
        function drawTool(L, tip, U, away, hoseTo) {
            const n1 = { x: U.y, y: -U.x }, N = n1.x - n1.y >= 0 ? n1 : { x: -n1.x, y: -n1.y };   // its lit side: towards the light, up and right
            const bx = tip.x + U.x * (away + STANDOFF), by = tip.y + U.y * (away + STANDOFF), at = (k, o = 0) => [bx + U.x * k + N.x * o, by + U.y * k + N.y * o];
            const [hx, hy] = at(29), [ex, ey] = hoseTo(hx, hy), mx = (hx + ex) / 2 + 6, my = Math.max(hy, ey) + 18;   // the hose sags
            for (let t = 0; t <= 1; t += 0.004) {
                const u = 1 - t, px = u * u * hx + 2 * u * t * mx + t * t * ex, py = u * u * hy + 2 * u * t * my + t * t * ey;
                const tx = 2 * u * (mx - hx) + 2 * t * (ex - mx), ty = 2 * u * (my - hy) + 2 * t * (ey - my), tl = Math.hypot(tx, ty) || 1, qx = ty / tl, qy = -tx / tl, lit = qx - qy >= 0 ? 1 : -1;
                const cx = (px + 0.5) * d, cy = (py + 0.5) * d;
                L.set(cx - qx * lit * 1.6, cy - qy * lit * 1.6, C.void); L.set(cx - qx * lit * 0.6, cy - qy * lit * 0.6, HOSE[0]);
                L.set(cx + qx * lit * 0.4, cy + qy * lit * 0.4, HOSE[1]); L.set(cx + qx * lit * 1.3, cy + qy * lit * 1.3, HOSE[2]);
            }
            const xs = [at(-1, -3.5), at(-1, 3.5), at(30, -3.5), at(30, 3.5)].map(q => q[0]), ys = [at(-1, -3.5), at(-1, 3.5), at(30, -3.5), at(30, 3.5)].map(q => q[1]);
            eachArt(d, Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys), (ax, ay, fx, fy) => {
                const rx = fx - bx, ry = fy - by, k = rx * U.x + ry * U.y, o = rx * N.x + ry * N.y;
                if (k < -0.7 || k > 29.6) return;
                const r = Math.max(0.5, TOOL_R(Math.max(0, k))), ao = Math.abs(o);
                if (ao > r + 0.75) return;
                if (ao > r || k < -0.1) return L.set(ax, ay, C.void);   // a dark outline round it
                const n = o / r, nz = Math.sqrt(Math.max(0, 1 - n * n));
                let lum = 0.08 + 0.64 * Math.max(0, 0.72 * n + 0.6 * nz) + (n > 0.38 && n < 0.72 ? 0.14 : 0), ramp = R.HULL;
                if (k < 6) { ramp = R.COPPER; lum += k < 0.8 ? 0.22 : 0; }             // the copper nozzle, its mouth hot
                else if (k < 7.2) lum += 0.12;                                         // a bright ring
                else if (k >= 9.4 && k < 11.4) lum += 0.06;                            // the valve block
                else if (k >= 11.4 && k < 28.4) { ramp = R.RUBBER; if (k > 13 && (k - 13) % 2.2 < 0.6) lum -= 0.3; }   // the ribbed grip
                L.pick(ax, ay, ramp, MiniLab.clamp(lum, 0, 1));
            });
            const [rlx, rly] = at(10.4, 1.4);                    // the ready light, on the valve block
            const rc = s.phase === 'cut' && paused() ? C.danger : s.firing ? C.uiBright : C.uiDim;
            L.set(A(rlx), A(rly), rc); L.set(A(rlx) + 1, A(rly), rc);
            if (away > 0) return;
            if (s.firing) for (let k = 0.3; k <= STANDOFF; k += 0.2) {   // the flame: a thin blue-white jet; the metal shows its own heat
                const fx = (tip.x + U.x * k + 0.5) * d, fy = (tip.y + U.y * k + 0.5) * d;
                L.set(fx, fy, k < 1.6 ? C.star : C.uiBright);
                if (k > 1 && k < 2.6) L.set(fx + N.x, fy + N.y, R.ICE.hex[4]);
            }
        }
        const TU_DIR = { x: TU.x, y: TU.y }, offBottom = (hx, hy) => [hx + 30, H + 10];
        function drawTorch(L) {                                  // yours, held just off the metal; when the job is done it is pulled back
            if (s.auto) return;
            const away = s.phase === 'cut' || s.phase === 'dry' ? 0 : 300 * Math.min(1, s.openT / 0.6) ** 2;
            drawTool(L, s.tip, TU_DIR, away, offBottom);
            if (away === 0) reticle(L, s.tip.x, s.tip.y);
        }

        // ── Jaxon (the cutter), in his suit: by our lamp, tethered; when he takes the torch he works the seam from beside it ──
        const JAX_H = 64, JAX_IDLE = { x: 205, y: 250 }, JAX_REACH = 27;   // units: his height; his feet by the lamp; hands to the tip
        const cutterId = window.MiniCrew ? window.MiniCrew.idOf(setup.cutter) || 'jaxon' : 'jaxon';
        let jax = { x: JAX_IDLE.x, y: JAX_IDLE.y, facing: 1, side: -1, working: false }, lastDraw = 0;
        const handsOf = j => ({ x: j.x + j.facing * 0.33 * JAX_H, y: j.y - 0.7 * JAX_H });
        function moveJaxon(dt) {
            const working = !!s.auto && (s.phase === 'cut' || s.phase === 'dry');
            let want = { x: JAX_IDLE.x, y: JAX_IDLE.y, facing: 1 };
            if (working) {                                       // hands beside the tip, out from the seam, on the side he is working from
                if (s.tip.x < HB.cx - 10) jax.side = -1; else if (s.tip.x > HB.cx + 10) jax.side = 1;
                const n = normal(s.tip.x, s.tip.y), wx = n.x * 0.6 + jax.side * 0.8, wy = n.y * 0.6 + 0.35, wl = Math.hypot(wx, wy) || 1;
                const hx = s.tip.x + (wx / wl) * JAX_REACH, hy = s.tip.y + (wy / wl) * JAX_REACH, facing = s.tip.x >= hx ? 1 : -1;
                want = { x: hx - facing * 0.33 * JAX_H, y: hy + 0.7 * JAX_H, facing };
            }
            const k = 1 - Math.exp(-dt * (working ? 6 : 2.5));
            jax = { ...jax, x: jax.x + (want.x - jax.x) * k, y: jax.y + (want.y - jax.y) * k, facing: want.facing, working };
        }
        function drawTether(L) {                                 // his line to the lamp's foot, slack
            const MC = window.MiniCrew;
            if (!MC || s.part !== 'hatch') return;
            const bob = jax.working ? 0 : Math.round(Math.sin(Math.floor(clock * 8) / 8 * 0.9) * 2 * d) / d;
            const x0 = jax.x - jax.facing * 0.1 * JAX_H, y0 = jax.y - 0.5 * JAX_H + bob, x1 = LAMP.x - 3, y1 = LAMP.y + 5, mx = (x0 + x1) / 2, my = Math.max(y0, y1) + 10;
            for (let t = 0; t <= 1; t += 0.01) { const u = 1 - t; L.set((u * u * x0 + 2 * u * t * mx + t * t * x1 + 0.5) * d, (u * u * y0 + 2 * u * t * my + t * t * y1 + 0.5) * d, t % 0.04 < 0.02 ? C.hull[3] : C.hull[2]); }
        }
        function drawJaxon() {
            const MC = window.MiniCrew;
            if (!MC || s.part !== 'hatch') return;
            const bob = jax.working ? 0 : Math.round(Math.sin(Math.floor(clock * 8) / 8 * 0.9) * 2 * d) / d;   // he drifts on his line, eight steps a second
            const warm = MiniLab.clamp(1 - Math.hypot(jax.x - LAMP.aimX, jax.y - 30 - LAMP.aimY) / 200, 0, 1);
            MC.small(ctx, cutterId, jax.x, jax.y + bob, { h: JAX_H, pose: jax.working ? 'reach' : 'float', facing: jax.facing, light: 1, warm: 0.25 + 0.5 * warm, dim: 0.25 });
        }
        function drawJaxonTorch(L) {                             // the torch in his hands, its hose to his pack
            if (!s.auto || !jax.working) return;
            const hd = handsOf(jax), ux = hd.x - s.tip.x, uy = hd.y - s.tip.y, ul = Math.hypot(ux, uy) || 1;
            drawTool(L, s.tip, { x: ux / ul, y: uy / ul }, 0, () => [jax.x - jax.facing * 0.13 * JAX_H, jax.y - 0.6 * JAX_H]);
        }

        // ── the readouts: by the torch, one short line; and a few quiet ones in the corner (MiniHost notes, IBM Plex) ──
        const shown = new Map();
        function note(id, text, o) {                             // only touch the page when a readout changes
            const key = text == null ? null : [text, o.x, o.y, o.tone, o.align, o.size].join('|');
            if (shown.get(id) === key) return;
            shown.set(id, key);
            if (ui.note) ui.note(id, text, o);
        }
        function unitsPerPx() { const r = cv.getBoundingClientRect(); return r.width > 0 ? W / r.width : 0.5; }
        const growing = () => clock - s.progT < READOUT_FOR;
        function tipLabel() {                                    // one short readout by the torch, or none: what is wrong, what to do, how far
            if (!canSteer()) return null;
            if (paused()) return Math.floor(clock * 3) % 3 ? [['COOLING'], 'danger'] : null;
            if (s.firing && s.strayT >= STRAY_AFTER) return [['OFF THE LINE'], 'text'];
            if (!taught[s.part]) { const hints = HINTS[s.part]; return [hints[Math.min(hints.length - 1, s.cut > 0 ? 1 : 0)], 'ui']; }
            if (s.firing && s.fastT > FAST_AFTER) return [['SLOW DOWN'], 'warm'];
            if (s.firing && s.idleT > IDLE_AFTER) return [['MOVE ON'], 'warm'];
            if (growing()) return [[s.part === 'hatch' ? seamPercent() + '%' : s.progText], 'ui'];
            return null;
        }
        const TIP_PX = 16, TIP_LINE = 1.25, NOTE_PX = 13, NOTE_LINE = 1.3, CHAR_EM = 0.62;   // the note font (minigames.css): px, line height, a Plex Mono character
        function drawTipLabel() {                                // up and to the left of the tip: clear of the torch, and of the seam running through the tip
            const label = tipLabel(), upx = unitsPerPx();
            if (!label) { note('tip0', null, {}); note('tip1', null, {}); return; }
            const [lines, tone] = label, lh = TIP_PX * TIP_LINE * upx, w = Math.max(...lines.map(l => l.length)) * TIP_PX * CHAR_EM * upx, h = lines.length * lh;
            const x = s.tip.x + 0.5, y = s.tip.y + 0.5, left = x - LABEL_GAP - w >= 3, up = y - LABEL_GAP - h >= 3;
            const lx = left ? x - LABEL_GAP : Math.min(x + LABEL_GAP, W - 3 - w), ly = MiniLab.clamp(up ? y - LABEL_GAP - h : y + LABEL_GAP, 3, H - 3 - h);
            [0, 1].forEach(k => note('tip' + k, lines[k] == null ? null : lines[k], { x: lx, y: ly + k * lh, align: left ? 'right' : 'left', tone, size: 'm' }));
        }
        const seamPercent = () => Math.min(100, Math.floor((100 * s.cut) / (SEAM.length * TEAR)));   // the hatch tears free at TEAR: that is 100%
        function readout(rows, fromTop) {                        // [id, text or null, tone]: stacked in the corner, the empty ones left out
            const lh = NOTE_PX * NOTE_LINE * unitsPerPx(), live = rows.filter(r => r[1] != null);
            rows.filter(r => r[1] == null).forEach(r => note(r[0], null, {}));
            live.forEach(([id, text, tone], k) => note(id, text, { x: 8, y: fromTop ? 8 + k * lh : H - 8 - (live.length - k) * lh, tone }));
        }
        function heatRow() {                                     // the metal's heat under the torch, while there is any
            const h = heatAt(s.tip), cooling = s.phase === 'cut' && paused();
            if (h < 0.1 && !cooling) return ['heat', null];
            return ['heat', 'HEAT ' + Math.min(100, Math.round(h * 100)) + '%' + (cooling && Math.floor(clock * 3) % 2 ? '   COOLING' : ''), h >= WARN || cooling ? 'danger' : h > 0.5 ? 'warm' : 'dim'];
        }
        const fuelRow = () => ['fuel', 'FUEL ' + Math.round(s.fuel * 100) + '%', s.fuel < 0.2 ? 'danger' : 'dim'];
        function drawSeamGuide(L, f) {                           // the suit marks what is still to cut, in its own cool colour; near the end it blinks
            const march = Math.floor(clock * 6), blink = f >= 0.85 && Math.floor(clock * 3) % 2;
            if (blink) GUIDE.forEach(g => { if (!s.seamCut[g.k]) PLUS.forEach(([ox, oy]) => L.set(g.ax + ox, g.ay + oy, C.ui)); });
            GUIDE.forEach(g => {
                if (s.seamCut[g.k]) return;
                if (blink) L.set(g.ax, g.ay, C.uiBright); else if ((g.j + march) % 6 < 3) L.set(g.ax, g.ay, C.ui);
            });
        }
        const GUIDE = [];                                        // the seam as a fine line of art pixels, each tied to its seam pixel and its step round the path
        if (setup.mode === 'hatch') eachArt(d, ...HATCH_BOX, (ax, ay, x, y) => {
            if (Math.abs(sdf(x, y)) > 0.55 / d) return;
            let k = -1, kd = 9;
            for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) { const q = SEAM_AT[(Math.round(y) + oy) * W + Math.round(x) + ox], dd = Math.hypot(Math.round(x) + ox - x, Math.round(y) + oy - y); if (q >= 0 && dd < kd) { k = q; kd = dd; } }
            if (k < 0) return;
            let j = 0, jd = 1e9;
            PATH.forEach((p, n) => { const dd = (p.x - x) ** 2 + (p.y - y) ** 2; if (dd < jd) { jd = dd; j = n; } });
            GUIDE.push({ ax, ay, k, j });
        });
        function drawLid(g, t) {                                 // it pops, hangs, knocks the rim, then drifts out towards us
            const p = Math.sin(Math.min(1, t / 0.18) * Math.PI / 2), u = Math.max(0, t - 0.18), v = Math.max(0, t - THUD_AT);
            const k = 1 + 0.05 * p + 0.012 * u + 0.07 * v, lift = 2 + 30 * (k - 1), ox = (HB.cx + 0.5) * d, oy = (HB.cy + 0.5) * d;
            g.save(); g.imageSmoothingEnabled = false;
            g.translate(Math.round(ox + (4 * p + 4 * u + 10 * v + 3 * v * v) * d), Math.round(oy + (-3 * p - 1.5 * u - 4 * v) * d));
            g.rotate(0.012 * u + 0.05 * v + 0.03 * Math.min(1, v * 6)); g.scale(k, k);
            g.drawImage(lidShadow, -ox + Math.round(lift * d), -oy + Math.round(lift * d)); g.drawImage(lid, -ox, -oy);   // lifting off, it casts a shadow
            g.restore();
        }
        function drawGlint(L) {                                  // one glint on the corridor floor: our lamp, caught by something
            const ph = (clock * 0.6) % 1, arm = ph < 0.08 ? 3 : ph < 0.2 ? 2 : ph < 0.3 ? 1 : 0, gx = A(GLINT.x), gy = A(GLINT.y);
            L.set(gx, gy, arm ? C.star : C.warm);
            for (let k = 1; k <= Math.round(arm * d); k++) PLUS.forEach(([ox, oy]) => L.set(gx + ox * k, gy + oy * k, k <= d ? C.warmBright : C.warm));
        }
        function renderHatch() {
            const opened = s.phase === 'open' || s.phase === 'end', f = opened ? 1 : s.cut / SEAM.length;
            const jolt = opened && s.openT < 0.45 ? Math.round(2.4 * (1 - s.openT / 0.45)) : 0;   // the crack shakes the picture, then settles
            moveJaxon(Math.min(0.1, clock - lastDraw)); lastDraw = clock;
            ctx.setTransform(d, 0, 0, d, 0, 0);
            art(g => { g.fillStyle = C.void; g.fillRect(0, 0, AW, AH); });
            ctx.setTransform(d, 0, 0, d, Math.round(jolt * d * (Math.random() < 0.5 ? -1 : 1)), Math.round(jolt * d * (Math.random() < 0.5 ? -1 : 1)));
            under.clear(); over.clear();
            art(g => { g.drawImage(hullBg, 0, 0); if (opened) g.drawImage(hole, 0, 0); });
            if (opened && s.openT > 2.6) drawGlint(under);
            if (opened && s.openT < 0.4) SEAM.forEach(i => {      // the last air flashing out of the seam as ice
                const x = i % W, y = (i - x) / W, k = 1 - s.openT / 0.4;
                for (let ay = A(y - 1); ay <= A(y + 1); ay++) for (let ax = A(x - 1); ax <= A(x + 1); ax++) if (MiniLab.on(ax, ay, 0.45 * k)) under.set(ax, ay, C.uiBright);
                if (MiniLab.on(A(x), A(y), k)) udot(under, x, y, C.star);
            });
            drawFlameLight(under); drawBurns(under, opened);
            if (!opened) drawSeamGuide(under, f);
            drawTether(under);
            art(g => under.draw(g));
            if (opened && s.openT < 10) art(g => drawLid(g, s.openT));
            drawJaxon();
            drawJaxonTorch(over); drawSparks(over); drawTorch(over);
            art(g => over.draw(g));
            ctx.setTransform(d, 0, 0, d, 0, 0);
            drawTipLabel();
            const pct = opened ? 100 : seamPercent();             // the readout moves as the seam frees
            readout([fuelRow(), heatRow(), ['seam', 'SEAM ' + pct + '%', pct >= 100 || growing() ? 'ui' : 'text'],
                ['marks', s.scars || s.warps.length ? 'SCARS ' + s.scars + '   WARPS ' + s.warps.length : null, 'dim']], false);
        }
        function renderDisc() {
            ctx.setTransform(d, 0, 0, d, 0, 0);
            under.clear(); over.clear();
            art(g => g.drawImage(discBg, 0, 0));
            const bx = DX - DR - 8 + s.sweep * (2 * DR + 16), lit = s.phase === 'closing' ? 0.5 : 0.3;   // the light's sweep, reading: a soft band of light moving across the gold
            for (let ax = Math.ceil((bx - SWEEP_HALF + 0.5) * d); ax <= (bx + SWEEP_HALF + 0.5) * d; ax++) {
                const x = (ax + 0.5) / d - 0.5, half = Math.sqrt(Math.max(0, DR * DR - (x - DX) * (x - DX)));
                if (half <= 0) continue;
                const band = lit * Math.exp(-(((x - bx) / (SWEEP_HALF * 0.45)) ** 2)) * window.MiniPaint.smooth(0, 16, half), base = 0.16 + 0.34 * Math.pow(MiniLab.clamp(0.5 + 0.5 * (x - DX) / DR, 0, 1), 1.7);
                if (band < 0.03) continue;
                for (let ay = A(DY - half); ay <= A(DY + half); ay++) {   // brighter steps of the disc's own gold, never a flat colour: it only ever lifts the metal
                    const y = (ay + 0.5) / d - 0.5, edge = window.MiniPaint.smooth(0, 6, half - Math.abs(y - DY)), k = window.MiniPaint.level(R.GOLD, base + band * edge, ax, ay);
                    if (k > window.MiniPaint.level(R.GOLD, base, ax, ay)) under.set(ax, ay, R.GOLD.hex[k]);
                }
            }
            const glint = x => (Math.abs(x - bx) < 1.5 ? C.star : C.light);
            LINES.forEach((l, j) => {
                const ex = DX + l.ux * l.len, ey = DY + l.uy * l.len, t = s.cutT[j], col = t !== null ? C.light : C.lightHalo;
                if (t !== null && clock - t > 0.35) return under.line(A(DX), A(DY), A(ex), A(ey), CUT_LINE, 0.6);   // cut: a dead line, nothing to read
                under.line(A(DX), A(DY), A(ex), A(ey), col);         // just cut, it flashes
                [-4, -3, 3, 4].forEach(o => under.set(A(DX + l.ux * l.notch - l.uy * o), A(DY + l.uy * l.notch + l.ux * o), col));
                if (t === null) for (let dd = 0; dd <= l.len; dd += 0.5 / d) { const x = DX + l.ux * dd; if (Math.abs(x - bx) < 4) under.set(A(x), A(DY + l.uy * dd), glint(x)); }
            });
            FIG_PX.forEach(p => udot(under, p.x, p.y, Math.abs(p.x - bx) < 4 ? glint(p.x) : C.lightHalo));
            if (!s.centre) { udot(under, DX, DY, C.light); PLUS.forEach(([ox, oy]) => under.set(A(DX) + ox * 2, A(DY) + oy * 2, C.lightHalo)); }
            if (s.phase === 'cut') for (let k = 0, m = Math.floor(clock * 6); k < 360; k++) if ((Math.floor(k * 240 / 360) + m) % 7 < 3) {   // the suit marks where a cut counts
                const a = (k / 360) * Math.PI * 2;
                under.set(A(DX + Math.cos(a) * CUT_FAR), A(DY + Math.sin(a) * CUT_FAR), C.ui);
            }
            drawFlameLight(under); drawBurns(under, false);
            drawSparks(over); drawTorch(over);
            art(g => { under.draw(g); over.draw(g); });
            drawTipLabel();
            const n = s.cutT.filter(v => v !== null).length;
            readout([fuelRow(), heatRow(), ['lines', 'LINES ' + String(n).padStart(2, '0') + '/14', n === 14 || growing() ? 'ui' : 'text'],
                ['centre', 'CENTRE ' + (s.centre ? 'CUT' : '--'), s.centre ? 'ui' : 'text']], true);
        }

        // ── input ──
        const cv = ui.canvas, toAim = e => { const p = ui.toPixel(e); return { x: p.x - 0.5, y: p.y - 0.5 }; };
        cv.onpointerdown = e => {
            if (e.button > 0) return;
            aim = toAim(e);
            if (canSteer()) { s.tip = clampTip(aim.x, aim.y); ptrFire = true; s.burst = BURST; }
            try { cv.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointers cannot be captured */ }
        };
        cv.onpointermove = e => { aim = toAim(e); };
        cv.onpointerup = cv.onpointercancel = () => { ptrFire = false; };
        MiniLab.onKey((k, e) => {
            const onButton = !!(e && e.target && e.target.tagName === 'BUTTON');   // a focused button answers Enter itself
            if (DIRS[k]) { if ((!e || !e.repeat) && canSteer()) { aim = null; step(DIRS[k][0], DIRS[k][1], 1); } }   // a tap nudges; held keys glide in moveTip
            else if (k === ' ' && canSteer()) s.burst = BURST;
            else if (k === 'Enter' && !onButton) { if (s.phase === 'end') done(); else newTank(); }
        });

        const syncCursor = () => {                               // while you hold the torch, the drawn torch is the pointer; otherwise the normal arrow
            const want = s && canSteer() ? 'none' : 'default';
            if (cv.style.cursor !== want) cv.style.cursor = want;
        };
        const render = setup.mode === 'hatch' ? renderHatch : renderDisc;
        MiniLab.loop(dt => { clock += dt; update(dt); render(); syncCursor(); }, FPS);
        start(setup.mode);
        render(); syncCursor();
        return () => { cv.style.cursor = ''; snd.drop(); };
    }

    MiniHost.register({
        id: 'torch', kicker: 'EVA', title: 'The cutting torch',
        density: DENSITY,                                        // 720 × 405 art pixels: the travel view's grain
        mount,
        autoResult(opts) {                                       // TEST_MODE: the crew member cut it
            return readOpts(opts).mode === 'disc'
                ? { destroyed: true, figuresScorched: false, fuelLeft: 0.5, tanks: 1 }
                : { opened: true, fuelLeft: 0.5, scars: 0, warps: 0, tanks: 1, bySelf: false };
        },
    });
})();
