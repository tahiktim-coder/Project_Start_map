const ITEMS = {
    // Biological
    RADIOTROPHIC_FUNGUS: {
        id: 'fungus', name: 'Radiation Fungus', type: 'CONSUMABLE', value: 15,
        desc: 'A fungus that feeds on radiation and stores it as energy. +15 Energy.',
        onUse: (state) => { state.energy = Math.min(100, state.energy + 15); return "Fed to the reactor. +15 Energy."; }
    },
    AMBER_SPECIMEN: {
        id: 'amber', name: 'Amber Specimen', type: 'ARTIFACT', value: 50,
        desc: 'A tiny insect trapped in amber a very long time ago. Holding it calms people down.',
        onUse: (state) => {
            const stressed = state.crew.filter(c => c.status !== 'DEAD' && c.stress > 0);
            if (stressed.length === 0) return "Nobody is stressed right now. The amber goes back in the hold.";
            // Reduce stress for most stressed crew member
            const target = stressed.reduce((a, b) => (a.stress > b.stress) ? a : b);
            target.stress = Math.max(0, target.stress - 1);
            return `${target.name} holds the amber up to the light for a while. ${target.name} -1 Stress.`;
        }
    },
    // Rocky/Barren
    GEODE_SAMPLE: {
        id: 'geode', name: 'Geode Sample', type: 'ARTIFACT', value: 40,
        desc: 'A plain rock that is hollow and full of crystals inside. Looking at it calms one person.',
        onUse: (state) => {
            const stressed = state.crew.filter(c => c.status !== 'DEAD' && c.stress > 0);
            if (stressed.length === 0) return "No one needs it today. The geode stays in its box.";
            const target = stressed.reduce((a, b) => (a.stress > b.stress) ? a : b);
            target.stress = Math.max(0, target.stress - 1);
            return `${target.name} turns the geode in the light for a long time. ${target.name} -1 Stress.`;
        }
    },
    OBSIDIAN_MONOLITH: {
        id: 'monolith', name: 'Black Glass Carving', type: 'ARTIFACT', value: 75,
        desc: 'A carving in black volcanic glass, cut at strange angles. Looking at it calms two people.',
        onUse: (state) => {
            // More powerful - reduces stress for TWO crew members
            const stressed = state.crew.filter(c => c.status !== 'DEAD' && c.stress > 0);
            if (stressed.length === 0) return "Nobody needs the carving right now. It goes back on the shelf.";
            // Sort by stress descending, take top 2
            stressed.sort((a, b) => b.stress - a.stress);
            const affected = stressed.slice(0, 2);
            affected.forEach(c => c.stress = Math.max(0, c.stress - 1));
            if (affected.length === 1) {
                return `${affected[0].name} sits with the carving for an hour. ${affected[0].name} -1 Stress.`;
            }
            return `${affected[0].name} and ${affected[1].name} sit with the carving for an hour. Both -1 Stress.`;
        }
    },
    // Ruins/Tech
    SCRAP_PLATING: {
        id: 'scrap', name: 'Scrap Plating', type: 'RESOURCE', value: 10,
        desc: 'Loose hull plating we can strip for metal. +15 Salvage.',
        onUse: (state) => { state.salvage += 15; return "Stripped down for metal. +15 Salvage."; }
    },
    TECH_FRAGMENT: {
        id: 'tech_frag', name: 'Tech Fragment', type: 'LORE', value: 100,
        desc: 'A data chip from a dead ship. A.U.R.A. can use it to check her own settings.',
        onUse: (state) => {
            // Reset A.U.R.A. ethics toward neutral if AuraSystem exists
            if (window.AuraSystem) {
                const oldTier = window.AuraSystem.getTier();
                window.AuraSystem.ethicsScore = Math.min(window.AuraSystem.ethicsScore + 3, 2);
                const newTier = window.AuraSystem.getTier();
                if (oldTier !== newTier) {
                    return `A.U.R.A.: "Thank you, Commander. I've checked my settings against it." A.U.R.A. now rates you ${newTier}.`;
                }
                return `A.U.R.A.: "That was useful, Commander. I've updated my settings." A.U.R.A. thinks better of you.`;
            }
            // Fallback if no AuraSystem - just give some salvage
            state.salvage += 20;
            return "We pulled useful plans off the chip. +20 Salvage.";
        }
    },

    // Condensed Resources (Found via Probe 5%)
    CONDENSED_SALVAGE: {
        id: 'condensed_salvage', name: 'Condensed Salvage', type: 'RESOURCE_PACK', value: 50,
        desc: 'A lump of pure metal the size of a fist, pressed dense by the planet. +50 Salvage.',
        onUse: (state) => { state.salvage += 50; return "Broken down for metal. +50 Salvage."; }
    },
    IONIZED_BATTERY: {
        id: 'ion_battery', name: 'Overcharged Battery', type: 'RESOURCE_PACK', value: 30,
        desc: 'A big, full energy cell. Unstable, so use it soon. +30 Energy.',
        onUse: (state) => { state.energy = Math.min(100, state.energy + 30); return "Drained into the reactor. +30 Energy."; }
    },
    // Fungus Culture (passive ration generator — NOT the consumable fungus above)
    FUNGUS_CULTURE: {
        id: 'FUNGUS_CULTURE', name: 'Fungus Culture', type: 'LIVING', value: 80,
        desc: 'A sealed tray of fungus that feeds on radiation and grows food. It gives +1 Ration every 3 major actions.',
        onUse: null // Passive effect handled by GameState.consumeRation()
    },
    // Food Pack (ration recovery)
    WILD_HARVEST: {
        id: 'wild_harvest', name: 'Wild Harvest', type: 'LIVING', value: 8,
        desc: 'Roots and fruit Dr. Aris has tested twice. Not tasty. Safe.',
        onUse: (state) => { state.rations = Math.min(state.maxRations, state.rations + 2); return "Cooked and shared. +2 Rations."; }
    },
    STORM_CRYSTAL: {
        id: 'storm_crystal', name: 'Storm Crystal', type: 'ARTIFACT', value: 25,
        desc: 'A crystal formed by lightning. It hums in your hand, and the reactor can run on it. +20 Energy.',
        onUse: (state) => { state.energy = Math.min(100, state.energy + 20); return "Fed to the reactor. +20 Energy."; }
    },
    BRIEFING_TAPE: {
        id: 'briefing_tape', name: 'Uncut Briefing Tape', type: 'DOCUMENT', value: 0, isKept: true,
        desc: 'It has our programme\'s seal on the label. It is the briefing film we were shown before launch, but this copy is longer.',
        onUse: (state) => { if (window.StoryReel) window.StoryReel.play('uncut'); return "You play the tape again."; }
    },
    DISC_DRAWING: {
        id: 'disc_drawing', name: 'Drawing of the Disc', type: 'DOCUMENT', value: 0, isKept: true,
        desc: 'A page folded into a dead ship\'s logbook. It shows a gold disc, a star map and two figures. Someone wrote in the margin.',
        onUse: (state) => { if (window.DiscDocument) window.DiscDocument.open(window.app); return "You unfold the page."; }
    },
    MEDKIT: {
        id: 'medkit', name: 'Field Medkit', type: 'CONSUMABLE', value: 25,
        desc: 'A sealed trauma kit. Heals one injured crew member.',
        onUse: (state) => {
            const hurt = state.crew.find(c => c.status === 'INJURED');
            if (!hurt) return "Nobody is hurt. The kit stays sealed.";
            hurt.status = 'HEALTHY';
            return `${hurt.name} is patched up and back on duty.`;
        }
    },
    ALIEN_ARTIFACT: {
        id: 'alien_artifact', name: 'Strange Object', type: 'ARTIFACT', value: 80,
        desc: 'Nobody aboard can say who made it or what it is for. It is warm. Studying it gives +2 Data.',
        onUse: (state) => { state._colonyKnowledge = (state._colonyKnowledge || 0) + 2; return "Hours of study, and a few answers. +2 Data."; }
    },
    FOOD_PACK: {
        id: 'food_pack', name: 'Sealed Food Pack', type: 'CONSUMABLE', value: 10,
        desc: 'Vacuum-sealed food from an earlier ship. Still safe to eat. +3 Rations.',
        onUse: (state) => { state.rations = Math.min(state.maxRations, state.rations + 3); return "Opened and shared out. +3 Rations."; }
    },
    // Luxury Item (stress reducer)
    LUXURY_CHOCOLATE: {
        id: 'chocolate', name: 'Chocolate Bar', type: 'CONSUMABLE', value: 15,
        desc: 'Real chocolate from home. It tastes of something other than ship food. Calms one person.',
        onUse: (state) => {
            const stressed = state.crew.filter(c => c.status !== 'DEAD' && c.stress > 0);
            if (stressed.length > 0) {
                const target = stressed.reduce((a, b) => (a.stress > b.stress) ? a : b);
                target.stress = Math.max(0, target.stress - 1);
                return `${target.name} eats it slowly, one square at a time. ${target.name} -1 Stress.`;
            }
            return "Everyone is in a good mood. The chocolate can wait.";
        }
    },
    MUSIC_HOLOTAPE: {
        id: 'holotape', name: 'Music Holotape', type: 'CONSUMABLE', value: 20,
        desc: 'A recording of classical music from Earth. Brahms, according to the label. Calms the whole crew.',
        onUse: (state) => {
            let reduced = 0;
            state.crew.forEach(c => {
                if (c.status !== 'DEAD' && c.stress > 0) {
                    c.stress = Math.max(0, c.stress - 1);
                    reduced++;
                }
            });
            return reduced > 0 ? `The music plays through the whole ship. ${reduced} crew -1 Stress.` : "Everyone is already calm. The tape goes back on the shelf.";
        }
    },
    // Dark Artifacts
    XENO_MYCELIUM: {
        id: 'xeno_mycelium', name: 'Pulsing Spores', type: 'REVIVAL_BIO', value: 200,
        desc: 'A fungus that pulses and reacts to dead tissue. [Use on a dead crew member]',
        onUse: null // Special handling in App
    },
    NEURAL_LINK: {
        id: 'neural_link', name: 'Ancient Neural Link', type: 'REVIVAL_TECH', value: 250,
        desc: 'A fine wire mesh that takes over a failing nervous system. [Use on a dead crew member]',
        onUse: null // Special handling
    },

    // === SIGNAL TYPE SPECIAL ITEMS ===

    // ALIEN SIGNAL items (high risk, high reward)
    ALIEN_TRANSMITTER: {
        id: 'alien_transmitter', name: 'Humming Transmitter', type: 'ARTIFACT', value: 150,
        desc: 'A transmitter sending on frequencies nobody uses. +10 Energy, but it may give someone +1 Stress.',
        onUse: (state) => {
            state.energy = Math.min(100, state.energy + 10);
            // Random crew gets +1 stress from the unnerving frequencies
            const living = state.crew.filter(c => c.status !== 'DEAD');
            if (living.length > 0 && Math.random() > 0.5) {
                const target = living[Math.floor(Math.random() * living.length)];
                target.stress = Math.min(3, target.stress + 1);
                return `We drain its power. ${target.name} says they can hear voices in it. (+10 Energy, +1 Stress)`;
            }
            return "We drain its power. Nobody wants to think about who built it. (+10 Energy)";
        }
    },
    XENOTECH_COMPONENT: {
        id: 'xenotech', name: 'Unknown Machine Part', type: 'TECH', value: 200,
        desc: 'A machine part nobody aboard recognises. Breaking it down gives +30 Salvage.',
        onUse: (state) => {
            state.salvage = Math.min(state.maxSalvage, state.salvage + 30);
            return "Broken down for its metal. (+30 Salvage)";
        }
    },
    SIGNAL_DECODER: {
        id: 'signal_decoder', name: 'Signal Decoder', type: 'ARTIFACT', value: 120,
        desc: 'A device that picks up faint signals. Use it to scan every planet in this sector for free.',
        onUse: (state) => {
            // Reveal all unscanned planets in sector
            if (state.sectorNodes) {
                let revealed = 0;
                state.sectorNodes.forEach(p => {
                    if (!p.remoteScanned && !p.scanned) {
                        p.remoteScanned = true;
                        revealed++;
                    }
                });
                if (revealed > 0) {
                    return `Signal decoder switched on. ${revealed} planet(s) scanned for free.`;
                }
            }
            return "Signal decoder switched on. Every planet here was already scanned.";
        }
    },

    // ANCIENT RUINS items (lore + knowledge)
    STAR_CHART_FRAGMENT: {
        id: 'star_chart', name: 'Star Chart Fragment', type: 'ARTIFACT', value: 80,
        desc: 'Part of an old navigation chart. Warps cost 5% less from now on.',
        onUse: (state) => {
            state._warpDiscount = (state._warpDiscount || 0) + 5;
            return `Chart loaded. Warps cost 5% less. (${state._warpDiscount}% off in total)`;
        }
    },
    CULTURAL_ARTIFACT: {
        id: 'cultural_artifact', name: 'Old Keepsake', type: 'ARTIFACT', value: 60,
        desc: 'Something that belonged to people who are long gone. Talking about them calms the crew.',
        onUse: (state) => {
            // Reduce stress for the whole crew by thinking about how their problems are small
            let reduced = 0;
            state.crew.forEach(c => {
                if (c.status !== 'DEAD' && c.stress > 0) {
                    c.stress = Math.max(0, c.stress - 1);
                    reduced++;
                }
            });
            return reduced > 0
                ? `The crew passes it around and talks about the people who owned it. It helps. (-1 Stress for ${reduced} crew)`
                : "Everyone is fine. The keepsake stays in the hold.";
        }
    },
    ANCIENT_DATABASE: {
        id: 'ancient_database', name: 'Old Data Store', type: 'LORE', value: 100,
        desc: 'An intact data store full of technical plans. +25 Salvage, +10 Energy.',
        onUse: (state) => {
            // Gives significant salvage as you decode the schematics
            state.salvage = Math.min(state.maxSalvage, state.salvage + 25);
            state.energy = Math.min(100, state.energy + 10);
            return "Plans decoded. We use them to improve the power system. (+25 Salvage, +10 Energy)";
        }
    },

    // BIOLOGICAL signal items (life = hope)
    BIO_SAMPLE_RARE: {
        id: 'bio_sample_rare', name: 'Rare Bio-Sample', type: 'CONSUMABLE', value: 90,
        desc: 'A rare living sample that speeds up healing. Heals one injured crew member.',
        onUse: (state) => {
            const injured = state.crew.filter(c => c.status === 'INJURED');
            if (injured.length === 0) return "Nobody is injured right now.";
            const target = injured[0];
            target.status = 'HEALTHY';
            return `${target.name} is treated with it and is healthy again.`;
        }
    },
    SYMBIOTIC_CULTURE: {
        id: 'symbiotic_culture', name: 'Symbiotic Culture', type: 'LIVING', value: 120,
        desc: 'A helpful organism that lives with the crew and helps them get more from their food. Saves 1 ration every 5 actions.',
        onUse: null // Passive effect like fungus culture
    },

    // TECHNOLOGICAL signal items (machines = resources)
    SALVAGE_BEACON: {
        id: 'salvage_beacon', name: 'Salvage Beacon', type: 'TECH', value: 70,
        desc: 'A beacon that sends drones out to fetch nearby scrap. +15-34 Salvage.',
        onUse: (state) => {
            const amount = Math.floor(Math.random() * 20) + 15; // 15-35 salvage
            state.salvage = Math.min(state.maxSalvage, state.salvage + amount);
            return `Beacon switched on. Its drones bring back ${amount} Salvage.`;
        }
    },
    POWER_COUPLER: {
        id: 'power_coupler', name: 'Power Coupler', type: 'TECH', value: 55,
        desc: 'An efficient power connector. Plug it in for +25 Energy.',
        onUse: (state) => {
            state.energy = Math.min(100, state.energy + 25);
            return "Coupler plugged into the ship. +25 Energy.";
        }
    },
    REPAIR_DRONE: {
        id: 'repair_drone', name: 'Repair Drone', type: 'TECH', value: 150,
        desc: 'A small robot that can fix one damaged deck.',
        onUse: (state) => {
            const damaged = Object.entries(state.shipDecks).filter(([k, d]) => d.status === 'DAMAGED');
            if (damaged.length === 0) return "No deck needs repair right now.";
            const [deckKey, deck] = damaged[0];
            deck.status = 'OPERATIONAL';
            return `The repair drone fixed ${deck.label || deckKey.toUpperCase()}. It is working again.`;
        }
    }
};


/* Where a thing can exist. A surface trip (getProbeItem) draws only from rock / life / built; 'human' things come
   from wrecks, stations and dead colonies, where people once stocked a shelf. Shown on the cargo card as "found in". */
const ITEM_SOURCES = {
    rock: ['GEODE_SAMPLE', 'OBSIDIAN_MONOLITH', 'CONDENSED_SALVAGE', 'STORM_CRYSTAL'],
    life: ['RADIOTROPHIC_FUNGUS', 'AMBER_SPECIMEN', 'FUNGUS_CULTURE', 'XENO_MYCELIUM', 'BIO_SAMPLE_RARE', 'SYMBIOTIC_CULTURE', 'WILD_HARVEST'],
    built: ['SCRAP_PLATING', 'TECH_FRAGMENT', 'NEURAL_LINK', 'ALIEN_TRANSMITTER', 'XENOTECH_COMPONENT', 'SIGNAL_DECODER', 'STAR_CHART_FRAGMENT', 'CULTURAL_ARTIFACT', 'ANCIENT_DATABASE', 'ALIEN_ARTIFACT'],
    human: ['MEDKIT', 'FOOD_PACK', 'LUXURY_CHOCOLATE', 'MUSIC_HOLOTAPE', 'IONIZED_BATTERY', 'SALVAGE_BEACON', 'POWER_COUPLER', 'REPAIR_DRONE', 'DISC_DRAWING', 'BRIEFING_TAPE'],
};
const ITEM_SOURCE_WORDS = { rock: 'any solid world', life: 'living worlds', built: 'ruins and strange places', human: 'human wrecks and stations' };
Object.keys(ITEM_SOURCES).forEach(place => ITEM_SOURCES[place].forEach(key => {
    if (ITEMS[key]) { ITEMS[key].source = place; ITEMS[key].foundIn = ITEM_SOURCE_WORDS[place]; }
}));
