/* VANCE, the hard one. Portrait: assets/crew/M_4.png. v2, drawn against the portrait at 6x and checked at 2x and 1x.
   Read at a glance, in this order: the big white ring collar with its dark purple-grey lining (the widest thing on him),
   grey hair swept up into ragged spikes with one white lock on the forehead, heavy dark brows over small blue eyes, a
   long nose and a stubbled square jaw. A worn white EVA shell with cool shadows, grey knee joints and shoulder bearings,
   brown leather gloves, a grey life-support pack, a chest box with one amber and one cyan light.
   Stance and movement: heavy and square, hands on his hips, feet wide; he barely lifts his boots when he walks (lift 4).
   Heads: front, down (lids lowered, chin into the ring), back (spikes, both ears, the ring from behind), lying (his
   profile turned up, eyes shut; the collar band there is the front map's collar turned on its side). */
(function (E) {
    const INK = E.INK;
    // ragged spikes 2-3 rows above the skull with one white lock falling on the forehead, solid 2-row brow bars over the
    // blue eyes, a stubbled square jaw, and the padded ring collar: light top edge, mid body, dark lining against the neck
    const FRONT = [
        '.....d...f..g...e.....',
        '....cd..efg.gf.fe.....',
        '...bcdedefgfgfefe.....',
        '..bcdedefgfgffgfeed...',
        '..bcdcdedfegfhgfefe...',
        '..bcccdcded55h665e....',
        '..bcdcd3BBB5h44BB4....',
        '..bcdc333BBB54BB44....',
        '..bcb4332LE353EL34....',
        '..ab42344544544453....',
        '...312344454564453....',
        '...222t344tn2nt443....',
        '....12tu3uMMMMut32....',
        '....12tututuvuutu2....',
        '.....12tutuvvuttu1....',
        '......12ttuutut21.....',
        'rswjki1221111111ikjwsr',
        'swxkjiiiiiiiiiiiijkxws',
        'wxxwkjiiiiiiiiiijkwxxw',
        'wxxxxhxxxxxxxxxxxhxxxw',
        'swwwwwwwwwwwwwwwwwwwws',
        'rswwwwwwwwwwwwwwwwwwsr',
        'qrsssswwwwwwwwwwssssrq',
        '.pqrrrrrrrrrrrrrrrrrrq',
    ];
    const DOWN = ['.'.repeat(22), ...FRONT.slice(0, 16), ...FRONT.slice(17)].map(r => r.replace('LE', 'LL').replace('EL', 'LL'));

    E.register({
        id: 'vance', name: 'Vance', role: 'The hard one', portrait: '../../../assets/crew/M_4.png',
        signature: 'Grey hair swept up in ragged spikes, one white lock, heavy dark brows over blue eyes, a stubbled square jaw. A worn white EVA suit with the big ring collar, brown gloves, a grey pack. Heavy, square, hands on his hips.',
        ramps: {
            suit: [INK, '#1e1f27', '#33353f', '#4d505b', '#6b6e79', '#8f919a', '#b3b4b6', '#cac8c1'],   // worn white shell, cool shadows
            dark: [INK, '#1b191d', '#2c282c', '#413a3b', '#594f4e'],                                    // seals, cuffs, kneepads
            glove: [INK, '#22171a', '#3a2925', '#573c32', '#765443', '#94705a'],                        // brown leather
            boot: [INK, '#191a1e', '#2b2c31', '#404147', '#5a5b61', '#76777c'],
            skin: [INK, '#43282a', '#74493f', '#a87560', '#cc9475', '#e3ae88'],
            hair: [INK, '#1f1f28', '#434755', '#5a5f6e', '#9a9fab', '#c2c5cd'],
            pack: [INK, '#1a1b22', '#2c2e37', '#42454f', '#5c5f69', '#7a7d86', '#999ba0'],               // the life-support pack, a step under the shell
            warm: [INK, '#3a1610', '#7a2e1a', '#c4552c', '#f08c4e'],
        },
        tex: { suit: 0.12, pack: 0.08, dark: 0.07, glove: 0.05, boot: 0.07, skin: 0.03, warm: 0 },
        build: { idle: 'hips', lift: 4, thigh: [6.2, 5.1], shin: [5.0, 4.2], foot: 2.8, toe: 5.4,
                 arm: [3.3, 3.0], fore: [3.0, 2.7], hand: 2.4, upper: 15.5, lower: 14,
                 pelvis: [7.8, 6, 6], waist: [7.4, 6.8, 6], chest: [9.4, 10.6, 7.6], pack: true,
                 sh: [4.4, 4], shX: [-5.8, 6.4], shY: -28, neckY: -30, chestY: -21, waistY: -9.5, stanceX: [-5, 4], backW: 9.5 },
        materials: {
            leg: t => (t > 0.62 ? 'boot' : 'suit'),
            forearm: t => (t > 0.84 ? 'dark' : 'suit'),                              // the dark cuff ring
            waist: (u, v) => (Math.abs(v - 3) < 1.1 ? 'dark' : 'suit'),               // the waist seal
            hand: 'glove', pack: 'pack',
        },
        heads: {
            front: {
                anchor: [11, 21],
                keys: {
                    a: '#1f1f28', b: '#2f313d', c: '#434755', d: '#5a5f6e', e: '#787d8c', f: '#9a9fab', g: '#c2c5cd', h: '#eceef2',
                    1: '#43282a', 2: '#74493f', 3: '#a87560', 4: '#cc9475', 5: '#e3ae88', 6: '#f2c9a0',
                    t: '#8e7666', u: '#a68a78', v: '#b89a86', B: '#16121a', L: '#2a1a1c', E: '#4f8cc4', F: '#3e6688', m: '#8a5446', M: '#6a3a32', n: '#4e2c2a',
                    p: '#30313a', q: '#4f515b', r: '#767881', s: '#9c9ea3', w: '#c1c1bd', x: '#dcdbd4',
                    i: '#1a1620', j: '#2c2634', k: '#4a4252',
                },
                blink: { L: '#74493f', E: '#a87560', F: '#a87560' },
                map: FRONT,
            },
            down: { anchor: [11, 21], map: DOWN },        // console, tend, wall: the head tips forward into the ring, lids lowered
            back: {                                    // climb: the back of the hair, the nape, both ears, the ring from behind
                anchor: [11, 22],
                map: [
                    '......................',
                    '......e.fg.gf.f.......',
                    '.....deffgfggfeef.....',
                    '....cdefgfgfgfefed....',
                    '...cdefefgffefeedcb...',
                    '...cddeefefeeedecdb...',
                    '...bcdedeeefeedcdcb...',
                    '...bcddcdedcdedccbb...',
                    '...bccdcdcdcdcdcbba...',
                    '..3bbccddccdccdcba3...',
                    '..42bcbcdcbccbcbba24..',
                    '..32abbcbcbbcbcbaa23..',
                    '...2abbbbcbbbbbbaa2...',
                    '....1abcbbabbcbba1....',
                    '.....233232323321.....',
                    '.....123333333321.....',
                    '.qrsjk1233333321kjsrq.',
                    'qrsjkj1122222211jkjsrq',
                    'rswwwwwwxxxxxxxxwwwwsr',
                    'qswwwwwwwwxxxxwwwwwwsq',
                    'qrswwwwwwwwwwwwwwwwsrq',
                    'pqrsswwwwwwwwwwwwssrqp',
                    '.pqrssssssssssssssrqp.',
                    '..pqqrrrrrrrrrrrrqqp..',
                ],
            },
            lying: {                                   // sleep: on his back, the profile turned up, eyes shut, the ring on its side
                anchor: [21, 10],
                map: [
                    '................rssrqqp.',
                    '................sxwssrq.',
                    '...........5....wwwwwsrp',
                    '........5.56....ssswwwsq',
                    '.....566B455n5Mvkjjxwwsq',
                    '..gfg6653L443uMutkjxwwsr',
                    '.gfge55543444uuvujkxxwsr',
                    '.fgfd44444543uvutiixxwwr',
                    'fgeedc344544uvut1iixxwwr',
                    'gffecdc33443uut11iixxwwr',
                    'eedddc34344uut111iixxwwr',
                    'feedcd32343tt1221iixxwwr',
                    'eddccc2133tt12221iixxwwr',
                    'deccbcc323211222111xxwwr',
                    'ccddcbccc211122222ixwwsr',
                    'ddccbcbcb1jjjjjj21ixwwsr',
                    '.cbbbbbba1jjjjjj1jixwwsr',
                    '.bbbabbb........kkkwwwsq',
                    '..aaaaaa........jiiwwsrq',
                    '...aaaa.........sjjwwrqp',
                    '................rssssqp.',
                    '................qrqrqp..',
                ],
            },
        },
        decorate(api, P) {
            const R = api.ramps, b = P.build;
            for (const L of P.legs) {                                                // grey knee joints, lit like the suit
                const kx = L.knee.x + (P.view === 'side' ? 1.2 : 0), ky = L.knee.y;
                for (let y = Math.floor(ky - 3); y <= ky + 3; y++) for (let x = Math.floor(kx - 3); x <= kx + 3; x++) {
                    const q = ((x + 0.5 - kx) / 2.6) ** 2 + ((y + 0.5 - ky) / 2.8) ** 2;
                    if (q <= 1 && api.part(x, y) === L.part) api.paint(x, y, q > 0.55 ? 'dark' : 'pack', q > 0.55 ? 1 : 0);
                }
            }
            for (const A of P.arms) {                                                // the shoulder bearing: a dark ring round the upper arm
                const dx = A.el.x - A.s.x, dy = A.el.y - A.s.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
                const at = P.view === 'side' ? 0.34 : 0.3, ox = A.s.x + dx * at, oy = A.s.y + dy * at;
                for (let k = -b.arm[0] - 1; k <= b.arm[0] + 1; k += 0.5) {
                    const x = Math.floor(ox - uy * k), y = Math.floor(oy + ux * k);
                    if (api.part(x, y) === A.part) api.paint(x, y, 'dark', 1);
                }
            }
            if (P.view === 'back') {                                                 // climbing: the pack from behind, with its one amber light
                const cx = Math.round(P.hip.x), cy = Math.round(P.up(-19).y);
                for (let x = cx - 6; x <= cx + 6; x++) if (api.part(x, cy + 1) === 'torso') api.paint(x, cy + 1, 'dark', 1);
                for (const vx of [cx - 3, cx - 1, cx + 1, cx + 3]) if (api.part(vx, cy + 5) === 'torso') api.paint(vx, cy + 5, 'dark', 0);
                if (api.part(cx + 4, cy - 5) === 'torso') api.set(cx + 4, cy - 5, R.warm[3]);
                return;
            }
            const c = P.up(b.chestY + 2), cx = Math.round(c.x + 4), cy = Math.round(c.y);  // the chest box: one warm light, one cyan
            for (let y = cy - 2; y <= cy + 1; y++) for (let x = cx - 2; x <= cx + 2; x++) {
                if (api.part(x, y) === 'torso') api.set(x, y, y === cy - 2 ? R.suit[5] : x === cx + 2 ? R.dark[4] : R.dark[2]);
            }
            if (api.part(cx - 1, cy - 1) === 'torso') api.set(cx - 1, cy - 1, R.warm[3]);
            if (api.part(cx + 1, cy - 1) === 'torso') api.set(cx + 1, cy - 1, '#6fb8c8');
            const top = P.up(-27), bot = P.up(-12);                                  // a seam down the suit front
            for (let y = Math.round(top.y); y <= Math.round(bot.y); y++) {
                const x = Math.round(api.lerp(top.x, bot.x, (y - top.y) / (bot.y - top.y)) + 1.5);
                if (api.part(x, y) === 'torso' && api.get(x, y) && Math.abs(x - cx) > 2) api.set(x, y, api.mix(api.get(x, y), api.INK, 0.35));
            }
        },
    });
})(CrewEngine);
