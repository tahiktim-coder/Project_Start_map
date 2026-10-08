/* ARIS, doctor. Portrait: assets/crew/F_3.png.
   Read at a glance: a maroon flight helmet with cream goggles pushed up and a cream ear cup; blue-black hair with magenta
   lights, loose and flying out behind; the warmest face aboard, smiling; a padded suit with rust-orange panels on the
   shoulders, arms and knees, cream cuffs, and a white medic band on the arm. */
(function (E) {
    const INK = E.INK;
    const KEYS = {
        // helmet shell (maroon-purple), the goggles and the ear cup (cream), two amber lenses
        p: '#2a0c22', q: '#4a1430', r: '#6e1a3a', s: '#962a46',
        k: '#3a2c28', l: '#6e5a48', m: '#a8906a', n: '#d3b374', N: '#eedc9c', O: '#7a3a14', A: '#ffb84a',
        // hair: blue-black with magenta lights
        a: '#0e0418', b: '#1f0f32', c: '#3a1442', d: '#8a2474', e: '#d04aa6',
        // skin, warm; raised cheeks catch the light
        1: '#5a1c24', 2: '#8a3a34', 3: '#b85a44', 4: '#d8784c', 5: '#e8995a', 6: '#f6c280',
        L: '#1a0610', E: '#4a1a10', w: '#e8c0a0', M: '#8a1c2c', R: '#c84848', W: '#f4d4b4',
        // the ring collar: blue-violet
        x: '#16142e', y: '#2a2656', z: '#4a4488', Z: '#8078c8',
    };
    // three-quarter, facing right. The cream ear cup on the near side, the goggles pushed up with two amber lenses, the
    // hair in four swept clumps trailing behind, the smile with its light pixel. Anchor [12, 18]: the foot of the ring.
    const FRONT = [
        '.........pqrrrrqp...',
        '.......pqrrssssrrq..',
        '......pqklmnnNnnmlk.',
        '......pqkOAmmOAmkrq.',
        '.....abpqrrrrrrrrrsq',
        '...abcdbqbd344545db.',
        '..abceabbc3LL45LL4c.',
        '.abdcbamnm3wE55Ew4c.',
        'abcecb.nkn46654664b.',
        '.adebacmnm35554554..',
        '.bd.acbad234M55M43..',
        '...bdab.ce234WW443..',
        '.....cd.ab234RR532..',
        '.......de.1234432...',
        '........d..12221....',
        '.......xyzzZZZZzzyx.',
        '......xyzZZyyyyyZZzx',
        '......xyzzyxxxxxyzzx',
        '.......xyyzzzzzzyyx.',
    ];
    // looking down (console, tend, wall): everything above the ring drops a row, lids lowered, the smile let go
    const DOWN = ['.'.repeat(20), ...FRONT.slice(0, 14), ...FRONT.slice(15)]
        .map(r => r.replace('wE', 'LL').replace('Ew', 'LL').replace('WW', 'MM'));
    // climbing, from behind: the dome, the goggle strap across the back, both ear cups, the hair loose to the collar
    const BACK = [
        '.....pqrrqp.....',
        '...pqrrssrrqp...',
        '..pqrrsssrrrqp..',
        '..pqrrrssrrrqp..',
        '..klmmnnnnmmlk..',
        '.pqrrrrrrrrrrqp.',
        'mnpqrrrrrrrrqpnm',
        'nNkbccbcbbcbbkNn',
        'mnkabcdbcbdcbknm',
        '.kbacbdacbadbak.',
        '.babcdabcabdcab.',
        'cbabdcabbacdbabc',
        'd.bacdbaabdcab.d',
        '.e.bcdab.bacdb.e',
        '..d.cd....dc.d..',
        '..xyzzZZZZzzyx..',
        '.xyzZZyyyyZZzyx.',
        '.xyzzyyyyyyzzyx.',
        '..xyyzzzzzzyyx..',
    ];
    // asleep: the helmet off, the hair loose on the pillow, eyes shut. Drawn standing, then turned to lie face up.
    const HAIR_FOR = { p: 'a', q: 'b', r: 'a', s: 'c', k: 'b', l: 'c', m: 'c', n: 'd', N: 'e', O: 'b', A: 'd' };
    const ASLEEP = FRONT.map(r => r.replace(/[pqrsklmnNOA]/g, ch => HAIR_FOR[ch]).replace('wE', 'LL').replace('Ew', 'LL').replace('WW', 'MM'));
    const turn = (map, anchor) => {                                // standing (x, y) → lying (y, w - 1 - x): crown left, face up
        const w = map[0].length, out = [];
        for (let Y = 0; Y < w; Y++) { let s = ''; for (let X = 0; X < map.length; X++) s += map[X][w - 1 - Y]; out.push(s); }
        return { anchor: [anchor[1], w - 1 - anchor[0]], map: out };
    };
    const LYING = turn(ASLEEP, [12, 18]);

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
            front: { anchor: [12, 18], keys: KEYS, map: FRONT, blink: { w: '#b85a44', E: '#1a0610' } },
            down: { anchor: [12, 18], map: DOWN },
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
