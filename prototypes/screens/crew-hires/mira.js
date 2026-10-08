/* MIRA, tech. Portrait: assets/crew/F_5.png.
   Read at a glance: black hair swept back behind the ear and tied low at the nape, a teal streak over the crown and teal
   ends on the tail; a side-swept fringe; green eyes, red lips; a pale cream high-collar uniform with gold trim.
   Slight, long-necked, composed: she stands straight, feet together, arms at her sides, and walks with a light, low step.
   The cream cloth stays a step below white so her face is still the warmest, brightest thing. */
(function (E) {
    const INK = E.INK;
    const SUIT = [INK, '#262820', '#40433a', '#62665a', '#868a7a', '#a8ac9a', '#c4c8b4', '#d8dcc8'];   // pale sage cream, as in the portrait
    // three-quarter, facing right, as in the portrait: the ear shows behind the cheek, the near eye sits well back from
    // the face edge, the far eye beside the nose, the lips inside the nose line with a small half-smile. The tied tail
    // hangs down her back, black, then teal for its last rows. Anchor [8, 20]: the foot of the gold collar.
    const FRONT = [
        '.....abccba.....',
        '...abcddddcb....',
        '..abcdeffedcb...',
        '.abcdeefTTedcb..',
        '.abcddeTUtdddcb.',
        '.abcddtdcb3445b.',
        '.abcdcbc3BB4BBb.',
        '.abcd433LE45EL4b',
        '.abcb4234453554b',
        '.abcb3234455453.',
        '..abc2334452443.',
        '..abc12344mMM43.',
        '..abc12344455m..',
        '..abc1234443....',
        '..abc.1223321...',
        '..abc..2332.....',
        '..abc..1221.....',
        '.abcgGGHHHHGg...',
        '.abckKKJJjjjH...',
        '.abtkKJJjjjjG...',
        '.atTkKJjjjjjjG..',
        '.tTU............',
        '.tTt............',
        '..TU............',
        '..T.............',
    ];
    // looking down: the face drops a row (a neck row goes), the eyes become lowered lids
    const DOWN = ['.'.repeat(16), ...FRONT.slice(0, 15), ...FRONT.slice(16)]
        .map(r => r.replace('LE', '3L').replace('EL', 'L3'));
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
                    a: '#120c10', b: '#1d151b', c: '#2a2128', d: '#3b3238', e: '#474b4a', f: '#646a66',
                    t: '#17594c', T: '#2fae8e', U: '#8aeccb',
                    1: '#5a2a2c', 2: '#975749', 3: '#c27e5d', 4: '#d99f70', 5: '#ecc28c',
                    B: '#3a2224', L: '#1a0e10', E: '#34a283', w: '#c9b49a', r: '#d08a78', q: '#7a3a38', m: '#a8404c', M: '#d26c66',
                    k: SUIT[3], K: SUIT[4], J: SUIT[5], j: SUIT[6], g: '#a07a2a', G: '#e2c46a', H: '#ffe08a',
                },
                blink: { E: '#c27e5d', w: '#c27e5d' },
                map: FRONT,
            },
            down: { anchor: [8, 20], map: DOWN },
            lying: {                                   // asleep, face up: the tail fanned out on the pillow, teal ends
                anchor: [24, 7],
                map: [
                    '...............4.........',
                    '.........cccc45534.......',
                    '........bddd44542M43.....',
                    '.......bcdd555544mM4...HG',
                    '.......cddd4444443441GHGj',
                    '......bdTddB4L4444431Hjjj',
                    '......cdet4B4L4433322Hjjj',
                    '....abdeeU333L3332213HJjj',
                    '..abccdefecc222221122GJJj',
                    '.abcdbdefetd421211122GKJJ',
                    'tTabcacdeeTt343111111gKKK',
                    'UTtab.bcddddccbaaa...gkkk',
                    '.tTta.abccdcddcbbbb......',
                    '.......abccccccbaaa......',
                    '........abbbbbba.........',
                    '.........aaaaaa..........',
                ],
            },
            back: {
                anchor: [7, 18],
                map: [
                    '....abccba....',
                    '...bcddddcb...',
                    '..bcdeeeedcb..',
                    '.bcdeffffedcb.',
                    '.bcdeeffeedcb.',
                    'abcddeeeedTcba',
                    'abcdddddddTcba',
                    'abccddddddcTba',
                    'abcccdddccctba',
                    'abbcccddcccbba',
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
