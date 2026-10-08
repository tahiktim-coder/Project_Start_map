/* JAXON, engineer. Portrait: assets/crew/M_2.png.
   Read at a glance: near-black hair slicked straight back with clear grey at the temples, a high forehead, calm level
   brows over steady blue-grey eyes, a straight nose, a firm closed mouth, a square jaw with short dark stubble, and a
   little amber warmth on the lit side of the face. A dark work jacket with a standing collar over brown work trousers
   and a tool belt. Heavy, arms crossed.
   Heads (redrawn 2026-10-08 in the construction of Aris and Vance, the approved set: the portrait is a profile, but at
   15 pixels a profile read as a beak and a nub nose, so he faces the camera in three-quarter like them). Revised the
   same day: the stubble stops at the jawline and the neck is mid skin (it read as a beard to the collar), the skin a
   step lighter, the hair a charcoal that holds against the dark with a sheen strand and grey on both temples, and his
   own face (brows straight over the eyes, a longer nose, a squarer jaw). Views: front, down (brows shortened, the lash
   line a row lower, the head into the collar), back (combed lines to the nape, grey over both ears), lying (a true
   profile turned face up, drawn upright and turned in code, with the front's collar). */
(function (E) {
    const INK = E.INK;
    const KEYS = {
        // hair: charcoal near-black, slicked back, a grey-blue sheen; f the bright strand; g h the grey at the temples
        a: '#161b21', b: '#21272e', c: '#2b323a', d: '#38414a', e: '#4f5b66', f: '#7a8a97', g: '#80878d', h: '#b0b5b8',
        // skin, tanned, lit from the front: 1 the jaw shadow … 6 the light on the nose; o the amber warmth on the lit edge
        1: '#4a2818', 2: '#77432c', 3: '#9e6243', 4: '#bb7d55', 5: '#d39769', 6: '#e8b282', o: '#e3954c',
        // the face: brows (V the softer one asleep), blue-grey eyes with a dark pupil, the lash line (down, asleep), the mouth, a lip light
        B: '#1e1410', V: '#5a3424', E: '#7f9fb4', P: '#120c0c', L: '#3a2216', M: '#5a2e20', l: '#c08664',
        // short stubble: the skin a shade darker and cooler, on the jaw and chin only
        t: '#8a5a40', u: '#a46e4e', v: '#b6805c',
        // the jacket's standing collar, from the suit ramp
        q: '#13181c', Q: '#1d2328', J: '#283037', K: '#353e46', W: '#47515a',
    };
    const BLINK = { E: '#77432c', P: '#77432c' };              // shut: both eye pixels become one lid line
    // three-quarter, facing right, lit from the front, built like Vance's head (the same eye, nose and mouth columns,
    // 13 wide at the eyes) but his own man: the crown a row higher, the hair slicked straight back with volume over the
    // forehead and one grey-blue sheen strand, a high forehead, grey on both temples; the brows 1 px and dead level
    // straight over the eyes (no lid row), blue-grey eyes (iris + dark pupil), no shadow under them; a longer straight
    // nose, its lit tip a row lower, the shadow under it; a firm 3-px mouth with a lip light under it; a square jaw a
    // little wider than Vance's that narrows a pixel each side twice, with short stubble on the jaw and chin that stops at the jawline. The amber
    // edge on the lit side, five pixels. Then the jacket's standing collar, the neck in a V in mid skin. Anchor [11, 21]:
    // the foot of the collar.
    const FRONT = [
        '..........bccb........',
        '........bcdeedcb......',
        '......bcdeffeddcc.....',
        '.....bcfeedddddcc.....',
        '....bgedc4555554gc....',
        '....ghgc4555555hg.....',
        '....hg34455555554g....',
        '....gg3BBB454BBBo.....',
        '....4234EP455EP5o.....',
        '....413444355445o.....',
        '....323445356455o.....',
        '....323344356644o.....',
        '.....234444223454.....',
        '......3444MMM4443.....',
        '......t4u44lu4t2......',
        '......1tuvutvut1......',
        '.......12tttt21.......',
        '.....qQJ2333332JQq....',
        '...qQJJJQ23332QJJJKq..',
        '.qQJJJJJJQ232QJJJJKWq.',
        'qQJJJJJJJJQ2QJJJJJKWWq',
        'qQJJJJJJJJJQJJJJJJKWWq',
    ];
    // looking down (console, tend, wall): the head tips forward a row into the collar; the brows shorten to 2 px and the
    // lash line drops a row below them, with lid skin between, so brow and lid don't stack into a squint
    const DOWN_ROWS = {
        7: '....gg3BB44544BBo.....',
        8: '....423433455335o.....',
        9: '....4134LL355LL5o.....',
    };
    const DOWN = ['.'.repeat(22), ...FRONT.slice(0, 17).map((r, i) => DOWN_ROWS[i] || r), ...FRONT.slice(18)];
    // climbing, from behind: the same skull a row taller, the combed lines running straight back to a point at the nape,
    // a sheen on the crown, grey over both ears, the ears with lit rims, the collar from behind
    const BACK = [
        '.........bccb.........',
        '.......bcdeedcb.......',
        '......bcdeffedcb......',
        '.....bcdcdeedcdcb.....',
        '....bcdcdeedcdcdcb....',
        '....bcdcdedccdcdcb....',
        '....gcdcdcdccdcdcg....',
        '....hgdcdcdccdcdgh....',
        '...3hgdcdcdccdcdgh3...',
        '...42gcdcdcbcdcdg24...',
        '...42bcdcdbcdcdcb24...',
        '...31bbcdcbcdcdbb13...',
        '....2bbcdcbbcdcbb2....',
        '.....1bbcdbbdcbb1.....',
        '......2bbcbbcbb2......',
        '......21bbbbbb12......',
        '......2332bb2332......',
        '.....qQJ2333332JQq....',
        '...qQJJJJQQQQQJJJJQq..',
        '.qQJJJJJJJJJJJJJJJJJQq',
        'qQJJJJJJJJJJJJJJJJJKWq',
        'qQJJJJJJJJJJJJJJJJJKWq',
    ];
    // asleep: a true profile, drawn here upright and facing right, then turned face up with the crown to the left (as the
    // engine turns the body). The slicked hair lies flat back off a high forehead, its sheen strand and the grey temple
    // in front of the ear; a soft level brow, a row of lid, the shut eye's lash line; a long straight nose to a lit tip; a closed
    // mouth; a square chin with short stubble; the ear at mid-head. The collar is the front's, turned with it.
    const UPRIGHT = [
        '......................',
        '..........bccccb......',
        '........bcdeeedcc.....',
        '.......bcdeedddcdc45..',
        '......bcdeddcdcdcg455.',
        '......bcddcdcdcdg3455.',
        '......bcdcdcdcdgh3VV5.',
        '......bcdcdcdghg34445.',
        '......bcdcd343g344LL4.',
        '......bcdcd41334444555',
        '.......bcdc42334444455',
        '........23333234444266',
        '........2333324444435.',
        '........2333332t444MM.',
        '.........2333332tut4l.',
        '.........23333332tut4.',
    ].concat(FRONT.slice(17));
    const LYING = {
        anchor: [20, 10], blink: {},
        map: Array.from({ length: 22 }, (_, y) => UPRIGHT.map(r => r[21 - y]).join('')),
    };
    E.register({
        id: 'jaxon', name: 'Jaxon', role: 'Engineer', portrait: '../../../assets/crew/M_2.png',
        signature: 'Near-black hair slicked back, grey at the temples; calm level brows over blue-grey eyes, a straight nose, a square stubbled jaw, a little amber light on the lit side. Dark work jacket, tool belt. Heavy, arms crossed.',
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
        heads: {
            front: { anchor: [11, 21], keys: KEYS, map: FRONT, blink: BLINK },
            down: { anchor: [11, 21], map: DOWN },
            back: { anchor: [11, 21], map: BACK },
            lying: LYING,
        },
    });
})(CrewEngine);
