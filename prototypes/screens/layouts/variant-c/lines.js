/* ═══ Silent Exodus · layout variant C · what people say (docs/STYLE.md: plain, one idea, 20 words at most; Cora is
   the player, so clicking her gets A.U.R.A.'s answer). Lines from ../crew-hires/ship-sim.js and ../game-screen-v3/data.js
   where one fits; the rest are new and marked (new).
     window.VoyageLines = { NAMES, TONES, click: { travel, orbit }, auto: { travel, orbit, passed } } */
(function () {
    'use strict';
    const NAMES = { cora: 'Cora', jaxon: 'Jaxon', aris: 'Aris', vance: 'Vance', mira: 'Mira', aura: 'A.U.R.A.' };
    // reading.css tones: warm for people, steel for A.U.R.A.
    const TONES = { cora: '#f2e2c4', jaxon: '#f08c2e', vance: '#c4622a', aris: '#ffc27a', mira: '#e8836a', aura: '#c9d1d6' };
    const click = {
        travel: {
            cora: { any: 'Four crew, Commander. All accounted for.', near: 'The beacon is coming from that dry world ahead, Commander.' },
            jaxon: { meal: "Same stew as yesterday. I'm not complaining.", work: "The drive's running a little hot. Nothing I can't fix.", move: 'Going back down. I want to check the coolant again.' },
            aris: { cook: 'Sit down for once. The ship can fly itself for ten minutes.', meal: 'Everyone is due a check-up this week. You too, Commander.',
                clean: "I'll do the dishes. Go and get some sleep.", work: "I'm restocking the med bay. We used more than I wrote down.", move: "I'm on my way down to the med bay." },
            mira: { meal: "Did you see the readings this morning? I couldn't sleep after that.", move: 'A.U.R.A. says there is a world ahead. I want to see it.',
                window: "There's a beacon down there. It's still running.", window2: 'We just flew past it. I hope nobody was waiting.',
                after: 'My stew went cold. Worth it.', work: "I'm checking that beacon against the old ship lists." },
            vance: { meal: "I'll eat standing up. My back's bad today.", move: 'I want to see this with my own eyes.', window: 'A beacon that old should have died years ago.',
                window2: "That's one of ours down there. I'd bet on it.", after: "Nobody here wanted to stop. I'll remember that.", work: 'I check the hold twice a day. Somebody should.' },
        },
        orbit: {
            cora: { any: 'Orbit, Commander. The beacon belongs to EXODUS-4. It is still running.' },
            jaxon: { any: "Shuttle's fuelled and checked. Bring it back in one piece." },
            aris: { any: "In orbit. The med bay's ready if anyone needs it." },
            mira: { any: "Can we go down? Please say we're going down." },
            vance: { any: "A beacon still running. Let's see who left it on." },
        },
    };
    // timed lines: t in ms (from the start, or from arrival for orbit)
    const auto = {
        travel: [
            { t: 34000, id: 'aura', text: 'A dry world ahead, Commander. An old ship beacon is still running down there.' },
            { t: 38400, id: 'mira', text: "That's a ship's transponder. One of the eight, I bet." },
            { t: 45200, id: 'vance', text: 'I want to see this with my own eyes.' },
            { t: 63200, id: 'mira', text: 'Look at the beacon. Somebody came down there and never left.' },
            { t: 110000, id: 'aris', text: "Sit down, both of you. Your food's gone cold." },
        ],
        passed: [{ t: 77000, id: 'vance', text: 'We just flew past one of our own ships.' }],
        orbit: [
            { t: 1600, id: 'aura', text: 'Orbit, Commander. The beacon belongs to EXODUS-4. It is still running.' },
            { t: 9000, id: 'mira', text: "Can we go down? Please say we're going down." },
            { t: 16000, id: 'aris', text: "In orbit. The med bay's ready if anyone needs it." },
            { t: 31500, id: 'jaxon', text: "Shuttle's fuelled and checked. Bring it back in one piece." },
            { t: 40000, id: 'vance', text: "A beacon still running. Let's see who left it on." },
        ],
    };
    window.VoyageLines = Object.freeze({ NAMES, TONES, click, auto });
})();
