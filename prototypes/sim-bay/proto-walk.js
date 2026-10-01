/* proto-walk.js — THE WALK OUT (Sim Bay prototype).
   The ending, played instead of read. You drift out of EXODUS-9 on a tether and a small suit tank to the gold disc at the
   edge of the light. Every eight seconds a sweep leaves the light and runs across the screen; each time it crosses the ship
   (the main screen's cutaway, drawn by Lab.ship) one crew member goes still and their radio turns to static. At the disc:
   scrape off the map, take it aboard, or let it go. You pull yourself back in, five people stand in the ship, and A.U.R.A.
   counts four. */
(function () {
    'use strict';
    const Lab = window.Lab;
    if (!Lab || !Lab.ship) return;
    const C = Lab.C, W = Lab.W, H = Lab.H, SHIP = Lab.ship, CREW = SHIP.CREW;
    const clamp01 = v => Lab.clamp(v, 0, 1);
    const name = id => CREW[id].name;

    // ── where things are (a deck is 26 px, about 3 m, so 1 px is about 12 cm) ──
    const L = SHIP.layout(4, 4, 64, 172);
    const HULL_X = Math.round(L.cx + L.maxHalf);
    const DOOR = { x: HULL_X - 1, y: L.room('cargo').bottom - 11, h: 8 };      // the airlock, in the cargo hold's outer wall
    const ANCHOR = { x: HULL_X + 1, y: DOOR.y + 4 }, START = { x: HULL_X + 8, y: DOOR.y + 4 };
    const POSTS = { aris: ['lab', 0.25], mira: ['lab', 0.75], vance: ['cargo', 0.8], jaxon: ['engineering', 0.2], you: ['cargo', 0.5] };
    const SPOT = Object.fromEntries(Object.entries(POSTS).map(([id, [room, slot]]) => [id, L.floor(room, slot)]));
    const RADIO = ['aris', 'mira', 'vance', 'jaxon'];                         // the radio row, in deck order
    const ORDER = ['aris', 'vance', 'mira', 'jaxon'];                         // who the light reaches, one per sweep
    const DISC = { x: 206, y: 62 }, SUN = { x: 292, y: 90, r: 66 }, CLOSE = { x: 150, y: 44, r: 22 };

    // ── tuning ──
    const ACC = 4, TOP_SPEED = 4.6;         // suit thrust px/s², and the suit's limiter px/s (about half a metre a second)
    const TANK_SECONDS = 9;                 // seconds of full thrust; the limiter burns nothing while it holds you at top speed
    const MAX_LINE = Math.ceil(Math.hypot(DISC.x - ANCHOR.x, DISC.y - ANCHOR.y)) + 6;   // the line runs out just past the disc
    const CATCH_DIST = 8, NUDGE = 0.15, GAP = 2.2, PULL = 4.5, SCRAPE = 0.2, LET_GO = 0.3 + 14 * SCRAPE + 0.5;
    const SWEEP = { from: 300, speed: 45, first: 1, every: 8, tail: 24 };     // a front leaves the light every 8 s and runs left
    const HIT = ORDER.map((id, n) => SWEEP.first + n * SWEEP.every + (SWEEP.from - SPOT[id].x) / SWEEP.speed);
    const DIRS = { ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down' };
    const TRANSITS = [{ y: 72, v: 0.6, w: 3, o: 20 }, { y: 112, v: -0.4, w: 4, o: 70 }, { y: 58, v: 0.5, w: 2, o: 5 }, { y: 126, v: 0.3, w: 3, o: 40 }];

    // ── words (docs/STYLE.md: plain speech, one idea a line, 20 words at most) ──
    const after = (n, dt) => HIT[n] + dt;
    const SCRIPT = [
        { at: 0.3, note: 'The 1977 gold disc is at the edge of the light. Its map leads to Earth.' },
        { at: 2.7, who: 'vance', text: 'That light reads whatever reaches it. Get the disc before it does.' },
        { at: after(0, -2.3), who: 'aris', text: "There are ships inside the light. I'm adding them to my—" },
        { at: after(0, 2.5), who: 'mira', text: 'Aris stopped talking in the middle of a sentence.' },
        { at: after(0, 4.8), who: 'vance', text: 'The ships in the light have hull numbers past forty thousand. We were told eight.' },
        { at: after(1, 2.5), who: 'jaxon', text: "Vance isn't answering. On the camera he's just standing there." },
        { at: after(1, 4.8), who: 'mira', text: "It gives off no heat at all. That's not how a sun works." },
        { at: after(2, 2.5), aura: 'Mira is not responding, Commander. Her heart rate is normal.' },
        { at: after(2, 4.8), who: 'jaxon', text: "It's just me now. I'll keep talking as long as I can." },
    ];
    const STATIC = id => `${name(id)}'s channel goes to static.`;
    const CAUGHT = 'The disc is in your glove. Fourteen lines on it, and where they meet is home.';
    const COUNT = 'Four crew, Commander.';
    const ENDINGS = {
        cut: { label: 'Scrape off the map', note: 'You scrape off all fourteen lines. Now it says we exist, but not where.', pull: LET_GO + 0.6 },
        take: { label: 'Take it aboard', note: 'You clip the disc to your suit and start back along the line.', pull: 0.8 },
        leave: { label: 'Let it go', note: 'You let go. The disc turns once and slides into the light.', pull: 3 },
        adrift: { note: 'You pull yourself back along the line without the disc.', pull: 1.2 },
    };
    const CHOICES = { 1: 'cut', 2: 'take', 3: 'leave' };   // keys 1 2 3, same order as the buttons
    const MAP = (() => {
        const r = Lab.rng(1977);
        return Array.from({ length: 14 }, (_, i) => ({ a: (i / 14) * Math.PI * 2 + (r() - 0.5) * 0.35, len: 5 + r() * 8, read: i % 2 === 0 }));
    })();
    const FIGURES = [{ x: 8, y: -4, rows: ['.#.', '###', '.#.', '.#.', '#.#', '#.#'] }, { x: 12, y: -3, rows: ['.#.', '###', '.#.', '#.#', '#.#'] }];   // the two figures

    // ── the light and the stars, worked out once per pixel ──
    const pack = hex => { const n = parseInt(hex.slice(1), 16); return (0xff000000 | (n & 255) << 16 | (n & 0xff00) | (n >> 16)) >>> 0; };
    const SUN_RAMP = [C.void, C.amber, C.gold, C.white].map(pack), VOID = SUN_RAMP[0];
    const pick = (ramp, b, thr) => { const t = clamp01(b) * 0.999 * (ramp.length - 1), i = t | 0; return t - i > thr ? ramp[i + 1] : ramp[i]; };

    function buildField() {
        const n = W * H, r = Lab.rng(909), bone = pack(C.bone), boneD = pack(C.boneD);
        const f = { thr: new Float32Array(n), d: new Float32Array(n), ray: new Float32Array(n), grain: new Float32Array(n), star: new Uint32Array(n) };
        for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i++) {
            const a = Math.atan2(y - SUN.y, x - SUN.x);
            f.thr[i] = Lab.bayer(x, y);
            f.d[i] = Math.hypot(x - SUN.x, y - SUN.y) / SUN.r;
            f.ray[i] = (0.5 + 0.5 * Math.sin(a * 9 + 2 * Math.sin(a * 4))) ** 2;
            f.grain[i] = (r() - 0.5) * 0.1;
        }
        for (let k = 0; k < 110; k++) f.star[((r() * H) | 0) * W + ((r() * W) | 0)] = r() < 0.15 ? bone : boneD;
        return f;
    }
    /** The light (it breathes, brightens as each sweep leaves it, and flares when it reads the disc), its corona, the stars. */
    function paint(px, f, t, lift) {
        const breath = 0.5 + 0.5 * Math.sin(t * 0.8), reach = 0.55 + 0.07 * breath;
        for (let i = 0; i < W * H; i++) {
            const d = f.d[i];
            let b;
            if (d <= 1) b = 0.3 + 0.3 * Math.sqrt(1 - d * d) + 0.25 * (1 - d) ** 3 + f.grain[i] + 0.03 * breath + lift;
            else { const c = (d - 1) / reach; b = c < 1 ? (1 - c) ** 2.4 * (0.13 + 0.2 * f.ray[i] + lift) : 0; }
            const col = pick(SUN_RAMP, b, f.thr[i]);
            px[i] = col === VOID && f.star[i] ? f.star[i] : col;
        }
    }

    // ── the sweep: x of every front on screen at time t ──
    function fronts(t) {
        const out = [], span = (SWEEP.from + SWEEP.tail) / SWEEP.speed;
        for (let k = Math.max(0, Math.ceil((t - SWEEP.first - span) / SWEEP.every)); SWEEP.first + k * SWEEP.every <= t; k++) {
            out.push(SWEEP.from - SWEEP.speed * (t - SWEEP.first - k * SWEEP.every));
        }
        return out;
    }
    const pulseAt = t => (t < SWEEP.first ? 0 : Math.max(0, 1 - ((t - SWEEP.first) % SWEEP.every) / 0.6));
    function drawSweeps(ctx, xs) {
        xs.forEach(fx => {
            for (let u = 0; u < SWEEP.tail; u++) {
                const x = Math.round(fx) + u;
                if (x >= 0 && x < W) Lab.shade(ctx, x, 0, 1, H, u ? 0.4 * Math.exp(-u / 7) : 0.75, u ? C.amber : C.gold);
            }
        });
    }

    // ── small drawn things ──
    const SUIT = ['.bbb.', 'bbbgw', 'bbbgg', 'pbbb.', 'pbbbb', '.b.b.', '.b..b'];
    const SUIT_C = { b: C.bone, g: C.gold, w: C.white, p: C.boneD };
    function drawSuit(ctx, x, y, t, lit, carrying) {
        const ox = Math.round(x) - 2, oy = Math.round(y) - 3;
        SUIT.forEach((row, r) => [...row].forEach((ch, c) => { if (SUIT_C[ch]) Lab.dot(ctx, ox + c, oy + r, lit ? C.white : SUIT_C[ch]); }));
        if (Math.floor(t * 2) % 2) Lab.dot(ctx, ox, oy + 3, C.greenBr);   // suit beacon
        if (carrying) Lab.dot(ctx, ox + 5, oy + 4, C.gold);
    }
    function drawCoin(ctx, x, y, t) {
        x = Math.round(x); y = Math.round(y);
        const w = Math.abs(Math.cos(t * 1.4)) * 3;
        const ell = (rx, ry, color) => {
            for (let dy = -ry; dy <= ry; dy++) for (let dx = -Math.ceil(rx); dx <= Math.ceil(rx); dx++) {
                if ((dx / Math.max(rx, 0.5)) ** 2 + (dy / ry) ** 2 <= 1.05) Lab.dot(ctx, x + dx, y + dy, color);
            }
        };
        ell(w + 1, 4, C.void);
        ell(w, 3, C.gold);
        if (w > 2.75) [[0, 0], [4, 0], [-4, 0], [0, -5], [0, 5]].forEach(([dx, dy]) => Lab.dot(ctx, x + dx, y + dy, C.white));
    }
    function drawReticle(ctx, x, y, t) {
        const c = Math.floor(t * 1.5) % 2 ? C.greenBr : C.green, k = 7;
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
            Lab.dot(ctx, x + sx * k, y + sy * k, c); Lab.dot(ctx, x + sx * (k - 1), y + sy * k, c); Lab.dot(ctx, x + sx * k, y + sy * (k - 1), c);
        });
    }
    function drawTether(ctx, s) {
        const dx = s.x - 2 - ANCHOR.x, dy = s.y + 1 - ANCHOR.y, len = Math.hypot(dx, dy) || 1;
        const amp = s.from ? 0 : Math.min(9, Math.max(0, 1 - len / MAX_LINE) * 30), nx = -dy / len, ny = dx / len;
        const steps = Math.ceil((len + amp * 6) * 1.5);
        ctx.fillStyle = s.jolt > 0 ? C.gold : len > MAX_LINE - 4 ? C.bone : C.boneD;
        for (let k = 0; k <= steps; k++) {
            const u = k / steps, wave = Math.sin(Math.PI * u) * Math.sin(u * 7 + s.t * 0.9) * amp;
            ctx.fillRect(Math.round(ANCHOR.x + dx * u + nx * wave), Math.round(ANCHOR.y + dy * u + ny * wave), 1, 1);
        }
    }
    /** Our ship as the main screen draws it, the airlock, and the crew at their posts. Quiet crew go grey and stop moving. */
    function drawShip(ctx, s) {
        SHIP.draw(ctx, L, s.t * 1000, { labels: true });
        const shut = s.homeT < 0 ? 0 : clamp01((s.t - s.homeT) / 0.6);
        ctx.fillStyle = C.boneD; ctx.fillRect(DOOR.x - 1, DOOR.y - 1, 3, DOOR.h + 2);
        ctx.fillStyle = C.void; ctx.fillRect(DOOR.x, DOOR.y, 2, DOOR.h);
        if (shut > 0) { ctx.fillStyle = SHIP.HULL_RAMP[3]; ctx.fillRect(DOOR.x, DOOR.y, 2, Math.round(DOOR.h * shut)); }
        Lab.dot(ctx, DOOR.x + 1, DOOR.y - 3, shut >= 1 ? C.amber : C.greenBr);
        RADIO.forEach(id => {
            const p = SPOT[id], hit = s.quiet[id], awake = hit === undefined;
            const col = awake ? CREW[id].color : s.t - hit < 0.5 ? C.white : C.boneD;
            SHIP.figure(ctx, p.x, p.y, col, awake && (s.t * 0.6 + p.x * 0.37) % 3 < 0.25);
            if (awake && s.talker === id && s.t - s.talkT < GAP) {   // who is talking: a small blinking mark over their head
                Lab.dot(ctx, p.x, p.y - 11, CREW[id].color);
                if (Math.floor(s.t * 4) % 2) Lab.dot(ctx, p.x, p.y - 13, CREW[id].color);
            }
        });
        if (s.homeT >= 0 && shut >= 1) {
            SHIP.figure(ctx, SPOT.you.x, SPOT.you.y, CREW.you.color);
            if (s.ending === 'take') Lab.dot(ctx, SPOT.you.x + 3, SPOT.you.y - 5, C.gold);
        }
    }
    function drawTransits(ctx, t) {
        TRANSITS.forEach(q => {
            const half = Math.sqrt(SUN.r ** 2 - (q.y - SUN.y) ** 2) * 0.94, left = SUN.x - half;
            const x = Math.round(left + ((((q.o + q.v * t) % (2 * half)) + 2 * half) % (2 * half)));
            ctx.fillStyle = C.ink; ctx.fillRect(x, q.y, q.w, 1); ctx.fillRect(x + 1, q.y - 1, 1, 1);
        });
    }
    /** The disc up close: fourteen pulsar lines from one point, and two figures. Scraped lines go grey one by one. */
    function drawMap(ctx, s) {
        const { x: cx, y: cy, r: R } = CLOSE, mx = cx - 7, erased = s.ending === 'cut' ? s.scraped : 0;
        Lab.line(ctx, cx + R + 4, cy + 5, DISC.x - 6, DISC.y - 1, C.line2, 0.5);
        Lab.disc(ctx, cx, cy, R + 4, 1, C.ink);
        Lab.ring(ctx, cx, cy, R + 4, C.line2);
        Lab.disc(ctx, cx, cy, R, 0.12, C.amber);
        Lab.ring(ctx, cx, cy, R, C.gold, 0.9);
        MAP.forEach((m, i) => {
            const ex = mx + Math.cos(m.a) * m.len, ey = cy + Math.sin(m.a) * m.len;
            if (i < erased) { Lab.line(ctx, mx, cy, ex, ey, C.boneD, 0.3); return; }
            Lab.line(ctx, mx, cy, ex, ey, m.read ? C.white : C.gold);
            Lab.dot(ctx, ex - Math.sin(m.a) * 1.5, ey + Math.cos(m.a) * 1.5, m.read ? C.white : C.gold);
            if (s.ending === 'cut' && i === erased && Math.floor(s.t * 12) % 2) Lab.disc(ctx, ex, ey, 1.5, 1, C.white);   // the scraper
        });
        if (erased < 14) Lab.dot(ctx, mx, cy, C.white);
        FIGURES.forEach(({ x, y, rows }) => rows.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === '#') Lab.dot(ctx, cx + x + c, cy + y + r, C.white); })));
    }
    function drawHud(ctx, s) {
        const X = 74, len = Math.hypot(s.x - ANCHOR.x, s.y - ANCHOR.y);
        ctx.fillStyle = C.void; ctx.fillRect(X - 2, 3, 56, 23);   // the sweep passes behind the readouts, not through them
        const row =(y, label, frac, color) => {
            Lab.text(ctx, label, X, y, C.boneD);
            Lab.shade(ctx, X + 22, y + 1, 30, 3, 0.5, C.line2);
            ctx.fillStyle = color; ctx.fillRect(X + 22, y + 1, Math.round(30 * clamp01(frac)), 3);
        };
        row(5, 'TANK', s.tank, s.tank > 0.25 ? C.green : s.tank > 0 ? C.amber : C.red);
        row(12, 'LINE', len / MAX_LINE, len > MAX_LINE - 4 ? C.amber : C.boneD);
        Lab.text(ctx, 'RADIO', X, 19, C.boneD);
        RADIO.forEach((id, k) => {
            const x = X + 22 + k * 6;
            if (s.quiet[id] === undefined) { Lab.text(ctx, name(id)[0], x, 19, CREW[id].color); return; }
            for (let c = 0; c < 15; c++) if (Math.random() < 0.3) Lab.dot(ctx, x + (c % 3), 19 + Math.floor(c / 3), C.boneD);
        });
    }

    Lab.register({
        id: 'walk', badge: 'kept',
        name: 'The walk out',
        short: 'Drift out to the disc',
        verb: 'Drift out on a tether to the gold disc at the edge of the light while the light reads the crew one by one, then decide what happens to the disc.',
        serves: 'The ending, played instead of read. Every ending closes on A.U.R.A.\'s count.',
        replaces: 'The six ending paragraphs.',
        controls: 'Arrows / WASD, the buttons, or hold the mouse where you want to go · 1 2 3 to choose',
        mount(ctx, ui) {
            const f = buildField(), img = ctx.createImageData(W, H), px = new Uint32Array(img.data.buffer);
            const held = new Set(), canvas = ui.canvas;
            let aim = null, s = null, nudge = {};   // nudge: direction → game time a tap's small burst ends

            const fresh = () => ({
                t: 0, phase: 'walk', x: START.x, y: START.y, vx: 0, vy: 0, tank: 1, stall: 0, jolt: 0, shake: 0, puffs: [],
                quiet: {}, queue: SCRIPT.slice(), lastT: -10, talker: null, talkT: -10, cues: {},
                ending: null, endT: 0, from: null, homeT: -1, counted: false, coin: { ...DISC }, coinIn: false, flash: -1, scraped: 0,
            });

            // ── the radio: one line at a time, at least GAP apart. Nobody speaks after going quiet. ──
            function say(item) { s.queue = [...s.queue, { at: s.t, ...item }].sort((a, b) => a.at - b.at); }
            function cue(key, item) { if (!s.cues[key]) { s.cues = { ...s.cues, [key]: true }; say(item); } }
            function show(speaker, words) { ui.say(speaker, words); s.lastT = s.t; }
            function radio() {
                while (s.queue.length && s.queue[0].at <= s.t && s.t - s.lastT >= GAP) {
                    const [item, ...rest] = s.queue;
                    s.queue = rest;
                    if ((item.who && s.quiet[item.who] !== undefined) || (s.phase !== 'walk' && !item.always)) continue;
                    if (item.note) show('', item.note);
                    else if (item.aura) show('A.U.R.A.', item.aura);
                    else { show(name(item.who), item.text); s.talker = item.who; s.talkT = s.t; }
                    if (item.then) item.then();
                    return;
                }
            }
            /** The light never stops: each sweep that crosses the ship reaches the next person, whatever you are doing. */
            function lightPasses() {
                for (let n = Object.keys(s.quiet).length; n < ORDER.length && s.t >= HIT[n]; n++) {
                    s.quiet = { ...s.quiet, [ORDER[n]]: s.t };
                    say({ at: s.t + 0.3, note: STATIC(ORDER[n]), always: true });
                }
            }

            // ── moving ──
            function thrustDir() {
                const on = dir => held.has(dir) || (nudge[dir] || 0) > s.t || [...Lab.keys].some(k => DIRS[k] === dir);
                let ix = (on('right') ? 1 : 0) - (on('left') ? 1 : 0), iy = (on('down') ? 1 : 0) - (on('up') ? 1 : 0);
                const aiming = aim && (aim.held || aim.until > s.t) && Math.hypot(aim.x - s.x, aim.y - s.y) > 3;
                if (!ix && !iy && aiming) { ix = aim.x - s.x; iy = aim.y - s.y; }
                const m = Math.hypot(ix, iy);
                return m ? { x: ix / m, y: iy / m } : null;
            }
            function drift(dt) {
                const dir = s.tank > 0 ? thrustDir() : null;
                let vx = s.vx + (dir ? dir.x * ACC * dt : 0), vy = s.vy + (dir ? dir.y * ACC * dt : 0);
                const speed = Math.hypot(vx, vy);
                if (speed > TOP_SPEED) { vx *= TOP_SPEED / speed; vy *= TOP_SPEED / speed; }
                const burn = dir ? Math.hypot(vx - s.vx, vy - s.vy) / (ACC * dt) : 0;   // how much of the thrust the limiter let through
                if (burn > 0.05) {
                    s.tank = Math.max(0, s.tank - (burn * dt) / TANK_SECONDS);
                    s.puffs = [...s.puffs, { x: s.x - dir.x * 3, y: s.y - dir.y * 3 + 1, vx: vx - dir.x * 18 + (Math.random() - 0.5) * 8, vy: vy - dir.y * 18 + (Math.random() - 0.5) * 8, life: 0.5 }];
                }
                s.vx = vx; s.vy = vy; s.x += vx * dt; s.y += vy * dt;
                const dx = s.x - ANCHOR.x, dy = s.y - ANCHOR.y, len = Math.hypot(dx, dy);
                if (len > MAX_LINE) {   // the tether runs out: stop with a jolt
                    const nx = dx / len, ny = dy / len, out = s.vx * nx + s.vy * ny;
                    s.x = ANCHOR.x + nx * MAX_LINE; s.y = ANCHOR.y + ny * MAX_LINE;
                    if (out > 0) { s.vx -= 1.3 * out * nx; s.vy -= 1.3 * out * ny; }
                    if (out > 1.5) { s.jolt = 0.35; s.shake = Math.min(0.4, out / 20); }
                }
                const edge = L.cx + Math.max(6, L.halfWidth(Math.round(s.y))) + 4;
                if (s.x < edge) { s.x = edge; s.vx = Math.abs(s.vx) * 0.3; }
                if (s.y < 5 || s.y > 174) { s.y = Lab.clamp(s.y, 5, 174); s.vy = -s.vy * 0.3; }
            }
            /** With an empty tank: will the drift you have carry you to the disc within the next half minute? */
            function coastingIn() {
                const rx = DISC.x - s.x, ry = DISC.y - s.y, v2 = s.vx ** 2 + s.vy ** 2, k = (rx * s.vx + ry * s.vy) / (v2 || 1);
                return v2 > 0.25 && k > 0 && k < 30 && Math.hypot(rx - s.vx * k, ry - s.vy * k) < CATCH_DIST;
            }
            function watch(dt) {
                if (s.jolt > 0.3) cue('jolt', { who: 'jaxon', text: "That's the end of the line. It's holding." });
                if (s.tank <= 0.25) cue('low', { aura: 'Suit tank at twenty-five percent, Commander.' });
                if (s.tank <= 0) cue('empty', { aura: 'Suit tank is empty, Commander.' });
                s.stall = s.tank <= 0 && !coastingIn() ? s.stall + dt : 0;
                if (s.stall > 3) finish('adrift');
                else if (Math.hypot(s.x - DISC.x, s.y - DISC.y) < CATCH_DIST) catchDisc();
            }

            // ── the disc and the way back ──
            function catchDisc() {
                s.phase = 'choose'; s.vx = 0; s.vy = 0; s.x = DISC.x - 5; s.y = DISC.y + 1; aim = null; held.clear(); nudge = {};
                show('', CAUGHT);
                ui.buttons(Object.values(CHOICES).map(kind => ({ label: ENDINGS[kind].label, onClick: () => choose(kind) })));
            }
            function choose(kind) { if (s.phase === 'choose') finish(kind); }
            function finish(kind) {
                s.phase = 'end'; s.ending = kind; s.endT = 0; s.vx = 0; s.vy = 0;
                ui.buttons([]);
                show('', ENDINGS[kind].note);
            }
            function playEnding(dt) {
                s.endT += dt;
                if (s.ending === 'cut') s.scraped = Lab.clamp(Math.floor((s.endT - 0.3) / SCRAPE), 0, 14);
                if ((s.ending === 'leave' || (s.ending === 'cut' && s.endT > LET_GO)) && !s.coinIn) {
                    const dx = SUN.x - s.coin.x, dy = SUN.y - s.coin.y, d = Math.hypot(dx, dy);
                    s.coin = { x: s.coin.x + (dx / d) * 12 * dt, y: s.coin.y + (dy / d) * 12 * dt };
                    if (d < SUN.r * 0.85) { s.coinIn = true; s.flash = s.t; }
                }
                const pull = ENDINGS[s.ending].pull;
                if (s.endT < pull || s.homeT >= 0) return;
                if (!s.from) s.from = { x: s.x, y: s.y };
                const u = clamp01((s.endT - pull) / PULL), e = u * u * (3 - 2 * u);
                s.x = Lab.lerp(s.from.x, ANCHOR.x + 3, e); s.y = Lab.lerp(s.from.y, ANCHOR.y, e);
                if (u < 1) return;
                s.homeT = s.t;
                say({ at: s.t + 1.4, aura: COUNT, always: true, then: () => {
                    s.counted = true;
                    ui.buttons([{ label: 'Run it again', primary: true, onClick: () => { if (s.counted) restart(); } }]);
                } });
            }

            function step(dt) {
                s.t += dt;
                s.jolt = Math.max(0, s.jolt - dt); s.shake = Math.max(0, s.shake - dt);
                s.puffs = s.puffs.map(p => ({ ...p, x: p.x + p.vx * dt, y: p.y + p.vy * dt, life: p.life - dt })).filter(p => p.life > 0);
                lightPasses();
                if (s.phase === 'walk') { drift(dt); watch(dt); } else if (s.phase === 'end') playEnding(dt);
                radio();
            }
            function render() {
                const xs = fronts(s.t), glow = s.ending === 'leave' && s.flash >= 0 ? Math.max(0, 1 - (s.t - s.flash) / 1.5) : 0;
                paint(px, f, s.t, 0.1 * pulseAt(s.t) + 0.3 * glow);
                const ox = s.shake > 0 ? Math.round(Math.random() * 2 - 1) : 0, oy = s.shake > 0 ? Math.round(Math.random() * 2 - 1) : 0;
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.fillStyle = C.void; ctx.fillRect(0, 0, W, H);
                ctx.putImageData(img, ox, oy);
                ctx.setTransform(1, 0, 0, 1, ox, oy);
                drawTransits(ctx, s.t);
                drawShip(ctx, s);
                drawSweeps(ctx, xs);
                const outside = s.homeT < 0;
                if (outside) drawTether(ctx, s);
                if (s.phase === 'walk') drawReticle(ctx, DISC.x, DISC.y, s.t);
                if (s.ending !== 'take' && !s.coinIn) drawCoin(ctx, s.coin.x, s.coin.y, s.t);
                if (s.flash >= 0 && s.t - s.flash < 0.9) Lab.ring(ctx, s.coin.x, s.coin.y, 2 + (s.t - s.flash) * 14, s.ending === 'leave' ? C.white : C.bone, 1 - (s.t - s.flash));
                s.puffs.forEach(p => Lab.dot(ctx, p.x, p.y, p.life > 0.25 ? C.bone : C.boneD));
                if (outside) drawSuit(ctx, s.x, s.y, s.t, xs.some(fx => Math.abs(fx - s.x) < 2), s.ending === 'take');
                if (s.phase === 'choose' || (s.ending === 'cut' && s.endT < LET_GO)) drawMap(ctx, s);
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                drawHud(ctx, s);
            }
            function restart() {
                s = fresh(); held.clear(); aim = null; nudge = {};
                ui.clear();
                ui.buttons(['left', 'up', 'down', 'right'].map(dir => ({
                    label: { left: '←', up: '↑', down: '↓', right: '→' }[dir], hold: true,
                    onDown: () => { held.add(dir); nudge = { ...nudge, [dir]: s.t + NUDGE }; }, onUp: () => held.delete(dir),
                })));
                render();
            }

            canvas.onpointerdown = e => {
                if (s.phase !== 'walk') return;
                aim = { ...ui.toPixel(e), held: true, until: s.t + NUDGE };
                try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointers cannot be captured */ }
            };
            canvas.onpointermove = e => { if (aim && aim.held) aim = { ...aim, ...ui.toPixel(e) }; };
            canvas.onpointerup = canvas.onpointercancel = () => { if (aim) aim = { ...aim, held: false }; };
            Lab.onKey(k => {
                if (s.phase === 'walk' && DIRS[k]) nudge = { ...nudge, [DIRS[k]]: s.t + NUDGE };
                else if (s.phase === 'choose' && CHOICES[k]) choose(CHOICES[k]);
                else if (s.counted && (k === 'r' || k === 'Enter' || k === ' ')) restart();
            });

            restart();
            Lab.loop(dt => { step(dt); render(); }, 30);
            return () => { canvas.onpointercancel = null; ctx.setTransform(1, 0, 0, 1, 0, 0); };
        },
    });
})();
