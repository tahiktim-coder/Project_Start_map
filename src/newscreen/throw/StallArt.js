/* ═══ Silent Exodus · new screen (?new=1) · throw/StallArt.js: the ship gone dark, deck by deck, one red lamp left on each ═══
   What it is: what the jump that stalls (throw/Stall.js) lays over the tower's picture. Tower.js calls draw() after
   TowerMarks, in the tower's own pixels. Per deck: the power out (the room dark, its lamp cages cold), and its one red
   emergency lamp, a small caged lamp in the ceiling whose light falls on what is in the room. That light is worked out from
   the room's own painted surfaces (ShipArt.deck), as ShipArt's lightPass lights a deck: in Bayer steps, stronger below the
   lamp, so the floor and the furniture catch it, the windows stay clear, and whoever stands in the room is a silhouette
   against it. lit() gives the gathered crew their own light: a person seen only by that red lamp.
   House style (docs/ART_STYLE.md): ramps from the ink, 8 x 8 Bayer steps. Loaded after the ship's art files.

   window.NSStallArt (frozen)
     draw(ctx, v)            v = { camY, offX, W, H, t, dark: [6] 0..1 (the power gone), red: [6] 0..1 (the red lamp's light),
                             still (reduced motion: no flicker) }; deck 0 is the bridge … 5 engineering
     lit(canvas, person) → canvas   a sprite as the red lamp shows it: dimmer the further the person (tower px, its deck)
                             stands from the lamp (cached per sprite canvas and step)
     warm() → [() => void]   jobs that work out each deck's red light ahead of time (one a frame)
     LAMP_X                  each deck's red lamp, tower px (over the middle of the room; the bridge's over where the crew stand)
*/
(function () {
    'use strict';
    const A = window.ShipArt;
    if (!A || !A.api) { console.error('NSStallArt: ShipArt must load first'); return; }
    const L = A.L, R = A.R, INK = A.INK, { bay, smooth, hexRgb } = A.api, F = L.DECK_FLOOR;
    const LAMP_X = Object.freeze([384, 372, 340, 452, 366, 464]);               // the bridge: over the crew; engineering: over the dead reactor
    const LAMP_Y = 24, REACH = 60, POWER = 1.25, UP = 0.3, DARK = 0.93;
    const TINT = [1.25, 0.24, 0.17], BLOOM = [70, 12, 8];
    // a person in the red lamp's light alone: their own shading, read as a red ramp from the ink
    const LIT = ['#05070a', '#160707', '#330d0b', '#5e1812', '#93281c', '#c8402c', '#ee6a50'].map(hexRgb);
    const LIT_FALL = 150;                                                         // tower px from the lamp to where a person is at their dimmest

    // ── each deck's red light: an RGB buffer of what the lamp adds to the room (painted pixels only), worked out once ──
    const lights = new Map();
    function lightOf(i) {
        if (lights.has(i)) return lights.get(i);
        const D = A.deck(i, {}), src = D.canvas.getContext('2d').getImageData(0, 0, L.W, L.PITCH).data;
        const c = document.createElement('canvas'); c.width = L.W; c.height = L.PITCH;
        const g = c.getContext('2d'), img = g.createImageData(L.W, L.PITCH), d = img.data, lx = LAMP_X[i], ly = LAMP_Y + 2, oy = A.deckTop(i);
        for (let y = 0; y < L.PITCH; y++) for (let x = L.IL; x < L.IR; x++) {
            const o = (y * L.W + x) * 4;
            if (!src[o + 3]) continue;                                            // a window or a porthole: space shows through, unlit
            const dx = (x - lx) / 1.25, dy = y - ly, dist = Math.hypot(dx, dy < 0 ? dy * 2.2 : dy * 0.82);
            const w = Math.exp(-dist / REACH) * POWER * (UP + (1 - UP) * smooth(-18, 0, dy));
            if (w < 0.03) continue;
            const q = Math.min(1, Math.floor(Math.min(1, w * 1.15) * 5 + bay(x, y + oy)) / 5);
            if (q <= 0) continue;
            const lum = 0.3 * src[o] + 0.59 * src[o + 1] + 0.11 * src[o + 2], bloom = q * q * q;
            d[o] = Math.min(255, lum * q * TINT[0] + bloom * BLOOM[0]);
            d[o + 1] = Math.min(255, lum * q * TINT[1] + bloom * BLOOM[1]);
            d[o + 2] = Math.min(255, lum * q * TINT[2] + bloom * BLOOM[2]);
            d[o + 3] = 255;
        }
        g.putImageData(img, 0, 0);
        lights.set(i, c);
        return c;
    }
    function warm() { return [0, 1, 2, 3, 4, 5].map(i => () => lightOf(i)); }

    // ── drawing (the tower's own pixels; sx/sy from tower rows to the canvas) ──
    let ctx = null, V = null, cur = '';
    const px = (x, y, hex, w = 1, h = 1) => { if (hex !== cur) { ctx.fillStyle = hex; cur = hex; } ctx.fillRect(x, y, w, h); };
    const sx = wx => wx + V.offX, sy = wy => Math.round(wy - V.camY);
    /** The lamps of a dead room: each cage dark, its glass a dull steel. */
    function cagesOut(i) {
        A.deck(i, {}).lamps.forEach(l => {
            const X = sx(l.x), Y = sy(l.y);
            for (let x = -4; x <= 4; x++) px(X + x, Y - 1, x === 4 || x === -4 ? R.STEEL.hex[2] : R.STEEL.hex[3]);
            for (let x = -3; x <= 3; x++) px(X + x, Y, x === 1 ? R.STEEL.hex[4] : R.STEEL.hex[2]);
            for (let x = -2; x <= 2; x++) px(X + x, Y + 1, R.STEEL.hex[1]);
        });
    }
    /** The red emergency lamp: a short cord, a cage, the red glass (bright when lit, a dead dark red when not), and round it
        a small halo in Bayer steps, so it reads as the one light in the room. */
    function redLamp(i, k) {
        const X = sx(LAMP_X[i]), Y = sy(A.deckTop(i) + LAMP_Y), on = k > 0.05, hot = k > 0.6;
        if (on) for (let dy = -7; dy <= 9; dy++) for (let dx = -10; dx <= 10; dx++) {
            const d = Math.hypot(dx / 1.3, dy < 0 ? dy * 1.6 : dy), v = k * 0.75 * (1 - d / 10);
            if (d > 2 && v > bay(X + dx, Y + dy)) px(X + dx, Y + dy, v > 0.5 ? R.RED.hex[2] : R.RED.hex[1]);
        }
        for (let y = sy(A.deckTop(i) + 20); y < Y - 2; y++) px(X, y, R.STEEL.hex[4]);
        for (let x = -4; x <= 4; x++) px(X + x, Y - 2, x === 4 ? R.STEEL.hex[5] : R.STEEL.hex[3]);
        for (let x = -4; x <= 4; x++) px(X + x, Y - 1, !on ? R.RED.hex[1] : Math.abs(x) === 4 ? R.RED.hex[2] : R.RED.hex[hot ? 4 : 3]);
        for (let x = -3; x <= 3; x++) px(X + x, Y, !on ? R.RED.hex[1] : Math.abs(x) <= 1 && hot ? '#ff9a82' : R.RED.hex[3]);
        for (let x = -2; x <= 2; x++) px(X + x, Y + 1, on ? R.RED.hex[3] : R.RED.hex[1]);
    }
    function draw(c, v) {
        ctx = c; V = v; cur = '';
        for (let i = 0; i < L.N; i++) {
            const dk = Math.max(0, Math.min(1, v.dark[i] || 0)), rk = Math.max(0, Math.min(1, v.red[i] || 0));
            if (dk <= 0) continue;
            const top = A.deckTop(i), y0 = Math.max(0, sy(top)), y1 = Math.min(v.H, sy(top + L.PITCH));
            if (y1 <= y0) continue;
            ctx.save(); ctx.globalCompositeOperation = 'source-atop'; ctx.globalAlpha = DARK * dk; ctx.fillStyle = INK;
            ctx.fillRect(sx(L.IL), y0, L.IR - L.IL, y1 - y0);                      // the room dark; the windows clear (nothing painted there)
            ctx.restore(); cur = '';
            if (dk >= 0.5) cagesOut(i);
            if (rk > 0) {
                ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = rk;
                ctx.drawImage(lightOf(i), 0, Math.max(0, y0 - sy(top)), L.W, y1 - y0, v.offX, y0, L.W, y1 - y0);
                ctx.restore(); cur = '';
            }
            if (dk >= 0.5) redLamp(i, rk);
        }
        ctx = null; V = null;
    }

    // ── a person in the red lamp's light: their own shading read as a red ramp, brightest at the head (the lamp is above),
    //    dimmer the further they stand from the lamp (in four steps) ──
    const litCache = new WeakMap();
    function lit(cv, p) {
        const near = p && p.deck != null ? Math.max(0.58, 1 - Math.abs(p.x - LAMP_X[p.deck]) / LIT_FALL) : 1, step = Math.round(near * 4);
        let byStep = litCache.get(cv);
        if (!byStep) { byStep = new Map(); litCache.set(cv, byStep); }
        if (byStep.has(step)) return byStep.get(step);
        const w = cv.width, h = cv.height, out = document.createElement('canvas'); out.width = w; out.height = h;
        const g = out.getContext('2d'), src = cv.getContext('2d').getImageData(0, 0, w, h), d = src.data, top = LIT.length - 1, k0 = step / 4;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            const o = (y * w + x) * 4;
            if (!d[o + 3]) continue;
            const lum = 0.3 * d[o] + 0.59 * d[o + 1] + 0.11 * d[o + 2];
            const v = Math.min(1, (Math.pow(lum / 190, 0.8) * 0.95 + 0.14) * k0 * (0.66 + 0.4 * (1 - y / h))), pos = v * top, lo = Math.floor(pos);
            const lv = Math.max(1, Math.min(top, lo + (pos - lo > bay(x, y) ? 1 : 0)));
            d[o] = LIT[lv][0]; d[o + 1] = LIT[lv][1]; d[o + 2] = LIT[lv][2];
        }
        g.putImageData(src, 0, 0);
        byStep.set(step, out);
        return out;
    }

    window.NSStallArt = Object.freeze({ draw, lit, warm, LAMP_X });
})();
