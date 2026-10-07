/* CORA — commander, the player. Reference costume: copy this file's shape for every other character.
   Portrait: assets/crew/F_1.png. Read at a glance: a silver-white bob with a heavy straight fringe, a black
   high-collar suit cut by one cyan seam, pale skin. Tall and straight; stands with her hands behind her back.
   Signature detail: the cyan line (collar, front seam, cuffs, one mark on the cheek).

   Map conventions (all maps face right; one character = one pixel; '.' = empty):
   - keys: char -> 'material:tone'. Tone 0 = shadow (the colour pulled toward the ink #05070a), 1 = mid, 2 = light,
     3 = highlight (hair only). Light comes from above and in front of the face, so top and front edges are lighter.
   - head.side / head.back / head.down: `anchor` [col,row] is the neck cell, placed one row above the shoulders.
     The last row is the collar. head.down (optional) is used when kneeling and facing the wall.
   - torso.side / torso.back: row 0 = shoulders, last row = hips (row -12). `spine` is the column over the hips;
     `squash` is the row dropped on an out-breath. Both views need the same number of rows. */
CrewSprites.register({
    id: 'cora',
    name: 'Cora',
    role: 'Commander',
    portrait: '../../assets/crew/F_1.png',
    signature: 'White bob with a straight fringe; black high-collar suit, cyan at the collar and cuffs.',
    idle: 'behind',
    palette: {
        hair: ['#45475f', '#8e93b3', '#c9cee6', '#f1f3ff'],   // silver-white, lavender in the shade
        skin: ['#6a4440', '#c4928a', '#f0c7b6'],              // pale, a little pink
        eye: ['#1f6670', '#3fb6c0', '#c9fdff'],              // teal, dark enough to read as an eye
        suit: ['#151a20', '#262f38', '#3d4a56'],              // black, lifted to slate so it reads in a dark room
        trim: ['#11585a', '#33cfc6', '#aefcf4'],              // the cyan line
        boot: ['#0c0f12', '#1b2229', '#2f3942'],
    },
    keys: {
        1: 'hair:0', 2: 'hair:1', 3: 'hair:2', 4: 'hair:3',
        k: 'skin:0', s: 'skin:1', S: 'skin:2', e: 'eye:0',
        b: 'suit:0', n: 'suit:1', N: 'suit:2',
        t: 'trim:0', c: 'trim:1', C: 'trim:2',
    },
    blink: ['e', 's'],                                       // closed eye: the eye pixel becomes skin
    head: {
        // Three-quarter view: the face turns toward the camera (as in the portrait), the body stays side-on.
        side: { anchor: [3, 6], map: [
            '..2332..',
            '.234432.',                                       // a band of sheen across the crown
            '12333332',                                       // the fringe: one straight edge, cut level with the brows
            '12seSeS2',                                       // two eyes under the fringe; the bob frames both sides
            '12sSSSs2',
            '.1ssSks1',                                       // mouth; the bob ends at the jaw
            '..bnnc..',                                       // high collar, cyan at the front
        ] },
        down: { anchor: [3, 6], map: [
            '..2332..',
            '.233432.',
            '12334432',
            '12333332',                                       // head bowed: the fringe hides the eyes
            '12sSSSs2',
            '.1ssSks1',
            '..bnnc..',
        ] },
        back: { anchor: [4, 6], map: [
            '..3443..',
            '.234432.',
            '23344332',
            '12333321',
            '12233221',
            '.112211.',
            '..bnnb..',
        ] },
    },
    torso: {
        side: { spine: 2, squash: 3, map: [
            '.nnNNN',                                         // shoulders
            'bnnNNt',                                         // a dim cyan seam down the front
            'bnnNNt',
            '.bnnNt',                                         // waist (dropped on an out-breath)
            '.bnnnt',
            'bbnnnn',                                         // hips
        ] },
        back: { spine: 3, squash: 3, map: [
            '.nnnnn.',
            'bnncnnb',
            'bnnnnnb',
            '.bnnnb.',
            '.bnnnb.',
            'bbnnnbb',
        ] },
    },
    limbs: { arm: 'suit', hand: 'skin', cuff: 'trim', leg: 'suit', foot: 'boot', rim: true },
    /** An example of extras: the shoulder ring from the portrait, one dim cyan pixel where the near arm starts. */
    extras(api, layer) {
        if (layer !== 'front' || api.view !== 'side' || !api.J) return;
        api.put(api.J[0], api.J[1], 'trim', 0);
    },
});
