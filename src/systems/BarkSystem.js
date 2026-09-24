// BARK SYSTEM: Reactive crew dialogue that makes characters feel alive
// Self-instantiating singleton — fires crew comments into mission log
// Triggers on game events, respects cooldowns, stress-tiered personality lines
//
// Voices (see docs/CANON.md section 8 and docs/STYLE.md; plain speech, no nicknames or verbal habits):
//   PESSIMIST = Jaxon (engineer). Tired, warm, practical. Wants to stop somewhere good and live.
//   HUMANIST  = Aris (medic). Kind, serious. Keeps a list of the dead; wants to understand what happened to them.
//   SURVIVOR  = Vance (security). Blunt, suspicious of A.U.R.A. Worked at the shipyard. Wants the truth.
//   CURIOUS   = Mira (specialist). Young, curious, trusts A.U.R.A. and wants to be told what to do.
// Tiers are stress 0-3. A missing tier falls back to the nearest lower one (see tryBark).
// Tier 0 believes the briefing. Tiers 2-3 have noticed the hull numbers and the ages of the wrecks.

const BARK_DATA = {
    // ═══════════════════════════════════════════════════════════════
    // ENTER_ORBIT — When player warps to a planet
    // ═══════════════════════════════════════════════════════════════
    ENTER_ORBIT: {
        PESSIMIST: {
            0: ["We're in orbit. Reactor's steady and the lander's fuelled.", "New planet. Let's hope this one's worth landing on."],
            3: ["Another planet. I've stopped getting my hopes up."]
        },
        HUMANIST: {
            0: ["In orbit. The med bay's ready if anyone needs it.", "Let's take a good look before we decide anything."],
            3: ["Every planet so far has had graves on it. I'll bring my list."]
        },
        SURVIVOR: {
            0: ["Orbit's stable. No debris, no wrecks nearby. Let's keep it that way.", "Nobody takes the lander down until we've done a full sweep."],
            3: ["Another wreck in orbit. There are always more than there should be."]
        },
        CURIOUS: {
            0: ["Look at it turning down there. It has no idea we're here.", "A.U.R.A., bring up the orbital data. I want a proper look."],
            3: ["I used to love arriving at a new planet. Now I check for wrecks first."]
        }
    },

    // ═══════════════════════════════════════════════════════════════
    // AFTER_SCAN — After deep scan completes
    // ═══════════════════════════════════════════════════════════════
    AFTER_SCAN: {
        PESSIMIST: {
            0: ["Scan's back. Not much here, but the next one might be better."],
            3: ["Scan's in. No air, no water. Same as the last one."]
        },
        HUMANIST: {
            0: ["The scan's clean. No bodies, no graves. That's a relief."],
            3: ["More graves on the scan. I've stopped being surprised."]
        },
        SURVIVOR: {
            0: ["Scan's complete. Some water, thin air, one wreck in orbit."],
            3: ["The scan says two wrecks on the surface. The camera shows three."]
        },
        CURIOUS: {
            0: ["Look at the cloud layers on this scan. A.U.R.A., please save these for me."],
            3: ["A.U.R.A. marked the scan as safe. I used to double-check her. I don't any more."]
        }
    },

    // ═══════════════════════════════════════════════════════════════
    // LOW_ENERGY — Energy drops below 25
    // ═══════════════════════════════════════════════════════════════
    LOW_ENERGY: {
        PESSIMIST: {
            0: ["Energy's under twenty-five. The reactor can't give us much more."],
            3: ["We're nearly out of power. One more long jump and we're drifting."]
        },
        HUMANIST: {
            0: ["Energy's low. Keep the heating on for the crew. Everything else can wait."],
            3: ["It's cold in the corridors. People are sleeping in their suits."]
        },
        SURVIVOR: {
            0: ["Energy's low. Check what the next jump costs before you commit to it."],
            3: ["We have enough power for two jumps, maybe. Don't waste any of it."]
        },
        CURIOUS: {
            0: ["A.U.R.A. dimmed the lab to save power. She kept my station lit, though."],
            3: ["The lab's dark. A.U.R.A. keeps talking to me, which helps."]
        }
    },

    // ═══════════════════════════════════════════════════════════════
    // LOW_RATIONS — Rations drop below 5
    // ═══════════════════════════════════════════════════════════════
    LOW_RATIONS: {
        PESSIMIST: {
            0: ["Food's getting low. We need to find something soon."],
            2: ["We're nearly out of food, and nothing we've found could grow any."],
            3: ["Skip my meal. Give it to someone who's working."]
        },
        HUMANIST: {
            0: ["We're low on food. I'm cutting portions in half. No arguments."],
            2: ["The crew's hungry. I'm keeping track of who ate last."],
            3: ["Nobody's eaten today. I'm worried about all of you."]
        },
        SURVIVOR: {
            0: ["We're down to a few days of food. Start rationing now."],
            2: ["At this rate we run out of food in three days."],
            3: ["One ration left. We need food, and soon."]
        },
        CURIOUS: {
            0: ["Food's low. A.U.R.A. is working out a new meal plan. She's good at that."],
            2: ["A.U.R.A. sets out four meal trays. I always put out a fifth."],
            3: ["There's nothing left in the galley. A.U.R.A., is there anything we missed?"]
        }
    },

    // ═══════════════════════════════════════════════════════════════
    // BEFORE_EVA — Before EVA mission begins
    // ═══════════════════════════════════════════════════════════════
    BEFORE_EVA: {
        PESSIMIST: {
            0: ["Lander's fuelled and checked. Bring it back in one piece."],
            3: ["The lander's been patched too many times. Land gently."]
        },
        HUMANIST: {
            0: ["Everyone has a medical kit. Come back with everyone you took."],
            3: ["If you find graves down there, read me the names over the radio."]
        },
        SURVIVOR: {
            0: ["Three going down, three coming back. I'll check you in at the airlock."],
            3: ["Stay in sight of each other down there. No wandering off."]
        },
        CURIOUS: {
            0: ["Good luck down there. A.U.R.A., keep the channel open for me."],
            3: ["A.U.R.A. says the surface is safe. She hasn't been wrong about a surface yet."]
        }
    },

    // ═══════════════════════════════════════════════════════════════
    // CREW_INJURY — Someone gets hurt
    // ═══════════════════════════════════════════════════════════════
    CREW_INJURY: {
        PESSIMIST: {
            0: ["Get them to Aris. I'll keep things running up here."],
            3: ["Someone else hurt. I want us to stop somewhere safe."]
        },
        HUMANIST: {
            0: ["I've got them. Vitals are steady. They'll be fine."],
            3: ["They're patched up. I'm reusing bandages now. Don't tell them."]
        },
        SURVIVOR: {
            0: ["One injured. The rest of us cover their shifts."],
            3: ["Another injury. We can't afford many more."]
        },
        CURIOUS: {
            0: ["Oh no. A.U.R.A., send their suit data to Aris."],
            3: ["The scan should have caught that. I should have caught that."]
        }
    },

    // ═══════════════════════════════════════════════════════════════
    // CREW_DEATH — Someone dies (bypasses cooldown)
    // ═══════════════════════════════════════════════════════════════
    CREW_DEATH: {
        PESSIMIST: {
            0: ["I don't know what to say. I'm sorry."],
            2: ["When we find somewhere good, I'll put up a marker for them."],
            3: ["I wanted all of us to make it somewhere. I really did."]
        },
        HUMANIST: {
            0: ["Time of death logged. I'm going to say their name out loud. Someone should."],
            2: ["They're on my list now. I never wanted any of us on it."],
            3: ["I'm sorry. I couldn't save them. I'm so sorry."]
        },
        SURVIVOR: {
            0: ["We lost one. Everyone check in with me. Now."],
            2: ["Another one gone. I want to know exactly how this happened."],
            3: ["The ships ahead of us lost their crews one at a time too. I've read their logs."]
        },
        CURIOUS: {
            0: ["I can't look at the monitor. A.U.R.A., please turn it off."],
            2: ["I can't do the scans right now. Give me a minute."],
            3: ["I asked A.U.R.A. to leave their name on the roster. I'm not ready."]
        }
    },

    // ═══════════════════════════════════════════════════════════════
    // SECTOR_JUMP — Transitioning to new sector
    // ═══════════════════════════════════════════════════════════════
    SECTOR_JUMP: {
        PESSIMIST: {
            0: ["Jump complete. The reactor held up fine."],
            2: ["Every jump takes us further out. I'd like one to take us somewhere."],
            3: ["Another jump. The reactor's tired, the lander's tired, and so am I."]
        },
        HUMANIST: {
            0: ["Jump's over. Everyone's breathing. I checked twice."],
            2: ["New sector. More wrecks, I expect. More names for the list."],
            3: ["The deeper we go, the older the wrecks get. I'll keep writing the names down."]
        },
        SURVIVOR: {
            0: ["Jump complete. Five crew, all accounted for."],
            2: ["Every sector, the ship numbers get higher. That isn't an accident."],
            3: ["No wreck we've found was heading home. Every one was going our way."]
        },
        CURIOUS: {
            0: ["That was smooth. A.U.R.A., is everything all right?"],
            2: ["A.U.R.A.'s already mapping the new sector. She's getting faster at it."],
            3: ["A.U.R.A. says we're on course. I just wish I knew where the course ends."]
        }
    },

    // ═══════════════════════════════════════════════════════════════
    // EXODUS_FOUND — Finding an Exodus wreck / flight recorder
    // ═══════════════════════════════════════════════════════════════
    EXODUS_FOUND: {
        PESSIMIST: {
            0: ["That's an Exodus ship, same class as ours. Let's see what we can use.", "One of the eight. Her reactor might still have parts worth taking."],
            2: ["Another Exodus. Her number's higher than ours again."],
            3: ["I've stopped reading the ship numbers. I don't want to know any more."]
        },
        HUMANIST: {
            0: ["One of the eight ships. I'll read the crew names before we take anything.", "Their crew list is still readable. Names first, then we work."],
            2: ["Dead a hundred years, and the names are still on the hatch. Give me a moment."],
            3: ["Give me a minute with them. They've waited long enough."]
        },
        SURVIVOR: {
            0: ["Read me the ship number. I want to match it against the briefing.", "The briefing said eight went before us. Let's see which one this is."],
            2: ["This ship's number is in the thousands. They told us there were eight."],
            3: ["At the shipyard I warned people they were building too many ships. Nobody listened."]
        },
        CURIOUS: {
            0: ["An Exodus ship. A.U.R.A., can you pick up her beacon?", "Her beacon's still working. A.U.R.A. is checking the ship number."],
            2: ["A.U.R.A. dated the hull. It's older than our ship. How is that possible?"],
            3: ["A.U.R.A. read out the ship number like it was nothing. It isn't nothing."]
        }
    },

    // ═══════════════════════════════════════════════════════════════
    // COLONY_SITE_FOUND — Finding a failed colony
    // ═══════════════════════════════════════════════════════════════
    COLONY_SITE_FOUND: {
        PESSIMIST: {
            0: ["Someone built here. Roofs, a well, a fence. They wanted to stay. I understand that."],
            2: ["These houses have been empty for a hundred years. I'd still move into one."],
            3: ["They planted a garden. Then they died here anyway."]
        },
        HUMANIST: {
            0: ["A settlement. There'll be graves. I'll go to them first."],
            2: ["Rows of graves. I'm writing down every name. Don't rush me."],
            3: ["Four names on every stone. Never more. I don't understand it."]
        },
        SURVIVOR: {
            0: ["I want to see the graves myself. Reports get things wrong."],
            2: ["There are three times more graves than houses. They stayed, and they died."],
            3: ["More beds than graves, and nobody left alive. Where did the rest go?"]
        },
        CURIOUS: {
            0: ["A colony, gone quiet. A.U.R.A., can you date the buildings?"],
            2: ["A.U.R.A. says these walls were built long before we launched. I don't understand."],
            3: ["Same well, same streets as the last colony. A.U.R.A., tell me I'm wrong."]
        }
    },

    // ═══════════════════════════════════════════════════════════════
    // SECTOR_3_ENTRY — Entering Sector 3, straight out of the stalled throw.
    // Mira has the transponders: there are more than eight.
    // ═══════════════════════════════════════════════════════════════
    SECTOR_3_ENTRY: {
        PESSIMIST: {
            0: ["That jump stalled halfway. The reactor's back up. I don't want to do that again."],
            2: ["That didn't feel like a jump. It felt like falling."],
            3: ["I dreamed I was home in there. Then I woke up here."]
        },
        HUMANIST: {
            0: ["Everyone blacked out for a moment in there. I've checked each of you. You're all right."],
            2: ["In the dark I thought I heard names. I'm writing down the ones I remember."],
            3: ["Everyone's awake, but nobody's talking. What did we all just see?"]
        },
        SURVIVOR: {
            0: ["There are more than eight beacons on the board. I want a full list."],
            2: ["They said eight went before us. I've got twelve beacons on one screen."],
            3: ["A.U.R.A. says four crew. The briefing said eight ships. Both numbers are wrong."]
        },
        CURIOUS: {
            0: ["Commander. There are more than eight.", "A.U.R.A. read the beacons out for me. She sounded completely calm."],
            2: ["That beacon says ship 212. Two hundred and twelve. That can't be a typo."],
            3: ["A.U.R.A. read out the ship numbers one by one, so calmly. I'm scared."]
        }
    },

    // ═══════════════════════════════════════════════════════════════
    // ANOMALY_FOUND — First anomaly: a wrong place, something the light made
    // ═══════════════════════════════════════════════════════════════
    ANOMALY_FOUND: {
        PESSIMIST: {
            0: ["That's a planet, but something's wrong with it. I can't say what."],
            2: ["This looks like a planet we passed sectors ago. That one had one moon."],
            3: ["It's a copy, and a bad one. Nothing down there has roots. I want to leave."]
        },
        HUMANIST: {
            0: ["Careful. Something here looks made, not grown."],
            2: ["There are gravestones down there with names I've already written on my list."],
            3: ["Whatever made this place copied the graves too. Every name is right."]
        },
        SURVIVOR: {
            0: ["The moons moved between two scans. Check it again. I'm not guessing."],
            2: ["Four figures on the scan. Always four, on every pass."],
            3: ["This place is a copy of something. I want to know who made it."]
        },
        CURIOUS: {
            0: ["I don't know what I'm looking at. A.U.R.A. is thinking. She doesn't usually need to."],
            2: ["A.U.R.A. says the readings match a world we logged three sectors back."],
            3: ["A.U.R.A. calls it a duplicate. Made, she says. She isn't worried, so I'll try not to be."]
        }
    },

    // ═══════════════════════════════════════════════════════════════
    // SECTOR_5_ENTRY — Entering the LAST sector (key kept for saves).
    // Hulls past thirty thousand, four centuries dead, and the light in sight.
    // ═══════════════════════════════════════════════════════════════
    SECTOR_5_ENTRY: {
        PESSIMIST: {
            0: ["Last sector. There's a light ahead, bright as a star."],
            2: ["If that light is a star, there might be a planet near it. Then we stop."],
            3: ["So many dead ships out here. I just want somewhere to land."]
        },
        HUMANIST: {
            0: ["Last sector. My list is long. I'll read all of it before we reach the light."],
            2: ["Four hundred years of dead ahead of us. I'll read every name I can."],
            3: ["Every one of these ships flew toward that light. I want to know why."]
        },
        SURVIVOR: {
            0: ["Final sector. Stay sharp. We don't know what's out here."],
            2: ["Earth knew about every one of these ships, and sent us anyway."],
            3: ["Five people on this ship. A.U.R.A. says four. Someone was never written down."]
        },
        CURIOUS: {
            0: ["There's a light ahead of us. A.U.R.A. has gone quiet. I think she's looking too."],
            2: ["I asked A.U.R.A. what that light is. She said she's still working on it."],
            3: ["A.U.R.A. says our heading is complete. Tell me what to do, Commander."]
        }
    },

    // ═══════════════════════════════════════════════════════════════
    // FIRST_VITAL — First time finding a VITAL-type planet (one-time)
    // ═══════════════════════════════════════════════════════════════
    FIRST_VITAL: {
        PESSIMIST: {
            0: ["That's green. Real green. Tell me the scan's right.", "Plants, water, air. Commander, this could be the one."],
            2: ["It looks green. I'll believe it when I'm standing on it."],
            3: ["A living world. There's always a catch. Let me enjoy it for a minute first."]
        },
        HUMANIST: {
            0: ["A living world. If we could be happy anywhere, it's here."],
            2: ["It's alive down there. Let's keep it that way."],
            3: ["It's green. I'll check for graves first, and then I'll let myself hope."]
        },
        SURVIVOR: {
            0: ["Habitable, with no wrecks in orbit. That's a first."],
            2: ["A good planet, and the ships before us flew straight past it. Why?"],
            3: ["If this place is so good, where are the other crews? Somebody should be living here."]
        },
        CURIOUS: {
            0: ["Chlorophyll. Water. Weather. A.U.R.A., are you seeing this?"],
            2: ["A.U.R.A. ran the scan three times for me. It's real every time."],
            3: ["A.U.R.A. says it's real. Tell me to believe her, Commander."]
        }
    },

    // ═══════════════════════════════════════════════════════════════
    // SINGING_PLANET — A world broadcasting a tone on a dead channel (one-time)
    // ═══════════════════════════════════════════════════════════════
    SINGING_PLANET: {
        PESSIMIST: {
            0: ["This planet's giving off a tone. I can hear it through the hull."],
            2: ["That tone's in the hull plating now. I can't switch it off."],
            3: ["It sounds like it's about to finish. It never does."]
        },
        HUMANIST: {
            0: ["There's a voice under the tone. I think it's saying a name."],
            2: ["It's a name, over and over. I've written it down."],
            3: ["Someone down there keeps calling a name. I'm saying it back to them."]
        },
        SURVIVOR: {
            0: ["The tone repeats every eleven seconds. Exactly eleven."],
            2: ["The signal is a string of numbers, going up. It hasn't stopped."],
            3: ["The numbers in that signal are still climbing. I want to know where they end."]
        },
        CURIOUS: {
            0: ["This planet is broadcasting. A.U.R.A., are you recording? She says she is."],
            2: ["A.U.R.A. says it's an old ship's broadcast on a dead channel."],
            3: ["A.U.R.A. matched the channel to an Exodus ship. It's been dead for centuries."]
        }
    },

    // ═══════════════════════════════════════════════════════════════
    // PROBE_DEPLOY — When launching a probe
    // ═══════════════════════════════════════════════════════════════
    PROBE_DEPLOY: {
        PESSIMIST: {
            0: ["Probe's away. Come back in one piece."],
            3: ["Send the probe. At least something gets off this ship."]
        },
        HUMANIST: {
            0: ["Probe's out. Good. Nobody gets hurt for a reading."],
            3: ["Let the machine look first. I've seen enough bodies."]
        },
        SURVIVOR: {
            0: ["Probe launched. Ninety seconds to the surface."],
            3: ["Probe's away. We don't have many left. Use them carefully."]
        },
        CURIOUS: {
            0: ["Probe's away. A.U.R.A. has it on the line."],
            3: ["The probe's out. A.U.R.A. likes the probes. They always answer her."]
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
