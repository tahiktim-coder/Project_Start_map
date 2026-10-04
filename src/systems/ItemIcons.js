/* ItemIcons — every item gets a picture, and finding one is an event.
     · 12×12 pixel icons, one per item kind, with a few items drawn specially ('#' body, '+' highlight, '-' shadow)
     · a slow shine sweeps across each icon, so a full cargo hold twinkles instead of sitting there
     · hydrate(root) paints every <canvas class="item-icon" data-item-id data-item-type> under root
     · when something new lands in the hold, a card slides in: the icon, FOUND, the name
   Nothing here changes how items work. */

(function () {
    'use strict';
    const GRID = 12, SCALE = 4, TICK_MS = 120, SHINE_EVERY = 34;
    const TOAST_MS = 3600, WATCH_MS = 500, BULK_CHANGE = 4;   // more than this many new items at once is a loaded save, not a find

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
        briefing_tape: { ink: ['#2a2d2a', '#8f8a7a', '#d9a24a'], art: ['............', '.##########.', '.#++++++++#.', '.#+######+#.', '.#+#-##-#+#.', '.#+#-##-#+#.', '.#+######+#.', '.#++++++++#.', '.#++####++#.', '.#+#----#+#.', '.##########.', '............'] },
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

    const lookOf = (id, type) => SPECIAL[id] || KIND[type] || KIND.RESOURCE;

    function paint(canvas, look, frame) {
        const ctx = canvas.getContext('2d'), shine = frame % SHINE_EVERY;       // a diagonal band of light crosses, then a long rest
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

    const iconHtml = (item) => `<canvas class="item-icon" width="${GRID * SCALE}" height="${GRID * SCALE}" data-item-id="${String(item.id || '').replace(/"/g, '')}" data-item-type="${String(item.type || '').replace(/"/g, '')}" aria-hidden="true"></canvas>`;

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
        const stack = document.getElementById('item-toasts') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'item-toasts' }));
        const card = document.createElement('div');
        card.className = 'item-toast';
        card.innerHTML = `${iconHtml(item)}<p><b>FOUND</b>${String(item.name || 'Something').replace(/[<>&]/g, '')}</p>`;
        stack.appendChild(card);
        hydrate(card);
        setTimeout(() => { card.classList.add('is-leaving'); setTimeout(() => card.remove(), 500); }, TOAST_MS);
    }

    let seenCount = null;
    setInterval(() => {
        const cargo = window.app && window.app.state && window.app.state.cargo;
        if (!cargo) return;
        if (seenCount !== null && cargo.length > seenCount && cargo.length - seenCount < BULK_CHANGE) cargo.slice(seenCount).forEach(toast);
        seenCount = cargo.length;
    }, WATCH_MS);

    window.ItemIcons = { iconHtml, hydrate };
})();
