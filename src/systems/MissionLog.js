/* MissionLog — turns the plain list of sentences into a ship's journal, without touching how entries are written.
   bundle.js still appends .log-entry nodes; this watches the container and reshapes each one:
     · every stop is a card with a running total ("ATLAS-55 · +32 salvage · −14 energy · Aris hurt")
     · crew and A.U.R.A. lines read as radio chatter: small face, name, the line
     · numbers are lifted out of sentences into tags (+20 Salvage), danger gets a red / amber bar
     · machine chatter ("Starting…", "Scanning…") is tucked away unless the log is expanded
     · filters, a "fresh" marker on the latest burst, EXPAND for reading back
   It also floats "+12" / "−5" beside the header resources whenever they change. */

(function () {
    'use strict';
    const container = document.getElementById('log-entries');
    const panel = document.getElementById('mission-log');
    const header = document.querySelector('#mission-log .log-header');
    if (!container || !header) return;

    const FRESH_MS = 7000;              // how long a burst stays highlighted
    const BURST_GAP_MS = 2500;          // a pause this long starts a new burst
    const EXPANDED_HEIGHT = '55vh';
    const RESOURCE_POLL_MS = 300;
    const FILTERS = [['all', 'ALL'], ['crew', 'CREW'], ['ship', 'SHIP'], ['aura', 'A.U.R.A.'], ['event', 'EVENTS']];
    const SHIP_WORDS = /energy|salvage|ration|repair|damage|hull|deck|probe|fabricat|drive|burn|fuel|cargo|warp|orbit/i;
    const RESOURCES = [['energy', 'res-energy', 'energy'], ['salvage', 'res-salvage', 'salvage'], ['rations', 'res-rations', 'rations'], ['_colonyKnowledge', 'res-knowledge', 'data']];

    const SPEAKERS = { // who can talk in the log: colour and a fallback face for entries written before the game state exists
        'A.U.R.A.': { color: '#74d99a' },
        'Eng. Jaxon': { color: '#f0a030', face: 'M_2' }, 'Jaxon': { color: '#f0a030', face: 'M_2' },
        'Dr. Aris': { color: '#40c8ff', face: 'F_3' }, 'Aris': { color: '#40c8ff', face: 'F_3' },
        'Spc. Vance': { color: '#ff5050', face: 'M_4' }, 'Vance': { color: '#ff5050', face: 'M_4' },
        'Tech Mira': { color: '#d070ff', face: 'F_5' }, 'Mira': { color: '#d070ff', face: 'F_5' },
    };
    const SPEECH = new RegExp(`^(${Object.keys(SPEAKERS).map(n => n.replace(/\./g, '\\.')).join('|')}):\\s*([\\s\\S]+)$`);
    const REWARD = /,?\s*(?:and\s+)?([+\-−]\d+(?:-\d+)?%?\s+(?:Colony Knowledge|Salvage|Energy|Rations?|Data|Stress|Probe Integrity))\b/gi;
    const NOISE = /^(?:Starting|Deep Scan started|Scanning|Launching|Deploying|Exodus transponder|Colony ruins detected|Docking|Approaching|APPROACHING|\[TEST MODE\]|={3,})|\.{3}$/;
    const BAD = /^(?:CRITICAL|CATASTROPHE|HULL BREACH|☠)|DEATH|has died|\bKIA\b|did not come back/;
    const WARN = /^(?:WARNING|ALERT)|⚠|INJURED|is hurt|ran out of air/;
    const SHOUT = /^(?:WARNING|ALERT|CRITICAL|CATASTROPHE|HULL BREACH|☠\s*DEATH):\s*/;
    const GLYPH = { bad: '✕', warn: '!', gain: '+', noise: '·', plain: '›' };
    const HURT_WORDS = { INJURED: 'hurt', CATATONIC: 'not responding', DEAD: 'dead' };

    const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const gameState = () => window.app && window.app.state;
    const shortName = (name) => String(name || '').split(' ').pop();

    function categorize(text) {
        if (text.startsWith('A.U.R.A.')) return 'aura';
        if (SPEECH.test(text)) return 'crew';
        return SHIP_WORDS.test(text) ? 'ship' : 'event';
    }

    /** "Warping to X..." and "Sector N Generated" start a new stop. */
    function stopNameFor(text) {
        const warp = text.match(/^Warping to (.+?)\.{3}$/);
        if (warp) return warp[1];
        const sector = text.match(/^Sector (\d+) Generated\.?(?: — (.+))?$/);
        return sector ? `SECTOR ${sector[1]}${sector[2] ? ' — ' + sector[2] : ''}` : null;
    }

    // ── one entry ──
    function faceHtml(speaker) {
        if (speaker === 'A.U.R.A.') return '<span class="log-face log-face-aura">AI</span>';
        const state = gameState(), last = shortName(speaker).toLowerCase();
        const member = state && state.crew.find(c => c.name && c.name.toLowerCase().includes(last));
        const portrait = (member && member.portraitId) || SPEAKERS[speaker].face;
        return portrait ? `<img class="log-face" src="assets/crew/${esc(portrait)}.png" alt="">` : '<span class="log-face"></span>';
    }

    function speechHtml(speaker, line) {
        const quote = line.trim().replace(/^["'“]+|["'”]+$/g, '');
        return `${faceHtml(speaker)}<span class="log-body"><b style="color:${SPEAKERS[speaker].color}">${esc(shortName(speaker))}</b>${esc(quote)}</span>`;
    }

    /** Lifts "+20 Salvage" style fragments out of the sentence; returns the tidied sentence and the tags. */
    function splitRewards(text) {
        const tags = [];
        const sentence = text.replace(REWARD, (_, hit) => { tags.push(hit.trim()); return ''; })
            .replace(/\s+([.,;:!])/g, '$1').replace(/[,;:]\s*(?=[.!]|$)/g, '').replace(/(^|[.!]\s*)[.,;:]+\s*/g, '$1').replace(/\s{2,}/g, ' ').trim();
        return { sentence, tags };
    }

    const isLossTag = (tag) => (/^[\-−]/.test(tag) ? !/stress/i.test(tag) : /stress/i.test(tag));

    function plainHtml(text, tone) {
        const { sentence, tags } = splitRewards(text.replace(SHOUT, '')); // the bar and glyph already say "warning"
        const tagHtml = tags.map(t => `<i class="${isLossTag(t) ? 'is-loss' : 'is-gain'}">${esc(t)}</i>`).join('');
        return `<span class="log-glyph" aria-hidden="true">${GLYPH[tone] || GLYPH.plain}</span><span class="log-body">${esc(sentence)}</span>${tagHtml ? `<span class="log-tags">${tagHtml}</span>` : ''}`;
    }

    function toneOf(text) {
        if (BAD.test(text)) return 'bad';
        if (WARN.test(text)) return 'warn';
        if (NOISE.test(text)) return 'noise';
        const { tags } = splitRewards(text);
        return tags.length && !tags.some(isLossTag) ? 'gain' : 'plain';
    }

    function reshape(entry, text) {
        const speech = text.match(SPEECH);
        entry.classList.add('is-rich');
        if (speech) { entry.classList.add('is-speech'); entry.innerHTML = speechHtml(speech[1], speech[2]); return; }
        const tone = toneOf(text);
        entry.classList.add('is-' + tone);
        entry.innerHTML = plainHtml(text, tone);
    }

    // ── stops: a card per place, with a running total of what it cost and gave ──
    let stop = null;

    function snapshot() {
        const state = gameState();
        if (!state) return null;
        return { values: RESOURCES.map(([key]) => state[key] || 0), crew: state.crew.map(c => c.status) };
    }

    function openStop(name, beforeEntry) {
        const el = document.createElement('div');
        el.className = 'log-stop';
        el.innerHTML = `<b>${esc(name)}</b><span class="log-stop-sum"></span>`;
        container.insertBefore(el, beforeEntry);
        stop = { sumEl: el.querySelector('.log-stop-sum'), start: snapshot(), shown: '' };
    }

    function refreshStop() {
        const state = gameState();
        if (!stop || !state) return;
        if (!stop.start) { stop.start = snapshot(); return; }
        const parts = RESOURCES.map(([key, , label], i) => {
            const delta = Math.round((state[key] || 0) - stop.start.values[i]);
            return delta ? `<i class="${delta > 0 ? 'is-gain' : 'is-loss'}">${delta > 0 ? '+' : '−'}${Math.abs(delta)} ${label}</i>` : '';
        });
        state.crew.forEach((member, i) => {
            const was = stop.start.crew[i];
            if (member.status !== was && HURT_WORDS[member.status]) parts.push(`<i class="is-loss">${esc(shortName(member.name))} ${HURT_WORDS[member.status]}</i>`);
        });
        const html = parts.join('');
        if (html !== stop.shown) { stop.shown = html; stop.sumEl.innerHTML = html; }
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
            if (panel) panel.classList.toggle('is-expanded', isExpanded); // expanded = the full record, machine chatter included
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
        const stopName = stopNameFor(text);
        if (stopName) { openStop(stopName, entry); entry.classList.add('is-noise'); } // the card header already says it
        reshape(entry, text);
        if (now - lastEntryAt > BURST_GAP_MS) { // a new burst: the previous one stops being "fresh"
            burst.forEach(old => old.classList.remove('is-fresh'));
            burst = [];
        }
        lastEntryAt = now;
        burst.push(entry);
        entry.classList.add('is-fresh');
        setTimeout(() => entry.classList.remove('is-fresh'), FRESH_MS);
        requestAnimationFrame(() => { container.scrollTop = container.scrollHeight; });
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
        const state = gameState();
        if (!state) return;
        RESOURCES.forEach(([key, elementId]) => {
            const value = state[key] || 0;
            if (!shouldResyncResources && known[key] !== undefined && value !== known[key]) floatDelta(elementId, value - known[key]);
            known[key] = value;
        });
        if (shouldResyncResources && stop) stop.start = snapshot(); // a loaded save is not something this stop earned
        shouldResyncResources = false;
        refreshStop();
    }, RESOURCE_POLL_MS);
})();
