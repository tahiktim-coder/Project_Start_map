/* JAXON, engineer. Portrait: assets/crew/M_2.png.
   Read at a glance: a near-profile head with a strong nose and a square stubbled jaw; dark hair slicked straight back,
   grey streaks at the temple above a big ear; a heavy dark brow; amber light catching his brow and nose, as in the
   portrait. A dark work jacket with a standing collar over brown work trousers and a tool belt. Heavy, arms
   crossed, head carried a little forward. */
(function (E) {
    const INK = E.INK;
    // the head, redrawn 2026-10-08 against the portrait (the old one read as a beak, then as a chin strap and a muzzle):
    // a true side profile turned a touch toward us. Near-black hair slicked straight back with grey strands over the
    // temple and in the short sideburn, a high forehead, a level heavy brow on the lit brow ridge, a deep-set eye (dark
    // pupil, blue-grey catch), a straight nose that starts at eye height, a lit upper lip over a short level mouth line,
    // stubble only below it, a square chin, the ear at mid-head. The side of the face sits in shade behind the cheekbone,
    // and the jaw is only the edge between the face and the neck's shade, no dark line. The lit front edge is skin;
    // amber only on the brow ridge and the bridge of the nose, dark rust on the forelock and the chin; the lamp adds
    // the rest. 15 rows from crown to chin. Anchor [6, 19]: the collar's foot.
    const KEYS = {
        a: '#0a0e12', b: '#121a20', c: '#1b242b', d: '#2a353d', g: '#4e585f', h: '#7d878e', i: '#a9b1b5',
        1: '#3a1e12', 2: '#5e3520', 3: '#7a4a30', 4: '#93583a', 5: '#a5643f', 6: '#bd7849',
        r: '#9a3c14', o: '#e0761e', y: '#ffb52e', B: '#1c0f0a', K: '#140c0a', E: '#8fb0c4', n: '#3a1a10', m: '#5c2a1a',
        s: '#6a5446', t: '#83674f', q: '#13181c', Q: '#1d2328', J: '#283037', L: '#3a434b',
    };
    const BLINK = { K: '#4a2618', E: '#93583a' };          // shut: the pupil becomes the lid crease, the catch is skin
    const COLLAR = [
        '..qQQq2332qq........',
        '.qQJQQq22qQJq.......',
        '.qLJJQQqqQJJJQq.....',
        '.qLJJJJQQJJJJLQq....',
        'qQQJJJJJJJJJJJQQq...',
    ];
    const pad = r => r.padEnd(20, '.');
    const FRONT = [
        '......abbcb......',         // crown, slicked straight back
        '....abccdcdcb....',
        '..abccdcgdcdcbr..',         // the forelock, its front catching the lamp
        '.abcdcgdhgdcc56..',         // the hairline climbs back off a high forehead; grey strands swept back
        '.abcdhgdgdc34556.',
        '.abcghdgg3445566.',         // grey over the temple
        '.abc343g334BBB6o.',         // the ear's top under the grey; a level heavy brow on the lit brow ridge
        '.abc423g334KE456.',         // the eye, set back under the brow; the nose starts here, at eye height
        '.abc413g3455456o.',         // the ear's bowl; the lit cheekbone; the bridge of the nose
        '.abc4233344435566',         // the side of the face in shade; the nose's wing and tip
        '.ab2243233444453.',         // the ear lobe; the shade under the nose
        '..1222223344456..',         // the lit upper lip
        '..1222222334nm4..',         // the mouth: a short level dark line, the lips closed at the edge
        '...12222223sts45.',         // the lower lip; stubble only below the mouth
        '...1222222ststr..',         // the square chin; the neck in shade behind the jaw
    ].map(pad).concat(COLLAR);
    // looking down (console, tend, wall): the head drops a row into the collar, the lid comes down over the catch
    const DOWN = ['.'.repeat(20), ...FRONT.slice(0, 15), ...FRONT.slice(16)].map(r => r.replace('KE', 'K3'));
    // climbing, from behind: the same skull, as wide as it is deep. Dark hair combed straight back in lines, a sheen on
    // the crown from the light above, grey over both ears, the ears standing out with lit rims, the hair tapering to a
    // soft point at the nape (not cut straight across, which read as a cap), a thick neck, the collar
    const BACK = [
        '......abbbbba......',
        '....abcdcgcdcba....',
        '...abdcgchcgcdba...',
        '..abcdcgcgcgcdcba..',
        '..bdccdccgcddcdcb..',
        '..bgcdcdccdcdccgb..',
        '.3ghcdcdcdcdcdchg3.',
        '.43gbdccdcdcdcbg34.',
        '.42gbcdcdcdccdbg24.',
        '.42abdcbcdcbcdba24.',
        '.32abbcbcbcbcbba23.',
        '..2aabcbcbcbcbaa2..',
        '...1aabcbcbcbaa1...',
        '....21abbcbba12....',
        '.....231aaa132.....',
        '....qQ2333332Qq....',
        '..qQQq1222221qQQq..',
        '.qQJQQq11111qQQJQq.',
        '.qLJJJQQQQQQQJJJLQq',
        'qQQJJJJJJJJJJJJJQQq',
    ];
    // asleep: the profile above turned to lie face up and redrawn for it: crown to the left, the back of the head on the
    // pillow, forehead, brow, nose, lips and chin along the top. The eye is shut to a 2-pixel lid line with skin between
    // it and a shorter brow, so the two don't merge into one dark slot. The amber stays only on the brow ridge and the
    // nose; on the forelock and the chin it read, turned on its side, as a fringe of orange spikes along the head.
    const LYING = {
        anchor: [19, 13],
        map: [
            '....................',
            '....................',
            '....................',
            '.........6.........q',
            '....66o6o63.......qQ',
            '..c656656556m4s..qQQ',
            '..b5553455454st..QLJ',
            '.bcc453n43443ts.qJJJ',
            '.cdc344n54444stqJJJJ',
            'bdcdc444544433sqQJJJ',
            'ccdgd33344333222qQJJ',
            'bdghgg33333322232qQJ',
            'bccddgggg32222232qQJ',
            'acdggd3333322222qQJJ',
            '.bcchh421242222qQQJJ',
            '.acddg344422222QQJJJ',
            '..bccccccc22211QJJJJ',
            '..abbbbbbbb11..qQLLQ',
            '...aaaaaaaa.....qqqQ',
            '...................q',
        ],
    };
    E.register({
        id: 'jaxon', name: 'Jaxon', role: 'Engineer', portrait: '../../../assets/crew/M_2.png',
        signature: 'Dark hair slicked back, grey at the temple; strong nose and stubbled jaw in near profile; amber light down the front of his face. Dark work jacket, tool belt. Heavy, arms crossed.',
        ramps: {
            suit:  [INK, '#13181c', '#1d2328', '#283037', '#353e46', '#47515a', '#5e6972'],
            pant:  [INK, '#16130f', '#221d18', '#302921', '#40372c', '#544838'],
            boot:  [INK, '#120d0a', '#21170f', '#322317', '#463222', '#5c4330'],
            cuff:  [INK, '#0e1215', '#171c20', '#22282d', '#2e353b'],
            skin:  [INK, '#3a1e12', '#5e3520', '#7a4a30', '#93583a', '#a5643f', '#bd7849'],
            hair:  [INK, '#0a0e12', '#121a20', '#1b242b', '#2a353d', '#4e585f'],
            amber: [INK, '#3a1a08', '#8f2a12', '#c4561c', '#e0761e', '#ffb52e'],
        },
        tex: { suit: 0.1, pant: 0.08, boot: 0.06, cuff: 0.04, skin: 0.03, amber: 0 },
        build: { idle: 'crossed', lift: 4, thigh: [4.8, 3.8], shin: [3.6, 2.8], foot: 2.1, toe: 4.8,
                 arm: [3.5, 3.0], fore: [3.1, 2.5], hand: 2.3, upper: 15.5, lower: 14,
                 pelvis: [7.2, 6, 6.2], waist: [7.2, 6.6, 6.2], chest: [9.6, 10.6, 7.8], sh: [4.7, 4.2], shX: [-5.9, 6.1],
                 shY: -27.5, neckY: -29.5, chestY: -20.5, waistY: -9.4, stanceX: [-4.5, 3.5], backW: 10.2 },
        materials: {
            thigh: 'pant',
            leg: t => (t > 0.62 ? 'boot' : 'pant'),
            pelvis: 'pant',                                                          // a short work jacket: trousers from the belt down
            forearm: t => (t > 0.86 ? 'cuff' : 'suit'),
            hand: 'skin',
        },
        decorate(api, P) {
            const R = api.ramps, b = P.build, on = (x, y, part) => api.part(x, y) === part;
            // the belt below the jacket hem, and its buckle
            const w = P.up(-1.6), wy = Math.round(w.y);
            for (let x = 0; x < api.W; x++) if (on(x, wy, 'torso')) api.set(x, wy, x % 3 ? R.boot[2] : R.boot[1]);
            if (P.view !== 'side') return;
            const front = x0 => { let x = x0; while (x < api.W - 1 && on(x + 1, wy, 'torso')) x++; return x; };
            const fx = front(Math.round(w.x));
            if (on(fx - 1, wy, 'torso')) { api.set(fx - 1, wy, '#7a6a52'); api.set(fx - 2, wy, R.boot[3]); }
            // a leather tool pouch on the near hip, flap lit, a wrench handle out of the top
            const px = Math.round(w.x - 3), py = wy + 1;
            for (let y = py; y < py + 5; y++) for (let x = px - 1; x <= px + 2; x++) {
                if (!api.get(x, y)) continue;
                api.set(x, y, y === py ? R.boot[4] : x === px + 2 ? R.boot[3] : x === px - 1 ? R.boot[1] : R.boot[2]);
            }
            if (api.get(px, py - 1)) api.set(px, py - 1, '#59626a');
            // a cargo pocket on the near thigh, its flap catching the light
            const L = P.legs[0], kx = api.lerp(L.h.x, L.knee.x, 0.55), ky = api.lerp(L.h.y, L.knee.y, 0.55);
            const qx = Math.round(kx - 1), qy = Math.round(ky - 2);
            for (let y = qy; y < qy + 5; y++) for (let x = qx; x < qx + 3; x++) {
                if (!on(x, y, L.part)) continue;
                if (y === qy) api.paint(x, y, 'pant', 1);
                else if (y === qy + 1 || x === qx + 2) api.set(x, y, api.mix(api.get(x, y), api.INK, 0.35));
            }
            // the zip down the jacket front and a chest pocket with a small amber work light clipped to it
            const top = P.up(b.neckY + 3), bot = P.up(-2.5);
            for (let y = Math.round(top.y); y < Math.round(bot.y); y++) {
                const t = (y - top.y) / (bot.y - top.y), x = Math.round(api.lerp(top.x, bot.x, t) + b.chest[0] * (1 - t * 0.35) - 2.5);
                if (on(x, y, 'torso')) api.set(x, y, api.mix(api.get(x, y), api.INK, 0.4));
            }
            const c = P.up(b.chestY - 2.5), cx = Math.round(c.x + b.chest[0] - 6), cy = Math.round(c.y);
            for (let y = cy; y < cy + 4; y++) for (let x = cx; x < cx + 3; x++) {
                if (!on(x, y, 'torso')) continue;
                if (y === cy) api.set(x, y, api.mix(api.get(x, y), '#8995a0', 0.25));
                else if (x === cx + 2 || y === cy + 3) api.set(x, y, api.mix(api.get(x, y), api.INK, 0.3));
            }
            if (on(cx + 1, cy - 1, 'torso')) { api.set(cx + 1, cy - 1, R.amber[5]); if (on(cx + 1, cy, 'torso')) api.set(cx + 1, cy, R.amber[3]); }
        },
        heads: { front: { anchor: [6, 19], keys: KEYS, map: FRONT, blink: BLINK }, down: { anchor: [6, 19], map: DOWN },
                 back: { anchor: [9, 19], map: BACK }, lying: LYING },
    });
})(CrewEngine);
