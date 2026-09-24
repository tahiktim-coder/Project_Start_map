/* Coach — one short line above the mission log that always says what to do NEXT, worked out from the game state.
   Sector 1 teaches the controls in place instead of in a wall of text. From sector 2 on it is the ship's business:
   what this sector is for, and what is left to find in it. It never blocks input, and "hide tips" is remembered. */

(function () {
    'use strict';
    const STORAGE_KEY = 'psm-coach-hidden';
    const CHECK_MS = 600;

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

    // What each sector is for, once the page in it has been found and the stops are running out
    const SECTOR_LINE = {
        2: 'The last of the eight ships should be out here. Search the wrecks before you jump.',
        3: 'These ships have higher numbers than ours. One of their captains wrote down why. Search the wrecks.',
        4: 'Earth wrote orders for commanders only. A copy is in one of these wrecks.',
        5: 'One wreck here carries a list of every ship Earth ever built. Find it before you jump.',
        6: 'One last log to find. Then there is only the light.',
    };

    /** The single most useful thing to say right now, or '' for nothing. */
    function tipFor(state) {
        const here = state.currentSystem, sector = state.currentSector || 1;
        const isOverlayOpen = !!document.querySelector('.modal-overlay, .warp-plot, .story-reel, .throw-veil, #start-menu, .end-screen, #narrative-modal.active');
        if (isOverlayOpen) return '';
        const stopsLeft = state.getStopsLeft ? state.getStopsLeft() : 1;
        const pageHere = (state.sectorNodes || []).find(p => p.hasPage && !p.exodusInvestigated);
        const tapeHere = (state.sectorNodes || []).find(p => p.hasTape && !p.exodusInvestigated);
        if (sector === 1) {
            if (!here) {
                if (stopsLeft <= 0) return 'No stops left in this sector. Press JUMP SECTOR to move on — whatever you skipped is gone for good.';
                const signal = (state.sectorNodes || []).find(p => p.isFirstSignal && !p.exodusInvestigated);
                if (signal && !document.querySelector('.warp-btn')) return `An old ship beacon is marked on the map at ${signal.name}. Click it, warp there, scan, then send the team to the wreck.`;
                if (!document.querySelector('.warp-btn')) return 'Click a planet on the map to look at it. You only get a few STOPS per sector, so you cannot visit them all.';
                return 'LONG RANGE SCAN shows what is there for 2 energy. INITIATE WARP flies there and uses one STOP.';
            }
            if (here.isStation) return here.stationInvestigated ? 'Nothing more here. BREAK ORBIT to go back to the map.' : 'BOARD STATION sends one person inside on a tank of air. A DEEP SCAN first shows the rooms.';
            if (!here.scanned) return 'DEEP SCAN first: line your wave up with the planet\'s. A sharp match gives bonus data.';
            if (!here.hasEva && state.probeIntegrity > 0) return 'LAUNCH PROBE is the safe way to bring things back. SEND TEAM goes down to whatever the scan found — people can get hurt.';
            return 'Done here? BREAK ORBIT returns to the map. Click any room of the ship on the left to see who is in it.';
        }
        if (here) return '';                                                            // in orbit the command deck says what is possible; the bar stays quiet
        if (stopsLeft <= 0) return sector >= 6 ? 'No stops left. The only place left to go is the light.' : 'No stops left in this sector. JUMP SECTOR when you are ready — whatever you skipped is gone for good.';
        if (pageHere || tapeHere) return SECTOR_LINE[sector] || '';
        if (sector >= 6) return 'Every page is found. Nothing here is random any more. Go to the light when you are ready.';
        return `Nothing left to find in this sector. ${stopsLeft} ${stopsLeft === 1 ? 'stop' : 'stops'} left: rest, repair, salvage, then JUMP SECTOR.`;
    }

    setInterval(() => {
        const state = window.app && window.app.state;
        if (isHidden || !state || !state.crew || state.crew.length === 0) { bar.hidden = true; return; }
        const tip = tipFor(state);
        bar.hidden = !tip;
        if (tip && textEl.textContent !== tip) textEl.textContent = tip;
    }, CHECK_MS);
})();
