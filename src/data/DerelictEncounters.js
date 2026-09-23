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
        title: "ORE TENDER",
        getName: () => {
            const prefixes = ['ORE TENDER', 'ROCK BARGE', 'DRILL SLED', 'CUTTER'];
            const num = Math.floor(Math.random() * 90) + 10;
            return `${prefixes[Math.floor(Math.random() * prefixes.length)]} ${num}`;
        },
        context: (name) => `${name} is a mining tender off a bigger hull. Drill arms frozen mid-cut. Ore bays half full. The mother ship is nowhere on the scan.`,
        dialogue: [
            { speaker: 'Eng. Jaxon', text: "A goat like ours, but for rocks. Call it the Mule." },
            { speaker: 'Tech Mira', text: "And here we see a hot core. They were refining something that bites." }
        ],
        choices: [
            {
                text: "Cut open the ore bays",
                desc: "-5 Energy. +30-40 Salvage.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    const salvage = Math.floor(Math.random() * 11) + 30;
                    state.salvage = Math.min(state.maxSalvage, state.salvage + salvage);
                    return `Ore bays cut open. Raw metal and spare drill heads. -5 Energy, +${salvage} Salvage.`;
                }
            },
            {
                text: "Drain the reactor",
                desc: "-10 Energy to crack it. 20% chance someone gets hurt. +50-70 Energy.",
                requires: (state) => state.energy >= 10,
                requiresLabel: "Need 10 Energy",
                effect: (state) => {
                    state.energy -= 10;
                    if (Math.random() < 0.2) {
                        const team = state.crew.filter(c => c.status === 'HEALTHY' && !c.tags.includes('LEADER'));
                        if (team.length > 0) {
                            const victim = team[Math.floor(Math.random() * team.length)];
                            victim.status = 'INJURED';
                            state.addLog(`RADIATION: ${victim.name} took a dose on the way out.`);
                        }
                    }
                    const energyGain = Math.floor(Math.random() * 21) + 50;
                    state.energy = Math.min(100, state.energy + energyGain);
                    return `Reactor drained into the kettle. +${energyGain} Energy, net +${energyGain - 10}.`;
                }
            },
            {
                text: "Check the bunks",
                desc: "+10 Salvage, +1 Data. 40% chance: +1 Food Pack.",
                effect: (state) => {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 10);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;
                    state.addLog("Four bunks. Five lockers. Dr. Aris copies the names off the lockers.");
                    if (Math.random() < 0.4 && typeof ITEMS !== 'undefined' && ITEMS.FOOD_PACK) {
                        state.cargo.push({ ...ITEMS.FOOD_PACK, acquiredAt: 'Mining Tender' });
                        return "Bunks searched. Names copied. +10 Salvage, +1 Data, +1 Food Pack.";
                    }
                    return "Bunks searched. Names copied. +10 Salvage, +1 Data.";
                }
            }
        ]
    },

    // --- 2. CARGO SECTION: dropped to make a burn ---
    {
        id: 'DERELICT_HAULER',
        weight: 20,
        type: 'CORPORATE_HAULER',
        title: "DROPPED HOLD",
        getName: () => {
            const kinds = ['CARGO SECTION', 'HOLD MODULE', 'DROP POD'];
            return `${kinds[Math.floor(Math.random() * kinds.length)]} ${Math.floor(Math.random() * 99) + 1}`;
        },
        context: (name) => `${name} is a hull's cargo section, cut loose and left to drift. Somebody dropped it to make a burn. The seals held. The manifest terminal still flickers.`,
        dialogue: [
            { speaker: 'Spc. Vance', text: "Manifest says forty crates. I count forty. Somebody out here could count." },
            { speaker: 'Dr. Aris', text: "There's a med bay aft. Sealed. It might still be good." }
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
                    return "Hold breached. Colony stores still sealed. -5 Energy, +30 Salvage, +2 Food Pack.";
                }
            },
            {
                text: "Open the med bay",
                desc: "-5 Energy. Heals one injured crew. If nobody is hurt: +1 Revival Item.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    const injured = state.crew.find(c => c.status === 'INJURED');
                    if (injured) {
                        injured.status = 'HEALTHY';
                        return `Med bay stores used on ${injured.name}. Back on duty. -5 Energy.`;
                    }
                    if (typeof ITEMS !== 'undefined') {
                        const revival = Math.random() > 0.5 ? ITEMS.XENO_MYCELIUM : ITEMS.NEURAL_LINK;
                        if (revival) {
                            state.cargo.push({ ...revival, acquiredAt: 'Dropped Hold' });
                            return `Nobody to treat. Sealed in the aft locker: ${revival.name}. -5 Energy.`;
                        }
                    }
                    return "Med bay picked clean before it was dropped. -5 Energy.";
                }
            },
            {
                text: "Read the manifest",
                desc: "-5 Energy. +2 Data. It names the hull that dropped it.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 2;
                    state.addLog("MANIFEST: 'Dropped to lighten for the last burn. We will come back for it.' Nobody came back for it.");
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(1, 'Kept the manifest');
                    return "Manifest copied. The hull number is written on every crate. -5 Energy, +2 Data.";
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
        context: (name) => `${name} is the armoured back third of a hull. The drive took the crew deck with it when it went. What's left is the strong part.`,
        dialogue: [
            { speaker: 'Spc. Vance', text: "Eight hundred rivets a metre. I know this plating. I set some of it in the yard." },
            { speaker: 'A.U.R.A.', text: "Careful, Commander. Drive capacitors hold their charge a long time." }
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
                        state.addLog(`${vance.name} took a discharge off the last capacitor. INJURED.`);
                        return `${vance.name} opened the vault and paid for it. +25 Salvage, +1 Tech Fragment.`;
                    }
                    return `${vance.name} counts the bolts off in order. Vault open. +25 Salvage, +1 Tech Fragment.`;
                }
            },
            {
                text: "Strip the drive shielding",
                desc: "-1 Ration: two days of cutting. +35 Salvage, +20 Energy.",
                effect: (state) => {
                    state.rations = Math.max(0, state.rations - 1);
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 35);
                    state.energy = Math.min(100, state.energy + 20);
                    return "Shielding cut and stowed over two days. -1 Ration, +35 Salvage, +20 Energy.";
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
                    state.addLog("DRIVE LOG: every burn, every heading. All of them the same heading. The nav map fills in.");
                    return "Drive log read. Every planet's tags are on the map. -10 Energy.";
                }
            }
        ]
    },

    // --- 4. HOMEWARD PROBE: fired back toward Earth, got this far ---
    {
        id: 'DERELICT_PROBE',
        weight: 15,
        type: 'SCIENCE_PROBE',
        title: "HOMEWARD PROBE",
        getName: () => {
            const missions = ['MESSENGER', 'PIONEER', 'HORIZON', 'DEEP FIELD', 'HOMEWARD'];
            return `${missions[Math.floor(Math.random() * missions.length)]}-${Math.floor(Math.random() * 50) + 1}`;
        },
        context: (name) => `${name} is a message probe. A hull fired it back the way we came, toward Earth. It got this far. Its antenna still points home.`,
        dialogue: [
            { speaker: 'Tech Mira', text: "And here we see a probe pointed home. Full tank. It never fired its second stage." },
            { speaker: 'A.U.R.A.', text: "Its heading is correct, Commander. Earth is that way. It has not moved in a long time." },
            { speaker: 'Spc. Vance', text: "Play the message. I want to hear somebody else say it." }
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
                    state.addLog("PROBE MESSAGE: 'To Earth. There are more than eight. Stop sending them.' Then a hull number, then static.");
                    state.addLog("Spc. Vance: \"Somebody else counted.\"");
                    state.noteStanding && state.noteStanding('vance');
                    return "Message played to the whole crew. -5 Energy, +2 Data. All crew +1 Stress.";
                }
            },
            {
                text: "Take the sample containers",
                desc: "-5 Energy. +1 Sample Item, whatever they were sending home.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    if (typeof ITEMS !== 'undefined') {
                        const samples = [ITEMS.AMBER_SPECIMEN, ITEMS.RADIOTROPHIC_FUNGUS, ITEMS.GEODE_SAMPLE].filter(i => i);
                        const item = samples[Math.floor(Math.random() * samples.length)];
                        if (item) {
                            state.cargo.push({ ...item, acquiredAt: 'Homeward Probe' });
                            return `Sample container intact. Retrieved: ${item.name}. -5 Energy.`;
                        }
                    }
                    return "Sample containers breached. Contents lost to vacuum. -5 Energy.";
                }
            },
            {
                text: "Salvage the probe",
                desc: "+20 Salvage, +15 Energy from its tank. Aris +1 Stress: the message is lost.",
                effect: (state) => {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 20);
                    state.energy = Math.min(100, state.energy + 15);
                    const aris = state.crew.find(c => c.tags && c.tags.includes('MEDIC') && c.status !== 'DEAD');
                    if (aris) aris.stress = Math.min(3, (aris.stress || 0) + 1);
                    return "Probe cut up. Tank drained. Whatever it carried home, nobody will hear it. +20 Salvage, +15 Energy.";
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
        context: (name) => `${name} is an Exodus hull with no number painted anywhere. The welds are perfect. There are no rivets. Inside: four bunks, four cups. The bread on the table has no crust.`,
        dialogue: [
            { speaker: 'Tech Mira', text: "Aura says it matches our plans exactly, Commander. She sounds pleased." },
            { speaker: 'Spc. Vance', text: "No rivets. You can't build a hull without rivets. I've counted eight hundred a metre." },
            { speaker: 'Dr. Aris', text: "No bodies. No names. There is nothing here to read." }
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
                    state.addLog("The plating is warm. It should not be warm in vacuum. It cuts like ours.");
                    return "Plating stowed. +50 Salvage. All crew +1 Stress.";
                }
            },
            {
                text: "Copy its course",
                desc: "-5 Energy. 30% chance someone gets hurt. Else +3 Data: its course, which is ours.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    if (Math.random() < 0.3) {
                        const team = state.crew.filter(c => c.status === 'HEALTHY' && !c.tags.includes('LEADER'));
                        if (team.length > 0) {
                            const victim = team[Math.floor(Math.random() * team.length)];
                            victim.status = 'INJURED';
                            victim.stress = Math.min(3, (victim.stress || 0) + 1);
                            return `The console discharged. ${victim.name} INJURED. -5 Energy.`;
                        }
                    }
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 3;
                    state._alienNavData = true;
                    state.addLog("NAV: one heading, plotted end to end. Ours. It ends at a light.");
                    return "Course copied. It is our course. -5 Energy, +3 Data.";
                }
            },
            {
                text: "Seal it and burn away",
                desc: "-10 Energy. Vance -1 Stress, Mira +1 Stress. Nothing taken.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 10);
                    const vance = state.crew.find(c => c.tags && c.tags.includes('SECURITY') && c.status !== 'DEAD');
                    const mira = state.crew.find(c => c.tags && c.tags.includes('SPECIALIST') && c.status !== 'DEAD');
                    if (vance) vance.stress = Math.max(0, (vance.stress || 0) - 1);
                    if (mira) mira.stress = Math.min(3, (mira.stress || 0) + 1);
                    state.addLog("We sealed the lock and burned. Tech Mira watched it out of the aft port the whole way.");
                    return "Wreck sealed. -10 Energy. Vance -1 Stress, Mira +1 Stress.";
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
        context: (name) => `${name} kept flying for three generations. They built rings, nurseries, a school. It is broken in half now. The forward half is a town, frozen.`,
        dialogue: [
            { speaker: 'Dr. Aris', text: "Born here, lived here, buried here. The graves are in the ring. I want the names." },
            { speaker: 'Eng. Jaxon', text: "They never landed, so they made a place anyway. I'd have stayed." },
            { speaker: 'A.U.R.A.', text: "Cryo bay in the forward section, Commander. Three percent chance any pod is still cold." }
        ],
        choices: [
            {
                text: "Search the habitation rings",
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
                    state.addLog("RING LOG: 'The children born this cycle have never seen stars. They think the murals are windows.'");
                    return "Rings searched. -1 Ration, +35 Salvage, +3 Food Pack, +1 Music Holotape.";
                }
            },
            {
                text: "Check the cryo bay",
                desc: "3% chance: two pods still cold, -5 Rations, +2 Sleepers. Else +20 Salvage, +25 Energy.",
                effect: (state) => {
                    if (Math.random() < 0.03) {
                        state.rations = Math.max(0, state.rations - 5);
                        state._sleepers = (state._sleepers || 0) + 2;
                        state.addLog("Two pods are still cold. The name tags use spellings we barely recognise. Their hull is in no record we carry.");
                        return "Two sleepers moved to our hold, still asleep. -5 Rations to keep them cold. +2 Sleepers.";
                    }
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 20);
                    state.energy = Math.min(100, state.energy + 25);
                    return "Every pod dark. Cryo systems stripped for parts. +20 Salvage, +25 Energy.";
                }
            },
            {
                text: "Read the graves in the ring",
                desc: "-1 Ration: Aris reads every marker. +2 Data. Aris +1 Stress.",
                effect: (state) => {
                    state.rations = Math.max(0, state.rations - 1);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 2;
                    const aris = state.crew.find(c => c.tags && c.tags.includes('MEDIC') && c.status !== 'DEAD');
                    if (aris) aris.stress = Math.min(3, (aris.stress || 0) + 1);
                    state.addLog("RING LEDGER: 'Rations shared by deck, not by rank. It held for sixty years. Then it didn't.'");
                    state.addLog("Dr. Aris reads three hundred names. She is hoarse by the end. She reads the last one twice.");
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
