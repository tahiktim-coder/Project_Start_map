/* MIRA, tech. Portrait: assets/crew/F_5.png.
   Read at a glance: black hair swept back behind the ear and tied low at the nape, a teal streak over the crown and teal
   ends on the tail; a side-swept fringe; green eyes, red lips; a pale cream high-collar uniform with gold trim.
   Slight, long-necked, composed: she stands straight, feet together, arms at her sides, and walks with a light, low step.
   The cream cloth stays a step below white so her face is still the warmest, brightest thing. */
(function (E) {
    const INK = E.INK;
    const SUIT = [INK, '#262820', '#40433a', '#62665a', '#868a7a', '#a8ac9a', '#c4c8b4', '#d8dcc8'];   // pale sage cream, as in the portrait
    // three-quarter, facing right (the portrait mirrored), sized to the cast (crown to chin 14 rows, like Cora's). The hair
    // is a round black dome with a dim blue sheen, a thin teal streak arcing down the crown, a fringe that sweeps over the
    // far temple and leaves a little forehead. The ear (lit rim, dark bowl) sits in the hair behind the cheek, a dark
    // lock in front of it. Two level soft-brown brows with skin between them; liner only at each eye's upper-outer corner
    // (a full bar on each eye read as a visor); the near eye white, green, pupil, the far eye green, pupil. The nose is
    // 2 px at the far cheek's edge, lit above, shaded under. The mouth is 1 px high and a pixel inside the jaw line: a
    // darker pixel and a rose one, the near corner lifted a row, her calm half-smile (the old 2 x 2 lip block read as a
    // pout). The tied tail hangs down her back, black, then teal. Anchor [8, 20]: the collar foot.
    const FRONT = [
        '.....abccba.....',
        '...abccdddcb....',
        '..abcTdeefddb...',
        '.abTUcddeeeedb..',
        'aaTcdcd455eedb..',          // a little forehead under the fringe
        'aatccd345554db..',          // the fringe sweeps over the far temple
        'abbccc3BBB4BBd..',          // two level soft-brown brows, skin between them
        'abb34b3L4444L4..',          // liner only at each eye's upper-outer corner; the ear's top, a dark lock in front of it
        '.ab42b3wEP5EP5..',          // the ear's bowl; the near eye white, green, pupil; the far eye green, pupil
        '.ab32b345544455.',          // the nose, 2 px at the edge: lit above
        '.abc32344444343.',          // the ear lobe; the nose's shaded side, its underside
        '.abcb13444m443..',          // the near corner of the mouth lifted a row; the shadow under the nose
        '..abc123444mM3..',          // the lips: a darker pixel, a rose one, a row inside the jaw line
        '..abc12223443...',
        '..abc.122211....',
        '..abc..2343.....',
        '..abc..1232.....',
        '.abcgGGHHHHGg...',
        '.abckKKJJjjjH...',
        '.abtkKJJjjjjG...',
        '.atTkKJjjjjjjG..',
        '.tTU............',
        '.tTt............',
        '..TU............',
        '..T.............',
    ];
    // looking down: the face drops a row (a neck row goes), the lids come down: the liner goes back to skin, the eye row
    // becomes a thin lash line under the brows
    const DOWN = ['.'.repeat(16), ...FRONT.slice(0, 15), ...FRONT.slice(16)]
        .map(r => r.replace('b3L4444L4', 'b34444444').replace('wEP5EP', '3LL5LL'));
    E.register({
        id: 'mira', name: 'Mira', role: 'Tech', portrait: '../../../assets/crew/F_5.png',
        signature: 'Black hair swept back behind the ear and tied low, a teal streak and teal ends; green eyes; cream high-collar uniform with gold trim. Slight, composed, arms straight at her sides.',
        ramps: {
            suit: SUIT,
            boot: [INK, '#14110e', '#262019', '#3a3127', '#524537'],
            skin: [INK, '#5a2a2c', '#975749', '#c27e5d', '#d99f70', '#ecc28c'],
            hair: [INK, '#120c10', '#1d151b', '#2a2128', '#3b3238', '#504a4c'],
            gold: [INK, '#5a3c10', '#a07a2a', '#e2c46a', '#ffe08a'],
            belt: [INK, '#1a1712', '#2c271e', '#3f382b', '#554c3a'],
        },
        tex: { suit: 0.08, boot: 0.05, skin: 0.03, gold: 0, belt: 0.03 },
        build: { idle: 'hang', lift: 4.5, thigh: [3.5, 2.5], shin: [2.4, 1.7], foot: 1.5, toe: 4, arm: [1.8, 1.5], fore: [1.5, 1.2], hand: 1.5,
                 upper: 14.5, lower: 13, pelvis: [5.6, 5.2, 4.8], waist: [4.3, 5.4, 4.1], chest: [6, 8.2, 5.2], sh: [3, 2.7], shX: [-3.3, 4],
                 shY: -25, neckY: -27, chestY: -18, waistY: -9, stanceX: [-1.5, 1.5], backW: 7.2, bust: true },
        materials: {
            leg: t => (t > 0.66 ? 'boot' : 'suit'),
            forearm: t => (t > 0.86 ? 'gold' : 'suit'),                               // gold cuffs
            hand: 'skin',
        },
        heads: {
            front: {
                anchor: [8, 20],
                keys: {
                    a: '#120c10', b: '#1d151b', c: '#2a2128', d: '#3b3238', e: '#263236', f: '#38494f',
                    t: '#17594c', T: '#2fae8e', U: '#8aeccb',
                    1: '#5a2a2c', 2: '#975749', 3: '#c27e5d', 4: '#d99f70', 5: '#ecc28c',
                    B: '#5e3a30', L: '#1a0e10', E: '#34a283', P: '#0f2a26', w: '#e6d6c0', r: '#d08a78', q: '#7a3a38', m: '#a8404c', M: '#d26c66',
                    k: SUIT[3], K: SUIT[4], J: SUIT[5], j: SUIT[6], g: '#a07a2a', G: '#e2c46a', H: '#ffe08a',
                },
                blink: { L: '#c27e5d', E: '#5a2a2c', P: '#5a2a2c', w: '#5a2a2c' },
                map: FRONT,
            },
            down: { anchor: [8, 20], map: DOWN },
            lying: {                                   // asleep on her back: the front head turned face-up, eyes shut to
                anchor: [20, 7],                       // lash lines, brows softened, the neck a pixel shorter, the jaw
                                                       // shadow lightened (dark, it read as a slit across the throat), the
                                                       // tail under her neck with its teal ends out on the pillow
                map: [
                    '..........53.........',
                    '....bbbd455433.......',
                    '...bddd34L434M3.....G',
                    '..bdee434L444m42.gHGj',
                    '.acdee544544m4422Gjjj',
                    '.bdfe5534L5444323Hjjj',
                    '.cdee5534L5444222Hjjj',
                    '.cded443434443222HJjj',
                    '.bcddd3333333222.HJJj',
                    '.acTccdcbbb2222..GKJJ',
                    '..bcUdcc4223bccccGKKK',
                    '..abTccc343ccbbbbgkkk',
                    '...abTtbbbbbbatTt....',
                    '....aaabbaaaatTU.....',
                    '.....aaaa............',
                ],
            },
            back: {                                    // climbing: swept back to a low tie, the teal streak on her left, the
                anchor: [7, 18],                       // ears just showing, the tail down her back with teal ends
                map: [
                    '....abccba....',
                    '..abctddddcb..',
                    '.abcTeeeddccb.',
                    '.bcUdeedddccb.',
                    'abTcdddddcccba',
                    'atcdcddcdcccba',
                    'abccdcdcdcccba',
                    '3bccdcdcdcccb3',
                    '2abcccdcdccba2',
                    '.abbccdcdccba.',
                    '.abbcccccccba.',
                    '.2abbccccbba2.',
                    '..1aabccbaa1..',
                    '...12abba21...',
                    '....2abba2....',
                    '..gGGabbaGGg..',
                    '.kKKJabbaJKKk.',
                    '.kKJJabbaJJKk.',
                    '.kKJJabcaJJKk.',
                    '.....abca.....',
                    '.....abct.....',
                    '.....atTt.....',
                    '......tU......',
                    '......T.......',
                ],
            },
        },
        decorate(api, P) {
            const gold = api.ramps.gold;
            const w = P.up(-5.5), wy = Math.round(w.y);                               // a narrow dark belt, a gold buckle
            for (let y = wy; y <= wy + 1; y++) for (let x = 0; x < api.W; x++) if (api.part(x, y) === 'torso') api.paint(x, y, 'belt', y === wy ? 0 : -1);
            const fold = (x, y, step) => { const pt = api.part(x, y); if (pt && pt !== 'crate' && api.light(x, y) !== null) api.paint(x, y, 'suit', step); };
            for (const L of P.legs) { const kx = Math.round(L.knee.x), ky = Math.round(L.knee.y); fold(kx - 1, ky, -2); fold(kx, ky + 1, -1); fold(kx - 1, ky + 2, -1); }
            for (const A of P.arms) { const ex = Math.round(A.el.x), ey = Math.round(A.el.y); fold(ex, ey, -2); fold(ex - 1, ey + 1, -1); }
            if (P.view !== 'side') return;
            for (const dy of [-13, -1]) { const c = P.up(dy), cy = Math.round(c.y); for (let x = Math.round(c.x) - 2; x <= Math.round(c.x) + 3; x++) if (api.part(x, cy) === 'torso' && (x + cy) % 3) fold(x, cy, -1); }
            const top = P.up(-24), bot = P.up(-7);                                    // the gold edge of the front panel
            for (let y = Math.round(top.y); y <= Math.round(bot.y); y++) {
                const t = (y - top.y) / (bot.y - top.y), x = Math.round(api.lerp(top.x + 3.4, bot.x + 2.9, t));
                if (api.part(x, y) === 'torso') api.set(x, y, t < 0.15 ? gold[4] : gold[3]);
            }
            const bx = Math.round(w.x + 3); if (api.part(bx, wy) === 'torso') { api.set(bx, wy, gold[4]); api.set(bx, wy + 1, gold[2]); }
        },
    });
})(CrewEngine);
