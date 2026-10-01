/* proto-disc.js — Date it with the disc.
   A wreck's last star fix holds fourteen pulsar readings. WHEN: every pulsar slows at its own steady rate, so as you
   change how long ago the fix was taken, each gold mark slides along its line toward the disc's notch. WHERE: from
   further down the heading the pulsars sit at slightly different angles, so as you change the distance the wreck's lines
   swing onto the disc's lines. One point on the chart gets both. Each wreck starts from the last one's point and stays
   on the chart, so the player's own hand keeps moving up and to the right, and the chart zooms out as the wrecks get
   deeper. After the third, the disc fades and the chart opens up with a line through everything the player plotted. */

(function () {
    'use strict';
    const Lab = window.Lab, C = Lab.C, W = Lab.W, H = Lab.H;

    const CX = 108, CY = 88, R = 74;                   // the disc
    const MIN_R = 12;                                  // marks never crowd the centre
    const PAD = { x: 212, y: 36, w: 98, h: 100 };      // the chart, right of the disc
    const BIG = { x: 70, y: 32, w: 190, h: 112 };      // the same chart, opened up at the end
    const MARK_TOL = 1, ANGLE_TOL = 0.012;             // px, rad: "in place". Tight enough that only the exact answer gets 14/14
    const SNAP = 3, SNAP_FRAC = 0.02;                  // letting go this close to the answer (units, or 2% of the chart) settles into it
    const EASE = 12;                                   // how fast the picture follows the chart, per second
    const FRESH = 0.3;                                 // s: ignore moves right after a wreck opens (the second click of a double click)
    const HOLD_DELAY = 0.35, HOLD_EVERY = 0.06, HOLD_FAST_AFTER = 1.1;   // after a long hold, steps grow to 1% of the chart
    const FLASH = 0.5, LINE_GAP = 2.6, ZOOM = 0.9, TREND = 1.3, RESCALE = 6;

    // Fourteen pulsars: angle (degrees), line length (px), notch as a fraction of the length. The torch sketch uses the same.
    const PULSARS = [
        [-176, 70, 0.62], [-151, 46, 0.55], [-129, 60, 0.72], [-104, 38, 0.60], [-83, 66, 0.45],
        [-58, 52, 0.70], [-36, 32, 0.66], [-11, 64, 0.50], [12, 42, 0.74], [35, 58, 0.58],
        [61, 36, 0.52], [92, 68, 0.64], [124, 48, 0.68], [153, 56, 0.48],
    ].map(([deg, len, f]) => ({ a: (deg * Math.PI) / 180, len, notch: Math.round(Math.max(MIN_R + 4, len * f)) }));
    // Per year, how far each mark slides outward (px): every pulsar slows down, so they all go the same way.
    // Per light-year, how far each line swings (radians): near pulsars swing more, either way round.
    const RATES = [0.07, 0.1, 0.14, 0.18, 0.24, 0.3, 0.38, 0.46, 0.55, 0.65, 0.78, 0.92, 1.1, 1.3];
    const SWINGS = [0.0016, 0.0022, 0.003, 0.0038, 0.0046, 0.0055, 0.0064, 0.0074, 0.0085, 0.0096, 0.011, 0.0122, 0.0136, 0.015];

    const WRECKS = [
        {
            num: '4', sector: 1, age: 21, ly: 9, seed: 4, range: { y: 50, l: 20 },
            intro: [['A.U.R.A.', "EXODUS-4's last star fix, Commander. It can tell us when the ship died."],
                ['Mira', "Move the point on the chart until the wreck's lines and marks fit the disc."]],
            locked: [['Aris', 'Twenty-one years. We were still asleep when they died.']],
        },
        {
            num: '980', sector: 3, age: 104, ly: 61, seed: 980, range: { y: 200, l: 80 },
            intro: [['Vance', 'Hull 980. Only eight ships launched before us.']],
            locked: [['Mira', "A hundred and four years. That can't be right. A higher number should be newer."]],
        },
        {
            num: '30,211', sector: 6, age: 396, ly: 188, seed: 30211, range: { y: 500, l: 200 },
            intro: [['Jaxon', 'Hull 30,211. How many ships did they send?']],
            locked: [['Vance', 'Four hundred years ago there was no Exodus programme.'],
                ['A.U.R.A.', 'Three hundred and ninety-six years, Commander. The reading is correct.']],
        },
    ];
    const LAST = WRECKS[WRECKS.length - 1];         // each chart range keeps years : light-years at 5 : 2, so the trend keeps its angle
    const onPad = p => p.x >= PAD.x - 4 && p.x <= PAD.x + PAD.w + 4 && p.y >= PAD.y - 4 && p.y <= PAD.y + PAD.h + 4;

    function shuffled(list, rnd) {
        const out = list.slice();
        for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
        return out;
    }
    // The two figures engraved on the disc (the torch sketch draws the same pair), placed where no line of the disc crosses.
    const FIGS = [{ x: 114, y: 128, rows: ['#.........', '#...###...', '#..#####..', '#...###...', '.#...#....', '..########', '...#####.#',
        '...#####.#', '...#####.#', '....###..#', '....###...', '....#.#...', '....#.#...', '....#.#...', '....#.#...', '....#.#...', '...##.##..'] },
    { x: 126, y: 128, rows: ['.......', '..###..', '.#####.', '.#####.', '.#####.', '...#...', '.#####.', '#.###.#', '#.###.#',
        '#.###.#', '..###..', '..#.#..', '..#.#..', '..#.#..', '..#.#..', '..#.#..', '.##.##.'] }];

    /** A short bar across a line at angle `a`, distance `pos` from the centre, from `from` to `to` px either side. */
    function bar(c, a, pos, from, to, color) {
        const dx = Math.cos(a), dy = Math.sin(a), bx = CX + dx * pos, by = CY + dy * pos;
        for (let o = from; o <= to; o++) Lab.dot(c, bx - dy * o, by + dx * o, color);
    }

    function drawDisc(b) {                                  // the disc itself, painted once: a calm face, a gold rim, engraved lines
        b.fillStyle = C.void; b.fillRect(0, 0, W, H);
        Lab.stars(b, 1977, 80);
        Lab.disc(b, CX, CY, R + 3, 1, C.void);
        Lab.disc(b, CX, CY, R, 1, C.ink2);
        Lab.ring(b, CX, CY, R, C.gold);
        Lab.ring(b, CX, CY, R + 1, C.amber);
        FIGS.forEach(f => f.rows.forEach((row, ry) => [...row].forEach((c, rx) => { if (c === '#') Lab.dot(b, f.x + rx, f.y + ry, C.line2); })));
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
        const focused = document.activeElement;
        if (focused && focused.classList && focused.classList.contains('pick')) focused.blur();   // so Space does not reopen the list item

        let s = null, held = null, hover = false, ended = false, endReady = false, endT = 0, gen = 0, clock = 0;
        let view = { ...WRECKS[0].range };                  // the chart's range on screen: it zooms out as the wrecks get deeper
        let plotted = [];                                   // wrecks already dated: they stay on the chart
        let queue = [];
        const later = (sec, fn) => { const g = gen; queue = queue.concat({ at: clock + sec, fn: () => g === gen && fn() }); };
        const busy = () => ended || !s || s.locked;
        const fresh = () => clock - s.born < FRESH;
        /** Pixel position of (years, light-years) on a chart drawn in box b. */
        const toChart = (b, yr, ly) => ({ x: Math.round(b.x + (yr / view.y) * b.w), y: Math.round(b.y + b.h - (ly / view.l) * b.h) });
        const yearsAt = x => Math.round(((x - PAD.x) / PAD.w) * view.y);
        const lyAt = y => Math.round(((PAD.y + PAD.h - y) / PAD.h) * view.l);

        function startWreck(i, from) {
            gen++; queue = []; held = null;
            const w = WRECKS[i], rnd = Lab.rng(w.seed);
            const rates = shuffled(RATES, rnd), swings = shuffled(SWINGS, rnd).map(k => (rnd() < 0.5 ? -k : k));
            s = { i, v: from, d: from, locked: false, ready: false, moved: false, dragging: false, flash: 0, rates, swings, born: clock };
            ui.say(w.intro[0][0], w.intro[0][1]);
            w.intro.slice(1).forEach(([who, line], j) => later(2.6 * (j + 1), () => ui.say(who, line)));
            showButtons();
        }
        function restart() { ended = false; endReady = false; plotted = []; startWreck(0, { y: 0, l: 0 }); }   // the first fix starts from us
        function advance() {
            if (ended) { if (endReady) restart(); return; }
            if (s.ready) startWreck(s.i + 1, { y: WRECKS[s.i].age, l: WRECKS[s.i].ly });
        }
        function setPad(y, l) {
            if (busy()) return;
            const r = WRECKS[s.i].range;
            s = { ...s, moved: true, v: { y: Lab.clamp(Math.round(y), 0, r.y), l: Lab.clamp(Math.round(l), 0, r.l) } };
        }
        const nudge = (dy, dl) => { if (!busy()) setPad(s.v.y + dy, s.v.l + dl); };
        function release() {
            if (!s || !s.dragging) return;
            const w = WRECKS[s.i], tol = k => Math.max(SNAP, w.range[k] * SNAP_FRAC);
            const near = Math.abs(s.v.y - w.age) <= tol('y') && Math.abs(s.v.l - w.ly) <= tol('l');
            s = { ...s, dragging: false, v: !s.locked && near ? { y: w.age, l: w.ly } : s.v };
        }
        function lock() {
            const w = WRECKS[s.i];
            gen++; queue = [];                              // an intro line still waiting would now be out of place
            s = { ...s, locked: true, dragging: false, flash: FLASH, d: { ...s.v } };
            held = null; hover = false;
            plotted = plotted.concat(w);
            showButtons();
            w.locked.forEach(([who, line], j) => later(0.4 + j * LINE_GAP, () => ui.say(who, line)));
            const lastLine = 0.4 + (w.locked.length - 1) * LINE_GAP;
            if (w === LAST) later(lastLine + 1.6, finish);  // the chart opens under A.U.R.A.'s reading
            else later(lastLine, () => { s = { ...s, ready: true }; showButtons(); });   // the next wreck waits for the line
        }
        function finish() {
            ended = true; endT = 0;
            const t = ZOOM + TREND + 0.6;                   // let the player see the chart before anyone speaks
            later(t, () => ui.say('Mira', "We're still flying down that line."));
            later(t + 2.4, () => { ui.say('A.U.R.A.', 'Our heading has not changed, Commander.'); endReady = true; showButtons(); });
        }

        function showButtons() {
            if (ended) return ui.buttons(endReady ? [{ label: 'Run it again', primary: true, onClick: advance }] : []);
            if (s.locked) return ui.buttons(s.ready ? [{ label: 'Next wreck', primary: true, onClick: advance }] : []);
            ui.buttons([[-1, 0, 'Fewer years'], [1, 0, 'More years'], [0, -1, 'Nearer'], [0, 1, 'Farther']].map(([dy, dl, label]) => ({
                label, hold: true,
                onDown: () => { if (busy() || fresh()) return; nudge(dy, dl); held = { dy, dl, wait: HOLD_DELAY, age: 0 }; },
                onUp: () => { held = null; },
            })));
        }

        // ── drawing ──
        const right = (str, x, y, color, scale = 1) => Lab.text(ctx, str, x - Lab.textWidth(str, scale), y, color, scale);
        const centre = (str, x, y, color) => Lab.text(ctx, str, Math.round(x - Lab.textWidth(str) / 2), y, color);
        const two = n => String(n).padStart(2, '0');

        /** The wreck's fourteen lines and marks over the disc. Returns how many of each are in place. */
        function drawFix() {
            const w = WRECKS[s.i];
            let lines = 0, marks = 0;
            ctx.drawImage(bg, 0, 0);
            PULSARS.forEach((p, j) => {
                const off = s.swings[j] * (s.d.l - w.ly), a = p.a + off;
                const want = p.notch + s.rates[j] * (s.d.y - w.age);
                const lineOn = Math.abs(off) < ANGLE_TOL, markOn = Math.abs(want - p.notch) < MARK_TOL;
                lines += lineOn ? 1 : 0;
                marks += markOn ? 1 : 0;
                Lab.line(ctx, CX, CY, CX + Math.cos(a) * p.len, CY + Math.sin(a) * p.len, lineOn ? C.green : C.amber);
                if (want >= MIN_R && want <= p.len) bar(ctx, a, want, -2, 2, markOn ? C.greenBr : C.gold);
                else bar(ctx, a, Lab.clamp(want, MIN_R, p.len), -1, 1, C.boneD);          // off the end of its line: years are far out
            });
            Lab.dot(ctx, CX, CY, C.white);
            return { lines, marks };
        }
        /** The chart in box b: with the cursor while dating, or with the trend drawn `trend` (0..1) of the way at the end. */
        function drawChart(b, showCursor, trend = 0) {
            const o = toChart(b, 0, 0), top = toChart(b, view.y, view.l);
            ctx.fillStyle = C.void; ctx.fillRect(o.x - 18, top.y - 9, top.x - o.x + 22, o.y - top.y + 18);   // no stars posing as data
            for (let i = 1; i < 5; i++) for (let j = 1; j < 4; j++) Lab.dot(ctx, Math.round(b.x + (b.w * i) / 5), Math.round(b.y + (b.h * j) / 4), C.line2);
            if (trend > 0) {                                // a dotted line from us, through the deepest wreck, to the chart's edge
                const k = Math.min(view.y / LAST.age, view.l / LAST.ly) * trend, q = toChart(b, LAST.age * k, LAST.ly * k);
                Lab.line(ctx, o.x, o.y, q.x, q.y, C.greenBr, 0.5);
            }
            if (showCursor) {
                const c = toChart(b, s.d.y, s.d.l);
                Lab.line(ctx, c.x, top.y, c.x, o.y - 1, C.line2);
                Lab.line(ctx, o.x + 1, c.y, top.x, c.y, C.line2);
            }
            Lab.line(ctx, o.x, o.y, top.x, o.y, C.boneD);
            Lab.line(ctx, o.x, top.y, o.x, o.y, C.boneD);
            Lab.text(ctx, 'LY DOWN THE HEADING', o.x, top.y - 8, C.boneD);
            right(String(Math.round(view.l)), o.x - 3, top.y, C.boneD);
            Lab.text(ctx, '0', o.x - 1, o.y + 3, C.boneD);
            centre('YEARS DEAD', (o.x + top.x) / 2, o.y + 3, C.boneD);
            right(String(Math.round(view.y)), top.x, o.y + 3, C.boneD);
            Lab.disc(ctx, o.x + 1, o.y - 1, 1.6, 1, C.green);                        // us: alive, and where we started
            right('US', o.x - 8, o.y - 5, C.green);
            plotted.forEach(wk => {
                const p = toChart(b, wk.age, wk.ly), tw = Lab.textWidth(wk.num), lx = p.x + 4 + tw > top.x ? p.x - 4 - tw : p.x + 4;
                ctx.fillStyle = C.void; ctx.fillRect(lx - 1, p.y - 7, tw + 2, 7);       // keep lines from showing through the digits
                Lab.text(ctx, wk.num, lx, p.y - 6, C.amber);
                Lab.disc(ctx, p.x, p.y, 1.8, 1, C.gold);
            });
            if (!showCursor) return;
            const c = toChart(b, s.d.y, s.d.l), col = s.locked ? C.greenBr : s.dragging || hover ? C.gold : C.amber;
            Lab.ring(ctx, c.x, c.y, 3, col);
            Lab.dot(ctx, c.x, c.y, col);
            if (!s.moved && !s.locked && Math.floor(clock * 2) % 2) Lab.ring(ctx, c.x, c.y, 5, C.gold);   // this is the thing you move
        }
        function drawHud(w, lines, marks) {
            Lab.text(ctx, 'EXODUS', 6, 6, C.boneD);
            Lab.text(ctx, w.num, 6, 13, C.bone, 2);
            Lab.text(ctx, 'SECTOR ' + w.sector, 6, 26, C.boneD);
            const y0 = PAD.y + PAD.h + 12, val = s.locked ? C.greenBr : C.bone, rx = PAD.x + PAD.w;
            Lab.text(ctx, 'YEARS', PAD.x, y0, C.boneD);
            right(String(s.v.y), PAD.x + 38, y0, val);
            Lab.text(ctx, 'LY', PAD.x, y0 + 9, C.boneD);
            right(String(s.v.l), PAD.x + 38, y0 + 9, val);
            // each counter sits on the row of the axis that moves it, in the colour of what it counts
            right(two(marks) + '/14', rx, y0, marks === 14 ? C.green : C.bone);
            right('MARKS', rx - 24, y0, marks === 14 ? C.green : C.gold);
            right(two(lines) + '/14', rx, y0 + 9, lines === 14 ? C.green : C.bone);
            right('LINES', rx - 24, y0 + 9, lines === 14 ? C.green : C.amber);
            if (s.locked) right('DATED', W - 6, 6, C.greenBr, 2);
        }
        function drawFlash() {
            const a = s.flash / FLASH;
            Lab.disc(ctx, CX, CY, R + 2, d => a * 0.45 * (1 - d * 0.6), C.greenBr);
            Lab.ring(ctx, CX, CY, (1 - a) * (R + 12) + 4, C.greenBr, 0.9);
        }
        function render() {
            const { lines, marks } = drawFix();
            if (s.flash > 0) drawFlash();
            drawChart(PAD, true);
            drawHud(WRECKS[s.i], lines, marks);
        }
        function renderEnd() {                              // the disc dissolves and the chart the player filled in opens up
            const z = Math.min(1, endT / ZOOM), e = z * z * (3 - 2 * z);
            drawFix();
            Lab.disc(ctx, CX, CY, R + 3, e, C.void);
            const b = { x: Lab.lerp(PAD.x, BIG.x, e), y: Lab.lerp(PAD.y, BIG.y, e), w: Lab.lerp(PAD.w, BIG.w, e), h: Lab.lerp(PAD.h, BIG.h, e) };
            drawChart(b, false, Lab.clamp((endT - ZOOM) / TREND, 0, 1));
        }

        // ── input ──
        const cv = ui.canvas;
        cv.onpointerdown = e => {
            const p = ui.toPixel(e);
            if (!onPad(p) || busy() || fresh()) return;
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
                if (e && e.target && e.target.classList && e.target.classList.contains('pick')) return;   // the list item handles it
                if (e) e.preventDefault();                  // one press, one step, whichever button has focus
                advance();
                return;
            }
            const step = { ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0], ArrowDown: [0, -1], s: [0, -1], ArrowUp: [0, 1], w: [0, 1] }[k];
            const big = e && e.shiftKey ? 10 : 1;
            if (step) nudge(step[0] * big, step[1] * big);
        });

        Lab.loop(dt => {
            clock += dt;
            const due = queue.filter(q => q.at <= clock);
            if (due.length) { queue = queue.filter(q => q.at > clock); due.forEach(q => q.fn()); }
            if (ended) { endT += dt; renderEnd(); return; }
            if (held) {
                held = { ...held, wait: held.wait - dt, age: held.age + dt };
                const r = WRECKS[s.i].range, fast = held.age > HOLD_FAST_AFTER;
                while (held && held.wait <= 0) {
                    nudge(held.dy * (fast ? Math.max(1, Math.round(r.y / 100)) : 1), held.dl * (fast ? Math.max(1, Math.round(r.l / 100)) : 1));
                    held = { ...held, wait: held.wait + HOLD_EVERY };
                }
            }
            const k = Math.min(1, dt * EASE), ease = (a, b) => (Math.abs(b - a) < 0.01 ? b : a + (b - a) * k);
            s = { ...s, d: { y: ease(s.d.y, s.v.y), l: ease(s.d.l, s.v.l) }, flash: Math.max(0, s.flash - dt) };
            const w = WRECKS[s.i], kz = Math.min(1, dt * RESCALE);
            const zoom = (a, b) => a * Math.pow(b / a, kz);    // even in ratio, so 50→200 and 500→50 take about as long
            view = Math.abs(view.y / w.range.y - 1) < 0.01 ? { ...w.range } : { y: zoom(view.y, w.range.y), l: zoom(view.l, w.range.l) };
            if (!s.locked && s.v.y === w.age && s.v.l === w.ly && Math.abs(s.d.y - s.v.y) < 0.02 && Math.abs(s.d.l - s.v.l) < 0.02) lock();
            render();
        }, 30);

        restart();
        render();
        return () => { cv.style.cursor = ''; held = null; queue = []; gen++; };
    }

    Lab.register({
        id: 'disc', badge: 'reworked',
        name: 'Date it with the disc',
        short: 'When and where, by pulsars',
        verb: "Move one point on a chart of years dead against light-years down the heading, until a wreck's fourteen star lines sit on the disc's lines and its marks sit in the notches. Each wreck you date stays on the chart.",
        serves: 'The disc and the time throw: the player plots, with their own hands, that the deeper the wreck, the older it is.',
        replaces: 'The deep-scan tuning dials, and the captain\'s log that explains the time throw.',
        controls: 'Drag on the chart · ←/→ years · ↑/↓ distance · Shift: ×10 · Space: next',
        mount,
    });
})();
