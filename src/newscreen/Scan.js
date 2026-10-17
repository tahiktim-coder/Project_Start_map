/* ═══ Silent Exodus · new screen (?new=1) · Scan.js: what our scans tell us about a world ═════════════════════════════
   What it is: the new look's two scans and what they teach (designer playtests, 2026-10-17: "we almost know nothing about
   planets anymore"). In travel, "Scan" in a world's hover note is the long-range scan: NEW_LOOK_ECONOMY.FAR_SCAN energy, no
   minigame, one A.U.R.A. line, and from then on the note shows a few short tags. On the bridge, "Scan" is the deep scan
   (bundle.js handleScanAction's manual path: SignalTune): the lock decides how much we learn (a weak lock alone cannot read
   the ground) and whether A.U.R.A. marks a landing spot and the trip is safer (bundle.js unmarkedWhy, scanRiskMod).
   The tags read the game's own rules, so they stay true: App.siteOf (what is down there), App.landingEventOf (the event a
   plain landing finds, kept on the world from the first look: what it gives), App.planetRisk (the danger the trip's card
   starts from: how rough the ground is) and EndingSystem.getPlanetViability through SETTLE_COUNCIL.SCAN_TIER (the tier the
   settle question reads: whether people could live there). A sector's own scan hazards still apply: sector 3's interference
   can scramble a long-range air reading, sector 4 hides its predators from it; the deep scan puts both right.
   Loaded only when the new-screen switch is on, after Route.js. Draws nothing: Travel.js shows the note, Stop.js the tags
   under the world's name on the bridge; both reach the game through NewScreen.flow (scanOffer, scan, facts).

   window.NSScan (frozen)
     offer(state, id) → { cost, ok, why } | null   the long-range scan of a landable world ahead that no scan has read (null:
                                 none); ok false: why 'energy' (not enough) or 'bridge' (the bridge deck is down: no long-range scans)
     far(app, id) → bool         run it: the energy, node.remoteScanned, the sector's scan hazard, the landing event kept,
                                 A.U.R.A.'s line said (kept through a hover note) and logged
     facts(app, node | id) → { site, gives, danger, live, tier } | null   what our scans read (null: nothing yet); each a few
                                 lower-case words or null (a weak lock alone: danger 'ground unclear', gives null)
     lines(facts, withSite) → ['One of our ships · salvage and rations', 'Rough ground · people could live here']
     deep(app, node)             the bridge's deep scan is done (bundle.js): A.U.R.A. says what the lock read, logged
     LOCK                        { sharp, fair, weak }: SignalTune's result words in the new look
     TELL                        { far }: what A.U.R.A. says once a run, the first time the long-range scan is offered
*/
(function () {
    'use strict';
    const COST = (window.NEW_LOOK_ECONOMY && window.NEW_LOOK_ECONOMY.FAR_SCAN) || 2;   // bundle.js NEW_LOOK_ECONOMY, the one place it is set
    const CALM_MAX = 10, ROUGH_MAX = 20;      // App.planetRisk (5 % to 30 %, then the signals): calm ground up to 10 %, rough up to 20 %, dangerous above
    const TIER = { EXCELLENT: 'good', GOOD: 'good', MARGINAL: 'marginal', POOR: 'bad', IMPOSSIBLE: 'bad' };   // SETTLE_COUNCIL.SCAN_TIER's own, if it is missing
    // what is down there: the one site a world keeps (App.siteOf)
    const SITE_WORDS = { EXODUS_WRECK: 'one of our ships', FAILED_COLONY: 'an empty colony', ANOMALY: 'something strange', DERELICT: 'wreckage in orbit',
        LIGHTHOUSE: 'an old beacon', GARDEN: 'a garden under glass', GRAVE: 'graves' };
    // what a trip to the site brings home, roughly (each site's own story decides how much: ExodusDerelicts.js, FailedColonyEncounters.js...)
    const SITE_GIVES = { EXODUS_WRECK: 'salvage and rations', FAILED_COLONY: 'salvage and rations', DERELICT: 'salvage and rations',
        LIGHTHOUSE: 'a lot of salvage', GARDEN: 'rations', GRAVE: 'no supplies' };
    const LIVE = { good: 'people could live here', marginal: 'a hard place to live', bad: 'nobody could live here' };
    const LIVE_THERE = { good: 'People could live there, Commander.', marginal: 'It would be a hard place to live, Commander.', bad: 'Nobody could live there, Commander.' };
    const LIVE_HERE = { good: 'People could live here.', marginal: 'It would be a hard place to live.', bad: 'Nobody could live here.' };
    const LOCK_WORD = { sharp: 'Sharp lock, Commander.', fair: 'Fair lock, Commander.', auto: 'I tuned it myself, Commander.', weak: 'Weak lock, Commander.' };
    const MARKED = "I've marked a safe place to land.", UNMARKED = 'Too faint to mark a landing spot.', NO_GROUND = 'There is no ground to land on.';
    const LOCK = Object.freeze({ sharp: 'a safe spot marked, and extra detail — +1 data', fair: 'a safe spot marked for the landing', weak: 'too faint to mark a landing spot' });
    const TELL = Object.freeze({ far: `Scan shows what a world holds before we fly there. It costs ${COST} energy, Commander.` });

    const aura = text => `A.U.R.A.: "${text}"`;
    const cap = t => t.charAt(0).toUpperCase() + t.slice(1);
    const isWorld = n => !!n && !n.isStation && n.type !== 'STATION' && !n.isAsteroidField && !n.ghost && n.type !== 'GAS_GIANT'
        && !n.isStructure && n.type !== 'STRUCTURE' && !n._isWrongPlace && n.type !== 'WRONG_PLACE';
    function find(state, id) {
        if (!state || id == null) return null;
        const here = state.currentSystem;
        if (here && here.id === id) return here;
        return window.NSRoute ? window.NSRoute.find(state, id) : (state.sectorNodes || []).find(n => n.id === id) || null;
    }
    function sfx(name) { const a = window.AudioSystem; if (a && typeof a[name] === 'function') { try { a[name](); } catch (err) { console.error('NSScan: the sound failed', err); } } }
    /** A.U.R.A.'s line now (kept: it waits out a hover note and is seen at least 3 s), and in the log. */
    function speak(state, text) {
        const ns = window.NewScreen, v = ns && ns.mods && ns.mods.voice;
        if (v && typeof v.say === 'function') { try { v.say({ id: 'aura', who: 'A.U.R.A.', text, keep: true }); } catch (err) { console.error('NSScan: the voice failed', err); } }
        if (state && typeof state.addLog === 'function') state.addLog(aura(text));           // the log keeps it (the voice skips the line it is saying)
    }

    // ── what our scans read ──
    function openSite(app, node) {
        const site = app && typeof app.siteOf === 'function' ? app.siteOf(node) : null;
        return site && !node[site.done] ? site : null;
    }
    function tierOf(state, node) {
        if (typeof EndingSystem === 'undefined') return null;
        try {
            const v = EndingSystem.getPlanetViability(node, state);
            return ((window.SETTLE_COUNCIL && window.SETTLE_COUNCIL.SCAN_TIER) || TIER)[v] || null;
        } catch (err) { console.error('NSScan: the viability failed', err); return null; }
    }
    /** What a trip here brings home: the site's own story, the paradise world's card, else the plain landing's event, kept on
        the world now (App.landingEventOf), so the words stay true. resolveEvaOutcome: any resource but salvage is energy. */
    function givesOf(app, node, site) {
        if (site && site.tag !== 'ANOMALY' && SITE_GIVES[site.tag]) return SITE_GIVES[site.tag];   // the strange site is the ship's: the team lands as on a plain world
        if (node.type === 'EDEN') return 'rations and salvage';                                      // App.showEdenEvaModal's own card
        const ev = app && typeof app.landingEventOf === 'function' ? app.landingEventOf(node) : null;
        const vals = ((ev && ev.choices) || []).map(c => c.reward || {}).filter(r => r.type === 'RESOURCE' && r.val && r.val !== 'NOTHING').map(r => r.val);
        if (vals.includes('METALS_HIGH')) return 'a lot of salvage';
        if (vals.includes('METALS')) return 'some salvage';
        return vals.length ? 'a little energy' : 'no supplies';
    }
    function dangerOf(app, node) {
        const r = app && typeof app.planetRisk === 'function' ? app.planetRisk(node).risk : CALM_MAX;
        return r <= CALM_MAX ? 'calm ground' : r <= ROUGH_MAX ? 'rough ground' : 'dangerous ground';
    }
    function facts(app, ref) {
        const s = app && app.state, node = ref && typeof ref === 'object' ? ref : find(s, ref);
        if (!s || !isWorld(node) || (!node.remoteScanned && !node.scanned)) return null;
        const ground = !!node.remoteScanned || node.nsLock !== 'weak', site = openSite(app, node), tier = tierOf(s, node);
        return {
            site: site ? SITE_WORDS[site.tag] || null : null,
            gives: ground ? givesOf(app, node, site) : null,
            danger: !ground ? 'ground unclear' : site && site.inSpace && site.tag !== 'ANOMALY' ? null : dangerOf(app, node),   // the wreckage in orbit: nobody lands
            live: node._scanCorrupted ? 'air reading unsure' : LIVE[tier] || null,                     // sector 3's interference (a deep scan puts it right)
            tier,
        };
    }
    function lines(f, withSite) {
        if (!f) return [];
        return [[withSite === false ? null : f.site, f.gives], [f.danger, f.live]].map(l => l.filter(Boolean)).filter(l => l.length).map(l => cap(l.join(' · ')));
    }

    // ── the long-range scan (travel) ──
    function offer(state, id) {
        const node = find(state, id);
        if (!state || !isWorld(node) || node.remoteScanned || node.scanned || node.storyHidden || !window.NSRoute || !window.NSRoute.ahead(state, node)) return null;
        const bridge = typeof state.isDeckOperational !== 'function' || state.isDeckOperational('bridge');   // the default game's rule too: the bridge runs long-range scans
        const energy = !!window.TEST_MODE || state.energy >= COST;
        return { cost: COST, ok: bridge && energy, why: !bridge ? 'bridge' : !energy ? 'energy' : null };
    }
    /** "Kryos-12 Major has an empty colony, with salvage and rations, on rough ground. People could live there, Commander."
        Calm ground goes unsaid (the tags show it): the line stays short. */
    function farLine(node, f) {
        const what = f.site ? `${f.site}${f.gives ? `, with ${f.gives}` : ''}` : f.gives || 'nothing we can read';
        const said = `${node.name} has ${what}${f.danger && f.danger !== 'calm ground' ? `, on ${f.danger}` : ''}.`;
        return node._scanCorrupted || !LIVE_THERE[f.tier] ? said : `${said} ${LIVE_THERE[f.tier]}`;   // scrambled air: the sector's own line says so
    }
    function far(app, id) {
        const s = app && app.state, o = offer(s, id), node = o && find(s, id);
        if (!o || !o.ok || !node || !s.consumeEnergy(COST)) return false;                            // TEST_MODE: free
        node.remoteScanned = true;
        const cfg = typeof SECTOR_CONFIG !== 'undefined' ? SECTOR_CONFIG[s.currentSector] : null;    // sector 3: the air reading may come back wrong (with its own line)
        if (cfg && cfg.hazard && typeof cfg.hazard.onScan === 'function') {
            try { cfg.hazard.onScan(node, s); } catch (err) { console.error("NSScan: the sector's scan hazard failed", err); }
        }
        const f = facts(app, node);                                                                  // keeps the landing event on the world
        if (f) speak(s, farLine(node, f));
        sfx('sfxScan');
        s.emitUpdates();
        if (typeof app.autoSave === 'function') app.autoSave();
        return true;
    }

    // ── the deep scan (the bridge), once its tune is over ──
    function deep(app, node) {
        const s = app && app.state;
        if (!s || !node) return;
        const lock = LOCK_WORD[node.nsLock] ? node.nsLock : 'auto', world = isWorld(node), tier = world ? tierOf(s, node) : null;
        speak(s, [LOCK_WORD[lock], !world ? NO_GROUND : lock === 'weak' ? UNMARKED : MARKED, LIVE_HERE[tier] || ''].filter(Boolean).join(' '));
    }

    window.NSScan = Object.freeze({ offer, far, facts, lines, deep, LOCK, TELL });
})();
