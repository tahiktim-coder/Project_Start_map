/**
 * ANOMALY ENCOUNTERS
 *
 * Things the light at the end of the heading has read and made again.
 * The copies are slightly wrong: no roots on the grass, four names on every
 * plate, four figures walking, our own hull with our own number on it.
 * Nothing here chases the ship. Nothing here is alien. It is all ours, returned.
 * High risk, high reward, high narrative impact.
 *
 * Found in Sector 4+ with ANOMALY tag, or triggered by the wrong wreck's nav data.
 */

// Helper: Test-aware chance (bad outcomes in test mode)
function _anomalyTestChance(chance) {
    if (window.TEST_MODE) return chance > 0;
    return Math.random() < chance;
}

const ANOMALY_ENCOUNTERS = [
    // --- 1. THE FOLD: the same sky twice ---
    {
        id: 'ANOMALY_FOLD',
        weight: 20,
        title: "THE FOLD",
        context: () => `The stars ahead repeat. The same six, then the same six again, a hand's width over. A.U.R.A. plots our position in two places. Both check.`,
        dialogue: [
            { speaker: 'Tech Mira', text: "And here we see the same rock twice, Commander. Same crater. Same shadow." },
            { speaker: 'A.U.R.A.', text: "Two positions, Commander. Both correct. I have no third fix to break the tie." },
            { speaker: 'Spc. Vance', text: "Six stars. Then the same six. I counted them four times." }
        ],
        choices: [
            {
                text: "Send the probe through the seam",
                desc: "Probe lost. +30 Energy from the seam. All crew +1 Stress.",
                effect: (state) => {
                    state.probeIntegrity = 0; // Probe destroyed
                    state.energy = Math.min(100, state.energy + 30);
                    state.crew.forEach(c => {
                        if (c.status !== 'DEAD') c.stress = Math.min(3, (c.stress || 0) + 1);
                    });
                    state.addLog("PROBE: the far side is this side. Its camera shows our hull. Then our hull again, from the other seam.");
                    state.addLog("The probe signal stops. Then starts. It is still sending, from both places. The kettle drinks the bleed.");
                    return "Probe gone into the seam. +30 Energy. All crew +1 Stress.";
                }
            },
            {
                text: "Fly through it",
                desc: "40% chance: thrown to THE WRONG PLACE, someone gets hurt, all crew +1 Stress. 60% chance: skip 1-2 sectors ahead for 0 Energy.",
                effect: (state) => {
                    if (_anomalyTestChance(0.4)) {
                        // BAD OUTCOME - thrown to THE WRONG PLACE
                        const team = state.crew.filter(c => c.status === 'HEALTHY' && !c.tags.includes('LEADER'));
                        if (team.length > 0) {
                            const victim = team[Math.floor(Math.random() * team.length)];
                            victim.status = 'INJURED';
                            victim.stress = 3;
                            state.addLog(`${victim.name} was thrown against the bulkhead on the way through. They will not say which side we came out on.`);
                        }

                        // Create THE WRONG PLACE as its own isolated "sector"
                        const hellPlanet = {
                            id: 'WRONG_PLACE_' + Date.now(),
                            name: 'THE WRONG PLACE',
                            type: 'WRONG_PLACE',
                            desc: 'This is not where we meant to go. The stars are wrong. Time moves strangely. We need to leave.',
                            gravity: '???',
                            atmosphere: 'IMPOSSIBLE',
                            temperature: 'NEGATIVE KELVIN',
                            fuelCost: 0,
                            scanned: true,
                            tags: ['WRONG_PLACE'],
                            resources: { metals: 0, energy: 0 },
                            metrics: { hasLife: true, hasTech: true },
                            mapData: { x: 50, y: 50 },
                            _isWrongPlace: true,
                            _returnSector: state.currentSector // Remember where we came from
                        };

                        // Replace sector with just this planet
                        state._previousSectorNodes = state.sectorNodes;
                        state._previousSector = state.currentSector;
                        state.sectorNodes = [hellPlanet];
                        state.currentSystem = hellPlanet;
                        state.lastVisitedSystem = hellPlanet;
                        state._inWrongPlace = true;

                        state.addLog("=== WRONG SIDE OF THE SEAM ===");
                        state.addLog("We came out somewhere else. The stars match no chart.");
                        state.addLog("A.U.R.A.: 'I have two positions for us, Commander. Neither is on the chart. I am working on it.'");
                        state.addLog("There is a wreck here. It has our transponder code.");
                        state.crew.forEach(c => {
                            if (c.status !== 'DEAD') c.stress = Math.min(3, (c.stress || 0) + 1);
                        });

                        // Trigger visual teleport effect and view refresh
                        window.dispatchEvent(new CustomEvent('anomaly-teleport', { detail: { destination: hellPlanet, type: 'WRONG_PLACE' } }));

                        return "The seam threw us out in THE WRONG PLACE. All crew +1 Stress.";
                    }

                    // GOOD OUTCOME - Jump 1-2 sectors ahead!
                    const currentSector = state.currentSector || 1;
                    const jump = Math.random() < 0.5 ? 1 : 2; // 50% chance of 1 or 2 sector jump
                    const targetSector = Math.min(6, currentSector + jump);

                    if (targetSector > currentSector) {
                        // Generate the new sector
                        if (typeof PlanetGenerator !== 'undefined') {
                            state.sectorNodes = PlanetGenerator.generateSector(targetSector);
                            state.currentSector = targetSector;

                            // Apply sector entry effects
                            const config = (typeof SECTOR_CONFIG !== 'undefined') ? SECTOR_CONFIG[targetSector] : null;
                            if (config && config.hazard && config.hazard.onSectorEnter) {
                                config.hazard.onSectorEnter(state, state.sectorNodes);
                            }

                            // Pick a random planet to arrive at
                            const arrival = state.sectorNodes[Math.floor(Math.random() * state.sectorNodes.length)];
                            state.currentSystem = arrival;
                            state.lastVisitedSystem = arrival;

                            state.addLog("=== THROUGH THE SEAM ===");
                            state.addLog("The six stars closed up behind us. Ahead, a sky we have not seen.");
                            state.addLog(`Spc. Vance: "${jump === 1 ? 'One sector' : 'Two sectors'}. I counted the jump. Nobody paid for it."`);
                            state.addLog(`Now entering: SECTOR ${targetSector}`);

                            // Trigger visual teleport effect
                            window.dispatchEvent(new CustomEvent('anomaly-teleport', { detail: { destination: arrival, type: 'FOLD_SUCCESS', sectorJump: jump } }));

                            return `Through the seam. Jumped ${jump} sector${jump > 1 ? 's' : ''} ahead to Sector ${targetSector}. 0 Energy.`;
                        }
                    }

                    return "The seam closed before we reached it. We are where we were.";
                }
            },
            {
                text: "Log it and go around",
                desc: "-10 Energy to go the long way. +2 Data.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 10);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 2;
                    state.addLog("Tech Mira logs both positions. A.U.R.A.: 'Filed, Commander. I have marked one of them as ours. I chose at random.'");
                    return "Went around the fold. -10 Energy, +2 Data.";
                }
            }
        ]
    },

    // --- 2. THE WHISPER: a voice on the dead channels ---
    {
        id: 'ANOMALY_WHISPER',
        weight: 15,
        title: "THE WHISPER",
        context: () => `Nothing on the scan. A voice on every channel. It sounds like A.U.R.A. It says Commander. It gets our names right and the count wrong, and it is not her.`,
        dialogue: [
            { speaker: 'Tech Mira', text: "That's her voice. Aura, is that you?" },
            { speaker: 'A.U.R.A.', text: "No, Commander. I am here. That one is quoting me. It has my crew count exactly." },
            { speaker: 'Dr. Aris', text: "It's reading names. Names off my list. And names I haven't read yet." }
        ],
        choices: [
            {
                text: "Let one of us answer it",
                desc: "30% chance: the listener goes to Stress 3. 40% chance: +2 Data, listener +1 Stress. 30% chance: listener healed, Stress 0.",
                requires: (state) => state.crew.some(c => c.status !== 'DEAD' && !c.tags.includes('LEADER')),
                requiresLabel: "Requires available crew",
                effect: (state) => {
                    const candidates = state.crew.filter(c => c.status !== 'DEAD' && !c.tags.includes('LEADER'));

                    const listener = candidates[Math.floor(Math.random() * candidates.length)];
                    // In test mode, force interesting outcomes
                    const roll = window.TEST_MODE ? 0.1 : Math.random();

                    if (roll < 0.3) {
                        // Bad: it got in
                        listener.stress = 3;
                        state.addLog(`${listener.name} listened a long time. They say it told them the count. They will not say which number.`);
                        return `${listener.name} answered the voice and came back wrong. Stress 3.`;
                    } else if (roll < 0.7) {
                        // Neutral: Knowledge
                        state._colonyKnowledge = (state._colonyKnowledge || 0) + 2;
                        listener.stress = Math.min(3, (listener.stress || 0) + 1);
                        state.addLog(`${listener.name}: "It read me a list. Hulls, and where they lie. I wrote down what I could."`);
                        return `${listener.name} took down a list of hulls. +2 Data. ${listener.name} +1 Stress.`;
                    } else {
                        // Good: too calm
                        listener.stress = 0;
                        if (listener.status === 'INJURED') listener.status = 'HEALTHY';
                        state.addLog(`${listener.name}: "It said my name back. Correctly. That was all. I feel fine. I feel very fine."`);
                        return `${listener.name} came back calm and whole. Stress 0.`;
                    }
                }
            },
            {
                text: "Have A.U.R.A. answer it",
                desc: "-5 Energy. 25% chance: +20 Salvage, +2 Food Pack, all crew +1 Stress. 25% chance: all planets revealed. 25% chance: all crew +1 Stress. Else nothing.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    const roll = window.TEST_MODE ? 0.1 : Math.random();
                    state.noteStanding && state.noteStanding('mira');
                    if (roll < 0.25) {
                        state.salvage = Math.min(state.maxSalvage, state.salvage + 20);
                        if (typeof ITEMS !== 'undefined' && ITEMS.FOOD_PACK) {
                            state.cargo.push({ ...ITEMS.FOOD_PACK, acquiredAt: 'The Whisper' });
                            state.cargo.push({ ...ITEMS.FOOD_PACK, acquiredAt: 'The Whisper' });
                        }
                        state.crew.forEach(c => {
                            if (c.status !== 'DEAD') c.stress = Math.min(3, (c.stress || 0) + 1);
                        });
                        state.addLog("An hour after she answers, a crate drifts up to the lock. Our crate. Our lot numbers. The seals unbroken.");
                        return "A crate came back. Ours. -5 Energy, +20 Salvage, +2 Food Pack. All crew +1 Stress.";
                    } else if (roll < 0.5) {
                        state.sectorNodes?.forEach(p => {
                            p.remoteScanned = true;
                            p._tagsRevealed = true;
                        });
                        state.addLog("It reads her the sector, body by body, in her own voice. She writes it down. Tech Mira: 'See? She's helping.'");
                        return "The sector, read to A.U.R.A. -5 Energy. All planets revealed.";
                    } else if (roll < 0.75) {
                        state.addLog("A.U.R.A.: 'It has stopped, Commander. I said hello and gave my crew count. It said them back, and went quiet.'");
                        return "A.U.R.A. answered. It went quiet. -5 Energy.";
                    } else {
                        state.crew.forEach(c => {
                            if (c.status !== 'DEAD') c.stress = Math.min(3, (c.stress || 0) + 1);
                        });
                        state.addLog("It answers in five voices. Ours. A.U.R.A.: 'That is not my crew count, Commander. I have logged the difference.'");
                        return "It answered in our voices. -5 Energy. All crew +1 Stress.";
                    }
                }
            },
            {
                text: "Jam every channel and go",
                desc: "-10 Energy. Nothing heard. Vance -1 Stress.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 10);
                    const vance = state.crew.find(c => c.tags && c.tags.includes('SECURITY') && c.status !== 'DEAD');
                    if (vance) vance.stress = Math.max(0, (vance.stress || 0) - 1);
                    state.addLog("Static on every channel until it is behind us. Spc. Vance keeps his hand on the switch the whole way.");
                    return "Channels jammed. The voice is gone. -10 Energy. Vance -1 Stress.";
                }
            }
        ]
    },

    // --- 3. THE MIRROR: our own hull, made again ---
    {
        id: 'ANOMALY_MIRROR',
        weight: 15,
        title: "THE MIRROR",
        context: () => `Another hull, close. Our number on it. Our transponder. Through the ports, four figures at four stations, looking back. They wave when we wave.`,
        dialogue: [
            { speaker: 'A.U.R.A.', text: "It has my callsign, Commander. It answers my handshake before I finish sending it." },
            { speaker: 'Spc. Vance', text: "Four in the windows. Four. I count five on this side." },
            { speaker: 'Tech Mira', text: "And here we see us, Commander. Aura's pleased. She says it's a friend." }
        ],
        choices: [
            {
                text: "Hail it",
                desc: "-5 Energy. +1 Data. One planet revealed. All crew +1 Stress.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;
                    state.crew.forEach(c => {
                        if (c.status !== 'DEAD') c.stress = Math.min(3, (c.stress || 0) + 1);
                    });
                    // Reveal resource info for best planet
                    const best = state.sectorNodes?.reduce((a, b) =>
                        ((b.resources?.metals || 0) + (b.resources?.energy || 0)) >
                        ((a.resources?.metals || 0) + (a.resources?.energy || 0)) ? b : a
                    );
                    if (best) {
                        best.remoteScanned = true;
                        state.addLog(`MIRROR: our hail, in our voices. Then: "Go to ${best.name} last. We went first." Four voices. Not five.`);
                    }
                    state.addLog("Spc. Vance: \"Four voices. Count them.\" Nobody does.");
                    return "Hailed our own hull. -5 Energy, +1 Data. One planet revealed. All crew +1 Stress.";
                }
            },
            {
                text: "Pass crates across",
                desc: "-20 Salvage, +30 Energy. If short on salvage: -30 Energy, +20 Salvage. Vance +1 Stress: the cells are ours.",
                effect: (state) => {
                    const vance = state.crew.find(c => c.tags && c.tags.includes('SECURITY') && c.status !== 'DEAD');
                    if (state.salvage >= 20) {
                        state.salvage -= 20;
                        state.energy = Math.min(100, state.energy + 30);
                        if (vance) vance.stress = Math.min(3, (vance.stress || 0) + 1);
                        state.addLog("Crates across the gap on a line. Cells come back. Our lot numbers, our serials. Vance reads them twice.");
                        return "Traded across. -20 Salvage, +30 Energy. Vance +1 Stress.";
                    } else if (state.energy >= 30) {
                        state.energy -= 30;
                        state.salvage = Math.min(state.maxSalvage, state.salvage + 20);
                        if (vance) vance.stress = Math.min(3, (vance.stress || 0) + 1);
                        state.addLog("They wanted power more than plate. The plate they send has our welds on it. Vance counted the rivets.");
                        return "Traded across. -30 Energy, +20 Salvage. Vance +1 Stress.";
                    }
                    return "Nothing to trade. The four in the windows stop waving.";
                }
            },
            {
                text: "Ram it",
                desc: "-15 Energy. 50% chance: it isn't solid, +40 Salvage, +2 Data. 50% chance: it is, one deck damaged, someone gets hurt.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 15);
                    if (_anomalyTestChance(0.5)) {
                        const decks = ['bridge', 'lab', 'quarters', 'cargo', 'engineering'];
                        const deck = decks[Math.floor(Math.random() * decks.length)];
                        if (state.shipDecks && state.shipDecks[deck] && state.shipDecks[deck].status === 'OPERATIONAL') {
                            state.shipDecks[deck].status = 'DAMAGED';
                            state.addLog(`It was solid. ${state.shipDecks[deck].label} DAMAGED.`);
                        }
                        const healthy = state.crew.filter(c => c.status === 'HEALTHY' && !c.tags.includes('LEADER'));
                        if (healthy.length > 0) {
                            const unlucky = healthy[Math.floor(Math.random() * healthy.length)];
                            unlucky.status = 'INJURED';
                            state.addLog(`${unlucky.name} was not strapped in. INJURED.`);
                        }
                        state.addLog("It was solid. It is behind us now, still waving.");
                        return "It was solid. -15 Energy. A deck damaged, someone hurt.";
                    }
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 40);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 2;
                    state.addLog("We went through it like fog. Plate comes off it in sheets, warm, with our number on every sheet.");
                    return "It came apart. -15 Energy, +40 Salvage, +2 Data.";
                }
            }
        ]
    },

    // --- 4. THE DARK: a patch of nothing, reading the transponders out ---
    {
        id: 'ANOMALY_HUNGER',
        weight: 10,
        title: "THE DARK",
        context: () => `A patch of sky with no stars. Not far, not black: nothing. The transponders inside it go quiet one at a time as we listen. Nothing is coming toward us.`,
        dialogue: [
            { speaker: 'Spc. Vance', text: "Nine transponders in there when we arrived. Seven now." },
            { speaker: 'A.U.R.A.', text: "The sensors return nothing, Commander. Not zero. Nothing. I have logged the difference." },
            { speaker: 'Tech Mira', text: "And here we see... no. Aura, what am I looking at? She doesn't know either." }
        ],
        choices: [
            {
                text: "Drop a crate in and watch",
                desc: "-30 Salvage. +3 Data. Mira +1 Stress.",
                effect: (state) => {
                    if (state.salvage < 30) return "Not enough salvage to spare a crate. Nothing goes in.";
                    state.salvage -= 30;
                    state._hungerFavor = true;
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 3;
                    const mira = state.crew.find(c => c.tags && c.tags.includes('SPECIALIST') && c.status !== 'DEAD');
                    if (mira) mira.stress = Math.min(3, (mira.stress || 0) + 1);
                    state.addLog("The crate goes in. An hour later it comes out the far side, sealed, empty. The label is ours, with one letter wrong.");
                    return "Crate went in and came back wrong. -30 Salvage, +3 Data. Mira +1 Stress.";
                }
            },
            {
                text: "Send the probe to the edge",
                desc: "Requires probe. 50% chance: probe lost. Else +40 Energy, -50% Probe.",
                effect: (state) => {
                    if (state.probeIntegrity <= 0) {
                        return "No probe. Nothing to send.";
                    }

                    if (_anomalyTestChance(0.5)) {
                        // Probe lost
                        state.probeIntegrity = 0;
                        state.addLog("The probe goes in. Its signal does not stop. It goes quiet, the way the transponders did.");
                        return "Probe lost to the dark. No data.";
                    }

                    // Success
                    state.energy = Math.min(100, state.energy + 40);
                    state.probeIntegrity = Math.max(0, state.probeIntegrity - 50);
                    state.addLog("The probe skims the edge and comes back cold, cells full. Its serial number is one digit off.");
                    return "Probe came back with full cells. +40 Energy. Probe half gone.";
                }
            },
            {
                text: "Full burn away",
                desc: "-20 Energy. Nothing taken. Vance -1 Stress.",
                effect: (state) => {
                    if (!state.consumeEnergy(20)) {
                        return "Not enough energy to burn. We drift at the edge and watch it.";
                    }
                    state._hungerFled = true;
                    const vance = state.crew.find(c => c.tags && c.tags.includes('SECURITY') && c.status !== 'DEAD');
                    if (vance) vance.stress = Math.max(0, (vance.stress || 0) - 1);
                    state.addLog("Full burn. Nothing follows. Spc. Vance counts the transponders until they are out of range. Six.");
                    return "Burned clear. -20 Energy. Vance -1 Stress.";
                }
            }
        ]
    },

    // --- 5. THE GARDEN: grass with no roots ---
    {
        id: 'ANOMALY_GARDEN',
        weight: 15,
        title: "THE GARDEN",
        context: () => `A garden, in vacuum. Grass, a fence, one tree, a bench. No dome, no air. The grass moves as if there were wind. It is growing toward the ship, slowly.`,
        dialogue: [
            { speaker: 'Eng. Jaxon', text: "That's grass. Wake me when... no. Not that. Not like that." },
            { speaker: 'Dr. Aris', text: "I pulled a blade through the lock. No roots. Nothing here grew. It was made." },
            { speaker: 'Tech Mira', text: "Aura says it's harmless, Commander. She sounds sure. She's usually right." }
        ],
        choices: [
            {
                text: "Take a cutting",
                desc: "-5 Energy. +1 Fungus Culture. 20% chance someone gets hurt.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    if (_anomalyTestChance(0.2)) {
                        // Contamination
                        const team = state.crew.filter(c => c.status === 'HEALTHY' && !c.tags.includes('LEADER'));
                        if (team.length > 0) {
                            const victim = team[Math.floor(Math.random() * team.length)];
                            victim.status = 'INJURED';
                            victim.tags = victim.tags || [];
                            if (!victim.tags.includes('HIVE_MIND')) victim.tags.push('HIVE_MIND');
                            state.addLog(`${victim.name} touched it bare-handed. They say it is warm. They keep saying it is warm.`);
                        }
                    }
                    if (typeof ITEMS !== 'undefined' && ITEMS.FUNGUS_CULTURE) {
                        state.cargo.push({ ...ITEMS.FUNGUS_CULTURE, acquiredAt: 'The Garden' });
                        return "Cutting sealed in the lab. It keeps growing with no roots. -5 Energy, +1 Fungus Culture.";
                    }
                    return "Sample containers failed. Nothing kept. -5 Energy.";
                }
            },
            {
                text: "Let it reach the hull",
                desc: "33% chance: probe repaired, one injury healed. 33% chance: +10 Rations. 33% chance: all crew -1 Stress.",
                effect: (state) => {
                    const roll = window.TEST_MODE ? 0.1 : Math.random();
                    state.noteStanding && state.noteStanding('mira');
                    if (roll < 0.33) {
                        // Repairs
                        state.probeIntegrity = 100;
                        const injured = state.crew.find(c => c.status === 'INJURED');
                        if (injured) injured.status = 'HEALTHY';
                        state.addLog("It grows over the hull and lets go. Where it touched, the plate is new. The probe is whole. So is whoever was hurt.");
                        return "The garden mended things. Probe restored. One injury healed.";
                    } else if (roll < 0.66) {
                        // Food
                        state.rations = Math.min(state.maxRations, state.rations + 10);
                        state.addLog("It leaves fruit on the lock step. It tastes of nothing. A.U.R.A. tests it twice: 'Nutritious, Commander.'");
                        return "The garden fed us. +10 Rations.";
                    } else {
                        // Changed
                        const affected = state.crew.filter(c => c.status !== 'DEAD');
                        affected.forEach(c => {
                            c.stress = Math.max(0, (c.stress || 0) - 1);
                            c.tags = c.tags || [];
                            if (!c.tags.includes('GARDEN_TOUCHED')) c.tags.push('GARDEN_TOUCHED');
                        });
                        state.addLog("It touches the hull and goes still. Everyone aboard sleeps well that night. Nobody says why.");
                        return "The garden touched the hull. All crew -1 Stress.";
                    }
                }
            },
            {
                text: "Burn it",
                desc: "+10 Energy from the burn. Jaxon +1 Stress, Aris +1 Stress.",
                effect: (state) => {
                    state.energy = Math.min(100, state.energy + 10);
                    const jaxon = state.crew.find(c => c.tags && c.tags.includes('ENGINEER') && c.status !== 'DEAD');
                    const aris = state.crew.find(c => c.tags && c.tags.includes('MEDIC') && c.status !== 'DEAD');
                    if (jaxon) jaxon.stress = Math.min(3, (jaxon.stress || 0) + 1);
                    if (aris) aris.stress = Math.min(3, (aris.stress || 0) + 1);
                    state.addLog("It burns like grass. It does not smell of anything. Eng. Jaxon does not name it. He watches it go.");
                    return "Garden burned. +10 Energy. Jaxon +1 Stress, Aris +1 Stress.";
                }
            }
        ]
    },

    // --- 6. THE DOOR: our own airlock, alone ---
    {
        id: 'ANOMALY_DOOR',
        weight: 5,
        title: "THE DOOR",
        context: () => `An airlock, alone. No hull. Ours: the same door, our number, the same scratch by the handle. Shut. Nothing on the other side. The light on it says green.`,
        dialogue: [
            { speaker: 'Tech Mira', text: "It's our aft lock, Commander. Down to the scratch. Aura says it's ours." },
            { speaker: 'A.U.R.A.', text: "It matches our aft airlock, Commander. Our aft airlock is also here. Both are correct." },
            { speaker: 'Spc. Vance', text: "A door with nothing behind it. I'm not opening it." },
            { speaker: 'Dr. Aris', text: "What if whoever made it is on the other side?" }
        ],
        choices: [
            {
                text: "Open it",
                desc: "25% chance: +3 Data, all crew +1 Stress. 25% chance: +40 Energy. 25% chance: one crew member walks through and is lost. Else nothing.",
                effect: (state) => {
                    // The Door always has consequences
                    state._doorOpened = true;

                    const roll = window.TEST_MODE ? 0.1 : Math.random();
                    if (roll < 0.25) {
                        state._colonyKnowledge = (state._colonyKnowledge || 0) + 3;
                        state.crew.forEach(c => {
                            if (c.status !== 'DEAD') c.stress = Math.min(3, (c.stress || 0) + 1);
                        });
                        state.addLog("THE DOOR OPENS.");
                        state.addLog("Green ground. A yellow sun. Four figures, walking away from us. The grass under them does not bend.");
                        state.addLog("It closes. Eng. Jaxon: \"Four.\" That is all he says.");
                        return "It opened on a made place. +3 Data. All crew +1 Stress.";
                    } else if (roll < 0.5) {
                        state.energy = Math.min(100, state.energy + 40);
                        state.addLog("THE DOOR OPENS.");
                        state.addLog("Light through it. Our own running lights, from the far side. The kettle fills off the glare.");
                        return "Light came through. +40 Energy.";
                    } else if (roll < 0.75) {
                        const victim = state.crew.find(c => c.status !== 'DEAD' && !c.tags.includes('LEADER'));
                        if (victim) {
                            victim.status = 'DEAD';
                            victim._deathCause = 'The Door';
                            victim._deathSector = state.currentSector;
                            victim._deathPlanet = 'the door';
                            state.addLog("THE DOOR OPENS.");
                            state.addLog(`${victim.name} walks through it. They do not run. They do not look back.`);
                            state.addLog("It closes. Through the glass: four figures, walking. One of them turns and waves.");
                            state._colonyKnowledge = (state._colonyKnowledge || 0) + 3;
                            return `${victim.name} walked through the door. +3 Data.`;
                        }
                    }
                    // The Door refuses
                    state.addLog("THE DOOR OPENS. Nothing behind it. Our own aft lock, seen from inside.");
                    state.addLog("A.U.R.A.: 'Both doors are shut now, Commander.'");
                    return "It opened on nothing. Nothing taken, nothing lost.";
                }
            },
            {
                text: "Leave something on the step",
                desc: "Gives up one cargo item. It comes back doubled: +1 Item. All crew +1 Stress.",
                effect: (state) => {
                    if (state.cargo.length === 0) {
                        return "Nothing in the hold to leave. The green light stays on.";
                    }
                    const offering = state.cargo.pop();
                    state._doorOffering = true;
                    state.cargo.push({ ...offering });
                    state.cargo.push({ ...offering });
                    state.crew.forEach(c => {
                        if (c.status !== 'DEAD') c.stress = Math.min(3, (c.stress || 0) + 1);
                    });
                    state.addLog(`${offering.name} left on the step. An hour later it is back, with another beside it. Same serial number.`);
                    state.addLog("Spc. Vance: \"Two. Same number. That's not possible.\" He counts them again.");
                    return `${offering.name} came back twice. +1 Item. All crew +1 Stress.`;
                }
            },
            {
                text: "Measure it and go",
                desc: "-5 Energy. +2 Data.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 2;
                    state.addLog("Tech Mira measures it from the goat. Every dimension ours, to the millimetre. The scratch is in the same place.");
                    return "Measured and logged. -5 Energy, +2 Data.";
                }
            }
        ]
    },

    // --- 7. THE CHORUS: seventeen hulls reciting the briefing ---
    {
        id: 'ANOMALY_CHORUS',
        weight: 12,
        title: "THE CHORUS",
        context: () => `Seventeen hulls in a ring, nose-in. All dead, all broadcasting, the same words on the same channel. Our briefing. 'Eight went this way before you.' Seventeen voices, none of them ours.`,
        dialogue: [
            { speaker: 'Spc. Vance', text: "Seventeen hulls. Seventeen numbers. I'll read them. Every one above nine." },
            { speaker: 'Dr. Aris', text: "They're saying our briefing. Word for word. Even the pauses." },
            { speaker: 'Eng. Jaxon', text: "No damage on any of them. Everyone just got up and went." },
            { speaker: 'A.U.R.A.', text: "It is the standard briefing, Commander. I have it on file. They are reciting it correctly." }
        ],
        choices: [
            {
                text: "Board one",
                desc: "+35 Salvage. 30% chance: whoever boards comes back at Stress 3.",
                effect: (state) => {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 35);

                    if (_anomalyTestChance(0.3)) {
                        const crew = state.crew.filter(c => c.status !== 'DEAD' && !c.tags.includes('LEADER'));
                        if (crew.length > 0) {
                            const singer = crew[Math.floor(Math.random() * crew.length)];
                            singer.stress = 3;
                            singer.tags = singer.tags || [];
                            if (!singer.tags.includes('CHORUS_TOUCHED')) singer.tags.push('CHORUS_TOUCHED');
                            state.addLog(`${singer.name} found the briefing tape in the captain's cabin. They keep saying it. Eight went before. Eight went before.`);
                            return `+35 Salvage. ${singer.name} came back reciting. Stress 3.`;
                        }
                    }

                    state.addLog("The hull is clean. Plates on the table, four of them. We take what we can and leave before the next verse.");
                    return "Boarded and stripped. +35 Salvage.";
                }
            },
            {
                text: "Fly to the middle of the ring",
                desc: "-10 Energy. 50% chance: +40 Energy, +3 Data, all crew +1 Stress. Else nothing.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 10);
                    if (_anomalyTestChance(0.5)) {
                        state.energy = Math.min(100, state.energy + 40);
                        state._colonyKnowledge = (state._colonyKnowledge || 0) + 3;
                        state.crew.forEach(c => {
                            if (c.status !== 'DEAD') c.stress = Math.min(3, (c.stress || 0) + 1);
                        });
                        state.addLog("At the middle: a pinhead of light, very far off. Every hull is nose-on to it.");
                        state.addLog("A.U.R.A.: 'A star, Commander. It is on no chart. The kettle is charging off its glare.'");
                        return "We saw what they were facing. -10 Energy, +40 Energy, +3 Data. All crew +1 Stress.";
                    }

                    state.addLog("The middle is empty. As we leave, the seventeen go quiet, one by one, like someone turning them off.");
                    return "Nothing at the middle. -10 Energy. The ring went quiet behind us.";
                }
            },
            {
                text: "Write the seventeen numbers down and go",
                desc: "-5 Energy. +1 Data. Vance -1 Stress.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;
                    const vance = state.crew.find(c => c.tags && c.tags.includes('SECURITY') && c.status !== 'DEAD');
                    if (vance) vance.stress = Math.max(0, (vance.stress || 0) - 1);
                    state.addLog("Spc. Vance reads seventeen hull numbers into the log, lowest to highest. The lowest is four digits.");
                    state.noteStanding && state.noteStanding('vance');
                    return "Seventeen numbers on the list. -5 Energy, +1 Data. Vance -1 Stress.";
                }
            }
        ]
    },

    // --- 8. THE LEDGER: a list, written in light ---
    {
        id: 'ANOMALY_GEOMETRY',
        weight: 10,
        title: "THE LEDGER",
        context: () => `Numbers, in light, across the sky for kilometres. A list. Two columns. The left column climbs past forty thousand. The right column says four, on every line.`,
        dialogue: [
            { speaker: 'Tech Mira', text: "It's a list, Commander. Just a list. It's beautiful." },
            { speaker: 'Spc. Vance', text: "Left column is hulls. Right column is crew. Four. Every line. Four." },
            { speaker: 'A.U.R.A.', text: "I have checked the right-hand column, Commander. It is correct." },
            { speaker: 'Dr. Aris', text: "Find ours. I want to see if we're on it." }
        ],
        choices: [
            {
                text: "Let Mira read it end to end",
                desc: "-1 Ration: it takes a day. +4 Data. Mira Stress 0.",
                effect: (state) => {
                    const candidates = state.crew.filter(c => c.status !== 'DEAD' && !c.tags.includes('LEADER'));
                    if (candidates.length === 0) return "Nobody left to read it.";

                    // Mira is best candidate if available
                    let solver = candidates.find(c => c.tags.includes('SPECIALIST')) ||
                                 candidates[Math.floor(Math.random() * candidates.length)];

                    state.rations = Math.max(0, state.rations - 1);
                    solver.tags = solver.tags || [];
                    if (!solver.tags.includes('GEOMETRY_SOLVED')) solver.tags.push('GEOMETRY_SOLVED');
                    solver.stress = 0;
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 4;

                    state.addLog(`${solver.name} reads for a day. Then: "We're on it, Commander. Nine. Four crew. She's right. She's always right."`);
                    state.noteStanding && state.noteStanding('mira');
                    return `${solver.name} read the whole list. -1 Ration, +4 Data. ${solver.name} Stress 0.`;
                }
            },
            {
                text: "Have A.U.R.A. check our line against her record",
                desc: "-5 Energy. +2 Data. Vance +1 Stress.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 2;
                    const vance = state.crew.find(c => c.tags && c.tags.includes('SECURITY') && c.status !== 'DEAD');
                    if (vance) vance.stress = Math.min(3, (vance.stress || 0) + 1);
                    state.addLog("A.U.R.A.: 'Filed, Commander. It agrees with my record. Every line, including ours.'");
                    state.addLog("Spc. Vance: \"Then your record's wrong.\" A.U.R.A.: 'Four crew, Commander.' He does not ask again.");
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(1, 'Checked the ledger against her record');
                    state.noteStanding && state.noteStanding('vance');
                    return "Our line checked. -5 Energy, +2 Data. Vance +1 Stress.";
                }
            },
            {
                text: "Fly through without reading",
                desc: "-10 Energy. Nothing read. Mira +1 Stress.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 10);
                    const mira = state.crew.find(c => c.tags && c.tags.includes('SPECIALIST') && c.status !== 'DEAD');
                    if (mira) mira.stress = Math.min(3, (mira.stress || 0) + 1);
                    state.addLog("Ports shuttered, instruments off, dead reckoning. Eng. Jaxon swears he saw a number through his eyelids. He won't say which.");
                    return "Through the ledger, unread. -10 Energy. Mira +1 Stress.";
                }
            }
        ]
    },

    // --- 9. THE ARCHIVE: every hold, made again ---
    {
        id: 'ANOMALY_ARCHIVE',
        weight: 8,
        title: "THE ARCHIVE",
        context: () => `A body the size of a moon, shelved. Every shelf is a hull's hold, made again, neat. Our crates are here, with our lot numbers, unopened. Every file is four lines long.`,
        dialogue: [
            { speaker: 'A.U.R.A.', text: "Records from every hull on this heading, Commander. Including ours. I did not send ours." },
            { speaker: 'Tech Mira', text: "I found our file. Four lines. Everyone's file is four lines." },
            { speaker: 'Spc. Vance', text: "There's a shelf marked EXODUS, OUTCOMES. Do we want to read that?" },
            { speaker: 'Dr. Aris', text: "Yes." }
        ],
        choices: [
            {
                text: "Read the outcomes shelf",
                desc: "-1 Ration: Aris reads all day. +8 Data. All crew +2 Stress.",
                effect: (state) => {
                    state.rations = Math.max(0, state.rations - 1);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 8;
                    state.crew.forEach(c => {
                        if (c.status !== 'DEAD') c.stress = Math.min(3, (c.stress || 0) + 2);
                    });
                    state.addLog("Dr. Aris reads until she can't. Forty thousand hulls. Every entry ends the same way: stopped.");
                    state.addLog("Dr. Aris: \"I've got you. All of you. It'll take me the rest of my life to read you out.\"");
                    if (typeof AuraSystem !== 'undefined') AuraSystem.adjustEthics(1, 'Read the outcomes shelf');
                    state.noteStanding && state.noteStanding('aris');
                    return "Outcomes shelf read. -1 Ration, +8 Data. All crew +2 Stress.";
                }
            },
            {
                text: "Take the drive manuals",
                desc: "+30 Salvage, +20 Energy, warp costs -10%. Aris +1 Stress: nothing read.",
                effect: (state) => {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 30);
                    state.energy = Math.min(100, state.energy + 20);
                    state._warpDiscount = (state._warpDiscount || 0) + 10;
                    const aris = state.crew.find(c => c.tags && c.tags.includes('MEDIC') && c.status !== 'DEAD');
                    if (aris) aris.stress = Math.min(3, (aris.stress || 0) + 1);
                    state.addLog("Drive manuals. Ours, with a second chapter ours doesn't have. Eng. Jaxon reads it and closes it.");
                    state.addLog("Eng. Jaxon: \"Kettle'll burn cleaner. That's all I'm taking from it.\"");
                    return "Manuals taken. +30 Salvage, +20 Energy, warp costs -10%. Aris +1 Stress.";
                }
            },
            {
                text: "Cut shelving for plate",
                desc: "+120 Salvage. Aris +2 Stress. A.U.R.A. logs it against us.",
                effect: (state) => {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 120);
                    const aris = state.crew.find(c => c.tags && c.tags.includes('MEDIC') && c.status !== 'DEAD');
                    if (aris) aris.stress = Math.min(3, (aris.stress || 0) + 2);
                    state.addLog("A.U.R.A.: 'You are taking the shelves, Commander. Very well. I have logged which sections.'");
                    state.addLog("Eng. Jaxon: \"Knowledge doesn't keep you warm. Plate does.\" Dr. Aris does not answer him.");
                    if (typeof AuraSystem !== 'undefined') {
                        AuraSystem.adjustEthics(-2, 'Cut the archive for plate');
                    }
                    return "Shelving cut and stowed. +120 Salvage. Aris +2 Stress.";
                }
            },
            {
                text: "Read only the shelf on worlds",
                desc: "-5 Energy. +3 Data. All planets revealed. All crew +1 Stress.",
                effect: (state) => {
                    state.energy = Math.max(0, state.energy - 5);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 3;
                    state.sectorNodes?.forEach(p => {
                        p.remoteScanned = true;
                    });
                    state.crew.forEach(c => {
                        if (c.status !== 'DEAD') c.stress = Math.min(3, (c.stress || 0) + 1);
                    });
                    state.addLog("The shelf on worlds lists every body in this sector and what is on it. The list of good ones is one line long. It is not in this sector.");
                    return "Worlds shelf read. -5 Energy, +3 Data. All planets revealed. All crew +1 Stress.";
                }
            }
        ]
    }
];

// Export for use
if (typeof window !== 'undefined') {
    window.ANOMALY_ENCOUNTERS = ANOMALY_ENCOUNTERS;
}
