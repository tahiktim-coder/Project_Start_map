/* ═══ Silent Exodus · new screen (?new=1) · Orbit.js: what a stop offers, who goes, who stays, what breaks aboard ═══════
   What it is: the rules of a stop on the bridge (docs/BUILD_B.md §3, §4), on top of the REAL game. Every action calls the
   game's own handler (scan, the team trip, docking, mining, the settle council, the disc); the only new numbers are the
   skim (+15 energy, once per gas giant, docs/ECONOMY.md) and the patch (5 salvage). It draws nothing: Stop.js shows the
   words, the shell (NewScreen.flow) hands their clicks here, Tower.js shows the deck choices.
   Loaded only when the new-screen switch is on, after NewScreen.js and Route.js. bundle.js calls it only behind isNewScreen().

   window.NSOrbit (frozen)
     actions(app) → [{ key, words, near, team, run() }]   in the plan's order, only what applies here now
                    near: 'world' | 'station' | 'field' | 'giant' | 'site' | 'call' | 'mira' | 'aura' | 'under'
     act(app, key, ids?) → bool    run one action (ids: the two picked, for 'team')
     eligible(app) → ['jaxon', ...]  who is fit to go down (handleEvaAction's own rule)
     hasTeamAction(planet) → bool  this place has a team trip still to take (handleWarp defers the breach to it)
     opened(app)                   the bridge is up: the crisis sign is decided (once per place) and said
     signed(app) → bool            a sign will be said here (bundle's reactToOrbit skips the crew's "all clear" bark then)
     beforeLeave(app) → Promise<{ ok, say?, direct? }>   the team away refuses; a breach still due plays first; a call is dropped
     whileDown(app, team) → Promise   the crisis aboard while the team is down, then the skills aboard
     tripOver()                    the trip's story has ended (bundle's real end points): the shuttle comes home
     tick(dt, blocked)             the shell's frame: the trip's end, the breach at a stop with no trip, the late star fix
     trip() → { ids, aboard } | null
     offerCall(app, encounter)     a distress call after a warp waits on the bridge instead of popping up
     fixIn(app, planet)            the wreck's star fix: dated now (Mira went) or after the next warp (she stayed)
     canDate(app, node), datable(state) → node | null
     breakPatched(state)           every patched deck breaks again (a crisis aboard, the sector jump)
     deckChoices(state, deck) → [{ key: 'fix' | 'patch' | 'live', words, note }]   deck: the tower's name (hold = cargo)
     deckChoose(app, deck, i | key) → bool
     debug() → { trip, call, quiet }
   Bus (NewScreen.bus): emits 'trip:down' { ids, aboard }, 'trip:back' { ids, failed? }, 'stop:skim' { id }.
*/
(function () {
    'use strict';
    const NS = () => window.NewScreen;
    const CREW_BY_TAG = { LEADER: 'cora', ENGINEER: 'jaxon', MEDIC: 'aris', SECURITY: 'vance', SPECIALIST: 'mira' };
    const SKIM_ENERGY = 15, PATCH_COST = 5, TRIP_QUIET_MS = 3500, TRIP_OVER_MS = 600, TRIP_LOST_MS = 20000, FIX_CHECK_MS = 500;
    const BREACH_WAIT_MS = 5000;                                                             // a breach at a stop with no trip: the bridge is seen first
    const DECK_KEY = { bridge: 'bridge', lab: 'lab', quarters: 'quarters', hold: 'cargo', cargo: 'cargo', engineering: 'engineering' };
    const DECK_WORD = { bridge: 'bridge', lab: 'lab', quarters: 'quarters', cargo: 'hold', engineering: 'engine room' };
    const NOT_CRISES = new Set(['LUCKY_FIND']);                                              // a find is not a crisis
    const aura = text => `A.U.R.A.: "${text}"`;
    const SIGN = {
        BREACH: "The hull's been groaning since the last scrape.", HULL_STRESS: "The hull's been groaning since the last scrape.",
        MICRO_METEOR: "The hull's been groaning since the last scrape.", POWER_SURGE: "Engineering's been surging, Commander.",
        LIFE_SUPPORT_HICCUP: 'The air recyclers keep stuttering.', CRYO_LEAK: 'One of the pods keeps blinking.',
    };
    const OTHER_SIGN = "Something aboard doesn't sound right, Commander.";
    const LINES = {
        pair: aura('We need two people fit to go, Commander.'),
        away: aura('The team is still down there, Commander. We wait for them.'),
        pick: aura('Pick two people fit to go, Commander.'),
        call: aura('An old distress call is coming in, Commander.'),
        unanswered: 'We left the call unanswered.',
        jaxonSurge: 'Power surge in engineering. Jaxon fixed it at no cost.',
        jaxonSays: 'Jaxon: "Got it. The drive\'s calm."',
        vancePulled: 'Vance: "I pulled them out before it sealed."',
        arisTreated: 'Aris: "I\'ve treated them. No lasting harm."',
        miraScanned: 'Mira: "I\'ve scanned the ground. Go round the soft part."',
        arisTeam: 'Aris strapped them up. They walked back.',
        fixOnBench: 'Mira: "The star fix is on my bench."',
        fixReady: aura('The star fix is ready to date, Commander.'),
    };

    let trip = null, call = null, fixWait = 0, pendingBreach = null;
    const pairSaid = new Set(), arisSaid = new Set();
    const emit = (name, p) => { const ns = NS(); if (ns && ns.bus) ns.bus.emit(name, p); };
    const tags = c => (c && c.tags) || [];
    const idOf = c => CREW_BY_TAG[Object.keys(CREW_BY_TAG).find(t => tags(c).includes(t))] || String((c && c.name) || '').toLowerCase();
    const byRole = (s, tag) => ((s && s.crew) || []).find(c => tags(c).includes(tag)) || null;
    const isWell = c => !!c && c.status === 'HEALTHY' && !tags(c).includes('CONFINED') && !tags(c).includes('SEDATED');
    const alive = c => !!c && c.status !== 'DEAD';
    const log = (s, line) => { if (s && line) s.addLog(line); };
    const isPlanet = n => !!n && !n.isStation && !n.isAsteroidField && !n.isStructure && n.type !== 'STRUCTURE' && !n._isWrongPlace && n.type !== 'WRONG_PLACE';
    const hasBreach = () => !!(window.MiniHost && window.MiniHost.has && window.MiniHost.has('breach'));
    const chance = (p, why) => (typeof window.testChance === 'function' ? window.testChance(p, why) : Math.random() < p);

    // ── who can go ──
    /** handleEvaAction's own rule: HEALTHY, not the commander, not confined, not asleep. */
    function evaCrew(app) {
        const s = app && app.state;
        return ((s && s.crew) || []).filter(c => c.status === 'HEALTHY' && !tags(c).includes('LEADER') && !tags(c).includes('CONFINED') && !tags(c).includes('SEDATED'));
    }
    const eligible = app => evaCrew(app).map(idOf);
    /** Aris under stress (BLEEDING_HEART) refuses any trip while someone is hurt (handleEvaAction's own rule): the hurt one, or null. */
    function arisRefuses(app) {
        const s = app && app.state;
        if (!s || typeof s.hasActiveTrait !== 'function' || !s.hasActiveTrait('BLEEDING_HEART')) return null;
        return (s.crew || []).find(c => alive(c) && c.status === 'INJURED') || null;
    }

    // ── what this place offers ──
    function siteOpen(app, node) {
        const site = app && typeof app.siteOf === 'function' ? app.siteOf(node) : null;
        return site && !node[site.done] ? site : null;
    }
    /** A team trip is still to take here (counting nobody: who is fit is asked when the bridge is up). */
    function hasTeamAction(planet) {
        const n = planet, app = window.app;
        if (!isPlanet(n) || n.hasEva || n.ghost) return false;
        return n.type !== 'GAS_GIANT' || !!siteOpen(app, n);                                 // a giant has no ground, unless a site is in orbit
    }
    function canDate(app, node) {
        if (!app || !node || typeof app.canDateWreck !== 'function' || !app.canDateWreck(node)) return false;
        const fix = node._nsFix, s = app.state;
        return fix == null || fix === 'now' || (typeof fix === 'number' && ((s && s._paidWarps) || 0) > fix);
    }
    function datable(state) {
        const app = window.app;
        if (!app || !state) return null;
        return (state.sectorNodes || []).find(n => canDate(app, n)) || null;
    }
    function actions(app) {
        const s = app && app.state, n = s && s.currentSystem;
        if (!n) return [];
        const out = [], add = (key, words, near, run, team) => out.push({ key, words, near, team: !!team, run });
        if ((n.isStructure || n.type === 'STRUCTURE') && !n.structureApproached) add('light', 'Go into the light', 'world', () => app.handleStructureAction());
        if (n._isWrongPlace) {
            add('escape', 'Fight to escape', 'under', () => window.dispatchEvent(new CustomEvent('req-wrong-escape')));
            add('accept', 'Accept it', 'under', () => window.dispatchEvent(new CustomEvent('req-wrong-accept')));
            return out;
        }
        if (n.isStation && !n.stationInvestigated) add('dock', 'Dock', 'station', () => app.handleStationAction());
        if (n.isAsteroidField && !n.asteroidMined) add('mine', 'Mine it', 'field', () => app.handleAsteroidAction());
        const scoop = (s.upgrades || []).includes('fuel_scoop');                             // the scoop took its fill on arrival: no skim on top
        if (n.type === 'GAS_GIANT' && !n.nsSkimmed && !scoop && s.energy < 100) add('skim', 'Skim fuel', 'giant', () => skim(app, n));   // full tanks: nothing to skim
        if (isPlanet(n) && !n.scanned) add('scan', 'Scan', 'world', () => app.handleScanAction(false));
        if (hasTeamAction(n) && evaCrew(app).length >= 2 && !trip && !arisRefuses(app)) add('team', 'Send the team', siteOpen(app, n) ? 'site' : 'world', null, true);
        if (!call && n._nsCall) call = savedCall(n);                                         // a call that waited through a reload
        if (call) add('call', 'Answer the call', 'call', () => answer(app));
        if (canDate(app, n)) add('date', 'Date the wreck', alive(byRole(s, 'SPECIALIST')) ? 'mira' : 'aura', () => app.dateWreck(n));
        if (isPlanet(n) && n.type !== 'GAS_GIANT' && (n.scanned || window.TEST_MODE)) add('settle', 'Settle here', 'under', () => app.handleColonyAction());
        return out;
    }
    function act(app, key, ids) {
        const a = actions(app).find(x => x.key === key);
        if (!a) return false;
        if (a.team) return send(app, ids || []);
        try { a.run(); } catch (err) { console.error(`NSOrbit: ${key} failed`, err); return false; }
        return true;
    }
    /** The skim (ECONOMY.md): the only new number at a stop. Once per gas giant. */
    function skim(app, n) {
        const s = app.state, got = Math.min(SKIM_ENERGY, Math.max(0, 100 - s.energy));
        n.nsSkimmed = true;
        s.energy = Math.min(100, s.energy + SKIM_ENERGY);
        log(s, `Skimmed fuel at ${n.name}. +${got} energy.`);
        emit('stop:skim', { id: n.id });
        s.emitUpdates();
        if (typeof app.autoSave === 'function') app.autoSave();
    }
    function answer(app) {
        const c = call;
        dropCall(app.state);
        if (c) app.queueModal('distress', c);
    }
    function offerCall(app, encounter) {
        if (!encounter) return;
        call = encounter;
        const n = app.state.currentSystem;
        if (n && encounter.id) n._nsCall = encounter.id;                                     // kept on the node, so a reload in orbit still has it
        log(app.state, LINES.call);
    }
    /** The waiting call, found again by its id after a reload (DistressSignals.js). */
    function savedCall(n) {
        const found = (window.DISTRESS_SIGNAL_ENCOUNTERS || []).find(e => e.id === n._nsCall);
        if (!found) delete n._nsCall;
        return found || null;
    }
    function dropCall(state) {
        call = null;
        ((state && state.sectorNodes) || []).forEach(n => { if (n && n._nsCall) delete n._nsCall; });
    }

    // ── the bridge is up: the sign of what may go wrong aboard (decided once per place, kept on the node, saved) ──
    /** Sector 1's breach is due (bundle's isBreachDue, counted after the warp). Under the switch it comes at a stop, never in flight:
        while the team is down, else on the bridge after a moment, else as we leave orbit. Asked as it stands now, never kept. */
    function breachDue(s, n) {
        return !!n && s.currentSector === 1 && !s._breachDone && (s._paidWarps || 0) >= 2 && hasBreach();
    }
    function pickEvent(s) {
        const list = (window.SHIP_MALFUNCTION_EVENTS || []).filter(e => !NOT_CRISES.has(e.id) && (() => { try { return !!e.condition(s); } catch (err) { return false; } })());
        const total = list.reduce((sum, e) => sum + (e.weight || 1), 0);
        let roll = Math.random() * total;
        for (const e of list) { roll -= (e.weight || 1); if (roll <= 0) return e; }
        return list[0] || null;
    }
    function sign(app) {
        const s = app.state, n = s.currentSystem, last = s.currentSector >= (window.FINAL_SECTOR || 6);
        if (!n) return null;
        if (breachDue(s, n)) {                                                               // due now wins over a sign kept from before
            if (!n._nsCrisis || n._nsCrisis.kind !== 'BREACH') n._nsCrisis = { kind: 'BREACH', comes: true };
            return n._nsCrisis;
        }
        if (n._nsCrisis !== undefined) return n._nsCrisis;
        if (!last && hasTeamAction(n) && !(s.currentSector === 1 && !s._breachDone)) {
            const ev = pickEvent(s);
            n._nsCrisis = ev ? { kind: ev.id, comes: chance(0.5, 'crisis') } : null;
        } else n._nsCrisis = null;
        return n._nsCrisis;
    }
    const saysSign = (c, n) => !!(c && !c.said && (c.kind === 'BREACH' || hasTeamAction(n)));
    /** Will A.U.R.A. say a sign at this stop? (Decides it now; bundle's reactToOrbit asks before the crew's "all clear".) */
    function signed(app) {
        const s = app && app.state, n = s && s.currentSystem;
        return !!n && saysSign(sign(app), n);
    }
    function opened(app) {
        const s = app && app.state, n = s && s.currentSystem;
        if (!n) return;
        const c = sign(app);
        if (saysSign(c, n)) { c.said = true; log(s, aura(SIGN[c.kind] || OTHER_SIGN)); }
        if (c && c.kind === 'BREACH' && !hasTeamAction(n) && !s._breachDone) pendingBreach = { id: n.id, wait: BREACH_WAIT_MS };   // nobody goes down here: it comes on the bridge
        const refusing = hasTeamAction(n) ? arisRefuses(app) : null;
        if (refusing && !arisSaid.has(n.id)) { arisSaid.add(n.id); log(s, `Aris: "Absolutely not. ${refusing.name} needs treatment first. No one goes out there."`); }
        else if (!refusing && hasTeamAction(n) && evaCrew(app).length < 2 && !pairSaid.has(n.id)) { pairSaid.add(n.id); log(s, LINES.pair); }
    }
    /** The breach, played by the game's own App.playBreach (away: the crew who are not aboard). The patches break first. */
    function playBreach(app, away) {
        breakPatched(app.state);
        pendingBreach = null;
        return Promise.resolve(app.playBreach(away || [])).catch(err => console.error('NSOrbit: the breach failed', err));
    }

    // ── the team trip ──
    function send(app, ids) {
        const s = app.state, n = s.currentSystem, pool = evaCrew(app);
        const team = (ids || []).map(id => pool.find(c => idOf(c) === id)).filter(Boolean);
        if (!n || trip || team.length !== 2 || team[0] === team[1]) { log(s, LINES.pick); return false; }
        const aboard = s.crew.filter(c => alive(c) && !team.includes(c)).map(idOf);
        trip = { ids: team.map(idOf), aboard, node: n.id, hurtBefore: new Set(s.crew.filter(c => c.status !== 'HEALTHY').map(idOf)), downDone: false, quiet: 0, lost: 0 };
        app._pickedEvaTeam = team;                                                           // handleEvaAction skips AwayTeam.pick
        emit('trip:down', { ids: trip.ids.slice(), aboard: aboard.slice() });
        try { app.handleEvaAction(); } catch (err) { console.error('NSOrbit: the team trip failed', err); }
        if (!n.hasEva) {                                                                     // refused (Aris will not, nobody fit): nothing was spent
            app._pickedEvaTeam = null;
            const back = trip.ids; trip = null;
            emit('trip:back', { ids: back, failed: true });
            return false;
        }
        return true;
    }
    /** While the team is down (bundle: after the landing, before their story): the crisis aboard, then the skills aboard. */
    function whileDown(app, team) {
        const s = app.state, n = s.currentSystem, c = n && n._nsCrisis, members = team || [];
        const hurtBefore = new Set(s.crew.filter(m => m.status !== 'HEALTHY').map(idOf));
        const aboardWell = tag => { const m = byRole(s, tag); return m && !members.includes(m) && isWell(m) ? m : null; };
        let crisis = null, run = Promise.resolve();
        if (breachDue(s, n)) {
            crisis = 'BREACH';
            run = playBreach(app, members);
        } else if (c && c.comes && !c.done && c.kind !== 'BREACH') {
            const ev = (window.SHIP_MALFUNCTION_EVENTS || []).find(e => e.id === c.kind);
            c.done = true;
            if (ev) {
                crisis = ev.id;
                breakPatched(s);
                if (ev.id === 'POWER_SURGE' && aboardWell('ENGINEER')) { log(s, LINES.jaxonSurge); log(s, LINES.jaxonSays); }
                else run = Promise.resolve(app.showShipMalfunctionModal(ev));
            }
        }
        return run.then(() => {
            if (crisis) {
                const hurtNow = s.crew.filter(m => m.status === 'INJURED' && !members.includes(m) && !hurtBefore.has(idOf(m)));
                if (hurtNow.length && crisis === 'BREACH' && aboardWell('SECURITY')) { heal(hurtNow); log(s, LINES.vancePulled); }
                else if (hurtNow.length && aboardWell('MEDIC')) { heal(hurtNow); log(s, LINES.arisTreated); }
            }
            if (aboardWell('SPECIALIST')) { app._nsScanMod = -10; log(s, LINES.miraScanned); }
            s.emitUpdates();
        }).catch(err => console.error('NSOrbit: the crisis aboard failed', err)).then(() => { if (trip) trip.downDone = true; });
    }
    /** The trip's story has ended (the end of resolveEvaOutcome, the wreck's finds, the paradise card): home in a moment. */
    function tripOver() { if (trip) trip.over = true; }
    function heal(list) { list.forEach(m => { m.status = 'HEALTHY'; m.healCounter = 0; }); }
    /** The trip is over: the team skills, then the shuttle comes home (trip:back). Deaths stand. */
    function tripDone(app) {
        const s = app.state, t = trip;
        trip = null;
        if (!t) return;
        const team = t.ids.map(id => s.crew.find(c => idOf(c) === id)).filter(Boolean);
        const hurtOnTrip = m => m.status === 'INJURED' && !t.hurtBefore.has(idOf(m));
        const vance = team.find(m => tags(m).includes('SECURITY')), other = team.find(m => m !== vance);
        if (vance && vance.status === 'HEALTHY' && other && hurtOnTrip(other)) {
            vance.status = 'INJURED'; other.status = 'HEALTHY'; other.healCounter = 0;
            log(s, `Vance took the hit for ${other.name}.`);
        }
        const aris = team.find(m => tags(m).includes('MEDIC'));
        const hurt = team.filter(hurtOnTrip);
        if (aris && aris.status === 'HEALTHY' && hurt.length) { heal(hurt); log(s, LINES.arisTeam); }
        app._nsScanMod = 0;
        s.emitUpdates();
        emit('trip:back', { ids: t.ids.slice() });
    }
    function tick(dt, blocked) {
        const app = window.app, ns = NS();
        if (!app || !app.state) return;
        const waiting = !!((app._modalQueue && app._modalQueue.length) || app._modalActive);   // a card still queued: the story goes on
        if (trip && !blocked && !waiting) {
            if (trip.downDone) { trip.quiet += dt; if (trip.quiet >= (trip.over ? TRIP_OVER_MS : TRIP_QUIET_MS)) tripDone(app); }   // the quiet time is only the safety net
            else if ((trip.lost += dt) >= TRIP_LOST_MS) { console.warn('NSOrbit: the trip never reported back; ending it'); tripDone(app); }
        } else if (trip) trip.quiet = 0;
        if (pendingBreach) {                                                                 // a breach due at a stop with no trip: once the bridge has been seen
            const s = app.state, n = s.currentSystem;
            if (s._breachDone || !n || n.id !== pendingBreach.id) pendingBreach = null;
            else if (!blocked && !trip && ns && ns.mode() === 'stop' && !app._isInTransit && (pendingBreach.wait -= dt) <= 0) playBreach(app, []);
        }
        if (call && ns && ns.mode() === 'travel' && !app.state.currentSystem) { dropCall(app.state); log(app.state, LINES.unanswered); }   // left by another way
        if (blocked || (fixWait -= dt) > 0) return;
        fixWait = FIX_CHECK_MS;
        const n = datable(app.state);
        if (n && typeof n._nsFix === 'number' && !n._nsFixSaid && (!ns || ns.mode() === 'travel' || ns.mode() === 'stop')) {
            n._nsFixSaid = true;
            log(app.state, alive(byRole(app.state, 'SPECIALIST')) ? LINES.fixOnBench : LINES.fixReady);
        }
    }

    // ── leaving orbit ──
    function beforeLeave(app) {
        const s = app.state, n = s.currentSystem;
        if (!n) return Promise.resolve({ ok: false });
        if (trip) return Promise.resolve({ ok: false, say: LINES.away });
        if (n.isStructure || n.type === 'STRUCTURE') return Promise.resolve({ ok: true, direct: true });   // it refuses itself
        if (n._isWrongPlace) return Promise.resolve({ ok: false });
        if (call || n._nsCall) { dropCall(s); log(s, LINES.unanswered); }
        if (!breachDue(s, n)) return Promise.resolve({ ok: true });
        return playBreach(app, []).then(() => ({ ok: true }));                               // the breach due here, nobody sent: it comes as we leave
    }

    // ── the disc: Mira's star fix ──
    function fixIn(app, planet) {
        tripOver();                                                                          // offerDiscDating is the wreck's last step: the trip is over
        if (!planet || !app || !app.canDateWreck(planet)) return;
        const s = app.state, mira = byRole(s, 'SPECIALIST');
        const miraWent = (app.currentEvaTeam || []).includes(mira);
        planet._nsFix = miraWent || !alive(mira) ? 'now' : (s._paidWarps || 0);
        if (planet._nsFix === 'now' && s.currentSystem === planet) { const ns = NS(); if (ns && ns.bus) ns.bus.emit('stop:refresh', { id: planet.id }); }
    }

    // ── damage: fix, patch or live with it ──
    function deckOf(state, deck) { const key = DECK_KEY[deck]; return key && state && state.shipDecks ? { key, d: state.shipDecks[key] } : null; }
    /** GameState.repairCostOf: the one price rule repairDeck charges (Jaxon alive, engineering down). */
    const fixCost = (state, key) => state.repairCostOf(key);
    function deckChoices(state, deck) {
        const o = deckOf(state, deck);
        if (!o || !o.d || o.d.status !== 'DAMAGED') return [];
        const out = [{ key: 'fix', words: 'Fix it', note: `costs ${fixCost(state, o.key)} salvage` }];
        if (!o.d._nsWorn) out.push({ key: 'patch', words: 'Patch it', note: 'a little salvage, for now' });
        out.push({ key: 'live', words: 'Live with it', note: 'it stays broken' });
        return out;
    }
    function deckChoose(app, deck, which) {
        const s = app && app.state, o = deckOf(s, deck), list = deckChoices(s, deck);
        const pick = typeof which === 'number' ? list[which] : list.find(c => c.key === which);
        if (!o || !pick) return false;
        const word = DECK_WORD[o.key];
        if (pick.key === 'fix') {
            const cost = fixCost(s, o.key);
            if (s.salvage < cost) { log(s, aura(`We need ${cost} salvage to fix the ${word}, Commander. We have ${s.salvage}.`)); return false; }
            const ok = s.repairDeck(o.key);
            if (ok) { delete o.d._nsWorn; delete o.d._nsPatched; }
            return ok;
        }
        if (pick.key === 'patch') {
            if (s.salvage < PATCH_COST) { log(s, aura(`We need ${PATCH_COST} salvage for a patch, Commander.`)); return false; }
            s.salvage -= PATCH_COST;
            o.d.status = 'OPERATIONAL';
            o.d._nsPatched = true;
            log(s, `Patched the ${word}. It will hold for now. -${PATCH_COST} salvage.`);
            if (typeof app.clearDeckDamage === 'function') app.clearDeckDamage(o.key);
            s.emitUpdates();
            return true;
        }
        return true;                                                                         // live with it: today's broken-deck costs apply
    }
    /** Every patched deck breaks again, through the game's own GameState.damageDeck (its event, its first-damage line, its update). */
    function breakPatched(state) {
        if (!state || !state.shipDecks) return;
        Object.keys(state.shipDecks).forEach(key => {
            const d = state.shipDecks[key];
            if (!d || !d._nsPatched) return;
            delete d._nsPatched;
            d._nsWorn = true;
            if (d.status === 'OPERATIONAL') state.damageDeck(key, aura(`The patch on the ${DECK_WORD[key] || key} didn't hold.`));
        });
    }

    window.NSOrbit = Object.freeze({
        actions, act, eligible, hasTeamAction, opened, signed, beforeLeave, whileDown, tripOver, tick, offerCall, fixIn, canDate, datable,
        breakPatched, deckChoices, deckChoose, sign,
        trip: () => (trip ? { ids: trip.ids.slice(), aboard: trip.aboard.slice() } : null),
        debug: () => ({ trip: trip ? { ids: trip.ids, downDone: trip.downDone, over: !!trip.over, quiet: Math.round(trip.quiet) } : null, call: call ? call.title || true : null, breach: pendingBreach ? Math.round(pendingBreach.wait) : null }),
    });
})();
