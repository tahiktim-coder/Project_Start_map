/* EndScreens — full-screen closing cards in the shared visual language.
   gameOver(app, detail): what went wrong, who was lost (with faces), the run in six numbers, one button. */

(function () {
    'use strict';
    const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

    function memorialHtml(dead) {
        if (dead.length === 0) return '';
        const rows = dead.map(c => `
            <li>
                ${c.portraitId ? `<img src="assets/crew/${esc(c.portraitId)}.png" alt="">` : ''}
                <div><b>${esc(c.realName || c.name)}</b><span>${esc(c._deathCause || 'lost')} — ${esc(c._deathPlanet || 'deep space')}</span></div>
            </li>`).join('');
        return `<h4>IN THE STASIS PODS</h4><ul class="end-memorial">${rows}</ul>`;
    }

    function statsHtml(state, dead) {
        const visited = (state.sectorNodes || []).filter(p => p.scanned || p.hasEva).length;
        const stats = [
            ['SECTOR REACHED', `${state.currentSector} of 6`], ['CREW LOST', `${dead.length} of ${state.crew.length}`],
            ['PLACES EXPLORED', visited], ['SALVAGE', state.salvage], ['RATIONS LEFT', state.rations],
            ['PAGES FOUND', `${(state.exodusLogsFound || []).length} of 6`],
        ];
        return `<dl class="end-stats">${stats.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;
    }

    function gameOver(app, detail) {
        const state = app.state, dead = state.crew.filter(c => c.status === 'DEAD');
        const overlay = document.createElement('div');
        overlay.className = 'end-screen is-loss';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-label', 'Mission lost');
        overlay.innerHTML = `
            <section class="end-card">
                <p class="end-kicker">MISSION LOST</p>
                <h2 class="end-title">${esc(detail.title || 'SILENCE')}</h2>
                <p class="end-message">${detail.message || ''}</p>
                ${memorialHtml(dead)}
                ${statsHtml(state, dead)}
                <button class="deck-action end-again"><span>TRY AGAIN</span><small>a new crew, the same road</small></button>
            </section>`;
        document.body.appendChild(overlay);
        const again = overlay.querySelector('.end-again');
        again.addEventListener('click', () => location.reload());
        again.focus({ preventScroll: true }); // keep the title in view, not the button
    }

    // ── shared pieces for the endings that are not a loss ──
    function rosterHtml(crew, survivorNote) {
        return `<ul class="end-roster">${crew.map(c => {
            const isDead = c.status === 'DEAD', marks = [];
            if ((c.tags || []).includes('HIVE_MIND')) marks.push('symbiote');
            if ((c.tags || []).includes('MACHINE_LINK')) marks.push('machine-linked');
            if ((c.tags || []).includes('WRONG_PLACE_SURVIVOR')) marks.push('touched');
            return `<li class="${isDead ? 'is-dead' : ''}">
                ${c.portraitId ? `<img src="assets/crew/${esc(c.portraitId)}.png" alt="">` : ''}
                <div><b>${esc(c.realName || c.name)}</b><span>${isDead ? 'did not make it' : (marks.join(', ') || survivorNote || 'made it')}</span></div>
            </li>`;
        }).join('')}</ul>`;
    }

    const statRow = pairs => `<dl class="end-stats">${pairs.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;

    /** Card markup for the Structure / Wrong Place endings. bundle.js wires the #btn-new-game button. */
    function endingHtml(state, result, textHtml) {
        const living = state.crew.filter(c => c.status !== 'DEAD');
        return `
            <section class="end-card is-ending" role="dialog" aria-label="Ending">
                <p class="end-kicker">THE JOURNEY ENDS</p>
                <h2 class="end-title">${esc(result.title || '')}</h2>
                <div class="end-story">${textHtml}</div>
                <h4>THE CREW</h4>
                ${rosterHtml(state.crew)}
                ${statRow([['SECTOR', `${state.currentSector} of 6`], ['SURVIVORS', `${living.length} of ${state.crew.length}`],
                    ['PAGES FOUND', `${(state.exodusLogsFound || []).length} of 6`], ['DATA', state._colonyKnowledge || 0],
                    ['SALVAGE', state.salvage], ['ENERGY', state.energy + '%']])}
                <button class="deck-action end-again" id="btn-new-game"><span>BEGIN AGAIN</span><small>a new crew, the same road</small></button>
            </section>`;
    }

    /** Full-screen colony result: the world you chose, what became of it, who was there. */
    function colony(app, planet, outcome, facts) {
        const state = app.state, isWin = !!outcome.success;
        const hasEndings = typeof EndingSystem !== 'undefined'; // a class declaration, so it is not on window
        const viability = hasEndings ? EndingSystem.getPlanetViability(planet, state) : '';
        const epilogue = isWin && hasEndings ? EndingSystem.generateEpilogue(planet, state, outcome.title) : '';
        const metrics = planet.metrics || {};
        const overlay = document.createElement('div');
        overlay.className = 'end-screen ' + (isWin ? 'is-win' : 'is-loss');
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-label', 'Colony result');
        overlay.innerHTML = `
            <section class="end-card ${isWin ? 'is-ending' : ''}">
                <div class="end-world">${window.BodyRenderer ? (BodyRenderer.body(planet, 150) || '') : ''}</div>
                <p class="end-kicker">${isWin ? 'COLONY FOUNDED' : 'THE COLONY FAILED'} · ${esc(planet.name)}</p>
                <h2 class="end-title">${esc(outcome.title || '')}</h2>
                <div class="end-story">${outcome.text || ''}${epilogue}</div>
                <h4>THE WORLD YOU CHOSE</h4>
                ${statRow([['TYPE', String(planet.type || '').replace(/_/g, ' ')], ['HOW LIVEABLE', viability], ['AIR', planet.atmosphere || '?'],
                    ['GRAVITY', (metrics.gravity != null ? metrics.gravity.toFixed(1) : '?') + ' G'],
                    ['TEMPERATURE', (metrics.temp != null ? metrics.temp : '?') + ' °C'], ['LIFE', metrics.hasLife ? 'yes' : 'none']])}
                <h4>THE CREW</h4>
                ${rosterHtml(state.crew, isWin ? 'a founder' : 'lost with the colony')}
                ${statRow([['COLONY RATING', facts.rating], ['SURVIVORS', `${facts.survivors} of ${state.crew.length}`], ['AVERAGE STRESS', facts.avgStress],
                    ['DATA GATHERED', facts.colonyKnowledge], ['UPGRADES BUILT', (state.upgrades || []).length], ['SECTOR', `${state.currentSector} of 6`]])}
                <button class="deck-action end-again"><span>BEGIN AGAIN</span><small>a new crew, the same road</small></button>
            </section>`;
        document.body.appendChild(overlay);
        const again = overlay.querySelector('.end-again');
        again.addEventListener('click', () => {
            try { localStorage.removeItem('silentExodus_save'); } catch (e) { /* storage blocked: the reload still restarts */ }
            location.reload();
        });
        again.focus({ preventScroll: true }); // keep the title in view, not the button
    }

    window.EndScreens = { gameOver, endingHtml, colony };
})();
