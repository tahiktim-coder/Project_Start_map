/* FabricatorPanel — the upgrade shop. One card per part: pixel icon, what it does in plain words,
   where it bolts onto the ship, and a single buy button. Installed parts are ticked, and because
   ShipCutaway draws every installed id, buying one visibly changes the ship behind the panel. */

(function () {
    'use strict';
    const ICON_SCALE = 4;
    const ICON_COLORS = { '#': '#3d6b58', '+': '#9bf0bd' };
    const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

    function paintIcon(canvas, rows) {
        const ctx = canvas.getContext('2d');
        rows.forEach((row, y) => {
            for (let x = 0; x < row.length; x++) {
                if (!ICON_COLORS[row[x]]) continue;
                ctx.fillStyle = ICON_COLORS[row[x]];
                ctx.fillRect(x * ICON_SCALE, y * ICON_SCALE, ICON_SCALE, ICON_SCALE);
            }
        });
    }

    function priceOf(state, upgrade) {
        if (window.TEST_MODE) return 0; // matches App.buyUpgrade
        return state.hasActiveTrait('HOARDER') ? Math.ceil(upgrade.cost * 1.25) : upgrade.cost;
    }

    function card(state, upgrade) {
        const isInstalled = state.upgrades.includes(upgrade.id), price = priceOf(state, upgrade), canAfford = state.salvage >= price;
        const size = (upgrade.icon ? upgrade.icon.length : 12) * ICON_SCALE;
        const button = isInstalled
            ? '<p class="fab-card-installed">✓ INSTALLED</p>'
            : `<button class="deck-action fab-buy" data-id="${esc(upgrade.id)}" ${canAfford ? '' : 'disabled'}>`
                + `<span>BUILD</span><small>${price} salvage${canAfford ? '' : ' — need ' + (price - state.salvage) + ' more'}</small></button>`;
        return `
            <li class="fab-card ${isInstalled ? 'is-installed' : ''}">
                <canvas class="fab-card-icon" width="${size}" height="${size}" data-id="${esc(upgrade.id)}"></canvas>
                <div class="fab-card-text">
                    <h4>${esc(upgrade.name)}</h4>
                    <p class="fab-card-effect">${esc(upgrade.effect)}</p>
                    <p class="fab-card-desc">${esc(upgrade.desc)} <em>Mounts: ${esc(upgrade.mount || 'hull')}.</em></p>
                </div>
                ${button}
            </li>`;
    }

    function show(app) {
        const state = app.state, upgrades = Object.values(UPGRADES);
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <section class="modal-content deck-panel fab-panel" role="dialog" aria-label="Fabricator">
                <header class="deck-panel-head">
                    <h3>FABRICATOR</h3>
                    <span class="fab-panel-salvage">${state.salvage} salvage to spend</span>
                    <button class="deck-panel-close close-modal" aria-label="Close">✕</button>
                </header>
                <p class="fab-panel-note">Every part you build is bolted onto the ship — watch the schematic.${state.hasActiveTrait('HOARDER') ? ' <b>A hoarding crew member is making everything cost 25% more.</b>' : ''}</p>
                <ul class="fab-grid">${upgrades.map(u => card(state, u)).join('')}</ul>
            </section>`;
        document.body.appendChild(modal);

        modal.querySelectorAll('.fab-card-icon').forEach(canvas => {
            const upgrade = upgrades.find(u => u.id === canvas.dataset.id);
            if (upgrade && upgrade.icon) paintIcon(canvas, upgrade.icon);
        });
        modal.querySelectorAll('.fab-buy:not([disabled])').forEach(btn => {
            btn.addEventListener('click', () => app.buyUpgrade(btn.dataset.id, modal)); // buyUpgrade re-opens the panel
        });
        const close = () => modal.remove();
        modal.querySelector('.close-modal').addEventListener('click', close);
        modal.addEventListener('click', e => { if (e.target === modal) close(); });
    }

    window.FabricatorPanel = { show };
})();
