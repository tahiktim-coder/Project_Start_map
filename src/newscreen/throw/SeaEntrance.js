/* ═══ Silent Exodus · new screen (?new=1) · throw/SeaEntrance.js: the way into the sea of ships: three tries ═══════════
   What it is: the eleven seconds between the stall (throw/Stall.js: the ship dark, the crew in red, turned to us) and
   the sea of ships (throw/SeaArt.js), played by throw/SeaFilm.js on the film's own canvas. The crew try to finish the
   jump. Three times the drive coughs: the stars pull out toward the light, the flame throws a cold blue light, and in it
   there are shapes round us. Each try is stronger and shows more. After the third the drive is dead, and what its light
   showed stays: we are among wrecks. (At the end of the film the drive catches at last.) The wrecks are there from the
   first frame, as black shapes with no stars behind them: nothing ever appears out of nowhere.
   How it joins the film with no cut: the film's first whole frame (TL.in) is taken apart here into its sky, the wrecks
   and scrap round us, our own dark hull and our red lamp. The entrance draws those same pieces its own way and ends with
   all of them in place, which is that frame; the film then simply runs on from it. SeaArt.js itself is not touched, so
   its camera is copied below; if the two ever drift apart the join check fails and the film plays from its own first
   frame, as it did before this file.
   Reduced motion: no tries, no streaks; the graveyard comes out of the dark once, slowly, the lamp steady.
   Source: prototypes/sea-entrance/ (the designer picked "three tries" of three sketched entrances, 2026-11-13).
   Loaded only when the new-screen switch is on, after throw/SeaArt.js and before throw/SeaFilm.js.

   window.NSSeaEntrance (frozen)
     T0                       the film frame the entrance ends on (SeaArt.TL.in, ms)
     create(art) → entrance   for one film's pictures (SeaArt.create()); its work is added to art.jobs, after the film's own
       .settled() → bool      its pictures are worked out, or it has given up
       .ok() → bool           it can play (its last frame is the film's first whole frame)
       .dur(still) → ms       how long it plays
       .lines(still) → [[from, to (ms), speaker ('' is the narration), words]]
       .draw(ctx, e, still)   the frame e ms in, on the film's 640 x 360 canvas
       .gap() → { play, still } | null   pixels by which its last frame misses the film's first (for the headless runs)
*/
(function () {
    'use strict';
    const P = window.NSPaint, SA = window.NSSeaArt;
    if (!window.NEW_SCREEN || !P || !SA) return;
    const { INK, RP, clamp01, smooth, hexRgb, threshold, LANDER, DECK_U } = P;
    const AW = SA.AW, AH = SA.AH, TICK = 125, T0 = SA.TL.in;

    // ── SeaArt.js's own camera at its first look, copied (it exports none of it): where our ship, its lamp and the light are ──
    const F = 560, VP = [560, 72], OUR = [296, 212], D0 = 3.7, LEN_K = 0.92;
    const HEAD_ANG = Math.atan2(VP[1] - OUR[1], VP[0] - OUR[0]);
    const quantLen = l => (l < 36 ? Math.round(l) : Math.round(Math.exp(Math.round(Math.log(l) * 30) / 30)));
    const quantDeg = a => Math.round(a * 60 / Math.PI) * 3;
    const LAMP_PERIOD = 2200, LAMP_ON = 900;                                   // our red lamp's blink (SeaArt.js lampAt)

    // ── the three tries: when each comes (ms), how fast it comes up, how long it holds, how long it dies; how strong it is,
    //    how far its light reaches (art px), how far the stars pull out; the last one leaves the graveyard in view ──
    const TRY = [
        { at: 2000, up: 150, hold: 70, down: 600, peak: 0.5, reach: 60, streak: 0.26, stays: false },
        { at: 4700, up: 220, hold: 320, down: 850, peak: 0.8, reach: 125, streak: 0.42, stays: false },
        { at: 7500, up: 380, hold: 1000, down: 1900, peak: 1, reach: 400, streak: 0.6, stays: true },
    ];
    const DUR = 11200, DUR_STILL = 3600, IN = [250, 1500], STILL_SHOW = [700, 3000];
    const SHADES = [0.3, 0.38, 0.47, 0.58];                                    // our hull's light: dark (the film's), then three steps up in the flame's light
    const BLUE_FROM = 0.62, BLUE_DITHER = 0.36, PORTS_FROM = 0.9, MAX_GAP = 12, LAMP_CLEAR = 4.6, LAMP_REACH = 17;
    // DRAFT: the designer writes the lines. [from, to (ms), speaker, words]; a dead speaker's line is "Nobody answers." (SeaFilm.js)
    const LINES = [[600, 3300, 'Jaxon', 'Trying the drive again.'], [6200, 8300, 'Jaxon', 'Once more.']];

    const pack = rgb => (0xff000000 | (rgb[2] << 16) | (rgb[1] << 8) | rgb[0]) >>> 0;
    const INK32 = pack(hexRgb(INK));
    const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingEnabled = false; return { c, g }; };

    /** What the drive is doing e ms in: p its strength now (0..1), reach, streak, and keep: how much of the graveyard stays in view. */
    function driveAt(e) {
        let p = 0, reach = 1, streak = 0, keep = 0;
        for (const t of TRY) {
            const d = e - t.at;
            if (d < 0) break;
            const fall = clamp01((d - t.up - t.hold) / t.down);
            if (t.stays) keep = smooth(0, 1, fall);
            if (d >= t.up + t.hold + t.down) continue;
            const v = d < t.up ? smooth(0, 1, d / t.up) : t.stays ? 1 - smooth(0, 1, fall) : (1 - fall) ** 2;
            p = t.peak * v; reach = t.reach; streak = t.streak * v;
        }
        return { p, reach, streak, keep };
    }

    function create(art) {
        const X = { isDone: false, isOk: false, gap: null };
        let B = null, pOff = null, pOn = null, bD = null, shades = null, our = null, ot = null, lay = null, img = null, u32 = null, streakLayer = null;
        const inkPat = new Map();

        // ── the work, in three jobs after the film's own (SeaFilm.js runs them while the ship stands still) ──
        function frames() {
            B = art.A.BG;
            const frameAt = still => { const o = mk(AW, AH); art.draw(o.g, T0, still, false); return o.g.getImageData(0, 0, AW, AH).data; };
            pOff = frameAt(false); pOn = frameAt(true);                           // the film's first whole frame, our lamp off, and steady (no beacon ticking)
            const base = mk(AW, AH);
            base.g.drawImage(B.canvas, 0, 0);
            P.twinkle(P.framer(base.g, AW, AH), B.stars, Math.floor(T0 / TICK) * TICK);
            bD = base.g.getImageData(0, 0, AW, AH).data;
        }
        function hulls() {                                                       // our own hull as SeaArt.js bakes it (ourSprite), at each light
            const len = quantLen(F / D0 * LEN_K), ang = quantDeg(HEAD_ANG) * Math.PI / 180, ht = len / 3.15, half = Math.ceil(len / 2 + ht + 3);
            let at = null;
            shades = SHADES.map(light => {
                const p = P.painter(half * 2, half * 2, false);
                at = P.hull(p, { x: half, y: half, len, ht, angle: ang, flip: true, seed: 9, anchor: 0.5, sun: 0.36, sunDir: [Math.cos(ang), Math.sin(ang)], fade: 0.22, light, flat: len < 130 }, P.shapeL);
                return { canvas: p.canvas(), data: p.data };
            });
            const on = (u, v) => { const q = at(u, v); return [OUR[0] + q[0] - half, OUR[1] + q[1] - half]; };
            const lamp = on(LANDER.NOSE + 0.06, -0.52), bell = on(1, 0);
            our = { len, ang, half, size: half * 2, x0: OUR[0] - half, y0: OUR[1] - half, lampX: lamp[0], lampY: lamp[1], bellX: bell[0], bellY: bell[1],
                ports: [0, 1, 2, 3, 4, 5].map(i => on(DECK_U(i) + 0.054, -0.32)) };
        }
        function pieces() {                                                      // everything else in that frame: the wrecks and the scrap between them
            const dark = shades[0].data, xs = [], ys = [], cs = [];
            for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) {
                const ox = x - our.x0, oy = y - our.y0;
                if (ox >= 0 && oy >= 0 && ox < our.size && oy < our.size && dark[(oy * our.size + ox) * 4 + 3] > 0) continue;   // our hull
                const dl = Math.hypot(x - our.lampX, y - our.lampY);
                if (dl <= LAMP_CLEAR) continue;                                    // our lamp's own small glow
                const src = dl <= LAMP_REACH ? pOff : pOn, o = (y * AW + x) * 4;
                if (src[o] === bD[o] && src[o + 1] === bD[o + 1] && src[o + 2] === bD[o + 2]) continue;   // sky
                xs.push(x); ys.push(y); cs.push([src[o], src[o + 1], src[o + 2]]);
            }
            const n = xs.length, lum = c => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2], top = cs.reduce((m, c) => Math.max(m, lum(c)), 1);
            ot = { n, idx: new Uint32Array(n), thr: new Float32Array(n), col: new Uint32Array(n), blue: new Uint32Array(n), dBell: new Float32Array(n) };
            for (let j = 0; j < n; j++) {
                const x = xs[j], y = ys[j];
                ot.idx[j] = y * AW + x; ot.thr[j] = threshold(x, y); ot.col[j] = pack(cs[j]);
                ot.blue[j] = pack(RP.PLUME.rgb[P.level(RP.PLUME, 0.04 + 0.6 * Math.pow(lum(cs[j]) / top, 0.8), x, y)]);   // the same pixel in the drive's blue light (dark stays dark)
                ot.dBell[j] = Math.hypot(x - our.bellX, y - our.bellY);
            }
            lay = mk(AW, AH); img = lay.g.createImageData(AW, AH); u32 = new Uint32Array(img.data.buffer);
            streakLayer = P.pixelLayer(AW, AH);
        }
        /** Pixels by which a frame misses one of the film's (the stars' twinkle left out). */
        function missBy(e, still, want) {
            const o = mk(AW, AH); draw(o.g, e, still);
            const d = o.g.getImageData(0, 0, AW, AH).data, tw = new Uint8Array(AW * AH);
            B.stars.forEach(st => { for (let y = st.y - 1; y <= st.y + 1; y++) for (let x = st.x - 1; x <= st.x + 1; x++) if (x >= 0 && y >= 0 && x < AW && y < AH) tw[y * AW + x] = 1; });
            let bad = 0;
            for (let i = 0; i < d.length; i += 4) if (!tw[i >> 2] && (d[i] !== want[i] || d[i + 1] !== want[i + 1] || d[i + 2] !== want[i + 2])) bad++;
            return bad;
        }
        function check() {
            X.gap = { play: missBy(DUR, false, pOff), still: missBy(DUR_STILL, true, pOn) };
            X.isOk = X.gap.play <= MAX_GAP && X.gap.still <= MAX_GAP;
            if (!X.isOk) console.error('NSSeaEntrance: its last frame is not the film\'s first (SeaArt.js\'s camera has moved?); the film plays without it', X.gap);
            pOff = pOn = bD = null;
            X.isDone = true;
        }
        const job = fn => () => { if (X.isDone) return; try { fn(); } catch (err) { console.error('NSSeaEntrance: its pictures failed; the film plays without it', err); X.isOk = false; X.isDone = true; } };
        art.jobs.push(job(frames), job(hulls), job(pieces), job(check));

        // ── the pieces, drawn ──
        function dimInk(ctx, a) {                                                 // ink over the whole picture, in the house dither (SeaArt.js dim)
            const k = Math.round(clamp01(a) * 8); if (!k) return;
            if (k >= 8) { ctx.fillStyle = INK; ctx.fillRect(0, 0, AW, AH); return; }
            if (!inkPat.has(k)) { const c = mk(8, 8); c.g.fillStyle = INK; for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (threshold(x, y) < k / 8) c.g.fillRect(x, y, 1, 1); inkPat.set(k, ctx.createPattern(c.c, 'repeat')); }
            ctx.fillStyle = inkPat.get(k); ctx.fillRect(0, 0, AW, AH);
        }
        function streaks(ctx, k) {                                                // every bright star pulled out toward the light (SeaArt.js drawStreaks)
            if (k <= 0.01) return;
            streakLayer.clear();
            B.all.forEach(st => {
                const dx = VP[0] - st.x, dy = VP[1] - st.y, d = Math.hypot(dx, dy) || 1, m = Math.min(d - 4, k * k * (40 + d * 0.5) * (0.5 + st.mag));
                for (let i = 0; i < m; i++) streakLayer.tone(st.x + dx / d * i * 0.6, st.y + dy / d * i * 0.6, RP.STAR, (0.4 + 0.55 * st.mag) * (1 - i / m));
            });
            streakLayer.draw(ctx);
        }
        function plume(f, burn, e) {                                              // the drive's flame behind our bell (SeaArt.js drawOurs), with a soft bloom at the bell
            if (burn <= 0.02) return;
            const ca = Math.cos(our.ang), sa = Math.sin(our.ang), s = our.len / 48, lvl = burn * 1.4;
            const fl = [1, 0.86, 1.1, 0.93][Math.floor(e / 250) % 4], pl = (6 + 20 * lvl) * s * fl, w0 = Math.max(1, 1.8 * s);
            f.glow(our.bellX - ca * 6, our.bellY - sa * 6, Math.round(8 + 20 * burn), RP.PLUME, Math.min(0.85, 0.5 * burn));
            for (let d = 0; d < pl; d++) {
                const hw = w0 * (1 - (d / pl) * 0.6);
                for (let k = -Math.ceil(hw); k <= Math.ceil(hw); k++) { const u = Math.abs(k) / (hw + 0.01), v = (1 - d / pl) ** 0.8 * (1 - u * u); if (v > 0.06) f.tone(our.bellX - ca * d - sa * k, our.bellY - sa * d + ca * k, RP.PLUME, v); }
            }
        }
        function lamp(f, isOn) {                                                  // our red lamp (SeaArt.js lampAt at this size)
            if (isOn) { f.glow(our.lampX, our.lampY, Math.max(4, Math.round(3 + our.len / 12)), RP.RED, 0.9); f.px(our.lampX, our.lampY, RP.RED.hex[4]); }
            else { f.glow(our.lampX, our.lampY, 3, RP.RED, 0.55); f.px(our.lampX, our.lampY, RP.RED.hex[3]); }
        }
        /** The frame e ms in. still (reduced motion): the graveyard comes out of the dark once, slowly; no tries, no streaks. */
        function draw(ctx, e, still) {
            const s = still ? { p: 0, reach: 1, streak: 0, keep: smooth(STILL_SHOW[0], STILL_SHOW[1], e) } : driveAt(e), k = 1 / s.reach, f = P.framer(ctx, AW, AH);
            ctx.drawImage(B.canvas, 0, 0);
            if (s.streak < 0.15) P.twinkle(f, B.stars, Math.floor(e / TICK) * TICK);
            f.reset();
            streaks(ctx, s.streak);
            for (let j = 0; j < ot.n; j++) {                                      // a wreck's pixel: in the flame's light, kept by our eyes, or a black shape
                const lit = s.p > 0 ? s.p * Math.exp(-ot.dBell[j] * k) : 0, th = ot.thr[j];
                u32[ot.idx[j]] = s.keep + lit > th ? (lit > BLUE_FROM + BLUE_DITHER * th ? ot.blue[j] : ot.col[j]) : INK32;
            }
            lay.g.putImageData(img, 0, 0); ctx.drawImage(lay.c, 0, 0);
            f.reset();
            plume(f, s.p * 1.5, e);
            ctx.drawImage(shades[Math.round(clamp01(s.p) * (shades.length - 1))].canvas, our.x0, our.y0);
            f.reset();
            if (s.p > PORTS_FROM) our.ports.forEach(([x, y], i) => { if (P.hash(i, 1, 2) > 0.2) f.px(x, y, RP.AMBER.hex[i === 0 ? 4 : 3]); });   // for a moment she is almost alive again
            dimInk(ctx, 1 - smooth(IN[0], IN[1], e));
            f.reset();
            lamp(f, still || ((((e - DUR + T0) % LAMP_PERIOD) + LAMP_PERIOD) % LAMP_PERIOD) < LAMP_ON);   // timed to go off as the film takes over, as the film has it
        }
        return {
            settled: () => X.isDone, ok: () => X.isDone && X.isOk, gap: () => X.gap,
            dur: still => (still ? DUR_STILL : DUR),
            lines: still => (still ? [] : LINES),
            draw,
        };
    }

    window.NSSeaEntrance = Object.freeze({ T0, create });
})();
