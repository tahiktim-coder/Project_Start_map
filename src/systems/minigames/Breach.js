/* Breach.js — Seal the breach: sector one's micrometeorite hazard, once per run (a port of prototypes/sim-bay/proto-breach.js).
   A speck of rock holes EXODUS-9. A.U.R.A. knows the ship is losing air but not where: with the hatches open every deck
   bleeds together. You look into one deck at a time (a big side view; the small ship on the right is the map) and watch the
   air move: in a quiet deck dust drifts to the ladder hatch the air leaves by; in the holed deck everything streams to one
   spot, frost blooms there, and the lamp beams thin out as the air goes (no air, no beam). Whoever is inside asks to be shut
   in. Click the spot, Jaxon climbs there, and you hold while he presses the patch on.
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
    const C = MiniLab.C, W = MiniLab.W, H = MiniLab.H, S = MiniShip, clamp = MiniLab.clamp, mix = MiniLab.mix;

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
    const NAME = { bridge: 'BRIDGE', lab: 'LABORATORY', quarters: 'CREW QUARTERS', cargo: 'CARGO HOLD', engineering: 'ENGINEERING', upgrades: 'FABRICATION' };
    const THE = { bridge: 'the bridge', lab: 'the laboratory', quarters: 'the crew quarters', cargo: 'the cargo hold', engineering: 'engineering', upgrades: 'fabrication' };
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

    // ── the column: hull, walls, lamps and furniture of all six decks, painted once per palette, with air and without ──
    const SPACE = 0, HULL = 1, WALL = 2, FURN = 3, GLOW = 4, GLOWS = ['ui', 'uiDim', 'uiBright', 'warm', 'warmBright', 'star', 'textDim', 'line2'];
    const u32 = c => { const [r, g, b] = MiniLab.rgb(c); return ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0; };
    function outerHalf(y) {
        if (y < TOP || y >= floorY(NDECK - 1) + SLAB) return 0;
        const dy = TOP + R0 - y;
        return dy > 0 ? (CX - HULL_OUT - R0) + Math.sqrt(R0 * R0 - dy * dy) : CX - HULL_OUT;   // the nose rounds off above the bridge
    }
    /** The paint kit: material, tone and glow for every pixel of the column, the light the lamps throw, and the helpers that fill them in. */
    function newKit() {
        const N = CW * COL_H, mat = new Uint8Array(N), tone = new Float32Array(N), glow = new Uint8Array(N), light = new Float32Array(N), bare = new Float32Array(N), surfaces = KEYS.map(() => []);
        const put = (x, y, m, t, gi = 0) => { const rx = Math.round(x), ry = Math.round(y), k = ry * CW + rx; if (rx >= 0 && ry >= 0 && rx < CW && ry < COL_H) { mat[k] = m; tone[k] = t; glow[k] = gi; } };
        const area = (x, y, w, h, fn) => { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) fn(xx, yy); };
        const box = (x, y, w, h, t) => area(x, y, w, h, (a, b) => put(a, b, FURN, t));
        const solid = (x, y, w, h, t) => { box(x, y, w, h, t); box(x, y, w, 1, t + 0.16); box(x, y + 1, 1, h - 1, t + 0.06); };   // lit from above
        const glowBox = (x, y, w, h, name) => area(x, y, w, h, (a, b) => put(a, b, GLOW, 0, GLOWS.indexOf(name)));
        const screen = (x, y, w, h) => { area(x - 2, y - 2, w + 4, h + 4, (a, b) => put(a, b, HULL, b === y - 2 ? 0.62 : 0.36)); for (let r = 0; r < h; r++) glowBox(x, y + r, w, 1, r % 2 ? 'uiDim' : 'line2'); };
        const seg = (x0, y0, x1, y1, t) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let i = 0; i <= n; i++) box(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), 3, 3, t); };
        const surf = (d, x0, x1, y) => surfaces[d].push({ x0, x1, y });
        return { mat, tone, glow, light, bare, surfaces, put, area, box, solid, glowBox, screen, seg, surf };
    }
    function paintHull({ mat, tone }) {                                       // hull, deck slabs and bare walls
        for (let y = 0; y < COL_H; y++) {
            const oh = outerHalf(y), d = Math.floor((y - TOP) / CELL), local = y - cellTop(d), ly = local - SLAB;
            for (let x = 0; x < CW; x++) {
                const dx = Math.abs(x + 0.5 - CX), k = y * CW + x, side = dx > oh - (HULL_IN - HULL_OUT), panel = (x - HULL_IN) % 48, rail = [0.32, 0.22, 0.06][ly - 62];
                if (dx > oh) continue;
                if (d >= 0 && d < NDECK && local >= SLAB && !side) {           // wall panels, and a hand rail along the wall
                    mat[k] = WALL; tone[k] = rail != null ? rail : 0.12 + 0.05 * (1 - ly / IH) + (panel === 0 ? -0.07 : panel === 1 ? 0.04 : 0) + (ly > IH - 7 ? 0.05 : 0) - (ly < 3 ? 0.05 : 0);
                    continue;
                }
                mat[k] = HULL;
                if (dx > oh - 1.5) tone[k] = x < CX ? 0.72 : 0.5;                                  // the outer skin
                else if (side) tone[k] = (x < CX ? 0.5 : 0.38) - (local < SLAB ? 0.06 : 0);
                else if (d >= 1 && local <= 1) { mat[k] = FURN; tone[k] = local ? 0.3 : 0.44; }   // a deck plate, lit by the lamps above
                else tone[k] = local >= SLAB - 2 ? 0.2 : local === 7 ? 0.5 : local === 8 ? 0.26 : (x % 14 === 7 && (local === 4 || local === 11)) ? 0.62 : 0.33;   // a conduit, rivets
            }
        }
    }
    function paintLadder({ area, put, box }) {
        for (let h = 1; h < NDECK; h++) area(LADDER - 8, cellTop(h), 16, SLAB, (a, b) => put(a, b, WALL, 0.04));   // the ladder well; the hatch lids are drawn live
        for (let y = floorY(0) - 40; y < floorY(NDECK - 1); y++) { put(LADDER - 6, y, FURN, 0.46); put(LADDER + 5, y, FURN, 0.34); if (y % 7 === 3) box(LADDER - 5, y, 10, 1, 0.4); }
    }
    function paintLamps({ light, bare, box, glowBox }) {
        for (let d = 0; d < NDECK; d++) {           // lamps: `light` is what they throw through air (beams, glow, pools); `bare` is what is left in a vacuum
            const top = inTop(d);
            for (let ly = 2; ly <= IH + 1; ly++) for (let x = HULL_IN; x < CW - HULL_IN; x++) {
                let l = 0, v = 0;
                for (const lx of LAMPS) {
                    const dx = Math.abs(x - lx), dy = Math.min(ly, IH) - 3, beam = Math.max(0, 1 - dx / (10 + dy * 0.42)) * Math.max(0, 1 - dy / 210);
                    const glowAt = Math.max(0, 1 - Math.hypot(dx / 70, dy / 90)), pool = ly >= IH - 1 ? 0.5 * Math.pow(Math.max(0, 1 - dx / 44), 1.4) : 0;
                    l += Math.pow(beam, 0.8) * 0.62 + glowAt * glowAt * 0.5 + pool; v += pool + Math.pow(glowAt, 6) * 0.45;
                }
                light[(top + ly) * CW + x] = Math.min(1, l); bare[(top + ly) * CW + x] = Math.min(1, v);
            }
            LAMPS.forEach(lx => { box(lx - 7, top, 14, 2, 0.4); glowBox(lx - 5, top + 2, 10, 1, 'warmBright'); glowBox(lx - 3, top + 3, 6, 1, 'warm'); });
        }
    }
    function paintPortholes({ area, put }) {
        [[330, 40], [338, 44], [196, 40], [334, 42], null, [222, 40]].forEach((p, d) => {   // portholes: cold space through the back wall
            if (!p) return;
            const px = p[0], py = inTop(d) + p[1];
            area(px - 11, py - 11, 23, 23, (x, y) => { const r = Math.hypot(x - px, y - py); if (r <= 7.5) put(x, y, SPACE, 0); else if (r <= 9.5) put(x, y, HULL, r < 8.5 ? 0.66 : 0.44); else if (r <= 10.5) put(x, y, FURN, 0.06); });
            put(px - 3, py - 2, GLOW, 0, GLOWS.indexOf('star')); put(px + 2, py + 3, GLOW, 0, GLOWS.indexOf('textDim'));
        });
    }
    const FURNISH = [                                                        // furniture, deck by deck (fy = the floor, top = the ceiling)
        ({ screen, put, glowBox, solid, box, surf }, fy, top, d) => {   // bridge: the heading chart, the console, two chairs
            screen(122, top + 22, 96, 28); for (let x = 126; x < 214; x += 3) put(x, top + 36, GLOW, 0, GLOWS.indexOf('ui')); glowBox(150, top + 34, 2, 4, 'uiBright');
            solid(140, fy - 30, 170, 5, 0.42); box(146, fy - 25, 158, 25, 0.24); for (let x = 152; x < 300; x += 22) box(x, fy - 21, 14, 1, 0.34); surf(d, 142, 308, fy - 30);
            [150, 196, 242].forEach(x => screen(x + 4, fy - 46, 30, 12));
            [186, 262].forEach(x => { solid(x, fy - 15, 16, 3, 0.4); box(x + 13, fy - 34, 3, 19, 0.34); box(x + 7, fy - 12, 2, 10, 0.3); box(x + 2, fy - 2, 12, 2, 0.34); });
        },
        ({ solid, box, surf, glowBox, screen, put }, fy, top, d) => {   // laboratory: benches, shelves of jars, the scanner, a screen
            [[92, 104], [232, 104]].forEach(([x, w]) => { solid(x, fy - 30, w, 4, 0.44); box(x + 4, fy - 26, w - 8, 26, 0.22); for (let k = 0; k < 3; k++) box(x + 8 + k * 32, fy - 18, 26, 1, 0.32); surf(d, x, x + w, fy - 30); });
            [[96, 92], [236, 60]].forEach(([x, w]) => { solid(x, fy - 72, w, 2, 0.4); surf(d, x, x + w, fy - 72); });
            for (let x = 100; x < 184; x += 9) { const h = 5 + (x % 3) * 2; box(x, fy - 72 - h, 5, h, 0.24); box(x, fy - 72 - h, 5, 1, 0.4); if (x % 27 === 1) glowBox(x + 1, fy - 72 - h + 2, 3, h - 3, 'uiDim'); }
            box(150, fy - 44, 3, 14, 0.5); box(144, fy - 32, 14, 2, 0.46); box(147, fy - 46, 8, 3, 0.4); box(164, top, 14, 34, 0.16); box(161, top + 34, 20, 3, 0.3); glowBox(163, top + 37, 16, 1, 'ui');
            screen(250, fy - 96, 46, 20); for (let x = 0; x < 46; x++) put(250 + x, fy - 86 - Math.round(7 * Math.sin(x / 6) * Math.exp(-x / 40)), GLOW, 0, GLOWS.indexOf('ui'));
        },
        ({ solid, box, surf, glowBox }, fy, top, d) => {   // crew quarters: lockers, a table, bunks, a photo
            [96, 116, 136].forEach(x => { solid(x, fy - 84, 18, 84, 0.28); box(x, fy - 84, 1, 84, 0.18); for (let k = 0; k < 4; k++) box(x + 4, fy - 78 + k * 3, 10, 1, 0.2); box(x + 14, fy - 46, 2, 6, 0.5); });
            solid(176, fy - 22, 36, 3, 0.44); box(192, fy - 19, 3, 19, 0.3); box(184, fy - 2, 20, 2, 0.32); surf(d, 176, 212, fy - 22); [232, 330].forEach(x => box(x, fy - 76, 3, 76, 0.38));
            [fy - 22, fy - 58].forEach(y => { solid(232, y, 101, 4, 0.4); box(236, y - 3, 92, 3, 0.3); box(236, y - 3, 92, 1, 0.42); surf(d, 236, 328, y - 3); });
            box(299, fy - 42, 8, 7, 0.5); glowBox(300, fy - 41, 6, 5, 'warm'); glowBox(302, fy - 40, 2, 2, 'warmBright');
        },
        ({ solid, box, surf, put }, fy, top, d) => {   // cargo hold: crates under a rail, a cargo net
            [[96, 32, 36], [134, 24, 28], [102, 56, 26, 24], [246, 38, 42], [290, 26, 32], [252, 64, 30, 26]].forEach(([x, up, w, h = up]) => {
                const y = fy - up;
                solid(x, y, w, h, 0.3); box(x, y + h - 1, w, 1, 0.2); box(x + w - 1, y, 1, h, 0.2); surf(d, x + 1, x + w - 1, y);
                for (let k = 2; k < Math.min(w, h) - 2; k++) { put(x + k, y + k, FURN, 0.22); put(x + w - 1 - k, y + k, FURN, 0.22); }
            });
            box(90, top + 6, 262, 2, 0.4); for (let x = 100; x < 350; x += 40) box(x, top + 8, 1, 6, 0.42);
            for (let y = fy - 76; y < fy - 6; y += 6) for (let x = 176; x < 236; x += 6) { put(x, y, FURN, 0.26); put(x + 3, y + 3, FURN, 0.2); }
        },
        ({ box, solid, put, seg, glowBox, screen, surf }, fy, top, d) => {   // engineering: pipes, the reactor, a valve, a panel
            [8, 15].forEach(o => { box(HULL_IN, top + o, CW - 2 * HULL_IN, 3, 0.36); box(HULL_IN, top + o, CW - 2 * HULL_IN, 1, 0.52); for (let x = HULL_IN + 20; x < CW - HULL_IN; x += 40) box(x, top + o - 1, 3, 5, 0.46); });
            solid(226, top + 18, 40, IH - 18, 0.3); box(264, top + 18, 2, IH - 18, 0.18); box(236, fy - 96, 20, 56, 0.06); [top + 30, fy - 30].forEach(y => box(224, y, 44, 3, 0.46));
            box(138, top + 18, 4, IH - 64, 0.38); for (let a = 0; a < 40; a++) put(140 + Math.cos(a / 40 * 6.283) * 7, fy - 46 + Math.sin(a / 40 * 6.283) * 7, FURN, 0.52); seg(134, fy - 46, 145, fy - 46, 0.42);
            solid(296, fy - 44, 46, 44, 0.28); [[302, 'ui'], [308, 'uiDim'], [314, 'ui'], [320, 'uiDim']].forEach(([x, c]) => glowBox(x, fy - 38, 3, 2, c)); screen(304, fy - 30, 30, 10); surf(d, 296, 342, fy - 44);
        },
        ({ solid, box, surf, put, glowBox, seg }, fy, top, d) => {   // fabrication: bench, tool board, the fabricator and its arm
            solid(92, fy - 28, 110, 4, 0.44); box(96, fy - 24, 3, 24, 0.3); box(196, fy - 24, 3, 24, 0.3); box(98, fy - 10, 100, 2, 0.3); surf(d, 92, 202, fy - 28);
            solid(98, fy - 84, 100, 34, 0.2); for (let y = fy - 80; y < fy - 52; y += 6) for (let x = 102; x < 196; x += 6) put(x, y, FURN, 0.3);
            box(108, fy - 80, 2, 22, 0.52); box(105, fy - 80, 8, 3, 0.5); box(126, fy - 78, 1, 20, 0.5); box(142, fy - 82, 10, 2, 0.5); box(146, fy - 80, 2, 18, 0.46); box(166, fy - 80, 4, 14, 0.5); box(180, fy - 79, 1, 22, 0.48);
            solid(244, fy - 58, 84, 58, 0.3); box(254, fy - 50, 64, 12, 0.06); glowBox(254, fy - 36, 64, 1, 'uiDim'); glowBox(254, fy - 35, 64, 1, 'ui'); surf(d, 244, 328, fy - 58);
            seg(286, top, 270, top + 26, 0.44); seg(270, top + 26, 282, fy - 70, 0.44); box(268, top + 24, 6, 6, 0.54); box(279, fy - 72, 7, 6, 0.54);
        },
    ];
    function paintBells({ put }) {
        const sb = floorY(NDECK - 1) + SLAB;                                     // the engine bells under the stern
        [-92, 92].forEach(o => { for (let y = 0; y < 22; y++) { const hw = 10 + y * 0.45; for (let x = -hw; x <= hw; x++) put(CX + o + x, sb + y, HULL, Math.abs(x) > hw - 1.5 ? 0.6 : 0.24 + (x < 0 ? 0.08 : 0)); } });
    }
    /** Colour the column in the live palette, twice: with air (warm beams) and in a vacuum (cold walls, only the pools of light left). */
    function colourColumn({ mat, tone, glow, light, bare }) {
        const LITR = [C.void, C.deep, C.dusk, C.haze, mix(C.haze, C.warm, 0.35), mix(C.mist, C.warm, 0.65), C.warm, C.warmBright].map(u32);
        const HULLR = C.hull.map(u32), GLOWU = GLOWS.map(n => u32(C[n])), VOID = u32(C.void), STAR = u32(C.star), DIM = u32(C.textDim);
        const paint = withAir => {
            const cv = document.createElement('canvas');
            cv.width = CW; cv.height = COL_H;
            const c2 = cv.getContext('2d'), img = c2.createImageData(CW, COL_H), out = new Uint32Array(img.data.buffer), rnd = MiniLab.rng(4242);
            for (let k = 0; k < mat.length; k++) {
                const x = k % CW, y = (k / CW) | 0, m = mat[k], r = m === SPACE ? rnd() : 1;
                out[k] = m === SPACE ? (r < 0.0015 ? STAR : r < 0.005 ? DIM : VOID) : m === HULL ? MiniLab.pick(HULLR, tone[k], x, y) : m === GLOW ? GLOWU[glow[k]]
                    : MiniLab.pick(LITR, withAir ? tone[k] + light[k] * (m === WALL ? 0.5 : 0.42) : tone[k] * 0.8 + (m === WALL ? bare[k] * 0.5 : light[k] * 0.3), x, y);
            }
            c2.putImageData(img, 0, 0);
            return cv;
        };
        return { lit: paint(true), vac: paint(false) };
    }
    function paintColumn() {
        const kit = newKit();
        [paintHull, paintLadder, paintLamps, paintPortholes].forEach(paint => paint(kit));
        FURNISH.forEach((fn, d) => fn(kit, floorY(d), inTop(d), d));
        paintBells(kit);
        return { ...colourColumn(kit), light: kit.light, mat: kit.mat, surfaces: kit.surfaces };
    }

    function mount(ctx, ui, opts) {
        const roster = readRoster(opts), patcher = PATCHERS.find(id => roster[id]) || null, sector = SECTOR_WORDS[(opts && opts.sector) - 1] || 'one';
        const col = paintColumn(), view = document.createElement('canvas'), mask = document.createElement('canvas');
        view.width = mask.width = VW; view.height = mask.height = VH;                // the deck view is drawn here first, in its own coordinates
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

        // ── drawing: helpers, and a crew member at deck-view size (47 px, suit warmed toward the lamps, role colour across the chest) ──
        const patterns = new Map(), SKIN = '#e8d8c0';
        function pattern(tone, colour) {                                     // a 4×4 Bayer tile, so big dithered fills cost one fillRect
            const lv = Math.round(clamp(tone, 0, 1) * 16), key = lv + colour;
            if (!patterns.has(key)) {
                const c = document.createElement('canvas'), x = (c.width = c.height = 4, c.getContext('2d'));
                x.fillStyle = colour;
                for (let yy = 0; yy < 4; yy++) for (let xx = 0; xx < 4; xx++) if (lv / 16 > MiniLab.bayer(xx, yy)) x.fillRect(xx, yy, 1, 1);
                patterns.set(key, ctx.createPattern(c, 'repeat'));
            }
            return patterns.get(key);
        }
        const fill = (c, x, y, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(x), Math.round(y), w, h); };
        function person(c, x, feet, f) {
            const suit = mix(f.color, C.warm, 0.45), dark = mix(suit, C.void, 0.5), lit = mix(suit, C.warmBright, 0.3);
            const skin = mix(SKIN, C.warm, 0.15), skinD = mix(skin, C.void, 0.35), hair = mix(f.color, C.void, 0.72), face = f.facing || 1;
            const P = (dx, dy, w, h, col) => fill(c, x + dx, feet + dy, w, h, col);
            if (f.hurt) { P(-24, -6, 30, 6, dark); P(-24, -6, 30, 2, suit); P(-18, -6, 3, 6, f.color); P(6, -7, 8, 7, skin); P(6, -7, 8, 2, hair); return; }
            const climb = onLadder(f), s = Math.floor(f.stepT * 7) % 2, step = f.moving && !climb ? s : 0;
            if (climb) { P(-4, -20 - (s ? 3 : 0), 3, 18, dark); P(1, -20 - (s ? 0 : 3), 3, 18, dark); } else { P(-4 - step, -20, 3, 20, dark); P(1 + step, -20, 3, 20, dark); P(-5 - step, -2, 4, 2, C.void); P(1 + step, -2, 4, 2, C.void); }
            P(-6, -36, 12, 16, suit); P(-6, -36, 2, 16, lit); P(4, -36, 2, 16, dark); P(-6, -31, 12, 2, f.color); P(-6, -21, 12, 1, dark);
            if (climb) { P(-8, -46 + (s ? 0 : 3), 2, 12, suit); P(6, -46 + (s ? 3 : 0), 2, 12, dark); } else if (f.state === 'atHole' && g.phase === 'leak') {
                const hx = g.hole.x, hy = g.hole.y - g.cam, sx = x + face * 5, sy = feet - 33;   // both arms on the plate
                MiniLab.line(c, sx, sy, hx - face * 3, hy, suit); MiniLab.line(c, sx, sy + 1, hx - face * 3, hy + 1, dark); P(-face * 6 - 1, -35, 2, 13, dark);
            } else { P(-8, -35, 2, 13, suit); P(6, -35, 2, 13, dark); P(-8, -22, 2, 2, skin); P(6, -22, 2, 2, skinD); }
            P(-1, -38, 3, 2, skinD); P(-3, -46, 7, 8, climb ? hair : skin); P(-2, -47, 5, 1, hair); P(-3, -47, 7, 2, hair); P(face > 0 ? -3 : 3, -45, 1, 5, hair);
            if (climb) return;
            P(face > 0 ? 2 : -2, -43, 1, 1, C.void);
            if (f.masked) { P(face > 0 ? 0 : -3, -41, 4, 3, C.textDim); P(face > 0 ? 3 : -3, -40, 1, 2, C.uiDim); MiniLab.line(c, x + face * 2, feet - 38, x + face * 3, feet - 31, C.uiDim); }
        }

        // ── drawing: the deck view ──
        const airTone = d => clamp((g.p[d] - 0.08) / 0.8, 0, 1);
        function drawAir(dA, dB) {                                            // the beams show only as far as there is air to catch them
            vx.drawImage(col.vac, 0, g.cam, VW, VH, 0, 0, VW, VH);
            for (let d = dA; d <= dB; d++) {
                const tone = airTone(d), y0 = Math.max(0, inTop(d) - g.cam), h = Math.min(VH, floorY(d) + 2 - g.cam) - y0;
                if (tone <= 0 || h <= 0) continue;
                if (tone >= 1) { vx.drawImage(col.lit, 0, g.cam + y0, VW, h, 0, y0, VW, h); continue; }
                mx.globalCompositeOperation = 'source-over'; mx.clearRect(0, y0, VW, h); mx.drawImage(col.lit, 0, g.cam + y0, VW, h, 0, y0, VW, h);
                mx.globalCompositeOperation = 'destination-in'; mx.fillStyle = pattern(tone, '#fff'); mx.fillRect(0, y0, VW, h);
                vx.drawImage(mask, 0, y0, VW, h, 0, y0, VW, h);
            }
        }
        function drawHatches(t) {
            g.shut.forEach((isShut, h) => {
                const y0 = cellTop(h + 1) - g.cam, cyc = g.cycling[h] > 0;
                if (y0 < -20 || y0 > VH + 4) return;
                if (isShut && !cyc) { fill(vx, LADDER - 8, y0, 16, SLAB, C.hull[1]); fill(vx, LADDER - 8, y0, 16, 2, C.hull[4]); fill(vx, LADDER - 8, y0 + 2, 16, 1, C.hull[2]); fill(vx, LADDER - 8, y0 + SLAB - 2, 16, 2, C.hull[3]); } else fill(vx, LADDER + 9, y0 - 13, 2, 13, C.hull[3]);   // or the lid, swung up
                fill(vx, LADDER - 13, y0 + 6, 2, 3, isShut && !cyc ? C.uiBright : cyc && Math.floor(t / 150) % 2 ? C.uiBright : C.uiDim);
            });
        }
        function drawDeckLife(d, t) {
            const oy = -g.cam, fy = floorY(d) + oy, alarm = g.phase === 'leak' && Math.floor(t / 520) % 2 === 0;
            fill(vx, LADDER + 18, inTop(d) + oy, 6, 2, alarm ? C.danger : C.hull[2]);   // the alarm lamp by the ladder, ship-wide
            if (alarm) MiniLab.disc(vx, LADDER + 21, inTop(d) + oy + 2, 7, q => 0.3 * (1 - q), C.danger);
            if (KEYS[d] === 'engineering') {                                    // the reactor's heartbeat
                const beat = Math.pow(1 - ((t / 2800) % 1), 3), top = fy - 96;
                vx.save(); vx.beginPath(); vx.rect(236, top, 20, 56); vx.clip();
                MiniLab.disc(vx, 246, top + 28, 10 + beat * 4, q => (0.35 + 0.5 * beat) * (1 - q * 0.6), C.uiBright); fill(vx, 245, top, 2, 56, C.ui);
                vx.restore();
            }
            if (d === NDECK - 1) [-92, 92].forEach(o => { for (let k = 0; k < 9; k++) MiniLab.shade(vx, CX + o - 9 + k * 0.6, fy + SLAB + 22 + k, 19 - k * 1.2, 1, 1 - k / 9 - Math.random() * 0.15, k < 3 ? C.light : C.warm); });   // engine flame
        }
        function drawBreach() {
            const hx = g.hole.x, hy = g.hole.y - g.cam, s = g.phase === 'leak' ? clamp(g.out / K_LEAK, 0, 1) : 0;
            const fr = (g.phase === 'lost' ? 34 : Math.min(32, 5 + g.vented * 46)) * g.melt;
            if (s > 0.02) MiniLab.disc(vx, hx, hy, 12 + 26 * s, q => Math.pow(1 - q, 2) * 0.45 * s, C.mist);   // breath-fog where the air rushes out
            if (fr > 2) {                                                       // frost: a cold halo, then crystals with side twigs
                MiniLab.disc(vx, hx, hy, fr * 1.3, q => Math.pow(1 - q, 1.6) * 0.45, C.uiDim);
                g.frost.forEach(f => {
                    const len = fr * f.l, ca = Math.cos(f.a), sa = Math.sin(f.a) * 0.85;
                    MiniLab.line(vx, hx, hy, hx + ca * len, hy + sa * len, C.uiBright, 0.75);
                    [0.45, 0.72].forEach((k, i) => { const bx = hx + ca * len * k, by = hy + sa * len * k, b = f.a + (i ? -0.75 : 0.75), bl = len * f.tw * (1 - k * 0.4); MiniLab.line(vx, bx, by, bx + Math.cos(b) * bl, by + Math.sin(b) * bl * 0.85, C.ui, 0.65); });
                    MiniLab.dot(vx, hx + ca * len, hy + sa * len, C.star);
                });
                MiniLab.disc(vx, hx, hy, Math.min(6, fr * 0.22), 0.7, C.star);
            }
            if (g.patch > 0 || g.phase === 'won') {                             // the plate, and how far the seal has set
                fill(vx, hx - 5, hy - 5, 11, 11, C.hull[3]); fill(vx, hx - 5, hy - 5, 11, 1, C.hull[5]); fill(vx, hx - 5, hy - 5, 1, 11, C.hull[4]);
                [[-3, -3], [3, -3], [-3, 3], [3, 3]].forEach(([a, b]) => MiniLab.dot(vx, hx + a, hy + b, C.hull[1]));
                if (g.phase === 'leak') for (let i = 0; i < 40; i++) { const a = -Math.PI / 2 + (i / 40) * 6.283; fill(vx, hx + Math.cos(a) * 12, hy + Math.sin(a) * 12, 1, 1, i / 40 < g.patch ? C.warmBright : C.uiDim); }
            } else { fill(vx, hx - 2, hy - 2, 4, 4, C.hull[4]); fill(vx, hx - 1, hy - 1, 2, 2, C.void); }   // the puncture
        }
        function drawRings(t) {
            g.rings.forEach(r => {
                const age = g.t - r.t0, y = r.y - g.cam;
                if (!r.hit) MiniLab.ring(vx, r.x, y, 3 + age * 9, C.textDim, Math.max(0, 1 - age / 0.9));
                else if (!patcherAtHole()) MiniLab.ring(vx, r.x, y, 15 + Math.sin(t / 180), C.uiBright, 0.8);
            });
        }
        function drawThing(o) {
            const x = Math.round(o.x), y = Math.round(o.y - g.cam), l = (col.light[(o.y | 0) * CW + (o.x | 0)] || 0) * airTone(o.d);
            if (o.k === 'dust') {
                const sp = Math.hypot(o.vx, o.vy);
                if (sp > 7) MiniLab.line(vx, x - (o.vx / sp) * Math.min(9, sp * 0.35), y - (o.vy / sp) * Math.min(9, sp * 0.35), x, y, C.textDim, 0.7);
                return MiniLab.dot(vx, x, y, sp > 16 ? C.star : l > 0.5 ? C.warmBright : l > 0.22 ? C.text : C.textDim);
            }
            const paper = l > 0.25 ? C.text : C.textDim, [w, h] = [[4, 1], [3, 2], [2, 3], [3, 2]][Math.floor(o.spin) % 4], j = Math.random() < 0.5 ? 1 : 0;
            if (o.stuck) { fill(vx, x - 1 + j, y - 1, 3, 3, paper); MiniLab.dot(vx, x + 1 + j, y + 1, C.textDim); } else if (o.rest) fill(vx, x - 2, y - 1, 4, 1, paper); else fill(vx, x - (w >> 1), y - (h >> 1), w, h, paper);
        }
        function drawView(t) {
            const cam = g.cam, dA = deckAt(cam + 2), dB = deckAt(cam + VH);
            fill(vx, 0, 0, VW, VH, C.void);
            drawAir(dA, dB);
            for (let d = dA; d <= dB; d++) drawDeckLife(d, t);
            drawHatches(t);
            if (g.leak >= dA && g.leak <= dB && g.phase !== 'calm') { drawBreach(); drawRings(t); }
            crew.filter(f => f.y > cam && f.y - 50 < cam + VH).forEach(f => person(vx, Math.round(f.x), Math.round(f.y) - cam, f));
            things.forEach(o => { if (!o.gone && o.d >= dA && o.d <= dB) drawThing(o); });
            if (g.dip > 0) { vx.fillStyle = pattern(g.dip * 0.7, C.void); vx.fillRect(0, 0, VW, VH); }
            vx.fillStyle = pattern(0.6, C.void);                               // the decks above and below stay in shadow
            vx.fillRect(0, 0, VW, CAM_IN - SLAB); vx.fillRect(0, CAM_IN + IH + SLAB, VW, VH);
        }

        // ── drawing: the map (air per deck as a dark level, shut hatches as bright bars), the readouts ──
        const mapX = x => L.cx - L.maxHalf + 3 + ((x - HULL_IN) / (CW - 2 * HULL_IN)) * (2 * L.maxHalf - 6);
        const mapY = y => { const d = deckAt(y), r = R[d]; return r.top + ((y - cellTop(d)) / CELL) * (r.bottom - r.top) - 2; };
        function drawMap(t) {
            S.draw(ctx, L, t, { damaged: g.damaged, labels: false });
            R.forEach((r, i) => {
                const p = g.p[i], level = Math.round(r.top + 1 + (1 - p) * (r.bottom - r.top - 2)), ly = i === 0 ? r.top + Math.round((r.bottom - r.top) * 0.5) : r.top + 3;
                ctx.fillStyle = pattern(p < 0.4 ? 0.75 : 0.7, p < 0.4 ? C.hurt[2] : C.void);
                if (p <= 0.995) for (let y = r.top + 1; y < level; y++) { const hw = L.halfWidth(y) - 2; if (hw > 0) ctx.fillRect(Math.round(L.cx - hw), y, Math.round(hw * 2), 1); }
                MiniLab.text(ctx, r.label, Math.round(L.cx - L.halfWidth(ly) + 4), ly, g.damaged[r.key] ? C.danger : i === g.view ? C.uiBright : C.uiDim);
            });
            const hxm = Math.round(mapX(LADDER));
            g.shut.forEach((isShut, h) => {
                const y = R[h + 1].top;
                if (!isShut || (g.cycling[h] > 0 && Math.floor(t / 150) % 2)) { fill(ctx, hxm - 3, y, 1, 1, C.uiDim); fill(ctx, hxm + 3, y, 1, 1, C.uiDim); } else fill(ctx, hxm - 3, y - 1, 7, 2, C.uiBright);
            });
            crew.forEach(f => S.figure(ctx, Math.round(mapX(f.x)), Math.round(mapY(f.y)), f.color, f.moving && Math.floor(f.stepT * 6) % 2 === 1, f.hurt));
            [[hover, C.uiDim], [g.view, C.uiBright]].forEach(([i, c]) => {
                if (i < 0) return;
                const r = R[i];
                [Math.round(L.cx - L.maxHalf - 5), Math.round(L.cx + L.maxHalf + 4)].forEach((x, k) => { fill(ctx, x, r.top + 1, 1, r.bottom - r.top - 2, c); fill(ctx, x - 2 * k, r.top + 1, 3, 1, c); fill(ctx, x - 2 * k, r.bottom - 2, 3, 1, c); });
            });
        }
        function patcherStatus(j) {
            if (j.hurt || g.phase === 'won') return j.hurt ? 'HURT' : 'DONE';
            if (j.state === 'atHole') return g.patch > 0 ? 'PATCHING ' + Math.round(g.patch * 100) + '%' : 'AT THE HOLE';
            if (j.wait > 0) return 'OPENING A HATCH';
            if (j.state === 'going') return onLadder(j) ? 'CLIMBING' : 'TO THE HOLE';
            return Math.abs(j.x - LADDER - 16) < 1 && g.phase === 'leak' ? 'AT THE LADDER' : 'IN ' + NAME[KEYS[deckAt(j.y)]];
        }
        function drawHud(t) {
            const name = NAME[KEYS[g.view]], pv = g.p[g.view], air = 'AIR ' + pct(pv) + '%', sa = pct(shipAir()) + '%', blink = Math.floor(t / 400) % 2, by = VY + VH + 10;
            MiniLab.text(ctx, name, VX + 1, 7, C.text, 2);
            MiniLab.text(ctx, air, VX + VW - 1 - MiniLab.textWidth(air, 2), 7, pv >= 0.6 ? C.ui : pv >= 0.25 || blink ? C.danger : C.hurt[3], 2);
            MiniLab.text(ctx, 'SHIP AIR', MAP.x, 10, C.textDim);
            MiniLab.text(ctx, sa, W - 4 - MiniLab.textWidth(sa, 2), 7, shipAir() >= 0.6 ? C.ui : C.danger, 2);
            [[VX - 1, VY - 1, VW + 2, 1], [VX - 1, VY + VH, VW + 2, 1], [VX - 1, VY, 1, VH], [VX + VW, VY, 1, VH]].forEach(([x, y, w, h]) => fill(ctx, x, y, w, h, C.line2));
            if (g.phase === 'calm') return;
            if (patcher) MiniLab.text(ctx, patcherStatus(crewById(patcher)), VX + 11 + MiniLab.text(ctx, nameOf(patcher).toUpperCase(), VX + 1, by, C.warm, 2), by, C.textDim, 2);
            const atHole = g.phase === 'leak' && patcherAtHole(), tag = atHole ? 'PRESS AND HOLD' : g.phase === 'leak' && isSealed(g.view) ? 'SEALED' : '';
            if (tag && (!atHole || g.holding || blink)) MiniLab.text(ctx, tag, VX + VW - 1 - MiniLab.textWidth(tag, 2), by, C.uiBright, 2);
            if (g.phase === 'leak' && !g.looked) return blink && MiniLab.text(ctx, 'CLICK A DECK', MAP.x + 14, by + 3, C.uiBright);
            if (g.phase !== 'leak') return;
            const label = isSealed(g.view) ? 'OPEN' : 'SEAL', c = hoverChip ? C.uiBright : C.uiDim;   // the one button in the picture: seal or open the deck you are looking at
            [[0, 0, CHIP.w, 1], [0, CHIP.h - 1, CHIP.w, 1], [0, 0, 1, CHIP.h], [CHIP.w - 1, 0, 1, CHIP.h]].forEach(([x, y, w, h]) => fill(ctx, CHIP.x + x, CHIP.y + y, w, h, c));
            MiniLab.text(ctx, label, CHIP.x + (CHIP.w - MiniLab.textWidth(label, 2)) / 2, CHIP.y + 3, hoverChip ? C.uiBright : C.ui, 2);
        }
        function render(t) {
            fill(ctx, 0, 0, W, H, C.void);
            drawView(t);
            const j = () => Math.round((Math.random() - 0.5) * 6 * g.shake);
            ctx.drawImage(view, 0, 0, VW, VH, VX + j(), VY + j(), VW, VH);
            drawMap(t);
            drawHud(t);
            if (g.flash > 0) { ctx.fillStyle = pattern(g.flash * 0.55, C.star); ctx.fillRect(0, 0, W, H); }
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
        mount,
        autoResult: () => ({ damagedDeck: null, hurt: [], airLostPercent: 5 }),   // TEST_MODE: patched in time, a little air lost
    });
})();
