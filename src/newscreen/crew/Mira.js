/* Silent Exodus · new screen (?new=1) · crew/Mira.js: Mira's sprite (heads, ramps, build). Calls CrewEngine.register
   once. Source: prototypes/screens/crew-hires/mira.js, ported unchanged ('use strict' added). Load after CrewEngine.js. */
/* MIRA, tech. Portrait: assets/crew/F_5.png.
   Read at a glance: black hair tied back behind the ear, one teal lock falling at the front over the far temple; green
   eyes; a calm half-smile; a pale cream high-collar uniform with gold trim. Slight, long-necked, composed: she stands
   straight, feet together, arms at her sides, and walks with a light, low step. The cream cloth stays a step below
   white so her face is still the warmest, brightest thing.
   Heads (redrawn 2026-10-08 in Aris's construction, the approved set): front three-quarter with the hair close to the
   skull and a small knot at the nape, a 1-px half-smile (never a red pout), the far eye clear of the hair and the ear,
   the teal lock joined to the hair; down (lids lowered); back (a gold tie over the knot); lying (face up in profile). */
(function (E) {
    'use strict';
    const INK = E.INK;
    const SUIT = [INK, '#262820', '#40433a', '#62665a', '#868a7a', '#a8ac9a', '#c4c8b4', '#d8dcc8'];   // pale sage cream, as in the portrait
    // the head keys: hair black with a cool sheen (f the one bright strand on the crown), the teal lock, warm skin lit
    // from the front (1 the jaw shadow ... 6 the light on the forehead and the nose; h the blush), the face, the cream
    // collar with its gold trim (g o also the hair tie)
    const KEYS = {
        a: '#19131c', b: '#231b28', c: '#2d2534', d: '#3a3346', e: '#4c4a64', f: '#6c7090',
        t: '#176a6a', T: '#2fb0a6',
        1: '#5a2a2c', 2: '#8e4e44', 3: '#bc7658', 4: '#d89a6c', 5: '#eab886', 6: '#f8d6a4', h: '#d48c74',
        B: '#24121a', V: '#6a3a34', L: '#140a0e', I: '#2a9a78', P: '#0a1e1a', G: '#7ad8b4', w: '#e8cdb4',
        q: '#8a3c3e', m: '#c87c70', M: '#d88a7c',
        k: SUIT[3], K: SUIT[4], J: SUIT[5], j: SUIT[6], g: '#a07a2a', o: '#e2c46a', H: '#ffe08a',
    };
    // shut: the lid comes down over the eye, the lashes rest where it was
    const BLINK = { L: '#bc7658', I: '#bc7658', P: '#140a0e', G: '#140a0e', w: '#140a0e' };
    // three-quarter, facing right (the portrait mirrored), built the same way as Aris's head: the same face columns, turn
    // and light. The hair close to the skull: a dark dome with one cool sheen strand from the crown, swept back past the
    // ear into a small knot low at the nape. The teal lock starts inside the hairline on the far side of the forehead and
    // falls four pixels over the temple, joined to the hair, its end dark (no pale tip); black hair frames the far temple
    // behind it. The ear sits back from the eye with a hair pixel between. The face: level 1-px brows a row above the
    // eyes; each eye a lash line over a green iris, then the white, a dark pupil and a light catch, the lash row ending at
    // the eye; the nose from between the eyes down to a lit tip; one blush pixel on the near cheek; the half-smile, a
    // 1-px dark-rose line with only the near corner lifted a row and one lip-tone pixel under it; a short, soft chin.
    // Then the long neck and the cream high collar with its gold edge. Anchor [12, 19]: the collar foot.
    const FRONT = [
        '.....................',
        '..........abccba.....',
        '........abcdeffedcb..',
        '.......abcdeeddcccbb.',
        '......abcdedcc455tcb.',
        '.....abcddcd445556Tb.',
        '....abcdcb3VBB55BVTb.',
        '...abc43cb34555655Tb.',
        '...abc42cb4LIL56LItb.',
        '...abc32cb4wPG56PG4..',
        '..abdcbabb345543654..',
        '..adecbaa12h4q54243..',
        '...bdcba.12345qq443..',
        '....aba..11234m443...',
        '..........1233321....',
        '...........1221......',
        '........gooHHHHog....',
        '........kKKJJjjjH....',
        '........kKJJjjjjo....',
        '........kKJjjjjjjo...',
    ];
    // looking down (console, tend, wall): everything above the collar drops a row, the lids come down, the iris looks down
    const DOWN = ['.'.repeat(21), ...FRONT.slice(0, 15), ...FRONT.slice(16)]
        .map(r => r.replace('4LIL56LIt', '43335633t').replace('4wPG56PG4', '4LIL56LI4'));
    // climbing, from behind: the dome with its sheen strand, the combed lines meeting at the nape, both ears, the hair
    // gathered under a gold tie into a small knot over a little bare neck, the high collar from behind
    const BACK = [
        '.....abccba.....',
        '...abcdeedcba...',
        '..abcdeffedcba..',
        '.abcdedeedcdcba.',
        '.abcdcdeddcdcba.',
        'abcdcdcedcdcdcba',
        'abcdcdcdcdcdcdba',
        '3abcdcdcdcdcdba3',
        '4abcdcdcdcdcdba4',
        '32abcdcdcdcdba23',
        '.2abcdcdcdcdba2.',
        '..2abcgoogcba2..',
        '...23bcdedcb32..',
        '....12bcddcb21..',
        '....123abba321..',
        '...gooHHHHHoog..',
        '..kKKJJjjJJKKk..',
        '..kKJJJjjjJJKk..',
        '..kKJJjjjjJJKk..',
    ];
    // asleep: face up in profile, crown to the left, like Aris's. Forehead, a soft brow, the closed eye's lash line, a
    // small straight nose, closed lips, chin; the ear mid-head; the tied hair under her head with the teal lock out on
    // the pillow by the jaw. The last four columns are the front's collar, turned.
    const LYING = [
        '...........5..........',
        '..........553.........',
        '....555565554mqM4.....',
        '..cc455VV555543432...o',
        '.bdc44444LLh544321gHoj',
        '.cdb34455554543211ojjj',
        'bcdbc3444444432112Hjjj',
        'bdcbb3454344332122Hjjj',
        'cbdcb3423243321122HJjj',
        'acdcbb322232211222HJJj',
        '.bcdcbbbb221112221oKJJ',
        '..acbdcbbaa1.11111oKKK',
        '...abcdcbaabtTt11.gkkk',
        '....aabcbbatTTt.......',
        '......aaa..tTt........',
    ];
    E.register({
        id: 'mira', name: 'Mira', role: 'Tech', portrait: '../../../assets/crew/F_5.png',
        signature: 'Black hair tied back behind the ear, one teal lock falling at the front; green eyes, a calm half-smile; cream high-collar uniform with gold trim. Slight, composed, arms straight at her sides.',
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
            front: { anchor: [12, 19], keys: KEYS, map: FRONT, blink: BLINK },
            down: { anchor: [12, 19], map: DOWN },
            back: { anchor: [8, 18], map: BACK },
            lying: { anchor: [21, 8], blink: {}, map: LYING },
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
})(window.CrewEngine);
