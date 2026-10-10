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

    root.CrewEngine = Object.freeze({ SIZE, INK, ACTIONS, register, frameAt, sprite, draw, sheet, people });
})(typeof window !== 'undefined' ? window : globalThis);
