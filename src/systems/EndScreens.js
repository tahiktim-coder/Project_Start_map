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
            ['EXODUS LOGS', `${(state.exodusLogsFound || []).length} of 8`],
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
        again.focus();
    }

    window.EndScreens = { gameOver };
})();
