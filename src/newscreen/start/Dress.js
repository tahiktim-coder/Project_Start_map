/* ═══ Silent Exodus · new screen (?new=1) · start/Dress.js: the crew's dress uniform for the launch film ════════════════
   What it is: every person is registered twice, as themselves and as '<id>-dress' with the same head, hair, skin and
   build, and the suit recoloured to the programme's navy and gold (the launch film's podium and walk use '<id>-dress').
   Done by wrapping CrewEngine.register before the person files load; CrewEngine itself is not changed.
   Source: the dress block of prototypes/films/launch.html, unchanged but for the ?dress= read (gone: always dressed).
   Load order (docs/BUILD_B.md §10): right after crew/CrewEngine.js, before the five person files.
   window.NS_DRESS = true once the wrap is in (LaunchArt reads it). */
(function () {
    'use strict';
    const E0 = window.CrewEngine;
    if (!window.NEW_SCREEN || !E0 || typeof E0.register !== 'function') return;
    const INK = E0.INK;
    const DRESS = [INK, '#0e1320', '#161d2e', '#1f2940', '#2a3752', '#384866', '#4b5e80'];
    const DARK = [INK, '#0b0e16', '#11161f', '#181e2a', '#212836', '#2c3444'];
    const GOLD = [INK, '#4a3410', '#8a6420', '#c49a3a', '#e8c66a', '#fff0b0'];
    const BOOT = [INK, '#0a0b0e', '#13151a', '#1d2027', '#2a2e37', '#3c414c'];
    const GLOVE = [INK, '#3a3c40', '#6a6c70', '#a8aaa8', '#d8d8d2', '#f2f2ea'];
    const MAP = {
        cora: { suit: DRESS, pad: DRESS, trim: GOLD, boot: BOOT },
        jaxon: { suit: DRESS, pant: DARK, cuff: GOLD, boot: BOOT },
        aris: { suit: DRESS, rust: DRESS, navy: DARK, band: DARK, cream: GOLD, boot: BOOT },
        vance: { suit: DRESS, dark: DARK, pack: DARK, glove: GLOVE, boot: BOOT },
        mira: { suit: DRESS, belt: DARK, boot: BOOT },
    };
    window.CrewEngine = Object.freeze(Object.assign({}, E0, {
        register(person) {
            E0.register(person);
            const m = person && MAP[person.id];
            if (!m) return;
            const ramps = Object.assign({}, person.ramps, m), tex = Object.assign({}, person.tex, { suit: 0.05 });
            const build = Object.assign({}, person.build, { pack: false });
            E0.register(Object.assign({}, person, { id: person.id + '-dress', ramps, tex, build }));
        },
    }));
    window.NS_DRESS = true;
})();
