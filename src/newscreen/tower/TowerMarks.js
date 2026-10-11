/* ═══ Silent Exodus · new screen (?new=1) · tower/TowerMarks.js: what the real state paints over the tower ═══════════
   What it is: the marks laid over TowerArt's picture each frame: a red deck (the red wash and the caged warning lamp,
   frost round a hole and a lamp gone out; sparks in engineering), the brown-out while engineering is down, the conduit
   (2 px of light from the reactor up the inner hull wall into the bridge console, the reactor's beat running up it), the
   light falling on our hull, and the left-edge fade (never over a person).
   Source: prototypes/slice/ship.js (drawDamage, brownOut, drawConduit, hullLight, vignette), minus the slice's price
   charge, fire, flicker, signs, chips, plates and pages (checkpoint B and later). A deck is 'ok' or 'red' (no patched,
   worse or fixing in the real game yet). Load after TowerArt.js, before Tower.js. No state of its own but caches.

   window.NSTowerMarks (frozen)
     draw(ctx, v)            v = { t, G: { W, H } (the canvas drawn into), offX, cam, decks: { bridge … engineering: 'ok' |
                             'red' }, engDown, E (0..100, eased), beat: { val, onsets: [ms] }, flood: { kind: 'jump' | 'fill',
                             t0 } | null, sunY (canvas row), fix: { x, y } tower px | null (a star fix waiting on Mira's bench) }
                             red decks, brown-out, conduit, hull light, the fix, in that order
     vignette(ctx, v, drawn) the left-edge fade (unused since the whole tower fits, BUILD_B §8; kept for a cut hull)
     floodDone(v) → bool     true once v.flood has run its 1.8 s
     BEAT                    { FULL: 1100, LOW: 1500, RISE } ms per beat at 100 and at 10 energy; pulse rows per ms
     DECKS                   ['bridge', 'lab', 'quarters', 'medbay', 'hold', 'engineering'] (deck index order)
*/
(function () {
    'use strict';
    const A = window.ShipArt, P = window.NSPaint;
    if (!A || !P) { console.error('TowerMarks: ShipArt and NSPaint must load first'); return; }
    const L = A.L, R = A.R, F = L.DECK_FLOOR, INK = A.INK;
    const { bay, hash, fbm, level, painter } = A.api;
    const DECKS = Object.freeze(['bridge', 'lab', 'quarters', 'medbay', 'hold', 'engineering']);
    const HULL_OUT = L.CX + L.HO + 9;
    const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

    // ── where things are, in the tower's own art px (deck-local rows: 0 = the deck's top, F = 190 the floor) ──
    const CONDUIT = Object.freeze({ X: L.IR - 6, JY: A.floorY(0) - 40, JX: 601, EX: 580 });
    const ENG_Y = A.deckTop(5) + 162;                                   // where the reactor's own conduit reaches the wall
    const LAMPS = { 0: [[540, 26, 52], [250, 26, 52]], 1: [[470, 26, 52], [270, 26, 52]], 2: [[590, 26, 52], [405, 82, 62]],
        3: [[590, 26, 52], [360, 26, 52]], 4: [[480, 26, 52], [250, 26, 52]], 5: [[610, 26, 52], [200, 26, 52]] };   // [x, y, reach]: the first goes out on red
    // the hole in the back wall, above head height (the slice's galley hole at 515, 100 sat on a confined Jaxon's head)
    const HOLE = { 0: [614, 112], 1: [586, 56], 2: [492, 48], 3: [560, 60], 4: [560, 60], 5: [580, 44] };
    const RED_LAMP = i => [626, i === 0 ? 100 : 30];                    // the bridge's top is above the frame
    const BEAT = Object.freeze({ FULL: 1100, LOW: 1500, RISE: 0.9 });
    const FLOOD_MS = 1800, BROWN_CYCLE = 2900, BLINK_MS = 1100, RED_WASH = '#d4402c';

    // ── still pieces, painted once (house recipe: ramps from the ink, Bayer dither) ──
    const cache = new Map();
    function once(key, make) { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); }

    /** A lamp gone out: the cage dark and its pool of light taken back, in dithered steps (drawn source-atop). */
    function darkCanvas(deck, lamps) {
        return once('dark' + deck + '|' + lamps.length, () => {
            const p = painter(L.W, L.PITCH, A.deckTop(deck)), d = p.data;
            for (let y = 0; y < F + 2; y++) for (let x = L.IL; x < L.IR; x++) {
                let w = 0;
                lamps.forEach(([lx, ly, reach]) => { const dy = y - ly, dd = Math.hypot((x - lx) / 1.25, dy < 0 ? dy * 2.2 : dy * 0.82); w = Math.max(w, Math.exp(-dd / (reach * 1.6))); });
                const q = Math.floor(Math.min(1, w * 1.25) * 4 + bay(x, y + p.oy)) / 4;
                if (q <= 0) continue;
                const o = (y * L.W + x) * 4; d[o] = 5; d[o + 1] = 7; d[o + 2] = 10; d[o + 3] = Math.round(255 * 0.72 * q);
            }
            lamps.forEach(([lx, ly]) => {
                for (let x = lx - 4; x <= lx + 4; x++) p.tone(x, ly - 1, R.STEEL, 0.2);
                for (let x = lx - 3; x <= lx + 3; x++) p.tone(x, ly, R.STEEL, x === lx + 1 ? 0.4 : 0.14);
                for (let x = lx - 2; x <= lx + 2; x++) p.tone(x, ly + 1, R.STEEL, 0.1);
            });
            return p.canvas();
        });
    }
    /** Frost round a hole in the back wall: a red deck has lost its air. */
    function frostCanvas(deck) {
        return once('frost' + deck, () => {
            const S2 = 48, p = painter(S2 * 2, S2 * 2, A.deckTop(deck) + HOLE[deck][1] - S2), c = S2, rr = 17;
            p.region(0, 0, S2 * 2, S2 * 2, (x, y) => {
                const d = Math.hypot(x - c, (y - c) * 1.15), edge = rr * (0.45 + 1.0 * fbm(x / 5, y / 5, 90 + deck));
                if (d < edge && hash(x, y, 89) > 0.25 * d / edge) p.tone(x, y, R.ICE, 0.12 + 0.36 * (1 - d / edge) + (hash(x, y, 91) > 0.93 ? 0.25 : 0));
            });
            for (let k = 0; k < 6; k++) { const a = k * 1.05 + 0.4, n = rr * (0.5 + 0.5 * hash(k, deck, 92)); p.line(c, c, c + Math.cos(a) * n, c + Math.sin(a) * n, (x, y, s) => p.tone(x, y, R.ICE, 0.7 - s * 0.4)); }
            p.region(c - 2, c - 2, c + 3, c + 3, (x, y) => { if (!((x === c - 2 || x === c + 2) && (y === c - 2 || y === c + 2))) p.hex(x, y, INK); });
            return p.canvas();
        });
    }
    /** The ship runs on past the left edge into the dark: a dithered fade (layout A's vignette). */
    function fade(H) {
        return once('vig' + H, () => {
            const w = 64, c = document.createElement('canvas'); c.width = w; c.height = H;
            const g = c.getContext('2d'); g.fillStyle = INK;
            for (let y = 0; y < H; y++) for (let x = 0; x < w; x++) if (bay(x, y) < Math.pow(1 - x / w, 1.7) * 0.92) g.fillRect(x, y, 1, 1);
            return c;
        });
    }

    // ── drawing helpers (canvas px; tone dithers in tower space so the pattern stays put while the camera moves) ──
    let ctx = null, cur = '', V = null, strip = null, stripCache = null;
    const px = (x, y, hex, w = 1, h = 1) => { if (hex !== cur) { ctx.fillStyle = hex; cur = hex; } ctx.fillRect(x, y, w, h); };
    /** The conduit and the hull light touch thousands of single pixels a frame: inside the strip (a narrow band down the
        right wall) they go into one pixel buffer, drawn once (fillRect per pixel cost about 6 ms a frame at full height). */
    function stripPx(x, y, rgb) {
        const S = strip, xi = x - S.x0;
        if (xi < 0 || xi >= S.w || y < 0 || y >= S.h) return false;
        const o = (y * S.w + xi) * 4, d = S.d; d[o] = rgb[0]; d[o + 1] = rgb[1]; d[o + 2] = rgb[2]; d[o + 3] = 255;
        return true;
    }
    const tone = (x, y, r, v) => { if (v <= 0) return; const k = level(r, v, x - V.offX, y + V.cam); if (k > 0 && !(strip && stripPx(x, y, r.rgb[k]))) px(x, y, r.hex[k]); };
    function stripOf(W, H, x0, x1) {
        const w = Math.max(1, x1 - x0);
        if (!stripCache || stripCache.w !== w || stripCache.h !== H) {
            const c = document.createElement('canvas'); c.width = w; c.height = H;
            const g = c.getContext('2d'), img = g.createImageData(w, H);
            stripCache = { c, g, img, d: img.data, d32: new Uint32Array(img.data.buffer), w, h: H, x0 };
        }
        stripCache.x0 = x0; stripCache.d32.fill(0);
        strip = stripCache;
        return strip;
    }
    const sx = wx => wx + V.offX, sy = wy => wy - V.cam;
    const deckVisible = i => { const top = A.deckTop(i) - V.cam; return top + L.PITCH > 0 && top < V.G.H; };
    const engRed = () => V.decks.engineering === 'red';

    function sparks(X, Y, tick) {
        if ((tick % 11) > 2) return;                                       // short bursts
        for (let k = 0; k < 6; k++) {
            if (hash(tick & 255, k, 95) < 0.35) continue;
            const a = hash(tick & 255, k, 96) * Math.PI * 2, n = 2 + Math.round(hash(tick & 255, k, 97) * 5);
            for (let s = 0; s < n; s++) tone(X + Math.round(Math.cos(a) * s), Y + Math.round(Math.sin(a) * s + s * s * 0.15), R.ICE, 0.95 - s * 0.12);
        }
        px(X, Y, '#fff3dc');
    }
    /** The emergency light washes the room red (multiply), but only where the room is painted: the windows and portholes
        stay clear (a plain multiply filled the bridge's see-through panes solid red). */
    let washCv = null;
    function redWash(x, y0, w, y1, alpha) {
        const h = y1 - y0;
        if (w <= 0 || h <= 0) return;
        if (!washCv) washCv = document.createElement('canvas');
        if (washCv.width < w || washCv.height < h) { washCv.width = Math.max(washCv.width, w); washCv.height = Math.max(washCv.height, h); }
        const g = washCv.getContext('2d');
        g.globalCompositeOperation = 'copy'; g.globalAlpha = 1; g.drawImage(ctx.canvas, x, y0, w, h, 0, 0, w, h);
        g.globalCompositeOperation = 'multiply'; g.globalAlpha = alpha; g.fillStyle = RED_WASH; g.fillRect(0, 0, w, h);
        g.globalCompositeOperation = 'destination-in'; g.globalAlpha = 1; g.drawImage(ctx.canvas, x, y0, w, h, 0, 0, w, h);
        ctx.save(); ctx.globalCompositeOperation = 'source-atop'; ctx.drawImage(washCv, 0, 0, w, h, x, y0, w, h); ctx.restore(); cur = '';
    }
    /** A red deck: a lamp out and frost round the hole (sparks in engineering), the red wash beating with a caged lamp. */
    function drawDamage(t) {
        const tick = Math.floor(t / 125);
        DECKS.forEach((name, i) => {
            if (V.decks[name] !== 'red' || !deckVisible(i)) return;
            const top = A.deckTop(i), surge = i === 5;
            ctx.save(); ctx.globalCompositeOperation = 'source-atop';
            ctx.drawImage(darkCanvas(i, LAMPS[i].slice(0, 1)), sx(0), sy(top));
            if (!surge) ctx.drawImage(frostCanvas(i), sx(HOLE[i][0] - 48), sy(top + HOLE[i][1] - 48));
            ctx.restore(); cur = '';
            if (surge) sparks(sx(HOLE[i][0]), sy(top + HOLE[i][1]), tick);
            const on = (t % BLINK_MS) < BLINK_MS * 0.5, [lx, ly] = RED_LAMP(i), X = sx(lx), Y = sy(top + ly), ramp = R.RED;
            redWash(sx(L.IL), Math.max(0, sy(top)), L.IR - L.IL, Math.min(V.G.H, sy(top + F + 1)), on ? 0.78 : 0.58);   // reads as red at the fitted size
            for (let dx = -3; dx <= 4; dx++) { tone(X + dx, Y - 3, R.STEEL, 0.62); tone(X + dx, Y + 3, R.STEEL, 0.3); }
            for (let dy = -2; dy <= 2; dy++) { tone(X - 3, Y + dy, R.STEEL, 0.5); tone(X + 4, Y + dy, R.STEEL, 0.36); }
            const n = ramp.hex.length;
            if (on) {
                for (let dy = -9; dy <= 10; dy++) for (let dx = -9; dx <= 10; dx++) { const d = Math.hypot(dx - 0.5, dy - 0.5); if (d > 3 && d < 10) tone(X + dx, Y + dy, ramp, 0.4 * (1 - d / 10)); }
                px(X - 2, Y - 2, ramp.hex[n - 3], 6, 5); px(X - 1, Y - 1, ramp.hex[n - 2], 4, 3); px(X, Y - 1, ramp.hex[n - 1], 2, 1);
            } else { px(X - 2, Y - 2, ramp.hex[1], 6, 5); px(X - 1, Y - 1, ramp.hex[2], 2, 1); }
        });
    }
    /** Engineering down: every seen deck runs on less, a step darker, browning out in short dips every 2.9 s. */
    function brownOut(t) {
        if (!V.engDown) return;
        const k = t % BROWN_CYCLE, n = Math.floor(t / BROWN_CYCLE), dip = hash(n & 255, 7, 99) < 0.75;
        let a = 0.16;
        if (dip && k < 90) a = 0.5; else if (dip && k > 170 && k < 240) a = 0.38; else if (dip && k > 330 && k < 370 && hash(n & 255, 8, 99) < 0.5) a = 0.3;
        ctx.save(); ctx.globalCompositeOperation = 'source-atop'; ctx.globalAlpha = a; ctx.fillStyle = INK;
        ctx.fillRect(sx(L.IL), 0, L.IR - L.IL, V.G.H); ctx.restore(); cur = '';
    }

    // ── the conduit: s = 0 at the bottom of the frame (or engineering), up the wall to the corner, then left ──
    const bottomW = () => Math.min(V.cam + V.G.H, ENG_Y);
    const vertLen = () => Math.max(0, bottomW() - CONDUIT.JY);
    const conduitLen = () => vertLen() + (CONDUIT.X - CONDUIT.JX);
    /** 2 px of light up the inner hull wall into the bridge console. Its base is the energy; the beat runs up it; on the
        jump it floods; when energy comes back it fills upward. Engineering red: the light stutters. */
    function drawConduit(t) {
        const G = V.G, X = sx(CONDUIT.X), JY = sy(CONDUIT.JY), JX = sx(CONDUIT.JX), Lc = conduitLen(), vl = vertLen();
        const E = clamp(V.E, 0, 100) / 100, red = engRed(), beatVal = V.beat.val;
        const base = 0.2 + 0.2 * E + 0.08 * beatVal * E;
        const pulses = V.beat.onsets.map(o => (t - o) * BEAT.RISE).filter(s => s >= 0 && s < Lc + 40);
        const fl = V.flood, flAge = fl ? t - fl.t0 : 0, live = fl && flAge >= 0 && flAge <= FLOOD_MS;
        const jump = live && fl.kind === 'jump', fill = live && fl.kind === 'fill';
        const vAt = s => {
            let v = base;
            pulses.forEach(p => { const d = p - s; if (d >= -1 && d < 30) v += (0.55 - Math.max(0, d) * 0.017) * (red ? 0.6 : 1); });
            if (jump) v += 0.4 * (1 - flAge / FLOOD_MS) + (((s + flAge * 1.4) % 40) < 6 ? 0.3 : 0);
            if (fill && s < flAge * 0.4) v += 0.6 * (1 - flAge / FLOOD_MS) + (flAge * 0.4 - s < 10 ? 0.4 : 0);
            if (red && hash(Math.floor(t / 90) & 255, Math.floor(s / 12) & 255, 98) < 0.08) v -= 0.2;
            return v;
        };
        const EY = sy(ENG_Y);                                             // the link from the reactor's pipe, when in view
        if (EY >= -3 && EY < G.H + 3) for (let x = sx(CONDUIT.EX); x <= X + 2; x++) {
            const v = vAt(0);
            tone(x, EY - 1, R.STEEL, 0.4); tone(x, EY + 2, R.STEEL, 0.14);
            if (x <= X + 1) { tone(x, EY, R.ICE, v); tone(x, EY + 1, R.ICE, v * 0.86); }
        }
        for (let y = Math.max(JY, 0); y < Math.min(G.H, EY); y++) {        // the vertical run
            const wy = y + V.cam, s = bottomW() - wy, local = ((wy - L.TOP0) % L.PITCH + L.PITCH) % L.PITCH, slab = local >= F && wy > L.TOP0;
            const v = vAt(s), halo = v - 0.5;
            if (halo > 0) { tone(X - 1, y, R.ICE, halo * 1.2); tone(X + 2, y, R.ICE, halo * 1.3); tone(X - 2, y, R.ICE, halo * 0.6); tone(X + 3, y, R.ICE, halo * 0.6); }
            else { tone(X - 1, y, R.STEEL, slab ? 0.42 : 0.14); tone(X + 2, y, R.STEEL, slab ? 0.5 : 0.3); }
            tone(X, y, R.ICE, v * 0.86); tone(X + 1, y, R.ICE, v);
            if (wy % 44 === 0 && halo <= 0) { px(X - 2, y, R.STEEL.hex[6]); px(X + 3, y, R.STEEL.hex[5]); }
        }
        if (JY > -4 && JY < G.H + 4) {                                     // the run along the bridge into the nav console
            for (let x = JX; x <= X + 2; x++) {
                const v = vAt(vl + (X - x));
                tone(x, JY - 1, R.STEEL, 0.36); tone(x, JY + 2, R.STEEL, 0.14);
                if (x <= X) { tone(x, JY, R.ICE, v); tone(x, JY + 1, R.ICE, v * 0.86); }
            }
            for (let y = -3; y < 5; y++) for (let x = -5; x < 0; x++) tone(JX + x, JY + y, R.STEEL, y === -3 ? 0.56 : x === -1 ? 0.44 : 0.26);
            const glow = 0.2 + 0.4 * beatVal * E + (jump ? 0.4 * (1 - flAge / FLOOD_MS) : 0);
            tone(JX - 3, JY, R.ICE, glow); tone(JX - 3, JY + 1, R.ICE, glow * 0.8); tone(JX - 2, JY, R.ICE, glow * 0.7);
        }
    }
    /** The light falls on our hull too, plate by plate down the outside edge, strongest level with the light. */
    function hullLight() {
        const G = V.G, ly = V.sunY == null ? G.H * 0.4 : V.sunY, SUN = P.RP.SUN;
        for (let y = 0; y < G.H; y++) {
            const wy = y + V.cam;
            if (wy < L.TIP + 2 || wy > L.TAIL0 + 70) continue;
            const hw = wy < L.TOP0 ? A.noseHalf(wy) : L.HO, plate = Math.floor(wy / 30), seam = ((wy % 30) + 30) % 30;
            if (seam === 0) continue;
            const v = (0.12 + 0.36 * Math.exp(-Math.abs(y - ly) / (G.H * 0.5))) * (0.45 + 0.75 * hash(plate & 255, 3, 11)) * (seam < 3 ? 1.25 : 1);
            const xo = Math.round(L.CX + hw) + 8 + V.offX;
            tone(xo, y, SUN, v); tone(xo - 1, y, SUN, v * 0.55); if (seam < 3) tone(xo - 2, y, SUN, v * 0.4);
        }
    }

    /** The star fix on Mira's bench: a small dark slate with a warm light blinking slowly on it (only while it waits). */
    function drawFix(t, at) {
        const X = sx(at.x), Y = sy(at.y), on = (t % 1600) < 700;
        for (let dx = -6; dx <= 6; dx++) { tone(X + dx, Y - 3, R.STEEL, 0.5); tone(X + dx, Y + 2, R.STEEL, 0.22); }
        for (let dy = -2; dy <= 1; dy++) for (let dx = -6; dx <= 6; dx++) tone(X + dx, Y + dy, R.STEEL, 0.14);
        const S = P.RP.AMBER, n = S.hex.length;
        if (on) { for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) { const d = Math.hypot(dx, dy); if (d > 1.5 && d < 6.5) tone(X + 3 + dx, Y - 1 + dy, S, 0.34 * (1 - d / 6.5)); } px(X + 2, Y - 1, S.hex[n - 2], 2, 1); px(X + 3, Y - 1, S.hex[n - 1]); }
        else px(X + 2, Y - 1, S.hex[2], 2, 1);
        for (let dx = -4; dx <= 0; dx += 2) px(X + dx, Y, R.STEEL.hex[5]);   // the drawing's faint lines
    }

    function draw(c, v) {
        ctx = c; V = v; cur = '';
        drawDamage(v.t);
        brownOut(v.t);
        const x0 = Math.max(0, sx(CONDUIT.JX - 8)), x1 = Math.min(v.G.W, sx(L.CX + L.HO + 12));
        stripOf(v.G.W, v.G.H, x0, x1);
        drawConduit(v.t);
        hullLight();
        strip.g.putImageData(strip.img, 0, 0);
        ctx.drawImage(strip.c, strip.x0, 0);
        strip = null;
        if (v.fix) drawFix(v.t, v.fix);
        ctx = null; V = null;
    }

    /** The left-edge fade, cut out where a person's own pixels are, so the crew stand in front of it. */
    let scratch = null;
    function vignette(c, v, drawn) {
        const G = v.G, f = fade(G.H), w = f.width;
        const near = (drawn || []).filter(d => Math.round(d.x) + v.offX - d.Sp.origin.x < w + 2);
        if (!near.length) { c.drawImage(f, 0, 0); return; }
        if (!scratch || scratch.height !== G.H) { scratch = document.createElement('canvas'); scratch.width = w; scratch.height = G.H; }
        const g = scratch.getContext('2d');
        g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, w, G.H); g.drawImage(f, 0, 0);
        g.globalCompositeOperation = 'destination-out';
        near.forEach(d => {
            const Sp = d.Sp, X = Math.round(d.x) + v.offX, Y = Math.round(d.y) - v.cam - Sp.origin.y;
            if (d.facing > 0) g.drawImage(Sp.canvas, X - Sp.origin.x, Y);
            else { g.save(); g.translate(X + 1, 0); g.scale(-1, 1); g.drawImage(Sp.canvas, -Sp.origin.x, Y); g.restore(); }
        });
        g.globalCompositeOperation = 'source-over';
        c.drawImage(scratch, 0, 0);
    }
    const floodDone = v => !v.flood || v.t - v.flood.t0 > FLOOD_MS;

    window.NSTowerMarks = Object.freeze({ draw, vignette, floodDone, BEAT, DECKS, CONDUIT, ENG_Y, HULL_OUT });
})();
