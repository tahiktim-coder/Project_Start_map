/* ═══ Silent Exodus · new screen (?new=1) · WorldFinds.js: what kind a world is, and what a scan finds on it ════════════
   What it is: the new look's words for a world's kind (one plain line each, docs/STYLE.md, at most ten words: the travel note
   and the first line under the name on the bridge's glass) and its finds: the places on it a team can go, 1 to 3, each with
   what it can give and its risk (designer playtest, 2026-10-17: "scan is useless", "planets look generic"). A find comes from
   what the world really has:
     'site'     its one site (App.siteOf): one of our ships, an empty colony, wreckage in orbit, an old beacon, a garden under
                glass, graves. The strange site is the ship's own ("Fly closer"), never a find
     'kind'     its own landing event (App.landingEventOf, kept on the world: Events.js KIND_EVENTS first); Eden: its valley
     'feature'  one feature as a second event (Events.js FEATURE_EVENTS): old ruins, an old signal (one of our beacons), life,
                machines, the first the world has whose event is not its own event again
   Finds show once a scan has read the world (the bridge's, or travel's far scan); unscanned, the team takes one blind trip as
   today (the site if there is one, else the world's own event). A trip marks its find done; another find is another trip.
   The risk on a find is the chance someone is hurt on its careful way (TripOdds: App.tripRisk, which the trip card starts
   from, the careful choice's own, the fit of the two going down, anyone hurt going): the card's careful choice shows the
   same number, before how the landing went. A site's own story never adds the world's danger: its risk is 0, and its card
   says the risk of each choice.
   A clue: in sectors 2 to 6, while the sector's story world is still a faint contact, one side world carries a clue toward it
   on one of its finds (a survivor's note, a beacon's last course, a star fix); the trip there names the story world
   (App.revealStoryPlanet, as a dated wreck does), and A.U.R.A. says where the clue came from.
   Loaded only when the new-screen switch is on, after Scan.js and before Orbit.js. Draws nothing.

   window.NSWorldFinds (frozen)
     kind(node) → { name, line, text } | null     'A singing world', 'One low note comes off it.' (a story world: its own)
     known(node) → bool                            a scan has read it: its finds can show
     list(app, node, ids?) → [find]                its finds (site, kind, feature); [] while not known. ids: the two going down
                                                  (Mira aboard scans the ground: less risk). A find: { id, kind: 'site' | 'event'
                                                  | 'eden', label, icon, gives: [{ icon, text }], risk, at: [u, v] (on the world,
                                                  in its radii from the centre), done, target, hint ('note' | 'course' | 'fix'
                                                  | 'date': our wreck the disc can date | null), event?, site?, art?, inSpace?
                                                  (a site in orbit: the team crosses to it, nobody lands) }
     target(app, node) → find | null               where GO DOWN takes the team: the one chosen, else a clue, else the first not done
     blind(app, node) → find | null                where a blind trip goes before a scan (the site, else its own event)
     aim(app, node, id) → bool                     choose where the team goes (kept on the world: node.nsTarget)
     markDone(node, id)                            a trip went there (bundle.js handleEvaAction)
     keepOld(app, node)                            before a trip: an old save's one trip (its own event) stays done
     clue(app, find)                               that trip's story is over: a clue on it names the story world
     riskOf(app, node, event, ids, opts?) → n      a plain landing's hurt chance with that event (TripOdds; opts.way: the
                                                  card's index, else the careful one; opts.find: the find, for the fit)
     oddsOf(app, node, event, ids, opts?) → { hurt, death, deadly, oneIn }   the same way's odds, its death chance too
                                                  (something hunting there, Vance's cover): what its card will show
     noteLines(app, node, withSite) → ['Worth a trip: Old ruins (a clue) · The hum', 'People could live here']   travel's note
*/
(function () {
    'use strict';
    const KINDS = {
        ROCKY: ['A rocky world', 'Bare stone, rich in metal.'],
        GAS_GIANT: ['A gas giant', 'No ground to stand on.'],
        ICE_WORLD: ['An ice world', 'Frozen hard, from pole to pole.'],
        OCEANIC: ['An ocean world', 'Water everywhere, almost no land.'],
        DESERT: ['A desert world', 'The ground is too hot to touch.'],
        VOLCANIC: ['A world of volcanoes', 'The ground still moves.'],
        TOXIC: ['A poison world', 'Nobody could breathe this air.'],
        VITAL: ['A living world', 'Forests, rivers and animals.'],
        BIO_MASS: ['A world that is alive', 'One huge creature covers it.'],
        MECHA: ['A world of war machines', 'Most of them are asleep.'],
        SHATTERED: ['A broken world', 'It split apart long ago.'],
        TERRAFORMED: ['A world someone made', 'The weather never changes.'],
        CRYSTALLINE: ['A crystal world', 'Huge crystals hum in the wind.'],
        ROGUE: ['A world with no sun', 'Dark and very cold.'],
        TIDALLY_LOCKED: ['A half-lit world', 'One side burns, one side freezes.'],
        HOLLOW: ['A hollow world', 'Something is inside it.'],
        SYMBIOTE_WORLD: ['A welcoming world', 'The plants turn toward us.'],
        MIRROR: ['A mirror world', 'Our scans show our own ship.'],
        GRAVEYARD: ['A world of dead ships', 'Hundreds of them, crushed together.'],
        SINGING: ['A singing world', 'One low note comes off it.'],
        STORM_WORLD: ['A storm world', 'The wind never stops.'],
        FUNGAL: ['A fungus world', 'Spores hang in the air.'],
        TOMB_WORLD: ['A world of dead cities', 'Nobody knows what killed them.'],
        EDEN: ['A green world', 'It looks made for us.'],
        MACHINE_WORLD: ['A machine world', 'Someone built every part of it.'],
        FROZEN_OCEAN: ['A frozen ocean', 'Something swims under the ice.'],
        SULFUR: ['A sulphur world', 'Yellow lakes, and air that burns.'],
        CARBON: ['A carbon world', 'Mountains of diamond.'],
        RADIATION_BELT: ['A radiation world', 'Deadly to stand on for long.'],
        GHOST_WORLD: ['A ghost world', 'Our scanner keeps losing it.'],
        STATION: ['An empty station', 'Nobody answers our call.'],
        ASTEROID_FIELD: ['Rocks and old metal', 'Good for mining.'],
    };
    // a site: what it is, its icon, what it gives (a wreck with the sector's page, or the first one with the disc drawing: a page)
    const SITES = {
        EXODUS_WRECK: { label: 'One of our ships', icon: 'wreck', gives: ['salvage', 'rations'] },
        FAILED_COLONY: { label: 'Empty colony', icon: 'house', gives: ['data', 'salvage'] },
        DERELICT: { label: 'Wreckage in orbit', icon: 'wreck', gives: ['salvage', 'data'] },
        LIGHTHOUSE: { label: 'Old beacon', icon: 'beacon', gives: ['salvage'] },
        GARDEN: { label: 'Garden dome', icon: 'dome', gives: ['rations', 'healing'] },
        GRAVE: { label: 'Graves', icon: 'stones', gives: ['data', 'an item'] },
    };
    // a find is named by its event's own title (what the team meets, no "a" or "the": a label on the glass, as the actions'),
    // except where that title reads as a riddle for a place
    const LABELS = { TIME_DILATION: 'Crushing gravity', SYMBIOTE_EMBRACE: 'Welcoming plants', SOLAR_FLARE: 'Solar flare', MASS_BURIAL: 'Old graves',
        THE_REFLECTION: 'Strange reflection', GHOST_SHIP: 'Silent ship', DERELICT: 'Crashed ship', ROGUE_AI: 'Armed satellite', CRYOSLEEP_POD: 'Old sleep pod',
        DISTRESS_BEACON: 'Distress call', DUST_STORM: 'Dust storm', MAGNETIC_STORM: 'Magnetic storm', PERFECT_SPHERE: 'Perfect sphere', INNER_WORLD: 'Way inside',
        RADIO_SILENCE: 'Radio dead zone', FOOTPRINTS: 'Footprints in the dust' };
    const FEATURE = { ruins: { icon: 'ruins', art: 'ruins', clue: 'note' }, signal: { icon: 'wave', art: 'beacon', clue: 'course' },
        life: { icon: 'life', art: null, clue: 'fix' }, machines: { icon: 'gear', art: null, clue: 'fix' } };
    const FEATURE_ORDER = ['ruins', 'signal', 'life', 'machines'];
    const GIVE_ICON = { salvage: 'salvage', energy: 'energy', rations: 'rations', data: 'data', 'an item': 'item', 'a page': 'page', healing: 'help', rest: 'help' };
    const CLUE_LINES = {
        note: name => `A.U.R.A.: "The team found a note from one of our crews. They went on to ${name}, Commander."`,
        course: name => `A.U.R.A.: "That signal logged one of our ships heading for ${name}, Commander."`,
        fix: name => `A.U.R.A.: "The team brought back an old star fix. One of our ships is at ${name}, Commander."`,
    };
    const SITE_AT = [-0.6, 0.1], ORBIT_AT = [-1.22, 0.4], EDEN_AT = [-0.55, 0.12], MAX_GIVES = 2;
    /** Mira's ground scan from aboard (NSOrbit.whileDown sets the same): bundle.js NEW_LOOK_ECONOMY, read when used. */
    function miraScan() {
        const v = window.NEW_LOOK_ECONOMY && window.NEW_LOOK_ECONOMY.MIRA_ABOARD;
        if (typeof v === 'number') return v;
        console.error('NSWorldFinds: NEW_LOOK_ECONOMY.MIRA_ABOARD is missing; using the old -10');   // never a second copy of the table's number
        return -10;
    }

    function hashOf(s) { let h = 2166136261; s = String(s); for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }
    const unit = (s, k) => (hashOf(s + ':' + k) % 1000) / 999;
    const tagsOf = node => (node && node.tags) || [];
    const sentence = s => { const t = String(s || '').toLowerCase(); return t.charAt(0).toUpperCase() + t.slice(1); };
    const isGround = n => !!n && !n.isStation && n.type !== 'STATION' && !n.isAsteroidField && !n.ghost && !n.isStructure && n.type !== 'STRUCTURE'
        && !n._isWrongPlace && n.type !== 'WRONG_PLACE';
    const known = node => isGround(node) && !!(node.scanned || node.remoteScanned);
    const eventById = id => (typeof EVENTS !== 'undefined' ? EVENTS.find(e => e.id === id) : null) || null;

    /** The kind of world in plain words: its type's line; the story world keeps its own (its map line's first sentence). */
    function kind(node) {
        if (!node) return null;
        if (node.isStoryPlanet && node.desc) {
            const first = (String(node.desc).match(/^[^.!?]+[.!?]/) || [node.desc])[0].trim();
            return { name: first.replace(/[.!?]$/, ''), line: '', text: first };
        }
        const type = node.isStation ? 'STATION' : node.isAsteroidField ? 'ASTEROID_FIELD' : node.type;
        const k = KINDS[type];
        return k ? { name: k[0], line: k[1], text: `${k[0]}. ${k[1]}` } : null;
    }

    // ── what each find gives ──
    const chip = text => ({ icon: GIVE_ICON[text] || 'gives', text });
    function eventGives(ev) {
        const out = [];
        (ev.choices || []).forEach(c => {
            const r = c.reward || {};
            const t = r.type === 'ITEM' ? 'an item' : r.type === 'DATA' ? 'data'
                : r.type === 'RESOURCE' && r.val && r.val !== 'NOTHING' ? (String(r.val).includes('METALS') ? 'salvage' : 'energy') : null;   // resolveEvaOutcome's own rule
            if (t && !out.includes(t)) out.push(t);
        });
        return out.sort((a, b) => (a === 'an item') - (b === 'an item')).slice(0, MAX_GIVES).map(chip);   // supplies first
    }
    /** Mira scans the ground from aboard while she is well and not one of the two going down (NSOrbit.whileDown's rule). */
    function miraAboard(app, ids) {
        const s = app && app.state, m = s && (s.crew || []).find(c => (c.tags || []).includes('SPECIALIST'));
        if (!m || m.status !== 'HEALTHY' || (m.tags || []).includes('CONFINED') || (m.tags || []).includes('SEDATED')) return false;
        return !(ids || []).includes('mira');
    }
    const ROLE_OF = { jaxon: 'ENGINEER', aris: 'MEDIC', vance: 'SECURITY', mira: 'SPECIALIST' };
    /** The crew members ids name. */
    function teamOf(app, ids) {
        const crew = (app && app.state && app.state.crew) || [];
        return (ids || []).map(id => crew.find(c => (c.tags || []).includes(ROLE_OF[id]))).filter(Boolean);
    }
    /** A plain landing's odds going in (before the landing), as the card will show them for that way: App.tripRisk, the way's
        own risk (opts.way: its index on the card; left out, the careful choice's), the team's fit for the find (NSOrbit.fitOf;
        opts.find, else the world's own event), anyone hurt going down (fewer than two were well: NSOrbit.pool), something
        hunting there (App.isHunted) and Vance's cover (App.vanceCovers), through TripOdds: { hurt, death, deadly, oneIn }. */
    function eventOdds(app, node, ev, ids, opts) {
        if (!app || typeof app.tripRisk !== 'function' || !ev) return null;
        const o = opts || {}, base = app.tripRisk(node, { mira: miraAboard(app, ids) ? miraScan() : 0 }).risk;
        const mods = (ev.choices || []).map(c => Number(c.riskMod) || 0), least = mods.length ? Math.min(...mods) : 0;
        const wayMod = o.way != null && mods[o.way] != null ? mods[o.way] : least;
        const T = window.TripOdds, O = window.NSOrbit;
        if (!T) return { hurt: Math.max(0, Math.min(100, Math.round(base + wayMod))), death: 0, deadly: false, oneIn: null };
        const find = o.find || { id: 'kind', kind: 'event', feature: null, event: ev.id };
        let fit = 0;
        try { fit = O && typeof O.fitOf === 'function' ? O.fitOf(app, node, ids, find) : 0; } catch (err) { console.error('NSWorldFinds: the fit failed', err); }
        const team = teamOf(app, ids);
        const hunted = typeof app.isHunted === 'function' ? app.isHunted(node) : tagsOf(node).includes('PREDATORY');
        const vance = typeof app.vanceCovers === 'function' ? app.vanceCovers(team) : false;
        return T.odds({ base, wayMod, fit, hunted, vance, hurtGoes: team.some(c => c.status === 'INJURED') });
    }
    /** The hurt chance of eventOdds: a find's "risk N%". */
    function eventRisk(app, node, ev, ids, opts) { const o = eventOdds(app, node, ev, ids, opts); return o ? o.hurt : null; }

    // ── where each find sits on the world (its own seeded spot, on the side facing the open sky) ──
    function spot(node, id, site) {
        if (id === 'site') return site && site.inSpace ? ORBIT_AT.slice() : SITE_AT.slice();   // the landing site, where our wreck's beacon blinks
        if (id === 'eden') return EDEN_AT.slice();
        const a = unit(node.id, id + 'u'), b = unit(node.id, id + 'v');
        let p = id === 'kind' ? [-0.42 - 0.3 * a, -0.28 - 0.3 * b] : [-0.3 - 0.35 * a, 0.36 + 0.24 * b];
        const d = Math.hypot(p[0], p[1]);
        if (d > 0.8) p = p.map(v => v * 0.8 / d);                                                // kept on the face, off the limb
        return p.map(v => Math.round(v * 100) / 100);
    }

    // ── the clue: one side world per sector (2 to 6) while the story world is a faint contact ──
    function clueWorld(state) {
        if (!state || (state.currentSector || 1) < 2) return null;
        const nodes = state.sectorNodes || [];
        if (!nodes.some(p => p.storyHidden)) return null;
        const side = nodes.filter(p => isGround(p) && p.type !== 'GAS_GIANT' && !p.isStoryPlanet && !p.isEden && !p.isFirstSignal && !tagsOf(p).includes('EXODUS_WRECK'));
        if (!side.length) return null;
        return side.reduce((a, b) => (hashOf(a.id + ':clue') <= hashOf(b.id + ':clue') ? a : b));
    }

    function siteFind(app, node) {
        const site = app && typeof app.siteOf === 'function' ? app.siteOf(node) : null;
        if (!site || site.tag === 'ANOMALY' || !SITES[site.tag]) return null;
        const d = SITES[site.tag], ours = site.tag === 'EXODUS_WRECK';
        let gives = d.gives.slice();
        if (ours && (node.hasPage || node.isFirstSignal)) gives = ['a page', 'salvage'];
        const s = app.state, hasDisc = !!(s && (s.hasDisc || (typeof ITEMS !== 'undefined' && ITEMS.DISC_DRAWING && (s.cargo || []).some(i => i.id === ITEMS.DISC_DRAWING.id))));
        const toDate = ours && !node.hasPage && !node.isFirstSignal && hasDisc && (s.sectorNodes || []).some(p => p.storyHidden);   // the disc dates it: where its crew went
        return { id: 'site', kind: 'site', site: site.tag, label: d.label, icon: d.icon, gives: gives.map(chip), risk: 0, at: spot(node, 'site', site),
            done: !!node[site.done], hint: toDate ? 'date' : null, inSpace: !!site.inSpace, relay: !!site.relay };   // inSpace: in orbit, the lander crosses to it (GO DOWN says "Go across"); relay (LAST PORT): the whole ship docks there (Stop.js: no shuttle)
    }
    function featureOf(node, own) {
        const tags = tagsOf(node), m = node.metrics || {};
        const has = { ruins: tags.includes('ANCIENT_RUINS'), signal: tags.includes('ALIEN_SIGNALS'), life: !!m.hasLife && node.type !== 'EDEN', machines: !!m.hasTech };
        const table = typeof FEATURE_EVENTS !== 'undefined' ? FEATURE_EVENTS : {};
        for (const key of FEATURE_ORDER) {
            if (!has[key]) continue;
            const ev = (table[key] || []).map(eventById).find(e => e && (!own || e.id !== own.id));
            if (ev) return { key, event: ev };
        }
        return null;
    }
    function eventFind(app, node, id, ev, ids, feature) {
        const f = feature ? FEATURE[feature] : null;
        return { id, kind: 'event', event: ev.id, label: LABELS[ev.id] || sentence(ev.title), icon: f ? f.icon : 'pin', art: f ? f.art : null, gives: eventGives(ev),
            risk: eventRisk(app, node, ev, ids, { find: { id, kind: 'event', event: ev.id, feature: feature || null } }), at: spot(node, id), done: false, hint: null, feature: feature || null };
    }

    /** Every find on a known world, in order, with what is done and which is the target. unread: the same before a scan (the
        blind trip's own find, blind()). */
    function list(app, node, ids, unread) {
        if (!app || !(unread ? isGround(node) : known(node))) return [];
        const out = [], site = siteFind(app, node);
        const legacy = !!node.hasEva && node.nsTrips == null && !site;                    // a trip from a save made before finds: it played the world's own event
        const done = (node.nsDone || []).concat(legacy ? ['kind'] : []);
        if (site) out.push(site);
        if (node.type === 'EDEN' || node.isEden) {
            out.push({ id: 'kind', kind: 'eden', label: 'Green valley', icon: 'life', gives: ['rations', 'rest'].map(chip), risk: 0, at: spot(node, 'eden'), done: false, hint: null });
        } else if (node.type !== 'GAS_GIANT') {                                            // a gas giant has no ground: only a site in orbit
            const own = typeof app.landingEventOf === 'function' ? app.landingEventOf(node) : null;
            if (own) out.push(eventFind(app, node, 'kind', own, ids));
            const feat = featureOf(node, own);
            if (feat) out.push(eventFind(app, node, 'feature', feat.event, ids, feat.key));
        }
        out.forEach(f => { if (done.includes(f.id)) f.done = true; });
        const clue = clueWorld(app.state) === node ? (out.find(f => f.id === 'feature') || out.find(f => f.id === 'kind')) : null;
        if (clue && !clue.done) clue.hint = clue.feature ? FEATURE[clue.feature].clue : 'fix';
        const open = out.filter(f => !f.done), aimed = open.find(f => f.id === node.nsTarget) || open.find(f => f.hint) || open[0] || null;   // a clue first: its chips say so
        out.forEach(f => { f.target = f === aimed; });
        return out;
    }
    function target(app, node) { return list(app, node).find(f => f.target) || null; }
    /** Where a blind trip goes (no scan yet: bundle.js handleEvaAction): the site, else the world's own event. Its clue counts. */
    function blind(app, node) {
        const all = list(app, node, null, true);
        return all.find(f => f.id === 'site' && !f.done) || all.find(f => f.id === 'kind' && !f.done) || null;
    }
    function aim(app, node, id) {
        const f = list(app, node).find(x => x.id === id && !x.done);
        if (!f) return false;
        node.nsTarget = id;
        return true;
    }
    function markDone(node, id) {
        if (!node || !id) return;
        const done = node.nsDone || [];
        if (!done.includes(id)) node.nsDone = done.concat(id);
        if (node.nsTarget === id) delete node.nsTarget;
    }
    /** A world from a save made before finds (a trip, no count of trips) with no site: that trip played its own event. Kept
        done for good before this build counts a trip there (bundle.js handleEvaAction), so it never plays twice. */
    function keepOld(app, node) {
        if (!node || !node.hasEva || node.nsTrips != null || siteFind(app, node)) return;
        markDone(node, 'kind');
    }
    /** The trip to a find with a clue has ended: the story world gets its name (App.revealStoryPlanet), and A.U.R.A. says how,
        kept on screen (no later line cuts it); travel does not name it again (node.nsSaid, Travel.js). */
    function clue(app, find) {
        const kindOf = find && find.hint;
        if (!app || !app.state || !CLUE_LINES[kindOf]) return false;
        const story = (app.state.sectorNodes || []).find(p => p.storyHidden);
        if (!story || typeof app.revealStoryPlanet !== 'function') return false;
        const line = CLUE_LINES[kindOf](story.name), ns = window.NewScreen, v = ns && ns.mods && ns.mods.voice;
        if (v && typeof v.say === 'function') {
            try { v.say({ id: 'aura', who: 'A.U.R.A.', text: line.replace(/^A\.U\.R\.A\.:\s*"?|"$/g, ''), keep: true }); } catch (err) { console.error('NSWorldFinds: the clue line failed', err); }
        }
        app.revealStoryPlanet(story, line);                                                 // the log keeps it (the voice skips the line it is saying)
        story.nsSaid = true;
        if (typeof app.autoSave === 'function') app.autoSave();
        return true;
    }
    /** Travel's note once a scan has read the world: the finds still open (a clue named), and whether people could live there. */
    function noteLines(app, node, withSite) {
        const finds = list(app, node).filter(f => !f.done && (withSite !== false || f.id !== 'site'));
        const said = finds.length ? 'Worth a trip: ' + finds.map(f => (f.hint ? `${f.label} (a clue)` : f.label)).join(' · ') : '';
        let live = null;
        try { const fx = window.NSScan ? window.NSScan.facts(app, node) : null; live = fx && fx.live ? sentence(fx.live) : null; } catch (err) { live = null; }
        return [said, live].filter(Boolean);
    }

    window.NSWorldFinds = Object.freeze({ kind, known, list, target, blind, aim, markDone, keepOld, clue, noteLines, riskOf: eventRisk, oddsOf: eventOdds, KINDS });
})();
