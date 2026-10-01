/* proto-stations.js — Jump stations (reworked from round one's "Roll call").
   Before a jump, all five people aboard must be strapped into a jump seat, or they get hurt. Click a crew member,
   then a seat or a deck: they walk the deck and climb the ladder shaft. The checklist board lights one seat light
   per person, while A.U.R.A.'s own tally never goes past four. Sector 3: Jaxon is hurt and needs Aris to walk him.
   Sector 5: the hold's seat is broken and Vance won't leave until the commander comes down. */
(function () {
    'use strict';
    const Lab = window.Lab, C = Lab.C, W = Lab.W, H = Lab.H, SHIP = Lab.ship;
    if (!SHIP) return;

    // ── the ship and its seats (a deck is 26 px, about three metres, so 1 px is about 12 cm) ──
    const L = SHIP.layout(16, 4, 120, 172);
    const DECKS = SHIP.ROOMS.map(r => r.key), floorY = key => L.room(key).bottom - 2, FLOORS = DECKS.map(floorY);
    const SHAFT = 90;                                     // the ladder: beside the reactor, just right of the centre line
    const SEATS = [['bridge', 62], ['bridge', 76], ['lab', 62], ['lab', 78], ['quarters', 64], ['quarters', 80], ['cargo', 74], ['engineering', 46], ['upgrades', 106]];
    const QTR = L.room('quarters'), BUNK_Y = QTR.top + Math.round((QTR.bottom - QTR.top) * 0.78);
    const JAX_BUNK_X = 44, ARIS_AT = 54, JAX_UP_X = 58;   // Jaxon lies on the lower left bunk; Aris gets him up here
    const PACE_RANGE = [44, 68];                          // Vance, waiting, paces by the broken seat in the hold
    const FRAME = SHIP.HULL_RAMP[3], PAN = SHIP.HULL_RAMP[4];

    // ── tuning ──
    const WALK = 14, CLIMB = 9;                           // px/s: about 1.7 m/s on deck, 1.1 m/s on the ladder
    const STROLL = 0.3, HELPED = 0.45;                    // idle crew stroll; a man on one good leg moves at under half speed
    const BUCKLE = 0.9, WINDOW = 45, WARN = 10, FOLLOW = 6;
    const BOARD = { x: 148, y: 6, w: 166, h: 168 };
    const ORDER = ['you', 'jaxon', 'aris', 'vance', 'mira'];
    const LABEL = { you: 'YOU', jaxon: 'JAXON', aris: 'ARIS', vance: 'VANCE', mira: 'MIRA' };
    const nameOf = id => LABEL[id][0] + LABEL[id].slice(1).toLowerCase();
    const DECK_SHORT = { bridge: 'BRIDGE', lab: 'LAB', quarters: 'QUARTERS', cargo: 'CARGO', engineering: 'ENGINE', upgrades: 'FAB' };
    const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five'];
    const STARS = (() => { const r = Lab.rng(905); return Array.from({ length: 46 }, () => ({ x: Math.floor(r() * 144), y: Math.floor(r() * H), bright: r() < 0.15 })); })();
    const STATUS = {
        strapped: ['STRAPPED', C.greenBr, 1], buckle: ['BUCKLING', C.green, 0.6], hurt: ['HURT', C.red, 1], lying: ['INJURED', C.red, 0.3],
        escort: ['HELPING', C.amber, 0.3], go: ['MOVING', C.amber, 0.3], idle: ['NOT SEATED', C.boneD, 0.08],
    };

    // ── words (docs/STYLE.md: plain speech, one idea a line, 20 words at most) ──
    const ROUNDS = [
        {
            sector: 1,
            start: { you: ['bridge', 44], jaxon: ['engineering', 104], aris: ['lab', 34], vance: ['cargo', 40], mira: ['cargo', 104] },
            intro: [['A.U.R.A.', 'Jump in forty-five seconds, Commander. Everyone to a jump seat, please.'],
                ['', 'Click someone, then click a seat. They use the ladder to change decks.'],
                ['Vance', "Mira's down here with me. The hold only has one seat."]],
        },
        {
            sector: 3, injured: 'jaxon',
            start: { you: ['bridge', 100], jaxon: ['quarters', JAX_BUNK_X], aris: ['lab', 112], vance: ['cargo', 36], mira: ['quarters', 94] },
            intro: [['A.U.R.A.', 'Jump in forty-five seconds, Commander. Jaxon is injured in crew quarters.'],
                ['Jaxon', "I can't stand on this leg. I need Aris down here."]],
            after: [['Aris', 'Hold still, Jaxon. Now I can look at that leg.']],
        },
        {
            sector: 5, holdout: 'vance', broken: 6,
            start: { you: ['bridge', 50], jaxon: ['engineering', 110], aris: ['lab', 36], vance: ['cargo', 56], mira: ['upgrades', 60] },
            intro: [['A.U.R.A.', 'Jump in forty-five seconds, Commander. The jump seat in the cargo hold is broken.'],
                ['Vance', "A.U.R.A. says the hold is sealed. I'm not leaving till you see it yourself."]],
        },
    ];
    const LINES = {
        ready: ['A.U.R.A.', 'Four crew at stations, Commander. Ready to jump.'],
        react: [['Vance', "That's five."], ['Jaxon', "It's a glitch."]],
        closing: ['A.U.R.A.', 'The window is closing, Commander. Jumping now.'],
        helped: ['Aris', 'Lean on me, Jaxon. We go slowly.'],
        convinced: ['Vance', "It's holding. I just needed someone else to look at it."],
        lying: "Jaxon can't walk on his own. Send Aris to him first.",
        holding: "Vance won't move until you go down to the hold.",
        end: "Five seat lights on the board, every jump. A.U.R.A.'s count never went past four.",
        endHurt: "There are five people aboard. A.U.R.A.'s count never went past four.",
    };
    const HURT = {                                        // Aris, after a jump with one person loose
        you: 'You hit the console hard, Commander. Sit still while I check you.',
        jaxon: 'Jaxon was thrown into the wall. His shoulder is out.',
        jaxonInjured: 'Jaxon fell in the jump. His leg is worse now.',
        aris: "I hit my head in the jump. I'm all right. Give me a minute.",
        vance: 'Vance was thrown across the deck. He has a deep cut on his arm.',
        mira: 'Mira hit the floor in the jump. Her wrist is broken.',
    };
    function hurtLine(hurt, r) {
        if (hurt.length === ORDER.length) return 'Nobody was strapped in. I need to see everyone, one at a time.';
        if (hurt.length > 1) return `${WORDS[hurt.length]} people weren't strapped in. I'm seeing to them now.`;
        return hurt[0] === 'jaxon' && r.injured ? HURT.jaxonInjured : HURT[hurt[0]];
    }
    function warnLine(out) {
        const who = out.length === ORDER.length ? 'Nobody is' : out.length > 1 ? `${WORDS[out.length]} crew are not` : out[0] === 'you' ? 'You are not' : nameOf(out[0]) + ' is not';
        return `Ten seconds, Commander. ${who} strapped in.`;
    }

    const onFloor = c => FLOORS.includes(c.y);
    const deckOf = c => (onFloor(c) ? DECKS[FLOORS.indexOf(c.y)] : null);
    const range = deck => (deck === 'quarters' ? [58, 96] : [L.floor(deck, 0.08).x, L.floor(deck, 0.92).x]);
    const best = (list, score) => list.slice().sort((a, z) => score(a) - score(z))[0];
    /** Walk back `dist` px along a trail of points from its newest end. */
    function behind(points, dist) {
        for (let k = points.length - 1; k > 0; k--) {
            const a = points[k], b = points[k - 1], seg = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
            if (seg >= dist) return { x: a.x + (b.x - a.x) * (dist / seg), y: a.y + (b.y - a.y) * (dist / seg) };
            dist -= seg;
        }
        return points[0];
    }
    function status(c) {
        if (c.holding) return ['WAITING', C.amber, 0.3];
        if (c.helped && c.state === 'go') return ['LIMPING', C.amber, 0.3];
        return c.helped && c.state === 'idle' ? ['STANDING', C.boneD, 0.08] : STATUS[c.state];
    }

    function mount(ctx, ui) {
        const bg = document.createElement('canvas');
        bg.width = W; bg.height = H;
        const bgx = bg.getContext('2d');
        bgx.fillStyle = C.void; bgx.fillRect(0, 0, W, H);
        STARS.forEach(s => Lab.dot(bgx, s.x, s.y, s.bright ? C.bone : C.boneD));

        let ri = 0, phase = 'play', crew = {}, seats = [], sel = null, hover = null, timer = WINDOW, rnd = Lab.rng(1);
        let clock = 0, gen = 0, queue = [], trail = [], jumpT = -1, warned = false, reacted = false, results = {}, hintAt = {};
        const later = (sec, fn) => { const g = gen; queue = queue.concat({ at: clock + sec, fn: () => g === gen && fn() }); };
        const set = (id, patch) => { crew = { ...crew, [id]: { ...crew[id], ...patch } }; };
        const say = ([who, line]) => ui.say(who, line);
        const sayAll = (lines, from, gap) => lines.forEach((l, j) => later(from + j * gap, () => say(l)));
        const occupant = i => ORDER.find(id => crew[id].seat === i) || null;
        const isFree = (i, id) => !seats[i].broken && [null, id].includes(occupant(i));
        const freeSeats = id => seats.map((s, i) => i).filter(i => isFree(i, id));
        const loose = () => ORDER.filter(id => crew[id].state !== 'strapped');

        // ── rounds ──
        function startRound(i) {
            gen++; queue = []; ri = i; phase = 'play'; sel = null; timer = WINDOW; jumpT = -1; warned = false; trail = []; hintAt = {};
            const r = ROUNDS[i];
            rnd = Lab.rng(r.sector * 7919);
            seats = SEATS.map(([deck, x], j) => ({ deck, x, broken: j === r.broken }));
            crew = Object.fromEntries(ORDER.map(id => {
                const [deck, x] = r.start[id];
                const c = { id, x, y: floorY(deck), path: [], pace: 1, state: 'idle', seat: null, wait: rnd() * 2, gait: 0, goal: null, helped: false, holding: r.holdout === id };
                return [id, r.injured === id ? { ...c, state: 'lying', y: BUNK_Y } : c];
            }));
            say(r.intro[0]);
            sayAll(r.intro.slice(1), 3.2, 3.4);
            showButtons();
        }
        function restart() { results = {}; reacted = false; startRound(0); }
        const nextRound = () => (ri < ROUNDS.length - 1 ? startRound(ri + 1) : finish());
        function finish() {
            gen++; queue = []; phase = 'ended'; sel = null;
            ui.say('', Object.values(results).some(h => h.length) ? LINES.endHurt : LINES.end);
            showButtons();
        }
        function ready() {
            phase = 'ready'; sel = null; showButtons();
            say(LINES.ready);
            if (!reacted) { reacted = true; sayAll(LINES.react, 2.4, 1.9); later(5.8, jump); } else later(2.6, jump);
        }
        function jump() {
            const hurt = loose(), r = ROUNDS[ri];
            phase = 'jump'; jumpT = 0; sel = null;
            hurt.forEach(id => {                                            // whoever is loose is thrown to the floor below them
                const fy = FLOORS.find(f => f >= crew[id].y - 0.01);
                set(id, { state: 'hurt', holding: false, path: [], seat: null, y: fy === undefined ? FLOORS[FLOORS.length - 1] : fy });
            });
            results = { ...results, [ri]: hurt };
            let at = 1.4;
            if (hurt.length) { later(at, () => ui.say('Aris', hurtLine(hurt, r))); at += 3.4; }
            else if (r.after) { sayAll(r.after, at, 3.2); at += r.after.length * 3.2; }
            later(at + 1.4, nextRound);
            showButtons();
        }

        // ── orders ──
        function pathTo(c, deck, tx) {
            const fy = floorY(deck);
            if (c.y === fy) return [{ x: tx, y: fy }];
            return (onFloor(c) ? [{ x: SHAFT, y: c.y }] : []).concat({ x: SHAFT, y: fy }, { x: tx, y: fy });
        }
        function cost(c, s) {
            const fy = floorY(s.deck);
            if (c.y === fy) return Math.abs(c.x - s.x) / WALK;
            return (Math.abs(c.x - SHAFT) + Math.abs(SHAFT - s.x)) / WALK + Math.abs(c.y - fy) / CLIMB;
        }
        function hint(key) {                                                // a narration nudge, at most once every five seconds
            if (clock - (hintAt[key] || -99) >= 5) { hintAt = { ...hintAt, [key]: clock }; ui.say('', LINES[key]); }
        }
        function command(id, deck, tx, seat) {
            const c = crew[id];
            if (phase !== 'play' || !c || c.state === 'hurt' || c.state === 'escort') return false;
            if (c.state === 'lying' || c.holding) { hint(c.holding ? 'holding' : 'lying'); return false; }
            set(id, { path: pathTo(c, deck, Math.round(tx)), state: 'go', seat, goal: null, pace: c.helped ? HELPED : 1 });
            sel = null; showButtons();
            return true;
        }
        const sendSeat = (id, i) => command(id, seats[i].deck, seats[i].x, i);
        function sendDeck(id, deck, x) {
            const i = best(freeSeats(id).filter(k => seats[k].deck === deck), k => Math.abs(seats[k].x - x));
            if (i !== undefined) return sendSeat(id, i);
            const [lo, hi] = range(deck);
            return command(id, deck, Lab.clamp(x, lo, hi), null);
        }
        function sendNearest(id) {
            if (!id || phase !== 'play') return;
            const i = best(freeSeats(id), k => cost(crew[id], seats[k]));
            if (i !== undefined) sendSeat(id, i);
        }
        function pick(id) {
            if (phase !== 'play') return;
            if (sel === 'aris' && id === 'jaxon' && crew.jaxon.state === 'lying') {
                if (command('aris', 'quarters', ARIS_AT, null)) set('aris', { goal: 'jaxon' });
                return;
            }
            if (sel === 'you' && id === 'vance' && crew.vance.holding) {
                const [lo, hi] = range('cargo');
                command('you', 'cargo', Lab.clamp(crew.vance.x - 7, lo, hi), null);
                return;
            }
            const who = crew[id].state === 'escort' ? 'jaxon' : id;
            sel = sel === who ? null : who;
            showButtons();
        }

        // ── movement ──
        function walk(c, dt) {
            let x = c.x, y = c.y, path = c.path, t = dt;
            while (t > 1e-6 && path.length) {
                const p = path[0], vertical = p.y !== y, v = (vertical ? CLIMB : WALK) * c.pace;
                const d = vertical ? Math.abs(p.y - y) : Math.abs(p.x - x);
                if (d <= v * t) { x = p.x; y = p.y; t -= d / v; path = path.slice(1); }
                else { if (vertical) y += Math.sign(p.y - y) * v * t; else x += Math.sign(p.x - x) * v * t; t = 0; }
            }
            return { ...c, x, y, path, gait: c.gait + dt };
        }
        function arrive(id) {
            const c = crew[id];
            if (c.seat !== null) {
                set(id, { x: seats[c.seat].x, state: 'buckle', wait: BUCKLE });
                if (id === 'jaxon' && crew.aris.state === 'escort') {       // Jaxon is down: Aris is free again
                    set('aris', { state: 'idle', y: onFloor(crew.aris) ? crew.aris.y : crew.jaxon.y, wait: 1.5, moving: false });
                    trail = [];
                }
            } else if (c.goal === 'jaxon' && crew.jaxon.state === 'lying') {  // Aris reached him: he gets up and leans on her
                const qy = floorY('quarters');
                set('jaxon', { state: 'idle', helped: true, x: JAX_UP_X, y: qy });
                set('aris', { state: 'escort', goal: null });
                trail = [{ x: crew.aris.x, y: qy }, { x: JAX_UP_X, y: qy }];
                say(LINES.helped);
            } else set(id, { state: 'idle', wait: 2 + rnd() * 2 });
        }
        function followJaxon(dt) {
            const j = crew.jaxon, last = trail[trail.length - 1];
            if (last.x !== j.x || last.y !== j.y) trail = trail.concat({ x: j.x, y: j.y }).slice(-80);
            const p = behind(trail, FOLLOW), moved = p.x !== crew.aris.x || p.y !== crew.aris.y;
            set('aris', { x: p.x, y: p.y, moving: moved, gait: crew.aris.gait + (moved ? dt : 0) });
        }
        function tick(id, dt) {
            const c = crew[id];
            if (c.state === 'buckle') return set(id, c.wait > dt ? { wait: c.wait - dt } : { state: 'strapped', wait: 0 });
            if (c.state === 'go') { const m = walk(c, dt); set(id, m); if (!m.path.length) arrive(id); return; }
            if (c.state !== 'idle' || id === 'you' || c.helped || !deckOf(c)) return;
            if (c.path.length) return set(id, walk(c, dt));                // strolling about their deck
            if (c.wait > dt) return set(id, { wait: c.wait - dt });
            const [lo, hi] = c.holding ? PACE_RANGE : range(deckOf(c));
            set(id, { path: [{ x: Math.round(lo + rnd() * (hi - lo)), y: c.y }], pace: STROLL, wait: 1.5 + rnd() * 3 });
        }
        function update(dt) {
            ORDER.forEach(id => tick(id, dt));
            if (crew.aris.state === 'escort') followJaxon(dt);
            if (jumpT >= 0) jumpT += dt;
            if (phase !== 'play') return;
            timer = Math.max(0, timer - dt);
            const v = crew.vance, you = crew.you;
            if (v.holding && you.y === floorY('cargo')) {                  // the commander is down in the hold with him
                set('vance', { holding: false, path: [], state: 'idle', wait: 3 });
                say(LINES.convinced);
            }
            const out = loose();
            if (!out.length) return ready();
            if (!warned && timer <= WARN) { warned = true; ui.say('A.U.R.A.', warnLine(out)); }
            if (timer <= 0) { phase = 'closing'; sel = null; say(LINES.closing); later(1.2, jump); showButtons(); }
        }

        // ── drawing the ship ──
        function drawShaft() {
            const top = FLOORS[0] - 4, bottom = FLOORS[FLOORS.length - 1];
            ctx.fillStyle = C.void;
            FLOORS.slice(0, -1).forEach(fy => ctx.fillRect(SHAFT - 1, fy, 3, 3));        // a hatch through every deck
            [-2, 2].forEach(dx => Lab.line(ctx, SHAFT + dx, top, SHAFT + dx, bottom, C.greenD));
            for (let y = top + 1; y < bottom; y += 3) Lab.line(ctx, SHAFT - 1, y, SHAFT + 1, y, C.boneD, 0.6);
        }
        function seatLight(s, i, t) {
            const who = occupant(i), blink = Math.floor(t / 260) % 2 === 0;
            if (s.broken) return blink ? C.red : C.line;
            if (who) return crew[who].state === 'strapped' ? C.greenBr : blink ? C.amber : C.line2;
            return sel && phase === 'play' && blink ? C.green : C.greenD;
        }
        function drawSeat(s, i, t) {                                        // a jump seat seen from the front, light on top
            const fy = floorY(s.deck), x = s.x;
            if (s.broken) {                                                 // torn loose: back bent over, one leg gone
                Lab.line(ctx, x - 2, fy - 3, x + 4, fy - 7, C.boneD);
                Lab.line(ctx, x - 3, fy - 2, x + 2, fy - 2, C.boneD);
                Lab.dot(ctx, x - 3, fy - 1, C.boneD);
            } else {
                Lab.line(ctx, x - 1, fy - 10, x + 1, fy - 10, PAN);          // headrest
                Lab.shade(ctx, x - 2, fy - 9, 5, 6, 0.5, FRAME);            // padded back
                Lab.line(ctx, x - 3, fy - 3, x + 3, fy - 3, PAN);           // cushion
                [-3, 3].forEach(dx => Lab.line(ctx, x + dx, fy - 2, x + dx, fy - 1, FRAME));
            }
            Lab.dot(ctx, x, fy - 12, seatLight(s, i, t));
        }
        function drawCrew(id, t) {
            const c = crew[id], col = SHIP.CREW[id].color, x = Math.round(c.x), y = Math.round(c.y);
            const down = c.state === 'lying' || c.state === 'hurt';
            SHIP.figure(ctx, x, y, col, !down && (c.path.length > 0 || c.moving) && Math.floor(c.gait * 5) % 2 === 1, down);
            if (c.state === 'strapped' || (c.state === 'buckle' && Math.floor(t / 150) % 2)) {
                Lab.line(ctx, x - 3, y - 3, x + 3, y - 3, PAN);             // the cushion's edge across the lap
                ctx.fillStyle = C.ink;                                      // harness straps
                [[-1, -6], [1, -6], [0, -5], [0, -4]].forEach(([dx, dy]) => ctx.fillRect(x + dx, y + dy, 1, 1));
            }
            const picked = sel === id || (sel === 'jaxon' && id === 'aris' && c.state === 'escort');
            if (!picked && hover !== id) return;
            const top = down ? y - 8 : y - 15;                              // a small chevron over the head
            [[-2, 0], [2, 0], [-1, 1], [1, 1], [0, 2]].forEach(([dx, dy]) => Lab.dot(ctx, x + dx, top + dy, picked ? C.gold : C.boneD));
        }
        function drawJump() {
            const k = jumpT / 1.4, len = Math.round(16 * Math.sin(Math.PI * Math.min(1, k)));
            if (k < 1) STARS.forEach(s => Lab.line(ctx, s.x, s.y, s.x, s.y + len, s.bright ? C.bone : C.boneD, 0.6));
        }
        function render(t) {
            ctx.drawImage(bg, 0, 0);
            if (jumpT >= 0) drawJump();
            const shake = jumpT >= 0 && jumpT < 0.8 ? Math.round(Math.sin(jumpT * 55) * 2 * (1 - jumpT / 0.8)) : 0;
            ctx.save();
            ctx.translate(shake, 0);
            SHIP.draw(ctx, L, t, { damaged: ROUNDS[ri].broken !== undefined ? { cargo: true } : {}, labels: true });
            drawShaft();
            seats.forEach((s, i) => drawSeat(s, i, t));
            ORDER.filter(id => id !== sel).concat(sel ? [sel] : []).forEach(id => drawCrew(id, t));
            if (jumpT >= 0 && jumpT < 0.3) {                                // a brief light through the hull as the drive fires
                for (let y = L.top; y < L.top + L.height; y++) Lab.shade(ctx, L.cx - L.halfWidth(y) + 2, y, L.halfWidth(y) * 2 - 4, 1, 0.16 * (1 - jumpT / 0.3), C.greenBr);
            }
            ctx.restore();
            drawBoard(t);
        }

        // ── the jump checklist board ──
        const right = (str, rx, y, col, scale = 1) => Lab.text(ctx, str, rx - Lab.textWidth(str, scale), y, col, scale);
        function boardRow(id, i) {
            const c = crew[id], [word, col, fill] = status(c), x = BOARD.x, ry = BOARD.y + 19 + i * 12;
            if (sel === id) { ctx.fillStyle = C.line; ctx.fillRect(x + 3, ry - 3, BOARD.w - 6, 11); ctx.fillStyle = C.gold; ctx.fillRect(x + 3, ry - 3, 1, 11); }
            Lab.disc(ctx, x + 10, ry + 2, 3.4, d => (d > 0.72 ? 0.95 : fill), col);
            ctx.fillStyle = SHIP.CREW[id].color;
            ctx.fillRect(x + 17, ry, 1, 5);
            Lab.text(ctx, LABEL[id], x + 20, ry, sel === id ? C.greenBr : C.bone);
            Lab.text(ctx, c.state === 'lying' ? 'QUARTERS' : onFloor(c) ? DECK_SHORT[deckOf(c)] : 'LADDER', x + 46, ry, C.boneD);
            right(word, x + BOARD.w - 6, ry, col);
        }
        function windowPanel(t) {
            const x = BOARD.x + 6, wy = BOARD.y + 86, bw = BOARD.w - 12;
            const late = phase === 'play' && timer <= WARN, col = phase === 'jump' ? C.green : late && Math.floor(t / 250) % 2 ? C.red : C.amber;
            Lab.text(ctx, 'JUMP WINDOW', x, wy, C.boneD);
            right({ play: 'OPEN', ready: 'ALL SEATED', closing: 'CLOSING', jump: 'JUMPED' }[phase] || '', x + bw, wy, phase === 'play' ? C.boneD : col);
            Lab.text(ctx, '0:' + String(Math.ceil(timer)).padStart(2, '0'), x, wy + 9, col, 3);
            Lab.line(ctx, x, wy + 29, x + bw - 1, wy + 29, C.line);
            Lab.shade(ctx, x, wy + 27, Math.round(bw * (timer / WINDOW)), 2, 0.7, col);
        }
        function summaryPanel() {
            const x = BOARD.x + 6, wy = BOARD.y + 86, rx = BOARD.x + BOARD.w - 6;
            Lab.text(ctx, 'JUMP LOG', x, wy, C.boneD);
            ROUNDS.forEach((r, i) => {
                const y = wy + 9 + i * 8, hurt = results[i];
                Lab.text(ctx, 'SECTOR ' + r.sector, x, y, C.bone);
                if (!hurt) right('-', rx, y, C.boneD);
                else if (!hurt.length) right('ALL STRAPPED IN', rx, y, C.green);
                else right(hurt.length === 1 ? LABEL[hurt[0]] + ' HURT' : hurt.length + ' HURT', rx, y, C.red);
            });
        }
        function drawBoard(t) {
            const { x, y, w, h } = BOARD, ay = y + 124, label = 'CREW ON STATION:';
            ctx.fillStyle = C.line2; ctx.fillRect(x, y, w, h);
            ctx.fillStyle = C.ink; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
            Lab.shade(ctx, x + 1, y + 1, w - 2, 12, 0.22, C.line2);
            Lab.text(ctx, 'JUMP CHECKLIST', x + 6, y + 4, C.green);
            right('SECTOR ' + ROUNDS[ri].sector, x + w - 6, y + 4, C.boneD);
            ORDER.forEach(boardRow);
            Lab.line(ctx, x + 4, y + 80, x + w - 5, y + 80, C.line);
            if (phase === 'ended') summaryPanel(); else windowPanel(t);
            Lab.line(ctx, x + 4, ay - 4, x + w - 5, ay - 4, C.line);
            Lab.text(ctx, 'A.U.R.A. TALLY', x + 6, ay, C.boneD);
            Lab.text(ctx, label, x + 6, ay + 12, C.green);
            Lab.text(ctx, String(Math.min(4, ORDER.length - loose().length)), x + 10 + Lab.textWidth(label), ay + 9, C.greenBr, 2);
            const foot = phase !== 'play' ? '' : sel ? LABEL[sel] + ': PICK A SEAT OR DECK' : 'PICK A CREW MEMBER';
            Lab.text(ctx, foot, x + 6, y + h - 10, sel ? C.gold : C.boneD);
        }

        // ── buttons, mouse and keys ──
        function showButtons() {
            if (phase === 'ended') return ui.buttons([{ label: 'Run it again', primary: true, onClick: restart }]);
            const live = phase === 'play';
            const people = ORDER.map(id => ({ label: LABEL[id], primary: sel === id, disabled: !live || crew[id].state === 'hurt', onClick: () => pick(id) }));
            const strap = { label: 'Strap in', disabled: !live || !sel, onClick: () => sendNearest(sel) };
            const sectors = ROUNDS.map((r, i) => ({ label: 'Sector ' + r.sector, quiet: i !== ri, onClick: () => startRound(i) }));
            ui.buttons(people.concat(strap, sectors));
        }
        function crewAt(px, py) {
            const hits = ORDER.filter(id => {
                const c = crew[id], down = c.state === 'lying' || c.state === 'hurt';
                return Math.abs(px - c.x) <= (down ? 5 : 4) && py >= c.y - (down ? 5 : 11) && py <= c.y + 1;
            });
            return best(hits, id => Math.abs(px - crew[id].x)) || null;
        }
        const seatAt = (px, py) => seats.findIndex(s => Math.abs(px - s.x) <= 4 && py >= floorY(s.deck) - 12 && py <= floorY(s.deck) + 1);
        const rowAt = (px, py) => (px < BOARD.x ? -1 : ORDER.findIndex((id, i) => py >= BOARD.y + 16 + i * 12 && py < BOARD.y + 28 + i * 12));
        function click(px, py) {
            if (phase !== 'play') return;
            const row = rowAt(px, py), who = row >= 0 ? ORDER[row] : crewAt(px, py);
            if (who) return pick(who);
            if (!sel) return;
            const s = seatAt(px, py), room = L.roomAt(px, py);
            if (s >= 0 && isFree(s, sel)) sendSeat(sel, s);
            else if (room) sendDeck(sel, room.key, px);
        }
        const cv = ui.canvas;
        cv.onpointerdown = e => { if (e.button === 0) { const p = ui.toPixel(e); click(Math.floor(p.x), Math.floor(p.y)); } };
        cv.onpointermove = e => {
            const p = ui.toPixel(e), px = Math.floor(p.x), py = Math.floor(p.y);
            hover = phase === 'play' ? crewAt(px, py) : null;
            cv.style.cursor = phase === 'play' && (hover || rowAt(px, py) >= 0 || (sel && L.roomAt(px, py))) ? 'pointer' : '';
        };
        Lab.onKey((k, e) => {
            if (k === ' ' || k === 'Enter') {
                if (e && e.target && e.target.tagName === 'BUTTON') return;          // the focused button handles it
                if (phase === 'ended') restart();
                else if (phase === 'jump' && jumpT > 1.5) nextRound();
                else sendNearest(sel);
            } else if (k === 'Escape') { sel = null; showButtons(); }
            else if (['1', '2', '3', '4', '5'].includes(k)) pick(ORDER[Number(k) - 1]);
        });

        Lab.loop((dt, now) => {
            clock += dt;
            const due = queue.filter(q => q.at <= clock);
            if (due.length) { queue = queue.filter(q => q.at > clock); due.forEach(q => q.fn()); }
            update(dt);
            render(now);
        }, 30);

        startRound(0);
        render(performance.now());
        return () => { gen++; queue = []; cv.style.cursor = ''; };
    }

    Lab.register({
        id: 'stations', badge: 'reworked',
        name: 'Jump stations',
        short: 'Strap everyone in to jump',
        verb: 'Before each jump, get all five people into jump seats: pick someone, pick a seat, and they walk and climb there.',
        serves: 'The count: five seat lights come on, and A.U.R.A. still says four crew at stations.',
        replaces: 'Roll call, and the crew head count before each jump.',
        controls: 'Click a person, then a seat or deck · 1–5 pick crew · Enter: nearest seat · Esc: cancel',
        mount,
    });
})();
