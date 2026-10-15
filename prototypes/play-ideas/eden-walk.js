/* ═══ Silent Exodus · play ideas · eden-walk.js: EDEN'S WALK, played ═══════════════════════════════════════════════════════
   The idea: Eden is a lovely Earth-like world beside the light, and it is a trap that wants crews to stay. Nothing says so.
   Jaxon and Aris walk slowly across a meadow for about a minute. A few things are slightly wrong, and the player can click
   anything: a wrong thing makes one of them notice it in one plain line. A normal thing pointed at is a false alarm: they
   relax, and every second false alarm talks away one thing they noticed (the meadow wins them back). Doubt is what they
   noticed minus that; three and they go back to the ship, fewer and they want to stay. The decision: look closely before
   you point, because clicking everything costs.

   THE SEVEN WRONG THINGS (ODD below): the same bird flies past again, the same way; the wind is in their words but the grass
   never moves; one tree has no shadow; two clouds are the same cloud; one flower patch tiles like a floor; the sun never
   moves (it only counts once they have walked a while); their footprints vanish a second behind them.
   Some looks are neither: a bird's first pass and the sun early on get a plain answer that costs nothing (they cannot be
   wrong yet).

   Pictures: eden-walk-art.js (painted once). People: MiniCrew.small (the crew-hires people in their EVA suits). The tools of
   the picture (framer, the dither) are MiniPaint's; the words are reading.css's, as on the other ideas' pages.
   NO SOUND: no AudioSystem is loaded, and nothing here makes any.
   Test hooks: ?speed=N runs the clock N times as fast; window.edenWalk.state() / targets() / pointFor(id) / start(). */
(function () {
    'use strict';
    const Paint = window.MiniPaint, Crew = window.MiniCrew, Art = window.EdenArt;
    if (!Paint || !Crew || !Art) { console.error('eden-walk: the art did not load (MiniLab.js, eden-walk-art.js)'); return; }
    const { W, H, SUN, FACTOR, CLOUD_DRIFT } = Art;
    const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

    const query = new URLSearchParams(location.search);
    const SPEED = clamp(Number(query.get('speed')) || 1, 0.25, 10);

    // ── the walk ──
    const WALK_SECS = 64, WALK_PX = 25, WALK_EASE = 1.5;        // how long, how fast (art px a second), how gently they set off
    const TRAVEL = WALK_SECS * WALK_PX;
    const ANIM_RATE = 0.72;                                     // the walk cycle slowed to the slow pace, so feet do not skate
    const STEP_SECS = (8 * 125 / ANIM_RATE) / 2 / 1000;         // one footfall: half the 8-frame cycle
    const PRINT_LIFE = 1.6;                                     // a footprint is there this long, then simply gone
    const PEOPLE = [                                            // far one first: Jaxon leads, Aris a step behind and nearer
        { id: 'jaxon', x: 292, feet: 299, h: 52, lag: 0 },
        { id: 'aris', x: 250, feet: 306, h: 54, lag: 310 },
    ];
    const TRAIL = { back: 170, near: 8, top: 290, bottom: 316 };   // the ground behind them, where footprints should be
    const DOUBT_TO_LEAVE = 3, CALMS_PER_DOUBT = 2;              // doubt needed to go back; false alarms that undo one find
    const SUN_ODD_AT = 28;                                      // s: before this the sun "not moving" is not strange yet
    const LINE_HOLD = 3.2, LINE_SHOW = 4.2, REACT_AFTER = 2.4, LOOK_REPEAT = 1.2;   // s: script spacing; a line's stay; an answer; a double click
    const OVERDUE = 2.5, MIN_GAP = 1.2;                         // a script line this late speaks over clicking, after a short gap
    const END = { line: 1.0, turn: 2.6, buttons: 3.8 };          // seconds after the walk ends

    // ── what they say (docs/STYLE.md: plain, one idea a line) ──
    const SCRIPT = [
        { at: 2, who: 'aura', line: 'Air and gravity are normal, Commander. It is safe to walk.' },
        { at: 6, who: 'jaxon', line: "Look at this place. It's like home." },
        { at: 11, who: 'jaxon', line: 'Hear that? Wind, on the suit mic. Real wind.', wind: true },
        { at: 19, who: 'aris', line: "Birds, too. I didn't think we'd hear birds again." },
        { at: 29, who: 'jaxon', line: 'My daughter would have loved this.' },
        { at: 39, who: 'aris', line: "I haven't felt this calm since the launch.", uneasy: { who: 'aris', line: 'Stay close to me, Jaxon.' } },
        { at: 48, who: 'jaxon', line: 'We could build a house right there, by the trees.', uneasy: { who: 'jaxon', line: "It's very quiet. No insects at all." } },
        { at: 57, who: 'jaxon', line: 'Just a little further. Please.', uneasy: { who: 'aris', line: "We've seen enough. Let's go." } },
    ];
    const ODD = {
        bird: { who: 'jaxon', line: 'That bird again. Same bird, same way.' },
        grass: { who: 'aris', line: "There's wind, but the grass isn't moving at all." },
        tree: { who: 'aris', line: 'That tree has no shadow. The others all do.' },
        cloud: { who: 'jaxon', line: 'Those two clouds are exactly the same.' },
        flowers: { who: 'jaxon', line: 'These flowers grow in perfect rows. Like floor tiles.' },
        sun: { who: 'aris', line: "We've walked a while. The sun hasn't moved at all." },
        trail: { who: 'aris', line: 'Look behind us. Our footprints are gone.' },
    };
    // said by the other one after a find, by how much doubt there is now
    const REACT = ["It's probably nothing.", "Don't spoil it. Keep walking.", "That's too many odd things. Something is wrong here."];
    // a look at something that cannot be wrong yet: a plain answer, no cost
    const NEUTRAL = { bird: { who: 'jaxon', line: 'A bird, flying past.' }, sun: { who: 'aris', line: "The sun's low. Lovely light." } };
    const CALM = {
        sky: ['Just sky.', 'Clear sky, all the way up.'],
        grass: ['Just grass.', 'Soft grass. Good colour.'],
        hills: ['Just hills.', 'Gentle hills. Easy walking.'],
        tree: ['Just a tree.', 'A big old tree. Nice shade.'],
        cloud: ['Just a cloud.', 'Nice cloud.'],
        bird: ['Just birds.', 'Birds. Real birds.'],
        fence: ['Just a fence.', 'An old wooden fence, like back home.'],
        bench: ['Just a bench.', 'A bench. I could sit there all day.'],
        flowers: ['Just flowers.', 'Little white flowers. Pretty.'],
        jaxon: ["I'm fine, Commander. Just enjoying it."],
        aris: ["I'm all right. It's so peaceful."],
    };
    // every second false alarm, said instead of the calm line: the meadow is winning them over
    const SOOTHED = [{ who: 'aris', line: "You're jumpy, Commander. It's only a meadow." },
        { who: 'jaxon', line: "See? Nothing's wrong here. I like it." }, { who: 'aris', line: 'Stop worrying, Commander. This place is lovely.' }];
    const ENDING = {
        leave: { who: 'aris', line: "Too much here is wrong. We're going back to the ship." },
        stay: { who: 'jaxon', line: "It's... nice here. Can we stay a bit?" },
    };
    const NAMES = { aura: 'A.U.R.A.', jaxon: 'Jaxon', aris: 'Aris' };

    // ── the birds: one comes past again and again, exactly the same; the others are different every time ──
    const BIRD = [['X.......X', '.X.....X.', '..XX.XX..', '....X....'], ['.........', 'XXX.X.XXX', '...XXX...', '.........'],
        ['.........', '...XXX...', '.XX.X.XX.', 'X.......X']];
    const SMALL_BIRD = [['X...X', '.X.X.', '..X..'], ['.....', 'XX.XX', '..X..'], ['.....', '.XXX.', 'X.X.X']];
    const BIRD_INK = '#16181e';
    const REPEAT_BIRD = { starts: [7, 25, 43], y: 104, speed: 56, dir: 1, phase: 0 };
    const OTHER_BIRDS = [
        { start: 16, y: 64, speed: 48, dir: -1, phase: 0.3 }, { start: 16.7, y: 71, speed: 46, dir: -1, phase: 0.8 },
        { start: 34, y: 44, speed: 38, dir: 1, phase: 0.1, small: true }, { start: 34.5, y: 50, speed: 39, dir: 1, phase: 0.6, small: true },
        { start: 34.9, y: 41, speed: 37, dir: 1, phase: 0.4, small: true }, { start: 52, y: 132, speed: 52, dir: -1, phase: 0.5 },
    ];
    /** Where a bird is tau seconds into its pass, and which wing frame shows (the same tau always gives the same answer). */
    function birdAt(b, tau) {
        const x = b.dir > 0 ? -16 + b.speed * tau : W + 16 - b.speed * tau;
        if (tau < 0 || x < -20 || x > W + 20) return null;
        const isGliding = Math.floor(tau / 1.4) % 3 === 2;
        const frame = isGliding ? 1 : [0, 1, 2, 1][Math.floor((tau + b.phase) * 9) % 4];
        return { x, y: b.y + 6 * Math.sin(tau * 1.1 + b.phase * 6), frame };
    }
    function birdsNow(t) {
        const out = [];
        REPEAT_BIRD.starts.forEach((s, pass) => { const at = birdAt(REPEAT_BIRD, t - s); if (at) out.push({ ...at, id: 'bird-rep', pass, isRepeat: true, dir: 1 }); });
        OTHER_BIRDS.forEach((b, i) => { const at = birdAt(b, t - b.start); if (at) out.push({ ...at, id: 'bird-' + i, isRepeat: false, small: !!b.small, dir: b.dir }); });
        return out;
    }

    // ── petals on the wind (so the wind is real everywhere but in the grass) ──
    const PETALS = Array.from({ length: 9 }, (_, i) => ({ y: 250 + Paint.hash(i, 1, 81) * 70, speed: 14 + Paint.hash(i, 2, 81) * 12,
        off: Paint.hash(i, 3, 81) * 700, phase: Paint.hash(i, 4, 81) * 6, hex: ['#f6eedc', '#d8ccb4', '#f2cc5a', '#b49ad0'][i % 4] }));

    // ── the page ──
    const canvas = document.getElementById('scene'), ctx = canvas.getContext('2d');
    const els = {
        stage: document.getElementById('stage'), start: document.getElementById('start'), end: document.getElementById('end'),
        voice: document.getElementById('voice'), who: document.getElementById('voice-who'),
        name: document.getElementById('voice-name'), line: document.getElementById('voice-line'), again: document.getElementById('again'),
    };
    canvas.width = W; canvas.height = H;
    ctx.imageSmoothingEnabled = false;
    const art = Art.build(TRAVEL + 40);
    const f = Paint.framer(ctx, W, H);

    const S = {};
    function reset(mode) {
        Object.assign(S, {
            mode, t: 0, clock: 0, cam: 0, vel: 0, anim: 0, found: new Set(), calms: 0, soothed: 0, reacted: 0, isWindSaid: false,
            prints: [], nextStep: 0.4, endT: 0, isLeaving: false, endSaid: false, facing: 1, isKneeling: false, script: 0, pending: [],
            saidAt: -99, lineUntil: -1, lastLook: { id: '', at: -99 }, calmUsed: {}, calmTurn: 0, selId: null, isKeyboard: false,
        });
        f.reset();
        clearVoice();
        els.start.hidden = mode !== 'start';
        els.end.hidden = true;
    }
    /** Doubt: what they noticed, less what the false alarms talked away. Three and they leave. */
    const doubt = () => S.found.size - Math.floor(S.calms / CALMS_PER_DOUBT);

    // ── the voice: one line at a time, the name in the speaker's colour over it; it fades after a few seconds ──
    function clearVoice() {
        els.name.textContent = ''; els.line.textContent = '';
        els.voice.classList.remove('is-in');
    }
    function say(who, line, keep) {
        els.who.className = 'who tone-' + who;
        els.name.textContent = NAMES[who] || who;
        els.line.textContent = line;
        els.voice.classList.add('is-in');
        S.saidAt = S.t;
        S.lineUntil = keep ? Infinity : S.t + LINE_SHOW;
    }
    const other = who => (who === 'aris' ? 'jaxon' : 'aris');

    // ── what is on screen and what it is: the hit list, in order (the first that holds the point wins) ──
    const onScreen = b => b[2] > 0 && b[0] < W && b[3] > 0 && b[1] < H;
    const cloudX = c => c.x - S.cam * FACTOR.cloud - S.clock * CLOUD_DRIFT;
    function targets() {
        const list = [], cam = S.cam;
        const add = (id, kind, box, o = {}) => { if (onScreen(box)) list.push({ id, kind, box, cx: (box[0] + box[2]) / 2, cy: (box[1] + box[3]) / 2, ...o }); };
        const isSunOdd = S.t >= SUN_ODD_AT;
        add('sun', 'sun', [SUN.x - 14, SUN.y - 14, SUN.x + 14, SUN.y + 14], { odd: isSunOdd ? 'sun' : null, neutral: isSunOdd ? null : 'sun', keyable: true });
        birdsNow(S.t).forEach(b => add(b.id, 'bird', [b.x - 11, b.y - 8, b.x + 11, b.y + 8],
            { odd: b.isRepeat && b.pass >= 1 ? 'bird' : null, neutral: b.isRepeat && b.pass === 0 ? 'bird' : null, keyable: true }));
        PEOPLE.forEach(p => add(p.id, p.id, [p.x - 12, p.feet - p.h, p.x + 12, p.feet], { keyable: true }));
        const m = art.meadow, b = m.bench;
        add('bench', 'bench', [b.x0 - cam, b.y0, b.x1 + 2 - cam, b.y1], { keyable: true });
        add('tiled', 'flowers', [m.tiled[0] - cam, m.tiled[1], m.tiled[2] - cam, m.tiled[3]], { odd: 'flowers', keyable: true });
        m.patches.forEach((p, i) => add('patch-' + i, 'flowers', [p[0] - cam, p[1], p[2] - cam, p[3]], { keyable: true }));
        m.fences.forEach(([x0, x1], i) => {
            const box = [Math.max(0, x0 - cam), m.fenceBox[0], Math.min(W, x1 + 3 - cam), m.fenceBox[1]];
            // the keyboard mark for a long fence sits on the stretch ahead of the walkers, not at the screen edges
            if (box[2] - box[0] > 4) add('fence-' + i, 'fence', box, { keyable: true, cx: clamp(W * 0.62, box[0] + 10, box[2] - 10), mark: 28 });
        });
        const rear = PEOPLE[1].x;
        add('trail', 'trail', [rear - TRAIL.back, TRAIL.top, rear - TRAIL.near, TRAIL.bottom], { odd: 'trail', keyable: true, cx: rear - 60, mark: 30 });
        const midCam = Math.round(cam * FACTOR.mid);
        art.mid.trees.forEach((t, i) => add('tree-' + i, 'tree', [t.x - midCam - t.h * 0.55, t.gy - t.h * 1.1, t.x - midCam + t.h * 0.55, t.gy + 2],
            { odd: t.noShadow ? 'tree' : null, keyable: true }));
        const reps = art.clouds.filter(c => c.rep).map(c => cloudX(c));
        const isPairInView = reps.every(x => x > -60 && x < W - 24);
        art.clouds.forEach((c, i) => { const x = cloudX(c); add('cloud-' + i, 'cloud', [x, c.y, x + c.w, c.y + c.h], { odd: c.rep && isPairInView ? 'cloud' : null, keyable: true }); });
        const grassOdd = S.isWindSaid ? 'grass' : null;
        add('grass', 'grass', [0, 318, W, H], { odd: grassOdd, keyable: true, cx: W * 0.7, cy: 340, mark: 30 });
        add('meadow', 'grass', [0, 246, W, 318], { odd: grassOdd });
        add('hills', 'hills', [0, 168, W, 246]);
        add('sky', 'sky', [0, 0, W, H]);
        return list;
    }
    const hitAt = (x, y) => targets().find(t => x >= t.box[0] && x <= t.box[2] && y >= t.box[1] && y <= t.box[3]) || null;

    // ── looking at something ──
    function look(target) {
        if (!target || S.mode !== 'walk') return;
        if (S.lastLook.id === target.id && S.t - S.lastLook.at < LOOK_REPEAT) return;
        S.lastLook = { id: target.id, at: S.t };
        if (target.odd) {
            const o = ODD[target.odd];
            say(o.who, o.line);
            if (!S.found.has(target.odd)) { S.found.add(target.odd); queueReaction(other(o.who)); }
            return;
        }
        if (target.neutral) { const n = NEUTRAL[target.neutral]; say(n.who, n.line); return; }
        // a false alarm: they relax; every second one talks away something they noticed
        S.calms++;
        if (S.calms % CALMS_PER_DOUBT === 0) { const l = SOOTHED[S.soothed++ % SOOTHED.length]; say(l.who, l.line); return; }
        const pool = CALM[target.kind] || CALM.sky, used = S.calmUsed[target.kind] || 0;
        S.calmUsed[target.kind] = used + 1;
        const isPerson = PEOPLE.some(p => p.id === target.id);                // they answer for themselves
        const who = isPerson ? target.id : (S.calmTurn++ % 2 ? 'aris' : 'jaxon');
        say(who, pool[used % pool.length]);
    }
    /** After a find, the other one answers, by how much doubt there is now (each answer once, rising). */
    function queueReaction(who) {
        const d = doubt();
        if (d <= S.reacted || d < 1 || S.reacted >= REACT.length) return;
        S.reacted = Math.min(d, REACT.length);
        S.pending.push({ at: S.t + REACT_AFTER, who, line: REACT[S.reacted - 1] });
    }

    // ── the clock ──
    function step(dt) {
        S.clock += dt;
        if (S.mode === 'start') return;
        S.t += dt;
        if (S.mode === 'walk') walk(dt); else ending(dt);
        if (S.t > S.lineUntil) els.voice.classList.remove('is-in');
        S.anim += dt * 1000 * ANIM_RATE * Math.abs(S.vel) / WALK_PX;
        S.cam += S.vel * dt;
        S.prints = S.prints.filter(p => S.t - p.at < PRINT_LIFE);
    }
    function walk(dt) {
        S.vel = WALK_PX * Math.min(1, S.t / WALK_EASE);
        if (S.t >= S.nextStep) {                                    // a footfall each: a print where the foot came down
            S.nextStep += STEP_SECS;
            const isLeft = Math.round(S.nextStep / STEP_SECS) % 2 === 0;
            PEOPLE.forEach(p => S.prints.push({ x: S.cam + p.x + (isLeft ? -3 : 1), y: p.feet + (isLeft ? 0 : 1), at: S.t }));
        }
        const due = S.pending.find(r => S.t >= r.at && S.t - S.saidAt >= 1.6);
        if (due) { S.pending = S.pending.filter(r => r !== due); say(due.who, due.line); return; }
        // the script waits for quiet, but a line long overdue speaks over a busy clicker (so the wind is always mentioned)
        const next = SCRIPT[S.script], gap = S.t - S.saidAt;
        const isDue = next && S.t >= next.at && ((gap >= LINE_HOLD && !S.pending.length) || (S.t - next.at > OVERDUE && gap >= MIN_GAP));
        if (isDue) {
            S.script++;
            if (S.t < WALK_SECS - 3) {
                const l = doubt() >= DOUBT_TO_LEAVE - 1 && next.uneasy ? next.uneasy : next;
                say(l.who, l.line);
                if (next.wind) S.isWindSaid = true;
            }
        }
        if (S.t >= WALK_SECS) { S.mode = 'ending'; S.endT = 0; S.isLeaving = doubt() >= DOUBT_TO_LEAVE; S.pending = []; }
    }
    function ending(dt) {
        S.endT += dt;
        const e = S.endT;
        if (e < END.turn) S.vel = Math.max(0, S.vel - WALK_PX * dt / 0.8);              // they slow and stop
        if (!S.endSaid && e >= END.line) { S.endSaid = true; const l = S.isLeaving ? ENDING.leave : ENDING.stay; say(l.who, l.line, true); }
        if (e >= END.turn) {
            if (S.isLeaving) { S.facing = -1; S.vel = Math.max(-WALK_PX, S.vel - WALK_PX * dt / 0.8); }   // back the way they came
            else S.isKneeling = true;                                                    // Jaxon sits down in the grass
        }
        if (S.mode === 'ending' && e >= END.buttons) {
            S.mode = 'end';
            els.end.hidden = false;
            els.again.focus({ preventScroll: true });
        }
    }

    // ── drawing ──
    function draw() {
        const cam = S.cam;
        ctx.drawImage(art.sky, 0, 0);
        art.clouds.forEach(c => ctx.drawImage(c.canvas, Math.round(cloudX(c)), c.y));
        birdsNow(S.t).forEach(drawBird);
        ctx.drawImage(art.far.canvas, -Math.round(cam * FACTOR.far), 0);
        ctx.drawImage(art.mid.canvas, -Math.round(cam * FACTOR.mid), 0);
        ctx.drawImage(art.meadow.canvas, -Math.round(cam), art.meadow.y0);
        S.prints.forEach(p => { const x = Math.round(p.x - cam); f.px(x, p.y, '#24381a', 3, 1); f.px(x, p.y, '#16240f', 1, 1); });
        PEOPLE.forEach(drawPerson);
        if (S.mode !== 'start') drawPetals();
        ctx.drawImage(art.tufts.canvas, -Math.round(cam * FACTOR.tuft), art.tufts.y0);
        // under the words the picture darkens (reading.css's rule): the sky toward the start's corner, the grass under the voice
        ctx.drawImage(S.mode === 'start' ? art.veilTop : art.veilLow, 0, 0);
        if (S.isKeyboard && S.mode === 'walk') drawSelection();
    }
    function drawBird(b) {
        const rows = (b.small ? SMALL_BIRD : BIRD)[b.frame], w = rows[0].length;
        rows.forEach((r, y) => { for (let x = 0; x < w; x++) if (r[x] === 'X') f.px(Math.round(b.x) - (w >> 1) + (b.dir < 0 ? w - 1 - x : x), Math.round(b.y) + y - 1, BIRD_INK); });
    }
    function drawPerson(p) {
        const isMoving = Math.abs(S.vel) > 2;
        const pose = p.id === 'jaxon' && S.isKneeling ? 'kneel' : isMoving ? 'walk' : 'stand';
        for (let i = 0; i < 24; i++) {                              // their shadow, long and to the left, dithered
            const x = p.x - 2 - i, y = p.feet + Math.floor(i * 0.12);
            if ((x + y) % 2 === 0 || i < 8) f.px(x, y, '#1b2b12', 1, 1);
            if (i < 14 && (x + y) % 2 === 1) f.px(x, y + 1, '#1b2b12', 1, 1);
        }
        Crew.small(ctx, p.id, p.x, p.feet, { h: p.h, pose, t: S.anim + p.lag, facing: S.facing, light: 1, warm: 0.5, suit: true });
    }
    function drawPetals() {
        PETALS.forEach((p, i) => {
            const x = W + 20 - ((S.clock * p.speed + p.off) % (W + 40)), y = p.y + 5 * Math.sin(S.clock * 0.9 + p.phase);
            f.px(Math.round(x), Math.round(y), p.hex, 1, 1);
            if (Math.floor(S.clock * 4 + i) % 3 === 0) f.px(Math.round(x) + 1, Math.round(y), p.hex, 1, 1);   // a petal turning over
        });
    }
    /** The keyboard's choice: corner marks round it. A wide thing (the grass, a fence, the trail) gets a small mark at its own
        point, where you are looking, not brackets at the far edges of the screen. */
    function drawSelection() {
        const t = targets().find(x => x.id === S.selId);
        if (!t) return;
        const half = t.mark ? [t.mark, 9] : null;
        const [x0, y0, x1, y1] = (half ? [t.cx - half[0], t.cy - half[1], t.cx + half[0], t.cy + half[1]] : t.box)
            .map((v, i) => Math.round(clamp(v, 2, (i % 2 ? H : W) - 3)));
        const c = '#9fd8e6', a = 4;
        [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]].forEach(([x, y, dx, dy]) => {
            f.px(Math.min(x, x + dx * a), y, c, a, 1);
            f.px(x, Math.min(y, y + dy * a), c, 1, a);
        });
    }

    // ── fit: the picture fills the window, whole screen pixels per art pixel at 1280 x 720 and 1920 x 1080 ──
    function fit() {
        const s = Math.max(innerWidth / W, innerHeight / H), ox = (innerWidth - W * s) / 2, oy = (innerHeight - H * s) / 2;
        Object.assign(canvas.style, { width: W * s + 'px', height: H * s + 'px', left: ox + 'px', top: oy + 'px' });
        document.documentElement.style.setProperty('--t', clamp((innerWidth - 1280) / 640, 0, 1).toFixed(3));
        document.documentElement.style.setProperty('--px', s + 'px');
    }
    function toArt(e) {
        const r = canvas.getBoundingClientRect();
        return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
    }

    // ── input: point and click, or arrows to choose and Enter to look; 1 / Enter / Space start, 2 goes to all ideas ──
    canvas.addEventListener('pointermove', e => {
        S.isKeyboard = false;
        const p = toArt(e), t = S.mode === 'walk' ? hitAt(p.x, p.y) : null;
        els.stage.classList.toggle('is-pointing', !!t && t.kind !== 'sky');
    });
    canvas.addEventListener('pointerdown', e => { if (e.button === 0) { const p = toArt(e); look(hitAt(p.x, p.y)); } });
    function choose(dir) {
        const list = targets().filter(t => t.keyable && t.cx > 8 && t.cx < W - 8).sort((a, b) => a.cx - b.cx || a.cy - b.cy);
        if (!list.length) return;
        const i = list.findIndex(t => t.id === S.selId);
        const mid = list.reduce((best, t, k) => (Math.abs(t.cx - W / 2) < Math.abs(list[best].cx - W / 2) ? k : best), 0);
        const next = i < 0 ? mid : (i + dir + list.length) % list.length;            // the first choice starts in the middle
        S.selId = list[next].id;
        S.isKeyboard = true;
    }
    addEventListener('keydown', e => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const isChoosing = S.mode === 'start' || S.mode === 'end';
        if (isChoosing) {
            if (e.key === 'Enter' && e.target.closest && e.target.closest('a, button')) return;   // a focused word acts for itself
            if (e.key === '1' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!e.repeat) begin(); return; }
            if (e.key === '2') { e.preventDefault(); location.href = 'index.html'; }
            return;
        }
        if (S.mode !== 'walk') return;
        if (e.key === 'ArrowRight' || (e.key === 'Tab' && !e.shiftKey)) { e.preventDefault(); choose(1); }
        else if (e.key === 'ArrowLeft' || (e.key === 'Tab' && e.shiftKey)) { e.preventDefault(); choose(-1); }
        else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (!S.selId) { choose(1); return; }
            look(targets().find(t => t.id === S.selId) || null);
        }
    });
    function begin() {
        reset('walk');
        if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
        els.stage.focus({ preventScroll: true });
    }
    document.querySelectorAll('[data-act="start"]').forEach(b => b.addEventListener('click', begin));
    addEventListener('resize', fit);

    let last = performance.now();
    function frame(now) {
        const dt = Math.min(0.05, (now - last) / 1000) * SPEED;
        last = now;
        try { step(dt); draw(); } catch (err) { console.error(err); return; }
        requestAnimationFrame(frame);
    }

    // test hooks (the headless checks use these; the play never does)
    window.edenWalk = Object.freeze({
        state: () => ({ mode: S.mode, t: +S.t.toFixed(2), found: [...S.found], calms: S.calms, doubt: doubt(), isWindSaid: S.isWindSaid,
            isLeaving: S.isLeaving, line: els.voice.classList.contains('is-in') ? els.line.textContent : '', who: els.name.textContent, selId: S.selId }),
        targets: () => {
            const r = canvas.getBoundingClientRect();
            return targets().map(t => ({ id: t.id, kind: t.kind, odd: t.odd || null, neutral: t.neutral || null, x: r.left + t.cx / W * r.width, y: r.top + t.cy / H * r.height }));
        },
        /** A point (in page px) where a click lands on this target and nothing in front of it, or null. */
        pointFor: id => {
            const t = targets().find(x => x.id === id), r = canvas.getBoundingClientRect();
            if (!t) return null;
            const pts = [];
            for (let y = Math.ceil(t.box[1]); y <= t.box[3]; y += 2) for (let x = Math.ceil(t.box[0]); x <= t.box[2]; x += 2) {
                if (x >= 0 && y >= 0 && x < W && y < H) pts.push([x, y]);
            }
            pts.sort((a, b) => Math.hypot(a[0] - t.cx, a[1] - t.cy) - Math.hypot(b[0] - t.cx, b[1] - t.cy));   // nearest the middle first
            for (const [x, y] of pts) {
                const hit = hitAt(x + 0.5, y + 0.5);
                if (hit && hit.id === id) return { x: r.left + (x + 0.5) / W * r.width, y: r.top + (y + 0.5) / H * r.height };
            }
            return null;
        },
        start: begin,
    });

    reset('start');
    fit();
    requestAnimationFrame(frame);
})();
