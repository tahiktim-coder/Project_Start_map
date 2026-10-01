/* proto-bearing.js — Take a bearing.
   The sector map as the game draws it, with one hand-made story planet hidden among the random ones (they are placed
   around it, never on it). Its wreck's beacon is too faint for the map, so: swing the dish until the signal peaks, lock
   the bearing, move to another planet (one stop), take another. Where the lines cross sits a 2-sigma error ellipse; a
   third line tightens it. A bearing's "give or take" comes from how strong the signal was when you locked it. */

(function () {
    'use strict';
    const Lab = window.Lab, C = Lab.C, W = Lab.W, H = Lab.H;

    const LY_PER_PX = 0.06;                           // the map is about nineteen light-years across
    const STOPS = 3;                                  // the jump window stays open for three stops, as in the game
    const BEAM = 6;                                   // the dish's main lobe, degrees (1 sigma: about 14° wide at half power)
    const FLOOR = 0.07, FAST_NOISE = 0.5, SLOW_NOISE = 0.35;   // meter level with nothing in the beam; static before filtering
    const FOUND_PX = 9;                               // found when the 2-sigma error is under this: about half a light-year
    const TURN_SLOW = 8, TURN_FAST = 55, RAMP_S = 0.9, HOLD_DELAY = 0.25;   // degrees a second while a turn is held
    const TRAVEL_S = 1.4, LINE_GAP = 2.6, TRACE = 66;
    const BOX = { x0: 22, x1: 298, y0: 44, y1: 146 };  // where planets may sit, clear of the readouts
    const PLANET_GAP = 40, STORY_CLEAR = 30;          // random planets keep this far from each other and from the story planet
    const NAMES = ['HELIOS', 'KRYOS', 'TITAN', 'AEA', 'ZEPHYR', 'NYX', 'EREBUS', 'ATLAS', 'PHOEBE', 'CHRONOS'];
    const PLANET_COLS = [C.bone, C.amber, C.violet, C.boneD, C.red];

    const WRECKS = [
        { sector: 2, hull: 'EXODUS-8', title: 'THE LAST OF THE EIGHT', neb: C.violet, nebA: 0.13, pips: 8,
            react: ['Aris', "That's the eighth ship. The last one that left before us."],
            close: 'EXODUS-8 lies on its side in the dark. Its beacon has been calling for twenty years.' },
        { sector: 3, hull: 'EXODUS-980', title: 'MORE THAN EIGHT', neb: C.greenD, nebA: 0.28, pips: 20,
            react: ['Vance', 'Hull number 980. They told us eight ships went before us.'],
            close: 'EXODUS-980 has been down there about a hundred years. Its beacon is nearly out of power.' },
        { sector: 6, hull: 'EXODUS-30,211', title: 'CLOSE TO THE LIGHT', neb: C.amber, nebA: 0.09, pips: 40, light: true,
            react: ['Mira', 'It got this close to the light. Four hundred years ago.'],
            close: 'EXODUS-30,211 sits on a dead world, facing the light. Its beacon was the last thing working.' },
    ];
    const ARRIVE = { 2: "That's one stop used. We have two left before we have to jump.",
        1: 'We can make one more stop before we jump.', 0: "That's our last stop. Take the bearing, then we jump." };

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
        Returns the point, the 2-sigma ellipse (semi-axes px, angle) and whether the beacon at B sits inside it. */
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
        return { ok, behind, x: P.x, y: P.y, major, minor, ang: 0.5 * Math.atan2(2 * cb, ca - cc), found: ok && major <= FOUND_PX && m <= 3 };
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
    function label(ctx, str, cx, y, col, backed) {
        const w = Lab.textWidth(str), x = Lab.clamp(Math.round(cx - w / 2), 2, W - 2 - w);
        if (backed) Lab.shade(ctx, x - 1, y - 1, w + 2, 7, 0.85, C.void);
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
    function shipIcon(ctx, x, y) {                    // nose up, like the cutaway
        ['.#.', '###', '###', '#.#'].forEach((row, r) => [...row].forEach((ch, c) => {
            if (ch === '#') Lab.dot(ctx, x - 1 + c, y + r, r === 3 ? C.amber : C.white);
        }));
    }

    function mount(ctx, ui) {
        const cv = ui.canvas;
        let run = 0, L = null, wk = null, bg = null, s = null, gen = 0, clock = 0, tail = -99, queue = [];
        let held = 0, holdT = 0, dragging = false, hover = -1, fast = 0, slow = 0, meter = 0, trace = [];

        const later = (sec, fn) => { const g = gen; queue = queue.concat({ at: clock + sec, fn: () => g === gen && fn() }); };
        /** Queue lines after whatever is already queued, LINE_GAP apart. Returns seconds until the last is said. */
        function speak(lines) {
            lines.forEach(([who, words]) => { tail = Math.max(clock, tail + LINE_GAP); later(tail - clock, () => ui.say(who, words)); });
            return tail - clock;
        }
        const hush = () => { gen++; queue = []; tail = -99; };
        const here = () => L.planets[s.at];
        const canAim = () => s.mode === 'hunt' && !s.move;
        const peakAt = p => Lab.clamp(0.5 + 45 / dist(p, L.B), 0.55, 1);   // the beacon is weaker from further away

        function start() {
            hush(); held = 0; holdT = 0; dragging = false; hover = -1; trace = [];
            wk = WRECKS[run % WRECKS.length];
            L = makeLayout(run + 1);                   // the first run always opens on the same map
            bg = buildBg(wk, 40 + run);
            s = { mode: 'hunt', at: L.start, dish: L.dish, stops: STOPS, lines: [], lockedHere: false, sel: -1, move: null, fix: null, reveal: -1, lost: -1, dim: 0 };
            speak([['A.U.R.A.', 'There is a faint beacon on the dish, Commander. It is too weak to place on the map.'],
                ['Mira', 'Turn the dish until the signal peaks. Then lock the bearing.']]);
            showButtons();
        }
        const again = () => { run++; start(); };

        function showButtons() {
            held = 0;
            if (s.mode === 'end') return ui.buttons([{ label: 'Run it again', primary: true, onClick: again }]);
            if (s.mode === 'found') return ui.buttons([{ label: 'Set course for ' + wk.hull, primary: true, onClick: setCourse }]);
            if (s.mode !== 'hunt') return ui.buttons([]);
            const moving = !!s.move, sel = L.planets[s.sel], noStops = s.stops === 0;
            const turn = dir => ({ label: dir < 0 ? '← Turn dish' : 'Turn dish →', hold: true, disabled: moving,
                onDown: () => { if (canAim()) { s.dish = norm(s.dish + dir); held = dir; holdT = 0; } }, onUp: () => { held = 0; } });
            ui.buttons([turn(-1), turn(1),
                { label: 'Lock bearing', primary: !s.lockedHere, disabled: s.lockedHere || moving, onClick: lock },
                { label: 'Next planet', primary: s.lockedHere && !sel && !noStops, disabled: noStops || moving, onClick: nextPlanet },
                { label: sel ? `Move to ${sel.name} · 1 stop` : noStops ? 'No stops left' : 'Move · pick a planet',
                    primary: s.lockedHere && !!sel, disabled: !sel || noStops || moving, onClick: () => travel(s.sel) }]);
        }

        function lock() {
            if (!canAim() || s.lockedHere) return;
            const p = here(), err = Math.abs(angDiff(s.dish, bearingTo(p, L.B)));
            const sig = Math.min(30, 1 + 0.6 * err + 2.5 * (1 - peakAt(p))), give = Math.max(1, Math.round(sig));  // a sharp peak, a sharp line
            s.lines = s.lines.concat({ x: p.x, y: p.y, deg: s.dish, sig, give });
            s.lockedHere = true;
            s.fix = fix(s.lines, L.B);
            hush();                                    // the lock is the news: anything still waiting to be said is dropped
            speak([['A.U.R.A.', `Bearing ${pad3(s.dish)}, give or take ${give} degree${give === 1 ? '' : 's'}, Commander.`]]);
            judge();
            showButtons();
        }
        function judge() {
            const n = s.lines.length, f = s.fix, cross = ['Mira', "Two lines cross there. That's where it is."];
            let lines;
            if (n === 1) lines = [['Mira', "It's somewhere along that line. Move to another planet and take a second bearing."]];
            else if (!f.ok) lines = [['A.U.R.A.', f.behind ? "Those lines don't cross ahead of us, Commander. One bearing is off."
                : 'Those lines are nearly parallel, Commander. Try a planet off to one side.']];
            else if (f.found) lines = [n === 2 ? cross : ['Mira', "That's small enough to search. It's right there."]];
            else if (f.major <= FOUND_PX) lines = [['A.U.R.A.', 'There is nothing at that fix, Commander. One of the bearings is off.']];
            else if (n === 2) lines = [cross, ['A.U.R.A.', `It is within ${ly(f.major)} light-years of that point, Commander. A third bearing will narrow it.`]];
            else lines = [['A.U.R.A.', `Within ${ly(f.major)} light-years now, Commander. Still too wide to search.`]];
            const wait = speak(lines);
            if (f && f.found) { s.mode = 'wait'; later(wait + 1, reveal); }
            else if (s.stops === 0) { s.mode = 'wait'; later(wait + 0.4, lose); }
        }
        function reveal() {
            s.reveal = 0;
            const wait = speak([['A.U.R.A.', `There is a small dark planet at that fix, Commander. ${wk.hull} is on its surface.`], wk.react]);
            later(wait + 0.4, () => { s.mode = 'found'; showButtons(); });
        }
        function lose() {
            s.lost = 0;
            const wait = speak([['Jaxon', 'That was our last stop. We have to jump now.'],
                ['', 'The beacon fades behind you. You never learn which ship it was.']]);
            later(wait + 0.4, () => { s.mode = 'end'; showButtons(); });
        }
        function setCourse() {
            if (s.mode !== 'found') return;
            s.mode = 'course'; s.move = { from: here(), to: L.B, t: 0, idx: -1 };
            showButtons();
        }
        function travel(i) {
            if (!canAim() || i < 0 || i === s.at || s.stops === 0) return;
            s.move = { from: here(), to: L.planets[i], t: 0, idx: i };
            s.stops -= 1; s.sel = -1; dragging = false;
            showButtons();
        }
        function arrive() {
            const m = s.move;
            s.move = null;
            if (m.idx < 0) { s.mode = 'end'; later(speak([['', wk.close]]) + 0.6, showButtons); return; }   // the closing beat
            s.at = m.idx; s.lockedHere = false;
            speak([['Jaxon', ARRIVE[s.stops]]]);
            showButtons();
        }
        function nextPlanet() {
            if (!canAim() || s.stops === 0) return;
            const order = L.planets.map((p, i) => i).filter(i => i !== s.at).sort((a, b) => L.planets[a].x - L.planets[b].x);
            s.sel = order[(order.indexOf(s.sel) + 1) % order.length];
            showButtons();
        }

        // ── drawing ──
        function drawEllipse(f) {
            const ca = Math.cos(f.ang), sa = Math.sin(f.ang), a = Math.max(1.5, f.major), b = Math.max(1.5, f.minor), R = Math.ceil(a);
            ctx.fillStyle = C.amber;
            for (let y = Math.round(f.y) - R; y <= f.y + R; y++) for (let x = Math.round(f.x) - R; x <= f.x + R; x++) {
                const dx = x - f.x, dy = y - f.y, u = (dx * ca + dy * sa) / a, v = (-dx * sa + dy * ca) / b;
                if (u * u + v * v <= 1 && Lab.on(x, y, 0.13)) ctx.fillRect(x, y, 1, 1);
            }
            for (let i = 0, steps = Math.ceil(a * 8); i < steps; i++) {
                const t = (i / steps) * Math.PI * 2, u = Math.cos(t) * a, v = Math.sin(t) * b;
                Lab.dot(ctx, f.x + u * ca - v * sa, f.y + u * sa + v * ca, C.amber);
            }
            if (a > 3) [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([ox, oy]) => Lab.dot(ctx, f.x + ox, f.y + oy, C.gold));
        }
        function drawMap(t) {
            ctx.drawImage(bg, 0, 0);
            const hunting = s.mode === 'hunt' || s.mode === 'wait', done = s.reveal >= 0;
            if (s.lines.length === 1 && hunting) [-2, 2].forEach(k => ray(ctx, s.lines[0], s.lines[0].deg + k * s.lines[0].sig, C.greenD, 0.6));
            s.lines.forEach(l => ray(ctx, l, l.deg, done ? C.greenD : C.green, done ? 1 : 0.8));
            if (s.fix && s.fix.ok && hunting) drawEllipse(s.fix);
            if (canAim()) {                            // the live dish: beam edges, and a line that brightens as the signal rises
                const p = here(), target = L.planets[hover >= 0 && hover !== s.at ? hover : s.sel];
                [-1.2, 1.2].forEach(k => ray(ctx, p, s.dish + k * BEAM, C.boneD, 0.3));
                ray(ctx, p, s.dish, meter > 0.7 ? C.greenBr : C.bone, 0.7 + 0.3 * meter);
                if (target && s.stops > 0) {
                    dashes(ctx, p, target, t, p.r + 3);
                    label(ctx, ly(dist(p, target)) + ' LY', target.x, target.y - target.r - 8, C.amber, true);
                }
            }
            if (s.move) dashes(ctx, s.move.from, s.move.to, t, 0);
            L.planets.forEach(p => { planet(ctx, p); label(ctx, p.name, p.x, p.y + p.r + 3, C.boneD); });
            if (s.mode === 'end') { ctx.globalAlpha = s.dim; ctx.fillStyle = C.void; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }  // the map goes quiet
            if (done) drawStory(t);
            if (s.lost >= 0) {                         // where it was, fading as the ship leaves
                const k = Math.max(0.3, 1 - s.lost / 6);
                if (Math.floor(t / 500) % 2) Lab.disc(ctx, L.B.x, L.B.y, 1.6, k, C.gold);
                Lab.ring(ctx, L.B.x, L.B.y, 5, C.gold, 0.4 * k);
            }
            if (s.move) {
                const k = s.move.t * s.move.t * (3 - 2 * s.move.t);
                shipIcon(ctx, Math.round(Lab.lerp(s.move.from.x, s.move.to.x, k)), Math.round(Lab.lerp(s.move.from.y, s.move.to.y, k)) - 2);
                return;
            }
            const p = done && (s.mode === 'end' || s.mode === 'course') ? { ...L.B, r: 4 } : here(), grow = (t % 2200) / 2200;
            Lab.ring(ctx, p.x, p.y, p.r + 3 + grow * 10, grow < 0.5 ? C.green : C.greenD, 1 - grow * 0.5);
            shipIcon(ctx, p.x + p.r + 3, p.y - p.r - 3);
        }
        function drawStory(t) {
            const k = Lab.clamp(s.reveal / 1.2, 0, 1), B = L.B;
            if (s.reveal < 1.2) Lab.ring(ctx, B.x, B.y, 4 + s.reveal * 26, C.gold, 1 - k);
            else if (s.mode === 'found') Lab.ring(ctx, B.x, B.y, 8, C.gold, 0.6);        // a destination now
            planet(ctx, { x: B.x, y: B.y, r: 4, col: C.bone }, 0.75 * k);
            if (Math.floor(t / 600) % 2) Lab.dot(ctx, B.x + 1, B.y - 1, C.gold);   // the beacon, now we know where to look
            if (s.reveal > 1.2) { label(ctx, wk.hull, B.x, B.y + 8, C.gold, true); label(ctx, wk.title, B.x, B.y + 15, C.bone, true); }
        }
        function drawHud() {
            Lab.shade(ctx, 0, 0, 58, 26, 0.8, C.void);
            Lab.text(ctx, 'SECTOR ' + wk.sector, 5, 5, C.boneD);
            Lab.text(ctx, 'DISH', 5, 15, C.boneD);
            Lab.text(ctx, pad3(s.dish), 24, 13, s.lockedHere ? C.green : C.amber, 2);
            const mx = 250, mw = TRACE;                // the signal meter, its peak over the last two seconds, and its trace
            Lab.shade(ctx, mx - 4, 0, W - mx + 4, 36, 0.8, C.void);
            Lab.text(ctx, 'SIGNAL', mx, 5, C.boneD);
            for (let x = 0; x < mw; x += 3) Lab.dot(ctx, mx + x, 15, C.line2);
            for (let x = 0; x < Math.round(meter * mw); x++) if (x % 3 !== 2) Lab.line(ctx, mx + x, 12, mx + x, 15, x > mw * 0.75 ? C.greenBr : C.green, 0.85);
            const px = mx + Math.round(Math.max(0, ...trace) * mw);
            Lab.line(ctx, px, 11, px, 16, C.gold);
            Lab.line(ctx, mx, 32, mx + mw - 1, 32, C.line);
            trace.forEach((v, i) => { if (i) Lab.line(ctx, mx + i - 1, 32 - Math.round(trace[i - 1] * 12), mx + i, 32 - Math.round(v * 12), C.green, 0.8); });
            Lab.shade(ctx, 0, H - 14, W, 14, 0.8, C.void);   // stops, bearings and the fix along the bottom
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
            if (!canAim()) return;
            if (i >= 0 && i !== s.at) {
                if (s.stops > 0 && s.sel === i) travel(i);
                else if (s.stops > 0) { s.sel = i; showButtons(); }
                return;
            }
            dragging = true;
            try { cv.setPointerCapture(e.pointerId); } catch (err) { /* capture is optional */ }
            aim(p);
        };
        cv.onpointermove = e => {
            const p = ui.toPixel(e);
            hover = canAim() && !dragging ? planetAt(p) : -1;
            cv.style.cursor = onStory(p) || (hover >= 0 && hover !== s.at && s.stops > 0) ? 'pointer' : '';
            if (dragging && !e.buttons) dragging = false;
            if (dragging) aim(p);
        };
        cv.onpointerup = () => { dragging = false; };
        cv.onpointerleave = () => { hover = -1; };     // not cleared by the shell: undone in the cleanup below
        Lab.onKey((k, e) => {
            if (e && e.repeat) return;
            const onButton = !!(e && e.target && e.target.tagName === 'BUTTON'), dir = { ArrowLeft: -1, a: -1, ArrowRight: 1, d: 1 }[k];
            if (s.mode === 'end' || s.mode === 'found') {
                if ((k === ' ' || k === 'Enter') && !onButton) (s.mode === 'end' ? again : setCourse)();
            } else if (dir) {
                if (canAim()) { s.dish = norm(s.dish + dir); holdT = 0; }
            } else if ((k === ' ' || k === 'l') && !onButton) lock();
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
            if (s.mode === 'end') s.dim = Math.min(0.55, s.dim + dt * 0.25);
            // the receiver: the beam pattern times the beacon's strength from here, plus static
            const sig = canAim() ? peakAt(here()) * Math.exp(-(angDiff(s.dish, bearingTo(here(), L.B)) ** 2) / (2 * BEAM * BEAM)) : 0;
            fast += ((Math.random() * 2 - 1) * FAST_NOISE - fast) * Math.min(1, dt * 10);
            slow += ((Math.random() * 2 - 1) * SLOW_NOISE - slow) * Math.min(1, dt * 2);
            meter = s.lost >= 0 ? meter * 0.9 : Lab.clamp(FLOOR + 0.86 * sig + fast * 0.5 + slow * 0.5, 0, 1);
            trace = trace.concat(meter).slice(-TRACE);
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
        controls: '←/→ turn the dish (tap 1°, hold to sweep) · or drag around the ship · Space locks · click a planet twice, or N then Enter, to move',
        mount,
    });
})();
