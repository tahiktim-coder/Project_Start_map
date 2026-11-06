/* ═══ Silent Exodus · new screen (?new=1) · tower/Supper.js: supper after a jump, at the galley table ═══════════════════
   What it is: the crew eat after every sector jump (docs/SHIP_LIFE.md "2. Supper at the jump"), in the living ship: no new
   screen, no card, no meter. The jump leaves state._nsSupper (bundle.js startSectorJump); in the next sector's travel view,
   once the tower is in, everyone is at the galley table (Tower.js holds the crew's day at its meal while the supper is due;
   the dead are not drawn, the sick lie in bed). Enough food: they eat a moment, the rations over the table count down, and
   the day goes on. Fewer rations than people eating: one person goes without for each ration short, two at most
   (GameState.supperWithout). A.U.R.A. says so in one line, the first who can offers in one line (Vance, then Jaxon, Aris,
   Mira; never someone whose next missed supper would be their last), and the commander's one reply waits on a glass key
   plate docked at the galley deck's hull edge (tower/ShipKey.js; look pass B04, C42, C84): "All right, Vance" with the chip
   "Vance goes without". Pointing at someone else shows them in the same plate (their name in the who style, "goes
   without"), and a click on them picks them. Two to go without: after the first pick A.U.R.A. asks for one more.
   The table moment: someone who already went without twice was picked. It is the frame's Ask (cards/Frame.js through
   EncounterCard; the picture the galley table): Aris says at the table that it would kill them (A.U.R.A. when Aris cannot),
   then "Not yet" first and focused (back to picking), "Share it out" too when nobody else can go without, and "Go without",
   held, its chip naming who dies in --loss. A click on the crew while it waits shows it again. A death chosen there has its
   beat in the ship: the galley light goes down two steps, the chair stays empty, A.U.R.A. says it, then one person names
   them (L-20); the light comes back. Whoever went without is said in travel (A.U.R.A., L-21). With nobody left to offer,
   "Share it out" waits on the plate instead; with too few left who could go without at all, nobody is asked
   (GameState.serveSupper would share the food out anyway). Setting a course first keeps the offer (settle): whoever offers
   goes without, or the food is shared out; a death is only ever the one chosen at the table.
   The rules are GameState.serveSupper's (bundle.js; the numbers NEW_LOOK_ECONOMY's HUNGER_*): the first missed supper
   leaves them too weak for the next team trip (the tower seats them, the bridge stands them aside), the second sick in bed
   until they eat, the third kills them; a shared-out supper costs everyone +1 stress and their rest. Plain speech
   (docs/STYLE.md), never a count of people, no rule words. Lines marked DRAFT wait for the designer.
   Loaded only with the new-screen switch, after tower/ShipKey.js and before tower/Tower.js, which drives it every frame.

   window.NSSupper (frozen)
     pending() → bool         a supper is due: the jump is made and nobody has eaten yet (the tower keeps them at the table)
     busy() → bool            pending, or the choice is open (NSOrbit holds crew moments meanwhile)
     tick(dt, open, seen)     the tower's frame; open: the table in view (travel, slid in, not dark, nothing over it, the crew
                              seated); seen: the tower in view (a death's beat plays after the supper is over)
     choosing() → bool        the choice is open: a click on a person picks them (not while the table moment waits)
     atTable() → bool         the table moment waits (its frame is up, or will be again)
     point(id | null) → bool  pointing at someone while choosing: the plate shows them; true when they can be picked
     pick(id) → bool          id goes without (never Cora; anyone else alive); at their last: the table moment opens
     reshow()                 the table moment's frame again (a click on the crew while it waits)
     settle()                 serve it now, nobody asked (a course set, or another jump, before anyone chose): the offer stands
     tagFor(id) → { verb, note } | null   what pointing at someone shows while choosing
     dim() → 0 | 1 | 2        how many steps the galley's light is down (a death's beat; Tower.js draws it)
     debug() → { phase, offerer, need, rations, pending, picks, confirmed, table, chips, frame, beat }
   Bus: emits 'supper:served' { short, without: [ids], share, died: [ids] }.
*/
(function () {
    'use strict';
    const NS = window.NewScreen;
    if (!window.NEW_SCREEN || !NS || !NS.on) return;

    const CREW_BY_TAG = { LEADER: 'cora', ENGINEER: 'jaxon', MEDIC: 'aris', SECURITY: 'vance', SPECIALIST: 'mira' };
    const OFFER_ORDER = ['vance', 'jaxon', 'aris', 'mira'];                  // Vance offers first; if he cannot, the next one does
    const NAMERS = ['aris', 'jaxon', 'mira', 'vance'];                       // who names the dead at the table: Aris, else the next who can
    const SEATED_MS = 1200;                                                  // the table in view a moment before anyone speaks
    const QUIET_MAX_MS = 7000;                                               // a line on screen (a new sector's news) finishes first, up to this long
    const OFFER_GAP_MS = 350;                                                // after A.U.R.A.'s line, the offer
    const BEAT = { step: 250, say: 700, gap: 300, back: 250 };               // the death's beat: the light down in two steps, then the words
    const LINES = {                                                          // one plain idea each (docs/STYLE.md)
        aura: ['Not enough for everyone tonight, Commander.', 'Not enough for everyone again, Commander.'],
        more: 'One more, Commander.',                                        // DRAFT: two go without, after the first pick
        offer: {                                                             // [never went without, went without before]
            vance: ["I'll skip it.", "I'll skip it again. I'm fine."],
            jaxon: ["I'll go without tonight.", "I'll go without again. I'm fine."],
            aris: ['Give mine to someone else.', 'Give mine away again. I can manage.'],
            mira: ["I'm not hungry. Really.", "I'm still not hungry. Really."],
        },
        // the table moment (DRAFT): Aris says it; about herself; A.U.R.A. when Aris is dead, asleep or shut down
        warn: (name, him) => `${name} can't go without again. It would kill ${him}.`,
        warnSelf: "I can't go without again, Commander. It would kill me.",
        warnAura: (name, him) => `${name} can't go without again, Commander. It would kill ${him}.`,
        went: names => `${names} went without tonight, Commander.`,          // DRAFT (look pass): L-21, A.U.R.A.
        dead: name => `${name} is dead, Commander.`,                         // DRAFT (look pass): L-20, A.U.R.A.
        named: (He, his) => `${He} gave ${his} share away. Every night.`,    // DRAFT (look pass): L-20, Aris (or the next who can)
    };
    const KEYS = {                                                           // the plate's one key: the commander's reply (C42)
        accept: name => ({ act: 'accept', label: `All right, ${name}`, chips: [{ text: `${name} goes without`, word: true }] }),   // DRAFT (look pass): L-22
        share: () => ({ act: 'share', label: 'Share it out', chips: [{ text: 'everyone goes hungry', word: true }] }),              // DRAFT
    };
    const TABLE = { notYet: 'Not yet', share: 'Share it out', go: 'Go without', dies: name => `${name} dies` };   // DRAFT: the table moment's keys
    const TAG_LAST = 'went without twice';                                   // DRAFT (look pass): pointing at someone at their last
    const S = { phase: null, at: 0, offerer: null, offered: false, plate: null, pointing: null, shorts: 0, hooked: false, picks: [], confirmed: [], table: null, frame: false, beat: null, seq: 0 };
    const app = () => NS.app || window.app || null;
    const state = () => { const a = app(); return (a && a.state) || null; };
    const tags = c => (c && c.tags) || [];
    const idOf = c => CREW_BY_TAG[Object.keys(CREW_BY_TAG).find(t => tags(c).includes(t))] || String((c && c.name) || '').toLowerCase();
    const member = id => { const s = state(); return ((s && s.crew) || []).find(c => idOf(c) === id) || null; };
    const voice = () => (NS.mods && NS.mods.voice) || null;
    const say = (id, who, text) => { const v = voice(); if (!v || typeof v.say !== 'function') return Promise.resolve(false); try { return v.say({ id, who, text, keep: true }); } catch (err) { console.error('NSSupper: the voice failed', err); return Promise.resolve(false); } };
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const awake = c => !!c && c.status !== 'DEAD' && !tags(c).includes('SEDATED') && c.trait !== 'CATATONIC';

    const pending = () => { const s = state(); return !!(s && s._nsSupper && !s.gameOver); };
    const short = () => { const s = state(); return !!s && typeof s.supperNeed === 'function' && s.rations < s.supperNeed(); };
    const need = () => { const s = state(); return s && typeof s.supperWithout === 'function' ? s.supperWithout() : 1; };
    const canGoWithout = c => !!c && c.status !== 'DEAD' && !tags(c).includes('LEADER');
    /** Going without again would kill them (GameState.mayGoWithout: NEW_LOOK_ECONOMY.HUNGER_DEATH_AT). */
    const isLast = c => { const s = state(); return !!s && canGoWithout(c) && typeof s.mayGoWithout === 'function' && !s.mayGoWithout(c, false); };
    /** May go without with no table moment: alive, not Cora, not picked tonight, not at their last. */
    const free = c => canGoWithout(c) && !S.picks.includes(idOf(c)) && !isLast(c);
    /** Who offers: the first in OFFER_ORDER who may go without and is not shut away, asleep or shut down (CATATONIC). */
    function offererNow() {
        const ok = c => free(c) && !tags(c).includes('CONFINED') && !tags(c).includes('SEDATED') && c.trait !== 'CATATONIC';
        return OFFER_ORDER.find(id => ok(member(id))) || null;
    }
    /** Anyone besides id who could still go without tonight (the table moment's "Not yet" needs one). */
    const othersCan = id => (((state() || {}).crew) || []).some(c => free(c) && idOf(c) !== id);
    /** Too few left who could go without at all (even at the table) for the ones still needed: GameState.serveSupper shares
        the food out whatever is picked, so nobody is asked and "Share it out" waits alone. */
    const tooFew = () => (((state() || {}).crew) || []).filter(c => canGoWithout(c) && !S.picks.includes(idOf(c))).length < need() - S.picks.length;

    function reset() {
        hidePlate();
        S.phase = null; S.offered = false; S.offerer = null; S.picks = []; S.confirmed = []; S.table = null; S.frame = false; S.pointing = null; S.seq += 1;   // the next supper asks again
    }
    /** Supper is served: GameState.serveSupper's rules (the picks, or the food shared out), the save, the scene ends; then who
        went without is said (L-21), or a death has its beat (L-20). */
    function serve(share) {
        const s = state(), a = app();
        if (!s || typeof s.serveSupper !== 'function') { reset(); return; }
        const wasShort = short(), picks = share ? [] : S.picks.map(member).filter(Boolean), confirmed = S.confirmed.map(member).filter(Boolean);
        let r = null;
        try { r = s.serveSupper(picks, { share: !!share, confirmed }); } catch (err) { console.error('NSSupper: serving failed', err); }
        reset();
        if (wasShort) S.shorts += 1;
        if (a && typeof a.autoSave === 'function') { try { a.autoSave(); } catch (err) { console.error('NSSupper: the save failed', err); } }
        const ids = list => ((r && r[list]) || []).map(idOf);
        NS.bus.emit('supper:served', { short: wasShort, without: ids('without'), share: !!(r && r.share), died: ids('died') });
        const died = (r && r.died) || [], lived = ((r && r.without) || []).filter(c => !died.includes(c));
        if (died.length) S.beat = { dead: died[0], at: null, said: false, endAt: null };
        else if (lived.length) say('aura', 'A.U.R.A.', LINES.went(lived.map(c => c.name).join(' and ')));
    }

    function tick(dt, open, seen) {
        hook();
        stepBeat(seen == null ? open : seen);
        if (!pending()) { if (S.phase) reset(); return; }
        if (S.plate) S.plate.show(!!open && choosing() && S.offered);          // never over a card, never clicked unseen
        if (!open) return;
        const now = performance.now(), v = voice(), talking = !!(v && typeof v.current === 'function' && v.current());
        if (!S.phase) { S.phase = 'seated'; S.at = now; return; }
        if (S.phase === 'seated' && now - S.at >= SEATED_MS) {
            if (!short()) { serve(false); return; }                              // enough for everyone: they eat, no choice
            if (talking && now - S.at < QUIET_MAX_MS) return;                    // a line on screen finishes first
            S.phase = 'choosing';
            offer(LINES.aura[Math.min(S.shorts, 1)]);
        }
        if (S.phase === 'table' && !S.frame) openFrame();                       // back after the view was away: the moment still waits
        if (choosing() && S.offered) showPlate();
    }
    /** A.U.R.A.'s line, then whoever offers says so, and the reply waits on the plate ("Share it out" with nobody to offer). */
    function offer(line) {
        const seq = ++S.seq;
        hidePlate();
        S.offered = false; S.offerer = tooFew() ? null : offererNow();
        say('aura', 'A.U.R.A.', line).then(() => wait(OFFER_GAP_MS)).then(() => {
            if (seq !== S.seq || S.phase !== 'choosing') return;
            const m = S.offerer && member(S.offerer);
            if (m) say(S.offerer, m.name, LINES.offer[S.offerer][(m._wentWithout || 0) > 0 ? 1 : 0]);
            S.offered = true;
            showPlate();
        });
    }
    /** Supper now, nobody asked: a course set (or another jump) before anyone chose. The offer stands: whoever offers goes
        without (the next one too, when two must); with too few to offer, the food is shared out. Only a death already chosen
        at the table happens. */
    function settle() {
        if (!pending()) return;
        if (!short()) { serve(false); return; }
        const want = need();
        for (let id = offererNow(); id && S.picks.length < want; id = offererNow()) S.picks.push(id);
        serve(S.picks.length < want);
    }
    function hook() {
        if (S.hooked) return;
        S.hooked = true;
        NS.bus.on('flow:go', settle);
        NS.bus.on('hidden', hidePlate);
    }

    const choosing = () => S.phase === 'choosing' && pending();
    const atTable = () => S.phase === 'table' && !!S.table && pending();
    function pick(id) {
        if (!choosing() || tooFew()) return false;
        const m = member(id);
        if (!canGoWithout(m) || S.picks.includes(id)) return false;
        if (isLast(m)) { openTable(id); return true; }
        S.picks.push(id);
        next();
        return true;
    }
    /** After a pick: served once enough go without; else A.U.R.A. asks for one more. */
    function next() {
        S.table = null;
        if (S.picks.length >= need()) { serve(false); return; }
        S.phase = 'choosing';
        offer(LINES.more);
    }
    function tagFor(id) {
        if (!choosing() || tooFew()) return null;
        const m = member(id);
        if (!canGoWithout(m) || S.picks.includes(id)) return null;
        return { verb: m.name, note: isLast(m) ? TAG_LAST : 'goes without' };
    }

    // ── the plate: the commander's one reply, docked at the galley deck's hull edge (tower/ShipKey.js) ──
    function offerRows() {
        const m = S.offerer && member(S.offerer);
        return [m && free(m) ? KEYS.accept(m.name) : KEYS.share()];
    }
    function rows() {
        const tag = S.pointing ? tagFor(S.pointing) : null;
        return tag ? [{ who: { id: S.pointing, name: tag.verb }, chips: [{ text: tag.note, word: true }] }] : offerRows();
    }
    function showPlate() {
        const K = window.NSShipKey;
        if (!K) return;
        if (!S.plate) S.plate = K.plate({ cls: 'nss-supper', aria: 'Supper', onPick: row => act(row.act), onClose: () => point(null) });
        S.plate.set({ rows: rows(), keys: !S.pointing });
        if (S.plate.dock('quarters')) S.plate.show(true); else S.plate.show(false);
    }
    function hidePlate() { if (S.plate) S.plate.show(false); }
    /** Pointing at someone while choosing: the plate shows them, the name in the who style (no second line anywhere). */
    function point(id) {
        const want = id && tagFor(id) ? id : null;
        if (want === S.pointing) return !!want;
        S.pointing = want;
        if (S.plate && choosing() && S.offered) showPlate();
        return !!want;
    }

    // ── the table moment: someone at their last was picked; the frame's Ask (DESIGN 1.1) ──
    function openTable(id) {
        S.seq += 1;                                                              // an offer still on its way stays unsaid
        hidePlate(); S.pointing = null;
        S.phase = 'table'; S.table = { id }; S.frame = false;
        const v = voice();
        if (v && typeof v.hush === 'function') { try { v.hush(); } catch (err) { console.error('NSSupper: hushing the voice failed', err); } }   // the warning is said in the frame, never behind an offer
        openFrame();
    }
    function openFrame() {
        const EC = window.EncounterCard, a = app(), m = S.table && member(S.table.id);
        if (!EC || !a || !m || S.frame) return;
        const w = warning(m), choices = [{ text: TABLE.notYet, desc: '', primary: true, act: 'notYet' }]
            .concat(othersCan(S.table.id) ? [] : [{ text: TABLE.share, desc: '', act: 'share', chips: [{ text: 'everyone goes hungry', tone: 'ui', word: true }] }],
                [{ text: TABLE.go, desc: '', act: 'go', tone: 'loss', chips: [{ text: TABLE.dies(m.name), tone: 'loss', word: true }] }]);
        S.frame = true;
        try {
            EC.open(a, {
                kicker: 'The table', title: 'Supper', zIndex: 2000, noContext: true,
                dialogue: [{ speaker: w.who, text: w.text }],
                shape: 'ask', final: [choices.length - 1], deck: 'quarters', picture: { kind: 'deck', deck: 'galley', table: true },
                choices,
                onPick: idx => { if (EC.noOutcome) EC.noOutcome(); S.frame = false; act(choices[idx] ? choices[idx].act : 'notYet'); },
            });
        } catch (err) { console.error('NSSupper: the table moment could not open', err); S.frame = false; }
    }
    /** Who says it at the table: Aris (about herself too), else A.U.R.A. Dead people do not speak (docs/STYLE.md), nor does
        Aris asleep or shut down (CATATONIC). */
    function warning(m) {
        const aris = member('aris'), him = m.gender === 'F' ? 'her' : 'him';
        if (awake(aris)) return { id: 'aris', who: aris.name, text: aris === m ? LINES.warnSelf : LINES.warn(m.name, him) };
        return { id: 'aura', who: 'A.U.R.A.', text: LINES.warnAura(m.name, him) };
    }
    function act(what) {
        if (!pending()) return;
        if (what === 'accept') { if (S.offerer) pick(S.offerer); return; }
        if (what === 'share') { serve(true); return; }
        if (S.phase !== 'table' || !S.table) return;
        const id = S.table.id;
        if (what === 'notYet') { S.table = null; S.phase = 'choosing'; S.offered = true; return; }   // the plate shows again on the next frame
        if (what === 'go') { S.picks.push(id); S.confirmed.push(id); next(); }
    }
    function reshow() { if (atTable() && !S.frame) openFrame(); }

    // ── a death at the table: its beat in the ship (L-20) ──
    function stepBeat(open) {
        const B = S.beat;
        if (!B || !open) return;
        const now = performance.now();
        if (B.at == null) B.at = now;
        if (!B.said && now - B.at >= BEAT.say) {
            B.said = true;
            const c = B.dead, He = c.gender === 'F' ? 'She' : 'He', his = c.gender === 'F' ? 'her' : 'his';
            const namer = NAMERS.map(member).find(m => m && m !== c && awake(m));
            say('aura', 'A.U.R.A.', LINES.dead(c.name)).then(() => wait(BEAT.gap))
                .then(() => (namer ? say(idOf(namer), namer.name, LINES.named(He, his)) : true))
                .then(() => { if (S.beat === B) B.endAt = performance.now(); });
        }
        if (B.endAt != null && now - B.endAt >= BEAT.back * 2) S.beat = null;
    }
    function dim() {
        const B = S.beat;
        if (!B || B.at == null) return 0;
        const now = performance.now();
        if (B.endAt != null) return now - B.endAt < BEAT.back ? 1 : 0;              // the light back up, a step at a time
        return now - B.at < BEAT.step ? 1 : 2;
    }

    hook();
    window.NSSupper = Object.freeze({
        pending, tick, choosing, atTable, pick, point, reshow, tagFor, settle, dim,
        busy: () => pending() || choosing(),
        debug: () => {
            const s = state(), P = S.plate;
            return { phase: S.phase, offerer: S.offerer, chip: !!(P && P.rect()), need: s && s.supperWithout ? s.supperWithout() : null, rations: s ? s.rations : null, pending: pending(),
                picks: S.picks.slice(), confirmed: S.confirmed.slice(), table: S.table ? S.table.id : null, frame: S.frame, beat: S.beat ? { dead: S.beat.dead.name, dim: dim() } : null,
                pointing: S.pointing, chips: P && P.rect() ? [...P.el.querySelectorAll('[data-act]')].map(b => b.dataset.act).filter(Boolean) : [] };
        },
    });
})();
