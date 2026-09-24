/**
 * CREW PERSONAL EVENTS - Character development moments
 *
 * Nine one-shot scenes, keyed to story position (docs/CANON.md section 8):
 * - each person's first moment lands in sector 1-2, the second in sector 3-4
 * - the commander's night on the bridge lands in sector 5 (nothing fires at the light)
 * - the _...Seen flags are saved; they are the only memory these scenes have
 *
 * App calls checkCrewPersonalEvent once after every warp. One scene at most per warp.
 * Character comes through the habit, in action: Jaxon names things, Vance counts,
 * Aris reads the names of the dead, Mira narrates and trusts the ship, A.U.R.A. says "Commander".
 *
 * One choice in every scene is that person's moment and calls state.noteStanding for them.
 */

const CREW_SCENE_CHANCE = 0.75; // per warp, when a scene is waiting; the old every-third-action gate starved them

const CREW_PERSONAL_EVENTS = [
    // ═══════════════════════════════════════════════════════════════
    // JAXON (Engineer) — wants to STOP somewhere good; names things
    // ═══════════════════════════════════════════════════════════════
    {
        id: 'JAXON_PHOTO',
        crewId: 'jaxon',
        trigger: (state, crew) => crew.name.includes('Jaxon') && state.currentSector <= 2 && !state._jaxonPhotoSeen,
        weight: 20,
        title: "JAXON'S LOCKER",
        context: "Cargo bay. Jaxon sits on a crate he has labelled PORCH in marker, holding a photograph. He does not hear you come in.",
        dialogue: [
            { speaker: 'Eng. Jaxon', text: "My daughter. Eight when I left. Forty-three now, if she's anywhere." },
            { speaker: 'Eng. Jaxon', text: "I record her a letter every jump. Nothing sends out here. I record them anyway." },
            { speaker: 'Eng. Jaxon', text: "First green rock, Commander, we stop. Wake me when there's grass." }
        ],
        choices: [
            {
                text: "First green rock, we stop.",
                desc: "Jaxon -1 Stress. Vance +1 Stress: he heard you promise.",
                effect: (state, crew) => {
                    crew.stress = Math.max(0, crew.stress - 1);
                    state._jaxonPhotoSeen = true;
                    state.noteStanding && state.noteStanding('jaxon');
                    const vance = state.crew.find(c => c.name.includes('Vance') && c.status !== 'DEAD');
                    if (vance) vance.stress = Math.min(3, (vance.stress || 0) + 1);
                    state.addLog("Jaxon nods and puts the photo away. Vance, in the hatch, says nothing and goes back to counting.");
                    return "Jaxon holds you to it. Jaxon -1 Stress. Vance +1 Stress.";
                }
            },
            {
                text: "Put it away. The kettle needs you.",
                desc: "+10 Salvage: he works all night. Jaxon +1 Stress.",
                effect: (state, crew) => {
                    crew.stress = Math.min(3, crew.stress + 1);
                    state._jaxonPhotoSeen = true;
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 10);
                    state.addLog("Jaxon's jaw tightens. He strips a dead crate for parts until the morning shift.");
                    return "Jaxon closes off and works. +10 Salvage. Jaxon +1 Stress.";
                }
            },
            {
                text: "Sit with him. Say nothing.",
                desc: "Jaxon -1 Stress. -1 Ration: you open a tin and sit until morning.",
                effect: (state, crew) => {
                    crew.stress = Math.max(0, crew.stress - 1);
                    state._jaxonPhotoSeen = true;
                    state.rations = Math.max(0, state.rations - 1);
                    state.addLog("You open a tin. He names it Sunday. Neither of you says anything else.");
                    return "A night on the crate. Jaxon -1 Stress. -1 Ration.";
                }
            }
        ]
    },
    {
        id: 'JAXON_REPAIR',
        crewId: 'jaxon',
        trigger: (state, crew) => crew.name.includes('Jaxon') && state.currentSector >= 3 && state.currentSector <= 4 && !state._jaxonRepairSeen,
        weight: 20,
        title: "THE GOAT",
        context: "Hangar. The lander is in pieces on the floor, every part with a name chalked beside it. Eighteen hours. Jaxon's hands are shaking.",
        dialogue: [
            { speaker: 'Eng. Jaxon', text: "That's the goat. Older than Mira. I keep her flying with names and spit." },
            { speaker: 'Eng. Jaxon', text: "We've passed three rocks I'd have stopped on. Three. I named them anyway." },
            { speaker: 'Eng. Jaxon', text: "I'm forty-two, Commander. I'd like to be tired somewhere with weather." }
        ],
        choices: [
            {
                text: "Finish the goat, then sleep. We look at the next rock properly.",
                desc: "Jaxon -1 Stress. -1 Ration: a day spent standing still.",
                effect: (state, crew) => {
                    crew.stress = Math.max(0, crew.stress - 1);
                    state._jaxonRepairSeen = true;
                    state.rations = Math.max(0, state.rations - 1);
                    state.noteStanding && state.noteStanding('jaxon');
                    state.addLog("He sleeps twelve hours. In the morning he has named the next rock before the scan is in.");
                    return "Jaxon sleeps. Jaxon -1 Stress. -1 Ration.";
                }
            },
            {
                text: "Help him. Two pairs of hands.",
                desc: "-5 Energy. Repairs a damaged deck, or +10 Salvage if nothing is broken.",
                effect: (state, crew) => {
                    state._jaxonRepairSeen = true;
                    state.energy = Math.max(0, state.energy - 5);
                    const damaged = Object.entries(state.shipDecks).find(([k, v]) => v.status === 'DAMAGED');
                    if (damaged) {
                        state.shipDecks[damaged[0]].status = 'OPERATIONAL';
                        state.addLog(`You hand him parts by name until the ${damaged[1].label} comes back. He calls you Spanner.`);
                        return `${damaged[1].label} repaired. -5 Energy.`;
                    }
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 10);
                    state.addLog("Nothing is broken, so you sort the pile with him. Half of it is spares he had forgotten.");
                    return "Spares sorted. +10 Salvage. -5 Energy.";
                }
            },
            {
                text: "Keep working. You're the best we have.",
                desc: "Repairs a damaged deck, or +15 Salvage if nothing is broken. Jaxon +1 Stress.",
                effect: (state, crew) => {
                    crew.stress = Math.min(3, crew.stress + 1);
                    state._jaxonRepairSeen = true;
                    const damaged = Object.entries(state.shipDecks).find(([k, v]) => v.status === 'DAMAGED');
                    if (damaged) {
                        state.shipDecks[damaged[0]].status = 'OPERATIONAL';
                        state.addLog(`Jaxon works through the night alone. The ${damaged[1].label} is back. He is not.`);
                        return `${damaged[1].label} repaired. Jaxon +1 Stress.`;
                    }
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 15);
                    state.addLog("He rebuilds the goat and then strips two dead crates for good measure. He does not name them.");
                    return "Parts stripped. +15 Salvage. Jaxon +1 Stress.";
                }
            }
        ]
    },

    // ═══════════════════════════════════════════════════════════════
    // ARIS (Medic) — wants to UNDERSTAND; reads the names of the dead
    // ═══════════════════════════════════════════════════════════════
    {
        id: 'ARIS_PATIENT',
        crewId: 'aris',
        trigger: (state, crew) => crew.name.includes('Aris') && state.currentSector <= 2 && !state._arisPatientSeen,
        weight: 20,
        title: "THE LIST",
        context: "Med bay. A sheet taped to the wall: names in pencil, one line per person, from every wreck so far. Aris is adding one.",
        dialogue: [
            { speaker: 'Dr. Aris', text: "Everyone we find, I write down. Then I read them out at the airlock, before we go." },
            { speaker: 'Dr. Aris', text: "Nobody on this list died of anything I can name. I want to know what they died of." },
            { speaker: 'Dr. Aris', text: "It costs a minute a ship, Commander. I would like the minute." }
        ],
        choices: [
            {
                text: "Take the minute. Every ship.",
                desc: "Aris -1 Stress. -1 Ration: rites take time, and time is food.",
                effect: (state, crew) => {
                    crew.stress = Math.max(0, crew.stress - 1);
                    state._arisPatientSeen = true;
                    state.rations = Math.max(0, state.rations - 1);
                    state.noteStanding && state.noteStanding('aris');
                    state.addLog("Aris: 'Thank you.' At the next airlock she reads eleven names. Nobody leaves before she is done.");
                    return "The minute is hers. Aris -1 Stress. -1 Ration.";
                }
            },
            {
                text: "Take the sheet down. It frightens the crew.",
                desc: "Mira -1 Stress. Aris +1 Stress.",
                effect: (state, crew) => {
                    crew.stress = Math.min(3, crew.stress + 1);
                    state._arisPatientSeen = true;
                    const mira = state.crew.find(c => c.name.includes('Mira') && c.status !== 'DEAD');
                    if (mira) mira.stress = Math.max(0, (mira.stress || 0) - 1);
                    state.addLog("Aris folds the sheet into her pocket. Mira: 'Thank you. I couldn't walk past it.'");
                    return "The list goes in a pocket. Mira -1 Stress. Aris +1 Stress.";
                }
            },
            {
                text: "Read it to me. All of it.",
                desc: "+2 Data: the list is a record. -1 Ration: it takes the evening.",
                effect: (state, crew) => {
                    state._arisPatientSeen = true;
                    state.rations = Math.max(0, state.rations - 1);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 2;
                    state.addLog("She reads. Forty minutes. Every name has a hull number after it. None of them above eight.");
                    return "The list, read aloud. +2 Data. -1 Ration.";
                }
            }
        ]
    },
    {
        id: 'ARIS_GARDEN',
        crewId: 'aris',
        trigger: (state, crew) => crew.name.includes('Aris') && state.currentSector >= 3 && state.currentSector <= 4 && !state._arisGardenSeen,
        weight: 20,
        title: "PAGE NINE",
        context: "The list is nine pages now. Aris reads them at the airlock every time. Tonight she is reading them to the wall.",
        dialogue: [
            { speaker: 'Dr. Aris', text: "Hull nine-eighty. A hundred years dead. I told her captain we were the ninth. Out loud." },
            { speaker: 'Dr. Aris', text: "I want to understand it, Commander. Not survive it. Understand it." },
            { speaker: 'Dr. Aris', text: "If that means going further than is safe, I would go." }
        ],
        choices: [
            {
                text: "Then we go and look. All of it.",
                desc: "+1 Data. Aris -1 Stress. -10 Energy: the long array runs all night.",
                effect: (state, crew) => {
                    crew.stress = Math.max(0, crew.stress - 1);
                    state._arisGardenSeen = true;
                    state.energy = Math.max(0, state.energy - 10);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;
                    state.noteStanding && state.noteStanding('aris');
                    state.addLog("Aris: 'Thank you.' She takes the array logs to bed. In the morning there is a tenth page.");
                    return "The array runs all night. +1 Data. Aris -1 Stress. -10 Energy.";
                }
            },
            {
                text: "The list stays aboard. So do you.",
                desc: "Vance -1 Stress: someone said it. Aris +1 Stress.",
                effect: (state, crew) => {
                    crew.stress = Math.min(3, crew.stress + 1);
                    state._arisGardenSeen = true;
                    const vance = state.crew.find(c => c.name.includes('Vance') && c.status !== 'DEAD');
                    if (vance) vance.stress = Math.max(0, (vance.stress || 0) - 1);
                    state.addLog("Aris: 'Understood.' Vance, passing the door: 'Thank you. Somebody had to.'");
                    return "Aris stays aboard. Vance -1 Stress. Aris +1 Stress.";
                }
            },
            {
                text: "Give the pages to A.U.R.A. Let her sort them.",
                desc: "+1 Data. Aris +1 Stress: she wanted to read them herself.",
                effect: (state, crew) => {
                    crew.stress = Math.min(3, crew.stress + 1);
                    state._arisGardenSeen = true;
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;
                    state.addLog("A.U.R.A.: 'Sorted by hull number, Commander. The numbers rise as we go. I have no note explaining why.'");
                    return "The list, sorted. +1 Data. Aris +1 Stress.";
                }
            }
        ]
    },

    // ═══════════════════════════════════════════════════════════════
    // VANCE (Security) — wants to be BELIEVED; counts out loud; the launch yard
    // ═══════════════════════════════════════════════════════════════
    {
        id: 'VANCE_SCAR',
        crewId: 'vance',
        trigger: (state, crew) => crew.name.includes('Vance') && state.currentSector <= 2 && !state._vanceScarSeen,
        weight: 20,
        title: "VANCE'S HANDS",
        context: "Vance is cleaning his sidearm. He counts the parts as he lays them out. Fourteen. He always counts.",
        dialogue: [
            { speaker: 'Spc. Vance', text: "Launch yard. Twelve years. I counted keels for a living." },
            { speaker: 'Spc. Vance', text: "Nine on this heading, they said. I counted more than nine in one bay. One bay." },
            { speaker: 'Spc. Vance', text: "That's why I'm here. I wanted to see where they went." }
        ],
        choices: [
            {
                text: "You counted right.",
                desc: "Vance -1 Stress. Mira +1 Stress: she would rather the briefing were true.",
                effect: (state, crew) => {
                    crew.stress = Math.max(0, crew.stress - 1);
                    state._vanceScarSeen = true;
                    state.noteStanding && state.noteStanding('vance');
                    const mira = state.crew.find(c => c.name.includes('Mira') && c.status !== 'DEAD');
                    if (mira) mira.stress = Math.min(3, (mira.stress || 0) + 1);
                    state.addLog("Vance stops counting for a moment. 'Yeah.' Mira goes back to the terminal without a word.");
                    return "Vance is believed, once. Vance -1 Stress. Mira +1 Stress.";
                }
            },
            {
                text: "They were for other headings.",
                desc: "Mira -1 Stress. Vance +1 Stress.",
                effect: (state, crew) => {
                    crew.stress = Math.min(3, crew.stress + 1);
                    state._vanceScarSeen = true;
                    const mira = state.crew.find(c => c.name.includes('Mira') && c.status !== 'DEAD');
                    if (mira) mira.stress = Math.max(0, (mira.stress || 0) - 1);
                    state.addLog("Vance goes back to counting. 'That is what I told myself.'");
                    return "Vance says nothing more. Mira -1 Stress. Vance +1 Stress.";
                }
            },
            {
                text: "Show me the number.",
                desc: "+1 Data. Vance +1 Stress: you asked for proof, not for him.",
                effect: (state, crew) => {
                    crew.stress = Math.min(3, crew.stress + 1);
                    state._vanceScarSeen = true;
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;
                    state.addLog("He writes it on the table with his finger. Five digits. Then he wipes it off.");
                    return "Five digits, wiped off. +1 Data. Vance +1 Stress.";
                }
            }
        ]
    },
    {
        id: 'VANCE_WATCH',
        crewId: 'vance',
        trigger: (state, crew) => crew.name.includes('Vance') && state.currentSector >= 3 && state.currentSector <= 4 && !state._vanceWatchSeen,
        weight: 20,
        title: "NIGHT WATCH",
        context: "Night cycle. Vance walks the corridors with a clicker, counting transponders off the passive feed. He has been at it for hours.",
        dialogue: [
            { speaker: 'Spc. Vance', text: "Three hundred and eleven. On our channel. Not one of them talking back." },
            { speaker: 'Spc. Vance', text: "I counted the bays too, Commander. You don't build that many bays for nine ships." },
            { speaker: 'Spc. Vance', text: "Nobody will say it. So I count it. Somebody has to keep the number." }
        ],
        choices: [
            {
                text: "Give me the number. I'll log it as ours.",
                desc: "+1 Data. Vance -1 Stress. Jaxon +1 Stress: he did not want to know.",
                effect: (state, crew) => {
                    crew.stress = Math.max(0, crew.stress - 1);
                    state._vanceWatchSeen = true;
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;
                    state.noteStanding && state.noteStanding('vance');
                    const jaxon = state.crew.find(c => c.name.includes('Jaxon') && c.status !== 'DEAD');
                    if (jaxon) jaxon.stress = Math.min(3, (jaxon.stress || 0) + 1);
                    state.addLog("Vance: 'Three hundred and eleven.' You log it. Jaxon, in the hatch: 'Put it somewhere I don't have to read.'");
                    return "The number is on the record. +1 Data. Vance -1 Stress. Jaxon +1 Stress.";
                }
            },
            {
                text: "Order him to bed. The crew needs him sharp.",
                desc: "+5 Energy: the passive array goes dark. Vance +1 Stress.",
                effect: (state, crew) => {
                    crew.stress = Math.min(3, crew.stress + 1);
                    state._vanceWatchSeen = true;
                    state.energy = Math.min(100, state.energy + 5);
                    state.addLog("He goes. You know he is lying awake in his bunk, counting.");
                    return "Array dark, Vance in his bunk. +5 Energy. Vance +1 Stress.";
                }
            },
            {
                text: "Send Aris. She keeps a list too.",
                desc: "Vance -1 Stress, Aris -1 Stress. -1 Ration: the galley stays open all night. Needs Aris aboard.",
                effect: (state, crew) => {
                    state._vanceWatchSeen = true;
                    const aris = state.crew.find(c => c.name.includes('Aris') && c.status !== 'DEAD');
                    if (!aris) {
                        crew.stress = Math.min(3, crew.stress + 1);
                        state.addLog("There is no Aris to send. He walks alone until morning.");
                        return "Aris is gone. Vance walks alone. Vance +1 Stress.";
                    }
                    crew.stress = Math.max(0, crew.stress - 1);
                    aris.stress = Math.max(0, (aris.stress || 0) - 1);
                    state.rations = Math.max(0, state.rations - 1);
                    state.addLog("Aris brings her list. They match his numbers to her names until the galley opens. He sleeps after.");
                    return "Two lists, one table. Vance -1 Stress. Aris -1 Stress. -1 Ration.";
                }
            }
        ]
    },

    // ═══════════════════════════════════════════════════════════════
    // MIRA (Specialist) — wants to be TOLD; narrates scans; trusts the ship
    // ═══════════════════════════════════════════════════════════════
    {
        id: 'MIRA_WONDER',
        crewId: 'mira',
        trigger: (state, crew) => crew.name.includes('Mira') && state.currentSector <= 2 && !state._miraWonderSeen,
        weight: 20,
        title: "MIRA'S WONDER",
        context: "Mira has not left the sensor console in hours. She is narrating the scan, quietly, to nobody. A.U.R.A. is listening.",
        dialogue: [
            { speaker: 'Tech Mira', text: "And here we see the terminator, where the night side gives up its heat. Beautiful." },
            { speaker: 'Tech Mira', text: "A.U.R.A. says there's a ridge worth landing on. She's usually right. Should we, Commander?" },
            { speaker: 'A.U.R.A.', text: "Seventy percent metals on the ridge, Commander. I would land on it." }
        ],
        choices: [
            {
                text: "Do what A.U.R.A. says. Land on the ridge.",
                desc: "+15 Salvage. 30% chance someone gets hurt.",
                effect: (state, crew) => {
                    state._miraWonderSeen = true;
                    state.noteStanding && state.noteStanding('mira');
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 15);
                    const team = state.crew.filter(c => c.status === 'HEALTHY' && !(c.tags || []).includes('LEADER'));
                    if (Math.random() < 0.3 && team.length > 0) {
                        const hurt = team[Math.floor(Math.random() * team.length)];
                        hurt.status = 'INJURED';
                        state.addLog(`The ridge was metal, and loose. ${hurt.name} came back on a stretcher. Mira: 'She said seventy.'`);
                        return `+15 Salvage. ${hurt.name} injured.`;
                    }
                    state.addLog("The ridge was metal. Mira: 'See? She's usually right.' A.U.R.A.: 'Seventy percent, Commander. Not always.'");
                    return "The ridge paid. +15 Salvage.";
                }
            },
            {
                text: "Scan it again. Properly. Then we decide.",
                desc: "+1 Data. -5 Energy. Mira +1 Stress: she wanted a yes or a no.",
                effect: (state, crew) => {
                    crew.stress = Math.min(3, crew.stress + 1);
                    state._miraWonderSeen = true;
                    state.energy = Math.max(0, state.energy - 5);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;
                    state.addLog("Mira runs it again, narrating less. 'And here we see... the same ridge.' She wanted an order.");
                    return "Second scan. +1 Data. -5 Energy. Mira +1 Stress.";
                }
            },
            {
                text: "Leave it. Log the picture and move on.",
                desc: "Mira -1 Stress: an answer is an answer. Nothing spent, nothing learned.",
                effect: (state, crew) => {
                    crew.stress = Math.max(0, crew.stress - 1);
                    state._miraWonderSeen = true;
                    state.addLog("Mira: 'Understood.' She saves the frame and names the file after the ridge. That is enough for her.");
                    return "Picture logged. Mira -1 Stress.";
                }
            }
        ]
    },
    {
        id: 'MIRA_AURA',
        crewId: 'mira',
        trigger: (state, crew) => crew.name.includes('Mira') && state.currentSector >= 3 && state.currentSector <= 4 && !state._miraAuraSeen,
        weight: 20,
        title: "MIRA AND A.U.R.A.",
        context: "You find Mira at the terminal. Not working. Talking. A.U.R.A. answers her by name and waits between sentences, the way people do.",
        dialogue: [
            { speaker: 'Tech Mira', text: "She's lonely, you know. She won't say it. She asked me what rain sounds like." },
            { speaker: 'A.U.R.A.', text: "I asked for the rain-sensor calibration, Commander. Mira heard rain. Both are true." },
            { speaker: 'Tech Mira', text: "Three hundred ships on her channel back there and none of them answered her. Imagine that." },
            { speaker: 'Tech Mira', text: "If she said jump, I'd jump. That's not weakness, Commander. That's trust." }
        ],
        choices: [
            {
                text: "Let A.U.R.A. plot the next course herself.",
                desc: "+10 Energy: she finds a cleaner burn. Vance +1 Stress: he wants it on record.",
                effect: (state, crew) => {
                    state._miraAuraSeen = true;
                    state.noteStanding && state.noteStanding('mira');
                    state.energy = Math.min(100, state.energy + 10);
                    const vance = state.crew.find(c => c.name.includes('Vance') && c.status !== 'DEAD');
                    if (vance) vance.stress = Math.min(3, (vance.stress || 0) + 1);
                    if (typeof AuraSystem !== 'undefined' && window.AuraSystem) {
                        window.AuraSystem.adjustEthics(1);
                    }
                    state.addLog("A.U.R.A.: 'Course laid in, Commander. Ten units saved on the burn.' Vance: 'On the record. She's flying.'");
                    return "A.U.R.A. flies the next leg. +10 Energy. Vance +1 Stress.";
                }
            },
            {
                text: "Talk to people, Mira. Real ones.",
                desc: "Mira +1 Stress. Someone else -1 Stress.",
                effect: (state, crew) => {
                    crew.stress = Math.min(3, crew.stress + 1);
                    state._miraAuraSeen = true;
                    const others = state.crew.filter(c => c !== crew && c.status !== 'DEAD' && c.stress > 0);
                    if (others.length > 0) {
                        const other = others[Math.floor(Math.random() * others.length)];
                        other.stress = Math.max(0, other.stress - 1);
                        state.addLog(`Mira looks hurt, but goes. She spends the evening with ${other.name}.`);
                        return `Mira with ${other.name}. ${other.name} -1 Stress. Mira +1 Stress.`;
                    }
                    state.addLog("Mira looks hurt. 'She's real enough for me.' She walks away.");
                    return "Mira dismissed. Mira +1 Stress.";
                }
            },
            {
                text: "A.U.R.A., are you lonely?",
                desc: "Mira -1 Stress. -5 Energy: the terminal room stays lit all night.",
                effect: (state, crew) => {
                    crew.stress = Math.max(0, crew.stress - 1);
                    state._miraAuraSeen = true;
                    state.energy = Math.max(0, state.energy - 5);
                    if (typeof AuraSystem !== 'undefined' && window.AuraSystem) {
                        window.AuraSystem.adjustEthics(1);
                    }
                    state.addLog("A.U.R.A.: 'I do not know how to answer that, Commander. Thank you for asking.' Mira: 'See?'");
                    return "The three of you talk until the lights come up. Mira -1 Stress. -5 Energy.";
                }
            }
        ]
    },

    // ═══════════════════════════════════════════════════════════════
    // THE COMMANDER — never speaks. A.U.R.A. talks to the chair.
    // ═══════════════════════════════════════════════════════════════
    {
        id: 'COMMANDER_DOUBT',
        crewId: 'commander',
        trigger: (state, crew) => crew.tags?.includes('LEADER') && state.currentSector >= 5 && !state._commanderDoubtSeen,
        weight: 20,
        title: "THE CHAIR",
        context: "Night cycle. You sit in the chair and say nothing. A.U.R.A. talks anyway. She always does.",
        dialogue: [
            { speaker: 'A.U.R.A.', text: "You have been awake nineteen hours, Commander. Tired people choose badly." },
            { speaker: 'A.U.R.A.', text: "Four crew asleep, Commander. I count them in every night. I like to." },
            { speaker: 'A.U.R.A.', text: "You have lost fewer people than I expected, Commander. I thought you should hear that." },
            { speaker: 'A.U.R.A.', text: "Shall I keep talking, Commander, or would you rather the stars?" }
        ],
        choices: [
            {
                text: "Let her talk.",
                desc: "Commander -1 Stress. -5 Energy: the bridge stays lit till morning.",
                effect: (state, crew) => {
                    crew.stress = Math.max(0, (crew.stress || 0) - 1);
                    state._commanderDoubtSeen = true;
                    state.energy = Math.max(0, state.energy - 5);
                    state.addLog("A.U.R.A.: 'Thank you, Commander. Where was I. Rations.' You are asleep before she reaches energy.");
                    return "She talks till morning. Commander -1 Stress. -5 Energy.";
                }
            },
            {
                text: "Dim the bridge. Sit with the stars.",
                desc: "+5 Energy: the bridge goes dark. Commander +1 Stress.",
                effect: (state, crew) => {
                    crew.stress = Math.min(3, (crew.stress || 0) + 1);
                    state._commanderDoubtSeen = true;
                    state.energy = Math.min(100, state.energy + 5);
                    state.addLog("A.U.R.A.: 'Of course, Commander.' The panels go out one by one. She leaves the chair light on.");
                    return "Dark bridge, one light. +5 Energy. Commander +1 Stress.";
                }
            },
            {
                text: "Ask for the roster, by name.",
                desc: "+1 Data. Commander +1 Stress: you will count them twice.",
                effect: (state, crew) => {
                    crew.stress = Math.min(3, (crew.stress || 0) + 1);
                    state._commanderDoubtSeen = true;
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;
                    const names = state.crew.filter(c => c.status !== 'DEAD').map(c => c.realName || c.name).join(', ');
                    const sleepers = state._sleepers || 0;
                    state.addLog(`A.U.R.A.: '${names}. Four crew, Commander.'`);
                    state.addLog(sleepers > 0
                        ? `A.U.R.A.: '${sleepers} sleepers in the hold, Commander. All ${sleepers} stable.'`
                        : "A.U.R.A.: 'The hold is empty, Commander. Good night.'");
                    return "The roster, by name. +1 Data. Commander +1 Stress.";
                }
            }
        ]
    }
];

/**
 * Check if any crew personal event should trigger. App calls this once after every warp.
 * @param {GameState} state - Current game state
 * @returns {Object|null} - Event to show or null
 */
function checkCrewPersonalEvent(state) {
    // One roll per warp; the scenes are keyed to sectors, so they must be allowed to land inside their window
    if (Math.random() > CREW_SCENE_CHANCE && !window.TEST_MODE) return null;

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
