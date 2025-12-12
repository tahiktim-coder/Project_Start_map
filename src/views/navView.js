export class NavView {
    constructor(state) {
        this.element = document.createElement('div');
        this.element.className = 'nav-view-container';
        this.state = state; // Access global state if passed, or use Singleton inside
    }

    render(systems) {
        if (!systems || systems.length === 0) {
            this.element.innerHTML = `<div class="loading-state">WARPING TO NEW SECTOR...</div>`;
            return this.element;
        }

        // Generate Cards HTML
        const gridContent = systems.map(planet => `
            <div class="nav-node" data-id="${planet.id}" style="border: 1px solid var(--color-primary-dim); padding: 15px; cursor: pointer; transition: all 0.2s; background: rgba(0,255,0,0.05); position: relative;">
                <div style="font-size: 10px; color: var(--color-primary-dim); margin-bottom: 5px;">COORDS: [${Math.floor(Math.random() * 999)}:${Math.floor(Math.random() * 999)}]</div>
                <h3 style="color: var(--color-primary); margin-bottom: 5px; font-family: var(--font-display);">${planet.name}</h3>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
                    <span style="color: var(--color-text-dim); font-size: 0.9em;">TYPE: ${planet.type}</span>
                    <span style="color: var(--color-accent); font-size: 0.9em;">⚠ LVL ${planet.dangerLevel}</span>
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
        // Sector Jump
        const jumpBtn = this.element.querySelector('#jump-sector-btn');
        if (jumpBtn) {
            jumpBtn.addEventListener('click', () => {
                window.dispatchEvent(new CustomEvent('req-sector-jump'));
            });
        }

        // Planet Hover/Click
        this.element.querySelectorAll('.nav-node').forEach(node => {
            const id = node.getAttribute('data-id');
            const data = systems.find(p => p.id === id);

            // Hover: Glow
            node.addEventListener('mouseenter', () => {
                node.style.boxShadow = '0 0 15px var(--color-primary-dim)';
                node.style.borderColor = 'var(--color-primary)';
            });
            node.addEventListener('mouseleave', () => {
                node.style.boxShadow = 'none';
                node.style.borderColor = 'var(--color-primary-dim)';
            });

            // Click: Update Right Panel + Select Logic
            node.addEventListener('click', () => {
                this.handlePlanetSelect(data);
            });
        });
    }

    handlePlanetSelect(planet) {
        // Broadcast selection
        window.dispatchEvent(new CustomEvent('planet-selected', { detail: planet }));

        const panel = document.getElementById('tactical-display');
        if (!panel) return;

        // Dynamic Tag Rendering
        const tagsHtml = planet.tags && planet.tags.length > 0
            ? planet.tags.map(t => `<span style="background: var(--color-primary-dim); color: #000; padding: 2px 4px; border-radius: 2px; font-size: 0.8em; margin-right: 5px;">${t}</span>`).join('')
            : '<span style="color: var(--color-text-dim);">NO ANOMALIES DETECTED</span>';

        panel.innerHTML = `
            <div class="tactical-card" style="width: 100%; height: 100%; display: flex; flex-direction: column;">
                <div style="border: 1px solid var(--color-primary); height: 150px; display: flex; align-items: center; justify-content: center; background: rgba(0,255,0,0.05); margin-bottom: 20px; position: relative; overflow: hidden;">
                    <!-- Placeholder Planet Visual -->
                    <div style="width: 80px; height: 80px; border-radius: 50%; border: 2px solid var(--color-primary); box-shadow: 0 0 20px var(--color-primary-dim); background: radial-gradient(circle at 30% 30%, var(--color-primary-dim), #000);"></div>
                    
                    <!-- Scanline Overlay -->
                    <div style="position: absolute; top:0; left:0; width:100%; height:100%; background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%); background-size: 100% 4px; pointer-events: none;"></div>
                </div>
                
                <h3 style="color: var(--color-primary); border-bottom: 1px solid var(--color-primary-dim); padding-bottom: 5px;">${planet.name}</h3>
                
                <div style="margin-top: 15px; font-size: 0.9em; flex: 1; display: flex; flex-direction: column; gap: 8px;">
                    <div style="color: var(--color-text-dim); font-style: italic; margin-bottom: 5px;">"${planet.desc}"</div>
                    
                    <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed var(--color-primary-dim);">
                        <span style="color: var(--color-text-dim);">TYPE</span>
                        <span>${planet.type}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed var(--color-primary-dim);">
                        <span style="color: var(--color-text-dim);">GRAVITY</span>
                        <span>${planet.gravity}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed var(--color-primary-dim);">
                        <span style="color: var(--color-text-dim);">TEMP</span>
                        <span>${planet.temperature}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed var(--color-primary-dim);">
                        <span style="color: var(--color-text-dim);">ATMOSPHERE</span>
                        <span>${planet.atmosphere}</span>
                    </div>

                    <div style="margin-top: 10px;">
                        <div style="color: var(--color-text-dim); margin-bottom: 5px;">TAGS:</div>
                        <div>${tagsHtml}</div>
                    </div>

                    ${planet.scanned
                ? `<div style="margin-top: auto; color: var(--color-primary); text-align: center; border: 1px solid var(--color-primary); padding: 5px;">ANALYSIS COMPLETE</div>`
                : `<div style="margin-top: auto; color: var(--color-accent); text-align: center; background: rgba(255, 176, 0, 0.1); padding: 5px;">⚠ SCAN REQUIRED</div>`
            }
                </div>

                <div class="actions-container" style="margin-top: 15px;">
                     <button class="warp-btn" style="width: 100%; padding: 15px; background: var(--color-primary); color: #000; border: none; font-weight: bold; font-family: var(--font-display); cursor: pointer; text-transform: uppercase;">
                        INITIATE WARP (${planet.fuelCost} NRG)
                    </button>
                </div>
            </div>
        `;

        // Attach Warp Listener
        const warpBtn = panel.querySelector('.warp-btn');
        if (warpBtn) {
            warpBtn.addEventListener('click', () => {
                window.dispatchEvent(new CustomEvent('req-warp', { detail: planet }));
            });
        }
    }
}
