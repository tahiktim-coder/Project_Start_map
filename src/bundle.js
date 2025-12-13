
/**
 * BUNDLED APPLICATION FOR LOCAL EXECUTION
 * Merged to bypass ES Module CORS restrictions on file:// protocol.
 */

// --- 1. DATA & GENERATORS ---

const PLANET_TYPES = ['ROCKY', 'GAS_GIANT', 'ICE_WORLD', 'OCEANIC', 'DESERT', 'VOLCANIC', 'TOXIC', 'VITAL'];

const ATMOSPHERES = {
    BREATHABLE: { type: 'BREATHABLE', chance: 0.1 },
    THIN: { type: 'THIN', chance: 0.2 },
    TOXIC: { type: 'TOXIC', chance: 0.3 },
    CORROSIVE: { type: 'CORROSIVE', chance: 0.1 },
    HIGH_PRESSURE: { type: 'HIGH_PRESSURE', chance: 0.2 },
    NONE: { type: 'NONE', chance: 0.1 }
};

const PLANET_DATA = {
    ROCKY: { scanCost: 2, hazardChance: 0.3, desc: "Barren terrestrial world. Good source of metals." },
    GAS_GIANT: { scanCost: 3, hazardChance: 0.8, desc: "Massive ball of hydrogen/helium. High gravity risk." },
    ICE_WORLD: { scanCost: 2, hazardChance: 0.5, desc: "Frozen surface. Potential cryo-flora." },
    OCEANIC: { scanCost: 2, hazardChance: 0.4, desc: "Global liquid water ocean. Landing difficult." },
    DESERT: { scanCost: 2, hazardChance: 0.6, desc: "Scorched surface. Extreme heat alerts." },
    VOLCANIC: { scanCost: 3, hazardChance: 0.9, desc: "Active tectonic activity. Magma flows detected." },
    TOXIC: { scanCost: 3, hazardChance: 0.7, desc: "Atmosphere composed of lethal compounds." },
    VITAL: { scanCost: 2, hazardChance: 0.1, desc: "Rare biosphere. Detecting life signs." }
};



const SUFFIXES = ['Prime', 'Major', 'Minor', 'IV', 'X', 'Alpha', 'Proxima', 'Secundus'];
const NAMES = ['Helios', 'Kryos', 'Titan', 'Aea', 'Zephyr', 'Chronos', 'Nyx', 'Erebus', 'Tartarus', 'Atlas', 'Hyperion', 'Phoebe'];

class PlanetGenerator {
    static generateSector(level) {
        const count = Math.floor(Math.random() * 3) + 3; // 3 to 5 planets
        const sector = [];

        for (let i = 0; i < count; i++) {
            sector.push(this.generatePlanet(level));
        }
        return sector;
    }

    static generatePlanet(level) {
        const type = PLANET_TYPES[Math.floor(Math.random() * PLANET_TYPES.length)];
        const nameBase = NAMES[Math.floor(Math.random() * NAMES.length)];
        const suffix = SUFFIXES[Math.floor(Math.random() * SUFFIXES.length)];
        const digit = Math.floor(Math.random() * 99);

        // Physics Generation
        const gravity = (0.5 + Math.random() * 2.0).toFixed(2);
        const tempBase = Math.floor(Math.random() * 500) - 200;
        const conditions = this.generateConditions(type, level);

        return {
            id: `p-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: `${nameBase}-${digit} ${suffix}`,
            type: type,
            // Stats
            gravity: `${gravity}G`,
            temperature: `${tempBase}°C`,
            atmosphere: conditions.atmosphere,
            tags: conditions.tags,
            // Logic metrics for game scenarios (Ending calculations/Events)
            metrics: {
                gravity: parseFloat(gravity),
                temp: tempBase,
                hasLife: type === 'VITAL' || (conditions.tags && conditions.tags.includes('VITAL_FLORA')),
                hasTech: conditions.tags && (conditions.tags.includes('ALIEN_SIGNALS') || conditions.tags.includes('ANCIENT_RUINS'))
            },
            // Gameplay
            fuelCost: 10 + Math.floor(Math.random() * 10),
            dangerLevel: Math.floor(Math.random() * level) + (PLANET_DATA[type].hazardChance > 0.6 ? 1 : 0),
            desc: PLANET_DATA[type].desc,
            // Rewards
            resources: {
                metals: Math.floor(Math.random() * 80) + 10,
                energy: Math.floor(Math.random() * 50) + 10,
                anomalies: Math.random() > 0.7 ? 1 : 0
            },
            // State
            scanned: false,
            remoteScanned: false,
            revealedStats: [],
            visited: false
        };
    }

    static generateConditions(type, level) {
        let atmosphere = 'UNKNOWN';
        if (['GAS_GIANT', 'TOXIC'].includes(type)) atmosphere = 'TOXIC';
        else if (type === 'ROCKY') atmosphere = Math.random() > 0.5 ? 'THIN' : 'NONE';
        else if (type === 'VITAL') atmosphere = 'BREATHABLE';
        else atmosphere = Object.keys(ATMOSPHERES)[Math.floor(Math.random() * 6)];

        const tags = [];
        if (level > 2) tags.push('HIGH_RISK');
        if (Math.random() > 0.8) tags.push('ANCIENT_RUINS');
        if (Math.random() > 0.8) tags.push('ALIEN_SIGNALS');

        return { atmosphere, tags };
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
        this.fuel = 100;
        this.oxygen = 100;
        this.energy = 100;
        this.metals = 0;
        this.probeIntegrity = 100;
        this.cargo = []; // Added Cargo

        this.currentSector = 1;
        this.currentSystem = null;
        this.lastVisitedSystem = null; // Added for 0-cost return logic

        this.crew = [
            { id: 1, name: 'Cmdr. Shepard', gender: 'M', status: 'HEALTHY', tags: ['LEADER'] },
            { id: 2, name: 'Eng. Isaac', gender: 'M', status: 'HEALTHY', tags: ['ENGINEER'] },
            { id: 3, name: 'Dr. Ripley', gender: 'F', status: 'HEALTHY', tags: ['MEDIC'] },
            { id: 4, name: 'Spc. Vance', gender: 'M', status: 'HEALTHY', tags: ['SECURITY'] },
            { id: 5, name: 'Bot TARS', gender: 'AI', status: 'HEALTHY', tags: ['AI'] }
        ];

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
        if (this.energy >= amount) {
            this.energy -= amount;
            this.emitUpdates();
            return true;
        }
        this.addLog("WARNING: Insufficient Energy!");
        return false;
    }

    emitUpdates() {
        window.dispatchEvent(new Event('hud-updated'));
    }
}

// --- 3. VIEWS ---

class NavView {
    constructor(state) {
        this.element = document.createElement('div');
        this.element.className = 'nav-view-container';
        this.state = state;
    }

    render(systems) {
        if (!systems || systems.length === 0) {
            this.element.innerHTML = `<div class="loading-state">WARPING TO NEW SECTOR...</div>`;
            return this.element;
        }

        const gridContent = systems.map(planet => `
            <div class="nav-node" data-id="${planet.id}" style="border: 1px solid var(--color-primary-dim); padding: 15px; cursor: pointer; transition: all 0.2s; background: rgba(0,255,0,0.05); position: relative;">
                <div style="font-size: 10px; color: var(--color-primary-dim); margin-bottom: 5px;">COORDS: [${Math.floor(Math.random() * 999)}:${Math.floor(Math.random() * 999)}]</div>
                <h3 style="color: var(--color-primary); margin-bottom: 5px; font-family: var(--font-display);">${planet.name}</h3>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
                    <span style="color: var(--color-text-dim); font-size: 0.9em;">TYPE: ${planet.type}</span>
                    <!-- Level Hidden as requested -->
                </div>
                
                <div class="card-actions" style="margin-top: 15px; border-top: 1px dashed var(--color-primary-dim); padding-top: 10px;">
                    <div style="font-size: 0.8em; color: var(--color-primary);">WARP COST: ${planet.fuelCost} ENERGY</div>
                </div>

                ${planet.scanned ? '<div style="position: absolute; top:0; right:0; background: var(--color-primary); color: #000; padding: 2px 5px; font-size: 10px;">SCANNED</div>' : ''}
            </div>
        `).join('');

        this.element.innerHTML = `
            <div style="padding: 20px; height: 100%;">
                <div style="display: flex; justify-content: space-between; align-items: end; border-bottom: 2px solid var(--color-primary); padding-bottom: 10px; margin-bottom: 20px;">
                    <h2 style="color: var(--color-primary); margin:0;">/// SECTOR NAVIGATION MAP</h2>
                    <button id="jump-sector-btn" style="background: transparent; border: 1px solid var(--color-accent); color: var(--color-accent); padding: 5px 15px; cursor: pointer; font-family: var(--font-mono);">
                        >> JUMP SECTOR (-20 ENERGY)
                    </button>
                </div>
                
                <div class="sector-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; overflow-y: auto; max-height: 80vh;">
                    ${gridContent}
                </div>
            </div>
        `;

        this.attachEvents(systems);
        return this.element;
    }

    attachEvents(systems) {
        const jumpBtn = this.element.querySelector('#jump-sector-btn');
        if (jumpBtn) {
            jumpBtn.addEventListener('click', () => {
                window.dispatchEvent(new CustomEvent('req-sector-jump'));
            });
        }

        this.element.querySelectorAll('.nav-node').forEach(node => {
            const id = node.getAttribute('data-id');
            const data = systems.find(p => p.id === id);

            node.addEventListener('mouseenter', () => {
                node.style.boxShadow = '0 0 15px var(--color-primary-dim)';
                node.style.borderColor = 'var(--color-primary)';
            });
            node.addEventListener('mouseleave', () => {
                node.style.boxShadow = 'none';
                node.style.borderColor = 'var(--color-primary-dim)';
            });

            node.addEventListener('click', () => {
                this.handlePlanetSelect(data);
            });
        });
    }

    handlePlanetSelect(planet) {
        window.dispatchEvent(new CustomEvent('planet-selected', { detail: planet }));

        const panel = document.getElementById('tactical-display');
        if (!panel) return;

        // Hidden Stats Logic
        const isDeepScanned = planet.scanned;
        const isRemoteScanned = planet.remoteScanned;

        // Helper to check if stat should be shown
        const showStat = (key) => isDeepScanned || (isRemoteScanned && planet.revealedStats && planet.revealedStats.includes(key));

        const tagsHtml = isDeepScanned && planet.tags && planet.tags.length > 0
            ? planet.tags.map(t => `<span style="background: var(--color-primary-dim); color: #000; padding: 2px 4px; border-radius: 2px; font-size: 0.8em; margin-right: 5px;">${t}</span>`).join('')
            : (isDeepScanned ? '<span style="color: var(--color-text-dim);">NO ANOMALIES DETECTED</span>' : '<span style="color: var(--color-text-dim);">UNKNOWN</span>');

        const gravDisplay = showStat('gravity') ? planet.gravity : '<span style="color:var(--color-accent)">UNKNOWN</span>';
        const tempDisplay = showStat('temperature') ? planet.temperature : '<span style="color:var(--color-accent)">UNKNOWN</span>';
        const atmoDisplay = showStat('atmosphere') ? planet.atmosphere : '<span style="color:var(--color-accent)">UNKNOWN</span>';

        // Calculate actual warp cost (0 if returning to last visited)
        const actualCost = (this.state.lastVisitedSystem && this.state.lastVisitedSystem.id === planet.id) ? 0 : planet.fuelCost;

        panel.innerHTML = `
            <div class="tactical-card" style="width: 100%; height: 100%; display: flex; flex-direction: column;">
                <div style="border: 1px solid var(--color-primary); height: 150px; display: flex; align-items: center; justify-content: center; background: rgba(0,255,0,0.05); margin-bottom: 20px; position: relative; overflow: hidden;">
                    <div style="width: 80px; height: 80px; border-radius: 50%; border: 2px solid var(--color-primary); box-shadow: 0 0 20px var(--color-primary-dim); background: radial-gradient(circle at 30% 30%, var(--color-primary-dim), #000);"></div>
                    <div style="position: absolute; top:0; left:0; width:100%; height:100%; background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%); background-size: 100% 4px; pointer-events: none;"></div>
                </div>
                
                <h3 style="color: var(--color-primary); border-bottom: 1px solid var(--color-primary-dim); padding-bottom: 5px;">${planet.name}</h3>
                
                <div style="margin-top: 15px; font-size: 0.9em; flex: 1; display: flex; flex-direction: column; gap: 8px;">
                    <div style="color: var(--color-text-dim); font-style: italic; margin-bottom: 5px;">"${planet.desc}"</div>
                    <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed var(--color-primary-dim);">
                        <span style="color: var(--color-text-dim);">TYPE</span><span>${planet.type}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed var(--color-primary-dim);">
                        <span style="color: var(--color-text-dim);">GRAVITY</span><span>${gravDisplay}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed var(--color-primary-dim);">
                        <span style="color: var(--color-text-dim);">TEMP</span><span>${tempDisplay}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed var(--color-primary-dim);">
                        <span style="color: var(--color-text-dim);">ATMOSPHERE</span><span>${atmoDisplay}</span>
                    </div>
                    <div style="margin-top: 10px;">
                        <div style="color: var(--color-text-dim); margin-bottom: 5px;">TAGS:</div>
                        <div>${tagsHtml}</div>
                    </div>
            ${(isRemoteScanned || isDeepScanned)
                ? `<div style="margin-top: auto; color: var(--color-primary); text-align: center; border: 1px solid var(--color-primary); padding: 5px;">
                    ${isDeepScanned ? 'FULL ANALYSIS COMPLETE' : 'PARTIAL ANALYSIS COMPLETE'}
                   </div>`
                : (planet.id === this.state.currentSystem?.id
                    ? `<div style="margin-top: auto; color: var(--color-primary); text-align: center; border: 1px solid var(--color-primary-dim); padding: 10px; opacity: 0.7;">
                        CURRENT LOCATION
                       </div>`
                    : `<button class="scan-btn" style="margin-top: auto; width:100%; padding:10px; background: transparent; border: 1px solid var(--color-accent); color: var(--color-accent); cursor: pointer; font-family: var(--font-mono);">
                            LONG RANGE SCAN (-2 ENERGY)
                       </button>`
                )
            }
                </div>

                <div class="actions-container" style="margin-top: 15px;">
                     <button class="warp-btn" style="width: 100%; padding: 15px; background: var(--color-primary); color: #000; border: none; font-weight: bold; font-family: var(--font-display); cursor: pointer; text-transform: uppercase;">
                        ${planet.id === this.state.currentSystem?.id ? 'RE-ESTABLISH ORBIT (0 NRG)' : `INITIATE WARP (${actualCost} NRG)`}
                    </button>
                </div>
            </div>
        `;

        const warpBtn = panel.querySelector('.warp-btn');
        if (warpBtn) {
            warpBtn.addEventListener('click', () => {
                window.dispatchEvent(new CustomEvent('req-warp', { detail: planet }));
            });
        }

        const scanBtn = panel.querySelector('.scan-btn');
        if (scanBtn) {
            scanBtn.addEventListener('click', () => {
                window.dispatchEvent(new CustomEvent('req-remote-scan', { detail: planet }));
            });
        }
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
        console.log("Exodus-1 Systems Initializing...");

        window.addEventListener('log-updated', (e) => this.handleLogUpdate(e));

        window.addEventListener('hud-updated', () => this.updateHud());

        // Header Interactions
        document.getElementById('res-crew').parentElement.onclick = () => this.showCrewManifest();

        window.addEventListener('req-warp', (e) => this.handleWarp(e.detail));
        window.addEventListener('req-sector-jump', () => this.handleSectorJump());
        window.addEventListener('req-action-scan', () => this.handleScanAction());
        window.addEventListener('req-action-probe', () => this.handleProbeAction());
        window.addEventListener('req-action-eva', () => this.handleEvaAction());
        window.addEventListener('req-action-colony', () => this.handleColonyAction());
        window.addEventListener('req-break-orbit', () => {
            this.state.addLog("Breaking orbit. Systems disengaged.");
            this.renderNav();
        });
        window.addEventListener('req-remote-scan', (e) => this.handleRemoteScan(e.detail));

        this.state.init();
        this.state.sectorNodes = PlanetGenerator.generateSector(1);
        this.state.addLog("Sector 1 Map Generated.");
        this.renderNav();
        this.state.addLog("System Init Complete. Awaiting Navigation Input.");
    }

    handleWarp(planet) {
        // Free warp if returning to the last visited system (simulating orbit re-entry)
        let cost = planet.fuelCost;
        if (this.state.lastVisitedSystem && this.state.lastVisitedSystem.id === planet.id) {
            cost = 0;
            this.state.addLog("Orbit re-entry trajectory calculated. Fuel cost negligible.");
        }

        if (this.state.consumeEnergy(cost)) {
            this.state.addLog(`Warping to ${planet.name}...`);
            this.state.currentSystem = planet;
            this.state.lastVisitedSystem = planet; // Track last visited
            setTimeout(() => {
                this.state.addLog(`Orbit established. Systems Green.`);
                this.renderOrbit();
            }, 1000);
        }
    }

    handleRemoteScan(planet) {
        if (this.state.consumeEnergy(2)) {
            const data = this.state.sectorNodes.find(p => p.id === planet.id);
            if (data) {
                data.remoteScanned = true;

                // Randomly reveal 1-2 stats if not already done
                if (!data.revealedStats || data.revealedStats.length === 0) {
                    const count = Math.random() > 0.7 ? 2 : 1;
                    const options = ['gravity', 'temperature', 'atmosphere'];
                    const shuffled = options.sort(() => 0.5 - Math.random());
                    data.revealedStats = shuffled.slice(0, count);
                }

                this.state.addLog(`Long-range sensors locked on ${planet.name}. Partial data retrieved.`);
                // Force re-render of right panel
                this.navView.handlePlanetSelect(data);
            }
        }
    }

    handleSectorJump() {
        if (this.state.consumeEnergy(20)) {
            this.state.addLog("Initiating Sector Jump...");
            this.state.sectorNodes = PlanetGenerator.generateSector(this.state.currentSector + 1);
            this.state.currentSector++;
            this.state.lastVisitedSystem = null; // Clear history
            this.renderNav();
            this.state.addLog(`Sector ${this.state.currentSector} Generated.`);
        }
    }

    handleScanAction() {
        if (this.state.consumeEnergy(2)) {
            this.state.addLog("Deep Scan initiated...");
            this.state.currentSystem.scanned = true;
            this.state.addLog("Detailed surface analysis complete. Resource data available.");
            this.orbitView.updateCommandDeck(this.state.currentSystem);
            // Also update the left panel data if possible, but for now just command deck prevents reset
            this.renderOrbit(); // ACTUALLY: We need to re-render to show the new "Environment Readings" on the left.
            // To fix the animation reset, we would need to separate the Planet Visual into its own component that doesn't re-render.
            // For now, let's fix the BUTTON functionality first. 
        }
    }

    handleProbeAction() {
        // 1. Fabricate if destroyed
        if (this.state.probeIntegrity <= 0) {
            if (this.state.metals >= 50) {
                this.state.metals -= 50;
                this.state.probeIntegrity = 100;
                this.state.addLog("Probe Fabricated. Systems Operational.");
                this.state.emitUpdates();
                // this.renderOrbit(); // CAUSES RESET
                this.orbitView.updateCommandDeck(this.state.currentSystem);
            } else {
                this.state.addLog("Insufficient Metals to fabricate Probe.");
            }
            return;
        }

        // 2. Launch Sequence
        const planet = this.state.currentSystem;
        this.state.addLog(`Probe launched to ${planet.name} surface...`);

        // Damage Calc - HIGH RISK
        const baseDmg = 15 + Math.random() * 15; // 15-30% base damage
        const hazardMod = (planet.dangerLevel || 0) * 8; // Severe hazard penalty
        const rng = Math.random() * 5;
        const totalDmg = baseDmg + hazardMod + rng;

        this.state.probeIntegrity = Math.max(0, this.state.probeIntegrity - totalDmg);

        // Loot Resolution - HARDER YIELDS
        const roll = Math.random() * 100;
        let outcome = "NOTHING";
        let message = "Probe returned with minimal data.";

        if (roll < 20) {
            // METALS (20% Chance)
            let amount = Math.floor(10 + Math.random() * 20); // 10-30 yield
            if (['ROCKY', 'DESERT'].includes(planet.type)) amount = Math.floor(amount * 1.5);
            this.state.metals += amount;
            outcome = "METALS";
            message = `Probe extracted ${amount} Metals.`;
        } else if (roll < 35) {
            // ENERGY (15% Chance)
            let amount = Math.floor(5 + Math.random() * 15); // 5-20 yield
            if (['GAS_GIANT', 'VOLCANIC'].includes(planet.type)) amount = Math.floor(amount * 1.5);
            this.state.energy = Math.min(100, this.state.energy + amount);
            outcome = "ENERGY";
            message = `Probe siphoned ${amount} Energy units.`;
        } else if (roll < 45) {
            // ITEM (10% Chance)
            const item = this.getProbeItem(planet);
            if (item) {
                this.state.cargo.push(item);
                outcome = "ITEM";
                message = `Probe retrieved artifact: ${item.name}.`;
            }
        } else if (roll < 50) {
            // CONDENSED RESOURCE (5% Chance)
            const resItem = (Math.random() > 0.5) ? ITEMS.CONDENSED_METALS : ITEMS.IONIZED_BATTERY;
            this.state.cargo.push(resItem);
            outcome = "RESOURCE_PACK";
            message = `Probe salvaged: ${resItem.name}.`;
        }

        // Integrity Check
        if (this.state.probeIntegrity <= 0) {
            this.state.addLog(`CRITICAL: Probe destroyed by atmospheric stress. Telemetry: ${message}`);
        } else {
            this.state.addLog(`Probe returned. Integrity at ${this.state.probeIntegrity.toFixed(0)}%. Result: ${message}`);
        }

        this.state.emitUpdates();
        this.orbitView.updateCommandDeck(planet);
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
        if (pool.length === 0) pool = Object.values(ITEMS);

        // Return random item from pool
        const template = pool[Math.floor(Math.random() * pool.length)];
        return { ...template, acquiredAt: planet.name };
    }

    handleEvaAction() {
        const healthyCrew = this.state.crew.filter(c => c.status === 'HEALTHY');

        // 1. Check Requirements
        if (healthyCrew.length < 2) {
            this.state.addLog("MISSION ABORTED: Minimum 2 Healthy Crew required for EVA.");
            return;
        }

        if (this.state.consumeEnergy(5)) {
            const planet = this.state.currentSystem;

            // 2. Select Event
            // Prioritize specific events, fallback to generic
            let potentialEvents = EVENTS.filter(e => e.trigger(planet));
            if (potentialEvents.length === 0) potentialEvents = [EVENTS[EVENTS.length - 1]]; // Should not happen due to fallback, but safe

            // Bias towards first matches (more specific)
            const selectedEvent = potentialEvents[0];

            this.showEventModal(selectedEvent, planet);
            planet.hasEva = true; // Mark as done
            // this.renderOrbit(); // Removed to prevent reset
            this.orbitView.updateCommandDeck(planet); // Update buttons only
        }
    }

    showEventModal(event, planet) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.zIndex = '2000';

        const riskBase = (planet.dangerLevel || 0) * 5 + 5; // Base risk 5% to 30%

        modal.innerHTML = `
            <div class="modal-content" style="border-color: var(--color-accent);">
                <div class="modal-header" style="color: var(--color-accent);">/// EVA MISSION: ${event.title} ///</div>
                <div style="padding: 20px; text-align: center;">
                    <p style="margin-bottom: 20px; font-style: italic;">"${event.desc}"</p>
                    
                    <div style="display: flex; gap: 20px; justify-content: center;">
                        ${event.choices.map((choice, idx) => {
            const totalRisk = riskBase + choice.riskMod;
            let riskLabel = "UNKNOWN";
            let riskColor = "var(--color-text-dim)";

            if (totalRisk < 10) { riskLabel = "NEGLIGIBLE"; riskColor = "var(--color-primary)"; }
            else if (totalRisk < 30) { riskLabel = "MODERATE"; riskColor = "#FFFF00"; }
            else if (totalRisk < 60) { riskLabel = "HIGH"; riskColor = "#FFA500"; }
            else { riskLabel = "EXTREME"; riskColor = "#FF0000"; }

            return `
                            <button class="choice-btn" data-idx="${idx}" style="
                                padding: 15px; 
                                border: 1px solid var(--color-primary); 
                                background: rgba(0,0,0,0.8); 
                                color: var(--color-primary); 
                                cursor: pointer; 
                                flex: 1;
                                font-family: var(--font-mono);
                                transition: all 0.2s;
                            ">
                                <div>${choice.text}</div>
                                <div style="font-size: 0.8em; margin-top: 5px; color: ${riskColor}">RISK ASSESSMENT: ${riskLabel}</div>
                            </button>
                        `}).join('')}
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.querySelectorAll('.choice-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const choice = event.choices[btn.dataset.idx];
                this.resolveEvaOutcome(choice, riskBase);
                modal.remove();
            });
        });

        // Hover effects
        modal.querySelectorAll('.choice-btn').forEach(btn => {
            btn.onmouseenter = () => { btn.style.background = 'var(--color-primary)'; btn.style.color = '#000'; };
            btn.onmouseleave = () => { btn.style.background = 'rgba(0,0,0,0.8)'; btn.style.color = 'var(--color-primary)'; };
        });
    }

    resolveEvaOutcome(choice, baseRisk) {
        const totalRisk = baseRisk + choice.riskMod;
        const roll = Math.random() * 100;
        let logMsg = "";

        // 1. Hazard Check
        if (roll < totalRisk) {
            // INJURY or DEATH
            const severity = Math.random() * 100;
            const targetCrew = this.state.crew.filter(c => c.status === 'HEALTHY')[0]; // Pick first available

            if (severity < 10 || totalRisk > 40) { // 10% chance of death on hit, or if risk was super high
                targetCrew.status = 'DEAD';
                logMsg = `CATASTROPHE: ${targetCrew.name} KIA during operation. `;
            } else {
                targetCrew.status = 'INJURED';
                logMsg = `INCIDENT: ${targetCrew.name} sustained heavy injuries. `;
            }
        } else {
            logMsg = "Operations Successful. Team returned safely. ";
        }

        // 2. Reward
        // Even on injury, you usually get the loot (unless dead? lets be generous for now)
        if (choice.reward.type === 'RESOURCE') {
            let amount = 0;
            if (choice.reward.val === 'METALS') amount = 40 + Math.floor(Math.random() * 40);
            else if (choice.reward.val === 'METALS_HIGH') amount = 60 + Math.floor(Math.random() * 60);
            else amount = 30 + Math.floor(Math.random() * 20); // Energy

            if (choice.reward.val.includes('METALS')) {
                this.state.metals += amount;
                logMsg += `Recovered ${amount} Metals.`;
            } else {
                this.state.energy = Math.min(100, this.state.energy + amount);
                logMsg += `Siphoned ${amount} Energy.`;
            }
        } else if (choice.reward.type === 'ITEM') {
            // Pick a random item
            const item = this.getProbeItem(this.state.currentSystem); // Reuse pool logic for now
            this.state.cargo.push(item);
            logMsg += `Secured Artifact: ${item.name}.`;
        }

        this.state.addLog(logMsg);
        this.state.emitUpdates();
    }

    handleLogUpdate(e) {
        const logContainer = document.getElementById('log-entries');
        if (!logContainer) return;
        const msg = e.detail?.message || "Log Updated";
        const entry = document.createElement('div');
        entry.className = 'log-entry new';
        entry.textContent = msg;
        logContainer.appendChild(entry);

        // Auto scroll force
        requestAnimationFrame(() => {
            logContainer.scrollTop = logContainer.scrollHeight;
        });
    }

    updateHud() {
        document.getElementById('res-energy').textContent = `${this.state.energy}%`;
        document.getElementById('res-oxygen').textContent = `${this.state.oxygen}%`;
        document.getElementById('res-metals').textContent = `${this.state.metals}`;
        document.getElementById('res-probe').textContent = `${this.state.probeIntegrity.toFixed(0)}%`;
        const crewCount = this.state.crew.filter(c => c.status !== 'DEAD').length;
        document.getElementById('res-crew').textContent = `${crewCount}/${this.state.crew.length}`;
        document.getElementById('game-date').textContent = `DATE: 2342.05.${12 + this.state.currentSector}`;

        // Add Cargo if not exists in DOM
        let cargoEl = document.getElementById('res-cargo');
        if (!cargoEl) {
            const cluster = document.querySelector('.resource-cluster');
            const div = document.createElement('div');
            div.className = 'res-item';
            div.innerHTML = `<label>CARGO</label><span id="res-cargo">0</span>`;
            cluster.appendChild(div);
            cargoEl = div.querySelector('#res-cargo');
        }

        // ALWAYS update the text content
        cargoEl.textContent = `${this.state.cargo.length}`;
        // Helper to make entire resource item clickable
        const cargoContainer = cargoEl.parentElement;
        cargoContainer.style.cursor = 'pointer';
        cargoContainer.style.border = '1px solid transparent';
        cargoContainer.onmouseover = () => { cargoContainer.style.borderBottom = '1px solid var(--color-primary)'; };
        cargoContainer.onmouseout = () => { cargoContainer.style.borderBottom = '1px solid transparent'; };
        cargoContainer.onclick = () => this.showCargoInventory();

        const crewContainer = document.getElementById('res-crew').parentElement;
        crewContainer.style.cursor = 'pointer';
        crewContainer.style.border = '1px solid transparent';
        crewContainer.onmouseover = () => { crewContainer.style.borderBottom = '1px solid var(--color-primary)'; };
        crewContainer.onmouseout = () => { crewContainer.style.borderBottom = '1px solid transparent'; };
        crewContainer.onclick = () => this.showCrewManifest();
    }

    showCrewManifest() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">/// CREW MANIFEST /// <span class="close-modal">[X]</span></div>
                <div class="crew-list">
                    ${this.state.crew.map(c => `
                        <div class="crew-card ${c.status === 'DEAD' ? 'status-dead' : ''}">
                            <div class="crew-icon">${c.gender === 'AI' ? '🤖' : '👤'}</div>
                            <div class="crew-details">
                                <div class="crew-name">${c.name}</div>
                                <div class="crew-meta">GENDER: ${c.gender} | STATUS: ${c.status}</div>
                                <div class="crew-tags">${c.tags.join(' ')}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        document.body.appendChild(modal);
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
                                    ${item.onUse ? `<button class="action-btn" data-idx="${idx}" style="font-size: 0.7em; padding: 2px 5px; cursor: pointer; background: var(--color-primary); border: none; font-weight: bold;">USE</button>` : ''}
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
        if (item && item.onUse) {
            const msg = item.onUse(this.state);
            this.state.cargo.splice(index, 1); // Remove from inventory
            this.state.addLog(`Used ${item.name}: ${msg}`);
            this.state.emitUpdates();
        }
    }


    handleColonyAction() {
        // Generate Outcome based on Planet Metrics
        const planet = this.state.currentSystem;
        const outcome = EndingSystem.getColonyOutcome(planet);

        // Color code valid vs failed colonies
        const color = outcome.success ? '#00ff00' : '#ff4444';

        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100vw';
        overlay.style.height = '100vh';
        overlay.style.background = '#000';
        overlay.style.color = color;
        overlay.style.zIndex = '10000';
        overlay.style.display = 'flex';
        overlay.style.flexDirection = 'column';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.textAlign = 'center';

        overlay.innerHTML = `
            <h1 style="font-size: 3em; border-bottom: 2px solid ${color}; padding-bottom: 20px; margin-bottom: 40px;">/// SIMULATION CONCLUDED ///</h1>
            
            <div style="font-size: 1.2em; max-width: 800px; line-height: 1.6; text-align: left; background: rgba(20,20,20,0.8); padding: 40px; border: 1px solid ${color};">
                <div style="margin-bottom: 20px; font-weight: bold; border-bottom: 1px solid #333; padding-bottom: 10px;">
                    TARGET: ${planet.name} <br>
                    TYPE: ${planet.type}
                </div>
                
                <p>${outcome.text}</p>
                
                <div style="margin-top: 30px; font-style: italic; color: #fff; font-weight: bold;">
                    RESULT: ${outcome.title}
                </div>
            </div>

            <button onclick="location.reload()" style="margin-top: 60px; padding: 20px 40px; background: transparent; border: 2px solid ${color}; color: ${color}; font-size: 1.2em; cursor: pointer; font-family: 'Courier New', monospace;">
                REBOOT SIMULATION
            </button>
        `;

        document.body.appendChild(overlay);
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
}

// Start App when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
