/* Silent Exodus — crew sprites: the shared skeleton and renderer.
   Every character moves with the same pose tables below; a character file (cora.js, jaxon.js, …) only supplies a
   costume (palette + little pixel maps) through CrewSprites.register(). The API is documented at the top of
   crew-study.html and in docs/CREW_SPRITES.md.

   Space: one unit = one sprite pixel. Origin (0, 0) is the ground under the hips; feet stand on row -1; +x is the
   way the figure faces (drawn facing right, mirrored for left). The standard body is 24 rows:
   head 6 rows (-24..-19) · collar 1 (-18) · torso 6 (-17..-12, hip row -12) · legs 11 (-11..-1). */
(function () {
    'use strict';
    const INK = '#05070a';
    const ARM = [4, 4], LEG = [5, 5];                       // upper arm, forearm · thigh, shin
    const HIP_Y = -12;
    const CRATE = ['#121816', '#26302c', '#43524b', '#6f8278'];   // the box you carry: a machine thing, so cool
    const CRATE_LABEL = '#a89a70';
    const SCREEN_LIGHT = '#a6eeff';

    // ── 1. Pose tables ───────────────────────────────────────────────────────────────────────────────────────
    // A pose: hip [x,y] · lean (shoulder x minus hip x) · squash (torso rows dropped, for breathing) ·
    // feet [[near],[far]] sole points (ground rows) · knees (optional, absolute) · hands [[near],[far]] relative
    // to that arm's shoulder joint (or absolute y when handY: 'abs') · elbows (optional, relative) ·
    // head [dx,dy] · headView 'side' | 'down' | 'back' · view 'side' | 'back' · lying (rotate to lie on the back) ·
    // blink · light 'screen' · box [dx,dy] (top-left of the crate, relative to the shoulder joint).
    const BASE = { view: 'side', hip: [0, HIP_Y], lean: 0, squash: 0, head: [0, 0], feet: [[1, -1], [-1, -1]], hands: [[0, 8], [-1, 8]] };

    const W_FOOT = [3, 1, -1, -3, -1, 1];                  // near foot, relative to the hips: 4 frames planted, 2 swinging
    const W_SOLE = [-1, -1, -1, -1, -3, -2];               // planted feet move back 2 px a frame = the walk speed: no sliding
    const W_HIP = [HIP_Y + 1, HIP_Y, HIP_Y, HIP_Y + 1, HIP_Y, HIP_Y];   // down on contact, up on passing: the head bob
    const W_SWING = [-2, -1, 1, 2, 1, -1];                 // near hand, opposite the near foot
    function walkPose(f, hands, extra) {
        const g = (f + 3) % 6, s = W_SWING[f], drop = Math.abs(s) > 1 ? 7 : 8;
        return Object.assign({ hip: [0, W_HIP[f]], feet: [[W_FOOT[f], W_SOLE[f]], [W_FOOT[g], W_SOLE[g]]],
            hands: hands || [[s, drop], [-s, drop]] }, extra);
    }
    // Climbing, seen from behind. Hands and feet hold rungs 4 px apart while the body rises 1 px a frame; each hand
    // or foot jumps one rung up once a cycle, left hand with right foot. Hand y is absolute so rungs line up for all.
    const C_HAND = [[-24, -23, -22, -25], [-22, -25, -24, -23]], C_FOOT = [[-1, -4, -3, -2], [-3, -2, -1, -4]];
    const climbPose = f => ({ view: 'back', handY: 'abs', hands: [[-1, C_HAND[0][f]], [1, C_HAND[1][f]]],
        feet: [[-2, C_FOOT[0][f]], [1, C_FOOT[1][f]]] });

    const SIT = { hip: [-1, -7], knees: [[4, -7], [3, -7]], feet: [[4, -1], [3, -1]], hands: [[4, 5], [3, 5]] };
    const TEND = { hip: [-1, -7], lean: 3, head: [1, 1], headView: 'down', knees: [[3, -7], [-1, -2]], feet: [[3, -1], [-7, -1]] };
    const WALL = { lean: 1, feet: [[1, -1], [0, -1]], headView: 'down' };
    const CONSOLE = { lean: 1, head: [1, 0], feet: [[1, -1], [-1, -1]], light: 'screen' };

    const ACTIONS = {
        idle: { label: 'Idle, breathing', ms: [700, 900, 700, 140], frames: [{}, { squash: 1 }, {}, { blink: true }] },
        walk: { label: 'Walk', ms: 125, move: [2, 0], frames: [0, 1, 2, 3, 4, 5].map(f => walkPose(f)) },
        console: { label: 'Work at a console', ms: 170, frames: [[[4, 5], [3, 5]], [[4, 4], [3, 5]], [[5, 5], [3, 4]], [[4, 5], [3, 5]]]
            .map(hands => Object.assign({}, CONSOLE, { hands })) },
        climb: { label: 'Climb a ladder', ms: 160, move: [0, -1], frames: [0, 1, 2, 3].map(climbPose) },
        sit: { label: 'Sit', ms: 1100, frames: [Object.assign({}, SIT), Object.assign({}, SIT, { squash: 1 })] },
        sleep: { label: 'Sleep in a bunk', ms: 1400, frames: [{ lying: true, blink: true, feet: [[0, -1], [0, -1]], hands: [[0, 8], [-1, 8]] },
            { lying: true, blink: true, squash: 1, feet: [[0, -1], [0, -1]], hands: [[0, 8], [-1, 8]] }] },
        tend: { label: 'Kneel and tend someone', ms: 280, frames: [[[4, 7], [3, 8]], [[4, 8], [3, 8]], [[4, 7], [3, 7]], [[5, 7], [3, 8]]]
            .map(hands => Object.assign({}, TEND, { hands })) },
        carry: { label: 'Carry a box', ms: 150, move: [2, 0], frames: [0, 1, 2, 3, 4, 5].map(f => walkPose(f, [[4, 3], [4, 3]], { box: [1, 1] })) },
        wall: { label: 'Alone, facing a wall', ms: 1300, frames: [
            Object.assign({}, WALL, { head: [1, 1], hands: [[5, 0], [0, 8]] }),          // one hand flat on the wall, head bowed
            Object.assign({}, WALL, { head: [1, 1], hands: [[5, 0], [0, 8]], squash: 1 }),
            Object.assign({}, WALL, { head: [1, 2], hands: [[5, 1], [0, 8]] }),          // the hand slides, the head sinks
            Object.assign({}, WALL, { head: [1, 2], hands: [[5, 1], [0, 8]], squash: 1 })] },
    };
    // Standing still, each person has one habit for their arms (chosen in their costume as `idle`).
    const IDLE_ARMS = {
        hang: { hands: [[0, 8], [-1, 8]] },
        behind: { hands: [[-3, 6], [-3, 6]] },
        crossed: { hands: [[3, 3], [2, 2]], elbows: [[0, 4], [-1, 4]] },
        hips: { hands: [[1, 5], [1, 5]], elbows: [[-2, 3], [-2, 3]] },
    };

    // ── 2. Geometry ──────────────────────────────────────────────────────────────────────────────────────────
    /** Two-bone reach: the middle joint between root a and tip b, bent toward `pref`. */
    function bend(a, b, l1, l2, pref) {
        const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy);
        if (d < 1e-6) return [a[0], a[1] + l1];
        if (d >= l1 + l2 - 0.01) return [a[0] + dx * l1 / (l1 + l2), a[1] + dy * l1 / (l1 + l2)];
        const ux = dx / d, uy = dy / d, along = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - along * along));
        let px = -uy, py = ux;
        if (px * pref[0] + py * pref[1] < 0) { px = -px; py = -py; }
        return [a[0] + ux * along + px * h, a[1] + uy * along + py * h];
    }
    function linePts(a, b) {
        const ax = Math.round(a[0]), ay = Math.round(a[1]), bx = Math.round(b[0]), by = Math.round(b[1]);
        const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay), 1), out = [];
        for (let i = 0; i <= n; i++) out.push([Math.round(ax + (bx - ax) * i / n), Math.round(ay + (by - ay) * i / n), Math.abs(by - ay) >= Math.abs(bx - ax)]);
        return out;
    }
    /** A limb's pixels from root through joint to tip, `w` wide; the last row of pixels is the tip (hand or ankle). */
    function limbPts(root, joint, tip, w) {
        const pts = linePts(root, joint).concat(linePts(joint, tip).slice(1)), cells = [];
        pts.forEach(([x, y, upright], i) => {
            const end = i >= pts.length - 1 ? 'tip' : i === pts.length - 2 ? 'cuff' : '';
            cells.push([x, y, end]);
            if (w > 1) cells.push(upright ? [x + 1, y, end] : [x, y + 1, end]);
        });
        return cells;
    }

    // ── 3. Costumes ──────────────────────────────────────────────────────────────────────────────────────────
    const COSTUMES = new Map(), CACHE = new Map();
    function parseKeys(c) {
        const keys = {};
        Object.entries(c.keys).forEach(([ch, spec]) => {
            const [mat, tone] = String(spec).split(':');
            if (!c.palette[mat]) throw new Error(`crew ${c.id}: key "${ch}" uses unknown material "${mat}"`);
            keys[ch] = [mat, Number(tone) || 0];
        });
        return keys;
    }
    function checkMap(c, where, m) {
        if (!m || !Array.isArray(m.map)) throw new Error(`crew ${c.id}: ${where} needs a map`);
        m.map.forEach(row => [...row].forEach(ch => { if (ch !== '.' && ch !== ' ' && !c._keys[ch]) throw new Error(`crew ${c.id}: ${where} uses key "${ch}" that is not in keys`); }));
    }
    function register(costume) {
        const c = Object.assign({ idle: 'hang', neckX: 0, shoulderX: 0, backShoulder: 3, limbs: {} }, costume);
        if (!c.id || !c.palette || !c.keys || !c.head || !c.torso) throw new Error('CrewSprites.register: id, palette, keys, head and torso are required');
        c.limbs = Object.assign({ arm: 'suit', hand: 'skin', leg: 'suit', foot: 'boot', armWidth: 2, legWidth: 2, bootRows: 1 }, c.limbs);
        ['arm', 'hand', 'leg', 'foot'].forEach(k => { if (!c.palette[c.limbs[k]]) throw new Error(`crew ${c.id}: limbs.${k} "${c.limbs[k]}" is not in palette`); });
        c._keys = parseKeys(c);
        checkMap(c, 'head.side', c.head.side); checkMap(c, 'head.back', c.head.back);
        checkMap(c, 'torso.side', c.torso.side); checkMap(c, 'torso.back', c.torso.back);
        if (c.head.down) checkMap(c, 'head.down', c.head.down);
        if (c.torso.side.map.length !== c.torso.back.map.length) throw new Error(`crew ${c.id}: torso.side and torso.back need the same number of rows`);
        COSTUMES.set(c.id, c);
        [...CACHE.keys()].forEach(k => { if (k.startsWith(c.id + '|')) CACHE.delete(k); });
        return c;
    }

    // ── 4. Drawing one frame into a pixel table ─────────────────────────────────────────────────────────────
    function grid(c) {
        const cells = new Map();
        const hexOf = (mat, tone) => { const r = c.palette[mat] || CRATE; return r[Math.max(0, Math.min(r.length - 1, tone))]; };
        const put = (x, y, mat, tone, layer = 'body') => cells.set(x + ',' + y, { x, y, hex: hexOf(mat, tone), mat, tone, layer });
        const putHex = (x, y, hex, layer = 'prop') => cells.set(x + ',' + y, { x, y, hex, mat: 'prop', tone: 0, layer });
        const has = (x, y) => cells.has(x + ',' + y);
        return { cells, put, putHex, has, hexOf };
    }
    /** Stamps a pixel map so that map cell (ax, ay) lands on (x, y). `skip` drops one row (breathing). */
    function stamp(g, c, m, x, y, layer, opts = {}) {
        const rows = m.map.filter((_, r) => r !== opts.skip), ax = m.anchor[0], ay = m.anchor[1] - (opts.skip != null && opts.skip < m.anchor[1] ? 1 : 0);
        rows.forEach((row, r) => [...row].forEach((ch, i) => {
            if (ch === '.' || ch === ' ') return;
            const key = opts.swap && opts.swap[ch] ? opts.swap[ch] : ch, [mat, tone] = c._keys[key];
            const sx = typeof opts.shear === 'function' ? opts.shear(r) : 0;
            g.put(x + i - ax + sx, y + r - ay, mat, tone, layer);
        }));
    }
    function drawTorso(g, c, p, S, hip) {
        const m = c.torso[p.view], rows = m.map.length - p.squash, skip = p.squash ? (m.squash != null ? m.squash : Math.floor(m.map.length / 2)) : null;
        const shear = r => Math.round((hip[0] - S[0]) * (rows > 1 ? r / (rows - 1) : 0));
        stamp(g, c, { map: m.map, anchor: [m.spine, 0] }, S[0], S[1], 'torso', { skip, shear });
    }
    function drawHead(g, c, p, S) {
        const view = p.view === 'back' ? 'back' : (p.headView === 'down' && c.head.down ? 'down' : 'side');
        const m = c.head[view], nx = S[0] + (p.view === 'back' ? 0 : c.neckX) + p.head[0], ny = S[1] - 1 + p.head[1];
        const swap = p.blink && c.blink ? { [c.blink[0]]: c.blink[1] } : null;
        stamp(g, c, m, nx, ny, 'head', { swap });
        return [nx, ny];
    }
    /** Arms and legs are drawn, not mapped: two lines, shaded by the rule (near: mid, front edge lit when `rim`; far: dark). */
    function drawLimb(g, c, cells, mat, tipMat, cuffMat, isNear, layer) {
        const set = new Set(cells.map(([x, y]) => x + ',' + y)), rim = c.limbs.rim;
        cells.forEach(([x, y, end]) => {
            const m = end === 'tip' ? tipMat : end === 'cuff' && cuffMat ? cuffMat : mat;
            const front = !set.has((x + 1) + ',' + y);
            const tone = !isNear ? 0 : front && (rim || end === 'tip') ? 2 : 1;
            g.put(x, y, m, tone, layer);
        });
    }
    function drawBoot(g, c, foot, isNear, view, layer) {
        const [fx, fy] = foot, mat = c.limbs.foot, rows = c.limbs.bootRows;
        for (let r = 0; r <= rows; r++) {
            const y = fy - r, w = view === 'back' || r > 0 ? 2 : 3;
            for (let i = 0; i < w; i++) {
                const isToe = i === w - 1 && view !== 'back';
                g.put(fx + i, y, mat, !isNear ? 0 : r === 0 && !isToe ? 0 : isToe ? 2 : 1, layer);
            }
        }
    }
    function drawLeg(g, c, p, i, rootX, view) {
        const hipY = p.hip[1], foot = p.feet[i], ankle = [foot[0], foot[1] - 1 - (c.limbs.bootRows - 1)], root = [rootX, hipY];
        // seen from behind, a bent knee points away from us: the leg just looks shorter, so it stays a straight line
        const knee = p.knees && p.knees[i] ? p.knees[i] : view === 'back' ? [(root[0] + ankle[0]) / 2, (root[1] + ankle[1]) / 2] : bend(root, ankle, LEG[0], LEG[1], [1, 0]);
        const isNear = view === 'back' || i === 0, layer = isNear ? 'legN' : 'legF';
        drawLimb(g, c, limbPts(root, knee, ankle, c.limbs.legWidth), c.limbs.leg, c.limbs.leg, null, isNear, layer);
        drawBoot(g, c, foot, isNear, view, layer);
    }
    function drawArm(g, c, p, i, J, view) {
        const h = p.hands[i], hand = [J[0] + h[0], p.handY === 'abs' ? h[1] : J[1] + h[1]];
        const pref = view === 'back' ? [i === 0 ? -1 : 1, 0.3] : [-0.4, 1];             // elbows bend down and back
        const elbow = p.elbows && p.elbows[i] ? [J[0] + p.elbows[i][0], J[1] + p.elbows[i][1]] : bend(J, hand, ARM[0], ARM[1], pref);
        const isNear = view === 'back' || i === 0;
        drawLimb(g, c, limbPts(J, elbow, hand, c.limbs.armWidth), c.limbs.arm, c.limbs.hand, c.limbs.cuff, isNear, isNear ? 'armN' : 'armF');
        return hand;
    }
    function drawBox(g, J, at) {
        const x0 = J[0] + at[0], y0 = J[1] + at[1], W = 6, H = 5;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const tone = y === 0 ? 3 : y === H - 1 ? 0 : x === W - 1 ? 2 : 1;
            g.putHex(x0 + x, y0 + y, CRATE[tone], 'box');
        }
        g.putHex(x0 + 2, y0 + 2, CRATE_LABEL, 'box'); g.putHex(x0 + 3, y0 + 2, CRATE_LABEL, 'box');
    }
    function poseFor(c, action, f) {
        const act = ACTIONS[action];
        if (!act) throw new Error('CrewSprites: unknown action ' + action);
        const p = Object.assign({}, BASE, act.frames[f % act.frames.length]);
        return action === 'idle' ? Object.assign(p, IDLE_ARMS[c.idle] || IDLE_ARMS.hang) : p;
    }
    function compose(c, action, f) {
        const p = poseFor(c, action, f), g = grid(c), back = p.view === 'back';
        const rows = c.torso[p.view].map.length - p.squash, hip = p.hip, S = [hip[0] + p.lean, hip[1] - (rows - 1)];
        const J = back ? null : [S[0] + c.shoulderX, S[1] + 1], Jf = back ? null : [J[0] - 1, J[1]];
        const api = { put: (x, y, mat, tone) => g.put(x, y, mat, tone, 'extra'), has: g.has, view: p.view, action, frame: f, pose: p, S, J, hip, neck: null, hands: [] };
        if (c.extras) c.extras(api, 'back');
        if (back) {
            [0, 1].forEach(i => drawLeg(g, c, p, i, hip[0] + (i === 0 ? -2 : 1), 'back'));
            drawTorso(g, c, p, S, hip);
            const Js = [[S[0] - c.backShoulder - 1, S[1] + 1], [S[0] + c.backShoulder, S[1] + 1]];
            api.hands = [0, 1].map(i => drawArm(g, c, p, i, Js[i], 'back'));
            api.neck = drawHead(g, c, p, S);
        } else {
            api.hands[1] = drawArm(g, c, p, 1, Jf, 'side');
            drawLeg(g, c, p, 1, hip[0] - 1, 'side');
            drawLeg(g, c, p, 0, hip[0], 'side');
            drawTorso(g, c, p, S, hip);
            api.neck = drawHead(g, c, p, S);
            if (p.box) drawBox(g, J, p.box);
            api.hands[0] = drawArm(g, c, p, 0, J, 'side');
        }
        if (c.extras) c.extras(api, 'front');
        if (p.light === 'screen') lightFace(g);
        return { cells: [...g.cells.values()], lying: !!p.lying };
    }
    /** The console screen lights whatever faces it: front edges of the face and the near hand. */
    function lightFace(g) {
        g.cells.forEach(cell => {
            if ((cell.layer === 'head' || cell.layer === 'armN') && !g.has(cell.x + 1, cell.y) && cell.y > -26) cell.hex = mixHex(cell.hex, SCREEN_LIGHT, cell.layer === 'head' ? 0.42 : 0.3);
        });
    }
    function mixHex(a, b, t) {
        const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)), x = p(a), y = p(b);
        return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
    }
    /** Lying on the back: the standing frame turned a quarter (head to the left, face up), resting on row -1. */
    function layDown(cells) {
        const turned = cells.map(cl => Object.assign({}, cl, { x: cl.y, y: -cl.x }));
        const maxY = Math.max(...turned.map(cl => cl.y)), minX = Math.min(...turned.map(cl => cl.x)), maxX = Math.max(...turned.map(cl => cl.x));
        const dx = -Math.round((minX + maxX) / 2), dy = -1 - maxY;
        return turned.map(cl => Object.assign(cl, { x: cl.x + dx, y: cl.y + dy }));
    }

    // ── 5. Public API ────────────────────────────────────────────────────────────────────────────────────────
    /** [[x, y, hex], …] for one frame, facing right, feet on row -1. Cached. */
    function pixels(id, action, frame) {
        const c = COSTUMES.get(id);
        if (!c) throw new Error('CrewSprites: no costume registered for ' + id);
        const n = ACTIONS[action].frames.length, f = ((frame % n) + n) % n, key = id + '|' + action + '|' + f;
        if (!CACHE.has(key)) {
            const out = compose(c, action, f), cells = out.lying ? layDown(out.cells) : out.cells;
            CACHE.set(key, cells.map(cl => [cl.x, cl.y, cl.hex]));
        }
        return CACHE.get(key);
    }
    /** Draws one frame on a low-res context: feet on row feetY, at column x. opts.dir -1 faces left. */
    function draw(ctx, id, action, frame, x, feetY, opts = {}) {
        const flip = (opts.dir || 1) < 0 && action !== 'climb', X = Math.round(x), Y = Math.round(feetY) + 1;
        let cur = null;
        pixels(id, action, frame).forEach(([px, py, hex]) => {
            if (hex !== cur) { ctx.fillStyle = hex; cur = hex; }
            ctx.fillRect(X + (flip ? -px : px), Y + py, 1, 1);
        });
    }
    /** Which frame an action shows `ms` after it started (its timing loops). */
    function frameAt(action, ms) {
        const act = ACTIONS[action], n = act.frames.length;
        if (typeof act.ms === 'number') return Math.floor(ms / act.ms) % n;
        const total = act.ms.reduce((a, b) => a + b, 0);
        let t = ((ms % total) + total) % total;
        for (let i = 0; i < n; i++) { if (t < act.ms[i]) return i; t -= act.ms[i]; }
        return n - 1;
    }
    /** How many frames have passed (for actions that move: x += move[0] each frame). */
    const stepsAt = (action, ms) => Math.floor(ms / (typeof ACTIONS[action].ms === 'number' ? ACTIONS[action].ms : 1e9));

    window.CrewSprites = {
        INK, HIP_Y, ACTIONS, IDLE_ARMS, CRATE,
        register, pixels, draw, frameAt, stepsAt, mixHex,
        get: id => COSTUMES.get(id),
        list: () => [...COSTUMES.values()],
    };
})();
