/* ═══ Silent Exodus · new screen (?new=1) · tower/Supper.js: supper after a jump, at the galley table ═══════════════════
   What it is: the crew eat after every sector jump (docs/SHIP_LIFE.md "2. Supper at the jump"), in the living ship: no new
   screen, no card, no meter. The jump leaves state._nsSupper (bundle.js startSectorJump); in the next sector's travel view,
   once the tower is in, everyone is at the galley table (Tower.js holds the crew's day at its meal while the supper is due;
   the dead are not drawn, the sick lie in bed). Enough food: they eat a moment, the rations over the table count down, and
   the day goes on. Fewer rations than people eating: one person goes without for each ration short, two at most
   (GameState.supperWithout). A.U.R.A. says so in one line, the first who can offers in one line (Vance, then Jaxon, Aris,
   Mira; never someone whose next missed supper would be their last), and the player clicks who goes without, or "Accept"
   beside the tower. Two to go without: after the first pick A.U.R.A. asks for one more, and the next one offers.
   The table moment: a click on someone who already went without twice (pointing says so) has Aris say at the table that
   it would kill them (A.U.R.A. when Aris cannot), and the choice waits beside the tower: "Not yet" first (back to picking),
   or "Share it out" when nobody else can go without; then "Go without", its note naming who dies (the cost stays on the
   button, as a trip's "death 1 in N"; a click on the crew meanwhile does nothing). With nobody left to offer, "Share it
   out" waits beside the tower instead of "Accept"; with too few left who could go without at all, nobody is asked and it
   waits alone (GameState.serveSupper would share the food out anyway). Setting a course first keeps the offer (settle): whoever
   offers goes without, or the food is shared out; a death is only ever the one chosen at the table.
   The rules are GameState.serveSupper's (bundle.js; the numbers NEW_LOOK_ECONOMY's HUNGER_*): the first missed supper
   leaves them too weak for the next team trip (the tower seats them, the bridge stands them aside), the second sick in bed
   until they eat, the third kills them; a shared-out supper costs everyone +1 stress and their rest. Plain speech
   (docs/STYLE.md), never a count of people, no rule words. Lines marked DRAFT wait for the designer.
   Loaded only with the new-screen switch, after NewScreen.js and before tower/Tower.js, which drives it every frame.

   window.NSSupper (frozen)
     pending() → bool         a supper is due: the jump is made and nobody has eaten yet (the tower keeps them at the table)
     busy() → bool            pending, or the choice is open (NSOrbit holds crew moments meanwhile)
     tick(dt, open)           the tower's frame; open: the tower in view (travel, slid in, not dark, nothing over it)
     choosing() → bool        the choice is open: a click on a person picks them (not while the table moment waits)
     atTable() → bool         the table moment waits ("Not yet"/"Share it out", "Go without"): Tower.js ignores clicks on people
     pick(id) → bool          id goes without (never Cora; anyone else alive); at their last: the table moment opens
     settle()                 serve it now, nobody asked (a course set, or another jump, before anyone chose): the offer stands
     tagFor(id) → { verb, note } | null   what pointing at someone says while choosing
     debug() → { phase, offerer, need, rations, pending, picks, confirmed, table, chips }
   Bus: emits 'supper:served' { short, without: [ids], share, died: [ids] }.
*/
(function () {
    'use strict';
    const NS = window.NewScreen;
    if (!window.NEW_SCREEN || !NS || !NS.on) return;

    const CREW_BY_TAG = { LEADER: 'cora', ENGINEER: 'jaxon', MEDIC: 'aris', SECURITY: 'vance', SPECIALIST: 'mira' };
    const OFFER_ORDER = ['vance', 'jaxon', 'aris', 'mira'];                  // Vance offers first; if he cannot, the next one does
    const SEATED_MS = 1200;                                                  // the table in view a moment before anyone speaks
    const QUIET_MAX_MS = 7000;                                               // a line on screen (a new sector's news) finishes first, up to this long
    const OFFER_GAP_MS = 350;                                                // after A.U.R.A.'s line, the offer
    const DEAF_MS = 400;                                                     // a new chip ignores clicks this long: a click meant for the ship never lands on it
    const LINES = {                                                          // one plain idea each (docs/STYLE.md)
        aura: ['Not enough for everyone tonight, Commander.', 'Not enough for everyone again, Commander.'],
        more: 'One more, Commander.',                                        // DRAFT: two go without, after the first pick
        offer: {                                                             // [never went without, went without before]
            vance: ["I'll skip it.", "I'll skip it again. I'm fine."],
            jaxon: ["I'll go without tonight.", "I'll go without again. I'm fine."],
            aris: ['Give mine to someone else.', 'Give mine away again. I can manage.'],
            mira: ["I'm not hungry. Really.", "I'm still not hungry. Really."],
        },
        // the table moment (DRAFT): Aris says it; about herself; A.U.R.A. when Aris is dead or asleep
        warn: (name, him) => `${name} can't go without again. It would kill ${him}.`,
        warnSelf: "I can't go without again, Commander. It would kill me.",
        warnAura: (name, him) => `${name} can't go without again, Commander. It would kill ${him}.`,
    };
    const CHIP = {                                                           // DRAFT words beside the tower (verb, note)
        accept: name => ({ act: 'accept', verb: 'Accept', note: `${name} goes without` }),
        share: () => ({ act: 'share', verb: 'Share it out', note: 'everyone goes hungry' }),
        notYet: () => ({ act: 'notYet', verb: 'Not yet', note: '' }),
        go: name => ({ act: 'go', verb: 'Go without', note: `${name} dies`, high: true }),   // the cost on the button, as a trip's "death 1 in N"
    };
    const TAG_LAST = 'Went without twice.';                                  // DRAFT: pointing at someone at their last
    const S = { phase: null, at: 0, offerer: null, offered: false, chip: null, shorts: 0, hooked: false, picks: [], confirmed: [], table: null, seq: 0 };
    const app = () => NS.app || window.app || null;
    const state = () => { const a = app(); return (a && a.state) || null; };
    const tags = c => (c && c.tags) || [];
    const idOf = c => CREW_BY_TAG[Object.keys(CREW_BY_TAG).find(t => tags(c).includes(t))] || String((c && c.name) || '').toLowerCase();
    const member = id => { const s = state(); return ((s && s.crew) || []).find(c => idOf(c) === id) || null; };
    const voice = () => (NS.mods && NS.mods.voice) || null;
    const say = (id, who, text) => { const v = voice(); if (!v || typeof v.say !== 'function') return Promise.resolve(false); try { return v.say({ id, who, text, keep: true }); } catch (err) { console.error('NSSupper: the voice failed', err); return Promise.resolve(false); } };
    const wait = ms => new Promise(r => setTimeout(r, ms));

    const pending = () => { const s = state(); return !!(s && s._nsSupper && !s.gameOver); };
    const short = () => { const s = state(); return !!s && typeof s.supperNeed === 'function' && s.rations < s.supperNeed(); };
    const need = () => { const s = state(); return s && typeof s.supperWithout === 'function' ? s.supperWithout() : 1; };
    const canGoWithout = c => !!c && c.status !== 'DEAD' && !tags(c).includes('LEADER');
    /** Going without again would kill them (GameState.mayGoWithout: NEW_LOOK_ECONOMY.HUNGER_DEATH_AT). */
    const isLast = c => { const s = state(); return !!s && canGoWithout(c) && typeof s.mayGoWithout === 'function' && !s.mayGoWithout(c, false); };
    /** May go without with no table moment: alive, not Cora, not picked tonight, not at their last. */
    const free = c => canGoWithout(c) && !S.picks.includes(idOf(c)) && !isLast(c);
    /** Who offers: the first in OFFER_ORDER who may go without and is not shut away. */
    function offererNow() {
        const ok = c => free(c) && !tags(c).includes('CONFINED') && !tags(c).includes('SEDATED');
        return OFFER_ORDER.find(id => ok(member(id))) || null;
    }
    /** Anyone besides id who could still go without tonight (the table moment's "Not yet" needs one). */
    const othersCan = id => (((state() || {}).crew) || []).some(c => free(c) && idOf(c) !== id);
    /** Too few left who could go without at all (even at the table) for the ones still needed: GameState.serveSupper shares
        the food out whatever is picked, so nobody is asked and "Share it out" waits alone. */
    const tooFew = () => (((state() || {}).crew) || []).filter(c => canGoWithout(c) && !S.picks.includes(idOf(c))).length < need() - S.picks.length;

    function reset() {
        hideChip();
        S.phase = null; S.offered = false; S.offerer = null; S.picks = []; S.confirmed = []; S.table = null; S.seq += 1;   // the next supper asks again
    }
    /** Supper is served: GameState.serveSupper's rules (the picks, or the food shared out), the save, the scene ends. */
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
    }

    function tick(dt, open) {
        hook();
        if (!pending()) { if (S.phase) reset(); return; }
        if (S.chip) { S.chip.el.classList.toggle('is-in', !!open); S.chip.el.style.visibility = open ? '' : 'hidden'; }   // never over a card, never clicked unseen
        if (!open) return;
        const now = performance.now(), v = voice(), talking = !!(v && typeof v.current === 'function' && v.current());
        if (!S.phase) { S.phase = 'seated'; S.at = now; return; }
        if (S.phase === 'seated' && now - S.at >= SEATED_MS) {
            if (!short()) { serve(false); return; }                              // enough for everyone: they eat, no choice
            if (talking && now - S.at < QUIET_MAX_MS) return;                    // a line on screen finishes first
            S.phase = 'choosing';
            offer(LINES.aura[Math.min(S.shorts, 1)]);
        }
        if (!S.chip && ((S.phase === 'choosing' && S.offered) || S.phase === 'table')) showChip();   // back after the view was away: the choice still stands
        if (S.chip) placeChip();
    }
    /** A.U.R.A.'s line, then whoever offers says so, and their "Accept" waits beside the tower ("Share it out" with nobody to offer). */
    function offer(line) {
        const seq = ++S.seq;
        hideChip();
        S.offered = false; S.offerer = tooFew() ? null : offererNow();
        say('aura', 'A.U.R.A.', line).then(() => wait(OFFER_GAP_MS)).then(() => {
            if (seq !== S.seq || S.phase !== 'choosing') return;
            const m = S.offerer && member(S.offerer);
            if (m) say(S.offerer, m.name, LINES.offer[S.offerer][(m._wentWithout || 0) > 0 ? 1 : 0]);
            S.offered = true;
            showChip();
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
        NS.bus.on('hidden', hideChip);
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

    // ── the table moment: someone at their last was picked ──
    function openTable(id) {
        S.seq += 1;                                                              // an offer still on its way stays unsaid
        hideChip();
        S.phase = 'table'; S.table = { id };
        const w = warning(member(id)), v = voice();
        if (v && typeof v.hush === 'function') { try { v.hush(); } catch (err) { console.error('NSSupper: hushing the voice failed', err); } }   // the warning is said now, never behind an offer
        say(w.id, w.who, w.text);
        showChip();
    }
    /** Who says it at the table: Aris (about herself too), else A.U.R.A. Dead people do not speak (docs/STYLE.md). */
    function warning(m) {
        const aris = member('aris'), him = m.gender === 'F' ? 'her' : 'him';
        const speaks = !!aris && aris.status !== 'DEAD' && !tags(aris).includes('SEDATED');
        if (speaks) return { id: 'aris', who: aris.name, text: aris === m ? LINES.warnSelf : LINES.warn(m.name, him) };
        return { id: 'aura', who: 'A.U.R.A.', text: LINES.warnAura(m.name, him) };
    }
    function act(what) {
        if (!pending()) return;
        if (what === 'accept') { if (S.offerer) pick(S.offerer); return; }
        if (what === 'share') { serve(true); return; }
        if (S.phase !== 'table' || !S.table) return;
        const id = S.table.id;
        if (what === 'notYet') { S.table = null; S.phase = 'choosing'; hideChip(); S.offered = true; showChip(); return; }
        if (what === 'go') { S.picks.push(id); S.confirmed.push(id); next(); }
    }

    // ── the words beside the tower: "Accept", "Share it out", or the table moment's two ──
    function chipList() {
        if (S.phase === 'table' && S.table) {
            const m = member(S.table.id);
            return m ? [othersCan(S.table.id) ? CHIP.notYet() : CHIP.share(), CHIP.go(m.name)] : [];
        }
        const m = S.offerer && member(S.offerer);
        return [m && free(m) ? CHIP.accept(m.name) : CHIP.share()];
    }
    function showChip() {
        if (S.chip) return;
        const layer = document.getElementById('ns-ship-words'), list = chipList();
        if (!layer || !list.length) return;
        const el = document.createElement('div'), ol = document.createElement('ol'), ready = performance.now() + DEAF_MS;
        el.className = 'nsk-chips nss-supper'; ol.className = 'nsk-list';
        list.forEach(c => {
            const li = document.createElement('li'), b = document.createElement('button'), verb = document.createElement('span');
            b.type = 'button'; b.className = 'nsk-choice'; b.dataset.act = c.act;
            verb.className = 'nsk-verb'; verb.textContent = c.verb; b.append(verb);
            if (c.note) { const note = document.createElement('span'); note.className = c.high ? 'nsk-note is-high' : 'nsk-note'; note.textContent = c.note; b.append(note); }
            b.addEventListener('pointerdown', ev => ev.stopPropagation());
            b.addEventListener('click', ev => { ev.stopPropagation(); if (performance.now() >= ready) act(c.act); });
            li.append(b); ol.append(li);
        });
        el.append(ol);
        el.addEventListener('pointerdown', ev => ev.stopPropagation());
        layer.append(el);
        S.chip = { el };
        placeChip();
        void el.offsetWidth; el.classList.add('is-in');
    }
    function hideChip() { if (S.chip) { S.chip.el.remove(); S.chip = null; } }
    /** Level with the one it is about: the one picked at the table, else whoever offers, else the first at the table. */
    function anchorId() {
        if (S.phase === 'table' && S.table) return S.table.id;
        if (S.offerer) return S.offerer;
        return OFFER_ORDER.concat('cora').find(id => canGoWithout(member(id)) || (id === 'cora' && member(id))) || 'cora';
    }
    /** Over space just right of the hull, level with that person (the anchor 'person:<id>', its third place). */
    function placeChip() {
        const f = NS.anchors.get('person:' + anchorId()), places = f ? f() : [];
        const at = places[2] || places[0];
        if (!at) return;
        const el = S.chip.el, h = el.offsetHeight || 40, w = el.offsetWidth || 200;
        const x = Math.max(16, Math.min(innerWidth - w - 16, at.x + 8)), y = Math.max(16, Math.min(innerHeight - h - 16, at.y + 64));
        const pos = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
        if (el.style.transform !== pos) el.style.transform = pos;
    }

    hook();
    window.NSSupper = Object.freeze({
        pending, tick, choosing, atTable, pick, tagFor, settle,
        busy: () => pending() || choosing(),
        debug: () => {
            const s = state();
            return { phase: S.phase, offerer: S.offerer, chip: !!S.chip, need: s && s.supperWithout ? s.supperWithout() : null, rations: s ? s.rations : null, pending: pending(),
                picks: S.picks.slice(), confirmed: S.confirmed.slice(), table: S.table ? S.table.id : null, chips: S.chip ? [...S.chip.el.querySelectorAll('button')].map(b => b.dataset.act) : [] };
        },
    });
})();
