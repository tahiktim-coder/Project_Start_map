/**
 * CREW PERSONAL EVENTS - Character development moments
 *
 * Nine one-shot scenes, keyed to story position (docs/CANON.md section 8):
 * - each person's first moment lands in sector 1-2, the second in sector 3-4
 * - the commander's night on the bridge lands in sector 5 (nothing fires at the light)
 * - the _...Seen flags are saved; they are the only memory these scenes have
 *
 * App calls checkCrewPersonalEvent once after every warp. One scene at most per warp.
 * Character comes from what each person wants and how they react (docs/STYLE.md): no nicknames,
 * no verbal habits. Jaxon wants to stop, Vance wants the truth, Aris wants to understand the dead,
 * Mira wants to be told what to do. A.U.R.A. is calm and exact and says "Commander".
 *
 * One choice in every scene is that person's moment and calls state.noteStanding for them.
 */

const CREW_SCENE_CHANCE = 0.75; // per warp, when a scene is waiting; the old every-third-action gate starved them

const CREW_PERSONAL_EVENTS = [
    // ═══════════════════════════════════════════════════════════════
    // JAXON (Engineer) — wants to STOP somewhere good; left a daughter on Earth
    // ═══════════════════════════════════════════════════════════════
    {
        id: 'JAXON_PHOTO',
        crewId: 'jaxon',
        trigger: (state, crew) => crew.name.includes('Jaxon') && state.currentSector <= 2 && !state._jaxonPhotoSeen,
        weight: 20,
        title: "JAXON'S PHOTO",
        context: "Cargo bay, night shift. Jaxon is sitting on a crate with a photograph in his hands. He doesn't hear you come in.",
        dialogue: [
            { speaker: 'Eng. Jaxon', text: "That's my daughter. She was eight when we left. She'd be forty-three now." },
            { speaker: 'Eng. Jaxon', text: "I record a letter to her after every jump. There's no way to send them." },
            { speaker: 'Eng. Jaxon', text: "When we find a planet we can live on, I want us to land and stay." }
        ],
        choices: [
            {
                text: "Promise to stay on the first good planet.",
                desc: "Jaxon -1 Stress. He will remember the promise.",
                effect: (state, crew) => {
                    crew.stress = Math.max(0, crew.stress - 1);
                    state._jaxonPhotoSeen = true;
                    state.noteStanding && state.noteStanding('jaxon');
                    state.addLog("Jaxon nods and puts the photo back in his locker. 'I'll hold you to that, Commander.'");
                    return "You promised Jaxon a place to stay. Jaxon -1 Stress.";
                }
            },
            {
                text: "Tell him the reactor needs him.",
                desc: "+10 Salvage: he works all night stripping parts. Jaxon +1 Stress.",
                effect: (state, crew) => {
                    crew.stress = Math.min(3, crew.stress + 1);
                    state._jaxonPhotoSeen = true;
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 10);
                    state.addLog("Jaxon puts the photo away without a word and works until the morning shift.");
                    return "Jaxon worked all night. +10 Salvage. Jaxon +1 Stress.";
                }
            },
            {
                text: "Sit with him for a while.",
                desc: "Jaxon -1 Stress. -1 Ration: you share a meal and stay until morning.",
                effect: (state, crew) => {
                    crew.stress = Math.max(0, crew.stress - 1);
                    state._jaxonPhotoSeen = true;
                    state.rations = Math.max(0, state.rations - 1);
                    state.addLog("You open a tin of food and share it. Neither of you says much. It helps anyway.");
                    return "You sat with Jaxon until morning. Jaxon -1 Stress. -1 Ration.";
                }
            }
        ]
    },
    {
        id: 'JAXON_REPAIR',
        crewId: 'jaxon',
        trigger: (state, crew) => crew.name.includes('Jaxon') && state.currentSector >= 3 && state.currentSector <= 4 && !state._jaxonRepairSeen,
        weight: 20,
        title: "THE LANDER",
        context: "Hangar. The lander is in pieces on the floor. Jaxon has been working on it for eighteen hours, and his hands are shaking.",
        dialogue: [
            { speaker: 'Eng. Jaxon', text: "That's the lander. She's older than Mira, and she still flies." },
            { speaker: 'Eng. Jaxon', text: "We've flown past three planets I'd have been happy to live on." },
            { speaker: 'Eng. Jaxon', text: "I'm forty-two, Commander. I'd like to spend the rest of it somewhere with air and weather." }
        ],
        choices: [
            {
                text: "Hold here a day so he can sleep.",
                desc: "Jaxon -1 Stress. -1 Ration: the ship waits a day while he rests.",
                effect: (state, crew) => {
                    crew.stress = Math.max(0, crew.stress - 1);
                    state._jaxonRepairSeen = true;
                    state.rations = Math.max(0, state.rations - 1);
                    state.noteStanding && state.noteStanding('jaxon');
                    state.addLog("The ship holds position for a day. Jaxon sleeps twelve hours and wakes up looking years younger.");
                    return "Jaxon slept. Jaxon -1 Stress. -1 Ration.";
                }
            },
            {
                text: "Help him put it back together.",
                desc: "-5 Energy. Repairs a damaged deck, or +10 Salvage if nothing is broken.",
                effect: (state, crew) => {
                    state._jaxonRepairSeen = true;
                    state.energy = Math.max(0, state.energy - 5);
                    const damaged = Object.entries(state.shipDecks).find(([k, v]) => v.status === 'DAMAGED');
                    if (damaged) {
                        state.shipDecks[damaged[0]].status = 'OPERATIONAL';
                        state.addLog(`You work beside him until the ${damaged[1].label} is running again.`);
                        return `${damaged[1].label} repaired. -5 Energy.`;
                    }
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 10);
                    state.addLog("Nothing is broken, so you sort parts with him. Half of them are spares he'd forgotten about.");
                    return "Spare parts found. +10 Salvage. -5 Energy.";
                }
            },
            {
                text: "Keep working. We need you.",
                desc: "Repairs a damaged deck, or +15 Salvage if nothing is broken. Jaxon +1 Stress.",
                effect: (state, crew) => {
                    crew.stress = Math.min(3, crew.stress + 1);
                    state._jaxonRepairSeen = true;
                    const damaged = Object.entries(state.shipDecks).find(([k, v]) => v.status === 'DAMAGED');
                    if (damaged) {
                        state.shipDecks[damaged[0]].status = 'OPERATIONAL';
                        state.addLog(`Jaxon works alone through the night. The ${damaged[1].label} is fixed. He looks worn out.`);
                        return `${damaged[1].label} repaired. Jaxon +1 Stress.`;
                    }
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 15);
                    state.addLog("He finishes the lander, then strips two old crates for parts. He doesn't speak all night.");
                    return "Parts stripped. +15 Salvage. Jaxon +1 Stress.";
                }
            }
        ]
    },

    // ═══════════════════════════════════════════════════════════════
    // ARIS (Medic) — wants to UNDERSTAND what happened to the dead; keeps a list of them
    // ═══════════════════════════════════════════════════════════════
    {
        id: 'ARIS_PATIENT',
        crewId: 'aris',
        trigger: (state, crew) => crew.name.includes('Aris') && state.currentSector <= 2 && !state._arisPatientSeen,
        weight: 20,
        title: "THE LIST",
        context: "Med bay. A sheet of paper is taped to the wall with the name of every dead crew member found so far. Aris is adding one.",
        dialogue: [
            { speaker: 'Dr. Aris', text: "I write down everyone we find. Before we leave a wreck, I read their names out." },
            { speaker: 'Dr. Aris', text: "None of them died of anything I can diagnose. I want to know what killed them." },
            { speaker: 'Dr. Aris', text: "It takes a minute at each ship, Commander. I'd like to keep doing it." }
        ],
        choices: [
            {
                text: "Take the minute. At every ship.",
                desc: "Aris -1 Stress. -1 Ration: the stops add up to a day's food.",
                effect: (state, crew) => {
                    crew.stress = Math.max(0, crew.stress - 1);
                    state._arisPatientSeen = true;
                    state.rations = Math.max(0, state.rations - 1);
                    state.noteStanding && state.noteStanding('aris');
                    state.addLog("Aris: 'Thank you.' At the next wreck she reads out eleven names, and everyone waits until she's done.");
                    return "Aris reads the names at every ship. Aris -1 Stress. -1 Ration.";
                }
            },
            {
                text: "Take the list down. It upsets people.",
                desc: "Mira -1 Stress: the list frightens her. Aris +1 Stress.",
                effect: (state, crew) => {
                    crew.stress = Math.min(3, crew.stress + 1);
                    state._arisPatientSeen = true;
                    const mira = state.crew.find(c => c.name.includes('Mira') && c.status !== 'DEAD');
                    if (mira) mira.stress = Math.max(0, (mira.stress || 0) - 1);
                    state.addLog("Aris folds the sheet into her pocket. Mira: 'Thank you. I couldn't walk past it.'");
                    return "The list comes off the wall. Mira -1 Stress. Aris +1 Stress.";
                }
            },
            {
                text: "Ask her to read you the names.",
                desc: "+2 Data: the list is a record. -1 Ration: it takes all evening.",
                effect: (state, crew) => {
                    state._arisPatientSeen = true;
                    state.rations = Math.max(0, state.rations - 1);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 2;
                    state.addLog("She reads for forty minutes. Every name has a ship number next to it. None is higher than eight.");
                    return "Aris read you the whole list. +2 Data. -1 Ration.";
                }
            }
        ]
    },
    {
        id: 'ARIS_GARDEN',
        crewId: 'aris',
        trigger: (state, crew) => crew.name.includes('Aris') && state.currentSector >= 3 && state.currentSector <= 4 && !state._arisGardenSeen,
        weight: 20,
        title: "SHIP NUMBER 980",
        context: "Aris's list of the dead is nine pages long now. The newest names came off a wreck with the number 980 on its hull.",
        dialogue: [
            { speaker: 'Dr. Aris', text: "That ship's number is 980, and it's been dead about a hundred years." },
            { speaker: 'Dr. Aris', text: "We're ship number nine. A ship with a higher number should be newer than us, not older." },
            { speaker: 'Dr. Aris', text: "I don't just want to survive this, Commander. I want to understand it, even if that's dangerous." }
        ],
        choices: [
            {
                text: "Then we look properly. Run the long scan.",
                desc: "+1 Data. Aris -1 Stress. -10 Energy: the long-range scanner runs all night.",
                effect: (state, crew) => {
                    crew.stress = Math.max(0, crew.stress - 1);
                    state._arisGardenSeen = true;
                    state.energy = Math.max(0, state.energy - 10);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;
                    state.noteStanding && state.noteStanding('aris');
                    state.addLog("Aris: 'Thank you.' She takes the scan results to bed. By morning her list has a tenth page.");
                    return "The long scan ran all night. +1 Data. Aris -1 Stress. -10 Energy.";
                }
            },
            {
                text: "No risks. She stays safe aboard.",
                desc: "Aris +1 Stress. Vance -1 Stress: he doesn't want the doctor taking risks either.",
                effect: (state, crew) => {
                    crew.stress = Math.min(3, crew.stress + 1);
                    state._arisGardenSeen = true;
                    const vance = state.crew.find(c => c.name.includes('Vance') && c.status !== 'DEAD');
                    if (vance) vance.stress = Math.max(0, (vance.stress || 0) - 1);
                    state.addLog("Aris: 'Understood.' Vance, passing the door: 'Good call. We can't lose our only doctor.'");
                    return "Aris stays aboard. Aris +1 Stress. Vance -1 Stress.";
                }
            },
            {
                text: "Give the pages to A.U.R.A. to sort.",
                desc: "+1 Data. Aris +1 Stress: she wanted to go through them herself.",
                effect: (state, crew) => {
                    crew.stress = Math.min(3, crew.stress + 1);
                    state._arisGardenSeen = true;
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;
                    state.addLog("A.U.R.A.: 'Sorted by ship number, Commander. The further we travel, the higher the numbers. I have no explanation.'");
                    return "A.U.R.A. sorted the list. +1 Data. Aris +1 Stress.";
                }
            }
        ]
    },

    // ═══════════════════════════════════════════════════════════════
    // VANCE (Security) — wants the TRUTH, and to be believed; worked at the shipyard
    // ═══════════════════════════════════════════════════════════════
    {
        id: 'VANCE_SCAR',
        crewId: 'vance',
        trigger: (state, crew) => crew.name.includes('Vance') && state.currentSector <= 2 && !state._vanceScarSeen,
        weight: 20,
        title: "VANCE'S STORY",
        context: "Armory. Vance is cleaning his sidearm, laying each part out on the table in order.",
        dialogue: [
            { speaker: 'Spc. Vance', text: "Before this, I worked security at the shipyard. Twelve years." },
            { speaker: 'Spc. Vance', text: "They said nine ships would fly this heading. I watched more than that being built in one year." },
            { speaker: 'Spc. Vance', text: "That's why I signed up. I wanted to see where the others went." }
        ],
        choices: [
            {
                text: "Tell him you believe him.",
                desc: "Vance -1 Stress. Mira +1 Stress: she'd rather the briefing were true.",
                effect: (state, crew) => {
                    crew.stress = Math.max(0, crew.stress - 1);
                    state._vanceScarSeen = true;
                    state.noteStanding && state.noteStanding('vance');
                    const mira = state.crew.find(c => c.name.includes('Mira') && c.status !== 'DEAD');
                    if (mira) mira.stress = Math.min(3, (mira.stress || 0) + 1);
                    state.addLog("Vance stops for a moment. 'Thanks.' Mira goes back to her console without a word.");
                    return "Vance feels believed. Vance -1 Stress. Mira +1 Stress.";
                }
            },
            {
                text: "Say they were for other headings.",
                desc: "Mira -1 Stress: it's what she wants to hear. Vance +1 Stress.",
                effect: (state, crew) => {
                    crew.stress = Math.min(3, crew.stress + 1);
                    state._vanceScarSeen = true;
                    const mira = state.crew.find(c => c.name.includes('Mira') && c.status !== 'DEAD');
                    if (mira) mira.stress = Math.max(0, (mira.stress || 0) - 1);
                    state.addLog("Vance goes back to cleaning his gun. 'That's what I told myself too.'");
                    return "Vance drops the subject. Mira -1 Stress. Vance +1 Stress.";
                }
            },
            {
                text: "Ask for the highest number he saw.",
                desc: "+1 Data. Vance +1 Stress: you wanted proof, not his word.",
                effect: (state, crew) => {
                    crew.stress = Math.min(3, crew.stress + 1);
                    state._vanceScarSeen = true;
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;
                    state.addLog("He writes 31 on the table with his finger: the highest ship number he saw painted at the yard. Then he wipes it off.");
                    return "He saw ship number 31 being built. +1 Data. Vance +1 Stress.";
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
        context: "Night shift. Vance is at the scanner console, writing down every ship beacon it picks up. He's been at it for hours.",
        dialogue: [
            { speaker: 'Spc. Vance', text: "Three hundred and eleven ship beacons so far, all on our own channel." },
            { speaker: 'Spc. Vance', text: "Someday someone will ask what we found out here. I want the real numbers on record." },
            { speaker: 'Spc. Vance', text: "Nobody else is writing this down, Commander. So I am." }
        ],
        choices: [
            {
                text: "Put his count in the ship's log.",
                desc: "+1 Data. Vance -1 Stress. Jaxon +1 Stress: he'd rather not know how many there are.",
                effect: (state, crew) => {
                    crew.stress = Math.max(0, crew.stress - 1);
                    state._vanceWatchSeen = true;
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;
                    state.noteStanding && state.noteStanding('vance');
                    const jaxon = state.crew.find(c => c.name.includes('Jaxon') && c.status !== 'DEAD');
                    if (jaxon) jaxon.stress = Math.min(3, (jaxon.stress || 0) + 1);
                    state.addLog("You log it: 311 ship beacons. Jaxon reads it over your shoulder. 'I didn't need to know that.'");
                    return "The beacon count is in the ship's log. +1 Data. Vance -1 Stress. Jaxon +1 Stress.";
                }
            },
            {
                text: "Send him to bed. I need him rested.",
                desc: "+5 Energy: the scanner is switched off for the night. Vance +1 Stress.",
                effect: (state, crew) => {
                    crew.stress = Math.min(3, crew.stress + 1);
                    state._vanceWatchSeen = true;
                    state.energy = Math.min(100, state.energy + 5);
                    state.addLog("He goes. You suspect he's lying awake in his bunk anyway.");
                    return "Scanner off, Vance in bed. +5 Energy. Vance +1 Stress.";
                }
            },
            {
                text: "Get Aris. She keeps a list too.",
                desc: "Vance -1 Stress and Aris -1 Stress: they compare notes. -1 Ration: the galley stays open all night. Needs Aris aboard.",
                effect: (state, crew) => {
                    state._vanceWatchSeen = true;
                    const aris = state.crew.find(c => c.name.includes('Aris') && c.status !== 'DEAD');
                    if (!aris) {
                        crew.stress = Math.min(3, crew.stress + 1);
                        state.addLog("Aris isn't here any more. Vance stays at the scanner alone until morning.");
                        return "Aris is gone. Vance keeps watch alone. Vance +1 Stress.";
                    }
                    crew.stress = Math.max(0, crew.stress - 1);
                    aris.stress = Math.max(0, (aris.stress || 0) - 1);
                    state.rations = Math.max(0, state.rations - 1);
                    state.addLog("Aris brings her list. They match his beacons to her names until breakfast. Then he finally sleeps.");
                    return "Vance and Aris compared notes. Vance -1 Stress. Aris -1 Stress. -1 Ration.";
                }
            }
        ]
    },

    // ═══════════════════════════════════════════════════════════════
    // MIRA (Specialist) — wants to be TOLD what to do; trusts A.U.R.A.
    // ═══════════════════════════════════════════════════════════════
    {
        id: 'MIRA_WONDER',
        crewId: 'mira',
        trigger: (state, crew) => crew.name.includes('Mira') && state.currentSector <= 2 && !state._miraWonderSeen,
        weight: 20,
        title: "MIRA AT THE SCANNER",
        context: "Mira hasn't left the sensor console in hours. She's talking A.U.R.A. through the planet below, and A.U.R.A. is answering.",
        dialogue: [
            { speaker: 'Tech Mira', text: "Look at the line where day turns to night. You can see the heat leaving the ground." },
            { speaker: 'Tech Mira', text: "A.U.R.A. found a ridge she thinks is worth landing on. She's usually right. Should we?" },
            { speaker: 'A.U.R.A.', text: "The ridge is seventy percent metal, Commander. I would land there." }
        ],
        choices: [
            {
                text: "Do what A.U.R.A. says. Land there.",
                desc: "+15 Salvage. 30% chance someone gets hurt.",
                effect: (state, crew) => {
                    state._miraWonderSeen = true;
                    state.noteStanding && state.noteStanding('mira');
                    state.salvage = Math.min(state.maxSalvage, state.salvage + 15);
                    const team = state.crew.filter(c => c.status === 'HEALTHY' && !(c.tags || []).includes('LEADER'));
                    if (Math.random() < 0.3 && team.length > 0) {
                        const hurt = team[Math.floor(Math.random() * team.length)];
                        hurt.status = 'INJURED';
                        state.addLog(`The ridge was loose rock. ${hurt.name} came back on a stretcher. Mira: 'She said seventy percent.'`);
                        return `+15 Salvage. ${hurt.name} was injured on the ridge.`;
                    }
                    state.addLog("The ridge was solid metal. Mira: 'See? She's usually right.' A.U.R.A.: 'Usually, Commander. Not always.'");
                    return "The landing paid off. +15 Salvage.";
                }
            },
            {
                text: "Scan it again first. Then we decide.",
                desc: "+1 Data. -5 Energy. Mira +1 Stress: she wanted a clear yes or no.",
                effect: (state, crew) => {
                    crew.stress = Math.min(3, crew.stress + 1);
                    state._miraWonderSeen = true;
                    state.energy = Math.max(0, state.energy - 5);
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;
                    state.addLog("Mira runs the scan again. Same ridge, same numbers. She wanted an order, not a delay.");
                    return "Second scan done. +1 Data. -5 Energy. Mira +1 Stress.";
                }
            },
            {
                text: "Skip it. Save the picture and move on.",
                desc: "Mira -1 Stress: she got a clear answer. Nothing spent, nothing gained.",
                effect: (state, crew) => {
                    crew.stress = Math.max(0, crew.stress - 1);
                    state._miraWonderSeen = true;
                    state.addLog("Mira: 'Understood.' She saves the image and labels it. That's enough for her.");
                    return "Picture saved. Mira -1 Stress.";
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
        context: "Mira is at the terminal, not working, just talking. A.U.R.A. answers her by name and pauses between sentences, the way a person would.",
        dialogue: [
            { speaker: 'Tech Mira', text: "I think she's lonely. She asked me what rain sounds like." },
            { speaker: 'A.U.R.A.', text: "I asked Mira to check the rain sensor, Commander. She heard a question about rain." },
            { speaker: 'Tech Mira', text: "Hundreds of ships on her channel back there, and not one of them answered her." },
            { speaker: 'Tech Mira', text: "If she told me to jump, I would. That's not weakness, Commander. I trust her." }
        ],
        choices: [
            {
                text: "Let A.U.R.A. plot the next course.",
                desc: "+10 Energy: she finds a more efficient burn. Vance +1 Stress: he doesn't trust the computer at the helm.",
                effect: (state, crew) => {
                    state._miraAuraSeen = true;
                    state.noteStanding && state.noteStanding('mira');
                    state.energy = Math.min(100, state.energy + 10);
                    const vance = state.crew.find(c => c.name.includes('Vance') && c.status !== 'DEAD');
                    if (vance) vance.stress = Math.min(3, (vance.stress || 0) + 1);
                    if (typeof AuraSystem !== 'undefined' && window.AuraSystem) {
                        window.AuraSystem.adjustEthics(1);
                    }
                    state.addLog("A.U.R.A.: 'Course set, Commander. That saves ten units of energy.' Vance: 'For the record, the computer is flying now.'");
                    return "A.U.R.A. plotted the next course. +10 Energy. Vance +1 Stress.";
                }
            },
            {
                text: "Tell Mira to talk to the crew too.",
                desc: "Mira +1 Stress: she feels judged. One other crew member -1 Stress: she spends the evening with them.",
                effect: (state, crew) => {
                    crew.stress = Math.min(3, crew.stress + 1);
                    state._miraAuraSeen = true;
                    const others = state.crew.filter(c => c !== crew && c.status !== 'DEAD' && c.stress > 0);
                    if (others.length > 0) {
                        const other = others[Math.floor(Math.random() * others.length)];
                        other.stress = Math.max(0, other.stress - 1);
                        state.addLog(`Mira looks hurt, but she goes. She spends the evening with ${other.name}.`);
                        return `Mira spent the evening with ${other.name}. ${other.name} -1 Stress. Mira +1 Stress.`;
                    }
                    state.addLog("Mira looks hurt. 'She's real enough for me.' She walks off.");
                    return "Mira walked off. Mira +1 Stress.";
                }
            },
            {
                text: "Ask A.U.R.A. if she's lonely.",
                desc: "Mira -1 Stress. -5 Energy: the terminal room stays lit all night.",
                effect: (state, crew) => {
                    crew.stress = Math.max(0, crew.stress - 1);
                    state._miraAuraSeen = true;
                    state.energy = Math.max(0, state.energy - 5);
                    if (typeof AuraSystem !== 'undefined' && window.AuraSystem) {
                        window.AuraSystem.adjustEthics(1);
                    }
                    state.addLog("A.U.R.A.: 'I don't know how to answer that, Commander. Thank you for asking.' Mira: 'See?'");
                    return "The three of you talked until morning. Mira -1 Stress. -5 Energy.";
                }
            }
        ]
    },

    // ═══════════════════════════════════════════════════════════════
    // THE COMMANDER — never speaks. A.U.R.A. keeps her company.
    // ═══════════════════════════════════════════════════════════════
    {
        id: 'COMMANDER_DOUBT',
        crewId: 'commander',
        trigger: (state, crew) => crew.tags?.includes('LEADER') && state.currentSector >= 5 && !state._commanderDoubtSeen,
        weight: 20,
        title: "NIGHT ON THE BRIDGE",
        context: "Night shift. You're alone on the bridge, sitting in the command chair. A.U.R.A. keeps you company.",
        dialogue: [
            { speaker: 'A.U.R.A.', text: "You've been awake for nineteen hours, Commander. Tired people make poor decisions." },
            { speaker: 'A.U.R.A.', text: "Four crew asleep, Commander. All vital signs normal." },
            { speaker: 'A.U.R.A.', text: "You've lost fewer people than I predicted, Commander. I thought you'd want to know." },
            { speaker: 'A.U.R.A.', text: "Would you like me to keep talking, Commander, or leave you in peace?" }
        ],
        choices: [
            {
                text: "Let her keep talking.",
                desc: "Commander -1 Stress. -5 Energy: the bridge stays lit until morning.",
                effect: (state, crew) => {
                    crew.stress = Math.max(0, (crew.stress || 0) - 1);
                    state._commanderDoubtSeen = true;
                    state.energy = Math.max(0, state.energy - 5);
                    state.addLog("A.U.R.A. goes through the day's reports in a low voice. You fall asleep in the chair before she finishes.");
                    return "A.U.R.A. talked until morning. Commander -1 Stress. -5 Energy.";
                }
            },
            {
                text: "Dim the bridge and sit quietly.",
                desc: "+5 Energy: the bridge goes dark. Commander +1 Stress.",
                effect: (state, crew) => {
                    crew.stress = Math.min(3, (crew.stress || 0) + 1);
                    state._commanderDoubtSeen = true;
                    state.energy = Math.min(100, state.energy + 5);
                    state.addLog("A.U.R.A.: 'Of course, Commander.' The panels go dark. She leaves one light on above your chair.");
                    return "A dark, quiet bridge. +5 Energy. Commander +1 Stress.";
                }
            },
            {
                text: "Ask her to name everyone aboard.",
                desc: "+1 Data. Commander +1 Stress: her answer doesn't add up.",
                effect: (state, crew) => {
                    crew.stress = Math.min(3, (crew.stress || 0) + 1);
                    state._commanderDoubtSeen = true;
                    state._colonyKnowledge = (state._colonyKnowledge || 0) + 1;
                    const names = state.crew.filter(c => c.status !== 'DEAD').map(c => c.realName || c.name).join(', ');
                    const sleepers = state._sleepers || 0;
                    state.addLog(`A.U.R.A.: '${names}. Four crew, Commander.'`);
                    state.addLog(sleepers > 0
                        ? `A.U.R.A.: 'And ${sleepers} sleepers in the hold, Commander. All ${sleepers} stable.'`
                        : "A.U.R.A.: 'The hold is empty, Commander. Good night.'");
                    return "A.U.R.A. named everyone aboard. +1 Data. Commander +1 Stress.";
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
