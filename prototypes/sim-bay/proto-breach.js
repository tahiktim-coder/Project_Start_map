/* proto-breach.js — Seal the breach.
   A speck of rock holes EXODUS-9. A.U.R.A. can tell which deck is losing air but not where the hole is. Loose dust rides
   the air toward the hole: mark the spot and Jaxon climbs there to patch it. Shutting the ladder hatches around the deck
   saves the rest of the ship's air, but shuts in anyone still inside; leaving them open lets them climb out while every
   deck bleeds. Air: the hole vents K·√p a second, so a cut-off deck empties from full in 2/K s; an open hatch passes G·Δp. */

(function () {
    'use strict';
    const Lab = window.Lab;
    if (!Lab || !Lab.ship) return;
    const C = Lab.C, W = Lab.W, H = Lab.H, S = Lab.ship, clamp = Lab.clamp;

    const K_LEAK = 0.045, G_HATCH = 0.2, REFILL = 0.04, AUTO = 0.85; // cut off, a full deck empties in 44 s; A.U.R.A. shuts the hatches herself at 85% ship air, then 75%...
    const WALK = 16, CLIMB = 11, CYCLE = 1.6, PATCH = 4;             // px/s (a deck is 25 px, about 2.5 m); seconds
    const GONE = 0.004, HIT_R = 7, INTRO = 2.5, HEAD_START = 7.5, AIM_SPEED = 55;  // a mark this close finds the hole; the crew start for the ladder this long after the hit
    const DUST = 15, WANDER = 1.2, PULL = 14;                         // specks a deck; the holed deck has more
    const RX = 192, BW = 80;                                          // the air readout column
    const ORDER = ['cargo', 'lab', 'upgrades', 'engineering', 'quarters'];   // the first run always has someone in the deck
    const THE = { bridge: 'the bridge', lab: 'the laboratory', quarters: 'the crew quarters', cargo: 'the cargo hold', engineering: 'engineering', upgrades: 'fabrication' };
    const STEP_KEYS = { ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0], ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1] };
    const PCT = '101001010100101';
    const ONES = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split(' ');
    const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
    const words = n => (n >= 100 ? 'one hundred' : n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : ''));
    const cap = s => s[0].toUpperCase() + s.slice(1);

    const PEOPLE = [
        { id: 'you', home: 'bridge', slot: 0.45 }, { id: 'mira', home: 'lab', slot: 0.3 }, { id: 'aris', home: 'lab', slot: 0.12 },
        { id: 'vance', home: 'cargo', slot: 0.35 }, { id: 'jaxon', home: 'engineering', slot: 0.22 },
    ];
    const DECK = {                                       // who speaks when the hole is in their deck, and what they say
        lab: { who: 'Mira', warn: "Aris and I have masks. We're coming up the ladder.", out: "We're out. Both of us." },
        cargo: { who: 'Vance', warn: "I've got a mask. I'm coming up the ladder.", out: "I'm out." },
        engineering: { who: 'Jaxon', warn: "It's in here with me. Shut me in, I've got a mask." },
    };
    const SHUT_IN = "The hatch is shut. I'll wait. Be quick.", HELD = "The mask held. I'm fine.";
    const HURT = {                                       // who speaks when a deck is lost with people inside
        'aris,mira': ['Vance', "Aris and Mira are both down. I'm going to them."], aris: ['Mira', "Aris is down. She's breathing, but she's hurt."],
        mira: ['Aris', "Mira's hurt. She was in there with no air."], vance: ['Aris', 'Vance is hurt. Bring him up to the lab.'], jaxon: ['Vance', "Jaxon's hurt. I'm going to him."],
    };

    function mount(ctx, ui) {
        const L = S.layout(14, 6, 168, 166), R = L.rooms, shaftX = Math.round(L.cx + L.maxHalf * 0.26);
        const deckY = h => R[h + 1].top;                                   // hatch h joins decks h and h+1
        const floorY = i => R[i].bottom - 2;
        const roomOfY = y => R.findIndex(r => y >= r.top && y < r.bottom);
        const inside = (x, y) => { const i = roomOfY(y); return i >= 0 && Math.abs(x - L.cx) <= L.halfWidth(y) - 2 ? i : -1; };
        const floorX = (i, x) => { const hw = L.halfWidth(floorY(i) - 1) - 5; return clamp(Math.round(x), Math.ceil(L.cx - hw), Math.floor(L.cx + hw)); };
        const figRoom = f => roomOfY(Math.round(f.y) - 4);
        const IS = i => (R[i].key === 'quarters' ? 'are' : 'is');
        const hatchAt = p => [0, 1, 2, 3, 4].find(h => Math.abs(p.x - shaftX) <= 5 && p.y >= deckY(h) - 5 && p.y <= deckY(h) + 3) ?? -1;
        const around = i => [i - 1, i].filter(h => h >= 0 && h < 5);       // the hatches that close off deck i
        const hatchWords = i => { const n = around(i).map(h => words(h + 1)); return n.length > 1 ? `hatches ${n[0]} and ${n[1]}` : `hatch ${n[0]}`; };
        const exitX = f => shaftX - (f.id === 'aris' ? 15 : 8);

        let g = null, crew = [], dust = [], talk = [], talkWait = 0, run = Math.floor(Math.random() * 2);
        let aim = { x: L.cx, y: R[2].top + 12 }, aimShown = false, byMouse = false, hoverHatch = -1, lastToggle = { h: -1, t: 0 };
        const crewById = id => crew.find(f => f.id === id);
        const setCrew = (id, patch) => { crew = crew.map(f => (f.id === id ? { ...f, ...patch } : f)); };
        const isCut = () => around(g.leak).every(h => g.shut[h]);
        const shipAir = () => g.p.reduce((a, b) => a + b, 0) / R.length;
        const flag = k => { const was = g.said[k]; g = { ...g, said: { ...g.said, [k]: true } }; return !was; };   // true the first time only

        // ── one line at a time. A reaction jumps the queue and cuts the current line short; a line may be a function, read
        //    when it is shown (so numbers match the bars) and skipped if it returns '' ──
        function say(who, line, urgent = false, tag = '') {
            const kept = tag ? talk.filter(q => q.tag !== tag) : talk, at = urgent ? kept.findIndex(q => !q.urgent) : -1;
            const item = { who, line, urgent, tag };
            talk = at < 0 ? kept.concat(item) : kept.slice(0, at).concat(item, kept.slice(at));
            if (urgent) talkWait = Math.min(talkWait, 0.7);
        }
        function pumpTalk(dt) {
            talkWait -= dt;
            while (talkWait <= 0 && talk.length) {
                const [q, ...rest] = talk;
                talk = rest;
                if (q.fn) { q.fn(); continue; }
                const text = typeof q.line === 'function' ? q.line() : q.line;
                if (!text) continue;
                ui.say(q.who, text);
                talkWait = clamp(0.8 + text.split(' ').length * 0.17, 1.8, 3.2);
            }
        }
        const live = fn => () => (g.phase === 'leak' && g.patchLeft <= 0 ? fn() : '');

        function speck(i, rnd = Math.random) {
            const r = R[i], y = r.top + 3 + rnd() * (r.bottom - r.top - 6), hw = Math.max(2, L.halfWidth(y) - 4);
            return { x: L.cx - hw + rnd() * hw * 2, y, room: i, a: rnd() * 6.283, vx: 0, vy: 0 };
        }
        function placeHole(i, rnd) {                       // low on the back wall, clear of the ladder, the deck's name and anyone in it
            const y = floorY(i) - 4 - Math.floor(rnd() * 7), hw = L.halfWidth(y) - 10;
            const crowded = x => Math.abs(x - shaftX) < 28 || (R[i].key === 'engineering' && Math.abs(x - L.cx) < 14)   // not behind the reactor
                || PEOPLE.some(p => p.home === R[i].key && Math.abs(L.floor(p.home, p.slot).x - x) < 10);
            let x = shaftX;
            while (crowded(x)) x = Math.round(L.cx - hw + rnd() * hw * 2);
            return { x, y };
        }

        function start() {
            const rnd = Lab.rng((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);
            const key = ORDER[run++ % ORDER.length], leak = R.findIndex(r => r.key === key);
            talk = []; talkWait = 0; lastToggle = { h: -1, t: 0 };
            g = { phase: 'calm', t: 0, leak, hole: placeHole(leak, rnd), p: R.map(() => 1), low: R.map(() => 1), flow: [0, 0, 0, 0, 0], out: 0, vented: 0,
                shut: [false, false, false, false, false], cycling: [0, 0, 0, 0, 0], target: null, miss: 0, misses: 0, sent: 0,
                patchLeft: 0, patched: false, flash: 0, shake: 0, said: {}, damaged: {}, ended: false, autoAt: AUTO };
            crew = PEOPLE.map(p => ({ ...p, ...L.floor(p.home, p.slot), name: S.CREW[p.id].name, color: S.CREW[p.id].color,
                path: [], wait: 0, state: 'idle', stepT: 0, moving: false, hurt: false }));
            dust = R.flatMap((r, i) => Array.from({ length: i === leak ? DUST * 2.5 : DUST }, () => speck(i, rnd)));
            ui.clear();
            ui.say('', 'Sector one. A quiet shift.');
            showButtons();
        }
        function hit() {
            const key = R[g.leak].key, deck = DECK[key];
            g = { ...g, phase: 'leak', flash: 1, shake: 0.7 };
            ui.say('A.U.R.A.', `Pressure loss in ${THE[key]}, Commander. I cannot see the hole.`);
            talkWait = 2.8;
            say('Jaxon', live(() => (g.sent ? '' : "Watch the dust. Show me where it goes and I'll patch it.")));
            say('A.U.R.A.', live(() => (isCut() ? '' : `Shut ${hatchWords(g.leak)} now, Commander.`)));
            if (deck) say(deck.who, live(() => (isCut() ? '' : deck.warn)));
            crew = crew.map(f => (f.id === 'you' || f.id === 'jaxon' || figRoom(f) !== g.leak ? f
                : { ...f, state: 'leaving', wait: HEAD_START + (f.id === 'aris' ? 0.5 : 0), path: route(f, exitX(f), g.leak - 1) }));
            if (!byMouse) aim = { x: L.cx - 30, y: Math.round((R[g.leak].top + R[g.leak].bottom) / 2) };   // keys aim from the right deck
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
            const i = g.leak, deck = cap(THE[R[i].key]) + ' ' + IS(i), left = () => (2 * (Math.sqrt(g.p[i]) - Math.sqrt(GONE))) / K_LEAK;   // seconds to zero, cut off
            const secs = () => words(Math.max(5, Math.round(left() / 5) * 5)), trapped = crew.find(f => f.state === 'trapped');
            if (!isCut() && shipAir() < g.autoAt) {                         // nobody chose, so A.U.R.A. does, whoever is inside
                g = { ...g, autoAt: g.autoAt - 0.1, shut: g.shut.map((s, h) => s || around(i).includes(h)) };
                say('A.U.R.A.', `Ship air at ${words(Math.round(shipAir() * 100))} percent. Closing ${hatchWords(i)}, Commander.`, true);
                showButtons();
            }
            if (isCut() && g.patchLeft <= 0 && flag('cut')) say('A.U.R.A.', live(() => (isCut() ? `${deck} cut off, Commander. It reaches zero in about ${secs()} seconds.` : '')), true, 'cut');
            if (!g.sent && g.t > INTRO + 18 && flag('nudge')) say('Jaxon', live(() => (g.sent ? '' : "I'm ready. Give me a spot and I'll go.")));
            if (isCut() && left() < 15 && g.patchLeft <= 0 && flag('low')) say('A.U.R.A.', live(() => `About ${secs()} seconds of air left in ${THE[R[i].key]}, Commander.`), true);
            if (trapped && isCut() && left() < 7 && g.patchLeft <= 0 && flag('ears')) say(trapped.name, 'My ears hurt. Please hurry.', true);
        }

        // ── people: walk to the ladder, climb, cycle a shut hatch (Jaxon) or be stopped by it (anyone else) ──
        function route(f, tx, b) {
            const a = figRoom(f), onLadder = Math.abs(f.x - shaftX) < 0.5, path = [];
            if (a === b && onLadder && Math.abs(f.y - floorY(b)) > 0.5) path.push({ x: shaftX, y: floorY(b) });
            if (a !== b && !onLadder) path.push({ x: shaftX, y: f.y });
            for (let i = a, dir = Math.sign(b - a); i !== b; i += dir) {
                const h = dir > 0 ? i : i - 1;
                path.push({ x: shaftX, y: dir > 0 ? deckY(h) - 2 : deckY(h) + 10, hatch: h });   // stop here if it is shut
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
        function stepCrew(dt) {
            const ev = [], deck = DECK[R[g.leak].key];
            crew = crew.map(f => stepFigure(f, dt, ev));
            ev.forEach(e => {
                const f = crewById(e.id);
                if (e.arrived && f.id === 'jaxon') return jaxonArrived();
                if (e.arrived) {
                    if (f.state === 'leaving') setCrew(f.id, { state: 'out' });
                    if (crew.every(c => c.state !== 'leaving' && c.state !== 'trapped') && flag('out')) say(deck.who, deck.out, true);
                    return;
                }
                if (!g.shut[e.hatch] || g.phase !== 'leak') return;
                if (f.id === 'jaxon') {                                          // he goes through, closing it behind him
                    setCrew('jaxon', { wait: CYCLE, cyc: e.hatch });
                    g = { ...g, cycling: g.cycling.map((c, j) => (j === e.hatch ? CYCLE : c)) };
                    return;
                }
                setCrew(f.id, { state: 'trapped', path: route(f, exitX(f) + 1, g.leak) });   // back down to wait by the ladder
                if (flag('shut')) say(f.name, SHUT_IN, true);
            });
        }

        function sendJaxon(pt) {
            const j = crewById('jaxon'), i = inside(pt.x, pt.y), t = g.target;
            if (g.phase !== 'leak' || g.patchLeft > 0 || j.hurt || i < 0) return;
            if (t && Math.hypot(t.x - pt.x, t.y - pt.y) < 3) return;                      // the same spot again
            setCrew('jaxon', { path: route(j, pt.x + (pt.x < shaftX ? 5 : -5), i) });    // he stands beside the spot, not on it
            if (g.sent < 2) say('Jaxon', g.sent ? 'Got it.' : 'On my way.', true, 'jaxon');
            g = { ...g, target: { x: Math.round(pt.x), y: Math.round(pt.y), room: i }, miss: 0, sent: g.sent + 1 };
        }
        function jaxonArrived() {
            const t = g.target;
            if (!t || g.phase !== 'leak' || g.patchLeft > 0) return;
            if (t.room === g.leak && Math.hypot(t.x - g.hole.x, t.y - g.hole.y) <= HIT_R) {
                g = { ...g, patchLeft: PATCH };
                say('Jaxon', 'Found it. Patching now.', true, 'jaxon');
                return showButtons();
            }
            const line = ["Nothing here. Where's the dust going?", 'Not here either. Follow the dust.'][g.misses];
            if (line) say('Jaxon', line, true, 'jaxon');
            g = { ...g, miss: 1.6, misses: g.misses + 1 };
        }
        function toggleHatch(h) {
            if (!g || g.phase !== 'leak' || g.patchLeft > 0) return;
            if (lastToggle.h === h && g.t - lastToggle.t < 0.25) return;                // a double click is one click
            lastToggle = { h, t: g.t };
            g = { ...g, shut: g.shut.map((s, j) => (j === h ? !s : s)) };
            if (!g.shut[h]) crew.filter(f => f.state === 'trapped').forEach(f => setCrew(f.id, { state: 'leaving', wait: 0.6, path: route(f, exitX(f), g.leak - 1) }));
            showButtons();
        }

        // ── endings ──
        function finale() {
            say('', 'It was a speck of rock. Sector one is full of them.');
            talk = talk.concat({ fn: () => { g = { ...g, ended: true }; showButtons(); } });
            showButtons();
        }
        function sealed() {
            const shutIn = crew.find(f => f.state === 'trapped');
            const n = Math.round((g.vented / R.length) * 100), spread = g.low.filter((v, i) => i !== g.leak && v < 0.97).length;
            const where = !spread ? 'all of it from ' + THE[R[g.leak].key] : spread > 3 ? 'from every deck' : `from ${words(spread + 1)} decks`;
            g = { ...g, patchLeft: 0, patched: true, phase: 'won', target: null };
            talk = [];
            say('Jaxon', "Sealed. That'll hold until I can weld it.");
            say('A.U.R.A.', `The ship lost ${n < 1 ? 'less than one' : words(n)} percent of its air, ${where}.`);
            if (shutIn) say(shutIn.name, HELD);
            say('A.U.R.A.', 'All four crew are safe, Commander.');
            finale();
        }
        function lose() {
            const key = R[g.leak].key, hurt = crew.filter(f => f.id !== 'you' && figRoom(f) === g.leak), ids = hurt.map(f => f.id);
            g = { ...g, phase: 'lost', damaged: { [key]: true }, target: null, patchLeft: 0, out: 0, flow: [0, 0, 0, 0, 0] };
            crew = crew.map(f => (ids.includes(f.id) ? { ...f, hurt: true, moving: false, path: [], y: floorY(g.leak) } : f));
            talk = [];
            say('A.U.R.A.', `${cap(THE[key])} ${IS(g.leak)} at zero, Commander.`);
            const line = HURT[ids.slice().sort().join(',')];
            if (line) say(...line);
            else if (!ids.length) say('Jaxon', 'We lost that deck. I can patch it from outside later.');
            say('A.U.R.A.', ids.length ? `All four crew are alive, Commander. ${cap(words(ids.length))} ${ids.length > 1 ? 'are' : 'is'} injured.` : 'All four crew are safe, Commander.');
            finale();
        }

        // ── dust rides the air: to the hole, and to any open hatch the air leaves a deck by ──
        function sinks(i) {
            const list = i === g.leak && g.phase === 'leak' ? [{ x: g.hole.x, y: g.hole.y, s: g.out / K_LEAK }] : [];
            around(i).forEach(h => {
                const q = g.flow[h] * (h === i ? 1 : -1);                       // > 0: air leaves deck i through hatch h
                if (q > 1e-4) list.push({ x: shaftX, y: h === i ? R[i].bottom - 3 : R[i].top + 2, s: (0.5 * q) / K_LEAK, to: h === i ? i + 1 : i - 1 });
            });
            return list;
        }
        function stepDust(dt) {
            const sk = R.map((r, i) => sinks(i)), counts = R.map(() => 0);
            const moved = dust.map(d => {
                let vx = Math.cos(d.a) * WANDER, vy = Math.sin(d.a) * WANDER * 0.6, into = null;
                sk[d.room].forEach(k => {
                    const dx = k.x - d.x, dy = k.y - d.y, dist = Math.hypot(dx, dy) || 1, m = PULL * k.s * (0.6 + 24 / (dist + 8));
                    vx += (dx / dist) * m; vy += (dy / dist) * m;
                    if (dist < 3) into = k;
                });
                if (into && into.to == null) {                                      // it jitters at the hole a moment, then is gone
                    if (Math.random() < dt * 1.6) return null;
                    counts[d.room] += 1;
                    return { ...d, x: into.x + Math.round((Math.random() - 0.5) * 4), y: into.y + Math.round((Math.random() - 0.5) * 4), vx, vy };
                }
                const room = into ? into.to : d.room, r = R[room];
                const y = clamp(into ? (room > d.room ? r.top + 3 : r.bottom - 4) : d.y + vy * dt, r.top + 2, r.bottom - 3), hw = Math.max(1, L.halfWidth(y) - 3);
                counts[room] += 1;
                return { ...d, room, x: clamp(into ? shaftX : d.x + vx * dt, L.cx - hw, L.cx + hw), y, vx, vy, a: d.a + (Math.random() - 0.5) * 2.4 * dt };
            });
            dust = moved.map(d => {                                               // what went out is stirred up again elsewhere
                if (d) return d;
                const i = counts.indexOf(Math.min(...counts));
                counts[i] += 1;
                return speck(i);
            });
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
        function drawDust() {                                 // resting dust stays dim; moving dust brightens and trails
            dust.forEach(d => {
                const sp = Math.hypot(d.vx, d.vy), x = Math.round(d.x), y = Math.round(d.y);
                if (sp > 4) Lab.line(ctx, x - (d.vx / sp) * Math.min(6, sp * 0.35), y - (d.vy / sp) * Math.min(6, sp * 0.35), x, y, C.boneD, 0.8);
                Lab.dot(ctx, x, y, sp > 14 ? C.white : sp > 4 ? C.bone : C.boneD);
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
                S.figure(ctx, fx, fy, f.color, f.moving && Math.floor(f.stepT * 6) % 2 === 1);
                if (g.phase === 'leak' && f.id !== 'you' && figRoom(f) === g.leak) Lab.line(ctx, fx - 1, fy - 8, fx + 1, fy - 8, C.boneD);   // mask
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
            const status = g.phase === 'won' ? ['SEALED', C.green] : g.phase === 'lost' ? ['DECK LOST', C.red] : g.phase === 'leak' && Math.floor(t / 500) % 2 ? ['PRESSURE LOSS', C.red] : null;
            ctx.fillStyle = C.void;
            ctx.fillRect(RX - 1, 1, W - RX + 1, 8); ctx.fillRect(RX - 1, H - 10, W - RX + 1, 8);   // keep stars off the words
            Lab.text(ctx, 'AIR', RX, 3, C.boneD);
            if (status) Lab.text(ctx, status[0], W - 6 - Lab.textWidth(status[0]), 3, status[1]);
            R.forEach((r, i) => {
                const my = i === 0 ? r.bottom - 12 : Math.round((r.top + r.bottom) / 2) - 1, edge = Math.round(L.cx + L.halfWidth(my)) + 2;
                const v = g.p[i], len = Math.round(v * BW), col = v > 0.6 ? C.green : v > 0.3 ? C.amber : C.red, n = String(Math.round(v * 100));
                for (let x = edge; x < RX - 2; x += 2) Lab.dot(ctx, x, my + 1, C.line2);   // leader from the deck to its bar
                ctx.fillStyle = C.void; ctx.fillRect(RX - 1, my - 2, BW + 26, 8);
                Lab.shade(ctx, RX, my, BW, 3, 0.15, C.line2);
                if (len > 0) { Lab.shade(ctx, RX, my + 1, len, 2, 0.5, col); Lab.line(ctx, RX, my, RX + len - 1, my, col); }
                if (g.low[i] < 0.99) Lab.line(ctx, RX + Math.round(g.low[i] * BW), my - 1, RX + Math.round(g.low[i] * BW), my + 3, C.bone);   // lowest it fell
                Lab.text(ctx, n, RX + BW + 18 - Lab.textWidth(n), my - 1, col);
                ctx.fillStyle = C.boneD;                                                   // the font has no '%'
                for (let k = 0; k < 15; k++) if (PCT[k] === '1') ctx.fillRect(RX + BW + 20 + (k % 3), my - 1 + Math.floor(k / 3), 1, 1);
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
            if (g.ended) return ui.buttons([{ label: 'Run it again', primary: true, onClick: () => g.ended && start() }]);
            const isLive = g.phase === 'leak' && g.patchLeft <= 0;
            ui.buttons(g.shut.map((s, h) => ({ label: (s ? 'Open hatch ' : 'Shut hatch ') + (h + 1), primary: s, disabled: !isLive, onClick: () => toggleHatch(h) })));
        }

        // ── input ──
        function nudge(ax, ay, step = 3) {                // a tap moves the aim a little; holding keeps it moving
            aim = { x: clamp(aim.x + ax * step, 8, 186), y: clamp(aim.y + ay * step, 8, 172) };
            aimShown = true; byMouse = false; hoverHatch = -1;
        }
        const keyAxis = (plus, minus) => (plus.some(k => Lab.keys.has(k)) ? 1 : 0) - (minus.some(k => Lab.keys.has(k)) ? 1 : 0);
        const cv = ui.canvas;
        cv.onpointermove = e => {
            aim = ui.toPixel(e); aimShown = true; byMouse = true;
            hoverHatch = g.phase === 'leak' ? hatchAt(aim) : -1;
            cv.style.cursor = hoverHatch >= 0 ? 'pointer' : '';
        };
        cv.onpointerleave = () => { if (byMouse) aimShown = false; hoverHatch = -1; };
        cv.onclick = e => {
            const p = ui.toPixel(e), h = hatchAt(p);
            if (h >= 0) toggleHatch(h); else sendJaxon(p);
        };
        Lab.onKey((k, e) => {
            const onButton = e && e.target && e.target.tagName === 'BUTTON';    // a focused button takes Enter itself
            if (g.ended) { if (k === ' ' || k === 'r' || (k === 'Enter' && !onButton)) start(); return; }
            if (STEP_KEYS[k]) { if (!(e && e.repeat)) nudge(...STEP_KEYS[k]); return; }
            if (e && e.repeat) return;
            if (/^[1-5]$/.test(k)) return toggleHatch(Number(k) - 1);
            if (k === ' ' || (k === 'Enter' && !onButton)) { aimShown = true; sendJaxon(aim); }
        });

        Lab.loop((dt, now) => {
            g = { ...g, t: g.t + dt, flash: Math.max(0, g.flash - dt * 2.5), shake: Math.max(0, g.shake - dt), miss: Math.max(0, g.miss - dt), cycling: g.cycling.map(c => Math.max(0, c - dt)) };
            if (g.phase === 'calm' && g.t >= INTRO) hit();
            const ax = keyAxis(['ArrowRight', 'd'], ['ArrowLeft', 'a']), ay = keyAxis(['ArrowDown', 's'], ['ArrowUp', 'w']);
            if (ax || ay) nudge(ax, ay, AIM_SPEED * dt);
            if (g.phase === 'leak' || g.phase === 'won') stepAir(dt);
            if (g.phase === 'leak') {
                reports();
                if (g.patchLeft > 0) { g = { ...g, patchLeft: g.patchLeft - dt }; if (g.patchLeft <= 0) sealed(); }
                if (g.phase === 'leak' && g.p[g.leak] <= GONE) lose();
            }
            stepCrew(dt);
            stepDust(dt);
            pumpTalk(dt);
            render(now);
        }, 30);

        start();
        render(performance.now());
        return () => { cv.style.cursor = ''; cv.onpointerleave = null; talk = []; };
    }

    Lab.register({
        id: 'breach', badge: 'new',
        name: 'Seal the breach',
        short: 'Find a hole by the dust',
        verb: 'Watch loose dust drift toward a hole nobody can see, mark the spot for Jaxon, and decide when to shut the hatches on whoever is still inside.',
        serves: "The ship as a place, the crew's safety, and sector one's hazard: rock too small to see.",
        replaces: 'The one-line log entry "WARNING: Micrometeorite impact detected! [deck] sustained damage." in sector one.',
        controls: 'Click where the dust goes to send Jaxon · click a hatch or press 1–5 to shut it · arrows aim, Space sends',
        mount,
    });
})();
