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
                <h2 style="color: var(--color-primary); border-bottom: 2px solid var(--color-primary); padding-bottom: 10px; margin-bottom: 20px; max-width: 40%;">
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
                
                ${this.state.probeIntegrity > 0
                ? `<button class="cmd-btn" id="btn-probe">
                         <div>LAUNCH PROBE</div><div class="cost">Integrity: ${this.state.probeIntegrity.toFixed(0)}%</div>
                       </button>`
                : `<button class="cmd-btn danger" id="btn-probe" ${this.state.metals < 50 ? 'disabled' : ''}>
                         <div>${this.state.metals < 50 ? 'FABRICATE (NEED 50 METALS)' : 'FABRICATE PROBE'}</div>
                         <div class="cost">${this.state.metals < 50 ? 'INSUFFICIENT RESOURCES' : '-50 METALS'}</div>
                       </button>`
            }

                 <button class="cmd-btn" id="btn-eva" ${this.state.energy < 5 || planet.hasEva ? 'disabled' : ''}>
                    <div>${planet.hasEva ? 'MISSION COMPLETE' : 'DEPLOY EVA TEAM'}</div>
                    <div class="cost">${planet.hasEva ? 'LOGS ARCHIVED' : '-5 ENERGY / RISK'}</div>
                </button>

                <div style="margin-top: 20px; border-top: 1px dashed var(--color-primary-dim); padding-top: 20px;">
                    <button class="cmd-btn" id="btn-colony" style="border-color: #00ff00; color: #00ff00;">
                        <div>ESTABLISH COLONY</div><div class="cost">INITIATE STASIS</div>
                    </button>
                </div>

                <button class="cmd-btn danger" id="btn-leave" style="margin-top: auto;">
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

        rightPanel.querySelector('#btn-scan').addEventListener('click', () => window.dispatchEvent(new CustomEvent('req-action-scan')));
        rightPanel.querySelector('#btn-probe').addEventListener('click', () => window.dispatchEvent(new CustomEvent('req-action-probe')));

        const btnEva = rightPanel.querySelector('#btn-eva');
        if (btnEva) btnEva.addEventListener('click', () => window.dispatchEvent(new CustomEvent('req-action-eva')));

        const btnColony = rightPanel.querySelector('#btn-colony');
        if (btnColony) btnColony.addEventListener('click', () => window.dispatchEvent(new CustomEvent('req-action-colony')));

        const btnLeave = rightPanel.querySelector('#btn-leave');
        if (btnLeave) btnLeave.addEventListener('click', () => window.dispatchEvent(new Event('req-break-orbit')));
    }
}
