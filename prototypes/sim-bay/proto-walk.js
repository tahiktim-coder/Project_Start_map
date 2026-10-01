/* proto-walk.js — THE WALK OUT (Sim Bay prototype).
   The ending, played instead of read. Drift out of EXODUS-9 on a tether, on a small suit tank, to the gold disc
   at the edge of the light. Each time the light's sweep crosses the ship, one voice on the radio turns to static.
   At the disc: cut the map, take it, or leave it. A.U.R.A. gives the last count. */
(function () {
    'use strict';
    const Lab = window.Lab, C = Lab.C, W = Lab.W, H = Lab.H;
    const clamp01 = v => Lab.clamp(v, 0, 1);

    // ── tuning ──
    const ACC = 4;                   // suit thrust, px/s²
    const TOP_SPEED = 10;            // the suit's limiter, px/s: nobody sprints out here
    const TANK_SECONDS = 9;          // seconds of thrust in a full tank
    const MAX_LINE = 176;            // tether length, px; the disc sits just inside it
    const ANCHOR = { x: 37, y: 97 }; // where the tether leaves the airlock
    const DISC = { x: 206, y: 62 };
    const SUN = { x: 292, y: 90, r: 66 };
    const SWEEP_FROM = -40, SWEEP_TO = 350, SWEEP_PERIOD = 14, SWEEP_HIT_X = 20, SWEEP_START = 30;
    const SWEEP_SPEED = (SWEEP_TO - SWEEP_FROM) / SWEEP_PERIOD;
    const TALK_GAP = 4.2, CUE_GAP = 3.4, STATIC_GAP = 1.4, FAST = 8.5, CATCH_DIST = 8;
    const NUDGE = 0.15;              // a quick tap still gives this many seconds of thrust
    const DIRS = { ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down' };
    const hullEdge = y => 38 - ((y - ANCHOR.y) ** 2) / 1100;
    const PORTHOLES = [{ x: 27, y: 30 }, { x: 30, y: 52 }, { x: 30, y: 142 }, { x: 27, y: 162 }];
    const TRANSITS = [{ y: 72, v: 0.6, w: 3, o: 20 }, { y: 112, v: -0.4, w: 4, o: 70 }, { y: 58, v: 0.5, w: 2, o: 5 }, { y: 126, v: 0.3, w: 3, o: 40 }];

    // ── words (docs/STYLE.md: plain speech, one idea a line, 20 words at most) ──
    const OPENING = 'You step out on the line. The disc is out there, at the edge of the light.';
    const CREW = ['Aris', 'Jaxon', 'Mira', 'Vance'];
    const TALK = {
        Aris: ['We can see you on the hull camera.', "Your heart rate's up. That's normal. Breathe slowly.", "There are ships inside the light. I'm adding them to my list."],
        Jaxon: ["The line runs out just past the disc. You'll feel it.", "Tether's holding.", "When you're back, we find somewhere to stop. Somewhere good."],
        Mira: ["It's getting brighter on my screen.", "A.U.R.A. says that's the gold disc from 1977. The real one.", "It gives off no heat at all. That's not how a sun works."],
        Vance: ['You have air for eight minutes. Take it slow.', 'The wrecks in there have hull numbers past forty thousand. We were told eight.', "Don't look straight at it. Keep your eyes on the disc."],
    };
    const SLOW_DOWN = 'Slow down. You have air for eight minutes.';
    const GONE = {
        Aris: 'Aris stopped talking in the middle of a sentence.',
        Jaxon: "Jaxon's not answering. His hands are still on the winch.",
        Mira: "Mira stopped answering. She's sitting right here with her eyes open.",
        Vance: "Vance stopped answering. He's still standing at the window.",
    };
    const REALISE = "It's the light. Every time it crosses the ship, someone goes quiet.";
    const LAST = "Get the disc, Commander. I'll keep talking as long as I can.";
    const CAUGHT = 'The disc is in your glove. Fourteen lines on it, and where they meet is home.';
    const ENDINGS = {
        cut: { label: 'Cut the map', note: 'You scrape off all fourteen lines. Now it says we exist, but not where.', count: 'Four crew, Commander.', at: 4 },
        take: { label: 'Take it', note: 'You clip the disc to your suit and pull yourself back along the line.', count: 'Five crew, Commander.', at: 6.4 },
        leave: { label: 'Leave it', note: 'You let go. The disc turns once and slides into the light.', count: 'Five crew, Commander.', at: 5 },
        adrift: { note: 'Your tank is empty. You hang on the line and watch the light.', count: 'Four crew, Commander.', at: 4 },
    };
    const CHOICES = { 1: 'cut', 2: 'take', 3: 'leave' };   // keys 1 2 3, same order as the buttons
    const MAP = (() => {
        const r = Lab.rng(1977);
        return Array.from({ length: 14 }, (_, i) => ({ a: (i / 14) * Math.PI * 2 + (r() - 0.5) * 0.35, len: 9 + r() * 12, read: i % 2 === 0 }));
    })();

    // ── the still parts of the picture, worked out once per pixel ──
    const pack = hex => { const n = parseInt(hex.slice(1), 16); return (0xff000000 | (n & 255) << 16 | (n & 0xff00) | (n >> 16)) >>> 0; };
    const P = Object.fromEntries(Object.entries(C).map(([k, v]) => [k, pack(v)]));
    const SUN_RAMP = [P.void, P.amber, P.gold, P.white];
    const HULL_RAMP = [P.void, P.ink2, P.line, P.line2, P.boneD];
    const RIM = 2;
    const pick = (ramp, b, thr) => { const t = clamp01(b) * 0.999 * (ramp.length - 1), i = t | 0; return t - i > thr ? ramp[i + 1] : ramp[i]; };

    function hullTone(x, y, edge, plates) {
        const inRow = (y + 4) % 19;
        let tone = 0.14 + 0.5 * (x / edge) ** 3 + plates[Math.floor((y + 4) / 19) % plates.length];
        if (inRow === 0 || x === 13) tone *= 0.35;       // plate seams
        if (inRow === 3 && x % 5 === 2) tone += 0.22;    // rivets
        return Math.max(0, tone);
    }
    function buildField() {
        const n = W * H, r = Lab.rng(909), plates = Array.from({ length: 12 }, () => (r() - 0.5) * 0.12);
        const f = { thr: new Float32Array(n), d: new Float32Array(n), ray: new Float32Array(n), grain: new Float32Array(n), hull: new Float32Array(n).fill(-1), star: new Uint32Array(n) };
        for (let y = 0, i = 0; y < H; y++) {
            const edge = hullEdge(y);
            for (let x = 0; x < W; x++, i++) {
                const a = Math.atan2(y - SUN.y, x - SUN.x);
                f.thr[i] = Lab.bayer(x, y);
                f.d[i] = Math.hypot(x - SUN.x, y - SUN.y) / SUN.r;
                f.ray[i] = (0.5 + 0.5 * Math.sin(a * 9 + 2 * Math.sin(a * 4))) ** 2;
                f.grain[i] = (r() - 0.5) * 0.1;
                if (x < edge) f.hull[i] = x >= edge - 1.2 ? RIM : hullTone(x, y, edge, plates);
            }
        }
        for (let k = 0; k < 110; k++) f.star[((r() * H) | 0) * W + ((r() * W) | 0)] = r() < 0.15 ? P.bone : P.boneD;
        return f;
    }

    /** The light, its corona, the sweep, the stars and the hull, one pixel at a time. */
    function paint(px, f, s) {
        const band = new Float32Array(W);
        for (let x = 0; x < W; x++) { const u = s.sx - x; band[x] = u < 0 ? 0 : u < 1.5 ? 1 : 0.7 * Math.exp(-u / 11); }
        const breath = 0.5 + 0.5 * Math.sin(s.t * 0.8), reach = 0.55 + 0.07 * breath;
        for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < W; x++, i++) {
            const bx = band[x], thr = f.thr[i], h = f.hull[i];
            if (h === RIM) { px[i] = thr < 0.45 + bx * 0.5 ? (bx > 0.3 ? P.white : P.amber) : P.line2; continue; }
            if (h >= 0) { px[i] = thr < bx * 0.3 ? P.gold : pick(HULL_RAMP, h + bx * 0.2, thr); continue; }
            const d = f.d[i];
            let b;
            if (d <= 1) b = 0.3 + 0.3 * Math.sqrt(1 - d * d) + 0.25 * (1 - d) ** 3 + f.grain[i] + bx * 0.35 + 0.03 * breath;
            else { const c = (d - 1) / reach; b = (c < 1 ? (1 - c) ** 2.4 * (0.13 + 0.2 * f.ray[i]) + bx * 0.08 * (1 - c) : 0) + bx * 0.035; }
            const col = pick(SUN_RAMP, b, thr);
            px[i] = col === P.void && f.star[i] ? f.star[i] : col;
        }
    }

    // ── small drawn things ──
    const SUIT = ['.bbb.', 'bbbgw', 'bbbgg', 'pbbb.', 'pbbbb', '.b.b.', '.b..b'];
    const SUIT_C = { b: C.bone, g: C.gold, w: C.white, p: C.boneD };
    function drawSuit(ctx, x, y, t) {
        const ox = Math.round(x) - 2, oy = Math.round(y) - 3;
        SUIT.forEach((row, r) => [...row].forEach((ch, c) => { if (SUIT_C[ch]) Lab.dot(ctx, ox + c, oy + r, SUIT_C[ch]); }));
        if (Math.floor(t * 2) % 2) Lab.dot(ctx, ox, oy + 3, C.greenBr);   // suit beacon
    }
    function drawCoin(ctx, x, y, t, dull) {
        x = Math.round(x); y = Math.round(y);
        const w = Math.abs(Math.cos(t * 1.4)) * 3;
        const ell = (rx, ry, color) => {
            for (let dy = -ry; dy <= ry; dy++) for (let dx = -Math.ceil(rx); dx <= Math.ceil(rx); dx++) {
                if ((dx / Math.max(rx, 0.5)) ** 2 + (dy / ry) ** 2 <= 1.05) Lab.dot(ctx, x + dx, y + dy, color);
            }
        };
        ell(w + 1, 4, C.void);
        ell(w, 3, dull ? C.boneD : C.gold);
        if (!dull && w > 2.75) { [[0, 0], [4, 0], [-4, 0], [0, -5], [0, 5]].forEach(([dx, dy]) => Lab.dot(ctx, x + dx, y + dy, C.white)); }
    }
    function drawReticle(ctx, x, y, t) {
        const c = Math.floor(t * 1.5) % 2 ? C.greenBr : C.green, k = 7;
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => {
            Lab.dot(ctx, x + sx * k, y + sy * k, c); Lab.dot(ctx, x + sx * (k - 1), y + sy * k, c); Lab.dot(ctx, x + sx * k, y + sy * (k - 1), c);
        });
    }
    function drawTether(ctx, s) {
        const dx = s.x - 2 - ANCHOR.x, dy = s.y + 1 - ANCHOR.y, len = Math.hypot(dx, dy) || 1;
        const amp = s.ending === 'take' ? 0 : Math.min(9, Math.max(0, 1 - len / MAX_LINE) * 30), nx = -dy / len, ny = dx / len;
        const steps = Math.ceil((len + amp * 6) * 1.5);
        ctx.fillStyle = s.jolt > 0 ? C.gold : len > MAX_LINE - 4 ? C.bone : C.boneD;
        for (let k = 0; k <= steps; k++) {
            const u = k / steps, wave = Math.sin(Math.PI * u) * Math.sin(u * 7 + s.t * 0.9) * amp;
            ctx.fillRect(Math.round(ANCHOR.x + dx * u + nx * wave), Math.round(ANCHOR.y + dy * u + ny * wave), 1, 1);
        }
    }
    function drawShip(ctx, s) {
        const x0 = 31, y0 = 88, w = 7, h = 18;
        ctx.fillStyle = C.void; ctx.fillRect(x0, y0, w, h);
        Lab.shade(ctx, x0, y0 + 2, w - 2, h - 4, s.flare ? 0.7 : 0.25, s.flare ? C.white : C.amber);
        ctx.fillStyle = C.boneD;
        ctx.fillRect(x0 - 1, y0 - 1, w + 1, 1); ctx.fillRect(x0 - 1, y0 + h, w + 1, 1); ctx.fillRect(x0 - 1, y0, 1, h);
        if (s.door > 0) { ctx.fillStyle = C.line2; ctx.fillRect(x0, y0, w, Math.round(h * s.door)); }
        Lab.dot(ctx, x0 + 2, y0 - 3, s.door >= 1 ? C.red : C.greenBr);
        PORTHOLES.forEach((p, k) => {
            ctx.fillStyle = C.void; ctx.fillRect(p.x - 1, p.y - 1, 5, 4);
            const read = s.flare || s.gone.has(CREW[k]);
            ctx.fillStyle = read ? C.white : (Math.floor(s.t * 0.7 + k) % 5 ? C.green : C.greenD);
            ctx.fillRect(p.x, p.y, 3, 2);
        });
        Lab.text(ctx, 'EXODUS', 3, 10, C.boneD);
        Lab.text(ctx, '9', 9, 116, C.boneD, 3);
    }
    function drawTransits(ctx, t) {
        TRANSITS.forEach(q => {
            const half = Math.sqrt(SUN.r ** 2 - (q.y - SUN.y) ** 2) * 0.94, left = SUN.x - half;
            const x = Math.round(left + ((((q.o + q.v * t) % (2 * half)) + 2 * half) % (2 * half)));
            ctx.fillStyle = C.ink; ctx.fillRect(x, q.y, q.w, 1); ctx.fillRect(x + 1, q.y - 1, 1, 1);
        });
    }
    function drawMap(ctx, s) {
        const cx = 128, cy = 42, R = 22, erased = s.ending === 'cut' ? Math.min(14, Math.floor(s.endT / 0.2)) : 0;
        Lab.line(ctx, cx + R + 4, cy + 4, DISC.x - 6, DISC.y - 1, C.line2, 0.5);
        Lab.disc(ctx, cx, cy, R + 4, 1, C.ink);
        Lab.ring(ctx, cx, cy, R + 4, C.line2);
        Lab.disc(ctx, cx, cy, R, 0.12, erased >= 14 ? C.boneD : C.amber);
        Lab.ring(ctx, cx, cy, R, erased >= 14 ? C.boneD : C.gold, 0.9);
        MAP.forEach((m, i) => {
            const ex = cx + Math.cos(m.a) * m.len, ey = cy + Math.sin(m.a) * m.len;
            if (i < erased) { Lab.line(ctx, cx, cy, ex, ey, C.boneD, 0.3); return; }
            Lab.line(ctx, cx, cy, ex, ey, m.read ? C.white : C.gold);
            Lab.dot(ctx, ex - Math.sin(m.a) * 1.5, ey + Math.cos(m.a) * 1.5, m.read ? C.white : C.gold);
        });
        Lab.line(ctx, cx, cy, cx + R - 2, cy, C.bone, 0.6);
        Lab.dot(ctx, cx, cy, C.white);
    }
    function drawHud(ctx, s) {
        const len = Math.hypot(s.x - ANCHOR.x, s.y - ANCHOR.y);
        const row = (y, label, frac, color) => {
            Lab.text(ctx, label, 44, y, C.boneD);
            Lab.shade(ctx, 66, y + 1, 30, 3, 0.5, C.line2);
            ctx.fillStyle = color; ctx.fillRect(66, y + 1, Math.round(30 * clamp01(frac)), 3);
        };
        row(5, 'TANK', s.tank, s.tank > 0.25 ? C.green : s.tank > 0 ? C.amber : C.red);
        row(12, 'LINE', len / MAX_LINE, len > MAX_LINE - 4 ? C.amber : C.boneD);
        Lab.text(ctx, 'RADIO', 44, 19, C.boneD);
        CREW.forEach((who, k) => {
            const x = 66 + k * 6;
            if (!s.gone.has(who)) { Lab.text(ctx, who[0], x, 19, C.green); return; }
            for (let c = 0; c < 15; c++) if (Math.random() < 0.3) Lab.dot(ctx, x + (c % 3), 19 + Math.floor(c / 3), C.boneD);
        });
    }

    Lab.register({
        id: 'walk', badge: 'kept',
        name: 'The walk out',
        short: 'Drift out to the disc',
        verb: 'Drift out on a tether toward the light on a small suit tank, reach the gold disc, and decide what to do with it.',
        serves: 'The ending, played instead of read.',
        replaces: 'The six ending paragraphs.',
        controls: 'Arrows / WASD, the buttons, or hold the mouse where you want to go · 1 2 3 to choose',
        mount(ctx, ui) {
            const f = buildField(), img = ctx.createImageData(W, H), px = new Uint32Array(img.data.buffer);
            const held = new Set(), canvas = ui.canvas;
            let aim = null, s = null, nudge = {};   // nudge: direction → game time a tap's small burst ends

            const fresh = () => ({
                t: 0, phase: 'walk', x: 46, y: 97, vx: 0, vy: 0, tank: 1, sx: SWEEP_START, jolt: 0, shake: 0, jolts: 0, stall: 0,
                gone: new Set(), lastWho: null, turn: 0, lines: Object.fromEntries(CREW.map(w => [w, TALK[w].slice()])),
                queue: [{ note: OPENING, at: 0.3, gap: 0 }], lastT: -10, cues: new Set(), puffs: [],
                ending: null, endT: 0, counted: false, door: 0, flare: false, coin: { ...DISC }, coinIn: false, flash: -1,
            });

            // ── the radio: one line at a time ──
            const alive = () => CREW.filter(w => !s.gone.has(w));
            function nextSpeaker(needsLines) {
                for (let k = 0; k < CREW.length; k++) {
                    const idx = (s.turn + k) % CREW.length, who = CREW[idx];
                    if (!s.gone.has(who) && (!needsLines || s.lines[who].length)) { s.turn = idx + 1; return who; }
                }
                return null;
            }
            function speak(item) {
                s.lastT = s.t;
                if (item.note) { ui.say('', item.note); return; }
                if (item.aura) { ui.say('A.U.R.A.', item.aura); return; }
                if (item.static) { ui.say('', 'Static.'); s.lastWho = null; return; }
                if (item.who && s.gone.has(item.who)) return;   // they went quiet before they could say it
                const who = item.who || (item.last ? alive()[0] : nextSpeaker(false));
                if (!who) return;
                ui.say(who, item.text || item.last || GONE[item.reaction]);
                s.lastWho = who;
            }
            function radio() {
                const head = s.queue[0], since = s.t - s.lastT;
                if (head) {
                    if (s.t >= (head.at || 0) && since >= (head.gap ?? CUE_GAP)) { s.queue = s.queue.slice(1); speak(head); }
                    return;
                }
                if (since < TALK_GAP) return;
                const who = nextSpeaker(true);
                if (who) { const [text, ...rest] = s.lines[who]; s.lines[who] = rest; speak({ who, text }); }
            }
            function cue(key, item) { if (!s.cues.has(key)) { s.cues.add(key); s.queue = [...s.queue, item]; } }
            function takeLine(who, text) {
                if (s.gone.has(who) || !s.lines[who].includes(text)) return false;
                s.lines[who] = s.lines[who].filter(l => l !== text);
                return true;
            }
            function sweepHitsShip() {
                const left = alive();
                if (!left.length) return;
                const victim = left.includes(s.lastWho) ? s.lastWho : CREW.find((w, k) => !s.gone.has(w) && k >= s.turn % 4) || left[0];
                s.gone.add(victim);
                const after = s.gone.size === 3 ? [{ last: REALISE }, { last: LAST }] : s.gone.size < 3 ? [{ reaction: victim }] : [];
                s.queue = [{ static: victim, at: s.t + 1, gap: STATIC_GAP }, ...s.queue, ...after];
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
                const dir = thrustDir();
                if (dir && s.tank > 0) {
                    s.vx += dir.x * ACC * dt; s.vy += dir.y * ACC * dt;
                    s.tank = Math.max(0, s.tank - dt / TANK_SECONDS);
                    s.puffs = [...s.puffs, { x: s.x - dir.x * 3, y: s.y - dir.y * 3 + 1, vx: s.vx - dir.x * 18 + (Math.random() - 0.5) * 8, vy: s.vy - dir.y * 18 + (Math.random() - 0.5) * 8, life: 0.5 }];
                }
                const speed = Math.hypot(s.vx, s.vy);
                if (speed > TOP_SPEED) { s.vx *= TOP_SPEED / speed; s.vy *= TOP_SPEED / speed; }
                s.x += s.vx * dt; s.y += s.vy * dt;
                const dx = s.x - ANCHOR.x, dy = s.y - ANCHOR.y, len = Math.hypot(dx, dy);
                if (len > MAX_LINE) {   // the tether runs out: stop with a jolt
                    const nx = dx / len, ny = dy / len, out = s.vx * nx + s.vy * ny;
                    s.x = ANCHOR.x + nx * MAX_LINE; s.y = ANCHOR.y + ny * MAX_LINE;
                    if (out > 0) { s.vx -= 1.3 * out * nx; s.vy -= 1.3 * out * ny; }
                    if (out > 1.5) { s.jolt = 0.35; s.shake = Math.min(0.4, out / 20); s.jolts += 1; }
                }
                const edge = hullEdge(s.y) + 4;
                if (s.x < edge) { s.x = edge; s.vx = Math.abs(s.vx) * 0.3; }
                if (s.y < 5 || s.y > 174) { s.y = Lab.clamp(s.y, 5, 174); s.vy = -s.vy * 0.3; }
            }
            function watch(dt) {
                const speed = Math.hypot(s.vx, s.vy);
                if (speed > FAST && takeLine('Vance', TALK.Vance[0])) cue('fast', { who: 'Vance', text: SLOW_DOWN, gap: 1.6 });
                if (s.jolts > 0 && takeLine('Jaxon', "Tether's holding.")) cue('jolt', { who: 'Jaxon', text: "Tether's holding.", gap: 1.6 });
                if (s.tank <= 0.25) cue('low', { aura: 'Suit tank at twenty-five percent, Commander.', gap: 2 });
                if (s.tank <= 0) cue('empty', { aura: 'Suit tank is empty, Commander.', gap: 2 });
                s.stall = s.tank <= 0 && speed < 1.2 ? s.stall + dt : 0;
                if (s.stall > 3) finish('adrift');
                else if (Math.hypot(s.x - DISC.x, s.y - DISC.y) < CATCH_DIST) catchDisc();
            }
            function catchDisc() {
                s.phase = 'choose'; s.vx = 0; s.vy = 0; s.x = DISC.x - 5; s.y = DISC.y + 1; aim = null; held.clear();
                ui.say('', CAUGHT);
                ui.buttons(Object.values(CHOICES).map(kind => ({ label: ENDINGS[kind].label, onClick: () => finish(kind) })));
            }
            function finish(kind) {
                if (s.phase === 'end') return;
                s.phase = 'end'; s.ending = kind; s.endT = 0; s.vx = 0; s.vy = 0; s.from = { x: s.x, y: s.y };
                ui.buttons([]); ui.say('', ENDINGS[kind].note);
            }
            function playEnding(dt) {
                s.endT += dt;
                if (s.ending === 'take') {
                    const u = clamp01(s.endT / 4), e = u * u * (3 - 2 * u);
                    s.x = Lab.lerp(s.from.x, ANCHOR.x + 5, e); s.y = Lab.lerp(s.from.y, ANCHOR.y - 1, e);
                    s.door = clamp01((s.endT - 4.3) / 0.8);
                    s.flare = s.endT > 5.4;
                }
                if (s.ending === 'leave' && !s.coinIn) {
                    const dx = SUN.x - s.coin.x, dy = SUN.y - s.coin.y, d = Math.hypot(dx, dy);
                    s.coin = { x: s.coin.x + (dx / d) * 12 * dt, y: s.coin.y + (dy / d) * 12 * dt };
                    if (d < SUN.r * 0.85) { s.coinIn = true; s.flash = s.t; }
                }
                const end = ENDINGS[s.ending];
                if (!s.counted && s.endT >= end.at) {
                    s.counted = true;
                    ui.say('A.U.R.A.', end.count);
                    ui.buttons([{ label: 'Run it again', primary: true, onClick: restart }]);
                }
            }

            function step(dt) {
                s.t += dt;
                const prev = s.sx;
                s.sx += SWEEP_SPEED * dt;
                if (s.sx > SWEEP_TO) s.sx -= SWEEP_TO - SWEEP_FROM;
                s.jolt = Math.max(0, s.jolt - dt); s.shake = Math.max(0, s.shake - dt);
                s.puffs = s.puffs.map(p => ({ ...p, x: p.x + p.vx * dt, y: p.y + p.vy * dt, life: p.life - dt })).filter(p => p.life > 0);
                if (s.phase === 'walk') {
                    if (prev < SWEEP_HIT_X && s.sx >= SWEEP_HIT_X) sweepHitsShip();
                    drift(dt); watch(dt);
                    if (s.phase === 'walk') radio();
                } else if (s.phase === 'end') playEnding(dt);
            }
            function render() {
                paint(px, f, s);
                const ox = s.shake > 0 ? Math.round(Math.random() * 2 - 1) : 0, oy = s.shake > 0 ? Math.round(Math.random() * 2 - 1) : 0;
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.fillStyle = C.void; ctx.fillRect(0, 0, W, H);
                ctx.putImageData(img, ox, oy);
                ctx.setTransform(1, 0, 0, 1, ox, oy);
                drawTransits(ctx, s.t);
                drawShip(ctx, s);
                const suitVisible = !(s.ending === 'take' && s.endT >= 4.1);
                if (suitVisible) drawTether(ctx, s);
                if (s.phase === 'walk') drawReticle(ctx, DISC.x, DISC.y, s.t);
                if (s.ending === 'take') { if (suitVisible) Lab.dot(ctx, s.x + 3, s.y + 1, C.gold); }
                else if (!s.coinIn) drawCoin(ctx, s.coin.x, s.coin.y, s.t, s.ending === 'cut' && s.endT > 2.8);
                if (s.flash >= 0 && s.t - s.flash < 0.9) Lab.ring(ctx, s.coin.x, s.coin.y, 2 + (s.t - s.flash) * 14, C.white, 1 - (s.t - s.flash));
                s.puffs.forEach(p => Lab.dot(ctx, p.x, p.y, p.life > 0.25 ? C.bone : C.boneD));
                if (suitVisible) drawSuit(ctx, s.x, s.y, s.t);
                if (s.phase === 'choose' || s.ending === 'cut') drawMap(ctx, s);
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
                else if (s.phase === 'choose' && CHOICES[k]) finish(CHOICES[k]);
                else if (s.phase === 'end' && s.counted && (k === 'r' || k === 'Enter' || k === ' ')) restart();
            });

            restart();
            Lab.loop(dt => { step(dt); render(); }, 30);
            return () => { canvas.onpointercancel = null; ctx.setTransform(1, 0, 0, 1, 0, 0); };
        },
    });
})();
