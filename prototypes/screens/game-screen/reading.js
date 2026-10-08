/* Silent Exodus game screen: the reading layer. Three kinds of text (docs/TEXT_SYSTEM.md), all of them in the scene:
     VOICE  a person or A.U.R.A. says one line beside whoever is speaking; the faint line before it stays under it.
     PAGE   a thing you found, shown as the object itself over the dimmed painting; its words one line at a time.
     SHIP   what happened, kept in the ship's record: a logbook you open with L, grouped by sector and by stop.
   Rules kept here: buttons only for decisions; one line at a time; about 40 words on screen at most; a click or Space moves
   on, Esc skips; the "Click or Space" hint only in the first two scenes.
     GameReading.create(World) → Reading
       say(who, line, { anchor, from, wait, scene }) → Promise<bool>   true when read (or timed out), false when cut off
       ask(who, line, choices, { anchor }) → Promise<i>
       playScene(scene, bands) → Promise<i>          the words of a scene shown as film
       showPage(page) → Promise                       resolves when the page is put away
       openRecord(), openShip()
       advance(), close(), isOpen(), isShowing(line), clear(), frame(t), relayout(), onKey(e) */
(function () {
    'use strict';

    // Faces: the designer's portraits, as they are (only cropped to the face). [x, y, size] of the crop, as fractions.
    const FACES = { cora: '../../assets/crew/F_1.png', jaxon: '../../assets/crew/M_2.png', aris: '../../assets/crew/F_3.png', vance: '../../assets/crew/M_4.png', mira: '../../assets/crew/F_5.png' };
    const FACE_CROP = { cora: [0.33, 0.2, 0.5], jaxon: [0.42, 0.18, 0.5], aris: [0.26, 0.24, 0.5], vance: [0.25, 0.16, 0.52], mira: [0.31, 0.18, 0.5] };
    const TONE_HEX = { cora: '#f2e2c4', jaxon: '#f08c2e', vance: '#c4622a', aris: '#ffc27a', mira: '#e8836a' };
    const FACE_PX = 128;
    const IDS = { 'A.U.R.A.': 'aura', Cora: 'cora', Jaxon: 'jaxon', Vance: 'vance', Aris: 'aris', Mira: 'mira' };
    const toneOf = who => IDS[who] || 'aura';
    const isAura = who => who === 'A.U.R.A.';
    const wordsIn = s => (String(s).trim().match(/\S+/g) || []).length;
    const MAX_WORDS = 40, PREV_FOR_MS = 7000, EDGE = 16;
    const readMs = line => Math.max(3200, wordsIn(line) * 300 + 1600);

    function h(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

    function create(World) {
        const root = document.getElementById('reading');
        const art = window.GamePages ? window.GamePages.create(World.art) : null;
        let cur = null;          // the voice line on screen
        let last = null;         // the line before it, for the faint line
        let overlay = null;      // an ask, a page or the record
        let film = null;         // a scene playing as film
        const scenes = [];       // scenes met so far: the hint shows in the first two only
        let pagesOpened = 0, recordsOpened = 0;
        const sceneIndex = key => { if (!scenes.includes(key)) scenes.push(key); return scenes.indexOf(key); };

        // ── the pieces every voice is made of ──
        function whoEl(who, from) {
            const p = h('p', 'who');
            if (isAura(who)) p.append(h('span', 'ring'));
            p.append(document.createTextNode(who));
            if (from) p.append(h('span', 'from', from));
            return p;
        }
        function sayEl(line, isNarr, withCue = true) {
            const p = h('p', 'say' + (isNarr ? ' is-narr' : ''));
            p.append(document.createTextNode(line));
            if (withCue) { const c = h('span', 'cue', '▸'); c.setAttribute('aria-hidden', 'true'); p.append(c); }
            return p;
        }
        function prevEl(prev, flush) {
            const p = h('p', 'prev' + (prev.narr ? ' is-narr' : '') + (flush ? ' is-flush' : '') + ' tone-' + toneOf(prev.who));
            if (prev.who && !prev.narr) p.append(h('b', null, prev.who));
            p.append(document.createTextNode(prev.line));
            return p;
        }
        // ── faces (see FACES) ──
        const faceJobs = {};
        const mixHex = (a, b, k) => { const A = World.art.hexRgb(a), B = World.art.hexRgb(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join(''); };
        function facePixels(id) {
            if (faceJobs[id]) return faceJobs[id];
            faceJobs[id] = new Promise(resolve => {
                const img = new Image();
                img.onerror = () => resolve(null);
                img.onload = () => {
                    try {
                        const [fx, fy, fs] = FACE_CROP[id], N = FACE_PX;
                        const small = document.createElement('canvas'); small.width = N; small.height = N;
                        const g = small.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
                        g.drawImage(img, fx * img.width, fy * img.height, fs * img.width, fs * img.height, 0, 0, N, N);
                        resolve(small);
                    } catch (err) { console.warn('Face not drawn:', id, err.message); resolve(null); }
                };
                img.src = FACES[id];
            });
            return faceJobs[id];
        }
        Object.keys(FACES).forEach(facePixels);                                                    // ready before the first scene
        function faceEl(who) {
            if (isAura(who) || !FACES[toneOf(who)]) { const r = h('span', 'face-ring'); r.setAttribute('aria-hidden', 'true'); return r; }
            const c = h('canvas', 'face'); c.width = FACE_PX; c.height = FACE_PX; c.setAttribute('aria-hidden', 'true');
            facePixels(toneOf(who)).then(src => { if (src) c.getContext('2d').drawImage(src, 0, 0); });
            return c;
        }
        /** A line with a face, for when the game waits for you (scenes, under pages). */
        function faceLine(step) {
            if (step.narr) { const row = h('div', 'film-line is-narr'); row.append(sayEl(step.line, true)); return row; }
            const row = h('div', 'film-line tone-' + toneOf(step.who)), text = h('div', 'text');
            text.append(whoEl(step.who, step.from), sayEl(step.line, false));
            row.append(faceEl(step.who), text);
            return row;
        }
        function choicesEl(choices, done) {
            const list = h('ol', 'choices');
            choices.forEach((c, i) => {
                const li = h('li'), b = h('button', 'choice'); b.type = 'button';
                b.append(h('span', 'n', String(i + 1)), h('span', 'verb', c.verb));
                const chips = h('span', 'chips');
                (c.chips || []).forEach(([t, kind]) => chips.append(h('span', 'chip' + (kind === 'gain' ? ' is-gain' : kind === 'loss' ? ' is-loss' : ''), t)));
                b.append(chips);
                b.addEventListener('click', e => { e.stopPropagation(); done(i); });
                li.append(b); list.append(li);
            });
            return list;
        }

        // ── pinning words to a place in the scene, and darkening the picture under them ──
        /** Where an element's box goes for one candidate anchor point, kept inside the window. */
        function boxAt(a, w, hgt) {
            let x = a.x, y = a.y;
            if (a.side === 'above') { y = a.y - hgt; if (a.align === 'center') x = a.x - w / 2; }
            else if (a.side === 'below') { if (a.align === 'center') x = a.x - w / 2; }
            else if (a.side === 'left') { x = a.x - w - 12; y = a.y - Math.min(hgt, 64) / 2; }
            else if (a.side === 'right') { x = a.x + 12; y = a.y - Math.min(hgt, 64) / 2; }
            else if (a.side === 'center') { x = a.x - w / 2; y = a.y - hgt / 2; }
            return { x: Math.round(Math.max(EDGE, Math.min(window.innerWidth - w - EDGE, x))), y: Math.round(Math.max(EDGE, Math.min(window.innerHeight - hgt - EDGE, y))), w, h: hgt };
        }
        /** Keeps an element beside a named anchor of the world, following it if it moves (our ship in flight). Of the places
            the world offers for that anchor, the darkest wins, so words never land on a bright planet or a gold rim; the choice
            holds while the ship moves unless the sky under it turns bright. */
        function pin(el, anchor, shadeKey) {
            const pinned = { el, anchor, shadeKey, pos: null, w: 0, h: 0, strength: 0.66, sampledAt: null, pick: null };
            pinned.measure = () => { pinned.w = el.offsetWidth; pinned.h = el.offsetHeight; pinned.pos = null; pinned.sampledAt = null; };
            pinned.place = () => {
                const list = (World.anchors ? World.anchors(pinned.anchor) : [World.anchor(pinned.anchor)]) || [];
                if (!list.length || !list[0]) return;
                const boxes = list.map(a => boxAt(a, pinned.w, pinned.h)), cur = boxes[pinned.pick != null && pinned.pick < boxes.length ? pinned.pick : 0];
                if (pinned.pick == null || !pinned.sampledAt || Math.hypot(pinned.sampledAt.x - cur.x, pinned.sampledAt.y - cur.y) > 18) {
                    const score = boxes.map(b => World.luma(b));
                    let best = 0; score.forEach((v, i) => { if (v < score[best] - 0.004) best = i; });
                    if (pinned.pick == null || pinned.pick >= boxes.length || score[pinned.pick] > 0.06) pinned.pick = best;      // keep a dark choice: no hopping while flying
                    const b = boxes[pinned.pick];
                    pinned.sampledAt = { x: b.x, y: b.y };
                    pinned.strength = 0.62 + 0.3 * Math.min(1, Math.max(0, (score[pinned.pick] - 0.04) / 0.22));   // a brighter sky gets a deeper shade
                }
                const { x, y } = boxes[pinned.pick];
                if (pinned.pos && pinned.pos.x === x && pinned.pos.y === y) return;
                pinned.pos = { x, y };
                el.style.transform = `translate(${x}px, ${y}px)`;
                World.shade(pinned.shadeKey, { x, y, w: pinned.w, h: pinned.h, strength: pinned.strength });
            };
            pinned.measure();
            pinned.place();
            void el.offsetWidth;                                                                       // let the fade-in start from 0
            el.classList.add('is-in');
            return pinned;
        }
        const unpin = pinned => { if (!pinned) return; pinned.el.remove(); World.shade(pinned.shadeKey, null); };

        // ── VOICE: one line beside whoever is speaking ──
        function prevFor(anchor, line) {
            if (!last || last.anchor !== anchor || last.line === line || World.now() - last.endedAt > PREV_FOR_MS) return null;
            return wordsIn(last.line) + wordsIn(line) <= MAX_WORDS ? last : null;
        }
        function endVoice(how) {
            if (!cur) return;
            const c = cur; cur = null;
            if (c.timer) World.cancel(c.timer);
            last = { who: c.who, line: c.line, anchor: c.anchor, endedAt: World.now() };
            unpin(c.pinned);
            if (how) c.resolve(how === 'done');
        }
        function say(who, line, opts = {}) {
            return new Promise(resolve => {
                endVoice('cut');
                const anchor = opts.anchor || 'ship', el = h('div', 'voice tone-' + toneOf(who));
                el.append(whoEl(who, opts.from), sayEl(line, false));
                const prev = prevFor(anchor, line);
                if (prev) el.append(prevEl(prev));
                if (opts.scene && sceneIndex(opts.scene) < 2) el.append(h('p', 'read-hint', 'Click or Space'));
                root.append(el);
                cur = { who, line, anchor, resolve, scene: opts.scene || null, timer: null, pinned: pin(el, anchor, 'voice') };
                if (!opts.wait) cur.timer = World.after(readMs(line), () => endVoice('done'));
            });
        }

        // ── a question beside the ship: the line, then numbered choices; the faint line clears so they have room ──
        function ask(who, line, choices, opts = {}) {
            return new Promise(resolve => {
                endVoice('cut');
                closeOverlay();
                const el = h('div', 'voice is-ask tone-' + toneOf(who));
                el.append(whoEl(who), sayEl(line, false, false));
                const done = i => {
                    if (!overlay || overlay.el !== el) return;
                    unpin(overlay.pinned); overlay = null;
                    last = { who, line, anchor: opts.anchor || 'ship', endedAt: World.now() };
                    resolve(i);
                };
                el.append(choicesEl(choices, done));
                el.addEventListener('click', e => e.stopPropagation());
                root.append(el);
                overlay = { kind: 'ask', el, choose: done, count: choices.length, cancel: () => done(choices.length - 1), pinned: pin(el, opts.anchor || 'ship', 'ask') };
            });
        }

        // ── a scene as film: the title in the top band; narration, then voices with faces, then the choice ──
        function playScene(scene, bands) {
            return new Promise(resolve => {
                endVoice('cut');
                const early = sceneIndex('scene:' + scene.title) < 2;
                const top = h('div', 'film-band is-top'), bottom = h('div', 'film-band is-bottom');
                const topCol = h('div', 'film-col'), col = h('div', 'film-col'), now = h('div', 'film-now');
                top.style.top = bands.top.y + 'px'; top.style.height = bands.top.h + 'px';
                bottom.style.top = bands.bottom.y + 'px'; bottom.style.height = bands.bottom.h + 'px';
                topCol.append(h('p', 'film-title', scene.title)); top.append(topCol);
                const hint = early ? h('p', 'read-hint', 'Click or Space · Esc skips') : null;
                col.append(now); if (hint) col.append(hint); bottom.append(col);
                root.append(top, bottom);
                const steps = [{ narr: true, line: scene.narration }].concat(scene.lines.map(([who, line, from]) => ({ who, line, from })));
                let i = -1, prev = null;
                const show = () => {
                    const s = steps[i];
                    now.replaceChildren(faceLine(s));
                    if (prev && wordsIn(prev.line) + wordsIn(s.line) <= MAX_WORDS) now.append(prevEl(prev, !!s.narr));
                    prev = s;
                };
                const toChoices = () => {
                    if (hint) hint.remove();
                    if (!scene.choices || !scene.choices.length) { end(-1); return; }
                    now.replaceChildren(choicesEl(scene.choices, end));
                    overlay = { kind: 'ask', count: scene.choices.length, choose: end, cancel: () => {} };
                };
                const end = j => { overlay = null; film = null; top.remove(); bottom.remove(); last = null; resolve(j); };
                film = {
                    next() { if (overlay) return; if (i < steps.length - 1) { i++; show(); } else toChoices(); },
                    skip() { if (!overlay) toChoices(); },
                    top, bottom,
                };
                film.next();
            });
        }

        // ── PAGE: the object, large, over the darkened painting. Only what you have read is shown: the line now, and the lines
        //    before it, faint, while they all fit in about 40 words. The numbers and names on the object are part of its picture. ──
        function showPage(page) {
            return new Promise(resolve => {
                endVoice('cut');
                closeOverlay();
                World.dim(0.78);
                document.body.classList.add('is-reading');
                pagesOpened++;
                const view = h('div', 'page-view'), k = h('p', 'page-k', page.title), obj = h('div', 'page-object'), cv = h('canvas'), list = h('ol', 'page-lines'), after = h('div', 'page-after');
                view.setAttribute('role', 'dialog'); view.setAttribute('aria-label', page.title);
                if (page.source) k.append(h('span', null, ' · ' + page.source));
                cv.setAttribute('aria-hidden', 'true');
                obj.append(cv);
                const hint = pagesOpened <= 1 ? h('p', 'read-hint', 'Click or Space · ← back · Esc puts it away') : null;
                view.append(k, obj, list, after);
                if (hint) view.append(hint);
                root.append(view);
                const lines = page.lines.map(l => (typeof l === 'string' ? { t: l } : l)), afterLines = page.after || [];
                let n = 0, phase = 'lines', a = -1, painted = null;
                const scale = () => window.innerWidth + 'x' + window.innerHeight;
                const paintObject = () => {
                    const focus = phase === 'lines' ? lines[n].part || 'all' : 'all', now = phase === 'lines' ? n : -1;
                    if (!art) return;
                    if (painted && painted.focus === focus && painted.now === now && painted.k === scale()) return;
                    const marks = lines.map((l, i) => ({ part: l.part, n: i + 1, isNow: i === now, isRead: i < n || phase === 'after' })).filter(m => m.isNow || m.isRead);
                    const pic = page.kind === 'drawing' ? art.drawing(focus, marks) : art.plate(focus, page.cast);
                    // a whole number of device pixels per picture pixel, about half the screen high
                    const dpr = window.devicePixelRatio || 1, dk = Math.max(2, Math.floor(Math.min(window.innerWidth * dpr * 0.5 / pic.W, window.innerHeight * dpr * 0.52 / pic.H)));
                    cv.width = pic.W; cv.height = pic.H; cv.style.width = pic.W * dk / dpr + 'px'; cv.style.height = pic.H * dk / dpr + 'px';
                    cv.getContext('2d').drawImage(pic.canvas, 0, 0);
                    painted = { focus, now, k: scale() };
                };
                const shadeText = () => {                                                              // solid ink behind the words, fading out at a ragged edge
                    const r1 = list.getBoundingClientRect(), r2 = after.getBoundingClientRect(), top = Math.min(r1.top, r2.height ? r2.top : r1.top), bottom = Math.max(r1.bottom, r2.height ? r2.bottom : r1.bottom);
                    if (r1.width) World.shade('page', { x: r1.left - 10, y: top - 6, w: r1.width + 20, h: bottom - top + 12, strength: 1, everywhere: true });
                };
                const draw = () => {
                    paintObject();
                    const upTo = phase === 'lines' ? n : lines.length - 1, shown = [];
                    let words = phase === 'after' ? wordsIn(afterLines[a][1]) : 0;
                    for (let i = upTo; i >= 0; i--) { const w = wordsIn(lines[i].t); if (i !== upTo && words + w > MAX_WORDS) break; words += w; shown.unshift(i); }
                    list.replaceChildren(...shown.map(i => {
                        const l = lines[i], isNow = i === n && phase === 'lines';
                        const li = h('li', isNow ? 'is-now' : 'is-read');
                        li.append(h('span', 'num', String(i + 1)));
                        const text = h('span', 'text' + (l.hand ? ' is-hand' : ''));
                        if (l.label && isNow) text.append(h('span', 'label', l.label));
                        text.append(document.createTextNode(l.t));
                        li.append(text);
                        return li;
                    }));
                    if (phase === 'after') {
                        const row = faceLine({ who: afterLines[a][0], line: afterLines[a][1] });
                        after.replaceChildren(row);
                        if (a === afterLines.length - 1) after.append(h('p', 'page-kept', "Kept in the ship's record"));
                        void row.offsetWidth; row.classList.add('is-in');
                    } else after.replaceChildren();
                    shadeText();
                };
                const close = () => {
                    if (!overlay || overlay.el !== view) return;
                    view.remove(); overlay = null; World.dim(0); World.shade('page', null); document.body.classList.remove('is-reading');
                    const left = afterLines.slice(phase === 'after' ? a + 1 : 0);                          // whatever was not said under the page is said in the scene
                    const anchor = World.view() === 'orbit' ? 'orbit-ship' : 'ship';
                    left.reduce((chain, [who, line]) => chain.then(ok => (ok === false ? false : say(who, line, { anchor }))), Promise.resolve(true));
                    if (phase === 'after') last = { who: afterLines[a][0], line: afterLines[a][1], anchor, endedAt: World.now() };
                    resolve();
                };
                const next = () => {
                    if (phase === 'lines' && n < lines.length - 1) { n++; draw(); return; }
                    if (a < afterLines.length - 1) { phase = 'after'; a++; draw(); return; }
                    close();
                };
                const back = () => {
                    if (phase === 'after') { if (a > 0) a--; else { phase = 'lines'; a = -1; } draw(); return; }
                    if (n > 0) { n--; draw(); }
                };
                view.addEventListener('click', e => { e.stopPropagation(); next(); });
                overlay = { kind: 'page', el: view, next, back, close, relayout: () => { painted = null; draw(); } };
                draw();
            });
        }

        // ── SHIP: the ship's record, a logbook lying open. Sectors newest first; inside each, its stops, newest first ──
        const PAGES_BY_ID = () => World.pages || {};
        function recordRow(it) {
            const li = h('li', 'rec' + (it.story ? ' is-story' : '') + (it.routine ? ' is-routine' : '') + (it.who ? ' tone-' + toneOf(it.who) : ''));
            const mark = h('span', 'mark');
            mark.setAttribute('aria-hidden', 'true');
            const body = h('span');
            if (it.who) {
                mark.append(h('span', isAura(it.who) ? 'ringmark' : 'dot'));
                body.append(h('span', 'name', it.who), h('span', 'says', `“${it.t}”`));
            } else {
                mark.textContent = it.story ? '◆' : '·';
                body.append(document.createTextNode(it.t));
            }
            (it.chips || []).forEach(([t, kind]) => body.append(h('span', 'chip' + (kind === 'loss' ? ' is-loss' : kind === 'gain' ? ' is-gain' : ''), t)));
            const page = it.page && PAGES_BY_ID()[it.page];
            if (page) {
                const again = h('button', 'rec-again', page.kind === 'plate' ? 'Read the plate again' : 'Look at the drawing again'); again.type = 'button';
                again.addEventListener('click', e => { e.stopPropagation(); readAgain(it.page); });
                body.append(again);
            }
            li.append(mark, body);
            return li;
        }
        /** One stop on one page: where we were, then what happened there (the ship's routine lines quieter, not hidden). */
        function stopBlock(stop, items, head) {
            const frag = h('div', 'rec-stop-block');
            if (head) frag.append(head);
            frag.append(h('p', 'rec-stop', stop));
            const list = h('ol', 'rec-list');
            items.forEach(it => list.append(recordRow(it)));
            frag.append(list);
            return frag;
        }
        function sectorBlocks(group) {
            const [num, name] = group.head.split(' · '), byStop = [], title = h('h3', 'rec-sector');
            title.append(h('small', null, num), document.createTextNode(name || ''));
            group.items.forEach(it => { const stop = it.stop || 'On the way'; let s = byStop.find(b => b.stop === stop); if (!s) { s = { stop, items: [] }; byStop.push(s); } s.items.push(it); });
            return byStop.reverse().map((s, i) => stopBlock(s.stop, s.items, i === 0 ? title : null));
        }
        function openRecord() {
            if (overlay && overlay.kind === 'record') return;
            if (film) return;
            closeOverlay();
            endVoice('cut'); last = null;                                                              // nothing peeks out from behind the book
            World.dim(0.78);
            document.body.classList.add('is-reading');
            recordsOpened++;
            const st = World.state(), g = World.geom(), k = g.s || g.k;
            const bw = Math.min(380, Math.floor(window.innerWidth * 0.62 / k)), bh = Math.min(250, Math.floor(window.innerHeight * 0.74 / k));   // a book you could hold: one stop to a page
            const view = h('div', 'record-view'), book = h('div', 'book'), cv = h('canvas'), text = h('div', 'book-text'), flow = h('div', 'book-flow');
            view.setAttribute('role', 'dialog'); view.setAttribute('aria-label', "The ship's record");
            cv.setAttribute('aria-hidden', 'true');
            const pic = art ? art.logbook(bw, bh) : { canvas: document.createElement('canvas'), W: bw, H: bh, pages: [{ x: 6, y: 6, w: bw / 2 - 9, h: bh - 12 }, { x: bw / 2 + 3, y: 6, w: bw / 2 - 9, h: bh - 12 }] };
            cv.width = pic.W; cv.height = pic.H; cv.style.width = pic.W * k + 'px'; cv.style.height = pic.H * k + 'px';
            cv.getContext('2d').drawImage(pic.canvas, 0, 0);
            const [L, R] = pic.pages, pad = Math.round(7 * k);
            const colW = L.w * k - pad * 2, gap = (R.x - L.x - L.w) * k + pad * 2;
            Object.assign(text.style, { left: L.x * k + pad + 'px', top: L.y * k + pad + 'px', width: colW * 2 + gap + 'px', height: L.h * k - pad * 2 + 'px' });
            flow.style.columnGap = gap + 'px';
            flow.append(h('p', 'rec-title', "The ship's record"));
            if (!st.record.length) flow.append(h('p', 'rec', 'Nothing written yet.'));
            st.record.slice().reverse().forEach(gp => sectorBlocks(gp).forEach(b => flow.append(b)));
            const first = flow.querySelector('.rec-stop-block'); if (first) first.classList.add('is-first');   // every other stop starts a new page
            text.append(flow); book.append(cv, text); view.append(book);
            const hint = recordsOpened <= 2 ? h('p', 'read-hint', 'Esc closes') : null;
            if (hint) view.append(hint);
            root.append(view);
            let spread = 0, spreads = 1;
            const paginate = () => {
                const width = colW * 2 + gap;
                spreads = Math.max(1, Math.ceil((flow.scrollWidth + gap) / (width + gap) - 0.01));
                spread = Math.min(spread, spreads - 1);
                flow.style.transform = `translateX(${-spread * (width + gap)}px)`;
                if (hint) hint.textContent = spreads > 1 ? '← → turns the page · Esc closes' : 'Esc closes';
            };
            const close = () => { if (!overlay || overlay.el !== view) return; view.remove(); overlay = null; World.dim(0); document.body.classList.remove('is-reading'); };
            view.addEventListener('click', e => { e.stopPropagation(); if (!book.contains(e.target)) close(); });
            overlay = { kind: 'record', el: view, close, paginate, turn: d => { spread = Math.max(0, Math.min(spreads - 1, spread + d)); paginate(); }, relayout: () => { close(); openRecord(); } };
            paginate();
        }
        function readAgain(id) {
            const page = PAGES_BY_ID()[id]; if (!page) return;
            closeOverlay();
            showPage(Object.assign({}, page, { after: [] })).then(() => openRecord());
        }
        function closeOverlay() { if (overlay && overlay.close) overlay.close(); else if (overlay && overlay.el) { overlay.el.remove(); overlay = null; } }

        // ── input ──
        const Reading = {
            say, ask, playScene, showPage, openRecord,
            openShip() { World.openShip(); },
            advance() {
                if (overlay && overlay.next) { overlay.next(); return true; }
                if (overlay) return true;
                if (film) { film.next(); return true; }
                if (cur) { endVoice('done'); return true; }
                return false;
            },
            close() {
                if (overlay && overlay.close) { overlay.close(); return true; }
                if (overlay && overlay.cancel) { overlay.cancel(); return true; }
                if (film) { film.skip(); return true; }
                return false;
            },
            isOpen: () => !!overlay || !!film,
            isShowing: line => !!cur && cur.line === line,
            clear() {
                endVoice('cut'); last = null; World.shade('page', null);
                if (film) { film.top.remove(); film.bottom.remove(); film = null; }
                if (overlay) { if (overlay.pinned) unpin(overlay.pinned); if (overlay.el) overlay.el.remove(); overlay = null; }
                root.querySelectorAll('.voice').forEach(e => e.remove());
                document.body.classList.remove('is-reading');
                World.shade('voice', null); World.shade('ask', null); World.dim(0);
            },
            frame() { if (cur) cur.pinned.place(); if (overlay && overlay.pinned) overlay.pinned.place(); },
            relayout() {
                if (cur) { cur.pinned.measure(); cur.pinned.place(); }
                if (overlay && overlay.pinned) { overlay.pinned.measure(); overlay.pinned.place(); }
                if (overlay && overlay.relayout) overlay.relayout();
            },
            onKey(e) {
                const k = e.key;
                if (overlay && overlay.kind === 'ask') {
                    if (/^[1-9]$/.test(k) && +k <= overlay.count) overlay.choose(+k - 1);
                    else if (k === 'Escape' && overlay.cancel) overlay.cancel();
                    return true;
                }
                if (overlay && overlay.kind === 'page') {
                    if (k === 'ArrowLeft') overlay.back();
                    else if (k === ' ' || k === 'Enter' || k === 'ArrowRight') overlay.next();
                    else if (k === 'Escape') overlay.close();
                    return true;
                }
                if (overlay && overlay.kind === 'record') {
                    if (k === 'ArrowLeft') overlay.turn(-1);
                    else if (k === 'ArrowRight') overlay.turn(1);
                    else if (k === 'Escape' || k === 'l' || k === 'L') overlay.close();
                    return true;
                }
                if (film) {
                    if (k === ' ' || k === 'Enter' || k === 'ArrowRight') film.next();
                    else if (k === 'Escape') film.skip();
                    return true;
                }
                if (cur && cur.scene && k === 'Escape') { endVoice('cut'); return true; }            // Esc skips the rest of a scene's talk
                return false;
            },
        };
        return Reading;
    }

    window.GameReading = { create };
})();
