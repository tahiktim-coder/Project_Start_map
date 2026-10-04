/* proto-radio.js — "Dead channels". Sweep the long-range radio through static, listening for the eight ships ahead.
   Every voice on the band comes from ahead, where the light is: even Earth, and at the top of the band, our own ship.
   The set is human-made, so its cabinet, dial and valve glow are warm; the static and the voices in it are cold. Only our
   own signal, coming back out of the light, shows warm in the waterfall. Would replace the long-range scan. */
(function () {
    'use strict';
    const Lab = window.Lab, C = Lab.C;

    // ── layout: the waterfall and the dial glass share one band, x = BX + f * (BW - 1) ──
    const BX = 14, BW = 452, WF_Y = 20, WF_H = 110;                                            // the waterfall of static
    const GLASS = { x: BX, y: 140, w: BW, h: 30 }, TICK_Y = 160;                                 // the dial glass under it
    const SPK = { x: 14, y: 185, w: 74, h: 76 }, METER = { x: 100, y: 185, w: 86, h: 66 };     // the lower panel: speaker, meter,
    const READ = { x: 200, y: 185, w: 164, h: 32 }, SCOPE = { x: 200, y: 229, w: 164, h: 32 };  // readout over scope, and the knob
    const KNOB = { x: 422, y: 220, r: 30 }, KNOB_TURNS = 2.5;   // the knob turns two and a half times across the band

    // ── tuning ──
    const WINDOW_PX = 14, LOCK_C = 0.84;      // words start coming through within 14 px; locked within about 2 px
    const FAINT_C = 0.12, HOLD_S = 0.7;       // below FAINT_C it is only static; hold a lock this long to play it
    const AFC_C = 0.3, AFC_WAIT_S = 0.35, AFC_RATE = 3; // let go near a voice and the set pulls the needle onto it
    const SWEEP_HINT = 2, LOST_HINT_S = 25;   // band-widths swept, or seconds lost in the static, before Jaxon points the way
    const BEAT_S = 1.8, CLOSE_AT_S = 2.8;     // a pause before our own signal comes up; the static dies before the last line
    const MHZ_LO = 8400, MHZ_HI = 8460;       // the deep-space band
    const ROW_MS = 66, TICK_MS = 1000;        // a waterfall row every other frame; EXODUS-980's clock ticks once a second

    const INTRO = ['Jaxon', "Radio's on. Eight ships went ahead of us. If anyone's alive, we'll hear them."];
    const REVEAL = ['A.U.R.A.', 'A new signal at the top of the band, Commander. Very faint.'];
    const CLOSING = ['', 'Every voice on the band came from ahead, where the light is.'];
    const HINTS = {                           // each said at most once per station; after that the mark on the dial does the work
        sweep: m => ['Jaxon', `Slow down. Try near ${m} and let it settle.`],
        lost: m => ['Jaxon', `Try near ${m}. Get close, then let go of the dial.`],
    };

    // Each line: [speaker, words, isTransmission]. A transmission needs the needle held on it; crew lines do not.
    const STATIONS = [
        { f: 0.14, vis: 0.5, id: 'EARTH', mod: 'steady', lines: [
            ['Earth', 'Exodus Control to EXODUS-9. We will keep this channel open. Good luck.', true],
            ['Mira', 'That came from ahead of us. Earth is behind us.', false]] },
        { f: 0.37, vis: 0.48, id: 'EXODUS-6', mod: 'loop', lines: [
            ['EXODUS-6', 'This is EXODUS-6, Captain Ruth Harlan. We have stopped. Please respond.', true],
            ['A.U.R.A.', 'That message is on a loop, Commander. EXODUS-6 has been dead about twenty years.', false]] },
        { f: 0.56, vis: 0.5, id: 'EXODUS-980', mod: 'tick', lines: [
            ['A.U.R.A.', "EXODUS-980's transponder clock, Commander. The ship has been dead 104 years.", false]] },
        { f: 0.76, vis: 0.42, id: 'EXODUS-30,211', mod: 'flicker', lines: [
            ['EXODUS-30,211', 'Four crew, Commander. All accounted for.', true],
            ['Vance', "That's A.U.R.A.'s voice.", false],
            ['A.U.R.A.', 'That ship has been dead 396 years, Commander. It has no power.', false],
            ['Vance', "Then who's talking?", false]] },
        { f: 0.93, vis: 0.34, id: 'EXODUS-9', mod: 'steady', ours: true, lines: [
            ['EXODUS-9', 'Good morning, Commander. All four crew are awake and well.', true],
            ['Mira', "That's what A.U.R.A. said when we woke up.", false],
            ['A.U.R.A.', 'That signal is ours, Commander. It is coming from ahead of us.', false]] },
    ].map(st => ({ ...st, x: Math.round(BX + st.f * (BW - 1)) }));
    const LAST = STATIONS.length - 1;          // our own station: it comes up only once all four others are heard

    const px = f => BX + f * (BW - 1), mhz = f => MHZ_LO + f * (MHZ_HI - MHZ_LO);
    const lineTime = words => 2 + 0.28 * words.split(' ').length;                   // time to read it, and a moment after
    const cyc = (t, period) => ((t % period) + period) % period;                       // safe for the negative times of the first fill
    const burst = t => Math.abs(Math.sin(t * 0.011) * Math.sin(t * 0.0043 + 1.3));   // a speech-like envelope
    const tickOn = t => cyc(t, TICK_MS) < 160, loopOn = t => cyc(t, 3200) < 2400, keyOf = line => (line ? line.join('|') : '');
    /** Like Lab.pick, for rgb triples and a dither threshold already looked up. */
    function step(ramp, tone, th) {
        const top = ramp.length - 1, pos = Lab.clamp(tone, 0, 1) * top, lo = Math.floor(pos);
        return ramp[Math.min(top, pos - lo > th ? lo + 1 : lo)];
    }
    /** Tens of thousands of beacons by sector 5: here a few dozen hairlines too faint to tune, so the band is never empty. */
    function makeBeacons() {
        const r = Lab.rng(9011), out = [];
        for (let guard = 0; out.length < 64 && guard < 1000; guard++) {
            const x = Math.floor(r() * BW);
            if (STATIONS.some(st => Math.abs(st.x - BX - x) < 12)) continue;
            out.push({ x, amp: 0.05 + r() * 0.11, period: 500 + r() * 3500, duty: 0.15 + r() * 0.7, phase: r() * 4000 });
        }
        return out;
    }

    function mount(ctx, ui) {
        const W = Lab.W, H = Lab.H, mix = Lab.mix, TAU = Math.PI * 2;
        // warm: the set itself, a tone t of the way from the void to lamp-light. cold: the static and the voices in it.
        const ink = t => mix(C.void, C.warm, t);
        const CAB = [0, 0.04, 0.08, 0.12, 0.17, 0.24, 0.34].map(ink), GLOW = [0, 0.08, 0.16, 0.28, 0.46].map(ink);
        const BAKELITE = [0, 0.04, 0.08, 0.13, 0.2, 0.3, 0.44, 0.62].map(ink);
        const EDGE_HI = ink(0.34), EDGE_MID = ink(0.2), EDGE_LO = ink(0.09), LEGEND = ink(0.5), LEGEND_DIM = ink(0.28);
        const NOISE = [C.void, C.deep, C.dusk, C.haze, C.mist].map(Lab.rgb), SIG = [C.uiDim, C.ui, C.uiBright, C.star].map(Lab.rgb);
        const OURS = [mix(C.void, C.lightHalo, 0.5), C.lightHalo, C.light].map(Lab.rgb);

        const N = WF_H * BW, img = ctx.createImageData(BW, WF_H), BEACONS = makeBeacons();
        const wfN = new Float32Array(N), wfS = new Float32Array(N), wfO = new Float32Array(N);   // noise, voices, our own voice
        const TH1 = new Float32Array(N), TH2 = new Float32Array(N);                               // dither thresholds, looked up once
        for (let k = 0; k < N; k++) {
            const x = BX + (k % BW), y = WF_Y + Math.floor(k / BW);
            TH1[k] = Lab.bayer(x, y); TH2[k] = Lab.bayer(x + 2, y + 1);
        }
        const MP = { x: METER.x + METER.w / 2, y: METER.y + METER.h - 7 }, M_R = 37;
        const meterAngle = v => (-145 + 110 * Lab.clamp(v, 0, 1)) * Math.PI / 180;
        const SPK_HOLES = [], KNOB_PX = [];
        for (let row = 0, y = SPK.y + 3; y <= SPK.y + SPK.h - 5; y += 4, row++) {
            for (let x = SPK.x + 3 + (row % 2) * 2; x <= SPK.x + SPK.w - 5; x += 4) {
                const d = Math.hypot((x - SPK.x - SPK.w / 2 + 1) / (SPK.w / 2 - 3), (y - SPK.y - SPK.h / 2 + 1) / (SPK.h / 2 - 3));
                if (d <= 1) SPK_HOLES.push({ x, y, d });
            }
        }
        for (let dy = -KNOB.r; dy <= KNOB.r; dy++) for (let dx = -KNOB.r; dx <= KNOB.r; dx++) {
            const d = Math.hypot(dx, dy);
            if (d <= KNOB.r + 0.3) KNOB_PX.push({ x: KNOB.x + dx, y: KNOB.y + dy, dx, dy, d, a: Math.atan2(dy, dx), lit: (-dx - dy) / (Math.SQRT2 * KNOB.r) });
        }

        let s = null, frame = 0, snd = null, grab = null, soundBroken = false;
        const live = i => i < LAST || s.reveal > 0;
        const clarity = i => Lab.clamp(1 - Math.abs(px(s.f) - STATIONS[i].x) / WINDOW_PX, 0, 1);
        const playing = () => STATIONS[s.st].lines[s.li];
        const transmitting = () => s.mode === 'play' && playing()[2] && clarity(s.st) >= LOCK_C;
        const endFade = () => (s.mode === 'end' ? Lab.clamp(s.endT / 3, 0, 1) : 0);
        const nearest = () => STATIONS.reduce((b, st, k) => (live(k) && clarity(k) > b.c ? { i: k, c: clarity(k) } : b), { i: -1, c: 0 });
        /** What the instruments pick up: the nearest voice, except that at the end only our own is left on the band. */
        const audible = () => { const n = nearest(); return n.i >= 0 && (s.mode !== 'end' || STATIONS[n.i].ours) ? n : { i: -1, c: 0 }; };
        /** The line as heard at clarity c: missing words become "…". Each word has a fixed threshold, so it does not flicker. */
        function garble(words, c, seed) {
            const r = Lab.rng(Math.imul(seed + 1, 2654435761)), k = (c - 0.2) / (LOCK_C - 0.2), out = [];
            r();                                  // skip the first draw, which follows the seed too closely
            words.split(' ').forEach(w => { if (r() < k) out.push(w); else if (out[out.length - 1] !== '…') out.push('…'); });
            return out.join(' ');
        }

        // ── input: every move the player makes counts toward the sweep hint; the set's own pull (AFC) does not ──
        function moveTo(f) {
            if (s.mode === 'end') return;
            const nf = Lab.clamp(f, 0, 1);
            if (s.mode === 'tune') s.travel += Math.abs(nf - s.f);
            s.f = nf; s.idleT = 0;
        }
        const tune = df => moveTo(s.f + df);
        /** Let go near a voice you have not heard (or the one you are hearing) and the needle eases onto it. */
        function afc(dt) {
            if (s.idleT < AFC_WAIT_S) return;
            let target = -1;
            if (s.mode === 'play' && playing()[2]) target = s.st;
            else STATIONS.forEach((st, i) => { if (live(i) && !s.heard.includes(i) && clarity(i) >= AFC_C && (target < 0 || clarity(i) > clarity(target))) target = i; });
            if (target < 0 || clarity(target) < AFC_C) return;
            const gap = STATIONS[target].x - px(s.f);
            s.f = Lab.clamp(s.f + (Math.abs(gap) < 0.05 ? gap : gap * Math.min(1, dt * AFC_RATE)) / (BW - 1), 0, 1);
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
        /** Swept twice without settling, or lost a while: Jaxon names a voice still unheard, and the dial marks it. */
        function hint(why) {
            s.travel = 0; s.lostT = 0;
            const open = STATIONS.map((st, i) => i).filter(i => live(i) && !s.heard.includes(i));
            if (!open.length) return;
            const dist = i => Math.abs(STATIONS[i].x - px(s.f));
            if (!open.includes(s.hintSt)) s.hintSt = open.reduce((a, b) => (dist(a) <= dist(b) ? a : b));   // keep pointing at one place
            if (s.hinted.includes(why + s.hintSt)) return;
            s.hinted = [...s.hinted, why + s.hintSt];
            say(HINTS[why](Math.round(mhz(STATIONS[s.hintSt].f))));
        }

        // ── the story ──
        function begin(i) {
            s.mode = 'play'; s.st = i; s.li = 0; s.lineT = 0; s.lockT = 0; s.mark = s.log.length; s.travel = 0; s.lostT = 0;
            s.heard = [...s.heard, i];
            say(playing());
        }
        function play(dt) {
            const l = playing(), c = clarity(s.st);
            if (l[2] && c < FAINT_C) {           // tuned right away mid-transmission: the voice is lost, and starts over next time
                s.log = s.log.slice(0, s.mark); s.heard = s.heard.filter(i => i !== s.st); s.mode = 'tune';
                ui.clear(); if (s.log.length) ui.say(...s.log[s.log.length - 1]); ui.say('', ''); s.faintKey = ''; return;   // just static
            }
            if (l[2] && c < LOCK_C) { hear([c >= 0.5 ? l[0] : '', garble(l[1], c, s.st)], true); return; }   // drifted: it breaks up and waits
            hear(null);
            s.lineT += dt;
            if (s.lineT < lineTime(l[1])) return;
            s.li += 1; s.lineT = 0;
            if (s.li < STATIONS[s.st].lines.length) { say(playing()); return; }
            s.mode = 'tune';
            if (s.st === LAST) end();
        }
        /** Our own voice has finished: the static dies away around it first, then the last line and the way out. */
        function end() { s.mode = 'end'; s.endT = 0; s.btnDir = 0; ui.buttons([]); }
        function close() { s.closed = true; say(CLOSING); ui.buttons([{ label: 'Run it again', primary: true, onClick: start }]); }
        function start() {
            s = { f: 0.04, holdT: 0, btnDir: 0, drag: false, idleT: 0, travel: 0, lostT: 0, hintSt: -1, hinted: [], mode: 'tune',
                  st: -1, li: 0, lineT: 0, lockT: 0, mark: 0, heard: [], reveal: 0, beatT: 0, endT: 0, closed: false, log: [],
                  faintKey: '', mv: 0, mvv: 0, knobA: 0 };
            wfN.fill(0); wfS.fill(0); wfO.fill(0);
            const now = performance.now();
            for (let r = 0; r < WF_H; r++) pushRow(now - (WF_H - r) * ROW_MS);   // open on a fresh, full waterfall
            say(INTRO);
            const hold = (label, dir) => ({ label, hold: true, onDown: () => { s.btnDir = dir; tune(dir / (BW - 1)); }, onUp: () => { s.btnDir = 0; } });
            ui.buttons([hold('← Tune down', -1), hold('Tune up →', 1)]);
        }

        function signalLevel(n, now) {
            if (n.i < 0) return Math.random() * 0.04;
            const st = STATIONS[n.i];
            const v = n.c * (0.55 + 0.5 * st.vis * (st.ours ? s.reveal : 1));   // a clear voice sits just into the strong end
            const beat = st.mod === 'tick' ? (tickOn(now) ? 1.15 : 0.6) : st.mod === 'loop' && !loopOn(now) ? 0.3 : 1;
            return Lab.clamp(v * beat + Math.random() * 0.06, 0, 1);
        }
        function update(dt, now) {
            const k = Lab.keys, dir = ((k.has('ArrowRight') || k.has('d') ? 1 : 0) - (k.has('ArrowLeft') || k.has('a') ? 1 : 0)) || s.btnDir;
            s.holdT = dir ? s.holdT + dt : 0;     // a tap moves one pixel; holding sweeps faster and faster
            if (dir && s.holdT > 0.25) tune(dir * Lab.lerp(12, 170, Lab.clamp((s.holdT - 0.25) / 1.2, 0, 1)) * dt / (BW - 1));
            s.idleT = dir || s.drag ? 0 : s.idleT + dt;
            if (s.reveal > 0) s.reveal = Math.min(1, s.reveal + dt / 2);
            s.mvv += ((signalLevel(audible(), now) - s.mv) * 70 - s.mvv * 10) * dt;   // the meter needle has a little weight
            s.mv += s.mvv * dt;
            if (s.mode === 'end') {               // the set settles on our own voice, wherever you left the dial
                s.endT += dt; s.f += (STATIONS[LAST].f - s.f) * Math.min(1, dt * 2);
                if (!s.closed && s.endT >= CLOSE_AT_S) close();
                return;
            }
            afc(dt);
            if (s.mode === 'play') play(dt);
            if (s.mode === 'end' || (s.mode === 'play' && playing()[2])) return;   // a transmission holds the needle
            const n = nearest();
            s.lockT = n.c >= LOCK_C && !s.heard.includes(n.i) ? s.lockT + dt : 0;
            if (s.mode === 'play') return;        // crew lines run on while you tune; a voice you lock waits for them
            const p = preview();
            hear(p, false);
            if (s.lockT >= HOLD_S) { begin(n.i); return; }
            if (!s.reveal && s.heard.length === LAST) {   // all four heard: let the last line land, then our own comes up
                s.beatT += dt;
                if (s.beatT >= BEAT_S) { s.reveal = 0.01; s.travel = 0; s.lostT = 0; say(REVEAL); }
                return;
            }
            s.lostT += dt;
            if (!p && s.travel >= SWEEP_HINT) hint('sweep');
            else if (!p && s.lostT >= LOST_HINT_S) hint('lost');
        }

        // ── the waterfall: cold static, voices as soft bright stripes, our own voice a warm thread ──
        function stripe(i, now, fade) {
            if (!live(i)) return 0;
            const st = STATIONS[i], keep = st.ours ? s.reveal : 1 - fade;
            const a = (st.vis + 0.5 * Math.exp(-(((px(s.f) - st.x) / 16) ** 2))) * keep;   // brighter as the needle nears
            if (s.mode === 'play' && s.st === i && playing()[2]) return a * (0.55 + 0.75 * burst(now));
            if (st.mod === 'loop') return a * (loopOn(now) ? 1 : 0.15);
            if (st.mod === 'tick') return a * (tickOn(now) ? 1.5 : 0.22);
            return st.mod === 'flicker' ? a * (0.3 + 0.7 * Math.random()) : a;
        }
        function pushRow(now) {
            wfN.copyWithin(BW, 0, N - BW); wfS.copyWithin(BW, 0, N - BW); wfO.copyWithin(BW, 0, N - BW);
            const nx = px(s.f) - BX, fade = endFade(), n = nearest(), calm = 1 - 0.6 * (n.i >= 0 ? n.c : 0);
            for (let x = 0; x < BW; x++) {
                const hiss = (0.12 + 0.05 * Math.sin(x * 0.05 + now * 0.0004)) * 1.4 * Math.random() ** 1.8;
                const near = 0.16 * calm * Math.exp(-(((x - nx) / WINDOW_PX) ** 2)) * Math.random();   // the passband, thinning as you tune in
                wfN[x] = (hiss + near) * (1 - 0.7 * fade); wfS[x] = 0; wfO[x] = 0;
            }
            BEACONS.forEach(b => { wfS[b.x] += (cyc(now + b.phase, b.period) < b.duty * b.period ? b.amp : b.amp * 0.35) * (1 - 0.5 * fade); });
            STATIONS.forEach((st, i) => {           // at the end our own thread widens and a warm haze opens round it
                const a = stripe(i, now, fade), row = st.ours ? wfO : wfS, glow = st.ours ? fade : 0;
                const width = st.ours ? 1.6 + 0.8 * glow : 2.6, reach = 7 + Math.round(14 * glow);
                for (let dx = -reach; a > 0 && dx <= reach; dx++) {
                    const x = st.x - BX + dx;
                    if (x >= 0 && x < BW) row[x] += a * Math.exp(-((dx / width) ** 2)) + 0.32 * glow * Math.exp(-((dx / 11) ** 2)) * Math.random();
                }
            });
        }
        function drawWaterfall() {
            const d = img.data;
            for (let k = 0; k < N; k++) {
                const th = TH1[k], o = wfO[k], sg = wfS[k], q = k * 4;
                const c = o > 0.05 && (o - 0.05) * 2.2 > th ? step(OURS, (o - 0.2) * 1.3, TH2[k])
                    : sg > 0.04 && (sg - 0.04) * 2.4 > th ? step(SIG, (sg - 0.3) * 1.1, TH2[k]) : step(NOISE, wfN[k] * 2.4, th);
                d[q] = c[0]; d[q + 1] = c[1]; d[q + 2] = c[2]; d[q + 3] = 255;
            }
            ctx.putImageData(img, BX, WF_Y);
        }

        // ── the set, painted once: a warm-dark cabinet with windows let into it ──
        const canvas2d = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
        const px1 = (g, x, y, color) => { g.fillStyle = color; g.fillRect(x, y, 1, 1); };
        /** A window set into the panel: a raised rim lit from the top left, then a lip whose upper walls sit in shadow. */
        function bezel(g, r) {
            const x = r.x - 4, y = r.y - 4, w = r.w + 8, h = r.h + 8;
            [[EDGE_HI, x + 1, y, w - 2, 1], [EDGE_HI, x, y + 1, 1, h - 2], [C.void, x + 1, y + h - 1, w - 2, 1], [C.void, x + w - 1, y + 1, 1, h - 2],
             [EDGE_MID, x + 1, y + 1, w - 2, 1], [EDGE_MID, x + 1, y + 1, 1, h - 2], [EDGE_LO, x + 2, y + h - 2, w - 3, 1], [EDGE_LO, x + w - 2, y + 2, 1, h - 3],
             [EDGE_LO, x + 2, y + h - 4, w - 4, 2], [EDGE_LO, x + w - 4, y + 2, 2, h - 4], [EDGE_MID, x + 3, y + h - 3, w - 5, 1], [EDGE_MID, x + w - 3, y + 3, 1, h - 5],
             [C.void, x + 2, y + 2, w - 4, 2], [C.void, x + 2, y + 2, 2, h - 4], [C.void, r.x, r.y, r.w, r.h]]
                .forEach(([c, a, b, ww, hh]) => { g.fillStyle = c; g.fillRect(a, b, ww, hh); });
        }
        function paintGlass(g) {
            const R = GLASS, cy = R.y + R.h * 0.55, lamps = [R.x + R.w * 0.28, R.x + R.w * 0.72];
            for (let y = R.y; y < R.y + R.h; y++) for (let x = R.x; x < R.x + R.w; x++) {
                const hot = Math.min(1, lamps.reduce((a, lx) => a + Math.exp(-(((x - lx) / 110) ** 2)), 0));
                px1(g, x, y, Lab.pick(GLOW, 0.1 + 0.3 * Math.exp(-(((y - cy) / 10) ** 2)) * (0.45 + 0.55 * hot), x, y));
            }
            g.fillStyle = ink(0.14); g.fillRect(R.x, R.y, R.w, 1);             // the glass catches a little light along its top
            g.fillStyle = ink(0.24); g.fillRect(R.x, TICK_Y, R.w, 1);
            for (let k = 0; k <= 60; k++) {
                const x = Math.round(px(k / 60)), ten = k % 10 === 0, five = k % 5 === 0, h = ten ? 6 : five ? 4 : 2;
                g.fillStyle = ten ? LEGEND : five ? ink(0.36) : ink(0.22);
                g.fillRect(x, TICK_Y - h, 1, h);
                const lab = String(MHZ_LO + k), lw = Lab.textWidth(lab);
                if (ten) Lab.text(g, lab, Lab.clamp(x - (lw >> 1), R.x + 1, R.x + R.w - 1 - lw), TICK_Y + 3, LEGEND);
            }
        }
        function paintPanel(g) {                                                // the speaker plate, the meter face, the screens
            for (let y = SPK.y; y < SPK.y + SPK.h; y++) for (let x = SPK.x; x < SPK.x + SPK.w; x++) px1(g, x, y, Lab.pick(CAB, 0.44 - 0.14 * ((y - SPK.y) / SPK.h), x, y));
            SPK_HOLES.forEach(h => { g.fillStyle = C.void; g.fillRect(h.x, h.y, 2, 2); g.fillStyle = EDGE_MID; g.fillRect(h.x, h.y + 2, 2, 1); });
            const R = METER;
            for (let y = R.y; y < R.y + R.h; y++) for (let x = R.x; x < R.x + R.w; x++) {
                px1(g, x, y, Lab.pick(GLOW, 0.08 + 0.34 * Math.exp(-(((x - MP.x) / 40) ** 2) - (((y - (R.y + R.h)) / 34) ** 2)), x, y));
            }
            for (let i = 0; i <= 60; i++) { const a = meterAngle(i / 60); px1(g, Math.round(MP.x + Math.cos(a) * (M_R + 1)), Math.round(MP.y + Math.sin(a) * (M_R + 1)), ink(0.3)); }
            for (let k = 0; k <= 10; k++) {
                const a = meterAngle(k / 10), strong = k >= 8, major = k % 2 === 1, r0 = major ? M_R - 5 : M_R - 3, col = strong ? ink(0.8) : LEGEND;
                Lab.line(g, MP.x + Math.cos(a) * r0, MP.y + Math.sin(a) * r0, MP.x + Math.cos(a) * M_R, MP.y + Math.sin(a) * M_R, col);
                if (major) Lab.text(g, String(k), Math.round(MP.x + Math.cos(a) * (M_R + 7) - 1), Math.round(MP.y + Math.sin(a) * (M_R + 7) - 2), strong ? ink(0.8) : LEGEND_DIM);
            }
            [READ, SCOPE].forEach(S => { g.fillStyle = C.deep; g.fillRect(S.x, S.y, S.w, S.h); });
            g.fillStyle = C.line;
            for (let x = SCOPE.x + 4; x < SCOPE.x + SCOPE.w; x += 8) for (let y = SCOPE.y + 4; y < SCOPE.y + SCOPE.h; y += 8) g.fillRect(x, y, 1, 1);
            g.fillStyle = C.line2;
            for (let x = SCOPE.x + 1; x < SCOPE.x + SCOPE.w - 1; x += 2) g.fillRect(x, SCOPE.y + (SCOPE.h >> 1), 1, 1);
            Lab.disc(g, KNOB.x + 3, KNOB.y + 4, KNOB.r + 1, 0.75, C.void);        // the knob's shadow, and its scale
            for (let k = 0; k < 24; k++) {
                const a = (k / 24) * TAU, major = k % 6 === 0, rr = KNOB.r + 5;
                g.fillStyle = major ? LEGEND : LEGEND_DIM;
                g.fillRect(Math.round(KNOB.x + Math.cos(a) * rr), Math.round(KNOB.y + Math.sin(a) * rr), 1, 1);
                if (major) g.fillRect(Math.round(KNOB.x + Math.cos(a) * (rr + 1)), Math.round(KNOB.y + Math.sin(a) * (rr + 1)), 1, 1);
            }
        }
        function buildCabinet() {
            const c = canvas2d(), g = c.getContext('2d');
            const im = g.createImageData(W, H), d = im.data, R = CAB.map(Lab.rgb), r = Lab.rng(4077);
            const grain = Array.from({ length: H }, () => r());
            for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {                // brushed, lit from above, darker at the rim
                const edge = Math.min(x, W - 1 - x, y, H - 1 - y);
                const t = 0.28 + 0.07 * grain[y] + 0.035 * Math.sin(x * 0.012 + grain[y] * 9) + 0.12 * (1 - y / H) - Math.max(0, 4 - edge) * 0.06;
                const col = step(R, t, Lab.bayer(x, y)), o = (y * W + x) * 4;
                d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
            }
            g.putImageData(im, 0, 0);
            g.fillStyle = C.void; g.fillRect(4, 175, W - 8, 1); g.fillStyle = EDGE_MID; g.fillRect(4, 176, W - 8, 1);   // a groove
            [[5, 6], [W - 6, 6], [5, H - 6], [W - 6, H - 6]].forEach(([x, y]) => {   // a slotted screw in each corner
                Lab.disc(g, x, y, 2.6, dd => 0.95 - dd * 0.4, EDGE_MID); px1(g, x - 1, y - 1, EDGE_HI); g.fillStyle = C.void; g.fillRect(x - 1, y, 3, 1);
            });
            const band = MHZ_LO + '-' + MHZ_HI + ' MHZ';
            Lab.text(g, 'LONG RANGE RADIO', 14, 6, LEGEND);
            Lab.text(g, band, 452 - Lab.textWidth(band), 6, LEGEND_DIM);
            Lab.disc(g, 462, 8, 5, dd => 0.55 * (1 - dd), ink(0.3)); Lab.disc(g, 462, 8, 2.2, 1, C.warm); px1(g, 461, 7, C.warmBright);   // pilot lamp
            [{ x: BX, y: WF_Y, w: BW, h: WF_H }, GLASS, SPK, METER, READ, SCOPE].forEach(rect => bezel(g, rect));
            paintGlass(g); paintPanel(g);
            Lab.text(g, 'SIGNAL', Math.round(MP.x - Lab.textWidth('SIGNAL') / 2), METER.y + METER.h + 7, LEGEND_DIM);
            Lab.text(g, 'TUNE', Math.round(KNOB.x - Lab.textWidth('TUNE') / 2) + 1, 259, LEGEND_DIM);
            return c;
        }
        /** Laid over the waterfall each frame: darker corners and the scale marks printed on the glass. */
        function buildVeil() {
            const c = canvas2d(), g = c.getContext('2d');
            for (let y = WF_Y; y < WF_Y + WF_H; y++) for (let x = BX; x < BX + BW; x++) {
                const nx = (x - (BX + BW / 2)) / (BW / 2), ny = (y - (WF_Y + WF_H / 2)) / (WF_H / 2);
                const v = Lab.clamp((0.4 * nx * nx + 0.6 * ny * ny - 0.62) * 2.2, 0, 0.85);
                if (v > 0 && Lab.on(x, y, v)) px1(g, x, y, C.void);
            }
            g.fillStyle = C.uiDim;
            for (let k = 0; k <= 12; k++) g.fillRect(Math.round(px(k / 12)), WF_Y, 1, k % 2 ? 2 : 3);
            for (let y = WF_Y + 15; y < WF_Y + WF_H - 2; y += 15) g.fillRect(BX, y, 2, 1);
            return c;
        }
        const cabinet = buildCabinet(), veil = buildVeil();

        // ── the live parts ──
        function drawScreenNeedle() {
            const x = Math.round(px(s.f)), foot = WF_Y + WF_H - 1;
            for (let y = WF_Y + 4; y < foot - 3; y += 3) Lab.dot(ctx, x, y, ink(0.55));   // carried up faintly through the static
            ctx.fillStyle = C.warm; ctx.fillRect(x - 2, foot, 5, 1); ctx.fillRect(x - 1, foot - 1, 3, 1); ctx.fillRect(x, foot - 2, 1, 1);
            ctx.fillStyle = C.uiDim;                                                 // the passband: how far off a voice still comes through
            [-WINDOW_PX, WINDOW_PX].forEach(o => { if (x + o >= BX && x + o < BX + BW) ctx.fillRect(x + o, foot - 3, 1, 4); });
        }
        function drawDial(now) {
            const x = Math.round(px(s.f));                                         // the needle runs behind the glass …
            Lab.shade(ctx, x - 1, GLASS.y, 3, GLASS.h, 0.5, ink(0.45));
            ctx.fillStyle = C.warmBright; ctx.fillRect(x, GLASS.y, 1, GLASS.h);
            s.heard.forEach((i, k) => {                                            // … and the pencil marks are on it
                const st = STATIONS[i], col = k === s.heard.length - 1 ? C.warmBright : LEGEND, w = Lab.textWidth(st.id);
                const lx = Lab.clamp(st.x - (w >> 1), GLASS.x + 2, GLASS.x + GLASS.w - 2 - w);
                ctx.fillStyle = ink(0.1); ctx.fillRect(lx - 1, GLASS.y + 3, w + 2, 7);
                Lab.text(ctx, st.id, lx, GLASS.y + 4, col);
                ctx.fillStyle = col; ctx.fillRect(st.x, GLASS.y + 11, 1, 2);
            });
            if (s.hintSt < 0 || s.heard.includes(s.hintSt) || cyc(now, 900) >= 600) return;
            const hx = STATIONS[s.hintSt].x;                                       // a blinking mark where Jaxon said to try
            ctx.fillStyle = C.warmBright;
            ctx.fillRect(hx - 2, GLASS.y + 5, 5, 1); ctx.fillRect(hx - 1, GLASS.y + 6, 3, 1); ctx.fillRect(hx, GLASS.y + 7, 1, 1);
        }
        function drawMeter() {
            const a = meterAngle(s.mv), tx = MP.x + Math.cos(a) * (M_R - 2), ty = MP.y + Math.sin(a) * (M_R - 2);
            Lab.line(ctx, MP.x + 1, MP.y + 2, tx + 1, ty + 2, C.void, 0.5); Lab.line(ctx, MP.x, MP.y, tx, ty, C.warmBright);   // shadow, needle
            Lab.disc(ctx, MP.x, MP.y, 3.4, 1, EDGE_MID); Lab.dot(ctx, MP.x - 1, MP.y - 1, EDGE_HI);                          // the pivot
        }
        function drawReadout(n, now) {
            const R = READ, st = n.i >= 0 ? STATIONS[n.i] : null, locked = !!st && n.c >= LOCK_C, named = !!st && n.c >= 0.5;
            const w = Lab.text(ctx, mhz(s.f).toFixed(1), R.x + 6, R.y + 4, C.uiBright, 2);
            Lab.text(ctx, 'MHZ', R.x + 10 + w, R.y + 9, C.uiDim);
            const acquiring = s.lockT > 0 && s.lockT < HOLD_S, lit = locked && !(acquiring && cyc(now, 300) < 150), lx = R.x + R.w - 9, ly = R.y + 7;
            Lab.text(ctx, 'LOCK', lx - 22, ly - 2, lit ? C.ui : C.uiDim);
            if (lit) Lab.disc(ctx, lx, ly, 4.5, d => 0.7 * (1 - d), C.uiDim);
            Lab.disc(ctx, lx, ly, 2.2, 1, lit ? C.uiBright : named ? C.uiDim : C.line2);
            Lab.text(ctx, named ? st.id : '- - - -', R.x + 6, R.y + 18, !named ? C.uiDim : st.ours ? C.lightHalo : locked ? C.uiBright : C.ui, 2);
        }
        function drawScope(n, now) {
            const R = SCOPE, mid = R.y + (R.h >> 1), st = n.i >= 0 ? STATIONS[n.i] : null, c = st ? n.c : 0, quiet = 1 - 0.8 * endFade();
            const talking = transmitting(), ticking = st && st.mod === 'tick' && c > 0.3 && tickOn(now);
            const color = st && st.ours && c >= 0.5 ? C.lightHalo : talking ? C.uiBright : c >= 0.5 ? C.ui : C.uiDim;
            let prev = mid;
            for (let i = 0; i < R.w - 2; i++) {
                let y = (Math.random() - 0.5) * (2 + 9 * (1 - c)) * quiet;
                if (talking) y += Math.sin(i * 0.5 + now * 0.03) * 12 * burst(now + i * 12);
                else if (ticking) y += Math.sin(i * 1.1) * 12 * c * Math.exp(-(((i - R.w / 2) / 30) ** 2));
                else y += Math.sin(i * 0.22 + now * 0.008) * 5 * c * c;
                const yy = Math.round(Lab.clamp(mid + y, R.y + 1, R.y + R.h - 2));
                if (i > 0) Lab.line(ctx, R.x + i, prev, R.x + 1 + i, yy, color);
                prev = yy;
            }
        }
        function drawSpeaker(n, now) {                                         // valve glow through the grille, brighter with a voice
            const lvl = 0.6 + (transmitting() ? 0.4 * burst(now) : 0.12 * (n.i >= 0 ? n.c : 0));
            SPK_HOLES.forEach(h => { ctx.fillStyle = Lab.pick(GLOW, lvl * (1 - h.d * 0.85) ** 1.6, h.x, h.y); ctx.fillRect(h.x, h.y, 2, 2); });
        }
        function drawKnob() {
            const th = s.f * KNOB_TURNS * TAU - Math.PI / 2, R = KNOB.r;
            for (const p of KNOB_PX) {                                             // dark bakelite, lit from the top left
                let t;
                if (p.d > R - 4) {                                                 // the knurled skirt: its teeth turn with the knob
                    const tooth = cyc(((p.a - th) / TAU) * 40, 1) < 0.5;
                    t = Math.max(0.16, 0.28 + 0.4 * p.lit) + (tooth ? 0.12 : -0.07) - (p.d > R - 1 ? 0.1 : 0);
                } else if (p.d > R - 5.2) t = 0.02;                                // the groove under the cap
                else if (p.d > R - 7.2) t = 0.22 + 0.4 * p.lit;                     // the cap's rim catches the lamp
                else t = 0.2 + 0.2 * p.lit * (p.d / R) + 0.3 * Math.exp(-(((p.dx + R * 0.32) ** 2 + (p.dy + R * 0.32) ** 2) / 40));
                ctx.fillStyle = Lab.pick(BAKELITE, t, p.x, p.y);
                ctx.fillRect(p.x, p.y, 1, 1);
            }
            const ix = Math.cos(th), iy = Math.sin(th), at = (r, o = 0) => [KNOB.x + ix * r + o, KNOB.y + iy * r + o];
            Lab.line(ctx, ...at(5), ...at(R - 14), ink(0.06));                     // the index: a groove, then a stroke of lamp paint
            Lab.line(ctx, ...at(R - 14, 1), ...at(R - 8, 1), ink(0.03));
            Lab.line(ctx, ...at(R - 14), ...at(R - 8), C.warm);
            Lab.dot(ctx, ...at(R - 8), C.warmBright);
        }
        function draw(now) {
            const n = audible();
            ctx.drawImage(cabinet, 0, 0); drawWaterfall(); ctx.drawImage(veil, 0, 0);
            drawScreenNeedle(); drawDial(now); drawMeter(); drawReadout(n, now); drawScope(n, now); drawSpeaker(n, now); drawKnob();
        }

        // ── sound (only when the page's toggle is on): static that thins as you tune in, a carrier, a clock tick ──
        function soundBuild(ac) {                                              // only three things: static, a carrier, a tick
            const out = ac.createGain(), src = ac.createBufferSource(), osc = ac.createOscillator(), hiss = ac.createGain(), tone = ac.createGain();
            const hp = ac.createBiquadFilter(), lp = ac.createBiquadFilter();
            src.buffer = Lab.audio.noiseBuffer(); src.loop = true; osc.type = 'sine'; osc.frequency.value = 400; hiss.gain.value = 0; tone.gain.value = 0;
            hp.type = 'highpass'; hp.frequency.value = 180; lp.type = 'lowpass'; lp.frequency.value = 1600; lp.Q.value = 0.3;
            out.connect(Lab.audio.master);
            src.connect(hp).connect(lp).connect(hiss).connect(out);
            osc.connect(tone).connect(out);
            src.start(); osc.start();
            return { master: Lab.audio.master, out, nodes: [src, osc], hiss, osc, tone, ticked: false };
        }
        function soundStop() {
            if (!snd) return;
            snd.nodes.forEach(node => { try { node.stop(); } catch (e) { /* already stopped */ } });
            try { snd.out.disconnect(); } catch (e) { /* already gone */ }
            snd = null;
        }
        function tick(ac, level) {
            const t = ac.currentTime, src = ac.createBufferSource(), bp = ac.createBiquadFilter(), g = ac.createGain();
            src.buffer = Lab.audio.noiseBuffer(); bp.type = 'bandpass'; bp.frequency.value = 2200; bp.Q.value = 2;
            g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(level, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
            src.connect(bp).connect(g).connect(snd.out);
            src.start(t, Math.random()); src.stop(t + 0.08);
        }
        function soundUpdate(n, now) {
            const ac = soundBroken ? null : Lab.audio.get();
            if (!ac) { soundStop(); return; }
            if (!snd || snd.master !== Lab.audio.master) { soundStop(); snd = soundBuild(ac); }
            const t = ac.currentTime, set = (param, v, k = 0.06) => param.setTargetAtTime(v, t, k);
            const st = n.i >= 0 ? STATIONS[n.i] : null, fade = endFade(), c = st ? n.c : 0;
            set(snd.hiss.gain, 0.05 * (1 - 0.85 * c) * (1 - 0.85 * fade));         // the static thins as you tune in
            const carrier = st && st.mod !== 'tick' && c > FAINT_C ? c * c * (st.mod === 'loop' && !loopOn(now) ? 0.2 : 1) : 0;
            set(snd.osc.frequency, (st && st.ours ? 294 : 196) + 360 * (1 - c));   // a soft whistle that settles; ours a fifth higher
            set(snd.tone.gain, 0.03 * carrier * (transmitting() ? 0.55 + 0.45 * burst(now) : 1));   // a voice swells the carrier
            const tickNow = !!(st && st.mod === 'tick' && c > FAINT_C && tickOn(now) && s.mode !== 'end');
            if (tickNow && !snd.ticked) tick(ac, 0.06 * c);
            snd.ticked = tickNow;
        }

        // ── input: keys, the on-screen hold buttons (in start), the band itself, and the knob ──
        Lab.onKey((key, e) => {
            if (e && e.repeat) return;
            if (s.mode === 'end') { if (s.closed && (key === ' ' || key === 'Enter')) start(); return; }
            if (key === 'ArrowLeft' || key === 'a') tune(-1 / (BW - 1));
            if (key === 'ArrowRight' || key === 'd') tune(1 / (BW - 1));
        });
        const canvas = ui.canvas, toF = x => (x - BX) / (BW - 1), knobAngleAt = p => Math.atan2(p.y - KNOB.y, p.x - KNOB.x);
        canvas.onpointerdown = e => {
            if (s.mode === 'end') return;
            const p = ui.toPixel(e);
            if (p.y < 174 && p.x >= BX - 4 && p.x <= BX + BW + 4) { grab = 'band'; moveTo(toF(p.x)); }
            else if (Math.hypot(p.x - KNOB.x, p.y - KNOB.y) <= KNOB.r + 8) { grab = 'knob'; s.knobA = knobAngleAt(p); }
            else return;
            s.drag = true;
            try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* capture is optional */ }
        };
        canvas.onpointermove = e => {
            if (!s.drag || s.mode === 'end') return;
            const p = ui.toPixel(e);
            if (grab === 'band') { moveTo(toF(p.x)); return; }
            const a = knobAngleAt(p), da = cyc(a - s.knobA + Math.PI, TAU) - Math.PI;   // turn the knob: clockwise tunes up
            s.knobA = a;
            tune(da / (KNOB_TURNS * TAU));
        };
        canvas.onpointerup = canvas.onpointercancel = () => { s.drag = false; grab = null; };

        start();
        Lab.loop((dt, now) => {
            update(dt, now);
            if (++frame % 2 === 0) pushRow(now);
            draw(now);
            try { soundUpdate(audible(), now); } catch (err) { console.error('Dead channels: sound failed, going quiet.', err); soundBroken = true; soundStop(); }
        }, 30);
        return () => { soundStop(); canvas.onpointercancel = null; s.drag = false; };
    }

    Lab.register({
        id: 'radio', badge: 'parked', name: 'Dead channels', short: 'Tune through the dead channels',
        verb: 'Sweep the dial through static, listening for the eight ships ahead. Stop on a voice and hear it out.',
        serves: 'The light reads whatever reaches it. Every voice on this band comes from ahead, even Earth, even our own ship.',
        replaces: 'The long-range scan.',
        controls: '←/→ or A/D tune (tap or hold) · click the band or turn the knob · stop near a voice and it pulls in · Space: run again',
        mount,
    });
})();
