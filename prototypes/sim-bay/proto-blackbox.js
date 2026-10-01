/* proto-blackbox.js — The black box.
   EXODUS-6's flight recorder lies open on a bench. Its last entry survived in six torn pieces. Put them back on the
   strip so the line runs on across every join: its height and its slope must carry over. A good join clicks and the
   seam closes; a wrong one shows a jump. Joined pieces play their words; the whole strip plays the whole entry. */

(function () {
    'use strict';
    const Lab = window.Lab, C = Lab.C, W = Lab.W, H = Lab.H;

    const N = 6, PW = 48;                                   // six pieces, each 48 px wide
    const SEC = 12, TOTAL = (N * PW) / SEC;                 // px per second: a piece holds 4 s, the entry 24 s
    const SX = 16, SX1 = SX + N * PW;                       // the six slots on the strip
    const MID = 35, AMP = 15;                               // the strip's zero line; the line never leaves ±15 px
    const CARD_H = 36, CARD_MID = 18, CARD_Y = MID - CARD_MID;
    const BENCH_Y = 76, DROP_Y = 72;                        // a piece let go with its middle above DROP_Y goes on the strip
    const BOX = { x: 262, y: 128, w: 48, h: 42 };           // the recorder itself
    const FLASH = 0.5, DRAG_START = 2;
    const TEAR = [0, 1, 2, 1, 0, 2, 3, 1, 0, 1, 2, 0, 1, 3, 2, 1];
    const SPOTS = [[8, 82], [88, 80], [168, 84], [16, 124], [98, 128], [178, 122]];

    // Where the line crosses each join (px above the zero line) and its slope there. Join 0 is the leader, join 6 the tail.
    const JOINS = [[-4, 0.3], [12, -0.25], [-12, 0.35], [4, -0.4], [-8, 0.2], [8, -0.3], [0, 0.25]];
    const BODY = [[5, 7, 0.3], [7, 8, 1.9], [4, 9, 4.0], [6, 7, 2.6], [8, 6, 0.9], [5, 8, 5.1]]; // the voice inside each piece

    const ENTRY = [
        'Captain Ruth Harlan, EXODUS-6. We found a wreck ahead of us today.',
        'It has our mission patch on the hull. The hull number is 212.',
        "We're hull six. A ship built after us is out here, ahead of us.",
        "Dele says it's been dead at least eighty years. We launched eleven years ago.",
        'Nobody could explain it. Dele cooked the last of the rice, and we ate without talking.',
    ];
    const PIECES = [                                        // the same words, as the six pieces carry them
        'Captain Ruth Harlan, EXODUS-6. We found a wreck ahead',
        'of us today. It has our mission patch on the hull.',
        "The hull number is 212. We're hull six. A ship built after us",
        "is out here, ahead of us. Dele says it's been dead",
        'at least eighty years. We launched eleven years ago. Nobody could',
        'explain it. Dele cooked the last of the rice, and we ate without talking.',
    ];
    const NAMES = [['RUTH HARLAN', 'EXODUS-6'], ['DELE', 'EXODUS-6']];
    const countWords = s => s.split(' ').length;
    const PIECE_WORDS = PIECES.map(countWords);
    /** Where word w of the entry sits on the strip (each piece spreads its own words across its 4 seconds). */
    function wordX(w) {
        let k = 0, left = w;
        while (k < N - 1 && left >= PIECE_WORDS[k]) { left -= PIECE_WORDS[k]; k++; }
        return SX + PW * (k + Math.min(1, left / PIECE_WORDS[k]));
    }
    // Seconds into the recording where each line starts; the last value is the end of the entry.
    const LINE_T = ENTRY.reduce((acc, l) => acc.concat(acc[acc.length - 1] + countWords(l)), [0]).map(w => (wordX(w) - SX) / SEC);

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
        const c = document.createElement('canvas');
        c.width = PW; c.height = CARD_H;
        const g = c.getContext('2d');
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
        Lab.shade(g, x + 2, y + h, w, 2, 0.6, C.ink2);
        Lab.shade(g, x, y, w, h, 0.24, C.amber);
        rect(g, x, y, w, h, C.amber, 0.6);
        Lab.line(g, x, y, x + w - 1, y, C.gold, 0.8);
        [y + 8, y + 33].forEach(sy => Lab.shade(g, x + 1, sy, w - 2, 2, 0.3, C.bone));          // reflective bands
        g.fillStyle = C.ink; g.fillRect(x + 5, y + 16, w - 10, 11);                            // the name plate
        Lab.line(g, x + 5, y + 16, x + w - 6, y + 16, C.amber, 0.5);
        Lab.text(g, 'EXODUS-6', x + Math.round((w - Lab.textWidth('EXODUS-6')) / 2), y + 19, C.amber);
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
        Lab.shade(g, 0, BENCH_Y + 1, W, H - BENCH_Y - 1, 0.12, C.line);
        [[246, 168], [254, 172], [238, 161]].forEach(([x, y]) => { Lab.dot(g, x, y, C.boneD); Lab.dot(g, x + 1, y, C.bone); }); // loose screws
        paintBox(g);
    }
    function drawLid(g, closed) {
        const { x, y, w } = BOX;
        if (closed) { Lab.shade(g, x, y - 3, w, 3, 0.45, C.amber); Lab.line(g, x, y - 3, x + w - 1, y - 3, C.gold, 0.8); return; }
        Lab.shade(g, x + 3, y - 16, w - 6, 15, 0.16, C.amber);                                 // the lid, standing open
        Lab.line(g, x + 3, y - 16, x + w - 4, y - 16, C.amber, 0.7);
        Lab.shade(g, x + 30, y - 9, 12, 9, 0.55, C.greenD);                                     // the memory board, half out
        [[32, -7], [35, -5], [38, -7], [33, -3]].forEach(([dx, dy]) => Lab.dot(g, x + dx, y + dy, C.green));
        Lab.dot(g, x + 39, y - 3, C.red);                                                        // a burnt chip
        [[x + 36, y - 10, 317, 104], [317, 104, 317, 40], [316, 40, 317, 40]].forEach(([a, b, c, d]) => Lab.line(g, a, b, c, d, C.line2)); // the lead
    }

    function shuffled(list, rnd) {
        const out = list.slice();
        for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
        return out;
    }
    /** Each join: null while a side is empty, true when the line runs on, false when it jumps. -1 is the leader, N the tail. */
    function seams(sl) {
        return Array.from({ length: N + 1 }, (_, s) => {
            const l = s === 0 ? -1 : sl[s - 1], r = s === N ? N : sl[s];
            return l === null || r === null ? null : r === l + 1;
        });
    }
    const slotAt = x => Lab.clamp(Math.floor((x - SX) / PW), 0, N - 1);

    let cards = null;

    function mount(ctx, ui) {
        const focused = document.activeElement;
        if (focused && focused.classList && focused.classList.contains('pick')) focused.blur();  // so Space does not reopen the list item
        if (!cards) cards = WAVES.map((_, k) => [[makeCard(k, 0, 0), makeCard(k, 0, 1)], [makeCard(k, 1, 0), makeCard(k, 1, 1)]]);
        const bg = document.createElement('canvas');
        bg.width = W; bg.height = H;
        paintBench(bg.getContext('2d'));

        let run = 0, clock = 0, gen = 0, queue = [];
        let slots, home, zorder, sel, held, drag, flashes, glow, phase, play, listT, lidClosed, hinted, spoke;
        const later = (sec, fn) => { const g = gen; queue = queue.concat({ at: clock + sec, fn: () => g === gen && fn() }); };
        const onBench = id => slots.indexOf(id) < 0;
        const raise = id => { zorder = zorder.filter(v => v !== id).concat(id); };

        function start() {
            gen++; queue = []; run++;
            const rnd = Lab.rng(606 + run * 7919);
            let perm;
            do { perm = shuffled([0, 1, 2, 3, 4, 5], rnd); } while (perm[0] === 0 || perm.every((id, i) => id === i));
            const spots = perm.map((_, j) => ({ x: SPOTS[j][0] + Math.floor(rnd() * 14) - 4, y: SPOTS[j][1] + Math.floor(rnd() * 6) }));
            home = WAVES.map((_, id) => spots[perm.indexOf(id)]);
            slots = Array(N).fill(null); zorder = perm.slice(); held = null; drag = null; flashes = []; glow = 0;
            phase = 'puzzle'; play = null; listT = 0; lidClosed = false; hinted = false; spoke = false;
            sel = order()[0];
            if (ui.clear) ui.clear();
            ui.say('A.U.R.A.', 'Flight recorder from EXODUS-6, Commander. The last entry survived in six pieces.');
            later(3, () => { if (!spoke) ui.say('Jaxon', "The order's lost. Put each piece where the line runs on without a jump."); });
            showButtons();
        }
        /** Keyboard order: pieces on the strip left to right, then the bench by row. */
        function order() {
            const bench = WAVES.map((_, id) => id).filter(onBench)
                .sort((a, b) => (Math.round(home[a].y / 40) - Math.round(home[b].y / 40)) || home[a].x - home[b].x);
            return slots.filter(v => v !== null).concat(bench);
        }
        function lift(id) {
            const from = slots.indexOf(id);
            if (from >= 0) slots = slots.map((v, i) => (i === from ? null : v));
            return from;
        }
        /** A piece goes back to its own spot on the bench, or to `pos` if it was dropped somewhere. */
        function toBench(id, pos) {
            lift(id);
            if (pos) home = home.map((p, i) => (i === id ? pos : p));
            raise(id);
        }
        /** Put piece `id` in `slot`. Whatever was there swaps to the slot `id` came from, or back to the bench. */
        function place(id, slot, from, before) {
            const occupant = slots[slot];
            slots = slots.map((v, i) => (i === slot ? id : i === from && occupant !== null ? occupant : v));
            if (occupant !== null && from < 0) raise(occupant);
            judge(before, slot);
        }
        function judge(before, slot) {
            const was = seams(before), now = seams(slots);
            const fresh = now.map((v, s) => v === true && was[s] !== true), broke = now.map((v, s) => v === false && was[s] !== false);
            flashes = flashes.filter(f => !fresh[f.s] && !broke[f.s])
                .concat(now.map((_, s) => s).filter(s => fresh[s] || broke[s]).map(s => ({ s, t: FLASH })));
            if (now.every(v => v === true)) { complete(); return; }
            if (fresh.some(Boolean)) { spoke = true; ui.say('EXODUS-6', heard(slot, fresh)); }
            else if (broke.some(Boolean) && !hinted) { hinted = true; spoke = true; ui.say('Jaxon', 'See the jump at that join? That piece goes somewhere else.'); }
        }
        /** The words around the join that just closed, with "…" where the recording still breaks off. */
        function heard(slot, fresh) {
            const c = fresh[slot] || fresh[slot + 1] ? slot : Math.min(N - 1, fresh.indexOf(true));
            const a = fresh[c] && c > 0 ? c - 1 : c, b = fresh[c + 1] && c < N - 1 ? c + 1 : c;
            const ids = slots.slice(a, b + 1);
            return (ids[0] === 0 ? '' : '… ') + ids.map(id => PIECES[id]).join(' ') + (ids[ids.length - 1] === N - 1 ? '' : ' …');
        }

        function complete() {
            phase = 'play'; held = null; drag = null; glow = 1;
            showButtons();
            later(1.2, () => { play = { t0: clock, shown: -1 }; });
        }
        /** Playback runs in real time: the playhead crosses 12 px a second and each line shows when the tape reaches it. */
        function playing() {
            const t = clock - play.t0, i = LINE_T.filter(v => v <= t).length - 1;
            if (t >= TOTAL + 0.8) { play = null; aris(); return; }
            if (i < ENTRY.length && i !== play.shown) { play = { ...play, shown: i }; ui.say('EXODUS-6', ENTRY[i]); }
        }
        function skip() {
            if (phase !== 'play' || !play) return;
            const t = clock - play.t0, next = LINE_T.find(v => v > t + 0.05);
            play = { ...play, t0: clock - (next < TOTAL ? next : TOTAL + 0.8) };
        }
        function aris() {
            phase = 'list'; listT = 0;
            ui.say('Aris', "Ruth Harlan, and someone called Dele. I'm adding them both to the list.");
            showButtons();
            later(4.5, () => {
                phase = 'end'; lidClosed = true;
                ui.say('A.U.R.A.', 'Entry saved, Commander. The recording is twenty years old.');
                showButtons();
            });
        }

        // ── controls ──
        function act(kind) {
            if (phase !== 'puzzle' || drag) return;
            if (kind === 'left' || kind === 'right') {
                const d = kind === 'left' ? -1 : 1;
                if (held) held = { ...held, target: Lab.clamp(held.target + d, 0, N - 1) };
                else { const o = order(); sel = o[(o.indexOf(sel) + d + o.length) % o.length]; }
            } else if (kind === 'pick' && held) {
                const h = held;
                held = null;
                place(h.id, h.target, h.from, h.before);
                const rest = order().filter(onBench);
                if (rest.length) sel = rest[0];
            } else if (kind === 'pick') {
                const before = slots, from = lift(sel);
                held = { id: sel, target: from >= 0 ? from : Math.max(0, slots.indexOf(null)), from, before };
            } else if (kind === 'bench' && (held || !onBench(sel))) {
                toBench(held ? held.id : sel);
                held = null;
            }
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
            for (let j = zorder.length - 1; j >= 0; j--) {
                const id = zorder[j], q = home[id];
                if (onBench(id) && x >= q.x && x < q.x + PW && y >= q.y && y < q.y + CARD_H) return id;
            }
            return y >= CARD_Y && y < CARD_Y + CARD_H && x >= SX && x < SX1 ? slots[slotAt(x)] : null;
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
            if (held) {                                  // a piece is in hand from the keys: a click puts it down
                const h = held;
                held = null;
                if (p.y < DROP_Y) place(h.id, slotAt(p.x), h.from, h.before); else toBench(h.id);
                if (phase === 'puzzle') showButtons();
                return;
            }
            const id = hit(p.x, p.y);
            if (id === null || id === undefined) return;
            const inSlot = slots.indexOf(id), org = inSlot >= 0 ? { x: SX + inSlot * PW, y: CARD_Y } : home[id];
            sel = id;
            drag = { id, dx: p.x - org.x, dy: p.y - org.y, x: org.x, y: org.y, sx: p.x, sy: p.y, moved: false, from: inSlot, before: slots };
            raise(id);
            try { cv.setPointerCapture(e.pointerId); } catch (err) { /* capture is optional */ }
            showButtons();
        };
        cv.onpointermove = e => {
            const p = ui.toPixel(e);
            if (!drag) { cv.style.cursor = phase === 'puzzle' && (held || hit(p.x, p.y) != null) ? 'grab' : ''; return; }
            if (!e.buttons) { release(); return; }
            if (!drag.moved && Math.hypot(p.x - drag.sx, p.y - drag.sy) < DRAG_START) return;
            if (!drag.moved) lift(drag.id);
            drag = { ...drag, moved: true, x: Math.round(Lab.clamp(p.x - drag.dx, -PW / 2, W - PW / 2)), y: Math.round(Lab.clamp(p.y - drag.dy, 0, H - CARD_H / 2)) };
            cv.style.cursor = 'grabbing';
        };
        function release() {
            if (!drag) return;
            const d = drag;
            drag = null;
            cv.style.cursor = '';
            if (d.moved && d.y + CARD_MID < DROP_Y) place(d.id, slotAt(d.x + PW / 2), d.from, d.before);
            else if (d.moved) toBench(d.id, clampBench(d.x, d.y));                       // dropped on the bench: it stays where it landed
            if (phase === 'puzzle') showButtons();
        }
        cv.onpointerup = release;
        Lab.onKey((k, e) => {
            if ((k === ' ' || k === 'Enter') && e && e.target && e.target.tagName === 'BUTTON') return; // the focused button handles it
            if (phase === 'play') { if (k === ' ' || k === 'Enter') skip(); return; }
            if (phase === 'end') { if (k === ' ' || k === 'Enter') start(); return; }
            const kind = { ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ' ': 'pick', Enter: 'pick', ArrowUp: 'pick', w: 'pick',
                ArrowDown: 'bench', s: 'bench', Escape: 'bench' }[k];
            if (kind) act(kind);
        });

        // ── drawing ──
        function brackets(x, y, w, h, color) {
            const x1 = x + w - 1, y1 = y + h - 1;
            [[x, y, 1, 1], [x1, y, -1, 1], [x, y1, 1, -1], [x1, y1, -1, -1]].forEach(([cx, cy, sx, sy]) => {
                Lab.line(ctx, cx, cy, cx + 2 * sx, cy, color);
                Lab.line(ctx, cx, cy, cx, cy + 2 * sy, color);
            });
        }
        function litX() {
            if (phase === 'puzzle' || (phase === 'play' && !play)) return SX;
            if (phase !== 'play') return SX1;
            return Math.round(SX + Lab.clamp(clock - play.t0, 0, TOTAL) * SEC);
        }
        function drawSeams(sm) {
            for (let s = 0; s <= N; s++) {
                const x = SX + s * PW, f = flashes.find(q => q.s === s);
                if (sm[s] === false) {
                    const yl = MID - (s === 0 ? JOINS[0][0] : WAVES[slots[s - 1]][PW]), yr = MID - (s === N ? JOINS[N][0] : WAVES[slots[s]][0]);
                    Lab.line(ctx, x, yl, x, yr, f && Math.floor(f.t * 12) % 2 === 0 ? C.white : C.red);
                    Lab.line(ctx, x - 1, 11, x + 1, 11, C.red);
                    Lab.line(ctx, x, 61, x, 63, C.red);
                } else if (sm[s] === true && f) {
                    const a = f.t / FLASH;
                    Lab.shade(ctx, x - 3, CARD_Y, 7, CARD_H, 0.25 * a, C.green);
                    Lab.shade(ctx, x - 1, CARD_Y, 3, CARD_H, 0.8 * a, C.greenBr);
                }
            }
        }
        function drawList() {
            const x = 58, y = 88, w = 180, h = 70, a = Math.min(1, listT / 0.6);
            Lab.shade(ctx, x + 3, y + 3, w, h, 0.6 * a, C.void);
            Lab.shade(ctx, x, y, w, h, 0.95 * a, C.ink2);
            rect(ctx, x, y, w, h, C.boneD, a);
            for (let r = 0; r < 5; r++) Lab.line(ctx, x + 6, y + 15 + r * 11, x + w - 7, y + 15 + r * 11, C.line2, 0.6 * a); // ruled lines
            [64, 48, 80].forEach((len, r) => {                                                       // the names already on it
                const yy = y + 11 + r * 11;
                Lab.line(ctx, x + 10, yy, x + 10 + len, yy, C.boneD, 0.5 * a);
                Lab.line(ctx, x + 118, yy, x + 150, yy, C.boneD, 0.4 * a);
            });
            let budget = Math.max(0, Math.floor((listT - 0.8) * 16));
            NAMES.forEach(([name, ship], r) => [[name, x + 10], [ship, x + 118]].forEach(([str, tx]) => {
                const shown = str.slice(0, budget);
                budget -= shown.length;
                if (shown) Lab.text(ctx, shown, tx, y + 41 + r * 11, C.bone);
            }));
        }
        function render() {
            ctx.drawImage(bg, 0, 0);
            drawLid(ctx, lidClosed);
            const sm = seams(slots), lit = litX(), live = phase === 'puzzle';
            const head = live ? 'JOINS ' + sm.filter(v => v === true).length + '/7'
                : '0:' + String(Math.floor((lit - SX) / SEC)).padStart(2, '0') + ' / 0:' + TOTAL;
            Lab.text(ctx, head, W - 6 - Lab.textWidth(head), 3, live ? C.amber : C.greenBr);
            const target = drag && drag.moved && drag.y + CARD_MID < DROP_Y ? slotAt(drag.x + PW / 2) : held ? held.target : -1;
            for (let i = 0; i < N; i++) {
                const id = slots[i], x = SX + i * PW;
                if (id === null) { brackets(x + 2, CARD_Y + 2, PW - 4, CARD_H - 4, i === target ? C.amber : C.line2); continue; }
                ctx.drawImage(cards[id][sm[i] ? 0 : 1][sm[i + 1] ? 0 : 1], x, CARD_Y);
                const n = Lab.clamp(lit - x, 0, PW);                                          // played so far: bright; still to play: dim
                if (n > 0) trace(ctx, WAVES[id].slice(0, n + 1), x, MID, C.greenBr, 0);
                if (phase === 'play' && n < PW) trace(ctx, WAVES[id].slice(n), x + n, MID, C.greenD, 0);
                if (i === target || (live && !held && !drag && sel === id)) brackets(x - 1, CARD_Y - 1, PW + 2, CARD_H + 2, C.amber);
            }
            drawSeams(sm);
            if (glow > 0) Lab.shade(ctx, SX, CARD_Y, SX1 - SX, CARD_H, 0.2 * glow, C.greenBr);
            if (phase === 'play' && play) { Lab.line(ctx, lit, 13, lit, 56, C.white, 0.75); Lab.dot(ctx, lit, 60, C.gold); }
            zorder.forEach(id => {
                if (!onBench(id) || (drag && drag.moved && drag.id === id) || (held && held.id === id)) return;
                const q = home[id];
                ctx.drawImage(cards[id][1][1], q.x, q.y);
                if (live && !held && !drag && sel === id) brackets(q.x - 2, q.y - 2, PW + 4, CARD_H + 4, C.amber);
            });
            const hand = drag && drag.moved ? drag : held ? { id: held.id, x: SX + held.target * PW, y: CARD_Y } : null;
            if (hand) {
                Lab.shade(ctx, hand.x + 2, hand.y + 3, PW, CARD_H, 0.55, C.void);
                ctx.drawImage(cards[hand.id][1][1], hand.x, hand.y);
                brackets(hand.x - 2, hand.y - 2, PW + 4, CARD_H + 4, C.gold);
            }
            if (phase === 'list' || phase === 'end') drawList();
        }

        Lab.loop(dt => {
            clock += dt;
            const due = queue.filter(q => q.at <= clock);
            if (due.length) { queue = queue.filter(q => q.at > clock); due.forEach(q => q.fn()); }
            flashes = flashes.map(f => ({ ...f, t: f.t - dt })).filter(f => f.t > 0);
            glow = Math.max(0, glow - dt);
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
        verb: 'Drag the torn pieces of a flight recording onto the strip where the line runs on without a jump, and hear the entry come back.',
        serves: "The found pages: EXODUS-6's captain saw a wreck with a higher hull number than hers, and it was older than her ship.",
        replaces: 'Reading a found page as plain text.',
        controls: 'Drag pieces onto the strip · ←/→ choose or move · Space: pick up / place · ↓: back to bench',
        mount,
    });
})();
