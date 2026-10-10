/* Silent Exodus · sector 1 slice · the words and the places of sector 1 (docs/SLICE_SPEC.md §3.2, §11; docs/STYLE.md).
   OWNER: the state-and-script builder. Pure data, read by script.js (and by world.js / stop.js / ship.js through
   Slice.mods.script.LINES and .PLACES). Load after state.js and V3Data, before script.js.
     window.Slice.ScriptText = { LINES, REMARKS, PLACES, NAMED }
   Reused as written: V3Data sector 1 (arrive, react, orbit lines, names, tags, doneTag), SCENE_STOCKPILE, PAGE_DISC,
   PAGE_PLATE, ShipSimA's routine lines (REMARKS names their keys). New lines follow STYLE.md: plain, one idea, 20 words
   at most, first names, Cora never speaks, A.U.R.A. says "four crew". */
(function () {
    'use strict';
    const Slice = window.Slice, DATA = window.V3Data, E = Slice.ECON;
    const SEC1 = DATA.SECTORS[1], SEC2 = DATA.SECTORS[2], AURA = 'A.U.R.A.';
    const v1 = id => SEC1.places.find(p => p.id === id) || {};

    const LINES = {
        arrive: [SEC1.arrive[0], SEC1.arrive[1], [AURA, 'Worlds all around the giant, Commander. One of them has an old ship beacon.']],
        hint: 'Click a world to go there. The ones we leave behind are gone.',
        react: {
            zeta: v1('zeta').react, titan: v1('titan').react, kryos: ['Jaxon', 'We can skim fuel from those clouds. It pays for the trip.'],
            erebus: ['Aris', "Someone's been calling for help out there. Let's answer them."], rhea: ['Aris', "Their last course. Let's see where they were going."],
            contact: ['Vance', "We don't even know what that is. I don't like it."],
        },
        price: {   // A.U.R.A., once per world, only when the price matters (SPEC §8.1)
            kryos: [AURA, "We've used some fuel, Commander. Kryos can fill the tanks again."], contact: [AURA, "A contact with no fix, Commander. I can't tell what it is."],
            onlyJump: [AURA, 'After this we can only jump, Commander.'], fixLate: [AURA, "The fix isn't in yet, Commander."],
            kryosMetal: ['Jaxon', "There's old wreck metal down in Kryos's low bands. We could haul some up."],   // a full ship's reason (fun playtest)
        },
        passed: [AURA, "We passed it, Commander. We can't turn back."],
        lightEarly: [AURA, "Not yet, Commander. There's still the contact ahead."], lightEarlyNamed: [AURA, 'Not yet, Commander. Rhea-4 Minor is still ahead.'],
        jumpReady: [AURA, "That's the last world on this heading, Commander. The jump is ready."], jumpNudge: [AURA, 'The jump is ready when you are, Commander.'],
        pickTwo: [AURA, 'Choose two to go, Commander.'], stillDown: [AURA, 'The team is still down there, Commander.'],
        arriveAt: {
            zeta: v1('zeta').orbit.arrive, titan: v1('titan').orbit.arrive, kryos: v1('kryos').orbit.arrive,
            erebus: [AURA, "Orbit, Commander. It's one of our ships. It's dark, and still calling for help."], rhea: v1('rhea').orbit.arrive,
        },
        // a sign is a risk, not a promise (playtest 2): the surge comes about half the time; the breach comes on the second pull-in
        sign: { surge: [AURA, 'Engineering has been surging since we woke, Commander.'], hull: [AURA, 'The hull has been groaning since the rings, Commander.'],
            surgeAgain: [AURA, 'Engineering is still surging, Commander.'],
            // Rhea with nothing due aboard: the risk is down there (fun playtest: the pick did nothing). The hazard comes half the time
            slope: [AURA, "Their ship is lying on a slope, Commander. It could shift."] },
        goodFor: {   // the pick: hover a person (about 12 words: down there, and aboard). Vague aboard, so the pick is a gamble, not a lookup
            jaxon: ['Jaxon', 'Down there I cut faster and strip more. Up here, the drive is mine.'],
            aris: ['Aris', 'Down there I bring the hurt back walking. Up here, the med bay.'],
            vance: ['Vance', 'Down there I take the hit for the other one. Up here, I keep people safe.'],
            mira: ['Mira', 'Down there I bring their star fix back. Up here I scan the site.'],
        },
        surge: {
            announce: [AURA, 'Power surge in engineering, Commander.'], jaxon: ['Jaxon', "I've got it. Nothing lost."],
            nobody: [AURA, 'Nobody was free to stop it, Commander. Engineering is down.'], noJaxon: "Jaxon's not here. I don't know this drive.",
            ask: 'Shut the drive down, or let it run?', shut: [AURA, 'Engineering is shut down, Commander.'], run: [AURA, 'The surge burned some of our energy, Commander.'],
        },
        breach: { announce: [AURA, 'Hull breach, Commander. We are losing air.'], sealed: [AURA, 'The hole is sealed, Commander.'] },
        stockpile: { jaxon: ['Jaxon', "Good steel in these frames. Nobody's touched it in twenty years."], mira: ['Mira', 'Everything is still here. Nobody ever came back for it.'] },
        radio: {     // strip or marker, in the voice of whoever is down there (SHIP_GAMEPLAY §8)
            jaxon: 'Their hull is good metal, Commander. Strip it, or leave them a marker?', aris: 'I have their names, Commander. Can we leave them a marker?',
            vance: 'Your call, Commander. Strip the ship, or leave a marker?', mira: 'Do we strip it for parts, Commander, or leave a marker?',
            strip: "Stripping it now. We'll bring the metal up.", marker: "We'll cut a plate for them before we go.",
        },
        back: {
            titanFix: "We're back. Nobody alive down there. We brought their last star reading.", titan: "We're back. Nobody alive down there.",
            zeta: "We're back. There was nothing else aboard.", erebus: "We're back. Their beacon is quiet now.", rhea: "We're back. We brought their crew plate up with us.",
        },
        zeta: { lights: v1('zeta').orbit.steps[0].then[1], cell: 'Their power cell still works, Commander. Do we carry it back?' },
        call: {      // the distress beacon of pools.md, made sector 1: twenty years, not 120
            aura: [AURA, 'Its beacon has run on backup power for twenty years. Nobody ever answered.'],
            aris: ['Aris', "Then we'll be the ones who answer. I want their names."], jaxon: ['Jaxon', 'Those backup cells are still charged. We could use them.'],
            ask: 'Do we answer it, Commander, or take their power cells?',
            answered: [[AURA, 'Reply sent, Commander. I read their crew names over the channel.'], ['Aris', 'We heard you. You can rest now.']],
            cells: 'Cells are out. The beacon cut off in the middle of a call.',
        },
        vance: {     // VANCE'S STORY (script/sector-1.md), at the galley porthole
            seen: ['Mira', 'Has anyone seen Vance?'],
            talk: ['Before this, I worked security at the shipyard. Twelve years.', 'They said nine ships would fly this heading. I watched more than that being built in one year.'],
            ask: "That's why I signed up. I wanted to see where the others went.", believed: 'Thanks.', other: "That's what I told myself too.",
        },
        jaxon: { ask: 'Leave me off the next team. I want a day on the drive.', yes: "Thanks. She'll run better for it.", no: "Fine. I'll go if you pick me.", tools: ['Aris', "Jaxon wants a word, Commander. He didn't eat."],
            inDrive: "I was inside the drive. I couldn't get out in time." },
        // Kryos: one choice of its own after the skim (fun playtest: fork 2 was a free top-up)
        kryos: { ask: 'The low bands are full of old wreck metal. Take her down?', clean: "We're out. The hold's full of good metal.", scrape: 'A ring stone hit us down there, Commander. {deck} is sealed off.' },
        bench: {
            none: 'Nothing on the bench yet.', late: "Their star fix isn't in yet. A.U.R.A. is still reading it.", lab: "The lab has no air. I can't work in there.",
            waiting: "Their star fix is on my bench. It won't take long to date.", done: 'The drawing is up. I keep looking at it.', hurt: [AURA, 'Mira is in the med bay, Commander.'],
            // the disc page's two after-lines, moved off the page to the bench (playtest 1: Titan read back to back for 75 s)
            disc: DATA.PAGE_DISC.after[1][1], curiosity: [DATA.PAGE_DISC.after[0][0], DATA.PAGE_DISC.after[0][1]],
            dated: [AURA, 'We have their last course, Commander. Flying it costs no energy.'],
        },
        reactor: { high: ["She's running smooth. Plenty left in her.", 'Steady as she goes.'], mid: ["She's fine, but we've used a fair bit.", "She'll get us there. Don't waste any."],
            low: ["She's getting low. We should skim somewhere.", 'Every pull-in hurts now.'] },
        deck: {
            fixJaxon: ['Jaxon', "I'll fix it on the next trip."], fixBoth: [AURA, 'The two aboard will fix it on the next trip, Commander.'],
            noSalvage: [AURA, "We don't have the salvage for that, Commander."], patched: "Patched. It won't hold forever.", worse: [AURA, 'A patch will not hold it now, Commander. It needs a fix.'],
            fixing: "I'm on it. It'll be done on the next trip.", isPatched: "It's patched. It won't hold forever.", nag: '{Deck} is still broken, Commander. Your call.',
            fix: 'Fix it', patch: 'Patch it', live: 'Live with it', patchFelt: 'a little salvage, holds till the jump', patchNum: '−5 salvage · holds till the jump',
            liveFelt: { bridge: 'pull-ins cost more', lab: 'no dating', quarters: 'no rest at the jump', medbay: "the hurt don't heal", hold: 'loses food at the jump', engineering: 'the jump costs double' },
            liveNum: { bridge: 'pull-ins cost 7', lab: 'no dating', quarters: 'no rest at the jump', medbay: "the hurt don't heal", hold: '−2 rations at the jump', engineering: 'the jump costs 16' },
        },
        meal: ['Aris', 'Sit down, all of you. Our first real meal since we woke.'],
        // the next step, when the player has sat in travel with nothing to do (playtest 1: a stall of 4 minutes); under 15 words
        next: {
            fork1: ['Vance', "We can't drift here all day, Commander. Pick a world."],
            fork2: ['Aris', "That distress call is still going, Commander. Someone should answer it."],
            rheaFree: [AURA, 'Their last course is still open, Commander. It costs nothing.'],
            contact: ['Mira', "That contact above the giant hasn't moved. I'd like a look."],
            contactAura: [AURA, "There's still a contact ahead, Commander. Nobody has looked at it."],
            again: '{Place} is still ahead, Commander.',
        },
        // a hazard at the site (playtest 2: nothing could hurt the team, so Vance and Aris down there were dead text).
        // Mira aboard scans the site and names it first; Vance takes the hit for the other; Aris walks the hurt back up.
        hazard: {
            erebus: { scan: "Their deck plates are rotten by the hatch. Go round by the wall.", fire: 'A deck plate gave way under us in there.' },
            rhea: { scan: "That hull is sliding in the dust. Stay out of the low end.", fire: 'The hull shifted while we were inside.' },
            vance: "I went through, not them. My leg's bad.", aris: "I've strapped it. We walk back up.", hurt: "{Name} is hurt. We're bringing {her} up.",
        },
        arriveS2: SEC2.arrive,
    };
    // lines a person may say in passing, each once (ShipSimA's routine lines); the place reactions are left to the places
    const REMARKS = { jaxon: ['work', 'meal', 'move'], aris: ['work', 'meal', 'clean', 'any'], mira: ['work', 'meal', 'any'], vance: ['nav', 'meal', 'any'] };


    // ═══ 2. THE PLACES (SPEC §3.2). world.js owns where they are; this owns what they are called and what they cost ═══
    const PLACES = {
        zeta: { id: 'zeta', fork: 1, pair: 'titan', act: 'dock', verb: 'Dock', team: true, sign: 'spark', crisis: null },
        titan: { id: 'titan', fork: 1, pair: 'zeta', act: 'send', verb: 'Send the team', team: true, sign: 'surge', crisis: 'surge', wreck: 'EXODUS-4' },
        kryos: { id: 'kryos', fork: 2, pair: 'erebus', act: 'skim', verb: 'Skim fuel', team: false, sign: null, crisis: 'breach' },
        erebus: { id: 'erebus', fork: 2, pair: 'kryos', act: 'answer', verb: 'Answer the call', team: true, sign: 'hull', crisis: 'breach', wreck: 'EXODUS-7' },
        rhea: { id: 'rhea', story: true, act: 'send', verb: 'Send the team', team: true, sign: 'slope', crisis: null, wreck: 'EXODUS-6' },
        light: { id: 'light', jump: true },
    };
    const NAMED = {
        zeta: [v1('zeta').name, v1('zeta').tag, v1('zeta').doneTag], titan: [v1('titan').name, v1('titan').tag, v1('titan').doneTag],
        kryos: [v1('kryos').name, v1('kryos').tag, v1('kryos').doneTag], erebus: ['Erebus-40 Minor', 'Distress call', 'We answered it'],
        rhea: [v1('rhea').name, v1('rhea').tag, v1('rhea').doneTag], contact: [v1('rhea').contact.name, v1('rhea').contact.tag, ''],
        light: ['The light', 'The jump', ''],
    };
    Object.keys(PLACES).forEach(id => { const n = NAMED[id]; Object.assign(PLACES[id], { name: n[0], tag: n[1], doneTag: n[2] }); });

    Slice.ScriptText = { LINES, REMARKS, PLACES, NAMED };
})();
