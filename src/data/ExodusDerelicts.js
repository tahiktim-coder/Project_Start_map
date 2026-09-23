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
        context: (shipName) => `${shipName} came in too steep. The hull burned through on entry. The crew deck is slag. Only the transponder is still pinging.`,
        dialogue: [
            { speaker: 'Eng. Jaxon', text: "Carbon scoring end to end. It was fast. That's the kind thing to say." },
            { speaker: 'Spc. Vance', text: "Transponder lists a crew of four. I count five seats." },
            { speaker: 'Dr. Aris', text: "Four names on the transponder. I'll read them anyway. Someone should." }
        ],
        choices: [
            {
                text: "Read the names, take the transponder",
                desc: "-1 Ration. +10 Salvage, +1 Data. Aris says the rites over slag.",
                effect: (state) => {
                    state.rations = Math.max(0, state.rations - 1);
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 10);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;
                    const loreTexts = [
                        "TRANSPONDER: '...entry angle off by a third of a degree. That was all it took.'",
                        "TRANSPONDER: '...shielding rated for three entries. This was our fourth.'",
                        "TRANSPONDER: crew list. Four names. The pilot's seat is not on it."
                    ];
                    state.addLog(loreTexts[Math.floor(Math.random() * loreTexts.length)]);
                    state.addLog("Dr. Aris reads the four names into the wind. Then she waits, as if for a fifth.");
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(1, 'Read the names of the lost');
                    state.noteStanding && state.noteStanding('aris');
                    return "Names read. Transponder recovered. -1 Ration, +10 Salvage, +1 Data.";
                }
            },
            {
                text: "Strip the alloys",
                desc: "-5 Energy. +25 Salvage. Aris +1 Stress: nothing gets read.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 25);
                    const aris = state.crew.find(c => c.tags && c.tags.includes('MEDIC') && c.status !== 'DEAD');
                    if (aris) aris.stress = Math.min(3, (aris.stress || 0) + 1);
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(-1, 'Stripped a wreck without rites');
                    return "Hull fragments cut and stowed. -5 Energy, +25 Salvage. Aris does not come back up for an hour.";
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
        context: (shipName) => `${shipName} landed whole. The hull is sealed, the air still cycling. Inside, five people at five stations. No wounds. No struggle. They stopped.`,
        dialogue: [
            { speaker: 'Dr. Aris', text: "They're at peace. Whatever it was, it was gentle." },
            { speaker: 'Spc. Vance', text: "Five chairs, five bodies. The plate by the airlock lists four. I counted twice." },
            { speaker: 'Eng. Jaxon', text: "Hold's full. Medicine, rations, tools. And a coffee tin. Real coffee." },
            { speaker: 'Dr. Aris', text: "Kael. They get rites first." }
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
                        "SHIP LOG: '...the scrubbers went slowly. Nobody noticed. We had turned the alarms off to save power.'",
                        "SHIP LOG: '...the ship still says four of us. We stopped arguing with it.'"
                    ];
                    state.addLog(loreTexts[Math.floor(Math.random() * loreTexts.length)]);
                    state.addLog("Dr. Aris reads five names over five graves. The plate said four. She reads five.");
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(1, 'Buried a crew and left their hold');
                    state.noteStanding && state.noteStanding('aris');
                    return "Five graves dug. Logs copied. -1 Ration, -5 Energy, +2 Data.";
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
                    state.addLog("We carried their food out past them. Dr. Aris carried nothing.");
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(-2, 'Stripped a crew still in their chairs');
                    return "Ship stripped. +40 Salvage, +1 Food Pack. Aris +2 Stress.";
                }
            },
            {
                text: "Bury them, then empty the hold",
                desc: "-1 Ration, -10 Energy. +20 Salvage, +1 Food Pack. Aris +1 Stress: she does the rites alone.",
                effect: (state) => {
                    state.rations = Math.max(0, state.rations - 1);
                    state.energy = Math.max(0, state.energy - 10);
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 20);
                    if (typeof ITEMS !== 'undefined' && ITEMS.FOOD_PACK) {
                        state.cargo.push({ ...ITEMS.FOOD_PACK, acquiredAt: 'Exodus Wreck' });
                    }
                    const aris = state.crew.find(c => c.tags && c.tags.includes('MEDIC') && c.status !== 'DEAD');
                    if (aris) aris.stress = Math.min(3, (aris.stress || 0) + 1);
                    state.addLog("Dr. Aris digs while the rest of us load. She does not ask for help. Nobody offers.");
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
        context: (shipName) => `${shipName} has one live circuit: the cryo bay. Three pods, three green lights, three heartbeats. Every other deck is dark and cold.`,
        dialogue: [
            { speaker: 'Tech Mira', text: "Three sleepers. Pods at two percent. Another month and they'd never have known." },
            { speaker: 'Dr. Aris', text: "We can't wake them. Nobody can, out here. But we can keep them cold." },
            { speaker: 'Eng. Jaxon', text: "Each of those batteries would fill the kettle twice. I'm only saying the number." },
            { speaker: 'Spc. Vance', text: "Three pods is three rations of cold. I did the sum." }
        ],
        choices: [
            {
                text: "Carry all three pods",
                desc: "-3 Rations. +3 Sleepers in the hold. Nothing else taken.",
                effect: (state) => {
                    state.rations = Math.max(0, state.rations - 3);
                    state._sleepers = (state._sleepers || 0) + 3;
                    state.addLog("Three pods lashed down in the hold. Three green lights. Dr. Aris writes their names on the lids.");
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(1, 'Carried the sleepers');
                    return "Three sleepers aboard, still asleep. -3 Rations to keep them cold.";
                }
            },
            {
                text: "Take the cryo batteries",
                desc: "+70 Energy. The three sleepers die. All crew +1 Stress.",
                effect: (state) => {
                    state.energy = Math.min(100, state.energy + 70);
                    state.crew.forEach(c => {
                        if (c.status !== 'DEAD') c.stress = Math.min(3, (c.stress || 0) + 1);
                    });
                    state.addLog("Dr. Aris: \"You're killing them. You know that.\"");
                    state.addLog("You do not answer her. They were already dead. They just did not know it yet.");
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(-2, 'Killed sleepers for power');
                    return "Cryo batteries extracted. +70 Energy. The green lights turn red, then dark.";
                }
            },
            {
                text: "Take one battery, carry two",
                desc: "+25 Energy, -2 Rations. +2 Sleepers. One pod goes dark. Aris +1 Stress.",
                effect: (state) => {
                    state.energy = Math.min(100, state.energy + 25);
                    state.rations = Math.max(0, state.rations - 2);
                    state._sleepers = (state._sleepers || 0) + 2;
                    const aris = state.crew.find(c => c.tags && c.tags.includes('MEDIC') && c.status !== 'DEAD');
                    if (aris) aris.stress = Math.min(3, (aris.stress || 0) + 1);
                    state.addLog("Dr. Aris chooses which pod. She does not say how. She reads that one name twice.");
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(-1, 'Traded one sleeper for two');
                    return "Two sleepers aboard. One battery in the kettle. +25 Energy, -2 Rations.";
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
        context: (shipName) => `${shipName}'s decks are wrecked, but the hold is sealed and dry. Crates, stacked and labelled. A note on the top one: for whoever comes next.`,
        dialogue: [
            { speaker: 'Eng. Jaxon', text: "They packed this for us. Labelled it. Call it the Pantry." },
            { speaker: 'Tech Mira', text: "And here we see somebody's handwriting. Neat. They took their time." },
            { speaker: 'Spc. Vance', text: "Twelve crates. Manifest says twelve. First thing out here that adds up." }
        ],
        choices: [
            {
                text: "Take everything",
                desc: "+30 Salvage, +2 Food Pack, +1 Luxury Item. Jaxon +1 Stress: nothing left for the next ship.",
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
                    state.addLog("Eng. Jaxon folds the note and puts it in his pocket. He does not say anything.");
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
                    state.addLog("Eng. Jaxon writes the date and five names on the lid, and seals the hold.");
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
        context: (shipName) => `${shipName} is furred white inside. The hydroponics deck kept growing after the crew stopped. The airlock is half eaten. Under the growth, the lab is still powered.`,
        dialogue: [
            { speaker: 'Dr. Aris', text: "Their own garden did this. Nobody touches anything bare-handed." },
            { speaker: 'Tech Mira', text: "And here we see the lab, still lit. Fungus doesn't pay the power bill." },
            { speaker: 'Spc. Vance', text: "Four suits in the locker. Five of us. One stays on the ship. Me." }
        ],
        choices: [
            {
                text: "Aris leads a decon team in",
                desc: "+35 Salvage, +1 Bio Sample. 15% chance someone gets hurt.",
                requires: (state) => state.crew.some(c => c.tags.includes('MEDIC') && c.status !== 'DEAD'),
                requiresLabel: "Requires Aris",
                effect: (state) => {
                    const hasMedic = state.crew.some(c => c.tags.includes('MEDIC') && c.status !== 'DEAD');
                    if (!hasMedic) {
                        return "No medic aboard. Nobody goes in without decontamination.";
                    }
                    if (Math.random() < 0.15) {
                        const team = state.crew.filter(c => c.status === 'HEALTHY' && !c.tags.includes('LEADER'));
                        if (team.length > 0) {
                            const victim = team[Math.floor(Math.random() * team.length)];
                            victim.status = 'INJURED';
                            state.addLog(`WARNING: ${victim.name} breathed spores on the way out. Quarantine started.`);
                        }
                    }
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 35);
                    if (typeof ITEMS !== 'undefined') {
                        const revivalItem = Math.random() > 0.5 ? ITEMS.XENO_MYCELIUM : ITEMS.FUNGUS_CULTURE;
                        state.cargo.push({ ...revivalItem, acquiredAt: 'Exodus Wreck (Infected)' });
                        state.addLog(`Recovered: ${revivalItem.name}`);
                    }
                    return "Decon complete. Lab equipment and a live sample brought out. +35 Salvage.";
                }
            },
            {
                text: "Burn it from orbit",
                desc: "+10 Energy from the burn. Aris +1 Stress. Nothing recovered.",
                effect: (state) => {
                    state.energy = Math.min(100, state.energy + 10);
                    const aris = state.crew.find(c => c.tags && c.tags.includes('MEDIC') && c.status !== 'DEAD');
                    if (aris) aris.stress = Math.min(3, (aris.stress || 0) + 1);
                    state.addLog("Eng. Jaxon: \"Burn it. Some things don't get a name.\"");
                    return "Orbital lance fired. The growth blackens and goes out. +10 Energy.";
                }
            },
            {
                text: "Harvest spores from the airlock",
                desc: "-5 Energy. 40% chance someone gets hurt. Else +1 Spore Sample.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    if (Math.random() < 0.4) {
                        const team = state.crew.filter(c => c.status === 'HEALTHY' && !c.tags.includes('LEADER'));
                        if (team.length > 0) {
                            const victim = team[Math.floor(Math.random() * team.length)];
                            victim.status = 'INJURED';
                            state.addLog(`CRITICAL: ${victim.name} infected during the harvest. Emergency decon.`);
                        }
                        return "Containment breach. Sample lost in the evacuation. -5 Energy.";
                    }
                    if (typeof ITEMS !== 'undefined' && ITEMS.XENO_MYCELIUM) {
                        state.cargo.push({ ...ITEMS.XENO_MYCELIUM, acquiredAt: 'Exodus Wreck (Infected)' });
                    }
                    return "Spore sample sealed and stowed. -5 Energy.";
                }
            }
        ]
    },

    // --- 6. EXODUS LOG: Black box with lore ---
    {
        id: 'EXODUS_LOG',
        weight: 10,
        title: "THE BLACK BOX",
        getShipName: () => EXODUS_SHIP_NAMES[Math.floor(Math.random() * EXODUS_SHIP_NAMES.length)],
        context: (shipName) => `Only the flight recorder is left of ${shipName}. The ship is a crater three kilometres wide. The box is armoured. It kept.`,
        dialogue: [
            { speaker: 'Tech Mira', text: "Weeks of log in one crystal. Aura can read it, Commander. She'd like to." },
            { speaker: 'A.U.R.A.', text: "Full decryption costs 10 Energy, Commander. I can read the header for nothing." }
        ],
        choices: [
            {
                text: "Let A.U.R.A. decrypt the full log",
                desc: "-10 Energy. +15 Salvage, +1 Data. The whole log, read aloud.",
                requires: (state) => state.energy >= 10,
                requiresLabel: "Need 10 Energy",
                effect: (state) => {
                    state.energy -= 10;
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 15);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;
                    const loreBlocks = [
                        [
                            "CREW BRIEFING, RECORDED: 'Eight went this way before you. You are the ninth on this heading.' Word for word, our briefing. The hull number on the recording is not nine.",
                            "Every crew is told the same three things: you are the ninth, the world is ahead of you, and the ship knows the way.",
                            "The course was set by the ship. Nobody aboard was ever shown where it ends."
                        ],
                        [
                            "CAPTAIN'S LOG: 'We found a wreck today with our mission patch on it. Same colours. A higher number than ours. Older rust.'",
                            "'I asked the ship how a hull built after us could have died before we were born. It said: you were not thrown further away than they were, Captain. You were thrown less far back.'",
                            "'They did not send us to find a home. They sent us to get there first.'"
                        ],
                        [
                            "ENGINEERING REPORT: 'The drive does two things. The manual only describes one of them.'",
                            "MEDICAL OFFICER'S LOG: 'Cryo failure rate: 12%. That means three of our people won't wake up. I've already decided not to tell them who.'",
                            "LAST MESSAGE FROM EARTH: '...launch window for the next hull is confirmed. If you can hear this, it is already ahead of you. Keep going. Godspeed, Exodus. All of you.'"
                        ]
                    ];
                    const block = loreBlocks[Math.floor(Math.random() * loreBlocks.length)];
                    block.forEach(line => state.addLog(line));
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(1, 'Full decryption — honored their data');
                    state.noteStanding && state.noteStanding('mira');
                    return "Full log read. Encryption hardware kept. -10 Energy, +15 Salvage, +1 Data.";
                }
            },
            {
                text: "Read the header only",
                desc: "+10 Salvage. One line of the log. Free.",
                effect: (state) => {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 10);
                    const fragments = [
                        "LOG HEADER: '...we are hull [CORRUPTED]. The ship says eight went before us. None have reported in.'",
                        "LOG HEADER: '...the children born in transit call the ship world. Maybe that's better.'",
                        "LOG HEADER: '...manifest says four. Five of us eat. We stopped correcting it.'"
                    ];
                    state.addLog(fragments[Math.floor(Math.random() * fragments.length)]);
                    return "Header read. Box casing stripped for parts. +10 Salvage.";
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
        context: (shipName) => `${shipName} landed on its gear. The crew came out and tried to stay. Half-built shelters, a fence, a well. Then nothing. Some decks still have power.`,
        dialogue: [
            { speaker: 'Eng. Jaxon', text: "Look at that. They built a fence. Somebody meant to stay." },
            { speaker: 'Dr. Aris', text: "Their things are everywhere. Journals. Drawings. I want their names before we take anything." },
            { speaker: 'Spc. Vance', text: "Fifty post-holes. They got to twenty. Focus on what we can use." }
        ],
        choices: [
            {
                text: "Read the names, then salvage",
                desc: "-1 Ration. +25 Salvage, +1 Data. Aris keeps the list.",
                effect: (state) => {
                    state.rations = Math.max(0, state.rations - 1);
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 25);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;
                    state.addLog("SHELTER LOG: 'Don't build before you know the soil. The ground here moves.'");
                    state.addLog("Dr. Aris reads five names off five journals. She adds them to her list.");
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
                    state.addLog("The journals go in the scrap bin with the panelling. Dr. Aris fishes one out and keeps it.");
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(-1, 'Stripped a settlement without the names');
                    return "Full strip. -10 Energy, +50 Salvage, +1 Food Pack, +1 Music Holotape.";
                }
            },
            {
                text: "Search engineering for parts",
                desc: "-5 Energy. 40% chance: +1 Tech Fragment, +15 Salvage. Else +10 Salvage.",
                requires: (state) => state.energy >= 5,
                requiresLabel: "Need 5 Energy",
                effect: (state) => {
                    state.energy -= 5;
                    if (Math.random() < 0.4) {
                        if (typeof ITEMS !== 'undefined' && ITEMS.TECH_FRAGMENT) {
                            state.cargo.push({ ...ITEMS.TECH_FRAGMENT, acquiredAt: 'Exodus Wreck' });
                        }
                        state.salvage = Math.min(state.maxSalvage, state.salvage + 15);
                        return "Compatible parts in the engine bay. Jaxon calls them the Spares. +1 Tech Fragment, +15 Salvage. -5 Energy.";
                    }
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 10);
                    return "Engine bay too far gone. Minor parts only. +10 Salvage. -5 Energy.";
                }
            }
        ]
    }
];
