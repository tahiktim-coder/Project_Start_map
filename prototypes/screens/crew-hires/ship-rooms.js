/* ═══ Silent Exodus · the living ship (study) · the picture, part 2: the rooms ══════════════════════════════════════
   One painter per deck. Each paints its furniture into the deck's buffer (local rows: 0 is the deck's top, F = 190 is
   the row people stand on, so a thing h rows tall stands at F - h) and returns its lamps, its small moving things
   (fx) and any extra light (screens, pods). A look ({ lampOff, mira: 'gone', stretcher, dark, pods, hatchClosed })
   changes a deck for a story state; the page asks for the look, ship-art.js keeps one painted copy of each.
   ShipArt.SPOTS   where people stand, sit, work and sleep: { deck, x, facing, h? } (x is the sprite's x, as the engine
                   draws it; for a bed, h is the mattress top and x is the hips). The routines in ship-sim.js use only these.
*/
(function (root) {
    'use strict';
    const A = root.ShipArt, { L, R, api } = A, { box, topSurface, porthole, hash, fbm, clamp01, lamp } = api;
    const F = L.DECK_FLOOR, CE = root.CrewEngine, DESK = CE ? CE.ACTIONS.console.desk : 54, SEAT = CE ? CE.ACTIONS.sit.seat : 22;
    const COOL = [0.5, 0.95, 1.08], ICE_T = [0.62, 0.92, 1.1];
    const screenLight = (x, y, k = 0.7) => lamp(x, y, { reach: 15, k, tint: COOL, up: 1, kind: 'screen' });

    // ── furniture pieces ─────────────────────────────────────────────────────────────────────────────────────────
    /** A desk at the engine's console height: a top seen a little from above, a lip, a front with panels and a kick space. */
    function desk(p, x0, x1, o = {}) {
        const top = F - DESK, r = o.r || R.STEEL;
        topSurface(p, x0, x1, top, 3, r, 0.3);
        p.region(x0, top, x1, top + 3, (x, y) => p.tone(x, y, r, y === top ? 0.62 : 0.42 - (y - top) * 0.06 + (x === x1 - 1 ? 0.08 : 0)));
        box(p, x0 + 2, top + 3, x1 - 1, F - 4, r, 0.22, { panel: 3, topLit: 0, seed: x0 });
        p.region(x0 + 4, F - 4, x1 - 3, F, (x, y) => p.tone(x, y, r, 0.07));
        if (o.vent) for (let y = top + 8; y < top + 20; y += 3) p.region(x1 - 14, y, x1 - 5, y + 1, (x, yy) => p.tone(x, yy, r, 0.1));
    }
    /** A monitor standing on a desk, turned toward someone at its left: its face shows as a strip, its back is dark. */
    function monitor(p, x, deskTop, w, h, fxList, tone) {
        const y1 = deskTop - 3, y0 = y1 - h;
        p.region(x + 3, y1 - 2, x + 7, y1, (xx, y) => p.tone(xx, y, R.STEEL, 0.3));
        p.region(x - 1, y0 - 1, x + w + 3, y1 - 2, (xx, y) => p.tone(xx, y, R.STEEL, xx >= x + w ? 0.14 : y === y0 - 1 ? 0.5 : 0.24));
        p.region(x, y0, x + w, y1 - 3, (xx, y) => p.tone(xx, y, R.SCR, 0.2 + ((y - y0) % 3 === 0 && (xx - x) < w - 2 - ((y * 7) % 5) ? 0.4 : 0.05)));
        fxList.push({ kind: 'screen', x, y: y0, w, h: y1 - 3 - y0, tone: tone || 'text' });
        return screenLight(x + w / 2, y0 + h / 2, 0.8);
    }
    function stool(p, cx) {
        const s = F - SEAT;
        p.region(cx - 7, s, cx + 8, s + 3, (x, y) => p.tone(x, y, R.STEEL, [0.62, 0.4, 0.2][y - s] + (x === cx + 7 ? 0.08 : 0)));
        p.region(cx - 1, s + 3, cx + 2, F, (x, y) => p.tone(x, y, R.STEEL, x === cx + 1 ? 0.44 : 0.26));
        p.region(cx - 5, F - 8, cx + 6, F - 7, (x, y) => p.tone(x, y, R.STEEL, 0.36));
        p.region(cx - 6, F - 1, cx + 7, F, (x, y) => p.tone(x, y, R.STEEL, 0.3));
    }
    /** Each person's own blanket, so a made bed and an empty one say whose they are. */
    A.BLANKETS = {
        aris: { hex: [A.INK, '#1e0f14', '#36161f', '#52202c', '#6e2c38', '#8a3c44'] }, cora: { hex: [A.INK, '#10151d', '#1a2230', '#263246', '#36465e', '#4a5d78'] },
        mira: { hex: [A.INK, '#0c1a1a', '#142a2a', '#1f3e3c', '#2d5652', '#41736a'] }, vance: { hex: [A.INK, '#15160e', '#232517', '#353822', '#4a4e30', '#636842'] },
        jaxon: { hex: [A.INK, '#1a120c', '#2c1e14', '#42301e', '#5c432a', '#7a5a38'] },
    };
    Object.values(A.BLANKETS).forEach(b => { b.rgb = b.hex.map(api.hexRgb); });
    /** A bunk frame with berths stacked h rows apart; head: which end the pillow is (-1 left, 1 right). */
    function bunk(p, x0, x1, berths, head, fxList, lights) {
        const topH = Math.max(...berths.map(b => b.h)) + 36;
        berths.forEach((b, k) => {
            const y = F - b.h, BL = A.BLANKETS[b.who] || R.WOOL, ceil = y - 32;
            p.region(x0 + 3, ceil, x1 - 3, y, (xx, yy) => p.tone(xx, yy, R.WALL, 0.17 + (fbm(xx / 7, yy / 5, 13) - 0.5) * 0.06 - (yy < ceil + 2 ? 0.08 : 0) + ((xx - x0) % 26 === 0 ? -0.05 : 0)));
            p.region(x0 + 3, y + 5, x1 - 3, y + 8, (xx, yy) => p.tone(xx, yy, R.STEEL, [0.5, 0.32, 0.16][yy - y - 5]));
            p.region(x0 + 3, y, x1 - 3, y + 5, (xx, yy) => p.tone(xx, yy, R.FABRIC, [0.66, 0.52, 0.44, 0.38, 0.28][yy - y] + ((xx * 3) % 13 === 0 && yy > y ? -0.08 : 0)));
            const px0 = head < 0 ? x0 + 5 : x1 - 23;                                                         // the pillow
            p.region(px0, y - 5, px0 + 18, y, (xx, yy) => { const c = (xx === px0 || xx === px0 + 17); if (c && (yy === y - 5 || yy === y - 1)) return; p.tone(xx, yy, R.LINEN, 0.78 - (yy - y + 5) * 0.07 + (xx === px0 + 16 ? 0.05 : c ? -0.12 : 0)); });
            const foot = head < 0 ? x1 - 4 : x0 + 4, dir = head < 0 ? -1 : 1;
            if (b.state === 'rumpled') {
                for (let i = 0; i < 40; i++) {
                    const xx = foot + dir * i, hgt = Math.round(2 + 5 * Math.sin(Math.min(1, i / 34) * Math.PI) * (0.7 + 0.3 * Math.sin(i * 0.9)) + (hash(i, k, 3) > 0.7 ? 1 : 0));
                    for (let j = 0; j < hgt; j++) p.tone(xx, y - 1 - j, BL, 0.34 + j * 0.07 + (j === hgt - 1 ? 0.12 : 0) + ((i % 7 === 3) ? -0.14 : 0));
                }
            } else if (b.state === 'made') {
                const xa = head < 0 ? px0 + 19 : x0 + 4, xb = head < 0 ? x1 - 4 : px0 - 1;
                p.region(xa, y - 3, xb, y, (xx, yy) => p.tone(xx, yy, BL, yy === y - 3 ? 0.66 : 0.46 - (yy - y + 2) * 0.05));
                const sx = head < 0 ? xa : xb - 4;                                                              // the sheet turned down by the pillow
                p.region(sx, y - 3, sx + 4, y, (xx, yy) => p.tone(xx, yy, R.LINEN, yy === y - 3 ? 0.72 : 0.5));
                const fx0 = head < 0 ? x1 - 26 : x0 + 6;
                p.region(fx0, y - 8, fx0 + 20, y - 3, (xx, yy) => p.tone(xx, yy, BL, yy === y - 8 ? 0.72 : (yy - y + 8) % 2 ? 0.44 : 0.56));
            }
            const cx = head < 0 ? x1 - 10 : x0 + 3;                                                           // the curtain, tied back at the foot
            p.region(cx, ceil, cx + 7, y, (xx, yy) => {
                const t = (yy - ceil) / (y - ceil), w = Math.round(7 - 4 * Math.sin(Math.min(1, t * 1.6) * Math.PI * 0.5) + (t > 0.62 ? 2 * (t - 0.62) / 0.38 : 0));
                if (head < 0 ? xx < cx + 7 - w : xx >= cx + w) return;
                p.tone(xx, yy, BL, 0.3 + ((xx - cx) % 2 ? 0.1 : 0) + (yy === ceil ? 0.14 : 0));
            });
            p.region(x0 + 3, ceil - 1, x1 - 3, ceil, (xx, yy) => p.tone(xx, yy, R.STEEL, 0.44));
            if (b.light !== false) {
                const lx = head < 0 ? x0 + 7 : x1 - 9;
                p.hex(lx, ceil + 2, '#ffd28a'); p.hex(lx + 1, ceil + 2, '#f0b060'); p.hex(lx, ceil + 1, '#7a4a1e'); p.hex(lx + 1, ceil + 1, '#7a4a1e');
                lights.push(lamp(lx, ceil + 3, { reach: 20, k: 0.85, up: 0.2 }));
            }
            (b.things || []).forEach(t => t(p, y));
        });
        for (const px of [x0, x1 - 3]) p.region(px, F - topH, px + 3, F, (x, y) => p.tone(x, y, R.STEEL, [0.28, 0.48, 0.2][x - px]));
        p.region(x0, F - topH, x1, F - topH + 3, (x, y) => p.tone(x, y, R.STEEL, [0.56, 0.32, 0.16][y - F + topH]));
        if (berths.some(b => b.h === SEAT)) { box(p, x0 + 6, F - SEAT + 9, x1 - 6, F - 1, R.STEEL, 0.2, { panel: 2, topLit: 0.06 }); p.region(Math.round((x0 + x1) / 2) - 4, F - 12, Math.round((x0 + x1) / 2) + 4, F - 11, (x, y) => p.tone(x, y, R.STEEL, 0.5)); }
        return topH;
    }
    function crate(p, x0, y0, x1, y1, seed, o = {}) {
        box(p, x0, y0, x1, y1, R.CRATE, 0.36 + (hash(seed, 1, 4) - 0.5) * 0.12, { panel: 3, seed });
        topSurface(p, x0, x1, y0, 2, R.CRATE, 0.34);
        const sy = y0 + Math.round((y1 - y0) * 0.35);
        p.region(x0 + 1, sy, x1 - 1, sy + 1, (x, y) => p.tone(x, y, R.CRATE, 0.18));
        if (o.label !== false && x1 - x0 > 24) { const lx = x0 + 5, ly = y0 + Math.round((y1 - y0) * 0.55); p.region(lx, ly, lx + 9, ly + 5, (x, y) => p.hex(x, y, y === ly ? '#bfb088' : (x + y) % 3 ? '#a89a70' : '#8a7c58')); }
    }
    function jar(p, x, yBase, h, seed) {
        p.region(x, yBase - h, x + 6, yBase, (xx, y) => p.tone(xx, y, R.GLASS, xx === x + 4 ? 0.8 : xx === x ? 0.24 : (y > yBase - h * 0.6 ? 0.5 : 0.32)));
        p.region(x, yBase - h - 2, x + 6, yBase - h, (xx, y) => p.tone(xx, y, R.STEEL, 0.5));
        if (hash(seed, 2, 7) > 0.5) p.tone(x + 2, yBase - 4, R.AMBER, 0.4);
    }
    function shelf(p, x0, x1, h, items) {
        const y = F - h;
        p.region(x0, y, x1, y + 3, (x, yy) => p.tone(x, yy, R.STEEL, [0.6, 0.36, 0.14][yy - y]));
        for (const bx of [x0 + 6, x1 - 8]) p.region(bx, y + 3, bx + 2, y + 9, (x, yy) => p.tone(x, yy, R.STEEL, 0.26 - (yy - y) * 0.01));
        items.forEach(([kind, x, ih, s]) => {
            if (kind === 'jar') jar(p, x, y, ih, s);
            else if (kind === 'box') box(p, x, y - ih, x + 12, y, R.CRATE, 0.3, { tex: 0.03, topLit: 0.2 });
            else if (kind === 'book') p.region(x, y - ih, x + 3, y, (xx, yy) => p.tone(xx, yy, R.PAPER, 0.3 + (xx - x) * 0.12));
        });
    }
    /** A window pane in the back wall, rounded, see-through, with a frame lit on its upper right. */
    function pane(p, x0, y0, x1, y1) {
        const r = 5;
        p.region(x0 - 4, y0 - 4, x1 + 4, y1 + 4, (x, y) => {
            const qx = Math.max(x0 + r - x - 0.5, 0, x + 0.5 - (x1 - r)), qy = Math.max(y0 + r - y - 0.5, 0, y + 0.5 - (y1 - r));
            const out = Math.hypot(qx, qy) - r;
            if (out < 0 && x >= x0 && x < x1 && y >= y0 && y < y1) { p.clear(x, y); return; }
            if (out < 1) { p.tone(x, y, R.STEEL, 0.08); return; }
            if (out < 4) { const lit = (x - x0) / (x1 - x0) * 0.5 + (y < y0 ? 0.3 : y >= y1 ? -0.2 : 0); p.tone(x, y, R.STEEL, 0.26 + lit * 0.4 + (out < 2 ? 0.1 : 0)); }
        });
        return [{ kind: 'glint', x: x1 - 8, y: y0 + 6, r: 6 }];
    }

    const EXT = { hex: [A.INK, '#240c0a', '#4a1814', '#742a20', '#9a4030', '#bc6448'] }; EXT.rgb = EXT.hex.map(api.hexRgb);
    /** What every deck has by the ladder: an intercom, an extinguisher, hazard paint round the hatch; plus conduits and vents. */
    function dress(p, i, o, fx) {
        const ix = L.LX + 22;
        p.region(ix, F - 152, ix + 9, F - 138, (x, y) => p.tone(x, y, R.STEEL, x === ix + 8 ? 0.42 : y === F - 152 ? 0.46 : ((y - F) % 2 === 0 && x > ix + 1 && x < ix + 7 ? 0.12 : 0.26)));
        fx.push({ kind: 'led', x: ix + 2, y: F - 141, color: '#5ff2cf', period: 3100 + i * 211 });
        if (o.ext !== null) {
            const ex = o.ext || L.LX + 34;
            p.region(ex, F - 62, ex + 6, F - 38, (x, y) => { if ((x === ex || x === ex + 5) && y === F - 62) return; p.tone(x, y, EXT, x === ex + 4 ? 0.8 : x === ex ? 0.3 : 0.55 - (y > F - 44 ? 0.15 : 0)); });
            p.region(ex + 1, F - 66, ex + 5, F - 62, (x, y) => p.tone(x, y, R.STEEL, 0.5));
            p.region(ex - 1, F - 54, ex + 7, F - 53, (x, y) => p.tone(x, y, R.STEEL, 0.36));
        }
        if (i < L.N - 1) for (const [a, b] of [[L.LX - 22, L.LX - 15], [L.LX + 16, L.LX + 24]]) p.region(a, F + 1, b, F + 4, (x, y) => p.tone(x, y, ((x + y) >> 1) % 2 ? R.AMBER : R.STEEL, ((x + y) >> 1) % 2 ? 0.34 : 0.14));
        (o.conduits || []).forEach(([cx, y0, y1]) => {
            p.region(cx, y0, cx + 3, y1, (x, y) => p.tone(x, y, R.STEEL, [0.2, 0.38, 0.16][x - cx] + (((y + p.oy) % 40) === 0 ? 0.16 : 0)));
            p.region(cx - 2, y0 + 30, cx + 5, y0 + 38, (x, y) => p.tone(x, y, R.STEEL, x === cx + 4 ? 0.42 : y === y0 + 30 ? 0.4 : 0.26));
        });
        (o.vents || []).forEach(vx => p.region(vx, 26, vx + 16, 34, (x, y) => p.tone(x, y, R.STEEL, y === 26 ? 0.4 : (y % 2 ? 0.08 : 0.3) + (x === vx + 15 ? 0.06 : 0))));
    }

    /** A line strung across the room, sagging, with cloth hung on it: [x, width, drop, ramp, base]. */
    function line(p, x0, x1, h, sag, things) {
        const yAt = x => F - h + Math.round(sag * Math.sin(Math.PI * (x - x0) / (x1 - x0)));
        for (let x = x0; x <= x1; x++) p.tone(x, yAt(x), R.STEEL, 0.34);
        things.forEach(([cx, w, drop, r, base]) => {
            for (let x = cx; x < cx + w; x++) { const y0 = yAt(x) + 1, d = drop - ((x - cx) % 5 === 4 ? 1 : 0); for (let y = y0; y < y0 + d; y++) p.tone(x, y, r, base + (y === y0 ? 0.16 : 0) + ((x - cx) % 3 === 0 ? -0.08 : 0) - (y > y0 + d - 2 ? 0.06 : 0)); }
            p.tone(cx + 1, yAt(cx + 1), R.STEEL, 0.6); p.tone(cx + w - 2, yAt(cx + w - 2), R.STEEL, 0.6);
        });
    }
    function duct(p, x0, x1, yBot, r = R.STEEL) {
        p.region(x0, 22, x1, yBot, (x, y) => p.tone(x, y, r, 0.18 + 0.2 * (x - x0) / (x1 - x0) + ((y - 22) % 26 === 0 ? 0.14 : 0) + (x === x1 - 1 ? 0.12 : x === x0 ? -0.06 : 0)));
        p.region(x0 - 4, yBot, x1 + 4, yBot + 5, (x, y) => p.tone(x, y, r, y === yBot ? 0.5 : y === yBot + 4 ? 0.12 : 0.3 + (x === x1 + 3 ? 0.1 : 0)));
        p.region(x0 - 2, yBot + 5, x1 + 2, yBot + 6, (x, y) => p.tone(x, y, r, 0.06));
    }
    function placard(p, x, y, w, h, r = R.LINEN) {
        p.region(x, y, x + w, y + h, (xx, yy) => p.tone(xx, yy, r, yy === y ? 0.42 : ((yy - y) % 2 === 0 && xx > x + 1 && xx < x + w - 2 - ((yy * 3) % 4)) ? 0.16 : 0.3));
    }


    /** The ceiling services every deck shares, painted first so windows, ducts and lamps sit in front of them: two pipes
        on brackets, a valve wheel, and (where the room has headroom) a cable tray with cables sagging between hangers. */
    function overhead(p, i, o = {}) {
        const x0 = L.LX + 16, x1 = L.IR, PIPE = [0.5, 0.32, 0.18, 0.42, 0.24, 0.1];
        p.region(x0, 23, x1, 29, (x, y) => p.tone(x, y, R.STEEL, PIPE[y - 23] + ((x + i * 7) % 61 === 0 ? 0.12 : 0)));
        for (let x = x0 + 10 + i * 5; x < x1 - 2; x += 44) p.region(x, 22, x + 2, 30, (xx, y) => p.tone(xx, y, R.STEEL, xx === x + 1 ? 0.56 : 0.34));
        const vx = 180 + i * 71;                                                                         // a valve wheel on the lower pipe
        p.ellipse(vx, 26, 3.5, 3.5, (x, y, q) => p.tone(x, y, q > 0.45 ? R.RED : R.STEEL, q > 0.45 ? 0.45 + (x > vx ? 0.12 : 0) : 0.3));
        if (o.tray === false) return;
        p.region(x0 + 20, 34, x1 - 6, 35, (x, y) => p.tone(x, y, R.STEEL, 0.44));
        p.region(x0 + 20, 35, x1 - 6, 37, (x, y) => p.tone(x, y, R.STEEL, 0.16 + (x % 6 === 0 ? 0.08 : 0)));
        const CAB = [[R.DUST, 0.6, 0], [R.TEAL, 0.32, 3]];
        for (let h = x0 + 20; h < x1 - 40; h += 58) {
            p.region(h, 30, h + 1, 34, (x, y) => p.tone(x, y, R.STEEL, 0.4));
            CAB.forEach(([r, v, d]) => { for (let x = h + 1; x < h + 58 && x < x1 - 6; x++) { const t = (x - h) / 58, y = 37 + Math.round((2.5 + d * 0.4) * Math.sin(Math.PI * t)) + (d ? 1 : 0); p.tone(x, y, r, v); } });
        }
    }
    /** A work jacket hung on a hook: collar, shoulders, sleeves hanging, a darker fold down the middle. */
    function jacket(p, x, y, r, base = 0.4) {
        p.region(x - 1, y - 3, x + 1, y, (xx, yy) => p.tone(xx, yy, R.STEEL, 0.6));
        p.region(x - 6, y, x + 7, y + 28, (xx, yy) => {
            const dy = yy - y, half = dy < 3 ? 3 + dy * 1.5 : 7 - (dy > 22 ? 1 : 0);
            if (Math.abs(xx - x + 0.5) > half) return;
            let v = base + (xx > x + 2 ? 0.1 : 0) - (Math.abs(xx - x) < 1 ? 0.12 : 0) - (dy > 24 ? 0.06 : 0);
            if (dy === 0) v += 0.12;
            p.tone(xx, yy, r, v);
        });
    }
    function mug(p, x, yBase, r = R.LINEN) {
        p.region(x, yBase - 6, x + 5, yBase, (xx, y) => p.tone(xx, y, r, xx === x + 4 ? 0.62 : xx === x ? 0.24 : 0.42 + (y === yBase - 6 ? 0.14 : 0)));
        p.tone(x + 5, yBase - 5, r, 0.34); p.tone(x + 6, yBase - 4, r, 0.34); p.tone(x + 5, yBase - 3, r, 0.34);
    }
    function clipboard(p, x, y, w = 10, h = 14) {
        p.region(x, y, x + w, y + h, (xx, yy) => p.tone(xx, yy, R.PAPER, (yy - y) % 2 === 0 && yy > y + 2 && xx > x + 1 && xx < x + w - 2 - ((yy * 5) % 3) ? 0.32 : 0.5 + (xx === x + w - 1 ? 0.08 : 0)));
        p.region(x + 3, y - 1, x + w - 3, y + 1, (xx, yy) => p.tone(xx, yy, R.STEEL, 0.6));
    }

    // ── the decks ───────────────────────────────────────────────────────────────────────────────────────────────
    const ROOMS = A.ROOMS;
    // 1 · the bridge: a band of windows, the helm, the navigation desk, the commander's chair, the suit locker
    ROOMS[0] = (p, look) => {
        const fx = [], lights = [];
        overhead(p, 0, { tray: false });
        [[300, 388], [398, 486], [496, 584]].forEach(([a, b]) => fx.push(...pane(p, a, F - 152, b, F - 90)));
        p.region(296, F - 88, 590, F - 84, (x, y) => p.tone(x, y, R.STEEL, [0.56, 0.36, 0.22, 0.12][y - F + 88]));
        desk(p, 372, 470, { vent: true });
        p.region(430, F - DESK - 22, 468, F - DESK - 2, (x, y) => { if (x - 430 < (F - DESK - 2 - y) * 0.4) return; p.tone(x, y, R.STEEL, y === F - DESK - 22 + Math.round((x - 430) / 2) ? 0.4 : 0.22); });
        lights.push(monitor(p, 400, F - DESK, 9, 16, fx, 'helm'));
        for (let x = 378; x < 396; x += 3) fx.push({ kind: 'led', x, y: F - DESK - 1, color: x % 2 ? '#2fb6c0' : '#c4803a', period: 900 + x * 13 });
        desk(p, 500, 600);
        lights.push(monitor(p, 526, F - DESK, 14, 22, fx, 'chart'));
        // the commander's chair, facing the helm
        const cx = 226, s = F - SEAT;
        p.region(cx - 12, s, cx + 12, s + 4, (x, y) => p.tone(x, y, R.FABRIC, [0.6, 0.44, 0.3, 0.16][y - s]));
        p.region(cx - 16, s - 44, cx - 11, s + 2, (x, y) => { const tilt = Math.floor((s - y) / 11); if (x < cx - 16 - tilt + 1 || x > cx - 11 - tilt) return; p.tone(x, y, R.FABRIC, 0.26 + (x === cx - 11 - tilt ? 0.18 : 0) + (y < s - 36 ? 0.08 : 0)); });
        p.region(cx - 8, s - 10, cx + 10, s - 8, (x, y) => p.tone(x, y, R.STEEL, y === s - 10 ? 0.5 : 0.24));
        p.region(cx - 2, s + 4, cx + 3, F - 2, (x, y) => p.tone(x, y, R.STEEL, x === cx + 2 ? 0.42 : 0.22));
        p.region(cx - 10, F - 2, cx + 11, F, (x, y) => p.tone(x, y, R.STEEL, y === F - 2 ? 0.46 : 0.2));
        // the suit locker: a glass door, a helmet on the shelf, a suit hanging
        box(p, 126, F - 158, 178, F, R.STEEL, 0.2, { panel: 3 });
        p.region(132, F - 150, 172, F - 12, (x, y) => p.tone(x, y, R.WALL, 0.07));
        p.ellipse(152, F - 128, 10, 10, (x, y) => { const nx = (x - 152) / 10, ny = (y - F + 128) / 10; p.tone(x, y, R.LINEN, 0.24 + 0.5 * clamp01(nx * 0.6 - ny * 0.7 + 0.3)); });
        p.region(144, F - 124, 160, F - 120, (x, y) => p.tone(x, y, R.SCR, 0.25));
        p.region(132, F - 117, 172, F - 115, (x, y) => p.tone(x, y, R.STEEL, 0.5));
        p.region(140, F - 108, 164, F - 30, (x, y) => { const w = 12 - Math.abs(y - F + 70) * 0.04; if (Math.abs(x - 152) > w) return; p.tone(x, y, R.LINEN, 0.28 + (x > 152 ? 0.1 : 0) + ((y + 2) % 16 === 0 ? -0.08 : 0)); });
        p.region(171, F - 150, 172, F - 12, (x, y) => p.tone(x, y, R.STEEL, 0.4));
        fx.push({ kind: 'glint', x: 166, y: F - 140, r: 4 });
        // the computer's speaker above the nav desk: a grille and one slow light
        p.region(602, F - 134, 614, F - 118, (x, y) => p.tone(x, y, R.STEEL, (y % 2) ? 0.16 : 0.38));
        fx.push({ kind: 'aura', x: 608, y: F - 138 });
        p.region(380, F - DESK - 9, 386, F - DESK - 3, (x, y) => p.tone(x, y, R.LINEN, x === 385 ? 0.6 : 0.4)); p.tone(386, F - DESK - 7, R.LINEN, 0.36);
        dress(p, 0, { conduits: [[630, 24, F]], vents: [236, 470], ext: 188 }, fx);
        for (let x = 304; x < 582; x += 7) fx.push({ kind: 'led', x, y: F - 86, color: (x / 7) % 3 < 1 ? '#c4803a' : '#2fb6c0', period: 1700 + ((x * 37) % 900) });
        return { lamps: [{ x: 250 }, { x: 540, k: 0.85 }], fx, lights };
    };

    // 2 · the lab: a bench under shelves of jars, a microscope, Mira's monitor, the star map pinned to the wall, a fridge
    ROOMS[1] = (p, look) => {
        const fx = [], lights = [], gone = look.mira === 'gone';
        overhead(p, 1);
        fx.push(porthole(p, 290, F - 152));
        desk(p, 350, 582);
        shelf(p, 360, 572, 100, [['jar', 366, 9, 1], ['jar', 376, 12, 2], ['jar', 386, 8, 3], ['box', 400, 8], ['jar', 420, 11, 4], ['book', 440, 12], ['book', 444, 10], ['book', 448, 13], ['jar', 470, 10, 5], ['jar', 480, 7, 6], ['box', 500, 10], ['jar', 530, 12, 7], ['jar', 542, 9, 8], ['jar', 556, 11, 9]]);
        shelf(p, 380, 560, 132, [['box', 384, 9], ['box', 398, 12], ['jar', 420, 8, 11], ['jar', 432, 10, 12], ['book', 452, 13], ['book', 456, 12], ['book', 460, 11], ['book', 464, 13], ['jar', 492, 9, 13], ['box', 520, 10], ['jar', 540, 12, 14]]);
        const top = F - DESK - 3;
        for (let k = 0; k < 4; k++) jar(p, 362 + k * 9, top, 8 + (k % 2) * 3, 20 + k);
        p.region(404, top - 10, 426, top - 8, (x, y) => p.tone(x, y, R.STEEL, 0.44));                                   // a rack of test tubes
        for (let x = 406; x < 425; x += 3) p.region(x, top - 14, x + 1, top, (xx, y) => p.tone(xx, y, y > top - 6 ? R.TEAL : R.GLASS, y > top - 6 ? 0.5 : 0.6));
        // the microscope
        p.region(458, top - 3, 478, top, (x, y) => p.tone(x, y, R.STEEL, 0.3));
        p.region(470, top - 26, 474, top - 3, (x, y) => p.tone(x, y, R.STEEL, x === 473 ? 0.5 : 0.24));
        p.line(472, top - 26, 462, top - 34, (x, y) => { p.tone(x, y, R.STEEL, 0.46); p.tone(x, y + 1, R.STEEL, 0.22); });
        p.region(460, top - 37, 464, top - 33, (x, y) => p.tone(x, y, R.STEEL, 0.56));
        p.region(461, top - 14, 470, top - 12, (x, y) => p.tone(x, y, R.STEEL, 0.5));
        // Mira's desk lamp, her monitor (her experiment keeps running)
        p.line(394, top, 394, top - 20, (x, y) => p.tone(x, y, R.STEEL, 0.36));
        p.line(394, top - 20, 404, top - 30, (x, y) => p.tone(x, y, R.STEEL, 0.4));
        p.region(400, top - 33, 410, top - 29, (x, y) => p.tone(x, y, R.STEEL, y === top - 33 ? 0.5 : 0.26));
        if (!gone) { p.region(401, top - 29, 409, top - 28, (x, y) => p.hex(x, y, '#ffd28a')); }
        lights.push(monitor(p, 524, F - DESK, 16, 22, fx, 'spectrum'));
        if (gone) { p.region(430, top - 7, 438, top, (x, y) => p.tone(x, y, R.LINEN, x === 437 ? 0.5 : 0.36)); p.tone(438, top - 5, R.LINEN, 0.3); }   // a mug she left
        // the star map: the record's pulsar map, drawn on paper, pinned up
        const mx0 = 168, my0 = F - 132, mw = 64, mh = 58, mcx = mx0 + 22, mcy = my0 + 30;
        p.region(mx0, my0, mx0 + mw, my0 + mh, (x, y) => p.tone(x, y, R.PAPER, 0.5 - (y - my0) / mh * 0.12 + (fbm(x / 4, y / 4, 71) - 0.5) * 0.1 + (x === mx0 + mw - 1 || y === my0 + mh - 1 ? -0.2 : 0)));
        for (let k = 0; k < 14; k++) {
            const a = (k / 14) * Math.PI * 2 + 0.3, len = 9 + hash(k, 3, 7) * 17;
            p.line(mcx, mcy, mcx + Math.cos(a) * len, mcy + Math.sin(a) * len * 0.92, (x, y, t) => { if (t > 0.08) p.tone(x, y, R.PAPER, (Math.round(t * 20) % 3 === 0 && t > 0.3) ? 0.15 : 0.24); });
        }
        p.line(mcx, mcy, mx0 + mw - 4, mcy, (x, y) => p.tone(x, y, R.PAPER, 0.18));
        p.region(mcx - 1, mcy - 1, mcx + 1, mcy + 1, (x, y) => p.tone(x, y, R.PAPER, 0.08));
        [[mx0 + 2, my0 + 2], [mx0 + mw - 3, my0 + 2], [mx0 + 2, my0 + mh - 3], [mx0 + mw - 3, my0 + mh - 3]].forEach(([x, y]) => p.hex(x, y, '#c4803a'));
        // the sample fridge
        box(p, 598, F - 126, 642, F, R.MED, 0.36, { panel: 3, tex: 0.03 });
        p.region(604, F - 118, 636, F - 52, (x, y) => p.tone(x, y, R.ICE, 0.22 + ((y - F + 118) % 16 === 0 ? 0.3 : 0) + ((x * 7 + y) % 9 === 0 ? 0.14 : 0)));
        p.region(633, F - 100, 635, F - 70, (x, y) => p.tone(x, y, R.MED, 0.7));
        lights.push(lamp(620, F - 84, { reach: 18, k: 0.5, tint: ICE_T, up: 1 }));
        fx.push({ kind: 'led', x: 606, y: F - 46, color: '#5ff2cf', period: 2400 });
        stool(p, 296);
        dress(p, 1, { conduits: [[246, 24, F]], vents: [420] }, fx);
        duct(p, 500, 528, F - 146);
        p.ellipse(560, F - 156, 7, 7, (x, y, q) => p.tone(x, y, R.LINEN, q > 0.7 ? 0.24 : 0.5));
        p.line(560, F - 156, 560, F - 161, (x, y) => p.tone(x, y, R.STEEL, 0.1)); p.line(560, F - 156, 564, F - 155, (x, y) => p.tone(x, y, R.STEEL, 0.1));
        placard(p, 330, F - 118, 14, 9);
        jacket(p, 150, 62, R.LINEN, 0.5);                                                           // Mira's lab coat by the door
        clipboard(p, 318, 96);
        return { lamps: [{ x: 270, k: 0.9 }, { x: 470, off: gone }], fx, lights };
    };

    // 3 · quarters: two bunks (five berths, each with its owner's blanket), the galley counter, the table they eat at
    ROOMS[2] = (p, look) => {
        const fx = [], lights = [], gone = look.mira === 'gone';
        overhead(p, 2);
        fx.push(porthole(p, 330, F - 152));
        dress(p, 2, { conduits: [[312, 24, F - 104]], vents: [470], ext: null }, fx);
        bunk(p, 122, 230, [{ h: SEAT, state: 'rumpled', who: 'aris', things: [arisThings] }, { h: 72, state: 'made', who: 'cora' }], -1, fx, lights);
        const photo = (pp, y) => {                                                                 // Jaxon's photo of his daughter
            const x0 = 612, y0 = y - 26;
            pp.region(x0, y0, x0 + 11, y0 + 13, (x, yy) => pp.tone(x, yy, R.LINEN, 0.74));
            pp.region(x0 + 1, y0 + 1, x0 + 10, y0 + 10, (x, yy) => pp.tone(x, yy, R.DUST, 0.4 + (yy - y0) * 0.04));
            pp.region(x0 + 4, y0 + 3, x0 + 7, y0 + 6, (x, yy) => pp.hex(x, yy, '#d8a07a'));
            pp.region(x0 + 3, y0 + 2, x0 + 8, y0 + 4, (x, yy) => { if (yy === y0 + 2 || x === x0 + 3) pp.hex(x, yy, '#4a2e1a'); });
            pp.region(x0 + 3, y0 + 6, x0 + 8, y0 + 10, (x, yy) => pp.hex(x, yy, '#c4803a'));
        };
        const miraThings = (pp, y) => {                                                            // her scarf and tablet, left on the bunk
            pp.region(584, y - 4, 600, y - 1, (x, yy) => pp.tone(x, yy, R.TEAL, 0.52 + (yy === y - 4 ? 0.2 : 0) - ((x + yy) % 4 === 0 ? 0.14 : 0)));
            pp.region(562, y - 2, 576, y, (x, yy) => pp.tone(x, yy, R.STEEL, yy === y - 2 ? 0.56 : 0.2));
            pp.region(564, y - 2, 574, y - 1, (x, yy) => pp.tone(x, yy, R.SCR, 0.3));
        };
        const vanceThings = (pp, y) => { pp.region(560, y - 24, 572, y - 14, (x, yy) => pp.tone(x, yy, R.PAPER, 0.3 + ((yy - y) % 3 === 0 ? 0.12 : 0))); };   // a printed list, pinned up
        bunk(p, 532, 642, [{ h: SEAT, state: gone ? 'made' : 'rumpled', light: !gone, who: 'mira', things: gone ? [miraThings] : [] },
            { h: 72, state: 'rumpled', who: 'vance', things: [vanceThings] }, { h: 122, state: 'made', who: 'jaxon', things: [photo] }], 1, fx, lights);
        // the galley counter: tiles behind it, two hot plates, a kettle, a rail of utensils, cupboards above
        p.region(238, F - 100, 300, F - 58, (x, y) => p.tone(x, y, R.LINEN, ((x - 238) % 6 === 0 || (y - F) % 6 === 0) ? 0.1 : 0.19));
        desk(p, 236, 302);
        const top = F - DESK - 3;
        for (const hx of [244, 262]) { p.region(hx, top - 1, hx + 13, top + 1, (x, y) => p.tone(x, y, R.STEEL, y === top - 1 ? 0.16 : 0.06)); fx.push({ kind: 'hob', x: hx, y: top - 1, w: 13, when: 'meal' }); }
        p.region(284, top - 11, 297, top - 1, (x, y) => { if ((x === 284 || x === 296) && y === top - 11) return; p.tone(x, y, R.STEEL, x === 295 ? 0.66 : x === 284 ? 0.24 : 0.38 + (y === top - 11 ? 0.18 : 0)); });
        p.region(280, top - 8, 284, top - 7, (x, y) => p.tone(x, y, R.STEEL, 0.44));
        p.region(287, top - 13, 294, top - 11, (x, y) => p.tone(x, y, R.STEEL, 0.5));
        fx.push({ kind: 'steam', x: 281, y: top - 10, when: 'meal' });
        p.region(240, F - 104, 300, F - 102, (x, y) => p.tone(x, y, R.STEEL, y === F - 104 ? 0.56 : 0.24));
        [[246, 14, 'ladle'], [256, 11, 'spat'], [268, 9, 'pan'], [286, 12, 'ladle']].forEach(([ux, len, kind]) => {
            p.region(ux, F - 102, ux + 1, F - 102 + len, (x, y) => p.tone(x, y, R.STEEL, 0.6));
            if (kind === 'ladle') p.region(ux - 2, F - 102 + len, ux + 3, F - 99 + len, (x, y) => p.tone(x, y, R.STEEL, x === ux + 2 ? 0.66 : 0.4));
            if (kind === 'spat') p.region(ux - 1, F - 102 + len, ux + 2, F - 97 + len, (x, y) => p.tone(x, y, R.STEEL, 0.5));
            if (kind === 'pan') p.region(ux - 6, F - 102 + len, ux + 7, F - 97 + len, (x, y) => p.tone(x, y, R.STEEL, y === F - 102 + len ? 0.6 : x > ux + 4 ? 0.42 : 0.26));
        });
        box(p, 236, F - 152, 302, F - 112, R.STEEL, 0.26, { panel: 2 });
        p.region(268, F - 152, 270, F - 112, (x, y) => p.tone(x, y, R.STEEL, 0.1));
        for (const hx of [262, 274]) p.region(hx, F - 124, hx + 2, F - 118, (x, y) => p.tone(x, y, R.STEEL, 0.62));
        p.region(238, F - 111, 300, F - 109, (x, y) => p.tone(x, y, R.STEEL, 0.06));
        // the table: higher than the stools, a top seen from above, two legs; bowls set out for five, a jug, cups
        const tt = F - 42, t0 = 350, t1 = 460;
        topSurface(p, t0, t1, tt, 3, R.STEEL, 0.34);
        p.region(t0, tt, t1, tt + 4, (x, y) => p.tone(x, y, R.STEEL, [0.66, 0.46, 0.3, 0.16][y - tt] + (x === t1 - 1 ? 0.08 : 0)));
        for (const lx of [t0 + 10, t1 - 13]) p.region(lx, tt + 4, lx + 3, F, (x, y) => p.tone(x, y, R.STEEL, [0.18, 0.4, 0.22][x - lx]));
        p.region(t0 + 10, F - 14, t1 - 10, F - 12, (x, y) => p.tone(x, y, R.STEEL, y === F - 14 ? 0.36 : 0.16));
        [362, 384, 405, 426, 448].forEach((bx, k) => {
            p.region(bx - 4, tt - 6, bx + 5, tt - 2, (x, y) => { const w = y === tt - 6 ? 4 : y === tt - 3 ? 3 : 4; if (Math.abs(x - bx) > w) return; p.tone(x, y, R.LINEN, y === tt - 6 ? 0.74 : 0.5 + (x > bx ? 0.1 : 0) - (y === tt - 3 ? 0.1 : 0)); });
            p.region(bx - 3, tt - 7, bx + 4, tt - 6, (x, y) => p.tone(x, y, R.FOOD, k === 2 && gone ? 0.78 : 0.6 + ((x + k) % 3 === 0 ? 0.12 : 0)));
        });
        p.region(394, tt - 12, 400, tt - 2, (x, y) => { if (y === tt - 12 && (x === 394 || x === 399)) return; p.tone(x, y, R.GLASS, x === 398 ? 0.8 : 0.42 + (y > tt - 6 ? 0.12 : 0)); });
        for (const cx of [373, 437]) p.region(cx, tt - 7, cx + 4, tt - 2, (x, y) => p.tone(x, y, R.STEEL, x === cx + 3 ? 0.6 : 0.4));
        fx.push({ kind: 'steam', x: 384, y: tt - 9, when: 'meal' }, { kind: 'steam', x: 426, y: tt - 9, when: 'meal' });
        [300, 330, 480, 510].forEach(c => stool(p, c));
        line(p, 336, 520, 150, 7, [[352, 16, 22, R.LINEN, 0.32], [388, 12, 15, A.BLANKETS.jaxon, 0.4], [452, 18, 12, R.TEAL, 0.3], [486, 10, 18, A.BLANKETS.aris, 0.38]]);
        placard(p, 200, F - 150, 16, 10, R.PAPER);
        return { lamps: [{ x: 405, low: 82, reach: 62, k: 1.1 }, { x: 180, k: 0.5 }, { x: 590, k: gone ? 0.3 : 0.5 }], fx, lights };
    };
    function arisThings(p, y) {                                                                     // a notebook by her pillow: her list of the dead
        p.region(214, y - 3, 225, y, (x, yy) => p.tone(x, yy, R.PAPER, yy === y - 3 ? 0.56 : 0.34));
        p.region(214, y - 3, 216, y, (x, yy) => p.tone(x, yy, R.WOOL, 0.4));
    }

    // 4 · the med bay: a terminal, glass cabinets, the bed under its lamp, a drip stand; a stretcher when someone is hurt
    ROOMS[3] = (p, look) => {
        const fx = [], lights = [];
        overhead(p, 3);
        fx.push(porthole(p, 186, F - 150));
        dress(p, 3, { conduits: [[474, 24, F]], vents: [250] }, fx);
        desk(p, 250, 294);
        lights.push(monitor(p, 262, F - DESK, 14, 18, fx, look.stretcher ? 'ecg' : 'vitals'));
        box(p, 304, F - 152, 452, F - 92, R.MED, 0.32, { panel: 2, tex: 0.03 });
        for (const dx of [304, 341, 378, 415]) {
            p.region(dx + 4, F - 146, dx + 33, F - 98, (x, y) => p.tone(x, y, R.WALL, 0.12));
            for (const sh of [F - 124]) p.region(dx + 4, sh, dx + 33, sh + 2, (x, y) => p.tone(x, y, R.MED, y === sh ? 0.5 : 0.3));
            for (let k = 0; k < 4; k++) { const bx = dx + 6 + k * 7, bh = 5 + (hash(dx, k, 2) * 6 | 0); p.region(bx, F - 124 - bh, bx + 5, F - 124, (x, y) => p.tone(x, y, k % 2 ? R.MED : R.LINEN, 0.42 + (x === bx + 4 ? 0.12 : 0))); }
            for (let k = 0; k < 3; k++) { const bx = dx + 7 + k * 9; p.region(bx, F - 106, bx + 6, F - 98, (x, y) => p.tone(x, y, R.GLASS, x === bx + 4 ? 0.7 : 0.4)); }
            fx.push({ kind: 'glint', x: dx + 28, y: F - 140, r: 4 });
        }
        p.region(372, F - 166, 379, F - 159, (x, y) => { if (Math.abs(x - 375) <= 1 || Math.abs(y - F + 163) <= 1) p.tone(x, y, R.TEAL, 0.55); });   // the medical cross, in teal
        // the bed: white sheets on a raised frame, the head end up a little, a lamp on an arm overhead
        const bt = F - 40;
        p.region(484, bt + 5, 594, bt + 9, (x, y) => p.tone(x, y, R.MED, [0.5, 0.36, 0.26, 0.16][y - bt - 5]));
        p.region(534, bt + 9, 546, F - 4, (x, y) => p.tone(x, y, R.MED, x === 545 ? 0.42 : 0.22));
        p.region(510, F - 4, 570, F, (x, y) => p.tone(x, y, R.MED, y === F - 4 ? 0.46 : 0.2));
        p.region(484, bt, 594, bt + 5, (x, y) => { const lift = x > 570 ? Math.round((x - 570) / 6) : 0; if (y < bt - lift) return; p.tone(x, y, R.LINEN, y === bt ? 0.74 : 0.56 - (y - bt) * 0.06); });
        for (let x = 570; x < 594; x++) { const lift = Math.round((x - 570) / 6); for (let y = bt - lift; y < bt; y++) p.tone(x, y, R.LINEN, 0.7); }
        p.region(574, bt - 9, 592, bt - 4, (x, y) => p.tone(x, y, R.LINEN, 0.8 - (y - bt + 9) * 0.05));
        p.region(492, bt - 6, 562, bt - 4, (x, y) => p.tone(x, y, R.STEEL, y === bt - 6 ? 0.56 : 0.3));
        p.region(492, bt - 6, 494, bt, (x, y) => p.tone(x, y, R.STEEL, 0.36));
        const lampX = 524;                                                                          // the bed lamp on its arm, over the bed
        p.region(538, 22, 541, F - 132, (x, y) => p.tone(x, y, R.MED, x === 540 ? 0.46 : 0.26));
        p.line(540, F - 132, lampX + 14, F - 106, (x, y) => { p.tone(x, y, R.MED, 0.42); p.tone(x, y + 1, R.MED, 0.2); });
        p.region(lampX - 14, F - 106, lampX + 14, F - 100, (x, y) => p.tone(x, y, R.MED, y === F - 106 ? 0.64 : 0.36));
        p.region(lampX - 12, F - 100, lampX + 12, F - 98, (x, y) => p.tone(x, y, look.stretcher ? R.LINEN : R.MED, look.stretcher ? 0.86 : 0.2));
        p.region(476, 40, 600, 42, (x, y) => p.tone(x, y, R.STEEL, y === 40 ? 0.5 : 0.24));
        p.region(586, 42, 600, F - 70, (x, y) => p.tone(x, y, R.LINEN, 0.3 + ((x - 586) % 3 === 0 ? -0.1 : 0.04) + (y > F - 76 ? -0.08 : 0)));
        for (const ox of [624, 632]) { p.region(ox, F - 48, ox + 6, F, (x, y) => p.tone(x, y, R.TEAL, x === ox + 4 ? 0.62 : x === ox ? 0.2 : 0.38)); p.region(ox + 1, F - 52, ox + 5, F - 48, (x, y) => p.tone(x, y, R.STEEL, 0.5)); }
        placard(p, 216, F - 132, 18, 12);
        // the drip stand
        p.region(606, F - 134, 608, F - 2, (x, y) => p.tone(x, y, R.STEEL, x === 607 ? 0.5 : 0.3));
        p.region(598, F - 2, 617, F, (x, y) => p.tone(x, y, R.STEEL, 0.36));
        p.region(600, F - 134, 614, F - 132, (x, y) => p.tone(x, y, R.STEEL, 0.46));
        p.region(608, F - 130, 616, F - 116, (x, y) => p.tone(x, y, R.ICE, x === 614 ? 0.6 : 0.36));
        p.line(612, F - 116, 590, F - 46, (x, y) => p.tone(x, y, R.ICE, 0.2));
        if (look.stretcher) {                                                                        // someone on the bed: the kit open on the floor, the folded stretcher
            box(p, 456, F - 9, 478, F, R.MED, 0.42, { tex: 0.02 });
            p.region(456, F - 16, 458, F - 9, (x, y) => p.tone(x, y, R.MED, 0.5));
            p.region(460, F - 6, 474, F - 4, (x, y) => p.tone(x, y, R.TEAL, 0.5));
            p.region(612, F - 8, 640, F, (x, y) => p.tone(x, y, R.LINEN, y === F - 8 ? 0.6 : 0.38 - ((x + y) % 5 === 0 ? 0.08 : 0)));   // bandage rolls, a basin
            p.region(330, F - 70, 336, F, (x, y) => p.tone(x, y, R.FABRIC, 0.26 + (x === 335 ? 0.12 : 0)));                          // the stretcher, folded, against the cabinets
            lights.push(lamp(lampX, F - 96, { reach: 46, k: 0.9, tint: [1, 0.96, 0.88], up: 0.1 }));
        } else {
            p.region(458, F - 74, 470, F, (x, y) => { const lean = Math.floor((F - y) / 18); if (x < 458 + lean || x > 468 + lean) return; p.tone(x, y, R.FABRIC, 0.26 + (x === 468 + lean ? 0.14 : 0)); });
        }
        if (look.waiting) {                                                                          // a box to sit on by the shut hatch, a meal left on the lid
            box(p, 134, F - SEAT, 158, F, R.MED, 0.3, { panel: 2 });
            topSurface(p, 134, 158, F - SEAT, 2, R.MED, 0.36);
            p.region(88, F - 3, 97, F, (x, y) => { if (Math.abs(x - 92) > (y === F - 3 ? 4 : 3)) return; p.tone(x, y, R.LINEN, y === F - 3 ? 0.66 : 0.44); });
            p.region(89, F - 4, 96, F - 3, (x, y) => p.tone(x, y, R.FOOD, 0.4));
        }
        box(p, 248, 62, 298, 92, R.MED, 0.3, { panel: 2, tex: 0.03 });                                      // a wall cabinet over the terminal
        p.region(272, 62, 274, 92, (x, y) => p.tone(x, y, R.MED, 0.14));
        clipboard(p, 468, 98);                                                                      // the patient chart
        if (!look.stretcher) {                                                                      // a blanket folded at the foot of the bed
            p.region(488, F - 46, 512, F - 40, (x, y) => p.tone(x, y, R.WOOL, y === F - 46 ? 0.7 : (y - F + 46) % 2 ? 0.44 : 0.54));
        } else mug(p, 252, F - DESK - 3, R.MED);
        return { lamps: [{ x: 360 }, { x: 590, k: 0.85 }], fx, lights };
    };

    // 5 · the hold: crate stacks, a net, the gantry hook; sleepers in pods, or Vance alone with the lights off
    ROOMS[4] = (p, look) => {
        const fx = [], lights = [];
        overhead(p, 4, { tray: false });
        fx.push(porthole(p, 290, F - 152));
        dress(p, 4, { conduits: [[262, 24, F - 60]], vents: [600] }, fx);
        crate(p, 160, F - 32, 206, F, 1); crate(p, 206, F - 28, 252, F, 2); crate(p, 168, F - 58, 214, F - 32, 3);
        p.region(500, F - 160, 642, F - 92, (x, y) => { if ((x + y) % 9 === 0 || (x - y + 900) % 9 === 0) p.tone(x, y, R.STEEL, 0.28 + ((x + y) % 18 === 0 ? 0.08 : 0)); });
        crate(p, 520, F - 36, 580, F, 4); crate(p, 580, F - 40, 642, F, 5); crate(p, 528, F - 66, 588, F - 36, 6); crate(p, 586, F - 72, 638, F - 40, 7); crate(p, 540, F - 92, 596, F - 66, 8);
        for (let x = 523; x < 640; x += 1) if (x % 40 === 3) p.region(x, F - 92, x + 2, F, (xx, y) => p.tone(xx, y, R.AMBER, 0.2 + (xx === x + 1 ? 0.06 : 0)));
        p.region(140, 30, 624, 34, (x, y) => p.tone(x, y, R.STEEL, [0.5, 0.34, 0.24, 0.1][y - 30]));
        p.region(394, 34, 408, 40, (x, y) => p.tone(x, y, R.STEEL, 0.36 + (x === 407 ? 0.12 : 0)));
        for (let y = 40; y < F - 128; y += 3) p.region(400, y, 402, y + 2, (x, yy) => p.tone(x, yy, R.STEEL, 0.42));
        p.region(396, F - 128, 406, F - 124, (x, y) => p.tone(x, y, R.STEEL, 0.5));
        p.line(401, F - 124, 401, F - 116, (x, y) => p.tone(x, y, R.STEEL, 0.6)); p.line(401, F - 116, 396, F - 112, (x, y) => p.tone(x, y, R.STEEL, 0.6));
        for (const sx of [180, 214, 610]) { for (let y = 34; y < 34 + 40 + (sx % 3) * 8; y++) p.tone(sx + (y > 60 ? 1 : 0), y, R.AMBER, 0.24 + (y % 7 === 0 ? 0.08 : 0)); p.region(sx - 1, 34 + 40 + (sx % 3) * 8, sx + 3, 37 + 40 + (sx % 3) * 8, (x, y) => p.tone(x, y, R.STEEL, 0.5)); }
        placard(p, 300, F - 120, 18, 12, R.AMBER);
        // the cargo terminal by the ladder
        desk(p, 152, 188);
        lights.push(monitor(p, 166, F - DESK, 8, 10, fx, 'text'));
        if (look.pods) {
            [330, 378, 426, 474].forEach((cx, k) => pod(p, cx, k, fx, lights));
            crate(p, 112 + 10, F - 22, 156, F, 9, { label: false });
        } else {
            crate(p, 330, F - SEAT, 366, F, 10);
            p.region(420, F - 18, 484, F, (x, y) => p.tone(x, y, R.WOOL, 0.22 + ((x + y * 3) % 7 === 0 ? 0.1 : 0) + (y === F - 18 ? 0.12 : 0) - (y > F - 4 ? 0.1 : 0)));
            p.region(418, F - 3, 486, F, (x, y) => p.tone(x, y, R.CRATE, 0.3));
            for (const sx of [436, 466]) p.region(sx, F - 18, sx + 2, F - 3, (x, y) => p.tone(x, y, R.AMBER, 0.24));
        }
        if (look.dark) {
            p.region(198, 24, 206, 30, (x, y) => p.hex(x, y, y === 24 ? '#3a1210' : '#8a2a22'));
            p.region(200, 26, 204, 28, (x, y) => p.hex(x, y, '#e2574c'));
            fx.push({ kind: 'emergency', x: 202, y: 27 });
            lights.push(lamp(202, 30, { reach: 70, k: 0.75, tint: [1, 0.28, 0.22], up: 0.5 }));
        }
        jacket(p, 138, 60, R.FABRIC, 0.36);                                                         // Vance's jacket on the hook by the ladder
        shelf(p, 166, 252, 122, [['box', 170, 8], ['box', 186, 11], ['jar', 210, 9, 3], ['box', 226, 7]]);
        return { lamps: [{ x: 250, off: !!look.dark }, { x: 480, off: !!look.dark }], fx, lights };
    };
    /** A sleeper's pod standing upright: a frosted window with a face behind it, cold light, a cable to the ceiling. */
    function pod(p, cx, k, fx, lights) {
        const w = 18, top = F - 112;
        p.region(cx - w, top, cx + w + 1, F, (x, y) => {
            const dx = (x + 0.5 - cx) / w, ry = y < top + 12 ? (y - top) / 12 : y > F - 10 ? (F - y) / 10 : 1;
            if (Math.abs(dx) > Math.sqrt(Math.max(0, 1 - (1 - ry) ** 2))) return;
            p.tone(x, y, R.MED, 0.2 + 0.36 * clamp01(dx * 0.6 + 0.5) - (y > F - 22 ? 0.08 : 0));
        });
        p.region(cx - 11, F - 98, cx + 12, F - 30, (x, y) => {
            const fy = (y - F + 98) / 68, frost = fbm(x / 3, y / 3, 80 + k) * 0.4;
            let v = 0.3 + 0.25 * (1 - Math.abs(x - cx) / 12) + frost - fy * 0.1;
            const face = Math.hypot((x - cx - 1) / 5, (y - F + 86) / 6.5);
            if (face < 1) v = 0.78 - face * 0.2 + ((y === F - 87 && Math.abs(x - cx - 1) > 1 && Math.abs(x - cx - 1) < 4) ? -0.4 : 0);
            if (y > F - 78 && y < F - 40 && Math.abs(x - cx) < 7 - (y > F - 50 ? 2 : 0)) v = Math.max(v, 0.52 + frost * 0.5);
            p.tone(x, y, R.ICE, v);
        });
        p.region(cx - 6, F - 24, cx + 7, F - 18, (x, y) => p.tone(x, y, R.STEEL, 0.2));
        fx.push({ kind: 'led', x: cx - 3, y: F - 21, color: '#5ff2cf', period: 1500 + k * 170 }, { kind: 'led', x: cx + 2, y: F - 21, color: '#c4803a', period: 4100 + k * 230 }, { kind: 'pod', x: cx, y: F - 64, k });
        for (let y = 22; y < top; y++) { p.tone(cx - 3 + (y % 23 === 0 ? 1 : 0), y, R.STEEL, 0.26); p.tone(cx + 2, y, R.STEEL, 0.18); }
        lights.push(lamp(cx, F - 64, { reach: 26, k: 0.75, tint: ICE_T, up: 1 }));
    }

    // 6 · engineering: the reactor (ship-reactor.js paints it and draws its light), the control desk, the tool wall, pipes
    ROOMS[5] = (p, look) => {
        const fx = [], lights = [];
        overhead(p, 5, { tray: false });
        fx.push(porthole(p, 330, F - 148));
        dress(p, 5, { vents: [300] }, fx);
        for (const hy of [F - 164, F - 156]) p.region(300, hy, 642, hy + 4, (x, y) => p.tone(x, y, R.STEEL, [0.18, 0.4, 0.3, 0.14][y - hy]));
        for (const vx of [578, 612]) {
            p.region(vx, 22, vx + 5, F, (x, y) => p.tone(x, y, R.STEEL, [0.16, 0.3, 0.44, 0.3, 0.14][x - vx]));
            p.ellipse(vx + 2.5, F - 110, 6, 6, (x, y, q) => p.tone(x, y, R.STEEL, q > 0.55 ? 0.5 : q > 0.3 ? 0.12 : 0.62));
        }
        const RX = A.reactor;                                                                         // ship-reactor.js: the heart of the ship
        if (RX) { RX.paint(p); fx.push(RX.fx()); }
        duct(p, 356, 384, F - 150);
        p.region(560, 30, 564, 36, (x, y) => p.tone(x, y, R.STEEL, 0.5));
        for (let y = 36; y < F - 120; y += 3) p.region(561, y, 563, y + 2, (x, yy) => p.tone(x, yy, R.STEEL, 0.4));
        p.region(556, F - 120, 568, F - 112, (x, y) => p.tone(x, y, R.STEEL, y === F - 120 ? 0.56 : 0.3));
        p.region(400, F - 6, 528, F, (x, y) => p.tone(x, y, ((x - y) >> 2) % 2 ? R.AMBER : R.STEEL, ((x - y) >> 2) % 2 ? 0.36 : 0.12));
        // the control desk
        desk(p, 240, 294, { vent: true });
        lights.push(monitor(p, 254, F - DESK, 12, 18, fx, 'graph'));
        lights.push(monitor(p, 274, F - DESK, 10, 12, fx, 'text'));
        // the tool wall
        p.region(136, F - 146, 198, F - 76, (x, y) => p.tone(x, y, R.STEEL, 0.2 + (((x - 136) % 4 === 2 && (y - F) % 4 === 0) ? -0.12 : 0) + (x === 197 ? 0.1 : 0)));
        [[142, 20], [150, 26], [158, 18], [170, 24], [180, 22], [188, 16]].forEach(([tx, len], k) => {
            const y0 = F - 140;
            p.region(tx, y0, tx + 2, y0 + len, (x, y) => p.tone(x, y, R.STEEL, x === tx + 1 ? 0.7 : 0.46));
            p.region(tx - 1, y0, tx + 3, y0 + 3, (x, y) => { if (k % 2 && y === y0 + 1 && x === tx) return; p.tone(x, y, R.STEEL, 0.6); });
        });
        p.region(144, F - 108, 192, F - 96, (x, y) => p.tone(x, y, R.CRATE, 0.3 + (y === F - 108 ? 0.2 : 0)));
        box(p, 200, F - 12, 226, F, R.RED, 0.34, { tex: 0.03 });
        p.region(206, F - 15, 220, F - 12, (x, y) => { if (y === F - 15 || x === 206 || x === 219) p.tone(x, y, R.STEEL, 0.5); });
        mug(p, 243, F - DESK - 3);                                                                  // Jaxon's mug, his jacket, his notes
        jacket(p, 222, 64, R.WOOL, 0.42);
        clipboard(p, 300, 78);
        return { lamps: [{ x: 200, k: 0.9 }, { x: 610, k: 0.8 }], fx, lights, glow: RX ? RX.glow : null };
    };

    // ── where people go ─────────────────────────────────────────────────────────────────────────────────────────
    A.SPOTS = Object.freeze({
        helm: { deck: 0, x: 360, facing: 1 }, window: { deck: 0, x: 470, facing: 1 }, chair: { deck: 0, x: 230, facing: 1 },
        bench: { deck: 1, x: 338, facing: 1 }, map: { deck: 1, x: 262, facing: -1 }, labStool: { deck: 1, x: 300, facing: 1 }, labDoor: { deck: 1, x: 330, facing: 1 },
        counter: { deck: 2, x: 222, facing: 1 }, counterStand: { deck: 2, x: 314, facing: -1 },
        seatL2: { deck: 2, x: 304, facing: 1 }, seatL1: { deck: 2, x: 334, facing: 1 }, seatR1: { deck: 2, x: 476, facing: -1 }, seatR2: { deck: 2, x: 506, facing: -1 },
        bedAris: { deck: 2, x: 176, facing: 1, h: SEAT }, bedCora: { deck: 2, x: 176, facing: 1, h: 72 },
        bedMira: { deck: 2, x: 588, facing: -1, h: SEAT }, bedVance: { deck: 2, x: 588, facing: -1, h: 72 }, bedJaxon: { deck: 2, x: 588, facing: -1, h: 122 },
        miraBunkEdge: { deck: 2, x: 552, facing: -1 },
        medTerminal: { deck: 3, x: 238, facing: 1 }, medCabinet: { deck: 3, x: 402, facing: 1 }, medBedside: { deck: 3, x: 474, facing: 1 }, medWatch: { deck: 3, x: 436, facing: 1 },
        hatchWait: { deck: 3, x: 140, facing: -1 }, hatchKneel: { deck: 3, x: 116, facing: -1 }, medDoor: { deck: 3, x: 226, facing: -1 },
        patient: { deck: 3, x: 530, facing: -1, h: 40 }, arisBedside: { deck: 3, x: 506, facing: 1 },
        holdPanel: { deck: 4, x: 140, facing: 1 }, holdMid: { deck: 4, x: 300, facing: 1 }, holdMidBack: { deck: 4, x: 300, facing: -1 }, holdStackB: { deck: 4, x: 492, facing: 1 },
        holdSeat: { deck: 4, x: 344, facing: -1 }, holdWall: { deck: 4, x: 500, facing: 1 }, holdPick: { deck: 4, x: 290, facing: 1 }, holdDrop: { deck: 4, x: 470, facing: 1 },
        podsLook: { deck: 4, x: 262, facing: 1 }, podPanel: { deck: 4, x: 498, facing: -1 }, podsBack: { deck: 4, x: 520, facing: -1 }, crateFrom: { deck: 4, x: 300, facing: -1 }, crateTo: { deck: 4, x: 150, facing: -1 },
        engDesk: { deck: 5, x: 228, facing: 1 }, gauges: { deck: 5, x: 380, facing: 1 }, engPipes: { deck: 5, x: 560, facing: 1 },
    });
})(typeof window !== 'undefined' ? window : globalThis);
