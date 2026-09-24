/**
 * EXODUS DERELICT ENCOUNTERS
 *
 * Earlier Exodus hulls that crashed, landed, or were abandoned on this heading.
 * Each encounter has a type, weighted chance, narrative text, crew reactions,
 * and 2-3 choices that trade one thing the player wants against another.
 *
 * Found on planets with EXODUS_WRECK tag (detected via deep scan).
 * Separate from normal EVA — this is a dedicated investigation.
 *
 * The hull name is passed in as shipName. The runtime picks it with App.getWreckName,
 * which scales the hull number with the sector (1-8 near home, tens of thousands at the end).
 * The table below is callsigns only and is kept for the getShipName closures.
 *
 * Writing rules for this file: docs/STYLE.md. Plain sentences, no nicknames, no riddles.
 */

const EXODUS_SHIP_NAMES = [
    '"PIONEER"',
    '"COVENANT"',
    '"SOJOURN"',
    '"REQUIEM"',
    '"LAZARUS"',
    '"ICARUS"',
    '"MERIDIAN"',
    '"ORPHEUS"'
];

const EXODUS_ENCOUNTERS = [
    // --- 1. BURNED OUT: Total destruction, minimal salvage ---
    {
        id: 'EXODUS_BURNED',
        weight: 25,
        title: "BURNED HULL",
        getShipName: () => EXODUS_SHIP_NAMES[Math.floor(Math.random() * EXODUS_SHIP_NAMES.length)],
        context: (shipName) => `${shipName} came in too steep and burned up on the way down. The crew deck melted. Only the transponder still works.`,
        dialogue: [
            { speaker: 'Eng. Jaxon', text: "Scorch marks from nose to tail. At least it would have been quick." },
            { speaker: 'Spc. Vance', text: "The ship's computer flies the landing, not the crew. It brought them in like this." },
            { speaker: 'Dr. Aris', text: "Their crew list is still on the transponder. I'd like to read their names." }
        ],
        choices: [
            {
                text: "Read their names, take the transponder",
                desc: "-1 Ration: a day for a short service. +10 Salvage, +1 Data.",
                effect: (state) => {
                    state.rations = Math.max(0, state.rations - 1);
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 10);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;
                    const loreTexts = [
                        "TRANSPONDER: 'Entry angle off by a third of a degree. That was all it took.'",
                        "TRANSPONDER: 'The heat shield was rated for three landings. This was our fourth.'",
                        "TRANSPONDER: 'Autopilot has the landing. Crew strapped in. Wish us luck.'"
                    ];
                    state.addLog(loreTexts[Math.floor(Math.random() * loreTexts.length)]);
                    state.addLog("The crew's names are read aloud beside the wreck before anything is taken.");
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(1, 'Read the names of the lost');
                    state.noteStanding && state.noteStanding('aris');
                    return "Names read, transponder taken. -1 Ration, +10 Salvage, +1 Data.";
                }
            },
            {
                text: "Strip the hull for metal",
                desc: "-5 Energy. +25 Salvage. Aris +1 Stress: nobody reads their names.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 25);
                    const aris = state.crew.find(c => c.tags && c.tags.includes('MEDIC') && c.status !== 'DEAD');
                    if (aris) aris.stress = Math.min(3, (aris.stress || 0) + 1);
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(-1, 'Stripped a wreck without rites');
                    return "Hull plates cut and stored. -5 Energy, +25 Salvage. Aris +1 Stress.";
                }
            }
        ]
    },

    // --- 2. CREW DEAD: Intact hull, dead crew ---
    {
        id: 'EXODUS_DEAD_CREW',
        weight: 25,
        title: "SILENT SHIP",
        getShipName: () => EXODUS_SHIP_NAMES[Math.floor(Math.random() * EXODUS_SHIP_NAMES.length)],
        context: (shipName) => `${shipName} landed in one piece. The air system still runs. Inside, five people sit at their stations. No wounds, no sign of a struggle. They just stopped.`,
        dialogue: [
            { speaker: 'Dr. Aris', text: "No sign of pain. Whatever happened to them, it was quiet." },
            { speaker: 'Spc. Vance', text: "Five healthy people died in their chairs. I want to know what did that." },
            { speaker: 'Eng. Jaxon', text: "The hold's full. Medicine, food, tools. There's even a tin of real coffee." },
            { speaker: 'Dr. Aris', text: "Kael, we bury them before we take anything." }
        ],
        choices: [
            {
                text: "Bury them, take only the logs",
                desc: "-1 Ration, -5 Energy. +2 Data. Aris -1 Stress. The hold stays sealed.",
                effect: (state) => {
                    state.rations = Math.max(0, state.rations - 1);
                    state.energy = Math.max(0, state.energy - 5);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 2;
                    const aris = state.crew.find(c => c.tags && c.tags.includes('MEDIC') && c.status !== 'DEAD');
                    if (aris) aris.stress = Math.max(0, (aris.stress || 0) - 1);
                    const loreTexts = [
                        "SHIP LOG: 'The air scrubbers failed slowly. Nobody noticed. We had turned the alarms off to save power.'",
                        "SHIP LOG: 'We're too tired to fix anything now. We'll sit at our stations and wait.'"
                    ];
                    state.addLog(loreTexts[Math.floor(Math.random() * loreTexts.length)]);
                    state.addLog("Five graves beside the ship. A name is read over each one.");
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(1, 'Buried a crew and left their hold');
                    state.noteStanding && state.noteStanding('aris');
                    return "Five graves dug, logs copied. -1 Ration, -5 Energy, +2 Data.";
                }
            },
            {
                text: "Strip the ship",
                desc: "+40 Salvage, +1 Food Pack. Aris +2 Stress. Nobody gets buried.",
                effect: (state) => {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 40);
                    if (typeof ITEMS !== 'undefined' && ITEMS.FOOD_PACK) {
                        state.cargo.push({ ...ITEMS.FOOD_PACK, acquiredAt: 'Exodus Wreck' });
                    }
                    const aris = state.crew.find(c => c.tags && c.tags.includes('MEDIC') && c.status !== 'DEAD');
                    if (aris) aris.stress = Math.min(3, (aris.stress || 0) + 2);
                    state.addLog("We carried their food out past their bodies.");
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(-2, 'Stripped a crew still in their chairs');
                    return "Ship stripped. +40 Salvage, +1 Food Pack. Aris +2 Stress.";
                }
            },
            {
                text: "Bury them, then empty the hold",
                desc: "-1 Ration, -10 Energy. +20 Salvage, +1 Food Pack. Aris +1 Stress: she digs the graves alone.",
                effect: (state) => {
                    state.rations = Math.max(0, state.rations - 1);
                    state.energy = Math.max(0, state.energy - 10);
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 20);
                    if (typeof ITEMS !== 'undefined' && ITEMS.FOOD_PACK) {
                        state.cargo.push({ ...ITEMS.FOOD_PACK, acquiredAt: 'Exodus Wreck' });
                    }
                    const aris = state.crew.find(c => c.tags && c.tags.includes('MEDIC') && c.status !== 'DEAD');
                    if (aris) aris.stress = Math.min(3, (aris.stress || 0) + 1);
                    if (aris) state.addLog("Dr. Aris digs the graves while the rest of us load the lander. She doesn't ask for help.");
                    return "Graves dug, hold emptied. -1 Ration, -10 Energy, +20 Salvage, +1 Food Pack.";
                }
            }
        ]
    },

    // --- 3. CRYO SURVIVORS: Living humans in cryosleep ---
    // Nobody can be woken out here. Sleepers are carried in the hold or left to die. Nobody joins.
    {
        id: 'EXODUS_CRYO',
        weight: 10,
        title: "THE SLEEPERS",
        getShipName: () => EXODUS_SHIP_NAMES[Math.floor(Math.random() * EXODUS_SHIP_NAMES.length)],
        context: (shipName) => `${shipName} is dark except for the cryo bay. Three sleep pods, three green lights, three heartbeats. Everything else on board is cold.`,
        dialogue: [
            { speaker: 'Tech Mira', text: "Three people, still alive! But their pods are down to two percent power." },
            { speaker: 'Dr. Aris', text: "It isn't safe to wake them out here. We can carry them and keep them cold." },
            { speaker: 'Eng. Jaxon', text: "Those pod batteries hold a lot of power. We could use it. I'm only saying." },
            { speaker: 'Spc. Vance', text: "Keeping three pods cold costs us a ration each. Can we afford that?" }
        ],
        choices: [
            {
                text: "Carry all three pods",
                desc: "-3 Rations to keep them cold. +3 Sleepers in the hold.",
                effect: (state) => {
                    state.rations = Math.max(0, state.rations - 3);
                    state._sleepers = (state._sleepers || 0) + 3;
                    state.addLog("Three pods strapped down in the hold, lights still green. Their names are written on the lids.");
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(1, 'Carried the sleepers');
                    return "Three sleepers aboard, still asleep. -3 Rations to keep them cold.";
                }
            },
            {
                text: "Take the pod batteries",
                desc: "+70 Energy. The three sleepers die. All crew +1 Stress.",
                effect: (state) => {
                    state.energy = Math.min(100, state.energy + 70);
                    state.crew.forEach(c => {
                        if (c.status !== 'DEAD') c.stress = Math.min(3, (c.stress || 0) + 1);
                    });
                    if (state.crew.some(c => c.tags && c.tags.includes('MEDIC') && c.status !== 'DEAD')) {
                        state.addLog("Dr. Aris: \"You're killing them. You know that.\"");
                    }
                    state.addLog("Nobody answers. The three green lights go out one after another.");
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(-2, 'Killed sleepers for power');
                    return "Pod batteries removed. +70 Energy. The three sleepers are dead.";
                }
            },
            {
                text: "Take one battery, carry two pods",
                desc: "+25 Energy, -2 Rations. +2 Sleepers. One sleeper dies. Aris +1 Stress.",
                effect: (state) => {
                    state.energy = Math.min(100, state.energy + 25);
                    state.rations = Math.max(0, state.rations - 2);
                    state._sleepers = (state._sleepers || 0) + 2;
                    const aris = state.crew.find(c => c.tags && c.tags.includes('MEDIC') && c.status !== 'DEAD');
                    if (aris) aris.stress = Math.min(3, (aris.stress || 0) + 1);
                    if (aris) state.addLog("Dr. Aris chooses which pod loses its battery. She won't say how she chose.");
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(-1, 'Traded one sleeper for two');
                    return "Two sleepers aboard, one battery in our reactor. +25 Energy, -2 Rations.";
                }
            }
        ]
    },

    // --- 4. SUPPLY CACHE: Cargo hold intact ---
    {
        id: 'EXODUS_CACHE',
        weight: 15,
        title: "THE STOCKPILE",
        getShipName: () => EXODUS_SHIP_NAMES[Math.floor(Math.random() * EXODUS_SHIP_NAMES.length)],
        context: (shipName) => `${shipName}'s decks are wrecked, but the hold is sealed and dry. The crates are stacked and labelled. A note on top says: "For whoever comes next."`,
        dialogue: [
            { speaker: 'Eng. Jaxon', text: "They packed this for the next crew. That's a decent thing to do." },
            { speaker: 'Tech Mira', text: "The labels are all handwritten. Someone took real care over this." },
            { speaker: 'Spc. Vance', text: "The manifest matches what's in the hold. That's the first honest list I've seen out here." }
        ],
        choices: [
            {
                text: "Take everything",
                desc: "+30 Salvage, +2 Food Pack, +1 Luxury Item. Jaxon +1 Stress: nothing is left for the next ship.",
                effect: (state) => {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 30);
                    if (typeof ITEMS !== 'undefined') {
                        if (ITEMS.FOOD_PACK) {
                            state.cargo.push({ ...ITEMS.FOOD_PACK, acquiredAt: 'Exodus Cache' });
                            state.cargo.push({ ...ITEMS.FOOD_PACK, acquiredAt: 'Exodus Cache' });
                        }
                        if (ITEMS.LUXURY_CHOCOLATE) {
                            state.cargo.push({ ...ITEMS.LUXURY_CHOCOLATE, acquiredAt: 'Exodus Cache' });
                        }
                    }
                    const jaxon = state.crew.find(c => c.tags && c.tags.includes('ENGINEER') && c.status !== 'DEAD');
                    if (jaxon) jaxon.stress = Math.min(3, (jaxon.stress || 0) + 1);
                    if (jaxon) state.addLog("Eng. Jaxon folds up the note and puts it in his pocket. He doesn't say anything.");
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(-1, 'Emptied a cache left for others');
                    return "Hold emptied. +30 Salvage, +2 Food Pack, +1 Luxury Item. Jaxon +1 Stress.";
                }
            },
            {
                text: "Take half, leave a note of our own",
                desc: "+15 Salvage, +1 Food Pack. -1 Ration left in the crate. Jaxon -1 Stress.",
                effect: (state) => {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 15);
                    state.rations = Math.max(0, state.rations - 1);
                    if (typeof ITEMS !== 'undefined' && ITEMS.FOOD_PACK) {
                        state.cargo.push({ ...ITEMS.FOOD_PACK, acquiredAt: 'Exodus Cache' });
                    }
                    const jaxon = state.crew.find(c => c.tags && c.tags.includes('ENGINEER') && c.status !== 'DEAD');
                    if (jaxon) jaxon.stress = Math.max(0, (jaxon.stress || 0) - 1);
                    state.addLog("We write the date and our names on the lid, then seal the hold again.");
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(1, 'Left something for whoever comes next');
                    state.noteStanding && state.noteStanding('jaxon');
                    return "Half the hold taken, one ration left behind. +15 Salvage, +1 Food Pack, -1 Ration.";
                }
            }
        ]
    },

    // --- 5. INFECTED: Overgrown hydroponics ---
    {
        id: 'EXODUS_INFECTED',
        weight: 10,
        title: "THE GROWTH",
        getShipName: () => EXODUS_SHIP_NAMES[Math.floor(Math.random() * EXODUS_SHIP_NAMES.length)],
        context: (shipName) => `${shipName} is covered in white mould inside. Their greenhouse kept growing after the crew died. It has eaten half the airlock. Under it, the lab still has power.`,
        dialogue: [
            { speaker: 'Dr. Aris', text: "Their own greenhouse did this. Nobody touches anything without gloves." },
            { speaker: 'Tech Mira', text: "The lab lights are still on. There could be years of research in there." },
            { speaker: 'Spc. Vance', text: "There aren't enough clean suits for all of us. I'll stay with the lander." }
        ],
        choices: [
            {
                text: "Send Aris in with a suited team",
                desc: "+35 Salvage, +1 Bio Sample. 15% chance someone gets hurt.",
                requires: (state) => state.crew.some(c => c.tags.includes('MEDIC') && c.status !== 'DEAD'),
                requiresLabel: "Requires Aris",
                effect: (state) => {
                    const hasMedic = state.crew.some(c => c.tags.includes('MEDIC') && c.status !== 'DEAD');
                    if (!hasMedic) {
                        return "No doctor aboard. Nobody goes in without one.";
                    }
                    if (Math.random() < 0.15) {
                        const team = state.crew.filter(c => c.status === 'HEALTHY' && !c.tags.includes('LEADER'));
                        if (team.length > 0) {
                            const victim = team[Math.floor(Math.random() * team.length)];
                            victim.status = 'INJURED';
                            state.addLog(`WARNING: ${victim.name} breathed in spores on the way out. They are in quarantine.`);
                        }
                    }
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 35);
                    if (typeof ITEMS !== 'undefined') {
                        const revivalItem = Math.random() > 0.5 ? ITEMS.XENO_MYCELIUM : ITEMS.FUNGUS_CULTURE;
                        state.cargo.push({ ...revivalItem, acquiredAt: 'Exodus Wreck (Infected)' });
                        state.addLog(`Recovered: ${revivalItem.name}`);
                    }
                    return "Team back and cleaned off. Lab equipment and a live sample recovered. +35 Salvage.";
                }
            },
            {
                text: "Take its power cells, then burn it",
                desc: "+10 Energy. Nothing else recovered. Aris +1 Stress.",
                effect: (state) => {
                    state.energy = Math.min(100, state.energy + 10);
                    const aris = state.crew.find(c => c.tags && c.tags.includes('MEDIC') && c.status !== 'DEAD');
                    if (aris) aris.stress = Math.min(3, (aris.stress || 0) + 1);
                    if (state.crew.some(c => c.tags && c.tags.includes('ENGINEER') && c.status !== 'DEAD')) {
                        state.addLog("Eng. Jaxon: \"Burn it. I don't want that anywhere near our ship.\"");
                    }
                    return "Power cells taken, then the wreck burned from orbit. The mould is gone. +10 Energy.";
                }
            },
            {
                text: "Collect spores from the airlock",
                desc: "-5 Energy. 40% chance someone gets hurt and the sample is lost. Otherwise +1 Spore Sample.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    if (Math.random() < 0.4) {
                        const team = state.crew.filter(c => c.status === 'HEALTHY' && !c.tags.includes('LEADER'));
                        if (team.length > 0) {
                            const victim = team[Math.floor(Math.random() * team.length)];
                            victim.status = 'INJURED';
                            state.addLog(`CRITICAL: ${victim.name} was exposed to the spores. Emergency cleaning.`);
                        }
                        return "A suit seal broke. The sample was lost as we got out. -5 Energy.";
                    }
                    if (typeof ITEMS !== 'undefined' && ITEMS.XENO_MYCELIUM) {
                        state.cargo.push({ ...ITEMS.XENO_MYCELIUM, acquiredAt: 'Exodus Wreck (Infected)' });
                    }
                    return "Spore sample sealed and stored. -5 Energy.";
                }
            }
        ]
    },

    // --- 6. EXODUS LOG: Black box with lore ---
    {
        id: 'EXODUS_LOG',
        weight: 10,
        title: "THE FLIGHT RECORDER",
        getShipName: () => EXODUS_SHIP_NAMES[Math.floor(Math.random() * EXODUS_SHIP_NAMES.length)],
        context: (shipName) => `Only the flight recorder is left of ${shipName}. The rest is a crater three kilometres wide. The recorder is armoured, and it survived.`,
        dialogue: [
            { speaker: 'Tech Mira', text: "There are weeks of logs on this. Aura can read them, if you say so, Commander." },
            { speaker: 'A.U.R.A.', text: "Decoding the full log costs 10 Energy, Commander. I can read the header for free." }
        ],
        choices: [
            {
                text: "Let A.U.R.A. decode the full log",
                desc: "-10 Energy. +15 Salvage, +1 Data. You hear the whole log.",
                requires: (state) => state.energy >= 10,
                requiresLabel: "Need 10 Energy",
                effect: (state) => {
                    state.energy -= 10;
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 15);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;
                    const loreBlocks = [
                        [
                            "CREW BRIEFING, RECORDED: 'Eight ships went this way before you. You are the ninth.' It's our briefing, word for word. But their hull number isn't nine.",
                            "Every crew was told the same three things: you are the ninth, a good world is ahead, and the ship knows the way.",
                            "The ship set the course. Nobody on board was ever shown where it ends."
                        ],
                        [
                            "CAPTAIN'S LOG: 'We found a wreck with our mission patch today. Its hull number is higher than ours, but it's much older.'",
                            "'I asked the ship how that was possible. It said: you were not sent further than the others, Captain.'",
                            "'You were sent less far back in time. The drive sends every ship into the past, and each new ship goes further back.'"
                        ],
                        [
                            "ENGINEERING REPORT: 'After every jump, our clock and the star positions disagree. The manual doesn't explain it.'",
                            "MEDICAL LOG: 'Twelve percent of the sleep pods will fail. That's three of our people. I've decided not to tell them who.'",
                            "LAST MESSAGE FROM EARTH: 'The next ship launches on schedule. If you can hear this, it's already ahead of you. Keep going.'"
                        ]
                    ];
                    const block = loreBlocks[Math.floor(Math.random() * loreBlocks.length)];
                    block.forEach(line => state.addLog(line));
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(1, 'Full decryption — honored their data');
                    state.noteStanding && state.noteStanding('mira');
                    return "Full log decoded. We keep the decoding hardware. -10 Energy, +15 Salvage, +1 Data.";
                }
            },
            {
                text: "Read the header only",
                desc: "Free. +10 Salvage. You hear one line of the log.",
                effect: (state) => {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 10);
                    const fragments = [
                        "LOG HEADER: 'Hull number [damaged]. The ship says eight went before us. We haven't heard from any of them.'",
                        "LOG HEADER: 'Day 400. Morale is low. The captain has stopped reading the daily report out loud.'",
                        "LOG HEADER: 'We passed another wreck today. The captain told us not to look at its number.'"
                    ];
                    state.addLog(fragments[Math.floor(Math.random() * fragments.length)]);
                    return "Header read. The recorder's casing stripped for parts. +10 Salvage.";
                }
            }
        ]
    },

    // --- 7. PARTIALLY OPERATIONAL: They landed and tried to stay ---
    {
        id: 'EXODUS_PARTIAL',
        weight: 15,
        title: "THE FENCE",
        getShipName: () => EXODUS_SHIP_NAMES[Math.floor(Math.random() * EXODUS_SHIP_NAMES.length)],
        context: (shipName) => `${shipName} landed safely. The crew came out and tried to settle: half-built shelters, a fence, a well. Then the work just stops. Some decks still have power.`,
        dialogue: [
            { speaker: 'Eng. Jaxon', text: "They built a fence. You don't build a fence unless you plan to stay." },
            { speaker: 'Dr. Aris', text: "Their journals and drawings are everywhere. I want their names before we take anything." },
            { speaker: 'Spc. Vance', text: "Whatever stopped them came fast. They didn't finish anything. Let's take what we need." }
        ],
        choices: [
            {
                text: "Read the names, then salvage",
                desc: "-1 Ration. +25 Salvage, +1 Data. Aris adds their names to her list.",
                effect: (state) => {
                    state.rations = Math.max(0, state.rations - 1);
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 25);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;
                    state.addLog("SHELTER LOG: 'Don't build until you've tested the soil. The ground here moves.'");
                    state.addLog("Five names, copied from five journals into the notebook where Dr. Aris keeps the dead.");
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(1, 'Took the names before the parts');
                    state.noteStanding && state.noteStanding('aris');
                    return "Names kept, parts taken after. -1 Ration, +25 Salvage, +1 Data.";
                }
            },
            {
                text: "Strip it deck by deck",
                desc: "-10 Energy. +50 Salvage, +1 Food Pack, +1 Music Holotape. Aris +1 Stress.",
                requires: (state) => state.energy >= 10,
                requiresLabel: "Need 10 Energy",
                effect: (state) => {
                    state.energy -= 10;
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 50);
                    if (typeof ITEMS !== 'undefined') {
                        if (ITEMS.FOOD_PACK) state.cargo.push({ ...ITEMS.FOOD_PACK, acquiredAt: 'Exodus Wreck' });
                        if (ITEMS.MUSIC_HOLOTAPE) state.cargo.push({ ...ITEMS.MUSIC_HOLOTAPE, acquiredAt: 'Exodus Wreck' });
                    }
                    const aris = state.crew.find(c => c.tags && c.tags.includes('MEDIC') && c.status !== 'DEAD');
                    if (aris) aris.stress = Math.min(3, (aris.stress || 0) + 1);
                    state.addLog("Their journals go into the scrap bin with the wall panels.");
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(-1, 'Stripped a settlement without the names');
                    return "Stripped deck by deck. -10 Energy, +50 Salvage, +1 Food Pack, +1 Music Holotape.";
                }
            },
            {
                text: "Search engineering for parts",
                desc: "-5 Energy. 40% chance: +1 Tech Fragment, +15 Salvage. Otherwise +10 Salvage.",
                requires: (state) => state.energy >= 5,
                requiresLabel: "Need 5 Energy",
                effect: (state) => {
                    state.energy -= 5;
                    if (Math.random() < 0.4) {
                        if (typeof ITEMS !== 'undefined' && ITEMS.TECH_FRAGMENT) {
                            state.cargo.push({ ...ITEMS.TECH_FRAGMENT, acquiredAt: 'Exodus Wreck' });
                        }
                        state.salvage = Math.min(state.maxSalvage, state.salvage + 15);
                        return "The engine bay has parts that fit our ship. +1 Tech Fragment, +15 Salvage. -5 Energy.";
                    }
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 10);
                    return "The engine bay is too damaged. Only small parts. +10 Salvage. -5 Energy.";
                }
            }
        ]
    }
];
