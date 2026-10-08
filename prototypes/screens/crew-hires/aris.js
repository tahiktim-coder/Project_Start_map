/* ARIS, doctor. Portrait: assets/crew/F_3.png.
   Read at a glance: a maroon flight helmet with cream goggles pushed up and a cream ear cup; blue-black hair with magenta
   lights, loose and flying out behind; the warmest face aboard, smiling; a padded suit with rust-orange panels on the
   shoulders, arms and knees, cream cuffs, and a white medic band on the arm. */
(function (E) {
    const INK = E.INK;
    const KEYS = {
        // helmet shell (maroon-purple) with a hard sheen, the goggles and the ear cup (cream), amber lenses with a glass
        // highlight
        p: '#2a0c22', q: '#4a1430', r: '#6e1a3a', s: '#962a46', S: '#c4506a',
        k: '#3a2c28', l: '#6e5a48', m: '#a8906a', n: '#d3b374', N: '#eedc9c', O: '#7a3a14', o: '#c8701e', A: '#ffe0a0',
        // hair: blue-black with magenta lights
        a: '#0e0418', b: '#1f0f32', c: '#3a1442', d: '#8a2474', e: '#d04aa6',
        // skin, warm, lit from the front: 1 the jaw shadow … 6 the light on the cheek and the nose; h the blush
        1: '#5a1c24', 2: '#8a3a34', 3: '#b85a44', 4: '#d8784c', 5: '#e8995a', 6: '#f6c280', h: '#d86a52',
        // the face: brows, the lash line, a warm brown iris with a light catch, the smile
        B: '#2e0e24', V: '#7a3436', L: '#1a0610', I: '#8a4020', P: '#1a0608', G: '#ffe6c0', w: '#f0c8a8', M: '#7a1a26', R: '#c84a4a', T: '#f6dcc4', Q: '#a8343e',
        // the ring collar: blue-violet
        x: '#16142e', y: '#2a2656', z: '#4a4488', Z: '#8078c8',
    };
    // shut: the lid comes down over the iris, the lashes rest where the eye was
    const BLINK = { L: '#b85a44', I: '#b85a44', P: '#1a0610', G: '#1a0610', w: '#1a0610' };
    // three-quarter, facing right. The helmet dome (a sheen on the shell so it reads hard, not knitted) with the goggles
    // pushed up on its brow: two 3 x 2 amber lenses, each with a pale glass highlight, split by dark rims (the old 1-px
    // lenses on a tan strip read as a tiara). The fringe swept across the forehead, the cream ear cup at the back of the
    // head, the hair in clumps flying out behind. The face: soft level brows a row above the eyes; each eye a lash line
    // over a brown iris, a dark pupil and a light catch; the nose from between the eyes down to a lit tip; one blush
    // pixel per cheek; the smile, a dark-rose line with both corners lifted a row over a glimpse of teeth; the chin
    // rounded by cutting its bottom corners. Anchor [12, 19]: the foot of the ring.
    const FRONT = [
        '..........pqrrqp....',
        '........pqrrsSrrqp..',
        '.......pqrssssSsrq..',
        '......pqkAoOkkAoOk..',
        '.....apqmoOOmmoOOm..',
        '....abcbbcddecbdeb6.',
        '...abcebcc4VBB55BV4.',
        '..abdcbmnc345556554.',
        '.abdcbmNnc4LIL56LI4.',
        'abcecbkmkb4wPG56PG4.',
        '.adebacbcb345543654.',
        '.bd.acbacb2h45542h3.',
        '...bdabbcb2345QTTQ3.',
        '.....cd.ab12344MM4..',
        '.......de...234h4...',
        '........d....233....',
        '.......xyzzZZZZzzyx.',
        '......xyzZZyyyyyZZzx',
        '......xyzzyxxxxxyzzx',
        '.......xyyzzzzzzyyx.',
    ];
    // looking down (console, tend, wall): everything above the ring drops a row, the lids come down, the iris looks down
    const DOWN = ['.'.repeat(20), ...FRONT.slice(0, 15), ...FRONT.slice(16)]
        .map(r => r.replace('4LIL56LI4', '433356334').replace('4wPG56PG4', '4LIL56LI4'));
    // climbing, from behind: the dome, the goggle strap across the back, the hair loose to the collar in clumps that sway
    // to the left, lit magenta near the crown and darker toward the nape (no ear cups here: a cream one on each side read
    // as earmuffs)
    const BACK = [
        '.....pqrrqp.....',
        '...pqrrssrrqp...',
        '..pqrrsssrrrqp..',
        '..pqrrrssrrrqp..',
        '..klmmnnnnmmlk..',
        '.pqrrrrrrrrrrqp.',
        'bcpqrrrrrrrrqpcb',
        'cdkbccdcccdcbkdc',
        'bckcdecbcdecckcb',
        '.bcdcbacdccbccb.',
        'bcdcbabcdcbcbcba',
        'cdcbabcdcbabcba.',
        'dcba.bccba.bba..',
        'cba..abcb..ab...',
        'ea....ba....a...',
        '..xyzzZZZZzzyx..',
        '.xyzZZyyyyZZzyx.',
        '.xyzzyyyyyyzzyx.',
        '..xyyzzzzzzyyx..',
    ];
    // asleep: the helmet off, face up in profile, crown to the left. Forehead, brow, the closed eye's lash line, a small
    // nose at eye height, lips, chin, the ear at mid-head, the hair loose on the pillow. The ring is the front's, turned.
    const RING = FRONT.slice(16);
    const LYING_HEAD = [
        '...........5......',
        '..........563.....',
        '....555564554RMR4.',
        '..cc455BB555543432',
        '.bec44444LLh544321',
        '.cbb3445555h543211',
        'bbbdc3445444432112',
        'bdcbbb344344332122',
        'cbbbdcbbb243321122',
        'aadcaaadc232211222',
        '.baaacbaaac1112221',
        '..acbaaacbaaa11111',
        '...aaacbaaacb..11.',
        '.ab.bcdabcbda.....',
        '..b.dab.adb.......',
        '...d...e....d.....',
    ];
    const LYING = {
        anchor: [21, 7], blink: {},
        map: LYING_HEAD.map((row, Y) => row + RING.map(r => (Y < 20 ? r[19 - Y] : '.')).join('')),
    };

    E.register({
        id: 'aris', name: 'Aris', role: 'Doctor', portrait: '../../../assets/crew/F_3.png',
        signature: 'Maroon flight helmet with cream goggles pushed up and a cream ear cup; blue-black hair with magenta lights, loose and flying; the warmest face, smiling; padded suit with rust-orange panels and a white medic band.',
        ramps: {
            suit: [INK, '#2c2420', '#4a3e34', '#6e6050', '#94846c', '#b8a688', '#d2c2a0', '#e4d6b8'],     // warm cream padding
            navy: [INK, '#141222', '#1e1a30', '#2a2440', '#363050', '#443c5e'],                          // the undersuit at the joints
            rust: [INK, '#3a140c', '#62200f', '#8c3218', '#b44a22', '#d66832', '#f09050'],     // the padded panels
            band: [INK, '#120d1a', '#1e1729', '#2c2238', '#3a2e48'],                          // belt, plum
            boot: [INK, '#141018', '#221c28', '#322a3a', '#463c50'],
            skin: [INK, '#3a0c1c', '#7a2234', '#b04a40', '#d8784c', '#e8995a', '#f4bc78'],
            hair: [INK, '#0e0418', '#1f0f32', '#3a1442', '#6e1a5a', '#b02a84', '#e055b0'],
            cream: [INK, '#3a2c28', '#6e5a48', '#a8906a', '#d3b374', '#eedc9c'],
        },
        tex: { suit: 0.07, navy: 0.06, rust: 0.06, band: 0.03, boot: 0.05, skin: 0.03, cream: 0 },
        build: { idle: 'behind', lift: 5, thigh: [3.9, 2.9], shin: [2.8, 2.0], foot: 1.7, toe: 4.3, arm: [2.4, 2.0], fore: [1.9, 1.5], hand: 1.6,
                 upper: 14.5, lower: 13, pelvis: [6.2, 5.6, 5.2], waist: [5, 5.8, 4.6], chest: [6.8, 8.8, 5.8], sh: [3.7, 3.3],
                 shX: [-3.8, 4.6], shY: -25.5, neckY: -27, chestY: -18.5, waistY: -9, stanceX: [-1.5, 4], backW: 8, bust: true },
        materials: {
            shoulder: 'rust',
            arm: t => (t < 0.62 ? 'rust' : t < 0.8 ? 'suit' : 'navy'),               // rust upper arm, navy at the elbow
            forearm: t => (t < 0.14 ? 'navy' : t > 0.86 ? 'cream' : 'suit'),
            chest: (u, v) => (v < -2.5 ? 'rust' : 'suit'),                           // the padded yoke
            thigh: t => (t > 0.12 && t < 0.72 ? 'rust' : 'suit'),                    // rust thigh panels
            leg: t => (t > 0.6 ? 'boot' : 'suit'),
            hand: 'skin',
        },
        heads: {
            front: { anchor: [12, 19], keys: KEYS, map: FRONT, blink: BLINK },
            down: { anchor: [12, 19], map: DOWN },
            back: { anchor: [8, 18], map: BACK },
            lying: LYING,
        },
        decorate(api, P) {
            const R = api.ramps;
            // knee pads, rust, lit like the suit
            for (const L of P.legs) {
                const kx = L.knee.x + (P.view === 'side' ? 1 : 0), ky = L.knee.y;
                for (let y = Math.floor(ky - 3); y <= ky + 3; y++) for (let x = Math.floor(kx - 3); x <= kx + 3; x++) {
                    if (((x + 0.5 - kx) / 2.4) ** 2 + ((y + 0.5 - ky) / 2.8) ** 2 <= 1 && api.part(x, y) === L.part) api.paint(x, y, 'rust');
                }
            }
            // the belt, and a cream buckle on the side view
            const w = P.up(-5), wy = Math.round(w.y);
            for (let x = 0; x < api.W; x++) if (api.part(x, wy) === 'torso') api.paint(x, wy, 'band');
            if (P.view === 'side') { const bx = Math.round(w.x + 3); if (api.part(bx, wy) === 'torso') api.set(bx, wy, R.cream[4]); }
            // the medic band: white around the near upper arm
            const arm = P.arms && P.arms[0];
            if (arm && P.view === 'side') {
                const ax = arm.el.x - arm.s.x, ay = arm.el.y - arm.s.y, len = Math.hypot(ax, ay) || 1, ux = ax / len, uy = ay / len;
                const cx = arm.s.x + ax * 0.45, cy = arm.s.y + ay * 0.45;
                for (let y = Math.floor(cy - 4); y <= cy + 4; y++) for (let x = Math.floor(cx - 4); x <= cx + 4; x++) {
                    if (api.part(x, y) !== arm.part) continue;
                    const t = (x + 0.5 - cx) * ux + (y + 0.5 - cy) * uy;
                    if (Math.abs(t) < 1.1) api.paint(x, y, 'cream', 1);
                }
            }
            // walking, the trailing clumps lift a row on the up-step (whole clumps, never loose pixels)
            if ((P.action === 'walk' || P.action === 'carry') && P.view === 'side' && P.frame % 4 < 2) {
                const nx = P.neck.x, ny = P.neck.y;
                [[-12, -11], [-11, -11], [-13, -9], [-12, -9]].forEach(([dx, dy]) => { if (!api.get(nx + dx, ny + dy)) api.set(nx + dx, ny + dy, dy === -11 ? R.hair[5] : R.hair[2]); });
            }
            // quilting: a darker stitch line every third row across the padded panels
            const rust = new Set(R.rust);
            for (let y = 0; y < api.H; y++) for (let x = 0; x < api.W; x++) {
                if ((y + (P.view === 'side' ? 0 : 1)) % 3 === 0 && rust.has(api.get(x, y))) api.paint(x, y, 'rust', -1);
            }
        },
    });
})(CrewEngine);
