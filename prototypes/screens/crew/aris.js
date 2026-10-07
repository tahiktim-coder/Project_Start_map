/* ARIS — doctor. PLACEHOLDER: replace this whole costume (see cora.js for the reference and the map rules,
   docs/CREW_SPRITES.md for the brief). Portrait: assets/crew/F_3.png.
   Must read at a glance: a cream helmet with goggles pushed up on top; dark wavy hair with magenta-purple lights,
   loose and flying out behind; a warm smile; a padded suit with rust-orange panels. */
CrewSprites.register({
    id: 'aris',
    name: 'Aris',
    role: 'Doctor',
    portrait: '../../assets/crew/F_3.png',
    signature: 'Helmet with goggles up; dark hair with magenta lights; rust-orange suit.',
    placeholder: true,
    idle: 'hang',
    palette: {
        hair: ['#1a0f22', '#3b1f4f', '#8a2f86', '#d257b8'],
        skin: ['#4a2618', '#c07a52', '#efb07c'],
        eye: ['#1a0c08', '#4a2414', '#8a4a2a'],
        helmet: ['#3a3024', '#bfae8a', '#ede0c0'],
        goggle: ['#2a1430', '#7a3a8a', '#e07ad0'],
        suit: ['#2a1810', '#8c3a1e', '#d0642e'],
        boot: ['#120d0b', '#2a201b', '#463830'],
    },
    keys: { 1: 'hair:0', 2: 'hair:1', 3: 'hair:2', h: 'helmet:1', H: 'helmet:2', g: 'goggle:1', G: 'goggle:2', k: 'skin:0', s: 'skin:1', S: 'skin:2', e: 'eye:1', b: 'suit:0', n: 'suit:1', N: 'suit:2' },
    blink: ['e', 's'],
    head: {
        side: { anchor: [4, 6], map: ['..hhHHh..', '.hgGGgHh.', '312sSSS21', '312eSeSs2', '21.sSSSs2', '1..ssSks.', '...nnn...'] },
        back: { anchor: [4, 6], map: ['.hhhhhh.', 'hgggggh.', '12222221', '12322321', '12222221', '1.2112.1', '..bnnb..'] },
    },
    torso: {
        side: { spine: 2, map: ['.nnNN', 'bnnNN', 'bnnNN', '.bnnN', '.bnnn', 'bbnnn'] },
        back: { spine: 3, map: ['.nnnnn.', 'bnnnnnb', 'bnnnnnb', '.bnnnb.', '.bnnnb.', '.bnnnb.'] },
    },
    limbs: { arm: 'suit', hand: 'skin', leg: 'suit', foot: 'boot' },
});
