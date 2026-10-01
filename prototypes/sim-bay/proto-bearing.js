/* proto-bearing.js — Take a bearing.
   The sector map as the game draws it, with one hand-made story planet hidden among the random ones (they are placed
   around it, never on it). Its wreck's beacon is too faint for the map, so: swing the dish until the signal peaks, lock
   the bearing, move to another planet (one stop), take another. Where the lines cross sits a 2-sigma error ellipse; it
   must fit inside the half-light-year search circle. A bearing's "give or take" comes from how strong the signal was
   when you locked it. While you sweep, the dish leaves a phosphor trace round your planet: what it heard, by bearing. */

(function () {
    'use strict';
    const Lab = window.Lab, C = Lab.C, W = Lab.W, H = Lab.H;

    const LY_PER_PX = 0.06;                           // the map is about nineteen light-years across
    const STOPS = 3;                                  // the jump window stays open for three stops, as in the game
    const BEAM = 6;                                   // the dish's main lobe, degrees (1 sigma: about 14° wide at half power)
    const FLOOR = 0.07, FAST_NOISE = 0.5, SLOW_NOISE = 0.35;   // meter level with nothing in the beam; static before filtering
    const FOUND_LY = 0.5, SEARCH_PX = 9;              // a fix this tight (as shown, to 0.1 ly) can be searched; its circle on the map
    const TURN_SLOW = 8, TURN_FAST = 55, RAMP_S = 0.9, HOLD_DELAY = 0.25;   // degrees a second while a turn is held
    const GLOW_S = 3, GLOW_FLOOR = 0.18;              // how long the dish's trace lingers, and the meter level it ignores
    const TRAVEL_S = 1.4, LINE_GAP = 2.6, TRACE = 66;
    const BOX = { x0: 22, x1: 298, y0: 44, y1: 146 };  // where planets may sit, clear of the readouts
    const PLANET_GAP = 40, STORY_CLEAR = 30;          // random planets keep this far from each other and from the story planet
    const NAMES = ['HELIOS', 'KRYOS', 'TITAN', 'AEA', 'ZEPHYR', 'NYX', 'EREBUS', 'ATLAS', 'PHOEBE', 'CHRONOS'];
    const PLANET_COLS = [C.bone, C.amber, C.violet, C.boneD, C.red];

    const WRECKS = [
        { sector: 2, hull: 'EXODUS-8', title: 'THE LAST OF THE EIGHT', neb: C.violet, nebA: 0.13, pips: 8,
            react: ['Aris', "That's the eighth ship. The last one that left before us."],
            close: 'EXODUS-8 lies on its side. Its beacon has called for twenty years.' },
        { sector: 3, hull: 'EXODUS-980', title: 'MORE THAN EIGHT', neb: C.greenD, nebA: 0.28, pips: 20,
            react: ['Vance', 'Hull number 980. They told us eight ships went before us.'],
            close: 'EXODUS-980 came down about a century ago. Its beacon is failing.' },
        { sector: 6, hull: 'EXODUS-30,211', title: 'CLOSE TO THE LIGHT', neb: C.amber, nebA: 0.09, pips: 40, light: true,
            react: ['Mira', 'It got this close to the light. Almost four hundred years ago.'],
            close: 'EXODUS-30,211 faces the light. Only its beacon still works.' },
    ];
    const ARRIVE = { 2: 'Two stops left. Then we have to jump.', 1: 'One stop left before we jump.', 0: 'Last stop. We jump after this bearing.' };

    const rad = d => (d * Math.PI) / 180;
    const norm = d => ((d % 360) + 360) % 360;
    const angDiff = (a, b) => ((a - b + 540) % 360) - 180;
    const dist = (p, q) => Math.hypot(q.x - p.x, q.y - p.y);
    const bearingTo = (p, q) => norm((Math.atan2(q.x - p.x, p.y - q.y) * 180) / Math.PI);   // 000 is up the map, clockwise
    const pad3 = d => String(Math.round(norm(d)) % 360).padStart(3, '0');
    const ly = px => (px * LY_PER_PX).toFixed(1);

    /** The story planet first, then random planets around it, then a start planet that can see it from far enough away. */
    function makeLayout(seed) {
        for (let tries = 0; ; tries++) {
            const rnd = Lab.rng(seed * 7919 + tries * 977 + 13);
            const B = { x: Math.round(60 + rnd() * 200), y: Math.round(52 + rnd() * 82) }, planets = [];
            for (let k = 0; k < 400 && planets.length < 6; k++) {
                const p = { x: Math.round(BOX.x0 + rnd() * (BOX.x1 - BOX.x0)), y: Math.round(BOX.y0 + rnd() * (BOX.y1 - BOX.y0)) };
                const clash = q => dist(p, q) < PLANET_GAP || (Math.abs(p.y - q.y) < 14 && Math.abs(p.x - q.x) < 48);  // labels too
                if (dist(p, B) < STORY_CLEAR || (Math.abs(p.y - B.y) < 22 && Math.abs(p.x - B.x) < 60) || planets.some(clash)) continue;
                const name = NAMES[Math.floor(rnd() * NAMES.length)] + '-' + (2 + Math.floor(rnd() * 97));
                if (planets.some(q => q.name.split('-')[0] === name.split('-')[0])) continue;
                planets.push({ ...p, r: 3 + Math.floor(rnd() * 3), col: PLANET_COLS[Math.floor(rnd() * PLANET_COLS.length)], name });
            }
            const views = s => planets.filter(q => q !== s && Math.abs(angDiff(bearingTo(s, B), bearingTo(q, B))) > 35).length;
            const start = planets.findIndex(s => dist(s, B) > 100 && dist(s, B) < 200 && views(s) >= 2);
            if ((planets.length >= 5 && start >= 0) || tries > 300) {
                const at = Math.max(0, start), away = (rnd() < 0.5 ? -1 : 1) * (70 + rnd() * 80);
                return { B, planets, start: at, dish: norm(bearingTo(planets[at], B) + away) };
            }
        }
    }

    /** Weighted least-squares crossing of the locked bearings; each weighs 1 / (its sideways error at that range)².
        Returns the point, the 2-sigma ellipse (semi-axes px, angle), whether it is small enough to search, and found:
        small enough AND the beacon at B sits inside it. */
    function fix(lines, B) {
        if (lines.length < 2) return null;
        let d = lines.map(() => 100), P = null, a = 0, b = 0, c = 0, det = 0;
        for (let it = 0; it < 3; it++) {
            let bx = 0, by = 0;
            a = 0; b = 0; c = 0;
            lines.forEach((l, i) => {
                const nx = Math.cos(rad(l.deg)), ny = Math.sin(rad(l.deg)), w = 1 / (d[i] * rad(l.sig)) ** 2, k = nx * l.x + ny * l.y;
                a += w * nx * nx; b += w * nx * ny; c += w * ny * ny; bx += w * nx * k; by += w * ny * k;
            });
            det = a * c - b * b;
            if (!(det > 0)) return { ok: false, behind: false };
            P = { x: (c * bx - b * by) / det, y: (a * by - b * bx) / det };
            d = lines.map(l => Math.max(15, dist(l, P)));
        }
        const behind = lines.some(l => (P.x - l.x) * Math.sin(rad(l.deg)) - (P.y - l.y) * Math.cos(rad(l.deg)) < -5);
        const ca = c / det, cb = -b / det, cc = a / det, mid = (ca + cc) / 2, half = Math.hypot((ca - cc) / 2, cb);
        const major = 2 * Math.sqrt(mid + half), minor = 2 * Math.sqrt(Math.max(0, mid - half));
        const dx = B.x - P.x, dy = B.y - P.y, m = Math.sqrt(a * dx * dx + 2 * b * dx * dy + c * dy * dy);
        const ok = !behind && major < 120 && P.x > -40 && P.x < W + 40 && P.y > -40 && P.y < H + 40;
        const small = ok && Number(ly(major)) <= FOUND_LY;     // judged on the number the player is shown
        return { ok, behind, x: P.x, y: P.y, major, minor, ang: 0.5 * Math.atan2(2 * cb, ca - cc), small, found: small && m <= 3 };
    }

    function buildBg(wk, seed) {
        const cv = document.createElement('canvas');
        cv.width = W; cv.height = H;
        const b = cv.getContext('2d'), rnd = Lab.rng(seed + 5);
        b.fillStyle = C.void; b.fillRect(0, 0, W, H);
        b.fillStyle = wk.neb; b.globalAlpha = wk.nebA; // nebula: the sector's colour, darkened as the game darkens it
        for (let k = 0; k < 4; k++) {
            const cx = rnd() * W, cy = rnd() * H, r = 45 + rnd() * 60, dd = (x, y) => Math.hypot((x - cx) / 1.6, y - cy) / r;
            for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (dd(x, y) < 1 && Lab.on(x, y, (1 - dd(x, y)) * 0.5)) b.fillRect(x, y, 1, 1);
        }
        b.globalAlpha = 1;
        if (wk.light) [[88, C.amber, dd => 0.3 * (1 - dd) ** 2], [34, C.gold, dd => 0.5 * (1 - dd)], [12, C.white, dd => 0.9 * (1 - dd)]]
            .forEach(([r, col, tone]) => Lab.disc(b, W + 4, 94, r, tone, col));   // sector 6: the light at the end of the heading
        Lab.stars(b, seed, 80);
        for (let k = 0; k < wk.pips; k++) {            // the heading band: dead transponders, still, as on the game's map
            const x = Math.round(rnd() * W), y = Math.round(H / 2 + (rnd() - 0.5) * rnd() * 0.52 * H);
            b.fillStyle = rnd() < 0.3 ? C.boneD : C.greenD;
            b.fillRect(x, y, rnd() < 0.3 ? 2 : 1, 1);
        }
        return cv;
    }

    function planet(ctx, p, fade = 1) {               // a lit sphere, light from the upper left
        for (let y = p.y - p.r; y <= p.y + p.r; y++) for (let x = p.x - p.r; x <= p.x + p.r; x++) {
            const nx = (x - p.x) / (p.r + 0.5), ny = (y - p.y) / (p.r + 0.5), q = nx * nx + ny * ny;
            if (q > 1) continue;
            ctx.fillStyle = Lab.on(x, y, Lab.clamp(0.06 + 0.9 * (-0.55 * nx - 0.45 * ny + 0.7 * Math.sqrt(1 - q)), 0, 1) * fade) ? p.col : C.ink2;
            ctx.fillRect(x, y, 1, 1);
        }
    }
    function label(ctx, str, cx, y, col) {            // backed, so a bearing line never runs through the letters
        const w = Lab.textWidth(str), x = Lab.clamp(Math.round(cx - w / 2), 2, W - 2 - w);
        Lab.shade(ctx, x - 1, y - 1, w + 2, 7, 0.85, C.void);
        Lab.text(ctx, str, x, y, col);
    }
    function plusMinus(ctx, x, y, col) {
        ctx.fillStyle = col;
        [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2], [0, 4], [1, 4], [2, 4]].forEach(([dx, dy]) => ctx.fillRect(x + dx, y + dy, 1, 1));
    }
    function ray(ctx, l, deg, col, tone) {
        Lab.line(ctx, l.x, l.y, l.x + Math.sin(rad(deg)) * 420, l.y - Math.cos(rad(deg)) * 420, col, tone);
    }
    function dashes(ctx, from, to, t, skip) {         // the game's moving course line
        const len = dist(from, to);
        for (let d = skip; d < len - 6; d++) {
            const k = (((d - t * 0.03) % 9) + 9) % 9;
            if (k <= 4) Lab.dot(ctx, from.x + ((to.x - from.x) * d) / len, from.y + ((to.y - from.y) * d) / len, k > 3 ? C.gold : C.amber);
        }
    }
    function ellipse(ctx, cx, cy, a, b, ang) {        // the fix: a dithered amber ellipse with a gold centre
        const ca = Math.cos(ang), sa = Math.sin(ang), R = Math.ceil(a);
        ctx.fillStyle = C.amber;
        for (let y = Math.round(cy) - R; y <= cy + R; y++) for (let x = Math.round(cx) - R; x <= cx + R; x++) {
            const dx = x - cx, dy = y - cy, u = (dx * ca + dy * sa) / a, v = (-dx * sa + dy * ca) / b;
            if (u * u + v * v <= 1 && Lab.on(x, y, 0.13)) ctx.fillRect(x, y, 1, 1);
        }
        for (let i = 0, steps = Math.ceil(a * 8); i < steps; i++) {
            const t = (i / steps) * Math.PI * 2, u = Math.cos(t) * a, v = Math.sin(t) * b;
            Lab.dot(ctx, cx + u * ca - v * sa, cy + u * sa + v * ca, C.amber);
        }
        if (a > 3) [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([ox, oy]) => Lab.dot(ctx, cx + ox, cy + oy, C.gold));
    }

    function mount(ctx, ui) {
        const cv = ui.canvas;
        let run = 0, L = null, wk = null, bg = null, s = null, gen = 0, clock = 0, tail = -99, said = -99, queue = [];
        let held = 0, holdT = 0, dragging = false, hover = -1, fast = 0, slow = 0, meter = 0, trace = [], calmUntil = 0;
        let glow = new Float32Array(360), lastDish = null;   // what the dish heard at each degree, fading

        const later = (sec, fn, line) => { const g = gen; queue = queue.concat({ at: clock + sec, fn: () => g === gen && fn(), line }); };
        /** Queue lines after whatever is already queued, LINE_GAP apart. Returns seconds until the last is said.
            A line marked as a tip ([who, words, true]) is dropped if the player acts before it is said. */
        function speak(lines) {
            lines.forEach(([who, words, tip]) => {
                tail = Math.max(clock, tail + LINE_GAP);
                later(tail - clock, () => { said = clock; ui.say(who, words); }, tip ? 'tip' : 'say');
            });
            return tail - clock;
        }
        const hush = () => { gen++; queue = []; tail = -99; };
        function dropTips() {                          // the player is ahead of the advice: close the gap it leaves
            queue = queue.filter(q => q.line !== 'tip');
            tail = queue.reduce((m, q) => (q.line ? Math.max(m, q.at) : m), said);
        }
        const here = () => L.planets[s.at];
        const canMove = () => s.mode === 'hunt' && !s.move;
        const canAim = () => canMove() && !s.lockedHere;        // once locked here, the dish rests until you move
        const peakAt = p => Lab.clamp(0.5 + 45 / dist(p, L.B), 0.55, 1);   // the beacon is weaker from further away
        const listen = () => { glow = new Float32Array(360); lastDish = null; };

        function start() {
            hush(); held = 0; holdT = 0; dragging = false; hover = -1; trace = []; listen();
            wk = WRECKS[run % WRECKS.length];
            L = makeLayout(run + 1);                   // the first run always opens on the same map
            bg = buildBg(wk, 40 + run);
            s = { mode: 'hunt', at: L.start, dish: L.dish, stops: STOPS, lines: [], lockedHere: false, sel: -1, move: null, fix: null, reveal: -1, lost: -1, dim: 0 };
            speak([['A.U.R.A.', 'There is a faint Exodus beacon, Commander. It is too weak to map.'],
                ['Mira', 'Turn the dish until the signal peaks. Then lock the bearing.', true]]);
            showButtons();
        }
        const again = () => { run++; calmUntil = clock + 0.5; start(); };   // a double-tapped Space must not lock the new run

        function showButtons() {
            held = 0;
            if (s.mode === 'over') return ui.buttons([{ label: 'Run it again', primary: true, onClick: again }]);
            if (s.mode === 'found') return ui.buttons([{ label: 'Set course for ' + wk.hull, primary: true, onClick: setCourse }]);
            if (s.mode !== 'hunt') return ui.buttons([]);
            const moving = !!s.move, sel = L.planets[s.sel], noStops = s.stops === 0, still = moving || s.lockedHere;
            const turn = dir => ({ label: dir < 0 ? '← Turn dish' : 'Turn dish →', hold: true, disabled: still,
                onDown: () => { if (canAim()) { s.dish = norm(s.dish + dir); held = dir; holdT = 0; } }, onUp: () => { held = 0; } });
            ui.buttons([turn(-1), turn(1),
                { label: 'Lock bearing', primary: !s.lockedHere, disabled: still, onClick: lock },
                { label: 'Next planet', primary: s.lockedHere && !sel && !noStops, disabled: noStops || moving, onClick: nextPlanet },
                { label: sel ? `Move to ${sel.name} · 1 stop` : noStops ? 'No stops left' : 'Move · pick a planet',
                    primary: s.lockedHere && !!sel, disabled: !sel || noStops || moving, onClick: () => travel(s.sel) }]);
        }

        function lock() {
            if (!canAim()) return;
            const p = here(), err = Math.abs(angDiff(s.dish, bearingTo(p, L.B)));
            const sig = Math.min(30, 1 + 0.6 * err + 2.5 * (1 - peakAt(p))), give = Math.max(1, Math.round(sig));  // a sharp peak, a sharp line
            s.lines = s.lines.concat({ x: p.x, y: p.y, deg: s.dish, sig, give });
            s.lockedHere = true; dragging = false;
            s.fix = fix(s.lines, L.B);
            hush();                                    // the lock is the news: anything still waiting to be said is dropped
            speak([['A.U.R.A.', `Bearing ${pad3(s.dish)}, give or take ${give} degree${give === 1 ? '' : 's'}, Commander.`]]);
            judge();
            showButtons();
        }
        function judge() {
            const n = s.lines.length, f = s.fix, last = s.stops === 0;
            if (f && f.found) { s.mode = 'wait'; later(LINE_GAP, reveal); return; }
            const say = words => speak([['A.U.R.A.', words]]), wide = f && f.ok ? ly(f.major) : '';
            if (n === 1) speak([['Mira', "It's somewhere on that line. Take a bearing from another planet.", true]]);
            else if (!f.ok) say((f.behind ? "The lines don't cross ahead of us, Commander." : 'The lines barely cross, Commander.')
                + (last ? ' There is no fix.' : f.behind ? ' One bearing is off.' : ' Try a planet off to one side.'));
            else if (f.small) say(`There is nothing at that fix, Commander. ${last ? 'One bearing was off.' : 'One bearing is off.'}`);
            else if (n === 2) say(`Within ${wide} light-years, Commander. We need half a light-year.`);
            else say(`Within ${wide} light-years${last ? '' : ' now'}, Commander. ${last ? 'Too wide to search.' : 'Still too wide to search.'}`);
            if (last) { s.mode = 'wait'; lose(); }
        }
        function reveal() {                            // the fix closes onto the planet, and A.U.R.A. says so as it appears
            s.reveal = 0;
            speak([['A.U.R.A.', `A small dark planet is there, Commander. ${wk.hull} is on it.`], wk.react]);
            later(0.9, () => { s.mode = 'found'; showButtons(); });
        }
        function lose() {
            later(speak([['Jaxon', "We can't wait any longer. Jumping now."]]), () => { s.mode = 'end'; s.lost = 0; });
            later(speak([['', 'The beacon fades behind you. You never learn which ship it was.']]) + 0.6, () => { s.mode = 'over'; showButtons(); });
        }
        function setCourse() {
            if (s.mode !== 'found') return;
            s.mode = 'course'; s.move = { from: here(), to: L.B, t: 0, idx: -1 };
            showButtons();
        }
        function travel(i) {
            if (!canMove() || i < 0 || i === s.at || s.stops === 0) return;
            s.move = { from: here(), to: L.planets[i], t: 0, idx: i };
            s.stops -= 1; s.sel = -1; dragging = false;
            dropTips();
            showButtons();
        }
        function arrive() {
            const m = s.move;
            s.move = null;
            if (m.idx < 0) {                           // the closing beat
                s.mode = 'end';
                later(speak([['', wk.close]]) + 0.6, () => { s.mode = 'over'; showButtons(); });
                return;
            }
            s.at = m.idx; s.lockedHere = false; listen();
            speak([['Jaxon', ARRIVE[s.stops], true]]);
            showButtons();
        }
        function nextPlanet() {
            if (!canMove() || s.stops === 0) return;
            const order = L.planets.map((p, i) => i).filter(i => i !== s.at).sort((a, b) => L.planets[a].x - L.planets[b].x);
            s.sel = order[(order.indexOf(s.sel) + 1) % order.length];
            showButtons();
        }

        // ── drawing ──
        function drawGlow(p) {                         // the dish's phosphor trace: a spike where the beacon was heard
            const R = p.r + 6;
            for (let d = 0; d < 360; d += 2) {
                const g = Math.max(glow[d], glow[d + 1]), sx = Math.sin(rad(d)), sy = -Math.cos(rad(d));
                if (g < 0.1) { if (d % 10 === 0 && sy < 0.7) Lab.dot(ctx, p.x + sx * R, p.y + sy * R, C.line2); continue; }  // (clear of the name)
                const col = g > 0.75 ? C.greenBr : g > 0.4 ? C.green : C.greenD;
                for (let k = 0, len = 1 + Math.round(g * 10); k < len; k++) Lab.dot(ctx, p.x + sx * (R + k), p.y + sy * (R + k), col);
            }
        }
        function drawMap(t) {
            ctx.drawImage(bg, 0, 0);
            const done = s.reveal >= 0, settled = done && s.reveal > 0.6;
            if (s.lines.length === 1 && !done && s.lines[0].sig < 12) [-2, 2].forEach(k => ray(ctx, s.lines[0], s.lines[0].deg + k * s.lines[0].sig, C.greenD, 0.6));
            s.lines.forEach(l => ray(ctx, l, l.deg, settled ? C.greenD : C.green, settled ? 1 : 0.8));
            if (s.fix && s.fix.ok && !done) {          // the search circle, and the fix that has to fit inside it
                ellipse(ctx, s.fix.x, s.fix.y, Math.max(1.5, s.fix.major), Math.max(1.5, s.fix.minor), s.fix.ang);
                Lab.ring(ctx, s.fix.x, s.fix.y, SEARCH_PX, C.bone, 0.8);
            }
            if (canAim()) {                            // the live dish: beam edges, and a line that brightens as the signal rises
                const p = here();
                [-1.2, 1.2].forEach(k => ray(ctx, p, s.dish + k * BEAM, C.boneD, 0.3));
                ray(ctx, p, s.dish, meter > 0.7 ? C.greenBr : C.bone, 0.7 + 0.3 * meter);
            }
            const target = canMove() && s.stops > 0 ? L.planets[hover >= 0 && hover !== s.at ? hover : s.sel] : null;
            if (target) dashes(ctx, here(), target, t, here().r + 3);
            if (s.move) dashes(ctx, s.move.from, s.move.to, t, 0);
            if (!s.move && !canAim()) {                // where you are, pulsing as on the game's map
                const p = done && (s.mode === 'end' || s.mode === 'over') ? { ...L.B, r: 4 } : here(), grow = (t % 2200) / 2200;
                Lab.ring(ctx, p.x, p.y, p.r + 2 + grow * 6, grow < 0.5 ? C.green : C.greenD, 1 - grow * 0.5);
            }
            L.planets.forEach(p => { planet(ctx, p); label(ctx, p.name, p.x, p.y + p.r + 3, C.boneD); });
            if (target) label(ctx, ly(dist(here(), target)) + ' LY', target.x, target.y - target.r - 8, C.amber);
            if (canAim()) drawGlow(here());
            if (s.mode === 'end' || s.mode === 'over') { ctx.globalAlpha = s.dim; ctx.fillStyle = C.void; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
            if (done) drawStory(t);
            if (s.lost >= 0) {                         // where it was, fading as the ship leaves
                const k = Math.max(0.3, 1 - s.lost / 6);
                if (Math.floor(t / 500) % 2) Lab.disc(ctx, L.B.x, L.B.y, 1.6, k, C.gold);
                Lab.ring(ctx, L.B.x, L.B.y, 5, C.gold, 0.4 * k);
            }
            if (s.move) {                              // you, crossing to the next stop
                const k = s.move.t * s.move.t * (3 - 2 * s.move.t), x = Lab.lerp(s.move.from.x, s.move.to.x, k), y = Lab.lerp(s.move.from.y, s.move.to.y, k);
                Lab.ring(ctx, x, y, 4, C.green, 0.9);
                Lab.disc(ctx, x, y, 1.5, 1, C.white);
            }
        }
        function drawStory(t) {
            const B = L.B, f = s.fix, c = Lab.clamp(s.reveal / 0.4, 0, 1), k = Lab.clamp((s.reveal - 0.3) / 0.9, 0, 1);
            if (c < 1) ellipse(ctx, Lab.lerp(f.x, B.x, c), Lab.lerp(f.y, B.y, c), Math.max(1, f.major * (1 - c)), Math.max(1, f.minor * (1 - c)), f.ang);
            if (k > 0 && k < 1) Lab.ring(ctx, B.x, B.y, 4 + k * 26, C.gold, 1 - k);
            else if (k >= 1 && s.mode === 'found') Lab.ring(ctx, B.x, B.y, 8, C.gold, 0.6);   // a destination now
            planet(ctx, { x: B.x, y: B.y, r: 4, col: C.bone }, 0.75 * k);
            if (k > 0 && Math.floor(t / 600) % 2) Lab.dot(ctx, B.x + 1, B.y - 1, C.gold);   // the beacon, now we know where to look
            if (s.reveal > 0.8) { label(ctx, wk.hull, B.x, B.y + 8, C.gold); label(ctx, wk.title, B.x, B.y + 15, C.bone); }
        }
        /** A solid readout panel, so map lines never show through the numbers. */
        function panel(x, y, w, h) {
            ctx.fillStyle = C.void; ctx.fillRect(x, y, w, h);
            ctx.fillStyle = C.line; ctx.fillRect(x, y === 0 ? y + h : y, w, 1);
        }
        function drawHud() {
            panel(0, 0, 58, 26);
            Lab.text(ctx, 'SECTOR ' + wk.sector, 5, 5, C.boneD);
            Lab.text(ctx, 'DISH', 5, 15, C.boneD);
            Lab.text(ctx, pad3(s.dish), 24, 13, s.lockedHere ? C.green : C.amber, 2);
            const mx = 250, mw = TRACE;                // the signal meter, its peak over the last two seconds, and its trace
            panel(mx - 4, 0, W - mx + 4, 36);
            Lab.text(ctx, 'SIGNAL', mx, 5, C.boneD);
            for (let x = 0; x < mw; x += 3) Lab.dot(ctx, mx + x, 15, C.line2);
            for (let x = 0; x < Math.round(meter * mw); x++) if (x % 3 !== 2) Lab.line(ctx, mx + x, 12, mx + x, 15, x > mw * 0.75 ? C.greenBr : C.green, 0.85);
            const px = mx + Math.round(Math.max(0, ...trace) * mw);
            Lab.line(ctx, px, 11, px, 16, C.gold);
            Lab.line(ctx, mx, 32, mx + mw - 1, 32, C.line);
            trace.forEach((v, i) => { if (i) Lab.line(ctx, mx + i - 1, 32 - Math.round(trace[i - 1] * 12), mx + i, 32 - Math.round(v * 12), C.green, 0.8); });
            panel(0, H - 14, W, 14);                         // stops, bearings and the fix along the bottom
            const y = H - 9, f = s.fix, found = s.reveal >= 0;
            Lab.text(ctx, 'STOPS LEFT', 5, y, C.boneD);
            for (let i = 0; i < STOPS; i++) Lab.shade(ctx, 48 + i * 6, y, 4, 5, 1, i < s.stops ? C.green : C.line2);
            let x = 76;
            s.lines.forEach(l => {
                x += Lab.text(ctx, pad3(l.deg), x, y, C.green) + 1;
                plusMinus(ctx, x, y, C.greenD);
                x += 12 + Lab.text(ctx, String(l.give), x + 4, y, C.greenD);
            });
            const right = found ? 'FOUND' : f && f.ok ? ly(f.major) + ' LY' : '--', rw = Lab.textWidth(right);
            Lab.text(ctx, right, W - 5 - rw, y, found ? C.greenBr : f && f.ok ? C.amber : C.boneD);
            Lab.text(ctx, 'FIX', W - 5 - rw - 16, y, C.boneD);
        }

        // ── input ──
        const planetAt = p => L.planets.findIndex(q => dist(p, q) <= q.r + 5);
        const onStory = p => s.mode === 'found' && dist(p, L.B) < 10;
        function aim(p) { const h = here(); if (dist(p, h) > 4) s.dish = bearingTo(h, p); }
        cv.onpointerdown = e => {
            const p = ui.toPixel(e), i = planetAt(p);
            if (onStory(p)) return setCourse();
            if (!canMove()) return;
            if (i >= 0 && i !== s.at) {
                if (s.stops > 0 && s.sel === i) travel(i);
                else if (s.stops > 0) { s.sel = i; showButtons(); }
                return;
            }
            if (!canAim()) return;
            dragging = true;
            try { cv.setPointerCapture(e.pointerId); } catch (err) { /* capture is optional */ }
            aim(p);
        };
        cv.onpointermove = e => {
            const p = ui.toPixel(e);
            hover = canMove() && !dragging ? planetAt(p) : -1;
            cv.style.cursor = onStory(p) || (hover >= 0 && hover !== s.at && s.stops > 0) ? 'pointer' : '';
            if (dragging && (!e.buttons || !canAim())) dragging = false;
            if (dragging) aim(p);
        };
        cv.onpointerup = () => { dragging = false; };
        cv.onpointerleave = () => { hover = -1; };     // not cleared by the shell: undone in the cleanup below
        Lab.onKey((k, e) => {
            if ((e && e.repeat) || clock < calmUntil) return;
            const t = e && e.target, dir = { ArrowLeft: -1, a: -1, ArrowRight: 1, d: 1 }[k];
            if (t && t.matches && t.matches('.pick[aria-current="true"]') && (k === ' ' || dir)) { e.preventDefault(); t.blur(); }  // else Space reopens this sketch
            const onButton = !!(t && t.tagName === 'BUTTON' && document.activeElement === t), go = (k === ' ' || k === 'Enter') && !onButton;
            if (s.mode === 'over') { if (go) again(); }
            else if (s.mode === 'found') { if (go) setCourse(); }
            else if (dir) { if (canAim()) { s.dish = norm(s.dish + dir); holdT = 0; } }
            else if ((k === ' ' || k === 'l') && !onButton) lock();
            else if (k === 'n') nextPlanet();
            else if ((k === 'Enter' || k === 'm') && !onButton) travel(s.sel);
        });

        Lab.loop((dt, now) => {
            clock += dt;
            const due = queue.filter(q => q.at <= clock);
            if (due.length) { queue = queue.filter(q => q.at > clock); due.forEach(q => q.fn()); }
            const has = k => Lab.keys.has(k);
            const dir = held || ((has('ArrowRight') || has('d')) ? 1 : 0) - ((has('ArrowLeft') || has('a')) ? 1 : 0);
            if (dir && canAim()) {
                holdT += dt;
                if (holdT > HOLD_DELAY) s.dish = norm(s.dish + dir * Lab.lerp(TURN_SLOW, TURN_FAST, Lab.clamp((holdT - HOLD_DELAY) / RAMP_S, 0, 1)) * dt);
            } else holdT = 0;
            if (s.move) { s.move = { ...s.move, t: Math.min(1, s.move.t + dt / TRAVEL_S) }; if (s.move.t >= 1) arrive(); }
            if (s.reveal >= 0) s.reveal += dt;
            if (s.lost >= 0) s.lost += dt;
            if (s.mode === 'end' || s.mode === 'over') s.dim = Math.min(0.55, s.dim + dt * 0.25);
            // the receiver: the beam pattern times the beacon's strength from here, plus static
            const listening = canMove(), off = listening ? angDiff(s.dish, bearingTo(here(), L.B)) : 0;
            const sig = listening ? peakAt(here()) * Math.exp(-(off ** 2) / (2 * BEAM * BEAM)) : 0;
            fast += ((Math.random() * 2 - 1) * FAST_NOISE - fast) * Math.min(1, dt * 10);
            slow += ((Math.random() * 2 - 1) * SLOW_NOISE - slow) * Math.min(1, dt * 2);
            meter = s.lost >= 0 ? meter * 0.9 : Lab.clamp(FLOOR + 0.86 * sig + fast * 0.5 + slow * 0.5, 0, 1);
            trace = trace.concat(meter).slice(-TRACE);
            if (canAim()) {                            // lay the trace along every degree swept this frame (not across a jump)
                const v = Lab.clamp((meter - GLOW_FLOOR) / 0.7, 0, 1), from = lastDish == null ? s.dish : lastDish, span = angDiff(s.dish, from);
                const n = Math.abs(span) > 8 ? 0 : Math.ceil(Math.abs(span)), d0 = n ? from : s.dish;
                for (let i = 0; i <= n; i++) { const d = Math.round(norm(d0 + (n ? (span * i) / n : 0))) % 360; glow[d] = Math.max(glow[d], v); }
                lastDish = s.dish;
            }
            const fade = Math.exp(-dt / GLOW_S);
            for (let d = 0; d < 360; d++) glow[d] *= fade;
            drawMap(now);
            drawHud();
        }, 30);

        start();
        return () => { cv.style.cursor = ''; cv.onpointerleave = null; hush(); held = 0; dragging = false; };
    }

    Lab.register({
        id: 'bearing', badge: 'new',
        name: 'Take a bearing',
        short: 'Find a wreck by its beacon',
        verb: 'Swing the dish until a faint beacon peaks and lock the bearing, then move to another planet and take another. Where the lines cross is the wreck.',
        serves: 'Hand-made story planets hidden among the random ones: you find the story wreck yourself instead of stumbling on it.',
        replaces: "The long-range scan, and the luck of finding the sector's page.",
        controls: '←/→ turn the dish (tap 1°, hold to sweep) · or drag to aim · Space locks · click a planet twice, or N then Enter, to move',
        mount,
    });
})();
