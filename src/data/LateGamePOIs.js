/**
 * LATE-GAME POINTS OF INTEREST
 *
 * Special locations that appear in Sectors 4-5.
 * These are unique, one-time encounters that provide significant lore,
 * resources, or game-altering effects.
 *
 * THE LIGHTHOUSE - Beacon station with FTL navigation data
 * THE GARDEN - Terraformed biodome with living ecosystem
 * THE GRAVE - Memorial site with disturbing revelations
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
A structure orbits the planet below — not a ship, not a station. A needle of crystalline material, impossibly tall, broadcasting on every frequency.

The signal is not language. It's pure mathematics. Navigation data. Star charts for sectors that don't appear on any human map.

The Lighthouse has been here for a very long time. Longer than humanity has existed. And it's been waiting for someone to find it.`,

        dialogue: [
            { speaker: 'Tech Mira', text: "This... this is a navigation beacon. The math describes corridors through spacetime. Paths we could never have calculated on our own." },
            { speaker: 'A.U.R.A.', text: "The signal predates human spaceflight by over 3 billion years. It was placed here deliberately. For us." },
            { speaker: 'Spc. Vance', text: "Or for something like us. Something that came before." },
            { speaker: 'Eng. Jaxon', text: "The materials are unlike anything in our databases. But I think... I think I can interface with it." }
        ],

        choices: [
            {
                id: 'DOWNLOAD_CHARTS',
                text: "Download the star charts",
                desc: "Reveals better paths. All future warps cost -2 energy.",
                effect: (state) => {
                    state._lighthouseBonus = true;
                    state.addLog("NAVIGATION DATA INTEGRATED: Star charts downloaded. Warp efficiency permanently improved.");
                    state.addLog("The data shows paths through the sector that aren't... physical. Shortcuts through space itself.");
                    if (typeof AuraSystem !== 'undefined') {
                        window.AuraSystem.adjustEthics(1, 'Preserved ancient knowledge', state);
                    }
                    return "Star charts integrated. All future warps cost 2 less energy. The paths ahead are clearer now.";
                }
            },
            {
                id: 'SALVAGE_BEACON',
                text: "Salvage the beacon structure",
                desc: "+100 Salvage. Destroys the Lighthouse permanently.",
                effect: (state) => {
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 100);
                    state.addLog("The crystalline structure shatters as we extract components. The signal dies.");
                    state.addLog("Eng. Jaxon: 'There was something beautiful about it. Now there's just... parts.'");
                    if (typeof AuraSystem !== 'undefined') {
                        window.AuraSystem.adjustEthics(-2, 'Destroyed ancient beacon', state);
                    }
                    return "Beacon salvaged. +100 Salvage. The Lighthouse falls silent forever.";
                }
            },
            {
                id: 'STUDY_SIGNAL',
                text: "Study the signal origin",
                desc: "Tech Mira gains crucial insight. Reveals hidden lore.",
                effect: (state) => {
                    const mira = state.crew.find(c => c.tags?.includes('SPECIALIST'));
                    if (mira && mira.status !== 'DEAD') {
                        mira.stress = Math.max(0, (mira.stress || 0) - 1);
                        mira._lighthouseKnowledge = true;
                        state.addLog("Tech Mira: 'The signal... it's a response. To OUR signal. The one GENESIS sent from Earth. They've been waiting for us.'");
                        state.addLog("Tech Mira: 'This changes everything. The corridor isn't natural. It was BUILT. For humanity.'");
                    } else {
                        state.addLog("Without Mira's expertise, the signal analysis is incomplete. But fragments remain...");
                        state.addLog("The signal is older than Earth. And it knew we were coming.");
                    }
                    return "Signal analysis complete. The truth is stranger than we imagined.";
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
In the center of the dead planet, something lives.

A dome — kilometers across, made of material that shouldn't exist. Inside: an ecosystem. Green things growing. Water flowing. Animals that don't match any Earth database, but move with familiar grace.

Someone built this. Someone tended it for millennia. And then they left. But they left the door unlocked.`,

        dialogue: [
            { speaker: 'Dr. Aris', text: "The biodiversity is... impossible. Every niche is filled. It's like someone compressed a million years of evolution into a controlled space." },
            { speaker: 'Tech Mira', text: "The dome material is generating its own energy. Solar collection efficiency of nearly 100%. We can't build anything like this." },
            { speaker: 'Spc. Vance', text: "There's something in the center. A structure. Looks like an altar. Or a control panel." },
            { speaker: 'A.U.R.A.', text: "I'm detecting preserved genetic samples. Seeds. Embryos. Thousands of species from worlds we've never visited." }
        ],

        choices: [
            {
                id: 'TAKE_SAMPLES',
                text: "Collect genetic samples",
                desc: "+3 Rations worth of seeds. Colony bonus if established here.",
                effect: (state) => {
                    state.rations = Math.min(state.maxRations, state.rations + 3);
                    state._gardenSamples = true;
                    state.addLog("Genetic samples secured. Viable seeds, soil bacteria, pollinator embryos.");
                    state.addLog("Dr. Aris: 'These aren't Earth species. But they're compatible with us. Someone designed them to be.'");
                    return "Samples collected. +3 Rations. These will help when we settle.";
                }
            },
            {
                id: 'ENTER_GARDEN',
                text: "Enter the Garden fully",
                desc: "Crew heals and destresses. Risk of contamination.",
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
                                state.addLog(`${affected.name} breathed the spores deeply. Something has changed in their eyes.`);
                            }
                        }
                    }

                    state.addLog("The crew walked barefoot through grass for the first time since Earth. Some wept.");
                    state.addLog("Hours passed like minutes. The Garden is healing — but also watching.");
                    return "Crew fully healed. All stress reduced. But the Garden's influence lingers...";
                }
            },
            {
                id: 'STUDY_ALTAR',
                text: "Investigate the central structure",
                desc: "Reveals who built this place. Disturbing implications.",
                effect: (state) => {
                    state.addLog("The altar is a memorial. The names carved into it are in English. Future English.");
                    state.addLog("Dates stretch forward: 2847. 3112. 4506. 12,847.");
                    state.addLog("A.U.R.A.: 'This garden was built by humanity's descendants. They came back through time to seed the corridor with life.'");
                    state.addLog("A.U.R.A.: 'We are not the first to walk this path. We are fulfilling a loop that was closed before Earth formed.'");
                    state._gardenTruth = true;

                    // Add stress from existential revelation
                    state.crew.forEach(c => {
                        if (c.status !== 'DEAD') {
                            c.stress = Math.min(3, (c.stress || 0) + 1);
                        }
                    });

                    return "The truth revealed: The Garden was planted by future humanity. We are part of a closed loop.";
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
The entire moon is a cemetery.

Billions of markers stretch to every horizon. Names in every human language. Names in languages that don't exist yet. The stones are quantum-locked — they cannot be moved, damaged, or destroyed.

This is where humanity buries its dead. Not the dead of Earth. The dead of everywhere. Everywhen.

And somewhere in this infinite field, there are five stones with familiar names.`,

        dialogue: [
            { speaker: 'Dr. Aris', text: "These graves... some of the dates are from the past. Some from the future. Some from years that haven't been invented yet." },
            { speaker: 'Eng. Jaxon', text: "I found my own grave. Jaxon Mercer. 2343-2398. 'He kept them flying.'" },
            { speaker: 'Spc. Vance', text: "Mine says 2341-2344. That's... that's two years from now." },
            { speaker: 'Tech Mira', text: "Don't read them. Please. We don't want to know how this ends." },
            { speaker: 'A.U.R.A.', text: "The graves are quantum-superposed. The dates are possibilities, not certainties. Your choices still matter." }
        ],

        choices: [
            {
                id: 'READ_GRAVES',
                text: "Read your own gravestones",
                desc: "Gain insight into possible futures. High stress cost.",
                effect: (state) => {
                    // High stress but valuable info
                    state.crew.forEach(c => {
                        if (c.status !== 'DEAD') {
                            c.stress = Math.min(3, (c.stress || 0) + 2);
                        }
                    });

                    // Insight: Reveal which crew survive longest
                    const leader = state.crew.find(c => c.tags.includes('LEADER'));
                    if (leader && leader.status !== 'DEAD') {
                        state.addLog(`Commander's stone: "${leader.realName}. 'They found the way home.'"`);
                    }

                    state.addLog("The stones speak of deaths that haven't happened. And lives that extend far beyond your expectations.");
                    state.addLog("You see your names on stones dated centuries apart. You will live many lives. Or die many deaths.");
                    state._gravesRead = true;

                    return "Futures glimpsed. The weight of possibility is crushing. +2 stress to all crew.";
                }
            },
            {
                id: 'LEAVE_TRIBUTE',
                text: "Leave tributes for the fallen",
                desc: "Honor the dead. Crew gains peace. -10 Salvage for markers.",
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
                            state.addLog(`A stone rises from the ground, already engraved: "${d.realName}. They were not forgotten."`);
                        });
                    }

                    state.addLog("You leave personal items at the stones. Photos. Letters. The small things that meant everything.");
                    state.addLog("A.U.R.A.: 'The graves acknowledge your offering. You have joined the communion of the lost.'");

                    if (typeof AuraSystem !== 'undefined') {
                        window.AuraSystem.adjustEthics(2, 'Honored the dead with reverence', state);
                    }

                    return "Tributes left. The dead are remembered. All crew -1 stress. (-10 Salvage)";
                }
            },
            {
                id: 'SEARCH_ARTIFACTS',
                text: "Search for grave goods",
                desc: "Risk angering the dead. Possible rare items.",
                effect: (state) => {
                    // Risk/reward
                    if (Math.random() < 0.4) {
                        // Bad outcome
                        const living = state.crew.filter(c => c.status !== 'DEAD');
                        if (living.length > 0) {
                            const victim = living[Math.floor(Math.random() * living.length)];
                            victim.status = 'INJURED';
                            state.addLog(`${victim.name} touched something they shouldn't have. A cold pain shoots through their hand.`);
                        }
                        state.addLog("The graves do not give up their treasures willingly.");

                        if (typeof AuraSystem !== 'undefined') {
                            window.AuraSystem.adjustEthics(-2, 'Desecrated the eternal graveyard', state);
                        }

                        return "The dead do not approve. One crew member injured.";
                    } else {
                        // Good outcome - rare item
                        const item = {
                            id: 'CHRONO_SHARD_' + Date.now(),
                            name: 'Chrono-Shard',
                            type: 'ARTIFACT',
                            cargoSize: 1,
                            desc: 'A fragment of crystallized time from the Grave. Allows one crew member to be revived from death.',
                            effect: {
                                type: 'REVIVE_CREW',
                                uses: 1
                            }
                        };
                        state.cargo.push(item);
                        state.addLog("Among the grave goods: a shard that shouldn't exist. Time solidified into crystal.");
                        state.addLog("The inscription reads: 'For those who earned a second chance.'");

                        return "Found Chrono-Shard! This artifact can revive one fallen crew member.";
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
