/* Corridor.js — Fly the corridor: every sector jump, flown (ported from prototypes/sim-bay/proto-corridor.js).
   The ship jumps, drops out in the next sector and flies down the heading for about a minute: quiet stretches of space,
   debris that comes in waves, two dead hulls far apart. The radio counts every transponder it hears (eight, then hundreds,
   then tens of thousands), but only those two hulls come close enough to SEE. Each is a point with a warm beacon far down
   the heading; it grows out of the haze and passes large while the camera glances at it: our own class, some torn in two.
   In sector 5 a ship exactly like ours flies beside us for a while, a quarter of a second late; in sector 6 the light at
   the end of the heading fills the view. The ship follows the pointer (or the arrows); holding the mouse, Space, W or Shift
   opens the throttle, so the end comes sooner and the debris faster. Once through, A.U.R.A. says what the flight found, one
   line at a time. A.U.R.A. can fly: steady, never faster. Quiet sound, only when the game's is on.

   const result = await MiniHost.play('corridor', { fromSector: 2, toSector: 3, crew: state.crew, damaged: { bridge: true } });
   opts    toSector     2..6, the sector the ship jumps to (if missing: fromSector + 1)
           fromSector   the sector it leaves (default toSector - 1): its sky and beacon count show before the jump
           crew         optional: the game's crew list; lines of crew whose status is 'DEAD' are never said, and
                        A.U.R.A.'s first line at the end counts the living and the injured (without the Commander). Missing: all four, well
           damaged      optional: { deckKey: true } for decks already broken, drawn red on the ship inset
           scrapesPerBreak  optional: every this many scrapes a deck breaks and turns red (default 1: every scrape)
           avoidHulls   optional: hull numbers the game has already used; the two hulls seen are never these when the range allows
   result  { scrapes, auraFlew, beaconsHeard, shipsSeen, hulls, damagedRooms }
           scrapes      debris or hulls that touched the ship (only when the player flies)
           auraFlew     A.U.R.A. had the stick for at least half the flight
           beaconsHeard the counter at the end: the destination sector's level
           shipsSeen    hulls that came close enough to name (always 2)
           hulls        their hull numbers
           damagedRooms deck keys a breaking scrape turned red on the inset, in order: the game's shipDecks keys
                        (bridge, lab, quarters, cargo, engineering), never a deck that was already red */
(function () {
    'use strict';
    const MiniLab = window.MiniLab, MiniShip = window.MiniShip, MiniHost = window.MiniHost;
    if (!MiniLab || !MiniShip || !MiniHost) return;
    const { W, H, clamp, lerp } = MiniLab;

    const F = 360, CX = 240, CY = 126;                          // px per unit at depth 1; the screen point straight ahead
    const SPEED = 18, ZHIT = 2.8, NEAR = 0.7;                   // course units/s at cruise; the plane where things cross us; behind us
    const FAR_HULL = 470, FAR_FRAG = 120, FAR_DUST = 330;       // draw distances
    const SEE_AT = 70, AIM_AT = 28, WARN = 1.1;                 // a hull is named; loose debris sets its course; warning (course s)
    const BOX = [7, 4.6], MAXV = [7.5, 5.5], SHIP_R = [0.5, 0.32];                 // steering box (soft edges), speed, our half-size
    const LOOK_POS = [0.022, 0.03], LOOK_STICK = [0.08, 0.11], BANK = 0.1, GLANCE = 0.4; // camera: follow, lead, bank, turn to a wreck
    const JUMP_TIME = 1.4, FOG_T = 0.3, DROP = 3;                // the jump; haze tone; speed on dropping out
    // how long a line stays before the next: a base, plus a little per word, within limits (a long line gets time to be read)
    const GAP = { base: 2.4, word: 0.08, min: 2.6, max: 4.4 };
    const gapFor = s => clamp(GAP.base + GAP.word * s.split(/\s+/).length, GAP.min, GAP.max);
    // the throttle: the course comes up to BOOST times faster (held all the way, a flight takes about 58% of the time) and the
    // world streams past up to FEEL times faster; it opens over BOOST_UP s and eases back over BOOST_DOWN s. Near full it pushes
    // the view wider by PUSH and shakes it a little.
    const BOOST = 1.75, FEEL = 2.2, BOOST_UP = 0.8, BOOST_DOWN = 0.6, PUSH = 0.07, SHAKE_AT = 0.85;
    const AIM_GAIN = 3.2, AIM_REACH = [200, 100];               // the pointer: how keenly the ship goes where it points; px from the middle to the box edge
    // the flight's shape, in shares of the course: the hulls far apart, the debris in waves [middle, half-width, share] that
    // build and ease, with empty space before, between and after
    const HULL_AT = [0.34, 0.82], DEBRIS_FROM = 0.07, WAVES = [[0.17, 0.09, 0.3], [0.65, 0.13, 0.52], [0.9, 0.04, 0.18]], NEB_SWELL = 0.08;
    // sector 5's twin: when it is beside us (shares of the course); how far to the side, above, ahead and behind; how late it
    // copies us; how far the camera turns to it; how much of our speed-up it shows by dropping back
    const TWIN = { from: 0.4, to: 0.62, side: 4.6, up: -0.6, z: 6, behind: -6, lag: 0.25, settled: 0.3, look: 0.5, slip: 0.35 };
    // the end: the light, the cruise, when A.U.R.A. starts her report, and how long after its last line the way on shows
    const DONE_SUN = 1.12, DONE_MUL = 0.25, REPORT_DELAY = 1.6, CONTINUE_BEAT = 1.2;
    // EXODUS class, as MiniShip draws it: half-length in course units, then in half-lengths: half-width, decks, stern
    const HULL_L = 1.8, HW = 0.33, DECKS = [0.624, 0.323, 0.022, -0.278, -0.579], STERN = -0.8;
    const M_PLATE = 1, M_SEAM = 2, M_WINDOW = 3, M_INSIDE = 4, M_BELL = 5;
    const FIRST_SECTOR = 1, LAST_SECTOR = 6, SHIPS_PER_JUMP = 2, CREW_SIZE = 4, BRIEFED = 8;

    // Per sector (CANON.md §2): the beacons heard by the time you are through it, the hull numbers out there, and the flight:
    // course seconds, debris, the share that sets a course for you, the share of hulls torn, how late the count climbs,
    // the false sun and the nebula's strength at the start and end of the flight, its offset and mirroring. Sector 1 is a sky.
    const SECTORS = {
        1: { heard: 0, sun: [0.05, 0.05], neb: [0.4, 0.4], nebU: -80, flip: 1 },
        2: { heard: 8, hulls: [1, 8], dur: 50, debris: 36, aim: 0.18, broken: 0.3, curve: 1.2, sun: [0.06, 0.08], neb: [0.42, 0.5], nebU: 0, flip: 1 },
        3: { heard: 687, hulls: [212, 980], dur: 52, debris: 50, aim: 0.15, broken: 0.6, curve: 1.6, sun: [0.18, 0.22], neb: [0.52, 0.42], nebU: 0, flip: -1 },
        4: { heard: 5614, hulls: [1400, 6000], dur: 54, debris: 58, aim: 0.14, broken: 0.7, curve: 1.9, sun: [0.26, 0.32], neb: [0.4, 0.5], nebU: 60, flip: 1 },
        5: { heard: 21483, hulls: [9000, 22000], dur: 56, debris: 64, aim: 0.13, broken: 0.8, curve: 2.2, sun: [0.35, 0.5], neb: [0.42, 0.32], nebU: 100, flip: 1, twin: true },
        6: { heard: 39806, hulls: [30000, 41000], dur: 58, debris: 70, aim: 0.12, broken: 0.85, curve: 2.4, sun: [0.5, 1.45], neb: [0.34, 0.16], nebU: 120, flip: -1 },
    };
    const fmt = n => n.toLocaleString('en-US');
    const smooth = x => x * x * (3 - 2 * x);
    const ONES = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split(' ');
    const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
    /** 0..99 in words, capitalised: 16 → 'Sixteen', 21 → 'Twenty-one'. */
    function numberWord(n) {
        const s = n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');
        return s[0].toUpperCase() + s.slice(1);
    }
    // Lines per destination sector, each said once when enough hulls are seen, enough beacons heard, (at) enough of the flight
    // is flown and (twin) the twin is beside us. role is the game's crew tag, so the dead say nothing ('AURA' always speaks);
    // names: the line says the hull's number, so A.U.R.A. does not. The words are made when the line shows, so a number in it
    // matches the counter on screen. A.U.R.A. names every other hull as it comes into view, and warns of the big debris wave.
    const LINES = {
        2: [{ at: 0.06, role: 'AURA', who: 'A.U.R.A.', say: () => "I'll count every beacon we hear, Commander." },
            { seen: 1, role: 'ENGINEER', who: 'Jaxon', say: () => "That's one of the eight." },
            { at: 0.5, role: 'AURA', who: 'A.U.R.A.', say: () => 'Debris ahead, Commander.' },
            { heard: 8, role: 'MEDIC', who: 'Aris', say: () => "Eight beacons. That's every ship they told us about." }],
        3: [{ heard: 20, at: 0.1, role: 'SPECIALIST', who: 'Mira', say: () => "That can't be right. They told us eight." },
            { seen: 1, names: true, role: 'SECURITY', who: 'Vance', say: leg => 'Hull ' + fmt(leg.hulls[0].num) + ". We're hull nine." },
            { at: 0.5, role: 'AURA', who: 'A.U.R.A.', say: () => 'More debris ahead, Commander.' },
            { seen: 2, role: 'ENGINEER', who: 'Jaxon', say: () => "That one's been dead about a hundred years." }],
        4: [{ seen: 1, role: 'SPECIALIST', who: 'Mira', say: () => "That one's been out here about two hundred years." },
            { at: 0.5, role: 'AURA', who: 'A.U.R.A.', say: () => 'Heavy debris ahead, Commander.' },
            { heard: 2000, at: 0.6, role: 'MEDIC', who: 'Aris', say: () => "I've been writing every ship down. I can't keep up." }],
        5: [{ twin: true, role: 'AURA', who: 'A.U.R.A.', say: () => 'That ship is exactly like ours, Commander.' },
            { twin: true, role: 'AURA', who: 'A.U.R.A.', say: () => 'It turns when we turn, a quarter of a second late.' },
            { at: 0.56, role: 'AURA', who: 'A.U.R.A.', say: () => 'More debris ahead. Heavier than before.' },
            { seen: 2, heard: 12000, role: 'SECURITY', who: 'Vance', say: (leg, heard) => numberWord(Math.floor(heard / 1000)) + ' thousand beacons. So where are all the ships?' }],
        6: [{ at: 0.1, role: 'AURA', who: 'A.U.R.A.', say: () => 'The light ahead is getting bigger, Commander.' },
            { at: 0.5, role: 'AURA', who: 'A.U.R.A.', say: () => 'Debris ahead, Commander. The heaviest yet.' },
            { at: 0.62, role: 'ENGINEER', who: 'Jaxon', say: () => "That light ahead. I'm reading no heat off it." },
            { at: 0.84, role: 'AURA', who: 'A.U.R.A.', say: () => 'Last of the debris ahead, Commander.' }],
    };
    const ROOM_NAMES = { bridge: 'the bridge', lab: 'the lab', quarters: 'the crew quarters', cargo: 'the cargo hold', engineering: 'engineering' };
    const PLURAL_ROOMS = ['quarters'];                          // "the crew quarters are damaged"
    // how A.U.R.A. opens her report on arriving in each sector, so no two jumps start the same way
    const OPENINGS = { 2: "We're through, Commander.", 3: "We're clear, Commander.", 4: 'We made it through, Commander.', 5: 'Out of the debris, Commander.', 6: 'All clear, Commander.' };
    const u32 = hex => { const n = parseInt(hex.slice(1), 16); return (0xff000000 | ((n & 0xff) << 16) | (n & 0xff00) | (n >> 16)) >>> 0; };
    const hash = (n, s) => { const h = Math.imul(Math.imul(n, 374761393) ^ s, 1274126177); return ((h ^ (h >>> 15)) & 1023) / 1023; };
    const bandV = u => 104 + u * 0.1;                           // the galaxy's band lies below the heading, tilted a little
    let throttleTaught = false;                                 // the hint shows until the player first opens the throttle
    // what A.U.R.A. has already reported on earlier jumps this session: the head count (said again only when it changes)
    // and whether she has compared the beacons with the briefing (said in full once)
    let told = { crew: null, briefing: false };

    // ── the game's options, checked at the door ──
    const asInt = v => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : NaN);
    /** The jump: { from, to } with to in 2..6 and from before it. */
    function readSectors(opts) {
        const to = clamp(asInt(opts.toSector) || asInt(opts.fromSector) + 1 || FIRST_SECTOR + 1, FIRST_SECTOR + 1, LAST_SECTOR);
        const from = clamp(asInt(opts.fromSector) || to - 1, FIRST_SECTOR, to - 1);
        return { from, to };
    }
    /** The crew tags of everyone alive, or null when the game did not say (then everyone speaks). */
    function livingRoles(crew) {
        if (!Array.isArray(crew)) return null;
        return new Set(crew.filter(c => c && c.status !== 'DEAD').flatMap(c => c.tags || []));
    }
    /** How many of the four aboard besides the Commander are alive, and how many of those are injured (four, none, when the game did not say). */
    function crewAboard(crew) {
        if (!Array.isArray(crew)) return { alive: CREW_SIZE, hurt: 0 };
        const alive = crew.filter(c => c && c.status !== 'DEAD' && !(c.tags || []).includes('LEADER'));
        return { alive: alive.length, hurt: alive.filter(c => c.status === 'INJURED').length };
    }
    /** A.U.R.A.'s head count at the end: " Four crew, no injuries." / " Three crew, one injured." / '' when nobody is left. */
    function headCount({ alive, hurt }) {
        if (!alive) return '';
        return ` ${numberWord(alive)} crew, ${hurt ? numberWord(hurt).toLowerCase() + ' injured' : 'no injuries'}.`;
    }
    const count = n => (n < 100 ? numberWord(n) : fmt(n));
    const listOf = xs => (xs.length > 1 ? xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1] : xs[0]);
    /** What A.U.R.A. reports once through, one line each: the crew (when the count has changed since she last said it), the
        beacons (against the briefing the first time they outnumber it; not at all when someone just said the count), the hulls
        we passed, the scrapes and what they broke. Plain words where a card used to be.
        tell: { crew: the head count to add, or '', count: say the beacons, briefing: compare them with the briefing } */
    function report(sector, heard, nums, hits, rooms, tell) {
        const hulls = [...nums].sort((a, b) => a - b).map(fmt), broke = rooms.map(k => ROOM_NAMES[k] || k);
        const lines = [(OPENINGS[sector] || OPENINGS[2]) + tell.crew];
        if (tell.count) lines.push(heard === BRIEFED ? `${count(heard)} beacons heard, as the briefing said.`
            : tell.briefing ? `${fmt(heard)} beacons heard. The briefing said eight.` : `${fmt(heard)} beacons heard.`);
        if (hulls.length) lines.push(`We passed ${hulls.length > 1 ? 'hulls' : 'hull'} ${listOf(hulls)}.`);
        const isPlural = broke.length > 1 || PLURAL_ROOMS.includes(rooms[0]);
        const damage = broke.length ? ` ${listOf(broke).replace(/^./, c => c.toUpperCase())} ${isPlural ? 'are' : 'is'} damaged.` : '';
        lines.push(hits ? `${count(hits)} ${hits > 1 ? 'scrapes' : 'scrape'} on the hull.${damage}` : 'No scrapes on the hull.');
        return lines;
    }
    // a scrape can only break a room that is a deck in the game (the fabrication bay on the inset is not one)
    const DECK_KEYS = MiniShip.ROOMS.map(r => r.key).filter(k => k !== 'upgrades');
    const startDamage = damaged => Object.fromEntries(DECK_KEYS.filter(k => damaged && damaged[k]).map(k => [k, true]));

    // ── the nebula: a tone field bigger than the screen, made once per page and sampled through the camera each frame.
    //    It takes about half a second, so it is built a few rows at a time while the page is idle, before the first jump. ──
    const NW = 800, NH = 520, IDLE_ROWS = 8, IDLE_MIN_MS = 4;
    const field = { tone: new Uint8Array(NW * NH), hue: new Uint8Array(NW * NH), band: new Float32Array(256), rows: 0 };
    // the band's glow by distance from its centre line: wide and faint, with a dark dust lane just above the middle
    for (let i = 0; i < 256; i++) { const d = i - 128; field.band[i] = Math.max(0, 0.33 * Math.exp(-((d / 30) ** 2)) - 0.24 * Math.exp(-(((d + 5) / 5) ** 2))); }
    const hs = (x, y, s) => { let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ s; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
    const noise = (x, y, s) => {
        const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
        const a = hs(xi, yi, s), b = hs(xi + 1, yi, s), c = hs(xi, yi + 1, s), d = hs(xi + 1, yi + 1, s);
        return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
    /** Fill the field's rows up to (not including) `until`. */
    function buildRows(until) {
        for (; field.rows < Math.min(until, NH); field.rows++) {
            const y = field.rows;
            for (let x = 0; x < NW; x++) {
                const n = noise(x / 120, y / 90, 11) * 0.55 + noise(x / 40, y / 30, 23) * 0.3 + noise(x / 11, y / 9, 37) * 0.15;
                field.tone[y * NW + x] = Math.round(clamp((n - 0.5) * 2.4, 0, 1) ** 1.3 * 255);
                field.hue[y * NW + x] = Math.round(clamp((noise(x / 190, y / 150, 51) - 0.5) * 3 + 0.5, 0, 1) * 255);
            }
        }
    }
    function nebulaField() { buildRows(NH); return field; }
    function buildWhileIdle(deadline) {
        while (field.rows < NH && deadline.timeRemaining() > IDLE_MIN_MS) buildRows(field.rows + IDLE_ROWS);
        if (field.rows < NH) window.requestIdleCallback(buildWhileIdle);
    }
    if (window.requestIdleCallback) window.requestIdleCallback(buildWhileIdle);

    // ── the hulls: our own class, seen from outside ──
    /** Half-width of an EXODUS-class hull at u: the rounded nose over the bridge, the taper at the stern (as MiniShip). */
    const hwAt = u => (u > DECKS[0] ? HW * (0.3 + 0.7 * Math.sin(((1 - u) / (1 - DECKS[0])) * Math.PI / 2))
        : u < DECKS[4] ? HW * (1 - 0.22 * (DECKS[4] - u) / (DECKS[4] - STERN)) : HW);
    /** Half-width of an engine bell at u (below STERN), widening to its mouth at u = -1. */
    const bellAt = u => HW * (0.17 + 0.24 * (STERN - u) / (1 + STERN));
    /** What is at (u, v) on hull h: u runs stern (-1) to nose (+1), v across; px is about one screen pixel in these units. */
    function hullAt(h, u, v, px, detail) {
        if (u > 1 || u < -1) return 0;
        const av = Math.abs(v);
        let torn = false;
        if (h.cut) {
            const jag = hash(Math.floor(v * 50) + 64, h.seed) * 0.09, lo = h.deck - 0.03 - jag, hi = h.deck + 0.07 + jag * 1.3;
            if (h.cut === 1) { if (u > lo && u < hi) return 0; torn = (u > lo - 0.035 && u <= lo) || (u >= hi && u < hi + 0.035); } // torn in two
            else if (h.cut === 2) { if (u > h.deck + jag) return 0; torn = u > h.deck + jag - 0.04; }                          // the front gone
            else { if (u < h.deck - jag) return 0; torn = u < h.deck - jag + 0.04; }                                           // the back gone
        }
        if (u < STERN) return Math.abs(av - HW * 0.5) < bellAt(u) ? M_BELL : 0;   // two engine bells
        const hw = hwAt(u);
        if (av > hw) return 0;
        if (torn && av < hw - px * 1.5) return M_INSIDE;
        if (!detail) return M_PLATE;
        if (u > 0.79 && u < 0.87 && av < hw * 0.45) return M_WINDOW;            // the bridge's forward window, dark
        for (let k = 0; k < 5; k++) {
            const d = DECKS[k];
            if (Math.abs(u - d) < px) return M_SEAM;
            if (px < 0.025 && u < d - 0.03 && u > d - 0.056 && av < hw - 0.05 && (v * 22 - Math.floor(v * 22)) < 0.45
                && hash(Math.floor(v * 22) + k * 31, h.seed) > 0.25) return M_WINDOW;                    // dark windows: nobody home
        }
        return M_PLATE;
    }
    /** A torn plate: four straight edges round the centre (inside one of the four triangles they make with it). */
    const crs = (ax, ay, bx, by) => ax * by - ay * bx;
    const shardAt = (f, u, v) => f.pts.some(([ax, ay], i) => {
        const [bx, by] = f.pts[(i + 1) % 4];
        return crs(ax, ay, u, v) >= 0 && crs(bx - ax, by - ay, u - ax, v - ay) >= 0 && crs(-bx, -by, u - bx, v - by) >= 0;
    });
    const plate = r => [0, 1, 2, 3].map(k => { const a = k * 1.571 + (r() - 0.5) * 0.9, d = 0.45 + r() * 0.55; return [Math.cos(a) * d, Math.sin(a) * d * 0.6]; });
    /** A dead hull drifting nose up just outside the box (or, from sector 3 on, the second one under it). */
    function makeHull(cfg, r, num, at, side, under) {
        const cut = r() < cfg.broken ? 1 + Math.floor(r() * 3) : 0, deck = DECKS[1 + Math.floor(r() * 3)];
        return {
            num, at, cut, deck, seed: (r() * 1e9) | 0, seenAt: -1, crossed: false, ph: r() * 3, period: 1.5 + r() * 0.7, bu: cut === 2 ? deck - 0.22 : 0.96,
            x: under ? side * (0.6 + r() * 2.6) : side * (BOX[0] + HW * HULL_L + 0.5 + r() * 0.6), y: under ? BOX[1] + 0.75 + HULL_L : -1.2 + r() * 1.8,
            a0: -Math.PI / 2 + (r() - 0.5) * (cut ? 0.5 : 0.3), spin: (r() - 0.5) * 0.012,
        };
    }
    /** Two different hull numbers from the sector's range (CANON.md §2), lower first: one from each half of it, none in `avoid`. */
    function hullNumbers([lo, hi], r, avoid = []) {
        const mid = Math.floor((lo + hi) / 2), picked = [];
        [[lo, mid], [mid + 1, hi]].forEach(([a, b]) => {
            const isFree = n => !avoid.includes(n) && !picked.includes(n);
            let n = a + Math.floor(r() * (b - a + 1));
            for (let k = 0; k < 30 && !isFree(n); k++) n = lo + Math.floor(r() * (hi - lo + 1));   // a used number: try the whole range
            picked.push(n);
        });
        return picked.sort((x, y) => x - y);
    }
    /** Does our ship's box touch hull h as it crosses our plane? (Only if you hug the edge of the box right beside it.) */
    function hullHit(h, cam, t) {
        const a = h.a0 + h.spin * t, ca = Math.cos(a), sa = Math.sin(a);
        return [[0, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]].some(([kx, ky]) => {
            const dx = cam[0] + kx * SHIP_R[0] - h.x, dy = cam[1] + ky * SHIP_R[1] - h.y;
            return hullAt(h, (dx * ca + dy * sa) / HULL_L, (-dx * sa + dy * ca) / HULL_L, 0.01, false) > 0;
        });
    }
    /** The safe line A.U.R.A. flies through the debris: a smooth wander that leans towards each hull as it passes, for a close look. */
    function safeLine(hulls, r) {
        const ph = [0, 1, 2, 3].map(() => r() * 6.28);
        const lean = tt => hulls.reduce((acc, h) => {
            const w = Math.exp(-(((tt - h.at) / 2.4) ** 2)), under = h.y > BOX[1];
            return [acc[0] + (under ? 0 : Math.sign(h.x) * 3 * w), acc[1] + (under ? 2.2 * w : 0)];
        }, [0, 0]);
        return tt => {
            const b = lean(tt);
            return [clamp(BOX[0] * (0.58 * Math.sin(0.4 * tt + ph[0]) + 0.16 * Math.sin(1.05 * tt + ph[1])) + b[0], -BOX[0] + 0.5, BOX[0] - 0.5),
                clamp(BOX[1] * (0.53 * Math.sin(0.55 * tt + ph[2]) + 0.15 * Math.sin(1.25 * tt + ph[3])) + b[1], -BOX[1] + 0.4, BOX[1] - 0.4)];
        };
    }
    /** Where in the course (course seconds) a piece of loose debris comes: in one of the waves, never in the first stretch. */
    function debrisAt(cfg, r) {
        let pick = r(), w = WAVES[WAVES.length - 1];
        for (const wave of WAVES) { if (pick < wave[2]) { w = wave; break; } pick -= wave[2]; }
        return clamp(w[0] + w[1] * (r() + r() - 1), DEBRIS_FROM, 0.97) * cfg.dur;
    }
    /** What each line is and when: the sector's own, the living's only, after A.U.R.A. naming any hull no crew line names. */
    function legLines(sector, hulls, living) {
        const own = (LINES[sector] || []).filter(l => l.role === 'AURA' || !living || living.has(l.role));
        const where = h => (h.y > BOX[1] ? 'below us' : h.x < 0 ? 'on our left' : 'on our right');
        const naming = hulls.map((h, k) => (own.some(l => l.seen === k + 1 && l.names) ? null
            : { seen: k + 1, who: 'A.U.R.A.', say: () => `Hull number ${fmt(h.num)}, ${where(h)}.` })).filter(Boolean);
        return [...naming, ...own].map(l => ({ ...l, done: false }));
    }
    /** The flight into `sector`: two hulls, the safe line, debris (some will set a course for wherever we are, and a cloud round
        each hull, none on the safe line), the twin in sector 5, the beacon count from `fromHeard` up to the sector's, and the lines. */
    function makeLeg(sector, r, fromHeard, living, avoid) {
        const cfg = SECTORS[sector], frags = [];
        let side = r() < 0.5 ? -1 : 1;
        const hulls = hullNumbers(cfg.hulls, r, avoid).map((num, k) => makeHull(cfg, r, num, cfg.dur * HULL_AT[k] + (r() - 0.5) * 0.6, side = -side, k === 1 && sector >= 3));
        const path = safeLine(hulls, r);
        const add = (at, x, y, rad, aimed) => {
            const [px, py] = path(at), keep = SHIP_R[0] + rad + 0.2, dx = x - px, dy = y - py, d = Math.hypot(dx, dy);
            if (d < keep) { x = px + (d ? dx / d : 1) * keep; y = py + (d ? dy / d : 0) * keep; }
            frags.push({ at, x, y, vx: 0, vy: 0, rad, aimed, a0: r() * 6.28, spin: (r() - 0.5) * 4, flip: 0.5 + r() * 3, pts: plate(r), done: false, gone: false });
        };
        for (let k = 0; k < cfg.debris; k++) {
            const inBox = r() < 0.62, at = debrisAt(cfg, r);
            add(at, (r() * 2 - 1) * (inBox ? BOX[0] + 0.5 : 13), (r() * 2 - 1) * (inBox ? BOX[1] + 0.4 : 9), 0.1 + r() * r() * 0.35, inBox && at > cfg.dur * 0.12 && r() < cfg.aim);
        }
        hulls.forEach(h => { for (let k = 0; k < 16; k++) { const a = r() * 6.28, d = HULL_L * (0.5 + r() * 1.4); add(h.at + (r() - 0.5) * 1.6, h.x + Math.cos(a) * d, h.y + Math.sin(a) * d, 0.06 + r() * 0.2, false); } });
        const twin = cfg.twin ? { side: r() < 0.5 ? -1 : 1, x: 0, y: 0, z: TWIN.behind, b: 0, q: -1, on: false, settled: false } : null;
        return { sector, cfg, path, hulls, twin, frags: frags.sort((a, b) => a.at - b.at), from: fromHeard, to: cfg.heard, seen: 0, lines: legLines(sector, hulls, living) };
    }

    // ── sound: quiet, and only while the game's sound is on ──
    function makeSound() {
        const PENTA = [880, 987.8, 1108.7, 1318.5, 1480];
        let bus = null;
        const gain = (ac, v) => { const g = ac.createGain(); g.gain.value = v; return g; };
        const filt = (ac, type, f, q) => { const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
        const osc = (ac, type, f, at, len) => { const o = ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, at); o.start(at); if (len) o.stop(at + len); return o; };
        const hiss = (ac, type, f, q) => { const src = ac.createBufferSource(); src.buffer = MiniLab.audio.noiseBuffer(); src.loop = true; return { src, f: src.connect(filt(ac, type, f, q)) }; };
        const stop = () => {
            if (bus) bus.srcs.forEach(o => { try { o.stop(); } catch (e) { /* already stopped */ } });
            try { if (bus) bus.out.disconnect(); } catch (e) { /* already gone */ }
            bus = null;
        };
        function ensure() {   // a bus that fades in: a low filtered hum (root, fifth, octave), an echo for the pings, a murmur of signals
            const ac = MiniLab.audio.get();
            if (!ac || !MiniLab.audio.master) { stop(); return null; }
            if (bus && bus.master === MiniLab.audio.master) return ac;
            stop();
            const now = ac.currentTime, out = gain(ac, 0), lp = filt(ac, 'lowpass', 220, 0.6), hum = gain(ac, 0.05), echo = ac.createDelay(1), mg = gain(ac, 0), mur = hiss(ac, 'bandpass', 900, 1.4);
            out.gain.setValueAtTime(0, now); out.gain.linearRampToValueAtTime(1, now + 1.5); out.connect(MiniLab.audio.master);
            hum.connect(lp).connect(out); echo.delayTime.value = 0.34; echo.connect(gain(ac, 0.3)).connect(echo); echo.connect(gain(ac, 0.45)).connect(out);
            const srcs = [[55, 'sine', 1], [82.4, 'sine', 0.45], [110.3, 'triangle', 0.2]].map(([f, type, v]) => { const o = osc(ac, type, f, now); o.connect(gain(ac, v)).connect(hum); return o; });
            mur.f.connect(mg).connect(out); mur.src.start();
            bus = { master: MiniLab.audio.master, out, lp, srcs: [...srcs, mur.src], echo, mg };
            return ac;
        }
        function env(ac, node, peak, attack, decay, at = ac.currentTime) {   // one short sound into the bus
            const g = gain(ac, 0);
            g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(peak, at + attack); g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
            return node.connect(g).connect(bus.out) && g;
        }
        return {
            stop,
            tick(mul, crowd) {                                    // the hum rises with speed; the murmur with the beacons heard
                const ac = ensure(), m = Math.min(14, mul), now = ac && ac.currentTime;
                if (ac) { bus.lp.frequency.setTargetAtTime(160 + m * 70, now, 0.25); bus.srcs[0].frequency.setTargetAtTime(55 * (1 + m * 0.015), now, 0.3); bus.mg.gain.setTargetAtTime(0.012 * crowd, now, 0.8); }
            },
            ping(level) {                                         // one beacon heard: a soft high note with a little echo
                const ac = ensure(), f = PENTA[Math.floor(Math.random() * 5)] * (level > 0.5 && Math.random() < 0.5 ? 0.5 : 1);
                if (ac) env(ac, osc(ac, 'sine', f, ac.currentTime, 0.62), 0.028 - level * 0.014, 0.006, 0.55).connect(bus.echo);
            },
            lock() {                                              // a hull named: two quiet notes
                const ac = ensure();
                if (ac) [[659, 0], [988, 0.09]].forEach(([f, d]) => { const at = ac.currentTime + d; env(ac, osc(ac, 'triangle', f, at, 0.36), 0.025, 0.01, 0.3, at); });
            },
            scrape() {                                            // muffled: low noise and a thump through the hull
                const ac = ensure(), now = ac && ac.currentTime, n = ac && hiss(ac, 'lowpass', 480, 0.9), o = ac && osc(ac, 'sine', 70, now, 0.45);
                if (ac) { env(ac, n.f, 0.1, 0.02, 0.5); n.src.start(now, Math.random()); n.src.stop(now + 0.6); env(ac, o, 0.11, 0.005, 0.4); o.frequency.exponentialRampToValueAtTime(38, now + 0.35); }
            },
            jump() {                                              // a slow rising rush
                const ac = ensure(), now = ac && ac.currentTime, n = ac && hiss(ac, 'lowpass', 140, 0.9);
                if (!ac) return;
                n.f.frequency.setValueAtTime(140, now); n.f.frequency.exponentialRampToValueAtTime(1500, now + JUMP_TIME);
                env(ac, n.f, 0.045, JUMP_TIME * 0.9, 0.7); n.src.start(now); n.src.stop(now + JUMP_TIME + 0.8);
            },
        };
    }

    function mount(ctx, ui, rawOpts) {
        const opts = rawOpts || {}, { from, to } = readSectors(opts), living = livingRoles(opts.crew), aboard = crewAboard(opts.crew);
        const perBreak = Math.max(1, asInt(opts.scrapesPerBreak) || 1);
        const avoid = Array.isArray(opts.avoidHulls) ? opts.avoidHulls.filter(Number.isFinite) : [];
        const C = MiniLab.C, P = {};
        Object.keys(C).forEach(k => { if (typeof C[k] === 'string' && /^#[0-9a-f]{6}$/i.test(C[k])) P[k] = u32(C[k]); });
        const RAMP = C.hull.map(u32), HALO = MiniLab.rgb(C.lightHalo), LIGHT = MiniLab.rgb(C.light), STAR = MiniLab.rgb(C.star);
        const img = ctx.createImageData(W, H), buf = new Uint32Array(img.data.buffer), depth = new Float32Array(W * H);
        const BAY = new Float32Array(16).map((_, i) => MiniLab.bayer(i & 3, i >> 2)), bay = (x, y) => BAY[((y & 3) << 2) | (x & 3)];
        const put = (x, y, c) => { if (x >= 0 && x < W && y >= 0 && y < H) buf[y * W + x] = c; };
        const dput = (x, y, tone, c) => { x = Math.round(x); y = Math.round(y); if (tone > bay(x, y)) put(x, y, c); };
        const ramp = (g, x, y) => { const pos = clamp(g, 0, 1) * 5, lo = pos | 0; return RAMP[Math.min(5, pos - lo > bay(x, y) ? lo + 1 : lo)]; };
        /** Mix pixel (x, y) towards colour c by a, in `steps` dithered steps: light that adds to the sky, never a screen door. */
        const glow = (x, y, c, a, steps) => {
            a = Math.min(1, Math.floor(a * steps + bay(x, y)) / steps);
            if (a <= 0 || x < 0 || x >= W || y < 0 || y >= H) return;
            const i = y * W + x, p = buf[i], r = p & 255, g = (p >> 8) & 255, b = (p >> 16) & 255;
            buf[i] = (0xff000000 | ((b + (c[2] - b) * a) << 16) | ((g + (c[1] - g) * a) << 8) | (r + (c[0] - r) * a)) >>> 0;
        };
        const fogAt = (z, near, far) => clamp((z - near) / (far - near), 0, 1) ** 0.8;
        const sound = makeSound(), shipL = MiniShip.layout(8, 172, 36, 76);
        let mode = 'ready', here = from, leg = null, t = 0, phaseT = 0, clock = 0, whiteAt = -99, rowAt = 0, auraT = 0, saidAt = -99, isEndReady = false;
        let auto = false, cam = [0, 0], vel = [0, 0], look = [0, 0], roll = 0, jolt = 0, nearT = 0, threat = false;
        let pointer = null, aiming = false, pressed = false, th = 0, queue = [], nextLine = 0, pinged = SECTORS[from].heard, pingAt = -9, farStars = [];
        const trail = [], held = new Set();   // where we were lately (the twin copies it); throttle keys pressed since the flight began
        const g = { heard: SECTORS[from].heard, heardAt: -9, seen: 0, hits: 0, damaged: startDamage(opts.damaged), hitRooms: [], nums: [], r: MiniLab.rng((Math.random() * 4294967295) >>> 0) };
        const view = { cr: 1, sr: 0, zm: 1, lx: 0, ly: 0, ox: 0, oy: 0, sunX: CX, sunY: CY, sunR: 0 };
        const taps = new Map(), STEER = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'd'], THROTTLE = [' ', 'w', 'Shift'];

        // the sky: stars fixed at infinity (they only pan and tilt), thick along the galaxy's band; dust in depth; streaks close by
        function seedSky(sector) {
            const r = MiniLab.rng(sector * 7919 + 13);
            here = sector;
            farStars = Array.from({ length: 1150 }, (_, i) => {
                const u = (r() - 0.5) * NW, inBand = i >= 470, k = r(), v = inBand ? bandV(u) + (r() + r() + r() - 1.5) * 34 : (r() - 0.5) * NH;
                return { u, v, c: k < 0.05 ? 'star' : k < 0.11 ? 'uiBright' : k < (inBand ? 0.3 : 0.42) ? 'textDim' : 'line2', tw: r() < 0.12 ? r() * 6.28 : -1 };
            });
        }
        const dustR = MiniLab.rng(4242);
        const newDust = far => ({ x: cam[0] + (dustR() * 2 - 1) * 40, y: cam[1] + (dustR() * 2 - 1) * 26, z: far ? FAR_DUST * (0.75 + 0.25 * dustR()) : 3 + dustR() * FAR_DUST });
        const newStreak = far => {   // never straight through the middle of us
            const x = (dustR() * 2 - 1) * 10, y = (dustR() * 2 - 1) * 7, push = Math.abs(x) < 1.2 && Math.abs(y) < 0.8 ? (x < 0 ? -1.2 : 1.2) : 0;
            return { x: cam[0] + x + push, y: cam[1] + y, z: far ? 42 + dustR() * 14 : 1 + dustR() * 55 };
        };
        const dust = Array.from({ length: 130 }, () => newDust(false)), streaks = Array.from({ length: 44 }, () => newStreak(false));

        // ── flow: ready → jump → run (the flight through the new sector) → done (A.U.R.A.'s report, then Continue) ──
        // a row of buttons; the second click of a double click must not land on the button that replaces the first
        const row = defs => { rowAt = clock; ui.buttons(defs.map(d => ({ ...d, onClick: () => { if (clock - rowAt > 0.3) d.onClick(); } }))); };
        const say = (who, line, gap) => { ui.say(who, line); saidAt = clock; nextLine = clock + gap; };
        function setAuto(on) {
            auto = on; say('A.U.R.A.', on ? 'I have the ship, Commander.' : 'You have the ship, Commander.', 2);
            row([{ label: on ? 'Take the stick' : 'Let A.U.R.A. fly', primary: on, onClick: () => setAuto(!auto) }]);
        }
        function start(isAuto) { mode = 'jump'; phaseT = 0; sound.jump(); setAuto(isAuto); }
        function arrive() {   // the flash clears on the new sector
            whiteAt = clock; seedSky(to);
            leg = makeLeg(to, g.r, g.heard, living, avoid); t = 0; mode = 'run';
        }
        /** Through: the ship cruises on into the light while A.U.R.A. reports, one line at a time. Only after her last line
            does the way on show, so a quick click (or a tap of Space for the throttle) cannot cut her off. */
        function reachEnd() {
            mode = 'done'; phaseT = 0;
            const crew = headCount(aboard), tell = { crew: crew === told.crew ? '' : crew, count: !leg.lines.some(l => l.done && l.heard === g.heard), briefing: !told.briefing };
            report(to, g.heard, g.nums, g.hits, g.hitRooms, tell).forEach(line => queue.push({ who: 'A.U.R.A.', line: () => line }));
            told = { crew, briefing: told.briefing || (tell.count && g.heard > BRIEFED) };
            nextLine = Math.max(nextLine, clock + REPORT_DELAY);
            row([]);
        }
        function showContinue() { isEndReady = true; row([{ label: 'Continue', primary: true, onClick: end }]); }
        function end() {
            ui.finish({ scrapes: g.hits, auraFlew: auraT >= leg.cfg.dur / 2, beaconsHeard: g.heard, shipsSeen: g.seen, hulls: [...g.nums], damagedRooms: [...g.hitRooms] });
        }

        // ── simulation ──
        /** The controls this frame: the arrows (a key counts while held, and for a moment after any press, so a quick tap between
            frames still steers), else where the pointer points; and whether the throttle is held. */
        function input() {
            const has = (...ks) => (ks.some(k => MiniLab.keys.has(k) || (taps.get(k) || 0) > clock) ? 1 : 0);
            const stick = [has('ArrowRight', 'd') - has('ArrowLeft', 'a'), has('ArrowDown') - has('ArrowUp')], keys = !!(stick[0] || stick[1]);
            if (keys) aiming = false;                                                   // the arrows have it until the pointer moves again
            held.forEach(k => { if (!MiniLab.keys.has(k)) held.delete(k); });
            return { stick, keys, aim: !keys && aiming && pointer ? aimAt(pointer) : null, throttle: pressed || held.size > 0 };
        }
        /** The spot in the box the pointer points at: the middle of the picture is the middle of the corridor. */
        const aimAt = p => [p.x - CX, p.y - CY].map((d, i) => clamp(d / AIM_REACH[i], -1, 1) * (BOX[i] - SHIP_R[i]));
        const zOf = at => (at - t) * SPEED + ZHIT;
        /** The ship eases off while a hull drifts past, so you can read it: slowest when the hull is about 15 units out. */
        const paceAt = tt => 1 - 0.6 * Math.max(0, ...leg.hulls.map(h => { const p = clamp(1 - Math.abs((h.at - tt) * SPEED + ZHIT - 15) / 13, 0, 1); return p * p * (3 - 2 * p); }));
        function glance() {   // the camera turns a little towards a named wreck as it slides past (and the twin), so they pass in frame
            const out = [0, 0], turn = (x, y, z, w) => { out[0] += w * clamp((x - cam[0]) / z, -0.6, 0.6); out[1] += w * clamp((y - cam[1]) / z, -0.6, 0.6); };
            if (mode !== 'run') return out;
            leg.hulls.forEach(h => {
                const z = zOf(h.at), w = GLANCE * clamp(Math.min((60 - z) / 30, (z - 3) / 6), 0, 1);
                if (h.seenAt >= 0 && w > 0) turn(h.x, h.y, z, w);
            });
            const tw = leg.twin, zc = tw && tw.z + HULL_L;
            if (tw && tw.on && zc > 1) turn(tw.x, tw.y, zc, TWIN.look * clamp((zc - 1) / 4, 0, 1));
            return out;
        }
        function fly(dt, ctl, rate) {
            const isRun = mode === 'run';
            if (auto && isRun && (ctl.keys || ctl.throttle)) setAuto(false);           // touching the controls takes the ship back
            const isAuto = auto && isRun, k = Math.min(1, dt * (isAuto ? 8 : 5));
            const want = !isRun ? [0, 0] : isAuto ? [0, 1].map(i => {                   // A.U.R.A. follows the safe line exactly
                const p = leg.path(t)[i], q = leg.path(t + 0.05)[i];
                return clamp((q - p) / 0.05 * rate + (p - cam[i]) * 5, -MAXV[i], MAXV[i]);
            }) : ctl.keys ? ctl.stick.map((s, i) => {                                   // soft edges: you ease off as you near them
                const w = s * MAXV[i], e = clamp((Math.abs(cam[i]) / BOX[i] - 0.35) / 0.65, 0, 1);
                return w * cam[i] > 0 ? w * (1 - e * e * (3 - 2 * e)) : w;
            }) : ctl.aim ? ctl.aim.map((a, i) => clamp((a - cam[i]) * AIM_GAIN, -MAXV[i], MAXV[i])) : [0, 0];   // the pointer: go there
            vel = vel.map((v, i) => v + (want[i] - v) * k);
            cam = cam.map((c, i) => clamp(c + vel[i] * dt, -BOX[i], BOX[i]) * (mode === 'done' ? 1 - Math.min(1, dt * 0.8) : 1));
            // the camera looks after you, late, and further while you steer; it banks into the turn and glances at wrecks.
            // Once through, it settles straight ahead on the light.
            const lean = isRun && ctl.keys && !isAuto ? ctl.stick : vel.map((v, i) => v / MAXV[i]), gl = glance();
            look = look.map((l, i) => l + ((mode === 'done' ? 0 : LOOK_POS[i] * cam[i] + LOOK_STICK[i] * lean[i] + gl[i]) - l) * Math.min(1, dt * 2));
            roll += (-BANK * (0.6 * vel[0] / MAXV[0] + 0.4 * lean[0]) - roll) * Math.min(1, dt * 2.5);
        }
        function reach(f) {                                                              // a fragment reaches our plane: does it touch us?
            const e = ((cam[0] - f.x) / (SHIP_R[0] + f.rad)) ** 2 + ((cam[1] - f.y) / (SHIP_R[1] + f.rad)) ** 2;
            f.done = true;
            if (e < 1 && !auto) { f.gone = true; scrape(); } else if (e < 2.4) nearT = 0.3;
        }
        function scrape() {                                                              // every perBreak-th scrape turns a room of the ship inset red
            const free = DECK_KEYS.filter(k => !g.damaged[k]);
            g.hits++; jolt = 0.45; sound.scrape();
            if (!free.length || g.hits % perBreak) return;
            const room = free[Math.floor(g.r() * free.length)];
            g.damaged = { ...g.damaged, [room]: true };
            g.hitRooms.push(room);
        }
        function drift(f, step) {                                                        // some debris sets a course for wherever we are
            if (f.aimed && zOf(f.at) < AIM_AT) {                                         // (about half would hit a ship that sat still)
                const left = f.at - t;
                f.aimed = false; if (!auto) { f.vx = (cam[0] + (g.r() - 0.5) * 1.6 - f.x) / left; f.vy = (cam[1] + (g.r() - 0.5) * 0.9 - f.y) / left; }
            }
            f.x += f.vx * step; f.y += f.vy * step;
        }
        function listen() {                                                              // transponders coming in, faster and faster
            const x = Math.min(1, t / (leg.cfg.dur * 0.94)), v = leg.from + (leg.to - leg.from) * x ** leg.cfg.curve;
            const heard = x >= 1 ? leg.to : Math.min(leg.to, Math.floor(leg.to < 20 ? v : v * (0.985 + Math.random() * 0.03)));
            if (heard > g.heard) { g.heard = heard; g.heardAt = clock; }
            if (g.heard <= pinged) return;                                               // one ping per beacon at first, then now and then
            if (g.heard <= 8 || clock > pingAt) { sound.ping(clamp(Math.log10(g.heard) / 4.4, 0, 1)); pingAt = clock + 0.45 + Math.random() * 0.35; }
            pinged = g.heard;
        }
        function queueLines() {                                                          // lines whose moment has come
            const twinReady = !!(leg.twin && leg.twin.settled);
            leg.lines.forEach(l => {
                if (l.done || leg.seen < (l.seen || 0) || g.heard < (l.heard || 0) || t < (l.at || 0) * leg.cfg.dur || (l.twin && !twinReady)) return;
                l.done = true; queue.push({ who: l.who, line: () => l.say(leg, g.heard) });
            });
        }
        /** Where we were exactly `lag` seconds ago, between two frames: [clock, x, y, course, throttle]. */
        function lagged(lag) {
            const when = clock - lag;
            for (let i = trail.length - 1; i > 0; i--) {
                const a = trail[i - 1], b = trail[i];
                if (a[0] <= when) { const k = b[0] > a[0] ? clamp((when - a[0]) / (b[0] - a[0]), 0, 1) : 1; return a.map((v, j) => v + (b[j] - v) * k); }
            }
            return trail[0];
        }
        /** Sector 5: a ship exactly like ours pulls up beside us, copies every move a quarter of a second late (so it drops
            back while we speed up, and its engines flare late), then falls behind as the debris thickens. */
        function moveTwin() {
            const tw = leg.twin;
            if (!tw) return;
            tw.q = (t / leg.cfg.dur - TWIN.from) / (TWIN.to - TWIN.from);
            tw.on = tw.q > 0 && tw.q < 1;
            if (!tw.on) return;
            const [, px, py, pt, pb] = lagged(TWIN.lag), near = smooth(clamp(tw.q / 0.2, 0, 1)) - smooth(clamp((tw.q - 0.78) / 0.22, 0, 1));
            tw.z = TWIN.behind + (TWIN.z - TWIN.behind) * near - (t - pt - TWIN.lag) * SPEED * TWIN.slip;
            tw.x = px + tw.side * TWIN.side; tw.y = py + TWIN.up; tw.b = pb;
            tw.settled = tw.settled || tw.q > TWIN.settled;
        }
        function runLeg(dt) {   // after the jump the ship drops out fast and settles to cruise, so far wrecks come up from the horizon
            const pace = paceAt(t), rate = pace * (1 + (BOOST - 1) * smooth(th) * pace) * (1 + DROP * Math.exp(-(clock - whiteAt) / 0.6)), step = dt * rate;
            t += step;
            if (auto) auraT += step;
            trail.push([clock, cam[0], cam[1], t, smooth(th)]);
            while (trail.length > 2 && trail[1][0] < clock - 1) trail.shift();
            leg.frags.forEach(f => { if (!f.done) { drift(f, step); if (f.at <= t) reach(f); } else if (!f.gone) { f.x += f.vx * step; f.y += f.vy * step; } });
            leg.hulls.forEach(h => {
                if (!h.crossed && h.at <= t) { h.crossed = true; if (!auto && hullHit(h, cam, t)) scrape(); }
                if (h.seenAt < 0 && zOf(h.at) < SEE_AT) { h.seenAt = clock; leg.seen++; g.seen++; g.nums.push(h.num); sound.lock(); }
            });
            moveTwin();
            listen();
            queueLines();
            if (t >= leg.cfg.dur) reachEnd();
            return rate;
        }
        /** How fast the world streams past: slow at the start, a rush in the jump, flight pace (more with the throttle), then cruise. */
        function speedMul(rate) {
            if (mode === 'run') return rate * lerp(1, FEEL / BOOST, smooth(th));
            if (mode === 'jump') return 1 + (phaseT / JUMP_TIME) ** 2 * 12;
            return mode === 'ready' ? 0.3 : DONE_MUL + (1 - DONE_MUL) * Math.exp(-phaseT / 0.8);
        }
        function update(dt) {
            clock += dt; jolt = Math.max(0, jolt - dt); nearT = Math.max(0, nearT - dt);
            if (queue.length && clock >= nextLine) { const q = queue.shift(), s = q.line(); say(q.who, s, q.gap || gapFor(s)); }
            if (mode === 'done' && !isEndReady && !queue.length && phaseT > REPORT_DELAY && clock - saidAt > CONTINUE_BEAT) showContinue();
            const ctl = input();
            if (mode === 'ready' && ctl.keys) start(false);                              // the arrows on the start screen just go
            const opening = ctl.throttle && mode === 'run';
            if (opening) throttleTaught = true;
            let rate = 1;
            if (mode === 'run') rate = runLeg(dt);
            else if (mode === 'jump' || mode === 'done') {
                phaseT += dt;
                if (mode === 'jump' && phaseT >= JUMP_TIME) arrive();
            }
            fly(dt, ctl, rate);                                                         // (this may hand the ship back from A.U.R.A.)
            th = clamp(th + (opening && !auto ? dt / BOOST_UP : -dt / BOOST_DOWN), 0, 1);  // A.U.R.A. never opens the throttle
            const mul = speedMul(rate), step = SPEED * mul * dt;
            for (let i = 0; i < dust.length; i++) { dust[i].z -= step; if (dust[i].z < NEAR) dust[i] = newDust(true); }
            for (let i = 0; i < streaks.length; i++) { streaks[i].z -= step; if (streaks[i].z < NEAR) streaks[i] = newStreak(true); }
            sound.tick(mul, mode === 'run' || mode === 'jump' ? clamp((Math.log10(g.heard + 1) - 1.3) / 3, 0, 1) : 0);
            return mul;
        }

        // ── drawing: the camera and the sky ──
        function setView() {   // the bank, where the camera looks, the push and shake of speed, a jolt after a scrape; the false sun sits dead ahead
            const b = smooth(th), shake = Math.max(0, (b - SHAKE_AT) / (1 - SHAKE_AT)) * 2.4 + 12 * jolt, rnd = () => Math.round((Math.random() - 0.5) * shake);
            view.cr = Math.cos(roll); view.sr = Math.sin(roll); view.zm = 1 - PUSH * b; view.lx = look[0] * F; view.ly = look[1] * F;
            view.ox = shake > 0 ? rnd() : 0; view.oy = shake > 0 ? Math.round(rnd() * 0.75) : 0;
            [view.sunX, view.sunY] = sky(0, 0);
        }
        /** A direction at infinity (in px at depth F) → the screen; and a point in the world → the screen. */
        const sky = (u, v) => {
            const du = (u - view.lx) * view.zm, dv = (v - view.ly) * view.zm;
            return [CX + view.ox + du * view.cr - dv * view.sr, CY + view.oy + du * view.sr + dv * view.cr];
        };
        const proj = (x, y, z) => sky((x - cam[0]) * F / z, (y - cam[1]) * F / z);
        function segZ(x0, y0, x1, y1, c, z, tone) {           // a line, behind anything nearer than z
            x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
            const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
            for (let n = 0, err = dx + dy; n < 700; n++) {
                if (x0 >= 0 && x0 < W && y0 >= 0 && y0 < H) { const i = y0 * W + x0; if (depth[i] > z && tone > bay(x0, y0)) buf[i] = c; }
                if (x0 === x1 && y0 === y1) break;
                const e2 = 2 * err;
                if (e2 >= dy) { err += dy; x0 += sx; }
                if (e2 <= dx) { err += dx; y0 += sy; }
            }
        }
        /** How far through the sector we are: the flight's share, or its end before the jump and after it. */
        const progress = () => (mode === 'run' ? Math.min(1, t / leg.cfg.dur) : 1);
        function drawBackdrop() {   // the nebula (mirrored or shifted per sector, thickening and thinning as we go) and the galaxy's band
            const { tone, hue, band } = nebulaField(), sec = SECTORS[here], fx = sec.flip, du = sec.nebU, p = progress();
            const str = (lerp(sec.neb[0], sec.neb[1], p) + NEB_SWELL * Math.sin(Math.PI * p)) / 255;   // tone is 0..255
            const cr = view.cr / view.zm, sr = view.sr / view.zm, ox = CX + view.ox, oy = CY + view.oy, hw = NW >> 1, hh = NH >> 1;
            for (let y = 0; y < H; y++) {
                const ey = y - oy, rowI = y * W, by = (y & 3) << 2, by2 = ((y + 2) & 3) << 2;
                let u = -ox * cr + ey * sr + view.lx, v = ox * sr + ey * cr + view.ly;
                for (let x = 0; x < W; x++, u += cr, v -= sr) {
                    const ix = Math.floor(hw + fx * u + du), iy = Math.floor(hh + v), b = BAY[by | (x & 3)], bi = (v - bandV(u) + 128) | 0;
                    let c = P.void;
                    if (ix >= 0 && ix < NW && iy >= 0 && iy < NH) {
                        const k = iy * NW + ix, bt = bi > 0 && bi < 256 ? band[bi] * (0.45 + hue[k] / 340) : 0;
                        if (bt > b) c = bt > 0.3 + b * 0.4 ? P.haze : P.nebA;
                        else if (tone[k] * str > b) c = hue[k] / 255 > BAY[by2 | ((x + 1) & 3)] ? P.nebA : P.nebB;
                    }
                    buf[rowI + x] = c;
                }
            }
            for (const s of farStars) {
                const p = sky(s.u, s.v), x = Math.round(p[0]), y = Math.round(p[1]);
                if (x >= 0 && x < W && y >= 0 && y < H) buf[y * W + x] = s.tw >= 0 && Math.sin(clock * 2.6 + s.tw) > 0.7 ? P.star : P[s.c];
            }
        }
        /** How big the light at the end of the heading is: it grows through the flight (fastest late) and with every sector. */
        function sunAmount() {
            const [a, b] = SECTORS[here].sun;
            if (mode === 'run') return a + (b - a) * progress() ** 1.5;
            return mode === 'done' ? b * (1 + (DONE_SUN - 1) * smooth(Math.min(1, phaseT / 3))) : b;   // before the jump: the sector we leave
        }
        /** The light: a point in the first sectors, a small glow by the middle, a warm bloom filling the view at the end. */
        function drawSun() {
            const amt = sunAmount();
            const sx = view.sunX, sy = view.sunY, rh = 4 + 112 * amt ** 1.5, rc = 0.6 + 7 * amt ** 1.7, inner = rc * 2.6 + 2, halo = 0.35 + 0.6 * Math.min(1, amt);
            view.sunR = amt > 0.3 ? rh * 0.55 : 0;                    // dust inside this catches the light
            for (let y = Math.max(0, Math.floor(sy - rh)); y <= Math.min(H - 1, sy + rh); y++) {
                for (let x = Math.max(0, Math.floor(sx - rh)); x <= Math.min(W - 1, sx + rh); x++) {
                    const d = Math.hypot(x - sx, y - sy);
                    if (d > rh) continue;
                    glow(x, y, HALO, (1 - d / rh) ** 2 * halo, 14);
                    glow(x, y, LIGHT, d <= rc ? 1 : clamp(1 - (d - rc) / inner, 0, 1) ** 1.6, 10);
                }
            }
            if (amt >= 0.15) for (let s = -rh * 1.9; s <= rh * 1.9; s++) glow(Math.round(sx + s * view.cr), Math.round(sy + s * view.sr), HALO, (1 - Math.abs(s) / (rh * 1.9)) ** 2 * 0.7 * Math.min(1, amt), 8);
            return amt;
        }
        function drawMotes(mul) {   // dust down the heading (lit warm where it crosses the light), streaks close by; speed stretches all
            const tail = 0.25 + mul * 1.15;
            for (let i = 0; i < dust.length; i++) {
                const d = dust[i], a = proj(d.x, d.y, d.z), b = mul > 1.5 ? proj(d.x, d.y, d.z + tail) : a;
                if (a[0] < -30 || a[0] > W + 30 || a[1] < -30 || a[1] > H + 30) { if (d.z < 80) dust[i] = newDust(true); continue; }
                const lit = Math.hypot(a[0] - view.sunX, a[1] - view.sunY) < view.sunR;
                segZ(b[0], b[1], a[0], a[1], lit ? P.lightHalo : d.z < 90 ? P.textDim : P.line2, d.z, d.z > 240 ? 0.55 : 0.95);
            }
            for (let i = 0; i < streaks.length; i++) {
                const s = streaks[i], a = proj(s.x, s.y, s.z), b = proj(s.x, s.y, s.z + tail);
                if (a[0] < -60 || a[0] > W + 60 || a[1] < -60 || a[1] > H + 60) { streaks[i] = newStreak(true); continue; }
                segZ(b[0], b[1], a[0], a[1], s.z < 14 ? P.textDim : P.line2, s.z, 0.85 * clamp((56 - s.z) / 14, 0, 1));
            }
        }

        // ── drawing: wrecks, the twin and debris ──
        /** Fill a shape centred on (sx, sy), turned by a, inside a box ex × ey; shape(u, v) works in units of `unit` px and returns a
            material (0 = empty). paint(px, py, i, edge, lean, m, u, v, lv): edge 1 faces the false sun, 2 faces away, 0 inside;
            lean is -1..1 towards the light; lv is the light's direction across the shape. */
        function raster(sx, sy, ex, ey, unit, a, shape, z, paint) {
            const ca = Math.cos(a), sa = Math.sin(a), inv = 1 / unit;
            const lx0 = view.sunX - sx, ly0 = view.sunY - sy, ll = Math.hypot(lx0, ly0) || 1, Lx = lx0 / ll, Ly = ly0 / ll;
            const lv = -Lx * sa + Ly * ca, du = (Lx * ca + Ly * sa) * inv, dv = lv * inv;
            for (let py = Math.max(0, Math.floor(sy - ey)); py <= Math.min(H - 1, Math.ceil(sy + ey)); py++) {
                const dy = py - sy;
                for (let px = Math.max(0, Math.floor(sx - ex)); px <= Math.min(W - 1, Math.ceil(sx + ex)); px++) {
                    const dx = px - sx, u = (dx * ca + dy * sa) * inv, v = (-dx * sa + dy * ca) * inv, m = shape(u, v);
                    if (!m) continue;
                    const edge = !shape(u + du, v + dv) ? 1 : !shape(u - du, v - dv) ? 2 : 0, i = py * W + px;
                    depth[i] = z;
                    paint(px, py, i, edge, (dx * Lx + dy * Ly) / Math.max(ex, ey), m, u, v, lv);
                }
            }
        }
        /** Plating lit from the side the false sun is on: a cylinder, with seams, dark windows and torn decks. */
        function hullTone(h, m, u, v, lv, detail) {
            if (m === M_INSIDE) return 0.05 + (DECKS.some(d => Math.abs(u - d) < 0.012) ? 0.24 : 0);
            if (m === M_SEAM || m === M_WINDOW) return m === M_SEAM ? 0.1 : 0.02;
            const c = clamp(v / (m === M_BELL ? HW * 0.9 : hwAt(u)), -1, 1), dif = Math.max(0, c * lv * 0.85 + Math.sqrt(1 - c * c) * 0.38);
            if (m === M_BELL) return 0.08 + 0.42 * dif;
            const tone = 0.15 + 0.5 * dif + (DECKS.findIndex(d => u > d) % 2 ? 0.035 : -0.02);   // each deck a slightly different plate
            return detail === 2 ? tone + (hash(Math.floor(u * 18) + 300 + Math.floor(v * 9) * 977, h.seed) - 0.5) * 0.08 : tone;
        }
        /** A beacon: warm, human-made, a double flash like a real marker light. It shows long before the hull does. */
        function beacon(bx, by, z, h) {
            const ph = (clock + h.ph) % h.period, r = clamp(1.8 + 46 / z, 1.8, 6), cx = Math.round(bx), cy = Math.round(by), R = Math.ceil(r);
            if (!(ph < 0.14 || (ph > 0.3 && ph < 0.44))) return;
            for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) { const d = Math.hypot(x, y) / r; if (d <= 1) dput(cx + x, cy + y, 0.7 * (1 - d) ** 1.4, P.warm); }
            [[1, 0], [-1, 0], [0, 1], [0, -1], [0, 0]].forEach(([x, y]) => put(cx + x, cy + y, r > 2.6 || !(x || y) ? P.warmBright : P.warm));
        }
        function brackets(cx, cy, rx, ry, c, arm = 4) {
            const x0 = Math.round(cx - rx), x1 = Math.round(cx + rx), y0 = Math.round(cy - ry), y1 = Math.round(cy + ry);
            for (const [ex, ey, dx, dy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) for (let i = 0; i < arm; i++) { put(ex + i * dx, ey, c); put(ex, ey + i * dy, c); }
        }
        function drawHull(h, z, sx, sy, tags, sunAmt) {
            const unit = HULL_L * F * view.zm / z, fog = fogAt(z, 30, FAR_HULL * 0.85), a = h.a0 + h.spin * t + roll, ca = Math.cos(a), sa = Math.sin(a);
            const ex = Math.abs(ca) * unit + Math.abs(sa) * HW * unit, ey = Math.abs(sa) * unit + Math.abs(ca) * HW * unit + 2;
            if (unit < 3.2) dput(sx, sy, 0.95 - fog * 0.4, unit < 2 ? P.haze : P.mist);   // a point down the heading
            else {
                const px = 0.6 / unit, detail = unit > 30 ? 2 : unit > 11 ? 1 : 0;
                const rimWarm = sunAmt > 0.4 ? (sunAmt - 0.4) * 0.9 * (1 - fog) : 0;     // deep in, the light catches the edges
                const cover = fog > 0.62 ? (fog - 0.62) * 2.2 : 0;                       // the farthest thin out into the haze
                raster(sx, sy, ex + 2, ey, unit, a, (u, v) => hullAt(h, u, v, px, detail), z, (x, y, i, edge, lean, m, u, v, lv) => {
                    const b = bay(x, y);
                    if (cover > b) return;
                    if (edge === 1 && rimWarm > b) { buf[i] = P.lightHalo; return; }
                    const tone = edge === 1 ? 0.86 : edge === 2 ? 0.08 : hullTone(h, m, u, v, lv, detail);
                    buf[i] = ramp(tone + (FOG_T - tone) * fog, x, y);
                });
            }
            beacon(sx + h.bu * unit * ca, sy + h.bu * unit * sa, z, h);
            if (h.seenAt < 0) { if (unit < 14) brackets(sx, sy, 4 + unit * 0.4, 4 + unit, P.uiDim, 2); return; }   // a contact, not yet named
            const since = clock - h.seenAt;
            if (since < 1.6 && Math.floor(since * 5) % 2 === 0) brackets(sx, sy, ex + 3, ey + 1, P.ui);
            if (sx > -20 && sx < W + 20 && sy - ey < H - 24 && sy + ey > 24) tags.push({ z, s: 'EXODUS-' + fmt(h.num), sx, sy: sy - ey - 14, below: sy + ey + 4, fresh: since < 1.6 });
        }
        /** One slice of the twin, a disc at depth z. Seen from behind with the light ahead, the hull is dark; its outline (where
            the slice's edge turns side-on to us) catches the light. face: the flat stern plate, in shadow; tone: a deck's shade. */
        function twinSlice(cx, cy, R, z, tone, face, rimWarm) {
            if (R < 0.4 || cx + R < 0 || cx - R >= W || cy + R < 0 || cy - R >= H) return;
            const lx0 = view.sunX - cx, ly0 = view.sunY - cy, ll = Math.hypot(lx0, ly0) || 1, Lx = lx0 / ll / R, Ly = ly0 / ll / R, R2 = R * R, E2 = Math.max(0, R - 1.3) ** 2;
            for (let y = Math.max(0, Math.floor(cy - R)); y <= Math.min(H - 1, Math.ceil(cy + R)); y++) {
                const dy = y - cy;
                for (let x = Math.max(0, Math.floor(cx - R)); x <= Math.min(W - 1, Math.ceil(cx + R)); x++) {
                    const dx = x - cx, d2 = dx * dx + dy * dy;
                    if (d2 > R2) continue;
                    const i = y * W + x, c = dx * Lx + dy * Ly;
                    depth[i] = z;
                    if (face) buf[i] = ramp(d2 > E2 ? 0.3 : 0.05, x, y);
                    else if (Math.abs(c) < 0.24 || (face === null && c > -0.3 && d2 > E2)) buf[i] = rimWarm > bay(x, y) ? P.lightHalo : ramp(0.74, x, y);
                    else buf[i] = ramp(tone * (0.2 + 0.2 * Math.max(0, c)), x, y);
                }
            }
        }
        /** Sector 5's twin: a ship exactly like ours beside us, seen from behind: the hull as slices from the nose (far) to the
            engine bells (near), then the bells' mouths, burning brighter as its throttle opens. */
        function drawTwin(tw, sunAmt) {
            const s = z => F * view.zm / Math.max(z, NEAR), a = proj(tw.x, tw.y, Math.max(tw.z, NEAR)), b = proj(tw.x, tw.y, tw.z + 2 * HULL_L);
            const n = clamp(Math.ceil(Math.hypot(a[0] - b[0], a[1] - b[1]) * 1.4), 40, 200), rimWarm = sunAmt > 0.4 ? (sunAmt - 0.4) * 0.9 : 0;
            const bells = [-1, 1].map(k => tw.x + k * HW * 0.5 * HULL_L), face = Math.ceil(n * (1 + STERN) / 2);
            for (let k = n; k >= 0; k--) {                                                           // far to near
                const u = -1 + (2 * k) / n, z = tw.z + (u + 1) * HULL_L;
                if (z < NEAR) break;
                if (u < STERN) { bells.forEach(bx => { const [cx, cy] = proj(bx, tw.y, z); twinSlice(cx, cy, bellAt(u) * HULL_L * s(z), z, 1.4, false, rimWarm); }); continue; }
                const [cx, cy] = proj(tw.x, tw.y, z), seam = DECKS.some(d => Math.abs(u - d) < 1.5 / n), deck = DECKS.findIndex(d => u > d) % 2 ? 1.15 : 0.9;
                twinSlice(cx, cy, hwAt(u) * HULL_L * s(z), z, seam ? 0.45 : deck, k === face ? true : u > DECKS[0] ? null : false, rimWarm);
            }
            if (tw.z < NEAR) return;
            const flare = 0.45 + 0.55 * tw.b;
            bells.forEach(bx => {                                                                   // the engines, burning
                const [cx, cy] = proj(bx, tw.y, tw.z), R = bellAt(-1) * HULL_L * s(tw.z), RH = R * (1.5 + 1.5 * tw.b);
                for (let y = Math.max(0, Math.floor(cy - RH)); y <= Math.min(H - 1, cy + RH); y++) for (let x = Math.max(0, Math.floor(cx - RH)); x <= Math.min(W - 1, cx + RH); x++) {
                    const d = Math.hypot(x - cx, y - cy);
                    if (d < R * 0.6) { const k = flare * (1 - (d / (R * 0.6)) ** 2); buf[y * W + x] = k > 0.55 + bay(x, y) * 0.2 ? P.light : k > 0.2 ? P.warmBright : P.warm; }
                    else if (d < RH) glow(x, y, HALO, (1 - d / RH) ** 2 * 0.55 * flare, 10);
                }
            });
        }
        function drawFrag(f, z, sx, sy) {
            const R = f.rad * F * view.zm / z, fog = fogAt(z, 14, FAR_FRAG), face = Math.cos(f.flip * clock + f.a0), glint = face > 0.97 && z < 95;  // face-on to the light
            if (R < 1.4) {
                if (glint) put(Math.round(sx), Math.round(sy), P.star);
                else dput(sx, sy, 1 - fog * 0.8, f.threat ? P.danger : R < 0.7 ? P.haze : P.mist);
                return;
            }
            const sq = 0.22 + 0.78 * Math.abs(face);                                    // tumbling: the plate turns edge-on and back
            raster(sx, sy, R + 1, R + 1, R, f.a0 + f.spin * clock + roll, (u, v) => shardAt(f, u, v / sq), z, (x, y, i, edge, lean) => {
                if (f.threat && edge) { buf[i] = P.danger; return; }
                const tone = edge === 1 ? 0.8 : edge === 2 ? 0.08 : 0.2 + 0.22 * lean + 0.28 * Math.abs(face);
                buf[i] = ramp(tone + (FOG_T - tone) * fog, x, y);
            });
            if (!glint) return;                                                         // a glint: a point and a small cross that fades
            const gx = Math.round(sx + (view.sunX - sx) * 0.02), gy = Math.round(sy + (view.sunY - sy) * 0.02), arm = Math.min(4, Math.floor(R / 2));
            put(gx, gy, P.star);
            for (let i = 1; i <= arm; i++) [[i, 0], [-i, 0], [0, i], [0, -i]].forEach(([dx, dy]) => dput(gx + dx, gy + dy, 1 - i / (arm + 1), P.star));
        }
        function drawField(sunAmt) {   // far to near; kind 0 debris, 1 a hull, 2 the twin
            const vis = [], tags = [];
            threat = false;
            leg.hulls.forEach(h => { const z = zOf(h.at); if (z > NEAR && z < FAR_HULL) vis.push([z, h, 1]); });
            if (leg.twin && leg.twin.on && leg.twin.z + 2 * HULL_L > NEAR) vis.push([leg.twin.z + HULL_L, leg.twin, 2]);
            leg.frags.forEach(f => {
                const z = zOf(f.at), left = f.at - t;
                if (f.gone || z < NEAR || z > FAR_FRAG) return;
                f.threat = mode === 'run' && !f.done && !auto && left < WARN
                    && ((cam[0] - f.x - f.vx * left) / (SHIP_R[0] + f.rad)) ** 2 + ((cam[1] - f.y - f.vy * left) / (SHIP_R[1] + f.rad)) ** 2 < 1;
                threat = threat || f.threat;
                vis.push([z, f, 0]);
            });
            vis.sort((p, q) => q[0] - p[0]).forEach(([z, w, kind]) => {
                if (kind === 2) { drawTwin(w, sunAmt); return; }
                const [sx, sy] = proj(w.x, w.y, z);
                if (kind) drawHull(w, z, sx, sy, tags, sunAmt); else drawFrag(w, z, sx, sy);
            });
            return tags;
        }

        // ── drawing: what the pilot sees besides the view ──
        function drawBox() {   // our own size where things cross us: corner brackets, turning with the bank
            const col = jolt > 0 ? P.danger : threat && Math.floor(clock * 8) % 2 ? P.danger : nearT > 0 ? P.uiBright : P.uiDim;
            const c = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([kx, ky]) => proj(cam[0] + kx * SHIP_R[0], cam[1] + ky * SHIP_R[1], ZHIT));
            c.forEach((p, k) => [c[(k + 1) % 4], c[(k + 3) % 4]].forEach(q => {
                const dx = q[0] - p[0], dy = q[1] - p[1], d = Math.hypot(dx, dy) || 1, L = Math.min(8, d / 3);
                segZ(p[0], p[1], p[0] + dx / d * L, p[1] + dy / d * L, col, -1, 1);
            }));
        }
        function panel(x0, y0, x1, y1) {
            for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) buf[y * W + x] = y === y0 || y === y1 || x === x0 || x === x1 ? (jolt > 0 ? P.danger : P.line2) : P.void;
        }
        function drawOverlays() {
            if (jolt > 0) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {          // a scrape: the edges flash
                const e = Math.min(x, y, W - 1 - x, H - 1 - y);
                if (e < 9) dput(x, y, jolt * 1.5 * (1 - e / 9), P.danger);
            }
            // the jump: stars stretch, then one short flash from the light that clears as the next sector opens
            const white = mode === 'jump' ? clamp((phaseT - JUMP_TIME + 0.3) / 0.25, 0, 1) : clamp(1 - (clock - whiteAt) / 0.45, 0, 1);
            if (white > 0) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) glow(x, y, STAR, white * 1.6 - Math.hypot(x - view.sunX, y - view.sunY) / 300, 8);
            panel(4, 168, 47, 265);                                            // behind our own ship
        }
        function drawThrust() {   // our own engines burn longer and brighter as the throttle opens (and in the jump)
            const b = Math.max(smooth(th), mode === 'jump' ? phaseT / JUMP_TIME : 0), top = shipL.rooms[shipL.rooms.length - 1].bottom + 3;
            if (b < 0.03) return;
            [-1, 1].forEach(side => {
                const ex = shipL.cx + side * shipL.maxHalf * 0.4, len = 4 + 14 * b + 1.5 * Math.sin(clock * 37 + side);
                for (let d = 0; d < len; d++) MiniLab.shade(ctx, ex - 2.5 + d * 0.25, top + d, 5.5 - d * 4.5 / len, 1, (1 - d / len) * (0.55 + 0.45 * b), d < 2 + 3 * b ? C.light : C.warm);
            });
        }

        // ── text, drawn over the picture ──
        function stext(s, x, y, color, sc = 1) { MiniLab.text(ctx, s, x + 1, y + 1, C.void, sc); return MiniLab.text(ctx, s, x, y, color, sc); }
        const centred = (s, cx, y, c, sc = 1) => stext(s, Math.round(cx - MiniLab.textWidth(s, sc) / 2), y, c, sc);
        const right = (s, rx, y, c, sc = 1) => stext(s, Math.round(rx - MiniLab.textWidth(s, sc)), y, c, sc);
        function drawTags(tags) {
            const placed = [];
            for (const tag of tags.sort((p, q) => p.z - q.z)) {               // nearest first gets the space
                const tw = MiniLab.textWidth(tag.s, 2), x = Math.round(clamp(tag.sx - tw / 2, 4, W - tw - 4));
                const onSun = view.sunX > x - 6 && view.sunX < x + tw + 6 && Math.abs(view.sunY - tag.sy - 5) < 12;   // never cover the light
                const y = Math.round(clamp(onSun ? tag.below : tag.sy, 34, 226));
                if (placed.some(p => x < p[0] + p[2] + 4 && x + tw + 4 > p[0] && y < p[1] + 14 && y + 14 > p[1])) continue;
                if ([0, 0.5, 1].some(f => depth[(y + 4) * W + Math.round(x + tw * f)] < tag.z - 0.3)) continue;  // hidden behind something nearer
                placed.push([x, y, tw]);
                ctx.fillStyle = C.void; ctx.fillRect(x - 2, y - 2, tw + 4, 14);
                MiniLab.text(ctx, tag.s, x, y, tag.fresh ? C.uiBright : tag.z < 30 ? C.text : C.textDim, 2);
            }
        }
        function drawHud() {   // the radio's count; who flies; on the start screen how to steer; once, how to go faster
            if (auto && (mode === 'run' || mode === 'jump')) right('A.U.R.A. FLYING', W - 8, 8, C.ui);
            if (mode !== 'done') {
                right('BEACONS HEARD', W - 8, 246, C.textDim);
                right(fmt(g.heard), W - 8, 254, clock - g.heardAt < 0.35 ? C.uiBright : C.text, 2);
            }
            if (mode === 'ready') { centred('STEER CLEAR OF THE DEBRIS', CX, 180, C.text, 2); centred('USE THE MOUSE OR THE ARROWS', CX, 196, C.textDim, 2); }
            if (mode === 'run' && !auto && !throttleTaught && clock - whiteAt > 1.2) stext('HOLD TO GO FASTER', 54, 252, C.uiBright);
        }
        function render(mul) {   // far to near: nebula, band and stars, the false sun, wrecks and debris, dust; then the instruments
            setView(); depth.fill(1e9);
            drawBackdrop();
            const amt = drawSun(), tags = mode === 'run' ? drawField(amt) : [];
            drawMotes(mul);
            if (mode === 'ready' || mode === 'run') drawBox();
            drawOverlays();
            ctx.putImageData(img, 0, 0);
            MiniShip.draw(ctx, shipL, clock * 1000, { damaged: g.damaged, labels: false });
            drawThrust();
            if (mode === 'run') drawTags(tags);
            drawHud();
        }

        // ── input: the pointer steers wherever it is over the picture; holding the button (or Space, W, Shift) is the throttle ──
        ui.canvas.onpointermove = e => { pointer = ui.toPixel(e); aiming = true; };
        ui.canvas.onpointerleave = () => { if (!pressed) pointer = null; };
        ui.canvas.onpointerdown = e => {
            if (e.button) return;                                                       // the main button (or a touch) only
            pointer = ui.toPixel(e); aiming = true;
            if (mode === 'ready') { start(false); return; }                             // the click that starts the flight is not the throttle
            pressed = true;
            try { ui.canvas.setPointerCapture(e.pointerId); } catch (_) { /* capture is optional */ }
        };
        const release = () => { pressed = false; };
        ui.canvas.onpointerup = release;
        window.addEventListener('pointerup', release); window.addEventListener('pointercancel', release);
        MiniLab.onKey((k, e) => {
            const isRepeat = !!(e && e.repeat), isOnButton = !!(e && e.target && e.target.tagName === 'BUTTON');
            if (STEER.includes(k)) { taps.set(k, clock + 0.12); return; }
            if (THROTTLE.includes(k) && mode !== 'ready' && !isRepeat && !(k === ' ' && isOnButton)) held.add(k);
            const isGo = k === ' ' || k === 'Enter';
            if (!isGo || isOnButton || isRepeat) return;                                // a focused button handles its own
            if (mode === 'ready') start(false);
            else if (mode === 'done' && isEndReady && clock - rowAt > (k === 'Enter' ? 0.3 : 1)) end();   // only once A.U.R.A. is done
        });

        seedSky(from);
        say('A.U.R.A.', 'Debris on the heading, Commander. I can fly us through, if you prefer.', 0);
        row([{ label: 'Fly it myself', primary: true, onClick: () => start(false) }, { label: 'Let A.U.R.A. fly', onClick: () => start(true) }]);
        render(0.3);
        MiniLab.loop(dt => render(update(dt)), 30);
        return () => { window.removeEventListener('pointerup', release); window.removeEventListener('pointercancel', release); queue = []; sound.stop(); };
    }

    MiniHost.register({
        id: 'corridor',
        title: 'Fly the corridor',
        kicker: 'Sector jump',
        hideHeader: true,                                   // a pilot sees the flight, not a game title over it
        mount,
        autoResult(opts) {
            const { to } = readSectors(opts || {});
            return { scrapes: 0, auraFlew: true, beaconsHeard: SECTORS[to].heard, shipsSeen: SHIPS_PER_JUMP, hulls: [], damagedRooms: [] };
        },
    });
})();
