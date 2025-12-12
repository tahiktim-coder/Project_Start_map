export class OrbitView {
    constructor(state) {
        this.element = document.createElement('div');
        this.element.className = 'orbit-view-container';
        this.state = state;
    }

    render() {
        const planet = this.state.currentSystem;
        if (!planet) return `<div class="error">dERR: NO SYSTEM LOCK</div>`;

        this.element.innerHTML = `
            <div style="padding: 20px; height: 100%; display: flex; flex-direction: column;">
                <h2 style="color: var(--color-primary); border-bottom: 2px solid var(--color-primary); padding-bottom: 10px; margin-bottom: 20px;">
                    /// ORBIT ESTABLISHED: ${planet.name}
                </h2>

                <div class="orbit-visual" style="flex: 1; display: flex; align-items: center; justify-content: center; position: relative;">
                    <!-- Big Planet Visual -->
                    <div style="
                        width: 300px; height: 300px; 
                        border-radius: 50%; 
                        border: 2px solid var(--color-primary); 
                        box-shadow: 0 0 50px var(--color-primary-dim), inset 0 0 50px #000;
                        background: radial-gradient(circle at 30% 30%, ${this.getPlanetColor(planet.type)}, #000);
                        position: relative;
                    ">
                         <!-- Atmosphere Glow -->
                         <div style="position:absolute; top:-10px; left:-10px; right:-10px; bottom:-10px; border-radius:50%; box-shadow: 0 0 20px ${this.getPlanetColor(planet.type)}; opacity: 0.3;"></div>
                    </div>

                    <!-- Orbiting Ship Icon (Animation) -->
                    <div class="ship-orbit-icon" style="
                        position: absolute;
                        top: 50%; left: 50%;
                        width: 400px; height: 400px;
                        transform: translate(-50%, -50%);
                        border: 1px dashed var(--color-primary-dim);
                        border-radius: 50%;
                        animation: spin 20s linear infinite;
                    ">
                        <div style="width: 20px; height: 20px; background: var(--color-accent); border-radius: 50%; position: absolute; top: -10px; left: 50%; transform: translateX(-50%); box-shadow: 0 0 10px var(--color-accent);"></div>
                    </div>
                </div>

                <div class="orbit-status" style="margin-top: 20px; border-top: 1px solid var(--color-primary-dim); padding-top: 10px; display: flex; justify-content: space-between;">
                    <div>
                        <div style="color: var(--color-text-dim); font-size: 0.8em;">GRAVITY WELL</div>
                        <div style="color: var(--color-primary);">${planet.gravity}</div>
                    </div>
                     <div>
                        <div style="color: var(--color-text-dim); font-size: 0.8em;">ATMOSPHERE</div>
                        <div style="color: var(--color-primary);">${planet.atmosphere}</div>
                    </div>
                     <div>
                        <div style="color: var(--color-text-dim); font-size: 0.8em;">TEMP</div>
                        <div style="color: var(--color-primary);">${planet.temperature}</div>
                    </div>
                </div>
            </div>
        `;

        // Update Right Panel for Command Deck
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
                
                <button class="cmd-btn" id="btn-scan" ${this.state.energy < 2 ? 'disabled' : ''}>
                    <div>DEEP SCAN</div>
                    <div class="cost">-2 ENERGY</div>
                </button>

                <button class="cmd-btn" id="btn-probe" ${this.state.probeIntegrity <= 0 ? 'disabled' : ''}>
                    <div>LAUNCH PROBE</div>
                    <div class="cost">INTEGRITY RISK</div>
                </button>

                 <button class="cmd-btn" id="btn-eva" ${this.state.energy < 5 ? 'disabled' : ''}>
                    <div>DEPLOY EVA TEAM</div>
                    <div class="cost">-5 ENERGY / RISK</div>
                </button>

                <div style="flex: 1; border: 1px solid var(--color-primary-dim); background: rgba(0,0,0,0.3); padding: 10px; font-size: 0.8em; color: var(--color-text-dim);">
                    STATUS: ORBITAL LOCK STABLE.<br>
                    AWAITING ORDERS.
                </div>

                <button class="cmd-btn danger" id="btn-leave">
                    <div>BREAK ORBIT</div>
                    <div class="cost">RETURN TO MAP</div>
                </button>
             </div>
        `;

        // Styles for these buttons (inline for now)
        const style = document.createElement('style');
        style.innerHTML = `
            .cmd-btn {
                background: transparent;
                border: 1px solid var(--color-primary);
                color: var(--color-primary);
                padding: 15px;
                text-align: left;
                cursor: pointer;
                font-family: var(--font-display);
                transition: all 0.2s;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .cmd-btn:hover:not([disabled]) {
                background: var(--color-primary);
                color: #000;
            }
            .cmd-btn:disabled {
                border-color: #333;
                color: #333;
                cursor: not-allowed;
            }
            .cmd-btn.danger {
                border-color: var(--color-accent);
                color: var(--color-accent);
            }
            .cmd-btn.danger:hover {
                background: var(--color-accent);
                color: #000;
            }
            .cost {
                font-size: 0.7em;
                opacity: 0.7;
            }
            @keyframes spin { 100% { transform: translate(-50%, -50%) rotate(360deg); } }
        `;
        rightPanel.appendChild(style);

        // Event Listeners
        rightPanel.querySelector('#btn-scan').addEventListener('click', () => this.handleScan());
        rightPanel.querySelector('#btn-probe').addEventListener('click', () => this.handleProbe());
        rightPanel.querySelector('#btn-eva').addEventListener('click', () => this.handleEVA());
        rightPanel.querySelector('#btn-leave').addEventListener('click', () => window.dispatchEvent(new Event('req-break-orbit')));
    }

    handleScan() {
        window.dispatchEvent(new CustomEvent('req-action-scan'));
    }
    handleProbe() {
        window.dispatchEvent(new CustomEvent('req-action-probe'));
    }
    handleEVA() {
        window.dispatchEvent(new CustomEvent('req-action-eva'));
    }
}
