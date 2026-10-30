/* ═══ Silent Exodus · new screen (?new=1) · Orbit.js: what a stop offers, who goes, who stays, what breaks aboard ═══════
   What it is: the rules of a stop on the bridge (docs/BUILD_B.md §3, §4), on top of the REAL game. Every action calls the
   game's own handler (scan, the team trip, docking, mining, the settle council, the disc); the only new numbers are the
   skim (NEW_LOOK_ECONOMY.SKIM energy, once per gas giant, set in bundle.js) and the patch (5 salvage). A world's scan runs
   by itself when we arrive (Stop.js sweeps the glass, then act(app, 'scan'); it is never a tag on the glass, scanDue);
   what it read is said by Scan.js (NSScan) and its finds are WorldFinds.js's: once a scan has read the world the team goes
   to the find chosen on the glass (its own event or story), one trip per find. It draws nothing:
   Stop.js shows the words, the shell (NewScreen.flow) hands their clicks here, Tower.js shows the deck choices.
   Loaded only when the new-screen switch is on, after NewScreen.js and Route.js. bundle.js calls it only behind isNewScreen().

   window.NSOrbit (frozen)
     actions(app) → [{ key, words, near, team, run(), sub, chips }]   in the plan's order, only what applies here now
                    near: 'world' | 'station' | 'field' | 'giant' | 'site' | 'call' | 'mira' | 'aura' | 'under' | 'key'
                    ('key': a held key on Cora's console, the copy of Earth's two; their chips may be rows: [[chip], [chip]])
                    chips: [{ icon, text, tone? }] what it costs and gives, a word or three each (the bridge's glass tags)
     act(app, key, ids?) → bool    run one action (ids: the two picked, for 'team'); 'scan' also runs while scanDue, unlisted
     scanDue(app) → bool           we are at a world nobody has scanned from the bridge: Stop.js scans it as the bridge shows
     eligible(app) → ['jaxon', ...]  who may go down (pool's ids). A trip that leaves ends everyone's weakness
     pool(app) → [crew]            who may go down (handleEvaAction reads it): the well; not who is too weak from a missed supper,
                                   unless that leaves fewer than two; never a locked trip: with fewer than two well the hurt may
                                   go too (TripOdds' hurtGoes), the hunger-sick only when nobody else at all can. Two well or
                                   more: two go; fewer: one, and a second only if the player puts them at the hatch. Aris
                                   under stress (BLEEDING_HEART) stays in the med bay while someone else is hurt: not in it,
                                   unless nobody else can go
     weak(app) → ['jaxon', ...]    fit, but too weak from a missed supper for this trip (Stop.js stands them aside)
     holdLoss(app, id, picked) → 'Aris goes: nobody aboard can treat the hurt.'   what the ship loses while id is down (the pick)
     lossOf(app, id, picked) → 'nobody aboard can treat the hurt' | ''   the same, only the loss ('' when nothing is lost)
     propose(app) → { ids: [a, b], why: { id: 'wreck work' } } | null   the two the crew put forward for THIS world, from
                                   what we know of it (its type, its visible tags, the wreck, what the scans read; once its
                                   finds show, the find chosen) and what the ship loses without them; why: a few plain words
                                   for everyone fit to go. One id when fewer than two are well: the well one (a hurt one goes
                                   too only if the player adds them at the hatch)
     teamRisk(app, ids, way?) → 25 | null  the chosen find's hurt chance with ids down (TripOdds with App.tripRisk, the
                                   way's own risk, the fit and anyone hurt going; way: the card's index, left out the way
                                   GO DOWN vouches for, the careful one, its mark's number, unless a stress trait may
                                   strike it); before a scan, the blind trip's; null where a blind trip meets a site's own
                                   story or Eden's card
     teamOdds(app, ids, way?) → { hurt, death, deadly, oneIn } | null   the same find's odds (TripOdds), for the way GO DOWN
                                   vouches for (App.sureWay) unless way is given: GO DOWN shows its hurt chance and, where it
                                   can kill, its death chance
     fitOf(app, node, ids, find?) → 3   the team's fit points for a find (TripOdds' fit; the tables are TripOdds.FIT)
     hasTeamAction(planet) → bool  this place has a team trip still to take: a find still open, or before a scan one blind
                                   trip (handleWarp defers the breach to it)
     opened(app)                   the bridge is up: the crisis sign is decided (once per place) and said; a sign comes
                                   true while the team is down at NEW_LOOK_ECONOMY.CRISIS_CHANCE
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
     TELL                          { key: line }  what A.U.R.A. says once a run when an action first shows (Stop.js), and 'leave'
     debug() → { trip, call, breach, held }
   Crew moments (App.queueModal('crew', ...), the "A MOMENT WITH ..." cards bundle rolls 2 s after a warp) are held here
   while we arrive, sit on the bridge or pick the team: they open in travel, once it is calm (the view up and no card for
   2.5 s, no click for 1.2 s), under ChoiceGuard's 400 ms hold. One waits at a time (a later roll is let go). A moment whose person died meanwhile is dropped.
   Bus (NewScreen.bus): emits 'trip:down' { ids, aboard }, 'trip:back' { ids, failed? }, 'stop:skim' { id }.
*/
(function () {
    'use strict';
    const NS = () => window.NewScreen;
    const CREW_BY_TAG = { LEADER: 'cora', ENGINEER: 'jaxon', MEDIC: 'aris', SECURITY: 'vance', SPECIALIST: 'mira' };
    const SKIM_ENERGY = (window.NEW_LOOK_ECONOMY && window.NEW_LOOK_ECONOMY.SKIM) || 15;   // bundle.js NEW_LOOK_ECONOMY, the one place it is set
    /** A number from the same table, read when used. Missing (a renamed key), it is logged and `before` is used: the rule
        before the table had it, never a second copy of the table's number. */
    function econ(key, before) {
        const v = window.NEW_LOOK_ECONOMY && window.NEW_LOOK_ECONOMY[key];
        if (typeof v === 'number') return v;
        console.error(`NSOrbit: NEW_LOOK_ECONOMY.${key} is missing; using the old ${before}`);
        return before;
    }
    const PATCH_COST = 5, TRIP_QUIET_MS = 3500, TRIP_OVER_MS = 600, TRIP_LOST_MS = 20000, FIX_CHECK_MS = 500;
    const TREAT_WAIT_MS = 9000;                                                              // the trip's story waits at most this long for the treat line
    const BREACH_WAIT_MS = 5000;                                                             // a breach at a stop with no trip: the bridge is seen first
    const DECK_KEY = { bridge: 'bridge', lab: 'lab', quarters: 'quarters', hold: 'cargo', cargo: 'cargo', engineering: 'engineering' };
    const DECK_WORD = { bridge: 'bridge', lab: 'lab', quarters: 'quarters', cargo: 'hold', engineering: 'engine room' };
    const NOT_CRISES = new Set(['LUCKY_FIND']);                                              // a find is not a crisis
    const CALM_SHOWN_MS = 2500, CALM_CLICK_MS = 1200;                                        // a held crew moment opens only after both
    const aura = text => `A.U.R.A.: "${text}"`;
    const SIGN = {
        BREACH: "The hull's been groaning since the last scrape.", HULL_STRESS: "The hull's been groaning since the last scrape.",
        MICRO_METEOR: "The hull's been groaning since the last scrape.", POWER_SURGE: "Engineering's been surging, Commander.",
        LIFE_SUPPORT_HICCUP: 'The air recyclers keep stuttering.', CRYO_LEAK: 'One of the pods keeps blinking.',
    };
    const OTHER_SIGN = "Something aboard doesn't sound right, Commander.";
    const LINES = {
        pair: aura('Nobody aboard can go down, Commander.'),                             // DRAFT: never locked, so only when nobody at all can go
        away: aura('The team is still down there, Commander. We wait for them.'),
        pick: aura('Pick two people fit to go, Commander.'),
        call: aura('An old distress call is coming in, Commander.'),
        unanswered: 'We left the call unanswered.',
        jaxonSurge: 'Power surge in engineering. Jaxon fixed it at no cost.',
        jaxonSays: 'Jaxon: "Got it. The drive\'s calm."',
        vancePulled: names => `I got ${names} out in time. No lasting harm.`,             // said by the one who treats them (treat)
        arisTreated: names => `I've treated ${names}. Give it until the next stop.`,      // DRAFT: well at the next stop, as on a trip (treat)
        miraScanned: 'Mira: "I\'ve scanned the ground. Go round the soft part."',
        arisTeam: names => `Aris: "I've treated ${names}. Give it until the next stop."`,   // DRAFT: well at the next stop (GameState.mendOnArrival)
        arisAboard: aura("Aris won't leave the med bay."),                                // DRAFT: BLEEDING_HEART, someone hurt: the others go without her
        fixOnBench: 'Mira: "The star fix is on my bench."',
        fixReady: aura('The star fix is ready to date, Commander.'),
    };

    // what A.U.R.A. says once a run when an action first shows on the bridge (plain, 15 words at most)
    const TELL = Object.freeze({
        scan: 'I scan each world as we arrive. The marks show where the team can go.',   // DRAFT: said once, during the first sweep (Stop.js)
        find: 'Pick a mark, Commander. The team goes there.',
        team: '{team} are ready at the hatch. Click anyone to change who goes.',   // {team}: "Vance and Mira" (Stop.js fills it in)
        skim: 'Refuel scoops gas from the clouds. Free energy, once per giant.',
        date: 'Date the wreck to learn where its crew went. It costs nothing.',
        strange: 'Fly closer takes the whole ship in. Something here is wrong.',
        dock: 'Dock and we search the station. It may hold salvage, Commander.',
        mine: 'Mine it and we cut salvage from the rocks. Salvage fixes the ship.',
        call: 'Answer the call to hear who needs help. If we leave, it is lost.',
        settle: 'This world could be home, Commander. Settling ends the journey. Hold the key if you choose it.',
        leave: 'Leave orbit takes us back out. Then pick the next world.',
        escape: 'Hold the key and we fight our way out, Commander. It will cost us.',     // DRAFT: the copy of Earth (stop/Copy.js)
        accept: 'Hold Go down and we land on it. The journey would end there.',           // DRAFT
    });

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
    /** Who may go down (handleEvaAction asks the same, NSOrbit.pool): HEALTHY, not the commander, not confined, not asleep;
        and not too weak from going without supper (GameState.serveSupper's _nsWeak), unless that would leave fewer than two:
        then the weak go too, so a story world is never closed by a supper. A trip is never locked: with fewer than two
        well, the hurt may go too (not Aris while she has shut down), at more risk (TripOdds' hurtGoes), but only if the
        player puts them at the hatch (teamSizes); the hunger-sick (GameState.goWithout: in bed until they eat) only when
        nobody else at all can go. Aris under stress (BLEEDING_HEART) stays in the med bay while someone else is hurt
        (arisRefuses): the others go without her, and with nobody else to go she goes after all. */
    function evaCrew(app) {
        const s = app && app.state, crew = (s && s.crew) || [], aris = arisRefuses(app) ? byRole(s, 'MEDIC') : null;
        const free = c => !tags(c).includes('LEADER') && !tags(c).includes('CONFINED') && !tags(c).includes('SEDATED');
        const hurtCan = c => c.status === 'INJURED' && c.trait !== 'CATATONIC' && free(c);
        const fit = crew.filter(c => c !== aris && c.status === 'HEALTHY' && free(c));
        const strong = fit.filter(c => !c._nsWeak);
        if (strong.length >= 2) return strong;
        if (fit.length >= 2) return fit;
        const some = fit.concat(crew.filter(c => c !== aris && hurtCan(c) && !c._nsHungerSick));
        if (some.length) return some;
        if (aris && (isWell(aris) || hurtCan(aris)) && !aris._nsHungerSick) return [aris];       // nobody else can go: Aris goes after all
        return crew.filter(c => hurtCan(c) && c._nsHungerSick);                                 // the hunger-sick, only when nobody else at all can go
    }
    /** How many go down: { fewest, most }. Two or more well: two. Fewer: one, and a second only if the player puts them at
        the hatch (Stop.js): a hurt one never has to go beside the well one. */
    function teamSizes(app) {
        const pool = evaCrew(app), most = Math.min(2, pool.length);
        return { most, fewest: pool.filter(c => c.status === 'HEALTHY').length >= 2 ? most : Math.min(1, most) };
    }
    const isHurt = c => !!c && c.status === 'INJURED';
    const eligible = app => evaCrew(app).map(idOf);
    /** Who stays aboard this trip because they went without supper: well, weak, and left out of the lineup (Stop.js puts them
        aside on the bridge, with the reason when pointed at). */
    function weak(app) {
        const s = app && app.state, pool = evaCrew(app);
        return ((s && s.crew) || []).filter(c => c._nsWeak && isWell(c) && !tags(c).includes('LEADER') && !pool.includes(c)).map(idOf);
    }
    /** Aris under stress (BLEEDING_HEART) won't leave the med bay while someone else is hurt: the hurt one, or null (her own
        injury keeps nobody aboard). The default game's handleEvaAction refuses every trip then; the new look never locks
        one, so evaCrew only leaves her aboard while someone else can go. */
    function arisRefuses(app) {
        const s = app && app.state;
        if (!s || typeof s.hasActiveTrait !== 'function' || !s.hasActiveTrait('BLEEDING_HEART')) return null;
        return (s.crew || []).find(c => alive(c) && c.status === 'INJURED' && !tags(c).includes('MEDIC')) || null;
    }

    // ── what this place offers ──
    function siteOpen(app, node) {
        const site = app && typeof app.siteOf === 'function' ? app.siteOf(node) : null;
        return site && !node[site.done] ? site : null;
    }
    /** The strange site (a gap, a door...) is the ship's to fly to, not the team's: some of its choices move the whole ship. */
    const strangeSite = (app, node) => { const site = siteOpen(app, node); return site && site.tag === 'ANOMALY' ? site : null; };
    function teamSite(app, node) { const site = siteOpen(app, node); return site && site.tag !== 'ANOMALY' ? site : null; }
    /** A team trip is still to take here (counting nobody: who is fit is asked when the bridge is up). Once a scan has read the
        world, a trip per find still open (WorldFinds.js); before, one blind trip, as in the default game. */
    function hasTeamAction(planet) {
        const n = planet, app = window.app, F = window.NSWorldFinds;
        if (!isPlanet(n) || n.ghost) return false;
        if (F && F.known(n)) return F.list(app, n).some(f => !f.done);
        if (n.hasEva) return false;
        return n.type !== 'GAS_GIANT' || !!teamSite(app, n);                                 // a giant has no ground, unless a site is in orbit
    }
    /** Where GO DOWN takes the team (WorldFinds.target), or null: a blind trip (no scan yet). */
    function targetFind(app, n) { const F = window.NSWorldFinds; try { return F && n && F.known(n) ? F.target(app, n) : null; } catch (err) { console.error('NSOrbit: the target failed', err); return null; } }
    /** Before a scan: the find a blind trip goes to (WorldFinds.blind), for its clue only. */
    function blindFind(app, n) { const F = window.NSWorldFinds; try { return F && n ? F.blind(app, n) : null; } catch (err) { console.error('NSOrbit: the blind find failed', err); return null; } }
    /** The trip lands as a plain landing (its event's card, where Mira's ground scan from aboard counts): no site's own story, not Eden's card. */
    function plainTrip(app, n) {
        const f = targetFind(app, n);
        if (f) return f.kind === 'event';
        return !teamSite(app, n) && n.type !== 'EDEN';
    }
    function canDate(app, node) {
        if (!app || !node || typeof app.canDateWreck !== 'function' || !app.canDateWreck(node)) return false;
        const fix = node._nsFix, s = app.state;
        if (fix == null && trip && trip.node === node.id) return false;                     // the team is still at this wreck: fixIn decides when it can be dated
        return fix == null || fix === 'now' || (typeof fix === 'number' && ((s && s._paidWarps) || 0) > fix);
    }
    function datable(state) {
        const app = window.app;
        if (!app || !state) return null;
        return (state.sectorNodes || []).find(n => canDate(app, n)) || null;
    }
    // what an action costs and gives, as chips under its word on the glass (Stop.js): the icon's name and a word or three
    const FREE = Object.freeze({ icon: 'free', text: 'free' });
    const chip = (icon, text, tone) => Object.freeze(tone ? { icon, text, tone } : { icon, text });
    function actions(app) {
        const s = app && app.state, n = s && s.currentSystem;
        if (!n) return [];
        const out = [], add = (key, words, near, run, team, sub, chips) => out.push({ key, words, near, team: !!team, run, sub: sub || '', chips: chips || [] });   // sub: what it gives or costs, in a few words
        if ((n.isStructure || n.type === 'STRUCTURE') && !n.structureApproached) add('light', 'Go into the light', 'world', () => app.handleStructureAction());
        if (n._isWrongPlace) {                                                               // the copy of Earth (stop/Copy.js): once it has stopped turning
            const CP = window.NSCopy;
            if (CP && !CP.ready(n)) return out;
            if (CP && !(n._nsCopy && n._nsCopy.scanned)) add('scan', 'Scan', 'world', () => CP.scan(app), false, 'read the ground', [FREE]);
            add('escape', 'Fight to escape', 'key', () => (CP ? CP.escape(app) : window.dispatchEvent(new CustomEvent('req-wrong-escape'))), false, 'costs a lot', CP ? CP.fightChips(app) : []);
            add('accept', 'Go down', 'key', () => window.dispatchEvent(new CustomEvent('req-wrong-accept')), false, 'ends the journey', [chip('end', 'ends the journey', 'cool')]);
            return out;
        }
        if (n.isStation && !n.stationInvestigated) add('dock', 'Dock', 'station', () => app.handleStationAction(), false, 'search the station', [FREE, chip('salvage', 'salvage')]);
        if (n.isAsteroidField && !n.asteroidMined) add('mine', 'Mine it', 'field', () => app.handleAsteroidAction(), false, 'for salvage', [FREE, chip('salvage', 'salvage')]);
        const scoop = (s.upgrades || []).includes('fuel_scoop');                             // the scoop took its fill on arrival: no skim on top
        const gain = Math.min(SKIM_ENERGY, Math.max(0, Math.round(100 - s.energy)));
        if (n.type === 'GAS_GIANT' && !n.nsSkimmed && !scoop && s.energy < 100) add('skim', 'Refuel', 'giant', () => skim(app, n), false, `+${gain} energy`, [chip('energy', `+${gain} energy`, 'gain')]);   // full tanks: nothing to skim
        if (isPlanet(n) && strangeSite(app, n) && !trip) add('strange', 'Fly closer', 'site', () => app.handleAnomalyAction(), false, 'something here is wrong', [chip('risk', 'something here is wrong', 'risk')]);   // never while a team is down
        if (hasTeamAction(n) && evaCrew(app).length >= 1 && !trip) add('team', 'Send the team', teamSite(app, n) ? 'site' : 'world', null, true);   // never locked: one can go alone, and Aris may stay aboard
        if (!call && n._nsCall) call = savedCall(n);                                         // a call that waited through a reload
        if (call) add('call', 'Answer the call', 'call', () => answer(app), false, 'someone needs help', [chip('help', 'someone needs help')]);
        if (canDate(app, n)) add('date', 'Date the wreck', alive(byRole(s, 'SPECIALIST')) ? 'mira' : 'aura', () => app.dateWreck(n), false, 'where they went', [FREE, chip('where', 'where they went')]);
        if (isPlanet(n) && n.type !== 'GAS_GIANT' && (n.scanned || window.TEST_MODE)) add('settle', 'Settle here', 'under', () => app.handleColonyAction(), false, 'ends the journey', [chip('end', 'ends the journey', 'cool')]);
        return out;
    }
    /** The bridge's scan (the game's own handleScanAction, no tuning). It runs by itself when we arrive: Stop.js sweeps the
        glass first; then the finds show as marks on the world (WorldFinds.js) and A.U.R.A. says one line (NSScan.deep). It
        marks the landing spot and makes a plain landing safer (bundle.js unmarkedWhy, scanRiskMod). */
    function scan(app) { app.handleScanAction(false); }
    /** A world nobody has scanned from the bridge (the copy of Earth has its own Scan, a tag: stop/Copy.js). */
    function scanDue(app) { const n = app && app.state && app.state.currentSystem; return isPlanet(n) && !n.scanned; }
    function act(app, key, ids) {
        const a = actions(app).find(x => x.key === key);
        if (!a && key === 'scan' && scanDue(app)) { try { scan(app); } catch (err) { console.error('NSOrbit: scan failed', err); return false; } return true; }
        if (!a) return false;
        if (a.team) return send(app, ids || []);
        try { a.run(); } catch (err) { console.error(`NSOrbit: ${key} failed`, err); return false; }
        return true;
    }
    /** Refuel (ECONOMY.md's skim): hydrogen scooped from a gas giant's cloud tops. The only new number at a stop. Once per gas giant. */
    function skim(app, n) {
        const s = app.state, got = Math.min(SKIM_ENERGY, Math.max(0, 100 - s.energy));
        n.nsSkimmed = true;
        s.energy = Math.min(100, s.energy + SKIM_ENERGY);
        log(s, aura(`Hydrogen from the cloud tops, Commander. +${got} energy.`));
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
            n._nsCrisis = ev ? { kind: ev.id, comes: chance(econ('CRISIS_CHANCE', 0.5), 'crisis') } : null;
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
        const pool = hasTeamAction(n) ? evaCrew(app) : null, aris = byRole(s, 'MEDIC');
        if (pool && pool.length && arisRefuses(app) && !pool.includes(aris) && !arisSaid.has(n.id)) { arisSaid.add(n.id); log(s, LINES.arisAboard); }   // she stays aboard; the others still go
        if (pool && pool.length < 1 && !pairSaid.has(n.id)) { pairSaid.add(n.id); log(s, LINES.pair); }
    }
    /** The breach, played by the game's own App.playBreach (away: the crew who are not aboard). The patches break first. */
    function playBreach(app, away) {
        breakPatched(app.state);
        pendingBreach = null;
        return Promise.resolve(app.playBreach(away || [])).catch(err => console.error('NSOrbit: the breach failed', err));
    }

    // ── the team trip ──
    function send(app, ids) {
        const s = app.state, n = s.currentSystem, pool = evaCrew(app), size = teamSizes(app);
        const team = (ids || []).map(id => pool.find(c => idOf(c) === id)).filter(Boolean);
        if (!n || trip || !team.length || team.length !== (ids || []).length || team.length < size.fewest || team.length > size.most || team[0] === team[1]) { log(s, LINES.pick); return false; }
        const aboard = s.crew.filter(c => alive(c) && !team.includes(c)).map(idOf), find = targetFind(app, n), before = n.nsTrips || 0;
        const blind = find ? null : blindFind(app, n);                                       // no scan yet: where the blind trip goes (its clue still counts)
        trip = { ids: team.map(idOf), aboard, node: n.id, find, blind, hurtBefore: new Set(s.crew.filter(c => c.status !== 'HEALTHY').map(idOf)), downDone: false, quiet: 0, lost: 0 };
        app._pickedEvaTeam = team;                                                           // handleEvaAction skips AwayTeam.pick
        app._nsFind = find;                                                                  // where they go: its own event (none: a blind trip)
        emit('trip:down', { ids: trip.ids.slice(), aboard: aboard.slice() });
        try { app.handleEvaAction(); } catch (err) { console.error('NSOrbit: the team trip failed', err); }
        app._nsFind = null;
        if ((n.nsTrips || 0) === before) {                                                   // refused (Aris will not, nobody fit): nothing was spent
            app._pickedEvaTeam = null;
            const back = trip.ids; trip = null;
            emit('trip:back', { ids: back, failed: true });
            return false;
        }
        s.crew.forEach(c => { delete c._nsWeak; });                                          // the next team trip has gone: whoever was too weak missed it
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
            if (!crisis) return null;
            const hurtNow = s.crew.filter(m => m.status === 'INJURED' && !members.includes(m) && !hurtBefore.has(idOf(m)));
            const vance = crisis === 'BREACH' ? aboardWell('SECURITY') : null, healer = hurtNow.length ? vance || aboardWell('MEDIC') : null;
            return healer ? treat(app, healer, hurtNow, (healer === vance ? LINES.vancePulled : LINES.arisTreated)(hurtNow.map(m => m.name).join(' and '))) : null;
        }).then(() => {
            if (aboardWell('SPECIALIST')) { app._nsScanMod = econ('MIRA_ABOARD', -10); log(s, LINES.miraScanned); }
            s.emitUpdates();
        }).catch(err => console.error('NSOrbit: the crisis aboard failed', err)).then(() => { if (trip) trip.downDone = true; });
    }
    /** Someone aboard treats the crew a crisis hurt, in the open (2026-10-16: the heal was silent, its line lost behind the
        trip's card, so the player saw an injury vanish). The line is said now on the bridge, by the healer, and logged; the
        trip's story (its card) waits until the line has left the screen (TREAT_WAIT_MS at most). Vance pulled them out in
        time: they are well. Aris treated them: an injury lasts, so they are up by the next stop, as when she goes down with
        a team (_nsMendAt, GameState.mendOnArrival). With no voice to say it on screen nobody is treated: they stay hurt, in
        the med bay, where the tower shows them. */
    function treat(app, healer, hurt, text) {
        const s = app.state, ns = NS(), v = ns && ns.mods && ns.mods.voice;
        if (!v || typeof v.say !== 'function' || !ns.isShown()) return Promise.resolve();
        let said = null;
        try { said = v.say({ id: idOf(healer), who: healer.name, text, keep: true }); } catch (err) { console.error('NSOrbit: the treat line failed', err); return Promise.resolve(); }
        if (tags(healer).includes('MEDIC')) hurt.forEach(m => { m._nsMendAt = s._paidWarps || 0; });
        else heal(hurt);
        log(s, `${healer.name}: "${text}"`);                                              // the log keeps it (the voice skips the line it is saying)
        s.emitUpdates();
        return Promise.race([Promise.resolve(said).catch(() => false), new Promise(r => setTimeout(r, TREAT_WAIT_MS))]);
    }
    // ── who holds the ship: what the ship loses while someone is down (whileDown's own rules, for this stop's sign) ──
    const NAME = { jaxon: 'Jaxon', aris: 'Aris', vance: 'Vance', mira: 'Mira' }, PRONOUN = { jaxon: 'him', aris: 'her', vance: 'him', mira: 'her' };
    /** The bridge's hover line at the pick (Stop.js): what the ship loses while `id` is down, with the others picked so far
        down too. whileDown's rules: Jaxon aboard stops a power surge; Vance aboard pulls the hurt out of a breach, else Aris
        aboard treats anyone a crisis hurts (a coolant leak can); Mira aboard scans the ground, which only a plain landing uses.
        Only this stop's sign can come (sign()), and only on the first trip down (whileDown plays it once). '' for anyone else. */
    function holdLoss(app, id, picked) {
        const s = app && app.state, n = s && s.currentSystem;
        if (!n || !NAME[id]) return '';
        const lost = lossOf(app, id, picked);
        return `${NAME[id]} goes: ${lost || `nothing aboard needs ${PRONOUN[id]} this time`}.`;
    }
    /** What the ship loses while `id` is down with `picked` (holdLoss's own rules), the loss alone: '' when nothing is lost. */
    function lossOf(app, id, picked) {
        const s = app && app.state, n = s && s.currentSystem;
        if (!n || !NAME[id]) return '';
        const spent = (n.nsTrips || 0) > 0 && !breachDue(s, n);                              // the sign comes on the first trip down or not at all
        const c = !spent && (hasTeamAction(n) || breachDue(s, n)) ? sign(app) : null, kind = c ? c.kind : null;
        const away = new Set([id].concat(picked || []));
        const aboard = tag => { const m = byRole(s, tag); return !!m && !away.has(idOf(m)) && isWell(m); };
        return {
            jaxon: kind === 'POWER_SURGE' ? 'nobody aboard can stop the power surge' : '',
            aris: kind === 'CRYO_LEAK' || (kind === 'BREACH' && !aboard('SECURITY')) ? 'nobody aboard can treat the hurt' : '',
            vance: kind === 'BREACH' && !aboard('MEDIC') ? 'nobody can pull people out of the breach' : '',
            mira: plainTrip(app, n) ? 'nobody scans the ground for them' : '',
        }[id] || '';
    }

    // ── the crew put two forward: who fits THIS world, from what we know of it, and who the ship can spare ──
    // Each fit: [crew id, score, why]. Only what the player can know counts: the world's type (the travel note names it), its
    // visible tags (a scan reveals hidden predators into them), the wreck (named in travel), and, once scanned, the site and the
    // ground (NSScan.facts). A loss aboard (lossOf) costs NEED; ties go to whoever has gone down least (bundle.js _tripsDown),
    // then to the game's own order (selectEvaTeam: security, engineer, specialist, medic).
    // The fit tables are TripOdds.FIT (src/data/TripOdds.js), shared with the run model; a point of fit makes a trip
    // NEW_LOOK_ECONOMY.FIT_PER_POINT % safer (TripOdds.odds).
    const NEED = 2;
    const PRIORITY = ['vance', 'jaxon', 'mira', 'aris'];
    const FITS = (window.TripOdds && window.TripOdds.FIT) || { SITE: {}, TYPE: {}, TAG: {}, DANGER: {}, FEATURE: {}, ROLE_WHY: {} };
    if (!window.TripOdds) console.error('NSOrbit: TripOdds.js is not loaded; nobody fits any world');
    const { ROLE_WHY, SITE: SITE_FIT, TYPE: TYPE_FIT, TAG: TAG_FIT, DANGER: DANGER_FIT, FEATURE: FEATURE_FIT } = FITS;
    const hasDisc = s => !!(s && (s.hasDisc || (typeof ITEMS !== 'undefined' && ITEMS.DISC_DRAWING && (s.cargo || []).some(i => i.id === ITEMS.DISC_DRAWING.id))));
    /** The best fit per crew id for this world: { id: { score, why } } (no fit: score 0, their role's words). Once a scan has
        shown the finds, for the one the team goes to: its site, the world's own event, or its feature (with what hunts there).
        find: that find (NSWorldFinds' find, or { kind: 'event', feature }), to ask about another than the target; null: a
        blind trip (no scan yet); left out: the target. */
    function fitsOf(app, n, find) {
        const s = app.state, tags = n.tags || [], scanned = !!(n.scanned || n.remoteScanned);
        const site = siteOpen(app, n), wreck = !!(n.isFirstSignal || tags.includes('EXODUS_WRECK')), aimed = find === undefined ? targetFind(app, n) : find;
        const siteTag = aimed ? (aimed.kind === 'site' ? aimed.site : null)
            : site && (site.tag === 'EXODUS_WRECK' ? wreck : scanned) && site.tag !== 'ANOMALY' ? site.tag : null;   // the strange site is the ship's
        let facts = null;
        try { facts = window.NSScan ? window.NSScan.facts(app, n) : null; } catch (err) { facts = null; }
        const plain = aimed ? aimed.kind === 'event' : !siteTag;
        const own = aimed ? (aimed.kind === 'event' && !aimed.feature ? TYPE_FIT[n.type] || [] : FEATURE_FIT[aimed.feature] || []) : TYPE_FIT[n.type] || [];
        const hunted = plain && tags.includes('PREDATORY') ? TAG_FIT.PREDATORY : [];          // what hunts there meets a plain landing only
        const byTag = aimed ? hunted : [].concat(...tags.map(tg => TAG_FIT[tg] || []));
        const list = [].concat(SITE_FIT[siteTag] || [], own, byTag, plain ? DANGER_FIT[facts && facts.danger] || [] : []);
        if (siteTag === 'EXODUS_WRECK') list.push(hasDisc(s) ? ['mira', 3, 'gets the star fix'] : ['mira', 1, 'reads their logs']);   // their star fix: dated now if she went (fixIn)
        const out = {};
        Object.keys(NAME).forEach(id => { out[id] = { score: 0, why: ROLE_WHY[id] }; });
        list.forEach(([id, score, why]) => { if (score > out[id].score) out[id] = { score, why }; });
        return out;
    }
    /** The team's fit points for a find (TripOdds.odds' fit): each one's best fit for it (fitsOf), added up. find: as fitsOf's
        (left out: the target). App.tripContext and NSWorldFinds' marks read it, and so does the run model. */
    function fitOf(app, n, ids, find) {
        if (!app || !app.state || !n || !(ids || []).length) return 0;
        const fit = fitsOf(app, n, find);
        return ids.reduce((sum, id) => sum + ((fit[id] && fit[id].score) || 0), 0);
    }
    /** The two the crew put forward (one, when fewer than two are well: the well one, else the best of the hurt; a hurt one
        goes beside them only if the player adds them, teamSizes). Each scores their fit for this find, less what the ship loses
        without them aboard (lossOf: NEED; Mira's ground scan from aboard is worth FIT_MIRA_ABOARD points), plus
        FIT_JAXON_LANDS for Jaxon while A.U.R.A. lands us (his step on her landing, App.applyLanding), less the risk of going
        down hurt (HURT_GOES_RISK in points of fit). Before a scan, a plain trip's fit is for the world's own event, the find
        its odds count (NSWorldFinds.blind): the tags of a world nobody has read do not put anyone forward. */
    function propose(app) {
        const s = app && app.state, n = s && s.currentSystem;
        if (!n || !hasTeamAction(n)) return null;
        const pool = evaCrew(app).map(idOf).filter(id => NAME[id]);
        if (!pool.length) return null;
        const blind = !targetFind(app, n) && plainTrip(app, n) ? blindFind(app, n) : null;   // no scan yet: the world's own event, as its odds count it
        const fit = fitsOf(app, n, blind || undefined), member = id => (s.crew || []).find(m => idOf(m) === id), trips = id => { const c = member(id); return (c && c._tripsDown) || 0; };
        const why = {};
        pool.forEach(id => { why[id] = fit[id].why; });
        if (pool.length === 1) return { ids: pool.slice(), why };
        const rank = id => PRIORITY.indexOf(id), plain = plainTrip(app, n);
        const hurtCost = econ('HURT_GOES_RISK', 0) / Math.max(1, econ('FIT_PER_POINT', 1));   // (before the table: no cost)
        const miraAboard = econ('FIT_MIRA_ABOARD', NEED), jaxonLands = econ('FIT_JAXON_LANDS', 0);   // (before: a loss aboard was NEED)
        const value = (id, mates) => fit[id].score - (lossOf(app, id, mates) ? (id === 'mira' ? miraAboard : NEED) : 0)
            + (id === 'jaxon' && plain && s._nsLandAuto ? jaxonLands : 0) - (isHurt(member(id)) ? hurtCost : 0);
        const well = pool.filter(id => !isHurt(member(id)));
        if (well.length < 2) {                                                               // fewer than two well: one goes (teamSizes)
            const one = (well.length ? well : pool).slice().sort((a, b) => value(b, []) - value(a, []) || trips(a) - trips(b) || rank(a) - rank(b))[0];
            return { ids: [one], why };
        }
        let best = null;
        for (let i = 0; i < pool.length; i++) for (let j = i + 1; j < pool.length; j++) {
            const a = pool[i], b = pool[j];
            const score = value(a, [b]) + value(b, [a]);
            const cand = { ids: [a, b], score, trips: trips(a) + trips(b), order: Math.min(rank(a), rank(b)) * 10 + Math.max(rank(a), rank(b)) };
            if (!best || cand.score > best.score || (cand.score === best.score && (cand.trips < best.trips || (cand.trips === best.trips && cand.order < best.order)))) best = cand;
        }
        return { ids: best.ids.slice(), why };
    }
    /** The odds GO DOWN shows with ids going down (TripOdds: { hurt, death, deadly, oneIn }): the chosen find's (WorldFinds.js:
        App.tripRisk, the way's own risk, the team's fit, someone hurt going, something hunting there, Vance's cover; its mark
        shows the careful way's hurt chance); before a scan, the blind trip's plain landing the same way. way: the way's index
        on its card; left out, the way GO DOWN vouches for (App.sureWay: the careful one, unless a stress trait may strike it).
        null: a site's own story or Eden's card. */
    function teamOdds(app, ids, way) {
        const s = app && app.state, n = s && s.currentSystem, F = window.NSWorldFinds;
        if (!n || !isPlanet(n) || !F || typeof F.oddsOf !== 'function' || typeof app.tripRisk !== 'function') return null;
        let ev = null, find = null;
        if (F.known(n)) {
            find = F.list(app, n, ids).find(x => x.target) || null;
            if (!find || typeof find.risk !== 'number') return null;
            if (find.kind !== 'event') return { hurt: find.risk, death: 0, deadly: false, oneIn: null };   // a site's or Eden's own card says its odds (its mark's number, as before)
            ev = typeof EVENTS !== 'undefined' ? EVENTS.find(e => e.id === find.event) || null : null;
        } else if (!teamSite(app, n) && n.type !== 'EDEN') ev = typeof app.landingEventOf === 'function' ? app.landingEventOf(n) : null;
        if (!ev) return null;
        const idx = way != null ? way : typeof app.sureWay === 'function' ? app.sureWay(ev) : null;
        return F.oddsOf(app, n, ev, ids, { way: idx, find });
    }
    /** The hurt chance of teamOdds (GO DOWN's "risk N%"). */
    function teamRisk(app, ids, way) { const o = teamOdds(app, ids, way); return o ? o.hurt : null; }

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
            delete vance._nsMendAt; delete other._nsMendAt;                                  // a new injury for Vance: no old "up by the next stop"
            log(s, `Vance took the hit for ${other.name}.`);
        }
        const aris = team.find(m => tags(m).includes('MEDIC'));
        const hurt = team.filter(hurtOnTrip);
        if (aris && aris.status === 'HEALTHY' && hurt.length) {                              // up by the next stop, not at once (GameState.mendOnArrival)
            hurt.forEach(m => { m._nsMendAt = s._paidWarps || 0; });
            log(s, LINES.arisTeam(hurt.map(m => m.name).join(' and ')));
        }
        app._nsScanMod = 0;
        if ((t.find || t.blind) && window.NSWorldFinds) {                                    // a clue on the find they went to: the story world is named
            try { window.NSWorldFinds.clue(app, t.find || t.blind); } catch (err) { console.error('NSOrbit: the clue failed', err); }
        }
        s.emitUpdates();
        emit('trip:back', { ids: t.ids.slice() });
    }
    function tick(dt, blocked) {
        const app = window.app, ns = NS();
        if (!app || !app.state) return;
        holdMoments(app);
        if (blocked) moments.calmFrom = performance.now();                                    // a card just closed is not calm yet
        else if (moments.held.length && calm(app, blocked)) releaseMoment(app);
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

    // ── crew moments wait for a calm moment in travel (never on arrival, on the bridge or during the pick) ──
    const moments = { app: null, held: [], calmFrom: 0, lastDown: -1e9, hooked: false };
    /** App.queueModal, wrapped once per App: a crew moment is kept here; every other card goes through as before. */
    function holdMoments(app) {
        if (!app || moments.app === app || typeof app.queueModal !== 'function') return;
        const real = app.queueModal;
        moments.app = app; moments.held = [];
        app.queueModal = function (type, data) {
            if (type === 'crew' && data) { if (!moments.held.length) moments.held = [data]; return; }   // one waits; a later roll is let go (it may come again)
            return real.call(this, type, data);
        };
        app.queueModal.nsReal = real;
        if (moments.hooked) return;
        moments.hooked = true;
        const ns = NS(), calmAgain = () => { moments.calmFrom = performance.now(); };
        if (ns && ns.bus) ['showing', 'shown', 'hidden', 'mode', 'jump:burn', 'opening:done', 'trip:down', 'trip:back'].forEach(n => ns.bus.on(n, calmAgain));
        document.addEventListener('pointerdown', () => { moments.lastDown = performance.now(); }, true);
    }
    /** Travel, the view up a while, no click just now, no card anywhere, nothing queued in the game. */
    function calm(app, blocked) {
        const ns = NS(), now = performance.now(), sup = window.NSSupper;
        if (sup && typeof sup.busy === 'function' && sup.busy()) return false;                // never over supper at the table
        return !!ns && !blocked && ns.isShown() && ns.mode() === 'travel' && !app._isInTransit && !app._modalActive
            && !(app._modalQueue && app._modalQueue.length) && !document.querySelector('.modal-overlay')
            && now - moments.calmFrom >= CALM_SHOWN_MS && now - moments.lastDown >= CALM_CLICK_MS;
    }
    /** One held moment opens (its person still alive), under ChoiceGuard's hold: the click that follows is never swallowed. */
    function releaseMoment(app) {
        const ev = moments.held[0];
        moments.held = moments.held.slice(1);
        if (!ev.targetCrew || ev.targetCrew.status === 'DEAD' || !(app.state.crew || []).includes(ev.targetCrew)) return;
        const before = new Set(document.querySelectorAll('.modal-overlay'));
        try { app.queueModal.nsReal.call(app, 'crew', ev); } catch (err) { console.error('NSOrbit: the crew moment failed', err); return; }
        document.querySelectorAll('.modal-overlay').forEach(el => { if (!before.has(el) && window.ChoiceGuard) window.ChoiceGuard.hold(el); });
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
        actions, act, eligible, weak, holdLoss, lossOf, propose, teamRisk, teamOdds, fitOf, hasTeamAction, opened, signed, beforeLeave, whileDown, tripOver, tick, offerCall, fixIn, canDate, datable,
        breakPatched, deckChoices, deckChoose, sign, scanDue, TELL, pool: app => evaCrew(app).slice(),
        trip: () => (trip ? { ids: trip.ids.slice(), aboard: trip.aboard.slice() } : null),
        debug: () => ({ trip: trip ? { ids: trip.ids, downDone: trip.downDone, over: !!trip.over, quiet: Math.round(trip.quiet) } : null, call: call ? call.title || true : null, breach: pendingBreach ? Math.round(pendingBreach.wait) : null, held: moments.held.map(e => e.id || e.title) }),
    });
})();
