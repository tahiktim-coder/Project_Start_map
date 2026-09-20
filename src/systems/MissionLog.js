/* MissionLog — makes the existing log easy to follow without touching how entries are written.
   bundle.js still appends .log-entry nodes; this watches the container and adds:
     · a category per entry (CREW / SHIP / A.U.R.A. / EVENTS) with filter chips in the header
     · a divider every time you travel, so entries are grouped by stop
     · a "fresh" marker on everything from the latest burst, so when five things happen at once
       you can see exactly which lines are new
     · an EXPAND toggle for reading back
   It also floats "+12" / "−5" beside the header resources whenever they change, so the result of a
   click shows up where the number lives, not only in the log. */

(function () {
    'use strict';
    const container = document.getElementById('log-entries');
    const header = document.querySelector('#mission-log .log-header');
    if (!container || !header) return;

    const FRESH_MS = 7000;              // how long a burst stays highlighted
    const BURST_GAP_MS = 2500;          // a pause this long starts a new burst
    const EXPANDED_HEIGHT = '55vh';
    const RESOURCE_POLL_MS = 300;
    const FILTERS = [['all', 'ALL'], ['crew', 'CREW'], ['ship', 'SHIP'], ['aura', 'A.U.R.A.'], ['event', 'EVENTS']];
    const CREW_NAMES = ['Cmdr.', 'Eng. Jaxon', 'Jaxon', 'Dr. Aris', 'Aris', 'Spc. Vance', 'Vance', 'Tech Mira', 'Mira'];
    const SHIP_WORDS = /energy|salvage|ration|repair|damage|hull|deck|probe|fabricat|drive|burn|fuel|cargo|warp|orbit/i;
    const RESOURCES = [['energy', 'res-energy'], ['salvage', 'res-salvage'], ['rations', 'res-rations'], ['_colonyKnowledge', 'res-knowledge']];

    function categorize(text) {
        if (text.startsWith('A.U.R.A.')) return 'aura';
        if (CREW_NAMES.some(name => text.startsWith(name))) return 'crew';
        return SHIP_WORDS.test(text) ? 'ship' : 'event';
    }

    /** "Warping to X..." and "Sector N Generated" start a new group. */
    function dividerFor(text) {
        const warp = text.match(/^Warping to (.+?)\.{3}$/);
        if (warp) return 'EN ROUTE — ' + warp[1];
        const sector = text.match(/^Sector (\d+) Generated\.?(?: — (.+))?$/);
        return sector ? `SECTOR ${sector[1]}${sector[2] ? ' — ' + sector[2] : ''}` : null;
    }

    // ── header controls ──
    const controls = document.createElement('div');
    controls.className = 'log-controls';
    controls.innerHTML = FILTERS.map(([key, label]) => `<button class="log-filter" data-filter="${key}" aria-pressed="${key === 'all'}">${label}</button>`).join('')
        + '<button class="log-expand" aria-pressed="false">EXPAND</button>';
    header.appendChild(controls);

    controls.addEventListener('click', e => {
        const filter = e.target.closest('.log-filter'), expand = e.target.closest('.log-expand');
        if (filter) {
            container.dataset.filter = filter.dataset.filter;
            controls.querySelectorAll('.log-filter').forEach(b => b.setAttribute('aria-pressed', String(b === filter)));
        }
        if (expand) {
            const isExpanded = expand.getAttribute('aria-pressed') !== 'true';
            expand.setAttribute('aria-pressed', String(isExpanded));
            expand.textContent = isExpanded ? 'SHRINK' : 'EXPAND';
            document.documentElement.style.setProperty('--log-height', isExpanded ? EXPANDED_HEIGHT : '');
            requestAnimationFrame(() => { container.scrollTop = container.scrollHeight; });
        }
    });

    // ── entries ──
    let lastEntryAt = 0, burst = [], shouldResyncResources = false;

    function onEntry(entry) {
        const text = entry.textContent.trim(), now = performance.now();
        if (text.includes('SAVE LOADED') || text.includes('TESTING MODE')) shouldResyncResources = true; // bulk changes, not player results
        entry.dataset.cat = categorize(text);
        const label = dividerFor(text);
        if (label) {
            const divider = document.createElement('div');
            divider.className = 'log-divider';
            divider.textContent = label;
            container.insertBefore(divider, entry);
        }
        if (now - lastEntryAt > BURST_GAP_MS) { // a new burst: the previous one stops being "fresh"
            burst.forEach(old => old.classList.remove('is-fresh'));
            burst = [];
        }
        lastEntryAt = now;
        burst.push(entry);
        entry.classList.add('is-fresh');
        setTimeout(() => entry.classList.remove('is-fresh'), FRESH_MS);
    }

    new MutationObserver(records => {
        records.forEach(record => record.addedNodes.forEach(node => {
            if (node.nodeType === 1 && node.classList.contains('log-entry')) onEntry(node);
        }));
    }).observe(container, { childList: true });
    container.querySelectorAll('.log-entry').forEach(onEntry);

    // ── floating resource deltas beside the header numbers ──
    const known = {};
    function floatDelta(elementId, delta) {
        const anchor = document.getElementById(elementId);
        if (!anchor || !anchor.parentElement) return;
        const tag = document.createElement('span');
        tag.className = 'res-delta ' + (delta > 0 ? 'is-gain' : 'is-loss');
        tag.textContent = (delta > 0 ? '+' : '−') + Math.abs(Math.round(delta));
        anchor.parentElement.appendChild(tag);
        tag.addEventListener('animationend', () => tag.remove());
    }

    setInterval(() => {
        const state = window.app && window.app.state;
        if (!state) return;
        RESOURCES.forEach(([key, elementId]) => {
            const value = state[key] || 0;
            if (!shouldResyncResources && known[key] !== undefined && value !== known[key]) floatDelta(elementId, value - known[key]);
            known[key] = value;
        });
        shouldResyncResources = false;
    }, RESOURCE_POLL_MS);
})();
