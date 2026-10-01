/* proto-stations.js — Jump stations (reworked from round one's "Roll call").
   Before a jump all five people aboard must be strapped into a jump seat. Click a crew member, then a seat or a deck:
   they walk the deck and climb the ladder. Each strapped person lights a seat; A.U.R.A.'s tally never passes four.
   Sector 3: Jaxon is hurt and needs Aris to walk him. Sector 5: the hold's seat is broken, and Vance won't leave the
   hull patch until the commander has come down and seen it. */
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
    const PATCH = { x: 128, y: L.room('cargo').top + 5 }; // sector 5: the plate over the hole in the hold's hull
    const PACE_RANGE = [104, 122];                        // Vance, waiting, paces under it
    const FRAME = SHIP.HULL_RAMP[3], PAN = SHIP.HULL_RAMP[4];

    // ── tuning ──
    const WALK = 14, CLIMB = 9;                           // px/s: about 1.7 m/s on deck, 1.1 m/s on the ladder
    const STROLL = 0.3, HELPED = 0.45;                    // idle crew stroll; a man on one good leg moves at under half speed
    const BUCKLE = 0.9, WINDOW = 45, WARN = 10, FOLLOW = 6, GAP = 3.3;
    const BOARD = { x: 148, y: 6, w: 166, h: 168 };
    const ORDER = ['you', 'jaxon', 'aris', 'vance', 'mira'];
    const LABEL = { you: 'YOU', jaxon: 'JAXON', aris: 'ARIS', vance: 'VANCE', mira: 'MIRA' };
    const nameOf = id => LABEL[id][0] + LABEL[id].slice(1).toLowerCase();
    const DECK_SHORT = { bridge: 'BRIDGE', lab: 'LAB', quarters: 'QUARTERS', cargo: 'CARGO', engineering: 'ENGINE', upgrades: 'FAB' };
    const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five'];
    const STARS = (() => { const r = Lab.rng(905); return Array.from({ length: 46 }, () => ({ x: Math.floor(r() * 144), y: Math.floor(r() * H), bright: r() < 0.15 })); })();
    const STATUS = {                                      // board word, colour and how full the light is
        strapped: ['STRAPPED', C.greenBr, 1], buckle: ['BUCKLING', C.green, 0.6], hurt: ['HURT', C.red, 1], lying: ['INJURED', C.red, 0.3],
        escort: ['HELPING', C.amber, 0.3], go: ['MOVING', C.amber, 0.3], idle: ['NOT SEATED', C.boneD, 0.08],
        waiting: ['WAITING', C.amber, 0.3], limping: ['LIMPING', C.amber, 0.3], standing: ['STANDING', C.boneD, 0.08],
    };
    const status = c => STATUS[c.holding ? 'waiting' : c.helped && c.state === 'go' ? 'limping' : c.helped && c.state === 'idle' ? 'standing' : c.state];

    // ── words (docs/STYLE.md: plain speech, one idea a line, 20 words at most) ──
    const LINES = {
        closing: ['A.U.R.A.', 'The window is closing, Commander. Jumping now.'],
        lying: ['Jaxon', "I can't stand on this leg. I need Aris down here."],      // also what he says if you pick him
        helped: ['Aris', 'Lean on me, Jaxon. We go slowly.'],
        holding: ['Vance', "A.U.R.A. says this hull patch will hold. I'm not leaving till you've seen it."],
        convinced: ['Vance', "It's holding. I just needed someone else to look."],
        final: ['A.U.R.A.', 'Jump complete, Commander. Four crew aboard.'],
    };
    // Intro lines come GAP seconds apart. A line with a test is dropped when the player has already dealt with it.
    const ROUNDS = [
        {
            sector: 1,
            start: { you: ['bridge', 44], jaxon: ['engineering', 104], aris: ['lab', 34], vance: ['cargo', 40], mira: ['cargo', 104] },
            intro: [['A.U.R.A.', 'Jump in forty-five seconds, Commander. Everyone to a jump seat, please.'],
                ['', 'Click someone, then click a seat.', (crew, told) => !Object.keys(told).length],
                ['Vance', "Mira's down here with me. The hold only has one seat.", (crew, told) => !told.vance && !told.mira]],
            ready: [['A.U.R.A.', 'Four crew at stations, Commander. Ready to jump.'], ['Vance', "That's five."], ['Jaxon', "It's a glitch."]],
        },
        {
            sector: 3, injured: 'jaxon',
            start: { you: ['bridge', 100], jaxon: ['quarters', JAX_BUNK_X], aris: ['lab', 112], vance: ['cargo', 36], mira: ['quarters', 94] },
            intro: [['A.U.R.A.', 'Jump in forty-five seconds, Commander. Jaxon is injured in crew quarters.'],
                [...LINES.lying, (crew, told) => !told.jaxon && crew.aris.goal !== 'jaxon']],
            ready: [['A.U.R.A.', 'Ready to jump, Commander.']],
            after: [['Aris', 'Hold still, Jaxon. Now I can look at that leg.']],
        },
        {
            sector: 5, holdout: 'vance', broken: 6,
            start: { you: ['bridge', 50], jaxon: ['engineering', 110], aris: ['lab', 36], vance: ['cargo', 112], mira: ['upgrades', 60] },
            intro: [['A.U.R.A.', 'Jump in forty-five seconds, Commander. The jump seat in the cargo hold is broken.'],
                [...LINES.holding, (crew, told) => !told.vance && crew.vance.holding]],
            ready: [['A.U.R.A.', 'Ready to jump, Commander.']],
        },
    ];
    const HURT = {                                        // Aris, after a jump with one person loose
        you: 'You hit the console hard, Commander. Sit still while I check you.', jaxon: 'Jaxon was thrown into the wall. His shoulder is out.',
        jaxonInjured: 'Jaxon fell in the jump. His leg is worse now.', aris: "I hit my head in the jump. I'm all right. Give me a minute.",
        vance: 'Vance was thrown across the deck. He has a deep cut on his arm.', mira: 'Mira hit the floor in the jump. Her wrist is broken.',
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

    function mount(ctx, ui) {
        let ri = 0, phase = 'play', crew = {}, seats = [], sel = null, hover = null, timer = WINDOW, rnd = Lab.rng(1);
        let clock = 0, gen = 0, queue = [], trail = [], jumpT = -1, warned = false, results = {}, told = {}, shown = '', roundAt = 0, endedAt = 0;
        const later = (sec, fn) => { const g = gen; queue = queue.concat({ at: clock + sec, fn: () => g === gen && fn() }); };
        const set = (id, patch) => { crew = { ...crew, [id]: { ...crew[id], ...patch } }; };
        const say = ([who, line]) => { if (line !== shown) { shown = line; ui.say(who, line); } };   // never the same line twice in a row
        const sayAll = (lines, from, gap) => lines.forEach((l, j) => later(from + j * gap, () => say(l)));
        const occupant = i => ORDER.find(id => crew[id].seat === i) || null;
        const isFree = (i, id) => !seats[i].broken && [null, id].includes(occupant(i));
        const freeSeats = id => seats.map((s, i) => i).filter(i => isFree(i, id));
        const loose = () => ORDER.filter(id => crew[id].state !== 'strapped');

        // ── rounds ──
        function startRound(i) {
            gen++; queue = []; ri = i; phase = 'play'; sel = null; timer = WINDOW; jumpT = -1; warned = false;
            trail = []; told = {}; shown = ''; roundAt = clock;
            const r = ROUNDS[i];
            rnd = Lab.rng(r.sector * 7919);
            seats = SEATS.map(([deck, x], j) => ({ deck, x, broken: j === r.broken }));
            crew = Object.fromEntries(ORDER.map(id => {
                const [deck, x] = r.start[id];
                const c = { id, x, y: floorY(deck), path: [], pace: 1, state: 'idle', seat: null, wait: rnd() * 2, gait: 0, goal: null, helped: false, holding: r.holdout === id };
                return [id, r.injured === id ? { ...c, state: 'lying', y: BUNK_Y } : c];
            }));
            say(r.intro[0]);
            r.intro.slice(1).forEach(([who, line, test], j) => later((j + 1) * GAP, () => test(crew, told) && say([who, line])));
            showButtons();
        }
        const replay = i => { ui.clear(); startRound(i); };                // a fresh start shows no line from the last attempt
        function restart() { results = {}; replay(0); }
        const nextRound = () => (ri < ROUNDS.length - 1 ? startRound(ri + 1) : finish());
        function finish() { gen++; queue = []; phase = 'ended'; sel = null; endedAt = clock; showButtons(); }
        function ready() {                                                  // everyone is strapped in: no intro line may arrive after this
            gen++; queue = []; phase = 'ready'; sel = null; showButtons();
            const lines = ROUNDS[ri].ready;
            say(lines[0]);
            sayAll(lines.slice(1), 2.2, 1.8);
            later(2.2 + (lines.length - 1) * 1.8, jump);
        }
        function jump() {
            const hurt = loose(), r = ROUNDS[ri], isLast = ri === ROUNDS.length - 1;
            phase = 'jump'; jumpT = 0; sel = null;
            hurt.forEach(id => set(id, {                                    // whoever is loose is thrown to the floor below them
                state: 'hurt', holding: false, path: [], seat: null, y: FLOORS.find(f => f >= crew[id].y - 0.01) ?? FLOORS[FLOORS.length - 1] }));
            results = { ...results, [ri]: ORDER.length - hurt.length };
            const lines = (hurt.length ? [['Aris', hurtLine(hurt, r)]] : r.after || []).concat(isLast ? [LINES.final] : []);
            sayAll(lines, 1.4, 3.5);
            if (isLast) later(1.4 + (lines.length - 1) * 3.5 + 1.2, finish);
            else later(1.4 + lines.length * 3.5 + (lines.length ? 0 : 1), nextRound);
            showButtons();
        }

        // ── orders ──
        const pathTo = (c, deck, tx, fy = floorY(deck)) =>                 // along the deck to the ladder, up or down it, along to the spot
            (c.y === fy ? [] : (onFloor(c) ? [{ x: SHAFT, y: c.y }] : []).concat({ x: SHAFT, y: fy })).concat({ x: tx, y: fy });
        const cost = (c, s, fy = floorY(s.deck)) => (c.y === fy ? Math.abs(c.x - s.x) / WALK : (Math.abs(c.x - SHAFT) + Math.abs(SHAFT - s.x)) / WALK + Math.abs(c.y - fy) / CLIMB);
        function command(id, deck, tx, seat) {
            const c = crew[id];
            if (phase !== 'play' || !c || c.holding || ['hurt', 'escort', 'lying'].includes(c.state)) return false;
            set(id, { path: pathTo(c, deck, Math.round(tx)), state: 'go', seat, goal: null, pace: c.helped ? HELPED : 1 });
            told = { ...told, [id]: true };
            sel = null; showButtons();
            return true;
        }
        const sendSeat = (id, i) => command(id, seats[i].deck, seats[i].x, i);
        function sendDeck(id, deck, x) {
            const i = best(freeSeats(id).filter(k => seats[k].deck === deck), k => Math.abs(seats[k].x - x));
            return i !== undefined ? sendSeat(id, i) : command(id, deck, Lab.clamp(x, ...range(deck)), null);
        }
        function sendNearest(id) {
            if (!id || phase !== 'play') return;
            if (crew[id].state === 'strapped') { sel = null; return showButtons(); }   // already in a seat: leave them be
            const i = best(freeSeats(id), k => cost(crew[id], seats[k]));
            if (i !== undefined) sendSeat(id, i);
        }
        /** Pick a person. With someone already picked, picking Jaxon on his bunk or Vance at the patch sends them there. */
        function pick(id) {
            if (phase !== 'play') return;
            const c = crew[id];
            told = { ...told, [id]: true };
            if (sel === 'aris' && id === 'jaxon' && c.state === 'lying') return command('aris', 'quarters', ARIS_AT, null) && set('aris', { goal: 'jaxon' });
            if (sel === 'you' && id === 'vance' && c.holding) return command('you', 'cargo', Lab.clamp(c.x - 7, ...range('cargo')), null);
            const isComing = (c.state === 'lying' && crew.aris.goal === 'jaxon') || (c.holding && crew.you.path.some(p => p.y === floorY('cargo')));
            if (c.state === 'lying' || c.holding) return isComing || say(LINES[c.holding ? 'holding' : 'lying']);   // they tell you why not
            if (c.state === 'hurt') return;
            sel = c.state === 'escort' ? 'jaxon' : id;                    // Aris and Jaxon move as one
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
            if (crew.vance.holding && crew.you.y === floorY('cargo')) {    // the commander is down in the hold with him
                set('vance', { holding: false, path: [], state: 'idle', wait: 3 });
                say(LINES.convinced);
            }
            const out = loose();
            if (!out.length) return ready();
            if (!warned && timer <= WARN) { warned = true; say(['A.U.R.A.', warnLine(out)]); }
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
        function drawPatch() {                                              // a riveted plate across the hold's outer wall
            const { x, y } = PATCH;
            ctx.fillStyle = C.boneD; ctx.fillRect(x, y, 7, 10);
            ctx.fillStyle = C.bone; ctx.fillRect(x, y, 7, 1);
            [1, 5].forEach(dx => [2, 8].forEach(dy => Lab.dot(ctx, x + dx, y + dy, C.ink)));
        }
        function seatLight(s, i, t) {
            const who = occupant(i), blink = Math.floor(t / 260) % 2 === 0;
            if (s.broken) return blink ? C.red : C.line;
            if (who) return crew[who].state === 'strapped' ? C.greenBr : blink ? C.amber : C.line2;
            return sel && phase === 'play' && blink ? C.green : C.greenD;
        }
        function drawSeat(s, i, t) {                                        // a jump seat seen from the front, light on top
            const fy = floorY(s.deck), x = s.x, light = seatLight(s, i, t);
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
            if (light === C.greenBr) Lab.shade(ctx, x - 2, fy - 14, 5, 3, 0.3, C.green);   // a lit seat glows
            Lab.line(ctx, x - 1, fy - 13, x + 1, fy - 13, light);
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
            const top = down ? y - 8 : y - 16;                              // a small chevron over the head
            [[-2, 0], [2, 0], [-1, 1], [1, 1], [0, 2]].forEach(([dx, dy]) => Lab.dot(ctx, x + dx, top + dy, picked ? C.gold : C.boneD));
        }
        function render(t) {
            ctx.fillStyle = C.void; ctx.fillRect(0, 0, W, H);
            const k = jumpT / 1.4, len = jumpT >= 0 && k < 1 ? Math.round(16 * Math.sin(Math.PI * k)) : 0;   // the stars streak as the drive fires
            STARS.forEach(s => Lab.line(ctx, s.x, s.y, s.x, s.y + len, s.bright ? C.bone : C.boneD, len ? 0.6 : 1));
            const shake = jumpT >= 0 && jumpT < 0.8 ? Math.round(Math.sin(jumpT * 55) * 2 * (1 - jumpT / 0.8)) : 0;
            ctx.save();
            ctx.translate(shake, 0);
            SHIP.draw(ctx, L, t, { damaged: ROUNDS[ri].broken !== undefined ? { cargo: true } : {}, labels: true });
            if (ROUNDS[ri].holdout) drawPatch();
            drawShaft();
            seats.forEach((s, i) => drawSeat(s, i, t));
            ORDER.filter(id => id !== sel).concat(sel ? [sel] : []).forEach(id => drawCrew(id, t));
            if (jumpT >= 0 && jumpT < 0.3) {                                // a brief light through the hull
                for (let y = L.top; y < L.top + L.height; y++) Lab.shade(ctx, L.cx - L.halfWidth(y) + 2, y, L.halfWidth(y) * 2 - 4, 1, 0.16 * (1 - jumpT / 0.3), C.greenBr);
            }
            ctx.restore();
            drawBoard(t);
        }

        // ── the jump checklist board ──
        const right = (str, rx, y, col, scale = 1) => Lab.text(ctx, str, rx - Lab.textWidth(str, scale), y, col, scale);
        const mid = (str, cx, y, col) => Lab.text(ctx, str, Math.round(cx - Lab.textWidth(str) / 2), y, col);
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
        function logPanel() {                                               // the end: seats lit against A.U.R.A.'s count, per jump
            const x = BOARD.x + 6, wy = BOARD.y + 86, seatsX = BOARD.x + 96, auraX = BOARD.x + BOARD.w - 22;
            Lab.text(ctx, 'JUMP LOG', x, wy, C.boneD);
            mid('SEATS LIT', seatsX, wy, C.boneD);
            mid('A.U.R.A.', auraX, wy, C.boneD);
            ROUNDS.forEach((r, i) => {
                const y = wy + 10 + i * 8, n = results[i];
                Lab.text(ctx, 'SECTOR ' + r.sector, x, y, C.bone);
                mid(n === undefined ? '-' : String(n), seatsX, y, n === ORDER.length ? C.greenBr : n === undefined ? C.boneD : C.red);
                mid(n === undefined ? '-' : String(Math.min(4, n)), auraX, y, n === undefined ? C.boneD : n > 4 ? C.amber : C.green);
            });
        }
        function footer() {
            if (phase !== 'play') return '';
            if (!sel) return 'PICK A CREW MEMBER';
            const target = sel === 'aris' && crew.jaxon.state === 'lying' ? 'JAXON, ' : sel === 'you' && crew.vance.holding ? 'VANCE, ' : '';
            return LABEL[sel] + ': PICK ' + target + 'A SEAT OR DECK';
        }
        function drawBoard(t) {
            const { x, y, w, h } = BOARD, ay = y + 124, label = 'CREW ON STATION:';
            ctx.fillStyle = C.line2; ctx.fillRect(x, y, w, h);
            ctx.fillStyle = C.ink; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
            Lab.shade(ctx, x + 1, y + 1, w - 2, 12, 0.22, C.line2);
            Lab.text(ctx, 'JUMP CHECKLIST', x + 6, y + 4, C.green);
            const isNew = phase === 'play' && clock - roundAt < 2.4 && Math.floor(t / 300) % 2 === 0;   // a new round flashes its sector
            right('SECTOR ' + ROUNDS[ri].sector, x + w - 6, y + 4, isNew ? C.amber : C.boneD);
            ORDER.forEach(boardRow);
            Lab.line(ctx, x + 4, y + 80, x + w - 5, y + 80, C.line);
            if (phase === 'ended') logPanel(); else windowPanel(t);
            Lab.line(ctx, x + 4, ay - 4, x + w - 5, ay - 4, C.line);
            Lab.text(ctx, 'A.U.R.A. TALLY', x + 6, ay, C.boneD);
            Lab.text(ctx, label, x + 6, ay + 12, C.green);
            Lab.text(ctx, String(Math.min(4, ORDER.length - loose().length)), x + 10 + Lab.textWidth(label), ay + 9, C.greenBr, 2);
            Lab.text(ctx, footer(), x + 6, y + h - 10, sel ? C.gold : C.boneD);
        }

        // ── buttons, mouse and keys ──
        function showButtons() {
            if (phase === 'ended') return ui.buttons([{ label: 'Run it again', primary: true, onClick: restart }]);
            const strap = { label: 'Strap in', primary: !!sel, disabled: phase !== 'play' || !sel, onClick: () => sendNearest(sel) };
            ui.buttons([strap].concat(ROUNDS.map((r, i) => ({ label: 'Sector ' + r.sector, quiet: i !== ri, onClick: () => replay(i) }))));
        }
        const crewAt = (px, py) => best(ORDER.filter(id => {
            const c = crew[id], down = c.state === 'lying' || c.state === 'hurt';
            return Math.abs(px - c.x) <= (down ? 5 : 4) && py >= c.y - (down ? 5 : 11) && py <= c.y + 1;
        }), id => Math.abs(px - crew[id].x)) || null;
        const seatAt = (px, py) => seats.findIndex(s => Math.abs(px - s.x) <= 4 && py >= floorY(s.deck) - 14 && py <= floorY(s.deck) + 1);
        const rowAt = (px, py) => (px < BOARD.x ? -1 : ORDER.findIndex((id, i) => py >= BOARD.y + 16 + i * 12 && py < BOARD.y + 28 + i * 12));
        function click(px, py) {
            if (phase !== 'play') return;
            const row = rowAt(px, py), who = row >= 0 ? ORDER[row] : crewAt(px, py);
            if (who) return pick(who);
            if (!sel) return;
            const s = seatAt(px, py), room = L.roomAt(px, py);
            if (s >= 0 && isFree(s, sel)) sendSeat(sel, s);
            else if (room) sendDeck(sel, room.key, px);
            else { sel = null; showButtons(); }                             // a click off the ship lets go
        }
        const cv = ui.canvas;
        cv.onpointerdown = e => { if (e.button === 0) { const p = ui.toPixel(e); click(Math.floor(p.x), Math.floor(p.y)); } };
        cv.onpointermove = e => {
            const p = ui.toPixel(e), px = Math.floor(p.x), py = Math.floor(p.y);
            hover = phase === 'play' ? crewAt(px, py) : null;
            cv.style.cursor = phase === 'play' && (hover || rowAt(px, py) >= 0 || (sel && L.roomAt(px, py))) ? 'pointer' : '';
        };
        Lab.onKey((k, e) => {
            const el = e && e.target, isButton = !!el && el.tagName === 'BUTTON';
            const isOwnPick = isButton && el.classList.contains('pick') && el.getAttribute('aria-current') === 'true';
            if (k === ' ' || k === 'Enter') {
                if (isButton && !isOwnPick) return;                         // the focused button handles it
                if (isOwnPick) e.preventDefault();                          // don't reopen this sketch from the list
                if (phase === 'ended') { if (clock - endedAt > 1.5) restart(); } // a key still held from the last jump can't skip the end
                else sendNearest(sel);
            } else if (k === 'Escape') { sel = null; showButtons(); }
            else if (/^[1-5]$/.test(k)) pick(ORDER[Number(k) - 1]);
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
        serves: 'The count: five seat lights come on, and A.U.R.A. still says four crew.',
        replaces: 'Roll call, and the crew head count before each jump.',
        controls: 'Click a person, then a seat or deck · 1–5 pick crew · Enter: nearest seat · Esc: cancel',
        mount,
    });
})();
