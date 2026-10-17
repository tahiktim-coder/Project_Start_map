/* ═══ Silent Exodus · new screen (?new=1) · tower/Supper.js: supper after a jump, at the galley table ═══════════════════
   What it is: the crew eat after every sector jump (docs/SHIP_LIFE.md "2. Supper at the jump"), in the living ship: no new
   screen, no card, no meter. The jump leaves state._nsSupper (bundle.js startSectorJump); in the next sector's travel view,
   once the tower is in, everyone is at the galley table (Tower.js holds the crew's day at its meal while the supper is due).
   Enough food: they eat a moment, the rations over the table count down, and the day goes on. Fewer rations than people
   eating: A.U.R.A. says so in one line, Vance offers first in one line, and the player clicks who goes without, or
   "Accept" beside the tower. Setting a course first keeps the offer. The rules are GameState.serveSupper's (bundle.js): the
   one who goes without takes +1 stress and no rest this jump; hurt or already at stress 2, they are too weak for the next
   team trip (the tower seats them, the bridge stands them aside). Plain speech (docs/STYLE.md), never a count of people.
   Loaded only with the new-screen switch, after NewScreen.js and before tower/Tower.js, which drives it every frame.

   window.NSSupper (frozen)
     pending() → bool         a supper is due: the jump is made and nobody has eaten yet (the tower keeps them at the table)
     busy() → bool            pending, or the choice is open (NSOrbit holds crew moments meanwhile)
     tick(dt, open)           the tower's frame; open: the tower in view (travel, slid in, not dark, nothing over it)
     choosing() → bool        the choice is open: a click on a person picks them
     pick(id) → bool          id goes without (never Cora; anyone else alive)
     settle()                 serve it now, nobody asked (a course set, or another jump, before anyone chose): the offer stands
     tagFor(id) → { verb, note } | null   what pointing at someone says while choosing
     debug() → { phase, offerer, need, rations, pending }
   Bus: emits 'supper:served' { short, without }.
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
    const LINES = {                                                          // one plain idea each (docs/STYLE.md); the second time says "again"
        aura: ['Not enough for everyone tonight, Commander.', 'Not enough for everyone again, Commander.'],
        offer: {
            vance: ["I'll skip it.", "I'll skip it again. I'm fine."],
            jaxon: ["I'll go without tonight.", "I'll go without again. I'm fine."],
            aris: ['Give mine to someone else.', 'Give mine away again. I can manage.'],
            mira: ["I'm not hungry. Really.", "I'm still not hungry. Really."],
        },
    };
    const S = { phase: null, at: 0, offerer: null, offered: false, chip: null, shorts: 0, hooked: false };
    const app = () => NS.app || window.app || null;
    const state = () => { const a = app(); return (a && a.state) || null; };
    const tags = c => (c && c.tags) || [];
    const idOf = c => CREW_BY_TAG[Object.keys(CREW_BY_TAG).find(t => tags(c).includes(t))] || String((c && c.name) || '').toLowerCase();
    const member = id => { const s = state(); return ((s && s.crew) || []).find(c => idOf(c) === id) || null; };
    const voice = () => (NS.mods && NS.mods.voice) || null;
    const say = (id, who, text) => { const v = voice(); if (!v || typeof v.say !== 'function') return Promise.resolve(false); try { return v.say({ id, who, text, keep: true }); } catch (err) { console.error('NSSupper: the voice failed', err); return Promise.resolve(false); } };

    const pending = () => { const s = state(); return !!(s && s._nsSupper && !s.gameOver); };
    const short = () => { const s = state(); return !!s && typeof s.supperNeed === 'function' && s.rations < s.supperNeed(); };
    const canGoWithout = c => !!c && c.status !== 'DEAD' && !tags(c).includes('LEADER');
    /** Who offers: Vance, unless he is dead or shut away; then the next one who can. */
    function offererNow() {
        const ok = c => canGoWithout(c) && !tags(c).includes('CONFINED') && !tags(c).includes('SEDATED');
        return OFFER_ORDER.find(id => ok(member(id))) || null;
    }

    /** Supper is served: GameState.serveSupper's rules, the save, the scene ends. */
    function serve(withoutId) {
        const s = state(), a = app();
        if (!s || typeof s.serveSupper !== 'function') { S.phase = null; return; }
        const m = withoutId ? member(withoutId) : null, wasShort = short();
        s.serveSupper(m);
        hideChip();
        S.phase = null; S.offered = false; S.offerer = null;                    // the next supper asks again (someone may have died since)
        if (wasShort) S.shorts += 1;
        if (a && typeof a.autoSave === 'function') { try { a.autoSave(); } catch (err) { console.error('NSSupper: the save failed', err); } }
        NS.bus.emit('supper:served', { short: wasShort, without: m ? withoutId : null });
    }

    function tick(dt, open) {
        hook();
        if (!pending()) { if (S.phase) { S.phase = null; S.offered = false; hideChip(); } return; }
        if (S.chip) { S.chip.el.classList.toggle('is-in', !!open); S.chip.el.style.visibility = open ? '' : 'hidden'; }   // never over a card, never clicked unseen
        if (!open) return;
        const now = performance.now(), v = voice(), talking = !!(v && typeof v.current === 'function' && v.current());
        if (!S.phase) { S.phase = 'seated'; S.at = now; return; }
        if (S.phase === 'seated' && now - S.at >= SEATED_MS) {
            if (!short()) { serve(null); return; }                               // enough for everyone: they eat, no choice
            if (talking && now - S.at < QUIET_MAX_MS) return;                    // a line on screen finishes first
            S.phase = 'choosing'; S.offerer = offererNow();
            const n = Math.min(S.shorts, 1);
            say('aura', 'A.U.R.A.', LINES.aura[n]).then(() => new Promise(r => setTimeout(r, OFFER_GAP_MS))).then(() => {
                if (S.phase !== 'choosing' || !S.offerer) return;
                const m = member(S.offerer);
                if (m) say(S.offerer, m.name, LINES.offer[S.offerer][n]);
                S.offered = true;
                showChip();
            });
        }
        if (S.phase === 'choosing' && S.offered && !S.chip) showChip();         // back after the view was away: the offer still stands
        if (S.chip) placeChip();
    }
    /** Supper now, nobody asked: a course set (or another jump) before anyone chose. The offer stands. */
    function settle() { if (pending()) serve(short() ? (S.phase === 'choosing' && S.offerer) || offererNow() : null); }
    function hook() {
        if (S.hooked) return;
        S.hooked = true;
        NS.bus.on('flow:go', settle);
        NS.bus.on('hidden', hideChip);
    }

    const choosing = () => S.phase === 'choosing' && pending();
    function pick(id) {
        if (!choosing()) return false;
        if (!canGoWithout(member(id))) return false;
        serve(id);
        return true;
    }
    function tagFor(id) {
        if (!choosing() || !canGoWithout(member(id))) return null;
        const m = member(id);
        return { verb: m.name, note: 'goes without' };
    }

    // ── "Accept": one word beside the tower, level with whoever offered ──
    function showChip() {
        if (S.chip || !S.offerer) return;
        const layer = document.getElementById('ns-ship-words');
        const m = member(S.offerer);
        if (!layer || !m) return;
        const el = document.createElement('div'), b = document.createElement('button'), verb = document.createElement('span'), note = document.createElement('span');
        el.className = 'nsk-chips nss-supper'; b.type = 'button'; b.className = 'nsk-choice';
        verb.className = 'nsk-verb'; verb.textContent = 'Accept';
        note.className = 'nsk-note'; note.textContent = `${m.name} goes without`;
        b.append(verb, note); el.append(b);
        const ready = performance.now() + 400;                                   // deaf for 400 ms: a click meant for the ship never lands on it
        b.addEventListener('pointerdown', ev => ev.stopPropagation());
        b.addEventListener('click', ev => { ev.stopPropagation(); if (performance.now() >= ready) pick(S.offerer); });
        el.addEventListener('pointerdown', ev => ev.stopPropagation());
        layer.append(el);
        S.chip = { el };
        placeChip();
        void el.offsetWidth; el.classList.add('is-in');
    }
    function hideChip() { if (S.chip) { S.chip.el.remove(); S.chip = null; } }
    /** Over space just right of the hull, level with the one who offered (the anchor 'person:<id>', its third place). */
    function placeChip() {
        const f = NS.anchors.get('person:' + S.offerer), places = f ? f() : [];
        const at = places[2] || places[0];
        if (!at) return;
        const el = S.chip.el, h = el.offsetHeight || 40, w = el.offsetWidth || 200;
        const x = Math.max(16, Math.min(innerWidth - w - 16, at.x + 8)), y = Math.max(16, Math.min(innerHeight - h - 16, at.y + 64));
        const pos = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
        if (el.style.transform !== pos) el.style.transform = pos;
    }

    hook();
    window.NSSupper = Object.freeze({
        pending, tick, choosing, pick, tagFor, settle,
        busy: () => pending() || choosing(),
        debug: () => { const s = state(); return { phase: S.phase, offerer: S.offerer, chip: !!S.chip, need: s && s.supperNeed ? s.supperNeed() : null, rations: s ? s.rations : null, pending: pending() }; },
    });
})();
