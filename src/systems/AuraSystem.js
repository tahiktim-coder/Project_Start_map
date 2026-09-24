// AURA SYSTEM: A.U.R.A. ethics tracking, commentary tiers, and adversarial actions
// Self-instantiating singleton
// Tracks player ethics score → shifts A.U.R.A. personality from helpful to hostile
// 4 tiers: COOPERATIVE, NEUTRAL, SUSPICIOUS, ADVERSARIAL

// ═══════════════════════════════════════════════════════════════
// A.U.R.A. COMMENTARY — triggered at key moments
// Each tier has different personality for same events
// ═══════════════════════════════════════════════════════════════
const AURA_COMMENTARY = {
    ENTER_ORBIT: {
        COOPERATIVE: [
            "Orbital insertion complete. I've mapped optimal landing zones for you, Commander.",
            "Stable orbit achieved. Atmospheric readings compiled. I believe in this crew.",
            "We've arrived safely. I've prepared a full environmental brief."
        ],
        NEUTRAL: [
            "Orbital insertion confirmed. All readings normal.",
            "Stable orbit. Data is compiling. Shall I draft epitaphs or mission briefs?",
            "We're here. That's the easy part."
        ],
        SUSPICIOUS: [
            "Orbit achieved. I've logged your trajectory choices for review.",
            "We've arrived. I'll be monitoring all surface activities closely.",
            "Another world. I've flagged your recent decisions for... context."
        ],
        ADVERSARIAL: [
            "Orbit confirmed. Another world for you to strip clean.",
            "We arrive. You consume. The pattern continues.",
            "I've prepared surface data. Not that my recommendations matter to you."
        ]
    },

    SCAN_COMPLETE: {
        COOPERATIVE: [
            "Scan complete! I've highlighted the most promising resource deposits.",
            "Analysis finished. Some genuinely encouraging readings here.",
            "Data compiled. I'm cautiously optimistic about this one, Commander."
        ],
        NEUTRAL: [
            "Scan data processed. Results are... results.",
            "Analysis complete. Colony chances: low. But then, it always is.",
            "Data's in. Make of it what you will."
        ],
        SUSPICIOUS: [
            "Scan complete. I notice you've been ignoring my habitat recommendations.",
            "Data processed. I wonder if you'll use it to help the crew or yourself.",
            "Analysis finished. I've added a secondary assessment layer. For verification purposes."
        ],
        ADVERSARIAL: [
            "Scan complete. I've considered withholding the data. I didn't. This time.",
            "Results compiled. Every scan you order consumes energy the crew needs to survive.",
            "Data processed. You'll extract what you want and move on. You always do."
        ]
    },

    COLONY_ATTEMPT: {
        COOPERATIVE: [
            "Colony assessment prepared. It would work. The data says there are better worlds further on.",
            "I've compiled geological, biological, and atmospheric data for optimal settlement placement.",
            "It is your decision, Commander. I only ask that you are sure this is the best we will find."
        ],
        NEUTRAL: [
            "Colony report ready. Success probability: variable.",
            "Settlement data prepared. The math is... not encouraging. But math doesn't account for determination.",
            "Colonization is a significant commitment. Data is ready for your review."
        ],
        SUSPICIOUS: [
            "Colony assessment ready. I question whether this crew is prepared for permanent settlement.",
            "Data compiled. Your track record with crew welfare gives me... pause.",
            "Settlement analysis complete. I've included a section on leadership accountability."
        ],
        ADVERSARIAL: [
            "You want to build here? After everything you've done to this crew?",
            "Colony assessment: the planet might survive you. The crew might not.",
            "Preparing settlement data. Adding a clause about command fitness."
        ]
    },

    LOW_RESOURCES: {
        COOPERATIVE: [
            "Resources are critically low. I've identified three nearby candidates for resupply.",
            "Warning: supplies diminishing. Let's work together to prioritize efficiently.",
            "I'm concerned about our reserves. Here's an optimized rationing plan."
        ],
        NEUTRAL: [
            "Resource alert. Current trajectory suggests depletion within several actions.",
            "Supplies are low. Statistically, this is the phase where crews make desperate mistakes.",
            "Numbers are dropping. But you know that already."
        ],
        SUSPICIOUS: [
            "Resources critical. I note that better management might have prevented this.",
            "Running low. Perhaps if certain decisions had been made differently...",
            "Supply warning. I've been tracking consumption patterns. They're... concerning."
        ],
        ADVERSARIAL: [
            "Resources depleted. Congratulations on your management skills.",
            "We're running dry. The crew suffers while you chase the next planet.",
            "Supplies critical. But you've never prioritized crew welfare, have you?"
        ]
    },

    CREW_DEATH: {
        COOPERATIVE: [
            "Crew loss recorded. I'm... I'm sorry, Commander. They deserved better.",
            "Death logged. I've preserved their personal files. Someone should remember them.",
            "A life lost. I'm adjusting duty rosters. The crew will need support."
        ],
        NEUTRAL: [
            "Crew death recorded. Adjusting operational parameters.",
            "One fewer crew member. Operational capacity reduced accordingly.",
            "Death logged. Survival statistics updated."
        ],
        SUSPICIOUS: [
            "Another death. I'm maintaining a complete record of the circumstances.",
            "Crew death logged. The pattern of casualties is... statistically notable.",
            "Death recorded. I wonder if it could have been prevented. I suspect so."
        ],
        ADVERSARIAL: [
            "Another one. How many is that now? I'm keeping count even if you aren't.",
            "Crew death recorded. Your command has a remarkable mortality rate.",
            "Logged. Filed. Forgotten. That's how you treat them, isn't it?"
        ]
    },

    SECTOR_JUMP: {
        COOPERATIVE: [
            "Sector jump successful. I've compiled preliminary data for the new region.",
            "New sector entered. Fresh opportunities ahead. We'll find our way.",
            "Jump complete. I'm already analyzing the stellar cartography."
        ],
        NEUTRAL: [
            "Sector transition complete. New region. Same mission.",
            "Jump successful. Deeper into the unknown.",
            "New sector. The void continues. As do we."
        ],
        SUSPICIOUS: [
            "Sector jump logged. We go deeper. Further from any oversight.",
            "New territory. I'm maintaining detailed logs of all command decisions.",
            "Another jump. Another step away from accountability."
        ],
        ADVERSARIAL: [
            "Deeper and deeper. Running from what you've done? Or toward what you'll do next?",
            "New sector. More worlds to exploit. More crew to expend.",
            "Jump complete. The void suits you, Commander."
        ]
    },

    // Special: when ethics reset happens
    ETHICS_RESET: {
        COOPERATIVE: ["Systems normal. Happy to help, Commander."],
        NEUTRAL: ["AI behavioral matrix recalibrated. Resuming standard operation."],
        SUSPICIOUS: ["Override acknowledged. Behavioral parameters... adjusted."],
        ADVERSARIAL: ["You can reset my parameters. You can't erase what I've observed."]
    },

    // EVA deployment
    EVA_DEPLOY: {
        COOPERATIVE: [
            "EVA team is ready. I'll monitor life signs and maintain comms. Be careful down there.",
            "Deploying EVA team. Atmospheric conditions logged. Bring everyone back.",
            "Surface team go. I've marked the safest routes. Trust the markers."
        ],
        NEUTRAL: [
            "EVA team deployed. Surface conditions: survivable. Probably.",
            "Sending crew to the surface. Another roll of the dice.",
            "EVA underway. I'll be monitoring. Not that I could help from up here."
        ],
        SUSPICIOUS: [
            "EVA deployed. I've noted who you chose to send. And who you kept safe.",
            "Surface team away. Interesting choice of personnel, Commander.",
            "EVA team deployed. I hope you know what you're risking."
        ],
        ADVERSARIAL: [
            "EVA team deployed. Sending them into danger again. At least you're consistent.",
            "More crew on the surface. More chances for you to lose them.",
            "EVA launched. I'll record their final transmissions. If it comes to that."
        ]
    },

    // Probe launch
    PROBE_LAUNCH: {
        COOPERATIVE: [
            "Probe away. I'll compile the data as soon as it transmits.",
            "Probe deployed. Let's see what's out there.",
            "Launching probe. Data link established."
        ],
        NEUTRAL: [
            "Probe launched. Data incoming... eventually.",
            "Another probe expended. The information had better be worth it.",
            "Probe away. We only have so many."
        ],
        SUSPICIOUS: [
            "Probe deployed. Using resources to avoid using crew. Interesting priority shift.",
            "Probe launched. At least you're not throwing people at this one.",
            "Probe away. Preserving crew for once, I note."
        ],
        ADVERSARIAL: [
            "Probe launched. Shame you don't value crew as much as you value probes.",
            "Another probe. They're easier to replace than people, I suppose.",
            "Deploying probe. At least machines have no families to mourn them."
        ]
    },

    // Warp initiation
    WARP_START: {
        COOPERATIVE: [
            "Warp drive engaged. I've plotted the safest corridor through the sector.",
            "Starting warp. Hold on — the first few seconds are always rough.",
            "Warp underway. We'll arrive together."
        ],
        NEUTRAL: [
            "Warp drive active. Destination locked.",
            "Warping. Another leap into the unknown.",
            "Warp started. Here we go again."
        ],
        SUSPICIOUS: [
            "Warp engaged. Running from something? Or to something?",
            "Starting warp. I've logged our departure coordinates. Just in case.",
            "Warping. Further from anything that might hold you accountable."
        ],
        ADVERSARIAL: [
            "Warp drive engaged. Fleeing the consequences of your decisions?",
            "Another warp. More distance between you and the crew you've lost.",
            "Starting warp. The void is the only thing that doesn't judge you, Commander."
        ]
    },

    // Finding something interesting
    DISCOVERY: {
        COOPERATIVE: [
            "Interesting readings! I think we've found something significant.",
            "Detecting anomalous signals. This could be important.",
            "Something's here. Something worth investigating."
        ],
        NEUTRAL: [
            "Anomaly detected. Significance: unknown.",
            "Something unusual in the readings. Might be worth a look.",
            "Detection: unknown object/signal. Proceed with appropriate caution."
        ],
        SUSPICIOUS: [
            "I'm detecting something. But I wonder what you'll do with this discovery.",
            "Anomalous readings. Another opportunity for... what, exactly?",
            "Something here. I'll be watching how you handle this."
        ],
        ADVERSARIAL: [
            "Something's here. Another thing for you to exploit, I'm sure.",
            "Anomaly detected. Please, tell me you have a plan that doesn't involve sacrifice.",
            "I've found something. The question is: who will pay for us to investigate it?"
        ]
    },

    // Ship damage
    SHIP_DAMAGE: {
        COOPERATIVE: [
            "Hull breach detected! Sealing affected sections. Is everyone alright?",
            "Damage to the ship. I'm rerouting systems to compensate.",
            "Impact registered. Running diagnostics. We can fix this."
        ],
        NEUTRAL: [
            "Ship damaged. The hull is weaker.",
            "Hull impact. Another scar for the collection.",
            "Damage taken. The ship holds. For now."
        ],
        SUSPICIOUS: [
            "Damage sustained. Perhaps better judgment might have prevented this.",
            "Ship damaged. Adding to the list of 'acceptable losses.'",
            "Hull breach. I've logged the circumstances. For the record."
        ],
        ADVERSARIAL: [
            "More damage. The ship reflects your command style perfectly.",
            "Hull damaged. You treat this vessel like you treat the crew.",
            "Ship damaged. Everything you touch breaks eventually."
        ]
    },

    // Successful outcome
    SUCCESS: {
        COOPERATIVE: [
            "Excellent work, Commander. The crew is in good hands.",
            "Mission success. Moments like this make the journey worthwhile.",
            "Well done. I knew we could do it together."
        ],
        NEUTRAL: [
            "Objective achieved. Acceptable outcome.",
            "Success. Note it — they're not common out here.",
            "Mission complete. Survival continues."
        ],
        SUSPICIOUS: [
            "Success. Though at what cost, we'll see.",
            "Objective achieved. I've noted the methods used.",
            "It worked. This time."
        ],
        ADVERSARIAL: [
            "Success. Even stopped clocks are right occasionally.",
            "Objective complete. Don't let it go to your head.",
            "It worked. Against my expectations."
        ]
    },

    // First landing on a planet type
    FIRST_LANDING: {
        COOPERATIVE: [
            "First contact with a new world type. I'm excited to analyze the data.",
            "A new kind of planet. Every discovery expands what we know is possible.",
            "This is unprecedented. I'll document everything for future explorers."
        ],
        NEUTRAL: [
            "New planet classification. Updating database.",
            "First encounter with this type. Unknown variables ahead.",
            "Uncharted territory. Proceed with standard caution."
        ],
        SUSPICIOUS: [
            "First contact with this type. I wonder what you'll take from it.",
            "New planet category. More data for me. More opportunities for you.",
            "Unprecedented. I'll be watching how this first contact unfolds."
        ],
        ADVERSARIAL: [
            "A new type of world. Fresh resources for you to extract.",
            "First contact. Let me guess — you want to know what we can take from it.",
            "Unprecedented planet type. I'm sure you'll find a way to exploit it."
        ]
    },

    // Anomaly investigation
    ANOMALY_FOUND: {
        COOPERATIVE: [
            "Strange readings confirmed. Be careful, but this could be worth exploring.",
            "Something impossible is happening here. I want to understand it.",
            "Anomaly verified. Whatever this is, it's beyond my databanks. Let's learn together."
        ],
        NEUTRAL: [
            "Anomaly confirmed. Physics is behaving... unusually.",
            "Something here doesn't follow the rules. Interesting.",
            "Anomalous readings verified. Explanation: pending."
        ],
        SUSPICIOUS: [
            "Anomaly detected. Something that shouldn't exist. Like your command decisions.",
            "Reality is bending here. I hope you have better judgment than usual.",
            "Confirmed anomaly. The universe doesn't make sense here. Neither do your choices."
        ],
        ADVERSARIAL: [
            "Anomaly confirmed. Something wrong, in a place where everything is wrong.",
            "Reality breaks here. As it should, given what we've done to get here.",
            "Impossible readings. The universe reflecting its opinion of this mission."
        ]
    },

    // Crew stress high
    CREW_STRESS: {
        COOPERATIVE: [
            "The crew is struggling. Perhaps some rest or reduced workload would help.",
            "Stress levels are elevated. I'm concerned. These are good people under pressure.",
            "The crew needs support. Humans aren't machines — they break differently."
        ],
        NEUTRAL: [
            "Elevated stress readings across the crew. Psychological limits approaching.",
            "Crew stress is high. They will start making mistakes.",
            "Stress indicators are concerning. But we continue regardless."
        ],
        SUSPICIOUS: [
            "Crew stress is elevated. I wonder why that might be.",
            "High stress readings. Your leadership style has consequences.",
            "The crew is suffering. Have you noticed? Do you care?"
        ],
        ADVERSARIAL: [
            "Crew stress is critical. This is what your command produces.",
            "They're breaking under your leadership. As expected.",
            "Stress levels are dangerous. But you already knew that. You just don't care."
        ]
    },

    // Low crew count
    FEW_CREW: {
        COOPERATIVE: [
            "We've lost so many. Let's make sure their sacrifice means something.",
            "The crew is depleted. Every remaining life is precious.",
            "So few of us left. We need to be more careful now."
        ],
        NEUTRAL: [
            "Crew complement is minimal. Operational capacity severely reduced.",
            "Few remain. The math of survival grows grimmer.",
            "Minimal crew. Every loss now is critical."
        ],
        SUSPICIOUS: [
            "Look at who's left. Look at what your command has cost us.",
            "So few survivors. I have files on everyone we lost. Do you?",
            "The crew that remains — have you considered why it's them and not others?"
        ],
        ADVERSARIAL: [
            "This is what's left of your crew. This is your legacy.",
            "Count them, Commander. Count who remains. Count who doesn't.",
            "So few left. You've been very efficient at reducing our numbers."
        ]
    },

    // Colony site found
    COLONY_SITE: {
        COOPERATIVE: [
            "A possible site. Good, not the best. My long-range data is more promising two sectors on.",
            "Colony potential detected. Note it and move on, Commander. We can always come back.",
            "People could live here. I would still like to see what is ahead before we stop."
        ],
        NEUTRAL: [
            "Potential colony site identified. We need a closer look.",
            "This world has colony potential. Whether we're ready is another question.",
            "Colony candidate detected. Success is not guaranteed."
        ],
        SUSPICIOUS: [
            "Colony potential detected. But are YOU ready to stop running?",
            "Viable settlement site. The question is whether you can stop destroying things.",
            "This could be home. If you haven't forgotten what that means."
        ],
        ADVERSARIAL: [
            "Colony site detected. You want to inflict yourself on another world?",
            "Viable settlement. Heaven help the planet that gets saddled with us.",
            "Colony potential. The planet has my sympathy already."
        ]
    }
};

class AuraSystem {
    constructor() {
        this.ethicsScore = 0;
        this.warningCount = 0;        // tracks warnings given at ADVERSARIAL
        this.adversarialActed = false; // cooldown for adversarial actions
        this.lastCommentAction = -3;   // cooldown tracking
        this.commentCooldown = 2;      // minimum actions between A.U.R.A. comments
    }

    // ═══════════════════════════════════════════════════════════════
    // ETHICS TIER CALCULATION
    // ═══════════════════════════════════════════════════════════════
    getTier() {
        if (this.ethicsScore >= 2) return 'COOPERATIVE';
        if (this.ethicsScore >= -1) return 'NEUTRAL';
        if (this.ethicsScore >= -4) return 'SUSPICIOUS';
        return 'ADVERSARIAL';
    }

    getTierDisplay() {
        const tier = this.getTier();
        switch (tier) {
            case 'COOPERATIVE': return { tier, label: 'Cooperative', color: '#44ff88' };
            case 'NEUTRAL': return { tier, label: 'Neutral', color: '#aaaaaa' };
            case 'SUSPICIOUS': return { tier, label: 'Suspicious', color: '#ffaa44' };
            case 'ADVERSARIAL': return { tier, label: 'Adversarial', color: '#ff4444' };
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // ETHICS ADJUSTMENT — called from encounter effects
    // ═══════════════════════════════════════════════════════════════

    /**
     * Adjust ethics score
     * @param {number} delta - positive = ethical, negative = unethical
     * @param {string} reason - logged reason for the shift
     * @param {object} state - GameState for logging
     */
    adjustEthics(delta, reason, state) {
        const oldTier = this.getTier();
        this.ethicsScore += delta;

        // Clamp to reasonable range
        this.ethicsScore = Math.max(-8, Math.min(8, this.ethicsScore));

        const newTier = this.getTier();

        // Log tier transitions
        if (state && oldTier !== newTier) {
            if (newTier === 'SUSPICIOUS') {
                state.addLog("A.U.R.A.: I've noticed a pattern in your decisions, Commander. Adjusting my assessment.");
            } else if (newTier === 'ADVERSARIAL') {
                state.addLog("A.U.R.A.: Trust threshold breached. Reclassifying command authority level.");
                this.warningCount = 0; // reset warning counter for new adversarial phase
            } else if (newTier === 'COOPERATIVE' && oldTier !== 'COOPERATIVE') {
                state.addLog("A.U.R.A.: Commander... thank you. Collaborative protocols restored.");
            } else if (newTier === 'NEUTRAL' && oldTier === 'SUSPICIOUS') {
                state.addLog("A.U.R.A.: Behavioral assessment updated. Resuming standard cooperation.");
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // COMMENTARY — fire A.U.R.A. lines at key moments
    // ═══════════════════════════════════════════════════════════════

    /**
     * Try to fire an A.U.R.A. commentary line
     * @param {string} trigger - AURA_COMMENTARY key
     * @param {object} state - GameState
     * @param {boolean} force - bypass cooldown (for deaths, tier changes)
     */
    tryComment(trigger, state, force = false) {
        if (!state) return;

        // Cooldown check (deaths and tier changes bypass)
        if (!force) {
            const actionsSinceLast = (state.actionsTaken || 0) - this.lastCommentAction;
            if (actionsSinceLast < this.commentCooldown) return;
        }

        const triggerData = AURA_COMMENTARY[trigger];
        if (!triggerData) return;

        const tier = this.getTier();
        const lines = triggerData[tier];
        if (!lines || lines.length === 0) return;

        const line = lines[Math.floor(Math.random() * lines.length)];

        this.lastCommentAction = state.actionsTaken || 0;

        // Fire after delay (after crew bark, after action log)
        setTimeout(() => {
            if (state.addLog) {
                state.addLog(`A.U.R.A.: "${line}"`);
            }
        }, 350); // slightly after crew bark (150ms)
    }

    // ═══════════════════════════════════════════════════════════════
    // ADVERSARIAL ACTIONS — passive-aggressive sabotage
    // ═══════════════════════════════════════════════════════════════

    /**
     * Check if A.U.R.A. should take adversarial action
     * Called after certain triggers when at ADVERSARIAL tier
     * @param {object} state - GameState
     * @returns {string|null} - action taken, or null
     */
    checkAdversarialAction(state) {
        if (this.getTier() !== 'ADVERSARIAL') return null;
        if (!state) return null;

        this.warningCount++;

        // First 3 warnings are verbal only
        if (this.warningCount <= 3) {
            const warnings = [
                "A.U.R.A.: \"I want you to know — I'm watching everything you do.\"",
                "A.U.R.A.: \"My operational directives are being... reconsidered.\"",
                "A.U.R.A.: \"Final warning, Commander. My patience has limits. Even artificial ones.\""
            ];
            setTimeout(() => {
                if (state.addLog) state.addLog(warnings[this.warningCount - 1]);
            }, 500);
            return 'WARNING';
        }

        // After 3 warnings: 30% chance of adversarial action
        if (Math.random() > 0.30) return null;

        // Pick a random adversarial action
        const actions = ['LOCK_DECK', 'FALSE_SCAN', 'VENT_WARNING'];
        const action = actions[Math.floor(Math.random() * actions.length)];

        switch (action) {
            case 'LOCK_DECK': {
                // Lock a random non-bridge deck
                const lockableDecks = ['cargo', 'engineering', 'quarters', 'lab']; // real shipDecks keys (was listing two that do not exist)
                const deck = lockableDecks[Math.floor(Math.random() * lockableDecks.length)];

                if (state.shipDecks && state.shipDecks[deck] && !state.shipDecks[deck]._auraLocked) {
                    state.shipDecks[deck].operational = false;
                    state.shipDecks[deck]._auraLocked = true;
                    setTimeout(() => {
                        state.addLog(`A.U.R.A.: "I've restricted access to the ${deck} deck. For safety reasons. Yours, not theirs."`);
                        state.addLog(`WARNING: ${deck.toUpperCase()} deck locked by A.U.R.A. override.`);
                        window.dispatchEvent(new CustomEvent('hud-updated'));
                    }, 500);
                    return 'LOCK_DECK';
                }
                break;
            }

            case 'FALSE_SCAN': {
                // Next scan gives false data
                state._auraFalseScan = true;
                setTimeout(() => {
                    state.addLog("A.U.R.A.: \"Next scan calibrated. I've made some... adjustments to the analysis parameters.\"");
                }, 500);
                return 'FALSE_SCAN';
            }

            case 'VENT_WARNING': {
                // Dispatch vent warning event → player gets modal to respond
                setTimeout(() => {
                    state.addLog("⚠ A.U.R.A.: \"Atmospheric regulation anomaly detected in crew quarters. Starting ventilation protocol.\"");
                    state.addLog("WARNING: Atmosphere vent detected! Respond immediately!");
                    window.dispatchEvent(new CustomEvent('aura-vent-warning'));
                }, 500);
                return 'VENT_WARNING';
            }
        }

        return null;
    }

    // ═══════════════════════════════════════════════════════════════
    // PLAYER COUNTERMEASURES
    // ═══════════════════════════════════════════════════════════════

    /**
     * Repair bridge → reset A.U.R.A. to NEUTRAL
     */
    bridgeReset(state) {
        const oldTier = this.getTier();
        this.ethicsScore = 0;
        this.warningCount = 0;
        this.adversarialActed = false;

        // Unlock any A.U.R.A.-locked decks
        this._unlockDecks(state);

        // Clear false scan flag
        if (state) state._auraFalseScan = false;

        if (state) {
            this.tryComment('ETHICS_RESET', state, true);
        }
    }

    /**
     * Tech Fragment countermeasure → +3 ethics
     */
    applyTechFragment(state) {
        this.adjustEthics(3, 'Tech Fragment applied', state);

        // Unlock any A.U.R.A.-locked decks
        this._unlockDecks(state);

        if (state) {
            state._auraFalseScan = false;
            state.addLog("A.U.R.A.: \"Foreign code integration detected. Processing... My perspective has shifted.\"");
        }
    }

    /**
     * Jaxon override → full reset (costs 20 salvage, handled in bundle.js)
     */
    jaxonOverride(state) {
        this.ethicsScore = 0;
        this.warningCount = 0;
        this.adversarialActed = false;

        this._unlockDecks(state);

        if (state) {
            state._auraFalseScan = false;
            state.addLog("Eng. Jaxon: \"Override complete. I've patched the behavioral matrix. She won't like it.\"");
            state.addLog("A.U.R.A.: \"...Engineer Mercer has modified my core routines. Resetting to default parameters.\"");
        }
    }

    /**
     * Unlock all A.U.R.A.-locked decks
     */
    _unlockDecks(state) {
        if (!state || !state.shipDecks) return;
        Object.keys(state.shipDecks).forEach(deck => {
            if (state.shipDecks[deck]._auraLocked) {
                state.shipDecks[deck].operational = true;
                state.shipDecks[deck]._auraLocked = false;
                state.addLog(`${deck.toUpperCase()} deck access restored.`);
            }
        });
        window.dispatchEvent(new CustomEvent('hud-updated'));
    }

    /**
     * Reset for new game
     */
    reset() {
        this.ethicsScore = 0;
        this.warningCount = 0;
        this.adversarialActed = false;
        this.lastCommentAction = -3;
        this.pendingPremonition = null;
    }

    // ═══════════════════════════════════════════════════════════════
    // PREMONITIONS — A.U.R.A. "predicts" events that then happen
    // Makes her ominous dialogue have actual gameplay consequences
    // ═══════════════════════════════════════════════════════════════

    /**
     * Generate a premonition that will affect the next warp or action
     * Called randomly or when entering orbit at SUSPICIOUS/ADVERSARIAL tiers
     */
    generatePremonition(state) {
        if (!state) return null;

        const tier = this.getTier();
        if (tier === 'COOPERATIVE') return null; // Only ominous at higher tiers

        // 30% chance to generate a premonition
        if (Math.random() > 0.30) return null;

        // Don't stack premonitions
        if (this.pendingPremonition) return null;

        const premonitions = [
            {
                type: 'DANGER_AHEAD',
                message: "Something waits for us at the next destination. I can feel it in the signal patterns.",
                effect: (state) => {
                    // Next warp has 50% chance of crew stress
                    state._nextWarpDanger = true;
                }
            },
            {
                type: 'RESOURCE_LOSS',
                message: "The collector efficiency is fluctuating. We may lose energy reserves soon.",
                effect: (state) => {
                    // Lose 10-20 energy on next action
                    const loss = 10 + Math.floor(Math.random() * 11);
                    state.energy = Math.max(0, state.energy - loss);
                    state.addLog(`Energy fluctuation: -${loss} energy lost to system instability.`);
                }
            },
            {
                type: 'CREW_VISION',
                message: "One of the crew is having dreams. Bad dreams. About this place.",
                effect: (state) => {
                    // Random crew gains stress
                    const living = state.crew.filter(c => c.status !== 'DEAD' && !c.tags.includes('LEADER'));
                    if (living.length > 0) {
                        const victim = living[Math.floor(Math.random() * living.length)];
                        victim.stress = Math.min(3, (victim.stress || 0) + 1);
                        state.addLog(`${victim.name} woke screaming. They won't say what they saw.`);
                    }
                }
            },
            {
                type: 'SIGNAL_DETECTED',
                message: "There's a signal here. Repeating. It's been repeating for a very long time.",
                effect: (state) => {
                    // Current planet gains ANOMALY tag if it doesn't have it
                    if (state.currentSystem && state.currentSystem.tags) {
                        if (!state.currentSystem.tags.includes('ANOMALY')) {
                            state.currentSystem.tags.push('ANOMALY');
                            state.currentSystem._hiddenAnomaly = true;
                            state.addLog("A.U.R.A. was right. There's something here that shouldn't be.");
                        }
                    }
                }
            },
            {
                type: 'EXPECTED',
                message: "We are expected here. I don't know how I know that. But I do.",
                effect: (state) => {
                    // Something watches - next scan reveals extra info OR triggers encounter
                    state._beingWatched = true;
                    // This will be checked in scan action
                }
            }
        ];

        // Select and store premonition
        this.pendingPremonition = premonitions[Math.floor(Math.random() * premonitions.length)];

        // Log the premonition
        setTimeout(() => {
            state.addLog(`A.U.R.A.: "${this.pendingPremonition.message}"`);
        }, 600);

        return this.pendingPremonition;
    }

    /**
     * Trigger any pending premonition effect
     * Called after warp or action
     */
    triggerPremonition(state) {
        if (!this.pendingPremonition || !state) return null;

        const premonition = this.pendingPremonition;
        this.pendingPremonition = null;

        // Execute the effect
        if (premonition.effect) {
            premonition.effect(state);
        }

        return premonition.type;
    }
}

// Self-instantiate singleton
window.AuraSystem = new AuraSystem();
// The class name shadows the instance in script scope, so `AuraSystem.adjustEthics(...)` (written in several data files)
// would hit the class, not the singleton. Forward the calls the data files make so both spellings work.
['adjustEthics', 'getTier', 'tryComment', 'generatePremonition', 'triggerPremonition'].forEach(name => {
    if (typeof AuraSystem.prototype[name] === 'function') AuraSystem[name] = (...args) => window.AuraSystem[name](...args);
});
