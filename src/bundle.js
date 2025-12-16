
/**
 * BUNDLED APPLICATION FOR LOCAL EXECUTION
 * Merged to bypass ES Module CORS restrictions on file:// protocol.
 */

// --- 1. DATA & GENERATORS ---

class CrewGenerator {
    static FIRST_NAMES = [
        "Jace", "Lyra", "Kael", "Mira", "Oren", "Zara", "Thorn", "Elara", "Jax", "Nia",
        "Rian", "Cora", "Vane", "Sola", "Kian", "Eris", "Dax", "Luna", "Torin", "Vega"
    ];

    static LAST_NAMES = [
        "Vance", "Ryder", "Stark", "Chen", "Novak", "Price", "Vega", "Solos", "Thorne", "Cross",
        "Moon", "Strider", "Frey", "Wong", "Sato", "Khan", "Webb", "Mercer", "Cole", "Reid"
    ];


    static ROLES = [
        { name: "Cmdr.", tag: "LEADER" },
        { name: "Eng.", tag: "ENGINEER" },
        { name: "Dr.", tag: "MEDIC" },
        { name: "Spc.", tag: "SECURITY" },
        { name: "Tech", tag: "SPECIALIST" }
    ];

    static generateCrew(count = 5) {
        let crew = [];
        // Ensure one Commander
        crew.push(this.createmember('Cmdr.', 'LEADER'));
        // Fill rest
        for (let i = 1; i < count; i++) {
            const role = this.ROLES[Math.floor(Math.random() * (this.ROLES.length - 1)) + 1];
            crew.push(this.createmember(role.name, role.tag));
        }
        return crew;
    }

    static createmember(prefix, tag) {
        const first = this.FIRST_NAMES[Math.floor(Math.random() * this.FIRST_NAMES.length)];
        const last = this.LAST_NAMES[Math.floor(Math.random() * this.LAST_NAMES.length)];
        const gender = Math.random() > 0.5 ? 'M' : 'F';
        // Random Age 25-50
        const age = Math.floor(Math.random() * 25) + 25;

        return {
            id: Date.now() + Math.random(),
            name: `${prefix} ${last}`,
            realName: `${first} ${last}`,
            gender: gender,
            age: age,
            // 1-5 for each gender. User needs M_1.png ... M_5.png and F_1.png ... F_5.png
            portraitId: `${gender}_${Math.floor(Math.random() * 5) + 1}`,
            status: 'HEALTHY',
            tags: [tag]
        };
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
        this.metals = 50; // Start with minimal for 1 probe
        this.maxMetals = 300; // Cap at 300 (User Request)
        this.probeIntegrity = 100;
        this.cargo = []; // Added Cargo
        this.upgrades = []; // INSTALLED MODULES

        this.currentSector = 1;
        this.currentSystem = null;
        this.lastVisitedSystem = null; // Added for 0-cost return logic

        this.crew = CrewGenerator.generateCrew(5);

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

        if (window.AudioSystem) window.AudioSystem.init();

        window.addEventListener('log-updated', (e) => this.handleLogUpdate(e));

        window.addEventListener('hud-updated', () => this.updateHud());

        // Audio Toggle
        const btnAudio = document.getElementById('btn-audio');
        if (btnAudio) {
            btnAudio.onclick = () => {
                if (window.AudioSystem) {
                    const isMuted = window.AudioSystem.toggleMute();
                    btnAudio.textContent = isMuted ? "AUDIO: OFF" : "AUDIO: ON";
                    btnAudio.style.opacity = isMuted ? "0.5" : "1";
                }
            };
        }

        // Header Interactions
        document.getElementById('res-crew').parentElement.onclick = () => this.showCrewManifest();
        const fabBtn = document.getElementById('btn-fab');
        if (fabBtn) fabBtn.onclick = () => this.showFabricator();

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

            // UPGRADE: Autodoc Medbay
            if (this.state.upgrades.includes('autodoc')) {
                let healed = false;
                this.state.crew.forEach(c => {
                    if (c.status === 'INJURED' || c.status.indexOf('(-') > -1) {
                        c.status = 'HEALTHY';
                        healed = true;
                    }
                });
                if (healed) this.state.addLog("Autodoc: Crew injuries stabilized during transit.");
            }

            // UPGRADE: Fuel Scoop
            if (this.state.upgrades.includes('fuel_scoop') && (planet.type === 'GAS_GIANT' || planet.type === 'NEBULA')) {
                const scoop = Math.floor(Math.random() * 5) + 5;
                this.state.fuel = Math.min(100, this.state.fuel + scoop);
                this.state.addLog(`Bussard Scoop: Harvested ${scoop} Fuel from atmosphere.`);
            }

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
                // Randomly reveal 1-2 stats if not already done
                if (!data.revealedStats || data.revealedStats.length === 0) {
                    if (this.state.upgrades.includes('sensor_v2')) {
                        data.revealedStats = ['gravity', 'temperature', 'atmosphere', 'dangerLevel'];
                        this.state.addLog("Sensor Array: Detailed scan analysis complete.");
                    } else {
                        const count = Math.random() > 0.7 ? 2 : 1;
                        const options = ['gravity', 'temperature', 'atmosphere'];
                        const shuffled = options.sort(() => 0.5 - Math.random());
                        data.revealedStats = shuffled.slice(0, count);
                    }
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

        // Use new System for Logic
        const result = ProbeSystem.performProbe(planet, this.state.probeIntegrity);

        // Apply Results
        this.state.probeIntegrity = Math.max(0, this.state.probeIntegrity - result.integrityLoss);

        if (result.reward) {
            if (result.reward.type === 'ITEM') {
                const item = { ...result.reward.data, acquiredAt: planet.name };
                this.state.cargo.push(item);
            } else if (result.reward.type === 'RESOURCE') {
                if (result.reward.resource === 'metals') {
                    const old = this.state.metals;
                    this.state.metals = Math.min(this.state.maxMetals, this.state.metals + result.reward.amount);
                    if (this.state.metals === this.state.maxMetals && old < this.state.maxMetals) {
                        this.state.addLog("STORAGE WARNING: Metal capacity reached!");
                    }
                }
                if (result.reward.resource === 'energy') this.state.energy = Math.min(100, this.state.energy + result.reward.amount);
            }
        }

        this.state.addLog(result.message);
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
                const old = this.state.metals;
                this.state.metals = Math.min(this.state.maxMetals, this.state.metals + amount);
                logMsg += `Recovered ${amount} Metals.`;
                if (this.state.metals === this.state.maxMetals && old < this.state.maxMetals) {
                    logMsg += " (Storage Cap Reached)";
                }
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
        entry.innerHTML = msg; // Enable HTML for colors
        logContainer.appendChild(entry);

        // Auto scroll force
        requestAnimationFrame(() => {
            logContainer.scrollTop = logContainer.scrollHeight;
        });
    }

    updateHud() {
        document.getElementById('res-energy').textContent = `${this.state.energy}%`;
        document.getElementById('res-oxygen').textContent = `${this.state.oxygen}%`;

        // Show Cap
        const m = this.state.metals;
        const max = this.state.maxMetals;
        const el = document.getElementById('res-metals');
        el.textContent = `${m}/${max}`;
        if (m >= max) el.style.color = '#ffaa00';
        else el.style.color = 'var(--color-primary)';

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
                    ${this.state.crew.map(c => {
            const color = c.status === 'DEAD' ? '#ff4444' : (c.status.includes('INJURED') ? '#ffaa00' : 'var(--color-primary)');
            const borderColor = c.status === 'DEAD' ? '#ff4444' : 'var(--color-primary-dim)';
            return `
                        <div class="crew-card" style="border: 1px solid ${borderColor}; color: ${color};">
                            <div class="crew-icon" style="overflow: hidden; display: flex; align-items: center; justify-content: center; background: #000; filter: drop-shadow(0 0 5px ${color});">
                                <img src="assets/crew/${c.portraitId || 1}.png" 
                                     style="width: 100%; height: 100%; object-fit: cover;"
                                     onerror="this.style.display='none'; this.parentNode.innerHTML='${c.gender === 'AI' ? '🤖' : '👤'}';">
                            </div>
                            <div class="crew-details">
                                <div class="crew-name">${c.realName || c.name} <span style="font-size:0.7em; opacity:0.7;">(${c.name})</span></div>
                                <div class="crew-meta" style="color: ${color}; opacity: 0.8;">AGE: ${c.age || 'N/A'} | STATUS: ${c.status}</div>
                                <div class="crew-tags">${c.tags.join(' ')}</div>
                            </div>
                        </div>
                    `;
        }).join('')}
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

                // Apply Revival
                if (item.type === 'REVIVAL_BIO') {
                    target.status = 'SYMBIOTE';
                    target.tags.push('HIVE_MIND');
                    this.state.addLog(`SUBJECT ${target.name} REANIMATED (BIOLOGICAL INTEGRATION).`);
                } else {
                    target.status = 'CYBORG_HUSK';
                    target.tags.push('MACHINE_LINK');
                    this.state.addLog(`SUBJECT ${target.name} REANIMATED (NEURAL OVERRIDE).`);
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
        // Generate Outcome based on Planet Metrics
        const planet = this.state.currentSystem;
        const outcome = EndingSystem.getColonyOutcome(planet);

        if (outcome.success && window.AudioSystem) {
            window.AudioSystem.sfxVictory();
        }

        // Color code valid vs failed colonies
        const color = outcome.success ? '#00ff00' : '#ff4444';
        const survivors = this.state.crew.filter(c => c.status !== 'DEAD').length;
        const totalCrew = 5;

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
        overlay.style.fontFamily = "'Share Tech Mono', monospace";

        overlay.innerHTML = `
            <div style="width: 800px; max-width: 90vw; border: 2px solid ${color}; padding: 2px;">
                <div style="background: ${color}; color: #000; padding: 5px 10px; font-weight: bold; display: flex; justify-content: space-between;">
                    <span>/// FLIGHT RECORDER: EXODUS-1</span>
                    <span>STATUS: TERMINATED</span>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; padding: 20px; border-bottom: 1px solid ${color}; opacity: 0.8; font-size: 0.9em;">
                    <div>TARGET: ${planet.name}</div>
                    <div>TYPE: ${planet.type}</div>
                    <div>DATE: 2342.05.${Math.floor(this.state.fuel)}</div> <!-- Fake Date progression -->
                    <div>SURVIVORS: ${survivors}/${totalCrew}</div>
                    <div>METALS: ${this.state.metals}</div>
                    <div>UPGRADES: ${this.state.upgrades.length}</div>
                </div>

                <div style="padding: 40px; font-size: 1.1em; line-height: 1.6; height: 300px; overflow-y: auto;">
                    ${outcome.text}
                </div>

                <div style="border-top: 1px solid ${color}; padding: 20px; text-align: center; font-size: 1.5em; font-weight: bold; letter-spacing: 2px;">
                    RESULT: ${outcome.title}
                </div>
            </div>

            <button onclick="location.reload()" style="margin-top: 30px; padding: 15px 30px; background: transparent; border: 1px solid ${color}; color: ${color}; font-size: 1em; cursor: pointer; font-family: inherit; hover: { background: ${color}; color: #000; }">
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

    showFabricator() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content" style="border-color: var(--color-accent);">
                <div class="modal-header" style="color: var(--color-accent);">/// FABRICATOR MODULE /// <span class="close-modal">[X]</span></div>
                <div class="inventory-grid">
                    ${Object.values(UPGRADES).map(upg => {
            const installed = this.state.upgrades.includes(upg.id);
            const canAfford = this.state.metals >= upg.cost;
            const btnText = installed ? "INSTALLED" : (canAfford ? `BUY (${upg.cost})` : `MISSING METALS (${upg.cost})`);
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
                <div style="margin-top: 20px; text-align: right; color: var(--color-primary);">AVAILABLE METALS: ${this.state.metals}</div>
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
        if (upg && this.state.metals >= upg.cost) {
            this.state.metals -= upg.cost;
            this.state.upgrades.push(id);
            this.state.addLog(`FABRICATION COMPLETE: ${upg.name} installed.`);
            if (window.AudioSystem) window.AudioSystem.sfxInteract(); // Re-use interact sfx

            // Refresh
            modal.remove();
            this.showFabricator();
            this.state.emitUpdates();
        }
    }
}

// Start App when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
