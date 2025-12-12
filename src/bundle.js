
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

class OrbitView {
    constructor(state) {
        this.element = document.createElement('div');
        this.element.className = 'orbit-view-container';
        this.state = state;
    }

    render() {
        const planet = this.state.currentSystem;
        if (!planet) return `<div class="error">dERR: NO SYSTEM LOCK</div>`;

        const isDeepScanned = planet.scanned;
        const showStat = (key) => isDeepScanned || (planet.revealedStats && planet.revealedStats.includes(key));

        // Use pre-calculated metrics if available (legacy support if not)
        const metrics = planet.metrics || { gravity: 1, temp: 0, hasLife: false, hasTech: false };
        const hasLife = metrics.hasLife;
        const hasTech = metrics.hasTech;

        this.element.innerHTML = `
            <div style="padding: 20px; height: 100%; display: flex; flex-direction: column;">
                <h2 style="color: var(--color-primary); border-bottom: 2px solid var(--color-primary); padding-bottom: 10px; margin-bottom: 20px; max-width: 55%;">
                    /// ORBIT ESTABLISHED: ${planet.name}
                </h2>

                <div style="flex: 1; display: flex; flex-direction: row; align-items: stretch; gap: 20px;">
                    
                    <!-- LEFT: Data readout -->
                    <div style="width: 280px; display: flex; flex-direction: column; gap: 15px; border-right: 1px dashed var(--color-primary-dim); padding-right: 20px; overflow-y: auto;">
                        <div style="color: var(--color-accent); border-bottom: 1px solid var(--color-primary-dim); margin-bottom: 5px;">ENVIRONMENTAL READINGS</div>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                            <div style="color: var(--color-text-dim);">GRAVITY</div>
                            <div style="color: var(--color-primary); text-align: right;">${showStat('gravity') ? planet.gravity : '<span style="color:var(--color-accent)">UNKNOWN</span>'}</div>
                            
                            <div style="color: var(--color-text-dim);">ATMOSPHERE</div>
                            <div style="color: var(--color-primary); text-align: right;">${showStat('atmosphere') ? planet.atmosphere : '<span style="color:var(--color-accent)">UNKNOWN</span>'}</div>
                            
                            <div style="color: var(--color-text-dim);">TEMP</div>
                            <div style="color: var(--color-primary); text-align: right;">${showStat('temperature') ? planet.temperature : '<span style="color:var(--color-accent)">UNKNOWN</span>'}</div>
                        </div>

                        <!-- Scan Results Section -->
                        <div style="margin-top: 20px; color: var(--color-accent); border-bottom: 1px solid var(--color-primary-dim); margin-bottom: 5px;">
                            SURFACE ANALYSIS
                        </div>
                         ${planet.scanned
                ? `<div style="display: flex; flex-direction: column; gap: 8px;">
                                 <div><span style="color:var(--color-text-dim)">METALS:</span> <span style="color:var(--color-primary)">${planet.resources.metals > 50 ? 'RICH' : 'SCARCE'}</span></div>
                                 <div><span style="color:var(--color-text-dim)">ENERGY:</span> <span style="color:var(--color-primary)">${planet.resources.energy > 50 ? 'ABUNDANT' : 'LOW'}</span></div>
                                 
                                 <div style="margin-top: 10px; border-top: 1px dashed var(--color-primary-dim); padding-top: 5px;">
                                    <div><span style="color:var(--color-text-dim)">BIOSIGNATURES:</span> <span style="color:${hasLife ? 'var(--color-primary)' : 'var(--color-text-dim)'}">${hasLife ? 'DETECTED' : 'NEGATIVE'}</span></div>
                                    <div><span style="color:var(--color-text-dim)">TECHNOSIGNATURES:</span> <span style="color:${hasTech ? 'var(--color-accent)' : 'var(--color-text-dim)'}">${hasTech ? 'DETECTED' : 'NEGATIVE'}</span></div>
                                 </div>

                                 <div style="margin-top: 5px;">
                                    <div style="color:var(--color-text-dim); margin-bottom:4px">ANOMALIES:</div>
                                    ${planet.tags && planet.tags.length
                    ? planet.tags.map(t => `<span style="background:var(--color-primary-dim); color:#000; padding:2px 5px; font-size:0.8em; margin-right:5px; display:inline-block; margin-bottom:5px;">${t}</span>`).join('')
                    : '<span style="color:var(--color-text-dim); font-style:italic;">NONE DETECTED</span>'}
                                 </div>
                               </div>`
                : `<div style="color: var(--color-text-dim); font-style: italic; opacity: 0.5; margin-top: 20px;">
                                ... SENSORS OFFLINE ...
                               </div>`
            }
                    </div>

                    <!-- RIGHT: Visual -->
                    <div class="orbit-visual" style="flex: 1; display: flex; align-items: center; justify-content: center; position: relative;">
                        <div style="
                            width: 300px; height: 300px; 
                            border-radius: 50%; 
                            border: 2px solid var(--color-primary); 
                            box-shadow: 0 0 50px var(--color-primary-dim), inset 0 0 50px #000;
                            background: radial-gradient(circle at 30% 30%, ${this.getPlanetColor(planet.type)}, #000);
                            position: relative;
                        ">
                            <div style="position:absolute; top:-10px; left:-10px; right:-10px; bottom:-10px; border-radius:50%; box-shadow: 0 0 20px ${this.getPlanetColor(planet.type)}; opacity: 0.3;"></div>
                        </div>
                        <div class="ship-orbit-icon" style="
                            position: absolute; top: 50%; left: 50%; width: 400px; height: 400px; transform: translate(-50%, -50%);
                            border: 1px dashed var(--color-primary-dim); border-radius: 50%; animation: spin 20s linear infinite;
                        ">
                            <div style="width: 20px; height: 20px; background: var(--color-accent); border-radius: 50%; position: absolute; top: -10px; left: 50%; transform: translateX(-50%); box-shadow: 0 0 10px var(--color-accent);"></div>
                        </div>
                    </div>

                </div>
            </div>
        `;
        this.updateCommandDeck(planet);
        return this.element;
    }

    getPlanetColor(type) {
        switch (type) {
            case 'ROCKY': return '#8B4513';
            case 'GAS_GIANT': return '#DEB887';
            case 'ICE_WORLD': return '#00FFFF';
            case 'OCEANIC': return '#0000FF';
            case 'DESERT': return '#FFA500';
            case 'VOLCANIC': return '#FF4500';
            case 'TOXIC': return '#32CD32';
            case 'VITAL': return '#228B22';
            default: return '#555';
        }
    }

    updateCommandDeck(planet) {
        const rightPanel = document.getElementById('tactical-display');
        if (!rightPanel) return;

        rightPanel.innerHTML = `
             <div class="command-deck" style="display: flex; flex-direction: column; gap: 15px; height: 100%;">
                <div style="border-bottom: 2px solid var(--color-accent); padding-bottom: 5px; color: var(--color-accent);">COMMAND DECK</div>
                <button class="cmd-btn" id="btn-scan" ${this.state.energy < 2 || planet.scanned ? 'disabled' : ''}>
                    <div>${planet.scanned ? 'SYSTEM SCANNED' : 'DEEP SCAN'}</div>
                    <div class="cost">${planet.scanned ? 'ANALYSIS COMPLETE' : '-2 ENERGY'}</div>
                </button>
                <button class="cmd-btn" id="btn-probe" ${this.state.probeIntegrity <= 0 ? 'disabled' : ''}>
                    <div>LAUNCH PROBE</div><div class="cost">INTEGRITY RISK</div>
                </button>
                 <button class="cmd-btn" id="btn-eva" ${this.state.energy < 5 ? 'disabled' : ''}>
                    <div>DEPLOY EVA TEAM</div><div class="cost">-5 ENERGY / RISK</div>
                </button>
                <div style="flex: 1; border: 1px solid var(--color-primary-dim); background: rgba(0,0,0,0.3); padding: 10px; font-size: 0.8em; color: var(--color-text-dim);">
                    STATUS: ORBITAL LOCK STABLE.<br>AWAITING ORDERS.
                </div>
                <button class="cmd-btn danger" id="btn-leave">
                    <div>BREAK ORBIT</div><div class="cost">RETURN TO MAP</div>
                </button>
             </div>
        `;

        const style = document.createElement('style');
        style.innerHTML = `
            .cmd-btn { background: transparent; border: 1px solid var(--color-primary); color: var(--color-primary); padding: 15px; text-align: left; cursor: pointer; font-family: var(--font-display); transition: all 0.2s; display: flex; justify-content: space-between; align-items: center; }
            .cmd-btn:hover:not([disabled]) { background: var(--color-primary); color: #000; }
            .cmd-btn:disabled { border-color: #333; color: #333; cursor: not-allowed; }
            .cmd-btn.danger { border-color: var(--color-accent); color: var(--color-accent); }
            .cmd-btn.danger:hover { background: var(--color-accent); color: #000; }
            .cost { font-size: 0.7em; opacity: 0.7; }
            @keyframes spin { 100% { transform: translate(-50%, -50%) rotate(360deg); } }
        `;
        rightPanel.appendChild(style);

        rightPanel.querySelector('#btn-scan').addEventListener('click', () => this.handleScan());
        rightPanel.querySelector('#btn-probe').addEventListener('click', () => this.handleProbe());
        rightPanel.querySelector('#btn-eva').addEventListener('click', () => this.handleEVA());
        rightPanel.querySelector('#btn-leave').addEventListener('click', () => window.dispatchEvent(new Event('req-break-orbit')));
    }

    handleScan() { window.dispatchEvent(new CustomEvent('req-action-scan')); }
    handleProbe() { window.dispatchEvent(new CustomEvent('req-action-probe')); }
    handleEVA() { window.dispatchEvent(new CustomEvent('req-action-eva')); }
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
        window.addEventListener('log-updated', (e) => this.handleLogUpdate(e));
        window.addEventListener('hud-updated', () => this.updateHud());

        // Header Interactions
        document.getElementById('res-crew').parentElement.onclick = () => this.showCrewManifest();

        window.addEventListener('req-warp', (e) => this.handleWarp(e.detail));
        window.addEventListener('req-sector-jump', () => this.handleSectorJump());
        window.addEventListener('req-break-orbit', () => this.renderNav());

        window.addEventListener('req-action-scan', () => this.handleScanAction());
        window.addEventListener('req-action-probe', () => this.handleProbeAction());
        window.addEventListener('req-action-eva', () => this.handleEvaAction());
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
            this.renderOrbit();
        }
    }

    handleProbeAction() {
        this.state.addLog("Probe launched... (Functionality Pending)");
    }

    handleEvaAction() {
        if (this.state.consumeEnergy(5)) {
            this.state.addLog("EVA Team deployed... (Functionality Pending)");
        }
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
        document.getElementById('res-probe').textContent = `${this.state.probeIntegrity}%`;
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
        cargoEl.textContent = `${this.state.cargo.length}`;
        // Ensure event listener is attached (idempotent)
        cargoEl.parentElement.onclick = () => this.showCargoInventory();
        cargoEl.parentElement.style.cursor = 'pointer';
        document.getElementById('res-crew').parentElement.style.cursor = 'pointer';
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
                : this.state.cargo.map(item => `
                            <div class="inv-item">
                                <div class="item-name">${item.name}</div>
                                <div class="item-qty">x${item.qty || 1}</div>
                            </div>
                        `).join('')}
                </div>
                <div style="margin-top: 20px; text-align: right; font-size: 0.8em; color: var(--color-primary-dim);">
                    CAPACITY: ${this.state.cargo.length}/20 UNITS
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.querySelector('.close-modal').onclick = () => modal.remove();
        modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
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
