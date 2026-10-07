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

   const result = await MiniHost.play('torch', opts)
   opts: { mode: 'hatch' | 'disc'  (default 'hatch')
           hull: 'EXODUS-6'         named in the first line; the game's getWreckName() ('EXODUS-4 "LAZARUS"') is fine, the number is painted
           sector: 1..6             how long the wreck has been dead (docs/CANON.md §2); deadFor: 'twenty years' overrides it
           cutter: 'Jaxon'          coaches the cut and can take the torch; pass a living crew member ('Vance' if Jaxon is dead);
                                    a full crew name ('Eng. Jaxon') is shortened to its last word
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
    const shortName = (v, fallback) => named(v, fallback).split(' ').pop();   // 'Eng. Jaxon' → 'Jaxon', as the mission log shortens names
    function readOpts(opts) {
        const o = opts || {}, sector = MiniLab.clamp(Math.round(Number(o.sector) || 1), 1, DEAD_FOR.length);
        return { mode: o.mode === 'disc' ? 'disc' : 'hatch', hull: named(o.hull, 'EXODUS-6'), deadFor: named(o.deadFor, DEAD_FOR[sector - 1]),
            cutter: shortName(o.cutter, 'Jaxon'), spotter: shortName(o.spotter, 'Vance') };
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

    // ── the pictures, painted once per palette ──
    const hash = (a, b) => { const h = Math.imul(a, 374761393) + Math.imul(b, 668265263) | 0, k = Math.imul(h ^ (h >>> 13), 1274126177); return ((k ^ (k >>> 16)) >>> 0) / 4294967296; };
    function paint(fn) { const c = document.createElement('canvas'); c.width = W; c.height = H; fn(c.getContext('2d')); return c; }
    function eachPixel(fn, x0 = 0, y0 = 0, x1 = W - 1, y1 = H - 1) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) fn(x, y); }
    function paintWorn(b, str, x, y, scale, color, keep) {      // old paint: the pixel font with flakes missing
        const g = Object.assign(document.createElement('canvas'), { width: W, height: 5 * scale }).getContext('2d', { willReadFrequently: true });
        MiniLab.text(g, str, 0, 0, '#fff', scale);
        const data = g.getImageData(0, 0, W, 5 * scale).data;
        b.fillStyle = color;
        for (let py = 0; py < 5 * scale; py++) for (let px = 0; px < MiniLab.textWidth(str, scale); px++) if (data[(py * W + px) * 4 + 3] && hash(px, py + 50) <= keep) b.fillRect(x + px, y + py, 1, 1);
    }
    const isRivet = (x, y, row) => Math.abs(sdf(x, y)) > 4 && (
        ([0, 1].some(k => Math.abs(y - edgeY(k, x)) === 4) && x % 9 === 4) || (JOINTS[row].some(j => Math.abs(x - j) === 4) && y % 9 === 4));
    function hullTone(x, y) {                                    // 0..1 on the hull ramp, or -1 above its edge (space)
        const top = horizon(x);
        if (y < top) return -1;
        if (y === top) return 0.7;                               // its edge, lit by the sky
        const row = rowOf(x, y), joints = JOINTS[row], left = joints.filter(j => x > j).length;
        const ptop = row === 0 ? top : edgeY(row - 1, x), pbot = row < 2 ? edgeY(row, x) : H, fy = (y - ptop) / Math.max(1, pbot - ptop);
        const lamp = Math.max(0, 1 - Math.hypot(x - 318, (y - 128) * 1.15) / 235), sky = Math.exp(-(y - top) / 15);   // our work lamp on the hatch; the sky's cool sheen
        const band = x * 0.45 + y - 236, sheen = 0.12 * Math.exp(-((band / 30) ** 2)) + 0.08 * Math.exp(-(((band - 46) / 5) ** 2));   // the nebula, reflected across the plates
        const g = 0.12 + 0.36 * lamp * lamp + 0.32 * sky + sheen + (hash(row, left) - 0.5) * 0.08 + (hash(y, Math.floor(x / 23)) - 0.5) * 0.025 + 0.07 * (0.5 - fy) - 0.06 * (y / H);
        if ([0, 1].some(k => y === edgeY(k, x)) || joints.includes(x)) return 0.03;   // plate joints
        if ([0, 1].some(k => y === edgeY(k, x) + 1) || joints.includes(x - 1)) return g + 0.09;   // and their lit lip
        return isRivet(x, y, row) ? 0.6 + 0.2 * lamp : isRivet(x - 1, y - 1, row) ? 0.04 : g;   // rivets and their shadows
    }
    function hatchTone(x, y, g) {                                // the door inside the seam: its lip, a pressed panel, the handle recess, four bolts
        const d = sdf(x, y);
        if (d > 0.5) return g;
        if (d >= -0.5) return 0.02;
        if (d >= -1.6) return g + 0.1;
        if (Math.abs(d + 8) < 0.5) return 0.05;
        if (Math.abs(d + 9) < 0.5) return g + 0.07;
        const hx = x - (HB.cx + HB.hw - 22), hy = y - (HB.cy - 3), bx = Math.abs(x - HB.cx) - (HB.hw - 14), by = Math.abs(y - HB.cy) - (HB.hh - 14);
        if (hx >= 0 && hx <= 10 && hy >= 0 && hy <= 6) return hy === 6 ? 0.44 : hx === 0 || hx === 10 || hy === 0 ? 0.04 : 0.12;
        if (bx >= 0 && bx <= 1 && by >= 0 && by <= 1) return bx + by === 0 ? 0.62 : 0.4;
        return g - (d < -9 ? 0.02 : 0);
    }
    const NAME_ROOM = 240;                                       // the wreck's name fits between the left edge and the hatch
    const hullNumber = hull => hull.split('"')[0].trim() || hull;   // 'EXODUS-4 "LAZARUS"' is painted as EXODUS-4, as on the sketch
    function paintHull(b, hull) {
        b.fillStyle = C.void; b.fillRect(0, 0, W, H);
        MiniLab.nebula(b, 6, 0.45); MiniLab.stars(b, 61, 150);
        MiniLab.disc(b, FAR_LIGHT.x, FAR_LIGHT.y, 6, d => 0.35 * (1 - d), C.lightHalo);
        const rnd = MiniLab.rng(6), pits = new Set(Array.from({ length: 320 }, () => Math.floor(rnd() * W * H))), lit = C.hull.map(c => MiniLab.mix(c, C.warm, 0.16));
        eachPixel((x, y) => {
            const g = hullTone(x, y), lamp = Math.max(0, 1 - Math.hypot(x - 318, (y - 128) * 1.15) / 150);
            if (g < 0) return;                                   // where our own lamp falls the metal is a little warmer; pits from micrometeorites
            b.fillStyle = MiniLab.pick(MiniLab.on(x, y, 0.7 * lamp * lamp) ? lit : C.hull, hatchTone(x, y, g - (pits.has(y * W + x) ? 0.08 : 0)), x, y); b.fillRect(x, y, 1, 1);
        });
        [[70, 168, 196, 150], [372, 236, 468, 222], [150, 66, 236, 58]].forEach(([x0, y0, x1, y1]) => MiniLab.line(b, x0, y0, x1, y1, C.hull[3], 0.45));   // old scrapes
        [[118, 236], [428, 96], [214, 74]].forEach(([x, y]) => { MiniLab.ring(b, x, y, 2, C.hull[4], 0.6); MiniLab.dot(b, x + 1, y + 1, C.hull[0]); MiniLab.dot(b, x, y, C.hull[0]); });   // small craters
        const name = hullNumber(hull), scale = [4, 3, 2].find(k => MiniLab.textWidth(name, k) <= NAME_ROOM) || 1;
        paintWorn(b, name, 30, 92, scale, MiniLab.mix(C.textDim, C.hull[2], 0.3), 0.8);
        paintWorn(b, 'RESCUE', HB.cx - Math.round(MiniLab.textWidth('RESCUE') / 2), HB.cy - HB.hh - 10, 1, MiniLab.mix(C.warm, C.hull[2], 0.4), 1);
        MiniLab.dot(b, FAR_LIGHT.x, FAR_LIGHT.y, C.light); PLUS.forEach(([ox, oy]) => MiniLab.dot(b, FAR_LIGHT.x + ox, FAR_LIGHT.y + oy, C.lightHalo));
    }
    function paintHole(b) {                                      // behind the hatch: a dead corridor, lit only by our lamp
        eachPixel((x, y) => {
            const d = sdf(x, y), qx = Math.abs(x - VP.x) / HB.hw, qy = Math.abs(y - VP.y) / HB.hh, q = Math.max(qx, qy);   // q: 1 at the hole, 0 far away
            if (d > 0.5) return;
            let g = -1;
            if (d > -4) g = (x - HB.cx) / HB.hw + (y - HB.cy) / HB.hh > 0.2 ? 0.22 + 0.14 * (d + 4) / 4.5 : 0.03;   // the plate's cut edge
            else if (q > 0.3) {
                g = 0.02 + 0.24 * ((q - 0.3) / 0.7) ** 2 + (qx > qy ? 0 : y > VP.y ? 0.05 : -0.03);   // walls fade into the dark; the floor a little lit
                if ([0.42, 0.56, 0.76].some(r => Math.abs(q - r) < 0.011)) g -= 0.05;   // the corridor's ribs
                else if (Math.abs(qx - qy) < 0.014) g += 0.05;  // its corners catch the light
            }
            b.fillStyle = g < 0 ? C.void : MiniLab.pick(C.hull, g, x, y); b.fillRect(x, y, 1, 1);
        }, ...HATCH_BOX);
    }
    const paintLid = hullBg => b => {                            // the cut-out door, to drift away: a mask of the door, then the hull drawn into it
        b.fillStyle = '#000'; eachPixel((x, y) => { if (sdf(x, y) <= -0.5) b.fillRect(x, y, 1, 1); }, ...HATCH_BOX);
        b.globalCompositeOperation = 'source-in'; b.drawImage(hullBg, 0, 0);
    };
    const paintLidShadow = b => { b.fillStyle = C.void; eachPixel((x, y) => { if (sdf(x, y) <= -0.5 && MiniLab.on(x, y, 0.6)) b.fillRect(x, y, 1, 1); }, ...HATCH_BOX); };
    function paintDiscScene(b) {
        b.fillStyle = C.void; b.fillRect(0, 0, W, H);
        MiniLab.nebula(b, 1977, 0.3); MiniLab.stars(b, 14, 120);
        const edge = SUN.r / (SUN.r + 16);                       // the light the disc is drifting into
        MiniLab.disc(b, SUN.x, SUN.y, SUN.halo, d => 0.45 * Math.pow(1 - d, 2.6), C.lightHalo);
        MiniLab.disc(b, SUN.x, SUN.y, SUN.r + 64, d => 0.7 * Math.pow(1 - d, 1.6), C.light);
        MiniLab.disc(b, SUN.x, SUN.y, SUN.r + 16, d => (d < edge ? 1 : (1 - d) / (1 - edge)), C.light);
        const GOLD = [C.void, MiniLab.mix(C.lightHalo, C.void, 0.84), MiniLab.mix(C.lightHalo, C.void, 0.66), MiniLab.mix(C.lightHalo, C.void, 0.42), C.lightHalo, C.light];
        eachPixel((x, y) => {
            const r = Math.hypot(x - DX, y - DY), lit = MiniLab.clamp(0.5 + 0.5 * (x - DX) / DR, 0, 1), a = Math.atan2(y - DY, x - DX);
            if (r > DR + 0.5) return;
            let g = 0.18 + 0.32 * Math.pow(lit, 1.7) + 0.18 * Math.pow(Math.abs(Math.cos(a + 0.35)), 16);   // lit from the right; a pressed disc catches light in two wedges
            if (r > 26 && r < DR - 4 && Math.round(r) % 3 === 0) g += 0.06;   // grooves
            if (r > 24 && r <= 26) g -= 0.07;                    // the label's edge
            if (r > DR - 2.5) g = 0.48 + 0.42 * lit;             // the rim, bright on the side facing the light
            b.fillStyle = MiniLab.pick(GOLD, g, x, y); b.fillRect(x, y, 1, 1);
        }, DX - DR - 1, DY - DR - 1, DX + DR + 1, DY + DR + 1);
        MiniLab.ring(b, DX, DY, DR + 1, C.lightHalo, 0.25);
        LINES.forEach(l => { const o = l.uy > 0 ? -1 : 1; MiniLab.line(b, DX + l.uy * o, DY - l.ux * o, DX + l.ux * l.len + l.uy * o, DY + l.uy * l.len - l.ux * o, GOLD[1]); });   // each line's engraved shadow
    }
    function paintScene(o) {                                     // only the pictures this part needs
        if (o.mode === 'disc') return { discBg: paint(paintDiscScene) };
        const hullBg = paint(b => paintHull(b, o.hull));
        return { hullBg, hole: paint(paintHole), lid: paint(paintLid(hullBg)), lidShadow: paint(paintLidShadow) };
    }

    function mount(ctx, ui, opts) {
        const HEATING = [C.hurt[2], C.hurt[3], C.danger, C.warm, C.warmBright], GLOW = [C.hurt[2], C.hurt[3], C.warm, C.warmBright];   // metal under the flame: dull → red → orange; the plate heating
        const KERF = [C.void, C.hurt[2], C.hurt[3], C.danger, C.warm, C.warmBright, C.star];   // a cut: white-hot while the flame is on it, then cooling to a dark slot
        const TEMPER = MiniLab.mix(C.warm, C.hull[2], 0.45), CUT_LINE = MiniLab.mix(C.lightHalo, C.void, 0.62), DIM_GOLD = MiniLab.mix(C.lightHalo, C.void, 0.55);
        const SCORCH = MiniLab.mix(C.warm, C.hull[1], 0.62), HOSE = [MiniLab.mix(C.warm, C.void, 0.74), MiniLab.mix(C.warm, C.void, 0.5)];   // a cut's tempered edge; the suit's hose
        const setup = readOpts(opts), SAY = sayLines(setup), snd = makeSound();
        const { hullBg, hole, lid, lidShadow, discBg } = paintScene(setup);
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

        // ── drawing ──
        function markColor(i, x, y) {                            // the metal's heat, read at a glance
            const d = s.depth[i], age = clock - s.lastT[i];
            if (d >= 1) return MiniLab.pick(KERF, Math.exp(-age / KERF_COOL), x, y);   // cut through: white while the flame is on it, then warm, red, a dark slot
            if (s.part === 'hatch' && !NEAR_SEAM[i]) return d > 0.12 && MiniLab.on(x, y, 0.2 + 0.5 * d) ? SCORCH : null;   // thick plate: a faint scorch, no glow
            const glow = d * Math.exp(-age / HEAT_SHOW);
            if (glow > 0.08) return MiniLab.pick(HEATING, glow, x, y);   // heating: dull, red, orange; it fades if the flame moves on too soon
            if (d <= 0.3) return null;
            return s.part === 'hatch' ? (MiniLab.on(x, y, 0.5) ? SCORCH : C.hull[1]) : CUT_LINE;   // where it never went through: a scorch, the cut's tempered edge
        }
        function drawBurns(opened) {                             // warps, the plate's glow, the kerf
            const disc = s.part === 'disc';
            s.warps.forEach(w => {                               // a buckled dimple, tempered warm inside and cool outside
                MiniLab.ring(ctx, w.x, w.y, 3, disc ? DIM_GOLD : TEMPER, 0.55); MiniLab.ring(ctx, w.x, w.y, 5, disc ? DIM_GOLD : C.mist, 0.4);
                MiniLab.dot(ctx, w.x - 1, w.y - 1, disc ? C.lightHalo : C.hull[4]); MiniLab.dot(ctx, w.x + 1, w.y + 1, C.void);
            });
            for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
                const v = s.heat[gy * GW + gx], x0 = gx * CELL, y0 = gy * CELL, density = Math.min(1, (v - 0.18) * 1.4), tone = MiniLab.clamp((v - 0.18) / 0.82, 0, 1);
                if (v < 0.18 || (opened && sdf(x0 + 1, y0 + 1) <= 0.5)) continue;
                for (let y = y0; y < y0 + CELL; y++) for (let x = x0; x < x0 + CELL; x++) if (MiniLab.on(x, y, density)) { ctx.fillStyle = MiniLab.pick(GLOW, tone, x, y); ctx.fillRect(x, y, 1, 1); }
            }
            s.marks.forEach(i => {
                const x = i % W, y = (i - x) / W, col = opened && sdf(x, y) <= 0.5 ? null : markColor(i, x, y);
                if (col) { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); }
            });
        }
        function drawSparks() {
            s.sparks.forEach(p => {
                if (p.dust) return MiniLab.dot(ctx, p.x, p.y, p.life > 0.9 ? C.textDim : C.mist);
                const k = p.ice ? 0.03 : 0.025;                  // a short streak behind each
                if (p.ice || p.life > 0.25) MiniLab.dot(ctx, p.x - p.vx * k, p.y - p.vy * k, p.ice ? C.uiDim : C.warm);
                MiniLab.dot(ctx, p.x, p.y, p.ice ? (p.life > 0.7 ? C.star : C.uiBright) : p.life > 0.3 ? C.warmBright : p.life > 0.12 ? C.warm : C.hurt[3]);
            });
        }
        function reticle(x, y) {                                 // the aim, and the pointer: four short ticks, outlined so they stand out on gold and bright plate
            const col = s.phase === 'cut' && paused() ? (Math.floor(clock * 4) % 2 ? C.danger : C.hurt[3]) : C.ui;
            PLUS.forEach(([ox, oy]) => [4, 5, 6].forEach(k => {
                MiniLab.dot(ctx, x + ox * k + oy, y + oy * k + ox, C.void); MiniLab.dot(ctx, x + ox * k - oy, y + oy * k - ox, C.void); MiniLab.dot(ctx, x + ox * k, y + oy * k, col);
            }));
            if (!s.firing) { PLUS.forEach(([ox, oy]) => MiniLab.dot(ctx, x + ox, y + oy, C.void)); MiniLab.dot(ctx, x, y, C.uiBright); }   // the exact point the flame will touch
        }
        function drawFlameLight() {                              // under the burns: the flame lights the metal round it, more as the metal glows
            if (!s.firing) return;
            MiniLab.disc(ctx, Math.round(s.tip.x), Math.round(s.tip.y), 15, d => (0.1 + 0.2 * s.glow) * (1 - d) * (1 - d), C.warm);
        }
        function drawTorch() {                                   // nozzle, body and hose, held just off the metal; when the job is done it is pulled back
            const away = s.phase === 'cut' || s.phase === 'dry' ? 0 : 300 * Math.min(1, s.openT / 0.6) ** 2;
            const x = Math.round(s.tip.x + TU.x * away), y = Math.round(s.tip.y + TU.y * away), at = (k, o = 0) => [x + TU.x * (k + STANDOFF) + TN.x * o, y + TU.y * (k + STANDOFF) + TN.y * o];
            const [hx, hy] = at(29), mx = hx + 14, my = hy + 24, ex = hx + 30, ey = H + 8;   // the hose sags off the bottom of the picture
            for (let t = 0; t <= 1; t += 0.006) {
                const u = 1 - t, px = u * u * hx + 2 * u * t * mx + t * t * ex, py = u * u * hy + 2 * u * t * my + t * t * ey;
                MiniLab.dot(ctx, px - 1, py + 1, C.void); MiniLab.dot(ctx, px, py, HOSE[0]); MiniLab.dot(ctx, px + 1, py, HOSE[1]);
            }
            [1, 0].forEach(edge => { for (let k = 0; k <= 29; k += 0.5) for (let o = -3.5; o <= 3.5; o += 0.5) {   // a dark outline, then the body: lit along one side, a ribbed grip
                const r = k < 7 ? 0.9 : k < 9 ? 1.6 : 2.5;
                if (Math.abs(o) > r + edge) continue;
                const g = 0.3 + 0.42 * o / r + (o / r > 0.4 && o / r < 0.8 ? 0.16 : 0) + (k < 2 ? 0.25 : 0) + (k > 18 && Math.floor(k) % 3 === 0 ? -0.16 : 0) + (k > 9.5 && k < 11 ? 0.2 : 0);
                MiniLab.dot(ctx, ...at(k, o), edge ? C.void : MiniLab.pick(C.hull, g, Math.round(k), Math.round(o)));
            } });
            MiniLab.dot(ctx, ...at(14, 2), s.phase === 'cut' && paused() ? C.danger : s.firing ? C.uiBright : C.uiDim);   // the ready light
            if (away > 0) return;
            if (s.firing) for (let k = 1; k <= STANDOFF; k += 0.5) MiniLab.dot(ctx, x + TU.x * k, y + TU.y * k, k < 2 ? C.star : C.uiBright);   // the flame: a thin blue-white jet; the metal shows its own heat
            reticle(x, y);
        }
        const growing = () => clock - s.progT < READOUT_FOR;
        function tipLabel() {                                    // one short readout by the torch, or none: what is wrong, what to do, how far
            if (!canSteer()) return null;
            if (paused()) return Math.floor(clock * 3) % 3 ? [['COOLING'], C.danger] : null;
            if (s.firing && s.strayT >= STRAY_AFTER) return [['OFF THE LINE'], C.text];
            if (!taught[s.part]) { const hints = HINTS[s.part]; return [hints[Math.min(hints.length - 1, s.cut > 0 ? 1 : 0)], C.uiBright]; }
            if (s.firing && s.fastT > FAST_AFTER) return [['SLOW DOWN'], C.warmBright];
            if (s.firing && s.idleT > IDLE_AFTER) return [['MOVE ON'], C.warmBright];
            if (growing()) return [[s.part === 'hatch' ? seamPercent() + '%' : s.progText], C.uiBright];
            return null;
        }
        function drawTipLabel() {                                // up and to the left of the tip: clear of the torch, and of the seam running through the tip
            const label = tipLabel();
            if (!label) return;
            const [lines, col] = label, sc = LABEL_SCALE, lh = 6 * sc, w = Math.max(...lines.map(l => MiniLab.textWidth(l, sc))), h = lines.length * lh - sc;
            const x = Math.round(s.tip.x), y = Math.round(s.tip.y);
            const lx = MiniLab.clamp(x - LABEL_GAP - w < 3 ? x + LABEL_GAP : x - LABEL_GAP - w, 3, W - 3 - w), ly = MiniLab.clamp(y - LABEL_GAP - h < 3 ? y + LABEL_GAP : y - LABEL_GAP - h, 3, H - 3 - h);
            MiniLab.shade(ctx, lx - 3, ly - 3, w + 6, h + 6, 0.85, C.void);
            lines.forEach((l, k) => MiniLab.text(ctx, l, lx, ly + k * lh, col, sc));
        }
        const seamPercent = () => Math.min(100, Math.floor((100 * s.cut) / (SEAM.length * TEAR)));   // the hatch tears free at TEAR: that is 100%
        function bar(x, y, label, v, col, note) {
            MiniLab.text(ctx, label, x, y, C.textDim, 2);
            MiniLab.shade(ctx, x + 38, y + 2, 66, 6, 0.3, C.uiDim);
            if (v > 0) MiniLab.shade(ctx, x + 38, y + 2, Math.max(1, Math.round(66 * Math.min(1, v))), 6, 1, col);
            if (note) MiniLab.text(ctx, note, x + 110, y, col, 2);
        }
        function hud(x, y, rows) {                               // fuel and heat, then this part's own rows: [label or text, value, colour, scale, note after a bar]
            const h = heatAt(s.tip), wide = rows.some(r => r[4]);
            MiniLab.shade(ctx, x - 6, y - 6, wide ? 148 : 116, 48 + rows.length * 14, 0.82, C.void);
            bar(x, y, 'FUEL', s.fuel, s.fuel < 0.2 ? C.danger : C.ui);
            bar(x, y + 14, 'HEAT', h, h >= WARN ? C.danger : h > 0.5 ? C.warm : C.ui);
            rows.forEach(([label, v, col, scale, note], k) => (v === null ? MiniLab.text(ctx, label, x, y + 29 + k * 14, col, scale) : bar(x, y + 28 + k * 14, label, v, col, note)));
            if (s.phase === 'cut' && paused() && Math.floor(clock * 3) % 2) MiniLab.text(ctx, 'COOLING', x, y + 30 + rows.length * 14, C.danger, 2);
        }
        function drawSeamGuide(f) {                              // the suit marks what is still to cut, in its own cool colour; near the end it blinks
            const march = Math.floor(clock * 6), blink = f >= 0.85 && Math.floor(clock * 3) % 2, col = C.ui;
            SEAM.forEach((i, k) => {
                const x = i % W, y = (i - x) / W;
                if (s.seamCut[k]) return;
                if (blink) { PLUS.forEach(([ox, oy]) => MiniLab.dot(ctx, x + ox, y + oy, C.ui)); MiniLab.dot(ctx, x, y, C.uiBright); } else if ((x + y + march) % 6 < 3) MiniLab.dot(ctx, x, y, col);
            });
        }
        function drawLid(t) {                                    // it pops, hangs, knocks the rim, then drifts out towards us
            const p = Math.sin(Math.min(1, t / 0.18) * Math.PI / 2), u = Math.max(0, t - 0.18), v = Math.max(0, t - THUD_AT);
            const k = 1 + 0.05 * p + 0.012 * u + 0.07 * v, lift = Math.round(2 + 30 * (k - 1));
            ctx.save(); ctx.imageSmoothingEnabled = false;
            ctx.translate(Math.round(HB.cx + 4 * p + 4 * u + 10 * v + 3 * v * v), Math.round(HB.cy - 3 * p - 1.5 * u - 4 * v));
            ctx.rotate(0.012 * u + 0.05 * v + 0.03 * Math.min(1, v * 6)); ctx.scale(k, k);
            ctx.drawImage(lidShadow, -HB.cx + lift, -HB.cy + lift); ctx.drawImage(lid, -HB.cx, -HB.cy);   // lifting off, it casts a shadow
            ctx.restore();
        }
        function drawGlint() {                                   // one glint on the corridor floor: our lamp, caught by something
            const ph = (clock * 0.6) % 1, arm = ph < 0.08 ? 3 : ph < 0.2 ? 2 : ph < 0.3 ? 1 : 0;
            MiniLab.dot(ctx, GLINT.x, GLINT.y, arm ? C.star : C.warm);
            for (let k = 1; k <= arm; k++) PLUS.forEach(([ox, oy]) => MiniLab.dot(ctx, GLINT.x + ox * k, GLINT.y + oy * k, k === 1 ? C.warmBright : C.warm));
        }
        function renderHatch() {
            const opened = s.phase === 'open' || s.phase === 'end', f = opened ? 1 : s.cut / SEAM.length;
            const jolt = opened && s.openT < 0.45 ? Math.round(2.4 * (1 - s.openT / 0.45)) : 0;   // the crack shakes the picture, then settles
            ctx.fillStyle = C.void; ctx.fillRect(0, 0, W, H);
            ctx.setTransform(1, 0, 0, 1, jolt * (Math.random() < 0.5 ? -1 : 1), jolt * (Math.random() < 0.5 ? -1 : 1));
            ctx.drawImage(hullBg, 0, 0);
            if (opened) { ctx.drawImage(hole, 0, 0); if (s.openT > 2.6) drawGlint(); }
            if (opened && s.openT < 0.4) SEAM.forEach(i => {      // the last air flashing out of the seam as ice
                const x = i % W, y = (i - x) / W, k = 1 - s.openT / 0.4;
                MiniLab.shade(ctx, x - 1, y - 1, 3, 3, 0.45 * k, C.uiBright); MiniLab.shade(ctx, x, y, 1, 1, k, C.star);
            });
            drawFlameLight(); drawBurns(opened);
            if (!opened) drawSeamGuide(f);
            if (opened && s.openT < 10) drawLid(s.openT);
            drawSparks(); drawTorch();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            drawTipLabel();
            const pct = opened ? 100 : seamPercent();             // the readout moves as the seam frees, and flashes while it does
            hud(12, 198, [['SEAM', pct / 100, pct >= 100 || growing() ? C.uiBright : C.text, null, pct + '%'], ['SCARS ' + s.scars + '   WARPS ' + s.warps.length, null, C.textDim, 1]]);
        }
        function renderDisc() {
            ctx.drawImage(discBg, 0, 0);
            const bx = DX - DR - 8 + s.sweep * (2 * DR + 16), lit = s.phase === 'closing' ? 0.55 : 0.32;   // the light's sweep, reading
            for (let x = Math.ceil(bx - 7); x <= bx + 7; x++) {
                const half = Math.sqrt(Math.max(0, DR * DR - (x - DX) * (x - DX)));
                if (half > 0) MiniLab.shade(ctx, x, DY - half, 1, half * 2, lit * (1 - Math.abs(x - bx) / 7), C.light);
            }
            const glint = x => (Math.abs(x - bx) < 1.5 ? C.star : C.light);
            LINES.forEach((l, j) => {
                const ex = DX + l.ux * l.len, ey = DY + l.uy * l.len, t = s.cutT[j], col = t !== null ? C.light : C.lightHalo;
                if (t !== null && clock - t > 0.35) return MiniLab.line(ctx, DX, DY, ex, ey, CUT_LINE, 0.6);   // cut: a dead line, nothing to read
                MiniLab.line(ctx, DX, DY, ex, ey, col);              // just cut, it flashes
                [-4, -3, 3, 4].forEach(o => MiniLab.dot(ctx, DX + l.ux * l.notch - l.uy * o, DY + l.uy * l.notch + l.ux * o, col));
                if (t === null) for (let d = 0; d <= l.len; d += 0.5) { const x = DX + l.ux * d; if (Math.abs(x - bx) < 4) MiniLab.dot(ctx, x, DY + l.uy * d, glint(x)); }
            });
            FIG_PX.forEach(p => MiniLab.dot(ctx, p.x, p.y, Math.abs(p.x - bx) < 4 ? glint(p.x) : C.lightHalo));
            if (!s.centre) { MiniLab.dot(ctx, DX, DY, C.light); PLUS.forEach(([ox, oy]) => MiniLab.dot(ctx, DX + ox, DY + oy, C.lightHalo)); }
            if (s.phase === 'cut') for (let k = 0, m = Math.floor(clock * 6); k < 240; k++) if ((k + m) % 7 < 3) {   // the suit marks where a cut counts
                const a = (k / 240) * Math.PI * 2;
                MiniLab.dot(ctx, DX + Math.cos(a) * CUT_FAR, DY + Math.sin(a) * CUT_FAR, C.ui);
            }
            drawFlameLight(); drawBurns(false); drawSparks(); drawTorch(); drawTipLabel();
            const n = s.cutT.filter(v => v !== null).length;
            hud(12, 12, [['LINES ' + String(n).padStart(2, '0') + '/14', null, n === 14 || growing() ? C.uiBright : C.text, 2], ['CENTRE ' + (s.centre ? 'CUT' : '--'), null, s.centre ? C.uiBright : C.text, 2]]);
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
        mount,
        autoResult(opts) {                                       // TEST_MODE: the crew member cut it
            return readOpts(opts).mode === 'disc'
                ? { destroyed: true, figuresScorched: false, fuelLeft: 0.5, tanks: 1 }
                : { opened: true, fuelLeft: 0.5, scars: 0, warps: 0, tanks: 1, bySelf: false };
        },
    });
})();
