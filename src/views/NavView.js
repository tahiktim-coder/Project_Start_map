class NavView {
    constructor(state) {
        this.element = document.createElement('div');
        this.element.className = 'nav-view-container';
        this.element.style.height = '100%';
        this.element.style.width = '100%';
        this.state = state;
    }

    render(systems) {
        if (!systems || systems.length === 0) {
            this.element.innerHTML = `<div class="loading-state">WARPING TO NEW SECTOR...</div>`;
            return this.element;
        }

        const nodesHtml = systems.map(planet => {
            // Safety fallback if mapData missing
            const x = planet.mapData ? planet.mapData.x : Math.floor(Math.random() * 80) + 10;
            const y = planet.mapData ? planet.mapData.y : Math.floor(Math.random() * 80) + 10;

            // Use the same classes as OrbitView but scaled down via CSS or inline style override?
            // BETTER: Use a specific class 'nav-planet' that reuses the background/box-shadow but forces size.
            // We will add 'planet-visual' class but also 'nav-node-visual' to override size.

            // NOTE: We need to set the color var for the text/border interaction or rely on CSS.
            // For now, let's keep the border color logic for hover states, but use the class for the visual.
            const color = this.getPlanetColor(planet.type);

            return `
            <div class="nav-node" data-id="${planet.id}" 
                 style="position: absolute; left: ${x}%; top: ${y}%; transform: translate(-50%, -50%);
                        width: 40px; height: 40px; cursor: pointer; display: flex; align-items: center; justify-content: center;
                        z-index: 10; transition: all 0.3s ease;">
                
                <!-- The Miniature Planet Visual -->
                <!-- We reuse 'planet-visual' to get the gradients, and 'type-${planet.type}' -->
                <!-- We override the size and animation locally or via a helper class -->
                <div class="planet-visual type-${planet.type} nav-miniature" 
                     style="width: 100%; height: 100%; animation-duration: 10s;"> <!-- Faster spin for small feels cute? or slower? -->
                </div>
                
                <!-- Label -->
                <div class="nav-label" style="position: absolute; top: 45px; white-space: nowrap; color: ${color}; 
                            font-size: 10px; font-family: var(--font-mono); text-shadow: 0 0 5px #000; pointer-events: none; opacity: 0.8;">
                    ${planet.name}
                </div>
            </div>`;
        }).join('');

        this.element.innerHTML = `
            <div style="padding: 20px; height: 100%; display: flex; flex-direction: column;">
                <div style="display: flex; justify-content: space-between; align-items: end; border-bottom: 2px solid var(--color-primary); padding-bottom: 10px; margin-bottom: 20px;">
                    <h2 style="color: var(--color-primary); margin:0;">/// SECTOR NAVIGATION MAP</h2>
                    <button id="jump-sector-btn" style="background: transparent; border: 1px solid var(--color-accent); color: var(--color-accent); padding: 5px 15px; cursor: pointer; font-family: var(--font-mono);">
                        >> JUMP SECTOR (-20 ENERGY)
                    </button>
                </div>
                
                <div class="sector-map-container sector-map-bg" style="flex: 1; border: 1px solid var(--color-primary-dim); position: relative; overflow: hidden;">
                    ${nodesHtml}
                    <!-- Scanner Bar Animation -->
                    <div class="scanner-bar" style="position: absolute; top: 0; left: 0; width: 2px; height: 100%; background: linear-gradient(to bottom, transparent, var(--color-primary), transparent); opacity: 0.5; box-shadow: 0 0 10px var(--color-primary); animation: scan 8s linear infinite; pointer-events: none; z-index: 5;"></div>
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

            // Logic for visual feedback on hover
            const label = node.querySelector('.nav-label');

            node.addEventListener('mouseenter', () => {
                node.style.zIndex = '20';
                node.style.transform = node.style.transform.replace('scale(1)', '') + ' scale(1.5)'; // Pop effect
                if (label) {
                    label.style.opacity = '1';
                    label.style.fontWeight = 'bold';
                    label.style.textShadow = '0 0 8px var(--color-primary)';
                    label.style.zIndex = '30';
                }
            });
            node.addEventListener('mouseleave', () => {
                node.style.zIndex = '10';
                node.style.transform = node.style.transform.replace(' scale(1.5)', ''); // Revert pop
                if (label) {
                    label.style.opacity = '0.8';
                    label.style.fontWeight = 'normal';
                    label.style.textShadow = '0 0 5px #000';
                    label.style.zIndex = 'auto';
                }
            });

            node.addEventListener('click', () => {
                this.handlePlanetSelect(data);
            });
        });
    }

    getPlanetColor(type) {
        if (type === 'ROCKY') return '#b0b0b0';
        if (type === 'GAS_GIANT') return '#ffcc00';
        if (type === 'ICE_WORLD') return '#00ffff';
        if (type === 'OCEANIC') return '#0066ff';
        if (type === 'DESERT') return '#ff9933';
        if (type === 'VOLCANIC') return '#ff3300';
        if (type === 'TOXIC') return '#99cc33';
        if (type === 'VITAL') return '#33ff33';

        // Unique Types
        if (type === 'BIO_MASS') return '#ff00ff';     // Magenta
        if (type === 'MECHA') return '#c0c0c0';        // Silver
        if (type === 'SHATTERED') return '#cc0000';    // Deep Red
        if (type === 'TERRAFORMED') return '#00ffcc';  // Teal
        if (type === 'CRYSTALLINE') return '#e0ffff';  // Light Cyan (Ice/Crystal)
        if (type === 'ROGUE') return '#330066';        // Dark Indigo

        return '#aaaaaa';
    }

    handlePlanetSelect(planet) {
        window.dispatchEvent(new CustomEvent('planet-selected', { detail: planet }));
        const panel = document.getElementById('tactical-display');
        if (!panel) return;

        // Reuse the logic from the Legacy/Card view for the details panel
        // Hidden Stats Logic
        const isDeepScanned = planet.scanned;
        const isRemoteScanned = planet.remoteScanned;
        const showStat = (key) => isDeepScanned || (isRemoteScanned && planet.revealedStats && planet.revealedStats.includes(key));
        const tagsHtml = isDeepScanned && planet.tags && planet.tags.length > 0
            ? planet.tags.map(t => `<span style="background: var(--color-primary-dim); color: #000; padding: 2px 4px; border-radius: 2px; font-size: 0.8em; margin-right: 5px;">${t}</span>`).join('')
            : (isDeepScanned ? '<span style="color: var(--color-text-dim);">NO ANOMALIES DETECTED</span>' : '<span style="color: var(--color-text-dim);">UNKNOWN</span>');
        const gravDisplay = showStat('gravity') ? planet.gravity : '<span style="color:var(--color-accent)">UNKNOWN</span>';
        const tempDisplay = showStat('temperature') ? planet.temperature : '<span style="color:var(--color-accent)">UNKNOWN</span>';
        const atmoDisplay = showStat('atmosphere') ? planet.atmosphere : '<span style="color:var(--color-accent)">UNKNOWN</span>';
        const actualCost = (this.state.lastVisitedSystem && this.state.lastVisitedSystem.id === planet.id) ? 0 : planet.fuelCost;

        panel.innerHTML = `
            <div class="tactical-card" style="width: 100%; height: 100%; display: flex; flex-direction: column;">
                <div style="border: 1px solid var(--color-primary); height: 150px; display: flex; align-items: center; justify-content: center; background: rgba(0,255,0,0.05); margin-bottom: 20px; position: relative; overflow: visible;">
                    <div class="planet-visual type-${planet.type}" style="width: 100px; height: 100px;"></div>
                    <div style="position: absolute; top:0; left:0; width:100%; height:100%; background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%); background-size: 100% 4px; pointer-events: none; opacity: 0.3;"></div>
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
