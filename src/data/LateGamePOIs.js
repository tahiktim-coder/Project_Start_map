/**
 * LATE-GAME POINTS OF INTEREST
 *
 * Special locations that appear in Sectors 4-5.
 * These are unique, one-time encounters that provide significant lore,
 * resources, or game-altering effects.
 *
 * THE LIGHTHOUSE - a dead ship's navigation beacon, still guiding ships down the heading
 * THE GARDEN - a copy of an Earth garden under a dome; the grass has no roots
 * THE GRAVE - a moon of graves: four names on every stone, and no commanders
 */

const LATE_GAME_POIS = {
    LIGHTHOUSE: {
        id: 'THE_LIGHTHOUSE',
        name: 'THE LIGHTHOUSE',
        tagRequired: 'LIGHTHOUSE',
        title: 'THE LIGHTHOUSE',
        minSector: 4,
        weight: 15, // Rarer than Exodus wrecks

        context: () => `
A dead ship is parked in orbit here. Its crew is long gone, but its navigation beacon is still running.

The beacon sends one message, over and over: the safest route onward, for any ship that comes after it.

Every route it gives points the same way. Down our heading.`,

        dialogue: [
            { speaker: 'Tech Mira', text: "It's a navigation beacon, Commander. It's giving directions to any ship behind it." },
            { speaker: 'A.U.R.A.', text: "The route it gives is accurate, Commander. It matches our heading exactly." },
            { speaker: 'Spc. Vance', text: "So every ship that passed here followed it. Where did it lead them?" },
            { speaker: 'Eng. Jaxon', text: "It still runs off its own reactor. I can plug our charts straight into it." }
        ],

        choices: [
            {
                id: 'DOWNLOAD_CHARTS',
                text: "Download its route",
                desc: "Warps cost 2 less energy from now on.",
                effect: (state) => {
                    state._lighthouseBonus = true;
                    state.addLog("ROUTE DOWNLOADED: every warp from now on costs 2 less energy.");
                    state.addLog("The route runs straight down our heading, the same way every ship before us went.");
                    if (typeof AuraSystem !== 'undefined') {
                        window.AuraSystem.adjustEthics(1, 'Kept the beacon running', state);
                    }
                    return "Route downloaded. Every warp now costs 2 less energy.";
                }
            },
            {
                id: 'SALVAGE_BEACON',
                text: "Strip the beacon for parts",
                desc: "+100 Salvage. The beacon goes dark for good.",
                effect: (state) => {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 100);
                    state.addLog("We strip the beacon down to the frame. Its signal stops.");
                    state.addLog("A.U.R.A.: 'The beacon is off, Commander. Any ship behind us will have to find its own way.'");
                    if (typeof AuraSystem !== 'undefined') {
                        window.AuraSystem.adjustEthics(-2, 'Destroyed a working beacon', state);
                    }
                    return "Beacon stripped. +100 Salvage. It will never guide anyone again.";
                }
            },
            {
                id: 'STUDY_SIGNAL',
                text: "Read the beacon's log",
                desc: "Mira reads the list of every ship it guided. Mira -1 Stress.",
                effect: (state) => {
                    const mira = state.crew.find(c => c.tags?.includes('SPECIALIST'));
                    if (mira && mira.status !== 'DEAD') {
                        mira.stress = Math.max(0, (mira.stress || 0) - 1);
                        mira._lighthouseKnowledge = true;
                        state.addLog("Tech Mira: 'It logged every ship that passed. Thousands of them, all going the same way.'");
                        state.addLog("Tech Mira: 'And none of them ever came back past it.'");
                    } else {
                        state.addLog("Without Mira, we can only read part of the log.");
                        state.addLog("Thousands of ships passed this beacon, all heading the same way. None of them came back.");
                    }
                    return "Beacon log read. Every ship that passed went one way, and none came back.";
                }
            }
        ]
    },

    GARDEN: {
        id: 'THE_GARDEN',
        name: 'THE GARDEN',
        tagRequired: 'GARDEN',
        title: 'THE GARDEN',
        minSector: 4,
        weight: 15,

        context: () => `
On this dead planet, under a dome kilometres wide, there is a whole Earth garden: grass, trees, running water, birds. The grass has no roots. It just sits on the soil.

Nobody built it. It is a copy of a real place, and the copy is not quite right.

The door is open, because the real place had an open door.`,

        dialogue: [
            { speaker: 'Dr. Aris', text: "Every plant here is an Earth plant. Whoever copied them didn't know how plants grow." },
            { speaker: 'Tech Mira', text: "The dome makes its own daylight. I can't find where it's coming from." },
            { speaker: 'Spc. Vance', text: "There's a stone in the middle with names cut into it." },
            { speaker: 'A.U.R.A.', text: "There are seeds and embryos stored here, Commander. Earth stock. I can't say how they got here." }
        ],

        choices: [
            {
                id: 'TAKE_SAMPLES',
                text: "Collect seeds and samples",
                desc: "+3 Rations.",
                effect: (state) => {
                    state.rations = Math.min(state.maxRations, state.rations + 3);
                    state._gardenSamples = true;
                    state.addLog("We collect seeds, soil and frozen embryos from the store.");
                    state.addLog("A.U.R.A.: 'The seeds are healthy, Commander. They would grow in real soil.'");
                    return "Seeds collected. +3 Rations.";
                }
            },
            {
                id: 'ENTER_GARDEN',
                text: "Let everyone walk in the garden",
                desc: "Heals every injury. All crew -2 Stress. 30% chance one crew member breathes in its pollen and is changed by it.",
                effect: (state) => {
                    // Heal and destress all crew
                    state.crew.forEach(c => {
                        if (c.status === 'INJURED') c.status = 'HEALTHY';
                        c.stress = Math.max(0, (c.stress || 0) - 2);
                        c.healCounter = 0;
                    });

                    // Risk: One crew may gain HIVE_MIND tag
                    if (Math.random() < 0.3) {
                        const living = state.crew.filter(c => c.status !== 'DEAD' && !c.tags.includes('LEADER'));
                        if (living.length > 0) {
                            const affected = living[Math.floor(Math.random() * living.length)];
                            if (!affected.tags.includes('HIVE_MIND')) {
                                affected.tags.push('HIVE_MIND');
                                state.addLog(`${affected.name} breathed in the pollen. Since then they've been quiet, and they keep looking back at the dome.`);
                            }
                        }
                    }

                    state.addLog("The crew walked barefoot on grass for the first time since Earth. Some of them cried.");
                    state.addLog("Hours went by like minutes.");
                    return "All injuries healed. All crew -2 Stress.";
                }
            },
            {
                id: 'STUDY_ALTAR',
                text: "Read the stone in the middle",
                desc: "All crew +1 Stress.",
                effect: (state) => {
                    state.addLog("The stone has four names cut into it, and a hull number: EXODUS-3,306. Below the names is a fifth line, left blank.");
                    state.addLog("It is a memorial. Someone made this garden and buried their crew in it.");
                    state.addLog("A.U.R.A.: 'I have no record of a ship numbered 3,306, Commander. We are ship nine.'");
                    state._gardenTruth = true;

                    // Add stress from existential revelation
                    state.crew.forEach(c => {
                        if (c.status !== 'DEAD') {
                            c.stress = Math.min(3, (c.stress || 0) + 1);
                        }
                    });

                    return "A memorial for hull 3,306: four names and a blank line. All crew +1 Stress.";
                }
            }
        ]
    },

    GRAVE: {
        id: 'THE_GRAVE',
        name: 'THE GRAVE',
        tagRequired: 'GRAVE',
        title: 'THE GRAVE',
        minSector: 5,
        weight: 20, // More common in final sector

        context: () => `
This whole moon is a graveyard.

Rows of stones stretch to every horizon, one row for each ship, with the hull number at the end. Every stone has four names on it.

The rows farther out are older.`,

        dialogue: [
            { speaker: 'Dr. Aris', text: "I'm going to read their names. Somebody should." },
            { speaker: 'Eng. Jaxon', text: "This row has our mission patch on it. The hull number is over nine thousand." },
            { speaker: 'Spc. Vance', text: "Thousands of stones, and not one commander." },
            { speaker: 'Tech Mira', text: "Please don't read them out loud. I don't want to hear them." },
            { speaker: 'A.U.R.A.', text: "Four crew per ship, Commander. The stones match the crew lists." }
        ],

        choices: [
            {
                id: 'READ_GRAVES',
                text: "Walk the rows and read the names",
                desc: "Aris wants the names read aloud. It takes hours. All crew +2 Stress.",
                effect: (state) => {
                    // High stress but valuable info
                    state.crew.forEach(c => {
                        if (c.status !== 'DEAD') {
                            c.stress = Math.min(3, (c.stress || 0) + 2);
                        }
                    });

                    state.noteStanding && state.noteStanding('aris');
                    state.addLog("The names on the nearest hundred stones are read aloud, four to a stone. Nobody interrupts.");
                    const aris = state.crew.find(c => c.tags && c.tags.includes('MEDIC') && c.status !== 'DEAD');
                    state.addLog(aris
                        ? "Dr. Aris: 'Whoever buried them knew every name. It's the same handwriting on every stone.'"
                        : "Whoever buried them knew every name. It's the same handwriting on every stone.");
                    state._gravesRead = true;

                    return "Four hundred names read aloud. All crew +2 Stress.";
                }
            },
            {
                id: 'LEAVE_TRIBUTE',
                text: "Leave something at the graves",
                desc: "-10 Salvage to make markers. All crew -1 Stress.",
                effect: (state) => {
                    state.salvage = Math.max(0, state.salvage - 10);

                    // Reduce stress, improve morale
                    state.crew.forEach(c => {
                        if (c.status !== 'DEAD') {
                            c.stress = Math.max(0, (c.stress || 0) - 1);
                        }
                    });

                    // Honor dead crew members
                    const dead = state.crew.filter(c => c.status === 'DEAD');
                    if (dead.length > 0) {
                        dead.forEach(d => {
                            state.addLog(`Near the edge there is a new stone that wasn't there when we landed. It reads: ${d.realName}.`);
                        });
                    }

                    state.addLog("We leave personal things at the stones: photos, letters, small things that mattered.");
                    state.addLog("A.U.R.A.: 'I've recorded where we left them, Commander.'");

                    if (typeof AuraSystem !== 'undefined') {
                        window.AuraSystem.adjustEthics(2, 'Honored the dead with reverence', state);
                    }

                    return "Left tributes at the graves. -10 Salvage. All crew -1 Stress.";
                }
            },
            {
                id: 'SEARCH_ARTIFACTS',
                text: "Search the graves for belongings",
                desc: "60% chance: +1 rare item. 40% chance someone gets hurt, and A.U.R.A. will think less of it.",
                effect: (state) => {
                    // Risk/reward
                    if (Math.random() < 0.4) {
                        // Bad outcome
                        const living = state.crew.filter(c => c.status !== 'DEAD');
                        if (living.length > 0) {
                            const victim = living[Math.floor(Math.random() * living.length)];
                            victim.status = 'INJURED';
                            state.addLog(`${victim.name} cut their hand badly on a broken stone.`);
                        }
                        state.addLog("There's nothing buried with them worth taking.");

                        if (typeof AuraSystem !== 'undefined') {
                            window.AuraSystem.adjustEthics(-2, 'Dug through the graves', state);
                        }

                        return "Nothing found. One crew member hurt digging at the graves.";
                    } else {
                        // Good outcome - rare item
                        const item = {
                            id: 'CHRONO_SHARD_' + Date.now(),
                            name: 'Warm Stone',
                            type: 'ARTIFACT',
                            cargoSize: 1,
                            desc: 'A small stone from the graves that never cools down. Scratched on it: "For whoever comes next."',
                            effect: {
                                type: 'REVIVE_CREW',
                                uses: 1
                            }
                        };
                        state.cargo.push(item);
                        state.addLog("Among the belongings: a small stone that stays warm in the hand.");
                        state.addLog("Someone scratched on it: 'For whoever comes next.'");

                        return "Found a Warm Stone in the graves.";
                    }
                }
            }
        ]
    }
};

// Export for window access
if (typeof window !== 'undefined') {
    window.LATE_GAME_POIS = LATE_GAME_POIS;
}
