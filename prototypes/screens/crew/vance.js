/* VANCE — the hard one. PLACEHOLDER: replace this whole costume (see cora.js for the reference and the map rules,
   docs/CREW_SPRITES.md for the brief). Portrait: assets/crew/M_4.png.
   Must read at a glance: spiky grey-white hair standing up; heavy dark brows; tired weathered face with stubble;
   a bulky white-grey EVA suit with a big ring collar. The widest silhouette of the five. */
CrewSprites.register({
    id: 'vance',
    name: 'Vance',
    role: 'Security',
    portrait: '../../assets/crew/M_4.png',
    signature: 'Grey spikes; heavy brows; bulky white EVA suit, ring collar.',
    placeholder: true,
    idle: 'hips',
    palette: {
        hair: ['#2e3238', '#7e858e', '#c4cad0', '#eef1f4'],
        skin: ['#4a2c22', '#b07a5e', '#e0aa88'],
        eye: ['#0c1a2c', '#3f7fd0', '#a8d0ff'],
        brow: ['#16181c', '#2a2c30', '#3a3c40'],
        suit: ['#3a3e44', '#9aa0a6', '#d8dde2'],
        boot: ['#202226', '#4a4e54', '#7a7e84'],
    },
    keys: { 1: 'hair:0', 2: 'hair:1', 3: 'hair:2', 4: 'hair:3', w: 'brow:1', k: 'skin:0', s: 'skin:1', S: 'skin:2', e: 'eye:1', b: 'suit:0', n: 'suit:1', N: 'suit:2' },
    blink: ['e', 'w'],
    head: {
        side: { anchor: [4, 6], map: ['.3.43.3.', '23344332', '12wwsww2', '.1eSSeS.', '.ksSSSs.', '..kkskk.', 'bnNNNNnb'] },
        back: { anchor: [4, 6], map: ['3.4.43.3', '.233432.', '12333321', '12222221', '.112211.', '..kssk..', 'bnNNNNnb'] },
    },
    torso: {
        side: { spine: 3, map: ['.nnNNNN', 'bnnnNNN', 'bnnnnNN', 'bnnnnNN', 'bbnnnnN', 'bbnnnnn'] },
        back: { spine: 4, map: ['.nnnnnnn.', 'bnnnnnnnb', 'bnnnnnnnb', 'bbnnnnnbb', '.bnnnnnb.', '.bnnnnnb.'] },
    },
    backShoulder: 4,
    limbs: { arm: 'suit', hand: 'suit', leg: 'suit', foot: 'boot', bootRows: 2, rim: true },
});
