/* ═══ Silent Exodus · new screen (?new=1) · dock/BoardLook.js: the station boarding in the new look (look pass B13) ═══════
   What it is: the safe cleanup of BoardingParty's picker and walk under html.ns-on; the redesign (the crew at the airlock in
   the picture, the ring-station cutaway, air pips over the boarder) is later (C61b). BoardingParty keeps its rules, its words
   and its old sheet; with the switch on it asks this file how to show them:
     css(base, type)   its sheet (base, with type: its hand copy of the faces) with every hand-copied colour, face and easing
                       swapped for a token (tokens.css) and the blur for the house dither, then the rules below: no header
                       (the room's name is a tag on the room), door tags in Condensed 500 sentence case on a dither plate with
                       a Mono cost chip, 14 px floors at every width, no text below opacity 1, narration in the real italic
     door(d)           one room's tag over the walk picture: d = { name, conds[], jam, cost, isSafe, isHomeward, to, style,
                       isLabel, isHere, isOff, far, rule } (BoardingParty's words, shown here in sentence case; rule: the
                       room's condition rule, said in the line while the door is pointed at)
     key(k)            a walk key, the frame key (.mini-btn): k = { kind, words (html), cost, gain, closed[], rules[], cls,
                       isOff }; under its words its number chips (the cost in Mono, a gain like '+20 energy' warm); a closed
                       key shows only its reason (--loss when it would strand the boarder), its words --dim; its rules (a gain
                       in words, the risk, the heavy load) show in the line while it is pointed at
     point(overlay)    the walk's pointing: while a key or a door with rules is pointed at (or focused from the keyboard),
                       its rules take the voice line's place (a swap, never a second line) → { clear(), focus(el) }
     station(name, silent)  the station's name tag in the corner of the picker's picture, how long it has been silent its chip
     sentence(s)       'POWER ROOM' → 'Power room' (case only: the words stay the designer's)
     num(html)         every number in a run of words in Mono (words Sans, numbers Mono)
     tone(who)         a crew member's tone token
   Loaded only when the new-screen switch is on (index.html); BoardingParty without it shows the old sheet and words. */
(function () {
    'use strict';
    if (!window.NEW_SCREEN) return;

    const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const sentence = s => { const t = String(s || ''); return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase().replace(/\ba\.u\.r\.a\./g, 'A.U.R.A.'); };
    /** Numbers (a sign, digits, a %) in Mono; the html's tags and entities are left alone. */
    const num = html => String(html).replace(/(<[^>]*>|&#?\w+;)|((?:[+−±-])?\d+(?:[.,]\d+)?%?)/g, (m, tag, n) => (tag ? tag : `<span class="bx-n">${n}</span>`));
    const COND = { DARK: 'is-dark', VENTED: 'is-vented', UNSTABLE: 'is-unstable', SEALED: 'is-sealed' };

    // ── the sheet ──
    // the hand copies in BoardingParty's sheet, swapped for the tokens they copy (the left side is never written anywhere else)
    const SWAP = [
        ['background: rgba(5, 7, 10, 0.95); -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);',
            'background: repeating-conic-gradient(color-mix(in srgb, var(--ink) 99%, transparent) 0 25%, color-mix(in srgb, var(--ink) 96%, transparent) 0 50%) 0 0 / 4px 4px; -webkit-backdrop-filter: none; backdrop-filter: none;'],   // the house dither (never a blur), denser than the minigames' frame: the crew's words sit on it, so no world's ring shows through
        ['animation: bx-in 250ms ease-out', 'animation: bx-in calc(3 * var(--step-ui)) steps(3, end)'],
        ['0 1px 0 #05070a, 0 0 6px rgba(5, 7, 10, 0.95)', 'var(--shadow), var(--halo)'],
        ['0 1px 0 #05070a', 'var(--shadow)'],
        ['rgba(240, 140, 46, 0.55)', 'color-mix(in srgb, var(--warm) 55%, transparent)'],
        ['rgba(240, 140, 46, 0.08)', 'color-mix(in srgb, var(--warm) 8%, transparent)'],
        ['rgba(240, 140, 46, 0.16)', 'color-mix(in srgb, var(--warm) 16%, transparent)'],
        ['var(--bx-f-ui)', 'var(--f-ui)'], ['var(--bx-f-text)', 'var(--f-text)'], ['var(--bx-f-num)', 'var(--f-num)'],
        ['var(--bx-ease)', 'steps(2, end)'],
        ['#e4e4e0', 'var(--text)'], ['#8b8d90', 'var(--dim)'], ['#5a6168', 'var(--dim)'],                // every #5a6168 in the sheet is a word or a word's mark: --dim
        ['#c9d1d6', 'var(--ui)'], ['#f08c2e', 'var(--warm)'], ['#ffc27a', 'var(--warm-br)'], ['#e0453a', 'var(--loss)'],
        ['#c7c9c6', 'var(--narr)'], ['#05070a', 'var(--ink)'],
    ];
    const PLATE = 'repeating-conic-gradient(color-mix(in srgb, var(--ink) 90%, transparent) 0 25%, color-mix(in srgb, var(--ink) 72%, transparent) 0 50%) 0 0 / 2px 2px';
    const HAIR = 'inset 0 0 0 1px color-mix(in srgb, var(--cool) 22%, transparent)';
    const EXTRA = `
.bx .bx-head { display: none; }
.bx .bx-sub { font: 500 var(--fs-floor)/1 var(--f-ui); letter-spacing: 0.18em; color: var(--dim); }
.bx .bx-picks > .bx-hint { flex: 1 1 100%; }
.bx .bx-pick b small { font: 400 var(--fs-chip)/1 var(--f-num); color: var(--dim); }
.bx .bx-pick span { text-shadow: var(--shadow); }
.bx .bx-tag { position: absolute; transform: translateX(-50%); display: grid; justify-items: center; gap: 1px; margin: 0; padding: 4px 8px 5px; border: 0; border-radius: 0;
    background: ${PLATE}; box-shadow: ${HAIR}; font: 500 var(--fs-floor)/1.2 var(--f-ui); letter-spacing: 0.04em; color: var(--text); text-shadow: var(--shadow); white-space: nowrap; opacity: 1; }
.bx button.bx-tag { padding-left: 16px; }
.bx button.bx-tag::before { left: 6px; top: 4px; font: 400 var(--fs-floor)/1.2 var(--f-num); }
.bx .bx-tag .bx-tc { display: flex; flex-wrap: wrap; justify-content: center; gap: 0 8px; }
.bx .bx-tag .bx-tc i { font: 500 var(--fs-floor)/1.2 var(--f-ui); font-style: normal; letter-spacing: 0.04em; }
.bx .bx-tag .bx-tc kbd { font: 400 var(--fs-floor)/1.2 var(--f-num); letter-spacing: 0; color: var(--ui); }
.bx .bx-door.is-homeward .bx-tc kbd { color: var(--warm); }
.bx .bx-tag .is-dark { color: var(--dim); } .bx .bx-tag .is-vented { color: var(--cool); } .bx .bx-tag .is-unstable, .bx .bx-tag .is-jam { color: var(--warm); }
.bx .bx-tag .is-sealed, .bx .bx-tag .is-far { color: var(--loss); }
.bx .bx-door.bx-tag:hover:not([disabled]), .bx .bx-door.bx-tag:focus-visible { box-shadow: inset 0 0 0 1px var(--warm); text-decoration: none; }
.bx .bx-door.bx-tag:hover:not([disabled]) .bx-tc kbd, .bx .bx-door.bx-tag:focus-visible .bx-tc kbd { color: var(--warm-br); }
.bx .bx-door.bx-tag[disabled]:not(.is-stranding) .bx-tc kbd { color: var(--dim); }
.bx .bx-door.bx-tag.is-stranding { color: var(--dim); opacity: 1; }
.bx .bx-door.bx-tag.is-label { color: var(--dim); }
.bx .bx-door.bx-tag.is-here { color: var(--text); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--warm) 45%, transparent); }
.bx .bx-station { left: 8px; top: 8px; transform: none; justify-items: start; }
.bx .bx-n { font-family: var(--f-num); font-weight: 400; letter-spacing: 0; }
.bx .bx-pick b small, .bx .bx-tag .bx-tc kbd, .bx .bx-btn kbd { text-transform: lowercase; }                 /* '13 AIR', '−1 AIR' read as Mono chips: 13 air, −1 air */
.bx .bx-readout { font: 400 var(--fs-floor)/1.3 var(--f-text); }
.bx .bx-label { font: 500 var(--fs-floor)/1 var(--f-ui); letter-spacing: 0.18em; color: var(--dim); }
.bx .bx-air strong small { font-size: var(--fs-floor); }
.bx .bx-slots li.is-heavy small { font: 500 var(--fs-floor)/1 var(--f-ui); letter-spacing: 0.04em; }
.bx .bx-cond.is-dark { color: var(--dim); } .bx .bx-cond.is-vented { color: var(--cool); } .bx .bx-cond.is-unstable { color: var(--warm); } .bx .bx-cond.is-sealed { color: var(--loss); }
.bx .bx-line { font-size: var(--fs-voice); }
.bx .bx-line.is-note { font: italic 400 var(--fs-voice)/1.36 var(--f-text); color: var(--narr); }
.bx .bx-haul li::before { font-size: var(--fs-floor); }
.bx .bx-quiet { font: 400 15px/1.5 var(--f-text); }
/* the readout: the air as its count and its pips (squares: the walk out warm, the spare steel, the spent an empty box), the
   hands as slots (a free hand an empty box), each under one sentence-case word */
.bx .bx-label { letter-spacing: 0.04em; }
.bx .bx-pips { gap: 2px; }
.bx .bx-pips i { width: 6px; height: 6px; background: var(--ui); opacity: 1; }
.bx .bx-pips i.is-home { background: var(--warm); }
.bx .bx-pips i.is-spent { background: none; box-shadow: inset 0 0 0 1px var(--faint); }
.bx .bx-pips i.is-mark { box-shadow: none; }
.bx .bx-air.is-low .bx-pips i.is-home { background: var(--loss); }
.bx .bx-slots { align-items: center; gap: var(--s1) var(--s3); }
.bx .bx-slots li::before { content: ''; display: inline-block; width: 10px; height: 10px; margin-right: var(--s2); vertical-align: -1px; background: var(--ui); }
.bx .bx-slots li.is-heavy::before { background: var(--warm); }
.bx .bx-slots li.is-free { width: 10px; height: 10px; box-shadow: inset 0 0 0 1px var(--dim); }
.bx .bx-slots li.is-free::before, .bx .bx-slots li.is-more::before { content: none; }
/* the keys: the frame key (.mini-btn, minigames.css, read through its --mg-* names), its chips under its words */
.bx { --mg-words: var(--text); --mg-quiet: var(--dim); --mg-faint: var(--faint); --mg-amber: var(--warm); --mg-amber-br: var(--warm-br);
    --mg-f-text: var(--f-text); --mg-f-num: var(--f-num); --mg-shadow: var(--shadow); --mg-ease: steps(2, end); }
.bx .bx-buttons { align-items: start; gap: var(--s2) var(--s8); }
.bx .mini-btn { font-size: var(--fs-key); }
.bx .mini-btn::before { color: var(--dim); }
.bx .mini-btn.is-take::before, .bx .mini-btn.is-primary::before, .bx .mini-btn:hover:not([disabled])::before, .bx .mini-btn:focus-visible::before { color: var(--warm); }
.bx .mini-btn.is-primary { border-color: color-mix(in srgb, var(--warm) 55%, transparent); background: color-mix(in srgb, var(--warm) 8%, transparent); }
.bx .mini-btn.is-primary:hover:not([disabled]), .bx .mini-btn.is-primary:focus-visible { border-color: var(--warm); background: color-mix(in srgb, var(--warm) 16%, transparent); }
.bx .mini-btn[disabled] { color: var(--dim); }                              /* a closed key's words: --dim (never --faint) */
.bx .mini-btn[disabled]::before { color: var(--faint); }
.bx .mini-btn.bx-key[hidden] { display: none; }
.bx .mini-btn.bx-key { display: inline-grid; grid-template-columns: auto auto; column-gap: var(--s2); row-gap: var(--s1); align-items: baseline; justify-items: start; }
.bx .bx-key .bx-tc { grid-column: 2; display: flex; flex-wrap: wrap; gap: 0 var(--s3); }
.bx .bx-key kbd { font: 400 var(--fs-chip)/1.2 var(--f-num); color: var(--dim); text-transform: lowercase; }
.bx .bx-key b { font: 400 var(--fs-chip)/1.2 var(--f-text); color: var(--warm); }
.bx .bx-key em { font: 400 var(--fs-chip)/1.2 var(--f-text); font-style: normal; color: var(--dim); }
.bx .bx-key.is-stranding em { color: var(--loss); }                            /* a key that would strand the boarder: its words --dim, only its reason red */
.bx .bx-key.is-urgent, .bx .bx-key.is-urgent kbd { color: var(--loss); }
/* pointed at (or focused from the keyboard): the key's or the door's rules in the voice line's place */
.bx .bx-talk.is-pointing .bx-voice { display: none; }
.bx .bx-rule { display: flex; flex-wrap: wrap; gap: 0 var(--s4); margin: 0; font: 400 var(--fs-conseq)/1.45 var(--f-text); color: var(--text-2); }
.bx .bx-rule[hidden] { display: none; }
.bx .bx-rule i { font-style: normal; }
@media (prefers-reduced-motion: reduce) { .bx .bx-tag { transition: none; } }`;

    /** BoardingParty's sheet, in tokens. Every swap must find its text: a swap that misses would leave a hand copy behind. */
    function css(base, type) {
        let out = String(base).split(type).join('');
        SWAP.forEach(([from, to]) => {
            if (!out.includes(from)) console.warn('NSBoardLook: nothing to swap for', from);
            out = out.split(from).join(to);
        });
        return out + EXTRA;
    }

    /** One room's tag over the walk picture (BoardingParty's words, in sentence case). */
    function door(d) {
        const conds = (d.conds || []).map(c => `<i class="${COND[c] || ''}">${esc(sentence(c))}</i>`).join('') + (d.jam ? `<i class="is-jam">${esc(sentence(d.jam))}</i>` : '');
        const name = `<span class="bx-tn">${esc(sentence(d.name))}</span>`;
        if (d.isHere || d.isLabel) {
            return `<span class="bx-door bx-tag is-label${d.isHere ? ' is-here' : ''}" style="${d.style}">${name}${!d.isHere && conds ? `<span class="bx-tc">${conds}</span>` : ''}</span>`;
        }
        const chip = d.isSafe ? `<kbd>${esc(d.cost)}</kbd>` : `<i class="is-far">${esc(sentence(d.far))}</i>`;
        const cls = `bx-door bx-tag${d.isSafe ? '' : ' is-stranding'}${d.isHomeward ? ' is-homeward' : ''}`;
        return `<button type="button" class="${cls}" style="${d.style}" data-to="${d.to}"${ruleAttr(d.rule ? [d.rule] : [])}${d.isOff ? ' disabled' : ''}>${name}<span class="bx-tc">${conds}${chip}</span></button>`;
    }

    // ── the walk's keys and its pointing ──
    const cased = s => (s === s.toUpperCase() ? sentence(s) : s.charAt(0).toUpperCase() + s.slice(1));   // a caps word in sentence case; a phrase gets its capital
    const ruleAttr = rules => (rules.length ? ` data-rule="${esc(rules.map(cased).join('|'))}" aria-description="${esc(rules.map(cased).join('; '))}"` : '');

    /** A walk key, the frame key: its words, its chips under them (numbers: the cost, a gain like '+20 energy'), and its rules
        (a gain in words, the risk, the heavy load), shown in the line while it is pointed at. */
    function key(k) {
        const closed = k.closed || [], isNumGain = !!k.gain && /\d/.test(k.gain), rules = (k.gain && !isNumGain ? [k.gain] : []).concat(k.rules || []);
        const chips = closed.length ? closed.map(w => `<em>${num(esc(cased(w)))}</em>`).join('')
            : `${k.cost ? `<kbd>${esc(k.cost)}</kbd>` : ''}${isNumGain ? `<b>${num(esc(k.gain))}</b>` : ''}`;
        return `<button type="button" class="mini-btn bx-key${k.cls || ''}" data-kind="${k.kind}"${closed.length ? '' : ruleAttr(rules)}${k.isOff ? ' disabled' : ''}>`
            + `<span class="bx-kw">${k.words}</span>${chips ? `<span class="bx-tc">${chips}</span>` : ''}</button>`;
    }

    /** While a key or a door with rules is pointed at, or focused from the keyboard, its rules stand in the voice line's place. */
    function point(overlay) {
        const talk = overlay.querySelector('.bx-talk'), slot = document.createElement('p');
        slot.className = 'bx-rule'; slot.hidden = true;
        if (talk) talk.appendChild(slot);
        let isQuiet = false;
        const show = target => {
            const k = target && target.closest ? target.closest('[data-rule]') : null;
            const rules = k && overlay.contains(k) && !k.disabled ? k.dataset.rule.split('|').filter(Boolean) : [];
            slot.innerHTML = rules.map(r => `<i>${num(esc(r))}</i>`).join('');
            slot.hidden = !rules.length;
            if (talk) talk.classList.toggle('is-pointing', rules.length > 0);
        };
        const byKeys = el => (el && el.matches && el.matches(':focus-visible') ? el : null);
        overlay.addEventListener('pointerover', e => show(e.target));
        overlay.addEventListener('pointerout', e => show((e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('[data-rule]')) || byKeys(document.activeElement)));
        overlay.addEventListener('focusin', e => { if (!isQuiet) show(byKeys(e.target)); });
        overlay.addEventListener('focusout', e => show(byKeys(e.relatedTarget)));
        return {
            clear: () => show(null),
            /** A focus the walk moves itself (after a redraw): the new line stays in view until the player moves on. */
            focus: el => { isQuiet = true; try { el.focus({ preventScroll: true }); } finally { isQuiet = false; } },
        };
    }

    /** The station's name tag in the picker picture's corner, how long it has been silent its chip. */
    const station = (name, silent) => `<span class="bx-tag bx-station"><span class="bx-tn">${esc(name)}</span><span class="bx-tc"><i>${num(esc(sentence(silent)))}</i></span></span>`;

    const tone = who => `var(--tone-${String(who || 'cora').replace(/[^a-z]/g, '')})`;

    window.NSBoardLook = Object.freeze({ css, door, key, point, station, sentence, num, tone });
})();
