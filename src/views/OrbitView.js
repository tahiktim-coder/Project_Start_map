class OrbitView {
    constructor(state) {
        this.element = document.createElement('div');
        this.element.className = 'orbit-view-container';
        this.element.style.height = '100%';
        this.element.style.overflow = 'hidden';
        this.state = state;
    }

    render() {
        const planet = this.state.currentSystem;
        if (!planet) return `<div class="error">dERR: NO SYSTEM LOCK</div>`;

        // Special rendering for THE STRUCTURE
        if (planet.isStructure) {
            return this.renderStructure(planet);
        }

        // Special rendering for SPACE STATIONS
        if (planet.isStation) {
            return this.renderStation(planet);
        }

        // Special rendering for ASTEROID FIELDS
        if (planet.isAsteroidField) {
            return this.renderAsteroidField(planet);
        }

        const isDeepScanned = planet.scanned;
        const showStat = (key) => isDeepScanned || (planet.revealedStats && planet.revealedStats.includes(key));

        // Use pre-calculated metrics if available (legacy support if not)
        const metrics = planet.metrics || { gravity: 1, temp: 0, hasLife: false, hasTech: false };
        const hasLife = metrics.hasLife;
        const hasTech = metrics.hasTech;

        this.element.innerHTML = `
            <div style="padding: 20px; height: 100%; display: flex; flex-direction: column; overflow: hidden;">
                <h2 style="color: var(--color-primary); border-bottom: 2px solid var(--color-primary); padding-bottom: 10px; margin-bottom: 20px; max-width: 40%;">
                    /// ORBIT ESTABLISHED: ${planet.name}
                </h2>

                <div style="flex: 1; display: flex; flex-direction: row; gap: 20px; min-height: 0;">

                    <!-- LEFT: Data readout -->
                    <div style="width: 280px; display: flex; flex-direction: column; gap: 15px; border-right: 1px dashed var(--color-primary-dim); padding-right: 20px; overflow-y: auto; min-height: 0;">
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
                                 <div><span style="color:var(--color-text-dim)">SALVAGE:</span> <span style="color:var(--color-primary)">${planet.resources.metals > 70 ? 'RICH' : (planet.resources.metals > 30 ? 'MODERATE' : 'SCARCE')}</span></div>
                                 <div><span style="color:var(--color-text-dim)">ENERGY:</span> <span style="color:var(--color-primary)">${planet.resources.energy > 70 ? 'ABUNDANT' : (planet.resources.energy > 30 ? 'MODERATE' : 'LOW')}</span></div>
                                 
                                 <div style="margin-top: 10px; border-top: 1px dashed var(--color-primary-dim); padding-top: 5px;">
                                    <div><span style="color:var(--color-text-dim)">BIOSIGNATURES:</span> <span style="color:${hasLife ? 'var(--color-primary)' : 'var(--color-text-dim)'}">${hasLife ? 'DETECTED' : 'NEGATIVE'}</span></div>
                                    <div><span style="color:var(--color-text-dim)">TECHNOSIGNATURES:</span> <span style="color:${hasTech ? 'var(--color-accent)' : 'var(--color-text-dim)'}">${hasTech ? 'DETECTED' : 'NEGATIVE'}</span></div>
                                 </div>

                                 <div style="margin-top: 5px;">
                                    <div style="color:var(--color-text-dim); margin-bottom:4px">ANOMALIES:</div>
                                    ${planet.tags && planet.tags.length
                    ? planet.tags.map(t => {
                        if (t === 'EXODUS_WRECK') return `<span style="background:rgba(116,217,154,0.10); color:var(--green-br); border:1px solid var(--green-d); padding:2px 5px; font-size:0.8em; margin-right:5px; display:inline-block; margin-bottom:5px; letter-spacing:0.05em;">EXODUS TRANSPONDER</span>`;
                        if (t === 'PREDATORY') return `<span style="background:rgba(216,90,78,0.15); color:var(--red); border:1px solid var(--red); padding:2px 5px; font-size:0.8em; margin-right:5px; display:inline-block; margin-bottom:5px; letter-spacing:0.05em; animation: predatory-blink 1s infinite;">⚠ PREDATORY ECOSYSTEM</span>`;
                        if (t === 'WRECKAGE') return `<span style="background:rgba(120,160,130,0.06); color:var(--bone); border:1px solid var(--line2); padding:2px 5px; font-size:0.8em; margin-right:5px; display:inline-block; margin-bottom:5px; letter-spacing:0.05em;">DEBRIS FIELD</span>`;
                        if (t === 'FAILED_COLONY') return `<span style="background:rgba(120,160,130,0.06); color:var(--bone); border:1px solid var(--line2); padding:2px 5px; font-size:0.8em; margin-right:5px; display:inline-block; margin-bottom:5px; letter-spacing:0.05em;">COLONY RUINS</span>`;
                        if (t === 'DERELICT') return `<span style="background:rgba(120,160,130,0.06); color:var(--bone); border:1px solid var(--line2); padding:2px 5px; font-size:0.8em; margin-right:5px; display:inline-block; margin-bottom:5px; letter-spacing:0.05em;">DERELICT SHIP</span>`;
                        if (t === 'ANOMALY') return `<span style="background:rgba(217,162,74,0.12); color:var(--amber); border:1px solid var(--amber); padding:2px 5px; font-size:0.8em; margin-right:5px; display:inline-block; margin-bottom:5px; letter-spacing:0.05em; animation: predatory-blink 1.5s infinite;">⚡ ANOMALY</span>`;
                        if (t === 'LIGHTHOUSE') return `<span style="background:rgba(116,217,154,0.10); color:var(--green-br); border:1px solid var(--green-d); padding:2px 5px; font-size:0.8em; margin-right:5px; display:inline-block; margin-bottom:5px; letter-spacing:0.05em;">🗼 LIGHTHOUSE BEACON</span>`;
                        if (t === 'GARDEN') return `<span style="background:rgba(116,217,154,0.10); color:var(--green-br); border:1px solid var(--green-d); padding:2px 5px; font-size:0.8em; margin-right:5px; display:inline-block; margin-bottom:5px; letter-spacing:0.05em;">🌿 GARDEN DOME</span>`;
                        if (t === 'GRAVE') return `<span style="background:rgba(120,160,130,0.06); color:var(--dim); border:1px solid var(--line); padding:2px 5px; font-size:0.8em; margin-right:5px; display:inline-block; margin-bottom:5px; letter-spacing:0.05em;">⚰ THE GRAVE</span>`;
                        return `<span style="background:rgba(120,160,130,0.06); color:var(--dim); border:1px solid var(--line); padding:2px 5px; font-size:0.8em; margin-right:5px; display:inline-block; margin-bottom:5px;">${t}</span>`;
                    }).join('')
                    : '<span style="color:var(--color-text-dim); font-style:italic;">NONE DETECTED</span>'}
                                 </div>
                                 ${planet.tags && planet.tags.includes('EXODUS_WRECK') ? `
                                 <div style="margin-top: 8px; padding: 8px; border: 1px solid var(--green-d); background: rgba(116,217,154,0.07);">
                                    <div style="color:var(--green-br); font-weight:bold; font-size:0.85em;">EXODUS WRECK DETECTED</div>
                                    <div style="color:var(--dim); font-size:0.75em; margin-top:3px;">Human vessel transponder signal. Investigate from Command Deck.</div>
                                 </div>` : ''}
                                 ${planet.tags && planet.tags.includes('PREDATORY') ? `
                                 <div style="margin-top: 8px; padding: 8px; border: 1px solid var(--red); background: rgba(216,90,78,0.12); animation: predatory-blink 1.5s infinite;">
                                    <div style="color:var(--red); font-weight:bold; font-size:0.85em;">⚠ PREDATORY ECOSYSTEM WARNING</div>
                                    <div style="color:var(--red); opacity:0.8; font-size:0.75em; margin-top:3px;">Surface organisms exhibit coordinated hunting behavior. EVA teams at extreme risk.</div>
                                 </div>` : ''}
                                 ${planet.tags && planet.tags.includes('WRECKAGE') ? `
                                 <div style="margin-top: 8px; padding: 8px; border: 1px solid var(--line2); background: rgba(120,160,130,0.05);">
                                    <div style="color:var(--bone); font-weight:bold; font-size:0.85em;">DEBRIS FIELD</div>
                                    <div style="color:var(--dim); font-size:0.75em; margin-top:3px;">Ship wreckage detected in orbital path. Salvage potential confirmed.</div>
                                 </div>` : ''}
                                 ${planet.tags && planet.tags.includes('FAILED_COLONY') ? `
                                 <div style="margin-top: 8px; padding: 8px; border: 1px solid var(--line2); background: rgba(120,160,130,0.05);">
                                    <div style="color:var(--bone); font-weight:bold; font-size:0.85em;">COLONY RUINS DETECTED</div>
                                    <div style="color:var(--dim); font-size:0.75em; margin-top:3px;">Abandoned settlement structures on surface. Investigate from Command Deck.</div>
                                 </div>` : ''}
                                 ${planet.tags && planet.tags.includes('DERELICT') ? `
                                 <div style="margin-top: 8px; padding: 8px; border: 1px solid var(--line2); background: rgba(120,160,130,0.05);">
                                    <div style="color:var(--bone); font-weight:bold; font-size:0.85em;">DERELICT SHIP DETECTED</div>
                                    <div style="color:var(--dim); font-size:0.75em; margin-top:3px;">Non-Exodus vessel wreckage. Salvage potential confirmed. Investigate from Command Deck.</div>
                                 </div>` : ''}
                                 ${planet.tags && planet.tags.includes('ANOMALY') ? `
                                 <div style="margin-top: 8px; padding: 8px; border: 1px solid var(--amber); background: rgba(217,162,74,0.10); animation: predatory-blink 2s infinite;">
                                    <div style="color:var(--amber); font-weight:bold; font-size:0.85em;">⚡ SPATIAL ANOMALY DETECTED</div>
                                    <div style="color:var(--amber); opacity:0.8; font-size:0.75em; margin-top:3px;">Reality distortion field. Approach with extreme caution. Unknown risks.</div>
                                 </div>` : ''}
                                 ${planet.tags && planet.tags.includes('LIGHTHOUSE') ? `
                                 <div style="margin-top: 8px; padding: 8px; border: 1px solid var(--green-d); background: rgba(116,217,154,0.07);">
                                    <div style="color:var(--green-br); font-weight:bold; font-size:0.85em;">🗼 THE LIGHTHOUSE</div>
                                    <div style="color:var(--dim); font-size:0.75em; margin-top:3px;">Ancient navigation beacon. Broadcasting on all frequencies. This structure is older than humanity.</div>
                                 </div>` : ''}
                                 ${planet.tags && planet.tags.includes('GARDEN') ? `
                                 <div style="margin-top: 8px; padding: 8px; border: 1px solid var(--green-d); background: rgba(116,217,154,0.07);">
                                    <div style="color:var(--green-br); font-weight:bold; font-size:0.85em;">🌿 THE GARDEN</div>
                                    <div style="color:var(--dim); font-size:0.75em; margin-top:3px;">Terraformed biodome. Living ecosystem detected on dead world. Someone built this sanctuary.</div>
                                 </div>` : ''}
                                 ${planet.tags && planet.tags.includes('GRAVE') ? `
                                 <div style="margin-top: 8px; padding: 8px; border: 1px solid var(--line2); background: rgba(120,160,130,0.05);">
                                    <div style="color:var(--bone); font-weight:bold; font-size:0.85em;">⚰ THE GRAVE</div>
                                    <div style="color:var(--dim); font-size:0.75em; margin-top:3px;">Infinite cemetery moon. Names in every language. Some of the dates are from the future.</div>
                                 </div>` : ''}
                                 ${(() => {
                                    const dl = planet.dangerLevel || 0;
                                    const hazTypes = ['BIO_MASS','VOLCANIC','SHATTERED','MECHA','GRAVEYARD','HOLLOW','TIDALLY_LOCKED'];
                                    const hostileTypes = ['BIO_MASS','MECHA']; // SYMBIOTE_WORLD is welcoming, not hostile
                                    const isHostile = hostileTypes.includes(planet.type);
                                    // Safe planet types should never show CRITICAL
                                    const safeTypes = ['EDEN', 'SYMBIOTE_WORLD', 'SINGING', 'VITAL', 'TERRAFORMED'];
                                    const isSafe = safeTypes.includes(planet.type);
                                    const threatLevel = isSafe ? (dl >= 2 ? 'MODERATE' : 'LOW') : (dl >= 3 ? 'CRITICAL' : (dl >= 2 || hazTypes.includes(planet.type)) ? 'HIGH' : (dl >= 1 || hasLife) ? 'MODERATE' : 'LOW');
                                    const threatColor = threatLevel === 'CRITICAL' ? '#d85a4e' : threatLevel === 'HIGH' ? '#d9a24a' : threatLevel === 'MODERATE' ? '#cba869' : 'var(--green)';
                                    const threatDesc = isHostile && hasLife ? 'HOSTILE FAUNA DETECTED' : (hasLife ? 'BIOSIGNS — UNKNOWN INTENT' : (hazTypes.includes(planet.type) ? 'ENVIRONMENTAL HAZARD' : 'NOMINAL'));
                                    return `<div style="margin-top: 10px; border-top: 1px dashed var(--color-primary-dim); padding-top: 8px;">
                                        <div><span style="color:var(--color-text-dim)">THREAT LEVEL:</span> <span style="color:${threatColor}; font-weight: bold;">${threatLevel}</span></div>
                                        <div style="font-size:0.8em; color:${threatColor}; opacity:0.8; margin-top:3px;">${threatDesc}</div>
                                    </div>`;
                                 })()}
                               </div>`
                : `<div style="color: var(--color-text-dim); font-style: italic; opacity: 0.5; margin-top: 20px;">
                                ... SENSORS OFFLINE ...
                               </div>`
            }
                    </div>

                    <!-- RIGHT: Visual -->
                    <div class="orbit-visual" style="flex: 1; display: flex; align-items: center; justify-content: center; position: relative; margin-top: -40px;">
                        ${(window.BodyRenderer && BodyRenderer.body(planet, 240))
                            || `<div class="planet-visual type-${planet.type}" style="
                            width: 260px; height: 260px;
                            border-radius: 50%;
                            position: relative;
                            --seed-hue: ${(planet.id.charCodeAt(0) * 17) % 360}deg;
                            --seed-offset-x: ${((planet.id.charCodeAt(1) || 50) % 40) + 20}%;
                            --seed-offset-y: ${((planet.id.charCodeAt(2) || 60) % 40) + 30}%;
                            --seed-scale: ${0.8 + ((planet.id.charCodeAt(3) || 70) % 40) / 100};
                            --seed-rotation: ${(planet.id.charCodeAt(0) * 7) % 360}deg;
                        ">
                            <div style="position:absolute; top:-10px; left:-10px; right:-10px; bottom:-10px; border-radius:50%; box-shadow: inset 0 0 20px rgba(0,0,0,0.5); pointer-events:none;"></div>
                        </div>`}
                        <div class="ship-orbit-icon" style="
                            position: absolute; top: 50%; left: 50%; width: 350px; height: 350px; transform: translate(-50%, -50%);
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

    renderStructure(planet) {
        // Special cinematic rendering for THE STRUCTURE
        this.element.innerHTML = `
            <div style="padding: 20px; height: 100%; display: flex; flex-direction: column; overflow: hidden; background: linear-gradient(135deg, #0a0a15, #1a0a2a);">
                <h2 style="color: #ffffff; border-bottom: 2px solid #8844ff; padding-bottom: 10px; margin-bottom: 20px; max-width: 60%; text-shadow: 0 0 20px rgba(136,68,255,0.5);">
                    /// PROXIMITY ALERT: ${planet.name}
                </h2>

                <div style="flex: 1; display: flex; flex-direction: row; gap: 20px; min-height: 0;">

                    <!-- LEFT: Readings (all unknown/impossible) -->
                    <div style="width: 280px; display: flex; flex-direction: column; gap: 15px; border-right: 1px dashed #8844ff; padding-right: 20px; overflow-y: auto; min-height: 0;">
                        <div style="color: #d9a24a; border-bottom: 1px solid #440088; margin-bottom: 5px; animation: pulse 2s infinite;">SENSOR READINGS</div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                            <div style="color: var(--color-text-dim);">MASS</div>
                            <div style="color: #d85a4e; text-align: right;">ERROR: OVERFLOW</div>

                            <div style="color: var(--color-text-dim);">DIMENSIONS</div>
                            <div style="color: #d85a4e; text-align: right;">NON-EUCLIDEAN</div>

                            <div style="color: var(--color-text-dim);">TEMPERATURE</div>
                            <div style="color: #d85a4e; text-align: right;">UNDEFINED</div>

                            <div style="color: var(--color-text-dim);">ENERGY OUTPUT</div>
                            <div style="color: #d85a4e; text-align: right;">∞</div>

                            <div style="color: var(--color-text-dim);">ORIGIN</div>
                            <div style="color: #d85a4e; text-align: right;">UNKNOWN</div>

                            <div style="color: var(--color-text-dim);">AGE</div>
                            <div style="color: #d85a4e; text-align: right;">BEFORE TIME</div>
                        </div>

                        <div style="margin-top: 20px; padding: 15px; border: 1px solid #440088; background: rgba(68,0,136,0.2);">
                            <div style="color: #ccaaff; font-size: 0.9em; line-height: 1.6; font-style: italic;">
                                "${planet.desc || 'It has always been here. Waiting.'}"
                            </div>
                        </div>

                        <div style="margin-top: auto; padding: 15px; border: 2px solid #d85a4e; background: rgba(255,0,0,0.1);">
                            <div style="color: #d85a4e; font-weight: bold; font-size: 0.85em;">⚠ A.U.R.A. WARNING</div>
                            <div style="color: #e07a70; opacity: 0.9; font-size: 0.8em; margin-top: 5px;">
                                "I cannot predict what will happen if we approach. My models break down. The decision must be yours, Commander."
                            </div>
                        </div>
                    </div>

                    <!-- RIGHT: The Structure Visual -->
                    <div class="orbit-visual" style="flex: 1; display: flex; align-items: center; justify-content: center; position: relative; margin-top: -40px;">
                        <div class="planet-visual type-STRUCTURE" style="
                            width: 300px; height: 300px;
                            position: relative;
                        ">
                        </div>
                        <div style="
                            position: absolute; top: 50%; left: 50%; width: 400px; height: 400px; transform: translate(-50%, -50%);
                            border: 2px dashed rgba(136,68,255,0.5); border-radius: 0; animation: structure-orbit 30s linear infinite;
                            clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
                        ">
                            <div style="width: 15px; height: 15px; background: #ffffff; position: absolute; top: -7px; left: 50%; transform: translateX(-50%); box-shadow: 0 0 20px #ffffff, 0 0 40px #8844ff;"></div>
                        </div>
                    </div>

                </div>
            </div>
            <style>
                @keyframes structure-orbit { 100% { transform: translate(-50%, -50%) rotate(360deg); } }
                @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
            </style>
        `;
        this.updateCommandDeck(planet);
        return this.element;
    }

    renderStation(station) {
        // Special rendering for abandoned space stations
        const statusText = station.stationInvestigated ? 'EXPLORED' : 'DOCKING READY';
        const statusColor = station.stationInvestigated ? '#555555' : '#74d99a';

        this.element.innerHTML = `
            <div style="padding: 20px; height: 100%; display: flex; flex-direction: column; overflow: hidden; background: linear-gradient(135deg, #0a0d0b, #0a1410);">
                <h2 style="color: var(--green); border-bottom: 2px solid var(--green-d); padding-bottom: 10px; margin-bottom: 20px; max-width: 60%; letter-spacing: 0.06em;">
                    /// STATION APPROACH: ${station.name}
                </h2>

                <div style="flex: 1; display: flex; flex-direction: row; gap: 20px; min-height: 0;">

                    <!-- LEFT: Station Data -->
                    <div style="width: 280px; display: flex; flex-direction: column; gap: 8px; border-right: 1px dashed var(--line2); padding-right: 20px; overflow: hidden; min-height: 0; font-size: 0.92em;">
                        <div style="color: var(--green-d); border-bottom: 1px solid var(--line); letter-spacing: 0.1em;">STATION TELEMETRY</div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px 10px;">
                            <div style="color: var(--color-text-dim);">STATUS</div>
                            <div style="color: ${statusColor}; text-align: right;">${statusText}</div>

                            <div style="color: var(--color-text-dim);">POWER</div>
                            <div style="color: var(--amber); text-align: right;">EMERGENCY ONLY</div>

                            <div style="color: var(--color-text-dim);">ATMO</div>
                            <div style="color: var(--amber); text-align: right;">PARTIAL BREACH</div>

                            <div style="color: var(--color-text-dim);">LIFESIGNS</div>
                            <div style="color: var(--red); text-align: right;">NEGATIVE</div>

                            <div style="color: var(--color-text-dim);">ORIGIN</div>
                            <div style="color: var(--color-primary); text-align: right;">EARTH — EARLIER MISSION</div>

                            <div style="color: var(--color-text-dim);">LAST LOG</div>
                            <div style="color: var(--color-primary); text-align: right;">${window.BoardingParty ? window.BoardingParty.ageOf(station, this.state.currentSector) : 23} YEARS AGO</div>
                        </div>

                        <div style="margin-top: 6px; padding: 8px 10px; border-left: 2px solid var(--line2);">
                            <div style="color: var(--green-d); font-size: 0.9em; line-height: 1.45; font-style: italic;">
                                "Docking ports are responsive. Internal gravity offline. Whatever happened here, it happened fast."
                            </div>
                        </div>

                        <div style="margin-top: auto; padding: 8px 10px; border: 1px solid var(--amber); background: rgba(217,162,74,0.10);">
                            <div style="color: var(--amber); font-weight: bold; font-size: 0.85em;">⚠ A.U.R.A. ADVISORY</div>
                            <div style="color: var(--amber); opacity: 0.85; font-size: 0.8em; margin-top: 5px;">
                                "Recommend EVA suits for boarding. Interior conditions unknown. Salvage potential confirmed."
                            </div>
                        </div>
                    </div>

                    <!-- RIGHT: Station Visual -->
                    <div class="orbit-visual" style="flex: 1; display: flex; align-items: center; justify-content: center; position: relative; margin-top: -40px;">
                        ${(window.BodyRenderer && BodyRenderer.station({ size: 180, seed: BodyRenderer.seedFromId(station.id) }))
                            || `<div class="planet-visual type-STATION" style="width: 200px; height: 200px; position: relative;"></div>`}
                        <div style="
                            position: absolute; top: 50%; left: 50%; width: 300px; height: 300px; transform: translate(-50%, -50%);
                            border: 1px dashed rgba(116,217,154,0.25); border-radius: 50%; animation: spin 40s linear infinite;
                        ">
                            <div style="width: 15px; height: 15px; background: var(--color-accent); border-radius: 50%; position: absolute; top: -7px; left: 50%; transform: translateX(-50%); box-shadow: 0 0 10px var(--color-accent);"></div>
                        </div>
                    </div>

                </div>
            </div>
        `;
        this.updateCommandDeck(station);
        return this.element;
    }

    renderAsteroidField(field) {
        // Special rendering for asteroid fields
        const statusText = field.asteroidMined ? 'DEPLETED' : 'MINING READY';
        const statusColor = field.asteroidMined ? '#555555' : '#74d99a';

        this.element.innerHTML = `
            <div style="padding: 20px; height: 100%; display: flex; flex-direction: column; overflow: hidden; background: linear-gradient(135deg, #0a0d0b, #140f0a);">
                <h2 style="color: var(--green); border-bottom: 2px solid var(--green-d); padding-bottom: 10px; margin-bottom: 20px; max-width: 60%; letter-spacing: 0.06em;">
                    /// ASTEROID FIELD: ${field.name}
                </h2>

                <div style="flex: 1; display: flex; flex-direction: row; gap: 20px; min-height: 0;">

                    <!-- LEFT: Field Data -->
                    <div style="width: 280px; display: flex; flex-direction: column; gap: 15px; border-right: 1px dashed var(--line2); padding-right: 20px; overflow-y: auto; min-height: 0;">
                        <div style="color: var(--green-d); border-bottom: 1px solid var(--line); margin-bottom: 5px; letter-spacing: 0.1em;">FIELD ANALYSIS</div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                            <div style="color: var(--color-text-dim);">STATUS</div>
                            <div style="color: ${statusColor}; text-align: right;">${statusText}</div>

                            <div style="color: var(--color-text-dim);">DENSITY</div>
                            <div style="color: var(--bone); text-align: right;">HIGH</div>

                            <div style="color: var(--color-text-dim);">COMPOSITION</div>
                            <div style="color: var(--color-primary); text-align: right;">MIXED MINERALS</div>

                            <div style="color: var(--color-text-dim);">NAV HAZARD</div>
                            <div style="color: var(--amber); text-align: right;">MODERATE</div>

                            <div style="color: var(--color-text-dim);">SALVAGE</div>
                            <div style="color: var(--color-primary); text-align: right;">${field.resources?.metals >= 60 ? 'RICH' : 'MODERATE'}</div>
                        </div>

                        <div style="margin-top: 20px; padding: 15px; border: 1px solid var(--line); background: rgba(120,160,130,0.05);">
                            <div style="color: var(--green-d); font-size: 0.9em; line-height: 1.6; font-style: italic;">
                                "Debris field detected. Multiple extraction points available. Watch for unstable masses and collision hazards."
                            </div>
                        </div>

                        <div style="margin-top: auto; padding: 15px; border: 1px solid var(--amber); background: rgba(217,162,74,0.10);">
                            <div style="color: var(--amber); font-weight: bold; font-size: 0.85em;">A.U.R.A. NAVIGATION ADVISORY</div>
                            <div style="color: var(--amber); opacity: 0.85; font-size: 0.8em; margin-top: 5px;">
                                "Recommend careful maneuvering. Collision probability varies by extraction method."
                            </div>
                        </div>
                    </div>

                    <!-- RIGHT: Asteroid Field Visual -->
                    <div class="orbit-visual" style="flex: 1; display: flex; align-items: center; justify-content: center; position: relative; margin-top: -40px;">
                        ${(window.BodyRenderer && BodyRenderer.asteroid({ size: 220, seed: BodyRenderer.seedFromId(field.id) }))
                            || `<div class="planet-visual type-ASTEROID_FIELD" style="width: 240px; height: 240px; position: relative;"></div>`}
                        <div style="
                            position: absolute; top: 50%; left: 50%; width: 340px; height: 340px; transform: translate(-50%, -50%);
                            border: 1px dashed rgba(116,217,154,0.25); border-radius: 50%; animation: spin 60s linear infinite;
                        ">
                            <div style="width: 15px; height: 15px; background: var(--color-accent); border-radius: 50%; position: absolute; top: -7px; left: 50%; transform: translateX(-50%); box-shadow: 0 0 10px var(--color-accent);"></div>
                        </div>
                    </div>

                </div>
            </div>
        `;
        this.updateCommandDeck(field);
        return this.element;
    }

    getPlanetColor(type) {
        switch (type) {
            case 'ROCKY': return '#8B4513';
            case 'GAS_GIANT': return '#DEB887';
            case 'ICE_WORLD': return '#9bf0bd';
            case 'OCEANIC': return '#0000FF';
            case 'DESERT': return '#d9a24a';
            case 'VOLCANIC': return '#FF4500';
            case 'TOXIC': return '#32CD32';
            case 'VITAL': return '#228B22';
            case 'BIO_MASS': return '#d9a24a';
            case 'MECHA': return '#C0C0C0';
            case 'SHATTERED': return '#CC0000';
            case 'TERRAFORMED': return '#00FFCC';
            case 'CRYSTALLINE': return '#E0FFFF';
            case 'ROGUE': return '#330066';
            case 'TIDALLY_LOCKED': return '#FF8844';
            case 'HOLLOW': return '#FFCC33';
            case 'SYMBIOTE_WORLD': return '#74d99a';
            case 'MIRROR': return '#E0E0E0';
            case 'GRAVEYARD': return '#888888';
            case 'SINGING': return '#6699FF';
            // New planet types
            case 'STORM_WORLD': return '#c4d0c4';
            case 'FUNGAL': return '#88CC88';
            case 'TOMB_WORLD': return '#886644';
            case 'EDEN': return '#44FF44';
            case 'MACHINE_WORLD': return '#c4d0c4';
            case 'FROZEN_OCEAN': return '#AADDFF';
            case 'SULFUR': return '#CCCC44';
            case 'CARBON': return '#444444';
            case 'RADIATION_BELT': return '#44FF66';
            case 'GHOST_WORLD': return '#8888BB';
            case 'STRUCTURE': return '#ffffff';
            case 'WRONG_PLACE': return '#ff2222';
            default: return '#555';
        }
    }

    updateCommandDeck(planet) {
        const rightPanel = document.getElementById('tactical-display');
        if (!rightPanel) return;

        rightPanel.innerHTML = `
             <div class="command-deck" style="display: flex; flex-direction: column; gap: 15px; height: 100%;">
                <div style="border-bottom: 2px solid var(--color-accent); padding-bottom: 5px; color: var(--color-accent);">COMMAND DECK</div>
                <button class="cmd-btn ${planet.scanned ? 'cmd-done' : ''}" id="btn-scan" ${this.state.energy < 2 || planet.scanned ? 'disabled' : ''}>
                    <div>DEEP SCAN</div>
                    <div class="cost">${planet.scanned ? 'DONE' : '-2 ENERGY'}</div>
                </button>

                ${planet.isStation && !planet.stationInvestigated
                    ? `<button class="cmd-btn" id="btn-station" style="border-color: #74d99a; color: #74d99a;">
                        <div>BOARD STATION</div>
                        <div class="cost" style="color: #74d99a;">DOCKING PORT ACCESSIBLE</div>
                       </button>`
                    : (planet.isStation && planet.stationInvestigated
                        ? `<button class="cmd-btn cmd-done" id="btn-station" disabled>
                            <div>BOARD STATION</div>
                            <div class="cost">DONE — NOTHING LEFT</div>
                           </button>`
                        : '')
                }

                ${planet.isAsteroidField && !planet.asteroidMined
                    ? `<button class="cmd-btn" id="btn-asteroid" style="border-color: #74d99a; color: #74d99a;">
                        <div>BEGIN MINING</div>
                        <div class="cost" style="color: #74d99a;">EXTRACTION READY</div>
                       </button>`
                    : (planet.isAsteroidField && planet.asteroidMined
                        ? `<button class="cmd-btn" id="btn-asteroid" disabled style="border-color: #555; color: #555;">
                            <div>FIELD MINED</div>
                            <div class="cost">RESOURCES DEPLETED</div>
                           </button>`
                        : '')
                }

                ${this.state.probeIntegrity > 0
                ? `<button class="cmd-btn" id="btn-probe">
                         <div>LAUNCH PROBE</div><div class="cost">Integrity: ${this.state.probeIntegrity.toFixed(0)}%</div>
                       </button>`
                : `<button class="cmd-btn danger" id="btn-probe" ${this.state.salvage < 50 ? 'disabled' : ''}>
                         <div>FABRICATE PROBE</div>
                         <div class="cost">${this.state.salvage < 50 ? 'NEED 50 SALVAGE' : '-50 SALVAGE'}</div>
                       </button>`
            }

                 <button class="cmd-btn ${planet.hasEva ? 'cmd-done' : ''}" id="btn-eva" ${this.state.energy < 5 || planet.hasEva ? 'disabled' : ''}>
                    <div>${planet.hasEva ? 'SEND TEAM OUT' : 'SEND TEAM OUT (EVA)'}</div>
                    <div class="cost">${planet.hasEva ? 'DONE — ONE TRIP PER STOP' : '-5 ENERGY · CREW AT RISK'}</div>
                </button>

                ${planet.scanned && planet.tags && planet.tags.includes('EXODUS_WRECK') && !planet.exodusInvestigated
                    ? `<button class="cmd-btn" id="btn-exodus" style="border-color: #74d99a; color: #74d99a;">
                        <div>INVESTIGATE EXODUS WRECK</div>
                        <div class="cost" style="color: #74d99a;">HUMAN TRANSPONDER DETECTED</div>
                       </button>`
                    : (planet.exodusInvestigated
                        ? `<button class="cmd-btn" id="btn-exodus" disabled style="border-color: #555; color: #555;">
                            <div>EXODUS WRECK INVESTIGATED</div>
                            <div class="cost">SITE CLEARED</div>
                           </button>`
                        : '')
                }

                ${planet.scanned && planet.tags && planet.tags.includes('FAILED_COLONY') && !planet.colonyInvestigated
                    ? `<button class="cmd-btn" id="btn-colony-site" style="border-color: #74d99a; color: #74d99a;">
                        <div>INVESTIGATE COLONY SITE</div>
                        <div class="cost" style="color: #74d99a;">SETTLEMENT RUINS DETECTED</div>
                       </button>`
                    : (planet.colonyInvestigated
                        ? `<button class="cmd-btn" id="btn-colony-site" disabled style="border-color: #555; color: #555;">
                            <div>COLONY SITE INVESTIGATED</div>
                            <div class="cost">RUINS CATALOGUED</div>
                           </button>`
                        : '')
                }

                ${planet.scanned && planet.tags && planet.tags.includes('DERELICT') && !planet.derelictInvestigated
                    ? `<button class="cmd-btn" id="btn-derelict" style="border-color: #74d99a; color: #74d99a;">
                        <div>INVESTIGATE DERELICT</div>
                        <div class="cost" style="color: #74d99a;">SHIP WRECKAGE DETECTED</div>
                       </button>`
                    : (planet.derelictInvestigated
                        ? `<button class="cmd-btn" id="btn-derelict" disabled style="border-color: #555; color: #555;">
                            <div>DERELICT INVESTIGATED</div>
                            <div class="cost">WRECK SALVAGED</div>
                           </button>`
                        : '')
                }

                ${planet.scanned && planet.tags && planet.tags.includes('ANOMALY') && !planet.anomalyInvestigated
                    ? `<button class="cmd-btn" id="btn-anomaly" style="border-color: #d9a24a; color: #d9a24a; animation: anomaly-pulse 2s infinite;">
                        <div>APPROACH ANOMALY</div>
                        <div class="cost" style="color: #d9a24a;">⚠ REALITY DISTORTION</div>
                       </button>`
                    : (planet.anomalyInvestigated
                        ? `<button class="cmd-btn" id="btn-anomaly" disabled style="border-color: #555; color: #555;">
                            <div>ANOMALY INVESTIGATED</div>
                            <div class="cost">PHENOMENON DOCUMENTED</div>
                           </button>`
                        : '')
                }

                ${planet.scanned && planet.tags && planet.tags.includes('LIGHTHOUSE') && !planet.lighthouseInvestigated
                    ? `<button class="cmd-btn" id="btn-lighthouse" style="border-color: #74d99a; color: #74d99a;">
                        <div>🗼 APPROACH THE LIGHTHOUSE</div>
                        <div class="cost" style="color: #74d99a;">ANCIENT BEACON SIGNAL</div>
                       </button>`
                    : (planet.lighthouseInvestigated
                        ? `<button class="cmd-btn" id="btn-lighthouse" disabled style="border-color: #555; color: #555;">
                            <div>LIGHTHOUSE INVESTIGATED</div>
                            <div class="cost">NAVIGATION DATA RECORDED</div>
                           </button>`
                        : '')
                }

                ${planet.scanned && planet.tags && planet.tags.includes('GARDEN') && !planet.gardenInvestigated
                    ? `<button class="cmd-btn" id="btn-garden" style="border-color: #74d99a; color: #74d99a;">
                        <div>🌿 ENTER THE GARDEN</div>
                        <div class="cost" style="color: #74d99a;">BIODOME ACCESS DETECTED</div>
                       </button>`
                    : (planet.gardenInvestigated
                        ? `<button class="cmd-btn" id="btn-garden" disabled style="border-color: #555; color: #555;">
                            <div>GARDEN EXPLORED</div>
                            <div class="cost">ECOSYSTEM CATALOGUED</div>
                           </button>`
                        : '')
                }

                ${planet.scanned && planet.tags && planet.tags.includes('GRAVE') && !planet.graveInvestigated
                    ? `<button class="cmd-btn" id="btn-grave" style="border-color: #888888; color: #888888;">
                        <div>⚰ VISIT THE GRAVE</div>
                        <div class="cost" style="color: #888888;">ETERNAL CEMETERY</div>
                       </button>`
                    : (planet.graveInvestigated
                        ? `<button class="cmd-btn" id="btn-grave" disabled style="border-color: #555; color: #555;">
                            <div>GRAVE VISITED</div>
                            <div class="cost">MEMORIALS OBSERVED</div>
                           </button>`
                        : '')
                }

                ${planet.isStructure && !planet.structureApproached
                    ? `<button class="cmd-btn" id="btn-structure" style="border-color: #ffffff; color: #ffffff; animation: structure-pulse 3s infinite; background: linear-gradient(135deg, rgba(68,0,136,0.3), rgba(136,68,255,0.2));">
                        <div style="font-size: 1.1em; font-weight: bold;">APPROACH THE STRUCTURE</div>
                        <div class="cost" style="color: #ccaaff;">/// THE THRESHOLD AWAITS ///</div>
                       </button>`
                    : (planet.structureApproached
                        ? `<button class="cmd-btn" id="btn-structure" disabled style="border-color: #555; color: #555;">
                            <div>THRESHOLD CROSSED</div>
                            <div class="cost">YOUR CHOICE HAS BEEN MADE</div>
                           </button>`
                        : '')
                }

                ${planet._isWrongPlace
                    ? `<div style="margin-top: 20px; border-top: 1px dashed #d85a4e; padding-top: 15px;">
                        <div style="color: #d85a4e; font-size: 0.9em; margin-bottom: 10px; text-align: center;">
                            /// THE WRONG PLACE ///
                        </div>
                        <button class="cmd-btn" id="btn-wrong-escape" style="border-color: #d9a24a; color: #d9a24a; margin-bottom: 8px;">
                            <div>FIGHT TO ESCAPE</div>
                            <div class="cost">TEAR THROUGH REALITY</div>
                        </button>
                        <button class="cmd-btn" id="btn-wrong-accept" style="border-color: #d85a4e; color: #d85a4e;">
                            <div>ACCEPT YOUR FATE</div>
                            <div class="cost">BECOME PART OF THIS PLACE</div>
                        </button>
                       </div>`
                    : `<button class="cmd-btn danger" id="btn-leave" style="margin-top: 20px; border-top: 1px dashed var(--color-primary-dim); padding-top: 20px;">
                        <div>BREAK ORBIT</div><div class="cost">RETURN TO MAP</div>
                       </button>`
                }

                ${!planet.isStructure && !planet._isWrongPlace && !planet.isStation && !planet.isAsteroidField ? `<button class="cmd-btn" id="btn-colony" style="border-color: var(--green); color: var(--green); margin-top: auto;">
                    <div>ESTABLISH COLONY</div><div class="cost">END JOURNEY</div>
                </button>` : ''}
             </div>
        `;

        const style = document.createElement('style');
        style.innerHTML = `
            .cmd-btn { background: transparent; border: 1px solid var(--line2); color: var(--bone); padding: 13px 15px; text-align: left; cursor: pointer; font-family: var(--font-display); letter-spacing: 0.08em; text-transform: uppercase; font-size: 0.92em; transition: all 0.15s; display: flex; justify-content: space-between; align-items: center; }
            .cmd-btn:hover:not([disabled]) { border-color: var(--green-d); background: rgba(116,217,154,0.06); color: var(--green-br); }
            .cmd-btn:disabled { border-color: var(--line); color: var(--faint); cursor: not-allowed; }
            .cmd-btn.danger { border-color: var(--line2); color: var(--amber); }
            .cmd-btn.danger:hover { border-color: var(--amber); background: rgba(217,162,74,0.08); color: var(--amber); }
            .cost { font-size: 0.7em; opacity: 0.7; }
            @keyframes spin { 100% { transform: translate(-50%, -50%) rotate(360deg); } }
            @keyframes predatory-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
            @keyframes anomaly-pulse { 0%, 100% { box-shadow: 0 0 5px #d9a24a; } 50% { box-shadow: 0 0 20px #d9a24a, 0 0 30px #d9a24a44; } }
            @keyframes structure-pulse { 0%, 100% { box-shadow: 0 0 10px #8844ff, 0 0 20px rgba(136,68,255,0.3); } 50% { box-shadow: 0 0 30px #ffffff, 0 0 50px rgba(255,255,255,0.4), 0 0 70px rgba(136,68,255,0.5); } }
        `;
        rightPanel.appendChild(style);

        rightPanel.querySelector('#btn-scan').addEventListener('click', () => window.dispatchEvent(new CustomEvent('req-action-scan')));
        rightPanel.querySelector('#btn-probe').addEventListener('click', () => window.dispatchEvent(new CustomEvent('req-action-probe')));

        const btnEva = rightPanel.querySelector('#btn-eva');
        if (btnEva) btnEva.addEventListener('click', () => window.dispatchEvent(new CustomEvent('req-action-eva')));

        const btnStation = rightPanel.querySelector('#btn-station:not([disabled])');
        if (btnStation) btnStation.addEventListener('click', () => window.dispatchEvent(new CustomEvent('req-action-station')));

        const btnAsteroid = rightPanel.querySelector('#btn-asteroid:not([disabled])');
        if (btnAsteroid) btnAsteroid.addEventListener('click', () => window.dispatchEvent(new CustomEvent('req-action-asteroid')));

        const btnExodus = rightPanel.querySelector('#btn-exodus:not([disabled])');
        if (btnExodus) btnExodus.addEventListener('click', () => window.dispatchEvent(new CustomEvent('req-action-exodus')));

        const btnColonySite = rightPanel.querySelector('#btn-colony-site:not([disabled])');
        if (btnColonySite) btnColonySite.addEventListener('click', () => window.dispatchEvent(new CustomEvent('req-action-colony-site')));

        const btnDerelict = rightPanel.querySelector('#btn-derelict:not([disabled])');
        if (btnDerelict) btnDerelict.addEventListener('click', () => window.dispatchEvent(new CustomEvent('req-action-derelict')));

        const btnAnomaly = rightPanel.querySelector('#btn-anomaly:not([disabled])');
        if (btnAnomaly) btnAnomaly.addEventListener('click', () => window.dispatchEvent(new CustomEvent('req-action-anomaly')));

        // Late-game POI buttons
        const btnLighthouse = rightPanel.querySelector('#btn-lighthouse:not([disabled])');
        if (btnLighthouse) btnLighthouse.addEventListener('click', () => window.dispatchEvent(new CustomEvent('req-action-lighthouse')));

        const btnGarden = rightPanel.querySelector('#btn-garden:not([disabled])');
        if (btnGarden) btnGarden.addEventListener('click', () => window.dispatchEvent(new CustomEvent('req-action-garden')));

        const btnGrave = rightPanel.querySelector('#btn-grave:not([disabled])');
        if (btnGrave) btnGrave.addEventListener('click', () => window.dispatchEvent(new CustomEvent('req-action-grave')));

        const btnStructure = rightPanel.querySelector('#btn-structure:not([disabled])');
        if (btnStructure) btnStructure.addEventListener('click', () => window.dispatchEvent(new CustomEvent('req-action-structure')));

        const btnColony = rightPanel.querySelector('#btn-colony');
        if (btnColony) btnColony.addEventListener('click', () => window.dispatchEvent(new CustomEvent('req-action-colony')));

        const btnLeave = rightPanel.querySelector('#btn-leave');
        if (btnLeave) btnLeave.addEventListener('click', () => window.dispatchEvent(new Event('req-break-orbit')));

        // THE WRONG PLACE special buttons
        const btnWrongEscape = rightPanel.querySelector('#btn-wrong-escape');
        if (btnWrongEscape) btnWrongEscape.addEventListener('click', () => window.dispatchEvent(new CustomEvent('req-wrong-escape')));

        const btnWrongAccept = rightPanel.querySelector('#btn-wrong-accept');
        if (btnWrongAccept) btnWrongAccept.addEventListener('click', () => window.dispatchEvent(new CustomEvent('req-wrong-accept')));
    }
}
