/* Coach — the first two minutes, taught in place instead of in a wall of text.
   One short line above the mission log that always says what to do NEXT, worked out from the
   current game state. It never blocks input, only shows in Sector 1, and "hide tips" is remembered. */

(function () {
    'use strict';
    const STORAGE_KEY = 'psm-coach-hidden';
    const CHECK_MS = 600;
    const LAST_SECTOR_WITH_TIPS = 1;

    let isHidden = false;
    try { isHidden = localStorage.getItem(STORAGE_KEY) === '1'; } catch (e) { /* storage blocked: tips just show again next time */ }

    const bar = document.createElement('aside');
    bar.className = 'coach';
    bar.setAttribute('aria-live', 'polite');
    bar.innerHTML = '<b>NEXT</b><span class="coach-text"></span><button class="coach-hide">hide tips</button>';
    bar.hidden = true;
    document.body.appendChild(bar);
    const textEl = bar.querySelector('.coach-text');

    bar.querySelector('.coach-hide').addEventListener('click', () => {
        isHidden = true;
        bar.hidden = true;
        try { localStorage.setItem(STORAGE_KEY, '1'); } catch (e) { /* not fatal */ }
    });

    /** The single most useful thing to say right now, or '' for nothing. */
    function tipFor(state) {
        const here = state.currentSystem, isOverlayOpen = !!document.querySelector('.modal-overlay, .warp-plot, #start-menu, .end-screen, #narrative-modal.active');
        if (isOverlayOpen) return '';
        if (!here) {
            if (state.getStopsLeft && state.getStopsLeft() <= 0) return 'No stops left in this sector. Press JUMP SECTOR to move on — whatever you skipped is gone for good.';
            if (!document.querySelector('.warp-btn')) return 'Click a planet on the map to look at it. You only get a few STOPS per sector, so you cannot visit them all.';
            return 'LONG RANGE SCAN shows what is there for 2 energy. INITIATE WARP flies there and uses one STOP.';
        }
        if (here.isStation) return here.stationInvestigated ? 'Nothing more here. BREAK ORBIT to go back to the map.' : 'BOARD STATION sends one person inside on a tank of air. A DEEP SCAN first shows the rooms.';
        if (!here.scanned) return 'DEEP SCAN first: line your wave up with the planet\'s. A sharp match gives bonus data.';
        if (!here.hasEva && state.probeIntegrity > 0) return 'LAUNCH PROBE is the safe way to bring things back. SEND TEAM OUT finds more, but people can get hurt.';
        return 'Done here? BREAK ORBIT returns to the map. Click any room of the ship on the left to see who is in it.';
    }

    setInterval(() => {
        const state = window.app && window.app.state;
        if (isHidden || !state || !state.crew || state.crew.length === 0 || state.currentSector > LAST_SECTOR_WITH_TIPS) { bar.hidden = true; return; }
        const tip = tipFor(state);
        bar.hidden = !tip;
        if (tip && textEl.textContent !== tip) textEl.textContent = tip;
    }, CHECK_MS);
})();
