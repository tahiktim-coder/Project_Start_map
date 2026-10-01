/* proto-blackbox.js — The black box.
   EXODUS-6's flight recorder lies open on a bench. Its last entry survived in six torn pieces. Put them back on the
   strip so the line runs on across every join: its height and its slope must carry over. A good join snaps shut and
   you catch the words across it; a wrong one jumps and shakes. The whole strip then plays the whole entry, in real time. */

(function () {
    'use strict';
    const Lab = window.Lab, C = Lab.C, W = Lab.W, H = Lab.H;

    const N = 6, PW = 48;                                   // six pieces, each 48 px wide
    const SEC = 16, TOTAL = (N * PW) / SEC;                 // px per second: a piece holds 3 s, the entry 18 s
    const SX = 16, SX1 = SX + N * PW;                       // the six slots on the strip
    const MID = 35, AMP = 15;                               // the strip's zero line; the line never leaves ±15 px
    const CARD_H = 36, CARD_MID = 18, CARD_Y = MID - CARD_MID, LIFT = 4;
    const BENCH_Y = 76, DROP_Y = 72;                        // a piece let go with its middle above DROP_Y goes on the strip
    const BOX = { x: 262, y: 128, w: 48, h: 42 };           // the recorder itself
    const FLASH = 0.5, SLIDE = 0.14, SHAKE = 0.3, DRAG_START = 2;
    const TEAR = [0, 1, 2, 1, 0, 2, 3, 1, 0, 1, 2, 0, 1, 3, 2, 1];
    const SPOTS = [[8, 82], [88, 80], [168, 84], [16, 124], [98, 128], [178, 122]];

    // Where the line crosses each join (px above the zero line) and its slope there. Join 0 is the leader, join 6 the tail.
    const JOINS = [[-4, 0.3], [12, -0.25], [-12, 0.35], [4, -0.4], [-8, 0.2], [8, -0.3], [0, 0.25]];
    const BODY = [[5, 7, 0.3], [7, 8, 1.9], [4, 9, 4.0], [6, 7, 2.6], [8, 6, 0.9], [5, 8, 5.1]]; // the voice inside each piece

    // EXODUS-6 launched about four years before us (we slept 61), so 45 years before this entry, made 20 years ago.
    const ENTRY = [
        'Captain Ruth Harlan, EXODUS-6. We found a wreck ahead of us today.',
        'It has our mission patch. The hull number is 212.',
        "We're hull six. That ship was built after us.",
        "Dele says it's been dead about eighty years. We launched forty-five years ago.",
        'Dele cooked the last of the rice. We ate without talking.',
    ];
    const WORDS = ENTRY.join(' ').split(' '), CUTS = [9, 10, 9, 9, 9, 9];           // how many words each piece carries
    const PIECE_WORDS = CUTS.map((n, k) => WORDS.slice(CUTS.slice(0, k).reduce((a, b) => a + b, 0)).slice(0, n));
    /** The words you catch across join s once it closes: the end of the piece before it and the start of the one after. */
    const ACROSS = Array.from({ length: N + 1 }, (_, s) =>
        (s > 0 ? PIECE_WORDS[s - 1].slice(-3) : []).concat(s < N ? PIECE_WORDS[s].slice(0, s ? 3 : 4) : []).join(' '));
    const LIST = [['EXODUS-4', 'R. OSEI'], ['EXODUS-4', 'T. YUEN'], ['EXODUS-6', 'RUTH HARLAN'], ['EXODUS-6', 'DELE']];

    /** Where word w of the entry sits on the strip (each piece spreads its own words across its 3 seconds). */
    function wordX(w) {
        let k = 0, left = w;
        while (k < N - 1 && left >= CUTS[k]) { left -= CUTS[k]; k++; }
        return SX + PW * (k + Math.min(1, left / CUTS[k]));
    }
    // Seconds into the recording where each line starts; the last value is the end of the entry.
    const LINE_T = ENTRY.reduce((acc, l) => acc.concat(acc[acc.length - 1] + l.split(' ').length), [0]).map(w => (wordX(w) - SX) / SEC);

    /** Height of piece k's line at column x (0..PW): a smooth curve between its two joins, with speech in the middle. */
    function heightAt(k, x) {
        const u = x / PW, u2 = u * u, u3 = u2 * u, [p0, s0] = JOINS[k], [p1, s1] = JOINS[k + 1], [cyc, size, ph] = BODY[k];
        const base = (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * s0 * PW + (3 * u2 - 2 * u3) * p1 + (u3 - u2) * s1 * PW;
        const voice = size * Math.sin(2 * Math.PI * cyc * u + ph) + 1.5 * Math.sin(37 * u + k * 3);
        return Lab.clamp(Math.round(base + Math.sin(Math.PI * u) ** 2 * voice), -AMP, AMP);
    }
    const WAVES = BODY.map((_, k) => Array.from({ length: PW + 1 }, (_, x) => heightAt(k, x)));

    /** Draw heights v (one per column, plus the end value) as a 1-px line from column x0, zero line at `mid`. */
    function trace(g, v, x0, mid, color, fill) {
        for (let i = 0; i < v.length - 1; i++) {
            const x = x0 + i, y = mid - v[i], yn = mid - v[i + 1];
            if (fill) Lab.shade(g, x, Math.min(y, mid), 1, Math.abs(y - mid), fill, C.greenD);
            const top = yn < y ? yn + 1 : y, bot = yn > y ? yn - 1 : y;
            g.fillStyle = color;
            g.fillRect(x, top, 1, bot - top + 1);
        }
    }
    /** A band of recording tape at (ox, oy), `w` wide; torn ends are ragged and lit along the tear. */
    function paintTape(g, ox, oy, w, tornL, tornR, k) {
        for (let y = 0; y < CARD_H; y++) {
            const l = tornL ? TEAR[(y + k * 3) % 16] : 0, r = w - 1 - (tornR ? TEAR[(y * 3 + k * 5 + 4) % 16] : 0);
            for (let x = l; x <= r; x++) {
                const rim = y === 0 || y === CARD_H - 1, cut = (x === l && tornL) || (x === r && tornR);
                g.fillStyle = rim ? C.line2 : cut ? (y % 3 ? C.line2 : C.boneD) : Lab.on(ox + x, oy + y, 0.28) ? C.line : C.ink2;
                g.fillRect(ox + x, oy + y, 1, 1);
            }
        }
        for (let x = 1; x < w; x += 3) Lab.dot(g, ox + x, oy + CARD_MID, C.line2);
    }
    function makeCard(k, tornL, tornR) {
        const c = Object.assign(document.createElement('canvas'), { width: PW, height: CARD_H }), g = c.getContext('2d');
        paintTape(g, 0, 0, PW, tornL, tornR, k);
        trace(g, WAVES[k], 0, CARD_MID, C.green, 0.22);
        return c;
    }
    /** A 1-px outline. */
    function rect(g, x, y, w, h, color, tone = 1) {
        [[x, y, x + w - 1, y], [x, y + h - 1, x + w - 1, y + h - 1], [x, y, x, y + h - 1], [x + w - 1, y, x + w - 1, y + h - 1]]
            .forEach(([x0, y0, x1, y1]) => Lab.line(g, x0, y0, x1, y1, color, tone));
    }
    function paintBox(g) {
        const { x, y, w, h } = BOX;
        Lab.shade(g, x + 2, y + h, w, 2, 0.6, C.ink2);                                          // its shadow
        g.fillStyle = C.ink2; g.fillRect(x, y, w, h);
        rect(g, x, y, w, h, C.amber);
        g.fillStyle = C.amber; [y + 5, y + h - 8].forEach(sy => g.fillRect(x + 1, sy, w - 2, 3)); // the orange bands
        Lab.text(g, 'EXODUS-6', x + Math.round((w - Lab.textWidth('EXODUS-6')) / 2), y + 16, C.amber);
    }
    function paintBench(g) {
        g.fillStyle = C.void; g.fillRect(0, 0, W, H);
        Lab.text(g, 'EXODUS-6 FLIGHT RECORDER - LAST ENTRY', 6, 3, C.boneD);
        g.fillStyle = C.ink; g.fillRect(4, 11, 312, 48);
        rect(g, 4, 11, 312, 48, C.line2);
        for (let x = SX; x <= SX1; x += SEC) Lab.line(g, x, 13, x, 56, C.line, 0.3);
        Lab.line(g, 6, MID, 313, MID, C.line2, 0.4);
        paintTape(g, 6, CARD_Y, SX - 6, false, false, 0);                                      // the leader, still on the reel
        paintTape(g, SX1, CARD_Y, 314 - SX1, false, false, 0);                                 // and the tail
        trace(g, Array.from({ length: SX - 5 }, (_, i) => Math.round(JOINS[0][0] - JOINS[0][1] * (SX - 6 - i))), 6, MID, C.green, 0.22);
        trace(g, Array.from({ length: 315 - SX1 }, (_, i) => Math.round(JOINS[N][0] + JOINS[N][1] * i)), SX1, MID, C.green, 0.22);
        Lab.line(g, SX, 61, SX1, 61, C.line2);
        for (let x = SX, s = 0; x <= SX1; x += SEC, s++) {
            if (s % (PW / SEC)) { Lab.dot(g, x, 62, C.line2); continue; }
            Lab.line(g, x, 62, x, 63, C.boneD);
            Lab.text(g, '0:' + String(s).padStart(2, '0'), x - 7, 65, C.boneD);
        }
        Lab.line(g, 0, BENCH_Y, W - 1, BENCH_Y, C.line2);
        Lab.shade(g, 0, BENCH_Y + 1, W, H - BENCH_Y - 1, 0.1, C.line);
        paintBox(g);
    }
    function drawLid(g, closed) {
        const { x, y, w } = BOX;
        if (closed) { g.fillStyle = C.amber; g.fillRect(x, y - 3, w, 3); Lab.line(g, x, y - 3, x + w - 1, y - 3, C.gold); return; }
        g.fillStyle = C.ink2; g.fillRect(x + 3, y - 16, w - 6, 15);                              // the lid, standing open
        rect(g, x + 3, y - 16, w - 6, 15, C.amber, 0.7);
        Lab.shade(g, x + 30, y - 9, 12, 9, 0.55, C.greenD);                                     // the memory board, half out
        [[32, -7], [35, -5], [38, -7], [33, -3]].forEach(([dx, dy]) => Lab.dot(g, x + dx, y + dy, C.green));
        Lab.dot(g, x + 39, y - 3, C.red);                                                        // a burnt chip
        [[x + 36, y - 10, 317, 104], [317, 104, 317, 40], [316, 40, 317, 40]].forEach(([a, b, c, d]) => Lab.line(g, a, b, c, d, C.line2)); // the lead
    }

    /** Each join: null while a side is empty, true when the line runs on, false when it jumps. -1 is the leader, N the tail. */
    const seams = sl => Array.from({ length: N + 1 }, (_, s) => {
        const l = s === 0 ? -1 : sl[s - 1], r = s === N ? N : sl[s];
        return l === null || r === null ? null : r === l + 1;
    });
    const slotAt = x => Lab.clamp(Math.floor((x - SX) / PW), 0, N - 1);
    const hover = slot => ({ x: SX + slot * PW, y: CARD_Y - LIFT });                           // a piece in hand, over a slot

    let cards = null;

    function mount(ctx, ui) {
        const focused = document.activeElement;
        if (focused && focused.classList && focused.classList.contains('pick')) focused.blur();  // so Space does not reopen the list item
        if (!cards) cards = WAVES.map((_, k) => [[makeCard(k, 0, 0), makeCard(k, 0, 1)], [makeCard(k, 1, 0), makeCard(k, 1, 1)]]);
        const bg = Object.assign(document.createElement('canvas'), { width: W, height: H });
        paintBench(bg.getContext('2d'));

        let run = 0, clock = 0, gen = 0, queue = [];
        let slots, home, zorder, sel, held, drag, flashes, slides, shake, glow, bump, phase, play, listT, hinted, spoke;
        const later = (sec, fn) => { const g = gen; queue = queue.concat({ at: clock + sec, fn: () => g === gen && fn() }); };
        const onBench = id => slots.indexOf(id) < 0;
        const raise = id => { zorder = zorder.filter(v => v !== id).concat(id); };
        const posOf = id => { const i = slots.indexOf(id); return i >= 0 ? { x: SX + i * PW, y: CARD_Y } : home[id]; };
        /** Where piece `id` is drawn: its place `base`, plus whatever is left of its slide into that place. */
        const at = (id, base) => { const sl = slides[id], k = sl ? (sl.t / SLIDE) ** 2 : 0; return sl ? { x: base.x + sl.dx * k, y: base.y + sl.dy * k } : base; };
        function glide(id, from, to) { slides = slides.map((sl, i) => (i === id ? { dx: from.x - to.x, dy: from.y - to.y, t: SLIDE } : sl)); }
        /** Run a change to the pieces; every piece that moved slides there from where it was drawn (or from `mover`). */
        function moving(change, mover) {
            const was = WAVES.map((_, id) => (mover && mover.id === id ? mover : at(id, posOf(id))));
            change();
            WAVES.forEach((_, id) => { const b = posOf(id); if (Math.round(was[id].x) !== b.x || Math.round(was[id].y) !== b.y) glide(id, was[id], b); });
        }

        function start() {
            gen++; queue = []; run++;
            const rnd = Lab.rng(606 + run * 7919);
            let perm;
            do { perm = [0, 1, 2, 3, 4, 5].map(v => [rnd(), v]).sort((a, b) => a[0] - b[0]).map(p => p[1]); } while (perm[0] === 0 || perm.every((id, i) => id === i));
            const spots = perm.map((_, j) => ({ x: SPOTS[j][0] + Math.floor(rnd() * 14) - 4, y: SPOTS[j][1] + Math.floor(rnd() * 6) }));
            home = WAVES.map((_, id) => spots[perm.indexOf(id)]);
            slots = Array(N).fill(null); zorder = perm.slice(); held = null; drag = null; flashes = []; slides = Array(N).fill(null);
            shake = null; glow = 0; bump = 0; phase = 'puzzle'; play = null; listT = 0; hinted = false; spoke = false;
            sel = order()[0];
            ui.clear();
            ui.say('A.U.R.A.', 'Flight recorder from EXODUS-6, Commander. The last entry survived in six pieces.');
            later(3, () => { if (!spoke) ui.say('Jaxon', 'Put them in order so the line runs on with no jumps. Then we can hear what happened.'); });
            showButtons();
        }
        /** Keyboard order: pieces on the strip left to right, then the bench by row. */
        const order = () => slots.filter(v => v !== null).concat(WAVES.map((_, id) => id).filter(onBench)
            .sort((a, b) => (Math.round(home[a].y / 40) - Math.round(home[b].y / 40)) || home[a].x - home[b].x));
        const lift = id => { const from = slots.indexOf(id); if (from >= 0) slots = slots.map(v => (v === id ? null : v)); return from; };
        /** A piece goes back to its own spot on the bench, or to `pos` if it was put down somewhere. */
        function toBench(id, pos, mover) {
            moving(() => { lift(id); if (pos) home = home.map((p, i) => (i === id ? pos : p)); raise(id); }, mover);
        }
        /** Put piece `id` in `slot`. Whatever was there swaps to the slot `id` came from, or back to the bench. */
        function place(id, slot, from, before, mover) {
            moving(() => {
                const occupant = slots[slot];
                slots = slots.map((v, i) => (i === slot ? id : i === from && occupant !== null ? occupant : v));
                if (occupant !== null && from < 0) raise(occupant);
            }, mover);
            judge(before, slot, id);
        }
        function judge(before, slot, id) {
            const was = seams(before), now = seams(slots), all = now.map((_, s) => s);
            const closed = all.filter(s => now[s] === true && was[s] !== true), broke = all.filter(s => now[s] === false && was[s] !== false);
            flashes = flashes.filter(f => !closed.includes(f.s) && !broke.includes(f.s))
                .concat(closed.concat(broke).map(s => ({ s, t: FLASH + SLIDE })));             // each flash waits for the piece to land
            if (broke.length) shake = { id, t: SHAKE + SLIDE };
            if (closed.length) {
                const near = closed.filter(s => s === slot || s === slot + 1), heard = (near.length ? near : closed).slice(0, 2);
                spoke = true; bump = FLASH;
                ui.say('EXODUS-6', (heard[0] > 0 ? '… ' : '') + heard.map(s => ACROSS[s]).join(' … ') + (heard[heard.length - 1] < N ? ' …' : ''));
            } else if (broke.length && !hinted) {
                hinted = true; spoke = true;
                ui.say('Jaxon', 'See the jump at that join? That piece goes somewhere else.');
            }
            if (now.every(v => v === true)) complete();
        }

        function complete() {
            phase = 'play'; held = null; drag = null; glow = 1 + SLIDE;
            flashes = Array.from({ length: N + 1 }, (_, s) => ({ s, t: FLASH + SLIDE + s * 0.07 })); // every join closes, left to right
            showButtons();
            later(1.4, roll);
        }
        const roll = () => { if (phase === 'play' && !play) play = { t0: clock, shown: -1 }; };
        /** Playback runs in real time: the playhead crosses 16 px a second and each line shows when the tape reaches it. */
        function playing() {
            const t = clock - play.t0, i = LINE_T.filter(v => v <= t).length - 1;
            if (t >= TOTAL + 0.6) { play = null; aris(); return; }
            if (i < ENTRY.length && i !== play.shown) { play = { ...play, shown: i }; ui.say('EXODUS-6', ENTRY[i]); }
        }
        function skip() {
            if (phase !== 'play') return;
            if (!play) { roll(); return; }                                                   // skipping the pause before it plays
            const t = clock - play.t0, next = LINE_T.find(v => v > t + 0.05);
            play = { ...play, t0: clock - (next < TOTAL ? next : TOTAL + 0.6) };
        }
        function aris() {
            phase = 'list'; listT = 0;
            ui.say('Aris', 'Ruth Harlan, and someone called Dele. The first ship I can put names to.');
            showButtons();
            later(4.2, () => { phase = 'end'; ui.say('A.U.R.A.', 'Entry saved, Commander. The recording is twenty years old.'); showButtons(); });
        }

        // ── controls ──
        function pickUp(id) {
            const p0 = at(id, posOf(id)), before = slots, from = lift(id);
            held = { id, target: from >= 0 ? from : Math.max(0, slots.indexOf(null)), from, before };
            sel = id; raise(id);
            glide(id, p0, hover(held.target));
        }
        function aim(target) {
            if (!held || target === held.target) return;
            const p0 = at(held.id, hover(held.target));
            held = { ...held, target };
            glide(held.id, p0, hover(target));
        }
        /** Put the piece in hand into `slot`, or back on its own spot on the bench when slot is -1. */
        function putDown(slot) {
            const h = held, mover = { id: h.id, ...at(h.id, hover(h.target)) };
            held = null;
            if (slot < 0) { toBench(h.id, null, mover); return; }
            place(h.id, slot, h.from, h.before, mover);
            const rest = order().filter(onBench);
            if (rest.length) sel = rest[0];
        }
        function act(kind) {
            if (phase !== 'puzzle' || drag) return;
            const d = kind === 'left' ? -1 : 1;
            if ((kind === 'left' || kind === 'right') && held) aim(Lab.clamp(held.target + d, 0, N - 1));
            else if (kind === 'left' || kind === 'right') { const o = order(); sel = o[(o.indexOf(sel) + d + o.length) % o.length]; }
            else if (kind === 'pick') { if (held) putDown(held.target); else pickUp(sel); }
            else if (kind === 'bench' && held) putDown(-1);
            else if (kind === 'bench' && !onBench(sel)) toBench(sel);
            if (phase === 'puzzle') showButtons();
        }
        const tap = fn => () => { fn(); const a = document.activeElement; if (a && a.blur) a.blur(); };
        function showButtons() {
            if (phase === 'end') return ui.buttons([{ label: 'Run it again', primary: true, onClick: tap(start) }]);
            if (phase === 'play') return ui.buttons([{ label: 'Skip line', quiet: true, onClick: tap(skip) }]);
            if (phase !== 'puzzle') return ui.buttons([]);
            ui.buttons([
                { label: '← Left', onClick: tap(() => act('left')) },
                { label: 'Right →', onClick: tap(() => act('right')) },
                { label: held ? 'Place' : 'Pick up', primary: true, onClick: tap(() => act('pick')) },
                { label: 'Back to bench', quiet: true, disabled: !held && onBench(sel), onClick: tap(() => act('bench')) },
            ]);
        }

        function hit(x, y) {
            const top = zorder.slice().reverse().find(id => onBench(id) && x >= home[id].x && x < home[id].x + PW && y >= home[id].y && y < home[id].y + CARD_H);
            return top !== undefined ? top : y >= CARD_Y && y < CARD_Y + CARD_H && x >= SX && x < SX1 ? slots[slotAt(x)] : null;
        }
        function clampBench(x, y) {
            const cy = Lab.clamp(Math.round(y), BENCH_Y + 2, H - 1 - CARD_H);
            let cx = Lab.clamp(Math.round(x), 2, W - 2 - PW);
            if (cx + PW > BOX.x - 2 && cy + CARD_H > BOX.y - 18) cx = BOX.x - 4 - PW;          // not on top of the recorder
            return { x: cx, y: cy };
        }
        const cv = ui.canvas;
        cv.onpointerdown = e => {
            if (phase !== 'puzzle') return;
            const p = ui.toPixel(e);
            if (held) {                                  // a piece in hand: a click on the strip puts it there; on the bench, it goes home
                const other = p.y < DROP_Y ? null : hit(p.x, p.y), was = held.id;
                putDown(p.y < DROP_Y ? slotAt(p.x) : -1);
                if (other !== null && other !== was) pickUp(other);                       // ...and the piece you clicked comes up instead
                return phase === 'puzzle' && showButtons();
            }
            const id = hit(p.x, p.y), org = id === null ? null : posOf(id);
            if (!org) return;
            sel = id;
            drag = { id, dx: p.x - org.x, dy: p.y - org.y, x: org.x, y: org.y, sx: p.x, sy: p.y, moved: false, from: slots.indexOf(id), before: slots };
            raise(id);
            try { cv.setPointerCapture(e.pointerId); } catch (err) { /* capture is optional */ }
            showButtons();
        };
        cv.onpointermove = e => {
            const p = ui.toPixel(e);
            if (!drag) {
                if (held && p.y < DROP_Y) aim(slotAt(p.x));
                cv.style.cursor = phase === 'puzzle' && (held || hit(p.x, p.y) != null) ? 'grab' : '';
                return;
            }
            if (!e.buttons) { release(); return; }
            if (!drag.moved && Math.hypot(p.x - drag.sx, p.y - drag.sy) < DRAG_START) return;
            if (!drag.moved) lift(drag.id);
            drag = { ...drag, moved: true, x: Math.round(Lab.clamp(p.x - drag.dx, -PW / 2, W - PW / 2)), y: Math.round(Lab.clamp(p.y - drag.dy, 0, H - CARD_H / 2)) };
            cv.style.cursor = 'grabbing';
        };
        function release() {
            if (!drag) return;
            const d = drag;
            drag = null; cv.style.cursor = '';
            if (!d.moved) pickUp(d.id);                                                    // a click picks it up; the next click puts it down
            else if (d.y + CARD_MID < DROP_Y) place(d.id, slotAt(d.x + PW / 2), d.from, d.before, d);
            else toBench(d.id, clampBench(d.x, d.y), d);                                    // dropped on the bench: it stays where it landed
            if (phase === 'puzzle') showButtons();
        }
        cv.onpointerup = release;
        Lab.onKey((k, e) => {
            const isPress = k === ' ' || k === 'Enter';
            if (isPress && e && (e.repeat || (e.target && e.target.tagName === 'BUTTON'))) return; // held keys don't repeat; a focused button handles its own
            if (phase === 'play') { if (isPress) skip(); return; }
            if (phase === 'end') { if (isPress) start(); return; }
            const kind = { ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ' ': 'pick', Enter: 'pick', ArrowUp: 'pick', w: 'pick',
                ArrowDown: 'bench', s: 'bench', Escape: 'bench' }[k];
            if (kind) act(kind);
        });

        // ── drawing ──
        const brackets = (x, y, w, h, color) => [[x, y, 1, 1], [x + w - 1, y, -1, 1], [x, y + h - 1, 1, -1], [x + w - 1, y + h - 1, -1, -1]]
            .forEach(([cx, cy, sx, sy]) => { Lab.line(ctx, cx, cy, cx + 2 * sx, cy, color); Lab.line(ctx, cx, cy, cx, cy + 2 * sy, color); });
        /** How far the tape has played: nothing while you work, the playhead during playback, all of it after. */
        const litX = () => (phase === 'puzzle' || phase === 'play' ? (play ? Math.round(SX + Lab.clamp(clock - play.t0, 0, TOTAL) * SEC) : SX) : SX1);
        function drawSeams(sm) {
            for (let s = 0; s <= N; s++) {
                const x = SX + s * PW, f = flashes.find(q => q.s === s && q.t <= FLASH), a = f ? f.t / FLASH : 0;
                if (sm[s] === false) {
                    const yl = MID - (s === 0 ? JOINS[0][0] : WAVES[slots[s - 1]][PW]), yr = MID - (s === N ? JOINS[N][0] : WAVES[slots[s]][0]);
                    Lab.line(ctx, x, yl, x, yr, f && Math.floor(f.t * 12) % 2 === 0 ? C.white : C.red);
                    Lab.line(ctx, x - 1, 11, x + 1, 11, C.red);
                    Lab.line(ctx, x, 61, x, 63, C.red);
                } else if (sm[s] === true && f) {                                           // the join snaps shut: the line lights across it
                    Lab.shade(ctx, x - 2, CARD_Y + 1, 5, CARD_H - 2, 0.4 * a, C.green);
                    if (s > 0) trace(ctx, WAVES[slots[s - 1]].slice(PW - 8), x - 8, MID, a > 0.5 ? C.white : C.greenBr, 0);
                    if (s < N) trace(ctx, WAVES[slots[s]].slice(0, 9), x, MID, a > 0.5 ? C.white : C.greenBr, 0);
                    Lab.line(ctx, x, 11, x, 13, C.greenBr); Lab.line(ctx, x, 57, x, 59, C.greenBr);
                }
            }
        }
        function drawList() {
            const x = 30, y = 92, w = 200, h = 66, a = Math.min(1, listT / 0.5);
            Lab.shade(ctx, x + 3, y + 3, w, h, 0.6 * a, C.void);
            Lab.shade(ctx, x, y, w, h, 0.95 * a, C.ink2);
            rect(ctx, x, y, w, h, C.boneD, a);
            if (a < 1) return;
            [['HULL', x + 8], ['NAME', x + 64]].forEach(([str, tx]) => Lab.text(ctx, str, tx, y + 6, C.boneD));
            Lab.line(ctx, x + 6, y + 13, x + w - 7, y + 13, C.line2);
            let budget = Math.max(0, Math.floor((listT - 0.9) * 18));                          // Aris writes the new rows in
            LIST.forEach(([hull, name], r) => [[hull, x + 8], [name, x + 64]].forEach(([str, tx]) => {
                const isNew = r >= 2, shown = isNew ? str.slice(0, budget) : str;
                if (isNew) budget -= shown.length;
                if (shown) Lab.text(ctx, shown, tx, y + 18 + r * 11, isNew ? C.white : C.boneD);
            }));
        }
        function render() {
            ctx.drawImage(bg, 0, 0);
            drawLid(ctx, phase === 'end');
            if (play && clock % 0.6 < 0.35) { ctx.fillStyle = C.greenBr; ctx.fillRect(BOX.x + 23, BOX.y + 26, 2, 2); } // the play lamp
            const sm = seams(slots), lit = litX(), live = phase === 'puzzle';
            const head = live || (phase === 'play' && !play) ? 'JOINS ' + sm.filter(v => v === true).length + '/7'
                : '0:' + String(Math.floor((lit - SX) / SEC)).padStart(2, '0') + ' / 0:' + TOTAL;
            Lab.text(ctx, head, W - 6 - Lab.textWidth(head), 3, live ? (bump > 0 ? C.gold : C.amber) : C.greenBr);
            const target = drag && drag.moved && drag.y + CARD_MID < DROP_Y ? slotAt(drag.x + PW / 2) : held ? held.target : -1;
            for (let i = 0; i < N; i++) {
                const id = slots[i], x = SX + i * PW;
                if (id === null) { brackets(x + 2, CARD_Y + 2, PW - 4, CARD_H - 4, i === target ? C.amber : C.line2); continue; }
                const q = at(id, { x, y: CARD_Y }), dx = shake && shake.id === id && shake.t <= SHAKE ? (Math.floor(shake.t * 40) % 2 ? 1 : -1) : 0;
                ctx.drawImage(cards[id][sm[i] ? 0 : 1][sm[i + 1] ? 0 : 1], Math.round(q.x) + dx, Math.round(q.y));
                const n = Lab.clamp(lit - x, 0, PW);                                          // played so far: bright; still to play: dim
                if (n > 0) trace(ctx, WAVES[id].slice(0, n + 1), x, MID, C.greenBr, 0);
                if (phase === 'play' && n < PW) trace(ctx, WAVES[id].slice(n), x + n, MID, C.greenD, 0);
                if (i === target || (live && !held && !drag && sel === id)) brackets(x - 1, CARD_Y - 1, PW + 2, CARD_H + 2, C.amber);
            }
            drawSeams(sm);
            if (glow > 0 && glow <= 1) rect(ctx, 4, 11, 312, 48, glow > 0.5 ? C.greenBr : C.green);  // the whole strip holds
            if (play) { Lab.line(ctx, lit, 13, lit, 56, C.white, 0.75); Lab.dot(ctx, lit, 60, C.gold); }
            zorder.forEach(id => {
                if (!onBench(id) || (drag && drag.moved && drag.id === id) || (held && held.id === id)) return;
                const q = at(id, home[id]);
                ctx.drawImage(cards[id][1][1], Math.round(q.x), Math.round(q.y));
                if (live && !held && !drag && sel === id) brackets(Math.round(q.x) - 2, Math.round(q.y) - 2, PW + 4, CARD_H + 4, C.amber);
            });
            const hand = drag && drag.moved ? drag : held ? at(held.id, hover(held.target)) : null;
            if (hand) {
                const hx = Math.round(hand.x), hy = Math.round(hand.y), id = drag && drag.moved ? drag.id : held.id;
                Lab.shade(ctx, hx + 2, hy + 2 + LIFT, PW, CARD_H, 0.55, C.void);
                ctx.drawImage(cards[id][1][1], hx, hy);
                brackets(hx - 2, hy - 2, PW + 4, CARD_H + 4, C.gold);
            }
            if (phase === 'list' || phase === 'end') drawList();
        }

        Lab.loop(dt => {
            clock += dt;
            const due = queue.filter(q => q.at <= clock);
            if (due.length) { queue = queue.filter(q => q.at > clock); due.forEach(q => q.fn()); }
            flashes = flashes.map(f => ({ ...f, t: f.t - dt })).filter(f => f.t > 0);
            slides = slides.map(sl => (sl && sl.t > dt ? { ...sl, t: sl.t - dt } : null));
            shake = shake && shake.t > dt ? { ...shake, t: shake.t - dt } : null;
            glow = Math.max(0, glow - dt); bump = Math.max(0, bump - dt);
            if (phase === 'play' && play) playing();
            if (phase === 'list' || phase === 'end') listT += dt;
            render();
        }, 30);

        start();
        render();
        return () => { cv.style.cursor = ''; gen++; queue = []; drag = null; held = null; };
    }

    Lab.register({
        id: 'blackbox', badge: 'new',
        name: 'The black box',
        short: "Splice a dead ship's last entry",
        verb: 'Put the torn pieces of a flight recording back on the strip so the line runs on without a jump, and hear the entry come back.',
        serves: "The found pages: EXODUS-6's captain saw a wreck with a higher hull number than hers, and it was older than her ship.",
        replaces: 'Reading a found page as plain text.',
        controls: 'Drag or click pieces onto the strip · ←/→ choose or move · Space: pick up / place · ↓: back to bench',
        mount,
    });
})();
