/* proto-disc.js — Date it with the disc.
   The 1977 disc's pulsar map, drawn big: fourteen lines from one point, each with a notch (the disc's value).
   Over it, a wreck's star fix: one bright tick per line. One YEARS dial slides every tick along its line at its
   own rate. Only one value puts all fourteen in their notches; that value is how long the wreck has been dead. */

(function () {
    'use strict';
    const Lab = window.Lab, C = Lab.C, W = Lab.W, H = Lab.H;

    const CX = 160, CY = 82, R = 74;              // the disc, centred
    const MIN_R = 12;                              // ticks never crowd the centre
    const YEARS_MAX = 500;
    const TRACK = { x0: 34, x1: 290, y: 164 };     // the YEARS dial along the bottom
    const HIT_Y = TRACK.y - 14;                    // pointer below this line grabs the dial
    const ON_TOL = 0.5;                            // a tick is "on" within half a pixel of its notch
    const SNAP = 2;                                // letting go this close to the answer settles into it
    const EASE = 14;                               // how fast the ticks follow the dial, per second
    const HOLD_DELAY = 0.35, HOLD_EVERY = 0.07;    // on-screen buttons repeat while held
    const FLASH = 0.45, LINE_GAP = 2.6;            // lock flash length; seconds between spoken lines

    // Fourteen pulsars: angle (degrees), line length (px), notch as a fraction of the length.
    const PULSARS = [
        [-176, 70, 0.62], [-151, 46, 0.55], [-129, 60, 0.72], [-104, 38, 0.60], [-83, 66, 0.45],
        [-58, 52, 0.70], [-36, 32, 0.66], [-11, 64, 0.50], [12, 42, 0.74], [35, 58, 0.58],
        [61, 36, 0.52], [92, 68, 0.64], [124, 48, 0.68], [153, 56, 0.48],
    ].map(([deg, len, f]) => {
        const a = (deg * Math.PI) / 180;
        return { dx: Math.cos(a), dy: Math.sin(a), px: -Math.sin(a), py: Math.cos(a), len, notch: Math.round(Math.max(MIN_R + 4, len * f)) };
    });
    // How far each tick slides per year of dial (px). Each wreck deals these out in its own order and directions.
    const RATES = [0.07, 0.1, 0.14, 0.18, 0.24, 0.3, 0.38, 0.46, 0.55, 0.65, 0.78, 0.92, 1.1, 1.3];

    const WRECKS = [
        {
            hull: 'EXODUS-4', num: '4', sector: 1, age: 21, seed: 4,
            intro: [['A.U.R.A.', 'Star fix loaded from EXODUS-4, Commander. Sector one.'],
                ['Mira', 'Slide the years until every bright mark sits in its notch.']],
            locked: [['Aris', 'Twenty years. That matches the briefing.']],
        },
        {
            hull: 'EXODUS-980', num: '980', sector: 3, age: 104, seed: 980,
            intro: [['Vance', "Hull number 980. Let's see how long it's been out here."]],
            locked: [['Mira', "That can't be right. A higher number should be newer."]],
        },
        {
            hull: 'EXODUS-30,211', num: '30,211', sector: 6, age: 396, seed: 30211,
            intro: [['A.U.R.A.', 'Star fix loaded from EXODUS-30,211, Commander. Sector six.']],
            locked: [['Vance', 'Four hundred years. And it has a higher number than us.'],
                ['A.U.R.A.', 'The reading is correct, Commander.']],
        },
    ];
    // The closing readout: our own hull first, then the three we dated.
    const SUMMARY = [['EXODUS-9', null, C.green], ['EXODUS-4', 21, C.bone], ['EXODUS-980', 104, C.amber], ['EXODUS-30,211', 396, C.red]];

    const xOf = yr => Math.round(TRACK.x0 + (yr / YEARS_MAX) * (TRACK.x1 - TRACK.x0));
    const yearAt = x => Lab.clamp(Math.round(((x - TRACK.x0) / (TRACK.x1 - TRACK.x0)) * YEARS_MAX), 0, YEARS_MAX);

    function shuffled(list, rnd) {
        const out = list.slice();
        for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
        return out;
    }
    /** Where pulsar p's tick sits (px from centre) with the dial at `years`. It slides at `rate` and bounces off the line's ends. */
    function tickAt(p, rate, years, age) {
        const span = p.len - MIN_R;
        let u = (((p.notch - MIN_R + rate * (years - age)) % (2 * span)) + 2 * span) % (2 * span);
        if (u > span) u = 2 * span - u;
        return MIN_R + u;
    }
    /** A short bar across pulsar p's line at distance `pos`, from offset `from` to `to` (px, perpendicular). */
    function bar(c, p, pos, from, to, color) {
        const bx = CX + p.dx * pos, by = CY + p.dy * pos;
        for (let o = from; o <= to; o++) Lab.dot(c, bx + p.px * o, by + p.py * o, color);
    }
    const lineEnd = p => [CX + p.dx * p.len, CY + p.dy * p.len];

    function drawDisc(b) {
        b.fillStyle = C.void; b.fillRect(0, 0, W, H);
        Lab.stars(b, 1977, 80);
        Lab.disc(b, CX, CY, R + 3, 1, C.void);                          // the disc hides the stars behind it
        Lab.disc(b, CX, CY, R, d => (d < 0.8 ? 0 : 0.03 + 0.3 * ((d - 0.8) / 0.2) ** 2), C.amber); // dark face, dusty gold rim
        for (let r = 20; r < R - 8; r += 10) Lab.ring(b, CX, CY, r, C.amber, 0.12);                 // faint grooves
        Lab.ring(b, CX, CY, R, C.gold, 0.75);
        Lab.ring(b, CX, CY, R + 1, C.amber, 0.35);
        PULSARS.forEach(p => {
            const [ex, ey] = lineEnd(p);
            Lab.line(b, CX, CY, ex, ey, C.boneD);
            bar(b, p, p.notch, -3, -2, C.bone);                         // the notch: two stubs either side of the line
            bar(b, p, p.notch, 2, 3, C.bone);
        });
    }

    function mount(ctx, ui) {
        const bg = document.createElement('canvas');
        bg.width = W; bg.height = H;
        drawDisc(bg.getContext('2d'));

        let s = null, held = null, hover = false, ended = false, endT = 0, reached = 0, gen = 0, clock = 0;
        let queue = [];
        const later = (sec, fn) => { const g = gen; queue = queue.concat({ at: clock + sec, fn: () => g === gen && fn() }); };
        const busy = () => ended || !s || s.locked;

        function startWreck(i) {
            gen++; queue = []; held = null; ended = false;
            const w = WRECKS[i], rnd = Lab.rng(w.seed);
            const rates = shuffled(RATES, rnd).map(k => (rnd() < 0.5 ? -k : k));
            s = { i, v: 0, d: 0, locked: false, dragging: false, flash: 0, rates };
            ui.say(w.intro[0][0], w.intro[0][1]);
            w.intro.slice(1).forEach(([who, line], j) => later(1.4 * (j + 1), () => ui.say(who, line)));
            showButtons();
        }
        function restart() { reached = 0; startWreck(0); }
        function setDial(v) { if (!busy()) s = { ...s, v: Lab.clamp(Math.round(v), 0, YEARS_MAX) }; }
        const nudge = step => { if (!busy()) setDial(s.v + step); };
        function release() {
            if (!s || !s.dragging) return;
            const age = WRECKS[s.i].age;
            s = { ...s, dragging: false, v: !s.locked && Math.abs(s.v - age) <= SNAP ? age : s.v };
        }
        function advance() {
            if (ended) restart();
            else if (s && s.locked && s.i < WRECKS.length - 1) startWreck(s.i + 1);
        }

        function lock() {
            const w = WRECKS[s.i], last = s.i === WRECKS.length - 1;
            s = { ...s, locked: true, dragging: false, flash: FLASH, d: s.v };
            held = null;
            reached = Math.max(reached, s.i + 1);
            showButtons();
            w.locked.forEach(([who, line], j) => later(0.45 + j * LINE_GAP, () => ui.say(who, line)));
            if (last) later(0.45 + w.locked.length * LINE_GAP + 0.5, finish);
        }
        function finish() {
            ended = true; endT = 0;
            ui.say('', 'The further down the heading, the older the dead.');
            showButtons();
        }

        function showButtons() {
            if (ended) return ui.buttons([{ label: 'Run it again', primary: true, onClick: restart }]);
            const lastLocked = s.locked && s.i === WRECKS.length - 1;
            const dial = [[-10, '−10 yrs'], [-1, '−1'], [1, '+1'], [10, '+10 yrs']].map(([step, label]) => ({
                label, hold: true, disabled: s.locked,
                onDown: () => { if (busy()) return; nudge(step); held = { step, wait: HOLD_DELAY }; },
                onUp: () => { held = null; },
            }));
            const wrecks = WRECKS.map((w, i) => ({
                label: w.hull,
                disabled: lastLocked || i > reached,
                primary: s.locked ? i === s.i + 1 : i === s.i,
                onClick: () => startWreck(i),
            }));
            ui.buttons(dial.concat(wrecks));
        }

        // ── drawing ──
        function sweep(t) {                                             // a faint slow light crossing the disc
            const bx = CX - R + ((t / 8000) % 1) * 2 * R;
            for (let x = Math.ceil(bx - 5); x <= bx + 5; x++) {
                const half = Math.sqrt(Math.max(0, R * R - (x - CX) * (x - CX)));
                Lab.shade(ctx, x, CY - half, 1, half * 2, 0.07 * (1 - Math.abs(x - bx) / 5), C.gold);
            }
        }
        const right = (str, y, color, scale = 1) => Lab.text(ctx, str, W - 6 - Lab.textWidth(str, scale), y, color, scale);

        function drawHud(w, on) {
            Lab.text(ctx, 'EXODUS', 6, 6, C.boneD);
            Lab.text(ctx, w.num, 6, 13, C.bone, 2);
            Lab.text(ctx, 'SECTOR ' + w.sector, 6, 26, C.boneD);
            if (s.locked) {
                right('AGE', 6, C.green);
                right(w.age + ' YRS', 13, C.greenBr, 2);
                right('MATCH 14/14', 26, C.green);
            } else {
                right('DIAL', 6, C.boneD);
                right(s.v + ' YRS', 13, C.amber, 2);
                right('MATCH ' + String(on).padStart(2, '0') + '/14', 26, on >= 10 ? C.green : C.boneD);
            }
        }
        function drawDial() {
            const { x0, x1, y } = TRACK;
            Lab.text(ctx, 'YEARS', 6, y - 2, C.boneD);
            Lab.line(ctx, x0, y, x1, y, C.line2);
            for (let yr = 0; yr <= YEARS_MAX; yr += 10) {
                const x = xOf(yr);
                if (yr % 100) { Lab.dot(ctx, x, y + 1, C.line2); continue; }
                Lab.line(ctx, x, y + 1, x, y + 2, C.boneD);
                Lab.text(ctx, String(yr), x - Math.floor(Lab.textWidth(String(yr)) / 2), y + 5, C.boneD);
            }
            const tx = xOf(s.v), col = s.locked ? C.greenBr : s.dragging || hover ? C.gold : C.amber;
            Lab.line(ctx, x0, y, tx, y, col, 0.5);
            Lab.line(ctx, tx, y - 5, tx, y + 2, col);
            Lab.line(ctx, tx - 1, y - 5, tx + 1, y - 5, col);
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
            let on = 0;
            PULSARS.forEach((p, j) => {
                const pos = tickAt(p, s.rates[j], s.d, w.age), hit = Math.abs(pos - p.notch) < ON_TOL;
                if (hit) { on++; const [ex, ey] = lineEnd(p); Lab.line(ctx, CX, CY, ex, ey, C.green, s.locked ? 1 : 0.6); }
                bar(ctx, p, pos, -2, 2, hit ? C.greenBr : C.gold);
            });
            Lab.dot(ctx, CX, CY, C.white);
            [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([ox, oy]) => Lab.dot(ctx, CX + ox, CY + oy, C.gold));
            if (s.flash > 0) drawFlash();
            drawHud(w, on);
            drawDial();
        }
        function renderEnd() {
            ctx.fillStyle = C.void; ctx.fillRect(0, 0, W, H);
            Lab.stars(ctx, 1977, 80);
            const hx = 58, ageRight = 160, barX = 168, barMax = 96;
            Lab.text(ctx, 'HULL', hx, 46, C.boneD);
            Lab.text(ctx, 'YEARS DEAD', ageRight - Lab.textWidth('YEARS DEAD'), 46, C.boneD);
            SUMMARY.forEach(([hull, age, col], j) => {
                const shown = endT - 0.3 - j * 0.5;
                if (shown < 0) return;
                const y = 60 + j * 14;
                Lab.text(ctx, hull, hx, y, col);
                if (age === null) { Lab.text(ctx, '-', ageRight - 3, y, col); Lab.text(ctx, 'US', barX, y, col); return; }
                Lab.text(ctx, String(age), ageRight - Lab.textWidth(String(age)), y, col);
                const len = Math.round((age / 396) * barMax * Math.min(1, shown / 0.6));
                if (len < 1) return;
                Lab.line(ctx, barX, y + 1, barX + len - 1, y + 1, col);
                Lab.shade(ctx, barX, y + 2, len, 2, 0.35, col);
            });
        }

        // ── input ──
        const cv = ui.canvas;
        cv.onpointerdown = e => {
            const p = ui.toPixel(e);
            if (p.y < HIT_Y || busy()) return;
            s = { ...s, dragging: true };
            try { cv.setPointerCapture(e.pointerId); } catch (err) { /* capture is optional */ }
            setDial(yearAt(p.x));
        };
        cv.onpointermove = e => {
            const p = ui.toPixel(e);
            hover = p.y >= HIT_Y && !busy();
            cv.style.cursor = hover || (s && s.dragging) ? 'ew-resize' : '';
            if (!s || !s.dragging) return;
            if (!e.buttons) { release(); return; }
            setDial(yearAt(p.x));
        };
        cv.onpointerup = release;
        Lab.onKey((k, e) => {
            if (k === ' ' || k === 'Enter') {
                if (e && e.target && e.target.tagName === 'BUTTON') return;     // the focused button handles it
                advance();
                return;
            }
            const step = { ArrowLeft: -1, a: -1, ArrowRight: 1, d: 1, ArrowDown: -10, ArrowUp: 10 }[k];
            if (step) nudge(e && e.shiftKey && Math.abs(step) === 1 ? step * 10 : step);
        });

        Lab.loop((dt, now) => {
            clock += dt;
            const due = queue.filter(q => q.at <= clock);
            if (due.length) { queue = queue.filter(q => q.at > clock); due.forEach(q => q.fn()); }
            if (ended) { endT += dt; renderEnd(); return; }
            if (held) {
                held = { ...held, wait: held.wait - dt };
                while (held && held.wait <= 0) { nudge(held.step); held = { ...held, wait: held.wait + HOLD_EVERY }; }
            }
            const diff = s.v - s.d;
            s = { ...s, d: Math.abs(diff) < 0.01 ? s.v : s.d + diff * Math.min(1, dt * EASE), flash: Math.max(0, s.flash - dt) };
            if (!s.locked && s.v === WRECKS[s.i].age && Math.abs(s.d - s.v) < 0.02) lock();
            render(now);
        }, 30);

        startWreck(0);
        render(performance.now());
        return () => { cv.style.cursor = ''; held = null; queue = []; gen++; };
    }

    Lab.register({
        id: 'disc',
        name: 'Date it with the disc',
        short: 'Date a wreck by pulsars',
        verb: "Turn one years dial until a wreck's fourteen star marks sit in the disc's notches, then read how long it has been dead.",
        serves: 'The disc and the time throw: the deeper the wreck, the higher its hull number and the older it is.',
        replaces: 'The deep-scan tuning dials.',
        controls: 'Drag the dial · ←/→ one year · ↑/↓ ten years · Space: next wreck',
        mount,
    });
})();
