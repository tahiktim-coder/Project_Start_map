/* ═══ Silent Exodus · new screen (?new=1) · cards/Frame.js: the frame, one card language for every event card ═══════════
   What it is: the look pass's card (DESIGN.md 1.1, call C01), the layout of the screens the designer loved (the dock result,
   the corridor start). One column, top to bottom: the veil (the house dither); the picture (480 x 160 at a whole scale, a
   hairline, one readout of three words in a corner); the line before, dim; who speaks (a ring and the name in their tone, a
   portrait beside the column when the speaker is not in the picture, never an empty box for A.U.R.A.); the line; the keys
   (minigames.css .mini-btn), each with its chips and its consequence under it. No kicker, no title (aria-label only).
   EncounterCard.js builds the model and runs the pick; this file draws it and plays it.
     Shapes   decide: the talk, then the choices, then the outcome. ask (an end or a jump): "Not yet" first, framed and focused;
              a final key is held 1.7 s (C06: its seven ticks show before it is pressed; the first lights at the press, all
              seven at 1.7 s; let go early, they drain and blink once), "press again" under reduced motion. report: one key.
     Places   the talk keys (Skip, Next) at the right end of the key row, the choices at the left, so the finger that pressed
              Next is never on a choice. The top is fixed: the talk, the choices and the outcome are laid out once, hidden, and
              the tallest sets the height.
     Keys     talk: Enter, Space, → or a click on the frame for the next line; Esc skips to the choices. choices: ← → and Tab
              move; 1-9 pick; Enter or Space picks; Esc means "Not yet" in an ask. outcome: Enter, Space or Esc go on. Nothing
              is taken in the first 400 ms (ChoiceGuard). Focus looks like pointing; Tab never leaves the frame (aria-modal),
              and a focus given as the frame opens is given again after the browser's first paint, which can drop it.
     Motion   steps only: the veil 3 steps, the picture's Bayer reveal 8 steps of 125 ms (2 on a repeat), the words 2 steps, the
              keys left to right 60 ms apart; a pick lights its key 2 steps; out in 3 steps, the veil last.
     Room     a frame that turns up on its own waits while NewScreen holds it (ns-held: the dive, the sector title); the bus
              hears card:deck when it opens, card:speaker for each line, card:closed when it goes.
   Kept class names (the gate, ItemIcons' busy(), NewScreen's release, the capture harness): .modal-overlay .enc-decide
   .enc-choice .enc-next .enc-skip .enc-outcome-go. Loaded only when the new-screen switch is on, after cards/FramePictures.js.

   window.NSFrame (frozen)
     open(app, model, hooks) → overlay
       model { aria, zIndex, shape, alarm, picture, readout, deck, isRepeat, repeatIndex (the line a repeat shows; default the last),
               lines: [{ speaker, text, tone, face, narr }],
               keys: [{ label, chips: [{ text, tone, word }], conseqHtml, conseqTone, locked, final, primary, lit }],
               notes: [chip] (a row of word chips under the line while it is read and decided: a trip's GOING IN, look pass B08),
               outcome: { pages, chips, readout? } (a report that opens on what happened, with Continue: a trip seen before, B08) }
               lit: the key already chosen elsewhere (the way picked on the glass): a warm tick at its left, never the focus
       hooks { pick(i) → { pages: [[line]], chips, readout?, printout? } | null, done() }   pick runs the choice (readout: the
                    picture's readout after it, '' for none; printout { lines }: a document shown as itself over the picture,
                    typed (Finds.js 'list'), the outcome's line after it, look pass B03); done once it is gone
     debug() → the top frame's state, for the capture harness
*/
(function () {
    'use strict';
    if (!window.NEW_SCREEN) return;
    const PRINT_MS = 260, STEP_UI = 60, STEP_ART = 125, HOLD_MS = 1700, HOLD_STEPS = 7, NUDGE_MS = 4 * 60, AGAIN_MS = 4000, GUARD_MS = 400, FLOOR_PX = 16, RESIZE_MS = 150, FOCUS_AGAIN_MS = 120;
    const PIC_W = 480, PIC_H = 160, WHOLE_AT = 1040, CROP_UNDER = 640, CROP_ROWS = 120, FACE_PX = 64;
    const REVEAL_FIRST = 8, REVEAL_REPEAT = 2, VEIL_STEPS = 3, OUT_STEPS = 3;
    const PRESS_AGAIN = 'Press again';                       // DRAFT (look pass): a held key under reduced motion (DESIGN 1.1)
    const KEY_WORDS = { next: 'Next', skip: 'Skip', go: 'Continue' };   // the frame keys (DESIGN 1.1: [› Next], › Skip, [› Continue])
    /** --ink (tokens.css) as rgb, for the picture's reveal; the art's own ink (NSPaint.INK, the same value) before the sheet has loaded. */
    function inkRgb() {
        const v = getComputedStyle(document.documentElement).getPropertyValue('--ink').trim(), m = /^#([0-9a-f]{6})$/i.exec(v);
        const hex = m ? m[1] : String((window.NSPaint && window.NSPaint.INK) || '').replace('#', '');
        return [0, 2, 4].map(i => parseInt(hex.substr(i, 2), 16) || 0);
    }
    const BAYER = [0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22,
        3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21].map(v => (v + 0.5) / 64);
    const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const now = () => performance.now();
    const reduced = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const bus = () => (window.NewScreen && window.NewScreen.bus) || null;
    const emit = (name, p) => { const b = bus(); if (b) b.emit(name, p); };
    const stack = [];

    // ── markup ──
    const chipsHtml = chips => (chips && chips.length
        ? `<p class="ef-chips">${chips.map(c => `<i class="ef-chip is-${esc(c.tone || 'ui')}${c.word ? ' is-word' : ''}">${esc(c.text)}</i>`).join('')}</p>` : '');
    function sayHtml(l) {
        if (!l) return '<p class="ef-who" aria-hidden="true"><i class="ef-ring"></i><span>&#8203;</span></p><p class="ef-line"></p>';
        const face = l.face ? `<img class="ef-face${l.dead ? ' is-dead' : ''}" src="${esc(l.face)}" alt="" width="${FACE_PX}" height="${FACE_PX}">` : '';
        const who = l.narr ? '<span>&#8203;</span>' : `<span>${esc(l.speaker)}</span>`;
        return `${face}<p class="ef-who"${l.narr ? ' aria-hidden="true"' : ''}><i class="ef-ring"></i>${who}</p><p class="ef-line">${esc(l.text)}</p>`;
    }
    const sayClass = l => `ef-say${!l || l.narr ? ' is-narr' : ''} tone-${esc((l && !l.narr && l.tone) || 'none')}`;
    function keyHtml(k, i) {
        const cls = ['mini-btn', 'enc-choice', k.primary ? 'is-primary' : '', k.final ? 'is-hold' : ''].filter(Boolean).join(' ');
        const lock = k.locked ? '<svg class="ef-lock" viewBox="0 0 7 9" width="10" height="13" aria-hidden="true"><path d="M1 4V2.5a2.5 2.5 0 0 1 5 0V4" fill="none" stroke="currentColor"/><rect x="0" y="4" width="7" height="5" fill="currentColor"/></svg>' : '';
        const conseq = k.conseqHtml ? `<p class="ef-conseq${k.conseqTone ? ` is-${esc(k.conseqTone)}` : ''}" id="ef-c-${i}">${lock}<span>${k.conseqHtml}</span></p>` : '';
        return `<div class="ef-key${k.locked ? ' is-locked' : ''}${k.lit && !k.locked ? ' is-lit' : ''}" data-idx="${i}" style="--k:${i}">`
            + `<button type="button" class="${cls}" data-idx="${i}"${k.locked ? ' disabled' : ''}${conseq ? ` aria-describedby="ef-c-${i}"` : ''}>${esc(k.label)}</button>`
            + `${chipsHtml(k.chips)}${conseq}</div>`;
    }
    function frameHtml(m) {
        return `<section class="enc-frame" role="dialog" aria-modal="true" aria-label="${esc(m.aria || 'A moment aboard')}" data-shape="${esc(m.shape)}">
            <div class="ef-pic"><canvas class="ef-art" width="${PIC_W}" height="${PIC_H}" aria-hidden="true"></canvas><canvas class="ef-cover" width="${PIC_W}" height="${PIC_H}" aria-hidden="true"></canvas>${m.readout ? `<p class="ef-readout">${esc(m.readout)}</p>` : ''}</div>
            <div class="ef-words">
                <p class="ef-prev"></p>
                <div class="${sayClass(null)}" aria-live="polite">${sayHtml(null)}</div>
                ${m.notes && m.notes.length ? `<div class="ef-notes">${chipsHtml(m.notes)}</div>` : ''}
                <div class="ef-out" aria-live="polite" hidden></div>
            </div>
            <div class="ef-keys">
                <div class="enc-decide ef-choices" hidden>${(m.keys || []).map(keyHtml).join('')}</div>
                <div class="ef-talk"><button type="button" class="mini-btn is-quiet enc-skip">${KEY_WORDS.skip}</button><button type="button" class="mini-btn is-primary enc-next">${KEY_WORDS.next}</button></div>
                <div class="ef-go" hidden><button type="button" class="mini-btn is-primary enc-outcome-go">${KEY_WORDS.go}</button></div>
            </div>
        </section>`;
    }

    /** The picture's Bayer reveal: step k of n shows the art where the matrix is under k / n, ink elsewhere. */
    function coverAt(canvas, k, n) {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        if (k >= n) { ctx.clearRect(0, 0, PIC_W, PIC_H); return; }
        const img = ctx.createImageData(PIC_W, PIC_H), d = img.data, lim = k / n, INK = inkRgb();
        for (let y = 0; y < PIC_H; y++) for (let x = 0; x < PIC_W; x++) {
            if (BAYER[((y & 7) << 3) | (x & 7)] < lim) continue;
            const o = (y * PIC_W + x) * 4;
            d[o] = INK[0]; d[o + 1] = INK[1]; d[o + 2] = INK[2]; d[o + 3] = 255;
        }
        ctx.putImageData(img, 0, 0);
    }

    function open(app, model, hooks) {
        const m = Object.assign({ shape: 'decide', keys: [], lines: [] }, model), keys = m.keys;
        const at = m.repeatIndex != null && m.lines[m.repeatIndex] ? m.repeatIndex : m.lines.length - 1;
        const talk = m.isRepeat ? m.lines.slice(at, at + 1) : m.lines.slice();      // a repeat: one line, the one nearest the decision (or the card's own pick)
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay ef-veil';
        overlay.style.zIndex = String(m.zIndex || 2000);
        overlay.innerHTML = frameHtml(m);
        const $ = sel => overlay.querySelector(sel);
        const sec = $('.enc-frame'), pic = $('.ef-pic'), cover = $('.ef-cover'), wordsEl = $('.ef-words'), prevEl = $('.ef-prev');
        const sayEl = $('.ef-say'), outEl = $('.ef-out'), keysEl = $('.ef-keys'), choicesEl = $('.ef-choices'), talkEl = $('.ef-talk');
        const goEl = $('.ef-go'), nextEl = $('.enc-next'), skipEl = $('.enc-skip'), goBtn = $('.enc-outcome-go');
        const keyEls = [...overlay.querySelectorAll('.ef-key')], btns = keyEls.map(k => k.querySelector('.enc-choice'));
        const F = { overlay, state: 'talk', index: -1, shown: false, shownAt: 0, picked: false, closing: false, finished: false, choicesAt: 0, outAt: 0,
            hold: null, again: null, hovered: -1, out: null, page: 0, stopPic: null, timers: new Set(), resizeT: 0 };
        let heldWatch = null;
        const later = (ms, fn) => { const id = setTimeout(() => { F.timers.delete(id); fn(); }, ms); F.timers.add(id); return id; };
        const isOwn = el => !!el && overlay.contains(el);
        const guarded = since => now() - since < GUARD_MS;
        const safeIndex = () => keys.findIndex((k, i) => k.primary && !k.final && !btns[i].disabled);
        const enabled = () => btns.map((b, i) => i).filter(i => !btns[i].disabled);
        document.body.appendChild(overlay);
        stack.push(F);
        try { F.stopPic = window.NSFramePics ? window.NSFramePics.mount($('.ef-art'), m.picture) : null; } catch (err) { console.error('NSFrame: the picture failed', err); }
        coverAt(cover, 0, 1);
        if (m.alarm) pic.classList.add('is-alarm');
        if (m.deck) emit('card:deck', { deck: m.deck });

        // ── the words in the slots ──
        function setSay(el, l) { el.className = sayClass(l); el.innerHTML = sayHtml(l); }
        function setPrev(l) {
            prevEl.classList.toggle('is-narr', !!(l && l.narr));
            prevEl.className = `ef-prev${l && l.narr ? ' is-narr' : ''}${l && !l.narr ? ` tone-${esc(l.tone || 'none')}` : ''}`;
            prevEl.innerHTML = l ? `${l.narr ? '' : `<b>${esc(l.speaker)}</b>`}${esc(l.text)}` : '';
        }
        const restep = el => { el.classList.remove('is-step'); void el.offsetWidth; el.classList.add('is-step'); };
        /** Focus given in the task that opened the frame can be dropped by the browser's focus fixup at its first paint (the
            key then shows no focus and Enter does nothing): given again after a tick and after the next two frames, unless
            the frame has moved on or the focus is already somewhere in it. */
        function settleFocus(el) {
            if (!el) return;
            const st = F.state, again = () => { if (!F.finished && !F.closing && F.state === st && !isOwn(document.activeElement)) el.focus({ preventScroll: true }); };
            el.focus({ preventScroll: true });
            later(0, again); later(FOCUS_AGAIN_MS, again);
            requestAnimationFrame(() => requestAnimationFrame(again));
        }
        function showTalk(i) {
            F.index = i;
            setPrev(i > 0 ? talk[i - 1] : null);
            setSay(sayEl, talk[i]);
            if (!F.shown) return;
            restep(sayEl);
            if (talk[i] && !talk[i].narr) emit('card:speaker', { name: talk[i].speaker, tone: talk[i].tone });
        }
        function outHtml(page, isLast) {
            return page.map(l => `<div class="${sayClass(l)}">${sayHtml(l)}</div>`).join('') + (isLast ? chipsHtml(F.out.chips) : '');
        }

        // ── the fixed top: every state laid out once, hidden; the tallest sets the room (DESIGN 1.1) ──
        function layout() {
            const vw = innerWidth, vh = innerHeight, k = vw >= WHOLE_AT ? 2 : 1, crop = vh < CROP_UNDER;
            sec.style.setProperty('--pic-k', String(k));
            sec.style.setProperty('--pic-w', `${PIC_W * k}px`);
            sec.style.setProperty('--pic-h', `${(crop ? CROP_ROWS : PIC_H) * k}px`);
            sec.style.setProperty('--pic-crop', `${crop ? ((PIC_H - CROP_ROWS) / 2) * k : 0}px`);
            wordsEl.style.minHeight = ''; keysEl.style.minHeight = '';
            const keep = { prev: prevEl.innerHTML, prevCls: prevEl.className, say: sayEl.innerHTML, sayCls: sayEl.className, out: outEl.innerHTML, outHidden: outEl.hidden, sayHidden: sayEl.hidden,
                choices: choicesEl.hidden, talk: talkEl.hidden, go: goEl.hidden };
            sec.style.visibility = 'hidden';
            const wordsH = [];
            outEl.hidden = true; sayEl.hidden = false;
            talk.forEach((l, i) => { setPrev(i > 0 ? talk[i - 1] : null); setSay(sayEl, l); wordsH.push(wordsEl.offsetHeight); });
            const told = m.outcome && m.outcome.pages ? [].concat(...m.outcome.pages) : [];   // a report: its own lines set the room
            const longest = talk.concat(told).reduce((a, l) => (l && l.text && l.text.length > (a ? a.text.length : 0) ? l : a), null);
            setPrev(null); setSay(sayEl, longest); wordsH.push(wordsEl.offsetHeight);
            sayEl.hidden = true; outEl.hidden = false;                                                     // the outcome: a line and its chip row (a longer one grows down)
            outEl.innerHTML = `<div class="${sayClass({ tone: 'aura' })}">${sayHtml({ speaker: 'A', text: (longest && longest.text) || 'A' })}</div>${chipsHtml([{ text: '+0 Energy', tone: 'gain' }])}`;
            wordsH.push(wordsEl.offsetHeight);
            const keysH = [];
            [[talkEl], [choicesEl], [goEl]].forEach(([el]) => { talkEl.hidden = choicesEl.hidden = goEl.hidden = true; el.hidden = false; keysH.push(keysEl.offsetHeight); });
            Object.assign(prevEl, { className: keep.prevCls }); prevEl.innerHTML = keep.prev;
            sayEl.className = keep.sayCls; sayEl.innerHTML = keep.say; outEl.innerHTML = keep.out; outEl.hidden = keep.outHidden; sayEl.hidden = keep.sayHidden;
            choicesEl.hidden = keep.choices; talkEl.hidden = keep.talk; goEl.hidden = keep.go;
            wordsEl.style.minHeight = `${Math.max(...wordsH)}px`;
            keysEl.style.minHeight = `${Math.max(...keysH)}px`;
            sec.style.visibility = '';
            const top = Math.max(FLOOR_PX, Math.round((vh - sec.offsetHeight) / 2));
            sec.style.marginTop = `${top}px`;
            F.top = top;
        }

        // ── in: when the frame is first seen (NewScreen may hold it while the dive or the sector title plays) ──
        function reveal() {
            if (F.shown || F.closing) return;
            F.shown = true; F.shownAt = now();
            const rm = reduced(), steps = m.isRepeat ? REVEAL_REPEAT : REVEAL_FIRST;
            const wordsAt = rm ? 0 : VEIL_STEPS * STEP_UI + (m.isRepeat ? STEP_ART : Math.ceil(steps / 2) * STEP_ART);
            sec.style.setProperty('--words-at', `${wordsAt}ms`);
            sec.style.setProperty('--keys-at', `${wordsAt + 2 * STEP_UI}ms`);
            overlay.classList.add('is-in');
            if (m.isRepeat) sec.classList.add('is-repeat');
            if (rm) coverAt(cover, 1, 1);
            else for (let s = 1; s <= steps; s++) later(VEIL_STEPS * STEP_UI + (s - 1) * STEP_ART, () => coverAt(cover, s, steps));
            if (m.outcome) showOutcome(m.outcome);                               // a report: what happened, then Continue
            else if (talk.length <= 1) openChoices(true);
            else { settleFocus(nextEl); if (talk[F.index] && !talk[F.index].narr) emit('card:speaker', { name: talk[F.index].speaker, tone: talk[F.index].tone }); }
        }

        // ── the talk ──
        function advance() {
            if (F.state !== 'talk' || !F.shown || F.closing) return;
            if (F.index >= talk.length - 1) { openChoices(false); return; }
            showTalk(F.index + 1);
        }
        function skip() {
            if (F.state !== 'talk' || !F.shown) return;
            if (talk.length && F.index < talk.length - 1) showTalk(talk.length - 1);
            openChoices(false);
        }

        // ── the choices ──
        function openChoices(atOnce) {
            F.state = 'choices';
            prevEl.classList.add('is-gone');                                     // only the line nearest the decision
            talkEl.hidden = true;
            choicesEl.hidden = false;
            choicesEl.classList.add(atOnce && m.isRepeat ? 'is-at-once' : 'is-open');
            if (!atOnce) choicesEl.style.setProperty('--keys-at', '0ms');
            F.choicesAt = now();
            if (window.ChoiceGuard) window.ChoiceGuard.hold(choicesEl);
            choicesEl.tabIndex = -1;
            const safe = safeIndex();
            if (m.shape === 'ask' && safe >= 0) settleFocus(btns[safe]);        // an ask: "Not yet" has the focus
            else if (m.shape === 'report' && keys.length === 1 && !btns[0].disabled && !keys[0].final) settleFocus(btns[0]);
            else settleFocus(choicesEl);                                         // a decide: the row, so a leftover Enter never picks unread
            point();
        }
        /** The key pointed at or focused shows its consequence (focus looks like pointing); one at a time. */
        function point() {
            const fi = btns.indexOf(document.activeElement), i = F.hold ? F.hold.i : F.hovered >= 0 ? F.hovered : fi;   // a key being held is the one pointed
            keyEls.forEach((el, j) => el.classList.toggle('is-pointed', j === i || (F.again && F.again.i === j)));
        }
        function activate(i) {
            if (F.state !== 'choices' || F.picked || F.closing || !btns[i] || btns[i].disabled || guarded(F.choicesAt)) return;
            if (keys[i].final) { if (reduced()) pressAgain(i); return; }       // a final key is held, never clicked
            pick(i);
        }
        function setFill(i, k) { btns[i].dataset.fill = String(k); btns[i].style.setProperty('--fill', String(k)); keyEls[i].classList.toggle('is-holding', k > 0); }
        /** A held key let go before it filled: its ticks blink once, so a click on it is never met with nothing. */
        function nudge(i) {
            keyEls[i].classList.remove('is-nudge'); void keyEls[i].offsetWidth; keyEls[i].classList.add('is-nudge');
            later(NUDGE_MS, () => keyEls[i].classList.remove('is-nudge'));
        }
        function startHold(i, by) {
            if (F.state !== 'choices' || F.picked || !btns[i] || btns[i].disabled || !keys[i].final || guarded(F.choicesAt)) return;
            if (reduced()) { pressAgain(i); return; }
            stopHold(false);
            if (document.activeElement !== btns[i]) btns[i].focus({ preventScroll: true });   // held is pointed: its consequence shows
            const t0 = now();
            setFill(i, 1);                                                       // the first tick at the press
            F.hold = { i, by, t0, timer: setInterval(() => {
                const ms = now() - t0;
                setFill(i, Math.min(HOLD_STEPS, 1 + Math.floor(ms * HOLD_STEPS / HOLD_MS)));
                if (ms >= HOLD_MS) { stopHold(true); pick(i); }
            }, STEP_UI) };
            point();
        }
        function stopHold(isDone) {
            const h = F.hold;
            if (!h) return;
            clearInterval(h.timer);
            F.hold = null;
            if (!isDone) { setFill(h.i, 0); nudge(h.i); point(); }                // let go early: it drains in one step and blinks
        }
        /** Reduced motion: a final key asks to be pressed again (DESIGN 1.1). */
        function pressAgain(i) {
            if (F.again && F.again.i === i && now() - F.again.t < AGAIN_MS) { F.again = null; pick(i); return; }
            keyEls[i].insertAdjacentHTML('beforeend', `<p class="ef-conseq is-again"><span>${PRESS_AGAIN}</span></p>`);
            const line = keyEls[i].lastElementChild;
            F.again = { i, t: now(), restore: () => line.remove() };
            setFill(i, Math.ceil(HOLD_STEPS / 2));
            point();
            const mine = F.again;
            later(AGAIN_MS, () => { if (F.again === mine) { mine.restore(); F.again = null; setFill(i, 0); point(); } });
        }
        function pick(i) {
            if (F.picked || F.closing) return;
            F.picked = true;
            stopHold(true);
            if (F.again) { F.again.restore(); F.again = null; }
            keyEls.forEach((el, j) => el.classList.add(j === i ? 'is-picked' : 'is-dim'));
            btns[i].classList.add('is-held');                                    // ● for two steps, the others step to --dim
            later(reduced() ? 0 : 2 * STEP_UI, () => {
                let res = null;
                try { res = hooks && hooks.pick ? hooks.pick(i) : null; } catch (err) { console.error('NSFrame: the pick failed', err); }
                if (!overlay.isConnected) { finish(); return; }
                if (!res) close(); else showOutcome(res);
            });
        }

        // ── the outcome: the same slots (who, one line, one chip row, Continue) ──
        function showOutcome(res) {
            F.state = 'outcome'; F.out = res; F.page = 0;
            choicesEl.hidden = true; talkEl.hidden = true; goEl.hidden = false;
            prevEl.classList.add('is-gone');
            sayEl.hidden = true; outEl.hidden = false;
            const notesEl = $('.ef-notes');
            if (notesEl) notesEl.hidden = true;                                  // what it was going in to is past
            const ro = $('.ef-readout');
            if (ro && typeof res.readout === 'string') { ro.textContent = res.readout; ro.hidden = !res.readout; }   // a readout the pick made untrue
            showPage(0);
            if (res.printout) showPrintout(res.printout);
            F.outAt = now();
            const guard = window.ChoiceGuard;
            if (guard) { guard.hold(goEl); if (typeof guard.keepOffClick === 'function') guard.keepOffClick(goEl, [goBtn]); }   // never moves: it waits
            settleFocus(goBtn);
        }
        function showPage(p) {
            F.page = p;
            const pages = F.out.pages, isLast = p >= pages.length - 1;
            outEl.innerHTML = outHtml(pages[p] || [], isLast);
            goBtn.textContent = isLast ? KEY_WORDS.go : KEY_WORDS.next;
            restep(outEl);
            (pages[p] || []).forEach(l => { if (!l.narr) emit('card:speaker', { name: l.speaker, tone: l.tone }); });
        }
        /** The printout (DESIGN 1.1): the document itself on the picture, its lines typed one by one; the outcome's line and
            Continue after (until then a key types the rest at once: F.typing). */
        function showPrintout(p) {
            const NF = window.NSFinds;
            if (!NF || !NF.isOn() || !Array.isArray(p.lines)) return;
            const v = NF.page({ kind: 'list', id: 'list', lines: p.lines }, { lineMs: PRINT_MS }), box = document.createElement('div');
            box.className = 'ef-print'; box.appendChild(v.el); pic.appendChild(box);
            v.mount(); F.printout = v;
            outEl.classList.add('is-after'); goEl.classList.add('is-after');
            const all = NF.pace(v, overlay, PRINT_MS, () => {
                F.typing = null; F.outAt = now();
                outEl.classList.remove('is-after'); goEl.classList.remove('is-after'); restep(outEl); restep(goEl); settleFocus(goBtn);
            });
            if (outEl.classList.contains('is-after')) F.typing = all;
        }
        function go() {
            if (F.state !== 'outcome' || F.closing || guarded(F.outAt)) return;
            if (F.typing) { const all = F.typing; F.typing = null; all(); return; }   // the list typed at once; Continue next
            if (F.page < F.out.pages.length - 1) { showPage(F.page + 1); F.outAt = now(); return; }
            close();
        }

        // ── out: everything in 3 steps, the veil last ──
        function close() {
            if (F.closing) return;
            F.closing = true;
            stopHold(false);
            overlay.classList.add('is-out');
            later(reduced() ? 0 : 2 * OUT_STEPS * STEP_UI, finish);
        }
        function finish() {
            if (F.finished) return;
            F.finished = true;
            F.timers.forEach(id => clearTimeout(id)); F.timers.clear();
            stopHold(false);
            removeEventListener('keydown', onKeyDown, true); removeEventListener('keyup', onKeyUp, true);
            removeEventListener('pointerup', onPointerUp, true); removeEventListener('pointercancel', onPointerUp, true);
            removeEventListener('resize', onResize);
            if (heldWatch) heldWatch.disconnect();
            if (typeof F.stopPic === 'function') F.stopPic();
            if (F.printout) F.printout.destroy();
            overlay.remove();
            const at = stack.indexOf(F);
            if (at >= 0) stack.splice(at, 1);
            emit('card:closed', {});
            try { if (hooks && hooks.done) hooks.done(); } catch (err) { console.error('NSFrame: closing failed', err); }
        }
        F.finish = finish;

        // ── input ──
        const isTop = () => stack[stack.length - 1] === F;
        const isLive = () => F.shown && !F.closing && !overlay.classList.contains('ns-held') && overlay.isConnected && isTop();
        function moveFocus(d) {
            const on = enabled();
            if (!on.length) return;
            const at = on.indexOf(btns.indexOf(document.activeElement));
            btns[on[at < 0 ? (d > 0 ? 0 : on.length - 1) : (at + d + on.length) % on.length]].focus({ preventScroll: true });
        }
        function onKeyDown(e) {
            if (!isLive()) return;
            const k = e.key, onButton = e.target && e.target.tagName === 'BUTTON' && isOwn(e.target);
            const own = () => { e.preventDefault(); e.stopPropagation(); };
            if (k === 'Tab') { own(); cycle(e.shiftKey ? -1 : 1); return; }           // aria-modal: nothing behind the frame takes the focus
            if (F.state === 'talk') {
                if (k === 'Escape') { own(); if (!e.repeat && !guarded(F.shownAt)) skip(); }
                else if ((k === 'Enter' || k === ' ' || k === 'ArrowRight') && !(onButton && k !== 'ArrowRight')) { own(); if (!e.repeat && !guarded(F.shownAt)) advance(); }
                return;
            }
            if (F.state === 'choices') {
                const fi = btns.indexOf(document.activeElement);
                if (k === 'ArrowRight' || k === 'ArrowLeft') { own(); moveFocus(k === 'ArrowRight' ? 1 : -1); }
                else if (/^[1-9]$/.test(k)) {
                    own();
                    const i = enabled()[Number(k) - 1];
                    if (i == null || e.repeat) return;
                    if (keys[i].final && !reduced()) startHold(i, `key:${k}`); else activate(i);
                } else if ((k === 'Enter' || k === ' ') && fi >= 0 && keys[fi].final && !reduced()) { own(); if (!e.repeat) startHold(fi, `key:${k}`); }
                else if (k === 'Escape') { own(); const s = safeIndex(); if (m.shape === 'ask' && s >= 0 && !e.repeat) activate(s); }
                return;
            }
            if (F.state === 'outcome' && (k === 'Escape' || ((k === 'Enter' || k === ' ') && !onButton))) { own(); if (!e.repeat) go(); }
        }
        /** Tab and Shift+Tab: round the frame's own keys that show now. */
        function cycle(d) {
            const list = [...overlay.querySelectorAll('button')].filter(b => !b.disabled && b.getClientRects().length && getComputedStyle(b).visibility === 'visible');
            if (!list.length) return;
            const at = list.indexOf(document.activeElement);
            list[at < 0 ? (d > 0 ? 0 : list.length - 1) : (at + d + list.length) % list.length].focus({ preventScroll: true });
        }
        function onKeyUp(e) { if (F.hold && F.hold.by === `key:${e.key}`) { e.preventDefault(); stopHold(false); } }
        function onPointerUp() { if (F.hold && F.hold.by === 'pointer') stopHold(false); }
        function onResize() { clearTimeout(F.resizeT); F.resizeT = setTimeout(() => { if (!F.finished) layout(); }, RESIZE_MS); }

        nextEl.addEventListener('click', () => { if (!guarded(F.shownAt)) advance(); });
        skipEl.addEventListener('click', () => { if (!guarded(F.shownAt)) skip(); });
        goBtn.addEventListener('click', go);
        wordsEl.addEventListener('click', () => { if (F.state === 'talk' && !guarded(F.shownAt)) advance(); });
        pic.addEventListener('click', () => { if (F.state === 'talk' && !guarded(F.shownAt)) advance(); });
        keyEls.forEach((el, i) => {
            el.addEventListener('mouseenter', () => { F.hovered = i; point(); });
            el.addEventListener('mouseleave', () => { if (F.hovered === i) F.hovered = -1; point(); });
            el.addEventListener('click', e => { if (e.target.closest('.ef-key') === el) activate(i); });
            el.addEventListener('pointerdown', e => { if (e.button === 0 && keys[i].final && !reduced()) { e.preventDefault(); btns[i].focus({ preventScroll: true }); startHold(i, 'pointer'); } });
            el.addEventListener('pointerleave', () => { if (F.hold && F.hold.i === i && F.hold.by === 'pointer') stopHold(false); });
            btns[i].addEventListener('focus', point);
            btns[i].addEventListener('blur', () => setTimeout(point, 0));
        });
        addEventListener('keydown', onKeyDown, true); addEventListener('keyup', onKeyUp, true);
        addEventListener('pointerup', onPointerUp, true); addEventListener('pointercancel', onPointerUp, true);
        addEventListener('resize', onResize);

        // the first line in place before the room is measured, so the frame never moves after
        if (talk.length) showTalk(0); else { setPrev(null); setSay(sayEl, null); }
        layout();
        // NewScreen holds a frame that turns up on its own (ns-held) until the picture behind it has been seen: it comes in then
        heldWatch = new MutationObserver(() => { if (!overlay.classList.contains('ns-held')) reveal(); });
        heldWatch.observe(overlay, { attributes: true, attributeFilter: ['class'] });
        setTimeout(() => { if (!F.finished && !overlay.classList.contains('ns-held')) reveal(); }, 0);   // after NewScreen has looked at it
        return overlay;
    }

    // a frame taken off the page by anything else still closes properly: the gate it holds is released
    new MutationObserver(records => records.forEach(r => r.removedNodes.forEach(n => {
        const F = stack.find(f => f.overlay === n);
        if (F && !F.finished && typeof F.finish === 'function') F.finish();
    }))).observe(document.body, { childList: true });

    function debug() {
        const F = stack[stack.length - 1];
        if (!F) return null;
        const r = F.overlay.querySelector('.enc-frame').getBoundingClientRect();
        return { state: F.state, index: F.index, shown: F.shown, picked: F.picked, top: Math.round(r.top), height: Math.round(r.height), holding: F.hold ? F.hold.i : null, page: F.page };
    }

    window.NSFrame = Object.freeze({ open, debug });
})();
