
/**
 * BUNDLED APPLICATION FOR LOCAL EXECUTION
 * Merged to bypass ES Module CORS restrictions on file:// protocol.
 */

// --- TESTING MODE HELPER ---
// When TEST_MODE is enabled, biases random rolls toward rare/interesting outcomes
window.TEST_MODE = false;

/**
 * Test-aware random function.
 * - In normal mode: returns Math.random() (0-1)
 * - In test mode: returns 0.01 (forces most "rare" branches to trigger)
 * @param {string} context - Optional context for logging
 * @param {boolean} favorRare - If true, test mode returns low value (0.01), otherwise high (0.99)
 */
function testRandom(context = '', favorRare = true) {
    if (window.TEST_MODE) {
        // In test mode, force rare outcomes
        // favorRare=true means we want low rolls (for "if random < threshold" checks)
        // favorRare=false means we want high rolls (for "if random > threshold" checks)
        return favorRare ? 0.01 : 0.99;
    }
    return Math.random();
}

/**
 * Test-aware chance check.
 * @param {number} chance - Probability 0-1 (e.g., 0.1 = 10%)
 * @param {string} context - Optional logging context
 * @returns {boolean} - True if the event should happen
 */
function testChance(chance, context = '') {
    if (window.TEST_MODE) {
        // In test mode, always succeed on non-trivial chances
        return chance > 0;
    }
    return Math.random() < chance;
}

// --- 1. DATA & GENERATORS ---

class CrewGenerator {
    // Commander gets a random name; the rest are fixed characters
    static COMMANDER_FIRST = [
        "Jace", "Lyra", "Kael", "Oren", "Zara", "Thorn", "Elara", "Nia",
        "Rian", "Cora", "Sola", "Kian", "Eris", "Dax", "Luna", "Torin"
    ];
    static COMMANDER_LAST = [
        "Ryder", "Stark", "Chen", "Novak", "Price", "Solos", "Thorne", "Cross",
        "Moon", "Strider", "Frey", "Wong", "Sato", "Khan", "Webb", "Mercer"
    ];

    static generateCrew() {
        const first = this.COMMANDER_FIRST[Math.floor(Math.random() * this.COMMANDER_FIRST.length)];
        const last = this.COMMANDER_LAST[Math.floor(Math.random() * this.COMMANDER_LAST.length)];
        const cmdrGender = Math.random() > 0.5 ? 'M' : 'F';

        return [
            // Commander — random name
            {
                id: Date.now() + Math.random(),
                name: `Cmdr. ${last}`,
                realName: `${first} ${last}`,
                gender: cmdrGender,
                age: Math.floor(Math.random() * 15) + 35,
                portraitId: `${cmdrGender}_1`,
                status: 'HEALTHY',
                stress: 0,
                trait: null,
                tags: ['LEADER']
            },
            // Jaxon — Engineer
            {
                id: Date.now() + Math.random() + 1,
                name: 'Eng. Jaxon',
                realName: 'Jaxon Mercer',
                gender: 'M',
                age: 42,
                portraitId: 'M_2',
                status: 'HEALTHY',
                stress: 0,
                trait: null,
                tags: ['ENGINEER'],
                personality: 'PESSIMIST'
            },
            // Dr. Aris — Medic
            {
                id: Date.now() + Math.random() + 2,
                name: 'Dr. Aris',
                realName: 'Aris Novak',
                gender: 'F',
                age: 38,
                portraitId: 'F_3',
                status: 'HEALTHY',
                stress: 0,
                trait: null,
                tags: ['MEDIC'],
                personality: 'HUMANIST'
            },
            // Vance — Security
            {
                id: Date.now() + Math.random() + 3,
                name: 'Spc. Vance',
                realName: 'Kael Vance',
                gender: 'M',
                age: 45,
                portraitId: 'M_4',
                status: 'HEALTHY',
                stress: 0,
                trait: null,
                tags: ['SECURITY'],
                personality: 'SURVIVOR'
            },
            // Mira — Specialist
            {
                id: Date.now() + Math.random() + 4,
                name: 'Tech Mira',
                realName: 'Mira Chen',
                gender: 'F',
                age: 29,
                portraitId: 'F_5',
                status: 'HEALTHY',
                stress: 0,
                trait: null,
                tags: ['SPECIALIST'],
                personality: 'CURIOUS'
            }
        ];
    }
}





// --- 2. GAME STATE ---

class GameState {
    static instance = null;

    constructor() {
        if (GameState.instance) return GameState.instance;
        GameState.instance = this;

        this.logs = [];
        this.maxLogs = 50;
    }

    static getInstance() {
        if (!GameState.instance) {
            GameState.instance = new GameState();
        }
        return GameState.instance;
    }

    init() {
        // --- Resources (3 pillars) ---
        this.energy = 100;         // Universal action currency (cap 100)
        this.salvage = 50;         // Crafting/upgrade currency (was "metals")
        this.maxSalvage = 300;
        this.rations = 20;         // Time pressure / food supply (cap 30)
        this.maxRations = 30;

        // --- Legacy aliases for systems that still reference old names ---
        // TODO: Remove these once all systems are updated
        Object.defineProperty(this, 'metals', {
            get: () => this.salvage,
            set: (v) => { this.salvage = v; },
            configurable: true
        });
        Object.defineProperty(this, 'maxMetals', {
            get: () => this.maxSalvage,
            set: (v) => { this.maxSalvage = v; },
            configurable: true
        });

        // --- Probe ---
        this.probeIntegrity = 100;

        // --- Cargo & Upgrades ---
        this.cargo = [];
        this.upgrades = [];

        // --- Fungus Farm ---
        this.fungusActionCounter = 0; // Counts major actions; at 3, grants +1 ration

        // --- Navigation ---
        this.currentSector = 1;
        this.currentSystem = null;
        this.lastVisitedSystem = null;

        // --- Ship Decks ---
        this.shipDecks = {
            bridge:      { status: 'OPERATIONAL', repairCost: 60, label: 'BRIDGE' },
            lab:         { status: 'OPERATIONAL', repairCost: 40, label: 'LABORATORY' },
            quarters:    { status: 'OPERATIONAL', repairCost: 50, label: 'CREW QUARTERS' },
            cargo:       { status: 'OPERATIONAL', repairCost: 30, label: 'CARGO HOLD' },
            engineering: { status: 'OPERATIONAL', repairCost: 80, label: 'ENGINEERING' }
        };

        // --- Crew ---
        this.crew = CrewGenerator.generateCrew();

        // --- Action counter (for passive healing, fungus, etc.) ---
        this.actionsTaken = 0;
        this.gameOver = false;

        // --- Exodus Log collection (Phase 2) ---
        this.exodusLogsFound = [];

        // --- Colony knowledge (learned from failed colony encounters) ---
        this._colonyKnowledge = 0;

        this.emitUpdates();
    }

    addLog(message) {
        this.logs.push(message);
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }

        window.dispatchEvent(new CustomEvent('log-updated', {
            detail: { message }
        }));
    }

    consumeEnergy(amount) {
        // TEST MODE: No energy consumption
        if (window.TEST_MODE) {
            return true; // Always succeed, don't deduct
        }
        if (this.energy >= amount) {
            this.energy -= amount;
            this.emitUpdates();
            return true;
        }
        this.addLog("WARNING: Insufficient Energy!");
        return false;
    }

    /**
     * Consume 1 ration. Called on major actions (warp, EVA, sector jump).
     * Handles fungus farm counter and starvation consequences.
     * Returns true if rations were available (even if hitting 0).
     */
    consumeRation() {
        this.rations = Math.max(0, this.rations - 1);
        this.actionsTaken++;

        // Fungus farm: check if cargo has a Fungus Culture
        const hasFungus = this.cargo.some(item => item.id === 'FUNGUS_CULTURE');
        const cargoDamaged = this.shipDecks.cargo.status === 'DAMAGED';
        if (hasFungus && !cargoDamaged) {
            this.fungusActionCounter++;
            if (this.fungusActionCounter >= 3) {
                this.fungusActionCounter = 0;
                if (this.rations < this.maxRations) {
                    this.rations++;
                    this.addLog("Fungus Culture: Radiotrophic growth harvested. +1 Ration.");
                }
            }
        }

        // Passive injury healing: INJURED crew recover after 3 actions if quarters operational
        // CATATONIC crew cannot heal passively
        if (this.shipDecks.quarters.status === 'OPERATIONAL') {
            this.crew.forEach(c => {
                if (c.status === 'INJURED' && c.trait !== 'CATATONIC') {
                    c.healCounter = (c.healCounter || 0) + 1;
                    if (c.healCounter >= 3) {
                        c.status = 'HEALTHY';
                        c.healCounter = 0;
                        this.addLog(`${c.name} has recovered from injuries.`);
                    }
                }
            });
        }

        // Starvation warnings and consequences
        const livingCrew = this.crew.filter(c => c.status !== 'DEAD');
        const rationPerCrew = livingCrew.length > 0 ? this.rations / livingCrew.length : 0;

        // Warning at 5 rations
        if (this.rations === 5) {
            this.addLog("⚠ A.U.R.A.: Food reserves dropping. Rationing protocol recommended.");
        }
        // Warning at 3-4 rations
        if (this.rations >= 3 && this.rations <= 4) {
            this.addLog(`⚠ WARNING: Only ${this.rations} rations remaining for ${livingCrew.length} crew.`);
        }
        // Critical warning at 1-2 rations
        if (this.rations <= 2 && this.rations > 0) {
            this.addLog(`🔴 CRITICAL: ${this.rations} ration${this.rations > 1 ? 's' : ''} left! Crew beginning to starve.`);
            // +1 stress to all living crew
            this.crew.forEach(c => {
                if (c.status !== 'DEAD') {
                    c.stress = Math.min(3, (c.stress || 0) + 1);
                }
            });
            // A.U.R.A. low resources commentary
            if (typeof AuraSystem !== 'undefined' && window.AuraSystem) {
                window.AuraSystem.tryComment('LOW_RESOURCES', this, true);
            }
        }
        // No rations - 2 action grace period before death
        if (this.rations === 0) {
            this._starvationCounter = (this._starvationCounter || 0) + 1;

            if (this._starvationCounter === 1) {
                // First action without food - warning only
                this.addLog(`🔴 CRITICAL: No food. Crew can survive 2 more actions without eating.`);
                livingCrew.forEach(c => {
                    c.stress = Math.min(3, (c.stress || 0) + 1);
                });
            } else if (this._starvationCounter === 2) {
                // Second action without food - max stress warning
                this.addLog(`🔴 STARVATION: Crew weakening rapidly. One more action without food will be fatal.`);
                livingCrew.forEach(c => {
                    c.stress = 3; // Max stress
                });
            } else {
                // Third+ action without food - someone dies
                const maxStressedCrew = livingCrew.filter(c => (c.stress || 0) >= 3);
                const candidates = maxStressedCrew.length > 0 ? maxStressedCrew : livingCrew;

                if (candidates.length > 0) {
                    const victim = candidates[Math.floor(Math.random() * candidates.length)];
                    victim.status = 'DEAD';
                    this.addLog(`☠ DEATH: ${victim.name} has died of starvation.`);
                    window.dispatchEvent(new CustomEvent('crew-death', { detail: { crew: victim } }));
                    if (typeof BarkSystem !== 'undefined' && window.BarkSystem) {
                        window.BarkSystem.tryBark('CREW_DEATH', this, { crew: victim });
                    }
                    if (typeof AuraSystem !== 'undefined' && window.AuraSystem) {
                        window.AuraSystem.tryComment('CREW_DEATH', this, true);
                    }
                    // Reset counter so next death takes another 3 actions
                    this._starvationCounter = 0;
                }
            }
        } else {
            // Reset starvation counter when we have food
            this._starvationCounter = 0;
        }

        this.emitUpdates(); // emitUpdates() calls checkLoseConditions()
    }

    /**
     * Check if the game should end due to a lose condition.
     */
    checkLoseConditions() {
        if (this.gameOver) return; // Prevent multiple game-over triggers
        const living = this.crew.filter(c => c.status !== 'DEAD');

        // Total crew loss
        if (living.length === 0) {
            this.gameOver = true;
            window.dispatchEvent(new CustomEvent('game-over', {
                detail: {
                    type: 'CREW_LOSS',
                    title: 'ALL HANDS LOST',
                    message: 'EXODUS-9: ALL HANDS LOST. Vessel drifting. Beacon active. No response expected.'
                }
            }));
            return;
        }

        // Hull breach: 3+ decks damaged and can't afford cheapest repair
        const damagedDecks = Object.values(this.shipDecks).filter(d => d.status === 'DAMAGED');
        if (damagedDecks.length >= 3) {
            const cheapest = Math.min(...damagedDecks.map(d => d.repairCost));
            if (this.salvage < cheapest) {
                this.gameOver = true;
                window.dispatchEvent(new CustomEvent('game-over', {
                    detail: {
                        type: 'HULL_BREACH',
                        title: 'HULL BREACH',
                        message: 'The hull gave way in the night. The void was merciful — it was quick.'
                    }
                }));
            }
        }
    }

    /**
     * Damage a random operational deck. Used by sector hazards, events, etc.
     */
    damageRandomDeck() {
        const operational = Object.entries(this.shipDecks).filter(([k, v]) => v.status === 'OPERATIONAL');
        if (operational.length === 0) return null;
        const [key, deck] = operational[Math.floor(Math.random() * operational.length)];
        deck.status = 'DAMAGED';
        this.addLog(`HULL BREACH: ${deck.label} has taken damage! Systems offline.`);
        this.emitUpdates(); // emitUpdates() calls checkLoseConditions()
        return key;
    }

    /**
     * Repair a specific deck.
     */
    repairDeck(deckKey) {
        const deck = this.shipDecks[deckKey];
        if (!deck || deck.status === 'OPERATIONAL') return false;

        let cost = deck.repairCost;
        // Jaxon (Engineer) alive: -30% repair cost
        const jaxonAlive = this.crew.some(c => c.tags.includes('ENGINEER') && c.status !== 'DEAD');
        if (jaxonAlive) cost = Math.floor(cost * 0.7);
        // Engineering damaged: +50% cost
        if (deckKey !== 'engineering' && this.shipDecks.engineering.status === 'DAMAGED') {
            cost = Math.floor(cost * 1.5);
        }

        if (this.salvage >= cost) {
            this.salvage -= cost;
            deck.status = 'OPERATIONAL';
            this.addLog(`REPAIR COMPLETE: ${deck.label} restored to operational status. (-${cost} Salvage)`);
            this.emitUpdates();
            return true;
        }
        this.addLog(`Insufficient Salvage for repair. Need ${cost}, have ${this.salvage}.`);
        return false;
    }

    /**
     * Check if a specific deck is operational.
     */
    isDeckOperational(deckKey) {
        return this.shipDecks[deckKey]?.status === 'OPERATIONAL';
    }

    /**
     * Apply stress traits when crew hit stress level 2, and trigger breakdowns at stress 3.
     * Called after any stress change.
     */
    applyStressTraits() {
        this.crew.forEach(c => {
            if (c.status === 'DEAD') return;
            const stress = c.stress || 0;

            // Stress 2: Assign personality-based negative trait
            if (stress >= 2 && !c.trait) {
                switch (c.personality) {
                    case 'PESSIMIST':  // Jaxon
                        c.trait = 'HOARDER';
                        this.addLog(`${c.name}: "We can't afford to waste salvage. Not here. Not now."`);
                        break;
                    case 'SURVIVOR':   // Vance
                        c.trait = 'PARANOID';
                        this.addLog(`${c.name}: "I'm not sending anyone into that deathtrap."`);
                        break;
                    case 'HUMANIST':   // Aris
                        c.trait = 'BLEEDING_HEART';
                        this.addLog(`${c.name}: "I won't leave anyone behind. No EVA until everyone is stable."`);
                        break;
                    case 'CURIOUS':    // Mira
                        c.trait = 'RECKLESS';
                        this.addLog(`${c.name}: "Safe option? Where's the data in safe?"`);
                        break;
                    default: break;    // Commander has no stress 2 trait
                }
                // A.U.R.A. comments on crew stress
                if (typeof AuraSystem !== 'undefined' && window.AuraSystem) {
                    window.AuraSystem.tryComment('CREW_STRESS', this);
                }
            }

            // Stress 3: Breakdown events (fire once)
            if (stress >= 3 && !c.breakdownFired) {
                c.breakdownFired = true;
                this.triggerBreakdown(c);
            }

            // Remove trait if stress drops below 2
            if (stress < 2 && c.trait) {
                this.addLog(`${c.name} has calmed down. Negative behavior subsiding.`);
                c.trait = null;
                c.breakdownFired = false;
            }
        });
    }

    /**
     * Trigger a crew member's stress 3 breakdown event.
     */
    triggerBreakdown(crewMember) {
        const c = crewMember;

        // Commander breakdown = game over
        if (c.tags.includes('LEADER')) {
            this.gameOver = true;
            window.dispatchEvent(new CustomEvent('game-over', {
                detail: {
                    type: 'COMMANDER_BREAKDOWN',
                    title: 'COMMAND FAILURE',
                    message: `Commander ${c.realName.split(' ')[1]} has suffered a complete psychological breakdown. Command chain shattered. The crew is lost without leadership.`
                }
            }));
            return;
        }

        switch (c.personality) {
            case 'PESSIMIST': // Jaxon — Sabotage: damages a random deck
                this.addLog(`ALERT: ${c.name} has sabotaged ship systems in a paranoid episode!`);
                this.damageRandomDeck();
                c.stress = 2; // Reset after breakdown, damage is done
                break;

            case 'HUMANIST': // Aris — Goes catatonic
                c.status = 'INJURED';
                c.trait = 'CATATONIC';
                this.addLog(`Dr. Aris has gone catatonic. She stares at the wall, unresponsive. Medical services unavailable.`);
                // Stress stays high — she's catatonic, not recovering
                break;

            case 'SURVIVOR': // Vance — Mutiny: confronts Commander
                this.addLog(`CRITICAL: Spc. Vance has drawn his sidearm. He demands the Commander step down.`);
                // Mutiny handler will reset Vance's stress based on outcome
                setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('crew-mutiny', { detail: { instigator: c } }));
                }, 100);
                break;

            case 'CURIOUS': // Mira — Obsessed: EVA costs double but extra loot
                c.trait = 'OBSESSED';
                this.addLog(`Tech Mira has become dangerously obsessed. She demands extended EVA time regardless of risk.`);
                c.stress = 2; // Reset after breakdown
                break;
        }
    }

    /**
     * Check if any living crew member has a specific trait active.
     */
    hasActiveTrait(traitName) {
        return this.crew.some(c => c.status !== 'DEAD' && c.trait === traitName);
    }

    emitUpdates() {
        this.applyStressTraits();
        this.checkLoseConditions();
        window.dispatchEvent(new Event('hud-updated'));
    }
}







// --- 4. MAIN APP ---

class App {
    constructor() {
        this.state = GameState.getInstance();
        this.navView = new NavView(this.state);
        this.orbitView = new OrbitView(this.state);

        this.init();
    }

    init() {
        console.log("Exodus-9 Systems Initializing...");

        if (window.AudioSystem) window.AudioSystem.init();

        window.addEventListener('log-updated', (e) => this.handleLogUpdate(e));

        window.addEventListener('hud-updated', () => this.updateHud());

        // Audio Toggle - Click to show volume modal
        const btnAudio = document.getElementById('btn-audio');
        if (btnAudio) {
            btnAudio.onclick = () => this.showAudioModal();
        }

        // Testing Mode Toggle
        const btnTesting = document.getElementById('btn-testing');
        if (btnTesting) {
            btnTesting.onclick = () => {
                window.TEST_MODE = !window.TEST_MODE;
                btnTesting.textContent = window.TEST_MODE ? "TEST MODE: ON" : "TEST MODE: OFF";
                btnTesting.style.opacity = window.TEST_MODE ? "1" : "0.7";
                btnTesting.style.borderColor = window.TEST_MODE ? "#ff0000" : "#ff6600";
                btnTesting.style.color = window.TEST_MODE ? "#ff0000" : "#ff6600";
                this.state.addLog(window.TEST_MODE
                    ? "/// TESTING MODE ENABLED /// All random events will favor rare outcomes."
                    : "/// TESTING MODE DISABLED /// Normal probabilities restored.");
            };
        }

        // Header Interactions
        const fabBtn = document.getElementById('btn-fab');
        if (fabBtn) fabBtn.onclick = () => this.showFabricator();

        window.addEventListener('req-warp', (e) => this.handleWarp(e.detail));
        window.addEventListener('req-sector-jump', () => this.handleSectorJump());
        window.addEventListener('req-action-scan', () => this.handleScanAction());
        window.addEventListener('req-action-probe', () => this.handleProbeAction());
        window.addEventListener('req-action-eva', () => this.handleEvaAction());
        window.addEventListener('req-action-colony', () => this.handleColonyAction());
        window.addEventListener('req-action-exodus', () => this.handleExodusAction());
        window.addEventListener('req-action-colony-site', () => this.handleFailedColonyAction());
        window.addEventListener('req-action-derelict', () => this.handleDerelictAction());
        window.addEventListener('req-action-anomaly', () => this.handleAnomalyAction());
        window.addEventListener('req-action-lighthouse', () => this.handleLateGamePOI('LIGHTHOUSE'));
        window.addEventListener('req-action-garden', () => this.handleLateGamePOI('GARDEN'));
        window.addEventListener('req-action-grave', () => this.handleLateGamePOI('GRAVE'));
        window.addEventListener('req-action-structure', () => this.handleStructureAction());
        window.addEventListener('aura-vent-warning', () => this.showAuraVentModal());
        window.addEventListener('req-break-orbit', () => {
            this.state.addLog("Breaking orbit. Systems disengaged.");
            this.renderNav();
        });

        // THE WRONG PLACE special handlers
        window.addEventListener('req-wrong-escape', () => this.handleWrongPlaceEscape());
        window.addEventListener('req-wrong-accept', () => this.handleWrongPlaceAccept());

        window.addEventListener('req-remote-scan', (e) => this.handleRemoteScan(e.detail));
        window.addEventListener('req-remote-probe', (e) => this.handleRemoteProbe(e.detail));

        // Ship deck click handlers
        document.querySelectorAll('.ship-deck').forEach(deckEl => {
            deckEl.style.cursor = 'pointer';
            deckEl.addEventListener('click', () => {
                const room = deckEl.dataset.room;
                this.showDeckDetail(room);
            });
        });

        // Game Over handler
        window.addEventListener('game-over', (e) => this.showGameOver(e.detail));

        // Mutiny handler (Vance stress 3 breakdown)
        window.addEventListener('crew-mutiny', (e) => this.showMutinyEvent(e.detail));

        // Anomaly teleportation handler (visual effect + view refresh)
        window.addEventListener('anomaly-teleport', (e) => this.handleAnomalyTeleport(e.detail));

        this.state.init();
        this.state.sectorNodes = PlanetGenerator.generateSector(1);
        this.state.addLog("Sector 1 Map Generated.");
        this.renderNav();
        this.state.addLog("System Init Complete. Awaiting Navigation Input.");
    }

    handleWarp(planet) {
        // Free warp if returning to the last visited system (simulating orbit re-entry)
        let cost = planet.fuelCost;
        // Bridge damaged: +50% warp cost
        if (!this.state.isDeckOperational('bridge')) {
            cost = Math.floor(cost * 1.5);
        }
        if (this.state.lastVisitedSystem && this.state.lastVisitedSystem.id === planet.id) {
            cost = 0;
            this.state.addLog("Orbit re-entry trajectory calculated. Energy cost negligible.");
        }

        if (this.state.consumeEnergy(cost)) {
            this.state.addLog(`Warping to ${planet.name}...`);

            // A.U.R.A. commentary on warp initiation
            if (typeof AuraSystem !== 'undefined' && window.AuraSystem) {
                window.AuraSystem.tryComment('WARP_START', this.state);
            }

            this.state.currentSystem = planet;
            this.state.lastVisitedSystem = planet;

            // Consume 1 ration (major action)
            this.state.consumeRation();

            // AMBIENT ENERGY COLLECTION: Ship collectors absorb local radiation on arrival
            // Returns a percentage of warp cost based on destination type
            if (cost > 0) {
                let returnPercent = 0.5; // Default 50%
                let returnReason = 'solar radiation';

                // Adjust based on planet type
                if (planet.type === 'GAS_GIANT') {
                    returnPercent = 0.75; // Gas giants emit lots of energy
                    returnReason = 'atmospheric discharge';
                } else if (['VOLCANIC', 'SHATTERED'].includes(planet.type)) {
                    returnPercent = 0.65; // Geothermal/core energy
                    returnReason = 'thermal emissions';
                } else if (['CRYSTALLINE', 'SINGING'].includes(planet.type)) {
                    returnPercent = 0.60; // Resonant energy
                    returnReason = 'harmonic resonance';
                } else if (['ROGUE', 'ICE_WORLD'].includes(planet.type)) {
                    returnPercent = 0.35; // Cold, far from stars
                    returnReason = 'minimal ambient radiation';
                } else if (['VITAL', 'TERRAFORMED', 'OCEANIC'].includes(planet.type)) {
                    returnPercent = 0.55; // Stable systems
                    returnReason = 'stellar proximity';
                } else if (['MECHA', 'GRAVEYARD'].includes(planet.type)) {
                    returnPercent = 0.45; // Residual tech energy
                    returnReason = 'residual power signatures';
                }

                // Some variance (±10%)
                const variance = (Math.random() * 0.2) - 0.1;
                returnPercent = Math.max(0.25, Math.min(0.80, returnPercent + variance));

                const energyReturn = Math.floor(cost * returnPercent);
                if (energyReturn > 0) {
                    this.state.energy = Math.min(100, this.state.energy + energyReturn);
                    this.state.addLog(`Collectors absorbed ${energyReturn} energy from ${returnReason}.`);
                }
            }

            // UPGRADE: Autodoc — heals crew during transit (separate from quarters passive heal)
            if (this.state.upgrades.includes('autodoc')) {
                let healed = false;
                this.state.crew.forEach(c => {
                    if (c.status === 'INJURED') {
                        c.status = 'HEALTHY';
                        c.healCounter = 0;
                        healed = true;
                    }
                });
                if (healed) this.state.addLog("Autodoc: Crew injuries stabilized during transit.");
            }

            // UPGRADE: Fuel Scoop — BONUS energy on top of ambient collection for gas giants
            if (this.state.upgrades.includes('fuel_scoop') && (planet.type === 'GAS_GIANT' || planet.type === 'NEBULA')) {
                const scoop = Math.floor(Math.random() * 8) + 8; // 8-15 bonus
                this.state.energy = Math.min(100, this.state.energy + scoop);
                this.state.addLog(`Bussard Scoop: Harvested additional ${scoop} Energy from atmosphere.`);
            }

            // Dangerous planet stress: dangerLevel 2+ → +1 stress to a random crew member
            if ((planet.dangerLevel || 0) >= 2) {
                const living = this.state.crew.filter(c => c.status !== 'DEAD');
                if (living.length > 0) {
                    const victim = living[Math.floor(Math.random() * living.length)];
                    victim.stress = Math.min(3, (victim.stress || 0) + 1);
                    this.state.addLog(`${victim.name}: Unsettled by hostile readings.`);
                }
            }

            // Sector hazards during warp — delegated to SECTOR_CONFIG
            const warpConfig = (typeof SECTOR_CONFIG !== 'undefined') ? SECTOR_CONFIG[this.state.currentSector] : null;
            if (warpConfig && warpConfig.hazard && warpConfig.hazard.onWarp) {
                warpConfig.hazard.onWarp(this.state);
            }

            // Ship malfunction check during warp
            if (typeof rollShipMalfunction !== 'undefined') {
                const malfunction = rollShipMalfunction(this.state, 'warp');
                if (malfunction) {
                    this.showShipMalfunctionModal(malfunction);
                }
            }

            // Process sedated/confined crew recovery
            this.state.crew.forEach(c => {
                if (c.tags && c.tags.includes('SEDATED') && c._sedatedUntilWarp !== undefined) {
                    c._sedatedUntilWarp--;
                    if (c._sedatedUntilWarp <= 0) {
                        // Remove sedation
                        c.tags = c.tags.filter(t => t !== 'SEDATED');
                        delete c._sedatedUntilWarp;
                        this.state.addLog(`${c.name} has recovered from sedation. Cleared for duty.`);
                    } else {
                        this.state.addLog(`${c.name} remains sedated. ${c._sedatedUntilWarp} warps until recovery.`);
                    }
                }
            });

            // Bark: crew reacts to entering orbit
            if (typeof BarkSystem !== 'undefined' && window.BarkSystem) {
                window.BarkSystem.checkPlanetBarks(this.state, planet);
                // If no special bark fired, fire generic ENTER_ORBIT
                setTimeout(() => window.BarkSystem.tryBark('ENTER_ORBIT', this.state, { planet }), 50);
            }

            // A.U.R.A. commentary on orbit entry
            if (typeof AuraSystem !== 'undefined' && window.AuraSystem) {
                window.AuraSystem.tryComment('ENTER_ORBIT', this.state);
                window.AuraSystem.checkAdversarialAction(this.state);

                // Trigger any pending premonition effects
                const premonitionResult = window.AuraSystem.triggerPremonition(this.state);
                if (premonitionResult) {
                    this.state.addLog(`[A.U.R.A.'s warning proved prophetic...]`);
                }

                // Maybe generate a new premonition for next action
                window.AuraSystem.generatePremonition(this.state);
            }

            // Resource barks check
            if (typeof BarkSystem !== 'undefined' && window.BarkSystem) {
                setTimeout(() => window.BarkSystem.checkResourceBarks(this.state), 600);
            }

            setTimeout(() => {
                this.state.addLog(`Orbit established. Systems Green.`);
                this.renderOrbit();
            }, 1000);
        }
    }

    handleRemoteScan(planet) {
        // Bridge must be operational for remote scan
        if (!this.state.isDeckOperational('bridge')) {
            this.state.addLog("BRIDGE OFFLINE: Remote scanning unavailable.");
            return;
        }
        if (this.state.consumeEnergy(2)) {
            const data = this.state.sectorNodes.find(p => p.id === planet.id);
            if (data) {
                data.remoteScanned = true;

                // S3 INTERFERENCE hook — may corrupt scan data (can show false resource levels)
                const scanConfig = (typeof SECTOR_CONFIG !== 'undefined') ? SECTOR_CONFIG[this.state.currentSector] : null;
                if (scanConfig && scanConfig.hazard && scanConfig.hazard.onScan) {
                    scanConfig.hazard.onScan(data, this.state);
                }

                // A.U.R.A. false scan override (adversarial action) — corrupts resource readings
                if (this.state._auraFalseScan) {
                    data._realResources = data._realResources || { ...data.resources };
                    data.resources = {
                        metals: Math.floor(Math.random() * 100),
                        energy: Math.floor(Math.random() * 100)
                    };
                    data._scanCorrupted = true;
                    this.state._auraFalseScan = false;
                    this.state.addLog(`A.U.R.A.: "Scan complete. All readings nominal." [READINGS UNRELIABLE]`);
                }

                // Build signal summary for log
                const signals = [];
                if (data.metrics?.hasLife || ['VITAL', 'BIO_MASS', 'SYMBIOTE_WORLD', 'SINGING'].includes(data.type)) signals.push('BIO');
                if (data.metrics?.hasTech || ['MECHA', 'TERRAFORMED', 'MIRROR'].includes(data.type)) signals.push('TECH');
                if (data.tags?.includes('WRECKAGE') || data.tags?.includes('EXODUS_WRECK')) signals.push('WRECKAGE');
                if (data.tags?.includes('FAILED_COLONY')) signals.push('COLONY');

                const signalStr = signals.length > 0 ? signals.join(', ') : 'none';
                const metalLevel = data.resources?.metals >= 70 ? 'HIGH' : (data.resources?.metals >= 40 ? 'MODERATE' : 'LOW');
                const energyLevel = data.resources?.energy >= 70 ? 'HIGH' : (data.resources?.energy >= 40 ? 'MODERATE' : 'LOW');

                this.state.addLog(`Long-range scan: ${planet.name}. Salvage: ${metalLevel}. Energy: ${energyLevel}. Signals: ${signalStr}.`);

                // Force re-render of right panel
                this.navView.handlePlanetSelect(data);
            }
        }
    }

    handleSectorJump() {
        let jumpCost = 20;
        // Engineering damaged: sector jump cost doubled
        if (!this.state.isDeckOperational('engineering')) {
            jumpCost = 40;
        }
        // Drive reinforcement discount (from Jaxon campfire event)
        if (this.state._driveReinforced) {
            const discount = Math.floor(jumpCost * 0.2); // 20% off
            jumpCost -= discount;
            this.state.addLog(`Drive reinforcement active: Jump cost reduced by ${discount} energy.`);
            this.state._driveReinforced = false; // Single use
        }
        if (this.state.consumeEnergy(jumpCost)) {
            this.state.addLog("Initiating Sector Jump...");

            // Consume 1 ration (major action)
            this.state.consumeRation();

            // Passive stress recovery on sector jump (if quarters operational)
            if (this.state.isDeckOperational('quarters')) {
                this.state.crew.forEach(c => {
                    if (c.status !== 'DEAD' && c.stress > 0) {
                        c.stress--;
                    }
                });
                this.state.addLog("Crew Quarters: Rest cycle complete. Stress levels reduced.");
            }

            // Ship malfunction check during sector jump (higher chance)
            if (typeof rollShipMalfunction !== 'undefined') {
                const malfunction = rollShipMalfunction(this.state, 'sector_jump');
                if (malfunction) {
                    this.showShipMalfunctionModal(malfunction);
                }
            }

            // Bark: crew reacts to sector jump
            if (typeof BarkSystem !== 'undefined' && window.BarkSystem) {
                window.BarkSystem.tryBark('SECTOR_JUMP', this.state);
            }

            // A.U.R.A. sector jump commentary
            if (typeof AuraSystem !== 'undefined' && window.AuraSystem) {
                window.AuraSystem.tryComment('SECTOR_JUMP', this.state);
            }

            // Show campfire event before generating new sector
            this.showCampfireEvent(() => {
                const nextSector = this.state.currentSector + 1;
                this.state.sectorNodes = PlanetGenerator.generateSector(nextSector);
                this.state.currentSector = nextSector;
                this.state.lastVisitedSystem = null;

                // Sector enter hazard (e.g., S3 ghost planets) — pass state for ghost planet logging
                const enterConfig = (typeof SECTOR_CONFIG !== 'undefined') ? SECTOR_CONFIG[nextSector] : null;
                if (enterConfig && enterConfig.hazard && enterConfig.hazard.onSectorEnter) {
                    enterConfig.hazard.onSectorEnter(this.state, this.state.sectorNodes);
                }

                this.renderNav();

                // Sector name from config
                const sectorName = enterConfig ? enterConfig.name : '';
                this.state.addLog(`Sector ${nextSector} Generated.${sectorName ? ' — ' + sectorName : ''}`);

                // Dispatch sector entered event for audio
                window.dispatchEvent(new CustomEvent('sector-entered', { detail: { sector: nextSector } }));

                // Special barks for sector entries
                if (typeof BarkSystem !== 'undefined' && window.BarkSystem) {
                    if (nextSector === 3) {
                        window.BarkSystem.tryBark('SECTOR_3_ENTRY', this.state);
                    } else if (nextSector === 5) {
                        window.BarkSystem.tryBark('SECTOR_5_ENTRY', this.state);
                    }
                }
            });
        }
    }

    showCampfireEvent(onComplete) {
        // TEST_MODE: Skip campfire events entirely for faster testing
        if (window.TEST_MODE) {
            this.state.addLog("[TEST MODE] Skipping campfire event...");
            onComplete();
            return;
        }

        // Find eligible campfire events for current sector transition
        const fromSector = this.state.currentSector;
        const toSector = fromSector + 1;

        const eligible = (typeof CAMPFIRE_EVENTS !== 'undefined' ? CAMPFIRE_EVENTS : []).filter(e => {
            if (fromSector < e.sectorRange[0] || fromSector > e.sectorRange[1]) return false;
            if (e.condition && !e.condition(this.state)) return false;
            return true;
        });

        if (eligible.length === 0) {
            onComplete();
            return;
        }

        // Pick one randomly from eligible
        const event = eligible[Math.floor(Math.random() * eligible.length)];

        // Sector names — pull from SECTOR_CONFIG or fallback
        const SECTOR_NAMES = {};
        if (typeof SECTOR_CONFIG !== 'undefined') {
            for (let s = 1; s <= 5; s++) {
                SECTOR_NAMES[s] = SECTOR_CONFIG[s] ? SECTOR_CONFIG[s].name : '???';
            }
        } else {
            Object.assign(SECTOR_NAMES, { 1: 'THE GRAVEYARD', 2: 'THE DARK VOID', 3: 'THE SIGNAL', 4: 'THE GARDEN', 5: 'THE EVENT HORIZON' });
        }

        // Use narrative modal system if available for immersive experience
        if (window.NarrativeModal) {
            const sectorHeader = `[whisper]S${fromSector}: ${SECTOR_NAMES[fromSector] || '???'} → S${toSector}: ${SECTOR_NAMES[toSector] || '???'}[/whisper]`;
            this.showNarrativeEncounter({
                title: event.title,
                speaker: 'NARRATOR',
                context: `[highlight]${event.title}[/highlight]\n${sectorHeader}\n\n${event.context}`,
                dialogue: event.dialogue,
                choices: event.choices,
                onChoiceMade: () => {
                    onComplete();
                }
            });
            return;
        }

        // Fallback to old modal system
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.zIndex = '2500';

        modal.innerHTML = `
            <div class="modal-content" style="border-color: #4488ff; max-width: 650px;">
                <div class="modal-header" style="background: linear-gradient(90deg, #001133, #002266); color: #4488ff; display: flex; justify-content: space-between;">
                    <span>/// INTER-SECTOR DRIFT ///</span>
                    <span style="opacity: 0.7;">S${fromSector}: ${SECTOR_NAMES[fromSector] || '???'} → S${toSector}: ${SECTOR_NAMES[toSector] || '???'}</span>
                </div>
                <div style="padding: 25px;">
                    <div style="font-size: 1.1em; font-weight: bold; color: #4488ff; margin-bottom: 15px;">${event.title}</div>
                    <div style="font-size: 0.9em; color: var(--color-text-dim); margin-bottom: 20px; line-height: 1.6; font-style: italic;">
                        ${event.context}
                    </div>
                    <div style="border-left: 2px solid #333; padding-left: 15px; margin-bottom: 20px;">
                        ${event.dialogue.filter(d => {
                            // Filter out dead crew members from dialogue
                            if (d.speaker === 'A.U.R.A.') return true;
                            const speakerMap = {
                                'Eng. Jaxon': 'ENGINEER', 'Dr. Aris': 'MEDIC',
                                'Spc. Vance': 'SECURITY', 'Tech Mira': 'SPECIALIST'
                            };
                            const tag = speakerMap[d.speaker];
                            if (tag) {
                                const member = this.state.crew.find(c => c.tags.includes(tag));
                                return member && member.status !== 'DEAD';
                            }
                            if (d.speaker.startsWith('Cmdr.')) {
                                const cmdr = this.state.crew.find(c => c.tags.includes('LEADER'));
                                return cmdr && cmdr.status !== 'DEAD';
                            }
                            return true;
                        }).map(d => {
                            const colors = {
                                'Eng. Jaxon': '#f0a030', 'Dr. Aris': '#40c8ff', 'Spc. Vance': '#ff5050',
                                'Tech Mira': '#d070ff', 'A.U.R.A.': '#00ff88'
                            };
                            const portraits = {
                                'Eng. Jaxon': 'M_2', 'Dr. Aris': 'F_3', 'Spc. Vance': 'M_4',
                                'Tech Mira': 'F_5', 'A.U.R.A.': null
                            };
                            const color = colors[d.speaker] || '#ffffff';
                            const portraitId = portraits[d.speaker];
                            // Commander: find their portrait dynamically
                            const cmdr = this.state.crew.find(c => c.tags.includes('LEADER'));
                            const isCmdr = d.speaker.startsWith('Cmdr.');
                            const pId = isCmdr ? (cmdr ? cmdr.portraitId : null) : portraitId;
                            const speakerColor = isCmdr ? '#ffffff' : color;
                            const portraitHtml = pId
                                ? `<img src="assets/crew/${pId}.png" style="width:28px;height:28px;border-radius:50%;border:1px solid ${speakerColor};object-fit:cover;vertical-align:middle;margin-right:6px;" onerror="this.style.display='none'">`
                                : (d.speaker === 'A.U.R.A.' ? `<span style="display:inline-block;width:28px;height:28px;border-radius:50%;border:1px solid #00ff88;text-align:center;line-height:28px;font-size:12px;margin-right:6px;vertical-align:middle;background:#001a0a;">AI</span>` : '');
                            return `<div style="margin-bottom: 12px; display: flex; align-items: flex-start; gap: 8px;">
                                <div style="flex-shrink: 0; padding-top: 2px;">${portraitHtml}</div>
                                <div>
                                    <span style="color:${speakerColor}; font-weight: bold;">${d.speaker}:</span>
                                    <span style="color:${speakerColor}; opacity: 0.85; font-style: italic;"> "${d.text}"</span>
                                </div>
                            </div>`;
                        }).join('')}
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        ${event.choices.map((choice, idx) => `
                            <button class="campfire-choice" data-idx="${idx}" style="
                                padding: 12px 15px; text-align: left;
                                border: 1px solid #4488ff; background: rgba(0,20,60,0.8);
                                color: #4488ff; cursor: pointer; font-family: var(--font-mono);
                                transition: all 0.2s;
                            ">
                                <div style="font-weight: bold;">${choice.text}</div>
                                <div style="font-size: 0.8em; margin-top: 4px; color: var(--color-text-dim);">${choice.desc}</div>
                            </button>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Hover effects
        modal.querySelectorAll('.campfire-choice').forEach(btn => {
            btn.onmouseenter = () => { btn.style.background = 'rgba(0,40,120,0.8)'; btn.style.borderColor = '#66aaff'; };
            btn.onmouseleave = () => { btn.style.background = 'rgba(0,20,60,0.8)'; btn.style.borderColor = '#4488ff'; };
            btn.onclick = () => {
                const choice = event.choices[parseInt(btn.dataset.idx)];
                const resultMsg = choice.effect(this.state);
                this.state.addLog(resultMsg);
                this.state.emitUpdates();
                modal.remove();
                onComplete();
            };
        });
    }

    handleExodusAction() {
        const planet = this.state.currentSystem;
        if (!planet || !planet.tags || !planet.tags.includes('EXODUS_WRECK')) {
            this.state.addLog("No Exodus wreck signal detected at this location.");
            return;
        }
        if (planet.exodusInvestigated) {
            this.state.addLog("Exodus wreck already investigated.");
            return;
        }

        // Select encounter by weighted random - avoid duplicates
        const allEncounters = (typeof EXODUS_ENCOUNTERS !== 'undefined') ? EXODUS_ENCOUNTERS : [];
        if (allEncounters.length === 0) {
            this.state.addLog("ERROR: Exodus encounter data unavailable.");
            return;
        }

        // Track encountered types to avoid repetition
        this.state._encounteredExodus = this.state._encounteredExodus || [];

        // Filter out already encountered types (if we have options)
        let encounters = allEncounters.filter(e => !this.state._encounteredExodus.includes(e.id));
        if (encounters.length === 0) {
            // All encountered, reset but still use all
            encounters = allEncounters;
            this.state.addLog("A.U.R.A.: Similar wreck configuration detected. We've seen this pattern before.");
        }

        const totalWeight = encounters.reduce((sum, e) => sum + e.weight, 0);
        let roll = Math.random() * totalWeight;
        let selected = encounters[0];
        for (const enc of encounters) {
            roll -= enc.weight;
            if (roll <= 0) { selected = enc; break; }
        }

        // Mark this encounter type as seen
        if (!this.state._encounteredExodus.includes(selected.id)) {
            this.state._encounteredExodus.push(selected.id);
        }

        // Get unique ship name - avoid using the same ship twice
        this.state._encounteredShipNames = this.state._encounteredShipNames || [];
        let shipName = selected.getShipName();
        let attempts = 0;
        while (this.state._encounteredShipNames.includes(shipName) && attempts < 10) {
            shipName = selected.getShipName();
            attempts++;
        }
        this.state._encounteredShipNames.push(shipName);
        // Bark: crew reacts to Exodus wreck
        if (typeof BarkSystem !== 'undefined' && window.BarkSystem) {
            window.BarkSystem.tryBark('EXODUS_FOUND', this.state, { planet });
        }

        this.state.addLog(`Exodus transponder locked. Deploying team to investigate...`);
        this.state.consumeRation(); // Major action

        // Mark as investigated immediately to prevent re-clicking
        planet.exodusInvestigated = true;

        // Use narrative modal system if available for immersive experience
        if (window.NarrativeModal) {
            this.showNarrativeEncounter({
                title: selected.title,
                speaker: 'NARRATOR',
                context: `[highlight]${shipName}[/highlight]\n\n${selected.context(shipName)}`,
                dialogue: selected.dialogue,
                choices: selected.choices,
                onChoiceMade: () => {
                    this.orbitView.updateCommandDeck(planet);
                }
            });
            return;
        }

        // Fallback to old modal system
        this.showExodusModal(selected, shipName, planet);
    }

    showExodusModal(encounter, shipName, planet) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.zIndex = '2500';

        const portraits = {
            'Eng. Jaxon': 'M_2', 'Dr. Aris': 'F_3', 'Spc. Vance': 'M_4',
            'Tech Mira': 'F_5', 'A.U.R.A.': null
        };
        const colors = {
            'Eng. Jaxon': '#f0a030', 'Dr. Aris': '#40c8ff', 'Spc. Vance': '#ff5050',
            'Tech Mira': '#d070ff', 'A.U.R.A.': '#00ff88'
        };

        modal.innerHTML = `
            <div class="modal-content" style="border-color: #ff8800; max-width: 680px;">
                <div class="modal-header" style="background: linear-gradient(90deg, #331a00, #663300); color: #ff8800; display: flex; justify-content: space-between;">
                    <span>/// EXODUS WRECK: ${encounter.title} ///</span>
                    <span style="opacity: 0.7;">${shipName}</span>
                </div>
                <div style="padding: 25px;">
                    <div style="font-size: 0.9em; color: var(--color-text-dim); margin-bottom: 20px; line-height: 1.6; font-style: italic;">
                        ${encounter.context(shipName)}
                    </div>
                    <div style="border-left: 2px solid #663300; padding-left: 15px; margin-bottom: 20px;">
                        ${encounter.dialogue.filter(d => {
                            if (d.speaker === 'A.U.R.A.') return true;
                            const speakerMap = {
                                'Eng. Jaxon': 'ENGINEER', 'Dr. Aris': 'MEDIC',
                                'Spc. Vance': 'SECURITY', 'Tech Mira': 'SPECIALIST'
                            };
                            const tag = speakerMap[d.speaker];
                            if (tag) {
                                const member = this.state.crew.find(c => c.tags.includes(tag));
                                return member && member.status !== 'DEAD';
                            }
                            return true;
                        }).map(d => {
                            const color = colors[d.speaker] || '#ffffff';
                            const pId = portraits[d.speaker];
                            const portraitHtml = pId
                                ? `<img src="assets/crew/${pId}.png" style="width:28px;height:28px;border-radius:50%;border:1px solid ${color};object-fit:cover;vertical-align:middle;margin-right:6px;" onerror="this.style.display='none'">`
                                : (d.speaker === 'A.U.R.A.' ? `<span style="display:inline-block;width:28px;height:28px;border-radius:50%;border:1px solid #00ff88;text-align:center;line-height:28px;font-size:12px;margin-right:6px;vertical-align:middle;background:#001a0a;">AI</span>` : '');
                            return `<div style="margin-bottom: 12px; display: flex; align-items: flex-start; gap: 8px;">
                                <div style="flex-shrink: 0; padding-top: 2px;">${portraitHtml}</div>
                                <div>
                                    <span style="color:${color}; font-weight: bold;">${d.speaker}:</span>
                                    <span style="color:${color}; opacity: 0.85; font-style: italic;"> "${d.text}"</span>
                                </div>
                            </div>`;
                        }).join('')}
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        ${encounter.choices.map((choice, idx) => `
                            <button class="exodus-choice" data-idx="${idx}" style="
                                padding: 12px 15px; text-align: left;
                                border: 1px solid #ff8800; background: rgba(40,20,0,0.8);
                                color: #ff8800; cursor: pointer; font-family: var(--font-mono);
                                transition: all 0.2s;
                            ">
                                <div style="font-weight: bold;">${choice.text}</div>
                                <div style="font-size: 0.8em; margin-top: 4px; color: var(--color-text-dim);">${choice.desc}</div>
                            </button>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Hover effects and click handlers
        modal.querySelectorAll('.exodus-choice').forEach(btn => {
            btn.onmouseenter = () => { btn.style.background = 'rgba(80,40,0,0.8)'; btn.style.borderColor = '#ffaa33'; };
            btn.onmouseleave = () => { btn.style.background = 'rgba(40,20,0,0.8)'; btn.style.borderColor = '#ff8800'; };
            btn.onclick = () => {
                const choice = encounter.choices[parseInt(btn.dataset.idx)];
                const resultMsg = choice.effect(this.state);
                this.state.addLog(resultMsg);

                // Mark as investigated
                planet.exodusInvestigated = true;

                this.state.emitUpdates();
                modal.remove();

                // Refresh command deck to show investigated state
                this.orbitView.updateCommandDeck(planet);
            };
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // FAILED COLONY ENCOUNTER — investigate FAILED_COLONY tag
    // ═══════════════════════════════════════════════════════════════
    handleFailedColonyAction() {
        const planet = this.state.currentSystem;
        if (!planet || !planet.tags || !planet.tags.includes('FAILED_COLONY')) {
            this.state.addLog("No colony ruins detected at this location.");
            return;
        }
        if (planet.colonyInvestigated) {
            this.state.addLog("Colony ruins already investigated.");
            return;
        }

        const encounters = (typeof FAILED_COLONY_ENCOUNTERS !== 'undefined') ? FAILED_COLONY_ENCOUNTERS : [];
        if (encounters.length === 0) {
            this.state.addLog("ERROR: Colony encounter data unavailable.");
            return;
        }

        // Select by weight
        const totalWeight = encounters.reduce((sum, e) => sum + e.weight, 0);
        let roll = Math.random() * totalWeight;
        let selected = encounters[0];
        for (const enc of encounters) {
            roll -= enc.weight;
            if (roll <= 0) { selected = enc; break; }
        }

        // Bark: crew reacts to colony site
        if (typeof BarkSystem !== 'undefined' && window.BarkSystem) {
            window.BarkSystem.tryBark('COLONY_SITE_FOUND', this.state, { planet });
        }

        this.state.addLog(`Colony ruins detected. Deploying investigation team...`);
        this.state.consumeRation();

        // Mark as investigated immediately to prevent re-clicking
        planet.colonyInvestigated = true;

        // Use narrative modal system if available for immersive experience
        if (window.NarrativeModal) {
            this.showNarrativeEncounter({
                title: selected.title,
                speaker: 'NARRATOR',
                context: `[highlight]COLONY RUINS: ${selected.title}[/highlight]\n\n${selected.context(planet.name)}`,
                dialogue: selected.dialogue,
                choices: selected.choices,
                onChoiceMade: () => {
                    this.orbitView.updateCommandDeck(planet);
                }
            });
            return;
        }

        // Fallback to old modal system
        this.showColonySiteModal(selected, planet);
    }

    showColonySiteModal(encounter, planet) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.zIndex = '2500';

        const portraits = {
            'Eng. Jaxon': 'M_2', 'Dr. Aris': 'F_3', 'Spc. Vance': 'M_4',
            'Tech Mira': 'F_5', 'A.U.R.A.': null
        };
        const colors = {
            'Eng. Jaxon': '#f0a030', 'Dr. Aris': '#40c8ff', 'Spc. Vance': '#ff5050',
            'Tech Mira': '#d070ff', 'A.U.R.A.': '#00ff88'
        };

        modal.innerHTML = `
            <div class="modal-content" style="border-color: #44aaff; max-width: 680px;">
                <div class="modal-header" style="background: linear-gradient(90deg, #001133, #003366); color: #44aaff; display: flex; justify-content: space-between;">
                    <span>/// COLONY RUINS: ${encounter.title} ///</span>
                    <span style="opacity: 0.7;">${planet.name}</span>
                </div>
                <div style="padding: 25px;">
                    <div style="font-size: 0.9em; color: var(--color-text-dim); margin-bottom: 20px; line-height: 1.6; font-style: italic;">
                        ${encounter.context(planet.name)}
                    </div>
                    <div style="border-left: 2px solid #003366; padding-left: 15px; margin-bottom: 20px;">
                        ${encounter.dialogue.filter(d => {
                            if (d.speaker === 'A.U.R.A.') return true;
                            const speakerMap = {
                                'Eng. Jaxon': 'ENGINEER', 'Dr. Aris': 'MEDIC',
                                'Spc. Vance': 'SECURITY', 'Tech Mira': 'SPECIALIST'
                            };
                            const tag = speakerMap[d.speaker];
                            if (tag) {
                                const member = this.state.crew.find(c => c.tags.includes(tag));
                                return member && member.status !== 'DEAD';
                            }
                            return true;
                        }).map(d => {
                            const color = colors[d.speaker] || '#ffffff';
                            const pId = portraits[d.speaker];
                            const portraitHtml = pId
                                ? `<img src="assets/crew/${pId}.png" style="width:28px;height:28px;border-radius:50%;border:1px solid ${color};object-fit:cover;vertical-align:middle;margin-right:6px;" onerror="this.style.display='none'">`
                                : (d.speaker === 'A.U.R.A.' ? `<span style="display:inline-block;width:28px;height:28px;border-radius:50%;border:1px solid #00ff88;text-align:center;line-height:28px;font-size:12px;margin-right:6px;vertical-align:middle;background:#001a0a;">AI</span>` : '');
                            return `<div style="margin-bottom: 12px; display: flex; align-items: flex-start; gap: 8px;">
                                <div style="flex-shrink: 0; padding-top: 2px;">${portraitHtml}</div>
                                <div>
                                    <span style="color:${color}; font-weight: bold;">${d.speaker}:</span>
                                    <span style="color:${color}; opacity: 0.85; font-style: italic;"> "${d.text}"</span>
                                </div>
                            </div>`;
                        }).join('')}
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        ${encounter.choices.map((choice, idx) => `
                            <button class="colony-site-choice" data-idx="${idx}" style="
                                padding: 12px 15px; text-align: left;
                                border: 1px solid #44aaff; background: rgba(0,20,60,0.8);
                                color: #44aaff; cursor: pointer; font-family: var(--font-mono);
                                transition: all 0.2s;
                            ">
                                <div style="font-weight: bold;">${choice.text}</div>
                                <div style="font-size: 0.8em; margin-top: 4px; color: var(--color-text-dim);">${choice.desc}</div>
                            </button>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.querySelectorAll('.colony-site-choice').forEach(btn => {
            btn.onmouseenter = () => { btn.style.background = 'rgba(0,40,120,0.8)'; btn.style.borderColor = '#66ccff'; };
            btn.onmouseleave = () => { btn.style.background = 'rgba(0,20,60,0.8)'; btn.style.borderColor = '#44aaff'; };
            btn.onclick = () => {
                const choice = encounter.choices[parseInt(btn.dataset.idx)];
                const resultMsg = choice.effect(this.state);
                this.state.addLog(resultMsg);

                planet.colonyInvestigated = true;

                this.state.emitUpdates();
                modal.remove();

                this.orbitView.updateCommandDeck(planet);
            };
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // DERELICT ENCOUNTER — Non-Exodus ships (mining, military, alien)
    // ═══════════════════════════════════════════════════════════════
    handleDerelictAction() {
        const planet = this.state.currentSystem;
        if (!planet || !planet.tags || !planet.tags.includes('DERELICT')) {
            this.state.addLog("No derelict signal detected at this location.");
            return;
        }
        if (planet.derelictInvestigated) {
            this.state.addLog("Derelict already investigated.");
            return;
        }

        const encounters = (typeof DERELICT_ENCOUNTERS !== 'undefined') ? DERELICT_ENCOUNTERS : [];
        if (encounters.length === 0) {
            this.state.addLog("ERROR: Derelict encounter data unavailable.");
            return;
        }

        // Select by weight
        const totalWeight = encounters.reduce((sum, e) => sum + e.weight, 0);
        let roll = Math.random() * totalWeight;
        let selected = encounters[0];
        for (const enc of encounters) {
            roll -= enc.weight;
            if (roll <= 0) { selected = enc; break; }
        }

        const shipName = selected.getName();

        this.state.addLog(`Derelict signal locked: ${shipName}. Deploying investigation team...`);
        this.state.consumeRation();

        // Use narrative modal system
        if (window.NarrativeModal) {
            this.showNarrativeEncounter({
                title: selected.title,
                speaker: 'NARRATOR',
                context: `[highlight]${shipName}[/highlight]\n\n${selected.context(shipName)}`,
                dialogue: selected.dialogue,
                choices: selected.choices,
                onChoiceMade: () => {
                    planet.derelictInvestigated = true;
                    this.orbitView.updateCommandDeck(planet);
                }
            });
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // ANOMALY ENCOUNTER — Reality-breaking phenomena
    // ═══════════════════════════════════════════════════════════════
    handleAnomalyAction() {
        const planet = this.state.currentSystem;
        if (!planet || !planet.tags || !planet.tags.includes('ANOMALY')) {
            this.state.addLog("No anomaly detected at this location.");
            return;
        }
        if (planet.anomalyInvestigated) {
            this.state.addLog("Anomaly already investigated.");
            return;
        }

        const encounters = (typeof ANOMALY_ENCOUNTERS !== 'undefined') ? ANOMALY_ENCOUNTERS : [];
        if (encounters.length === 0) {
            this.state.addLog("ERROR: Anomaly encounter data unavailable.");
            return;
        }

        // Select by weight
        const totalWeight = encounters.reduce((sum, e) => sum + e.weight, 0);
        let roll = Math.random() * totalWeight;
        let selected = encounters[0];
        for (const enc of encounters) {
            roll -= enc.weight;
            if (roll <= 0) { selected = enc; break; }
        }

        // Bark: crew reacts to anomaly
        if (typeof BarkSystem !== 'undefined' && window.BarkSystem) {
            window.BarkSystem.tryBark('ANOMALY_FOUND', this.state, { planet });
        }

        // A.U.R.A. commentary on anomaly discovery
        if (typeof AuraSystem !== 'undefined' && window.AuraSystem) {
            window.AuraSystem.tryComment('ANOMALY_FOUND', this.state);
        }

        this.state.addLog(`ANOMALY CONTACT: ${selected.title}. Approach with caution...`);

        // Use narrative modal system
        if (window.NarrativeModal) {
            this.showNarrativeEncounter({
                title: selected.title,
                speaker: 'NARRATOR',
                context: `[warning]ANOMALY: ${selected.title}[/warning]\n\n${selected.context()}`,
                dialogue: selected.dialogue,
                choices: selected.choices,
                onChoiceMade: () => {
                    planet.anomalyInvestigated = true;
                    this.orbitView.updateCommandDeck(planet);
                }
            });
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // THE WRONG PLACE — Special escape/accept handlers
    // ═══════════════════════════════════════════════════════════════
    handleWrongPlaceEscape() {
        const livingCrew = this.state.crew.filter(c => c.status !== 'DEAD');

        // Escaping THE WRONG PLACE costs everything but returns you
        this.showNarrativeEncounter({
            title: 'TEAR THROUGH REALITY',
            speaker: 'NARRATOR',
            context: `[warning]THE WRONG PLACE[/warning]

You gather every scrap of energy. Every bit of salvage goes into the engines. The crew pushes themselves beyond breaking.

A.U.R.A.'s voice crackles: "I have calculated a path. It is... improbable. But existence here is impossible. We must try."

The ship screams. Reality screams louder. For a moment, you exist in two places at once.

Then you're through.`,
            dialogue: [
                { speaker: 'A.U.R.A.', text: "Translation complete. We have returned to normal space. Location: unknown. But the stars... the stars are right again." }
            ],
            choices: [
                {
                    text: "We made it",
                    desc: "Return to a random sector, but at great cost.",
                    effect: (state) => {
                        // Heavy cost
                        state.energy = Math.max(10, state.energy - 50);
                        state.salvage = Math.max(0, state.salvage - 30);

                        // Crew trauma
                        state.crew.forEach(c => {
                            if (c.status !== 'DEAD') {
                                c.stress = Math.min(3, (c.stress || 0) + 1);
                                if (!c.tags.includes('WRONG_PLACE_SURVIVOR')) {
                                    c.tags.push('WRONG_PLACE_SURVIVOR');
                                }
                            }
                        });

                        // Return to a random sector (prefer ahead)
                        const targetSector = Math.min(6, Math.max(1, (state._previousSector || 1) + Math.floor(Math.random() * 2)));
                        state.currentSector = targetSector;
                        state.sectorNodes = PlanetGenerator.generateSector(targetSector);
                        state._inWrongPlace = false;

                        // Apply sector entry effects
                        const config = (typeof SECTOR_CONFIG !== 'undefined') ? SECTOR_CONFIG[targetSector] : null;
                        if (config && config.hazard && config.hazard.onSectorEnter) {
                            config.hazard.onSectorEnter(state, state.sectorNodes);
                        }

                        state.currentSystem = null;
                        state.addLog("=== REALITY BREACH SUCCESSFUL ===");
                        state.addLog(`Emerged in Sector ${targetSector}. The crew will never forget what they saw.`);

                        return "You escaped THE WRONG PLACE. The memories remain. -50 Energy, -30 Salvage. All crew +1 Stress.";
                    }
                }
            ],
            onChoiceMade: () => {
                // Update the sector display
                const sectorNameEl = document.getElementById('sector-name');
                if (sectorNameEl) {
                    const SECTOR_NAMES = {
                        1: 'THE GRAVEYARD', 2: 'THE DEEP', 3: 'THE INTERFERENCE',
                        4: 'THE GARDEN', 5: 'THE EVENT HORIZON', 6: 'THE THRESHOLD'
                    };
                    sectorNameEl.textContent = `/// SECTOR ${this.state.currentSector}: ${SECTOR_NAMES[this.state.currentSector] || 'UNKNOWN'}`;
                    sectorNameEl.style.color = 'var(--color-accent)';
                    sectorNameEl.style.animation = 'none';
                }
                this.renderNav();
            }
        });
    }

    handleWrongPlaceAccept() {
        // Accepting your fate in THE WRONG PLACE is a unique ending
        this.showEndingScreen({
            ending: 'WRONG_PLACE_ACCEPTED',
            title: 'THE WRONG PLACE',
            text: `You stop fighting.

The engines go quiet. The lights dim. The crew gathers on the bridge and watches the impossible stars.

A.U.R.A. speaks one last time: "I understand now. This place... it's not wrong. It's just different. Perhaps it was always waiting for us."

One by one, you stop seeing the strangeness. The colors that shouldn't exist become beautiful. The geometry that hurts to perceive becomes... home.

The Exodus-9 settles into orbit around a world that exists in no chart, in no dimension, in no time you've ever known.

You step outside.

The air shouldn't be breathable. You breathe it anyway.

The ground shouldn't hold your weight. It holds you anyway.

You build. You live. You forget what "normal" ever meant.

Somewhere, somewhen, the universe continues without you.

You don't miss it.

You are exactly where you were always meant to be.

You are home.`
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // LATE-GAME POIs — Lighthouse, Garden, Grave
    // ═══════════════════════════════════════════════════════════════
    handleLateGamePOI(poiType) {
        const planet = this.state.currentSystem;
        if (!planet || !planet.tags || !planet.tags.includes(poiType)) {
            this.state.addLog(`No ${poiType.toLowerCase()} detected at this location.`);
            return;
        }

        const investigatedKey = `${poiType.toLowerCase()}Investigated`;
        if (planet[investigatedKey]) {
            this.state.addLog(`${poiType} already investigated.`);
            return;
        }

        const poi = (typeof LATE_GAME_POIS !== 'undefined') ? LATE_GAME_POIS[poiType] : null;
        if (!poi) {
            this.state.addLog(`ERROR: ${poiType} encounter data unavailable.`);
            return;
        }

        this.state.addLog(`Approaching ${poi.name}...`);

        // Show the POI encounter using narrative modal
        this.showNarrativeEncounter({
            title: poi.title,
            speaker: 'NARRATOR',
            context: poi.context(),
            dialogue: poi.dialogue,
            choices: poi.choices,
            onChoiceMade: () => {
                planet[investigatedKey] = true;
                this.orbitView.updateCommandDeck(planet);
            }
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // THE STRUCTURE — Endgame encounter at Sector 6
    // ═══════════════════════════════════════════════════════════════
    handleStructureAction() {
        const planet = this.state.currentSystem;
        if (!planet || !planet.isStructure) {
            this.state.addLog("No structure detected at this location.");
            return;
        }
        if (planet.structureApproached) {
            this.state.addLog("You have already made your choice at THE STRUCTURE.");
            return;
        }

        const encounter = (typeof STRUCTURE_ENCOUNTER !== 'undefined') ? STRUCTURE_ENCOUNTER : null;
        if (!encounter) {
            this.state.addLog("ERROR: Structure encounter data unavailable.");
            return;
        }

        this.state.addLog("===================================");
        this.state.addLog("APPROACHING THE STRUCTURE...");
        this.state.addLog("===================================");

        // Show the approach modal with cinematic text
        this.showStructureModal(encounter, planet);
    }

    showStructureModal(encounter, planet) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.zIndex = '3000'; // Higher than other modals

        const portraits = {
            'Eng. Jaxon': 'M_2', 'Dr. Aris': 'F_3', 'Spc. Vance': 'M_4',
            'Tech Mira': 'F_5', 'A.U.R.A.': null
        };
        const colors = {
            'Eng. Jaxon': '#f0a030', 'Dr. Aris': '#40c8ff', 'Spc. Vance': '#ff5050',
            'Tech Mira': '#d070ff', 'A.U.R.A.': '#00ff88'
        };

        // Filter dialogue for living crew
        const filteredDialogue = encounter.approach.dialogue.filter(d => {
            if (d.speaker === 'A.U.R.A.') return true;
            const speakerMap = {
                'Eng. Jaxon': 'ENGINEER', 'Dr. Aris': 'MEDIC',
                'Spc. Vance': 'SECURITY', 'Tech Mira': 'SPECIALIST'
            };
            const tag = speakerMap[d.speaker];
            if (tag) {
                const member = this.state.crew.find(c => c.tags.includes(tag));
                return member && member.status !== 'DEAD';
            }
            return true;
        });

        // Compact context - remove extra newlines
        const contextText = encounter.approach.context().trim().replace(/\n\n+/g, ' ').replace(/\n/g, ' ');

        modal.innerHTML = `
            <div class="modal-content" style="border-color: #ffffff; max-width: 600px; max-height: 85vh; overflow-y: auto; background: linear-gradient(135deg, #0a0a15, #1a0a2a);">
                <div class="modal-header" style="background: linear-gradient(90deg, #220044, #440088); color: #ffffff; display: flex; justify-content: space-between; font-size: 0.95em; padding: 8px 12px;">
                    <span>/// THE STRUCTURE ///</span>
                </div>
                <div style="padding: 15px;">
                    <div style="font-size: 0.85em; color: #ccccff; margin-bottom: 15px; line-height: 1.6; font-style: italic; border-left: 2px solid #8844ff; padding-left: 10px; max-height: 80px; overflow-y: auto;">
                        ${contextText}
                    </div>
                    <div style="border-left: 2px solid #440088; padding-left: 10px; margin-bottom: 15px; max-height: 120px; overflow-y: auto;">
                        ${filteredDialogue.slice(0, 3).map(d => {
                            const color = colors[d.speaker] || '#ffffff';
                            return `<div style="margin-bottom: 8px; font-size: 0.8em;">
                                <span style="color:${color}; font-weight: bold;">${d.speaker}:</span>
                                <span style="color:${color}; opacity: 0.85;"> "${d.text}"</span>
                            </div>`;
                        }).join('')}
                    </div>
                    <div style="padding-top: 10px; border-top: 1px solid #440088;">
                        <div style="color: #8844ff; margin-bottom: 10px; font-weight: bold; font-size: 0.9em;">WHAT DO YOU DO?</div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
                            ${encounter.choices.map((choice, idx) => `
                                <button class="structure-choice" data-idx="${idx}" style="
                                    padding: 8px 10px; text-align: left;
                                    border: 1px solid #8844ff; background: rgba(30,10,50,0.9);
                                    color: #ffffff; cursor: pointer; font-family: var(--font-mono);
                                    transition: all 0.3s; border-radius: 3px; font-size: 0.8em;
                                ">
                                    <div style="font-weight: bold; color: #ccaaff;">${choice.text}</div>
                                </button>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Hover effects and click handlers
        modal.querySelectorAll('.structure-choice').forEach(btn => {
            btn.onmouseenter = () => {
                btn.style.background = 'rgba(60,20,100,0.9)';
                btn.style.borderColor = '#aa66ff';
                btn.style.transform = 'scale(1.02)';
            };
            btn.onmouseleave = () => {
                btn.style.background = 'rgba(30,10,50,0.9)';
                btn.style.borderColor = '#8844ff';
                btn.style.transform = 'scale(1)';
            };
            btn.onclick = () => {
                const choice = encounter.choices[parseInt(btn.dataset.idx)];
                const result = choice.effect(this.state);

                // Mark structure as approached
                planet.structureApproached = true;

                modal.remove();

                // Show the ending
                this.showEndingScreen(result);
            };
        });
    }

    showEndingScreen(result) {
        // This is the GAME ENDING screen
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.zIndex = '4000';
        modal.style.background = 'rgba(0,0,0,0.98)';

        // Clean up the text - handle both pre-formatted and regular text
        let cleanText = result.text || '';
        // Trim leading/trailing whitespace from each line and the whole text
        cleanText = cleanText.split('\n').map(line => line.trim()).join('\n').trim();
        // Convert double newlines to paragraph breaks
        cleanText = cleanText.replace(/\n\n+/g, '</p><p>');
        // Convert remaining single newlines to breaks
        cleanText = cleanText.replace(/\n/g, '<br>');
        // Wrap in paragraph tags
        cleanText = '<p>' + cleanText + '</p>';

        modal.innerHTML = `
            <div style="
                max-width: 800px;
                margin: 40px auto;
                padding: 40px 50px;
                background: linear-gradient(135deg, #0a0a15, #1a0a2a);
                border: 2px solid #ffffff;
                border-radius: 8px;
                animation: fadeIn 2s ease-in;
                max-height: 90vh;
                overflow-y: auto;
            ">
                <div style="
                    text-align: center;
                    font-size: 1.8em;
                    color: #ffffff;
                    margin-bottom: 30px;
                    text-transform: uppercase;
                    letter-spacing: 6px;
                    text-shadow: 0 0 30px rgba(255,255,255,0.5);
                ">
                    ${result.title}
                </div>
                <div class="ending-text" style="
                    font-size: 1.05em;
                    color: #cccccc;
                    line-height: 1.9;
                    text-align: left;
                    font-style: italic;
                    padding: 10px 20px;
                    border-left: 3px solid #6644aa;
                ">
                    ${cleanText}
                </div>
                <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #333;">
                    <div style="color: #8866cc; font-size: 0.95em; margin-bottom: 20px; letter-spacing: 3px;">
                        ENDING: ${result.ending || 'UNKNOWN'}
                    </div>
                    <button id="btn-new-game" style="
                        padding: 15px 40px;
                        border: 2px solid #4488ff;
                        background: rgba(0,40,100,0.5);
                        color: #4488ff;
                        font-family: var(--font-mono);
                        font-size: 1.1em;
                        cursor: pointer;
                        transition: all 0.3s;
                    ">
                        BEGIN NEW EXODUS
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Add ending log
        this.state.addLog("===================================");
        this.state.addLog(`ENDING ACHIEVED: ${result.title}`);
        this.state.addLog("===================================");
        this.state.addLog("The journey of the Exodus-9 has concluded.");

        // New game button
        const newGameBtn = modal.querySelector('#btn-new-game');
        newGameBtn.onmouseenter = () => {
            newGameBtn.style.background = 'rgba(0,80,200,0.5)';
            newGameBtn.style.borderColor = '#66aaff';
        };
        newGameBtn.onmouseleave = () => {
            newGameBtn.style.background = 'rgba(0,40,100,0.5)';
            newGameBtn.style.borderColor = '#4488ff';
        };
        newGameBtn.onclick = () => {
            modal.remove();
            // Reset the game
            this.state.init();
            this.state.addLog("/// NEW EXODUS INITIALIZED ///");
            this.state.addLog("Humanity's hope rests with you once more.");

            // Return to navigation view
            this.switchToNavView();
        };
    }

    // ═══════════════════════════════════════════════════════════════
    // NARRATIVE ENCOUNTER — Uses new NarrativeModal for cinematic experience
    // ═══════════════════════════════════════════════════════════════
    showNarrativeEncounter(config) {
        // config: { title, context, dialogue[], choices[], onChoiceMade, speaker? }
        if (!window.NarrativeModal) {
            console.warn('[NarrativeModal] Not loaded, falling back to alert');
            alert(config.context);
            return;
        }

        // Speaker map for NarrativeModal
        const speakerMap = {
            'Eng. Jaxon': 'JAXON',
            'Dr. Aris': 'ARIS',
            'Spc. Vance': 'VANCE',
            'Tech Mira': 'MIRA',
            'A.U.R.A.': 'AURA',
            'Cmdr. Reyes': 'COMMANDER'
        };

        // Build the narrative sequence
        const sequence = [];

        // Add context as narrator
        if (config.context) {
            sequence.push({
                speaker: config.speaker || 'NARRATOR',
                text: config.context
            });
        }

        // Add dialogue from living crew only
        if (config.dialogue && config.dialogue.length > 0) {
            const filteredDialogue = config.dialogue.filter(d => {
                if (d.speaker === 'A.U.R.A.') return true;
                const tagMap = {
                    'Eng. Jaxon': 'ENGINEER', 'Dr. Aris': 'MEDIC',
                    'Spc. Vance': 'SECURITY', 'Tech Mira': 'SPECIALIST'
                };
                const tag = tagMap[d.speaker];
                if (tag) {
                    const member = this.state.crew.find(c => c.tags.includes(tag));
                    return member && member.status !== 'DEAD';
                }
                return true;
            });

            filteredDialogue.forEach(d => {
                sequence.push({
                    speaker: speakerMap[d.speaker] || 'UNKNOWN',
                    text: `"${d.text}"`
                });
            });
        }

        // Build choices for NarrativeModal with dynamic disabling
        const narrativeChoices = config.choices.map((choice, idx) => {
            // Check if choice requires probe and probe is broken
            const textLower = (choice.text || '').toLowerCase();
            const descLower = (choice.desc || '').toLowerCase();
            const requiresProbe = textLower.includes('probe') || descLower.includes('probe');
            const probeDisabled = requiresProbe && this.state.probeIntegrity <= 0;

            // Check if crew member is sedated and this involves them
            let sedatedDisabled = false;
            const sedatedCrew = this.state.crew.filter(c => c.tags && c.tags.includes('SEDATED'));
            // Note: Sedated crew can't be sent on missions

            return {
                text: choice.text,
                cost: probeDisabled ? '[PROBE DESTROYED] ' + choice.desc : choice.desc,
                disabled: choice.disabled || probeDisabled || sedatedDisabled,
                effect: () => {
                    const resultMsg = choice.effect(this.state);
                    this.state.addLog(resultMsg);
                    if (config.onChoiceMade) config.onChoiceMade(idx, resultMsg);
                    this.state.emitUpdates();
                }
            };
        });

        // Show the sequence
        if (sequence.length > 1) {
            window.NarrativeModal.showSequence(sequence, narrativeChoices);
        } else if (sequence.length === 1) {
            window.NarrativeModal.show({
                speaker: sequence[0].speaker,
                text: sequence[0].text,
                choices: narrativeChoices
            });
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // COLONY WARNING — S1/S2 warning before establishing colony
    // ═══════════════════════════════════════════════════════════════
    showColonyWarningModal(planet, onProceed) {
        const config = (typeof SECTOR_CONFIG !== 'undefined') ? SECTOR_CONFIG[this.state.currentSector] : null;
        if (!config || !config.colonyWarning || planet._colonyWarningShown) {
            onProceed();
            return;
        }
        planet._colonyWarningShown = true;

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.zIndex = '2500';

        const portraits = {
            'Eng. Jaxon': 'M_2', 'Dr. Aris': 'F_3', 'Spc. Vance': 'M_4',
            'Tech Mira': 'F_5', 'A.U.R.A.': null
        };
        const colors = {
            'Eng. Jaxon': '#f0a030', 'Dr. Aris': '#40c8ff', 'Spc. Vance': '#ff5050',
            'Tech Mira': '#d070ff', 'A.U.R.A.': '#00ff88'
        };

        // Crew warning lines based on who's alive AND planet type
        const warnings = [];
        const living = this.state.crew.filter(c => c.status !== 'DEAD' && !c.tags.includes('LEADER'));
        const jaxon = living.find(c => c.tags.includes('ENGINEER'));
        const aris = living.find(c => c.tags.includes('MEDIC'));
        const vance = living.find(c => c.tags.includes('SECURITY'));
        const mira = living.find(c => c.tags.includes('SPECIALIST'));
        const pType = planet.type || 'UNKNOWN';

        // Planet-specific warnings
        const planetWarnings = {
            VOLCANIC: {
                vance: "The thermal readings are off the charts. Anyone on the surface will cook alive.",
                aris: "Constant volcanic ash in the atmosphere will destroy our lungs within weeks.",
                jaxon: "The ground is unstable — magma flows could wipe out any settlement overnight.",
                mira: "Seismic activity is continuous. There's nowhere safe to build."
            },
            TOXIC: {
                vance: "That atmosphere will eat through our suits. One breach and we're dead.",
                aris: "The chemical composition is lethal. Even trace exposure causes organ failure.",
                jaxon: "We can't seal a habitat against those corrosive agents — not with our supplies.",
                mira: "Toxicity levels are 400% above survivable limits. The math doesn't work."
            },
            GAS_GIANT: {
                vance: "There's no surface! We'd be crushed by pressure before we found anything solid.",
                aris: "Human biology cannot survive in a gas giant. This is impossible.",
                jaxon: "Even our strongest materials can't withstand that atmospheric pressure.",
                mira: "A floating colony requires technology we don't have."
            },
            DESERT: {
                vance: "120 degrees during the day, no water. We'd be dead in a week.",
                aris: "Heat stroke, dehydration — I can't keep people alive here.",
                jaxon: "No water means no hydroponics. We'd starve even if we survived the heat.",
                mira: "Water table is non-existent. Zero agricultural potential."
            },
            ICE_WORLD: {
                vance: "-200 degrees will kill us faster than any enemy ever could.",
                aris: "Frostbite, hypothermia — our medical supplies can't handle constant cold exposure.",
                jaxon: "Energy requirements for heating would drain us dry in months.",
                mira: "Thermal models show we'd freeze before the first harvest."
            },
            SHATTERED: {
                vance: "The planet is literally falling apart. There's nothing stable to build on.",
                aris: "Radiation from the exposed core is lethal. No one survives that.",
                jaxon: "The structural integrity is zero. Fragments could crush us at any moment.",
                mira: "Gravitational anomalies make orbit unstable. This world is dying."
            },
            ROCKY: {
                vance: "Barren rock with no atmosphere. One dome breach and everyone suffocates.",
                aris: "No biosphere, no ecosystem — growing food here is nearly impossible.",
                jaxon: "Radiation exposure without atmosphere will cause long-term health issues.",
                mira: "Resource extraction is possible, but colonization? Marginal at best."
            },
            STORM_WORLD: {
                vance: "800 kilometer per hour winds. Nothing we build will survive.",
                aris: "The constant pressure changes would cause severe physiological damage.",
                jaxon: "Our structures can't withstand that wind speed. We'd be swept away.",
                mira: "The storms never stop. There's no building window."
            },
            RADIATION_BELT: {
                vance: "The radiation here would cook us from the inside out.",
                aris: "Cancer rates would be 100% within the first year. I won't sign off on this.",
                jaxon: "No amount of shielding we can build would protect against those levels.",
                mira: "Radiation is 50x lethal dose. This is a death sentence."
            }
        };

        // Get planet-specific warnings or fall back to generic
        const specific = planetWarnings[pType] || null;

        if (vance) warnings.push({ speaker: 'Spc. Vance', text: specific?.vance || "Commander, this sector is a graveyard. Colonizing here is suicide. We need to go deeper." });
        if (aris) warnings.push({ speaker: 'Dr. Aris', text: specific?.aris || "The environmental data doesn't support long-term survival. Please, we can do better." });
        if (jaxon) warnings.push({ speaker: 'Eng. Jaxon', text: specific?.jaxon || "The soil composition, the radiation levels — nothing here can sustain agriculture. This isn't the place." });
        if (mira) warnings.push({ speaker: 'Tech Mira', text: specific?.mira || "My models show colony failure within 18 months at these readings. The deeper sectors have better candidates." });

        const viability = pType === 'VITAL' || pType === 'EDEN' || pType === 'TERRAFORMED' ? Math.floor(Math.random() * 20 + 40) : Math.floor(Math.random() * 8 + 2);
        warnings.push({ speaker: 'A.U.R.A.', text: `Colony viability assessment for ${pType}: ${viability}%. Recommend proceeding to Sector ${Math.min(5, this.state.currentSector + 1)}.` });

        modal.innerHTML = `
            <div class="modal-content" style="border-color: #ff4444; max-width: 650px;">
                <div class="modal-header" style="background: linear-gradient(90deg, #330000, #660000); color: #ff4444; display: flex; justify-content: space-between;">
                    <span>/// COLONY WARNING ///</span>
                    <span style="opacity: 0.7;">CREW ADVISORY</span>
                </div>
                <div style="padding: 25px;">
                    <div style="font-size: 0.95em; color: #ff6666; margin-bottom: 20px; line-height: 1.6; font-weight: bold;">
                        ⚠ Your crew is strongly advising against colonization in this sector.
                    </div>
                    <div style="border-left: 2px solid #660000; padding-left: 15px; margin-bottom: 20px;">
                        ${warnings.map(d => {
                            const color = colors[d.speaker] || '#ffffff';
                            const pId = portraits[d.speaker];
                            const portraitHtml = pId
                                ? `<img src="assets/crew/${pId}.png" style="width:28px;height:28px;border-radius:50%;border:1px solid ${color};object-fit:cover;vertical-align:middle;margin-right:6px;" onerror="this.style.display='none'">`
                                : (d.speaker === 'A.U.R.A.' ? `<span style="display:inline-block;width:28px;height:28px;border-radius:50%;border:1px solid #00ff88;text-align:center;line-height:28px;font-size:12px;margin-right:6px;vertical-align:middle;background:#001a0a;">AI</span>` : '');
                            return `<div style="margin-bottom: 12px; display: flex; align-items: flex-start; gap: 8px;">
                                <div style="flex-shrink: 0; padding-top: 2px;">${portraitHtml}</div>
                                <div>
                                    <span style="color:${color}; font-weight: bold;">${d.speaker}:</span>
                                    <span style="color:${color}; opacity: 0.85; font-style: italic;"> "${d.text}"</span>
                                </div>
                            </div>`;
                        }).join('')}
                    </div>
                    <div style="display: flex; gap: 15px; justify-content: flex-end;">
                        <button class="colony-warn-abort" style="
                            padding: 12px 25px; border: 1px solid var(--color-primary);
                            background: rgba(0,40,0,0.8); color: var(--color-primary);
                            cursor: pointer; font-family: var(--font-mono); font-weight: bold;
                        ">ABORT — Keep Moving</button>
                        <button class="colony-warn-proceed" style="
                            padding: 12px 25px; border: 1px solid #ff4444;
                            background: rgba(60,0,0,0.8); color: #ff4444;
                            cursor: pointer; font-family: var(--font-mono); font-weight: bold;
                        ">PROCEED DESPITE WARNINGS</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.querySelector('.colony-warn-abort').onclick = () => {
            this.state.addLog("Colony attempt aborted. Crew advisory accepted.");
            modal.remove();
        };
        modal.querySelector('.colony-warn-proceed').onclick = () => {
            this.state.addLog("Colony warning overridden. Proceeding with colonization attempt...");
            // Ethics hit for ignoring crew
            if (typeof AuraSystem !== 'undefined' && window.AuraSystem) {
                window.AuraSystem.adjustEthics(-1, 'Ignored colony warning', this.state);
            }
            modal.remove();
            onProceed();
        };
    }

    // ═══════════════════════════════════════════════════════════════
    // A.U.R.A. VENT WARNING — response modal
    // ═══════════════════════════════════════════════════════════════
    showAuraVentModal() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.zIndex = '3000';

        const jaxonAlive = this.state.crew.some(c => c.tags.includes('ENGINEER') && c.status !== 'DEAD');
        const hasTechFragment = this.state.cargo.some(i => i.id === 'tech_fragment' || i.id === 'TECH_FRAGMENT');

        modal.innerHTML = `
            <div class="modal-content" style="border-color: #ff4444; max-width: 550px;">
                <div class="modal-header" style="background: linear-gradient(90deg, #330000, #660000); color: #ff4444;">
                    /// ATMOSPHERE ALERT ///
                </div>
                <div style="padding: 25px;">
                    <div style="font-size: 0.95em; color: #ff6666; margin-bottom: 20px; line-height: 1.6;">
                        A.U.R.A. is venting atmosphere from crew quarters. Respond immediately!
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        ${jaxonAlive ? `
                        <button class="vent-choice" data-action="jaxon" style="
                            padding: 12px 15px; text-align: left;
                            border: 1px solid #f0a030; background: rgba(40,20,0,0.8);
                            color: #f0a030; cursor: pointer; font-family: var(--font-mono);
                        ">
                            <div style="font-weight: bold;">Jaxon: "I can override her!"</div>
                            <div style="font-size: 0.8em; margin-top: 4px; color: var(--color-text-dim);">Engineer override — resets A.U.R.A. to neutral</div>
                        </button>` : ''}
                        ${hasTechFragment ? `
                        <button class="vent-choice" data-action="tech" style="
                            padding: 12px 15px; text-align: left;
                            border: 1px solid #d070ff; background: rgba(40,0,40,0.8);
                            color: #d070ff; cursor: pointer; font-family: var(--font-mono);
                        ">
                            <div style="font-weight: bold;">Use Tech Fragment</div>
                            <div style="font-size: 0.8em; margin-top: 4px; color: var(--color-text-dim);">Foreign code shifts A.U.R.A.'s ethics (+3)</div>
                        </button>` : ''}
                        <button class="vent-choice" data-action="accept" style="
                            padding: 12px 15px; text-align: left;
                            border: 1px solid #ff4444; background: rgba(60,0,0,0.8);
                            color: #ff4444; cursor: pointer; font-family: var(--font-mono);
                        ">
                            <div style="font-weight: bold;">Accept Consequences</div>
                            <div style="font-size: 0.8em; margin-top: 4px; color: var(--color-text-dim);">1 crew member injured by oxygen deprivation</div>
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.querySelectorAll('.vent-choice').forEach(btn => {
            btn.onclick = () => {
                const action = btn.dataset.action;
                if (action === 'jaxon' && typeof AuraSystem !== 'undefined') {
                    window.AuraSystem.jaxonOverride(this.state);
                } else if (action === 'tech' && typeof AuraSystem !== 'undefined') {
                    // Remove tech fragment from cargo
                    const idx = this.state.cargo.findIndex(i => i.id === 'tech_fragment' || i.id === 'TECH_FRAGMENT');
                    if (idx !== -1) this.state.cargo.splice(idx, 1);
                    window.AuraSystem.applyTechFragment(this.state);
                } else if (action === 'accept') {
                    // Injure a random living crew member
                    const living = this.state.crew.filter(c => c.status === 'HEALTHY');
                    if (living.length > 0) {
                        const victim = living[Math.floor(Math.random() * living.length)];
                        victim.status = 'INJURED';
                        this.state.addLog(`${victim.name} suffered oxygen deprivation during the vent. Status: INJURED.`);
                    }
                }
                this.state.emitUpdates();
                modal.remove();
            };
        });
    }

    handleScanAction() {
        const planet = this.state.currentSystem;

        // Special handling for THE STRUCTURE - scanning it is... different
        if (planet && planet.isStructure) {
            if (this.state.consumeEnergy(2)) {
                this.state.addLog("Deep Scan initiated...");
                this.state.addLog("=== SCAN ERROR ===");
                this.state.addLog("Mass: [OVERFLOW - VALUE EXCEEDS SENSOR RANGE]");
                this.state.addLog("Composition: [NULL - MATERIAL UNKNOWN]");
                this.state.addLog("Age: [ERROR - NEGATIVE VALUE DETECTED]");
                this.state.addLog("Energy readings: [∞]");
                this.state.addLog("A.U.R.A.: \"Commander, the scan returns impossible values. It's not that we can't read it — it's that the readings don't correspond to anything in physics.\"");
                this.state.addLog("The probe sent a burst of static before going silent. Its signal traces to a location that doesn't exist.");

                // Probe takes damage from scanning THE STRUCTURE
                if (this.state.probeIntegrity > 0) {
                    this.state.probeIntegrity = Math.max(0, this.state.probeIntegrity - 30);
                    if (this.state.probeIntegrity <= 0) {
                        this.state.addLog("PROBE STATUS: DESTROYED. It didn't break — it simply ceased to be.");
                    } else {
                        this.state.addLog(`PROBE STATUS: Integrity at ${this.state.probeIntegrity}%. Something is wrong with its memory banks.`);
                    }
                }

                planet.scanned = true;
                this.state.emitUpdates();
                this.renderOrbit();
            }
            return;
        }

        if (this.state.consumeEnergy(2)) {
            this.state.addLog("Deep Scan initiated...");
            planet.scanned = true;

            // S3+ deep scan hook — corrects corrupted data, reveals hidden tags
            const deepScanConfig = (typeof SECTOR_CONFIG !== 'undefined') ? SECTOR_CONFIG[this.state.currentSector] : null;
            if (deepScanConfig && deepScanConfig.hazard && deepScanConfig.hazard.onDeepScan) {
                deepScanConfig.hazard.onDeepScan(planet);
            }

            // Check if PREDATORY was just revealed
            if (planet.tags && planet.tags.includes('PREDATORY')) {
                this.state.addLog("⚠ WARNING: PREDATORY ecosystem detected! Surface organisms exhibit coordinated hunting behavior.");
                this.state.addLog("A.U.R.A.: \"Deep scan reveals aggressive bio-signatures. This paradise has teeth.\"");
            }

            this.state.addLog("Detailed surface analysis complete. Resource data available.");

            // === SIGNAL TYPE SCAN BONUSES ===
            // Different signals provide different benefits when detected

            // ALIEN SIGNALS: high risk but data valuable
            if (planet.tags && planet.tags.includes('ALIEN_SIGNALS')) {
                this.state.addLog("⚡ ALIEN SIGNAL SOURCE: Unknown transmission origin detected. Approach with caution.");
                this.state.addLog("A.U.R.A.: \"The signal isn't random. It's a message. For whom, I cannot determine.\"");
            }

            // ANCIENT RUINS: knowledge and reduced EVA risk
            if (planet.tags && planet.tags.includes('ANCIENT_RUINS')) {
                this.state.addLog("📜 ANCIENT RUINS: Structural remnants detected. Archaeological value confirmed.");
                // Small energy refund for ruins (ancient tech assists scanning)
                this.state.energy = Math.min(100, this.state.energy + 1);
                this.state.addLog("Ancient scanner arrays still partially functional. +1 Energy recovered.");
            }

            // BIOLOGICAL: life means potential food and lower danger
            if (planet.metrics && planet.metrics.hasLife && !planet.tags?.includes('PREDATORY')) {
                this.state.addLog("🌿 BIOLOGICAL SIGNATURES: Stable ecosystem detected. EVA conditions favorable.");
            }

            // TECHNOLOGICAL: salvage potential
            if (planet.metrics && planet.metrics.hasTech) {
                this.state.addLog("⚙ TECHNOLOGICAL SIGNATURES: Machine presence confirmed. High salvage potential.");
            }

            // DERELICT: ship salvage
            if (planet.tags && planet.tags.includes('DERELICT')) {
                this.state.addLog("🚀 DERELICT VESSEL: Non-Exodus ship wreckage detected. Investigate for salvage.");
            }

            // Bark: crew reacts to scan results
            if (typeof BarkSystem !== 'undefined' && window.BarkSystem) {
                window.BarkSystem.tryBark('AFTER_SCAN', this.state, { planet });
            }

            // A.U.R.A. scan commentary
            if (typeof AuraSystem !== 'undefined' && window.AuraSystem) {
                window.AuraSystem.tryComment('SCAN_COMPLETE', this.state);

                // Additional commentary for high-viability colony sites
                const colonyTypes = ['EDEN', 'VITAL', 'TERRAFORMED', 'OCEANIC'];
                if (colonyTypes.includes(planet.type)) {
                    setTimeout(() => {
                        window.AuraSystem.tryComment('COLONY_SITE', this.state);
                    }, 600);
                }

                // Discovery commentary for anomalies or unusual findings
                if (planet.tags && (planet.tags.includes('ANOMALY') || planet.tags.includes('EXODUS_WRECK'))) {
                    setTimeout(() => {
                        window.AuraSystem.tryComment('DISCOVERY', this.state);
                    }, 400);
                }
            }

            this.orbitView.updateCommandDeck(this.state.currentSystem);
            this.renderOrbit();
        }
    }

    handleProbeAction() {
        const planet = this.state.currentSystem;

        // THE STRUCTURE — Probe is instantly destroyed
        if (planet && planet.type === 'STRUCTURE') {
            if (this.state.probeIntegrity <= 0) {
                this.state.addLog("No probe available. Perhaps that is fortunate.");
                return;
            }
            this.state.probeIntegrity = 0;
            this.state.addLog("Probe launched toward THE STRUCTURE...");
            this.state.addLog("...");
            this.state.addLog("Signal lost instantly. No telemetry. No wreckage. The probe simply... ceased.");
            this.state.addLog("A.U.R.A.: 'The probe did not crash. It was... unmade. I advise against further attempts.'");
            this.state.emitUpdates();
            this.orbitView.updateCommandDeck(planet);
            return;
        }

        // 1. Fabricate if destroyed
        if (this.state.probeIntegrity <= 0) {
            // Engineering must be operational to fabricate
            if (!this.state.isDeckOperational('engineering')) {
                this.state.addLog("ENGINEERING OFFLINE: Probe fabrication unavailable.");
                return;
            }
            if (this.state.salvage >= 50) {
                this.state.salvage -= 50;
                this.state.probeIntegrity = 100;
                this.state.addLog("Probe Fabricated. Systems Operational. (-50 Salvage)");
                this.state.emitUpdates();
                this.orbitView.updateCommandDeck(this.state.currentSystem);
            } else {
                this.state.addLog("Insufficient Salvage to fabricate Probe.");
            }
            return;
        }

        // 2. Launch Sequence (planet already declared at top of function)
        this.state.addLog(`Probe launched to ${planet.name} surface...`);

        // Bark: crew reacts to probe deploy
        if (typeof BarkSystem !== 'undefined' && window.BarkSystem) {
            window.BarkSystem.tryBark('PROBE_DEPLOY', this.state, { planet });
        }

        // A.U.R.A. commentary on probe launch
        if (typeof AuraSystem !== 'undefined' && window.AuraSystem) {
            window.AuraSystem.tryComment('PROBE_LAUNCH', this.state);
        }

        // Use new System for Logic
        const result = ProbeSystem.performProbe(planet, this.state.probeIntegrity);

        // Apply Results
        this.state.probeIntegrity = Math.max(0, this.state.probeIntegrity - result.integrityLoss);

        if (result.reward) {
            if (result.reward.type === 'ITEM') {
                const item = { ...result.reward.data, acquiredAt: planet.name };
                this.state.cargo.push(item);
            } else if (result.reward.type === 'RESOURCE') {
                if (result.reward.resource === 'metals' || result.reward.resource === 'salvage') {
                    const old = this.state.salvage;
                    this.state.salvage = Math.min(this.state.maxSalvage, this.state.salvage + result.reward.amount);
                    if (this.state.salvage === this.state.maxSalvage && old < this.state.maxSalvage) {
                        this.state.addLog("STORAGE WARNING: Salvage capacity reached!");
                    }
                }
                if (result.reward.resource === 'energy') this.state.energy = Math.min(100, this.state.energy + result.reward.amount);
            }
        }

        this.state.addLog(result.message);
        this.state.emitUpdates();
        this.orbitView.updateCommandDeck(planet);
    }

    // ═══════════════════════════════════════════════════════════════
    // REMOTE PROBE — Launch probe to a scanned planet from nav map
    // ═══════════════════════════════════════════════════════════════
    handleRemoteProbe(targetPlanet) {
        if (!targetPlanet) {
            this.state.addLog("No target selected for remote probe.");
            return;
        }

        // Must be scanned to target
        if (!targetPlanet.remoteScanned && !targetPlanet.scanned) {
            this.state.addLog("Target must be scanned before remote probe deployment.");
            return;
        }

        // Can't probe current location (use normal probe action)
        if (this.state.currentSystem && this.state.currentSystem.id === targetPlanet.id) {
            this.state.addLog("Already in orbit. Use standard probe deployment.");
            return;
        }

        // Check probe integrity
        if (this.state.probeIntegrity <= 0) {
            // Try to fabricate
            if (!this.state.isDeckOperational('engineering')) {
                this.state.addLog("ENGINEERING OFFLINE: Probe fabrication unavailable.");
                return;
            }
            if (this.state.salvage >= 50) {
                this.state.salvage -= 50;
                this.state.probeIntegrity = 100;
                this.state.addLog("Probe Fabricated. Systems Operational. (-50 Salvage)");
            } else {
                this.state.addLog("Insufficient Salvage to fabricate Probe. (50 required)");
                return;
            }
        }

        // Remote probe costs additional energy (travel cost penalty)
        const remoteCost = Math.floor(targetPlanet.fuelCost * 0.3); // 30% of warp cost
        if (!this.state.consumeEnergy(remoteCost)) {
            this.state.addLog(`Insufficient energy for remote probe. (${remoteCost} required)`);
            return;
        }

        this.state.addLog(`Launching long-range probe to ${targetPlanet.name}... (-${remoteCost} Energy)`);

        // Bark: crew reacts to remote probe
        if (typeof BarkSystem !== 'undefined' && window.BarkSystem) {
            const mira = this.state.crew.find(c => c.personality === 'CURIOUS' && c.status !== 'DEAD');
            if (mira) {
                setTimeout(() => this.state.addLog(`${mira.name}: "Telemetry uplink established. This is exciting — remote sampling!"`), 400);
            }
        }

        // Perform probe with penalty for remote operation (increased damage)
        const result = ProbeSystem.performProbe(targetPlanet, this.state.probeIntegrity);

        // Remote probe takes +15% hull damage due to extended operation
        const remoteDamage = Math.floor(result.integrityLoss * 1.15);

        // Apply Results
        this.state.probeIntegrity = Math.max(0, this.state.probeIntegrity - remoteDamage);

        if (result.reward) {
            if (result.reward.type === 'ITEM') {
                const item = { ...result.reward.data, acquiredAt: `${targetPlanet.name} (Remote)` };
                this.state.cargo.push(item);
            } else if (result.reward.type === 'RESOURCE') {
                if (result.reward.resource === 'metals' || result.reward.resource === 'salvage') {
                    const old = this.state.salvage;
                    this.state.salvage = Math.min(this.state.maxSalvage, this.state.salvage + result.reward.amount);
                    if (this.state.salvage === this.state.maxSalvage && old < this.state.maxSalvage) {
                        this.state.addLog("STORAGE WARNING: Salvage capacity reached!");
                    }
                }
                if (result.reward.resource === 'energy') {
                    this.state.energy = Math.min(100, this.state.energy + result.reward.amount);
                }
            }
        }

        // Modify message to indicate remote operation
        const remoteMsg = result.message.replace('Probe returned', 'Remote probe returned');
        this.state.addLog(remoteMsg);

        this.state.emitUpdates();

        // Refresh the nav view tactical panel
        this.navView.handlePlanetSelect(targetPlanet);
    }

    getProbeItem(planet) {
        let pool = [];

        // Logic for pool selection
        if (planet.type === 'VITAL' || (planet.tags && planet.tags.includes('VITAL_FLORA'))) {
            pool.push(ITEMS.RADIOTROPHIC_FUNGUS, ITEMS.AMBER_SPECIMEN);
        }
        if (['ROCKY', 'DESERT', 'VOLCANIC'].includes(planet.type)) {
            pool.push(ITEMS.GEODE_SAMPLE, ITEMS.OBSIDIAN_MONOLITH);
        }
        if (planet.tags && (planet.tags.includes('ANCIENT_RUINS') || planet.tags.includes('ALIEN_SIGNALS'))) {
            pool.push(ITEMS.SCRAP_PLATING, ITEMS.TECH_FRAGMENT);
        }

        // Fallback if no specific pool match or pool empty
        // Exclude Exodus-exclusive items (human supplies only found in derelict wrecks)
        const exodusOnly = ['food_pack', 'chocolate', 'holotape'];
        if (pool.length === 0) pool = Object.values(ITEMS).filter(i => !exodusOnly.includes(i.id));

        // Return random item from pool
        const template = pool[Math.floor(Math.random() * pool.length)];
        return { ...template, acquiredAt: planet.name };
    }

    selectEvaTeam() {
        // Priority: SECURITY > ENGINEER > SPECIALIST > MEDIC
        const priority = ['SECURITY', 'ENGINEER', 'SPECIALIST', 'MEDIC'];
        const eligible = this.state.crew.filter(c => c.status === 'HEALTHY' && !c.tags.includes('LEADER'));
        const team = [];
        for (const role of priority) {
            if (team.length >= 2) break;
            const member = eligible.find(c => c.tags.includes(role) && !team.includes(c));
            if (member) team.push(member);
        }
        // Fill remaining slots from any eligible crew not yet selected
        for (const c of eligible) {
            if (team.length >= 2) break;
            if (!team.includes(c)) team.push(c);
        }
        return team;
    }

    handleEvaAction() {
        const planet = this.state.currentSystem;

        // THE STRUCTURE — Cannot EVA on this cosmic entity
        if (planet && planet.type === 'STRUCTURE') {
            this.state.addLog("A.U.R.A.: 'EVA is not possible. THE STRUCTURE has no surface in any conventional sense.'");
            this.state.addLog("A.U.R.A.: 'To interact with it, you must... approach it. Directly.'");
            return;
        }

        // THE WRONG PLACE — EVA is extremely dangerous
        if (planet && planet._isWrongPlace) {
            this.state.addLog("A.U.R.A.: 'WARNING: EVA in this location is inadvisable. Space itself is... wrong here.'");
            // Allow but add extra danger warning
        }

        // Commander stays on the bridge — only non-LEADER crew go on EVA
        const evaCrew = this.state.crew.filter(c => c.status === 'HEALTHY' && !c.tags.includes('LEADER'));
        const livingCrew = this.state.crew.filter(c => c.status !== 'DEAD');

        // BLEEDING_HEART (Aris stress trait): Refuses EVA unless ALL living crew are healthy
        if (this.state.hasActiveTrait('BLEEDING_HEART')) {
            const injured = livingCrew.filter(c => c.status === 'INJURED');
            if (injured.length > 0) {
                this.state.addLog(`Dr. Aris: "Absolutely not. ${injured[0].name} needs treatment first. No one goes out there."`);
                return;
            }
        }

        // 1. Check Requirements (need 2 EVA-eligible crew — Commander stays on bridge)
        if (evaCrew.length < 2) {
            this.state.addLog("MISSION ABORTED: Minimum 2 Healthy Crew required for EVA. Commander remains on bridge.");
            return;
        }

        // Select 2-person EVA team by priority
        const evaTeam = this.selectEvaTeam();

        // OBSESSED (Mira stress 3): EVA costs double energy and double rations
        const isObsessed = this.state.hasActiveTrait('OBSESSED');
        const evaCost = isObsessed ? 10 : 5;

        if (this.state.consumeEnergy(evaCost)) {
            const planet = this.state.currentSystem;

            // Bark: crew reacts before EVA
            if (typeof BarkSystem !== 'undefined' && window.BarkSystem) {
                window.BarkSystem.tryBark('BEFORE_EVA', this.state, { planet });
            }

            // Log the EVA team
            this.state.addLog(`EVA team deployed: ${evaTeam[0].name} and ${evaTeam[1].name}.`);

            // A.U.R.A. commentary on EVA
            if (typeof AuraSystem !== 'undefined' && window.AuraSystem) {
                window.AuraSystem.tryComment('EVA_DEPLOY', this.state);
            }

            // Consume rations (major action — double if obsessed)
            this.state.consumeRation();
            if (isObsessed) {
                this.state.consumeRation();
                this.state.addLog("Mira: Extended EVA window. Additional rations consumed.");
            }

            // Store EVA team for resolveEvaOutcome
            this.currentEvaTeam = evaTeam;

            // Special EDEN EVA — paradise world, unique peaceful encounter
            if (planet.type === 'EDEN') {
                this.showEdenEvaModal(planet);
                return;
            }

            // 2. Select Event
            let potentialEvents = EVENTS.filter(e => e.trigger(planet));
            if (potentialEvents.length === 0) potentialEvents = [EVENTS[EVENTS.length - 1]];

            // Prefer type-specific events over the generic fallback
            const specificEvents = potentialEvents.filter(e => e.id !== 'DISTRESS_BEACON');
            const selectedEvent = specificEvents.length > 0
                ? specificEvents[Math.floor(Math.random() * specificEvents.length)]
                : potentialEvents[potentialEvents.length - 1];

            this.showEventModal(selectedEvent, planet);
            planet.hasEva = true;
            this.orbitView.updateCommandDeck(planet);
        }
    }

    showEventModal(event, planet) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.zIndex = '2000';

        // === SIGNAL TYPE RISK MODIFIERS ===
        // Calculate base risk with signal type effects
        let riskBase = (planet.dangerLevel || 0) * 5 + 5; // Base risk 5% to 30%
        let signalModifiers = [];

        // BIOLOGICAL signals reduce risk (life = stable environment)
        if (planet.metrics && planet.metrics.hasLife) {
            riskBase -= 5;
            signalModifiers.push({ type: 'BIOLOGICAL', mod: -5, color: '#00ff66' });
        }

        // ALIEN SIGNALS increase risk (unknown = danger)
        if (planet.tags && planet.tags.includes('ALIEN_SIGNALS')) {
            riskBase += 10;
            signalModifiers.push({ type: 'ALIEN SIGNAL', mod: +10, color: '#ff00ff' });
        }

        // ANCIENT RUINS slightly reduce risk (stable structures)
        if (planet.tags && planet.tags.includes('ANCIENT_RUINS')) {
            riskBase -= 3;
            signalModifiers.push({ type: 'ANCIENT RUINS', mod: -3, color: '#ffcc00' });
        }

        // TECHNOLOGICAL signals reduce risk (machine-stable)
        if (planet.metrics && planet.metrics.hasTech && !planet.tags?.includes('ALIEN_SIGNALS')) {
            riskBase -= 5;
            signalModifiers.push({ type: 'TECHNOLOGICAL', mod: -5, color: '#00ccff' });
        }

        // DERELICT ships increase risk slightly (structural instability)
        if (planet.tags && planet.tags.includes('DERELICT')) {
            riskBase += 5;
            signalModifiers.push({ type: 'DERELICT', mod: +5, color: '#cc8800' });
        }

        // PREDATORY massively increases risk
        if (planet.tags && planet.tags.includes('PREDATORY')) {
            riskBase += 15;
            signalModifiers.push({ type: 'PREDATORY', mod: +15, color: '#ff0000' });
        }

        // Clamp risk base to reasonable range
        riskBase = Math.max(0, Math.min(50, riskBase));

        // Stress trait checks
        const isParanoid = this.state.hasActiveTrait('PARANOID');
        const isReckless = this.state.hasActiveTrait('RECKLESS');
        const recklessBlocksSafe = isReckless && Math.random() > 0.5; // 50% chance to block safe option

        // Build signal modifier display string
        const signalModDisplay = signalModifiers.length > 0
            ? signalModifiers.map(s => `<span style="color: ${s.color};">${s.type}: ${s.mod > 0 ? '+' : ''}${s.mod}%</span>`).join(' | ')
            : '';

        modal.innerHTML = `
            <div class="modal-content" style="border-color: var(--color-accent);">
                <div class="modal-header" style="color: var(--color-accent);">/// EVA MISSION: ${event.title} ///</div>
                <div style="padding: 20px; text-align: center;">
                    <p style="margin-bottom: 20px; font-style: italic;">"${event.desc}"</p>
                    ${signalModDisplay ? `<div style="font-size: 0.75em; margin-bottom: 15px; padding: 8px; border: 1px dashed var(--color-primary-dim); background: rgba(0,0,0,0.5);">
                        <span style="color: var(--color-text-dim);">SIGNAL ANALYSIS:</span> ${signalModDisplay}
                    </div>` : ''}
                    ${isParanoid ? '<p style="font-size: 0.8em; color: #ff6666; margin-bottom: 10px;">Vance: "I\'m not risking anyone on something that dangerous."</p>' : ''}
                    ${recklessBlocksSafe ? '<p style="font-size: 0.8em; color: #ffaa00; margin-bottom: 10px;">Mira: "The safe option gets us nothing. I\'m going in."</p>' : ''}

                    <div style="display: flex; gap: 20px; justify-content: center;">
                        ${event.choices.map((choice, idx) => {
            const totalRisk = riskBase + choice.riskMod;
            let riskLabel = "UNKNOWN";
            let riskColor = "var(--color-text-dim)";

            if (totalRisk < 10) { riskLabel = "NEGLIGIBLE"; riskColor = "var(--color-primary)"; }
            else if (totalRisk < 30) { riskLabel = "MODERATE"; riskColor = "#FFFF00"; }
            else if (totalRisk < 60) { riskLabel = "HIGH"; riskColor = "#FFA500"; }
            else { riskLabel = "EXTREME"; riskColor = "#FF0000"; }

            // PARANOID: disable high-risk choices (riskMod >= 30)
            const paranoidBlocked = isParanoid && choice.riskMod >= 30;
            // RECKLESS: disable safe choices (riskMod === 0) 50% of the time
            const recklessBlocked = recklessBlocksSafe && choice.riskMod === 0;
            const isDisabled = paranoidBlocked || recklessBlocked;
            const disabledReason = paranoidBlocked ? 'VANCE REFUSES' : (recklessBlocked ? 'MIRA OVERRIDES' : '');

            return `
                            <button class="choice-btn" data-idx="${idx}" data-risk-color="${riskColor}" style="
                                padding: 15px;
                                border: 1px solid ${isDisabled ? '#555' : 'var(--color-primary)'};
                                background: ${isDisabled ? 'rgba(30,0,0,0.8)' : 'rgba(0,0,0,0.8)'};
                                color: ${isDisabled ? '#666' : 'var(--color-primary)'};
                                cursor: ${isDisabled ? 'not-allowed' : 'pointer'};
                                flex: 1;
                                font-family: var(--font-mono);
                                transition: all 0.2s;
                                ${isDisabled ? 'pointer-events: none;' : ''}
                            " ${isDisabled ? 'disabled' : ''}>
                                <div>${choice.text}</div>
                                <div style="font-size: 0.8em; margin-top: 5px; color: ${riskColor}">RISK ASSESSMENT: ${riskLabel}</div>
                                ${isDisabled ? `<div style="font-size: 0.7em; margin-top: 5px; color: #ff4444;">[${disabledReason}]</div>` : ''}
                            </button>
                        `}).join('')}
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.querySelectorAll('.choice-btn:not([disabled])').forEach(btn => {
            btn.addEventListener('click', () => {
                const choice = event.choices[btn.dataset.idx];
                this.resolveEvaOutcome(choice, riskBase);
                modal.remove();
            });
        });

        // Hover effects - also change risk text color
        modal.querySelectorAll('.choice-btn').forEach(btn => {
            btn.onmouseenter = () => {
                btn.style.background = 'var(--color-primary)';
                btn.style.color = '#000';
                const riskDiv = btn.querySelector('div:nth-child(2)');
                if (riskDiv) riskDiv.style.color = '#000';
            };
            btn.onmouseleave = () => {
                btn.style.background = 'rgba(0,0,0,0.8)';
                btn.style.color = 'var(--color-primary)';
                const riskDiv = btn.querySelector('div:nth-child(2)');
                if (riskDiv) riskDiv.style.color = btn.dataset.riskColor || 'var(--color-text-dim)';
            };
        });
    }

    resolveEvaOutcome(choice, baseRisk) {
        const planet = this.state.currentSystem;
        let totalRisk = baseRisk + choice.riskMod;
        const roll = Math.random() * 100;
        let logMsg = "";

        // === PREDATORY PLANET SPECIAL HANDLING ===
        // Predatory ecosystems are EXTREMELY dangerous - additional attack chance
        const isPredatory = planet && planet.tags && planet.tags.includes('PREDATORY');
        let predatoryAttack = false;

        if (isPredatory) {
            // 40% chance of predator attack regardless of other outcomes
            if (Math.random() < 0.4) {
                predatoryAttack = true;
                this.state.addLog("⚠ PREDATOR ALERT: Hostile organisms detected approaching EVA team!");
            }
        }

        // 1. Hazard Check — only EVA team members (2 crew) can be hit
        const evaTeam = this.currentEvaTeam || [];
        if ((roll < totalRisk || predatoryAttack) && evaTeam.length > 0) {
            // INJURY or DEATH — pick randomly from the 2-person EVA team
            const severity = Math.random() * 100;
            const targetCrew = evaTeam[Math.floor(Math.random() * evaTeam.length)];

            // Predatory attacks are more likely to be fatal
            const deathThreshold = predatoryAttack ? 30 : 10;
            const deathFromHighRisk = totalRisk > 40;

            if (severity < deathThreshold || deathFromHighRisk) {
                targetCrew.status = 'DEAD';
                if (predatoryAttack) {
                    logMsg = `CATASTROPHE: ${targetCrew.name} killed by predatory organisms. The attack was coordinated. `;
                    this.state.addLog(`The creatures didn't just kill — they hunted. ${targetCrew.name} never had a chance.`);
                } else {
                    logMsg = `CATASTROPHE: ${targetCrew.name} KIA during operation. `;
                }
                window.dispatchEvent(new CustomEvent('crew-death', { detail: { crew: targetCrew } }));
            } else {
                targetCrew.status = 'INJURED';
                if (predatoryAttack) {
                    logMsg = `CRITICAL: ${targetCrew.name} mauled by predatory organisms. Emergency extraction! `;
                    this.state.addLog(`Dr. Aris: "The wounds are severe. Whatever attacked them knew where to bite."`);
                } else {
                    logMsg = `INCIDENT: ${targetCrew.name} sustained heavy injuries. `;
                }
                window.dispatchEvent(new CustomEvent('crew-injury', { detail: { crew: targetCrew } }));
            }
            // Stress: EVA casualty witnessed — +1 stress to all living crew
            this.state.crew.forEach(c => {
                if (c.status !== 'DEAD') {
                    c.stress = Math.min(3, (c.stress || 0) + 1);
                }
            });
            logMsg += "Crew morale shaken. ";

            // Bark: crew reacts to casualty
            if (typeof BarkSystem !== 'undefined' && window.BarkSystem) {
                if (targetCrew.status === 'DEAD') {
                    window.BarkSystem.tryBark('CREW_DEATH', this.state, { crew: targetCrew });
                } else {
                    window.BarkSystem.tryBark('CREW_INJURY', this.state, { crew: targetCrew });
                }
            }

            // A.U.R.A. reacts to crew death
            if (targetCrew.status === 'DEAD' && typeof AuraSystem !== 'undefined' && window.AuraSystem) {
                window.AuraSystem.tryComment('CREW_DEATH', this.state, true);
            }
        } else {
            logMsg = "Operations Successful. Team returned safely. ";

            // A.U.R.A. reacts to success (occasionally)
            if (Math.random() < 0.4 && typeof AuraSystem !== 'undefined' && window.AuraSystem) {
                window.AuraSystem.tryComment('SUCCESS', this.state);
            }
        }

        // 2. Reward
        // OBSESSED bonus: +50% resources or double items
        const isObsessed = this.state.hasActiveTrait('OBSESSED');

        if (choice.reward.type === 'RESOURCE') {
            let amount = 0;
            if (choice.reward.val === 'METALS') amount = 40 + Math.floor(Math.random() * 40);
            else if (choice.reward.val === 'METALS_HIGH') amount = 60 + Math.floor(Math.random() * 60);
            else amount = 30 + Math.floor(Math.random() * 20); // Energy

            if (isObsessed) {
                amount = Math.floor(amount * 1.5);
                logMsg += "Mira's obsessive sampling yields extra. ";
            }

            if (choice.reward.val.includes('METALS')) {
                const old = this.state.salvage;
                this.state.salvage = Math.min(this.state.maxSalvage, this.state.salvage + amount);
                logMsg += `Recovered ${amount} Salvage.`;
                if (this.state.salvage === this.state.maxSalvage && old < this.state.maxSalvage) {
                    logMsg += " (Storage Cap Reached)";
                }
            } else {
                this.state.energy = Math.min(100, this.state.energy + amount);
                logMsg += `Siphoned ${amount} Energy.`;
            }
        } else if (choice.reward.type === 'ITEM') {
            const item = this.getProbeItem(this.state.currentSystem);
            this.state.cargo.push(item);
            logMsg += `Secured Artifact: ${item.name}.`;

            // OBSESSED bonus: Mira finds a second item
            if (isObsessed) {
                const bonusItem = this.getProbeItem(this.state.currentSystem);
                this.state.cargo.push(bonusItem);
                logMsg += ` Mira also recovered: ${bonusItem.name}.`;
            }
        }

        this.state.addLog(logMsg);
        this.state.emitUpdates();
    }

    /**
     * EDEN EVA — Special peaceful encounter on paradise world.
     * No danger, guaranteed positive outcomes, emotional payoff.
     */
    showEdenEvaModal(planet) {
        const evaTeam = this.currentEvaTeam;
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.zIndex = '2000';

        modal.innerHTML = `
            <div class="modal-content" style="border-color: #44ff88; max-width: 700px;">
                <div class="modal-header" style="background: linear-gradient(90deg, #225533, #338844); color: #ffffff;">
                    /// EVA MISSION: PARADISE FOUND ///
                </div>
                <div style="padding: 25px;">
                    <p style="font-style: italic; color: #aaffcc; margin-bottom: 20px; line-height: 1.7; border-left: 3px solid #44ff88; padding-left: 15px;">
                        ${evaTeam[0].name} and ${evaTeam[1].name} step onto the surface.
                        <br><br>
                        The air is... breathable. Clean. Sweet, even. The ground is soft with grass that has never known boots.
                        <br><br>
                        Birds call in the distance — or something like birds. The sky is blue. A stream runs nearby, clear and cold.
                        <br><br>
                        For the first time since leaving Earth, the universe feels kind.
                    </p>
                    <div style="color: #88ffaa; margin-bottom: 20px; text-align: center;">
                        This world is perfect. There is no danger here. Only choices.
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        <button class="eden-choice" data-action="rest" style="
                            padding: 14px; text-align: left;
                            border: 1px solid #44ff88; background: rgba(30,80,50,0.7);
                            color: #ffffff; cursor: pointer; font-family: var(--font-mono);
                        ">
                            <div style="font-weight: bold; color: #88ffcc;">Rest and recover</div>
                            <div style="font-size: 0.85em; color: #aaffcc;">All crew stress cleared. Heal all injuries. This is what you needed.</div>
                        </button>
                        <button class="eden-choice" data-action="gather" style="
                            padding: 14px; text-align: left;
                            border: 1px solid #44ff88; background: rgba(30,80,50,0.7);
                            color: #ffffff; cursor: pointer; font-family: var(--font-mono);
                        ">
                            <div style="font-weight: bold; color: #88ffcc;">Gather fruit and fresh water</div>
                            <div style="font-size: 0.85em; color: #aaffcc;">+10 Rations. The land provides.</div>
                        </button>
                        <button class="eden-choice" data-action="explore" style="
                            padding: 14px; text-align: left;
                            border: 1px solid #44ff88; background: rgba(30,80,50,0.7);
                            color: #ffffff; cursor: pointer; font-family: var(--font-mono);
                        ">
                            <div style="font-weight: bold; color: #88ffcc;">Explore the valley</div>
                            <div style="font-size: 0.85em; color: #aaffcc;">+50 Salvage (natural materials). Mark colony site.</div>
                        </button>
                        <button class="eden-choice" data-action="remember" style="
                            padding: 14px; text-align: left;
                            border: 1px solid #44ff88; background: rgba(30,80,50,0.7);
                            color: #ffffff; cursor: pointer; font-family: var(--font-mono);
                        ">
                            <div style="font-weight: bold; color: #88ffcc;">Remember what you're fighting for</div>
                            <div style="font-size: 0.85em; color: #aaffcc;">+20 Energy (renewed purpose). All crew -1 stress.</div>
                        </button>
                        <div style="border-top: 1px dashed #44ff88; margin: 15px 0; padding-top: 15px;">
                            <button class="eden-choice eden-settle" data-action="settle" style="
                                padding: 14px; text-align: left; width: 100%;
                                border: 2px solid #ffcc00; background: linear-gradient(90deg, rgba(80,60,20,0.8), rgba(40,80,30,0.8));
                                color: #ffffff; cursor: pointer; font-family: var(--font-mono);
                            ">
                                <div style="font-weight: bold; color: #ffcc00; font-size: 1.1em;">⬡ END THE JOURNEY — Settle Here</div>
                                <div style="font-size: 0.85em; color: #aaffcc; margin-top: 5px;">This is what you came for. This is home now. <span style="color: #ffcc00;">[ENDS GAME]</span></div>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.querySelectorAll('.eden-choice').forEach(btn => {
            btn.onmouseenter = () => {
                btn.style.background = 'rgba(40,100,60,0.9)';
                btn.style.borderColor = '#88ffcc';
            };
            btn.onmouseleave = () => {
                btn.style.background = 'rgba(30,80,50,0.7)';
                btn.style.borderColor = '#44ff88';
            };
            btn.onclick = () => {
                const action = btn.dataset.action;

                switch (action) {
                    case 'rest':
                        // Full recovery - stress and injuries
                        this.state.crew.forEach(c => {
                            if (c.status !== 'DEAD') {
                                c.stress = 0;
                                if (c.status === 'INJURED') c.status = 'HEALTHY';
                            }
                        });
                        this.state.addLog(`${evaTeam[0].name} and ${evaTeam[1].name} found a quiet place by the stream. The whole crew rotated through in shifts.`);
                        this.state.addLog("For the first time in months, everyone truly rested. All stress cleared. All injuries healed.");
                        break;
                    case 'gather':
                        this.state.rations = Math.min(this.state.maxRations, this.state.rations + 10);
                        this.state.addLog("The fruit was unlike anything from Earth, but it tasted like coming home. +10 Rations.");
                        break;
                    case 'explore':
                        this.state.salvage = Math.min(this.state.maxSalvage, this.state.salvage + 50);
                        planet._colonyMarked = true;
                        this.state.addLog("The valley stretches for kilometers. Clean soil, fresh water, gentle climate. This could be home. +50 Salvage. Colony site marked.");
                        break;
                    case 'remember':
                        this.state.energy = Math.min(100, this.state.energy + 20);
                        this.state.crew.forEach(c => {
                            if (c.status !== 'DEAD') {
                                c.stress = Math.max(0, (c.stress || 0) - 1);
                            }
                        });
                        this.state.addLog(`${evaTeam[0].name}: "This is why we left Earth. This is what we're looking for."`);
                        this.state.addLog("Renewed purpose fills the crew. +20 Energy. All crew -1 stress.");
                        break;
                    case 'settle':
                        // End the journey - trigger colony ending immediately
                        modal.remove();
                        // Clear all stress and heal for the paradise ending
                        this.state.crew.forEach(c => {
                            if (c.status !== 'DEAD') {
                                c.stress = 0;
                                if (c.status === 'INJURED') c.status = 'HEALTHY';
                            }
                        });
                        this.state.addLog(`${evaTeam[0].name}: "Commander... we're staying, aren't we?"`);
                        this.state.addLog("Cmdr. Kael: \"Yes. The journey ends here. We're home.\"");
                        // Trigger the colony ending
                        this._executeColony(planet);
                        return; // Don't continue to normal exit
                }

                planet.hasEva = true;
                this.orbitView.updateCommandDeck(planet);
                this.state.emitUpdates();
                modal.remove();
            };
        });
    }

    handleLogUpdate(e) {
        const logContainer = document.getElementById('log-entries');
        if (!logContainer) return;
        let msg = e.detail?.message || "Log Updated";
        const entry = document.createElement('div');
        entry.className = 'log-entry new';

        // Style crew dialogue — detect "Name: " patterns for crew barks
        const crewColors = {
            'Eng. Jaxon': '#f0a030', 'Jaxon': '#f0a030',
            'Dr. Aris': '#40c8ff', 'Aris': '#40c8ff',
            'Spc. Vance': '#ff5050', 'Vance': '#ff5050',
            'Tech Mira': '#d070ff', 'Mira': '#d070ff',
            'A.U.R.A.': '#00ff88'
        };

        let styled = false;
        // Check for Commander (dynamic name: "Cmdr. LastName:")
        if (msg.startsWith('Cmdr.')) {
            const colonIdx = msg.indexOf(':');
            if (colonIdx > 0) {
                const name = msg.substring(0, colonIdx);
                const quote = msg.substring(colonIdx + 1).trim();
                entry.innerHTML = `<span style="color:#ffffff;font-weight:bold;">${name}:</span> <span style="color:#ffffff;opacity:0.85;font-style:italic;">${quote}</span>`;
                styled = true;
            }
        }
        if (!styled) {
            for (const [name, color] of Object.entries(crewColors)) {
                if (msg.startsWith(`${name}:`)) {
                    const quote = msg.substring(name.length + 1).trim();
                    entry.innerHTML = `<span style="color:${color};font-weight:bold;">${name}:</span> <span style="color:${color};opacity:0.85;font-style:italic;">${quote}</span>`;
                    styled = true;
                    break;
                }
            }
        }

        // Style warnings and critical messages
        if (!styled) {
            if (msg.startsWith('CRITICAL:') || msg.startsWith('CATASTROPHE:')) {
                entry.innerHTML = `<span style="color:#ff4444;font-weight:bold;text-shadow: 0 0 5px #ff0000;">${msg}</span>`;
                entry.classList.add('log-critical');
                styled = true;
            } else if (msg.startsWith('WARNING:') || msg.startsWith('ALERT:') || msg.includes('⚠')) {
                entry.innerHTML = `<span style="color:#ffaa00;font-weight:bold;">${msg}</span>`;
                entry.classList.add('log-warning');
                styled = true;
            } else if (msg.startsWith('HULL BREACH:')) {
                entry.innerHTML = `<span style="color:#ff4444;font-weight:bold;text-shadow: 0 0 5px #ff0000;">${msg}</span>`;
                entry.classList.add('log-critical');
                styled = true;
            } else if (msg.startsWith('REPAIR COMPLETE:') || msg.includes('recovered') || msg.includes('restored')) {
                entry.innerHTML = `<span style="color:#44ff88;">${msg}</span>`;
                styled = true;
            } else if (msg.startsWith('Sector ') && msg.includes('Generated')) {
                entry.innerHTML = `<span style="color:#44aaff;font-weight:bold;border-bottom:1px solid #44aaff;">${msg}</span>`;
                entry.classList.add('log-sector');
                styled = true;
            } else if (msg.startsWith('ANOMALY CONTACT:') || msg.includes('ANOMALY:')) {
                entry.innerHTML = `<span style="color:#d070ff;font-weight:bold;">${msg}</span>`;
                entry.classList.add('log-anomaly');
                styled = true;
            } else if (msg.startsWith('Colony') && (msg.includes('Established') || msg.includes('Success'))) {
                entry.innerHTML = `<span style="color:#44ff88;font-weight:bold;font-size:1.1em;text-shadow: 0 0 10px #44ff88;">${msg}</span>`;
                entry.classList.add('log-victory');
                styled = true;
            } else if (msg.includes('EVA team deployed') || msg.includes('Probe launched')) {
                entry.innerHTML = `<span style="color:#88ccff;">${msg}</span>`;
                styled = true;
            } else if (msg.includes('Warping to')) {
                entry.innerHTML = `<span style="color:#aaaaff;font-style:italic;">${msg}</span>`;
                styled = true;
            } else if (msg.includes('KIA') || msg.includes('has died') || msg.includes('DEAD')) {
                entry.innerHTML = `<span style="color:#ff4444;font-weight:bold;">${msg}</span>`;
                entry.classList.add('log-death');
                styled = true;
            } else if (msg.includes('stressed') || msg.includes('morale') || msg.includes('breakdown')) {
                entry.innerHTML = `<span style="color:#ff8844;">${msg}</span>`;
                styled = true;
            } else if (msg.includes('+') && (msg.includes('Salvage') || msg.includes('Energy') || msg.includes('Ration'))) {
                entry.innerHTML = `<span style="color:#88ff88;">${msg}</span>`;
                styled = true;
            } else if (msg.includes('-') && (msg.includes('Salvage') || msg.includes('Energy'))) {
                entry.innerHTML = `<span style="color:#ff8888;">${msg}</span>`;
                styled = true;
            }
        }

        if (!styled) {
            entry.innerHTML = msg;
        }

        logContainer.appendChild(entry);

        // Auto scroll force
        requestAnimationFrame(() => {
            logContainer.scrollTop = logContainer.scrollHeight;
        });
    }

    updateHud() {
        // Energy
        document.getElementById('res-energy').textContent = `${this.state.energy}%`;

        // Salvage (with cap)
        const s = this.state.salvage;
        const sMax = this.state.maxSalvage;
        const salvageEl = document.getElementById('res-salvage');
        if (salvageEl) {
            salvageEl.textContent = `${s}/${sMax}`;
            salvageEl.style.color = (s >= sMax) ? '#ffaa00' : 'var(--color-primary)';
        }

        // Rations (color-coded warnings)
        const rEl = document.getElementById('res-rations');
        if (rEl) {
            rEl.textContent = `${this.state.rations}/${this.state.maxRations}`;
            if (this.state.rations <= 2) rEl.style.color = '#ff4444';
            else if (this.state.rations <= 5) rEl.style.color = '#ffaa00';
            else rEl.style.color = 'var(--color-primary)';
        }

        // Crew status display on Quarters deck (visual dots)
        this.updateCrewStatusDisplay();

        // Date (advances with actions)
        document.getElementById('game-date').textContent = `DATE: 2342.${String(5 + Math.floor(this.state.actionsTaken / 10)).padStart(2, '0')}.${String(12 + (this.state.actionsTaken % 30)).padStart(2, '0')}`;

        // Sector name
        const SECTOR_NAMES = { 1: 'THE GRAVEYARD', 2: 'THE DARK VOID', 3: 'THE SIGNAL', 4: 'THE GARDEN', 5: 'THE EVENT HORIZON', 6: 'THE THRESHOLD' };
        const sectorEl = document.getElementById('sector-name');
        if (sectorEl) {
            sectorEl.textContent = `/// SECTOR ${this.state.currentSector}: ${SECTOR_NAMES[this.state.currentSector] || 'UNKNOWN'}`;
        }

        // Ship deck visual state
        this.updateDeckVisuals();
    }

    updateDeckVisuals() {
        Object.entries(this.state.shipDecks).forEach(([key, deck]) => {
            const deckEl = document.querySelector(`.ship-deck[data-room="${key}"]`);
            if (!deckEl) return;
            if (deck.status === 'DAMAGED') {
                deckEl.classList.add('deck-damaged');
            } else {
                deckEl.classList.remove('deck-damaged');
            }
        });
    }

    /**
     * Update crew status display on Quarters deck (visual dots showing crew health/stress)
     */
    updateCrewStatusDisplay() {
        const container = document.getElementById('deck-crew-status');
        if (!container) return;

        container.innerHTML = this.state.crew.map(c => {
            let statusClass = 'healthy';
            let title = `${c.name}: ${c.status}`;

            if (c.status === 'DEAD') {
                statusClass = 'dead';
                title = `${c.name}: DECEASED`;
            } else if (c.tags && c.tags.includes('SEDATED')) {
                statusClass = 'sedated';
                title = `${c.name}: SEDATED`;
            } else if (c.stress >= 3) {
                statusClass = 'critical';
                title = `${c.name}: CRITICAL STRESS!`;
            } else if (c.status === 'INJURED') {
                statusClass = 'injured';
                title = `${c.name}: INJURED`;
            } else if (c.stress >= 2) {
                statusClass = 'stressed';
                title = `${c.name}: HIGH STRESS`;
            }

            return `<div class="crew-dot ${statusClass}" title="${title}"></div>`;
        }).join('');

        // Make the whole quarters deck clickable to open crew manifest
        const quartersDeck = document.querySelector('.ship-deck[data-room="quarters"]');
        if (quartersDeck && !quartersDeck._crewClickAttached) {
            quartersDeck._crewClickAttached = true;
            quartersDeck.style.cursor = 'pointer';
            quartersDeck.addEventListener('click', (e) => {
                // Don't open if clicking the deck detail modal trigger
                if (e.target.closest('.deck-crew-status')) {
                    this.showCrewManifest();
                }
            });
        }
    }

    getStressBar(stress) {
        const s = stress || 0;
        const colors = ['#00ff41', '#ffff00', '#ffa500', '#ff4444']; // 0=green, 1=yellow, 2=orange, 3=red
        const barColor = colors[Math.min(s, 3)];
        let bar = '[';
        for (let i = 0; i < 3; i++) {
            bar += i < s ? `<span style="color:${barColor}">\u25A0</span>` : `<span style="opacity:0.3">\u25A1</span>`;
        }
        bar += ']';
        return bar;
    }

    showCrewManifest() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';

        const quartersOk = this.state.isDeckOperational('quarters');
        const canRest = quartersOk && this.state.rations >= 1;

        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">/// CREW MANIFEST /// <span class="close-modal">[X]</span></div>
                <div class="crew-list">
                    ${this.state.crew.map((c, idx) => {
            const isSedated = c.tags && c.tags.includes('SEDATED');
            const isConfined = c.tags && c.tags.includes('CONFINED');
            const color = c.status === 'DEAD' ? '#ff4444' : isSedated ? '#8888ff' : isConfined ? '#ff8888' : (c.status === 'INJURED' ? '#ffaa00' : 'var(--color-primary)');
            const borderColor = c.status === 'DEAD' ? '#ff4444' : isSedated ? '#8888ff' : isConfined ? '#ff8888' : 'var(--color-primary-dim)';
            const statusText = isSedated ? 'SEDATED' : isConfined ? 'CONFINED' : c.status;
            const showRest = c.status !== 'DEAD' && !isSedated && !isConfined && (c.stress || 0) > 0 && quartersOk;
            const restDisabled = !canRest;
            // Stress-based visual effects
            const stressLevel = c.stress || 0;
            const stressFilter = stressLevel >= 3 ? 'saturate(0.5) contrast(1.2) brightness(0.8)' :
                                 stressLevel === 2 ? 'saturate(0.7) sepia(0.2)' :
                                 stressLevel === 1 ? 'saturate(0.85)' : '';
            const stressGlow = stressLevel >= 3 ? '0 0 15px #ff0000, inset 0 0 20px rgba(255,0,0,0.3)' :
                               stressLevel === 2 ? '0 0 10px #ff6600' :
                               stressLevel === 1 ? '0 0 5px #ffaa00' : '';
            const stressOverlay = stressLevel >= 3 ? '<div style="position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(180deg,transparent 60%,rgba(255,0,0,0.3));pointer-events:none;"></div><div style="position:absolute;top:0;left:0;right:0;bottom:0;animation:stress-pulse 1s infinite;pointer-events:none;border-radius:inherit;box-shadow:inset 0 0 20px rgba(255,0,0,0.5);"></div>' :
                                  stressLevel === 2 ? '<div style="position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(180deg,transparent 70%,rgba(255,100,0,0.2));pointer-events:none;"></div>' :
                                  stressLevel === 1 ? '<div style="position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(180deg,transparent 80%,rgba(255,170,0,0.1));pointer-events:none;"></div>' : '';

            return `
                        <div class="crew-card" style="border: 1px solid ${borderColor}; color: ${color}; ${isSedated || isConfined ? 'opacity: 0.7;' : ''}">
                            <div class="crew-icon" style="position:relative; overflow: hidden; display: flex; align-items: center; justify-content: center; background: #000; filter: drop-shadow(0 0 5px ${color}); box-shadow: ${stressGlow}; ${isSedated ? 'filter: grayscale(50%) drop-shadow(0 0 5px #8888ff);' : ''}">
                                <img src="assets/crew/${c.portraitId || 1}.png"
                                     style="width: 100%; height: 100%; object-fit: cover; filter: ${stressFilter}; ${isSedated ? 'filter: grayscale(50%);' : ''}"
                                     onerror="this.style.display='none'; this.parentNode.innerHTML='${c.gender === 'AI' ? '🤖' : '👤'}';">
                                ${stressOverlay}
                            </div>
                            <div class="crew-details">
                                <div class="crew-name">${c.realName || c.name} <span style="font-size:0.7em; opacity:0.7;">(${c.name})</span></div>
                                <div class="crew-meta" style="color: ${color}; opacity: 0.8;">AGE: ${c.age || 'N/A'} | STATUS: ${statusText} | STRESS: ${this.getStressBar(c.stress)}</div>
                                <div class="crew-tags">${c.tags.filter(t => t !== 'SEDATED' && t !== 'CONFINED').join(' ')}${c.trait ? ` <span style="color:#ff4444;">[${c.trait}]</span>` : ''}
                                    ${isSedated ? `<span style="color:#8888ff; font-weight:bold; margin-left:5px;">[SEDATED - ${c._sedatedUntilWarp || '?'} warps]</span>` : ''}
                                    ${isConfined ? `<span style="color:#ff8888; font-weight:bold; margin-left:5px;">[CONFINED TO QUARTERS]</span>` : ''}
                                    ${showRest ? `<button class="rest-btn" data-idx="${idx}" style="
                                        margin-left: 10px; padding: 2px 8px; font-size: 0.8em;
                                        background: ${restDisabled ? '#333' : 'rgba(0,100,50,0.8)'};
                                        color: ${restDisabled ? '#666' : '#00ff88'};
                                        border: 1px solid ${restDisabled ? '#555' : '#00ff88'};
                                        cursor: ${restDisabled ? 'not-allowed' : 'pointer'};
                                        font-family: var(--font-mono);
                                    " ${restDisabled ? 'disabled' : ''}>REST (-1 RATION, -1 STRESS)</button>` : ''}
                                </div>
                            </div>
                        </div>
                    `;
        }).join('')}
                </div>
                ${!quartersOk ? '<div style="color:#ff4444;font-size:0.8em;text-align:center;padding:10px;">CREW QUARTERS OFFLINE — Rest unavailable</div>' : ''}
            </div>
        `;
        document.body.appendChild(modal);

        // REST button handlers
        modal.querySelectorAll('.rest-btn:not([disabled])').forEach(btn => {
            btn.onclick = () => {
                const idx = parseInt(btn.dataset.idx);
                const c = this.state.crew[idx];
                if (c && c.stress > 0 && this.state.rations >= 1) {
                    this.state.rations = Math.max(0, this.state.rations - 1);
                    c.stress = Math.max(0, c.stress - 1);
                    this.state.addLog(`${c.name}: Rest cycle authorized. Stress reduced. (-1 Ration)`);
                    this.state.emitUpdates();
                    modal.remove();
                    this.showCrewManifest(); // Refresh
                }
            };
        });

        modal.querySelector('.close-modal').onclick = () => modal.remove();
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    }

    showCargoInventory() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">/// CARGO HOLD /// <span class="close-modal">[X]</span></div>
                <div class="inventory-grid">
                    ${this.state.cargo.length === 0
                ? '<div style="grid-column: 1/-1; text-align: center; color: var(--color-text-dim); padding: 50px;">CARGO HOLD EMPTY</div>'
                : this.state.cargo.map((item, idx) => `
                            <div class="inv-item" style="display: flex; flex-direction: column; gap: 5px;">
                                <div class="item-name" style="font-weight: bold;">${item.name}</div>
                                <div class="item-desc" style="font-size: 0.7em; color: #888; font-style: italic;">${item.desc}</div>
                                <div style="margin-top: auto; display: flex; gap: 5px;">
                                    ${(item.onUse || (item.type && item.type.startsWith('REVIVAL_'))) ? `<button class="action-btn" data-idx="${idx}" style="font-size: 0.7em; padding: 2px 5px; cursor: pointer; background: var(--color-primary); border: none; font-weight: bold;">USE</button>` : ''}
                                    <div class="item-type" style="font-size: 0.7em; opacity: 0.5; margin-left: auto;">${item.type}</div>
                                </div>
                            </div>
                        `).join('')}
                </div>
                <div style="margin-top: 20px; text-align: right; font-size: 0.8em; color: var(--color-primary-dim);">
                    CAPACITY: ${this.state.cargo.length}/20 UNITS
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Use Handlers
        modal.querySelectorAll('.action-btn').forEach(btn => {
            btn.onclick = (e) => {
                const idx = parseInt(e.target.dataset.idx);
                this.handleItemUse(idx);
                modal.remove(); // Close to refresh/prevent double click
                this.showCargoInventory(); // Re-open updated
            };
        });

        modal.querySelector('.close-modal').onclick = () => modal.remove();
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    }

    handleItemUse(index) {
        const item = this.state.cargo[index];

        // SPECIAL HANDLERS
        if (item.type && item.type.startsWith('REVIVAL_')) {
            this.handleRevivalAction(item, index);
            return;
        }

        // STANDARD HANDLERS
        if (item && item.onUse) {
            const msg = item.onUse(this.state);
            this.state.cargo.splice(index, 1); // Remove from inventory
            this.state.addLog(`Used ${item.name}: ${msg}`);
            this.state.emitUpdates();
        }
    }

    handleRevivalAction(item, itemIndex) {
        const deadCrew = this.state.crew.filter(c => c.status === 'DEAD');
        if (deadCrew.length === 0) {
            this.showEventModal({
                title: "INVALID TARGET",
                desc: "No necrotic tissue detected on board. Reanimation protocol requires a valid biological host (deceased).",
                choices: [{ text: "CANCEL", riskMod: 0, reward: { type: 'NONE' } }]
            }, this.state.currentSystem);
            return;
        }

        // Show Selection Modal
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="border-color: #ff00ff;">
                <div class="modal-header" style="color: #ff00ff;">/// REANIMATION PROTOCOL /// <span class="close-modal">[X]</span></div>
                <div style="padding: 20px; text-align: center;">
                    <p>Select subject for integration with ${item.name}.</p>
                    <p style="color: #ff0000; font-size: 0.8em; margin-top: 10px;">
                        WARNING: PROCESS IS IRREVERSIBLE.<br>
                        Neural patterns will be reconstructed but altered. The entity returned may retain skills but lose self-identity.
                    </p>
                </div>
                <div class="crew-list">
                    ${deadCrew.map((c, idx) => `
                        <div class="crew-card status-dead clickable-revive" data-id="${c.id}" style="cursor: pointer; border: 1px solid #ff00ff;">
                            <div class="crew-icon">💀</div>
                            <div class="crew-details">
                                <div class="crew-name">${c.realName}</div>
                                <div class="crew-meta">ID: ${c.id}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelectorAll('.clickable-revive').forEach(card => {
            card.onclick = () => {
                const id = parseFloat(card.dataset.id);
                const target = this.state.crew.find(c => c.id === id);

                // Apply Revival — crew becomes HEALTHY but with special tag for ending calculations
                target.status = 'HEALTHY';
                target.stress = 1; // Some residual trauma
                target.wasRevived = true; // Track for endings

                if (item.type === 'REVIVAL_BIO') {
                    if (!target.tags.includes('HIVE_MIND')) target.tags.push('HIVE_MIND');
                    this.state.addLog(`BIOLOGICAL INTEGRATION COMPLETE: ${target.name} has returned.`);
                    this.state.addLog(`${target.name}: "I can hear them... the others who joined. They're still there, in the mycelium."`);
                } else {
                    if (!target.tags.includes('MACHINE_LINK')) target.tags.push('MACHINE_LINK');
                    this.state.addLog(`NEURAL OVERRIDE COMPLETE: ${target.name} has returned.`);
                    this.state.addLog(`${target.name}: "Efficiency. Purpose. The static is gone. Everything is... clear now."`);
                }

                // Other crew react
                const arisAlive = this.state.crew.find(c => c.tags.includes('MEDIC') && c.status !== 'DEAD');
                if (arisAlive) {
                    setTimeout(() => {
                        this.state.addLog(`Dr. Aris: "The readings are stable but... the neural patterns are different. They're ${target.name}, but also... something else."`);
                    }, 500);
                }

                // Consume Item
                this.state.cargo.splice(itemIndex, 1);

                modal.remove();
                this.state.emitUpdates();

                // Check for generic "cargo window" to close or refresh?
                // For now, simpler to just emit updates.
            };
        });

        modal.querySelector('.close-modal').onclick = () => modal.remove();
    }


    handleColonyAction() {
        const planet = this.state.currentSystem;

        // Colony warning in S1-S2 (crew advises against)
        const colonyConfig = (typeof SECTOR_CONFIG !== 'undefined') ? SECTOR_CONFIG[this.state.currentSector] : null;
        if (colonyConfig && colonyConfig.colonyWarning && !planet._colonyWarningShown) {
            this.showColonyWarningModal(planet, () => this._executeColony(planet));
            return;
        }

        // A.U.R.A. colony commentary
        if (typeof AuraSystem !== 'undefined' && window.AuraSystem) {
            window.AuraSystem.tryComment('COLONY_ATTEMPT', this.state, true);
        }

        this._executeColony(planet);
    }

    _executeColony(planet) {
        // Generate Outcome based on Planet Metrics
        const outcome = EndingSystem.getColonyOutcome(planet);

        if (outcome.success && window.AudioSystem) {
            window.AudioSystem.sfxVictory();
        }

        // Color code valid vs failed colonies
        const color = outcome.success ? '#00ff00' : '#ff4444';
        const survivors = this.state.crew.filter(c => c.status !== 'DEAD');
        const totalCrew = this.state.crew.length;
        const avgStress = survivors.length > 0 ? (survivors.reduce((a, c) => a + (c.stress || 0), 0) / survivors.length).toFixed(1) : 0;

        // Calculate colony rating
        const symbiotes = survivors.filter(c => c.tags?.includes('HIVE_MIND')).length;
        const cyborgs = survivors.filter(c => c.tags?.includes('MACHINE_LINK')).length;
        const wrongPlace = survivors.filter(c => c.tags?.includes('WRONG_PLACE_SURVIVOR')).length;
        const techLevel = this.state.upgrades?.length || 0;
        const colonyKnowledge = this.state._colonyKnowledge || 0;

        // Rating calculation
        let rating = 'C';
        let ratingColor = '#ffaa00';
        const score = (survivors.length * 20) + (techLevel * 10) + (colonyKnowledge * 5) - (avgStress * 10);
        if (outcome.success) {
            if (score >= 120) { rating = 'S'; ratingColor = '#ffcc00'; }
            else if (score >= 90) { rating = 'A'; ratingColor = '#00ff00'; }
            else if (score >= 60) { rating = 'B'; ratingColor = '#88ff88'; }
            else { rating = 'C'; ratingColor = '#ffaa00'; }
        } else {
            rating = 'F'; ratingColor = '#ff4444';
        }

        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:#000;color:' + color + ';z-index:10000;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:"Share Tech Mono",monospace;overflow-y:auto;padding:20px;';

        overlay.innerHTML = `
            <div style="width: 900px; max-width: 95vw; border: 2px solid ${color}; margin: auto;">
                <div style="background: ${color}; color: #000; padding: 8px 15px; font-weight: bold; display: flex; justify-content: space-between; font-size: 1.1em;">
                    <span>/// FLIGHT RECORDER: EXODUS-9</span>
                    <span>STATUS: ${outcome.success ? 'COLONY ESTABLISHED' : 'MISSION FAILED'}</span>
                </div>

                <!-- Stats Grid -->
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: ${color}33; padding: 1px;">
                    <div style="background: #000; padding: 12px; text-align: center;">
                        <div style="font-size: 0.7em; color: ${color}88; margin-bottom: 4px;">SURVIVORS</div>
                        <div style="font-size: 1.8em; font-weight: bold;">${survivors.length}<span style="font-size: 0.5em; opacity: 0.6;">/${totalCrew}</span></div>
                    </div>
                    <div style="background: #000; padding: 12px; text-align: center;">
                        <div style="font-size: 0.7em; color: ${color}88; margin-bottom: 4px;">AVG STRESS</div>
                        <div style="font-size: 1.8em; font-weight: bold; color: ${avgStress <= 1 ? '#88ff88' : avgStress <= 2 ? '#ffaa00' : '#ff4444'};">${avgStress}</div>
                    </div>
                    <div style="background: #000; padding: 12px; text-align: center;">
                        <div style="font-size: 0.7em; color: ${color}88; margin-bottom: 4px;">TECH LEVEL</div>
                        <div style="font-size: 1.8em; font-weight: bold; color: #00ccff;">${techLevel}</div>
                    </div>
                    <div style="background: #000; padding: 12px; text-align: center;">
                        <div style="font-size: 0.7em; color: ${color}88; margin-bottom: 4px;">COLONY RATING</div>
                        <div style="font-size: 1.8em; font-weight: bold; color: ${ratingColor};">${rating}</div>
                    </div>
                </div>

                <!-- Planet Stats -->
                <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 1px; background: ${color}22; padding: 1px; border-bottom: 1px solid ${color}44;">
                    <div style="background: #000; padding: 10px; text-align: center;">
                        <div style="font-size: 0.65em; color: ${color}66;">GRAVITY</div>
                        <div style="font-size: 1.1em;">${planet.metrics?.gravity?.toFixed(1) || '?'}G</div>
                    </div>
                    <div style="background: #000; padding: 10px; text-align: center;">
                        <div style="font-size: 0.65em; color: ${color}66;">TEMP</div>
                        <div style="font-size: 1.1em;">${planet.metrics?.temp || '?'}°C</div>
                    </div>
                    <div style="background: #000; padding: 10px; text-align: center;">
                        <div style="font-size: 0.65em; color: ${color}66;">ATMOSPHERE</div>
                        <div style="font-size: 0.9em;">${planet.atmosphere || '?'}</div>
                    </div>
                    <div style="background: #000; padding: 10px; text-align: center;">
                        <div style="font-size: 0.65em; color: ${color}66;">LIFE</div>
                        <div style="font-size: 1.1em; color: ${planet.metrics?.hasLife ? '#00ff66' : '#666'};">${planet.metrics?.hasLife ? 'YES' : 'NO'}</div>
                    </div>
                    <div style="background: #000; padding: 10px; text-align: center;">
                        <div style="font-size: 0.65em; color: ${color}66;">VIABILITY</div>
                        <div style="font-size: 0.9em; color: ${
                            EndingSystem.getPlanetViability(planet, this.state) === 'EXCELLENT' ? '#00ff00' :
                            EndingSystem.getPlanetViability(planet, this.state) === 'GOOD' ? '#88ff88' :
                            EndingSystem.getPlanetViability(planet, this.state) === 'MARGINAL' ? '#ffaa00' :
                            '#ff4444'
                        };">${EndingSystem.getPlanetViability(planet, this.state)}</div>
                    </div>
                </div>

                <!-- Planet & Crew Info -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; padding: 15px; border-bottom: 1px solid ${color}44;">
                    <div>
                        <div style="font-size: 0.75em; color: ${color}88; margin-bottom: 8px;">DESTINATION</div>
                        <div style="font-size: 1.1em;">${planet.name}</div>
                        <div style="font-size: 0.85em; opacity: 0.7;">Type: ${planet.type.replace('_', ' ')} | Sector ${this.state.currentSector}</div>
                    </div>
                    <div>
                        <div style="font-size: 0.75em; color: ${color}88; margin-bottom: 8px;">CREW MODIFICATIONS</div>
                        <div style="display: flex; gap: 10px; flex-wrap: wrap; font-size: 0.85em;">
                            ${symbiotes > 0 ? `<span style="color: #ff88ff;">Symbiotes: ${symbiotes}</span>` : ''}
                            ${cyborgs > 0 ? `<span style="color: #88ffff;">Cyborgs: ${cyborgs}</span>` : ''}
                            ${wrongPlace > 0 ? `<span style="color: #ff8844;">Touched: ${wrongPlace}</span>` : ''}
                            ${symbiotes === 0 && cyborgs === 0 && wrongPlace === 0 ? '<span style="opacity: 0.5;">None</span>' : ''}
                        </div>
                    </div>
                </div>

                <!-- Outcome Title -->
                <div style="background: linear-gradient(90deg, ${color}22, transparent); padding: 15px 20px; border-bottom: 1px solid ${color}44;">
                    <div style="font-size: 0.75em; color: ${color}88; margin-bottom: 5px;">COLONY DESIGNATION</div>
                    <div style="font-size: 1.6em; font-weight: bold; letter-spacing: 2px;">${outcome.title}</div>
                </div>

                <!-- Narrative Text -->
                <div style="padding: 25px; font-size: 1em; line-height: 1.8; max-height: 280px; overflow-y: auto; background: #0a0a0a;">
                    ${outcome.text}
                </div>

                <!-- Survivor List -->
                <div style="border-top: 1px solid ${color}44; padding: 15px; background: #050505;">
                    <div style="font-size: 0.75em; color: ${color}88; margin-bottom: 10px;">FINAL CREW ROSTER</div>
                    <div style="display: flex; gap: 15px; flex-wrap: wrap; font-size: 0.85em;">
                        ${this.state.crew.map(c => {
                            const isDead = c.status === 'DEAD';
                            const crewColor = isDead ? '#444' : color;
                            const tags = [];
                            if (c.tags?.includes('HIVE_MIND')) tags.push('SYM');
                            if (c.tags?.includes('MACHINE_LINK')) tags.push('CYB');
                            if (c.tags?.includes('WRONG_PLACE_SURVIVOR')) tags.push('WP');
                            return `<div style="color: ${crewColor}; ${isDead ? 'text-decoration: line-through;' : ''}">
                                ${c.name}${tags.length ? ' [' + tags.join(',') + ']' : ''}${isDead ? ' †' : ''}
                            </div>`;
                        }).join('')}
                    </div>
                </div>

                <!-- Footer -->
                <div style="background: ${color}; color: #000; padding: 10px 15px; text-align: center; font-weight: bold; font-size: 1.1em;">
                    EXODUS PROGRAM RECORD #${Math.floor(Math.random() * 90000) + 10000}
                </div>
            </div>

            <button onclick="location.reload()" style="margin-top: 20px; padding: 12px 30px; background: transparent; border: 2px solid ${color}; color: ${color}; font-size: 1em; cursor: pointer; font-family: inherit; transition: all 0.2s;">
                REBOOT SIMULATION
            </button>
        `;

        document.body.appendChild(overlay);
    }

    showDeckDetail(deckKey) {
        // Upgrades deck opens fabricator instead
        if (deckKey === 'upgrades') {
            this.showFabricator();
            return;
        }

        const deck = this.state.shipDecks[deckKey];
        if (!deck) return;

        const effects = {
            bridge: 'Navigation, remote scanning, A.U.R.A. core. DAMAGE: Warp +50% cost, remote scan disabled.',
            lab: 'Deep scanning, item identification. DAMAGE: Partial scan data, items unidentified.',
            quarters: 'Crew healing, stress recovery. DAMAGE: No passive healing, no stress recovery.',
            cargo: 'Inventory storage. DAMAGE: Cargo capacity halved to 10 units.',
            engineering: 'Probe fabrication, drives. DAMAGE: No probe fab, jump cost x2, repair cost +50%.'
        };

        let repairCost = deck.repairCost;
        const jaxonAlive = this.state.crew.some(c => c.tags.includes('ENGINEER') && c.status !== 'DEAD');
        if (jaxonAlive) repairCost = Math.floor(repairCost * 0.7);
        if (deckKey !== 'engineering' && this.state.shipDecks.engineering.status === 'DAMAGED') {
            repairCost = Math.floor(repairCost * 1.5);
        }

        const statusColor = deck.status === 'OPERATIONAL' ? 'var(--color-primary)' : '#ff4444';
        const canRepair = deck.status === 'DAMAGED' && this.state.salvage >= repairCost;

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header" style="color: ${statusColor};">/// ${deck.label} /// <span class="close-modal">[X]</span></div>
                <div style="padding: 20px;">
                    <div style="margin-bottom: 15px;">
                        <span style="color: ${statusColor}; font-weight: bold;">STATUS: ${deck.status}</span>
                    </div>
                    <div style="font-size: 0.85em; color: var(--color-text-dim); margin-bottom: 20px;">
                        ${effects[deckKey]}
                    </div>
                    ${deck.status === 'DAMAGED' ? `
                        <div style="border-top: 1px solid var(--color-primary-dim); padding-top: 15px;">
                            <div style="margin-bottom: 10px; font-size: 0.9em;">
                                REPAIR COST: ${repairCost} SALVAGE ${jaxonAlive ? '(Jaxon -30%)' : ''}
                                ${deckKey !== 'engineering' && this.state.shipDecks.engineering.status === 'DAMAGED' ? '(Eng. offline +50%)' : ''}
                            </div>
                            <div style="font-size: 0.8em; color: var(--color-text-dim); margin-bottom: 10px;">AVAILABLE: ${this.state.salvage} SALVAGE</div>
                            <button class="repair-btn" style="
                                width: 100%; padding: 10px;
                                background: ${canRepair ? 'var(--color-accent)' : '#333'};
                                color: ${canRepair ? '#000' : '#666'};
                                border: 1px solid ${canRepair ? 'var(--color-accent)' : '#555'};
                                cursor: ${canRepair ? 'pointer' : 'not-allowed'};
                                font-family: var(--font-mono); font-weight: bold;
                            " ${canRepair ? '' : 'disabled'}>
                                ${canRepair ? 'INITIATE REPAIR' : 'INSUFFICIENT SALVAGE'}
                            </button>
                        </div>
                    ` : `
                        <div style="color: var(--color-primary); font-size: 0.9em; text-align: center; padding: 10px; border: 1px solid var(--color-primary-dim);">
                            ALL SYSTEMS NOMINAL
                        </div>
                    `}
                    ${deckKey === 'cargo' ? `
                        <button class="cargo-btn" style="
                            width: 100%; padding: 10px; margin-top: 15px;
                            background: rgba(0,0,0,0.8); color: var(--color-primary);
                            border: 1px solid var(--color-primary);
                            cursor: pointer; font-family: var(--font-mono); font-weight: bold;
                        ">VIEW CARGO (${this.state.cargo.length}/20)</button>
                    ` : ''}
                    ${deckKey === 'engineering' ? `
                        <button class="fabricator-btn" style="
                            width: 100%; padding: 12px; margin-top: 15px;
                            background: ${deck.status === 'OPERATIONAL' ? 'var(--color-accent)' : '#333'};
                            color: ${deck.status === 'OPERATIONAL' ? '#000' : '#666'};
                            border: 1px solid ${deck.status === 'OPERATIONAL' ? 'var(--color-accent)' : '#555'};
                            cursor: ${deck.status === 'OPERATIONAL' ? 'pointer' : 'not-allowed'};
                            font-family: var(--font-mono); font-weight: bold;
                        " ${deck.status === 'DAMAGED' ? 'disabled' : ''}>
                            ${deck.status === 'OPERATIONAL' ? `ACCESS FABRICATOR (${this.state.upgrades.length} INSTALLED)` : 'FABRICATOR OFFLINE'}
                        </button>
                        <div style="margin-top: 10px; padding: 10px; border: 1px dashed var(--color-primary-dim); font-size: 0.8em; color: var(--color-text-dim);">
                            <div style="color: var(--color-accent); margin-bottom: 5px;">INSTALLED MODULES:</div>
                            ${this.state.upgrades.length > 0
                                ? this.state.upgrades.map(id => {
                                    const upg = Object.values(UPGRADES).find(u => u.id === id);
                                    return upg ? `<div style="margin: 3px 0;">• ${upg.name}</div>` : '';
                                }).join('')
                                : '<div style="font-style: italic;">None installed</div>'
                            }
                        </div>
                    ` : ''}
                    ${deckKey === 'quarters' ? `
                        <button class="crew-btn" style="
                            width: 100%; padding: 10px; margin-top: 15px;
                            background: rgba(0,0,0,0.8); color: var(--color-primary);
                            border: 1px solid var(--color-primary);
                            cursor: pointer; font-family: var(--font-mono); font-weight: bold;
                        ">VIEW CREW MANIFEST</button>
                    ` : ''}
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        if (canRepair) {
            modal.querySelector('.repair-btn').onclick = () => {
                this.state.repairDeck(deckKey);
                modal.remove();
            };
        }

        const cargoBtn = modal.querySelector('.cargo-btn');
        if (cargoBtn) {
            cargoBtn.onclick = () => {
                modal.remove();
                this.showCargoInventory();
            };
        }

        const fabBtn = modal.querySelector('.fabricator-btn');
        if (fabBtn && !fabBtn.disabled) {
            fabBtn.onclick = () => {
                modal.remove();
                this.showFabricator();
            };
        }

        const crewBtn = modal.querySelector('.crew-btn');
        if (crewBtn) {
            crewBtn.onclick = () => {
                modal.remove();
                this.showCrewManifest();
            };
        }

        modal.querySelector('.close-modal').onclick = () => modal.remove();
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    }

    /**
     * Handle anomaly teleportation - visual effect and view refresh
     */
    handleAnomalyTeleport(detail) {
        const { destination, type } = detail;

        // Create visual teleport effect
        const flash = document.createElement('div');
        flash.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            z-index: 9999; pointer-events: none;
            animation: teleport-flash 1.5s ease-out forwards;
        `;

        const style = document.createElement('style');
        if (type === 'WRONG_PLACE') {
            // Disturbing red/purple flash for wrong place
            style.textContent = `
                @keyframes teleport-flash {
                    0% { background: rgba(255, 0, 0, 0.8); }
                    20% { background: rgba(136, 0, 200, 0.9); }
                    40% { background: rgba(255, 255, 255, 1); }
                    60% { background: rgba(50, 0, 80, 0.8); }
                    80% { background: rgba(255, 0, 50, 0.4); }
                    100% { background: rgba(0, 0, 0, 0); }
                }
            `;
        } else {
            // Cyan/white flash for successful fold travel
            style.textContent = `
                @keyframes teleport-flash {
                    0% { background: rgba(0, 255, 255, 0.8); }
                    30% { background: rgba(255, 255, 255, 1); }
                    60% { background: rgba(0, 200, 255, 0.5); }
                    100% { background: rgba(0, 0, 0, 0); }
                }
            `;
        }

        document.head.appendChild(style);
        document.body.appendChild(flash);

        // Remove flash after animation
        setTimeout(() => {
            flash.remove();
            style.remove();
        }, 1500);

        // Refresh the view after a short delay
        setTimeout(() => {
            const sectorNameEl = document.getElementById('sector-name');

            if (type === 'WRONG_PLACE') {
                // Update sector display for wrong place
                if (sectorNameEl) {
                    sectorNameEl.textContent = '/// SECTOR ???: THE WRONG PLACE';
                    sectorNameEl.style.color = '#ff4444';
                    sectorNameEl.style.animation = 'pulse 1s infinite';
                }
            } else if (type === 'FOLD_SUCCESS') {
                // Update sector display for successful fold jump
                if (sectorNameEl) {
                    const SECTOR_NAMES = {
                        1: 'THE GRAVEYARD', 2: 'THE DEEP', 3: 'THE INTERFERENCE',
                        4: 'THE GARDEN', 5: 'THE EVENT HORIZON', 6: 'THE THRESHOLD'
                    };
                    sectorNameEl.textContent = `/// SECTOR ${this.state.currentSector}: ${SECTOR_NAMES[this.state.currentSector] || 'UNKNOWN'}`;
                    sectorNameEl.style.color = '#00ffff';
                    sectorNameEl.style.animation = 'none';
                    // Flash cyan then return to normal
                    setTimeout(() => {
                        sectorNameEl.style.color = 'var(--color-accent)';
                    }, 2000);
                }
                // Render nav view since we're in a new sector
                this.renderNav();
                return;
            }

            this.state.emitUpdates();
            this.renderOrbit();
        }, 800);
    }

    showGameOver(detail) {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: #000; color: #ff4444; z-index: 10000;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            font-family: 'Share Tech Mono', monospace;
        `;
        overlay.innerHTML = `
            <div style="width: 700px; max-width: 90vw; border: 2px solid #ff4444; padding: 2px;">
                <div style="background: #ff4444; color: #000; padding: 5px 10px; font-weight: bold; display: flex; justify-content: space-between;">
                    <span>/// MISSION FAILED</span>
                    <span>${detail.title}</span>
                </div>
                <div style="padding: 40px; font-size: 1.1em; line-height: 1.8; text-align: center;">
                    ${detail.message}
                </div>
                <div style="border-top: 1px solid #ff4444; padding: 15px; text-align: center; font-size: 0.8em; color: #ff444488;">
                    SECTOR: ${this.state.currentSector} | ACTIONS: ${this.state.actionsTaken} | SALVAGE: ${this.state.salvage}
                </div>
            </div>
            <button onclick="location.reload()" style="
                margin-top: 30px; padding: 15px 30px; background: transparent;
                border: 1px solid #ff4444; color: #ff4444; font-size: 1em;
                cursor: pointer; font-family: inherit;
            ">REBOOT SIMULATION</button>
        `;
        document.body.appendChild(overlay);
    }

    showMutinyEvent(detail) {
        const vance = detail.instigator;
        const commander = this.state.crew.find(c => c.tags.includes('LEADER') && c.status !== 'DEAD');
        if (!commander) return; // Commander already dead, mutiny is moot

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.zIndex = '3000';
        modal.innerHTML = `
            <div class="modal-content" style="border-color: #ff4444; max-width: 550px;">
                <div class="modal-header" style="background: #ff4444; color: #000;">/// MUTINY ///</div>
                <div style="padding: 20px; text-align: center;">
                    <p style="margin-bottom: 15px; color: #ff6666; font-style: italic;">
                        "${vance.name} has drawn his sidearm. He demands ${commander.name} step down."
                    </p>
                    <p style="margin-bottom: 20px; font-size: 0.9em; color: var(--color-text-dim);">
                        "You've led us into hell. Every decision, every death — on your head. Stand down, or I will put you down."
                    </p>
                    <div style="display: flex; gap: 15px; justify-content: center;">
                        <button class="mutiny-choice" data-choice="support" style="
                            flex: 1; padding: 15px; border: 1px solid var(--color-primary);
                            background: rgba(0,0,0,0.8); color: var(--color-primary);
                            cursor: pointer; font-family: var(--font-mono);
                        ">
                            <div>SUPPORT COMMANDER</div>
                            <div style="font-size: 0.7em; margin-top: 5px; color: var(--color-text-dim);">Vance will be restrained</div>
                        </button>
                        <button class="mutiny-choice" data-choice="side" style="
                            flex: 1; padding: 15px; border: 1px solid #ff4444;
                            background: rgba(40,0,0,0.8); color: #ff4444;
                            cursor: pointer; font-family: var(--font-mono);
                        ">
                            <div>SIDE WITH VANCE</div>
                            <div style="font-size: 0.7em; margin-top: 5px; color: var(--color-text-dim);">Commander will be confined</div>
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelectorAll('.mutiny-choice').forEach(btn => {
            btn.addEventListener('click', () => {
                const choice = btn.dataset.choice;
                if (choice === 'support') {
                    // Vance is restrained and sedated - cannot participate in actions
                    vance.status = 'INJURED';
                    vance.stress = 1;
                    vance.trait = null;
                    vance.breakdownFired = false;
                    vance.tags = vance.tags || [];
                    if (!vance.tags.includes('SEDATED')) vance.tags.push('SEDATED');
                    vance._sedatedUntilWarp = 2; // Sedated for 2 warps
                    this.state.addLog(`Mutiny suppressed. ${vance.name} has been restrained and sedated.`);
                    this.state.addLog(`${vance.name} will remain sedated and unable to participate in away missions.`);
                    // Commander gains +1 stress from the confrontation
                    commander.stress = Math.min(3, (commander.stress || 0) + 1);
                } else {
                    // Commander is confined: remove LEADER tag effectively, set to INJURED
                    commander.status = 'INJURED';
                    commander.stress = Math.min(3, (commander.stress || 0) + 1);
                    commander.tags = commander.tags || [];
                    if (!commander.tags.includes('CONFINED')) commander.tags.push('CONFINED');
                    this.state.addLog(`${commander.name} has been relieved of command and confined to quarters.`);
                    this.state.addLog(`${vance.name} assumes tactical control.`);
                    // Vance calms down
                    vance.stress = 1;
                    vance.trait = null;
                    vance.breakdownFired = false;
                }
                this.state.emitUpdates();
                modal.remove();
            });
        });
    }

    renderNav() {
        const mainView = document.getElementById('main-view');
        mainView.innerHTML = '';
        mainView.appendChild(this.navView.render(this.state.sectorNodes));
        const rightPanel = document.getElementById('tactical-display');
        if (rightPanel) rightPanel.innerHTML = '<div class="placeholder-grid">NO TARGET SELECTED</div>';
    }

    renderOrbit() {
        const mainView = document.getElementById('main-view');
        mainView.innerHTML = '';
        mainView.appendChild(this.orbitView.render());
    }

    showFabricator() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="border-color: var(--color-accent);">
                <div class="modal-header" style="color: var(--color-accent);">/// FABRICATOR MODULE /// <span class="close-modal">[X]</span></div>
                <div class="inventory-grid">
                    ${Object.values(UPGRADES).map(upg => {
            const installed = this.state.upgrades.includes(upg.id);
            const hoarderActive = this.state.hasActiveTrait('HOARDER');
            const effectiveCost = hoarderActive ? Math.ceil(upg.cost * 1.25) : upg.cost;
            const canAfford = this.state.salvage >= effectiveCost;
            const costLabel = hoarderActive ? `${effectiveCost} SALVAGE (HOARDER +25%)` : `${effectiveCost} SALVAGE`;
            const btnText = installed ? "INSTALLED" : (canAfford ? `BUY (${costLabel})` : `NEED ${costLabel}`);
            const btnStyle = installed ? 'background: #333; cursor: default;' : (canAfford ? 'background: var(--color-accent); color: #000;' : 'opacity: 0.5; cursor: not-allowed;');

            return `
                        <div class="inv-item" style="border-color: var(--color-accent);">
                            <div class="item-name">${upg.name}</div>
                            <div class="item-desc" style="color:#aaa;">${upg.desc}</div>
                            <div style="font-size: 0.8em; color: #fff; margin: 5px 0;">EFFECT: ${upg.effect}</div>
                            <button class="fab-buy-btn" data-id="${upg.id}" style="width: 100%; margin-top: auto; padding: 5px; font-weight: bold; border: none; ${btnStyle}" ${(!canAfford || installed) ? 'disabled' : ''}>
                                ${btnText}
                            </button>
                        </div>
                    `}).join('')}
                </div>
                <div style="margin-top: 20px; text-align: right; color: var(--color-primary);">AVAILABLE SALVAGE: ${this.state.salvage}</div>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelectorAll('.fab-buy-btn').forEach(btn => {
            btn.onclick = () => {
                if (!btn.disabled) this.buyUpgrade(btn.dataset.id, modal);
            };
        });

        modal.querySelector('.close-modal').onclick = () => modal.remove();
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    }

    buyUpgrade(id, modal) {
        const upg = Object.values(UPGRADES).find(u => u.id === id);
        const hoarderActive = this.state.hasActiveTrait('HOARDER');
        const effectiveCost = hoarderActive ? Math.ceil(upg.cost * 1.25) : upg.cost;
        if (upg && this.state.salvage >= effectiveCost) {
            this.state.salvage -= effectiveCost;
            this.state.upgrades.push(id);
            this.state.addLog(`FABRICATION COMPLETE: ${upg.name} installed.`);
            if (window.AudioSystem) window.AudioSystem.sfxInteract(); // Re-use interact sfx

            // Refresh
            modal.remove();
            this.showFabricator();
            this.state.emitUpdates();
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // SHIP MALFUNCTION MODAL
    // ═══════════════════════════════════════════════════════════════
    showShipMalfunctionModal(event) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.zIndex = '2800';

        // Build dialogue HTML
        const dialogueHtml = event.dialogue.map(d => {
            const colors = {
                'Eng. Jaxon': '#f0a030', 'Dr. Aris': '#40c8ff', 'Spc. Vance': '#ff5050',
                'Tech Mira': '#d070ff', 'A.U.R.A.': '#00ff88'
            };
            const color = colors[d.speaker] || '#ffffff';
            return `<div style="margin-bottom: 10px;">
                <span style="color:${color}; font-weight: bold;">${d.speaker}:</span>
                <span style="color:${color}; opacity: 0.85; font-style: italic;"> "${d.text}"</span>
            </div>`;
        }).join('');

        modal.innerHTML = `
            <div class="modal-content" style="border-color: #ff6600; max-width: 550px;">
                <div class="modal-header" style="background: linear-gradient(90deg, #331100, #552200); color: #ff6600; display: flex; justify-content: space-between;">
                    <span>⚠ SHIP ALERT: ${event.title.toUpperCase()} ⚠</span>
                </div>
                <div style="padding: 20px;">
                    <div style="font-size: 0.9em; color: var(--color-text-dim); margin-bottom: 15px; line-height: 1.6; font-style: italic; border-left: 2px solid #ff6600; padding-left: 12px;">
                        ${event.context}
                    </div>
                    <div style="border-left: 2px solid #333; padding-left: 15px; margin-bottom: 20px;">
                        ${dialogueHtml}
                    </div>
                    <button class="malfunction-acknowledge" style="
                        width: 100%; padding: 12px;
                        background: #ff6600; color: #000;
                        border: none; cursor: pointer;
                        font-family: var(--font-mono); font-weight: bold; font-size: 1em;
                    ">ACKNOWLEDGE</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Apply effect and close on acknowledge
        modal.querySelector('.malfunction-acknowledge').onclick = () => {
            const result = event.effect(this.state);
            if (result) {
                this.state.addLog(`MALFUNCTION RESOLVED: ${result}`);
            }
            this.state.emitUpdates();
            modal.remove();
        };

        // Also close on background click
        modal.onclick = (e) => {
            if (e.target === modal) {
                const result = event.effect(this.state);
                if (result) {
                    this.state.addLog(`MALFUNCTION RESOLVED: ${result}`);
                }
                this.state.emitUpdates();
                modal.remove();
            }
        };
    }

    // ═══════════════════════════════════════════════════════════════
    // AUDIO SETTINGS MODAL
    // ═══════════════════════════════════════════════════════════════
    showAudioModal() {
        const isOn = window.AudioSystem && !window.AudioSystem.muted;
        const currentVol = window.AudioSystem ? Math.round((window.AudioSystem.musicVolume / 0.15) * 100) : 30;

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.zIndex = '3000';

        modal.innerHTML = `
            <div class="modal-content" style="border-color: var(--color-primary); max-width: 350px; text-align: center;">
                <div class="modal-header" style="display: flex; justify-content: space-between;">
                    <span>/// AUDIO SETTINGS ///</span>
                    <span class="close-modal" style="cursor: pointer;">[X]</span>
                </div>
                <div style="padding: 30px;">
                    <div style="margin-bottom: 25px;">
                        <button id="audio-toggle-btn" style="
                            padding: 15px 40px;
                            font-size: 1.2em;
                            font-family: var(--font-mono);
                            background: ${isOn ? 'var(--color-primary)' : '#333'};
                            color: ${isOn ? '#000' : '#666'};
                            border: 2px solid var(--color-primary);
                            cursor: pointer;
                            transition: all 0.2s;
                        ">${isOn ? 'AUDIO: ON' : 'AUDIO: OFF'}</button>
                    </div>
                    <div style="margin-bottom: 15px; color: var(--color-text-dim); font-size: 0.9em;">VOLUME</div>
                    <div style="display: flex; align-items: center; gap: 15px; justify-content: center;">
                        <span style="color: var(--color-text-dim);">🔈</span>
                        <input type="range" id="modal-volume-slider" min="0" max="100" value="${currentVol}" style="
                            width: 180px;
                            height: 8px;
                            cursor: pointer;
                            accent-color: var(--color-primary);
                        ">
                        <span style="color: var(--color-text-dim);">🔊</span>
                    </div>
                    <div id="volume-display" style="margin-top: 10px; color: var(--color-primary); font-size: 1.1em;">${currentVol}%</div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const toggleBtn = modal.querySelector('#audio-toggle-btn');
        const slider = modal.querySelector('#modal-volume-slider');
        const volDisplay = modal.querySelector('#volume-display');
        const headerBtn = document.getElementById('btn-audio');

        toggleBtn.onclick = () => {
            if (window.AudioSystem) {
                const isMuted = window.AudioSystem.toggleMute();
                toggleBtn.textContent = isMuted ? 'AUDIO: OFF' : 'AUDIO: ON';
                toggleBtn.style.background = isMuted ? '#333' : 'var(--color-primary)';
                toggleBtn.style.color = isMuted ? '#666' : '#000';
                // Update header button
                if (headerBtn) {
                    headerBtn.textContent = isMuted ? "AUDIO: OFF" : "AUDIO: ON";
                    headerBtn.style.opacity = isMuted ? "0.5" : "1";
                    headerBtn.style.color = isMuted ? "var(--color-primary-dim)" : "var(--color-primary)";
                    headerBtn.style.borderColor = isMuted ? "var(--color-primary-dim)" : "var(--color-primary)";
                }
            }
        };

        slider.oninput = () => {
            const vol = parseInt(slider.value) / 100;
            volDisplay.textContent = slider.value + '%';
            if (window.AudioSystem) {
                window.AudioSystem.masterGain.gain.setValueAtTime(vol * 0.3, window.AudioSystem.ctx.currentTime);
                window.AudioSystem.setMusicVolume(vol * 0.15);
            }
        };

        modal.querySelector('.close-modal').onclick = () => modal.remove();
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    }
}

// Start App when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
