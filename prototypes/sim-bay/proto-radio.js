/* proto-radio.js — "Dead channels". Sweep the long-range radio through static, listening for the eight ships ahead.
   Every voice on the band comes from ahead, where the light is: even Earth, and at the top of the band, our own ship.
   Would replace the long-range scan. Draws at 320×180 through Lab; dialogue goes through ui.say. */
(function () {
    'use strict';
    const Lab = window.Lab, C = Lab.C;

    const BX = 16, BW = 288;                  // the band in picture pixels: x = BX + f * (BW - 1)
    const WF_Y = 10, WF_H = 80;               // the waterfall of static
    const DIAL_Y = 94, BASE_Y = 112;          // the dial glass and its tick baseline
    const WINDOW_PX = 10, LOCK_C = 0.82;      // words start coming through within 10 px; locked within about 2 px
    const FAINT_C = 0.12, HOLD_S = 0.7;       // below FAINT_C it is only static; hold a lock this long to play it
    const MHZ_LO = 8400, MHZ_HI = 8460;       // the deep-space band
    const REVEAL_WAIT_S = 12;                 // with one station left unheard, the far one still comes up after this long
    const INTRO = ['Jaxon', "Radio's on. Eight ships went ahead of us. If anyone's alive, we'll hear them."];
    const HINT = ['A.U.R.A.', 'A new signal at the top of the band, Commander. Very faint.'];
    const CLOSING = ['', 'Every voice on the band came from ahead, where the light is.'];

    // Each line: [speaker, words, isTransmission]. A transmission needs the needle held on it; crew lines do not.
    const STATIONS = [
        { f: 0.14, vis: 0.42, id: 'EARTH', mod: 'steady', lines: [
            ['Earth', 'Exodus Control to EXODUS-9. We will keep this channel open. Good luck.', true],
            ['Mira', 'That came from ahead of us. Earth is behind us.', false]] },
        { f: 0.37, vis: 0.4, id: 'EXODUS-6', mod: 'loop', lines: [
            ['EXODUS-6', 'This is EXODUS-6, Captain Ruth Harlan. We have stopped. Please respond.', true],
            ['A.U.R.A.', 'That message is on a loop, Commander. EXODUS-6 has been dead about twenty years.', false]] },
        { f: 0.56, vis: 0.42, id: 'HULL 212', mod: 'pulse', lines: [
            ['A.U.R.A.', "Hull 212's transponder, Commander. That ship has been dead about a century.", false]] },
        { f: 0.75, vis: 0.36, id: 'EXODUS-30,211', mod: 'flicker', lines: [
            ['30,211', 'This is EXODUS-30,211. We can see the light now. It gives off no heat.', true],
            ['A.U.R.A.', 'That ship has been dead 396 years, Commander. It has no power.', false],
            ['Vance', "Then who's talking?", false]] },
        { f: 0.95, vis: 0.24, id: 'EXODUS-9', mod: 'steady', lines: [
            ['EXODUS-9', 'Good morning, Commander. All four crew are awake and well.', true],
            ['Mira', "That's A.U.R.A.'s voice. It's what she said when we woke up.", false],
            ['A.U.R.A.', 'That signal is ours, Commander. It is coming from ahead of us.', false]] },
    ].map(st => ({ ...st, x: Math.round(BX + st.f * (BW - 1)) }));
    const LAST = STATIONS.length - 1;          // our own station: it comes up once the others are heard (see REVEAL_WAIT_S)

    const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    const PAL = { void: rgb(C.void), d: rgb(C.greenD), g: rgb(C.green), b: rgb(C.greenBr), gold: rgb(C.gold), amber: rgb(C.amber) };
    const px = f => BX + f * (BW - 1);
    const mhzOf = f => Math.round(MHZ_LO + f * (MHZ_HI - MHZ_LO));
    const lineTime = words => 1.3 + 0.24 * words.split(' ').length;
    const cyc = (t, period) => ((t % period) + period) % period;                       // safe for the negative times of the first fill
    const burst = t => Math.abs(Math.sin(t * 0.011) * Math.sin(t * 0.0043 + 1.3));   // a speech-like envelope
    const keyOf = line => (line ? line.join('|') : '');

    function mount(ctx, ui) {
        const wf = new Float32Array(WF_H * BW);
        const img = ctx.createImageData(BW, WF_H);
        let s = null, frame = 0;

        const live = i => i < LAST || s.reveal > 0;
        const clarity = i => Lab.clamp(1 - Math.abs(px(s.f) - STATIONS[i].x) / WINDOW_PX, 0, 1);
        const tune = df => { if (s.mode !== 'end') s.f = Lab.clamp(s.f + df, 0, 1); };
        const playing = () => STATIONS[s.st].lines[s.li];
        const transmitting = () => s.mode === 'play' && playing()[2] && clarity(s.st) >= LOCK_C;

        function nearest() {
            let i = -1, c = 0;
            STATIONS.forEach((st, k) => { if (live(k) && clarity(k) > c) { c = clarity(k); i = k; } });
            return { i, c };
        }
        /** The line as heard at clarity c: missing words become "…". Each word has a fixed threshold, so it does not flicker. */
        function garble(words, c, seed) {
            const r = Lab.rng(Math.imul(seed + 1, 2654435761)), k = (c - 0.2) / (LOCK_C - 0.2), out = [];
            r();
            words.split(' ').forEach(w => { if (r() < k) out.push(w); else if (out[out.length - 1] !== '…') out.push('…'); });
            return out.join(' ');
        }

        // ── the dialogue: story lines stay put; a broken voice shows only while the needle is near it ──
        function show(faint, replacesLast) {
            const log = s.log, n = log.length;
            const prev = faint ? log[n - (replacesLast ? 2 : 1)] : log[n - 2], cur = faint || log[n - 1];
            ui.clear();
            if (prev) ui.say(prev[0], prev[1]);
            if (cur) ui.say(cur[0], cur[1]);
            s.faintKey = keyOf(faint);
        }
        const say = line => { s.log = [...s.log, line]; show(null); };
        const hear = (faint, replacesLast) => { if (keyOf(faint) !== s.faintKey) show(faint, replacesLast); };
        /** What the needle picks up from the nearest voice not yet heard, or null in plain static. */
        function preview() {
            const n = nearest();
            if (n.i < 0 || n.c < FAINT_C || s.heard.includes(n.i)) return null;
            const tx = STATIONS[n.i].lines.find(l => l[2]);
            return tx ? [n.c >= 0.5 ? tx[0] : '', garble(tx[1], n.c, n.i)] : null;
        }

        // ── the story ──
        function begin(i) {
            s.mode = 'play'; s.st = i; s.li = 0; s.lineT = 0; s.lockT = 0; s.mark = s.log.length;
            s.heard = [...s.heard, i];
            say(playing());
        }
        function play(dt) {
            const l = playing(), c = clarity(s.st);
            if (l[2] && c < FAINT_C) {           // tuned right away mid-transmission: drop it, it starts over next time
                s.log = s.log.slice(0, s.mark); s.heard = s.heard.filter(i => i !== s.st); s.mode = 'tune';
                show(null);
                return;
            }
            if (l[2] && c < LOCK_C) {            // drifted off a transmission: it breaks up and waits for you
                hear([c >= 0.5 ? l[0] : '', garble(l[1], c, s.st)], true);
                return;
            }
            hear(null);
            s.lineT += dt;
            if (s.lineT < lineTime(l[1])) return;
            s.li += 1; s.lineT = 0;
            if (s.li < STATIONS[s.st].lines.length) { say(playing()); return; }
            s.mode = 'tune';
            if (s.st === LAST) end();
        }
        function end() {
            s.mode = 'end'; s.endT = 0;
            say(CLOSING);
            ui.buttons([{ label: 'Run it again', primary: true, onClick: start }]);
        }
        function start() {
            s = { f: 0.04, holdT: 0, btnDir: 0, drag: false, mode: 'tune', st: -1, li: 0, lineT: 0, lockT: 0, mark: 0,
                  heard: [], reveal: 0, waitT: 0, endT: 0, log: [], faintKey: '' };
            for (let r = 0; r < WF_H; r++) pushRow(performance.now() - (WF_H - r) * 66);   // open on a fresh, full waterfall
            say(INTRO);
            const hold = (label, dir) => ({ label, hold: true,
                onDown: () => { s.btnDir = dir; tune(dir / (BW - 1)); }, onUp: () => { s.btnDir = 0; } });
            ui.buttons([hold('← Tune down', -1), hold('Tune up →', 1)]);
        }

        function update(dt) {
            const k = Lab.keys;
            const held = (k.has('ArrowRight') || k.has('d') ? 1 : 0) - (k.has('ArrowLeft') || k.has('a') ? 1 : 0);
            const dir = held || s.btnDir;
            s.holdT = dir ? s.holdT + dt : 0;     // a tap moves one pixel; holding sweeps faster and faster
            if (dir && s.holdT > 0.25) tune(dir * Lab.lerp(10, 110, Lab.clamp((s.holdT - 0.25) / 1.2, 0, 1)) * dt / (BW - 1));
            if (s.reveal > 0) s.reveal = Math.min(1, s.reveal + dt / 2);
            if (s.mode === 'end') { s.endT += dt; return; }
            if (s.mode === 'play') play(dt);
            if (s.mode === 'end' || (s.mode === 'play' && playing()[2])) return;   // a transmission holds the needle
            const n = nearest();
            s.lockT = n.c >= LOCK_C && !s.heard.includes(n.i) ? s.lockT + dt : 0;
            if (s.mode === 'play') return;        // crew lines run on while you tune; a voice you lock waits for them
            const p = preview();
            hear(p, false);
            if (s.lockT >= HOLD_S) { begin(n.i); return; }
            if (!s.reveal && s.heard.length >= LAST - 1) {
                if (!p) s.waitT += dt;            // only time spent searching the static counts
                if (s.heard.length === LAST || s.waitT > REVEAL_WAIT_S) { s.reveal = 0.01; say(HINT); }
            }
        }

        // ── the picture ──
        const box = (x, y, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); ctx.fillStyle = C.void; ctx.fillRect(x + 1, y + 1, w - 2, h - 2); };
        const pulseOn = (i, now) => i >= 0 && STATIONS[i].mod === 'pulse' && cyc(now, 1000) < 200;
        function stripe(i, now, fade) {
            if (!live(i)) return 0;
            const st = STATIONS[i];
            const a = st.vis * (i === LAST ? s.reveal : 1 - fade) * 0.9
                + 0.55 * Math.exp(-(((px(s.f) - st.x) / 12) ** 2)) * (1 - fade);   // brighter as the needle nears
            if (s.mode === 'play' && s.st === i && playing()[2]) return a * (0.4 + 0.9 * burst(now));
            if (st.mod === 'loop') return a * (cyc(now, 3200) < 2400 ? 1 : 0.2);
            if (st.mod === 'pulse') return a * (pulseOn(i, now) ? 1.6 : 0.3);
            if (st.mod === 'flicker') return a * (0.3 + 0.7 * Math.random());
            return a;
        }
        function pushRow(now) {
            wf.copyWithin(BW, 0, (WF_H - 1) * BW);
            const nx = px(s.f), fade = s.mode === 'end' ? Lab.clamp(s.endT / 3, 0, 1) : 0;
            for (let x = 0; x < BW; x++) {
                const hiss = (0.1 + 0.05 * Math.sin(x * 0.07 + now * 0.0005)) * 1.35 * Math.random() ** 1.8;
                const near = 0.12 * Math.exp(-(((BX + x - nx) / 14) ** 2)) * Math.random();
                wf[x] = (hiss + near) * (1 - 0.75 * fade);
            }
            STATIONS.forEach((st, i) => {
                const a = stripe(i, now, fade);
                for (let dx = -4; a > 0 && dx <= 4; dx++) {
                    const x = st.x - BX + dx;
                    if (x >= 0 && x < BW) wf[x] += a * Math.exp(-((dx / 1.6) ** 2));
                }
            });
        }
        function drawWaterfall() {
            const d = img.data, nx = Math.round(px(s.f)), goldX = STATIONS[LAST].x;
            for (let r = 0; r < WF_H; r++) {
                for (let x = 0; x < BW; x++) {
                    const X = BX + x, Y = WF_Y + r, v = wf[r * BW + x], o = (r * BW + x) * 4;
                    const ours = s.reveal > 0 && Math.abs(X - goldX) <= 1;   // our own signal shows as a thin gold thread
                    let c = PAL.void;
                    if (Lab.on(X, Y, (v - 0.62) * 2.6)) c = ours ? PAL.gold : PAL.b;
                    else if (Lab.on(X, Y, (v - 0.3) * 2)) c = ours ? PAL.gold : PAL.g;
                    else if (Lab.on(X, Y, v * 1.6)) c = ours ? PAL.amber : PAL.d;
                    else if (X === nx && Y % 3 === 0) c = PAL.amber;   // the needle, carried up faintly
                    d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
                }
            }
            ctx.putImageData(img, BX, WF_Y);
        }
        function drawDial() {
            box(12, DIAL_Y, 296, 32, C.line2);
            ctx.fillStyle = C.ink; ctx.fillRect(13, DIAL_Y + 1, 294, 30);
            for (let k = 0; k <= 48; k++) {
                const x = Math.round(px(k / 48)), major = k % 4 === 0;
                ctx.fillStyle = major ? C.green : C.greenD;
                ctx.fillRect(x, BASE_Y - (major ? 5 : 2), 1, major ? 5 : 2);
                if (k % 8 === 0) { const lab = String(mhzOf(k / 48)); const lw = Lab.textWidth(lab); Lab.text(ctx, lab, k === 0 ? x : k === 48 ? x - lw + 1 : x - (lw >> 1), BASE_Y + 3, C.boneD); }
            }
            ctx.fillStyle = C.line2; ctx.fillRect(BX, BASE_Y, BW, 1);
            ctx.fillStyle = C.gold;                // a pencil mark over every station you have heard
            s.heard.forEach(i => { ctx.fillRect(STATIONS[i].x - 1, DIAL_Y + 4, 3, 1); ctx.fillRect(STATIONS[i].x, DIAL_Y + 5, 1, 1); });
            const x = Math.round(px(s.f));
            ctx.fillStyle = C.amber;
            ctx.fillRect(x, DIAL_Y + 2, 1, 28); ctx.fillRect(x - 1, DIAL_Y + 1, 3, 2); ctx.fillRect(x - 1, DIAL_Y + 29, 3, 1);
        }
        function drawReadouts(n, now) {
            const y = 129, locked = n.c >= LOCK_C && s.mode !== 'end';
            Lab.text(ctx, 'FREQ', BX, y, C.boneD);
            const w = Lab.text(ctx, String(mhzOf(s.f)), BX + 20, y, C.greenBr);
            Lab.text(ctx, 'MHZ', BX + 24 + w, y, C.boneD);
            let sig = n.i < 0 ? 0 : n.c * (0.55 + STATIONS[n.i].vis * (n.i === LAST ? s.reveal : 1));
            if (n.i >= 0 && STATIONS[n.i].mod === 'pulse') sig *= pulseOn(n.i, now) ? 1.1 : 0.55;
            sig = s.mode === 'end' ? Math.random() * 0.05 : Lab.clamp(sig + Math.random() * 0.08, 0, 1);
            Lab.text(ctx, 'SIG', 100, y, C.boneD);
            for (let k = 0; k < 30; k++) {
                ctx.fillStyle = k < Math.round(sig * 30) ? (k >= 24 ? C.amber : C.green) : C.line;
                ctx.fillRect(114 + k * 3, y, 2, 5);
            }
            const acquiring = s.lockT > 0;           // blinks while a new voice is being locked
            ctx.fillStyle = locked && !(acquiring && cyc(now, 300) < 150) ? C.greenBr : n.c >= 0.5 && s.mode !== 'end' ? C.greenD : C.line;
            ctx.fillRect(212, y + 1, 3, 3);
            const id = n.i >= 0 && n.c >= 0.5 && s.mode !== 'end' ? STATIONS[n.i].id : '----';
            Lab.text(ctx, id, 304 - Lab.textWidth(id), y, locked ? C.greenBr : C.bone);
        }
        function drawScope(n, now) {
            const x0 = BX, y0 = 141, w = 136, h = 34, mid = y0 + (h >> 1);
            box(x0, y0, w, h, C.line);
            Lab.line(ctx, x0 + 2, mid, x0 + w - 3, mid, C.line2, 0.4);
            const c = n.i >= 0 && s.mode !== 'end' ? n.c : 0, quiet = s.mode === 'end' ? 0.2 : 1;
            const talking = transmitting(), tick = c > 0.3 && pulseOn(n.i, now);
            const color = talking ? C.greenBr : c >= 0.5 ? C.green : C.greenD;
            let prev = mid;
            for (let i = 0; i < w - 4; i++) {
                let y = (Math.random() - 0.5) * (2 + 9 * (1 - c)) * quiet;
                if (talking) y += Math.sin(i * 0.5 + now * 0.03) * 12 * burst(now + i * 12);
                else if (tick) y += Math.sin(i * 1.1) * 12 * c;
                else y += Math.sin(i * 0.25 + now * 0.008) * 5 * c * c;
                const yy = Math.round(Lab.clamp(mid + y, y0 + 2, y0 + h - 3));
                if (i > 0) Lab.line(ctx, x0 + 1 + i, prev, x0 + 2 + i, yy, color);
                prev = yy;
            }
        }
        function drawLog() {
            Lab.text(ctx, 'LOG', 162, 141, C.greenD);
            s.heard.forEach((i, k) => Lab.text(ctx, mhzOf(STATIONS[i].f) + ' ' + STATIONS[i].id, 162, 148 + k * 6,
                k === s.heard.length - 1 ? C.bone : C.boneD));
        }
        function drawKnob() {
            const cx = 291, cy = 158, a = (-225 + s.f * 270) * Math.PI / 180;
            for (let t = -225; t <= 45; t += 27) Lab.dot(ctx, cx + Math.cos(t * Math.PI / 180) * 15, cy + Math.sin(t * Math.PI / 180) * 15, C.greenD);
            Lab.disc(ctx, cx, cy, 12, d => 0.55 - d * 0.35, C.line2);
            Lab.ring(ctx, cx, cy, 12, C.greenD);
            Lab.line(ctx, cx + Math.cos(a) * 4, cy + Math.sin(a) * 4, cx + Math.cos(a) * 10, cy + Math.sin(a) * 10, C.bone);
            Lab.dot(ctx, cx + Math.cos(a) * 10, cy + Math.sin(a) * 10, C.greenBr);
        }
        function draw(now) {
            ctx.fillStyle = C.void; ctx.fillRect(0, 0, Lab.W, Lab.H);
            Lab.text(ctx, 'LONG RANGE RADIO', BX, 2, C.boneD);
            box(BX - 1, WF_Y - 1, BW + 2, WF_H + 2, C.line2);
            drawWaterfall();
            drawDial();
            const n = nearest();
            drawReadouts(n, now);
            drawScope(n, now);
            drawLog();
            drawKnob();
        }

        // ── input: keys, on-screen hold buttons (in start), and dragging anywhere on the picture ──
        Lab.onKey((key, e) => {
            if (e && e.repeat) return;
            if (s.mode === 'end') { if (key === ' ' || key === 'Enter') start(); return; }
            if (key === 'ArrowLeft' || key === 'a') tune(-1 / (BW - 1));
            if (key === 'ArrowRight' || key === 'd') tune(1 / (BW - 1));
        });
        const toF = e => Lab.clamp((ui.toPixel(e).x - BX) / (BW - 1), 0, 1);
        const canvas = ui.canvas;
        canvas.onpointerdown = e => {
            if (s.mode === 'end') return;
            s.drag = true; s.f = toF(e);
            try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* capture is optional */ }
        };
        canvas.onpointermove = e => { if (s.drag && s.mode !== 'end') s.f = toF(e); };
        canvas.onpointerup = () => { s.drag = false; };
        canvas.onpointercancel = canvas.onpointerup;

        start();
        Lab.loop((dt, now) => {
            update(dt);
            if (++frame % 2 === 0) pushRow(now);
            draw(now);
        }, 30);
        return () => { canvas.onpointercancel = null; s.drag = false; };
    }

    Lab.register({
        id: 'radio', badge: 'parked',
        name: 'Dead channels',
        short: 'Tune through the dead channels',
        verb: 'Sweep the dial through static, listening for the eight ships ahead. Hold the needle on a voice to hear it out.',
        serves: 'The light reads whatever reaches it. Every voice on this band comes from ahead, even Earth, even our own ship.',
        replaces: 'The long-range scan.',
        controls: '←/→ or A/D tune (tap or hold) · or drag on the picture · rest the needle on a voice · Space: run again',
        mount,
    });
})();
