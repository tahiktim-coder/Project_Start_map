/* proto-rollcall.js — ROLL CALL.
   Before each jump A.U.R.A. asks everyone to sound off. You click each of the five people aboard (yourself too),
   each one answers, and she reports "four crew". Three rounds: sector 1, sector 3 (Vance goes quiet), and
   sector 6, where she reports before you have answered and jumps without waiting for you. */
(function () {
    'use strict';
    const Lab = window.Lab, C = Lab.C;

    const DECKS = [{ c: 44, f: 70 }, { c: 75, f: 101 }, { c: 106, f: 132 }];   // ceiling row, floor row
    const NOSE = [[250, 40], [288, 60], [296, 74], [290, 88], [262, 140]];       // the hull's front edge
    const HULL = { x0: 34, y0: 40, y1: 140 };
    const WALL = 148, ROOM_X = 38;                                                 // bulkhead x, rear inner wall
    const ROOMS = [['LAB', 0, ROOM_X], ['BRIDGE', 0, 152], ['QUARTERS', 1, ROOM_X], ['CARGO', 1, 152], ['ENGINEERING', 2, ROOM_X], ['AIRLOCK', 2, 152]];
    const CREW = [
        { id: 'mira', key: '1', name: 'Mira', color: C.greenBr, deck: 0, x0: 44, x1: 138 },
        { id: 'aris', key: '2', name: 'Aris', color: C.violet, deck: 1, x0: 44, x1: 138 },
        { id: 'jaxon', key: '3', name: 'Jaxon', color: C.amber, deck: 2, x0: 76, x1: 140 },
        { id: 'vance', key: '4', name: 'Vance', color: C.red, deck: 2, x0: 172, x1: 240 },
        { id: 'you', key: '5', name: 'You', color: C.white, deck: 0, x0: 184, x1: 232, isYou: true },
    ];
    const OPEN_LINE = 'Jump in two minutes. Everyone, sound off.';
    const COUNT_LINE = 'Four crew, Commander. All accounted for.';
    const YOU_LINE = 'You answer from the bridge.';
    const LINES = {
        1: { mira: 'Mira, in the lab. Here.', aris: 'Aris, in quarters. Here.', jaxon: 'Engineering. Here.', vance: 'Vance, at the airlock. Here.' },
        3: { mira: "Lab. I'm here.", aris: 'Here. Quarters.', jaxon: 'Engineering. Still here.', vance: 'Here.' },
        6: { mira: 'Here.', aris: 'Aris. Here.', jaxon: 'Engineering.', vance: 'Here.' },
    };
    // said after the count: [seconds after the line before, speaker, words]
    const AFTER = { 1: [[2.6, 'Vance', "That's five."], [2.0, 'Jaxon', "It's a glitch."]], 3: [[3.2, 'Vance', 'Five.']], 6: [] };
    const WRECKS = {
        1: [[206, 13, 'EXODUS-4'], [70, 150, 'EXODUS-7']],
        3: [[226, 12, '980'], [56, 151, '212'], [150, 21, '644']],
        6: [[196, 9, '38,406'], [60, 19, '41,002'], [128, 150, '30,517'], [236, 154, '36,290']],
    };
    const LIGHT = { 1: null, 3: { x: 300, y: 18, r: 6, a: 0.6 }, 6: { x: 302, y: 18, r: 26, a: 0.55 }, end: { x: 298, y: 20, r: 50, a: 0.6 } };   // ahead, top right
    const NEXT = { 1: 3, 3: 6 };
    const WALK_SPEED = 6, JUMP_TIME = 1.8, JUMP_CLOCK = 120;

    function noseX(y) {
        for (let i = 0; i < NOSE.length - 1; i++) {
            const [xa, ya] = NOSE[i], [xb, yb] = NOSE[i + 1];
            if (y >= ya && y <= yb) return Math.floor(xa + (xb - xa) * (y - ya) / (yb - ya));
        }
        return -1;
    }
    const inHull = (x, y) => x >= HULL.x0 && y >= HULL.y0 && y <= HULL.y1 && x <= noseX(y);
    const inRoom = (x, y) => DECKS.some(d => y >= d.c && y < d.f) && x >= ROOM_X && x <= noseX(y) - 4 && (x < WALL || x > WALL + 3);
    const box = (g, x, y, w, h, col) => {
        Lab.line(g, x, y, x + w - 1, y, col); Lab.line(g, x, y + h - 1, x + w - 1, y + h - 1, col);
        Lab.line(g, x, y, x, y + h - 1, col); Lab.line(g, x + w - 1, y, x + w - 1, y + h - 1, col);
    };

    // ── the ship, drawn once into its own layer ──
    function drawHull(g) {
        const px = (x, y, col) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); };
        for (let y = HULL.y0; y <= HULL.y1; y++) for (let x = HULL.x0; x <= 300; x++) {
            if (!inHull(x, y)) continue;
            if (inRoom(x, y)) { px(x, y, C.ink); if (x % 16 === 0 && Lab.on(x, y, 0.35)) px(x, y, C.line); continue; }
            px(x, y, C.ink2);
            if (Lab.on(x, y, 0.62 - (y - HULL.y0) / 260)) px(x, y, C.line);
            if ((!inHull(x, y - 1) || !inHull(x + 1, y)) && Lab.on(x, y, 0.7)) px(x, y, C.boneD);
            else if (!inHull(x, y + 1)) px(x, y, C.line2);
        }
        for (let y = 46; y <= 66; y++) for (let k = 1; k <= 3; k++) {                 // bridge window
            const x = noseX(y) - k;
            px(x, y, C.greenD); if (Lab.on(x, y, 0.2)) px(x, y, C.greenBr);
        }
        for (const cy of [88, 119]) for (let x = 20; x < HULL.x0; x++) {              // engine bells
            const h = Math.round(5 + (HULL.x0 - x) * 0.3);
            for (let y = cy - h; y <= cy + h; y++) {
                if (y === cy - h || y === cy + h || x === 20) { if (Lab.on(x, y, 0.8)) px(x, y, C.boneD); }
                else { px(x, y, C.ink2); if (Lab.on(x, y, 0.45)) px(x, y, C.line2); }
            }
        }
        DECKS.forEach(d => {                                                            // floors and sealed hatches
            Lab.line(g, ROOM_X, d.f, noseX(d.f) - 4, d.f, C.line2);
            Lab.line(g, ROOM_X, d.f, noseX(d.f) - 4, d.f, C.boneD, 0.15);
            box(g, WALL, d.f - 12, 4, 12, C.line2);
            Lab.dot(g, WALL + 1, d.f - 15, C.green);
        });
        Lab.line(g, 110, 31, 110, 39, C.line2); Lab.line(g, 108, 39, 112, 39, C.line2);  // mast
        Lab.text(g, 'EXODUS-9', 44, 134, C.boneD);
        ROOMS.forEach(([name, deck, x]) => Lab.text(g, name, x + 4, DECKS[deck].c + 4, C.greenD));
    }
    function drawRooms(g) {
        box(g, 188, 46, 26, 6, C.line2); [[193, 48], [199, 49], [206, 48]].forEach(([x, y]) => Lab.dot(g, x, y, C.greenD));
        Lab.shade(g, 238, 63, 14, 7, 0.5, C.line2); Lab.line(g, 238, 63, 251, 63, C.boneD, 0.6);             // bridge console
        Lab.line(g, 222, 64, 222, 69, C.boneD, 0.7); Lab.line(g, 222, 66, 226, 66, C.boneD, 0.7); Lab.line(g, 225, 67, 225, 69, C.boneD, 0.7);
        Lab.line(g, 56, 62, 104, 62, C.line2); Lab.line(g, 58, 63, 58, 69, C.line2); Lab.line(g, 102, 63, 102, 69, C.line2); // lab bench
        Lab.shade(g, 62, 59, 5, 3, 0.6, C.boneD); Lab.shade(g, 86, 58, 3, 4, 0.5, C.boneD); Lab.dot(g, 72, 61, C.amber); Lab.dot(g, 76, 61, C.green);
        box(g, 118, 49, 7, 20, C.greenD); Lab.shade(g, 119, 55, 5, 13, 0.3, C.green);
        [88, 98].forEach(y => { Lab.line(g, 90, y, 124, y, C.line2); Lab.line(g, 91, y - 1, 123, y - 1, C.boneD, 0.4); }); // bunks
        Lab.line(g, 90, 82, 90, 100, C.line); Lab.line(g, 124, 82, 124, 100, C.line); Lab.dot(g, 132, 90, C.amber);
        [[198, 89, 15, 12], [214, 89, 15, 12], [206, 79, 15, 10], [240, 93, 11, 8]].forEach(([x, y, w, h]) => {
            Lab.shade(g, x, y, w, h, 0.22, C.line2); box(g, x, y, w, h, C.line2);                                // crates
        });
        Lab.line(g, ROOM_X, 108, 147, 108, C.line2); Lab.dot(g, 96, 108, C.amber); Lab.dot(g, 128, 108, C.amber); // pipe
        Lab.line(g, 50, 116, 50, 131, C.line2); Lab.line(g, 66, 116, 66, 131, C.line2);                          // reactor
        [116, 121, 126, 131].forEach(y => Lab.line(g, 50, y, 66, y, C.boneD, 0.5));
        box(g, 128, 115, 10, 8, C.line2);
        box(g, 247, 112, 13, 20, C.line2);                                                                       // outer door
        for (let y = 113; y < 131; y++) for (let x = 248; x < 259; x++) if ((x + y) % 6 < 3 && Lab.on(x, y, 0.55)) Lab.dot(g, x, y, C.amber);
    }
    function buildShip() {
        const cv = document.createElement('canvas');
        cv.width = Lab.W; cv.height = Lab.H;
        const g = cv.getContext('2d');
        drawHull(g); drawRooms(g);
        return cv;
    }

    function mount(ctx, ui) {
        const ship = buildShip(), rand = Lab.rng(9), srand = Lab.rng(7);
        const stars = Array.from({ length: 80 }, () => ({ x: srand() * Lab.W, y: srand() * Lab.H, v: 0.5 + srand() * 1.5, col: srand() < 0.15 ? C.bone : C.boneD }));
        let figs = [], hover = null, queue = [], clock = 0, drift = 0;
        let sector = 1, view = 1, phase = 'call', jumpLeft = JUMP_CLOCK, countT = null, jumpT = null, youEarly = false;

        const later = (sec, fn) => { queue = [...queue, { at: clock + sec, fn }]; };
        function runDue() {
            const due = queue.filter(e => e.at <= clock);
            queue = queue.filter(e => e.at > clock);
            due.forEach(e => e.fn());
        }
        const canAnswer = f => !!f && !f.answered && (phase === 'call' || (phase === 'count' && sector === 6 && f.isYou));
        const makeFig = c => ({ ...c, answered: false, lampT: null, stopped: false, idle: false, step: 0,
            timer: 1 + rand() * 3, x: c.x0 + Math.floor(rand() * (c.x1 - c.x0)), dir: rand() < 0.5 ? -1 : 1 });

        // ── the rounds ──
        function startRound(s, delay) {
            sector = s; view = s; phase = 'call'; queue = []; jumpLeft = JUMP_CLOCK; countT = null; youEarly = false;
            figs = CREW.map(makeFig); hover = null;
            later(delay || 0, () => ui.say('A.U.R.A.', OPEN_LINE));
            renderButtons();
        }
        function answer(f) {
            if (!canAnswer(f)) return;
            f.answered = true; f.stopped = true; f.lampT = clock;
            if (f.isYou) { ui.say('', YOU_LINE); youEarly = sector === 6 && countT === null; }
            else ui.say(f.name, LINES[sector][f.id]);
            const waitingOn = figs.filter(g => !(sector === 6 && g.isYou));
            if (phase === 'call' && waitingOn.every(g => g.answered)) callCount();
            else renderButtons();
        }
        function callCount() {
            phase = 'count';
            renderButtons();
            later(sector === 6 ? 0.8 : 1.4, () => {
                ui.say('A.U.R.A.', COUNT_LINE); countT = clock;
                let at = 0;
                AFTER[sector].forEach(([gap, who, words]) => { at += gap; later(at, () => ui.say(who, words)); });
                if (sector === 6) later(3.4, startJump);
                else later(at + 1.6, () => { phase = 'ready'; renderButtons(); });
            });
        }
        function startJump() {
            if (phase !== 'ready' && !(phase === 'count' && sector === 6)) return;
            const from = sector;
            phase = 'jump'; jumpT = clock; jumpLeft = 0;
            renderButtons();
            later(JUMP_TIME / 2, () => (NEXT[from] ? startRound(NEXT[from], JUMP_TIME / 2) : finish()));
        }
        function finish() {
            view = 'end';
            later(1.3, () => {
                phase = 'end';
                ui.say('', youEarly ? 'Nobody said anything this time.' : "She didn't wait for you.");
                renderButtons();
            });
        }
        function pick(s) { jumpT = null; ui.clear(); startRound(s, 0.3); }

        function renderButtons() {
            const sectors = [1, 3, 6].map(s => ({ label: 'Sector ' + s, quiet: s !== sector, onClick: () => pick(s) }));
            let main = [];
            if (phase === 'call' || phase === 'count') main = figs.map(f => ({ label: f.key + ' · ' + f.name, disabled: !canAnswer(f), onClick: () => answer(f) }));
            if (phase === 'ready') main = [{ label: 'Jump', primary: true, onClick: startJump }];
            if (phase === 'end') main = [{ label: 'Run it again', primary: true, onClick: () => pick(1) }];
            ui.buttons([...main, ...sectors]);
        }

        // ── input ──
        const figAt = p => figs.find(f => { const fl = DECKS[f.deck].f; return p.x >= f.x - 4 && p.x <= f.x + 8 && p.y >= fl - 19 && p.y <= fl + 2; });
        let pointer = null;                                   // last pointer spot on the picture; hover is re-checked every frame
        const updateHover = () => {
            hover = (pointer && figAt(pointer)) || null;
            const cursor = canAnswer(hover) ? 'pointer' : '';
            if (ui.canvas.style.cursor !== cursor) ui.canvas.style.cursor = cursor;
        };
        ui.canvas.onclick = e => { answer(figAt(ui.toPixel(e))); updateHover(); };
        ui.canvas.onpointermove = e => { pointer = ui.toPixel(e); updateHover(); };
        ui.canvas.onpointerleave = () => { pointer = null; updateHover(); };
        Lab.onKey((k, e) => {
            const f = figs.find(g => g.key === k);
            if (f) return answer(f);
            if (k !== ' ' && k !== 'Enter') return;
            // A focused button keeps its own Space/Enter, except this prototype's own list entry (re-opening it would restart the run).
            const el = e && e.target;
            if (el && el.tagName === 'BUTTON' && el.dataset.id !== 'rollcall') return;
            if (el && el.tagName === 'BUTTON') e.preventDefault();
            if (phase === 'ready') startJump();
            else if (phase === 'end') pick(1);
        });

        // ── motion ──
        function walk(f, dt) {
            if (f.stopped) return;
            f.timer -= dt;
            if (f.idle) {
                if (f.timer <= 0) { f.idle = false; f.timer = 2 + rand() * 4; if (rand() < 0.4) f.dir = -f.dir; }
                return;
            }
            f.step += dt;
            f.x = Lab.clamp(f.x + f.dir * WALK_SPEED * dt, f.x0, f.x1);
            if (f.x === f.x0 || f.x === f.x1) f.dir = f.x === f.x0 ? 1 : -1;
            if (f.timer <= 0) { f.idle = true; f.timer = 1 + rand() * 2.5; }
        }
        const streakNow = () => (jumpT !== null && clock - jumpT < JUMP_TIME / 2 ? (clock - jumpT) / (JUMP_TIME / 2) : 0);

        // ── drawing ──
        function drawBack(t, streak) {
            ctx.fillStyle = C.void; ctx.fillRect(0, 0, Lab.W, Lab.H);
            const L = LIGHT[view];
            if (L) {
                const r = L.r + Math.sin(t / 1600) * Math.min(2, L.r / 6);
                Lab.disc(ctx, L.x, L.y, r, d => (1 - d) * (1 - d) * L.a, C.gold);
                Lab.disc(ctx, L.x, L.y, r * 0.4, d => (1 - d) * 0.65, C.white);
            }
            stars.forEach(s => (streak ? Lab.line(ctx, s.x, s.y, s.x + streak * 40 * s.v, s.y, s.col, 0.6) : Lab.dot(ctx, s.x, s.y, s.col)));
            (WRECKS[view === 'end' ? 6 : view] || []).forEach(([wx, wy, label]) => {
                const x = Math.round(((wx - drift) % 360 + 360) % 360 - 30);
                Lab.line(ctx, x + 1, wy, x + 12, wy, C.boneD, 0.7);
                Lab.shade(ctx, x, wy + 1, 16, 3, 0.35, C.boneD);
                Lab.shade(ctx, x + 17, wy + 2, 3, 1, 0.5, C.boneD);
                Lab.text(ctx, label, x + 23, wy, C.boneD);
            });
            if (streak) [88, 119].forEach(cy => {
                Lab.disc(ctx, 18, cy, 3 + streak * 10, d => (1 - d) * streak * 0.9, C.amber);
                Lab.disc(ctx, 18, cy, 1 + streak * 3, 0.9, C.white);
            });
        }
        function drawLife(t) {
            const s = t / 1000;
            Lab.disc(ctx, 58, 123, 5, d => (1 - d) * (0.45 + 0.15 * Math.sin(s * 1.3)), C.amber);
            Lab.dot(ctx, 58, 123, C.gold);
            for (let i = 0; i < 3; i++) if ((Math.floor(s * 2) + i * 2) % 3) Lab.dot(ctx, 241 + i * 4, 62, C.green);
            const sweep = 189 + (Math.floor(s * 6) % 24);
            Lab.line(ctx, sweep, 47, sweep, 50, C.greenD);
            if (s % 2.4 < 0.18) Lab.dot(ctx, 110, 30, C.red);
            if ((s + 1.2) % 2.4 < 0.18) Lab.dot(ctx, 297, 74, C.green);
            Lab.disc(ctx, 253, 109, 1.6, 0.5 + 0.4 * Math.sin(s * 2), C.red);
        }
        function brackets(x0, y0, x1, y1) {
            [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]].forEach(([x, y, sx, sy]) => {
                Lab.dot(ctx, x, y, C.green); Lab.dot(ctx, x + sx, y, C.green); Lab.dot(ctx, x, y + sy, C.green);
            });
        }
        function drawFig(f) {
            const fl = DECKS[f.deck].f, x = Math.round(f.x), y = fl - 8;
            const p = (dx, dy, col) => Lab.dot(ctx, x + dx, y + dy, col);
            [[1, 0], [2, 0], [1, 1], [2, 1]].forEach(([dx, dy]) => p(dx, dy, C.bone));
            for (let dx = 0; dx < 4; dx++) { p(dx, 2, f.color); p(dx, 3, f.color); }
            p(0, 4, C.boneD); p(1, 4, f.color); p(2, 4, f.color); p(3, 4, C.boneD); p(1, 5, C.boneD); p(2, 5, C.boneD);
            const striding = !f.stopped && !f.idle && Math.floor(f.step * 4) % 2 === 1;
            (striding ? [0, 3] : [1, 2]).forEach(dx => { p(dx, 6, C.boneD); p(dx, 7, C.boneD); });
            if (f.lampT !== null) {
                const age = clock - f.lampT;
                if (age > 1 || Math.floor(age * 8) % 2 === 0) {
                    Lab.disc(ctx, x + 1.5, fl - 12.5, 3.5, d => (1 - d) * 0.5, f.color);
                    Lab.shade(ctx, x + 1, fl - 13, 2, 2, 1, f.color);
                }
                return;
            }
            const hot = hover === f && canAnswer(f);
            if (f.isYou) Lab.text(ctx, 'YOU', x - 4, fl - 16, hot ? C.white : C.bone);
            else Lab.text(ctx, f.key, x + 1, fl - 16, hot ? C.bone : C.boneD);
            if (hot) brackets(x - 2, fl - 10, x + 5, fl);
        }
        function drawReadouts() {
            Lab.line(ctx, 34, 161, 296, 161, C.line, 0.6);
            Lab.text(ctx, 'SECTOR ' + sector, 34, 167, C.boneD);
            if (view !== 'end') {
                const s = Math.ceil(jumpLeft);
                Lab.text(ctx, 'JUMP ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'), 140, 167, C.boneD);
            }
            if (countT !== null && (clock - countT > 0.8 || Math.floor((clock - countT) * 8) % 2 === 0)) {
                Lab.text(ctx, 'CREW 4', 296 - Lab.textWidth('CREW 4'), 167, C.green);
            }
        }
        function draw(t) {
            drawBack(t, streakNow());
            ctx.drawImage(ship, 0, 0);
            drawLife(t);
            figs.forEach(drawFig);
            drawReadouts();
            if (jumpT === null) return;
            const p = (clock - jumpT) / JUMP_TIME;
            if (p >= 1) { jumpT = null; return; }
            Lab.shade(ctx, 0, 0, Lab.W, Lab.H, Math.min(1, (p < 0.5 ? p : 1 - p) * 2.3), C.void);
        }

        Lab.loop((dt, t) => {
            clock += dt;
            const streak = streakNow();
            drift += dt * (1.2 + streak * 30);
            stars.forEach(s => { s.x -= s.v * dt * (1 + streak * 60); if (s.x < 0) s.x += Lab.W; });
            runDue();
            if (phase === 'call' || phase === 'count' || phase === 'ready') jumpLeft = Math.max(0, jumpLeft - dt);
            figs.forEach(f => walk(f, dt));
            if (pointer) updateHover();
            draw(t);
        }, 30);

        startRound(1, 0.4);
        return () => { queue = []; ui.canvas.onpointerleave = null; ui.canvas.style.cursor = ''; };
    }

    Lab.register({
        id: 'rollcall',
        name: 'Roll call',
        short: 'Call the roll before jumping',
        verb: 'Before each jump, click each person aboard, yourself too, and hear them answer. Then A.U.R.A. gives the count.',
        serves: 'The count: five people answer, and A.U.R.A. says four crew.',
        replaces: 'The scene where the crew explain the count to the player.',
        controls: 'Click each person, or press 1–5 · Space: jump',
        mount,
    });
})();
