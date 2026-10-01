/* proto-breach.js — Seal the breach.
   A micrometeorite holes EXODUS-9 somewhere A.U.R.A. cannot see. Loose dust in every deck rides the air: toward the
   hole, and toward any open ladder hatch that leads to it. Each deck's air shows on a bar at the side. Shut hatches to
   stop the spread (a deck cut off with the hole then empties faster), mark the hole, and Jaxon climbs there to patch it.
   Air: the hole vents K·√p per second, so a cut-off deck empties in 2/K s; an open hatch passes G·Δp per second. */

(function () {
    'use strict';
    const Lab = window.Lab;
    if (!Lab || !Lab.ship) return;
    const C = Lab.C, W = Lab.W, H = Lab.H, S = Lab.ship;

    const K_LEAK = 0.04, G_HATCH = 0.1, REFILL = 0.012;   // full to empty in 50 s when cut off; tanks refill after
    const WALK = 16, CLIMB = 11, CYCLE = 1.6, PATCH = 4;   // px/s (a deck is 25 px, about 2.5 m); seconds
    const HIT_R = 7, INTRO = 3, AIM_SPEED = 55;            // a mark this close finds the hole
    const DUST = 20, WANDER = 1.3, PULL = 9;
    const MARKS = [0.8, 0.6, 0.4, 0.2, 0.1];
    const RX = 192, BW = 80;                                // the air readout column
    const CANDIDATES = ['lab', 'quarters', 'cargo', 'engineering', 'upgrades'];
    const NAME = { bridge: 'Bridge', lab: 'Laboratory', quarters: 'Crew quarters', cargo: 'Cargo hold', engineering: 'Engineering', upgrades: 'Fabrication' };
    const THE = { bridge: 'the bridge', lab: 'the laboratory', quarters: 'the crew quarters', cargo: 'the cargo hold', engineering: 'engineering', upgrades: 'fabrication' };
    const STEP_KEYS = { ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0], ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1] };
    const PCT = '101001010100101';
    const ONES = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split(' ');
    const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
    const words = n => (n >= 100 ? 'one hundred' : n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : ''));
    const cap = s => s[0].toUpperCase() + s.slice(1);
    const listing = a => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);

    // the night shift, and what each person says if the hole is in their deck
    const PEOPLE = [
        { id: 'you', home: 'bridge', slot: 0.45 },
        { id: 'mira', home: 'lab', slot: 0.3, notice: 0.93, warn: ['The leak is in the lab. I can feel it.', 'Close it. I have a mask. Get Jaxon here.'],
          shut: "Mask on. I'm staying put.", out: "I'm out.", hurtLine: ['Aris', "Mira's hurt. She was in there with no air."] },
        { id: 'aris', home: 'quarters', lying: true, notice: 0.87, warn: ['The quarters are losing air. It woke me.', 'Shut me in if you have to. I have a mask.'],
          shut: 'Mask on. Please hurry.', out: "I'm out. I'm all right.", hurtLine: ['Vance', "Aris is down. She's breathing, but she's hurt."] },
        { id: 'vance', home: 'cargo', slot: 0.35, notice: 0.94, warn: ["Cargo hold's losing air.", "Seal it if you need to. I've got a mask."],
          shut: 'Fine. Mask on.', out: "I'm clear.", hurtLine: ['Aris', 'Vance is hurt. I need him in the quarters.'] },
        { id: 'jaxon', home: 'engineering', slot: 0.22, notice: 0.94, warn: ["It's in engineering with me.", 'Shut me in and show me where it is.'],
          hurtLine: ['Vance', "Jaxon's hurt. Someone else has to patch it."] },
    ];

    function glyph(ctx, x, y, color) {                    // the font has no '%'
        ctx.fillStyle = color;
        for (let i = 0; i < 15; i++) if (PCT[i] === '1') ctx.fillRect(x + (i % 3), y + Math.floor(i / 3), 1, 1);
    }

    function mount(ctx, ui) {
        const L = S.layout(14, 6, 168, 166), R = L.rooms, shaftX = Math.round(L.cx + L.maxHalf * 0.26);
        const deckY = h => R[h + 1].top;                                   // hatch h joins rooms h and h+1
        const floorY = i => R[i].bottom - 2;
        const roomOfY = y => R.findIndex(r => y >= r.top && y < r.bottom);
        const inside = (x, y) => { const i = roomOfY(y); return i >= 0 && Math.abs(x - L.cx) <= L.halfWidth(y) - 2 ? i : -1; };
        const floorX = (i, x) => { const hw = L.halfWidth(floorY(i) - 1) - 5; return Lab.clamp(Math.round(x), Math.ceil(L.cx - hw), Math.floor(L.cx + hw)); };
        const figRoom = f => roomOfY(Math.round(f.y) - 4);
        const IS = i => (R[i].key === 'quarters' ? 'are' : 'is');
        const hatchAt = p => [0, 1, 2, 3, 4].find(h => Math.abs(p.x - shaftX) <= 5 && p.y >= deckY(h) - 5 && p.y <= deckY(h) + 3) ?? -1;

        let g = null, crew = [], dust = [], talk = [], talkWait = 0, lastLeak = -1, spokeAt = [];
        let aim = { x: L.cx, y: R[2].top + 12 }, aimShown = false, hoverHatch = -1, held = null;
        const crewById = id => crew.find(f => f.id === id);
        const setCrew = (id, patch) => { crew = crew.map(f => (f.id === id ? { ...f, ...patch } : f)); };

        // ── one line at a time: urgent lines jump the queue, a newer report replaces an unspoken one. A line may be a
        //    function, read when it is shown, so A.U.R.A.'s numbers always match the bars; `after` runs once it is shown ──
        function say(who, line, pri = 1, tag = '', after = null) {
            const item = { who, line, pri, tag, after }, kept = tag ? talk.filter(q => q.tag !== tag) : talk, at = kept.findIndex(q => q.pri < pri);
            talk = at < 0 ? kept.concat(item) : kept.slice(0, at).concat(item, kept.slice(at));
        }
        function pumpTalk(dt) {
            talkWait -= dt;
            while (talkWait <= 0 && talk.length) {
                const [q, ...rest] = talk, text = q.fn ? '' : typeof q.line === 'function' ? q.line() : q.line;
                talk = rest;
                if (q.fn) q.fn();
                if (!text) continue;
                ui.say(q.who, text);
                talkWait = Lab.clamp(0.8 + text.split(' ').length * 0.17, 1.8, 3.2);
                if (q.after) q.after();
            }
        }
        const live = fn => () => (g.phase === 'leak' && g.patchLeft <= 0 ? fn() : '');

        function speck(i, rnd = Math.random) {
            const r = R[i], y = r.top + 3 + rnd() * (r.bottom - r.top - 6), hw = Math.max(2, L.halfWidth(y) - 4);
            return { x: L.cx - hw + rnd() * hw * 2, y, room: i, a: rnd() * 6.283, b: rnd(), vx: 0, vy: 0 };
        }
        function placeHole(i, rnd) {                       // low on the deck's back wall, clear of the ladder
            const y = floorY(i) - 4 - Math.floor(rnd() * 10), hw = L.halfWidth(y) - 10;
            let x = shaftX;
            while (Math.abs(x - shaftX) < 16) x = Math.round(L.cx - hw + rnd() * hw * 2);
            return { x, y };
        }

        function start() {
            const rnd = Lab.rng((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
            const pool = CANDIDATES.map(k => R.findIndex(r => r.key === k)).filter(i => i !== lastLeak), leak = pool[Math.floor(rnd() * pool.length)];
            lastLeak = leak; talk = []; talkWait = 0; held = null; spokeAt = R.map(() => -99);
            g = { phase: 'calm', t: 0, leak, hole: placeHole(leak, rnd), p: R.map(() => 1), low: R.map(() => 1), flow: [0, 0, 0, 0, 0], out: 0, vented: 0,
                shut: [false, false, false, false, false], cycling: [0, 0, 0, 0, 0], target: null, miss: 0, missed: false, sent: 0,
                patchLeft: 0, patched: false, flash: 0, shake: 0, told: R.map(() => 0), said: {}, damaged: {}, ended: false };
            crew = PEOPLE.map(p => {
                const i = R.findIndex(r => r.key === p.home);
                const pos = p.lying ? { x: Math.round(L.cx - L.maxHalf * 0.62), y: R[i].top + Math.round((R[i].bottom - R[i].top) * 0.78) } : L.floor(p.home, p.slot);
                return { ...p, ...pos, name: S.CREW[p.id].name, color: S.CREW[p.id].color, path: [], wait: 0, state: 'idle', stepT: 0, moving: false, masked: false, hurt: false };
            });
            dust = R.flatMap((r, i) => Array.from({ length: DUST }, () => speck(i, rnd)));
            ui.say('', 'Sector one. Night shift. Aris is asleep in the crew quarters.');
            showButtons();
        }
        function hit() {
            g = { ...g, phase: 'leak', flash: 1, shake: 0.7 };
            ui.say('A.U.R.A.', 'Pressure loss, Commander. I cannot see where.');
            talkWait = 2.6;
            say('Jaxon', 'Watch the dust. It drifts toward the hole.', 3);
            say('A.U.R.A.', live(() => (g.shut.some(Boolean) ? '' : 'The ladder hatches can be shut from the bridge, Commander.')), 2);
            if (R[g.leak].key !== 'engineering') say('Jaxon', live(() => (g.sent ? '' : "Mark the spot for me and I'll go.")), 2);
            showButtons();
        }

        // ── the air ──
        function stepAir(dt) {
            const p = g.p.slice(), k = K_LEAK * (g.patchLeft > 0 ? g.patchLeft / PATCH : 1);
            const out = g.phase === 'leak' ? Math.min(p[g.leak], k * Math.sqrt(Math.max(0, p[g.leak])) * dt) : 0;
            p[g.leak] -= out;
            const flow = g.shut.map((s, h) => (s ? 0 : G_HATCH * (p[h] - p[h + 1])));
            flow.forEach((q, h) => { p[h] -= q * dt; p[h + 1] += q * dt; });
            const next = g.patched ? p.map(v => Math.min(1, v + REFILL * dt)) : p;
            g = { ...g, p: next, low: g.low.map((m, i) => Math.min(m, next[i])), flow, out: dt > 0 ? out / dt : 0, vented: g.vented + out };
        }
        function reports() {
            R.forEach((r, i) => {
                const marks = i === g.leak ? MARKS : MARKS.slice(0, 2), due = marks.filter(m => g.p[i] < m).length;
                if (due <= g.told[i]) return;
                g = { ...g, told: g.told.map((v, j) => (j === i ? due : v)) };
                say('A.U.R.A.', live(() => {                                   // at most one report a deck every five seconds
                    if (g.t - spokeAt[i] < 5) return '';
                    spokeAt = spokeAt.map((v, j) => (j === i ? g.t : v));
                    return `${NAME[r.key]} at ${words(Math.round(g.p[i] * 100))} percent, Commander.`;
                }), 1, 'r' + i);
            });
            const i = g.leak, isCut = () => (i === 0 || g.shut[i - 1]) && (i === 5 || g.shut[i]);
            if (isCut() && !g.said.cut && g.patchLeft <= 0) {
                const sec = () => Math.max(5, Math.round(2 * Math.sqrt(g.p[i]) / K_LEAK / 5) * 5);
                g = { ...g, said: { ...g.said, cut: true } };
                say('A.U.R.A.', live(() => `${cap(THE[R[i].key])} ${IS(i)} cut off, Commander. It reaches zero in about ${words(sec())} seconds.`), 2, 'cut');
            }
            if (!g.said.spread && g.p.filter((v, j) => j !== i && v < 0.93).length >= 2) {
                g = { ...g, said: { ...g.said, spread: true } };
                say('A.U.R.A.', live(() => (isCut() ? '' : 'The other decks are losing air through the open hatches, Commander.')), 1, 'spread');
            }
        }

        // ── people: walk to the ladder, climb, cycle a shut hatch (Jaxon) or be shut in (anyone else) ──
        function route(f, tx, b) {
            const a = figRoom(f), onLadder = Math.abs(f.x - shaftX) < 0.5, path = [];
            if (a === b && onLadder && Math.abs(f.y - floorY(b)) > 0.5) path.push({ x: shaftX, y: floorY(b) });
            if (a !== b && !onLadder) path.push({ x: shaftX, y: f.y });
            for (let i = a, dir = Math.sign(b - a); i !== b; i += dir) {
                const h = dir > 0 ? i : i - 1;
                path.push({ x: shaftX, y: dir > 0 ? deckY(h) - 2 : deckY(h) + 10, hatch: h });   // wait here if it is shut
            }
            if (a !== b) path.push({ x: shaftX, y: floorY(b) });
            return path.concat({ x: floorX(b, tx), y: floorY(b) });
        }
        function stepFigure(f, dt, ev) {
            if (f.hurt || !f.path.length) return f.moving ? { ...f, moving: false } : f;
            if (f.wait > 0) return { ...f, wait: f.wait - dt, moving: false };
            const wp = f.path[0], dx = wp.x - f.x, dy = wp.y - f.y, d = Math.hypot(dx, dy), step = (dx === 0 ? CLIMB : WALK) * dt;
            if (d > step) return { ...f, x: f.x + (dx / d) * step, y: f.y + (dy / d) * step, stepT: f.stepT + dt, moving: true };
            const rest = f.path.slice(1);
            if (wp.hatch != null) ev.push({ id: f.id, hatch: wp.hatch });
            else if (!rest.length) ev.push({ id: f.id, arrived: true });
            return { ...f, x: wp.x, y: wp.y, path: rest, moving: rest.length > 0 };
        }
        function trap(f) {
            setCrew(f.id, { state: 'trapped', masked: true, wait: 0, path: route(f, shaftX - 8, figRoom(f)) });
            if (f.shut) say(f.name, f.shut, 3);
        }
        function notice(f) {
            setCrew(f.id, { state: 'warned', lying: false, y: f.lying ? floorY(figRoom(f)) : f.y });
            say(f.name, f.warn[0], 3);
            say(f.name, f.warn[1], 3, '', f.id === 'jaxon' ? null : () => leave(f.id));   // they offer to stay, then start out
        }
        function leave(id) {
            const f = crewById(id), i = figRoom(f), up = i > 0 && !g.shut[i - 1], down = i < 5 && !g.shut[i], to = up ? i - 1 : i + 1;
            if (f.state !== 'warned' || g.phase !== 'leak') return;
            if (!up && !down) return trap(f);
            setCrew(id, { state: 'leaving', wait: 2.5, masked: true, path: route(f, shaftX + (to < i ? 8 : -8), to) });
        }
        function stepCrew(dt) {
            const ev = [];
            crew = crew.map(f => stepFigure(f, dt, ev));
            ev.forEach(e => {
                const f = crewById(e.id);
                if (e.hatch == null) {
                    if (f.id === 'jaxon') jaxonArrived();
                    else if (f.state === 'leaving') { setCrew(f.id, { state: 'out' }); say(f.name, f.out, 3); }
                    return;
                }
                if (!g.shut[e.hatch]) return;
                if (f.id !== 'jaxon') return trap(f);
                setCrew('jaxon', { wait: CYCLE, cyc: e.hatch });
                g = { ...g, cycling: g.cycling.map((c, j) => (j === e.hatch ? CYCLE : c)) };
            });
        }

        function sendJaxon(pt) {
            const j = crewById('jaxon'), i = inside(pt.x, pt.y);
            if (g.phase !== 'leak' || g.patchLeft > 0 || j.hurt || i < 0) return;
            setCrew('jaxon', { path: route(j, pt.x + (pt.x < shaftX ? 5 : -5), i) });   // he stands beside the spot, not over it
            if (g.sent < 2) say('Jaxon', g.sent ? 'Got it.' : 'On my way.', 3, 'jaxon');
            g = { ...g, target: { x: Math.round(pt.x), y: Math.round(pt.y), room: i }, miss: 0, sent: g.sent + 1 };
        }
        function jaxonArrived() {
            const t = g.target;
            if (!t || g.phase !== 'leak' || g.patchLeft > 0) return;
            if (t.room === g.leak && Math.hypot(t.x - g.hole.x, t.y - g.hole.y) <= HIT_R) {
                g = { ...g, patchLeft: PATCH };
                say('Jaxon', 'Found it. Patching now.', 3, 'jaxon');
                return showButtons();
            }
            say('Jaxon', g.missed ? 'Not here either. Follow the dust.' : "Nothing here. Where's the dust going?", 3, 'jaxon');
            g = { ...g, miss: 1.6, missed: true };
        }
        function toggleHatch(h) {
            if (!g || g.phase !== 'leak') return;
            g = { ...g, shut: g.shut.map((s, j) => (j === h ? !s : s)) };
            showButtons();
        }

        // ── endings ──
        function finale() {
            say('', 'It was a speck of rock. Sector one is full of them.');
            talk = talk.concat({ fn: () => { g = { ...g, ended: true }; showButtons(); }, pri: 0 });
            showButtons();
        }
        function sealed() {
            g = { ...g, patchLeft: 0, patched: true, phase: 'won', target: null };
            talk = [];
            const lost = R.map((r, i) => i).filter(i => g.low[i] < 0.9), names = lost.map(i => THE[R[i].key]);
            const decks = lost.length === 1 ? `Only ${names[0]} lost air.` : lost.length === R.length ? 'Every deck lost air.'
                : lost.length > 3 ? `${cap(words(lost.length))} decks lost air.` : cap(listing(names)) + ' lost air.';
            const n = Math.round((g.vented / R.length) * 100), trapped = crew.find(f => f.state === 'trapped');
            say('Jaxon', "Sealed. That'll hold until I can weld it.");
            say('A.U.R.A.', 'Breach sealed, Commander. ' + decks);
            say('A.U.R.A.', `The ship lost ${n < 1 ? 'less than one' : words(n)} percent of its air.`);
            if (trapped) say(trapped.name, "I'm fine. The mask held.");
            say('A.U.R.A.', 'All four crew are safe, Commander.');
            finale();
        }
        function lose() {
            const key = R[g.leak].key, hurt = crew.filter(f => f.id !== 'you' && figRoom(f) === g.leak);
            g = { ...g, phase: 'lost', damaged: { [key]: true }, target: null, patchLeft: 0, out: 0, flow: [0, 0, 0, 0, 0] };
            crew = crew.map(f => (hurt.some(h => h.id === f.id) ? { ...f, hurt: true, lying: false, moving: false, path: [], y: floorY(g.leak) } : f));
            talk = [];
            say('A.U.R.A.', `${cap(THE[key])} ${IS(g.leak)} at zero, Commander.`);
            if (hurt.length) say(...hurt[0].hurtLine);
            else say('Jaxon', 'We lost that deck. I can patch it from outside later.');
            say('A.U.R.A.', hurt.length ? `All four crew are alive, Commander. ${hurt.length > 1 ? 'Two are' : 'One is'} injured.` : 'All four crew are safe, Commander.');
            finale();
        }

        // ── dust rides the air: pulled to the hole and to any hatch the air leaves by, pushed out of hatches it enters by ──
        function sinksFor(i) {
            const list = i === g.leak && g.phase === 'leak' ? [{ x: g.hole.x, y: g.hole.y, s: (PULL * g.out) / K_LEAK }] : [];
            [i - 1, i].filter(h => h >= 0 && h < 5).forEach(h => {
                const q = g.flow[h] * (h === i ? 1 : -1);                       // > 0: air leaves room i through hatch h
                if (Math.abs(q) > 1e-4) list.push({ x: shaftX, y: h === i ? R[i].bottom - 3 : R[i].top + 2, s: (PULL * q) / K_LEAK, to: h === i ? i + 1 : i - 1 });
            });
            return list;
        }
        function stepDust(dt) {
            const sinks = R.map((r, i) => sinksFor(i));
            const moved = dust.map(d => {
                let vx = Math.cos(d.a) * WANDER, vy = Math.sin(d.a) * WANDER * 0.6, jump = null;
                sinks[d.room].forEach(k => {
                    const dx = k.x - d.x, dy = k.y - d.y, dist = Math.hypot(dx, dy) || 1;
                    const m = k.s > 0 ? k.s * (0.35 + 14 / (dist + 4)) : dist < 24 ? (k.s * 10) / (dist + 4) : 0;
                    vx += (dx / dist) * m; vy += (dy / dist) * m;
                    if (k.s > 0 && dist < 2.5) jump = k;
                });
                if (jump && jump.to == null) return null;                          // out through the hole
                if (jump) return { ...d, room: jump.to, x: shaftX + (Math.random() - 0.5) * 4, y: jump.to > d.room ? R[jump.to].top + 3 : R[jump.to].bottom - 4, vx, vy };
                const r = R[d.room], y = Lab.clamp(d.y + vy * dt, r.top + 2, r.bottom - 3), hw = Math.max(1, L.halfWidth(y) - 3);
                return { ...d, x: Lab.clamp(d.x + vx * dt, L.cx - hw, L.cx + hw), y, vx, vy, a: d.a + (Math.random() - 0.5) * 2.4 * dt };
            });
            const kept = moved.filter(Boolean), counts = R.map((r, i) => kept.filter(d => d.room === i).length);
            dust = kept.concat(moved.filter(d => !d).map(() => {                     // what went out returns as dust elsewhere
                const i = counts.indexOf(Math.min(...counts));
                counts[i] += 1;
                return speck(i);
            }));
        }

        // ── drawing ──
        function drawShaft(t) {
            for (let y = R[1].top - 2; y <= floorY(5); y++) {
                Lab.dot(ctx, shaftX - 2, y, C.line2); Lab.dot(ctx, shaftX + 2, y, C.line2);
                if (y % 3 === 0) Lab.line(ctx, shaftX - 1, y, shaftX + 1, y, C.greenD);
            }
            g.shut.forEach((isShut, h) => {
                const y = deckY(h), cyc = g.cycling[h] > 0, hot = hoverHatch === h && g.phase === 'leak';
                if (!isShut || cyc) {
                    ctx.fillStyle = C.void; ctx.fillRect(shaftX - 1, y - 2, 3, 3);
                    Lab.line(ctx, shaftX + 4, y - 7, shaftX + 4, y - 3, C.boneD, 0.7);   // the lid, swung up
                    if (cyc && Math.floor(t / 150) % 2) Lab.dot(ctx, shaftX + 6, y - 1, C.amber);
                } else {
                    [C.boneD, C.bone, C.boneD].forEach((col, k) => Lab.line(ctx, shaftX - 3, y - 2 + k, shaftX + 3, y - 2 + k, col));
                    Lab.dot(ctx, shaftX + 5, y - 1, C.red);
                }
                if (hot) [[-5, -5], [5, -5], [-5, 2], [5, 2]].forEach(([ox, oy]) => Lab.dot(ctx, shaftX + ox, y + oy, C.greenBr));
                Lab.text(ctx, String(h + 1), shaftX + 7, y + 2, hot ? C.greenBr : C.boneD);
            });
        }
        function drawDust() {
            dust.forEach(d => {
                const sp = Math.hypot(d.vx, d.vy), x = Math.round(d.x), y = Math.round(d.y);
                if (sp > 4) Lab.line(ctx, x - d.vx * 0.22, y - d.vy * 0.22, x, y, C.boneD, 0.75);
                Lab.dot(ctx, x, y, sp > 9 ? C.white : d.b > 0.35 ? C.bone : C.boneD);
                if (d.b > 0.92) Lab.dot(ctx, x + 1, y, C.boneD);                    // a loose flake
            });
        }
        function drawHoleAndCrew(t) {
            const { x, y } = g.hole, j = crewById('jaxon');
            if (g.patched) { Lab.shade(ctx, x - 1, y - 1, 3, 3, 0.7, C.bone); Lab.dot(ctx, x, y, C.amber); }
            if (g.patchLeft > 0) {
                Lab.line(ctx, Math.round(j.x) + 2, Math.round(j.y) - 6, x, y, C.amber, 0.5);
                for (let k = 0; k < 3; k++) Lab.dot(ctx, x + Math.round((Math.random() - 0.5) * 5), y + Math.round((Math.random() - 0.5) * 5), k ? C.amber : C.gold);
            }
            crew.forEach(f => {
                const fx = Math.round(f.x), fy = Math.round(f.y);
                if (f.hurt) { S.figure(ctx, fx, fy, f.color, false, true); if (Math.floor(t / 400) % 2) Lab.dot(ctx, fx, fy - 5, C.red); return; }
                S.figure(ctx, fx, fy, f.color, f.moving && Math.floor(f.stepT * 6) % 2 === 1, !!f.lying);
                if (f.masked && !f.lying) Lab.line(ctx, fx - 1, fy - 8, fx + 1, fy - 8, C.boneD);
            });
        }
        function drawMarks() {
            if (g.target) {
                const { x, y } = g.target, col = g.miss > 0 ? C.red : C.amber;
                [-2, -1, 1, 2].forEach(o => { Lab.dot(ctx, x + o, y + o, col); Lab.dot(ctx, x + o, y - o, col); });
            }
            if (!aimShown || g.phase !== 'leak' || hoverHatch >= 0) return;
            const ax = Math.round(aim.x), ay = Math.round(aim.y), col = inside(ax, ay) >= 0 ? C.gold : C.boneD;
            [[-5, 0, -3, 0], [3, 0, 5, 0], [0, -5, 0, -3], [0, 3, 0, 5]].forEach(([a, b, c, d]) => Lab.line(ctx, ax + a, ay + b, ax + c, ay + d, col));
        }
        function jaxonStatus() {
            const j = crewById('jaxon');
            return j.hurt ? 'HURT' : g.patched ? 'DONE' : g.patchLeft > 0 ? 'PATCHING' : j.wait > 0 && j.cyc != null ? 'CYCLING HATCH ' + (j.cyc + 1)
                : j.moving ? (Math.abs(j.x - shaftX) < 0.5 ? 'CLIMBING' : 'WALKING') : g.miss > 0 ? 'NOTHING HERE' : g.sent ? 'WAITING' : 'STANDING BY';
        }
        function drawReadout(t) {
            const over = g.phase === 'won' || g.phase === 'lost';
            const status = g.phase === 'won' ? ['SEALED', C.green] : g.phase === 'lost' ? ['DECK LOST', C.red] : g.phase === 'leak' && Math.floor(t / 500) % 2 ? ['PRESSURE LOSS', C.red] : null;
            Lab.text(ctx, 'AIR', RX, 3, C.boneD);
            if (status) Lab.text(ctx, status[0], W - 6 - Lab.textWidth(status[0]), 3, status[1]);
            R.forEach((r, i) => {
                const my = i === 0 ? r.bottom - 12 : Math.round((r.top + r.bottom) / 2) - 1, edge = Math.round(L.cx + L.halfWidth(my)) + 2;
                const v = g.p[i], len = Math.round(v * BW), col = v > 0.6 ? C.green : v > 0.3 ? C.amber : C.red, n = String(Math.round(v * 100));
                for (let x = edge; x < RX - 2; x += 2) Lab.dot(ctx, x, my + 1, C.line2);   // leader from the deck to its bar
                Lab.shade(ctx, RX, my, BW, 3, 0.15, C.line2);
                if (len > 0) { Lab.shade(ctx, RX, my + 1, len, 2, 0.5, col); Lab.line(ctx, RX, my, RX + len - 1, my, col); }
                if (g.low[i] < 0.99) Lab.line(ctx, RX + Math.round(g.low[i] * BW), my - 1, RX + Math.round(g.low[i] * BW), my + 3, C.bone);
                Lab.text(ctx, n, RX + BW + 18 - Lab.textWidth(n), my - 1, col);
                glyph(ctx, RX + BW + 20, my - 1, C.boneD);
                if (over && g.low[i] < 0.99) glyph(ctx, RX + 2 + Lab.text(ctx, 'LOWEST ' + Math.round(g.low[i] * 100), RX, my + 6, C.boneD), my + 6, C.boneD);
            });
            if (g.phase !== 'calm') Lab.text(ctx, jaxonStatus(), RX + 5 + Lab.text(ctx, 'JAXON', RX, H - 8, C.amber), H - 8, C.boneD);
        }
        function render(t) {
            const jolt = () => Math.round((Math.random() - 0.5) * 5 * g.shake);
            ctx.fillStyle = C.void; ctx.fillRect(0, 0, W, H);
            ctx.save();
            ctx.translate(jolt(), jolt());
            Lab.stars(ctx, 9, 50);
            S.draw(ctx, L, t, { damaged: g.damaged, labels: true });
            drawShaft(t);
            drawDust();
            drawHoleAndCrew(t);
            drawMarks();
            ctx.restore();
            drawReadout(t);
            if (g.flash > 0) Lab.shade(ctx, 0, 0, W, H, g.flash * 0.7, C.white);
        }

        function showButtons() {
            held = null;
            if (g.ended) return ui.buttons([{ label: 'Run it again', primary: true, onClick: start }]);
            const isLive = g.phase === 'leak';
            const hatches = g.shut.map((s, h) => ({ label: (s ? 'Open ' : 'Shut ') + (h + 1), primary: s, disabled: !isLive, onClick: () => toggleHatch(h) }));
            const arrows = [['←', -1, 0], ['↑', 0, -1], ['↓', 0, 1], ['→', 1, 0]].map(([label, ax, ay]) => ({
                label, hold: true, quiet: true, disabled: !isLive, onDown: () => { nudge(ax, ay); held = { ax, ay }; }, onUp: () => { held = null; },
            }));
            ui.buttons(hatches.concat(arrows, [{ label: 'Send Jaxon here', disabled: !isLive || g.patchLeft > 0, onClick: () => { aimShown = true; sendJaxon(aim); } }]));
        }

        // ── input ──
        function nudge(ax, ay, step = 3) {                // a tap moves the aim a little; holding keeps it moving
            aim = { x: Lab.clamp(aim.x + ax * step, 8, 186), y: Lab.clamp(aim.y + ay * step, 8, 162) };
            aimShown = true; hoverHatch = -1;
        }
        const keyAxis = (plus, minus) => (plus.some(k => Lab.keys.has(k)) ? 1 : 0) - (minus.some(k => Lab.keys.has(k)) ? 1 : 0);
        const cv = ui.canvas;
        cv.onpointermove = e => {
            aim = ui.toPixel(e); aimShown = true;
            hoverHatch = g.phase === 'leak' ? hatchAt(aim) : -1;
            cv.style.cursor = hoverHatch >= 0 ? 'pointer' : '';
        };
        cv.onclick = e => {
            const p = ui.toPixel(e), h = hatchAt(p);
            if (h >= 0) toggleHatch(h); else sendJaxon(p);
        };
        Lab.onKey((k, e) => {
            const onButton = e && e.target && e.target.tagName === 'BUTTON';    // a focused button handles Space and Enter itself
            if (g.ended) { if (!onButton && (k === ' ' || k === 'Enter' || k === 'r')) start(); return; }
            if (/^[1-5]$/.test(k)) return toggleHatch(Number(k) - 1);
            if (STEP_KEYS[k] && !(e && e.repeat)) return nudge(...STEP_KEYS[k]);
            if ((k === ' ' || k === 'Enter') && !onButton) { aimShown = true; sendJaxon(aim); }
        });

        Lab.loop((dt, now) => {
            g = { ...g, t: g.t + dt, flash: Math.max(0, g.flash - dt * 2.5), shake: Math.max(0, g.shake - dt), miss: Math.max(0, g.miss - dt), cycling: g.cycling.map(c => Math.max(0, c - dt)) };
            if (g.phase === 'calm' && g.t >= INTRO) hit();
            const ax = keyAxis(['ArrowRight', 'd'], ['ArrowLeft', 'a']) + (held ? held.ax : 0), ay = keyAxis(['ArrowDown', 's'], ['ArrowUp', 'w']) + (held ? held.ay : 0);
            if (ax || ay) nudge(ax, ay, AIM_SPEED * dt);
            if (g.phase === 'leak' || g.phase === 'won') stepAir(dt);
            if (g.phase === 'leak') {
                crew.filter(f => f.notice && f.state === 'idle' && !(f.id === 'jaxon' && g.sent) && figRoom(f) === g.leak && g.p[g.leak] < f.notice).forEach(f => notice(f));
                reports();
                if (g.patchLeft > 0) { g = { ...g, patchLeft: g.patchLeft - dt }; if (g.patchLeft <= 0) sealed(); }
                if (g.phase === 'leak' && g.p[g.leak] <= 0.004) lose();
            }
            stepCrew(dt);
            stepDust(dt);
            pumpTalk(dt);
            render(now);
        }, 30);

        start();
        render(performance.now());
        return () => { cv.style.cursor = ''; talk = []; held = null; };
    }

    Lab.register({
        id: 'breach', badge: 'new',
        name: 'Seal the breach',
        short: 'Find a hole by the dust',
        verb: 'Watch loose dust drift toward a hole nobody can see, shut ladder hatches to stop the air spreading, and mark the spot for Jaxon to patch.',
        serves: "The ship as a place, the crew's safety, and sector one's hazard: rock too small to see.",
        replaces: 'The one-line log entry "WARNING: Micrometeorite impact detected! [deck] sustained damage." in sector one.',
        controls: 'Click a hatch to shut or open it (1–5) · click the hole to send Jaxon · arrows aim, Space sends',
        mount,
    });
})();
