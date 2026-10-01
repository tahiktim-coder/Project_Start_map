/* proto-disc.js — Date it with the disc, in two dimensions.
   A pulsar map answers two questions at once. WHEN: every pulsar slows at its own known rate, so the wreck's marks slide
   along the disc's lines as you change the years. WHERE: from further down the heading the pulsars sit at slightly
   different angles, so the wreck's lines swing as you change the distance. Only one point on the WHEN × WHERE pad puts
   all fourteen lines on the disc's lines and all fourteen marks in their notches. Each wreck you date stays plotted on
   the pad; by the third the player has drawn the pattern themselves: the further down the heading, the older the dead. */

(function () {
    'use strict';
    const Lab = window.Lab, C = Lab.C, W = Lab.W, H = Lab.H;

    const CX = 108, CY = 88, R = 74;                   // the disc
    const MIN_R = 12;                                  // marks never crowd the centre
    const YEARS_MAX = 500, LY_MAX = 200;               // the pad's range: years dead × light-years down the heading
    const PAD = { x: 212, y: 36, w: 98, h: 100 };      // the WHEN × WHERE pad, right of the disc
    const MARK_TOL = 0.5;                              // px: a mark is in its notch
    const ANGLE_TOL = 0.0026;                          // rad (~0.15°): a line sits on the disc's line
    const SNAP = 3;                                    // letting go this close to the answer settles into it
    const EASE = 12;                                   // how fast the picture follows the pad, per second
    const HOLD_DELAY = 0.35, HOLD_EVERY = 0.06, HOLD_FAST_AFTER = 1.1, FAST_STEP = 5;
    const FLASH = 0.5, LINE_GAP = 2.8;

    // Fourteen pulsars: angle (degrees), line length (px), notch as a fraction of the length.
    const PULSARS = [
        [-176, 70, 0.62], [-151, 46, 0.55], [-129, 60, 0.72], [-104, 38, 0.60], [-83, 66, 0.45],
        [-58, 52, 0.70], [-36, 32, 0.66], [-11, 64, 0.50], [12, 42, 0.74], [35, 58, 0.58],
        [61, 36, 0.52], [92, 68, 0.64], [124, 48, 0.68], [153, 56, 0.48],
    ].map(([deg, len, f]) => ({ a: (deg * Math.PI) / 180, len, notch: Math.round(Math.max(MIN_R + 4, len * f)) }));
    // Per year, how far each mark slides (px). Per light-year, how far each line swings (radians): near pulsars swing more.
    const RATES = [0.07, 0.1, 0.14, 0.18, 0.24, 0.3, 0.38, 0.46, 0.55, 0.65, 0.78, 0.92, 1.1, 1.3];
    const SWINGS = [0.0016, 0.0022, 0.003, 0.0038, 0.0046, 0.0055, 0.0064, 0.0074, 0.0085, 0.0096, 0.011, 0.0122, 0.0136, 0.015];

    const WRECKS = [
        {
            hull: 'EXODUS-4', num: '4', short: '4', sector: 1, age: 21, ly: 9, seed: 4,
            intro: [['A.U.R.A.', 'Star fix loaded from EXODUS-4, Commander. Sector one.'],
                ['Mira', 'Left and right is when. Up and down is where. Make the lines and marks meet.']],
            locked: [['Aris', 'Twenty-one years, nine light-years out. That matches the briefing.']],
        },
        {
            hull: 'EXODUS-980', num: '980', short: '980', sector: 3, age: 104, ly: 61, seed: 980,
            intro: [['Vance', "Hull 980. Let's see when it died, and where."]],
            locked: [['Mira', "A hundred and four years. That can't be right. A higher number should be newer."]],
        },
        {
            hull: 'EXODUS-30,211', num: '30,211', short: '30,211', sector: 6, age: 396, ly: 188, seed: 30211,
            intro: [['A.U.R.A.', 'Star fix loaded from EXODUS-30,211, Commander. Sector six.']],
            locked: [['Vance', 'Four hundred years. And it has a higher number than us.'],
                ['A.U.R.A.', 'The reading is correct, Commander.']],
        },
    ];

    const padX = yr => PAD.x + (yr / YEARS_MAX) * PAD.w;
    const padY = ly => PAD.y + PAD.h - (ly / LY_MAX) * PAD.h;
    const yearsAt = x => Lab.clamp(Math.round(((x - PAD.x) / PAD.w) * YEARS_MAX), 0, YEARS_MAX);
    const lyAt = y => Lab.clamp(Math.round(((PAD.y + PAD.h - y) / PAD.h) * LY_MAX), 0, LY_MAX);
    const onPad = p => p.x >= PAD.x - 4 && p.x <= PAD.x + PAD.w + 4 && p.y >= PAD.y - 4 && p.y <= PAD.y + PAD.h + 4;

    function shuffled(list, rnd) {
        const out = list.slice();
        for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
        return out;
    }
    /** Where pulsar p's mark sits (px from centre) at `years`. It slides at `rate` and bounces off the line's ends. */
    function markAt(p, rate, years, age) {
        const span = p.len - MIN_R;
        let u = (((p.notch - MIN_R + rate * (years - age)) % (2 * span)) + 2 * span) % (2 * span);
        if (u > span) u = 2 * span - u;
        return MIN_R + u;
    }
    /** A short bar across a line at angle `a`, distance `pos` from the centre, from `from` to `to` px either side. */
    function bar(c, a, pos, from, to, color) {
        const dx = Math.cos(a), dy = Math.sin(a), bx = CX + dx * pos, by = CY + dy * pos;
        for (let o = from; o <= to; o++) Lab.dot(c, bx - dy * o, by + dx * o, color);
    }

    function drawDisc(b) {
        b.fillStyle = C.void; b.fillRect(0, 0, W, H);
        Lab.stars(b, 1977, 80);
        Lab.disc(b, CX, CY, R + 3, 1, C.void);
        Lab.disc(b, CX, CY, R, d => (d < 0.8 ? 0 : 0.03 + 0.3 * ((d - 0.8) / 0.2) ** 2), C.amber);
        for (let r = 20; r < R - 8; r += 10) Lab.ring(b, CX, CY, r, C.amber, 0.12);
        Lab.ring(b, CX, CY, R, C.gold, 0.75);
        Lab.ring(b, CX, CY, R + 1, C.amber, 0.35);
        PULSARS.forEach(p => {
            Lab.line(b, CX, CY, CX + Math.cos(p.a) * p.len, CY + Math.sin(p.a) * p.len, C.line2);
            bar(b, p.a, p.notch, -3, -2, C.bone);
            bar(b, p.a, p.notch, 2, 3, C.bone);
        });
    }

    function mount(ctx, ui) {
        const bg = document.createElement('canvas');
        bg.width = W; bg.height = H;
        drawDisc(bg.getContext('2d'));

        let s = null, held = null, hover = false, ended = false, endT = 0, reached = 0, gen = 0, clock = 0;
        let plotted = [];                                   // wrecks already dated, as { w } — they stay on the pad
        let queue = [];
        const later = (sec, fn) => { const g = gen; queue = queue.concat({ at: clock + sec, fn: () => g === gen && fn() }); };
        const busy = () => ended || !s || s.locked;

        function startWreck(i) {
            gen++; queue = []; held = null; ended = false;
            const w = WRECKS[i], rnd = Lab.rng(w.seed);
            const rates = shuffled(RATES, rnd).map(k => (rnd() < 0.5 ? -k : k));
            const swings = shuffled(SWINGS, rnd).map(k => (rnd() < 0.5 ? -k : k));
            const start = { y: 250, l: 100 };
            s = { i, v: start, d: start, locked: false, dragging: false, flash: 0, rates, swings };
            plotted = plotted.filter(p => WRECKS.indexOf(p.w) < i);
            ui.say(w.intro[0][0], w.intro[0][1]);
            w.intro.slice(1).forEach(([who, line], j) => later(1.6 * (j + 1), () => ui.say(who, line)));
            showButtons();
        }
        function restart() { reached = 0; plotted = []; startWreck(0); }
        function setPad(y, l) {
            if (busy()) return;
            s = { ...s, v: { y: Lab.clamp(Math.round(y), 0, YEARS_MAX), l: Lab.clamp(Math.round(l), 0, LY_MAX) } };
        }
        const nudge = (dy, dl) => { if (!busy()) setPad(s.v.y + dy, s.v.l + dl); };
        function release() {
            if (!s || !s.dragging) return;
            const w = WRECKS[s.i], near = Math.abs(s.v.y - w.age) <= SNAP && Math.abs(s.v.l - w.ly) <= SNAP;
            s = { ...s, dragging: false, v: !s.locked && near ? { y: w.age, l: w.ly } : s.v };
        }
        function advance() {
            if (ended) restart();
            else if (s && s.locked && s.i < WRECKS.length - 1) startWreck(s.i + 1);
        }
        function lock() {
            const w = WRECKS[s.i], last = s.i === WRECKS.length - 1;
            s = { ...s, locked: true, dragging: false, flash: FLASH, d: { ...s.v } };
            held = null;
            plotted = plotted.concat({ w });
            reached = Math.max(reached, s.i + 1);
            showButtons();
            w.locked.forEach(([who, line], j) => later(0.5 + j * LINE_GAP, () => ui.say(who, line)));
            if (last) later(0.5 + w.locked.length * LINE_GAP + 0.6, finish);
        }
        function finish() {
            ended = true; endT = 0;
            later(1.8, () => ui.say('Mira', 'They line up. The further down the heading, the older they are.'));
            later(4.4, () => ui.say('', 'The further down the heading, the older the dead.'));
            later(4.4, showButtons);
        }

        function showButtons() {
            if (ended) return ui.buttons(endT > 0 ? [{ label: 'Run it again', primary: true, onClick: restart }] : []);
            const lastLocked = s.locked && s.i === WRECKS.length - 1;
            const moves = [[-1, 0, 'Fewer years'], [1, 0, 'More years'], [0, -1, 'Nearer'], [0, 1, 'Farther']].map(([dy, dl, label]) => ({
                label, hold: true, disabled: s.locked,
                onDown: () => { if (busy()) return; nudge(dy, dl); held = { dy, dl, wait: HOLD_DELAY, age: 0 }; },
                onUp: () => { held = null; },
            }));
            const wrecks = WRECKS.map((w, i) => ({
                label: w.hull, disabled: lastLocked || i > reached,
                primary: s.locked ? i === s.i + 1 : i === s.i,
                onClick: () => startWreck(i),
            }));
            ui.buttons(moves.concat(wrecks));
        }

        // ── drawing ──
        const right = (str, x, y, color, scale = 1) => Lab.text(ctx, str, x - Lab.textWidth(str, scale), y, color, scale);
        const pad3 = n => String(n).padStart(3, '0');

        function sweep(t) {                                             // the faint slow light crossing the disc
            const bx = CX - R + ((t / 8000) % 1) * 2 * R;
            for (let x = Math.ceil(bx - 5); x <= bx + 5; x++) {
                const half = Math.sqrt(Math.max(0, R * R - (x - CX) * (x - CX)));
                Lab.shade(ctx, x, CY - half, 1, half * 2, 0.07 * (1 - Math.abs(x - bx) / 5), C.gold);
            }
        }
        function drawPad(showCursor) {
            const { x, y, w, h } = PAD;
            Lab.line(ctx, x, y + h, x + w, y + h, C.boneD);                     // years axis
            Lab.line(ctx, x, y, x, y + h, C.boneD);                             // distance axis
            for (let yr = 0; yr <= YEARS_MAX; yr += 50) for (let ly = 0; ly <= LY_MAX; ly += 25) {
                const gx = Math.round(padX(yr)), gy = Math.round(padY(ly));
                if (yr % 100 === 0 && ly % 50 === 0) { Lab.dot(ctx, gx, gy, C.line2); Lab.dot(ctx, gx + 1, gy, C.line2); Lab.dot(ctx, gx, gy - 1, C.line2); }
                else Lab.dot(ctx, gx, gy, C.line);
            }
            for (let yr = 100; yr < YEARS_MAX; yr += 100) Lab.line(ctx, padX(yr), y + h + 1, padX(yr), y + h + 2, C.boneD);
            for (let ly = 50; ly < LY_MAX; ly += 50) Lab.line(ctx, x - 2, padY(ly), x - 1, padY(ly), C.boneD);
            Lab.text(ctx, 'WHEN', x + w - Lab.textWidth('WHEN'), y + h + 4, C.boneD);
            Lab.text(ctx, '0', x - 1, y + h + 4, C.boneD);
            Lab.text(ctx, '500 YRS', x + w / 2 - 12, y + h + 4, C.line2);
            Lab.text(ctx, 'WHERE', x, y - 7, C.boneD);
            Lab.text(ctx, '200 LY', x + w - Lab.textWidth('200 LY'), y - 7, C.line2);
            // wrecks already dated stay on the pad, with our own ship at the origin
            Lab.disc(ctx, padX(0) + 1, padY(0) - 1, 1.6, 1, C.green);
            plotted.forEach(({ w: wk }) => {
                const px = Math.round(padX(wk.age)), py = Math.round(padY(wk.ly));
                Lab.disc(ctx, px, py, 1.8, 1, C.gold);
                const label = wk.short, lx = px + 3 + Lab.textWidth(label) > x + w ? px - 3 - Lab.textWidth(label) : px + 3;
                Lab.text(ctx, label, lx, py - 6, C.amber);
            });
            if (!showCursor) return;
            const cx = Math.round(padX(s.d.y)), cy = Math.round(padY(s.d.l));
            const col = s.locked ? C.greenBr : s.dragging || hover ? C.gold : C.amber;
            Lab.line(ctx, cx, y + 1, cx, y + h - 1, col, 0.3);
            Lab.line(ctx, x + 1, cy, x + w - 1, cy, col, 0.3);
            Lab.ring(ctx, cx, cy, 3, col, 1);
            Lab.dot(ctx, cx, cy, col);
        }
        function drawHud(w, lines, marks) {
            Lab.text(ctx, 'EXODUS', 6, 6, C.boneD);
            Lab.text(ctx, w.num, 6, 13, C.bone, 2);
            Lab.text(ctx, 'SECTOR ' + w.sector, 6, 26, C.boneD);
            const rx = W - 6, y0 = PAD.y + PAD.h + 13;
            Lab.text(ctx, 'YRS', PAD.x, y0, C.boneD);
            Lab.text(ctx, pad3(s.locked ? w.age : s.v.y), PAD.x + 14, y0, s.locked ? C.greenBr : C.amber);
            Lab.text(ctx, 'LY', PAD.x + 44, y0, C.boneD);
            Lab.text(ctx, pad3(s.locked ? w.ly : s.v.l), PAD.x + 54, y0, s.locked ? C.greenBr : C.amber);
            right('LINES ' + String(lines).padStart(2, '0') + '/14', rx, y0 + 9, lines === 14 ? C.green : C.boneD);
            Lab.text(ctx, 'MARKS ' + String(marks).padStart(2, '0') + '/14', PAD.x, y0 + 9, marks === 14 ? C.green : C.boneD);
            if (s.locked) right('DATED', rx, 6, C.greenBr, 2);
        }
        function drawFlash() {
            const a = s.flash / FLASH;
            Lab.disc(ctx, CX, CY, R + 2, d => a * 0.45 * (1 - d * 0.6), C.greenBr);
            Lab.ring(ctx, CX, CY, (1 - a) * (R + 12) + 4, C.greenBr, 0.9);
        }
        function render(t) {
            const w = WRECKS[s.i];
            ctx.drawImage(bg, 0, 0);
            sweep(t);
            let lines = 0, marks = 0;
            PULSARS.forEach((p, j) => {
                const off = s.swings[j] * (s.d.l - w.ly), a = p.a + off, pos = markAt(p, s.rates[j], s.d.y, w.age);
                const lineOn = Math.abs(off) < ANGLE_TOL, markOn = Math.abs(pos - p.notch) < MARK_TOL;
                if (lineOn) lines++;
                if (markOn) marks++;
                const ex = CX + Math.cos(a) * p.len, ey = CY + Math.sin(a) * p.len;
                if (lineOn) Lab.line(ctx, CX, CY, ex, ey, C.green, s.locked || markOn ? 1 : 0.7);
                else Lab.line(ctx, CX, CY, ex, ey, C.amber, 0.45);
                bar(ctx, a, pos, -2, 2, lineOn && markOn ? C.greenBr : C.gold);
            });
            Lab.dot(ctx, CX, CY, C.white);
            [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([ox, oy]) => Lab.dot(ctx, CX + ox, CY + oy, C.gold));
            if (s.flash > 0) drawFlash();
            drawPad(true);
            drawHud(w, lines, marks);
        }
        function renderEnd() {
            ctx.fillStyle = C.void; ctx.fillRect(0, 0, W, H);
            Lab.stars(ctx, 1977, 70);
            // the same pad, big, with the trend drawn through the points once they are all in
            const big = { x: 70, y: 30, w: 190, h: 110 };
            const bx = yr => big.x + (yr / YEARS_MAX) * big.w, by = ly => big.y + big.h - (ly / LY_MAX) * big.h;
            Lab.line(ctx, big.x, big.y + big.h, big.x + big.w, big.y + big.h, C.boneD);
            Lab.line(ctx, big.x, big.y, big.x, big.y + big.h, C.boneD);
            Lab.text(ctx, 'YEARS DEAD', big.x + big.w - Lab.textWidth('YEARS DEAD'), big.y + big.h + 5, C.boneD);
            Lab.text(ctx, 'LIGHT-YEARS DOWN THE HEADING', big.x, big.y - 8, C.boneD);
            const pts = [{ label: 'US', age: 0, ly: 0, col: C.green }].concat(WRECKS.map(wk => ({ label: wk.hull, age: wk.age, ly: wk.ly, col: C.gold })));
            pts.forEach((p, j) => {
                if (endT < 0.3 + j * 0.45) return;
                const px = Math.round(bx(p.age)), py = Math.round(by(p.ly));
                Lab.disc(ctx, px, py, 2.2, 1, p.col);
                if (j === 0) { Lab.text(ctx, p.label, px - 5 - Lab.textWidth(p.label), py - 2, C.green); return; } // our ship, left of the origin
                const lx = px + 4 + Lab.textWidth(p.label) > big.x + big.w + 20 ? px - 4 - Lab.textWidth(p.label) : px + 4;
                Lab.text(ctx, p.label, lx, py - 7, C.amber);
            });
            if (endT > 0.3 + pts.length * 0.45) {
                const f = Math.min(1, (endT - 0.3 - pts.length * 0.45) / 1.2);
                const last = pts[pts.length - 1];
                Lab.line(ctx, bx(0), by(0), bx(0) + (bx(last.age) - bx(0)) * f, by(0) + (by(last.ly) - by(0)) * f, C.greenBr, 0.5);
            }
        }

        // ── input ──
        const cv = ui.canvas;
        cv.onpointerdown = e => {
            const p = ui.toPixel(e);
            if (!onPad(p) || busy()) return;
            s = { ...s, dragging: true };
            try { cv.setPointerCapture(e.pointerId); } catch (err) { /* capture is optional */ }
            setPad(yearsAt(p.x), lyAt(p.y));
        };
        cv.onpointermove = e => {
            const p = ui.toPixel(e);
            hover = onPad(p) && !busy();
            cv.style.cursor = hover || (s && s.dragging) ? 'crosshair' : 'default';
            if (!s || !s.dragging) return;
            if (!e.buttons) { release(); return; }
            setPad(yearsAt(p.x), lyAt(p.y));
        };
        cv.onpointerup = release;
        Lab.onKey((k, e) => {
            if (k === ' ' || k === 'Enter') {
                if (e && e.target && e.target.tagName === 'BUTTON') return;
                advance();
                return;
            }
            const big = e && e.shiftKey ? 10 : 1;
            const step = { ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0], ArrowDown: [0, -1], s: [0, -1], ArrowUp: [0, 1], w: [0, 1] }[k];
            if (step) nudge(step[0] * big, step[1] * big);
        });

        Lab.loop((dt, now) => {
            clock += dt;
            const due = queue.filter(q => q.at <= clock);
            if (due.length) { queue = queue.filter(q => q.at > clock); due.forEach(q => q.fn()); }
            if (ended) { endT += dt; renderEnd(); return; }
            if (held) {
                held = { ...held, wait: held.wait - dt, age: held.age + dt };
                while (held && held.wait <= 0) {
                    const k = held.age > HOLD_FAST_AFTER ? FAST_STEP : 1;
                    nudge(held.dy * k, held.dl * k);
                    held = { ...held, wait: held.wait + HOLD_EVERY };
                }
            }
            const k = Math.min(1, dt * EASE), ease = (a, b) => (Math.abs(b - a) < 0.01 ? b : a + (b - a) * k);
            s = { ...s, d: { y: ease(s.d.y, s.v.y), l: ease(s.d.l, s.v.l) }, flash: Math.max(0, s.flash - dt) };
            const w = WRECKS[s.i];
            if (!s.locked && s.v.y === w.age && s.v.l === w.ly && Math.abs(s.d.y - s.v.y) < 0.02 && Math.abs(s.d.l - s.v.l) < 0.02) lock();
            render(now);
        }, 30);

        startWreck(0);
        render(performance.now());
        return () => { cv.style.cursor = ''; held = null; queue = []; gen++; };
    }

    Lab.register({
        id: 'disc', badge: 'reworked',
        name: 'Date it with the disc',
        short: 'When and where, by pulsars',
        verb: "Move one point across a when-and-where pad until a wreck's fourteen star lines sit on the disc's lines and its marks sit in the notches. Each wreck you date stays on the pad.",
        serves: 'The disc and the time throw: the player plots, with their own hands, that the deeper the wreck, the older it is.',
        replaces: 'The deep-scan tuning dials, and the captain\'s log that explains the time throw.',
        controls: 'Drag on the pad · ←/→ years · ↑/↓ distance · Shift: ×10 · Space: next wreck',
        mount,
    });
})();
