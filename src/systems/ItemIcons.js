/* ItemIcons — every item gets a picture, and finding one is an event.
     · 12×12 pixel icons, one per item kind, with a few items drawn specially ('#' body, '+' highlight, '-' shadow)
     · a slow shine sweeps across each icon, so a full cargo hold twinkles instead of sitting there
     · hydrate(root) paints every <canvas class="item-icon" data-item-id data-item-type> under root
     · when something new lands in the hold, a card slides in: the icon, FOUND, the name
     · the new look (html.ns-on, look pass B03, C25): the icons' inks are the space ramps (tokens.css: the artifact warm-br,
       tech steel, living a muted warm, the battery warm; never purple, cyan or green), and FOUND is a mini frame docked
       beside the tower's hold deck (NSTowerCard.edge): the icon at 2x, FOUND in the who style, the name; one at a time,
       "FOUND · 3" when three came in together; at the end of its turn the icon steps into the hold
   Nothing here changes how items work. */

(function () {
    'use strict';
    const GRID = 12, SCALE = 4, TICK_MS = 120, SHINE_EVERY = 34;
    const TOAST_MS = 3600, WATCH_MS = 500, BULK_CHANGE = 4;   // more than this many new items at once is a loaded save, not a find
    const CLEAR_POLL_MS = 400;                               // the new look: how often a waiting FOUND note looks again for a clear screen

    const KIND = {
        CONSUMABLE: { ink: ['#7a4f1e', '#d9a24a', '#ffe6a0'], art: ['............', '...######...', '..#++++++#..', '..#+####+#..', '..########..', '..#------#..', '..#-####-#..', '..#-#++#-#..', '..#-####-#..', '..#------#..', '..########..', '............'] },
        ARTIFACT: { ink: ['#3a1f66', '#8844ff', '#e6dcff'], art: ['............', '.....##.....', '....#++#....', '...#++++#...', '..#++##++#..', '.#++#--#++#.', '.#++#--#++#.', '..#++##++#..', '...#----#...', '....#--#....', '.....##.....', '............'] },
        TECH: { ink: ['#1d5563', '#4fb0c8', '#d6f6ff'], art: ['............', '.#.#.#.#.#..', '.##########.', '.#++++++++#.', '.#+######+#.', '.#+#----#+#.', '.#+#-++-#+#.', '.#+#----#+#.', '.#+######+#.', '.#--------#.', '.##########.', '..#.#.#.#.#.'] },
        LIVING: { ink: ['#1c4428', '#5fae7a', '#d6ffe4'], art: ['............', '......#.....', '.....#+#....', '..#..#+#..#.', '.#+#.#+#.#+#', '.#+##+++##+#', '..#+++++++#.', '...#+++++#..', '....#+++#...', '.....###....', '....#####...', '...#######..'] },
        LORE: { ink: ['#4a4636', '#c8c2b0', '#ffffff'], art: ['............', '..########..', '.#++++++++#.', '.#+------+#.', '.#++++++++#.', '.#+-----++#.', '.#++++++++#.', '.#+------+#.', '.#++++++++#.', '.#+---++++#.', '..########..', '............'] },
        RESOURCE: { ink: ['#3a3f3c', '#8f8a7a', '#e8e4d8'], art: ['............', '............', '....####....', '...#++++#...', '..#++++--#..', '.#+++-----#.', '.#++------#.', '.#+-------#.', '..#------#..', '...######...', '............', '............'] },
        REVIVAL: { ink: ['#5a1f1b', '#d85a4e', '#ffd0c8'], art: ['............', '..##....##..', '.#++#..#++#.', '.#+++##+++#.', '.#++++++++#.', '.#++++++++#.', '..#++++++#..', '...#++++#...', '....#++#....', '.....##.....', '............', '............'] },
    };
    KIND.DOCUMENT = KIND.LORE; KIND.RESOURCE_PACK = KIND.RESOURCE; KIND.REVIVAL_BIO = KIND.REVIVAL; KIND.REVIVAL_TECH = KIND.REVIVAL;

    const SPECIAL = {
        disc_drawing: { ink: ['#4a3510', '#d9a24a', '#ffe6a0'], art: ['............', '....####....', '..##++++##..', '.#++++++++#.', '.#+++--+++#.', '#+++-##-+++#', '#+++-##-+++#', '.#+++--+++#.', '.#++++++++#.', '..##++++##..', '....####....', '............'] },
        PAGE_DISC: { ink: ['#8a6a22', '#ffd27a', '#fff4d0'], art: ['............', '....####....', '..##++++##..', '.#++-++-++#.', '.#+-+++++-#.', '#++++##++++#', '#++++##++++#', '.#+-+++++-#.', '.#++-++-++#.', '..##++++##..', '....####....', '............'] },   // the disc itself: brighter gold, the lines cut into it
        medkit: { ink: ['#7a2a24', '#e8e4d8', '#d85a4e'], art: ['............', '....####....', '..########..', '.#++++++++#.', '.#+++--+++#.', '.#+++--+++#.', '.#+------+#.', '.#+------+#.', '.#+++--+++#.', '.#+++--+++#.', '..########..', '............'] },
        ionized_battery: { ink: ['#1c4428', '#74d99a', '#d6ffe4'], art: ['............', '....####....', '...######...', '...#++++#...', '...#+--+#...', '...#+-++#...', '...#++-+#...', '...#+--+#...', '...#++++#...', '...#----#...', '...######...', '............'] },
        luxury_chocolate: { ink: ['#3a2210', '#8a5a2a', '#d9a24a'], art: ['............', '............', '.##########.', '.#++#++#++#.', '.#++#++#++#.', '.##########.', '.#++#++#++#.', '.#++#++#++#.', '.##########.', '.#--#--#--#.', '.##########.', '............'] },
    };

    /** tone 0 = edge colour, 1 = body, 2 = highlight; halves blend the two neighbours. */
    function toneColor(ink, tone) {
        const lo = Math.floor(tone), hi = Math.min(2, lo + 1), t = tone - lo;
        if (!t) return ink[lo];
        const part = (hex, i) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
        return `rgb(${[0, 1, 2].map(i => Math.round(part(ink[lo], i) + (part(ink[hi], i) - part(ink[lo], i)) * t)).join(',')})`;
    }

    // ── the new look (C25): the inks that read as old phosphor become the space ramps, from tokens.css (art, not text) ──
    const isNew = () => document.documentElement.classList.contains('ns-on');
    const SPACE = { ARTIFACT: ['--warm-br'], TECH: ['--cool'], LIVING: ['--warm', '--dim', 0.45], ionized_battery: ['--warm'] };   // [token, mixed with, by]
    const spaceLooks = new Map();
    const tok = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const rgbOf = hex => { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); return m ? [0, 2, 4].map(i => parseInt(m[1].substr(i, 2), 16)) : null; };
    const mixHex = (a, b, k) => { const x = rgbOf(a), y = rgbOf(b); return x && y ? '#' + x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, '0')).join('') : a; };
    function spaceLook(key, base) {
        if (!SPACE[key] || !isNew()) return null;
        if (spaceLooks.has(key)) return spaceLooks.get(key);
        const [name, withName, by] = SPACE[key], ink = tok('--ink'), text = tok('--text');
        let body = tok(name);
        if (withName) body = mixHex(body, tok(withName), by);
        if (!rgbOf(body) || !rgbOf(ink) || !rgbOf(text)) return null;              // the token sheet is not there yet: the old ink
        const look = { ink: [mixHex(body, ink, 0.62), body, mixHex(body, text, 0.6)], art: base.art };
        spaceLooks.set(key, look);
        return look;
    }
    const lookOf = (id, type) => {
        const base = SPECIAL[id] || KIND[type] || KIND.RESOURCE;
        return spaceLook(SPECIAL[id] ? id : type, base) || base;
    };

    function paint(canvas, look, frame) {
        const ctx = canvas.getContext('2d'), shine = frame % SHINE_EVERY, SCALE = Math.max(1, Math.round(canvas.width / GRID));   // a diagonal band of light crosses, then a long rest
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        look.art.forEach((row, y) => {
            for (let x = 0; x < GRID; x++) {
                const ch = row[x];
                if (!ch || ch === '.') continue;
                const isShining = Math.abs(x + y - shine) < 1.5;
                const tone = ch === '+' ? 1 : ch === '-' ? 0.5 : 0;               // '#' edge, '-' shaded inside, '+' lit inside
                ctx.fillStyle = toneColor(look.ink, isShining ? Math.min(2, tone + 1) : tone);
                ctx.fillRect(x * SCALE, y * SCALE, SCALE, SCALE);
            }
        });
    }

    const iconHtml = (item, scale) => `<canvas class="item-icon" width="${GRID * (scale || SCALE)}" height="${GRID * (scale || SCALE)}" data-item-id="${String(item.id || '').replace(/"/g, '')}" data-item-type="${String(item.type || '').replace(/"/g, '')}" aria-hidden="true"></canvas>`;

    const live = new Set();
    function hydrate(root) {
        (root || document).querySelectorAll('canvas.item-icon').forEach(canvas => {
            if (live.has(canvas)) return;
            canvas._look = lookOf(canvas.dataset.itemId, canvas.dataset.itemType);
            canvas._frame = Math.floor(Math.random() * SHINE_EVERY);
            live.add(canvas);
            paint(canvas, canvas._look, canvas._frame);
        });
    }
    setInterval(() => live.forEach(canvas => {
        if (!canvas.isConnected) { live.delete(canvas); return; }
        canvas._frame += 1; paint(canvas, canvas._look, canvas._frame);
    }), TICK_MS);

    // ── "FOUND" card ──
    function toast(item) {
        const show = () => {
            const stack = document.getElementById('item-toasts') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'item-toasts' }));
            const card = document.createElement('div');
            card.className = 'item-toast';
            card.innerHTML = `${iconHtml(item)}<p><b>FOUND</b>${String(item.name || 'Something').replace(/[<>&]/g, '')}</p>`;
            stack.appendChild(card);
            hydrate(card);
            setTimeout(() => { card.classList.add('is-leaving'); setTimeout(() => card.remove(), 500); }, TOAST_MS);
        };
        if (!document.documentElement.classList.contains('ns-on')) { show(); return; }
        found(item);
    }

    // ── the new look's FOUND: one mini frame at the hold deck, one find at a time, the count of finds that came together ──
    const NOTE = { FIRST_MS: 2600, NEXT_MS: 1800, INTO_MS: 4 * 125, OUT_MS: 3 * 60, ICON: 2, GAP: 12, DOCK_MS: 250 };
    const N = { queue: [], el: null, count: 0, timer: 0, dock: 0 };
    const isCalm = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    /** Never over a card, a found page, a minigame or a scene; it lands once they have gone (after any outcome still to read). */
    function whenClear(fn) {
        const busy = () => !!document.querySelector('.modal-overlay:not(.ns-held), .mini-host, .ns-film, .ns-end, .end-screen');
        const look = () => { if (busy()) setTimeout(look, CLEAR_POLL_MS); else fn(); };
        const EC = window.EncounterCard;
        if (EC && typeof EC.whenFree === 'function') EC.whenFree(look); else look();
    }
    function found(item) {
        N.queue.push(item); N.count += 1;
        if (N.el) { label(); return; }
        if (N.count === 1) whenClear(openNote);
    }
    const label = () => { const n = N.el && N.el.querySelector('.if-n'); if (n) n.textContent = N.count > 1 ? ` · ${N.count}` : ''; };
    /** Beside the hold deck while the tower is in view (NSTowerCard.edge); else the plain place, low on the right. */
    function dock() {
        const el = N.el, T = window.NSTowerCard, e = el && T && typeof T.edge === 'function' ? T.edge('hold') : null;
        if (!el) return;
        el.classList.toggle('is-docked', !!e);
        el.style.transform = e ? `translate(${e.x + NOTE.GAP}px, ${Math.round(e.y - el.offsetHeight / 2)}px)` : '';
    }
    function openNote() {
        if (N.el || !N.queue.length) return;
        const stack = document.getElementById('item-toasts') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'item-toasts' }));
        const el = document.createElement('div');
        el.className = 'item-toast is-found'; el.setAttribute('role', 'status');
        stack.appendChild(el);
        N.el = el;
        showItem(N.queue.shift(), true);
        dock();
        N.dock = setInterval(dock, NOTE.DOCK_MS);
    }
    function showItem(item, first) {
        const el = N.el;
        el.innerHTML = `${iconHtml(item, NOTE.ICON)}<p><b class="if-label">FOUND<span class="if-n"></span></b><span class="if-name">${String(item.name || 'Something').replace(/[<>&]/g, '')}</span></p>`;
        hydrate(el); label();
        el.classList.remove('is-next'); void el.offsetWidth; if (!first) el.classList.add('is-next');
        N.timer = setTimeout(stepInto, first ? NOTE.FIRST_MS : NOTE.NEXT_MS);
    }
    /** The end of a find's turn: its icon steps down into the hold (4 steps), then the next find, or the note goes. */
    function stepInto() {
        const el = N.el, icon = el && el.querySelector('canvas.item-icon'), T = window.NSTowerCard, e = T && T.edge ? T.edge('hold') : null;
        if (icon && e && !isCalm()) {
            const r = icon.getBoundingClientRect();
            icon.style.setProperty('--dx', `${Math.round(e.inX - r.left)}px`); icon.style.setProperty('--dy', `${Math.round(e.inY - r.top)}px`);
            icon.classList.add('is-into');
        }
        N.timer = setTimeout(() => { if (N.queue.length) showItem(N.queue.shift(), false); else closeNote(); }, e && !isCalm() ? NOTE.INTO_MS : 0);
    }
    function closeNote() {
        const el = N.el;
        clearInterval(N.dock);
        if (!el) return;
        el.classList.add('is-leaving');
        N.timer = setTimeout(() => { el.remove(); N.el = null; N.count = N.queue.length; if (N.queue.length) whenClear(openNote); }, NOTE.OUT_MS);
    }

    let seenCount = null;
    setInterval(() => {
        const cargo = window.app && window.app.state && window.app.state.cargo;
        if (!cargo) return;
        if (seenCount !== null && cargo.length > seenCount && cargo.length - seenCount < BULK_CHANGE) cargo.slice(seenCount).forEach(toast);
        seenCount = cargo.length;
    }, WATCH_MS);

    window.ItemIcons = { iconHtml, hydrate, found: () => (N.el ? { count: N.count, waiting: N.queue.length, docked: N.el.classList.contains('is-docked') } : null) };
})();
