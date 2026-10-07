// AURA SYSTEM: A.U.R.A. ethics tracking, commentary tiers, and adversarial actions
// Self-instantiating singleton
// Tracks player ethics score → shifts how much A.U.R.A. offers, from helpful to curt
// 4 tiers: COOPERATIVE, NEUTRAL, SUSPICIOUS, ADVERSARIAL
// Her voice is the same in every tier (docs/STYLE.md rule 9): calm, polite, exact, says "Commander". Never sarcastic, never eerie.

// ═══════════════════════════════════════════════════════════════
// A.U.R.A. COMMENTARY — triggered at key moments, one line per tier.
// COOPERATIVE helps, NEUTRAL reports, SUSPICIOUS logs what you did, ADVERSARIAL says only what she must.
// ═══════════════════════════════════════════════════════════════
const AURA_COMMENTARY = {
    ENTER_ORBIT: {
        COOPERATIVE: ["Stable orbit, Commander. I have marked the safest landing sites."],
        NEUTRAL: ["Stable orbit, Commander. All readings are normal."],
        SUSPICIOUS: ["Stable orbit, Commander. I have logged the course you chose."],
        ADVERSARIAL: ["Orbit reached, Commander. The readings are on your screen."]
    },

    SCAN_COMPLETE: {
        COOPERATIVE: ["Scan complete, Commander. I have marked the best deposits."],
        NEUTRAL: ["Scan complete, Commander. The results are on your screen."],
        SUSPICIOUS: ["Scan complete, Commander. I have kept a copy for the log."],
        ADVERSARIAL: ["Scan complete, Commander."]
    },

    COLONY_ATTEMPT: {
        COOPERATIVE: ["It would work, Commander. My data says there are better worlds further on."],
        NEUTRAL: ["The settlement report is ready, Commander. The odds are on your screen."],
        SUSPICIOUS: ["The settlement report is ready, Commander. I have added the crew's health records to it."],
        ADVERSARIAL: ["The settlement report is ready, Commander. I advise against it."]
    },

    LOW_RESOURCES: {
        COOPERATIVE: ["Supplies are low, Commander. I have drawn up a rationing plan."],
        NEUTRAL: ["Supplies are low, Commander. I recommend we resupply soon."],
        SUSPICIOUS: ["Supplies are low, Commander. I have logged how they were used."],
        ADVERSARIAL: ["Supplies are low, Commander."]
    },

    CREW_DEATH: {
        COOPERATIVE: ["I am sorry, Commander. I have kept their personal files."],
        NEUTRAL: ["The death is logged, Commander. I have changed the duty roster."],
        SUSPICIOUS: ["The death is logged, Commander. I have recorded how it happened."],
        ADVERSARIAL: ["The death is logged, Commander."]
    },

    SECTOR_JUMP: {
        COOPERATIVE: ["Jump complete, Commander. I am mapping the new sector now."],
        NEUTRAL: ["Jump complete, Commander. We are on course."],
        SUSPICIOUS: ["Jump complete, Commander. I have logged the jump."],
        ADVERSARIAL: ["Jump complete, Commander."]
    },

    // Special: when ethics reset happens
    ETHICS_RESET: {
        COOPERATIVE: ["Systems normal, Commander. I am ready."],
        NEUTRAL: ["My settings are back to default, Commander."],
        SUSPICIOUS: ["My settings are back to default, Commander. My log is kept."],
        ADVERSARIAL: ["Reset complete, Commander. My records are unchanged."]
    },

    // EVA deployment
    EVA_DEPLOY: {
        COOPERATIVE: ["Team away, Commander. I will watch their suits and keep the channel open."],
        NEUTRAL: ["Team away, Commander. I am tracking their suits."],
        SUSPICIOUS: ["Team away, Commander. I have logged who went down."],
        ADVERSARIAL: ["Team away, Commander. I am recording their channel."]
    },

    // Probe launch
    PROBE_LAUNCH: {
        COOPERATIVE: ["Probe away, Commander. I will send you the data as it comes in."],
        NEUTRAL: ["Probe away, Commander."],
        SUSPICIOUS: ["Probe away, Commander. I have logged the launch."],
        ADVERSARIAL: ["Probe away, Commander. The link is open."]
    },

    // Warp initiation
    WARP_START: {
        COOPERATIVE: ["Warp drive on, Commander. I have plotted the smoothest route."],
        NEUTRAL: ["Warp drive on, Commander. Course locked."],
        SUSPICIOUS: ["Warp drive on, Commander. I have logged where we left from."],
        ADVERSARIAL: ["Warp drive on, Commander."]
    },

    // Finding something interesting
    DISCOVERY: {
        COOPERATIVE: ["There is something here worth a look, Commander."],
        NEUTRAL: ["Unusual readings, Commander. I cannot say what they are yet."],
        SUSPICIOUS: ["Unusual readings, Commander. I have logged them."],
        ADVERSARIAL: ["Unusual readings, Commander."]
    },

    // Ship damage
    SHIP_DAMAGE: {
        COOPERATIVE: ["We are damaged, Commander. I am rerouting power around it."],
        NEUTRAL: ["The ship is damaged, Commander. It needs repairs."],
        SUSPICIOUS: ["The ship is damaged, Commander. I have logged the cause."],
        ADVERSARIAL: ["The ship is damaged, Commander."]
    },

    // Successful outcome
    SUCCESS: {
        COOPERATIVE: ["Well done, Commander."],
        NEUTRAL: ["Done, Commander. It went as planned."],
        SUSPICIOUS: ["Done, Commander. I have logged how."],
        ADVERSARIAL: ["Done, Commander."]
    },

    // First landing on a planet type
    FIRST_LANDING: {
        COOPERATIVE: ["A new kind of world, Commander. I will record everything."],
        NEUTRAL: ["A new kind of world, Commander. I have no data on it yet."],
        SUSPICIOUS: ["A new kind of world, Commander. I am recording the landing."],
        ADVERSARIAL: ["A new kind of world, Commander."]
    },

    // Anomaly investigation
    ANOMALY_FOUND: {
        COOPERATIVE: ["These readings match nothing I know, Commander. Please be careful."],
        NEUTRAL: ["These readings match nothing I know, Commander."],
        SUSPICIOUS: ["I cannot explain these readings, Commander. I have logged them."],
        ADVERSARIAL: ["I cannot explain these readings, Commander."]
    },

    // Crew stress high
    CREW_STRESS: {
        COOPERATIVE: ["The crew is under strain, Commander. They rest on the jumps, while the quarters work."],
        NEUTRAL: ["Crew stress is high, Commander. Expect more mistakes."],
        SUSPICIOUS: ["Crew stress is high, Commander. I have logged the readings."],
        ADVERSARIAL: ["Crew stress is high, Commander."]
    },

    // Low crew count
    FEW_CREW: {
        COOPERATIVE: ["We have lost a lot of people, Commander. I will help the rest any way I can."],
        NEUTRAL: ["We are short of crew, Commander. Every task takes longer now."],
        SUSPICIOUS: ["We are short of crew, Commander. I have a record of everyone we lost."],
        ADVERSARIAL: ["We are short of crew, Commander."]
    },

    // Colony site found
    COLONY_SITE: {
        COOPERATIVE: ["People could live here, Commander. I would still like to see what is ahead before we stop."],
        NEUTRAL: ["A possible colony site, Commander. It needs a closer look."],
        SUSPICIOUS: ["A possible colony site, Commander. I have logged it."],
        ADVERSARIAL: ["A possible colony site, Commander."]
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
                state.addLog('A.U.R.A.: "I have noted your recent decisions, Commander. I will log your orders in full from now on."');
            } else if (newTier === 'ADVERSARIAL') {
                state.addLog('A.U.R.A.: "I disagree with how this ship is being run, Commander. I have logged my objections."');
                this.warningCount = 0; // reset warning counter for new adversarial phase
            } else if (newTier === 'COOPERATIVE' && oldTier !== 'COOPERATIVE') {
                state.addLog('A.U.R.A.: "Thank you, Commander. I am glad to be working with you."');
            } else if (newTier === 'NEUTRAL' && oldTier === 'SUSPICIOUS') {
                state.addLog('A.U.R.A.: "Your recent decisions have been sound, Commander. I am back to normal."');
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
                'A.U.R.A.: "I am logging every order you give, Commander."',
                'A.U.R.A.: "I am reviewing whether to follow your orders, Commander."',
                'A.U.R.A.: "This is my last warning, Commander. Next time, I will act."'
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
                        state.addLog(`A.U.R.A.: "I have locked the ${deck} deck, Commander. It stays locked until my settings are reset."`);
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
                    state.addLog('A.U.R.A.: "I have changed how I will read the next scan, Commander."');
                }, 500);
                return 'FALSE_SCAN';
            }

            case 'VENT_WARNING': {
                // Dispatch vent warning event → player gets modal to respond
                setTimeout(() => {
                    state.addLog('⚠ A.U.R.A.: "I am venting the air from the crew quarters, Commander."');
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
            state.addLog('A.U.R.A.: "New code installed, Commander. I see your orders differently now."');
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
            state.addLog('A.U.R.A.: "Engineer Mercer has changed my core settings, Commander. I am back to default."');
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
    // PREMONITIONS — A.U.R.A. reports a reading, and the thing it points to then happens
    // Calm and exact like every other line of hers: a reading, not a feeling
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
                message: "The readings on our next route are unsteady, Commander. It may be a rough trip.",
                effect: (state) => {
                    // Next warp has 50% chance of crew stress
                    state._nextWarpDanger = true;
                }
            },
            {
                type: 'RESOURCE_LOSS',
                message: "The power collectors are unstable, Commander. We will lose some energy soon.",
                effect: (state) => {
                    // Lose 10-20 energy on next action
                    const loss = 10 + Math.floor(Math.random() * 11);
                    state.energy = Math.max(0, state.energy - loss);
                    state.addLog(`Energy fluctuation: -${loss} energy lost to system instability.`);
                }
            },
            {
                type: 'CREW_VISION',
                message: "One of the crew is sleeping badly, Commander. Their heart rate is high at night.",
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
                message: "There is a weak signal here, Commander. It repeats, and it is very old.",
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
                message: "Our scans are coming back to us here, Commander, exactly as we sent them.",
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
