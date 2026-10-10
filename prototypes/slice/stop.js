/* Silent Exodus · sector 1 slice · a stop: the dive, the bridge, orbit actions, the minigames, the films
   (docs/SLICE_SPEC.md §7.3, §8.2, §9).
   OWNER: the stop builder. Draws ONLY into canvas#dive (the push on our hull, the quarter turn, the plating) and canvas#bridge
   (layout D, 640 x 360 art px at G.bk, centred), and the DOM layer #stop-words (the place's name in a corner of the glass, the
   one action word in the glass's sky beside the site, "Leave orbit" under the window, the "good for" line in the pick).
   It is the ONLY file that calls window.MiniHost.play, always through minigame().
   Reuses by loading (never copied, never edited): layouts/variant-d/bridge-art.js (BridgeArt.paint(): the room and its big
   window, its glass sheen), variant-d/crew-sim.js (BridgeCrew.SPOTS: the window spots), CrewEngine (people), ShipArt (deck 1
   under the room, the star tiles beside the hull), V3Paint (the world in the glass: sphere + surfaceFor, drawStation,
   paintGiant, lightGlow, spaceStrip/paintSpace; the dive: hull + shapeL; the film: filmFrame), and the real minigames.

   window.Slice.mods.stop = {
     init()                      once: BridgeArt.paint(), the words, the bus wiring, the idle bake queue
     resize(G)                   canvas#dive like canvas#world; canvas#bridge 640 x 360 at G.bk, centred (G.bLeft, G.bTop)
     update(dt, t)               the dive's clock (it emits dive:plated, stop:shown, stop:hidden on time), the bake queue
     render(t)                   canvas#dive while diving, canvas#bridge while stopped; nothing otherwise (both hidden)
     pointer(type, e, cx, cy)    while Slice.state.mode is 'dive-in' | 'stop' | 'dive-out'; CSS px; true if it used it
     goto(moment)                show the bridge at a MOCKUP moment's phase; it syncs again from Slice.state on 'mockup:goto'
     isOpen()                    → true while the dive or the bridge is on screen
     discs()                     → [[x, y, r], ...] CSS px: the world in the glass and the people on the bridge (script.js keeps words off them)
     bands()                     → { top: { y, h }, bottom: { y, h } } CSS px: the film's black bands, for reading.playScene
     minigame(id, opts)          → Promise<result>: MiniHost.play with Slice.state.hold up while it is open
   }
   Emits:   'dive:plated' { dir }  'stop:shown' { id }  'stop:pick' { ids }  'stop:act' { id, verb, label }  'stop:leave' { id }
            'stop:hidden' { id }   'minigame:start' { id }  'minigame:end' { id, result }
            'stop:shuttle' { id, at: 'site' | 'ship' } (extra: the shuttle touched down / came home; script may wait on it)
   Listens: 'route:go' { id } (paints ahead)  'dive:start' { id }  'dive:back' { id }  'stop:phase' { id, phase, sign, eligible }  'stop:act' (Kryos: the scoops)
            'mockup:goto' (re-syncs from Slice.state after every module's goto); crew statuses are read every frame
   Reads:   Slice.state (crew statuses, places, stop), world.landerPose(), ship.occupied() / beat(), script.PLACES[id]
            ({ name, verb, team }) and script.goodFor(id) when they exist (falls back to its own, marked STUB below).
   Writes:  Slice.state.stop only: { id, phase, team, aboard }.
   Anchors (Slice.anchors, CSS px, while open): 'stop:person:<id>', 'stop:aura' (the speaker grille), 'stop:glass' (open sky in
            the window), 'stop:radio' (the helm, for the team on the radio), 'stop:site' (beside the site in the glass). */
(function () {
    'use strict';
    const Slice = window.Slice, P = window.V3Paint, A = window.ShipArt, BA = window.BridgeArt, CE = window.CrewEngine;
    const { RP, INK, threshold, smooth, lerp, clamp01, hash, level } = P, L = A.L, B = BA.B, R = A.R;
    const SW = 640, SH = 360, OFFX = -40, F = B.F;                        // layout D's frame, the room's x offset, the floor row
    const WIN = { x0: B.WIN.x0 + OFFX, x1: B.WIN.x1 + OFFX, y0: B.WIN.y0, y1: B.WIN.y1 };   // the glass, in frame px (116..570, 34..236)
    const GW = WIN.x1 - WIN.x0, GH = WIN.y1 - WIN.y0;
    const LIGHT = [515, 92];                                              // the light ahead, where the room's art already warms the frame
    const PUSH = 1000, DISSOLVE = 600, STEPS = 8, ARRIVE = 3600;          // ms: the push (8 steps), the Bayer dissolve, the braking
    const UF = 0.42, BAND = 16;                                           // the hull point the push centres on; bake band (a multiple of 8, ~8 ms)
    const ORBIT = { x: 392, y: 140, r: 87 };                              // in orbit the world is 86 % of the window's height
    const SPOT_X = { jaxon: 214, aris: 254, vance: 290, mira: 326 };      // BridgeCrew.SPOTS wA, w1, w2, w3 (fixed per person)
    const HELM = 360, NAV = 488, HATCH = L.LX, WALK = CE.ACTIONS.walk, CLIMB = CE.ACTIONS.climb;
    const COLOR = { cora: '#9fd8e6', jaxon: '#f0a860', aris: '#e58ac8', vance: '#d8dde0', mira: '#e2c46a' };
    const NAMES = { cora: 'Cora', jaxon: 'Jaxon', aris: 'Aris', vance: 'Vance', mira: 'Mira' };
    const CREW = ['jaxon', 'aris', 'vance', 'mira'];
    const TEAM_PLACES = { zeta: true, titan: true, erebus: true, rhea: true, kryos: false };
    // STUB (script.PLACES / LINES own these words; used only when script.js does not give them)
    const PLACE_NAME = { zeta: 'Platform Zeta', titan: 'Titan-61 IV', kryos: 'Kryos-68 Prime', erebus: 'Erebus-40 Minor', rhea: 'Rhea-4 Minor' };
    const VERB = { zeta: 'Dock', titan: 'Send the team', kryos: 'Skim fuel', erebus: 'Answer the call', rhea: 'Send the team' };
    const GOOD = {
        jaxon: 'Down there he cuts hatches fast. Aboard, he keeps the drive calm.',
        aris: 'Down there she brings the hurt back walking. Aboard, she treats anyone hurt.',
        vance: 'Down there he takes the risk for the other. Aboard, he pulls people clear.',
        mira: 'Down there she reads what is below. Aboard, she brings the star fix home.',
    };
    // the look of each place in the glass (paint.js recipes; seeds from SLICE_SPEC §3.1)
    const LOOK = {
        titan: { kind: 'sphere', type: 'desert', seed: 73, beacon: 'red', furrow: true },
        rhea: { kind: 'sphere', type: 'rock', seed: 52, beacon: 'lamp' },
        erebus: { kind: 'sphere', type: 'dark', seed: 40, beacon: 'distress' },
        zeta: { kind: 'station', seed: 3 },
        kryos: { kind: 'giant' },
    };
    const LW = P.norm3(0.42, -0.36, 0.83);                                // lit from the front, toward the light (the room's warm frame)

    // ── the stop's own state (none of it is story state) ──
    const S = {
        dive: null,        // { dir: 'in' | 'out', t0, id, pose, steps[], plated, done } while the dive runs
        open: false,       // the bridge is on screen (or dissolving)
        id: null, shownAt: -1e9, phase: null, phaseAt: -1e9, sign: null, eligible: null,
        picked: [], plans: {}, hover: null, hot: null, guardUntil: 0,
        shuttle: null,     // { from, to, t0, dur, dir: 'down' | 'up', landed }
        film: null,        // { t0, out: t or null }
        skimAt: -1e9, drawn: [], words: {}, wordsKey: '',
    };
    let room = null, art = null, actx = null, tmp = null, tctx = null, diveC = null, bridgeC = null, dctx = null, bctx = null;
    const queue = [];                                                     // idle bake jobs: pictures painted a band at a time

    // ── baking: a picture painted in bands, a few per idle frame, finished at once if it is needed now ──
    function pic(w, h, bands) {
        const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h);
        const g = c.getContext('2d');
        return { canvas: c, g, jobs: bands.map(fn => () => fn(g)), x: 0, y: 0 };
    }
    function ready(p) { while (p.jobs.length) p.jobs.shift()(); return p; }
    function later(p) { queue.push(p); return p; }
    function bake(budget) {
        const end = performance.now() + budget;
        while (queue.length && performance.now() < end) { const p = queue[0]; if (!p.jobs.length) { queue.shift(); continue; } p.jobs.shift()(); }
    }
    /** Band jobs for a w x h picture: fn(painter, oy) paints into a w x BAND clear painter whose row 0 is picture row oy. */
    function banded(w, h, y0, y1, fn) {
        const out = [];
        for (let oy = Math.max(0, Math.floor(y0 / BAND) * BAND); oy < Math.min(h, y1); oy += BAND) out.push(g => { const p = P.painter(w, BAND, false); fn(p, oy); g.putImageData(new ImageData(p.data, p.W, p.H), 0, oy); });
        return out;
    }

    // ── 1. the dive: our hull pushed on, turned nose-up, its plating filling the screen (V3Paint.hull + shapeL) ──
    const lerpAngle = (a, b, k) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * k; };
    function stepGeom(k, pose) {
        const G = Slice.G, s = k / (STEPS - 1), big = k >= 5, a = big ? 1 : smooth(0, 0.72, s);
        const lenEnd = Math.ceil(3.15 * 1.18 * Math.max(G.W, G.H * 1.2)), len0 = big ? Math.round(0.085 * G.H) : pose.len;
        const len = Math.exp(lerp(Math.log(Math.max(8, len0)), Math.log(lenEnd), Math.pow(s, 1.25)));
        const fx = pose.x + (0.5 - UF) * pose.len * Math.cos(pose.angle), fy = pose.y + (0.5 - UF) * pose.len * Math.sin(pose.angle);
        const cx = big ? G.W / 2 : G.hull + (G.W - G.hull) / 2;          // the small steps turn in the middle of the space side, clear of the tower
        return { x: lerp(fx, cx, a), y: lerp(fy, G.H / 2, a), len, ht: len / 3.15, angle: lerpAngle(pose.angle, -Math.PI / 2, a), flip: true, seed: 9, anchor: UF,
            sun: len < 300 ? 0.24 : 0, sunDir: [0.94, -0.34], fade: len < 300 ? 0.22 : 0.08, flat: len < 130 };
    }
    const atOf = o => (u, v) => { const a = -(u - o.anchor) * o.len, b = v * o.ht, c = Math.cos(o.angle), s = Math.sin(o.angle); return [o.x + a * c - b * s, o.y + a * s + b * c]; };
    /** The dive's last three steps (look playtest, 2026-10-10: the middle frame was a flat pale slab of square tiles that cut the
        tower off, the brightest frame in the game). Now our own hull fills the screen, tower and all: dark plating lit from the
        light's side, rows of plates whose seams do not line up, rivets, a doubler plate round the airlock with its lit port,
        the corners going dark; each step pushes in on the port, and the last is inside its ring, where the bridge dissolves in.
        Unit: the 360-row stage's pixel (sc); z: how far we are pushed in. Painted once per size, in idle bands. */
    const PLATE = { zoom: [1, 3.1, 11], PH: 44, PW: 66, RO: 15, RI: 11, DOUBLER: 25, SEAM: 0.9 };
    function platingStep(k) {
        const G = Slice.G, u = G.H / 360, z = PLATE.zoom[k - 5], PX = G.W * 0.56, PY = G.H * 0.47, s = u * z;
        const ph = PLATE.PH, pw = PLATE.PW, ramp = RP.HULL, warm = RP.AMBER;
        const seamDist = (hx, hy) => {                                    // → [distance to the nearest seam, which side, plate id]
            const ry = Math.floor((hy + ph * 0.37) / ph), y0 = ry * ph - ph * 0.37, dy0 = hy - y0, dy1 = y0 + ph - hy;
            const shift = hash(ry & 255, 3, 41) * pw, hxs = hx + shift, c0 = Math.floor(hxs / pw), edge = n => n * pw + (hash(n & 255, ry & 255, 43) - 0.5) * pw * 0.5;
            const c = hxs < edge(c0) ? c0 - 1 : hxs >= edge(c0 + 1) ? c0 + 1 : c0, dx0 = hxs - edge(c), dx1 = edge(c + 1) - hxs;
            return { d: Math.min(dx0, dx1, dy0, dy1), horiz: Math.min(dy0, dy1) <= Math.min(dx0, dx1), below: dy0 < dy1, right: dx0 < dx1, id: ((c & 255) * 31 + (ry & 255)) & 255, ry, dy0, dx0, dx1 };
        };
        return pic(G.W, G.H, banded(G.W, G.H, 0, G.H, (bp, oy) => bp.region(0, 0, G.W, BAND, (x, y) => {
            const Y = y + oy, hx = (x + 0.5 - PX) / s, hy = (Y + 0.5 - PY) / s, d = Math.hypot(hx, hy);
            const ed = Math.max(Math.abs(x / G.W - 0.5), Math.abs(Y / G.H - 0.5)) * 2, vig = 1 - 0.62 * smooth(0.5, 1.02, ed);
            if (d < PLATE.RI) {                                           // the port: warm light inside, brightest at its middle
                const g = 1 - d / PLATE.RI, v = (k === 7 ? 0.2 : 0.3) * Math.pow(g, 0.6) + 0.06 * (P.fbm(hx / 3, hy / 3, 77, 2) - 0.5);
                bp.solid(x, y, warm, v * (k === 7 ? 1 : vig)); return;
            }
            const lit = clamp01(0.5 + 0.42 * (hx * 0.94 - hy * 0.34) / 140);   // across the hull toward the light (right and a little up)
            if (d < PLATE.RO) {                                           // the ring: steel, lit on the light's side, eight bolts
                const a = Math.atan2(hy, hx), face = 0.5 + 0.5 * Math.cos(a + 0.35), bolt = Math.abs(((a / (Math.PI / 4)) % 1 + 1) % 1 - 0.5) < 0.09 && d > PLATE.RI + 1.2 && d < PLATE.RO - 1.2;
                const v = (d < PLATE.RI + 0.8 ? 0.06 : 0.2 + 0.28 * face) + (bolt ? 0.16 : 0);
                bp.solid(x, y, ramp, v * vig); return;
            }
            const sd = seamDist(hx, hy), plateV = (hash(sd.id, 7, 45) - 0.5) * 0.07 + (hash(sd.id, 9, 47) > 0.86 ? -0.05 : 0);
            let v = 0.11 + 0.17 * lit + plateV + 0.07 * (P.fbm(hx / 18, hy / 9, 49, 3) - 0.5) + 0.04 * (P.fbm(hx / 2.5, hy / 2.5, 51, 2) - 0.5);
            const seam = PLATE.SEAM, db = Math.abs(d - PLATE.DOUBLER);
            if (db < seam) v = 0.035;                                     // the doubler plate round the airlock
            else if (d < PLATE.DOUBLER) v += 0.04 + (db < seam * 2.2 && hy > -hx * 0.4 ? 0.06 : 0);
            else if (sd.d < seam) v = 0.03;                               // a seam
            else if (sd.d < seam * 2.4) v += (sd.horiz ? (sd.below ? 0.07 : -0.03) : (sd.right ? 0.05 : -0.025));   // its lit lip, toward the light
            if (sd.horiz && d > PLATE.DOUBLER + 2) {                      // rivets along the horizontal seams
                const ry = sd.below ? sd.dy0 : null, rx = ((hx + hash(sd.ry & 255, 5, 53) * 6) % 6 + 6) % 6;
                if (ry != null && Math.abs(ry - 2.6) < 0.75 && Math.abs(rx - 3) < 0.75) v = (ry < 2.6 || rx > 3) ? 0.42 : 0.05;
            }
            const rd = Math.hypot(Math.abs(hx) - 19.5, hy) ;               // two small bolts in the doubler, either side
            if (rd < 0.9 && d < PLATE.DOUBLER) v = 0.36;
            bp.solid(x, y, ramp, Math.max(0.02, v) * vig);
        })));
    }
    function diveStep(k, pose) {
        if (k >= 5) { const p = platingStep(k); p.len = Infinity; p.ports = null; return p; }
        const G = Slice.G, o = stepGeom(k, pose), at = atOf(o);
        const pts = [[0, -0.9], [0, 0.9], [1, -0.9], [1, 0.9]].map(([u, v]) => at(u, v)), ys = pts.map(q => q[1]);
        const p = pic(G.W, G.H, banded(G.W, G.H, Math.min(...ys) - 4, Math.max(...ys) + 4, (bp, oy) => P.hull(bp, Object.assign({}, o, { y: o.y - oy }), P.shapeL)));
        p.len = o.len; p.ports = o.len < 300 ? [0, 1, 2, 3, 4, 5].map(i => at(P.DECK_U(i) + 0.054, -0.32)) : null;
        p.port = Math.max(1, Math.round(o.len / 60));
        return p;
    }
    let bigSteps = [];
    function bakeBigSteps() {                                            // the last three steps do not depend on where our ship was
        const G = Slice.G; if (!G.W) return;
        const pose = { x: G.W / 2, y: G.H / 2, len: Math.round(0.085 * G.H), angle: 0 };
        for (let i = queue.length - 1; i >= 0; i--) if (bigSteps.includes(queue[i])) queue.splice(i, 1);
        bigSteps = [5, 6, 7].map(k => diveStep(k, pose));                 // painted when a course is set (prepare), or at once if needed
    }
    /** A course is set: paint the dive's big steps and that world's sizes in the idle frames of the flight (7 s or more). */
    function prepare(p) {
        bigSteps.forEach(q => { if (q.jobs.length && !queue.includes(q)) queue.push(q); });
        const id = p && p.id; if (!LOOK[id]) return;
        for (let j = STEPS - 1; j >= 0; j--) { const q = worldPic(id, j); if (q.jobs.length && !queue.includes(q)) queue.push(q); }
    }
    function startDive(dir, id) {
        const w = Slice.mods.world, pose = (w && w.landerPose && w.landerPose()) || { x: Slice.G.W * 0.6, y: Slice.G.H * 0.6, len: 46, angle: -0.3 };
        const steps = [0, 1, 2, 3, 4].map(k => diveStep(k, pose)).concat(bigSteps);
        steps.slice(0, 5).forEach(p => queue.unshift(p));
        S.dive = { dir, t0: Slice.clock.t, id, pose, steps, plated: false, done: false };
    }
    function diveStepNow(el) {
        const d = S.dive;
        if (d.dir === 'in') return el < PUSH ? Math.min(STEPS - 1, Math.floor(el / (PUSH / STEPS))) : STEPS - 1;
        return el < DISSOLVE ? STEPS - 1 : Math.max(0, STEPS - 1 - Math.floor((el - DISSOLVE) / (PUSH / STEPS)));
    }
    function drawDive(t) {
        const d = S.dive, G = Slice.G, el = t - d.t0, k = diveStepNow(el), p = ready(d.steps[k]);
        dctx.clearRect(0, 0, G.W, G.H);
        dctx.drawImage(p.canvas, 0, 0);
        if (p.ports) {                                                    // the decks lit from inside, as the world draws them
            const ship = Slice.mods.ship, occ = ship && ship.occupied ? ship.occupied() : [], beat = ship && ship.beat ? ship.beat(t) : 0.6, f = P.framer(dctx, G.W, G.H);
            p.ports.forEach(([x, y], i) => { if (occ[i]) f.px(x - (p.port >> 1), y - (p.port >> 1), RP.AMBER.hex[beat > 0.5 ? 4 : 3], p.port, p.port); });
        }
    }

    // ── 2. what the glass shows: far space (with two tiny far colours), the light, the world braking in ──
    let back = null, backOff = null, glow = new Map();
    const FAR = [                                                         // found, not shown: a rose knot of gas, a verdigris star (≤ 3 px)
        { x: 60, y: 40, ramp: P.ramp(INK, '#1a0c14', '#3a1a2c', '#6a3450'), r: 1.6 },
        { x: 300, y: 168, ramp: P.ramp(INK, '#0a1a17', '#163a33', '#3c7e6c'), r: 1.1 },
    ];
    function backdrop(off) {
        if (!back) {
            const strip = P.spaceStrip(GW + 240, GH, 11, 0.12, 1, 1), lit = new Float32Array(GW * GH);
            for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) lit[y * GW + x] = 0.25 + 0.75 * Math.exp(-Math.hypot(x + WIN.x0 - LIGHT[0], (y + WIN.y0 - LIGHT[1]) * 1.15) / 30);
            const c = document.createElement('canvas'); c.width = GW; c.height = GH;
            back = { strip, lit, p: P.painter(GW, GH, true), c, g: c.getContext('2d'), bright: [] };
        }
        if (backOff === off) return back;
        const keep = (x, y) => Math.hypot(x + WIN.x0 - LIGHT[0], y + WIN.y0 - LIGHT[1]) < 26;
        back.bright = P.paintSpace(back.p, back.strip, off, back.lit, keep);
        FAR.forEach(s => {
            const x = s.x - off; if (x < -4 || x > GW + 4) return;
            for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const d = Math.hypot(dx, dy) / (s.r + 1.4); if (d < 1) back.p.solid(x + dx, s.y + dy, s.ramp, (1 - d) * 0.9); }
        });
        back.g.putImageData(new ImageData(back.p.data, GW, GH), 0, 0);
        backOff = off;
        return back;
    }
    function lightNow() {
        const pl = Slice.state.places || {}, n = Object.values(pl).filter(p => ['visited', 'passed', 'hidden'].includes(p.status)).length;
        const k = Math.pow(1.19, n), key = n;
        if (!glow.has(key)) { const o = { core: 2 * k, halo: 14 * k, strength: 1, spikes: 5 * Math.sqrt(k) }, reach = Math.ceil(o.halo * 3.2 + o.core + 10), p = P.painter(reach * 2, reach * 2, false); P.lightGlow(p, reach, reach, o); glow.set(key, { c: p.canvas(), reach }); }
        return glow.get(key);
    }
    // the world, at 8 sizes as it brakes in (spheres and the station are sprites; the giant is painted where it sits)
    const worlds = new Map();
    const scaleAt = j => lerp(0.3, 1, j / (STEPS - 1));
    function worldPic(id, j) {
        const key = id + ':' + j; if (worlds.has(key)) return worlds.get(key);
        const look = LOOK[id] || LOOK.titan, f = scaleAt(j); let p;
        if (look.kind === 'giant') {
            const R0 = 280 * f, cx = lerp(330, 30, f * f), cy = lerp(110, 380, f * f);   // pushed in on its limb as we brake; the ring arcs over the glass
            p = pic(GW, GH, banded(GW, GH, 0, GH, (bp, oy) => P.paintGiant(bp, { cx, cy: cy - oy, R: R0, L: LW, tilt: -0.55, open: 0.3 })));
            p.disc = [cx + WIN.x0, cy + WIN.y0, R0]; p.fixed = true;
        } else if (look.kind === 'station') {
            const s = 3.6 * f, half = Math.ceil(27 * s + 4);
            p = pic(half * 2, half * 2, [g => { const sp = P.painter(half * 2, half * 2, false); p.win = P.drawStation(sp, half, half, s, look.seed, 0.75 + 0.25 * f); g.putImageData(new ImageData(sp.data, sp.W, sp.H), 0, 0); }]);
            p.half = half; p.r = 24 * s;
        } else {
            const r = Math.round(ORBIT.r * f), w = Math.max(2, Math.round(r / 22)), half = r + w + 3;
            p = pic(half * 2, half * 2, [g => {
                const sp = P.painter(half * 2, half * 2, false);
                P.sphere(sp, { cx: half, cy: half, r, ramp: P.PLANET_RAMP[look.type], L: LW, dim: 0.7 + 0.3 * f, surface: P.surfaceFor(look.type, look.seed, LW), rim: 0.12, ambient: 0.012, gain: 0.84,
                    atmo: { ramp: look.type === 'desert' ? RP.DUST : RP.ICE, w } });
                if (look.furrow) { const k = r / 118, X = half - 0.6 * r, Y = half + 0.1 * r; sp.line(X + 3 * k, Y + k, X + 16 * k, Y - 2 * k, (x, y) => sp.solid(x, y, RP.STONE, 0.02)); }
                g.putImageData(new ImageData(sp.data, sp.W, sp.H), 0, 0);
            }]);
            p.half = half; p.r = r;
        }
        worlds.set(key, p);
        return p;
    }
    function arrival(t) { return 1 - Math.pow(1 - clamp01((t - S.shownAt + DISSOLVE) / ARRIVE), 3); }
    /** Where the world sits now, in frame px: { x, y, r, j, p, e }. */
    function worldGeom(t) {
        const e = arrival(t), j = Math.min(STEPS - 1, Math.round(e * (STEPS - 1))), p = worldPic(S.id, j);
        if (p.fixed) return { x: p.disc[0], y: p.disc[1], r: p.disc[2], j, p, e };
        const x = lerp(470, ORBIT.x, e), y = lerp(84, ORBIT.y, e);
        return { x, y, r: p.r, j, p, e };
    }
    const siteOf = g => (LOOK[S.id] || {}).kind === 'giant' ? [WIN.x0 + 150, WIN.y0 + 150] : [g.x - 0.6 * g.r, g.y + 0.1 * g.r];
    function drawGlass(c, t) {
        const f = P.framer(c, SW, SH), bk = backdrop(Math.floor(t / 900) % 240), lg = lightNow();
        c.save(); c.beginPath(); c.rect(WIN.x0, WIN.y0, GW, GH); c.clip();
        c.drawImage(bk.c, WIN.x0, WIN.y0);
        P.twinkle(f, bk.bright.map(s => ({ x: s.x + WIN.x0, y: s.y + WIN.y0 })), t);
        c.drawImage(lg.c, LIGHT[0] - lg.reach, LIGHT[1] - lg.reach);
        if (S.id) {
            const g = worldGeom(t), p = ready(g.p), look = LOOK[S.id] || {};
            if (p.fixed) c.drawImage(p.canvas, WIN.x0, WIN.y0); else c.drawImage(p.canvas, Math.round(g.x) - p.half, Math.round(g.y) - p.half);
            const [sx, sy] = siteOf(g).map(Math.round), ph = Math.floor((t % 1500) / 125);
            if (look.beacon === 'red') { if (ph < 2) { f.glow(sx, sy, 8, RP.RED, 0.95); f.px(sx - 1, sy - 1, RP.RED.hex[4], 3, 3); } else if (ph < 4) { f.glow(sx, sy, 5, RP.RED, 0.7); f.px(sx, sy, RP.RED.hex[4], 2, 2); } else f.px(sx, sy, RP.RED.hex[ph < 7 ? 3 : 2], 2, 2); }
            if (look.beacon === 'lamp') { if (t % 2000 < 260) { f.glow(sx, sy, 7, RP.AMBER, 0.9); f.px(sx, sy, RP.AMBER.hex[5], 2, 2); } else f.px(sx, sy, RP.AMBER.hex[2], 2, 1); }
            if (look.beacon === 'distress') { if (t % 3200 < 420) { f.glow(sx, sy, 5, RP.RED, 0.55); f.px(sx, sy, RP.RED.hex[3], 2, 2); } else f.px(sx, sy, RP.RED.hex[1], 2, 1); }
            if (look.kind === 'station' && p.win) f.px(Math.round(g.x) - p.half + p.win[0], Math.round(g.y) - p.half + p.win[1], RP.AMBER.hex[4], 2, 1);
            if (S.id === 'kryos' && t - S.skimAt < 6000) skimFlow(f, t - S.skimAt);
            drawShuttle(c, f, t, g);
        }
        c.restore();
    }
    /** Kryos: the scoops pull a thin stream of cloud up toward our hull for a few seconds after "Skim fuel". */
    function skimFlow(f, el) {
        const fade = 1 - smooth(4500, 6000, el);
        for (let i = 0; i < 46; i++) {
            const u = ((el / 2400 + hash(i, 1, 21)) % 1), x0 = WIN.x0 + 100 + hash(i, 2, 21) * 100, y0 = WIN.y0 + 150 + hash(i, 3, 21) * 30;
            const x = lerp(x0, WIN.x0 + 40 + hash(i, 4, 21) * 30, u), y = lerp(y0, WIN.y1 + 4, u * u);
            f.tone(x, y, RP.SUN, (0.45 + 0.4 * hash(i, 5, 21)) * fade * (1 - u * 0.5));
            if (hash(i, 6, 21) > 0.6) f.tone(x + 1, y - 1, RP.SUN, 0.3 * fade * (1 - u));
        }
    }

    // ── 3. the shuttle: a tiny copy of our hull, dropping from under the window to the site, and back ──
    const shuttleSprites = new Map();
    function shuttleSprite(len, ang) {
        const key = len + ':' + Math.round(ang * 20); if (shuttleSprites.has(key)) return shuttleSprites.get(key);
        const half = Math.ceil(len / 2 + 6), p = P.painter(half * 2, half * 2, false);
        P.hull(p, { x: half, y: half, len, ht: Math.max(2, len / 3.15), angle: Math.round(ang * 20) / 20, flip: true, seed: 5, anchor: 0.5, flat: true, sun: 0.3, sunDir: [0.94, -0.34] }, P.shapeL);
        const out = { c: p.canvas(), half }; shuttleSprites.set(key, out); return out;
    }
    function shuttlePos(t, g) {
        const sh = S.shuttle; if (!sh) return null;
        const u = clamp01((t - sh.t0) / sh.dur), e = sh.dir === 'down' ? smooth(0, 1, u) : smooth(0, 1, u);
        const site = siteOf(g), dock = [WIN.x0 + 70, WIN.y1 + 14];
        const [a, b] = sh.dir === 'down' ? [dock, site] : [site, dock];
        const bend = Math.sin(e * Math.PI) * 26, x = lerp(a[0], b[0], e) + bend * 0.3, y = lerp(a[1], b[1], e) - bend;
        const len = Math.round(sh.dir === 'down' ? lerp(16, 3, e) : lerp(3, 16, e));
        return { x, y, len, ang: Math.atan2(b[1] - a[1], b[0] - a[0]), u };
    }
    function drawShuttle(c, f, t, g) {
        const s = shuttlePos(t, g); if (!s || s.u >= 1 || s.u <= 0) return;
        if (s.len < 5) { f.px(s.x, s.y, RP.HULL.hex[4]); f.tone(s.x - Math.cos(s.ang) * 2, s.y - Math.sin(s.ang) * 2, RP.PLUME, 0.7); return; }
        const sp = shuttleSprite(s.len, s.ang);
        for (let d = 2; d < s.len * 0.8; d++) f.tone(s.x - Math.cos(s.ang) * (s.len / 2 + d), s.y - Math.sin(s.ang) * (s.len / 2 + d), RP.PLUME, 0.8 * (1 - d / (s.len * 0.8)));
        c.drawImage(sp.c, Math.round(s.x) - sp.half, Math.round(s.y) - sp.half);
    }

    // ── 4. the films: the team's trip in the house style (288 x 144 at 2x, letterboxed in the frame) ──
    const FILM = { x: 32, y: 24, k: 2 }, filmC = document.createElement('canvas'); filmC.width = P.FILM_W; filmC.height = P.FILM_H;
    const filmG = filmC.getContext('2d');
    let zetaFilm = null, erebusFilm = null, rheaFilm = null;
    function paintRheaFilm() {                                            // the grey moon: EXODUS-6 on its side in the dust, its emergency lamp still flashing
        const p = P.painter(P.FILM_W, P.FILM_H, true), stars = P.scatterStars(p, 52, 220, (x, y) => y < 84);
        P.lightGlow(p, 246, 24, { core: 1.4, halo: 8, strength: 0.8, spikes: 3 });
        const hz = x => 90 - 7 * P.fbm(x / 34, 0, 52, 3);
        p.region(0, 70, P.FILM_W, P.FILM_H, (x, y) => { const h = hz(x); if (y >= h) p.tone(x, y, RP.MOON, 0.1 + 0.3 * Math.exp(-(y - h) / 16) + (P.fbm(x / 5, y / 2.5, 53, 3) - 0.5) * 0.2); });
        [[60, 118, 14, 3], [228, 104, 9, 2], [196, 132, 18, 4]].forEach(([cx, cy, rx, ry]) => p.ellipse(cx, cy, rx, ry, (x, y, q) => p.tone(x, y, RP.MOON, q > 0.7 ? 0.32 : 0.06)));
        const o = { x: 140, y: 102, len: 128, ht: 40, angle: 0.07, flip: true, seed: 6, anchor: 0.5, ramp: RP.HULL, holes: 0.82, light: 0.62, sun: 0.22, sunDir: [0.94, -0.34], fade: 0.3 };
        P.hull(p, o, P.shapeL);
        return { c: p.canvas(), stars: P.keepVisible(p, stars), lamp: atOf(o)(0.04, -0.3).map(Math.round) };
    }
    function paintZetaFilm() {                                            // Platform Zeta close: our Lander docked under its hub, its one window lit
        const p = P.painter(P.FILM_W, P.FILM_H, true), stars = P.scatterStars(p, 33, 260);
        const win = P.drawStation(p, 150, 58, 4.2, 3, 0.9);
        P.hull(p, { x: 150, y: 58 + 11 * 4.2 + 1, len: 150, ht: 48, angle: -Math.PI / 2, flip: true, seed: 9, anchor: 0, sun: 0.3, sunDir: [0.94, -0.34], fade: 0.3 }, P.shapeL);
        return { c: p.canvas(), stars: P.keepVisible(p, stars), win };
    }
    function paintErebusFilm() {                                          // a dark Exodus hull adrift above Kryos's limb, its beacon on backup power
        const p = P.painter(P.FILM_W, P.FILM_H, true), stars = P.scatterStars(p, 47, 240, (x, y) => y < 110);
        P.paintGiant(p, { cx: 250, cy: 330, R: 230, L: P.norm3(0.5, -0.4, 0.77) });
        const o = { x: 120, y: 64, len: 168, ht: 53, angle: -0.22, flip: true, seed: 14, anchor: 0.5, ramp: RP.DARK, holes: 0.84, light: 0.9, sun: 0.2, sunDir: [0.94, -0.34], fade: 0.35 };
        P.hull(p, o, P.shapeL);
        return { c: p.canvas(), stars: P.keepVisible(p, stars), beacon: atOf(o)(0.02, 0).map(Math.round) };
    }
    function drawFilm(c, t) {
        const f = P.framer(filmG, P.FILM_W, P.FILM_H);
        if (S.id === 'zeta') {
            zetaFilm = zetaFilm || paintZetaFilm();
            filmG.drawImage(zetaFilm.c, 0, 0); P.twinkle(f, zetaFilm.stars, t); f.px(zetaFilm.win[0], zetaFilm.win[1], RP.AMBER.hex[4], 2, 1);
        } else if (S.id === 'erebus') {
            erebusFilm = erebusFilm || paintErebusFilm();
            const [bx, by] = erebusFilm.beacon;
            filmG.drawImage(erebusFilm.c, 0, 0); P.twinkle(f, erebusFilm.stars, t);
            if (t % 3200 < 420) { f.glow(bx, by, 4, RP.RED, 0.6); f.px(bx, by, RP.RED.hex[3]); } else f.px(bx, by, RP.RED.hex[1]);
        } else if (S.id === 'rhea') {
            rheaFilm = rheaFilm || paintRheaFilm();
            const [lx, ly] = rheaFilm.lamp;
            filmG.drawImage(rheaFilm.c, 0, 0); P.twinkle(f, rheaFilm.stars, t);
            if (t % 2000 < 260) { f.glow(lx, ly, 6, RP.AMBER, 0.9); f.px(lx, ly, RP.AMBER.hex[5]); } else f.px(lx, ly, RP.AMBER.hex[2]);
        } else P.filmFrame(filmG, t);
        c.fillStyle = INK; c.fillRect(0, 0, SW, SH);
        c.drawImage(filmC, 0, 0, P.FILM_W, P.FILM_H, FILM.x, FILM.y, P.FILM_W * FILM.k, P.FILM_H * FILM.k);
    }
    const hasFilm = id => id !== 'kryos';

    // ── 5. people on the bridge: plans of stays, walks and climbs on the slice clock, so a still is the same twice ──
    const lastOf = id => { const pl = S.plans[id]; return pl && pl[pl.length - 1]; };
    function stayPlan(id, x, act, facing, t0 = -1e9) { S.plans[id] = [{ kind: 'stay', x, act, facing, t0, t1: Infinity }]; }
    function hidePlan(id) { S.plans[id] = [{ kind: 'gone', t0: -1e9, t1: Infinity }]; }
    function cut(id, t) {                                                 // end the plan at t; returns where they are
        const pl = S.plans[id] || [], pose = poseOf(id, t);
        S.plans[id] = pl.filter(s => s.t0 < t).map(s => (s.t1 > t ? Object.assign({}, s, { t1: t }) : s));
        return pose;
    }
    function walkTo(id, t, x, act = 'idle', facing = 1) {
        const from = cut(id, t), pl = S.plans[id];
        if (!from || from.hidden) return enterTo(id, t, x, act, facing);
        const n = Math.ceil(Math.abs(x - from.x) / WALK.move), t1 = t + n * WALK.ms;
        if (n > 0) pl.push({ kind: 'walk', x0: from.x, x1: x, t0: t, t1 });
        pl.push({ kind: 'stay', x, act, facing, t0: t1, t1: Infinity });
    }
    function enterTo(id, t, x, act = 'idle', facing = 1) {                // up the ladder through the hatch, then along the floor
        const pl = S.plans[id] = (S.plans[id] || []).filter(s => s.t0 < t).map(s => (s.t1 > t ? Object.assign({}, s, { t1: t }) : s));
        const rows = 64, tc = t + (rows / CLIMB.rise) * CLIMB.ms, n = Math.ceil(Math.abs(x - HATCH) / WALK.move), tw = tc + n * WALK.ms;
        pl.push({ kind: 'climb', y0: F + rows, y1: F, t0: t, t1: tc }, { kind: 'walk', x0: HATCH, x1: x, t0: tc, t1: tw }, { kind: 'stay', x, act, facing, t0: tw, t1: Infinity });
    }
    function exitDown(id, t) {
        const from = cut(id, t), pl = S.plans[id];
        if (!from || from.hidden) { hidePlan(id); return; }
        const n = Math.ceil(Math.abs(from.x - HATCH) / WALK.move), tw = t + n * WALK.ms, tc = tw + (64 / CLIMB.rise) * CLIMB.ms;
        pl.push({ kind: 'walk', x0: from.x, x1: HATCH, t0: t, t1: tw }, { kind: 'climb', y0: F, y1: F + 64, t0: tw, t1: tc }, { kind: 'gone', t0: tc, t1: Infinity });
    }
    function poseOf(id, t) {
        const pl = S.plans[id]; if (!pl) return null;
        const s = pl.find(q => t >= q.t0 && t < q.t1) || pl[pl.length - 1], lt = t - s.t0;
        if (s.kind === 'gone') return { hidden: true };
        if (s.kind === 'stay') return { x: s.x, y: F, act: s.act, facing: s.facing, ms: t };
        if (s.kind === 'walk') { const dir = Math.sign(s.x1 - s.x0) || 1; return { x: s.x0 + dir * Math.min(Math.abs(s.x1 - s.x0), Math.floor(lt / WALK.ms) * WALK.move), y: F, act: 'walk', facing: dir, ms: lt }; }
        const k = Math.floor(lt / CLIMB.ms), dy = Math.min(Math.abs(s.y1 - s.y0), k * CLIMB.rise);
        return { x: HATCH, y: s.y0 + Math.sign(s.y1 - s.y0) * dy, act: 'climb', facing: 1, ms: (k % CLIMB.frames) * CLIMB.ms + 1, climbing: true };
    }
    const crewOf = id => (Slice.state.crew && Slice.state.crew[id]) || { status: 'well' };
    const canStand = id => ['well', 'away'].includes(crewOf(id).status);
    function defaultEligible() {
        const c = Slice.state.crew || {};
        return CREW.filter(id => crewOf(id).status === 'well' && !(id === 'jaxon' && c.jaxon && c.jaxon.ask === 'granted'));
    }
    const team = () => (Slice.state.stop && Slice.state.stop.team && Slice.state.stop.team.length ? Slice.state.stop.team : S.picked);
    /** Settled positions for a phase (a MOCKUP moment, or the bridge opening): nobody walks. */
    function settle(phase) {
        S.plans = {};
        stayPlan('cora', HELM, 'console', 1);
        CREW.forEach(hidePlan);
        const elig = S.eligible || defaultEligible(), tm = team();
        if (!phase || phase === 'arrive') { if (crewOf('mira').status === 'well') stayPlan('mira', NAV, 'console', 1); if (S.id === 'kryos' && crewOf('jaxon').status === 'well') stayPlan('jaxon', SPOT_X.jaxon, 'idle', 1); return; }
        const down = ['away', 'site'].includes(phase);
        elig.forEach(id => { if (!(down && tm.includes(id))) stayPlan(id, SPOT_X[id], 'idle', 1); });
        if (!down) tm.forEach(id => stayPlan(id, SPOT_X[id], 'idle', 1));
    }

    // ── 6. one frame of the bridge ──
    let fxList = [];
    function drawSides(c, t) {
        [[0, 0.002, 0], [1, 0.006, 137]].forEach(([layer, drift, ox]) => {
            const T = A.stars(layer), n = T.size, oy = ((Math.round(t * drift) % n) + n) % n;
            for (let y = oy - n; y < SH; y += n) for (let x = -(ox % n); x < SW; x += n) c.drawImage(T.canvas, x, y);
        });
    }
    function drawFx(f, t) {                                               // the room's small moving things: lights, the grille, the screens
        const tick = Math.floor(t / 125), spk = S.sign && /spark/.test(S.sign) && S.phase === 'arrive' && t - S.phaseAt > 900 && t - S.phaseAt < 1500;
        fxList.forEach(o => {
            const X = o.x + OFFX, Y = o.y - B.Y0;
            if (Y < 0 || Y > SH) return;
            if (o.kind === 'led') { if (((t + o.x * 37) % o.period) < o.period * 0.55) f.px(X, Y, o.color); }
            else if (o.kind === 'aura') { const v = 0.55 + 0.4 * Math.sin(t / 1700); f.px(X, Y, R.SCR.hex[v > 0.75 ? 5 : v > 0.45 ? 4 : 3], 3, 1); }
            else if (o.kind === 'screen') {
                for (let r = 1; r < o.h; r += 2) { const n = Math.floor(hash(r & 255, (tick >> 2) & 255, 3) * (o.w - 1)); for (let k = 0; k < n; k++) if (hash(k & 255, (r + tick) & 255, 5) > 0.3) f.px(X + k, Y + r, R.SCR.hex[(k + r) % 4 ? 2 : 3]); }
                if (spk && o.tone === 'chart') for (let i = 0; i < 14; i++) f.tone(X + o.w / 2 + (hash(i, tick & 255, 7) - 0.5) * 30, Y - hash(i, 3, 7) * 16 + (tick % 4) * 2, RP.AMBER, 0.6 + 0.4 * hash(i, tick & 255, 8));
            }
        });
    }
    function lightFor(x) {
        const near = room.lamps.reduce((a, b) => (Math.abs(b.x - x) < Math.abs(a.x - x) ? b : a));
        return Math.round(3 * Math.exp(-Math.abs(near.x - x) / 55));
    }
    function drawPeople(c, t) {
        S.drawn = [];
        const list = ['cora'].concat(CREW).map(id => ({ id, p: poseOf(id, t) })).filter(o => o.p && !o.p.hidden && (o.id === 'cora' || canStand(o.id)));
        list.sort((a, b) => (a.p.climbing ? -1 : 0) - (b.p.climbing ? -1 : 0) || a.p.x - b.p.x).forEach(({ id, p }) => {
            const picked = S.picked.includes(id) && S.phase === 'pick', hot = S.hover === id && S.phase === 'pick';
            const still = p.act === 'idle' || p.act === 'console', ms = still ? p.ms + CREW.indexOf(id) * 977 : p.ms;
            const blink = ((ms + (CREW.indexOf(id) + 2) * 1700) % 4300) < 140;
            const Sp = CE.sprite(id, p.act, CE.frameAt(p.act, ms), { blink, warm: picked ? 3 : hot ? Math.max(2, lightFor(p.x)) : lightFor(p.x), rim: p.facing, screen: p.act === 'console' });
            const X = Math.round(p.x) + OFFX, Y = Math.round(p.y) + (picked ? 3 : 0) - Sp.origin.y;
            if (picked || hot) floorGlow(c, X, Math.round(p.y) + (picked ? 3 : 0), picked ? 0.5 : 0.28);
            if (p.facing > 0) c.drawImage(Sp.canvas, X - Sp.origin.x, Y); else { c.save(); c.translate(X + 1, 0); c.scale(-1, 1); c.drawImage(Sp.canvas, -Sp.origin.x, Y); c.restore(); }
            S.drawn.push({ id, Sp, X, Y, facing: p.facing, top: Y });
        });
    }
    /** A warm pool of light on the floor under someone: chosen (or pointed at) for the team. Dithered, no outline. */
    function floorGlow(c, x, y, peak) {
        const f = P.framer(c, SW, SH);
        for (let dy = -3; dy <= 2; dy++) for (let dx = -22; dx <= 22; dx++) { const d = Math.hypot(dx / 22, dy / 3.2); if (d < 1) f.tone(x + dx, y + dy, RP.AMBER, peak * (1 - d) ** 1.4); }
    }
    let masks = null;
    function mask(j) {                                                     // 8 Bayer masks: step j shows (j + 1) / 8 of the pixels
        if (!masks) masks = Array.from({ length: STEPS }, (_, k) => {
            const c = document.createElement('canvas'); c.width = SW; c.height = SH;
            const g = c.getContext('2d'), img = g.createImageData(SW, SH);
            for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) if (threshold(x, y) < (k + 1) / STEPS) img.data[(y * SW + x) * 4 + 3] = 255;
            g.putImageData(img, 0, 0); return c;
        });
        return masks[Math.max(0, Math.min(STEPS - 1, j))];
    }
    function composeBridge(t) {
        const c = actx;
        c.imageSmoothingEnabled = false;
        c.fillStyle = INK; c.fillRect(0, 0, SW, SH);
        drawSides(c, t);
        drawGlass(c, t);
        c.drawImage(room.canvas, OFFX, 0);
        c.globalCompositeOperation = 'lighter'; c.drawImage(room.glass, 0, 0); c.globalCompositeOperation = 'source-over';
        c.drawImage(A.deck(1).canvas, OFFX, B.H);
        drawFx(P.framer(c, SW, SH), t);
        drawPeople(c, t);
        const fm = filmMix(t);
        if (fm > 0) { drawFilm(tctx, t); if (fm < STEPS) { tctx.globalCompositeOperation = 'destination-in'; tctx.drawImage(mask(fm - 1), 0, 0); tctx.globalCompositeOperation = 'source-over'; } c.drawImage(tmp, 0, 0); }
    }
    /** 0: no film; 1..7: dissolving; 8: the film fills the frame. */
    function filmMix(t) {
        const fl = S.film; if (!fl || !hasFilm(S.id)) return 0;
        const inJ = Math.min(STEPS, 1 + Math.floor((t - fl.t0) / (DISSOLVE / STEPS)));
        if (fl.out == null) return Math.max(0, inJ);
        return Math.max(0, Math.min(inJ, STEPS - Math.floor((t - fl.out) / (DISSOLVE / STEPS))));
    }

    // ── 7. words in #stop-words: the name in a corner, the action word beside the site, "Leave orbit" under the window ──
    const css = (x, y) => [Slice.G.bLeft + x * Slice.G.bk / Slice.G.dpr, Slice.G.bTop + y * Slice.G.bk / Slice.G.dpr];
    function makeWords() {
        const root = document.getElementById('stop-words'); if (!root) return;
        const st = document.createElement('style');
        st.textContent = `#stop-words .sw { position: absolute; left: 0; top: 0; opacity: 0; transition: opacity 420ms var(--ease), color 140ms var(--ease); white-space: nowrap;
            text-shadow: 0 1px 0 #05070a, 0 0 6px rgba(5,7,10,.9); will-change: transform; margin: 0; }
            #stop-words .sw.on { opacity: 1; }
            #stop-words .sw-name { font: 500 var(--fs-note-name)/1.15 var(--f-ui); letter-spacing: .02em; color: var(--dim); }
            #stop-words .sw-act { display: grid; gap: 2px; justify-items: end; }
            #stop-words .sw-act b { font: 500 var(--fs-act)/1.15 var(--f-ui); letter-spacing: .02em; color: var(--warm); }
            #stop-words .sw-act span { font: 400 var(--fs-act-sub)/1.3 var(--f-text); color: var(--dim); }
            #stop-words .sw-act.is-faint b { color: var(--faint); }
            #stop-words .sw-act.is-hot b { color: var(--warm-br); }
            #stop-words .sw-leave { font: 400 var(--fs-act-sub)/1.2 var(--f-text); color: var(--ui); }
            #stop-words .sw-leave.is-hot { color: var(--warm); }
            #stop-words .sw-good { white-space: normal; max-width: calc(260px + 60px * var(--t)); padding-left: 9px; border-left: 2px solid var(--who, #c9d1d6);
                font: 400 var(--fs-note-line)/1.35 var(--f-text); color: #eceae2; }
            #stop-words .sw-good b { display: block; margin-bottom: 2px; font: 600 var(--fs-who)/1.2 var(--f-ui); letter-spacing: .14em; text-transform: uppercase; color: var(--who, #c9d1d6); }
            @media (prefers-reduced-motion: reduce) { #stop-words .sw { transition: none; } }`;
        document.head.appendChild(st);
        const mk = (cls, html) => { const e = document.createElement('div'); e.className = 'sw ' + cls; e.innerHTML = html; root.appendChild(e); return e; };
        S.words = { name: mk('sw-name', ''), act: mk('sw-act', '<b></b><span></span>'), leave: mk('sw-leave', 'Leave orbit'), good: mk('sw-good', '<b></b><span></span>') };
    }
    const setText = (el, text) => { if (el && el.textContent !== text) el.textContent = text; };
    function show(el, on, x, y) { if (!el) return; el.classList.toggle('on', !!on); if (on) el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`; }
    const script = () => Slice.mods.script || {};
    const placeInfo = id => (script().PLACES && script().PLACES[id]) || {};
    const nameOf = id => placeInfo(id).name || PLACE_NAME[id] || id;
    const verbOf = id => placeInfo(id).verb || VERB[id] || 'Send the team';
    const needsTeam = id => (placeInfo(id).team != null ? !!placeInfo(id).team : !!TEAM_PLACES[id]);
    const goodLine = id => { let g = null; try { g = typeof script().goodFor === 'function' ? script().goodFor(id) : null; } catch (err) { g = null; } return (g && (g.text || g)) || GOOD[id]; };
    function subLine() {
        const ids = S.picked.map(id => NAMES[id]); if (ids.length < 2) return '';
        return ids[0] + ' and ' + ids[1] + (S.id === 'zeta' ? ' go aboard' : ' take the shuttle');
    }
    function actState(t) {                                                 // null: hidden; 'faint': shown, not yet clickable; 'on'
        if (!S.open || S.dive || arrival(t) < 1 || filmMix(t) > 0) return null;
        if (!['arrive', 'pick', null].includes(S.phase)) return null;
        if (!needsTeam(S.id)) return S.id === 'kryos' && t - S.skimAt < 7000 ? null : 'on';
        return S.phase === 'pick' && S.picked.length === 2 ? 'on' : 'faint';
    }
    function placeWords(t) {
        const W = S.words; if (!W.name) return;
        const open = S.open && !S.dive, settled = open && arrival(t) >= 1, film = filmMix(t) > 0;
        const hovering = S.phase === 'pick' && !!S.hover;                  // the hover line speaks: the corner name and the sub-line step back (40 words)
        setText(W.name, S.id ? nameOf(S.id) : '');
        const [nx, ny] = css(WIN.x0 + 10, WIN.y0 + 8); show(W.name, settled && !film && !hovering, nx, ny);
        const as = actState(t), g = open ? worldGeom(t) : null;
        if (as && g) {
            setText(W.act.querySelector('b'), verbOf(S.id)); setText(W.act.querySelector('span'), as === 'on' && !hovering ? subLine() : '');
            W.act.classList.toggle('is-faint', as === 'faint'); W.act.classList.toggle('is-hot', S.hot === 'act' && as === 'on');
            const [sx, sy] = siteOf(g), edge = S.id === 'kryos' ? sx + 40 : g.x - g.r * ((LOOK[S.id] || {}).kind === 'station' ? 1.2 : 1) - 12;   // integrator: the station's arms reach past its r
            const [ax, ay] = css(Math.max(WIN.x0 + 40, edge), S.id === 'kryos' ? WIN.y0 + 70 : sy - 12);
            show(W.act, true, ax - (W.act.offsetWidth || 0), ay);
        } else show(W.act, false);
        W.leave.classList.toggle('is-hot', S.hot === 'leave');
        const [lx, ly] = css(553, WIN.y1 + 12); show(W.leave, settled && !film, lx - (W.leave.offsetWidth || 0) / 2, ly);
        const d = S.phase === 'pick' && S.hover && S.drawn.find(q => q.id === S.hover);
        if (d && settled && !film) {
            setText(W.good.querySelector('b'), NAMES[d.id]); setText(W.good.querySelector('span'), goodLine(d.id)); W.good.style.setProperty('--who', COLOR[d.id]);
            const k = Slice.G.bk / Slice.G.dpr, w = W.good.offsetWidth || 280, h = W.good.offsetHeight || 48, g = worldGeom(t);
            let [gx, gy] = css(d.X, d.Y - 8); gx -= w / 2; gy -= h;
            const [cx, cy] = css(g.x, g.y), r = g.r * k + 10, hitsDisc = x => { const nx = Math.max(x, Math.min(cx, x + w)), ny = Math.max(gy, Math.min(cy, gy + h)); return Math.hypot(nx - cx, ny - cy) < r; };
            const [minX] = css(WIN.x0 + 4, 0); while (hitsDisc(gx) && gx > minX) gx -= 8;
            show(W.good, true, Math.max(minX, gx), gy);
        } else show(W.good, false);
    }
    function hideWords() { Object.values(S.words).forEach(el => show(el, false)); }

    // ── 8. the bus ──
    function setStop(patch) {
        const cur = Slice.state.stop || { id: S.id, phase: S.phase, team: [], aboard: [] };
        Slice.state.stop = Object.assign({}, cur, patch);
    }
    function onDiveStart(p) {
        const id = p && p.id; if (!id || !LOOK[id]) return;
        S.id = id; S.phase = 'arrive'; S.phaseAt = Slice.clock.t; S.sign = null; S.eligible = null; S.picked = []; S.shuttle = null; S.film = null; S.skimAt = -1e9;
        for (let j = STEPS - 1; j >= 0; j--) queue.unshift(worldPic(id, j));          // the world's sizes, ahead of everything else
        startDive('in', id);
        setStop({ id, phase: 'arrive', team: [], aboard: [] });
        settle('arrive');
        gather(Slice.clock.t - 2600, defaultEligible());                   // up the ladder during the dive: the lineup is forming as the bridge shows
    }
    /** Everyone who may go comes up to the window while the world brakes in (the lineup is there by the pick). The one with the
        farthest spot climbs first and they come up 0.7 s apart, so nobody passes anyone and they never bunch at the ladder
        (look playtest: three stood stacked at the hatch as the bridge showed). */
    function gather(t, ids) {
        ids.slice().sort((a, b) => SPOT_X[b] - SPOT_X[a]).forEach((id, i) => {
            const last = lastOf(id);
            if (last && last.kind === 'stay' && last.x === SPOT_X[id]) return;
            const ps = poseOf(id, t);
            if (ps && !ps.hidden) walkTo(id, t + 900 + i * 200, SPOT_X[id]); else enterTo(id, t + i * 700, SPOT_X[id]);
        });
    }
    function onDiveBack(p) {
        if (!S.open) return;
        startDive('out', (p && p.id) || S.id);
    }
    function onPhase(p) {
        if (!p || (S.id && p.id && p.id !== S.id)) return;
        const t = Slice.clock.t, phase = p.phase;
        if (p.id && !S.id) S.id = p.id;
        S.phase = phase; S.phaseAt = t;
        if (p.sign !== undefined) S.sign = p.sign;
        if (Array.isArray(p.eligible)) S.eligible = p.eligible.slice();
        const elig = S.eligible || defaultEligible(), tm = team();
        if (phase === 'pick') {
            S.picked = S.picked.filter(id => elig.includes(id));
            gather(t - 900, elig);
            CREW.filter(id => !elig.includes(id)).forEach(id => { const last = lastOf(id); if (last && last.kind === 'stay' && last.x === SPOT_X[id]) exitDown(id, t); });
        }
        if (phase === 'away') {
            tm.forEach((id, i) => exitDown(id, t + 400 + i * 500));
            const gone = Math.max(t, ...tm.map(id => { const l = lastOf(id); return l && l.kind === 'gone' ? l.t0 : t; }));
            S.shuttle = { dir: 'down', t0: gone - 600, dur: 4200, landed: false };          // it unclamps once they are down the ladder
        }
        if (phase === 'site') { S.film = { t0: t, out: null }; if (S.shuttle && S.shuttle.dir === 'down') S.shuttle.t0 = Math.min(S.shuttle.t0, t - S.shuttle.dur); }
        if (phase === 'back' || phase === 'leave') {
            if (S.film && S.film.out == null) S.film.out = t;
            if (phase === 'back') { S.shuttle = { dir: 'up', t0: t + 400, dur: 4200, landed: false }; tm.forEach((id, i) => enterTo(id, t + 4800 + i * 600, SPOT_X[id])); }
        }
        setStop({ phase, team: tm.slice(), aboard: ['cora'].concat(CREW.filter(id => !tm.includes(id))) });
    }
    function onAct(p) { if (p && p.id === 'kryos' && p.verb === 'skim') S.skimAt = Slice.clock.t; }

    // ── 9. the clock: the dive's beats are emitted on time, so ?m= and ?t= replay the same ──
    function update(dt, t) {
        bake(dt > 0 ? 4 : 2);
        const d = S.dive;
        if (d) {
            const el = t - d.t0;
            if (d.dir === 'in') {
                if (!d.plated && el >= PUSH) { d.plated = true; S.open = true; S.shownAt = d.t0 + PUSH + DISSOLVE; Slice.emit('dive:plated', { dir: 'in' }); }
                if (!d.done && el >= PUSH + DISSOLVE) { d.done = true; S.dive = null; registerAnchors(true); Slice.emit('stop:shown', { id: d.id }); }
            } else {
                if (!d.plated && el >= DISSOLVE) { d.plated = true; Slice.emit('dive:plated', { dir: 'out' }); }
                if (!d.done && el >= DISSOLVE + PUSH) { d.done = true; S.dive = null; close(d.id); }
            }
        }
        const sh = S.shuttle;
        if (sh && !sh.landed && t >= sh.t0 + sh.dur) { sh.landed = true; Slice.emit('stop:shuttle', { id: S.id, at: sh.dir === 'down' ? 'site' : 'ship' }); }
    }
    function close(id) {
        S.open = false; S.id = null; S.phase = null; S.shuttle = null; S.film = null; S.picked = []; S.hover = null; S.hot = null;
        registerAnchors(false);
        Slice.state.stop = null;
        Slice.emit('stop:hidden', { id });
    }

    // ── 10. drawing: which canvases show, and what is in them ──
    function vis(c, on) { const v = on ? 'block' : 'none'; if (c && c.style.display !== v) c.style.display = v; }
    let inked = false;
    function render(t) {
        if (!room) return;
        const d = S.dive, G = Slice.G;
        if (!d && !S.open) { vis(diveC, false); vis(bridgeC, false); hideWords(); inked = false; return; }
        let j = STEPS;                                                     // how much of the bridge shows (Bayer steps)
        if (d) {
            const el = t - d.t0;
            j = d.dir === 'in' ? (el < PUSH ? 0 : Math.min(STEPS, 1 + Math.floor((el - PUSH) / (DISSOLVE / STEPS)))) : (el < DISSOLVE ? STEPS - Math.floor(el / (DISSOLVE / STEPS)) : 0);
            vis(diveC, true); drawDive(t); inked = false;
        } else {
            vis(diveC, true);
            if (!inked) { dctx.fillStyle = INK; dctx.fillRect(0, 0, G.W, G.H); inked = true; }
        }
        if (j <= 0) { vis(bridgeC, false); hideWords(); return; }
        composeBridge(t);
        vis(bridgeC, true);
        bctx.clearRect(0, 0, SW, SH);
        if (j < STEPS) { actx.globalCompositeOperation = 'destination-in'; actx.drawImage(mask(j - 1), 0, 0); actx.globalCompositeOperation = 'source-over'; }
        bctx.drawImage(art, 0, 0);
        if (j < STEPS) hideWords(); else placeWords(t);
    }

    // ── 11. the pointer (CSS px; index routes it here while the mode is dive-in, stop or dive-out) ──
    const toFrame = (cx, cy) => [Math.floor((cx - Slice.G.bLeft) * Slice.G.dpr / Slice.G.bk), Math.floor((cy - Slice.G.bTop) * Slice.G.dpr / Slice.G.bk)];
    const alphas = new WeakMap();
    function personAtPx(x, y) {
        for (let i = S.drawn.length - 1; i >= 0; i--) {
            const d = S.drawn[i], Sp = d.Sp, cx = d.facing > 0 ? x - (d.X - Sp.origin.x) : (d.X + Sp.origin.x) - x, cy = y - d.Y;
            if (cx < -3 || cy < -3 || cx >= Sp.w + 3 || cy >= Sp.h + 3) continue;
            let al = alphas.get(Sp.canvas); if (!al) { al = Sp.canvas.getContext('2d').getImageData(0, 0, Sp.w, Sp.h).data; alphas.set(Sp.canvas, al); }
            for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const xx = cx + dx, yy = cy + dy; if (xx >= 0 && yy >= 0 && xx < Sp.w && yy < Sp.h && al[(yy * Sp.w + xx) * 4 + 3]) return d.id; }
        }
        return null;
    }
    function inside(el, cx, cy, pad = 8) { if (!el || !el.classList.contains('on')) return false; const r = el.getBoundingClientRect(); return cx >= r.left - pad && cx <= r.right + pad && cy >= r.top - pad && cy <= r.bottom + pad; }
    function setPointing(on) { const st = document.getElementById('stage'); if (st) st.classList.toggle('is-pointing', !!on); }
    function pointer(type, e, cx, cy) {
        if (!S.open || S.dive || (window.MiniHost && window.MiniHost.current)) { if (type === 'move') setPointing(false); return false; }
        const t = Slice.clock.t, [ax, ay] = toFrame(cx, cy), as = actState(t), film = filmMix(t) > 0;
        const onAct = as === 'on' && inside(S.words.act, cx, cy), onLeave = inside(S.words.leave, cx, cy);
        const who = !film && S.phase === 'pick' ? personAtPx(ax, ay) : null, pickable = who && (S.eligible || defaultEligible()).includes(who);
        if (type === 'leave') { S.hover = null; S.hot = null; setPointing(false); return false; }
        if (type === 'move') {
            S.hot = onAct ? 'act' : onLeave ? 'leave' : null; S.hover = pickable ? who : null;
            setPointing(onAct || onLeave || pickable); return !!(onAct || onLeave || pickable);
        }
        if (type !== 'down') return false;
        if (onLeave) { Slice.emit('stop:leave', { id: S.id }); return true; }
        if (onAct && t >= S.guardUntil) {
            const verb = needsTeam(S.id) ? (S.id === 'zeta' ? 'dock' : S.id === 'erebus' ? 'answer' : 'send') : 'skim';
            if (verb === 'skim') S.skimAt = t;
            Slice.emit('stop:act', { id: S.id, verb, label: verbOf(S.id) });
            return true;
        }
        if (pickable) {
            S.picked = S.picked.includes(who) ? S.picked.filter(id => id !== who) : S.picked.concat(who).slice(-2);
            if (S.picked.length === 2) S.guardUntil = t + 400;
            setStop({ team: S.picked.slice() });
            Slice.emit('stop:pick', { ids: S.picked.slice() });
            return true;
        }
        return false;
    }

    // ── 12. anchors and discs (CSS px) ──
    function registerAnchors(on) {
        const names = ['stop:aura', 'stop:glass', 'stop:radio', 'stop:site'].concat(['cora'].concat(CREW).map(id => 'stop:person:' + id));
        if (!on) { names.forEach(n => Slice.anchors.delete(n)); return; }
        const pt = (x, y, side, align) => { const [X, Y] = css(x, y); return { x: X, y: Y, side, align }; };
        // A.U.R.A. and the radio speak in the open sky of the left pane (the world fills the right); the grille is the fallback
        Slice.anchors.set('stop:aura', () => [pt(WIN.x0 + 12, WIN.y0 + 26, 'below'), pt(574, 122, 'left')]);
        // look playtest: the strip-or-marker ask sat on the wreck's nose during the film; the empty sky right of centre is a third place
        Slice.anchors.set('stop:glass', () => [pt(WIN.x0 + 12, WIN.y0 + 26, 'below'), pt(WIN.x0 + 12, WIN.y1 - 70, 'below'), pt(290, WIN.y0 + 12, 'below')]);
        // integrator: the radio also offers the glass's open sky (left and right), so an ask during a film can keep off the wreck
        Slice.anchors.set('stop:radio', () => [pt(HELM + OFFX, F - 120, 'above', 'center'), pt(HELM + OFFX + 30, F - 100, 'right'), pt(574, 150, 'left'), pt(WIN.x0 + 12, WIN.y0 + 26, 'below')]);
        Slice.anchors.set('stop:site', () => { const g = worldGeom(Slice.clock.t), [sx, sy] = siteOf(g); return [pt(Math.max(WIN.x0 + 20, g.x - g.r - 12), sy, 'left'), pt(sx, Math.min(WIN.y1 - 10, g.y + g.r + 8), 'below', 'center')]; });
        ['cora'].concat(CREW).forEach(id => Slice.anchors.set('stop:person:' + id, () => {
            const d = S.drawn.find(q => q.id === id); if (!d) return [];
            // final check: when all three beside the speaker land on a body or the world, A.U.R.A.'s two places in the open glass
            // come next (the top left; right of centre when the last click, the action word, sits top left)
            return [pt(d.X, d.Y + 2, 'above', 'center'), pt(d.X + 22, d.Y + 30, 'right'), pt(d.X - 22, d.Y + 30, 'left'), pt(WIN.x0 + 12, WIN.y0 + 26, 'below'), pt(574, 122, 'left')];
        }));
    }
    // what the films show, in film px [x, y, r]: words keep off them while a film is up
    const FILM_DISCS = { zeta: [[150, 58, 40], [80, 58, 34], [220, 58, 34], [150, 128, 28]], erebus: [[70, 75, 30], [120, 64, 30], [175, 52, 30], [250, 330, 232]],
        titan: [[86, 60, 22], [86, 96, 26], [242, 24, 11]], rhea: [[90, 100, 24], [140, 102, 24], [190, 100, 24], [246, 24, 10]] };
    function discs() {
        if (!S.open || S.dive || !S.id) return [];
        const t = Slice.clock.t, k = Slice.G.bk / Slice.G.dpr;
        if (filmMix(t) >= STEPS) return (FILM_DISCS[S.id] || FILM_DISCS.titan).map(([x, y, r]) => { const [X, Y] = css(FILM.x + x * FILM.k, FILM.y + y * FILM.k); return [X, Y, r * FILM.k * k]; });
        const g = worldGeom(t), [x, y] = css(g.x, g.y);
        // final check: an ask beside its speaker landed on the people next to them (Cora dissolved under the surge's question);
        // the bodies on the bridge count too, below the heads, so a line can still sit just above whoever speaks
        const bodies = S.drawn.flatMap(d => { const h = d.Sp.canvas.height; return [0.42, 0.72].map(f => { const [X, Y] = css(d.X, d.Y + h * f); return [X, Y, h * 0.2 * k]; }); });
        return [[x, y, g.r * k]].concat(bodies);
    }
    function bands() {
        const [, t0] = css(0, 0), [, t1] = css(0, FILM.y), [, b0] = css(0, FILM.y + P.FILM_H * FILM.k), [, b1] = css(0, SH);
        return { top: { y: t0, h: t1 - t0 }, bottom: { y: b0, h: b1 - b0 } };
    }

    // ── 13. a MOCKUP moment: the bridge at that phase, settled (SLICE_SPEC §6.2). Script's state wins when it has one. ──
    const MOMENT = {
        dive: { id: 'titan', dive: true }, pick: { id: 'titan', phase: 'pick' },
        torch: { id: 'titan', phase: 'away', team: ['vance', 'mira'] }, surge: { id: 'titan', phase: 'away', team: ['vance', 'mira'] },
        stockpile: { id: 'titan', phase: 'site', team: ['vance', 'mira'] }, 'page-disc': { id: 'titan', phase: 'site', team: ['vance', 'mira'] },
        erebus: { id: 'erebus', phase: 'pick' }, breach: { id: 'erebus', phase: 'away', team: ['vance', 'aris'] },
        call: { id: 'erebus', phase: 'site', team: ['vance', 'aris'] }, kryos: { id: 'kryos', phase: 'arrive' },
        zeta: { id: 'zeta', phase: 'pick' }, rhea: { id: 'rhea', phase: 'site', team: ['aris', 'jaxon'] },
    };
    let lastMoment = null;
    function reset() {
        S.dive = null; S.open = false; S.id = null; S.phase = null; S.sign = null; S.eligible = null; S.picked = []; S.shuttle = null; S.film = null;
        S.hover = null; S.hot = null; S.plans = {}; S.skimAt = -1e9; registerAnchors(false); hideWords();
    }
    function goto(moment) { lastMoment = moment; reset(); }
    function syncMoment() {
        const st = Slice.state, m = MOMENT[lastMoment], s = st.stop || (m && !m.dive ? { id: m.id, phase: m.phase, team: m.team || [] } : null);
        if (st.mode === 'dive-in' || (m && m.dive && !st.stop)) {           // mid-push, so ?m=dive shows the hull and plays on into the bridge
            onDiveStart({ id: (st.stop && st.stop.id) || (m && m.id) || 'titan' });
            S.dive.t0 = Slice.clock.t - PUSH * 0.5;
            return;
        }
        if (!s || !LOOK[s.id]) return;
        S.id = s.id; S.open = true; S.shownAt = -1e9; S.phase = s.phase || 'arrive'; S.phaseAt = -1e9; S.picked = (s.team || []).slice();
        if (S.phase === 'pick') S.picked = [];
        if (S.phase === 'site' && hasFilm(S.id)) S.film = { t0: -1e9, out: null };
        if (['away'].includes(S.phase)) S.shuttle = { dir: 'down', t0: -1e9, dur: 5200, landed: true };
        Slice.state.stop = { id: s.id, phase: S.phase, team: (s.team || []).slice(), aboard: ['cora'].concat(CREW.filter(id => !(s.team || []).includes(id))) };
        settle(S.phase);
        registerAnchors(true);
    }

    // ── 14. the one way to play a real minigame (SPEC §9). Holds the journey; never throws. ──
    function minigame(id, opts) {
        const host = window.MiniHost;
        if (!host || !host.has(id)) { console.warn(`Slice: minigame "${id}" is not loaded`); return Promise.resolve({ failed: true }); }
        if (host.current) {                                               // another one is still open (a MOCKUP jump left it there): carry on, logged
            const result = { failed: true, reason: `"${host.current}" is still open` };
            Slice.emit('minigame:end', { id, result });
            return Promise.resolve(result);
        }
        Slice.state.hold += 1;
        Slice.emit('minigame:start', { id });
        return host.play(id, opts || {}).then(result => result, err => { console.error(err); return { failed: true }; })
            .then(result => { Slice.state.hold = Math.max(0, Slice.state.hold - 1); Slice.emit('minigame:end', { id, result }); return result; });
    }

    // ── setup ──
    function init() {
        room = BA.paint();
        fxList = room.fx;
        art = document.createElement('canvas'); art.width = SW; art.height = SH; actx = art.getContext('2d');
        tmp = document.createElement('canvas'); tmp.width = SW; tmp.height = SH; tctx = tmp.getContext('2d'); tctx.imageSmoothingEnabled = false;
        diveC = document.getElementById('dive'); bridgeC = document.getElementById('bridge');
        dctx = diveC.getContext('2d'); bctx = bridgeC.getContext('2d');
        makeWords();
        Slice.on('dive:start', onDiveStart);
        Slice.on('dive:back', onDiveBack);
        Slice.on('stop:phase', onPhase);
        Slice.on('stop:act', onAct);
        Slice.on('mockup:goto', syncMoment);
        Slice.on('route:go', prepare);
        ['titan', 'zeta', 'erebus', 'rhea'].forEach(id => later(worldPic(id, STEPS - 1)));   // small sprites; the giant waits for its course
        queue.push(pic(1, 1, [() => backdrop(0), () => lightNow(), () => mask(0), () => { A.deck(1); }]));
    }
    function resize(G) {
        diveC.width = G.W; diveC.height = G.H;
        diveC.style.width = (G.W * G.k / G.dpr) + 'px'; diveC.style.height = (G.H * G.k / G.dpr) + 'px';
        bridgeC.width = SW; bridgeC.height = SH;
        Object.assign(bridgeC.style, { width: (SW * G.bk / G.dpr) + 'px', height: (SH * G.bk / G.dpr) + 'px', left: G.bLeft + 'px', top: G.bTop + 'px' });
        dctx.imageSmoothingEnabled = false; bctx.imageSmoothingEnabled = false; inked = false;
        bakeBigSteps();
        if (S.dive) S.dive.steps = S.dive.steps.slice(0, 5).concat(bigSteps);
    }
    const isOpen = () => !!(S.dive || S.open);

    Slice.mods.stop = { init, resize, update, render, pointer, goto, isOpen, discs, bands, minigame };
})();
