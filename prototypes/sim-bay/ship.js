/* ship.js — EXODUS-9 as the main screen draws it (src/systems/ShipCutaway.js), for the Sim Bay sketches.
   A vertical cross-section, nose up: BRIDGE, LABORATORY, CREW QUARTERS, CARGO HOLD, ENGINEERING, FABRICATION,
   engine bells under the stern. Same hull ramp, same 5×9 crew figures, same role colours, same rooms per role.

   const L = Lab.ship.layout(x, top, width, height)   → rooms with pixel bounds, halfWidth(y), roomAt(x, y)
   Lab.ship.draw(ctx, L, t, { damaged: { cargo: true }, dim: { lab: 0.5 }, labels: true })
   Lab.ship.figure(ctx, feetX, feetY, Lab.ship.CREW.aris.color, isStepping, isLying)
   Lab.ship.CREW  → { you, jaxon, aris, vance, mira } with name, role, color and station room */

(function () {
    'use strict';
    const Lab = window.Lab;
    if (!Lab) return;

    const ROOMS = [
        { key: 'bridge', label: 'BRIDGE' }, { key: 'lab', label: 'LABORATORY' }, { key: 'quarters', label: 'CREW QUARTERS' },
        { key: 'cargo', label: 'CARGO HOLD' }, { key: 'engineering', label: 'ENGINEERING' }, { key: 'upgrades', label: 'FABRICATION' },
    ];
    const HULL_RAMP = ['#06070a', '#0d1a15', '#1b3329', '#2f5a48', '#74d99a', '#d6ffe4'];
    const RED_RAMP = ['#06070a', '#1a0b0a', '#3a1512', '#6e241d', '#d85a4e', '#ffd0c8'];
    const LAMP = '#e8aa54', SKIN = '#e8d8c0';
    const CREW = {
        you: { name: 'You', role: 'COMMANDER', color: '#ffffff', station: 'bridge' },
        aris: { name: 'Aris', role: 'DOCTOR', color: '#40c8ff', station: 'lab' },
        mira: { name: 'Mira', role: 'SCIENTIST', color: '#d070ff', station: 'lab' },
        vance: { name: 'Vance', role: 'SECURITY', color: '#ff5050', station: 'cargo' },
        jaxon: { name: 'Jaxon', role: 'ENGINEER', color: '#f0a030', station: 'engineering' },
    };
    const FIGURE = ['.###.', '.###.', '..#..', '#####', '#####', '.###.', '.###.', '.#.#.', '.#.#.'];
    const FIGURE_STEP = ['.###.', '.###.', '..#..', '#####', '#####', '.###.', '.###.', '..##.', '.#...'];
    const ENGINE_H = 9;

    /** Rooms stacked down the given box; the bridge is taller because the nose rounds off inside it. */
    function layout(x, top, width, height) {
        const body = height - ENGINE_H, bridgeH = Math.round(body * 0.2), rest = (body - bridgeH) / (ROOMS.length - 1);
        let y = top;
        const rooms = ROOMS.map((r, i) => {
            const h = i === 0 ? bridgeH : Math.round(rest);
            const room = { ...r, top: Math.round(y), bottom: Math.round(y + h) };
            y += h;
            return room;
        });
        rooms[rooms.length - 1].bottom = top + body;
        const cx = x + width / 2, maxHalf = width / 2 - 2;
        const L = { x, top, width, height, cx, maxHalf, rooms, cache: null, cacheKey: '' };
        L.halfWidth = yy => halfWidth(L, yy);
        L.roomAt = (px, py) => rooms.find(r => py >= r.top && py < r.bottom && Math.abs(px - cx) <= halfWidth(L, py)) || null;
        L.room = key => rooms.find(r => r.key === key);
        /** A standing spot on a room's floor: slot 0..1 across the room. */
        L.floor = (key, slot = 0.5) => {
            const r = L.room(key), hw = halfWidth(L, r.bottom - 3);
            return { x: Math.round(cx - hw + 4 + slot * (hw * 2 - 8)), y: r.bottom - 2 };
        };
        return L;
    }

    function halfWidth(L, y) {
        const nose = L.rooms[0], stern = L.rooms[L.rooms.length - 1];
        if (y < nose.top || y >= stern.bottom) return 0;
        if (y < nose.bottom) return L.maxHalf * (0.3 + 0.7 * Math.sin(((y - nose.top) / (nose.bottom - nose.top)) * Math.PI / 2));
        if (y >= stern.top) return L.maxHalf * (1 - 0.22 * ((y - stern.top) / (stern.bottom - stern.top)));
        return L.maxHalf;
    }

    /** Pick a ramp colour for tone g (0..1) at pixel (x, y), dithering between the two nearest stops. */
    function rampAt(ramp, g, x, y) {
        const top = ramp.length - 1, pos = Lab.clamp(g, 0, 1) * top, lo = Math.floor(pos);
        return ramp[Math.min(top, (pos - lo) > Lab.bayer(x, y) ? lo + 1 : lo)];
    }

    // what furniture sits where, as a tone (or null for bare room)
    const PROPS = {
        bridge(lx, ly, rw, rh) {
            if (ly >= rh - 7 && ly < rh - 3 && lx > rw * 0.2 && lx < rw * 0.8) return ly === rh - 7 ? 0.62 : 0.42; // console
            if (ly === rh - 8 && lx > rw * 0.25 && lx < rw * 0.75 && lx % 3 === 0) return 'lamp';                 // screens
            if (ly > 2 && ly < 6 && lx > rw * 0.35 && lx < rw * 0.65) return 0.7;                                   // forward window
            return null;
        },
        lab(lx, ly, rw, rh) {
            if (ly >= rh - 6 && ly < rh - 2 && ((lx > 3 && lx < rw * 0.35) || (lx > rw * 0.65 && lx < rw - 3))) return ly === rh - 6 ? 0.6 : 0.36; // benches
            if (ly > rh * 0.25 && ly < rh * 0.5 && lx > rw * 0.42 && lx < rw * 0.58) return ((lx + ly) % 2) ? 0.55 : 0.3; // scanner column
            return null;
        },
        quarters(lx, ly, rw, rh) {
            const bunk = [0.5, 0.78].some(h => ly === Math.round(rh * h)) && (lx < rw * 0.32 || lx > rw * 0.68);
            return bunk ? 0.55 : null;
        },
        cargo(lx, ly, rw, rh) {
            const bay = Math.floor(lx / (rw / 5)), inBay = lx - bay * (rw / 5), h = [7, 11, 5, 9, 4][bay] || 0;
            if (inBay > 2 && inBay < rw / 5 - 2 && ly >= rh - 2 - h && ly < rh - 2) return 0.36 + (((Math.floor(inBay) + ly) % 4) < 2 ? 0.24 : 0);
            return null;
        },
        engineering(lx, ly, rw, rh) {
            const r = Math.min(rw, rh) * 0.24, d = Math.hypot(lx - rw / 2, ly - rh * 0.48);
            if (d < r + 2 && d >= r) return 0.5;
            if (Math.abs(ly - Math.round(rh * 0.48)) < 1 && d > r + 2) return 0.4; // conduits
            return null;
        },
        upgrades(lx, ly, rw, rh) {
            if (Math.abs((lx - rw * 0.3) - (ly - rh * 0.25)) < 1 && ly > rh * 0.25 && ly < rh * 0.7) return 0.6; // fabricator arm
            return null;
        },
    };

    function paintStatic(ctx, L, damaged) {
        const stern = L.rooms[L.rooms.length - 1];
        for (let y = L.top; y < L.top + L.height; y++) {
            const hw = halfWidth(L, y), room = L.rooms.find(r => y >= r.top && y < r.bottom);
            for (let x = Math.floor(L.cx - L.maxHalf - 1); x <= Math.ceil(L.cx + L.maxHalf + 1); x++) {
                const dx = Math.abs(x - L.cx);
                if (hw > 0 && dx <= hw) {
                    const isDamaged = room && damaged[room.key], ramp = isDamaged ? RED_RAMP : HULL_RAMP;
                    let g;
                    if (dx > hw - 2 || !room) g = 0.5 + (x < L.cx ? 0.14 : -0.08);                       // plating
                    else if (y === room.top) g = 0.42;                                                  // the deck above
                    else {
                        const rh = room.bottom - room.top, ly = y - room.top, rw = hw * 2, lx = x - (L.cx - hw);
                        if (ly >= rh - 2) g = 0.6;                                                      // floor
                        else {
                            const prop = PROPS[room.key](lx, ly, rw, rh);
                            if (prop === 'lamp') { ctx.fillStyle = isDamaged ? '#6e241d' : LAMP; ctx.fillRect(x, y, 1, 1); continue; }
                            g = prop != null ? prop : 0.13 + 0.24 * Math.max(0, 1 - ly / rh) * (1 - (dx / hw) * 0.6);
                            if (isDamaged) g *= 0.6;
                        }
                    }
                    ctx.fillStyle = rampAt(ramp, g, x, y);
                    ctx.fillRect(x, y, 1, 1);
                } else if (y >= stern.bottom && y < stern.bottom + 3 && Math.abs(dx - L.maxHalf * 0.4) < 4) {  // engine bells
                    ctx.fillStyle = rampAt(HULL_RAMP, 0.55, x, y);
                    ctx.fillRect(x, y, 1, 1);
                }
            }
        }
    }

    /**
     * Draw the ship. opts.damaged: { roomKey: true } paints a room in emergency red. opts.dim: { roomKey: 0..1 } darkens a
     * room (1 = black, for a room without power or air). opts.labels: draw room names. The static hull is cached per layout.
     */
    function draw(ctx, L, t = 0, opts = {}) {
        const damaged = opts.damaged || {}, key = JSON.stringify(damaged);
        if (!L.cache || L.cacheKey !== key) {
            const c = document.createElement('canvas');
            c.width = Lab.W; c.height = Lab.H;
            paintStatic(c.getContext('2d'), L, damaged);
            L.cache = c; L.cacheKey = key;
        }
        ctx.drawImage(L.cache, 0, 0);

        // the reactor's heartbeat and the engine flame
        const eng = L.room('engineering'), rw = halfWidth(L, eng.top + 4) * 2, rh = eng.bottom - eng.top;
        const beat = Math.pow(1 - ((t / 4000) % 1), 3.4), r = Math.min(rw, rh) * 0.24;
        Lab.disc(ctx, L.cx, eng.top + rh * 0.48, r * (0.7 + 0.3 * beat), d => (0.4 + 0.6 * beat) * (1 - d * 0.5), damaged.engineering ? '#d85a4e' : '#d6ffe4');
        const stern = L.rooms[L.rooms.length - 1];
        [-1, 1].forEach(side => {
            const ex = L.cx + side * L.maxHalf * 0.4, len = 4 + 3 * Math.abs(Math.sin(t / 90 + side));
            for (let d = 0; d < len; d++) Lab.shade(ctx, ex - 2 + d * 0.3, stern.bottom + 3 + d, 5 - d * 0.6, 1, 1 - d / len, d < 2 ? '#fff4d6' : LAMP);
        });

        // rooms without power
        Object.entries(opts.dim || {}).forEach(([k, amount]) => {
            const room = L.room(k);
            if (!room || amount <= 0) return;
            for (let y = room.top + 1; y < room.bottom; y++) {
                const hw = halfWidth(L, y) - 2;
                Lab.shade(ctx, L.cx - hw, y, hw * 2, 1, amount, '#05070a');
            }
        });

        if (opts.labels !== false) L.rooms.forEach(room => {
            const ly = room.key === 'bridge' ? room.top + Math.round((room.bottom - room.top) * 0.5) : room.top + 3; // the nose is too narrow at the top
            Lab.text(ctx, room.label, Math.round(L.cx - halfWidth(L, ly) + 4), ly, damaged[room.key] ? '#d85a4e' : '#2f6347');
        });
    }

    /** A 5×9 crew figure standing with its feet at (feetX, feetY); isLying lays it on a bunk. */
    function figure(ctx, feetX, feetY, color, isStepping = false, isLying = false) {
        const rows = isStepping ? FIGURE_STEP : FIGURE;
        rows.forEach((row, r) => {
            for (let c = 0; c < row.length; c++) {
                if (row[c] !== '#') continue;
                ctx.fillStyle = r < 2 ? SKIN : (r >= 7 ? shadeHex(color, 0.55) : color);
                if (isLying) ctx.fillRect(Math.round(feetX) - r + 4, feetY - 1 - (c % 3), 1, 1);
                else ctx.fillRect(Math.round(feetX) + c - 2, feetY - (rows.length - r), 1, 1);
            }
        });
    }

    function shadeHex(hex, k) {
        const n = parseInt(hex.slice(1), 16);
        const ch = s => Math.round(((n >> s) & 255) * k).toString(16).padStart(2, '0');
        return '#' + ch(16) + ch(8) + ch(0);
    }

    Lab.ship = { ROOMS, CREW, HULL_RAMP, layout, draw, figure, rampAt };
})();
