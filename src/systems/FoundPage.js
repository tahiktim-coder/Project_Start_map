/* FoundPage — a page found in a dead ship. Its lines appear one after another by themselves (a click on them shows the rest);
   every line's place is kept from the start, so nothing on the card moves while it fills.
   The pages in EXODUS_LOGS are the spine of the story (sector 5's find is the disc itself, shown by DiscDocument instead).
   Each is drawn as the object it is (a cast plate, a printed page, a captain's log screen) on the left, with its lines on the
   right, then one spoken line from whoever aboard would say something. open(app, page) shows it and resolves when it is put
   away; the page stays in cargo (isKept) and can be read again from there. */

(function () {
    'use strict';
    const SIZE = 300, TICK_MS = 100, LINE_MS = 1100;             // a new line about every second: read at the page's pace, not by button
    const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    const dith = (x, y, v) => v * 16 > BAYER[(y & 3) * 4 + (x & 3)];
    const METAL = ['#0b0d10', '#2a2d2a', '#5c6058', '#8f8a7a', '#c4d0c4'], PAPER = ['#141108', '#5a4a2a', '#a08a5a', '#d8c8a0', '#f4ecd6'];
    const SCREEN_BG = '#05070a', SCREEN_INK = '#2f5a48', SCREEN_LIT = '#74d99a';
    const BACKDROP_GUARD_MS = 1200;                             // a click beside the page puts it away only once it has been up this long

    const KICKER = { plate: 'A CAST PLATE · BESIDE THE AIRLOCK', paper: 'A PRINTED PAGE · EARTH LETTERHEAD', log: 'THE LAST ENTRY · CAPTAIN\'S LOG' };
    const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    function seeded(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

    // ── the objects ──
    function shade(ctx, x, y, w, h, ramp, tone) {                 // a dithered flat of one tone from a ramp
        const level = Math.max(0, Math.min(ramp.length - 1.01, tone * (ramp.length - 1))), lo = Math.floor(level);
        for (let py = y; py < y + h; py++) for (let px = x; px < x + w; px++) { ctx.fillStyle = ramp[dith(px, py, level - lo) ? lo + 1 : lo]; ctx.fillRect(px, py, 1, 1); }
    }
    function raisedText(ctx, x, y, width, rand, lit) {            // a row of raised letter-shapes, no real letters: it is a plate seen from across a room
        let px = x;
        while (px < x + width) { const w = 2 + Math.floor(rand() * 4); ctx.fillStyle = lit ? '#e8e4d8' : '#8f8a7a'; ctx.fillRect(px, y, w, 3); if (rand() < 0.3) ctx.fillRect(px, y - 2, 1, 2); px += w + 2; }
    }
    function drawPlate(ctx, page, time) {
        const glint = ((time / 5000) % 1) * (SIZE + 80) - 40, rand = seeded(4);
        ctx.fillStyle = '#05070a'; ctx.fillRect(0, 0, SIZE, SIZE);
        shade(ctx, 30, 40, 240, 220, METAL, 0.42);                                                    // the plate
        for (let k = 0; k < 5; k++) {                                                                 // five panels cast into it; the last is blank
            const y = 58 + k * 40, lit = Math.abs(y + 12 - glint) < 30;
            shade(ctx, 46, y, 208, 28, METAL, lit ? 0.62 : 0.52);
            ctx.fillStyle = '#0b0d10'; ctx.fillRect(46, y + 27, 208, 1); ctx.fillRect(253, y, 1, 28);
            if (k < 4) raisedText(ctx, 56, y + 12, 150, rand, lit);
        }
        for (const [x, y] of [[38, 48], [262, 48], [38, 252], [262, 252]]) { ctx.fillStyle = '#0b0d10'; ctx.fillRect(x - 2, y - 2, 4, 4); }  // rivets
    }
    function drawPaper(ctx, page, time) {
        const rand = seeded(7);
        ctx.fillStyle = '#05070a'; ctx.fillRect(0, 0, SIZE, SIZE);
        shade(ctx, 40, 20, 220, 264, PAPER, 0.78);                                                   // the page
        shade(ctx, 40, 20, 220, 44, PAPER, 0.62);                                                    // letterhead band
        for (let k = 0; k < 3; k++) { ctx.fillStyle = '#5a4a2a'; ctx.fillRect(56, 34 + k * 8, 30 + k * 26, 2); }
        let y = 84;
        while (y < 250) { let x = 56; while (x < 240) { const w = 6 + Math.floor(rand() * 18); if (rand() < 0.86) { ctx.fillStyle = '#5a4a2a'; ctx.fillRect(x, y, w, 2); } x += w + 4; } y += 10; if (rand() < 0.2) y += 8; }
        ctx.fillStyle = '#a08a5a'; ctx.fillRect(56, 148, 170, 3);                                     // the line somebody underlined
        for (let k = 0; k < 28; k++) { ctx.fillStyle = k % 2 ? '#d8c8a0' : '#141108'; ctx.fillRect(232 + k, 256 - k, 28 - k, 1); }  // folded corner
    }
    function drawLog(ctx, page, time) {
        const rand = seeded(11), cursorOn = Math.floor(time / 500) % 2 === 0;
        ctx.fillStyle = '#05070a'; ctx.fillRect(0, 0, SIZE, SIZE);
        shade(ctx, 24, 36, 252, 228, METAL, 0.3);                                                    // a screen in a dead bridge
        ctx.fillStyle = SCREEN_BG; ctx.fillRect(36, 48, 228, 204);
        let y = 60;
        for (let row = 0; row < 15; row++) { let x = 44; const lit = row === 12; while (x < 240) { const w = 4 + Math.floor(rand() * 14); if (rand() < 0.8) { ctx.fillStyle = lit ? SCREEN_LIT : SCREEN_INK; ctx.fillRect(x, y, w, 2); } x += w + 3; } y += 12; if (rand() < 0.25) y += 6; if (y > 236) break; }
        if (cursorOn) { ctx.fillStyle = SCREEN_LIT; ctx.fillRect(44, 238, 6, 3); }
        for (let sy = 48; sy < 252; sy += 3) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(36, sy, 228, 1); }   // scanlines
    }
    const DRAW = { plate: drawPlate, paper: drawPaper, log: drawLog };

    // ── the card ──
    function open(app, page, foundIn) {
        if (!page || document.querySelector('.found-page')) return Promise.resolve();
        const state = app && app.state, shipName = foundIn || page.shipName || 'a dead ship';
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay disc-doc found-page';
        overlay.style.zIndex = '4000';
        overlay.innerHTML = `
            <section class="modal-content deck-panel disc-doc-card found-page-card" role="dialog" aria-label="${esc(page.name)}">
                <header class="enc-head"><p class="enc-kicker" style="color:var(--amber)">FOUND IN ${esc(shipName)} · ${KICKER[page.kind] || 'A PAGE'}</p><h3>${esc(page.logTitle)}</h3></header>
                <div class="disc-doc-body">
                    <canvas class="disc-doc-canvas" width="${SIZE}" height="${SIZE}"></canvas>
                    <div class="disc-doc-notes found-page-lines" aria-live="polite">
                        ${page.names ? `<ul class="found-plate-names">${page.names.map(n => `<li>${n ? esc(n) : '<i>— blank —</i>'}</li>`).join('')}</ul>` : ''}
                        <ol class="found-page-text">${page.lines.map(line => `<li style="visibility:hidden">${esc(line)}</li>`).join('')}</ol>
                        <p class="found-page-after" style="visibility:hidden"></p>
                    </div>
                </div>
                <div class="deck-panel-actions"><button class="deck-action disc-doc-close"><span>KEEP IT</span><small>it stays in your cargo</small></button></div>
            </section>`;
        document.body.appendChild(overlay);
        const openedAt = performance.now();
        const items = [...overlay.querySelectorAll('.found-page-text li')], after = overlay.querySelector('.found-page-after');
        const speakerIsDead = page.after && state && state.isSilentSpeaker && page.after.speaker !== 'A.U.R.A.' && state.isSilentSpeaker(`${page.after.speaker}: `);
        const hasAfter = !!(page.after && !speakerIsDead);
        if (hasAfter) after.innerHTML = `<b>${esc(page.after.speaker)}</b>${esc(page.after.text)}`;   // in place from the start: the card never grows
        else after.remove();
        // it opens just after a card's choice: KEEP IT never lands under that click (a double click would put it away unread)
        if (window.ChoiceGuard && window.ChoiceGuard.keepOffClick) window.ChoiceGuard.keepOffClick(overlay.querySelector('.found-page-card'), overlay.querySelectorAll('.disc-doc-close'));
        let shown = 0, isDone = false;
        const reveal = () => {
            if (shown < items.length) { const li = items[shown++]; li.style.visibility = ''; li.classList.add('is-in'); }
            if (shown < items.length || isDone) return;
            isDone = true;                                                                     // the spoken line, once, after the last line
            if (hasAfter) { after.style.visibility = ''; if (state && state.addLog) state.addLog(`${page.after.speaker}: "${page.after.text}"`); }
        };
        const showAll = () => { while (!isDone) reveal(); };
        const isReduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
        const pacer = setInterval(() => { if (!overlay.isConnected || isDone) { clearInterval(pacer); return; } reveal(); }, LINE_MS);
        overlay.querySelector('.found-page-lines').addEventListener('click', showAll);           // a click on the words: the rest at once
        reveal();
        if (isReduced) showAll();
        const canvas = overlay.querySelector('canvas');
        if (canvas) {
            const ctx = canvas.getContext('2d'), startedAt = performance.now(), draw = DRAW[page.kind] || drawPaper;
            const timer = setInterval(() => { if (!overlay.isConnected) { clearInterval(timer); return; } draw(ctx, page, performance.now() - startedAt); }, TICK_MS);
            draw(ctx, page, 0);
        }
        overlay.querySelector('.disc-doc-close').focus({ preventScroll: true });
        return new Promise(resolve => {
            const close = () => { overlay.remove(); if (state && state.emitUpdates) state.emitUpdates(); resolve(); };
            overlay.querySelector('.disc-doc-close').addEventListener('click', close);
            overlay.addEventListener('click', e => { if (e.target === overlay && performance.now() - openedAt > BACKDROP_GUARD_MS) close(); });
        });
    }

    window.FoundPage = { open };
})();
