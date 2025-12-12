import { GameState } from './state.js';
import { NavView } from './views/navView.js';
import { OrbitView } from './views/orbitView.js';
import { PlanetGenerator } from './generators/planet.js';

class App {
    constructor() {
        this.state = GameState.getInstance();
        this.navView = new NavView(this.state);
        this.orbitView = new OrbitView(this.state);

        this.init();
    }

    init() {
        console.log("Exodus-1 Systems Initializing...");

        // Setup Event Listeners
        window.addEventListener('log-updated', (e) => this.handleLogUpdate(e));
        window.addEventListener('hud-updated', () => this.updateHud());

        // Navigation Events
        window.addEventListener('req-warp', (e) => this.handleWarp(e.detail));
        window.addEventListener('req-sector-jump', () => this.handleSectorJump());
        window.addEventListener('req-break-orbit', () => this.renderNav());

        // Action Events (Placeholders)
        window.addEventListener('req-action-scan', () => this.handleScanAction());
        window.addEventListener('req-action-probe', () => this.handleProbeAction());
        window.addEventListener('req-action-eva', () => this.handleEvaAction());

        // Initialize State
        this.state.init();

        // Generate Starting Sector
        this.state.sectorNodes = PlanetGenerator.generateSector(1);
        this.state.addLog("Sector 1 Map Generated.");

        // Initial Render
        this.renderNav();

        this.state.addLog("System Init Complete. Awaiting Navigation Input.");
    }

    handleWarp(planet) {
        if (this.state.consumeEnergy(planet.fuelCost)) {
            this.state.addLog(`Warping to ${planet.name}...`);
            this.state.currentSystem = planet;

            // In a real app, we would transition to Orbit View here.
            // For now, we simulate success and log it.
            this.state.addLog(`Orbit established around ${planet.name}. ready for scan.`);

            // Visual feedback
            const rightPanel = document.getElementById('tactical-display');
            if (rightPanel) rightPanel.innerHTML += `<div style="text-align:center; color: var(--color-primary); margin-top:10px;">>> ORBIT ESTABLISHED</div>`;
        }
    }

    handleSectorJump() {
        if (this.state.consumeEnergy(20)) {
            this.state.addLog("Initiating Sector Jump...");
            this.state.sectorNodes = PlanetGenerator.generateSector(this.state.currentSector + 1);
            this.state.currentSector++;
            this.renderNav();
            this.state.addLog(`Sector ${this.state.currentSector} Generated.`);
        }
    }

    // --- Action Handlers (Placeholders) ---
    handleScanAction() {
        if (this.state.consumeEnergy(2)) {
            this.state.addLog("Scanning planet surface...");
            this.state.currentSystem.scanned = true;
            this.state.addLog("Scan Complete: Data saved to ship log.");
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

        // Use the detail message or last log from state
        const msg = e.detail?.message || "Log Updated";

        const entry = document.createElement('div');
        entry.className = 'log-entry new';
        entry.textContent = msg;

        logContainer.appendChild(entry);

        // Auto scroll to bottom
        logContainer.scrollTop = logContainer.scrollHeight;
    }

    updateHud() {
        // Update Header Resources
        document.getElementById('res-energy').textContent = `${this.state.energy}%`;
        document.getElementById('res-oxygen').textContent = `${this.state.oxygen}%`;
        // document.getElementById('res-metals').textContent = `${this.state.metals}`; // Might not be initialized yet?
        document.getElementById('res-probe').textContent = `${this.state.probeIntegrity}%`;

        const crewCount = this.state.crew.filter(c => c.status !== 'DEAD').length;
        document.getElementById('res-crew').textContent = `${crewCount}/${this.state.crew.length}`;

        document.getElementById('game-date').textContent = `DATE: 2342.05.${12 + this.state.currentSector}`;
    }

    renderNav() {
        const mainView = document.getElementById('main-view');
        mainView.innerHTML = '';
        mainView.appendChild(this.navView.render(this.state.sectorNodes));

        // Clear Right Panel or set to default
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
