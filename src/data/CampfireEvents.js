/**
 * CAMPFIRE EVENTS — Narrative moments between sectors.
 * Each event fires during sector transition, before the new sector loads.
 * Events have: context text, crew dialogue, 2-3 choices with mechanical effects.
 * Some events are sector-gated or state-gated.
 */
const CAMPFIRE_EVENTS = [
    // === SECTOR 1 → 2 (Leaving the Graveyard, entering the Void) ===
    {
        id: 'CF_RATION_CHECK',
        sectorRange: [1, 2],
        condition: (state) => state.rations <= 12,
        title: "RATIONING PROTOCOL",
        context: "The engines cool as the ship drifts between sectors. The crew gathers in the mess hall. The numbers on the ration display are getting harder to ignore.",
        dialogue: [
            { speaker: 'A.U.R.A.', text: "Current ration trajectory: insufficient for full sector exploration. Recommend conservation protocol." },
            { speaker: 'Eng. Jaxon', text: "Conservation. That's a fancy word for going hungry." },
            { speaker: 'Dr. Aris', text: "We could reduce portions. Nobody starves, but nobody's comfortable either." }
        ],
        choices: [
            {
                text: "Half rations for all",
                desc: "+3 Rations, +1 Stress to all crew",
                effect: (state) => {
                    state.rations = Math.min(state.maxRations, state.rations + 3);
                    state.crew.forEach(c => { if (c.status !== 'DEAD') c.stress = Math.min(3, (c.stress || 0) + 1); });
                    return "Rations stretched. Crew morale dips.";
                }
            },
            {
                text: "Maintain full rations",
                desc: "No change. Morale preserved.",
                effect: (state) => {
                    return "Full rations maintained. The crew eats well — for now.";
                }
            },
            {
                text: "Officers eat last",
                desc: "Commander +1 Stress, Crew morale restored",
                effect: (state) => {
                    const cmdr = state.crew.find(c => c.tags.includes('LEADER') && c.status !== 'DEAD');
                    if (cmdr) cmdr.stress = Math.min(3, (cmdr.stress || 0) + 1);
                    state.crew.forEach(c => {
                        if (c.status !== 'DEAD' && !c.tags.includes('LEADER') && c.stress > 0) {
                            c.stress = Math.max(0, c.stress - 1);
                        }
                    });
                    return "The Commander's sacrifice earns respect. Crew stress eased.";
                }
            }
        ]
    },
    {
        id: 'CF_JAXON_WORRY',
        sectorRange: [1, 2],
        condition: (state) => state.crew.find(c => c.tags.includes('ENGINEER') && c.status !== 'DEAD'),
        title: "ENGINE CONCERNS",
        context: "Jaxon has called the Commander to Engineering. He looks worried — more than usual.",
        dialogue: [
            { speaker: 'Eng. Jaxon', text: "These drives weren't built for deep space. We're pushing them past spec. I can reinforce them, but I'll need salvage." },
            { speaker: 'Eng. Jaxon', text: "Or we save the salvage and hope for the best. Your call, Commander." }
        ],
        choices: [
            {
                text: "Reinforce the drives (-30 Salvage)",
                desc: "Jaxon -1 Stress, next sector warp costs -20%",
                requires: (state) => state.salvage >= 30,
                requiresLabel: "Need 30 Salvage",
                effect: (state) => {
                    state.salvage -= 30;
                    const jaxon = state.crew.find(c => c.tags.includes('ENGINEER'));
                    if (jaxon) jaxon.stress = Math.max(0, (jaxon.stress || 0) - 1);
                    state._driveReinforced = true;
                    return "Drives reinforced. Jaxon seems relieved. (-30 Salvage)";
                }
            },
            {
                text: "Save the salvage",
                desc: "Keep resources. Jaxon +1 Stress.",
                effect: (state) => {
                    const jaxon = state.crew.find(c => c.tags.includes('ENGINEER'));
                    if (jaxon) jaxon.stress = Math.min(3, (jaxon.stress || 0) + 1);
                    return "Jaxon returns to his bunk. He didn't argue.";
                }
            }
        ]
    },
    // === SECTOR 2 → 3 (The Void to The Signal) ===
    {
        id: 'CF_VOID_TENSION',
        sectorRange: [2, 3],
        condition: () => true,
        title: "THE LONG DARK",
        context: "The void between sectors stretches on. No stars. No signals. Just the hum of recycled air and the flicker of emergency lighting.",
        dialogue: [
            { speaker: 'Spc. Vance', text: "How long has it been since we saw another star?" },
            { speaker: 'Dr. Aris', text: "Forty-seven hours. I stopped counting after that." },
            { speaker: 'Tech Mira', text: "I picked up something. Faint. Rhythmic. Like... tapping." },
            { speaker: 'A.U.R.A.', text: "Signal analysis inconclusive. Origin: unknown." }
        ],
        choices: [
            {
                text: "Investigate the signal",
                desc: "+10 Energy (signal boost), All crew +1 Stress",
                effect: (state) => {
                    state.energy = Math.min(100, state.energy + 10);
                    state.crew.forEach(c => { if (c.status !== 'DEAD') c.stress = Math.min(3, (c.stress || 0) + 1); });
                    return "The signal grows louder. Something is out there. Energy harvested from the carrier wave.";
                }
            },
            {
                text: "Ignore it. Keep moving.",
                desc: "No effect. Play it safe.",
                effect: (state) => {
                    return "The signal fades behind you. Or does it?";
                }
            },
            {
                text: "Play music to drown it out",
                desc: "All crew -1 Stress",
                effect: (state) => {
                    state.crew.forEach(c => {
                        if (c.status !== 'DEAD' && c.stress > 0) c.stress = Math.max(0, c.stress - 1);
                    });
                    return "Mira puts on an old Earth recording. For a moment, the ship feels like home.";
                }
            }
        ]
    },
    {
        id: 'CF_ARIS_ETHICS',
        sectorRange: [2, 3],
        condition: (state) => state.crew.find(c => c.tags.includes('MEDIC') && c.status !== 'DEAD'),
        title: "THE OATH",
        context: "Dr. Aris is in the lab, staring at a blood sample under the microscope. She doesn't look up when you enter.",
        dialogue: [
            { speaker: 'Dr. Aris', text: "I've been reviewing the mission logs from the previous Exodus ships. The ones that made it to colony sites." },
            { speaker: 'Dr. Aris', text: "Commander... none of them lasted more than a generation. Not one." },
            { speaker: 'Dr. Aris', text: "Are we really looking for a home? Or are we just looking for a place to die slowly?" }
        ],
        choices: [
            {
                text: "\"We'll be different.\"",
                desc: "Aris -1 Stress. Hope matters.",
                effect: (state) => {
                    const aris = state.crew.find(c => c.tags.includes('MEDIC'));
                    if (aris) aris.stress = Math.max(0, (aris.stress || 0) - 1);
                    return "Aris nods slowly. She doesn't look convinced, but she looks less alone.";
                }
            },
            {
                text: "\"Then we make it count.\"",
                desc: "All crew -1 Stress. Acceptance.",
                effect: (state) => {
                    state.crew.forEach(c => {
                        if (c.status !== 'DEAD' && c.stress > 0) c.stress = Math.max(0, c.stress - 1);
                    });
                    return "Something shifts in the room. The weight doesn't lift, but it becomes shared.";
                }
            }
        ]
    },
    // === SECTOR 3 → 4 (The Signal to The Garden) ===
    {
        id: 'CF_VANCE_CONFESSION',
        sectorRange: [3, 4],
        condition: (state) => state.crew.find(c => c.tags.includes('SECURITY') && c.status !== 'DEAD'),
        title: "NIGHT WATCH",
        context: "Vance is cleaning his sidearm in the dim light of the cargo hold. He gestures for you to sit.",
        dialogue: [
            { speaker: 'Spc. Vance', text: "I served on Exodus-6, you know. Before they reassigned me here." },
            { speaker: 'Spc. Vance', text: "We found a paradise. Green skies, clean water, the works. Captain ordered immediate colonization." },
            { speaker: 'Spc. Vance', text: "The predators came at night. Learned our patrol patterns in three days. We lost forty people before we got the ship running again." },
            { speaker: 'Spc. Vance', text: "Don't trust paradise, Commander. Nothing good comes free." }
        ],
        choices: [
            {
                text: "\"Noted. We'll scan everything twice.\"",
                desc: "Vance -1 Stress. Trust built.",
                effect: (state) => {
                    const vance = state.crew.find(c => c.tags.includes('SECURITY'));
                    if (vance) vance.stress = Math.max(0, (vance.stress || 0) - 1);
                    return "Vance holsters his weapon. For the first time, he looks at you with something other than suspicion.";
                }
            },
            {
                text: "\"We can't let fear make our choices.\"",
                desc: "Commander gains respect, but Vance +1 Stress",
                effect: (state) => {
                    const vance = state.crew.find(c => c.tags.includes('SECURITY'));
                    if (vance) vance.stress = Math.min(3, (vance.stress || 0) + 1);
                    return "Vance's jaw tightens. He disagrees. But he doesn't argue — not yet.";
                }
            }
        ]
    },
    {
        id: 'CF_MIRA_DISCOVERY',
        sectorRange: [3, 4],
        condition: (state) => state.crew.find(c => c.tags.includes('SPECIALIST') && c.status !== 'DEAD'),
        title: "THE NOTEBOOK",
        context: "Mira bursts into the bridge, datapad in hand, eyes wide.",
        dialogue: [
            { speaker: 'Tech Mira', text: "Commander, I've been cross-referencing our scan data with the Exodus logs." },
            { speaker: 'Tech Mira', text: "The signal we've been detecting? It's not random. It's coordinates. And they point to Sector 5." },
            { speaker: 'Tech Mira', text: "Someone — or something — wants us to go deeper." }
        ],
        choices: [
            {
                text: "\"Good work. Log it.\"",
                desc: "Mira -1 Stress. Intel gathered.",
                effect: (state) => {
                    const mira = state.crew.find(c => c.tags.includes('SPECIALIST'));
                    if (mira) mira.stress = Math.max(0, (mira.stress || 0) - 1);
                    return "Mira beams. Having a purpose keeps her grounded.";
                }
            },
            {
                text: "\"Or it's a trap. Be careful.\"",
                desc: "Mira +1 Stress. Caution instilled.",
                effect: (state) => {
                    const mira = state.crew.find(c => c.tags.includes('SPECIALIST'));
                    if (mira) mira.stress = Math.min(3, (mira.stress || 0) + 1);
                    return "Mira's excitement dims. She nods and leaves the bridge quietly.";
                }
            },
            {
                text: "\"Share it with the crew.\"",
                desc: "All crew -1 Stress. Purpose found.",
                effect: (state) => {
                    state.crew.forEach(c => {
                        if (c.status !== 'DEAD' && c.stress > 0) c.stress = Math.max(0, c.stress - 1);
                    });
                    return "A direction. A reason. The crew discusses the coordinates over dinner. For the first time in weeks, they sound alive.";
                }
            }
        ]
    },
    // === SECTOR 4 → 5 (The Garden to the Event Horizon) ===
    {
        id: 'CF_LAST_SUPPER',
        sectorRange: [4, 5],
        condition: () => true,
        title: "THE LAST SECTOR",
        context: "This is it. Beyond this jump lies the final sector. The crew knows that whatever they find — or don't find — this is the end of the road.",
        dialogue: [
            { speaker: 'A.U.R.A.', text: "Advisory: Sector 5 telemetry indicates extreme spatial distortion. Reality parameters may be unreliable." },
            { speaker: 'Eng. Jaxon', text: "Great. Even physics is giving up on us." },
            { speaker: 'Dr. Aris', text: "Whatever happens... it's been an honor." },
            { speaker: 'Spc. Vance', text: "Save the speeches. We're not dead yet." },
            { speaker: 'Tech Mira', text: "The signal is louder now. Can you hear it?" }
        ],
        choices: [
            {
                text: "\"One more jump. Together.\"",
                desc: "All crew -1 Stress. Unity.",
                effect: (state) => {
                    state.crew.forEach(c => {
                        if (c.status !== 'DEAD' && c.stress > 0) c.stress = Math.max(0, c.stress - 1);
                    });
                    return "The crew stands together on the bridge. Nobody speaks. The jump drive spools up.";
                }
            },
            {
                text: "\"Prepare for the worst.\"",
                desc: "+20 Energy (systems check), Commander +1 Stress",
                effect: (state) => {
                    state.energy = Math.min(100, state.energy + 20);
                    const cmdr = state.crew.find(c => c.tags.includes('LEADER') && c.status !== 'DEAD');
                    if (cmdr) cmdr.stress = Math.min(3, (cmdr.stress || 0) + 1);
                    return "Full systems check completed. Everything that can be reinforced has been. The weight of command has never been heavier.";
                }
            }
        ]
    },
    {
        id: 'CF_AURA_WARNING',
        sectorRange: [4, 5],
        condition: () => true,
        title: "A.U.R.A. ADVISORY",
        context: "In the quiet of the bridge, A.U.R.A.'s display flickers. When the voice speaks, it sounds... different.",
        dialogue: [
            { speaker: 'A.U.R.A.', text: "Commander. I have been processing the data from Sectors 3 and 4." },
            { speaker: 'A.U.R.A.', text: "The anomalies are not random. They follow a pattern. A pattern that suggests... intention." },
            { speaker: 'A.U.R.A.', text: "Something arranged this corridor of space. The planets, the signals, even the wreckage. We are being guided." },
            { speaker: 'A.U.R.A.', text: "I calculate a 73% probability that we are expected." }
        ],
        choices: [
            {
                text: "\"Expected by what?\"",
                desc: "A.U.R.A. reveals more. +1 Stress to all.",
                effect: (state) => {
                    state.crew.forEach(c => { if (c.status !== 'DEAD') c.stress = Math.min(3, (c.stress || 0) + 1); });
                    return "A.U.R.A. pauses. 'I do not know. But it has been waiting a very long time.'";
                }
            },
            {
                text: "\"Thank you, A.U.R.A. We proceed regardless.\"",
                desc: "No mechanical effect. Resolve.",
                effect: (state) => {
                    return "A.U.R.A.'s display stabilizes. 'Acknowledged, Commander. Sector 5 jump coordinates locked.'";
                }
            }
        ]
    },
    // === GENERIC (can fire at any transition) ===
    {
        id: 'CF_CREW_MEAL',
        sectorRange: [1, 5],
        condition: (state) => state.rations >= 5,
        title: "THE MESS HALL",
        context: "The ship drifts in the silence between sectors. Someone has set the mess hall table. It's the closest thing to normalcy you've seen in weeks.",
        dialogue: [
            { speaker: 'Dr. Aris', text: "When did we last eat together? Actually sit down?" },
            { speaker: 'Eng. Jaxon', text: "Before the first warp burn. Feels like years ago." }
        ],
        choices: [
            {
                text: "Share a meal together (-2 Rations)",
                desc: "All crew -1 Stress. Humanity preserved.",
                effect: (state) => {
                    state.rations = Math.max(0, state.rations - 2);
                    state.crew.forEach(c => {
                        if (c.status !== 'DEAD' && c.stress > 0) c.stress = Math.max(0, c.stress - 1);
                    });
                    return "For twenty minutes, nobody mentions the mission. They talk about home, about music, about nothing. It helps.";
                }
            },
            {
                text: "\"We eat at our stations.\"",
                desc: "No resource cost. No benefit.",
                effect: (state) => {
                    return "The table stays empty. Efficiency preserved. Something else lost.";
                }
            }
        ]
    },
    {
        id: 'CF_DAMAGE_REPAIR',
        sectorRange: [1, 5],
        condition: (state) => Object.values(state.shipDecks).some(d => d.status === 'DAMAGED') && state.salvage >= 20,
        title: "FIELD REPAIRS",
        context: "The inter-sector drift gives the crew time to patch up. Jaxon surveys the damage.",
        dialogue: [
            { speaker: 'Eng. Jaxon', text: "I can jury-rig the worst of it during the drift. Won't be pretty, but it'll hold." },
            { speaker: 'A.U.R.A.', text: "Estimated material cost: 20 salvage for temporary field repair." }
        ],
        choices: [
            {
                text: "Field repair (-20 Salvage, fix 1 deck)",
                desc: "Cheapest damaged deck restored.",
                effect: (state) => {
                    if (state.salvage >= 20) {
                        state.salvage -= 20;
                        const damaged = Object.entries(state.shipDecks).filter(([k, v]) => v.status === 'DAMAGED');
                        if (damaged.length > 0) {
                            damaged.sort((a, b) => a[1].repairCost - b[1].repairCost);
                            damaged[0][1].status = 'OPERATIONAL';
                            return `Field repair complete: ${damaged[0][1].label} restored. (-20 Salvage)`;
                        }
                    }
                    return "Repair failed — insufficient resources.";
                }
            },
            {
                text: "Save the salvage for later",
                desc: "Keep resources. Damage persists.",
                effect: (state) => {
                    return "Jaxon shrugs. 'Your ship, Commander.'";
                }
            }
        ]
    }
];
