/* ShipCutaway — the left panel as a living cross-section of EXODUS-9 instead of six text boxes.
   A low-res canvas sits behind the existing .ship-deck elements (which stay as the click targets
   and keep every bundle.js hook working). Rooms are lit compartments with props, damaged decks go
   dark and red, and each crew member is a small figure standing in the room their job puts them in —
   the injured lie in Quarters, the dead are simply gone. Drawn with DitherCore's ramp dither. */

(function () {
    'use strict';
    const Core = window.DitherCore;
    const hull = document.querySelector('.ship-hull');
    if (!Core || !hull) return;

    const { vnoise, ramp, quantize } = Core;
    const PX = 2;
    const ROOMS = ['bridge', 'lab', 'quarters', 'cargo', 'engineering', 'upgrades'];
    const HULL_RAMP = ramp('#06070a', '#0d1a15', '#1b3329', '#2f5a48', '#74d99a', '#d6ffe4');
    const LAMP_ACCENT = [232, 170, 84];
    const SKIN = [232, 216, 192];
    const ROLE_STATION = { LEADER: 'bridge', MEDIC: 'lab', SPECIALIST: 'lab', SECURITY: 'cargo', ENGINEER: 'engineering' };
    const ROLE_COLOR = { LEADER: [255, 255, 255], MEDIC: [64, 200, 255], SPECIALIST: [208, 112, 255], SECURITY: [255, 80, 80], ENGINEER: [240, 160, 48] };
    const BEDRIDDEN = ['INJURED', 'CATATONIC'];
    const BUNK_SLOTS = [[-1, 0.5], [-1, 0.78], [1, 0.78]]; // [side, height in room]
    const FIGURE = ['.###.', '.###.', '..#..', '#####', '#####', '.###.', '.###.', '.#.#.', '.#.#.']; // 5×9, rows 0-1 head
    const FIGURE_STEP = ['.###.', '.###.', '..#..', '#####', '#####', '.###.', '.###.', '..##.', '.#...'];

    const POD_LENGTH = 11; // stasis pod, in buffer pixels
    const CARGO_BAYS = 5, ITEMS_PER_PALLET = 4; // 5 × 4 = the 20-item hold
    let cargoCount = 0;

    const roleOf = member => Object.keys(ROLE_STATION).find(tag => (member.tags || []).includes(tag));
    const colorOf = member => ROLE_COLOR[roleOf(member)] || SKIN;
    const isBedridden = member => BEDRIDDEN.includes(member.status) || (member.tags || []).includes('SEDATED');
    /** Which room a living crew member is drawn in (also what DeckPanel lists as "in this room"). */
    const stationOf = member => (isBedridden(member) ? 'quarters' : (ROLE_STATION[roleOf(member)] || 'quarters'));

    const canvas = document.createElement('canvas');
    canvas.className = 'ship-cutaway';
    canvas.setAttribute('aria-hidden', 'true');
    hull.insertBefore(canvas, hull.firstChild);
    hull.classList.add('has-cutaway');
    const ctx = canvas.getContext('2d');
    let view = null;

    function measure() {
        const w = Math.floor(hull.clientWidth / PX), h = Math.floor(hull.clientHeight / PX);
        if (w < 20 || h < 60) { view = null; return; }
        canvas.width = w; canvas.height = h;
        const rooms = ROOMS.map(key => {
            const el = hull.querySelector(`.ship-deck[data-room="${key}"]`);
            return el ? { key, top: Math.round(el.offsetTop / PX), bottom: Math.round((el.offsetTop + el.offsetHeight) / PX) } : null;
        }).filter(Boolean);
        if (rooms.length === 0) { view = null; return; }
        const rowRoom = new Int8Array(h).fill(-1);
        rooms.forEach((r, k) => { for (let y = r.top; y < r.bottom && y < h; y++) rowRoom[y] = k; });
        view = {
            w, h, rooms, rowRoom, cx: w / 2, maxHalf: w / 2 - 5, img: ctx.createImageData(w, h),
            gray: new Float32Array(w * h), acc: new Float32Array(w * h), mask: new Uint8Array(w * h),
        };
    }

    // half-width of the hull at row y: rounded nose over the bridge, slight taper at the stern
    function halfWidth(v, y) {
        const nose = v.rooms[0], stern = v.rooms[v.rooms.length - 1];
        if (y < nose.top || y >= stern.bottom) return 0;
        if (y < nose.bottom) return v.maxHalf * (0.3 + 0.7 * Math.sin(((y - nose.top) / (nose.bottom - nose.top)) * Math.PI / 2));
        if (y >= stern.top) return v.maxHalf * (1 - 0.22 * ((y - stern.top) / (stern.bottom - stern.top)));
        return v.maxHalf;
    }

    // ── room furniture: returns { g, a } for a pixel, or null to fall through to bare lit wall ──
    const PROPS = {
        bridge(lx, ly, rw, rh, dx, hw, t, x, y) { // a viewport onto the stars, a console under it
            if (ly > rh * 0.3 && ly < rh * 0.58 && dx < hw * 0.62) return { g: vnoise(x * 0.9, y * 0.9 + t / 5000) > 0.8 ? 1 : 0.03, a: 0 };
            if (ly >= rh - 6 && ly < rh - 2 && dx < hw * 0.5) return { g: 0.5, a: (x % 4 === 0 && ly === rh - 5 && Math.floor(t / 500 + x) % 3) ? 1 : 0 };
            return null;
        },
        lab(lx, ly, rw, rh, dx, hw, t, x) { // three specimen tubes
            for (const f of [0.28, 0.5, 0.72]) {
                if (Math.abs(lx - rw * f) < 2 && ly > rh * 0.32 && ly < rh - 2) return { g: 0.7 + 0.25 * Math.sin(t / 600 + f * 9), a: 0.7 };
            }
            return null;
        },
        quarters(lx, ly, rw, rh, dx, hw) { // bunks along both walls
            const bunk = Math.abs(ly - Math.round(rh * 0.5)) < 1 || Math.abs(ly - Math.round(rh * 0.78)) < 1;
            return (bunk && dx > hw * 0.38) ? { g: 0.55, a: 0 } : null;
        },
        cargo(lx, ly, rw, rh) { // one pallet per ITEMS_PER_PALLET carried, filling bays left to right; empty bays are floor marks
            const bayWidth = rw / CARGO_BAYS, bay = Math.floor(lx / bayWidth), inBay = lx - bay * bayWidth;
            if (bay < 0 || bay >= CARGO_BAYS || inBay < 2 || inBay > bayWidth - 2) return null;
            const load = Math.max(0, Math.min(ITEMS_PER_PALLET, cargoCount - bay * ITEMS_PER_PALLET)); // items on this pallet
            if (load === 0) return (ly === rh - 3 && Math.floor(inBay) % 3 === 0) ? { g: 0.34, a: 0 } : null;
            const height = 2 + load * 3;
            if (ly >= rh - 2 - height && ly < rh - 2) return { g: 0.36 + (((Math.floor(inBay) + ly) % 4) < 2 ? 0.24 : 0), a: 0 };
            return null;
        },
        engineering(lx, ly, rw, rh, dx, hw, t) { // the reactor
            const r = Math.min(rw, rh) * 0.24, d = Math.sqrt(Math.pow(lx - rw / 2, 2) + Math.pow(ly - rh * 0.48, 2));
            if (d < r) return { g: 0.72 + 0.28 * Math.sin(t / 400), a: 1 };
            if (d < r + 2) return { g: 0.5, a: 0 };
            if (Math.abs(ly - Math.round(rh * 0.48)) < 1) return { g: 0.4, a: 0 };
            return null;
        },
        upgrades(lx, ly, rw, rh, dx, hw, t) { // fabricator arm over a glowing forge
            const forge = Math.sqrt(Math.pow(lx - rw / 2, 2) + Math.pow(ly - (rh - 3), 2) * 2.5);
            if (forge < 6) return { g: 0.75 + 0.25 * Math.sin(t / 250 + lx), a: 1 };
            if (Math.abs((lx - rw * 0.3) - (ly - rh * 0.25)) < 1 && ly > rh * 0.25 && ly < rh * 0.7) return { g: 0.6, a: 0 };
            return null;
        },
    };

    function shadeRoom(v, room, isDamaged, x, y, dx, hw, t) {
        const rh = room.bottom - room.top, ly = y - room.top, rw = hw * 2, lx = x - (v.cx - hw);
        if (ly >= rh - 2) return { g: 0.6, a: 0 };                                     // deck plating underfoot
        const lamp = 0.13 + 0.24 * Math.max(0, 1 - ly / rh) * (1 - (dx / hw) * 0.6);   // ceiling light falloff
        const prop = PROPS[room.key](lx, ly, rw, rh, dx, hw, t, x, y);
        if (!isDamaged) return prop || { g: lamp, a: 0 };
        const flicker = Math.floor(t / 125) % 9 === 0 ? 0.5 : 0.18;                    // dying emergency lighting
        const spark = vnoise(x * 3.1 + Math.floor(t / 125) * 5.7, y * 3.1) > 0.965;
        return { g: spark ? 1 : (prop ? prop.g * 0.4 : lamp) * flicker * 2, a: 0 };
    }

    function renderHull(v, decks, t) {
        const stern = v.rooms[v.rooms.length - 1];
        for (let y = 0; y < v.h; y++) {
            const hw = halfWidth(v, y), k = v.rowRoom[y];
            for (let x = 0; x < v.w; x++) {
                const i = y * v.w + x, dx = Math.abs(x - v.cx);
                if (hw > 0 && dx <= hw) {
                    let cell;
                    if (dx > hw - 2 || k < 0) cell = { g: 0.5 + (x < v.cx ? 0.14 : -0.08) + 0.1 * vnoise(x * 0.5, y * 0.5), a: 0 }; // plating
                    else cell = shadeRoom(v, v.rooms[k], decks[v.rooms[k].key] === 'DAMAGED', x, y, dx, hw, t);
                    v.gray[i] = cell.g; v.acc[i] = cell.a; v.mask[i] = 1;
                } else if (y >= stern.bottom && y < stern.bottom + 9) {                  // engine bells + exhaust
                    const off = Math.abs(dx - v.maxHalf * 0.4), depth = y - stern.bottom;
                    if (off < 4 && depth < 3) { v.gray[i] = 0.55; v.mask[i] = 1; }
                    else if (off < 3 - depth * 0.3 && depth < 5 + 3 * vnoise(x, t / 90)) { v.gray[i] = 1; v.acc[i] = 1; v.mask[i] = 1; }
                }
            }
        }
    }

    function tintDamaged(v, decks) { // emergency red over any damaged compartment
        const d = v.img.data;
        v.rooms.forEach(room => {
            if (decks[room.key] !== 'DAMAGED') return;
            for (let y = room.top; y < room.bottom; y++) for (let x = 0; x < v.w; x++) {
                const o = (y * v.w + x) * 4;
                if (!d[o + 3]) continue;
                const lum = Math.max(d[o], d[o + 1], d[o + 2]);
                d[o] = Math.min(255, lum * 1.15 + 18); d[o + 1] = lum * 0.22; d[o + 2] = lum * 0.18;
            }
        });
    }

    // ── installed upgrades, bolted on where Upgrades.js says they mount ──
    const PART = [116, 217, 154], PART_BRIGHT = [214, 255, 228], PART_DARK = [47, 90, 72], MED_WHITE = [220, 230, 225], MED_RED = [216, 90, 78];
    const ADDONS = {
        sensor_v2(v, t) { // dish on a mast above the nose, amber light blinking at its focus
            const top = v.rooms[0].top, cx = Math.round(v.cx);
            for (let y = top - 6; y < top; y++) stamp(v, cx, y, PART);
            for (let dx = -4; dx <= 4; dx++) stamp(v, cx + dx, top - 7, PART_BRIGHT);
            [-5, 5].forEach(dx => { stamp(v, cx + dx, top - 8, PART_BRIGHT); stamp(v, cx + dx, top - 9, PART); });
            if (Math.floor(t / 600) % 2 === 0) stamp(v, cx, top - 9, LAMP_ACCENT);
        },
        fuel_scoop(v) { // two funnels flaring out beside the nose cone
            const nose = v.rooms[0], y0 = nose.top + Math.round((nose.bottom - nose.top) * 0.35);
            for (let r = 0; r < 9; r++) [-1, 1].forEach(side => {
                const edge = halfWidth(v, y0 + r) + 2 + Math.max(0, 4 - r * 0.5);
                stamp(v, Math.round(v.cx + side * edge), y0 + r, PART_BRIGHT);
                stamp(v, Math.round(v.cx + side * (edge - 1)), y0 + r, PART_DARK);
            });
        },
        gyro_fins(v) { // swept fins on the tapering stern
            const stern = v.rooms[v.rooms.length - 1];
            for (let r = 0; r < 11; r++) [-1, 1].forEach(side => {
                const y = stern.top + 5 + r, edge = halfWidth(v, y);
                for (let k = 1; k <= 1 + Math.round(r * 0.6); k++) stamp(v, Math.round(v.cx + side * (edge + k)), y, k === 1 + Math.round(r * 0.6) ? PART_BRIGHT : PART_DARK);
            });
        },
        nano_hull(v) { // bright rivet line down both flanks
            const stern = v.rooms[v.rooms.length - 1];
            for (let y = v.rooms[0].top + 2; y < stern.bottom; y += 2) [-1, 1].forEach(side => stamp(v, Math.round(v.cx + side * halfWidth(v, y)), y, PART_BRIGHT));
        },
        autodoc(v) { // white surgical pod with a red cross on the lab's right wall
            const lab = v.rooms.find(r => r.key === 'lab');
            if (!lab) return;
            const x0 = Math.round(v.cx + v.maxHalf * 0.5), y0 = lab.top + Math.round((lab.bottom - lab.top) * 0.38);
            for (let dx = 0; dx < 9; dx++) for (let dy = 0; dy < 8; dy++) {
                const isCross = (dx === 4 && dy > 1 && dy < 6) || (dy === 3 && dx > 1 && dx < 7) || (dy === 4 && dx > 1 && dx < 7);
                stamp(v, x0 + dx, y0 + dy, isCross ? MED_RED : MED_WHITE);
            }
        },
        shield_core(v, t) { // containment ring turning around the reactor
            const eng = v.rooms.find(r => r.key === 'engineering');
            if (!eng) return;
            const rh = eng.bottom - eng.top, cy = eng.top + rh * 0.48, radius = Math.min(v.maxHalf * 2, rh) * 0.24 + 4;
            for (let k = 0; k < 40; k++) {
                if ((k + Math.floor(t / 150)) % 10 < 2) continue; // the travelling gap is what makes it read as spinning
                stamp(v, Math.round(v.cx + Math.cos(k / 40 * 6.283) * radius), Math.round(cy + Math.sin(k / 40 * 6.283) * radius), PART_BRIGHT);
            }
        },
    };

    function drawUpgrades(v, upgrades, t) {
        upgrades.forEach(id => { if (ADDONS[id]) ADDONS[id](v, t); });
    }

    function stamp(v, x, y, rgb) {
        if (x < 0 || y < 0 || x >= v.w || y >= v.h) return;
        const o = (y * v.w + x) * 4, d = v.img.data;
        d[o] = rgb[0]; d[o + 1] = rgb[1]; d[o + 2] = rgb[2]; d[o + 3] = 255;
    }

    function drawFigure(v, feetX, feetY, color, isLying, isStepping) {
        const rows = isStepping ? FIGURE_STEP : FIGURE, dim = color.map(c => c * 0.55);
        rows.forEach((row, r) => {
            for (let c = 0; c < row.length; c++) {
                if (row[c] !== '#') continue;
                const rgb = r < 2 ? SKIN : (r >= 7 ? dim : color);
                if (isLying) stamp(v, Math.round(feetX) - r + 4, feetY - 1 - c % 3, rgb);      // on their back, on a bunk
                else stamp(v, Math.round(feetX) + c - 2, feetY - (rows.length - r), rgb);
            }
        });
    }

    function drawStasisPod(v, cargo, slot, color) { // a sealed capsule: grey shell, one band in the crew member's colour
        const x0 = Math.round(v.cx - v.maxHalf * 0.78 + slot * (POD_LENGTH + 3)), y0 = cargo.top + Math.round((cargo.bottom - cargo.top) * 0.34);
        for (let dx = 0; dx < POD_LENGTH; dx++) for (let dy = 0; dy < 4; dy++) {
            const isCorner = (dx === 0 || dx === POD_LENGTH - 1) && (dy === 0 || dy === 3);
            if (isCorner) continue;
            stamp(v, x0 + dx, y0 + dy, (dx === 3 || dx === 4) ? color : (dy === 0 ? [150, 160, 155] : [84, 94, 90]));
        }
    }

    function drawCrew(v, crew, t) {
        const byKey = {};
        let bedCount = 0, podCount = 0;
        v.rooms.forEach(r => { byKey[r.key] = r; });
        crew.forEach((member, i) => {
            if (member.status === 'DEAD') { // the right person leaves their post and is racked in the cargo hold
                if (byKey.cargo) drawStasisPod(v, byKey.cargo, podCount++, colorOf(member));
                return;
            }
            const bedridden = isBedridden(member), room = byKey[stationOf(member)];
            if (!room) return;
            const rh = room.bottom - room.top, color = colorOf(member);
            if (bedridden) { // fill bunks left-upper, left-lower, right-lower (right-upper is under the status dots)
                const [side, level] = BUNK_SLOTS[bedCount++ % BUNK_SLOTS.length];
                drawFigure(v, v.cx + side * v.maxHalf * 0.62, room.top + Math.round(rh * level), color, true, false);
                return;
            }
            const floorY = room.bottom - 2, range = (halfWidth(v, floorY - 1) - 6) * 0.7;
            const pace = Math.sin(t / 2600 + i * 1.9), jitter = (member.stress || 0) >= 2 ? Math.round(Math.sin(t / 60 + i)) : 0;
            const stressed = (member.stress || 0) >= 3 && Math.floor(t / 250) % 2 === 0;
            drawFigure(v, v.cx + pace * range + jitter, floorY, stressed ? [255, 60, 60] : color, false, Math.abs(Math.cos(t / 2600 + i * 1.9)) > 0.3 && Math.floor(t / 250) % 2 === 0);
        });
    }

    function paint(now) {
        const state = window.app && window.app.state;
        if (!view || !state) return;
        const v = view, decks = {};
        Object.keys(state.shipDecks || {}).forEach(key => { decks[key] = state.shipDecks[key].status; });
        cargoCount = (state.cargo || []).length;
        v.gray.fill(0); v.acc.fill(0); v.mask.fill(0);
        renderHull(v, decks, now);
        quantize(v.img, v.w, v.h, v.gray, v.acc, v.mask, { ramp: HULL_RAMP, accent: LAMP_ACCENT, contrast: 1.05 });
        tintDamaged(v, decks);
        drawUpgrades(v, state.upgrades || [], now);
        drawCrew(v, state.crew || [], now);
        ctx.putImageData(v.img, 0, 0);
    }

    let resizeTimer = 0;
    window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(measure, 150); });
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) setInterval(() => paint(0), 1000);
    else Core.onTick(paint);
    requestAnimationFrame(measure); // after first layout, so deck offsets are real

    window.ShipCutaway = { stationOf, colorOf };
})();
