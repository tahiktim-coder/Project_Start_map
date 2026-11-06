/* ═══ Silent Exodus · new screen (?new=1) · tower/ShipKey.js: glass keys on the ship's decks (look pass B04, call C84) ═══════
   What it is: the bridge's glass key language (stop/TagArt.js: amber corner brackets, a small pixel icon, the ink dither
   behind the words) on a plate docked at the outer hull edge of a deck, opening right into clear space, never over a
   readout and never under the pointer. A key's label is Condensed 600 caps (--fs-tag), its cost a Mono chip in --loss (a
   word chip is Condensed 500); "hot" (pointed at, or focused) brightens its brackets and label. A plate gives no hover look
   until the pointer has moved (or 250 ms have passed); clicks are deaf for 400 ms; keys 1-9 pick, ↑ ↓ move, Esc closes.
   Two plates use it:
     the repair plate   a red deck clicked: Fix it (wrench) / Patch it (tape) / Live with it, each with its cost chip; the
                        deck's name over them. Pointing at a red deck shows only the name and the one rule chip ("jumps ×2"),
                        where the plate will open. After a pick the result is said in travel (Jaxon, or A.U.R.A.).
     the supper plate   tower/Supper.js: the commander's one reply at the galley deck ("All right, Vance").
   Loaded only with the new-screen switch, after NewScreen.js and before tower/Supper.js (stop/TagArt.js, loaded later, is
   read when a plate is drawn; without it the plate keeps its words on a plain ink ground).

   window.NSShipKey (frozen)
     plate(opts) → plate           opts { cls, aria, onPick(row, i), onClose() }; in #ns-ship-words
       plate.set({ title, titleChip, rows: [{ act, icon: 'wrench' | 'tape' | null, label, who: { id, name }, chips: [{ text,
                 word, tone: 'loss' | 'dim' | 'text' }], off }], keys: bool })   keys false: a label (nothing to press)
       plate.dock(deck, pointer?)   at that deck's hull edge (tower/TowerCard.js edge()); false while the tower is not in view
       plate.show(on), plate.remove(), plate.el, plate.isKeys(), plate.rect() → DOMRect | null
     repair                        { point(deck | null), open(deck), close(), tick(ok), deck() → name | null, isOpen() }
     deckWord(deck) → 'The engine room'   and isPlural(deck): the quarters are, the rest is
*/
(function () {
    'use strict';
    const NS = window.NewScreen;
    if (!window.NEW_SCREEN || !NS || !NS.on) return;

    const ARM_MS = 250, DEAF_MS = 400, GAP_PX = 12, EDGE_PX = 16, PAD = 4;
    // the deck's words (tower names; the game calls the hold 'cargo'): plural-aware (L-15)
    const DECK_WORD = { bridge: 'The bridge', lab: 'The lab', quarters: 'The quarters', hold: 'The hold', engineering: 'The engine room' };
    const DECK_NAME = { bridge: 'Bridge', lab: 'Lab', quarters: 'Quarters', hold: 'Hold', engineering: 'Engine room' };
    const GAME_KEY = { bridge: 'bridge', lab: 'lab', quarters: 'quarters', hold: 'cargo', engineering: 'engineering' };
    const isPlural = deck => deck === 'quarters';
    const deckWord = deck => DECK_WORD[deck] || 'This deck';
    // what living with a broken deck costs, as one chip (NSOrbit.DECK_COST's rules, said short)
    const RULE = { bridge: 'warps ×1.5', quarters: 'no rest', hold: 'hold ½', engineering: 'jumps ×2', lab: '' };   // DRAFT (look pass): the rule chips (C84)
    // a pick's result, said in travel (L-16): Fix and Patch by Jaxon, Live with it by A.U.R.A.
    const FIXED = { bridge: "Bridge is fixed.", lab: "Lab's fixed.", quarters: 'Quarters are fixed.', hold: "Hold's fixed.", engineering: "Engine room's fixed." };   // DRAFT (look pass): L-16, Jaxon
    const PATCHED = "That'll hold for a jump or two.";                    // DRAFT (look pass): L-16, Jaxon
    const LIVE = { bridge: 'Warps will cost more, Commander.', quarters: 'Nobody will rest at supper, Commander.', hold: 'The hold will take half, Commander.',   // DRAFT (look pass): L-16, A.U.R.A.
        engineering: 'Jumps will cost double, Commander.' };              // DRAFT (look pass): L-16, A.U.R.A.
    const FIXED_AURA = deck => `${deckWord(deck)} ${isPlural(deck) ? 'are' : 'is'} fixed, Commander.`;   // DRAFT (look pass): Jaxon cannot say it

    // ── the icons: 9 x 9, '.' empty, 1..4 dim to bright (TagArt's ramp) ──
    const ICONS = {
        wrench: ['......2.2', '......3.3', '.....333.', '....33...', '...33....', '..33.....', '.33......', '23.......', '2........'],
        tape: ['..3333...', '.3....3..', '3..22..3.', '3.2..2.3.', '3..22..3.', '.3....3..', '..3333333', '.......33', '.........'],
    };
    const iconUrls = new Map();
    function iconUrl(name, hot, off) {
        const key = name + (off ? ':off' : hot ? ':hot' : ''), T = window.NSTagArt, map = ICONS[name];
        if (!map) return '';
        if (iconUrls.has(key)) return iconUrls.get(key);
        const r = T && typeof T.ramp === 'function' ? T.ramp(off ? 'cool' : 'warm') : ['#8a5422', '#e8964a', '#f7c483', '#fff3dc'];
        const c = document.createElement('canvas'); c.width = 9; c.height = 9;
        const g = c.getContext('2d');
        map.forEach((row, y) => { for (let x = 0; x < 9; x++) { const v = row[x]; if (v === '.') continue; g.fillStyle = r[Math.min(3, Number(v) - 1 + (hot ? 1 : 0))]; g.fillRect(x, y, 1, 1); } });
        const url = c.toDataURL();
        iconUrls.set(key, url);
        return url;
    }

    function style() {
        if (document.getElementById('ns-shipkey-style')) return;
        const st = document.createElement('style'); st.id = 'ns-shipkey-style';
        st.textContent = `#ns-ship-words .nsk-plate { --u: 1px; position: absolute; left: 0; top: 0; box-sizing: border-box; margin: 0; padding: calc(var(--u) * 6) calc(var(--u) * 7);
    pointer-events: auto; opacity: 0; white-space: nowrap; text-shadow: var(--shadow); transition: opacity calc(var(--step-ui) * 3) steps(3, end); }
#ns-ship-words .nsk-plate.is-in { opacity: 1; }
#ns-ship-words .nsk-plate.is-label { pointer-events: none; }
#ns-ship-words .nsk-plate > canvas { position: absolute; left: 0; top: 0; image-rendering: pixelated; pointer-events: none; }
#ns-ship-words .nsk-body { position: relative; }
#ns-ship-words .nsk-title { position: relative; display: flex; align-items: baseline; gap: var(--s3); margin: 0 0 var(--s1) var(--s2); font: 500 var(--fs-who)/1.2 var(--f-ui); letter-spacing: .18em; text-transform: uppercase; color: var(--loss); }
#ns-ship-words .nsk-plate.is-label .nsk-title { margin: 0; }
#ns-ship-words .nsk-keys { position: relative; list-style: none; margin: 0; padding: 0; display: grid; gap: var(--s1); }
#ns-ship-words .nsk-key { display: grid; grid-template-columns: calc(var(--u) * 9) max-content max-content; align-items: center; column-gap: var(--s2);
    margin: 0; padding: var(--s2) var(--s3) var(--s2) var(--s2); background: none; border: 0; color: inherit; font: inherit; text-align: left; text-shadow: var(--shadow); cursor: pointer; outline: none; }
#ns-ship-words .nsk-key.is-who { cursor: default; }
#ns-ship-words .nsk-ico { width: calc(var(--u) * 9); height: calc(var(--u) * 9); background: center / 100% 100% no-repeat; image-rendering: pixelated; }
#ns-ship-words .nsk-verb { font: 600 var(--fs-tag)/1 var(--f-ui); letter-spacing: .16em; text-transform: uppercase; color: var(--warm); transition: color var(--step-ui) steps(2, end); }
#ns-ship-words .nsk-key.is-hot .nsk-verb { color: var(--warm-br); }
#ns-ship-words .nsk-key.is-off .nsk-verb { color: var(--dim); }
#ns-ship-words .nsk-name { display: inline-flex; align-items: center; gap: var(--s2); font: 500 var(--fs-who)/1 var(--f-ui); letter-spacing: .18em; text-transform: uppercase; color: var(--tone, var(--ui)); }
#ns-ship-words .nsk-name i { flex: none; width: .82em; height: .82em; box-sizing: border-box; border: 1px solid currentColor; border-radius: 50%; }
#ns-ship-words .nsk-cs { display: inline-flex; gap: var(--s3); align-items: baseline; }
#ns-ship-words .nsk-c { font: 400 var(--fs-chip)/1 var(--f-num); letter-spacing: normal; text-transform: none; color: var(--loss); white-space: nowrap; text-shadow: var(--shadow), var(--halo); }
#ns-ship-words .nsk-c.is-word { font: 500 var(--fs-chip)/1 var(--f-ui); letter-spacing: .03em; color: var(--text-2); }
#ns-ship-words .nsk-c.is-word.is-loss { color: var(--loss); }
#ns-ship-words .nsk-c.is-dim { color: var(--dim); }
@media (prefers-reduced-motion: reduce) { #ns-ship-words .nsk-plate, #ns-ship-words .nsk-verb { transition: none; } }`;
        document.head.appendChild(st);
    }
    const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const layer = () => document.getElementById('ns-ship-words');
    /** The plate's pixel: the travel view's art px in CSS px, whole (2 at 1080, 1 at 768 and 720). */
    const unit = () => { const G = NS.G || {}; return Math.max(1, Math.round((G.k || 1) / (G.dpr || 1))); };
    const mode = () => { try { return typeof NS.mode === 'function' ? NS.mode() : 'travel'; } catch (err) { return 'travel'; } };
    const blocked = () => { try { return !!(NS.blocked && NS.blocked()); } catch (err) { return false; } };

    // ── one plate: the words in the DOM, the brackets and the shade in a canvas at the plate's pixel ──
    const open = new Set();
    function plate(opts) {
        style();
        const o = opts || {}, el = document.createElement('div'), art = document.createElement('canvas'), body = document.createElement('div');
        el.className = 'nsk-plate nsk-chips' + (o.cls ? ' ' + o.cls : ''); el.setAttribute('role', 'group'); if (o.aria) el.setAttribute('aria-label', o.aria);
        art.setAttribute('aria-hidden', 'true'); body.className = 'nsk-body';
        el.append(art, body);
        el.addEventListener('pointerdown', ev => ev.stopPropagation());
        const P = { el, rows: [], keys: false, hot: -1, armed: false, readyAt: 0, armT: 0, u: 0, key: '', pos: '', shown: false };
        function draw() {
            const u = unit(), w = Math.round(el.offsetWidth / u), h = Math.round(el.offsetHeight / u), T = window.NSTagArt;
            if (!w || !h) return;
            if (art.width !== w || art.height !== h) { art.width = w; art.height = h; }
            art.style.width = (w * u) + 'px'; art.style.height = (h * u) + 'px';
            const g = art.getContext('2d');
            g.clearRect(0, 0, w, h);
            if (T && typeof T.shade === 'function') T.shade(g, PAD, PAD, w - PAD * 2, h - PAD * 2, 1);
            else { g.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#05070a'; g.fillRect(PAD, PAD, w - PAD * 2, h - PAD * 2); }
            if (!P.keys || !T || typeof T.brackets !== 'function') return;
            const pr = el.getBoundingClientRect();
            [...el.querySelectorAll('.nsk-key:not(.is-who)')].forEach(b => {
                const i = Number(b.dataset.i), br = b.getBoundingClientRect(), x = Math.round((br.left - pr.left) / u), y = Math.round((br.top - pr.top) / u);
                const bw = Math.round(br.width / u), bh = Math.round(br.height / u), off = !!(P.rows[i] && P.rows[i].off);
                T.brackets(g, x, y, bw, bh, off ? 'cool' : 'warm', 1, i === P.hot && !off);
            });
        }
        function setHot(i) {
            if (P.hot === i) return;
            P.hot = i;
            [...el.querySelectorAll('.nsk-key')].forEach(b => {
                const on = Number(b.dataset.i) === i, row = P.rows[Number(b.dataset.i)], ico = b.querySelector('.nsk-ico');
                b.classList.toggle('is-hot', on);
                if (ico && row && row.icon) ico.style.backgroundImage = `url(${iconUrl(row.icon, on && !row.off, !!row.off)})`;
            });
            draw();
        }
        function pick(i) {
            const row = P.rows[i];
            if (!row || row.who || performance.now() < P.readyAt) return;
            if (typeof o.onPick === 'function') { try { o.onPick(row, i); } catch (err) { console.error('NSShipKey: a pick failed', err); } }
        }
        function rowHtml(r, i) {
            const chips = (r.chips || []).map(c => `<i class="nsk-c${c.word ? ' is-word' : ''}${c.tone ? ' is-' + esc(c.tone) : ''}">${esc(c.text)}</i>`).join('');
            const ico = `<i class="nsk-ico"${r.icon ? ` style="background-image:url(${iconUrl(r.icon, false, !!r.off)})"` : ''}></i>`;
            const label = r.who ? `<b class="nsk-name tone-${esc(r.who.id)}"><i></i>${esc(r.who.name)}</b>` : `<b class="nsk-verb">${esc(r.label)}</b>`;
            const tag = r.who || !P.keys ? 'div' : 'button';
            return `<li><${tag}${tag === 'button' ? ' type="button"' : ''} class="nsk-key${r.who ? ' is-who' : ''}${r.off ? ' is-off' : ''}" data-i="${i}" data-act="${esc(r.act || '')}">${ico}${label}<span class="nsk-cs">${chips}</span></${tag}></li>`;
        }
        P.set = s => {
            const v = s || {}, rows = v.rows || [], keys = v.keys !== false && rows.some(r => !r.who), was = P.keys;
            P.keys = keys;                                                              // rowHtml reads it: a key is a button only on a plate of keys
            const titleChip = v.titleChip ? `<i class="nsk-c">${esc(v.titleChip)}</i>` : '';
            const html = (v.title ? `<p class="nsk-title"><span>${esc(v.title)}</span>${titleChip}</p>` : '') + (rows.length ? `<ol class="nsk-keys">${rows.map(rowHtml).join('')}</ol>` : '');
            const key = html + '|' + keys;
            if (key === P.key) { P.keys = was; return false; }
            P.key = key; P.rows = rows; P.hot = -1;
            if (P.shown) { if (keys) open.add(P); else open.delete(P); }
            el.classList.toggle('is-label', !keys);
            body.innerHTML = html;
            [...body.querySelectorAll('button.nsk-key')].forEach(b => {
                const i = Number(b.dataset.i);
                b.addEventListener('pointerenter', () => { if (P.armed) setHot(i); });
                b.addEventListener('pointermove', () => { if (!P.armed) arm(); setHot(i); });
                b.addEventListener('pointerleave', () => { if (P.hot === i && document.activeElement !== b) setHot(-1); });
                b.addEventListener('focus', () => setHot(i));
                b.addEventListener('blur', () => { if (P.hot === i) setHot(-1); });
                b.addEventListener('click', ev => { ev.stopPropagation(); pick(i); });
            });
            P.u = 0;
            return true;
        };
        function arm() { P.armed = true; clearTimeout(P.armT); }
        /** Docked at the deck's outer hull edge, level with its middle (or, if that would be under the pointer, beside it). */
        P.dock = (deck, pointer) => {
            const T = window.NSTowerCard, e = T && typeof T.edge === 'function' ? T.edge(deck) : null;
            if (!e) return false;
            const u = unit();
            if (P.u !== u) { P.u = u; el.style.setProperty('--u', u + 'px'); }
            const w = el.offsetWidth, h = el.offsetHeight;
            let x = e.x + GAP_PX, y = e.y - h / 2;
            y = Math.max(EDGE_PX, Math.min(innerHeight - h - EDGE_PX, y));
            if (pointer && pointer.x >= x - 4 && pointer.x <= x + w + 4 && pointer.y >= y - 4 && pointer.y <= y + h + 4) x = Math.round(pointer.x + 24);   // never under the pointer
            x = Math.min(innerWidth - w - EDGE_PX, x);
            const pos = `translate(${Math.round(x / u) * u}px, ${Math.round(y / u) * u}px)`;
            if (P.pos !== pos) { P.pos = pos; el.style.transform = pos; }
            if (!P.drawn || P.drawn !== P.key + u + w + h) { P.drawn = P.key + u + w + h; draw(); }
            return true;
        };
        P.show = on => {
            const want = !!on;
            el.style.visibility = want ? '' : 'hidden';
            if (want === P.shown) return;
            P.shown = want;
            if (want) {
                P.readyAt = performance.now() + DEAF_MS; P.armed = false; clearTimeout(P.armT); P.armT = setTimeout(arm, ARM_MS);
                if (P.keys) open.add(P);
                void el.offsetWidth; el.classList.add('is-in');
            } else { el.classList.remove('is-in'); open.delete(P); setHot(-1); }
        };
        P.remove = () => { clearTimeout(P.armT); open.delete(P); el.remove(); };
        P.isKeys = () => P.keys;
        P.rect = () => (P.shown ? el.getBoundingClientRect() : null);
        P.close = () => { if (typeof o.onClose === 'function') { try { o.onClose(); } catch (err) { console.error('NSShipKey: closing failed', err); } } };
        P.pick = pick; P.setHot = setHot; P.arm = arm;
        const l = layer();
        if (l) l.appendChild(el);
        return P;
    }

    // ── keys while a plate is up: 1-9 pick, ↑ ↓ move, Esc closes (only in travel, nothing over the view) ──
    function onKey(e) {
        if (!open.size || mode() !== 'travel' || blocked() || e.altKey || e.ctrlKey || e.metaKey) return;
        const P = [...open].pop(), keys = P.rows.map((r, i) => (r.who ? -1 : i)).filter(i => i >= 0);
        let used = true;
        if (e.key === 'Escape') P.close();
        else if (/^[1-9]$/.test(e.key) && keys[Number(e.key) - 1] != null) P.pick(keys[Number(e.key) - 1]);
        else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            const at = keys.indexOf(P.hot), n = keys.length, next = keys[((at < 0 ? (e.key === 'ArrowDown' ? -1 : 0) : at) + (e.key === 'ArrowDown' ? 1 : n - 1)) % n];
            const b = P.el.querySelector(`button.nsk-key[data-i="${next}"]`);
            P.arm();
            if (b) b.focus({ preventScroll: true }); else P.setHot(next);
        } else used = false;
        if (used) { e.preventDefault(); e.stopImmediatePropagation(); }
    }
    addEventListener('keydown', onKey, true);
    addEventListener('pointermove', () => open.forEach(P => { if (!P.armed && performance.now() > P.readyAt - DEAF_MS + 16) P.arm(); }), true);

    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    // The repair plate (a red deck clicked; C84, DESIGN 6.4 red-deck-words)
    // ════════════════════════════════════════════════════════════════════════════════════════════════════════════
    const R = { plate: null, deck: null, state: null, pointer: null };          // state 'point' | 'open'
    const flow = (name, ...args) => { const f = NS.flow; try { return f && typeof f[name] === 'function' ? f[name](...args) : undefined; } catch (err) { console.error('NSShipKey: flow.' + name + ' failed', err); return undefined; } };
    const gameState = () => { const g = NS.game; try { return g && typeof g.state === 'function' ? g.state() : null; } catch (err) { return null; } };
    function rowsFor(deck) {
        const list = flow('deckChoices', GAME_KEY[deck]) || [], s = gameState(), have = s ? Number(s.salvage) || 0 : Infinity;
        return list.map((c, i) => {
            const k = c.key || ['fix', 'patch', 'live'][i];
            if (k === 'live') return { act: 'live', i, icon: null, label: c.words, chips: RULE[deck] ? [{ text: RULE[deck] }] : [] };
            const cost = Number(c.cost);
            return { act: k, i, icon: k === 'fix' ? 'wrench' : 'tape', label: c.words, chips: Number.isFinite(cost) ? [{ text: `${cost} salvage` }] : [], off: Number.isFinite(cost) && have < cost };
        });
    }
    function ensure() {
        if (!R.plate) R.plate = plate({ cls: 'nsk-repair', aria: 'Repair', onPick: (row) => choose(row), onClose: () => close() });
        return R.plate;
    }
    /** Pointing at a red deck: its name and the one rule chip, where the plate will open. */
    function point(deck, pointer) {
        if (R.state === 'open') return;
        if (!deck) { if (R.state === 'point') close(); return; }
        const P = ensure();
        R.deck = deck; R.state = 'point'; R.pointer = pointer || null;
        P.set({ title: DECK_NAME[deck] || deck, titleChip: RULE[deck] || '', rows: [], keys: false });
        P.show(P.dock(deck, R.pointer));
    }
    function openPlate(deck, pointer) {
        const P = ensure();
        R.deck = deck; R.state = 'open'; R.pointer = pointer || null;
        P.set({ title: DECK_NAME[deck] || deck, rows: rowsFor(deck), keys: true });
        P.show(false);
        P.show(P.dock(deck, R.pointer));
    }
    function close() { R.state = null; R.deck = null; if (R.plate) R.plate.show(false); }
    /** A pick: the game's own rule (NSOrbit.deckChoose through the shell); its result said in travel. */
    function choose(row) {
        const deck = R.deck;
        if (!deck) return;
        close();
        const ok = !!flow('deckChoose', GAME_KEY[deck], row.i);
        if (ok) sayResult(row.act, deck);
    }
    function speaker(id) {
        const s = gameState(), tag = { jaxon: 'ENGINEER' }[id];
        const c = s && (s.crew || []).find(m => (m.tags || []).includes(tag));
        const away = window.NSOrbit && typeof window.NSOrbit.trip === 'function' && (window.NSOrbit.trip() || { ids: [] }).ids.includes(id);
        return !!c && c.status !== 'DEAD' && !(c.tags || []).includes('SEDATED') && c.trait !== 'CATATONIC' && !away ? c.name : null;
    }
    function sayResult(act, deck) {
        const v = NS.mods && NS.mods.voice, jaxon = speaker('jaxon');
        if (!v || typeof v.say !== 'function') return;
        let line = null;
        if (act === 'fix') line = jaxon ? { id: 'jaxon', who: jaxon, text: FIXED[deck] } : { id: 'aura', who: 'A.U.R.A.', text: FIXED_AURA(deck) };
        else if (act === 'patch') line = jaxon ? { id: 'jaxon', who: jaxon, text: PATCHED } : null;
        else if (act === 'live' && LIVE[deck]) line = { id: 'aura', who: 'A.U.R.A.', text: LIVE[deck] };
        if (line && line.text) { try { v.say(line); } catch (err) { console.error('NSShipKey: the voice failed', err); } }
    }
    /** Every frame from the tower: ok false (not travel, a card up, the deck mended, the stall) closes it; else it stays docked. */
    function tick(ok) {
        if (!R.state || !R.plate) return;
        if (!ok) { close(); return; }
        if (!R.plate.dock(R.deck, R.pointer)) R.plate.show(false);
    }
    const repair = Object.freeze({ point, open: openPlate, close, tick, deck: () => R.deck, isOpen: () => R.state === 'open', state: () => R.state });

    window.NSShipKey = Object.freeze({ plate, repair, deckWord, isPlural, ICONS, RULE });
})();
