/* ═══ Silent Exodus · minigames · art/MiniPeople.js: the five crew-hires people, for the minigames ═════════════════════════
   A COPY of src/newscreen/crew/CrewEngine.js and the five person files (Cora, Jaxon, Aris, Vance, Mira), taken 2026-10-11, in
   one file. The engine is exported as window.MiniCrewEngine (not CrewEngine) and the people register into it, so this copy
   and the new screen's own can both be loaded without touching each other. Nothing else is changed. MiniCrew.js draws
   with it; a minigame should call MiniCrew, not this. Load after MiniLab.js, before MiniCrew.js.
   Copy again if the crew files change and the minigames should follow. */
/* ═══ Silent Exodus · new screen (?new=1) · crew/CrewEngine.js: the crew sprite engine ════════════════════════════
   What it is: the engine that bakes the five people's sprites (one hand-drawn head per view on a small lit body it
   poses), frame by frame, cached. The tower draws everyone with it.
   Source: prototypes/screens/crew-hires/engine.js, ported unchanged. API: window.CrewEngine (frozen), in the notes below.
   Loaded only when the new-screen switch is on. Load first of the crew, then Cora.js Jaxon.js Aris.js Vance.js Mira.js.
*/
/* ═══ Silent Exodus · crew sprites v2 · the shared engine ══════════════════════════════════════════════════════════
   Spec: docs/CREW_SPRITES.md (v2). Review page: prototypes/screens/crew-hires/crew.html. Load order: CrewEngine.js,
   then the person files (Cora.js Jaxon.js Aris.js Vance.js Mira.js).

   A person is a hand-drawn head (one pixel map per view) placed on a small lit "clay" body that this engine poses.
   Every frame is baked once to whole pixels in a 48 × 104 cell and cached. Nothing is ever drawn at screen resolution.

   ── API: window.CrewEngine ────────────────────────────────────────────────────────────────────────────────────────
   SIZE     { w: 48, h: 104, ground: 101, hipX: 24, scale: 2 }   feet stand on row 101, column 24 is under the hips,
                                                                 sprites face right (left is a mirror), shown at 2×
   INK      '#05070a'                                            every ramp starts with it
   ACTIONS  frozen. { frames, ms } per action (ms is one number, or one per frame), plus the action's fixed numbers:
            walk.move, carry.move   px a frame the caller moves the sprite (the planted foot stays put)
            console.desk 54         desk top, rows above the floor; console.reach 14: hands, columns in front of x
            climb.rise 4            rows a frame the caller raises the sprite; climb.rung 8, climb.firstRung 6:
                                    rungs sit at floorY - firstRung - k * rung (world rows), k = 0, 1, 2 …
            sit.seat 22             seat top, rows above the floor; the hips are over x + sit.hipX
            tend.hipX, tend.hands   hips over x + hipX; hands work at about row `hands` (patient's chest)
            wall.reach 13           the bulkhead face is at x + reach (facing right)
            sleep.w × sleep.h       the lying cell (104 × 48); x = the hips, floorY = the mattress top
   register(person)                  called once by each person file (shape below)
   frameAt(action, ms)               the frame that plays at time ms
   sprite(id, action, frame, { blink, warm, rim, screen })
        → { canvas, w, h, origin: { x, y }, neck: { x, y }, hands: [{ x, y }, { x, y }] }, baked once, cached.
          rim is in sprite space here (+1 = the side the sprite faces). screen defaults to true for console.
          origin is the cell point that lands on (x, floorY) when drawn.
   draw(ctx, id, action, ms, x, floorY, { facing: 1 | -1, warm: 0..3, rim: -1 | 0 | 1, seed })
        draws on a canvas whose 1 unit = 1 art pixel (scale the context by whole numbers; smoothing off).
          rim is in screen space here (+1 = the lamp is to the right). seed staggers blinks between people.
   sheet(id)                         one canvas (1 unit = 1 art pixel) with every action and frame, rows in ACTIONS order
   people()                          review helper: [{ id, name, role, portrait, signature, placeholder }] in load order

   ── A person file (one call, nothing else) ───────────────────────────────────────────────────────────────────────
   CrewEngine.register({
     id, name, role, portrait, signature, placeholder?,
     ramps:  { suit: [INK, …], boot, skin, hair, … },   5 to 8 colours, darkest first, each starting at INK.
             'crate' is supplied by the engine. A material whose tex is 0 is a flat accent (trim, lights): no noise,
             no lit edge.
     tex:    { suit: 0.07, skin: 0.03, trim: 0 },        texture strength per material, 0 to 0.2
     build:  { idle: 'hang' | 'behind' | 'hips' | 'crossed', thigh, shin, arm, fore: [top, bottom] radii,
               hand, foot, toe, upper, lower (arm bone lengths), pelvis, waist, chest: [depth, height, bulge],
               sh: [r, ry], shX: [near, far], shY, neckY, chestY, waistY (rows from the hip), stanceX: [near, far],
               lift (walk foot lift), backW (shoulder half-width seen from behind), pack, bust },
             Leg bones are the engine's (thigh 23, shin 22.5) and the same for everyone.
     materials: { thigh, leg, foot, arm, forearm, hand, pelvis, waist, chest, shoulder, pack }
             each a ramp name, or a function (u, v) => ramp name. On a limb u is 0..1 from the joint to the end;
             on a body oval u, v are pixels from its centre (v down).
     heads:  { front, down, back, lying }: { anchor: [col, row], keys: { a: '#hex' }, map: ['....'], blink: { E: '#hex' } }
             anchor = the map pixel that sits on the neck point (the bottom of the collar). down/back/lying may omit
             keys and blink to reuse front's. Missing views fall back: down → front, back → a hair-only back made from
             ramps.hair, lying → front turned on its side with the blink colours. No heads at all → a placeholder.
             Views: front (idle walk sit carry), down (console tend wall), back (climb), lying (sleep, drawn in the
             lying cell: head to the left, face up).
     decorate(api, P) optional, after the body is lit and before the head. P: { action, frame, view 'side'|'back',
             lying, hip, lean, up(dy), neck, shN, shF, legs: [{ h, knee, ankle, part }], arms: [{ s, el, wr, part }],
             build }. Coordinates are the standing cell's, facing right (sleep is turned afterwards).
             api: W, H, INK, ramps, lerp, mix, part(x, y), get(x, y), set(x, y, hex|null), light(x, y),
                  paint(x, y, ramp, step) (recolour keeping the light), shade(ramp, light, x, y)
     fixes:  { 'walk/3': [[x, y, '#hex' | null]] }  last-resort pixel patches on a baked frame, in the final cell
             (the lying cell for sleep), before screen light, lamp edge and warmth.
   });
   Rules: a person never changes frames, timing or positions. If the same fix is needed twice, the engine is wrong.
*/
(function (root) {
    'use strict';
    if (root.MiniCrewEngine) return;               // loaded twice: keep the first (the people below register into it again, harmlessly)

    // ── constants ────────────────────────────────────────────────────────────────────────────────────────────────────
    const INK = '#05070a';
    const SW = 48, SH = 104, GROUND = 101, FLOOR = GROUND + 1, ANKLE = 99, HIPY = 53.3, HIPX = 24, THIGH = 23, SHIN = 22.5;
    const SIZE = Object.freeze({ w: SW, h: SH, ground: GROUND, hipX: HIPX, scale: 2 });
    const LIGHT = unit([0.5, -0.62, 0.6]);                 // key light: above and in front of the face
    const LIGHT_LYING = unit([0.62, 0.5, 0.6]);            // the same light, for a body that is turned to lie down
    const SCREEN = '#7fe0e6', LAMP_EDGE = '#f5b26b', LAMP_WARM = '#f0a860';
    const ENGINE_RAMPS = { crate: [INK, '#111715', '#1b2420', '#27322d', '#36433d', '#4c5b54', '#6c7d74'] };
    const CRATE_LABEL = '#a89a70';
    const B8 = [[0, 32, 8, 40, 2, 34, 10, 42], [48, 16, 56, 24, 50, 18, 58, 26], [12, 44, 4, 36, 14, 46, 6, 38], [60, 28, 52, 20, 62, 30, 54, 22],
                [3, 35, 11, 43, 1, 33, 9, 41], [51, 19, 59, 27, 49, 17, 57, 25], [15, 47, 7, 39, 13, 45, 5, 37], [63, 31, 55, 23, 61, 29, 53, 21]];

    function deepFreeze(o) { Object.values(o).forEach(v => { if (v && typeof v === 'object') deepFreeze(v); }); return Object.freeze(o); }
    const ACTIONS = deepFreeze({
        idle:    { frames: 4, ms: [700, 800, 900, 800], head: 'front' },
        walk:    { frames: 8, ms: 115, move: 6, head: 'front' },
        console: { frames: 4, ms: 190, head: 'down', desk: 54, reach: 14 },
        climb:   { frames: 4, ms: 110, head: 'back', rise: 4, rung: 8, firstRung: 6 },
        sit:     { frames: 2, ms: 1100, head: 'front', seat: 22, hipX: -4 },
        sleep:   { frames: 2, ms: 1400, head: 'lying', w: SH, h: SW, bed: 40 },
        tend:    { frames: 4, ms: 280, head: 'down', hipX: -10, hands: 91 },
        carry:   { frames: 8, ms: 130, move: 3, head: 'front' },
        wall:    { frames: 4, ms: 1300, head: 'down', reach: 18 },
    });

    // ── small helpers ────────────────────────────────────────────────────────────────────────────────────────────────
    function unit(v) { const n = Math.hypot(...v) || 1; return v.map(x => x / n); }
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const lerp = (a, b, t) => a + (b - a) * t;
    const v2 = (x, y) => ({ x, y });
    const bay = (x, y) => (B8[y & 7][x & 7] + 0.5) / 64;
    function hash2(x, y, s) {
        let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 362437)) | 0;
        h = Math.imul(h ^ (h >>> 13), 1274126177);
        return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    }
    function vnoise(x, y, s) {
        const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
        const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
        const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
        return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    }
    const rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const toHex = (r, g, b) => '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
    function mix(h1, h2, t) { const a = rgb(h1), b = rgb(h2); return toHex(lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)); }

    /** Two-bone reach in the picture plane: the middle joint between root and target; bend +1 / -1 picks the side. */
    function ik(root, target, l1, l2, bend) {
        let dx = target.x - root.x, dy = target.y - root.y; const d = Math.hypot(dx, dy);
        const dd = clamp(d, Math.abs(l1 - l2) + 0.01, (l1 + l2) * 0.999);
        dx /= d || 1; dy /= d || 1;
        const a = (l1 * l1 - l2 * l2 + dd * dd) / (2 * dd), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
        return { joint: v2(root.x + dx * a - dy * h * bend, root.y + dy * a + dx * h * bend), end: v2(root.x + dx * dd, root.y + dy * dd) };
    }
    /** The same reach in 3D (target in the picture plane), bending toward `pref` {x, y, z}: z < 0 is into the wall. */
    function ik3(root, target, l1, l2, pref) {
        let dx = target.x - root.x, dy = target.y - root.y; const d = Math.hypot(dx, dy);
        const dd = clamp(d, Math.abs(l1 - l2) + 0.01, (l1 + l2) * 0.999);
        dx /= d || 1; dy /= d || 1;
        const dot = pref.x * dx + pref.y * dy; let px = pref.x - dot * dx, py = pref.y - dot * dy, pz = pref.z;
        const pn = Math.hypot(px, py, pz) || 1; px /= pn; py /= pn; pz /= pn;
        const a = (l1 * l1 - l2 * l2 + dd * dd) / (2 * dd), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
        return { joint: v2(root.x + dx * a + px * h, root.y + dy * a + py * h), z: pz * h, end: v2(root.x + dx * dd, root.y + dy * dd) };
    }

    // ── people ───────────────────────────────────────────────────────────────────────────────────────────────────────
    const PEOPLE = new Map();
    const DEFAULT_BUILD = Object.freeze({
        idle: 'hang', lift: 5, thigh: [4, 3], shin: [3, 2.2], foot: 1.8, toe: 4.5, arm: [2.3, 2], fore: [2, 1.6], hand: 1.8,
        upper: 15, lower: 13.5, pelvis: [6.4, 5.6, 5.4], waist: [5.6, 6, 5], chest: [7.4, 9.2, 6.2], sh: [3.5, 3.2],
        shX: [-4.2, 5], shY: -26.5, neckY: -28, chestY: -19.5, waistY: -9.2, stanceX: [-3.5, 3], backW: 8.5, pack: false, bust: false,
    });
    const DEFAULT_MATERIALS = Object.freeze({
        thigh: 'suit', leg: t => (t > 0.6 ? 'boot' : 'suit'), foot: 'boot', arm: 'suit', forearm: 'suit', hand: 'skin',
        pelvis: 'suit', waist: 'suit', chest: 'suit', shoulder: 'suit', pack: 'suit',
    });

    function register(person) {
        if (!person || typeof person.id !== 'string' || !person.ramps || !person.ramps.suit) {
            console.warn('CrewEngine.register: a person needs an id and ramps.suit', person); return;
        }
        Object.entries(person.ramps).forEach(([k, r]) => { if (!Array.isArray(r) || r[0] !== INK) console.warn(`CrewEngine: ${person.id}.ramps.${k} should start at ${INK}`); });
        const ramps = Object.assign({}, ENGINE_RAMPS, person.ramps);
        const C = Object.freeze(Object.assign({}, person, {
            ramps, build: Object.assign({}, DEFAULT_BUILD, person.build), tex: Object.assign({ crate: 0.04 }, person.tex),
            materials: Object.assign({}, DEFAULT_MATERIALS, person.materials), heads: resolveHeads(person, ramps), fixes: person.fixes || {},
        }));
        PEOPLE.set(C.id, C);
        for (const k of [...cache.keys()]) if (k.startsWith(C.id + '|')) cache.delete(k);
    }

    // A generic head, in the person's own hair, skin and suit colours, for anyone whose heads are not drawn yet.
    const PH_FRONT = ['....bccb.....', '..bccddccb...', '.bcddddddcb..', '.bcdddcccdcb.', 'bccdcc3443cb.', 'bcc2344444c..',
        'bcc34E44E3c..', 'bbc2344443...', 'abc2334443...', 'ab.233443....', 'a..22332.....', '....122......', '....12.......',
        '..kkKKKk.....', '.kKKKKKKk....', '.kKKKKKKKk...'];
    const PH_BACK = ['....bccb.....', '..bccddccb...', '.bcddddddcb..', '.bcddddddcb..', 'bccdddddddcb.', 'bccdddddddcb.',
        'bcccddddcccb.', 'bbcccdcccbbb.', 'abbccccccbba.', 'aabbbcbbbbaa.', '.aaabbbbbaa..', '...a1221a....', '...12222.....',
        '..kkKKKk.....', '.kKKKKKKk....', '.kKKKKKKKk...'];
    function placeholderKeys(ramps) {
        const hair = ramps.hair || ramps.suit, skin = ramps.skin || ramps.suit, suit = ramps.suit, at = (r, i) => r[clamp(i, 0, r.length - 1)];
        return { a: at(hair, 1), b: at(hair, 2), c: at(hair, 3), d: at(hair, 4), 1: at(skin, 1), 2: at(skin, 2), 3: at(skin, 3), 4: at(skin, 4),
            E: at(hair, 1), k: at(suit, 2), K: at(suit, 3) };
    }
    function resolveHeads(person, ramps) {
        const H = person.heads || {};
        const keys = placeholderKeys(ramps);
        const front = H.front || { anchor: [6, 15], keys, map: PH_FRONT, blink: { E: keys[2] }, placeholder: true };
        const inherit = v => v && Object.assign({ keys: front.keys, blink: front.blink || {} }, v);
        const back = inherit(H.back) || { anchor: [6, 15], keys: Object.assign({}, keys, placeholderKeys(ramps)), map: PH_BACK, blink: {}, placeholder: true };
        return Object.freeze({
            front: Object.assign({ blink: {} }, front),
            down: inherit(H.down) || Object.assign({ blink: {} }, front, front.placeholder ? { map: PH_FRONT.map(r => r.replace(/E/g, '2')) } : {}),
            back, lying: inherit(H.lying) || null,
        });
    }

    // ── poses ────────────────────────────────────────────────────────────────────────────────────────────────────────
    // the hips (rows below HIPY): low at contact (frames 0, 4: the legs spread), high at passing (frames 2, 6), where the
    // support leg is straight under the body and the whole figure, head included, rises over the planted foot
    const WALK_BOB = [2, 0.9, -0.5, 0.9, 2, 0.9, -0.5, 0.9], CARRY_BOB = [2, 1, 0, 1, 2, 1, 0, 1];
    // climbing, from behind, hand over hand: one hand up at the face, the other at the shoulder, swapping every two
    // frames. Rungs in the cell this frame are the rows ≡ 4f (mod 8); a gripping hand moves down 4 rows a frame in the
    // cell (it stays put in the world) and jumps two rungs up when it lets go (left at frame 2, right at frame 0).
    const CLIMB_HAND = [[24, 28, 16, 20], [16, 20, 24, 28]], CLIMB_FOOT = [[96, 91, 88, 92], [88, 92, 96, 91]];

    function gait(P, b, A, f, heavy) {
        const n = A.frames, p = f / n, S = A.move * n / 2, lift = b.lift * (heavy ? 0.7 : 1);
        P.hip = v2(HIPX, HIPY + (heavy ? 1 + CARRY_BOB[f] : WALK_BOB[f]));
        P.feet = [0, 0.5].map(off => {
            const q = (p + off) % 1;
            if (q < 0.5) return v2(HIPX + S / 2 - (q / 0.5) * S, ANKLE);
            const s = (q - 0.5) / 0.5;
            return v2(HIPX - S / 2 + S * (0.5 - 0.5 * Math.cos(Math.PI * s)), ANKLE - Math.sin(Math.PI * Math.pow(s, 0.75)) * lift);
        });
        P.lean = heavy ? -0.03 : 0.05;
        if (!heavy) { const sw = Math.cos(2 * Math.PI * p - 0.45); P.hands = { swing: [-0.55 * sw, 0.55 * sw] }; }   // phase-led, so the arms are never both hanging
        else P.crate = true;
    }

    const POSES = {
        idle(P, b, A, f) {
            P.breath = [0, 0.5, 1, 0.5][f]; P.headDy = f === 2 ? -1 : 0;
            P.feet = [v2(HIPX + b.stanceX[0], ANKLE), v2(HIPX + b.stanceX[1], ANKLE)];
        },
        walk(P, b, A, f) { gait(P, b, A, f, false); },
        carry(P, b, A, f) { gait(P, b, A, f, true); },
        console(P, b, A, f) {
            P.feet = [v2(HIPX + b.stanceX[0], ANKLE), v2(HIPX + b.stanceX[1] + 1, ANKLE)];
            P.lean = 0.17; P.headDx = 2; P.headDy = 1;
            const tap = [[0, 0], [-1, 0], [0, -1], [0, 0]][f], deskY = FLOOR - A.desk - 2;
            P.hands = { target: [v2(HIPX + A.reach, deskY + tap[0]), v2(HIPX + A.reach + 3, deskY - 0.5 + tap[1])] };
        },
        climb(P, b, A, f) {
            P.view = 'back'; P.hip = v2(HIPX, HIPY + [0, -1, 0, -1][f]);
            P.hands = { target: [v2(HIPX - 10 + (CLIMB_HAND[0][f] < 20 ? 1 : 0), CLIMB_HAND[0][f] - 0.5), v2(HIPX + 10 - (CLIMB_HAND[1][f] < 20 ? 1 : 0), CLIMB_HAND[1][f] - 0.5)] };
            P.feet = [v2(HIPX - 4, CLIMB_FOOT[0][f]), v2(HIPX + 4, CLIMB_FOOT[1][f])];     // sole rows: the foot rests on the rung
        },
        sit(P, b, A, f) {
            const seat = FLOOR - A.seat;
            P.hip = v2(HIPX + A.hipX, seat - b.thigh[0]); P.lean = -0.02; P.breath = f;
            P.legs = [0, 1].map(i => {
                const knee = v2(P.hip.x + 21 + i, seat - b.thigh[1]);
                return { h: v2(P.hip.x + (i ? 2.4 : -2.2), P.hip.y + (i ? 0 : 0.5)), knee, ankle: v2(knee.x - 2, ANKLE), planted: true };
            });
            const lap = seat - 2 * b.thigh[1] - b.hand;
            P.hands = { target: [v2(P.hip.x + 12, lap + 0.5), v2(P.hip.x + 14.5, lap)] };
        },
        sleep(P, b, A, f) {
            P.lying = true; P.pack = false; P.breath = f; P.stance = 'hang';
            P.feet = [v2(HIPX - 1.5, ANKLE), v2(HIPX + 1.5, ANKLE)];
        },
        tend(P, b, A, f) {
            const hx = HIPX + A.hipX, hy = 80;
            P.hip = v2(hx, hy); P.lean = 0.85 + [0, 0.02, 0, -0.02][f]; P.headDx = -1; P.headDy = 1;
            const kneeN = v2(hx + 1, FLOOR - b.thigh[1] - 0.2), ankN = v2(hx - 9, FLOOR - b.shin[1] - 1.6);
            const kneeF = v2(hx + 2.4 + 22.6, 77), ankF = v2(kneeF.x - 1, ANKLE);
            P.legs = [
                { h: v2(hx - 2.2, hy + 0.5), knee: kneeN, ankle: ankN, foot: { heel: v2(ankN.x - 0.6, ankN.y - 1), toe: v2(ankN.x + 0.6, FLOOR - b.foot * 0.9) } },
                { h: v2(hx + 2.4, hy), knee: kneeF, ankle: ankF, planted: true },
            ];
            const work = [[0, 0, 0, 0], [1, -1, 0, 1], [0, 0, 1, -1], [-1, 1, 0, 0]][f];
            P.hands = { target: [v2(hx + 24 + work[0], A.hands - 1 + work[1]), v2(hx + 27 + work[2], A.hands + work[3])] };
        },
        wall(P, b, A, f) {
            P.feet = [v2(HIPX - 2, ANKLE), v2(HIPX + 2, ANKLE)];
            P.lean = [0.1, 0.12, 0.14, 0.16][f]; P.sink = [0, 0.5, 1, 1.5][f];
            P.headDx = 1; P.headDy = [1, 1, 2, 2][f]; P.stance = 'hang';
            P.flat = { i: 0, x: HIPX + A.reach, dy: [-4, -4, -3, -3][f] };
        },
    };

    function pose(C, action, f) {
        const b = C.build, A = ACTIONS[action];
        const P = { action, frame: f, view: 'side', lying: false, hip: v2(HIPX, HIPY), lean: 0, breath: 0, sink: 0, headDx: 0, headDy: 0,
            feet: null, legs: null, hands: null, flat: null, crate: false, pack: !!b.pack, stance: b.idle, build: b };
        POSES[action](P, b, A, f);
        const up = dy => v2(P.hip.x - Math.sin(P.lean) * dy, P.hip.y + Math.cos(P.lean) * dy);
        P.up = up;
        const sY = b.shY - P.breath * 0.6 + P.sink;
        if (P.view === 'back') {
            P.shN = v2(HIPX - b.backW, up(sY).y); P.shF = v2(HIPX + b.backW, up(sY).y);
            P.neck = v2(HIPX, Math.round(up(b.neckY).y));
        } else {
            P.shN = up(sY); P.shF = up(sY - 0.5); P.shN.x += b.shX[0]; P.shF.x += b.shX[1];
            const n = up(b.neckY + P.sink * 0.5);
            P.neck = v2(Math.round(n.x + 0.5 + P.headDx), Math.round(n.y + P.headDy));
        }
        if (P.flat) {                                                          // a hand flat on the bulkhead
            const y = P.shN.y + P.flat.dy;
            P.hands = { target: [v2(P.flat.x - b.hand * 2, y), null] };
        }
        if (P.crate) {                                                         // the crate sits against the chest
            const c = up(b.chestY);
            P.crate = { x0: Math.round(c.x + b.chest[0] * 0.8 - 1), y0: Math.round(c.y - 4), w: 13, h: 11 };
            const k = P.crate;
            P.hands = { target: [v2(k.x0 + 8, k.y0 + k.h + 0.5), v2(k.x0 + 9.5, k.y0 + k.h - 1)] };
        }
        return P;
    }

    // ── the body: tapered tubes and ovals, z-buffered ───────────────────────────────────────────────────────────────
    function armTarget(P, b, s, i) {
        const hip = P.hip, c = P.up(b.chestY);
        switch (P.stance) {
            case 'behind': return { t: i === 0 ? v2(hip.x - 3.5, hip.y - 4) : v2(hip.x - 3, hip.y - 4.5), bend: 1 };
            case 'hips': return i === 0 ? { t: v2(hip.x - 5, hip.y - 8), bend: 1 } : { t: v2(hip.x + 7, hip.y - 8), bend: -1 };
            case 'crossed': return { t: i === 0 ? v2(c.x + b.chest[0] - 2.5, c.y + 3.5) : v2(c.x + b.chest[0] - 3, c.y + 1.5), bend: 1 };
            default: return { t: v2(s.x + (i === 0 ? 0.6 : 1.4), s.y + b.upper + b.lower - 1.8), bend: 1 };
        }
    }

    function sidePrims(C, P) {
        const b = C.build, M = C.materials, out = [], creases = [];
        const cap = (a, bb, ra, rb, z, mat, part) => out.push({ t: 'c', a, b: bb, ra, rb, z, mat, part });
        const ell = (c, rx, ry, rz, ang, z, mat, part) => out.push({ t: 'e', c, rx, ry, rz, ang, z, mat, part });
        const hipN = v2(P.hip.x - 2.2, P.hip.y + 0.5), hipF = v2(P.hip.x + 2.4, P.hip.y);
        const parts = ['nearLeg', 'farLeg'];
        const legs = (P.legs || [hipN, hipF].map((h, i) => {
            const k = ik(h, P.feet[i], THIGH, SHIN, -1);
            return { h, knee: k.joint, ankle: k.end, target: P.feet[i], planted: P.feet[i].y >= ANKLE - 0.01 };
        })).map((L, i) => Object.assign({ part: parts[i] }, L));
        const behind = !P.hands && P.stance === 'behind';
        const arms = [P.shN, P.shF].map((s, i) => {
            const part = i === 0 ? 'nearArm' : 'farArm';
            const tgt = P.hands && P.hands.target && P.hands.target[i];
            if (tgt) { const k = ik(s, tgt, b.upper, b.lower, 1); return { s, el: k.joint, wr: k.end, part }; }
            if (P.hands && P.hands.swing) {
                const a0 = P.hands.swing[i], a = a0 > 0 ? a0 * 0.6 : a0, bend = 0.15 + Math.max(0, a) * 0.6;   // a short forward swing keeps big hands in the cell
                const el = v2(s.x + Math.sin(a) * b.upper, s.y + Math.cos(a) * b.upper), fa = a + bend;
                return { s, el, wr: v2(el.x + Math.sin(fa) * b.lower, el.y + Math.cos(fa) * b.lower), part };
            }
            const T = armTarget(P, b, s, i), k = ik(s, T.t, b.upper, b.lower, T.bend);
            return { s, el: k.joint, wr: k.end, part };
        });
        const limb = (arm, z, i) => {
            cap(arm.s, arm.el, b.arm[0], b.arm[1], z, M.arm, arm.part);
            const fz = behind ? -6 : z + 0.4;
            cap(arm.el, arm.wr, b.fore[0], b.fore[1], fz, M.forearm, arm.part);
            if (P.flat && P.flat.i === i) {
                ell(v2(P.flat.x - b.hand * 0.8, arm.wr.y - b.hand * 0.5), b.hand * 0.8, b.hand * 1.45, b.hand, 0, fz + 0.6, M.hand, arm.part);
            } else {
                const hd = Math.hypot(arm.wr.x - arm.el.x, arm.wr.y - arm.el.y) || 1;
                const hc = v2(arm.wr.x + (arm.wr.x - arm.el.x) / hd * b.hand * 0.9, arm.wr.y + (arm.wr.y - arm.el.y) / hd * b.hand * 0.9);
                ell(hc, b.hand, b.hand * 1.15, b.hand, Math.atan2(-(arm.wr.x - arm.el.x), arm.wr.y - arm.el.y), fz + 0.6, M.hand, arm.part);
            }
            creases.push({ a: arm.s, j: arm.el, c: arm.wr, r: b.arm[1], part: arm.part });
        };
        const leg = (L, z) => {
            cap(L.h, L.knee, b.thigh[0], b.thigh[1], z, M.thigh, L.part);
            cap(L.knee, L.ankle, b.thigh[1] * 0.98, b.shin[1], z + 0.2, M.leg, L.part);
            let heel, toe;
            if (L.foot) ({ heel, toe } = L.foot);
            else {
                const an = L.planted ? (L.target || L.ankle) : L.ankle, tilt = L.planted ? 0 : -0.18;
                const sole = FLOOR - 0.1 - ANKLE - b.foot;                         // a planted sole sits on row 101
                heel = v2(an.x - 1.2, an.y + sole);
                toe = v2(an.x + b.toe * Math.cos(tilt), an.y + sole + 0.3 + b.toe * Math.sin(-tilt) * 0.6);
            }
            cap(heel, toe, b.foot, b.foot * 0.85, z + 0.5, M.foot, L.part);
            creases.push({ a: L.h, j: L.knee, c: L.ankle, r: b.thigh[1], part: L.part });
        };
        limb(arms[1], -7, 1);
        leg(legs[1], -3);
        const ang = P.lean, br = P.breath, push = P.lying ? br * 0.8 : 0;
        if (P.pack) { const pc = P.up(-19); ell(v2(pc.x - b.chest[0] * 0.9, pc.y), 3.2, b.chest[1] * 0.9, 4, ang, -3.5, M.pack, 'torso'); }
        ell(P.up(-1), b.pelvis[0], b.pelvis[1], b.pelvis[2], ang, 0, M.pelvis, 'torso');
        ell(P.up(b.waistY), b.waist[0], b.waist[1], b.waist[2], ang, 0, M.waist, 'torso');
        const ch = P.up(b.chestY - br * 0.4); ch.x += 0.6 + push;
        ell(ch, b.chest[0] + push * 0.5, b.chest[1] + br * 0.3, b.chest[2], ang, 0, M.chest, 'torso');
        if (b.bust) { const bu = P.up(b.chestY - 1.5 - br * 0.4); bu.x += b.chest[0] - 2.8 + push; ell(bu, 3, 2.7, 2.6, ang, 3.4, M.chest, 'torso'); }
        ell(P.shF, b.sh[0], b.sh[1], b.sh[0], ang, -1, M.shoulder, 'torso');
        if (P.crate) out.push({ t: 'b', x0: P.crate.x0, y0: P.crate.y0, x1: P.crate.x0 + P.crate.w, y1: P.crate.y0 + P.crate.h, z: 6, mat: 'crate', part: 'crate' });
        ell(P.shN, b.sh[0], b.sh[1], b.sh[0], ang, 3, M.shoulder, 'nearArm');
        leg(legs[0], 2.5);
        limb(arms[0], 6.5, 0);
        const w = P.up(b.waistY + 1.5);
        return { list: out, legs, arms, creases, waist: { y: Math.round(w.y), deep: P.lean > 0.3 || P.action === 'sit' } };
    }

    function backPrims(C, P) {
        const b = C.build, M = C.materials, out = [], creases = [];
        const cap = (a, bb, ra, rb, z, mat, part, zb) => out.push({ t: 'c', a, b: bb, ra, rb, z, zb: zb === undefined ? z : zb, mat, part });
        const ell = (c, rx, ry, rz, z, mat, part) => out.push({ t: 'e', c, rx, ry, rz, ang: 0, z, mat, part });
        const cx = P.hip.x, Wp = b.backW * 0.85 + (b.bust ? 0.5 : 0), Ww = b.backW * 0.7, Wc = b.backW * 0.92;
        const legs = [0, 1].map(i => {
            const s = i ? 1 : -1, F = P.feet[i], h = v2(cx + s * Wp * 0.48, P.hip.y + 1.5);
            const ankle = v2(F.x, F.y - b.foot * 1.6), k = ik3(h, ankle, THIGH, SHIN, { x: s * 0.12, y: 0, z: -1 });
            return { h, knee: k.joint, kz: k.z, ankle, sole: F, part: i ? 'legR' : 'legL' };
        });
        const arms = [P.shN, P.shF].map((sh, i) => {
            const s = i ? 1 : -1, k = ik3(sh, P.hands.target[i], b.upper, b.lower, { x: s * 0.3, y: 0.45, z: -1 });
            return { s: sh, el: k.joint, ez: k.z, wr: k.end, part: i ? 'armR' : 'armL' };
        });
        legs.forEach(L => {
            cap(L.h, L.knee, b.thigh[0], b.thigh[1] * 1.08, -1, M.thigh, L.part, -1 + L.kz);
            cap(L.knee, L.ankle, b.thigh[1] * 1.08, b.shin[1], -1 + L.kz, M.leg, L.part, -2);
            ell(v2(L.sole.x, L.sole.y - 0.5 - b.foot), b.foot * 1.15, b.foot, b.foot, -1.5, M.foot, L.part);
            creases.push({ a: L.h, j: L.knee, c: L.ankle, r: b.thigh[1], part: L.part });
        });
        arms.forEach(A => {
            cap(A.s, A.el, b.arm[0], b.arm[1], -0.5, M.arm, A.part, -0.5 + A.ez);
            cap(A.el, A.wr, b.fore[0], b.fore[1], -0.5 + A.ez, M.forearm, A.part, -3);
            ell(v2(A.wr.x, A.wr.y - b.hand * 0.6), b.hand, b.hand * 1.15, b.hand, -3, M.hand, A.part);
            creases.push({ a: A.s, j: A.el, c: A.wr, r: b.arm[1], part: A.part });
        });
        // the back is one tapered form (pelvis → waist → chest) under a shoulder bar, so it reads as a back, not beads
        const pel = v2(cx, P.hip.y - 1), wai = v2(cx, P.up(b.waistY).y), che = v2(cx, P.up(b.chestY - 2).y);
        cap(pel, wai, Wp, Ww, b.pelvis[0] * 0.6, M.pelvis, 'torso');
        cap(wai, che, Ww, Wc, b.waist[0] * 0.6, M.waist, 'torso');
        ell(v2(cx, P.hip.y + 1), Wp, b.pelvis[1] * 0.85, b.pelvis[0] * 0.7, b.pelvis[0] * 0.3, M.pelvis, 'torso');
        cap(P.shN, P.shF, b.sh[0] * 0.95, b.sh[0] * 0.95, b.chest[0] * 0.55, M.shoulder, 'torso');
        if (P.pack) ell(v2(cx, P.up(-19).y), b.backW * 0.75, b.chest[1] * 0.9, 3, b.chest[0], M.pack, 'torso');
        return { list: out, legs, arms, creases, waist: { y: Math.round(P.up(b.waistY + 1.5).y), deep: false } };
    }

    function raster(list, W, H) {
        const N = W * H, z = new Float32Array(N).fill(-1e9), id = new Int16Array(N).fill(-1);
        const nx = new Float32Array(N), ny = new Float32Array(N), nz = new Float32Array(N), tu = new Float32Array(N), tv = new Float32Array(N);
        list.forEach((p, i) => {
            let x0, x1, y0, y1;
            if (p.t === 'c') { const r = Math.max(p.ra, p.rb) + 1; x0 = Math.min(p.a.x, p.b.x) - r; x1 = Math.max(p.a.x, p.b.x) + r; y0 = Math.min(p.a.y, p.b.y) - r; y1 = Math.max(p.a.y, p.b.y) + r; }
            else if (p.t === 'e') { const r = Math.max(p.rx, p.ry) + 1; x0 = p.c.x - r; x1 = p.c.x + r; y0 = p.c.y - r; y1 = p.c.y + r; }
            else { x0 = p.x0; x1 = p.x1 - 1; y0 = p.y0; y1 = p.y1 - 1; }
            for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(H - 1, Math.ceil(y1)); y++) {
                for (let x = Math.max(0, Math.floor(x0)); x <= Math.min(W - 1, Math.ceil(x1)); x++) {
                    const px = x + 0.5, py = y + 0.5;
                    let h, n0, n1, n2, u, v, zb = p.z;
                    if (p.t === 'c') {
                        const ax = p.b.x - p.a.x, ay = p.b.y - p.a.y, len2 = ax * ax + ay * ay || 1, len = Math.sqrt(len2);
                        const t = clamp(((px - p.a.x) * ax + (py - p.a.y) * ay) / len2, 0, 1);
                        const dx = px - (p.a.x + ax * t), dy = py - (p.a.y + ay * t), d = Math.hypot(dx, dy), r = lerp(p.ra, p.rb, t);
                        if (d > r) continue;
                        h = Math.sqrt(r * r - d * d); n0 = dx / r; n1 = dy / r; n2 = h / r; u = t; v = (dx * -ay + dy * ax) / len;
                        if (p.zb !== undefined) zb = lerp(p.z, p.zb, t);
                    } else if (p.t === 'e') {
                        const ca = Math.cos(p.ang), sa = Math.sin(p.ang), dx = px - p.c.x, dy = py - p.c.y;
                        const lu = ca * dx + sa * dy, lv = -sa * dx + ca * dy, q = (lu / p.rx) ** 2 + (lv / p.ry) ** 2;
                        if (q > 1) continue;
                        h = p.rz * Math.sqrt(1 - q);
                        let a = lu / (p.rx * p.rx), bb = lv / (p.ry * p.ry), c = h / (p.rz * p.rz); const m = Math.hypot(a, bb, c) || 1;
                        a /= m; bb /= m; c /= m; n0 = ca * a - sa * bb; n1 = sa * a + ca * bb; n2 = c; u = lu; v = lv;
                    } else {                                                       // a box seen face on, with bevelled edges
                        u = x - p.x0; v = y - p.y0; h = 1;
                        const e = [v === 0 ? [0, -0.8] : null, x === p.x1 - 1 ? [0.75, 0] : null, x === p.x0 ? [-0.75, 0] : null, y === p.y1 - 1 ? [0, 0.75] : null].find(Boolean) || [0, 0];
                        n0 = e[0]; n1 = e[1]; n2 = Math.sqrt(1 - n0 * n0 - n1 * n1);
                    }
                    const k = y * W + x, zz = zb + h;
                    if (zz > z[k]) { z[k] = zz; id[k] = i; nx[k] = n0; ny[k] = n1; nz[k] = n2; tu[k] = u; tv[k] = v; }
                }
            }
        });
        return { z, id, nx, ny, nz, tu, tv, W, H };
    }

    // ── light: shade, edges, creases ─────────────────────────────────────────────────────────────────────────────────
    function shadeBody(C, list, R, L, litDirs) {
        const { W, H } = R, N = W * H, rampOf = m => C.ramps[m] || C.ramps.suit;
        const mats = new Array(N).fill(null), idxs = new Int8Array(N), lums = new Float32Array(N);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const k = y * W + x, i = R.id[k];
            if (i < 0) continue;
            const p = list[i], d = R.nx[k] * L[0] + R.ny[k] * L[1] + R.nz[k] * L[2];
            let lum = (0.1 + 0.9 * Math.max(0, (d + 0.22) / 1.22)) * (1 - 0.2 * (y / H));
            for (const [ox, oy] of [[1, 0], [-1, 0], [0, -1], [0, 1]]) {     // a nearer part leaves a soft shadow line
                const xx = x + ox, yy = y + oy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
                const j = R.id[yy * W + xx];
                if (j >= 0 && list[j].part !== p.part && R.z[yy * W + xx] > R.z[k] + 1.4) { lum *= 0.62; break; }
            }
            const mat = typeof p.mat === 'function' ? p.mat(R.tu[k], R.tv[k]) : p.mat;
            lum += (vnoise(R.tu[k] * (p.t === 'c' ? 5 : 0.5) + i * 7.3, R.tv[k] * 0.55, 11) - 0.5) * (C.tex[mat] || 0) * 2;
            const n = rampOf(mat).length - 1;
            mats[k] = mat; lums[k] = clamp(lum, 0, 1);
            idxs[k] = clamp(Math.round(lum * n + (bay(x, y) - 0.5) * 0.75), 1, n);
        }
        // a lit edge where the form turns toward the light, a dark one on the far edge (flat accents keep theirs)
        const empty = (x, y) => x < 0 || y < 0 || x >= W || y >= H || R.id[y * W + x] < 0;
        const adj = new Int8Array(N);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const k = y * W + x; if (!mats[k]) continue;
            const n = rampOf(mats[k]).length - 1;
            if (litDirs.some(([dx, dy]) => empty(x + dx, y + dy)) && idxs[k] >= n * 0.45 && C.tex[mats[k]] !== 0) adj[k] = 1;
            else if (empty(x - 1, y) && idxs[k] > 1) adj[k] = -1;
        }
        for (let k = 0; k < N; k++) if (mats[k]) idxs[k] = clamp(idxs[k] + adj[k], 1, rampOf(mats[k]).length - 1);
        // lone pixels join their neighbours, so clusters read as brush marks, not noise
        const snap = Int8Array.from(idxs);
        for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
            const k = y * W + x; if (!mats[k]) continue;
            if ([k - 1, k + 1, k - W, k + W].every(j => mats[j] === mats[k] && snap[j] === snap[k - 1]) && snap[k] !== snap[k - 1]) idxs[k] = snap[k - 1];
        }
        return { mats, idxs, lums, rampOf };
    }

    // dark folds: behind a bent knee, inside a bent elbow, and at the waist, so the body stops reading as a figurine
    function creaseBody(S, R, list, pr) {
        const { W, H } = R;
        const partAt = (x, y) => (x >= 0 && y >= 0 && x < W && y < H && R.id[y * W + x] >= 0) ? list[R.id[y * W + x]].part : null;
        const darken = (x, y, part, step) => { const k = y * W + x; if (partAt(x, y) === part && S.mats[k] && S.idxs[k] > 1) S.idxs[k] = Math.max(1, S.idxs[k] - step); };
        for (const c of pr.creases) {
            const ax = c.a.x - c.j.x, ay = c.a.y - c.j.y, bx = c.c.x - c.j.x, by = c.c.y - c.j.y;
            const la = Math.hypot(ax, ay) || 1, lb = Math.hypot(bx, by) || 1;
            const bend = Math.PI - Math.acos(clamp((ax * bx + ay * by) / (la * lb), -1, 1));
            if (bend < 0.4) continue;
            let ix = ax / la + bx / lb, iy = ay / la + by / lb; const il = Math.hypot(ix, iy) || 1; ix /= il; iy /= il;
            const step = bend > 1.1 ? 2 : 1;
            for (let s = 0.35; s <= 1.05; s += 0.35) darken(Math.floor(c.j.x + ix * c.r * s * 1.6), Math.floor(c.j.y + iy * c.r * s * 1.6), c.part, s > 0.9 ? step : 1);
        }
        const y = pr.waist.y;                                                   // the waist: a fold just inside each edge
        let x0 = -1, x1 = -1;
        for (let x = 0; x < W; x++) if (partAt(x, y) === 'torso') { if (x0 < 0) x0 = x; x1 = x; }
        if (x0 >= 0 && x1 - x0 > 5) {
            darken(x0 + 1, y, 'torso', 1); darken(x1 - 1, y, 'torso', pr.waist.deep ? 2 : 1);
            if (pr.waist.deep) { darken(x1 - 2, y + 1, 'torso', 1); darken(x1 - 1, y - 1, 'torso', 1); }
        }
    }

    function crateDetail(out, R, list, P, C) {
        if (!P.crate) return;
        const k = P.crate, ramp = C.ramps.crate, put = (x, y, hex) => { if (x >= 0 && y >= 0 && x < R.W && y < R.H && R.id[y * R.W + x] >= 0 && list[R.id[y * R.W + x]].part === 'crate') out[y * R.W + x] = hex; };
        for (let x = k.x0 + 1; x < k.x0 + k.w - 1; x++) put(x, k.y0 + 4, ramp[2]);                 // a strap
        for (let y = k.y0 + 6; y < k.y0 + 9; y++) for (let x = k.x0 + 7; x < k.x0 + 11; x++) put(x, y, y === k.y0 + 6 ? mix(CRATE_LABEL, '#fff4d6', 0.3) : CRATE_LABEL);
        put(k.x0 + 8, k.y0 + 7, ramp[3]); put(k.x0 + 2, k.y0 + 2, ramp[6]); put(k.x0 + k.w - 3, k.y0 + 2, ramp[5]);
    }

    // ── heads ────────────────────────────────────────────────────────────────────────────────────────────────────────
    function pasteHead(H, at, out, W, Hh, blink) {
        const ox = at.x - H.anchor[0], oy = at.y - H.anchor[1];
        H.map.forEach((row, r) => { for (let c = 0; c < row.length; c++) {
            const ch = row[c]; if (!(ch in H.keys)) continue;
            const x = ox + c, y = oy + r; if (x < 0 || y < 0 || x >= W || y >= Hh) continue;
            out[y * W + x] = (blink && H.blink[ch]) || H.keys[ch];
        } });
    }

    // ── post light: the console screen, the lamp edge, the lamp warmth ──────────────────────────────────────────────
    function screenLight(out, W, H) {
        for (let y = 0; y < Math.min(H, 70); y++) {
            let seen = 0;
            for (let x = W - 1; x >= 0 && seen < 3; x--) { const k = y * W + x; if (!out[k]) continue; out[k] = mix(out[k], SCREEN, [0.42, 0.22, 0.1][seen] * (y < 30 ? 1 : 0.8)); seen++; }
        }
    }
    function lampEdge(out, W, H, side, rows) {
        for (let y = 0; y < H; y++) {
            if (rows && !rows(y)) continue;
            const xs = side > 0 ? [W - 1, -1, -1] : [0, W, 1];
            for (let x = xs[0]; x !== xs[1]; x += xs[2]) { const k = y * W + x; if (out[k]) { out[k] = mix(out[k], LAMP_EDGE, 0.42); break; } }
        }
    }
    function lampWarm(out, warm) {
        for (let k = 0; k < out.length; k++) if (out[k]) { const [r, g, b] = rgb(out[k]); out[k] = mix(out[k], LAMP_WARM, warm * 0.04 * (r + g + b) / 765); }
    }

    // ── baking ───────────────────────────────────────────────────────────────────────────────────────────────────────
    function bake(C, action, f, o) {
        const P = pose(C, action, f), W = SW, H = SH;
        const pr = P.view === 'back' ? backPrims(C, P) : sidePrims(C, P);
        P.legs = pr.legs; P.arms = pr.arms;
        const R = raster(pr.list, W, H);
        const S = shadeBody(C, pr.list, R, P.lying ? LIGHT_LYING : LIGHT, P.lying ? [[1, 0], [0, 1]] : [[1, 0], [0, -1]]);
        creaseBody(S, R, pr.list, pr);
        let out = new Array(W * H).fill(null);
        for (let k = 0; k < W * H; k++) if (S.mats[k]) out[k] = S.rampOf(S.mats[k])[S.idxs[k]];
        crateDetail(out, R, pr.list, P, C);
        if (typeof C.decorate === 'function') C.decorate(decorateApi(C, R, pr.list, S, out), P);
        let hands = pr.arms.map(a => v2(Math.round(a.wr.x), Math.round(a.wr.y))), neck = v2(P.neck.x, P.neck.y);
        let origin = v2(HIPX, FLOOR), cw = W, chh = H;
        if (P.lying) {
            if (!C.heads.lying) pasteHead(C.heads.front, P.neck, out, W, H, true);
            const L = layDown(out, W, H, ACTIONS.sleep.bed);
            out = L.out; cw = L.w; chh = L.h;
            const turn = p => v2(p.y, W - 1 - p.x + L.dy);
            neck = turn(neck); hands = hands.map(turn); origin = v2(Math.round(HIPY), ACTIONS.sleep.bed);
            if (C.heads.lying) pasteHead(C.heads.lying, neck, out, cw, chh, false);
        } else {
            pasteHead(C.heads[ACTIONS[action].head] || C.heads.front, P.neck, out, W, H, o.blink);
        }
        (C.fixes[action + '/' + f] || []).forEach(([x, y, hex]) => { if (x >= 0 && y >= 0 && x < cw && y < chh) out[y * cw + x] = hex || null; });
        if (o.screen) screenLight(out, cw, chh);
        // the warm edge catches the head, the shoulder and the hip; a full-length stripe down a dark back read as a seam
        const band = P.lying ? null : y => y <= neck.y + 7 || Math.abs(y - P.hip.y) <= 4;
        if (o.rim) lampEdge(out, cw, chh, o.rim, band);
        if (o.warm) lampWarm(out, o.warm);
        return { out, w: cw, h: chh, origin, neck, hands };
    }

    // turn a standing frame to lie on its back, head to the left, and rest its lowest row on the bed line
    function layDown(src, W, H, bed) {
        const w = H, h = W, out = new Array(w * h).fill(null);
        let low = 0;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (src[y * W + x]) low = Math.max(low, W - 1 - x);
        const dy = (bed - 1) - low;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const c = src[y * W + x]; if (!c) continue;
            const X = y, Y = W - 1 - x + dy; if (Y >= 0 && Y < h) out[Y * w + X] = c;
        }
        return { out, w, h, dy };
    }

    function decorateApi(C, R, list, S, out) {
        const W = R.W, H = R.H, inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
        const shade = (mat, light, x, y) => { const r = C.ramps[mat] || C.ramps.suit, n = r.length - 1; return r[clamp(Math.round(light * n + (bay(x & 7, y & 7) - 0.5) * 0.75), 1, n)]; };
        return {
            W, H, INK, ramps: C.ramps, lerp, mix,
            part: (x, y) => (inside(x, y) && R.id[y * W + x] >= 0 ? list[R.id[y * W + x]].part : null),
            get: (x, y) => (inside(x, y) ? out[y * W + x] : null),
            set: (x, y, hex) => { if (inside(x, y)) out[y * W + x] = hex; },
            light: (x, y) => (inside(x, y) && S.mats[y * W + x] ? S.lums[y * W + x] : null),
            paint: (x, y, mat, step = 0) => {
                if (!inside(x, y) || !S.mats[y * W + x]) return;
                const r = C.ramps[mat] || C.ramps.suit, n = r.length - 1, k = y * W + x;
                out[k] = r[clamp(Math.round(S.lums[k] * n + (bay(x, y) - 0.5) * 0.75) + step, 1, n)];
            },
            shade,
        };
    }

    const cache = new Map();
    function makeCanvas(w, h) {
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return cv;
    }
    function sprite(id, action, frame, opts = {}) {
        const C = PEOPLE.get(id), A = ACTIONS[action];
        if (!C || !A) throw new Error(`CrewEngine.sprite: unknown ${!C ? 'person ' + id : 'action ' + action}`);
        const f = ((frame % A.frames) + A.frames) % A.frames;
        const o = { blink: !!opts.blink && action !== 'climb', warm: clamp(Math.round(opts.warm || 0), 0, 3), rim: Math.sign(opts.rim || 0),
            screen: opts.screen === undefined ? action === 'console' : !!opts.screen };
        const key = [id, action, f, +o.blink, o.warm, o.rim, +o.screen].join('|');
        if (cache.has(key)) return cache.get(key);
        const B = bake(C, action, f, o);
        const canvas = makeCanvas(B.w, B.h), cx = canvas.getContext('2d'), img = cx.createImageData(B.w, B.h);
        B.out.forEach((hex, k) => { if (!hex) return; const [r, g, b] = rgb(hex); img.data[k * 4] = r; img.data[k * 4 + 1] = g; img.data[k * 4 + 2] = b; img.data[k * 4 + 3] = 255; });
        cx.putImageData(img, 0, 0);
        const S = Object.freeze({ canvas, w: B.w, h: B.h, origin: B.origin, neck: B.neck, hands: B.hands });
        cache.set(key, S);
        return S;
    }

    function frameAt(action, ms) {
        const A = ACTIONS[action]; if (!A) return 0;
        const t = Math.max(0, ms);
        if (Array.isArray(A.ms)) {
            const tot = A.ms.reduce((a, b) => a + b, 0); let m = t % tot;
            for (let i = 0; i < A.ms.length; i++) { if (m < A.ms[i]) return i; m -= A.ms[i]; }
            return 0;
        }
        return Math.floor(t / A.ms) % A.frames;
    }
    const blinking = (ms, seed) => ((ms + seed * 1700) % 4300) < 140;

    function draw(ctx, id, action, ms, x, floorY, opts = {}) {
        const facing = opts.facing < 0 ? -1 : 1;
        const S = sprite(id, action, frameAt(action, ms), { blink: action !== 'sleep' && blinking(ms, opts.seed || 0), warm: opts.warm, rim: (opts.rim || 0) * facing });
        const X = Math.round(x), Y = Math.round(floorY) - S.origin.y;
        if (facing > 0) ctx.drawImage(S.canvas, X - S.origin.x, Y);
        else { ctx.save(); ctx.translate(X + 1, 0); ctx.scale(-1, 1); ctx.drawImage(S.canvas, -S.origin.x, Y); ctx.restore(); }
        return S;
    }

    function sheet(id) {
        const names = Object.keys(ACTIONS), CW = SW + 4, CH = SH + 6;
        const rows = names.map(a => ({ a, w: ACTIONS[a].head === 'lying' ? ACTIONS[a].w + 4 : CW, h: ACTIONS[a].head === 'lying' ? ACTIONS[a].h + 6 : CH }));
        const width = Math.max(...rows.map(r => r.w * ACTIONS[r.a].frames)), height = rows.reduce((s, r) => s + r.h, 0);
        const cv = makeCanvas(width, height), cx = cv.getContext('2d');
        cx.fillStyle = '#0b0f14'; cx.fillRect(0, 0, width, height);
        let y = 0;
        rows.forEach((r, ri) => {
            for (let f = 0; f < ACTIONS[r.a].frames; f++) {
                cx.fillStyle = (f + ri) % 2 ? '#0e141b' : '#111922'; cx.fillRect(f * r.w, y, r.w, r.h);
                const S = sprite(id, r.a, f);
                cx.fillStyle = '#1c2731'; cx.fillRect(f * r.w, y + r.h - 3, r.w, 1);
                cx.drawImage(S.canvas, f * r.w + 2, y + r.h - 3 - S.origin.y);
            }
            y += r.h;
        });
        return cv;
    }

    /** Review helper: who is registered, in load order, with what the review page shows beside them. */
    function people() {
        return Object.freeze([...PEOPLE.values()].map(C => Object.freeze({ id: C.id, name: C.name || C.id, role: C.role || '', portrait: C.portrait || '',
            signature: C.signature || '', placeholder: !!C.placeholder || !!C.heads.front.placeholder })));
    }

    root.MiniCrewEngine = Object.freeze({ SIZE, INK, ACTIONS, register, frameAt, sprite, draw, sheet, people });
})(typeof window !== 'undefined' ? window : globalThis);


/* Silent Exodus · new screen (?new=1) · crew/Cora.js: Cora's sprite (heads, ramps, build). Calls CrewEngine.register
   once. Source: prototypes/screens/crew-hires/cora.js, ported unchanged ('use strict' added). Load after CrewEngine.js. */
/* CORA, commander, the player. Portrait: assets/crew/F_1.png.
   Read at a glance: a silver-white bob, rounded on top and cut dead straight at the jaw, with a heavy straight fringe
   down to the eyes; mint light on the crown, lavender in the shadows. Pale warm skin, teal eyes, faint cyan lines on the
   near cheek, a small grey implant at the temple. A black high collar right up to the jaw, cyan trim down its edge and the
   front of the suit, cyan cuffs. Slight, tall and upright; she stands with her hands clasped behind her back. */
(function (E) {
    'use strict';
    const INK = E.INK;
    const SUIT = [INK, '#11161d', '#1b222b', '#262f38', '#323c47', '#45515e', '#5f6c7e'];   // cool blue-black slate
    // the head's own keys: hair, skin, eyes and collar, sampled from the portrait and warmed for the dark ship
    const HAIR = { a: '#2e2c40', b: '#4f4c68', c: '#8f8aa8', d: '#b0b2c6', e: '#ccd6dc', f: '#e0ece8', g: '#f2fff6' };   // lavender-grey shadow, mint light
    const SKIN = { 1: '#4a2a36', 2: '#84505a', 3: '#b27c74', 4: '#d2a28a', 5: '#e6c2a4', 6: '#f2d8bc' };
    const FACE = { L: '#241226', E: '#3fc4c0', I: '#1d3f4c', m: '#c2606c', n: '#8a3a4e', C: '#5ff2cf', D: '#8a98aa', G: '#7ff5da' };
    const COLLAR = { k: SUIT[1], K: SUIT[2], J: SUIT[3], t: '#1a7f72', T: '#5ff2cf' };
    const KEYS = Object.assign({}, HAIR, SKIN, FACE, COLLAR);
    const BLINK = { L: '#6a3a48', E: '#d2a28a', I: '#b27c74' };            // shut: the lash line becomes a lid, the iris skin

    const FRONT = [
        '.....abccdcb.....',
        '...abcddeffeb....',
        '..abcdeefggfeb...',
        '.abcdeefgggffeb..',
        '.abcdedeffgffedb.',
        '.abcdcdedefededcb',
        '.abccdcdcddcdcdcb',
        '.abcc3LL344LL3dcb',
        '.abcD45E555E54dcb',
        '.abccC45554554dc.',
        '.abccC44553554dc.',
        '.abccC3445mm43dc.',
        '.abccC34454432cb.',
        '.abcdc2344443ccb.',
        '..abcdc123432cb..',
        '...aabkKJJt......',
        '.....kKKJJJt.....',
        '....kKKJJJJJt....',
        '...kKJJJJJJKt....',
    ];
    const DOWN = ['.'.repeat(17), ...FRONT.slice(0, 14), ...FRONT.slice(15)].map(r => r.replace(/5E/g, '4L').replace(/E5/g, 'L4'));

    E.register({
        id: 'cora', name: 'Cora', role: 'Commander · the player', portrait: '../../../assets/crew/F_1.png',
        signature: 'Silver-white bob cut straight at the jaw, heavy straight fringe to the eyes, teal eyes, faint cyan lines on the near cheek. Black high-collar suit with cyan trim and cuffs. Tall, slight, upright; hands clasped behind her back.',
        ramps: {
            suit: SUIT,
            boot: [INK, '#0d1116', '#161c23', '#212931', '#2e3842', '#3f4a55'],
            skin: [INK, '#4a2a36', '#84505a', '#b27c74', '#d2a28a', '#e6c2a4'],
            trim: [INK, '#0d3a38', '#1a7f72', '#2fcdb0', '#7ff5da'],
            pad:  [INK, '#161c23', '#232b34', '#323c47', '#46525e', '#5e6c78', '#7a8a96'],
            hair: [INK, '#353349', '#575570', '#7d7f9a', '#a2abbd', '#c0d0d4', '#d6ece2'],
        },
        tex: { suit: 0.06, boot: 0.05, skin: 0.03, pad: 0.04, trim: 0 },
        build: { idle: 'behind', lift: 4.5, thigh: [4.2, 3.0], shin: [2.9, 2.0], foot: 1.6, toe: 4.2,
                 arm: [2.05, 1.7], fore: [1.75, 1.3], hand: 1.55, upper: 14.5, lower: 13,
                 pelvis: [6.1, 5.6, 5.2], waist: [4.7, 5.8, 4.5], chest: [6.4, 8.6, 5.6], bust: true,
                 sh: [3.3, 3], shX: [-3.6, 4.2], shY: -25.6, neckY: -27.4, chestY: -18.4, waistY: -9, stanceX: [-2, 2.2], backW: 7.8 },
        materials: {
            leg: t => (t > 0.6 ? 'boot' : 'suit'),
            forearm: t => (t > 0.86 ? 'trim' : 'suit'),                               // the cyan cuff
            shoulder: (u, v) => (v < 0.4 ? 'pad' : 'suit'),                          // a plate over the shoulder, a step lighter
            hand: 'skin',
        },
        heads: {
            front: {                                   // three-quarter, facing right: a 3-tone bob with strand breaks and a
                anchor: [8, 18], keys: KEYS, blink: BLINK,  // curl-in at the jaw, lash bars over teal eyes, the cyan cheek line
                map: FRONT,
            },
            down: { anchor: [8, 18], map: DOWN },     // console, tend, wall: the head drops a row into the collar, lids lowered
            lying: {                                   // asleep on her back, face up in profile, the bob fallen onto the pillow
                anchor: [17, 7], blink: {},
                map: [
                    '..........5.......',
                    '..bcddee.454......',
                    '.bcdeefd3555m4....',
                    'bcdeffe3L455443...',
                    'bcdeeedD4C44432kKK',
                    'bccddddcd344321kJK',
                    'abccdcddcddc21kJJJ',
                    'abccccdccdccb1kJJJ',
                    'abbccccccccccbkJJJ',
                    'aabbcbccccbcccbkKJ',
                    'aabbbbcbbbbcbbbakK',
                    '.aabbbbbbbbbbbbaa.',
                    '..aaabaaabaabaa...',
                ],
            },
            back: {                                    // climbing: the bob from behind, lavender at the sides, strand breaks, cut level
                anchor: [7, 17],
                map: [
                    '....bcdddcb....',
                    '..bcdeeeeedcb..',
                    '.bcdeefgfeedcb.',
                    '.bcdeffgffedcb.',
                    'abcdedefededcba',
                    'abcdcdeedcdccba',
                    'abccdcdedcdccba',
                    'abcccdcdcdcccba',
                    'abccdcdcdccdcba',
                    'abbcccdcdcdccba',
                    'abbcccdcdcccbba',
                    'abbbcccccccbbba',
                    'aabbbbbbbbbbbaa',
                    '.aaaaaaaaaaaaa.',
                    '.....12221.....',
                    '...kKKJJJKKk...',
                    '..kKKJJJJJKKk..',
                    '..kKJJJJJJJKk..',
                ],
            },
        },
        decorate(api, P) {
            const trim = api.ramps.trim, belt = '#0d1116';
            const w = P.up(-4.5), wy = Math.round(w.y);
            for (let x = 0; x < api.W; x++) if (api.part(x, wy) === 'torso') api.set(x, wy, belt);
            if (P.view !== 'side') return;
            const top = P.up(-23), bot = P.up(-3);                                   // the dim cyan seam down the front
            for (let y = Math.round(top.y); y <= Math.round(bot.y); y++) {
                const t = (y - top.y) / (bot.y - top.y), x = Math.round(api.lerp(top.x + 3.4, bot.x + 2.8, t));
                if (api.part(x, y) === 'torso') api.set(x, y, t < 0.1 ? trim[3] : t < 0.3 ? trim[2] : trim[1]);
            }
            const bx = Math.round(w.x + 2.8); if (api.part(bx, wy) === 'torso') api.set(bx, wy, trim[3]);   // the buckle
        },
    });
})(window.MiniCrewEngine);


/* Silent Exodus · new screen (?new=1) · crew/Jaxon.js: Jaxon's sprite (heads, ramps, build). Calls CrewEngine.register
   once. Source: prototypes/screens/crew-hires/jaxon.js, ported unchanged ('use strict' added). Load after CrewEngine.js. */
/* JAXON, engineer. Portrait: assets/crew/M_2.png.
   Read at a glance: near-black hair slicked straight back with clear grey at the temples, a high forehead, calm level
   brows over steady blue-grey eyes, a straight nose, a firm closed mouth, a square jaw with short dark stubble, and a
   little amber warmth on the lit side of the face. A dark work jacket with a standing collar over brown work trousers
   and a tool belt. Heavy, arms crossed.
   Heads (redrawn 2026-10-08 in the construction of Aris and Vance, the approved set: the portrait is a profile, but at
   15 pixels a profile read as a beak and a nub nose, so he faces the camera in three-quarter like them). Revised the
   same day: the stubble stops at the jawline and the neck is mid skin (it read as a beard to the collar), the skin a
   step lighter, the hair a charcoal that holds against the dark with a sheen strand and grey on both temples, and his
   own face (brows straight over the eyes, a longer nose, a squarer jaw). Views: front, down (brows shortened, the lash
   line a row lower, the head into the collar), back (combed lines to the nape, grey over both ears), lying (a true
   profile turned face up, drawn upright and turned in code, with the front's collar). */
(function (E) {
    'use strict';
    const INK = E.INK;
    const KEYS = {
        // hair: charcoal near-black, slicked back, a grey-blue sheen; f the bright strand; g h the grey at the temples
        a: '#161b21', b: '#21272e', c: '#2b323a', d: '#38414a', e: '#4f5b66', f: '#7a8a97', g: '#80878d', h: '#b0b5b8',
        // skin, tanned, lit from the front: 1 the jaw shadow … 6 the light on the nose; o the amber warmth on the lit edge
        1: '#4a2818', 2: '#77432c', 3: '#9e6243', 4: '#bb7d55', 5: '#d39769', 6: '#e8b282', o: '#e3954c',
        // the face: brows (V the softer one asleep), blue-grey eyes with a dark pupil, the lash line (down, asleep), the mouth, a lip light
        B: '#1e1410', V: '#5a3424', E: '#7f9fb4', P: '#120c0c', L: '#3a2216', M: '#5a2e20', l: '#c08664',
        // short stubble: the skin a shade darker and cooler, on the jaw and chin only
        t: '#8a5a40', u: '#a46e4e', v: '#b6805c',
        // the jacket's standing collar, from the suit ramp
        q: '#13181c', Q: '#1d2328', J: '#283037', K: '#353e46', W: '#47515a',
    };
    const BLINK = { E: '#77432c', P: '#77432c' };              // shut: both eye pixels become one lid line
    // three-quarter, facing right, lit from the front, built like Vance's head (the same eye, nose and mouth columns,
    // 13 wide at the eyes) but his own man: the crown a row higher, the hair slicked straight back with volume over the
    // forehead and one grey-blue sheen strand, a high forehead, grey on both temples; the brows 1 px and dead level
    // straight over the eyes (no lid row), blue-grey eyes (iris + dark pupil), no shadow under them; a longer straight
    // nose, its lit tip a row lower, the shadow under it; a firm 3-px mouth with a lip light under it; a square jaw a
    // little wider than Vance's that narrows a pixel each side twice, with short stubble on the jaw and chin that stops at the jawline. The amber
    // edge on the lit side, five pixels. Then the jacket's standing collar, the neck in a V in mid skin. Anchor [11, 21]:
    // the foot of the collar.
    const FRONT = [
        '..........bccb........',
        '........bcdeedcb......',
        '......bcdeffeddcc.....',
        '.....bcfeedddddcc.....',
        '....bgedc4555554gc....',
        '....ghgc4555555hg.....',
        '....hg34455555554g....',
        '....gg3BBB454BBBo.....',
        '....4234EP455EP5o.....',
        '....413444355445o.....',
        '....323445356455o.....',
        '....323344356644o.....',
        '.....234444223454.....',
        '......3444MMM4443.....',
        '......t4u44lu4t2......',
        '......1tuvutvut1......',
        '.......12tttt21.......',
        '.....qQJ2333332JQq....',
        '...qQJJJQ23332QJJJKq..',
        '.qQJJJJJJQ232QJJJJKWq.',
        'qQJJJJJJJJQ2QJJJJJKWWq',
        'qQJJJJJJJJJQJJJJJJKWWq',
    ];
    // looking down (console, tend, wall): the head tips forward a row into the collar; the brows shorten to 2 px and the
    // lash line drops a row below them, with lid skin between, so brow and lid don't stack into a squint
    const DOWN_ROWS = {
        7: '....gg3BB44544BBo.....',
        8: '....423433455335o.....',
        9: '....4134LL355LL5o.....',
    };
    const DOWN = ['.'.repeat(22), ...FRONT.slice(0, 17).map((r, i) => DOWN_ROWS[i] || r), ...FRONT.slice(18)];
    // climbing, from behind: the same skull a row taller, the combed lines running straight back to a point at the nape,
    // a sheen on the crown, grey over both ears, the ears with lit rims, the collar from behind
    const BACK = [
        '.........bccb.........',
        '.......bcdeedcb.......',
        '......bcdeffedcb......',
        '.....bcdcdeedcdcb.....',
        '....bcdcdeedcdcdcb....',
        '....bcdcdedccdcdcb....',
        '....gcdcdcdccdcdcg....',
        '....hgdcdcdccdcdgh....',
        '...3hgdcdcdccdcdgh3...',
        '...42gcdcdcbcdcdg24...',
        '...42bcdcdbcdcdcb24...',
        '...31bbcdcbcdcdbb13...',
        '....2bbcdcbbcdcbb2....',
        '.....1bbcdbbdcbb1.....',
        '......2bbcbbcbb2......',
        '......21bbbbbb12......',
        '......2332bb2332......',
        '.....qQJ2333332JQq....',
        '...qQJJJJQQQQQJJJJQq..',
        '.qQJJJJJJJJJJJJJJJJJQq',
        'qQJJJJJJJJJJJJJJJJJKWq',
        'qQJJJJJJJJJJJJJJJJJKWq',
    ];
    // asleep: a true profile, drawn here upright and facing right, then turned face up with the crown to the left (as the
    // engine turns the body). The slicked hair lies flat back off a high forehead, its sheen strand and the grey temple
    // in front of the ear; a soft level brow, a row of lid, the shut eye's lash line; a long straight nose to a lit tip; a closed
    // mouth; a square chin with short stubble; the ear at mid-head. The collar is the front's, turned with it.
    const UPRIGHT = [
        '......................',
        '..........bccccb......',
        '........bcdeeedcc.....',
        '.......bcdeedddcdc45..',
        '......bcdeddcdcdcg455.',
        '......bcddcdcdcdg3455.',
        '......bcdcdcdcdgh3VV5.',
        '......bcdcdcdghg34445.',
        '......bcdcd343g344LL4.',
        '......bcdcd41334444555',
        '.......bcdc42334444455',
        '........23333234444266',
        '........2333324444435.',
        '........2333332t444MM.',
        '.........2333332tut4l.',
        '.........23333332tut4.',
    ].concat(FRONT.slice(17));
    const LYING = {
        anchor: [20, 10], blink: {},
        map: Array.from({ length: 22 }, (_, y) => UPRIGHT.map(r => r[21 - y]).join('')),
    };
    E.register({
        id: 'jaxon', name: 'Jaxon', role: 'Engineer', portrait: '../../../assets/crew/M_2.png',
        signature: 'Near-black hair slicked back, grey at the temples; calm level brows over blue-grey eyes, a straight nose, a square stubbled jaw, a little amber light on the lit side. Dark work jacket, tool belt. Heavy, arms crossed.',
        ramps: {
            suit:  [INK, '#13181c', '#1d2328', '#283037', '#353e46', '#47515a', '#5e6972'],
            pant:  [INK, '#16130f', '#221d18', '#302921', '#40372c', '#544838'],
            boot:  [INK, '#120d0a', '#21170f', '#322317', '#463222', '#5c4330'],
            cuff:  [INK, '#0e1215', '#171c20', '#22282d', '#2e353b'],
            skin:  [INK, '#3a1e12', '#5e3520', '#7a4a30', '#93583a', '#a5643f', '#bd7849'],
            hair:  [INK, '#0a0e12', '#121a20', '#1b242b', '#2a353d', '#4e585f'],
            amber: [INK, '#3a1a08', '#8f2a12', '#c4561c', '#e0761e', '#ffb52e'],
        },
        tex: { suit: 0.1, pant: 0.08, boot: 0.06, cuff: 0.04, skin: 0.03, amber: 0 },
        build: { idle: 'crossed', lift: 4, thigh: [4.8, 3.8], shin: [3.6, 2.8], foot: 2.1, toe: 4.8,
                 arm: [3.5, 3.0], fore: [3.1, 2.5], hand: 2.3, upper: 15.5, lower: 14,
                 pelvis: [7.2, 6, 6.2], waist: [7.2, 6.6, 6.2], chest: [9.6, 10.6, 7.8], sh: [4.7, 4.2], shX: [-5.9, 6.1],
                 shY: -27.5, neckY: -29.5, chestY: -20.5, waistY: -9.4, stanceX: [-4.5, 3.5], backW: 10.2 },
        materials: {
            thigh: 'pant',
            leg: t => (t > 0.62 ? 'boot' : 'pant'),
            pelvis: 'pant',                                                          // a short work jacket: trousers from the belt down
            forearm: t => (t > 0.86 ? 'cuff' : 'suit'),
            hand: 'skin',
        },
        decorate(api, P) {
            const R = api.ramps, b = P.build, on = (x, y, part) => api.part(x, y) === part;
            // the belt below the jacket hem, and its buckle
            const w = P.up(-1.6), wy = Math.round(w.y);
            for (let x = 0; x < api.W; x++) if (on(x, wy, 'torso')) api.set(x, wy, x % 3 ? R.boot[2] : R.boot[1]);
            if (P.view !== 'side') return;
            const front = x0 => { let x = x0; while (x < api.W - 1 && on(x + 1, wy, 'torso')) x++; return x; };
            const fx = front(Math.round(w.x));
            if (on(fx - 1, wy, 'torso')) { api.set(fx - 1, wy, '#7a6a52'); api.set(fx - 2, wy, R.boot[3]); }
            // a leather tool pouch on the near hip, flap lit, a wrench handle out of the top
            const px = Math.round(w.x - 3), py = wy + 1;
            for (let y = py; y < py + 5; y++) for (let x = px - 1; x <= px + 2; x++) {
                if (!api.get(x, y)) continue;
                api.set(x, y, y === py ? R.boot[4] : x === px + 2 ? R.boot[3] : x === px - 1 ? R.boot[1] : R.boot[2]);
            }
            if (api.get(px, py - 1)) api.set(px, py - 1, '#59626a');
            // a cargo pocket on the near thigh, its flap catching the light
            const L = P.legs[0], kx = api.lerp(L.h.x, L.knee.x, 0.55), ky = api.lerp(L.h.y, L.knee.y, 0.55);
            const qx = Math.round(kx - 1), qy = Math.round(ky - 2);
            for (let y = qy; y < qy + 5; y++) for (let x = qx; x < qx + 3; x++) {
                if (!on(x, y, L.part)) continue;
                if (y === qy) api.paint(x, y, 'pant', 1);
                else if (y === qy + 1 || x === qx + 2) api.set(x, y, api.mix(api.get(x, y), api.INK, 0.35));
            }
            // the zip down the jacket front and a chest pocket with a small amber work light clipped to it
            const top = P.up(b.neckY + 3), bot = P.up(-2.5);
            for (let y = Math.round(top.y); y < Math.round(bot.y); y++) {
                const t = (y - top.y) / (bot.y - top.y), x = Math.round(api.lerp(top.x, bot.x, t) + b.chest[0] * (1 - t * 0.35) - 2.5);
                if (on(x, y, 'torso')) api.set(x, y, api.mix(api.get(x, y), api.INK, 0.4));
            }
            const c = P.up(b.chestY - 2.5), cx = Math.round(c.x + b.chest[0] - 6), cy = Math.round(c.y);
            for (let y = cy; y < cy + 4; y++) for (let x = cx; x < cx + 3; x++) {
                if (!on(x, y, 'torso')) continue;
                if (y === cy) api.set(x, y, api.mix(api.get(x, y), '#8995a0', 0.25));
                else if (x === cx + 2 || y === cy + 3) api.set(x, y, api.mix(api.get(x, y), api.INK, 0.3));
            }
            if (on(cx + 1, cy - 1, 'torso')) { api.set(cx + 1, cy - 1, R.amber[5]); if (on(cx + 1, cy, 'torso')) api.set(cx + 1, cy, R.amber[3]); }
        },
        heads: {
            front: { anchor: [11, 21], keys: KEYS, map: FRONT, blink: BLINK },
            down: { anchor: [11, 21], map: DOWN },
            back: { anchor: [11, 21], map: BACK },
            lying: LYING,
        },
    });
})(window.MiniCrewEngine);


/* Silent Exodus · new screen (?new=1) · crew/Aris.js: Aris's sprite (heads, ramps, build). Calls CrewEngine.register
   once. Source: prototypes/screens/crew-hires/aris.js, ported unchanged ('use strict' added). Load after CrewEngine.js. */
/* ARIS, doctor. Portrait: assets/crew/F_3.png.
   Read at a glance: a maroon flight helmet with cream goggles pushed up and a cream ear cup; blue-black hair with magenta
   lights, loose and flying out behind; the warmest face aboard, smiling; a padded suit with rust-orange panels on the
   shoulders, arms and knees, cream cuffs, and a white medic band on the arm. */
(function (E) {
    'use strict';
    const INK = E.INK;
    const KEYS = {
        // helmet shell (maroon-purple) with a hard sheen, the goggles and the ear cup (cream), amber lenses with a glass
        // highlight
        p: '#2a0c22', q: '#4a1430', r: '#6e1a3a', s: '#962a46', S: '#c4506a',
        k: '#3a2c28', l: '#6e5a48', m: '#a8906a', n: '#d3b374', N: '#eedc9c', O: '#7a3a14', o: '#c8701e', A: '#ffe0a0',
        // hair: blue-black with magenta lights
        a: '#0e0418', b: '#1f0f32', c: '#3a1442', d: '#8a2474', e: '#d04aa6',
        // skin, warm, lit from the front: 1 the jaw shadow … 6 the light on the cheek and the nose; h the blush
        1: '#5a1c24', 2: '#8a3a34', 3: '#b85a44', 4: '#d8784c', 5: '#e8995a', 6: '#f6c280', h: '#d86a52',
        // the face: brows, the lash line, a warm brown iris with a light catch, the smile
        B: '#2e0e24', V: '#7a3436', L: '#1a0610', I: '#8a4020', P: '#1a0608', G: '#ffe6c0', w: '#f0c8a8', M: '#7a1a26', R: '#c84a4a', T: '#f6dcc4', Q: '#a8343e',
        // the ring collar: blue-violet
        x: '#16142e', y: '#2a2656', z: '#4a4488', Z: '#8078c8',
    };
    // shut: the lid comes down over the iris, the lashes rest where the eye was
    const BLINK = { L: '#b85a44', I: '#b85a44', P: '#1a0610', G: '#1a0610', w: '#1a0610' };
    // three-quarter, facing right. The helmet dome (a sheen on the shell so it reads hard, not knitted) with the goggles
    // pushed up on its brow: two 3 x 2 amber lenses, each with a pale glass highlight, split by dark rims (the old 1-px
    // lenses on a tan strip read as a tiara). The fringe swept across the forehead, the cream ear cup at the back of the
    // head, the hair in clumps flying out behind. The face: soft level brows a row above the eyes; each eye a lash line
    // over a brown iris, a dark pupil and a light catch; the nose from between the eyes down to a lit tip; one blush
    // pixel per cheek; the smile, a dark-rose line with both corners lifted a row over a glimpse of teeth; the chin
    // rounded by cutting its bottom corners. Anchor [12, 19]: the foot of the ring.
    const FRONT = [
        '..........pqrrqp....',
        '........pqrrsSrrqp..',
        '.......pqrssssSsrq..',
        '......pqkAoOkkAoOk..',
        '.....apqmoOOmmoOOm..',
        '....abcbbcddecbdeb6.',
        '...abcebcc4VBB55BV4.',
        '..abdcbmnc345556554.',
        '.abdcbmNnc4LIL56LI4.',
        'abcecbkmkb4wPG56PG4.',
        '.adebacbcb345543654.',
        '.bd.acbacb2h45542h3.',
        '...bdabbcb2345QTTQ3.',
        '.....cd.ab12344MM4..',
        '.......de...234h4...',
        '........d....233....',
        '.......xyzzZZZZzzyx.',
        '......xyzZZyyyyyZZzx',
        '......xyzzyxxxxxyzzx',
        '.......xyyzzzzzzyyx.',
    ];
    // looking down (console, tend, wall): everything above the ring drops a row, the lids come down, the iris looks down
    const DOWN = ['.'.repeat(20), ...FRONT.slice(0, 15), ...FRONT.slice(16)]
        .map(r => r.replace('4LIL56LI4', '433356334').replace('4wPG56PG4', '4LIL56LI4'));
    // climbing, from behind: the dome, the goggle strap across the back, the hair loose to the collar in clumps that sway
    // to the left, lit magenta near the crown and darker toward the nape (no ear cups here: a cream one on each side read
    // as earmuffs)
    const BACK = [
        '.....pqrrqp.....',
        '...pqrrssrrqp...',
        '..pqrrsssrrrqp..',
        '..pqrrrssrrrqp..',
        '..klmmnnnnmmlk..',
        '.pqrrrrrrrrrrqp.',
        'bcpqrrrrrrrrqpcb',
        'cdkbccdcccdcbkdc',
        'bckcdecbcdecckcb',
        '.bcdcbacdccbccb.',
        'bcdcbabcdcbcbcba',
        'cdcbabcdcbabcba.',
        'dcba.bccba.bba..',
        'cba..abcb..ab...',
        'ea....ba....a...',
        '..xyzzZZZZzzyx..',
        '.xyzZZyyyyZZzyx.',
        '.xyzzyyyyyyzzyx.',
        '..xyyzzzzzzyyx..',
    ];
    // asleep: the helmet off, face up in profile, crown to the left. Forehead, brow, the closed eye's lash line, a small
    // nose at eye height, lips, chin, the ear at mid-head, the hair loose on the pillow. The ring is the front's, turned.
    const RING = FRONT.slice(16);
    const LYING_HEAD = [
        '...........5......',
        '..........563.....',
        '....555564554RMR4.',
        '..cc455BB555543432',
        '.bec44444LLh544321',
        '.cbb3445555h543211',
        'bbbdc3445444432112',
        'bdcbbb344344332122',
        'cbbbdcbbb243321122',
        'aadcaaadc232211222',
        '.baaacbaaac1112221',
        '..acbaaacbaaa11111',
        '...aaacbaaacb..11.',
        '.ab.bcdabcbda.....',
        '..b.dab.adb.......',
        '...d...e....d.....',
    ];
    const LYING = {
        anchor: [21, 7], blink: {},
        map: LYING_HEAD.map((row, Y) => row + RING.map(r => (Y < 20 ? r[19 - Y] : '.')).join('')),
    };

    E.register({
        id: 'aris', name: 'Aris', role: 'Doctor', portrait: '../../../assets/crew/F_3.png',
        signature: 'Maroon flight helmet with cream goggles pushed up and a cream ear cup; blue-black hair with magenta lights, loose and flying; the warmest face, smiling; padded suit with rust-orange panels and a white medic band.',
        ramps: {
            suit: [INK, '#2c2420', '#4a3e34', '#6e6050', '#94846c', '#b8a688', '#d2c2a0', '#e4d6b8'],     // warm cream padding
            navy: [INK, '#141222', '#1e1a30', '#2a2440', '#363050', '#443c5e'],                          // the undersuit at the joints
            rust: [INK, '#3a140c', '#62200f', '#8c3218', '#b44a22', '#d66832', '#f09050'],     // the padded panels
            band: [INK, '#120d1a', '#1e1729', '#2c2238', '#3a2e48'],                          // belt, plum
            boot: [INK, '#141018', '#221c28', '#322a3a', '#463c50'],
            skin: [INK, '#3a0c1c', '#7a2234', '#b04a40', '#d8784c', '#e8995a', '#f4bc78'],
            hair: [INK, '#0e0418', '#1f0f32', '#3a1442', '#6e1a5a', '#b02a84', '#e055b0'],
            cream: [INK, '#3a2c28', '#6e5a48', '#a8906a', '#d3b374', '#eedc9c'],
        },
        tex: { suit: 0.07, navy: 0.06, rust: 0.06, band: 0.03, boot: 0.05, skin: 0.03, cream: 0 },
        build: { idle: 'behind', lift: 5, thigh: [3.9, 2.9], shin: [2.8, 2.0], foot: 1.7, toe: 4.3, arm: [2.4, 2.0], fore: [1.9, 1.5], hand: 1.6,
                 upper: 14.5, lower: 13, pelvis: [6.2, 5.6, 5.2], waist: [5, 5.8, 4.6], chest: [6.8, 8.8, 5.8], sh: [3.7, 3.3],
                 shX: [-3.8, 4.6], shY: -25.5, neckY: -27, chestY: -18.5, waistY: -9, stanceX: [-1.5, 4], backW: 8, bust: true },
        materials: {
            shoulder: 'rust',
            arm: t => (t < 0.62 ? 'rust' : t < 0.8 ? 'suit' : 'navy'),               // rust upper arm, navy at the elbow
            forearm: t => (t < 0.14 ? 'navy' : t > 0.86 ? 'cream' : 'suit'),
            chest: (u, v) => (v < -2.5 ? 'rust' : 'suit'),                           // the padded yoke
            thigh: t => (t > 0.12 && t < 0.72 ? 'rust' : 'suit'),                    // rust thigh panels
            leg: t => (t > 0.6 ? 'boot' : 'suit'),
            hand: 'skin',
        },
        heads: {
            front: { anchor: [12, 19], keys: KEYS, map: FRONT, blink: BLINK },
            down: { anchor: [12, 19], map: DOWN },
            back: { anchor: [8, 18], map: BACK },
            lying: LYING,
        },
        decorate(api, P) {
            const R = api.ramps;
            // knee pads, rust, lit like the suit
            for (const L of P.legs) {
                const kx = L.knee.x + (P.view === 'side' ? 1 : 0), ky = L.knee.y;
                for (let y = Math.floor(ky - 3); y <= ky + 3; y++) for (let x = Math.floor(kx - 3); x <= kx + 3; x++) {
                    if (((x + 0.5 - kx) / 2.4) ** 2 + ((y + 0.5 - ky) / 2.8) ** 2 <= 1 && api.part(x, y) === L.part) api.paint(x, y, 'rust');
                }
            }
            // the belt, and a cream buckle on the side view
            const w = P.up(-5), wy = Math.round(w.y);
            for (let x = 0; x < api.W; x++) if (api.part(x, wy) === 'torso') api.paint(x, wy, 'band');
            if (P.view === 'side') { const bx = Math.round(w.x + 3); if (api.part(bx, wy) === 'torso') api.set(bx, wy, R.cream[4]); }
            // the medic band: white around the near upper arm
            const arm = P.arms && P.arms[0];
            if (arm && P.view === 'side') {
                const ax = arm.el.x - arm.s.x, ay = arm.el.y - arm.s.y, len = Math.hypot(ax, ay) || 1, ux = ax / len, uy = ay / len;
                const cx = arm.s.x + ax * 0.45, cy = arm.s.y + ay * 0.45;
                for (let y = Math.floor(cy - 4); y <= cy + 4; y++) for (let x = Math.floor(cx - 4); x <= cx + 4; x++) {
                    if (api.part(x, y) !== arm.part) continue;
                    const t = (x + 0.5 - cx) * ux + (y + 0.5 - cy) * uy;
                    if (Math.abs(t) < 1.1) api.paint(x, y, 'cream', 1);
                }
            }
            // walking, the trailing clumps lift a row on the up-step (whole clumps, never loose pixels)
            if ((P.action === 'walk' || P.action === 'carry') && P.view === 'side' && P.frame % 4 < 2) {
                const nx = P.neck.x, ny = P.neck.y;
                [[-12, -11], [-11, -11], [-13, -9], [-12, -9]].forEach(([dx, dy]) => { if (!api.get(nx + dx, ny + dy)) api.set(nx + dx, ny + dy, dy === -11 ? R.hair[5] : R.hair[2]); });
            }
            // quilting: a darker stitch line every third row across the padded panels
            const rust = new Set(R.rust);
            for (let y = 0; y < api.H; y++) for (let x = 0; x < api.W; x++) {
                if ((y + (P.view === 'side' ? 0 : 1)) % 3 === 0 && rust.has(api.get(x, y))) api.paint(x, y, 'rust', -1);
            }
        },
    });
})(window.MiniCrewEngine);


/* Silent Exodus · new screen (?new=1) · crew/Vance.js: Vance's sprite (heads, ramps, build). Calls CrewEngine.register
   once. Source: prototypes/screens/crew-hires/vance.js, ported unchanged ('use strict' added). Load after CrewEngine.js. */
/* VANCE, the hard one. Portrait: assets/crew/M_4.png. v2, drawn against the portrait at 6x and checked at 2x and 1x.
   Read at a glance, in this order: the big white ring collar with its dark purple-grey lining (the widest thing on him),
   grey hair swept up into ragged spikes with one white lock on the forehead, heavy dark brows over small blue eyes, a
   long nose and a stubbled square jaw. A worn white EVA shell with cool shadows, grey knee joints and shoulder bearings,
   brown leather gloves, a grey life-support pack, a chest box with one amber and one cyan light.
   Stance and movement: heavy and square, hands on his hips, feet wide; he barely lifts his boots when he walks (lift 4).
   Heads (redrawn twice on 2026-10-08: first he read as angry and masked, then as a square box): front (three-quarter,
   a long face, level brows, calm tired eyes), down (shorter brows, the lash line a row below them, chin into the ring),
   back (spikes, both ears, the ring from behind), lying (a true profile turned face up: forehead, softened brow, a
   closed eye, a long nose from the eye line, lips, stubbled chin, ear mid-head, hair spread on the pillow). */
(function (E) {
    'use strict';
    const INK = E.INK;
    // three-quarter, facing right, lit from the front. Grey hair in messy tufts of uneven length over an uneven
    // hairline, one white lock falling on the near side of the forehead, a grey one on the far side. A long face (the
    // hairline to the chin is longer than the face is wide) whose jaw tapers a pixel each side over its bottom 3 rows.
    // Calm and weary, never angry: 1-px brows dead level, a lid row, blue eyes (iris + dark pupil), a cheekbone shadow
    // under each eye, a long lit nose with the shadow under it centred on the bridge, a fold from the near nostril, a
    // 3-px level mouth, two-tone stubble on the chin and jaw only, both ears. Then the padded ring collar.
    const FRONT = [
        '........ef.g.f........',
        '.....d.efgfggff.e.....',
        '...ccdefgfgffgfffdc...',
        '....bcdehf55gffedc....',
        '....bcc4h4556g4eed....',
        '....bc3h44555545dc....',
        '....bc3BBB444BBBcb....',
        '....3334334543354.....',
        '....4234EP455EP55.....',
        '....4134333553454.....',
        '....3233443566453.....',
        '.....23344322345......',
        '......34434l4444......',
        '.......t44MMM4t.......',
        '.......tu4uluut.......',
        '.......1tutvut1.......',
        'rswjki1221111111ikjwsr',
        'swxkjiiiiiiiiiiiijkxws',
        'wxxwkjiiiiiiiiiijkwxxw',
        'wxxxxhxxxxxxxxxxxhxxxw',
        'swwwwwwwwwwwwwwwwwwwws',
        'rswwwwwwwwwwwwwwwwwwsr',
        'qrsssswwwwwwwwwwssssrq',
        '.pqrrrrrrrrrrrrrrrrrrq',
    ];
    // looking down (console, tend, wall): the head tips forward a row into the ring. The brows shorten to 2 px and the
    // lash line drops a row below them, with lid skin between, so brow and lid don't stack into a squint.
    const DOWN_ROWS = {
        6: '....bc3BB44444BBcb....',
        8: '....4234334553355.....',
        9: '....4134LL355LL54.....',
    };
    const DOWN = ['.'.repeat(22), ...FRONT.slice(0, 16).map((r, i) => DOWN_ROWS[i] || r), ...FRONT.slice(17)];

    E.register({
        id: 'vance', name: 'Vance', role: 'The hard one', portrait: '../../../assets/crew/M_4.png',
        signature: 'Grey hair swept up in ragged spikes, one white lock, heavy dark brows over blue eyes, a stubbled square jaw. A worn white EVA suit with the big ring collar, brown gloves, a grey pack. Heavy, square, hands on his hips.',
        ramps: {
            suit: [INK, '#1e1f27', '#33353f', '#4d505b', '#6b6e79', '#8f919a', '#b3b4b6', '#cac8c1'],   // worn white shell, cool shadows
            dark: [INK, '#1b191d', '#2c282c', '#413a3b', '#594f4e'],                                    // seals, cuffs, kneepads
            glove: [INK, '#22171a', '#3a2925', '#573c32', '#765443', '#94705a'],                        // brown leather
            boot: [INK, '#191a1e', '#2b2c31', '#404147', '#5a5b61', '#76777c'],
            skin: [INK, '#43282a', '#74493f', '#a87560', '#cc9475', '#e3ae88'],
            hair: [INK, '#1f1f28', '#434755', '#5a5f6e', '#9a9fab', '#c2c5cd'],
            pack: [INK, '#1a1b22', '#2c2e37', '#42454f', '#5c5f69', '#7a7d86', '#999ba0'],               // the life-support pack, a step under the shell
            warm: [INK, '#3a1610', '#7a2e1a', '#c4552c', '#f08c4e'],
        },
        tex: { suit: 0.12, pack: 0.08, dark: 0.07, glove: 0.05, boot: 0.07, skin: 0.03, warm: 0 },
        build: { idle: 'hips', lift: 4, thigh: [6.2, 5.1], shin: [5.0, 4.2], foot: 2.8, toe: 5.4,
                 arm: [3.3, 3.0], fore: [3.0, 2.7], hand: 2.4, upper: 15.5, lower: 14,
                 pelvis: [7.8, 6, 6], waist: [7.4, 6.8, 6], chest: [9.4, 10.6, 7.6], pack: true,
                 sh: [4.4, 4], shX: [-5.8, 6.4], shY: -28, neckY: -30, chestY: -21, waistY: -9.5, stanceX: [-5, 4], backW: 9.5 },
        materials: {
            leg: t => (t > 0.62 ? 'boot' : 'suit'),
            forearm: t => (t > 0.84 ? 'dark' : 'suit'),                              // the dark cuff ring
            waist: (u, v) => (Math.abs(v - 3) < 1.1 ? 'dark' : 'suit'),               // the waist seal
            hand: 'glove', pack: 'pack',
        },
        heads: {
            front: {
                anchor: [11, 21],
                keys: {
                    a: '#1f1f28', b: '#2f313d', c: '#434755', d: '#5a5f6e', e: '#787d8c', f: '#9a9fab', g: '#c2c5cd', h: '#eceef2',
                    1: '#43282a', 2: '#74493f', 3: '#a87560', 4: '#cc9475', 5: '#e3ae88', 6: '#f2c9a0',
                    t: '#8e7666', u: '#a68a78', v: '#b89a86', B: '#2b2830', L: '#3a2422', E: '#5a96cc', P: '#1a2230', m: '#9c5c4a', M: '#7a4438', l: '#c48a70', n: '#5e3430',
                    p: '#30313a', q: '#4f515b', r: '#767881', s: '#9c9ea3', w: '#c1c1bd', x: '#dcdbd4',
                    i: '#1a1620', j: '#2c2634', k: '#4a4252',
                },
                blink: { E: '#74493f', P: '#74493f' },
                map: FRONT,
            },
            down: { anchor: [11, 21], map: DOWN },        // console, tend, wall: the head tips forward into the ring, lids lowered
            back: {                                    // climb: the back of the hair, the nape, both ears, the ring from behind
                anchor: [11, 22],
                map: [
                    '.......d...f..e.......',
                    '......e.fg.gf.f.......',
                    '.....deffgfggfeef.....',
                    '....cdefgfgfgfefed....',
                    '...cdefefgffefeedcb...',
                    '...cddeefefeeedecdb...',
                    '...bcdedeeefeedcdcb...',
                    '...bcddcdedcdedccbb...',
                    '...bccdcdcdcdcdcbba...',
                    '..3bbccddccdccdcba3...',
                    '..42bcbcdcbccbcbba24..',
                    '..32abbcbcbbcbcbaa23..',
                    '...2abbbbcbbbbbbaa2...',
                    '....1abcbbabbcbba1....',
                    '.....233232323321.....',
                    '.....123333333321.....',
                    '.qrsjk1233333321kjsrq.',
                    'qrsjkj1122222211jkjsrq',
                    'rswwwwwwxxxxxxxxwwwwsr',
                    'qswwwwwwwwxxxxwwwwwwsq',
                    'qrswwwwwwwwwwwwwwwwsrq',
                    'pqrsswwwwwwwwwwwwssrqp',
                    '.pqrssssssssssssssrqp.',
                    '..pqqrrrrrrrrrrrrqqp..',
                ],
            },
            lying: {                                   // sleep: on his back, a true profile turned face up, eye shut, the ring on its side
                anchor: [21, 10],
                map: [
                    '.........66.....rssrqqp.',
                    '.....6655554544vsxwssrq.',
                    '...ed55345445mluwwwwwsrp',
                    '..efhh53L4344Mutssswwwsq',
                    '.gfff453L34444tukjjxwwsq',
                    '..fgge44444443ut3kjxwwsr',
                    '..gfff44454333t2tjkxxwsr',
                    '.ffggg33333332221iixxwwr',
                    '..gfffeee33222221iixxwwr',
                    '..fgggf4222322222iixxwwr',
                    '.eeffff3444322221iixxwwr',
                    '...eeeeedcc22222jiixxwwr',
                    '..dddddddddc2211jiixxwwr',
                    '...ccccccccb11..jiixxwwr',
                    '....bbbbbbba....jiixwwsr',
                    '................jiixwwsr',
                    '................jjixwwsr',
                    '................kkkwwwsq',
                    '................jiiwwsrq',
                    '................sjjwwrqp',
                    '................rssssqp.',
                    '................qrqrqp..',
                ],
            },
        },
        decorate(api, P) {
            const R = api.ramps, b = P.build;
            for (const L of P.legs) {                                                // grey knee joints, lit like the suit
                const kx = L.knee.x + (P.view === 'side' ? 1.2 : 0), ky = L.knee.y;
                for (let y = Math.floor(ky - 3); y <= ky + 3; y++) for (let x = Math.floor(kx - 3); x <= kx + 3; x++) {
                    const q = ((x + 0.5 - kx) / 2.6) ** 2 + ((y + 0.5 - ky) / 2.8) ** 2;
                    if (q <= 1 && api.part(x, y) === L.part) api.paint(x, y, q > 0.55 ? 'dark' : 'pack', q > 0.55 ? 1 : 0);
                }
            }
            for (const A of P.arms) {                                                // the shoulder bearing: a dark ring round the upper arm
                const dx = A.el.x - A.s.x, dy = A.el.y - A.s.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
                const at = P.view === 'side' ? 0.34 : 0.3, ox = A.s.x + dx * at, oy = A.s.y + dy * at;
                for (let k = -b.arm[0] - 1; k <= b.arm[0] + 1; k += 0.5) {
                    const x = Math.floor(ox - uy * k), y = Math.floor(oy + ux * k);
                    if (api.part(x, y) === A.part) api.paint(x, y, 'dark', 1);
                }
            }
            if (P.view === 'back') {                                                 // climbing: the pack from behind, with its one amber light
                const cx = Math.round(P.hip.x), cy = Math.round(P.up(-19).y);
                for (let x = cx - 6; x <= cx + 6; x++) if (api.part(x, cy + 1) === 'torso') api.paint(x, cy + 1, 'dark', 1);
                for (const vx of [cx - 3, cx - 1, cx + 1, cx + 3]) if (api.part(vx, cy + 5) === 'torso') api.paint(vx, cy + 5, 'dark', 0);
                if (api.part(cx + 4, cy - 5) === 'torso') api.set(cx + 4, cy - 5, R.warm[3]);
                return;
            }
            const c = P.up(b.chestY + 2), cx = Math.round(c.x + 4), cy = Math.round(c.y);  // the chest box: one warm light, one cyan
            for (let y = cy - 2; y <= cy + 1; y++) for (let x = cx - 2; x <= cx + 2; x++) {
                if (api.part(x, y) === 'torso') api.set(x, y, y === cy - 2 ? R.suit[5] : x === cx + 2 ? R.dark[4] : R.dark[2]);
            }
            if (api.part(cx - 1, cy - 1) === 'torso') api.set(cx - 1, cy - 1, R.warm[3]);
            if (api.part(cx + 1, cy - 1) === 'torso') api.set(cx + 1, cy - 1, '#6fb8c8');
            const top = P.up(-27), bot = P.up(-12);                                  // a seam down the suit front
            for (let y = Math.round(top.y); y <= Math.round(bot.y); y++) {
                const x = Math.round(api.lerp(top.x, bot.x, (y - top.y) / (bot.y - top.y)) + 1.5);
                if (api.part(x, y) === 'torso' && api.get(x, y) && Math.abs(x - cx) > 2) api.set(x, y, api.mix(api.get(x, y), api.INK, 0.35));
            }
        },
    });
})(window.MiniCrewEngine);


/* Silent Exodus · new screen (?new=1) · crew/Mira.js: Mira's sprite (heads, ramps, build). Calls CrewEngine.register
   once. Source: prototypes/screens/crew-hires/mira.js, ported unchanged ('use strict' added). Load after CrewEngine.js. */
/* MIRA, tech. Portrait: assets/crew/F_5.png.
   Read at a glance: black hair tied back behind the ear, one teal lock falling at the front over the far temple; green
   eyes; a calm half-smile; a pale cream high-collar uniform with gold trim. Slight, long-necked, composed: she stands
   straight, feet together, arms at her sides, and walks with a light, low step. The cream cloth stays a step below
   white so her face is still the warmest, brightest thing.
   Heads (redrawn 2026-10-08 in Aris's construction, the approved set): front three-quarter with the hair close to the
   skull and a small knot at the nape, a 1-px half-smile (never a red pout), the far eye clear of the hair and the ear,
   the teal lock joined to the hair; down (lids lowered); back (a gold tie over the knot); lying (face up in profile). */
(function (E) {
    'use strict';
    const INK = E.INK;
    const SUIT = [INK, '#262820', '#40433a', '#62665a', '#868a7a', '#a8ac9a', '#c4c8b4', '#d8dcc8'];   // pale sage cream, as in the portrait
    // the head keys: hair black with a cool sheen (f the one bright strand on the crown), the teal lock, warm skin lit
    // from the front (1 the jaw shadow ... 6 the light on the forehead and the nose; h the blush), the face, the cream
    // collar with its gold trim (g o also the hair tie)
    const KEYS = {
        a: '#19131c', b: '#231b28', c: '#2d2534', d: '#3a3346', e: '#4c4a64', f: '#6c7090',
        t: '#176a6a', T: '#2fb0a6',
        1: '#5a2a2c', 2: '#8e4e44', 3: '#bc7658', 4: '#d89a6c', 5: '#eab886', 6: '#f8d6a4', h: '#d48c74',
        B: '#24121a', V: '#6a3a34', L: '#140a0e', I: '#2a9a78', P: '#0a1e1a', G: '#7ad8b4', w: '#e8cdb4',
        q: '#8a3c3e', m: '#c87c70', M: '#d88a7c',
        k: SUIT[3], K: SUIT[4], J: SUIT[5], j: SUIT[6], g: '#a07a2a', o: '#e2c46a', H: '#ffe08a',
    };
    // shut: the lid comes down over the eye, the lashes rest where it was
    const BLINK = { L: '#bc7658', I: '#bc7658', P: '#140a0e', G: '#140a0e', w: '#140a0e' };
    // three-quarter, facing right (the portrait mirrored), built the same way as Aris's head: the same face columns, turn
    // and light. The hair close to the skull: a dark dome with one cool sheen strand from the crown, swept back past the
    // ear into a small knot low at the nape. The teal lock starts inside the hairline on the far side of the forehead and
    // falls four pixels over the temple, joined to the hair, its end dark (no pale tip); black hair frames the far temple
    // behind it. The ear sits back from the eye with a hair pixel between. The face: level 1-px brows a row above the
    // eyes; each eye a lash line over a green iris, then the white, a dark pupil and a light catch, the lash row ending at
    // the eye; the nose from between the eyes down to a lit tip; one blush pixel on the near cheek; the half-smile, a
    // 1-px dark-rose line with only the near corner lifted a row and one lip-tone pixel under it; a short, soft chin.
    // Then the long neck and the cream high collar with its gold edge. Anchor [12, 19]: the collar foot.
    const FRONT = [
        '.....................',
        '..........abccba.....',
        '........abcdeffedcb..',
        '.......abcdeeddcccbb.',
        '......abcdedcc455tcb.',
        '.....abcddcd445556Tb.',
        '....abcdcb3VBB55BVTb.',
        '...abc43cb34555655Tb.',
        '...abc42cb4LIL56LItb.',
        '...abc32cb4wPG56PG4..',
        '..abdcbabb345543654..',
        '..adecbaa12h4q54243..',
        '...bdcba.12345qq443..',
        '....aba..11234m443...',
        '..........1233321....',
        '...........1221......',
        '........gooHHHHog....',
        '........kKKJJjjjH....',
        '........kKJJjjjjo....',
        '........kKJjjjjjjo...',
    ];
    // looking down (console, tend, wall): everything above the collar drops a row, the lids come down, the iris looks down
    const DOWN = ['.'.repeat(21), ...FRONT.slice(0, 15), ...FRONT.slice(16)]
        .map(r => r.replace('4LIL56LIt', '43335633t').replace('4wPG56PG4', '4LIL56LI4'));
    // climbing, from behind: the dome with its sheen strand, the combed lines meeting at the nape, both ears, the hair
    // gathered under a gold tie into a small knot over a little bare neck, the high collar from behind
    const BACK = [
        '.....abccba.....',
        '...abcdeedcba...',
        '..abcdeffedcba..',
        '.abcdedeedcdcba.',
        '.abcdcdeddcdcba.',
        'abcdcdcedcdcdcba',
        'abcdcdcdcdcdcdba',
        '3abcdcdcdcdcdba3',
        '4abcdcdcdcdcdba4',
        '32abcdcdcdcdba23',
        '.2abcdcdcdcdba2.',
        '..2abcgoogcba2..',
        '...23bcdedcb32..',
        '....12bcddcb21..',
        '....123abba321..',
        '...gooHHHHHoog..',
        '..kKKJJjjJJKKk..',
        '..kKJJJjjjJJKk..',
        '..kKJJjjjjJJKk..',
    ];
    // asleep: face up in profile, crown to the left, like Aris's. Forehead, a soft brow, the closed eye's lash line, a
    // small straight nose, closed lips, chin; the ear mid-head; the tied hair under her head with the teal lock out on
    // the pillow by the jaw. The last four columns are the front's collar, turned.
    const LYING = [
        '...........5..........',
        '..........553.........',
        '....555565554mqM4.....',
        '..cc455VV555543432...o',
        '.bdc44444LLh544321gHoj',
        '.cdb34455554543211ojjj',
        'bcdbc3444444432112Hjjj',
        'bdcbb3454344332122Hjjj',
        'cbdcb3423243321122HJjj',
        'acdcbb322232211222HJJj',
        '.bcdcbbbb221112221oKJJ',
        '..acbdcbbaa1.11111oKKK',
        '...abcdcbaabtTt11.gkkk',
        '....aabcbbatTTt.......',
        '......aaa..tTt........',
    ];
    E.register({
        id: 'mira', name: 'Mira', role: 'Tech', portrait: '../../../assets/crew/F_5.png',
        signature: 'Black hair tied back behind the ear, one teal lock falling at the front; green eyes, a calm half-smile; cream high-collar uniform with gold trim. Slight, composed, arms straight at her sides.',
        ramps: {
            suit: SUIT,
            boot: [INK, '#14110e', '#262019', '#3a3127', '#524537'],
            skin: [INK, '#5a2a2c', '#975749', '#c27e5d', '#d99f70', '#ecc28c'],
            hair: [INK, '#120c10', '#1d151b', '#2a2128', '#3b3238', '#504a4c'],
            gold: [INK, '#5a3c10', '#a07a2a', '#e2c46a', '#ffe08a'],
            belt: [INK, '#1a1712', '#2c271e', '#3f382b', '#554c3a'],
        },
        tex: { suit: 0.08, boot: 0.05, skin: 0.03, gold: 0, belt: 0.03 },
        build: { idle: 'hang', lift: 4.5, thigh: [3.5, 2.5], shin: [2.4, 1.7], foot: 1.5, toe: 4, arm: [1.8, 1.5], fore: [1.5, 1.2], hand: 1.5,
                 upper: 14.5, lower: 13, pelvis: [5.6, 5.2, 4.8], waist: [4.3, 5.4, 4.1], chest: [6, 8.2, 5.2], sh: [3, 2.7], shX: [-3.3, 4],
                 shY: -25, neckY: -27, chestY: -18, waistY: -9, stanceX: [-1.5, 1.5], backW: 7.2, bust: true },
        materials: {
            leg: t => (t > 0.66 ? 'boot' : 'suit'),
            forearm: t => (t > 0.86 ? 'gold' : 'suit'),                               // gold cuffs
            hand: 'skin',
        },
        heads: {
            front: { anchor: [12, 19], keys: KEYS, map: FRONT, blink: BLINK },
            down: { anchor: [12, 19], map: DOWN },
            back: { anchor: [8, 18], map: BACK },
            lying: { anchor: [21, 8], blink: {}, map: LYING },
        },
        decorate(api, P) {
            const gold = api.ramps.gold;
            const w = P.up(-5.5), wy = Math.round(w.y);                               // a narrow dark belt, a gold buckle
            for (let y = wy; y <= wy + 1; y++) for (let x = 0; x < api.W; x++) if (api.part(x, y) === 'torso') api.paint(x, y, 'belt', y === wy ? 0 : -1);
            const fold = (x, y, step) => { const pt = api.part(x, y); if (pt && pt !== 'crate' && api.light(x, y) !== null) api.paint(x, y, 'suit', step); };
            for (const L of P.legs) { const kx = Math.round(L.knee.x), ky = Math.round(L.knee.y); fold(kx - 1, ky, -2); fold(kx, ky + 1, -1); fold(kx - 1, ky + 2, -1); }
            for (const A of P.arms) { const ex = Math.round(A.el.x), ey = Math.round(A.el.y); fold(ex, ey, -2); fold(ex - 1, ey + 1, -1); }
            if (P.view !== 'side') return;
            for (const dy of [-13, -1]) { const c = P.up(dy), cy = Math.round(c.y); for (let x = Math.round(c.x) - 2; x <= Math.round(c.x) + 3; x++) if (api.part(x, cy) === 'torso' && (x + cy) % 3) fold(x, cy, -1); }
            const top = P.up(-24), bot = P.up(-7);                                    // the gold edge of the front panel
            for (let y = Math.round(top.y); y <= Math.round(bot.y); y++) {
                const t = (y - top.y) / (bot.y - top.y), x = Math.round(api.lerp(top.x + 3.4, bot.x + 2.9, t));
                if (api.part(x, y) === 'torso') api.set(x, y, t < 0.15 ? gold[4] : gold[3]);
            }
            const bx = Math.round(w.x + 3); if (api.part(bx, wy) === 'torso') { api.set(bx, wy, gold[4]); api.set(bx, wy + 1, gold[2]); }
        },
    });
})(window.MiniCrewEngine);

