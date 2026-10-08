/* Silent Exodus game screen v3: the story and the numbers (docs/GAME_SCREEN_V3.md, "The lines"). Every line follows
   docs/STYLE.md: plain, one idea, 20 words at most, crew by first name.
     window.V3Data = { SECTORS, JUMP, SCENE_STOCKPILE, PAGE_DISC, PAGE_PLATE, BARKS, CREW, costFor }
   Places sit on the heading in the order you meet them. at: how far along the sector (px of flight at cruise) the place is
   beside our lane. pass: [x, y] where it is at its closest, in stage pixels (640 x 360). gap: the clear sky between its edge
   and our lane, which is the cost (4, 5 or 6 energy). seed: v1's seed (main-screens.html, r * 7 + 3), so the surface is
   the same picture as on the v1 map. */
(function () {
    'use strict';

    const team = (verb, sub, extra) => Object.assign({ verb, sub, at: 'beacon', does: 'team' }, extra);
    const costFor = gap => (gap <= 40 ? 4 : gap <= 75 ? 5 : 6);

    // A scene plays as film: narration first, then voices with faces, then a real choice. Lines are [who, line].
    const SCENE_STOCKPILE = {
        key: 'EXODUS_WRECK', title: 'EXODUS-4 · The stockpile',
        narration: 'The decks are wrecked, but the hold is sealed and dry. A note on top says: For whoever comes next.',
        lines: [['Aris', "They packed this for the next crew. That's a decent thing to do."], ['Vance', "The manifest matches what's in the hold. That's the first honest list I've seen out here."],
            ['Aris', 'The labels are all handwritten. Someone took real care over this.']],
        choices: [{ verb: 'Take everything', chips: [['+30 salvage', 'gain']], gain: { salvage: 30 }, record: 'Took everything in their hold.' },
            { verb: 'Take half, leave a note of our own', chips: [['+15 salvage', 'gain'], ['−1 ration', 'loss']], gain: { salvage: 15, rations: -1 }, record: 'Took half their hold and left a note for the next crew.' }],
    };
    const PAGE_DISC = {
        id: 'disc', kind: 'drawing', title: 'A drawing from their logbook', source: 'EXODUS-4', record: 'Found a drawing of a gold disc in their logbook.',
        lines: [
            { label: 'The disc', part: 'disc', t: 'Gold. Thrown out of our solar system in 1977, bolted to a probe the size of a car. The oldest thing we ever sent anywhere.' },
            { label: 'The map', part: 'map', t: 'Fourteen lines from one point. Each line is a star that ticks like a clock. Where they meet is home.' },
            { label: 'The two figures', part: 'figures', t: 'What we look like. One of them is waving.' },
            { label: 'Written in the margin', part: 'margin', hand: true, t: '“Why is this in a colony ship’s orders? Why is it the only page marked with our heading?” K.' },
        ],
        after: [['A.U.R.A.', 'An old curiosity, Commander. I would not spend time on it.'], ['Mira', "The disc's map uses real stars. Match it to their last star reading, and we'll know when they died."]],
    };
    const PAGE_PLATE = {
        id: 'plate', kind: 'plate', title: 'The crew plate', source: 'EXODUS-6', record: 'Found the crew plate on Rhea-4 Minor.',
        lines: [{ part: 'names', t: 'A metal plate from beside the airlock. Four crew names are cast into it.' }, { part: 'blank', t: 'Below them is a fifth panel, the same size. It is blank. It was made blank.' },
            { part: 'all', t: 'Someone made a plate for five people, and only ever had four names to put on it.' }],
        cast: ['R. OSEI · ENGINEER', 'T. YUEN · DOCTOR', 'K. ADEYEMI · SECURITY', 'L. PARK · SCIENTIST', ''],
        after: [['Aris', "I'm adding their names to my list."]],
    };
    // crew remarks never show on screen: they go to the ship's record only
    const BARKS = {
        orbit: ['Aris', "In orbit. The med bay's ready if anyone needs it."],
        shuttle: ['Jaxon', "Shuttle's fuelled and checked. Bring it back in one piece."],
        exodus: ['Aris', "One of the eight ships. I'll read the crew names before we take anything."],
    };
    const CREW = [{ id: 'cora', name: 'Cora' }, { id: 'jaxon', name: 'Jaxon' }, { id: 'vance', name: 'Vance' }, { id: 'aris', name: 'Aris' }, { id: 'mira', name: 'Mira' }];
    const JUMP = { energy: 8, rations: 5 };

    const SECTORS = {
        1: {
            title: 'The Graveyard', seed: 11, dust: 0.12, haze: 1, stars: 1, rim: 0.12, stops: 3, next: 2, thing: 'giant',
            res: { energy: 100, rations: 25, salvage: 50 },
            light: { core: 2, halo: 14, strength: 1, spikes: 5 },
            arrive: [['A.U.R.A.', 'Good morning, Commander. All four crew are awake and well. The ship is in one piece.'], ['Aris', 'Everyone is up. Sixty-one years, and nobody even feels hungry.'],
                ['A.U.R.A.', 'I hear one old ship beacon on our route, Commander.']],
            wake: [{ t: 'All five woke after sixty-one years asleep.' }, { who: 'Vance', t: 'There are five of us on this ship. She keeps saying four.' }],
            hint: 'Click a world to stop there. Once we pass it, it\'s gone.',
            scenery: [{ x: 120, y: 44, r: 9, type: 'rock', seed: 404, speed: 0.06 }],
            places: [
                { id: 'zeta', name: 'Platform Zeta', tag: 'Old station', kind: 'station', at: 1000, pass: [430, 152], s: 1.25, gap: 30, seed: 3, doneTag: 'We boarded it',
                    reachLine: ['A.U.R.A.', 'A station ahead, Commander. Its docking port still answers.'],
                    line: 'An old station. Its docking port still answers.', react: ['Vance', 'A station out here. Somebody put it on this route on purpose.'],
                    orbit: { line: 'A station from a mission before ours.', arrive: ['A.U.R.A.', 'The docking port answers, Commander. Nothing else does.'],
                        steps: [{ verb: 'Board the station', sub: 'One of the crew goes in on one tank of air', at: 'station', does: 'board', then: ['Aris', 'Nobody aboard. They left the lights on.'], record: 'Boarded Platform Zeta. Nobody aboard.' }] } },
                { id: 'titan', name: 'Titan-61 IV', tag: 'Old transponder', kind: 'world', type: 'desert', at: 1800, pass: [380, 304], r: 48, gap: 60, seed: 73, beacon: 'red', doneTag: 'We searched the wreck',
                    reachLine: ['A.U.R.A.', 'The beacon is coming from that dry world ahead, Commander.'],
                    line: 'A dry world. A ship beacon is still running down there.', react: ['Mira', "That's a ship's transponder. One of the eight, I bet."],
                    orbit: { line: 'A dry world. Hot by day, frozen at night.', arrive: ['A.U.R.A.', 'Orbit, Commander. The beacon belongs to EXODUS-4. It is still running.'],
                        steps: [
                            team('Send the team', 'Vance and Aris take the shuttle', { crew: 'Vance and Aris', scene: SCENE_STOCKPILE, bark: 'exodus', then: ['Vance', "We're back. Nobody alive down there. We brought their last star reading."], page: PAGE_DISC, record: 'The team searched EXODUS-4. Nobody alive.' }),
                            { verb: 'Date it with the star map', sub: 'Mira lines it up with the stars', at: 'beacon', does: 'date', pulse: true, story: true,
                                then: ['Mira', 'Hull 4 died twenty-one years ago. They were flying to that grey moon.'], dated: 'Hull 4 · 21 years dead', reveal: 'rhea', record: 'Dated hull 4: twenty-one years dead.' },
                        ] } },
                { id: 'rhea', name: 'Rhea-4 Minor', tag: 'Grey moon · their last course', kind: 'world', type: 'rock', at: 2600, pass: [400, 114], r: 40, gap: 50, seed: 52, free: true, hidden: true, beacon: 'red', doneTag: 'We searched the wreck',
                    contact: { name: 'Unidentified contact', tag: 'No fix yet', line: 'A faint contact ahead, Commander. I cannot get a fix on it.' },
                    line: 'A small grey moon. Its emergency lamp still flashes.', react: ['Mira', 'They saw a lamp on that moon and went to help. They never got there.'],
                    orbit: { line: 'A small grey moon. One of our ships came down on it.', arrive: ['A.U.R.A.', 'Orbit, Commander. EXODUS-6 is down there. Its emergency lamp is still flashing.'],
                        steps: [team('Send the team', 'Aris and Mira take the shuttle', { crew: 'Aris and Mira', page: PAGE_PLATE, record: 'The team searched EXODUS-6. Nobody alive.' })] } },
                { id: 'kryos', name: 'Kryos-68 Prime', tag: 'Gas giant · fuel', kind: 'giant', type: 'gas', at: 3400, cost: 6, fills: true, doneTag: 'Tanks filled here',
                    line: 'A gas giant. We can skim fuel from its clouds.', react: ['Jaxon', 'We can skim fuel there. It will cost us a stop.'],
                    orbit: { line: 'A gas giant, banded rust and gold.', arrive: ['Jaxon', 'Scoops are open. We fill the tanks on the next pass.'],
                        steps: [{ verb: 'Skim fuel', sub: 'fills the tanks', at: 'clouds', does: 'fuel', gain: { energy: 15 }, then: ['A.U.R.A.', 'Tanks are full, Commander.'], record: 'Skimmed fuel at Kryos-68 Prime.' }] } },
                { id: 'chronos', name: 'Chronos-37 Proxima', tag: 'Ice world', kind: 'world', type: 'ice', at: 4200, pass: [440, 82], r: 58, gap: 56, seed: 80, doneTag: 'Only ice',
                    line: 'An ice world. Nothing on the scanner.', react: ['Aris', 'Nothing on the scanner. Just old ice.'],
                    orbit: { line: 'An ice world. Nothing moves down there.', arrive: ['A.U.R.A.', 'No signal, Commander. The ice is old and clean.'],
                        steps: [team('Send the team down', 'Search the surface', { then: ['Jaxon', 'Nothing down there but ice. We took some for water.'], record: 'Searched Chronos-37 Proxima. Only ice.' })] } },
                { id: 'zephyr', name: 'Zephyr-97 X', tag: 'Dead rock', kind: 'world', type: 'rock', at: 5000, pass: [360, 316], r: 40, gap: 80, seed: 66, doneTag: 'Nothing there',
                    line: 'A dead rock. No signal.', react: ['A.U.R.A.', 'A dead rock, Commander. There is no signal from it.'],
                    orbit: { line: 'A dead rock, close to nothing.', arrive: ['A.U.R.A.', 'Nothing here, Commander. Not even old wreckage.'],
                        steps: [team('Send the team down', 'Search the surface', { then: ['Vance', "Rock and dust. We shouldn't have stopped."], record: 'Searched Zephyr-97 X. Nothing.' })] } },
            ],
        },
        2: {
            title: 'The Dark Void', seed: 22, dust: 0.08, haze: 0.6, stars: 1.6, rim: 0.12, stops: 3, next: null, thing: 'rogue',
            light: { core: 5, halo: 34, strength: 1, spikes: 7 },                         // the same light as sector 1, nearer: bigger than sector 1's light at its jump
            arrive: [['A.U.R.A.', 'We are through the jump, Commander. The light ahead is closer now.'], ['Mira', "Something ahead is blocking the stars. It's a planet with no sun."]],
            scenery: [],
            places: [
                { id: 'hyperion', name: 'Hyperion-9 Minor', tag: 'Frozen moon', kind: 'world', type: 'ice', at: 1100, pass: [420, 110], r: 44, gap: 42, seed: 101,
                    line: 'A frozen moon. It has no sun of its own.', react: ['Aris', 'Nothing should live out here. I want to be sure.'],
                    orbit: { line: 'A frozen moon. Only the light ahead reaches it.', arrive: ['A.U.R.A.', 'Orbit, Commander. The surface is ice, all the way down.'], steps: [] } },
                { id: 'nysa', name: 'Nysa-40 X', tag: 'Dark rock', kind: 'world', type: 'rock', at: 1900, pass: [380, 300], r: 42, gap: 62, seed: 108,
                    line: 'A dark rock. It reflects almost no light.', react: ['Vance', "It's almost black. We could fly right into something like that."],
                    orbit: { line: 'A dark rock. It reflects almost no light.', arrive: ['A.U.R.A.', 'Orbit, Commander. There is no signal down there.'], steps: [] } },
            ],
        },
    };
    Object.values(SECTORS).forEach(sec => sec.places.forEach(pl => { if (pl.cost == null && pl.gap != null) pl.cost = costFor(pl.gap); }));

    window.V3Data = { SECTORS, JUMP, SCENE_STOCKPILE, PAGE_DISC, PAGE_PLATE, BARKS, CREW, costFor };
})();
