/* FoundPage — a page found in a dead ship, read one line at a time.
   The six pages in EXODUS_LOGS are the spine of the story. Each is drawn as the object it is (a cast plate, a printed page,
   a captain's log screen, the launch ledger) on the left, with its lines on the right, then one spoken line from whoever
   aboard would say something. open(app, page) shows it; the page stays in cargo (isKept) and can be read again from there.
   The ledger is built at run time from the wrecks this player actually boarded, so the proof is their own journey. */

(function () {
    'use strict';
    const SIZE = 300, TICK_MS = 100;
    const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    const dith = (x, y, v) => v * 16 > BAYER[(y & 3) * 4 + (x & 3)];
    const METAL = ['#0b0d10', '#2a2d2a', '#5c6058', '#8f8a7a', '#c4d0c4'], PAPER = ['#141108', '#5a4a2a', '#a08a5a', '#d8c8a0', '#f4ecd6'];
    const SCREEN_BG = '#05070a', SCREEN_INK = '#2f5a48', SCREEN_LIT = '#74d99a', READER = '#8844ff';
    const LEDGER_FILL_ROWS = 9, LEDGER_YEAR0 = 2281;           // filler rows around the player's own wrecks; the programme's first keel

    const KICKER = { plate: 'A CAST PLATE · BESIDE THE AIRLOCK', paper: 'A PRINTED PAGE · EARTH LETTERHEAD', log: 'THE LAST ENTRY · CAPTAIN\'S LOG', ledger: 'BOUND PRINTOUT · EVERY HULL EVER LAID' };
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

    // ── the ledger: rows of hulls, built from the wrecks this player boarded ──
    const hullOf = name => { const m = /EXODUS-([\d,]+)/.exec(name || ''); return m ? parseInt(m[1].replace(/,/g, ''), 10) : null; };
    const fmt = n => n.toLocaleString('en-US');
    function ledgerRows(state) {
        const mine = (state._boardedHulls || []).map(hullOf).filter(n => n && n !== 9), rand = seeded(mine.length + 3), rows = new Set(mine);
        const RANGES = [[212, 980], [1400, 6000], [9000, 22000], [30000, 41000]];
        for (let k = 0; k < LEDGER_FILL_ROWS; k++) { const [lo, hi] = RANGES[k % RANGES.length]; rows.add(lo + Math.floor(rand() * (hi - lo))); }
        const hulls = [...rows].sort((a, b) => a - b);
        const launched = hull => LEDGER_YEAR0 + Math.floor(hull / 700), failed = hull => launched(hull) - 40 - Math.floor(hull / 110);   // every failure is earlier than its launch
        return hulls.map(hull => ({ hull: `EXODUS-${fmt(hull)}`, crew: 4, cmdr: '—', launched: launched(hull), failed: failed(hull), mine: mine.includes(hull) }))
            .concat([{ hull: 'EXODUS-9', crew: 4, cmdr: '—', launched: LEDGER_YEAR0, failed: '', mine: true, isYou: true }]);
    }
    function ledgerHtml(state) {
        const rows = ledgerRows(state);
        return `<div class="found-ledger" role="table"><div class="found-ledger-row found-ledger-head" role="row"><span>HULL</span><span>CREW</span><span>CMDR</span><span>LAUNCHED</span><span>FAILED</span></div>
            ${rows.map(r => `<div class="found-ledger-row${r.mine ? ' is-mine' : ''}${r.isYou ? ' is-you' : ''}" role="row"><span>${esc(r.hull)}</span><span>${r.crew}</span><span>${r.cmdr}</span><span>${r.launched}</span><span>${r.failed === '' ? '<i>—</i>' : r.failed}</span></div>`).join('')}
            <p class="found-ledger-note">rows in gold are hulls you boarded</p></div>`;
    }

    // ── the card ──
    function open(app, page, foundIn) {
        if (!page || document.querySelector('.found-page')) return;
        const state = app && app.state, isLedger = page.kind === 'ledger', shipName = foundIn || page.shipName || 'a dead ship';
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay disc-doc found-page';
        overlay.style.zIndex = '4000';
        overlay.innerHTML = `
            <section class="modal-content deck-panel disc-doc-card found-page-card" role="dialog" aria-label="${esc(page.name)}">
                <header class="enc-head"><p class="enc-kicker" style="color:var(--amber)">FOUND IN ${esc(shipName)} · ${KICKER[page.kind] || 'A PAGE'}</p><h3>${esc(page.logTitle)}</h3></header>
                <div class="disc-doc-body">
                    ${isLedger ? ledgerHtml(state) : `<canvas class="disc-doc-canvas" width="${SIZE}" height="${SIZE}"></canvas>`}
                    <div class="disc-doc-notes found-page-lines" aria-live="polite">
                        ${page.names ? `<ul class="found-plate-names">${page.names.map(n => `<li>${n ? esc(n) : '<i>— blank —</i>'}</li>`).join('')}</ul>` : ''}
                        <ol class="found-page-text"></ol>
                        <button class="found-page-next deck-action" type="button"><span>READ ON</span></button>
                        <p class="found-page-after" hidden></p>
                    </div>
                </div>
                <div class="deck-panel-actions"><button class="deck-action disc-doc-close"><span>KEEP IT</span><small>it stays in your cargo</small></button></div>
            </section>`;
        document.body.appendChild(overlay);
        const list = overlay.querySelector('.found-page-text'), next = overlay.querySelector('.found-page-next'), after = overlay.querySelector('.found-page-after');
        let shown = 0;
        const reveal = () => {
            if (shown < page.lines.length) { const li = document.createElement('li'); li.textContent = page.lines[shown++]; list.appendChild(li); li.classList.add('is-in'); }
            if (shown >= page.lines.length) {
                next.hidden = true;
                const speakerIsDead = page.after && state && state.isSilentSpeaker && page.after.speaker !== 'A.U.R.A.' && state.isSilentSpeaker(`${page.after.speaker}: `);
                if (page.after && !speakerIsDead) { after.hidden = false; after.innerHTML = `<b>${esc(page.after.speaker)}</b>${esc(page.after.text)}`; if (state && state.addLog) state.addLog(`${page.after.speaker}: "${page.after.text}"`); }
            }
        };
        next.addEventListener('click', reveal);
        reveal();
        const canvas = overlay.querySelector('canvas');
        if (canvas) {
            const ctx = canvas.getContext('2d'), startedAt = performance.now(), draw = DRAW[page.kind] || drawPaper;
            const timer = setInterval(() => { if (!overlay.isConnected) { clearInterval(timer); return; } draw(ctx, page, performance.now() - startedAt); }, TICK_MS);
            draw(ctx, page, 0);
        }
        const close = () => { overlay.remove(); if (state && state.emitUpdates) state.emitUpdates(); };
        overlay.querySelector('.disc-doc-close').addEventListener('click', close);
        overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
        next.focus({ preventScroll: true });
    }

    window.FoundPage = { open };
})();
