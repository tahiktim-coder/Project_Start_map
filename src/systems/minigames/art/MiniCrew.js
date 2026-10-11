/* ═══ Silent Exodus · minigames · art/MiniCrew.js: the crew-hires people, for the minigames ═══════════════════════════════
   Two ways to draw the five (Cora the commander, Jaxon, Aris, Vance, Mira), both in their crew-hires colours
   (prototypes/screens/crew-hires/, src/newscreen/crew/), both in picture units on a MiniHost context:

   MiniCrew.person(ctx, id, action, ms, x, floorY, { facing, warm, rim, seed })
       The real crew-hires sprite (hand-drawn head, lit body), at its own size: about 95 art pixels tall, so about
       63 units at density 1.5 and 48 units at density 2. For people seen close, aboard (a deck view). Actions are the
       engine's: idle walk console climb sit sleep tend carry wall (MiniCrew.ACTIONS). Needs art/MiniPeople.js; returns
       the sprite ({ w, h, origin, neck, hands } in art pixels) or null when it cannot draw.

   MiniCrew.small(ctx, id, x, feetY, { h, pose, t, facing, suit, light, warm, dim })
       A small person drawn here, at any height (h, in units; default 9), lit from one side like everything else.
       suit: true (default) is the EVA suit: a helmet with a dark visor that catches the light, a life-support pack, the
       shell in their colours (Cora slate panels and cyan trim, Jaxon charcoal and amber, Aris cream padding with rust
       panels and a maroon helmet ring, Vance his worn white shell and brown gloves, Mira sage cream and gold); a face
       shows behind the visor from about 26 art pixels tall. suit: false is how they dress aboard (hair, skin, suit).
       pose: 'stand' | 'walk' | 'kneel' | 'reach' | 'float' | 'climb' | 'lie';  t: ms, for the walk cycle (8 frames).
       facing: 1 (right) | -1;  light: -1 | 1, the side the light comes from (default 1, the right);  warm 0..1: a lamp's
       warmth on the lit side;  dim 0..1: in shadow.  Returns { w, h } in units.

   MiniCrew.IDS, MiniCrew.NAMES, MiniCrew.TONE (the voice colours: names in words, the warm crew, A.U.R.A. steel),
   MiniCrew.idOf('you' | 'Commander' | 'Eng. Jaxon' | '#f0a030' …) → 'cora' | 'jaxon' | … | null,
   MiniCrew.PERSON_ART_H (art pixels a standing crew-hires sprite fills).
   Load after MiniLab.js and art/MiniPeople.js. */
(function () {
    'use strict';
    const MiniLab = window.MiniLab;
    if (!MiniLab || window.MiniCrew) return;

    const INK = '#05070a';
    const IDS = ['cora', 'jaxon', 'aris', 'vance', 'mira'];
    const NAMES = { cora: 'Cora', jaxon: 'Jaxon', aris: 'Aris', vance: 'Vance', mira: 'Mira' };
    // the voice colours (prototypes/screens/game-screen/reading.css): people are warm, A.U.R.A. is steel
    const TONE = Object.freeze({ cora: '#f2e2c4', jaxon: '#f08c2e', aris: '#ffc27a', vance: '#c4622a', mira: '#e8836a', aura: '#c9d1d6' });
    // the old minigame figure colours (MiniShip.CREW before 2026-10-11), so old callers that pass a colour still get a person
    const OLD_COLOURS = { '#ffffff': 'cora', '#40c8ff': 'aris', '#d070ff': 'mira', '#ff5050': 'vance', '#f0a030': 'jaxon' };
    const PERSON_ART_H = 95;

    /** Whoever a name, role or old colour means: 'cora' | 'jaxon' | 'aris' | 'vance' | 'mira', or null. */
    function idOf(who) {
        if (!who) return null;
        const s = String(who).trim().toLowerCase();
        if (OLD_COLOURS[s]) return OLD_COLOURS[s];
        if (Object.values(TONE).includes(s)) return Object.keys(TONE).find(k => TONE[k] === s) || null;
        const last = s.split(/[\s.]+/).filter(Boolean).pop() || '';
        if (IDS.includes(last)) return last;
        if (['you', 'commander', 'captain', 'player', 'me'].includes(last)) return 'cora';
        return null;
    }

    // ── the real sprites (art/MiniPeople.js) ──
    const ACTIONS = ['idle', 'walk', 'console', 'climb', 'sit', 'sleep', 'tend', 'carry', 'wall'];
    function person(ctx, who, action, ms, x, floorY, o = {}) {
        const E = window.MiniCrewEngine, id = idOf(who);
        if (!E || !id) return null;
        try {
            return MiniLab.inArt(ctx, (c, d) => E.draw(c, id, action || 'idle', ms || 0, Math.round(x * d), Math.round(floorY * d),
                { facing: o.facing, warm: o.warm, rim: o.rim, seed: o.seed == null ? IDS.indexOf(id) + 1 : o.seed }));
        } catch (e) { console.error(e); return null; }
    }

    // ── the small people, drawn here ──
    // ramps, darkest first, each from the ink (the crew-hires files' own colours)
    const R = {
        shell: [INK, '#1e1f27', '#33353f', '#4d505b', '#6b6e79', '#8f919a', '#b3b4b6', '#cac8c1'],   // Vance's worn white EVA shell
        pack: [INK, '#1a1b22', '#2c2e37', '#42454f', '#5c5f69', '#7a7d86', '#999ba0'],
        visor: [INK, '#08121a', '#0c1a22', '#14303c', '#2a5868', '#7fb3c2', '#e1f6fb'],
        coraSuit: [INK, '#11161d', '#1b222b', '#262f38', '#323c47', '#45515e', '#5f6c7e'],
        coraTrim: [INK, '#0d3a38', '#1a7f72', '#2fcdb0', '#7ff5da'],
        coraBoot: [INK, '#0d1116', '#161c23', '#212931', '#2e3842', '#3f4a55'],
        coraSkin: [INK, '#4a2a36', '#84505a', '#b27c74', '#d2a28a', '#e6c2a4'],
        coraHair: [INK, '#353349', '#575570', '#7d7f9a', '#a2abbd', '#c0d0d4', '#d6ece2'],
        jaxSuit: [INK, '#13181c', '#1d2328', '#283037', '#353e46', '#47515a', '#5e6972'],
        jaxPant: [INK, '#16130f', '#221d18', '#302921', '#40372c', '#544838'],
        jaxBoot: [INK, '#120d0a', '#21170f', '#322317', '#463222', '#5c4330'],
        jaxSkin: [INK, '#3a1e12', '#5e3520', '#7a4a30', '#93583a', '#a5643f', '#bd7849'],
        jaxHair: [INK, '#0a0e12', '#121a20', '#1b242b', '#2a353d', '#4e585f'],
        jaxAmber: [INK, '#3a1a08', '#8f2a12', '#c4561c', '#e0761e', '#ffb52e'],
        arisSuit: [INK, '#2c2420', '#4a3e34', '#6e6050', '#94846c', '#b8a688', '#d2c2a0', '#e4d6b8'],
        arisRust: [INK, '#3a140c', '#62200f', '#8c3218', '#b44a22', '#d66832', '#f09050'],
        arisBoot: [INK, '#141018', '#221c28', '#322a3a', '#463c50'],
        arisSkin: [INK, '#3a0c1c', '#7a2234', '#b04a40', '#d8784c', '#e8995a', '#f4bc78'],
        arisHair: [INK, '#0e0418', '#1f0f32', '#3a1442', '#6e1a5a', '#b02a84', '#e055b0'],
        arisHelm: [INK, '#1e0a14', '#3a1222', '#5a1c30', '#7a2a40', '#9c4258'],
        arisCream: [INK, '#3a2c28', '#6e5a48', '#a8906a', '#d3b374', '#eedc9c'],
        band: [INK, '#3a3a3a', '#7a7a76', '#b8b6b0', '#e8e6e0'],
        vanSuit: [INK, '#1e1f27', '#33353f', '#4d505b', '#6b6e79', '#8f919a', '#b3b4b6', '#cac8c1'],
        vanDark: [INK, '#1b191d', '#2c282c', '#413a3b', '#594f4e'],
        vanGlove: [INK, '#22171a', '#3a2925', '#573c32', '#765443', '#94705a'],
        vanBoot: [INK, '#191a1e', '#2b2c31', '#404147', '#5a5b61', '#76777c'],
        vanSkin: [INK, '#43282a', '#74493f', '#a87560', '#cc9475', '#e3ae88'],
        vanHair: [INK, '#1f1f28', '#434755', '#5a5f6e', '#9a9fab', '#c2c5cd'],
        miraSuit: [INK, '#262820', '#40433a', '#62665a', '#868a7a', '#a8ac9a', '#c4c8b4', '#d8dcc8'],
        miraGold: [INK, '#5a3c10', '#a07a2a', '#e2c46a', '#ffe08a'],
        miraBoot: [INK, '#14110e', '#262019', '#3a3127', '#524537'],
        miraSkin: [INK, '#5a2a2c', '#975749', '#c27e5d', '#d99f70', '#ecc28c'],
        miraHair: [INK, '#120c10', '#1d151b', '#2a2128', '#3b3238', '#504a4c'],
        miraLock: [INK, '#0d3a38', '#1a7f72', '#2fcdb0'],
    };
    /** Each person: what their EVA suit and their ship clothes are made of. panel(u) picks the accent zones. */
    const LOOK = {
        cora: { eva: { shell: R.shell, panel: R.coraSuit, trim: R.coraTrim, boot: R.coraBoot, glove: R.coraSuit, ring: R.coraTrim },
                ship: { suit: R.coraSuit, trim: R.coraTrim, boot: R.coraBoot, glove: R.coraSuit, skin: R.coraSkin, hair: R.coraHair, hairDown: 0.55 },
                skin: R.coraSkin, build: 0.94 },
        jaxon: { eva: { shell: R.shell, panel: R.jaxSuit, trim: R.jaxAmber, boot: R.jaxBoot, glove: R.jaxPant, ring: R.jaxSuit },
                 ship: { suit: R.jaxSuit, trim: R.jaxAmber, legs: R.jaxPant, boot: R.jaxBoot, glove: R.jaxSuit, skin: R.jaxSkin, hair: R.jaxHair, hairDown: -0.2 },
                 skin: R.jaxSkin, build: 1.1 },
        aris: { eva: { shell: R.arisSuit, panel: R.arisRust, trim: R.band, boot: R.arisBoot, glove: R.arisSuit, ring: R.arisHelm },
                ship: { suit: R.arisSuit, trim: R.arisRust, boot: R.arisBoot, glove: R.arisSuit, skin: R.arisSkin, hair: R.arisHair, helm: R.arisHelm, goggles: R.arisCream, hairDown: 0.35 },
                skin: R.arisSkin, build: 0.96 },
        vance: { eva: { shell: R.vanSuit, panel: R.vanDark, trim: R.vanDark, boot: R.vanBoot, glove: R.vanGlove, ring: R.vanSuit },
                 ship: { suit: R.vanSuit, trim: R.vanDark, boot: R.vanBoot, glove: R.vanGlove, skin: R.vanSkin, hair: R.vanHair, spiky: true, hairDown: -0.1 },
                 skin: R.vanSkin, build: 1.12 },
        mira: { eva: { shell: R.miraSuit, panel: R.miraSuit, trim: R.miraGold, boot: R.miraBoot, glove: R.miraSuit, ring: R.miraGold },
                ship: { suit: R.miraSuit, trim: R.miraGold, boot: R.miraBoot, glove: R.miraSuit, skin: R.miraSkin, hair: R.miraHair, lock: R.miraLock, hairDown: 0.15 },
                skin: R.miraSkin, build: 0.9 },
    };

    const B8 = [0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22,
        3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21].map(v => (v + 0.5) / 64);
    const bay = (x, y) => B8[((y & 7) << 3) | (x & 7)];
    const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
    function tone(ramp, v, x, y) { const top = ramp.length - 1, pos = clamp01(v) * (top - 1) + 1, lo = Math.floor(pos); return ramp[Math.min(top, lo + (pos - lo > bay(x, y) ? 1 : 0))]; }

    // ── poses: angles in radians. Legs: hip swing (+ forward), knee bend (+ shin back). Arms: shoulder (+ forward), elbow
    //    (+ forearm forward). lean: the body about the hip (+ forward). drop: the hip lowered, in heights. tilt: all of it.
    const WALK_FRAMES = 8, WALK_MS = 125;
    function poseOf(name, frame) {
        const P = { lean: 0, drop: 0, tilt: 0, legs: [[0.06, 0.03], [-0.05, 0.02]], arms: [[0.12, 0.18], [-0.1, 0.12]] };
        if (name === 'walk') {
            const a = (frame / WALK_FRAMES) * Math.PI * 2, s = Math.sin(a);
            P.legs = [[0.42 * s, 0.75 * Math.max(0, -Math.sin(a + 0.9))], [-0.42 * s, 0.75 * Math.max(0, Math.sin(a + 0.9))]];
            P.arms = [[-0.38 * s, 0.25], [0.38 * s, 0.25]];
            P.drop = 0.012 * Math.abs(Math.cos(a)); P.lean = 0.05;
        } else if (name === 'kneel') {
            P.drop = 0.2; P.lean = 0.22;
            P.legs = [[1.35, 1.35], [-0.12, 1.6]];
            P.arms = [[0.95, 0.35], [0.7, 0.5]];
        } else if (name === 'reach') {
            P.lean = 0.08; P.arms = [[1.35, 0.15], [1.1, 0.35]];
        } else if (name === 'float') {
            P.tilt = 0.14; P.legs = [[-0.15, 0.55], [-0.38, 0.8]]; P.arms = [[0.7, 0.45], [-0.35, 0.3]];
        } else if (name === 'climb') {
            const up = frame % 2;
            P.legs = up ? [[0.7, 1.2], [0.05, 0.1]] : [[0.05, 0.1], [0.7, 1.2]];
            P.arms = up ? [[2.7, 0.2], [2.3, 0.5]] : [[2.3, 0.5], [2.7, 0.2]];
        }
        return P;
    }

    // ── a capsule body: segments with radii, lit per pixel, the nearest-in-front segment owns the pixel ──
    const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
    const rot = (p, o, a) => { const c = Math.cos(a), s = Math.sin(a), x = p[0] - o[0], y = p[1] - o[1]; return [o[0] + x * c - y * s, o[1] + x * s + y * c]; };
    /** A limb from `root` hanging down, swung by `a` (+ forward = +x), then the next bone bent by `b` from it. */
    function limb(root, l1, l2, a, b) {
        const j = [root[0] + Math.sin(a) * l1, root[1] + Math.cos(a) * l1];
        const end = [j[0] + Math.sin(a + b) * l2, j[1] + Math.cos(a + b) * l2];
        return [j, end];
    }
    function limbBack(root, l1, l2, a, b) {   // a leg: the knee bends the shin backward
        const j = [root[0] + Math.sin(a) * l1, root[1] + Math.cos(a) * l1];
        const end = [j[0] + Math.sin(a - b) * l2, j[1] + Math.cos(a - b) * l2];
        return [j, end];
    }

    /** The parts of one person in one pose, far side first, in cell pixels (feet at (ox, oy), facing right). */
    function build(id, suit, P, Hpx, ox, oy) {
        const L = LOOK[id], u = Hpx, k = L.build, bulky = suit ? 1.18 : 1, M = suit ? L.eva : L.ship;
        const hip = [ox, oy - u * (0.47 - P.drop)];
        const T = p => rot(p, hip, P.lean);                      // the upper body leans about the hip
        const chest = T([ox + 0.01 * u, oy - u * (0.71 - P.drop)]), sh = T([ox + 0.012 * u, oy - u * (0.735 - P.drop)]);
        const head = T([ox + 0.03 * u, oy - u * (0.875 - P.drop)]), headR = (suit ? 0.118 : 0.092) * u;
        const parts = [];
        const add = (a, b, r1, r2, mat, far, extra) => parts.push(Object.assign({ a, b, r1: Math.max(0.62, r1), r2: Math.max(0.62, r2), mat, far: !!far }, extra || {}));
        const legParts = (i, far) => {
            const [ha, kb] = P.legs[i], root = [hip[0] + (far ? -0.01 : 0.01) * u, hip[1]];
            const [knee, ankle] = limbBack(root, 0.235 * u, 0.215 * u, ha, kb);
            add(root, knee, 0.064 * u * k * bulky, 0.052 * u * k * bulky, M.legs ? 'legs' : 'suit', far, { zone: 'thigh' });
            add(knee, ankle, 0.052 * u * k * bulky, 0.045 * u * bulky, M.legs ? 'legs' : 'suit', far, { zone: 'shin' });
            const toe = [ankle[0] + Math.cos(ha - kb) * 0.075 * u, ankle[1] + Math.sin(ha - kb) * 0.02 * u];
            add(ankle, toe, 0.042 * u * bulky, 0.034 * u * bulky, 'boot', far);
        };
        const armParts = (i, far) => {
            const [sa, eb] = P.arms[i], root = [sh[0] + (far ? -0.02 : 0.015) * u, sh[1] + 0.01 * u];
            const [elbow, wrist] = limb(root, 0.17 * u, 0.155 * u, sa + P.lean, eb);
            add(root, elbow, 0.05 * u * k * bulky, 0.043 * u * bulky, 'suit', far, { zone: 'upper' });
            add(elbow, wrist, 0.043 * u * bulky, 0.04 * u * bulky, 'suit', far, { zone: 'fore' });
            add(wrist, wrist, 0.042 * u * bulky, 0.042 * u * bulky, 'glove', far);
        };
        armParts(1, true);
        legParts(1, true);
        if (suit) { const p0 = T([ox - 0.13 * u, oy - u * (0.56 - P.drop)]), p1 = T([ox - 0.125 * u, oy - u * (0.75 - P.drop)]); add(p0, p1, 0.078 * u, 0.082 * u, 'pack', false, { boxy: true }); }
        add(hip, chest, 0.1 * u * k * bulky, 0.112 * u * k * bulky, 'suit', false, { zone: 'torso', hip, chest });
        legParts(0, false);
        if (suit) add(sh, T([ox + 0.02 * u, oy - u * (0.775 - P.drop)]), 0.085 * u * bulky, 0.08 * u * bulky, 'ring', false, { zone: 'collar' });
        add(head, head, headR, headR, suit ? 'helmet' : 'head', false, { centre: head, r: headR });
        armParts(0, false);
        return parts;
    }

    /** The material at one pixel of a part: a ramp, and how much the light counts. */
    function materialAt(id, suit, part, nx, ny, along, Hpx) {
        const L = LOOK[id], M = suit ? L.eva : L.ship;
        switch (part.mat) {
            case 'boot': return M.boot;
            case 'glove': return M.glove;
            case 'pack': return R.pack;
            case 'legs': return M.legs || M.suit;
            case 'ring': return suit ? M.ring : M.suit;
            case 'helmet': {
                if (nx > 0.18 && ny > -0.55 && ny < 0.42 && nx + ny * 0.2 > 0.22) {            // the visor
                    const isFace = Hpx >= 26 && nx > 0.3 && nx < 0.8 && ny > -0.28 && ny < 0.3;
                    return isFace ? 'face' : 'visor';
                }
                if (id === 'aris' && ny < -0.62) return R.arisHelm;                             // her maroon crown, even outside
                return M.shell;
            }
            case 'head': {
                const S = L.ship;
                if (S.helm && ny < -0.05) return Math.abs(ny + 0.22) < 0.12 && nx > -0.1 ? S.goggles : S.helm;
                const hairLine = S.spiky ? -0.32 - 0.18 * Math.abs(Math.sin(nx * 9)) : -0.3;
                if (ny < hairLine || (nx < -0.35 && ny < S.hairDown)) return S.lock && nx > 0.55 && ny > -0.5 ? S.lock : S.hair;
                return S.skin;
            }
            default: {                                                                          // the suit
                if (!suit) {
                    if (part.zone === 'torso' && Math.abs(nx - 0.55) < 0.12 && Hpx >= 18) return M.trim;   // a stripe down the front
                    if (part.zone === 'fore' && along > 0.82) return M.trim;                     // cuffs
                    return M.suit;
                }
                if (part.zone === 'torso' && Math.abs(along - 0.62) < 0.09) return M.trim;      // a band across the chest
                if (part.zone === 'thigh' && along < 0.45) return M.panel;                        // panels over hips and shoulders
                if (part.zone === 'upper' && along < 0.5) return M.panel;
                if (part.zone === 'shin' && along > 0.72) return M.trim;                         // a band above the boot
                return M.shell;
            }
        }
    }

    const cache = new Map();
    function bake(id, pose, frame, Hpx, facing, suit, lightSide, warm, dim) {
        const key = [id, pose, frame, Hpx, facing, +suit, lightSide, warm, dim].join('|');
        if (cache.has(key)) return cache.get(key);
        const lying = pose === 'lie', P = poseOf(lying ? 'stand' : pose, frame);
        const CW = Math.ceil(Hpx * 0.9) + 4, CH = Hpx + 3, ox = Math.floor(CW / 2), oy = Hpx + 1;
        const parts = build(id, suit, P, Hpx, ox, oy);
        const lx = 0.48 * lightSide * facing, Lv = [lx, -0.62, 0.62], Ln = Math.hypot(...Lv), LL = Lv.map(v => v / Ln);
        const out = new Array(CW * CH).fill(null);
        for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
            let p = [x + 0.5, y + 0.5];
            if (P.tilt) p = rot(p, [ox, oy - Hpx * 0.5], -P.tilt);
            for (let i = parts.length - 1; i >= 0; i--) {
                const q = parts[i], ab = sub(q.b, q.a), ap = sub(p, q.a), len2 = ab[0] * ab[0] + ab[1] * ab[1];
                const t = len2 ? clamp01((ap[0] * ab[0] + ap[1] * ab[1]) / len2) : 0;
                const c = [q.a[0] + ab[0] * t, q.a[1] + ab[1] * t], o = sub(p, c), d = Math.hypot(o[0], o[1]), r = q.r1 + (q.r2 - q.r1) * t;
                if (d > r) continue;
                const nx = o[0] / r, ny = o[1] / r, nz = Math.sqrt(Math.max(0, 1 - (d / r) ** 2));
                let lum = 0.16 + 0.84 * Math.max(0, nx * LL[0] + ny * LL[1] + nz * LL[2]);
                if (q.far) lum *= 0.62;
                if (d > r - 0.9 && nx * LL[0] + ny * LL[1] > 0.25) lum = Math.min(1, lum + 0.18);   // the lit edge
                const hx = q.centre ? (p[0] - q.centre[0]) / q.r : nx, hy = q.centre ? (p[1] - q.centre[1]) / q.r : ny;
                const mat = materialAt(id, suit, q, hx, hy, t, Hpx);
                let col;
                if (mat === 'visor') {
                    const glint = hx > 0.35 && hx < 0.62 && hy > -0.48 && hy < -0.22 && lightSide * facing > 0;
                    col = glint && Hpx >= 10 ? R.visor[6] : tone(R.visor, 0.12 + 0.4 * Math.max(0, hx * LL[0] + hy * LL[1] + 0.3), x, y);
                } else if (mat === 'face') col = tone(LOOK[id].skin, 0.18 + 0.42 * lum, x, y);
                else col = tone(mat, lum * (1 - dim * 0.55), x, y);
                if (warm && nx * lightSide * facing > 0.1) col = MiniLab.mix(col, '#f0a860', 0.18 * warm);
                out[y * CW + x] = col;
                break;
            }
        }
        // bake: mirror for facing left (the light was already mirrored), lay down for 'lie'
        let w = CW, h = CH, px = out, fx = ox, fy = oy;
        if (facing < 0) { const m = new Array(w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) m[y * w + x] = px[y * w + (w - 1 - x)]; px = m; fx = w - 1 - ox; }
        if (lying) {                                                                          // on its back, head toward facing
            const nw = h, nh = w, turned = new Array(nw * nh).fill(null);
            for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
                const c = px[y * w + x];
                if (c) turned[facing > 0 ? (w - 1 - x) * nw + (h - 1 - y) : x * nw + y] = c;
            }
            px = turned; w = nw; h = nh; fx = Math.floor(nw / 2); fy = nh - 1;
            let low = 0; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (px[y * w + x]) low = y;
            fy = low + 1;
        }
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
        const g = cv.getContext('2d'), img = g.createImageData(w, h);
        px.forEach((c, i) => { if (!c) return; const n = parseInt(c.slice(1), 16); img.data[i * 4] = n >> 16; img.data[i * 4 + 1] = (n >> 8) & 255; img.data[i * 4 + 2] = n & 255; img.data[i * 4 + 3] = 255; });
        g.putImageData(img, 0, 0);
        const S = { canvas: cv, w, h, ox: fx, oy: fy };
        if (cache.size > 600) cache.clear();
        cache.set(key, S);
        return S;
    }

    function small(ctx, who, x, feetY, o = {}) {
        const id = idOf(who) || 'cora', d = MiniLab.inArt(ctx, (c, k) => k), Hpx = Math.max(6, Math.round((o.h || 9) * d));
        const pose = o.pose || 'stand', frame = pose === 'walk' ? Math.floor((o.t || 0) / WALK_MS) % WALK_FRAMES : pose === 'climb' ? Math.floor((o.t || 0) / 220) % 2 : 0;
        const S = bake(id, pose, frame, Hpx, o.facing < 0 ? -1 : 1, o.suit !== false, o.light < 0 ? -1 : 1, Math.round(clamp01(o.warm || 0) * 4) / 4, Math.round(clamp01(o.dim || 0) * 4) / 4);
        MiniLab.inArt(ctx, (c, k) => c.drawImage(S.canvas, Math.round(x * k) - S.ox, Math.round(feetY * k) - S.oy));
        return { w: S.w / d, h: S.h / d };
    }

    window.MiniCrew = Object.freeze({ IDS: Object.freeze(IDS.slice()), NAMES: Object.freeze(NAMES), TONE, ACTIONS: Object.freeze(ACTIONS), PERSON_ART_H, idOf, person, small });
})();
