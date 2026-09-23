// BARK SYSTEM: Reactive crew dialogue that makes characters feel alive
// Self-instantiating singleton — fires crew comments into mission log
// Triggers on game events, respects cooldowns, stress-tiered personality lines
//
// Voices (see docs/CANON.md section 8):
//   PESSIMIST = Jaxon (engineer). Names things: the reactor is "the kettle", the lander "the goat".
//   HUMANIST  = Aris (medic). Reads the names of the dead aloud, keeps the list, talks to them.
//   SURVIVOR  = Vance (security). Counts out loud. Worked the launch yard. Counted more than nine.
//   CURIOUS   = Mira (specialist). Narrates scans like a nature film. Talks to A.U.R.A. as a friend.
// Tiers are stress 0-3. A missing tier falls back to the nearest lower one (see tryBark).
// Tier 0 believes the briefing. Tier 3 has seen the hull numbers.

const BARK_DATA = {
    // ═══════════════════════════════════════════════════════════════
    // ENTER_ORBIT — When player warps to a planet
    // ═══════════════════════════════════════════════════════════════
    ENTER_ORBIT: {
        PESSIMIST: {
            0: ["Orbit. Kettle's warm, goat's fuelled. I'm calling this one Marge.", "New rock. Give it a name and it's half a home."],
            3: ["Another rock. I've stopped naming them. That's how tired I am."]
        },
        HUMANIST: {
            0: ["In orbit. Med bay's ready. Let it be somewhere kind.", "Let's look properly before we decide anything about it."],
            3: ["Every world so far had graves on it. I'll bring the list."]
        },
        SURVIVOR: {
            0: ["Orbit. Hull, one. Moons, two. Debris, none. Good. Stays good if we're careful.", "Full sweep before anyone touches the goat. That's the rule."],
            3: ["Third planet, third wreck in orbit. I count hulls now, not planets."]
        },
        CURIOUS: {
            0: ["And here we see a young world, turning slowly, quite unaware of us.", "Aura, pull the orbit up. Let's have a proper look at her."],
            3: ["And here we see... the same planet we saw two sectors ago. It can't be."]
        }
    },

    // ═══════════════════════════════════════════════════════════════
    // AFTER_SCAN — After deep scan completes
    // ═══════════════════════════════════════════════════════════════
    AFTER_SCAN: {
        PESSIMIST: {
            0: ["Scan's in. Rock, ice, more rock. Marge is a plain girl."],
            3: ["Scan's in. No grass. Wake me when there's grass."]
        },
        HUMANIST: {
            0: ["Scan's clean. No graves that I can see. That's a first I'd welcome."],
            3: ["Stones again. Four names on each. I've stopped asking why four."]
        },
        SURVIVOR: {
            0: ["Scan complete. Water, yes. Air, thin. Wrecks in orbit, one. Noted."],
            3: ["Scan says two wrecks on the surface. I count three."]
        },
        CURIOUS: {
            0: ["And here we see the atmosphere in section. Lovely bands. Aura, are you saving these?"],
            3: ["Scan's done. Aura says it's fine. Aura says everything's fine, bless her."]
        }
    },

    // ═══════════════════════════════════════════════════════════════
    // LOW_ENERGY — Energy drops below 25
    // ═══════════════════════════════════════════════════════════════
    LOW_ENERGY: {
        PESSIMIST: {
            0: ["Kettle's running cold. Under twenty-five. Don't ask her for miracles."],
            3: ["Kettle's down to embers. One more long warp and she's a teapot."]
        },
        HUMANIST: {
            0: ["Energy's low. Heat stays on for the crew. Everything else can wait."],
            3: ["The corridors are cold. People sleep in their suits. I'm logging it."]
        },
        SURVIVOR: {
            0: ["Energy twenty-five. A warp costs fourteen. Do the sum before you press anything."],
            3: ["Energy under twenty. Two warps, maybe. I don't round up."]
        },
        CURIOUS: {
            0: ["Aura's dimming the lab for me. It's fine. She keeps the important things lit."],
            3: ["Dark lab. Aura's still awake, though. She always is. She's lonely, you know."]
        }
    },

    // ═══════════════════════════════════════════════════════════════
    // LOW_RATIONS — Rations drop below 5
    // ═══════════════════════════════════════════════════════════════
    LOW_RATIONS: {
        PESSIMIST: {
            0: ["Pantry's thin. Five rations. I'm naming each one. This one's Breakfast."],
            2: ["Five meals left. Marge down there had no grass. None of them have grass."],
            3: ["Skip mine. Wake me when there's food. Or grass. Either."]
        },
        HUMANIST: {
            0: ["Rations low. I'm halving portions. Nobody argue with me."],
            2: ["Hungry crew. I keep a list of who ate last. I don't want another list."],
            3: ["Nobody's eaten today. I've written the date. I write dates for a living now."]
        },
        SURVIVOR: {
            0: ["Five rations. Five people. Not four. Five. Do the sum."],
            2: ["Three rations. Five mouths. She still says four. The sum fails either way."],
            3: ["One ration. I counted it twice. It's still one."]
        },
        CURIOUS: {
            0: ["Food's low. Aura's reworking the menu. She's very good at menus."],
            2: ["Aura lays out four trays. I set the fifth. She thanks me every time."],
            3: ["And here we see the crew, foraging the galley. Nothing. Aura, any ideas? ...No."]
        }
    },

    // ═══════════════════════════════════════════════════════════════
    // BEFORE_EVA — Before EVA mission begins
    // ═══════════════════════════════════════════════════════════════
    BEFORE_EVA: {
        PESSIMIST: {
            0: ["Goat's fuelled and warm. Bring her back with the paint on."],
            3: ["Goat's on her third set of legs. Land soft. Land flat."]
        },
        HUMANIST: {
            0: ["Team's briefed. Kits packed. Come back with everyone's names still on the roster."],
            3: ["If you find stones down there, read me the names on the comm. I'll write them."]
        },
        SURVIVOR: {
            0: ["Three going down. Three coming back. I'll count you at the airlock."],
            3: ["Four steps from the goat to cover. I paced it on the scan. Don't take five."]
        },
        CURIOUS: {
            0: ["And here we see the team, leaving the nest. Aura, keep the channel open for me."],
            3: ["Aura says the surface is safe, Commander. Go on. She hasn't been wrong about a surface yet."]
        }
    },

    // ═══════════════════════════════════════════════════════════════
    // CREW_INJURY — Someone gets hurt
    // ═══════════════════════════════════════════════════════════════
    CREW_INJURY: {
        PESSIMIST: {
            0: ["Get them to Aris. I'll keep the kettle on."],
            3: ["Hurt again. I want to stop. Anywhere with a floor."]
        },
        HUMANIST: {
            0: ["On it. Vitals are steady. Their name stays on my good list."],
            3: ["Patched. I'm reusing gauze now. Don't tell them."]
        },
        SURVIVOR: {
            0: ["One down, walking. Four on duty. Five aboard. Noted."],
            3: ["One hurt. That's twenty percent of the crew. Twenty-five, if you ask her."]
        },
        CURIOUS: {
            0: ["Oh no. Aura, flag their suit. I'll pull the readings for Aris."],
            3: ["The scan should have shown that. And here we see... the specialist, missing it."]
        }
    },

    // ═══════════════════════════════════════════════════════════════
    // CREW_DEATH — Someone dies (bypasses cooldown)
    // ═══════════════════════════════════════════════════════════════
    CREW_DEATH: {
        PESSIMIST: {
            0: ["...Kettle's still on. I don't know why I said that."],
            2: ["Name a rock after them. It's what I've got."],
            3: ["I'll name the next world after them. I'd rather have named a garden."]
        },
        HUMANIST: {
            0: ["Time of death logged. I'm saying your name out loud. Somebody should."],
            2: ["You're on the list now. I read it every night. I'll read yours first."],
            3: ["I'm sorry. I'm talking to you, not them. I'm sorry."]
        },
        SURVIVOR: {
            0: ["Ask her the crew count now. Then tell me I miscounted."],
            2: ["Deaths, one more. I keep the column. Nobody else does."],
            3: ["I counted keels at the yard. More than nine. I never counted this."]
        },
        CURIOUS: {
            0: ["Aura's gone quiet. She logged it before I did. She always does."],
            2: ["And here we... no. Not for this. Aura, close the channel."],
            3: ["Aura still lists them on the roster. I asked her to. I'm not ready."]
        }
    },

    // ═══════════════════════════════════════════════════════════════
    // SECTOR_JUMP — Transitioning to new sector
    // ═══════════════════════════════════════════════════════════════
    SECTOR_JUMP: {
        PESSIMIST: {
            0: ["Jump done. Kettle held. Next sector — I'll name it when I see it."],
            2: ["Kettle groaned on that one. Deeper again. Further from grass, not nearer."],
            3: ["Another jump. The goat, the kettle and me. All three ready to stop."]
        },
        HUMANIST: {
            0: ["Jump's over. Everyone's breathing. I checked twice."],
            2: ["New sector. I've brought the list. It gets longer every one."],
            3: ["Deeper. More stones ahead. I'll read them. I'm the only one who does."]
        },
        SURVIVOR: {
            0: ["Jump complete. Sector count, one up. Crew, five. Wrecks — I'll say when we're done."],
            2: ["Every sector: more hulls, higher numbers. Numbers don't go up by accident."],
            3: ["Nothing has ever jumped the other way. I've counted. Zero."]
        },
        CURIOUS: {
            0: ["And here we see the drive settling, like a bird folding its wings. Aura, all well?"],
            2: ["New sector. Aura's already mapping it. She's quicker every time. Or I'm slower."],
            3: ["Aura says the heading's correct, Commander. Same as every ship. That's the point, isn't it."]
        }
    },

    // ═══════════════════════════════════════════════════════════════
    // EXODUS_FOUND — Finding an Exodus wreck / flight recorder
    // ═══════════════════════════════════════════════════════════════
    EXODUS_FOUND: {
        PESSIMIST: {
            0: ["Wreck. One of ours. Older than I'd like. I'm calling her Aunt Ruth.", "Exodus hull. Same class as us. Let's see what's left in her kettle."],
            2: ["Another Exodus. The number on her side is bigger than ours. Again."],
            3: ["Don't read me the hull number. I know it's bigger. They all are."]
        },
        HUMANIST: {
            0: ["One of the eight. Manifest first. I read the names before we take anything.", "Their manifest's readable. I'm reading the names. Then we work."],
            2: ["Dead a century, and the names are still on the hatch. Wait. I'm reading."],
            3: ["I'm talking to them, not you. Give me a minute. They've had longer."]
        },
        SURVIVOR: {
            0: ["Hull number. Read it to me. Then read it again, slower.", "Exodus wreck. Eight went before us. That's one. I'm keeping the tally."],
            2: ["Hull two thousand and something. Eight went before us. Somebody counted wrong. Not me."],
            3: ["I counted keels at the yard. More than nine. Nobody believed me. Read the number."]
        },
        CURIOUS: {
            0: ["And here we see an Exodus hull, at rest. Aura, can you raise her transponder?", "Transponder's answering. Aura's matching the hull number. She's very thorough about hulls."],
            2: ["Transponder says the hull number's higher than ours. Aura, check that for me. Please."],
            3: ["Aura read the number out like a weather report. She's not surprised. Neither am I, now."]
        }
    },

    // ═══════════════════════════════════════════════════════════════
    // COLONY_SITE_FOUND — Finding a failed colony
    // ═══════════════════════════════════════════════════════════════
    COLONY_SITE_FOUND: {
        PESSIMIST: {
            0: ["Somebody built here. Roofs, a well, a fence. They wanted to stop. I get it."],
            2: ["Houses. Nobody home for a hundred years. I'd still take one."],
            3: ["Look, a porch. Wake me when there's grass in front of it."]
        },
        HUMANIST: {
            0: ["Settlement. There'll be graves. I go to the graves first."],
            2: ["Stones in rows. I'm reading every name. Don't rush me."],
            3: ["Four names on every stone. Every single one. I'm still reading them."]
        },
        SURVIVOR: {
            0: ["Buildings, six. Graves — I'll count them myself. Nobody rounds down on graves."],
            2: ["Graves outnumber houses three to one. They stopped, and then they stopped."],
            3: ["Counted the graves. Counted the beds. Numbers don't match. They never match down here."]
        },
        CURIOUS: {
            0: ["And here we see a colony, gone quiet. Aura, date the buildings for me."],
            2: ["Aura dates the walls to before we launched. Long before. She's certain. I believe her."],
            3: ["And here we see... the same town. Same well. Third time. Aura, tell me it isn't."]
        }
    },

    // ═══════════════════════════════════════════════════════════════
    // SECTOR_3_ENTRY — Entering Sector 3, straight out of the stalled throw.
    // Mira has the transponders: there are more than eight.
    // ═══════════════════════════════════════════════════════════════
    SECTOR_3_ENTRY: {
        PESSIMIST: {
            0: ["Sector three. Kettle stalled in the throw. She's back. I'm naming this sector Never Again."],
            2: ["That wasn't a jump. That was a fall. Kettle's fine. I'm not."],
            3: ["The throw stalled and I dreamed of grass. Then I woke up here. Figures."]
        },
        HUMANIST: {
            0: ["We all stopped for a moment in there. Everyone's breathing now. I listened to each of you."],
            2: ["In the dark I heard names. I'm writing down the ones I remember."],
            3: ["Everyone's awake. Nobody's talking. I'll do rites for the ones we saw. Whoever they were."]
        },
        SURVIVOR: {
            0: ["Transponders on the board. More than eight. I said more than nine keels. Count them."],
            2: ["Eight went before us. I've got twelve transponders on one screen. Twelve."],
            3: ["Four. She said four. Eight. She said eight. Same mistake, twice."]
        },
        CURIOUS: {
            0: ["Commander. There are more than eight.", "Aura counted the transponders for me. More than eight. Her voice didn't change."],
            2: ["And here we see... hull two-one-two. Two hundred and twelve. Aura, that's not a typo."],
            3: ["Aura read them out, one by one. Big numbers. Warm voice. I held her hand. Figuratively."]
        }
    },

    // ═══════════════════════════════════════════════════════════════
    // ANOMALY_FOUND — First anomaly: a wrong place, something the light made
    // ═══════════════════════════════════════════════════════════════
    ANOMALY_FOUND: {
        PESSIMIST: {
            0: ["That's not a planet. Well, it is. It's just... wrong. I'm not naming it."],
            2: ["Wrong place. Looks like Marge, three sectors back. Marge didn't have two moons."],
            3: ["It's a copy. Bad copy. No roots on anything. I want to go."]
        },
        HUMANIST: {
            0: ["Careful. Something here was made, not grown. I don't know how I know."],
            2: ["There are stones down there. Four names on every stone. Every single stone."],
            3: ["Whatever made this place got the names right. Just not the number."]
        },
        SURVIVOR: {
            0: ["Count the moons. Now count again. They moved. I don't guess. They moved."],
            2: ["Four figures walking on the scan. Four. Every scan. I see the pattern."],
            3: ["Copy of a world. Count is wrong. Count is always wrong out here. Four."]
        },
        CURIOUS: {
            0: ["And here we see... I don't know what we see. Aura's thinking. That's new."],
            2: ["Aura says the readings match a catalogued world, Commander. A world three sectors behind us."],
            3: ["Aura's not troubled. It's a duplicate, she says. Made. Her word. I trust her word."]
        }
    },

    // ═══════════════════════════════════════════════════════════════
    // SECTOR_5_ENTRY — Entering the LAST sector (key kept for saves).
    // Hulls past thirty thousand, four centuries dead, and the light in sight.
    // ═══════════════════════════════════════════════════════════════
    SECTOR_5_ENTRY: {
        PESSIMIST: {
            0: ["Last sector. There's a light out there like a sun. I'm not naming it. Not yet."],
            2: ["That's a sun. Or looks like one. Kettle can reach it. Then we stop. Please."],
            3: ["Forty thousand hulls, and a light. I'll call it the Porch. Wake me there."]
        },
        HUMANIST: {
            0: ["Last sector. The list is long. I'll read all of it before we reach the light."],
            2: ["Four centuries of dead ahead. I'll read every name I can. I'll be slow."],
            3: ["If it reads what reaches it, let it read the list. All of them. Every name."]
        },
        SURVIVOR: {
            0: ["Final sector. Hull numbers past thirty thousand. I'll believe them. I believed nine."],
            2: ["Forty-one thousand keels. Nobody counted wrong. They counted, and sent them anyway."],
            3: ["Last sector. Crew, five. She'll say four. One of us was never written down."]
        },
        CURIOUS: {
            0: ["And here we see the end of the corridor. A light. Aura's quiet. She's looking too."],
            2: ["Aura says it's not a star, Commander. Says it kindly. She says everything kindly."],
            3: ["Aura's happy, Commander. Says the heading's complete. I'll trust her. Tell me what to do."]
        }
    },

    // ═══════════════════════════════════════════════════════════════
    // FIRST_VITAL — First time finding a VITAL-type planet (one-time)
    // ═══════════════════════════════════════════════════════════════
    FIRST_VITAL: {
        PESSIMIST: {
            0: ["Green. Actual green. I'm naming it Home. Say no if you have to.", "Grass. I asked for grass. Tell me the scan's real."],
            2: ["Green. I'll believe it when I've pulled a handful up and seen roots."],
            3: ["Green world. There's always something. Let me hope for a minute first."]
        },
        HUMANIST: {
            0: ["Living world. No graves that I can see. Let me say that again. No graves."],
            2: ["It's alive down there. Let it stay that way. We've buried enough."],
            3: ["Green world. I'll check for stones first. Then I'll hope."]
        },
        SURVIVOR: {
            0: ["Habitable. Wrecks in orbit, zero. Zero. First time I've written that."],
            2: ["Green planet, and the ones before us flew past it. Ask why before you land."],
            3: ["Living world, and every hull ahead of us kept flying. I count that as a warning."]
        },
        CURIOUS: {
            0: ["And here we see it. Chlorophyll. Water. Weather. Aura, are you seeing this? Aura?"],
            2: ["A living world. Aura's run the scan three times for me. It holds. It holds."],
            3: ["Aura says it's real, Commander. I want it to be. Tell me to believe her."]
        }
    },

    // ═══════════════════════════════════════════════════════════════
    // SINGING_PLANET — A world broadcasting a tone on a dead channel (one-time)
    // ═══════════════════════════════════════════════════════════════
    SINGING_PLANET: {
        PESSIMIST: {
            0: ["Planet's humming through the hull. Kettle's singing back. I'm calling it the Choir."],
            2: ["That tone's in the plating now. Goat hums it too. Can't switch a rock off."],
            3: ["Let it sing. Sounds like a kettle nearly boiling. Never boils."]
        },
        HUMANIST: {
            0: ["There's a voice in it. Under the tone. I think it's saying a name."],
            2: ["It's a name. Over and over. I've written it down. I'm answering it."],
            3: ["Somebody down there is being said, again and again. I'm saying them back."]
        },
        SURVIVOR: {
            0: ["Tone repeats every eleven seconds. I timed it. Twelve times. Eleven seconds."],
            2: ["The pattern's a count. Something down there is counting. Higher than me."],
            3: ["It counts. So do I. Mine stops at five. Its doesn't stop."]
        },
        CURIOUS: {
            0: ["And here we see a world that sings. Aura, are you recording? She says yes, Commander."],
            2: ["Aura says it's a broadcast on a dead channel, Commander. Old. She's matching it."],
            3: ["Aura found the channel it's on. A ship's channel. Long dead. She said so gently."]
        }
    },

    // ═══════════════════════════════════════════════════════════════
    // PROBE_DEPLOY — When launching a probe
    // ═══════════════════════════════════════════════════════════════
    PROBE_DEPLOY: {
        PESSIMIST: {
            0: ["Probe's away. Called it Sparrow. Come back, Sparrow."],
            3: ["Send the little bird. Least she gets to leave."]
        },
        HUMANIST: {
            0: ["Probe out. Good. Nobody bleeds for a readout."],
            3: ["Let the machine look first. I've got enough names."]
        },
        SURVIVOR: {
            0: ["Probe launched. Ninety seconds to surface. I'll count them."],
            3: ["Probe away. One less thing to count on the shelf."]
        },
        CURIOUS: {
            0: ["And here we see the probe, leaving the nest. Aura's got her on the line."],
            3: ["Probe's out. Aura's talking to it. She likes the probes. They answer her."]
        }
    }
};

// ═══════════════════════════════════════════════════════════════
// ONE-TIME SPECIAL BARKS (tracked, never repeat)
// ═══════════════════════════════════════════════════════════════
const SPECIAL_BARKS = {
    FIRST_VITAL: true,      // First VITAL planet discovered
    SINGING_PLANET: true,    // First SINGING planet encountered
    SECTOR_3_ENTRY: true,    // Entering Sector 3 (anomaly hints)
    SECTOR_5_ENTRY: true,    // Entering Sector 5
    FIRST_CREW_DEATH: true,  // First crew member death
    ANOMALY_FOUND: true      // First anomaly encountered
};

class BarkSystem {
    constructor() {
        this.lastBarkAction = -2; // actions since last bark (start ready)
        this.cooldownActions = 1;  // minimum actions between barks
        this.firedSpecials = {};   // track one-time barks
        this.lastSpeaker = null;   // avoid same speaker twice in a row

        // Register event listeners
        this._bindEvents();
    }

    _bindEvents() {
        // We'll hook into existing events and state changes
        // Most triggers are called directly from bundle.js handlers
        // This ensures barks fire AFTER the action log entry

        window.addEventListener('bark-trigger', (e) => {
            this.tryBark(e.detail.trigger, e.detail.state, e.detail.context);
        });
    }

    /**
     * Main entry point — called from bundle.js handlers
     * @param {string} trigger - One of the BARK_DATA keys
     * @param {object} state - GameState reference
     * @param {object} context - Optional extra data (planet, crew member, etc.)
     */
    tryBark(trigger, state, context = {}) {
        if (!state || !state.crew) return;

        // Check cooldown (CREW_DEATH bypasses)
        if (trigger !== 'CREW_DEATH') {
            const actionsSinceLast = (state.actionsTaken || 0) - this.lastBarkAction;
            if (actionsSinceLast < this.cooldownActions) return;
        }

        // Check one-time triggers
        if (SPECIAL_BARKS[trigger]) {
            if (this.firedSpecials[trigger]) return;
            this.firedSpecials[trigger] = true;
        }

        // Get living non-LEADER crew
        const eligible = state.crew.filter(c =>
            c.status !== 'DEAD' &&
            !c.tags.includes('LEADER')
        );

        if (eligible.length === 0) return;

        // Get bark data for this trigger
        const triggerData = BARK_DATA[trigger];
        if (!triggerData) return;

        // Pick a speaker — avoid repeating last speaker if possible
        let speaker = null;
        const shuffled = this._shuffle([...eligible]);

        for (const candidate of shuffled) {
            const personality = candidate.personality;
            if (triggerData[personality]) {
                // Prefer someone other than last speaker
                if (candidate.name !== this.lastSpeaker || shuffled.length === 1) {
                    speaker = candidate;
                    break;
                }
            }
        }

        // Fallback: just pick first eligible with valid data
        if (!speaker) {
            speaker = shuffled.find(c => triggerData[c.personality]);
        }

        if (!speaker) return;

        // Get stress tier (clamped to available tiers)
        const stress = Math.min(speaker.stress || 0, 3);
        const personalityBarks = triggerData[speaker.personality];
        if (!personalityBarks) return;

        // Find the closest available stress tier (fall back to lower)
        let barks = personalityBarks[stress];
        if (!barks) {
            for (let s = stress - 1; s >= 0; s--) {
                if (personalityBarks[s]) {
                    barks = personalityBarks[s];
                    break;
                }
            }
        }
        if (!barks || barks.length === 0) return;

        // Pick a random bark line
        const line = barks[Math.floor(Math.random() * barks.length)];

        // Log it with speaker name (matches existing dialogue format)
        this.lastSpeaker = speaker.name;
        this.lastBarkAction = state.actionsTaken || 0;

        // Fire after a short delay so it appears after the action log
        setTimeout(() => {
            if (state.addLog) {
                state.addLog(`${speaker.name}: "${line}"`);
            }
        }, 150);
    }

    /**
     * Convenience: fire bark for resource threshold checks
     * Call this after resource changes
     */
    checkResourceBarks(state) {
        if (!state) return;
        if ((state.energy || 0) <= 25 && (state.energy || 0) > 0) {
            this.tryBark('LOW_ENERGY', state);
        }
        if ((state.rations || 0) <= 5 && (state.rations || 0) > 0) {
            this.tryBark('LOW_RATIONS', state);
        }
    }

    /**
     * Check if a planet type triggers a special bark
     */
    checkPlanetBarks(state, planet) {
        if (!planet) return;

        // First VITAL planet
        if (planet.type === 'VITAL' && !this.firedSpecials['FIRST_VITAL']) {
            this.tryBark('FIRST_VITAL', state, { planet });
            return; // Don't stack with ENTER_ORBIT
        }

        // SINGING planet
        if (planet.type === 'SINGING' && !this.firedSpecials['SINGING_PLANET']) {
            this.tryBark('SINGING_PLANET', state, { planet });
            return;
        }
    }

    _shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    /**
     * Reset state (for new game)
     */
    reset() {
        this.lastBarkAction = -2;
        this.firedSpecials = {};
        this.lastSpeaker = null;
    }
}

// Self-instantiate singleton
window.BarkSystem = new BarkSystem();
