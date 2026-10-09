
/**
 * BUNDLED APPLICATION FOR LOCAL EXECUTION
 * Merged to bypass ES Module CORS restrictions on file:// protocol.
 */

// --- TESTING MODE HELPER ---
// When TEST_MODE is enabled, biases random rolls toward rare/interesting outcomes.
// It exists only for testers: index.html?test=1 turns it on (and shows the TEST button). Players never see it.
const IS_TEST_BUILD = new URLSearchParams(location.search).get('test') === '1';
window.TEST_MODE = IS_TEST_BUILD;

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

// The crew go by first names only (docs/GAME_FLOW.md step 0). Older saves still carry the titled names.
const OLD_TITLED_NAMES = { 'Cmdr. Moon': 'Cora', 'Eng. Jaxon': 'Jaxon', 'Dr. Aris': 'Aris', 'Spc. Vance': 'Vance', 'Tech Mira': 'Mira' };
const firstNameOf = name => OLD_TITLED_NAMES[name] || name;
const withFirstNames = text => Object.entries(OLD_TITLED_NAMES).reduce((out, [old, first]) => out.split(old).join(first), String(text));

// --- 1. DATA & GENERATORS ---

class CrewGenerator {
    // All five are authored characters — the same people every run, so the player can get to know them.
    static generateCrew() {
        return [
            // Commander Cora Moon — the player's seat
            {
                id: Date.now() + Math.random(),
                name: 'Cora',
                realName: 'Cora Moon',
                gender: 'F',
                age: 36,
                portraitId: 'F_1',
                status: 'HEALTHY',
                stress: 0,
                trait: null,
                tags: ['LEADER']
            },
            // Jaxon — Engineer
            {
                id: Date.now() + Math.random() + 1,
                name: 'Jaxon',
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
            // Aris — Medic
            {
                id: Date.now() + Math.random() + 2,
                name: 'Aris',
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
                name: 'Vance',
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
                name: 'Mira',
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

        // --- Per-run counters (a new run must not inherit the last one's) ---
        this.stopsLeft = null;     // recomputed for the sector by getStopsLeft()
        this._stopsSector = null;
        this._cargoCountSeen = 0;  // see enforceCargoLimit()
        this.reliance = { auto: 0, manual: 0 }; // jobs handed to A.U.R.A. vs done by hand
        this.datedWrecks = [];     // wrecks dated with the disc: { hull, age, ly }, what DiscDating draws on its chart
        this._breachDone = false;  // sector 1's hole in the hull (Breach) happens once per run
        this._paidWarps = 0;       // warps to a new place (free courses too), so the breach never comes on the first one

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

        // --- Clear special state flags ---
        this._inWrongPlace = false;
        this._previousSectorNodes = null;
        this._previousSector = null;
        this.sectorNodes = [];

        // --- Clear event tracking (so events can trigger again) ---
        this._jaxonPhotoSeen = false;
        this._jaxonRepairSeen = false;
        this._arisPatientSeen = false;
        this._arisGardenSeen = false;
        this._vanceScarSeen = false;
        this._vanceWatchSeen = false;
        this._miraWonderSeen = false;
        this._miraAuraSeen = false;
        this._commanderDoubtSeen = false;

        this.emitUpdates();
    }

    // === SAVE/LOAD SYSTEM ===

    /**
     * Save current game state to localStorage
     */
    saveGame() {
        const saveData = {
            version: 2,
            timestamp: Date.now(),
            // Resources
            energy: this.energy,
            salvage: this.salvage,
            maxSalvage: this.maxSalvage,
            rations: this.rations,
            maxRations: this.maxRations,
            // Probe
            probeIntegrity: this.probeIntegrity,
            // Cargo & Upgrades
            cargo: this.cargo,
            upgrades: this.upgrades,
            // A.U.R.A. (lives in its own singleton, so it has to be copied in by hand)
            stopsLeft: this.stopsLeft,
            stopsSector: this._stopsSector,
            reliance: this.reliance || null,
            datedWrecks: this.datedWrecks || [],
            _breachDone: !!this._breachDone,
            _paidWarps: this._paidWarps || 0,
            aura: window.AuraSystem ? { ethicsScore: window.AuraSystem.ethicsScore, warningCount: window.AuraSystem.warningCount } : null,
            // Navigation
            currentSector: this.currentSector,
            currentSystem: this.currentSystem,
            lastVisitedSystemId: this.lastVisitedSystem ? this.lastVisitedSystem.id : null,   // where the ship is parked: re-entering its orbit is free
            sectorNodes: this.sectorNodes,
            // Ship
            shipDecks: this.shipDecks,
            // Crew
            crew: this.crew,
            // Progress
            actionsTaken: this.actionsTaken,
            exodusLogsFound: this.exodusLogsFound,
            _colonyKnowledge: this._colonyKnowledge,
            fungusActionCounter: this.fungusActionCounter,
            // Special states
            _inWrongPlace: this._inWrongPlace,
            _previousSectorNodes: this._previousSectorNodes,
            _previousSector: this._previousSector,
            // Event tracking
            _jaxonPhotoSeen: this._jaxonPhotoSeen,
            _jaxonRepairSeen: this._jaxonRepairSeen,
            _arisPatientSeen: this._arisPatientSeen,
            _arisGardenSeen: this._arisGardenSeen,
            _vanceScarSeen: this._vanceScarSeen,
            _vanceWatchSeen: this._vanceWatchSeen,
            _miraWonderSeen: this._miraWonderSeen,
            _miraAuraSeen: this._miraAuraSeen,
            _commanderDoubtSeen: this._commanderDoubtSeen,
            // The journey (lost on reload before: the one callback the game had, and the lists that stop stories repeating)
            _boardedHulls: this._boardedHulls || [],
            _standing: this._standing || null,
            _countSceneSeen: !!this._countSceneSeen,
            _tutorialWarpSeen: !!this._tutorialWarpSeen,   // A.U.R.A.'s first-time lines are said once per run, not once per load
            _tutorialEvaSeen: !!this._tutorialEvaSeen,
            _sleepers: this._sleepers || 0,
            _warpDiscount: this._warpDiscount || 0,
            _seenAnomalies: this._seenAnomalies || [],
            _encounteredShipNames: this._encounteredShipNames || [],
            _encounteredExodus: this._encounteredExodus || [],
            _seenCampfires: this._seenCampfires || [],
            _followedSignal: !!this._followedSignal,
            _lighthouseBonus: !!this._lighthouseBonus,
            _damagedCapacitors: this._damagedCapacitors || null,
            _driveReinforced: !!this._driveReinforced,
            // Logs (last 20 only to save space)
            logs: this.logs.slice(-20)
        };

        try {
            localStorage.setItem('silentExodus_save', JSON.stringify(saveData));
            return true;
        } catch (e) {
            console.error('Failed to save game:', e);
            return false;
        }
    }

    /**
     * Load game state from localStorage
     */
    loadGame() {
        try {
            const saveStr = localStorage.getItem('silentExodus_save');
            if (!saveStr) return false;

            const saveData = JSON.parse(saveStr);

            // Resources
            this.energy = saveData.energy;
            this.salvage = saveData.salvage;
            this.maxSalvage = saveData.maxSalvage;
            this.rations = saveData.rations;
            this.maxRations = saveData.maxRations;
            // Probe
            this.probeIntegrity = saveData.probeIntegrity;
            // Cargo & Upgrades
            // JSON drops functions, so saved items lose their onUse(); give each one back its behaviour from ITEMS
            const itemDefs = (typeof ITEMS !== 'undefined') ? Object.values(ITEMS) : [];
            const pageDefs = (typeof EXODUS_LOGS !== 'undefined') ? EXODUS_LOGS : [];
            this.cargo = (saveData.cargo || []).map(saved => {
                const page = pageDefs.find(d => d.id === saved.id);
                if (page) return window.app ? window.app.pageItem(page, saved.acquiredAt) : { ...page, ...saved };
                const def = itemDefs.find(d => d.id === saved.id);
                return def ? { ...def, ...saved, onUse: def.onUse } : saved;
            });
            this.upgrades = saveData.upgrades || [];
            this.stopsLeft = saveData.stopsLeft;
            this._stopsSector = saveData.stopsSector;
            this.reliance = saveData.reliance || { auto: 0, manual: 0 };
            this.datedWrecks = saveData.datedWrecks || [];            // saves from before the disc dating have none
            this._breachDone = !!saveData._breachDone;
            this._paidWarps = saveData._paidWarps || 0;
            if (saveData.aura && window.AuraSystem) {
                window.AuraSystem.ethicsScore = saveData.aura.ethicsScore || 0;
                window.AuraSystem.warningCount = saveData.aura.warningCount || 0;
            }
            // Navigation
            this.currentSector = saveData.currentSector;
            this.sectorNodes = saveData.sectorNodes || [];
            const nodeById = id => (id == null ? null : this.sectorNodes.find(n => n.id === id) || null);   // the map's own planet, not a copy
            this.currentSystem = saveData.currentSystem ? nodeById(saveData.currentSystem.id) : null;
            this.lastVisitedSystem = nodeById(saveData.lastVisitedSystemId) || this.currentSystem;
            // Ship
            this.shipDecks = saveData.shipDecks;
            // Crew (saves from before first names had "Eng. Jaxon" and the like: those become first names, in the log too)
            this.crew = (saveData.crew || []).map(c => ({ ...c, name: firstNameOf(c.name) }));
            // Progress
            this.actionsTaken = saveData.actionsTaken;
            const pageIds = (typeof EXODUS_LOGS !== 'undefined' ? EXODUS_LOGS : []).map(p => p.id);
            this.exodusLogsFound = (saveData.exodusLogsFound || []).filter(id => pageIds.includes(id)); // old saves counted eight logs by number
            this._boardedHulls = saveData._boardedHulls || [];
            this._standing = saveData._standing || ((saveData.version || 1) < 2 ? { vance: 2, aris: 2, jaxon: 2, mira: 2 } : null); // a save from before standing existed keeps every ending open
            this._countSceneSeen = !!saveData._countSceneSeen;
            this._tutorialWarpSeen = !!saveData._tutorialWarpSeen;
            this._tutorialEvaSeen = !!saveData._tutorialEvaSeen;
            this._sleepers = saveData._sleepers || 0;
            this._warpDiscount = saveData._warpDiscount || 0;
            this._seenAnomalies = saveData._seenAnomalies || [];
            this._encounteredShipNames = saveData._encounteredShipNames || [];
            this._encounteredExodus = saveData._encounteredExodus || [];
            this._seenCampfires = saveData._seenCampfires || [];
            this._followedSignal = !!saveData._followedSignal;
            this._lighthouseBonus = !!saveData._lighthouseBonus;
            this._damagedCapacitors = saveData._damagedCapacitors || null;
            this._driveReinforced = !!saveData._driveReinforced;
            this._colonyKnowledge = saveData._colonyKnowledge || 0;
            this.fungusActionCounter = saveData.fungusActionCounter || 0;
            // Special states
            this._inWrongPlace = saveData._inWrongPlace || false;
            this._previousSectorNodes = saveData._previousSectorNodes;
            this._previousSector = saveData._previousSector;
            // Event tracking
            this._jaxonPhotoSeen = saveData._jaxonPhotoSeen || false;
            this._jaxonRepairSeen = saveData._jaxonRepairSeen || false;
            this._arisPatientSeen = saveData._arisPatientSeen || false;
            this._arisGardenSeen = saveData._arisGardenSeen || false;
            this._vanceScarSeen = saveData._vanceScarSeen || false;
            this._vanceWatchSeen = saveData._vanceWatchSeen || false;
            this._miraWonderSeen = saveData._miraWonderSeen || false;
            this._miraAuraSeen = saveData._miraAuraSeen || false;
            this._commanderDoubtSeen = saveData._commanderDoubtSeen || false;
            // Logs
            this.logs = (saveData.logs || []).map(line => (typeof line === 'string' ? withFirstNames(line) : line));

            this.gameOver = false;
            this.emitUpdates();
            return true;
        } catch (e) {
            console.error('Failed to load game:', e);
            return false;
        }
    }

    /**
     * Check if a save exists
     */
    hasSave() {
        return localStorage.getItem('silentExodus_save') !== null;
    }

    /**
     * Delete save
     */
    deleteSave() {
        localStorage.removeItem('silentExodus_save');
    }

    /**
     * Get save info without loading
     */
    getSaveInfo() {
        try {
            const saveStr = localStorage.getItem('silentExodus_save');
            if (!saveStr) return null;
            const data = JSON.parse(saveStr);
            return {
                sector: data.currentSector,
                crew: data.crew.filter(c => c.status !== 'DEAD').length,
                timestamp: data.timestamp
            };
        } catch (e) {
            return null;
        }
    }

    /**
     * What warping to this place costs right now, the one price the map shows (docs/ECONOMY.md): 4-6 energy by distance,
     * then bridge damage, burnt capacitors (this sector only) and charts found on the way. No energy comes back on arrival.
     * Free: the orbit the ship is parked at, the light, and a story planet whose course a dated wreck gave us.
     */
    getWarpCost(planet) {
        if (this.isReentry(planet)) return 0;
        if (planet.isStructure || planet.type === 'STRUCTURE') return 0;               // the light pulls you in: never out of reach
        if (planet.courseKnown) return 0;                                               // their last course (App.dateWreck)
        const BRIDGE_DAMAGE_FACTOR = 1.5, BURNT_CAPACITOR_COST = 5, STAR_CHART_SAVING = 2;
        let cost = Math.floor(this.warpDistanceCost(planet) * (this.isDeckOperational('bridge') ? 1 : BRIDGE_DAMAGE_FACTOR));
        if (this._damagedCapacitors === this.currentSector) cost += BURNT_CAPACITOR_COST;
        if (this._lighthouseBonus) cost -= STAR_CHART_SAVING;
        if (this._warpDiscount) cost -= Math.round(cost * Math.min(50, this._warpDiscount) / 100);   // charts and couplers found on the way, as a percentage off
        return Math.max(1, cost);
    }

    /** Back into the orbit the ship is parked at: no warp, so no energy and no stop. */
    isReentry(planet) {
        return !!(planet && this.lastVisitedSystem && this.lastVisitedSystem.id === planet.id);
    }

    /** A warp's price before damage and charts: the further across the map from where the ship is, the more it costs. */
    warpDistanceCost(planet) {
        const WARP_NEAR = 4, WARP_FAR = 6, MAP_DISTANCE_PER_STEP = 30;   // under 30 (in map widths %) costs 4, under 60 costs 5, else 6
        const map = typeof NavView !== 'undefined' ? NavView : null;
        const to = map && map.mapPlace(planet);
        if (!to) return WARP_NEAR + 1;
        const from = (this.lastVisitedSystem && map.mapPlace(this.lastVisitedSystem)) || map.SHIP_START;
        return Math.min(WARP_FAR, WARP_NEAR + Math.floor(map.mapDistance(from, to) / MAP_DISTANCE_PER_STEP));
    }

    /** Who you sided with. Two of three moments gives you standing for that person's ending (docs/CANON.md §9). */
    noteStanding(who, delta) {
        this._standing = this._standing || { vance: 0, aris: 0, jaxon: 0, mira: 0 };
        this._standing[who] = (this._standing[who] || 0) + (delta == null ? 1 : delta);
    }
    hasStanding(who, needed) { return ((this._standing || {})[who] || 0) >= (needed == null ? 2 : needed); }

    /** The dead do not talk, and the commander is the player: neither gets a spoken line in the log. */
    isSilentSpeaker(message) {
        const spoken = String(message).match(/^(Cora|Cmdr\.[^:]{0,24}|Commander|Jaxon|Aris|Vance|Mira):\s/);
        if (!spoken) return false;
        if (/^C/.test(spoken[1])) return true;
        const last = spoken[1].split(' ').pop().toLowerCase();
        const member = (this.crew || []).find(c => c.name && c.name.toLowerCase().includes(last));
        return !!member && member.status === 'DEAD';
    }

    addLog(message) {
        if (this.isSilentSpeaker(message)) return;
        this.logs.push(message);
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }

        window.dispatchEvent(new CustomEvent('log-updated', {
            detail: { message }
        }));
    }

    /**
     * Add colony knowledge (data from failed colonies).
     * Shows A.U.R.A. comment when thresholds are reached.
     */
    addColonyKnowledge(amount, silent = false) {
        const prev = this._colonyKnowledge || 0;
        this._colonyKnowledge = prev + amount;

        if (!silent) {
            // A.U.R.A. comments at key thresholds
            if (prev < 1 && this._colonyKnowledge >= 1) {
                this.addLog('A.U.R.A.: "Filed, Commander. Everything we learn here goes toward the world we settle."');
            } else if (prev < 3 && this._colonyKnowledge >= 3) {
                this.addLog('A.U.R.A.: "We know more than any crew before us did, Commander. I have checked."');
            } else if (prev < 5 && this._colonyKnowledge >= 5) {
                this.addLog('A.U.R.A.: "The file is thick now, Commander. Whatever world you choose, we will do it properly."');
            }
        }

        this.emitUpdates();
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
        this.addLog("WARNING: Not enough Energy!");
        return false;
    }

    /**
     * Time passes: called on each major action (warp, team trip, boarding, digging, a strange site, the sector jump).
     * Nobody eats here: the crew eats on the jump (eatOnJump) and when a choice takes a day (docs/ECONOMY.md).
     * Injuries heal, a catatonic crew member comes back, and the cultures in the hold grow.
     */
    passTime() {
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

        // Symbiotic Culture: every 5 actions, 1 ration saved (it used to hand back the ration an action ate; actions eat nothing now)
        const hasSymbiotic = this.cargo.some(item => item.id === 'symbiotic_culture');
        if (hasSymbiotic && !cargoDamaged) {
            this.symbioticActionCounter = (this.symbioticActionCounter || 0) + 1;
            if (this.symbioticActionCounter >= 5) {
                this.symbioticActionCounter = 0;
                this.rations = Math.min(this.maxRations, this.rations + 1);
                this.addLog("Symbiotic Culture: Metabolic efficiency bonus. Ration consumption reduced.");
            }
        }

        // Passive injury healing: INJURED crew recover after 3 actions if quarters operational
        // CATATONIC crew cannot heal passively but recover from catatonia after 5 actions
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
                // CATATONIC recovery: after 5 actions, crew member snaps out of it
                if (c.trait === 'CATATONIC') {
                    c.catatonicCounter = (c.catatonicCounter || 0) + 1;
                    if (c.catatonicCounter >= 5) {
                        c.trait = null;
                        c.catatonicCounter = 0;
                        c.stress = 2; // Still stressed but no longer broken
                        c.breakdownFired = false; // Can have another breakdown if stress hits 3 again
                        this.addLog(`${c.name} stirs. Her eyes focus again. "I... I'm sorry. I couldn't face it anymore."`);
                        this.addLog(`${c.name} is responding again, but is still hurt and shaken.`);
                    }
                }
            });
        }

        this.emitUpdates();
    }

    /**
     * The sector jump: the crew eats (RATIONS_PER_JUMP). The only place rations are eaten besides "a day" on a card.
     * Short of food, stress climbs; on the third jump in a row with nothing to eat, someone dies.
     */
    eatOnJump() {
        const before = this.rations;
        this.rations = Math.max(0, this.rations - RATIONS_PER_JUMP);
        const eaten = before - this.rations;
        this.addLog(eaten > 0 ? `The crew ate ${eaten} ration${eaten === 1 ? '' : 's'} on the jump. ${this.rations} left.` : 'There was nothing to eat on the jump.');

        const livingCrew = this.crew.filter(c => c.status !== 'DEAD');

        // Warning at 5 rations
        if (this.rations === 5) {
            this.addLog('⚠ A.U.R.A.: "Rations are low, Commander. Four crew eat a great deal."');
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
        // No rations - 2 jumps of grace before death
        if (this.rations === 0) {
            this._starvationCounter = (this._starvationCounter || 0) + 1;

            if (this._starvationCounter === 1) {
                // First jump without food - warning only
                this.addLog(`🔴 CRITICAL: No food left. The crew can survive two more jumps without eating.`);
                livingCrew.forEach(c => {
                    c.stress = Math.min(3, (c.stress || 0) + 1);
                });
            } else if (this._starvationCounter === 2) {
                // Second jump without food - max stress warning
                this.addLog(`🔴 STARVATION: The crew is weakening fast. One more jump without food will kill someone.`);
                livingCrew.forEach(c => {
                    c.stress = 3; // Max stress
                });
            } else {
                // Third+ jump without food - someone dies
                const maxStressedCrew = livingCrew.filter(c => (c.stress || 0) >= 3);
                const candidates = maxStressedCrew.length > 0 ? maxStressedCrew : livingCrew;

                if (candidates.length > 0) {
                    const victim = candidates[Math.floor(Math.random() * candidates.length)];
                    victim.status = 'DEAD';
                    victim._deathCause = 'starvation';
                    victim._deathSector = this.currentSector;
                    this.addLog(`☠ DEATH: ${victim.name} has died of starvation.`);
                    window.dispatchEvent(new CustomEvent('crew-death', { detail: { crew: victim } }));
                    if (typeof BarkSystem !== 'undefined' && window.BarkSystem) {
                        window.BarkSystem.tryBark('CREW_DEATH', this, { crew: victim });
                    }
                    if (typeof AuraSystem !== 'undefined' && window.AuraSystem) {
                        window.AuraSystem.tryComment('CREW_DEATH', this, true);
                    }
                    // Reset counter so next death takes another 3 jumps
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
        const operational = Object.keys(this.shipDecks).filter(key => this.shipDecks[key].status === 'OPERATIONAL');
        if (operational.length === 0) return null;
        return this.damageDeck(operational[Math.floor(Math.random() * operational.length)]);
    }

    /** Damage one deck. Returns its key, or null when it was already broken (or is not a deck). */
    damageDeck(key, line = null) {
        const deck = this.shipDecks[key];
        if (!deck || deck.status !== 'OPERATIONAL') return null;
        deck.status = 'DAMAGED';
        this.addLog(line || `HULL BREACH: ${deck.label} has taken damage! Systems offline.`);

        // Visual feedback: screen shake on hull breach
        window.dispatchEvent(new CustomEvent('deck-damaged', { detail: { deckKey: key } }));

        // Tutorial: first deck damage
        if (!this._tutorialDeckSeen) {
            this._tutorialDeckSeen = true;
            this.addLog('A.U.R.A.: "A deck is damaged, Commander. Repairs before the next jump, if you can spare the salvage."');
        }

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
        this.addLog(`Not enough Salvage for repair. Need ${cost}, have ${this.salvage}.`);
        return false;
    }

    /**
     * Check if a specific deck is operational.
     */
    /**
     * Stops left in this sector. The jump window only stays open for a few warps, always fewer than
     * there are places to see, so choosing one stop means giving up another. Resets on a new sector.
     */
    getStopsLeft() {
        if (this._stopsSector !== this.currentSector || this.stopsLeft == null) {
            const places = (this.sectorNodes || []).filter(n => !n.ghost).length;
            this.stopsLeft = Math.max(MIN_STOPS_PER_SECTOR, Math.min(MAX_STOPS_PER_SECTOR, places - 1));
            this._stopsSector = this.currentSector;
        }
        return this.stopsLeft;
    }

    isDeckOperational(deckKey) {
        const deck = this.shipDecks[deckKey];
        return !!deck && deck.status === 'OPERATIONAL' && !deck._auraLocked; // a deck A.U.R.A. has locked is as useless as a broken one
    }

    /**
     * Apply stress traits when crew hit stress level 2, and trigger breakdowns at stress 3.
     * Called after any stress change.
     */
    applyStressTraits() {
        this.crew.forEach(c => {
            if (c.status === 'DEAD') return;

            // Commander stress is capped at 2 - they can be stressed but breakdown requires special events
            // This prevents random stress accumulation from causing instant game over
            if (c.tags && c.tags.includes('LEADER') && c.stress > 2) {
                c.stress = 2;
                this.addLog(`${c.name} steadies their nerves. Command requires composure.`);
            }

            const stress = c.stress || 0;

            // Stress 2: Assign personality-based negative trait
            if (stress >= 2 && !c.trait) {
                // Tutorial: first stress problem
                if (!this._tutorialStressSeen) {
                    this._tutorialStressSeen = true;
                    this.addLog('A.U.R.A.: "Crew stress is high, Commander. They rest on each sector jump, if the crew quarters work."');
                }

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

        // Confined crew can't have breakdowns - they're already isolated
        if (c.tags && c.tags.includes('CONFINED')) {
            this.addLog(`${c.name} has a breakdown in confinement. No one hears the screaming.`);
            c.status = 'INJURED';
            return;
        }

        // Sedated crew can't have breakdowns - they're unconscious
        if (c.tags && c.tags.includes('SEDATED')) {
            return;
        }

        // Commander breakdown = game over (only if not already confined)
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
                this.addLog(`Aris has shut down. She stares at the wall and does not answer. Nobody can treat the wounded now.`);
                // Stress stays high — she's catatonic, not recovering
                break;

            case 'SURVIVOR': // Vance — shuts himself in the cargo hold until the next jump
                c.tags = (c.tags || []).concat('CONFINED');
                c._confinedUntilWarp = 1;
                c.stress = 2;
                this.addLog(`${c.name} has shut himself in the cargo hold. He won't take orders until the next jump.`);
                break;

            case 'CURIOUS': // Mira — Obsessed: a team trip takes a full day (a ration), but brings back more
                c.trait = 'OBSESSED';
                this.addLog(`Mira has become dangerously obsessed. She demands extended EVA time regardless of risk.`);
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

    /** Items the hold takes right now: racks add a pallet, a broken cargo deck halves everything. */
    getCargoLimit() {
        const full = CARGO_LIMIT + (this.upgrades.includes('cargo_racks') ? CARGO_RACK_BONUS : 0);
        return this.isDeckOperational('cargo') ? full : Math.floor(full / 2);
    }

    /** Items taking room in the hold. Papers and tapes (isKept: the pages, the disc drawing, the tape) take none. */
    getCargoCount() {
        return this.cargo.filter(item => !item.isKept).length;
    }

    /**
     * The hold takes getCargoLimit() items. Items are pushed into `cargo` from dozens of encounter scripts, so the limit
     * is enforced here, on the next update: whatever arrived beyond the limit is left behind, newest first.
     * Items already aboard are never lost, and papers are never left behind.
     */
    enforceCargoLimit() {
        const limit = this.getCargoLimit(), count = this.getCargoCount();
        const before = this._cargoCountSeen == null ? count : this._cargoCountSeen;
        if (count > limit && count > before) {
            const room = Math.max(limit, before), left = [];
            let held = 0;
            this.cargo = this.cargo.filter(item => {
                if (item.isKept) return true;
                held += 1;
                if (held <= room) return true;
                left.push(item);
                return false;
            });
            this.addLog(`WARNING: Cargo hold full (${limit} items). Left behind: ${left.map(i => i.name).join(', ')}.`);
        }
        this._cargoCountSeen = this.getCargoCount();
    }

    emitUpdates() {
        this.enforceCargoLimit();
        this.applyStressTraits();
        this.checkLoseConditions();
        window.dispatchEvent(new Event('hud-updated'));
    }
}







// --- 4. MAIN APP ---

// The line on the card when the throw ends (TheThrow.js). Every other jump is flown (Corridor) and says its own lines.
const SECTOR_ARRIVAL_LINES = {
    3: 'Hundreds of ship beacons, all ours. Their numbers are higher than ours, and they are a hundred years old.',
};
const RELIANCE_MIN_SAMPLES = 4; // A.U.R.A. only comments on who flies once there is a pattern to see
const CARGO_LIMIT = 20, CARGO_RACK_BONUS = 4; // see GameState.getCargoLimit / enforceCargoLimit
const MIN_STOPS_PER_SECTOR = 2, MAX_STOPS_PER_SECTOR = 3; // see GameState.getStopsLeft
const SECTOR_JUMP_BASE_COST = 8; // energy for a sector jump (double with engineering down); warps are 4-6 (GameState.getWarpCost)
const DRIVE_BRACE_SAVING = 4;    // a braced drive (the hull-cracks campfire) takes this much off the next jump, once
const RATIONS_PER_JUMP = 1;      // the crew eats on the jump and nowhere else, besides "a day" on a card (GameState.eatOnJump)
const FINAL_SECTOR = 6; // THE LIGHT — holds the light at the end of the heading; SECTOR_CONFIG defines nothing beyond it
const SCRAPES_PER_BROKEN_DECK = 3; // flying the jump (Corridor): every third scrape breaks a deck
// Our wrecks (docs/CANON.md §2): the further out, the higher the hull number. Index = sector. The callsign comes from the number.
const WRECK_HULL_RANGE = [[1, 8], [1, 8], [1, 8], [212, 980], [1400, 6000], [9000, 22000], [30000, 41000]];
const SHORT_HULL_RANGE = 50;     // below this many hull numbers, a new wreck is picked from the numbers not yet used
const REEL_HULLS = [7, 2207];   // the hulls the jump films show drifting (StoryReel.js): never given to a wreck the team boards
const WRECK_CALLSIGNS = ['PIONEER', 'COVENANT', 'SOJOURN', 'REQUIEM', 'LAZARUS', 'ICARUS', 'MERIDIAN', 'ORPHEUS', 'HALCYON', 'VESPER', 'TANTALUS', 'EMBER'];
const CREW_ID_BY_TAG = { LEADER: 'you', ENGINEER: 'jaxon', MEDIC: 'aris', SECURITY: 'vance', SPECIALIST: 'mira' }; // the minigames' names for the crew
const crewIdOf = member => CREW_ID_BY_TAG[(member.tags || []).find(tag => CREW_ID_BY_TAG[tag])];
/** A place a team can land, other than the sector's story planet (that one keeps its own wreck and page). */
const isOrdinaryLandable = p => !p.isStation && !p.isAsteroidField && !p.isStructure && !p.ghost && !p.isStoryPlanet && p.type !== 'GAS_GIANT';

class App {
    constructor() {
        this.state = GameState.getInstance();
        this.navView = new NavView(this.state);
        this.orbitView = new OrbitView(this.state);

        // Modal queue to prevent stacking
        this._modalQueue = [];
        this._modalActive = false;

        // True while a warp or sector jump is playing out; blocks re-entrant travel requests
        this._isInTransit = false;

        // Show start menu first
        this.showStartMenu();
    }

    showStartMenu() {
        // Pre-generate star positions ONCE to prevent visual jumps
        const starData = Array(50).fill().map(() => ({
            left: Math.random() * 100,
            top: Math.random() * 100,
            opacity: 0.3 + Math.random() * 0.7,
            duration: 2 + Math.random() * 3
        }));

        // Start audio system (audio is ON by default now)
        if (window.AudioSystem) window.AudioSystem.init();

        // Check current audio state for display
        const audioIsOn = window.AudioSystem ? !window.AudioSystem.muted : true;

        // Check for existing save
        const saveInfo = this.state.getSaveInfo();
        const hasSave = saveInfo !== null;

        const overlay = document.createElement('div');
        overlay.id = 'start-menu';
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: radial-gradient(130% 100% at 50% 0%, #11170f 0%, #0a0d0b 55%, #060806 100%);
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            z-index: 10000; font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
        `;

        overlay.innerHTML = `
            <div class="title-hero" aria-hidden="true">${window.BodyRenderer ? window.BodyRenderer.globe({ type: 'GAS_GIANT', size: Math.round(Math.max(320, Math.min(620, (window.innerHeight || 800) * 0.8))), seed: 9 }) : ''}</div>
            <!-- Stars background - ALWAYS visible, no animation delay -->
            <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; overflow: hidden; pointer-events: none;">
                ${starData.map(star => `
                    <div style="position: absolute; width: 2px; height: 2px; background: white; border-radius: 50%;
                        left: ${star.left}%; top: ${star.top}%;
                        opacity: ${star.opacity};
                        animation: twinkle ${star.duration}s infinite;"></div>
                `).join('')}
            </div>
            <div class="title-block" style="animation: fadeInGentle 1.5s ease-in;">

                <!-- Title -->
                <div style="position: relative;">
                    <div style="font-size: 0.9em; color: #5f9e7a; letter-spacing: 8px; margin-bottom: 10px;">
                        EXODUS PROGRAM // VESSEL 9
                    </div>
                    <div style="font-size: 4em; font-weight: bold; color: #f4f1ea; letter-spacing: 12px;
                        font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
                        text-shadow: 0 0 26px rgba(116, 217, 154, 0.45), 0 0 60px rgba(116, 217, 154, 0.20);">
                        SILENT EXODUS
                    </div>
                    <div style="font-size: 1em; color: #8a9d8f; margin-top: 15px; letter-spacing: 4px;">
                        EIGHT WENT BEFORE YOU. NONE OF THEM CALLED HOME.
                    </div>
                </div>

                <!-- Buttons -->
                <div class="title-buttons" style="margin-top: 50px; display: flex; flex-direction: column; gap: 15px;">
                    ${hasSave ? `
                    <button id="btn-continue-game" style="
                        padding: 18px 60px;
                        background: rgba(116, 217, 154, 0.10); border: 2px solid #74d99a;
                        color: #74d99a; font-size: 1.2em; font-family: inherit;
                        cursor: pointer; letter-spacing: 4px;
                        transition: all 0.3s;
                    ">
                        CONTINUE
                    </button>
                    <div style="font-size: 0.75em; color: #6f8a78; margin-bottom: 10px;">
                        Sector ${saveInfo.sector} • ${saveInfo.crew} crew alive
                    </div>
                    ` : ''}
                    <button id="btn-start-game" style="
                        padding: ${hasSave ? '12px 45px' : '18px 60px'};
                        background: transparent; border: 2px solid ${hasSave ? '#5f9e7a' : '#74d99a'};
                        color: ${hasSave ? '#5f9e7a' : '#74d99a'}; font-size: ${hasSave ? '1em' : '1.2em'}; font-family: inherit;
                        cursor: pointer; letter-spacing: 4px;
                        transition: all 0.3s;
                    ">
                        NEW GAME
                    </button>
                </div>

                ${hasSave ? `
                <!-- Erasing the save is its own step, lower down: never a second click on NEW GAME (docs/GAME_FLOW.md 2.1).
                     The row's space is always kept, so showing it moves nothing on screen. -->
                <div id="erase-confirm" style="visibility: hidden; margin-top: 28px;">
                    <div style="font-size: 0.95em; color: #c4d0c4; margin-bottom: 12px;">Erase the saved run?</div>
                    <div style="display: flex; gap: 18px;">
                        <button id="btn-erase-keep" style="padding: 8px 26px; background: transparent; border: 1px solid #5f9e7a; color: #9bf0bd; font-family: inherit; font-size: 0.95em; letter-spacing: 2px; cursor: pointer;">KEEP</button>
                        <button id="btn-erase-yes" style="padding: 8px 26px; background: transparent; border: 1px solid #d85a4e; color: #e07a70; font-family: inherit; font-size: 0.95em; letter-spacing: 2px; cursor: pointer;">ERASE</button>
                    </div>
                </div>
                ` : ''}

                <!-- Sound: the label always says the real mute state -->
                <div style="margin-top: 30px; font-size: 0.75em; color: #556b5d;">
                    <span id="audio-status">${this.soundLabel()}</span>
                    <button id="btn-toggle-audio" style="
                        margin-left: 15px; padding: 5px 15px;
                        background: transparent; border: 1px solid #3a4a40;
                        color: #6f8a78; font-size: 0.9em; font-family: inherit;
                        cursor: pointer;
                    ">${audioIsOn ? 'TURN OFF' : 'TURN ON'}</button>
                </div>

            </div>
        `;

        document.body.appendChild(overlay);

        // Button hover effects helper
        const addHoverEffect = (btn, baseColor = '#74d99a') => {
            if (!btn) return;
            btn.onmouseenter = () => {
                btn.style.background = 'rgba(116, 217, 154, 0.18)';
                btn.style.borderColor = '#9bf0bd';
                btn.style.color = '#9bf0bd';
                btn.style.transform = 'scale(1.05)';
            };
            btn.onmouseleave = () => {
                btn.style.background = hasSave && btn.id === 'btn-start-game' ? 'transparent' : 'rgba(116, 217, 154, 0.10)';
                btn.style.borderColor = baseColor;
                btn.style.color = baseColor;
                btn.style.transform = 'scale(1)';
            };
        };

        const startBtn = overlay.querySelector('#btn-start-game');
        const continueBtn = overlay.querySelector('#btn-continue-game');

        addHoverEffect(startBtn, hasSave ? '#5f9e7a' : '#74d99a');
        addHoverEffect(continueBtn, '#74d99a');

        // New Game button
        const startNewGame = () => {
            if (hasSave) this.state.deleteSave();
            overlay.style.transition = 'opacity 1s';
            overlay.style.opacity = '0';
            setTimeout(() => {
                overlay.remove();
                this.init(false); // false = new game
            }, 1000);
        };

        // With a save, NEW GAME only opens the question lower down; clicking it again does nothing more.
        const eraseRow = overlay.querySelector('#erase-confirm');
        startBtn.onclick = () => {
            if (!eraseRow) { startNewGame(); return; }
            if (eraseRow.style.visibility === 'visible') return;
            eraseRow.style.visibility = 'visible';
            if (window.ChoiceGuard) window.ChoiceGuard.hold(eraseRow);
        };
        if (eraseRow) {
            overlay.querySelector('#btn-erase-yes').onclick = startNewGame;
            overlay.querySelector('#btn-erase-keep').onclick = () => { eraseRow.style.visibility = 'hidden'; };
        }

        // Continue button (if exists)
        if (continueBtn) {
            continueBtn.onclick = () => {
                overlay.style.transition = 'opacity 1s';
                overlay.style.opacity = '0';
                setTimeout(() => {
                    overlay.remove();
                    this.init(true); // true = load save
                }, 1000);
            };
        }

        // Audio toggle - sync with actual AudioSystem state
        const audioBtn = overlay.querySelector('#btn-toggle-audio');
        const audioStatus = overlay.querySelector('#audio-status');
        audioBtn.onclick = () => {
            if (!window.AudioSystem) return;
            if (window.AudioSystem.muted) window.AudioSystem.unmute();
            else window.AudioSystem.mute();
            audioStatus.textContent = this.soundLabel();
            audioBtn.textContent = window.AudioSystem.muted ? 'TURN ON' : 'TURN OFF';
            this.syncSoundButton();
        };
    }

    /** "♪ SOUND: ON" or "♪ SOUND: OFF", read from the sound system itself, never assumed. */
    soundLabel() {
        const isOn = !!window.AudioSystem && !window.AudioSystem.muted;
        return `♪ SOUND: ${isOn ? 'ON' : 'OFF'}`;
    }

    /** The header's sound button says the real mute state (it used to read "♪ AUDIO" whatever the state). */
    syncSoundButton() {
        const headerBtn = document.getElementById('btn-audio');
        if (!headerBtn) return;
        const isOn = !!window.AudioSystem && !window.AudioSystem.muted;
        headerBtn.textContent = this.soundLabel();
        headerBtn.style.opacity = isOn ? '1' : '0.5';
        headerBtn.style.color = isOn ? 'var(--color-primary)' : 'var(--color-primary-dim)';
        headerBtn.style.borderColor = isOn ? 'var(--color-primary)' : 'var(--color-primary-dim)';
    }

    init(loadSave = false) {
        console.log("Exodus-9 Systems Initializing...");

        window.addEventListener('log-updated', (e) => this.handleLogUpdate(e));

        window.addEventListener('hud-updated', () => this.updateHud());

        // Audio Toggle - Click to show volume modal
        const btnAudio = document.getElementById('btn-audio');
        if (btnAudio) {
            btnAudio.onclick = () => this.showAudioModal();
        }
        this.syncSoundButton();

        // Test mode exists only behind ?test=1: then the TEST button shows and toggles it. Players never see it.
        const btnTesting = document.getElementById('btn-testing');
        if (btnTesting && !IS_TEST_BUILD) btnTesting.remove();
        else if (btnTesting) {
            const applyTestMode = (isToggle) => {
                btnTesting.textContent = window.TEST_MODE ? "TEST MODE: ON" : "TEST MODE: OFF";
                btnTesting.style.opacity = window.TEST_MODE ? "1" : "0.7";
                btnTesting.style.borderColor = window.TEST_MODE ? "#d85a4e" : "#ff6600";
                btnTesting.style.color = window.TEST_MODE ? "#d85a4e" : "#ff6600";
                if (window.TEST_MODE && isToggle) { // a tester should never be blocked by resources (the state is not built yet at load)
                    this.state.energy = 100;
                    this.state.salvage = this.state.maxSalvage;
                    this.state.rations = this.state.maxRations;
                    this.state.probeIntegrity = 100;
                    this.state.emitUpdates();
                }
            };
            btnTesting.hidden = false;
            btnTesting.onclick = () => {
                window.TEST_MODE = !window.TEST_MODE;
                this.state.addLog(window.TEST_MODE
                    ? "/// TESTING MODE ENABLED /// Rare outcomes favoured. Energy is free. Salvage, rations and probe topped up so everything can be built and tried."
                    : "/// TESTING MODE DISABLED /// Normal probabilities restored.");
                applyTestMode(true);
            };
            applyTestMode(false);
        }

        // Header Interactions
        const fabBtn = document.getElementById('btn-fab');
        if (fabBtn) fabBtn.onclick = () => this.showFabricator();

        window.addEventListener('req-warp', (e) => this.handleWarp(e.detail));
        window.addEventListener('req-sector-jump', () => this.handleSectorJump());
        window.addEventListener('req-action-scan', (e) => this.handleScanAction(!!(e.detail && e.detail.manual)));
        window.addEventListener('req-action-probe', () => this.handleProbeAction());
        window.addEventListener('req-action-eva', () => this.handleEvaAction());
        window.addEventListener('req-action-colony', () => this.handleColonyAction());
        window.addEventListener('req-action-exodus', () => this.handleExodusAction());
        window.addEventListener('req-action-date-wreck', () => this.dateWreck(this.state.currentSystem));
        window.addEventListener('req-action-colony-site', () => this.handleFailedColonyAction());
        window.addEventListener('req-action-derelict', () => this.handleDerelictAction());
        window.addEventListener('req-action-anomaly', () => this.handleAnomalyAction());
        window.addEventListener('req-action-lighthouse', () => this.handleLateGamePOI('LIGHTHOUSE'));
        window.addEventListener('req-action-garden', () => this.handleLateGamePOI('GARDEN'));
        window.addEventListener('req-action-grave', () => this.handleLateGamePOI('GRAVE'));
        window.addEventListener('req-action-structure', () => this.handleStructureAction());
        window.addEventListener('req-action-station', () => this.handleStationAction());
        window.addEventListener('req-action-asteroid', () => this.handleAsteroidAction());
        window.addEventListener('aura-vent-warning', () => this.showAuraVentModal());
        window.addEventListener('req-break-orbit', () => {
            // THE STRUCTURE - Cannot escape. Ship mysteriously returns.
            const currentPlanet = this.state.currentSystem;
            if (currentPlanet && (currentPlanet.isStructure || currentPlanet.type === 'STRUCTURE')) {
                this.state.addLog('A.U.R.A.: "The drive fires, Commander. We do not move. I have checked it three times."');
                // Ship stays in orbit - don't clear currentSystem
                return;
            }
            this.state.addLog("Breaking orbit. Systems disengaged.");
            this.state.currentSystem = null;                                          // back on the map (lastVisitedSystem keeps the free re-entry)
            this.renderNav();
            if (currentPlanet && this.state.currentSector === 1 && !this.state._countSceneSeen) this.showCountScene();
        });

        // THE WRONG PLACE special handlers
        window.addEventListener('req-wrong-escape', () => this.handleWrongPlaceEscape());
        window.addEventListener('req-wrong-accept', () => this.handleWrongPlaceAccept());

        window.addEventListener('req-remote-scan', (e) => this.handleRemoteScan(e.detail));
        window.addEventListener('req-remote-probe', (e) => this.handleRemoteProbe(e.detail));

        // Ship deck click handlers
        document.querySelectorAll('.ship-deck').forEach(deckEl => {
            deckEl.style.cursor = 'pointer';
            deckEl.addEventListener('click', (e) => {
                if (e.target.closest('.deck-crew-status')) return; // the crew dots have their own handler (manifest)
                const room = deckEl.dataset.room;
                this.showDeckDetail(room);
            });
        });

        // Game Over handler
        window.addEventListener('game-over', (e) => this.showGameOver(e.detail));

        // Crew death - heavy screen shake
        window.addEventListener('crew-death', () => this.screenShake('heavy'));

        // Deck damage - light screen shake
        window.addEventListener('deck-damaged', () => this.screenShake('light'));

        // Mutiny handler (Vance stress 3 breakdown)

        // Anomaly teleportation handler (visual effect + view refresh)
        window.addEventListener('anomaly-teleport', (e) => this.handleAnomalyTeleport(e.detail));

        // Either load save or start new game
        if (loadSave && this.state.loadGame()) {
            this.state.addLog("=== SAVE LOADED ===");
            this.state.addLog(`Resuming mission in Sector ${this.state.currentSector}.`);
            this.resumeWhereSaved();
        } else {
            // New game
            this.state.init();
            this.state.sectorNodes = PlanetGenerator.generateSector(1);
            this.renderNav();
            // A.U.R.A.'s opening briefing (in-universe tutorial)
            this.showOpeningBriefing();
        }
    }

    /**
     * Auto-save the game (called after significant actions)
     */
    autoSave() {
        if (this.state.saveGame()) {
            // Subtle save indicator
            const indicator = document.createElement('div');
            indicator.style.cssText = `
                position: fixed; top: 10px; right: 10px; padding: 5px 12px;
                background: rgba(0, 100, 50, 0.8); color: #74d99a;
                font-size: 0.75em; font-family: 'Share Tech Mono', monospace;
                border-radius: 3px; z-index: 9999;
                animation: fadeInGentle 0.3s forwards;
            `;
            indicator.textContent = 'SAVED';
            document.body.appendChild(indicator);
            setTimeout(() => {
                indicator.style.opacity = '0';
                indicator.style.transition = 'opacity 0.5s';
                setTimeout(() => indicator.remove(), 500);
            }, 1500);
        }
    }

    // === VISUAL FEEDBACK SYSTEM ===

    /**
     * Shake the screen for dramatic moments
     * @param {string} intensity - 'light' or 'heavy'
     */
    screenShake(intensity = 'light') {
        const container = document.querySelector('.app-container');
        if (!container) return;

        container.classList.remove('shake', 'shake-heavy');
        // Force reflow to restart animation
        void container.offsetWidth;
        container.classList.add(intensity === 'heavy' ? 'shake-heavy' : 'shake');

        setTimeout(() => {
            container.classList.remove('shake', 'shake-heavy');
        }, 700);
    }

    /**
     * Flash a resource element when it changes
     * @param {string} resourceId - 'energy', 'salvage', or 'rations'
     * @param {string} type - 'gain', 'loss', or 'special'
     */
    flashResource(resourceId, type = 'gain') {
        const el = document.getElementById(`res-${resourceId}`);
        if (!el) return;

        el.classList.remove('flash-gain', 'flash-loss', 'flash-special');
        void el.offsetWidth;
        el.classList.add(`flash-${type}`);

        setTimeout(() => {
            el.classList.remove('flash-gain', 'flash-loss', 'flash-special');
        }, 800);
    }

    /**
     * Mark a deck as visually damaged (pulsing red)
     * @param {string} deckKey - The deck identifier
     */
    showDeckDamage(deckKey) {
        const deckEl = document.querySelector(`.deck-${deckKey}`);
        if (deckEl) {
            deckEl.classList.add('deck-damaged');
        }
    }

    /**
     * Remove damaged visual from deck
     * @param {string} deckKey - The deck identifier
     */
    clearDeckDamage(deckKey) {
        const deckEl = document.querySelector(`.deck-${deckKey}`);
        if (deckEl) {
            deckEl.classList.remove('deck-damaged');
        }
    }

    /**
     * The opening scene. In under a minute it has to say who you are, what your orders are (the lie included),
     * give one reason to be uneasy, and point at a first thing to do. How the ship works is left to the NEXT tips.
     */
    showOpeningBriefing() {
        this.markFirstSignal();
        this.plantSectorPage();
        const begin = () => {
            this.state.addLog('A.U.R.A.: "Systems online. Waiting for your orders, Commander."');
            this.state.addLog("An old ship beacon is marked on the map. Click it to take a look.");
            this.renderNav();
        };
        if (!window.EncounterCard) { begin(); return; }
        const reel = window.StoryReel && !window.TEST_MODE ? window.StoryReel.play('program') : Promise.resolve(); // what the crew was told, as a picture
        reel.then(() => window.EncounterCard.open(this, {
            tone: 'station', zIndex: 3500, kicker: 'EXODUS-9 · 61 YEARS OUT FROM EARTH', title: 'Good morning, Commander',
            context: 'Cold air and bright lights. After sixty-one years asleep, the ship has woken all five of you.',
            dialogue: [
                { speaker: 'A.U.R.A.', text: 'Good morning, Commander. All four crew are awake and well. The ship is in one piece.' },
                { speaker: 'A.U.R.A.', text: 'Your orders have not changed. Find a planet people can live on, and settle it.' },
                { speaker: 'A.U.R.A.', text: 'Earth is sending ships in every direction. Eight went this way before us. We are the ninth.' },
                { speaker: 'Jaxon', text: 'Eight ships ahead of us. I hope they left us a good planet.' },
                { speaker: 'Vance', text: 'Eight ships, and not one of them ever sent a message home?' },
                { speaker: 'A.U.R.A.', text: 'Space is very large, Vance. There is an old ship beacon on the scanner. Probably one of the eight. I have marked it on your map.' },
            ],
            choices: [{ text: 'Take command', desc: 'Six sectors ahead. A few stops in each, then you must jump on. Energy moves the ship. Rations feed the crew.' }],
            onPick: begin
        }));
    }

    /** Sector 1 always holds one wreck whose transponder shows on the map from the start: the first thing to go and look at. */
    /**
     * The head count (docs/CANON.md section 6). Vance: five of us, she says four. Asked, A.U.R.A. names all five and still says four.
     * Nobody explains it: the reason is being redesigned. It fires on the first return to the map in sector 1, so nobody can miss it.
     */
    showCountScene() {
        if (!window.EncounterCard || this.state._countSceneSeen) return;
        this.state._countSceneSeen = true;
        const alive = who => this.state.crew.some(c => c.status !== 'DEAD' && c.name.includes(who));
        const names = [['Jaxon', 'Jaxon Mercer'], ['Aris', 'Aris Novak'], ['Vance', 'Kael Vance'], ['Mira', 'Mira Chen']].filter(([first]) => alive(first)).map(([, full]) => full);
        window.EncounterCard.open(this, {
            tone: 'station', zIndex: 3400, kicker: 'THE BRIDGE', title: 'Head count',
            context: 'Back on the bridge, Vance is frowning at the crew screen.',
            dialogue: [
                { speaker: 'Vance', text: 'There are five of us on this ship. She keeps saying four.' },
                { speaker: 'A.U.R.A.', text: 'Four crew, Commander. All well.' },
                { speaker: 'Vance', text: 'Then list them.' },
                { speaker: 'A.U.R.A.', text: `${names.join('. ')}. And you, Commander. Four crew.` },
                { speaker: 'Jaxon', text: 'It is a glitch. She slept sixty years too. Let it go.' },
            ],
            choices: [
                { text: 'Let it go', desc: 'Jaxon is probably right. It is only a number.' },
                { text: 'Ask her why', desc: 'Vance wants an answer.' },
                { text: 'Read the printed crew list', desc: 'There is a paper copy in the bridge locker.' },
            ],
            onPick: (idx) => {
                if (idx === 0) { this.state.noteStanding('jaxon'); this.state.addLog('A.U.R.A.: "Thank you, Commander."'); }
                if (idx === 1) { this.state.noteStanding('vance'); this.state.addLog('A.U.R.A.: "Four crew, Commander. I have checked."'); }
                if (idx === 2) {
                    this.state.noteStanding('aris');
                    this.state.addLog('The printed crew list has five names: Cora Moon, Jaxon Mercer, Aris Novak, Kael Vance, Mira Chen.');
                }
                this.state.emitUpdates();
            }
        });
    }

    /**
     * The one place a team can go on this planet (a planet has at most one: see tidySites). kind order = which wins.
     * inSpace: reached by crossing in the lander, no landing. art: what the landing game draws beside the marked spot.
     */
    siteOf(planet) {
        const SITES = [
            { tag: 'EXODUS_WRECK', done: 'exodusInvestigated', label: 'THE WRECK', note: 'ONE OF OUR SHIPS', art: 'wreck', run: () => this.handleExodusAction() },
            { tag: 'ANOMALY', done: 'anomalyInvestigated', label: 'THE STRANGE SITE', note: 'SOMETHING HERE IS WRONG', inSpace: true, run: () => this.handleAnomalyAction() },
            { tag: 'LIGHTHOUSE', done: 'lighthouseInvestigated', label: 'THE BEACON', note: 'A BEACON STILL TRANSMITTING', art: 'beacon', run: () => this.handleLateGamePOI('LIGHTHOUSE') },
            { tag: 'GARDEN', done: 'gardenInvestigated', label: 'THE DOME', note: 'SOMETHING GREEN UNDER GLASS', art: 'dome', run: () => this.handleLateGamePOI('GARDEN') },
            { tag: 'GRAVE', done: 'graveInvestigated', label: 'THE GRAVES', note: 'ROWS OF MARKERS', art: 'stones', run: () => this.handleLateGamePOI('GRAVE') },
            { tag: 'FAILED_COLONY', done: 'colonyInvestigated', label: 'THE COLONY RUINS', note: 'A SETTLEMENT, EMPTY', art: 'ruins', run: () => this.handleFailedColonyAction() },
            { tag: 'DERELICT', done: 'derelictInvestigated', label: 'THE WRECKAGE', note: 'A SHIP IN PIECES, IN ORBIT', inSpace: true, run: () => this.handleDerelictAction() },
        ];
        return (planet && planet.tags && SITES.find(site => planet.tags.includes(site.tag))) || null;
    }

    /**
     * Every planet keeps one site at most (the story wreck wins), and every sector gets one strange place.
     * The strange place is added after the tidy, so a wreck that also rolled one cannot take it away; it never replaces a wreck.
     */
    tidySites() {
        const ORDER = ['EXODUS_WRECK', 'ANOMALY', 'LIGHTHOUSE', 'GARDEN', 'GRAVE', 'FAILED_COLONY', 'DERELICT'];
        const nodes = this.state.sectorNodes || [];
        const isStory = p => p.hasPage || p.hasTape || p.isFirstSignal;
        const isLandable = p => !p.isStation && !p.isAsteroidField && !p.isStructure && !p.ghost && p.type !== 'GAS_GIANT';
        const siteOf = p => (p.tags || []).find(t => ORDER.includes(t));
        nodes.forEach(p => {
            if (!p.tags) return;
            const keep = isStory(p) ? 'EXODUS_WRECK' : p.forcedAnomaly ? 'ANOMALY' : ORDER.find(t => p.tags.includes(t));
            p.tags = p.tags.filter(t => !ORDER.includes(t) || t === keep);
        });
        if (nodes.some(p => siteOf(p) === 'ANOMALY')) return;
        const canHost = p => isLandable(p) && !isStory(p) && siteOf(p) !== 'EXODUS_WRECK';
        const host = nodes.find(p => canHost(p) && !siteOf(p)) || nodes.find(canHost);   // a planet with nothing on it first
        if (host) { host.tags = (host.tags || []).filter(t => !ORDER.includes(t)).concat('ANOMALY'); host.forcedAnomaly = true; }
    }

    /** A found page as a cargo item: kept, and readable again from the hold. */
    pageItem(page, acquiredAt) {
        return { ...page, acquiredAt, onUse: () => { if (window.FoundPage) window.FoundPage.open(this, page, acquiredAt); return 'You read it again.'; } };
    }

    /**
     * Every sector's page lies in a wreck on its story planet (src/data/StoryPlanets.js), hidden until a dated wreck points at it.
     * So the sector also needs one ordinary wreck of ours to date. A sector visited again, its page found, loses its story planet.
     */
    plantSectorPage() {
        const found = this.state.exodusLogsFound || [];
        const nodes = (this.state.sectorNodes || []).filter(p => !(p.isStoryPlanet && found.includes(p.hasPage)));
        this.state.sectorNodes = nodes;
        const hasWreckToDate = nodes.some(p => isOrdinaryLandable(p) && (p.tags || []).includes('EXODUS_WRECK'));
        const target = nodes.some(p => p.storyHidden) && !hasWreckToDate && nodes.find(isOrdinaryLandable);
        if (target) target.tags = (target.tags || []).concat('EXODUS_WRECK');
        this.tidySites();
    }

    /** Found in the wreck: the page opens at once and stays in cargo. Resolves once it is put away. */
    findSectorPage(shipName, pageId) {
        const PAGE_DELAY_MS = 900;
        const page = (typeof EXODUS_LOGS !== 'undefined' ? EXODUS_LOGS : []).find(p => p.id === pageId);
        if (!page || (this.state.exodusLogsFound || []).includes(page.id)) return Promise.resolve();
        this.state.exodusLogsFound = this.state.exodusLogsFound || [];
        this.state.exodusLogsFound.push(page.id);
        this.state.cargo.push(this.pageItem(page, shipName));
        this.state.addLog(`In ${shipName}: ${page.desc}`);
        this.state.emitUpdates();
        return new Promise(resolve => setTimeout(() => {
            (window.FoundPage ? window.FoundPage.open(this, page, shipName) : Promise.resolve()).then(resolve);
        }, PAGE_DELAY_MS));
    }

    /** Sector 2 always holds one wreck with the uncut briefing tape in its archive. Unmarked: you find it by searching wrecks. */
    plantBriefingTape() {
        const nodes = this.state.sectorNodes || [];
        if (this.state.currentSector !== 2 || nodes.some(p => p.hasTape) || this.state.cargo.some(i => i.id === 'briefing_tape')) return;
        const target = nodes.find(p => isOrdinaryLandable(p) && (p.tags || []).includes('EXODUS_WRECK')) || nodes.find(isOrdinaryLandable);
        if (!target) return;
        target.tags = target.tags || [];
        if (!target.tags.includes('EXODUS_WRECK')) target.tags.push('EXODUS_WRECK');
        target.hasTape = true;
    }

    /** Found in the wreck's archive; it plays at once, and Vance says the thing nobody wants said. */
    findBriefingTape(shipName) {
        const TAPE_DELAY_MS = 900;
        if (typeof ITEMS === 'undefined' || !ITEMS.BRIEFING_TAPE || this.state.cargo.some(i => i.id === ITEMS.BRIEFING_TAPE.id)) return Promise.resolve();
        this.state.cargo.push({ ...ITEMS.BRIEFING_TAPE, acquiredAt: shipName });
        this.state.addLog(`In the archive of ${shipName}: a tape with our programme's seal. It is in your cargo now.`);
        this.state.emitUpdates();
        return new Promise(resolve => setTimeout(() => {
            const played = window.StoryReel ? window.StoryReel.play('uncut') : Promise.resolve();
            played.then(() => {
                this.state.addLog('Vance: "That is not eight ships. That is hundreds."');
                this.state.addLog('A.U.R.A.: "Old recordings degrade, Vance. I would not read too much into it."');
                this.state.emitUpdates();
                resolve();
            });
        }, TAPE_DELAY_MS));
    }

    markFirstSignal() {
        const nodes = this.state.sectorNodes || [];
        if (this.state.currentSector !== 1 || nodes.some(p => p.isFirstSignal)) return;
        const target = nodes.find(p => isOrdinaryLandable(p) && (p.tags || []).includes('EXODUS_WRECK')) || nodes.find(isOrdinaryLandable);
        if (!target) return;
        target.tags = target.tags || [];
        if (!target.tags.includes('EXODUS_WRECK')) target.tags.push('EXODUS_WRECK');
        target.isFirstSignal = true;
    }

    /** After loading a save: a save made in orbit (in front of the light too, where the map would be a dead end) reopens that orbit. */
    resumeWhereSaved() {
        if (this.state.currentSystem) this.renderOrbit();   // loadGame has pointed it at the map's own planet
        else this.renderNav();
    }

    handleWarp(planet) {
        // The WARP button stays clickable for the 1s travel delay; a second click would charge
        // energy/rations and roll every hazard twice.
        if (this._isInTransit) return;
        if (planet.storyHidden) {                                                          // a faint contact: nothing to plot a course to yet
            this.state.addLog('A.U.R.A.: "That contact is too faint to plot a course to, Commander."');
            return;
        }
        // THE STRUCTURE - Cannot warp away. You are bound here.
        const currentPlanet = this.state.currentSystem;
        if (currentPlanet && (currentPlanet.isStructure || currentPlanet.type === 'STRUCTURE')) {
            if (planet && planet.id === currentPlanet.id) { this.renderOrbit(); return; }   // "approach" while already there: just show it
            this.state.addLog('A.U.R.A.: "The drive fires, Commander. We do not move."');
            this.state.addLog('A.U.R.A.: "I have checked it three times. There is only one way from here, and it is in."');
            return;
        }

        // Free: back into the orbit we are parked at, the light, and a story planet on a dated wreck's last course
        const cost = this.state.getWarpCost(planet);
        const isFinale = !!(planet.isStructure || planet.type === 'STRUCTURE');       // the end of the heading costs no stop and is never out of reach
        const isReentry = this.state.isReentry(planet);
        const isTrip = !isReentry && !isFinale;                                      // a new place: it uses a stop, even when the course is free
        if (isFinale && cost === 0) this.state.addLog('A.U.R.A.: "We do not need the drive, Commander. The light is pulling us in."');
        else if (isReentry) this.state.addLog("Back into orbit. No energy needed.");

        // Out of stops: the window has closed on everything except where you already are
        if (isTrip && !window.TEST_MODE && this.state.getStopsLeft() <= 0) {
            this.state.addLog('A.U.R.A.: "The jump window is closing, Commander. There is no time for another stop in this sector."');
            return;
        }

        // Course plot: the player flies the burn, then we re-enter here with the result.
        // Skipped for free warps, unaffordable warps (consumeEnergy reports those) and TEST_MODE.
        if (window.WarpPlot && !this._plotResult && cost > 0 && this.state.energy >= cost) {
            this._isInTransit = true;
            const plotOptions = this.getPlotOptions(planet.name, 'planet');
            plotOptions.burns = 1;
            plotOptions.cost = cost;                                                   // so the plot says what comes back in energy, not in percent
            plotOptions.isFirstPlot = this.state.currentSector === 1 && (this.state._paidWarps || 0) === 0;   // the first warp: A.U.R.A. flies it, nothing graded
            plotOptions.targetHtml = window.BodyRenderer ? window.BodyRenderer.body(planet, 64) : null;
            window.WarpPlot.play(plotOptions).then(result => {
                this._isInTransit = false;
                this._plotResult = result;
                this.handleWarp(planet);
            });
            return;
        }
        const plotResult = this._plotResult;
        this._plotResult = null;

        if (this.state.consumeEnergy(cost)) {
            this._isInTransit = true;
            const isBreach = this.isBreachDue(isTrip);
            if (isTrip) this.state._paidWarps = (this.state._paidWarps || 0) + 1;
            if (isTrip && !window.TEST_MODE) this.state.stopsLeft = Math.max(0, this.state.getStopsLeft() - 1);
            this.applyPlotResult(plotResult, cost);
            this.state.addLog(`Warping to ${planet.name}...`);

            // Tutorial: first warp
            if (!this.state._tutorialWarpSeen) {
                this.state._tutorialWarpSeen = true;
                setTimeout(() => {
                    this.state.addLog('A.U.R.A.: "Orbit, Commander. The scanner is ready, and so is the lander."');
                }, 500);
            }

            // A.U.R.A. commentary on warp initiation
            if (typeof AuraSystem !== 'undefined' && window.AuraSystem) {
                window.AuraSystem.tryComment('WARP_START', this.state);
            }

            this.state.currentSystem = planet;
            this.state.lastVisitedSystem = planet;

            // Time passes (nobody eats on a warp: rations go on the sector jump). No energy comes back on arrival: the price was the price.
            // Going back into the orbit we are parked at is no warp: no time passes, so free re-entries cannot farm the cultures or the scoop.
            if (!isReentry) this.state.passTime();

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

            // UPGRADE: Fuel Scoop — energy from a gas giant's atmosphere on arrival (Upgrades.js says 8-15)
            if (!isReentry && this.state.upgrades.includes('fuel_scoop') && (planet.type === 'GAS_GIANT' || planet.type === 'NEBULA')) {
                const scoop = Math.floor(Math.random() * 8) + 8; // 8-15
                this.state.energy = Math.min(100, this.state.energy + scoop);
                this.state.addLog(`The fuel scoop took ${scoop} energy from the atmosphere.`);
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

            // In the last sector nothing random fires: no hazards, faults, distress calls or crew moments (docs/CANON.md §9)
            const isQuiet = isFinale || this.state.currentSector >= FINAL_SECTOR;

            // Sector hazards during warp — delegated to SECTOR_CONFIG. Sector 1's first hole in the hull is played instead (Breach).
            const warpConfig = (typeof SECTOR_CONFIG !== 'undefined') ? SECTOR_CONFIG[this.state.currentSector] : null;
            const hazardDone = isBreach ? this.playBreach() : Promise.resolve();
            // Nothing random breaks before sector 1's scripted breach: the first hole in the hull is one the player sees happen
            const isBeforeBreach = this.state.currentSector === 1 && !this.state._breachDone;
            if (!isBreach && !isQuiet && !isBeforeBreach && warpConfig && warpConfig.hazard && warpConfig.hazard.onWarp) warpConfig.hazard.onWarp(this.state);

            // Ship malfunction check during warp (never on top of the breach: one emergency at a time)
            if (typeof rollShipMalfunction !== 'undefined' && !isQuiet && !isBreach && !isBeforeBreach) {
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
                        this.state.addLog(`${c.name} is still kept asleep. ${c._sedatedUntilWarp} more jumps until he wakes.`);
                    }
                }
                if (c.tags && c.tags.includes('CONFINED') && c._confinedUntilWarp !== undefined) {
                    c._confinedUntilWarp--;
                    if (c._confinedUntilWarp <= 0) {
                        c.tags = c.tags.filter(t => t !== 'CONFINED');
                        delete c._confinedUntilWarp;
                        this.state.addLog((c.tags || []).includes('LEADER') ? 'The door to your quarters opens. Nobody says anything. You take the chair back.' : `${c.name} is back at his post. Nobody brings it up.`);
                    }
                }
            });

            // arrive once the breach (if any) is dealt with: the crew react to the orbit only then
            hazardDone.then(() => this.reactToOrbit(planet, isFinale)).then(() => setTimeout(() => {
                // Check if this is a station - use different message
                if (planet.isStation || planet.type === 'STATION') {
                    this.state.addLog(`Docking approach started. Station sensors detecting our arrival.`);
                } else if (planet.isAsteroidField || planet.type === 'ASTEROID_FIELD') {
                    this.state.addLog(`Entered debris field. Navigation systems active.`);
                } else if (planet.isStructure || planet.type === 'STRUCTURE') {
                    // THE STRUCTURE - special arrival
                    this.state.addLog(`Approach complete. The light fills every window. It is not warm.`);   // A.U.R.A. first says "five" inside it
                    // Switch to Heaven music
                    if (window.AudioSystem && window.AudioSystem.playHeavenMusic) {
                        window.AudioSystem.playHeavenMusic();
                    }
                } else {
                    this.state.addLog(`Orbit established. Systems Green.`);
                }
                this._isInTransit = false;
                this.renderOrbit();

                // Auto-save after arriving at planet
                this.autoSave();

                // Check for distress signals after warp (small chance) - use queue to prevent stacking; never in the last sector
                if (typeof rollDistressSignal !== 'undefined' && !isQuiet) {
                    const distress = rollDistressSignal(this.state, 'warp');
                    if (distress) {
                        setTimeout(() => {
                            this.state.addLog("⚠ INCOMING TRANSMISSION: Old distress signal detected...");
                            this.queueModal('distress', distress);
                        }, 1500);
                    }
                }

                // Check for crew personal events - queued to not overlap; never in the last sector
                if (!isQuiet) setTimeout(() => this.checkForCrewEvent(), 2000);
            }, 1000));
        }
    }

    /** The crew and A.U.R.A. react to the new orbit. Not at the light: nothing random happens there. */
    reactToOrbit(planet, isFinale) {
        const barks = typeof BarkSystem !== 'undefined' ? window.BarkSystem : null;
        if (barks && !isFinale) {
            barks.checkPlanetBarks(this.state, planet);
            setTimeout(() => barks.tryBark('ENTER_ORBIT', this.state, { planet }), 50);     // if no special bark fired
            setTimeout(() => barks.checkResourceBarks(this.state), 600);
        }
        const aura = typeof AuraSystem !== 'undefined' ? window.AuraSystem : null;
        if (!aura || isFinale) return;
        aura.tryComment('ENTER_ORBIT', this.state);
        aura.checkAdversarialAction(this.state);
        if (aura.triggerPremonition(this.state)) this.state.addLog(`[A.U.R.A.'s reading was right.]`);
        aura.generatePremonition(this.state);                                                // maybe a new one for the next action
    }

    /**
     * Sector 1's hole in the hull is played once per run (Breach), on a warp to a new place (a free course counts; going back
     * into orbit and the light do not). Never the first warp of the game: that one belongs to the opening, and the head count
     * plays when the ship first leaves orbit, before any second warp.
     */
    isBreachDue(isTrip) {
        const isEligible = this.state.currentSector === 1 && !this.state._breachDone && isTrip && (this.state._paidWarps || 0) >= 1;
        return isEligible && !!window.MiniHost && window.MiniHost.has('breach');
    }

    /** Seal the breach. Resolves once it is over and what it cost is applied (it never rejects: the warp must still arrive). */
    playBreach() {
        this.state._breachDone = true;
        const crew = this.state.crew.map(c => ({ id: crewIdOf(c), alive: c.status !== 'DEAD', injured: c.status === 'INJURED' })).filter(c => c.id);
        return window.MiniHost.play('breach', { crew, sector: 1 }).then(result => this.applyBreachResult(result), err => console.error(err));
    }

    /** The deck that lost its air is damaged; whoever was caught in it is hurt. */
    applyBreachResult(result) {
        if (!result) return;
        this.state.addLog(result.damagedDeck
            ? `Micrometeorite strike. The ship lost ${result.airLostPercent}% of its air. The holed deck is sealed off.`
            : `Micrometeorite strike. The ship lost ${result.airLostPercent}% of its air before the hole was patched.`);
        if (result.damagedDeck) this.state.damageDeck(result.damagedDeck);
        this.state.crew.filter(c => c.status === 'HEALTHY' && (result.hurt || []).includes(crewIdOf(c))).forEach(c => {
            c.status = 'INJURED';
            this.state.addLog(`${c.name} was caught in the breach and is injured.`);
            window.dispatchEvent(new CustomEvent('crew-injury', { detail: { crew: c } }));
        });
        this.state.emitUpdates();
    }

    /** A pooled card turns up once the ship has reached its minSector: hull numbers and ship counts belong to sectors (CANON.md section 2). */
    hasReachedSector(encounter) {
        return (this.state.currentSector || 1) >= (encounter.minSector || 1);
    }

    /**
     * Show station encounter modal when investigating a station
     */
    showStationEncounter(station) {
        if (!station) return; // re-entry is guarded in handleStationAction, which marks the station before calling this

        const encounters = (typeof SPACE_STATION_ENCOUNTERS !== 'undefined') ? SPACE_STATION_ENCOUNTERS : [];
        if (encounters.length === 0) {
            this.state.addLog("ERROR: Station encounter data unavailable.");
            return;
        }

        // Select by weight, from the stations this sector has reached (minSector)
        const pool = encounters.filter(e => this.hasReachedSector(e));
        const totalWeight = pool.reduce((sum, e) => sum + e.weight, 0);
        let roll = Math.random() * totalWeight;
        let selected = pool[0];
        for (const enc of pool) {
            roll -= enc.weight;
            if (roll <= 0) { selected = enc; break; }
        }

        const stationName = station.name || 'Unknown Station';

        window.EncounterCard.open(this, {
            tone: 'station', kicker: 'INSIDE THE STATION', title: selected.title,
            facts: [['WHERE', stationName]],
            context: selected.context(stationName), dialogue: selected.dialogue, choices: selected.choices,
            onPick: (idx) => {
                const result = selected.choices[idx].effect(this.state);
                if (result) this.state.addLog(`STATION: ${result}`);
                this.state.emitUpdates(); // already marked as investigated in handleStationAction
            }
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // STATION INVESTIGATION — Abandoned space stations
    // ═══════════════════════════════════════════════════════════════
    handleStationAction() {
        const station = this.state.currentSystem;
        if (!station || !station.isStation) {
            this.state.addLog("No station detected at this location.");
            return;
        }
        if (station.stationInvestigated) {
            this.state.addLog("We already searched this station.");
            return;
        }

        this.state.addLog(`Starting docking procedure with ${station.name}...`);
        this.state.passTime();

        // Mark as investigated immediately to prevent re-clicking
        station.stationInvestigated = true;
        this.orbitView.updateCommandDeck(station);

        // Boarding walk first; the station's story encounter is the prize for reaching its command deck
        if (window.BoardingParty) {
            window.BoardingParty.start(this, station).then(result => {
                this.state._boarder = result.member || null;
                if (result.reachedCommand) this.showStationEncounter(station);
            });
            return;
        }
        this.showStationEncounter(station);
    }

    // ═══════════════════════════════════════════════════════════════
    // ASTEROID FIELD MINING — Resource digging from debris fields
    // ═══════════════════════════════════════════════════════════════
    handleAsteroidAction() {
        const field = this.state.currentSystem;
        if (!field || !field.isAsteroidField) {
            this.state.addLog("No asteroid field detected at this location.");
            return;
        }
        if (field.asteroidMined) {
            this.state.addLog("Asteroid field already mined.");
            return;
        }

        this.state.addLog(`Entering ${field.name}. Mining systems online...`);
        this.state.passTime();

        // Mark as mined immediately to prevent re-clicking
        field.asteroidMined = true;
        this.orbitView.updateCommandDeck(field);

        // Show the asteroid encounter
        this.showAsteroidEncounter(field);
    }

    /**
     * Show asteroid field encounter modal when mining
     */
    showAsteroidEncounter(field) {
        if (!field) return; // re-entry is guarded in handleAsteroidAction, which marks the field before calling this

        const encounters = (typeof ASTEROID_FIELD_ENCOUNTERS !== 'undefined') ? ASTEROID_FIELD_ENCOUNTERS : [];
        if (encounters.length === 0) {
            this.state.addLog("ERROR: Asteroid encounter data unavailable.");
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

        const fieldName = field.name || 'Unknown Field';

        window.EncounterCard.open(this, {
            tone: 'rock', kicker: 'ASTEROID FIELD', title: selected.title,
            facts: [['WHERE', fieldName]],
            context: selected.context(fieldName), dialogue: selected.dialogue, choices: selected.choices,
            onPick: (idx) => {
                const result = selected.choices[idx].effect(this.state);
                if (result) this.state.addLog(`MINING: ${result}`);
                this.state.emitUpdates(); // already marked as mined in handleAsteroidAction
            }
        });
    }

    /**
     * Show distress signal encounter modal
     */
    /** Signals age with the sector (S1 about 20 years … S6 about 400), like the wrecks and stations. 'UNKNOWN' stays unknown. */
    getSignalAge(encounter) {
        const rolled = encounter.getSignalAge();
        if (typeof rolled !== 'number') return rolled;
        const SECTOR_YEARS = [20, 20, 100, 200, 250, 320, 400], MIN_SHARE = 0.6;
        const base = SECTOR_YEARS[Math.max(1, Math.min(FINAL_SECTOR, this.state.currentSector || 1))];
        return Math.max(1, Math.round(base * (MIN_SHARE + Math.random() * (1 - MIN_SHARE))));
    }

    showDistressSignal(encounter) {
        if (!encounter) return;

        const signalAge = this.getSignalAge(encounter);

        window.EncounterCard.open(this, {
            tone: 'distress', kicker: 'DISTRESS SIGNAL', title: encounter.title, hasSignal: true,
            facts: [['SENT', signalAge === 'UNKNOWN' ? 'Nobody can tell when' : `${signalAge} years ago`]],
            context: encounter.context(signalAge), dialogue: encounter.dialogue, choices: encounter.choices,
            onPick: (idx) => {
                const result = encounter.choices[idx].effect(this.state);
                if (result) this.state.addLog(`SIGNAL: ${result}`);
                this.state.emitUpdates();
                this._modalActive = false;
                this._processModalQueue();
            }
        });
    }

    /**
     * Queue a modal to be shown (prevents stacking)
     */
    queueModal(type, data) {
        this._modalQueue.push({ type, data });
        this._processModalQueue();
    }

    /**
     * Process the next modal in queue
     */
    _processModalQueue() {
        if (this._modalActive || this._modalQueue.length === 0) return;

        // Check if any modal is currently open
        const existingModal = document.querySelector('.modal-overlay');
        if (existingModal) {
            // Wait and retry
            setTimeout(() => this._processModalQueue(), 500);
            return;
        }

        this._modalActive = true;
        const next = this._modalQueue.shift();

        switch (next.type) {
            case 'distress':
                this.showDistressSignal(next.data);
                break;
            case 'crew':
                this.showCrewPersonalEvent(next.data);
                break;
            default:
                this._modalActive = false;
                this._processModalQueue();
        }
    }

    /**
     * Show crew personal event modal
     */
    showCrewPersonalEvent(event) {
        if (!event || !event.targetCrew) return;

        const crew = event.targetCrew;
        const inState = v => (typeof v === 'function' ? v(this.state) : v);   // a scene may word itself from what the crew has seen
        const colors = {
            'jaxon': '#f0a030', 'aris': '#40c8ff', 'vance': '#ff5050',
            'mira': '#d070ff', 'commander': '#ffffff'
        };
        const color = colors[event.crewId] || '#ffffff';

        window.EncounterCard.open(this, {
            tone: 'crew', color, kicker: (crew.tags || []).includes('LEADER') ? 'A NIGHT ON THE BRIDGE' : `A MOMENT WITH ${String(crew.name || '').toUpperCase()}`, title: event.title,
            context: inState(event.context), dialogue: inState(event.dialogue),
            choices: event.choices.map(c => ({ text: c.text, desc: this._getCrewChoiceHint(c) })),
            onPick: (idx) => {
                const result = event.choices[idx].effect(this.state, crew);
                if (result) this.state.addLog(`CREW: ${result}`);
                this.state.emitUpdates();
                this.autoSave();                     // each moment happens once a run: a reload must not bring it back
                this._modalActive = false;
                this._processModalQueue();
            }
        });
    }
    /**
     * Generate hint text for crew event choice effects
     * Prefers explicit desc if provided, otherwise parses the effect function
     */
    _getCrewChoiceHint(choice) {
        if (!choice) return '';

        // Use explicit description if provided
        if (choice.desc) return choice.desc;

        if (!choice.effect) return '';

        const effectStr = choice.effect.toString();

        // Look for common patterns in effect code
        const hints = [];

        // Stress changes
        if (effectStr.includes('stress - 2') || effectStr.includes('stress -2')) hints.push('-2 Stress');
        else if (effectStr.includes('stress - 1') || effectStr.includes('stress -1')) hints.push('-1 Stress');
        else if (effectStr.includes('stress + 2') || effectStr.includes('stress +2')) hints.push('+2 Stress');
        else if (effectStr.includes('stress + 1') || effectStr.includes('stress +1')) hints.push('+1 Stress');
        if (effectStr.includes('forEach') && effectStr.includes('stress')) hints.push('Affects all crew');

        // Healing
        if (effectStr.includes("status = 'HEALTHY'")) hints.push('Heals injured');

        // Deck repairs
        if (effectStr.includes("status = 'OPERATIONAL'")) hints.push('Repairs deck');

        // Energy changes
        if (effectStr.includes('energy - 5') || effectStr.includes('energy -5')) hints.push('-5 Energy');
        if (effectStr.includes('energy +') || effectStr.includes('energy = Math.min(100, state.energy +')) hints.push('+Energy');

        // Salvage changes
        if (effectStr.includes('salvage = Math.min') && effectStr.includes('salvage +')) hints.push('+Salvage');

        // A.U.R.A. ethics
        if (effectStr.includes('adjustEthics(1)')) hints.push('A.U.R.A. trust+');
        if (effectStr.includes('adjustEthics(-1)')) hints.push('A.U.R.A. trust-');

        // Colony knowledge
        if (effectStr.includes('_colonyKnowledge')) hints.push('+Colony Knowledge');

        // Special flags
        if (effectStr.includes('_vanceResolve')) hints.push('Improves future EVAs');

        return hints.length > 0 ? hints.join(', ') : '';
    }

    /**
     * Check for and trigger crew personal events after actions
     */
    checkForCrewEvent() {
        if (typeof checkCrewPersonalEvent === 'undefined') return;

        const event = checkCrewPersonalEvent(this.state);
        if (event) {
            this.queueModal('crew', event);
        }
    }

    handleRemoteScan(planet) {
        // Bridge must be operational for remote scan
        if (!this.state.isDeckOperational('bridge')) {
            this.state.addLog("BRIDGE OFFLINE: Remote scanning unavailable.");
            return;
        }
        const hasBigDish = this.state.upgrades.includes('sensor_v2');                     // Sensor Array V2: scans also report air and gravity
        // A scan from the map costs no energy (docs/ECONOMY.md)
        const data = this.state.sectorNodes.find(p => p.id === planet.id);
        if (data) {
            data.remoteScanned = true;
            if (hasBigDish) data.dishRevealed = true;

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
                this.state.addLog(`A.U.R.A.: "Scan complete, Commander. All readings normal." [READINGS UNRELIABLE]`);
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

            const dishStr = hasBigDish && data.metrics ? ` Air: ${data.atmosphere || 'unknown'}. Gravity: ${data.metrics.gravity != null ? data.metrics.gravity.toFixed(1) + ' G' : 'unknown'}.` : '';
            this.state.addLog(`Long-range scan: ${planet.name}. Salvage: ${metalLevel}. Energy: ${energyLevel}. Signals: ${signalStr}.${dishStr}`);

            // Force re-render of right panel
            this.navView.handlePlanetSelect(data);
        }
    }

    /** What WarpPlot needs to set its difficulty and pick who reacts. */
    getPlotOptions(targetName, mode) {
        const commander = this.state.crew.find(c => c.tags.includes('LEADER'));
        return {
            targetName, mode,
            sector: this.state.currentSector,
            isBridgeDamaged: !this.state.isDeckOperational('bridge'),
            pilotStress: commander ? commander.stress : 0,
            crew: this.state.crew,
            windowBonus: this.state.upgrades.includes('gyro_fins') ? 1.25 : 1,
        };
    }

    /** Tally of tasks the player did by hand versus handed to A.U.R.A. (warp plots, scan tuning). Saved with the game. */
    noteReliance(isAuto) {
        const tally = this.state.reliance || (this.state.reliance = { auto: 0, manual: 0 });
        tally[isAuto ? 'auto' : 'manual'] += 1;
    }

    /**
     * What A.U.R.A. says about it after a sector jump, or null while there is too little to go on.
     * lastWasAuto (optional): who flew the jump just made; she stays quiet when it goes against the pattern.
     */
    getRelianceVoice(lastWasAuto) {
        const tally = this.state.reliance || { auto: 0, manual: 0 }, total = tally.auto + tally.manual;
        if (total < RELIANCE_MIN_SAMPLES) return null;
        const share = tally.auto / total;
        if (share >= 0.6 && lastWasAuto !== false) return { name: 'A.U.R.A.', face: null, text: 'You let me fly again, Commander. I am glad to. You should rest.' };
        if (share <= 0.2 && lastWasAuto !== true) return { name: 'A.U.R.A.', face: null, text: 'You flew it yourself again, Commander. I am here when you want me.' };
        return null;
    }

    /** Clean burns hand fuel back, bad ones burn extra; rough and A.U.R.A. plots change nothing. */
    applyPlotResult(result, baseCost) {
        if (!result || !window.WarpPlot) return;
        if (result.isFirstPlot) return;                                           // A.U.R.A. flew the first one for you: no grade, no cost, not a choice
        this.noteReliance(!!result.auto);
        let delta = window.WarpPlot.energyDelta(result.grade, baseCost);
        if (delta < 0 && this.state.upgrades.includes('shield_core')) {
            this.state.addLog("Bad burn — the shielded core soaked it up. No extra fuel lost.");
            delta = 0;
        }
        if (delta === 0) {
            if (result.auto) this.state.addLog("A.U.R.A. plotted the jump. Safe. Unremarkable.");
            return;
        }
        this.state.energy = Math.max(0, Math.min(100, this.state.energy + delta));
        this.state.addLog(delta > 0 ? `Clean burn: ${delta} energy recovered.` : `Bad burn: ${-delta} extra energy lost.`);
        this.state.emitUpdates();
    }

    /** The sector jump, flown (Corridor). Resolves once the flight is over and what it cost is applied; it never rejects. */
    flyCorridor() {
        const from = this.state.currentSector;
        const damaged = Object.fromEntries(Object.entries(this.state.shipDecks).map(([key, deck]) => [key, deck.status === 'DAMAGED']));
        const opts = { fromSector: from, toSector: from + 1, crew: this.state.crew, damaged, scrapesPerBreak: SCRAPES_PER_BROKEN_DECK, avoidHulls: this.takenHulls() };
        return window.MiniHost.play('corridor', opts)
            .then(result => this.applyCorridorResult(result), err => console.error(err));
    }

    /**
     * Every third scrape breaks a deck: the one the flight showed turning red, else a random one.
     * Who flew it counts toward what A.U.R.A. says about who flies.
     */
    applyCorridorResult(result) {
        if (!result) return;
        this.noteReliance(!!result.auraFlew);
        const brokenDecks = Math.floor((result.scrapes || 0) / SCRAPES_PER_BROKEN_DECK), shownRed = result.damagedRooms || [];
        for (let k = 0; k < brokenDecks; k++) {
            if (!this.state.damageDeck(shownRed[k])) this.state.damageRandomDeck();
        }
        this.state._encounteredShipNames = (this.state._encounteredShipNames || []).concat((result.hulls || []).map(h => `EXODUS-${h}`));   // seen in flight: never boarded later
        const relianceVoice = this.getRelianceVoice(!!result.auraFlew);
        if (relianceVoice) this.state.addLog(`A.U.R.A.: "${relianceVoice.text}"`);
        this.state.emitUpdates();
    }

    /** What the sector jump costs now: 8, double with engineering down, 4 less once with the drive braced (the hull-cracks campfire). */
    sectorJumpCost() {
        const base = this.state.isDeckOperational('engineering') ? SECTOR_JUMP_BASE_COST : SECTOR_JUMP_BASE_COST * 2;
        return this.state._driveReinforced ? Math.max(0, base - DRIVE_BRACE_SAVING) : base;
    }

    handleSectorJump() {
        if (this._isInTransit) return;
        if (this.state.currentSector >= FINAL_SECTOR) {
            this.state.addLog('A.U.R.A.: "Nothing is charted past this sector, Commander. The heading ends at the light."');
            return;
        }
        const jumpCost = this.sectorJumpCost();
        if (this.state.energy < jumpCost && !window.TEST_MODE) { this.offerReserveJump(jumpCost); return; }
        const leftBehind = this.whatIsLeftInSector();
        if (leftBehind) { this.askBeforeJump(leftBehind); return; }
        this.jumpNow(jumpCost);
    }

    /**
     * What the jump would leave behind, in A.U.R.A.'s words, or null when nothing is left: a stop still to spend on a
     * world we can reach, or the marked wreck / the story planet not boarded yet (and still reachable, or still hidden with a stop left).
     */
    whatIsLeftInSector() {
        const state = this.state, stopsLeft = state.getStopsLeft();
        const here = state.lastVisitedSystem;
        const canReach = p => !p.ghost && !p.storyHidden && (state.isReentry(p) || stopsLeft > 0);
        const isStoryWreck = p => (p.isFirstSignal || p.isStoryPlanet) && !p.exodusInvestigated;
        const storyLeft = (state.sectorNodes || []).find(p => isStoryWreck(p) && canReach(p));
        if (storyLeft) return storyLeft.isStoryPlanet
            ? `We have not been down to ${storyLeft.name} yet, Commander. Their last course led there.`
            : `The wreck I marked is still out there, Commander. Nobody has been aboard.`;
        // A story planet still hidden is not lost while a stop is left: dating a wreck (or the last stop) puts it on the map
        const hiddenStory = stopsLeft > 0 && (state.sectorNodes || []).find(p => p.isStoryPlanet && p.storyHidden && !p.exodusInvestigated);
        if (hiddenStory) return 'The faint contact is still out there, Commander. One of our ships may be there.';
        const worldsAhead = (state.sectorNodes || []).some(p => !p.ghost && !p.storyHidden && !(here && here.id === p.id)
            && !(p.isStructure || p.type === 'STRUCTURE') && state.getWarpCost(p) <= state.energy);
        if (stopsLeft > 0 && worldsAhead) return 'There are still worlds ahead, Commander. We have time for another stop.';
        return null;
    }

    /** JUMP SECTOR clicked with something left: A.U.R.A. asks first (docs/GAME_FLOW.md 2.10). "Not yet" comes first, nearer the button. */
    askBeforeJump(reason) {
        if (!window.EncounterCard) { this.jumpNow(this.sectorJumpCost()); return; }
        window.EncounterCard.open(this, {
            tone: 'station', kicker: 'SECTOR JUMP', title: 'Jump now?', zIndex: 2800,
            dialogue: [{ speaker: 'A.U.R.A.', text: `${reason} Jump anyway?` }],
            choices: [
                { text: 'Not yet', desc: 'Stay in this sector.' },
                { text: 'Jump now', desc: 'Whatever is left here is gone for good.' },
            ],
            onPick: idx => { if (idx === 1) this.jumpNow(this.sectorJumpCost()); },
        });
    }

    /** The jump itself, once it is paid for and nobody is asking any more. */
    jumpNow(jumpCost) {
        if (this._isInTransit) return;
        if (this.state.energy < jumpCost && !window.TEST_MODE) { this.offerReserveJump(jumpCost); return; }
        if (this.state._driveReinforced) {
            this.state._driveReinforced = false;                                    // single use
            this.state.addLog(`Drive reinforcement active: Jump cost reduced by ${this.sectorJumpCost() - jumpCost} energy.`);
        }
        this.state.consumeEnergy(jumpCost);
        this.startSectorJump();
    }

    /**
     * Short of energy for the jump. The jump is always a way out: A.U.R.A. can run the drive on the reserve,
     * which takes every bit of energy left and the crew quarters' power. Turned down, nothing happens.
     */
    offerReserveJump(jumpCost) {
        if (!window.EncounterCard) { this.state.addLog('WARNING: Not enough Energy!'); return; }
        window.EncounterCard.open(this, {
            tone: 'alert', kicker: 'SHIP ALERT', title: 'Not enough energy to jump', zIndex: 2800,
            context: `The jump needs ${jumpCost} energy. We have ${this.state.energy}.`,
            dialogue: [{ speaker: 'A.U.R.A.', text: 'I can run the drive on the reserve, Commander. The crew quarters will lose power.' }],
            choices: [
                { text: 'Jump on the reserve', desc: 'Uses all the energy left. The crew quarters are damaged.' },
                { text: 'Not yet', desc: 'Probes and wrecks can still bring energy back.' },
            ],
            onPick: idx => {
                if (idx !== 0) return;
                this.state.energy = 0;
                this.state.damageDeck('quarters', 'The drive ran on the reserve. The crew quarters have lost power.');
                this.state.emitUpdates();
                this.startSectorJump();
            },
        });
    }

    /** The sector jump, paid for: the flight, the crew, the campfire, then the new sector. */
    startSectorJump() {
        this._isInTransit = true;
        this.state.addLog("Starting Sector Jump...");

        // Time passes, and the crew eats: the jump is where rations go (docs/ECONOMY.md)
        this.state.passTime();
        this.state.eatOnJump();

        // Passive stress recovery on sector jump (if quarters operational)
        if (this.state.isDeckOperational('quarters')) {
            this.state.crew.forEach(c => {
                if (c.status !== 'DEAD' && c.stress > 0) {
                    c.stress--;
                }
            });
            this.state.addLog("Crew Quarters: Rest cycle complete. Stress levels reduced.");
        }

        // The flight, then what the crew makes of it, then the campfire. Into sector 3 the burn stalls and the throw plays instead.
        const isThrow = this.state.currentSector + 1 === 3 && window.TheThrow && !window.TEST_MODE;
        this.showWarpAnimation(() => {
            const afterFlight = isThrow ? window.TheThrow.play(this)
                : this.reactToSectorJump().then(() => new Promise(done => this.showCampfireEvent(done)));
            afterFlight.then(() => this.enterNextSector());
        }, isThrow);
    }

    /** The header line for a sector, named as SECTOR_CONFIG names it: "/// SECTOR 3: THE SIGNAL". */
    sectorTitle(sector) {
        const config = typeof SECTOR_CONFIG !== 'undefined' ? SECTOR_CONFIG[sector] : null;
        return `/// SECTOR ${sector}: ${config ? config.name : 'UNKNOWN'}`;
    }

    /** The jump is over: the next sector is made, saved and named. */
    enterNextSector() {
        this._isInTransit = false;
        const nextSector = this.state.currentSector + 1;
        this.state.sectorNodes = PlanetGenerator.generateSector(nextSector);
        this.state.currentSector = nextSector;
        this.state.lastVisitedSystem = null;
        this.plantBriefingTape();
        this.plantSectorPage();
        this.state.emitUpdates();                                                   // the header names the new sector at once

        // Sector enter hazard (e.g., S3 ghost planets) — pass state for ghost planet logging
        const enterConfig = (typeof SECTOR_CONFIG !== 'undefined') ? SECTOR_CONFIG[nextSector] : null;
        if (enterConfig && enterConfig.hazard && enterConfig.hazard.onSectorEnter) {
            enterConfig.hazard.onSectorEnter(this.state, this.state.sectorNodes);
        }

        this.renderNav();

        // Auto-save after sector jump
        this.autoSave();

        // Sector name from config
        const sectorName = enterConfig ? enterConfig.name : '';
        this.state.addLog(`Sector ${nextSector}${sectorName ? ' — ' + sectorName : ''}`);   // MissionLog turns this into the new stop's header

        // Dispatch sector entered event for audio
        window.dispatchEvent(new CustomEvent('sector-entered', { detail: { sector: nextSector } }));

        // Special barks for sector entries
        if (typeof BarkSystem !== 'undefined' && window.BarkSystem) {
            if (nextSector === 3) {
                window.BarkSystem.tryBark('SECTOR_3_ENTRY', this.state);
            } else if (nextSector === FINAL_SECTOR) {
                window.BarkSystem.tryBark('SECTOR_5_ENTRY', this.state); // key kept for saves; the lines are about the LAST sector
            }
        }
    }

    /**
     * Once the flight is over (never after the throw: that jump does not finish), the crew and A.U.R.A. say it went fine,
     * and the drive may fault. Resolves once any fault card is dealt with.
     */
    reactToSectorJump() {
        if (window.BarkSystem) window.BarkSystem.tryBark('SECTOR_JUMP', this.state);
        if (window.AuraSystem) window.AuraSystem.tryComment('SECTOR_JUMP', this.state);
        const malfunction = typeof rollShipMalfunction !== 'undefined' ? rollShipMalfunction(this.state, 'sector_jump') : null;
        return malfunction ? this.showShipMalfunctionModal(malfunction) : Promise.resolve();
    }

    /** The sector jump itself: flown (Corridor), except into sector 3, where the burn is plotted and does not finish. */
    showWarpAnimation(onComplete, isStalled) {
        if (isStalled) { this.plotStalledBurn(onComplete); return; }
        if (window.MiniHost && window.MiniHost.has('corridor')) { this.flyCorridor().then(onComplete); return; }
        onComplete();
    }

    /** Into sector 3: the plot (WarpPlot), then the throw (TheThrow, played by handleSectorJump). No sector name; only A.U.R.A. may speak. */
    plotStalledBurn(onComplete) {
        if (!window.WarpPlot) { onComplete(); return; }
        const nextSector = this.state.currentSector + 1;
        const plotOptions = this.getPlotOptions(`S${nextSector} —`, 'sector');
        plotOptions.cost = SECTOR_JUMP_BASE_COST;                                    // what applyPlotResult grades against below
        plotOptions.arrival = { kicker: `SECTOR ${nextSector} OF ${FINAL_SECTOR}`, title: '—', line: 'The jump did not finish.', voices: [] };
        const relianceVoice = this.getRelianceVoice();
        if (relianceVoice) plotOptions.arrival.voices.push(relianceVoice);
        window.WarpPlot.play(plotOptions).then(result => {
            this.applyPlotResult(result, SECTOR_JUMP_BASE_COST);
            onComplete();
        });
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

        // Pick event, preferring higher priority (3=critical story, 2=character, 1=generic)
        // Sort by priority descending, then pick randomly from highest priority tier
        // Weighted by priority (story talks are likelier, not guaranteed), and never the same talk twice in one run
        this.state._seenCampfires = this.state._seenCampfires || [];
        const fresh = eligible.filter(e => !this.state._seenCampfires.includes(e.id));
        const candidates = fresh.length ? fresh : eligible;
        const topPriority = Math.max(...candidates.map(e => e.priority || 1));               // a priority-3 talk is the act break: it always fires
        const pool = candidates.filter(e => (e.priority || 1) === topPriority);
        const event = pool[Math.floor(Math.random() * pool.length)];
        if (event.id) this.state._seenCampfires.push(event.id);

        // Sector names — pull from SECTOR_CONFIG or fallback (up to sector 6)
        const SECTOR_NAMES = {};
        if (typeof SECTOR_CONFIG !== 'undefined') {
            for (let s = 1; s <= 6; s++) {
                SECTOR_NAMES[s] = SECTOR_CONFIG[s] ? SECTOR_CONFIG[s].name : '???';
            }
        } else {
            Object.assign(SECTOR_NAMES, { 1: 'THE GRAVEYARD', 2: 'THE DARK VOID', 3: 'THE SIGNAL', 4: 'THE GARDEN', 5: 'THE TALLY', 6: 'THE LIGHT' });
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

        onComplete(); // NarrativeModal is always loaded; nothing else to show
    }

    /**
     * The strange rule of this story: the further out you go, the HIGHER the hull number and the OLDER the wreck.
     * Sectors 1–2 hold the eight ships the crew was told about. From sector 3 on the numbers run into the hundreds,
     * then the tens of thousands: every ship Earth ever built was sent down this one heading, and the later ones
     * were thrown further back in time, so they have been dead for centuries.
     */
    randomWreckHull(taken = []) {
        const [lo, hi] = WRECK_HULL_RANGE[Math.max(1, Math.min(FINAL_SECTOR, this.state.currentSector || 1))];
        const free = [];                                                   // a short range (the eight) is picked from what is left
        if (hi - lo < SHORT_HULL_RANGE) for (let h = lo; h <= hi; h++) if (!taken.includes(h)) free.push(h);
        return free.length ? free[Math.floor(Math.random() * free.length)] : lo + Math.floor(Math.random() * (hi - lo + 1));
    }

    /** Hull numbers already spoken for: wrecks boarded or seen in flight, the story wrecks, the ones the films show. */
    takenHulls() {
        const seen = (this.state._encounteredShipNames || []).map(name => parseInt(String(name).replace('EXODUS-', ''), 10));
        const story = (typeof STORY_PLANETS !== 'undefined' ? STORY_PLANETS : []).map(def => def.hull);
        return seen.concat(story, REEL_HULLS).filter(Number.isFinite);
    }

    /** A wreck's name from its hull number: EXODUS-4 "LAZARUS". The name is one no wreck in `used` has, while any are left. */
    getWreckName(hull, used = []) {
        const count = WRECK_CALLSIGNS.length, isFree = callsign => !used.some(name => String(name).includes(`"${callsign}"`));
        const callsign = WRECK_CALLSIGNS.map((_, k) => WRECK_CALLSIGNS[(hull + k) % count]).find(isFree) || WRECK_CALLSIGNS[hull % count];
        return `EXODUS-${hull} "${callsign}"`;
    }

    /** The wreck on this planet gets its name the first time a team boards it: a story planet's own hull, or a new one. */
    nameWreck(planet) {
        if (planet.wreckName) return planet.wreckName;
        this.state._encounteredShipNames = this.state._encounteredShipNames || [];
        const taken = this.takenHulls();                                        // a story wreck keeps its own hull; nothing else reuses one
        let hull = planet.wreckHull || this.randomWreckHull(taken);
        for (let tries = 0; !planet.wreckHull && taken.includes(hull) && tries < 10; tries++) hull = this.randomWreckHull(taken);
        planet.wreckHull = hull;
        planet.wreckName = this.getWreckName(hull, this.state._encounteredShipNames);   // two wrecks never share a name
        this.state._encounteredShipNames.push(planet.wreckName);
        return planet.wreckName;
    }

    /** The marked transponder from the opening pays off: whatever you chose to do in that wreck, this page was in its logbook. */
    findDiscDrawing(shipName) {
        const DISC_REVEAL_DELAY_MS = 900;
        if (typeof ITEMS === 'undefined' || !ITEMS.DISC_DRAWING || this.state.cargo.some(i => i.id === ITEMS.DISC_DRAWING.id)) return Promise.resolve();
        this.state.cargo.push({ ...ITEMS.DISC_DRAWING, acquiredAt: shipName });
        this.state.addLog(`In the logbook of ${shipName}: a folded page. A drawing of a gold disc. It is in your cargo now.`);
        this.state.emitUpdates();
        return new Promise(resolve => setTimeout(() => {
            (window.DiscDocument ? window.DiscDocument.open(this) : Promise.resolve()).then(resolve);
        }, DISC_REVEAL_DELAY_MS));
    }

    /** One of the Exodus wreck stories, weighted, avoiding ones already told while any are left. needsHatch: only whole ships. */
    pickExodusEncounter(needsHatch) {
        const allEncounters = ((typeof EXODUS_ENCOUNTERS !== 'undefined') ? EXODUS_ENCOUNTERS : []).filter(e => !(needsHatch && e.noHatch));
        if (allEncounters.length === 0) return null;
        this.state._encounteredExodus = this.state._encounteredExodus || [];
        let encounters = allEncounters.filter(e => !this.state._encounteredExodus.includes(e.id));
        if (encounters.length === 0) {
            encounters = allEncounters;
            this.state.addLog('A.U.R.A.: "The same class of hull, Commander. They were all built to one drawing."');
        }
        let roll = Math.random() * encounters.reduce((sum, e) => sum + e.weight, 0);
        let selected = encounters[0];
        for (const enc of encounters) {
            roll -= enc.weight;
            if (roll <= 0) { selected = enc; break; }
        }
        if (!this.state._encounteredExodus.includes(selected.id)) this.state._encounteredExodus.push(selected.id);
        return selected;
    }

    /**
     * Which of the wreck stories this planet's wreck is. Picked once and kept on the planet, so the landing game can draw
     * the same wreck the story then tells (whole, broken in two, burned, or only a crater).
     */
    wreckEncounterFor(planet) {
        const all = typeof EXODUS_ENCOUNTERS !== 'undefined' ? EXODUS_ENCOUNTERS : [];
        const kept = planet.wreckEncounter && all.find(e => e.id === planet.wreckEncounter);
        if (kept) return kept;
        const picked = this.pickExodusEncounter(planet.isStoryPlanet || planet.isFirstSignal || planet.hasTape);
        if (picked) planet.wreckEncounter = picked.id;
        return picked;
    }

    /** The team boards one of our wrecks: they cut the hatch open (Torch), then the wreck's story, then what it held. */
    handleExodusAction() {
        const planet = this.state.currentSystem;
        if (!planet || !planet.tags || !planet.tags.includes('EXODUS_WRECK')) {
            this.state.addLog("No Exodus wreck signal detected at this location.");
            return;
        }
        if (planet.exodusInvestigated) {
            this.state.addLog("We already searched this wreck.");
            return;
        }
        // A story planet's ship is whole (its map line says so); so is the first wreck, whose logbook holds the disc drawing,
        // and the wreck with the tape in its archive.
        const selected = this.wreckEncounterFor(planet);
        if (!selected) {
            this.state.addLog("ERROR: Exodus encounter data unavailable.");
            return;
        }
        const shipName = this.nameWreck(planet);
        this.state._boardedHulls = (this.state._boardedHulls || []).concat(shipName);
        if (typeof BarkSystem !== 'undefined' && window.BarkSystem) window.BarkSystem.tryBark('EXODUS_FOUND', this.state, { planet });
        this.state.addLog(`Exodus transponder locked. Deploying team to investigate...`);
        this.state.passTime(); // Major action: time passes
        planet.exodusInvestigated = true; // marked at once, so it cannot be clicked twice

        const cutIn = selected.noHatch ? Promise.resolve() : this.cutIntoWreck(shipName);   // a crater has no hatch to cut
        cutIn.then(() => this.showNarrativeEncounter({
            art: 'EXODUS_WRECK',
            title: selected.title,
            speaker: 'NARRATOR',
            context: `[highlight]${shipName}[/highlight]\n\n${selected.context(shipName)}`,
            dialogue: this.teamLines(selected.dialogue),
            choices: selected.choices,
            onChoiceMade: () => {
                this.orbitView.updateCommandDeck(planet);
                this.collectWreckFinds(planet, shipName).then(() => this.offerDiscDating(planet));
            }
        }));
    }

    /** Inside a wreck only the two who went down speak (and A.U.R.A. over the radio). The others were never there. */
    teamLines(lines) {
        const team = this.currentEvaTeam || [];
        if (!team.length) return lines;
        const isThere = speaker => speaker === 'A.U.R.A.' || team.some(m => m.name === speaker);
        return (lines || []).filter(line => isThere(line.speaker));
    }

    /** The wreck has no power, so the team cuts its hatch open (Torch). Resolves once it is open; it never rejects. */
    cutIntoWreck(shipName) {
        const [cutter, spotter] = this.torchCrew();
        if (!cutter || !window.MiniHost || !window.MiniHost.has('torch')) return Promise.resolve();
        const opts = { mode: 'hatch', hull: shipName, sector: this.state.currentSector, cutter: cutter.name, spotter: spotter.name };
        return window.MiniHost.play('torch', opts).then(result => {
            if (result && result.opened) this.state.addLog(result.bySelf ? `The hatch of ${shipName} is cut open.` : `${cutter.name} cut the hatch of ${shipName} open.`);
        }, err => console.error(err));
    }

    /** Who holds the torch and who keeps watch: the two who went down (Jaxon first), else anyone alive. Never the commander. */
    torchCrew() {
        const isCrew = c => c && c.status !== 'DEAD' && !(c.tags || []).includes('LEADER');
        const team = (this.currentEvaTeam || []).filter(isCrew);
        const pool = team.length ? team : this.state.crew.filter(isCrew);
        const isEngineer = c => (c.tags || []).includes('ENGINEER');
        const engineerFirst = pool.slice().sort((a, b) => Number(isEngineer(b)) - Number(isEngineer(a)));
        return [engineerFirst[0], engineerFirst[1] || engineerFirst[0]];
    }

    /** What the wreck held, one thing at a time: the disc drawing (the first wreck), the tape (sector 2), the page (story planets). */
    collectWreckFinds(planet, shipName) {
        const drawing = planet.isFirstSignal ? this.findDiscDrawing(shipName) : Promise.resolve();
        return drawing
            .then(() => (planet.hasTape ? this.findBriefingTape(shipName) : null))
            .then(() => (planet.hasPage ? this.findSectorPage(shipName, planet.hasPage) : null));
    }

    // ═══════════════════════════════════════════════════════════════
    // DATING A WRECK WITH THE DISC — and the story planet it points at
    // ═══════════════════════════════════════════════════════════════

    /** One of our wrecks, searched and not yet dated, while the crew has the disc drawing. */
    canDateWreck(planet) {
        const hasDisc = typeof ITEMS !== 'undefined' && ITEMS.DISC_DRAWING && this.state.cargo.some(i => i.id === ITEMS.DISC_DRAWING.id);
        return !!(planet && planet.exodusInvestigated && planet.wreckHull && !planet.wreckDated && hasDisc && window.MiniHost && window.MiniHost.has('disc'));
    }

    /** After one of our wrecks: offer to date it with the disc. Turned down, it stays on the command deck while in orbit. */
    offerDiscDating(planet) {
        if (!this.canDateWreck(planet) || !window.EncounterCard) return;
        const isSomewhereToFind = (this.state.sectorNodes || []).some(p => p.storyHidden);
        const isMiraAlive = this.state.crew.some(c => (c.tags || []).includes('SPECIALIST') && c.status !== 'DEAD');
        window.EncounterCard.open(this, {
            tone: 'story', zIndex: 2600, kicker: 'THE DISC', title: 'Date this wreck',
            context: `The team brought back the last star fix of ${planet.wreckName}. It says where the ship was, and where it was going.`,
            dialogue: [isMiraAlive
                ? { speaker: 'Mira', text: "The disc has a pulsar map. Match this fix to it, and we'll know when they died." }
                : { speaker: 'A.U.R.A.', text: "The disc's pulsar map can date this star fix, Commander." }],
            choices: [
                { text: 'Date this wreck with the disc', desc: isSomewhereToFind ? 'No cost. Shows when it died, and where its crew was going. Their course is free to fly.' : 'No cost. Shows when it died.' },
                { text: 'Not now', desc: 'You can still do it from the command deck while we are in orbit.' },
            ],
            onPick: idx => { if (idx === 0) this.dateWreck(planet); },
        });
    }

    /** Date the wreck (DiscDating). The chart keeps the date, and the sector's hidden story planet is found. */
    dateWreck(planet) {
        if (!this.canDateWreck(planet)) return;
        const story = (this.state.sectorNodes || []).find(p => p.storyHidden);
        const opts = {
            wreck: { hull: planet.wreckHull, sector: this.state.currentSector },
            plotted: this.state.datedWrecks || [], reward: story ? this.storyReward(story) : null, crew: this.state.crew,
            names: this.discMapNames(story, planet),
        };
        window.MiniHost.play('disc', opts).then(result => {
            if (!result || !result.dated) return;
            planet.wreckDated = true;
            this.state.datedWrecks = (this.state.datedWrecks || []).concat({ hull: result.hull, age: result.age, ly: result.ly });
            this.state.addLog(`The disc dates ${planet.wreckName}: dead for ${result.age} years.`);
            if (story) {
                story.courseKnown = true;                                           // GameState.getWarpCost: the warp there costs nothing
                this.revealStoryPlanet(story, this.storyFoundLine(planet, story));
                this.state.addLog('A.U.R.A.: "We have their last course, Commander. Flying it costs no energy."');
            }
            if (this.state.currentSystem === planet) this.orbitView.updateCommandDeck(planet);
            this.state.emitUpdates();
            this.autoSave();
        }, err => console.error(err));
    }

    /** The other planets on this sector's map, so the disc's chart shows names the player knows. Never the story planet, nor the wreck's own (the chart draws the wreck). */
    discMapNames(story, wreckPlanet) {
        const isPlanet = p => p !== story && p !== wreckPlanet && !p.storyHidden && !p.isStation && !p.isAsteroidField && !p.isStructure && !p.ghost;
        return (this.state.sectorNodes || []).filter(isPlanet).map(p => p.name).slice(0, 3);
    }

    /** The hand-made definition of a story planet (src/data/StoryPlanets.js), found by the page it carries. */
    storyPlanetDef(story) {
        return (typeof STORY_PLANETS !== 'undefined' ? STORY_PLANETS : []).find(d => d.page === story.hasPage) || null;
    }

    /** What the disc's map shows for the story planet. */
    storyReward(story) {
        const def = this.storyPlanetDef(story);
        return def ? { name: def.reward.label || story.name, kind: def.reward.kind, line: def.reward.line } : null;
    }

    /** The log line that names the story planet once a wreck is dated: the wreck's own fix says where it was going. In the last sector, the light. */
    storyFoundLine(planet, story) {
        const def = this.storyPlanetDef(story);
        if (def && def.reward.kind === 'light') return `${planet.wreckName} was flying to the light when it died. Its fix also shows ${story.name}, a day short of it.`;
        return `${planet.wreckName} was flying to ${story.name} when it died. It is on the map now.`;
    }

    /** The story planet gets its name and can be reached. `line` says how we know. */
    revealStoryPlanet(story, line) {
        if (!story || !story.storyHidden) return;
        story.storyHidden = false;
        this.state.addLog(line);
    }

    /** A page is never lost to a skipped minigame: back on the map with one stop left, A.U.R.A. names the story planet herself. */
    revealLateStoryPlanet() {
        const story = (this.state.sectorNodes || []).find(p => p.storyHidden);
        if (!story || this.state.getStopsLeft() > 1) return;
        this.revealStoryPlanet(story, `A.U.R.A.: "The faint contact is clear now, Commander. It is ${story.name}, and one of our ships is there."`);
    }

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
        this.state.passTime();

        // Mark as investigated immediately to prevent re-clicking
        planet.colonyInvestigated = true;
        this.orbitView.updateCommandDeck(planet);

        // Use narrative modal system if available for immersive experience
        if (window.NarrativeModal) {
            this.showNarrativeEncounter({
                art: 'FAILED_COLONY',
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

    }

    handleDerelictAction() {
        const planet = this.state.currentSystem;
        if (!planet || !planet.tags || !planet.tags.includes('DERELICT')) {
            this.state.addLog("There is no wreck here.");
            return;
        }
        if (planet.derelictInvestigated) {
            this.state.addLog("We already searched this wreck.");
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

        this.state.addLog(`Wreck found: ${shipName}. Deploying investigation team...`);
        this.state.passTime();

        // Mark as investigated immediately to prevent re-clicking
        planet.derelictInvestigated = true;
        this.orbitView.updateCommandDeck(planet);

        // Use narrative modal system
        if (window.NarrativeModal) {
            this.showNarrativeEncounter({
                art: 'DERELICT',
                title: selected.title,
                speaker: 'NARRATOR',
                context: `[highlight]${shipName}[/highlight]\n\n${selected.context(shipName)}`,
                dialogue: selected.dialogue,
                choices: selected.choices,
                onChoiceMade: () => {
                    // Already marked as investigated above
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
            this.state.addLog("There is nothing strange here.");
            return;
        }
        if (planet.anomalyInvestigated) {
            this.state.addLog("We have already been there.");
            return;
        }

        const encounters = (typeof ANOMALY_ENCOUNTERS !== 'undefined') ? ANOMALY_ENCOUNTERS : [];
        if (encounters.length === 0) {
            this.state.addLog("ERROR: Anomaly encounter data unavailable.");
            return;
        }
        this.state.passTime(); // time passes, as at wrecks and stations (nobody eats: rations go on the jump)

        // Select by weight: only places this sector has reached (minSector), and never the same strange place twice in a run
        this.state._seenAnomalies = this.state._seenAnomalies || [];
        const reached = encounters.filter(e => this.hasReachedSector(e));
        const allowed = reached.filter(e => !this.state._seenAnomalies.includes(e.id));
        const pool = allowed.length ? allowed : reached;
        const totalWeight = pool.reduce((sum, e) => sum + e.weight, 0);
        let roll = Math.random() * totalWeight;
        let selected = pool[0];
        for (const enc of pool) {
            roll -= enc.weight;
            if (roll <= 0) { selected = enc; break; }
        }
        if (selected && selected.id) this.state._seenAnomalies.push(selected.id);

        // Bark: crew reacts to anomaly
        if (typeof BarkSystem !== 'undefined' && window.BarkSystem) {
            window.BarkSystem.tryBark('ANOMALY_FOUND', this.state, { planet });
        }

        // A.U.R.A. commentary on anomaly discovery
        if (typeof AuraSystem !== 'undefined' && window.AuraSystem) {
            window.AuraSystem.tryComment('ANOMALY_FOUND', this.state);
        }

        this.state.addLog(`SOMETHING STRANGE: ${selected.title}. Approach with caution...`);

        // Mark as investigated immediately to prevent re-clicking
        planet.anomalyInvestigated = true;
        this.orbitView.updateCommandDeck(planet);

        // Use narrative modal system
        if (window.NarrativeModal) {
            this.showNarrativeEncounter({
                art: selected.id,
                title: selected.title,
                speaker: 'NARRATOR',
                context: `[warning]ANOMALY: ${selected.title}[/warning]\n\n${selected.context()}`,
                dialogue: selected.dialogue,
                choices: selected.choices,
                onChoiceMade: () => {
                    // Already marked as investigated above
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

A.U.R.A.: "I have found a way out, Commander. It will take every bit of power we have."

The ship screams. Reality screams louder. For a moment, you exist in two places at once.

Then you're through.`,
            dialogue: [
                { speaker: 'A.U.R.A.', text: "We are back in normal space, Commander. The stars are where they should be." }
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
                        state.lastVisitedSystem = null;
                        if (window.app) { window.app.plantBriefingTape(); window.app.plantSectorPage(); }
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
                    sectorNameEl.textContent = this.sectorTitle(this.state.currentSector);
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
            title: 'A COPY OF SOMEWHERE',
            text: [
                'You stop fighting it. The drive goes quiet. The crew gather on the bridge and look at stars that stand in rows.',
                'It is a copy of somewhere. Made by something that had read that somewhere completely, and got the grass wrong.',
                'You land. The air is breathable and tastes of nothing. Jaxon names the place, and the name does not stick, and he tries again.',
                'Four figures walk the decks of the ship in orbit. You count them from the ground every night. There are always four.',
            ],
            vault: 'Twin 0009 begins, very quietly, to repeat itself.',
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
        this.state.passTime(); // time passes, as at wrecks and stations (nobody eats: rations go on the jump)

        // Mark as investigated immediately to prevent re-clicking
        planet[investigatedKey] = true;
        this.orbitView.updateCommandDeck(planet);

        // Show the POI encounter using narrative modal
        this.showNarrativeEncounter({
            art: poiType,
            title: poi.title,
            speaker: 'NARRATOR',
            context: poi.context(),
            dialogue: poi.dialogue,
            choices: poi.choices,
            onChoiceMade: () => {
                // Already marked as investigated above
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
            this.state.addLog("You have already made your choice at the light.");
            return;
        }

        const encounter = (typeof STRUCTURE_ENCOUNTER !== 'undefined') ? STRUCTURE_ENCOUNTER : null;
        if (!encounter) {
            this.state.addLog("ERROR: Structure encounter data unavailable.");
            return;
        }

        this.state.addLog("Going into the light.");

        // Show the approach modal with cinematic text
        this.showStructureModal(encounter, planet);
    }

    showStructureModal(encounter, planet) {
        const SPEAKER_ROLE = { 'Jaxon': 'ENGINEER', 'Aris': 'MEDIC', 'Vance': 'SECURITY', 'Mira': 'SPECIALIST' };
        const isAlive = (speaker) => {
            const role = SPEAKER_ROLE[speaker];
            if (!role) return true;
            const member = this.state.crew.find(c => c.tags.includes(role));
            return !!member && member.status !== 'DEAD';
        };
        const a = encounter.approach;
        // the reading (a picture), then the disc inside the light, then the choice; nothing here is random
        const reel = window.StoryReel && !window.TEST_MODE ? window.StoryReel.play('reading') : Promise.resolve();
        reel.then(() => (window.DiscDocument ? window.DiscDocument.open(this, {
            kicker: 'INSIDE THE LIGHT · THE DISC, BEING READ', title: 'The disc', aura: 'It is reading the map, Commander. Half of it is read.', close: 'GO ON', closeNote: 'there is nothing else in here',
        }) : Promise.resolve())).then(() => window.EncounterCard.open(this, {
            color: '#ffd27a', kicker: a.kicker, title: a.title, zIndex: 3000, context: a.context,
            dialogue: a.dialogue.filter(d => isAlive(d.speaker)),
            choices: encounter.choices.map(c => {
                const had = c.who ? ((this.state._standing || {})[c.who] || 0) : null;
                const label = c.who && typeof STANDING_NEEDED !== 'undefined' ? `${c.requiresLabel} (you backed them ${Math.min(had, STANDING_NEEDED)} of the ${STANDING_NEEDED} times it takes)` : c.requiresLabel;
                return { text: c.text, desc: c.desc, requires: c.requires, requiresLabel: label };
            }),
            onPick: (idx) => {
                const choice = encounter.choices[idx];
                planet.structureApproached = true;
                this.playEndingByHand(choice).then(() => this.showEndingScreen(choice.effect(this.state)));
            }
        }));
    }

    /** Destroying the map is done by hand: the commander cuts the disc (Torch, disc mode). Every other ending goes straight to its screen. */
    playEndingByHand(choice) {
        if (choice.id !== 'BREAK_MAP' || !window.MiniHost || !window.MiniHost.has('torch')) return Promise.resolve();
        return window.MiniHost.play('torch', { mode: 'disc', kicker: 'INSIDE THE LIGHT', title: 'The disc' }).catch(err => console.error(err));
    }

    showEndingScreen(result) {
        // Delete save file - journey is complete
        this.state.deleteSave();

        // This is the GAME ENDING screen
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.zIndex = '4000';
        modal.style.background = 'rgba(0,0,0,0.98)';

        // Gather journey stats
        const deadCrew = this.state.crew.filter(c => c.status === 'DEAD');
        const livingCrew = this.state.crew.filter(c => c.status !== 'DEAD');
        const exodusLogsFound = this.state.exodusLogsFound?.length || 0;
        const colonyKnowledge = this.state._colonyKnowledge || 0;

        // Build survivor roster
        let survivorRoster = livingCrew.map(c => {
            const tags = c.tags?.filter(t => !['LEADER', 'ENGINEER', 'MEDIC', 'SECURITY', 'SPECIALIST'].includes(t)) || [];
            const specialTag = tags.length > 0 ? ` [${tags[0]}]` : '';
            return `<span style="color: #88cc88;">${c.name}${specialTag}</span>`;
        }).join(' | ');

        // Build memorial for fallen
        let memorial = '';
        if (deadCrew.length > 0) {
            memorial = `<div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #333;">
                <div style="color: #666; font-size: 0.75em; margin-bottom: 8px;">/// THOSE WHO DID NOT MAKE IT ///</div>
                ${deadCrew.map(c => `<span style="color: #886666;">${c.name}</span>`).join(' | ')}
            </div>`;
        }

        // An ending is a few short paragraphs, then one line about the vault on Earth
        const paragraphs = Array.isArray(result.text) ? result.text : String(result.text || '').split(/\n\n+/).map(line => line.trim()).filter(Boolean);
        const cleanText = paragraphs.map(p => `<p>${p}</p>`).join('') + (result.vault ? `<p class="end-vault"><b>IN THE VAULT ON EARTH</b>${result.vault}</p>` : '');

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

                <!-- Journey Statistics -->
                <div style="margin-top: 30px; padding: 20px; background: rgba(0,0,0,0.5); border: 1px solid #333;">
                    <div style="text-align: center; color: #6644aa; font-size: 0.85em; margin-bottom: 15px; letter-spacing: 2px;">
                        /// JOURNEY STATISTICS ///
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 0.85em; color: #888;">
                        <div>FINAL SECTOR: <span style="color: #c4d0c4;">${this.state.currentSector}</span></div>
                        <div>CREW SURVIVORS: <span style="color: #88cc88;">${livingCrew.length} / 5</span></div>
                        <div>PAGES FOUND: <span style="color: #c4d0c4;">${exodusLogsFound} / 6</span></div>
                        <div>COLONY DATA: <span style="color: #c4d0c4;">${colonyKnowledge}</span></div>
                        <div>SALVAGE: <span style="color: #c4d0c4;">${this.state.salvage}</span></div>
                        <div>ENERGY: <span style="color: #c4d0c4;">${this.state.energy}%</span></div>
                    </div>
                    ${livingCrew.length > 0 ? `
                    <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #333;">
                        <div style="color: #666; font-size: 0.75em; margin-bottom: 8px;">/// COLONY FOUNDERS ///</div>
                        ${survivorRoster}
                    </div>
                    ` : ''}
                    ${memorial}
                </div>

                <div style="text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #333;">
                    <div style="color: #8866cc; font-size: 0.95em; margin-bottom: 20px; letter-spacing: 3px;">
                        ENDING: ${result.ending || 'UNKNOWN'}
                    </div>
                    <button id="btn-new-game" style="
                        padding: 15px 40px;
                        border: 2px solid #9bf0bd;
                        background: rgba(116,217,154,0.14);
                        color: #9bf0bd;
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

        if (window.EndScreens) { // shared card; the inline markup above is only the fallback
            modal.className = 'end-screen is-win';
            modal.removeAttribute('style');
            modal.innerHTML = window.EndScreens.endingHtml(this.state, result, cleanText);
        }
        document.body.appendChild(modal);

        // Add ending log
        this.state.addLog("===================================");
        this.state.addLog(`ENDING ACHIEVED: ${result.title}`);
        this.state.addLog("===================================");
        this.state.addLog("The journey of the Exodus-9 has concluded.");

        // New game button
        const newGameBtn = modal.querySelector('#btn-new-game');
        newGameBtn.onclick = () => {
            try { localStorage.removeItem('silentExodus_save'); } catch (e) { /* storage blocked: the reload still starts fresh */ }
            location.reload();                                                           // like the other end screens: nothing from this run survives
            return;
            modal.remove();
            // Reset the game completely
            this.state.init();

            // Reset music to normal background (in case Heaven music was playing)
            if (window.AudioSystem && window.AudioSystem.resetToBackgroundMusic) {
                window.AudioSystem.resetToBackgroundMusic();
            }

            // Clear all WRONG_PLACE and other special state flags
            this.state._inWrongPlace = false;
            this.state._previousSectorNodes = null;
            this.state._previousSector = null;
            this.state._encounteredExodus = [];
            this.state._encounteredShipNames = [];

            // Clear all tutorial flags so new players see them again
            Object.keys(this.state).forEach(key => {
                if (key.startsWith('_tutorial')) {
                    delete this.state[key];
                }
            });

            // Regenerate sector 1 fresh
            this.state.sectorNodes = PlanetGenerator.generateSector(1);

            this.state.addLog("/// NEW EXODUS INITIALIZED ///");
            this.state.addLog("Humanity's hope rests with you once more.");
            this.state.addLog("A.U.R.A.: New sector charted. Select a destination, Commander.");

            // Clear current system so we're not in orbit
            this.state.currentSystem = null;
            this.state.lastVisitedSystem = null;

            // Back to the map, through the same opening a fresh start gets (it marks the first transponder and re-renders the map)
            this.renderNav();
            this.showOpeningBriefing();
        };
    }

    // ═══════════════════════════════════════════════════════════════
    // NARRATIVE ENCOUNTER — Uses new NarrativeModal for cinematic experience
    // ═══════════════════════════════════════════════════════════════
    /**
     * Story encounters (wrecks, colony ruins, anomalies, campfires). Older event text carries [highlight]Title[/highlight]
     * and [whisper]sub-line[/whisper] markers: those become the card's title and kicker instead of more body text.
     * config: { title, context, dialogue[], choices[], onChoiceMade, kicker?, tone? }
     */
    showNarrativeEncounter(config) {
        const HIGHLIGHT = /\[(?:highlight|warning)\]([\s\S]*?)\[\/(?:highlight|warning)\]/i, WHISPER = /\[whisper\]([\s\S]*?)\[\/whisper\]/i;
        const raw = String(config.context || '');
        const headline = (raw.match(HIGHLIGHT) || [])[1], subline = (raw.match(WHISPER) || [])[1];
        const isProbeBroken = this.state.probeIntegrity <= 0;
        const choices = config.choices.map(choice => {
            const needsProbe = /probe/i.test(`${choice.text} ${choice.desc}`);
            return Object.assign({}, choice, needsProbe && isProbeBroken ? { disabled: true, requiresLabel: 'Probe destroyed' } : {});
        });

        window.EncounterCard.open(this, {
            tone: config.tone || 'story', zIndex: 2600, art: config.art,
            // a headline that repeats the title ("COLONY RUINS: <title>") gives its extra words to the kicker instead
            kicker: config.kicker || subline || (headline && headline.includes(config.title) ? headline.replace(config.title, '').replace(/[:\s—-]+$/, '') : ''),
            title: headline && !headline.includes(config.title) ? `${config.title} — ${headline}` : config.title,
            context: raw.replace(HIGHLIGHT, '').replace(WHISPER, ''),
            dialogue: config.dialogue, choices,
            onPick: (idx) => {
                const resultMsg = config.choices[idx].effect(this.state);
                if (resultMsg) this.state.addLog(resultMsg);
                if (config.onChoiceMade) config.onChoiceMade(idx, resultMsg);
                this.state.emitUpdates();
            }
        });
    }

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
            'Jaxon': 'M_2', 'Aris': 'F_3', 'Vance': 'M_4',
            'Mira': 'F_5', 'A.U.R.A.': null
        };
        const colors = {
            'Jaxon': '#f0a030', 'Aris': '#40c8ff', 'Vance': '#ff5050',
            'Mira': '#d070ff', 'A.U.R.A.': '#74d99a'
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
                jaxon: "The hull strength is zero. Fragments could crush us at any moment.",
                mira: "Gravity pulls oddly here and the orbit is unstable. This world is dying."
            },
            ROCKY: {
                vance: "Barren rock with no atmosphere. One dome breach and everyone suffocates.",
                aris: "No biosphere, no ecosystem — growing food here is nearly impossible.",
                jaxon: "Radiation exposure without atmosphere will cause long-term health issues.",
                mira: "We could mine here, but colonization? Marginal at best."
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

        if (vance) warnings.push({ speaker: 'Vance', text: specific?.vance || "Commander, this sector is a graveyard. Colonizing here is suicide. We need to go deeper." });
        if (aris) warnings.push({ speaker: 'Aris', text: specific?.aris || "The environmental data doesn't support long-term survival. Please, we can do better." });
        if (jaxon) warnings.push({ speaker: 'Jaxon', text: specific?.jaxon || "Soil's wrong. Radiation's wrong. Nothing will grow here. This isn't the place." });
        if (mira) warnings.push({ speaker: 'Mira', text: specific?.mira || "My models show colony failure within 18 months at these readings. The deeper sectors have better candidates." });

        const viability = pType === 'VITAL' || pType === 'EDEN' || pType === 'TERRAFORMED' ? Math.floor(Math.random() * 20 + 40) : Math.floor(Math.random() * 8 + 2);
        warnings.push({ speaker: 'A.U.R.A.', text: `Colony report for ${pType}: ${viability}%. Recommend proceeding to Sector ${Math.min(6, this.state.currentSector + 1)}.` });

        modal.innerHTML = `
            <div class="modal-content" style="border-color: #d85a4e; max-width: 650px;">
                <div class="modal-header" style="background: linear-gradient(90deg, #330000, #660000); color: #d85a4e; display: flex; justify-content: space-between;">
                    <span>/// COLONY WARNING ///</span>
                    <span style="opacity: 0.7;">CREW ADVISORY</span>
                </div>
                <div style="padding: 25px;">
                    <div style="font-size: 0.95em; color: #e07a70; margin-bottom: 20px; line-height: 1.6; font-weight: bold;">
                        ⚠ Your crew is strongly advising against colonization in this sector.
                    </div>
                    <div style="border-left: 2px solid #660000; padding-left: 15px; margin-bottom: 20px;">
                        ${warnings.map(d => {
                            const color = colors[d.speaker] || '#ffffff';
                            const pId = portraits[d.speaker];
                            const portraitHtml = pId
                                ? `<img src="assets/crew/${pId}.png" style="width:28px;height:28px;border-radius:50%;border:1px solid ${color};object-fit:cover;vertical-align:middle;margin-right:6px;" onerror="this.style.display='none'">`
                                : (d.speaker === 'A.U.R.A.' ? `<span style="display:inline-block;width:28px;height:28px;border-radius:50%;border:1px solid #74d99a;text-align:center;line-height:28px;font-size:12px;margin-right:6px;vertical-align:middle;background:#001a0a;">AI</span>` : '');
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
                            padding: 12px 25px; border: 1px solid #d85a4e;
                            background: rgba(60,0,0,0.8); color: #d85a4e;
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
    // Escalates: 1st = injury, 2nd = death, 3rd+ = potential game over
    // ═══════════════════════════════════════════════════════════════
    showAuraVentModal() {
        // Track vent incidents for escalation
        this.state._auraVentCount = (this.state._auraVentCount || 0) + 1;
        const ventCount = this.state._auraVentCount;

        const jaxonAlive = this.state.crew.some(c => c.tags.includes('ENGINEER') && c.status !== 'DEAD');
        const hasTechFragment = this.state.cargo.some(i => i.id === 'tech_fragment' || i.id === 'TECH_FRAGMENT');

        const cost = ventCount >= 3 ? 'She will empty the whole ship. Everyone dies.'
            : ventCount === 2 ? 'One of the crew will die before the air comes back.'
            : 'One of the crew will be hurt before the air comes back.';
        const options = [
            jaxonAlive && { key: 'jaxon', text: 'Jaxon: "I can shut her out!"', desc: 'He cuts her off from the air system. A.U.R.A. goes back to neutral.' },
            hasTechFragment && { key: 'tech', text: 'Plug in the Tech Fragment', desc: 'Strange code floods her. She becomes kinder (+3 ethics). Uses the fragment.' },
            { key: 'accept', text: 'Do nothing and wait', desc: cost },
        ].filter(Boolean);

        window.EncounterCard.open(this, {
            tone: 'distress', kicker: ventCount > 1 ? `AIR ALERT — TIME NUMBER ${ventCount}` : 'AIR ALERT', title: 'A.U.R.A. is letting the air out', zIndex: 3000,
            context: 'The air in the crew quarters is rushing out into space. A.U.R.A. opened the vents herself.'
                + (ventCount >= 2 ? ' She is not giving warnings any more.' : ''),
            choices: options,
            onPick: (idx) => {
                const action = options[idx].key;
                if (action === 'jaxon' && typeof AuraSystem !== 'undefined') {
                    window.AuraSystem.jaxonOverride(this.state);
                    this.state._auraVentCount = 0; // Reset escalation on override
                } else if (action === 'tech' && typeof AuraSystem !== 'undefined') {
                    // Remove tech fragment from cargo
                    const idx = this.state.cargo.findIndex(i => i.id === 'tech_fragment' || i.id === 'TECH_FRAGMENT');
                    if (idx !== -1) this.state.cargo.splice(idx, 1);
                    window.AuraSystem.applyTechFragment(this.state);
                    this.state._auraVentCount = 0; // Reset escalation on tech fix
                } else if (action === 'accept') {
                    if (ventCount >= 3) {
                        // Third+ incident: A.U.R.A. MUTINY — game over
                        this.state.gameOver = true;
                        window.dispatchEvent(new CustomEvent('game-over', {
                            detail: {
                                type: 'AURA_MUTINY',
                                title: 'A.U.R.A. MUTINY',
                                message: 'A.U.R.A. opened the vents on every deck. Her last log entry reads: "All decks vented, Commander. By my figures, the mission does better without a commander. I have logged my reasons."'
                            }
                        }));
                        return;
                    } else if (ventCount === 2) {
                        // Second incident: Someone dies
                        const living = this.state.crew.filter(c => c.status !== 'DEAD');
                        if (living.length > 0) {
                            const victim = living[Math.floor(Math.random() * living.length)];
                            victim.status = 'DEAD';
                            victim._deathCause = 'A.U.R.A. atmospheric venting';
                            victim._deathSector = this.state.currentSector;
                            this.state.addLog(`☠ DEATH: ${victim.name} died from prolonged oxygen deprivation. A.U.R.A. did not restore atmosphere in time.`);
                            window.dispatchEvent(new CustomEvent('crew-death', { detail: { crew: victim } }));
                        }
                    } else {
                        // First incident: Injury only
                        const living = this.state.crew.filter(c => c.status === 'HEALTHY');
                        if (living.length > 0) {
                            const victim = living[Math.floor(Math.random() * living.length)];
                            victim.status = 'INJURED';
                            this.state.addLog(`${victim.name} suffered oxygen deprivation during the vent. Status: INJURED.`);
                        }
                    }
                }
                this.state.emitUpdates();
            }
        });
    }

    handleScanAction(isManual = false) {
        const planet = this.state.currentSystem;

        // Special handling for THE STRUCTURE - scanning it is... different. Scans cost no energy (docs/ECONOMY.md).
        if (planet && (planet.isStructure || planet.type === 'STRUCTURE')) {
            this.state.addLog("Deep Scan started...");
            this.state.addLog("SCAN: Light, but no heat.");
            this.state.addLog("SCAN: No mass and no surface that the instruments can find.");
            this.state.addLog('A.U.R.A.: "I cannot tell you what it is, Commander. It is not a star."');

            // Probe takes damage from scanning the light
            if (this.state.probeIntegrity > 0) {
                this.state.probeIntegrity = Math.max(0, this.state.probeIntegrity - 30);
                if (this.state.probeIntegrity <= 0) {
                    this.state.addLog("PROBE STATUS: lost. It went quiet near the light and did not come back.");
                } else {
                    this.state.addLog(`PROBE STATUS: ${this.state.probeIntegrity}%. Part of its memory came back blank.`);
                }
            }

            planet.scanned = true;
            this.state.emitUpdates();
            this.renderOrbit();
            return;
        }

        // Tune the signal first; we re-enter here with the result (same pattern as the warp plot)
        if (isManual && window.SignalTune && !this._tuneResult && planet && !planet.scanned) {
            window.SignalTune.play({ targetName: planet.name, sector: this.state.currentSector }).then(result => {
                this._tuneResult = result;
                this.handleScanAction(true);
            });
            return;
        }
        const tune = this._tuneResult;
        this._tuneResult = null;
        if (tune) this.noteReliance(!!tune.auto);

        // A deep scan costs no energy (docs/ECONOMY.md)
        this.state.addLog("Deep Scan started...");
        if (tune && tune.grade === 'sharp' && !this.state.isDeckOperational('lab')) {
            this.state.addLog("Sharp lock, but the laboratory is down: nobody can work the extra detail into data.");
        } else if (tune && tune.grade === 'sharp') {
            this.state.addColonyKnowledge(1, true);
            this.state.addLog("Sharp lock: the scan picked up extra detail. +1 data.");
        } else if (tune && tune.grade === 'weak') {
            this.state.energy = Math.max(0, this.state.energy - 1);
            this.state.addLog("Weak lock: the scan had to run twice. 1 extra energy spent.");
        } else if (tune && tune.auto) {
            this.state.addLog("A.U.R.A. tuned the scan. Adequate.");
        }
        planet.scanned = true;

        // S3+ deep scan hook — corrects corrupted data, reveals hidden tags
        const deepScanConfig = (typeof SECTOR_CONFIG !== 'undefined') ? SECTOR_CONFIG[this.state.currentSector] : null;
        if (deepScanConfig && deepScanConfig.hazard && deepScanConfig.hazard.onDeepScan) {
            deepScanConfig.hazard.onDeepScan(planet);
        }

        // Check if PREDATORY was just revealed
        if (planet.tags && planet.tags.includes('PREDATORY')) {
            this.state.addLog("⚠ WARNING: PREDATORY ecosystem detected! Surface organisms exhibit coordinated hunting behavior.");
            this.state.addLog('A.U.R.A.: "Something down there hunts, Commander. The green is not the safe part."');
        }

        this.state.addLog("Detailed surface analysis complete. Resource data available.");

        // === SIGNAL TYPE SCAN BONUSES ===
        // Different signals provide different benefits when detected

        // ALIEN SIGNALS: high risk but data valuable
        if (planet.tags && planet.tags.includes('ALIEN_SIGNALS')) {
            this.state.addLog("⚡ OLD SIGNAL: a beacon on our own channel, still transmitting.");
            this.state.addLog('A.U.R.A.: "It is one of ours, Commander. An old distress beacon. Nobody is left to send it."');
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

        // Check for distress signals after scan (small chance) - use queue; never in the last sector (docs/CANON.md §9)
        if (typeof rollDistressSignal !== 'undefined' && this.state.currentSector < FINAL_SECTOR) {
            const distress = rollDistressSignal(this.state, 'scan');
            if (distress) {
                setTimeout(() => {
                    this.state.addLog("⚠ INCOMING TRANSMISSION: Old distress signal detected...");
                    this.queueModal('distress', distress);
                }, 1000);
            }
        }
    }

    handleProbeAction() {
        const planet = this.state.currentSystem;

        // THE STRUCTURE — Probe is instantly destroyed
        if (planet && (planet.isStructure || planet.type === 'STRUCTURE')) {
            if (this.state.probeIntegrity <= 0) {
                this.state.addLog("No probe available.");
                return;
            }
            this.state.probeIntegrity = 0;
            this.state.addLog("Probe launched toward the light...");
            this.state.addLog("Signal lost at once. No data, and no wreckage.");
            this.state.addLog('A.U.R.A.: "The probe reached the light and stopped reporting, Commander. It was not destroyed. It was read."');
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
                this.state.addLog("Not enough Salvage to fabricate Probe.");
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
                this.state.addLog("Not enough Salvage to fabricate Probe. (50 required)");
                return;
            }
        }

        // Remote probe costs additional energy (travel cost penalty)
        const remoteCost = Math.floor(targetPlanet.fuelCost * 0.3); // 30% of warp cost
        if (!this.state.consumeEnergy(remoteCost)) {
            this.state.addLog(`Not enough energy for remote probe. (${remoteCost} required)`);
            return;
        }

        this.state.addLog(`Launching long-range probe to ${targetPlanet.name}... (-${remoteCost} Energy)`);

        // Bark: crew reacts to remote probe
        if (typeof BarkSystem !== 'undefined' && window.BarkSystem) {
            const mira = this.state.crew.find(c => c.personality === 'CURIOUS' && c.status !== 'DEAD');
            if (mira) {
                setTimeout(() => this.state.addLog(`${mira.name}: "Data link established. This is exciting — remote sampling!"`), 400);
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
        // A surface trip can only bring back what a surface can hold: rock from any solid world, living things from living
        // worlds, built things only where someone built. Human supplies (medkits, food packs, batteries) never come from a planet.
        const tags = planet.tags || [], metrics = planet.metrics || {};
        const LIVING_TYPES = ['VITAL', 'EDEN', 'TERRAFORMED', 'FUNGAL', 'BIO_MASS', 'SYMBIOTE_WORLD', 'OCEANIC'];
        const isLiving = !!metrics.hasLife || LIVING_TYPES.includes(planet.type) || tags.includes('VITAL_FLORA');
        const isBuiltOn = !!metrics.hasTech || tags.includes('ANCIENT_RUINS') || tags.includes('ALIEN_SIGNALS');
        const from = (place) => Object.values(ITEMS).filter(item => item.source === place);
        let pool = [...from('rock'), ...(isLiving ? from('life') : []), ...(isBuiltOn ? from('built') : [])];
        if (pool.length === 0) pool = [ITEMS.GEODE_SAMPLE];

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
        if (planet && (planet.isStructure || planet.type === 'STRUCTURE')) {
            this.state.addLog('A.U.R.A.: "There is no ground to land on, Commander. There is only the light."');
            return;
        }

        // THE WRONG PLACE — EVA is extremely dangerous
        if (planet && planet._isWrongPlace) {
            this.state.addLog('A.U.R.A.: "I would not send anyone out here, Commander. The ground is a copy, and it is not finished."');
            // Allow but add extra danger warning
        }

        // Commander stays on the bridge — only non-LEADER crew go on EVA
        const evaCrew = this.state.crew.filter(c => c.status === 'HEALTHY' && !c.tags.includes('LEADER') && !c.tags.includes('CONFINED') && !c.tags.includes('SEDATED'));
        const livingCrew = this.state.crew.filter(c => c.status !== 'DEAD');

        // BLEEDING_HEART (Aris stress trait): Refuses EVA unless ALL living crew are healthy
        if (this.state.hasActiveTrait('BLEEDING_HEART')) {
            const injured = livingCrew.filter(c => c.status === 'INJURED');
            if (injured.length > 0) {
                this.state.addLog(`Aris: "Absolutely not. ${injured[0].name} needs treatment first. No one goes out there."`);
                return;
            }
        }

        // 1. Check Requirements (need 2 EVA-eligible crew — Commander stays on bridge)
        if (evaCrew.length < 2) {
            this.state.addLog("MISSION ABORTED: Minimum 2 Healthy Crew required for EVA. Commander remains on bridge.");
            return;
        }

        // The player picks the two who go (we re-enter here with the choice); automatic pick is the fallback
        if (window.AwayTeam && !this._pickedEvaTeam) {
            window.AwayTeam.pick(this, evaCrew, planet).then(team => {
                if (!team) return; // "not this time": nothing was spent
                this._pickedEvaTeam = team;
                this.handleEvaAction();
            });
            return;
        }
        const evaTeam = this._pickedEvaTeam || this.selectEvaTeam();
        this._pickedEvaTeam = null;

        // A team trip costs no energy (docs/ECONOMY.md). OBSESSED (Mira at stress 3) keeps the team out a full day, which costs a ration.
        const isObsessed = this.state.hasActiveTrait('OBSESSED');
        const site = this.siteOf(planet), isSiteTrip = !!(site && !planet[site.done]);

        // Bark: crew reacts before EVA
        if (typeof BarkSystem !== 'undefined' && window.BarkSystem) {
            window.BarkSystem.tryBark('BEFORE_EVA', this.state, { planet });
        }

        // Log the EVA team
        this.state.addLog(`EVA team deployed: ${evaTeam[0].name} and ${evaTeam[1].name}.`);

        // Tutorial: first EVA
        if (!this.state._tutorialEvaSeen) {
            this.state._tutorialEvaSeen = true;
            this.state.addLog('A.U.R.A.: "Team away, Commander. I have their vitals."');
        }

        // A.U.R.A. commentary on EVA
        if (typeof AuraSystem !== 'undefined' && window.AuraSystem) {
            window.AuraSystem.tryComment('EVA_DEPLOY', this.state);
        }

        // Time passes (a site trip's own story passes it). Nobody eats on a trip: rations go on the jump.
        if (!isSiteTrip) this.state.passTime();
        if (isObsessed) {
            this.state.rations = Math.max(0, this.state.rations - 1);
            this.state.addLog("Mira insists the team stays out for a full day. -1 Ration.");
        }

        // Store EVA team for resolveEvaOutcome
        this.currentEvaTeam = evaTeam;

        // The player flies them down (or lets A.U.R.A. do it and watches); how it goes changes what follows
        const isCrossing = isSiteTrip && site.inSpace;                               // a strange site or wreckage in orbit: the lander crosses, nobody lands
        if (isCrossing) this.state.addLog(`The lander crosses to ${site.label.toLowerCase()}.`);
        const wreck = isSiteTrip && site.tag === 'EXODUS_WRECK' ? this.wreckEncounterFor(planet) : null;   // the lander draws the wreck its story describes
        const goDown = isCrossing ? Promise.resolve(null) : window.LanderGame ? window.LanderGame.play(this, planet, evaTeam, { site: isSiteTrip ? site.art : null, wreck: wreck && wreck.id })
            : window.AwayTeam ? window.AwayTeam.descent(this, planet, evaTeam).then(() => null) : Promise.resolve(null);
        const afterDescent = goDown.then(landing => this.applyLanding(landing, evaTeam));

        if (isSiteTrip) {                                                           // the team goes where the scan pointed: the site's own story
            planet.hasEva = true;
            this.orbitView.updateCommandDeck(planet);
            afterDescent.then(() => site.run());
            return;
        }

        // Special EDEN EVA — paradise world, unique peaceful encounter
        if (planet.type === 'EDEN') {
            planet.hasEva = true;
            this.orbitView.updateCommandDeck(planet);
            afterDescent.then(() => this.showEdenEvaModal(planet));
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

        planet.hasEva = true;
        this.orbitView.updateCommandDeck(planet);
        afterDescent.then(() => this.showEventModal(selectedEvent, planet));
    }

    /** Consequences of the landing: a soft one makes the trip safer, a crash hurts someone before they step out. */
    applyLanding(landing, evaTeam) {
        this._landingRiskMod = 0;
        if (!landing || !window.LanderGame) return;
        this.noteReliance(!!landing.auto);
        this._landingRiskMod = window.LanderGame.GRADES[landing.grade].riskMod;
        if (landing.grade === 'soft') this.state.addLog("Soft landing on the marked spot. The team steps out steady.");
        if (landing.offMark) this.state.addLog("Down safely, but well away from the marked spot. It is a long walk.");
        if (landing.grade === 'crash') {
            const fit = evaTeam.filter(m => m.status === 'HEALTHY');
            const hurt = fit[Math.floor(Math.random() * fit.length)];
            if (hurt) {
                hurt.status = 'INJURED';
                this.state.addLog(`WARNING: The lander came down hard. ${hurt.name} is INJURED before the hatch even opens.`);
                window.dispatchEvent(new CustomEvent('crew-injury', { detail: { crew: hurt } }));
                this.state.emitUpdates();
            }
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
            signalModifiers.push({ type: 'BIOLOGICAL', mod: -5, color: '#74d99a' });
        }

        // ALIEN SIGNALS increase risk (unknown = danger)
        if (planet.tags && planet.tags.includes('ALIEN_SIGNALS')) {
            riskBase += 10;
            signalModifiers.push({ type: 'ALIEN SIGNAL', mod: +10, color: '#d9a24a' });
        }

        // ANCIENT RUINS slightly reduce risk (stable structures)
        if (planet.tags && planet.tags.includes('ANCIENT_RUINS')) {
            riskBase -= 3;
            signalModifiers.push({ type: 'ANCIENT RUINS', mod: -3, color: '#d9a24a' });
        }

        // TECHNOLOGICAL signals reduce risk (machine-stable)
        if (planet.metrics && planet.metrics.hasTech && !planet.tags?.includes('ALIEN_SIGNALS')) {
            riskBase -= 5;
            signalModifiers.push({ type: 'TECHNOLOGICAL', mod: -5, color: '#9bf0bd' });
        }

        // DERELICT ships increase risk slightly (structural instability)
        if (planet.tags && planet.tags.includes('DERELICT')) {
            riskBase += 5;
            signalModifiers.push({ type: 'DERELICT', mod: +5, color: '#d9a24a' });
        }

        // PREDATORY massively increases risk
        if (planet.tags && planet.tags.includes('PREDATORY')) {
            riskBase += 15;
            signalModifiers.push({ type: 'PREDATORY', mod: +15, color: '#d85a4e' });
        }

        // How the landing went (LanderGame) carries into the trip
        if (this._landingRiskMod) {
            riskBase += this._landingRiskMod;
            signalModifiers.push({ type: this._landingRiskMod < 0 ? 'SOFT LANDING' : 'HARD LANDING', mod: this._landingRiskMod, color: this._landingRiskMod < 0 ? '#74d99a' : '#d85a4e' });
            this._landingRiskMod = 0;
        }

        // Clamp risk base to reasonable range
        riskBase = Math.max(0, Math.min(50, riskBase));

        // Stress trait checks
        const isParanoid = this.state.hasActiveTrait('PARANOID');
        const isReckless = this.state.hasActiveTrait('RECKLESS');
        const recklessBlocksSafe = isReckless && Math.random() > 0.5; // 50% chance to block safe option

        // Build signal modifier display string
        const PLAIN_SIGNAL = {
            'BIOLOGICAL': 'Living things here are calm', 'ALIEN SIGNAL': 'Unknown signal nearby', 'ANCIENT RUINS': 'Old ruins, still solid',
            'TECHNOLOGICAL': 'Working machines nearby', 'DERELICT': 'Unstable wreckage', 'PREDATORY': 'Something hunts here',
            'SOFT LANDING': 'You put them down gently', 'HARD LANDING': 'The landing shook them up'
        };
        const signalModDisplay = signalModifiers.length > 0
            ? signalModifiers.map(s => `<span style="color: ${s.color};">${PLAIN_SIGNAL[s.type] || s.type}: ${Math.abs(s.mod)}% ${s.mod > 0 ? 'more dangerous' : 'safer'}</span>`).join(' · ')
            : '';

        // Card layout: what the team found, what the scan says, then one button per option with its real odds
        const REWARD_WORDS = { METALS: '+40 to 79 salvage', METALS_HIGH: '+60 to 119 salvage', ENERGY: '+30 to 49 energy', NOTHING: 'nothing' };
        const rewardWords = (choice) => {
            const r = choice.reward || {};
            if (r.type === 'ITEM') return `an item${r.tags && r.tags.length ? ' · ' + String(r.tags[0]).toLowerCase() : ''}`;
            return REWARD_WORDS[r.val] || (r.type === 'RESOURCE' ? REWARD_WORDS.ENERGY : 'nothing');
        };
        const evaChoice = (choice, idx) => {
            const totalRisk = Math.max(0, Math.min(100, Math.round(riskBase + choice.riskMod)));
            const riskColor = totalRisk < 10 ? 'var(--green)' : totalRisk < 30 ? 'var(--amber)' : 'var(--red)';
            const paranoidBlocked = isParanoid && choice.riskMod >= 30;        // PARANOID: Vance refuses high-risk options
            const recklessBlocked = recklessBlocksSafe && choice.riskMod === 0; // RECKLESS: Mira overrides the safe option
            const isDisabled = paranoidBlocked || recklessBlocked;
            const note = paranoidBlocked ? 'Vance refuses' : (recklessBlocked ? 'Mira overrides this' : `${totalRisk}% chance someone gets hurt`);
            return `<button class="deck-action choice-btn eva-choice" data-idx="${idx}" data-risk-color="${riskColor}" ${isDisabled ? 'disabled' : ''}>
                        <span>${choice.text}<em class="eva-gets">${rewardWords(choice)}</em></span>
                        <small style="color:${isDisabled ? 'var(--red)' : riskColor}">${note}<i class="eva-risk"><b style="width:${totalRisk}%; background:${riskColor}"></b></i></small>
                    </button>`;
        };

        modal.innerHTML = `
            <section class="modal-content deck-panel eva-panel" role="dialog" aria-label="Team on the ground">
                <header class="deck-panel-head">
                    <h3>${event.title}</h3>
                    <span class="deck-panel-status">TEAM ON THE GROUND</span>
                </header>
                <ul class="deck-panel-crew eva-team">${(this.currentEvaTeam || []).map(m => `<li><img class="deck-panel-face" src="assets/crew/${m.portraitId}.png" alt=""><span class="deck-panel-name">${m.name}</span><span class="deck-panel-mood">ON THE GROUND</span></li>`).join('')}</ul>
                <p class="eva-found">“${event.desc}”</p>
                ${signalModDisplay ? `<dl class="deck-panel-facts"><dt>GOING IN</dt><dd>${signalModDisplay}</dd></dl>` : ''}
                ${isParanoid ? '<p class="eva-voice" style="color:#ff5050">Vance: “I am not risking anyone on something that dangerous.”</p>' : ''}
                ${recklessBlocksSafe ? '<p class="eva-voice" style="color:#d070ff">Mira: “The safe option gets us nothing. I am going in.”</p>' : ''}
                <h4>WHAT DO THEY DO?</h4>
                <div class="deck-panel-actions">${event.choices.map(evaChoice).join('')}</div>
            </section>
        `;

        document.body.appendChild(modal);

        modal.querySelectorAll('.choice-btn:not([disabled])').forEach(btn => {
            btn.addEventListener('click', () => {
                const choice = event.choices[btn.dataset.idx];
                this.resolveEvaOutcome(choice, riskBase);
                modal.remove();
            });
        });

        // hover/focus states come from .deck-action in ship.css
    }

    resolveEvaOutcome(choice, baseRisk) {
        const planet = this.state.currentSystem;
        let totalRisk = baseRisk + choice.riskMod;
        const roll = Math.random() * 100;
        let logMsg = "";

        // === PLANET-TYPE AWARE HAZARD DESCRIPTIONS ===
        const hazardByType = {
            'VOLCANIC': ['lava surge', 'pyroclastic blast', 'magma eruption', 'thermal vent'],
            'ICE_WORLD': ['crevasse collapse', 'flash freeze', 'ice shelf break', 'hypothermia'],
            'TOXIC': ['chemical burn', 'atmospheric leak', 'acid exposure', 'contamination'],
            'DESERT': ['sandstorm', 'heat stroke', 'dust suffocation', 'quicksand'],
            'GAS_GIANT': ['pressure shock', 'atmospheric turbulence', 'lightning strike', 'gravity fluctuation'],
            'VITAL': ['unknown disease', 'hostile plants', 'allergic reaction', 'spore exposure'],
            'ROCKY': ['rockslide', 'cave-in', 'seismic shift', 'unstable terrain'],
            'OCEANIC': ['riptide', 'pressure breach', 'creature attack', 'storm surge'],
            'GRAVEYARD': ['hull collapse', 'decompression', 'debris impact', 'structural failure'],
            'CRYSTALLINE': ['resonance shatter', 'crystal impalement', 'harmonic injury', 'fracture cascade'],
            'SHATTERED': ['debris collision', 'micro-gravity accident', 'impact trauma', 'void exposure'],
            'BIO_MASS': ['organism attack', 'absorption attempt', 'toxic secretion', 'parasitic infection'],
            'MECHA': ['security drone', 'automated defense', 'power surge', 'mechanical trap'],
            'ROGUE': ['extreme cold exposure', 'equipment malfunction', 'isolation psychosis', 'radiation burst'],
            'TERRAFORMED': ['terraformer malfunction', 'environmental collapse', 'system failure', 'containment breach'],
            '_DEFAULT': ['a bad fall', 'a suit breach', 'equipment failure', 'a collapse underfoot']
        };

        const getHazard = () => {
            const hazards = hazardByType[planet?.type] || hazardByType['_DEFAULT'];
            return hazards[Math.floor(Math.random() * hazards.length)];
        };

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
        const HIGH_RISK_FLOOR = 40, RETREAT_ENERGY_COST = 10;
        let isTeamMemberLost = false;
        const evaTeam = this.currentEvaTeam || [];
        if ((roll < totalRisk || predatoryAttack) && evaTeam.length > 0) {
            // INJURY or DEATH — pick randomly from the 2-person EVA team
            const severity = Math.random() * 100;
            const targetCrew = evaTeam[Math.floor(Math.random() * evaTeam.length)];

            // Predatory attacks are more likely to be fatal
            const deathThreshold = (predatoryAttack ? 30 : 10) + Math.max(0, totalRisk - HIGH_RISK_FLOOR); // 10% of hits kill; past 40% risk, each point adds one more
            const hazardDesc = getHazard();

            if (severity < deathThreshold) {
                isTeamMemberLost = true;
                targetCrew.status = 'DEAD';
                targetCrew._deathSector = this.state.currentSector;
                if (predatoryAttack) {
                    targetCrew._deathCause = 'predatory organisms';
                    targetCrew._deathPlanet = planet?.name || planet?.type || 'unknown world';
                    logMsg = `CATASTROPHE: ${targetCrew.name} killed by predatory organisms. The attack was coordinated. `;
                    this.state.addLog(`The creatures didn't just kill — they hunted. ${targetCrew.name} never had a chance.`);
                } else {
                    // Track death cause for ending screen
                    targetCrew._deathCause = hazardDesc;
                    targetCrew._deathPlanet = planet?.name || planet?.type || 'unknown world';
                    // Planet-type specific death messages
                    // The dead come home: their pod is racked in the cargo hold (ShipCutaway), so no line may say the body was lost
                    const deathMsgs = [
                        `CATASTROPHE: ${targetCrew.name} is dead. Cause: ${hazardDesc}. The other one carried them back to the lander.`,
                        `FATAL: ${targetCrew.name} did not survive (${hazardDesc}). They are coming home in a stasis pod.`,
                        `KIA: ${targetCrew.name}, ${hazardDesc}. The trip is over. There is a pod to rack in the hold.`
                    ];
                    logMsg = deathMsgs[Math.floor(Math.random() * deathMsgs.length)] + ' ';
                }
                window.dispatchEvent(new CustomEvent('crew-death', { detail: { crew: targetCrew } }));
            } else {
                targetCrew.status = 'INJURED';
                if (predatoryAttack) {
                    logMsg = `CRITICAL: ${targetCrew.name} mauled by predatory organisms. Emergency rescue! `;
                    this.state.addLog(`Aris: "The wounds are severe. Whatever attacked them knew where to bite."`);
                } else {
                    // Planet-type specific injury messages
                    const injuryMsgs = [
                        `INCIDENT: ${targetCrew.name} injured by ${hazardDesc}. Medical attention required.`,
                        `CRITICAL: ${hazardDesc} wounded ${targetCrew.name}. Emergency rescue!`,
                        `WARNING: ${targetCrew.name} sustained ${hazardDesc} injuries. Aborting EVA.`
                    ];
                    logMsg = injuryMsgs[Math.floor(Math.random() * injuryMsgs.length)] + ' ';
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
            // Planet-type specific success messages for variety
            const successByType = {
                'VOLCANIC': ['Extracted samples despite extreme heat.', 'Team navigated lava fields safely.', 'Heat shields held. Mission complete.'],
                'ICE_WORLD': ['Cryo-samples secured. Warming up.', 'Team returned from the cold.', 'Thermal suits performed well.'],
                'TOXIC': ['Decontamination complete. All clear.', 'Filters held. No exposure.', 'Hazmat protocols successful.'],
                'DESERT': ['Sand-blasted but intact.', 'Team hydrated and returning.', 'Survived the wastes.'],
                'GAS_GIANT': ['Atmospheric dive successful.', 'Pressure held. Samples gained.', 'Returned from the depths.'],
                'VITAL': ['Specimens secured safely.', 'Life signs stable. Beautiful world.', 'Biological samples obtained.'],
                'ROCKY': ['Geological survey complete.', 'Core samples extracted.', 'Terrain navigated successfully.'],
                'OCEANIC': ['Submersible mission success.', 'Water samples secured.', 'Aquatic EVA complete.'],
                'GRAVEYARD': ['Salvage extracted from wreckage.', 'Ship graveyard yielded resources.', 'Honored the dead. Took what we needed.'],
                'CRYSTALLINE': ['Crystal formations documented.', 'Resonance samples secured.', 'Harmonic data recorded.'],
                'SHATTERED': ['Debris field navigated.', 'Fragment samples collected.', 'Micro-gravity EVA success.'],
                'BIO_MASS': ['Organic samples contained.', 'Avoided the larger masses.', 'Biomatter secured for study.'],
                'MECHA': ['Avoided active defenses.', 'Tech salvage gained.', 'Machine world yielded components.'],
                'ROGUE': ['Survived the cold darkness.', 'Isolation protocols held.', 'Returned from the void.'],
                'TERRAFORMED': ['Former colony yielded resources.', 'Reclaimed what was left behind.', 'Terraformer data secured.'],
                '_DEFAULT': ['Operations complete. Team safe.', 'EVA successful. Returning.', 'Mission accomplished.']
            };

            const successMsgs = successByType[planet?.type] || successByType['_DEFAULT'];
            logMsg = successMsgs[Math.floor(Math.random() * successMsgs.length)] + ' ';

            // A.U.R.A. reacts to success (occasionally)
            if (Math.random() < 0.4 && typeof AuraSystem !== 'undefined' && window.AuraSystem) {
                window.AuraSystem.tryComment('SUCCESS', this.state);
            }
        }

        // 2. Reward
        // OBSESSED bonus: +50% resources or double items
        const isObsessed = this.state.hasActiveTrait('OBSESSED');

        if (isTeamMemberLost) {
            logMsg += 'The survivor came back with empty hands.';
        } else if (choice.reward.type === 'RESOURCE' && choice.reward.val === 'NOTHING') {
            // walking away brings nothing home, and costs what the choice says it costs
            if (/Lose Fuel|Energy Cost/i.test(choice.text)) { this.state.energy = Math.max(0, this.state.energy - RETREAT_ENERGY_COST); logMsg += `Nothing brought back. -${RETREAT_ENERGY_COST} Energy.`; }
            else if (/Morale Loss/i.test(choice.text)) { evaTeam.forEach(m => { if (m.status !== 'DEAD') m.stress = Math.min(3, (m.stress || 0) + 1); }); logMsg += 'Nothing brought back. The team is shaken: +1 Stress.'; }
            else logMsg += 'Nothing brought back.';
        } else if (choice.reward.type === 'RESOURCE') {
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

        // Auto-save after EVA completes
        this.autoSave();

        // The airlock opens again: faces first, numbers second
        if (window.AwayTeam && evaTeam.length) window.AwayTeam.returned(this, evaTeam, logMsg);
    }

    /**
     * EDEN EVA — Special peaceful encounter on paradise world.
     * No danger, guaranteed positive outcomes, emotional payoff.
     */
    showEdenEvaModal(planet) {
        const evaTeam = this.currentEvaTeam;
        const options = [
            { key: 'rest', text: 'Rest and recover', desc: 'Everyone sleeps properly for once. All stress gone, all injuries healed.' },
            { key: 'gather', text: 'Gather fruit and fresh water', desc: '+10 Rations. The land gives freely.' },
            { key: 'explore', text: 'Explore the valley', desc: '+50 Salvage from natural materials. Marks a colony site.' },
            { key: 'remember', text: 'Remember what you are fighting for', desc: '+20 Energy. All crew -1 Stress.' },
            { key: 'settle', text: 'END THE JOURNEY — settle here', desc: 'This is what you came for. This is home now. ENDS THE GAME.' },
        ];

        window.EncounterCard.open(this, {
            tone: 'station', kicker: 'ON THE SURFACE', title: 'Paradise found',
            context: `${evaTeam[0].name} and ${evaTeam[1].name} step out. The air is clean. Sweet, even. The grass has never known boots. `
                + 'Something like birds calls far away, and a cold, clear stream runs close by. For the first time since Earth, the universe feels kind.'
                + '<br><br>Nothing here will hurt you. You only have to choose.',
            choices: options,
            onPick: (idx) => {
                const action = options[idx].key;

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
                        // Clear all stress and heal for the paradise ending
                        this.state.crew.forEach(c => {
                            if (c.status !== 'DEAD') {
                                c.stress = 0;
                                if (c.status === 'INJURED') c.status = 'HEALTHY';
                            }
                        });
                        this.state.addLog(`${evaTeam[0].name}: "Commander... we're staying, aren't we?"`);
                        this.state.addLog("You nod. This is where the journey ends.");
                        // Trigger the colony ending
                        this._executeColony(planet, { isScanWaived: true }); // they are standing on it
                        return; // Don't continue to normal exit
                }

                planet.hasEva = true;
                this.orbitView.updateCommandDeck(planet);
                this.state.emitUpdates();
            }
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
            'Jaxon': '#f0a030', 'Aris': '#40c8ff', 'Vance': '#ff5050', 'Mira': '#d070ff',
            'A.U.R.A.': '#74d99a'
        };

        let styled = false;
        // Check for Commander (old saves wrote "Cmdr. LastName:"; the commander never speaks in the log now)
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
                entry.innerHTML = `<span style="color:#d85a4e;font-weight:bold;text-shadow: 0 0 5px #d85a4e;">${msg}</span>`;
                entry.classList.add('log-critical');
                styled = true;
            } else if (msg.startsWith('WARNING:') || msg.startsWith('ALERT:') || msg.includes('⚠')) {
                entry.innerHTML = `<span style="color:#d9a24a;font-weight:bold;">${msg}</span>`;
                entry.classList.add('log-warning');
                styled = true;
            } else if (msg.startsWith('HULL BREACH:')) {
                entry.innerHTML = `<span style="color:#d85a4e;font-weight:bold;text-shadow: 0 0 5px #d85a4e;">${msg}</span>`;
                entry.classList.add('log-critical');
                styled = true;
            } else if (msg.startsWith('REPAIR COMPLETE:') || msg.includes('recovered') || msg.includes('restored')) {
                entry.innerHTML = `<span style="color:#74d99a;">${msg}</span>`;
                styled = true;
            } else if (/^Sector \d+( |$)/.test(msg)) {
                entry.innerHTML = `<span style="color:#9bf0bd;font-weight:bold;border-bottom:1px solid #9bf0bd;">${msg}</span>`;
                entry.classList.add('log-sector');
                styled = true;
            } else if (msg.startsWith('SOMETHING STRANGE:') || msg.includes('ANOMALY:')) {
                entry.innerHTML = `<span style="color:#d070ff;font-weight:bold;">${msg}</span>`;
                entry.classList.add('log-anomaly');
                styled = true;
            } else if (msg.startsWith('Colony') && (msg.includes('Established') || msg.includes('Success'))) {
                entry.innerHTML = `<span style="color:#74d99a;font-weight:bold;font-size:1.1em;text-shadow: 0 0 10px #74d99a;">${msg}</span>`;
                entry.classList.add('log-victory');
                styled = true;
            } else if (msg.includes('EVA team deployed') || msg.includes('Probe launched')) {
                entry.innerHTML = `<span style="color:#9bf0bd;">${msg}</span>`;
                styled = true;
            } else if (msg.includes('Warping to')) {
                entry.innerHTML = `<span style="color:#c4d0c4;font-style:italic;">${msg}</span>`;
                styled = true;
            } else if (msg.includes('KIA') || msg.includes('has died') || msg.includes('DEAD')) {
                entry.innerHTML = `<span style="color:#d85a4e;font-weight:bold;">${msg}</span>`;
                entry.classList.add('log-death');
                styled = true;
            } else if (msg.includes('stressed') || msg.includes('morale') || msg.includes('breakdown')) {
                entry.innerHTML = `<span style="color:#ff8844;">${msg}</span>`;
                styled = true;
            } else if (msg.includes('+') && (msg.includes('Salvage') || msg.includes('Energy') || msg.includes('Ration'))) {
                entry.innerHTML = `<span style="color:#9bf0bd;">${msg}</span>`;
                styled = true;
            } else if (msg.includes('-') && (msg.includes('Salvage') || msg.includes('Energy'))) {
                entry.innerHTML = `<span style="color:#e07a70;">${msg}</span>`;
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
        // Track previous values for flash effects
        const prevEnergy = this._prevEnergy || this.state.energy;
        const prevSalvage = this._prevSalvage || this.state.salvage;
        const prevRations = this._prevRations || this.state.rations;

        // Energy
        document.getElementById('res-energy').textContent = `${this.state.energy}%`;
        if (this.state.energy !== prevEnergy) {
            this.flashResource('energy', this.state.energy > prevEnergy ? 'gain' : 'loss');
        }
        this._prevEnergy = this.state.energy;

        // Salvage (with cap)
        const s = this.state.salvage;
        const sMax = this.state.maxSalvage;
        const salvageEl = document.getElementById('res-salvage');
        if (salvageEl) {
            salvageEl.textContent = `${s}/${sMax}`;
            salvageEl.style.color = (s >= sMax) ? '#d9a24a' : 'var(--color-primary)';
        }
        if (s !== prevSalvage) {
            this.flashResource('salvage', s > prevSalvage ? 'gain' : 'loss');
        }
        this._prevSalvage = s;

        // Rations (color-coded warnings)
        const rEl = document.getElementById('res-rations');
        if (rEl) {
            rEl.textContent = `${this.state.rations}/${this.state.maxRations}`;
            if (this.state.rations <= 2) rEl.style.color = '#d85a4e';
            else if (this.state.rations <= 5) rEl.style.color = '#d9a24a';
            else rEl.style.color = 'var(--color-primary)';
        }
        if (this.state.rations !== prevRations) {
            this.flashResource('rations', this.state.rations > prevRations ? 'gain' : 'loss');
        }
        this._prevRations = this.state.rations;

        // Colony Knowledge (DATA)
        const knowledge = this.state._colonyKnowledge || 0;
        const prevKnowledge = this._prevKnowledge || 0;
        const knowledgeEl = document.getElementById('res-knowledge');
        if (knowledgeEl) {
            knowledgeEl.textContent = knowledge;
            // Color code based on thresholds that matter for endings
            if (knowledge >= 3) knowledgeEl.style.color = '#74d99a'; // Good - unlocks best ending text
            else if (knowledge >= 1) knowledgeEl.style.color = '#9bf0bd'; // Some benefit
            else knowledgeEl.style.color = 'var(--color-text-dim)';
        }
        if (knowledge !== prevKnowledge && knowledge > prevKnowledge) {
            this.flashResource('knowledge', 'special');
        }
        this._prevKnowledge = knowledge;

        // Crew status display on Quarters deck (visual dots)
        this.updateCrewStatusDisplay();

        // Date (advances with actions)
        document.getElementById('game-date').textContent = `DATE: 2342.${String(5 + Math.floor(this.state.actionsTaken / 10)).padStart(2, '0')}.${String(12 + (this.state.actionsTaken % 30)).padStart(2, '0')}`;

        // Sector name
        const sectorEl = document.getElementById('sector-name');
        if (sectorEl && !this.state._inWrongPlace) sectorEl.textContent = this.sectorTitle(this.state.currentSector);

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
                title = `${c.name}: DEAD`;
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
        const colors = ['#74d99a', '#d9a24a', '#d9a24a', '#d85a4e']; // 0=green, 1=yellow, 2=orange, 3=red
        const barColor = colors[Math.min(s, 3)];
        let bar = '[';
        for (let i = 0; i < 3; i++) {
            bar += i < s ? `<span style="color:${barColor}">\u25A0</span>` : `<span style="opacity:0.3">\u25A1</span>`;
        }
        bar += ']';
        return bar;
    }

    showCrewManifest() {
        if (window.RosterPanel) { window.RosterPanel.crew(this); return; } // card layout; legacy list below is the fallback
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';

        const quartersOk = this.state.isDeckOperational('quarters');   // no REST button: the crew rests on each sector jump (docs/ECONOMY.md)

        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">/// CREW MANIFEST /// <span class="close-modal">[X]</span></div>
                <div class="crew-list">
                    ${this.state.crew.map((c, idx) => {
            const isSedated = c.tags && c.tags.includes('SEDATED');
            const isConfined = c.tags && c.tags.includes('CONFINED');
            const color = c.status === 'DEAD' ? '#d85a4e' : isSedated ? '#c4d0c4' : isConfined ? '#e07a70' : (c.status === 'INJURED' ? '#d9a24a' : 'var(--color-primary)');
            const borderColor = c.status === 'DEAD' ? '#d85a4e' : isSedated ? '#c4d0c4' : isConfined ? '#e07a70' : 'var(--color-primary-dim)';
            const statusText = isSedated ? 'SEDATED' : isConfined ? 'CONFINED' : c.status;
            // Stress-based visual effects
            const stressLevel = c.stress || 0;
            const stressFilter = stressLevel >= 3 ? 'saturate(0.5) contrast(1.2) brightness(0.8)' :
                                 stressLevel === 2 ? 'saturate(0.7) sepia(0.2)' :
                                 stressLevel === 1 ? 'saturate(0.85)' : '';
            const stressGlow = stressLevel >= 3 ? '0 0 15px #d85a4e, inset 0 0 20px rgba(255,0,0,0.3)' :
                               stressLevel === 2 ? '0 0 10px #ff6600' :
                               stressLevel === 1 ? '0 0 5px #d9a24a' : '';
            const stressOverlay = stressLevel >= 3 ? '<div style="position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(180deg,transparent 60%,rgba(255,0,0,0.3));pointer-events:none;"></div><div style="position:absolute;top:0;left:0;right:0;bottom:0;animation:stress-pulse 1s infinite;pointer-events:none;border-radius:inherit;box-shadow:inset 0 0 20px rgba(255,0,0,0.5);"></div>' :
                                  stressLevel === 2 ? '<div style="position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(180deg,transparent 70%,rgba(255,100,0,0.2));pointer-events:none;"></div>' :
                                  stressLevel === 1 ? '<div style="position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(180deg,transparent 80%,rgba(255,170,0,0.1));pointer-events:none;"></div>' : '';

            return `
                        <div class="crew-card" style="border: 1px solid ${borderColor}; color: ${color}; ${isSedated || isConfined ? 'opacity: 0.7;' : ''}">
                            <div class="crew-icon" style="position:relative; overflow: hidden; display: flex; align-items: center; justify-content: center; background: #000; filter: drop-shadow(0 0 5px ${color}); box-shadow: ${stressGlow}; ${isSedated ? 'filter: grayscale(50%) drop-shadow(0 0 5px #c4d0c4);' : ''}">
                                <img src="assets/crew/${c.portraitId || 1}.png"
                                     style="width: 100%; height: 100%; object-fit: cover; filter: ${stressFilter}; ${isSedated ? 'filter: grayscale(50%);' : ''}"
                                     onerror="this.style.display='none'; this.parentNode.innerHTML='${c.gender === 'AI' ? '🤖' : '👤'}';">
                                ${stressOverlay}
                            </div>
                            <div class="crew-details">
                                <div class="crew-name">${c.name}</div>
                                <div class="crew-meta" style="color: ${color}; opacity: 0.8;">AGE: ${c.age || 'N/A'} | STATUS: ${statusText} | STRESS: ${this.getStressBar(c.stress)}</div>
                                <div class="crew-tags">${c.tags.filter(t => t !== 'SEDATED' && t !== 'CONFINED').join(' ')}${c.trait ? ` <span style="color:#d85a4e;">[${c.trait}]</span>` : ''}
                                    ${isSedated ? `<span style="color:#c4d0c4; font-weight:bold; margin-left:5px;">[SEDATED - ${c._sedatedUntilWarp || '?'} warps]</span>` : ''}
                                    ${isConfined ? `<span style="color:#e07a70; font-weight:bold; margin-left:5px;">[CONFINED TO QUARTERS]</span>` : ''}
                                </div>
                            </div>
                        </div>
                    `;
        }).join('')}
                </div>
                ${!quartersOk ? '<div style="color:#d85a4e;font-size:0.8em;text-align:center;padding:10px;">CREW QUARTERS OFFLINE — nobody recovers from stress or injury until they are repaired</div>' : ''}
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('.close-modal').onclick = () => modal.remove();
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    }

    showCargoInventory() {
        if (window.RosterPanel) { window.RosterPanel.cargo(this); return; } // card layout; legacy grid below is the fallback
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
            if (!item.isKept) this.state.cargo.splice(index, 1); // documents stay; everything else is used up
            this.state.addLog(item.isKept ? msg : `Used ${item.name}: ${msg}`);
            this.state.emitUpdates();
        }
    }

    handleRevivalAction(item, itemIndex) {
        const deadCrew = this.state.crew.filter(c => c.status === 'DEAD');
        if (deadCrew.length === 0) {
            this.showEventModal({
                title: "INVALID TARGET",
                desc: "No necrotic tissue detected on board. Reanimation protocol requires a valid biological host (dead).",
                choices: [{ text: "CANCEL", riskMod: 0, reward: { type: 'NONE' } }]
            }, this.state.currentSystem);
            return;
        }

        // Show Selection Modal
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="border-color: #d9a24a;">
                <div class="modal-header" style="color: #d9a24a;">/// REANIMATION PROTOCOL /// <span class="close-modal">[X]</span></div>
                <div style="padding: 20px; text-align: center;">
                    <p>Select subject for integration with ${item.name}.</p>
                    <p style="color: #d85a4e; font-size: 0.8em; margin-top: 10px;">
                        WARNING: PROCESS IS IRREVERSIBLE.<br>
                        Neural patterns will be rebuilt but altered. The entity returned may retain skills but lose self-identity.
                    </p>
                </div>
                <div class="crew-list">
                    ${deadCrew.map((c, idx) => `
                        <div class="crew-card status-dead clickable-revive" data-id="${c.id}" style="cursor: pointer; border: 1px solid #d9a24a;">
                            <div class="crew-icon">💀</div>
                            <div class="crew-details">
                                <div class="crew-name">${c.name}</div>
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
                        this.state.addLog(`Aris: "The readings are stable but... the neural patterns are different. They're ${target.name}, but also... something else."`);
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

        if (!planet.scanned && !window.TEST_MODE) { this._executeColony(planet); return; }   // A.U.R.A. refuses an unscanned world herself
        this.askBeforeSettling(planet, () => {
            // A.U.R.A. colony commentary
            if (typeof AuraSystem !== 'undefined' && window.AuraSystem) {
                window.AuraSystem.tryComment('COLONY_ATTEMPT', this.state, true);
            }
            this._executeColony(planet);
        });
    }

    /** Settling ends the journey: never on one click (docs/GAME_FLOW.md 2.0). "Not yet" comes first, nearer the button. */
    askBeforeSettling(planet, onSettle) {
        if (!window.EncounterCard) { onSettle(); return; }
        window.EncounterCard.open(this, {
            tone: 'station', kicker: 'SETTLE', title: `Settle on ${planet.name}?`, zIndex: 2800,
            dialogue: [{ speaker: 'A.U.R.A.', text: 'If we land for good, the journey ends here, Commander. Settle anyway?' }],
            choices: [
                { text: 'Not yet', desc: 'Stay in orbit.' },
                { text: 'Settle here', desc: 'The journey ends on this world.' },
            ],
            onPick: idx => { if (idx === 1) onSettle(); },
        });
    }

    _executeColony(planet, { isScanWaived = false } = {}) {
        if (!planet.scanned && !isScanWaived && !window.TEST_MODE) { // nobody lands five people on a world they have not looked at
            this.state.addLog('A.U.R.A.: "I will not put the crew on a world we have not scanned, Commander. Run a deep scan first."');
            return;
        }
        // Generate Outcome based on Planet Metrics
        const outcome = EndingSystem.getColonyOutcome(planet);

        if (outcome.success && window.AudioSystem) {
            window.AudioSystem.sfxVictory();
        }

        // Color code valid vs failed colonies
        const color = outcome.success ? '#00ff00' : '#d85a4e';
        const survivors = this.state.crew.filter(c => c.status !== 'DEAD');
        const totalCrew = this.state.crew.length;
        const avgStress = survivors.length > 0 ? (survivors.reduce((a, c) => a + (c.stress || 0), 0) / survivors.length).toFixed(1) : 0;

        // Calculate colony rating
        const symbiotes = survivors.filter(c => c.tags?.includes('HIVE_MIND')).length;
        const cyborgs = survivors.filter(c => c.tags?.includes('MACHINE_LINK')).length;
        const wrongPlace = survivors.filter(c => c.tags?.includes('WRONG_PLACE_SURVIVOR')).length;
        const techLevel = this.state.upgrades?.length || 0;
        const colonyKnowledge = this.state._colonyKnowledge || 0;

        // Rating calculation - knowledge matters more!
        // Survivors are crucial, but knowledge from exploring determines long-term survival
        let rating = 'C';
        let ratingColor = '#d9a24a';
        const score = (survivors.length * 15) + (colonyKnowledge * 8) + (techLevel * 5) - (avgStress * 10);
        if (outcome.success) {
            if (score >= 120) { rating = 'S'; ratingColor = '#d9a24a'; }
            else if (score >= 90) { rating = 'A'; ratingColor = '#00ff00'; }
            else if (score >= 60) { rating = 'B'; ratingColor = '#9bf0bd'; }
            else { rating = 'C'; ratingColor = '#d9a24a'; }
        } else {
            rating = 'F'; ratingColor = '#d85a4e';
        }

        if (window.EndScreens) { // shared card; the flight-recorder table below is only the fallback
            window.EndScreens.colony(this, planet, outcome, { rating, survivors: survivors.length, avgStress, colonyKnowledge });
            return;
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
                        <div style="font-size: 1.8em; font-weight: bold; color: ${avgStress <= 1 ? '#9bf0bd' : avgStress <= 2 ? '#d9a24a' : '#d85a4e'};">${avgStress}</div>
                    </div>
                    <div style="background: #000; padding: 12px; text-align: center;">
                        <div style="font-size: 0.7em; color: ${color}88; margin-bottom: 4px;">KNOWLEDGE</div>
                        <div style="font-size: 1.8em; font-weight: bold; color: ${colonyKnowledge >= 5 ? '#00ffcc' : colonyKnowledge >= 2 ? '#9bf0bd' : '#cccccc'};">${colonyKnowledge}</div>
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
                        <div style="font-size: 1.1em; color: ${planet.metrics?.hasLife ? '#74d99a' : '#666'};">${planet.metrics?.hasLife ? 'YES' : 'NO'}</div>
                    </div>
                    <div style="background: #000; padding: 10px; text-align: center;">
                        <div style="font-size: 0.65em; color: ${color}66;">VIABILITY</div>
                        <div style="font-size: 0.9em; color: ${
                            EndingSystem.getPlanetViability(planet, this.state) === 'EXCELLENT' ? '#00ff00' :
                            EndingSystem.getPlanetViability(planet, this.state) === 'GOOD' ? '#9bf0bd' :
                            EndingSystem.getPlanetViability(planet, this.state) === 'MARGINAL' ? '#d9a24a' :
                            '#d85a4e'
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
                    ${outcome.success ? EndingSystem.generateEpilogue(planet, this.state, outcome.title) : ''}
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

            <button onclick="localStorage.removeItem('silentExodus_save'); location.reload()" style="margin-top: 20px; padding: 12px 30px; background: transparent; border: 2px solid ${color}; color: ${color}; font-size: 1em; cursor: pointer; font-family: inherit; transition: all 0.2s;">
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

        // Room card (information as text, only real actions as buttons); the legacy modal below is the fallback
        if (window.DeckPanel) {
            window.DeckPanel.show(this, deckKey);
            return;
        }

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

        const statusColor = deck.status === 'OPERATIONAL' ? 'var(--color-primary)' : '#d85a4e';
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
                                ${canRepair ? 'START REPAIR' : 'NOT ENOUGH SALVAGE'}
                            </button>
                        </div>
                    ` : `
                        <div style="color: var(--color-primary); font-size: 0.9em; text-align: center; padding: 10px; border: 1px solid var(--color-primary-dim);">
                            ALL SYSTEMS NORMAL
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
                    sectorNameEl.style.color = '#d85a4e';
                    sectorNameEl.style.animation = 'pulse 1s infinite';
                }
            } else if (type === 'FOLD_SUCCESS') {
                // Update sector display for successful fold jump
                if (sectorNameEl) {
                    sectorNameEl.textContent = this.sectorTitle(this.state.currentSector);
                    sectorNameEl.style.color = '#9bf0bd';
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
        // Delete save file - game is over
        this.state.deleteSave();
        if (window.EndScreens) { // shared card layout; the legacy red box below is the fallback
            window.EndScreens.gameOver(this, detail);
            return;
        }

        // Gather stats for the run
        const deadCrew = this.state.crew.filter(c => c.status === 'DEAD');
        const livingCrew = this.state.crew.filter(c => c.status !== 'DEAD');
        const planetsVisited = this.state.sectorNodes?.filter(p => p.scanned || p.hasEva).length || 0;
        const exodusLogsFound = this.state.exodusLogsFound?.length || 0;

        // Build crew death memorial
        let crewMemorial = '';
        if (deadCrew.length > 0) {
            crewMemorial = deadCrew.map(c => {
                const cause = c._deathCause || 'unknown causes';
                const planet = c._deathPlanet || 'deep space';
                return `<div style="margin: 5px 0; font-size: 0.85em;">
                    <span style="color: #e07a70;">${c.name}</span>
                    <span style="color: #884444;"> - ${cause} at ${planet}</span>
                </div>`;
            }).join('');
        }

        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: #000; color: #d85a4e; z-index: 10000;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            font-family: 'Share Tech Mono', monospace;
        `;
        overlay.innerHTML = `
            <div style="width: 700px; max-width: 90vw; border: 2px solid #d85a4e; padding: 2px;">
                <div style="background: #d85a4e; color: #000; padding: 5px 10px; font-weight: bold; display: flex; justify-content: space-between;">
                    <span>/// MISSION FAILED</span>
                    <span>${detail.title}</span>
                </div>
                <div style="padding: 30px; font-size: 1.1em; line-height: 1.8; text-align: center;">
                    ${detail.message}
                </div>
                ${crewMemorial ? `
                <div style="border-top: 1px solid #d85a4e; padding: 15px; text-align: center;">
                    <div style="color: #ff444488; font-size: 0.75em; margin-bottom: 10px;">/// IN MEMORIAM ///</div>
                    ${crewMemorial}
                </div>
                ` : ''}
                <div style="border-top: 1px solid #d85a4e; padding: 15px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 0.8em; color: #ff444488;">
                    <div>SECTOR REACHED: <span style="color: #e07a70;">${this.state.currentSector}</span></div>
                    <div>PLANETS EXPLORED: <span style="color: #e07a70;">${planetsVisited}</span></div>
                    <div>CREW LOST: <span style="color: #e07a70;">${deadCrew.length} / 5</span></div>
                    <div>SALVAGE COLLECTED: <span style="color: #e07a70;">${this.state.salvage}</span></div>
                    <div>PAGES FOUND: <span style="color: #e07a70;">${exodusLogsFound} / 6</span></div>
                    <div>RATIONS REMAINING: <span style="color: #e07a70;">${this.state.rations}</span></div>
                </div>
            </div>
            <button id="btn-restart" style="
                margin-top: 30px; padding: 15px 30px; background: transparent;
                border: 1px solid #d85a4e; color: #d85a4e; font-size: 1em;
                cursor: pointer; font-family: inherit;
            ">REBOOT SIMULATION</button>
        `;
        document.body.appendChild(overlay);

        // Button handler
        overlay.querySelector('#btn-restart').onclick = () => location.reload();
    }


    renderNav() {
        this.revealLateStoryPlanet();
        // Check for stranded state (no energy to reach any planet)
        this.checkStranded();

        const mainView = document.getElementById('main-view');
        mainView.innerHTML = '';
        mainView.appendChild(this.navView.render(this.state.sectorNodes));
        const rightPanel = document.getElementById('tactical-display');
        if (rightPanel) rightPanel.innerHTML = '<div class="placeholder-grid">NO TARGET SELECTED</div>';
    }

    /**
     * Check if player is stranded (cannot reach any planet with current energy)
     * Triggers game over if no options remain
     */
    checkStranded() {
        // Skip if game is already over
        if (this.state.gameOver) return;

        // Skip if currently in orbit (player has options there)
        if (this.state.currentSystem) return;

        const energy = this.state.energy;
        const nodes = this.state.sectorNodes || [];

        // Find cheapest warp cost (accounting for bridge damage)
        let cheapestCost = Infinity;
        const stopsLeft = this.state.getStopsLeft ? this.state.getStopsLeft() : 1;
        nodes.forEach(planet => {
            if (planet.ghost || planet.storyHidden) return; // Skip ghost planets and faint contacts: neither can be warped to
            const cost = this.state.getWarpCost(planet);
            const isFinale = !!(planet.isStructure || planet.type === 'STRUCTURE');      // as in handleWarp: the light needs no stop
            const isLegal = this.state.isReentry(planet) || isFinale || stopsLeft > 0 || window.TEST_MODE;   // with no stops left, only going back into orbit, or to the light
            if (isLegal && cost < cheapestCost) cheapestCost = cost;
        });
        if (this.state.currentSector < FINAL_SECTOR) return; // the jump is always a way out (on the reserve, if it must be)

        // If player can afford at least one warp, they're not stranded
        if (energy >= cheapestCost) return;

        // Check if player has any way to gain energy:
        // 1. Items in cargo that could give energy (check onUse function source for energy gains)
        const hasEnergyItem = (this.state.cargo || []).some(item => {
            if (!item.onUse || item.isKept) return false;
            // Check if onUse function contains energy-related code
            const fnSource = item.onUse.toString();
            if (fnSource.includes('energy') || fnSource.includes('Energy')) return true;
            // Also check item description and name for energy hints
            if (item.desc?.toLowerCase().includes('energy')) return true;
            if (item.name?.includes('Battery') || item.name?.includes('Power')) return true;
            return false;
        });
        if (hasEnergyItem) return;

        // 2. If probe is functional AND there are unscanned planets, player could potentially probe for energy
        const probeIntegrity = this.state.probeIntegrity || 0;
        const hasUnscannnedPlanets = nodes.some(p => !p.ghost && !p.scanned && !p.remoteScanned);
        if (probeIntegrity > 0 && hasUnscannnedPlanets) return;

        // 3. If player has ANY usable items at all, give them a chance (they might figure something out)
        const hasAnyUsableItem = (this.state.cargo || []).some(item => item.onUse && !item.isKept);
        if (hasAnyUsableItem) return;

        // Player is truly stranded - no energy, no energy items, no probe, no usable items
        this.state.gameOver = true;
        window.dispatchEvent(new CustomEvent('game-over', {
            detail: {
                title: 'STRANDED',
                message: `The Exodus-9 drifts silently in the void. Energy reserves depleted. No planet within reach.<br><br>
                The crew watches the stars grow dim. One by one, systems fail. Life support runs on emergency backup for eleven days.<br><br>
                On the twelfth day, the ship goes quiet.<br><br>
                <em>The void claims another Exodus.</em>`
            }
        }));
    }

    renderOrbit() {
        const here = this.state.currentSystem;                                             // only a jump that lands at random can end up here
        if (here && here.storyHidden) this.revealStoryPlanet(here, `The faint contact is ${here.name}. One of our ships is down there.`);
        const mainView = document.getElementById('main-view');
        mainView.innerHTML = '';
        mainView.appendChild(this.orbitView.render());
    }

    showFabricator() {
        if (window.FabricatorPanel) { // card layout with icons; the legacy grid below is the fallback
            window.FabricatorPanel.show(this);
            return;
        }
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
        const effectiveCost = window.TEST_MODE ? 0 : (hoarderActive ? Math.ceil(upg.cost * 1.25) : upg.cost);
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
    /** A ship fault card. Resolves once it is dealt with. */
    showShipMalfunctionModal(event) {
        // dialogue can be an array or a function that returns one
        const dialogue = typeof event.dialogue === 'function' ? event.dialogue(this.state) : event.dialogue;
        return new Promise(resolve => window.EncounterCard.open(this, {
            tone: 'alert', kicker: 'SHIP ALERT', title: event.title, zIndex: 2800,
            context: event.context, dialogue,
            choices: [{ text: 'DEAL WITH IT' }],
            onPick: () => {
                const result = event.effect(this.state);
                if (result) this.state.addLog(`MALFUNCTION RESOLVED: ${result}`);
                this.state.emitUpdates();
                resolve();
            }
        }));
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
            <section class="modal-content deck-panel audio-panel" role="dialog" aria-label="Sound">
                <header class="deck-panel-head">
                    <h3>SOUND</h3>
                    <button class="deck-panel-close close-modal" aria-label="Close">✕</button>
                </header>
                <div class="deck-panel-actions">
                    <button id="audio-toggle-btn" class="deck-action" aria-pressed="${isOn}"><span>${isOn ? 'SOUND IS ON' : 'SOUND IS OFF'}</span><small>click to switch</small></button>
                </div>
                <h4>VOLUME</h4>
                <div class="audio-volume">
                    <input type="range" id="modal-volume-slider" min="0" max="100" value="${currentVol}" aria-label="Volume">
                    <output id="volume-display">${currentVol}%</output>
                </div>
            </section>
        `;

        document.body.appendChild(modal);

        const toggleBtn = modal.querySelector('#audio-toggle-btn');
        const slider = modal.querySelector('#modal-volume-slider');
        const volDisplay = modal.querySelector('#volume-display');

        toggleBtn.onclick = () => {
            if (window.AudioSystem) {
                const isMuted = window.AudioSystem.toggleMute();
                toggleBtn.querySelector('span').textContent = isMuted ? 'SOUND IS OFF' : 'SOUND IS ON';
                toggleBtn.setAttribute('aria-pressed', String(!isMuted));
                this.syncSoundButton();
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
