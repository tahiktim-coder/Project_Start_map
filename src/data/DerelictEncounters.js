/**
 * DERELICT ENCOUNTERS
 *
 * Pieces of Exodus hulls found drifting or crashed: mining tenders, cargo sections
 * dropped to make a burn, drive sections, probes fired back toward home, and one
 * wreck that is slightly wrong. Nothing else was ever sent down this heading.
 * Different from Exodus wrecks - less narrative weight, more varied loot.
 *
 * Found on planets with DERELICT tag or as floating POIs.
 * The `type` keys are kept as they were; only the text changed.
 *
 * Writing rules for this file: docs/STYLE.md. Plain sentences, no nicknames, no riddles.
 */

const DERELICT_TYPES = [
    'MINING_VESSEL',
    'CORPORATE_HAULER',
    'MILITARY_FRIGATE',
    'SCIENCE_PROBE',
    'ALIEN_CRAFT',
    'GENERATION_SHIP',
    'PIRATE_RAIDER'
];

const DERELICT_ENCOUNTERS = [
    // --- 1. MINING TENDER: a hull's rock-cutter, left mid-cut ---
    {
        id: 'DERELICT_MINING',
        weight: 25,
        type: 'MINING_VESSEL',
        title: "MINING CRAFT",
        getName: () => {
            const prefixes = ['ORE TENDER', 'ROCK BARGE', 'DRILL SLED', 'CUTTER'];
            const num = Math.floor(Math.random() * 90) + 10;
            return `${prefixes[Math.floor(Math.random() * prefixes.length)]} ${num}`;
        },
        context: (name) => `${name} is a small mining craft from a bigger ship. Its drill arms stopped mid-cut. The ore bays are half full. The main ship is nowhere on our scan.`,
        dialogue: [
            { speaker: 'Eng. Jaxon', text: "It was built to haul rock, not people. They put good engines in these." },
            { speaker: 'Tech Mira', text: "Its reactor is still running hot. Careful, it could be leaking radiation." }
        ],
        choices: [
            {
                text: "Cut open the ore bays",
                desc: "-5 Energy. +30-40 Salvage.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    const salvage = Math.floor(Math.random() * 11) + 30;
                    state.salvage = Math.min(state.maxSalvage, state.salvage + salvage);
                    return `Ore bays open. Raw metal and spare drill heads. -5 Energy, +${salvage} Salvage.`;
                }
            },
            {
                text: "Drain its reactor",
                desc: "-10 Energy to open it. +50-70 Energy back. 20% chance someone gets hurt.",
                requires: (state) => state.energy >= 10,
                requiresLabel: "Need 10 Energy",
                effect: (state) => {
                    state.energy -= 10;
                    if (Math.random() < 0.2) {
                        const team = state.crew.filter(c => c.status === 'HEALTHY' && !c.tags.includes('LEADER'));
                        if (team.length > 0) {
                            const victim = team[Math.floor(Math.random() * team.length)];
                            victim.status = 'INJURED';
                            state.addLog(`RADIATION: ${victim.name} was exposed on the way out.`);
                        }
                    }
                    const energyGain = Math.floor(Math.random() * 21) + 50;
                    state.energy = Math.min(100, state.energy + energyGain);
                    return `Its reactor power moved into ours. +${energyGain} Energy, +${energyGain - 10} after the cost.`;
                }
            },
            {
                text: "Check the crew bunks",
                desc: "+10 Salvage, +1 Data. 40% chance: +1 Food Pack.",
                effect: (state) => {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 10);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;
                    state.addLog("Personal lockers by the bunks. The crew's names are copied off the doors.");
                    if (Math.random() < 0.4 && typeof ITEMS !== 'undefined' && ITEMS.FOOD_PACK) {
                        state.cargo.push({ ...ITEMS.FOOD_PACK, acquiredAt: 'Mining Tender' });
                        return "Bunks searched and names copied. +10 Salvage, +1 Data, +1 Food Pack.";
                    }
                    return "Bunks searched and names copied. +10 Salvage, +1 Data.";
                }
            }
        ]
    },

    // --- 2. CARGO SECTION: dropped to make a burn ---
    {
        id: 'DERELICT_HAULER',
        weight: 20,
        type: 'CORPORATE_HAULER',
        title: "DROPPED CARGO",
        getName: () => {
            const kinds = ['CARGO SECTION', 'HOLD MODULE', 'DROP POD'];
            return `${kinds[Math.floor(Math.random() * kinds.length)]} ${Math.floor(Math.random() * 99) + 1}`;
        },
        context: (name) => `${name} is a cargo section, cut loose from its ship and left to drift. They dropped it to save weight for a burn. The seals held.`,
        dialogue: [
            { speaker: 'Spc. Vance', text: "They cut off their own supplies to go faster. What were they in such a hurry to reach?" },
            { speaker: 'Dr. Aris', text: "There's a sealed medical bay at the back. The supplies might still be good." }
        ],
        choices: [
            {
                text: "Cut into the main hold",
                desc: "-5 Energy. +30 Salvage, +2 Food Pack.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 30);
                    if (typeof ITEMS !== 'undefined' && ITEMS.FOOD_PACK) {
                        state.cargo.push({ ...ITEMS.FOOD_PACK, acquiredAt: 'Dropped Hold' });
                        state.cargo.push({ ...ITEMS.FOOD_PACK, acquiredAt: 'Dropped Hold' });
                    }
                    return "Hold opened. The colony supplies are still sealed. -5 Energy, +30 Salvage, +2 Food Pack.";
                }
            },
            {
                text: "Open the medical bay",
                desc: "-5 Energy. Heals one injured crew member. If nobody is hurt: +1 Revival Item.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    const injured = state.crew.find(c => c.status === 'INJURED');
                    if (injured) {
                        injured.status = 'HEALTHY';
                        return `Medical supplies used on ${injured.name}. They're fit for duty again. -5 Energy.`;
                    }
                    if (typeof ITEMS !== 'undefined') {
                        const revival = Math.random() > 0.5 ? ITEMS.XENO_MYCELIUM : ITEMS.NEURAL_LINK;
                        if (revival) {
                            state.cargo.push({ ...revival, acquiredAt: 'Dropped Hold' });
                            return `Nobody needs treatment. In the back locker: ${revival.name}. -5 Energy.`;
                        }
                    }
                    return "The medical bay was emptied before it was dropped. -5 Energy.";
                }
            },
            {
                text: "Read the cargo list",
                desc: "-5 Energy. +2 Data. It names the ship that dropped it.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 2;
                    state.addLog("CARGO LIST: 'Dropped to lose weight for the last burn. We will come back for it.' They never did.");
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(1, 'Kept the manifest');
                    return "Cargo list copied. The ship's hull number is stamped on every crate. -5 Energy, +2 Data.";
                }
            }
        ]
    },

    // --- 3. DRIVE SECTION: the armoured third that survived ---
    {
        id: 'DERELICT_MILITARY',
        weight: 10,
        type: 'MILITARY_FRIGATE',
        title: "DRIVE SECTION",
        getName: () => {
            const names = ['HALCYON', 'VESPER', 'TANTALUS', 'EMBER', 'REQUIEM'];
            return `DRIVE SECTION "${names[Math.floor(Math.random() * names.length)]}"`;
        },
        context: (name) => `${name} is the armoured rear section of a ship. When the drive failed, it tore the crew deck away. Only the strongest part is left.`,
        dialogue: [
            { speaker: 'Spc. Vance', text: "I know this armour plating. I watched them fit it at the shipyard before we launched." },
            { speaker: 'A.U.R.A.', text: "Please be careful, Commander. Drive capacitors can hold a charge for decades." }
        ],
        choices: [
            {
                text: "Vance opens the capacitor vault",
                desc: "+25 Salvage, +1 Tech Fragment. 10% chance Vance gets hurt.",
                requires: (state) => state.crew.some(c => c.tags.includes('SECURITY') && c.status !== 'DEAD'),
                requiresLabel: "Requires Vance",
                effect: (state) => {
                    const vance = state.crew.find(c => c.tags.includes('SECURITY') && c.status !== 'DEAD');
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 25);
                    if (typeof ITEMS !== 'undefined' && ITEMS.TECH_FRAGMENT) {
                        state.cargo.push({ ...ITEMS.TECH_FRAGMENT, acquiredAt: 'Drive Section' });
                    }
                    if (vance && vance.status === 'HEALTHY' && Math.random() < 0.10) {
                        vance.status = 'INJURED';
                        state.addLog(`${vance.name} took a shock from the last capacitor. INJURED.`);
                        return `${vance.name} opened the vault, but got hurt doing it. +25 Salvage, +1 Tech Fragment.`;
                    }
                    return `${vance.name} opened the vault safely. +25 Salvage, +1 Tech Fragment.`;
                }
            },
            {
                text: "Strip the drive shielding",
                desc: "-1 Ration: two days of cutting. +35 Salvage, +20 Energy.",
                effect: (state) => {
                    state.rations = Math.max(0, state.rations - 1);
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 35);
                    state.energy = Math.min(100, state.energy + 20);
                    return "Shielding cut and stored over two days. -1 Ration, +35 Salvage, +20 Energy.";
                }
            },
            {
                text: "Read the drive log",
                desc: "-10 Energy. Shows every planet's tags in this sector.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 10);
                    if (state.sectorNodes) {
                        state.sectorNodes.forEach(p => {
                            p._tagsRevealed = true;
                        });
                    }
                    state.addLog("DRIVE LOG: every jump this ship made was on the same heading as ours.");
                    return "Drive log read. Every planet's tags are now on the map. -10 Energy.";
                }
            }
        ]
    },

    // --- 4. HOMEWARD PROBE: fired back toward Earth, got this far ---
    {
        id: 'DERELICT_PROBE',
        weight: 15,
        type: 'SCIENCE_PROBE',
        title: "MESSAGE PROBE",
        getName: () => {
            const missions = ['MESSENGER', 'PIONEER', 'HORIZON', 'DEEP FIELD', 'HOMEWARD'];
            return `${missions[Math.floor(Math.random() * missions.length)]}-${Math.floor(Math.random() * 50) + 1}`;
        },
        context: (name) => `${name} is a message probe. A ship fired it back toward Earth, but it only got this far. Its antenna still points home.`,
        dialogue: [
            { speaker: 'Tech Mira', text: "Look, its fuel tank is still full. The second engine never fired." },
            { speaker: 'A.U.R.A.', text: "Its heading is correct, Commander. Earth is that way. It has not moved in a long time." },
            { speaker: 'Spc. Vance', text: "Play the message. I want to hear what they wanted Earth to know." }
        ],
        choices: [
            {
                text: "Play the message",
                desc: "-5 Energy. +2 Data. All crew +1 Stress.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 2;
                    state.crew.forEach(c => {
                        if (c.status !== 'DEAD') c.stress = Math.min(3, (c.stress || 0) + 1);
                    });
                    state.addLog("PROBE MESSAGE: 'To Earth. How many ships have you really sent? Tell us the truth.' Then static.");
                    if (state.crew.some(c => c.tags && c.tags.includes('SECURITY') && c.status !== 'DEAD')) {
                        state.addLog("Spc. Vance: \"They asked the same question I would have.\"");
                    }
                    state.noteStanding && state.noteStanding('vance');
                    return "Message played to the whole crew. -5 Energy, +2 Data. All crew +1 Stress.";
                }
            },
            {
                text: "Take the sample containers",
                desc: "-5 Energy. +1 Sample Item: whatever they were sending home.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    if (typeof ITEMS !== 'undefined') {
                        const samples = [ITEMS.AMBER_SPECIMEN, ITEMS.RADIOTROPHIC_FUNGUS, ITEMS.GEODE_SAMPLE].filter(i => i);
                        const item = samples[Math.floor(Math.random() * samples.length)];
                        if (item) {
                            state.cargo.push({ ...item, acquiredAt: 'Homeward Probe' });
                            return `The sample container is intact. Inside: ${item.name}. -5 Energy.`;
                        }
                    }
                    return "The sample containers are cracked. Everything inside is gone. -5 Energy.";
                }
            },
            {
                text: "Salvage the probe",
                desc: "+20 Salvage, +15 Energy from its fuel. Aris +1 Stress: the message is never heard.",
                effect: (state) => {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 20);
                    state.energy = Math.min(100, state.energy + 15);
                    const aris = state.crew.find(c => c.tags && c.tags.includes('MEDIC') && c.status !== 'DEAD');
                    if (aris) aris.stress = Math.min(3, (aris.stress || 0) + 1);
                    return "Probe cut up, fuel drained. Nobody will hear its message now. +20 Salvage, +15 Energy.";
                }
            }
        ]
    },

    // --- 5. THE WRONG WRECK: a copy, slightly wrong ---
    {
        id: 'DERELICT_ALIEN',
        weight: 5,
        type: 'ALIEN_CRAFT',
        title: "THE WRONG WRECK",
        getName: () => {
            return `UNMARKED-${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}-${Math.floor(Math.random() * 999)}`;
        },
        context: (name) => `${name} is an Exodus ship with no hull number painted on it. The welds are perfect. Inside are four bunks and four cups. The bread on the table has no crust.`,
        dialogue: [
            { speaker: 'Tech Mira', text: "Aura says it matches our ship's blueprints exactly, Commander. Every measurement." },
            { speaker: 'Spc. Vance', text: "I've watched ships being built. They never come out this perfect. This is a copy." },
            { speaker: 'Dr. Aris', text: "No bodies and no names. Nobody ever lived here." }
        ],
        choices: [
            {
                text: "Cut plating off it",
                desc: "+50 Salvage. All crew +1 Stress: the metal is warm.",
                effect: (state) => {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 50);
                    state.crew.forEach(c => {
                        if (c.status !== 'DEAD') c.stress = Math.min(3, (c.stress || 0) + 1);
                    });
                    state.addLog("The plating is warm, which makes no sense in open space. It cuts just like ours.");
                    return "Plating stored. +50 Salvage. All crew +1 Stress.";
                }
            },
            {
                text: "Copy its course",
                desc: "-5 Energy. 30% chance someone gets hurt (+1 Stress). Otherwise +3 Data: its course.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    if (Math.random() < 0.3) {
                        const team = state.crew.filter(c => c.status === 'HEALTHY' && !c.tags.includes('LEADER'));
                        if (team.length > 0) {
                            const victim = team[Math.floor(Math.random() * team.length)];
                            victim.status = 'INJURED';
                            victim.stress = Math.min(3, (victim.stress || 0) + 1);
                            return `The console gave off a shock. ${victim.name} INJURED. -5 Energy.`;
                        }
                    }
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 3;
                    state._alienNavData = true;
                    state.addLog("NAV: one heading, plotted from start to finish. It's our heading. It ends at a bright light.");
                    return "Course copied. It's the same course as ours. -5 Energy, +3 Data.";
                }
            },
            {
                text: "Seal it and leave",
                desc: "-10 Energy. Nothing taken. Vance -1 Stress, Mira +1 Stress.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 10);
                    const vance = state.crew.find(c => c.tags && c.tags.includes('SECURITY') && c.status !== 'DEAD');
                    const mira = state.crew.find(c => c.tags && c.tags.includes('SPECIALIST') && c.status !== 'DEAD');
                    if (vance) vance.stress = Math.max(0, (vance.stress || 0) - 1);
                    if (mira) mira.stress = Math.min(3, (mira.stress || 0) + 1);
                    if (mira) state.addLog("We sealed the airlock and left. Tech Mira watched it from the rear window the whole way.");
                    return "Wreck sealed and left behind. -10 Energy. Vance -1 Stress, Mira +1 Stress.";
                }
            }
        ]
    },

    // --- 6. THE LONG HULL: they never landed, so they lived aboard ---
    {
        id: 'DERELICT_GENERATION',
        weight: 5,
        type: 'GENERATION_SHIP',
        title: "THE LONG HULL",
        getName: () => {
            const names = ['"LONG HOME"', '"THIRD SUMMER"', '"STILL GOING"', '"THE RING"', '"FAR SHORE"'];
            return `EXODUS ${names[Math.floor(Math.random() * names.length)]}`;
        },
        context: (name) => `${name} kept flying for three generations. They built living rings, a nursery and a school. Now it's broken in half. The front half is a frozen town.`,
        dialogue: [
            { speaker: 'Dr. Aris', text: "People were born here, lived here and were buried here. I want the names from their graves." },
            { speaker: 'Eng. Jaxon', text: "Three generations, and none of them ever stood on a planet. That's a long wait." },
            { speaker: 'A.U.R.A.', text: "There is a cryo bay in the front section, Commander. I estimate a three percent chance any pod still works." }
        ],
        choices: [
            {
                text: "Search the living rings",
                desc: "-1 Ration: a day inside. +35 Salvage, +3 Food Pack, +1 Music Holotape.",
                effect: (state) => {
                    state.rations = Math.max(0, state.rations - 1);
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 35);
                    if (typeof ITEMS !== 'undefined') {
                        if (ITEMS.FOOD_PACK) {
                            state.cargo.push({ ...ITEMS.FOOD_PACK, acquiredAt: 'Long Hull' });
                            state.cargo.push({ ...ITEMS.FOOD_PACK, acquiredAt: 'Long Hull' });
                            state.cargo.push({ ...ITEMS.FOOD_PACK, acquiredAt: 'Long Hull' });
                        }
                        if (ITEMS.MUSIC_HOLOTAPE) {
                            state.cargo.push({ ...ITEMS.MUSIC_HOLOTAPE, acquiredAt: 'Long Hull' });
                        }
                    }
                    state.addLog("RING LOG: 'The children born this year have never seen the stars. They think the wall paintings are windows.'");
                    return "Rings searched. -1 Ration, +35 Salvage, +3 Food Pack, +1 Music Holotape.";
                }
            },
            {
                text: "Check the cryo bay",
                desc: "3% chance: two pods still work, +2 Sleepers, -5 Rations. Otherwise +20 Salvage, +25 Energy.",
                effect: (state) => {
                    if (Math.random() < 0.03) {
                        state.rations = Math.max(0, state.rations - 5);
                        state._sleepers = (state._sleepers || 0) + 2;
                        state.addLog("Two pods still work. The names on them are spelled in a way we barely recognise. Their ship isn't in any of our records.");
                        return "Two sleepers moved to our hold, still asleep. -5 Rations to keep them cold. +2 Sleepers.";
                    }
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 20);
                    state.energy = Math.min(100, state.energy + 25);
                    return "Every pod is dead. The cryo equipment is stripped for parts. +20 Salvage, +25 Energy.";
                }
            },
            {
                text: "Read the graves in the ring",
                desc: "-1 Ration: Aris reads every grave marker. +2 Data. Aris +1 Stress.",
                effect: (state) => {
                    state.rations = Math.max(0, state.rations - 1);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 2;
                    const aris = state.crew.find(c => c.tags && c.tags.includes('MEDIC') && c.status !== 'DEAD');
                    if (aris) aris.stress = Math.min(3, (aris.stress || 0) + 1);
                    state.addLog("RING RECORD: 'Food is shared by deck, not by rank. It worked for sixty years. Then it stopped working.'");
                    if (aris) state.addLog("Dr. Aris reads three hundred names out loud. By the end, she has almost no voice left.");
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(1, 'Read the graves of the long hull');
                    state.noteStanding && state.noteStanding('aris');
                    return "Every grave read. -1 Ration, +2 Data. Aris +1 Stress.";
                }
            }
        ]
    }
];

// Export for use
if (typeof window !== 'undefined') {
    window.DERELICT_ENCOUNTERS = DERELICT_ENCOUNTERS;
    window.DERELICT_TYPES = DERELICT_TYPES;
}
