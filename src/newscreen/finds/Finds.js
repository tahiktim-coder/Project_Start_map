/* ═══ Silent Exodus · new screen (?new=1) · finds/Finds.js: every find shown as the thing itself ═════════════════════════
   What it is: in the new look a found page is the object, big, with its words on it (FoundPage.js and DiscDocument.js ask
   for a view here and keep their own pacing, guards and closing):
     a printed page (kind 'paper')  the page itself, turned a little, Earth's letterhead and a stamp, the lines typed on it
     a captain's log (kind 'log')   a dead ship's log screen in its housing, the lines typed out in phosphor with a cursor
     the crew plate (kind 'plate')  the names cast into the metal, a slow glint; its three lines quietly under it
     the disc drawing / the disc    the disc in pencil on a logbook page, or the gold disc itself; the notes are written on the
                                    page (cut fine beside the gold) with thin lines to the parts; pointing at a part lights it
   The pictures come from finds/FindArt.js. Every word is laid out from the start (hidden until its turn), so nothing moves.
   Loaded only when the new-screen switch is on, after finds/FindArt.js.

   window.NSFinds (frozen)
     isOn()                                     true in the new look, with the art loaded
     page(page, { shipName, lineMs })           → view    a found page from EXODUS_LOGS
     disc({ real, notes, lineMs })              → view    the disc drawing (DiscDocument.NOTES) or the disc (REAL_NOTES)
     said(app, speaker, textHtml)               → html    the face, the name in their colour, the line (EncounterCard's look)
     pace(view, overlay, lineMs, onAllIn)       → showAll   one line a turn, a click on the thing for the rest at once
   A view: { el, steps, mount(), reveal(i, done), finish(), destroy() }. el goes in the card; mount() once it is on the page;
   reveal(i) brings in line i and calls done() once it is all there; finish() shows everything at once.
*/
(function () {
    'use strict';
    const ART = 2;                                              // CSS px per art pixel
    const TYPE_TICK_MS = 16, TYPE_SHARE = 0.72, TYPE_MS = [6, 24];   // a line types out inside about three quarters of its turn
    const TICK_MS = 125, LED_MS = 200, RESIZE_MS = 140, PEN_MS = 420;
    const PAPER_LOOK = { PAGE_VAULT: { seed: 7, corner: 'br' }, PAGE_MEMO: { seed: 19, corner: 'bl', staple: true } };
    // where the notes sit on the logbook page (fractions of the page) and beside the gold disc
    const SKETCH = { cx: 0.47, cy: 0.585, r: 0.3, marginX: 0.045, headY: 0.17, rule: 0.058 };
    const SKETCH_NOTES = { figures: [0.705, 0.2, 0.26], disc: [0.705, 0.6, 0.26], map: [0.062, 0.46, 0.218], margin: [0.075, 0.032, 0.6] };
    const GOLD_NOTES = { figures: ['right', 0.24], disc: ['right', 0.62], map: ['left', 0.5] };

    const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const A = () => window.NSFindArt, Pt = () => window.NSPaint;
    const isOn = () => !!(window.NSFindArt && window.NSPaint && document.documentElement.classList.contains('ns-on'));
    const isReduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    /** A canvas sized to a CSS box at a whole number of device pixels per art pixel, so the pixels stay square and sharp. */
    function fitCanvas(canvas, cssW, cssH) {
        const dpr = window.devicePixelRatio || 1, k = Math.max(1, Math.round(ART * dpr)), unit = k / dpr;
        const W = Math.max(1, Math.round(cssW / unit)), H = Math.max(1, Math.round(cssH / unit));
        canvas.width = W; canvas.height = H; canvas.style.width = `${W * unit}px`; canvas.style.height = `${H * unit}px`;
        return { W, H, unit };
    }
    /** Redraws when the box changes size (a window resized), a little after it stops changing. */
    function onResize(el, draw) {
        if (typeof ResizeObserver !== 'function') return () => {};
        let timer = null, last = '';
        const ro = new ResizeObserver(() => { const key = `${el.offsetWidth}x${el.offsetHeight}`; if (key === last) return; last = key; clearTimeout(timer); timer = setTimeout(draw, RESIZE_MS); });
        ro.observe(el);
        last = `${el.offsetWidth}x${el.offsetHeight}`;
        return () => { ro.disconnect(); clearTimeout(timer); };
    }
    /** The words stay on the thing. When a small window cannot hold them at full size, the type steps down (to MIN_TYPE_PX at
        the least), then the thing grows a little taller (grow(px over)); the picture follows through its own resize watch. */
    const MIN_TYPE_PX = 13;
    function fitWords(sizeEl, box, grow) {
        sizeEl.style.fontSize = '';
        const over = () => box.scrollHeight - box.clientHeight;
        let px = parseFloat(getComputedStyle(sizeEl).fontSize) || 16;
        while (over() > 1 && px > MIN_TYPE_PX) { px = Math.max(MIN_TYPE_PX, px - 0.5); sizeEl.style.fontSize = `${px}px`; }
        if (over() > 1) grow(over());
    }
    /** A loop that runs while its element is on the page (it may be built before it is attached: it waits for that). */
    function loop(el, ms, fn) {
        let wasOn = false;
        const timer = setInterval(() => { if (el.isConnected) { wasOn = true; fn(); } else if (wasOn) clearInterval(timer); }, ms);
        return () => clearInterval(timer);
    }

    // ── the words: one span per character, every one in its place from the start ──
    /** Typed ink is never quite even: some letters struck lighter, a few a hair off the line. */
    function charsHtml(text, seed, isInked) {
        const rand = Pt().seeded(seed);
        return [...String(text)].map(ch => {
            const r = rand(), r2 = rand();
            const style = !isInked ? '' : r < 0.2 ? ` style="opacity:${(0.7 + r2 * 0.22).toFixed(2)}"` : r > 0.95 ? ` style="top:${r2 < 0.5 ? '-0.6' : '0.6'}px"` : '';
            return `<span class="find-ch"${style}>${esc(ch)}</span>`;
        }).join('');
    }
    function linesHtml(lines, seed, isInked, marked) {
        return lines.map((line, i) => `<p class="find-line${i === marked ? ' is-marked' : ''}">${charsHtml(line, seed + i * 31, isInked)}</p>`).join('');
    }
    /** Types lines out, each in its turn: a line's letters come at a steady rate that ends inside its share of the turn. */
    function typer(lineEls, lineMs, onTick) {
        const all = lineEls.map(el => ({ chars: [...el.querySelectorAll('.find-ch')], shown: 0, start: 0, ms: 0, done: null }));
        const typing = new Set();
        let timer = null, last = null;
        const show = (L, upto) => { while (L.shown < upto) { last = L.chars[L.shown++]; last.classList.add('is-on'); } };
        const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
        function tick() {
            const now = performance.now();
            typing.forEach(L => {
                show(L, Math.min(L.chars.length, Math.floor((now - L.start) / L.ms) + 1));
                if (L.shown < L.chars.length) return;
                typing.delete(L);
                const done = L.done; L.done = null; if (done) done();
            });
            if (onTick) onTick(last, typing.size > 0);
            if (!typing.size) stop();
        }
        return {
            type(i, done) {
                const L = all[i];
                if (!L) { if (done) done(); return; }
                L.start = performance.now(); L.ms = Math.max(TYPE_MS[0], Math.min(TYPE_MS[1], TYPE_SHARE * lineMs / Math.max(1, L.chars.length))); L.done = done;
                typing.add(L);
                if (!timer) timer = setInterval(tick, TYPE_TICK_MS);
                tick();
            },
            finish() { all.forEach(L => { show(L, L.chars.length); L.done = null; }); typing.clear(); stop(); if (onTick) onTick(last, false); },
            stop,
            last: () => last,
        };
    }

    // ── the spoken line under a find ──
    function memberFor(app, speaker) {
        const crew = (app && app.state && app.state.crew) || [], last = String(speaker).split(' ').pop().toLowerCase();
        return crew.find(m => m.name === speaker) || crew.find(m => m.name && m.name.toLowerCase().includes(last)) || null;
    }
    /** EncounterCard's spoken line: the face, the first name in their colour (cards.css turns it to the new tones), the line. */
    function said(app, speaker, textHtml) {
        const isAura = speaker === 'A.U.R.A.', member = isAura ? null : memberFor(app, speaker), name = (member && member.name) || speaker;
        const colors = (window.EncounterCard && window.EncounterCard.SPEAKER_COLORS) || {}, color = colors[name] || 'var(--bone)';
        const face = isAura ? '<span class="enc-face enc-face-aura">AI</span>'
            : member && member.portraitId ? `<img class="enc-face" src="assets/crew/${esc(member.portraitId)}.png" alt="">` : '<span class="enc-face"></span>';
        return `${face}<p><b style="color:${color}">${esc(name)}</b>${textHtml}</p>`;
    }

    // ── a printed page ──
    let stampMaskUrl = null;
    /** A rubber stamp never inks evenly: a mask with worn patches and speckle, made once. */
    function stampMask() {
        if (stampMaskUrl) return stampMaskUrl;
        const N = 256, c = document.createElement('canvas'), P = Pt(); c.width = N; c.height = N;
        const g = c.getContext('2d'), img = g.createImageData(N, N);
        for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
            const cov = P.fbm(x / 11, y / 9, 71, 3) + (P.hash(x, y, 72) - 0.5) * 0.42;
            img.data[(y * N + x) * 4 + 3] = cov > 0.36 ? 255 : cov > 0.3 ? 110 : 0;
        }
        g.putImageData(img, 0, 0);
        stampMaskUrl = c.toDataURL();
        return stampMaskUrl;
    }
    function drawEmblem(canvas) {
        const e = A().emblem(), g = canvas.getContext('2d'), P = Pt();
        canvas.width = e.N; canvas.height = e.N;
        e.cells.forEach(([x, y]) => { g.fillStyle = P.hash(x, y, 81) < 0.12 ? 'rgba(37, 52, 90, 0.62)' : '#25345a'; g.fillRect(x, y, 1, 1); });
    }
    /** The rows a line takes on the page, measured from its letters (layout values: the page's own turn does not change them). */
    function rowsOf(lineEl) {
        const rows = [];
        lineEl.querySelectorAll('.find-ch').forEach(ch => {
            if (!ch.textContent.trim()) return;
            const top = ch.offsetTop, left = ch.offsetLeft, right = left + ch.offsetWidth, bottom = top + ch.offsetHeight;
            const row = rows.find(r => Math.abs(r.top - top) < 4);
            if (row) { row.left = Math.min(row.left, left); row.right = Math.max(row.right, right); row.bottom = Math.max(row.bottom, bottom); }
            else rows.push({ top, left, right, bottom });
        });
        return rows;
    }
    /** Somebody's pen under a line: one quick, uneven stroke under each row it takes. */
    function penPaths(rows, seed) {
        const rand = Pt().seeded(seed);
        return rows.map(row => {
            const y0 = row.bottom - 1.5 + rand() * 1.2, x0 = row.left - 2 - rand() * 5, x1 = row.right + 1 + rand() * 7, slope = (rand() - 0.5) * 3.2;
            const n = Math.max(3, Math.round((x1 - x0) / 24));
            let d = `M${x0.toFixed(1)} ${y0.toFixed(1)}`;
            for (let k = 1; k <= n; k++) d += ` L${(x0 + (x1 - x0) * k / n).toFixed(1)} ${(y0 + slope * k / n + (rand() - 0.5) * 1.5).toFixed(1)}`;
            return d;
        });
    }
    function paperView(page, o) {
        const el = document.createElement('div'), lines = page.lines || [], look = PAPER_LOOK[page.id] || { seed: 11, corner: 'br' };
        el.className = 'find-stage';
        el.innerHTML = `
            <div class="find-object find-paper">
                <canvas class="find-art" aria-hidden="true"></canvas>
                <div class="find-face" aria-hidden="true">
                    ${page.letterhead ? `<header class="find-letterhead"><canvas class="find-emblem"></canvas><span>${esc(page.letterhead)}</span></header>` : ''}
                    <div class="find-typed">${linesHtml(lines, 101, true, page.underlined)}</div>
                    <svg class="find-pen"></svg>
                    ${page.stamp ? `<p class="find-stamp${page.stamp.length > 12 ? ' is-long' : ''}">${esc(page.stamp)}</p>` : ''}
                </div>
                <div class="find-sr">${[page.letterhead, page.stamp, ...lines].filter(Boolean).map(t => `<p>${esc(t)}</p>`).join('')}</div>
            </div>`;
        const obj = el.querySelector('.find-object'), art = el.querySelector('.find-art'), pen = el.querySelector('.find-pen');
        const lineEls = [...el.querySelectorAll('.find-line')], t = typer(lineEls, o.lineMs);
        let penShown = false, unwatch = () => {};
        const stamp = el.querySelector('.find-stamp');
        if (stamp) { const url = `url(${stampMask()})`; stamp.style.webkitMaskImage = url; stamp.style.maskImage = url; }
        function drawPen(isNow) {
            const line = lineEls[page.underlined];
            if (!line) return;
            penShown = true;
            pen.setAttribute('viewBox', `0 0 ${obj.offsetWidth} ${obj.offsetHeight}`);
            pen.innerHTML = penPaths(rowsOf(line), 404).map(d => `<path d="${d}"/>`).join('');
            [...pen.querySelectorAll('path')].forEach((path, i) => {
                if (isNow || isReduced()) return;
                const len = path.getTotalLength();
                path.style.strokeDasharray = `${len}`; path.style.strokeDashoffset = `${len}`;
                path.getBoundingClientRect();
                path.style.transition = `stroke-dashoffset ${PEN_MS}ms cubic-bezier(0.4, 0, 0.2, 1) ${i * (PEN_MS - 120)}ms`;
                path.style.strokeDashoffset = '0';
            });
        }
        function draw() {
            const w = obj.offsetWidth, h = obj.offsetHeight;
            if (!w || !h) return;
            const fit = fitCanvas(art, w, h), pic = A().paper(fit.W, fit.H, look);
            art.getContext('2d').putImageData(new ImageData(pic.data, fit.W, fit.H), 0, 0);
            if (penShown) drawPen(true);
        }
        /** Every typed line on the paper, whatever the window: smaller type first, then a taller page. */
        function fitPaper() {
            const face = el.querySelector('.find-face');
            obj.style.height = '';
            fitWords(obj, face, over => { obj.style.height = `${obj.offsetHeight + over + 6}px`; });
        }
        return {
            el, steps: lines.length,
            mount() {
                const emblem = el.querySelector('.find-emblem');
                if (emblem) drawEmblem(emblem);
                fitPaper(); draw();
                unwatch = onResize(obj, () => { fitPaper(); draw(); });
                if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { fitPaper(); draw(); });   // the typewriter face arrived: measure again
            },
            reveal(i, done) { t.type(i, () => { if (i === page.underlined) drawPen(false); if (done) done(); }); },
            finish() { t.finish(); if (page.underlined != null && lineEls[page.underlined]) drawPen(true); },
            destroy() { t.stop(); unwatch(); },
        };
    }

    // ── a captain's log ──
    function logView(page, o) {
        const el = document.createElement('div'), lines = page.lines || [];
        el.className = 'find-stage';
        el.innerHTML = `
            <div class="find-object find-log">
                <canvas class="find-art" aria-hidden="true"></canvas>
                <div class="find-glass" aria-hidden="true">
                    <div class="find-screen">
                        <p class="find-log-head"><span>${esc(page.logTitle)}</span><span>${esc(o.shipName)}</span></p>
                        <div class="find-typed">${linesHtml(lines, 211, false)}</div>
                        <i class="find-cursor"></i>
                    </div>
                </div>
                <div class="find-sr">${[page.logTitle, o.shipName, ...lines].map(x => `<p>${esc(x)}</p>`).join('')}</div>
            </div>`;
        const obj = el.querySelector('.find-object'), art = el.querySelector('.find-art'), glass = el.querySelector('.find-glass');
        const cursor = el.querySelector('.find-cursor'), lineEls = [...el.querySelectorAll('.find-line')];
        const place = (ch, isTyping) => {
            const first = el.querySelector('.find-ch');
            const at = ch || first;
            if (!at) return;
            const x = ch ? at.offsetLeft + at.offsetWidth : at.offsetLeft, y = at.offsetTop;
            cursor.style.transform = `translate(${x}px, ${y}px)`;
            cursor.classList.toggle('is-typing', !!isTyping);
        };
        const t = typer(lineEls, o.lineMs, place);
        let g = null, fit = null, stopLed = () => {}, unwatch = () => {};
        function draw() {
            const w = obj.offsetWidth, h = obj.offsetHeight;
            if (!w || !h) return;
            fit = fitCanvas(art, w, h);
            const W = fit.W, H = fit.H, gx = Math.round(W * 0.068), gy = Math.round(H * 0.08);
            g = { x: gx, y: gy, w: W - 2 * gx, h: H - gy - Math.round(H * 0.155) };
            Object.assign(glass.style, { left: `${g.x * fit.unit}px`, top: `${g.y * fit.unit}px`, width: `${g.w * fit.unit}px`, height: `${g.h * fit.unit}px` });
            art.getContext('2d').putImageData(new ImageData(A().bezel(W, H, g).data, W, H), 0, 0);
            A().led(art.getContext('2d'), g, W, H, performance.now());
            place(t.last(), false);
        }
        /** Every line on the screen, whatever the window: smaller type first, then a taller housing (the glass is ~0.77 of it). */
        function fitScreen() {
            const screen = el.querySelector('.find-screen');
            obj.style.height = ''; draw();
            fitWords(screen, screen, over => { obj.style.height = `${obj.offsetHeight + Math.ceil(over / 0.765) + 6}px`; draw(); });
        }
        return {
            el, steps: lines.length,
            mount() {
                fitScreen();
                unwatch = onResize(obj, () => { fitScreen(); });
                stopLed = loop(obj, LED_MS, () => { if (g) A().led(art.getContext('2d'), g, fit.W, fit.H, performance.now()); });
                if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { fitScreen(); place(t.last(), false); });
            },
            reveal(i, done) { t.type(i, done); },
            finish() { t.finish(); },
            destroy() { t.stop(); stopLed(); unwatch(); },
        };
    }

    // ── the crew plate ──
    function plateView(page) {
        const el = document.createElement('div'), lines = page.lines || [];
        el.className = 'find-stage';
        el.innerHTML = `
            <div class="find-object find-plate">
                <canvas class="find-art" aria-hidden="true"></canvas>
                <ul class="find-sr">${(page.names || []).map(n => `<li>${n ? esc(n) : '— blank —'}</li>`).join('')}</ul>
            </div>
            <div class="find-quiet" aria-live="polite">${lines.map(l => `<p class="find-line">${esc(l)}</p>`).join('')}</div>`;
        const obj = el.querySelector('.find-object'), art = el.querySelector('.find-art'), lineEls = [...el.querySelectorAll('.find-quiet .find-line')];
        let pic = null, img = null, base = null, startedAt = performance.now(), stopGlint = () => {}, unwatch = () => {};
        const paint = () => { if (!pic) return; A().plateGlint(img, base, pic.vals, img.width, img.height, isReduced() ? A().GLINT_MS - 1 : performance.now() - startedAt); art.getContext('2d').putImageData(img, 0, 0); };
        function draw() {
            const w = obj.offsetWidth, h = obj.offsetHeight;
            if (!w || !h) return;
            const fit = fitCanvas(art, w, h);
            pic = A().plate(fit.W, fit.H, page.names);
            base = new Uint8ClampedArray(pic.p.data);
            img = new ImageData(fit.W, fit.H);
            paint();
        }
        return {
            el, steps: lines.length,
            mount() { draw(); unwatch = onResize(obj, draw); if (!isReduced()) stopGlint = loop(obj, TICK_MS, paint); },
            reveal(i, done) { if (lineEls[i]) lineEls[i].classList.add('is-in'); if (done) done(); },
            finish() { lineEls.forEach(li => li.classList.add('is-in')); },
            destroy() { stopGlint(); unwatch(); },
        };
    }

    // ── the disc: the drawing in pencil, or the gold itself ──
    /** The pen margin note and the pencilled labels are laid word by word, each a little off true, as a hand puts them down. */
    function handHtml(text, seed, wobble) {
        const rand = Pt().seeded(seed);
        return String(text).split(' ').map(w => `<span style="transform:rotate(${((rand() - 0.5) * wobble).toFixed(2)}deg) translateY(${((rand() - 0.5) * wobble * 0.6).toFixed(2)}px)">${esc(w)}</span>`).join(' ');
    }
    function noteHtml(n, i, isReal) {
        if (n.key === 'margin') return `<button class="find-note is-pen" data-key="margin" type="button" aria-label="${esc(n.label)}: ${esc(n.text)}"><span>${handHtml(n.text, 61, 2.2)}</span></button>`;
        const body = isReal ? `<b>${esc(n.label)}</b><span>${esc(n.text)}</span>` : `<b>${handHtml(n.label, 70 + i, 0.9)}</b><span>${handHtml(n.text, 80 + i, 0.55)}</span>`;
        return `<button class="find-note" data-key="${esc(n.key)}" type="button">${body}</button>`;
    }
    /** A pencil line from a note to its part: a little bowed, with a small arrowhead at the part. */
    function pencilLeader(x0, y0, x1, y1, seed) {
        const rand = Pt().seeded(seed), dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1, bow = (rand() - 0.5) * 0.16 * len;
        const mx = (x0 + x1) / 2 - dy / len * bow, my = (y0 + y1) / 2 + dx / len * bow;
        const a = Math.atan2(y1 - my, x1 - mx), h = 7;
        const head = `M${(x1 - Math.cos(a - 0.45) * h).toFixed(1)} ${(y1 - Math.sin(a - 0.45) * h).toFixed(1)} L${x1.toFixed(1)} ${y1.toFixed(1)} L${(x1 - Math.cos(a + 0.4) * h).toFixed(1)} ${(y1 - Math.sin(a + 0.4) * h).toFixed(1)}`;
        return `M${x0.toFixed(1)} ${y0.toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)} ${head}`;
    }
    /** A fine engraved callout: a small ring on the part, a straight line out, a short shelf under the label. */
    function engravedLeader(x0, y0, x1, y1, side) {
        const shelf = side === 'left' ? -1 : 1, ex = x0 + shelf * 18;
        return { d: `M${x0.toFixed(1)} ${y0.toFixed(1)} L${ex.toFixed(1)} ${y0.toFixed(1)} L${x1.toFixed(1)} ${y1.toFixed(1)}`, ring: [x1, y1] };
    }
    /** Where the notes go, in CSS px of the object: beside the gold, or at their places on the page. Returns the disc's
        geometry { w, h, cx, cy, R, D }, or null before the object has a size. */
    function layoutNotes(obj, notes, noteEls, isReal) {
        const w = obj.offsetWidth, h = obj.offsetHeight;
        if (!w || !h) return null;
        if (isReal) {
            const D = h, left = (w - D) / 2, side = Math.max(120, left - 34);
            noteEls.forEach((b, i) => {
                const at = GOLD_NOTES[notes[i].key]; if (!b || !at) return;
                Object.assign(b.style, { width: `${side}px`, top: `${at[1] * h}px`, left: at[0] === 'left' ? `${left - 34 - side}px` : `${left + D + 34}px` });
                b.classList.toggle('is-left', at[0] === 'left');
            });
            return { w, h, cx: w / 2, cy: h / 2, R: D / 2 - ART * 2, D };
        }
        noteEls.forEach((b, i) => { const at = SKETCH_NOTES[notes[i].key]; if (b && at) Object.assign(b.style, { left: `${at[0] * w}px`, top: `${at[1] * h}px`, width: `${at[2] * w}px` }); });
        return { w, h, cx: SKETCH.cx * w, cy: SKETCH.cy * h, R: SKETCH.r * h };
    }
    /** A part's point on the disc (where its line ends), in CSS px of the object. */
    function anchorOf(geo, key) { const a = A().ANCHORS[key] || A().ANCHORS.disc, s = geo.R / 140; return [geo.cx + a[0] * s, geo.cy + a[1] * s]; }
    /** The hot spots over the parts, so pointing at the picture finds them. */
    function placeSpots(spots, geo) {
        const s = geo.R / 140;
        spots.forEach(sp => { const r = A().REGIONS[sp.dataset.key] || A().REGIONS.disc, rr = r[2] * s; Object.assign(sp.style, { left: `${geo.cx + r[0] * s - rr}px`, top: `${geo.cy + r[1] * s - rr}px`, width: `${rr * 2}px`, height: `${rr * 2}px` }); });
    }
    /** The line from each note to its part: pencil on the page, a fine engraved line beside the gold. */
    function drawLeaders(svg, geo, notes, noteEls, isIn, isReal) {
        svg.setAttribute('viewBox', `0 0 ${geo.w} ${geo.h}`);
        svg.innerHTML = notes.map((n, i) => {
            const b = noteEls[i]; if (!b || n.key === 'margin') return '';
            const [ax, ay] = anchorOf(geo, n.key), label = b.querySelector('b'), lh = label ? label.offsetHeight : 16;
            const isLeft = b.offsetLeft + b.offsetWidth / 2 < ax, x0 = isLeft ? b.offsetLeft + b.offsetWidth + 6 : b.offsetLeft - 8, y0 = b.offsetTop + lh * 0.55;
            const cls = isIn[i] ? 'is-in' : '';
            if (!isReal) return `<g data-key="${n.key}" class="${cls}"><path d="${pencilLeader(x0, y0, ax, ay, 300 + i)}"/></g>`;
            const e = engravedLeader(x0, y0, ax, ay, isLeft ? 'right' : 'left');
            return `<g data-key="${n.key}" class="${cls}"><path d="${e.d}"/><circle cx="${e.ring[0].toFixed(1)}" cy="${e.ring[1].toFixed(1)}" r="3.5"/></g>`;
        }).join('');
    }
    /** Pointing at a note or a part lights it (once its note is in); leaving the thing puts the light out. */
    function bindPointing(obj, noteEls, spots, setFocus, focusNow) {
        noteEls.forEach(b => {
            if (!b) return;
            b.addEventListener('mouseenter', () => setFocus(b.dataset.key));
            b.addEventListener('focus', () => setFocus(b.dataset.key));
            b.addEventListener('click', () => setTimeout(() => setFocus(b.dataset.key), 0));      // after the click has brought every note in
            b.addEventListener('blur', () => { if (focusNow() === b.dataset.key && !obj.matches(':hover')) setFocus(null); });
        });
        spots.forEach(sp => sp.addEventListener('mouseenter', () => setFocus(sp.dataset.key)));
        obj.addEventListener('mouseleave', () => setFocus(null));
    }
    function discView(o) {
        const isReal = !!o.real, notes = o.notes || [], el = document.createElement('div');
        el.className = 'find-stage';
        el.innerHTML = `
            <div class="find-object ${isReal ? 'find-gold' : 'find-sketch'}">
                <canvas class="find-art" aria-hidden="true"></canvas>
                <svg class="find-leaders" aria-hidden="true"></svg>
                ${notes.filter(n => n.key !== 'margin').map(n => `<i class="find-spot" data-key="${esc(n.key)}" aria-hidden="true"></i>`).join('')}
                ${notes.map((n, i) => noteHtml(n, i, isReal)).join('')}
            </div>`;
        const obj = el.querySelector('.find-object'), art = el.querySelector('.find-art'), svg = el.querySelector('.find-leaders');
        const noteEls = notes.map(n => el.querySelector(`.find-note[data-key="${n.key}"]`)), spots = [...el.querySelectorAll('.find-spot')];
        const isIn = notes.map(() => false), startedAt = performance.now();
        let focus = null, geo = null, cache = {}, disc = null, img = null, stopShine = () => {}, unwatch = () => {};
        function paintSketch() {
            if (!geo || !geo.fit) return;
            const key = focus || '';
            if (!cache[key]) cache[key] = A().sketchFocus(cache.base, geo.fit.W, geo.fit.H, geo.L, focus);
            art.getContext('2d').putImageData(new ImageData(cache[key], geo.fit.W, geo.fit.H), 0, 0);
        }
        function paintGold() {
            if (!disc) return;
            disc.frame(img, isReduced() ? 0 : performance.now() - startedAt, focus);
            art.getContext('2d').putImageData(img, 0, 0);
        }
        function draw() {
            geo = layoutNotes(obj, notes, noteEls, isReal);
            if (!geo) return;
            if (isReal) {
                const fit = fitCanvas(art, geo.D, geo.D);
                Object.assign(art.style, { left: `${(geo.w - fit.W * fit.unit) / 2}px`, top: `${(geo.h - fit.H * fit.unit) / 2}px` });
                disc = A().gold(fit.W); img = new ImageData(fit.W, fit.W);
                geo.R = (fit.W / 2 - 2.5) * fit.unit;                                             // the marks' radius: gold() cuts them 2 px inside the rim
                paintGold();
            } else {
                const fit = fitCanvas(art, geo.w, geo.h), u = fit.unit;
                geo.fit = fit;
                geo.L = { cx: Math.round(geo.cx / u), cy: Math.round(geo.cy / u), R: Math.round(geo.R / u), marginX: Math.round(SKETCH.marginX * fit.W), headY: Math.round(SKETCH.headY * fit.H), rule: Math.max(6, Math.round(SKETCH.rule * fit.H)) };
                cache = { base: A().sketch(fit.W, fit.H, geo.L) };
                paintSketch();
            }
            placeSpots(spots, geo);
            drawLeaders(svg, geo, notes, noteEls, isIn, isReal);
        }
        function setFocus(key) {
            const i = notes.findIndex(n => n.key === key);
            if ((key && (i < 0 || !isIn[i])) || (key || null) === focus) return;
            focus = key || null;
            obj.dataset.focus = focus || '';
            noteEls.forEach(b => b && b.setAttribute('aria-pressed', String(b.dataset.key === focus)));
            if (isReal) paintGold(); else paintSketch();
        }
        bindPointing(obj, noteEls, spots, setFocus, () => focus);
        const bringIn = i => {
            isIn[i] = true;
            if (noteEls[i]) noteEls[i].classList.add('is-in');
            const g = svg.querySelector(`g[data-key="${notes[i].key}"]`); if (g) g.classList.add('is-in');
        };
        return {
            el, steps: notes.length, setFocus,
            mount() {
                draw();
                unwatch = onResize(obj, draw);
                if (isReal && !isReduced()) stopShine = loop(obj, TICK_MS, paintGold);
                if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (geo) drawLeaders(svg, geo, notes, noteEls, isIn, isReal); });
            },
            reveal(i, done) { bringIn(i); if (done) done(); },
            finish() { notes.forEach((n, i) => bringIn(i)); },
            destroy() { stopShine(); unwatch(); },
        };
    }

    function page(p, o = {}) {
        const opts = { shipName: o.shipName || '', lineMs: o.lineMs || 1100 };
        if (p.kind === 'log') return logView(p, opts);
        if (p.kind === 'plate') return plateView(p, opts);
        return paperView(p, opts);
    }
    function disc(o = {}) { return discView(Object.assign({ lineMs: 1100 }, o)); }

    /** The caller's pacing: a view's lines come in one a turn (the first at once); a click on the thing shows the rest at once;
        reduced motion shows everything. onAllIn(isAtOnce) runs once, when the last line is in. Returns showAll. */
    function pace(view, overlay, lineMs, onAllIn) {
        let next = 0, inCount = 0, isDone = false, timer = null;
        const done = isAtOnce => { if (isDone) return; isDone = true; clearInterval(timer); onAllIn(isAtOnce); };
        const lineIn = () => { inCount += 1; if (inCount >= view.steps) done(false); };
        const step = () => { if (next < view.steps) view.reveal(next++, lineIn); };
        const showAll = () => { if (isDone) return; next = view.steps; view.finish(); done(true); };
        timer = setInterval(() => { if (!overlay.isConnected || isDone) { clearInterval(timer); return; } step(); }, lineMs);
        view.el.addEventListener('click', showAll);
        if (!view.steps) done(true); else step();
        if (isReduced()) showAll();
        return showAll;
    }

    window.NSFinds = Object.freeze({ isOn, page, disc, said, pace });
})();
