/* RosterPanel — the crew manifest and the cargo list in the shared card language.
   crew(app): one row per person — face, job, where they are, how they are holding up, and a REST button
   only when resting is actually possible. cargo(app): one card per item with a USE button only on
   things that can be used. Both replace legacy modals in bundle.js, which stay as fallbacks. */

(function () {
    'use strict';
    const JOB = { LEADER: 'Commander', ENGINEER: 'Engineer', MEDIC: 'Doctor', SECURITY: 'Security', SPECIALIST: 'Technician' };
    const ROOM = { bridge: 'Bridge', lab: 'Laboratory', quarters: 'Crew quarters', cargo: 'Cargo hold', engineering: 'Engineering' };
    const STRESS_WORD = ['calm', 'uneasy', 'strained', 'breaking'];
    const ITEM_KIND = { CONSUMABLE: 'can be used once', ARTIFACT: 'keepsake', RESOURCE: 'raw material', LORE: 'a piece of the story' };
    const FALLBACK_CARGO_LIMIT = 20;
    const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

    function open(className, label, inner) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `<section class="modal-content deck-panel ${className}" role="dialog" aria-label="${label}">${inner}</section>`;
        document.body.appendChild(modal);
        const close = () => modal.remove();
        modal.querySelector('.close-modal').addEventListener('click', close);
        modal.addEventListener('click', e => { if (e.target === modal) close(); });
        return modal;
    }

    // ── crew ──
    function personRow(member, index, canRest, cut) {
        const tags = member.tags || [], isDead = member.status === 'DEAD';
        const job = JOB[Object.keys(JOB).find(t => tags.includes(t))] || 'Crew';
        const held = tags.includes('SEDATED') ? 'sedated' : tags.includes('CONFINED') ? 'confined to quarters' : '';
        const stress = Math.max(0, Math.min(3, member.stress || 0));
        const color = cut ? `rgb(${cut.colorOf(member).join(',')})` : 'var(--bone)';
        const where = isDead ? 'Stasis pod, cargo hold' : (cut ? ROOM[cut.stationOf(member)] : '');
        const state = window.PlainWords ? window.PlainWords.status(member) : (isDead ? 'dead' : held || member.status.toLowerCase());
        const pips = [0, 1, 2].map(i => `<i class="${i < stress ? 'is-on' : ''}"></i>`).join('');
        const rest = (!isDead && !held && stress > 0)
            ? `<button class="deck-action roster-rest" data-idx="${index}" ${canRest ? '' : 'disabled'}><span>REST</span><small>${canRest ? '1 ration · stress −1' : 'not possible right now'}</small></button>` : '';
        return `
            <li class="roster-person ${isDead ? 'is-dead' : ''} stress-${stress}">
                <img src="assets/crew/${esc(member.portraitId || '')}.png" alt="" style="border-color:${color}">
                <div class="roster-who">
                    <b>${esc(member.realName || member.name)}</b>
                    <span>${job}, ${esc(member.age || '?')} · ${esc(where)}</span>
                    ${member.trait ? `<em>${esc(String(member.trait).toLowerCase())}</em>` : ''}
                </div>
                <div class="roster-state">
                    <span class="roster-health is-${esc(state.split(' ')[0])}">${esc(state)}</span>
                    ${isDead ? '' : `<span class="roster-stress" title="stress">${pips}<small>${STRESS_WORD[stress]}</small></span>`}
                </div>
                ${rest}
            </li>`;
    }

    function crew(app) {
        const state = app.state, cut = window.ShipCutaway;
        const isQuartersOk = state.isDeckOperational('quarters'), canRest = isQuartersOk && state.rations >= 1;
        const modal = open('roster-panel', 'The crew', `
            <header class="deck-panel-head"><h3>THE CREW</h3>
                <span class="deck-panel-status">${state.crew.filter(c => c.status !== 'DEAD').length} OF ${state.crew.length} ALIVE</span>
                <button class="deck-panel-close close-modal" aria-label="Close">✕</button></header>
            ${isQuartersOk ? '' : '<p class="roster-note is-bad">Crew quarters are out of action — nobody can rest until they are repaired.</p>'}
            <ul class="roster-list">${state.crew.map((m, i) => personRow(m, i, canRest, cut)).join('')}</ul>`);
        modal.querySelectorAll('.roster-rest:not([disabled])').forEach(btn => btn.addEventListener('click', () => {
            const member = state.crew[+btn.dataset.idx];
            if (!member || !(member.stress > 0) || state.rations < 1) return;
            state.rations -= 1;
            member.stress -= 1;
            state.addLog(`${member.name}: Rest cycle authorized. Stress reduced. (-1 Ration)`);
            state.emitUpdates();
            modal.remove();
            crew(app);
        }));
    }

    // ── cargo ──
    function itemCard(item, index) {
        const canUse = !!item.onUse || (item.type && String(item.type).startsWith('REVIVAL_'));
        return `
            <li class="cargo-item">
                ${window.ItemIcons ? window.ItemIcons.iconHtml(item) : ''}
                <h4>${esc(item.name)}</h4>
                <p>${esc(item.desc || '')}</p>
                <small>${esc(ITEM_KIND[item.type] || String(item.type || '').replace(/_/g, ' ').toLowerCase())}${item.acquiredAt ? ' · from ' + esc(item.acquiredAt) : ''}</small>
                ${canUse ? `<button class="deck-action cargo-use" data-idx="${index}"><span>USE</span></button>` : ''}
            </li>`;
    }

    function cargo(app) {
        const state = app.state, count = state.cargo.length;
        const limit = state.getCargoLimit ? state.getCargoLimit() : FALLBACK_CARGO_LIMIT;
        const modal = open('cargo-panel', 'Cargo hold', `
            <header class="deck-panel-head"><h3>CARGO HOLD</h3>
                <span class="deck-panel-status">${count} OF ${limit} ITEMS${count >= limit ? ' — FULL' : ''}</span>
                <button class="deck-panel-close close-modal" aria-label="Close">✕</button></header>
            ${count === 0 ? '<p class="roster-note">Empty. Probes, away teams and boarding parties bring things back here.</p>'
                : `<ul class="cargo-grid">${state.cargo.map(itemCard).join('')}</ul>`}`);
        if (window.ItemIcons) window.ItemIcons.hydrate(modal);
        modal.querySelectorAll('.cargo-use').forEach(btn => btn.addEventListener('click', () => {
            modal.remove();
            app.handleItemUse(+btn.dataset.idx);
            if (!document.querySelector('.modal-overlay')) cargo(app); // a revival opens its own pop-up instead
        }));
    }

    window.RosterPanel = { crew, cargo };
})();
