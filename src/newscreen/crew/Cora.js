/* Silent Exodus · new screen (?new=1) · crew/Cora.js: Cora's sprite (heads, ramps, build). Calls CrewEngine.register
   once. Source: prototypes/screens/crew-hires/cora.js, ported unchanged ('use strict' added). Load after CrewEngine.js. */
/* CORA, commander, the player. Portrait: assets/crew/F_1.png.
   Read at a glance: a silver-white bob, rounded on top and cut dead straight at the jaw, with a heavy straight fringe
   down to the eyes; mint light on the crown, lavender in the shadows. Pale warm skin, teal eyes, faint cyan lines on the
   near cheek, a small grey implant at the temple. A black high collar right up to the jaw, cyan trim down its edge and the
   front of the suit, cyan cuffs. Slight, tall and upright; she stands with her hands clasped behind her back. */
(function (E) {
    'use strict';
    const INK = E.INK;
    const SUIT = [INK, '#11161d', '#1b222b', '#262f38', '#323c47', '#45515e', '#5f6c7e'];   // cool blue-black slate
    // the head's own keys: hair, skin, eyes and collar, sampled from the portrait and warmed for the dark ship
    const HAIR = { a: '#2e2c40', b: '#4f4c68', c: '#8f8aa8', d: '#b0b2c6', e: '#ccd6dc', f: '#e0ece8', g: '#f2fff6' };   // lavender-grey shadow, mint light
    const SKIN = { 1: '#4a2a36', 2: '#84505a', 3: '#b27c74', 4: '#d2a28a', 5: '#e6c2a4', 6: '#f2d8bc' };
    const FACE = { L: '#241226', E: '#3fc4c0', I: '#1d3f4c', m: '#c2606c', n: '#8a3a4e', C: '#5ff2cf', D: '#8a98aa', G: '#7ff5da' };
    const COLLAR = { k: SUIT[1], K: SUIT[2], J: SUIT[3], t: '#1a7f72', T: '#5ff2cf' };
    const KEYS = Object.assign({}, HAIR, SKIN, FACE, COLLAR);
    const BLINK = { L: '#6a3a48', E: '#d2a28a', I: '#b27c74' };            // shut: the lash line becomes a lid, the iris skin

    const FRONT = [
        '.....abccdcb.....',
        '...abcddeffeb....',
        '..abcdeefggfeb...',
        '.abcdeefgggffeb..',
        '.abcdedeffgffedb.',
        '.abcdcdedefededcb',
        '.abccdcdcddcdcdcb',
        '.abcc3LL344LL3dcb',
        '.abcD45E555E54dcb',
        '.abccC45554554dc.',
        '.abccC44553554dc.',
        '.abccC3445mm43dc.',
        '.abccC34454432cb.',
        '.abcdc2344443ccb.',
        '..abcdc123432cb..',
        '...aabkKJJt......',
        '.....kKKJJJt.....',
        '....kKKJJJJJt....',
        '...kKJJJJJJKt....',
    ];
    const DOWN = ['.'.repeat(17), ...FRONT.slice(0, 14), ...FRONT.slice(15)].map(r => r.replace(/5E/g, '4L').replace(/E5/g, 'L4'));

    E.register({
        id: 'cora', name: 'Cora', role: 'Commander · the player', portrait: '../../../assets/crew/F_1.png',
        signature: 'Silver-white bob cut straight at the jaw, heavy straight fringe to the eyes, teal eyes, faint cyan lines on the near cheek. Black high-collar suit with cyan trim and cuffs. Tall, slight, upright; hands clasped behind her back.',
        ramps: {
            suit: SUIT,
            boot: [INK, '#0d1116', '#161c23', '#212931', '#2e3842', '#3f4a55'],
            skin: [INK, '#4a2a36', '#84505a', '#b27c74', '#d2a28a', '#e6c2a4'],
            trim: [INK, '#0d3a38', '#1a7f72', '#2fcdb0', '#7ff5da'],
            pad:  [INK, '#161c23', '#232b34', '#323c47', '#46525e', '#5e6c78', '#7a8a96'],
            hair: [INK, '#353349', '#575570', '#7d7f9a', '#a2abbd', '#c0d0d4', '#d6ece2'],
        },
        tex: { suit: 0.06, boot: 0.05, skin: 0.03, pad: 0.04, trim: 0 },
        build: { idle: 'behind', lift: 4.5, thigh: [4.2, 3.0], shin: [2.9, 2.0], foot: 1.6, toe: 4.2,
                 arm: [2.05, 1.7], fore: [1.75, 1.3], hand: 1.55, upper: 14.5, lower: 13,
                 pelvis: [6.1, 5.6, 5.2], waist: [4.7, 5.8, 4.5], chest: [6.4, 8.6, 5.6], bust: true,
                 sh: [3.3, 3], shX: [-3.6, 4.2], shY: -25.6, neckY: -27.4, chestY: -18.4, waistY: -9, stanceX: [-2, 2.2], backW: 7.8 },
        materials: {
            leg: t => (t > 0.6 ? 'boot' : 'suit'),
            forearm: t => (t > 0.86 ? 'trim' : 'suit'),                               // the cyan cuff
            shoulder: (u, v) => (v < 0.4 ? 'pad' : 'suit'),                          // a plate over the shoulder, a step lighter
            hand: 'skin',
        },
        heads: {
            front: {                                   // three-quarter, facing right: a 3-tone bob with strand breaks and a
                anchor: [8, 18], keys: KEYS, blink: BLINK,  // curl-in at the jaw, lash bars over teal eyes, the cyan cheek line
                map: FRONT,
            },
            down: { anchor: [8, 18], map: DOWN },     // console, tend, wall: the head drops a row into the collar, lids lowered
            lying: {                                   // asleep on her back, face up in profile, the bob fallen onto the pillow
                anchor: [17, 7], blink: {},
                map: [
                    '..........5.......',
                    '..bcddee.454......',
                    '.bcdeefd3555m4....',
                    'bcdeffe3L455443...',
                    'bcdeeedD4C44432kKK',
                    'bccddddcd344321kJK',
                    'abccdcddcddc21kJJJ',
                    'abccccdccdccb1kJJJ',
                    'abbccccccccccbkJJJ',
                    'aabbcbccccbcccbkKJ',
                    'aabbbbcbbbbcbbbakK',
                    '.aabbbbbbbbbbbbaa.',
                    '..aaabaaabaabaa...',
                ],
            },
            back: {                                    // climbing: the bob from behind, lavender at the sides, strand breaks, cut level
                anchor: [7, 17],
                map: [
                    '....bcdddcb....',
                    '..bcdeeeeedcb..',
                    '.bcdeefgfeedcb.',
                    '.bcdeffgffedcb.',
                    'abcdedefededcba',
                    'abcdcdeedcdccba',
                    'abccdcdedcdccba',
                    'abcccdcdcdcccba',
                    'abccdcdcdccdcba',
                    'abbcccdcdcdccba',
                    'abbcccdcdcccbba',
                    'abbbcccccccbbba',
                    'aabbbbbbbbbbbaa',
                    '.aaaaaaaaaaaaa.',
                    '.....12221.....',
                    '...kKKJJJKKk...',
                    '..kKKJJJJJKKk..',
                    '..kKJJJJJJJKk..',
                ],
            },
        },
        decorate(api, P) {
            const trim = api.ramps.trim, belt = '#0d1116';
            const w = P.up(-4.5), wy = Math.round(w.y);
            for (let x = 0; x < api.W; x++) if (api.part(x, wy) === 'torso') api.set(x, wy, belt);
            if (P.view !== 'side') return;
            const top = P.up(-23), bot = P.up(-3);                                   // the dim cyan seam down the front
            for (let y = Math.round(top.y); y <= Math.round(bot.y); y++) {
                const t = (y - top.y) / (bot.y - top.y), x = Math.round(api.lerp(top.x + 3.4, bot.x + 2.8, t));
                if (api.part(x, y) === 'torso') api.set(x, y, t < 0.1 ? trim[3] : t < 0.3 ? trim[2] : trim[1]);
            }
            const bx = Math.round(w.x + 2.8); if (api.part(bx, wy) === 'torso') api.set(bx, wy, trim[3]);   // the buckle
        },
    });
})(window.CrewEngine);
