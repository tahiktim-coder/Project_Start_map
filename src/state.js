
export class GameState {
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
        // Ship Resources
        this.fuel = 100;
        this.oxygen = 100;
        this.energy = 100;
        this.metals = 0;

        // Systems
        this.probeIntegrity = 100; // Single reusable probe

        // Navigation
        this.currentSector = 1;
        this.currentSystem = null; // Will be set by Nav generation

        // Crew (Placeholder)
        this.crew = [
            { id: 1, name: 'Cmdr. Shepard', status: 'HEALTHY', tags: ['LEADER'] },
            { id: 2, name: 'Eng. Isaac', status: 'HEALTHY', tags: ['ENGINEER'] },
            { id: 3, name: 'Dr. Ripley', status: 'HEALTHY', tags: ['MEDIC'] },
            { id: 4, name: 'Spc. Vance', status: 'HEALTHY', tags: ['SECURITY'] },
            { id: 5, name: 'Bot TARS', status: 'HEALTHY', tags: ['AI'] }
        ];

        this.emitUpdates();
    }

    // --- Actions ---

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

    // --- Helpers ---

    emitUpdates() {
        window.dispatchEvent(new Event('hud-updated'));
    }
}
