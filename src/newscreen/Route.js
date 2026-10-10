/* ═══ Silent Exodus · new screen (?new=1) · Route.js: the real sector nodes as the field of worlds ahead ═══════════════
   What it is: turns the REAL nodes of the sector (state.sectorNodes) into bands, slots and forks (docs/BUILD_A.md §5,
   docs/ROUTE_AND_LIMITS.md §1 and §3), and keeps where we have been. The route lives on the nodes themselves
   (node.nsRoute = { sector, band, slot, status }), so it saves and loads with sectorNodes and needs no save change; the
   default game never reads it. No drawing here: Travel's Field.js turns a slot name into a place on screen.
   Source: prototypes/slice/script.js (clickable, the arrival's statuses), ROUTE_AND_LIMITS §3.
   Loaded only when the new-screen switch is on (BUILD_A.md §1). Needs nothing else of the new screen.

   window.NSRoute (frozen)
     plan(state) → {                       once per sector; kept while the sector's nodes keep their nsRoute
       sector, at,                         at: the highest band we pulled in at (0 at the start of the sector)
       worlds: [{ id, node, band, slot, status, mate }],   every node that can be pointed at, nearest band first
                                           status: 'ahead' | 'visited' | 'gone' | 'passed'; mate: the fork's other id
       giant: id | null,                   sector 1: the gas giant node that IS Kryos (also in worlds, slot 'fork2-giant');
                                           null: the giant is scenery only (drawn, never pointed at, never named)
       story: id | null,                   the story world (slot 'story'); hidden while node.storyHidden
       light: { id, band, node }           the light: id 'light' in sectors 1-5 (the jump, not a node); in sector 6 the
                                           STRUCTURE node's id (it is also in worlds, slot 'light')
     }
     slots: sector 1 'fork1-bottom' 'fork1-top' 'fork2-giant' 'fork2-limb' 'fork2-top';  sectors 2-6 'first' (the one
            world before the fork: the tape wreck in sector 2), 'fork-top' 'fork-bottom';  then 'single-1', 'single-2', ...
            (one band each; past 4 Travel lays them on a fallback arc), 'story', and in sector 6 'light'
     canGo(state, id) → { ok, say, kind }  kind: 'world' | 'ghost' | 'contact' | 'light' | 'passed' | 'cost' | 'none';
                                           say: the one line A.U.R.A. says when it is no (null when ok). Pure: says nothing
     arrive(state, id)                     we pulled in at id: it is 'visited', its fork mate 'gone', anything ahead in a
                                           nearer band 'passed'
     outOfReach(node) → bool               a planned node we can no longer go to (not 'ahead')
     onlyStoryLeft(state) → bool           nothing but the story world (and the light) is left ahead that we can afford
     A fresh plan on a sector already played (a save from the default game, loaded with ?new=1 on) marks where we have
     been: the orbit we are parked at, a wreck boarded, a station searched; the rest follows as if we had flown there.
     find(state, id) → node | null         a node of the sector by id ('light' gives the structure in sector 6)
     LINES                                 the refusal lines (docs/STYLE.md)
*/
(function () {
    'use strict';

    const LINES = Object.freeze({
        contact: 'A.U.R.A.: "That contact is too faint to plot a course to, Commander."',
        passed: 'A.U.R.A.: "We passed it, Commander. We can\'t turn back."',
        cost: 'A.U.R.A.: "We can\'t afford that one, Commander."',
    });
    const isStructure = n => !!(n && (n.isStructure || n.type === 'STRUCTURE'));
    const isGiant = n => n && n.type === 'GAS_GIANT';
    const byMapX = (a, b) => ((a.mapData && a.mapData.x) || 0) - ((b.mapData && b.mapData.x) || 0) || String(a.id).localeCompare(String(b.id));
    const nodesOf = state => (state && Array.isArray(state.sectorNodes) ? state.sectorNodes : []);

    /** Which node opens the sector: the first signal (sector 1), the tape wreck (sector 2); null elsewhere. */
    function firstOf(sector, pool) {
        if (sector === 1) return pool.find(n => n.isFirstSignal) || null;
        if (sector === 2) return pool.find(n => n.hasTape) || null;
        return null;
    }
    // ── a fresh plan: bands and slots (BUILD_A §5 steps 1-4) ──
    function fresh(state) {
        const sector = state.currentSector, nodes = nodesOf(state);
        const pool = nodes.filter(n => !n.isStoryPlanet && !isStructure(n)).sort(byMapX);
        const take = pred => { const i = pool.findIndex(pred); return i < 0 ? null : pool.splice(i, 1)[0]; };
        const giant = sector === 1 ? take(isGiant) : null;
        const firstNode = firstOf(sector, pool);
        if (firstNode) pool.splice(pool.indexOf(firstNode), 1);
        let band = 0;
        const put = (node, slot) => { if (node) node.nsRoute = { sector, band, slot, status: 'ahead' }; };
        const fork = (a, slotA, b, slotB) => { if (!a && !b) return; band++; put(a, slotA); put(b, slotB); };
        if (sector === 1) {
            const one = firstNode || pool.shift() || null;
            fork(one, 'fork1-bottom', take(n => n.isStation || n.type === 'STATION') || pool.shift() || null, 'fork1-top');
            if (giant) fork(giant, 'fork2-giant', pool.shift() || null, 'fork2-limb');
            else fork(pool.shift() || null, 'fork2-top', pool.shift() || null, 'fork2-limb');
        }
        let singles = 0;
        if (sector !== 1) {
            const one = firstNode || pool.shift() || null;
            if (one) { band++; put(one, 'first'); }
            const a = pool.shift() || null, b = pool.shift() || null;
            if (a && b) fork(a, 'fork-top', b, 'fork-bottom');
            else if (a) { band++; put(a, 'single-' + (++singles)); }                  // a fork of one is a single (no mate)
        }
        pool.forEach(n => { band++; put(n, 'single-' + (++singles)); });
        nodes.filter(n => n.isStoryPlanet).forEach(n => { band++; put(n, 'story'); });
        band++;
        nodes.filter(isStructure).forEach(n => put(n, 'light'));
        nodes.filter(beenThere(state)).sort((a, b) => a.nsRoute.band - b.nsRoute.band).forEach(n => arrive(state, n.id));
    }
    /** Where a sector already played shows we have been (only these flags: a remote scan from today's map is not a visit). */
    const beenThere = state => n => !!(n.nsRoute && n.nsRoute.slot !== 'light' && !n.ghost
        && ((state.lastVisitedSystem && state.lastVisitedSystem.id === n.id) || n.exodusInvestigated || n.stationInvestigated));
    /** A node that turned up after the plan (rare): one more band just before the story world, out of the way. */
    function addLate(state, node) {
        const sector = state.currentSector, planned = nodesOf(state).filter(n => n.nsRoute && n.nsRoute.sector === sector && n !== node);
        const story = planned.find(n => n.nsRoute.slot === 'story'), singles = planned.filter(n => /^single-/.test(n.nsRoute.slot)).length;
        const before = story ? story.nsRoute.band : Math.max(1, ...planned.map(n => n.nsRoute.band));
        const lower = Math.max(0, ...planned.filter(n => n.nsRoute.band < before).map(n => n.nsRoute.band));
        node.nsRoute = isStructure(node) ? { sector, band: before + 1, slot: 'light', status: 'ahead' }
            : node.isStoryPlanet ? { sector, band: before + 0.5, slot: 'story', status: 'ahead' }
            : { sector, band: (lower + before) / 2, slot: 'single-' + (singles + 1), status: 'ahead' };
    }
    const visitedAny = nodes => nodes.some(n => n.nsRoute && n.nsRoute.status !== 'ahead');

    /** Keeps the plan while the sector's nodes carry it; plans afresh for a new or regenerated sector. Before the first
        pull-in a plan may still be redone (the first signal is marked after the first draw); a removed node (a ghost)
        never moves the others. */
    function ensure(state) {
        const sector = state.currentSector, nodes = nodesOf(state);
        const mine = nodes.filter(n => n.nsRoute && n.nsRoute.sector === sector), missing = nodes.filter(n => !mine.includes(n));
        if (!mine.length || (!visitedAny(mine) && (missing.length || firstChanged(state, mine)))) fresh(state);
        else missing.forEach(n => addLate(state, n));
    }
    /** The node that should open the sector is not the one the plan put first. */
    function firstChanged(state, mine) {
        const want = firstOf(state.currentSector, mine.filter(n => !n.isStoryPlanet && !isStructure(n)));
        if (!want) return false;
        return !(want.nsRoute && (want.nsRoute.slot === 'fork1-bottom' || want.nsRoute.slot === 'first'));
    }

    function atOf(nodes) { let at = 0; nodes.forEach(n => { if (n.nsRoute && n.nsRoute.status === 'visited') at = Math.max(at, n.nsRoute.band); }); return at; }

    function plan(state) {
        if (!state) return { sector: 0, at: 0, worlds: [], giant: null, story: null, light: { id: 'light', band: 1, node: null } };
        ensure(state);
        const sector = state.currentSector, nodes = nodesOf(state).filter(n => n.nsRoute && n.nsRoute.sector === sector);
        const worlds = nodes.map(n => ({ id: n.id, node: n, band: n.nsRoute.band, slot: n.nsRoute.slot, status: n.nsRoute.status, mate: null }))
            .sort((a, b) => a.band - b.band || String(a.slot).localeCompare(String(b.slot)));
        worlds.forEach(w => { const m = worlds.find(o => o !== w && o.band === w.band && o.slot !== 'light'); w.mate = m && w.slot !== 'light' ? m.id : null; });
        const giant = worlds.find(w => w.slot === 'fork2-giant'), story = worlds.find(w => w.slot === 'story');
        const structure = worlds.find(w => w.slot === 'light');
        const lastBand = Math.max(0, ...worlds.filter(w => w.slot !== 'light').map(w => w.band));
        return {
            sector, at: atOf(nodes), worlds,
            giant: giant ? giant.id : null, story: story ? story.id : null,
            light: structure ? { id: structure.id, band: structure.band, node: structure.node } : { id: 'light', band: lastBand + 1, node: null },
        };
    }

    function find(state, id) {
        const nodes = nodesOf(state);
        if (id === 'light') return nodes.find(isStructure) || null;
        return nodes.find(n => n.id === id) || null;
    }

    function canGo(state, id) {
        if (!state) return { ok: false, say: null, kind: 'none' };
        const p = plan(state);
        if (id === 'light' || (p.light.node && p.light.id === id)) return { ok: true, say: null, kind: 'light' };
        const node = find(state, id), r = node && node.nsRoute;
        if (!node || !r || r.sector !== state.currentSector) return { ok: false, say: null, kind: 'none' };
        if (node.storyHidden) return { ok: false, say: LINES.contact, kind: 'contact' };
        if (r.status !== 'ahead' || r.band <= p.at) return { ok: false, say: LINES.passed, kind: 'passed' };
        if (node.ghost) return { ok: true, say: null, kind: 'ghost' };
        const cost = typeof state.getWarpCost === 'function' ? state.getWarpCost(node) : 0;
        if (cost > state.energy && !window.TEST_MODE) return { ok: false, say: LINES.cost, kind: 'cost' };
        return { ok: true, say: null, kind: 'world' };
    }

    function arrive(state, id) {
        const node = find(state, id);
        if (!node || !node.nsRoute) return;
        const band = node.nsRoute.band;
        node.nsRoute.status = 'visited';
        nodesOf(state).forEach(n => {
            const r = n.nsRoute;
            if (!r || n === node || r.sector !== node.nsRoute.sector || r.status !== 'ahead' || r.slot === 'light') return;
            if (r.band === band) r.status = 'gone';
            else if (r.band < band) r.status = 'passed';
        });
    }

    const outOfReach = node => !!(node && node.nsRoute && node.nsRoute.status !== 'ahead');

    function onlyStoryLeft(state) {
        const p = plan(state), affordable = n => window.TEST_MODE || typeof state.getWarpCost !== 'function' || state.getWarpCost(n) <= state.energy;
        return !p.worlds.some(w => w.status === 'ahead' && w.band > p.at && !w.node.isStoryPlanet && !w.node.ghost && w.slot !== 'light' && affordable(w.node));
    }

    window.NSRoute = Object.freeze({ plan, canGo, arrive, outOfReach, onlyStoryLeft, find, LINES });
})();
