/* ═══ Silent Exodus · layout variant D, "The bridge" · the room ═══════════════════════════════════════════════════════
   The Lander's top deck, cut open like the living ship (crew-hires/ship-life.html), but taller, with most of its back
   wall one big window. Painted once, in the living ship's own recipe and at its own density (one art pixel = one sprite
   pixel), on its own grid: x is the living ship's x (ShipArt.L: hull centre 360, inside 72..648, ladder well at 98), so
   the ladder lines up with the lab deck below, which is ShipArt.deck(1) unchanged.
   The pieces of ship-art.js and ship-rooms.js that are private to those files (hull sides, back wall, ceiling, floor
   slab, ladder, light pass, lamp cage, desk, monitor) are copied here, not changed there.

   window.BridgeArt
     B            { Y0, H, F, WIN, MULL, LIGHT_L }  world row of the room's top, its height, the floor row (local), the
                  window rect and mullions (L x, local rows)
     paint()      { canvas, lamps, fx, glass }  painted once: lamps are world points for the crew's light; fx are the
                  small moving things (world rows); glass is the window's sheen, painted in window space
*/
(function (root) {
    'use strict';
    const A = root.ShipArt, { L, R, INK } = A, api = A.api;
    const { painter, box, topSurface, stencil, lamp, plating, hash, fbm, bay, clamp01, smooth } = api;
    const CE = root.CrewEngine, DESK = CE.ACTIONS.console.desk, SEAT = CE.ACTIONS.sit.seat;

    // The room: world rows 326..662. Its floor is the bridge floor of the living ship (ShipArt.floorY(0) = 644), so the
    // ladder, the slab and the lab below are where they always were; the room is just taller, up into the base of the nose.
    const F = A.floorY(0) - 326;                                        // 318
    const B = Object.freeze({ Y0: 326, H: A.deckTop(1) - 326, F,
        WIN: { x0: 156, x1: 610, y0: 34, y1: 236 }, MULL: [[300, 305]], LIGHT_L: [555, 92] });

    // ── the shell (ship-art.js, copied) ───────────────────────────────────────────────────────────────────────────
    const SKIN = 9;
    function skin(p, x, y, k, side, wy) {
        let v = side > 0 ? 0.4 + 0.045 * k + (k === SKIN - 1 ? 0.12 : 0) : 0.27 - 0.02 * k + (k === SKIN - 1 ? 0.07 : 0);
        const seam = ((wy % 30) + 30) % 30;
        if (seam === 0) v -= 0.14; else if (seam === 1) v += 0.05;
        if ((seam === 3 || seam === 27) && k % 3 === 1) v += 0.1;
        if (k === 4 && ((Math.floor(wy / 30) & 1) === 0)) v -= 0.06;
        v += (fbm(k / 3, wy / 9, 33 + (side > 0 ? 1 : 0)) - 0.5) * 0.08;
        p.tone(x, y, R.HULL, v);
    }
    function hullSides(p, y, wy, solid) {
        const xl = L.CX - L.HO, xr = L.CX + L.HO;
        for (let k = 0; k < SKIN; k++) { skin(p, xl - 1 - k, y, k, -1, wy); skin(p, xr + k, y, k, 1, wy); }
        for (let d = 0; d < L.PLATE; d++) { plating(p, xl + d, y, d, -1, wy, solid); plating(p, xr - 1 - d, y, d, 1, wy, solid); }
    }
    const RIBS = Array.from({ length: 15 }, (_, k) => { const th = (k - 7) * 12 * Math.PI / 180; return { x: L.CX + L.RIN * Math.sin(th), w: Math.max(1, Math.round(6 * Math.cos(th))), c: Math.cos(th) }; });
    function backWall(p, x, y, wy) {
        const sx = (x + 0.5 - L.CX) / L.RIN, c = Math.sqrt(Math.max(0, 1 - sx * sx));
        let v = 0.15 + 0.13 * c + (fbm(x / 9, wy / 7, 3) - 0.5) * 0.07;
        const ly = y - 22;
        if (ly % 44 === 0) v -= 0.07; else if (ly % 44 === 1) v += 0.04;
        for (const r of RIBS) {
            const dx = x - (r.x - r.w / 2);
            if (dx >= 0 && dx < r.w) { v = 0.3 + 0.1 * r.c + (dx === r.w - 1 ? 0.12 : dx === 0 ? -0.08 : 0); if (ly % 44 === 3 && dx === Math.floor(r.w / 2)) v += 0.15; break; }
            if ((dx === -2 || dx === r.w + 1) && ly % 44 === 4) v += 0.12;
        }
        v *= 1 - 0.38 * smooth(F - 72, F, y);
        if (y < 34) v *= 0.82;
        if (x >= L.LX - 15 && x <= L.LX + 15) v *= 0.55;                                                   // the ladder well is a recess
        p.tone(x, y, R.WALL, v);
    }
    function ceiling(p, x, y) {
        const seg = (x + 13) % 64;
        let v;
        if (y < 2) v = 0.08;
        else if (y < 12) { v = y === 11 ? 0.42 : y === 2 ? 0.12 : 0.2 + (y === 10 ? 0.06 : 0); if (seg === 0) v = 0.08; else if (seg === 1 || seg === 63) v += 0.12; }
        else if (y === 12) v = 0.06;
        else if (y < 16) v = [0.14, 0.24, 0.4][y - 13];
        else if (y < 19) v = [0.1, 0.2, 0.34][y - 16];
        else v = (x % 5 === 0 && y === 20) ? 0.3 : 0.1;
        if ((x + 31) % 82 < 2 && y > 1) v = 0.3 + ((x + 31) % 82 === 1 ? 0.1 : 0);
        p.tone(x, y, R.STEEL, v);
    }
    function slab(p, x, y) {
        const ly = y - F;
        let v;
        if (ly === 0) v = 0.62; else if (ly === 1) v = 0.4; else if (ly < 4) v = 0.26 + ((x + ly * 2) % 6 === 0 ? 0.08 : 0);
        else if (ly === 4) v = 0.12;
        else if (ly < 13) { v = 0.18; const hx = (x + 20) % 40; if (ly > 5 && ly < 12 && Math.hypot((hx - 20) / 1.6, ly - 8.5) < 3.2) v = 0.05; if (ly === 8 && (hx < 12 || hx > 28)) v = 0.3; }
        else if (ly < 15) v = 0.24; else v = 0.1;
        p.tone(x, y, R.STEEL, v);
    }
    function ladder(p, yTop, yBot) {
        const lx = L.LX;
        p.region(lx - 13, yTop, lx - 11, yBot, (x, y) => p.tone(x, y, R.STEEL, x === lx - 13 ? 0.42 : 0.62));
        p.region(lx + 12, yTop, lx + 14, yBot, (x, y) => p.tone(x, y, R.STEEL, x === lx + 12 ? 0.5 : 0.3));
        for (let y = Math.ceil(yTop); y < yBot; y++) {
            if (((y + p.oy) % 8 + 8) % 8 !== 6) continue;
            p.region(lx - 11, y, lx + 12, y + 1, (x, yy) => p.tone(x, yy, R.STEEL, 0.56));
            p.region(lx - 11, y + 1, lx + 12, y + 2, (x, yy) => p.tone(x, yy, R.STEEL, 0.16));
        }
    }
    function lightPass(p, lights) {
        const W = p.W, H = p.H;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
            const k4 = (y * W + x) * 4; if (!p.data[k4 + 3]) continue;
            let r = p.data[k4], g = p.data[k4 + 1], b = p.data[k4 + 2];
            for (const s of lights) {
                const dx = (x - s.x) / 1.25, dy = y - s.y;
                const d = Math.hypot(dx, dy < 0 ? dy * 2.2 : dy * 0.82);
                const w = Math.exp(-d / s.reach) * s.k * (s.up + (1 - s.up) * smooth(-18, 0, dy));
                if (w < 0.02) continue;
                const q = Math.min(1, Math.floor(Math.min(1, w * 1.15) * 5 + bay(x, y + p.oy)) / 5);
                if (q <= 0) continue;
                const lum = 0.3 * r + 0.59 * g + 0.11 * b, gain = 1 + q * 2.2 * clamp01(1 - lum / 200);
                const t = Math.min(1, q * 1.4), bloom = q * q;
                r = r + (lum * gain * s.tint[0] - r) * t + bloom * 40 * s.tint[0];
                g = g + (lum * gain * s.tint[1] - g) * t + bloom * 40 * s.tint[1];
                b = b + (lum * gain * s.tint[2] - b) * t + bloom * 40 * s.tint[2];
            }
            p.data[k4] = Math.min(255, r); p.data[k4 + 1] = Math.min(255, g); p.data[k4 + 2] = Math.min(255, b);
        }
    }
    function lampCage(p, lx, y0) {
        for (let y = 20; y < y0 - 2; y++) { p.tone(lx, y, R.STEEL, 0.34); if (y % 6 === 0) p.tone(lx + 1, y, R.STEEL, 0.2); }
        const row = (y, x0, x1, fn) => { for (let x = x0; x <= x1; x++) fn(x, y); };
        row(y0 - 3, lx - 2, lx + 2, (x, y) => p.tone(x, y, R.STEEL, 0.4));
        row(y0 - 2, lx - 4, lx + 4, (x, y) => p.tone(x, y, R.STEEL, x === lx + 4 ? 0.5 : 0.3));
        row(y0 - 1, lx - 4, lx + 4, (x, y) => p.hex(x, y, Math.abs(x - lx) === 4 ? '#7a4a1e' : '#ffd28a'));
        row(y0, lx - 3, lx + 3, (x, y) => p.hex(x, y, x === lx ? '#fff4d6' : '#f0b060'));
        row(y0 + 1, lx - 2, lx + 2, (x, y) => p.hex(x, y, '#c4803a'));
        [lx - 4, lx, lx + 4].forEach(x => p.tone(x, y0 + 2, R.STEEL, 0.28));                                   // the cage's bars under the bulb
    }

    // ── furniture (ship-rooms.js, copied) ───────────────────────────────────────────────────────────────────────
    const COOL = [0.5, 0.95, 1.08];
    const screenLight = (x, y, k = 0.7) => lamp(x, y, { reach: 15, k, tint: COOL, up: 1, kind: 'screen' });
    function desk(p, x0, x1, o = {}) {
        const top = F - DESK, r = R.STEEL;
        topSurface(p, x0, x1, top, 3, r, 0.3);
        p.region(x0, top, x1, top + 3, (x, y) => p.tone(x, y, r, y === top ? 0.62 : 0.42 - (y - top) * 0.06 + (x === x1 - 1 ? 0.08 : 0)));
        box(p, x0 + 2, top + 3, x1 - 1, F - 4, r, 0.22, { panel: 3, topLit: 0, seed: x0 });
        p.region(x0 + 4, F - 4, x1 - 3, F, (x, y) => p.tone(x, y, r, 0.07));
        if (o.vent) for (let y = top + 8; y < top + 20; y += 3) p.region(x1 - 14, y, x1 - 5, y + 1, (x, yy) => p.tone(x, yy, r, 0.1));
    }
    function monitor(p, x, deskTop, w, h, fx, tone) {
        const y1 = deskTop - 3, y0 = y1 - h;
        p.region(x + 3, y1 - 2, x + 7, y1, (xx, y) => p.tone(xx, y, R.STEEL, 0.3));
        p.region(x - 1, y0 - 1, x + w + 3, y1 - 2, (xx, y) => p.tone(xx, y, R.STEEL, xx >= x + w ? 0.14 : y === y0 - 1 ? 0.5 : 0.24));
        p.region(x, y0, x + w, y1 - 3, (xx, y) => p.tone(xx, y, R.SCR, 0.2 + ((y - y0) % 3 === 0 && (xx - x) < w - 2 - ((y * 7) % 5) ? 0.4 : 0.05)));
        fx.push({ kind: 'screen', x, y: y0, w, h: y1 - 3 - y0, tone: tone || 'text' });
        return screenLight(x + w / 2, y0 + h / 2, 0.8);
    }
    function mug(p, x, yBase) {
        const r = R.LINEN;
        p.region(x, yBase - 6, x + 5, yBase, (xx, y) => p.tone(xx, y, r, xx === x + 4 ? 0.62 : xx === x ? 0.24 : 0.42 + (y === yBase - 6 ? 0.14 : 0)));
        p.tone(x + 5, yBase - 5, r, 0.34); p.tone(x + 6, yBase - 4, r, 0.34); p.tone(x + 5, yBase - 3, r, 0.34);
    }
    function clipboard(p, x, y, w = 10, h = 14) {
        p.region(x, y, x + w, y + h, (xx, yy) => p.tone(xx, yy, R.PAPER, (yy - y) % 2 === 0 && yy > y + 2 && xx > x + 1 && xx < x + w - 2 - ((yy * 5) % 3) ? 0.32 : 0.5 + (xx === x + w - 1 ? 0.08 : 0)));
        p.region(x + 3, y - 1, x + w - 3, y + 1, (xx, yy) => p.tone(xx, yy, R.STEEL, 0.6));
    }

    // ── the big window: three panes in one heavy frame, lit on the upper right; the rest of the wall cut away ─────
    function bigWindow(p, fx) {
        const { x0, x1, y0, y1 } = B.WIN, rr = 7;
        const inPane = (x, y) => {
            if (x < x0 || x >= x1 || y < y0 || y >= y1) return false;
            if (B.MULL.some(([a, b]) => x >= a && x < b)) return false;
            const qx = Math.max(x0 + rr - x - 0.5, 0, x + 0.5 - (x1 - rr)), qy = Math.max(y0 + rr - y - 0.5, 0, y + 0.5 - (y1 - rr));
            return Math.hypot(qx, qy) < rr;
        };
        // the frame: 6 px of steel round the whole window, a dark lip next to the glass, lit along the top and the right
        p.region(x0 - 7, y0 - 7, x1 + 7, y1 + 7, (x, y) => {
            if (inPane(x, y)) { p.clear(x, y); return; }
            const dOut = Math.min(x - (x0 - 7), x1 + 6 - x, y - (y0 - 7), y1 + 6 - y);
            const nearGlass = [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dx, dy]) => inPane(x + dx, y + dy));
            if (nearGlass) { p.tone(x, y, R.STEEL, 0.08); return; }
            const onMull = B.MULL.some(([a, b]) => x >= a && x < b) && y >= y0 && y < y1;
            if (onMull) { const [a, b] = B.MULL.find(([a2, b2]) => x >= a2 && x < b2); p.tone(x, y, R.STEEL, x === b - 1 ? 0.5 : x === a ? 0.14 : 0.28 + ((y - y0) % 34 === 0 ? 0.12 : 0)); return; }
            let v = 0.24 + 0.16 * (x - x0) / (x1 - x0);
            if (dOut === 0) v = 0.1;
            else if (y < y0 && dOut === 1) v = 0.56;                                                          // the top edge catches the light
            else if (x >= x1 && dOut === 1) v = 0.5;
            else if (y >= y1 && dOut === 1) v = 0.14;
            if (y < y0 && (x - x0) % 38 === 19) v += 0.18;                                                    // bolts along the frame
            if (y >= y1 && (x - x0) % 38 === 19) v += 0.12;
            p.tone(x, y, R.STEEL, v);
        });
        // the sill: a deep ledge with a strip of small lights along it
        p.region(x0 - 10, y1 + 7, x1 + 10, y1 + 13, (x, y) => p.tone(x, y, R.STEEL, [0.66, 0.46, 0.34, 0.26, 0.18, 0.08][y - y1 - 7] + (x === x1 + 9 ? 0.06 : 0)));
        p.region(x0 - 6, y1 + 13, x1 + 6, y1 + 15, (x, y) => p.tone(x, y, R.STEEL, 0.05));
        for (let x = x0 + 6; x < x1 - 6; x += 7) fx.push({ kind: 'led', x, y: y1 + 9, color: (x / 7) % 3 < 1 ? '#c4803a' : '#2fb6c0', period: 1700 + ((x * 37) % 900) });
        return inPane;
    }

    /** The glass: a faint sheen in long diagonal bands, and the lamps' warm reflection, in window space (screen at rest). */
    function paintGlass(inPane, lamps, offX) {
        const W = 640, H = 360, p = painter(W, H, 0), SHEEN = { rgb: [[0, 0, 0], [10, 22, 26]] };
        const { x0, x1, y0, y1 } = B.WIN;
        p.region(x0 + offX, y0, x1 + offX, y1, (x, y) => {
            if (!inPane(x - offX, y)) return;
            const u = (x - offX - x0) + (y - y0) * 0.9, band = Math.abs(((u % 190) + 190) % 190 - 50);
            let a = band < 16 ? 0.1 * (1 - band / 16) : 0;
            if (y - y0 < 2 && x - offX > x0 + 3) a += 0.08;
            if (a > bay(x, y) * 1.2) p.set(x, y, SHEEN.rgb[1]);
            lamps.forEach(lm => {                                                                             // the lamp's reflection: a faint warm smear below it
                const d = Math.hypot((x - offX - lm.x) / 1.6, y - (lm.y - B.Y0) - 9);
                if (d < 6 && (1 - d / 6) * 0.32 > bay(x + 3, y + 1)) p.set(x, y, [46, 28, 14]);
            });
        });
        return p.canvas();
    }

    function paint() {
        const p = painter(L.W, B.H, B.Y0), fx = [], lights = [];
        for (let y = 0; y < B.H; y++) {
            const wy = B.Y0 + y;
            hullSides(p, y, wy, y >= F);
            for (let x = L.IL; x < L.IR; x++) {
                if (y >= F) slab(p, x, y);
                else if (y < 22) ceiling(p, x, y);
                else backWall(p, x, y, wy);
            }
        }
        for (const side of [-1, 1]) {                                                                         // knee brackets under the ceiling
            const xb = side < 0 ? L.IL : L.IR - 1, G = 22;
            for (let j = 0; j < G; j++) for (let k = 0; k < G - j; k++) {
                const x = xb - side * k, y = 22 + j;
                if (side < 0 && x >= L.LX - 16) continue;
                const edge = k === G - j - 1, hole = Math.hypot(k - 6, j - 6) < 3.2;
                p.tone(x, y, R.STEEL, hole ? 0.06 : edge ? (side > 0 ? 0.3 : 0.5) : 0.24 + (j === 0 ? 0.08 : 0));
            }
        }
        // two pipes along the ceiling, on brackets, with a red valve wheel
        p.region(L.LX + 16, 23, L.IR, 28, (x, y) => p.tone(x, y, R.STEEL, [0.5, 0.32, 0.18, 0.42, 0.24][y - 23] + (x % 61 === 0 ? 0.12 : 0)));
        for (let x = L.LX + 26; x < L.IR - 2; x += 44) p.region(x, 22, x + 2, 29, (xx, y) => p.tone(xx, y, R.STEEL, xx === x + 1 ? 0.56 : 0.34));
        p.ellipse(208, 25, 3.5, 3.5, (x, y, q) => p.tone(x, y, q > 0.45 ? R.RED : R.STEEL, q > 0.45 ? 0.45 + (x > 208 ? 0.12 : 0) : 0.3));

        const inPane = bigWindow(p, fx);

        // the hatch: open, its lid stood up beside it; the ladder up through it, with two hand rails above the floor
        const x0h = L.LX - 14, x1h = L.LX + 14;
        p.region(x0h, F, x1h + 1, B.H, (x, y) => p.tone(x, y, R.WALL, 0.05 + (y > F + 12 ? 0.03 : 0)));
        p.region(x0h - 1, F, x0h, B.H, (x, y) => p.tone(x, y, R.STEEL, 0.46));
        p.region(x1h + 1, F, x1h + 2, B.H, (x, y) => p.tone(x, y, R.STEEL, 0.3));
        p.region(x1h + 3, F - 26, x1h + 6, F, (x, y) => p.tone(x, y, R.STEEL, [0.56, 0.36, 0.2][x - x1h - 3] + (y === F - 26 ? 0.1 : 0)));
        p.tone(x1h + 4, F - 14, R.STEEL, 0.7); p.tone(x1h + 4, F - 13, R.STEEL, 0.5);
        ladder(p, F - 46, B.H);
        p.region(L.LX - 13, F - 48, L.LX + 14, F - 45, (x, y) => p.tone(x, y, R.STEEL, y === F - 48 ? 0.62 : 0.3));
        for (const [a, b] of [[L.LX - 22, L.LX - 15], [L.LX + 16, L.LX + 24]]) p.region(a, F + 1, b, F + 4, (x, y) => p.tone(x, y, ((x + y) >> 1) % 2 ? R.AMBER : R.STEEL, ((x + y) >> 1) % 2 ? 0.34 : 0.14));
        // the deck's name, the intercom and the extinguisher by the ladder
        stencil(p, '1 BRIDGE', L.LX + 22, F - 108, R.WALL, 0.62, 0.08);
        p.region(L.LX + 22, F - 101, L.LX + 53, F - 100, (x, y) => { if (hash(x, 0, 9) > 0.25) p.tone(x, y, R.AMBER, 0.32); });
        const ix = L.LX + 24;
        p.region(ix, F - 170, ix + 9, F - 156, (x, y) => p.tone(x, y, R.STEEL, x === ix + 8 ? 0.42 : y === F - 170 ? 0.46 : ((y - F) % 2 === 0 && x > ix + 1 && x < ix + 7 ? 0.12 : 0.26)));
        fx.push({ kind: 'led', x: ix + 2, y: F - 159, color: '#5ff2cf', period: 3100 });
        const EXT = { hex: [INK, '#240c0a', '#4a1814', '#742a20', '#9a4030', '#bc6448'] }; EXT.rgb = EXT.hex.map(api.hexRgb);
        const ex = L.LX + 36;
        p.region(ex, F - 62, ex + 6, F - 38, (x, y) => { if ((x === ex || x === ex + 5) && y === F - 62) return; p.tone(x, y, EXT, x === ex + 4 ? 0.8 : x === ex ? 0.3 : 0.55 - (y > F - 44 ? 0.15 : 0)); });
        p.region(ex + 1, F - 66, ex + 5, F - 62, (x, y) => p.tone(x, y, R.STEEL, 0.5));
        p.region(ex - 1, F - 54, ex + 7, F - 53, (x, y) => p.tone(x, y, R.STEEL, 0.36));

        // the commander's chair, facing the helm and the window
        const cx = 226, s = F - SEAT;
        p.region(cx - 12, s, cx + 12, s + 4, (x, y) => p.tone(x, y, R.FABRIC, [0.6, 0.44, 0.3, 0.16][y - s]));
        p.region(cx - 16, s - 50, cx - 11, s + 2, (x, y) => { const tilt = Math.floor((s - y) / 12); if (x < cx - 16 - tilt + 1 || x > cx - 11 - tilt) return; p.tone(x, y, R.FABRIC, 0.26 + (x === cx - 11 - tilt ? 0.18 : 0) + (y < s - 42 ? 0.08 : 0)); });
        p.region(cx - 8, s - 10, cx + 10, s - 8, (x, y) => p.tone(x, y, R.STEEL, y === s - 10 ? 0.5 : 0.24));
        p.region(cx + 8, s - 12, cx + 12, s - 9, (x, y) => p.tone(x, y, R.SCR, 0.4));                         // a small panel on the arm
        fx.push({ kind: 'led', x: cx + 9, y: s - 12, color: '#5ff2cf', period: 2300 });
        p.region(cx - 2, s + 4, cx + 3, F - 2, (x, y) => p.tone(x, y, R.STEEL, x === cx + 2 ? 0.42 : 0.22));
        p.region(cx - 10, F - 2, cx + 11, F, (x, y) => p.tone(x, y, R.STEEL, y === F - 2 ? 0.46 : 0.2));

        // the helm: a desk, its screen, the throttle, a row of small lights, Jaxon's mug
        desk(p, 372, 470, { vent: true });
        p.region(430, F - DESK - 22, 468, F - DESK - 2, (x, y) => { if (x - 430 < (F - DESK - 2 - y) * 0.4) return; p.tone(x, y, R.STEEL, y === F - DESK - 22 + Math.round((x - 430) / 2) ? 0.4 : 0.22); });
        lights.push(monitor(p, 400, F - DESK, 9, 16, fx, 'helm'));
        for (let x = 378; x < 396; x += 3) fx.push({ kind: 'led', x, y: F - DESK - 1, color: x % 2 ? '#2fb6c0' : '#c4803a', period: 900 + x * 13 });
        mug(p, 380, F - DESK - 3);
        // the navigation desk: the chart screen, papers
        desk(p, 500, 600);
        lights.push(monitor(p, 526, F - DESK, 14, 22, fx, 'chart'));
        clipboard(p, 566, F - DESK - 15);
        // A.U.R.A.: a speaker grille in the wall by the window, one slow light
        p.region(616, 112, 632, 132, (x, y) => p.tone(x, y, R.STEEL, x === 631 ? 0.42 : y === 112 ? 0.46 : (y % 2) ? 0.12 : 0.34));
        fx.push({ kind: 'aura', x: 622, y: 106 });
        // the suit locker on the right wall: a glass door, a helmet on the shelf, a suit hanging
        box(p, 610, F - 150, 646, F, R.STEEL, 0.2, { panel: 2 });
        p.region(614, F - 144, 642, F - 10, (x, y) => p.tone(x, y, R.WALL, 0.07));
        p.ellipse(627, F - 126, 8, 8, (x, y) => { const nx = (x - 627) / 8, ny = (y - F + 126) / 8; p.tone(x, y, R.LINEN, 0.24 + 0.5 * clamp01(nx * 0.6 - ny * 0.7 + 0.3)); });
        p.region(621, F - 123, 633, F - 120, (x, y) => p.tone(x, y, R.SCR, 0.25));
        p.region(614, F - 115, 642, F - 113, (x, y) => p.tone(x, y, R.STEEL, 0.5));
        p.region(616, F - 106, 638, F - 28, (x, y) => { const w = 9 - Math.abs(y - F + 68) * 0.03; if (Math.abs(x - 627) > w) return; p.tone(x, y, R.LINEN, 0.28 + (x > 627 ? 0.1 : 0) + ((y + 2) % 16 === 0 ? -0.08 : 0)); });
        fx.push({ kind: 'glint', x: 638, y: F - 138, r: 4 });
        // a placard by the intercom
        p.region(L.LX + 22, F - 140, L.LX + 36, F - 131, (x, y) => p.tone(x, y, R.LINEN, y === F - 140 ? 0.42 : ((y - F) % 2 === 0 && x > L.LX + 23 && x < L.LX + 33) ? 0.16 : 0.3));

        // the way down: a chevron and the next deck's name painted by the hatch, a caged wall lamp over the ladder
        stencil(p, '2 LAB', L.LX + 22, F - 30, R.AMBER, 0.34, 0.12);
        for (let k = 0; k < 2; k++) for (let i = 0; i < 4; i++) { p.tone(L.LX + 44 + i, F - 31 + k * 3 + i, R.AMBER, 0.36); p.tone(L.LX + 50 - i, F - 31 + k * 3 + i, R.AMBER, 0.36); }
        const wl = { x: L.LX + 30, y: F - 128 };
        p.region(wl.x - 4, wl.y - 3, wl.x + 5, wl.y + 3, (x, y) => p.tone(x, y, R.STEEL, y === wl.y - 3 ? 0.5 : x === wl.x + 4 ? 0.42 : 0.22));
        p.region(wl.x - 3, wl.y - 1, wl.x + 4, wl.y + 2, (x, y) => p.hex(x, y, y === wl.y - 1 ? '#ffd28a' : (x - wl.x) % 3 === 0 ? '#7a4a1e' : '#f0b060'));
        // a hooded lamp on each desk: the stations sit in their own warm light
        const deskLamp = (sx0, dir) => {
            const top = F - DESK - 3, hx = sx0 + dir * 9;
            p.line(sx0, top, sx0, top - 18, (x, y) => { p.tone(x, y, R.STEEL, 0.36); p.tone(x + 1, y, R.STEEL, 0.18); });
            p.line(sx0, top - 18, hx, top - 26, (x, y) => p.tone(x, y, R.STEEL, 0.42));
            p.region(hx - 5, top - 29, hx + 6, top - 25, (x, y) => p.tone(x, y, R.STEEL, y === top - 29 ? 0.5 : 0.26));
            p.region(hx - 4, top - 25, hx + 5, top - 24, (x, y) => p.hex(x, y, x === hx ? '#fff4d6' : '#ffd28a'));
            p.region(sx0 - 3, top - 1, sx0 + 4, top, (x, y) => p.tone(x, y, R.STEEL, 0.4));
            return { x: hx, y: top - 23 };
        };
        const DL = [deskLamp(424, 1), deskLamp(508, 1)];
        // the lamps hang low on cords in front of the top of the window
        const LAMPS = [{ x: 236, low: 46 }, { x: 486, low: 40 }];
        LAMPS.forEach(l => lampCage(p, l.x, l.low));
        const [sx, sy] = B.LIGHT_L;
        const all = LAMPS.map(l => lamp(l.x, l.low + 2, { reach: 56, k: 1 }))
            .concat(DL.map(d => lamp(d.x, d.y, { reach: 30, k: 0.95, up: 0.1 })))
            .concat([lamp(wl.x, wl.y + 2, { reach: 40, k: 0.9, up: 0.3 })])
            .concat(lights)
            .concat([lamp(sx, sy, { reach: 70, k: 0.55, tint: [1, 0.78, 0.5], up: 1 })]);                // the light ahead warms the frame round it
        lightPass(p, all);
        const lamps = LAMPS.map(l => ({ x: l.x, y: B.Y0 + l.low, reach: 56 })).concat(DL.map(d => ({ x: d.x, y: B.Y0 + d.y, reach: 30 })), [{ x: wl.x, y: B.Y0 + wl.y, reach: 40 }]);
        const hung = LAMPS.map(l => ({ x: l.x, y: B.Y0 + l.low }));
        const glass = paintGlass(inPane, hung, -40);
        return { canvas: p.canvas(), lamps, fx: fx.map(f => Object.assign({}, f, { y: f.y + B.Y0 })), glass, inPane };
    }

    root.BridgeArt = { B, paint };
})(typeof window !== 'undefined' ? window : globalThis);
