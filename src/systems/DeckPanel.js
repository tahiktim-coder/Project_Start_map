/* DeckPanel — the card that opens when a room of the ship cutaway is clicked.
   Rule of the layout: information is plain text, only things you can press look like buttons.
   Sections: status line → what the room does / what breaks → who is in it → actions. */

(function () {
    'use strict';

    const ROOM_INFO = {
        bridge: { does: 'Navigation, long-range scans, A.U.R.A. core.', broken: 'Warp costs +50%. Long-range scan offline.', usedFrom: 'Used from the navigation map.' },
        lab: { does: 'Deep scans and item identification.', broken: 'Scans return partial data. Items stay unidentified.', usedFrom: 'Used from orbit.' },
        quarters: { does: 'Crew heal and shed stress here between jumps.', broken: 'No healing. No stress recovery.' },
        cargo: { does: 'Holds what you bring back — anything over the limit is left behind. Stasis pods for the dead.', broken: 'Capacity halved.' },
        engineering: { does: 'Drives, probe fabrication, the fabricator.', broken: 'No probes. Sector jump costs double. Repairs +50%.' },
    };
    const RGB = c => `rgb(${c.join(',')})`;
    const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

    function repairQuote(state, deckKey) {
        const deck = state.shipDecks[deckKey];
        const hasEngineer = state.crew.some(c => c.tags.includes('ENGINEER') && c.status !== 'DEAD');
        const isEngineeringDown = deckKey !== 'engineering' && state.shipDecks.engineering.status === 'DAMAGED';
        let cost = deck.repairCost;
        if (hasEngineer) cost = Math.floor(cost * 0.7);
        if (isEngineeringDown) cost = Math.floor(cost * 1.5);
        const notes = [hasEngineer ? 'engineer aboard −30%' : '', isEngineeringDown ? 'engineering offline +50%' : ''].filter(Boolean).join(' · ');
        return { cost, notes, canAfford: state.salvage >= cost };
    }

    function crewRow(member, note) {
        const cut = window.ShipCutaway, color = cut ? RGB(cut.colorOf(member)) : 'var(--bone)';
        const face = member.portraitId ? `<img class="deck-panel-face" src="assets/crew/${esc(member.portraitId)}.png" alt="" style="border-color:${color}">` : '';
        const mood = member.status !== 'HEALTHY' ? member.status : (member.stress >= 2 ? 'STRESSED' : 'ON DUTY');
        return `<li>${face}<span class="deck-panel-swatch" style="background:${color}"></span>`
            + `<span class="deck-panel-name">${esc(member.name)}</span><span class="deck-panel-mood">${esc(note || mood)}</span></li>`;
    }

    function occupants(state, deckKey) {
        const cut = window.ShipCutaway;
        if (!cut) return '';
        const here = state.crew.filter(c => c.status !== 'DEAD' && cut.stationOf(c) === deckKey).map(c => crewRow(c));
        const pods = deckKey === 'cargo' ? state.crew.filter(c => c.status === 'DEAD').map(c => crewRow(c, 'IN STASIS POD')) : [];
        const rows = here.concat(pods);
        return `<h4>IN THIS ROOM</h4>${rows.length ? `<ul class="deck-panel-crew">${rows.join('')}</ul>` : '<p class="deck-panel-empty">Nobody.</p>'}`;
    }

    function actions(state, deckKey, quote) {
        const deck = state.shipDecks[deckKey], out = [];
        if (deck.status === 'DAMAGED') {
            out.push(`<button class="deck-action deck-action-repair" data-act="repair" ${quote.canAfford ? '' : 'disabled'}>`
                + `<span>REPAIR ROOM</span><small>${quote.cost} salvage · you have ${state.salvage}${quote.notes ? ' · ' + quote.notes : ''}</small></button>`);
        }
        if (deckKey === 'cargo') out.push(`<button class="deck-action" data-act="cargo"><span>OPEN CARGO</span><small>${state.cargo.length} / ${state.getCargoLimit ? state.getCargoLimit() : 20} items</small></button>`);
        if (deckKey === 'quarters') out.push(`<button class="deck-action" data-act="crew"><span>CREW MANIFEST</span><small>health, stress, rest</small></button>`);
        if (deckKey === 'engineering') {
            out.push(`<button class="deck-action" data-act="fab" ${deck.status === 'DAMAGED' ? 'disabled' : ''}>`
                + `<span>OPEN FABRICATOR</span><small>${deck.status === 'DAMAGED' ? 'offline until repaired' : state.upgrades.length + ' modules installed'}</small></button>`);
        }
        return out.length ? `<h4>ACTIONS</h4><div class="deck-panel-actions">${out.join('')}</div>` : '';
    }

    function show(app, deckKey) {
        const state = app.state, deck = state.shipDecks[deckKey], info = ROOM_INFO[deckKey];
        if (!deck || !info) return;
        const isLocked = !!deck._auraLocked, isDamaged = deck.status === 'DAMAGED' || isLocked, quote = repairQuote(state, deckKey);

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <section class="modal-content deck-panel ${isDamaged ? 'is-damaged' : ''}" role="dialog" aria-label="${esc(deck.label)}">
                <header class="deck-panel-head">
                    <h3>${esc(deck.label)}</h3>
                    <span class="deck-panel-status">${isLocked ? 'LOCKED BY A.U.R.A.' : (isDamaged ? 'DAMAGED' : 'OPERATIONAL')}</span>
                    <button class="deck-panel-close close-modal" aria-label="Close">✕</button>
                </header>
                <dl class="deck-panel-facts">
                    <dt>DOES</dt><dd>${info.does}${info.usedFrom ? ` <em>${info.usedFrom}</em>` : ''}</dd>
                    <dt>${isDamaged ? 'RIGHT NOW' : 'IF DAMAGED'}</dt><dd class="${isDamaged ? 'is-bad' : ''}">${info.broken}</dd>
                </dl>
                ${occupants(state, deckKey)}
                ${actions(state, deckKey, quote)}
            </section>`;
        document.body.appendChild(modal);

        const close = () => modal.remove();
        const run = { repair: () => state.repairDeck(deckKey), cargo: () => app.showCargoInventory(), crew: () => app.showCrewManifest(), fab: () => app.showFabricator() };
        modal.querySelectorAll('.deck-action:not([disabled])').forEach(btn => {
            btn.addEventListener('click', () => { close(); run[btn.dataset.act](); });
        });
        modal.querySelector('.close-modal').addEventListener('click', close);
        modal.addEventListener('click', e => { if (e.target === modal) close(); });
    }

    window.DeckPanel = { show };
})();
