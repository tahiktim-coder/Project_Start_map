/* DiscDocument — the disc humanity threw out of its solar system, as a page you can find and study.
   A dithered gold disc with four things etched on it (the map home, the two figures, our planets, the atom that sets the scale),
   and something slowly reading across it. Point at a label to light up that part of the drawing and read one short note.
   open(app) → shows it. The page lives in cargo as ITEMS.DISC_DRAWING (isKept: using it does not use it up). */

(function () {
    'use strict';
    const SIZE = 300, C = SIZE / 2, R = 140, TICK_MS = 100;
    const GOLD = ['#140d03', '#4a3510', '#8a6a22', '#d9a24a', '#ffe6a0'], ETCH = '#2a1c06', ETCH_LIT = '#fff4d0', READER = '#8844ff';
    const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    const dith = (x, y, v) => v * 16 > BAYER[(y & 3) * 4 + (x & 3)];

    // region = [centre x, centre y, radius] on the disc, used to light up the part being read about
    const NOTES = [
        { key: 'disc', label: 'THE DISC', region: [C, C, R], text: 'Gold. Thrown out of our solar system in 1977, bolted to a probe the size of a car. The oldest thing we ever sent anywhere.' },
        { key: 'map', label: 'THE MAP', region: [96, 168, 62], text: 'Fourteen lines from one point. Each line is a star that ticks like a clock. Where they meet is home. Anyone who can count can find us.' },
        { key: 'figures', label: 'THE TWO FIGURES', region: [206, 138, 40], text: 'What we look like. One of them is waving.' },
        { key: 'margin', label: 'WRITTEN IN THE MARGIN', region: [C, 52, 40], text: '“Why is this in a colony ship’s orders? Why is it the only page marked with our heading? — K.”' },
    ];

    function seeded(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

    /** Every etched pixel, worked out once: a mask, 1 where the metal is cut. */
    function buildEtching() {
        const marks = new Uint8Array(SIZE * SIZE), rand = seeded(1977);
        const dot = (x, y) => { const px = Math.round(x), py = Math.round(y); if (px >= 0 && px < SIZE && py >= 0 && py < SIZE) marks[py * SIZE + px] = 1; };
        const line = (x0, y0, x1, y1) => { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0)); for (let k = 0; k <= n; k++) dot(x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n); };
        const ring = (cx, cy, r) => { for (let a = 0; a < 6.283; a += 0.5 / r) dot(cx + Math.cos(a) * r, cy + Math.sin(a) * r); };

        for (let k = 0; k < 14; k++) {                                        // the map: fourteen pulsars, each with its own ticking written along the line
            const angle = (k / 14) * 6.283 + rand() * 0.3, length = 22 + rand() * 40, ox = 96, oy = 168;
            const ex = ox + Math.cos(angle) * length, ey = oy + Math.sin(angle) * length;
            line(ox, oy, ex, ey);
            for (let t = 8; t < length; t += 4) if (rand() < 0.6) { dot(ox + Math.cos(angle) * t - Math.sin(angle) * 2, oy + Math.sin(angle) * t + Math.cos(angle) * 2); }
        }
        [[196, 0], [216, 1]].forEach(([x, isWaving]) => {                    // two figures; the right one waves
            ring(x, 114, 4); line(x, 118, x, 142); line(x, 142, x - 5, 160); line(x, 142, x + 5, 160);
            line(x, 124, x - 7, 136); if (isWaving) { line(x, 124, x + 8, 114); } else line(x, 124, x + 7, 136);
        });
        ring(60, 236, 6);                                                     // our sun and its planets, and the path the probe took out from the third
        for (let k = 0; k < 9; k++) ring(78 + k * 15, 236, k === 4 || k === 5 ? 4 : 2);
        for (let a = 3.4; a < 5.2; a += 0.02) dot(108 + Math.cos(a) * 46 + 40, 236 + Math.sin(a) * 40 + 36);
        ring(222, 204, 5); ring(244, 204, 5); line(227, 204, 239, 204); dot(222, 204); dot(244, 204); // hydrogen: the ruler everything else is measured in
        ring(C, 52, 16); for (let a = 0; a < 6.283; a += 0.39) line(C + Math.cos(a) * 16, 52 + Math.sin(a) * 16, C + Math.cos(a) * 20, 52 + Math.sin(a) * 20); // how to play it
        return marks;
    }

    function draw(ctx, marks, time, focus) {
        const glint = time / 4000, scan = ((time / 9000) % 1) * (SIZE + 60) - 30;
        for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
            const dx = x - C, dy = y - C, d = Math.hypot(dx, dy);
            if (d > R) { ctx.fillStyle = '#05070a'; ctx.fillRect(x, y, 1, 1); continue; }
            const angle = Math.atan2(dy, dx);
            let shine = 0.42 + 0.34 * Math.cos(2 * (angle - glint)) + (d > R - 3 ? 0.2 : 0);      // brushed metal: two bright fans that turn slowly
            if (d > 112 && Math.floor(d) % 3 === 0) shine -= 0.3;                                  // the grooves round the rim
            const inFocus = focus && Math.hypot(x - focus[0], y - focus[1]) < focus[2];
            if (focus && !inFocus) shine *= 0.45;
            const level = Math.max(0, Math.min(3.99, shine * 4)), lo = Math.floor(level);
            let color = GOLD[dith(x, y, level - lo) ? lo + 1 : lo];
            if (marks[y * SIZE + x]) color = inFocus ? ETCH_LIT : ETCH;
            if (Math.abs(x - scan) < 14 && dith(x, y, 0.5 - Math.abs(x - scan) / 28)) color = READER; // something is reading it, left to right, over and over
            ctx.fillStyle = color; ctx.fillRect(x, y, 1, 1);
        }
    }

    function open(app) {
        if (document.querySelector('.disc-doc')) return;
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay disc-doc';
        overlay.style.zIndex = '4000';
        overlay.innerHTML = `
            <section class="modal-content deck-panel disc-doc-card" role="dialog" aria-label="Drawing of the disc">
                <header class="enc-head"><p class="enc-kicker" style="color:var(--amber)">FOUND IN THE WRECK · A PAGE FOLDED INTO THE LOGBOOK</p><h3>The disc</h3></header>
                <div class="disc-doc-body">
                    <canvas class="disc-doc-canvas" width="${SIZE}" height="${SIZE}"></canvas>
                    <div class="disc-doc-notes">
                        ${NOTES.map(n => `<button class="disc-doc-note" data-key="${n.key}" type="button">${n.label}</button>`).join('')}
                        <p class="disc-doc-text" aria-live="polite"></p>
                    </div>
                </div>
                <p class="disc-doc-aura"><b>A.U.R.A.</b>An old curiosity, Commander. I would not spend time on it.</p>
                <div class="deck-panel-actions"><button class="deck-action disc-doc-close"><span>FOLD IT AWAY</span><small>it stays in your cargo</small></button></div>
            </section>`;
        document.body.appendChild(overlay);
        const ctx = overlay.querySelector('canvas').getContext('2d'), textEl = overlay.querySelector('.disc-doc-text');
        const marks = buildEtching(), startedAt = performance.now();
        let focus = null;
        const show = (note, btn) => {
            focus = note.key === 'disc' ? null : note.region;
            textEl.textContent = note.text;
            overlay.querySelectorAll('.disc-doc-note').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
        };
        overlay.querySelectorAll('.disc-doc-note').forEach(btn => {
            const note = NOTES.find(n => n.key === btn.dataset.key);
            btn.addEventListener('mouseenter', () => show(note, btn));
            btn.addEventListener('focus', () => show(note, btn));
            btn.addEventListener('click', () => show(note, btn));
        });
        show(NOTES[0], overlay.querySelector('.disc-doc-note'));
        const timer = setInterval(() => { if (!overlay.isConnected) { clearInterval(timer); return; } draw(ctx, marks, performance.now() - startedAt, focus); }, TICK_MS);
        draw(ctx, marks, 0, focus);
        const close = () => overlay.remove();
        overlay.querySelector('.disc-doc-close').addEventListener('click', close);
        overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
        overlay.querySelector('.disc-doc-close').focus({ preventScroll: true });
        if (app && app.state) app.state._hasSeenDisc = true;
    }

    window.DiscDocument = { open, NOTES };
})();
