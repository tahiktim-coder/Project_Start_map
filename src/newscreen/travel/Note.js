/* ═══ Silent Exodus · new screen (?new=1) · travel/Note.js: the world note's words, its SCAN key, the sector title's look ══
   What it is: the DOM half of the note travel shows beside a pointed world. Travel.js says what it holds, places it (beside
   the world, off every world, the light and our Lander), paints the dither shade under it and the dotted leader from its
   first line to the world's rim. Here: its name, what kind of world it is (or why the story waits on it), then either the
   long-range scan's glass key or what the scan found; and the CSS of the note and of the sector title.
   - The SCAN key (look pass, C84; DESIGN.md §2): the bridge's glass key on the note. Amber corner brackets, the 9 x 9 scan
     icon (stop/TagArt.js), 'SCAN' in Condensed 600 caps and its cost as a Mono chip ('2 energy', --loss), all shown at rest.
     Hot (pointed at): the brackets, the icon and the label brighten. Off: the label and the chip in --dim, the brackets in
     --faint, the chip saying why ('no power', 'bridge down'). Scanning: 'SCANNING' in steel a moment, no chip.
   - The finds (WorldFinds.js noteLines): one small tag a line, the find's own icon and its name ('a clue' after it when it
     carries one), then whether people could live there. No lead-in.
   - The tower's stock readouts step out and in (4 x --step-ui): Tower.js hides them on Travel's 'jump:words', so they are
     gone before the jump's flash, and shows them once the tower has slid in again.
   One key pixel is 2 CSS px at every window size (--kp), so the icons stay whole pixels and the brackets sit on the box.
   Every colour, face and size is a tokens.css token; every change of state is a step.
   Loaded only when the new-screen switch is on, before travel/Travel.js (stop/TagArt.js, loaded later, is read when used).

   window.NSNote (frozen)
     style()                          the note's and the title's CSS, once
     fill(note, w, s) → key | null    w: { name, tag, story }; s: Travel's scan state { kind: 'offer' | 'busy' | 'facts', offer:
                                      { cost, ok, why }, lines: [{ icon, text, clue, live }] }; returns the SCAN key while it
                                      can be pressed (its offer ok), else null
     hot(key, on)                     the pointer is on the key: brackets, icon and label brighten
     lead(note) → { y, x0, x1 } | null   the first line's middle and its ends, CSS px from the note's top left (the leader's start)
*/
(function () {
    'use strict';
    // DRAFT (look pass): C84's chips for a SCAN key that is off (DESIGN.md §2: "no power", "bridge down")
    const WHY = { energy: 'no power', bridge: 'bridge down' };   // DRAFT (look pass)
    const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
    const urls = new Map();

    /** A token's value on the page (tokens.css), e.g. '--dim' → '#8b8d90'; '' when it is not there. */
    function token(name) { try { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); } catch (err) { return ''; } }
    /** A 9 x 9 icon of stop/TagArt.js as a data URL (tone: 'warm' | 'cool' | '#rrggbb'; lift: brighter), or a 5 x 5 chip icon. */
    function iconURL(name, tone, lift, chip) {
        const T = window.NSTagArt;
        if (!T) return null;
        const key = [name, tone, lift || 0, chip ? 'c' : 'i'].join('|');
        if (urls.has(key)) return urls.get(key);
        let url = null;
        try {
            if (chip) url = T.chipURL(name, tone);
            else { const c = document.createElement('canvas'); c.width = T.ICON; c.height = T.ICON; T.icon(c.getContext('2d'), name, 0, 0, tone, lift || 0); url = c.toDataURL(); }
        } catch (err) { console.error('NSNote: an icon failed', err); }
        urls.set(key, url);
        return url;
    }
    const offTone = () => (/^#[0-9a-f]{6}$/i.test(token('--dim')) ? token('--dim') : 'cool');
    function setIcon(i, url) { if (url) i.style.backgroundImage = `url(${url})`; }

    function style() {
        if (document.getElementById('ns-note-style')) return;
        const st = mk('style'); st.id = 'ns-note-style';
        st.textContent = `#ns-world-words .nst-note { --kp: 2px; position: absolute; left: 0; top: 0; display: grid; justify-items: start; gap: 3px; max-width: 24em; pointer-events: none; }
#ns-world-words .nst-note[hidden], #ns-world-words .nst-title[hidden], #ns-world-words .nst-flash[hidden] { display: none; }
#ns-world-words .nst-note.is-left { justify-items: end; text-align: right; }
#ns-world-words .nst-note .name { margin: 0; font: 500 var(--fs-note-name)/1.15 var(--f-ui); letter-spacing: 0.02em; color: var(--text); text-shadow: var(--shadow), var(--halo); }
#ns-world-words .nst-note .tag { margin: 0; font: 400 var(--fs-note-line)/1.35 var(--f-text); color: var(--dim); text-wrap: balance; text-shadow: var(--shadow), var(--halo); }
#ns-world-words .nst-note.is-story .tag { color: var(--warm-br); }
#ns-world-words .nst-key { --bk: var(--warm); --tip: var(--warm-br); --arm: calc(var(--kp) * 4); display: flex; align-items: center; gap: calc(var(--kp) * 4);
    margin: calc(var(--kp) * 3) 0 0; padding: calc(var(--kp) * 3) calc(var(--kp) * 7) calc(var(--kp) * 3) calc(var(--kp) * 3); text-shadow: var(--shadow);
    background: linear-gradient(var(--tip) 0 0) left top / var(--kp) var(--kp), linear-gradient(var(--tip) 0 0) right top / var(--kp) var(--kp),
        linear-gradient(var(--tip) 0 0) left bottom / var(--kp) var(--kp), linear-gradient(var(--tip) 0 0) right bottom / var(--kp) var(--kp),
        linear-gradient(var(--bk) 0 0) left top / var(--arm) var(--kp), linear-gradient(var(--bk) 0 0) left top / var(--kp) var(--arm),
        linear-gradient(var(--bk) 0 0) right top / var(--arm) var(--kp), linear-gradient(var(--bk) 0 0) right top / var(--kp) var(--arm),
        linear-gradient(var(--bk) 0 0) left bottom / var(--arm) var(--kp), linear-gradient(var(--bk) 0 0) left bottom / var(--kp) var(--arm),
        linear-gradient(var(--bk) 0 0) right bottom / var(--arm) var(--kp), linear-gradient(var(--bk) 0 0) right bottom / var(--kp) var(--arm);
    background-repeat: no-repeat; }
#ns-world-words .nst-key i, #ns-world-words .nst-find i { flex: none; width: calc(var(--kp) * 9); height: calc(var(--kp) * 9); background: center / 100% 100% no-repeat; image-rendering: pixelated; }
#ns-world-words .nst-key b { font: 600 var(--fs-tag)/calc(var(--kp) * 9) var(--f-ui); letter-spacing: 0.16em; text-transform: uppercase; color: var(--warm); }
#ns-world-words .nst-key span { font: 400 var(--fs-chip)/calc(var(--kp) * 9) var(--f-num); color: var(--loss); }
#ns-world-words .nst-key.is-hot { --bk: var(--warm-br); --tip: var(--text); }
#ns-world-words .nst-key.is-hot b { color: var(--warm-br); }
#ns-world-words .nst-key.is-off { --bk: var(--faint); --tip: var(--dim); }
#ns-world-words .nst-key.is-off b, #ns-world-words .nst-key.is-off span { color: var(--dim); }
#ns-world-words .nst-key.is-busy { --bk: var(--cool); --tip: var(--text); }
#ns-world-words .nst-key.is-busy b { color: var(--cool); }
#ns-world-words .nst-finds { list-style: none; margin: calc(var(--kp) * 2) 0 0; padding: 0; display: grid; gap: var(--kp); justify-items: start; }
#ns-world-words .nst-note.is-left .nst-finds { justify-items: end; }
#ns-world-words .nst-find { display: flex; align-items: center; gap: calc(var(--kp) * 3); font: 500 var(--fs-chip)/calc(var(--kp) * 9) var(--f-ui); letter-spacing: 0.03em; color: var(--cool); text-shadow: var(--shadow), var(--halo); }
#ns-world-words .nst-find.is-live { color: var(--ui); }
#ns-world-words .nst-find.is-live i { background-size: calc(var(--kp) * 5) calc(var(--kp) * 5); }
#ns-world-words .nst-find em { font-style: normal; color: var(--warm-br); }
#ns-root #ns-ship-words .nss { transition: opacity calc(4 * var(--step-ui)) steps(4, end); }
#ns-world-words .nst-title { position: absolute; left: 0; top: 0; margin: 0; font: 300 var(--fs-place)/1 var(--f-text); letter-spacing: 0.2em; color: var(--text); white-space: nowrap; text-shadow: var(--shadow), var(--halo); pointer-events: none; }`;
        document.head.appendChild(st);
    }

    /** The SCAN key: the offer (pressable, or off with why), or 'Scanning' a moment. */
    function keyEl(s) {
        const busy = s.kind === 'busy', off = !busy && !(s.offer && s.offer.ok), tone = busy ? 'cool' : off ? offTone() : 'warm';
        const el = mk('p', 'scan nst-key' + (busy ? ' is-busy' : off ? ' is-off' : '')), i = mk('i');
        el.dataset.icon = iconURL('scan', tone, 0) || '';
        el.dataset.iconHot = iconURL('scan', tone, 1) || '';
        setIcon(i, el.dataset.icon);
        el.append(i, mk('b', null, busy ? 'Scanning' : 'Scan'));
        if (!busy) el.append(mk('span', null, s.offer.ok ? `${s.offer.cost} energy` : WHY[s.offer.why] || ''));
        return el;
    }
    /** What a scan found: one tag a line (the find's icon and name, 'a clue'), then whether people could live there. */
    function findsEl(lines) {
        const ul = mk('ul', 'nst-finds');
        lines.forEach(raw => {
            const l = typeof raw === 'string' ? { text: raw } : raw || {}, li = mk('li', 'nst-find' + (l.live ? ' is-live' : '')), i = mk('i');
            setIcon(i, l.live ? iconURL('live', 'cool', 0, true) : iconURL(l.icon || 'pin', 'cool', 0));
            li.append(i, document.createTextNode(l.text || ''));
            if (l.clue) li.append(mk('em', null, l.clue));
            ul.append(li);
        });
        return ul;
    }
    function fill(note, w, s) {
        const kids = [mk('p', 'name', w.name), mk('p', 'tag', w.tag)], st = s || {};
        let key = null;
        if (st.kind === 'offer' || st.kind === 'busy') { key = keyEl(st); kids.push(key); }
        else if (st.kind === 'facts' && st.lines && st.lines.length) kids.push(findsEl(st.lines));
        note.replaceChildren(...kids);
        note.classList.toggle('is-story', !!w.story);
        return st.kind === 'offer' && st.offer && st.offer.ok ? key : null;
    }
    function hot(key, on) {
        if (!key || key.classList.contains('is-hot') === !!on) return;
        key.classList.toggle('is-hot', !!on);
        const i = key.querySelector('i');
        if (i) setIcon(i, on ? key.dataset.iconHot : key.dataset.icon);
    }
    function lead(note) {
        const n = note && note.querySelector('.name');
        if (!n || !n.offsetWidth) return null;
        return { y: n.offsetTop + n.offsetHeight / 2, x0: n.offsetLeft, x1: n.offsetLeft + n.offsetWidth };
    }

    window.NSNote = Object.freeze({ style, fill, hot, lead, WHY });
})();
