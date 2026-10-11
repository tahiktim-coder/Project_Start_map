/* Corridor.js — Fly the corridor: every sector jump, flown (ported from prototypes/sim-bay/proto-corridor.js).
   The ship jumps, drops out in the next sector and flies down the heading for about a minute: quiet stretches of space,
   debris that comes in waves, two dead hulls far apart. The radio counts every transponder it hears (eight, then hundreds,
   then tens of thousands), but only those two hulls come close enough to SEE. Each is a point with a warm beacon far down
   the heading; it grows out of the haze and passes large while the camera glances at it: our own class, some torn in two.
   In sector 5 a ship exactly like ours flies beside us for a while, a quarter of a second late; in sector 6 the light at
   the end of the heading fills the view. The ship follows the pointer (or the arrows); holding the mouse, Space, W or Shift
   opens the throttle, so the end comes sooner and the debris faster. Once through, A.U.R.A. says what the flight found, one
   line at a time. A.U.R.A. can fly: steady, never faster. Quiet sound, only when the game's is on.
   THE LOOK (2026-10-11) is the travel view's, drawn at density 1.5 (720 × 405 art pixels; the flight still thinks in 480 × 270
   units): each sector's sky is its place in sky F (the band, the rare colours and its enormous thing: the vast planet, the
   dark clouds and the spiral, the shell and its pulsar, the pillars, the eye, the ring of lit dust round the light); the light
   is the travel view's false sun; the wrecks and the twin are our own Lander; the corner shows our Lander with its decks lit,
   its blue drive burning with the throttle. The readouts are the frame's quiet notes. See THE LOOK below.

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
    const hash = (n, s) => { const h = Math.imul(Math.imul(n, 374761393) ^ s, 1274126177); return ((h ^ (h >>> 15)) & 1023) / 1023; };
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
    // a scrape can only break a room that is a deck in the game (the inset's med bay, MiniShip's old 'upgrades' key, is not one)
    const DECK_KEYS = MiniShip.ROOMS.map(r => r.key).filter(k => k !== 'upgrades');
    const startDamage = damaged => Object.fromEntries(DECK_KEYS.filter(k => damaged && damaged[k]).map(k => [k, true]));

    // ══ THE LOOK (2026-10-11): the travel view's. src/newscreen/art (Paint.js, Sky.js, Sky2.js sky F), docs/ART_STYLE.md: ramps
    //    that all start at the ink, 8 × 8 Bayer dither per art pixel, seeded noise, one light, the universe cold and the lie warm.
    //    The flight is drawn at density 1.5 (720 × 405 art pixels) and still thinks in 480 × 270 units. This file keeps its own
    //    copy of every ramp and sky recipe it paints with, so the default game (where src/newscreen/ is not loaded) looks the same. ══
    const DENSITY = 1.5;
    // the space strip's dust: how strongly it shows (Paint.js paintSpace has 2.8; a little less here, where the light is always
    // in view), how far the light warms it (units, plus the light's own size), how much shows away from it; the nebula's mean
    // thickness (SECTORS neb), which the haze and dust follow; the haze a little quieter than the travel view's
    const DUST_GAIN = 2.2, DUST_REACH = 90, DUST_LIT0 = 0.04, NEB_MEAN = 0.42, HAZE_GAIN = 0.75;
    const BLOOM = 0.55, BLOOM_FROM = 0.5, BLOOM_FULL = 1.6;     // the light's warm bloom: its strength, and the light's size it starts and peaks at
    const PAINT_AHEAD_MS = 8;                                  // each frame, this long goes to painting the sky of the sector we jump to
    const LEG_W = 0.4, WRECK_LIGHT = 0.72;
    const TAG_TOP = 30, TAG_BOTTOM = 222;                        // where a hull's name may sit (units): clear of the readouts                                          // a wreck's half-width with its folded legs, in half-lengths (its drawing box)
    const RUST_SHARE = { 1: 0.1, 2: 0.1, 3: 0.3, 4: 0.45, 5: 0.6, 6: 0.7 };   // the share of a wreck's plates gone to rust: older further in
    const INK = '#05070a';
    const HEX = {
        // NSPaint.RP
        STAR: [INK, '#1b272c', '#4c5f66', '#b3c2c0', '#f6f1e4'],
        HAZE: [INK, '#0a1317', '#0f222a', '#152f38', '#1f3a43'],
        DUST: [INK, '#160f0b', '#2c1a10', '#4e2f1a', '#7c4a26', '#b0733c'],
        SUN: [INK, '#1f140b', '#4a2e12', '#9a5a26', '#e9a25e', '#f7c483', '#fff3dc'],
        HULL: [INK, '#121c22', '#22333b', '#3d5560', '#8aa2aa', '#e6eef0'],
        UI: [INK, '#13232a', '#284650', '#3d6670', '#9fd8e6', '#e1f6fb'],
        AMBER: [INK, '#3a2410', '#8a5422', '#e8964a', '#f7c483', '#fff3dc'],
        RED: [INK, '#3a1210', '#8a2a22', '#e2574c', '#ffd2c8'],
        RUST: [INK, '#140f0e', '#261c19', '#3a2b25', '#564034', '#7a604f'],
        PLUME: [INK, '#0e1a26', '#183048', '#2a5878', '#5a9cc4', '#b4e2f4', '#f2fbff'],
        ICE: [INK, '#0c1a20', '#1a3440', '#33606e', '#7fb3c2', '#d6eef4'],
        STONE: [INK, '#13181a', '#272f31', '#465153', '#7c8786', '#c4ccc8'],
        DESERT: [INK, '#1a110c', '#38231a', '#664129', '#9c6a42', '#d0a376'],
        GAS: [INK, '#1c120b', '#3f2715', '#6c4523', '#a26f3b', '#d9ad74'],
        // NSSky.R and NSSky2's colours
        BAND: [INK, '#090c11', '#0e131b', '#151c26', '#202a36', '#33404e'],
        GAL: [INK, '#0b0f15', '#141b25', '#212b37', '#36424f', '#5d6a76', '#9aa6ad'],
        OLD: [INK, '#0d0d10', '#19181b', '#2a2828', '#433e3a', '#6c6459', '#a39783'],
        TEAL: [INK, '#061114', '#0a1a1e', '#0f252a', '#153237', '#1e4146', '#2c565b'],
        SRUST: [INK, '#130c09', '#21150d', '#352112', '#4e3119', '#6d4522', '#91602f'],
        SICE: [INK, '#0b151b', '#132330', '#1f3546', '#33506a', '#5a7c95', '#9cbacb'],
        LIMB: [INK, '#0a1015', '#121d26', '#1d2e3b', '#2e4658', '#4f6e84', '#8fb0c2'],
        NIGHT: [INK, '#07090d', '#0a0d12', '#0e1218'],
        WARM: [INK, '#2a1f14', '#6a4b2c', '#b48650', '#efcf9c'],
        COLD: [INK, '#141f29', '#355468', '#7fa5bc', '#d6e9f2'],
        GIANT: [INK, '#27130f', '#56271b', '#965034', '#d39068'],
        CORE: [INK, '#0d0b0a', '#181411', '#251e18', '#372a20', '#4e3b2a', '#6c5139'],
        MOSS: [INK, '#08100d', '#0c1813', '#12221a', '#1a3024', '#264131', '#365641'],
        EMBER: [INK, '#170d09', '#2e170d', '#4a2515', '#6e381d', '#9a5328', '#c67c42'],
        BEAM: [INK, '#0c1820', '#16293a', '#25425a', '#3f6684', '#7aa2bf'],
        FAR: [INK, '#0d1114', '#1a2025', '#2b333a', '#48525a', '#6f7a82'],
        // NSSky2.ACC: the rare colours, dull but distinct
        ROSE: [INK, '#140b0e', '#2a161b', '#47252d', '#6a3a42', '#8f5a5e', '#b07d7b'],
        VERDIGRIS: [INK, '#08130f', '#11271f', '#1d4136', '#2e5f51', '#4b8271', '#7aa898'],
        SLATE: [INK, '#0d0c14', '#191724', '#282538', '#3c3850', '#57516c', '#7b7590'],
        CRIMSON: [INK, '#160606', '#2c0c0b', '#4a1512', '#6b2119', '#8c3424', '#a85138'],
        SULPHUR: [INK, '#12110a', '#262412', '#433f1d', '#665f2b', '#8c8240', '#ada25e'],
        OCHRE: [INK, '#150e07', '#2c1d0d', '#4a3014', '#6d471d', '#93622b', '#b48144'],
        JADE: [INK, '#0a110d', '#15241b', '#233a2c', '#365441', '#527359', '#7b977f'],
    };
    /** Each ramp as the pixel buffer wants it: id, steps, colours as little-endian 32-bit pixels, and each step's brightness. */
    const lumOf = ([r, g, b]) => (r * 77 + g * 150 + b * 29) >> 8;
    const RAMPS = [null], R = {};
    Object.keys(HEX).forEach(name => {
        const rgb = HEX[name].map(MiniLab.rgb);
        R[name] = { id: RAMPS.length, n: rgb.length, rgb, c32: Uint32Array.from(rgb.map(([r, g, b]) => (0xff000000 | (b << 16) | (g << 8) | r) >>> 0)), lum: Uint8Array.from(rgb.map(lumOf)) };
        RAMPS.push(R[name]);
    });
    const INK32 = R.STAR.c32[0];
    // the same, flat, for the sky's per-pixel loop: ramp id × 8 + step; and the tone scale per ramp (a tone byte → its step position)
    const FLAT32 = new Uint32Array(RAMPS.length * 8), FLATLUM = new Uint8Array(RAMPS.length * 8), STEPS = new Float32Array(RAMPS.length);
    RAMPS.forEach((r, id) => { if (!r) return; STEPS[id] = (r.n - 1) / 255; r.c32.forEach((c, k) => { FLAT32[id * 8 + k] = c; FLATLUM[id * 8 + k] = r.lum[k]; }); });
    const LIT_SHIFT = 6, LIT = new Float32Array(16384);          // the light's reach on the dust, looked up by distance² (in steps of 64)
    const BAY8 = Float32Array.from({ length: 64 }, (_, i) => MiniLab.bayer8(i & 7, i >> 3));
    /** The step of ramp r at tone v for art pixel (x, y): the 8 × 8 grain decides between the two nearest. */
    const level = (r, v, x, y) => { const pos = (v > 1 ? 1 : v < 0 ? 0 : v) * (r.n - 1), lo = pos | 0; return pos - lo > BAY8[((y & 7) << 3) | (x & 7)] ? lo + 1 : lo; };
    /** How bright ramp r is at tone v, between its steps. */
    const lumAt = (r, v) => { const pos = (v > 1 ? 1 : v < 0 ? 0 : v) * (r.n - 1), lo = pos | 0, hi = Math.min(r.n - 1, lo + 1); return r.lum[lo] + (r.lum[hi] - r.lum[lo]) * (pos - lo); };
    const lum32 = p => ((p & 255) * 77 + ((p >> 8) & 255) * 150 + ((p >> 16) & 255) * 29) >> 8;
    const ss = (a, b, v) => { const k = clamp((v - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
    // the travel view's value noise and fbm (Paint.js vnoise / fbm, the same numbers), written for speed: a sky is millions of calls
    const PERM = (() => { const r = MiniLab.rng(1337), p = Array.from({ length: 256 }, (_, i) => i); for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } return Uint8Array.from(p); })();
    const PERMF = Float32Array.from(PERM, v => v / 255);
    function vnoise(x, y, s = 0) {
        const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
        const p0 = PERM[xi & 255], p1 = PERM[(xi + 1) & 255];
        const a = PERMF[(PERM[(p0 + yi) & 255] + s) & 255], b = PERMF[(PERM[(p1 + yi) & 255] + s) & 255];
        const c = PERMF[(PERM[(p0 + yi + 1) & 255] + s) & 255], d = PERMF[(PERM[(p1 + yi + 1) & 255] + s) & 255], top = a + (b - a) * u;
        return top + (c + (d - c) * u - top) * v;
    }
    function fbm(x, y, s = 0, oct = 4) { let sum = 0, amp = 0.5, f = 1, n = 0; for (let i = 0; i < oct; i++) { sum += amp * vnoise(x * f, y * f, s + i * 17); n += amp; f *= 2.03; amp *= 0.5; } return sum / n; }
    const norm3 = (x, y, z) => { const n = Math.hypot(x, y, z) || 1; return [x / n, y / n, z / n]; };
    /** A hash that does not repeat across the sky (Sky2.js h32). */
    function h32(x, y, s) {
        let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul((s | 0) + 1, 0x9e3779b1);
        h = Math.imul(h ^ (h >>> 15), 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35); h ^= h >>> 16;
        return (h >>> 0) / 4294967296;
    }

    // ── the sky: sky F of the travel view, one place per sector, painted once into a field of tones the camera looks through.
    //    The field is SW × SH units (a unit is about one of the travel view's stage pixels); (SX, SY) is straight ahead, where
    //    the light is. Each cell keeps the brightest thing painted there as a ramp and a tone, plus the haze and the dust, so the
    //    grain is laid per art pixel on screen whatever the camera's bank and push. Stars are a list of points, one art pixel each.
    //    Painting a sky is a generator that yields every few rows, so it can run a few milliseconds a frame (skyOf). The soft,
    //    large things (the haze and dust, the band, a huge galaxy, the light's ring) are worked out every second unit and
    //    blended between (coarse); the fine ones (threads, shells, stars) at every unit. ──
    const SW = 800, SH = 520, SX = 400, SY = 260, ROWS_PER_STEP = 6;
    function skyBuffer() {
        const N = SW * SH, id = new Uint8Array(N), val = new Uint8Array(N), lm = new Float32Array(N), block = new Uint8Array(N), ext = new Uint8Array(N);
        const at = (x, y) => (x < 0 || y < 0 || x >= SW || y >= SH ? -1 : y * SW + x);
        const write = (i, r, v) => { id[i] = r.id; val[i] = Math.round(clamp(v, 0, 1) * 255); };
        const stars = [];
        return {
            id, val, block, ext, hz: new Uint8Array(N), du: new Uint8Array(N), stars,
            /** Paint ramp `name` at tone v, where it is brighter than what is there. */
            put(x, y, name, v) {
                if (!(v > 0.004)) return;
                const i = at(Math.floor(x), Math.floor(y)), r = R[name];
                if (i < 0 || block[i]) return;
                const l = lumAt(r, v);
                if (l > lm[i]) { lm[i] = l; write(i, r, v); }
            },
            /** A far body: paints over what is behind it, and nothing later lands on it (the stars neither). */
            solid(x, y, name, v) { const i = at(Math.floor(x), Math.floor(y)); if (i < 0) return; block[i] = 1; ext[i] = 255; lm[i] = lumAt(R[name], v); write(i, R[name], v); },
            /** A dark lane: faint stars drown in it. */
            shade(x, y, a) { const i = at(Math.floor(x), Math.floor(y)); if (i >= 0) ext[i] = Math.max(ext[i], Math.round(clamp(a, 0, 1) * 255)); },
            /** A star at field position (x, y): its step fixed by its own cell, so it never shimmers as the camera moves. cross: 1 a
                small cross, 2 that and it twinkles. */
            star(x, y, name, v, cross = 0) {
                const xi = Math.floor(x), yi = Math.floor(y), i = at(xi, yi);
                if (i < 0 || block[i] || ext[i] > 216 || (ext[i] > 100 && v < 0.6 + 0.1 * ext[i] / 255)) return;
                const r = R[name], k = level(r, v, xi, yi);
                if (k) stars.push({ u: x - SX, v: y - SY, c: r.c32[k], l: r.lum[k], arm: cross ? r.c32[Math.max(1, k - 2)] : 0, al: cross ? r.lum[Math.max(1, k - 2)] : 0, tw: cross === 2 });
            },
            region(x0, y0, x1, y1, fn) { for (let y = Math.max(0, Math.floor(y0)); y < Math.min(SH, Math.ceil(y1)); y++) for (let x = Math.max(0, Math.floor(x0)); x < Math.min(SW, Math.ceil(x1)); x++) fn(x, y); },
            /** region(), a few rows a step. */
            * regionG(x0, y0, x1, y1, fn) {
                for (let y = Math.max(0, Math.floor(y0)), k = 1; y < Math.min(SH, Math.ceil(y1)); y++, k++) {
                    for (let x = Math.max(0, Math.floor(x0)); x < Math.min(SW, Math.ceil(x1)); x++) fn(x, y);
                    if (k % ROWS_PER_STEP === 0) yield;
                }
            },
        };
    }
    /** Work fn(x, y, out) out every second cell over [x0, x1) × [y0, y1), nch numbers a point, a few rows a step. Returns
        at(x, y, c): channel c at any cell, blended between the four nearest points. */
    function* coarse(x0, y0, x1, y1, nch, fn) {
        const gx0 = Math.floor(Math.max(0, x0) / 2) - 1, gy0 = Math.floor(Math.max(0, y0) / 2) - 1;
        const GW = Math.ceil(Math.min(SW, x1) / 2) - gx0 + 2, GH = Math.ceil(Math.min(SH, y1) / 2) - gy0 + 2, A = new Float32Array(GW * GH * nch), out = new Float32Array(nch);
        for (let j = 0; j < GH; j++) {
            for (let i = 0; i < GW; i++) { out.fill(0); fn((gx0 + i) * 2, (gy0 + j) * 2, out); A.set(out, (j * GW + i) * nch); }
            if (j % ROWS_PER_STEP === ROWS_PER_STEP - 1) yield;
        }
        const row = GW * nch;
        return (x, y, c) => {
            const fx = x / 2 - gx0, fy = y / 2 - gy0, i = Math.max(0, Math.min(GW - 2, fx | 0)), j = Math.max(0, Math.min(GH - 2, fy | 0));
            const u = clamp(fx - i, 0, 1), v = clamp(fy - j, 0, 1), o = (j * GW + i) * nch + c, a = A[o], b = A[o + nch], d = A[o + row], e = A[o + row + nch];
            return a + (b - a) * u + (d - a + (e - d - b + a) * u) * v;
        };
    }
    /** The space strip (Paint.js spaceStrip): teal haze, and rust dust that the light warms as it nears it. */
    function* strip(X, seed) {
        const at = yield* coarse(0, 0, SW, SH, 2, (x, y, out) => {
            out[0] = Math.max(0, fbm(x / 70, y / 38, seed, 4) - 0.5) * 1.15;
            out[1] = Math.max(0, fbm(x / 46, y / 26, seed + 7, 4) - 0.5) * 3.4;
        });
        const { hz, du } = X.B;
        for (let y = 0, i = 0; y < SH; y++) { for (let x = 0; x < SW; x++, i++) { hz[i] = Math.min(255, at(x, y, 0) * 255); du[i] = Math.min(255, at(x, y, 1) * 255); } if (y % 40 === 39) yield; }
    }
    const starRamp = (mix, h) => (h < mix[0] ? 'WARM' : h < mix[0] + mix[1] ? 'COLD' : h < mix[0] + mix[1] + mix[2] ? 'GIANT' : 'STAR');
    /** The galaxy's band as a river of stars, with dust lanes and a rift; star clouds and holes everywhere; a few brighter
        suns, some coloured (Sky2.js field). */
    function* starField(X, o) {
        const { B, seed } = X, bd = o.band, mix = o.mix, hole = X.hole;
        const ca = Math.cos(bd.ang), sa = Math.sin(bd.ang), bcx = SX + bd.cx, bcy = SY + bd.cy;
        // 0 band, 1 bulge, 2 lane shade, 3 how much of the band's star river is here, 4 rift, 5 star clouds
        const at = yield* coarse(0, 0, SW, SH, 6, (x, y, out) => {
            const hl = hole ? hole(x, y) : 0;
            let rift = 0;
            const dx = x - bcx, dy = y - bcy, u = dx * ca + dy * sa, w = -dx * sa + dy * ca + (fbm(u / 170, 3.1, seed + 5, 3) - 0.5) * 80;
            const glow = Math.exp(-((w / bd.wide) ** 2)), inner = Math.exp(-((w / bd.core) ** 2));
            if (glow > 0.015) {
                const clump = fbm(u / 60, w / 26, seed, 4), fine = fbm(u / 9, w / 6, seed + 9, 2);
                const ridge = 1 - Math.abs(2 * fbm(u / 64 + 1.3 * fbm(u / 120, w / 40, seed + 31, 2), w / 8, seed + 21, 4) - 1);
                const lanes = ss(0.86, 0.97, ridge) * Math.min(1, glow * 1.5);
                const riftW = w - bd.core * 0.2 - (fbm(u / 80, 1.7, seed + 13, 3) - 0.5) * bd.core * 1.2;
                const main = Math.exp(-((riftW / (bd.core * 0.3)) ** 2)) * ss(0.3, 0.6, fbm(u / 44, riftW / 8, seed + 23, 3));
                const flecks = ss(0.64, 0.78, fbm(u / 16, w / 7, seed + 27, 3)) * inner * 0.7;
                rift = clamp(Math.max(main * 1.05, lanes * 0.9, flecks) + hl, 0, 1);
                out[0] = bd.peak * (0.4 * glow + 0.75 * inner) * (0.5 + 0.85 * clump) * (0.85 + 0.3 * fine) * (1 - 0.94 * rift);
                if (bd.bulge) out[1] = bd.peak * 1.1 * Math.exp(-(((u - bd.bulge[0]) / bd.bulge[1]) ** 2)) * Math.exp(-((w / (bd.core * 1.8)) ** 2)) * (0.5 + 0.8 * clump) * (1 - 0.9 * rift);
                out[2] = rift * (0.35 + inner) * 1.2;
                out[3] = (0.8 * glow + 2.6 * inner) * (0.3 + clump) * (1 - rift) * (1 - hl);
            }
            if (hl > 0.02) out[2] = Math.max(out[2], hl * 1.4);
            out[4] = rift; out[5] = fbm(x / 70, y / 70, seed + 40, 3);
        });
        for (let y = 0; y < SH; y++) {
            for (let x = 0; x < SW; x++) {
                const band = at(x, y, 0), bul = at(x, y, 1), shade = at(x, y, 2);
                if (band > 0.004) B.put(x, y, 'BAND', band);
                if (bul > 0.02) B.put(x, y, 'CORE', bul);
                if (shade > 0.01) B.shade(x, y, shade);
                const hl = hole ? hole(x, y) : 0, rift = at(x, y, 4), cloud = at(x, y, 5), dens = o.density * (0.2 + 1.6 * cloud * cloud) * (1 - rift) * (1 - hl);
                const h = h32(x, y, seed), pBand = o.bandStars * at(x, y, 3) * 0.045;
                if (h >= dens * 0.017 + pBand) continue;
                const m = h32(x, y, seed + 1), v = h >= dens * 0.017 ? 0.3 + 0.22 * m * m : m < 0.7 ? 0.24 + 0.14 * m : m < 0.95 ? 0.45 + 0.1 * m : 0.66;
                B.star(x + h32(x, y, seed + 4), y + h32(x, y, seed + 5), starRamp(mix, h32(x, y, seed + 2)), v);
            }
            if (y % 20 === 19) yield;
        }
        const rand = MiniLab.rng(seed + 3);
        for (let i = 0; i < o.bright; i++) {
            const x = rand() * SW, y = rand() * SH, m = rand(), rp = starRamp([mix[0] * 2, mix[1] * 1.8, mix[2] * 2.5], rand());
            if (hole && hole(x | 0, y | 0) > 0.3) continue;
            B.star(x, y, rp, m > 0.86 ? 1 : m > 0.5 ? 0.76 : 0.6, m > 0.95 ? 2 : m > 0.86 ? 1 : 0);
        }
    }
    /** Dark clouds, 0..1 at each cell (worked out every second cell): they eat the band and swallow the stars behind them. */
    function* holes(list) {
        const cl = list.map(c => ({ x: SX + c.x, y: SY + c.y, rx: c.rx, ry: c.ry, seed: c.seed }));
        const at = yield* coarse(0, 0, SW, SH, 1, (x, y, out) => {
            for (const c of cl) {
                const dx = (x - c.x) / c.rx, dy = (y - c.y) / c.ry, q = dx * dx + dy * dy;
                if (q <= 2.2) out[0] = Math.max(out[0], ss(0.32, 0.62, Math.exp(-q * 1.4) * (0.45 + fbm(x / 26, y / 18, c.seed, 4))));
            }
        });
        return (x, y) => at(x, y, 0);
    }
    /** How bright galaxy g is at (x, y) (Sky.js galaxy: an inclined disc with a bulge and log-spiral arms, or a smooth elliptical). */
    function galaxyAt(g, x, y) {
        const gx = SX + g.x, gy = SY + g.y, ct = Math.cos(g.tilt), st = Math.sin(g.tilt), { r, incl, arms, wind = 2.2, bright, seed = 1, fall = 0.42, bulgeW = 1 } = g;
        const dx = x + 0.5 - gx, dy = y + 0.5 - gy, u = dx * ct + dy * st, w = (-dx * st + dy * ct) / incl, rr = Math.hypot(u, w) / r;
        if (rr > 1.35) return 0;
        if (!arms) return bright * (Math.exp(-rr * 3.6) * 1.1 + 0.05 * (1 - rr / 1.35)) * (0.9 + 0.2 * vnoise(x / 3, y / 3, seed));
        const sp = Math.atan2(w, u) - wind * Math.log(rr + 0.06), grain = Math.max(3.5, Math.min(r * 0.18, 9));
        const arm = Math.pow(0.5 + 0.5 * Math.cos(arms * sp), 2.2) * (0.45 + 1.1 * fbm(u / grain + 9, w / grain, seed, 3));
        let v = bright * (bulgeW * Math.exp(-((rr / 0.15) ** 2)) + 1.15 * Math.exp(-rr / fall) * (0.3 + 1.05 * arm)) * ss(1.35, 0.85, rr);
        if (incl < 0.5) v *= 1 - 0.75 * Math.exp(-((((w * incl) / r - 0.05) / 0.035) ** 2)) * ss(1.0, 0.25, rr);
        return v;
    }
    function galaxy(B, g) {
        const ext = Math.ceil(g.r * 1.35) + 2, rp = g.ramp || (g.arms ? 'GAL' : 'OLD');
        B.region(SX + g.x - ext, SY + g.y - ext, SX + g.x + ext + 1, SY + g.y + ext + 1, (x, y) => B.put(x, y, rp, galaxyAt(g, x, y)));
    }
    /** A galaxy too big to paint cell by cell (sector 2's spiral): worked out every second cell; the dark clouds eat it. */
    function* bigGalaxy(X, g) {
        const ext = Math.ceil(g.r * 1.35) + 2, x0 = SX + g.x - ext, y0 = SY + g.y - ext, x1 = SX + g.x + ext + 1, y1 = SY + g.y + ext + 1, rp = g.ramp || 'GAL';
        const at = yield* coarse(x0, y0, x1, y1, 1, (x, y, out) => { out[0] = galaxyAt(g, x, y) * (X.hole ? 1 - X.hole(x, y) : 1); });
        yield* X.B.regionG(x0, y0, x1, y1, (x, y) => X.B.put(x, y, rp, at(x, y, 0)));
    }
    /** An open cluster (young, cold, loose) or a globular one (old, warm, packed to a glowing core). */
    function cluster(X, o) {
        const { B } = X, cx = SX + o.x, cy = SY + o.y;
        if (o.kind === 'globular') {
            B.region(cx - o.r * 1.8, cy - o.r * 1.8, cx + o.r * 1.8, cy + o.r * 1.8, (x, y) => {
                const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / o.r;
                B.put(x, y, 'CORE', 0.55 * Math.exp(-d * 3.2));
                if (h32(x, y, o.seed) < 0.75 * Math.exp(-d * 2.1)) B.star(x + 0.5, y + 0.5, h32(x, y, o.seed + 1) < 0.5 ? 'WARM' : 'STAR', 0.36 + 0.3 * h32(x, y, o.seed + 2));
            });
            return;
        }
        const rand = MiniLab.rng(o.seed);
        B.region(cx - o.r * 2, cy - o.r * 2, cx + o.r * 2, cy + o.r * 2, (x, y) => B.put(x, y, 'COLD', 0.2 * Math.exp(-((Math.hypot(x - cx, y - cy) / o.r) ** 2) * 1.4) * (0.6 + 0.8 * fbm(x / 4, y / 4, o.seed, 2))));
        for (let i = 0; i < o.count; i++) {
            const a = rand() * Math.PI * 2, rr = Math.sqrt(-2 * Math.log(rand() + 1e-6)) * o.r * 0.5, m = rand();
            B.star(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, m < 0.55 ? 'COLD' : m < 0.8 ? 'STAR' : 'WARM', m > 0.93 ? 1 : 0.5 + 0.3 * rand(), m > 0.93 ? 1 : 0);
        }
    }
    /** A galaxy seen through a heavier one: its light bent into arcs around it (the tally: distances that come back wrong). */
    function lensed(X, o) {
        const { B } = X, gx = SX + o.x, gy = SY + o.y, re = o.r, arcs = [[0.6, 0.55], [2.6, 0.35], [4.3, 0.45]];
        galaxy(B, { x: o.x, y: o.y, r: re * 0.55, tilt: 0.3, incl: 0.8, arms: 0, bright: 0.55, seed: o.seed });
        B.region(gx - re * 1.6, gy - re * 1.6, gx + re * 1.6, gy + re * 1.6, (x, y) => {
            const dx = x + 0.5 - gx, dy = y + 0.5 - gy, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
            let m = 0; arcs.forEach(([a0, wa]) => { const da = Math.atan2(Math.sin(a - a0), Math.cos(a - a0)); m = Math.max(m, Math.exp(-((da / wa) ** 2))); });
            B.put(x, y, 'COLD', 0.62 * m * Math.exp(-(((d - re) / 0.85) ** 2)));
        });
    }
    /** Far galaxies too small to have a shape, and a few that do. */
    function smudges(X, count, seed) {
        const rand = MiniLab.rng(seed), { B } = X;
        for (let i = 0; i < count; i++) {
            const x = rand() * SW, y = rand() * SH, s = rand(), a = rand() * Math.PI, rp = rand() < 0.45 ? 'OLD' : 'GAL';
            if (X.hole && X.hole(x | 0, y | 0) > 0.2) continue;
            if (s > 0.86) { galaxy(B, { x: x - SX, y: y - SY, r: 3 + s * 3, tilt: a, incl: 0.3 + rand() * 0.6, arms: rand() < 0.5 ? 2 : 0, bright: 0.42 + rand() * 0.12, seed: i + 3, ramp: rp }); continue; }
            B.put(x, y, rp, 0.3 + s * 0.15);
            if (s > 0.35) { B.put(x + Math.round(Math.cos(a)), y + Math.round(Math.sin(a)), rp, 0.2); B.put(x - Math.round(Math.cos(a)), y - Math.round(Math.sin(a)), rp, 0.2); }
        }
    }
    /** A small far moon or planet at another depth, lit from the light, hiding the stars behind it; maybe ringed. */
    function body(X, o) {
        const { B } = X, cx = SX + o.x, cy = SY + o.y, L = norm3(SX - cx, SY - cy, o.depth || 30), rp = o.ramp || 'FAR';
        B.region(cx - o.r - 1, cy - o.r - 1, cx + o.r + 1, cy + o.r + 1, (x, y) => {
            const nx = (x + 0.5 - cx) / o.r, ny = (y + 0.5 - cy) / o.r, q = nx * nx + ny * ny;
            if (q >= 1) return;
            const nz = Math.sqrt(1 - q), lam = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
            const surf = o.bands ? 0.7 + 0.5 * Math.sin((ny * 0.9 + nx * 0.25) * o.r * 0.9 + fbm(nx * 3, ny * 6, o.seed, 2) * 4) : 0.75 + 0.5 * fbm(nx * o.r / 3, ny * o.r / 3, o.seed, 3);
            B.solid(x, y, rp, o.peak * Math.pow(lam, 0.85) * surf + (q > 0.8 && lam > 0.15 ? 0.08 : 0));
        });
        if (!o.ring) return;
        const ct = Math.cos(o.ring.tilt), st = Math.sin(o.ring.tilt), Rr = o.r * 2.2;
        B.region(cx - Rr - 1, cy - Rr - 1, cx + Rr + 1, cy + Rr + 1, (x, y) => {
            const dx = x + 0.5 - cx, dy = y + 0.5 - cy, rr = Math.hypot(dx * ct + dy * st, (-dx * st + dy * ct) / o.ring.open) / o.r;
            if (rr < 1.45 || rr > 2.15) return;
            const v = o.peak * 0.6 * (0.6 + 0.4 * Math.sin(rr * 26));
            if (-dx * st + dy * ct > 0) B.solid(x, y, 'CORE', v); else B.put(x, y, 'CORE', v);
        });
    }
    /** Sector 1: the night side of a vast planet across a corner; a hair-thin lit limb, a breath of air (Sky.js vastPlanet). */
    function* vastPlanet(X, o) {
        const { B } = X, cx = SX + o.x, cy = SY + o.y, Rr = o.R, atm = 3.2, L = norm3(SX - cx, SY - cy, -1.9 * Math.hypot(SX - cx, SY - cy));
        yield* B.regionG(cx - Rr - atm, cy - Rr - atm, cx + Rr + atm + 1, cy + Rr + atm + 1, (x, y) => {
            const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy);
            if (d > Rr + atm) return;
            const nx = dx / d, ny = dy / d, along = fbm(Math.atan2(dy, dx) * 160, 2.5, o.seed + 9, 3);
            if (d >= Rr) { const facing = nx * L[0] + ny * L[1]; if (facing > 0.15) B.put(x, y, 'SICE', (1 - (d - Rr) / atm) * facing * 0.5 * (0.6 + 0.8 * along)); return; }
            const q = d / Rr, nz = Math.sqrt(Math.max(0, 1 - q * q)), sn = Math.sqrt(1 - nz * nz), lam = nx * sn * L[0] + ny * sn * L[1] + nz * L[2];
            const belts = 0.5 + 0.5 * Math.sin((dx * 0.34 + dy * 0.94) / 23 + 3 * fbm(dx / 160, dy / 60, o.seed, 3)), grain = fbm(dx / 40, dy / 14, o.seed + 4, 3);
            const v = lam > 0 ? (Math.pow(lam / 0.47, 1.7) * 0.6 + (d > Rr - 1.3 ? 0.12 : 0)) * (0.55 + 0.3 * belts + 0.45 * along) * (0.85 + 0.3 * grain) : 0;
            if (v > 0.07) B.solid(x, y, 'LIMB', v);
            else B.solid(x, y, 'NIGHT', (0.1 + 0.22 * belts * grain) * ss(0, 0.35, nz));
        });
    }
    /** A supernova's shell: thin threads round it like loose rope, braided and broken, ice and rust, a faint teal fill. */
    function* remnant(X, o) {
        const { B } = X, cx = SX + o.x, cy = SY + o.y, g = o.gain, N = o.threads || 8;
        const th = Array.from({ length: N }, (_, k) => ({ r: 1 + (k - (N - 1) / 2) * 0.024, s: o.seed + k * 13, amp: 0.05 + 0.045 * (k % 3), rust: k % 3 === 1, k }));
        yield* B.regionG(cx - o.R * 1.4, cy - o.R * 1.4, cx + o.R * 1.4, cy + o.R * 1.4, (x, y) => {
            const dx = x + 0.5 - cx, dy = y + 0.5 - cy, r = Math.hypot(dx, dy) || 1, q = r / o.R;
            if (Math.abs(q - 1) > 0.36) return;
            const ca = dx / r, sa = dy / r, gap = ss(0.36, 0.64, fbm(ca * 1.6 + 5, sa * 1.6 + 5, o.seed + 9, 2));
            const lump = 1 + (fbm(ca * 1.3 + 2, sa * 1.3 + 2, o.seed + 40, 2) - 0.5) * 0.2;
            B.put(x, y, 'TEAL', g * 0.2 * gap * Math.exp(-(((q - 1) / 0.09) ** 2)) * (0.5 + fbm(x / 12, y / 12, o.seed + 2, 3)));
            for (const t of th) {
                const d = r - o.R * lump * (t.r + (fbm(ca * 2.4 + t.k, sa * 2.4, t.s, 3) - 0.5) * t.amp * 2);
                if (Math.abs(d) > 2.5) continue;
                const v = g * Math.exp(-((d / 0.85) ** 2)) * gap * ss(0.32, 0.66, fbm(ca * 5 + t.k * 3, sa * 5, t.s + 1, 3));
                B.put(x, y, t.rust ? 'SRUST' : 'SICE', v * (t.rust ? 0.95 : 0.8));
            }
        });
        B.star(cx + 0.5, cy + 0.5, 'COLD', 0.8);
    }
    /** A ring nebula like an eye: a dying star's shell seen end on, ice inside, a rust rim outside, faint rays beyond. */
    function* ringNebula(X, o) {
        const { B } = X, cx = SX + o.x, cy = SY + o.y, ct = Math.cos(o.tilt), st = Math.sin(o.tilt), g = o.gain, ext = o.R * 2.1;
        yield* B.regionG(cx - ext, cy - ext, cx + ext, cy + ext, (x, y) => {
            const dx = x + 0.5 - cx, dy = y + 0.5 - cy, u = dx * ct + dy * st, w = (-dx * st + dy * ct) / o.incl, q = Math.hypot(u, w) / o.R, cu = u / (q * o.R || 1), cw = w / (q * o.R || 1);
            const ring = Math.exp(-(((q - 1) / 0.15) ** 2)) * (0.45 + 0.9 * fbm(x / 3.5, y / 3.5, o.seed, 3)) * (0.45 + 0.55 * Math.abs(cw));
            const inner = q < 1 ? 0.3 * (0.6 + 0.6 * fbm(x / 6, y / 6, o.seed + 4, 2)) * ss(0.05, 0.95, q) : 0;
            const rim = 0.6 * Math.exp(-(((q - 1.18) / 0.06) ** 2)) * ss(0.35, 0.7, fbm(x / 4, y / 4, o.seed + 8, 3));
            const rays = q > 1.25 && q < 2.1 ? 0.3 * Math.pow(1 - Math.abs(2 * fbm(cu * 7, cw * 7, o.seed + 12, 3) - 1), 5) * Math.exp(-(q - 1.25) * 2.4) : 0;
            B.put(x, y, 'TEAL', g * ring * 0.55);
            B.put(x, y, 'SICE', g * (ring * 0.72 + inner));
            B.put(x, y, 'SRUST', g * (rim * 0.85 + rays));
        });
        B.star(cx + 0.5, cy + 0.5, 'COLD', 0.95, 1);
    }
    /** A star wrapped in the dust it lights: cold, wispy, small. */
    function* reflection(X, o) {
        const { B } = X, cx = SX + o.x, cy = SY + o.y;
        yield* B.regionG(cx - o.r * 2.4, cy - o.r * 2.4, cx + o.r * 2.4, cy + o.r * 2.4, (x, y) => {
            const d = Math.hypot(x + 0.5 - cx, (y + 0.5 - cy) * 1.2) / o.r, wx = fbm(x / 16, y / 16, o.seed, 3) - 0.5;
            const wisp = Math.pow(1 - Math.abs(2 * fbm(x / 14 + 2 * wx, y / 9, o.seed + 3, 4) - 1), 5);
            B.put(x, y, 'SICE', o.gain * Math.exp(-d * 1.4) * (0.3 + 0.9 * wisp));
            B.put(x, y, 'TEAL', o.gain * 0.8 * Math.exp(-d * 0.8) * fbm(x / 10, y / 10, o.seed + 6, 3));
        });
        B.star(cx + 0.5, cy + 0.5, 'COLD', 1, 1);
    }
    /** Pillars of dust rising out of a cloud, eaten away toward the light: the side facing it glows, the far side is brown-black. */
    function* pillars(X, o) {
        const { B } = X, g = o.gain, floor = SY + o.floorY, lx = SX, ly = SY;
        const cols = o.cols.map(([x, len, w, lean]) => {
            const bx = SX + x, by = floor + 10, aL = Math.atan2(ly - by, lx - bx), a = -Math.PI / 2 + (aL + Math.PI / 2) * lean;
            return { bx, by, ax: Math.cos(a), ay: Math.sin(a), len, w, tx: bx + Math.cos(a) * len, ty: by + Math.sin(a) * len };
        });
        const x0 = Math.max(0, SX + o.x0), y0 = Math.max(0, SY + o.y0), x1 = Math.min(SW, SX + o.x1), ex = SX + o.glow[0], ey = SY + o.glow[1];
        // 0 the dust's density; 1 the glowing gas behind it
        const at = yield* coarse(x0, y0, x1, SH, 2, (x, y, out) => {
            const top = floor + (fbm(x / 26, 0.5, o.seed, 3) - 0.5) * 44 + (fbm(x / 8, y / 8, o.seed + 3, 3) - 0.5) * 12;
            let d = ss(top - 6, top + 12, y) * (0.55 + 0.7 * fbm(x / 9, y / 7, o.seed + 5, 3)) * ss(SX + o.fade[1], SX + o.fade[0], x + (fbm(x / 20, y / 20, o.seed + 9, 3) - 0.5) * 60);
            for (const c of cols) {
                const px = x - c.bx, py = y - c.by, t = (px * c.ax + py * c.ay) / c.len;
                if (t < -0.15 || t > 1.2) continue;
                let half = c.w * (1 - 0.48 * t) * (0.6 + 0.8 * fbm(t * 6, c.bx / 50, o.seed + 7, 3));
                if (t > 0.84) half *= Math.sqrt(Math.max(0, 1 - ((t - 0.84) / 0.3) ** 2));
                const dn = Math.abs(-px * c.ay + py * c.ax) / Math.max(0.5, half);
                d = Math.max(d, ss(1.25, 0.55, dn + (fbm(x / 5, y / 5, o.seed + 11, 3) - 0.5) * 0.8) * (0.7 + 0.6 * fbm(x / 4, y / 4, o.seed + 15, 2)));
            }
            out[0] = clamp(d, 0, 1);
            const env = Math.exp(-(((x - ex) / o.glow[2]) ** 2 + ((y - ey) / o.glow[3]) ** 2));
            if (env > 0.03) { const wx = fbm(x / 50, y / 40, o.seed + 19, 3) - 0.5; out[1] = env * Math.pow(clamp((fbm(x / 38 + 2 * wx, y / 26, o.seed + 21, 5) - 0.3) / 0.5, 0, 1), 1.4); }
        });
        const dAt = (x, y) => (x < x0 || y < y0 || x >= x1 || y >= SH ? 0 : at(x, y, 0));
        yield* B.regionG(x0, y0, x1, SH, (x, y) => {
            const dl = Math.hypot(lx - x, ly - y) || 1, Lx = (lx - x) / dl, Ly = (ly - y) / dl, d = dAt(x, y);
            let tau = 0; for (let k = 1; k <= 7; k++) tau += dAt(x + Lx * k * 1.4, y + Ly * k * 1.4);
            const lit = Math.exp(-tau * 0.7), n = fbm(x / 3, y / 3, o.seed + 13, 2);
            if (d > 0.08) {                                     // dust: solid where thick; its edge thins out on screen, grain by grain
                const tone = lit > 0.2 ? g * (0.1 + 0.62 * lit) * (0.6 + 0.7 * n) : 0.12 + 0.3 * fbm(x / 6, y / 6, o.seed + 17, 3), rp = lit > 0.2 ? 'EMBER' : 'CORE';
                if (d > 0.62) { B.solid(x, y, rp, tone); return; }
                B.put(x, y, rp, tone * ss(0.08, 0.62, d) * 1.3);
                B.shade(x, y, d * 1.4);
            }
            const near = dAt(x - Lx * 2.5, y - Ly * 2.5);
            if (near > 0.35) B.put(x, y, 'EMBER', g * 0.3 * near * (0.3 + n));
            const env = Math.exp(-(((x - ex) / o.glow[2]) ** 2 + ((y - ey) / o.glow[3]) ** 2));
            if (env < 0.03) return;
            const dens = at(x, y, 1) * (1 - d);
            let tip = 0; cols.forEach(c => { tip = Math.max(tip, Math.exp(-Math.hypot(x - c.tx, y - c.ty) / 30)); });
            B.put(x, y, 'TEAL', g * dens * 0.72);
            B.put(x, y, 'MOSS', g * dens * 0.85 * (1 - tip));
            B.put(x, y, 'EMBER', g * (dens * 0.5 + 0.3 * env * (1 - d)) * tip * 1.3);
        });
    }
    /** Sector 6: the light's own dust, a vast thin ring round it seen at a slant, and spokes of dust streaming in. */
    function* lightRing(X, o) {
        const { B } = X, ct = Math.cos(o.tilt), st = Math.sin(o.tilt);
        const at = yield* coarse(0, 0, SW, SH, 2, (x, y, out) => {
            const dx = x + 0.5 - SX, dy = y + 0.5 - SY, d = Math.hypot(dx, dy), u = dx * ct + dy * st, w = (-dx * st + dy * ct) / o.open, q = Math.hypot(u, w) / o.R;
            if (Math.abs(q - 1) <= 0.2) {
                const qq = q + (fbm(u / 90, w / 90, o.seed + 3, 3) - 0.5) * 0.08;
                const band = Math.exp(-(((qq - 1) / 0.03) ** 2)) + 0.55 * Math.exp(-(((qq - 1.07) / 0.014) ** 2));
                const thread = Math.pow(1 - Math.abs(2 * fbm(u / 70, qq * 60, o.seed + 11, 3) - 1), 3);
                out[0] = o.gain * band * ss(0.32, 0.58, fbm(u / 140 + 3, w / 140, o.seed + 7, 3)) * (0.45 + 0.55 * Math.exp(-d / 240)) * (w < 0 ? 0.55 : 1) * (0.25 + 1.2 * thread);
            }
            if (d < 26) return;
            const spoke = Math.pow(1 - Math.abs(2 * fbm(dx / d * o.k + d / 260, dy / d * o.k, o.seed, 3) - 1), 7);
            if (spoke > 0.02) out[1] = o.streams * spoke * Math.exp(-d / o.reach) * (0.4 + 0.8 * fbm(x / 18, y / 18, o.seed + 4, 3)) * ss(0.35, 0.7, fbm(x / 34, y / 34, o.seed + 6, 3));
        });
        yield* B.regionG(0, 0, SW, SH, (x, y) => {
            const v = at(x, y, 0), s = at(x, y, 1);
            if (v > 0.004) { B.put(x, y, 'CORE', v); B.put(x, y, 'EMBER', v * 0.75); }
            if (s > 0.004) { B.put(x, y, 'SRUST', s); B.put(x, y, 'EMBER', s * 0.55); }
        });
    }
    /** The rare colours: three to seven tiny far things per sector in a dull but distinct colour (Sky2.js accents). */
    function accent(X, o) {
        const { B } = X, cx = SX + o.x, cy = SY + o.y, r = o.ramp;
        const halo = (x, y, rp, v) => B.region(x - 3, y - 3, x + 4, y + 4, (hx, hy) => { const d = Math.hypot(hx - x, hy - y); if (d > 1.2 && d < 2.9) B.put(hx, hy, rp, v * (1.25 - d / 2.9)); });
        if (o.kind === 'star') { halo(cx, cy, r, 0.24); B.star(cx + 0.5, cy + 0.5, r, 0.97, 2); }
        else if (o.kind === 'binary') { halo(cx, cy, r, 0.22); B.star(cx + 0.5, cy + 0.5, r, 0.95, 2); B.star(cx + o.sep + 0.5, cy - 0.5, o.ramp2, 0.85, 1); }
        else if (o.kind === 'dwarf') {
            B.region(cx - o.r, cy - o.r, cx + o.r + 1, cy + o.r + 1, (x, y) => { const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy); if (d > 1.2 && d < o.r) B.put(x, y, r, 0.16 * (1 - d / o.r) * (0.5 + fbm(x / 2, y / 2, o.seed, 2))); });
            B.star(cx + 0.5, cy + 0.5, r, 0.92, 2);
        } else if (o.kind === 'knot') {
            const ca = Math.cos(o.tilt || 0), sa = Math.sin(o.tilt || 0);
            B.region(cx - o.r * 1.6, cy - o.r * 1.6, cx + o.r * 1.6, cy + o.r * 1.6, (x, y) => {
                const dx = x + 0.5 - cx, dy = y + 0.5 - cy, u = dx * ca + dy * sa, w = (-dx * sa + dy * ca) * 1.6;
                const q = Math.hypot(u + (fbm(x / 4, y / 4, o.seed, 2) - 0.5) * o.r * 0.8, w) / o.r;
                const sub = Math.max(Math.exp(-((Math.hypot(u - o.r * 0.45, w - 1) / 1.6) ** 2)), Math.exp(-((Math.hypot(u + o.r * 0.5, w + 1.5) / 1.3) ** 2)) * 0.8);
                B.put(x, y, r, 0.5 * Math.exp(-q * q * 2.2) * (0.35 + 1.1 * fbm(x / 2.4, y / 2.4, o.seed + 3, 3)) + 0.42 * sub);
            });
        } else if (o.kind === 'wisp') {
            for (let i = 0; i <= o.len * 3; i++) {
                const s = i / (o.len * 3), a = (o.tilt || 0) + (s - 0.5) * o.bend, x = cx + Math.cos(a) * o.rr - Math.cos(o.tilt || 0) * o.rr, y = cy + Math.sin(a) * o.rr - Math.sin(o.tilt || 0) * o.rr;
                const v = 0.62 * Math.sin(Math.PI * s) * ss(0.3, 0.6, fbm(s * 7, 1, o.seed, 2) + 0.15);
                B.put(x, y, r, v); B.put(x + (s > 0.5 ? 1 : 0), y + 1, r, v * 0.45);
            }
        } else if (o.kind === 'galaxy') galaxy(B, { x: o.x, y: o.y, r: o.r, tilt: o.tilt, incl: o.incl, arms: o.arms, wind: 2.3, bright: 0.75, seed: o.seed, ramp: r });
        else if (o.kind === 'planetary') {
            B.region(cx - o.r * 1.6, cy - o.r * 1.6, cx + o.r * 1.6 + 1, cy + o.r * 1.6 + 1, (x, y) => {
                const dx = x + 0.5 - cx, dy = (y + 0.5 - cy) * 1.15, d = Math.hypot(dx, dy), side = 0.55 + 0.45 * Math.abs(Math.cos(Math.atan2(dy, dx) - 0.7));
                B.put(x, y, r, 0.66 * Math.exp(-(((d - o.r) / 0.9) ** 2)) * side * (0.6 + 0.6 * fbm(x / 2, y / 2, o.seed, 2)) + (d < o.r ? 0.12 : 0));
            });
            B.star(cx + 0.5, cy + 0.5, 'SLATE', 0.75);
        }
    }

    // ── the six places, in sky units: (0, 0) is the light dead ahead; the view shows about ±240 across and ±135 up and down.
    //    Sky F's places (Sky2.js RECIPES) moved round the light: each sector keeps its enormous thing, its band and its rare
    //    colours. haze and dust: the space strip's amounts (SectorLooks.js). live: the slow motion, eight steps a second. ──
    const PLACES = {
        1: { seed: 541, haze: 1, dust: 0.12, band: { cx: 0, cy: 92, ang: -0.18, wide: 66, core: 21, peak: 0.6, bulge: [-200, 95] }, density: 1, bandStars: 1, mix: [0.06, 0.08, 0.012], bright: 26, smudges: 24,
            vast: { x: -430, y: -760, R: 720, seed: 61 },
            galaxies: [{ x: -170, y: -10, r: 22, tilt: -0.55, incl: 0.42, arms: 2, wind: 2.4, bright: 0.5, seed: 7 }, { x: 196, y: -96, r: 12, tilt: 0.35, incl: 0.18, arms: 2, bright: 0.5, seed: 12 }],
            clusters: [{ x: 150, y: 40, r: 9, count: 26, seed: 61 }],
            bodies: [{ x: -124, y: -52, r: 5, peak: 0.55, ramp: 'GAS', bands: true, seed: 5, ring: { tilt: -0.35, open: 0.3 } }],
            accents: [{ kind: 'knot', x: 70, y: -86, r: 8, tilt: -0.5, ramp: 'ROSE', seed: 3 }, { kind: 'dwarf', x: -96, y: -44, r: 4, ramp: 'CRIMSON', seed: 5 },
                { kind: 'galaxy', x: 214, y: 112, r: 7, tilt: 0.6, incl: 0.5, arms: 2, ramp: 'SLATE', seed: 9 }, { kind: 'binary', x: -60, y: 46, sep: 3, ramp: 'OCHRE', ramp2: 'SULPHUR', seed: 11 },
                { kind: 'star', x: 124, y: -58, ramp: 'VERDIGRIS', seed: 13 }],
            live: [{ kind: 'glints', n: 10, seed: 3, area: [-230, -126, 220, -20], drift: 0.5, warm: 0.3 }, { kind: 'flashes', every: 26000, chance: 0.75, seed: 4, area: [-230, -120, 230, 120], ramp: 'WARM' }] },
        2: { seed: 582, haze: 0.6, dust: 0.08, band: { cx: 0, cy: -62, ang: 0.14, wide: 62, core: 19, peak: 0.85 }, density: 0.32, bandStars: 0.8, mix: [0.03, 0.12, 0.008], bright: 12, smudges: 12,
            holes: [{ x: -110, y: -66, rx: 105, ry: 56, seed: 11 }, { x: 130, y: -92, rx: 48, ry: 34, seed: 13 }, { x: -230, y: 100, rx: 70, ry: 50, seed: 15 }],
            spiral: { x: -150, y: -14, r: 185, tilt: -0.3, incl: 0.5, arms: 2, wind: 2.3, bright: 0.34, seed: 23, fall: 0.85, bulgeW: 0.5 },
            galaxies: [{ x: -230, y: 18, r: 6, tilt: -0.3, incl: 0.65, arms: 0, bright: 0.5, seed: 18 }],
            gas: X => reflection(X, { x: -200, y: 82, r: 22, gain: 0.44, seed: 21 }),
            accents: [{ kind: 'dwarf', x: 150, y: 96, r: 4, ramp: 'CRIMSON', seed: 21 }, { kind: 'star', x: -40, y: 122, ramp: 'VERDIGRIS', seed: 23 },
                { kind: 'galaxy', x: 206, y: -112, r: 6, tilt: -0.4, incl: 0.35, arms: 2, ramp: 'SLATE', seed: 25 }],
            live: [{ kind: 'glints', n: 2, seed: 8, area: [-200, -110, 200, -20], drift: 0.3, warm: 0 }, { kind: 'flashes', every: 40000, chance: 0.6, seed: 6, area: [-230, -120, 230, 120], ramp: 'COLD' }] },
        3: { seed: 623, haze: 0.9, dust: 0.1, band: { cx: 0, cy: 100, ang: -0.1, wide: 60, core: 19, peak: 0.52, bulge: [130, 80] }, density: 1.1, bandStars: 1, mix: [0.04, 0.12, 0.012], bright: 24, smudges: 24,
            galaxies: [{ x: 160, y: -104, r: 10, tilt: 0.4, incl: 0.8, arms: 2, bright: 0.48, seed: 8 }],
            clusters: [{ x: 140, y: 56, r: 8, count: 20, seed: 63 }],
            bodies: [{ x: 206, y: 104, r: 7, peak: 0.6, ramp: 'ICE', seed: 9 }],
            gas: X => remnant(X, { x: -150, y: -52, R: 84, gain: 0.7, seed: 75, threads: 6 }),
            accents: [{ kind: 'planetary', x: -36, y: -86, r: 3.5, ramp: 'JADE', seed: 31 }, { kind: 'star', x: 92, y: -40, ramp: 'SULPHUR', seed: 33 },
                { kind: 'dwarf', x: -226, y: 56, r: 4, ramp: 'CRIMSON', seed: 35 }, { kind: 'wisp', x: -20, y: 108, rr: 14, len: 22, bend: 1.4, tilt: -1.9, ramp: 'ROSE', seed: 37 },
                { kind: 'star', x: 222, y: -116, ramp: 'VERDIGRIS', seed: 39 }, { kind: 'galaxy', x: -120, y: 70, r: 8, tilt: 0.25, incl: 0.22, arms: 2, ramp: 'SLATE', seed: 41 }],
            live: [{ kind: 'pulsar', x: -150, y: -52, len: 44, period: 16000, tick: 1500, seed: 3 }, { kind: 'flashes', every: 13000, chance: 0.85, seed: 5, area: [-230, -126, 230, 0], ramp: 'COLD' }] },
        4: { seed: 664, haze: 1, dust: 0.14, band: { cx: 0, cy: -112, ang: 0.08, wide: 58, core: 18, peak: 0.5 }, density: 1.35, bandStars: 1, mix: [0.06, 0.13, 0.008], bright: 34, smudges: 18,
            pillars: { floorY: 150, x0: -200, x1: 400, y0: -110, fade: [190, 70], glow: [200, 130, 200, 100], seed: 77, gain: 0.72, cols: [[236, 150, 22, 0.28], [168, 100, 16, 0.34], [106, 60, 12, 0.4]] },
            galaxies: [{ x: -170, y: 70, r: 12, tilt: 0.7, incl: 0.3, arms: 2, bright: 0.5, seed: 17 }],
            clusters: [{ x: 150, y: -46, r: 15, count: 46, seed: 65 }],
            bodies: [{ x: -190, y: -96, r: 6, peak: 0.55, ramp: 'DESERT', seed: 11 }],
            accents: [{ kind: 'knot', x: -70, y: -6, r: 5, tilt: 0.7, ramp: 'ROSE', seed: 43 }, { kind: 'star', x: 96, y: -76, ramp: 'SULPHUR', seed: 45 },
                { kind: 'planetary', x: 146, y: 64, r: 3, ramp: 'JADE', seed: 47 }, { kind: 'binary', x: 40, y: 30, sep: 4, ramp: 'OCHRE', ramp2: 'VERDIGRIS', seed: 49 }],
            live: [{ kind: 'comet', x0: 150, y0: -110, vx: -1.1, vy: 0.35, len: 34, curl: 0.4, seed: 12 }, { kind: 'flashes', every: 34000, chance: 0.5, seed: 7, area: [-30, -126, 230, -20], ramp: 'WARM' }] },
        5: { seed: 705, haze: 0.8, dust: 0.1, band: { cx: 0, cy: -84, ang: -0.3, wide: 64, core: 20, peak: 0.5, bulge: [190, 80] }, density: 1, bandStars: 1, mix: [0.056, 0.09, 0.016], bright: 24, smudges: 60,
            galaxies: [{ kind: 'lensed', x: 120, y: -92, r: 9, seed: 35 }],
            clusters: [{ kind: 'globular', x: 156, y: 86, r: 12, seed: 67 }],
            bodies: [{ x: -212, y: 92, r: 6, peak: 0.55, ramp: 'STONE', seed: 13 }, { x: -190, y: 102, r: 6, peak: 0.55, ramp: 'STONE', seed: 13 }],
            gas: X => ringNebula(X, { x: -146, y: -48, R: 40, tilt: 0.5, incl: 0.74, gain: 0.5, seed: 79 }),
            accents: [{ kind: 'binary', x: -20, y: -112, sep: 4, ramp: 'OCHRE', ramp2: 'SULPHUR', seed: 51 }, { kind: 'planetary', x: 62, y: 80, r: 3, ramp: 'JADE', seed: 53 },
                { kind: 'wisp', x: -84, y: 110, rr: 16, len: 26, bend: 1.2, tilt: 2.2, ramp: 'ROSE', seed: 55 }, { kind: 'galaxy', x: 40, y: -40, r: 8, tilt: 0.3, incl: 0.85, arms: 2, ramp: 'SLATE', seed: 57 },
                { kind: 'star', x: -228, y: 40, ramp: 'VERDIGRIS', seed: 59 }, { kind: 'dwarf', x: 92, y: 112, r: 3, ramp: 'CRIMSON', seed: 61 }, { kind: 'star', x: -100, y: -122, ramp: 'SULPHUR', seed: 63 }],
            live: [{ kind: 'flashes', every: 22000, chance: 0.7, seed: 8, area: [-230, -126, 230, 126], ramp: 'STAR' }, { kind: 'glints', n: 3, seed: 14, area: [0, 40, 230, 126], drift: 0.25, warm: 0 }] },
        6: { seed: 746, haze: 1.1, dust: 0.16, band: { cx: 0, cy: 112, ang: -0.2, wide: 60, core: 18, peak: 0.4 }, density: 1.2, bandStars: 0.9, mix: [0.12, 0.05, 0.02], bright: 26, smudges: 18,
            galaxies: [{ x: -206, y: -100, r: 9, tilt: -0.3, incl: 0.6, arms: 0, bright: 0.48, seed: 28 }],
            gas: X => lightRing(X, { R: 300, tilt: -0.22, open: 0.27, gain: 0.84, seed: 81, k: 9, reach: 260, streams: 0.36 }),
            accents: [{ kind: 'star', x: -180, y: -112, ramp: 'VERDIGRIS', seed: 71 }, { kind: 'galaxy', x: -220, y: 106, r: 7, tilt: -0.6, incl: 0.45, arms: 2, ramp: 'SLATE', seed: 73 },
                { kind: 'dwarf', x: 200, y: 118, r: 4, ramp: 'CRIMSON', seed: 75 }, { kind: 'planetary', x: -92, y: -120, r: 3, ramp: 'JADE', seed: 77 }],
            live: [{ kind: 'comet', x0: -60, y0: -128, vx: 1.4, vy: 0.5, len: 36, curl: -0.3, seed: 15 }, { kind: 'comet', x0: -190, y0: 120, vx: 1.6, vy: -0.75, len: 26, curl: 0.3, seed: 16 },
                { kind: 'flashes', every: 18000, chance: 0.7, seed: 9, area: [-150, -100, 150, 100], ramp: 'WARM' }] },
    };
    /** Paint one sector's sky: a generator that yields every few rows (skyOf runs it). About half a second of work in all. */
    function* buildSky(n) {
        const rec = PLACES[n] || PLACES[2], B = skyBuffer(), seed = 500 + n * 41, X = { B, seed, hole: null };
        if (rec.holes) X.hole = yield* holes(rec.holes);
        yield* strip(X, rec.seed);
        (rec.bodies || []).forEach(b => body(X, b));
        if (rec.vast) yield* vastPlanet(X, rec.vast);
        if (rec.pillars) yield* pillars(X, rec.pillars);
        yield* starField(X, rec);
        (rec.clusters || []).forEach(c => cluster(X, c));
        if (rec.spiral) yield* bigGalaxy(X, rec.spiral);
        (rec.galaxies || []).forEach(g => (g.kind === 'lensed' ? lensed(X, g) : galaxy(B, g)));
        smudges(X, rec.smudges, seed + 50);
        if (rec.gas) yield* rec.gas(X);
        (rec.accents || []).forEach(a => accent(X, a));
        const glints = (rec.live || []).filter(l => l.kind === 'glints').map(l => {
            const rand = MiniLab.rng(l.seed), [x0, y0, x1, y1] = l.area;
            return Array.from({ length: l.n }, () => ({ x: x0 + rand() * (x1 - x0), y: y0 + rand() * (y1 - y0), vx: (rand() - 0.6) * l.drift, vy: (rand() - 0.5) * l.drift * 0.4, ph: rand() * 20000, per: 4500 + rand() * 9000, warm: rand() < l.warm }));
        });
        return { n, rec, B, glints };
    }
    const skies = new Map();                                    // sector → { gen, sky }: the last three painted (or being painted)
    /** Sector n's sky. Painted the first time it is asked for, all at once, or (budget ms) a little more each call; null until done. */
    function skyOf(n, budget = Infinity) {
        let job = skies.get(n);
        if (!job) {
            if (skies.size > 2) skies.delete(skies.keys().next().value);
            job = { gen: buildSky(n), sky: null };
            skies.set(n, job);
        }
        const end = performance.now() + budget;
        while (!job.sky) { const step = job.gen.next(); if (step.done) job.sky = step.value; else if (performance.now() > end) break; }
        return job.sky;
    }

    // ── the wrecks: our own class, our Lander (MiniPaint's LANDER, the travel view's hull), seen side on ──
    const L_NOSE = 0.215, L_SKIRT = 0.86, L_BELL = 0.94, L_DIAM = 0.62;   // shares of the length; its diameter in half-lengths
    const deckU = i => L_NOSE + i * (L_SKIRT - L_NOSE) / 6;
    /** The Lander's radius at lu (0 nose .. 1 the bell's mouth), in diameters; -1 off the ends (Paint.js radiusL). */
    function radiusL(lu) {
        if (lu < 0 || lu > 1) return -1;
        if (lu < L_NOSE) { const k = lu / L_NOSE; return 0.5 * (0.05 + 0.95 * Math.sqrt(Math.max(0, 1 - (1 - k) * (1 - k)))); }
        if (lu < L_SKIRT) return 0.5;
        if (lu < L_BELL) return 0.5 + 0.077 * ss(0.47, 1, (lu - L_SKIRT) / (L_BELL - L_SKIRT));
        return 0.5 * (26 + 52 * Math.pow((lu - L_BELL) / (1 - L_BELL), 1.15)) / 300;
    }
    const L_FLOORS = [1, 2, 3, 4, 5, 6].map(i => 1 - 2 * deckU(i));        // the deck floors, as hullAt's u (stern -1 .. nose 1)
    const W_PLATE = 1, W_SEAM = 2, W_WINDOW = 3, W_INSIDE = 4, W_BELL = 5, W_LEG = 6, W_SKIRT = 7, W_NOSE = 8, W_TORN = 16;
    // a wreck's weathering, in its own frame (along × across), worked out once per wreck: where its plates have gone to rust
    const RT_U = 64, RT_V = 16, rustMaps = new WeakMap();
    function rustMap(h) {
        let T = rustMaps.get(h);
        if (!T) { T = new Float32Array(RT_U * RT_V); for (let j = 0; j < RT_V; j++) for (let i = 0; i < RT_U; i++) T[j * RT_U + i] = fbm(i / 7, j / 2.6, (h.seed >>> 0) % 9973, 3); rustMaps.set(h, T); }
        return T;
    }
    /** How rusty wreck h is at (lu along, lvd across in diameters): 0..1, blended between the map's points. */
    function rustAt(h, lu, lvd) {
        const T = rustMap(h), fx = clamp(lu, 0, 1) * (RT_U - 1), fy = clamp(lvd + 0.5, 0, 1) * (RT_V - 1), i = Math.min(RT_U - 2, fx | 0), j = Math.min(RT_V - 2, fy | 0), u = fx - i, v = fy - j, o = j * RT_U + i;
        return T[o] + (T[o + 1] - T[o]) * u + (T[o + RT_U] - T[o] + (T[o + RT_U + 1] - T[o + RT_U] - T[o + 1] + T[o]) * u) * v;
    }
    /** What is at (u, v) on wreck h, drawn as our Lander: u, v as hullAt (u stern -1 .. nose 1, v across, both in half-lengths),
        so a tear falls exactly where hullAt (the hit test, unchanged) has it. o: { px one art pixel in half-lengths, ht the
        diameter in art pixels, detail 0..2 }. */
    function wreckAt(h, u, v, o) {
        if (u > 1 || u < -1) return 0;
        const lu = (1 - u) / 2, lv = v / L_DIAM, r = radiusL(lu), av = Math.abs(lv);
        let torn = false;
        if (h.cut) {                                                         // hullAt's tears, to the pixel
            const jag = hash(Math.floor(v * 50) + 64, h.seed) * 0.09, lo = h.deck - 0.03 - jag, hi = h.deck + 0.07 + jag * 1.3;
            if (h.cut === 1) { if (u > lo && u < hi) return 0; torn = (u > lo - 0.035 && u <= lo) || (u >= hi && u < hi + 0.035); }
            else if (h.cut === 2) { if (u > h.deck + jag) return 0; torn = u > h.deck + jag - 0.04; }
            else { if (u < h.deck - jag) return 0; torn = u < h.deck - jag + 0.04; }
        }
        if (av > r) {                                                        // the landing legs, folded along the skirt
            if (o.ht < 30 || lu < 0.7 || lu > 0.97) return 0;
            const d = (av - 0.5) * o.ht, k = clamp((lu - L_SKIRT) / 0.104, 0, 1), c = Math.max(1.2, (12.5 + 52 * k) / 600 * o.ht), w = Math.max(0.8, 2.6 / 600 * o.ht);
            return Math.abs(d - c) < w || (lu > 0.955 && d > c - 2 * w && d < c + 3 * w) ? W_LEG : 0;
        }
        if (lu >= L_BELL) return W_BELL;
        if (torn) return (av < r - o.px * 1.5 / L_DIAM ? W_INSIDE : W_PLATE) | W_TORN;   // inside the tear, or its scorched lip
        if (!o.detail) return lu < L_NOSE ? W_NOSE : lu > L_SKIRT ? W_SKIRT : W_PLATE;
        const pl = o.px / 2;                                                 // one art pixel along the hull, in shares of its length
        for (let i = 0; i <= 6; i++) if (Math.abs(lu - deckU(i)) < pl) return W_SEAM;
        if (lu > L_NOSE - 0.03 && lu < L_NOSE - 0.008 && [-0.3, -0.05, 0.2].some(k => Math.abs(lv - k) * o.ht < Math.max(1.3, o.ht * 0.04))) return W_WINDOW;   // the bridge's ring of windows, dark
        if (lu < L_NOSE) return W_NOSE;
        if (lu > L_SKIRT) return ((lu - L_SKIRT) / pl) % 4 < 1 ? W_SEAM : W_SKIRT;
        if (o.detail > 1) for (let i = 1; i < 6; i++) if (Math.hypot((lu - deckU(i) - 0.054) / pl, (lv + 0.32) * o.ht) < Math.max(1.4, o.ht * 0.05)) return W_WINDOW;   // a porthole per deck: nobody home
        return W_PLATE;
    }

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
        // the picture in art pixels (ui.art: 720 × 405 at density 1.5); the flight goes on thinking in 480 × 270 units
        const D = (ui.art && ui.art.d) || 1, AW = Math.round(W * D), AH = Math.round(H * D), FA = F * D;
        const img = ctx.createImageData(AW, AH), buf = new Uint32Array(img.data.buffer), depth = new Float32Array(AW * AH);
        const FLASH = R.SUN.rgb[6], SUN_LUT = new Float32Array(1200);   // the flash's colour; the light's glow by distance, each frame
        const fogAt = (z, near, far) => clamp((z - near) / (far - near), 0, 1) ** 0.8;
        let rustShare = 0;                                                    // how many of a wreck's plates have gone to rust
        // our ship in the corner: the Lander's decks top to bottom, lit; a scrape that breaks a deck turns it red
        const sound = makeSound(), shipL = MiniShip.layout(8, 172, 36, 76, MiniShip.LANDER_ORDER);
        const openedAt = performance.now(), SETTLE_MS = (window.ChoiceGuard && window.ChoiceGuard.LOCK_MS) || 400;
        const isSettling = () => performance.now() - openedAt < SETTLE_MS;   // a second click on whatever opened this must not choose how to fly
        let mode = 'ready', here = from, leg = null, t = 0, phaseT = 0, clock = 0, whiteAt = -99, rowAt = 0, auraT = 0, saidAt = -99, isEndReady = false;
        let auto = false, cam = [0, 0], vel = [0, 0], look = [0, 0], roll = 0, jolt = 0, nearT = 0, threat = false;
        let pointer = null, aiming = false, pressed = false, th = 0, queue = [], nextLine = 0, pinged = SECTORS[from].heard, pingAt = -9;
        const trail = [], held = new Set();   // where we were lately (the twin copies it); throttle keys pressed since the flight began
        const g = { heard: SECTORS[from].heard, heardAt: -9, seen: 0, hits: 0, damaged: startDamage(opts.damaged), hitRooms: [], nums: [], r: MiniLab.rng((Math.random() * 4294967295) >>> 0) };
        const view = { cr: 1, sr: 0, zm: 1, lx: 0, ly: 0, ox: 0, oy: 0, sunX: CX, sunY: CY, sunR: 0 };
        const taps = new Map(), STEER = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'd'], THROTTLE = [' ', 'w', 'Shift'];

        // the sky: the sector's place (skyOf), fixed at infinity, so it only pans and tilts; dust in depth; streaks close by
        function seedSky(sector) {
            here = sector;
            rustShare = RUST_SHARE[sector] || 0;
            skyOf(sector);
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

        // ── drawing: the camera and the sky. Everything below draws in ART pixels (AW × AH); the flight above is in units ──
        function setView() {   // the bank, where the camera looks, the push and shake of speed, a jolt after a scrape; the false sun sits dead ahead
            const b = smooth(th), shake = Math.max(0, (b - SHAKE_AT) / (1 - SHAKE_AT)) * 2.4 + 12 * jolt, rnd = () => Math.round((Math.random() - 0.5) * shake);
            view.cr = Math.cos(roll); view.sr = Math.sin(roll); view.zm = 1 - PUSH * b; view.lx = look[0] * F; view.ly = look[1] * F;
            view.ox = shake > 0 ? rnd() : 0; view.oy = shake > 0 ? Math.round(rnd() * 0.75) : 0;
            [view.sunX, view.sunY] = sky(0, 0);
        }
        /** A direction at infinity (in units at depth F) → art pixels; and a point in the world → art pixels. */
        const sky = (u, v) => {
            const du = (u - view.lx) * view.zm, dv = (v - view.ly) * view.zm;
            return [(CX + view.ox + du * view.cr - dv * view.sr) * D, (CY + view.oy + du * view.sr + dv * view.cr) * D];
        };
        const proj = (x, y, z) => sky((x - cam[0]) * F / z, (y - cam[1]) * F / z);
        /** A line from (x0, y0) to (x1, y1) in ramp r, its tone running v0 → v1, behind anything nearer than z. */
        function segZ(x0, y0, x1, y1, r, v0, v1, z) {
            x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
            const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, n = Math.max(1, dx, -dy);
            for (let k = 0, err = dx + dy; k < 1200; k++) {
                if (x0 >= 0 && x0 < AW && y0 >= 0 && y0 < AH) { const i = y0 * AW + x0, s = level(r, v0 + (v1 - v0) * Math.min(1, k / n), x0, y0); if (s && depth[i] > z && r.lum[s] > lum32(buf[i])) buf[i] = r.c32[s]; }
                if (x0 === x1 && y0 === y1) break;
                const e2 = 2 * err;
                if (e2 >= dy) { err += dy; x0 += sx; }
                if (e2 <= dx) { err += dx; y0 += sy; }
            }
        }
        /** Light that only adds: ramp r at tone v on art pixel (x, y), where it is brighter than what is there. */
        function lightPx(x, y, r, v) {
            x = Math.round(x); y = Math.round(y);
            if (x < 0 || x >= AW || y < 0 || y >= AH) return;
            const i = y * AW + x, k = level(r, v, x, y);
            if (k && r.lum[k] > lum32(buf[i])) buf[i] = r.c32[k];
        }
        /** How far through the sector we are: the flight's share, or its end before the jump and after it. */
        const progress = () => (mode === 'run' ? Math.min(1, t / leg.cfg.dur) : 1);
        /** The far sky through the camera: the place's sky, the teal haze over it, and the dust, warm only where the light
            reaches it. The nebula still thickens and thins across the flight (SECTORS neb). */
        function drawBackdrop(S, amt) {
            const sec = SECTORS[here], p = progress(), B = S.B, rec = S.rec;
            const thick = (lerp(sec.neb[0], sec.neb[1], p) + NEB_SWELL * Math.sin(Math.PI * p)) / NEB_MEAN;
            const hk = rec.haze * HAZE_GAIN * thick / 255, dk = rec.dust * DUST_GAIN * thick / 255;
            const reach = (DUST_REACH + 0.8 * (4 + 112 * amt ** 1.5)) * D, sx0 = view.sunX, sy0 = view.sunY;
            for (let i = 0; i < LIT.length; i++) LIT[i] = DUST_LIT0 + Math.exp(-Math.sqrt(i << LIT_SHIFT) / reach);   // the light's reach by distance²
            const cr = view.cr / view.zm / D, sr = view.sr / view.zm / D, ox = (CX + view.ox) * D, oy = (CY + view.oy) * D;
            const HZ = R.HAZE, DU = R.DUST, hzMax = HZ.n - 1, duMax = DU.n - 1, { id, val, hz, du } = B, litMax = LIT.length - 1;
            for (let y = 0; y < AH; y++) {
                const ey = y + 0.5 - oy, ex0 = 0.5 - ox, row = y * AW, by = (y & 7) << 3, dy2 = (y - sy0) * (y - sy0);
                let u = (ex0 * cr + ey * sr) + view.lx + SX, v = (-ex0 * sr + ey * cr) + view.ly + SY;
                for (let x = 0; x < AW; x++, u += cr, v -= sr) {
                    if (u < 0 || v < 0 || u >= SW || v >= SH) { buf[row + x] = INK32; continue; }
                    const k = (v | 0) * SW + (u | 0), b = BAY8[by | (x & 7)], s = id[k];
                    let c = INK32, l = 0;
                    if (s) { const pos = val[k] * STEPS[s], lo = pos | 0, st = (s << 3) + (pos - lo > b ? lo + 1 : lo); c = FLAT32[st]; l = FLATLUM[st]; }
                    const vh = hz[k] * hk, dk0 = du[k] * dk;
                    if (vh > 0.03) { const pos = (vh > 1 ? 1 : vh) * hzMax, lo = pos | 0, st = pos - lo > b ? lo + 1 : lo; if (HZ.lum[st] > l) { c = HZ.c32[st]; l = HZ.lum[st]; } }
                    if (dk0 * (DUST_LIT0 + 1) > 0.12) {                // the brightest of sky, haze and dust shows: no hard edge where the dust begins
                        const vd = dk0 * LIT[Math.min(litMax, (((x - sx0) * (x - sx0) + dy2) >> LIT_SHIFT))];
                        if (vd > 0.12 && vd * 0.75 > vh) { const pos = (vd > 1 ? 1 : vd) * duMax, lo = pos | 0, st = pos - lo > b ? lo + 1 : lo; if (DU.lum[st] > l) c = DU.c32[st]; }
                    }
                    buf[row + x] = c;
                }
            }
        }
        /** The stars, one art pixel each (the brightest with a small cross, a few twinkling), where they outshine the sky. */
        function drawStars(S) {
            const list = S.B.stars, step = Math.floor(clock * 1000 / 375);
            for (let i = 0; i < list.length; i++) {
                const s = list[i], [fx, fy] = sky(s.u, s.v), x = Math.round(fx), y = Math.round(fy);
                if (x < 1 || x >= AW - 1 || y < 1 || y >= AH - 1) continue;
                const j = y * AW + x;
                if (s.l > lum32(buf[j])) buf[j] = s.c;
                if (!s.arm || (s.tw && hash(i, step) < 0.25)) continue;
                [j - 1, j + 1, j - AW, j + AW].forEach(q => { if (s.al > lum32(buf[q])) buf[q] = s.arm; });
            }
        }
        /** The sky's slow motion, eight steps a second, fixed to the sky: glints of far wrecks, the pulsar's beams, comets, far flashes. */
        function drawLive(S) {
            const tq = Math.floor(clock * 8) * 125;
            S.glints.forEach(list => list.forEach(gl => {
                const s = tq / 1000, ph = (tq + gl.ph) % gl.per, r = gl.warm ? R.WARM : R.STAR, [x, y] = sky(gl.x + gl.vx * s, gl.y + gl.vy * s);
                if (ph < 125) { lightPx(x, y, r, 1); [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([a, b]) => lightPx(x + a, y + b, r, 0.5)); }
                else lightPx(x, y, ph < 375 ? r : R.FAR, ph < 375 ? 0.75 : 0.6);
            }));
            (S.rec.live || []).forEach(l => {
                if (l.kind === 'pulsar') {
                    const [cx, cy] = sky(l.x, l.y), a = (tq % l.period) / l.period * Math.PI + roll, ca = Math.cos(a), sa = Math.sin(a), len = l.len * D * view.zm;
                    for (let s = 2 * D; s < len; s += 0.5) for (const dir of [-1, 1]) for (let w = -2; w <= 2; w++) {
                        const au = s, wv = Math.exp(-((w / D / (0.6 + au / D * 0.1)) ** 2)) * Math.exp(-au / (len * 0.36)) * 0.6 * (0.65 + 0.7 * fbm(au / D / 5, dir > 0 ? 1 : 9, l.seed, 2));
                        if (wv > 0.03) lightPx(cx + dir * ca * s - sa * w, cy + dir * sa * s + ca * w, R.BEAM, wv);
                    }
                    const tick = tq % l.tick < 250;
                    lightPx(cx, cy, R.COLD, tick ? 1 : 0.8);
                    if (tick) [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([a, b]) => lightPx(cx + a, cy + b, R.COLD, 0.55));
                } else if (l.kind === 'comet') {
                    const s = clock, hx = l.x0 + l.vx * s, hy = l.y0 + l.vy * s, [x, y] = sky(hx, hy), d = Math.hypot(hx, hy) || 1;
                    const [ax, ay] = sky(hx + hx / d, hy + hy / d), ux = (ax - x) / (Math.hypot(ax - x, ay - y) || 1), uy = (ay - y) / (Math.hypot(ax - x, ay - y) || 1);
                    const cc = Math.cos(l.curl), sc = Math.sin(l.curl), bx = ux * cc - uy * sc, bY = ux * sc + uy * cc, len = l.len * D;
                    for (let k = 1; k < len; k++) {
                        const w1 = 0.5 + k * 0.06, w2 = 0.6 + k * 0.13, v1 = Math.exp(-k / (len * 0.5)) * 0.8 * (0.7 + 0.6 * fbm(k / D / 3, 3, l.seed, 2)), v2 = Math.exp(-k / (len * 0.28)) * 0.5;
                        for (let w = -Math.ceil(w2); w <= Math.ceil(w2); w++) {
                            if (Math.abs(w) <= w1) lightPx(x + ux * k - uy * w, y + uy * k + ux * w, R.ICE, v1 * Math.exp(-((w / w1) ** 2)));
                            lightPx(x + bx * k - bY * w, y + bY * k + bx * w, R.EMBER, v2 * Math.exp(-((w / w2) ** 2)));
                        }
                    }
                    lightPx(x, y, R.STAR, 1); [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([a, b]) => lightPx(x + a, y + b, R.ICE, 0.6));
                } else if (l.kind === 'flashes') {
                    const b = Math.floor(tq / l.every), at = tq - (b * l.every + h32(b, 9, l.seed) * (l.every - 1200));
                    if (h32(b, 7, l.seed) > l.chance || at < 0 || at >= 1000) return;
                    const [x0, y0, x1, y1] = l.area, [x, y] = sky(x0 + h32(b, 11, l.seed) * (x1 - x0), y0 + h32(b, 13, l.seed) * (y1 - y0)), r = R[l.ramp], f = Math.floor(at / 125), lv = [2, 4, 4, 3, 3, 2, 2, 1][f] / (r.n - 1);
                    lightPx(x, y, r, lv);
                    if (f >= 1 && f <= 4) [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([a, c]) => lightPx(x + a, y + c, r, lv * 0.5));
                    if (f === 1 || f === 2) [[-2, 0], [2, 0], [0, -2], [0, 2]].forEach(([a, c]) => lightPx(x + a, y + c, r, 0.25));
                }
            });
        }
        /** How big the light at the end of the heading is: it grows through the flight (fastest late) and with every sector. */
        function sunAmount() {
            const [a, b] = SECTORS[here].sun;
            if (mode === 'run') return a + (b - a) * progress() ** 1.5;
            return mode === 'done' ? b * (1 + (DONE_SUN - 1) * smooth(Math.min(1, phaseT / 3))) : b;   // before the jump: the sector we leave
        }
        /** The light, as the travel view paints it (Paint.js lightGlow): a white-gold core, a soft halo, a thin streak across and
            four spikes, all turning with the bank. A point in the first sectors, a small glow by the middle, a warm bloom filling
            the view at the end. It only ever adds light. */
        function drawSun() {
            const amt = sunAmount(), rh = 4 + 112 * amt ** 1.5, sx = view.sunX, sy = view.sunY, cr = view.cr, sr = view.sr, z = view.zm * D;
            const core = (0.6 + 7 * amt ** 1.7) * z, halo = rh / 3.2 * z, spikes = (3 + 5 * Math.min(1, amt * 2)) * z, s = 0.85 + 0.15 * Math.min(1, amt * 3);
            const glowReach = halo * 3.2 + core + 8 * z, SUN = R.SUN, k1 = core * 0.5 + 1.4, k2 = halo * 0.32 + 1, k3 = halo * 1.1 + 1, k4 = halo * 0.9 + 8 * z;
            const bloom = BLOOM * ss(BLOOM_FROM, BLOOM_FULL, amt), bloomR = rh * 0.5 * z, reach = bloom > 0 ? Math.max(glowReach, bloomR * 4) : glowReach;
            view.sunR = amt > 0.3 ? rh * 0.55 * D : 0;                        // dust inside this catches the light
            const n = Math.min(SUN_LUT.length - 1, Math.ceil(reach) + 1), fade = 1 / (SUN_LUT.length - 1);
            for (let k = 0; k <= n; k++) {                                    // the round part of the glow, by distance (one art pixel a step)
                const d = k, glow = d < glowReach ? s * (1.15 * Math.exp(-Math.max(0, d - core) / k1) + 0.7 * Math.exp(-d / k2) + 0.34 * Math.exp(-d / k3)) * (1 - ss(glowReach * 0.55, glowReach, d)) : 0;
                SUN_LUT[k] = glow + (bloom > 0 ? bloom * Math.exp(-d / bloomR) : 0);   // deep in, a warm bloom that fills the view
            }
            const SC = SUN.c32, SL = SUN.lum, top = SUN.n - 1, white = SC[top], beamW = 0.6 * D;
            for (let y = Math.max(0, Math.floor(sy - reach)); y <= Math.min(AH - 1, sy + reach); y++) {
                const ey = y + 0.5 - sy, row = y * AW, by = (y & 7) << 3;
                for (let x = Math.max(0, Math.floor(sx - reach)); x <= Math.min(AW - 1, sx + reach); x++) {
                    const ex = x + 0.5 - sx, d = Math.sqrt(ex * ex + ey * ey);
                    if (d > reach) continue;
                    const i = row + x;
                    if (d < core) { buf[i] = white; continue; }
                    const k = d | 0, f = d - k;
                    let v = k < n ? SUN_LUT[k] + (SUN_LUT[k + 1] - SUN_LUT[k]) * f : SUN_LUT[n] * fade;
                    if (d < glowReach) {                                       // the streak across and the four spikes, turned with the bank
                        const dx = ex * cr + ey * sr, dy = (-ex * sr + ey * cr) * 1.06, adx = Math.abs(dx), ady = Math.abs(dy);
                        if (ady < beamW || adx < 0.6) v += (1 - ss(glowReach * 0.55, glowReach, d)) * ((ady < beamW ? 0.34 * s * Math.exp(-adx / k4) : 0) + (adx < 0.6 || ady < 0.6 ? 0.7 * Math.exp(-d / spikes) : 0));
                    }
                    if (v < 0.004) continue;
                    const pos = (v > 1 ? 1 : v) * top, lo = pos | 0, st = pos - lo > BAY8[by | (x & 7)] ? lo + 1 : lo;
                    if (st && SL[st] > lum32(buf[i])) buf[i] = SC[st];
                }
            }
            return amt;
        }
        /** Dust down the heading (rust, lit warm near the light) and streaks of starlight close by; speed stretches both. */
        function drawMotes(mul) {
            const tail = 0.25 + mul * 1.15, reach = view.sunR + 60 * D;
            for (let i = 0; i < dust.length; i++) {
                const d = dust[i], a = proj(d.x, d.y, d.z), b = mul > 1.5 ? proj(d.x, d.y, d.z + tail) : a;
                if (a[0] < -30 * D || a[0] > AW + 30 * D || a[1] < -30 * D || a[1] > AH + 30 * D) { if (d.z < 80) dust[i] = newDust(true); continue; }
                const lit = Math.exp(-Math.hypot(a[0] - view.sunX, a[1] - view.sunY) / reach), v = (d.z < 90 ? 0.62 : d.z > 240 ? 0.34 : 0.46);
                if (lit > 0.35) segZ(a[0], a[1], b[0], b[1], R.SUN, v * (0.5 + 0.6 * lit), v * 0.3, d.z);
                else segZ(a[0], a[1], b[0], b[1], d.z < 90 ? R.STAR : R.HAZE, d.z < 90 ? v : 0.9, d.z < 90 ? v * 0.4 : 0.5, d.z);
            }
            for (let i = 0; i < streaks.length; i++) {
                const s = streaks[i], a = proj(s.x, s.y, s.z), b = proj(s.x, s.y, s.z + tail);
                if (a[0] < -60 * D || a[0] > AW + 60 * D || a[1] < -60 * D || a[1] > AH + 60 * D) { streaks[i] = newStreak(true); continue; }
                const v = 0.9 * clamp((56 - s.z) / 14, 0, 1) * (s.z < 14 ? 1 : 0.75);
                if (v > 0.05) segZ(a[0], a[1], b[0], b[1], R.STAR, v, v * 0.15, s.z);
            }
        }

        // ── drawing: wrecks, the twin and debris ──
        /** Fill a shape centred on (sx, sy), turned by a, inside a box ex × ey; shape(u, v) works in units of `unit` art px and
            returns a material (0 = empty). paint(px, py, i, edge, lean, m, u, v, lv): edge 1 faces the false sun, 2 faces away,
            0 inside; lean is -1..1 towards the light; lv is the light's direction across the shape. */
        function raster(sx, sy, ex, ey, unit, a, shape, z, paint) {
            const ca = Math.cos(a), sa = Math.sin(a), inv = 1 / unit;
            const lx0 = view.sunX - sx, ly0 = view.sunY - sy, ll = Math.hypot(lx0, ly0) || 1, Lx = lx0 / ll, Ly = ly0 / ll;
            const lv = -Lx * sa + Ly * ca, du = (Lx * ca + Ly * sa) * inv, dv = lv * inv;
            for (let py = Math.max(0, Math.floor(sy - ey)); py <= Math.min(AH - 1, Math.ceil(sy + ey)); py++) {
                const dy = py - sy;
                for (let px = Math.max(0, Math.floor(sx - ex)); px <= Math.min(AW - 1, Math.ceil(sx + ex)); px++) {
                    const dx = px - sx, u = (dx * ca + dy * sa) * inv, v = (-dx * sa + dy * ca) * inv, m = shape(u, v);
                    if (!m) continue;
                    const edge = !shape(u + du, v + dv) ? 1 : !shape(u - du, v - dv) ? 2 : 0, i = py * AW + px;
                    depth[i] = z;
                    paint(px, py, i, edge, (dx * Lx + dy * Ly) / Math.max(ex, ey), m, u, v, lv);
                }
            }
        }
        let plateRamp = R.HULL;
        /** A wreck's plating lit from the side the false sun is on: our Lander as a cylinder, its decks' seams, dark windows,
            the skirt and the bell; the older the sector, the more of its plates have gone to rust (plateRamp says which). */
        function wreckTone(h, m, u, v, lv, detail, b) {
            const lu = (1 - u) / 2, lvd = v / L_DIAM, cell = hash(Math.floor(lu * 26) + 300 + Math.floor((lvd + 0.6) * 7) * 977, h.seed);
            plateRamp = ss(0.66 - rustShare * 0.32, 0.74 - rustShare * 0.32, rustAt(h, lu, lvd)) > b ? R.RUST : R.HULL;   // weathered edges dither
            if (m === W_INSIDE) return 0.05 + (L_FLOORS.some(f => Math.abs(u - f) < 0.012) ? 0.24 : 0);
            if (m === W_SEAM) return 0.1;
            if (m === W_WINDOW) return 0.02;
            if (m === W_LEG) return lvd < 0 === lv < 0 ? 0.62 : 0.3;
            const c = clamp(lvd / Math.max(0.05, radiusL(lu)), -1, 1), dif = Math.max(0, c * lv * 0.85 + Math.sqrt(1 - c * c) * 0.38);
            if (m === W_BELL) { plateRamp = R.HULL; return 0.08 + 0.42 * dif; }
            const tone = WRECK_LIGHT * (0.12 + 0.5 * dif + (m === W_NOSE ? 0.05 : m === W_SKIRT ? -0.05 : 0));
            return detail === 2 ? tone + (cell * 7 % 1 - 0.5) * 0.06 : tone;
        }
        /** A beacon: warm, human-made, a double flash like a real marker light. It shows long before the hull does. */
        function beacon(bx, by, z, h) {
            const ph = (clock + h.ph) % h.period, r = clamp(1.8 + 46 / z, 1.8, 6) * D, cx = Math.round(bx), cy = Math.round(by), Rr = Math.ceil(r);
            if (!(ph < 0.14 || (ph > 0.3 && ph < 0.44))) return;
            for (let y = -Rr; y <= Rr; y++) for (let x = -Rr; x <= Rr; x++) { const d = Math.hypot(x, y) / r; if (d <= 1) lightPx(cx + x, cy + y, R.AMBER, 0.75 * (1 - d) ** 1.4); }
            [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([x, y]) => lightPx(cx + x, cy + y, R.AMBER, r > 2.6 * D ? 0.85 : 0.6));
            lightPx(cx, cy, R.AMBER, 1);
        }
        function brackets(cx, cy, rx, ry, r, v, arm = 4) {   // corner marks, one art pixel thin
            const x0 = Math.round(cx - rx), x1 = Math.round(cx + rx), y0 = Math.round(cy - ry), y1 = Math.round(cy + ry), c = r.c32[Math.round(v * (r.n - 1))];
            const put = (x, y) => { if (x >= 0 && x < AW && y >= 0 && y < AH) buf[y * AW + x] = c; };
            for (const [ex, ey, dx, dy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) for (let i = 0; i < arm; i++) { put(ex + i * dx, ey); put(ex, ey + i * dy); }
        }
        function drawHull(h, z, sx, sy, tags, sunAmt) {
            const unit = HULL_L * FA * view.zm / z, unitU = unit / D, fog = fogAt(z, 30, FAR_HULL * 0.85), a = h.a0 + h.spin * t + roll, ca = Math.cos(a), sa = Math.sin(a);
            const ex = Math.abs(ca) * unit + Math.abs(sa) * LEG_W * unit, ey = Math.abs(sa) * unit + Math.abs(ca) * LEG_W * unit + 2;
            if (unitU < 3.2) lightPx(sx, sy, unitU < 2 ? R.HAZE : R.HULL, unitU < 2 ? 0.95 - fog * 0.4 : 0.5 - fog * 0.2);   // a point down the heading
            else {
                const o = { px: 1 / unit, ht: L_DIAM * unit, detail: unitU > 30 ? 2 : unitU > 11 ? 1 : 0 };
                const rimWarm = sunAmt > 0.4 ? (sunAmt - 0.4) * 0.9 * (1 - fog) : 0;     // deep in, the light catches the edges
                const cover = fog > 0.62 ? (fog - 0.62) * 2.2 : 0, keep = 1 - 0.82 * fog;   // the farthest thin out into the dark
                raster(sx, sy, ex + 2, ey, unit, a, (u, v) => wreckAt(h, u, v, o), z, (x, y, i, edge, lean, m, u, v, lv) => {
                    const b = BAY8[((y & 7) << 3) | (x & 7)];
                    if (cover > b) return;
                    if (edge === 1 && rimWarm > b) { buf[i] = R.SUN.c32[level(R.SUN, 0.62 + 0.25 * rimWarm, x, y)]; return; }
                    const torn = m & W_TORN || (edge && h.cut && u > h.deck - 0.16 && u < h.deck + 0.22), mat = m & 15;   // any edge along the break is the break
                    if (torn && edge) { buf[i] = R.RUST.c32[level(R.RUST, 0.16 * keep, x, y)]; return; }   // a torn edge: scorched, never lit
                    const tone = edge === 1 ? 0.8 : edge === 2 ? 0.06 : wreckTone(h, mat, u, v, lv, o.detail, b) * (torn ? 0.45 : 1), r = edge ? R.HULL : plateRamp;
                    buf[i] = r.c32[level(r, tone * keep, x, y)];
                });
            }
            beacon(sx + h.bu * unit * ca, sy + h.bu * unit * sa, z, h);                // on the nose, or where the front broke off
            if (h.seenAt < 0) { if (unitU < 14) brackets(sx, sy, (4 + unitU * 0.4) * D, (4 + unitU) * D, R.UI, 0.6, 3); return; }   // a contact, not yet named
            const since = clock - h.seenAt;
            if (since < 1.6 && Math.floor(since * 5) % 2 === 0) brackets(sx, sy, ex + 3, ey + 1, R.UI, 0.8, 6);
            const ux = sx / D, top = (sy - ey) / D, bottom = (sy + ey) / D;
            if (ux > -20 && ux < W + 20 && top < H - 24 && bottom > 24) tags.push({ z, s: 'EXODUS-' + fmt(h.num), sx: ux, sy: top - 14 < TAG_TOP && bottom + 4 < TAG_BOTTOM ? bottom + 4 : top - 14, below: bottom + 4, fresh: since < 1.6 });
        }
        /** One slice of the twin, a disc at depth z. Seen from behind with the light ahead, the hull is dark; its outline (where
            the slice's edge turns side-on to us) catches the light. face: the skirt's underside, in shadow; tone: a deck's shade. */
        function twinSlice(cx, cy, Rr, z, tone, face, rimWarm) {
            if (Rr < 0.4 || cx + Rr < 0 || cx - Rr >= AW || cy + Rr < 0 || cy - Rr >= AH) return;
            const lx0 = view.sunX - cx, ly0 = view.sunY - cy, ll = Math.hypot(lx0, ly0) || 1, Lx = lx0 / ll / Rr, Ly = ly0 / ll / Rr, R2 = Rr * Rr, E2 = Math.max(0, Rr - 1.3) ** 2, HR = R.HULL;
            for (let y = Math.max(0, Math.floor(cy - Rr)); y <= Math.min(AH - 1, Math.ceil(cy + Rr)); y++) {
                const dy = y - cy;
                for (let x = Math.max(0, Math.floor(cx - Rr)); x <= Math.min(AW - 1, Math.ceil(cx + Rr)); x++) {
                    const dx = x - cx, d2 = dx * dx + dy * dy;
                    if (d2 > R2) continue;
                    const i = y * AW + x, c = dx * Lx + dy * Ly;
                    depth[i] = z;
                    if (face) { const q = Math.sqrt(d2) / Rr; buf[i] = HR.c32[level(HR, d2 > E2 ? (c > 0.3 ? 0.62 : 0.3) : Math.abs(q - 0.5) < 0.04 ? 0.24 : 0.1 + 0.08 * q, x, y)]; }   // the skirt's underside: its rim, the bell's housing
                    else if (Math.abs(c) < 0.24 || (face === null && c > -0.3 && d2 > E2)) buf[i] = rimWarm > BAY8[((y & 7) << 3) | (x & 7)] ? R.SUN.c32[level(R.SUN, 0.7, x, y)] : HR.c32[level(HR, 0.74, x, y)];
                    else buf[i] = HR.c32[level(HR, tone * (0.2 + 0.2 * Math.max(0, c)), x, y)];
                }
            }
        }
        /** Sector 5's twin: a Lander exactly like ours beside us, seen from behind: the hull as slices from the nose (far) to the
            bell (near), then the bell's mouth, its blue drive burning brighter as its throttle opens, a quarter of a second late. */
        function drawTwin(tw, sunAmt) {
            const s = z => FA * view.zm / Math.max(z, NEAR), a = proj(tw.x, tw.y, Math.max(tw.z, NEAR)), b = proj(tw.x, tw.y, tw.z + 2 * HULL_L);
            const n = clamp(Math.ceil(Math.hypot(a[0] - b[0], a[1] - b[1]) * 1.4), 40, 280), rimWarm = sunAmt > 0.4 ? (sunAmt - 0.4) * 0.9 : 0;
            const face = Math.round(n * (1 - L_BELL)), seamW = 1.5 / n;
            for (let k = n; k >= 0; k--) {                                                           // far (the nose) to near (the bell)
                const lu = 1 - k / n, z = tw.z + (k / n) * 2 * HULL_L;
                if (z < NEAR) break;
                const [cx, cy] = proj(tw.x, tw.y, z), rad = radiusL(k === face ? L_BELL - 1e-3 : lu) * L_DIAM * HULL_L * s(z);
                if (k === face) {                                                                  // the skirt's underside, round the bell, and the four folded legs
                    twinSlice(cx, cy, rad, z, 0, true, rimWarm);
                    for (let q = 0; q < 4; q++) { const a = Math.PI / 4 + q * Math.PI / 2 + roll; for (let e = 0.86; e <= 1.02; e += 0.04) lightPx(cx + Math.cos(a) * rad * e, cy + Math.sin(a) * rad * e, R.HULL, 0.5); }
                    continue;
                }
                if (lu >= L_BELL) { twinSlice(cx, cy, rad, z, 1.4, false, rimWarm); continue; }
                const seam = [0, 1, 2, 3, 4, 5, 6].some(i => Math.abs(lu - deckU(i)) < seamW), deck = [0, 1, 2, 3, 4, 5].findIndex(i => lu < deckU(i + 1)) % 2 ? 1.15 : 0.9;
                twinSlice(cx, cy, rad, z, seam ? 0.45 : deck, lu < L_NOSE ? null : false, rimWarm);
            }
            if (tw.z < NEAR) return;
            const flare = 0.45 + 0.55 * tw.b, [cx, cy] = proj(tw.x, tw.y, tw.z), Rb = radiusL(1) * L_DIAM * HULL_L * s(tw.z), RH = Rb * (2 + 2 * tw.b);   // the drive, burning
            for (let y = Math.max(0, Math.floor(cy - RH)); y <= Math.min(AH - 1, cy + RH); y++) for (let x = Math.max(0, Math.floor(cx - RH)); x <= Math.min(AW - 1, cx + RH); x++) {
                const d = Math.hypot(x - cx, y - cy);
                if (d < Rb * 0.8) buf[y * AW + x] = R.PLUME.c32[level(R.PLUME, 0.5 + 0.5 * flare * (1 - (d / (Rb * 0.8)) ** 2), x, y)];
                else if (d < RH) lightPx(x, y, R.PLUME, (1 - d / RH) ** 2 * 0.75 * flare);
            }
        }
        function drawFrag(f, z, sx, sy) {
            const Rr = f.rad * FA * view.zm / z, RU = Rr / D, fog = fogAt(z, 14, FAR_FRAG), face = Math.cos(f.flip * clock + f.a0), glint = face > 0.97 && z < 95;  // face-on to the light
            const isRust = (f.a0 * 1000) % 1 < rustShare, ramp = isRust ? R.RUST : R.HULL, keep = 1 - 0.8 * fog;
            if (RU < 1.4) {
                if (glint) lightPx(sx, sy, R.STAR, 1);
                else if (f.threat) lightPx(sx, sy, R.RED, 0.75);
                else lightPx(sx, sy, RU < 0.7 ? R.HAZE : ramp, RU < 0.7 ? keep : 0.55 * keep);
                return;
            }
            const sq = 0.22 + 0.78 * Math.abs(face);                                    // tumbling: the plate turns edge-on and back
            raster(sx, sy, Rr + 1, Rr + 1, Rr, f.a0 + f.spin * clock + roll, (u, v) => shardAt(f, u, v / sq), z, (x, y, i, edge, lean) => {
                if (f.threat && edge) { buf[i] = R.RED.c32[level(R.RED, 0.75, x, y)]; return; }
                const tone = edge === 1 ? 0.8 : edge === 2 ? 0.06 : 0.18 + 0.22 * lean + 0.28 * Math.abs(face), r = edge === 1 ? R.HULL : ramp;
                buf[i] = r.c32[level(r, tone * keep, x, y)];
            });
            if (!glint) return;                                                         // a glint: a point and a small cross that fades
            const gx = Math.round(sx + (view.sunX - sx) * 0.02), gy = Math.round(sy + (view.sunY - sy) * 0.02), arm = Math.min(5, Math.floor(Rr / 2));
            lightPx(gx, gy, R.STAR, 1);
            for (let i = 1; i <= arm; i++) [[i, 0], [-i, 0], [0, i], [0, -i]].forEach(([dx, dy]) => lightPx(gx + dx, gy + dy, R.STAR, 1 - i / (arm + 1)));
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
        function drawBox() {   // our own size where things cross us: corner marks, turning with the bank
            const isWarn = jolt > 0 || (threat && Math.floor(clock * 8) % 2);
            const r = isWarn ? R.RED : R.UI, v = isWarn ? 0.75 : nearT > 0 ? 1 : 0.6;
            const c = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([kx, ky]) => proj(cam[0] + kx * SHIP_R[0], cam[1] + ky * SHIP_R[1], ZHIT));
            c.forEach((p, k) => [c[(k + 1) % 4], c[(k + 3) % 4]].forEach(q => {
                const dx = q[0] - p[0], dy = q[1] - p[1], d = Math.hypot(dx, dy) || 1, Ln = Math.min(8 * D, d / 3);
                segZ(p[0], p[1], p[0] + dx / d * Ln, p[1] + dy / d * Ln, r, v, v, -1);
            }));
        }
        /** Mix art pixel (x, y) towards rgb c by a, in `steps` dithered steps: light that adds, or shade that darkens, never a screen door. */
        const mixPx = (x, y, c, a, steps) => {
            a = Math.min(1, Math.floor(a * steps + BAY8[((y & 7) << 3) | (x & 7)]) / steps);
            if (a <= 0 || x < 0 || x >= AW || y < 0 || y >= AH) return;
            const i = y * AW + x, p = buf[i], r = p & 255, g = (p >> 8) & 255, b = (p >> 16) & 255;
            buf[i] = (0xff000000 | ((b + (c[2] - b) * a) << 16) | ((g + (c[1] - g) * a) << 8) | (r + (c[0] - r) * a)) >>> 0;
        };
        function drawOverlays() {
            const ink = R.STAR.rgb[0], ix = shipL.cx * D, iy = (shipL.top + shipL.height * 0.55) * D, rx = shipL.D * 1.6 * D, ry = shipL.height * 0.62 * D;
            for (let y = Math.max(0, Math.floor(iy - ry)); y < Math.min(AH, iy + ry); y++) for (let x = Math.max(0, Math.floor(ix - rx)); x < Math.min(AW, ix + rx); x++) {
                const q = ((x - ix) / rx) ** 2 + ((y - iy) / ry) ** 2;
                if (q < 1) mixPx(x, y, ink, 0.85 * (1 - q) ** 0.6, 6);                 // the space behind our own ship goes quiet
            }
            if (jolt > 0) for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) {      // a scrape: the edges flash
                const e = Math.min(x, y, AW - 1 - x, AH - 1 - y) / D;
                if (e < 9) { const v = jolt * 1.5 * (1 - e / 9); if (v > BAY8[((y & 7) << 3) | (x & 7)]) buf[y * AW + x] = R.RED.c32[level(R.RED, 0.45 + 0.4 * v, x, y)]; }
            }
            // the jump: stars stretch, then one short white-gold flash from the light that clears as the next sector opens
            const white = mode === 'jump' ? clamp((phaseT - JUMP_TIME + 0.3) / 0.25, 0, 1) : clamp(1 - (clock - whiteAt) / 0.45, 0, 1);
            if (white > 0) for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) mixPx(x, y, FLASH, white * 1.6 - Math.hypot(x - view.sunX, y - view.sunY) / (300 * D), 8);
        }

        // ── words over the picture: a few quiet readouts in the game's own type, and the hull names that follow the wrecks ──
        const shown = new Map();
        /** ui.note, but only touching the page when something changed. */
        function note(id, text, o) {
            const key = text == null ? null : text + '|' + JSON.stringify(o);
            if (shown.get(id) === key) return;
            shown.set(id, key);
            ui.note(id, text, o);
        }
        function drawTags(tags) {
            const placed = [], named = new Set(), pxPerUnit = ui.canvas.getBoundingClientRect().width / W || 3, sunU = [view.sunX / D, view.sunY / D];
            for (const tag of tags.sort((p, q) => p.z - q.z)) {               // nearest first gets the space
                const tw = (tag.s.length * 7.6 + 4) / pxPerUnit, cx = clamp(tag.sx, tw / 2 + 4, W - tw / 2 - 4);
                const onSun = Math.abs(sunU[0] - cx) < tw / 2 + 6 && Math.abs(sunU[1] - tag.sy - 5) < 12;   // never cover the light
                const y = Math.round(clamp(onSun ? tag.below : tag.sy, TAG_TOP, TAG_BOTTOM));
                if (placed.some(p => Math.abs(cx - p[0]) < (tw + p[2]) / 2 + 4 && Math.abs(y - p[1]) < 14)) continue;
                if ([-0.5, 0, 0.5].some(f => depth[Math.round((y + 5) * D) * AW + Math.round((cx + tw * f) * D)] < tag.z - 0.3)) continue;   // hidden behind something nearer
                placed.push([cx, y, tw]);
                named.add(tag.s);
                note('hull ' + tag.s, tag.s, { x: cx, y, align: 'center', tone: tag.fresh ? 'ui' : tag.z < 30 ? 'text' : 'dim' });
            }
            shown.forEach((v, id) => { if (id.startsWith('hull ') && v !== null && !named.has(id.slice(5))) note(id, null); });
        }
        function drawHud() {   // the radio's count; who flies; on the start screen how to steer; once, how to go faster
            note('flying', auto && (mode === 'run' || mode === 'jump') ? 'A.U.R.A. FLYING' : null, { x: W - 8, y: 8, align: 'right', tone: 'ui' });
            const isCounting = mode !== 'done';
            note('heard', isCounting ? 'BEACONS HEARD' : null, { x: W - 8, y: 232, align: 'right', tone: 'dim' });
            note('count', isCounting ? fmt(g.heard) : null, { x: W - 8, y: 242, align: 'right', tone: clock - g.heardAt < 0.35 ? 'ui' : 'text', size: 'm' });
            note('steer', mode === 'ready' ? 'STEER CLEAR OF THE DEBRIS' : null, { x: CX, y: 176, align: 'center', tone: 'text', size: 'm' });
            note('how', mode === 'ready' ? 'USE THE MOUSE OR THE ARROWS' : null, { x: CX, y: 192, align: 'center', tone: 'dim', size: 'm' });
            note('faster', mode === 'run' && !auto && !throttleTaught && clock - whiteAt > 1.2 ? 'HOLD TO GO FASTER' : null, { x: 50, y: 246, tone: 'ui' });
        }
        function render(mul) {   // far to near: the sky, its stars and slow motion, the light, wrecks and debris, dust; then the instruments
            setView(); depth.fill(1e9);
            const S = skyOf(here), amt = sunAmount();
            drawBackdrop(S, amt);
            drawStars(S);
            drawLive(S);
            drawSun();
            const tags = mode === 'run' ? drawField(amt) : [];
            drawMotes(mul);
            if (mode === 'ready' || mode === 'run') drawBox();
            drawOverlays();
            ctx.putImageData(img, 0, 0);
            const b = Math.max(smooth(th), mode === 'jump' ? phaseT / JUMP_TIME : 0);   // our drive burns longer and brighter as the throttle opens
            MiniShip.draw(ctx, shipL, clock * 1000, { damaged: g.damaged, labels: false, plume: 0.2 + 0.8 * b });
            drawTags(tags);
            drawHud();
        }

        // ── input: the pointer steers wherever it is over the picture; holding the button (or Space, W, Shift) is the throttle ──
        ui.canvas.onpointermove = e => { pointer = ui.toPixel(e); aiming = true; };
        ui.canvas.onpointerleave = () => { if (!pressed) pointer = null; };
        ui.canvas.onpointerdown = e => {
            if (e.button) return;                                                       // the main button (or a touch) only
            pointer = ui.toPixel(e); aiming = true;
            if (mode === 'ready') { if (!isSettling()) start(false); return; }          // the click that starts the flight is not the throttle
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
            if (mode === 'ready') { if (!isSettling()) start(false); }
            else if (mode === 'done' && isEndReady && clock - rowAt > (k === 'Enter' ? 0.3 : 1)) end();   // only once A.U.R.A. is done
        });

        seedSky(from);
        say('A.U.R.A.', 'Debris on the heading, Commander. I can fly us through, if you prefer.', 0);
        row([{ label: 'Fly it myself', primary: true, onClick: () => start(false) }, { label: 'Let A.U.R.A. fly', onClick: () => start(true) }]);
        render(0.3);
        MiniLab.loop(dt => { render(update(dt)); skyOf(to, PAINT_AHEAD_MS); }, 30);   // the next sector's sky, a little each frame
        return () => { window.removeEventListener('pointerup', release); window.removeEventListener('pointercancel', release); queue = []; sound.stop(); };
    }

    MiniHost.register({
        id: 'corridor',
        title: 'Fly the corridor',
        kicker: 'Sector jump',
        hideHeader: true,                                   // a pilot sees the flight, not a game title over it
        density: DENSITY,                                   // 720 × 405 art pixels, the travel view's grain
        mount,
        autoResult(opts) {
            const { to } = readSectors(opts || {});
            return { scrapes: 0, auraFlew: true, beaconsHeard: SECTORS[to].heard, shipsSeen: SHIPS_PER_JUMP, hulls: [], damagedRooms: [] };
        },
    });
})();
