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

            const color = this.getPlanetColor(planet.type);
            const isGhost = planet.ghost === true;

            return `
            <div class="nav-node ${isGhost ? 'nav-ghost' : ''}" data-id="${planet.id}"
                 style="position: absolute; left: ${x}%; top: ${y}%; transform: translate(-50%, -50%);
                        width: 40px; height: 40px; cursor: pointer; display: flex; align-items: center; justify-content: center;
                        z-index: 10; transition: all 0.3s ease;
                        ${isGhost ? 'opacity: 0.35; animation: ghost-shimmer 3s ease-in-out infinite;' : ''}">

                <div class="planet-visual type-${planet.type} nav-miniature"
                     style="width: 100%; height: 100%; animation-duration: 10s;">
                </div>

                <!-- Label -->
                <div class="nav-label" style="position: absolute; top: 45px; white-space: nowrap; color: ${color};
                            font-size: 10px; font-family: var(--font-mono); text-shadow: 0 0 5px #000; pointer-events: none; opacity: 0.8;
                            ${isGhost ? 'font-style: italic;' : ''}">
                    ${planet.name}
                </div>
            </div>`;
        }).join('');

        // Calculate actual jump cost for display
        let jumpCost = 20;
        let jumpCostNote = '';
        if (this.state && !this.state.isDeckOperational('engineering')) {
            jumpCost = 40;
            jumpCostNote = ' [ENGINEERING DAMAGED]';
        }
        if (this.state && this.state._driveReinforced) {
            const discount = Math.floor(jumpCost * 0.2);
            jumpCost -= discount;
            jumpCostNote = ` [DRIVES REINFORCED: -${discount}]`;
        }

        this.element.innerHTML = `
            <div style="padding: 20px; height: 100%; display: flex; flex-direction: column;">
                <div style="display: flex; justify-content: space-between; align-items: end; border-bottom: 2px solid var(--color-primary); padding-bottom: 10px; margin-bottom: 20px;">
                    <h2 style="color: var(--color-primary); margin:0;">/// SECTOR NAVIGATION MAP</h2>
                    <button id="jump-sector-btn" style="background: transparent; border: 1px solid var(--color-accent); color: var(--color-accent); padding: 5px 15px; cursor: pointer; font-family: var(--font-mono);">
                        >> JUMP SECTOR (-${jumpCost} ENERGY)${jumpCostNote}
                    </button>
                </div>
                
                <div class="sector-map-container sector-map-bg" style="flex: 1; border: 1px solid var(--color-primary-dim); position: relative; overflow: hidden;${(() => {
                    if (typeof SECTOR_CONFIG !== 'undefined' && this.state) {
                        const sc = SECTOR_CONFIG[this.state.currentSector];
                        if (sc && sc.sectorColor) return ` box-shadow: inset 0 0 80px ${sc.sectorColor}22;`;
                    }
                    return '';
                })()}">
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
                node.style.transform = 'translate(-50%, -50%) scale(1.5)'; // Pop effect
                if (label) {
                    label.style.opacity = '1';
                    label.style.fontWeight = 'bold';
                    label.style.textShadow = '0 0 10px var(--color-primary), 0 0 20px var(--color-primary)';
                    label.style.zIndex = '30';
                    label.style.background = 'rgba(0, 0, 0, 0.9)';
                    label.style.padding = '2px 6px';
                    label.style.borderRadius = '2px';
                }
            });
            node.addEventListener('mouseleave', () => {
                node.style.zIndex = '10';
                node.style.transform = 'translate(-50%, -50%)'; // Revert pop
                if (label) {
                    label.style.opacity = '0.8';
                    label.style.fontWeight = 'normal';
                    label.style.textShadow = '0 0 5px #000';
                    label.style.zIndex = 'auto';
                    label.style.background = 'transparent';
                    label.style.padding = '0';
                }
            });

            node.addEventListener('click', () => {
                // Ghost planet: dissolve on interaction
                if (data && data.ghost) {
                    // Fade out the node
                    node.style.transition = 'opacity 1s ease-out';
                    node.style.opacity = '0';
                    setTimeout(() => node.remove(), 1000);

                    // Remove from sector nodes
                    if (this.state && this.state.sectorNodes) {
                        const idx = this.state.sectorNodes.findIndex(p => p.id === data.id);
                        if (idx !== -1) this.state.sectorNodes.splice(idx, 1);
                    }

                    // Log and bark
                    if (this.state) {
                        this.state.addLog(`SIGNAL INTERFERENCE: ${data.name} was a phantom reading. The signal dissolves.`);
                        if (typeof BarkSystem !== 'undefined' && window.BarkSystem) {
                            // Mira reacts to ghost planet
                            const mira = this.state.crew.find(c => c.personality === 'CURIOUS' && c.status !== 'DEAD');
                            if (mira) {
                                setTimeout(() => this.state.addLog(`${mira.name}: "The readings just... vanished. The signal is playing games with our instruments."`), 300);
                            }
                        }
                    }

                    // Show "INTERFERENCE" in the right panel
                    const rightPanel = document.getElementById('tactical-display');
                    if (rightPanel) {
                        rightPanel.innerHTML = `
                            <div style="display:flex; align-items:center; justify-content:center; height:100%; flex-direction:column; opacity:0.5;">
                                <div style="font-size:1.2em; color:#ff4444; margin-bottom:10px;">⚠ SIGNAL INTERFERENCE</div>
                                <div style="color:var(--color-text-dim); font-size:0.85em;">Phantom reading dissolved. Sensor recalibrating...</div>
                            </div>
                        `;
                    }
                    return;
                }

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
        if (type === 'TIDALLY_LOCKED') return '#ff8844'; // Fire/Ice blend
        if (type === 'HOLLOW') return '#ffcc33';         // Inner sun gold
        if (type === 'SYMBIOTE_WORLD') return '#00ff66'; // Bioluminescent green
        if (type === 'MIRROR') return '#e0e0e0';         // Chrome silver
        if (type === 'GRAVEYARD') return '#888888';       // Dead metal grey
        if (type === 'SINGING') return '#6699ff';         // Harmonic blue

        // New planet types
        if (type === 'STORM_WORLD') return '#6688aa';     // Stormy blue-grey
        if (type === 'FUNGAL') return '#88cc88';          // Bioluminescent green
        if (type === 'TOMB_WORLD') return '#886644';      // Dead brown
        if (type === 'EDEN') return '#44ff44';            // Bright paradise green
        if (type === 'MACHINE_WORLD') return '#6688aa';   // Industrial blue
        if (type === 'FROZEN_OCEAN') return '#aaddff';    // Ice blue
        if (type === 'SULFUR') return '#cccc44';          // Yellow sulfur
        if (type === 'CARBON') return '#444444';          // Dark graphite
        if (type === 'RADIATION_BELT') return '#44ff66';  // Radioactive green
        if (type === 'GHOST_WORLD') return '#8888bb';     // Ethereal purple-grey
        if (type === 'STRUCTURE') return '#ffffff';       // Bright white - endgame

        return '#aaaaaa';
    }

    handlePlanetSelect(planet) {
        window.dispatchEvent(new CustomEvent('planet-selected', { detail: planet }));
        const panel = document.getElementById('tactical-display');
        if (!panel) return;

        // Special handling for THE STRUCTURE
        if (planet.isStructure) {
            this.handleStructureSelect(planet, panel);
            return;
        }

        const isDeepScanned = planet.scanned;
        const isRemoteScanned = planet.remoteScanned;
        const actualCost = (this.state.lastVisitedSystem && this.state.lastVisitedSystem.id === planet.id) ? 0 : planet.fuelCost;

        // Resource level calculation (based on planet.resources)
        const getResourceLevel = (value) => {
            if (value >= 70) return { text: 'HIGH', color: '#00ff00' };
            if (value >= 40) return { text: 'MODERATE', color: '#ffff00' };
            if (value >= 20) return { text: 'LOW', color: '#ff8800' };
            return { text: 'TRACE', color: '#ff4444' };
        };

        // Signal detection based on planet properties
        const detectSignals = (p) => {
            const signals = [];
            if (p.metrics?.hasLife || ['VITAL', 'BIO_MASS', 'SYMBIOTE_WORLD', 'SINGING'].includes(p.type)) {
                signals.push({ type: 'BIOLOGICAL', color: '#00ff66' });
            }
            if (p.metrics?.hasTech || ['MECHA', 'TERRAFORMED', 'MIRROR'].includes(p.type)) {
                signals.push({ type: 'TECHNOLOGICAL', color: '#00ccff' });
            }
            if (p.tags?.includes('WRECKAGE') || p.tags?.includes('EXODUS_WRECK')) {
                signals.push({ type: 'WRECKAGE', color: '#ff8800' });
            }
            if (p.tags?.includes('FAILED_COLONY')) {
                signals.push({ type: 'COLONY RUINS', color: '#8888ff' });
            }
            if (p.tags?.includes('ANCIENT_RUINS')) {
                signals.push({ type: 'ANCIENT RUINS', color: '#ffcc00' });
            }
            if (p.tags?.includes('ALIEN_SIGNALS')) {
                signals.push({ type: 'ALIEN SIGNAL', color: '#ff00ff' });
            }
            if (p.tags?.includes('DERELICT')) {
                signals.push({ type: 'DERELICT SHIP', color: '#cc8800' });
            }
            if (p.tags?.includes('ANOMALY')) {
                signals.push({ type: 'ANOMALY', color: '#ff00ff' });
            }
            return signals;
        };

        // Tags display (only on deep scan)
        const tagsHtml = isDeepScanned && planet.tags && planet.tags.length > 0
            ? planet.tags.map(t => {
                if (t === 'EXODUS_WRECK') return `<span style="background: #ff8800; color: #000; padding: 2px 4px; border-radius: 2px; font-size: 0.8em; margin-right: 5px; font-weight: bold;">EXODUS TRANSPONDER</span>`;
                if (t === 'PREDATORY') return `<span style="background: #ff0000; color: #fff; padding: 2px 4px; border-radius: 2px; font-size: 0.8em; margin-right: 5px; font-weight: bold; animation: blink 1s infinite;">PREDATORY</span>`;
                if (t === 'FAILED_COLONY') return `<span style="background: #4444ff; color: #fff; padding: 2px 4px; border-radius: 2px; font-size: 0.8em; margin-right: 5px;">FAILED COLONY</span>`;
                return `<span style="background: var(--color-primary-dim); color: #000; padding: 2px 4px; border-radius: 2px; font-size: 0.8em; margin-right: 5px;">${t}</span>`;
            }).join('')
            : (isDeepScanned ? '<span style="color: var(--color-text-dim);">NO ANOMALIES</span>' : '');

        // Build resource display for remote/deep scanned
        let resourcesHtml = '';
        let signalsHtml = '';

        if (isRemoteScanned || isDeepScanned) {
            const metals = planet.resources?.metals || 30;
            const energy = planet.resources?.energy || 30;
            const metalLevel = getResourceLevel(metals);
            const energyLevel = getResourceLevel(energy);
            const signals = detectSignals(planet);

            resourcesHtml = `
                <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed var(--color-primary-dim);">
                    <span style="color: var(--color-text-dim);">SALVAGE</span>
                    <span style="color: ${metalLevel.color}; font-weight: bold;">${metalLevel.text}</span>
                </div>
                <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed var(--color-primary-dim);">
                    <span style="color: var(--color-text-dim);">ENERGY</span>
                    <span style="color: ${energyLevel.color}; font-weight: bold;">${energyLevel.text}</span>
                </div>
            `;

            signalsHtml = `
                <div style="margin-top: 8px;">
                    <div style="color: var(--color-text-dim); margin-bottom: 5px; font-size: 0.85em;">SIGNALS DETECTED:</div>
                    <div style="display: flex; flex-wrap: wrap; gap: 4px;">
                        ${signals.length > 0
                            ? signals.map(s => `<span style="background: ${s.color}22; color: ${s.color}; padding: 2px 6px; border: 1px solid ${s.color}; border-radius: 2px; font-size: 0.75em;">${s.type}</span>`).join('')
                            : '<span style="color: var(--color-text-dim); font-size: 0.8em;">NONE</span>'
                        }
                    </div>
                </div>
            `;
        } else {
            resourcesHtml = `
                <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed var(--color-primary-dim);">
                    <span style="color: var(--color-text-dim);">SALVAGE</span>
                    <span style="color: var(--color-accent);">UNKNOWN</span>
                </div>
                <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed var(--color-primary-dim);">
                    <span style="color: var(--color-text-dim);">ENERGY</span>
                    <span style="color: var(--color-accent);">UNKNOWN</span>
                </div>
            `;
            signalsHtml = `
                <div style="margin-top: 8px;">
                    <div style="color: var(--color-text-dim); margin-bottom: 5px; font-size: 0.85em;">SIGNALS:</div>
                    <span style="color: var(--color-accent); font-size: 0.8em;">SCAN REQUIRED</span>
                </div>
            `;
        }

        panel.innerHTML = `
            <div class="tactical-card" style="width: 100%; height: 100%; display: flex; flex-direction: column;">
                <div style="border: 1px solid var(--color-primary); height: 120px; display: flex; align-items: center; justify-content: center; background: rgba(0,255,0,0.05); margin-bottom: 15px; position: relative; overflow: visible;">
                    <div class="planet-visual type-${planet.type}" style="width: 80px; height: 80px;"></div>
                    <div style="position: absolute; top:0; left:0; width:100%; height:100%; background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%); background-size: 100% 4px; pointer-events: none; opacity: 0.3;"></div>
                </div>
                <h3 style="color: var(--color-primary); border-bottom: 1px solid var(--color-primary-dim); padding-bottom: 5px; font-size: 1em;">${planet.name}</h3>
                <div style="margin-top: 10px; font-size: 0.85em; flex: 1; display: flex; flex-direction: column; gap: 6px; overflow-y: auto;">
                    <div style="color: var(--color-text-dim); font-style: italic; font-size: 0.8em; margin-bottom: 3px;">"${planet.desc}"</div>
                    <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed var(--color-primary-dim);">
                        <span style="color: var(--color-text-dim);">TYPE</span><span>${planet.type}</span>
                    </div>
                    ${resourcesHtml}
                    ${signalsHtml}
                    ${isDeepScanned ? `
                        <div style="margin-top: 6px;">
                            <div style="color: var(--color-text-dim); margin-bottom: 3px; font-size: 0.85em;">TAGS:</div>
                            <div>${tagsHtml}</div>
                        </div>
                    ` : ''}
                    ${(isRemoteScanned || isDeepScanned)
                        ? `<div style="margin-top: auto; color: var(--color-primary); text-align: center; border: 1px solid var(--color-primary); padding: 4px; font-size: 0.8em;">
                            ${isDeepScanned ? 'FULL ANALYSIS COMPLETE' : 'LONG-RANGE SCAN COMPLETE'}
                           </div>`
                        : (planet.id === this.state.currentSystem?.id
                            ? `<div style="margin-top: auto; color: var(--color-primary); text-align: center; border: 1px solid var(--color-primary-dim); padding: 8px; opacity: 0.7;">
                                CURRENT LOCATION
                               </div>`
                            : `<button class="scan-btn" style="margin-top: auto; width:100%; padding:8px; background: transparent; border: 1px solid var(--color-accent); color: var(--color-accent); cursor: pointer; font-family: var(--font-mono); font-size: 0.85em;">
                                    LONG RANGE SCAN (-2 NRG)
                               </button>`
                        )
                    }
                </div>
                <div class="actions-container" style="margin-top: 10px; display: flex; flex-direction: column; gap: 6px;">
                    ${(isRemoteScanned || isDeepScanned) && planet.id !== this.state.currentSystem?.id ? `
                        <button class="probe-btn" style="width: 100%; padding: 8px; background: transparent; border: 1px solid #ff8800; color: #ff8800; font-family: var(--font-mono); cursor: pointer; font-size: 0.8em;">
                            🛰️ LAUNCH PROBE (REMOTE)
                        </button>
                    ` : ''}
                    <button class="warp-btn" style="width: 100%; padding: 12px; background: var(--color-primary); color: #000; border: none; font-weight: bold; font-family: var(--font-display); cursor: pointer; text-transform: uppercase; font-size: 0.9em;">
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
        const probeBtn = panel.querySelector('.probe-btn');
        if (probeBtn) {
            probeBtn.addEventListener('click', () => {
                window.dispatchEvent(new CustomEvent('req-remote-probe', { detail: planet }));
            });
        }
    }

    handleStructureSelect(structure, panel) {
        const actualCost = structure.fuelCost || 30;

        panel.innerHTML = `
            <div class="tactical-card" style="width: 100%; height: 100%; display: flex; flex-direction: column; background: linear-gradient(135deg, #0a0a15, #1a0a2a);">
                <div style="border: 2px solid #8844ff; height: 140px; display: flex; align-items: center; justify-content: center; background: radial-gradient(circle, rgba(136,68,255,0.2), transparent); margin-bottom: 15px; position: relative; overflow: visible;">
                    <div class="planet-visual type-STRUCTURE" style="width: 100px; height: 100px;"></div>
                    <div style="position: absolute; top:0; left:0; width:100%; height:100%; background: linear-gradient(rgba(136, 68, 255, 0) 50%, rgba(136, 68, 255, 0.1) 50%); background-size: 100% 4px; pointer-events: none; animation: pulse 2s infinite;"></div>
                </div>
                <h3 style="color: #ffffff; border-bottom: 2px solid #8844ff; padding-bottom: 8px; font-size: 1.2em; text-shadow: 0 0 10px rgba(136,68,255,0.5);">${structure.name}</h3>
                <div style="margin-top: 10px; font-size: 0.85em; flex: 1; display: flex; flex-direction: column; gap: 8px; overflow-y: auto;">
                    <div style="color: #ccaaff; font-style: italic; font-size: 0.9em; margin-bottom: 5px; line-height: 1.5;">
                        "${structure.desc || 'It defies comprehension. It defies physics. It waits.'}"
                    </div>
                    <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #440088; padding: 4px 0;">
                        <span style="color: #8844ff;">TYPE</span>
                        <span style="color: #ff4444;">UNKNOWN</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #440088; padding: 4px 0;">
                        <span style="color: #8844ff;">ORIGIN</span>
                        <span style="color: #ff4444;">UNKNOWN</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #440088; padding: 4px 0;">
                        <span style="color: #8844ff;">AGE</span>
                        <span style="color: #ff4444;">BEFORE TIME</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; border-bottom: 1px dashed #440088; padding: 4px 0;">
                        <span style="color: #8844ff;">THREAT LEVEL</span>
                        <span style="color: #ffffff; font-weight: bold; animation: pulse 1.5s infinite;">???</span>
                    </div>
                    <div style="margin-top: 10px; padding: 10px; border: 1px solid #ff4444; background: rgba(255,0,0,0.1);">
                        <div style="color: #ff4444; font-weight: bold; font-size: 0.8em;">⚠ A.U.R.A. ADVISORY</div>
                        <div style="color: #ff6666; font-size: 0.75em; margin-top: 5px;">
                            "Commander, I cannot model what will happen if we approach. All predictive algorithms return null. Proceed with... I do not know."
                        </div>
                    </div>
                </div>
                <div class="actions-container" style="margin-top: 15px; display: flex; flex-direction: column; gap: 8px;">
                    <button class="warp-btn" style="
                        width: 100%; padding: 15px;
                        background: linear-gradient(135deg, #440088, #8844ff);
                        color: #ffffff; border: 2px solid #ffffff;
                        font-weight: bold; font-family: var(--font-display);
                        cursor: pointer; text-transform: uppercase; font-size: 1em;
                        text-shadow: 0 0 10px rgba(255,255,255,0.5);
                        transition: all 0.3s;
                    ">
                        APPROACH THE STRUCTURE (${actualCost} NRG)
                    </button>
                </div>
            </div>
            <style>
                @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
            </style>
        `;

        const warpBtn = panel.querySelector('.warp-btn');
        if (warpBtn) {
            warpBtn.onmouseenter = () => {
                warpBtn.style.background = 'linear-gradient(135deg, #660099, #aa66ff)';
                warpBtn.style.boxShadow = '0 0 20px rgba(136,68,255,0.5)';
            };
            warpBtn.onmouseleave = () => {
                warpBtn.style.background = 'linear-gradient(135deg, #440088, #8844ff)';
                warpBtn.style.boxShadow = 'none';
            };
            warpBtn.addEventListener('click', () => {
                window.dispatchEvent(new CustomEvent('req-warp', { detail: structure }));
            });
        }
    }
}
