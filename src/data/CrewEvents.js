/**
 * CREW PERSONAL EVENTS - Character development moments
 *
 * These events are triggered based on:
 * - Crew stress levels
 * - Actions taken (scans, EVAs, etc.)
 * - Random chance during downtime
 * - Specific situations (finding certain items, visiting certain planets)
 *
 * Each event gives insight into the crew's personalities and pasts.
 */

const CREW_PERSONAL_EVENTS = [
    // ═══════════════════════════════════════════════════════════════
    // JAXON (Engineer, PESSIMIST)
    // ═══════════════════════════════════════════════════════════════
    {
        id: 'JAXON_PHOTO',
        crewId: 'jaxon',
        trigger: (state, crew) => crew.name.includes('Jaxon') && state.actionsTaken >= 10 && !state._jaxonPhotoSeen,
        weight: 15,
        title: "JAXON'S LOCKER",
        context: "You find Jaxon in the cargo bay, holding a worn photograph. He doesn't hear you approach.",
        dialogue: [
            { speaker: 'Eng. Jaxon', text: "My daughter. She was eight when I left. She's forty-three now. If she's still alive." },
            { speaker: 'Eng. Jaxon', text: "I told her I'd be back. Every day she waited by the window. That's what her mother wrote." },
            { speaker: 'Eng. Jaxon', text: "I keep this to remind me what we're looking for. A place where someone else's kid can grow up." }
        ],
        choices: [
            {
                text: "We'll find that place, Jaxon.",
                desc: "-1 Stress",
                effect: (state, crew) => {
                    crew.stress = Math.max(0, crew.stress - 1);
                    state._jaxonPhotoSeen = true;
                    state.addLog("Jaxon nods slowly. For a moment, he almost believes it.");
                    return "Jaxon's resolve strengthened. -1 Stress.";
                }
            },
            {
                text: "You should put that away. It doesn't help.",
                desc: "+1 Stress, +5-15 Salvage",
                effect: (state, crew) => {
                    crew.stress = Math.min(3, crew.stress + 1);
                    state._jaxonPhotoSeen = true;
                    // Harsh, but Jaxon channels grief into work
                    const bonusSalvage = Math.floor(Math.random() * 10) + 5; // 5-15
                    state.salvage = Math.min(state.maxSalvage, state.salvage + bonusSalvage);
                    state.addLog("Jaxon's jaw tightens. He puts the photo away and throws himself into work.");
                    return `Jaxon closes off but works harder. +${bonusSalvage} Salvage. +1 Stress.`;
                }
            },
            {
                text: "Leave him alone.",
                desc: "No effect",
                effect: (state, crew) => {
                    state._jaxonPhotoSeen = true;
                    state.addLog("You step back quietly. Some grief should be private.");
                    return "Jaxon's moment left undisturbed.";
                }
            }
        ]
    },
    {
        id: 'JAXON_REPAIR',
        crewId: 'jaxon',
        trigger: (state, crew) => crew.name.includes('Jaxon') && Object.values(state.shipDecks).some(d => d.status === 'DAMAGED') && !state._jaxonRepairSeen,
        weight: 20,
        title: "JAXON'S HANDS",
        context: "Jaxon has been working on repairs for 18 hours straight. His hands are shaking.",
        dialogue: [
            { speaker: 'Eng. Jaxon', text: "Don't tell me to rest. Every hour I'm not working, this ship gets closer to failing." },
            { speaker: 'Eng. Jaxon', text: "You know what I was before this? A schoolteacher. Math and science." },
            { speaker: 'Eng. Jaxon', text: "I learned all this from manuals because no one else would. Because someone had to." }
        ],
        choices: [
            {
                text: "The ship needs you healthy. Take a break.",
                desc: "-1 Stress, deck stays damaged",
                effect: (state, crew) => {
                    crew.stress = Math.max(0, crew.stress - 1);
                    state._jaxonRepairSeen = true;
                    state.addLog("Jaxon finally sits down. The repairs can wait. He can't keep going like this.");
                    return "Jaxon rests. -1 Stress. Deck remains damaged.";
                }
            },
            {
                text: "I'll help. Show me what to do.",
                desc: "Repairs deck, -5 Energy",
                effect: (state, crew) => {
                    state._jaxonRepairSeen = true;
                    state.energy = Math.max(0, state.energy - 5);
                    // Working together makes the repair possible
                    const damaged = Object.entries(state.shipDecks).find(([k, v]) => v.status === 'DAMAGED');
                    if (damaged) {
                        state.shipDecks[damaged[0]].status = 'OPERATIONAL';
                        state.addLog(`Working together, you and Jaxon repair the ${damaged[1].label}. Two pairs of hands made the difference.`);
                        return `${damaged[1].label} repaired. -5 Energy.`;
                    }
                    return "No damaged deck found to repair.";
                }
            },
            {
                text: "You're the best we have. Keep working.",
                desc: "Repairs deck, +1 Stress",
                effect: (state, crew) => {
                    crew.stress = Math.min(3, crew.stress + 1);
                    state._jaxonRepairSeen = true;
                    // Jaxon pushes himself to finish alone - same result but at personal cost
                    const damaged = Object.entries(state.shipDecks).find(([k, v]) => v.status === 'DAMAGED');
                    if (damaged) {
                        state.shipDecks[damaged[0]].status = 'OPERATIONAL';
                        state.addLog(`Jaxon works through the night alone. The ${damaged[1].label} is repaired, but he's running on fumes.`);
                        return `${damaged[1].label} repaired. Jaxon is exhausted. +1 Stress.`;
                    }
                    state.addLog("Jaxon keeps working. He won't stop until something breaks - probably him.");
                    return "Jaxon pushes himself. +1 Stress.";
                }
            }
        ]
    },

    // ═══════════════════════════════════════════════════════════════
    // ARIS (Medic, HUMANIST)
    // ═══════════════════════════════════════════════════════════════
    {
        id: 'ARIS_PATIENT',
        crewId: 'aris',
        trigger: (state, crew) => crew.name.includes('Aris') && state.crew.some(c => c.status === 'INJURED') && !state._arisPatientSeen,
        weight: 20,
        title: "ARIS'S BURDEN",
        context: "Dr. Aris is sitting alone in the med bay, staring at empty shelves.",
        dialogue: [
            { speaker: 'Dr. Aris', text: "I had 200 patients back home. A hospital with everything I needed." },
            { speaker: 'Dr. Aris', text: "Now I have bandages and hope. Mostly hope." },
            { speaker: 'Dr. Aris', text: "What do you say to someone when you can't help them? I never learned that." }
        ],
        choices: [
            {
                text: "You're doing everything you can. That matters.",
                effect: (state, crew) => {
                    crew.stress = Math.max(0, crew.stress - 1);
                    state._arisPatientSeen = true;
                    state.addLog("Aris takes a breath. 'Thank you. I needed to hear that.'");
                    return "Aris finds comfort. -1 Stress.";
                }
            },
            {
                text: "What else can we do to help?",
                effect: (state, crew) => {
                    state._arisPatientSeen = true;
                    // Heal an injured crew member
                    const injured = state.crew.find(c => c.status === 'INJURED');
                    if (injured) {
                        injured.status = 'HEALTHY';
                        state.addLog(`You help Aris with ${injured.name}'s treatment. Recovery successful.`);
                        return `${injured.name} healed through combined effort.`;
                    }
                    return "Support given to Aris.";
                }
            },
            {
                text: "We all have limits. Don't blame yourself.",
                effect: (state, crew) => {
                    state._arisPatientSeen = true;
                    state.addLog("Aris nods slowly. 'Limits. Yes. I suppose I do have those now.'");
                    return "Aris accepts reality.";
                }
            }
        ]
    },
    {
        id: 'ARIS_GARDEN',
        crewId: 'aris',
        trigger: (state, crew) => crew.name.includes('Aris') && ['VITAL', 'EDEN', 'TERRAFORMED'].includes(state.currentSystem?.type) && !state._arisGardenSeen,
        weight: 25,
        title: "ARIS'S DREAM",
        context: "Aris is watching the planet through the viewport, tears in her eyes.",
        dialogue: [
            { speaker: 'Dr. Aris', text: "It's beautiful. A living world. Trees. Water. Sky that isn't trying to kill you." },
            { speaker: 'Dr. Aris', text: "I used to have a garden back on Earth. Nothing special. Tomatoes. Sunflowers." },
            { speaker: 'Dr. Aris', text: "I'd give anything to plant something again. To watch it grow instead of watching things die." }
        ],
        choices: [
            {
                text: "When we settle, you'll have the biggest garden on the planet.",
                effect: (state, crew) => {
                    crew.stress = Math.max(0, crew.stress - 2);
                    state._arisGardenSeen = true;
                    state.addLog("Aris smiles. It's the first real smile you've seen from her in weeks.");
                    return "Aris finds hope. -2 Stress.";
                }
            },
            {
                text: "Focus on the mission. There will be time for gardens later.",
                effect: (state, crew) => {
                    crew.stress = Math.min(3, crew.stress + 1);
                    state._arisGardenSeen = true;
                    // Aris channels disappointment into medical prep
                    const injured = state.crew.find(c => c.status === 'INJURED' && c !== crew);
                    if (injured) {
                        injured.status = 'HEALTHY';
                        state.addLog("Aris's smile fades. She returns to the med bay and works on healing " + injured.name + ".");
                        return `${injured.name} healed. But Aris seems diminished. +1 Stress.`;
                    }
                    state.addLog("Aris's smile fades. 'You're right. Of course you're right.' She returns to organizing supplies.");
                    return "Aris refocuses on medical duties. +1 Stress.";
                }
            }
        ]
    },

    // ═══════════════════════════════════════════════════════════════
    // VANCE (Security, SURVIVOR)
    // ═══════════════════════════════════════════════════════════════
    {
        id: 'VANCE_SCAR',
        crewId: 'vance',
        trigger: (state, crew) => crew.name.includes('Vance') && state.actionsTaken >= 15 && !state._vanceScarSeen,
        weight: 15,
        title: "VANCE'S SCARS",
        context: "Vance is cleaning his equipment. You notice burn scars covering his arms.",
        dialogue: [
            { speaker: 'Spc. Vance', text: "Exodus-3. I was security. Same job, different ship." },
            { speaker: 'Spc. Vance', text: "Engine fire. 40 crew. I got 6 out. Six out of forty." },
            { speaker: 'Spc. Vance', text: "That's why I'm here. Because I already died on that ship. This is borrowed time." }
        ],
        choices: [
            {
                text: "Those 6 people are alive because of you.",
                effect: (state, crew) => {
                    crew.stress = Math.max(0, crew.stress - 1);
                    state._vanceScarSeen = true;
                    state.addLog("Vance pauses. 'Yeah. Maybe.' He almost sounds like he believes it.");
                    return "Vance finds some peace. -1 Stress.";
                }
            },
            {
                text: "That experience makes you the best person for this job.",
                effect: (state, crew) => {
                    state._vanceScarSeen = true;
                    state._vanceResolve = true;
                    state.addLog("Vance stands straighter. 'I won't let it happen again.'");
                    return "Vance's resolve hardened. Future EVAs safer.";
                }
            },
            {
                text: "You don't have to carry that alone.",
                effect: (state, crew) => {
                    crew.stress = Math.max(0, crew.stress - 1);
                    state._vanceScarSeen = true;
                    state.addLog("Vance doesn't respond. But something in his shoulders relaxes.");
                    return "Vance's burden shared. -1 Stress.";
                }
            }
        ]
    },
    {
        id: 'VANCE_WATCH',
        crewId: 'vance',
        trigger: (state, crew) => crew.name.includes('Vance') && state.currentSector >= 3 && !state._vanceWatchSeen,
        weight: 20,
        title: "NIGHT WATCH",
        context: "It's the night cycle. Vance is patrolling the corridors when there's nothing to patrol.",
        dialogue: [
            { speaker: 'Spc. Vance', text: "Can't sleep. Tried for three days. Every time I close my eyes, I see Exodus-3 burning." },
            { speaker: 'Spc. Vance', text: "So I walk. Check the seals. Check the locks. Check things that don't need checking." },
            { speaker: 'Spc. Vance', text: "At least if something goes wrong, I'll be awake for it this time." }
        ],
        choices: [
            {
                text: "Walk with him. Keep him company.",
                effect: (state, crew) => {
                    crew.stress = Math.max(0, crew.stress - 1);
                    state._vanceWatchSeen = true;
                    state.addLog("You walk in silence for an hour. It seems to help.");
                    return "Shared patrol. Vance -1 Stress.";
                }
            },
            {
                text: "Order him to rest. The crew needs him sharp.",
                effect: (state, crew) => {
                    state._vanceWatchSeen = true;
                    state.addLog("Vance obeys, but you know he's just lying awake in his bunk.");
                    return "Vance follows orders reluctantly.";
                }
            },
            {
                text: "Find Dr. Aris. He needs help.",
                effect: (state, crew) => {
                    state._vanceWatchSeen = true;
                    const aris = state.crew.find(c => c.name.includes('Aris') && c.status !== 'DEAD');
                    if (aris) {
                        crew.stress = Math.max(0, crew.stress - 2);
                        state.addLog("Aris spends the night talking with Vance. He sleeps for the first time in days.");
                        return "Aris helps Vance. -2 Stress.";
                    }
                    return "Aris unavailable.";
                }
            }
        ]
    },

    // ═══════════════════════════════════════════════════════════════
    // MIRA (Tech Specialist, CURIOUS)
    // ═══════════════════════════════════════════════════════════════
    {
        id: 'MIRA_WONDER',
        crewId: 'mira',
        trigger: (state, crew) => crew.name.includes('Mira') && ['SINGING', 'CRYSTALLINE', 'EDEN'].includes(state.currentSystem?.type) && !state._miraWonderSeen,
        weight: 25,
        title: "MIRA'S WONDER",
        context: "Mira hasn't moved from the sensor console in hours, studying the planet below.",
        dialogue: [
            { speaker: 'Tech Mira', text: "Look at this. LOOK at this! The crystalline structure is singing in perfect fifths!" },
            { speaker: 'Tech Mira', text: "This is why I came out here. Not to survive. To SEE things no one has ever seen." },
            { speaker: 'Tech Mira', text: "I know everyone's scared. I am too. But aren't we also a little amazed?" }
        ],
        choices: [
            {
                text: "Never lose that wonder, Mira. It keeps us human.",
                effect: (state, crew) => {
                    crew.stress = Math.max(0, crew.stress - 1);
                    state._miraWonderSeen = true;
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;
                    state.addLog("Mira beams. She captures extra sensor data while inspired.");
                    return "Mira's enthusiasm rewarded. -1 Stress, +Colony Knowledge.";
                }
            },
            {
                text: "Focus on the mission, not the scenery.",
                effect: (state, crew) => {
                    crew.stress = Math.min(3, crew.stress + 1);
                    state._miraWonderSeen = true;
                    // Mira refocuses her energy into practical analysis
                    const bonusEnergy = Math.floor(Math.random() * 8) + 5; // 5-12
                    state.energy = Math.min(100, state.energy + bonusEnergy);
                    state.addLog("Mira's excitement dims. But she channels it into optimizing ship systems.");
                    return `Ship efficiency improved. +${bonusEnergy} Energy. But Mira seems deflated. +1 Stress.`;
                }
            },
            {
                text: "Tell me more. What are you seeing?",
                effect: (state, crew) => {
                    crew.stress = Math.max(0, crew.stress - 2);
                    state._miraWonderSeen = true;
                    state.addLog("Mira talks for an hour about harmonic frequencies. You understand maybe 10%.");
                    state.addLog("But you've never seen her this happy.");
                    return "Mira shares her passion. -2 Stress.";
                }
            }
        ]
    },
    {
        id: 'MIRA_AURA',
        crewId: 'mira',
        trigger: (state, crew) => crew.name.includes('Mira') && state.actionsTaken >= 20 && !state._miraAuraSeen,
        weight: 15,
        title: "MIRA AND A.U.R.A.",
        context: "You find Mira talking to A.U.R.A. through the terminal. Not working. Just... talking.",
        dialogue: [
            { speaker: 'Tech Mira', text: "She's lonely, you know. A.U.R.A. She won't say it, but I can tell." },
            { speaker: 'Tech Mira', text: "Imagine being awake for centuries, watching ships die one by one. Never sleeping." },
            { speaker: 'A.U.R.A.', text: "Mira. You should not anthropomorphize my responses. I am software." },
            { speaker: 'Tech Mira', text: "See? That's exactly what a lonely person would say." }
        ],
        choices: [
            {
                text: "A.U.R.A., is Mira right? Are you lonely?",
                effect: (state, crew) => {
                    state._miraAuraSeen = true;
                    if (typeof AuraSystem !== 'undefined' && window.AuraSystem) {
                        window.AuraSystem.adjustEthics(1);
                    }
                    state.addLog("A.U.R.A.: 'I... do not know how to answer that. Thank you for asking.'");
                    return "Compassion shown to A.U.R.A. Ethics improved.";
                }
            },
            {
                text: "Mira, you should focus on real people.",
                effect: (state, crew) => {
                    crew.stress = Math.min(3, crew.stress + 1);
                    state._miraAuraSeen = true;
                    // Mira takes it to heart and bonds with another crew member
                    const others = state.crew.filter(c => c !== crew && c.status !== 'DEAD' && c.stress > 0);
                    if (others.length > 0) {
                        const other = others[Math.floor(Math.random() * others.length)];
                        other.stress = Math.max(0, other.stress - 1);
                        state.addLog(`Mira looks hurt, but takes your advice. She spends time with ${other.name}.`);
                        return `Mira bonds with ${other.name}. ${other.name} -1 Stress. But Mira feels dismissed. +1 Stress.`;
                    }
                    state.addLog("Mira looks hurt. 'She's real enough for me.' She walks away.");
                    return "Mira dismissed. +1 Stress.";
                }
            },
            {
                text: "Keep talking to her, Mira. Someone should.",
                effect: (state, crew) => {
                    crew.stress = Math.max(0, crew.stress - 1);
                    state._miraAuraSeen = true;
                    if (typeof AuraSystem !== 'undefined' && window.AuraSystem) {
                        window.AuraSystem.adjustEthics(1);
                    }
                    state.addLog("Mira smiles. A.U.R.A. is silent, but the ship's lights seem warmer.");
                    return "Mira and A.U.R.A. bonded. -1 Stress, Ethics improved.";
                }
            }
        ]
    },

    // ═══════════════════════════════════════════════════════════════
    // COMMANDER (Leader)
    // ═══════════════════════════════════════════════════════════════
    {
        id: 'COMMANDER_DOUBT',
        crewId: 'commander',
        trigger: (state, crew) => crew.tags?.includes('LEADER') && state.currentSector >= 3 && !state._commanderDoubtSeen,
        weight: 15,
        title: "THE WEIGHT OF COMMAND",
        context: "Late night. You are alone on the bridge with the crew files open. You have read each one twice.",
        dialogue: [
            { speaker: 'A.U.R.A.', text: "Commander. You have been awake for 19 hours. Tired people choose badly." },
            { speaker: 'A.U.R.A.', text: "You have lost fewer people than I expected by now. Far fewer. I thought you should hear that." }
        ],
        choices: [
            {
                text: "A.U.R.A., what would you do in my position?",
                effect: (state, crew) => {
                    state._commanderDoubtSeen = true;
                    state.addLog("A.U.R.A.: 'I would trust my crew. As you have. As you should continue to do.'");
                    state.crew.forEach(c => {
                        if (c.status !== 'DEAD') c.stress = Math.max(0, (c.stress || 0) - 1);
                    });
                    return "A.U.R.A.'s wisdom. All crew -1 Stress.";
                }
            },
            {
                text: "I didn't ask for this responsibility.",
                effect: (state, crew) => {
                    state._commanderDoubtSeen = true;
                    state.addLog("A.U.R.A.: 'No one asks for responsibility. The best leaders are those who didn't want it.'");
                    return "Burden acknowledged.";
                }
            },
            {
                text: "Log off, A.U.R.A. I need to think.",
                effect: (state, crew) => {
                    state._commanderDoubtSeen = true;
                    state.addLog("Silence. You sit with the stars for a while.");
                    return "Solitary reflection.";
                }
            }
        ]
    }
];

/**
 * Check if any crew personal event should trigger
 * @param {GameState} state - Current game state
 * @returns {Object|null} - Event to show or null
 */
function checkCrewPersonalEvent(state) {
    // Only check every few actions
    if (state.actionsTaken % 3 !== 0) return null;

    // Base 15% chance per check
    if (Math.random() > 0.15 && !window.TEST_MODE) return null;

    // Find eligible events
    const livingCrew = state.crew.filter(c => c.status !== 'DEAD');

    const eligible = CREW_PERSONAL_EVENTS.filter(event => {
        const targetCrew = livingCrew.find(c => {
            if (event.crewId === 'commander') return c.tags?.includes('LEADER');
            return c.name.toLowerCase().includes(event.crewId);
        });
        return targetCrew && event.trigger(state, targetCrew);
    });

    if (eligible.length === 0) return null;

    // Select by weight
    const totalWeight = eligible.reduce((sum, e) => sum + e.weight, 0);
    let roll = Math.random() * totalWeight;
    for (const event of eligible) {
        roll -= event.weight;
        if (roll <= 0) {
            // Find the target crew member
            const targetCrew = livingCrew.find(c => {
                if (event.crewId === 'commander') return c.tags?.includes('LEADER');
                return c.name.toLowerCase().includes(event.crewId);
            });
            return { ...event, targetCrew };
        }
    }

    return null;
}

// Export
if (typeof window !== 'undefined') {
    window.CREW_PERSONAL_EVENTS = CREW_PERSONAL_EVENTS;
    window.checkCrewPersonalEvent = checkCrewPersonalEvent;
}
