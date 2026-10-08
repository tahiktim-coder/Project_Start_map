/* MIRA — tech. Portrait: assets/crew/F_5.png. WORK IN PROGRESS. */
CrewSprites.register({
    id: 'mira',
    name: 'Mira',
    role: 'Tech',
    portrait: '../../assets/crew/F_5.png',
    signature: 'Black hair tied back, teal streak; cream uniform, gold collar.',
    idle: 'hang',
    palette: {
        hair: ['#0c0f11', '#1d2326', '#33403e', '#55706a'],
        streak: ['#07443c', '#18a88c', '#7af0cc'],
        skin: ['#5e3427', '#d39470', '#f6c29a'],
        eye: ['#123a32', '#2a8a72', '#9ae8d0'],
        lip: ['#5a2422', '#b0544e', '#d8807a'],
        suit: ['#4c483a', '#aca386', '#cdc4a2'],
        gold: ['#5a3c0c', '#c99a2a', '#f2d064'],
        boot: ['#13100d', '#2b251f', '#463c32'],
    },
    keys: {
        1: 'hair:0', 2: 'hair:1', 3: 'hair:2', 4: 'hair:3',
        u: 'streak:0', t: 'streak:1', T: 'streak:2',
        k: 'skin:0', s: 'skin:1', S: 'skin:2', e: 'eye:0', m: 'lip:1',
        b: 'suit:0', n: 'suit:1', N: 'suit:2',
        o: 'gold:0', g: 'gold:1', G: 'gold:2',
    },
    blink: ['e', 's'],
    head: {
        side: { anchor: [3, 6], map: [
            '..1233..',
            '.1tT3343',
            '1123sS43',
            '12seSeS3',
            '11kSSSs2',
            '.1.ksmst',
            '..ogGGt.',
        ] },
        down: { anchor: [3, 6], map: [
            '..1233..',
            '.1tT3343',
            '11233343',
            '12sSSSS3',
            '11ksSSs2',
            '.1.kssst',
            '..ogGGt.',
        ] },
        back: { anchor: [4, 6], map: [
            '..2332..',
            '.23tT32.',
            '12233221',
            's122221s',
            '.122221.',
            '..1oo1..',
            '..gnng..',
        ] },
    },
    torso: {
        side: { spine: 2, squash: 3, map: [
            '.nnNN.',
            'bnnNNN',
            'bnnNNN',
            '.bnnN.',
            '.bnnN.',
            'bbnnnn',
        ] },
        back: { spine: 3, squash: 3, map: [
            '.nnnnn.',
            'bnnnnnb',
            'bnnnnnb',
            '.bnnnb.',
            '.bnnnb.',
            'bbnnnbb',
        ] },
    },
    limbs: { arm: 'suit', hand: 'skin', leg: 'suit', foot: 'boot', rim: true },
    extras(api, layer) {
        if (layer !== 'front' || api.view !== 'side' || !api.J) return;
        api.put(api.J[0], api.J[1] - 1, 'gold', 1);
    },
});
