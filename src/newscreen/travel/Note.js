/* ═══ Silent Exodus · new screen (?new=1) · travel/Note.js: the world note's words, its SCAN key, the sector title's look ══
   What it is: the DOM half of the note travel shows beside a pointed world. Travel.js says what it holds, places it (beside
   the world, off every world, the light and our Lander), paints the dither shade under it and the dotted leader from its
   first line to the world's rim (worked out here: leader()). Here: its name, what kind of world it is (or why the story
   waits on it), then either the long-range scan's glass key or what the scan found; a refusal's numbers beside a world;
   and the CSS of the note, of the sector title and of the tower's stock stepping out for the jump.
   - The SCAN key (look pass, C84; DESIGN.md §2): the bridge's glass key on the note. Amber corner brackets, the 9 x 9 scan
     icon (stop/TagArt.js), 'SCAN' in Condensed 600 caps and its cost as a Mono chip ('2 energy', --loss: tokens.css's
     colour of every cost), all shown at rest. Hot (pointed at): the brackets, the icon and the label brighten. Off: the
     label and the chip in --dim, the brackets in --faint, the chip saying why: the numbers when it is the energy ('1 of 2
     energy': what we have of what it costs, as the tower reads), 'bridge down'. Scanning: 'SCANNING' in steel a moment.
   - The finds (WorldFinds.js noteLines): one small tag a line, the find's own icon and its name ('a clue' after it when it
     carries one), then whether people could live there. No lead-in. In a note left of its world the icons stand at the
     right end, so they still make one column.
   - A refusal for energy (Travel.js updateRefusal): A.U.R.A.'s own line says no; beside the world's blinking ring a Mono
     chip says the numbers ('1 of 3 energy'), with the energy chip icon, in --loss.
   - The tower's stock readouts step out (4 x --step-ui) for the jump: Tower.js hides them on Travel's 'jump:words' and
     Travel puts .is-jump-out on #ns-ship-words until the next sector shows, so only that fade steps (and none under
     reduced motion); every other fade of the stock is the tower's own.
   One key pixel is 2 CSS px at every window size (--kp), so the icons stay whole pixels and the brackets sit on the box.
   Every colour, face and size is a tokens.css token; every change of state is a step.
   Loaded only when the new-screen switch is on, before travel/Travel.js (stop/TagArt.js, loaded later, is read when used).

   window.NSNote (frozen)
     style()                          the note's and the title's CSS, once
     fill(note, w, s) → key | null    w: { name, tag, story }; s: Travel's scan state { kind: 'offer' | 'busy' | 'facts', offer:
                                      { cost, ok, why, have }, lines: [{ icon, text, clue, live }] }; returns the SCAN key
                                      while it can be pressed (its offer ok), else null
     hot(key, on)                     the pointer is on the key: brackets, icon and label brighten
     leader(note, g, box, u, hex, th) → [from, to, hex, th] | null   the dotted leader (art px) from the note's first line to
                                      the rim of world g { x, y, r }; box: the note (art px); u: art px per CSS px
     refusal(el, have, cost)          fill a refusal's chip ('1 of 3 energy')
     color(name) → '#rrggbb' | ''     a colour token as a canvas needs it (read once; '' when it is missing: not drawn)
*/
(function () {
    'use strict';
    // DRAFT (look pass): C84's chip for a SCAN key that is off (DESIGN.md §2: "bridge down"; off for energy, the chip says the numbers)
    const WHY = { bridge: 'bridge down' };   // DRAFT (look pass)
    const ENERGY_OF = (have, cost) => `${have} of ${cost} energy`;   // DRAFT (look pass): what we have of what it costs (a chip)
    const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
    const urls = new Map(), colors = new Map();

    /** A token's value on the page (tokens.css), e.g. '--dim' → '#8b8d90'; '' when it is not there. */
    function token(name) { try { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); } catch (err) { return ''; } }
    function color(name) {
        if (!colors.has(name)) { const v = token(name); if (!/^#[0-9a-f]{6}$/i.test(v)) return ''; colors.set(name, v); }   // not kept while missing (the sheet may still load)
        return colors.get(name);
    }
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
    const offTone = () => color('--dim') || 'cool';
    function setIcon(i, url) { if (url) i.style.backgroundImage = `url(${url})`; }

    function style() {
        if (document.getElementById('ns-note-style')) return;
        const st = mk('style'); st.id = 'ns-note-style';
        st.textContent = `#ns-world-words .nst-note { --kp: 2px; position: absolute; left: 0; top: 0; display: grid; justify-items: start; gap: 3px; max-width: 24em; pointer-events: none; }
#ns-world-words .nst-note[hidden], #ns-world-words .nst-title[hidden], #ns-world-words .nst-flash[hidden], #ns-world-words .nst-cost[hidden] { display: none; }
#ns-world-words .nst-note.is-left { justify-items: end; text-align: right; }
#ns-world-words .nst-note .name { margin: 0; font: 500 var(--fs-note-name)/1.15 var(--f-ui); letter-spacing: 0.02em; color: var(--text); white-space: nowrap; text-shadow: var(--shadow), var(--halo); }   /* a world's name stays on one row: "Pallas-17 Major" broke at its hyphen (playtest 2026-11-07) */
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
#ns-world-words .nst-note.is-left .nst-find { flex-direction: row-reverse; }
#ns-world-words .nst-find.is-live { color: var(--ui); }
#ns-world-words .nst-find.is-live i { background-size: calc(var(--kp) * 5) calc(var(--kp) * 5); }
#ns-world-words .nst-find em { margin-left: calc(var(--kp) * 3); font-style: normal; color: var(--warm-br); }
#ns-world-words .nst-cost { --kp: 2px; position: absolute; left: 0; top: 0; margin: 0; display: flex; align-items: center; gap: calc(var(--kp) * 3); font: 400 var(--fs-chip)/calc(var(--kp) * 9) var(--f-num); color: var(--loss); white-space: nowrap; text-shadow: var(--shadow), var(--halo); pointer-events: none; }
#ns-world-words .nst-cost i { flex: none; width: calc(var(--kp) * 5); height: calc(var(--kp) * 5); background: center / 100% 100% no-repeat; image-rendering: pixelated; }
#ns-root #ns-ship-words.is-jump-out .nss { transition: opacity calc(4 * var(--step-ui)) steps(4, end); }
@media (prefers-reduced-motion: reduce) { #ns-root #ns-ship-words.is-jump-out .nss { transition: none; } }
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
        if (!busy) el.append(mk('span', null, chipOf(s.offer)));
        return el;
    }
    /** The key's chip: its cost; off, why: the numbers (short of energy) or the bridge. */
    function chipOf(o) {
        if (o.ok) return `${o.cost} energy`;
        return o.why === 'energy' && Number.isFinite(o.have) ? ENERGY_OF(o.have, o.cost) : WHY[o.why] || '';
    }
    /** What a scan found: one tag a line (the find's icon and name, 'a clue'), then whether people could live there. */
    function findsEl(lines) {
        const ul = mk('ul', 'nst-finds');
        lines.forEach(raw => {
            const l = typeof raw === 'string' ? { text: raw } : raw || {}, li = mk('li', 'nst-find' + (l.live ? ' is-live' : '')), i = mk('i'), words = mk('span', null, l.text || '');
            setIcon(i, l.live ? iconURL('live', 'cool', 0, true) : iconURL(l.icon || 'pin', 'cool', 0));
            if (l.clue) words.append(mk('em', null, l.clue));
            li.append(i, words);
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
    /** The leader never crosses the note's words: beside the world, from the end of the note's first line nearest it; under
        the world, from above that line; above the world, from the note's lower edge. It runs to the rim on the way to the
        world's centre; null when they nearly touch. */
    function leader(note, g, box, u, hex, th) {
        const n = note && note.querySelector('.name');
        if (!n || !n.offsetWidth || !hex) return null;
        const y = box.y + (n.offsetTop + n.offsetHeight / 2) * u, x0 = box.x + n.offsetLeft * u, x1 = x0 + n.offsetWidth * u, gap = 3, cl = (v, a, b) => Math.max(a, Math.min(b, v));
        const below = g.y - g.r * 0.5 > box.y + box.h, above = g.y + g.r * 0.5 < box.y;
        const [sx, sy] = below ? [cl(g.x, box.x, box.x + box.w), box.y + box.h + gap] : above ? [cl(g.x, x0, x1), box.y - gap]
            : g.x < x0 ? [x0 - gap, y] : [x1 + gap, y];
        const dx = sx - g.x, dy = sy - g.y, d = Math.hypot(dx, dy);
        if (d < g.r + 6) return null;
        return [[Math.round(sx), Math.round(sy)], [Math.round(g.x + dx / d * (g.r + 2)), Math.round(g.y + dy / d * (g.r + 2))], hex, th];
    }
    function refusal(el, have, cost) {
        const text = ENERGY_OF(have, cost);
        if (el.dataset.text === text) return;
        const i = mk('i');
        setIcon(i, iconURL('energy', color('--loss') || 'warm', 0, true));
        el.replaceChildren(i, mk('span', null, text));
        el.dataset.text = text;
    }

    window.NSNote = Object.freeze({ style, fill, hot, leader, refusal, color, WHY });
})();
