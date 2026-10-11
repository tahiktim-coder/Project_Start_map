/* Breach.js — Seal the breach: sector one's micrometeorite hazard, once per run (a port of prototypes/sim-bay/proto-breach.js).
   A speck of rock holes EXODUS-9. A.U.R.A. knows the ship is losing air but not where: with the hatches open every deck
   bleeds together. You look into one deck at a time (a big side view; the small ship on the right is the map) and watch the
   air move: in a quiet deck dust drifts to the ladder hatch the air leaves by; in the holed deck everything streams to one
   spot, frost blooms there, and the lamp beams thin out as the air goes (no air, no beam). Whoever is inside asks to be shut
   in. Click the spot, Jaxon climbs there, and you hold while he presses the patch on.
   THE LOOK (2026-10-11): the travel view's. The decks are the living ship's tower rooms (src/newscreen/ship: the cut hull,
   ribbed back wall, ceiling pipes, caged lamps, the ladder; bridge, lab, quarters and galley, hold, engineering with its
   reactor, med bay), painted once in art pixels at density 1.5 with the Deep field ramps and 8 × 8 dither; the crew are the
   crew-hires people (MiniCrew.person); the map is our Lander (MiniShip); the readouts are quiet words (ui.note). The deck
   order, the gameplay, the controls, the timing, the lines and the result are the same as before. The decks keep Breach's
   order (KEYS) so every climb and every draught is as it was; 'upgrades' (the old fabrication deck) is the med bay.
   Air: the hole vents K·√p a second (sealed, a full deck empties in 2/K s); an open hatch passes G·Δp.
   Controls: click a deck on the map (or 1–6, ↑↓) · click where everything drifts (or F) to mark the hole ·
   SEAL under the map (or H) · press and hold the picture (or Space) to patch · Continue (or Enter) at the end.

   const result = await MiniHost.play('breach', { crew: [{ id: 'mira', alive: true, injured: false }, …], sector: 1 });
   opts.crew    ids 'you' | 'aris' | 'mira' | 'vance' | 'jaxon'. Anyone not alive, or not in the list, is not drawn and never
                speaks; the commander is always aboard. Injured crew walk and climb slower. No list: everyone aboard and well.
                Jaxon patches the hole; if he is dead, the first alive of Vance, Aris, Mira does.
   opts.sector  the sector number, said in the narration (default 1).
   result       { damagedDeck: 'lab' | 'cargo' | 'engineering' | 'quarters' | null,   the deck that lost all its air; null if patched
                  hurt: ['mira', …],                                                   the crew caught in that deck
                  airLostPercent: 0..100 }                                             the ship's air vented through the hole */

(function () {
    'use strict';
    const MiniLab = window.MiniLab, MiniShip = window.MiniShip, MiniHost = window.MiniHost;
    if (!MiniLab || !MiniShip || !MiniHost) return;
    const C = MiniLab.C, W = MiniLab.W, H = MiniLab.H, S = MiniShip, clamp = MiniLab.clamp;

    // ── air (fractions of full pressure), pace, and the picture: the deck view is a window onto "the column" of all six decks ──
    const K_LEAK = 0.032, G_HATCH = 0.6, REFILL = 0.05, AUTO = 0.84, GONE = 0.004;   // sealed, a full deck empties in about a minute
    const WALK = 70, CLIMB = 95, CYCLE = 0.8, PATCH = 3, SLIP = 0.15;               // px/s (a person is 47 px, about 1.8 m); seconds
    const INJURED_PACE = 0.6;                                                        // an injured crew member moves at this share of the pace
    const INTRO = 2.6, CALL_BY = 22, LEAVE_AFTER = 15, HIT_R = 16, PULL = 12, LIFT = 7, MOTES = 56;
    const VX = 8, VY = 24, VW = 372, VH = 206, MAP = { x: 400, y: 24, w: 76, h: 204 }, CHIP = { x: 408, y: 238, w: 60, h: 15 };   // CHIP: seal / open, under the map
    const CW = VW, CX = CW / 2, HULL_OUT = 6, HULL_IN = 14, R0 = 64, SLAB = 16, IH = 136, CELL = SLAB + IH, TOP = 40, NDECK = 6, CAM_IN = 34, LADDER = 62;
    const COL_H = TOP + NDECK * CELL + SLAB + 60, LAMPS = [122, 218, 312];
    const cellTop = i => TOP + i * CELL, inTop = i => cellTop(i) + SLAB, floorY = i => cellTop(i) + CELL, camFor = i => inTop(i) - CAM_IN;
    const deckAt = y => clamp(Math.floor((y - 1 - TOP) / CELL), 0, NDECK - 1);       // the deck whose floor is at or below y

    const KEYS = ['bridge', 'lab', 'quarters', 'cargo', 'engineering', 'upgrades'];   // MiniShip's rooms, top to bottom
    const NAME = { bridge: 'BRIDGE', lab: 'LABORATORY', quarters: 'CREW QUARTERS', cargo: 'CARGO HOLD', engineering: 'ENGINEERING', upgrades: 'MED BAY' };
    const THE = { bridge: 'the bridge', lab: 'the laboratory', quarters: 'the crew quarters', cargo: 'the cargo hold', engineering: 'engineering', upgrades: 'the med bay' };
    const HOME = { you: [0, 214], aris: [0, 268], mira: [1, 176], vance: [3, 206], jaxon: [4, 300] };
    const HOLED = ['lab', 'cargo', 'engineering'];        // the hole goes where someone is inside, so there is a choice to make (all decks the game can damage)
    const EMPTY_DECK = 'quarters';                        // ... or here, when nobody who lives in those decks is alive
    const PATCHERS = ['jaxon', 'vance', 'aris', 'mira'];  // who climbs to the hole: the engineer, or the first of the others alive
    const CARERS = ['aris', 'vance', 'jaxon', 'mira'];    // who goes to the hurt when the written line's speaker can't
    const DECK = {                                        // who is in the holed deck, and what they say; get(name) asks for the patcher
        lab: { who: 'mira', close: 'Close it.', mask: 'I have a mask.', get: n => `Get ${n} here.`, go: "All right. I'm coming up the ladder." },
        cargo: { who: 'vance', close: 'Shut me in.', mask: "I've got a mask.", get: n => `Get ${n} down here.`, go: "Fine. I'm coming up." },
        engineering: { who: 'jaxon' },
    };
    const CALL = "It's in here with me. I can hear it, but I can't see it.";   // the patcher, when the hole is in their own deck
    const HURT = { mira: ['aris', "Mira's hurt. I'm going down to her."], vance: ['aris', "Vance is hurt. I'm going down to him."], jaxon: ['vance', "Jaxon's hurt. I'm going to him."],
        'jaxon,mira': ['aris', "Mira and Jaxon are both hurt. I'm going to them."], 'jaxon,vance': ['aris', "Vance and Jaxon are both hurt. I'm going to them."] };
    const IS_HURT = { aris: 'Aris is hurt.', mira: "Mira's hurt.", vance: 'Vance is hurt.', jaxon: "Jaxon's hurt." }, HER = { aris: 'her', mira: 'her', vance: 'him', jaxon: 'him' };
    const SECTOR_WORDS = ['one', 'two', 'three', 'four', 'five', 'six'];
    const PAPERS = [5, 12, 5, 4, 3, 6];
    const cap = s => s[0].toUpperCase() + s.slice(1), IS = key => (key === 'quarters' ? 'are' : 'is');

    /** Who is aboard: { id: { injured } } for the commander and every crew member alive in opts.crew (everyone, without a list). */
    function readRoster(opts) {
        const list = opts && Array.isArray(opts.crew) ? opts.crew : null;
        return Object.keys(HOME).reduce((roster, id) => {
            const m = list ? list.find(c => c && c.id === id) : { alive: true };
            const isAboard = id === 'you' || !!(m && m.alive !== false);
            return isAboard ? { ...roster, [id]: { injured: !!(m && m.injured) } } : roster;
        }, {});
    }
    function pickDeck(roster, rnd) {
        const lived = HOLED.filter(key => roster[DECK[key].who]);
        return lived.length ? lived[Math.floor(rnd() * lived.length)] : EMPTY_DECK;
    }


    // ══ THE PICTURE (2026-10-11): the six decks as the living ship's tower rooms, painted once per page in art pixels ══
    // A copy of the recipe in src/newscreen/ship/ShipArt.js and ShipRooms.js (the cut hull, the ribbed back wall, the ceiling
    // services, the caged lamps, the ladder and each room's furniture), so the breach needs nothing from src/newscreen. ART_D
    // art pixels stand behind one picture unit (the minigame's density: 720 × 405 art pixels, two screen pixels each at
    // 1080p, as the travel view). The gameplay's numbers stay in units; only the paint is in art pixels.
    const ART_D = 1.5, A = v => Math.round(v * ART_D);
    const AW = A(CW), AH = A(COL_H), AF = A(IH), AIL = A(HULL_IN), AIR = A(CW - HULL_IN), ALX = A(LADDER), ACX = AW / 2, ALAMPS = LAMPS.map(A);
    const aTop = i => A(cellTop(i)), aIn = i => A(inTop(i)), aFloor = i => A(floorY(i));
    const PLATE = 12, SKIN = 9, HO = ACX - SKIN, RIN = ACX - AIL, DESK = 54, SEAT = 22, LAMP_Y = 26;   // DESK, SEAT: the crew engine's
    const INK = '#05070a', ramp = (...hex) => ({ hex: [INK, ...hex], rgb: [INK, ...hex].map(MiniLab.rgb) });
    const RM = {                                          // the living ship's ramps (ShipArt.R): Deep field, warm only for lamps and what people keep
        WALL: ramp('#090e12', '#0e151a', '#131c22', '#19252c', '#213038', '#2c3e47', '#3c525c', '#566e78'),
        STEEL: ramp('#0d1317', '#151e24', '#1e2a31', '#29373f', '#37474f', '#4b5d66', '#677a82', '#8c9ea4'),
        HULL: ramp('#121c22', '#22333b', '#3d5560', '#8aa2aa', '#e6eef0'),
        SCR: ramp('#0b2a30', '#11505a', '#1e8c96', '#58d6dc', '#b8f6f4'),
        ICE: ramp('#0b1e26', '#123848', '#1f5f74', '#4fa8bf', '#a9e4f0', '#e8fbff'),
        AMBER: ramp('#3a2410', '#8a5422', '#e8964a', '#f7c483', '#fff3dc'),
        RED: ramp('#3a1210', '#8a2a22', '#e2574c', '#ffd2c8'),
        FABRIC: ramp('#11161e', '#1b232e', '#28323f', '#384452', '#4d5a69', '#68778a'),
        WOOL: ramp('#1a1416', '#2a2024', '#3e2f30', '#56423c', '#735a4b', '#8e735e'),
        LINEN: ramp('#1e2226', '#363c40', '#565d60', '#7f8584', '#a9ada6', '#cfd0c6'),
        CRATE: ramp('#111715', '#1b2420', '#27322d', '#36433d', '#4c5b54', '#6c7d74'),
        MED: ramp('#141c1e', '#26333a', '#40525a', '#65797f', '#93a8aa', '#c3d3d0', '#e4eeea'),
        GLASS: ramp('#0c201d', '#163830', '#24584a', '#3f8a72', '#7cc4a6'),
        PAPER: ramp('#1f1d19', '#38342b', '#5a5442', '#827a60', '#aaa082', '#cbc2a2'),
        FOOD: ramp('#2a160c', '#5a3016', '#8e5524', '#c2843a', '#e8b866'),
        TEAL: ramp('#062a2a', '#0e4d4a', '#1a7f72', '#2fcdb0', '#7ff5da'),
        STAR: ramp('#1b272c', '#4c5f66', '#b3c2c0', '#f6f1e4'),
        HAZE: ramp('#091115', '#0d1b21', '#12262e', '#193139'),
        DUST: ramp('#140e0a', '#26180f', '#3e2716', '#5e3c20'),
        EXT: ramp('#240c0a', '#4a1814', '#742a20', '#9a4030', '#bc6448'),
    };
    const BLANKET = { aris: ramp('#1e0f14', '#36161f', '#52202c', '#6e2c38', '#8a3c44'), cora: ramp('#10151d', '#1a2230', '#263246', '#36465e', '#4a5d78'),
        mira: ramp('#0c1a1a', '#142a2a', '#1f3e3c', '#2d5652', '#41736a'), vance: ramp('#15160e', '#232517', '#353822', '#4a4e30', '#636842'),
        jaxon: ramp('#1a120c', '#2c1e14', '#42301e', '#5c432a', '#7a5a38') };
    const WARM_T = [1, 0.72, 0.45], COOL_T = [0.5, 0.95, 1.08], ICE_T = [0.62, 0.92, 1.1], VAC_DIM = [0.6, 0.66, 0.76];
    const bay = MiniLab.bayer8, clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v), fbm = (x, y, s) => MiniLab.fbm(x, y, s, 3);
    const smooth = (a, b, v) => { const k = clamp01((v - a) / (b - a)); return k * k * (3 - 2 * k); };
    function hash(x, y, s = 0) {
        let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 362437)) | 0;
        h = Math.imul(h ^ (h >>> 13), 1274126177);
        return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    }
    /** The ramp step for tone v at art pixel (x, y): the two nearest steps, dithered on the 8 × 8 grain. */
    function level(r, v, x, y) { const top = r.hex.length - 1, pos = clamp01(v) * top, lo = Math.floor(pos); return Math.min(top, lo + (pos - lo > bay(x, y) ? 1 : 0)); }
    const shadeOf = (r, v) => r.hex[Math.min(r.hex.length - 1, Math.max(0, Math.round(clamp01(v) * (r.hex.length - 1))))];

    // ── the paint buffer: the whole column in art pixels, its colour and what every pixel is ──
    const SPACE = 0, HULL = 1, WALL = 2, FURN = 3;          // WALL is bare back wall: the only place the hole can be
    function painter() {
        const data = new Uint8ClampedArray(AW * AH * 4), kind = new Uint8Array(AW * AH), p = { data, kind, k: WALL };
        p.set = (x, y, rgb) => {
            x = Math.floor(x); y = Math.floor(y);
            if (x < 0 || y < 0 || x >= AW || y >= AH) return;
            const i = y * AW + x, o = i * 4;
            data[o] = rgb[0]; data[o + 1] = rgb[1]; data[o + 2] = rgb[2]; data[o + 3] = 255; kind[i] = p.k;
        };
        p.tone = (x, y, r, v) => { x = Math.floor(x); y = Math.floor(y); p.set(x, y, r.rgb[level(r, v, x, y)]); };
        return p;
    }
    /** The buffer seen from a deck: rows counted from oy (its ceiling), as ShipRooms paints. q.as(kind) says what comes next. */
    function local(p, oy) {
        const q = { oy, as: k => { p.k = k; }, kindAt: (x, y) => p.kind[(Math.floor(y) + oy) * AW + Math.floor(x)] };
        q.tone = (x, y, r, v) => p.tone(x, Math.floor(y) + oy, r, v);
        q.hex = (x, y, h) => p.set(x, Math.floor(y) + oy, MiniLab.rgb(h));
        q.region = (x0, y0, x1, y1, fn) => { for (let y = Math.floor(y0); y < Math.ceil(y1); y++) for (let x = Math.max(0, Math.floor(x0)); x < Math.min(AW, Math.ceil(x1)); x++) fn(x, y); };
        q.ellipse = (cx, cy, rx, ry, fn) => q.region(cx - rx - 1, cy - ry - 1, cx + rx + 1, cy + ry + 1, (x, y) => { const d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2; if (d < 1) fn(x, y, d); });
        q.line = (x0, y0, x1, y1, fn) => { const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0))); for (let k = 0; k <= n; k++) fn(Math.round(x0 + (x1 - x0) * k / n), Math.round(y0 + (y1 - y0) * k / n), k / n); };
        /** Space through glass: the travel view's teal haze and rust dust, a few stars. */
        q.sky = (x, y) => {
            const X = Math.floor(x), Y = Math.floor(y) + oy, s = hash(X, Y, 9), was = p.k;
            p.k = SPACE;
            if (s > 0.993) p.set(X, Y, RM.STAR.rgb[s > 0.999 ? 4 : s > 0.997 ? 3 : 2]);
            else {
                const h = Math.max(0, fbm(X / 38, Y / 26, 61) - 0.42) * 1.6, d = Math.max(0, fbm(X / 30, Y / 22, 77) - 0.58) * 2.2, r = d > h ? RM.DUST : RM.HAZE;
                p.set(X, Y, r.rgb[level(r, Math.max(h, d), X, Y)]);
            }
            p.k = was;
        };
        return q;
    }

    // ── the hull and the decks' shells (ShipArt.shell) ──
    function plating(p, x, y, d, side, solid) {
        let v;
        if (d === 0) v = side > 0 ? 0.8 : 0.3;
        else if (d === 1) v = side > 0 ? 0.52 : 0.22;
        else if (d >= PLATE - 2) v = d === PLATE - 1 ? 0.42 : 0.3;
        else v = solid ? 0.32 + (d === 2 ? 0.08 : 0) : 0.1 + ((y % 24) < 2 ? 0.16 : 0) + (fbm(d / 3, y / 5, 31) - 0.5) * 0.08;
        p.tone(x, y, RM.HULL, v);
    }
    function skin(p, x, y, k, side) {
        let v = side > 0 ? 0.4 + 0.045 * k + (k === SKIN - 1 ? 0.12 : 0) : 0.27 - 0.02 * k + (k === SKIN - 1 ? 0.07 : 0);
        const seam = y % 30;
        if (seam === 0) v -= 0.14; else if (seam === 1) v += 0.05;
        if ((seam === 3 || seam === 27) && k % 3 === 1) v += 0.1;
        v += (fbm(k / 3, y / 9, 33 + (side > 0 ? 1 : 0)) - 0.5) * 0.08;
        p.tone(x, y, RM.HULL, v);
    }
    /** One row of the cut hull, both sides: the skin beyond the cut, then the plating. Returns the inner edges. */
    function hullSides(p, y, hw, solid) {
        const xl = Math.round(ACX - hw), xr = Math.round(ACX + hw);
        p.k = HULL;
        for (let k = 0; k < SKIN; k++) { skin(p, xl - 1 - k, y, k, -1); skin(p, xr + k, y, k, 1); }
        for (let d = 0; d < PLATE; d++) { plating(p, xl + d, y, d, -1, solid); plating(p, xr - 1 - d, y, d, 1, solid); }
        return [xl + PLATE, xr - PLATE];
    }
    const RIBS = Array.from({ length: 15 }, (_, k) => { const th = (k - 7) * 12 * Math.PI / 180; return { x: ACX + RIN * Math.sin(th), w: Math.max(1, Math.round(6 * Math.cos(th))), c: Math.cos(th) }; });
    function backWall(x, ly, y) {
        const sx = (x + 0.5 - ACX) / RIN, c = Math.sqrt(Math.max(0, 1 - sx * sx)), l = ly - 22;
        let v = 0.15 + 0.13 * c + (fbm(x / 9, y / 7, 3) - 0.5) * 0.07;
        if (l % 44 === 0) v -= 0.07; else if (l % 44 === 1) v += 0.04;
        for (const r of RIBS) {
            const dx = x - (r.x - r.w / 2);
            if (dx >= 0 && dx < r.w) { v = 0.3 + 0.1 * r.c + (dx === r.w - 1 ? 0.12 : dx === 0 ? -0.08 : 0); if (l % 44 === 3 && dx === Math.floor(r.w / 2)) v += 0.15; break; }
            if ((dx === -2 || dx === r.w + 1) && l % 44 === 4) v += 0.12;   // a rivet by each rib
        }
        v *= 1 - 0.38 * smooth(AF - 72, AF, ly);                            // darker near the floor
        if (x >= ALX - 15 && x <= ALX + 15) v *= 0.55;                        // the ladder well is a recess
        return v;
    }
    function ceilingTone(x, ly) {
        const seg = (x + 13) % 64;
        let v;
        if (ly < 2) v = 0.08;
        else if (ly < 12) { v = ly === 11 ? 0.42 : ly === 2 ? 0.12 : 0.2 + (ly === 10 ? 0.06 : 0); if (seg === 0) v = 0.08; else if (seg === 1 || seg === 63) v += 0.12; }
        else if (ly === 12) v = 0.06;
        else if (ly < 16) v = [0.14, 0.24, 0.4][ly - 13];
        else if (ly < 19) v = [0.1, 0.2, 0.34][ly - 16];
        else v = (x % 5 === 0 && ly === 20) ? 0.3 : 0.1;
        if ((x + 31) % 82 < 2 && ly > 1) v = 0.3 + ((x + 31) % 82 === 1 ? 0.1 : 0);   // brackets
        return v;
    }
    /** The slab between two decks (24 rows): the deck plate on top, lightening holes in the beam, the liner under it. */
    function slabTone(x, ly) {
        if (ly === 0) return 0.62;
        if (ly === 1) return 0.4;
        if (ly < 4) return 0.26 + ((x + ly * 2) % 6 === 0 ? 0.08 : 0);
        if (ly === 4) return 0.12;
        if (ly < 15) { const hx = (x + 20) % 40; if (ly > 5 && ly < 14 && Math.hypot((hx - 20) / 1.6, ly - 9.5) < 3.4) return 0.05; return ly === 9 && (hx < 12 || hx > 28) ? 0.3 : 0.18; }
        if (ly < 17) return 0.24;
        return ly === 23 ? 0.06 : 0.1 + (ly === 20 ? 0.05 : 0);
    }
    function paintSlab(p, y0) {
        for (let y = y0; y < y0 + A(SLAB); y++) { hullSides(p, y, HO, true); p.k = HULL; for (let x = AIL; x < AIR; x++) p.tone(x, y, RM.STEEL, slabTone(x, y - y0)); }
    }
    /** The ladder well through a slab; its lid is drawn live (open, or shut with a wheel), with hazard paint either side. */
    function paintWell(p, y0) {
        const x0 = ALX - 14, x1 = ALX + 14;
        p.k = HULL;
        for (let y = y0; y < y0 + A(SLAB); y++) {
            for (let x = x0; x <= x1; x++) p.tone(x, y, RM.WALL, 0.05 + (y > y0 + 12 ? 0.03 : 0));
            p.tone(x0 - 1, y, RM.STEEL, 0.46); p.tone(x1 + 1, y, RM.STEEL, 0.3);
        }
        for (const [a, b] of [[ALX - 22, ALX - 15], [ALX + 16, ALX + 24]]) for (let y = y0 + 1; y < y0 + 4; y++) for (let x = a; x < b; x++) p.tone(x, y, ((x + y) >> 1) % 2 ? RM.AMBER : RM.STEEL, ((x + y) >> 1) % 2 ? 0.34 : 0.14);
    }
    function shell(p, d) {
        const top = aIn(d);
        paintSlab(p, aTop(d));
        if (d > 0) paintWell(p, aTop(d));
        for (let y = top; y < aFloor(d); y++) {
            const ly = y - top;
            hullSides(p, y, HO, false);
            for (let x = AIL; x < AIR; x++) {
                if (ly < 22) { p.k = HULL; p.tone(x, y, RM.STEEL, ceilingTone(x, ly)); } else { p.k = WALL; p.tone(x, y, RM.WALL, backWall(x, ly, y)); }
            }
        }
        p.k = FURN;
        for (const side of [-1, 1]) {                                        // knee brackets where the hull meets the ceiling
            const x0 = side < 0 ? AIL : AIR - 1, G = 22;
            for (let j = 0; j < G; j++) for (let k = 0; k < G - j; k++) {
                const x = x0 - side * k, y = top + 22 + j;
                if (side < 0 && x >= ALX - 16) continue;
                const edge = k === G - j - 1, hole = Math.hypot(k - 6, j - 6) < 3.2;
                p.tone(x, y, RM.STEEL, hole ? 0.06 : edge ? (side > 0 ? 0.3 : 0.5) : 0.24 + (j === 0 ? 0.08 : 0));
            }
        }
    }
    /** Above the bridge: the bottom of the nose cone, ring frames and the spine strut; space beyond the skin. */
    function nose(p) {
        const T0 = aTop(0), q = local(p, 0);
        for (let y = 0; y < T0; y++) {
            const hw = HO * Math.sqrt(Math.max(0, 1 - ((T0 - y) / 200) ** 2)), xl = Math.round(ACX - hw), xr = Math.round(ACX + hw);
            for (let x = 0; x < AW; x++) if (x < xl - SKIN || x >= xr + SKIN) q.sky(x, y);
            const [il, ir] = hullSides(p, y, hw, false);
            p.k = HULL;
            for (let x = il; x < ir; x++) {
                const ring = (T0 - y) % 46;
                let v = 0.07 + 0.05 * Math.sqrt(Math.max(0, 1 - ((x - ACX) / hw) ** 2)) + (fbm(x / 8, y / 6, 41) - 0.5) * 0.05;
                if (ring > 30 && ring < 35) v = [0.3, 0.2, 0.14, 0.08][ring - 31];
                if (Math.abs(x - ACX) < 2) v = x === ACX + 1 ? 0.28 : 0.2;
                p.tone(x, y, RM.WALL, v);
            }
        }
    }
    /** Under engineering's floor: the thrust frame, the tank tops, the skirt's bottom plate and the bell. */
    function tail(p) {
        const T = aFloor(NDECK - 1), q = local(p, T);
        paintSlab(p, T);
        for (let y = T + A(SLAB); y < AH; y++) {
            const ly = y - T - A(SLAB);
            if (ly < 40) {
                const [il, ir] = hullSides(p, y, HO, ly > 34);
                p.k = HULL;
                for (let x = il; x < ir; x++) {
                    let v = 0.06 + (fbm(x / 9, y / 7, 51) - 0.5) * 0.05;
                    if (Math.abs(((x + ly) % 60) - 30) < 1 || Math.abs(((x - ly + 600) % 60) - 30) < 1) v = 0.2;
                    const tank = [ACX - 150, ACX + 150].find(c => Math.hypot((x - c) / 62, (ly - 46) / 42) < 1);
                    if (tank) v = 0.12 + 0.36 * clamp01((x - tank) / 62 * 0.55 - (ly - 46) / 42 * 0.75 + 0.2);
                    p.tone(x, y, tank ? RM.STEEL : RM.WALL, v);
                }
                continue;
            }
            for (let x = 0; x < AW; x++) q.sky(x, y - T);
            const hw = 26 + (ly - 40) * 0.9;
            p.k = HULL;
            if (ly < 44) { for (let x = SKIN; x < AW - SKIN; x++) p.tone(x, y, RM.HULL, ly === 40 ? 0.5 : 0.22); continue; }
            for (let x = Math.round(ACX - hw); x < Math.round(ACX + hw); x++) {
                const u = (x + 0.5 - ACX) / hw;
                p.tone(x, y, RM.HULL, Math.abs(u) > 0.97 ? 0.3 : u > 0.86 ? 0.82 : u > 0.6 ? 0.55 : 0.16 + 0.26 * (u + 1) / 2 + (ly % 14 === 0 ? 0.08 : 0));
            }
        }
    }
    /** The ladder: two rails and a rung every 8 rows, from the bridge down to engineering, through every well. */
    function ladder(p) {
        p.k = FURN;
        const y0 = aIn(0) + 52, y1 = aFloor(NDECK - 1);
        for (let y = y0; y < y1; y++) {
            p.tone(ALX - 13, y, RM.STEEL, 0.42); p.tone(ALX - 12, y, RM.STEEL, 0.62); p.tone(ALX + 12, y, RM.STEEL, 0.5); p.tone(ALX + 13, y, RM.STEEL, 0.3);
            if (y % 8 === 2) for (let x = ALX - 11; x < ALX + 12; x++) { p.tone(x, y, RM.STEEL, 0.56); p.tone(x, y + 1, RM.STEEL, 0.16); }
        }
        for (let y = y0 - 2; y < y0 + 1; y++) for (let x = ALX - 13; x < ALX + 14; x++) p.tone(x, y, RM.STEEL, y === y0 - 2 ? 0.62 : 0.3);   // the grab bar at the top
    }

    // ── light (ShipArt.lightPass): lamps warm what is near them, screens cool it, quantized on the grain ──
    const lamp = (x, y, o = {}) => Object.assign({ x, y, reach: 50, k: 1, tint: WARM_T, up: 0.4 }, o);
    const screenLight = (x, y, k = 0.7) => lamp(x, y, { reach: 15, k, tint: COOL_T, up: 1 });
    /** Light rows y0..y1 of the buffer: optional dimming (a deck without air), the lights, and the lamps' beams in the air. */
    function lightPass(data, kind, y0, y1, lights, beams, dim) {
        for (let y = y0; y < y1; y++) for (let x = AIL; x < AIR; x++) {
            const i = y * AW + x, k4 = i * 4;
            if (kind[i] === SPACE) continue;
            let r = data[k4], g = data[k4 + 1], b = data[k4 + 2];
            if (dim) { r *= dim[0]; g *= dim[1]; b *= dim[2]; }
            for (const s of lights) {
                const dx = (x - s.x) / 1.25, dy = y - s.y, dd = dy < 0 ? dy * 2.2 : dy * 0.82, dist = Math.sqrt(dx * dx + dd * dd);
                if (dist > s.reach * 4.5) continue;
                const w = Math.exp(-dist / s.reach) * s.k * (s.up + (1 - s.up) * smooth(-18, 0, dy));
                if (w < 0.02) continue;
                const q = Math.min(1, Math.floor(Math.min(1, w * 1.15) * 5 + bay(x, y)) / 5);
                if (q <= 0) continue;
                const lum = 0.3 * r + 0.59 * g + 0.11 * b, gain = 1 + q * 2.2 * clamp01(1 - lum / 200), t = Math.min(1, q * 1.4), bloom = q * q;
                r += (lum * gain * s.tint[0] - r) * t + bloom * 40 * s.tint[0];
                g += (lum * gain * s.tint[1] - g) * t + bloom * 40 * s.tint[1];
                b += (lum * gain * s.tint[2] - b) * t + bloom * 40 * s.tint[2];
            }
            if (beams) {                                                    // air catches the light: a warm cone under every lamp
                let h = 0;
                for (const m of beams) { const dx = Math.abs(x - m.x), dy = y - m.y; if (dy > 0) h += Math.pow(Math.max(0, 1 - dx / (9 + dy * 0.24)) * Math.max(0, 1 - dy / 240), 1.1); }
                const q = Math.floor(Math.min(1, h * 0.6) * 3 + bay(x, y)) / 3;
                if (q > 0) { r += (214 - r) * q * 0.13; g += (150 - g) * q * 0.11; b += (92 - b) * q * 0.08; }
            }
            data[k4] = r; data[k4 + 1] = g; data[k4 + 2] = b;
        }
    }

    // ── furniture pieces (ShipRooms.js), on a deck's own rows: 0 is its ceiling, F its floor ──
    const F = AF;
    const led = (x, y, color, period) => ({ kind: 'led', x, y, color, dim: MiniLab.mix(color, INK, 0.62), period });
    function box(q, x0, y0, x1, y1, r, base, o = {}) {
        const tex = o.tex == null ? 0.05 : o.tex, s = o.seed || 7;
        q.region(x0, y0, x1, y1, (x, y) => {
            const dx = x - x0, dy = y - y0, ex = x1 - 1 - x, ey = y1 - 1 - y;
            let v = base + (fbm(x / 6, (y + q.oy) / 5, s) - 0.5) * tex * 2;
            if (dy === 0) v = base + (o.topLit == null ? 0.28 : o.topLit);
            else if (dy === 1 && o.topLit !== 0) v = base + 0.1;
            else if (ex === 0) v = base + 0.1;
            else if (dx === 0) v = base - 0.08;
            else if (ey === 0) v = base - 0.1;
            else if (o.panel && (dx === o.panel || ex === o.panel || dy === o.panel + 1 || ey === o.panel) && dx >= o.panel && ex >= o.panel && dy >= o.panel + 1 && ey >= o.panel) v = base - 0.07;
            else if (o.panel && dx === o.panel + 1 && dy > o.panel + 1 && ey > o.panel) v = base + 0.04;
            q.tone(x, y, r, v);
        });
    }
    function topSurface(q, x0, x1, y, rows, r, base) {
        for (let k = 0; k < rows; k++) q.region(x0 + (rows - k) * 0.5, y - rows + k, x1 - (rows - k) * 0.5, y - rows + k + 1, (x, yy) => q.tone(x, yy, r, base + (k === rows - 1 ? 0.24 : 0.08 + k * 0.03)));
    }
    function desk(q, x0, x1, o = {}) {
        const top = F - DESK, r = o.r || RM.STEEL;
        topSurface(q, x0, x1, top, 3, r, 0.3);
        q.region(x0, top, x1, top + 3, (x, y) => q.tone(x, y, r, y === top ? 0.62 : 0.42 - (y - top) * 0.06 + (x === x1 - 1 ? 0.08 : 0)));
        box(q, x0 + 2, top + 3, x1 - 1, F - 4, r, 0.22, { panel: 3, topLit: 0, seed: x0 });
        q.region(x0 + 4, F - 4, x1 - 3, F, (x, y) => q.tone(x, y, r, 0.07));
        if (o.vent) for (let y = top + 8; y < top + 20; y += 3) q.region(x1 - 14, y, x1 - 5, y + 1, (x, yy) => q.tone(x, yy, r, 0.1));
    }
    /** A monitor on a desk, turned toward someone at its left: its face a strip of lines. Returns its light. */
    function monitor(q, x, deskTop, w, h) {
        const y1 = deskTop - 3, y0 = y1 - h;
        q.region(x + 3, y1 - 2, x + 7, y1, (xx, y) => q.tone(xx, y, RM.STEEL, 0.3));
        q.region(x - 1, y0 - 1, x + w + 3, y1 - 2, (xx, y) => q.tone(xx, y, RM.STEEL, xx >= x + w ? 0.14 : y === y0 - 1 ? 0.5 : 0.24));
        q.region(x, y0, x + w, y1 - 3, (xx, y) => q.tone(xx, y, RM.SCR, 0.2 + ((y - y0) % 3 === 0 && (xx - x) < w - 2 - ((y * 7) % 5) ? 0.4 : 0.05)));
        return screenLight(x + w / 2, y0 + h / 2 + q.oy, 0.8);
    }
    function stool(q, cx) {
        const s = F - SEAT;
        q.region(cx - 7, s, cx + 8, s + 3, (x, y) => q.tone(x, y, RM.STEEL, [0.62, 0.4, 0.2][y - s] + (x === cx + 7 ? 0.08 : 0)));
        q.region(cx - 1, s + 3, cx + 2, F, (x, y) => q.tone(x, y, RM.STEEL, x === cx + 1 ? 0.44 : 0.26));
        q.region(cx - 5, F - 8, cx + 6, F - 7, (x, y) => q.tone(x, y, RM.STEEL, 0.36));
        q.region(cx - 6, F - 1, cx + 7, F, (x, y) => q.tone(x, y, RM.STEEL, 0.3));
    }
    function crate(q, x0, y0, x1, y1, seed, o) {
        box(q, x0, y0, x1, y1, RM.CRATE, 0.36 + (hash(seed, 1, 4) - 0.5) * 0.12, { panel: 3, seed });
        topSurface(q, x0, x1, y0, 2, RM.CRATE, 0.34);
        const sy = y0 + Math.round((y1 - y0) * 0.35);
        q.region(x0 + 1, sy, x1 - 1, sy + 1, (x, y) => q.tone(x, y, RM.CRATE, 0.18));
        if (x1 - x0 > 24) { const lx = x0 + 5, ly = y0 + Math.round((y1 - y0) * 0.55); q.region(lx, ly, lx + 9, ly + 5, (x, y) => q.hex(x, y, y === ly ? '#bfb088' : (x + y) % 3 ? '#a89a70' : '#8a7c58')); }
        if (o) o.surf(x0 + 1, x1 - 1, y0 - 2);
    }
    function jar(q, x, yBase, h, seed) {
        q.region(x, yBase - h, x + 6, yBase, (xx, y) => q.tone(xx, y, RM.GLASS, xx === x + 4 ? 0.8 : xx === x ? 0.24 : (y > yBase - h * 0.6 ? 0.5 : 0.32)));
        q.region(x, yBase - h - 2, x + 6, yBase - h, (xx, y) => q.tone(xx, y, RM.STEEL, 0.5));
        if (hash(seed, 2, 7) > 0.5) q.tone(x + 2, yBase - 4, RM.AMBER, 0.4);
    }
    function shelf(q, x0, x1, h, items, o) {
        const y = F - h;
        q.region(x0, y, x1, y + 3, (x, yy) => q.tone(x, yy, RM.STEEL, [0.6, 0.36, 0.14][yy - y]));
        for (const bx of [x0 + 6, x1 - 8]) q.region(bx, y + 3, bx + 2, y + 9, (x, yy) => q.tone(x, yy, RM.STEEL, 0.26 - (yy - y) * 0.01));
        items.forEach(([kind, x, ih, s]) => {
            if (kind === 'jar') jar(q, x, y, ih, s);
            else if (kind === 'box') box(q, x, y - ih, x + 12, y, RM.CRATE, 0.3, { tex: 0.03, topLit: 0.2 });
            else q.region(x, y - ih, x + 3, y, (xx, yy) => q.tone(xx, yy, RM.PAPER, 0.3 + (xx - x) * 0.12));
        });
        if (o) o.surf(x0, x1, y);
    }
    /** A window pane in the back wall, rounded, with space behind it and a frame lit on its upper right. */
    function pane(q, x0, y0, x1, y1) {
        const r = 5;
        q.region(x0 - 4, y0 - 4, x1 + 4, y1 + 4, (x, y) => {
            const qx = Math.max(x0 + r - x - 0.5, 0, x + 0.5 - (x1 - r)), qy = Math.max(y0 + r - y - 0.5, 0, y + 0.5 - (y1 - r)), out = Math.hypot(qx, qy) - r;
            if (out < 0 && x >= x0 && x < x1 && y >= y0 && y < y1) { q.sky(x, y); return; }
            if (out < 1) { q.tone(x, y, RM.STEEL, 0.08); return; }
            if (out < 4) { const lit = (x - x0) / (x1 - x0) * 0.5 + (y < y0 ? 0.3 : y >= y1 ? -0.2 : 0); q.tone(x, y, RM.STEEL, 0.26 + lit * 0.4 + (out < 2 ? 0.1 : 0)); }
        });
    }
    function porthole(q, cx, cy, r = 11) {
        q.region(cx - r - 5, cy - r - 5, cx + r + 6, cy + r + 6, (x, y) => {
            const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy);
            if (d < r) { q.sky(x, y); return; }
            if (d < r + 1) { q.tone(x, y, RM.STEEL, 0.1); return; }
            if (d < r + 4) { const lit = (dx - dy) / (d * 1.41); q.tone(x, y, RM.STEEL, 0.32 + 0.3 * lit + ((Math.round(Math.atan2(dy, dx) * 8 / Math.PI) & 1) && d > r + 2.5 ? 0.1 : 0)); return; }
            if (d < r + 5) q.tone(x, y, RM.WALL, 0.08);
        });
    }
    /** What every deck has by the ladder: an intercom, an extinguisher, hazard paint round the hatch; vents in the ceiling. */
    function dress(q, d, o, room) {
        const ix = ALX + 22;
        q.region(ix, F - 152, ix + 9, F - 138, (x, y) => q.tone(x, y, RM.STEEL, x === ix + 8 ? 0.42 : y === F - 152 ? 0.46 : ((y - F) % 2 === 0 && x > ix + 1 && x < ix + 7 ? 0.12 : 0.26)));
        room.fx.push(led(ix + 2, F - 141 + q.oy, '#5ff2cf', 3100 + d * 211));
        if (o.ext !== null) {
            const ex = o.ext || ALX + 34;
            q.region(ex, F - 62, ex + 6, F - 38, (x, y) => { if ((x === ex || x === ex + 5) && y === F - 62) return; q.tone(x, y, RM.EXT, x === ex + 4 ? 0.8 : x === ex ? 0.3 : 0.55 - (y > F - 44 ? 0.15 : 0)); });
            q.region(ex + 1, F - 66, ex + 5, F - 62, (x, y) => q.tone(x, y, RM.STEEL, 0.5));
            q.region(ex - 1, F - 54, ex + 7, F - 53, (x, y) => q.tone(x, y, RM.STEEL, 0.36));
        }
        (o.vents || []).forEach(vx => q.region(vx, 26, vx + 16, 34, (x, y) => q.tone(x, y, RM.STEEL, y === 26 ? 0.4 : (y % 2 ? 0.08 : 0.3) + (x === vx + 15 ? 0.06 : 0))));
    }
    /** The ceiling services every deck shares: two pipes on brackets, a valve wheel, a cable tray with sagging cables. */
    function overhead(q, d, o = {}) {
        const x0 = ALX + 16, x1 = AIR, PIPE = [0.5, 0.32, 0.18, 0.42, 0.24, 0.1];
        q.region(x0, 23, x1, 29, (x, y) => q.tone(x, y, RM.STEEL, PIPE[y - 23] + ((x + d * 7) % 61 === 0 ? 0.12 : 0)));
        for (let x = x0 + 10 + d * 5; x < x1 - 2; x += 44) q.region(x, 22, x + 2, 30, (xx, y) => q.tone(xx, y, RM.STEEL, xx === x + 1 ? 0.56 : 0.34));
        const vx = 150 + d * 61;
        q.ellipse(vx, 26, 3.5, 3.5, (x, y, k) => q.tone(x, y, k > 0.45 ? RM.RED : RM.STEEL, k > 0.45 ? 0.45 + (x > vx ? 0.12 : 0) : 0.3));
        if (o.tray === false) return;
        q.region(x0 + 20, 34, x1 - 6, 35, (x, y) => q.tone(x, y, RM.STEEL, 0.44));
        q.region(x0 + 20, 35, x1 - 6, 37, (x, y) => q.tone(x, y, RM.STEEL, 0.16 + (x % 6 === 0 ? 0.08 : 0)));
        for (let h = x0 + 20; h < x1 - 40; h += 58) {
            q.region(h, 30, h + 1, 34, (x, y) => q.tone(x, y, RM.STEEL, 0.4));
            [[RM.DUST, 0.6, 0], [RM.TEAL, 0.32, 3]].forEach(([r, v, k]) => { for (let x = h + 1; x < h + 58 && x < x1 - 6; x++) q.tone(x, 37 + Math.round((2.5 + k * 0.4) * Math.sin(Math.PI * (x - h) / 58)) + (k ? 1 : 0), r, v); });
        }
    }
    function jacket(q, x, y, r, base = 0.4) {
        q.region(x - 1, y - 3, x + 1, y, (xx, yy) => q.tone(xx, yy, RM.STEEL, 0.6));
        q.region(x - 6, y, x + 7, y + 28, (xx, yy) => {
            const dy = yy - y, half = dy < 3 ? 3 + dy * 1.5 : 7 - (dy > 22 ? 1 : 0);
            if (Math.abs(xx - x + 0.5) > half) return;
            q.tone(xx, yy, r, base + (xx > x + 2 ? 0.1 : 0) - (Math.abs(xx - x) < 1 ? 0.12 : 0) - (dy > 24 ? 0.06 : 0) + (dy === 0 ? 0.12 : 0));
        });
    }
    function mug(q, x, yBase, r = RM.LINEN) {
        q.region(x, yBase - 6, x + 5, yBase, (xx, y) => q.tone(xx, y, r, xx === x + 4 ? 0.62 : xx === x ? 0.24 : 0.42 + (y === yBase - 6 ? 0.14 : 0)));
        [[5, 5], [6, 4], [5, 3]].forEach(([dx, dy]) => q.tone(x + dx, yBase - dy, r, 0.34));
    }
    function clipboard(q, x, y, w = 10, h = 14) {
        q.region(x, y, x + w, y + h, (xx, yy) => q.tone(xx, yy, RM.PAPER, (yy - y) % 2 === 0 && yy > y + 2 && xx > x + 1 && xx < x + w - 2 - ((yy * 5) % 3) ? 0.32 : 0.5 + (xx === x + w - 1 ? 0.08 : 0)));
        q.region(x + 3, y - 1, x + w - 3, y + 1, (xx, yy) => q.tone(xx, yy, RM.STEEL, 0.6));
    }
    function duct(q, x0, x1, yBot) {
        q.region(x0, 22, x1, yBot, (x, y) => q.tone(x, y, RM.STEEL, 0.18 + 0.2 * (x - x0) / (x1 - x0) + ((y - 22) % 26 === 0 ? 0.14 : 0) + (x === x1 - 1 ? 0.12 : x === x0 ? -0.06 : 0)));
        q.region(x0 - 4, yBot, x1 + 4, yBot + 5, (x, y) => q.tone(x, y, RM.STEEL, y === yBot ? 0.5 : y === yBot + 4 ? 0.12 : 0.3 + (x === x1 + 3 ? 0.1 : 0)));
    }
    function placard(q, x, y, w, h, r = RM.LINEN) {
        q.region(x, y, x + w, y + h, (xx, yy) => q.tone(xx, yy, r, yy === y ? 0.42 : ((yy - y) % 2 === 0 && xx > x + 1 && xx < x + w - 2 - ((yy * 3) % 4)) ? 0.16 : 0.3));
    }
    /** A caged lamp hanging from the ceiling pipes. */
    function lampCage(q, lx, y0 = LAMP_Y) {
        for (let y = 20; y < y0 - 2; y++) q.tone(lx, y, RM.STEEL, 0.34);
        const row = (y, x0, x1, fn) => { for (let x = x0; x <= x1; x++) fn(x, y); };
        row(y0 - 2, lx - 4, lx + 4, (x, y) => q.tone(x, y, RM.STEEL, x === lx + 4 ? 0.5 : 0.3));
        row(y0 - 1, lx - 4, lx + 4, (x, y) => q.hex(x, y, Math.abs(x - lx) === 4 ? '#7a4a1e' : '#ffd28a'));
        row(y0, lx - 3, lx + 3, (x, y) => q.hex(x, y, x === lx ? '#fff4d6' : '#f0b060'));
        row(y0 + 1, lx - 2, lx + 2, (x, y) => q.hex(x, y, '#c4803a'));
    }
    /** A bunk frame with berths stacked h rows apart, each with its owner's blanket; head: the pillow's end (-1 left, 1 right). */
    function bunk(q, x0, x1, berths, head, room) {
        const topH = Math.max(...berths.map(b => b.h)) + 36;
        berths.forEach((b, k) => {
            const y = F - b.h, BL = BLANKET[b.who] || RM.WOOL, ceil = y - 32;
            q.region(x0 + 3, ceil, x1 - 3, y, (xx, yy) => q.tone(xx, yy, RM.WALL, 0.17 + (fbm(xx / 7, yy / 5, 13) - 0.5) * 0.06 - (yy < ceil + 2 ? 0.08 : 0) + ((xx - x0) % 26 === 0 ? -0.05 : 0)));
            q.region(x0 + 3, y + 5, x1 - 3, y + 8, (xx, yy) => q.tone(xx, yy, RM.STEEL, [0.5, 0.32, 0.16][yy - y - 5]));
            q.region(x0 + 3, y, x1 - 3, y + 5, (xx, yy) => q.tone(xx, yy, RM.FABRIC, [0.66, 0.52, 0.44, 0.38, 0.28][yy - y] + ((xx * 3) % 13 === 0 && yy > y ? -0.08 : 0)));
            const px0 = head < 0 ? x0 + 5 : x1 - 23;
            q.region(px0, y - 5, px0 + 18, y, (xx, yy) => { const c = (xx === px0 || xx === px0 + 17); if (c && (yy === y - 5 || yy === y - 1)) return; q.tone(xx, yy, RM.LINEN, 0.78 - (yy - y + 5) * 0.07 + (xx === px0 + 16 ? 0.05 : c ? -0.12 : 0)); });
            const foot = head < 0 ? x1 - 4 : x0 + 4, dir = head < 0 ? -1 : 1;
            if (b.state === 'rumpled') {
                for (let i = 0; i < 40; i++) {
                    const xx = foot + dir * i, hgt = Math.round(2 + 5 * Math.sin(Math.min(1, i / 34) * Math.PI) * (0.7 + 0.3 * Math.sin(i * 0.9)) + (hash(i, k, 3) > 0.7 ? 1 : 0));
                    for (let j = 0; j < hgt; j++) q.tone(xx, y - 1 - j, BL, 0.34 + j * 0.07 + (j === hgt - 1 ? 0.12 : 0) + ((i % 7 === 3) ? -0.14 : 0));
                }
            } else {
                const xa = head < 0 ? px0 + 19 : x0 + 4, xb = head < 0 ? x1 - 4 : px0 - 1;
                q.region(xa, y - 3, xb, y, (xx, yy) => q.tone(xx, yy, BL, yy === y - 3 ? 0.66 : 0.46 - (yy - y + 2) * 0.05));
                const fx0 = head < 0 ? x1 - 26 : x0 + 6;
                q.region(fx0, y - 8, fx0 + 20, y - 3, (xx, yy) => q.tone(xx, yy, BL, yy === y - 8 ? 0.72 : (yy - y + 8) % 2 ? 0.44 : 0.56));
            }
            const cx = head < 0 ? x1 - 10 : x0 + 3;                         // the curtain, tied back at the foot
            q.region(cx, ceil, cx + 7, y, (xx, yy) => {
                const t = (yy - ceil) / (y - ceil), w = Math.round(7 - 4 * Math.sin(Math.min(1, t * 1.6) * Math.PI * 0.5) + (t > 0.62 ? 2 * (t - 0.62) / 0.38 : 0));
                if (head < 0 ? xx < cx + 7 - w : xx >= cx + w) return;
                q.tone(xx, yy, BL, 0.3 + ((xx - cx) % 2 ? 0.1 : 0) + (yy === ceil ? 0.14 : 0));
            });
            q.region(x0 + 3, ceil - 1, x1 - 3, ceil, (xx, yy) => q.tone(xx, yy, RM.STEEL, 0.44));
            const lx = head < 0 ? x0 + 7 : x1 - 9;                         // a reading light in every berth
            q.hex(lx, ceil + 2, '#ffd28a'); q.hex(lx + 1, ceil + 2, '#f0b060'); q.hex(lx, ceil + 1, '#7a4a1e'); q.hex(lx + 1, ceil + 1, '#7a4a1e');
            room.lights.push(lamp(lx, ceil + 3 + q.oy, { reach: 20, k: 0.85, up: 0.2 }));
            room.surf(x0 + 4, x1 - 4, y - 2);
            (b.things || []).forEach(fn => fn(q, y));
        });
        for (const px of [x0, x1 - 3]) q.region(px, F - topH, px + 3, F, (x, y) => q.tone(x, y, RM.STEEL, [0.28, 0.48, 0.2][x - px]));
        q.region(x0, F - topH, x1, F - topH + 3, (x, y) => q.tone(x, y, RM.STEEL, [0.56, 0.32, 0.16][y - F + topH]));
        if (berths.some(b => b.h === SEAT)) box(q, x0 + 6, F - SEAT + 9, x1 - 6, F - 1, RM.STEEL, 0.2, { panel: 2, topLit: 0.06 });
    }

    // ── the rooms, top to bottom in Breach's order (KEYS): what stands in each, its lights, LEDs and the surfaces papers lie on ──
    const RX = { dc: 360, x0: 336, x1: 384, y0: 66, y1: 148 };   // engineering's reactor: its centre line and glass chamber (deck rows)
    const GLYPHS = { 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001', 5: '111100111001111', 6: '111100111101111',
        A: '010101111101101', B: '110101110101110', D: '110101101101110', E: '111100110100111', G: '011100101101011', H: '101101111101101',
        I: '111010010010111', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '111101101101111', Q: '010101101111011',
        R: '110101110101101', S: '111100111001111', T: '111010010010010', U: '101101101101111', Y: '101101010010010', ' ': '000000000000000' };
    const STENCIL = { bridge: '1 BRIDGE', lab: '2 LAB', quarters: '3 QUARTERS', cargo: '4 HOLD', engineering: '5 ENGINEERING', upgrades: '6 MED BAY' };
    function stencil(q, str, x0, y, d) {
        [...str].forEach((ch, i) => { const g = GLYPHS[ch] || GLYPHS[' ']; for (let k = 0; k < 15; k++) { const x = x0 + i * 4 + (k % 3), yy = y + Math.floor(k / 3); if (g[k] === '1' && hash(x, yy + q.oy, 5) > 0.18 && q.kindAt(x, yy) === WALL) q.tone(x, yy, RM.WALL, 0.62); } });
        q.region(x0, y + 7, x0 + str.length * 4 - 1, y + 8, (x, yy) => { if (hash(x, d, 9) > 0.25 && q.kindAt(x, yy) === WALL) q.tone(x, yy, RM.AMBER, 0.32); });
    }
    const ROOMS = {
        bridge(q, o) {                                                       // a band of windows, the helm, the chart desk, the chair, the suit locker
            overhead(q, 0, { tray: false });
            [[262, 340], [350, 428], [438, 516]].forEach(([a, b]) => pane(q, a, F - 166, b, F - 108));
            q.region(256, F - 104, 522, F - 100, (x, y) => q.tone(x, y, RM.STEEL, [0.56, 0.36, 0.22, 0.12][y - F + 104]));
            for (let x = 264; x < 514; x += 7) o.fx.push(led(x, F - 102 + q.oy, (x / 7) % 3 < 1 ? '#c4803a' : '#2fb6c0', 1700 + ((x * 37) % 900)));
            desk(q, 290, 384, { vent: true }); o.surf(292, 382, F - DESK - 2);
            o.lights.push(monitor(q, 318, F - DESK, 9, 16));
            for (let x = 296; x < 314; x += 3) o.fx.push(led(x, F - DESK - 1 + q.oy, x % 2 ? '#2fb6c0' : '#c4803a', 900 + x * 13));
            desk(q, 420, 512); o.surf(422, 510, F - DESK - 2);
            o.lights.push(monitor(q, 446, F - DESK, 14, 22));
            const cx = 232, s = F - SEAT;                                    // the commander's chair
            q.region(cx - 12, s, cx + 12, s + 4, (x, y) => q.tone(x, y, RM.FABRIC, [0.6, 0.44, 0.3, 0.16][y - s]));
            q.region(cx - 16, s - 44, cx - 11, s + 2, (x, y) => { const tilt = Math.floor((s - y) / 11); if (x < cx - 16 - tilt + 1 || x > cx - 11 - tilt) return; q.tone(x, y, RM.FABRIC, 0.26 + (x === cx - 11 - tilt ? 0.18 : 0) + (y < s - 36 ? 0.08 : 0)); });
            q.region(cx - 8, s - 10, cx + 10, s - 8, (x, y) => q.tone(x, y, RM.STEEL, y === s - 10 ? 0.5 : 0.24));
            q.region(cx - 2, s + 4, cx + 3, F - 2, (x, y) => q.tone(x, y, RM.STEEL, x === cx + 2 ? 0.42 : 0.22));
            q.region(cx - 10, F - 2, cx + 11, F, (x, y) => q.tone(x, y, RM.STEEL, y === F - 2 ? 0.46 : 0.2));
            o.surf(cx - 11, cx + 11, s - 1);
            box(q, 125, F - 158, 177, F, RM.STEEL, 0.2, { panel: 3 });       // the suit locker: a glass door, a helmet, a suit hanging
            q.region(131, F - 150, 171, F - 12, (x, y) => q.tone(x, y, RM.WALL, 0.07));
            q.ellipse(151, F - 128, 10, 10, (x, y) => { const nx = (x - 151) / 10, ny = (y - F + 128) / 10; q.tone(x, y, RM.LINEN, 0.24 + 0.5 * clamp01(nx * 0.6 - ny * 0.7 + 0.3)); });
            q.region(143, F - 124, 159, F - 120, (x, y) => q.tone(x, y, RM.SCR, 0.25));
            q.region(131, F - 117, 171, F - 115, (x, y) => q.tone(x, y, RM.STEEL, 0.5));
            q.region(139, F - 108, 163, F - 30, (x, y) => { const w = 12 - Math.abs(y - F + 70) * 0.04; if (Math.abs(x - 151) > w) return; q.tone(x, y, RM.LINEN, 0.28 + (x > 151 ? 0.1 : 0) + ((y + 2) % 16 === 0 ? -0.08 : 0)); });
            q.region(170, F - 150, 171, F - 12, (x, y) => q.tone(x, y, RM.STEEL, 0.4));
            q.region(520, F - 150, 532, F - 134, (x, y) => q.tone(x, y, RM.STEEL, (y % 2) ? 0.16 : 0.38));   // A.U.R.A.'s speaker
            o.fx.push(led(526, F - 154 + q.oy, '#c9d1d6', 5200));
            dress(q, 0, { vents: [236], ext: 190 }, o);
        },
        lab(q, o) {                                                          // the star map pinned up, the bench under shelves of jars, the fridge
            overhead(q, 1);
            porthole(q, 250, F - 164);
            const mx0 = 128, my0 = F - 146, mw = 64, mh = 58, mcx = mx0 + 22, mcy = my0 + 30;   // the record's pulsar map, drawn on paper
            q.region(mx0, my0, mx0 + mw, my0 + mh, (x, y) => q.tone(x, y, RM.PAPER, 0.5 - (y - my0) / mh * 0.12 + (fbm(x / 4, y / 4, 71) - 0.5) * 0.1 + (x === mx0 + mw - 1 || y === my0 + mh - 1 ? -0.2 : 0)));
            for (let k = 0; k < 14; k++) {
                const a = (k / 14) * Math.PI * 2 + 0.3, len = 9 + hash(k, 3, 7) * 17;
                q.line(mcx, mcy, mcx + Math.cos(a) * len, mcy + Math.sin(a) * len * 0.92, (x, y, t) => { if (t > 0.08) q.tone(x, y, RM.PAPER, (Math.round(t * 20) % 3 === 0 && t > 0.3) ? 0.15 : 0.24); });
            }
            q.line(mcx, mcy, mx0 + mw - 4, mcy, (x, y) => q.tone(x, y, RM.PAPER, 0.18));
            [[mx0 + 2, my0 + 2], [mx0 + mw - 3, my0 + 2], [mx0 + 2, my0 + mh - 3], [mx0 + mw - 3, my0 + mh - 3]].forEach(([x, y]) => q.hex(x, y, '#c4803a'));
            jacket(q, 210, 60, RM.LINEN, 0.5);                               // Mira's lab coat
            clipboard(q, 196, 94);
            desk(q, 300, 472); o.surf(302, 470, F - DESK - 2);
            shelf(q, 306, 466, 100, [['jar', 312, 9, 1], ['jar', 322, 12, 2], ['jar', 332, 8, 3], ['box', 346, 8], ['jar', 366, 11, 4], ['book', 386, 12], ['book', 390, 10], ['book', 394, 13], ['jar', 414, 10, 5], ['jar', 424, 7, 6], ['box', 440, 10]], o);
            shelf(q, 322, 452, 132, [['box', 328, 9], ['box', 342, 12], ['jar', 364, 8, 11], ['jar', 376, 10, 12], ['book', 396, 13], ['book', 400, 12], ['book', 404, 11], ['jar', 428, 9, 13]], o);
            const top = F - DESK - 3;
            q.region(400, top - 3, 420, top, (x, y) => q.tone(x, y, RM.STEEL, 0.3));                                  // the microscope
            q.region(412, top - 26, 416, top - 3, (x, y) => q.tone(x, y, RM.STEEL, x === 415 ? 0.5 : 0.24));
            q.line(414, top - 26, 404, top - 34, (x, y) => { q.tone(x, y, RM.STEEL, 0.46); q.tone(x, y + 1, RM.STEEL, 0.22); });
            q.region(402, top - 37, 406, top - 33, (x, y) => q.tone(x, y, RM.STEEL, 0.56));
            q.region(403, top - 14, 412, top - 12, (x, y) => q.tone(x, y, RM.STEEL, 0.5));
            for (let k = 0; k < 4; k++) jar(q, 432 + k * 9, top, 8 + (k % 2) * 3, 20 + k);
            box(q, 484, F - 126, 528, F, RM.MED, 0.36, { panel: 3, tex: 0.03 });   // the sample fridge
            q.region(490, F - 118, 522, F - 52, (x, y) => q.tone(x, y, RM.ICE, 0.22 + ((y - F + 118) % 16 === 0 ? 0.3 : 0) + ((x * 7 + y) % 9 === 0 ? 0.14 : 0)));
            q.region(519, F - 100, 521, F - 70, (x, y) => q.tone(x, y, RM.MED, 0.7));
            o.lights.push(lamp(506, F - 84 + q.oy, { reach: 18, k: 0.5, tint: ICE_T, up: 1 }));
            o.fx.push(led(492, F - 46 + q.oy, '#5ff2cf', 2400));
            o.surf(486, 526, F - 128);
            stool(q, 236);
            dress(q, 1, { vents: [420] }, o);
        },
        quarters(q, o) {                                                     // two bunks (five berths), the galley counter, the table they eat at
            overhead(q, 2);
            porthole(q, 312, F - 166);
            dress(q, 2, { vents: [470], ext: null }, o);
            bunk(q, 122, 230, [{ h: SEAT, state: 'rumpled', who: 'aris' }, { h: 72, state: 'made', who: 'cora' }], -1, o);
            const photo = (qq, y) => {                                       // Jaxon's photo of his daughter
                const x0 = 512, y0 = y - 26;
                qq.region(x0, y0, x0 + 11, y0 + 13, (x, yy) => qq.tone(x, yy, RM.LINEN, 0.74));
                qq.region(x0 + 1, y0 + 1, x0 + 10, y0 + 10, (x, yy) => qq.tone(x, yy, RM.DUST, 0.4 + (yy - y0) * 0.04));
                qq.region(x0 + 4, y0 + 3, x0 + 7, y0 + 6, (x, yy) => qq.hex(x, yy, '#d8a07a'));
                qq.region(x0 + 3, y0 + 6, x0 + 8, y0 + 10, (x, yy) => qq.hex(x, yy, '#c4803a'));
            };
            bunk(q, 446, 537, [{ h: SEAT, state: 'rumpled', who: 'mira' }, { h: 72, state: 'rumpled', who: 'vance' }, { h: 122, state: 'made', who: 'jaxon', things: [photo] }], 1, o);
            q.region(238, F - 100, 300, F - 58, (x, y) => q.tone(x, y, RM.LINEN, ((x - 238) % 6 === 0 || (y - F) % 6 === 0) ? 0.1 : 0.19));   // the galley: tiles, the counter
            desk(q, 236, 302); o.surf(238, 300, F - DESK - 2);
            const top = F - DESK - 3;
            for (const hx of [244, 262]) q.region(hx, top - 1, hx + 13, top + 1, (x, y) => q.tone(x, y, RM.STEEL, y === top - 1 ? 0.16 : 0.06));
            q.region(284, top - 11, 297, top - 1, (x, y) => { if ((x === 284 || x === 296) && y === top - 11) return; q.tone(x, y, RM.STEEL, x === 295 ? 0.66 : x === 284 ? 0.24 : 0.38 + (y === top - 11 ? 0.18 : 0)); });
            q.region(287, top - 13, 294, top - 11, (x, y) => q.tone(x, y, RM.STEEL, 0.5));
            q.region(240, F - 104, 300, F - 102, (x, y) => q.tone(x, y, RM.STEEL, y === F - 104 ? 0.56 : 0.24));
            [[246, 14], [256, 11], [268, 9], [286, 12]].forEach(([ux, len], k) => {
                q.region(ux, F - 102, ux + 1, F - 102 + len, (x, y) => q.tone(x, y, RM.STEEL, 0.6));
                q.region(ux - 2, F - 102 + len, ux + 3, F - 99 + len, (x, y) => q.tone(x, y, RM.STEEL, x === ux + 2 ? 0.66 : 0.4 - k * 0.04));
            });
            box(q, 236, F - 152, 302, F - 112, RM.STEEL, 0.26, { panel: 2 });
            q.region(268, F - 152, 270, F - 112, (x, y) => q.tone(x, y, RM.STEEL, 0.1));
            const tt = F - 42, t0 = 330, t1 = 424;                           // the table: bowls set out for five, a jug, cups
            topSurface(q, t0, t1, tt, 3, RM.STEEL, 0.34);
            q.region(t0, tt, t1, tt + 4, (x, y) => q.tone(x, y, RM.STEEL, [0.66, 0.46, 0.3, 0.16][y - tt] + (x === t1 - 1 ? 0.08 : 0)));
            for (const lx of [t0 + 10, t1 - 13]) q.region(lx, tt + 4, lx + 3, F, (x, y) => q.tone(x, y, RM.STEEL, [0.18, 0.4, 0.22][x - lx]));
            [340, 358, 376, 394, 412].forEach((bx, k) => {
                q.region(bx - 4, tt - 6, bx + 5, tt - 2, (x, y) => { if (Math.abs(x - bx) > 4) return; q.tone(x, y, RM.LINEN, y === tt - 6 ? 0.74 : 0.5 + (x > bx ? 0.1 : 0) - (y === tt - 3 ? 0.1 : 0)); });
                q.region(bx - 3, tt - 7, bx + 4, tt - 6, (x, y) => q.tone(x, y, RM.FOOD, 0.6 + ((x + k) % 3 === 0 ? 0.12 : 0)));
            });
            q.region(366, tt - 12, 372, tt - 2, (x, y) => { if (y === tt - 12 && (x === 366 || x === 371)) return; q.tone(x, y, RM.GLASS, x === 370 ? 0.8 : 0.42 + (y > tt - 6 ? 0.12 : 0)); });
            o.surf(t0 + 2, t1 - 2, tt - 3);
            [314, 432].forEach(c => stool(q, c));
            const lineY = x => F - 150 + Math.round(7 * Math.sin(Math.PI * (x - 320) / 110));   // a line strung across, cloth hung on it
            for (let x = 320; x <= 430; x++) q.tone(x, lineY(x), RM.STEEL, 0.34);
            [[332, 16, 22, RM.LINEN, 0.32], [362, 12, 15, BLANKET.jaxon, 0.4], [392, 18, 12, RM.TEAL, 0.3], [414, 10, 18, BLANKET.aris, 0.38]].forEach(([cx, w, drop, r, base]) => {
                for (let x = cx; x < cx + w; x++) { const y0 = lineY(x) + 1, dd = drop - ((x - cx) % 5 === 4 ? 1 : 0); for (let y = y0; y < y0 + dd; y++) q.tone(x, y, r, base + (y === y0 ? 0.16 : 0) + ((x - cx) % 3 === 0 ? -0.08 : 0)); }
            });
            o.lights.push(lamp(377, 82 + q.oy, { reach: 58, k: 0.9 }));   // the low lamp over the table
            q.line(377, 20, 377, 78, (x, y) => q.tone(x, y, RM.STEEL, 0.3));
            lampCage(q, 377, 82);
        },
        cargo(q, o) {                                                        // the hold: crate stacks, a net, the gantry hook, the cargo terminal
            overhead(q, 3, { tray: false });
            porthole(q, 384, F - 164);
            dress(q, 3, { vents: [480] }, o);
            crate(q, 125, F - 32, 171, F, 1, o); crate(q, 171, F - 28, 217, F, 2, o); crate(q, 133, F - 58, 179, F - 32, 3, o);
            q.region(410, F - 160, 536, F - 92, (x, y) => { if ((x + y) % 9 === 0 || (x - y + 900) % 9 === 0) q.tone(x, y, RM.STEEL, 0.28 + ((x + y) % 18 === 0 ? 0.08 : 0)); });
            crate(q, 418, F - 36, 470, F, 4, o); crate(q, 470, F - 40, 536, F, 5, o); crate(q, 424, F - 66, 480, F - 36, 6, o); crate(q, 478, F - 72, 530, F - 40, 7, o); crate(q, 436, F - 92, 490, F - 66, 8, o);
            for (let x = 421; x < 534; x++) if (x % 40 === 21) q.region(x, F - 92, x + 2, F, (xx, y) => q.tone(xx, y, RM.AMBER, 0.2 + (xx === x + 1 ? 0.06 : 0)));
            q.region(140, 30, 524, 34, (x, y) => q.tone(x, y, RM.STEEL, [0.5, 0.34, 0.24, 0.1][y - 30]));   // the gantry, its trolley, chain and hook
            q.region(330, 34, 344, 40, (x, y) => q.tone(x, y, RM.STEEL, 0.36 + (x === 343 ? 0.12 : 0)));
            for (let y = 40; y < F - 128; y += 3) q.region(336, y, 338, y + 2, (x, yy) => q.tone(x, yy, RM.STEEL, 0.42));
            q.region(332, F - 128, 342, F - 124, (x, y) => q.tone(x, y, RM.STEEL, 0.5));
            q.line(337, F - 124, 337, F - 116, (x, y) => q.tone(x, y, RM.STEEL, 0.6)); q.line(337, F - 116, 332, F - 112, (x, y) => q.tone(x, y, RM.STEEL, 0.6));
            for (const sx of [180, 214, 512]) { const len = 40 + (sx % 3) * 8; for (let y = 34; y < 34 + len; y++) q.tone(sx + (y > 60 ? 1 : 0), y, RM.AMBER, 0.24 + (y % 7 === 0 ? 0.08 : 0)); q.region(sx - 1, 34 + len, sx + 3, 37 + len, (x, y) => q.tone(x, y, RM.STEEL, 0.5)); }
            desk(q, 222, 258); o.surf(224, 256, F - DESK - 2);
            o.lights.push(monitor(q, 232, F - DESK, 8, 10));
            shelf(q, 222, 300, 122, [['box', 226, 8], ['box', 242, 11], ['jar', 266, 9, 3], ['box', 282, 7]], o);
            jacket(q, 200, 50, RM.FABRIC, 0.36);                             // Vance's jacket on its hook
            crate(q, 330, F - SEAT, 366, F, 10, o);
            placard(q, 300, F - 158, 18, 12, RM.AMBER);
        },
        engineering(q, o) {                                                  // the reactor, the control desk, the tool wall, the pipes
            overhead(q, 4, { tray: false });
            porthole(q, 460, F - 160);
            dress(q, 4, { vents: [250] }, o);
            for (const hy of [40, 48]) q.region(404, hy, AIR, hy + 4, (x, y) => q.tone(x, y, RM.STEEL, [0.18, 0.4, 0.3, 0.14][y - hy]));
            for (const vx of [496, 518]) {
                q.region(vx, 22, vx + 5, F, (x, y) => q.tone(x, y, RM.STEEL, [0.16, 0.3, 0.44, 0.3, 0.14][x - vx]));
                q.ellipse(vx + 2.5, F - 118, 6, 6, (x, y, k) => q.tone(x, y, RM.STEEL, k > 0.55 ? 0.5 : k > 0.3 ? 0.12 : 0.62));
            }
            reactor(q, o);
            desk(q, 140, 194, { vent: true }); o.surf(142, 192, F - DESK - 2);
            o.lights.push(monitor(q, 150, F - DESK, 12, 18), monitor(q, 170, F - DESK, 10, 12));
            mug(q, 184, F - DESK - 3);
            q.region(206, F - 164, 268, F - 104, (x, y) => q.tone(x, y, RM.STEEL, 0.2 + (((x - 206) % 4 === 2 && (y - F) % 4 === 0) ? -0.12 : 0) + (x === 267 ? 0.1 : 0)));   // the tool wall
            [[212, 20], [220, 26], [228, 18], [240, 24], [250, 22], [258, 16]].forEach(([tx, len], k) => {
                const y0 = F - 158;
                q.region(tx, y0, tx + 2, y0 + len, (x, y) => q.tone(x, y, RM.STEEL, x === tx + 1 ? 0.7 : 0.46));
                q.region(tx - 1, y0, tx + 3, y0 + 3, (x, y) => { if (k % 2 && y === y0 + 1 && x === tx) return; q.tone(x, y, RM.STEEL, 0.6); });
            });
            q.region(214, F - 126, 262, F - 114, (x, y) => q.tone(x, y, RM.CRATE, 0.3 + (y === F - 126 ? 0.2 : 0)));
            box(q, 270, F - 12, 296, F, RM.RED, 0.34, { tex: 0.03 }); o.surf(271, 295, F - 13);
            q.region(300, F - 4, 420, F, (x, y) => q.tone(x, y, ((x - y) >> 2) % 2 ? RM.AMBER : RM.STEEL, ((x - y) >> 2) % 2 ? 0.36 : 0.12));
            jacket(q, 284, 52, RM.WOOL, 0.42);                               // Jaxon's jacket and his notes
            clipboard(q, 298, 80);
        },
        upgrades(q, o) {                                                     // the med bay: the terminal, glass cabinets, the bed under its lamp, a drip stand
            overhead(q, 5);
            porthole(q, 170, F - 162);
            dress(q, 5, { vents: [300] }, o);
            desk(q, 196, 240); o.surf(198, 238, F - DESK - 2);
            o.lights.push(monitor(q, 206, F - DESK, 14, 18));
            box(q, 194, 58, 244, 88, RM.MED, 0.3, { panel: 2, tex: 0.03 });
            box(q, 252, F - 166, 400, F - 106, RM.MED, 0.32, { panel: 2, tex: 0.03 });
            for (const dx of [252, 289, 326, 363]) {
                q.region(dx + 4, F - 160, dx + 33, F - 112, (x, y) => q.tone(x, y, RM.WALL, 0.12));
                q.region(dx + 4, F - 138, dx + 33, F - 136, (x, y) => q.tone(x, y, RM.MED, y === F - 138 ? 0.5 : 0.3));
                for (let k = 0; k < 4; k++) { const bx = dx + 6 + k * 7, bh = 5 + (hash(dx, k, 2) * 6 | 0); q.region(bx, F - 138 - bh, bx + 5, F - 138, (x, y) => q.tone(x, y, k % 2 ? RM.MED : RM.LINEN, 0.42 + (x === bx + 4 ? 0.12 : 0))); }
                for (let k = 0; k < 3; k++) { const bx = dx + 7 + k * 9; q.region(bx, F - 120, bx + 6, F - 112, (x, y) => q.tone(x, y, RM.GLASS, x === bx + 4 ? 0.7 : 0.4)); }
            }
            q.region(322, F - 180, 329, F - 173, (x, y) => { if (Math.abs(x - 325) <= 1 || Math.abs(y - F + 177) <= 1) q.tone(x, y, RM.TEAL, 0.55); });   // the medical cross
            const bt = F - 40;                                               // the bed, the head end raised, the lamp on its arm
            q.region(412, bt + 5, 522, bt + 9, (x, y) => q.tone(x, y, RM.MED, [0.5, 0.36, 0.26, 0.16][y - bt - 5]));
            q.region(462, bt + 9, 474, F - 4, (x, y) => q.tone(x, y, RM.MED, x === 473 ? 0.42 : 0.22));
            q.region(438, F - 4, 498, F, (x, y) => q.tone(x, y, RM.MED, y === F - 4 ? 0.46 : 0.2));
            q.region(412, bt, 522, bt + 5, (x, y) => { const lift = x > 498 ? Math.round((x - 498) / 6) : 0; if (y < bt - lift) return; q.tone(x, y, RM.LINEN, y === bt ? 0.74 : 0.56 - (y - bt) * 0.06); });
            for (let x = 498; x < 522; x++) for (let y = bt - Math.round((x - 498) / 6); y < bt; y++) q.tone(x, y, RM.LINEN, 0.7);
            q.region(502, bt - 9, 520, bt - 4, (x, y) => q.tone(x, y, RM.LINEN, 0.8 - (y - bt + 9) * 0.05));
            q.region(416, F - 46, 440, F - 40, (x, y) => q.tone(x, y, RM.WOOL, y === F - 46 ? 0.7 : (y - F + 46) % 2 ? 0.44 : 0.54));
            o.surf(414, 498, bt - 1);
            q.region(466, 22, 469, F - 132, (x, y) => q.tone(x, y, RM.MED, x === 468 ? 0.46 : 0.26));
            q.line(468, F - 132, 466, F - 106, (x, y) => { q.tone(x, y, RM.MED, 0.42); q.tone(x, y + 1, RM.MED, 0.2); });
            q.region(452, F - 106, 480, F - 100, (x, y) => q.tone(x, y, RM.MED, y === F - 106 ? 0.64 : 0.36));
            q.region(526, F - 134, 528, F - 2, (x, y) => q.tone(x, y, RM.STEEL, x === 527 ? 0.5 : 0.3));   // the drip stand
            q.region(519, F - 2, 536, F, (x, y) => q.tone(x, y, RM.STEEL, 0.36));
            q.region(520, F - 134, 534, F - 132, (x, y) => q.tone(x, y, RM.STEEL, 0.46));
            q.region(528, F - 130, 535, F - 116, (x, y) => q.tone(x, y, RM.ICE, x === 533 ? 0.6 : 0.36));
            q.region(402, F - 74, 414, F, (x, y) => { const lean = Math.floor((F - y) / 18); if (x < 402 + lean || x > 412 + lean) return; q.tone(x, y, RM.FABRIC, 0.26 + (x === 412 + lean ? 0.14 : 0)); });   // the stretcher, folded
            for (const ox of [254, 262]) { q.region(ox, F - 48, ox + 6, F, (x, y) => q.tone(x, y, RM.TEAL, x === ox + 4 ? 0.62 : x === ox ? 0.2 : 0.38)); q.region(ox + 1, F - 52, ox + 5, F - 48, (x, y) => q.tone(x, y, RM.STEEL, 0.5)); }
            clipboard(q, 400, 98);
        },
    };
    function reactorCollar(q, y0, y1, below) {
        q.region(RX.dc - 42, y0, RX.dc + 42, y1, (x, y) => {
            const u = (x + 0.5 - RX.dc) / 42;
            let v = 0.2 + 0.36 * clamp01(u * 0.7 + 0.45) - (Math.abs(u) > 0.92 ? 0.08 : 0);
            if (y === y0) v += below ? 0.3 : 0.16; else if (y === y1 - 1) v -= below ? 0.06 : 0.12;
            if (y === y0 + 3 && (x - RX.dc + 42) % 8 === 4) v += 0.22;   // bolts
            q.tone(x, y, RM.STEEL, v);
        });
    }
    /** Engineering's reactor (ShipReactor.js, simplified): a glass chamber in a steel cage on its pedestal. The heart in the
        glass is drawn live and breathes ice-blue. */
    function reactor(q, o) {
        const { dc, x0, x1, y0, y1 } = RX;
        q.region(dc - 9, 22, dc + 9, y0 - 8, (x, y) => q.tone(x, y, RM.STEEL, 0.18 + 0.3 * clamp01((x - dc + 9) / 18) + ((y - 22) % 10 === 0 ? 0.1 : 0)));
        reactorCollar(q, y0 - 8, y0, false); reactorCollar(q, y1, y1 + 8, true);
        q.region(x0, y0, x1, y1, (x, y) => { const u = (x + 0.5 - dc) / 24; q.tone(x, y, RM.ICE, 0.14 + 0.16 * clamp01(u * 0.6 + 0.5) + (Math.abs(u) > 0.9 ? 0.1 : 0) + ((y - y0) % 12 === 0 ? 0.04 : 0)); });
        [dc - 14, dc - 13, dc + 13, dc + 14].forEach((sx, i) => q.region(sx, y0, sx + 1, y1, (x, y) => q.tone(x, y, RM.STEEL, i % 2 ? 0.3 : 0.52)));
        box(q, dc - 34, y1 + 8, dc + 34, F, RM.STEEL, 0.24, { panel: 3 });
        for (const vy of [y1 + 22, y1 + 28, y1 + 34]) q.region(dc - 22, vy, dc + 22, vy + 2, (x, y) => q.tone(x, y, RM.STEEL, 0.08));
        [dc - 18, dc - 12, dc - 6].forEach((lx, k) => o.fx.push(led(lx, y1 + 15 + q.oy, k ? '#5ff2cf' : '#c4803a', 1300 + k * 400)));
        o.lights.push(lamp(dc, (y0 + y1) / 2 + q.oy, { reach: 34, k: 0.75, tint: ICE_T, up: 1 }));
        o.reactor = { x: dc, y: Math.round((y0 + y1) / 2) + q.oy, x0: x0 + 1, x1: x1 - 1, y0: y0 + q.oy, y1: y1 + q.oy };
    }
    /** One deck's furniture, its stencilled name, its lamps: { lights, fx, surfaces (in units), reactor }. */
    function furnish(p, d) {
        const q = local(p, aIn(d)), o = { lights: [], fx: [], surfaces: [], reactor: null };
        o.surf = (x0, x1, y) => o.surfaces.push({ x0: x0 / ART_D, x1: x1 / ART_D, y: Math.round((q.oy + y) / ART_D) });
        q.as(FURN);
        ROOMS[KEYS[d]](q, o);
        q.as(WALL);
        stencil(q, STENCIL[KEYS[d]], ALX + 22, F - 108, d);
        q.as(FURN);
        ALAMPS.forEach(lx => lampCage(q, lx));
        return o;
    }

    // ── the column: painted once a page (the picture never changes with the game), lit twice: with air and without ──
    let COLUMN = null;
    /** Where the lamps' light falls, per unit (the old recipe): it decides how bright a mote of dust is. */
    function unitLight() {
        const light = new Float32Array(CW * COL_H);
        for (let d = 0; d < NDECK; d++) {
            const top = inTop(d);
            for (let ly = 2; ly <= IH + 1; ly++) for (let x = HULL_IN; x < CW - HULL_IN; x++) {
                let l = 0;
                for (const lx of LAMPS) {
                    const dx = Math.abs(x - lx), dy = Math.min(ly, IH) - 3, beam = Math.max(0, 1 - dx / (10 + dy * 0.42)) * Math.max(0, 1 - dy / 210);
                    const glowAt = Math.max(0, 1 - Math.hypot(dx / 70, dy / 90)), pool = ly >= IH - 1 ? 0.5 * Math.pow(Math.max(0, 1 - dx / 44), 1.4) : 0;
                    l += Math.pow(beam, 0.8) * 0.62 + glowAt * glowAt * 0.5 + pool;
                }
                light[(top + ly) * CW + x] = Math.min(1, l);
            }
        }
        return light;
    }
    /** What every unit of the column is, sampled from the art pixels (the hole goes only on bare wall). */
    function unitMat(kind) {
        const mat = new Uint8Array(CW * COL_H);
        for (let y = 0; y < COL_H; y++) {
            const Y = Math.min(AH - 1, Math.floor((y + 0.5) * ART_D));
            for (let x = 0; x < CW; x++) mat[y * CW + x] = kind[Y * AW + Math.min(AW - 1, Math.floor((x + 0.5) * ART_D))];
        }
        return mat;
    }
    function toCanvas(data) {
        const cv = document.createElement('canvas');
        cv.width = AW; cv.height = AH;
        cv.getContext('2d').putImageData(new ImageData(data, AW, AH), 0, 0);
        return cv;
    }
    function paintColumn() {
        if (COLUMN) return COLUMN;
        const p = painter();
        nose(p);
        for (let d = 0; d < NDECK; d++) shell(p, d);
        tail(p);
        const decks = KEYS.map((_, d) => furnish(p, d));
        ladder(p);
        const lit = new Uint8ClampedArray(p.data), vac = new Uint8ClampedArray(p.data);
        decks.forEach((dk, d) => {
            const y0 = aIn(d), y1 = aFloor(d) + 3, hang = y0 + LAMP_Y + 2;
            const pools = ALAMPS.map(x => lamp(x, aFloor(d) - 2, { reach: 18, k: 0.5, up: 0.5 }));
            lightPass(lit, p.kind, y0, y1, dk.lights.concat(pools, ALAMPS.map(x => lamp(x, hang, { reach: 40, k: 0.85 }))), ALAMPS.map(x => ({ x, y: hang })), null);
            lightPass(vac, p.kind, y0, y1, dk.lights.concat(pools, ALAMPS.map(x => lamp(x, hang, { reach: 9, k: 0.9 }))), null, VAC_DIM);
        });
        COLUMN = { lit: toCanvas(lit), vac: toCanvas(vac), light: unitLight(), mat: unitMat(p.kind), surfaces: decks.map(dk => dk.surfaces), fx: decks.map(dk => dk.fx),
            reactor: decks[KEYS.indexOf('engineering')].reactor };
        return COLUMN;
    }

    function mount(ctx, ui, opts) {
        const roster = readRoster(opts), patcher = PATCHERS.find(id => roster[id]) || null, sector = SECTOR_WORDS[(opts && opts.sector) - 1] || 'one';
        const col = paintColumn(), view = document.createElement('canvas'), mask = document.createElement('canvas');
        view.width = mask.width = A(VW); view.height = mask.height = A(VH);          // the deck view is drawn here first, in art pixels
        const vx = view.getContext('2d'), mx = mask.getContext('2d'), L = S.layout(MAP.x, MAP.y, MAP.w, MAP.h), R = L.rooms;
        let g = null, crew = [], things = [], talk = [], talkWait = 0, hover = -1, hoverChip = false, holdBtn = false, holdPtr = false, btnKey = '';

        const crewById = id => crew.find(f => f.id === id);
        const setCrew = (id, patch) => { crew = crew.map(f => (f.id === id ? { ...f, ...patch } : f)); };
        const around = i => [i - 1, i].filter(h => h >= 0 && h < NDECK - 1);   // the hatches that close off deck i
        const isSealed = i => around(i).every(h => g.shut[h]);
        const shipAir = () => g.p.reduce((a, b) => a + b, 0) / NDECK;
        const pct = v => (v > GONE && v < 0.01 ? 1 : Math.round(v * 100));    // never "0%" while there is still air to save
        const flag = k => { const was = g.said[k]; g = { ...g, said: { ...g.said, [k]: true } }; return !was; };   // true the first time only
        const leakRate = () => K_LEAK * (1 - 0.9 * g.patch);
        const left = () => (2 * (Math.sqrt(Math.max(0, g.p[g.leak])) - Math.sqrt(GONE))) / leakRate();   // seconds to zero, sealed
        const secs = () => Math.max(5, Math.round(left() / 5) * 5);
        const onLadder = f => Math.abs(f.x - LADDER) < 1 && Math.abs(f.y - floorY(deckAt(f.y))) > 1;
        const live = fn => () => (g.phase === 'leak' ? fn() : '');
        const airLost = () => Math.round((1 - shipAir()) * 100);
        const nameOf = id => S.CREW[id].name;
        const patcherAtHole = () => !!patcher && crewById(patcher).state === 'atHole';
        const patcherSays = (line, urgent, tag) => { if (patcher) say(nameOf(patcher), line, urgent, tag); };

        // ── one line at a time; a reaction jumps the queue; a line may be a function, read when it is shown ──
        function say(who, line, urgent = false, tag = '') {
            const kept = tag ? talk.filter(q => q.tag !== tag) : talk, at = urgent ? kept.findIndex(q => !q.urgent) : -1, item = { who, line, urgent, tag };
            talk = at < 0 ? kept.concat(item) : kept.slice(0, at).concat(item, kept.slice(at));
            if (urgent) talkWait = Math.min(talkWait, 0.7);
        }
        function pumpTalk(dt) {
            for (talkWait -= dt; talkWait <= 0 && talk.length;) {
                const q = talk[0], text = q.fn ? '' : typeof q.line === 'function' ? q.line() : q.line;
                talk = talk.slice(1);
                if (q.fn) q.fn(); else if (text) { ui.say(q.who, text); talkWait = clamp(0.9 + text.split(' ').length * 0.18, 2, 3.4); }
            }
        }

        // ── the hole goes on bare wall within the patcher's reach, clear of the ladder, the portholes and anyone standing there ──
        function placeHole(d, rnd) {
            const fy = floorY(d), people = Object.values(HOME).filter(([hd]) => hd === d).map(([, x]) => x);
            const bareWall = (x, y) => { for (let oy = -6; oy <= 6; oy++) for (let ox = -6; ox <= 6; ox++) if (col.mat[(y + oy) * CW + x + ox] !== WALL) return false; return true; };
            for (let tries = 0; tries < 600; tries++) { const x = Math.round(110 + rnd() * 240), y = Math.round(fy - 30 - rnd() * 22); if (bareWall(x, y) && people.every(px => Math.abs(px - x) > 40)) return { x, y }; }
            return { x: 210, y: fy - 44 };
        }
        function makeThings(rnd) {
            return KEYS.flatMap((_, d) => {
                const spots = col.surfaces[d].concat({ x0: 84, x1: CW - HULL_IN - 6, y: floorY(d) }), at = () => spots[Math.floor(rnd() * spots.length)];
                const dust = Array.from({ length: MOTES }, () => ({ k: 'dust', d, x: HULL_IN + 4 + rnd() * (CW - 2 * HULL_IN - 8), y: inTop(d) + 6 + rnd() * (IH - 12), vx: 0, vy: 0, a: rnd() * 6.28 }));
                return dust.concat(Array.from({ length: PAPERS[d] }, () => { const s = at(); return { k: 'paper', d, x: s.x0 + 3 + rnd() * (s.x1 - s.x0 - 8), y: s.y, vx: 0, vy: 0, rest: true, spin: rnd() * 4 }; }));
            });
        }
        /** The person in the holed deck, if any, and what they say. The patcher, in their own deck, only calls out where it is. */
        function residentOf(key) {
            const deck = DECK[key];
            if (!deck || !roster[deck.who]) return null;
            return deck.who === patcher ? { who: deck.who, call: CALL } : { ...deck, get: patcher ? deck.get(nameOf(patcher)) : '' };
        }
        function start() {
            const rnd = MiniLab.rng((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0), key = pickDeck(roster, rnd), leak = KEYS.indexOf(key), five = [0, 0, 0, 0, 0];
            g = {
                phase: 'calm', t: 0, tHit: 0, tCall: 0, key, leak, resident: residentOf(key), result: null, hole: placeHole(leak, rnd), p: KEYS.map(() => 1), flow: five, out: 0, vented: 0, melt: 1, shut: five.map(() => false), cycling: five,
                view: 0, cam: camFor(0), pan: null, patch: 0, looked: 0, marked: false, misses: 0, rings: [], flash: 0, shake: 0, dip: 0, said: {}, damaged: {}, ended: false, autoAt: AUTO,
                frost: Array.from({ length: 14 }, (_, i) => ({ a: (i / 14) * 6.283 + rnd() * 0.4, l: 0.55 + rnd() * 0.5, tw: 0.3 + rnd() * 0.35 })),
            };
            crew = Object.keys(roster).map(id => {
                const [d, x] = HOME[id];
                return { id, x, y: floorY(d), path: [], wait: 0, state: 'idle', stepT: 0, moving: false, hurt: false, injured: roster[id].injured, masked: false, facing: id === 'aris' ? -1 : 1, color: S.CREW[id].color, name: nameOf(id) };
            });
            things = makeThings(rnd);
            ui.say('', `Sector ${sector}. A quiet shift.`);
        }
        function hit() {
            g = { ...g, phase: 'leak', tHit: g.t, flash: 1, shake: 0.8, dip: 1 };
            sound.thud();
            ui.say('A.U.R.A.', "Impact, Commander. The ship is losing air. I can't tell from which deck.");
            talkWait = 3.4;
            if (!patcher) return;
            patcherSays(live(() => (g.marked || g.view === g.leak ? '' : 'Look in each deck. The dust will drift toward the hole.')));
            setCrew(patcher, { path: [{ x: LADDER + 16, y: crewById(patcher).y }] });   // they wait at the foot of the ladder, ready to climb
        }

        // ── the air, and what people say about it ──
        function stepAir(dt) {
            const p = g.p.slice(), out = g.phase === 'leak' ? Math.min(p[g.leak], leakRate() * Math.sqrt(Math.max(0, p[g.leak])) * dt) : 0;
            p[g.leak] -= out;
            const flow = g.shut.map((s, h) => (s ? 0 : G_HATCH * (p[h] - p[h + 1])));    // > 0: air goes down through hatch h
            flow.forEach((q, h) => { p[h] -= q * dt; p[h + 1] += q * dt; });
            g = { ...g, p: g.phase === 'won' ? p.map(v => Math.min(1, v + REFILL * dt)) : p, flow, out: dt > 0 ? out / dt : 0, vented: g.vented + out };
        }
        function events() {
            const since = g.t - g.tHit, deck = g.resident, who = deck && crewById(deck.who), seen = g.view === g.leak && !g.pan;
            if (since > 2 && flag('masks')) crew = crew.map(f => (f.id !== 'you' && deckAt(f.y) === g.leak ? { ...f, masked: true } : f));
            if (deck && ((seen && since > 1.5) || since > CALL_BY) && flag('call')) {     // they speak when you look in, or call up anyway
                g = { ...g, tCall: g.t };
                say(who.name, live(() => (deck.call ? (g.marked ? '' : deck.call) : [isSealed(g.leak) ? '' : deck.close, deck.mask, g.marked ? '' : deck.get].filter(Boolean).join(' '))), true);   // read when shown
            }
            if (deck && deck.go && g.said.call && g.t - g.tCall > LEAVE_AFTER && who.state === 'idle' && !who.hurt && flag('leave')) {
                if (isSealed(g.leak)) setCrew(who.id, { state: 'staying' }); else { leave(who.id); say(who.name, deck.go, true); }
            }
            if (!isSealed(g.leak) && shipAir() < g.autoAt) {                    // nobody chose, so A.U.R.A. does, whoever is inside
                g = { ...g, autoAt: g.autoAt - 0.1, shut: g.shut.map(() => true) };
                sound.clunk(); sound.chime([784, 587]);
                say('A.U.R.A.', `Ship air at ${pct(shipAir())} percent. I'm closing every hatch, Commander.`, true);
                if (flag('cut')) say('A.U.R.A.', live(() => (isSealed(g.leak) && g.patch <= 0 ? `${cap(THE[g.key])} ${IS(g.key)} still losing air. About ${secs()} seconds to zero.` : '')), true, 'cut');
            }
            if (isSealed(g.leak) && left() < 12 && g.patch <= 0 && flag('low')) say('A.U.R.A.', live(() => (g.patch <= 0 ? `About ${secs()} seconds of air left in ${THE[g.key]}, Commander.` : '')), true);
            const inside = crew.find(f => f.id !== 'you' && f.id !== patcher && deckAt(f.y) === g.leak && !f.hurt);
            if (inside && isSealed(g.leak) && left() < 7 && g.patch < 0.5 && flag('ears')) say(inside.name, 'My ears hurt. Please hurry.', true);
            if (!g.marked && since > 32 && flag('nudge')) patcherSays(live(() => (g.marked ? '' : "Show me where the dust is going and I'll go.")));
        }

        // ── people: walk to the ladder, climb, cycle a shut hatch (the patcher) or be stopped by it (anyone else) ──
        function route(f, tx, b) {
            const a = deckAt(f.y), path = [], atLadder = Math.abs(f.x - LADDER) < 1;
            if (a !== b && !atLadder) path.push({ x: LADDER, y: f.y });
            if (a === b && atLadder && Math.abs(f.y - floorY(a)) > 1) path.push({ x: LADDER, y: floorY(a) });
            for (let i = a; i !== b; i += Math.sign(b - a)) {
                if (b < i) path.push({ x: LADDER, y: inTop(i) + 50, hatch: i - 1 }, { x: LADDER, y: floorY(i - 1) });
                else path.push({ x: LADDER, y: floorY(i), hatch: i }, { x: LADDER, y: floorY(i + 1) });
            }
            return path.concat({ x: tx, y: floorY(b) });
        }
        const leave = id => setCrew(id, { state: 'leaving', path: route(crewById(id), LADDER + 26 + (id === 'vance' ? 10 : 0), g.leak > 0 ? g.leak - 1 : 1) });
        function stepFigure(f, dt, ev) {
            if (f.hurt || !f.path.length) return f.moving ? { ...f, moving: false } : f;
            if (f.wait > 0) return { ...f, wait: f.wait - dt, moving: false };
            const wp = f.path[0], dx = wp.x - f.x, dy = wp.y - f.y, d = Math.hypot(dx, dy), step = (Math.abs(dx) < 0.01 ? CLIMB : WALK) * (f.injured ? INJURED_PACE : 1) * dt, facing = Math.abs(dx) > 0.5 ? Math.sign(dx) : f.facing;
            if (d > step) return { ...f, x: f.x + (dx / d) * step, y: f.y + (dy / d) * step, stepT: f.stepT + dt, moving: true, facing };
            const rest = f.path.slice(1);
            if (wp.hatch != null || !rest.length) ev.push(wp.hatch != null ? { id: f.id, hatch: wp.hatch } : { id: f.id, arrived: true });
            return { ...f, x: wp.x, y: wp.y, path: rest, moving: rest.length > 0, facing };
        }
        function stepCrew(dt) {
            const ev = [];
            crew = crew.map(f => stepFigure(f, dt, ev));
            ev.forEach(e => {
                const f = crewById(e.id), d = deckAt(f.y);
                if (e.arrived) {
                    if (f.state === 'leaving') setCrew(f.id, { state: 'out' });
                    if (f.state !== 'going' || g.phase !== 'leak') return;
                    setCrew(f.id, { state: 'atHole', facing: Math.sign(g.hole.x - f.x) || 1 });
                    return patcherSays("Plate's on. It needs pressure until the seal sets.", true, 'patcher');
                }
                if (!g.shut[e.hatch] || g.phase !== 'leak') return;
                if (f.id === patcher) {                                          // they go through, and it closes behind them
                    setCrew(f.id, { wait: CYCLE });
                    g = { ...g, cycling: g.cycling.map((c, h) => (h === e.hatch ? CYCLE : c)) };
                    return sound.clunk();
                }
                setCrew(f.id, { state: 'trapped', path: [{ x: LADDER, y: floorY(d) }, { x: LADDER + 22, y: floorY(d) }] });
                if (flag('trapped')) say(f.name, "The hatch is shut. I'll wait by the ladder.", true);
            });
        }

        // ── finding the hole, sealing a deck, looking ──
        function found() {
            const j = patcher && crewById(patcher), side = g.hole.x < 130 ? 1 : -1;
            g = { ...g, marked: true, rings: g.rings.concat({ x: g.hole.x, y: g.hole.y, t0: g.t, hit: true }) };
            sound.chime([660]);
            if (!j || j.hurt) return;
            patcherSays(deckAt(j.y) === g.leak ? 'I see it.' : 'I see it. On my way.', true, 'patcher');
            setCrew(j.id, { state: 'going', path: route(j, g.hole.x + side * 13, g.leak) });
        }
        function markAt(p) {
            if (g.phase !== 'leak' || g.marked) return;
            const x = p.x - VX, y = p.y - VY + g.cam, d = g.view;
            if (y < inTop(d) || y > floorY(d) || x < HULL_IN || x > CW - HULL_IN) return;
            if (d === g.leak && Math.hypot(x - g.hole.x, y - g.hole.y) <= HIT_R) return found();
            g = { ...g, rings: g.rings.concat({ x, y, t0: g.t, hit: false }), misses: g.misses + 1 };
            const line = ['Not there. Watch where the paper goes.', 'Not there either. Follow the dust.'][g.misses - 1];
            if (line) patcherSays(line, true, 'patcher');
        }
        function toggleSeal(d) {
            if (!g || g.phase !== 'leak') return;
            const close = !isSealed(d), hs = around(d);
            g = { ...g, shut: g.shut.map((s, h) => (hs.includes(h) ? close : s)) };
            sound.clunk();
            if (close && d === g.leak && g.patch <= 0 && flag('cut')) say('A.U.R.A.', live(() => (isSealed(g.leak) ? `${cap(THE[g.key])} ${IS(g.key)} sealed, Commander. It reaches zero in about ${secs()} seconds.` : '')), true, 'cut');
            if (!close) crew.filter(f => (f.state === 'trapped' || f.state === 'staying') && deckAt(f.y) === g.leak).forEach(f => leave(f.id));
        }
        function selectDeck(i) {
            if (!g || i < 0 || i >= NDECK || (i === g.view && !g.pan)) return;
            g = { ...g, pan: { from: g.cam, to: camFor(i), t: 0, dur: 0.26 + 0.07 * Math.abs(i - g.view) }, view: i, looked: g.looked + 1 };
        }

        // ── endings ──
        function finale() {
            say('', `It was a speck of rock. Sector ${sector} is full of them.`);
            talk = talk.concat({ fn: () => { g = { ...g, ended: true }; } });
        }
        function sealed() {
            const stayed = isSealed(g.leak) && crew.find(f => f.id !== patcher && f.id !== 'you' && deckAt(f.y) === g.leak && !onLadder(f));   // shut in, and all right
            g = { ...g, phase: 'won', patch: 1, rings: [], result: { damagedDeck: null, hurt: [], airLostPercent: airLost() } };
            setCrew(patcher, { state: 'done' });
            things = things.map(o => (o.stuck ? { ...o, stuck: false, rest: false, vx: (Math.random() - 0.5) * 8, vy: 0 } : o));   // the papers on the hole fall away
            sound.chime([523, 659, 784]);
            talk = [];
            patcherSays("Sealed. That'll hold until I can weld it.");
            if (stayed) say(stayed.name, "The mask held. I'm fine.");
            say('A.U.R.A.', () => `Ship air is at ${pct(shipAir())} percent. All four crew are safe, Commander.`);   // read when shown: the air is refilling
            finale();
        }
        /** Who says that the crew in the lost deck are hurt, and what: the written line when its speaker can say it. */
        function hurtLine(ids) {
            const canSpeak = id => !!roster[id] && !ids.includes(id), written = HURT[ids.join(',')], carer = CARERS.find(canSpeak);
            if (written && canSpeak(written[0])) return [nameOf(written[0]), written[1]];
            if (!carer || !ids.length) return null;
            return [nameOf(carer), ids.length === 1 ? `${IS_HURT[ids[0]]} I'm going to ${HER[ids[0]]}.` : `${ids.map(nameOf).join(' and ')} are both hurt. I'm going to them.`];
        }
        function lose() {
            const ids = crew.filter(f => f.id !== 'you' && deckAt(f.y) === g.leak && !onLadder(f)).map(f => f.id).sort(), line = hurtLine(ids);
            g = { ...g, phase: 'lost', damaged: { [g.key]: true }, rings: [], out: 0, flow: [0, 0, 0, 0, 0], p: g.p.map((v, i) => (i === g.leak ? 0 : v)) };
            g = { ...g, result: { damagedDeck: g.key, hurt: ids, airLostPercent: airLost() } };
            crew = crew.map(f => (ids.includes(f.id) ? { ...f, hurt: true, moving: false, path: [], y: floorY(g.leak) } : f));
            things = things.map(o => (o.d === g.leak && o.k === 'paper' && !o.stuck ? { ...o, gone: true } : o));
            sound.chime([523, 392]);
            talk = [];
            say('A.U.R.A.', `${cap(THE[g.key])} ${IS(g.key)} at zero, Commander.`);
            if (line) say(...line); else if (!ids.length) patcherSays("We lost that deck. I'll patch it from outside later.");
            say('A.U.R.A.', ids.length ? `All four crew are alive, Commander. ${ids.length > 1 ? 'Two are' : 'One is'} injured.` : 'All four crew are safe, Commander.');
            finale();
        }

        // ── loose things ride the air: to the hole, and to any open hatch the air leaves a deck by ──
        function sinks(d) {
            const list = d === g.leak && g.phase === 'leak' ? [{ x: g.hole.x, y: g.hole.y, s: g.out / K_LEAK, hole: true }] : [];
            around(d).forEach(h => {
                const q = (g.flow[h] || 0) * (h === d ? 1 : -1);                 // > 0: air leaves deck d through hatch h
                if (q > 1e-4) list.push({ x: LADDER, y: h === d ? floorY(d) - 1 : inTop(d) + 1, s: Math.min(0.7, (0.8 * q) / K_LEAK) });
            });
            return list;
        }
        function field(sk, x, y) {
            let fx = 0, fy = 0;
            for (const k of sk) { const dx = k.x - x, dy = k.y - y, dist = Math.hypot(dx, dy) || 1, m = PULL * k.s * (0.5 + 28 / (dist + 8)); fx += (dx / dist) * m; fy += (dy / dist) * m; }
            return [fx, fy];
        }
        const nearSink = (sk, x, y, r) => sk.find(k => Math.hypot(k.x - x, k.y - y) < r);
        function stepThings(dt) {
            const sk = KEYS.map((_, d) => sinks(d)), floor = { s0: 84, s1: CW - HULL_IN - 6 };
            let stuck = things.filter(o => o.stuck).length;
            things = things.map(o => {
                if (o.gone || o.stuck) return o;
                const [fx, fy] = field(sk[o.d], o.x, o.y), sp = Math.hypot(fx, fy), top = inTop(o.d) + 2, bottom = floorY(o.d) - 1;
                if (o.k === 'dust') {
                    const a = o.a + (Math.random() - 0.5) * 2 * dt, vx = fx + Math.cos(a) * 2.2, vy = fy + Math.sin(a) * 1.4, x = o.x + vx * dt, y = o.y + vy * dt;
                    if (nearSink(sk[o.d], x, y, 3)) return { ...o, x: HULL_IN + 4 + Math.random() * (CW - 2 * HULL_IN - 8), y: top + 4 + Math.random() * (IH - 12), vx: 0, vy: 0, a };
                    return { ...o, x: clamp(x, HULL_IN + 2, CW - HULL_IN - 2), y: clamp(y, top, bottom - 1), vx, vy, a };
                }
                if (o.rest) return sp < LIFT ? o : { ...o, rest: false, vx: fx * 0.3, vy: -6 };   // paper lifts when the draught is strong enough
                const k = Math.min(1, dt * 2.2), vx = o.vx + (fx * 1.3 - o.vx) * k, vy = o.vy + (fy * 1.3 - o.vy) * k + (sp < LIFT ? 30 : 6) * dt;
                const x = clamp(o.x + vx * dt, HULL_IN + 2, CW - HULL_IN - 4), y = o.y + vy * dt, at = nearSink(sk[o.d], x, y, 5);
                if (at && at.hole && stuck < 7) { stuck += 1; return { ...o, stuck: true, x: g.hole.x + Math.round((Math.random() - 0.5) * 8), y: g.hole.y + Math.round((Math.random() - 0.5) * 6) }; }
                if (at) return { ...o, gone: true };
                if (y >= bottom + 1) return sp < LIFT ? { ...o, ...floor, x, y: bottom + 1, rest: true } : { ...o, x, y: bottom + 1, vx, vy: -Math.abs(vy) * 0.3 };
                return { ...o, x, y: Math.max(top, y), vx, vy, spin: o.spin + dt * (2 + sp * 0.3) };
            });
        }

        // ── drawing: art-pixel helpers. The deck view is drawn in art pixels (units × ART_D), the camera row is camA() ──
        const patterns = new Map(), VWA = A(VW), VHA = A(VH), camA = () => Math.round(g.cam * ART_D);
        /** An 8 × 8 Bayer tile at `tone`, so a big dithered fill costs one fillRect. */
        function pattern(tone, colour) {
            const lv = Math.round(clamp(tone, 0, 1) * 64), key = lv + colour;
            if (!patterns.has(key)) {
                const c = document.createElement('canvas'), x = (c.width = c.height = 8, c.getContext('2d'));
                x.fillStyle = colour;
                for (let yy = 0; yy < 8; yy++) for (let xx = 0; xx < 8; xx++) if (lv / 64 > bay(xx, yy)) x.fillRect(xx, yy, 1, 1);
                patterns.set(key, vx.createPattern(c, 'repeat'));
            }
            return patterns.get(key);
        }
        const rect = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
        const dotA = (c, x, y, col) => rect(c, x, y, 1, 1, col);
        /** A line one art pixel wide, dithered by tone. */
        function lineA(c, x0, y0, x1, y1, col, tone = 1) {
            c.fillStyle = col;
            let ax = Math.round(x0), ay = Math.round(y0);
            const bx = Math.round(x1), by = Math.round(y1), dx = Math.abs(bx - ax), dy = -Math.abs(by - ay), sx = ax < bx ? 1 : -1, sy = ay < by ? 1 : -1;
            for (let err = dx + dy, guard = 0; guard < 2000; guard++) {
                if (tone >= 1 || tone > bay(ax, ay)) c.fillRect(ax, ay, 1, 1);
                if (ax === bx && ay === by) break;
                const e2 = 2 * err;
                if (e2 >= dy) { err += dy; ax += sx; }
                if (e2 <= dx) { err += dx; ay += sy; }
            }
        }
        /** A dithered disc: toneAt(d) for d 0..1 from the centre. */
        function glowA(c, cx, cy, r, toneAt, col) {
            c.fillStyle = col;
            for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
                const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r;
                if (d <= 1 && toneAt(d) > bay(x, y)) c.fillRect(x, y, 1, 1);
            }
        }
        function ringA(c, cx, cy, r, col, tone = 1) {
            c.fillStyle = col;
            const steps = Math.max(12, Math.ceil(r * 7));
            for (let i = 0; i < steps; i++) { const a = (i / steps) * Math.PI * 2, x = Math.round(cx + Math.cos(a) * r), y = Math.round(cy + Math.sin(a) * r); if (tone >= 1 || tone > bay(x, y)) c.fillRect(x, y, 1, 1); }
        }

        // ── drawing: a crew member, the crew-hires sprite (src/newscreen/crew), lit warm by the lamps while there is air ──
        function drawPerson(f, t) {
            const climb = onLadder(f), atHole = f.state === 'atHole' && g.phase === 'leak', d = deckAt(f.y);
            const action = f.hurt ? 'sleep' : climb ? 'climb' : atHole ? 'wall' : f.moving ? 'walk' : 'idle';
            const ax = A(f.x), near = ALAMPS.reduce((a, b) => (Math.abs(b - ax) < Math.abs(a - ax) ? b : a)), lit = airTone(d) > 0.35;
            const warm = lit ? (Math.abs(near - ax) < 60 ? 2 : 1) : 0, rim = lit ? (Math.sign(near - ax) || 1) : 0, ms = f.moving ? f.stepT * 1000 : t;
            let sp = null;
            vx.setTransform(ART_D, 0, 0, ART_D, 0, 0);
            try {
                sp = window.MiniCrew ? MiniCrew.person(vx, f.id, action, ms, f.x, f.y - g.cam + (f.hurt ? 3 / ART_D : 0), { facing: f.facing, warm, rim }) : null;   // the hurt lie on the deck plate
                if (!sp && window.MiniCrew) MiniCrew.small(vx, f.id, f.x, f.y - g.cam, { h: 62, suit: false, pose: f.hurt ? 'lie' : climb ? 'climb' : f.moving ? 'walk' : 'stand', t: ms, facing: f.facing, warm: warm / 3 });
            } finally { vx.setTransform(1, 0, 0, 1, 0, 0); }
            if (sp && sp.neck && f.masked && !f.hurt && !climb) drawMask(sp, f);
        }
        /** The oxygen mask over the face, its hose to the chest. */
        function drawMask(sp, f) {
            const fc = f.facing < 0 ? -1 : 1, nx = A(f.x) + fc * (sp.neck.x - sp.origin.x), ny = A(f.y) - camA() + (sp.neck.y - sp.origin.y);
            const mx0 = nx + fc * 2, my0 = ny - 9;
            lineA(vx, mx0 - fc * 5, my0 - 2, mx0, my0, RM.STEEL.hex[3]);
            rect(vx, Math.min(mx0, mx0 + fc * 4), my0 - 1, 5, 4, RM.MED.hex[5]);
            rect(vx, Math.min(mx0, mx0 + fc * 4), my0 + 2, 5, 1, RM.MED.hex[3]);
            dotA(vx, mx0 + fc * 4, my0, RM.MED.hex[7]);
            lineA(vx, mx0 + fc, my0 + 3, nx + fc, ny + 7, RM.TEAL.hex[2]);
        }

        // ── drawing: the deck view ──
        const airTone = d => clamp((g.p[d] - 0.08) / 0.8, 0, 1);
        function drawAir(dA, dB, cy) {                                       // the lamps' light shows only as far as there is air to catch it
            vx.drawImage(col.vac, 0, cy, VWA, VHA, 0, 0, VWA, VHA);
            for (let d = dA; d <= dB; d++) {
                const tone = airTone(d), y0 = Math.max(0, aIn(d) - cy), h = Math.min(VHA, aFloor(d) + 3 - cy) - y0;
                if (tone <= 0 || h <= 0) continue;
                if (tone >= 1) { vx.drawImage(col.lit, 0, cy + y0, VWA, h, 0, y0, VWA, h); continue; }
                mx.globalCompositeOperation = 'source-over'; mx.clearRect(0, y0, VWA, h); mx.drawImage(col.lit, 0, cy + y0, VWA, h, 0, y0, VWA, h);
                mx.globalCompositeOperation = 'destination-in'; mx.fillStyle = pattern(tone, '#fff'); mx.fillRect(0, y0, VWA, h);
                vx.drawImage(mask, 0, y0, VWA, h, 0, y0, VWA, h);
            }
        }
        function drawHatches(t, cy) {                                        // the lid shut over the well, its wheel up; or standing open beside it
            g.shut.forEach((isShut, h) => {
                const y0 = aFloor(h) - cy, cyc = g.cycling[h] > 0, x0 = ALX - 14, x1 = ALX + 14, closed = isShut && !cyc;
                if (y0 < -30 || y0 > VHA + 4) return;
                if (closed) {
                    [0.62, 0.42, 0.3, 0.16].forEach((v, k) => rect(vx, x0 - 1, y0 + k, x1 - x0 + 3, 1, shadeOf(RM.STEEL, v)));
                    rect(vx, ALX - 4, y0 - 3, 9, 1, shadeOf(RM.STEEL, 0.55)); dotA(vx, ALX + 4, y0 - 3, shadeOf(RM.STEEL, 0.7));
                    rect(vx, ALX - 1, y0 - 2, 3, 2, shadeOf(RM.STEEL, 0.4));
                } else [0.56, 0.36, 0.2].forEach((v, k) => { rect(vx, x1 + 3 + k, y0 - 26, 1, 26, shadeOf(RM.STEEL, v + (k === 0 ? 0.1 : 0))); dotA(vx, x1 + 4, y0 - 14, shadeOf(RM.STEEL, 0.75)); });
                rect(vx, x0 - 6, y0 + 7, 2, 3, closed ? RM.ICE.hex[5] : cyc && Math.floor(t / 150) % 2 ? RM.ICE.hex[6] : RM.ICE.hex[2]);   // its lamp: lit while shut
            });
        }
        function drawDeckLife(d, t, cy) {
            const top = aIn(d) - cy, alarm = g.phase === 'leak' && Math.floor(t / 520) % 2 === 0, ax = ALX + 30;
            rect(vx, ax - 3, top + 31, 7, 2, alarm ? RM.RED.hex[4] : RM.RED.hex[1]);   // the alarm lamp by the ladder, ship-wide
            if (alarm) glowA(vx, ax + 0.5, top + 32, 14, q => 0.32 * (1 - q), RM.RED.hex[3]);
            col.fx[d].forEach(f => dotA(vx, f.x, f.y - cy, (t + f.period * 0.37) % f.period < f.period * 0.55 ? f.color : f.dim));
            const rx = col.reactor;
            if (KEYS[d] !== 'engineering' || !rx) return;
            const beat = Math.pow(1 - ((t / 2800) % 1), 3), cyy = rx.y - cy, rw = 13 + beat * 4, rh = 30 + beat * 8;   // the reactor's heartbeat
            for (let y = rx.y0 - cy; y < rx.y1 - cy; y++) for (let x = rx.x0; x < rx.x1; x++) {
                if (x >= rx.x - 14 && x <= rx.x - 13 || x >= rx.x + 13 && x <= rx.x + 14) continue;   // the cage bars stay in front
                const dd = Math.hypot((x + 0.5 - rx.x) / rw, (y + 0.5 - cyy) / rh), v = (0.35 + 0.5 * beat) * (1 - dd * 0.75) + 0.12;
                if (dd < 1 && v > 0.2) dotA(vx, x, y, RM.ICE.hex[level(RM.ICE, v, x, y + cy)]);
            }
        }
        function drawBreach(cy) {
            const hx = A(g.hole.x), hy = A(g.hole.y) - cy, s = g.phase === 'leak' ? clamp(g.out / K_LEAK, 0, 1) : 0;
            const fr = (g.phase === 'lost' ? 34 : Math.min(32, 5 + g.vented * 46)) * g.melt * ART_D;
            if (s > 0.02) glowA(vx, hx, hy, (12 + 26 * s) * ART_D, q => Math.pow(1 - q, 2) * 0.45 * s, RM.ICE.hex[3]);   // breath-fog where the air rushes out
            if (fr > 3) {                                                       // frost: a cold halo, then crystals with side twigs
                glowA(vx, hx, hy, fr * 1.3, q => Math.pow(1 - q, 1.6) * 0.45, RM.ICE.hex[2]);
                g.frost.forEach(f => {
                    const len = fr * f.l, ca = Math.cos(f.a), sa = Math.sin(f.a) * 0.85;
                    lineA(vx, hx, hy, hx + ca * len, hy + sa * len, RM.ICE.hex[5], 0.8);
                    [0.45, 0.72].forEach((k, i) => { const bx = hx + ca * len * k, by = hy + sa * len * k, b = f.a + (i ? -0.75 : 0.75), bl = len * f.tw * (1 - k * 0.4); lineA(vx, bx, by, bx + Math.cos(b) * bl, by + Math.sin(b) * bl * 0.85, RM.ICE.hex[4], 0.7); });
                    dotA(vx, hx + ca * len, hy + sa * len, RM.ICE.hex[6]);
                });
                glowA(vx, hx, hy, Math.min(9, fr * 0.22), () => 0.7, RM.ICE.hex[6]);
            }
            if (g.patch > 0 || g.phase === 'won') {                             // the plate, and how far the seal has set
                rect(vx, hx - 8, hy - 8, 16, 16, RM.STEEL.hex[5]); rect(vx, hx - 8, hy - 8, 16, 1, RM.STEEL.hex[8]); rect(vx, hx - 8, hy - 8, 1, 16, RM.STEEL.hex[7]);
                rect(vx, hx - 8, hy + 7, 16, 1, RM.STEEL.hex[2]); rect(vx, hx + 7, hy - 7, 1, 15, RM.STEEL.hex[3]);
                [[-5, -5], [4, -5], [-5, 4], [4, 4]].forEach(([a, b]) => dotA(vx, hx + a, hy + b, RM.STEEL.hex[2]));
                if (g.phase === 'leak') for (let i = 0; i < 56; i++) { const a = -Math.PI / 2 + (i / 56) * 6.283; dotA(vx, hx + Math.cos(a) * 18, hy + Math.sin(a) * 18, i / 56 < g.patch ? RM.AMBER.hex[4] : RM.ICE.hex[2]); }
            } else { rect(vx, hx - 3, hy - 3, 6, 6, RM.STEEL.hex[6]); rect(vx, hx - 2, hy - 2, 4, 4, INK); dotA(vx, hx + 2, hy - 3, RM.STEEL.hex[8]); }   // the puncture
        }
        function drawRings(t, cy) {
            g.rings.forEach(r => {
                const age = g.t - r.t0, x = A(r.x), y = A(r.y) - cy;
                if (!r.hit) ringA(vx, x, y, (3 + age * 9) * ART_D, C.textDim, Math.max(0, 1 - age / 0.9));
                else if (!patcherAtHole()) ringA(vx, x, y, (15 + Math.sin(t / 180)) * ART_D, C.uiBright, 0.8);
            });
        }
        function drawThing(o, cy) {                                           // dust: one art pixel, a streak when it runs; paper: a small sheet
            const x = A(o.x), y = A(o.y) - cy, l = (col.light[(o.y | 0) * CW + (o.x | 0)] || 0) * airTone(o.d);
            if (o.k === 'dust') {
                const sp = Math.hypot(o.vx, o.vy);
                if (sp > 7) { const len = Math.min(9, sp * 0.35) * ART_D; lineA(vx, x - (o.vx / sp) * len, y - (o.vy / sp) * len, x, y, sp > 16 ? RM.STAR.hex[3] : RM.STAR.hex[2], 0.8); }
                return dotA(vx, x, y, sp > 16 ? RM.STAR.hex[4] : l > 0.5 ? RM.AMBER.hex[5] : l > 0.22 ? RM.AMBER.hex[4] : RM.STAR.hex[3]);
            }
            const face = l > 0.25 ? RM.PAPER.hex[6] : RM.PAPER.hex[4], edge = l > 0.25 ? RM.PAPER.hex[4] : RM.PAPER.hex[2];
            const [w, h] = [[6, 1], [4, 3], [2, 4], [4, 3]][Math.floor(o.spin) % 4], j = Math.random() < 0.5 ? 1 : 0;
            if (o.stuck) { rect(vx, x - 2 + j, y - 2, 4, 4, face); dotA(vx, x + 1 + j, y + 1, edge); }
            else if (o.rest) rect(vx, x - 3, y - 1, 6, 1, face);
            else { rect(vx, x - (w >> 1), y - (h >> 1), w, h, face); dotA(vx, x - (w >> 1), y + h - 1 - (h >> 1), edge); }
        }
        function drawView(t) {
            const cam = g.cam, cy = camA(), dA = deckAt(cam + 2), dB = deckAt(cam + VH);
            rect(vx, 0, 0, VWA, VHA, C.void);
            drawAir(dA, dB, cy);
            for (let d = dA; d <= dB; d++) drawDeckLife(d, t, cy);
            drawHatches(t, cy);
            if (g.leak >= dA && g.leak <= dB && g.phase !== 'calm') { drawBreach(cy); drawRings(t, cy); }
            crew.filter(f => f.y > cam && f.y - 70 < cam + VH).forEach(f => drawPerson(f, t));
            things.forEach(o => { if (!o.gone && o.d >= dA && o.d <= dB) drawThing(o, cy); });
            if (g.dip > 0) { vx.fillStyle = pattern(g.dip * 0.7, C.void); vx.fillRect(0, 0, VWA, VHA); }
            vx.fillStyle = pattern(0.6, C.void);                               // the decks above and below stay in shadow
            vx.fillRect(0, 0, VWA, A(CAM_IN - SLAB)); vx.fillRect(0, A(CAM_IN + IH + SLAB), VWA, VHA);
        }

        // ── drawing: the map (our Lander cut open: air per deck as a dark level, shut hatches as bright bars), the readouts ──
        const inner = 0.91 * L.D, mapL = L.cx - inner / 2, mapLadder = mapL + (1 + (1 + Math.max(2, Math.round(inner * ART_D * 0.07))) / 2) / ART_D;
        const mapX = x => (x <= LADDER ? mapL + 1 + ((x - HULL_IN) / (LADDER - HULL_IN)) * (mapLadder - mapL - 1) : mapLadder + ((x - LADDER) / (CW - HULL_IN - LADDER)) * (mapL + inner - 1 - mapLadder));
        const mapY = y => { const d = deckAt(y), r = R[d]; return r.top + ((y - cellTop(d)) / CELL) * (r.bottom - r.top) - 2.5; };
        function drawMap(t) {
            S.draw(ctx, L, t, { damaged: g.damaged, labels: false });
            MiniLab.inArt(ctx, (c, k) => {
                R.forEach((r, i) => {                                           // the air that is gone, from the ceiling down
                    const p = g.p[i], lvl = r.top + 1 + (1 - p) * (r.bottom - r.top - 2), tone = p < 0.4 ? 0.75 : 0.7;
                    if (p > 0.995) return;
                    c.fillStyle = p < 0.4 ? RM.RED.hex[1] : C.void;
                    for (let Y = Math.round((r.top + 1) * k); Y < Math.round(lvl * k); Y++) {
                        const hw = L.halfWidth((Y + 0.5) / k) - 2;
                        if (hw > 0) for (let X = Math.round((L.cx - hw) * k); X < Math.round((L.cx + hw) * k); X++) if (tone > bay(X, Y)) c.fillRect(X, Y, 1, 1);
                    }
                });
                const hxm = Math.round(mapX(LADDER) * k);
                g.shut.forEach((isShut, h) => {
                    const y = Math.round(R[h + 1].top * k);
                    if (!isShut || (g.cycling[h] > 0 && Math.floor(t / 150) % 2)) { dotA(c, hxm - 4, y, RM.ICE.hex[3]); dotA(c, hxm + 4, y, RM.ICE.hex[3]); } else rect(c, hxm - 5, y - 1, 11, 2, RM.ICE.hex[6]);
                });
                [[hover, C.uiDim], [g.view, C.uiBright]].forEach(([i, colr]) => {   // brackets either side of the deck you point at, and the one you see
                    if (i < 0) return;
                    const r = R[i], y0 = Math.round(r.top * k) + 1, y1 = Math.round(r.bottom * k) - 2;
                    [Math.round((L.cx - L.maxHalf) * k) - 7, Math.round((L.cx + L.maxHalf) * k) + 6].forEach((x, side) => { rect(c, x, y0, 1, y1 - y0, colr); rect(c, x - 3 * side, y0, 4, 1, colr); rect(c, x - 3 * side, y1 - 1, 4, 1, colr); });
                });
            });
            R.forEach((r, i) => note('deck-' + i, r.label, { x: Math.round(L.cx - L.halfWidth(r.top + 2) + 4.5), y: r.top + 1, tone: g.damaged[r.key] ? 'danger' : i === g.view ? 'text' : 'dim' }));   // the deck names in the frame's IBM Plex Mono, not the pixel font
            crew.forEach(f => S.figure(ctx, Math.round(mapX(f.x)), mapY(f.y), f.id, f.moving && Math.floor(f.stepT * 6) % 2 === 1, f.hurt));
        }
        function patcherStatus(j) {
            if (j.hurt || g.phase === 'won') return j.hurt ? 'HURT' : 'DONE';
            if (j.state === 'atHole') return g.patch > 0 ? 'PATCHING ' + Math.round(g.patch * 100) + '%' : 'AT THE HOLE';
            if (j.wait > 0) return 'OPENING A HATCH';
            if (j.state === 'going') return onLadder(j) ? 'CLIMBING' : 'TO THE HOLE';
            return Math.abs(j.x - LADDER - 16) < 1 && g.phase === 'leak' ? 'AT THE LADDER' : 'IN ' + NAME[KEYS[deckAt(j.y)]];
        }
        // the readouts are quiet words over the picture (ui.note), set only when they change
        const shown = new Map(), measure = document.createElement('canvas').getContext('2d');
        function note(id, text, o) {
            const key = text == null ? '' : text + JSON.stringify(o);
            if (shown.get(id) === key) return;
            shown.set(id, key);
            ui.note(id, text, o);
        }
        /** How wide a small readout is, in picture units, at the frame's current size. */
        function noteWidth(text) {
            measure.font = "400 13px 'IBM Plex Mono', ui-monospace, Consolas, monospace";
            const box = ui.canvas.getBoundingClientRect();
            return (measure.measureText(text).width + text.length * 0.26) / ((box.width / W) || 3);
        }
        /** A small readout's line height, in picture units. */
        const noteHeight = () => 15.6 / ((ui.canvas.getBoundingClientRect().width / W) || 3);
        function drawHud(t) {
            const pv = g.p[g.view], blink = Math.floor(t / 400) % 2, by = VY + VH + 8, atHole = g.phase === 'leak' && patcherAtHole();
            note('deck', NAME[KEYS[g.view]], { x: VX, y: 6, tone: 'text', size: 'm' });
            note('air', 'AIR ' + pct(pv) + '%', { x: VX + VW, y: 6, align: 'right', size: 'm', tone: pv >= 0.6 ? 'ui' : pv >= 0.25 || blink ? 'danger' : 'dim' });
            note('shipLabel', 'SHIP AIR', { x: MAP.x - 2, y: 8 });
            note('ship', pct(shipAir()) + '%', { x: W - 4, y: 6, align: 'right', size: 'm', tone: shipAir() >= 0.6 ? 'ui' : 'danger' });
            MiniLab.inArt(ctx, c => {                                          // a hairline round the deck view
                const x0 = A(VX) - 1, y0 = A(VY) - 1, w = VWA + 2, h = VHA + 2;
                [[x0, y0, w, 1], [x0, y0 + h - 1, w, 1], [x0, y0, 1, h], [x0 + w - 1, y0, 1, h]].forEach(([x, y, ww, hh]) => rect(c, x, y, ww, hh, C.line));
            });
            const calm = g.phase === 'calm', j = patcher && !calm ? crewById(patcher) : null, who = j ? nameOf(patcher).toUpperCase() : null;
            note('who', who, { x: VX + 1, y: by, tone: 'warm' });
            note('status', j ? patcherStatus(j) : null, { x: VX + 1 + (who ? noteWidth(who) + 4 : 0), y: by });
            const tag = calm ? '' : atHole ? 'PRESS AND HOLD' : g.phase === 'leak' && isSealed(g.view) ? 'SEALED' : '';
            note('tag', tag && (!atHole || g.holding || blink) ? tag : null, { x: VX + VW - 1, y: by, align: 'right', tone: 'ui' });
            const hint = g.phase === 'leak' && !g.looked, chip = g.phase === 'leak' && !hint;
            note('hint', hint && blink ? 'CLICK A DECK' : null, { x: CHIP.x + CHIP.w / 2, y: by + 2, align: 'center', tone: 'text' });
            // the one control in the picture, a quiet word (no box): seal or open the deck you are looking at; the same as the button below
            note('chip', chip ? '› ' + (isSealed(g.view) ? 'OPEN' : 'SEAL') : null, { x: CHIP.x + CHIP.w / 2, y: Math.round((CHIP.y + (CHIP.h - noteHeight()) / 2) * 2) / 2, align: 'center', tone: hoverChip ? 'warm' : 'ui' });
        }
        function render(t) {
            rect(ctx, 0, 0, W, H, C.void);
            drawView(t);
            const j = () => Math.round((Math.random() - 0.5) * 6 * g.shake * ART_D);
            MiniLab.blit(ctx, view, A(VX) + j(), A(VY) + j());
            drawMap(t);
            drawHud(t);
            if (g.flash > 0) MiniLab.inArt(ctx, c => { c.fillStyle = pattern(g.flash * 0.55, C.star); c.fillRect(0, 0, c.canvas.width, c.canvas.height); });
        }

        // ── sound: quiet, and only when the game's sound is on ──
        let hiss = null;
        const stopHiss = () => { if (hiss) { try { hiss.src.stop(); } catch (e) { /* already stopped */ } hiss = null; } };
        const voice = fn => { const ac = MiniLab.audio.get(); if (ac && MiniLab.audio.master) fn(ac, ac.currentTime, MiniLab.audio.master); };
        function blip(ac, bus, type, f0, f1, at, peak, dur) {                  // one softly enveloped oscillator
            const o = ac.createOscillator(), a = ac.createGain();
            o.type = type; o.frequency.setValueAtTime(f0, at); o.frequency.exponentialRampToValueAtTime(f1, at + dur * 0.7);
            a.gain.setValueAtTime(0.0001, at); a.gain.exponentialRampToValueAtTime(peak, at + Math.min(0.03, dur * 0.05)); a.gain.exponentialRampToValueAtTime(0.0001, at + dur);
            o.connect(a); a.connect(bus); o.start(at); o.stop(at + dur + 0.05);
        }
        function noise(ac, type, freq, out) {                                   // shared white noise through one filter into `out`
            const n = ac.createBufferSource(), f = ac.createBiquadFilter();
            n.buffer = MiniLab.audio.noiseBuffer(); f.type = type; f.frequency.value = freq; n.connect(f); f.connect(out);
            return { n, f };
        }
        const sound = {
            thud: () => voice((ac, t0, bus) => {                                // a dull knock through the hull, then the ship's chime
                blip(ac, bus, 'sine', 72, 36, t0, 0.45, 0.8);
                const b = ac.createGain(), { n } = noise(ac, 'lowpass', 240, b);
                b.gain.setValueAtTime(0.3, t0); b.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35); b.connect(bus); n.start(t0); n.stop(t0 + 0.4);
                sound.chime([880, 660], 0.7);
            }),
            chime: (notes, delay = 0) => voice((ac, t0, bus) => notes.forEach((f, i) => blip(ac, bus, 'sine', f, f, t0 + delay + i * 0.2, 0.05, 1.1))),
            clunk: () => voice((ac, t0, bus) => blip(ac, bus, 'triangle', 150, 70, t0, 0.12, 0.2)),   // a hatch seating
        };
        function tickHiss(t) {                                                  // the leak: louder in the holed deck, rising as the patch sets
            const ac = MiniLab.audio.get();
            if (!ac || !MiniLab.audio.master) return stopHiss();
            if (!hiss || hiss.bus !== MiniLab.audio.master) {
                stopHiss();
                const gain = ac.createGain(), lp = ac.createBiquadFilter(), { n, f } = noise(ac, 'bandpass', 2200, lp);
                f.Q.value = 0.8; lp.type = 'lowpass'; lp.frequency.value = 5000; gain.gain.value = 0; n.loop = true;
                lp.connect(gain); gain.connect(MiniLab.audio.master); n.start();
                hiss = { src: n, bp: f, gain, bus: MiniLab.audio.master };
            }
            const s = g.phase === 'leak' ? clamp(g.out / K_LEAK, 0, 1) : 0, draft = sinks(g.view).reduce((a, k) => a + (k.hole ? 0 : k.s), 0);
            const level = g.phase === 'leak' ? (g.view === g.leak ? 0.035 + 0.06 * s : 0.012 * s + 0.02 * draft) * (0.85 + 0.15 * Math.sin(t / 650)) : 0;
            hiss.gain.gain.setTargetAtTime(level, ac.currentTime, 0.2);
            hiss.bp.frequency.setTargetAtTime(1800 + 400 * s + 1600 * g.patch, ac.currentTime, 0.2);
        }

        // ── buttons (rebuilt only when they change, so a held button stays held), pointer and keys ──
        const refocus = () => { try { ui.canvas.focus({ preventScroll: true }); } catch (e) { ui.canvas.focus(); } };
        const finish = () => ui.finish(g.result);
        function showButtons() {
            const atHole = g.phase === 'leak' && patcherAtHole(), key = [g.ended, g.phase, atHole, isSealed(g.view)].join('|');
            if (key === btnKey) return;
            btnKey = key;
            holdBtn = false;                                                    // a replaced button never hears its pointerup
            if (g.ended) return ui.buttons([{ label: 'Continue', primary: true, onClick: finish }]);
            if (g.phase !== 'leak') return ui.buttons([]);
            const seal = { label: isSealed(g.view) ? 'Open this deck' : 'Seal this deck', onClick: () => { refocus(); toggleSeal(g.view); } };
            ui.buttons(atHole ? [{ label: 'Hold to patch', hold: true, primary: true, onDown: () => { holdBtn = true; }, onUp: () => { holdBtn = false; } }, seal] : [seal]);
        }
        const cv = ui.canvas;
        const deckOnMap = p => (p.x >= MAP.x - 6 && p.x <= MAP.x + MAP.w + 6 && p.y >= MAP.y && p.y < MAP.y + MAP.h ? R.findIndex(r => p.y >= r.top && p.y < r.bottom) : -1);
        const onChip = p => g.phase === 'leak' && g.looked > 0 && p.x >= CHIP.x && p.x < CHIP.x + CHIP.w && p.y >= CHIP.y && p.y < CHIP.y + CHIP.h;
        cv.onpointermove = e => { const p = ui.toPixel(e); hover = deckOnMap(p); hoverChip = onChip(p); cv.style.cursor = hover >= 0 || hoverChip ? 'pointer' : ''; };
        cv.onpointerleave = () => { hover = -1; hoverChip = false; holdPtr = false; };
        cv.onpointerup = () => { holdPtr = false; };
        cv.onpointerdown = e => {
            const p = ui.toPixel(e), d = deckOnMap(p);
            if (d >= 0) return selectDeck(d);
            if (onChip(p)) return toggleSeal(g.view);
            if (p.x < VX || p.x > VX + VW || p.y < VY || p.y > VY + VH) return;
            if (g.phase === 'leak' && patcherAtHole()) holdPtr = true; else markAt(p);
        };
        MiniLab.onKey((k, e) => {
            const onButton = !!(e && e.target && e.target.tagName === 'BUTTON');   // a focused button answers Space and Enter itself
            if (/^[1-6]$/.test(k)) return selectDeck(Number(k) - 1);
            if (k === 'ArrowUp' || k === 'w') return selectDeck(g.view - 1);
            if (k === 'ArrowDown' || k === 's') return selectDeck(g.view + 1);
            if (g.ended) { if (!onButton && (k === ' ' || k === 'Enter')) finish(); return; }
            if (e && e.repeat) return;
            if (k === 'h') return toggleSeal(g.view);
            if ((k === 'f' || (k === 'Enter' && !onButton)) && g.phase === 'leak' && !g.marked) return g.view === g.leak ? found() : markAt({ x: VX + CX, y: VY + CAM_IN + IH / 2 });
        });

        // ── the clock ──
        function tick(dt) {
            g = {
                ...g, t: g.t + dt, flash: Math.max(0, g.flash - dt * 2.5), shake: Math.max(0, g.shake - dt * 1.4), dip: Math.max(0, g.dip - dt * 1.2),
                cycling: g.cycling.map(c => Math.max(0, c - dt)), rings: g.rings.filter(r => r.hit || g.t - r.t0 < 0.9), melt: g.phase === 'won' ? Math.max(0.15, g.melt - dt * 0.18) : g.melt,
            };
            if (g.pan) {
                const k = Math.min(1, (g.pan.t + dt) / g.pan.dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
                g = { ...g, cam: Math.round(g.pan.from + (g.pan.to - g.pan.from) * e), pan: k >= 1 ? null : { ...g.pan, t: g.pan.t + dt } };
            }
            if (g.phase === 'calm' && g.t >= INTRO) hit();
            if (g.phase === 'leak' || g.phase === 'won') stepAir(dt);
            if (g.phase === 'leak') {
                events();
                if (patcherAtHole()) {
                    const held = holdBtn || holdPtr || MiniLab.keys.has(' ');
                    g = { ...g, holding: held, patch: held ? Math.min(1, g.patch + dt / PATCH) : Math.max(0, g.patch - SLIP * dt) };
                    if (g.patch >= 1) sealed();
                }
                if (g.phase === 'leak' && g.p[g.leak] <= GONE) lose();
            }
            stepCrew(dt); stepThings(dt); pumpTalk(dt);
        }

        start();
        MiniLab.loop((dt, now) => { tick(dt); render(now); showButtons(); tickHiss(now); }, 30);
        render(performance.now());
        showButtons();
        return stopHiss;                                                        // MiniHost stops the loop and throws the canvas away
    }

    MiniHost.register({
        id: 'breach',
        title: 'Seal the breach',
        kicker: 'Micrometeorite strike',
        density: ART_D,                                                     // 720 × 405 art pixels, as the travel view
        mount,
        autoResult: () => ({ damagedDeck: null, hurt: [], airLostPercent: 5 }),   // TEST_MODE: patched in time, a little air lost
    });
})();
